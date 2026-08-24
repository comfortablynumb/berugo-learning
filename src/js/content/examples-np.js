/** Worked examples for decision problems, reductions and the SAT zoo (M20.1-M20.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'decision-problems': [
      {
        title: 'Price the certificate against the search, on the side where it matters',
        goal: 'Measure the gap that defines NP by running a verifier and a search on the same ' +
          'problem, on an instance that has an answer and on one that provably does not.',
        setup: 'Hamiltonian cycle on 12 vertices at seed 3: a YES instance built around a random ' +
          'planted cycle, and a NO instance whose last vertex has degree one.',
        steps: [
          {
            do: 'Verify the planted certificate.',
            why: 'This is the cost the definition of NP is about, and it is the baseline.',
            work: 'one pass to confirm 12 distinct vertices, one to confirm 12 edges: 24 steps',
            result: '24 steps, accepted'
          },
          {
            do: 'Run the search on the SAME instance.',
            why: 'The obvious comparison, and the misleading one.',
            work: 'the backtracking walk stumbles into the planted cycle after 82 steps',
            result: '82 steps, which is 3.4× the verifier and suggests nothing is hard'
          },
          {
            do: 'Run the search on the instance with no cycle.',
            why: 'Proving absence needs exhaustion, and exhaustion is where the class lives.',
            work: 'the walk explores every extension of all 11 prefixes and returns nothing',
            result: '4 794 steps, 199.8× the verifier'
          },
          {
            do: 'Sweep the size from 8 to 15 vertices and read the two growth rates.',
            why: 'One number is a data point; a growth rate is a claim.',
            work: 'verification 16 → 30, which is 2n exactly; refutation 369 → 28 378',
            result: 'linear against a factor of about 1.96 per extra vertex'
          },
          {
            do: 'Feed each verifier a corrupted certificate and a malformed one.',
            why: 'A verifier that crashes or accidentally accepts has no meaning at all.',
            work: '8 of 8 bad certificates rejected, each with a named reason',
            result: 'the verifier is total, which is what makes "accepted" evidence'
          }
        ],
        answer: 'The definition of NP is a statement about the second and fourth columns of that ' +
          'table, not the third. Verification stays at 2n across the whole sweep; refutation ' +
          'goes from 369 steps to 28 378 over seven extra vertices. The YES-side search column ' +
          'is the trap: at 82 steps it is barely worse than the verifier, because the generator ' +
          'built a graph dense along the planted cycle and the search walked into it. Any ' +
          'benchmark that reports only planted instances is measuring its own generator.'
      },
      {
        title: 'The inverted case: four problems where the YES search is CHEAPER than the check',
        goal: 'Find the cases that make the naive comparison say the opposite of the truth, and ' +
          'read what actually separates them.',
        setup: 'The same four problems from the demo at size 12, comparing verification cost ' +
          'against the search on the planted YES instance.',
        steps: [
          {
            do: 'Compare 3-colouring’s verifier against its YES search.',
            why: 'This is the row where the naive comparison inverts.',
            work: 'verify 20 steps, search on the planted instance 13 steps',
            result: 'the search is CHEAPER than the check, by 35%'
          },
          {
            do: 'Compare the same problem on the obstructed instance.',
            why: 'The K₄ on the last four vertices is a reason a reader can check.',
            work: 'the same search costs 2 213 steps to prove no 3-colouring exists',
            result: '110.7× the verifier — the ratio the problem is actually about'
          },
          {
            do: 'Read the clique row, where the NO instance was originally too easy.',
            why: 'A sparse NO instance measures the sparsity, not the problem.',
            work: 'a graph at density 0.5 on 20 vertices asked for a clique of 8: 306 steps ' +
              'against 16 to verify',
            result: '19.1×, where the first version of this row measured 2.4×'
          },
          {
            do: 'Rank the four problems by YES-side ratio and by NO-side ratio.',
            why: 'If the two rankings disagree, only one of them is about the problem.',
            work: 'YES side: 0.65× (13 of 20), 2.1×, 3.4× (82 of 24), 627.6× (3 138 of 5). ' +
              'NO side: 19.1×, 110.7×, 199.8×, 819.2×',
            result: 'the orderings differ, and the NO column is the one that grows with size'
          }
        ],
        answer: 'Three of the four problems have a YES-side ratio in single figures and one is ' +
          'below one. Nothing about NP-completeness is visible in that column, because a planted ' +
          'instance is a construction and the search is being scored against the construction. ' +
          'On the NO side every ratio is at least 19× and the smallest of them grows with the ' +
          'instance. The lesson generalises well past this demo: when a benchmark makes a hard ' +
          'problem look easy, check whether every instance in it was generated from a known ' +
          'answer.'
      }
    ],

    reductions: [
      {
        title: 'One reduction end to end, including the step that catches the bugs',
        goal: 'Take a formula to an independent-set instance, solve it, map the answer back and ' +
          'validate it against the formula itself.',
        setup: '5 variables and 9 clauses at seed 2, reduced to independent set.',
        steps: [
          {
            do: 'Build the target: one vertex per literal occurrence, a triangle per clause, an ' +
              'edge between every complementary pair.',
            why: 'The triangles force one literal per clause; the long edges force consistency.',
            work: '9 clauses × 3 literals = 27 vertices, 9 triangles = 27 edges, plus 27 ' +
              'consistency edges = 54 edges',
            result: 'a graph on 27 vertices, asking for an independent set of size 9'
          },
          {
            do: 'Solve the target by enumeration.',
            why: 'The reduction is polynomial; the target solve is not, and this is where the ' +
              'cost went.',
            work: '10 search steps on this satisfiable instance',
            result: 'an independent set of 9 vertices, one per clause'
          },
          {
            do: 'Map the set back to an assignment.',
            why: 'Without this the reduction proves hardness and solves nothing.',
            work: 'each chosen vertex names a literal that must be true: ¬x4, ¬x3, x5, x1, ¬x2, ' +
              'x1, x1, x5, x5',
            result: 'an assignment of all 5 variables'
          },
          {
            do: 'Validate the assignment against the ORIGINAL formula.',
            why: 'A gadget of the wrong shape passes the first three steps in silence.',
            work: 'the source’s own verifier checks all 9 clauses',
            result: 'accepted — and this is the only step that could have caught a bad gadget'
          },
          {
            do: 'Repeat for the unsatisfiable source and compare the cost.',
            why: 'The NO side is where the target solve exhausts.',
            work: '10 steps on the satisfiable source against 4 662 on the unsatisfiable one',
            result: 'a factor of 466, from an instance of nine clauses'
          }
        ],
        answer: 'The whole reduction is one pass over the formula and it produced a 27-vertex ' +
          'graph; the answer came back in 10 steps and mapped to a satisfying assignment the ' +
          'formula’s own checker accepted. Two numbers are worth keeping. First, the same ' +
          'pipeline on an unsatisfiable source costs 4 662 steps rather than 10, because the ' +
          'target solver has to exhaust. Second, the validation step cost one verification and ' +
          'is the only place a wrong gadget becomes visible — which is why it belongs in the ' +
          'test suite rather than in the write-up.'
      },
      {
        title: 'The inverted case: the same source through five reductions, and where the cost lands',
        goal: 'Hold the source fixed and vary the target, to see that the reduction is free and ' +
          'the choice of target is not.',
        setup: 'The demo’s audit: every reduction in the module run on a satisfiable source and ' +
          'on an unsatisfiable one, with the mapped answer validated each time.',
        steps: [
          {
            do: 'Run all five reductions on satisfiable sources.',
            why: 'Establish that every one agrees and every mapped answer validates.',
            work: '10, 10, 221, 8 and 1 712 target-solve steps across the five',
            result: '5 of 5 agree, 5 of 5 validate'
          },
          {
            do: 'Run the three SAT reductions on the cheapest unsatisfiable 3-CNF there is.',
            why: 'Eight clauses over three variables rule out all eight assignments.',
            work: '4 662 steps through independent set, 5 279 through clique, 127 382 through ' +
              '3-colouring',
            result: 'all three answer NO, and the third costs 27× the first'
          },
          {
            do: 'Compare the target instance sizes that produced those costs.',
            why: 'The cost is a property of the target, not of the source.',
            work: 'independent set 24 vertices / 72 edges; clique 24 / 204; 3-colouring 57 / 108',
            result: 'the smallest target is not the cheapest to solve'
          },
          {
            do: 'Read the vertex-cover-to-set-cover row on the NO side.',
            why: 'Its NO instance is a budget of one, which no rule can satisfy.',
            work: '0 target-solve steps — the enumeration finds no subfamily within the budget',
            result: 'agreement and validity hold with no search at all'
          }
        ],
        answer: 'The reduction cost nothing in every row: five forward maps over instances of ' +
          'nine clauses or eight vertices, each a single pass. Everything expensive is on the ' +
          'far side, and it varies by a factor of 16 000 across the table — 8 steps for set ' +
          'cover against 127 382 for 3-colouring, on sources of comparable size. That is the ' +
          'practical content of "choose your target": the encoding is nearly free and the ' +
          'target’s solver is the entire budget, which is the argument for pointing the arrow at ' +
          'a problem somebody has spent forty years engineering a solver for.'
      }
    ],

    'sat-zoo': [
      {
        title: 'Six clause families of one size, and the node column that separates them',
        goal: 'Show that DPLL cost is a property of structure rather than of size, by holding ' +
          'the variable count fixed and changing only the shape of the clauses.',
        setup: '42 variables at seed 3, in six families: two Horn, three random 3-SAT at ' +
          'different ratios, and PHP(6).',
        steps: [
          {
            do: 'Solve the Horn instance.',
            why: 'At most one positive literal per clause means propagation alone decides it.',
            work: '85 clauses, 170 clause visits, 1 DPLL node, 0 conflicts',
            result: 'satisfiable, with no branching whatsoever'
          },
          {
            do: 'Solve the Horn instance with a contradiction added.',
            why: 'The linear algorithm has to be right on the NO side too.',
            work: '87 clauses, 86 clause visits, 1 node, 1 conflict',
            result: 'unsatisfiable, still without branching'
          },
          {
            do: 'Solve random 3-SAT at ratios 2, 4.27 and 8.',
            why: 'Same variable count, no Horn structure, and a rising constraint density.',
            work: '84, 179 and 336 clauses giving 15, 30 and 53 nodes with 1, 11 and 27 conflicts',
            result: 'branching begins, and the answer flips from SAT to UNSAT'
          },
          {
            do: 'Solve PHP(6), which has 42 variables and 133 clauses.',
            why: 'Fewer clauses than the ratio-8 instance, and a structural obstruction.',
            work: '1 439 nodes and 720 conflicts',
            result: '27× the ratio-8 instance from 40% of the clauses'
          }
        ],
        answer: 'Every row has 42 variables and the node column spans three orders of magnitude, ' +
          'from 1 to 1 439. The Horn rows never branch, because unit propagation reaches a fixed ' +
          'point that is either a model or a contradiction; the random rows branch a little; the ' +
          'pigeonhole row branches 1 439 times on fewer clauses than the ratio-8 row. Size is ' +
          'not what separates them and neither is clause count — structure is, and structure is ' +
          'not in the complexity class.'
      },
      {
        title: 'The inverted case: the pigeonhole cost is exactly 2·h! − 1, at every size',
        goal: 'Show that the pigeonhole blow-up is an exact enumeration rather than a slow ' +
          'implementation, by fitting the measured node count against a closed form.',
        setup: 'PHP(h) for h from 3 to 8, solved by the bundled DPLL with a 4 000 000-node budget.',
        steps: [
          {
            do: 'Record the formula size at each h.',
            why: 'If the formula grows fast the cost proves nothing.',
            work: '22, 45, 81, 133, 204 and 297 clauses over 12, 20, 30, 42, 56 and 72 variables',
            result: 'quadratic growth — the formula is small at every size'
          },
          {
            do: 'Record the node count at each h.',
            why: 'This is the quantity the theorem is about.',
            work: '11, 47, 239, 1 439, 10 079 and 80 639',
            result: 'a factor of about 6 per hole, on a formula growing by 50%'
          },
          {
            do: 'Divide each node count by 2·h! − 1.',
            why: 'A ratio of exactly one is a closed form rather than a curve fit.',
            work: '11/11, 47/47, 239/239, 1439/1439, 10079/10079, 80639/80639',
            result: '1.0000 in every row'
          },
          {
            do: 'Read the conflict column against h!.',
            why: 'It confirms what the search is enumerating.',
            work: '6, 24, 120, 720, 5 040 and 40 320 conflicts',
            result: 'exactly h! — one conflict per assignment of pigeons to distinct holes'
          }
        ],
        answer: 'The solver is not merely slow here: it is enumerating the h! ways to put ' +
          'pigeons into distinct holes, one permutation at a time, and hitting a conflict on ' +
          'each. That is not a defect of this implementation — Haken proved every resolution ' +
          'refutation of PHP(n) is exponential, and clause learning is resolution, so no ' +
          'CDCL solver escapes it either. The eight-hole instance has 297 clauses and costs ' +
          '80 639 nodes, and it is the standing reply to "modern solvers handle millions of ' +
          'variables".'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
