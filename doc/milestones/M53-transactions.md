# M53 — Transactions, isolation and recovery

> **Track** Data systems · **Depends on** M51, M42 · **Sections** 10 · **Effort** L

**Outcome.** Concurrency control and recovery built on the M51 engine and crash-tested with M44's
crash injection: locking, MVCC, serialisable snapshot isolation, ARIES recovery, and an isolation
test suite that shows what each level actually permits. Ends with the anomalies that reach
application code and how to test for them.

**Shared machinery introduced.** `machines/db/txn/` — the transaction manager (lock manager, version
store, log manager, recovery), `machines/db/isolation-lab.js` — the anomaly test suite (a Hermitage-
style set of interleavings run against each isolation level, reporting which anomalies each permits),
and `machines/db/crash-lab.js` — crash sweeps over the log and data files with a durability oracle.

---

## Sections

### 53.1 The transaction abstraction
- **Covers** — atomicity, consistency, isolation and durability with precise meanings (and the
  observation that C is the application's job), the transaction lifecycle, the failure model (crash,
  transaction abort, media failure), what "commit" must guarantee, savepoints and nested
  transactions, and read-only transaction optimisations.
- **Demo** — the transaction tracer: statements executed with their effect on the version store, the
  log and the lock table, followed by commit or abort, with the exact state rolled back on abort
  highlighted.
- **Diagram** — mermaid state diagram of a transaction's lifecycle including partial abort to a
  savepoint.
- **Lab** — implement abort with savepoint rollback; tests assert that rolling back to a savepoint
  undoes exactly the statements after it and leaves earlier effects intact, including index
  modifications.
- **Senior insight** — atomicity is about *effects*, not statements: an aborted transaction must undo
  index entries, sequence side effects (which usually are not undone) and anything else it touched,
  and the exceptions are where surprises live.

### 53.2 Anomalies and isolation levels
- **Covers** — the anomaly catalogue (dirty read, non-repeatable read, phantom, lost update, read
  skew, write skew), the ANSI levels and their well-documented inadequacy, snapshot isolation and
  what it does and does not prevent, the difference between the standard's definitions and real
  implementations, and what each major database actually provides at each named level.
- **Demo** — the anomaly matrix: every anomaly's interleaving run against every implemented
  isolation level, with the result (prevented or permitted) filled in live and each cell clickable
  to replay the interleaving step by step.
- **Diagram** — mermaid sequence diagram of write skew under snapshot isolation with both
  transactions committing.
- **Lab** — implement the write-skew scenario and demonstrate it under snapshot isolation, then
  prevent it with an explicit predicate lock; tests assert the anomaly occurs at SI and does not at
  the stronger level.
- **Senior insight** — write skew is the anomaly that snapshot isolation permits and that most
  developers assume is impossible: two transactions each read a constraint, each see it satisfied,
  and both commit changes that jointly violate it. Bank overdraft and on-call rota bugs are the
  standard examples.

### 53.3 Two-phase locking
- **Covers** — shared and exclusive locks, the two-phase rule and why it produces serialisability,
  strict 2PL and its recoverability guarantee, lock granularity and intention locks with the
  hierarchy, predicate and gap locks for phantom prevention, deadlock detection with a wait-for
  graph (from M42) versus timeout, victim selection, lock escalation and its latency cliff, and
  lock-manager implementation.
- **Demo** — lock-table visualiser: transactions acquiring and waiting on locks with the wait-for
  graph drawn live; a deadlock forms, is detected and a victim is chosen, with the selection policy
  adjustable.
- **Diagram** — mermaid diagram of the lock hierarchy with intention locks at each level.
- **Lab** — implement deadlock detection with wait-for cycle detection and victim selection by
  transaction age; tests assert every deadlock is detected within a bound, that the youngest
  transaction is chosen, and that no false positives occur under heavy but acyclic waiting.
- **Senior insight** — lock escalation converts many row locks into one table lock and can turn a
  well-behaved workload into a serialised one at a specific row count; it is a cliff, and the
  threshold is a configuration parameter almost nobody knows.

### 53.4 Multi-version concurrency control
- **Covers** — versions instead of blocking readers, version chains and their storage (append-only
  versus delta versus in-place with an undo log), visibility rules from a transaction's snapshot,
  transaction ids and snapshot representation, garbage collection of old versions and the long-
  running-transaction problem, index handling under MVCC, and the differences between PostgreSQL,
  MySQL/InnoDB and Oracle's designs.
- **Demo** — version-store explorer: a row's version chain over time with each transaction's
  snapshot shown, demonstrating which version each reader sees; a long-running transaction blocks
  garbage collection and the version chain grows, with the resulting scan-cost increase measured.
- **Diagram** — mermaid diagram of a version chain with two snapshots pointing at different
  versions.
- **Lab** — implement snapshot visibility rules and version-chain traversal; tests assert every
  reader sees exactly the committed state as of its snapshot, across randomised concurrent
  histories.
- **Senior insight** — one forgotten `BEGIN` in an idle session blocks version cleanup for the whole
  database, and the symptom is table bloat and slow scans everywhere else; that single failure mode
  is worth knowing before it happens.

### 53.5 Optimistic concurrency and SSI
- **Covers** — optimistic control's read/validate/write phases (from M47), backward and forward
  validation, serialisable snapshot isolation's detection of dangerous structures (two consecutive
  rw-dependencies), the false-positive aborts SSI accepts, the abort-rate-versus-contention curve,
  and choosing between pessimistic and optimistic for a workload.
- **Demo** — SSI in action: the write-skew interleaving from 53.2 now aborted by dangerous-structure
  detection, with the rw-dependency edges drawn as they form; contention is increased and the abort
  rate is plotted.
- **Diagram** — mermaid diagram of the two rw-dependency edges that form a dangerous structure.
- **Lab** — implement rw-dependency tracking and dangerous-structure detection; tests assert that
  every non-serialisable history in the fixture set is aborted and that serialisable histories are
  not (bounded false-positive rate reported).
- **Senior insight** — SSI gives serialisability at snapshot-isolation read cost and pays for it in
  aborts, which means the application *must* handle retry; a system using SSI without a retry loop
  is one contention spike away from user-visible errors.

### 53.6 Logging and recovery
- **Covers** — write-ahead logging and the WAL rule, log records (redo, undo, compensation), the
  log sequence number and page LSNs, steal/no-force buffer policies and why they need both redo and
  undo, ARIES's three phases (analysis, redo, undo), checkpoints (fuzzy and consistent), group
  commit and its latency/throughput trade, log-shipping for replication (previewing M54), and
  recovery time as an availability metric.
- **Demo** — crash and recover: perform work, crash at an arbitrary log position, then watch
  analysis rebuild the dirty-page and transaction tables, redo replay forward and undo roll back
  losers — with the final state compared against the durability oracle.
- **Diagram** — mermaid diagram of ARIES's three phases over the log with the checkpoint and crash
  points marked.
- **Lab** — implement ARIES recovery including compensation log records for undo; tests assert
  correct recovery for *every* crash point in an exhaustive sweep, including a crash during
  recovery itself (recovery must be idempotent).
- **Senior insight** — recovery must be restartable, because a crash during recovery is exactly when
  a second crash is likely; compensation log records exist so undo work is never repeated
  incorrectly, and testing crash-during-recovery is the step everyone skips.

### 53.7 Distributed transactions
- **Covers** — atomic commit across nodes, two-phase commit's protocol and its blocking window when
  the coordinator fails, three-phase commit and why it is not used, consensus-backed commit (Paxos
  commit, previewing M55), the coordinator log's durability requirement, transaction managers and
  XA, sagas with compensating actions and their weaker guarantees, and the outbox pattern for
  atomicity across a database and a message broker.
- **Demo** — 2PC with failure injection: kill the coordinator between prepare and commit and watch
  participants block holding locks; then run the consensus-backed variant and watch it recover; a
  saga runs the same business operation with compensations and a partial failure is compensated.
- **Diagram** — mermaid sequence diagram of 2PC with the coordinator-failure blocking window marked.
- **Lab** — implement 2PC with participant recovery from the prepared state; tests assert atomicity
  across every failure point (all commit or all abort) and that a recovered participant resolves its
  prepared transactions correctly.
- **Senior insight** — a participant in the prepared state holds its locks until the coordinator
  returns; that is why 2PC is an availability risk, and why most systems chose sagas plus
  idempotency instead — trading atomicity for availability deliberately.

### 53.8 Weak isolation in practice
- **Covers** — what your database's default level actually is (rarely serialisable), read-committed's
  practical anomalies, `SELECT ... FOR UPDATE` and its correct use, optimistic application-level
  concurrency with version columns, advisory locks, the check-then-act anti-pattern, uniqueness
  enforcement under concurrency, idempotency keys, and testing an application's assumptions against
  the real isolation level.
- **Demo** — the application-anomaly gallery: common application patterns (increment a counter,
  reserve inventory, enforce uniqueness, upsert) run concurrently at read-committed, showing which
  break and how, then fixed with the appropriate mechanism and re-run.
- **Diagram** — mermaid sequence diagram of check-then-act failing under concurrency and the atomic
  alternative.
- **Lab** — fix the inventory-reservation race using each of three mechanisms (row lock, atomic
  conditional update, optimistic version); tests assert no oversell under 100 concurrent
  reservations for each mechanism, and report the throughput of each.
- **Senior insight** — most application-level race conditions are check-then-act against a database
  that permits it; the fix is to make the check and the act one atomic statement, which is usually a
  conditional `UPDATE ... WHERE` rather than a lock.

### 53.9 Concurrency-control performance
- **Covers** — the contention curve and where each protocol collapses, hot rows and how to shard
  them, lock-wait analysis, abort rates and retry storms, batching and deterministic execution
  (Calvin's approach), single-threaded execution as a legitimate design (Redis, VoltDB), the effect
  of transaction length on contention, and measuring contention in production.
- **Demo** — the contention laboratory: 2PL, MVCC and SSI under increasing contention on a hot key,
  with throughput, abort rate and latency percentiles plotted; each protocol's collapse point is
  visible and different.
- **Diagram** — mermaid diagram of throughput against contention for the three protocols with their
  collapse regions.
- **Lab** — reduce contention on a hot counter by sharding and periodic aggregation; tests assert
  the total remains exactly correct and that throughput scales with shard count.
- **Senior insight** — every concurrency-control protocol has a contention level at which it
  collapses, and the fix is never a different protocol — it is removing the contention, usually by
  splitting the hot object.

### 53.10 Testing transactional systems
- **Covers** — what to test (durability, atomicity, isolation, recovery), crash sweeps as the
  durability test, the Hermitage-style isolation test suite, linearizability and serialisability
  checking over recorded histories (from M42), fault injection (crashes, slow disks, partial
  writes, torn pages), the simulation-testing approach (deterministic scheduling plus injected
  faults), and building this into CI.
- **Demo** — the full test harness run against the engine: isolation matrix, crash sweep,
  serialisability checking of randomised concurrent histories, and a torn-page injection that the
  page checksum catches.
- **Diagram** — mermaid flowchart of the test harness: generate history → execute with faults →
  check invariants → shrink → replay.
- **Lab** — write a serialisability checker for recorded transaction histories and run it against
  the engine at each isolation level; tests assert it reports non-serialisable histories at the
  weaker levels and none at serialisable.
- **Senior insight** — Jepsen's contribution was not finding bugs, it was demonstrating that
  documented guarantees were untested; running the isolation suite against your own database, at
  your own configuration, is a day of work and routinely surprising.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/db/txn/manager.js` | Transaction lifecycle, savepoints, commit/abort |
| `src/js/machines/db/txn/lock-manager.js` | Lock modes, hierarchy, waits, deadlock detection |
| `src/js/machines/db/txn/mvcc.js` | Version chains, snapshots, visibility, garbage collection |
| `src/js/machines/db/txn/ssi.js` | rw-dependency tracking, dangerous structures, abort decisions |
| `src/js/machines/db/txn/log.js` | WAL records, LSNs, checkpoints, group commit |
| `src/js/machines/db/txn/recovery.js` | ARIES analysis/redo/undo with CLRs and restartability |
| `src/js/machines/db/txn/distributed.js` | 2PC, participant recovery, sagas, outbox |
| `src/js/machines/db/isolation-lab.js` | Anomaly interleavings run against every level |
| `src/js/machines/db/crash-lab.js` | Crash sweeps, torn pages, durability oracle |
| `src/js/algorithms/serializability-check.js` | History checking for serialisability and linearizability |

---

## Acceptance criteria

- [ ] The anomaly matrix is generated by *running* each interleaving against each level, never
      hard-coded from the literature.
- [ ] Recovery passes an exhaustive crash sweep, including crashes during recovery (idempotence).
- [ ] Every acknowledged commit survives recovery and no aborted or in-flight transaction's effects
      appear, asserted against the durability oracle.
- [ ] MVCC visibility is validated against a reference implementation over randomised concurrent
      histories.
- [ ] SSI aborts every non-serialisable fixture history and its false-positive rate is measured and
      reported.
- [ ] The distributed-commit tests assert atomicity across every failure injection point.
- [ ] The serialisability checker is validated against known-good and known-bad histories before it
      is used to judge the engine.

---

## Sources

- Bernstein, Hadzilacos, Goodman — *Concurrency Control and Recovery in Database Systems*
- Mohan et al. — *ARIES: a transaction recovery method supporting fine-granularity locking*
- Berenson et al. — *A critique of ANSI SQL isolation levels*
- Cahill, Röhm, Fekete — *Serializable isolation for snapshot databases*
- Kleppmann — *Designing Data-Intensive Applications*, transactions chapter
- Thomson et al. — *Calvin: fast distributed transactions for partitioned database systems*
- Kingsbury — the Jepsen analyses; Kleppmann — the Hermitage isolation test suite
- Gray, Reuter — *Transaction Processing: Concepts and Techniques*
