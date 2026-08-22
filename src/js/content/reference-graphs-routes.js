/** Reference entries for heuristic search and route planning (M13.7-M13.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'heuristic-search': {
      summary: 'A* as Dijkstra with a potential; admissibility and consistency separated by their ' +
        'consequences and both checked against exact distances; the heuristic that is admissible and ' +
        'prunes nothing; ALT from landmarks; weighted A*, bidirectional search and IDA* priced.',
      intuition: 'A heuristic is only useful in proportion to how close it is to the true remaining ' +
        'cost — being a valid lower bound is a correctness property, not a performance one.',
      formulation: {
        equations: [
          {
            label: 'The queue key',
            expr: 'f(v) = g(v) + w·h(v); Dijkstra is h ≡ 0 and w = 1',
            terms: [
              { sym: 'admissible', meaning: 'h(v) <= true cost from v to the goal ⇒ the answer is optimal' },
              { sym: 'consistent', meaning: 'h(u) <= w(u, v) + h(v) on every edge ⇒ no node is ever reopened' },
              { sym: 'checked', meaning: 'both verified against a full Dijkstra from the goal, not asserted' }
            ]
          },
          {
            label: 'Measured on a weighted 40 × 40 grid, steps costing 1 to 9',
            expr: 'corner to corner, optimal cost 249, 1 600 cells',
            terms: [
              { sym: 'Dijkstra', meaning: '1 600 settled' },
              { sym: 'Manhattan ×1', meaning: 'admissible, consistent, 1 600 expanded — zero pruning' },
              { sym: 'Euclidean', meaning: 'admissible, consistent, 1 600 expanded' },
              { sym: 'ALT, 2 landmarks', meaning: 'admissible, consistent, 98 expanded — 16.33×' },
              { sym: 'Manhattan ×5 / ×9', meaning: '295 (18.47% gap) from 142 · 361 (44.98%) from 83' }
            ]
          },
          {
            label: 'Reopening',
            expr: 'admissible + inconsistent + no reopen check = a wrong answer with no error',
            terms: [
              { sym: 'reopen on', meaning: '128 — optimal — from 840 expansions with 508 genuine reopenings' },
              { sym: 'reopen off', meaning: '155 — a 21.09% gap — from 365 expansions' },
              { sym: 'consistent h', meaning: '400 expansions and 0 reopenings under either policy' },
              { sym: 'counting rule', meaning: 'a stale pop is not a reopening; separate them or the claim is untestable' }
            ]
          },
          {
            label: 'ALT, bidirectional and IDA*',
            expr: '|d(L, t) − d(L, v)| <= d(v, t) · two half-radius balls · iterative deepening on f',
            terms: [
              { sym: 'landmark sweep', meaning: '1 → 1 256 expanded · 2 → 98 · 4 → 98 · 8 → 98' },
              { sym: 'bidirectional on 80 × 80', meaning: 'centre to nearby 2.48× · centre to far corner 2.32× · corner to corner 1.01×' },
              { sym: 'IDA*', meaning: '8 × 8: 34 164 expansions against A*’s 64; 10 × 10 exhausts a 120 000 budget' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'With an admissible heuristic the returned cost equals Dijkstra’s',
          why: 'Admissibility is the optimality guarantee, and it is cheap to check at demo sizes.',
          breaks: 'An inflated heuristic returns a longer path — 18.47% longer at ×5 — and reports no error.'
        },
        {
          name: 'A consistent heuristic never reopens a node',
          why: 'f is non-decreasing along any path, so g is final when a node is popped.',
          breaks: 'Counting stale lazy-heap pops as reopenings makes this claim impossible to verify.'
        },
        {
          name: 'The returned path costs the returned distance',
          why: 'A heuristic changes the queue order and must not change the path arithmetic.',
          breaks: 'A parent left stale across a reopening produces a path that does not add up.'
        }
      ],
      complexity: [
        { operation: 'A*', average: 'Θ(m log n), expanding a corridor rather than a ball', worst: 'identical to Dijkstra when h is weak — 1 600 here' },
        { operation: 'admissibility check', average: 'Θ(n) against exact distances', worst: 'needs a full Dijkstra from the goal first' },
        { operation: 'consistency check', average: 'Θ(m) — one test per edge', worst: 'the only way to justify skipping the reopen check' },
        { operation: 'ALT preprocessing', average: 'one single-source search and n distances per landmark', worst: 'landmarks past the second bought nothing here' },
        { operation: 'weighted A*', average: 'cost at most w × optimal', worst: '44.98% over at w = 9, for 19× fewer expansions' },
        { operation: 'bidirectional search', average: 'a constant factor, query-dependent', worst: '1.01× corner to corner — its worst case' },
        { operation: 'IDA*', average: 'Θ(depth) memory', worst: '534× A*’s expansions at 8 × 8; gives up entirely at 10 × 10' }
      ],
      failureModes: [
        {
          symptom: 'A* expands as many nodes as Dijkstra.',
          cause: 'The heuristic is in the wrong units — grid steps against edge costs of 1 to 9.',
          fix: 'Build the heuristic from measured distances (ALT) rather than from geometry.'
        },
        {
          symptom: 'Paths are occasionally a few per cent too long and nothing errors.',
          cause: 'An admissible but inconsistent heuristic with the reopen check disabled.',
          fix: 'Either verify consistency edge by edge, or keep reopening enabled.'
        },
        {
          symptom: 'A benchmark shows an inflated heuristic costs nothing.',
          cause: 'It was run on unit-cost terrain, where every monotone path to the goal ties.',
          fix: 'Vary the edge weights. On a uniform grid ×5 still returns the optimum.'
        },
        {
          symptom: 'IDA* never finishes on a graph A* solves instantly.',
          cause: 'Integer weights make the threshold creep by ones, so rounds multiply.',
          fix: 'Use IDA* only where the frontier genuinely cannot be stored.'
        }
      ],
      inTheWild: [
        { system: 'Game engines and navmesh pathfinding', how: 'A* with a Euclidean or octile heuristic; weighted A* when frames matter more than optimality' },
        { system: 'OSRM, GraphHopper', how: 'ALT landmarks where geometry does not match travel time' },
        { system: 'Automated planning (Fast Downward, LAMA)', how: 'weighted A* with a bounded suboptimality parameter, reported per run' },
        { system: 'Puzzle solvers and model checkers', how: 'IDA* where the closed set would not fit in memory at all' }
      ],
      sources: [
        { title: 'A formal basis for the heuristic determination of minimum cost paths', where: 'Hart, Nilsson, Raphael — IEEE Transactions on Systems Science and Cybernetics, 1968' },
        { title: 'Depth-first iterative-deepening: an optimal admissible tree search', where: 'Richard E. Korf — Artificial Intelligence, 1985' },
        { title: 'Computing the shortest path: A* search meets graph theory', where: 'Goldberg, Harrelson — SODA 2005' },
        { title: 'Heuristic Search: Theory and Applications', where: 'Stefan Edelkamp, Stefan Schrödl — Morgan Kaufmann, 2011' }
      ]
    },

    'route-planning': {
      summary: 'Contraction hierarchies end to end: node ordering by edge difference, the witness ' +
        'search that decides every shortcut, the upward query, and an exhaustive all-pairs check — ' +
        'with both ways of breaking the witness search selectable and measured.',
      intuition: 'Preprocessing trades a bigger graph for a smaller search, and its entire correctness ' +
        'lives in one question: is there still another way round this node?',
      formulation: {
        equations: [
          {
            label: 'Contraction',
            expr: 'for each surviving pair (u, w): add u→w of weight cost(u→v→w) unless a witness exists',
            terms: [
              { sym: 'witness', meaning: 'a u→w path in the REMAINING graph of cost at most cost(u→v→w)' },
              { sym: 'bounded', meaning: 'the search is limited by distance and by hop count, for speed' },
              { sym: 'measured', meaning: 'road-like 6 × 6: 18 shortcuts, 62 → 80 edges, 1.29× growth, 28 876 witness steps' }
            ]
          },
          {
            label: 'The asymmetry that licenses every approximation',
            expr: 'false negative ⇒ slow but correct · false positive ⇒ silently wrong',
            terms: [
              { sym: 'no witness search', meaning: '492 shortcuts, 8.94× growth, 0 wrong of 1 260 pairs' },
              { sym: 'through contracted nodes', meaning: '20 shortcuts, 1.32× growth, 42 wrong of 1 260 — 20 unreachable' },
              { sym: 'hop truncation', meaning: '2 hops: 176 shortcuts · 3: 118 · 5: 84 — 0 wrong of 4 032 at every depth' }
            ]
          },
          {
            label: 'The query',
            expr: 'two searches, both moving only upward in rank, meeting at the highest node on the path',
            terms: [
              { sym: 'road-like 8 × 8', meaning: 'Dijkstra settles 64, bidirectional 42, the hierarchy 37 — all return 46' },
              { sym: 'why it is correct', meaning: 'contraction added a shortcut wherever the true path descends' },
              { sym: 'no target pruning', meaning: 'the upward search settles everything upward-reachable, which is why small graphs lose' }
            ]
          },
          {
            label: 'The scale trade',
            expr: 'preprocessing grows far faster than the query saving',
            terms: [
              { sym: '16 nodes', meaning: '10 shortcuts, 2 927 witness steps, query settles 17 against Dijkstra’s 16' },
              { sym: '144 nodes', meaning: '265 shortcuts, 864 467 witness steps, query settles 87 against 144' },
              { sym: 'ratio', meaning: '295× the preprocessing for 9× the nodes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every pair’s CH distance equals Dijkstra’s',
          why: 'The artefact outlives the build, so every later query inherits any error.',
          breaks: 'A witness search that walks contracted nodes is wrong on 3.3% of pairs and looks healthy.'
        },
        {
          name: 'Reported unreachable means genuinely unreachable',
          why: 'On a connected graph an Infinity is a louder symptom than a wrong number, and rarer.',
          breaks: '20 of 1 260 pairs on a connected road network claimed no route existed.'
        },
        {
          name: 'Truncating the witness search never changes an answer',
          why: 'Missing a witness adds a shortcut; it cannot remove a necessary one.',
          breaks: 'If shallower search ever produces a wrong answer, the search is optimistic somewhere.'
        },
        {
          name: 'The upward query and the plain search agree on the meeting cost',
          why: 'Query correctness and preprocessing correctness are the same property at two times.',
          breaks: 'A missing shortcut shows up only as a distance that is too large, on a few pairs.'
        }
      ],
      complexity: [
        { operation: 'contraction (bounded witness search)', average: 'near-linear in practice on road graphs', worst: '864 467 witness steps at 144 nodes' },
        { operation: 'contraction (no witness search)', average: 'Θ(sum of degree²)', worst: '492 shortcuts against 18 — 8.94× edge growth' },
        { operation: 'CH query', average: 'a small neighbourhood of the top of the hierarchy', worst: '37 settled against Dijkstra’s 64' },
        { operation: 'bidirectional Dijkstra', average: 'a constant factor, no preprocessing', worst: '42 settled — the right answer for a one-off query' },
        { operation: 'all-pairs verification', average: 'Θ(n) Dijkstras plus n² CH queries', worst: '4 460 pairs across six fixtures' },
        { operation: 'hub labelling', average: 'the fastest queries known', worst: 'label storage dwarfs the graph — not built here' }
      ],
      failureModes: [
        {
          symptom: 'A few routes in ten thousand are slightly too long, forever.',
          cause: 'A necessary shortcut was skipped because the witness search saw a contracted node.',
          fix: 'Pass the contracted set into the search and verify all pairs on a fixture graph.'
        },
        {
          symptom: 'Two connected places are reported unreachable.',
          cause: 'The same bug, at its loudest — the upward searches never meet.',
          fix: 'The same fix, and keep the all-pairs fixture in the test suite permanently.'
        },
        {
          symptom: 'Preprocessing takes hours and the query barely improves.',
          cause: 'The graph is too small, or has no hierarchy — a path and a barbell produce 0 shortcuts.',
          fix: 'Measure the settled counts before committing; bidirectional Dijkstra needs no build step.'
        },
        {
          symptom: 'The hierarchy is enormous and queries are slower than plain Dijkstra.',
          cause: 'The witness search is failing to find witnesses that exist — or was skipped.',
          fix: 'Check the witnesses-found counter; 0 found with many shortcuts means the search is broken.'
        }
      ],
      inTheWild: [
        { system: 'OSRM', how: 'contraction hierarchies are the default routing back end for OpenStreetMap data' },
        { system: 'GraphHopper', how: 'CH for fastest-route queries, with landmarks (ALT) for flexible ones' },
        { system: 'Bing Maps / Microsoft Research', how: 'hub labelling and customisable route planning descend from this line of work' },
        { system: 'PTV and commercial fleet routing', how: 'CH-derived preprocessing amortised over billions of queries' }
      ],
      sources: [
        { title: 'Contraction hierarchies: faster and simpler hierarchical routing in road networks', where: 'Geisberger, Sanders, Schultes, Delling — WEA 2008' },
        { title: 'Route Planning in Transportation Networks', where: 'Bast, Delling, Goldberg, Müller-Hannemann, Pajor, Sanders, Wagner, Werneck — 2016 survey' },
        { title: 'A Hub-Based Labeling Algorithm for Shortest Paths in Road Networks', where: 'Abraham, Delling, Goldberg, Werneck — SEA 2011' },
        { title: 'Customizable Route Planning', where: 'Delling, Goldberg, Pajor, Werneck — SEA 2011' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
