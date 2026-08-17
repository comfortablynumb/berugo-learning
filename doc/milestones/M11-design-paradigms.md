# M11 — Algorithm design paradigms

> **Track** Algorithms · **Depends on** M10 · **Sections** 9 · **Effort** M

**Outcome.** The transferable part of algorithms: recognising which shape a problem has. Each
section teaches a paradigm, the proof technique that certifies it, and the tell-tale signs in a
problem statement — including the counter-cases where the obvious paradigm is wrong.

**Shared machinery introduced.** `machines/search-tree-lab.js` — a generic state-space explorer
(states, successors, pruning predicate, bound function) that drives the backtracking,
branch-and-bound and meet-in-the-middle demos with node counts, pruning ratios and a live search
tree; `viz/search-tree-view.js` for the incremental tree rendering.

---

## Sections

### 11.1 Exhaustive search and the art of pruning
- **Covers** — the state space as a tree, enumeration orders, feasibility pruning, symmetry
  breaking, canonical forms, constraint propagation, and measuring pruning as a ratio rather than
  guessing at it.
- **Demo** — n-queens with individually toggleable prunings (column, diagonal, symmetry, most-
  constrained-first); the search tree grows live and the node count per configuration is tabulated.
- **Diagram** — mermaid tree showing a subtree cut by a pruning predicate.
- **Lab** — add symmetry breaking to a provided n-queens solver; tests assert the solution count is
  still correct for n = 6..10 and that node visits drop by the expected factor.
- **Senior insight** — pruning multiplies, it does not add: two independent prunings that each cut
  half the tree together cut three quarters, which is why a weak second constraint is still worth
  adding.

### 11.2 Divide and conquer
- **Covers** — the split/solve/combine shape, when combining is the hard part, Karatsuba
  multiplication, Strassen's matrix multiplication and its numerical caveats, closest pair of
  points in O(n log n), counting inversions with merge sort, and divide and conquer on trees
  (centroid decomposition).
- **Demo** — Karatsuba against schoolbook multiplication on large integers: recursion tree drawn,
  digit-multiplication counts plotted against n with the n^1.585 curve overlaid.
- **Diagram** — mermaid diagram of Karatsuba's three recursive products.
- **Lab** — implement Karatsuba over digit arrays; tests assert equality with BigInt products for
  randomised operands up to 10 000 digits.
- **Senior insight** — the crossover with schoolbook multiplication is around 30–100 digits
  depending on the machine, and every real bignum library switches there. Asymptotics decide the
  algorithm; measurement decides the threshold.

### 11.3 Greedy algorithms and exchange arguments
- **Covers** — the greedy-choice property, optimal substructure, proving correctness by exchange
  argument or by staying-ahead, interval scheduling, fractional knapsack, Huffman coding as a
  greedy proof, and the classic greedy failures (0/1 knapsack, coin systems that are not canonical).
- **Demo** — interval scheduling with four selectable greedy criteria (earliest start, shortest,
  fewest conflicts, earliest finish); each runs on the same instance and only one is optimal, with
  the counter-example instance generated on demand for the other three.
- **Diagram** — mermaid diagram of an exchange argument transforming an optimal solution into the
  greedy one.
- **Lab** — implement the "earliest finish time" scheduler and a coin-system checker that decides
  whether greedy change-making is optimal for a given denomination set.
- **Senior insight** — greedy is the paradigm most often applied without proof, and the failure is
  silent: it returns a valid, sub-optimal answer that nobody notices until someone computes the
  true optimum.

### 11.4 Matroids: when greedy is provably right
- **Covers** — independence systems, the hereditary and exchange properties, matroids and the
  Rado–Edmonds theorem, graphic matroids explaining Kruskal, uniform and partition matroids,
  matroid intersection at a high level, and how to test a problem for the structure.
- **Demo** — matroid checker: define a ground set and an independence oracle, and the tool searches
  for a violation of the exchange property, exhibiting the counter-example when the structure is
  not a matroid.
- **Diagram** — mermaid diagram of the exchange property between two independent sets.
- **Lab** — implement the generic greedy algorithm over an independence oracle and run it on the
  graphic matroid to reproduce Kruskal; tests assert the MST weight matches a reference.
- **Senior insight** — this is the answer to "how do I know greedy works here": if the feasible
  sets form a matroid, it always does, and if they do not, one counter-example ends the argument.

### 11.5 Backtracking
- **Covers** — systematic enumeration with undo, permutations, combinations, subsets and their
  generation orders, constraint satisfaction (Sudoku, graph colouring, cryptarithms), forward
  checking, arc consistency, MRV and degree heuristics, and iterative deepening.
- **Demo** — Sudoku solver with selectable heuristics (naive, MRV, forward checking, AC-3): backtrack
  count and solve time per configuration on the same hard puzzle, with the search tree rendered.
- **Diagram** — mermaid flowchart of choose / explore / unchoose with the constraint check.
- **Lab** — implement forward checking on top of a provided naive solver; tests assert identical
  solutions and a backtrack count reduced by at least an order of magnitude on the hard fixture.
- **Senior insight** — the undo step is where backtracking bugs live: any state mutated on the way
  down must be restored exactly, which is the argument for the persistent structures in M09.

### 11.6 Branch and bound
- **Covers** — bounding functions and admissibility, best-first versus depth-first exploration,
  incumbent solutions, the gap between bound and incumbent as a progress measure, LP relaxation as
  a bound, and 0/1 knapsack and TSP as worked instances.
- **Demo** — knapsack by branch and bound: the tree with each node's bound and the incumbent
  updating; a bound-quality slider (fractional versus trivial bound) shows the explored-node count
  collapse.
- **Diagram** — mermaid tree with bounds annotated and pruned nodes greyed.
- **Lab** — implement the fractional-relaxation bound for 0/1 knapsack; tests assert optimality
  against exhaustive search on small instances and a node count below the exhaustive count.
- **Senior insight** — the bound *is* the algorithm. A tighter bound is worth more than any
  micro-optimisation of the traversal, and a wrong bound produces confidently wrong answers.

### 11.7 Two pointers, sliding windows and monotonic structures
- **Covers** — the two-pointer invariant and why it is linear, sliding windows with a shrink
  condition, monotonic deques for window minima, monotonic stacks for next-greater-element and
  largest-rectangle, and the amortisation argument that each element enters and leaves once.
- **Demo** — window explorer: an array with the window drawn, the monotonic deque contents shown,
  and per-element push/pop counts totalling 2n, making the amortisation visible.
- **Diagram** — mermaid diagram of a monotonic stack processing a histogram.
- **Lab** — implement `maxInSlidingWindow` with a monotonic deque and `largestRectangle` with a
  monotonic stack; tests assert results against brute force and a total operation count below 3n.
- **Senior insight** — the tell is a quadratic solution whose inner loop only ever moves forward.
  That is the signal to collapse it into two pointers.

### 11.8 Meet in the middle and bidirectional search
- **Covers** — splitting an exponential search in half, 2^(n/2) subset enumeration, sorting and
  binary searching the halves, bidirectional BFS and its √ improvement, the memory cost, and
  hashing collisions of partial states.
- **Demo** — subset-sum with n = 40 solved by brute force (aborted, with the projected time shown)
  and by meet in the middle (completed), with the two halves' generated sets and the merge step
  animated.
- **Diagram** — mermaid diagram of the two frontiers meeting.
- **Lab** — implement meet-in-the-middle subset sum returning the achievable sum closest to a
  target; tests assert optimality against brute force for n ≤ 22 and completion within budget for
  n = 40.
- **Senior insight** — halving the exponent is the difference between 2⁴⁰ (impossible) and 2²⁰
  (instant); the price is memory, and knowing that trade exists is worth more than the technique.

### 11.9 Offline and batch processing
- **Covers** — answering queries out of order, sqrt decomposition, Mo's algorithm and its ordering
  argument, offline dynamic connectivity, small-to-large merging, batch processing to amortise
  setup, and the boundary between offline and online (which M21 formalises).
- **Demo** — range-query workload answered online with a segment tree and offline with Mo's
  algorithm; pointer-movement totals plotted against the theoretical O((n + q)√n).
- **Diagram** — mermaid diagram of query blocks sorted by (block, right endpoint).
- **Lab** — implement Mo's ordering and the add/remove element hooks for a distinct-count query;
  tests assert results equal brute force and total pointer moves stay within the bound.
- **Senior insight** — "can I see all the queries first" is a question worth asking explicitly; the
  answer changes the achievable complexity class, and in batch systems the answer is usually yes.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/karatsuba.js`, `strassen.js`, `closest-pair.js` | Divide and conquer instances |
| `src/js/algorithms/greedy.js` | Interval scheduling, fractional knapsack, coin-system canonicity check |
| `src/js/algorithms/matroid.js` | Independence oracle, generic greedy, exchange-property checker |
| `src/js/algorithms/backtracking.js` | N-queens, Sudoku, graph colouring, CSP heuristics, AC-3 |
| `src/js/algorithms/branch-and-bound.js` | Knapsack and TSP with pluggable bounds |
| `src/js/algorithms/two-pointers.js` | Windows, monotonic deque and stack |
| `src/js/algorithms/meet-in-middle.js` | Subset enumeration and merge, bidirectional BFS |
| `src/js/algorithms/mo-algorithm.js` | Offline query ordering and pointer moves |
| `src/js/machines/search-tree-lab.js` | Generic state-space explorer with metrics |
| `src/js/viz/search-tree-view.js` | Incremental search-tree rendering |

---

## Acceptance criteria

- [ ] Each paradigm section includes at least one instance where the paradigm *fails*, with the
      counter-example generated by code rather than asserted in prose.
- [ ] The matroid checker finds a real exchange-property violation for a supplied non-matroid.
- [ ] Backtracking heuristics are compared on the same fixtures with node counts, and the claimed
      order-of-magnitude reduction is asserted in a test.
- [ ] Branch and bound proves optimality against exhaustive search on all small instances.
- [ ] Monotonic-structure labs assert the amortised operation bound, not just correctness.
- [ ] Mo's algorithm results match brute force and stay within the pointer-move bound.

---

## Sources

- Cormen et al. — chapters 4, 15, 16
- Kleinberg, Tardos — *Algorithm Design*, the greedy proof techniques
- Edmonds — *Matroids and the greedy algorithm*
- Karatsuba, Ofman — *Multiplication of many-digital numbers by automatic computers*
- Strassen — *Gaussian elimination is not optimal*
- Russell, Norvig — *Artificial Intelligence: A Modern Approach*, constraint satisfaction chapters
- Horowitz, Sahni — *Computing partitions with applications to the knapsack problem* (meet in the middle)
