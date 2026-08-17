# M08 — Spatial and multidimensional indexes

> **Track** Data structures · **Depends on** M04 · **Sections** 9 · **Effort** M

**Outcome.** Everything that answers "what is near this" or "what overlaps this", from a uniform
grid to HNSW vector search, plus the one-dimensional range-query structures that competitive
programming and analytics engines both live on.

**Shared machinery introduced.** `machines/spatial-lab.js` — point and rectangle generators
(uniform, clustered, real-world-shaped), a query runner that reports nodes visited, candidates
tested and result correctness against brute force; `viz/spatial-view.js` — a canvas renderer that
draws the index's partition structure over the data, reused by M16.

---

## Sections

### 8.1 Uniform grids and spatial hashing
- **Covers** — bucketing by cell, choosing cell size from the query radius and density, hashing
  unbounded space into a fixed table, handling objects that straddle cells, and the density
  sensitivity that makes grids either excellent or useless.
- **Demo** — a grid over draggable points with a cell-size slider; the radius query highlights the
  cells scanned and reports candidates tested versus results returned.
- **Diagram** — mermaid diagram of a query circle overlapping four cells.
- **Lab** — implement `queryRadius` over a spatial hash; tests assert exact agreement with brute
  force and a candidate count below a threshold for uniform data.
- **Senior insight** — for uniformly dense data a grid beats every tree in this milestone. Trees
  earn their keep only when density varies.

### 8.2 Quadtrees and octrees
- **Covers** — recursive subdivision, point versus region quadtrees, split thresholds and maximum
  depth, the empty-node problem, loose quadtrees for moving objects, linear quadtrees keyed by
  Morton code, and octrees as the 3-D case.
- **Demo** — quadtree that rebuilds as points are dragged, with the subdivision drawn; a range
  query highlights pruned subtrees; a depth/threshold pair of sliders shows the memory-versus-query
  trade.
- **Diagram** — mermaid tree of quadrant subdivision mapped to the plane.
- **Lab** — implement insert with split and a rectangle range query; tests assert exact results and
  correct behaviour with coincident points (the classic infinite-recursion bug).
- **Senior insight** — coincident points are what actually breaks quadtrees in production; a depth
  cap with bucket overflow is not an optimisation, it is a correctness requirement.

### 8.3 k-d trees
- **Covers** — alternating split dimensions, median selection for balance, nearest-neighbour search
  with the splitting-plane bound, k-nearest with a bounded heap, range search, deletion difficulty,
  bulk rebuild, and degradation with dimensionality.
- **Demo** — k-d tree with the splitting planes drawn; a nearest-neighbour query animates the
  descent, the backtrack and each pruned half-space with the reason shown.
- **Diagram** — mermaid tree with the split dimension and value at each node.
- **Lab** — implement `nearest(point)` with correct pruning; tests assert exact agreement with
  brute force over 10⁴ randomised queries, which a missing backtrack fails.
- **Senior insight** — the descent finds a good candidate; the backtrack is what makes it correct.
  Nearly every buggy k-d tree returns a plausible wrong answer.

### 8.4 R-trees and rectangle indexes
- **Covers** — minimum bounding rectangles, overlapping nodes, the split heuristics (linear,
  quadratic, R*), forced reinsertion, STR bulk loading, and why the R-tree is the spatial index in
  databases (PostGIS, SQLite R*Tree).
- **Demo** — build an R-tree by insertion and by STR bulk load over the same rectangles; the MBR
  overlap area and query node-visit counts are reported for both.
- **Diagram** — mermaid diagram of nested MBRs across two levels.
- **Lab** — implement the quadratic split heuristic; tests assert the tree invariants and a lower
  total overlap than a naive first-fit split.
- **Senior insight** — R-tree query cost is governed by MBR overlap, not by height. Bulk loading
  beats incremental insertion so consistently that most systems rebuild rather than maintain.

### 8.5 Bounding volume hierarchies
- **Covers** — BVH construction top-down and bottom-up, the surface-area heuristic, traversal with
  an explicit stack, ray-box intersection (slab method), refitting for animated scenes, and the
  BVH-versus-k-d-tree argument in ray tracing.
- **Demo** — ray casting against a triangle soup: the BVH is drawn, the traversal stack animates,
  and node-visit counts are compared for median-split versus SAH construction.
- **Diagram** — mermaid tree of a BVH with box extents annotated.
- **Lab** — implement the slab-method ray-box test and the traversal loop; tests assert hit/miss
  agreement with brute force including the axis-parallel-ray edge case.
- **Senior insight** — the SAH is a cost model, not a heuristic in the vague sense: it estimates
  expected traversal cost, and writing that estimate down is what makes the build decision
  principled.

### 8.6 Space-filling curves
- **Covers** — Morton (Z-order) codes by bit interleaving, Hilbert curves and their better
  locality, geohash and S2 cell IDs, using curve order as a one-dimensional index for
  multidimensional data, the range-decomposition problem, and the "jump-in" trick for queries.
- **Demo** — draw the curve order over a grid, toggle between Z-order and Hilbert, then run a
  rectangle query and watch it decompose into curve ranges; the count of ranges and false positives
  is reported for both curves.
- **Diagram** — mermaid diagram of bit interleaving producing a Morton code.
- **Lab** — implement `morton2d(x, y)` with bit interleaving and its inverse; then implement
  Hilbert index conversion; tests assert round-trip and the locality property (adjacent indices are
  spatially adjacent) statistically.
- **Senior insight** — this is how a key-value store without a spatial index still serves spatial
  queries: DynamoDB and Bigtable geo layouts are Z-order or S2 underneath.

### 8.7 One-dimensional range structures
- **Covers** — prefix sums and their limits, Fenwick trees (point update, prefix query, and the
  bit trick), segment trees with arbitrary monoids, lazy propagation for range updates, sparse
  tables for idempotent queries, sqrt decomposition, and merge-sort trees for order-statistics
  ranges.
- **Demo** — one array, four structures: run the same operation mix and compare update and query
  cost; the segment-tree view highlights the O(log n) canonical decomposition of a query range.
- **Diagram** — mermaid tree of the canonical range decomposition of an arbitrary interval.
- **Lab** — implement a segment tree with lazy propagation for range-add and range-min; tests
  assert agreement with brute force over 10⁵ randomised operations.
- **Senior insight** — Fenwick is smaller and faster; segment trees generalise to any monoid and
  support lazy updates. Knowing which question you have decides it in ten seconds.

### 8.8 Nearest neighbours in high dimensions
- **Covers** — the curse of dimensionality and why exact k-d search degenerates to a scan, ball
  trees and VP-trees over metric spaces, product quantisation, IVF indexes, HNSW's layered
  proximity graph, recall-versus-latency curves, and how vector databases evaluate themselves.
- **Demo** — the same 5 000 vectors indexed by brute force, VP-tree and HNSW: a recall-versus-
  latency plot as ef and M are tuned, and a graph view of the HNSW layers with the greedy search
  path animated.
- **Diagram** — mermaid diagram of HNSW's layer hierarchy and the descent.
- **Lab** — implement HNSW greedy search over a prebuilt graph with a candidate heap; tests assert
  recall above a threshold against brute force at a given ef.
- **Senior insight** — approximate search is a recall dial, and shipping it without measuring recall
  on your own data is how "the search got worse" bugs enter a product silently.

### 8.9 Broad-phase collision detection
- **Covers** — sweep and prune with temporal coherence, spatial hashing for moving objects, the
  broad/narrow-phase split, continuous collision and tunnelling, and the sorted-axis insertion-sort
  trick that makes SAP nearly O(n) in practice.
- **Demo** — a few hundred moving circles with a selectable broad phase: candidate pairs tested per
  frame plotted live, with the tunnelling failure reproducible by raising velocity.
- **Diagram** — mermaid diagram of an interval overlap on the sweep axis.
- **Lab** — implement sweep and prune with incremental re-sorting; tests assert the reported pair
  set equals brute force each frame for a scripted motion sequence.
- **Senior insight** — temporal coherence is the whole reason SAP works: the sort is almost sorted
  every frame, so insertion sort is the right choice for once.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/spatial-hash.js` | Uniform grid and hashed grid |
| `src/js/algorithms/quadtree.js` | Point and region quadtrees, octree generalisation |
| `src/js/algorithms/kd-tree.js` | Build, nearest, k-nearest, range |
| `src/js/algorithms/r-tree.js` | Insertion, split heuristics, STR bulk load |
| `src/js/algorithms/bvh.js` | Median and SAH builds, slab traversal |
| `src/js/algorithms/space-filling.js` | Morton, Hilbert, geohash, range decomposition |
| `src/js/algorithms/range-structures.js` | Fenwick, segment tree with lazy, sparse table, sqrt blocks |
| `src/js/algorithms/ann-index.js` | VP-tree, HNSW, product quantisation |
| `src/js/algorithms/broad-phase.js` | Sweep and prune, moving-object hash |
| `src/js/machines/spatial-lab.js` | Generators, query runner, brute-force oracle |
| `src/js/viz/spatial-view.js` | Canvas partition and query rendering |

---

## Acceptance criteria

- [ ] Every index is validated against the brute-force oracle on uniform, clustered and degenerate
      (all-collinear, all-coincident) inputs.
- [ ] k-d nearest, R-tree window and quadtree range queries return exactly the brute-force sets
      over 10⁴ randomised queries each.
- [ ] Morton and Hilbert conversions round-trip for all coordinates within the tested bit width.
- [ ] Segment tree with lazy propagation matches brute force over 10⁵ mixed range updates/queries.
- [ ] HNSW recall is reported, not assumed, and the test asserts a floor at a stated ef.
- [ ] Each demo reports nodes visited and candidates tested, so pruning is visible as a number.

---

## Sources

- Samet — *Foundations of Multidimensional and Metric Data Structures*
- Bentley — *Multidimensional binary search trees used for associative searching*
- Guttman — *R-trees: a dynamic index structure for spatial searching*; Beckmann et al. — *The R\*-tree*
- MacDonald, Booth — surface-area heuristic for BVH construction
- Malkov, Yashunin — *Efficient and robust approximate nearest neighbor search using HNSW*
- Fenwick — *A new data structure for cumulative frequency tables*
- Ericson — *Real-Time Collision Detection*
