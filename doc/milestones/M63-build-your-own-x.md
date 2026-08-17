# M63 — Build-your-own-X capstones

> **Track** Practice and mastery · **Depends on** many (each capstone lists its own) · **Sections** 12 · **Effort** XL

**Outcome.** Twelve substantial builds that force the tracks to combine. Each capstone is a
multi-session project with a specification, a milestone-by-milestone build order, a reference
implementation the learner cannot see until they pass, an acceptance test suite, and a benchmark
against that reference. These are the sections that convert recognition into ability.

**Format.** A capstone is not a section with a demo — it is a project workspace: a specification
document, a scaffolded repository inside the platform, a progress checklist, an acceptance suite the
learner runs continuously, a reference solution unlocked on completion, and a "what to do next"
extension list. The code lab from M00 runs the whole thing in-browser; the tests are the
specification.

**Shared machinery introduced.** `machines/capstone/workspace.js` — multi-file in-browser project
workspace with persistence, a test runner over the acceptance suite, progress tracking per
requirement, and a diff view against the reference implementation once unlocked.

---

## Capstones

### 63.1 A regular-expression engine
- **Builds on** M15, M24, M25.
- **Specification** — parse a regex subset (literals, classes, quantifiers, groups, alternation,
  anchors, non-greedy, captures), compile to an NFA, simulate with the parallel-state-set algorithm,
  add a lazy DFA cache, and expose match/search/replace with capture groups.
- **Acceptance** — behavioural equality with the native engine over a 2 000-case corpus for the
  supported subset; linear-time behaviour on the catastrophic-backtracking patterns, asserted by
  step counts as input grows; correct capture-group semantics including nested and repeated groups.
- **Extension** — add possessive quantifiers, then implement submatch extraction in the DFA path.

### 63.2 A language and its bytecode VM
- **Builds on** M25, M27, M28, M29, M30.
- **Specification** — extend Berugo (from M28–M30) with a new language feature of the learner's
  choice from a provided list (exceptions with unwinding, generators, pattern-matching guards,
  a module system, or operator overloading) end to end: grammar, type rules, IR lowering,
  optimisation interaction, bytecode, VM support and tests.
- **Acceptance** — the conformance suite passes with the new feature's cases added; the IR verifier
  accepts every generated program; all execution modes (interpreter, VM, JIT, wasm) agree; the
  feature's error cases produce the specified diagnostics.
- **Extension** — implement the feature in the JIT with a fast path and measure the speed-up.

### 63.3 A memory allocator
- **Builds on** M02, M21, M43.
- **Specification** — a general-purpose allocator with size classes, a thread cache, coalescing,
  and a policy for returning memory to the OS, operating over the simulated memory model.
- **Acceptance** — correctness invariants (no overlap, alignment, all freed memory reusable) under
  10⁶-operation randomised traces; fragmentation below a stated ratio on each trace shape; p99
  allocation latency below a threshold; scalability across simulated threads.
- **Extension** — add the hardening features from M43 (redzones, quarantine) and measure their cost.

### 63.4 A key-value store
- **Builds on** M04, M07, M44, M51.
- **Specification** — an LSM-based store with a WAL, memtable, SSTables with bloom filters, levelled
  compaction, snapshots and a crash-safe manifest.
- **Acceptance** — matches a reference map over randomised operation sequences; an exhaustive crash
  sweep confirms every acknowledged write survives and no unacknowledged write appears; read/write/
  space amplification within stated bounds on each YCSB-style workload; compaction keeps up with a
  sustained write rate.
- **Extension** — add range deletes and prefix compression; measure the effect on both.

### 63.5 A query engine
- **Builds on** M12, M25, M51, M52.
- **Specification** — a SQL subset (select, project, join, group-by, order-by, limit, subqueries)
  over the M51 storage, with a cost-based optimiser, statistics and at least two join algorithms.
- **Acceptance** — results match a reference interpreter over randomised data including NULLs and
  empty tables; the optimiser's chosen plan matches exhaustive search for up to five tables; queries
  complete within a per-query I/O budget that only a reasonable plan can meet.
- **Extension** — add vectorised execution and measure the per-row overhead reduction.

### 63.6 A version-control system
- **Builds on** M06, M15, M22, M23, M44.
- **Specification** — a content-addressed object store (blobs, trees, commits), a working-tree
  index, branches and refs, commit and checkout, a three-way merge with conflict markers, a diff
  implementation (Myers, from M15), packing with delta compression, and a log with history
  traversal.
- **Acceptance** — object hashes are stable and content-addressed; round-trip of commit/checkout
  reproduces the tree exactly; merges match a reference implementation on the merge-scenario corpus
  including conflict cases; packing reduces size by a stated factor with exact recovery.
- **Extension** — implement rebase, then implement `bisect` over the commit graph.

### 63.7 A reliable transport protocol
- **Builds on** M24, M48, M49.
- **Specification** — a transport over the lossy simulated link with connection setup and teardown,
  reliable in-order delivery, flow control, congestion control and loss recovery, plus a socket-like
  API.
- **Acceptance** — delivers every byte in order under 10% loss with reordering and duplication;
  throughput within a stated factor of the reference on each link profile; Jain's fairness index
  above a threshold against competing flows; no unbounded memory growth under a stalled receiver.
- **Extension** — add selective acknowledgement and measure the recovery improvement on the tail-loss
  fixture.

### 63.8 A replicated state machine
- **Builds on** M53, M54, M55.
- **Specification** — Raft (or Paxos) plus a key-value state machine, with persistence, snapshots,
  membership changes, linearizable reads and client sessions.
- **Acceptance** — election safety and log matching asserted after every step of every fault
  schedule; linearizability of the client-visible history under partitions, crashes and clock skew;
  correct behaviour across membership changes during elections; deterministic replay of every
  failure.
- **Extension** — add leader leases for fast reads and demonstrate (and then bound) the clock-skew
  hazard.

### 63.9 A spreadsheet engine
- **Builds on** M13, M25, M29, M52.
- **Specification** — a formula language with a parser, a dependency graph with topological
  evaluation, incremental recomputation on change, cycle detection with a clear error, ranges and
  aggregate functions, and a volatile-function policy.
- **Acceptance** — recomputation touches only the affected cells, asserted by an evaluation counter
  against the true dependency closure; cycles are reported with the participating cells; results
  match a reference evaluator across a formula corpus; large-sheet recompute stays within a time
  budget.
- **Extension** — add array formulas and a lazy evaluation mode for off-screen regions.

### 63.10 A renderer
- **Builds on** M08, M16, M17, M40.
- **Specification** — either a ray tracer (intersection, shading, BVH acceleration, anti-aliasing)
  or a rasteriser (transform pipeline, clipping, scanline fill, depth buffer, texture mapping),
  with a performance-optimisation phase.
- **Acceptance** — output matches the reference image within a per-pixel tolerance for the scene
  corpus; the acceleration structure is verified correct against brute force; the optimised version
  meets a frame-time budget with the per-step attribution required.
- **Extension** — port the inner loop to a WebGPU compute kernel (M40) and compare.

### 63.11 A container runtime
- **Builds on** M41, M43, M44, M46.
- **Specification** — over the simulated kernel: create namespaces, apply cgroup limits, mount an
  overlay filesystem from image layers, apply a seccomp filter, launch a process and supervise it,
  with an image-pull step from a local registry.
- **Acceptance** — the contained process cannot observe or affect host resources, asserted from both
  sides; cgroup limits are enforced and throttling is observable; the overlay's copy-up and whiteout
  semantics match the reference table; every escape attempt in the M46 corpus is blocked.
- **Extension** — add a rootless mode with user-namespace id mapping.

### 63.12 A distributed job system
- **Builds on** M05, M41, M55, M57, M60.
- **Specification** — a job queue with priorities and scheduled execution, worker pools with
  heartbeats, at-least-once execution with idempotency keys, retries with backoff and a dead-letter
  queue, backpressure, and a coordinator using the M55 consensus module for leader election.
- **Acceptance** — no job is lost across worker crashes, coordinator failover and partitions,
  asserted against the submitted set; no job runs concurrently on two workers (verified by a
  lease-and-fence check); the system remains responsive under 3× overload through shedding; retry
  amplification stays within budget.
- **Extension** — add fair scheduling across tenants and demonstrate isolation under a noisy
  neighbour.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/capstone/workspace.js` | Multi-file editor, persistence, run/test integration |
| `src/js/machines/capstone/acceptance.js` | Requirement-linked test suites with progress reporting |
| `src/js/machines/capstone/reference.js` | Reference implementations, locked until acceptance passes |
| `src/js/machines/capstone/bench.js` | Comparison against the reference on the capstone's metrics |
| `src/js/content/capstones/` | Specifications, build orders, hint ladders, extension lists |

---

## Acceptance criteria (for the milestone itself)

- [ ] Every capstone has a written specification precise enough that the acceptance suite is
      derivable from it; ambiguity in a specification is a bug in the capstone.
- [ ] Every capstone's acceptance suite includes correctness, robustness (adversarial or fault
      injection) and a performance or resource bound — not correctness alone.
- [ ] Every capstone has a working reference implementation that passes its own suite, built before
      the capstone ships.
- [ ] Reference implementations stay locked until the learner's acceptance run passes, then unlock
      with a diff view.
- [ ] Progress is per requirement, so a partially complete capstone shows exactly what remains.
- [ ] Hints are laddered (nudge, approach, partial code) and are opt-in, so the default experience is
      unassisted.
- [ ] Every capstone states its prerequisite milestones and fails loudly if their modules are
      missing, rather than presenting a broken workspace.

---

## Sources

- The specifications and papers cited by each prerequisite milestone
- Nystrom — *Crafting Interpreters* (for 63.1 and 63.2's structure)
- Chacon, Straub — *Pro Git*, the internals chapters (for 63.6)
- Shirley — *Ray Tracing in One Weekend* (for 63.10)
- Ongaro, Ousterhout — the Raft paper and thesis (for 63.8)
- The RocksDB and LevelDB design documents (for 63.4)
