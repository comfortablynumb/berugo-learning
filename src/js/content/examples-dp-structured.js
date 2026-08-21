/** Worked examples for the structured dynamic-programming sections (M12.5-M12.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'interval-dp': [
      {
        title: 'The diagonal sweep, and the parenthesisation the cost does not contain',
        goal: 'Fill an interval table in the only order that works, and recover the answer as well as its value.',
        setup: 'A six-matrix chain with seeded dimensions [37, 6, 25, 8, 39, 26, 26], so matrix k is ' +
          'd[k] × d[k+1].',
        steps: [
          {
            do: 'List the cells and the order they must be settled in.',
            why: 'A cell of length L depends only on cells of length below L.',
            work: '15 intervals of length 2 or more: 5 of length 2, then 4, 3, 2, 1',
            result: 'the evaluation order, as data rather than as a convention'
          },
          {
            do: 'Fill them, testing every split point in each interval.',
            why: 'The k loop is what makes the family cubic.',
            work: '35 split tests over 15 intervals',
            result: 'best[0][5] = 18 984 scalar multiplications'
          },
          {
            do: 'Check that against every possible parenthesisation.',
            why: 'A mis-ordered interval DP returns a plausible number.',
            work: 'exhaustive enumeration also gives 18 984',
            result: 'the sweep is correct as well as cheap'
          },
          {
            do: 'Recover the split points to get the actual multiplication order.',
            why: 'The scalar count does not say which order achieved it, and the order is the answer.',
            work: '(M0 ((((M1 M2) M3) M4) M5))',
            result: 'the argmin was stored per cell, not recomputed afterwards'
          }
        ],
        answer: '18 984 scalar multiplications under the parenthesisation (M0 ((((M1 M2) M3) M4) M5)), from ' +
          '15 intervals and 35 split tests, agreeing with exhaustive enumeration. The lower half of the ' +
          'table is never touched, because an interval [i, j] with j < i does not exist — treating those ' +
          'cells as zeros rather than as absent is exactly how a nested i, j loop gets away with returning ' +
          'a number.'
      },
      {
        title: 'A narrowing that must be earned',
        goal: 'Halve the split tests with Knuth\'s optimisation, then break its precondition and watch it refuse.',
        setup: 'Nine access probabilities in [0.01, 0.20] for an optimal binary search tree, and the same ' +
          'nine with one of them negated.',
        steps: [
          {
            do: 'Solve the optimal BST with every split tested.',
            why: 'The baseline the narrowing has to match exactly.',
            work: '156 split tests, cost 2.590000',
            result: 'O(n³) in the split loop'
          },
          {
            do: 'Test the quadrangle inequality against these weights before optimising.',
            why: 'The narrowing is valid only if the cost function satisfies it.',
            work: 'holds, with a tolerance of 1.02 × 10⁻⁹ scaled to the total weight',
            result: 'the precondition is measured on the instance, not assumed'
          },
          {
            do: 'Note why the tolerance is necessary rather than convenient.',
            why: 'Interval weights are differences of prefix sums, so they carry floating-point error.',
            work: 'these nine two-decimal probabilities violate the inequality by 1.11 × 10⁻¹⁶',
            result: 'an exact comparison rejects the textbook instance the optimisation was written for'
          },
          {
            do: 'Run the narrowed search and compare both columns.',
            why: 'The point is the same answer from fewer tests, not merely fewer tests.',
            work: '72 split tests, cost 2.590000 — a 2.2× reduction with the cost unchanged',
            result: 'the optimisation is doing what it claims'
          },
          {
            do: 'Negate one weight and try again.',
            why: 'A negative weight breaks monotonicity on nested intervals.',
            work: 'the inequality fails at (a, b, c, d) = (0, 0, 2, 4); the solver refuses',
            result: 'a witness instead of a fast wrong answer'
          }
        ],
        answer: '156 split tests become 72 for the identical cost of 2.590000 — and only because the ' +
          'quadrangle inequality was tested on the actual weights first. Flip one weight negative and the ' +
          'solver returns the four indices where the inequality breaks rather than an answer. This inverts ' +
          'the first example: there the difficulty was doing the full search in a valid order, and here it ' +
          'is proving you are allowed to do less than the full search at all.'
      }
    ],

    'tree-dp': [
      {
        title: 'Every root answered in two passes',
        goal: 'Compute the sum of distances from all n nodes, and check it against running the problem n times.',
        setup: 'A seeded random tree, solved by one downward pass for subtree sizes and one upward pass for ' +
          'the rerooting, against a breadth-first search from every node.',
        steps: [
          {
            do: 'Compute the answer for one root by an ordinary post-order pass.',
            why: 'The downward pass is a conventional tree DP and is rarely where the bug is.',
            work: 'on 400 nodes, the root\'s total distance is 2 159',
            result: 'subtree sizes and below-totals for every node'
          },
          {
            do: 'Move the root across one edge and derive the change.',
            why: 'Everything inside the child\'s subtree comes one step nearer; everything else goes one further.',
            work: 'answer[child] = answer[parent] + n − 2·size(child)',
            result: 'one line, and it is the entire upward pass'
          },
          {
            do: 'Count the combine operations for the whole thing.',
            why: 'The claim is O(n) total, not O(n) per root.',
            work: '2 000 nodes: 1 999 combines across 2 passes — 1.00 per node',
            result: 'flat in n, and flat in the degree distribution'
          },
          {
            do: 'Compare every answer against a traversal from that node.',
            why: 'A rerooting bug is correct at the root it was computed from and wrong everywhere else.',
            work: 'all 400 nodes compared against 400 separate traversals; 0 disagree',
            result: 'checking one node would have proved nothing'
          }
        ],
        answer: '1 999 combine operations answer for all 2 000 roots, against 2 000 separate traversals. ' +
          'The oracle matters more here than usual: the downward pass is ordinary and usually right, so the ' +
          'root\'s answer comes out correct and gives every confidence while the new part — the upward ' +
          'pass — is wrong for the other n − 1 nodes. Only a comparison at every node sees it.'
      },
      {
        title: 'The shape a random test tree never generates',
        goal: 'Price the prefix/suffix trick honestly: what it costs on ordinary trees and what it saves on a star.',
        setup: 'The same 2 000-node rerooting on four shapes — random, path, star and caterpillar — with ' +
          'the prefix/suffix combine count measured against the cost of recomputing "all but one" by looping.',
        steps: [
          {
            do: 'Measure the rerooting on a random tree and on a path.',
            why: 'These are the shapes a test generator produces.',
            work: 'random: depth 19, max degree 11, 11 994 combines. path: depth 1 999, degree 2, 11 994',
            result: 'flat, as the linearity claim requires'
          },
          {
            do: 'Measure what the naive "all but one" loop would cost on those two.',
            why: 'To see whether the trick is earning anything here.',
            work: 'random 11 958 (ratio 1.0); path 7 994 (ratio 0.7)',
            result: 'on a path the naive loop is CHEAPER — prefix/suffix has a premium'
          },
          {
            do: 'Now measure the star, where one node has degree n − 1.',
            why: 'This is the shape the technique exists for.',
            work: 'rerooting 11 994; naive 3 998 000 — a ratio of 333.3',
            result: 'the loop is quadratic in n and the prefix/suffix version does not notice'
          },
          {
            do: 'Check the answers agree on the star as well as the cost differing.',
            why: 'A cost comparison between two implementations means nothing if they disagree.',
            work: 'all 2 000 of the star\'s rerooted answers match a traversal from every node exactly',
            result: 'same answer, 333× the work avoided'
          }
        ],
        answer: 'Prefix and suffix arrays cost a constant per child that a degree-2 node does not need, so ' +
          'on a path they lose — 11 994 combines against 7 994 — and on a caterpillar they lose too. On a ' +
          'star they win by 333×, because the loop version is quadratic in the degree. That is the honest ' +
          'trade: a small premium on the shapes a random generator produces, in exchange for not being ' +
          'O(n²) on the shape it never will. The star belongs in the test set, not the appendix.'
      }
    ],

    'bitmask-dp': [
      {
        title: 'A factorial becomes an exponential',
        goal: 'Replace (n−1)! tours with 2ⁿ·n states, and check the table against every permutation.',
        setup: 'Twelve cities at seeded coordinates, solved by Held-Karp over (visited set, current city), ' +
          'with a ten-city instance small enough to enumerate exhaustively.',
        steps: [
          {
            do: 'Count what an exhaustive search would examine.',
            why: 'The baseline the state space is replacing.',
            work: '(12 − 1)! = 39 916 800 tours',
            result: 'far beyond enumeration'
          },
          {
            do: 'Count the states instead.',
            why: 'Two routes with the same visited set and endpoint are interchangeable for everything after.',
            work: '2¹² × 12 = 49 152 cells',
            result: 'a factor of 812 fewer, from one observation about the future'
          },
          {
            do: 'Run it and read off the tour.',
            why: 'The table stores predecessors so the tour comes back, not only its length.',
            work: '11 265 states reached, 56 342 transitions, tour length 250.147376',
            result: 'far fewer states are reachable than exist, because the start city is pinned'
          },
          {
            do: 'Check against brute force at a size where that is possible.',
            why: 'A Held-Karp bug returns a plausible tour length.',
            work: 'at 10 cities: Held-Karp 234.512447, every permutation 234.512447',
            result: 'identical to six decimal places'
          }
        ],
        answer: '49 152 cells replace 39 916 800 tours, and at ten cities the table agrees with exhaustive ' +
          'enumeration exactly. The saving comes entirely from noticing that the future depends only on ' +
          'which cities remain and where you are standing — not on the order the visited ones were taken ' +
          'in. Find that sufficient statistic and a factorial becomes an exponential.'
      },
      {
        title: 'The two identities, and the wall neither of them moves',
        goal: 'Measure 3ⁿ against the 4ⁿ people assume, measure n·2ⁿ against 3ⁿ, and then price the memory.',
        setup: 'Submask enumeration counted at several sizes, sum-over-subsets against the submask walk at ' +
          '10 bits, and the Held-Karp table sized in bytes across n.',
        steps: [
          {
            do: 'Count the total submask steps over all masks, at several n.',
            why: 'The loop looks like 2ⁿ inside 2ⁿ, and the natural bound is 4ⁿ.',
            work: '81 at n = 4, 6 561 at n = 8, 531 441 at n = 12 — equal to 3ⁿ every time',
            result: 'exact, not asymptotic: each bit is in neither, in the submask, or in the mask only'
          },
          {
            do: 'Compare that against the bound people reach for.',
            why: 'The gap decides whether submask DP is feasible at all.',
            work: 'at n = 12: 531 441 against 4¹² = 16 777 216 — a factor of 32',
            result: 'the identity is the reason the technique exists'
          },
          {
            do: 'Compute the same sum-over-subsets aggregate by relaxing one bit at a time.',
            why: 'n·2ⁿ instead of 3ⁿ, for an identical table.',
            work: 'at 10 bits: 5 120 transitions against 59 049 submask steps; all 1 024 entries agree',
            result: 'a factor of 11.5, from changing the loop order rather than the algorithm'
          },
          {
            do: 'Size the Held-Karp table in bytes as n grows.',
            why: 'The ceiling in this family is memory, and it is a number.',
            work: '393 KB at n = 12, 168 MB at n = 20, 738 MB at n = 22, 6.7 GB at n = 25',
            result: 'no inner-loop improvement moves any of these'
          }
        ],
        answer: 'Both identities are exact and both are worth an order of magnitude: 3ⁿ rather than 4ⁿ, and ' +
          'n·2ⁿ rather than 3ⁿ. Neither of them moves the wall. The (mask, last) table is 838 860 800 cells ' +
          'and 6.7 GB at n = 25, which is the inversion of the first example — there the state space made ' +
          'an intractable problem tractable, and here it is the state space that makes a small-sounding n ' +
          'impossible. Past that point the answer is a different algorithm, not a faster loop.'
      }
    ],

    'digit-dp': [
      {
        title: 'Counting a range without visiting it',
        goal: 'Count the numbers in a range with a property, and check it against counting them one at a time.',
        setup: 'Numbers in [137, 4 321] with no two equal adjacent digits, counted by walking the bound\'s ' +
          'digits with a tight flag.',
        steps: [
          {
            do: 'Turn the inclusive range into two prefix counts.',
            why: 'The prefix count is the primitive; the range is a subtraction.',
            work: 'count(0, 4 321) − count(0, 136) = 3 270 − 115',
            result: '3 155, with the low − 1 written once rather than at each call site'
          },
          {
            do: 'Count the states the walk actually memoised.',
            why: 'Only the free states are shared; tight states lie on one path each.',
            work: '45 states for both bounds together',
            result: 'against 4 185 values in the range'
          },
          {
            do: 'Check the answer by counting the numbers one at a time.',
            why: 'The tight flag is the only subtle part, and its failures are silent.',
            work: 'a one-by-one count over [137, 4 321] also gives 3 155',
            result: 'the walk and the enumeration agree exactly'
          },
          {
            do: 'Swap the automaton and repeat, changing nothing else.',
            why: 'The property is a DFA, so one walk serves all of them.',
            work: 'strictly increasing 185, digit sum divisible by 3 gives 1 395, contains "13" gives 184 — all matching brute force',
            result: 'four properties, one counting walk'
          }
        ],
        answer: '3 155 numbers, from 45 memoised states rather than 4 185 candidates, and a one-by-one count ' +
          'confirms it. Swapping the automaton changes the answer and nothing else about the code, which is ' +
          'what makes the family worth learning as one technique: the state the property needs is the only ' +
          'thing left to design.'
      },
      {
        title: 'A range too large to visit, and the value it drops',
        goal: 'Show the cost depending on digits rather than on value, then find the off-by-one that ranges cannot see.',
        setup: 'The same property counted to 10³, 10⁶, 10¹² and 10¹⁸, and then the smallest value in the ' +
          'range examined on its own.',
        steps: [
          {
            do: 'Count up to 1 000 and record the state count.',
            why: 'A baseline in both units.',
            work: '820 numbers, 25 states, 4 digits',
            result: 'a range small enough to enumerate as a check'
          },
          {
            do: 'Count up to 10¹² and compare.',
            why: 'The range is a billion times wider.',
            work: '317 733 228 541 numbers, 124 states, 13 digits',
            result: 'the state count roughly quintupled while the range grew by a factor of 10⁹'
          },
          {
            do: 'Push to 10¹⁸.',
            why: 'To confirm the cost tracks the digits rather than the value.',
            work: '168 856 464 709 123 940 numbers, 190 states, 19 digits',
            result: 'fifteen orders of magnitude of range, roughly eight times the states'
          },
          {
            do: 'Now count the number zero on its own, under each property.',
            why: 'The natural termination is "count it if it started and the automaton accepts".',
            work: 'accepted by no-equal-adjacent and by strictly-increasing; rejected by contains-13',
            result: 'zero is a legitimate one-digit number that the natural termination never counts'
          },
          {
            do: 'Work out why every range test still passed.',
            why: 'A bug that survives a whole test suite is worth understanding.',
            work: 'count(0, R) and count(0, L−1) are each one short, so the difference is exactly right',
            result: 'the error cancels in the subtraction — only prefix counts can see it'
          }
        ],
        answer: 'From 10³ to 10¹⁸ the range grows by fifteen orders of magnitude and the state count grows ' +
          'from 25 to 190, which is the whole technique. And the inversion: the number zero is dropped by ' +
          'the natural termination on two of these four properties, every prefix count comes out one short, ' +
          'and every range stays exactly right because the error cancels. A suite of range tests cannot ' +
          'find it; counting one at a time from zero can.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
