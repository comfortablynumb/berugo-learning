# M12 — Dynamic programming

> **Track** Algorithms · **Depends on** M11 · **Sections** 11 · **Effort** L

**Outcome.** DP as a design discipline: choose the state, prove the recurrence, pick the evaluation
order, then optimise. Every section shows the DP table filling live, because the table is the
explanation.

**Shared machinery introduced.** `machines/dp-lab.js` — a memoisation tracer that records every
state visit, hit, miss and dependency edge, producing both a filled table view and a subproblem
DAG; `viz/dp-table-view.js` — the table renderer with dependency arrows and traceback highlighting,
used by every DP section and again in M15 and M52.

---

## Sections

### 12.1 What dynamic programming actually is
- **Covers** — optimal substructure and overlapping subproblems as the two preconditions, the
  subproblem DAG, memoisation versus tabulation, state design as the real skill, the difference
  between DP and divide and conquer, and how to count states × transitions to get the complexity
  before writing code.
- **Demo** — the same problem solved by naive recursion, memoisation and tabulation, with the call
  tree, the hit/miss trace and the filled table shown together; the recomputation count collapses
  visibly.
- **Diagram** — mermaid DAG of subproblem dependencies for a small instance.
- **Lab** — add memoisation to a provided exponential recursion via a wrapper; tests assert
  identical results and a state count matching the analytical prediction.
- **Senior insight** — "states × transitions" is the complexity, and getting it before you code is
  what stops you writing an O(n³) solution to an O(n log n) problem.

### 12.2 One-dimensional DP
- **Covers** — climbing stairs and Fibonacci as the base pattern, house robber, maximum subarray
  (Kadane) as DP in disguise, coin change (min coins and count of ways, and why the loop order
  differs), jump games, and longest increasing subsequence in O(n²) then O(n log n) with patience
  sorting.
- **Demo** — LIS solved both ways side by side: the O(n²) table and the patience-sorting piles,
  with the reconstruction path highlighted in both.
- **Diagram** — mermaid diagram of the patience-sorting piles and the predecessor links.
- **Lab** — implement O(n log n) LIS *with reconstruction* (not just the length); tests assert the
  returned subsequence is increasing, has the optimal length and is a genuine subsequence.
- **Senior insight** — the loop order in coin change is the difference between counting
  combinations and permutations, and it is a one-line change with no error message.

### 12.3 The knapsack family
- **Covers** — 0/1 knapsack, unbounded, bounded with binary splitting or a monotonic-queue
  optimisation, subset sum, equal-partition, the pseudo-polynomial caveat and what "weakly NP-hard"
  means, space reduction to one row, and reconstructing the chosen items from a reduced table.
- **Demo** — knapsack table filling cell by cell with the dependency arrows shown; a space-reduction
  toggle collapses to one row and demonstrates why reconstruction then needs a different technique.
- **Diagram** — mermaid diagram of the two incoming edges to a 0/1 knapsack cell.
- **Lab** — implement bounded knapsack with binary splitting; tests assert optimality against
  brute force on small instances and a state count below the naive expansion.
- **Senior insight** — pseudo-polynomial means the capacity is in the exponent when expressed in
  input *bits*; doubling the number of digits in the capacity doubles the runtime again.

### 12.4 Sequence alignment DP
- **Covers** — edit distance with the three operations, the alignment traceback, Damerau
  transpositions, weighted operations, LCS and its relation to diff, Hirschberg's linear-space
  divide-and-conquer, Needleman–Wunsch and Smith–Waterman for global and local alignment, and
  affine gap penalties.
- **Demo** — edit-distance grid with the traceback path drawn and the alignment printed underneath;
  a Hirschberg toggle shows the same answer computed in O(min(m, n)) space with the recursive
  splits animated.
- **Diagram** — mermaid diagram of the three predecessor cells and their operations.
- **Lab** — implement Hirschberg's algorithm returning the actual alignment; tests assert the same
  alignment cost as the full-table version and a peak memory below a threshold.
- **Senior insight** — `git diff` is an LCS problem with a heuristic on top; M15 builds Myers's
  algorithm, which beats the DP by exploiting the sparseness of real diffs.

### 12.5 Interval DP
- **Covers** — matrix-chain multiplication, optimal binary search trees, palindrome partitioning,
  burst balloons, the "iterate by interval length" evaluation order, Knuth's optimisation and its
  quadrangle-inequality precondition, and the O(n³) → O(n²) reduction it buys.
- **Demo** — matrix-chain table filled by increasing interval length with the split point k
  highlighted; enabling Knuth's optimisation narrows the k range searched, drawn as a shrinking
  band.
- **Diagram** — mermaid diagram of the interval split into [i, k] and [k+1, j].
- **Lab** — implement optimal BST cost with Knuth's optimisation; tests assert the cost equals the
  unoptimised version and that the total k-iterations drop to O(n²).
- **Senior insight** — Knuth's optimisation applies whenever the cost function satisfies the
  quadrangle inequality; checking that precondition is a five-line test, and skipping it produces
  a subtly wrong optimum.

### 12.6 Tree DP and rerooting
- **Covers** — DP over rooted trees (independent set, subtree sums, tree diameter), the child-to-
  parent evaluation order, rerooting to answer for every possible root in O(n) total, and the
  prefix/suffix trick that makes rerooting work.
- **Demo** — a tree where each node shows its DP value; clicking a node rerooting the tree and the
  values update in place, with the recomputed edges highlighted so the O(n) claim is visible.
- **Diagram** — mermaid tree annotated with down-values and up-values.
- **Lab** — implement rerooting to compute the sum of distances from every node; tests assert
  agreement with n separate BFS runs on randomised trees.
- **Senior insight** — rerooting is the tree analogue of prefix sums: compute once downward, once
  upward, and every root is answered. It turns an O(n²) "run it from each node" into O(n).

### 12.7 Bitmask DP
- **Covers** — subsets as integers, iterating submasks in O(3ⁿ) total, travelling salesman in
  O(2ⁿ·n²), assignment problems, broken-profile DP for tilings, sum over subsets (SOS) DP, and the
  memory wall at around n = 20–24.
- **Demo** — TSP over 12 cities with the (mask, last) table filled progressively and the best tour
  drawn as it improves; a memory gauge showing why n = 25 is not happening.
- **Diagram** — mermaid diagram of the mask transition adding one city.
- **Lab** — implement the submask enumeration loop and SOS DP; tests assert the SOS result matches
  brute-force subset sums for n ≤ 16.
- **Senior insight** — `for (int sub = mask; sub; sub = (sub - 1) & mask)` is the idiom worth
  memorising; the total over all masks is 3ⁿ, not 4ⁿ, and that identity is why submask DP is
  feasible at all.

### 12.8 DP on DAGs and digit DP
- **Covers** — DP over a topological order, longest path in a DAG, counting paths, DP on the
  condensation of a graph, digit DP with tight/loose state for counting numbers with a property,
  and automaton DP (counting strings accepted by a DFA, linking to M24).
- **Demo** — digit-DP explorer: state (position, tight, accumulated) shown as a table while
  counting numbers below a bound with a chosen digit property; the tight/loose branching is
  animated.
- **Diagram** — mermaid state diagram of the tight-versus-free transition.
- **Lab** — count numbers in [L, R] with no two equal adjacent digits using digit DP; tests assert
  agreement with brute force for small ranges and correctness at boundary values.
- **Senior insight** — digit DP is the standard answer to "count the numbers in a huge range with
  property P", and the tight flag is the only subtle part: it is what stops you counting past the
  bound.

### 12.9 DP optimisations
- **Covers** — the convex hull trick and Li Chao trees for linear transition costs, divide and
  conquer optimisation and its monotonicity requirement, monotonic-queue optimisation for sliding
  transitions, the Lagrangian (aliens) trick for a constrained count, and how to recognise which
  applies.
- **Demo** — the same quadratic-transition DP solved naively and with each applicable optimisation:
  transition counts plotted per method, with the hull of candidate lines drawn live for CHT.
- **Diagram** — mermaid diagram of the lower envelope of candidate lines.
- **Lab** — implement the convex hull trick for a provided cost function; tests assert identical
  DP values to the naive version and a transition count reduced to O(n).
- **Senior insight** — each optimisation has a precondition (convexity, monotone argmin, quadrangle
  inequality). Applying one without checking it gives a fast wrong answer, which is the worst kind.

### 12.10 Game DP and combinatorial games
- **Covers** — minimax over game trees, alpha-beta pruning and move ordering, win/lose state
  labelling, Nim and the XOR theorem, Sprague–Grundy numbers for sums of games, retrograde analysis
  for endgame tables, and memoised game states.
- **Demo** — a small game (Nim with configurable piles, or a take-away game) with the full state
  graph coloured by win/lose and Grundy values shown; an alpha-beta view on a tic-tac-toe tree with
  pruned branches greyed out and node counts compared to plain minimax.
- **Diagram** — mermaid game tree with alpha and beta bounds annotated per node.
- **Lab** — implement Grundy-number computation for a sum of independent games; tests assert the
  predicted winner matches an exhaustive search of the combined game.
- **Senior insight** — Sprague–Grundy turns a game that looks like it needs a huge product state
  space into a XOR of small independent ones; recognising independent components is the whole trick.

### 12.11 Probability and expectation DP
- **Covers** — expected-value recurrences, DP over probability distributions, absorbing Markov
  chains and solving for expected hitting time, systems of equations when the dependency graph has
  cycles (Gaussian elimination on the DP), memoryless assumptions, and the optimal-stopping shape
  (secretary problem).
- **Demo** — expected-value calculator for a dice/board game with the state graph drawn and the
  linear system displayed and solved when cycles make a straight recurrence impossible.
- **Diagram** — mermaid state diagram of an absorbing Markov chain with transition probabilities.
- **Lab** — compute the expected number of rolls to finish a small board game with cycles; tests
  assert the closed-form solution matches a Monte Carlo estimate within its confidence interval.
- **Senior insight** — a cyclic expectation DP is a linear system, not a recursion. Recognising
  that early is the difference between "it recurses forever" and twenty lines of elimination.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/dp-classic.js` | 1-D family, knapsack family, coin change, LIS |
| `src/js/algorithms/dp-sequence.js` | Edit distance, LCS, Hirschberg, alignment with affine gaps |
| `src/js/algorithms/dp-interval.js` | Matrix chain, optimal BST, Knuth optimisation |
| `src/js/algorithms/dp-tree.js` | Tree DP and rerooting |
| `src/js/algorithms/dp-bitmask.js` | TSP, assignment, submask iteration, SOS |
| `src/js/algorithms/dp-digit.js` | Digit DP and automaton DP |
| `src/js/algorithms/dp-optimizations.js` | CHT, Li Chao, D&C optimisation, monotonic queue, aliens trick |
| `src/js/algorithms/game-theory.js` | Minimax, alpha-beta, Grundy numbers, retrograde analysis |
| `src/js/algorithms/expectation-dp.js` | Expected values, absorbing chains, linear solve |
| `src/js/machines/dp-lab.js` | Memo tracer, state counter, dependency DAG builder |
| `src/js/viz/dp-table-view.js` | Table with dependency arrows and traceback |

---

## Acceptance criteria

- [ ] Every DP is validated against brute force on small instances, including reconstruction of the
      actual solution, not only the optimal value.
- [ ] `dp-lab` reports states visited and transitions evaluated for every demo, and each section's
      stated complexity is asserted against those counters.
- [ ] Space-reduced variants produce identical values to the full-table versions.
- [ ] Every optimisation in 12.9 asserts its precondition in code and refuses to run when it fails.
- [ ] Alpha-beta returns the same value as plain minimax on all fixtures, with a strictly lower node
      count under good move ordering.
- [ ] The expectation DP agrees with Monte Carlo within a stated confidence interval, using a seeded
      generator.

---

## Sources

- Cormen et al. — chapter 15
- Bellman — *Dynamic Programming*
- Hirschberg — *A linear space algorithm for computing maximal common subsequences*
- Knuth — *Optimum binary search trees*; Yao — the quadrangle-inequality generalisation
- Held, Karp — *A dynamic programming approach to sequencing problems*
- Berlekamp, Conway, Guy — *Winning Ways for Your Mathematical Plays* (Grundy theory)
