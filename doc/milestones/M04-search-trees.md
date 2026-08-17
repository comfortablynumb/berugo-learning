# M04 — Search trees and disjoint sets

> **Track** Data structures · **Depends on** M02 · **Sections** 10 · **Effort** L

**Outcome.** Every balanced-tree family that matters, built on one shared tree engine so they can
be compared on the same operation sequence, plus the augmentation pattern that turns a search tree
into an interval, order-statistic or range structure, and disjoint-set union with its real
analysis.

**Shared machinery introduced.** `machines/tree-lab.js` — replays one operation sequence against
every tree implementation, recording rotations, comparisons, height, node count and rebalance
events; `viz/tree-view.js` — an animated SVG tree renderer with rotation transitions, reused by
M05, M06, M12, M51.

---

## Sections

### 4.1 Binary search trees and rotations
- **Covers** — the BST invariant, search, insert, the three delete cases, successor and
  predecessor, in-order traversal as the sorted view, tree height versus node count, degeneration
  on sorted input, and the left and right rotation as the single balancing primitive.
- **Demo** — build a tree by typing keys or by choosing an input distribution; watch height grow;
  drag a node to rotate it and see the invariant preserved.
- **Diagram** — mermaid before/after of a right rotation with subtree labels A, B, C.
- **Lab** — implement `rotateRight` and `deleteNode` covering all three cases; tests assert the BST
  invariant and in-order equality with a reference sorted array after randomised operations.
- **Senior insight** — sorted insertion is not a rare adversarial case; it is what happens when you
  bulk-load from a sorted export, and it turns your O(log n) index into a linked list.

### 4.2 AVL trees
- **Covers** — the height-balance invariant, balance factors, the four rebalance cases, insertion
  needing at most one rotation and deletion needing up to O(log n), height bound
  h < 1.44 log₂(n+2), and the read-heavy workload argument.
- **Demo** — AVL builder with balance factors annotated on every node; rebalances animate, and a
  counter separates single from double rotations.
- **Diagram** — mermaid diagram of the LL, LR, RL, RR cases.
- **Lab** — implement `rebalance(node)`; property tests assert the balance invariant holds after
  every operation in a randomised 10⁵-operation sequence.
- **Senior insight** — AVL is the shallowest of the practical trees, which is exactly why it does
  the most rotation work. Read-heavy is not a slogan, it is a measurable break-even you can find in
  the tree lab.

### 4.3 Red-black trees
- **Covers** — the five colour invariants, black height, insertion recolouring cases, deletion and
  the double-black fixups, the isomorphism with 2-3-4 trees, left-leaning red-black as a
  simplification, and why standard libraries chose this family.
- **Demo** — side-by-side red-black tree and its equivalent 2-3-4 tree, updating together, so the
  colour rules stop looking arbitrary.
- **Diagram** — mermaid mapping of a 2-3-4 node to its red-black representation.
- **Lab** — implement `insertFixup`; tests assert all five invariants and a height within
  2 log₂(n+1) after randomised insertion.
- **Senior insight** — red-black wins in libraries because the *deletion* cost is bounded by O(1)
  rotations amortised, and libraries delete.

### 4.4 Treaps and randomised BSTs
- **Covers** — the heap-ordered priority trick, expected O(log n) without any balance bookkeeping,
  split and merge as the primitive operations, randomised BST insertion at the root, and treaps as
  the easiest ordered structure to implement correctly under pressure.
- **Demo** — treap with visible priorities; a seed control makes the shape reproducible; split and
  merge animated as the two operations everything else is built from.
- **Diagram** — mermaid diagram of `split(key)` producing two treaps.
- **Lab** — implement `split` and `merge`, then build insert, delete and range extraction on top;
  tests assert the BST and heap invariants and the expected height bound over many seeds.
- **Senior insight** — split/merge treaps give you order-statistics, range reverse and rope-like
  concatenation for about eighty lines. It is the highest power-to-weight ordered structure.

### 4.5 Splay trees and self-adjustment
- **Covers** — zig, zig-zig and zig-zag, the amortised O(log n) bound by the potential method,
  working-set and static-optimality properties, the dynamic-optimality conjecture, and the cost of
  mutating on every read.
- **Demo** — access-pattern lab: uniform, Zipf and repeating access sequences run against a splay
  tree and an AVL tree, with the total comparison count and the shape after the run.
- **Diagram** — mermaid diagram of the zig-zig versus zig-zag restructuring.
- **Lab** — implement `splay(node)`; tests assert the root ends as the accessed key and that a Zipf
  workload costs fewer total comparisons than the AVL baseline.
- **Senior insight** — splaying writes on read, which makes it a poor fit for concurrent or
  memory-mapped structures no matter how good the amortised bound is.

### 4.6 Weight-balanced and scapegoat trees
- **Covers** — balance by subtree size rather than height, the α parameter, amortised rebuild of
  the offending subtree, no per-node balance metadata, and when a partial rebuild beats rotations.
- **Demo** — scapegoat trigger visualiser: the α threshold, the scapegoat node identified, and the
  rebuilt subtree highlighted, with the amortised cost accumulating in a credit gauge.
- **Diagram** — mermaid tree with subtree sizes annotated and the scapegoat marked.
- **Lab** — implement the scapegoat search and the linear-time subtree rebuild; tests assert the
  α-weight invariant and an amortised O(log n) insert over 10⁵ operations.
- **Senior insight** — "rebuild it periodically" is a legitimate balancing strategy and often the
  right one when nodes are large or stored on disk.

### 4.7 B-trees and B+ trees
- **Covers** — the multiway node, order and fill factor, split and merge, why the branching factor
  is chosen from the page size, B+ trees keeping data in the leaves with a linked leaf list, bulk
  loading, prefix compression, and the range-scan advantage that makes B+ the database index.
- **Demo** — B+ tree over the simulated memory with a page-size control: insert keys and watch page
  splits, page occupancy and the number of page reads per lookup — the same metric a database
  reports.
- **Diagram** — mermaid diagram of a B+ tree with the leaf-level sibling chain.
- **Lab** — implement leaf split and internal-node promotion for a configurable order; tests assert
  all leaves at equal depth and the fill invariant after randomised insertion.
- **Senior insight** — B-trees are not "trees that are wide", they are trees whose node size equals
  the unit of I/O. Change the storage medium and the right order changes with it. M51 rebuilds this
  over a real page cache.

### 4.8 Augmented trees
- **Covers** — the augmentation recipe (extra field, maintained on rotation), order-statistic trees
  with subtree counts, interval trees with max-endpoint, range-sum trees, and the rule for what can
  be augmented at all.
- **Demo** — one tree, three augmentations selectable: rank/select queries, stabbing queries and
  range sums, each showing the pruned subtrees the augmentation lets it skip.
- **Diagram** — mermaid tree annotated with size, max-endpoint and sum fields.
- **Lab** — implement `select(k)` and `rank(key)` on an order-statistic tree, and `stab(point)` on
  an interval tree; tests assert agreement with brute force over randomised data.
- **Senior insight** — the augmentation rule (the field must be computable from the node and its
  children) is the whole theory; everything else is bookkeeping on rotation.

### 4.9 Skip lists
- **Covers** — probabilistic levels, expected O(log n) search, the p parameter and its
  memory/level trade-off, tower height distribution, deterministic skip lists (1-2-3), and why
  skip lists are the easy structure to make concurrent.
- **Demo** — skip list with the express-lane search path highlighted, level histogram, and a seed
  control; a comparison counter runs against a balanced tree on the same key set.
- **Diagram** — mermaid diagram of the level structure and the search descent.
- **Lab** — implement `insert` with random level generation and `search` returning the update
  vector; tests assert ordering, expected height and correctness over randomised operations.
- **Senior insight** — the reason LevelDB and Redis use skip lists is not speed; it is that
  lock-free insertion needs only single-pointer CAS per level.

### 4.10 Disjoint set union
- **Covers** — union by size and by rank, path compression, path splitting and halving, the
  inverse-Ackermann bound and what it means practically, offline connectivity, DSU on a rollback
  stack for undo, and the applications (Kruskal, image labelling, dynamic equivalence).
- **Demo** — forest visualiser: perform unions and finds, watch path compression flatten the
  structure, with a counter for total pointer updates against the theoretical bound.
- **Diagram** — mermaid forest before and after a compressing find.
- **Lab** — implement union by rank plus path compression, then a rollback-capable DSU without
  compression; tests assert connectivity correctness and that rollback restores the exact prior
  state.
- **Senior insight** — path compression and rollback are incompatible; offline dynamic connectivity
  needs the union-by-rank-only variant, which is a trap people hit once.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/bst.js` | Base tree engine: nodes, rotation, traversal, invariant checks |
| `src/js/algorithms/avl.js`, `red-black.js`, `treap.js`, `splay.js`, `scapegoat.js` | The families |
| `src/js/algorithms/btree.js` | B-tree and B+ tree with page accounting |
| `src/js/algorithms/augmented-tree.js` | Order-statistic, interval and range-sum augmentations |
| `src/js/algorithms/skip-list.js` | Probabilistic and deterministic variants |
| `src/js/algorithms/dsu.js` | Union-find with rank, compression and rollback |
| `src/js/machines/tree-lab.js` | Common replay harness and metrics |
| `src/js/viz/tree-view.js` | Animated SVG tree with rotation transitions |
| `src/js/viz/forest-view.js` | DSU forest rendering |

---

## Acceptance criteria

- [ ] All trees implement one interface (`insert`, `delete`, `find`, `range`, `iterate`,
      `checkInvariants`) so `tree-lab` compares them without special cases.
- [ ] `checkInvariants` is a real predicate per family (AVL balance factors, red-black's five
      rules, heap order for treaps, B+ equal leaf depth, skip-list level consistency) and runs
      after every operation in the property tests.
- [ ] 10⁵-operation randomised sequences match a reference sorted structure for every family.
- [ ] Measured heights fall inside the theoretical bounds for every family across 100 seeds.
- [ ] The B+ tree reports page reads per lookup, and the count matches the analytical
      log_B(n) prediction within one page.
- [ ] DSU with rollback restores exact parent and size arrays, checked by deep comparison.

---

## Sources

- Cormen et al. — chapters 12, 13, 14, 18, 21
- Adelson-Velsky, Landis — the original AVL paper
- Guibas, Sedgewick — *A dichromatic framework for balanced trees*
- Sedgewick — *Left-leaning red-black trees*
- Seidel, Aragon — *Randomized search trees*
- Sleator, Tarjan — *Self-adjusting binary search trees*
- Galperin, Rivest — *Scapegoat trees*
- Pugh — *Skip lists: a probabilistic alternative to balanced trees*
- Tarjan, van Leeuwen — *Worst-case analysis of set union algorithms*
