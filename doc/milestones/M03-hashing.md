# M03 — Hashing and hash tables

> **Track** Data structures · **Depends on** M02 · **Sections** 9 · **Effort** M

**Outcome.** Hash tables from the bit mixing up to the layout tricks in modern standard libraries,
with every collision-resolution scheme runnable side by side on the same key stream. Ends with
adversarial input, because a hash table is one of the few data structures with a security story.

**Shared machinery introduced.** `machines/hash-lab.js` — one harness that runs any table
implementation against a chosen key distribution (sequential, random, clustered, adversarial,
real-word list) and reports probe counts, load factor, longest probe sequence and layout occupancy.

---

## Sections

### 3.1 What a hash function has to do
- **Covers** — determinism, uniformity, avalanche, speed; the difference between a hash for a
  table, a checksum and a cryptographic digest; FNV-1a, djb2, murmur3 and xxhash finalisers;
  mixing with `Math.imul` in JavaScript; hashing composite keys and the `hashCombine` trap.
- **Demo** — avalanche tester: flip one input bit, see the output bit-change matrix as a heat map;
  bucket-distribution histogram and chi-squared readout for the selected function and key set.
- **Diagram** — mermaid flowchart of a mix-finalise round.
- **Lab** — implement murmur3's finaliser and pass the avalanche test (each output bit flips on
  40–60% of single-bit input changes); implement `hashCombine` for tuples and beat a naive XOR on
  the collision test.
- **Senior insight** — XOR-ing field hashes together makes `(a, b)` collide with `(b, a)`. Almost
  every hand-rolled composite hash has this bug.

### 3.2 Universal, tabulation and keyed hashing
- **Covers** — the universal-hashing guarantee, multiply-shift, tabulation hashing and its
  independence properties, keyed hashes (SipHash) and hash-flooding attacks, per-process seeds,
  and why iteration order is deliberately unspecified in modern runtimes.
- **Demo** — HashDoS simulator: send crafted colliding keys at a table with a fixed hash, watch the
  longest chain and insertion cost explode; enable a per-run seed or a keyed hash and watch the
  attack fail.
- **Diagram** — mermaid sequence of the attack against a web request handler.
- **Lab** — construct a colliding key set for a provided weak hash; then implement multiply-shift
  and show the same attack no longer works.
- **Senior insight** — the 2011 hash-flooding disclosures are why your language randomises its hash
  seed. If you cache hashes across processes, you have reintroduced the problem.

### 3.3 Separate chaining
- **Covers** — bucket arrays with list, array or tree buckets; expected chain length; the
  tree-conversion threshold used by real map implementations; memory overhead per entry; iteration
  cost when the table is sparse.
- **Demo** — chained table on the hash lab: buckets drawn as columns with live chain lengths, the
  maximum-chain gauge, and the expected-versus-observed distribution plot.
- **Diagram** — mermaid diagram of a bucket array with a treeified bucket.
- **Lab** — implement chained insert, lookup and delete, then add the treeify threshold; tests
  assert correctness and a bounded worst-case lookup on adversarial input.
- **Senior insight** — treeification is a security mitigation with a performance story attached,
  not the other way round.

### 3.4 Open addressing
- **Covers** — linear, quadratic and double hashing; primary and secondary clustering; load factor
  and the expected-probe formulas; tombstones and their accumulation; deletion by backward shift;
  probe-sequence visualisation; why open addressing wins on cache locality.
- **Demo** — probe visualiser: insert a key and watch the probe walk over the slot array, with
  cluster length statistics and a live plot of expected probes 1/(1−α) versus measured.
- **Diagram** — mermaid flowchart of the insert path including the tombstone case.
- **Lab** — implement backward-shift deletion for linear probing; tests assert no lookup regression
  after 10⁵ mixed operations, which the tombstone version fails.
- **Senior insight** — tombstones turn a delete-heavy table into a slow one that never recovers
  until it rehashes. This is a real production failure, not a textbook footnote.

### 3.5 Robin Hood, hopscotch and cuckoo hashing
- **Covers** — Robin Hood displacement and probe-distance variance, backward-shift deletion in
  Robin Hood tables, hopscotch neighbourhoods, cuckoo hashing with two and with d tables, insertion
  cycles and the rebuild, and the load factors each scheme survives.
- **Demo** — three tables side by side on the same key stream: probe-distance histograms, worst
  case per scheme, and the cuckoo eviction chain animated as a directed walk.
- **Diagram** — mermaid graph of a cuckoo eviction chain, including a cycle.
- **Lab** — implement Robin Hood insertion with displacement; tests assert the invariant that probe
  distance never decreases along a cluster, and that the variance is below the linear-probing
  baseline.
- **Senior insight** — Robin Hood does not lower the mean probe count; it lowers the variance,
  which is what tail latency is made of.

### 3.6 SIMD-style metadata probing (Swiss tables)
- **Covers** — control bytes, splitting the hash into index bits and 7 tag bits, group probing,
  what the SIMD comparison buys, empty/deleted/full states, and the cache behaviour that makes the
  design win.
- **Demo** — Swiss-table walkthrough: a group of 16 control bytes with the tag comparison done
  byte-by-byte in JS and the matching mask shown; a counter for groups probed per lookup versus a
  plain open-addressed table.
- **Diagram** — mermaid diagram splitting a 64-bit hash into H1 and H2 and mapping them to a slot
  group.
- **Lab** — implement `matchTag(controlBytes, tag)` returning a bitmask, then the group-probe loop;
  tests assert equality with a reference implementation across randomised groups.
- **Senior insight** — the JavaScript version cannot be as fast as the SSE one, but the group
  structure is the point: one cache line answers "is it here" for 16 slots.

### 3.7 Resizing and rehashing
- **Covers** — when to grow, growth factors, full rehash cost, incremental and generational rehash,
  Redis-style two-table migration, why resizing invalidates iterators, and the latency spike a
  synchronous rehash puts in a p99.
- **Demo** — latency trace of insertions with synchronous rehash versus incremental rehash: the
  spike is visible and measurable; a slider moves work-per-operation during migration.
- **Diagram** — mermaid state diagram of the two-table incremental migration.
- **Lab** — implement incremental rehash that moves k buckets per operation; tests assert every key
  is findable throughout the migration and the per-operation work stays bounded.
- **Senior insight** — a hash table with a 10 ms p99.9 is usually a hash table that rehashed.

### 3.8 Perfect and minimal perfect hashing
- **Covers** — static key sets, the FKS two-level scheme, CHD and BDZ minimal perfect hashing,
  construction cost versus lookup cost, bits per key, and where they are used (compiler keywords,
  routing tables, on-disk indexes).
- **Demo** — build a minimal perfect hash over a supplied word list; show the seed search, the
  bits-per-key achieved, and a lookup with zero probes.
- **Diagram** — mermaid diagram of the FKS two-level structure.
- **Lab** — implement the FKS second-level table sizing (m = n² per bucket) and verify no collision
  remains; report total space.
- **Senior insight** — if the key set is fixed at build time, a hash table is the wrong structure,
  and almost nobody notices.

### 3.9 Hash tables in the wild, and JavaScript's own
- **Covers** — `Map` versus plain objects, key coercion and `-0`/`NaN` semantics, insertion-order
  iteration and what it costs, V8 dictionary-mode objects and hidden-class transitions,
  `WeakMap` and reachability, string interning and hash caching, sets, multimaps, and choosing
  a table for a given workload.
- **Demo** — workload chooser: pick read/write ratio, key type, size and deletion rate; the panel
  runs every implementation from this milestone and ranks them on measured probes and time.
- **Diagram** — mermaid decision flowchart for picking a scheme.
- **Lab** — implement an insertion-ordered map with O(1) delete (entries array plus index map plus
  compaction); tests assert order preservation and no unbounded growth after many deletes.
- **Senior insight** — using an object as a map moves you into dictionary mode after the first
  delete, and the shape transition is silent. `Map` exists for a reason.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/hash-functions.js` | FNV-1a, djb2, murmur3, xxh-style finaliser, multiply-shift, tabulation |
| `src/js/algorithms/hash-table-chained.js` | Chaining with treeify threshold |
| `src/js/algorithms/hash-table-open.js` | Linear, quadratic, double hashing, backward-shift delete |
| `src/js/algorithms/hash-table-robinhood.js` | Robin Hood, hopscotch, cuckoo |
| `src/js/algorithms/swiss-table.js` | Control bytes, group probing |
| `src/js/algorithms/hash-rehash.js` | Synchronous and incremental rehash with a per-operation work trace |
| `src/js/algorithms/perfect-hash.js` | FKS and CHD construction |
| `src/js/algorithms/ordered-map.js` | Insertion-ordered map with O(1) delete and a compaction rule |
| `src/js/machines/hash-lab.js` | Key generators, adversarial set builder, metrics |
| `src/js/viz/bucket-view.js` | Slot and bucket rendering with probe animation |
| `src/js/viz/avalanche-view.js` | Bit-change heat map |

`hash-rehash.js` and `ordered-map.js` were not in the original plan: 3.7 needs a table that can be
driven through both resize strategies while recording per-operation work, and 3.9 needs the
structure behind `Map` rather than another hash table.

---

## Acceptance criteria

- [x] Every table implements one shared interface, so `hash-lab` can run all of them unmodified.
- [x] Property tests: each implementation matches a reference `Map` over 10⁵ mixed operations with
      random and adversarial keys — `tests/unit/hash-modules.test.js`, 13 tables × 4 key streams ×
      2 delete rates.
- [x] The avalanche test is a real statistical check, not a spot check, and the weak hash in 3.1
      fails it while murmur3 passes.
- [x] The HashDoS demo demonstrably degrades the unseeded table and demonstrably does not degrade
      the keyed one, using generated colliding keys rather than a canned list.
- [x] Incremental rehash keeps every key findable at every step, asserted per operation. This is
      the criterion that caught the migration bug: a slot emptied in the old table cut the probe
      chain, so a key was briefly reachable in neither table.

---

## Sources

- Cormen et al. — chapter 11, including universal hashing
- Pagh, Rodler — *Cuckoo hashing*
- Celis — *Robin Hood hashing*
- Herlihy, Shavit, Tzafrir — *Hopscotch hashing*
- Abseil / Google — *Swiss tables design notes*
- Aumasson, Bernstein — *SipHash: a fast short-input PRF*
- Crosby, Wallach — *Denial of service via algorithmic complexity attacks*
- Belazzougui, Botelho, Dietzfelbinger — *Hash, displace, and compress*
