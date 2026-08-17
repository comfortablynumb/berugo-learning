# M14 — Graph algorithms II: flow, matching, connectivity, spectral

> **Track** Algorithms · **Depends on** M13 · **Sections** 10 · **Effort** L

**Outcome.** The second half of graph theory, where problems that look unrelated (scheduling, image
segmentation, assignment, satisfiability, ranking) all turn out to be one of four graph problems
wearing different clothes. The modelling skill — recognising the reduction — is the point.

**Shared machinery introduced.** `machines/flow-lab.js` — residual-graph engine with augmenting-path
tracing, cut extraction and invariant checking; `machines/reduction-lab.js` — a framework that
takes a problem instance, applies a named reduction, solves the target problem and maps the
solution back, showing both instances side by side. The reduction lab is reused heavily in M20.

---

## Sections

### 14.1 Maximum flow
- **Covers** — flow networks, capacity and conservation constraints, residual graphs and back
  edges, Ford–Fulkerson and its termination problem with irrational capacities, Edmonds–Karp's
  BFS rule and O(VE²), Dinic's level graph and blocking flows, capacity scaling, and complexity on
  unit-capacity graphs.
- **Demo** — flow builder with the residual graph shown beside the flow graph; augmenting paths
  highlighted as they are found, with a per-algorithm counter for paths and phases.
- **Diagram** — mermaid diagram of a residual edge pair (forward capacity, backward flow).
- **Lab** — implement Dinic's level-graph BFS and blocking-flow DFS; tests assert the max-flow value
  matches Edmonds–Karp on randomised networks and that flow conservation holds at every vertex.
- **Senior insight** — the back edge is the entire algorithm: it is what lets a later path *undo* an
  earlier bad routing decision, which is why greedy path-filling without residuals is wrong.

### 14.2 Minimum cut and its applications
- **Covers** — the max-flow min-cut theorem with proof sketch, extracting the cut from the final
  residual graph, s-t cuts versus global min cut (Stoer–Wagner), project selection / maximum closure,
  image segmentation as a cut, and bipartite vertex cover via König's theorem.
- **Demo** — image segmentation on a small pixel grid: pixel affinities become capacities, the min
  cut separates foreground and background, and the learner can paint seeds and watch the cut move.
- **Diagram** — mermaid diagram of a cut partitioning the network with the crossing edges marked.
- **Lab** — implement min-cut extraction by reachability in the residual graph; tests assert the cut
  capacity equals the max-flow value on all fixtures.
- **Senior insight** — "which items do I select to maximise profit given prerequisites" is maximum
  closure, which is a min cut. Recognising that reduction is worth more than any flow
  implementation.

### 14.3 Push-relabel and modern flow
- **Covers** — preflows, height functions, push and relabel operations, the highest-label and
  FIFO selection rules, gap and global-relabel heuristics, why push-relabel is faster in practice
  than augmenting paths, and a short honest note on recent almost-linear-time results being
  theoretical.
- **Demo** — push-relabel with per-node excess and height displayed; operation counters split into
  pushes, relabels and saturating versus non-saturating pushes, compared with Dinic on the same
  network.
- **Diagram** — mermaid diagram of the height constraint h(u) ≤ h(v) + 1 licensing a push.
- **Lab** — implement the gap heuristic and measure the relabel reduction; tests assert the same
  max-flow value with and without the heuristic.
- **Senior insight** — the heuristics are not optional extras; without global relabelling
  push-relabel is often slower than Dinic, which is why textbook implementations disappoint.

### 14.4 Minimum-cost flow and assignment
- **Covers** — cost per unit flow, successive shortest paths with Johnson potentials, why
  Bellman–Ford is needed only once, cycle cancelling, the transportation and assignment problems,
  the Hungarian algorithm, and modelling supply/demand and lower bounds.
- **Demo** — task-assignment solver: a cost matrix becomes a bipartite flow network, the successive
  shortest paths animate, and the reduced-cost matrix updates as potentials change.
- **Diagram** — mermaid diagram of the potential transform making reduced costs non-negative.
- **Lab** — implement successive shortest paths with potentials; tests assert the optimal cost
  matches the Hungarian algorithm on randomised cost matrices.
- **Senior insight** — potentials are Johnson's reweighting again (M13). Once you see that, min-cost
  flow stops being a new algorithm and becomes Dijkstra in a loop.

### 14.5 Bipartite matching
- **Covers** — matchings, augmenting paths, the Hungarian/Kuhn method, Hopcroft–Karp's phase
  structure and O(E√V), König's theorem linking matching and vertex cover, Hall's marriage
  condition, and stable matching (Gale–Shapley) as a different problem with a different notion of
  optimal.
- **Demo** — bipartite matcher with augmenting paths animated; a toggle to Hopcroft–Karp shows
  multiple disjoint augmenting paths found per phase and the phase count against √V; a
  Gale–Shapley view shows proposals and the resulting side-optimality.
- **Diagram** — mermaid bipartite graph with an alternating path highlighted.
- **Lab** — implement Hopcroft–Karp's BFS phase and DFS augmentation; tests assert the matching size
  equals Kuhn's on randomised bipartite graphs and that the phase count is O(√V).
- **Senior insight** — Gale–Shapley is stable, not maximum-weight, and it is optimal for the
  proposing side. Every "matching platform" design argument turns on those two facts.

### 14.6 General matching and weighted matching
- **Covers** — why augmenting paths fail on odd cycles, blossoms and contraction, Edmonds's
  algorithm at the level of "what it does and why it is hard", the Hungarian algorithm for weighted
  bipartite matching in full, and Christofides using perfect matching (linking to M19).
- **Demo** — blossom contraction visualised: an odd cycle is contracted, the augmenting path found
  in the contracted graph, then lifted back and expanded.
- **Diagram** — mermaid diagram of an odd cycle contracting to a single pseudo-vertex.
- **Lab** — implement the Hungarian algorithm (O(n³) version) for square cost matrices; tests assert
  optimality against brute-force permutation search for n ≤ 8.
- **Senior insight** — general matching is where "just extend the bipartite algorithm" stops
  working, and knowing *why* (odd cycles admit no bipartition of the alternating path) is more
  useful than being able to implement blossoms.

### 14.7 2-SAT and implication graphs
- **Covers** — clauses as implications, the implication graph and its symmetry, satisfiability by
  SCC (x and ¬x in the same component), extracting an assignment from the reverse topological
  order, and the modelling patterns (at-most-one, either-or, forced choices).
- **Demo** — a small scheduling instance encoded as 2-SAT: the implication graph is drawn, SCCs are
  computed live, and the satisfying assignment is read off the condensation order; adding a
  conflicting constraint shows the contradiction component.
- **Diagram** — mermaid graph of clause (a ∨ b) as the two implications ¬a → b and ¬b → a.
- **Lab** — implement 2-SAT solving on top of the SCC module from M13; tests assert satisfiability
  agreement with a brute-force checker for n ≤ 20 variables and validate returned assignments.
- **Senior insight** — 2-SAT is polynomial and 3-SAT is NP-complete; the boundary is exactly the
  point where the implication graph stops capturing the clause. That is the cleanest available
  intuition for where hardness begins.

### 14.8 Colouring, cliques and independent sets
- **Covers** — chromatic number and its hardness, greedy colouring and the ordering effect
  (degeneracy ordering, Welsh–Powell), interval graphs and perfect graphs where greedy is optimal,
  register allocation as colouring (previewing M29), maximum clique with Bron–Kerbosch and pivoting,
  and independent set/clique/vertex cover as the same problem three ways.
- **Demo** — colour a graph with selectable orderings and see the colour count differ; a
  Bron–Kerbosch run with the recursion tree shown, pivoting on and off, with node counts compared.
- **Diagram** — mermaid diagram of the complement mapping clique to independent set.
- **Lab** — implement degeneracy ordering and greedy colouring; tests assert the colour count is at
  most degeneracy + 1 and equals the optimum on interval-graph fixtures.
- **Senior insight** — register allocation is graph colouring with spilling as the escape hatch;
  when M29 arrives, this section is why the compiler's allocator looks the way it does.

### 14.9 Planarity, layout and drawing
- **Covers** — Euler's formula and its consequences (E ≤ 3V − 6), Kuratowski's characterisation,
  planarity testing at a high level, straight-line embeddings, force-directed layout
  (Fruchterman–Reingold), Sugiyama layered layout for DAGs, edge-crossing minimisation, and what
  mermaid's own layout engine is doing.
- **Demo** — layout playground: the same graph laid out by force-directed, layered and circular
  algorithms, with crossing counts and iteration-by-iteration energy plotted for the force model.
- **Diagram** — mermaid diagram of a layered assignment with dummy nodes for long edges.
- **Lab** — implement one Fruchterman–Reingold iteration (repulsion, attraction, cooling); tests
  assert the total energy decreases monotonically under a fixed schedule, that the layout is
  deterministic for a given seed, and that the final crossing count is within a stated factor of
  `d3-force`'s on the same graph — the library is the baseline to beat, not the implementation.
- **Senior insight** — every diagram in this platform is laid out by one of these algorithms;
  understanding the layered algorithm is what lets you fix an unreadable generated diagram instead
  of moving nodes by hand.

### 14.10 Spectral methods, centrality and communities
- **Covers** — adjacency and Laplacian matrices, eigenvalues and what the Fiedler vector says about
  connectivity, spectral bisection, random walks and stationary distributions, PageRank with
  damping and its power-iteration solution, HITS, betweenness (Brandes) and closeness centrality,
  and modularity-based community detection (Louvain).
- **Demo** — one social-style graph analysed four ways: PageRank power iteration with per-iteration
  convergence plotted, betweenness computed by Brandes, spectral bisection by the Fiedler vector,
  and Louvain communities coloured, with modularity reported.
- **Diagram** — mermaid diagram of the random-walk interpretation of PageRank with a damping jump.
- **Lab** — implement PageRank by power iteration with dangling-node handling; tests assert the
  result sums to one, matches a linear solve within tolerance, and converges in the expected number
  of iterations for a given damping factor.
- **Senior insight** — dangling nodes are the detail that breaks naive PageRank implementations:
  without redistributing their mass the vector leaks probability and the ranking drifts.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/max-flow.js` | Ford–Fulkerson, Edmonds–Karp, Dinic, scaling, cut extraction |
| `src/js/algorithms/push-relabel.js` | Preflow, heights, gap and global relabel heuristics |
| `src/js/algorithms/min-cost-flow.js` | SSP with potentials, cycle cancelling |
| `src/js/algorithms/matching.js` | Kuhn, Hopcroft–Karp, Hungarian, Gale–Shapley, blossom |
| `src/js/algorithms/two-sat.js` | Implication graph, SCC-based solving, assignment extraction |
| `src/js/algorithms/coloring.js` | Greedy orderings, degeneracy, Bron–Kerbosch |
| `src/js/algorithms/layout.js` | Force-directed, layered, circular, crossing counts |
| `src/js/algorithms/spectral.js` | Laplacian, power iteration, PageRank, Brandes, Louvain |
| `src/js/machines/flow-lab.js` | Residual engine, invariant checks, augmenting traces |
| `src/js/machines/reduction-lab.js` | Named reductions with forward and backward mapping |
| `src/js/viz/flow-view.js` | Flow/residual dual rendering with capacity labels |

---

## Acceptance criteria

- [ ] All flow algorithms agree on max-flow value across every generated network, and flow
      conservation plus capacity constraints are asserted at every vertex and edge.
- [ ] The extracted min cut's capacity equals the max flow in every test.
- [ ] Matching sizes agree between Kuhn, Hopcroft–Karp and a flow-based solver; Hungarian
      optimality is verified by brute force for small n.
- [ ] 2-SAT results agree with a brute-force checker, and every satisfiable instance's returned
      assignment is validated clause by clause.
- [ ] PageRank sums to 1.0 within 1e-9, handles dangling nodes, and matches a direct linear solve.
- [ ] Every reduction in `reduction-lab` round-trips: solving the target problem and mapping back
      yields a valid solution to the source instance, asserted in tests.

---

## Sources

- Cormen et al. — chapters 26 and 34
- Dinic — the blocking-flow algorithm; Edmonds, Karp — *Theoretical improvements in algorithmic efficiency*
- Goldberg, Tarjan — *A new approach to the maximum-flow problem*
- Hopcroft, Karp — *An n^5/2 algorithm for maximum matchings in bipartite graphs*
- Edmonds — *Paths, trees, and flowers* (blossom algorithm)
- Aspvall, Plass, Tarjan — the linear-time 2-SAT algorithm
- Brandes — *A faster algorithm for betweenness centrality*
- Page, Brin, Motwani, Winograd — *The PageRank citation ranking*
- Blondel et al. — *Fast unfolding of communities in large networks* (Louvain)
- Fruchterman, Reingold — *Graph drawing by force-directed placement*
