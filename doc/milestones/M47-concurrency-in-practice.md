# M47 — Concurrency and parallelism in practice

> **Track** Operating systems · **Depends on** M42, M38 · **Sections** 11 · **Effort** XL

**Outcome.** The applied milestone: given the primitives (M42) and the hardware model (M38), how do
you actually structure concurrent software? Every model is implemented, measured under the same
workloads, and tested with a scheduler that deliberately explores hostile interleavings — including
a real parallel algorithm running in Web Workers with `SharedArrayBuffer`.

**Shared machinery introduced.** `machines/concurrency-lab.js` — a deterministic cooperative
scheduler with controllable interleaving (systematic, random, adversarial), fault injection and
replay, so any concurrent design here can be stress-tested reproducibly;
`machines/worker-pool.js` — a real Web Worker pool with `SharedArrayBuffer` and `Atomics` for the
sections that run natively.

---

## Sections

### 47.1 Choosing a concurrency model
- **Covers** — concurrency versus parallelism, the model catalogue (threads and locks, task
  parallelism with work stealing, actors, CSP channels, async/await, data parallelism, lock-free),
  the decision inputs (workload shape, blocking behaviour, state sharing, failure semantics,
  debuggability), and the honest costs of each model.
- **Demo** — the model chooser: describe a workload (CPU/IO ratio, state sharing, latency target,
  failure requirements) and see each model's predicted fit with its measured behaviour on a
  matching synthetic workload.
- **Diagram** — mermaid decision flowchart from workload properties to concurrency model.
- **Lab** — classify six real scenarios by the model that fits, with justification; graded against a
  rubric that accepts multiple defensible answers with the right reasoning.
- **Senior insight** — the model choice is mostly determined by what your code does while waiting;
  everything that blocks wants threads or async, everything that computes wants task parallelism,
  and mixing them without a boundary is where most designs go wrong.

### 47.2 Thread pools and sizing
- **Covers** — why unbounded thread creation fails, pool sizing for CPU-bound (cores) versus
  I/O-bound (Little's law from M58) work, separate pools for separate workload classes, bounded
  queues and rejection policies, queue-versus-pool sizing, thread starvation deadlock (a pool task
  waiting on another task in the same pool), and monitoring a pool.
- **Demo** — the sizing laboratory: vary pool size and queue bound against a mixed workload, plotting
  throughput, latency percentiles and rejection rate; a starvation-deadlock scenario is one click
  away and is fixed by pool separation.
- **Diagram** — mermaid diagram of a pool-starvation deadlock: tasks holding threads while waiting on
  queued tasks.
- **Lab** — implement a bounded pool with a caller-runs rejection policy; tests assert no task is
  lost, that backpressure reaches the submitter under overload, and that the starvation fixture
  completes rather than deadlocking.
- **Senior insight** — a task that blocks on another task in the same pool is a deadlock waiting for
  enough load; the rule "never wait for pool work from inside the pool" is not a style preference.

### 47.3 Work stealing and fork-join
- **Covers** — the task-parallel model, work-stealing deques with owner-pop/thief-steal, the
  Chase–Lev deque and its memory-ordering requirements, fork-join decomposition and grain size,
  the work and span analysis from M21 applied, load balance under irregular workloads, and the
  designs in ForkJoinPool, Rayon, Cilk and the Go scheduler.
- **Demo** — steal visualiser: per-worker deques with local pushes and pops and cross-worker steals
  animated on an irregular workload; grain size is adjustable and the overhead/imbalance trade is
  plotted.
- **Diagram** — mermaid diagram of a work-stealing deque with the owner at one end and thieves at the
  other.
- **Lab** — implement the Chase–Lev deque with correct ordering; tests assert no task is executed
  twice or lost across 10⁵ randomised steal interleavings, and that the owner's fast path never
  synchronises when uncontended.
- **Senior insight** — the owner-and-thieves-at-opposite-ends design is what makes the common case
  synchronisation-free; the only contention is the rare steal, and that is why work stealing scales
  where a shared queue does not.

### 47.4 Lock-free programming: the algorithms
- **Covers** — progress guarantees (obstruction-free, lock-free, wait-free), CAS loops and their
  retry behaviour under contention, the Treiber stack, the Michael–Scott queue, the ABA problem with
  a concrete failing interleaving, tagged pointers and double-width CAS, and why lock-free is not
  automatically faster.
- **Demo** — ABA constructor: step through the exact interleaving that makes a naive CAS-based stack
  return a freed node, then apply tagging and watch the same interleaving fail to break it.
- **Diagram** — mermaid sequence diagram of the ABA interleaving with the pointer values at each
  step.
- **Lab** — implement the Michael–Scott queue; tests assert linearizability (using M42's checker)
  across randomised interleavings and that the queue never loses or duplicates an element.
- **Senior insight** — lock-free means the *system* makes progress, not that any thread does; a
  lock-free algorithm under heavy contention can be slower and less fair than a good mutex, and the
  measurement usually surprises people.

### 47.5 Memory reclamation
- **Covers** — the reclamation problem (when can a removed node be freed), reference counting's
  cost, hazard pointers, epoch-based reclamation, quiescent-state-based reclamation and RCU (from
  M42), deferred free lists and their memory-growth risk, the interaction with a garbage collector,
  and why this is the hardest part of lock-free programming.
- **Demo** — the use-after-free constructor: a lock-free structure freeing a node another thread is
  reading, shown as an interleaving; then hazard pointers and epochs are each applied, with their
  overhead and their memory-retention behaviour measured under a stalled reader.
- **Diagram** — mermaid diagram of an epoch scheme with readers pinning epochs and reclamation
  lagging behind.
- **Lab** — implement epoch-based reclamation; tests assert no node is freed while a reader is
  pinned, that memory is eventually reclaimed after readers advance, and that a stalled reader's
  memory growth is bounded and reported.
- **Senior insight** — in a garbage-collected language most lock-free algorithms are dramatically
  easier because reclamation is solved; that is a real and rarely stated advantage of managed
  runtimes for concurrent data structures.

### 47.6 High-performance queues
- **Covers** — the SPSC ring buffer with no atomics on the fast path, cache-line padding to avoid
  false sharing (M38), the LMAX Disruptor's sequence barriers and pre-allocation, MPMC bounded
  queues with slot sequencing, batching to amortise synchronisation, the throughput/latency effect
  of batch size, and backpressure semantics (block, drop, reject).
- **Demo** — queue bake-off: SPSC ring, MPMC bounded, lock-based and a Disruptor-style design under
  varying producer/consumer counts, with throughput, latency percentiles and cache-line traffic
  reported; padding is toggleable and its effect is immediate.
- **Diagram** — mermaid diagram of a Disruptor ring with producer and consumer sequences and the
  barrier between them.
- **Lab** — implement an SPSC ring buffer with correct acquire/release ordering and padding; tests
  assert FIFO order, no lost items, no synchronisation on the uncontended path, and mutual exclusion
  verified under the adversarial scheduler.
- **Senior insight** — the SPSC ring with release/acquire is the fastest inter-thread channel that
  exists and it needs no locks or CAS at all; recognising when a problem is genuinely
  single-producer/single-consumer is worth more than any optimisation of the general case.

### 47.7 Actors and message passing
- **Covers** — the actor model (isolated state, mailboxes, asynchronous messages), supervision
  hierarchies and let-it-crash, location transparency and its cost, mailbox growth and backpressure,
  CSP and channels with synchronous rendezvous, `select` over channels, deadlock in channel
  topologies, and comparing actors with shared-memory concurrency for the same problem.
- **Demo** — actor system simulator: actors with mailboxes and a supervision tree, message flow
  visualised, a failing actor restarted by its supervisor, and an unbounded mailbox growing until the
  backpressure policy engages; a channel-based version of the same program shows the rendezvous
  behaviour and a constructed channel deadlock.
- **Diagram** — mermaid diagram of a supervision tree with restart strategies annotated.
- **Lab** — implement a channel with `select` over multiple channels and correct fairness; tests
  assert no message loss, fair selection across ready channels, and correct blocking/unblocking
  semantics under the adversarial scheduler.
- **Senior insight** — actors do not remove concurrency bugs, they relocate them: instead of data
  races you get message-ordering bugs, mailbox growth and distributed deadlock — which are easier to
  reason about but not automatic.

### 47.8 Async/await and structured concurrency
- **Covers** — coroutines as state machines (from M30), cooperative scheduling and the
  blocking-the-executor hazard, cancellation and its propagation, timeouts as a first-class
  concern, structured concurrency (scopes that cannot outlive their children), the "coloured
  functions" problem, and error propagation across concurrent tasks.
- **Demo** — the cancellation laboratory: a task tree with timeouts and cancellation propagating
  through it, showing cleanup running in the right order; an unstructured version leaks a task that
  outlives its parent and continues writing to a closed resource.
- **Diagram** — mermaid diagram of a structured-concurrency scope with its child tasks and their
  join point.
- **Lab** — implement a task scope with cancellation propagation and guaranteed cleanup; tests
  assert every child completes or is cancelled before the scope exits, cleanup runs exactly once
  per task, and a cancelled task's resources are released.
- **Senior insight** — unstructured spawn is the `goto` of concurrency: a task with no owner has no
  cancellation, no error propagation and no lifetime bound, and it is where "the process would not
  shut down" bugs live.

### 47.9 Optimistic concurrency and transactional memory
- **Covers** — optimistic versus pessimistic concurrency control, version numbers and validation,
  software transactional memory (conflict detection, retry, composability), the read-set/write-set
  bookkeeping cost, why STM struggled in practice (I/O, retries under contention), hardware
  transactional memory and its capacity limits, and the same ideas as they appear in databases
  (M53).
- **Demo** — STM simulator: transactions running optimistically with their read and write sets shown,
  conflicts detected at commit and retried, with the retry rate plotted against contention — showing
  the collapse point where optimistic loses to pessimistic.
- **Diagram** — mermaid diagram of two transactions' read/write sets overlapping to force a retry.
- **Lab** — implement optimistic concurrency with version validation; tests assert serialisability
  of the resulting history (using M42's checker) and that the retry rate matches the analytical
  prediction for the fixture's contention level.
- **Senior insight** — optimistic concurrency is excellent under low contention and pathological
  under high contention, because the work is done and then thrown away; the crossover is measurable
  and it is the same curve as in database concurrency control.

### 47.10 Parallelism in JavaScript
- **Covers** — what the browser actually offers: Web Workers, message passing with structured
  clone, transferables, `SharedArrayBuffer` and `Atomics` (with the cross-origin isolation
  requirement), `Atomics.wait`/`notify` for blocking in workers, worker pools, wasm threads, the
  main-thread rules, and the practical patterns for a parallel algorithm in the browser.
- **Demo** — a real parallel computation running across workers with `SharedArrayBuffer`: speed-up
  measured against core count, with the transfer-versus-share comparison, and a version that fails
  the cross-origin isolation check degrading gracefully with a clear explanation.
- **Diagram** — mermaid diagram of the main thread, worker pool and shared memory with the atomics
  used for coordination.
- **Lab** — implement a parallel reduction across workers with `Atomics`-based barrier
  synchronisation; tests assert the result matches the sequential computation exactly for integers,
  that the barrier is correct under repeated phases, and report the measured speed-up.
- **Senior insight** — `SharedArrayBuffer` requires cross-origin isolation headers, so a parallel
  algorithm's availability is a deployment decision, not a code one — and the graceful-degradation
  path is part of the design, not an afterthought.

### 47.11 Testing concurrent systems
- **Covers** — why unit tests miss concurrency bugs, deterministic scheduling for reproducibility,
  systematic interleaving exploration with bounded preemption, randomised scheduling with a fixed
  seed for replay, race detectors (from M32), fault injection (delays, crashes, message loss) as a
  scheduling perturbation, linearizability checking (from M42), and building a concurrency test
  suite that is worth running in CI.
- **Demo** — the adversarial scheduler applied to every structure built in this milestone: bugs
  seeded into variants are found, the failing interleaving is reported, and replay reproduces it
  exactly every time.
- **Diagram** — mermaid flowchart of the test loop: schedule → run → check invariants → shrink →
  replay.
- **Lab** — write a concurrency test suite for a provided structure: invariants, an adversarial
  schedule generator, a linearizability check and a replay mechanism; tests assert the suite catches
  all five seeded bugs and produces a deterministic reproduction for each.
- **Senior insight** — a concurrency bug you cannot reproduce is a bug you cannot fix; deterministic
  replay is worth more than any amount of stress testing, and it is the reason simulation-driven
  testing (FoundationDB's approach, revisited in M55) works so well.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/concurrency-lab.js` | Deterministic scheduler, interleaving strategies, replay |
| `src/js/machines/worker-pool.js` | Real Web Worker pool with SharedArrayBuffer and Atomics |
| `src/js/algorithms/thread-pool.js` | Bounded queues, rejection policies, pool separation |
| `src/js/algorithms/work-stealing.js` | Chase–Lev deque, fork-join, grain-size control |
| `src/js/algorithms/lockfree-structures.js` | Treiber stack, Michael–Scott queue, tagged pointers |
| `src/js/algorithms/reclamation.js` | Hazard pointers, epochs, deferred free with bounds |
| `src/js/algorithms/queues-fast.js` | SPSC ring, MPMC bounded, Disruptor-style sequences |
| `src/js/algorithms/actors.js` | Mailboxes, supervision, channels with select |
| `src/js/algorithms/structured-concurrency.js` | Scopes, cancellation, timeouts, cleanup ordering |
| `src/js/algorithms/stm.js` | Read/write sets, validation, retry |

---

## Acceptance criteria

- [ ] Every concurrent structure is tested under the adversarial scheduler with exhaustive
      exploration on a small model and randomised exploration at scale, with replay for any failure.
- [ ] Linearizability is checked (not just "no crash") for every concurrent data structure.
- [ ] The ABA and use-after-free constructors reproduce their failures as tests, and the fixes
      demonstrably prevent them.
- [ ] Lock-free structures report throughput *and* fairness against a mutex baseline, so the "not
      automatically faster" claim is backed by data.
- [ ] The SPSC ring's fast path is asserted synchronisation-free by counting atomic operations.
- [ ] The Web Worker lab runs natively where cross-origin isolation allows and degrades with an
      explicit message where it does not.
- [ ] Structured-concurrency tests assert cleanup runs exactly once per task and no task outlives
      its scope.

---

## Sources

- Herlihy, Shavit — *The Art of Multiprocessor Programming*
- Chase, Lev — *Dynamic circular work-stealing deque*
- Blumofe, Leiserson — *Scheduling multithreaded computations by work stealing*
- Michael, Scott — *Simple, fast, and practical non-blocking and blocking concurrent queue algorithms*
- Michael — *Hazard pointers: safe memory reclamation for lock-free objects*
- Thompson et al. — the LMAX Disruptor technical paper
- Hewitt, Bishop, Steiger — the actor model; Hoare — *Communicating sequential processes*
- Sústrik — *Structured concurrency*; Elizarov — the coroutines and structured-concurrency talks
- Musuvathi, Qadeer — *Iterative context bounding for systematic testing of multithreaded programs*
