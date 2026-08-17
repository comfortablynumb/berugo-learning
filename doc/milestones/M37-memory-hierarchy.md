# M37 — Caches and the memory hierarchy

> **Track** Computer architecture · **Depends on** M34 · **Sections** 10 · **Effort** L

**Outcome.** The hierarchy, measured. A configurable multi-level cache, TLB and DRAM model wired
into the CPU from M34, plus the software-side techniques that move a program from memory-bound to
compute-bound — with the improvement visible as miss counts, not just as a stopwatch.

**Shared machinery introduced.** `machines/cache-sim.js` (promoted from M21 to full fidelity):
multi-level caches with configurable size, associativity, line size, replacement and write policy,
inclusion policy, MSHRs, prefetchers, a TLB and page-table walker, a DRAM timing model and a NUMA
topology; `viz/cache-view.js` — set/way grid with live tags, hit/miss animation and a heat map.

---

## Sections

### 37.1 The hierarchy and the numbers
- **Covers** — why the hierarchy exists (SRAM versus DRAM versus flash from M33's cells), typical
  capacities, latencies and bandwidths at each level in cycles and nanoseconds, the growth of the
  processor–memory gap, locality (temporal and spatial) as the property that makes caching work, and
  the "latency numbers every engineer should know" with an emphasis on the ratios rather than the
  absolute figures.
- **Demo** — the latency ladder: an interactive chart of each level's capacity and latency, with a
  program's access distribution overlaid to show where its time actually goes.
- **Diagram** — mermaid diagram of the hierarchy with capacity and latency annotated per level.
- **Lab** — implement a pointer-chase microbenchmark that discovers cache sizes from measured
  latency steps; tests assert the discovered boundaries match the simulator's configured sizes.
- **Senior insight** — the ratios are what matter and they are stable: L1 is a few cycles, DRAM is
  hundreds, and an SSD is hundreds of thousands. Any design decision that changes which level you
  land on dominates every other optimisation.

### 37.2 Cache organisation
- **Covers** — blocks/lines, the tag/index/offset decomposition of an address, direct-mapped, set-
  associative and fully associative organisation, the conflict/complexity trade-off, line size and
  its effect on spatial locality and pollution, cache indexing with virtual versus physical
  addresses, and the aliasing problem.
- **Demo** — address decomposer plus set/way grid: enter an address and see which set and way it maps
  to and which tag is compared; a configuration panel changes size, associativity and line size and
  the mapping updates live.
- **Diagram** — mermaid diagram of an address split into tag, index and offset with the set lookup.
- **Lab** — implement cache lookup with tag comparison and the LRU update; tests assert hit/miss
  results against a reference model over recorded access traces for several configurations.
- **Senior insight** — the index bits come from the *middle* of the address, which is why arrays
  stride-aligned to a power of two conflict catastrophically; that single fact explains most
  mysterious performance cliffs.

### 37.3 Policies
- **Covers** — write-through versus write-back with a write buffer, write-allocate versus
  no-write-allocate, dirty bits, replacement policies (true LRU's cost, pseudo-LRU trees, random,
  RRIP), inclusive/exclusive/non-inclusive hierarchies and their coherence consequences (M38), and
  the victim cache.
- **Demo** — policy matrix: the same trace run across write and replacement policies with hit rate,
  write traffic to the next level and dirty-eviction counts reported for each combination.
- **Diagram** — mermaid state diagram of a cache line's MESI-free lifecycle (invalid, clean, dirty)
  under write-back.
- **Lab** — implement pseudo-LRU with a tree of bits and compare against true LRU; tests assert the
  hit-rate difference stays within a small bound on real traces while using far fewer state bits.
- **Senior insight** — write-back plus write-allocate is nearly universal because it converts
  repeated writes into one memory transaction; the exception is streaming writes, which is why
  non-temporal store instructions exist.

### 37.4 Cache performance analysis
- **Covers** — the three Cs (compulsory, capacity, conflict) and how to measure each by simulation,
  average memory access time and its recursive formula across levels, miss rate versus misses per
  instruction versus misses per second, the difference between a miss rate and a stall cycle, and
  the effect of out-of-order overlap (from M36) on the true cost of a miss.
- **Demo** — three-Cs decomposition for any trace: run against an infinite cache, a fully
  associative cache of the same size and the real configuration, deriving each category, with AMAT
  computed and displayed against measured cycles.
- **Diagram** — mermaid diagram of the three-Cs classification decision.
- **Lab** — implement the three-Cs classifier by parallel simulation; tests assert the categories
  sum to the total miss count and match hand-computed values on a designed fixture.
- **Senior insight** — a high miss rate on a small working set is conflict, on a large one is
  capacity, and the fixes are completely different (padding/layout versus blocking). The
  decomposition tells you which fix to reach for.

### 37.5 Optimising software for the cache
- **Covers** — loop interchange for stride-1 access, blocking/tiling with tile-size selection,
  array padding to break conflicts, structure layout and AoS versus SoA (revisiting M02),
  alignment, hot/cold field splitting, cache-line-aware data structures, and false sharing as a
  preview of M38.
- **Demo** — matrix multiply optimisation walkthrough: naive, interchanged, blocked and blocked plus
  padded, with miss counts per level, AMAT and simulated cycles after each step, so each
  transformation's contribution is separately visible.
- **Diagram** — mermaid diagram of tiled matrix multiplication showing which blocks are resident.
- **Lab** — choose the tile size for a given cache configuration analytically, then verify by
  simulation; tests assert the chosen size is within one step of the empirical optimum.
- **Senior insight** — the analytical tile-size calculation (three tiles must fit in the cache) gets
  you within a factor of the optimum immediately, which is why this is one of the few optimisations
  worth doing by hand before measuring.

### 37.6 Virtual memory and the TLB
- **Covers** — the virtual-to-physical mapping, multi-level page tables and the walk cost, the TLB
  as a cache of translations, TLB reach and why it is often the real limit, huge pages and their
  trade-offs, virtually indexed physically tagged caches and the aliasing constraints, page-table
  walk caches, and context switch costs (ASIDs, TLB shootdown previewed for M43/M47).
- **Demo** — translation viewer: a virtual address walked through the page-table levels with each
  memory access counted, then the same access served by the TLB; a working-set slider shows TLB
  reach being exceeded and the walk cost appearing in the cycle count.
- **Diagram** — mermaid diagram of a four-level page-table walk with the TLB shortcut.
- **Lab** — implement the page-table walker and the TLB with ASIDs; tests assert correct translation
  against a reference mapping, correct fault behaviour on unmapped pages, and that a context switch
  does not leak translations between address spaces.
- **Senior insight** — a TLB miss costs several dependent memory accesses, so a workload with a
  large sparse working set can be TLB-bound while its data fits in cache; huge pages fix that
  specific problem and nothing else.

### 37.7 Prefetching
- **Covers** — hardware prefetchers (next-line, stride, stream, and a note on more complex
  designs), prefetch distance and timeliness, accuracy and coverage as the two metrics, cache
  pollution from wrong prefetches, software prefetch instructions and when they help, prefetching
  for pointer chasing (and why it mostly cannot work), and prefetcher interaction with
  multithreading.
- **Demo** — prefetcher laboratory: access patterns (sequential, strided, random, pointer chase)
  against each prefetcher, with coverage, accuracy, timeliness and net cycle effect reported —
  including a case where prefetching makes things worse.
- **Diagram** — mermaid diagram of a stride prefetcher's detection table and issue decision.
- **Lab** — implement a stride prefetcher with a confidence counter; tests assert coverage above a
  threshold on the strided fixture and that accuracy stays high on the random fixture (by not
  prefetching).
- **Senior insight** — a prefetcher that is 50% accurate is often net negative: the wasted bandwidth
  and evicted lines cost more than the hits gained. Coverage without accuracy is not a win.

### 37.8 DRAM
- **Covers** — the DRAM organisation (channels, ranks, banks, rows, columns), row buffers and
  row-hit versus row-miss versus row-conflict timing, the timing parameters (tRCD, tCAS, tRP) and
  where the "latency" number comes from, refresh and its overhead, memory-controller scheduling
  (FR-FCFS), bank-level parallelism, address interleaving, and bandwidth versus latency under load.
- **Demo** — DRAM timeline: requests scheduled across banks with row activations, hits and conflicts
  drawn on a time axis; changing the address-interleaving scheme visibly changes the row-hit rate
  and achieved bandwidth.
- **Diagram** — mermaid diagram of a bank with its row buffer and the three access outcomes.
- **Lab** — implement the FR-FCFS scheduling policy; tests assert row-hit rate improvement over FCFS
  on the fixture trace with no request starved beyond a bound.
- **Senior insight** — DRAM latency under load is dominated by queueing and row conflicts, not by
  the data-sheet numbers; that is why the loaded-latency curve, not the idle latency, is what
  matters for a real workload.

### 37.9 NUMA
- **Covers** — multi-socket topology, local versus remote memory latency and bandwidth, the
  first-touch allocation policy, thread and memory affinity, page migration, interleaving for
  bandwidth versus locality for latency, NUMA effects inside a single socket (chiplets, sub-NUMA
  clustering), and diagnosing a NUMA problem.
- **Demo** — NUMA simulator: threads pinned to nodes accessing memory allocated on chosen nodes,
  with a latency/bandwidth matrix and total throughput; a first-touch toggle reproduces the classic
  "allocate in main thread, use in workers" mistake and its measured cost.
- **Diagram** — mermaid diagram of a two-node topology with local and remote access paths.
- **Lab** — implement a first-touch allocation policy and a page-migration heuristic; tests assert
  improved locality on the fixture access pattern and that migration does not thrash under
  alternating access.
- **Senior insight** — "allocate where you will use it" is the entire NUMA rule, and the common
  violation is initialising a large buffer in one thread before handing chunks to workers — which is
  exactly what a parallel-for over a freshly allocated array does by default.

### 37.10 Measuring the hierarchy
- **Covers** — designing microbenchmarks that isolate one level, the pointer-chase for latency and
  the stream benchmark for bandwidth, avoiding prefetcher interference, hardware performance
  counters (what they count and their pitfalls), deriving cache parameters empirically, the roofline
  model as the summary (previewing M40 and M58), and reporting results with the configuration
  stated.
- **Demo** — the full measurement suite run against the simulator: cache sizes and associativity
  discovered from latency curves, bandwidth per level measured, TLB reach found, and the results
  compared against the known configuration to show the method's accuracy and its blind spots.
- **Diagram** — mermaid flowchart of the parameter-discovery method with the confounders it must
  avoid.
- **Lab** — implement associativity discovery by conflict-set construction; tests assert the
  discovered associativity matches the configuration for several cache setups.
- **Senior insight** — you can derive an unknown machine's cache hierarchy from timing alone in
  about fifty lines, which is both a great debugging skill and, in another context, the primitive
  behind the side channels in M36.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/cache-sim.js` | Multi-level caches, policies, MSHRs, inclusion, statistics |
| `src/js/machines/tlb-sim.js` | TLB, page-table walker, ASIDs, huge pages |
| `src/js/machines/dram-sim.js` | Banks, row buffers, timing parameters, controller scheduling |
| `src/js/machines/numa-sim.js` | Topology, local/remote costs, allocation policies, migration |
| `src/js/algorithms/prefetchers.js` | Next-line, stride, stream with confidence and metrics |
| `src/js/algorithms/three-cs.js` | Parallel-simulation miss classification |
| `src/js/algorithms/cache-microbench.js` | Pointer chase, stream, conflict-set construction |
| `src/js/viz/cache-view.js` | Set/way grid, hit/miss animation, heat map |
| `src/js/viz/dram-timeline-view.js` | Bank timeline with activations and conflicts |

---

## Acceptance criteria

- [ ] The cache model's hit/miss decisions match a reference implementation on recorded traces for
      every configuration in the test matrix.
- [ ] The three-Cs decomposition sums exactly to the total miss count on every trace.
- [ ] Parameter discovery recovers the configured cache sizes, line size, associativity and TLB
      reach from timing data alone, within one step.
- [ ] The blocked matrix-multiply lab shows a measured miss-count reduction matching the analytical
      prediction within a stated tolerance.
- [ ] The prefetcher's coverage and accuracy are both reported; a prefetcher that improves coverage
      while degrading net cycles is flagged by the harness rather than praised.
- [ ] The NUMA first-touch demo reproduces the misallocation penalty with measured numbers.

---

## Sources

- Hennessy, Patterson — *Computer Architecture: A Quantitative Approach*, chapter 2 and appendix B
- Drepper — *What every programmer should know about memory*
- Jacob, Ng, Wang — *Memory Systems: Cache, DRAM, Disk*
- Rixner et al. — *Memory access scheduling* (FR-FCFS)
- Yotov et al. — automatic measurement of memory-hierarchy parameters
- McCalpin — the STREAM benchmark
- Lameter — *NUMA (Non-Uniform Memory Access): an overview*
