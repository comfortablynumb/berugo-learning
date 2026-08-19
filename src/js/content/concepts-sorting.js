/** Concepts for the sorting sections (M10.1-M10.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'sorting-contract': [
      {
        term: 'A sort is a contract, not an operation',
        plain: 'Stable, in place, adaptive and comparator-safe are four separate promises, and no sort makes all of them.',
        formal: 'stability × space × adaptivity × comparison model',
        detail: 'Asking "which sort is fastest" is the wrong question because the answer depends on four ' +
          'independent axes that are usually collapsed into one. Stability decides whether equal elements keep ' +
          'their order. In-place decides whether the sort needs a buffer proportional to n. Adaptivity decides ' +
          'whether existing order is exploited or ignored. And the comparison model decides what happens when ' +
          'the comparator is not a strict weak ordering. Every algorithm in this milestone picks a different ' +
          'subset, and the picking is the engineering.',
        example: 'Selection sort: unstable, in place, not adaptive - and 1 999 000 comparisons on 2 000 elements of any shape.'
      },
      {
        term: 'Stability, and when it is load-bearing',
        plain: 'A stable sort leaves equal elements in the order it found them.',
        formal: 'i < j and key(a[i]) = key(a[j]) implies a[i] precedes a[j] in the output',
        detail: 'Stability is what makes multi-key sorting compose. Sort a table by date, then sort the result ' +
          'by author, and with a stable sort each author\'s rows are still in date order - the second sort ' +
          'preserves the first one\'s work. With an unstable sort the second pass scrambles the first, and the ' +
          'bug appears only where there are ties, which is exactly the data a small test set has least of. It ' +
          'is also unobservable from the sorted keys alone: to detect it you have to tag each element with ' +
          'where it started, which is what this milestone\'s harness does for every run.',
        example: 'Insertion sort stops shifting at the first element that is not strictly greater; that `>` rather than `>=` is its entire stability.'
      },
      {
        term: 'Adaptivity: paying for the disorder that is actually there',
        plain: 'An adaptive sort costs less on input that is already partly ordered.',
        formal: 'insertion sort is O(n + I) where I is the number of inversions',
        detail: 'Insertion sort\'s cost is not n² - it is the number of inversions, the pairs that are out of ' +
          'order. On a sorted array there are none and it does n-1 comparisons and no moves at all; on a ' +
          'reversed array every pair is inverted and it does n(n-1)/2. That is why it is the fallback inside ' +
          'Timsort and pdqsort: below a few dozen elements a subarray is nearly sorted after partitioning, and ' +
          'a sort whose cost tracks the remaining disorder is exactly what is wanted. Selection sort has no ' +
          'such property and never will: it scans the whole remaining range whatever it contains.',
        example: 'On 1 000 elements: insertion sort does 999 comparisons on sorted input and about 250 000 on random.'
      },
      {
        term: 'In place, and what it costs',
        plain: 'O(1) extra space, or O(n) - and the trade shows up in the move count.',
        formal: 'auxiliary space, counted separately from the recursion stack',
        detail: 'Merge sort needs a buffer the size of the array; quicksort needs only its recursion stack. ' +
          'That is usually where the discussion stops, and it should not, because "in place" is bought with ' +
          'data movement. Rotation-based in-place merging is O(n log n) comparisons and O(n log² n) moves: ' +
          'measured on 2 000 random elements it does 102 734 moves where buffered top-down merge does 43 904, ' +
          'and it allocates nothing. Whether that is a good trade depends on whether memory or bandwidth is ' +
          'the scarce thing, which is a question about the machine and not about the algorithm.',
        example: 'In-place merge on 2 000 elements: 0 allocations, 51 367 swaps. Buffered merge: 1 allocation, 0 swaps.'
      },
      {
        term: 'The comparison model, and the bound it implies',
        plain: 'A sort that only compares pairs needs at least log₂(n!) comparisons.',
        formal: 'a decision tree with n! leaves has depth >= log2(n!) ~ n log2 n - 1.44n',
        detail: 'The lower bound is a counting argument, not a statement about cleverness. A comparison sort ' +
          'is a decision tree: each internal node is a comparison and each leaf is one of the n! possible ' +
          'orderings. A tree with n! leaves has height at least log₂(n!), which is about n log₂ n. Any ' +
          'algorithm that learns about its input only through comparisons is subject to it, which is why the ' +
          'sorts that beat it - counting, radix, bucket - are the ones that read the key\'s structure instead ' +
          'of comparing it.',
        example: 'Sorting 2 000 elements needs at least about 19 200 comparisons; Timsort measured 19 399 on random input.'
      },
      {
        term: 'The comparator contract: a strict weak ordering',
        plain: 'Irreflexive on equality, antisymmetric, and transitive - all three, or the sort is undefined.',
        formal: 'compare(x, x) = 0; sign(compare(a, b)) = -sign(compare(b, a)); a < b and b < c implies a < c',
        detail: 'These are not pedantic conditions; they are what the algorithm reasons with. A sort that has ' +
          'established a < b and b < c will never compare a with c, so if transitivity fails the wrong order ' +
          'is not detected - it is assumed. C++ calls a violation undefined behaviour, Java throws ' +
          '"Comparison method violates its general contract" when it happens to notice, and JavaScript does ' +
          'neither: it returns an array, and the array is not sorted. Which of the three the caller broke ' +
          'decides how wrong the output looks, and none of them produce a diagnostic.',
        example: '`(a, b) => a > b` returns a boolean; `false` coerces to 0, so the sort is told most pairs are equal.'
      },
      {
        term: 'Counting the right things: comparisons, moves, swaps, allocations',
        plain: 'Four separate budgets, because algorithms trade between them.',
        formal: 'a swap is two moves; an allocation is a buffer, not an element',
        detail: 'Collapsing the counters into one "operations" figure hides exactly what each algorithm is ' +
          'about. Selection sort does the most comparisons of any sort in this milestone and almost the ' +
          'fewest moves - at most n-1 swaps - which is the right trade when an element is a kilobyte and a key ' +
          'is an integer. Merge sort does few comparisons and many moves. An in-place merge trades allocations ' +
          'for moves. Every readout in this milestone names its counter for that reason, and no figure here ' +
          'is a time unless a run count travels with it.',
        example: 'Selection sort on 2 000 random elements: 1 999 000 comparisons, 3 984 moves. Bubble sort: 1 994 247 comparisons, 1 983 686 moves.'
      },
      {
        term: 'Elementary sorts are not obsolete, they are the base case',
        plain: 'Below a few dozen elements, the simple sort with the small constant wins.',
        formal: 'insertion sort is the cutoff routine inside introsort, Timsort and pdqsort',
        detail: 'Asymptotics describe behaviour as n grows and say nothing about n = 20, where the constant ' +
          'factor is everything: no recursion, no buffer, sequential access and a branch predictor that ' +
          'guesses right. Every production sort in this milestone falls back to insertion sort below a ' +
          'threshold - 16 elements for introsort, 24 for pdqsort, and Timsort\'s minrun of 16 to 32 is the ' +
          'same idea in a different shape. The elementary sorts are not a historical section; they are the ' +
          'innermost loop of the sophisticated ones.',
        example: 'pdqsort switches to insertion sort at 24 elements; Timsort pads every natural run up to minrun with a binary insertion sort.'
      }
    ],

    'merge-sort': [
      {
        term: 'The merge is the algorithm',
        plain: 'Two sorted runs into one, reading both forwards and writing forwards.',
        formal: 'merge two runs of a and b in a + b - 1 comparisons at worst',
        detail: 'Everything else in merge sort is a schedule for performing merges. The merge itself takes ' +
          'the smaller of the two heads, and it is the access pattern rather than the comparison count that ' +
          'matters: both inputs are read strictly forwards and the output is written strictly forwards, so it ' +
          'works on data arriving as a stream and needs no random access at all. That single property is why ' +
          'external sorting, log-structured merge trees and every shuffle stage in a data pipeline are merges ' +
          'and not quicksorts.',
        example: 'Merging two runs of 1 000 costs at most 1 999 comparisons and exactly 2 000 moves.'
      },
      {
        term: 'Stability is one character in the merge',
        plain: 'Take from the left run when the heads are equal.',
        formal: 'take right only when right < left, never when right <= left',
        detail: 'The left run holds the element that was originally earlier, so on a tie the left one must go ' +
          'first. Changing that comparison from strict to non-strict leaves every other figure in the section ' +
          'identical - the same comparisons, the same moves, the same correct ordering - and silently removes ' +
          'stability. No test of the sorted output detects it, because the output is still sorted. The demo ' +
          'ships both versions for exactly that reason: the only way to see the difference is to tag elements ' +
          'with their original positions and look at the ties.',
        example: 'The unstable merge sorts 500 tagged elements correctly and reorders the equal ones.'
      },
      {
        term: 'Top-down against bottom-up: the same merges, different bookkeeping',
        plain: 'Recursion or a loop over widths 1, 2, 4, 8 - and the loop copies half as much.',
        formal: 'both do ceil(log2 n) passes; bottom-up alternates the buffer instead of copying back',
        detail: 'The textbook recursion merges into a buffer and copies the result back at every level, which ' +
          'is a second pass over the data per level and buys nothing. The bottom-up loop swaps the roles of ' +
          'the array and the buffer each pass, so nothing is copied back until the end, and it needs no ' +
          'recursion or stack at all. Measured on 2 000 random elements the two do 19 407 and 19 420 ' +
          'comparisons - the same merges - and 43 904 against 24 000 moves.',
        example: 'Bottom-up: 24 000 moves. Top-down: 43 904. Identical comparison counts.'
      },
      {
        term: 'Natural runs: the order already in the data',
        plain: 'Start from the ascending stretches that exist rather than from runs of one.',
        formal: 'a run is a maximal ascending stretch; a strictly descending one is reversed in place',
        detail: 'Random data has runs of about two elements and natural merge sort buys nothing there. Real ' +
          'data is not random: an appended log, a re-sorted list, a partly-updated index all arrive with long ' +
          'runs already present, and starting from them removes whole merge levels. On already-sorted input ' +
          'the detector finds one run and the sort performs zero merges - one linear scan of n-1 comparisons. ' +
          'This is the direct ancestor of Timsort, and the reason Timsort exists at all.',
        example: '2 000 sorted elements: 1 run, 0 merge passes, 2 000 comparisons.'
      },
      {
        term: 'Strict descent is what makes the reversal safe',
        plain: 'Detect descending runs with `<`, never `<=`, or reversing them breaks stability.',
        formal: 'a strictly descending run contains no equal elements, so reversing it cannot reorder ties',
        detail: 'Reversed input costs one pass rather than n/2 merges because a descending run is detected and ' +
          'flipped in place. That flip is only safe if the run has no equal elements in it - otherwise ' +
          'reversing puts a pair of equals in the wrong order and the sort is no longer stable. Using `<=` to ' +
          'find a longer descending run is a tempting optimisation and it is exactly the bug: it makes the ' +
          'runs longer and the sort unstable, and every test of the output still passes.',
        example: 'Reversed input of 2 000 elements: 1 run after reversal, 0 merge passes, 2 000 comparisons.'
      },
      {
        term: 'In-place merging, and what O(1) space really costs',
        plain: 'Rotation-based merging needs no buffer and moves far more data.',
        formal: 'O(n log n) comparisons, O(n log^2 n) moves, O(1) auxiliary space',
        detail: 'Merging without a buffer is done by rotation: split both runs at the point that lets each ' +
          'side be rotated into position, then recurse. It is genuinely in place and it is genuinely stable - ' +
          'the asymmetry between a lower bound on one side and an upper bound on the other is what preserves ' +
          'tie order. What it costs is movement: 102 734 moves and 51 367 swaps on 2 000 random elements, ' +
          'against 43 904 moves and no swaps for the buffered version. "Sorts in place" is a claim with a ' +
          'price, and this is the price.',
        example: 'In-place merge on 2 000 random elements: 26 763 comparisons, 0 allocations, 51 367 swaps.'
      },
      {
        term: 'The k-way merge buys passes, not comparisons',
        plain: 'Merging k runs at once costs the same comparisons and touches the data far less often.',
        formal: 'a heap over k run cursors: log2(k) comparisons per element emitted, in one pass',
        detail: 'Picking the smallest of k heads costs log₂ k comparisons however the merging is arranged, so ' +
          'merging k runs at once and merging them pairwise in log₂ k rounds cost about the same total. What ' +
          'differs is how many times the data is read and written: one pass against log₂ k passes. In memory ' +
          'that is a modest cache effect; once the data is on disk a pass is a full read and a full write of ' +
          'everything, and the merge order becomes the only parameter that matters.',
        example: 'Merging 64 runs: 2-way needs 6 passes, 8-way needs 2, and both do about the same comparisons.'
      },
      {
        term: 'Why merge sort survives when quicksort is faster',
        plain: 'Sequential access, a guaranteed bound, and stability - in that order of importance.',
        formal: 'O(n log n) worst case, stable, and streaming-compatible',
        detail: 'Merge sort loses to a good quicksort in memory on most inputs: more moves, more allocation, ' +
          'worse locality on the write side. It is still what every system uses once the data leaves RAM, ' +
          'because quicksort partitions by seeking to both ends of a range and a merge does not seek at all. ' +
          'The worst-case bound is a secondary reason and stability is a third - but the access pattern is the ' +
          'one that cannot be engineered around, and it is the reason the algorithm is a hundred years of ' +
          'tape sorting and still current.',
        example: 'External merge sort of a billion records with 10 million resident: 100 runs, 2 merge passes, 60 000 block transfers.'
      }
    ],

    quicksort: [
      {
        term: 'Partition, then recurse into both sides',
        plain: 'Put everything below the pivot before it and everything above after it, then repeat.',
        formal: 'T(n) = T(k) + T(n-k-1) + n, which is n log n when k is near n/2 and n^2 when it is not',
        detail: 'The recurrence is the whole analysis, and it says the split is everything. A pivot that lands ' +
          'near the middle halves the problem twice per level and the recursion is log n deep; a pivot that ' +
          'lands at one end removes one element per level and the recursion is n deep. Quicksort is not fast ' +
          'because partitioning is clever - it is fast because partitioning is a single sequential pass with ' +
          'almost no bookkeeping, and the whole difficulty is making sure the split is balanced.',
        example: 'On 2 000 identical elements Lomuto splits 1 999/0 every time: 2 004 997 comparisons and a recursion 2 000 deep.'
      },
      {
        term: 'Lomuto against Hoare',
        plain: 'One forward scan, or two pointers walking inwards - and they behave completely differently on duplicates.',
        formal: 'Lomuto: everything < pivot moves left. Hoare: swap the pairs that are on the wrong side.',
        detail: 'Lomuto is the one people write first because it is a single loop with one index. It does ' +
          'about three times Hoare\'s swaps, and - the part that matters - it puts every element that is not ' +
          'strictly less than the pivot on the right, so an array of equal values splits n-1 to 0. Hoare\'s ' +
          'two pointers *stop* on elements equal to the pivot, which splits equal input down the middle. On ' +
          '2 000 identical elements that is 2 004 997 comparisons against 31 723, from the partition scheme ' +
          'alone.',
        example: 'All-equal input, 2 000 elements: Lomuto recurses 2 000 deep, Hoare 12 deep.'
      },
      {
        term: 'Three-way partitioning: the equal block is finished',
        plain: 'Split into less, equal and greater, and never recurse into the equal part.',
        formal: 'Dijkstra\'s Dutch national flag: one pass, three regions, one invariant',
        detail: 'When duplicates are common - a status column, a category, a rounded score - the equal block ' +
          'is a large fraction of the array, and a two-way partition keeps re-partitioning it. A three-way ' +
          'partition places every element equal to the pivot in one contiguous block and recurses only into ' +
          'the two sides, so an array of one distinct value is sorted by a single linear pass. That is the ' +
          'difference between 676 647 comparisons and 3 389 on the same 2 000-element input, and it costs one ' +
          'extra branch in the partition loop.',
        example: 'Few-unique input, 2 000 elements: three-way does 1 partition and 2 012 comparisons.'
      },
      {
        term: 'Pivot rules, and what each one is defeated by',
        plain: 'First, middle, median-of-three, ninther, random - each fails on a different input.',
        formal: 'a sample of s elements gives a pivot in the middle 1/(s+1) fraction with high probability',
        detail: 'Taking the first element is quadratic on sorted input, which is the most common real input ' +
          'there is. Median-of-three fixes that and is still defeated by an organ-pipe arrangement or a ' +
          'constructed one. The ninther - the median of three medians of three - samples nine points and is ' +
          'what large arrays need, because three points out of a million is not a median of anything. A ' +
          'random pivot is defeated only by guessing the seed, and pays for that with irreproducible runs.',
        example: 'Organ-pipe input, 2 000 elements: Lomuto with median-of-three does 323 989 comparisons; the ninther does 25 224.'
      },
      {
        term: 'The adversary: every deterministic rule has a killer input',
        plain: 'Answer the sort\'s comparisons adversarially and hand back the permutation that defeats it.',
        formal: 'McIlroy\'s anti-quicksort: values are decided lazily, always against the pivot in hand',
        detail: 'The construction is elegant and worth understanding, because it proves the failure is not ' +
          'bad luck. Run the sort against a comparator that has not yet decided the values; whenever it ' +
          'compares two undecided elements, commit whichever one is *not* the current pivot to the next ' +
          'smallest value. Every pivot the algorithm picks turns out to be extreme, and the result is a ' +
          'permutation of 0..n-1 that drives that exact pivot rule quadratic. It defeats the configuration it ' +
          'was built against and nothing else, which is precisely the point.',
        example: 'Built against median-of-three: 2 048 elements cost 1 051 648 comparisons, above n²/4 = 1 048 576.'
      },
      {
        term: 'The quiet quadratic',
        plain: 'A bad pivot does not corrupt anything - it just takes n²/4 comparisons.',
        formal: 'correctness is independent of the pivot; only the cost is not',
        detail: 'This is the failure mode worth internalising, because it does not look like a bug. The sort ' +
          'returns correctly ordered data every time. What changes is that it takes a hundred times longer on ' +
          'one particular input, which arrives as a latency alert on one tenant\'s data rather than as a ' +
          'wrong answer anywhere. Nothing in a test suite of correctness assertions can see it, and nothing in ' +
          'the output distinguishes a well-partitioned run from a catastrophic one.',
        example: 'Every configuration in the demo reports 0 elements out of place, including the ones taking n²/4 comparisons.'
      },
      {
        term: 'Introsort: a depth counter and an escape hatch',
        plain: 'Run quicksort, and if the recursion passes 2·log₂ n, finish that subarray with heapsort.',
        formal: 'O(n log n) worst case, with quicksort\'s average case untouched',
        detail: 'Musser\'s observation is that the worst case does not need a better pivot rule, it needs a ' +
          'detector. Count the recursion depth; a well-behaved quicksort never exceeds about 2·log₂ n, so ' +
          'passing that is evidence the pivots are going badly. Switch that subarray to heapsort - slower on ' +
          'average, O(n log n) always, in place - and the tail disappears while the common case is unchanged. ' +
          'This is why every std::sort is some version of introsort, and why the bound is achieved without ' +
          'giving up determinism.',
        example: 'On an input built against the ninther: depth 344 without a limit, 22 with one, and 1 heapsort escape.'
      },
      {
        term: 'Recurse into the smaller side, loop on the larger',
        plain: 'Tail-recursion elimination bounds the stack at O(log n) even when the recursion is not.',
        formal: 'recursing into the smaller half guarantees the stack depth is at most log2 n',
        detail: 'A naive quicksort on an unlucky input recurses n deep and overflows the stack - which is a ' +
          'crash rather than a slowdown, and a different failure from the quadratic one. The fix costs ' +
          'nothing: after partitioning, recurse into the smaller side and loop on the larger by reassigning ' +
          'the bounds. The smaller side is at most half the range, so the recursion depth is bounded by log₂ n ' +
          'regardless of how unbalanced the splits are. The work is unchanged; only the stack is.',
        example: 'Lomuto on 2 000 identical elements reaches recursion depth 2 000 while its call stack stays logarithmic.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
