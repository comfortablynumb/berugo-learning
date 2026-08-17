# M55 — Consensus and fault tolerance

> **Track** Distributed systems · **Depends on** M54 · **Sections** 9 · **Effort** XL

**Outcome.** A working Raft implementation on the M54 simulator, model-checked with M32's tooling
and adversarially tested with partitions, clock skew and crashes — plus Paxos for the theory, BFT
for the untrusted case, and the production patterns (locks, leases, configuration) that consensus
systems are actually used for.

**Shared machinery introduced.** `machines/dist/consensus/` — the consensus implementations behind
one interface, with a replicated-state-machine layer on top; `machines/dist/consensus-lab.js` — a
scenario runner (leader failure, partition, slow follower, clock skew, message reordering, disk
loss) that records the full history and checks the safety and liveness properties after every run.

---

## Sections

### 55.1 The consensus problem
- **Covers** — the formal statement (agreement, validity, integrity, termination), why consensus
  underlies leader election, atomic broadcast, distributed locks and configuration, the equivalence
  of these problems, FLP's application here (from M54), how randomisation and partial synchrony
  escape it, and the quorum intersection argument that makes majority-based safety work.
- **Demo** — the quorum-intersection explorer: choose a cluster size and watch which subsets can
  form a majority, with a partition splitting the cluster and only one side able to proceed;
  even-sized clusters are shown to gain nothing over the odd size below them.
- **Diagram** — mermaid diagram of two quorums necessarily intersecting in at least one node.
- **Lab** — implement quorum computation and safety checking for arbitrary cluster sizes; tests
  assert every pair of quorums intersects and that a 4-node cluster tolerates exactly the same
  failure count as a 3-node one.
- **Senior insight** — a 4-node cluster tolerates one failure, the same as a 3-node one, while
  costing more and being slower; even-numbered clusters are almost always a configuration mistake.

### 55.2 Paxos
- **Covers** — single-decree Paxos with prepare and accept phases, proposal numbers and their total
  order, the promise that makes safety work, why a value once chosen can never change, the
  livelock risk with duelling proposers, Multi-Paxos with a stable leader to skip phase 1, the
  reconfiguration difficulty, and why the paper is famously hard to implement from.
- **Demo** — Paxos stepper: acceptors' promised and accepted state shown as proposals arrive, with
  the safety argument checked at each step; duelling proposers are triggered and the livelock is
  visible, then damped by randomised backoff.
- **Diagram** — mermaid sequence diagram of a Paxos round with an interfering higher proposal.
- **Lab** — implement single-decree Paxos; tests assert agreement (no two acceptors chosen different
  values) across every fault schedule in the harness, including message reordering and duplication.
- **Senior insight** — Paxos's safety is unconditional and its liveness is not, which is the pattern
  for every consensus protocol: they never disagree, they only fail to make progress, and that
  distinction is what "unavailable but correct" means operationally.

### 55.3 Raft
- **Covers** — Raft's decomposition into leader election, log replication and safety, terms as
  logical time, election timeouts with randomisation, the log-matching property, commit rules
  (including the subtle "only commit entries from the current term directly" rule), the state-machine
  safety argument, and the design's explicit priority on understandability.
- **Demo** — the Raft visualiser: a cluster with per-node state (term, log, commit index, role),
  elections triggered by killing the leader, log entries replicating and committing, with a
  network-partition control that produces two candidate leaders in different terms.
- **Diagram** — mermaid state diagram of a Raft node's role transitions with the triggering events.
- **Lab** — implement leader election with randomised timeouts and the vote-restriction rule; tests
  assert at most one leader per term across every fault schedule and that a node with a
  less-complete log can never win.
- **Senior insight** — the "do not commit previous-term entries by counting replicas" rule is the
  one that almost every from-scratch implementation gets wrong, and it produces a rare, catastrophic
  log divergence rather than an obvious failure.

### 55.4 Implementing Raft
- **Covers** — the full RPC set (RequestVote, AppendEntries, InstallSnapshot), the persistence
  requirements before responding (current term, voted-for, log), the consequences of skipping the
  disk sync, log inconsistency repair by decrementing next-index, batching and pipelining for
  throughput, the follower's conflict-hint optimisation, and the bug catalogue from real
  implementations.
- **Demo** — the bug gallery: each classic implementation bug (missing persistence, committing
  across terms, wrong vote restriction, stale-leader appends) injected into the working
  implementation, with the harness producing the failing history and the safety violation it causes.
- **Diagram** — mermaid sequence diagram of AppendEntries repairing a divergent follower log.
- **Lab** — implement log repair with the conflict-hint optimisation; tests assert convergence to
  the leader's log for every divergent-follower fixture, and that the number of round trips is
  bounded by the optimisation's promise.
- **Senior insight** — persistence before responding is not an optimisation to defer: a node that
  votes, crashes, restarts and votes again in the same term breaks the one-leader-per-term
  guarantee, and the resulting divergence appears weeks later.

### 55.5 Replicated state machines
- **Covers** — the RSM abstraction over a consensus log, the determinism requirement (no clocks, no
  randomness, no map iteration order, no floating-point non-determinism) and how it is violated in
  practice, applying entries in order, linearizable reads via the leader with a read index or a
  lease, follower reads with staleness bounds, snapshotting and log compaction, and client sessions
  for exactly-once semantics.
- **Demo** — the RSM in action: a key-value state machine over the Raft log with linearizable reads
  through read-index, then lease reads with the clock-skew hazard demonstrated by skewing a clock
  until a stale read becomes possible.
- **Diagram** — mermaid diagram of the log feeding identical state machines on every replica.
- **Lab** — implement client sessions with request deduplication; tests assert exactly-once
  application of a retried request across leader failover, verified by the state machine's applied
  count.
- **Senior insight** — lease-based reads are fast and depend on clock bounds; read-index is slower
  and depends only on the protocol. Choosing leases means accepting a correctness dependency on
  clock synchronisation, which M54 showed is not free.

### 55.6 Membership changes
- **Covers** — why naive membership change breaks quorum intersection (two disjoint majorities),
  joint consensus with the overlapping configuration, the single-server-at-a-time approach and its
  restrictions, adding a learner/non-voting member before promotion, removing the leader, disaster
  recovery when quorum is permanently lost, and the operational runbook for each.
- **Demo** — the unsafe-reconfiguration constructor: change membership without joint consensus and
  watch two leaders elected in the same term in disjoint majorities; the joint-consensus version
  makes the same schedule safe.
- **Diagram** — mermaid diagram of old and new configurations overlapping during joint consensus.
- **Lab** — implement single-server membership change with the safety restrictions; tests assert no
  two leaders in any term across every reconfiguration schedule, including a change during an
  election.
- **Senior insight** — the disjoint-majority scenario is easy to construct and hard to imagine,
  which is exactly why the naive implementation ships; this is the strongest argument in the whole
  track for model checking a protocol before implementing it.

### 55.7 Byzantine fault tolerance
- **Covers** — the Byzantine model (nodes may lie, equivocate or collude), the 3f+1 requirement and
  its proof sketch, PBFT's three-phase protocol with view changes, message-complexity costs,
  authenticated versus unauthenticated variants, blockchain consensus (proof of work as
  probabilistic agreement, proof of stake, longest-chain versus BFT-style finality), and the honest
  question of when Byzantine tolerance is worth its cost.
- **Demo** — an equivocating node: with a crash-fault-tolerant protocol it breaks agreement (shown
  as a divergent history); with PBFT-style quorums the equivocation is detected and the node's
  contradictory messages are the evidence.
- **Diagram** — mermaid sequence diagram of PBFT's pre-prepare, prepare and commit phases.
- **Lab** — implement the PBFT quorum rules and equivocation detection; tests assert agreement with
  f Byzantine nodes in a 3f+1 cluster and that agreement is violated with f+1, demonstrating the
  bound is tight.
- **Senior insight** — inside one organisation's datacentre, crash-fault tolerance is nearly always
  the right model; BFT's cost is justified by untrusted participants, which is why it lives in
  blockchains and rarely elsewhere.

### 55.8 Consensus in production
- **Covers** — what people actually use consensus systems for (leader election, configuration,
  service discovery, distributed locks, coordination), etcd/ZooKeeper/Consul usage patterns, locks
  with leases and the fencing requirement (from M54), watches and their delivery semantics, the
  write-throughput ceiling of a single Raft group, sharding into multiple groups, and the
  operational hazards (disk latency stalls the leader, cluster-wide restarts, snapshot size).
- **Demo** — the distributed-lock scenario: a client acquires a lease-based lock, pauses (GC pause
  or partition), its lease expires and another client acquires it — with the fencing token making
  the resumed client's write safe and its absence causing corruption.
- **Diagram** — mermaid sequence diagram of the paused-lock-holder scenario with and without
  fencing.
- **Lab** — implement a lease-based distributed lock with fencing tokens and a correct renewal
  protocol; tests assert mutual exclusion under injected pauses and partitions and that a stale
  holder's operations are rejected downstream.
- **Senior insight** — a distributed lock without a fencing token is not mutual exclusion, it is a
  suggestion; any pause longer than the lease (a GC pause is enough) breaks it, and the fix must be
  enforced by the *resource*, not by the lock service.

### 55.9 Verifying consensus
- **Covers** — specifying the safety properties formally (election safety, log matching, leader
  completeness, state-machine safety), model checking the specification with M32's tooling,
  bounded exploration and its coverage limits, deterministic simulation with fault injection,
  the Jepsen approach applied to a consensus system, checking liveness under fairness assumptions,
  and the practical workflow of spec-then-implement.
- **Demo** — the same protocol at both levels: the TLA-style model checked exhaustively for small
  clusters (finding the seeded reconfiguration bug), and the implementation tested by randomised
  fault injection (finding an implementation-only bug the model cannot see).
- **Diagram** — mermaid flowchart relating the specification, the model checker, the implementation
  and the simulation tests, with the bug classes each catches.
- **Lab** — specify and check leader-election safety for a 3-node cluster, then run the same property
  as a runtime invariant against the implementation; tests assert both the model check passes and
  the runtime invariant holds across the fault-schedule suite.
- **Senior insight** — model checking finds protocol bugs and simulation finds implementation bugs,
  and neither substitutes for the other; the published Raft bugs split roughly evenly between the
  two categories.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/dist/consensus/paxos.js` | Single-decree and Multi-Paxos with proposal ordering |
| `src/js/machines/dist/consensus/raft.js` | Elections, log replication, commit rules, persistence |
| `src/js/machines/dist/consensus/rsm.js` | State-machine layer, read paths, snapshots, sessions |
| `src/js/machines/dist/consensus/membership.js` | Joint consensus and single-server changes |
| `src/js/machines/dist/consensus/pbft.js` | Byzantine quorums, three-phase protocol, view change |
| `src/js/machines/dist/consensus/locks.js` | Leases, fencing tokens, renewal, watch semantics |
| `src/js/machines/dist/consensus-lab.js` | Fault schedules, history recording, property checking |
| `src/js/machines/dist/properties.js` | Safety and liveness invariants as executable predicates |
| `src/js/viz/raft-view.js` | Cluster state, logs, terms and message flow |

---

## Acceptance criteria

- [ ] Election safety (at most one leader per term) is asserted after every step of every fault
      schedule, not only at the end.
- [ ] Log matching and leader completeness are checked as runtime invariants on every replica after
      every message.
- [ ] Every seeded implementation bug in the gallery is caught by the harness, with the minimal
      failing schedule reported.
- [ ] The state machine's determinism is verified by replaying the same log on a fresh replica and
      deep-comparing state.
- [ ] Membership-change tests include a change during an election and a change during a partition.
- [ ] The PBFT bound is demonstrated tight: agreement holds with f and fails with f+1 Byzantine
      nodes.
- [ ] The lock lab asserts that a fenced stale holder's write is rejected by the resource.
- [ ] Every scenario is deterministic given its seed and replays identically.

---

## Sources

- Lamport — *The part-time parliament* and *Paxos made simple*
- Ongaro, Ousterhout — *In search of an understandable consensus algorithm* (Raft), and Ongaro's thesis
- Chandra, Griesemer, Redstone — *Paxos made live*
- van Renesse, Altinbuken — *Paxos made moderately complex*
- Castro, Liskov — *Practical Byzantine fault tolerance*
- Burrows — *The Chubby lock service*; Hunt et al. — *ZooKeeper*
- Kleppmann — *How to do distributed locking* (fencing tokens)
- Newcombe et al. — *How Amazon Web Services uses formal methods*
