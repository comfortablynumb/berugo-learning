# M02 — Linear structures and memory layout

> **Track** Data structures · **Depends on** M01 · **Sections** 9 · **Effort** M

**Outcome.** The structures everything else is built from, taught with the memory layout visible.
The point of this milestone is not "arrays and lists" — it is that layout decides performance and
most engineers have never watched that happen.

**Shared machinery introduced.** `machines/memory-model.js` — a byte-addressable simulated memory
with an allocator, an optional cache model hook (wired for real in M37) and an access log. Every
structure in this milestone is built on it, so the demos can show real addresses, real strides and
real access patterns instead of boxes and arrows.

---

## Sections

### 2.1 Contiguous memory, addresses and strides
- **Covers** — byte addressing, element size, stride, index arithmetic, alignment and padding,
  row-major versus column-major, struct-of-arrays versus array-of-structs, false sharing preview.
- **Demo** — layout inspector over `machines/memory-model.js`: define a record, choose AoS or SoA,
  then run a query that touches one field; the memory map highlights every byte actually read and
  reports bytes-touched versus bytes-needed.
- **Diagram** — mermaid block diagram of the same records laid out both ways.
- **Lab** — implement `Matrix` with a configurable major order and a `transpose` that is measured;
  tests assert correctness, and the bench panel shows the row-major/column-major traversal gap.
- **Senior insight** — AoS versus SoA is the single highest-leverage layout decision in a hot loop,
  and it is invisible in every language that hides the layout from you.

### 2.2 Dynamic arrays and growth policies
- **Covers** — capacity versus size, growth factor trade-offs, shrink hysteresis, insertion and
  deletion in the middle, small-buffer optimisation, `splice` costs, iterator invalidation.
- **Demo** — growth visualiser: capacity blocks over time, copies highlighted, total bytes copied
  and peak memory for factors 1.25 / 1.5 / 2 / 4 on the same operation trace.
- **Diagram** — mermaid state diagram of push, grow, copy, shrink with hysteresis.
- **Lab** — implement `insertAt` and `removeAt` with a single `copyWithin`; tests assert element
  order and a write count within the optimal bound.
- **Senior insight** — the growth factor is an allocator argument: 2 can never reuse the sum of its
  previous blocks, factors below the golden ratio eventually can.

### 2.3 Linked lists and pointer chasing
- **Covers** — singly, doubly, circular, sentinel nodes, intrusive lists, unrolled lists, XOR
  lists, Floyd and Brent cycle detection, why every list operation is O(1) and the structure is
  still usually slower than an array.
- **Demo** — pointer-chase race: the same 100k traversal over a sequentially allocated list, a
  shuffled list and an array, with the access log rendered as a memory scatter plot.
- **Diagram** — mermaid graph of node links, including the sentinel and the cycle case.
- **Lab** — implement `detectCycle` with Brent's algorithm and return the cycle length and start;
  implement an unrolled list node with a configurable block size.
- **Senior insight** — the classic "insert is O(1)" argument omits the O(n) search that gets you
  there, and the cache miss that dominates both. Intrusive lists survive in kernels because they
  avoid the allocation, not because they are fast to walk.

### 2.4 Stacks and the call stack
- **Covers** — array-backed and list-backed stacks, the machine call stack, stack frames, locals,
  return addresses, recursion depth, tail calls, converting recursion to an explicit stack,
  stack overflow, and guard pages.
- **Demo** — recursion visualiser: run a recursive function under the runner's trace protocol and
  watch frames push and pop with their locals; a toggle converts it to the explicit-stack version
  and shows the identical trace.
- **Diagram** — mermaid diagram of a frame's layout and the chain of saved frame pointers.
- **Lab** — convert a recursive tree traversal into an iterative one with an explicit stack; tests
  assert identical visit order and a bounded stack depth.
- **Senior insight** — "recursion is elegant" ends where the frame budget does; this section is the
  bridge into the calling-convention material in M39.

### 2.5 Queues, deques and ring buffers
- **Covers** — FIFO semantics, two-stack queues, circular buffers, power-of-two masking versus
  modulo, full-versus-empty disambiguation, deques, and bounded queues with drop, block or
  backpressure policies.
- **Demo** — ring-buffer inspector: head and tail pointers over a fixed array, wrap-around
  highlighted, with a producer/consumer rate control that lets the learner drive it into the full
  and empty states deliberately.
- **Diagram** — mermaid state diagram of the ring buffer's occupancy states.
- **Lab** — implement a `RingBuffer` with masking; tests assert wrap correctness, the full/empty
  distinction and no allocation after construction.
- **Senior insight** — the "one slot wasted" trick versus a separate count is a concurrency
  decision, not a memory one; it is what makes the single-producer/single-consumer version
  lock-free in M47.

### 2.6 Batching, chunking and pipelines
- **Covers** — chunked processing, generators and lazy sequences, backpressure at the data-
  structure level, double buffering, arena reset instead of free, and the memory-versus-latency
  trade-off of batch size.
- **Demo** — pipeline lab: the same transformation as eager arrays, as generators and as fixed
  chunks, with peak allocation, throughput and time-to-first-result plotted for each.
- **Diagram** — mermaid flowchart of the three dataflow shapes with the buffer between stages.
- **Lab** — implement `chunked(iterable, size)` and a two-stage pipeline that never holds more than
  `2 × size` items; the test asserts peak allocation from the instrumented allocator.
- **Senior insight** — time-to-first-result and total throughput pull in opposite directions;
  choosing a batch size is choosing which one you care about.

### 2.7 Free lists, pools and arenas
- **Covers** — object pooling, free lists, bump allocation, arena and region allocation, the
  slab idea, fragmentation, and why pooling can be slower than allocating.
- **Demo** — allocator playground on the simulated memory: allocate and free with a chosen policy,
  watch fragmentation build, read the utilisation and largest-free-block gauges.
- **Diagram** — mermaid diagram of a free list threading through freed blocks.
- **Lab** — implement a bump allocator with a `reset`, then a free list over fixed-size slots;
  tests assert no overlap, correct reuse and O(1) allocate.
- **Senior insight** — pools trade fragmentation and lifetime bugs for allocation cost. This is the
  cheap version of the argument M43 and M31 make properly.

### 2.8 Text structures: ropes, gap buffers and piece tables
- **Covers** — why editors do not store text in one string, gap buffers, ropes with balance,
  piece tables and append-only buffers, undo as structure, and line-index maintenance.
- **Demo** — editor simulator: type, paste and delete into each of the three structures and watch
  the operation cost, bytes moved and structure shape update per keystroke.
- **Diagram** — mermaid tree of a rope after a split and concat, plus a piece-table piece list.
- **Lab** — implement `insert` and `delete` on a gap buffer; tests assert content equality against
  a reference string and a bounded number of moved bytes for sequential typing.
- **Senior insight** — VS Code moved from a gap buffer to a piece table for a reason you can
  reproduce here: the cost of a large paste followed by scattered edits.

### 2.9 Cache-conscious layouts
- **Covers** — sorted array versus balanced tree for search, Eytzinger and van Emde Boas layouts,
  blocking and tiling, prefetch-friendly access, padding to avoid false sharing, and structure-
  of-arrays revisited with measurements.
- **Demo** — binary search over three layouts (sorted, Eytzinger, B-tree-blocked) with the memory
  access pattern drawn as a heat map and the measured comparison and miss counts side by side.
- **Diagram** — mermaid diagram of the Eytzinger index mapping.
- **Lab** — implement the Eytzinger build and search; tests assert identical results to a plain
  binary search and a lower simulated-miss count.
- **Senior insight** — the same algorithm, relaid out, is routinely 2–3× faster. That gap is the
  argument for the whole memory-hierarchy track.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/memory-model.js` | Byte-addressable simulated memory, allocator hook, access log |
| `src/js/algorithms/dynamic-array.js` | Growth policies, insert/remove, copy accounting |
| `src/js/algorithms/linked-list.js` | Singly, doubly, unrolled, cycle detection |
| `src/js/algorithms/ring-buffer.js` | Masked ring buffer, bounded-queue policies |
| `src/js/algorithms/allocators-basic.js` | Bump, free list, pool |
| `src/js/algorithms/text-buffers.js` | Gap buffer, rope, piece table |
| `src/js/algorithms/eytzinger.js` | Layout build and search |
| `src/js/viz/memory-map-view.js` | Canvas memory map with access heat |
| `src/js/viz/pointer-graph-view.js` | SVG node-and-link renderer reused by M04 and M13 |

---

## Acceptance criteria

- [ ] Every structure in this milestone is implemented over `memory-model.js`, so the memory map is
      real rather than illustrative.
- [ ] Property tests: dynamic array matches a reference array over 10⁵ random operations; ring
      buffer never reports a wrong full/empty state; gap buffer matches a reference string.
- [ ] The AoS/SoA and layout demos report bytes touched from the access log, not an estimate.
- [ ] Cycle detection is tested against lists with cycle lengths 1, 2 and n−1, and acyclic lists.
- [ ] Content coverage passes for all nine sections.

---

## Sources

- Cormen et al. — *Introduction to Algorithms*, chapter 10
- Drepper — *What every programmer should know about memory*
- Khuong, Morin — *Array layouts for comparison-based searching*
- VS Code engineering blog — *Text buffer reimplementation*
- Bentley — *Programming Pearls*, column on space
