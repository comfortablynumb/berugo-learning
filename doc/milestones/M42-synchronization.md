# M42 — Synchronisation, deadlock and the classic problems

> **Track** Operating systems · **Depends on** M41, M38 · **Sections** 10 · **Effort** L

**Outcome.** Every synchronisation primitive built from the atomics in M38, running on the
multi-core simulator, with the classic problems solved and then broken deliberately so the failure
modes are seen rather than described. The milestone's discipline is that a concurrency claim is only
credible if an exhaustive interleaving search or a stress test backs it.

**Shared machinery introduced.** `machines/os/sync-lab.js` — runs a synchronisation exercise under
three engines: a deterministic interleaving explorer (exhaustive for small state spaces), a
randomised stress runner with a controllable scheduler, and a real Web Worker + `SharedArrayBuffer`
runner for the primitives that JavaScript can express natively; `viz/interleaving-view.js` reused
from M38.

---

## Sections

### 42.1 Race conditions and mutual exclusion
- **Covers** — the critical-section problem, the three requirements (mutual exclusion, progress,
  bounded waiting), why `x++` is three operations, Peterson's and Dekker's algorithms, why software-
  only solutions need memory fences on real hardware (from M38), and the difference between a data
  race and a race condition.
- **Demo** — the increment race: N simulated threads incrementing a shared counter, with the lost
  updates counted and the exact interleaving that caused each one shown; Peterson's algorithm is
  then applied, first without fences (still broken on the weak model) and then correctly.
- **Diagram** — mermaid sequence diagram of a lost update from interleaved read-modify-write.
- **Lab** — implement Peterson's algorithm with the correct fences; tests assert mutual exclusion
  under exhaustive interleaving exploration for two threads, and that the fence-free version is
  found to violate it.
- **Senior insight** — a data race is a language-level undefined behaviour and a race condition is a
  logic bug; a program can have the second without the first (two atomic operations in the wrong
  order), and fixing only the first leaves you with a correct-looking wrong program.

### 42.2 Spin locks and hardware support
- **Covers** — test-and-set, test-and-test-and-set and the coherence traffic difference, exponential
  backoff, ticket locks and fairness, MCS and CLH queue locks with local spinning, the cache-line
  behaviour of each (from M38), when spinning beats blocking, and adaptive spinning.
- **Demo** — lock scalability: TAS, TTAS, ticket and MCS locks under increasing thread counts, with
  throughput, coherence messages and fairness (acquisition-order variance) plotted; TAS visibly
  collapses while MCS scales.
- **Diagram** — mermaid diagram of the MCS queue with each thread spinning on its own node.
- **Lab** — implement the MCS lock; tests assert mutual exclusion under stress, FIFO acquisition
  order, and a coherence-message count that stays flat as thread count rises.
- **Senior insight** — TTAS versus TAS is a one-line change that removes most of the coherence
  storm, and queue locks remove the rest; lock scalability is a cache-coherence question before it
  is an algorithms question.

### 42.3 Blocking locks
- **Covers** — why spinning wastes a scheduling quantum, the block/wake path through the kernel,
  futexes and the fast uncontended path in user space, park/unpark, adaptive locks that spin briefly
  then block, lock handoff versus barging and its fairness/throughput trade, and the cost profile of
  each path.
- **Demo** — the cost curve: uncontended acquire, contended acquire with spinning, and contended
  acquire with blocking, measured across critical-section lengths, showing exactly where each
  strategy wins.
- **Diagram** — mermaid state diagram of a futex-style lock's fast path, slow path and wake path.
- **Lab** — implement an adaptive mutex (spin for a bounded time, then block); tests assert
  correctness and that its measured cost is at or below both pure strategies across the fixture's
  critical-section lengths.
- **Senior insight** — the correct spin duration is roughly the cost of a context switch, because
  spinning longer than that can never pay off; that single rule explains every adaptive lock's
  tuning constant.

### 42.4 Condition variables and monitors
- **Covers** — waiting for a condition rather than for a lock, the atomic release-and-wait
  requirement, `signal` versus `broadcast`, Mesa versus Hoare semantics and why Mesa's "recheck in a
  loop" rule exists, lost wakeups, spurious wakeups, the monitor abstraction, and structuring code
  around invariants that hold at wait points.
- **Demo** — the lost-wakeup constructor: a bounded buffer where the learner can reorder the
  unlock/wait sequence and watch the wakeup be lost, with the interleaving displayed; the correct
  atomic sequence then makes it impossible.
- **Diagram** — mermaid sequence diagram of the atomic release-and-wait and the corresponding signal.
- **Lab** — implement a condition variable over the mutex from 42.3; tests assert no lost wakeups
  under exhaustive exploration of the small model and that a waiter is always woken when the
  condition becomes true.
- **Senior insight** — `if (!condition) wait()` is the bug and `while (!condition) wait()` is the
  fix; under Mesa semantics the signalled thread is not scheduled immediately, so the condition can
  be stolen before it runs.

### 42.5 Semaphores and the classic problems
- **Covers** — counting and binary semaphores, semaphores as both mutual exclusion and signalling,
  producer–consumer with a bounded buffer, readers–writers in its reader-priority, writer-priority
  and fair variants with their starvation profiles, dining philosophers with the deadlock and its
  several fixes, the sleeping barber, and why semaphores are error-prone compared to monitors.
- **Demo** — the classics gallery: each problem with a visual simulation, a policy selector where
  variants exist, live starvation and fairness counters, and a deliberately broken variant that can
  be run to observe deadlock or starvation directly.
- **Diagram** — mermaid diagram of the dining-philosophers resource cycle that deadlocks.
- **Lab** — implement the fair readers–writers solution; tests assert no starvation for either role
  under an adversarial arrival pattern that starves both naive variants.
- **Senior insight** — reader-priority readers–writers starves writers under continuous read load,
  which is exactly what happens to a cache-invalidation writer behind a read-heavy service; the fair
  variant costs a little throughput and removes an entire incident class.

### 42.6 Read-mostly synchronisation
- **Covers** — reader–writer locks and their scalability limit (the shared counter is still a
  contended cache line), seqlocks with retry-on-write for tiny read-mostly structures, RCU's
  publish/read/grace-period model, quiescent states and deferred reclamation, when RCU's read side
  is genuinely free, and epoch-based reclamation as the user-space equivalent.
- **Demo** — read-mostly comparison: a mutex, a reader–writer lock, a seqlock and an RCU-style
  scheme under a 99%-read workload, with read throughput scaling plotted against thread count and
  the coherence traffic of each shown.
- **Diagram** — mermaid diagram of an RCU update publishing a new version while readers finish with
  the old one.
- **Lab** — implement a seqlock with correct retry semantics; tests assert readers never observe a
  torn value (checked by an invariant across the protected fields) under a stress test with
  concurrent writers.
- **Senior insight** — a reader–writer lock still writes to shared state on every read acquisition,
  so it does not scale for very short critical sections; seqlocks and RCU exist because the *lock
  itself* was the contention.

### 42.7 Deadlock
- **Covers** — the four Coffman conditions, resource-allocation graphs and cycle detection, deadlock
  detection at runtime and recovery, avoidance with the banker's algorithm and why it is rarely
  practical, prevention by lock ordering and its enforcement, hierarchical locking, trylock with
  backoff, livelock and starvation as the related failures, and distributed deadlock (previewing
  M53).
- **Demo** — deadlock laboratory: construct a lock-order inversion between two threads and watch the
  resource-allocation graph form a cycle with the detector firing; then apply each prevention
  strategy and observe the change in behaviour and throughput.
- **Diagram** — mermaid diagram of a resource-allocation graph with a cycle marked.
- **Lab** — implement a lock-order checker that records acquisition order and reports any inversion
  (a lockdep-style tool); tests assert it detects the seeded inversion even when the two orders never
  interleave in the same run.
- **Senior insight** — the value of a lock-order checker is that it finds the inversion from a single
  run of *each* order, without needing the unlucky interleaving; that is why lockdep catches
  deadlocks that never happened.

### 42.8 Barriers and coordination
- **Covers** — barriers for phase synchronisation, sense-reversing barriers to allow reuse, tree and
  combining barriers for scalability, latches and countdown coordination, phasers with dynamic
  participation, rendezvous, and the performance cost of a barrier being the slowest participant
  (the straggler problem).
- **Demo** — barrier scaling: centralised, sense-reversing and tree barriers across thread counts
  with the measured barrier cost, plus a straggler injection showing that total time tracks the
  slowest thread regardless of barrier quality.
- **Diagram** — mermaid diagram of a tree barrier's arrival and release phases.
- **Lab** — implement a sense-reversing barrier; tests assert correctness across repeated phases (the
  case a naive barrier breaks on) and no thread proceeding before all have arrived, under exhaustive
  exploration for small thread counts.
- **Senior insight** — barriers convert your parallel program's runtime into the maximum, not the
  average, of its parts; that is why load imbalance hurts so much more in bulk-synchronous designs
  than in work-stealing ones (M47).

### 42.9 Granularity and contention
- **Covers** — coarse versus fine-grained locking and the correctness/throughput trade, lock
  striping and per-bucket locks, hand-over-hand locking for linked structures, lock convoys,
  measuring contention (wait time, acquisition rate, hold time), reducing critical-section length,
  avoiding locks by partitioning, and knowing when the lock is not the bottleneck.
- **Demo** — a concurrent hash map with selectable locking strategy (single lock, striped, per-bucket,
  lock-free preview) under varying thread counts and access skew, with throughput, wait time and
  hold time reported; a skewed workload shows striping failing when all keys hit one stripe.
- **Diagram** — mermaid diagram of lock striping mapping key ranges to independent locks.
- **Lab** — reduce the critical section of a provided implementation without breaking its
  invariants; tests assert the invariants under stress and a measured reduction in total wait time.
- **Senior insight** — contention profiles are bimodal: either the critical section is too long, or
  the access distribution is too skewed for partitioning. Measuring hold time versus wait time tells
  you which, and they need opposite fixes.

### 42.10 Verifying concurrent code
- **Covers** — writing down the invariant, exhaustive interleaving exploration and its limits,
  bounded model checking of a concurrent algorithm (linking to M32), stress testing with a
  controllable scheduler, deterministic replay of a failing interleaving, linearizability as the
  correctness criterion for concurrent objects, and history-checking tools (a Jepsen-style
  linearizability checker in miniature).
- **Demo** — the verifier: submit a concurrent object implementation and the tool explores
  interleavings, checks linearizability against a sequential specification, and replays any
  violating history step by step.
- **Diagram** — mermaid diagram of a concurrent history with a linearization point assignment that
  fails.
- **Lab** — implement a linearizability checker for a small history (search over valid sequential
  orderings consistent with the real-time order); tests assert it accepts correct histories and
  rejects the seeded non-linearizable ones.
- **Senior insight** — linearizability is the property people mean when they say "thread-safe", and
  a checker over recorded histories is the only practical way to test it — which is exactly what
  Jepsen does to distributed databases in M54.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/os/sync-lab.js` | Interleaving explorer, stress runner, worker-backed runner |
| `src/js/algorithms/locks-spin.js` | TAS, TTAS, ticket, MCS, CLH with backoff |
| `src/js/algorithms/locks-blocking.js` | Futex-style mutex, adaptive spinning, handoff policies |
| `src/js/algorithms/condvar.js` | Condition variables, monitors, Mesa semantics |
| `src/js/algorithms/semaphores.js` | Counting semaphores and the classic-problem solutions |
| `src/js/algorithms/read-mostly.js` | Reader–writer locks, seqlocks, RCU-style publication |
| `src/js/algorithms/deadlock.js` | Resource graphs, detection, banker's algorithm, order checker |
| `src/js/algorithms/barriers.js` | Centralised, sense-reversing, tree, phaser |
| `src/js/algorithms/linearizability.js` | History recording and sequential-specification checking |

---

## Acceptance criteria

- [ ] Every primitive is verified by exhaustive interleaving exploration on a small model *and* by a
      stress test at scale; passing only one is not sufficient.
- [ ] Every deliberately broken variant in the demos is accompanied by a test asserting that it
      fails, so the failure cannot silently disappear.
- [ ] Lock scalability comparisons report coherence traffic alongside throughput.
- [ ] The fair readers–writers implementation is asserted starvation-free under the adversarial
      arrival pattern; the naive variants are asserted to starve.
- [ ] The lock-order checker detects the seeded inversion from single-order runs.
- [ ] The linearizability checker accepts all correct histories and rejects all seeded violations in
      the fixture set.

---

## Sources

- Herlihy, Shavit — *The Art of Multiprocessor Programming*
- Arpaci-Dusseau, Arpaci-Dusseau — *Operating Systems: Three Easy Pieces*, concurrency chapters
- Mellor-Crummey, Scott — *Algorithms for scalable synchronization on shared-memory multiprocessors*
- Dijkstra — *Cooperating sequential processes* (semaphores, dining philosophers)
- Hoare — *Monitors: an operating system structuring concept*
- Lampson, Redell — *Experience with processes and monitors in Mesa*
- McKenney — *Is parallel programming hard, and, if so, what can you do about it?* (RCU)
- Herlihy, Wing — *Linearizability: a correctness condition for concurrent objects*
