# M36 — Superscalar, out-of-order execution and speculation

> **Track** Computer architecture · **Depends on** M35 · **Sections** 9 · **Effort** L

**Outcome.** The modern core: multiple instructions issued per cycle, executed out of order,
committed in order, with speculation everywhere. The simulator makes the invisible visible — why two
programs with identical instruction counts differ by 3× in cycles, and why the answer is almost
never "the code is longer".

**Shared machinery introduced.** `machines/ooo-core.js` — a configurable out-of-order core
(issue width, reservation stations, ROB size, physical register file, functional-unit mix, load/store
queue, cache from M37) executing BRV32 with a full per-cycle event log;
`viz/ooo-view.js` — the in-flight instruction window showing each instruction's state (issued,
waiting, executing, completed, committed) per cycle.

---

## Sections

### 36.1 Instruction-level parallelism and its limits
- **Covers** — true, anti and output dependences, the dependence graph of a basic block, ILP as the
  critical path through it, the limits imposed by branches and memory ambiguity, the classic
  "infinite resources" ILP studies and their disappointing numbers, and where ILP actually comes
  from in real code.
- **Demo** — ILP analyser: for any basic block or trace, build the dependence graph, compute the
  critical path and report the maximum achievable IPC with unlimited resources against the IPC the
  simulated core actually achieves.
- **Diagram** — mermaid DAG of instruction dependences with the critical path highlighted.
- **Lab** — implement critical-path computation over a dependence graph including memory
  dependences; tests assert the computed bound is never exceeded by the simulator on any fixture.
- **Senior insight** — the achievable IPC is a property of the code's dependence structure, not of
  the CPU; when a loop will not go faster, the dependence chain is usually the reason and no
  microarchitecture will fix it.

### 36.2 Dynamic scheduling: scoreboarding and Tomasulo
- **Covers** — the scoreboard's structural/RAW/WAR/WAW bookkeeping and its stalls, Tomasulo's
  register renaming through reservation stations, the common data bus, tag-based wakeup, why
  renaming removes WAR and WAW entirely, and the issue/execute/write-back timeline per instruction.
- **Demo** — Tomasulo stepper: reservation stations, the register alias table and the CDB shown per
  cycle, with each instruction's tag dependencies drawn as arrows; a scoreboard mode runs the same
  code so the extra stalls are visible.
- **Diagram** — mermaid diagram of a reservation station waiting on a tag and being woken by the CDB.
- **Lab** — implement register renaming with the alias table and free list; tests assert that WAR and
  WAW hazards never cause a stall and that architectural results match the in-order reference.
- **Senior insight** — renaming is the idea: the architectural register set is a naming convention,
  and the hardware maintains a much larger physical set underneath. The same trick appears in SSA
  (M29) and in MVCC (M53).

### 36.3 The reorder buffer and precise state
- **Covers** — in-order commit as the mechanism for precise exceptions in an out-of-order machine,
  the ROB structure, speculative versus architectural state, committing stores, the ROB as a
  bottleneck, checkpointing for fast recovery, and the interaction with the physical register file's
  reclamation.
- **Demo** — ROB viewer: entries filling and retiring in order while execution completes out of
  order, with an exception raised mid-window so the learner can watch younger entries be discarded
  and state restored.
- **Diagram** — mermaid diagram of the ROB with out-of-order completion and in-order commit marked.
- **Lab** — implement ROB commit including store retirement and exception handling; tests assert
  precise architectural state at every exception and that no speculative store becomes visible.
- **Senior insight** — the ROB is why an out-of-order machine can pretend to be sequential; it is
  also the structure whose size limits how far ahead the machine can run past a cache miss, which is
  the real reason ROB sizes keep growing.

### 36.4 Superscalar issue
- **Covers** — issue width and the dependency-check cost that grows quadratically with it, the issue
  queue and its wakeup/select loop, multiple functional units and port assignment, the front-end
  fetch bandwidth requirement, decode width, the µop cache, and why practical widths plateaued.
- **Demo** — width explorer: run the same program at issue widths 1 to 8 and see IPC rise and
  saturate, with the limiting factor identified per configuration (fetch bandwidth, dependence
  chain, functional-unit contention or ROB size).
- **Diagram** — mermaid diagram of the wakeup/select loop across an issue queue.
- **Lab** — implement port-based issue with a functional-unit mix; tests assert no port is
  double-issued in a cycle and that the reported IPC matches an independent recount of the event log.
- **Senior insight** — the reason a wider machine does not go proportionally faster is almost always
  the front end or the dependence chain; the width-explorer curve is the single most useful picture
  in this milestone.

### 36.5 Speculation and recovery
- **Covers** — speculating past branches and how far, misprediction recovery (checkpoint restore
  versus ROB drain) and its cycle cost, memory dependence speculation and the store-to-load
  forwarding predictor, value prediction as the idea that mostly did not pay off, the recovery
  penalty budget, and the cost of a wrong speculation in wasted energy.
- **Demo** — the recovery viewer: a mispredicted branch with the speculative window shown, the
  recovery mechanism selected by the learner, and the wasted work counted in instructions and
  cycles; a memory-dependence misspeculation is shown separately with its own recovery.
- **Diagram** — mermaid diagram of the speculative window and the checkpoint restore point.
- **Lab** — implement memory dependence speculation with a store-set predictor; tests assert
  correctness (no load ever reads a stale value) and a measured reduction in load stalls versus
  conservative ordering.
- **Senior insight** — speculation is why misprediction costs energy and not just time; on
  battery-limited devices the wasted work is a real budget item, and it is why efficiency cores
  speculate less.

### 36.6 Memory-level parallelism
- **Covers** — non-blocking caches and miss status holding registers, overlapping multiple misses,
  the memory-level parallelism metric, store buffers and store-to-load forwarding, load/store queue
  ordering rules, hardware prefetching (previewing M37) and how it interacts with out-of-order
  execution, and why a pointer-chasing loop cannot use any of it.
- **Demo** — MLP comparison: an array traversal and a linked-list traversal with identical
  instruction counts, showing overlapping misses in one and strictly serialised misses in the other,
  with the outstanding-miss count plotted per cycle.
- **Diagram** — mermaid diagram of multiple outstanding misses tracked by MSHRs.
- **Lab** — implement MSHR allocation with a configurable limit; tests assert correctness under
  concurrent misses and that the measured MLP matches the limit on the array fixture.
- **Senior insight** — the difference between an array and a linked list on a modern core is
  overwhelmingly memory-level parallelism, not cache misses per se: the array's misses overlap and
  the list's cannot.

### 36.7 Simultaneous multithreading
- **Covers** — sharing a core's resources between threads, partitioned versus shared structures
  (ROB, issue queue, caches, TLB), throughput gain versus single-thread slowdown, the workload
  dependence of the benefit, scheduling implications for the OS (M41), and the security consequences
  of resource sharing.
- **Demo** — SMT simulator: run two threads on one core with per-thread IPC and total throughput
  reported, and a resource-partitioning control that shows how much one thread can starve the other.
- **Diagram** — mermaid diagram of shared and partitioned structures across two thread contexts.
- **Lab** — implement round-robin fetch arbitration with a starvation guard; tests assert both
  threads make progress under an adversarial workload where one thread stalls constantly.
- **Senior insight** — SMT helps throughput on stall-heavy workloads and hurts latency-sensitive
  ones; that is why databases and latency-critical services routinely disable it, which is a real
  configuration decision rather than folklore.

### 36.8 Microarchitectural side channels
- **Covers** — the general shape (a shared microarchitectural resource leaks information through
  timing), cache timing attacks (Prime+Probe, Flush+Reload), branch-predictor state as a channel,
  Spectre's speculative bounds-check bypass and Meltdown's exception-deferred load, the mitigations
  and their costs, and constant-time programming's relationship to all of this (M23 and M59).
- **Demo** — a working cache-timing channel *inside the simulator*: a secret-dependent access leaves
  a cache footprint that the attacker code recovers by timing probes, with the cache state shown at
  each step; the same code with the mitigation (bounds-clamping, fence) fails to leak.
- **Diagram** — mermaid sequence diagram of speculative access, cache trace and the timing probe that
  reads it.
- **Lab** — implement the Flush+Reload receiver against the simulator's cache; tests assert the
  secret byte is recovered from the timing data with high reliability, and that inserting the fence
  drops recovery to chance.
- **Senior insight** — the leak is not in the speculatively executed instructions, which are
  discarded; it is in the *cache state* they leave behind. That distinction is why "we roll back the
  registers" was never a mitigation.

### 36.9 Anatomy of a modern core
- **Covers** — the front end (fetch, branch prediction, decode, µop cache, loop buffer), the back end
  (rename, scheduler, execution ports, load/store units), retirement, the actual dimensions of a
  contemporary core, top-down performance analysis (front-end bound, back-end bound, bad
  speculation, retiring), and mapping a measured bottleneck to a code change.
- **Demo** — the top-down analyser: run a program and get the four-category breakdown with drill-down
  into each, then apply a suggested code change and watch the category shift, all from the
  simulator's event log.
- **Diagram** — mermaid diagram of the top-down analysis tree with its four top-level categories.
- **Lab** — given three programs with the same instruction count and very different cycle counts,
  identify each one's dominant bottleneck from the top-down breakdown and propose a fix; graded
  against the measured improvement.
- **Senior insight** — top-down analysis is the method that makes CPU performance work tractable:
  four numbers tell you which half of the machine to look at, before you read a single line of
  assembly. M58 applies it to real profiling tools.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/ooo-core.js` | Configurable OoO core with full per-cycle event log |
| `src/js/machines/ooo/rename.js` | Alias table, physical register file, free list, checkpoints |
| `src/js/machines/ooo/scheduler.js` | Issue queue, wakeup/select, port assignment |
| `src/js/machines/ooo/rob.js` | Reorder buffer, in-order commit, exception handling |
| `src/js/machines/ooo/lsq.js` | Load/store queue, forwarding, dependence speculation, MSHRs |
| `src/js/machines/ooo/smt.js` | Thread contexts, resource partitioning, fetch arbitration |
| `src/js/algorithms/ilp-analysis.js` | Dependence graph, critical path, ILP bound |
| `src/js/algorithms/topdown.js` | Event-log classification into the top-down categories |
| `src/js/machines/side-channel-lab.js` | Prime+Probe and Flush+Reload receivers against the sim |
| `src/js/viz/ooo-view.js` | In-flight window, per-instruction state timeline |

---

## Acceptance criteria

- [ ] The out-of-order core's architectural results match the in-order reference on every test
      program, including all exception fixtures.
- [ ] No load ever observes a value that violates the memory ordering rules, asserted by a checker
      running against the event log on every simulation.
- [ ] The measured IPC never exceeds the ILP bound computed independently from the dependence graph.
- [ ] Every cycle in the log is accounted for by the top-down classifier; the four categories sum to
      100% within rounding.
- [ ] The side-channel lab recovers the secret with high reliability and demonstrably fails once the
      mitigation is applied — both asserted.
- [ ] SMT fetch arbitration passes the starvation test under an adversarial workload.

---

## Sources

- Hennessy, Patterson — *Computer Architecture: A Quantitative Approach*, chapter 3
- Tomasulo — *An efficient algorithm for exploiting multiple arithmetic units*
- Smith, Pleszkun — *Implementing precise interrupts in pipelined processors*
- Chrysos, Emer — *Memory dependence prediction using store sets*
- Tullsen, Eggers, Levy — *Simultaneous multithreading: maximizing on-chip parallelism*
- Kocher et al. — *Spectre attacks*; Lipp et al. — *Meltdown*
- Yasin — *A top-down method for performance analysis and counters architecture*
- Agner Fog — the microarchitecture and instruction-tables documents
