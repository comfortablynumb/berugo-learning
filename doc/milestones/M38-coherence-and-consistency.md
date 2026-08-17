# M38 — Cache coherence and memory consistency

> **Track** Computer architecture · **Depends on** M37 · **Sections** 9 · **Effort** L

**Outcome.** The two things every multithreaded program depends on and almost nobody can state
precisely: coherence (all cores agree on the value of one location) and consistency (what orderings
between *different* locations are observable). Built as a multi-core simulator where litmus tests
run and their allowed outcomes are enumerated.

**Shared machinery introduced.** `machines/multicore-sim.js` — several M34 cores sharing the M37
cache hierarchy through a coherent interconnect, with per-message tracing;
`machines/litmus.js` — a litmus-test runner that exhaustively enumerates interleavings under a
chosen consistency model and reports which outcomes are permitted, with the observed results from
simulation alongside; `viz/coherence-view.js` — per-core cache-line states and interconnect traffic.

---

## Sections

### 38.1 The coherence problem and snooping
- **Covers** — what goes wrong with private caches and shared data, the coherence invariants
  (single-writer/multiple-reader, data-value), bus snooping, the MSI protocol's states and
  transitions, write-invalidate versus write-update, and coherence as a per-location property
  distinct from consistency.
- **Demo** — two cores sharing a variable with coherence disabled (stale values visible), then MSI
  enabled: state transitions per core drawn as the accesses proceed, with every bus message logged.
- **Diagram** — mermaid state diagram of MSI with the bus transactions on the edges.
- **Lab** — implement MSI's state machine; tests assert the coherence invariants hold on every
  randomised access interleaving and that no core ever reads a stale value.
- **Senior insight** — coherence gives you "the value of x is agreed" and nothing about the ordering
  between x and y. Almost every wrong intuition about concurrency comes from conflating the two.

### 38.2 MESI, MOESI and coherence traffic
- **Covers** — the exclusive state and the write-upgrade it saves, the owned state and cache-to-cache
  transfer, MESIF, coherence traffic as a scalability limit, the cost of a coherence miss versus a
  capacity miss, and reading a protocol's transition table.
- **Demo** — protocol comparison on the same workload: MSI, MESI and MOESI with bus-message counts,
  cache-to-cache transfers and cycles reported; the read-then-write sequence shows exactly where the
  E state saves a transaction.
- **Diagram** — mermaid state diagram of MESI with the exclusive-state transitions highlighted.
- **Lab** — extend MSI to MESI including the shared-line signal on a read miss; tests assert
  correctness and a measured reduction in upgrade transactions on the private-data fixture.
- **Senior insight** — the E state exists entirely to make single-threaded access to unshared data
  free; when a profiler shows unexpected coherence traffic on data you believe is thread-local, that
  belief is what is wrong.

### 38.3 Directory-based coherence and interconnects
- **Covers** — why snooping does not scale past a shared bus, directory protocols with sharer
  vectors, home nodes and three-hop transactions, directory storage overhead and sparse directories,
  interconnect topologies (bus, ring, mesh, crossbar) with their latency and bandwidth
  characteristics, and coherence across sockets.
- **Demo** — a 16-core mesh with a directory: a request's path from requester to home node to sharers
  is animated across the topology, with hop counts and latency accumulated, and the same request
  under a bus for contrast.
- **Diagram** — mermaid diagram of a three-hop directory transaction across a mesh.
- **Lab** — implement directory state with a sharer bit vector and invalidation collection; tests
  assert every sharer is invalidated before a write completes, across randomised topologies and
  interleavings.
- **Senior insight** — directory coherence turns "broadcast to everyone" into "message the owner",
  which is exactly the same architectural move as replacing a broadcast bus with a service registry
  in distributed systems (M56).

### 38.4 False sharing and layout
- **Covers** — the cache line as the unit of coherence, false sharing and its symptom profile
  (scaling that gets worse with more threads), padding and alignment, per-CPU/per-thread data
  structures, the sharded-counter pattern, contention on adjacent fields in a hot struct, and how to
  detect false sharing from counters.
- **Demo** — the false-sharing demonstration: N threads incrementing adjacent counters in one array
  with throughput plotted against thread count (it *decreases*), then padded to separate lines with
  the throughput restored, plus the coherence-message counts for both.
- **Diagram** — mermaid diagram of two cores ping-ponging one cache line between them.
- **Lab** — fix a provided false-sharing bug by padding and by sharding; tests assert identical
  results and a measured drop in coherence traffic and improvement in simulated throughput.
- **Senior insight** — false sharing scales *negatively* with core count, which makes it one of the
  few bugs that gets more expensive as hardware improves; the signature is a parallel speed-up curve
  that bends downward.

### 38.5 Memory consistency models
- **Covers** — program order versus memory order, sequential consistency and its cost, total store
  order (x86) with store buffering, weaker models (ARM, POWER) with reordering of loads and stores,
  the classic litmus tests (store buffering, message passing, independent reads of independent
  writes, load buffering), what each model permits, and reading a vendor's memory-ordering
  specification.
- **Demo** — the litmus-test runner: pick a test and a model, see the exhaustive enumeration of
  outcomes with the permitted set marked, then run it on the simulator and see which outcomes
  actually occur and how often.
- **Diagram** — mermaid diagram of the store-buffering litmus test with the surprising outcome
  marked.
- **Lab** — implement the store-buffer model that makes the SB test's non-SC outcome possible; tests
  assert that the simulator reproduces exactly the outcomes the TSO model permits, and none of the
  ones it forbids.
- **Senior insight** — the store-buffering outcome (both threads read 0) is legal on every real
  x86 machine, and it is the case that breaks hand-rolled Dekker-style synchronisation. This test is
  the shortest path to understanding why fences exist.

### 38.6 Atomics and read-modify-write
- **Covers** — why `x++` is not atomic, atomic read-modify-write instructions, compare-and-swap,
  load-linked/store-conditional and its spurious failures, the ABA problem (previewing M47), the
  cost of an atomic (line ownership plus ordering), contention and its scaling behaviour, and
  backoff strategies.
- **Demo** — contention laboratory: N cores performing atomic increments on one location, with
  throughput per core, retry counts and coherence traffic plotted against N; sharded counters and
  backoff are toggleable and their effect measured.
- **Diagram** — mermaid sequence diagram of two cores racing on a CAS with one retrying.
- **Lab** — implement LL/SC semantics in the simulator including spurious failure; tests assert that
  a correct CAS loop built on it always makes progress and that an implementation ignoring
  spurious failure is caught.
- **Senior insight** — an uncontended atomic costs a few tens of cycles; a contended one costs the
  coherence round trip times the number of retries, which is why "just use an atomic counter"
  collapses at 32 cores and needs sharding.

### 38.7 Fences and barriers
- **Covers** — hardware fences (full, acquire, release, store-store, load-load) and their costs,
  compiler barriers versus hardware barriers, why both are needed, the acquire/release idiom and the
  synchronises-with relation, sequentially consistent atomics and their extra cost, and reading
  generated assembly to see which fences the compiler emitted.
- **Demo** — the message-passing litmus test run with no fences (broken on the weak model), with
  release/acquire (correct) and with full fences (correct, slower), showing outcomes and cycle costs
  for each.
- **Diagram** — mermaid diagram of the synchronises-with edge created by a release/acquire pair.
- **Lab** — insert the minimum fences needed to make a provided message-passing pattern correct under
  the weak model; tests assert the forbidden outcome never occurs and that no unnecessary full fence
  was used.
- **Senior insight** — acquire/release is not a weaker version of sequential consistency, it is a
  *different* guarantee: it orders one pair of operations, and it is exactly enough for the
  publish-then-read pattern that most lock-free code actually needs.

### 38.8 Language memory models
- **Covers** — the data-race-free guarantee (race-free programs behave sequentially consistently),
  the C++11/Java memory models and their memory_order parameters, out-of-thin-air values and why
  they are hard to rule out formally, JavaScript's model with `SharedArrayBuffer` and `Atomics`,
  volatile in Java versus C, and mapping language-level orderings to hardware fences per
  architecture.
- **Demo** — the mapping table made executable: choose a language-level ordering and a target
  architecture and see the fences emitted, then run the litmus test through the simulator for that
  architecture to confirm the guarantee holds.
- **Diagram** — mermaid diagram mapping language orderings to per-architecture fence sequences.
- **Lab** — implement a correct spin lock using JavaScript `Atomics` with acquire/release semantics
  in a Web Worker; tests assert mutual exclusion under a stress test and that removing the ordering
  breaks it detectably.
- **Senior insight** — the DRF guarantee is the whole contract: if your program has no data races,
  you never need to think about any of this; the moment it has one, all bets are off and the
  behaviour is not "a stale value", it is undefined.

### 38.9 Verifying concurrent code against a model
- **Covers** — writing litmus tests for your own algorithm, exhaustive interleaving exploration and
  its state-space limits, model checking a concurrent algorithm (linking to M32), stress testing
  with randomised interleavings and why it misses rare orderings, the herd/litmus tooling approach,
  and how to document the ordering requirements of a data structure.
- **Demo** — bring your own algorithm: paste a small lock-free operation, the tool enumerates
  interleavings under the chosen model and reports any violated invariant with the exact
  interleaving that caused it.
- **Diagram** — mermaid diagram of an interleaving tree with the violating path highlighted.
- **Lab** — write litmus tests capturing the ordering requirements of a provided lock-free stack, and
  find the interleaving that breaks a deliberately under-fenced version; tests assert the violating
  interleaving is found and that the fixed version passes exhaustive exploration.
- **Senior insight** — stress testing finds coarse bugs and misses the rare interleavings that
  matter; exhaustive exploration of a *small* model is far more likely to find the real bug, which
  is the same argument M32 makes for model checking.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/multicore-sim.js` | Multiple cores, shared hierarchy, interconnect, tracing |
| `src/js/machines/coherence/msi.js`, `mesi.js`, `moesi.js` | Snooping protocols |
| `src/js/machines/coherence/directory.js` | Sharer vectors, home nodes, three-hop transactions |
| `src/js/machines/interconnect.js` | Bus, ring, mesh topologies with latency modelling |
| `src/js/machines/consistency-models.js` | SC, TSO, PSO, weak, with permitted-outcome enumeration |
| `src/js/machines/litmus.js` | Litmus-test definitions, exhaustive exploration, result comparison |
| `src/js/algorithms/atomics-sim.js` | CAS, LL/SC with spurious failure, backoff strategies |
| `src/js/viz/coherence-view.js` | Per-core line states and interconnect message flow |
| `src/js/viz/interleaving-view.js` | Interleaving tree with violation highlighting |

---

## Acceptance criteria

- [ ] Every coherence protocol maintains the single-writer/multiple-reader invariant across 10⁵
      randomised interleavings, checked by an independent monitor.
- [ ] The litmus runner's permitted-outcome sets match the published results for the standard tests
      under each model; a discrepancy fails the build.
- [ ] The simulator produces only outcomes its configured model permits, verified by running each
      litmus test exhaustively.
- [ ] False sharing is demonstrated with measured negative scaling, and the padded version restores
      it — both as assertions, not screenshots.
- [ ] LL/SC spurious failure is injected in tests, and any implementation that assumes success is
      caught.
- [ ] The JavaScript `Atomics` spin-lock lab is validated by a real multi-worker stress test with
      mutual exclusion checked by a shared counter invariant.

---

## Sources

- Sorin, Hill, Wood — *A Primer on Memory Consistency and Cache Coherence*
- Hennessy, Patterson — *Computer Architecture*, chapter 5
- Lamport — *How to make a multiprocessor computer that correctly executes multiprocess programs*
- Sewell et al. — *x86-TSO: a rigorous and usable programmer's model for x86 multiprocessors*
- Alglave, Maranget, Tautschnig — *Herding cats: modelling, simulation, testing, and data mining for weak memory*
- Boehm, Adve — *Foundations of the C++ concurrency memory model*
- Manson, Pugh, Adve — *The Java memory model*
