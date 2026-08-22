/** Reference entries for connectivity and shortest paths (M13.4-M13.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bridges-and-cuts': {
      summary: 'Bridges and articulation points from one lowlink pass, the biconnected blocks and the ' +
        'block-cut tree they build, and the parent-vertex bug that reports a bridge on every ' +
        'multigraph — all checked against a remove-and-recount oracle.',
      intuition: 'A bridge is an edge on no cycle, so a second route always removes one; a cut vertex ' +
        'is a different kind of fragility and a redundant cable does not remove it.',
      formulation: {
        equations: [
          {
            label: 'The lowlink test',
            expr: 'low[v] = min(disc[v], disc of ancestors via back edges, low of children)',
            terms: [
              { sym: 'bridge', meaning: 'tree edge (u, v) with low[v] > disc[u] — the subtree has no other way out' },
              { sym: 'cut vertex', meaning: 'some child with low[child] >= disc[u]; the root iff it has more than one child' },
              { sym: 'skip rule', meaning: 'ignore the arriving edge by ID, never by parent vertex' }
            ]
          },
          {
            label: 'Measured on a barbell of 40',
            expr: 'two cliques of 20 joined by one link, 381 edges',
            terms: [
              { sym: 'result', meaning: '1 bridge (0.3% of links), 2 articulation points (5.0% of nodes), 3 blocks' },
              { sym: 'one redundant link', meaning: 'bridges 1 → 0; articulation points stay at 2' },
              { sym: 'oracle', meaning: 'each of 381 edges removed and the components recounted; sets agree' }
            ]
          },
          {
            label: 'The shapes that matter',
            expr: 'path: every edge a bridge · grid: none · barbell: exactly one',
            terms: [
              { sym: 'path of 40', meaning: '39 bridges (100.0%) and 38 cut vertices (95.0%)' },
              { sym: 'path redundancy', meaning: '0 links: 39 bridges · 1: 38 · 2: 37 · 4: 35 · 8: 31' },
              { sym: 'random graphs', meaning: 'almost no bridges — testing only on them tests the empty case' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The lowlink result matches the removal oracle',
          why: 'The oracle is the definition; the linear algorithm is an optimisation of it.',
          breaks: 'The parent-vertex skip reports a bridge the oracle does not, on any multigraph.'
        },
        {
          name: 'A parallel edge can only remove a bridge, never create one',
          why: 'Adding an edge cannot disconnect anything, so the counts must be monotone.',
          breaks: 'A rising bridge count under added redundancy means the edge ids are being confused.'
        },
        {
          name: 'The block-cut structure is a forest',
          why: 'nodes − components = edges, and a broken decomposition produces a cycle.',
          breaks: 'A block claimed by the wrong cut vertex closes a loop in the tree.'
        },
        {
          name: 'A single-edge block is exactly a bridge',
          why: 'The two computations are the same one, so the counts must agree.',
          breaks: 'Different counts mean one of the two lowlink comparisons uses the wrong inequality.'
        }
      ],
      complexity: [
        { operation: 'bridges and cut vertices', average: 'Θ(n + m), one DFS', worst: 'one pass over 381 edges' },
        { operation: 'removal oracle', average: 'Θ(m·(n + m))', worst: 'run only below 400 nodes' },
        { operation: 'biconnected components', average: 'Θ(n + m) with an edge stack', worst: '3 blocks on the barbell' },
        { operation: 'block-cut tree', average: 'Θ(n + m)', worst: '5 nodes and 4 edges here' },
        { operation: 'making a graph 2-edge-connected', average: 'one added edge per bridge', worst: '39 links for a path of 40' },
        { operation: 'making it 2-vertex-connected', average: 'strictly harder — parallel edges do not help', worst: 'cut vertices unchanged at every redundancy level' }
      ],
      failureModes: [
        {
          symptom: 'A bridge is reported on a network that visibly has two links there.',
          cause: 'The DFS skips its arriving edge by parent vertex, hiding the parallel edge.',
          fix: 'Skip by edge id. Every adjacency entry in this milestone carries one for this reason.'
        },
        {
          symptom: 'Redundancy is added and nothing changes.',
          cause: 'The new links duplicate edges that were already on cycles.',
          fix: 'Duplicate the bridges specifically — those are the only edges where redundancy pays.'
        },
        {
          symptom: 'The network survives cable cuts and still fails when one machine reboots.',
          cause: 'Edge redundancy was bought; the articulation points were never addressed.',
          fix: 'Report both lists. They are different requirements with different remedies.'
        },
        {
          symptom: 'A bridge finder passes every test and fails in production.',
          cause: 'It was tested on random graphs, which at any density have almost no bridges.',
          fix: 'Test on paths, stars, barbells and multigraphs, where the answer is not empty.'
        }
      ],
      inTheWild: [
        { system: 'Network planning tools', how: 'single-point-of-failure reports are exactly bridges and cut vertices' },
        { system: 'Circuit and PCB analysis', how: 'a cut vertex in a net graph is a via whose failure isolates a region' },
        { system: 'Road resilience studies', how: 'bridge identification on road networks drives redundancy investment' },
        { system: 'Kubernetes and service-mesh topology audits', how: 'a cut vertex is a single proxy through which a zone reaches the rest' }
      ],
      sources: [
        { title: 'Depth-first search and linear graph algorithms', where: 'Robert Tarjan — SIAM Journal on Computing, 1972' },
        { title: 'Efficient algorithms for graph manipulation', where: 'Hopcroft, Tarjan — Communications of the ACM, 1973' },
        { title: 'Introduction to Algorithms, problem 22-2', where: 'Cormen, Leiserson, Rivest, Stein — articulation points and bridges' },
        { title: 'Network Reliability: Experiments with a Symbolic Algebra Environment', where: 'Colbourn, Harms — 1993' }
      ]
    },

    'shortest-paths-basics': {
      summary: 'Relaxation as the single primitive, Dijkstra’s greedy invariant and the exact ' +
        'non-negativity it needs, the lazy-heap trade measured in stale pops, 0-1 BFS with no ' +
        'comparisons at all, and a negative-edge counter-example built so that the error propagates.',
      intuition: 'Every algorithm here is the same three-line relaxation wrapped in a different rule ' +
        'about which vertex to relax out of next, and each rule has a precondition.',
      formulation: {
        equations: [
          {
            label: 'Relaxation',
            expr: 'if d[u] + w(u, v) < d[v] then d[v] = d[u] + w(u, v); parent[v] = u',
            terms: [
              { sym: 'Dijkstra', meaning: 'relax out of the closest unsettled vertex; needs w >= 0' },
              { sym: 'Bellman-Ford', meaning: 'relax everything n − 1 times; needs nothing' },
              { sym: 'DAG', meaning: 'relax in topological order; negative weights fine, no heap' }
            ]
          },
          {
            label: 'Measured on a 30 × 30 weighted grid',
            expr: '900 vertices, steps costing 1 to 9, corner to corner',
            terms: [
              { sym: 'answer', meaning: '181, agreed by Bellman-Ford, Dijkstra and SPFA with 0 disagreements' },
              { sym: 'relaxations', meaning: 'Dijkstra 3 480 · SPFA 6 516 · Bellman-Ford 20 880 over 6 rounds' },
              { sym: 'settled', meaning: '900 of 900 — the ball of radius 181 is the whole grid' },
              { sym: 'reconstruction', meaning: 'the re-walked path costs exactly 181' }
            ]
          },
          {
            label: 'The lazy heap and the deque',
            expr: 'push on improvement, discard stale pops · deque for weights in {0, 1}',
            terms: [
              { sym: 'heap traffic', meaning: '1 153 pushes and pops for 900 vertices; 253 stale — 21.9%' },
              { sym: '0-1 BFS', meaning: '0 comparisons against Dijkstra’s 1 142, identical distances' },
              { sym: 'why', meaning: 'with two weights the frontier holds two distances, so order is free' }
            ]
          },
          {
            label: 'The counter-example',
            expr: '0→1 costs 2, 0→2 costs 3, 2→1 costs −2, 1→3 costs 1',
            terms: [
              { sym: 'what happens', meaning: '1 settles at 2 and relaxes 1→3, giving d[3] = 3' },
              { sym: 'the trap', meaning: 'd[1] ends CORRECT at 1; only d[3] is wrong, at 3 against 2' },
              { sym: 'the lesson', meaning: 'the error must propagate past a settled vertex to be visible' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reconstructed path costs the reported distance',
          why: 'A distance array and a parent array can disagree, and nothing else notices.',
          breaks: 'A parent left stale after a later improvement gives a path that costs more.'
        },
        {
          name: 'Two independent implementations agree on every vertex',
          why: 'Shortest-path bugs return plausible numbers rather than throwing.',
          breaks: 'One negative edge makes Dijkstra disagree with Bellman-Ford, silently.'
        },
        {
          name: 'A settled vertex is never improved again',
          why: 'That is exactly Dijkstra’s greedy invariant, and it is checkable at test sizes.',
          breaks: 'A negative edge fires after its target has been settled; the fix is a different algorithm.'
        }
      ],
      complexity: [
        { operation: 'BFS (unweighted)', average: 'Θ(n + m)', worst: 'no comparisons at all' },
        { operation: '0-1 BFS', average: 'Θ(n + m) with a deque', worst: '0 comparisons against 1 142' },
        { operation: 'Dijkstra, lazy binary heap', average: 'Θ(m log n)', worst: '1 153 heap entries for 900 vertices' },
        { operation: 'Dijkstra, indexed heap', average: 'Θ((n + m) log n), no stale pops', worst: 'more code, and handles to maintain' },
        { operation: 'SPFA', average: 'fast in practice', worst: 'Θ(n·m) on adversarial input — 1 700 settled here' },
        { operation: 'Bellman-Ford', average: 'Θ(n·m) with early exit', worst: '6 rounds and 20 880 relaxations here' }
      ],
      failureModes: [
        {
          symptom: 'Distances are plausible and slightly too large.',
          cause: 'A negative edge somewhere — a refund, a rebate, a delta — and Dijkstra does not check.',
          fix: 'Assert non-negativity at the boundary, or use Bellman-Ford or a potential transform.'
        },
        {
          symptom: 'The returned path does not cost the returned distance.',
          cause: 'The parent pointer was not updated on the improvement that set the final distance.',
          fix: 'Re-walk the path and compare. Two lines, and it catches a whole class of bug.'
        },
        {
          symptom: 'The heap grows far beyond the vertex count.',
          cause: 'Lazy deletion pushes an entry per improvement, and a dense graph improves often.',
          fix: 'Report the stale-pop rate. Above a large fraction, an indexed heap starts to pay.'
        },
        {
          symptom: 'Early termination at the target barely helps.',
          cause: 'The search settles every vertex closer than the target — a ball, not a corridor.',
          fix: 'Add a heuristic or search from both ends; that is what the next two sections are.'
        }
      ],
      inTheWild: [
        { system: 'OSPF and IS-IS', how: 'link-state routing runs Dijkstra over the topology database on every change' },
        { system: 'OSRM, Valhalla, GraphHopper', how: 'road routing starts here and adds the techniques of section 13.8' },
        { system: 'Game pathfinding', how: '0-1 BFS handles free versus costly moves without a priority queue' },
        { system: 'Build and dataflow schedulers', how: 'DAG shortest paths with no heap, and negative weights permitted' }
      ],
      sources: [
        { title: 'A note on two problems in connexion with graphs', where: 'E. W. Dijkstra — Numerische Mathematik, 1959' },
        { title: 'Introduction to Algorithms, chapter 24', where: 'Cormen, Leiserson, Rivest, Stein' },
        { title: 'Fibonacci heaps and their uses in improved network optimization algorithms', where: 'Fredman, Tarjan — JACM, 1987' },
        { title: 'Priority Queues and Dijkstra’s Algorithm', where: 'Chen, Chowdhury, Ramachandran, Roche, Tong — UT Austin TR-07-54, 2007' }
      ]
    },

    'negative-weights': {
      summary: 'Bellman-Ford with early exit, negative-cycle *extraction* priced back into the original ' +
        'units, the Floyd-Warshall loop order that is silently wrong on a third of the matrix, and ' +
        'Johnson’s reweighting making Dijkstra legal on a graph with negative edges.',
      intuition: 'Negative weights break the greedy argument and nothing else; every technique here ' +
        'either abandons greed or reweights the graph until greed is legal again.',
      formulation: {
        equations: [
          {
            label: 'Bellman-Ford',
            expr: 'relax every edge n − 1 times; an improving n-th round proves a negative cycle',
            terms: [
              { sym: 'why n − 1', meaning: 'a shortest path has at most n − 1 edges; induction on path length' },
              { sym: 'early exit', meaning: 'a round that changes nothing ends it — 6 rounds on a 900-vertex grid' },
              { sym: 'extraction', meaning: 'walk parents back n times to land inside the cycle, then close it' }
            ]
          },
          {
            label: 'Arbitrage under −log',
            expr: 'prod(rates) > 1 ⟺ sum(−log rate) < 0',
            terms: [
              { sym: 'detection', meaning: 'proved after 4 rounds on a 4-currency table' },
              { sym: 'the loop', meaning: 'JPY → GBP → JPY, verified edge by edge, total −0.0070' },
              { sym: 'priced', meaning: 'multiplier 1.007000 — 0.70% per round trip, in the original units' }
            ]
          },
          {
            label: 'Floyd-Warshall',
            expr: 'd_k[i][j] = min(d_{k−1}[i][j], d_{k−1}[i][k] + d_{k−1}[k][j]) — k must be outermost',
            terms: [
              { sym: 'correct order', meaning: '64 000 relaxations, 0 of 1 600 cells wrong' },
              { sym: 'swapped order', meaning: 'the same 64 000 relaxations, terminates, 554 of 1 600 cells wrong' },
              { sym: 'signal', meaning: 'none — not slower, not louder, no exception' }
            ]
          },
          {
            label: 'Johnson',
            expr: 'w′(u, v) = w(u, v) + h(u) − h(v) >= 0, with h from a super-source',
            terms: [
              { sym: 'why non-negative', meaning: 'h(v) <= h(u) + w(u, v) is the triangle inequality on h' },
              { sym: 'why the answer is unchanged', meaning: 'every s→t path shifts by the same h(s) − h(t)' },
              { sym: 'measured', meaning: '5 124 relaxations against 26 520 and 64 000, on 120 edges with 7 negative' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'An extracted cycle is a genuine cycle with negative total weight',
          why: 'A parent walk that stops early yields a path with a loop on the end.',
          breaks: 'Consecutive vertices are not joined by a real edge, or the total is not negative.'
        },
        {
          name: 'Every reweighted edge is non-negative',
          why: 'It is the whole justification for running Dijkstra afterwards.',
          breaks: 'A negative reweighted edge means the potential is wrong — usually a missed direction.'
        },
        {
          name: 'All-pairs methods agree cell by cell',
          why: 'The loop-order bug produces a full, plausible, wrong matrix.',
          breaks: '554 of 1 600 cells differ, with no other symptom of any kind.'
        }
      ],
      complexity: [
        { operation: 'Bellman-Ford', average: 'Θ(n·m), early exit usually far sooner', worst: '4 rounds to prove a cycle on 4 currencies' },
        { operation: 'negative-cycle extraction', average: 'Θ(n) after detection', worst: 'n parent steps then one loop closure' },
        { operation: 'SPFA', average: 'fast in practice', worst: 'Θ(n·m); adversarial inputs are easy to build' },
        { operation: 'Floyd-Warshall', average: 'Θ(n³) time, Θ(n²) space', worst: '64 000 relaxations for 1 600 cells at n = 40' },
        { operation: 'Bellman-Ford from every vertex', average: 'Θ(n²·m)', worst: '26 520 relaxations here' },
        { operation: 'Johnson', average: 'Θ(n·m log n) after one reweighting', worst: '5 124 relaxations — 12.5× fewer than the matrix method' }
      ],
      failureModes: [
        {
          symptom: 'A cost model with refunds returns distances that are subtly too large.',
          cause: 'Dijkstra on a graph with negative edges. It does not error; it settles too early.',
          fix: 'Bellman-Ford, or Johnson’s potential if you need many sources.'
        },
        {
          symptom: 'The all-pairs matrix is wrong on a third of its cells and nothing is slow.',
          cause: 'The Floyd-Warshall loops were reordered, usually for cache reasons.',
          fix: 'k outermost, always, and a cell-by-cell test against a reference at small n.'
        },
        {
          symptom: 'The reported negative cycle is not a cycle.',
          cause: 'The parent walk started at the improved vertex, which may be downstream of the loop.',
          fix: 'Walk n parent steps before closing, and verify edge by edge against the graph.'
        },
        {
          symptom: 'All-pairs shortest paths runs out of memory before it runs out of time.',
          cause: 'n² cells is the binding constraint — 80 GB at n = 100 000.',
          fix: 'Ask whether every pair is needed; usually a handful of sources or a bitset closure will do.'
        }
      ],
      inTheWild: [
        { system: 'FX and crypto arbitrage monitors', how: 'the −log transform plus Bellman-Ford, with the cycle priced back' },
        { system: 'RIP and distance-vector routing', how: 'distributed Bellman-Ford, with count-to-infinity as its failure mode' },
        { system: 'Constraint solvers and difference logic', how: 'a system of x − y <= c is a shortest-path problem; infeasible iff a negative cycle' },
        { system: 'Network simplex and min-cost flow', how: 'Johnson’s potentials are the reduced costs the algorithm maintains' }
      ],
      sources: [
        { title: 'On a routing problem', where: 'Richard Bellman — Quarterly of Applied Mathematics, 1958' },
        { title: 'Algorithm 97: Shortest path', where: 'Robert W. Floyd — Communications of the ACM, 1962' },
        { title: 'Efficient algorithms for shortest paths in sparse networks', where: 'Donald B. Johnson — JACM, 1977' },
        { title: 'Introduction to Algorithms, chapter 25', where: 'Cormen, Leiserson, Rivest, Stein' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
