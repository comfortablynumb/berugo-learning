/** Worked examples for general matching and 2-SAT (M14.6-M14.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'general-matching': [
      {
        title: 'Six vertices, eight edges, and the same graph answered two different ways',
        goal: 'Show that bipartite-style augmentation on a general graph is wrong rather than slow, ' +
          'and that the failure depends on nothing but the neighbour order.',
        setup: 'The smallest graph found by exhaustive search on which the naive search fails: two ' +
          'triangles sharing vertex 3, plus a pendant on vertex 4. Eight edges, six vertices.',
        steps: [
          {
            do: 'Run bipartite-style augmentation, marking each vertex once.',
            why: 'This is what "just extend the bipartite algorithm" produces.',
            work: 'a matching of size 2 — a perfectly valid matching',
            result: 'no error, no warning, one edge short'
          },
          {
            do: 'Run Edmonds with blossom contraction.',
            why: 'The odd cycle is exactly the case the marking rule throws away.',
            work: 'size 3, after 1 blossom contraction over 3 augmenting paths and 13 edge examinations',
            result: 'the true maximum'
          },
          {
            do: 'Check both against an exhaustive search over every pairing.',
            why: 'Two implementations built from one idea can share a mistake.',
            work: 'brute force returns 3, so the naive answer is short by exactly 1',
            result: 'the deficit confirmed independently'
          },
          {
            do: 'Now sort each adjacency list ascending and run the naive search again.',
            why: 'Nothing about the graph has changed — only the order the lists were built in.',
            work: 'the same eight edges give size 3, at 6 edge examinations instead of 13',
            result: 'the wrong algorithm is now right'
          },
          {
            do: 'Ask how often the failure fires on graphs nobody arranged.',
            why: 'A contrived failure is a curiosity; a common one is a production bug.',
            work: '60 random graphs at each of 12, 16, 20, 24 and 30 edges: short on 1, 1, 1, 2 and ' +
              '0 respectively — 5 of 300, or 1.7%',
            result: 'one input in sixty, silently'
          }
        ],
        answer: '2 against 3 on the counter-example, and 5 of 300 on random graphs — 1.7%. The ' +
          'sorted-order run is the part worth remembering: the same graph, the same edges, a ' +
          'different iteration order, and a different answer. A test suite that builds its fixtures ' +
          'from tidy literals will never see this, and a service whose adjacency comes out of a hash ' +
          'map will see it intermittently.'
      },
      {
        title: 'The cheapest perfect assignment, its certificate, and what greedy costs',
        goal: 'Solve a weighted matching, check optimality from the duals rather than from a second ' +
          'run, and price the answer everybody reaches for first.',
        setup: 'Six workers, six tasks, costs drawn from 1 to 20 at seed 1, solved by the Hungarian ' +
          'algorithm; then the same generator at sizes 3 to 8.',
        steps: [
          {
            do: 'Run the Hungarian algorithm.',
            why: 'It is O(n³) where the permutation search is O(n!).',
            work: 'cost 28, in 6 phases and 45 comparisons',
            result: 'a complete assignment'
          },
          {
            do: 'Read the reduced cost of every chosen cell.',
            why: 'The duals are a proof that does not mention the algorithm.',
            work: 'reduced cost exactly 0 on all 6 chosen cells, and no cell anywhere is negative',
            result: 'any other permutation costs at least as much — proved from a table of numbers'
          },
          {
            do: 'Confirm against an exhaustive permutation search.',
            why: 'A certificate is only as good as the arithmetic that produced it.',
            work: 'all 720 permutations checked; the minimum is 28',
            result: 'the certificate is sound'
          },
          {
            do: 'Take the cheapest remaining cell in each row instead.',
            why: 'This is the answer people write first, and it is a valid permutation.',
            work: 'greedy pays 34 against 28 — 21.4% more',
            result: 'wrong, and it looks entirely reasonable'
          },
          {
            do: 'Sweep the size from 3 to 8 and compare the two columns.',
            why: 'If greedy were an approximation the gap would be bounded.',
            work: 'optimal 20, 27, 20, 28, 33, 30 · greedy 20, 27, 30, 34, 42, 51 — excess 0, 0, ' +
              '10, 6, 9, 21, or up to 70%',
            result: 'the gap grows rather than shrinking'
          }
        ],
        answer: '28, certified by 6 zero-reduced-cost cells and no negative cell anywhere, against ' +
          '720 permutations and 45 Hungarian comparisons. Greedy pays 34 at six workers and 51 ' +
          'against 30 at eight — 70% more. Greedy is not a cheap approximation of the assignment ' +
          'problem; it is a different algorithm with no bound at all, and the fact that its output ' +
          'is a valid permutation is exactly what hides that.'
      }
    ],

    'two-sat': [
      {
        title: 'A scheduling instance, its implication graph, and the one conflict that breaks it',
        goal: 'Encode a two-slot scheduling problem as 2-SAT, solve it by strongly connected ' +
          'components, and find the exact point where it becomes unsatisfiable.',
        setup: 'Eight tasks, each choosing between two slots, with 6 pairwise conflicts at seed 1. ' +
          'Variable v means "task v takes its first slot".',
        steps: [
          {
            do: 'Turn each conflict into clauses.',
            why: 'Two tasks must not share a slot, which is two two-literal clauses.',
            work: '6 conflicts become 12 clauses and 24 implications — exactly two arcs per clause',
            result: 'a directed graph on 16 vertices, two per variable'
          },
          {
            do: 'Run Tarjan and look for a variable sharing a component with its own negation.',
            why: 'That is the satisfiability condition, in full.',
            work: '4 components, 0 contradictions',
            result: 'satisfiable'
          },
          {
            do: 'Read the assignment off the component order.',
            why: 'Set x true exactly when its component comes later in the reverse topological order.',
            work: '5 variables true and 3 false, breaking 0 of the 12 clauses',
            result: 'an answer with no search and no backtracking anywhere'
          },
          {
            do: 'Check it against every assignment.',
            why: 'A satisfiable verdict with a broken assignment is the failure that looks most like success.',
            work: 'all 256 assignments enumerated; the verdict agrees',
            result: 'the solver and the oracle agree'
          },
          {
            do: 'Add one more conflict and run it again.',
            why: 'The interesting output of a 2-SAT solver is not "no" but "no, because of these".',
            work: '7 conflicts give 14 clauses and 28 implications; 7 variables now share a ' +
              'component with their own negation and the component count falls from 4 to 3',
            result: 'unsatisfiable, with the offending variables named'
          }
        ],
        answer: 'Satisfiable at 6 conflicts with 5 variables true, unsatisfiable at 7 with 7 named ' +
          'contradictions. The step worth noticing is the fourth: no search happens anywhere. Two ' +
          'linear passes — one to find the components, one to read the values — answer a ' +
          'satisfiability question that becomes NP-complete the moment a clause grows a third ' +
          'literal.'
      },
      {
        title: 'Where random instances stop being satisfiable, and the wall one literal away',
        goal: 'Locate the satisfiability threshold by measurement, then measure what an implication ' +
          'graph does when handed a three-literal clause.',
        setup: 'Forty variables with random two-literal clauses at eight clause densities, sixty ' +
          'instances each; then ten variables with random three-literal clauses, a hundred formulas ' +
          'per clause count, each solved exhaustively and by the two-literal relaxation.',
        steps: [
          {
            do: 'Sweep the clause-to-variable ratio from 0.4 to 2.0.',
            why: 'The threshold is a fact about the instances, not about the solver.',
            work: 'satisfiable rate 100.0%, 98.3%, 98.3%, 95.0%, 93.3%, 80.0%, 43.3%, 5.0%',
            result: 'a transition centred near a ratio of 1'
          },
          {
            do: 'Note where the interesting instances are.',
            why: '"Tested on random instances" is a statement about the ratio.',
            work: 'at 16 clauses over 40 variables every one of 60 is satisfiable; at 80 clauses ' +
              'only 3 of 60 are',
            result: 'a benchmark that does not name its ratio has not named anything'
          },
          {
            do: 'Now take three-literal formulas and drop a literal from each clause.',
            why: 'It is the only thing an implication graph can do with three literals.',
            work: 'each 3-literal clause becomes 1 two-literal clause, which is strictly stronger, ' +
              'so a satisfiable verdict is always sound',
            result: 'wrong in one direction only'
          },
          {
            do: 'Count how often the surviving direction lies.',
            why: 'A relaxation that rejects most valid inputs is not a filter.',
            work: 'at 10, 15, 20, 25, 30 and 40 clauses over 10 variables the relaxation wrongly ' +
              'reports unsatisfiable on 0, 11, 46, 77, 93 and 85 of 100 formulas',
            result: 'nearly half wrong at 20 clauses, and 93% wrong at 30'
          },
          {
            do: 'Confirm the other direction never fails.',
            why: 'If it did, the relaxation would be useless rather than merely weak.',
            work: '0 wrongly-satisfiable verdicts in all six rows, 600 formulas',
            result: 'the guarantee holds exactly as the theory says'
          }
        ],
        answer: 'The satisfiable rate falls from 100% to 5% across a ratio of 0.4 to 2.0, and the ' +
          'three-literal relaxation is wrongly negative on 46 of 100 formulas at twenty clauses and ' +
          '93 of 100 at thirty, while never once being wrongly positive. That asymmetry is the ' +
          'shape of the P/NP boundary at its narrowest visible point: two literals make an ' +
          'implication and three do not, and no encoding repairs the difference.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
