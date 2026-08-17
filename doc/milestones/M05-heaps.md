# M05 — Heaps and priority queues

> **Track** Data structures · **Depends on** M02 · **Sections** 8 · **Effort** M

**Outcome.** Priority queues from the implicit binary heap to the mergeable-heap families, with the
theory-versus-practice gap made measurable rather than asserted, and ending on the places a
priority queue is actually load-bearing: schedulers, timers and event simulation.

**Shared machinery introduced.** `machines/pq-lab.js` — replays an operation mix (push-heavy,
decrease-key-heavy, meld-heavy) against every implementation and reports comparisons, sift
distance, node touches and measured time; `machines/event-sim.js` — a discrete-event simulation
kernel reused by M41, M45, M49 and M58.

---

## Sections

### 5.1 The binary heap
- **Covers** — the shape and heap-order properties, implicit array representation with 2i+1 / 2i+2
  indexing, sift-up and sift-down, why build-heap is O(n) and not O(n log n), peek, pop, the
  sum-of-heights proof, and 1-based versus 0-based indexing.
- **Demo** — dual view: the array on top, the tree below, both highlighting the same node as a
  sift walks; a build-heap animation with the per-level work tallied against the O(n) sum.
- **Diagram** — mermaid tree annotated with array indices.
- **Lab** — implement `siftDown` and `buildHeap`; tests assert heap order after randomised
  operations and that the comparison count for build-heap is below 2n.
- **Senior insight** — the O(n) build is the counter-intuitive one: most nodes are near the bottom
  and can barely sink. That summation is worth being able to reproduce on a whiteboard.

### 5.2 d-ary heaps and cache behaviour
- **Covers** — arity as a tuning parameter, shallower trees with more comparisons per level, the
  cache-line argument for d = 4 or 8, aligning children to a line, and the workload dependence of
  the optimum.
- **Demo** — arity sweep: for d in 2..16, plot comparisons, swaps, simulated cache misses and
  measured time for a fixed operation mix; the crossover is visible and moves with the mix.
- **Diagram** — mermaid diagram of a 4-ary heap's children packed in one line.
- **Lab** — generalise the binary heap to arity d; tests assert correctness for d in 2..8 and that
  decrease-key comparisons fall as d rises while pop comparisons climb.
- **Senior insight** — d-ary heaps are the standard answer when decrease-key dominates, which is
  exactly the Dijkstra case in M13.

### 5.3 Heapsort and heap-based selection
- **Covers** — heapsort as in-place selection sort with a heap, why it is not stable, its poor
  cache behaviour relative to quicksort, bottom-up heapsort, top-k with a bounded heap, and the
  streaming top-k pattern.
- **Demo** — heapsort animation over the array view with the sorted suffix growing; comparison and
  swap counts against quicksort and merge sort on identical input.
- **Diagram** — mermaid flowchart of the extract-and-place loop.
- **Lab** — implement bounded top-k over a stream in O(n log k) with O(k) memory; tests assert
  correct results and that peak memory stays at k for a 10⁶-element stream.
- **Senior insight** — heapsort's guaranteed O(n log n) with O(1) space is why it is the fallback
  branch in introsort, and its cache behaviour is why it is only the fallback.

### 5.4 Mergeable heaps: leftist, skew and binomial
- **Covers** — the meld operation as the primitive, null-path length and the leftist invariant,
  skew heaps as the amortised self-adjusting version, binomial trees and their structure, binomial
  heap merge as binary addition with carries, and O(log n) meld.
- **Demo** — binomial heap as a forest of trees labelled by order, with the merge shown as binary
  addition (carry propagation highlighted).
- **Diagram** — mermaid diagram of B₀..B₃ and a merge with a carry.
- **Lab** — implement leftist-heap `meld` and derive insert and pop from it; tests assert the
  null-path invariant and O(log n) meld depth.
- **Senior insight** — once meld is the primitive, insert is "meld a singleton" and pop is "meld
  the children". Structures with one primitive are the ones you can still write correctly a year
  later.

### 5.5 Fibonacci heaps and the theory–practice gap
- **Covers** — the amortised bounds (O(1) insert, meld and decrease-key; O(log n) extract-min), the
  potential function, lazy consolidation, cascading cuts and marked nodes, the constant factors,
  the pointer overhead, and the measured reality against a d-ary heap.
- **Demo** — Dijkstra on the same graph with a binary heap, a 4-ary heap and a Fibonacci heap:
  operation counts confirm the theory, wall clock contradicts it, both are shown.
- **Diagram** — mermaid diagram of a cascading cut promoting subtrees to the root list.
- **Lab** — implement `decreaseKey` with cascading cuts; tests assert the marked-node invariant and
  the amortised bound over a scripted sequence.
- **Senior insight** — Fibonacci heaps are the canonical example of an asymptotic win that loses in
  practice. Being able to show the two curves is more persuasive than knowing the bound.

### 5.6 Pairing heaps and rank-pairing heaps
- **Covers** — the pairing heap as the "self-adjusting Fibonacci heap", the two-pass merge, the
  known bounds and the open questions, rank-pairing heaps, and why pairing heaps are the practical
  choice when decrease-key matters.
- **Demo** — the two-pass merge animated over the child list, with node-touch counts compared to
  the Fibonacci consolidation on the same sequence.
- **Diagram** — mermaid diagram of the left-to-right pairing pass and the right-to-left accumulate.
- **Lab** — implement the two-pass merge; tests assert heap order and a lower node-touch count than
  a naive one-pass merge on randomised sequences.
- **Senior insight** — pairing heaps are what most "we used a Fibonacci heap" codebases should have
  used, and boost and LEDA agree.

### 5.7 Indexed priority queues and decrease-key in practice
- **Covers** — the handle problem (finding an element to decrease), index-to-position maps,
  handles versus lazy deletion, the "insert duplicates and skip stale entries" pattern, and the
  memory and correctness trade-off between them.
- **Demo** — Dijkstra run twice on a large graph: indexed PQ with real decrease-key against lazy
  insertion with stale-entry skipping, showing queue size, total pushes and time.
- **Diagram** — mermaid diagram of the three parallel arrays in an indexed heap.
- **Lab** — implement an indexed binary heap with `decreaseKey(id, value)` in O(log n); tests
  assert position-map consistency after every operation.
- **Senior insight** — lazy deletion is usually faster and always simpler, at the cost of an
  unbounded queue. Bounding it is the thing people forget, and it is where the memory goes.

### 5.8 Priority queues in systems: timers, schedulers and event simulation
- **Covers** — timer wheels (simple, hierarchical), the hashed timing wheel, why kernels do not use
  a heap for timers, run-queue structures in schedulers, discrete-event simulation loops, and
  priority inversion as a systems failure.
- **Demo** — timer benchmark: 100k timers with heavy churn against a binary heap and a hierarchical
  timer wheel, showing per-operation cost and tick cost; a discrete-event simulation of an M/M/1
  queue driven by the event kernel.
- **Diagram** — mermaid diagram of a hierarchical timing wheel with cascade.
- **Lab** — implement a single-level timing wheel with cascading; tests assert every timer fires in
  the correct tick and that add/cancel are O(1).
- **Senior insight** — O(1) add and cancel with O(1) amortised expiry is why timing wheels beat
  heaps for timers; the trade is bounded precision, which is exactly what a timeout can afford.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/binary-heap.js` | Implicit heap, d-ary generalisation, indexed variant |
| `src/js/algorithms/leftist-heap.js`, `binomial-heap.js` | Mergeable families |
| `src/js/algorithms/fibonacci-heap.js`, `pairing-heap.js` | Amortised families with decrease-key |
| `src/js/algorithms/timer-wheel.js` | Simple and hierarchical wheels |
| `src/js/machines/pq-lab.js` | Operation-mix replay and metrics |
| `src/js/machines/event-sim.js` | Discrete-event kernel (reused by M41, M45, M49, M58) |
| `src/js/viz/heap-view.js` | Array-and-tree dual view with sift animation |
| `src/js/viz/forest-view.js` | Reused from M04 for binomial and Fibonacci root lists |

---

## Acceptance criteria

- [ ] Every heap implements one interface (`push`, `pop`, `peek`, `meld`, `decreaseKey`, `size`,
      `checkInvariants`) and `pq-lab` runs all of them on identical sequences.
- [ ] Property tests: pop order matches a sorted reference over 10⁵ randomised operations for all
      families; invariants checked after each operation.
- [ ] Build-heap comparison count is asserted below 2n; heapsort is asserted in-place (no
      allocation after setup, verified with the instrumented allocator).
- [ ] The Fibonacci-versus-d-ary demo reports both operation counts and median wall-clock time, and
      the section text states which one the theory predicts.
- [ ] Timer wheel fires every timer in the right tick, asserted over 10⁴ randomised timers with
      cancellations.

---

## Sources

- Cormen et al. — chapters 6, 19, and the Fibonacci-heap chapter
- Vuillemin — *A data structure for manipulating priority queues*
- Fredman, Tarjan — *Fibonacci heaps and their uses*
- Fredman, Sedgewick, Sleator, Tarjan — *The pairing heap*
- Larkin, Sen, Tarjan — *A back-to-basics empirical study of priority queues*
- Varghese, Lauck — *Hashed and hierarchical timing wheels*
