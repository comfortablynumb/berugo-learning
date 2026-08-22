/** Worked examples for heuristic search and route planning (M13.7-M13.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'heuristic-search': [
      {
        title: 'The admissible heuristic that saves nothing, and the one that saves 16×',
        goal: 'Measure what each heuristic actually prunes on a query where the geometry lies about ' +
          'the cost.',
        setup: 'A 40 × 40 grid whose steps cost 1 to 9, corner to corner. Every admissibility and ' +
          'consistency claim is checked against a full Dijkstra run from the goal rather than asserted.',
        steps: [
          {
            do: 'Establish the baseline with Dijkstra.',
            why: 'A* is Dijkstra with h ≡ 0, so this is the same algorithm with the term switched off.',
            work: 'cost 249, settling all 1 600 cells',
            result: 'the ball of radius 249 is the whole grid'
          },
          {
            do: 'Run A* with a unit-step Manhattan distance and check both properties.',
            why: 'It is the heuristic everybody reaches for on a grid.',
            work: 'admissible: yes. Consistent: yes. Cost 249, expanded 1 600',
            result: 'correct, consistent, and it prunes exactly nothing'
          },
          {
            do: 'Ask why, in units.',
            why: '"Admissible" says it is a lower bound; it says nothing about how tight a bound.',
            work: 'a step costs up to 9 and the estimate charges 1, so h is up to 9× too small',
            result: 'a bound so loose that f is dominated by g, which is Dijkstra'
          },
          {
            do: 'Try Euclidean, which is looser still on a four-connected grid.',
            why: 'The usual "try a different metric" move.',
            work: 'cost 249, expanded 1 600 — identical',
            result: 'a second geometric heuristic, the same zero saving'
          },
          {
            do: 'Now build an ALT heuristic from two landmarks and real distances.',
            why: 'The triangle inequality needs no geometry, only measured distances.',
            work: 'admissible: yes. Consistent: yes. Cost 249, expanded 98',
            result: '16.33× fewer expansions for the identical optimal answer'
          }
        ],
        answer: 'Manhattan and Euclidean are both admissible, both consistent, both optimal, and both ' +
          'expand all 1 600 cells — exactly what Dijkstra does. ALT with two landmarks expands 98. The ' +
          'question to ask about a heuristic is therefore never "is it admissible" alone: it is "is it ' +
          'admissible, and is it in the same units as the edge weights". Grid tutorials hide the second ' +
          'question because there the edges are distances; on anything with durations, tolls or ' +
          'transfer times, geometry answers nothing.'
      },
      {
        title: 'Buying speed with optimality, and the reopen check that is not optional',
        goal: 'Inflate the heuristic on purpose and measure the price, then show the failure that ' +
          'produces no error at all.',
        setup: 'The same weighted 40 × 40 grid for the inflation sweep; then a 20 × 20 weighted grid ' +
          'with a heuristic that is admissible and demonstrably inconsistent, run with reopening on ' +
          'and off. Finally the same inflation on a uniform grid.',
        steps: [
          {
            do: 'Inflate Manhattan by 5 and by 9 and read the cost and the expansions.',
            why: 'Weighted A* gives up admissibility for a bounded amount of error.',
            work: '×5: cost 295 from 142 expansions, an 18.47% gap. ×9: cost 361 from 83, a 44.98% gap',
            result: '11× and 19× fewer expansions, for a measured and bounded loss'
          },
          {
            do: 'Run the same inflation on a *uniform* grid of the same size.',
            why: 'This is the experiment that reports inadmissibility is free, and it is the wrong one.',
            work: '×5 returns 78 — the optimum — because every monotone route to the goal ties',
            result: 'a benchmark that would have hidden the entire trade'
          },
          {
            do: 'Now take an admissible but inconsistent heuristic on the 20 × 20 grid, reopening on.',
            why: 'Admissibility alone guarantees optimality only if closed nodes can be revisited.',
            work: 'cost 128 — optimal — from 840 expansions, with 508 genuine reopenings',
            result: 'correct, and paying for it in re-expansions'
          },
          {
            do: 'Turn the reopen check off, which is the usual optimisation.',
            why: 'It is free with a consistent heuristic and this heuristic is not consistent.',
            work: 'cost 155 against an optimal 128 — a 21.09% gap — from 365 expansions',
            result: 'faster, wrong, and nothing in the run says so'
          },
          {
            do: 'Repeat both policies with a consistent heuristic for comparison.',
            why: '"Consistent heuristics never reopen" should be a counter, not a slogan.',
            work: '400 expansions and 0 reopenings whether reopening is enabled or not',
            result: 'with consistency the policy makes no difference at all'
          }
        ],
        answer: 'This inverts the first example: there the heuristic was safe and useless, here it is ' +
          'useful and unsafe. Inflating by 5 buys 11× fewer expansions for 18.47% more cost — a trade ' +
          'you can price and choose. Dropping the reopen check buys 2.3× fewer expansions for a 21.09% ' +
          'error you cannot see, because the run reports nothing unusual. And the uniform-grid row is ' +
          'the warning about benchmarks: on unit costs the same inflation returns the optimum, so an ' +
          'experiment run only there concludes that inadmissibility is free.'
      }
    ],

    'route-planning': [
      {
        title: 'What preprocessing a road network buys',
        goal: 'Build a contraction hierarchy, price the preprocessing, and check every pair.',
        setup: 'A road-like 6 × 6 network — a grid of 36 junctions with a few fast roads, 62 edges — ' +
          'contracted in greedy edge-difference order with a bounded witness search.',
        steps: [
          {
            do: 'Contract every node and count the shortcuts.',
            why: 'A shortcut is added wherever removing a node would have lost a shortest path.',
            work: '18 shortcuts, taking 62 edges to 80 — an edge growth of 1.29×',
            result: 'the query graph is a third larger than the original'
          },
          {
            do: 'Price the witness search that decided those 18.',
            why: 'This is where essentially all the preprocessing time goes.',
            work: '70 witnesses found over 28 876 bounded-Dijkstra steps',
            result: '70 shortcuts avoided, at 413 search steps each'
          },
          {
            do: 'Look at which nodes were contracted last.',
            why: 'The top of the hierarchy is what every long query passes through.',
            work: 'the last 15% of 36 nodes are the junctions where the fast roads meet',
            result: 'the algorithm rediscovers the motorway network from a shortcut count alone'
          },
          {
            do: 'Run one query three ways on a road-like 8 × 8.',
            why: 'The query saving is the only thing the preprocessing was for.',
            work: 'all three return 46; Dijkstra settles 64 nodes, bidirectional 42, the hierarchy 37',
            result: 'the hierarchy settles 58% of what Dijkstra does'
          },
          {
            do: 'Verify every pair against Dijkstra on six fixtures.',
            why: 'A preprocessing artefact outlives the run, so sampling is not good enough.',
            work: '4 460 pairs across six fixtures, 0 wrong',
            result: 'the hierarchy is exactly as correct as plain Dijkstra'
          }
        ],
        answer: '18 shortcuts for 28 876 witness steps, taking a query from 64 settled nodes to 37 and ' +
          'agreeing with Dijkstra on all 4 460 pairs of six fixtures. Two of those fixtures — a path ' +
          'and a barbell — need zero shortcuts, because they have no hierarchy to discover; a technique ' +
          'that quietly does nothing on some inputs is worth being able to recognise before you deploy ' +
          'it.'
      },
      {
        title: 'The two ways to get the witness search wrong, and the scale at which none of this pays',
        goal: 'Break the witness search in both directions and measure each, then show the ' +
          'preprocessing curve that makes the technique a continental one.',
        setup: 'The same road-like 6 × 6 network, contracted three times: with the correct bounded ' +
          'witness search, with no witness search at all, and with one that routes through nodes that ' +
          'have already been contracted. Then a size sweep from 16 to 144 nodes.',
        steps: [
          {
            do: 'Skip the witness search entirely and shortcut every neighbour pair.',
            why: 'Failing to find a witness that exists is the safe direction of error.',
            work: '492 shortcuts instead of 18 — 8.94× edge growth — and 0 wrong of 1 260 pairs',
            result: 'a graph eight times larger, a slower query, and a perfectly correct one'
          },
          {
            do: 'Now let the witness search route through already-contracted nodes.',
            why: 'Those nodes are gone, so any route through one is a route that no longer exists.',
            work: '20 shortcuts against the correct 18 — an edge growth of 1.32× against 1.29×',
            result: 'almost exactly the right size, built in the usual time'
          },
          {
            do: 'Check every pair of that hierarchy against Dijkstra.',
            why: 'Nothing about the artefact looks wrong, so only an exhaustive check finds it.',
            work: '42 of 1 260 pairs wrong — 3.3% — and 20 of those report no route at all',
            result: 'two connected junctions declared unreachable, on 1.6% of pairs'
          },
          {
            do: 'Vary the witness search depth from 2 hops to 8 and watch the wrong column.',
            why: 'Truncation is the other approximation, and it must fall on the safe side.',
            work: '2 hops: 176 shortcuts · 3: 118 · 5: 84 · 8: 84 — and 0 of 4 032 wrong at every depth',
            result: 'shallower search means more shortcuts and a slower query, never a wrong answer'
          },
          {
            do: 'Sweep the network size and compare preprocessing against query saving.',
            why: 'This is the number that decides whether the technique is worth having at all.',
            work: '16 nodes: 2 927 witness steps · 144 nodes: 864 467 — 295× the work for 9× the nodes, ' +
              'while the query settles 87 instead of 144',
            result: 'preprocessing grows far faster than the query saving does'
          }
        ],
        answer: 'The two errors are not symmetric and that asymmetry is the whole engineering lesson. ' +
          'Skipping the search gives 492 shortcuts and zero wrong answers; letting it walk through ' +
          'contracted nodes gives 20 shortcuts — two more than correct — and 42 wrong pairs of 1 260, ' +
          'including 20 that claim two connected junctions cannot reach each other. That is why ' +
          'truncating the search by hops is fine at every depth tested and optimism never is. And the ' +
          'size sweep inverts the first example: at 295× the preprocessing for 9× the nodes, this is a ' +
          'technique for a graph queried billions of times, not for the one in front of you.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
