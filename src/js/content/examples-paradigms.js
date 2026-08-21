/** Worked examples for the first three paradigm sections (M11.1-M11.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'exhaustive-search': [
      {
        title: 'One check, moved one level up',
        goal: 'Measure what a pruning is worth when nothing else about the search changes.',
        setup: 'n-queens at n = 6, 8 and 10. Both configurations assign one queen per row and one column per ' +
          'queen; they differ only in whether the diagonal test runs at placement or at the completed board.',
        steps: [
          {
            do: 'Establish the control: check the diagonals only when the board is full.',
            why: 'A control has to be the same search, not a worse one, or the ratio measures two changes.',
            work: 'n =  6:     1 957 nodes\n' +
              'n =  8:   109 601 nodes\n' +
              'n = 10: 9 864 101 nodes',
            result: 'the permutation tree, with every complete board tested once'
          },
          {
            do: 'Move the identical test to the moment a queen is placed.',
            why: 'A queen attacking on a diagonal in the first k rows still attacks in every completion, so ' +
              'the subtree holds no solution.',
            work: 'n =  6:    153 nodes — 12.8× fewer\n' +
              'n =  8:  2 057 nodes — 53.3× fewer\n' +
              'n = 10: 35 539 nodes — 277.6× fewer',
            result: 'the same search, three orders of magnitude smaller at n = 10'
          },
          {
            do: 'Check the solution counts.',
            why: 'A pruning that changes the answer is a bug that happens to be fast.',
            work: 'n = 6: 4 solutions from both\n' +
              'n = 8: 92 from both\n' +
              'n = 10: 724 from both',
            result: 'the pruning is a pruning'
          },
          {
            do: 'Note how the ratio grows with n.',
            why: 'The saving is not a constant factor: it is the size of the subtrees being removed.',
            work: '12.8× at n = 6, 53.3× at n = 8, 277.6× at n = 10',
            result: 'each additional row multiplies the control by about n and the pruned search by far less'
          }
        ],
        answer: 'Moving one unchanged test from the leaf to the placement takes eight queens from 109 601 ' +
          'nodes to 2 057 and ten queens from 9 864 101 to 35 539, with the solution counts identical at 92 ' +
          'and 724. Nothing was learned about queens between the two runs; the test was simply evaluated as ' +
          'soon as it became decidable. That is the whole content of "prune early", and the reason it is ' +
          'worth stating as a rule is that the code change is two lines and the measurement is a factor of ' +
          '278.'
      },
      {
        title: 'The pruning that multiplies, and the heuristic that does nothing',
        goal: 'Separate a pruning from an ordering, which look alike in code and behave completely differently.',
        setup: 'The same n = 8 board, with symmetry breaking and most-constrained-first ordering switched on ' +
          'independently, measured for "every solution" and for "the first solution".',
        steps: [
          {
            do: 'Measure the two prunings alone and together, as fractions of the control.',
            why: 'Independent prunings should multiply, and the claim is checkable to four decimal places.',
            work: 'early diagonal check only:  2 057 / 109 601 =  1.88%\n' +
              'symmetry breaking only:   54 801 / 109 601 = 50.00%\n' +
              'both:                      1 029 / 109 601 =  0.94%',
            result: '1.88% × 50.00% = 0.94%, measured exactly'
          },
          {
            do: 'Switch on most-constrained-first ordering while asking for every solution.',
            why: 'An ordering permutes the children; an exhaustive search visits them all either way.',
            work: '2 057 nodes without the ordering\n2 057 nodes with it\n92 solutions from both',
            result: 'the node count does not move by one'
          },
          {
            do: 'Ask for the first solution instead, with and without the ordering.',
            why: 'Now the search can stop, so the order decides how much tree is left when it does.',
            work: '114 nodes without the ordering\n9 nodes with it\n12.7× fewer',
            result: 'the same heuristic, from worthless to decisive, by changing the stopping condition'
          },
          {
            do: 'Check that symmetry breaking still reports every solution.',
            why: 'Halving the tree by discarding mirrors is only legitimate if the mirrors are put back.',
            work: '1 029 nodes visited, 92 solutions reported',
            result: 'the boards not visited were exactly the mirrors of the ones that were'
          }
        ],
        answer: 'Two nearly independent prunings leave 1.88% and 50.00% of the control\'s nodes and together ' +
          'leave 0.94% — which is what their product predicts, and is why a second constraint that only ' +
          'removes half is still worth having. Nearly, not exactly: the measured 0.9389% sits just above the ' +
          '0.9384% the product gives, because the two prunings overlap a little — some of the mirrored ' +
          'boards would have been cut by the diagonal check anyway, so symmetry breaking is not removing a ' +
          'clean half of what the early check left. At two decimal places the difference vanishes, which is ' +
          'exactly why the independence assumption is worth stating rather than assuming. ' +
          'The ordering heuristic is a different kind of thing: it changes the node count from ' +
          '2 057 to 2 057 when every solution is wanted and from 114 to 9 when only the first is. Reporting ' +
          'one number for both goals would make it look either useless or magical, and it is neither.'
      }
    ],

    'divide-and-conquer': [
      {
        title: 'Three products instead of four',
        goal: 'Watch an exponent change, in counted digit multiplications rather than in wall clock.',
        setup: 'Random decimal operands of equal length, multiplied by schoolbook and by Karatsuba with the ' +
          'recursion running all the way down, with every digit product counted and both answers compared ' +
          'against BigInt.',
        steps: [
          {
            do: 'Write down the identity the algorithm is built on.',
            why: 'The whole improvement is one line of algebra; everything else is bookkeeping.',
            work: '(aB + b)(cB + d) = acB² + (ad + bc)B + bd\n' +
              'ad + bc = (a + b)(c + d) − ac − bd\n' +
              'so 3 half-size products, not 4',
            result: 'T(n) = 3T(n/2) + O(n), which is n^log₂3 ≈ n^1.585'
          },
          {
            do: 'Count digit products at four sizes.',
            why: 'The claim is about an operation count, so the operation is what gets counted.',
            work: 'n =   16:     256 against    128 — 2.00×\n' +
              'n =  128:  16 384 against  3 715 — 4.41×\n' +
              'n =  512: 262 144 against 33 498 — 7.83×\n' +
              'n = 1 024: 1 048 576 against 100 273 — 10.46×',
            result: 'the ratio grows with n, which is what an exponent looks like in a table'
          },
          {
            do: 'Compare the measurement with the idealised n^1.585.',
            why: 'The gap between a model and a measurement is a result, not an error.',
            work: 'n =   128: predicted  2 187, measured   3 715 — 1.70×\n' +
              'n =   512: predicted 19 683, measured  33 498 — 1.70×\n' +
              'n = 1 024: predicted 59 049, measured 100 273 — 1.70×',
            result: 'a constant overhead — the recursion pays for its own additions and uneven splits'
          },
          {
            do: 'Check both answers against BigInt.',
            why: 'A multiplication bug produces a number, and a number looks like an answer.',
            work: 'all 9 sizes agree exactly with the BigInt product',
            result: 'the counts are comparing two correct algorithms'
          }
        ],
        answer: 'Karatsuba does 100 273 digit products where schoolbook does 1 048 576 on 1 024-digit ' +
          'operands, a factor of 10.46, and the ratio grows with n because the exponents differ rather than ' +
          'the constants. The measured counts sit 1.70× above the idealised n^1.585 at every size — a ' +
          'parallel line on log axes, not a diverging one — which says the recursion\'s own additions cost a ' +
          'constant factor and not a worse exponent. Both algorithms agree with BigInt at every size, which ' +
          'is what makes the comparison a comparison.'
      },
      {
        title: 'The size at which the better algorithm is worse',
        goal: 'Find the crossover by measurement, and see why every library has a threshold.',
        setup: 'The same two algorithms at small sizes, then the same question for Strassen against the ' +
          'triple loop, and finally the numerical price Strassen charges.',
        steps: [
          {
            do: 'Count digit products at n = 4 and n = 8.',
            why: 'This is the region the asymptotics say nothing about.',
            work: 'n = 4: schoolbook 16, Karatsuba 17 — a ratio of 0.94\n' +
              'n = 8: schoolbook 64, Karatsuba 45 — a ratio of 1.42',
            result: 'the asymptotically better algorithm loses at four digits'
          },
          {
            do: 'Explain where the extra product comes from.',
            why: 'The overhead is structural, not an implementation detail.',
            work: '3 recursive products on 2-digit halves = 3 × 4 = 12\n' +
              'plus the carry digit that (a+b) and (c+d) can produce\n' +
              'plus 2 more products from the uneven split',
            result: 'the recursion has a floor, and below it schoolbook is simply less work'
          },
          {
            do: 'Do the same for Strassen against the triple loop.',
            why: 'The same shape appears with a different constant and a different reason.',
            work: 'side  16: 4 096 against 2 401 — 1.71×\n' +
              'side 128: 2 097 152 against 823 543 — 2.55×',
            result: 'exactly 8^k against 7^k, so the win is real at every size in this column'
          },
          {
            do: 'Measure what Strassen costs numerically.',
            why: 'The caveat is usually stated as a warning; it should be a number.',
            work: 'largest entry 966.46, worst disagreement 1.25 × 10⁻¹¹\n' +
              'relative: 1.29 × 10⁻¹⁴ at side 64, 3.40 × 10⁻¹⁴ at side 128',
            result: 'small, non-zero, and growing with the recursion depth'
          }
        ],
        answer: 'At four digits Karatsuba does 17 digit products against schoolbook\'s 16 and is the slower ' +
          'algorithm; by sixteen digits it is twice as good and by a thousand it is ten times. That is why ' +
          'every bignum library switches at a threshold and tunes it per machine: the exponent decides which ' +
          'algorithm and the constants decide where. Strassen shows the same shape with an extra term — the ' +
          'product count is 7^k against 8^k at every size, but the block subtractions cancel and cost a ' +
          'relative entrywise error of 3.4 × 10⁻¹⁴ at side 128, which is small until the problem is ' +
          'ill-conditioned.'
      }
    ],

    'greedy-algorithms': [
      {
        title: 'Four criteria, and the one with a proof',
        goal: 'Show that a greedy rule can be wrong without ever producing an invalid answer.',
        setup: 'Interval scheduling with four selection criteria, each run against an exact ' +
          'dynamic-programming oracle on the same instances, and a search for the first instance where each ' +
          'loses.',
        steps: [
          {
            do: 'Run all four criteria on ordinary random instances.',
            why: 'This is what a test suite does, and it is the reason wrong criteria survive.',
            work: 'on most instances of 12 intervals all 4 criteria return the same size\n' +
              'every answer is a valid schedule, on every instance',
            result: 'nothing distinguishes them by inspection'
          },
          {
            do: 'Search for an instance where earliest-start loses.',
            why: 'A counter-example is the only evidence a criterion is wrong.',
            work: 'found after 5 random instances of 4 intervals\n' +
              'greedy schedules 1, the optimum is 2',
            result: 'one long interval, taken first, blocking two short ones'
          },
          {
            do: 'Do the same for shortest-duration and fewest-conflicts.',
            why: 'How hard the counter-example is to find is itself the measurement.',
            work: 'shortest:         554 instances, 4 intervals, 1 against 2\n' +
              'fewest-conflicts: 94 996 instances, 9 intervals, 3 against 4',
            result: 'the same kind of defect, four orders of magnitude apart in detectability'
          },
          {
            do: 'Search for one against earliest-finish.',
            why: 'The negative result is the point: this criterion has a proof, and the search agrees.',
            work: '200 000 instances searched across five instance sizes\n0 disagreements',
            result: 'no counter-example, which is evidence rather than proof'
          },
          {
            do: 'Read the staying-ahead table against a genuinely different optimal schedule.',
            why: 'That is the proof, tabulated — and the rival has to be built by the mirror rule, or ' +
              'the table compares greedy with itself and every row ties.',
            work: 'k = 1: 5 against 5    k = 2: 10 against 10\n' +
              'k = 3: 11 against 11   k = 4: 15 against 15\n' +
              'k = 5: 18 against 20',
            result: 'never behind at any k, and strictly ahead at the last one'
          }
        ],
        answer: 'Three of these four criteria are wrong and all four return valid schedules on every ' +
          'instance. What separates them is a proof, and what separates them empirically is how long a ' +
          'search must run to find a disagreement: 5 instances for earliest-start, 554 for shortest, 94 996 ' +
          'for fewest-conflicts, and none in 200 000 for earliest-finish. A test suite that ran a thousand ' +
          'random instances would certify two of the three wrong criteria.'
      },
      {
        title: 'The same greedy rule, optimal and not, on data that looks identical',
        goal: 'Show a case where correctness depends on the input data rather than the problem structure.',
        setup: 'Greedy change-making over five denomination sets, each checked exhaustively up to the bound ' +
          'that settles the question, plus the fractional and 0/1 knapsack pair.',
        steps: [
          {
            do: 'Run greedy change-making on the US coin set.',
            why: 'It is the example everyone has, and it is optimal — which is the trap.',
            work: '1, 5, 10, 25: checked to 35, no counter-example\n' +
              '1, 2, 5, 10, 20, 50: checked to 70, no counter-example',
            result: 'both canonical: greedy is optimal for every amount'
          },
          {
            do: 'Try three sets that look no different.',
            why: 'Nothing structural distinguishes them; only a search does.',
            work: '1, 3, 4:   fails at 6 — greedy 3 coins, optimum 2\n' +
              '1, 7, 10:  fails at 14 — greedy 5 coins, optimum 2\n' +
              '1, 15, 25: fails at 30 — greedy 6 coins, optimum 2',
            result: 'the same algorithm, wrong on three of five real-looking coin systems'
          },
          {
            do: 'Note why the check terminates.',
            why: 'An unbounded search would prove nothing when it found nothing.',
            work: 'a non-canonical system has a witness below the sum of the two largest coins\n' +
              '1, 5, 10, 25 → check to 25 + 10 = 35',
            result: 'a finite sweep decides the question either way'
          },
          {
            do: 'Compare fractional and 0/1 knapsack on the same three items.',
            why: 'One word in the problem statement moves greedy from optimal to wrong.',
            work: 'items (60, 10), (100, 20), (120, 30), capacity 50\n' +
              'fractional greedy: 240\n0/1 optimum: 220',
            result: 'the greedy rule is exact for one and an over-estimate for the other'
          }
        ],
        answer: 'Greedy change-making is optimal for 1, 5, 10, 25 and for the euro set, and wrong for ' +
          '1, 3, 4 at six, for 1, 7, 10 at fourteen and for 1, 15, 25 at thirty — each time by using six ' +
          'coins where two would do, or three where two would. Nothing about the sets distinguishes them by ' +
          'inspection, so the only usable form of the question is the bounded one: a non-canonical system has ' +
          'a counter-example below the sum of the two largest coins, so a sweep to 35 settles the US set for ' +
          'good. The knapsack pair makes the same point across a problem boundary: the same density rule is ' +
          'exactly optimal fractionally, at 240, and an over-estimate integrally, where the answer is 220.'
      }
    ]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
