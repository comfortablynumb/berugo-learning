# M54 — Distributed time, consistency and replication

> **Track** Distributed systems · **Depends on** M49, M53 · **Sections** 10 · **Effort** L

**Outcome.** The foundations that make distributed systems different in kind rather than in degree:
you cannot know what time it is, you cannot know whether a node is down, and you cannot have every
property at once. Built as a simulator where partitions, delays and clock skew are dials, so every
claim is demonstrated by breaking something.

**Shared machinery introduced.** `machines/dist/` — a distributed-system simulator (nodes, message
passing with configurable delay/loss/reordering/partition, per-node clocks with skew and drift,
crash and restart, deterministic seeded execution and full history recording);
`machines/dist/checker.js` — consistency checking over recorded histories (linearizability from
M42, causal consistency, read-your-writes); `viz/spacetime-view.js` — the space-time diagram used
throughout tracks 8.

---

## Sections

### 54.1 The distributed model
- **Covers** — what changes when a system spans machines, the synchrony spectrum (synchronous,
  partially synchronous, asynchronous) and why it matters for algorithms, failure models
  (crash-stop, crash-recovery, omission, timing, Byzantine), the FLP impossibility result and what
  it does and does not forbid, the fallacies of distributed computing, and the two-generals problem
  as the practical statement of the limit.
- **Demo** — the two-generals simulator: attempt to reach agreement over a lossy channel with
  acknowledgements, watch the acknowledgement regress infinitely, and see the practical resolution
  (accept uncertainty, use timeouts and retries with idempotency).
- **Diagram** — mermaid sequence diagram of the two-generals acknowledgement regress.
- **Lab** — implement a message layer with configurable loss and reordering, and demonstrate that no
  finite protocol achieves certain agreement; tests assert the protocol's actual guarantee (at-least-
  once with idempotency) rather than the impossible one.
- **Senior insight** — FLP says no deterministic algorithm can guarantee consensus in an
  asynchronous system with one crash failure; every real system escapes it with timeouts, which
  means every real system trades liveness for safety under bad conditions.

### 54.2 Failure detection
- **Covers** — the impossibility of distinguishing a slow node from a dead one, heartbeats and
  timeout selection, the false-positive/detection-time trade-off, phi-accrual detectors that output
  a suspicion level, adaptive timeouts, the consequences of a wrong verdict (split brain, unnecessary
  failover), and failure detection as an input to every higher-level protocol.
- **Demo** — detector tuning: vary the timeout against a network with variable delay and see the
  false-positive rate and detection time trade off; a phi-accrual detector adapts to the delay
  distribution and dominates the fixed-timeout curve.
- **Diagram** — mermaid diagram of the detection-time versus false-positive trade-off with both
  detectors plotted.
- **Lab** — implement a phi-accrual failure detector; tests assert its false-positive rate stays
  below a threshold on a variable-latency network where a fixed timeout tuned to the same detection
  time does not.
- **Senior insight** — every timeout in a distributed system is a failure detector, whether you
  called it that or not; choosing 30 seconds because it "felt safe" is choosing a detection time and
  a false-positive rate blindly.

### 54.3 Physical time
- **Covers** — clock hardware and drift, NTP's synchronisation and its accuracy bounds, wall-clock
  versus monotonic clocks and which to use for what, clock jumps (both directions), leap seconds and
  their historical outages, timestamp-based ordering and why it silently breaks, Spanner's TrueTime
  with bounded uncertainty and commit-wait, and hybrid logical clocks.
- **Demo** — clock-skew laboratory: two nodes with drifting clocks writing timestamped updates,
  producing an ordering that contradicts the real order; TrueTime-style uncertainty intervals with
  commit-wait then restore correctness at the cost of latency.
- **Diagram** — mermaid diagram of two skewed clocks producing a timestamp inversion.
- **Lab** — implement hybrid logical clocks; tests assert the HLC respects causality (happens-before
  implies smaller timestamp) while staying close to physical time, over randomised message
  schedules with skew.
- **Senior insight** — using a wall-clock timestamp to order events across machines is the most
  common distributed-systems bug in application code; it works in testing because the clocks are
  synchronised, and it corrupts data in production when one node drifts.

### 54.4 Logical time and causality
- **Covers** — the happens-before relation, Lamport clocks and their one-way implication, vector
  clocks and exact causality detection, version vectors for replicated data, the size problem and
  its mitigations (dotted version vectors, pruning), concurrent updates as a first-class outcome,
  and causal histories as the general model.
- **Demo** — the space-time diagram: events across nodes with messages drawn, Lamport and vector
  timestamps computed live, and any two selected events classified as causally ordered or concurrent
  with the justification shown.
- **Diagram** — mermaid diagram of a space-time diagram with a causal chain and a concurrent pair.
- **Lab** — implement vector clocks with comparison (before, after, concurrent); tests assert the
  classification matches the ground-truth causal order for randomised executions, and that Lamport
  clocks alone cannot make the distinction (demonstrated by a counter-example).
- **Senior insight** — Lamport clocks tell you that if A caused B then A's timestamp is smaller, but
  not the converse; using them to decide "which write won" silently discards concurrent updates,
  which is the same data loss as last-write-wins.

### 54.5 Consistency models
- **Covers** — linearizability as the single-copy illusion with real-time ordering, sequential
  consistency, causal consistency and causal+ with convergence, the session guarantees
  (read-your-writes, monotonic reads, monotonic writes, writes-follow-reads), eventual consistency,
  the model hierarchy with its strictness ordering, and the latency cost of each.
- **Demo** — the consistency ladder: the same workload executed under each model with anomalies
  shown as they occur (a read returning a stale value, a read going backwards in time), and each
  model's minimum round trips per operation reported.
- **Diagram** — mermaid diagram of the consistency-model hierarchy with the anomalies each permits.
- **Lab** — implement read-your-writes and monotonic-reads session guarantees over an eventually
  consistent store; tests assert the guarantees hold for every session in randomised executions with
  replica lag, and that the unguarded version violates them.
- **Senior insight** — session guarantees are cheap and fix the anomalies users actually notice
  ("I saved it and it disappeared"); reaching for linearizability when read-your-writes was the real
  requirement is how systems get slow for no user-visible benefit.

### 54.6 CAP, PACELC and the real trade-offs
- **Covers** — what CAP actually states (and the precise definitions of C, A and P that make it a
  theorem), why "pick two" is misleading, PACELC's extension covering the no-partition case, the
  latency/consistency trade-off during normal operation, availability as a spectrum rather than a
  boolean, and how to state a system's guarantees precisely instead of by acronym.
- **Demo** — the partition laboratory: a replicated store under a partition, with the CP behaviour
  (minority side refuses writes) and the AP behaviour (both sides accept, conflicts follow) run side
  by side, and the reconciliation shown when the partition heals.
- **Diagram** — mermaid diagram of a partitioned cluster with the two possible responses on each
  side.
- **Lab** — implement a quorum-based store with a configurable consistency mode; tests assert that
  the CP mode never returns a stale read (checked by the linearizability checker) and that the AP
  mode remains available on both sides with conflicts detected rather than lost.
- **Senior insight** — the useful question is never "are we CP or AP" but "what does each operation
  do during a partition, and is that acceptable to the user"; writing that down per endpoint is more
  valuable than any label.

### 54.7 Single-leader replication
- **Covers** — the leader/follower model, synchronous versus asynchronous versus semi-synchronous
  replication, replication lag and its user-visible anomalies, read-your-writes with a leader
  read or a lag-aware router, monotonic reads with sticky routing, failover and the choice of new
  leader, lost writes on failover with asynchronous replication, split brain, fencing tokens, and
  chain replication as an alternative arrangement.
- **Demo** — failover drill: kill the leader with a follower lagging, watch a new leader elected,
  and see exactly which acknowledged writes are lost under async replication; enable semi-sync and
  re-run to show the durability/latency trade.
- **Diagram** — mermaid sequence diagram of a failover with an in-flight write lost.
- **Lab** — implement fencing tokens for a leader lease; tests assert that a resumed old leader's
  writes are rejected by the storage layer, using the token comparison, even when it still believes
  it is the leader.
- **Senior insight** — a fenced-off old leader is the only defence against split brain that does not
  depend on timing; if your storage layer accepts writes without a token check, no amount of lease
  tuning makes failover safe.

### 54.8 Multi-leader and leaderless replication
- **Covers** — multi-leader topologies and their use cases (multi-datacentre, offline clients),
  write conflicts as an inherent consequence, leaderless quorum systems with W + R > N, the sloppy
  quorum and hinted handoff relaxation, read repair and anti-entropy, quorum's failure to provide
  linearizability without extra work, and the operational simplicity argument for each model.
- **Demo** — the quorum laboratory: configurable N, W and R with nodes failing and partitions
  injected, showing when reads return stale data even with W + R > N (concurrent writes, sloppy
  quorums), verified by the consistency checker.
- **Diagram** — mermaid diagram of a quorum read overlapping a quorum write across replicas.
- **Lab** — implement quorum reads and writes with read repair; tests assert the overlap property
  holds for the configured W and R, that read repair converges replicas, and that the documented
  staleness cases occur exactly where predicted.
- **Senior insight** — W + R > N guarantees overlap, not recency ordering: two concurrent writes can
  both satisfy it and the reader sees one arbitrarily. Quorums are a durability mechanism, not a
  consistency model.

### 54.9 Conflict detection and resolution
- **Covers** — detecting concurrent writes with version vectors (from 54.4), last-write-wins and the
  data loss it guarantees, application-level merge functions, sibling values returned to the
  application, conflict-free merge as a data-structure property (previewing M56's CRDTs), the
  semantics of delete under concurrency (the resurrection problem), and designing for merge.
- **Demo** — conflict gallery: the same concurrent-update scenario resolved by LWW, by sibling
  return with application merge, and by a CRDT, with the data lost in each case counted explicitly.
- **Diagram** — mermaid diagram of two concurrent updates and the three resolution outcomes.
- **Lab** — implement sibling detection and an application merge function for a shopping-cart
  scenario; tests assert no item is lost across concurrent add/remove operations, which the LWW
  version demonstrably fails.
- **Senior insight** — last-write-wins is a decision to lose data silently, and it is the default in
  more systems than people realise; the shopping-cart example is the standard demonstration because
  the loss is obvious there and invisible elsewhere.

### 54.10 Testing distributed systems
- **Covers** — why unit tests miss distributed bugs, fault injection (partitions, delays, clock
  skew, crashes, message loss and duplication), the Jepsen methodology of generating a history and
  checking it against a model, deterministic simulation testing (FoundationDB's approach) with a
  single-threaded seeded scheduler, minimising a failing schedule, and building this into CI.
- **Demo** — the test harness applied to the replication implementations from this milestone:
  randomised faults generate histories, the checker verifies the claimed consistency model, and any
  violation is minimised and replayed deterministically.
- **Diagram** — mermaid flowchart of generate → execute with faults → record history → check →
  shrink → replay.
- **Lab** — write a history checker for read-your-writes and monotonic reads; tests assert it flags
  the seeded violations and accepts the correct executions, then run it against the M54
  implementations.
- **Senior insight** — deterministic simulation is the highest-leverage technique in this milestone:
  once the whole system runs on a seeded scheduler, every bug found is reproducible forever, and
  that changes distributed debugging from archaeology into engineering.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/dist/sim.js` | Nodes, messaging, partitions, clocks, crashes, deterministic seeds |
| `src/js/machines/dist/clocks.js` | Physical skew/drift, Lamport, vector, hybrid logical clocks |
| `src/js/machines/dist/failure-detect.js` | Heartbeats, fixed timeouts, phi-accrual |
| `src/js/machines/dist/replication.js` | Single-leader, multi-leader, leaderless quorum stores |
| `src/js/machines/dist/conflict.js` | Version vectors, siblings, LWW, merge functions |
| `src/js/machines/dist/checker.js` | Linearizability, causal, session-guarantee checking |
| `src/js/machines/dist/fault-injection.js` | Scripted and randomised fault schedules with shrinking |
| `src/js/viz/spacetime-view.js` | Space-time diagrams with messages and causal edges |

---

## Acceptance criteria

- [ ] Every consistency claim is verified by the history checker against recorded executions, never
      asserted in prose alone.
- [ ] Vector-clock classification matches ground-truth causality for randomised executions.
- [ ] The failover demo reports exactly which acknowledged writes were lost, per replication mode.
- [ ] Fencing-token tests assert an old leader's writes are rejected at the storage layer.
- [ ] Quorum tests demonstrate both the overlap guarantee and its limits (the documented staleness
      cases), each as an assertion.
- [ ] LWW's data loss is quantified in a test, not described.
- [ ] Every simulation is deterministic given a seed, asserted by running twice and comparing full
      histories.

---

## Sources

- Kleppmann — *Designing Data-Intensive Applications*
- Lamport — *Time, clocks, and the ordering of events in a distributed system*
- Fischer, Lynch, Paterson — *Impossibility of distributed consensus with one faulty process*
- Gilbert, Lynch — *Brewer's conjecture and the feasibility of consistent, available, partition-tolerant web services*
- Abadi — *Consistency tradeoffs in modern distributed database system design* (PACELC)
- Corbett et al. — *Spanner: Google's globally distributed database* (TrueTime)
- Kulkarni et al. — *Logical physical clocks* (HLC)
- Hayashibara et al. — *The phi accrual failure detector*
- Kingsbury — the Jepsen reports; Apple/FoundationDB — deterministic simulation testing talks
