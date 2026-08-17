# M56 — Partitioning, membership, gossip and CRDTs

> **Track** Distributed systems · **Depends on** M54, M03 · **Sections** 10 · **Effort** L

**Outcome.** How a system spreads data across nodes and keeps them in agreement without a
coordinator: partitioning and rebalancing, gossip-based membership, anti-entropy, and conflict-free
replicated data types — ending with a real collaborative text editor synchronising across simulated
peers through partitions.

**Shared machinery introduced.** `machines/dist/partitioning.js` — placement strategies with load
and movement metrics; `machines/dist/gossip.js` — epidemic protocols with convergence measurement;
`machines/crdt/` — the CRDT library with a merge-property checker that verifies commutativity,
associativity and idempotence by exhaustive testing; `viz/convergence-view.js` — replica-divergence
over time.

---

## Sections

### 56.1 Partitioning strategies
- **Covers** — why partition at all (capacity, throughput, blast radius), range partitioning with
  its ordered-scan advantage and hot-spot risk, hash partitioning with its uniformity and lost
  ordering, composite keys giving both, partition-key selection as the highest-leverage schema
  decision, hot partitions and their mitigations, rebalancing strategies, and request routing
  (client-side, proxy, coordinator).
- **Demo** — partition-load explorer: the same key distribution under range and hash partitioning
  with per-partition load shown, a skewed workload producing a hot partition, and the composite-key
  and salting fixes applied with the load re-measured.
- **Diagram** — mermaid diagram of the three routing approaches from client to partition.
- **Lab** — choose a partition key for a described workload and verify load balance; graded on the
  measured maximum-to-mean partition load ratio and on whether required range scans remain possible.
- **Senior insight** — the partition key decides both load distribution and which queries stay
  cheap; it is chosen once, early, usually for the wrong reason, and it is the hardest thing to
  change later.

### 56.2 Consistent hashing
- **Covers** — the naive `hash mod N` rebalancing catastrophe, the hash ring, virtual nodes for
  balance, replication by walking the ring, adding and removing nodes with minimal movement,
  rendezvous (highest-random-weight) hashing as the simpler alternative, bounded-load consistent
  hashing, and the interaction with caches (why a cache node's removal should not stampede the
  origin).
- **Demo** — the ring visualiser: keys placed on the ring, nodes added and removed with the moved
  keys highlighted and counted, virtual-node count adjustable with the load-balance improvement
  plotted; `mod N` is shown alongside moving nearly everything.
- **Diagram** — mermaid diagram of a hash ring with virtual nodes and a key's replica set.
- **Lab** — implement consistent hashing with virtual nodes and bounded loads; tests assert that
  adding a node moves approximately K/N keys, that no node exceeds the load bound, and that replica
  sets contain distinct physical nodes.
- **Senior insight** — the replica-set-must-be-distinct-physical-nodes rule is easy to violate with
  virtual nodes and produces a system that loses data when one machine fails despite "three
  replicas".

### 56.3 Distributed hash tables
- **Covers** — the peer-to-peer lookup problem, Chord's finger tables with O(log n) hops, Kademlia's
  XOR metric and k-buckets, routing-table maintenance under churn, the join and leave protocols,
  replication for durability, the lookup-latency versus routing-state trade-off, and where DHT
  ideas resurfaced in production systems.
- **Demo** — Kademlia lookup animation: the XOR distance to the target shown per hop with the
  routing table consulted at each step, churn injected and lookups continuing to succeed with the
  hop count degrading gracefully.
- **Diagram** — mermaid diagram of an iterative Kademlia lookup narrowing by XOR distance.
- **Lab** — implement Kademlia's k-bucket maintenance and iterative lookup; tests assert successful
  lookups under 30% churn and a hop count within the O(log n) bound over randomised topologies.
- **Senior insight** — the XOR metric is symmetric, which means a node learns about useful peers
  from the queries it receives as well as the ones it sends; that single property is why Kademlia's
  maintenance is nearly free compared with Chord's.

### 56.4 Membership and gossip
- **Covers** — maintaining a member list without a coordinator, gossip/epidemic protocols and their
  logarithmic convergence, push, pull and push-pull variants with their different convergence
  profiles, SWIM's separation of failure detection from dissemination with indirect probing,
  suspicion mechanisms to reduce false positives, and the message-overhead-versus-convergence-time
  trade.
- **Demo** — gossip convergence: an update injected at one node, spreading through the cluster with
  the infected fraction plotted against rounds and the theoretical curve overlaid; fanout and loss
  rate are adjustable and the curve responds.
- **Diagram** — mermaid diagram of SWIM's direct probe, indirect probe and suspicion states.
- **Lab** — implement SWIM's probe/indirect-probe/suspicion protocol; tests assert failure detection
  within the expected time bound, a false-positive rate below a threshold under message loss, and
  membership convergence across all nodes.
- **Senior insight** — gossip converges in O(log n) rounds with constant per-node cost, which is why
  it scales where a coordinator does not; the price is that "current membership" is always a
  slightly stale, per-node opinion.

### 56.5 Anti-entropy and repair
- **Covers** — replicas drifting and the mechanisms that reconcile them, read repair on the request
  path, hinted handoff during temporary failures, background anti-entropy with Merkle trees (from
  M23) for efficient difference detection, delta-state synchronisation, range-based repair
  scheduling, the cost of full repair, and detecting silent divergence.
- **Demo** — Merkle-based repair: two replicas with a few differing keys, tree comparison narrowing
  to the differing ranges with the bytes exchanged counted against a full-data comparison, and the
  divergence closed.
- **Diagram** — mermaid diagram of two Merkle trees compared top-down to locate a differing leaf.
- **Lab** — implement Merkle-tree construction and the recursive comparison protocol; tests assert
  all differences are found, that identical replicas exchange only the root hash, and that the
  exchanged bytes scale with the number of differences rather than the data size.
- **Senior insight** — repair cost should scale with divergence, not with data volume; a system
  whose repair reads everything will eventually be unable to repair at all, which is how silent
  divergence becomes permanent.

### 56.6 CRDTs: the foundations
- **Covers** — the convergence requirement, join-semilattices and monotonic merge, state-based
  (CvRDT) versus operation-based (CmRDT) designs and their delivery requirements, the basic types
  (G-counter, PN-counter, LWW-register, MV-register, G-set, 2P-set, OR-set) with the semantics each
  actually provides, delta-state CRDTs for bandwidth, and the metadata cost.
- **Demo** — the CRDT bench: replicas updated independently under a partition and then merged, with
  the merge property (commutative, associative, idempotent) checked exhaustively over the
  operation set and any violation exhibited as a counter-example.
- **Diagram** — mermaid diagram of a join-semilattice with two states and their least upper bound.
- **Lab** — implement an OR-set with add and remove; tests assert convergence for every permutation
  and duplication of the operation set, and that the add-wins semantics hold for concurrent add and
  remove (which a 2P-set fails).
- **Senior insight** — the interesting question is never whether a CRDT converges but *what it
  converges to*: add-wins and remove-wins are both conflict-free and they give different answers,
  and that choice is a product decision.

### 56.7 Sequence CRDTs and collaborative text
- **Covers** — the ordered-sequence problem and why it is the hard CRDT, unique immutable
  identifiers for positions, dense identifier spaces (Logoot, LSEQ) and their interleaving
  anomalies, RGA and causal-length approaches, tombstones and garbage collection, the metadata
  overhead per character, and the performance characteristics of production implementations
  (Yjs, Automerge).
- **Demo** — the text-CRDT inspector: characters with their identifiers shown, two peers editing
  concurrently and merging, interleaving anomalies produced deliberately and then avoided by the
  better identifier scheme, with metadata bytes per character reported.
- **Diagram** — mermaid diagram of two concurrent insertions at the same position and their
  deterministic ordering.
- **Lab** — implement an RGA-style sequence with insert and delete; tests assert convergence across
  every permutation of concurrent operations and that no interleaving anomaly appears in the
  fixture scenarios.
- **Senior insight** — the metadata is the story: naive text CRDTs use more space for identifiers
  than for text, and every practical implementation is an exercise in compressing or garbage-
  collecting that overhead.

### 56.8 Operational transformation
- **Covers** — OT's alternative approach (transform operations against concurrent ones), the
  transformation functions and their required properties (TP1, TP2), central-server OT versus
  peer-to-peer, intention preservation, the historical bugs in published OT algorithms, the honest
  OT-versus-CRDT comparison (server requirement, complexity, memory, latency), and what production
  systems actually use.
- **Demo** — side-by-side OT and CRDT for the same concurrent edit sequence, showing both converge,
  with the operation transformations displayed for OT and the identifier arithmetic for the CRDT,
  plus memory and message size for each.
- **Diagram** — mermaid diagram of two operations transformed against each other to converge.
- **Lab** — implement the transformation function for concurrent insert/delete and verify TP1 by
  exhaustive testing; tests assert convergence for every operation pair and report any TP1 violation
  with the counter-example.
- **Senior insight** — OT with a central server is simpler and lighter than a CRDT and is what
  Google Docs uses; CRDTs win when there is no server to order operations, which is the local-first
  case in the next section.

### 56.9 Local-first and offline sync
- **Covers** — the local-first principle (the local copy is the primary), sync protocols over
  intermittent connectivity, causal delivery requirements for op-based CRDTs, compaction and
  history pruning, schema migration in a replicated document, conflict presentation in the UI
  (when a merge cannot be automatic), end-to-end encryption's interaction with server-side merge,
  and the operational realities of mobile clients.
- **Demo** — an offline-capable app simulated across three devices: edits made while disconnected,
  sync on reconnection with causal delivery enforced, and a semantic conflict that no CRDT can
  resolve surfaced to the user rather than silently merged.
- **Diagram** — mermaid sequence diagram of two devices syncing after an offline period with causal
  dependencies satisfied.
- **Lab** — implement causal delivery buffering for op-based CRDT operations; tests assert
  operations are applied only after their dependencies, that all replicas converge, and that no
  operation is lost when messages arrive out of order.
- **Senior insight** — CRDTs guarantee that replicas agree, not that the result makes sense: "both
  edits preserved" can still be a wrong document, and deciding which conflicts need human resolution
  is the design work that the data type cannot do.

### 56.10 Building a collaborative editor
- **Covers** — assembling the milestone: peers over the simulated network with partitions and
  churn, a sequence CRDT for the document, presence and cursor sharing (ephemeral state that must
  *not* be a CRDT), undo in a collaborative setting, garbage collection of tombstones under
  concurrent editing, persistence and reload, and measuring convergence time and metadata growth.
- **Demo** — the editor itself: several simulated peers typing concurrently with partitions
  injected, the document converging after healing, cursors and presence updating, and a live
  readout of metadata bytes per character and convergence latency.
- **Diagram** — mermaid diagram of the editor's architecture: local state, CRDT layer, sync
  protocol, presence channel.
- **Lab** — implement collaborative undo (undo my last operation, not the last global operation);
  tests assert the undo affects only the initiating peer's operation, that all replicas converge
  after undo, and that undo of a concurrently-deleted item behaves as specified.
- **Senior insight** — collaborative undo is where every implementation struggles, because "undo"
  is a semantic operation over a shared history rather than a state transition; getting it right
  requires deciding what undo *means* before choosing the mechanism.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/dist/partitioning.js` | Range, hash, composite strategies with load metrics |
| `src/js/algorithms/consistent-hash.js` | Ring, virtual nodes, rendezvous, bounded loads |
| `src/js/algorithms/dht.js` | Chord and Kademlia routing, churn handling |
| `src/js/machines/dist/gossip.js` | Push/pull/push-pull, SWIM, suspicion, convergence metrics |
| `src/js/algorithms/anti-entropy.js` | Merkle trees, range repair, delta sync, hinted handoff |
| `src/js/crdt/basic.js` | Counters, registers, sets with semantics documented per type |
| `src/js/crdt/sequence.js` | RGA-style sequence, identifier allocation, tombstone GC |
| `src/js/crdt/checker.js` | Exhaustive merge-property verification with counter-examples |
| `src/js/algorithms/ot.js` | Transformation functions with TP1/TP2 checking |
| `src/js/machines/collab-editor.js` | The assembled editor with sync, presence and undo |

---

## Acceptance criteria

- [ ] Every CRDT's merge is verified commutative, associative and idempotent by exhaustive testing
      over generated operation sets; a violation is reported with the counter-example.
- [ ] Convergence is asserted for every permutation and duplication of operations, not for a sample.
- [ ] Consistent hashing moves approximately K/N keys on node addition, asserted with a tolerance,
      and replica sets are asserted to span distinct physical nodes.
- [ ] Gossip convergence matches the theoretical O(log n) curve within a stated tolerance.
- [ ] Merkle repair exchanges bytes proportional to divergence, asserted against a full-comparison
      baseline.
- [ ] The sequence CRDT is checked for interleaving anomalies on the standard adversarial fixtures.
- [ ] The editor converges after every injected partition, verified by deep document comparison
      across all peers.

---

## Sources

- Karger et al. — *Consistent hashing and random trees*
- Thaler, Ravishankar — highest random weight hashing; Mirrokni et al. — *Consistent hashing with bounded loads*
- Stoica et al. — *Chord*; Maymounkov, Mazières — *Kademlia*
- Das, Gupta, Motivala — *SWIM: scalable weakly-consistent infection-style process group membership*
- DeCandia et al. — *Dynamo: Amazon's highly available key-value store*
- Shapiro, Preguiça, Baquero, Zawirski — *Conflict-free replicated data types*
- Roh et al. — *Replicated abstract data types* (RGA); Nicolaescu et al. — the Yjs evaluation
- Ellis, Gibbs — *Concurrency control in groupware systems* (OT)
- Kleppmann et al. — *Local-first software*
