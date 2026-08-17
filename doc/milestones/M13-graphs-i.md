# M13 — Graph algorithms I: traversal, order, shortest paths, spanning trees

> **Track** Algorithms · **Depends on** M04, M05 · **Sections** 10 · **Effort** L

**Outcome.** The graph toolkit an engineer actually reaches for — dependency ordering, reachability,
shortest paths, spanning trees — built on one graph engine with a real map dataset alongside the
synthetic ones, so route planning is a route and not an abstraction.

**Shared machinery introduced.** `machines/graph-lab.js` — graph representations (adjacency list,
matrix, CSR), generators (grid, random, scale-free, road-like, DAG, adversarial) and an algorithm
runner with node/edge visit counters and step traces; `viz/graph-view.js` — force-directed and
fixed-layout SVG/Canvas graph renderer with per-step highlighting, reused by M14, M24, M32, M48
and M54.

---

## Sections

### 13.1 Representations and traversal
- **Covers** — adjacency list, matrix and CSR with their memory and locality trade-offs, directed
  versus undirected, weighted and multigraphs, BFS and DFS, recursive versus explicit-stack DFS,
  edge classification (tree, back, forward, cross), discovery and finish times, connected components,
  and bipartiteness testing by two-colouring.
- **Demo** — the same graph in three representations with memory reported for each; BFS and DFS
  step through with the frontier or stack drawn and edges coloured by class as they are classified.
- **Diagram** — mermaid graph with edges coloured by DFS classification.
- **Lab** — implement iterative DFS producing the same edge classification as the recursive version;
  tests assert identical classifications on randomised digraphs and no stack overflow at 10⁶ nodes.
- **Senior insight** — CSR is what every serious graph library stores, because traversal becomes a
  sequential scan of two typed arrays; the adjacency-list-of-arrays version is 5–10× slower for the
  same asymptotics.

### 13.2 Topological order and DAGs
- **Covers** — Kahn's algorithm with in-degrees, DFS finish-time ordering, cycle detection as the
  failure mode, lexicographically smallest order with a heap, counting topological orders, longest
  path in a DAG, and DAG shortest paths in linear time.
- **Demo** — build-dependency simulator: a package graph is topologically ordered, a cycle is
  introduced and the algorithm reports the exact cycle; a parallel-schedule view shows the critical
  path and the achievable makespan with k workers.
- **Diagram** — mermaid DAG with levels and the critical path highlighted.
- **Lab** — implement Kahn's algorithm returning either an order or the cycle that blocks it; tests
  assert a valid order on DAGs and a genuine cycle (verified edge by edge) on cyclic inputs.
- **Senior insight** — "returns null on a cycle" is a useless error; returning the cycle is what
  makes a build tool debuggable, and it costs one parent map.

### 13.3 Strongly connected components
- **Covers** — the SCC definition, Kosaraju's two passes, Tarjan's single pass with lowlink and the
  stack, Gabow's variant, the condensation DAG, and why SCC is the preprocessing step for 2-SAT,
  deadlock detection and module-cycle analysis.
- **Demo** — Tarjan step-through with index, lowlink and the stack shown per node; the condensation
  DAG builds alongside as components pop.
- **Diagram** — mermaid graph with SCCs boxed and the condensation drawn beside it.
- **Lab** — implement Tarjan's algorithm; tests assert component membership matches Kosaraju's on
  10³ randomised digraphs, including self-loops and single-node components.
- **Senior insight** — import-cycle detectors, deadlock detectors and "why can't this be
  incrementally built" analyses are all the same SCC computation over different graphs.

### 13.4 Bridges, articulation points and biconnectivity
- **Covers** — cut vertices and cut edges, the lowlink criterion for each, biconnected components
  via the edge stack, the block-cut tree, 2-edge and 2-vertex connectivity, and the network-
  reliability reading of the result.
- **Demo** — network resilience view: removing a highlighted bridge splits the graph on screen; the
  block-cut tree is drawn alongside and updates as edges are added.
- **Diagram** — mermaid graph with bridges dashed and articulation points ringed.
- **Lab** — implement bridge finding with the lowlink test, handling parallel edges correctly;
  tests assert results against a brute-force "remove each edge and recount components" oracle.
- **Senior insight** — the parallel-edge case is the classic bug: tracking the parent *vertex*
  instead of the parent *edge* reports a bridge that is not one.

### 13.5 Shortest paths I: BFS, 0-1 BFS and Dijkstra
- **Covers** — BFS as unweighted shortest path, 0-1 BFS with a deque, Dijkstra's greedy invariant
  and its proof, why negative edges break it (with a concrete counter-example), lazy versus indexed
  priority queues (from M05), the k-shortest-paths variant, and path reconstruction with parent
  pointers.
- **Demo** — grid and road-graph pathfinding with the settled set, frontier and relaxation counts
  animated; a negative-edge toggle produces a wrong answer and the demo explains which invariant
  broke.
- **Diagram** — mermaid diagram of the relaxation step with the invariant stated.
- **Lab** — implement Dijkstra with lazy deletion and path reconstruction; tests assert distances
  match Bellman–Ford on randomised non-negative graphs and that the returned path has the reported
  cost.
- **Senior insight** — Dijkstra with a negative edge does not error; it returns a plausible wrong
  distance. Any graph whose weights can go negative (refunds, rebates, deltas) needs Bellman–Ford
  or a potential transform.

### 13.6 Shortest paths II: negative weights and all pairs
- **Covers** — Bellman–Ford with early exit, negative-cycle detection and extraction, SPFA and its
  worst case, Johnson's algorithm with reweighting potentials, Floyd–Warshall and its triple loop
  order, transitive closure, and the all-pairs memory wall.
- **Demo** — currency-arbitrage detector: a rate graph transformed by −log, with the negative cycle
  found and the resulting profit computed to show it is real; Floyd–Warshall's matrix updates
  animated by k.
- **Diagram** — mermaid diagram of Johnson's reweighting making all edges non-negative.
- **Lab** — implement negative-cycle *extraction* (not just detection) from Bellman–Ford's parent
  array; tests assert the returned cycle has negative total weight and is a genuine cycle.
- **Senior insight** — the loop order in Floyd–Warshall (k outermost) is not a style choice; swap it
  and the algorithm silently computes something that is not the shortest path.

### 13.7 Heuristic search: A* and friends
- **Covers** — admissibility and consistency and the difference in consequences, A* as Dijkstra with
  a potential, the Manhattan/Euclidean/Chebyshev heuristics, weighted A* trading optimality for
  speed, IDA* for memory-bounded search, bidirectional A* and its meeting condition, and landmark
  (ALT) heuristics from triangle inequality.
- **Demo** — grid pathfinding with a heuristic selector and a weight slider: nodes expanded, path
  cost and optimality gap reported for each; an inadmissible heuristic visibly returns a suboptimal
  path.
- **Diagram** — mermaid diagram of f = g + h with the expansion order implied.
- **Lab** — implement A* with a pluggable heuristic and an ALT heuristic from precomputed landmark
  distances; tests assert optimality with admissible heuristics and a lower expansion count than
  Dijkstra.
- **Senior insight** — an inconsistent but admissible heuristic still finds the optimal path, but it
  may reopen closed nodes; if you skip the reopen check for speed, you need consistency, not just
  admissibility.

### 13.8 Route planning at scale
- **Covers** — why plain Dijkstra is too slow on a continental road network, bidirectional search,
  contraction hierarchies (node ordering, shortcut edges, the upward/downward search),
  hub labelling, arc flags, preprocessing time versus query time, and the memory each technique
  costs.
- **Demo** — a road-like graph preprocessed into a contraction hierarchy: the node order and
  shortcuts are visualised, and a query compares settled-node counts for Dijkstra, bidirectional
  Dijkstra and CH.
- **Diagram** — mermaid diagram of a shortcut edge replacing a contracted node.
- **Lab** — implement node contraction with the witness search that decides whether a shortcut is
  needed; tests assert CH queries return the same distances as Dijkstra for all pairs in a
  fixture graph.
- **Senior insight** — the witness search is where CH correctness lives: adding unnecessary
  shortcuts is only slow, but skipping a necessary one is wrong, and the bug appears on one pair in
  ten thousand.

### 13.9 Minimum spanning trees
- **Covers** — the cut and cycle properties as the correctness engine, Kruskal with DSU, Prim with a
  priority queue, Borůvka and its parallel friendliness, uniqueness conditions, minimax path
  (bottleneck) via the MST, second-best MST, and Steiner trees as the NP-hard neighbour.
- **Demo** — all three algorithms on one graph with the growing forest drawn and the cut being
  exploited highlighted at each step; edge-sort cost versus heap cost reported.
- **Diagram** — mermaid diagram of the cut property justifying a safe edge.
- **Lab** — implement Borůvka's algorithm with component merging; tests assert the same total weight
  as Kruskal on randomised graphs, including graphs with duplicate weights (where tie-breaking
  matters).
- **Senior insight** — MST gives you the minimax path for free, which is the actual question in
  network design ("minimise the worst hop"), and almost nobody connects the two.

### 13.10 Trees, LCA and path queries
- **Covers** — rooting a tree, Euler tours, binary lifting for LCA in O(log n), sparse-table LCA in
  O(1) after O(n log n), the DSU-on-tree (small-to-large) technique, heavy-light decomposition for
  path queries, and distance queries via LCA.
- **Demo** — an interactive tree where selecting two nodes animates the binary-lifting jumps to
  their LCA; a heavy-light view colours chains and shows a path query decomposing into O(log n)
  segment-tree ranges.
- **Diagram** — mermaid tree with heavy edges bold and chains coloured.
- **Lab** — implement binary lifting (`up[k][v]`) with LCA and k-th ancestor; tests assert results
  against a naive climb on randomised trees, including the root and same-node cases.
- **Senior insight** — heavy-light decomposition is the general answer to "range queries on tree
  paths", and the O(log n) chain bound comes from a counting argument worth being able to state:
  every light edge halves the subtree size.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/graph-core.js` | Representations, conversions, generators, invariants |
| `src/js/algorithms/traversal.js` | BFS, DFS, edge classification, components, bipartite |
| `src/js/algorithms/topological.js` | Kahn, DFS order, cycle extraction, DAG longest path |
| `src/js/algorithms/scc.js` | Tarjan, Kosaraju, condensation |
| `src/js/algorithms/biconnectivity.js` | Bridges, articulation points, block-cut tree |
| `src/js/algorithms/shortest-paths.js` | BFS, 0-1 BFS, Dijkstra, Bellman–Ford, SPFA, Floyd, Johnson |
| `src/js/algorithms/astar.js` | A*, weighted A*, IDA*, bidirectional, ALT landmarks |
| `src/js/algorithms/contraction-hierarchies.js` | Node ordering, witness search, CH query |
| `src/js/algorithms/mst.js` | Kruskal, Prim, Borůvka, second-best, bottleneck paths |
| `src/js/algorithms/tree-queries.js` | Euler tour, binary lifting, sparse-table LCA, HLD |
| `src/js/machines/graph-lab.js` | Generators, runner, counters, step traces |
| `src/js/viz/graph-view.js` | Layouts, highlighting, incremental updates |

---

## Acceptance criteria

- [ ] Every algorithm runs against all generators including the adversarial ones, with results
      cross-checked between independent implementations (Tarjan vs Kosaraju, Kruskal vs Prim vs
      Borůvka, Dijkstra vs Bellman–Ford).
- [ ] Bridge and articulation-point results match a brute-force removal oracle, including
      multigraphs with parallel edges.
- [ ] Negative-cycle extraction returns a real cycle, verified edge by edge.
- [ ] A* with an admissible heuristic returns the same cost as Dijkstra on 10³ randomised grids;
      the weighted variant reports its measured optimality gap.
- [ ] CH queries match Dijkstra for all pairs in the fixture graph.
- [ ] LCA implementations agree with a naive climb on 10⁴ randomised queries.
- [ ] Every demo reports nodes settled and edges relaxed, so pruning claims are numbers.

---

## Sources

- Cormen et al. — chapters 22 to 25
- Tarjan — *Depth-first search and linear graph algorithms*
- Dijkstra — *A note on two problems in connexion with graphs*
- Hart, Nilsson, Raphael — *A formal basis for the heuristic determination of minimum cost paths*
- Geisberger, Sanders, Schultes, Delling — *Contraction hierarchies*
- Goldberg, Harrelson — *Computing the shortest path: A* search meets graph theory* (ALT)
- Sleator, Tarjan — path decomposition foundations for HLD
