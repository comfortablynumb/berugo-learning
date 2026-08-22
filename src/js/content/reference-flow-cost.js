/** Reference entries for minimum-cost flow and bipartite matching (M14.4-M14.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'min-cost-flow': {
      summary: 'Two ordered objectives, successive shortest paths made practical by potentials that ' +
        'are Johnson reweighting again, cycle cancelling from the other direction, and the ' +
        'instance that has no minimum at all.',
      intuition: 'The answer is a curve rather than a number, and it is convex — which is exactly ' +
        'what makes sending one unit at a time optimal.',
      formulation: {
        equations: [
          {
            label: 'The problem',
            expr: 'minimise sum of cost(e)·f(e) subject to capacity, conservation and |f| = k',
            terms: [
              { sym: 'ordered', meaning: 'the value is a constraint; the cost is what is minimised' },
              { sym: 'convex', meaning: 'the marginal cost of the k-th unit never falls' },
              { sym: 'measured', meaning: 'costs 1 / 2 / 4 / 9 / 18 / 28 for values 1 to 6; marginals 1 / 1 / 2 / 5 / 9 / 10' }
            ]
          },
          {
            label: 'Potentials',
            expr: 'reduced cost c′(u,v) = c(u,v) + p(u) − p(v) >= 0',
            terms: [
              { sym: 'why', meaning: 'residual backward arcs carry negative cost, and Dijkstra cannot see them' },
              { sym: 'the transform', meaning: 'a shortest path under c′ is a shortest path under c' },
              { sym: 'first pass', meaning: 'Bellman-Ford, once, only if the input has negative costs' },
              { sym: 'measured', meaning: 'non-negative costs: 7 Dijkstra runs, 0 Bellman-Ford passes, 582 relaxations' }
            ]
          },
          {
            label: 'Three routes to the same optimum on a 6-worker assignment',
            expr: 'cost 28, confirmed against all 720 permutations',
            terms: [
              { sym: 'successive shortest paths', meaning: '7 Dijkstra runs, 582 relaxations' },
              { sym: 'cycle cancelling', meaning: '4 cycles, 5 Bellman-Ford passes — reaches the optimum from above' },
              { sym: 'Hungarian', meaning: '6 phases, 45 comparisons, with a valid dual certificate' }
            ]
          },
          {
            label: 'Optimality',
            expr: 'a flow is minimum-cost for its value iff its residual has no negative-cost cycle',
            terms: [
              { sym: 'why check this', meaning: 'it is a property of the flow, so it validates a flow from any source' },
              { sym: 'the wrong check', meaning: 'scanning reduced costs against a potential the algorithm only maintained where it searched' }
            ]
          },
          {
            label: 'Negative costs, and the case with no answer',
            expr: 'negative arcs are fine; a negative CYCLE with capacity is unbounded',
            terms: [
              { sym: 'measured', meaning: '14 vertices with 5 negative arcs: both methods give 3 units at cost 81' },
              { sym: 'unbounded', meaning: 'the correct output is a refusal with the cycle attached, not a number' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The marginal cost never decreases',
          why: 'Convexity is the correctness argument for augmenting one unit at a time.',
          breaks: 'A falling marginal means the flow was not optimal for the previous value.'
        },
        {
          name: 'Every reduced cost on the residual graph is non-negative where the potential is maintained',
          why: 'It is what lets Dijkstra replace Bellman-Ford after the first pass.',
          breaks: 'A negative reduced cost makes Dijkstra silently return a non-shortest path.'
        },
        {
          name: 'The residual graph of an optimal flow has no negative-cost cycle',
          why: 'It is the characterisation, and it is checkable without the algorithm.',
          breaks: 'A wrong cycle-cancelling slice produces a cost BELOW the true optimum, which is impossible.'
        },
        {
          name: 'An unbounded instance is refused, not solved',
          why: 'A negative-cost cycle with spare capacity has no minimum to return.',
          breaks: 'Without the check the loop never terminates and the caller sees a hang, not an error.'
        }
      ],
      complexity: [
        { operation: 'successive shortest paths', average: 'O(f · (E + V log V)) with potentials', worst: '7 Dijkstra runs, 582 relaxations at 6 workers' },
        { operation: 'the first Bellman-Ford pass', average: 'O(VE), and only when costs can be negative', worst: '0 passes on the non-negative assignment; 1 on the general network' },
        { operation: 'cycle cancelling', average: 'O(cycles · VE)', worst: '4 cycles, 5 Bellman-Ford passes for the same answer' },
        { operation: 'Hungarian algorithm', average: 'Θ(n³)', worst: '6 phases, 45 comparisons against 720 permutations' },
        { operation: 'brute-force permutation search', average: 'Θ(n!)', worst: '720 at n = 6; 40 320 at n = 8 and unusable beyond' },
        { operation: 'optimality check', average: 'O(VE) — one negative-cycle detection', worst: 'independent of the algorithm that produced the flow' }
      ],
      failureModes: [
        {
          symptom: 'The reported cost is below the true optimum.',
          cause: 'Cycle cancelling cancelled arcs that were not on the cycle — a slicing error in the parent walk.',
          fix: 'Return the cycle, not the tail leading into it; a cost below the optimum is impossible for a valid flow.'
        },
        {
          symptom: 'The optimality check reports violations on a provably optimal flow.',
          cause: 'It scanned reduced costs against potentials that are only maintained on reached vertices.',
          fix: 'Check the theorem — no negative-cost residual cycle — instead.'
        },
        {
          symptom: 'The solver never returns.',
          cause: 'The instance has a negative-cost cycle with spare capacity and therefore no minimum.',
          fix: 'Detect it in the Bellman-Ford pass that already runs, and refuse with the cycle attached.'
        },
        {
          symptom: 'Dijkstra returns a path that is not cheapest.',
          cause: 'A residual backward arc has negative cost and no potential was applied.',
          fix: 'Maintain potentials from the previous distances; that is the whole reason they exist.'
        }
      ],
      inTheWild: [
        { system: 'Transportation and logistics planning', how: 'the transportation problem is min-cost flow with supplies and demands' },
        { system: 'Ride and delivery dispatch', how: 'assignment at scale, solved as a min-cost flow with capacities above one' },
        { system: 'Multi-object tracking in vision', how: 'detections across frames linked by a min-cost flow' },
        { system: 'Ad and inventory allocation', how: 'budgets as capacities, bids as negative costs' }
      ],
      sources: [
        { title: 'Network Flows: Theory, Algorithms, and Applications', where: 'Ahuja, Magnanti, Orlin — Prentice Hall, 1993' },
        { title: 'The Hungarian method for the assignment problem', where: 'Harold Kuhn — Naval Research Logistics, 1955' },
        { title: 'Efficient algorithms for shortest paths in sparse networks', where: 'Donald Johnson — JACM, 1977 — the reweighting' },
        { title: 'Combinatorial Optimization: Algorithms and Complexity', where: 'Papadimitriou, Steiglitz — Prentice Hall, 1982' }
      ]
    },

    'bipartite-matching': {
      summary: 'Berge\'s augmenting path in three implementations, the crossover between them ' +
        'measured rather than quoted, Koenig\'s cover and Hall\'s witness from the same search, and ' +
        'stable matching solving a different problem with a measurable winner.',
      intuition: 'The bipartite structure is what makes marking a vertex once safe; an odd cycle ' +
        'destroys that argument, and that is the whole of the next section.',
      formulation: {
        equations: [
          {
            label: 'Berge',
            expr: 'a matching is maximum iff no augmenting path exists',
            terms: [
              { sym: 'augmenting path', meaning: 'unmatched endpoints, alternating free and matched edges' },
              { sym: 'why flipping gains one', meaning: 'the path has one more free edge than matched ones' },
              { sym: 'measured', meaning: '9 vertices a side, 25 edges: a perfect matching of 9 in 9 augmenting paths' }
            ]
          },
          {
            label: 'Three routes to the same number',
            expr: 'Kuhn = Hopcroft-Karp = unit-capacity maximum flow',
            terms: [
              { sym: 'Kuhn', meaning: '9 paths, 45 edge examinations — O(VE)' },
              { sym: 'Hopcroft-Karp', meaning: '9 paths in 2 phases, 57 examinations — O(E·sqrt(V))' },
              { sym: 'flow', meaning: 'value 9, 280 arc visits — integrality does the conversion' }
            ]
          },
          {
            label: 'The crossover, 8 to 256 vertices a side',
            expr: 'the asymptotically better algorithm loses below about 32',
            terms: [
              { sym: 'phases', meaning: '2 / 2 / 2 / 3 / 4 / 4 against sqrt(V) of 2.83 / 4.00 / 5.66 / 8.00 / 11.31 / 16.00' },
              { sym: 'Kuhn edges', meaning: '20 / 110 / 315 / 1 375 / 4 184 / 12 426' },
              { sym: 'Hopcroft-Karp edges', meaning: '58 / 173 / 324 / 1 044 / 2 458 / 4 530' },
              { sym: 'saving', meaning: '2.74x at 256 a side; 2.9x WORSE at 8' }
            ]
          },
          {
            label: 'Koenig and Hall',
            expr: 'max matching = min vertex cover; a perfect matching exists iff |N(S)| >= |S| for all S',
            terms: [
              { sym: 'the cover', meaning: 'left vertices NOT reached by the alternating search, plus right vertices that were' },
              { sym: 'measured', meaning: 'matching 9 = cover 9, verified against all 25 edges; independent set 18 − 9 = 9' },
              { sym: 'the witness', meaning: 'on the deficiency shape, 3 left vertices with 2 neighbours between them' },
              { sym: 'not general', meaning: 'both statements are false on a non-bipartite graph, where vertex cover is NP-hard' }
            ]
          },
          {
            label: 'Gale-Shapley, 8 people a side, identical preferences both ways',
            expr: 'both stable; the proposing side wins, measurably',
            terms: [
              { sym: 'left proposing', meaning: '18 proposals, 10 rejections, 0 blocking pairs, left-side total rank 10' },
              { sym: 'right proposing', meaning: '21 proposals, 13 rejections, 0 blocking pairs, left-side total rank 20' },
              { sym: 'overlap', meaning: 'only 3 of 8 pairs survive the switch' },
              { sym: 'proposer-optimality', meaning: '5 left-side people strictly better off, 0 worse, when they propose' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'matchLeft and matchRight agree, and every pair is a real edge',
          why: 'A matching algorithm fails by pairing a vertex twice or by inventing an edge.',
          breaks: 'A size that matches a reference while the structure is broken passes every value-only test.'
        },
        {
          name: 'The vertex cover touches every edge and has the matching\'s size',
          why: 'Koenig gives the equality; the checker gives the construction.',
          breaks: 'A cover one vertex short leaves an edge uncovered and nothing else notices.'
        },
        {
          name: 'A Hall witness has strictly fewer neighbours than members',
          why: 'That inequality is the proof; without it the set is just a set.',
          breaks: 'Reporting the reachable set without checking the inequality claims a proof that may not hold.'
        },
        {
          name: 'A stable matching has zero blocking pairs',
          why: 'It is the only property Gale-Shapley guarantees, so it is the only one worth asserting.',
          breaks: 'Asserting maximum weight instead tests a property the algorithm never claimed.'
        }
      ],
      complexity: [
        { operation: 'Kuhn', average: 'O(VE)', worst: '45 edge examinations at 9 a side; 12 426 at 256' },
        { operation: 'Hopcroft-Karp', average: 'O(E·sqrt(V))', worst: '57 examinations at 9 a side; 4 530 at 256, in 4 phases' },
        { operation: 'matching via maximum flow', average: 'the cost of the flow, on 2n + 2 vertices', worst: '280 arc visits for the same answer as 45' },
        { operation: 'Koenig cover extraction', average: 'O(V + E) — one alternating search', worst: 'free, once the matching exists' },
        { operation: 'Hall witness', average: 'O(V + E)', worst: 'found directly; the exponentially many subsets are never enumerated' },
        { operation: 'Gale-Shapley', average: 'O(n²) proposals', worst: '18 and 21 proposals at 8 a side; the bound is 64' }
      ],
      failureModes: [
        {
          symptom: 'Hopcroft-Karp is slower than Kuhn and the conclusion is that it was implemented wrongly.',
          cause: 'Below about 32 vertices a side the per-phase layering pass is pure overhead.',
          fix: 'Measure the crossover for your sizes; asymptotics do not name a size.'
        },
        {
          symptom: 'A vertex-cover routine built on Koenig gives wrong answers.',
          cause: 'The graph is not bipartite; the theorem does not apply and the problem is NP-hard.',
          fix: 'Test bipartiteness explicitly rather than assuming it from the data model.'
        },
        {
          symptom: '"No perfect matching" is reported and nobody can act on it.',
          cause: 'The search returned a boolean instead of the violating set.',
          fix: 'Return the Hall witness; it names exactly which demands to relax.'
        },
        {
          symptom: 'A matching platform is accused of favouring one side.',
          cause: 'It does — Gale-Shapley is optimal for the proposing side, by theorem.',
          fix: 'Decide the proposing side deliberately, or use a weighted formulation instead.'
        }
      ],
      inTheWild: [
        { system: 'The National Resident Matching Program', how: 'Gale-Shapley, with the proposing side switched to applicants in 1998' },
        { system: 'School choice systems (Boston, New York)', how: 'deferred acceptance, chosen for strategy-proofness on the proposing side' },
        { system: 'Ad-slot and inventory allocation', how: 'bipartite matching, usually with capacities and therefore as flow' },
        { system: 'Kidney exchange', how: 'general rather than bipartite matching, which is why 14.6 exists' }
      ],
      sources: [
        { title: 'Two theorems in graph theory', where: 'Claude Berge — PNAS, 1957 — the augmenting-path characterisation' },
        { title: 'An n^{5/2} algorithm for maximum matchings in bipartite graphs', where: 'Hopcroft, Karp — SIAM J. Computing, 1973' },
        { title: 'College Admissions and the Stability of Marriage', where: 'Gale, Shapley — American Mathematical Monthly, 1962' },
        { title: 'Graphok es matrixok', where: 'Denes Koenig, 1931 — matching equals vertex cover on bipartite graphs' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
