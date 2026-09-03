/** Concepts for the library, non-comparison and selection sections (M10.4-M10.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'library-sorts': [
      {
        term: 'Real data is not random, and that is the whole design',
        plain: 'Production sorts are built around the order that is already in the input.',
        formal: 'Timsort exploits existing runs; pdqsort detects and destroys adversarial patterns',
        detail: [
          'A textbook sort is analysed on a uniformly random permutation, because that is what the ' +
            'analysis can handle.',
          'Real inputs are appended logs, re-sorted lists, concatenated batches and status ' +
            'columns. All of them carry structure.',
          'Timsort and pdqsort are the two coherent answers. One treats existing order as an ' +
            'opportunity; the other treats existing structure as a threat. Both beat a textbook ' +
            'sort on real data, and they disagree about what real data looks like because they ' +
            'were written for different workloads.'
        ],
        example: 'On 2 000 nearly-sorted elements Timsort does 3 099 comparisons and plain merge sort does 15 061.'
      },
      {
        term: 'Run detection and minrun',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["scan for the ascending stretches<br/>already present in the data"] --> B{"is this run shorter<br/>than minrun?"}',
            '    B -->|yes| C["extend it with an insertion sort<br/>until it reaches minrun"]',
            '    B -->|no| D["keep it as it is"]',
            '    C --> E["every run is now at least minrun,<br/>so the merge tree stays balanced"]',
            '    D --> E'
          ].join('\n'),
          caption: 'Padding the short runs is not tidiness. It keeps the run count near a power of two, and a balanced merge tree is the whole reason the bound holds.'
        },
        plain: 'Find the ascending stretches, and pad short ones up to a computed floor.',
        formal: 'minrun is the top 5 bits of n plus 1 if any lower bit is set, giving 16..32',
        readAs: 'Timsort picks a minimum run length between 16 and 32. The value is chosen so ' +
          'the number of runs is close to a power of two. That keeps the merges balanced, instead ' +
          'of repeatedly merging a huge run with a tiny one.',
        detail: [
          'Merging runs of wildly different lengths is wasteful, so Timsort establishes a floor. ' +
            'Any natural run shorter than minrun is extended to it with a binary insertion sort.',
          'The value is not arbitrary. It is chosen so that n/minrun is just below a power of two, ' +
            'which makes the merge tree balanced.',
          'A round number like 32 on n = 2 049 leaves a final run of 1 to be merged against 2 048. ' +
            'That single unbalanced merge costs more than every balanced one before it.'
        ],
        example: 'minrun(1 000) = 32, minrun(2 048) = 16, minrun(20 000) = 20.'
      },
      {
        term: 'The merge-stack invariants',
        plain: 'Two inequalities over the top three run lengths keep the stack shallow and the merges balanced.',
        formal: 'for runs X (newest), Y, Z: Z > Y + X and Y > X',
        readAs: 'The stack invariant: each run on the stack must be larger than the two above it ' +
          'combined. It keeps merges between comparable sizes, and getting it subtly wrong is what ' +
          'caused the well-known Java and Python bug.',
        detail: [
          'Runs are pushed on a stack and merged lazily, which raises the question of when to ' +
            'merge.',
          'The invariants answer it. The lengths must grow at least as fast as the Fibonacci ' +
            'numbers going down the stack. That forces the stack depth to be O(log n), and keeps ' +
            'merges between runs of comparable size. After every push, a collapse loop restores ' +
            'the invariants by merging the smaller neighbour.',
          'They are the reason Java could size its stack array at a fixed 40 entries, and that ' +
            'dependency is what made the 2015 result matter.'
        ],
        example: 'A settled stack of 120, 80, 45, 30 violates the first: 120 is not greater than 80 + 45.'
      },
      {
        term: 'The 2015 verification result',
        plain: 'The original collapse rule checked only the top three runs, and a violation can survive one deeper.',
        formal: 'de Gouw, Rot, de Boer, Bubel and Hahnle, 2015; the fix adds a check on the fourth run',
        detail: [
          'A team attempting to verify Java\'s Timsort could not prove the stack-depth bound, and ' +
            'the reason was a real defect. The collapse loop examined runs at positions n-1, n-2 ' +
            'and n-3, but a merge could leave the invariant broken at n-4. The fix is one extra ' +
            'clause.',
          'What makes it the best argument in this milestone for verifying invariants is how it ' +
            'presented. The sort returned correct output on every input.',
          'The only observable symptom was an ArrayIndexOutOfBoundsException on arrays of tens of ' +
            'millions of elements. It shipped in Java, Python and Android for years.'
        ],
        example: 'Run lengths 120, 80, 25, 20, 30 - 275 elements - reproduce the broken invariant, and the array still sorts.'
      },
      {
        term: 'Galloping mode',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one run keeps winning<br/>the head comparison"] --> B{"has it won<br/>seven times in a row?"}',
            '    B -->|no| C["carry on merging one element at a time"]',
            '    B -->|yes| D["stop comparing one by one —<br/>binary-search how far it keeps winning"]',
            '    D --> E["copy that whole stretch in one move"]'
          ].join('\n'),
          caption: 'The input that costs a naive merge the most — one run lying entirely below the other — is exactly the one galloping reduces to a handful of comparisons.'
        },
        plain: 'When one run keeps winning, binary-search for how far it keeps winning.',
        formal: 'switch after MIN_GALLOP consecutive wins; doubling search then binary search',
        readAs: 'When one run keeps winning the comparison, stop comparing element by element and ' +
          'start jumping. Double the step until you overshoot, then binary search back. It turns a ' +
          'long one-sided merge from linear into logarithmic.',
        detail: [
          'Merging two runs one element at a time is optimal when they interleave, and wasteful ' +
            'when they do not.',
          'If one run wins seven comparisons in a row, that is evidence a whole block of it ' +
            'precedes the other run\'s head. Timsort switches to a doubling search to find how ' +
            'large that block is and moves it at once, turning k comparisons into log₂ k.',
          'The threshold adapts. It drops while galloping pays and rises while it does not, so ' +
            'interleaved data stops paying for the machinery almost immediately.'
        ],
        example: 'Concatenating two sorted halves of 1 000 elements each is one run detection and no merge at all.'
      },
      {
        term: 'pdqsort: an unbalanced partition is evidence, not luck',
        plain: 'When the split is bad, swap a few elements so the next pivot sample is uncorrelated with the pattern.',
        formal: 'if either side is below size/8, break the pattern with fixed-offset swaps inside each partition',
        readAs: 'A partition that splits worse than one to seven is evidence of an adversarial ' +
          'pattern. So pdqsort deliberately shuffles a few fixed positions to destroy it — no ' +
          'randomness needed, and no way for an attacker to predict the result.',
        detail: [
          'A deterministic pivot rule defeated once will be defeated the same way again, because ' +
            'the thing that defeated it is a property of the arrangement.',
          'pdqsort responds by deliberately disturbing the arrangement. A handful of swaps at ' +
            'fixed offsets, costing nothing, decorrelate the next sample from whatever produced ' +
            'this one.',
          'The swaps have to stay strictly inside one partition. Reaching across the pivot mixes ' +
            'an element below it with one above, and silently undoes the partition just computed.'
        ],
        example: 'Organ-pipe input of 20 000 elements: 394 pattern breaks, and no heapsort fallback needed.'
      },
      {
        term: 'The bounded insertion sort: a bet that is cheap to lose',
        plain: 'If a partition came back already ordered, try to finish with an insertion sort limited to 8 moves.',
        formal: 'partial_insertion_sort: give up the moment the shift count passes the limit',
        detail: [
          'An already-partitioned range is evidence the input may be nearly sorted, and insertion ' +
            'sort finishes nearly-sorted data in linear time.',
          'The risk is that the evidence is wrong and insertion sort costs O(n²). The bound ' +
            'removes the risk: attempt it, and abandon it after a small constant number of shifts.',
          'Winning makes sorted input cost O(n). Losing costs eight moves. The measured give-up ' +
            'cost is identical at 200, 2 000 and 20 000 elements, which is what "cheap to lose" ' +
            'means.'
        ],
        example: 'pdqsort on 20 000 sorted elements: 40 010 comparisons - two per element - at recursion depth 1.'
      },
      {
        term: 'A deterministic worst-case bound',
        plain: 'pdqsort reaches O(n log n) worst case without a random pivot.',
        formal: 'a depth budget of log2 n, then heapsort - and no randomness anywhere',
        readAs: 'Introsort counts how deep the recursion has gone, and once it passes log₂ n it ' +
          'abandons quicksort for heapsort. That gives an n log n worst case with no random number ' +
          'generator in sight.',
        detail: [
          'Randomised pivots give a probabilistic guarantee at the cost of reproducibility. Two ' +
            'runs on the same input do different work, which complicates benchmarking, debugging, ' +
            'and any cache that depends on the output being computed the same way twice.',
          'pdqsort gets the same worst-case bound from pattern breaking plus a depth budget, both ' +
            'deterministic.',
          'That is a genuinely better trade than "add randomness", and it is the part of the ' +
            'design most worth stealing.'
        ],
        example: 'On the anti-quicksort input at 4 096 elements: 59 470 comparisons at depth 14, and the same numbers every run.'
      }
    ],

    'non-comparison-sorts': [
      {
        term: 'The bound is about a model, not about sorting',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Ω(n log n)"] --> B["holds for algorithms that learn<br/>only by comparing pairs of keys"]',
            '    C["counting and radix sort read<br/>the digits of the key instead"] --> D["they sit outside that model,<br/>so the bound says nothing about them"]',
            '    D --> E["you did not beat the bound —<br/>you changed the model"]'
          ].join('\n'),
          caption: 'A lower bound is always a statement about a model of computation. Naming the model is half of stating the theorem, and the half people drop.'
        },
        plain: 'Ω(n log n) applies to algorithms that only compare pairs. These do not.',
        formal: 'counting and radix read the key as an index or a digit sequence, never as a comparand',
        detail: 'The decision-tree argument bounds any algorithm whose only information about the input comes ' +
          'from comparisons. Counting sort never compares anything: it uses the key as an array index. Radix ' +
          'sort never compares anything either: it reads the key one digit at a time. The demo reports zero ' +
          'comparisons for every radix run, and that is not an instrumentation gap - it is what leaving the ' +
          'model means. They are not faster comparison sorts; they are a different kind of algorithm with a ' +
          'different precondition.',
        example: 'LSD radix on 20 000 elements: 0 comparisons, 4 passes, 80 000 moves.'
      },
      {
        term: 'Counting sort is priced by the key range',
        plain: 'One counter per possible key, so memory depends on k and not on n.',
        formal: 'O(n + k) time and O(k) space, where k is the size of the key domain',
        readAs: 'Counting sort costs one pass over the data plus one over the range of possible keys. When ' +
          'the range is small that beats any comparison sort; when it is large the k term is the whole ' +
          'cost.',
        detail: 'This is the constraint that decides whether counting sort is usable, and it has nothing to ' +
          'do with how many elements there are. Sorting a thousand values with byte-sized keys needs a ' +
          '1 024-byte table and beats any comparison sort outright. Sorting a thousand 32-bit integers the ' +
          'same way needs a table of 4 294 967 296 counters - 17 GB. The crossover moves with n, because a ' +
          'large table is worth amortising over more elements, which is the real rule rather than "counting ' +
          'sort needs small keys".',
        example: 'n = 1 000: key range 256 needs 1 024 bytes and wins; key range 65 536 needs 262 144 bytes and loses.'
      },
      {
        term: 'LSD radix: stable-or-broken',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["pass 1 — sort by the last digit"] --> B["pass 2 — sort by the next digit up"]',
            '    B --> C["pass 3 — and so on to the top digit"]',
            '    C --> D["correct only if every pass preserved<br/>the order the previous pass established"]',
            '    D --> E["one unstable pass and the result is wrong,<br/>while still looking almost sorted"]'
          ].join('\n'),
          caption: 'Each pass depends on the one before it. Stability is not a nicety here, it is the mechanism — which is why an unstable scatter is invisible on one-digit keys.'
        },
        plain: 'Every digit pass must preserve the order the previous passes established.',
        formal: 'sort by digit 0, then digit 1, ...; each pass must be stable or the earlier ones are undone',
        readAs: 'Least-significant-digit radix sort works only because each pass preserves the order the ' +
          'previous one established. An unstable pass anywhere in the chain silently destroys all the ' +
          'work before it.',
        detail: 'Least-significant-digit radix works by induction: after sorting on digits 0..i the array is ' +
          'ordered by the low i+1 digits, and the pass on digit i+1 preserves that ordering *within* each ' +
          'group of equal digit-(i+1) values only because it is stable. Break stability in any single pass ' +
          'and every earlier pass is silently reversed. It is one line - the scatter loop walks the input ' +
          'backwards while decrementing the bucket cursor - and getting it wrong produces output that is not ' +
          'sorted but looks close.',
        example: 'With a wide key range, an unstable digit pass leaves the very first adjacent pair out of order.'
      },
      {
        term: 'The failure is graded by how many passes matter',
        plain: 'One meaningful pass hides an unstable scatter; four passes expose it completely.',
        formal: 'passes that carry information = ceil(log_radix(key range))',
        readAs: 'You only need as many digit passes as it takes to cover the actual range of keys, not the ' +
          'full width of the type. Sorting 32-bit integers that all fit in 16 bits needs half the ' +
          'passes.',
        detail: 'This is why the bug survives testing. If the keys all fit in one digit, only one pass does ' +
          'anything, and an unstable pass still produces sorted output - only the tie order is wrong, which ' +
          'nothing downstream may notice. Widen the keys so four passes carry information and the same code ' +
          'produces output that is not sorted at all. A radix sort tested on small keys and deployed on large ' +
          'ones fails exactly here, and the code did not change.',
        example: 'Key range 0..19: unstable is still sorted. Key range 0..10^6: unstable is not sorted at all.'
      },
      {
        term: 'Negative numbers and the sign bias',
        plain: 'Two\'s-complement negatives have the top bit set, so an unsigned digit sort puts them last.',
        formal: 'map value to (value XOR 0x80000000), which is order-preserving on the full 32-bit range',
        readAs: 'Flipping the sign bit turns signed integers into unsigned ones that sort in the same order, ' +
          'so a radix sort can treat them as plain bit patterns. Without it, every negative number ' +
          'sorts above every positive one.',
        detail: 'The bug is universal in hand-rolled radix sorts because it is invisible on non-negative test ' +
          'data. A negative 32-bit integer has its most significant bit set, so treating the key as unsigned ' +
          'sorts every negative after every positive. Flipping that sign bit maps the signed range onto the ' +
          'unsigned one monotonically, which is one XOR at the point the digit is extracted and costs ' +
          'nothing. The same idea handles floats, with a slightly larger transformation.',
        example: 'Without the bias: [0, 1, 100, 2147483647, -2147483648, -100, -1].'
      },
      {
        term: 'MSD radix and variable-length keys',
        plain: 'Most-significant digit first can stop as soon as a bucket holds one element.',
        formal: 'recurse per bucket; a bucket of size <= 1 needs no further digits',
        detail: 'LSD must examine every digit of every key, which is correct for fixed-width integers and ' +
          'wasteful for strings where most pairs differ in the first character. MSD partitions on the high ' +
          'digit first and recurses, so a key that is already distinguished is never looked at again - which ' +
          'is what makes it the right shape for strings and the wrong one for integers. American flag sort is ' +
          'MSD done in place by permutation cycles, trading stability for the buffer.',
        example: 'MSD with an insertion-sort cutoff at 16 elements short-circuits most of its recursion.'
      },
      {
        term: 'Bucket sort assumes a distribution',
        plain: 'Split the range into n equal buckets and sort each - which is linear only if the keys are uniform.',
        formal: 'O(n) expected under uniformity; O(n log n) or worse when the assumption fails',
        detail: 'Bucket sort is the only algorithm in this milestone whose complexity depends on a property ' +
          'of the *values* rather than of their order. Uniform keys spread evenly and each bucket holds a ' +
          'constant number of elements; skewed keys pile into one bucket and the cost becomes whatever sorts ' +
          'that bucket. The number to watch is the largest bucket, not the mean, and the demo reports it - a ' +
          'mean of 1.0 with a maximum of n is a linear algorithm on paper and a quadratic one in practice.',
        example: 'The histogram shows the fullest bucket against the mean; when they diverge the assumption has failed.'
      },
      {
        term: 'Digit width: passes against table size',
        plain: 'A wider digit means fewer passes and a bigger counter table, and the cache decides.',
        formal: 'r bits per digit gives ceil(32/r) passes over 2^r buckets',
        readAs: 'Wider digits mean fewer passes over more buckets: 8 bits gives 4 passes over 256 buckets, 16 ' +
          'bits gives 2 passes over 65 536. The buckets have to stay in cache, which is what caps the ' +
          'digit width.',
        detail: 'Four bits gives 16 buckets and eight passes; sixteen bits gives 65 536 buckets and two ' +
          'passes. Fewer passes is less data movement, so the wide digit looks obviously better until the ' +
          'counter table stops fitting in cache and every scatter becomes a miss. Eight bits - 256 counters, ' +
          'one kilobyte - is the usual answer because that table stays resident. This is a cache decision ' +
          'dressed as an arithmetic one, and it is why the answer is 8 rather than as-wide-as-possible.',
        example: '8 bits: 256 buckets, 1 024 bytes, 4 passes. 16 bits: 65 536 buckets, 262 144 bytes, 2 passes.'
      }
    ],

    'selection-and-order': [
      {
        term: 'Recursing into one side turns n log n into 2n',
        diagram: {
          definition: [
            'flowchart LR',
            '    Q["quicksort:<br/>partition, then recurse into both sides"] --> A["n log n"]',
            '    S["quickselect:<br/>partition, then recurse into the one side<br/>the answer must be on"] --> B["n + n/2 + n/4 + … which is about 2n"]',
            '    B --> C["the work halves every time,<br/>so the whole sum stays linear"]'
          ].join('\n'),
          caption: 'Throwing away the half you do not need collapses the recursion from a tree into a path, and the geometric series that leaves is linear.'
        },
        plain: 'Quickselect is quicksort that throws away the half it does not need.',
        formal: 'T(n) = T(n/2) + n sums to 2n; T(n) = 2T(n/2) + n sums to n log n',
        readAs: 'Recursing into one half gives a total of 2n — the work halves every level, so the series ' +
          'converges. Recursing into both gives n at every level and log n levels. That single ' +
          'difference is why selection is linear and sorting is not.',
        detail: 'The two recurrences differ by a single coefficient and that coefficient is the whole result. ' +
          'Quicksort handles the entire array at every level, so the per-level cost stays n and there are ' +
          'log n levels. Quickselect discards one side, so the per-level cost halves and the geometric series ' +
          'n + n/2 + n/4 + ... sums to 2n. Everything else about the two algorithms - the partition scheme, ' +
          'the pivot rule, the worst case, the fixes for it - is identical.',
        example: 'Median of 100 000 random elements: quickselect 3.30 comparisons per element, sorting 15.29.'
      },
      {
        term: 'Median of medians: a guarantee with a large constant',
        plain: 'Groups of five, the median of each, then the median of those - and at least 30% is discarded.',
        formal: 'the pivot exceeds at least 3n/10 elements, so T(n) <= T(n/5) + T(7n/10) + n is linear',
        readAs: 'Median-of-medians guarantees the pivot beats at least three tenths of the input, so the ' +
          'larger side is at most seven tenths. Because 1/5 + 7/10 is less than 1, the recursion ' +
          'shrinks geometrically and the total is linear.',
        detail: 'The chosen value is greater than three elements in at least half the groups of five, so at ' +
          'least 3n/10 of the array is below it and at least 3n/10 above - meaning the recursion is on at ' +
          'most 7n/10 whichever way the partition falls. Since 1/5 + 7/10 < 1 the recurrence is linear. That ' +
          'is a real worst-case bound and it comes with a constant around 8 to 10 in practice, which is why ' +
          'it is the right choice when an adversary picks your input and the wrong one otherwise.',
        example: 'Measured on 100 000 elements: 8.28 comparisons per element against quickselect\'s 3.30.'
      },
      {
        term: 'Introselect: the same escape hatch as introsort',
        plain: 'Quickselect, with the guaranteed pivot rule taking over when the depth says the pivots are going badly.',
        formal: 'switch to median-of-medians pivots after 2 log2 n levels',
        detail: 'The pattern is identical to introsort and for the same reason: the expected-linear algorithm ' +
          'is what you want almost always, and the guaranteed one is what you want in the tail. A depth ' +
          'counter distinguishes them at negligible cost, and the average case is untouched because the ' +
          'fallback never fires on well-behaved input. This composition - fast algorithm, cheap detector, ' +
          'guaranteed fallback - is the most transferable idea in the whole milestone.',
        example: 'Introselect matches quickselect on random input and matches median-of-medians on the adversarial one.'
      },
      {
        term: 'Duplicates need three-way partitioning here too',
        plain: 'If k lands inside the equal block, the answer is already found and no recursion happens.',
        formal: 'partition into less/equal/greater; if left <= k < right, return immediately',
        detail: 'A two-way partition on an array of few distinct values re-partitions the same equal elements ' +
          'over and over, exactly as it does in quicksort, and the selection becomes quadratic for the same ' +
          'reason. Partitioning three ways fixes it and adds something the sort does not get: when k falls ' +
          'inside the equal block every element there *is* the answer, so the algorithm returns without ' +
          'recursing at all. Selection on an all-equal array is one pass.',
        example: 'All 80 elements equal to 4: every k from 0 to 79 is answered by a single partition.'
      },
      {
        term: 'Top-k is a different question with a different answer',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["which element is the k-th?"] --> B["quickselect —<br/>needs the whole array in memory"]',
            '    C["which are the top k?"] --> D["a heap of size k —<br/>one pass, only k items held"]',
            '    D --> E["so the input may be a stream<br/>that never fits in memory at all"]'
          ].join('\n'),
          caption: 'They sound like the same question. One needs random access to everything at once; the other needs k items of memory and never rewinds.'
        },
        plain: 'A bounded heap of size k is one streaming pass; quickselect needs the whole array.',
        formal: 'heap: O(n log k) time, O(k) space, streaming. quickselect: O(n) time, O(n) space, in place',
        readAs: 'Two ways to get the top k. The heap is slower in theory but holds only k items and works on ' +
          'a stream; quickselect is linear but needs the whole array in memory and reorders it.',
        detail: 'These are not competing implementations of one operation, they are answers to different ' +
          'constraints. The heap holds k elements, sees each input once and never needs the data resident - ' +
          'so it works on a stream of a billion records with k = 10. Quickselect is asymptotically better and ' +
          'requires the array in memory and permutes it. The comparison count says the select wins; the ' +
          'memory model usually decides, and it often says the heap.',
        example: 'Top 10 of 20 000: the heap and the select produce identical output; only their memory differs.'
      },
      {
        term: 'Partial sorting: the k-th element, and the k before it in order',
        plain: 'One quickselect, then sort only the k elements that ended up on the left.',
        formal: 'O(n + k log k), which is what "the top 10 of a million" actually asks for',
        detail: 'The usual request is not "the k-th smallest" but "the smallest k, in order", and doing it as ' +
          'a full sort computes an ordering of the other n-k elements that nobody asked about. One ' +
          'quickselect puts the k smallest at the front - unordered - and sorting just those k costs ' +
          'k log k. For k = 10 and n = 1 000 000 that is a linear pass plus about thirty comparisons, against ' +
          'twenty million for the sort.',
        example: 'Top 10 of 2 000: partial sort agrees exactly with the first ten of a full sort.'
      },
      {
        term: 'Where k is changes what selection costs',
        plain: 'Selecting the minimum discards almost everything on the first partition; selecting the median discards half.',
        formal: 'expected comparisons are about 2n at the median and about n at either extreme',
        detail: 'The 2n figure is the worst position for k, not a universal constant. Selecting the smallest ' +
          'element means the first partition throws away everything above the pivot and the recursion drops ' +
          'immediately into a tiny range, so the total approaches a single pass. The median is the expensive ' +
          'case because each partition can only halve what remains. Moving k across the range in the demo ' +
          'makes the curve visible, and it explains why "find the minimum" is never worth a select.',
        example: 'The demo\'s k slider moves the measured comparison count between roughly n and 2n.'
      },
      {
        term: 'Sort-then-index is usually the right answer',
        plain: 'The log factor is a factor of 15 at a hundred thousand elements, not a factor of a thousand.',
        formal: 'n log2 n / 2n = log2(n) / 2, which is 8.5 at n = 100 000',
        readAs: 'Sorting everything costs about n log₂ n; selecting the median costs about 2n. Divide one by ' +
          'the other and at a hundred thousand elements sorting is roughly eight and a half times the ' +
          'work — for an answer you did not ask for.',
        detail: 'Reaching for quickselect before there is a reason is the mirror of the mistake this section ' +
          'warns about. Sorting and indexing is one line, obviously correct, and gives you every other order ' +
          'statistic for free. The measured penalty at a hundred thousand elements is about 4.6× against ' +
          'quickselect, which matters when the selection is the hot path and does not otherwise. The signal ' +
          'to switch is a profile, and the switch is to a select - not to a faster sort.',
        example: 'n = 200 000: sorting 3 258 388 comparisons, quickselect 504 274 - a factor of 6.5.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
