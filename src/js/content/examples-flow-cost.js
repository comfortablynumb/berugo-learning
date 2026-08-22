/** Worked examples for minimum-cost flow and bipartite matching (M14.4-M14.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'min-cost-flow': [
      {
        title: 'Assigning six workers three ways, and checking against all 720 permutations',
        goal: 'Solve an assignment problem as a flow, as a cycle-cancelling improvement and as the ' +
          'Hungarian algorithm, and verify the answer exhaustively.',
        setup: 'Six workers, six tasks, costs drawn from 1 to 20 at seed 1, as a unit-capacity ' +
          'bipartite network with a source and a sink.',
        steps: [
          {
            do: 'Run successive shortest paths.',
            why: 'One unit at a time along the cheapest residual route is the natural formulation.',
            work: 'cost 28, from 7 Dijkstra runs and 582 relaxations',
            result: 'a complete assignment'
          },
          {
            do: 'Count the Bellman-Ford passes it needed.',
            why: 'Potentials exist so that Dijkstra can be used at all, and negative costs are what forces the first pass.',
            work: '0 Bellman-Ford passes — every cost is non-negative, so no potential is needed',
            result: 'Dijkstra throughout'
          },
          {
            do: 'Start from a maximum flow instead and cancel negative-cost residual cycles.',
            why: 'The optimality theorem is "no negative residual cycle", so this reaches the optimum from above.',
            work: 'cost 28, from 4 cycles and 5 Bellman-Ford passes',
            result: 'the same answer by the opposite route'
          },
          {
            do: 'Run the Hungarian algorithm on the same matrix.',
            why: 'It is successive shortest paths with the potentials written down as row and column duals.',
            work: 'cost 28 in 6 phases and 45 comparisons, with a valid dual certificate',
            result: 'three algorithms, one number, and a proof'
          },
          {
            do: 'Enumerate every permutation.',
            why: 'Three implementations sharing a reduction can share a mistake.',
            work: 'all 720 permutations checked; the minimum is 28',
            result: 'optimality confirmed independently of every algorithm above'
          }
        ],
        answer: '28, by three algorithms and by exhaustive search. The number worth carrying is 0 — ' +
          'the Bellman-Ford count. Potentials are the reason min-cost flow is fast, and on ' +
          'non-negative costs they cost nothing at all: the algorithm is literally Dijkstra in a ' +
          'loop, which is the same reweighting M13 used for all-pairs shortest paths.'
      },
      {
        title: 'The convexity that licenses one unit at a time, and the instance with no answer',
        goal: 'Show that the marginal cost never falls, which is why the greedy is correct, and ' +
          'then show the case where there is no minimum to find.',
        setup: 'The same six-worker network, solved at every flow value from 1 to 6; then a ' +
          '14-vertex general network built with deliberately negative arc costs.',
        steps: [
          {
            do: 'Solve for a flow of value 1, then 2, and so on to 6.',
            why: 'Min-cost flow answers a question about a value; the answer is a curve, not a number.',
            work: 'cost 1, 2, 4, 9, 18, 28',
            result: 'six different problems with six different answers'
          },
            {
            do: 'Take the differences.',
            why: 'If a later unit were cheaper than an earlier one the greedy order would be wrong.',
            work: 'marginal cost 1, 1, 2, 5, 9, 10 — never falling',
            result: 'convex, which is exactly what makes successive shortest paths optimal'
          },
          {
            do: 'Build a network with negative arc costs and no negative cycle.',
            why: 'Negative costs are legal and common — they are profits — and only cycles are fatal.',
            work: '14 vertices with 5 negative arcs; both methods deliver 3 units at cost 81',
            result: 'negative costs handled, by one Bellman-Ford pass and then Dijkstra'
          },
          {
            do: 'Now add capacity to a negative-cost cycle.',
            why: 'This is the case an implementation without a check loops on for ever.',
            work: 'each of the 4 arcs on the cycle keeps its residual capacity after a lap, so the ' +
              'cost falls by the same fixed amount on every one of unboundedly many trips',
            result: 'no minimum exists; the correct output is a refusal with the cycle attached'
          }
        ],
        answer: 'Costs of 1, 2, 4, 9, 18 and 28 with marginals of 1, 1, 2, 5, 9 and 10. The ' +
          'monotone marginal is the whole correctness argument for the greedy, and it is visible in ' +
          'four numbers. The second half is the failure mode: a negative-cost cycle with spare ' +
          'capacity is not a hard instance, it is an instance with no answer, and an implementation ' +
          'that does not say so hangs.'
      }
    ],

    'bipartite-matching': [
      {
        title: 'Three derivations of one matching, and the cover that comes free',
        goal: 'Find a maximum matching three ways, read Koenig\'s minimum vertex cover off the same ' +
          'search, and verify both structurally.',
        setup: 'A random bipartite graph of 9 vertices a side, three partners each, at seed 1: 25 ' +
          'edges.',
        steps: [
          {
            do: 'Run Kuhn — one augmenting path at a time, depth-first.',
            why: 'It is the direct form of Berge\'s theorem and the baseline for everything else.',
            work: 'matching of 9 from 9 augmenting paths, examining 45 edges',
            result: 'a perfect matching'
          },
          {
            do: 'Run Hopcroft-Karp on the same graph.',
            why: 'It finds a whole layer of vertex-disjoint shortest augmenting paths per phase.',
            work: 'the same 9, in 2 phases, examining 57 edges — more than Kuhn',
            result: 'the asymptotically better algorithm loses here, and the table says so'
          },
          {
            do: 'Build the unit-capacity network and run a maximum flow.',
            why: 'Integrality means a flow of value k on unit capacities is k disjoint paths.',
            work: 'value 9, at 280 arc visits',
            result: 'the reduction confirmed, at six times the work of the specialised algorithm'
          },
          {
            do: 'Read the vertex cover off the alternating search.',
            why: 'Koenig says it has exactly the matching\'s size, and the construction produces it.',
            work: 'a cover of 9 — all 9 left vertices — verified to touch every one of the 25 edges',
            result: 'a second answer from the same computation'
          },
          {
            do: 'Take the complement of the cover.',
            why: 'It is a maximum independent set, by definition.',
            work: '18 − 9 = 9 vertices',
            result: 'three quantities from one search'
          }
        ],
        answer: 'A perfect matching of 9, a minimum vertex cover of 9 and a maximum independent set ' +
          'of 9, from a single alternating search. Kuhn examines 45 edges, Hopcroft-Karp 57 and the ' +
          'flow reduction 280 — the asymptotic ranking is exactly reversed at this size, which is ' +
          'the reason the next example sweeps the size instead of quoting a complexity.'
      },
      {
        title: 'Where the square root starts paying, and what Gale-Shapley is actually optimising',
        goal: 'Find the crossover between Kuhn and Hopcroft-Karp by measurement, then show that ' +
          'stable matching solves a different problem with a measurable winner.',
        setup: 'Random bipartite graphs from 8 to 256 vertices a side at three partners each; then ' +
          'eight people a side with a full random preference list each, run from both directions.',
        steps: [
          {
            do: 'Sweep the size and read the Hopcroft-Karp phase count.',
            why: 'The phase count is the entire difference between the two algorithms.',
            work: '2, 2, 2, 3, 4, 4 phases at 8, 16, 32, 64, 128 and 256 vertices a side, against ' +
              '√V of 2.83, 4.00, 5.66, 8.00, 11.31 and 16.00',
            result: 'far below the bound, and nearly flat'
          },
          {
            do: 'Compare the edge examinations.',
            why: 'This is the work, and it is where the two separate.',
            work: 'Kuhn 20, 110, 315, 1 375, 4 184, 12 426 · Hopcroft-Karp 58, 173, 324, 1 044, ' +
              '2 458, 4 530',
            result: 'the crossover is between 16 and 32 vertices a side'
          },
          {
            do: 'State the saving at each end.',
            why: 'One number without the other is an overclaim in one direction or the other.',
            work: 'at 256 a side Hopcroft-Karp saves 2.74×; at 8 a side it costs 2.9× more',
            result: 'the honest version of "O(E√V) beats O(VE)"'
          },
          {
            do: 'Now run Gale-Shapley with the left side proposing, and count blocking pairs.',
            why: 'Stability is the only guarantee the algorithm makes.',
            work: '18 proposals, 10 rejections, 0 blocking pairs',
            result: 'stable, and perfect'
          },
          {
            do: 'Run it again with the right side proposing, on identical preferences.',
            why: 'Both runs are stable, so any difference between them is about whom stability serves.',
            work: '21 proposals, 13 rejections, 0 blocking pairs — and the left side\'s total rank ' +
              'moves from 10 to 20, with only 3 of the 8 pairs surviving the switch',
            result: '5 people strictly better off and 0 worse off when they propose'
          }
        ],
        answer: 'Hopcroft-Karp costs 2.9× more at 8 vertices a side and saves 2.74× at 256, with the ' +
          'crossover in between. And on identical preferences the choice of proposing side moves ' +
          'the left side\'s aggregate rank from 10 to 20 while leaving both matchings perfectly ' +
          'stable. Proposer-optimality is not an average effect: no proposer is ever worse off, and ' +
          'that makes "who proposes" a product decision with a measurable winner.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
