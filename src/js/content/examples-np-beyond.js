/** Worked examples for beyond NP, parameterised algorithms and metaheuristics (M20.4-M20.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'beyond-np': [
      {
        title: 'Change nothing but the prefix, and watch the answer change',
        goal: 'Show that PSPACE is a different question rather than a bigger one, by holding the ' +
          'clauses fixed and moving only the quantifiers.',
        setup: '10 variables and 14 clauses at seed 5, posed under five prefixes: all ' +
          'existential, one alternation each way, two alternations and three.',
        steps: [
          {
            do: 'Solve the matrix as plain SAT.',
            why: 'It is the all-existential prefix, and it is the baseline every row shares.',
            work: '14 clauses over 10 variables, 37 evaluation nodes',
            result: 'TRUE — and a SAT solver reports satisfiable for all five rows'
          },
          {
            do: 'Put five of the ten variables under ∀ and evaluate again.',
            why: 'Nothing about the instance grew; only who chooses changed.',
            work: 'prefix EA, 1 alternation, 5 universal variables, 223 nodes',
            result: 'FALSE'
          },
          {
            do: 'Swap the two blocks and evaluate a third time.',
            why: 'Same clauses, same split, opposite move order.',
            work: 'prefix AE, 1 alternation, 5 universal variables, 546 nodes',
            result: 'FALSE again — but at 2.4× the cost'
          },
          {
            do: 'Check every row against a truth-table oracle that folds the prefix inward.',
            why: 'A recursive evaluator and a table fold share no code, so agreement is evidence.',
            work: '5 of 5 rows agree, over 2¹⁰ = 1 024 table entries each',
            result: 'the evaluator is right on every prefix'
          },
          {
            do: 'Expand each prefix into one ordinary CNF and read the sizes.',
            why: 'This is the cost of "just turn it into SAT".',
            work: '14, 152, 208, 78 and 264 clauses from the same 14-clause matrix',
            result: 'the expansion doubles per ∀ variable, which is the reason nobody does it'
          }
        ],
        answer: 'Three of the five prefixes make a satisfiable clause set into a false sentence, ' +
          'and a SAT solver reports "satisfiable" for all five because it never sees the prefix. ' +
          'The evaluation cost does not track the alternation count monotonically — the three ' +
          'alternation row is the cheapest of the four with a ∀ in it, at 46 nodes, because ' +
          'pruning finds a falsified clause early. What does track it is the EXPANSION column, ' +
          'which doubles for every universal variable and is the honest measure of what the ' +
          'quantifiers cost.'
      },
      {
        title: 'The inverted case: two games with identical clauses and opposite answers',
        goal: 'Isolate the quantifier ORDER as the only variable, and read off what a winning ' +
          'certificate would have to be.',
        setup: 'The matching game: for each round, two clauses saying x and y agree. Posed as ' +
          '∀x ∃y and then as ∃y ∀x, for one to four rounds.',
        steps: [
          {
            do: 'Evaluate ∀x ∃y (x agrees with y) at one round.',
            why: '"Whatever you play, I can match it" should be true.',
            work: '2 clauses, 6 evaluation nodes',
            result: 'TRUE'
          },
          {
            do: 'Evaluate the same clauses with the prefix reversed.',
            why: '"I can pick an answer now that matches whatever you play later" should be false.',
            work: 'the same 2 clauses, 6 evaluation nodes',
            result: 'FALSE'
          },
          {
            do: 'Run both up to four rounds and confirm the answers hold.',
            why: 'A single size could be a coincidence.',
            work: '∀∃ TRUE at 6, 19, 51 and 127 nodes; ∃∀ FALSE at 6, 14, 30 and 62',
            result: 'the two answers are stable, and the clauses are identical at every size'
          },
          {
            do: 'Ask what a certificate for the true one would be at four rounds.',
            why: 'This is the whole practical difference between NP and PSPACE.',
            work: 'not an assignment of 8 variables but a function of the opponent’s 4 moves — ' +
              '16 entries',
            result: 'the witness is a strategy, and it is exponential in the universal variables'
          },
          {
            do: 'Hand both to a SAT solver.',
            why: 'To confirm it cannot tell them apart.',
            work: 'both of the 4-round instances report satisfiable, because a CNF has ' +
              'no prefix in it at all',
            result: 'the two questions look identical to a tool that only sees clauses'
          }
        ],
        answer: 'The clauses are byte for byte the same in every pair and the answers are ' +
          'opposite, so the entire difference is who moves first. That is the shortest available ' +
          'demonstration that a quantifier prefix is not decoration. The second thing to take ' +
          'from the table is the certificate column: the true sentence has no assignment to show ' +
          'you, only a 16-entry table, and that is what "easy to check" stops meaning at this ' +
          'level of the hierarchy.'
      }
    ],

    'parameterised-algorithms': [
      {
        title: 'Five methods, one answer, and five different things they are exponential in',
        goal: 'Separate the three techniques by measuring them on one instance where the answer ' +
          'is known exactly.',
        setup: 'A 20-vertex graph with 45 edges at seed 4, asked for a cover of size 12, with ' +
          'brute force available as an oracle.',
        steps: [
          {
            do: 'Enumerate every subset.',
            why: 'It gives the exact optimum and the reference cost.',
            work: '2²⁰ = 1 048 576 subsets examined, minimum cover 12',
            result: 'exponential in n, and correct'
          },
          {
            do: 'Branch on an arbitrary uncovered edge.',
            why: 'The three-line baseline, already fixed-parameter tractable.',
            work: '925 search nodes with the reduction rules off, cover of 12',
            result: '1 133× cheaper than brute force, exponential in k rather than n'
          },
          {
            do: 'Branch on a highest-degree vertex instead.',
            why: 'One different choice of what to branch on.',
            work: '13 search nodes, cover of 12',
            result: '71× cheaper again, from the same code path'
          },
          {
            do: 'Kernelise first, then branch.',
            why: 'The preprocess is polynomial and its output is bounded by k.',
            work: 'the kernel is 19 vertices and 45 edges here; 13 nodes to finish',
            result: 'the same answer, and the kernel is what makes the bound independent of n'
          },
          {
            do: 'Check every returned cover against the graph itself.',
            why: 'A cover that misses an edge is smaller than a valid one and flatters every column.',
            work: 'all five covers verified against 45 edges',
            result: '5 of 5 valid, and all of size 12'
          }
        ],
        answer: 'Every row answers the same question and the node column spans five orders of ' +
          'magnitude, from 1 048 576 to 13. What separates them is the last column: brute force ' +
          'is exponential in the 20 vertices, and everything below it is exponential in the ' +
          'budget of 12. In production those two numbers are usually much further apart than ' +
          'that, which is the whole argument for asking what the parameter is before asking how ' +
          'hard the problem is.'
      },
      {
        title: 'The inverted case: the reduction rules cut every node count and make the fitted base look worse',
        goal: 'Show why a single "measured branching factor" column would report the opposite of ' +
          'what the preprocessing does.',
        setup: 'The same 20-vertex graph, swept over budgets from 6 to 18, with both branching ' +
          'rules and the reduction rules on and off.',
        steps: [
          {
            do: 'Measure edge branching with the rules off.',
            why: 'The closed form 2^(k+1) − 1 makes it a control.',
            work: '127 nodes at the smallest budget and 4 095 at the largest NO budget',
            result: 'a fitted base of 2.0030 — the textbook bound observed'
          },
          {
            do: 'Turn the reduction rules on and measure again.',
            why: 'Every node count should fall.',
            work: '1 node at the smallest budget and 745 at the largest NO budget',
            result: 'every count is lower, by up to 127×'
          },
          {
            do: 'Fit the base over the same window with the rules on.',
            why: 'This is the number a single column would report.',
            work: '3.0163 against 2.0030',
            result: 'the fitted base is HIGHER, which reads as "preprocessing made it worse"'
          },
          {
            do: 'Explain the discrepancy from where the rules fire.',
            why: 'A number that looks wrong needs a mechanism, not a caveat.',
            work: '"degree above k" is common at k = 6 and rare at k = 18, so the left end ' +
              'flattens and consecutive ratios inflate',
            result: 'the base is a property of the tail and this window is not the tail'
          },
          {
            do: 'Repeat for degree branching.',
            why: 'To confirm it is the rules and not the branching choice.',
            work: '1.4991 with the rules off, 1.6712 with them on; 7 nodes falling to 1 at the ' +
              'smallest budget',
            result: 'the same pattern, at a lower base'
          }
        ],
        answer: 'Both effects are real and they point in opposite directions, so the honest ' +
          'table reports both. The node counts fall everywhere — 127 to 1 at the small end — and ' +
          'the fitted base rises from 2.0030 to 3.0163, because the preprocessing is doing most ' +
          'of its work exactly where the fit takes its first points. This is worth generalising: ' +
          'a growth rate fitted over a window where a constant-factor optimisation is still ' +
          'engaging measures the optimisation disengaging, not the growth.'
      }
    ],

    metaheuristics: [
      {
        title: 'Eight methods, one budget, and the two columns nobody publishes',
        goal: 'Run a fair tournament and read the result that surprises people.',
        setup: '30 cities at seed 7, 40 000 objective evaluations for every method, all from ' +
          'method seed 11.',
        steps: [
          {
            do: 'Establish the baseline and the bound.',
            why: 'A ratio needs something to be a ratio to.',
            work: 'nearest neighbour 588.75; the MST lower bound is 403.41 and Christofides ' +
              'gives 499.40',
            result: 'the search has about 185 units of room between the bound and the baseline'
          },
          {
            do: 'Run 2-opt from the nearest-neighbour tour.',
            why: 'The trivial local search, with no escape mechanism at all.',
            work: '481.52 after 2 430 evaluations, then no improving move exists',
            result: 'the best tour in the table, using 6.1% of the budget'
          },
          {
            do: 'Run the five sophisticated methods on the same budget.',
            why: 'They all have escape mechanisms and all spend the whole budget.',
            work: 'annealing 486.03, tabu 489.00, genetic 552.96, ant colony 486.03, GRASP 481.52',
            result: 'one ties with 2-opt and four are worse'
          },
          {
            do: 'Read the evaluations-used column against evaluations-offered.',
            why: 'This is the column that makes the comparison a comparison.',
            work: 'nearest neighbour 30, 2-opt 2 430, or-opt 9 282 (reaching 521.42), '   +
              'everything else 40 000+',
            result: 'three methods converged and could not use the rest of the budget'
          },
          {
            do: 'Check every returned tour is a permutation of all 30 cities.',
            why: 'A tour that skips a city is short.',
            work: '8 of 8 valid',
            result: 'the length column is comparing tours rather than fragments'
          }
        ],
        answer: 'Plain 2-opt from a greedy start reaches the best tour anything in the table ' +
          'finds, using 2 430 of 40 000 evaluations, and then stops because there is no ' +
          'improving move left. Five methods with escape mechanisms spend sixteen times the ' +
          'budget to arrive at the same place or worse. That is not an argument against ' +
          'annealing or tabu search — the budget sweep shows the ranking changing — it is an ' +
          'argument for including the trivial baseline, which is the control most published ' +
          'comparisons omit.'
      },
      {
        title: 'The inverted case: the ranking changes with the budget, and a badly cooled schedule returns its own input',
        goal: 'Find the settings where the tournament’s conclusion reverses, and the setting ' +
          'where a method silently does nothing.',
        setup: 'The same 30-city instance at four budgets, and annealing at five starting ' +
          'temperatures under one budget.',
        steps: [
          {
            do: 'Run the tournament at 2 000 evaluations.',
            why: 'A short budget favours whatever improves fastest.',
            work: '2-opt 489.0 wins; annealing 512.2, tabu 505.4, GRASP 592.2, genetic 759.1',
            result: 'local search wins by a wide margin'
          },
          {
            do: 'Run it at 160 000.',
            why: 'A long budget favours whatever keeps sampling.',
            work: '2-opt 481.5 unchanged; annealing 481.5, tabu 481.5, GRASP 481.5',
            result: 'four methods tie, and 2-opt has not moved since 10 000'
          },
          {
            do: 'Compare the converged methods across all four budgets.',
            why: 'A converged method cannot use a larger budget at all.',
            work: 'nearest neighbour 588.7 at every budget; 2-opt 489.0 then 481.5 three times',
            result: 'flat curves, which is what convergence looks like in a table'
          },
          {
            do: 'Set the annealing starting temperature to zero.',
            why: 'The acceptance test becomes Δ < 0, so annealing IS hill climbing.',
            work: '7 moves accepted, 0 of them worsening, tour 513.39',
            result: 'the degeneration is a setting rather than a footnote'
          },
          {
            do: 'Sweep the starting temperature and look for monotonicity.',
            why: 'A tidy sweep would hide what tuning actually is.',
            work: '0.00 → 513.39, 2.61 → 486.03, 13.06 → 489.28, 52.23 → 486.03',
            result: 'not monotone: the middle setting is worse than both its neighbours'
          }
        ],
        answer: 'Fifteen cities are small enough for Held–Karp, and against that exact optimum ' +
          'of 327.51 five of the eight methods are optimal at a budget of 1 500 while nearest ' +
          'neighbour is 1.1646, the genetic algorithm 1.0088 and the ant colony 1.0604. On ' +
          'the thirty-city instance no ' +
          'optimum is available and every claim is phrased against the best found instead. ' +
          'Every row of the budget table is true and none of them is informative alone: at ' +
          '2 000 evaluations local search wins by 16 units and at 160 000 four methods are tied ' +
          'to two decimal places. The temperature sweep carries the second lesson. Zero degrades ' +
          'annealing to hill climbing exactly, and the sweep is not monotone — 13.06 is worse ' +
          'than both 2.61 and 52.23 — which is worth leaving visible, because tuning a proposal ' +
          'distribution is a search rather than a direction.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
