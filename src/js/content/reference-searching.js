/** Reference entries for the searching and practice sections (M10.7-M10.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'binary-search': {
      summary: 'Binary search written from its invariant, in the lower-bound / upper-bound form, with the ' +
        'mutations that survive ordinary testing measured one by one.',
      intuition: 'Almost every binary search bug is a boundary the author never wrote down. State what is ' +
        'true of [lo, hi) before and after each step and the four decisions stop being a matter of taste.',
      formulation: {
        equations: [
          {
            label: 'The half-open invariant',
            expr: 'the answer is always in [lo, hi); the loop ends when the interval is empty',
            terms: [
              { sym: 'mid', meaning: 'lo + ((hi - lo) >> 1), which is in [lo, hi) whenever lo < hi' },
              { sym: 'progress', meaning: 'each step sets lo = mid + 1 or hi = mid, so the interval strictly shrinks' }
            ]
          },
          {
            label: 'Probe count',
            expr: 'ceil(log2 n) probes for a lower-bound search over n keys',
            terms: [
              { sym: 'n = 10 000', meaning: '13 probes measured, against a ceil(log2 10 000) = 14 bound' },
              { sym: 'branchless', meaning: '15 on the same data - a fixed ceil(log2 n) + 1 with no early exit' }
            ]
          },
          {
            label: 'Interpolation search assumes the distribution',
            expr: 'guess = lo + (target - a[lo]) * (hi - lo) / (a[hi] - a[lo])',
            terms: [
              { sym: 'uniform keys (i * 3)', meaning: '1 probe - it lands on the answer' },
              { sym: 'geometric keys (1.001^i)', meaning: '13 probes, exactly binary search\'s cost; the advantage is a property of the data' }
            ]
          },
          {
            label: 'The midpoint overflow',
            expr: '(lo + hi) / 2 overflows a signed 32-bit int; lo + ((hi - lo) >> 1) does not',
            terms: [
              { sym: 'lo = 2 000 000 000, hi = 2 100 000 000', meaning: 'safe form 2 050 000 000; 32-bit form -97 483 648' },
              { sym: 'where it bit', meaning: 'java.util.Arrays.binarySearch, unnoticed from 1997 to 2006' }
            ]
          },
          {
            label: 'Mutation results over 13 probe checks',
            expr: 'the defect and the number of cases that catch it',
            terms: [
              { sym: 'high-mid-minus-one', meaning: '1 of 13 - a single case stands between the bug and production' },
              { sym: 'inclusive-loop', meaning: '0 wrong answers; it reads past the end, which JavaScript hides' },
              { sym: 'low-mid / rounded-mid', meaning: '6 and 11 non-terminating - the loudest failures are the safest' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The answer is inside [lo, hi) at every step',
          why: 'It is the only reason the discarded half can be discarded.',
          breaks: 'A boundary that excludes the answer returns "not found" for a key that is present.'
        },
        {
          name: 'The interval strictly shrinks',
          why: 'Termination is a consequence of progress, not of the loop condition.',
          breaks: 'mid == lo with lo = mid loops forever - the failure mode of the rounded midpoint.'
        },
        {
          name: 'No index outside [0, n) is ever read',
          why: 'An out-of-range read is undefined behaviour in C and a silent undefined in JavaScript.',
          breaks: 'The inclusive-loop mutation reads a[n] and still returns the right answer in JS.'
        },
        {
          name: 'The comparison is consistent with the array order',
          why: 'Binary search infers the whole array\'s order from log n samples.',
          breaks: 'An unsorted array yields a confident, wrong "not found" with no diagnostic.'
        }
      ],
      complexity: [
        { operation: 'lower bound / upper bound', average: 'O(log n) probes', worst: 'ceil(log2 n) probes exactly' },
        { operation: 'branchless binary search', average: 'ceil(log2 n) + 1 - no early exit', worst: 'identical; predictable, so often faster in wall clock' },
        { operation: 'interpolation search', average: 'O(log log n) on uniform keys', worst: 'O(n) on skewed keys' },
        { operation: 'exponential (galloping) search', average: 'O(log i) for an answer at index i', worst: 'O(log n); the bound search doubles' },
        { operation: 'rotated-array search', average: 'O(log n)', worst: 'O(n) when duplicates make the sorted half ambiguous' }
      ],
      failureModes: [
        {
          symptom: 'The search hangs, but only for some inputs.',
          cause: 'A midpoint that can equal lo combined with lo = mid.',
          fix: 'Round the midpoint down and move lo to mid + 1, or round up in the last-true form.'
        },
        {
          symptom: 'The search is off by one at the boundary only.',
          cause: 'hi = mid - 1 in a half-open loop, or <= where < was meant.',
          fix: 'Test the first, last, absent-below and absent-above cases explicitly - one of them is the case.'
        },
        {
          symptom: 'A crash in production that no test reproduces.',
          cause: 'An inclusive loop reading a[n]; harmless in JavaScript, a segfault in C.',
          fix: 'Bound-check in tests with a Proxy or ASan; the read is invisible to output checks.'
        },
        {
          symptom: 'Search returns "not found" for a key that is definitely present.',
          cause: 'The array is not sorted by the comparator the search uses.',
          fix: 'Assert sortedness in debug builds; a search cannot detect it in log n probes.'
        }
      ],
      inTheWild: [
        { system: 'java.util.Arrays.binarySearch', how: 'the 2006 midpoint-overflow fix is the canonical example' },
        { system: 'std::lower_bound / std::upper_bound', how: 'the boundary-returning form the C++ library standardised' },
        { system: 'Database index descent', how: 'binary search inside every B-tree page, millions of times a second' },
        { system: 'Timsort galloping', how: 'exponential search to find where a block of one run belongs in the other' }
      ],
      sources: [
        { title: 'Programming Pearls, Column 4: Writing Correct Programs', where: 'Jon Bentley - Addison-Wesley, 2nd ed. 2000' },
        { title: 'Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts Are Broken', where: 'Joshua Bloch - Google Research Blog, 2006' },
        { title: 'The Art of Computer Programming, Volume 3, Section 6.2.1', where: 'Donald Knuth - searching an ordered table' },
        { title: 'Array Layouts for Comparison-Based Searching', where: 'Paul-Virak Khuong and Pat Morin - JEA, 2017' }
      ]
    },

    'searching-the-answer': {
      summary: 'Binary search over an answer space rather than an array: a monotone feasibility predicate, ' +
        'the first-true and last-true loops, and ternary search when the shape is a peak instead of a step.',
      intuition: 'The array does not have to exist. If "is x feasible?" is false-then-true along the answer ' +
        'axis, that virtual array is sorted and binary search applies to it unchanged.',
      formulation: {
        equations: [
          {
            label: 'The pattern',
            expr: 'find the first x in [lo, hi] with feasible(x) true, given feasible monotone',
            terms: [
              { sym: 'cost', meaning: 'ceil(log2(range)) evaluations of feasible, not of the answer space' },
              { sym: 'range 10^9', meaning: '30 checks - against a sweep of 10^9' }
            ]
          },
          {
            label: 'Minimise the maximum (ship capacity)',
            expr: 'weights [1..10], 5 days: answer 15',
            terms: [
              { sym: 'the range', meaning: 'lo = max weight = 10, hi = total = 55, a span of 46' },
              { sym: 'checks', meaning: '5 evaluations of the greedy day-packing predicate' },
              { sym: 'monotonicity', meaning: 'the predicate flips exactly once, which is the precondition' }
            ]
          },
          {
            label: 'Maximise the minimum (aggressive cows)',
            expr: 'positions [1, 2, 4, 8, 9], 3 cows: answer 3',
            terms: [
              { sym: 'the loop', meaning: 'a LAST-true search - feasible is true-then-false' },
              { sym: 'checks', meaning: '3 evaluations of the greedy placement predicate' }
            ]
          },
          {
            label: 'Ternary search for a unimodal function',
            expr: 'compare f at two interior points and discard the third that cannot hold the peak',
            terms: [
              { sym: 'integer', meaning: 'peak of -(x-37)^2 + 500 over [0, 1000] found at 37 in 30 probes' },
              { sym: 'real', meaning: '-(x-3.5)^2 + 9 over [0, 10] converges to 3.499999970 after 200 rounds' },
              { sym: 'termination', meaning: 'by iteration count - the interval width reaches 4.44e-16 and stops shrinking' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'feasible is monotone over the searched range',
          why: 'It is the entire precondition; without it the search is meaningless, not merely slow.',
          breaks: 'x === 3 || x >= 7 over [0, 10] flips 3 times: the search returns 7 and the truth is 3.'
        },
        {
          name: 'The answer stays inside the maintained interval',
          why: 'Same invariant as array binary search, over a virtual array.',
          breaks: 'An initial range that excludes the answer returns the range endpoint, confidently.'
        },
        {
          name: 'last-true rounds the midpoint up',
          why: 'lastTrue written as firstTrue on the negated predicate is one too small when the whole range is feasible.',
          breaks: 'An off-by-one that only appears when every candidate is feasible - the easiest case to skip in testing.'
        }
      ],
      complexity: [
        { operation: 'first-true / last-true over an integer range', average: 'O(log(range) · cost(feasible))', worst: 'identical - the range decides' },
        { operation: 'ternary search, integers', average: 'O(log_{3/2}(range)) evaluations', worst: '30 probes over a range of 1 000' },
        { operation: 'ternary search, reals', average: 'fixed iteration count, typically 100-300', worst: 'limited by floating-point resolution, not by tolerance' },
        { operation: 'the feasibility check itself', average: 'usually O(n) greedy', worst: 'it is the dominant term; log(range) is the small factor' }
      ],
      failureModes: [
        {
          symptom: 'The search returns a value that is not the optimum, on some inputs.',
          cause: 'The predicate is not monotone, and the test data happened to be.',
          fix: 'Sweep the predicate over a small range and count the flips; assert exactly one.'
        },
        {
          symptom: 'The answer is one too small whenever everything is feasible.',
          cause: 'lastTrue implemented as firstTrue on the negation with a rounded-down midpoint.',
          fix: 'Give last-true its own invariant and round the midpoint up; test the all-feasible case.'
        },
        {
          symptom: 'A real-valued search loops forever or exits early.',
          cause: 'Termination on hi - lo > epsilon with an epsilon below the floating-point resolution.',
          fix: 'Loop a fixed number of times - 200 rounds cross the whole double range.'
        },
        {
          symptom: 'The search is far slower than the log2 count suggests.',
          cause: 'The feasibility check is O(n log n) or allocates on every call.',
          fix: 'Cost the predicate first; the search multiplies it by 30, so a slow predicate dominates.'
        }
      ],
      inTheWild: [
        { system: 'Capacity planning and rate limiting', how: '"smallest capacity that meets the SLO" is a first-true search' },
        { system: 'Kubernetes and autoscaler sizing loops', how: 'binary search over replica counts against a feasibility simulation' },
        { system: 'Competitive programming', how: 'the standard framing for minimise-the-maximum problems' },
        { system: 'Hyperparameter and threshold tuning', how: 'ternary search over a unimodal loss curve when gradients are unavailable' }
      ],
      sources: [
        { title: 'Competitive Programmer\'s Handbook, Chapter 3', where: 'Antti Laaksonen - binary search over answers' },
        { title: 'Programming Pearls, Column 2', where: 'Jon Bentley - Addison-Wesley, 2nd ed. 2000' },
        { title: 'Numerical Recipes, Section 10.1', where: 'Press, Teukolsky, Vetterling, Flannery - golden section search in one dimension' },
        { title: 'Introduction to Algorithms, Chapter 4', where: 'Cormen, Leiserson, Rivest, Stein - divide and conquer' }
      ]
    },

    'external-sorting': {
      summary: 'Sorting data that does not fit in memory - run generation, replacement selection and k-way ' +
        'merging counted in block transfers - and sorting networks, where the comparator list is fixed.',
      intuition: 'Once the data leaves memory the unit of cost is the block transfer, and the only lever is ' +
        'the number of passes. Longer runs and a wider merge both remove passes; comparisons stop mattering.',
      formulation: {
        equations: [
          {
            label: 'Pass count',
            expr: 'passes = 1 + ceil(log_order(runs)); transfers = 2 · blocks · passes',
            terms: [
              { sym: '10 000 records, memory 100, order 4', meaning: '100 runs, 4 passes, 100 000 transfers' },
              { sym: 'order 2 / 4 / 8 / 16', meaning: '7 / 4 / 3 / 2 passes and 160 000 / 100 000 / 80 000 / 60 000 transfers' }
            ]
          },
          {
            label: 'Replacement selection makes runs twice memory',
            expr: 'expected run length 2M on random input - Knuth\'s snowplough argument',
            terms: [
              { sym: 'measured', meaning: '51 runs of mean 196.1 against 100 runs of exactly 100.0' },
              { sym: 'the effect', meaning: '3 passes instead of 4, and 80 000 transfers instead of 100 000' },
              { sym: 'sorted input', meaning: '1 run and 0 merge passes - the whole sort becomes a copy' }
            ]
          },
          {
            label: 'The I/O model',
            expr: 'cost is counted in blocks of B records moved, not in comparisons',
            terms: [
              { sym: '10^9 records, 10^7 memory, block 10^5', meaning: '10 000 blocks, 100 runs, 2 passes, 60 000 block transfers' },
              { sym: 'the merge order', meaning: '99 - one buffer per input run plus one for the output' }
            ]
          },
          {
            label: 'Sorting network size and depth',
            expr: 'bitonic: n/2 · log2(n)(log2(n)+1)/2 comparators, depth log2(n)(log2(n)+1)/2',
            terms: [
              { sym: 'n = 8', meaning: 'bitonic 24 comparators depth 6 | odd-even 19/6 | insertion 28/13' },
              { sym: 'n = 16', meaning: 'bitonic 80/10 | odd-even 63/10 | insertion 120/29' },
              { sym: 'n = 1 024', meaning: 'bitonic 28 160/55 | odd-even 24 063/55' },
              { sym: 'n = 1 025', meaning: 'pads to 2 048: 67 584 comparators - 1 023 sentinels for one extra element' }
            ]
          },
          {
            label: 'The zero-one principle',
            expr: 'a network sorting all 2^n zero-one inputs sorts every input',
            terms: [
              { sym: 'n = 16', meaning: '65 536 tests instead of 16! ~ 2 x 10^13 permutations' },
              { sym: 'a deleted comparator', meaning: 'in bitonic(8), caught by between 1 and 225 of the 256 inputs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every generated run is sorted, and the runs together hold every input record',
          why: 'The merge assumes both; neither is checked by the merge itself.',
          breaks: 'A record vanishes or appears out of order in the final output, after hours of I/O.'
        },
        {
          name: 'The merge holds one buffer per input run plus one output buffer',
          why: 'Exceeding memory during the merge turns each read into a fault.',
          breaks: 'A merge order chosen from the pass count alone thrashes and runs slower than a narrower one.'
        },
        {
          name: 'A sorting network\'s comparator list is data-independent',
          why: 'It is what makes the network schedulable on SIMD lanes and in hardware.',
          breaks: 'A data-dependent branch removes the only reason to use a network.'
        },
        {
          name: 'A network is verified over all zero-one inputs, not over samples',
          why: 'The zero-one principle makes exhaustive verification affordable up to n = 16 and beyond.',
          breaks: 'A single missing comparator passes random testing and fails on specific patterns.'
        }
      ],
      complexity: [
        { operation: 'run generation, sort and flush', average: 'runs of exactly M records', worst: 'identical - it ignores input order' },
        { operation: 'run generation, replacement selection', average: 'runs of about 2M on random input', worst: 'M on a reverse-sorted input' },
        { operation: 'k-way merge', average: '1 + ceil(log_k(runs)) passes, O(n log k) comparisons', worst: 'dominated by transfers, not comparisons' },
        { operation: 'bitonic sort', average: 'O(n log² n) comparators, depth O(log² n)', worst: 'identical - the network is fixed' },
        { operation: 'odd-even merge sort', average: 'fewer comparators than bitonic at the same depth', worst: 'identical; 24 063 against 28 160 at n = 1 024' }
      ],
      failureModes: [
        {
          symptom: 'The sort takes far longer than the comparison count predicts.',
          cause: 'Cost was modelled in comparisons; the machine is paying for block transfers.',
          fix: 'Count passes and transfers; a pass removed is worth more than any comparison saving.'
        },
        {
          symptom: 'Widening the merge order makes the sort slower.',
          cause: 'The input buffers no longer fit, so every read is a seek.',
          fix: 'Choose the order from available memory divided by the block size, not from the pass count.'
        },
        {
          symptom: 'Replacement selection produces no benefit.',
          cause: 'The input is reverse-sorted, which is its worst case - every record is smaller than the last written.',
          fix: 'Measure the run-length distribution; fall back to sort-and-flush when the mean approaches M.'
        },
        {
          symptom: 'A sorting network is correct on tests and wrong in hardware.',
          cause: 'Random testing over permutations; the failing patterns are specific zero-one vectors.',
          fix: 'Verify over all 2^n zero-one inputs - exhaustive and cheap up to n = 16.'
        }
      ],
      inTheWild: [
        { system: 'Database ORDER BY that spills', how: 'run generation to temp files and a k-way merge, exactly this algorithm' },
        { system: 'MapReduce and Spark shuffle', how: 'sort-and-spill with an external merge of the spilled runs' },
        { system: 'GPU and SIMD sorting kernels', how: 'bitonic networks for the fixed-size blocks inside a larger sort' },
        { system: 'Hardware sorters and FPGA pipelines', how: 'comparator networks laid out physically, where depth is latency' }
      ],
      sources: [
        { title: 'The Art of Computer Programming, Volume 3, Section 5.4', where: 'Donald Knuth - external sorting, replacement selection and networks' },
        { title: 'Sorting Networks and Their Applications', where: 'Kenneth Batcher - AFIPS Spring Joint Computer Conference, 1968' },
        { title: 'The Input/Output Complexity of Sorting and Related Problems', where: 'Alok Aggarwal and Jeffrey Vitter - CACM, 1988' },
        { title: 'External Memory Algorithms and Data Structures', where: 'Jeffrey Vitter - ACM Computing Surveys, 2001' }
      ]
    },

    'sorting-in-practice': {
      summary: 'Choosing a sort from the workload rather than from a table, and the JavaScript-specific traps ' +
        'around the default comparator, stability, collation and pagination.',
      intuition: 'There is no fastest sort. There is a fastest sort for this input shape, this element size ' +
        'and this stability requirement, and the ranking reorders completely when any of the three changes.',
      formulation: {
        equations: [
          {
            label: 'The ranking is a function of the shape',
            expr: 'n = 2 000, comparisons, winner per shape',
            terms: [
              { sym: 'random', meaning: 'Timsort 19 399' },
              { sym: 'sorted', meaning: 'insertion 1 999' },
              { sym: 'nearly sorted', meaning: 'Timsort 3 099' },
              { sym: 'few unique', meaning: 'three-way quicksort 3 389' },
              { sym: 'reversed / organ-pipe', meaning: 'natural merge 2 000 and 4 000' }
            ]
          },
          {
            label: 'The same algorithm across the shapes',
            expr: 'Lomuto median-of-three ranges from 21 033 to 1 003 000 comparisons - a factor of 48',
            terms: [
              { sym: 'selection sort', meaning: '1 999 000 on every shape - the only one that never varies' },
              { sym: 'radix', meaning: '0 comparisons and 4 000-8 000 moves on every shape' }
            ]
          },
          {
            label: 'The default comparator',
            expr: 'Array.prototype.sort with no argument compares string forms',
            terms: [
              { sym: '[1, 2, 10].sort()', meaning: '[1, 10, 2]' },
              { sym: '[5, 40, 300].sort()', meaning: '[300, 40, 5]' },
              { sym: '[1, 2, 3].sort()', meaning: 'unchanged - which is how it reaches production' }
            ]
          },
          {
            label: 'The comparator runs O(n log n) times',
            expr: 'about n log2 n calls, so any per-call allocation is multiplied by it',
            terms: [
              { sym: 'n = 100 000', meaning: 'about 1.7 million comparator calls' },
              { sym: 'localeCompare', meaning: 'orders of magnitude dearer than a numeric subtraction per call' },
              { sym: 'the fix', meaning: 'a Schwartzian transform - compute the key once per element, sort the pairs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The comparator is a strict weak ordering, and it is total on the data',
          why: 'Sorts assume transitivity and never re-derive what they inferred.',
          breaks: 'V8 produces a plausible wrong order; C++ can walk off the array.'
        },
        {
          name: 'A paginated query has a total order, ties included',
          why: 'Two pages are two separate sorts; a tie broken differently duplicates or drops rows.',
          breaks: 'Rows appear twice across pages, or never appear at all, with no error anywhere.'
        },
        {
          name: 'Stability is a property of the sort, not of the data',
          why: 'A test set with few ties cannot distinguish a stable sort from an unstable one.',
          breaks: 'A multi-key sort works until the day the data has ties in the first key.'
        }
      ],
      complexity: [
        { operation: 'Array.prototype.sort (V8)', average: 'O(n log n), stable since ES2019', worst: 'O(n log n); Timsort underneath' },
        { operation: 'comparator calls', average: 'about n log2 n', worst: 'the multiplier on everything the comparator does' },
        { operation: 'Schwartzian transform', average: 'n key computations plus O(n log n) cheap comparisons', worst: 'O(n) extra memory for the keys' },
        { operation: 'localeCompare per comparison', average: 'O(n log n) collation calls', worst: 'use Intl.Collator once and reuse its compare' },
        { operation: 'radix on integer keys', average: 'O(n) with 0 comparisons', worst: 'only applicable when the key is a fixed-width integer' }
      ],
      failureModes: [
        {
          symptom: 'Numbers sort as 1, 10, 2, 200, 3.',
          cause: 'sort() with no comparator, which compares UTF-16 string forms.',
          fix: 'Always pass a comparator: (a, b) => a - b.'
        },
        {
          symptom: 'A sorted list looks right in development and wrong for one locale.',
          cause: 'Code-unit comparison rather than collation - accents and case order differently.',
          fix: 'Build one Intl.Collator and reuse its compare; never call localeCompare per comparison.'
        },
        {
          symptom: 'Paginating a sorted table shows a row twice.',
          cause: 'A non-total sort key, so ties order differently between the two page queries.',
          fix: 'Append a unique tie-break - the primary key - to every ORDER BY that feeds pagination.'
        },
        {
          symptom: 'Sorting is the profile hot spot and the algorithm is already n log n.',
          cause: 'An expensive comparator, or large elements being moved rather than indices.',
          fix: 'Precompute keys once, sort indices, and permute once at the end.'
        }
      ],
      inTheWild: [
        { system: 'V8, SpiderMonkey, JavaScriptCore', how: 'all ship Timsort or a stable merge sort since the ES2019 requirement' },
        { system: 'SQL ORDER BY with LIMIT/OFFSET', how: 'needs a total order or pagination is not reproducible' },
        { system: 'ICU / Intl.Collator', how: 'the collation tables every locale-aware sort is really consulting' },
        { system: 'Rust sort vs sort_unstable', how: 'the standard library makes the stability trade an explicit choice at the call site' }
      ],
      sources: [
        { title: 'ECMAScript Language Specification, Array.prototype.sort', where: 'ECMA-262 - stability required since ES2019' },
        { title: 'Getting things sorted in V8', where: 'Simon Zünd - v8.dev blog, 2018' },
        { title: 'Unicode Technical Standard #10: Unicode Collation Algorithm', where: 'Unicode Consortium' },
        { title: 'The Art of Computer Programming, Volume 3', where: 'Donald Knuth - Addison-Wesley, 2nd ed. 1998' }
      ]
    }
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
