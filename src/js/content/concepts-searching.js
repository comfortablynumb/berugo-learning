/** Concepts for the searching and practice sections (M10.7-M10.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'binary-search': [
      {
        term: 'Write the invariant, and the code follows',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["invariant: the answer lies from low<br/>up to but not including high"] --> B["look at the midpoint"]',
            '    B --> C["discard the half that cannot<br/>contain the answer"]',
            '    C --> D{"is the range now empty?"}',
            '    D -->|no| B',
            '    D -->|yes| E["low is the answer"]',
            '    E --> F["every line of the loop is forced<br/>by the invariant, not chosen"]'
          ].join('\n'),
          caption: 'Write the invariant first and the two branches stop being a guess: each is simply whichever update keeps the invariant true.'
        },
        plain: 'The half-open interval [low, high) always contains the answer.',
        formal: 'low <= answer <= high is maintained by every branch; the loop ends when low = high',
        readAs: 'The answer is always somewhere between the two bounds, and every iteration keeps that true ' +
          'while shrinking the gap. When the bounds meet, the gap holds exactly one thing.',
        detail: 'Bentley found that most published binary searches were wrong, and the cause was not ' +
          'carelessness - it was writing a loop from a mental picture instead of from a stated property. ' +
          'Once the invariant is written down every decision is forced: `high` starts at the length because ' +
          'the interval is half-open, the loop condition is `low < high` because that is what non-empty ' +
          'means, and `mid` is strictly below `high` so the interval always shrinks. There is nothing left to ' +
          'get wrong by feel.',
        example: 'Every step of every trace in the demo reports the invariant holding, including on the empty array.'
      },
      {
        term: 'The two branches are deliberately not symmetric',
        plain: '`high = mid` discards a half-open range; `low = mid + 1` discards a closed one.',
        formal: 'high = mid removes [mid, high); low = mid + 1 removes [low, mid]',
        readAs: 'The two updates discard different halves, and the bracket styles say exactly which: a square ' +
          'bracket includes its endpoint, a round one excludes it. Getting one of them wrong is what ' +
          'makes a binary search loop forever.',
        detail: 'This is where every plus-one argument comes from, and the asymmetry is correct rather than ' +
          'an oversight. When the probe says the answer is at or below `mid`, the range from `mid` upwards is ' +
          'gone and `mid` itself might still be the answer - so `high = mid`. When the probe says the answer ' +
          'is strictly above `mid`, then `mid` is excluded too - so `low = mid + 1`. Both discard the probe, ' +
          'both make progress, and adding a matching adjustment to the other side breaks it.',
        example: 'The `high = mid - 1` mutation discards the answer itself when the probe lands on it.'
      },
      {
        term: 'Lower bound and upper bound, not "find"',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["lower bound —<br/>first index whose value is ≥ the target"] --> C["their difference is how many<br/>times the target occurs"]',
            '    B["upper bound —<br/>first index whose value is > the target"] --> C',
            '    C --> D["a plain find answers neither of those<br/>questions once there are duplicates"]'
          ].join('\n'),
          caption: 'Two boundaries answer counting, insertion and range queries. A search that returns any matching index answers none of them.'
        },
        plain: 'First index >= target, and first index > target - and their difference is the count.',
        formal: 'upperBound(x) - lowerBound(x) is the number of occurrences of x',
        readAs: 'The first position where x could go and the first position after every x, subtracted, give ' +
          'how many copies of x there are. Two searches answer a counting question with no extra ' +
          'structure.',
        detail: 'A plain "does it contain x" search throws away information the same loop already computed. ' +
          'The two bounds answer where x would be inserted at the front or the back of its run of equals, ' +
          'which gives membership, insertion position, occurrence count and range extraction from one ' +
          'primitive. Building `search` on top of `lowerBound` rather than writing a third loop is not tidiness ' +
          'either: a third loop is a third chance to get the interval wrong.',
        example: 'In [1, 3, 3, 3, 5]: lowerBound(3) = 1, upperBound(3) = 4, so there are three of them.'
      },
      {
        term: 'The mutations that no test notices',
        plain: 'Several one-character changes are correct on almost every input a hand-written test would use.',
        formal: 'each mutation is caught by between 1 and 11 of 13 targeted probe cases',
        detail: 'The value of the mutation table is not that the variants are wrong - it is the distribution ' +
          'of how many inputs notice. `high = mid - 1` is caught by exactly one of thirteen deliberately ' +
          'chosen cases, so a test suite that omits "target absent, in the interior" ships it. That is the ' +
          'argument for testing binary search against a linear scan over every length from zero and every ' +
          'target including the boundaries, rather than against a handful of examples.',
        example: 'The correct implementation is caught by 0 of 13; `high = mid - 1` by exactly 1.'
      },
      {
        term: 'The out-of-bounds read that JavaScript hides',
        plain: '`while (low <= high)` with high = length reads array[length] and still returns the right answer.',
        formal: 'undefined compares false against everything, so the branch behaves as if the element were large',
        detail: 'This is the mutation that proves output testing is not enough. The loop reads one element ' +
          'past the end; JavaScript yields `undefined`, every relational comparison against it is false, the ' +
          'search takes the branch it would have taken anyway and returns the correct index. In C that read ' +
          'is whatever happened to be next in memory and in Java it throws immediately. The same source is a ' +
          'latent crash in two languages and completely silent in this one, and only an instrumented harness ' +
          'watching for the read can see it here.',
        example: 'The demo catches it by watching reads past the end - never by a wrong answer.'
      },
      {
        term: 'The midpoint overflow',
        plain: '`(low + high) / 2` overflows in fixed-width arithmetic; `low + (high - low) / 2` does not.',
        formal: 'in 32-bit signed arithmetic, low + high wraps negative once the sum exceeds 2^31 - 1',
        readAs: 'Adding two large indices can overflow past the largest signed 32-bit value and come back ' +
          'negative. Writing low + (high - low) / 2 instead of (low + high) / 2 avoids it — the famous ' +
          'bug that sat in the JDK for nine years.',
        detail: 'This is the bug Bentley\'s own published version carried for two decades and Java\'s ' +
          'binarySearch carried until 2006. JavaScript numbers are exact to 2^53, so the naive form is ' +
          'genuinely safe here - which is why the demo shows the same expression forced through 32 bits ' +
          'rather than pretending. The habit is still worth keeping: the safe form costs nothing, reads no ' +
          'worse, and the code often outlives the language it was written in.',
        example: 'low = 2 000 000 000, high = 2 100 000 000: the safe midpoint is 2 050 000 000 and the 32-bit one is −97 483 648.'
      },
      {
        term: 'Rotated, unimodal and unbounded variants',
        plain: 'The halving survives a rotation, a peak, and not knowing the length.',
        formal: 'rotated: one half is always sorted. exponential: double a bound, then search inside it',
        detail: 'What binary search actually needs is not sortedness but a way to discard half the range with ' +
          'one probe. In a rotated array one of the two halves is still sorted and one comparison identifies ' +
          'which, so the log survives. On an unbounded or streamed sequence, doubling an index until it ' +
          'passes the target costs log i probes for a target at position i and then bounds an ordinary ' +
          'search. Recognising the halving as the essential part is what lets it be reused.',
        example: 'Exponential search finds the element at index 3 with a bound of 4, searching only [2, 5).'
      },
      {
        term: 'Interpolation search and its assumption',
        plain: 'Guess where the target is instead of splitting in half - if the keys are uniform.',
        formal: 'O(log log n) on uniform keys, O(n) when the distribution assumption fails',
        readAs: 'Interpolation search guesses where the key should be rather than taking the midpoint. On ' +
          'evenly spread keys that is extraordinarily fast; on clustered keys it degenerates to a ' +
          'linear scan.',
        detail: 'Interpolation search estimates the position by linear extrapolation between the endpoints, ' +
          'which on uniformly distributed keys lands almost on the answer: measured, one probe over ten ' +
          'thousand uniform values. The estimate is a straight line, so on keys whose gaps grow the guess is ' +
          'systematically wrong and the search degrades toward linear. It is a specialist tool, and the ' +
          'demo reports the probe count on both distributions rather than quoting the good case.',
        example: 'Ten thousand keys: 1 probe when uniform, 13 when the gaps grow.'
      }
    ],

    'searching-the-answer': [
      {
        term: 'The array being searched is the predicate\'s output',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["candidate answers: 1 2 3 4 5 6 7 8"] --> B["run the feasibility check on each"]',
            '    B --> C["no no no yes yes yes yes yes"]',
            '    C --> D["that sequence is the sorted array —<br/>binary-search it for the first yes"]'
          ].join('\n'),
          caption: 'Nothing in the input is sorted. What is sorted is the sequence of yes/no answers the feasibility check produces, and that is what the search actually runs on.'
        },
        plain: 'Nothing is sorted except the trues and falses the feasibility check produces.',
        formal: 'feasible: [lo, hi] -> bool, monotone false-then-true; find the first true',
        readAs: 'Binary search does not need a sorted array — it needs a yes/no test that is false for a ' +
          'while and then true forever after. Find where it flips, and that is your answer.',
        detail: 'This is the reframe that makes the technique visible. There is no sorted array anywhere - ' +
          'what is ordered is the boolean sequence induced over the candidate answers, and that sequence is ' +
          'false, false, ..., false, true, true, ..., true. Once you see that, "the smallest capacity that ' +
          'works" is exactly the same operation as "the first index whose element is at least x", and the ' +
          'same invariant and the same loop apply unchanged.',
        example: 'Ten packages in five days: the predicate is false for capacities 10..14 and true from 15 up.'
      },
      {
        term: 'Monotonicity is the precondition, and it must be checked',
        diagram: {
          definition: [
            'flowchart LR',
            '    A{"does one answer being yes guarantee<br/>the next one is yes too?"} -->|yes| B["no no no yes yes yes —<br/>the search is licensed"]',
            '    A -->|no| C["yes no yes no —<br/>binary search still returns something,<br/>confidently, and it is wrong"]'
          ].join('\n'),
          caption: 'Binary search does not fail loudly on a predicate that is not monotone. It returns an answer, and nothing about that answer says it is meaningless.'
        },
        plain: 'If feasible(x) implies feasible(x+1), the search is licensed. Otherwise it is not.',
        formal: 'a monotone predicate flips exactly once across the range',
        detail: 'This is the step people skip, and skipping it does not produce an error. A binary search ' +
          'over a predicate that flips three times returns one of the boundaries - confidently, with no ' +
          'diagnostic - and which one depends on where the probes happened to land. Checking is usually an ' +
          'argument about the problem rather than code, but the demo does it exhaustively because these ' +
          'ranges are small enough to sweep in a test and too large to sweep in production, which is exactly ' +
          'the situation the technique exists for.',
        example: '"x = 3 or x >= 7" flips three times over [0, 10], and the binary search returns 7 where the truth is 3.'
      },
      {
        term: 'Minimise the maximum',
        plain: 'The classic shape: split a sequence into k parts so the largest part is as small as possible.',
        formal: 'feasible(limit) = greedily packing with cap `limit` uses at most k parts',
        detail: 'Ship capacity, book allocation and painter partitioning are the same problem in different ' +
          'clothes, and they share a structure worth recognising: the objective is a maximum, the feasibility ' +
          'check is a greedy pass, and the greedy pass is obviously correct in a way the original ' +
          'optimisation is not. That is the real gain. You replace an optimisation you would have to think ' +
          'hard about with a linear scan you can verify by reading it, plus a search you have already written.',
        example: 'Packages 1..10 in 5 days: 5 feasibility checks over a range of 46 candidate capacities.'
      },
      {
        term: 'First-true and last-true are different loops',
        plain: 'Maximising needs its own invariant and a midpoint that rounds up.',
        formal: 'last-true: mid = lo + ceil((hi - lo)/2), and lo = mid on success',
        readAs: 'When you want the last position that answers true rather than the first, the midpoint has to ' +
          'round up instead of down — otherwise the loop stops making progress and hangs.',
        detail: 'Writing the maximising search as a minimising search on the negated predicate is the classic ' +
          'off-by-one: it is correct until the entire range is feasible, and then it is one too small. And ' +
          'the midpoint must round *up*: with `lo = mid` and a rounded-down midpoint, an interval of width ' +
          'one gives `mid = lo`, the interval never shrinks and the loop never ends. That is the same trap as ' +
          'the `low = mid` binary-search mutation, reached from the opposite direction.',
        example: 'Aggressive cows on stalls 1, 2, 4, 8, 9 with 3 cows: the answer is 3, found in 3 checks.'
      },
      {
        term: 'The feasibility check is the only thing you write',
        plain: 'A simple linear pass, obviously correct, and the search is boilerplate around it.',
        formal: 'O(log(range)) calls to an O(n) predicate',
        detail: 'The division of labour is what makes the technique pleasant to use and easy to test. The ' +
          'predicate is a greedy loop over the input with no cleverness in it, and it can be checked by ' +
          'reading it or by brute force. The search never changes. So the entire risk sits in one small ' +
          'function that is easy to reason about, rather than being spread through a bespoke optimisation ' +
          'algorithm - and the total cost is log(range) times the predicate, which is usually nothing.',
        example: 'A billion candidate answers is 30 feasibility checks.'
      },
      {
        term: 'Ternary search for a unimodal function',
        plain: 'No monotone predicate, but a single peak - two probes discard a third.',
        formal: 'compare f at two interior points; log base 1.5 rather than log base 2',
        readAs: 'Ternary search on a single-peaked function compares two inner points and discards one third ' +
          'of the range each time, rather than one half. Slower per step, and the only option when ' +
          'there is no yes/no test to binary search on.',
        detail: 'When the thing being searched is a function with one maximum rather than a predicate that ' +
          'flips once, binary search does not apply - knowing f(mid) tells you nothing about which side the ' +
          'peak is on. Two probes do: if f(a) < f(b) the peak cannot be at or below a. Each round discards a ' +
          'third for two evaluations, so it is about 1.7× the probes of a binary search, which is the price ' +
          'of having a weaker structural assumption to exploit.',
        example: 'The peak of −(x−37)² + 500 over [0, 1 000] is found at 37 in 30 probes.'
      },
      {
        term: 'Floating-point termination is by iteration count, not tolerance',
        plain: '`while (high - low > 1e-9)` can spin forever; a fixed 200 rounds cannot.',
        formal: 'once the interval approaches the ULP, the midpoint can equal an endpoint and the width stops shrinking',
        readAs: 'On floating-point values the midpoint eventually rounds to one of the two ends, and the ' +
          'interval stops narrowing. Loop until the width is small enough, or for a fixed count — never ' +
          'until the ends are equal.',
        detail: 'This is the floating-point trap in an otherwise integer technique. As the interval narrows ' +
          'toward the limit of double precision, `(lo + hi) / 2` can round to exactly `lo` or `hi`, the ' +
          'interval stops shrinking, and a loop conditioned on the width never exits. A fixed iteration count ' +
          'is both simpler and strictly better: 200 halvings reduce any starting interval past every ' +
          'representable double, so the answer is as exact as the type allows and the loop is guaranteed to ' +
          'stop.',
        example: '200 rounds on [0, 10] closes the interval to 4.44e-16 - the ULP at that magnitude.'
      },
      {
        term: 'Recognising the shape',
        plain: 'Most "smallest x that works" questions are binary searches in disguise.',
        formal: 'objective is monotone in the parameter, and feasibility is cheap to test',
        detail: 'The two conditions to look for are that the answer is a single number over a bounded range, ' +
          'and that succeeding at one value implies succeeding at the next. Rate limits, buffer sizes, ' +
          'timeouts, thread counts, capacity planning and scheduling deadlines all have that shape. The ' +
          'failure to watch for is a predicate that is *nearly* monotone - a feasibility check with a ' +
          'threshold effect or a rounding artefact - because the search will still return an answer and ' +
          'nothing in the output says it is the wrong one.',
        example: 'Smallest divisor, allocate books, aggressive cows and ship capacity are one search with four stories.'
      }
    ],

    'external-sorting': [
      {
        term: 'The unit of cost changes when the data leaves memory',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["in memory:<br/>count comparisons"] --> B["they are what dominates"]',
            '    C["on disk:<br/>count passes over the data"] --> D["a single pass costs more time than<br/>millions of comparisons"]',
            '    D --> E["so an algorithm doing more comparisons<br/>in fewer passes is the faster one"]'
          ].join('\n'),
          caption: 'Optimising comparisons on data that does not fit in memory means optimising the term that stopped mattering.'
        },
        plain: 'Count passes over the data, not comparisons.',
        formal: 'Aggarwal-Vitter: (N/B) log_{M/B}(N/B) block transfers',
        readAs: 'External sorting costs block reads and writes rather than comparisons: N items in blocks of ' +
          'B, with a memory of M. The log is to base M/B, which is large, so the number of passes is ' +
          'small — usually two.',
        detail: 'Once the array does not fit, the CPU is not what you are spending. The external-memory model ' +
          'counts block transfers between fast and slow storage, and the expression it gives has one lever: ' +
          'the base of the logarithm, which is the merge order. That is why doubling memory does not halve ' +
          'the work - it raises the merge order, and each pass removed is a full read and a full write of ' +
          'everything. A report that quotes comparisons for an external sort is measuring the wrong thing.',
        example: 'A billion records, ten million resident, 100 KB blocks: 100 runs, 2 merge passes, 60 000 block transfers.'
      },
      {
        term: 'Replacement selection makes runs twice the size of memory',
        plain: 'Keep a heap; emit the smallest record still above the last one written, and freeze the rest.',
        formal: 'expected run length 2M on random input - Knuth\'s snowplough argument',
        detail: 'Filling memory, sorting and flushing gives runs of exactly M. Replacement selection keeps a ' +
          'heap of M records and emits the smallest one that can still extend the current run, deferring ' +
          'anything smaller to the next; the effect is runs averaging 2M. The argument is a snowplough going ' +
          'round a circular road while snow falls uniformly: in the steady state it clears twice its own ' +
          'capacity per circuit. It reads and writes each record exactly once, so the extra run length is ' +
          'free.',
        example: '10 000 records with 100 resident: 100 runs by sort-and-flush, 51 runs at mean length 196.1 by replacement selection.'
      },
      {
        term: 'Halving the runs can remove an entire pass',
        plain: 'The pass count is log base k of the run count, so fewer runs is a discrete saving.',
        formal: 'passes = ceil(log_k(runs)); one fewer pass is 2N of I/O',
        readAs: 'Each merge pass folds k runs into one, so the pass count is the log to base k of the run ' +
          'count. Every pass reads and writes the entire dataset, so removing one saves two full sweeps ' +
          'of I/O.',
        detail: 'This is why the 2M result matters rather than being a curiosity. Pass count is a ceiling of a ' +
          'logarithm, so it moves in whole steps: halving the run count sometimes changes nothing and ' +
          'sometimes removes a complete pass over the dataset. Measured on 10 000 records with 100 resident ' +
          'and a 4-way merge, it went from four passes to three - 100 000 record transfers down to 80 000 - ' +
          'for exactly the same reads and writes during run generation.',
        example: 'Sorted input plus replacement selection gives one run and no merge phase at all.'
      },
      {
        term: 'A sorting network is a fixed list of comparators',
        plain: 'No branches, no data dependence - the same comparisons run whatever the input.',
        formal: 'a sequence of compare-exchange pairs (i, j), applied unconditionally',
        detail: 'Every other sort here decides what to do next based on what it has seen. A network does not: ' +
          'the identical 24 comparators run on a sorted array and on a reversed one. That is a bad trade for ' +
          'a CPU and exactly what a GPU, an FPGA or a SIMD lane wants, because there is no branch to ' +
          'mispredict and no dependency to stall on. It also makes the algorithm a static object that can be ' +
          'drawn, analysed and verified as a whole.',
        example: 'Bitonic on 8 wires: 24 comparators, always, in 6 rounds.'
      },
      {
        term: 'Depth is the parallel running time',
        plain: 'Comparators in the same round touch disjoint wires and run simultaneously.',
        formal: 'bitonic depth is log2(n)(log2(n)+1)/2; total comparators are O(n log^2 n)',
        readAs: 'A bitonic network has about half of log₂ n squared stages, and each stage holds n/2 ' +
          'comparators. It does more total work than a comparison sort — and every comparison in a ' +
          'stage runs at once, which is the whole point on a GPU.',
        detail: 'The two numbers that describe a network answer different questions. The comparator count is ' +
          'total work and it is worse than merge sort\'s - 28 160 against about 10 240 at n = 1 024. The ' +
          'depth is the number of dependent steps, and with enough lanes it is the time: 55 rounds at ' +
          'n = 1 024. More work, less time, given hardware to spend - which is the entire reason the shape ' +
          'exists and the reason "how many comparisons" is the wrong figure to quote.',
        example: 'n = 1 024: bitonic 28 160 comparators at depth 55; odd-even 24 063 at the same depth.'
      },
      {
        term: 'The zero-one principle',
        diagram: {
          definition: [
            'flowchart LR',
            '    A{"does the network sort every<br/>input made only of 0s and 1s?"} -->|yes| B["then it sorts every input,<br/>of any values whatsoever"]',
            '    A -->|no| C["a counter-example exists that is<br/>made only of 0s and 1s"]',
            '    B --> D["so checking 2ⁿ binary inputs replaces<br/>checking n! permutations"]'
          ].join('\n'),
          caption: 'It turns an impossible test into a finite one: verifying a 16-wire network takes 65 536 checks instead of twenty trillion permutations.'
        },
        plain: 'A network sorts everything if and only if it sorts every input of zeros and ones.',
        formal: 'if a comparator network sorts all 2^n binary inputs, it sorts all inputs',
        readAs: 'The zero-one principle: to verify a sorting network you only need to test it on inputs of ' +
          'zeros and ones. That turns an infinite check into a finite one, and it is why these networks ' +
          'can be proved correct by brute force.',
        detail: 'This turns verification from an infinite question into a finite one, and it is the only ' +
          'exhaustive correctness argument available anywhere in this milestone. Sixteen wires are settled ' +
          'completely by 65 536 runs - a proof rather than a sample. The reason it holds is that any ' +
          'monotone function applied to the inputs commutes with the comparators, so a counterexample on ' +
          'arbitrary values can be turned into one on zeros and ones by thresholding.',
        example: '65 536 binary inputs verify a 16-wire network completely; all three networks pass with zero failures.'
      },
      {
        term: 'Padding to a power of two is a cliff',
        plain: 'Bitonic sort needs 2^k wires, and 1 025 elements pay for 2 048.',
        formal: 'pad with +infinity to the next power of two, then discard the tail',
        detail: 'The standard fix for a non-power-of-two length is to pad with sentinels, and it is not a ' +
          'rounding - it is a doubling in the worst case. Going from 1 024 to 1 025 elements takes the ' +
          'comparator count from 28 160 to 67 584 and the depth from 55 to 66, for one extra element. That ' +
          'is a real constraint on where networks are usable, and it is the kind of thing an asymptotic ' +
          'description hides completely.',
        example: 'n = 1 025 pads to 2 048: 1 023 sentinels and 2.4× the comparators.'
      },
      {
        term: 'Every comparator matters, and some by a single input',
        plain: 'Deleting one comparator from a correct network can be caught by exactly one of 256 inputs.',
        formal: 'deletion sensitivity: how many zero-one inputs a single missing comparator breaks',
        detail: 'Running the zero-one check against every single-comparator deletion gives a distribution, ' +
          'and the low end is the interesting part: on an 8-wire bitonic network the most forgiving deletion ' +
          'is detected by one input out of 256. A randomised test would need to be lucky, and an exhaustive ' +
          'one cannot miss. That is the concrete argument for exhaustive verification where it is affordable, ' +
          'and networks are the rare case where it is.',
        example: 'Bitonic(8): deletions are caught by between 1 and 225 of the 256 zero-one inputs.'
      }
    ],

    'sorting-in-practice': [
      {
        term: 'The ranking is a function of the workload',
        plain: 'State the shape, the size and the requirements, and the answer follows from measurement.',
        formal: 'no total order on sorts exists; every one wins on some input',
        detail: 'This is the milestone\'s conclusion made operational. Timsort wins on nearly-sorted data and ' +
          'loses to pdqsort on uniform random; three-way quicksort wins on duplicates by a factor of 200 and ' +
          'is unstable; radix sort does no comparisons at all and needs integer keys. A benchmark on one ' +
          'input measures one column and reports it as the table, which is why the chooser takes the workload ' +
          'as input rather than producing a ranking.',
        example: 'On 2 000 elements: Timsort leads on nearly-sorted at 3 099 comparisons and three-way quicksort on few-unique at 3 389.'
      },
      {
        term: 'JavaScript\'s sort is stable, and only since ES2019',
        plain: 'Before that, V8 used an unstable quicksort below a size threshold.',
        formal: 'ECMAScript 2019 requires Array.prototype.sort to be stable',
        detail: 'Code written before 2019 that relied on stability was relying on an accident, and worse, on ' +
          'an accident that depended on array length - V8 used insertion sort for short arrays and an ' +
          'unstable quicksort above a threshold, so the same code was stable in testing and unstable in ' +
          'production. Modern engines ship a Timsort derivative and the guarantee is now in the specification. ' +
          'It is worth knowing which guarantees are specified and which are observed behaviour.',
        example: 'V8 now uses TimSort for Array.prototype.sort; the stability guarantee is normative.'
      },
      {
        term: 'The default comparator sorts numbers as strings',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["sort a numeric array with no comparator"] --> B["every element is converted<br/>to a string first"]',
            '    B --> C["then compared as text,<br/>so 1 comes before 10 comes before 2"]',
            '    C --> D["no error, and the output still<br/>looks like a sorted array"]'
          ].join('\n'),
          caption: 'The specification really does say this. It is wrong for numbers every time, and the plausible-looking output is why it survives review.'
        },
        plain: '`[1, 2, 10].sort()` returns `[1, 10, 2]`.',
        formal: 'the default comparator converts elements to strings and compares UTF-16 code units',
        detail: 'This is still one of the most common bugs in JavaScript, and its persistence is a lesson in ' +
          'itself: it survives review because a sorted-looking array of small numbers looks sorted. `[1, 2, ' +
          '3]` is identical under both orderings, so the test passes; `[5, 40, 300]` comes back as `[300, 40, ' +
          '5]`. Nothing throws, nothing warns, and the failure only appears once the data crosses a digit ' +
          'boundary.',
        example: '`[5, 40, 300].sort()` returns `[300, 40, 5]`.'
      },
      {
        term: 'The comparator runs O(n log n) times',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a lowercase, a parse or a property<br/>lookup inside the comparator"] --> B["multiplied by every one of the<br/>n log n comparisons"]',
            '    B --> C["compute the key once per element<br/>instead — n times, not n log n"]',
            '    C --> D["then sort on the precomputed key"]'
          ].join('\n'),
          caption: 'The comparator is the innermost loop of the sort. Work moved out of it is divided by a log factor; work left in it is multiplied by one.'
        },
        plain: 'Any work inside it - lowercasing, parsing, property lookup - is multiplied by the comparison count.',
        formal: 'the Schwartzian transform moves key computation from O(n log n) to O(n)',
        readAs: 'Compute each element\'s sort key once up front, sort the pairs, then throw the keys away. ' +
          'Without it an expensive key function runs once per comparison rather than once per element.',
        detail: 'A comparator that calls `toLowerCase()`, parses a date or walks a property path does that ' +
          'work once per comparison, which is about 20 000 times for a thousand elements. Decorating each ' +
          'element with its computed key, sorting on the key and undecorating does it n times. The idea is ' +
          'older than the language and worth reaching for whenever the key is more expensive than the ' +
          'comparison - which, for anything involving strings or dates, it usually is.',
        example: 'Sorting 1 000 rows does about 10 000 comparisons and would call an expensive key function that many times.'
      },
      {
        term: 'Locale-aware collation, and its cost',
        plain: '`Intl.Collator` compares by language rules; `<` compares UTF-16 code units.',
        formal: 'construct the collator once, outside the comparator',
        detail: 'Comparing strings with `<` orders by code unit, which puts every accented character after ' +
          '`z` and every uppercase letter before every lowercase one - so `Ángel` sorts after `zebra` and ' +
          '`apple` after `Zebra`. `Intl.Collator` implements the Unicode collation algorithm and gets this ' +
          'right, at a cost worth respecting: construct it once and reuse it, because building a collator ' +
          'inside a comparator builds one per comparison.',
        example: 'With a base-sensitivity collator, `Ángel` sorts next to `ana` rather than after `z`.'
      },
      {
        term: 'Write the tie-break chain, do not rely on stability for it',
        plain: 'One comparator with the full ordering beats three sorts that assume the earlier ones survive.',
        formal: 'compare key1; if equal compare key2; if equal compare key3',
        detail: 'Sorting three times and relying on stability to preserve the earlier passes does work, and ' +
          'it makes the ordering an emergent property of three separate calls rather than a stated one. It ' +
          'also costs three sorts instead of one, breaks silently if any of them is replaced by an unstable ' +
          'sort, and cannot be read off a single function. An explicit chain is faster, self-documenting and ' +
          'robust to the sort changing underneath it.',
        example: 'Team ascending, then points descending, then name by collator - one comparator, one sort.'
      },
      {
        term: 'Pagination needs a total order',
        plain: 'If the sort key has ties, two pages can show the same row or skip one.',
        formal: 'append a unique tie-breaker - the primary key - to make the ordering total',
        detail: 'Sorting by a non-unique column and paginating with limit and offset is a real and common ' +
          'bug: rows that compare equal have no defined relative order, and a database is free to return ' +
          'them differently between the query for page one and the query for page two. The result is a row ' +
          'appearing twice, or never. Stability does not help across separate queries. Appending a unique ' +
          'column to the sort key makes the order total and the pagination reproducible.',
        example: 'Sorting by "points descending" alone leaves rows with equal points free to move between pages.'
      },
      {
        term: 'Almost-right is the dangerous failure',
        plain: 'Every failure mode in this milestone produces plausible output rather than an error.',
        formal: 'unstable merges, unstable radix passes, broken comparators and quiet quadratics all return',
        detail: 'Collecting the failure modes together makes the pattern obvious. The unstable merge returns ' +
          'sorted data with the ties wrong. The unstable radix pass returns data that is almost ordered. The ' +
          'broken comparator returns an array. The quadratic quicksort returns the correct answer slowly. The ' +
          'buggy Timsort collapse returns the correct answer with a broken invariant. Not one of them throws, ' +
          'and that is the single most useful thing to carry out of this milestone: when sorted output looks ' +
          'nearly right, suspect the ordering contract before the algorithm.',
        example: 'Every configuration in the quicksort demo reports 0 elements out of place, including the quadratic ones.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
