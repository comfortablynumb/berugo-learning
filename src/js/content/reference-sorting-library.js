/** Reference entries for the library and non-comparison sorts (M10.4-M10.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'library-sorts': {
      summary: 'Timsort and pdqsort as the two production answers: one exploits existing order through ' +
        'natural runs and a merge stack, the other treats a bad partition as evidence and reacts to it.',
      intuition: 'A library sort is not the fastest sort on random data. It is the sort with no input that ' +
        'embarrasses it, built by measuring the shapes real callers actually pass.',
      formulation: {
        equations: [
          {
            label: 'Timsort on a nearly-sorted input',
            expr: 'cost ~ n + sum over runs of the merge work, not n log n',
            terms: [
              { sym: 'measured', meaning: 'n = 2 000 nearly sorted: 3 099 comparisons, 1.55 per element' },
              { sym: 'the control', meaning: 'bottom-up merge sort on the same array: 15 410 comparisons' },
              { sym: 'random', meaning: '19 399 - within 1% of the 19 200 information-theoretic floor' }
            ]
          },
          {
            label: 'minRunLength',
            expr: 'take the top 6 bits of n and add 1 if any lower bit is set; the result lies in [16, 32]',
            terms: [
              { sym: 'examples', meaning: '10 -> 10, 63 -> 32, 64 -> 16, 65 -> 17, 1000 -> 32, 2048 -> 16, 20000 -> 20' },
              { sym: 'why', meaning: 'n / minRun should be a power of two or just below, so the merges stay balanced' }
            ]
          },
          {
            label: 'The merge-stack invariants',
            expr: 'for the top three runs: A > B + C and B > C',
            terms: [
              { sym: 'the 2015 bug', meaning: 'checking only the top three is not enough; run lengths [120, 80, 25, 20, 30] settle to [120, 80, 45, 30] and 120 <= 80 + 45' },
              { sym: 'the consequence', meaning: 'a stack overrun in Java, not a wrong answer - both rules sort correctly, 0 elements out of place' }
            ]
          },
          {
            label: 'pdqsort reacts to the partition it just made',
            expr: 'an unbalanced partition triggers a pattern break; recursion depth past 2 log2 n falls back to heapsort',
            terms: [
              { sym: 'n = 20 000 sorted', meaning: '40 010 comparisons, depth 1, one partial-insertion win' },
              { sym: 'n = 20 000 random', meaning: '319 511 comparisons, depth 17, 91 pattern breaks, 0 heapsort fallbacks' },
              { sym: 'few unique', meaning: '60 008 comparisons and 3 equal blocks - the equal-elements branch, not the partition' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every run pushed on the stack is at least minRun long, and non-descending',
          why: 'Short runs are extended by a binary insertion sort so the merge count stays near log2(n / minRun).',
          breaks: 'A pathological input degenerates into merging thousands of two-element runs.'
        },
        {
          name: 'The stack invariants hold after every push, checked from the top down',
          why: 'They bound the stack depth and keep merges balanced within a constant factor.',
          breaks: 'The fixed-size stack overruns - the failure is an exception, not a mis-sort.'
        },
        {
          name: 'Timsort is stable; pdqsort is not',
          why: 'A merge that takes from the left on a tie preserves order; a partition cannot.',
          breaks: 'Choosing pdqsort for a multi-key sort silently reorders ties.'
        },
        {
          name: 'pdqsort never recurses deeper than 2 log2 n',
          why: 'The depth budget is what converts a quadratic worst case into an n log n one.',
          breaks: 'A crafted input restores quicksort\'s quadratic behaviour with no diagnostic.'
        }
      ],
      complexity: [
        { operation: 'Timsort', average: 'O(n log n), O(n) on a sorted or reversed input', worst: 'O(n log n), stable, O(n/2) extra space' },
        { operation: 'Timsort galloping', average: 'O(log k) to place a block of k', worst: 'falls back to one-at-a-time after enough failures' },
        { operation: 'pdqsort', average: 'O(n log n), O(n) on sorted or all-equal input', worst: 'O(n log n) via the heapsort fallback, unstable, O(log n) stack' },
        { operation: 'partial insertion sort', average: 'O(n) when the bet wins', worst: 'abandoned after 8 displaced elements - a bounded loss' },
        { operation: 'introsort (the C++ shape)', average: 'O(n log n)', worst: 'O(n log n); the depth limit is the only reason' }
      ],
      failureModes: [
        {
          symptom: 'A sort throws ArrayIndexOutOfBoundsException deep inside the library.',
          cause: 'The merge-stack invariant is checked over too few runs; the stack was sized from the proof.',
          fix: 'Check the top four runs (the OpenJDK fix), or size the stack from the corrected bound.'
        },
        {
          symptom: 'A "faster" sort reorders equal records.',
          cause: 'pdqsort and introsort are unstable by construction.',
          fix: 'Write the tie-break into the comparator, or choose a stable sort and pay for the buffer.'
        },
        {
          symptom: 'Timsort is no faster than a plain merge sort on production data.',
          cause: 'The data has no runs - it is genuinely random, or the key was hashed before sorting.',
          fix: 'Measure the run decomposition first; if the mean run is near 1, there is nothing to exploit.'
        },
        {
          symptom: 'Galloping makes a merge slower.',
          cause: 'The two runs interleave evenly, so every gallop costs a binary search and wins one element.',
          fix: 'Enter galloping only after a run of consecutive wins, and leave it when it stops paying.'
        }
      ],
      inTheWild: [
        { system: 'CPython list.sort and sorted()', how: 'Timsort, written by Tim Peters in 2002; the reference implementation' },
        { system: 'OpenJDK Arrays.sort for objects', how: 'Timsort; the 2015 verification result forced a stack-size fix' },
        { system: 'Rust slice::sort_unstable', how: 'pdqsort, with the pattern-defeating heuristics and a heapsort fallback' },
        { system: 'V8 Array.prototype.sort', how: 'Timsort since 2018, which is what made JavaScript sort stability specifiable' }
      ],
      sources: [
        { title: 'Timsort description (listsort.txt)', where: 'Tim Peters - CPython source, Objects/listsort.txt' },
        { title: 'OpenJDK\'s java.utils.Collection.sort() is broken: the good, the bad and the worst case', where: 'Stijn de Gouw et al. - CAV 2015' },
        { title: 'pattern-defeating quicksort', where: 'Orson Peters - 2021 (arXiv:2106.05123)' },
        { title: 'Engineering a Sort Function', where: 'Jon Bentley and Douglas McIlroy - Software: Practice and Experience, 1993' }
      ]
    },

    'non-comparison-sorts': {
      summary: 'Counting, radix and bucket sort escape the n log n bound by reading the key instead of ' +
        'comparing it - and each buys that with an assumption about the key that has to be paid for.',
      intuition: 'The lower bound is a statement about a machine that can only compare. Look at the bits and ' +
        'the bound does not apply; the cost moves into the key range, the digit width and the passes.',
      formulation: {
        equations: [
          {
            label: 'LSD radix cost',
            expr: 'ceil(b / d) passes over n elements, each pass touching 2^d counters',
            terms: [
              { sym: '4-bit digits', meaning: '16 buckets, 64 bytes, 8 passes over 32-bit keys' },
              { sym: '8-bit digits', meaning: '256 buckets, 1 024 bytes, 4 passes - the usual choice' },
              { sym: '16-bit digits', meaning: '65 536 buckets, 262 144 bytes, 2 passes' },
              { sym: 'comparisons', meaning: '0 at every digit width and on every input shape' }
            ]
          },
          {
            label: 'Counting sort is priced by the range, not by n',
            expr: 'time and space are O(n + k) for a key range k',
            terms: [
              { sym: 'k = 2^8, n = 1 000', meaning: '1 024 bytes, 1 256 operations - beats n log2 n ~ 9 966' },
              { sym: 'k = 2^16', meaning: '262 144 bytes, 66 536 operations - already loses' },
              { sym: 'k = 2^32', meaning: '17 179 869 184 bytes; the table is the whole problem' }
            ]
          },
          {
            label: 'Stability is not a nicety here',
            expr: 'LSD radix is correct only if every digit pass is stable',
            terms: [
              { sym: 'keys 0..19, 2 000 elements', meaning: 'unstable still comes out sorted - only the tie order is wrong' },
              { sym: 'keys 0..10^6', meaning: 'unstable output is NOT sorted; the first pair is already wrong' }
            ]
          },
          {
            label: 'Signed keys',
            expr: 'flip the sign bit, or treat the top digit as offset by 2^(b-1)',
            terms: [
              { sym: 'signed: true', meaning: '[-2147483648, -100, -1, 0, 1, 100, 2147483647]' },
              { sym: 'signed: false', meaning: '[0, 1, 100, 2147483647, -2147483648, -100, -1] - negatives sort last' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every digit pass is stable',
          why: 'LSD radix relies on the previous pass\'s order surviving the current one.',
          breaks: 'Wide key ranges come out unsorted; narrow ones come out sorted with ties reversed.'
        },
        {
          name: 'The counter table covers the whole digit alphabet',
          why: 'A key digit outside the table writes outside the array or silently drops.',
          breaks: 'Out-of-range keys corrupt the output, and the corruption depends on the data.'
        },
        {
          name: 'The prefix sum is exclusive',
          why: 'Bucket starts, not bucket ends, are what the placement loop needs.',
          breaks: 'Every bucket is off by its own size; the output looks shuffled rather than sorted.'
        }
      ],
      complexity: [
        { operation: 'counting sort', average: 'O(n + k) time, O(k) space, stable', worst: 'identical - the range decides everything' },
        { operation: 'LSD radix sort', average: 'O(n · b/d) time, O(n + 2^d) space', worst: 'identical; 0 comparisons at any width' },
        { operation: 'MSD radix sort', average: 'O(n · b/d), early-exits on distinguished prefixes', worst: 'O(n · b/d), needs a recursion stack' },
        { operation: 'bucket sort', average: 'O(n) for a uniform key distribution', worst: 'O(n²) or O(n log n) when every key lands in one bucket' }
      ],
      failureModes: [
        {
          symptom: 'Radix sort works in tests and produces unsorted output in production.',
          cause: 'A non-stable inner sort, and test keys with a range narrow enough to hide it.',
          fix: 'Test with a key range wider than the digit; assert sortedness, not just tie order.'
        },
        {
          symptom: 'The sort allocates gigabytes.',
          cause: 'Counting sort on a 32-bit or string key - the table is 2^k, not n.',
          fix: 'Cost the table before choosing: k must be O(n) for counting sort to be the answer.'
        },
        {
          symptom: 'Negative numbers sort after the positives.',
          cause: 'Two\'s-complement keys read as unsigned in the top digit.',
          fix: 'Flip the sign bit before the passes, or offset the top digit by 2^(b-1).'
        },
        {
          symptom: 'Bucket sort degrades to quadratic.',
          cause: 'The key distribution is skewed, not uniform, so one bucket holds most of the input.',
          fix: 'Sample the keys and pick bucket boundaries from quantiles, or fall back on a large bucket.'
        }
      ],
      inTheWild: [
        { system: 'GPU sorting (CUB, Thrust)', how: 'LSD radix over 4- or 8-bit digits - no data-dependent branches' },
        { system: 'Column stores and query engines', how: 'radix partitioning on the join key before the join itself' },
        { system: 'Suffix array construction (SA-IS)', how: 'induced sorting drives buckets rather than comparisons' },
        { system: 'Packet classification and IP lookup', how: 'counting sort over a small fixed alphabet inside the fast path' }
      ],
      sources: [
        { title: 'The Art of Computer Programming, Volume 3, Section 5.2.5', where: 'Donald Knuth - distribution sorting' },
        { title: 'Introduction to Algorithms, Chapter 8', where: 'Cormen, Leiserson, Rivest, Stein - 4th ed. 2022' },
        { title: 'Radix Sort for Vector Multiprocessors', where: 'Marco Zagha and Guy Blelloch - Supercomputing 1991' },
        { title: 'Engineering Radix Sort', where: 'Peter McIlroy, Keith Bostic and Douglas McIlroy - Computing Systems, 1993' }
      ]
    },

    'selection-and-order': {
      summary: 'Quickselect, median of medians, introselect and top-k: finding the k-th element without ' +
        'paying for the other n-1 positions, and knowing when sorting is still the right answer.',
      intuition: 'Quicksort recurses into both sides; quickselect recurses into one. The geometric series ' +
        'collapses from n log n to about 2n, and the constant is what the section is really about.',
      formulation: {
        equations: [
          {
            label: 'Recursing into one side',
            expr: 'n + n/2 + n/4 + ... = 2n expected comparisons',
            terms: [
              { sym: 'n = 5 000', meaning: 'quickselect 16 221 comparisons = 3.24n (mean of 7 pivot seeds)' },
              { sym: 'n = 20 000', meaning: '59 772 = 2.99n' },
              { sym: 'n = 80 000', meaning: '313 625 = 3.92n - a constant, not a growing factor' }
            ]
          },
          {
            label: 'A single run is one sample of an expectation',
            expr: 'report the mean over several pivot seeds, and say how many',
            terms: [
              { sym: 'one seed at n = 80 000', meaning: 'measured 7.09n - which would look like growth' },
              { sym: 'mean of seven seeds', meaning: '3.92n; the flat-constant claim is about the mean' }
            ]
          },
          {
            label: 'Median of medians buys a guarantee',
            expr: 'the pivot is between the 30th and 70th percentile, so T(n) <= T(n/5) + T(7n/10) + O(n)',
            terms: [
              { sym: 'n = 20 000', meaning: '161 904 comparisons = 8.10n against quickselect\'s 2.99n' },
              { sym: 'the trade', meaning: '2.7x the average cost to remove a worst case that random pivots make improbable' }
            ]
          },
          {
            label: 'Sorting to select',
            expr: 'n log2 n comparisons for a question that needs 2n',
            terms: [
              { sym: 'n = 20 000', meaning: '259 880 = 12.99n' },
              { sym: 'n = 80 000', meaning: '1 199 064 = 14.99n - the factor grows with n, and selection\'s does not' }
            ]
          },
          {
            label: 'Where k sits changes the cost',
            expr: 'the partition that answers k = 0 discards nothing but the pivot side it keeps is small',
            terms: [
              { sym: 'k sweep at n = 20 000', meaning: '0% 2.31n | 25% 2.84n | 50% 2.99n | 100% 1.81n' },
              { sym: 'the median', meaning: 'is the most expensive k, and it is the one people ask for' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'After a partition, the k-th element is on exactly one known side',
          why: 'That is what licenses discarding the other side entirely.',
          breaks: 'Recursing into the wrong side returns a plausible wrong element with no error.'
        },
        {
          name: 'Equal elements are collected into the middle band',
          why: 'A two-way partition on all-equal input makes no progress and goes quadratic.',
          breaks: 'Selection on a low-cardinality column hangs on data that sorts fine.'
        },
        {
          name: 'Introselect switches to the guaranteed algorithm after a bounded number of bad splits',
          why: 'The switch bounds the worst case without paying for it on ordinary input.',
          breaks: 'Adversarial or accidentally-adversarial input restores O(n²).'
        }
      ],
      complexity: [
        { operation: 'quickselect (random pivot)', average: 'O(n), measured about 3n comparisons', worst: 'O(n²) on an adversarial pivot sequence' },
        { operation: 'median of medians', average: 'O(n) with a constant near 8n', worst: 'O(n) - the point of the algorithm' },
        { operation: 'introselect', average: 'O(n), identical to quickselect on ordinary input', worst: 'O(n) via the median-of-medians fallback' },
        { operation: 'top-k with a bounded heap', average: 'O(n log k) time, O(k) space, streaming', worst: 'O(n log k); the input need not be materialised' },
        { operation: 'sort then index', average: 'O(n log n)', worst: 'O(n log n) - but it answers every k at once' }
      ],
      failureModes: [
        {
          symptom: 'Selection is fast in testing and hangs on one customer\'s data.',
          cause: 'Many duplicate keys and a two-way partition.',
          fix: 'Three-way partition, and test with a deliberately low-cardinality column.'
        },
        {
          symptom: 'A p99 computed by selection disagrees with one computed by sorting.',
          cause: 'An off-by-one in the rank convention - nearest-rank against interpolation.',
          fix: 'State the convention, and test both implementations against the same definition.'
        },
        {
          symptom: 'A benchmark shows selection getting relatively slower as n grows.',
          cause: 'One pivot seed per size; a single run is a sample, not the expectation.',
          fix: 'Average over several seeds and report the run count beside the figure.'
        },
        {
          symptom: 'Top-k over a stream runs out of memory.',
          cause: 'Selection needs the whole array; the code buffered the stream to use it.',
          fix: 'Use a bounded heap of size k, which never holds more than k elements.'
        }
      ],
      inTheWild: [
        { system: 'std::nth_element', how: 'introselect - quickselect with a median-of-medians fallback' },
        { system: 'NumPy np.partition / np.percentile', how: 'introselect underneath; percentile is selection, not sorting' },
        { system: 'Query engines computing approximate quantiles', how: 'selection on a sample when the exact rank is not required' },
        { system: 'Top-N dashboards and leaderboards', how: 'a bounded heap over a stream rather than a sort of the whole table' }
      ],
      sources: [
        { title: 'Time Bounds for Selection', where: 'Blum, Floyd, Pratt, Rivest and Tarjan - JCSS, 1973' },
        { title: 'Introspective Sorting and Selection Algorithms', where: 'David Musser - Software: Practice and Experience, 1997' },
        { title: 'The Art of Computer Programming, Volume 3, Section 5.3.3', where: 'Donald Knuth - minimum-comparison selection' },
        { title: 'Introduction to Algorithms, Chapter 9', where: 'Cormen, Leiserson, Rivest, Stein - medians and order statistics' }
      ]
    }
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
