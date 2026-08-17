# M21 — Online, external-memory and cache-oblivious algorithms

> **Track** Algorithms · **Depends on** M10, M37 · **Sections** 9 · **Effort** M

**Outcome.** Cost models other than the RAM model. Every algorithm in the earlier milestones was
analysed as if memory were flat and the future were known; this milestone drops each assumption in
turn and shows what changes — which is exactly the gap between textbook complexity and production
behaviour.

**Shared machinery introduced.** `machines/cache-sim.js` — a configurable multi-level cache and
disk model (line size, associativity, capacity, replacement policy) that instruments any algorithm
written against `memory-model.js` from M02, reporting misses per level; `machines/online-lab.js` —
adversarial and stochastic request-sequence generators with an offline-optimal solver for
competitive-ratio measurement.

> Note: this milestone reuses the cache simulator that M37 builds properly against real cache
> parameters. If M21 is built first, `cache-sim.js` ships here in simplified form and M37 extends
> it; the dependency is on the module, not the section order.

---

## Sections

### 21.1 Online algorithms and competitive analysis
- **Covers** — the online model (irrevocable decisions without the future), the competitive ratio
  against an offline optimum, deterministic versus randomised competitiveness, the adversary
  models (oblivious, adaptive), ski rental and its 2-competitive and e/(e−1)-randomised solutions,
  and list update with move-to-front.
- **Demo** — ski rental with an adversarial sequence generator: the learner picks a strategy, the
  adversary responds, and the achieved ratio is plotted against the proven bound over many rounds.
- **Diagram** — mermaid diagram of the decision timeline with the offline optimum revealed after
  the fact.
- **Lab** — implement the randomised ski-rental strategy; tests assert the expected ratio beats the
  deterministic 2 bound over many seeds against the worst-case adversary.
- **Senior insight** — competitive analysis is the formal version of every "should I keep the
  connection open or reconnect" decision, and the 2-competitive answer (spend until you have spent
  what buying costs) is a genuinely useful default.

### 21.2 Caching and page-replacement policies
- **Covers** — Belady's optimal offline policy, LRU, LFU, FIFO, CLOCK and second-chance, the
  k-competitiveness of LRU, scan resistance, ARC's adaptive balance, 2Q, LIRS, W-TinyLFU with an
  admission filter, and the interaction with cache size (the working-set curve).
- **Demo** — replay a request trace (Zipf, scan, loop, mixed) through every policy simultaneously
  with hit rates plotted against cache size; Belady's optimum is drawn as the unreachable ceiling.
- **Diagram** — mermaid state diagram of ARC's four lists and the adaptation between them.
- **Lab** — implement CLOCK and W-TinyLFU admission; tests assert the hit rate exceeds LRU on the
  scan-heavy trace and is not worse on the Zipf trace.
- **Senior insight** — LRU is not scan resistant, which is why one full-table scan can evict an
  entire working set. Every serious cache since has been an answer to that single failure.

### 21.3 Online scheduling and load balancing
- **Covers** — list scheduling and its (2 − 1/m) bound, LPT for the offline case, online bin
  packing (next-fit, first-fit, best-fit) and their bounds, the power of two random choices, the
  balls-in-bins baseline, and consistent hashing as an online assignment strategy (previewing M56).
- **Demo** — assign an arriving stream of jobs to m machines by each policy: the maximum load is
  plotted live against the offline optimum, and the two-choices policy's exponential improvement in
  maximum load is visible.
- **Diagram** — mermaid diagram of the two-choices decision comparing two sampled bins.
- **Lab** — implement the power-of-two-choices assignment; tests assert the maximum load is
  O(log log n) rather than O(log n / log log n) over many seeds, measured empirically.
- **Senior insight** — sampling two backends and picking the less loaded is a one-line change to a
  random load balancer and it collapses tail load; it is the highest ratio of benefit to effort in
  this milestone.

### 21.4 Bin packing and resource allocation
- **Covers** — offline bin packing with first-fit-decreasing and its 11/9 bound, online bounds and
  lower bounds, multidimensional packing (CPU and memory together) and why it is harder,
  bin-packing formulations of VM placement and container scheduling, and fragmentation as the
  underlying phenomenon.
- **Demo** — pack a workload into machines with a selectable policy in one and two dimensions;
  wasted capacity, machine count and fragmentation are reported against the LP lower bound.
- **Diagram** — mermaid diagram of two-dimensional packing where one-dimensional intuition fails.
- **Lab** — implement first-fit-decreasing and measure the ratio against the optimal packing from
  the brute-force solver on small instances; tests assert the 11/9 + constant bound holds.
- **Senior insight** — cluster schedulers are online multidimensional bin packers, and the reason a
  cluster reports 60% utilisation while rejecting jobs is fragmentation, not capacity.

### 21.5 The external-memory model
- **Covers** — the DAM model with parameters M (memory) and B (block size), counting I/Os rather
  than operations, the scan bound N/B, the sorting bound (N/B)·log_{M/B}(N/B), the B-tree search
  bound log_B N, why an in-memory-optimal algorithm can be I/O-terrible, buffer trees, and
  external-memory graph algorithms.
- **Demo** — the same computation (sort, join, transpose) run under the DAM simulator with M and B
  adjustable: I/O counts plotted against the theoretical bounds, with the naive in-memory-style
  algorithm shown alongside.
- **Diagram** — mermaid diagram of the memory/disk hierarchy with the model's two parameters
  labelled.
- **Lab** — implement external merge sort against the DAM simulator and match the predicted I/O
  count; tests assert the measured I/Os are within 10% of the formula.
- **Senior insight** — the DAM model is the reason a database's cost model counts pages, not rows,
  and it is why "it is fast on my laptop" stops predicting anything once the data exceeds RAM.

### 21.6 Cache-oblivious algorithms
- **Covers** — the cache-oblivious model (optimal without knowing M or B), the van Emde Boas layout
  for search trees, cache-oblivious matrix transpose and multiplication by recursive subdivision,
  funnelsort, the tall-cache assumption, and how cache-oblivious compares with cache-aware tuning in
  practice.
- **Demo** — matrix multiplication three ways (naive, tiled with a tuned tile size, recursive
  cache-oblivious) against the cache simulator with varying cache sizes: the tuned version wins at
  its tuned size, the oblivious version tracks near-optimal at all sizes.
- **Diagram** — mermaid diagram of the recursive subdivision producing an implicit blocking.
- **Lab** — implement recursive cache-oblivious matrix transpose; tests assert correctness and a
  miss count within a constant factor of the tiled version across three cache configurations.
- **Senior insight** — cache-oblivious designs are how a library gets good behaviour on machines it
  was never tuned for, which matters more than peak performance on one machine.

### 21.7 The streaming model
- **Covers** — one pass or few passes with sub-linear space, what is impossible (exact distinct
  count, exact median) and the lower-bound arguments behind it, sliding windows, the sketches from
  M07 placed in the model, multi-pass trade-offs, and turnstile versus cash-register streams.
- **Demo** — attempt exact and approximate answers to the same query under a hard space budget: the
  exact structure exceeds the budget and is killed, the sketch answers within its error band, both
  shown on one memory gauge.
- **Diagram** — mermaid diagram of the stream model's constraints (one pass, sub-linear space).
- **Lab** — implement a two-pass exact algorithm and a one-pass approximate one for the same query,
  and report the space/accuracy trade-off; tests assert both meet their stated bounds.
- **Senior insight** — knowing which questions are provably impossible in one pass stops a whole
  class of "just make it exact" requirements from being accepted in a design review.

### 21.8 Parallel models and work-span analysis
- **Covers** — the PRAM model and its variants, work and span (depth), Brent's theorem and the
  speed-up bound, parallel prefix scan as the canonical primitive, parallel reduction, merge and
  sort, MapReduce and BSP as coarse-grained models, communication cost, and Amdahl and Gustafson
  read correctly.
- **Demo** — parallel scan visualised as up-sweep and down-sweep over a tree with work and span
  counted; a processor-count slider shows the predicted speed-up from Brent's theorem against a
  simulated schedule.
- **Diagram** — mermaid diagram of the up-sweep/down-sweep scan tree.
- **Lab** — implement work-efficient parallel prefix scan (simulated with a scheduler) and verify
  work O(n) and span O(log n); tests assert both counts and the correctness of the result.
- **Senior insight** — span, not core count, bounds your speed-up. An algorithm with linear span
  will not go faster on more cores no matter how parallel the implementation looks.

### 21.9 Choosing a cost model
- **Covers** — matching the model to the machine, when the RAM model predicts well and when it does
  not, measuring which resource actually binds (instructions, misses, I/Os, network round trips,
  energy), building a cost model for your own system, and validating a model against measurements.
- **Demo** — the model bake-off: one workload, four predictions (RAM, cache-aware, DAM, parallel),
  and the measured result plotted against all four so the learner can see which model was right and
  by how much.
- **Diagram** — mermaid decision flowchart from workload characteristics to the appropriate model.
- **Lab** — given an unlabelled workload, identify the binding resource from measurements and
  predict the effect of a proposed change; graded against the measured outcome.
- **Senior insight** — the highest-value analytical skill is knowing which cost model applies before
  optimising; the wrong model produces confident, precise, useless predictions.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/cache-sim.js` | Multi-level cache and disk model with policies and counters |
| `src/js/machines/online-lab.js` | Request generators, adversaries, offline optimum |
| `src/js/algorithms/replacement-policies.js` | LRU, LFU, FIFO, CLOCK, ARC, 2Q, LIRS, W-TinyLFU, Belady |
| `src/js/algorithms/online-scheduling.js` | List scheduling, two choices, bin packing family |
| `src/js/algorithms/external-algorithms.js` | External sort, external join, buffer tree |
| `src/js/algorithms/cache-oblivious.js` | vEB layout, recursive transpose and matmul, funnelsort |
| `src/js/algorithms/parallel-primitives.js` | Scan, reduce, merge, sort with work/span accounting |
| `src/js/viz/policy-compare-view.js` | Hit-rate curves and per-policy state rendering |

---

## Acceptance criteria

- [ ] Every policy in 21.2 is measured against Belady's optimum on the same traces, and the scan
      trace demonstrably separates the scan-resistant policies from LRU.
- [ ] Competitive ratios are measured against a real offline optimum computed by the lab, never
      quoted from the literature alone.
- [ ] External-memory algorithms match their predicted I/O counts within 10% under the DAM
      simulator, across at least three (M, B) configurations.
- [ ] Cache-oblivious implementations are within a constant factor of tuned implementations across
      three cache configurations, asserted in tests.
- [ ] Parallel primitives report measured work and span, and the tests assert the asymptotic claims.
- [ ] Each section states which resource its cost model counts, and every reported number names its
      unit.

---

## Sources

- Borodin, El-Yaniv — *Online Computation and Competitive Analysis*
- Sleator, Tarjan — *Amortized efficiency of list update and paging rules*
- Aggarwal, Vitter — *The input/output complexity of sorting and related problems*
- Frigo, Leiserson, Prokop, Ramachandran — *Cache-oblivious algorithms*
- Megiddo, Modha — *ARC: a self-tuning, low overhead replacement cache*
- Einziger, Friedman, Manes — *TinyLFU: a highly efficient cache admission policy*
- Mitzenmacher — *The power of two choices in randomized load balancing*
- Blelloch — *Prefix sums and their applications*
