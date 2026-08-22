/** Reference entries for the first graph sections (M13.1-M13.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'graph-representations': {
      summary: 'Adjacency list, adjacency matrix and CSR priced in bytes on the same graph, plus BFS ' +
        'and DFS measured against each other — identical work, a 20× difference in peak memory — and ' +
        'the edge classification an undirected walk can and cannot produce.',
      intuition: 'The representation is a memory-layout decision, not a complexity one: all three are ' +
        'linear to traverse and only one of them scans sequentially.',
      formulation: {
        equations: [
          {
            label: 'Memory',
            expr: 'list ≈ 24·arcs + 8n · matrix = 8n² · csr = 4(n+1) + 16·arcs',
            terms: [
              { sym: 'measured at n = 400, m = 760', meaning: '38.8 KB · 1.2 MB · 25.3 KB, a density of 0.95%' },
              { sym: 'crossover', meaning: 'matrix beats CSR above m = n²/4 — 40 000 edges here, or 50% density' },
              { sym: 'complete graph', meaning: 'matrix 1 250.0 KB against CSR 2 495.3 KB — 0.50×' }
            ]
          },
          {
            label: 'Traversal cost',
            expr: 'both BFS and DFS are Θ(n + m); the peak differs',
            terms: [
              { sym: 'work', meaning: '400 nodes visited and 1 520 edges examined by both' },
              { sym: 'BFS peak', meaning: '20 — the widest level of the grid' },
              { sym: 'DFS peak', meaning: '400 — the longest root-to-node path' }
            ]
          },
          {
            label: 'Edge classification',
            expr: 'tree, back, forward, cross — undirected walks produce only the first two',
            terms: [
              { sym: 'measured', meaning: '399 tree + 361 back + 0 forward + 0 cross = 760 edges' },
              { sym: 'back edge', meaning: 'points at an ancestor still on the stack, which is exactly a cycle' },
              { sym: 'skip rule', meaning: 'drop the second sighting by EDGE id, never by parent vertex' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every edge is classified exactly once',
          why: 'The four class counts must sum to the edge count, or a sighting was dropped or double-counted.',
          breaks: 'Skipping by parent vertex silently discards parallel edges, and the sum comes up short.'
        },
        {
          name: 'BFS and DFS visit the same vertices and examine the same edges',
          why: 'They differ in order, not in work; unequal counters mean one of them is skipping something.',
          breaks: 'A visited check placed on pop rather than on push lets DFS enqueue a vertex many times.'
        },
        {
          name: 'A conversion preserves the graph',
          why: 'CSR, matrix and adjacency list must agree on every neighbour set.',
          breaks: 'Forgetting the reverse arc for an undirected edge halves the graph in one representation only.'
        }
      ],
      complexity: [
        { operation: 'adjacency list build', average: 'Θ(n + m)', worst: '38.8 KB at n = 400, m = 760' },
        { operation: 'matrix build', average: 'Θ(n²)', worst: '1.2 MB regardless of m — 49.38× CSR here' },
        { operation: 'CSR build', average: 'Θ(n + m)', worst: '25.3 KB, one contiguous read per scan' },
        { operation: 'edge test', average: 'Θ(1) on a matrix, Θ(degree) otherwise', worst: 'Θ(n) on a star’s hub' },
        { operation: 'BFS or DFS', average: 'Θ(n + m)', worst: 'peak 20 against peak 400 on the same grid' },
        { operation: 'bipartite check', average: 'Θ(n + m), one extra array', worst: 'returns the odd cycle, not a boolean' }
      ],
      failureModes: [
        {
          symptom: 'A traversal overflows the stack on one customer’s data and nowhere else.',
          cause: 'Recursive DFS on a graph whose longest path is long — a chain, a list, a deep nesting.',
          fix: 'Use an explicit stack. The depth is the path length, and no graph guarantees it is small.'
        },
        {
          symptom: 'A bridge or cycle check misbehaves only on graphs with duplicate links.',
          cause: 'The parent is tracked as a vertex, so a second edge to the same parent is discarded.',
          fix: 'Carry an edge id on every adjacency entry and skip by id.'
        },
        {
          symptom: 'Memory blows up on a graph that is not large.',
          cause: 'An adjacency matrix on a sparse graph — n² cells however few edges there are.',
          fix: 'Measure the density first; above about 50% the matrix is genuinely smaller.'
        },
        {
          symptom: 'A traversal is far slower than its complexity suggests.',
          cause: 'An array-of-arrays adjacency list, so every vertex is a fresh allocation and a cache miss.',
          fix: 'Convert to CSR: the neighbour scan becomes a sequential read of two typed arrays.'
        }
      ],
      inTheWild: [
        { system: 'SNAP, igraph, NetworKit', how: 'CSR is the internal representation in every serious graph library' },
        { system: 'LLVM', how: 'the control-flow graph is an adjacency structure walked depth-first for dominance' },
        { system: 'Linux fs/ and package managers', how: 'dependency resolution is a topological walk over an adjacency list' },
        { system: 'GPU graph frameworks (Gunrock, cuGraph)', how: 'CSR is mandatory — a coalesced read is the whole point' }
      ],
      sources: [
        { title: 'Introduction to Algorithms, chapter 22', where: 'Cormen, Leiserson, Rivest, Stein' },
        { title: 'Depth-first search and linear graph algorithms', where: 'Robert Tarjan — SIAM Journal on Computing, 1972' },
        { title: 'Direction-optimizing breadth-first search', where: 'Beamer, Asanović, Patterson — SC 2012' },
        { title: 'The GAP Benchmark Suite', where: 'Beamer, Asanović, Patterson, 2015 — the CSR-versus-list measurements' }
      ]
    },

    'topological-order': {
      summary: 'Kahn and DFS finish order, validated edge by edge; cycle *extraction* rather than ' +
        'detection; and the critical path that bounds a build below whatever the worker count is.',
      intuition: 'The order is not the deliverable. The guarantee that every predecessor is finished ' +
        'when you reach a vertex is, and it makes several hard problems into one sweep.',
      formulation: {
        equations: [
          {
            label: 'The order',
            expr: 'v1..vn with every edge (vi, vj) satisfying i < j; exists iff the graph is acyclic',
            terms: [
              { sym: 'Kahn', meaning: 'in-degree counting; the ready set is literally "what can build now"' },
              { sym: 'DFS', meaning: 'reversed finish order; a back edge is the cycle witness' },
              { sym: 'validation', meaning: 'all 40 packages placed with every edge pointing forwards, by three methods' }
            ]
          },
          {
            label: 'Scheduling',
            expr: 'makespan(k) >= max(total work / k, critical path)',
            terms: [
              { sym: 'total work', meaning: '118 units over 40 packages' },
              { sym: 'critical path', meaning: '25 units over a chain of 7 — the floor no k breaks' },
              { sym: 'measured', meaning: '118, 59, 36, 25, 25, 25 at 1, 2, 4, 8, 16, 64 workers' },
              { sym: 'ceiling', meaning: '118 / 25 = 4.72×, reached at 8 workers; at most 11 ever busy' }
            ]
          },
          {
            label: 'Failure',
            expr: 'a cycle blocks the order; return the cycle, not null',
            terms: [
              { sym: 'Kahn', meaning: 'stalls with 37 of 40 placed; the other 3 are the cycle and its downstream' },
              { sym: 'DFS', meaning: 'aborts at the back edge with 0 placed' },
              { sym: 'the witness', meaning: '34 → 19 → 34, verified edge by edge against the graph' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every edge points forwards in the returned order',
          why: 'It is the definition, it costs one pass, and it is the only check that means anything.',
          breaks: 'A decrement applied to the wrong vertex produces an order that is plausible and invalid.'
        },
        {
          name: 'A reported cycle is a genuine cycle',
          why: 'A parent walk that stops too early returns a path with a loop on the end, not a loop.',
          breaks: 'Consecutive vertices in the reported cycle are not joined by a real edge.'
        },
        {
          name: 'The makespan never falls below the critical path',
          why: 'Dependent tasks cannot overlap, whatever the worker count.',
          breaks: 'A scheduler reporting less has started a task before a predecessor finished.'
        }
      ],
      complexity: [
        { operation: 'Kahn', average: 'Θ(n + m)', worst: 'all 40 packages, one pass' },
        { operation: 'DFS finish order', average: 'Θ(n + m)', worst: 'same, and it yields the back edge free' },
        { operation: 'lexicographically smallest order', average: 'Θ(n log n + m)', worst: 'a heap over the ready set' },
        { operation: 'longest path in a DAG', average: 'Θ(n + m) — one sweep', worst: 'NP-hard on a general graph' },
        { operation: 'DAG shortest paths', average: 'Θ(n + m), negative weights allowed', worst: 'no priority queue at all' },
        { operation: 'counting all orders', average: 'Θ(2ⁿ·n) by subset DP', worst: 'run only below 15 vertices' }
      ],
      failureModes: [
        {
          symptom: 'A build tool says "circular dependency detected" and nothing else.',
          cause: 'The cycle was detected and discarded; only the boolean was returned.',
          fix: 'Keep the parent map and return the cycle. It costs one array and saves an afternoon.'
        },
        {
          symptom: 'More CI machines do not make the build faster.',
          cause: 'The makespan has reached the critical path; the constraint is the graph, not the fleet.',
          fix: 'Measure the critical path and the peak busy count, then split the packages on that chain.'
        },
        {
          symptom: 'Downstream analysis returns a plausible number on a cyclic graph.',
          cause: 'Longest path, DAG shortest paths and level assignment all assume acyclicity silently.',
          fix: 'Have them refuse when no order exists rather than computing over a partial one.'
        },
        {
          symptom: 'Two runs of the same build produce different orders and different flaky failures.',
          cause: 'Any valid order was taken, and a hidden dependency was satisfied by luck in one of them.',
          fix: 'Use the lexicographic order for reproducibility, and treat the flake as a missing edge.'
        }
      ],
      inTheWild: [
        { system: 'make, Bazel, Gradle', how: 'the dependency graph is topologically ordered and the ready set drives the workers' },
        { system: 'npm, pip, apt', how: 'install order is a topological sort, and cycles are reported as the cycle' },
        { system: 'Spreadsheet engines', how: 'recalculation order is a topological sort; a circular reference is the cycle report' },
        { system: 'Airflow, Dagster, Temporal', how: 'task DAGs scheduled exactly this way, with the critical path as the SLA floor' }
      ],
      sources: [
        { title: 'Topological sorting of large networks', where: 'A. B. Kahn — Communications of the ACM, 1962' },
        { title: 'Introduction to Algorithms, section 22.4', where: 'Cormen, Leiserson, Rivest, Stein' },
        { title: 'Bounds on multiprocessing timing anomalies', where: 'R. L. Graham — SIAM Journal on Applied Mathematics, 1969' },
        { title: 'Build Systems à la Carte', where: 'Mokhov, Mitchell, Peyton Jones — ICFP 2018' }
      ]
    },

    'strongly-connected': {
      summary: 'Tarjan and Kosaraju computing the same partition by different routes, the condensation ' +
        'that is always a DAG and is verified rather than assumed, and the four unrelated-looking ' +
        'problems that are this one computation.',
      intuition: 'Mutual reachability is an equivalence relation, so it partitions the vertices — and ' +
        'collapsing the classes cannot leave a cycle behind, because a cycle would have merged them.',
      formulation: {
        equations: [
          {
            label: 'Tarjan',
            expr: 'low[v] = min(index[v], low of children, index of neighbours still on the stack)',
            terms: [
              { sym: 'root test', meaning: 'v is a component root iff low[v] = index[v]' },
              { sym: 'measured', meaning: '15 components from 1 pass, 60 vertices, 74 edges' },
              { sym: 'not the bridge lowlink', meaning: 'this one may follow a cross edge into an open component' }
            ]
          },
          {
            label: 'Kosaraju',
            expr: 'DFS for finish order in G, then DFS trees on Gᵀ in decreasing finish order',
            terms: [
              { sym: 'cost', meaning: '2 passes and 148 edges examined against Tarjan’s 74' },
              { sym: 'value', meaning: 'a completely different derivation, so it fails differently' },
              { sym: 'comparison', meaning: 'compare as partitions — component ids are arbitrary' }
            ]
          },
          {
            label: 'The condensation',
            expr: 'one node per component; an edge wherever any crossing exists',
            terms: [
              { sym: 'always acyclic', meaning: 'a cycle among components would make them one component' },
              { sym: 'measured', meaning: '60 vertices and 74 edges become 15 nodes and 14 edges' },
              { sym: 'random digraph', meaning: '18 components, largest 43 (71.7%), 17 singletons' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The two algorithms produce the same partition',
          why: 'Different derivations agreeing is the only available evidence that either is right.',
          breaks: 'Comparing labellings instead of partitions reports a difference where there is none.'
        },
        {
          name: 'The condensation is acyclic',
          why: 'It is a theorem, and a broken component computation produces a condensation with a cycle.',
          breaks: 'A topological sweep over the condensation fails to place every node.'
        },
        {
          name: 'Every vertex is in exactly one component',
          why: 'Mutual reachability is an equivalence relation, so the classes must cover and not overlap.',
          breaks: 'A vertex on no cycle is dropped instead of forming a singleton component.'
        }
      ],
      complexity: [
        { operation: 'Tarjan', average: 'Θ(n + m), one pass', worst: 'stack holds the whole giant component — 44 of 60 here' },
        { operation: 'Kosaraju', average: 'Θ(n + m), two passes plus the reverse graph', worst: '148 edges against 74' },
        { operation: 'condensation', average: 'Θ(n + m)', worst: '74 edges de-duplicate to 14' },
        { operation: 'acyclicity check on the condensation', average: 'Θ(components + condensed edges)', worst: '15 nodes placed' },
        { operation: '2-SAT via SCC', average: 'Θ(variables + clauses)', worst: 'unsatisfiable iff x and ¬x share a component' },
        { operation: 'incremental rebuild inside a component', average: 'the whole component, every time', worst: 'a 43-vertex component rebuilds 43 units' }
      ],
      failureModes: [
        {
          symptom: 'Component ids differ between two implementations and a test fails.',
          cause: 'The ids are arbitrary; only the grouping is the answer.',
          fix: 'Compare canonicalised partitions, not label arrays.'
        },
        {
          symptom: 'A cycle appears in the condensation.',
          cause: 'The component computation is wrong — usually a lowlink that follows the wrong edges.',
          fix: 'Verify with a topological sweep on every run in tests; the theorem says it cannot happen.'
        },
        {
          symptom: 'Bridge finding written by copying the SCC lowlink reports nonsense.',
          cause: 'The two lowlinks answer different questions and differ in which edges may be followed.',
          fix: 'Keep them in separate modules and never name both variables `low`.'
        },
        {
          symptom: 'Incremental builds always rebuild a huge set of modules.',
          cause: 'Those modules form one strongly connected component and cannot be separated.',
          fix: 'Report the component. Breaking one edge in it is the only fix, and SCC says which edges.'
        }
      ],
      inTheWild: [
        { system: 'Go and Rust compilers', how: 'recursive function groups are SCCs of the call graph, type-checked as a unit' },
        { system: 'Deadlock detectors (JVM, database lock managers)', how: 'a cycle in the waits-for graph is a component of size above one' },
        { system: 'SAT and CP solvers', how: '2-SAT is solved entirely by SCC over the implication graph' },
        { system: 'madge, dependency-cruiser, Bazel', how: 'import-cycle detection is an SCC over the module graph' }
      ],
      sources: [
        { title: 'Depth-first search and linear graph algorithms', where: 'Robert Tarjan — SIAM Journal on Computing, 1972' },
        { title: 'The Design and Analysis of Computer Algorithms', where: 'Aho, Hopcroft, Ullman — Kosaraju’s algorithm as presented by Sharir' },
        { title: 'A linear-time algorithm for testing the truth of certain quantified boolean formulas', where: 'Aspvall, Plass, Tarjan — Information Processing Letters, 1979' },
        { title: 'Path-based depth-first search for strong and biconnected components', where: 'Harold N. Gabow — Information Processing Letters, 2000' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
