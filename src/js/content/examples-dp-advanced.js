/** Worked examples for the advanced dynamic-programming sections (M12.9-M12.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'dp-optimisations': [
      {
        title: 'A quadratic transition becomes a pointer walk',
        goal: 'Rewrite a squared cost as a minimum over lines, and measure what the lower envelope removes.',
        setup: '400 seeded values split into groups, paying (sum of the group)² plus a penalty of 50 per ' +
          'group, solved by the quadratic reference and by the convex hull trick.',
        steps: [
          {
            do: 'Run the reference, which tries every earlier split for every position.',
            why: 'This is the baseline, and it is the only thing that makes the optimised answer checkable.',
            work: '80 200 transitions, value 80 131, 362 groups',
            result: 'exactly n(n+1)/2 transitions, as the loop shape predicts'
          },
          {
            do: 'Expand the square and read off the line.',
            why: 'The rewriting is the technique; everything else is bookkeeping.',
            work: 'dp[j] = P[j]² + 50 + min over i of ((−2P[i])·P[j] + dp[i] + P[i]²)',
            result: 'each earlier state is a line with slope −2P[i], queried at x = P[j]'
          },
          {
            do: 'Check the two preconditions on this instance before running the hull.',
            why: 'Slopes must fall and queries must rise, which needs non-decreasing prefix sums.',
            work: 'all 400 values are positive, so the prefix sums never fall',
            result: 'the narrowing is licensed on this data'
          },
          {
            do: 'Run the hull and compare both columns.',
            why: 'The point is the same value from fewer evaluations.',
            work: '783 transitions and 385 lines held at peak, value 80 131 — a factor of 102',
            result: 'identical answer, two orders of magnitude fewer candidates'
          }
        ],
        answer: '80 200 transitions become 783 for the identical value of 80 131. The hull is not computing ' +
          'faster — it is looking at fewer candidates, because a line that is above another everywhere can ' +
          'never be the minimum and is discarded the moment that is known. The reference implementation is ' +
          'the only reason the 80 131 can be trusted, which is why it is a test rather than dead code.'
      },
      {
        title: 'The same technique on data that does not cooperate',
        goal: 'Break each precondition deliberately and see what each optimisation does about it.',
        setup: 'The same grouping cost over 60 values drawn from [−10, 10], so the prefix sums fall; plus ' +
          '"exactly four groups" solved three ways on a 120-element prefix.',
        steps: [
          {
            do: 'Test the hull\'s precondition on the negative-valued instance.',
            why: 'Negative values make the prefix sums fall, which reverses both monotonicity claims.',
            work: 'the prefix sums drop from 9 to 6 at index 2',
            result: 'a witness with an index, not a boolean'
          },
          {
            do: 'Ask the guarded solver for an answer anyway.',
            why: 'The honest interface refuses rather than returning a plausible number.',
            work: 'refused; the quadratic reference gives 213 on the same instance',
            result: 'a witness instead of a fast wrong answer'
          },
          {
            do: 'Force the guard off and see what actually happens.',
            why: '"It would be silently wrong" is a claim worth checking rather than asserting.',
            work: 'the hull itself throws at the 2nd query: queries must not decrease',
            result: 'here the structure catches it — which is luck, not a guarantee'
          },
          {
            do: 'Now solve "exactly four groups" three ways on cooperative data.',
            why: 'A constraint on the group count normally adds a whole dimension.',
            work: 'two-dimensional DP 29 040 transitions; divide-and-conquer 3 262; Lagrangian search lands at λ ≈ 90 646',
            result: 'all three give 453 673'
          },
          {
            do: 'Note what the Lagrangian search does when it cannot land on k.',
            why: 'Its honest failure is jumping over the target rather than missing it.',
            work: 'it reports that the count jumps over k rather than returning the answer for k − 1',
            result: 'an answer for the wrong k is not an approximation, it is a different question'
          }
        ],
        answer: 'Every one of these is a narrowing, so every one of them has a proof obligation. On the ' +
          'negative instance the hull\'s preconditions fail at index 2 and the guarded solver refuses; ' +
          'forced, this particular structure happens to throw, which is luck rather than a guarantee. On ' +
          'cooperative data all three routes to "exactly four groups" agree at 453 673 from 29 040, 3 262 ' +
          'and a penalty search respectively. This inverts the first example: there the optimisation was ' +
          'worth 102×, and here the same optimisation is worth nothing at all and must say so.'
      }
    ],

    'game-dp': [
      {
        title: 'The same value, and a factor of 76 in what it costs',
        goal: 'Measure alpha-beta against minimax, and then measure move ordering against alpha-beta.',
        setup: 'Tic-tac-toe from the empty board, searched exhaustively and then with alpha-beta under four ' +
          'different move orderings.',
        steps: [
          {
            do: 'Search the whole tree with plain minimax.',
            why: 'The baseline, and the value every other run must reproduce.',
            work: '549 946 nodes, 255 168 terminal positions, value 0',
            result: 'tic-tac-toe is a draw with correct play'
          },
          {
            do: 'Add alpha-beta with no ordering heuristic at all.',
            why: 'The cutoff alone, before any effort is spent on move order.',
            work: '18 297 nodes, 6 930 branches pruned, value 0',
            result: 'a factor of 30 from the window alone'
          },
          {
            do: 'Order the moves centre, then corners, then edges.',
            why: 'Good moves first means an early cutoff is available at every node.',
            work: '7 275 nodes, 3 668 pruned, value 0',
            result: 'a factor of 76 against minimax, from one comparator'
          },
          {
            do: 'Reverse that ranking — edges, then corners, then centre.',
            why: 'To measure how much of the saving belongs to the ordering rather than to alpha-beta.',
            work: '42 094 nodes, 13 146 pruned, value 0',
            result: 'a 5.8× spread between two orderings of the same algorithm'
          }
        ],
        answer: 'All four runs return 0, which is the check; the node counts run from 7 275 to 42 094, which ' +
          'is the result. Alpha-beta is worth 30× on its own and 76× with a comparator that takes one line. ' +
          'That is why real engines spend their effort on move ordering rather than on the search — and it ' +
          'is why the value column has to be there, because an alpha-beta bug prunes a branch it should ' +
          'have searched and returns a plausible number.'
      },
      {
        title: 'Two orderings that are identical, and a product that is never built',
        goal: 'Show that the obvious way to test an ordering measures nothing, then replace a product state ' +
          'space with a XOR.',
        setup: 'The same board with the move list simply reversed, and then three heaps of seven under two ' +
          'different impartial games.',
        steps: [
          {
            do: 'Reverse the move list and re-run alpha-beta.',
            why: '"Try it backwards" is how people usually test an ordering heuristic.',
            work: 'board order 18 297 nodes and 6 930 pruned; reversed 18 297 and 6 930',
            result: 'identical to the last node — the board is symmetric, so reversing measures nothing'
          },
          {
            do: 'Compute the Grundy numbers for one heap.',
            why: 'A position is losing exactly when its Grundy value is zero.',
            work: 'Nim gives 0, 1, 2, 3, … — the heap size. {1, 3, 4} gives 0, 1, 0, 1, 2, 3, 2 and repeats with period 7',
            result: 'one table per component, computed independently'
          },
          {
            do: 'XOR the three components and read off the verdict.',
            why: 'A sum of impartial games is equivalent to one Nim heap of that size.',
            work: 'three heaps of 7: Nim gives 7 ⊕ 7 ⊕ 7 = 7; {1, 3, 4} gives 0 ⊕ 0 ⊕ 0 = 0',
            result: 'first player wins the Nim sum and loses the subtraction sum'
          },
          {
            do: 'Build the joint state space and check.',
            why: 'The theorem is exact, so the two must agree rather than approximately agree.',
            work: 'the joint search examines 65 states for Nim and 393 for {1, 3, 4}, and agrees with both verdicts',
            result: 'the product state space was never needed'
          }
        ],
        answer: 'Reversing the move list changes nothing at all — 18 297 nodes either way — because the ' +
          'board is symmetric, so a genuinely bad ordering has to be bad about the game rather than about ' +
          'the array. And the XOR is exact: three independently computed 41-state tables give the same ' +
          'verdict as a 393-state joint search. This inverts the first example: there the saving came from ' +
          'searching a tree more cleverly, and here it comes from noticing the tree is a product of ' +
          'independent trees and never building it.'
      }
    ],

    'expectation-dp': [
      {
        title: 'The board that has a cycle before any snake is placed',
        goal: 'Find where the recursion stops existing, and solve the chain that replaces it.',
        setup: 'A 20-square board rolled with a six-sided die, where a roll that would pass the end leaves ' +
          'you where you are.',
        steps: [
          {
            do: 'Check the rows of the transition table sum to one.',
            why: 'A chain whose probabilities do not sum to one is not a chain.',
            work: 'every transient square sums to 1 within 10⁻⁹',
            result: 'the model is at least well formed before anything is solved'
          },
          {
            do: 'Run a topological sort over the transitions.',
            why: 'The presence of a cycle decides the method, and it is a property of the rules.',
            work: 'the sort fails — squares 15 to 19 each name themselves',
            result: 'the overshoot rule is a self-loop, so the board is cyclic with no snakes on it at all'
          },
          {
            do: 'Write one equation per transient state instead.',
            why: 'E[s] = 1 + Σ p·E[t] rearranges to put E[s] on the left.',
            work: '20 equations, solved by elimination with 20 pivot operations',
            result: 'E[0] = 10.476469 expected rolls'
          },
          {
            do: 'Add two snakes and re-solve.',
            why: 'A snake back to an earlier square is a longer cycle on top of the self-loops.',
            work: 'square 17 sends you to 4 and square 13 to 2: E[0] rises to 13.850548',
            result: 'the same method, no recursion available in either case'
          }
        ],
        answer: '10.476469 rolls on the plain board and 13.850548 with two snakes, both by Gaussian ' +
          'elimination — because both boards are cyclic. The surprising half is that the plain board ' +
          'already is: "you must land exactly" makes every square within one roll of the end name itself ' +
          'on the right-hand side of its own equation. That is precisely the case a memoised recursion ' +
          'cannot handle, and it is in the rules of the game as written.'
      },
      {
        title: 'Three opinions, each checking something the others cannot',
        goal: 'Verify the algebra against a recursion where one exists, and verify the model against a simulation.',
        setup: 'A strictly forward chain where both methods run, the snakes board simulated 40 000 times, ' +
          'and a one-parameter sweep of the secretary problem.',
        steps: [
          {
            do: 'Build a chain that only ever moves forwards and solve it both ways.',
            why: 'The linear solver needs checking somewhere, and cyclic boards offer nothing to check against.',
            work: 'recursion 13.555555344, elimination 13.555555344 — equal to nine decimal places',
            result: 'the elimination is trustworthy on the boards where the recursion cannot run'
          },
          {
            do: 'Simulate the snakes board and report an interval, not a mean.',
            why: 'A simulation is far too noisy to confirm a fourth decimal place.',
            work: '40 000 trials: 13.862425 ± 0.078203, so the 95% interval is [13.7842, 13.9406]',
            result: 'the exact 13.850548 lies inside it'
          },
          {
            do: 'Say what the simulation is actually checking.',
            why: 'It is not the arithmetic — the elimination is exact.',
            work: 'the interval is 0.156 wide against an answer of 13.85, about 1.1%',
            result: 'it checks the transition table describes the game, which no amount of algebra can'
          },
          {
            do: 'Sweep the secretary problem\'s threshold rather than quoting the constant.',
            why: 'A remembered result is worth less than a computed one.',
            work: 'at n = 100 the best k is 37 winning 0.371043, against n/e = 36.788 and 1/e = 0.367879',
            result: 'the classic answer, found rather than assumed'
          }
        ],
        answer: 'Three checks, each seeing something the others cannot. The forward chain confirms the ' +
          'elimination against a recursion to nine decimal places. The simulation confirms the *model* — a ' +
          'transition table that does not describe the game gives an exact answer to the wrong question, ' +
          'and only playing the game as written catches that — at a stated 95% confidence, because at ' +
          '40 000 trials the interval is still 1.1% wide. And the secretary sweep turns a remembered ' +
          'constant into a measured one at k = 37 and 0.371043.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
