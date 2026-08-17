# M31 — Garbage collection and runtime memory

> **Track** Automata, languages and compilers · **Depends on** M30, M43 · **Sections** 9 · **Effort** L

**Outcome.** A working collector for the Berugo runtime, built up from reference counting to a
generational, incremental collector with write barriers — with pause distributions, throughput and
memory overhead measured for each design. The milestone answers the question most engineers only
have folklore about: what actually causes a GC pause, and what changes it.

**Shared machinery introduced.** `machines/heap-sim.js` — a simulated heap over
`machines/memory-model.js` (M02) with object headers, a shadow "true liveness" oracle for testing,
allocation-site attribution and event logging; `machines/gc-lab.js` — runs any collector against
recorded or synthetic allocation traces and reports pause distribution, throughput, peak memory and
floating garbage; `viz/heap-view.js` — canvas heap map with per-object colouring by age and mark
state.

---

## Sections

### 31.1 The memory-management landscape
- **Covers** — manual management and its failure modes (leak, double free, use after free, dangling
  pointer), reference counting versus tracing as the two strategies, the allocator/collector split,
  what "safe" means in a managed runtime, the object header and its cost, and the throughput /
  latency / footprint triangle every collector trades within.
- **Demo** — the same program run with manual management (with injected bugs made visible),
  reference counting and tracing, showing memory over time, pause events and the bugs each strategy
  makes impossible.
- **Diagram** — mermaid diagram of the three-way trade-off with named collectors placed on it.
- **Lab** — implement a use-after-free detector for the manual allocator using a quarantine and
  poison pattern; tests assert detection of every seeded use-after-free in the fixture trace.
- **Senior insight** — the triangle is the whole subject: no collector wins on all three axes, so
  "which GC is best" is always "for which of the three do you have the tightest budget".

### 31.2 Reference counting
- **Covers** — increment/decrement placement, the cost on every pointer write, naive versus deferred
  counting, cycle collection (trial deletion), weak references, the immediate-reclamation advantage
  for destructors and resource handles, atomic counts in concurrent settings, and the optimisations
  that make ARC viable (elision, ownership transfer).
- **Demo** — reference-count visualiser: objects annotated with their counts, updates animated on
  assignment, and a deliberately created cycle that leaks — then reclaimed by the trial-deletion
  cycle collector with each step shown.
- **Diagram** — mermaid diagram of a reference cycle unreachable from roots but with non-zero
  counts.
- **Lab** — implement trial-deletion cycle collection; tests assert every cycle is reclaimed, no
  live object is freed (checked against the liveness oracle) and counts return to consistency.
- **Senior insight** — reference counting's real cost is the write barrier on every pointer store,
  which is why it loses on throughput and wins on pause time. Swift and CPython pay it for
  predictability.

### 31.3 Mark-sweep and mark-compact
- **Covers** — root-set identification (stack, registers, globals) using the stack maps from M30,
  the tri-colour abstraction, mark stack and its overflow handling, sweep and the free-list result,
  fragmentation, compaction with forwarding pointers and pointer fix-up, mark-compact algorithms
  (Lisp2, threaded), and precise versus conservative scanning.
- **Demo** — mark-sweep stepped through: roots enumerated, the graph traversed with tri-colour
  states drawn on the heap map, then sweep reclaiming the white objects; a compaction toggle shows
  objects sliding with pointers being fixed up.
- **Diagram** — mermaid diagram of the tri-colour states and the transitions between them.
- **Lab** — implement mark-sweep with an explicit mark stack and overflow recovery; tests assert
  that the set of reclaimed objects exactly equals the unreachable set from the liveness oracle,
  over randomised heaps.
- **Senior insight** — conservative scanning (treating any word that looks like a pointer as one)
  is what lets a collector work without stack maps, and it is why Boehm-style collectors can retain
  garbage indefinitely. Precise scanning needs compiler cooperation, which is exactly what M30 built.

### 31.4 Copying and generational collection
- **Covers** — semi-space copying and Cheney's algorithm, the allocation-is-a-pointer-bump
  advantage, the weak generational hypothesis with measurements from real traces, nurseries and
  promotion policies, remembered sets and card tables, write barriers, inter-generational pointers,
  and survival-rate-driven sizing.
- **Demo** — generational collector on a real allocation trace: nursery fills and is collected with
  the survival rate reported, promotion tracked, and a card-table view showing which cards the write
  barrier dirtied; the nursery size is adjustable and the effect on pause frequency and duration is
  plotted.
- **Diagram** — mermaid diagram of a young-to-old pointer being recorded by the write barrier into
  the remembered set.
- **Lab** — implement Cheney's copying collector and a card-marking write barrier; tests assert
  correctness against the liveness oracle, that no inter-generational pointer is missed, and that
  the collector's cost scales with survivors rather than heap size.
- **Senior insight** — copying collection costs time proportional to *live* data, which is why a
  nursery full of dead objects is nearly free to collect, and why allocation rate alone is a poor
  predictor of GC cost.

### 31.5 Incremental and concurrent collection
- **Covers** — why stop-the-world pauses grow with the heap, incremental marking with the tri-colour
  invariants, the lost-object problem, snapshot-at-the-beginning versus incremental-update barriers,
  concurrent marking with mutator threads running, read barriers and their cost, safepoints and
  handshake protocols, and floating garbage as the price of concurrency.
- **Demo** — incremental marking with the mutator running between increments: the learner can
  deliberately create a lost-object scenario by rewiring pointers mid-mark, watch the object be
  wrongly collected without a barrier, then enable each barrier and see it prevented.
- **Diagram** — mermaid diagram of the tri-colour invariant violation (black to white pointer) that
  barriers exist to prevent.
- **Lab** — implement a Dijkstra-style incremental-update write barrier; tests assert no live object
  is ever collected across 10⁴ randomised interleavings of mutation and marking increments.
- **Senior insight** — the black-to-white pointer is *the* GC correctness bug, and every barrier
  design is a different way of preventing it. Knowing which invariant a runtime maintains tells you
  what its barrier costs.

### 31.6 Modern collector designs
- **Covers** — region-based heaps and G1's remembered-set-per-region model, evacuation pauses and
  pause-time goals, Shenandoah and ZGC with concurrent evacuation via load barriers and coloured
  pointers, Go's concurrent mark-sweep with its short pauses and non-moving trade-off, V8's Orinoco
  with parallel scavenging, and reading a collector's published design to predict its behaviour.
- **Demo** — collector comparison harness: the same trace run through the implemented designs
  (stop-the-world mark-sweep, generational copying, incremental, region-based evacuation) with pause
  histograms, p99 pause, throughput and peak memory reported in one table.
- **Diagram** — mermaid diagram of a region-based heap with per-region remembered sets and an
  evacuation set.
- **Lab** — implement region selection for evacuation by garbage-first ranking; tests assert the
  selected regions maximise reclaimed bytes within the pause budget on fixture heaps.
- **Senior insight** — "garbage first" is literally a scheduling heuristic: collect the regions with
  the most garbage per unit of copying work. Reading it that way makes the tuning flags legible.

### 31.7 Finalisation and weak references
- **Covers** — finalisers and why they are discouraged (resurrection, ordering, timing, leaks),
  phantom and weak references, weak maps and their interaction with cycles, `try`-with-resources
  and RAII as the alternative, cleanup actions, and the general rule that GC manages memory and
  nothing else.
- **Demo** — a resource-leak scenario: file handles held by objects awaiting finalisation, exhausting
  the (simulated) handle limit while memory pressure is low, so no collection is triggered; the
  explicit-close version does not leak.
- **Diagram** — mermaid diagram of the reference strengths and what each keeps alive.
- **Lab** — implement weak references with the collector clearing them before finalisation; tests
  assert weak refs are cleared exactly when the referent becomes unreachable and that resurrection
  is either handled or rejected explicitly.
- **Senior insight** — the classic production failure is exhausting a non-memory resource while the
  heap is nearly empty, so the collector never runs. GC does not manage sockets, handles or locks,
  and the runtime cannot know they are scarce.

### 31.8 Avoiding the collector
- **Covers** — escape analysis and stack allocation (from M29), scalar replacement, object pooling
  and its hazards, arenas and region allocation for phase-structured workloads, off-heap buffers
  (typed arrays here, `ByteBuffer` elsewhere), value types and flattening, and measuring allocation
  rate as the primary lever.
- **Demo** — the same workload written allocation-heavy and allocation-light, with allocation rate,
  GC time, pause count and total throughput compared; the escape-analysis pass from M29 is toggled
  to show what the compiler removes automatically.
- **Diagram** — mermaid flowchart from allocation site through escape analysis to stack, scalar
  replacement or heap.
- **Lab** — reduce a provided workload's allocation rate by 10× without changing its output; graded
  on measured allocations from the instrumented heap and on output equality.
- **Senior insight** — the fastest collection is the one that has nothing to collect; allocation rate
  is the metric to attack first, and it is measurable long before any GC tuning flag is worth
  touching.

### 31.9 Diagnosing GC in production
- **Covers** — reading GC logs, allocation rate versus promotion rate, the pause-distribution view
  rather than the average, throughput versus latency targets, heap sizing and the cost of a heap
  that is too small (constant collection) or too large (long pauses, poor locality), memory leaks in
  managed languages (unbounded caches, listeners, thread-locals, closures capturing more than
  intended), and heap-dump analysis by dominator tree.
- **Demo** — a leak investigation: a running workload whose heap grows, a heap snapshot, the
  dominator tree computed (reusing M13's dominator code on the object graph) and the retaining path
  to the leaked objects displayed.
- **Diagram** — mermaid diagram of a retaining path from a GC root to a leaked object.
- **Lab** — find and fix the leak in a provided workload using the dominator-tree analysis; tests
  assert the heap stabilises over a long run and that the retained set no longer grows.
- **Senior insight** — the dominator tree on the object graph is the same algorithm as in the
  compiler: it answers "if I drop this one reference, how much memory comes back", which is the only
  question a heap dump can usefully answer.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/heap-sim.js` | Simulated heap, headers, allocation sites, liveness oracle |
| `src/js/machines/gc-lab.js` | Trace replay, pause/throughput/footprint metrics |
| `src/js/algorithms/gc-refcount.js` | Naive and deferred counting, trial-deletion cycle collection |
| `src/js/algorithms/gc-mark-sweep.js` | Mark stack, sweep, free list, compaction |
| `src/js/algorithms/gc-copying.js` | Cheney, semi-space, generational with promotion |
| `src/js/algorithms/gc-barriers.js` | Write and read barriers, card tables, remembered sets |
| `src/js/algorithms/gc-incremental.js` | Incremental marking, SATB and incremental-update variants |
| `src/js/algorithms/gc-regions.js` | Region heap, evacuation selection, garbage-first ranking |
| `src/js/algorithms/heap-analysis.js` | Retained size, dominator tree over the object graph |
| `src/js/viz/heap-view.js` | Heap map with mark state, age and fragmentation |

---

## Acceptance criteria

- [ ] Every collector is verified against the liveness oracle: the reclaimed set equals the
      unreachable set, over randomised heaps and recorded traces, with zero live-object collections.
- [ ] Barrier correctness is tested by adversarial interleavings that specifically construct the
      black-to-white pointer scenario; the barrier-free variant fails the same test.
- [ ] Pause distributions are reported as histograms with p50/p99/max — never as an average.
- [ ] The generational collector's cost is shown to scale with survivors, not heap size, by
      measurement across heap sizes.
- [ ] Weak references are cleared exactly at unreachability, asserted per object.
- [ ] The leak lab's fix is validated by a long-run heap-stability assertion, not by inspection.

---

## Sources

- Jones, Hosking, Moss — *The Garbage Collection Handbook*
- Cheney — *A nonrecursive list compacting algorithm*
- Dijkstra et al. — *On-the-fly garbage collection: an exercise in cooperation*
- Ungar — *Generation scavenging*
- Detlefs, Flood, Heller, Printezis — *Garbage-first garbage collection*
- Bacon, Attanasio, Lee, Rajan, Smith — *Java without the coffee breaks* / cycle collection work
- Go and V8 engineering blogs on their collector designs
