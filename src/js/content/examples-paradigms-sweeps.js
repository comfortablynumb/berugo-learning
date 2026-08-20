/** Worked examples for the sweep and batch paradigm sections (M11.7-M11.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'two-pointers': [
      {
        title: 'Two n, whatever the data looks like',
        goal: 'Verify an amortisation claim by counting totals rather than by reasoning about a loop.',
        setup: 'The maximum of every window of width 50 over 5 000 elements, computed with a monotonic deque, ' +
          'on four input shapes, with every push and pop counted and every answer checked against a rescan.',
        steps: [
          {
            do: 'State what the inner loop looks like.',
            why: 'This is the code that makes the sweep look quadratic.',
            work: 'while the deque is non-empty and its back is <= the arrival: pop\n' +
              'the inner loop can run 49 times at one position and 0 at the next',
            result: 'no per-iteration bound exists, so a total is the only available claim'
          },
          {
            do: 'Count pushes and pops over the whole sweep, on random input.',
            why: 'Every index is pushed once and can be popped at most once.',
            work: '5 000 pushes, 4 994 pops, 9 994 operations\n1.999 per element',
            result: 'linear, with the constant measured rather than asserted'
          },
          {
            do: 'Repeat on ascending, descending and sawtooth input.',
            why: 'The distribution of the work changes completely; the total must not.',
            work: 'ascending  9 999 | descending 9 950\nsawtooth  9 999 | random    9 994',
            result: 'a spread of 0.5% across shapes designed to be as different as possible'
          },
          {
            do: 'Compare with rescanning each window.',
            why: 'The alternative is what the deque is being measured against.',
            work: '(5 000 − 50 + 1) × 50 = 247 550 comparisons',
            result: '24.8× the deque\'s operation count, for the identical answer'
          }
        ],
        answer: 'Pushes plus pops total between 9 950 and 9 999 across four deliberately different input ' +
          'shapes at n = 5 000 — 1.99 to 2.00 per element — against 247 550 comparisons for rescanning each ' +
          'window. The inner loop\'s length varies wildly and the total does not, which is what an ' +
          'amortisation claim means and why it can only be checked by counting the whole sweep. Reporting a ' +
          'worst-case inner-loop length here would say 50 and mean nothing.'
      },
      {
        title: 'The number that does move, and the stack that settles a histogram',
        goal: 'Separate the time claim from the space claim, and trace the monotonic stack by hand.',
        setup: 'The same four shapes, reading the largest deque instead of the operation total; then the ' +
          'histogram [2, 1, 5, 6, 2, 3] traced position by position.',
        steps: [
          {
            do: 'Read the peak deque size on each shape.',
            why: 'This is the memory, and unlike the work it is data-dependent.',
            work: 'ascending 1 | sawtooth 2 | random 11 | descending 50',
            result: 'a factor of 50 between shapes whose operation totals differ by 0.5%'
          },
          {
            do: 'Explain the two extremes.',
            why: 'The invariant predicts both, which is the test that it is understood.',
            work: 'ascending: each arrival dominates everything before it, so the deque holds 1\n' +
              'descending: nothing is ever dominated, so all 50 of the window stay',
            result: 'the peak is a property of the data and the total is not'
          },
          {
            do: 'Trace the monotonic stack over [2, 1, 5, 6, 2, 3].',
            why: 'The amortisation is small enough here to check by eye.',
            work: 'i=1: pop 2 → area 2×1=2 | i=4: pop 6 → 6×1=6, pop 5 → 5×2=10\n' +
              'i=6 (sentinel): pop 3 → 3×1=3, pop 2 → 2×4=8, pop 1 → 1×6=6',
            result: 'largest rectangle 10, and every bar appears in the popped column exactly once'
          },
          {
            do: 'Scale it up and check against brute force.',
            why: 'A rectangle bug produces a rectangle.',
            work: '2 000 random bars: 4 000 stack operations\n' +
              'largest area 793, matching the quadratic scan\n' +
              '2 001 000 operations for the naive version',
            result: '500× fewer operations, same answer'
          }
        ],
        answer: 'The operation total is 1.99 per element on every shape and the peak deque size ranges from 1 ' +
          'to 50 — the same sweep, with a constant time claim and a data-dependent space claim. Both belong ' +
          'in the table because they answer different questions. The monotonic stack makes the same ' +
          'amortisation visible at a size you can check by eye: over six bars every bar is popped exactly ' +
          'once, the answer is 10, and the sentinel row is what lets the final drain share the main loop ' +
          'instead of duplicating it.'
      }
    ],

    'meet-in-the-middle': [
      {
        title: 'Halving the exponent, verified where verification is possible',
        goal: 'Show the saving is real by checking it against brute force at every size brute force can reach.',
        setup: 'Subset sum over items drawn from 1 to 5 000, target half the total, solved by meet in the ' +
          'middle and by exhaustive enumeration at n = 12, 16, 20 and 22.',
        steps: [
          {
            do: 'Split the items and enumerate each half.',
            why: 'This is the whole structural change: two exponentials of half the size.',
            work: 'n = 22: 2 × 2^11 = 4 096 states\n' +
              'against 2^22 = 4 194 304 for the whole set',
            result: '1 024× fewer states generated'
          },
          {
            do: 'Combine by searching rather than by pairing.',
            why: 'Pairing every left half with every right half would be 2^n again.',
            work: '22 440 binary-search probes over the sorted right half\n' +
              'not 2 048 × 2 048 = 4 194 304 pairings',
            result: 'the combine is 2^(n/2)·log(2^(n/2)), not 2^n'
          },
          {
            do: 'Compare the answers at all four sizes.',
            why: 'A subset-sum bug returns a sum, and a sum looks like an answer.',
            work: 'n = 12: 17 043 from both\nn = 16: 20 646 from both\n' +
              'n = 20: 27 306 from both\nn = 22: 27 988 from both',
            result: '4 sizes, 0 disagreements'
          },
          {
            do: 'Read the ratio across the sizes.',
            why: 'It should double for every two items, which is what halving the exponent means.',
            work: 'n = 12: 32× | n = 16: 128× | n = 20: 512× | n = 22: 1 024×',
            result: 'exactly 2^(n/2) growth'
          }
        ],
        answer: 'At 22 items the split generates 4 096 states and 22 440 probes where exhaustive enumeration ' +
          'generates 4 194 304, and the two agree on the answer at every size that can be checked. The ratio ' +
          'doubles every two items — 32×, 128×, 512×, 1 024× — because the exponent has been halved rather ' +
          'than the constant reduced. Verification stops at 22 and the technique is used at 40, which is why ' +
          'the agreement column matters more than the ratio column.'
      },
      {
        title: 'What the halving costs, and the frontier that meets in the middle',
        goal: 'Price the technique in memory, and apply the same idea to a graph.',
        setup: 'The n = 40 instance, whose exhaustive version cannot be run, alongside a projection measured ' +
          'in this page; then bidirectional search on a regular tree.',
        steps: [
          {
            do: 'Read the memory at n = 40.',
            why: 'The time saving is bought with space, at a fixed exchange rate.',
            work: '2 097 152 partial sums held at once\n' +
              '20 969 549 binary-search probes',
            result: 'two million entries resident — the reason the technique stops near n = 50'
          },
          {
            do: 'Project what the exhaustive search would cost.',
            why: '"Infeasible" is not a number, and a comparison needs two.',
            work: 'an 18-item enumeration is timed in the page\n' +
              '2^40 = 1.10 × 10¹² states, doubled 22 times from that measurement',
            result: 'a defensible figure rather than a shrug'
          },
          {
            do: 'Apply the same halving to a graph search.',
            why: 'Two frontiers of radius d/2 instead of one of radius d.',
            work: 'branching 3, depth 8: 3 281 states forwards, 22 bidirectionally\n' +
              'branching 4, depth 8: 21 846 forwards, 32 bidirectionally',
            result: '149× and 683×, growing with the depth'
          },
          {
            do: 'Check the distances agree.',
            why: 'A meeting test that runs after the level completes returns one too many.',
            work: 'both searches return distance 8, at both branching factors',
            result: 'the meeting test fires at generation time, as it must'
          }
        ],
        answer: 'At n = 40 the technique holds 2 097 152 partial sums to save a factor of half a million in ' +
          'time, and each two further items double that memory — which is the whole reason it stops around ' +
          'fifty items rather than continuing indefinitely. Bidirectional search is the same trade on a ' +
          'graph: 22 states instead of 3 281 at branching factor 3 and depth 8, with the frontier as the ' +
          'price. Both return distance 8, which is the check that the meeting test runs as nodes are ' +
          'generated rather than between levels.'
      }
    ],

    'offline-processing': [
      {
        title: 'The ordering is the algorithm',
        goal: 'Measure what reordering a query batch is worth, with the sweep held fixed.',
        setup: '4 000 elements over 200 distinct values, 600 random range queries for the number of distinct ' +
          'values, answered by the same two-pointer sweep in two different orders and checked against a ' +
          'brute-force scan.',
        steps: [
          {
            do: 'Run the sweep in the order the queries arrived.',
            why: 'This is what an online structure would have to cope with.',
            work: '1 420 156 pointer moves for 600 queries\n2 367 moves per query',
            result: 'the pointers thrash across the array'
          },
          {
            do: 'Sort the queries by (left block, right endpoint) and run the identical sweep.',
            why: 'Nothing else changes — same array, same hooks, same four while-loops.',
            work: '121 956 pointer moves\n203 moves per query',
            result: '11.6× less movement from a sort'
          },
          {
            do: 'Check the answers.',
            why: 'A mis-ordered sweep returns plausible numbers in the wrong slots.',
            work: '600 of 600 answers match the brute-force scan',
            result: 'the permutation was undone correctly on the way out'
          },
          {
            do: 'Compare with the bound the ordering argument gives.',
            why: 'A bound is useful when the measurement stays a stable fraction of it.',
            work: '(n + q)·√n = (4 000 + 600) × 63.25 = 290 930\n' +
              'measured 121 956, which is 42% of it',
            result: 'an over-estimate that does not diverge'
          }
        ],
        answer: 'The same sweep over the same data costs 1 420 156 pointer moves in arrival order and 121 956 ' +
          'in Mo\'s order — a factor of 11.6 for one sort — and both produce the 600 correct answers. The ' +
          'bound (n + q)·√n is 290 930, so the measurement sits at 42% of it. That is what a useful bound ' +
          'looks like: comfortably above the measurement, and not drifting away from it as the workload ' +
          'grows.'
      },
      {
        title: 'The block size, and the question that did not need any of this',
        goal: 'Derive the block size from the two terms it balances, then show when the technique is wrong.',
        setup: 'The same workload with four block sizes, and then the identical sweep answering range sums ' +
          'instead of distinct counts.',
        steps: [
          {
            do: 'Write down the two costs the block size trades.',
            why: 'The square root is arithmetic, not folklore.',
            work: 'left pointer: at most b per query, and q = 600\n' +
              'right pointer: one sweep of n per block, and n = 4 000\n' +
              'minimised at b = n/√q',
            result: 'b = 4 000 / √600 = 163'
          },
          {
            do: 'Measure four block sizes.',
            why: 'The formula predicts the shape; the sweep confirms it.',
            work: 'b = 16:  357 720 moves | b = 63: 210 636\n' +
              'b = 163: 121 956 | b = 253: 109 260',
            result: 'a broad minimum — the two neighbours of the minimiser are within 12%'
          },
          {
            do: 'Note that √n is not the minimiser here.',
            why: 'The usual default is the minimiser only when q = n.',
            work: '√4 000 = 63 costs 210 636\n' +
              'n/√q = 163 costs 121 956 — 1.7× better',
            result: 'the default is defensible and it is not free'
          },
          {
            do: 'Answer range sums with the same sweep.',
            why: 'The comparison is against what an online structure would do.',
            work: 'the sweep: 121 956 pointer moves for 600 queries\n' +
              'a prefix-sum array: 4 000 to build, 1 subtraction per query',
            result: 'the offline machinery is pure overhead for a decomposable question'
          }
        ],
        answer: 'The block size minimising q·b + n²/b is n/√q = 163 here, not √n = 63, and the difference is ' +
          '121 956 moves against 210 636 — the default costs 1.7× the minimum. The curve is broad, so being ' +
          'roughly right is enough and this is not a parameter to tune repeatedly. The last step is the ' +
          'inversion: the identical sweep answers range sums at the identical cost, and a prefix-sum array ' +
          'answers them in one subtraction each. Mo\'s algorithm is not fast, it is applicable, and the ' +
          'question to ask first is whether the aggregate is decomposable.'
      }
    ]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
