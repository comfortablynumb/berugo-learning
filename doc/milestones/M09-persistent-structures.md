# M09 — Persistent, immutable and succinct structures

> **Track** Data structures · **Depends on** M04, M06 · **Sections** 9 · **Effort** L

**Outcome.** Two families that senior engineers use constantly without having studied them:
persistent structures (every React, Redux, Clojure, Git and database-snapshot story) and succinct
structures (the reason an index fits in RAM). Both are about representation rather than algorithms,
which is exactly why they are usually skipped.

**Shared machinery introduced.** `machines/version-lab.js` — records a version DAG as operations
are applied, measures nodes shared versus copied per version, and lets any version be queried;
`viz/dag-view.js` — the shared-structure renderer, reused by M31 and M53.

---

## Sections

### 9.1 Persistence: what it means and what it costs
- **Covers** — partial, full and confluent persistence; the fat-node method; path copying; node
  copying with modification boxes; the O(1)-overhead result for pointer machines; and the
  distinction between immutability (an API promise) and persistence (a structural property).
- **Demo** — one balanced tree, three persistence strategies: apply an operation sequence and see
  nodes copied, nodes shared and total memory per version, with the version DAG drawn.
- **Diagram** — mermaid DAG of versions with shared subtrees highlighted.
- **Lab** — implement path-copying insert on a BST returning a new root; tests assert every earlier
  version still answers correctly and that copied nodes per update are O(depth).
- **Senior insight** — "immutable is slow" is usually a claim about allocation, not about
  asymptotics; path copying costs one path, and the old version keeps everything else.

### 9.2 Persistent lists, stacks and queues
- **Covers** — cons lists as trivially persistent, the problem persistence creates for amortised
  analysis, the banker's queue with lazy evaluation, real-time queues with incremental rotation,
  and Okasaki's scheduling technique.
- **Demo** — a queue used persistently (repeatedly re-running the same expensive version) with the
  amortised bound visibly broken, then repaired by the real-time variant, with per-operation cost
  plotted for both.
- **Diagram** — mermaid diagram of front and rear lists with the rotation step.
- **Lab** — implement the banker's queue with explicit laziness; tests assert FIFO order and a
  bounded per-operation cost even when an old version is reused 1 000 times.
- **Senior insight** — persistence destroys amortisation, because the expensive operation can be
  paid for once and re-triggered forever. This is the argument for worst-case bounds over amortised
  ones in a functional setting.

### 9.3 Persistent trees and versioned queries
- **Covers** — the persistent segment tree, persistent arrays, the "k-th smallest in a range" trick,
  copy-on-write snapshots in databases and filesystems, MVCC as persistence with garbage
  collection, and the space accounting per version.
- **Demo** — a persistent segment tree over an array with a version slider: query any historical
  version, see the shared spine highlighted and the per-version node cost.
- **Diagram** — mermaid diagram of two versions sharing all but one root-to-leaf path.
- **Lab** — implement a persistent segment tree supporting range-sum queries at any version; tests
  assert historical correctness after 10⁴ updates.
- **Senior insight** — this is exactly the structure behind snapshot isolation and time-travel
  queries; M53 and M51 rebuild it with a page cache and a garbage collector attached.

### 9.4 Bit-partitioned tries: HAMTs and persistent vectors
- **Covers** — hash array mapped tries, the 32-way branching factor, popcount-indexed sparse nodes,
  persistent vectors with a tail buffer and O(log₃₂ n) indexing (effectively constant), transients
  for batch mutation, and structural sharing in Clojure, Scala and Immutable.js.
- **Demo** — a persistent vector with the trie drawn: append, update and slice, watching only the
  path change; a counter of nodes allocated per operation with and without transients.
- **Diagram** — mermaid tree of a 32-way trie with the tail buffer marked.
- **Lab** — implement popcount-based sparse-node indexing (`bitmap`, `index = popcount(bitmap &
  (bit − 1))`); tests assert lookup correctness and that node arrays hold no empty slots.
- **Senior insight** — "O(log₃₂ n)" is how immutable collections get away with claiming constant
  time: depth 7 covers 34 billion elements. The constant is real, the depth is not.

### 9.5 Finger trees and general sequences
- **Covers** — 2-3 finger trees, amortised O(1) access at both ends and O(log n) split and concat,
  monoidal annotations making one structure serve as a sequence, priority queue, interval map or
  ordered set, and the cost of the generality.
- **Demo** — one finger tree, four annotation choices, four different queries answered by the same
  code; the split operation animated with the digit structure visible.
- **Diagram** — mermaid diagram of the spine, digits and nested nodes.
- **Lab** — implement `split(predicate)` over the measured monoid; tests assert the concatenation
  of the parts reconstructs the original for randomised sequences.
- **Senior insight** — the monoid annotation is the idea worth stealing even if you never write a
  finger tree: pick the measure and the structure answers a family of queries for free.

### 9.6 Zippers and functional navigation
- **Covers** — the zipper as a focused position with a context, derivation as the "derivative of a
  data type", tree and list zippers, O(1) local edits, and where zippers appear in real code
  (editors, cursors, DOM diffing, lenses as the general case).
- **Demo** — navigate a tree with a zipper: move up, down, left, right, edit, then rebuild; the
  context stack is drawn alongside the focused subtree.
- **Diagram** — mermaid diagram of the focus plus the path context.
- **Lab** — implement a tree zipper with `up`, `down`, `left`, `right`, `replace`, `toRoot`; tests
  assert that navigating and rebuilding without edits returns an identical tree.
- **Senior insight** — a zipper is the immutable answer to "I need a mutable cursor", and it is
  what makes local edits in a persistent tree cost O(1) instead of O(depth) per step.

### 9.7 Bit vectors with rank and select
- **Covers** — the succinct model (space close to the information-theoretic minimum, queries still
  fast), rank in O(1) with two levels of precomputed counts, select by binary search or sampling,
  broadword popcount, Elias–Fano encoding of monotone sequences, and the space overhead each choice
  costs.
- **Demo** — a bit vector with the superblock and block tables drawn; a rank query shows the three
  lookups it performs; a space breakdown compares raw bits, the index overhead and an explicit
  array of positions.
- **Diagram** — mermaid diagram of superblock, block and in-word popcount composing a rank.
- **Lab** — implement `rank1(i)` in O(1) with the two-level index and `select1(k)` by sampling;
  tests assert agreement with a naive scan over randomised bit vectors and edge positions.
- **Senior insight** — rank and select are the primitives every succinct structure is built from;
  once you have them in O(1), trees, tries and sequences all collapse into bit strings.

### 9.8 Succinct trees and wavelet trees
- **Covers** — LOUDS and balanced-parentheses tree encodings at ~2 bits per node, navigation by
  rank/select, wavelet trees for rank/select over arbitrary alphabets, range-quantile and
  range-count queries, and succinct tries for dictionaries.
- **Demo** — the same tree as pointers, as LOUDS bits and as balanced parentheses, with navigation
  operations executed in all three and the memory compared; a wavelet tree answering a range-quantile
  query with the descent animated.
- **Diagram** — mermaid diagram of a tree and its LOUDS bit string aligned.
- **Lab** — implement LOUDS `firstChild`, `nextSibling` and `parent` via rank/select; tests assert
  the traversal order matches the pointer tree exactly.
- **Senior insight** — 2 bits per node instead of 16 bytes is a 60× difference, which is what turns
  "the index does not fit in memory" into "it does".

### 9.9 Compressed bitmaps and static index layouts
- **Covers** — bitmap indexes, run-length encodings (WAH, EWAH) and their pathologies, Roaring
  bitmaps' hybrid container design (array, bitmap, run), boolean operations directly on the
  compressed form, and pairing minimal perfect hashes with succinct payloads for read-only indexes.
- **Demo** — the same posting sets as raw bitmaps, WAH and Roaring: memory and the cost of an AND
  across all three, with the container choice per chunk visualised.
- **Diagram** — mermaid diagram of Roaring's chunk-to-container dispatch.
- **Lab** — implement Roaring's container selection and the array/bitmap intersection paths; tests
  assert set-operation correctness against a reference `Set` and a memory figure below the raw
  bitmap for sparse input.
- **Senior insight** — Roaring won because it optimises the *operations*, not just the storage: an
  AND between an array container and a bitmap container never decompresses either.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/persistent-bst.js` | Path copying, fat nodes, version registry |
| `src/js/algorithms/persistent-queue.js` | Banker's and real-time queues with explicit laziness |
| `src/js/algorithms/persistent-segment-tree.js` | Versioned range queries |
| `src/js/algorithms/hamt.js` | HAMT and persistent vector with transients |
| `src/js/algorithms/finger-tree.js` | 2-3 finger tree with monoid annotations |
| `src/js/algorithms/zipper.js` | List and tree zippers |
| `src/js/algorithms/bit-vector.js` | Rank/select with two-level index, Elias–Fano |
| `src/js/algorithms/succinct-tree.js` | LOUDS, balanced parentheses, wavelet tree |
| `src/js/algorithms/roaring.js` | Container-based compressed bitmaps |
| `src/js/machines/version-lab.js` | Version DAG, sharing metrics |
| `src/js/viz/dag-view.js` | Shared-structure renderer |

---

## Acceptance criteria

- [ ] Every persistent structure answers queries correctly at *every* historical version, asserted
      over randomised operation sequences, not just the latest.
- [ ] Sharing is measured: the tests assert copied-nodes-per-update is O(depth) for path copying and
      that total memory is sub-linear in versions × size.
- [ ] The banker's-queue demo demonstrably breaks the amortised bound under repeated reuse of one
      version, and the real-time variant demonstrably does not.
- [ ] `rank`/`select` match a naive scan on 10⁴ randomised bit vectors including all-zero, all-one
      and single-bit cases.
- [ ] LOUDS navigation reproduces the pointer tree's traversal exactly for randomised trees.
- [ ] Roaring set operations match a reference `Set` for union, intersection, difference and
      cardinality over sparse, dense and run-heavy inputs.

---

## Sources

- Driscoll, Sarnak, Sleator, Tarjan — *Making data structures persistent*
- Okasaki — *Purely Functional Data Structures*
- Bagwell — *Ideal hash trees* (HAMT)
- Hinze, Paterson — *Finger trees: a simple general-purpose data structure*
- Huet — *The Zipper*
- Jacobson — *Space-efficient static trees and graphs*
- Navarro — *Compact Data Structures: A Practical Approach*
- Lemire et al. — *Roaring bitmaps: implementation of an optimized software library*
