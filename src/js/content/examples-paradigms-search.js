/** Worked examples for the structured-search paradigm sections (M11.4-M11.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    matroids: [
      {
        title: 'Four elements that end the argument',
        goal: 'Refute "greedy works on matchings" with a witness rather than an opinion.',
        setup: 'A path of three edges, 0–1, 1–2 and 2–3, with matchings as the independent sets. The checker ' +
          'enumerates every subset, asks the oracle about each, and then searches for a violating pair.',
        steps: [
          {
            do: 'Enumerate the independent sets.',
            why: 'The checker works from the family, not from the definition of a matching.',
            work: '2^3 = 8 subsets asked about\n5 are matchings: ∅, {0–1}, {1–2}, {2–3}, {0–1, 2–3}',
            result: 'a hereditary family — every subset of a matching is a matching'
          },
          {
            do: 'Check the hereditary property.',
            why: 'It holds here, which is why the system looks reasonable at a glance.',
            work: 'every one of the 5 independent sets has all its subsets independent\n0 violations',
            result: 'an independence system, so far indistinguishable from a matroid'
          },
          {
            do: 'Search the pairs for a failure of exchange.',
            why: 'This is the property that makes greedy correct, and it is the one that fails.',
            work: 'A = {1–2} (size 1), B = {0–1, 2–3} (size 2)\n' +
              '{1–2, 0–1} shares vertex 1 — not independent\n' +
              '{1–2, 2–3} shares vertex 2 — not independent',
            result: 'A cannot be extended from B: the exchange property fails'
          },
          {
            do: 'Turn the witness into a weighting that defeats greedy.',
            why: 'The theorem is an if-and-only-if, so a failure means a defeating weighting exists.',
            work: 'weights 2, 3, 2 on the three edges\n' +
              'greedy takes 3 first, then nothing fits: total 3\n' +
              'the optimum is 2 + 2 = 4',
            result: 'greedy returns 75% of the optimum, on four elements'
          }
        ],
        answer: 'Matchings are hereditary and are not a matroid, and the counter-example is a path of three ' +
          'edges: the middle edge alone cannot be extended from the two outer edges. That witness is not an ' +
          'abstraction — it converts directly into the weighting 2, 3, 2 on which the generic greedy ' +
          'algorithm returns 3 where the answer is 4. Both halves matter in a design discussion: the property ' +
          'fails, and here is the instance, and here is the code path that gets it wrong.'
      },
      {
        title: 'Kruskal, without writing Kruskal',
        goal: 'Show that the graphic matroid makes a famous algorithm a corollary rather than a construction.',
        setup: 'Eight random edges over four vertices, with acyclicity as the independence oracle. The generic ' +
          'greedy algorithm — sort by weight, keep what stays independent — is run unchanged.',
        steps: [
          {
            do: 'Check the structure before running anything.',
            why: 'If it is a matroid, no proof of the algorithm is needed at all.',
            work: '256 subsets asked about, 62 independent\n' +
              'hereditary: holds\nexchange: holds',
            result: 'a matroid, so greedy is optimal for every weighting'
          },
          {
            do: 'Run the generic greedy algorithm.',
            why: 'The code has no idea it is looking at a graph.',
            work: '8 oracle calls, one per edge, heaviest first\nweight 46',
            result: 'a maximum-weight spanning forest'
          },
          {
            do: 'Check it against exhaustive enumeration.',
            why: 'The theorem says this must match; a test says it does.',
            work: 'best of all 62 independent sets: 46\ngreedy: 46',
            result: 'equal, as the theorem requires'
          },
          {
            do: 'Negate the weights and run the identical call.',
            why: 'Minimum spanning tree is not a second algorithm.',
            work: 'greedy(edges, acyclicOracle, e => −e.weight)\nminimum weight 16',
            result: 'Kruskal\'s algorithm, as a corollary'
          }
        ],
        answer: 'The graphic matroid passes both checks on this eight-edge instance — 62 independent sets ' +
          'out of 256 subsets — so greedy is optimal by theorem rather than by argument, and it returns the ' +
          'same 46 as an exhaustive search over every independent set. Negating the weights gives the ' +
          'minimum spanning forest from the same call. This is the payoff of the abstraction: Kruskal and its ' +
          'minimum-weight twin are not two algorithms with two proofs, they are one algorithm applied to a ' +
          'structure that was verified once.'
      }
    ],

    backtracking: [
      {
        title: 'Four heuristic stacks on one puzzle',
        goal: 'Price each heuristic in nodes removed, on the same instance and the same solver.',
        setup: 'Inkala\'s "world\'s hardest" Sudoku, solved four times: first empty cell, then MRV, then MRV ' +
          'with forward checking, then all three with constraint propagation. Node budget 500 000.',
        steps: [
          {
            do: 'Run the solver with no heuristics: first empty cell, legal digits only.',
            why: 'The control has to be a working solver, not a strawman.',
            work: '49 559 nodes, 49 498 backtracks, solved',
            result: 'correct, and it finishes — which is why the heuristics have to justify themselves'
          },
          {
            do: 'Switch on minimum remaining values.',
            why: 'Branching on a cell with two options doubles the tree; nine multiplies it by nine.',
            work: '10 102 nodes — 4.9× fewer\nmore work at each node: 81 domains inspected',
            result: 'the largest single step, from one line of ordering'
          },
          {
            do: 'Add forward checking.',
            why: 'Rejecting a branch the moment a cell has nowhere to go catches failure one level earlier.',
            work: '9 180 nodes — a further 1.10×',
            result: 'real and small, which is the honest description of this heuristic'
          },
          {
            do: 'Add constraint propagation to a fixed point.',
            why: 'Deduction rather than testing: one assignment can force dozens.',
            work: '929 nodes — a further 9.9×\n9 089 cells filled without a guess',
            result: '53× fewer nodes than the control, from four flags'
          }
        ],
        answer: 'On Inkala\'s puzzle the four configurations visit 49 559, 10 102, 9 180 and 929 nodes and ' +
          'return the same grid. The two big steps are MRV and propagation, and forward checking — the one ' +
          'that sounds most like a pruning — is worth ten per cent. That ordering is not general, which is ' +
          'the reason to measure rather than to reason: each heuristic costs more work per node, and the only ' +
          'question that matters is whether it removes more nodes than it adds work.'
      },
      {
        title: 'The puzzle where the heuristic loses',
        goal: 'Show that a heuristic is a bet, by finding the instance where the bet fails.',
        setup: 'The same four configurations across five puzzles, including "platinum blonde" — a 17-clue ' +
          'puzzle constructed to be hard — with a 500 000-node budget.',
        steps: [
          {
            do: 'Read the MRV column down the five puzzles.',
            why: 'A column is a distribution; a single row is an anecdote.',
            work: 'easy 52 | escargot 218 | inkala 10 102\n' +
              'anti-brute-force 45 268 | platinum blonde 500 000+',
            result: 'four wins and one run that does not finish'
          },
          {
            do: 'Compare with the naive order on the same two hard puzzles.',
            why: 'This is where the ranking inverts.',
            work: 'anti-brute-force: naive 500 000+, MRV 45 268\n' +
              'platinum blonde:  naive 419 195, MRV 500 000+',
            result: 'each order finishes exactly the puzzle the other cannot'
          },
          {
            do: 'Check what propagation does to both.',
            why: 'A stronger inference is not automatically a rescue.',
            work: 'anti-brute-force: 6 050 nodes\nplatinum blonde: 500 000+',
            result: 'propagation rescues one of the two and not the other'
          },
          {
            do: 'Note what the budget marker means.',
            why: 'An exhausted run is a bound, not a measurement.',
            work: 'the "+" cells are all exactly 500 000\nthe true figures are larger and unknown',
            result: 'no ratio is computed against a marked cell'
          }
        ],
        answer: '"Platinum blonde" is the row that makes the table worth showing: the first-empty-cell order ' +
          'finishes it in 419 195 nodes and MRV — which is 4.9× better on Inkala\'s puzzle and 11× better on ' +
          'the anti-brute-force one — does not finish inside 500 000. A heuristic is a bet about the instance ' +
          'distribution, and this is what losing the bet looks like. The practical consequence is that a ' +
          'solver shipped with one ordering has a failure mode nobody has seen, and a solver that can switch ' +
          'orderings on a timeout does not.'
      }
    ],

    'branch-and-bound': [
      {
        title: 'The bound is the algorithm',
        goal: 'Measure what tightening a bound is worth, holding everything else fixed.',
        setup: 'A 22-item knapsack, capacity 164, explored depth-first with the same traversal and two ' +
          'different admissible bounds, checked against enumeration of all 2^22 subsets.',
        steps: [
          {
            do: 'Establish the answer by exhaustive search.',
            why: 'Every claim below is a claim about matching this number.',
            work: '4 194 304 subsets enumerated\noptimum: 658',
            result: 'the oracle, affordable exactly because the instance is small'
          },
          {
            do: 'Run with the loose bound: capacity times the best remaining density.',
            why: 'It is admissible — no completion can beat filling every unit at the best rate available.',
            work: '282 nodes, 129 subtrees pruned\nvalue 658',
            result: 'correct, and 14 873× fewer nodes than enumeration'
          },
          {
            do: 'Run with the fractional relaxation instead.',
            why: 'The LP optimum is the tightest bound available without solving the problem.',
            work: '70 nodes, 23 subtrees pruned\nvalue 658',
            result: 'a further 4.0× from a strictly better ceiling'
          },
          {
            do: 'Compare the two prunings.',
            why: 'Both bounds are correct; only one of them is worth having.',
            work: 'loose:  282 nodes, 4.0× the tight bound\n' +
              'tight:   70 nodes, 59 919× fewer than exhaustive',
            result: 'tightness, not admissibility, is what buys the pruning'
          }
        ],
        answer: 'Two admissible bounds on the same instance explore 282 and 70 nodes against exhaustive ' +
          'search\'s 4 194 304, and all three return 658. The difference between the two bounds is not a ' +
          'correctness difference and not a constant factor in the traversal — it is that one of them is the ' +
          'exact optimum of a relaxed problem and the other is a rough ceiling. That is the practical rule: ' +
          'spend effort on the relaxation, not on the loop.'
      },
      {
        title: 'The bound that prunes best and answers wrong',
        goal: 'Show that speed is not evidence of correctness in a bounded search.',
        setup: 'The same 22-item instance with a third bound: ninety per cent of the fractional relaxation. ' +
          'It is not admissible, and nothing in the search checks that.',
        steps: [
          {
            do: 'Run it and read the node count.',
            why: 'This is the number that would be reported as a win.',
            work: '40 nodes, 13 subtrees pruned\n' +
              'against 70 for the fractional bound and 282 for the loose one',
            result: 'the fewest nodes of the three — by 43%'
          },
          {
            do: 'Read the value.',
            why: 'Nothing else on the page changes.',
            work: 'value 640\nthe optimum is 658',
            result: '2.7% below the answer, with no exception, warning or invariant failure'
          },
          {
            do: 'Work out how the optimum was lost.',
            why: 'The mechanism is what makes the rule memorable.',
            work: 'a subtree containing the 658 solution had a true ceiling above 658\n' +
              'its reported bound was 0.9 × that, which fell below the incumbent\n' +
              'the subtree was skipped',
            result: 'an under-estimate discards, and discarding is invisible'
          },
          {
            do: 'Note what would have caught it.',
            why: 'The test has to target the bound, not the output.',
            work: 'comparison against exhaustive search on instances up to 22 items\n' +
              '1 disagreement is enough',
            result: 'the only detection available'
          }
        ],
        answer: 'The inadmissible bound explores 40 nodes — fewer than either correct bound — and returns 640 ' +
          'where the optimum is 658. There is no signal: the search completes, the tree looks healthy, and ' +
          'the answer is a valid packing. That is the characteristic failure of optimisation search, and it ' +
          'is why the acceptance test for a bound is agreement with exhaustive enumeration on small ' +
          'instances rather than plausibility on large ones.'
      }
    ]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
