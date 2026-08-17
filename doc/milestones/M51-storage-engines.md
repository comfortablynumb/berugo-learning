# M51 — Storage engines and indexes

> **Track** Data systems · **Depends on** M04, M44 · **Sections** 10 · **Effort** L

**Outcome.** A working storage engine: pages, a buffer pool, a B+tree, an LSM tree, columnar
storage and secondary indexes, all over the M44 block device so read/write amplification, crash
behaviour and cache effects are measured rather than described. Ends with a key-value store built
from the parts and benchmarked under standard workloads.

**Shared machinery introduced.** `machines/db/` — the storage-engine package (page manager, buffer
pool, engines, index types) sharing one interface; `machines/db/workload-lab.js` — YCSB-style
workload generation (read-heavy, write-heavy, scan-heavy, Zipf skew, uniform) reporting throughput,
latency percentiles, read/write/space amplification and I/O counts; `viz/lsm-view.js` and
`viz/btree-disk-view.js`.

---

## Sections

### 51.1 What a storage engine is
- **Covers** — the interface a storage engine exposes (get, put, delete, scan, transaction hooks),
  the page as the unit of I/O, durability and atomicity requirements, the separation between storage
  engine and query engine (and why pluggable engines exist), and the design axes that will recur:
  read amplification, write amplification and space amplification.
- **Demo** — the interface tour: the same operations executed against every engine implemented in
  this milestone, showing the I/O each performs, with an amplification summary per engine.
- **Diagram** — mermaid diagram of the layering from client through query engine, storage engine,
  buffer pool and device.
- **Lab** — implement the engine interface's scan semantics (snapshot iteration with a stable view);
  tests assert a scan is unaffected by concurrent writes and returns exactly the keys present at its
  start.
- **Senior insight** — the RUM conjecture (you can optimise two of read, update and memory) is the
  most useful frame in storage: every engine choice is picking which one to sacrifice, and knowing
  which one your workload can afford is the decision.

### 51.2 Pages and record layout
- **Covers** — the slotted page with its header, slot array and free space, tuple layout with fixed
  and variable-length fields, NULL bitmaps, alignment and padding (from M39), overflow pages for
  large values, page splits and compaction within a page, tuple identifiers and their stability, and
  row versus column layout at the page level.
- **Demo** — the page inspector: insert, update and delete tuples and watch the slot array, free
  space and fragmentation change byte by byte; an update that no longer fits in place demonstrates
  the forwarding pointer or page split.
- **Diagram** — mermaid diagram of a slotted page with slots pointing at tuples from the page end.
- **Lab** — implement slotted-page insert, delete and in-page compaction; tests assert no tuple
  overlap, correct free-space accounting, stable tuple identifiers across compaction, and correct
  behaviour when a page is full.
- **Senior insight** — updating a variable-length column to a longer value can move the tuple, which
  invalidates index entries pointing at it; that is why some engines index by primary key rather than
  by physical location, and it changes every index's cost.

### 51.3 The buffer pool
- **Covers** — frames and the page table, pin/unpin and the reference discipline, replacement
  policies from M21 with the scan-resistance requirement, dirty-page tracking and write-back,
  prefetching for sequential scans, the buffer pool as the reason databases avoid mmap (from M43),
  latching versus locking, and sizing the pool against the working set.
- **Demo** — buffer-pool visualiser: frames with pin counts and dirty flags, a workload driving
  eviction, hit ratio plotted against pool size, and a large scan evicting the working set under LRU
  but not under a scan-resistant policy.
- **Diagram** — mermaid diagram of the page table mapping page ids to frames with pin state.
- **Lab** — implement pin/unpin with eviction that respects pins; tests assert a pinned page is never
  evicted, that unpinned dirty pages are written before reuse, and that the hit ratio matches the
  policy's expected behaviour on the fixture trace.
- **Senior insight** — the pin discipline is a manual memory-management contract inside the database;
  a missing unpin is a leak that manifests as "the buffer pool has no free frames" under load, hours
  later.

### 51.4 The B+tree storage engine
- **Covers** — the on-disk B+tree (from M04) with real page constraints, node layout and fanout
  computation, splits and merges with their write cost, latch crabbing for concurrent access,
  optimistic latch coupling, prefix and suffix truncation for higher fanout, bulk loading, sequential
  insert patterns and the right-edge hot spot, and key design (why a random UUID primary key is
  expensive, from M17).
- **Demo** — insert patterns compared: sequential, random and time-ordered keys into the same tree,
  with page splits, tree height, fill factor and total write I/O reported; the random-UUID case
  visibly writes far more pages.
- **Diagram** — mermaid diagram of latch crabbing down the tree with the safe-node release rule.
- **Lab** — implement latch crabbing for reads and writes; tests assert no deadlock, correct
  concurrent behaviour against a linearizability check, and that no more than the necessary latches
  are held at any point.
- **Senior insight** — random primary keys scatter inserts across the whole tree, so every insert
  dirties a different page and write amplification explodes; ordered keys keep the working set to the
  right edge. This is the most consequential schema decision most teams never measure.

### 51.5 LSM trees
- **Covers** — the write-optimised design, the memtable and its structure (skip list, from M04), the
  write-ahead log for memtable durability, immutable SSTables with their index and bloom filter
  (from M07), compaction strategies (size-tiered versus levelled) and their amplification profiles,
  tombstones and delete latency, read paths across levels, and compaction as a background-work
  scheduling problem.
- **Demo** — LSM visualiser: writes filling the memtable, flushes creating SSTables, compaction
  merging levels, with read amplification per lookup and write amplification over time plotted; the
  strategy is switchable and the amplification curves change shape.
- **Diagram** — mermaid diagram of levelled compaction merging an SSTable into the next level.
- **Lab** — implement levelled compaction with size ratios and overlap selection; tests assert
  correctness (a read after compaction returns the newest value for every key), the level-size
  invariants, and that tombstones are dropped only when safe.
- **Senior insight** — a tombstone must survive until every older version is gone, which is why
  delete-heavy workloads on LSM engines get slower and why "we deleted the data but reads got worse"
  is a real and confusing incident class.

### 51.6 B-tree versus LSM
- **Covers** — the amplification comparison in detail, workload matching (read-heavy versus
  write-heavy, point versus range, update-in-place versus append), space amplification and
  compaction debt, tail latency from compaction stalls versus B-tree page splits, hardware
  interaction (from M44's SSD behaviour), and hybrid designs.
- **Demo** — head-to-head: identical workloads through both engines with read, write and space
  amplification, throughput and p99 latency reported; the crossover point is found by sweeping the
  read/write ratio.
- **Diagram** — mermaid diagram placing both engines on the RUM triangle.
- **Lab** — predict which engine wins for five described workloads, then verify by measurement;
  graded on the predictions and the reasoning, with the measured results shown afterwards.
- **Senior insight** — the honest summary is that LSM trades read and space amplification for write
  amplification and predictable sequential I/O; on flash that trade is usually right, which is why
  the newest engines are mostly LSM.

### 51.7 Columnar storage
- **Covers** — the analytical access pattern and why row storage wastes I/O for it, column chunks
  and row groups, the Parquet/ORC layout, per-column encodings (dictionary, RLE, bit-packing, delta
  — from M22), compression on top of encoding, zone maps and min/max statistics for skipping,
  predicate pushdown, late materialisation, and vectorised reads (previewing M52).
- **Demo** — the same dataset stored row-wise and column-wise, with an analytical query's bytes read
  compared per storage layout; enabling zone maps and predicate pushdown skips row groups and the
  saving is reported per query.
- **Diagram** — mermaid diagram of a columnar file's row groups, column chunks and footer statistics.
- **Lab** — implement zone-map construction and row-group skipping; tests assert identical query
  results with and without skipping, and a measured reduction in bytes read matching the data
  distribution.
- **Senior insight** — sorting the data by the column you filter on is what makes zone maps
  effective; an unsorted column's min/max cover everything and skip nothing, which is why clustering
  keys matter more than compression in analytical stores.

### 51.8 Secondary indexes
- **Covers** — the index as a redundant sorted copy, clustered versus non-clustered organisation,
  index-only scans and covering indexes, the write amplification each index adds, composite index
  column order and what it enables, index selectivity and when a scan is better, partial and
  expression indexes, index maintenance cost during bulk load, and the cost of over-indexing.
- **Demo** — index advisor laboratory: a query set and a table, with each candidate index's effect
  on query cost and on write cost shown; adding indexes improves reads and degrades writes on a live
  plotted trade-off curve.
- **Diagram** — mermaid diagram of a covering index answering a query without touching the base
  table.
- **Lab** — choose an index set for a workload under a write-cost budget; graded on total measured
  cost (read plus write) against the optimum found by exhaustive search over small candidate sets.
- **Senior insight** — every index is a write tax paid on every insert and update; the right question
  is never "would this index help this query" but "does it help more than it costs across the whole
  workload".

### 51.9 Specialised indexes
- **Covers** — hash indexes and their point-lookup-only limitation, bitmap indexes for low
  cardinality (with the Roaring representation from M09), inverted indexes for text (from M06) with
  BM25 scoring, spatial indexes (from M08), vector indexes for similarity search (from M08) and
  their recall/latency dial, partial indexes for skewed predicates, and matching an index type to a
  query shape.
- **Demo** — the index gallery: the same data indexed every applicable way, with each index's size,
  build time, supported query types and lookup cost tabulated; queries the index cannot answer are
  marked rather than silently falling back.
- **Diagram** — mermaid decision flowchart from query shape to index type.
- **Lab** — implement a bitmap index with Roaring containers and boolean query evaluation; tests
  assert results match a reference scan and that memory stays below a bound for low-cardinality
  columns.
- **Senior insight** — vector indexes return *approximate* results, so adding one silently changes
  query semantics from exact to probabilistic; that must be a documented product decision, not an
  index-tuning detail.

### 51.10 Building a key-value store
- **Covers** — assembling the parts into a working store: WAL for durability, memtable plus
  SSTables, a block cache, a manifest for the file set, crash recovery (using M44's crash injection),
  compaction scheduling under a background-work budget, snapshot reads, and benchmarking with
  standard workload mixes.
- **Demo** — the finished store under a YCSB-style workload matrix with throughput, latency
  percentiles, amplification and space usage reported; a crash is injected mid-write and recovery is
  verified against the acknowledged-write set.
- **Diagram** — mermaid diagram of the store's components with the write path and read path traced.
- **Lab** — implement crash recovery from WAL plus manifest; tests assert every acknowledged write
  survives across an exhaustive crash sweep and that no unacknowledged write appears.
- **Senior insight** — "every acknowledged write survives, no unacknowledged write appears" is the
  entire durability contract, and it is testable by crash sweep; a system that has never been crash-
  tested has an unknown contract, whatever its documentation says.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/db/page.js` | Slotted pages, tuple layout, overflow, in-page compaction |
| `src/js/machines/db/buffer-pool.js` | Frames, pin/unpin, replacement, write-back, prefetch |
| `src/js/machines/db/btree-engine.js` | On-disk B+tree with latch crabbing and bulk load |
| `src/js/machines/db/lsm-engine.js` | Memtable, WAL, SSTables, bloom filters, compaction strategies |
| `src/js/machines/db/columnar.js` | Row groups, column chunks, encodings, zone maps |
| `src/js/machines/db/indexes.js` | Secondary, covering, partial, hash, bitmap, inverted, vector |
| `src/js/machines/db/kvstore.js` | The assembled store with manifest and recovery |
| `src/js/machines/db/workload-lab.js` | Workload generation, amplification and latency metrics |
| `src/js/viz/lsm-view.js`, `btree-disk-view.js` | Level/SSTable and page-level tree rendering |

---

## Acceptance criteria

- [ ] Every engine implements one interface and is validated against a reference map over 10⁵ mixed
      operations, including scans with concurrent writes.
- [ ] Read, write and space amplification are measured and reported for every engine on every
      workload; no comparison is made without all three.
- [ ] The B+tree's latch protocol is validated by a linearizability check under concurrent access.
- [ ] LSM compaction preserves correctness (newest value wins) and tombstone semantics, asserted
      after every compaction in randomised tests.
- [ ] Crash recovery passes an exhaustive crash sweep: every acknowledged write survives and no
      unacknowledged write appears.
- [ ] The random-versus-ordered key experiment reports measured write amplification for both.
- [ ] Zone-map skipping is asserted to produce identical results to a full scan.

---

## Sources

- Hellerstein, Stonebraker, Hamilton — *Architecture of a Database System*
- Petrov — *Database Internals*
- Graefe — *Modern B-tree techniques*
- O'Neil, Cheng, Gawlick, O'Neil — *The log-structured merge-tree*
- Athanassoulis et al. — *Designing access methods: the RUM conjecture*
- Abadi, Boncz, Harizopoulos — *The design and implementation of modern column-oriented database systems*
- Cooper et al. — *Benchmarking cloud serving systems with YCSB*
- The RocksDB and LevelDB design documentation
