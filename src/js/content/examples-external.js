/** Worked examples for bin packing, external memory and cache-obliviousness (M21.4-M21.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bin-packing': [
      {
        title: 'Five policies, an exact optimum, and the family that pushes first-fit to 1.7',
        goal: 'Score the online and offline heuristics against a real optimum, then find the ' +
          'instance where the online bound is reached.',
        setup: '200 items uniform in [0.05, 0.6] into unit bins, plus 25 instances of twelve ' +
          'items solved exactly, plus the sevenths-thirds-halves family at four sizes.',
        steps: [
          {
            do: 'Compute the LP lower bound on the 200-item workload.',
            why: 'It ignores indivisibility entirely, so it is a floor and never achievable.',
            work: '62.7 of total size in unit bins',
            result: '63 bins, and no packing can use fewer'
          },
          {
            do: 'Run the five policies.',
            why: 'They differ only in which open bin they choose.',
            work: 'next-fit 80, worst-fit 72, first-fit 65, best-fit 65, first-fit-decreasing 64',
            result: 'ratios of 1.2698, 1.1429, 1.0317, 1.0317 and 1.0159'
          },
          {
            do: 'Score first-fit and FFD against the EXACT optimum on small instances.',
            why: 'The lower bound is unreachable, so a bound checked against it always passes.',
            work: 'over 25 instances of twelve items, the worst ratios are 1.2500 and 1.2000',
            result: 'FFD is inside 11/9 = 1.2222; first-fit is outside it, as it should be'
          },
          {
            do: 'Build the tight family: equal counts of sevenths, thirds and halves.',
            why: 'One of each fits — they sum to 0.977 — and every bin holds one half, so the ' +
              'optimum is one bin per group and cannot be beaten.',
            work: 'at 48 groups first-fit uses 80 bins against an optimum of 48',
            result: '1.6667 at every size measured — 6, 12, 24 and 48 groups all give 5/3'
          },
          {
            do: 'Sort the identical items largest first.',
            why: 'Nothing changes except the arrival order.',
            work: 'at 48 groups the sorted version uses 48 bins',
            result: '1.0000 — exactly optimal, on the same items in a different order'
          }
        ],
        answer: 'On a random workload every policy except next-fit is within 3% of the lower ' +
          'bound and the choice barely matters. On the constructed family the same policies are ' +
          '1.6667 and 1.0000, and the difference is entirely the arrival order. The direction of ' +
          'the epsilon is what makes those ratios mean anything: each item is nudged UP by a ' +
          'ten-thousandth, and a seventh, a third and a half still fit together at 0.977. Nudge ' +
          'SIXTHS up instead and one of each sums past the capacity, so the stated optimum is ' +
          'unreachable and every ratio would be measured against a number no packing attains — ' +
          'which is how a tight family quietly stops being tight.'
      },
      {
        title: 'The inverted case: add a second axis and the offline advantage disappears',
        goal: 'Pack the same jobs by one demand and by two, and read what the extra dimension ' +
          'costs.',
        setup: '200 jobs whose CPU and memory demands are anti-correlated — a CPU-heavy job is ' +
          'memory-light — packed into unit-by-unit bins.',
        steps: [
          {
            do: 'Flatten each job to the larger of its two demands and pack in one dimension.',
            why: 'This is the comparison that one-dimensional intuition would make.',
            work: 'ratios of 1.2308, 1.1667, 1.1538, 1.1795 and 1.1154 across the five policies',
            result: 'first-fit-decreasing is clearly best, as the theory says'
          },
          {
            do: 'Pack the same jobs on both axes.',
            why: 'An item now fits only when both axes fit.',
            work: 'ratios of 1.3929, 1.2143, 1.2143, 1.2143 and 1.1964',
            result: 'every policy is worse, and the spread between them has collapsed'
          },
          {
            do: 'Compare the two best rows.',
            why: 'The offline advantage is the thing the extra axis is supposed to destroy.',
            work: 'in one dimension FFD is 1.1154 against worst-fit’s 1.1795; in two it is ' +
              '1.1964 against 1.2143',
            result: 'the gap falls from 6.4 points to 1.8 — sorting has almost stopped helping'
          },
          {
            do: 'Count the bins that are full on one axis and empty on the other.',
            why: 'This is the capacity that will be reported as free and cannot be used.',
            work: '20 of 68 bins under first-fit, at 76.7% CPU and 82.1% memory utilisation',
            result: 'nearly a third of the machines are unusable to anything in the queue'
          }
        ],
        answer: 'Sorting decreasing is the clear winner on one axis and nearly tied on two, ' +
          'because "decreasing" has no meaning for a two-dimensional item — sort by CPU and ' +
          'memory fragments, sort by the sum and both fragment a little. That is the measured ' +
          'reason real cluster schedulers use scoring heuristics with no proved bound. The ' +
          'lopsided-bin count is the number to take away: a cluster at eighty per cent on both ' +
          'axes with a third of its machines full on one of them will report spare capacity and ' +
          'reject work, and adding machines raises the first number without changing the second.'
      }
    ],

    'external-memory': [
      {
        title: 'Match the sorting formula exactly, at four memory and block sizes',
        goal: 'Show that the DAM prediction is arithmetic rather than an asymptotic, by measuring ' +
          'it under an enforced memory budget.',
        setup: '8 192 shuffled records sorted externally at (M, B) of (64, 16), (128, 16), ' +
          '(256, 32) and (1 024, 64).',
        steps: [
          {
            do: 'Run the smallest configuration and read the run and pass counts.',
            why: 'The formula is built from them, so they have to be right first.',
            work: 'M = 64 and B = 16 gives 128 initial runs and a fan-out of 3, so 5 merge passes',
            result: '2·(8192/16)·(1 + 5) = 6 144 predicted transfers'
          },
          {
            do: 'Compare against the measurement.',
            why: 'A pass reads every block once and writes every block once; nothing is estimated.',
            work: '6 144 measured against 6 144 predicted',
            result: 'a ratio of 1.0000'
          },
          {
            do: 'Repeat at the other three settings.',
            why: 'One match could be a coincidence of the arithmetic.',
            work: '4 096, 1 536 and 512 measured against 4 096, 1 536 and 512',
            result: '1.0000 in every row, and the output is sorted in every row'
          },
          {
            do: 'Read the peak-held column.',
            why: 'An external algorithm that quietly buffers everything reports an impossible count.',
            work: '64 of 64, 128 of 128, 256 of 256 and 1 024 of 1 024',
            result: 'the budget is enforced rather than assumed — exceeding it throws'
          },
          {
            do: 'Read the fan-out against the pass count.',
            why: 'This is where more memory actually helps.',
            work: 'fan-outs of 3, 7, 7 and 15 give 5, 3, 2 and 1 merge passes',
            result: 'more memory does not make passes cheaper; it makes there be fewer of them'
          }
        ],
        answer: 'The measurement matches the closed form to four decimal places at every setting, ' +
          'which is what a correctly charged simulator produces and means any future ' +
          'disagreement is a bug rather than noise. The fan-out column carries the design lesson: ' +
          'the sorting bound is a logarithm base M/B, so doubling memory changes the BASE and ' +
          'therefore the pass count in discrete jumps. That is why a query planner’s behaviour ' +
          'changes discontinuously when work_mem crosses a threshold, rather than improving ' +
          'smoothly.'
      },
      {
        title: 'The inverted case: the algorithm that is optimal in the RAM model and worst here',
        goal: 'Compare a nested-loop join against a sort-merge over four sizes and read where the ' +
          'cost goes.',
        setup: 'Equal-sized tables of 2 000 to 128 000 rows at M = 8 192 records and B = 64, so ' +
          'the sorts take one or two passes.',
        steps: [
          {
            do: 'Cost the nested loop.',
            why: 'It is one index probe per outer row, which is the RAM model’s answer.',
            work: 'every one of the 128 000 probes is a random block, so the transfer count IS the row count',
            result: '2 000, 8 000, 32 000 and 128 000 transfers'
          },
          {
            do: 'Cost the sort-merge.',
            why: 'Both of its parts are scans, so it grows in blocks rather than rows.',
            work: '192, 750, 5 000 and 20 000 transfers',
            result: 'a ratio of 10.42, 10.67, 6.40 and 6.40'
          },
          {
            do: 'Split the sort-merge into its parts.',
            why: 'The planner’s real decision is about the dominant one.',
            work: 'at 128 000 rows: 16 000 transfers of sorting and 4 000 of walking',
            result: 'the sorting is 80% of the cost'
          },
          {
            do: 'Read the general bound table to see the factor.',
            why: 'The two costs differ by exactly the block size.',
            work: 'one transfer per record over one per block is 64× in every row',
            result: 'B, exactly — and B is 512 or 4 096 on real storage'
          }
        ],
        answer: 'The nested loop is asymptotically optimal in the RAM model and loses by six to ' +
          'ten times here, because a model that charges the same for every access cannot see the ' +
          'difference between sequential and random. The split of the sort-merge cost is the ' +
          'actionable part: sorting dominates, so anything that makes a side already sorted — an ' +
          'index, a clustered table, a previous operator — removes most of the cost rather than a ' +
          'constant factor of it. That is what a plan is choosing between, and it is why plans ' +
          'change when an index appears.'
      }
    ],

    'cache-oblivious': [
      {
        title: 'Retune the reference at every cache size, and watch which column moves',
        goal: 'Test the cache-oblivious claim properly by giving the tuned implementation its ' +
          'best tile at each cache size separately.',
        setup: 'A 64 × 64 matrix product against caches of 2, 4, 16 and 64 kilobytes, with tiles ' +
          'of 4, 8, 16 and 32 tried at each, and a recursive version with an 8 × 8 base case.',
        steps: [
          {
            do: 'Find the best tile at each cache size.',
            why: 'A tile chosen once and used everywhere is a rigged comparison.',
            work: 'the winner is tile 8 at 2KB, 16 at 4KB, 32 at 16KB and 4 at 64KB',
            result: 'the tuned parameter changes at all four sizes'
          },
          {
            do: 'Read the misses at those winning tiles.',
            why: 'This is the best a cache-aware implementation could do, given a measurement.',
            work: '8 704, 6 144, 3 072 and 1 536 misses',
            result: 'the reference to beat'
          },
          {
            do: 'Run the recursive version, which is never told anything.',
            why: 'One implementation against four separately tuned ones.',
            work: '10 240, 8 192, 4 096 and 2 048 misses',
            result: 'penalties of 1.176, 1.333, 1.333 and 1.333'
          },
          {
            do: 'Run the unblocked triple loop for scale.',
            why: 'It is what happens when nobody blocks at all.',
            work: '295 424 misses at 2KB and 4KB, 33 792 at 16KB, 1 536 at 64KB',
            result: 'penalties of 33.94, 48.08, 11.00 and 1.00'
          },
          {
            do: 'Read the wrong-tile penalties across a row.',
            why: 'It says what a stale tuning parameter costs.',
            work: 'at a 2KB cache the four tiles measure 25 088, 8 704, 36 864 and 264 192',
            result: 'the wrong tile is 30× worse than the right one on the same cache'
          }
        ],
        answer: 'One implementation with no parameter stays within a third of four separately ' +
          'tuned ones, and the tuning it is being compared against changes at every point. The ' +
          'last row is what makes that worth having: the same tile is best at one cache size and ' +
          '30 times worse at another, and nothing in the code says which machine it was measured ' +
          'on. The last cache size is the other honest note — once everything fits, the unblocked ' +
          'loop is as good as anything, so blocking a computation that was never going to miss ' +
          'is pure overhead.'
      },
      {
        title: 'The inverted case: the same tree, the same comparisons, half the misses',
        goal: 'Isolate layout as the only variable by measuring three arrangements of one tree ' +
          'under one search.',
        setup: 'Complete binary trees of height 10 to 18 searched 2 000 times against a ' +
          '4-kilobyte cache, in level order, in sorted-array order and in van Emde Boas order.',
        steps: [
          {
            do: 'Confirm the search is identical in all three.',
            why: 'If the algorithms differ, the miss column is not about layout.',
            work: 'comparisons per search are 10.0, 12.0, 14.0, 16.0 and 18.0 — the tree height, ' +
              'in every layout',
            result: 'the same decisions, the same work, three arrangements'
          },
          {
            do: 'Measure at height 10, where the tree is 1 023 nodes.',
            why: 'It fits in the cache, so layout should not matter.',
            work: 'level order 1.97, sorted array 2.02, van Emde Boas 2.36',
            result: 'vEB is slightly WORSE — with nothing to gain, its scattered bottom subtrees cost'
          },
          {
            do: 'Measure at height 18, where the tree is 262 143 nodes.',
            why: 'Now the tree is far larger than the cache.',
            work: 'level order 11.95, sorted array 12.00, van Emde Boas 6.65',
            result: 'a saving of 1.80×, on identical comparison counts'
          },
          {
            do: 'Compare the vEB column against log_B n.',
            why: 'The claim is that it reaches the B-tree bound without knowing B.',
            work: 'log₈(262 143) = 6.00 against a measured 6.65',
            result: 'close, and the gap is the constant the asymptotic drops'
          }
        ],
        answer: 'The comparison column is identical in every row and the miss column differs by ' +
          'nearly a factor of two, so everything in it is layout. The height-10 row is the honest ' +
          'one: when the whole tree is resident the vEB order is slightly worse, because its ' +
          'bottom subtrees are scattered and there is nothing to gain from the arrangement. That ' +
          'is worth knowing before applying the technique — the layout is a win when the ' +
          'structure exceeds the cache and a small loss when it does not, which is exactly what ' +
          'the theory says and is not what a benchmark on a small tree would report.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
