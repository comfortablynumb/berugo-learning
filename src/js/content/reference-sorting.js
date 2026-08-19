/** Reference entries for the sorting sections (M10.1-M10.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'sorting-contract': {
      summary: 'Stability, adaptivity, in-place and the comparator contract as four independent promises, ' +
        'with the elementary sorts as the base cases that satisfy different subsets.',
      intuition: 'A sort is not one operation with one cost. Ask what the caller needs before asking which ' +
        'algorithm is fastest, because the ranking changes completely with the input shape.',
      formulation: {
        equations: [
          {
            label: 'The comparison lower bound',
            expr: 'a decision tree with n! leaves has depth >= log2(n!) ~ n log2 n - 1.44n',
            terms: [
              { sym: 'n = 2 000', meaning: 'at least about 19 200 comparisons; Timsort measured 19 399' },
              { sym: 'applies to', meaning: 'any algorithm whose only input information is comparisons' }
            ]
          },
          {
            label: 'Selection sort, exactly',
            expr: 'n(n-1)/2 comparisons and at most n-1 swaps, on every input',
            terms: [
              { sym: 'measured', meaning: '2 000 elements: 1 999 000 comparisons on all seven input shapes' },
              { sym: 'moves', meaning: '3 984 - the fewest of any sort here, by a factor of 250 over bubble' }
            ]
          },
          {
            label: 'Insertion sort is linear in inversions',
            expr: 'O(n + I), where I is the number of out-of-order pairs',
            terms: [
              { sym: 'sorted', meaning: 'I = 0, so 1 999 comparisons and 0 moves at n = 2 000' },
              { sym: 'random', meaning: 'I ~ n²/4, so 993 838 comparisons' }
            ]
          },
          {
            label: 'The comparator contract',
            expr: 'compare(x, x) = 0; sign(c(a,b)) = -sign(c(b,a)); a<b and b<c implies a<c',
            terms: [
              { sym: 'violated', meaning: 'C++ undefined behaviour, Java throws, JavaScript returns a wrong order' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A stable sort never moves an element past an equal one',
          why: 'It is what makes sorting by successive keys compose.',
          breaks: 'Multi-key sorts scramble the earlier passes, and only where there are ties.'
        },
        {
          name: 'The comparator is a strict weak ordering',
          why: 'The algorithm reasons transitively and never re-checks what it inferred.',
          breaks: 'A wrong order is assumed rather than detected; no diagnostic anywhere.'
        },
        {
          name: 'Counters are separate budgets',
          why: 'Comparisons, moves, swaps and allocations are traded against each other by design.',
          breaks: 'A single "operations" figure hides the trade each algorithm exists to make.'
        }
      ],
      complexity: [
        { operation: 'insertion sort', average: 'O(n + I), stable, in place', worst: 'O(n²) - reversed input' },
        { operation: 'selection sort', average: 'O(n²) comparisons, O(n) moves', worst: 'identical - it is not adaptive' },
        { operation: 'bubble sort with early exit', average: 'O(n²)', worst: 'O(n²); O(n) on sorted input' },
        { operation: 'shell sort (Ciura gaps)', average: 'about O(n^1.3) empirically', worst: 'not known for the best gap sequences' },
        { operation: 'any comparison sort', average: '-', worst: 'Omega(n log n) comparisons' }
      ],
      failureModes: [
        {
          symptom: 'A multi-key sort loses the earlier ordering, but only on some data.',
          cause: 'An unstable sort, and a test set with too few ties to expose it.',
          fix: 'Tag elements with their original index in tests; assert tie order explicitly.'
        },
        {
          symptom: 'Sorted output is *almost* right.',
          cause: 'A comparator returning a boolean, or the default string comparator.',
          fix: 'Return a number; check the three axioms over a sample of pairs and triples.'
        },
        {
          symptom: 'A sort that benchmarks well is slow in production.',
          cause: 'The benchmark used uniform random data and production data has structure.',
          fix: 'Measure on the shapes the workload actually produces - sorted, nearly sorted, few-unique.'
        },
        {
          symptom: 'Swapping to a "faster" sort makes things slower.',
          cause: 'The elements are large; the new sort trades moves for comparisons the wrong way.',
          fix: 'Read the move column separately, or sort an array of indices and permute once.'
        }
      ],
      inTheWild: [
        { system: 'std::sort, Array.prototype.sort, sorted()', how: 'all fall back to insertion sort below a small threshold' },
        { system: 'UI tables with multi-column sort', how: 'stability is what makes "sort by name, then by date" work' },
        { system: 'Java Collections.sort', how: 'throws IllegalArgumentException when it detects a broken comparator' },
        { system: 'Embedded and GPU code', how: 'selection-sort-shaped algorithms where a move is far dearer than a compare' }
      ],
      sources: [
        { title: 'The Art of Computer Programming, Volume 3: Sorting and Searching', where: 'Donald Knuth - Addison-Wesley, 2nd ed. 1998' },
        { title: 'Engineering a Sort Function', where: 'Jon Bentley and Douglas McIlroy - Software: Practice and Experience, 1993' },
        { title: 'Best Increments for the Average Case of Shellsort', where: 'Marcin Ciura - FCT, 2001' },
        { title: 'ECMAScript Language Specification, Array.prototype.sort', where: 'ECMA-262, sort stability required since ES2019' }
      ]
    },

    'merge-sort': {
      summary: 'Top-down, bottom-up, natural and in-place merge sort as four schedules for the same merges, ' +
        'plus the k-way merge that external sorting is built on.',
      intuition: 'The merge is the algorithm and everything else is scheduling. It reads both inputs forwards ' +
        'and writes forwards, which is why it survives when the data stops fitting in memory.',
      formulation: {
        equations: [
          {
            label: 'The recurrence',
            expr: 'T(n) = 2T(n/2) + n, so ceil(log2 n) levels of n work each',
            terms: [
              { sym: 'measured', meaning: '2 000 random elements: 19 407 comparisons top-down, 19 420 bottom-up' }
            ]
          },
          {
            label: 'Where the schedules differ',
            expr: 'top-down copies each merged range back; bottom-up alternates the buffer',
            terms: [
              { sym: 'measured', meaning: '43 904 moves against 24 000 - one extra pass per level' },
              { sym: 'levels', meaning: 'ceil(log2 2 000) = 11, and 2 000 x 11 = 22 000' }
            ]
          },
          {
            label: 'Stability',
            expr: 'take from the left run when the heads compare equal',
            terms: [
              { sym: 'broken by', meaning: 'changing < to <= in one comparison; every other figure is unchanged' }
            ]
          },
          {
            label: 'In-place merging',
            expr: 'rotation-based: O(n log n) comparisons, O(n log^2 n) moves, O(1) space',
            terms: [
              { sym: 'measured', meaning: '0 allocations, 102 734 moves and 51 367 swaps against 43 904 moves buffered' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The merge takes from the left run on a tie',
          why: 'The left run holds the element that started earlier.',
          breaks: 'Stability, silently - the output is still correctly ordered.'
        },
        {
          name: 'A detected descending run is strictly descending',
          why: 'It is reversed in place, and reversing equals would invert them.',
          breaks: 'Natural merge sort stops being stable while finding longer runs.'
        },
        {
          name: 'Exactly one buffer is allocated for the whole sort',
          why: 'Allocating per merge is the common performance bug in a hand-written merge sort.',
          breaks: 'O(n log n) allocations instead of one, and heavy collector pressure.'
        }
      ],
      complexity: [
        { operation: 'top-down / bottom-up merge', average: 'O(n log n), stable, O(n) space', worst: 'identical - no bad input' },
        { operation: 'natural merge', average: 'O(n log r) for r runs', worst: 'O(n log n); O(n) on sorted or reversed' },
        { operation: 'in-place merge (rotation)', average: 'O(n log n) comparisons, O(n log² n) moves', worst: 'the same' },
        { operation: 'k-way merge', average: 'n log2(k) comparisons in one pass', worst: 'the same' },
        { operation: 'run detection', average: 'O(n)', worst: 'O(n) - a single scan' }
      ],
      failureModes: [
        {
          symptom: 'Merge sort is much slower than expected.',
          cause: 'A buffer allocated inside the merge instead of once for the sort.',
          fix: 'Allocate one buffer up front; assert the allocation count in a test.'
        },
        {
          symptom: 'Ties come out reordered after a refactor.',
          cause: 'The merge tie comparison flipped from <= to <.',
          fix: 'Test with tagged elements and many duplicates; the sorted keys alone cannot show it.'
        },
        {
          symptom: 'The "in place" version is far slower.',
          cause: 'Rotation-based merging trades allocations for O(n log² n) moves.',
          fix: 'Only choose it when memory is the binding constraint, and measure the move count.'
        },
        {
          symptom: 'Natural merge sort is slower than plain merge sort.',
          cause: 'The input is random, so runs average two and detection is a wasted pass.',
          fix: 'Expected - the variant is a bet on structure. Measure on real data before adopting it.'
        }
      ],
      inTheWild: [
        { system: 'External sorting and database shuffle stages', how: 'the merge is sequential, so it works on data that never becomes resident' },
        { system: 'LSM-tree compaction (RocksDB, Cassandra)', how: 'k-way merge of sorted runs is the whole compaction step' },
        { system: 'Python and Java standard sorts', how: 'Timsort is natural merge sort with managed run lengths' },
        { system: 'Git\'s diff and merge machinery', how: 'sorted-run merging over line sequences' }
      ],
      sources: [
        { title: 'The Art of Computer Programming, Volume 3, Section 5.2.4', where: 'Donald Knuth - merging and merge sorting' },
        { title: 'Practical In-Place Merging', where: 'Bing-Chao Huang and Michael Langston - CACM, 1988' },
        { title: 'Stable Minimum Storage Merging by Symmetric Comparisons', where: 'Pok-Son Kim and Arne Kutzner - ESA, 2004' },
        { title: 'The Input/Output Complexity of Sorting and Related Problems', where: 'Alok Aggarwal and Jeffrey Vitter - CACM, 1988' }
      ]
    },

    quicksort: {
      summary: 'Lomuto against Hoare against three-way partitioning, the pivot rules and the inputs that ' +
        'defeat each, and the depth limit that converts the worst case into a bound.',
      intuition: 'Quicksort is fast because partitioning is one sequential pass, and dangerous because a bad ' +
        'split is not an error - it is the right answer, slowly.',
      formulation: {
        equations: [
          {
            label: 'The recurrence',
            expr: 'T(n) = T(k) + T(n-k-1) + n; n log n when k ~ n/2, n^2 when k ~ 0',
            terms: [
              { sym: 'the split', meaning: 'is the entire analysis - everything else is constant factors' }
            ]
          },
          {
            label: 'All-equal input, by scheme',
            expr: 'Lomuto splits n-1/0; Hoare splits n/2; three-way places the block',
            terms: [
              { sym: 'measured', meaning: '2 000 identical: 2 004 997 / 31 723 / 2 012 comparisons' },
              { sym: 'depth', meaning: '2 000 / 12 / 2' }
            ]
          },
          {
            label: 'Three distinct values',
            expr: 'the realistic version of the same input',
            terms: [
              { sym: 'measured', meaning: '2 000 elements: Lomuto 676 647, Hoare 32 506, three-way 3 389' }
            ]
          },
          {
            label: 'Introsort',
            expr: 'depth limit 2*log2(n), then heapsort on that subarray',
            terms: [
              { sym: 'measured', meaning: 'anti-quicksort at n = 2 048: 1 051 648 comparisons plain, 24 526 with the limit' },
              { sym: 'n²/4', meaning: '1 048 576 - the line the plain run crosses' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every partition strictly shrinks both sides',
          why: 'Otherwise the recursion does not terminate.',
          breaks: 'Hoare with the pivot at to-1 hangs rather than returning a wrong answer.'
        },
        {
          name: 'The three-way equal block is final',
          why: 'It is what makes duplicate-heavy input linear.',
          breaks: 'Recursing into it reintroduces the quadratic on the input the scheme exists for.'
        },
        {
          name: 'Recursion goes into the smaller side',
          why: 'It bounds the call stack at O(log n) even when the recursion depth is not.',
          breaks: 'A stack overflow - a crash, distinct from the quadratic slowdown.'
        }
      ],
      complexity: [
        { operation: 'quicksort, good pivot', average: 'O(n log n), ~1.39 n log2 n comparisons', worst: 'O(n²)' },
        { operation: 'Lomuto partition', average: 'n-1 comparisons, ~n/2 swaps', worst: 'the same; the problem is the split' },
        { operation: 'Hoare partition', average: 'n comparisons, ~n/6 swaps', worst: 'the same' },
        { operation: 'three-way partition', average: 'n comparisons, one pass', worst: 'the same; O(n) total on all-equal input' },
        { operation: 'introsort', average: 'quicksort\'s average, unchanged', worst: 'O(n log n) via heapsort' }
      ],
      failureModes: [
        {
          symptom: 'One customer\'s data is a hundred times slower and the output is correct.',
          cause: 'A pivot rule defeated by that data\'s arrangement - the quiet quadratic.',
          fix: 'Add a depth limit and a heapsort fallback; correctness tests cannot find this.'
        },
        {
          symptom: 'A status or category column sorts catastrophically slowly.',
          cause: 'Lomuto partitioning on data with few distinct values.',
          fix: 'Use three-way partitioning; measured 200x on 2 000 elements over 3 values.'
        },
        {
          symptom: 'Stack overflow on a large array.',
          cause: 'Recursing into the larger side, so the stack depth follows the recursion depth.',
          fix: 'Recurse into the smaller side and loop on the larger.'
        },
        {
          symptom: 'The sort hangs.',
          cause: 'Hoare partitioning with the pivot taken from the last element.',
          fix: 'Swap the chosen pivot to the front before partitioning.'
        }
      ],
      inTheWild: [
        { system: 'std::sort (libstdc++, libc++)', how: 'introsort - quicksort, insertion sort, heapsort fallback' },
        { system: 'Rust\'s sort_unstable', how: 'pdqsort, which is introsort plus pattern defeating' },
        { system: 'Java Arrays.sort for primitives', how: 'dual-pivot quicksort with its own duplicate handling' },
        { system: 'BSD and glibc qsort', how: 'ninther pivot selection, from Bentley and McIlroy' }
      ],
      sources: [
        { title: 'Quicksort', where: 'C. A. R. Hoare - The Computer Journal, 1962' },
        { title: 'Engineering a Sort Function', where: 'Jon Bentley and Douglas McIlroy - SPE, 1993' },
        { title: 'A Killer Adversary for Quicksort', where: 'M. D. McIlroy - Software: Practice and Experience, 1999' },
        { title: 'Introspective Sorting and Selection Algorithms', where: 'David Musser - SPE, 1997' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
