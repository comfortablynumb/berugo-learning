# M44 — File systems and crash consistency

> **Track** Operating systems · **Depends on** M43 · **Sections** 10 · **Effort** L

**Outcome.** A working file system in the browser — inodes, directories, allocation, a journal —
running on a simulated block device that can be crashed at any point, so crash consistency is
demonstrated by actually crashing and checking, not asserted. Ends with the durability semantics
that every database and message queue depends on and most applications get wrong.

**Shared machinery introduced.** `machines/blockdev.js` — a block device with configurable latency,
queue depth, reordering, write caching and a crash injector that can lose or reorder in-flight
writes; `machines/fs/` — the file-system implementations sharing a VFS-style interface;
`machines/fs/checker.js` — an offline consistency checker used as the oracle after every simulated
crash.

---

## Sections

### 44.1 The file abstraction
- **Covers** — files as byte streams versus records, inodes and what they hold, directories as
  name→inode maps, hard links and reference counts, symbolic links and path resolution loops,
  permissions and the check order, file descriptors and the three-level table structure (fd table,
  open-file table, inode table), offsets shared across `dup` and `fork`, and `unlink` on an open
  file.
- **Demo** — the descriptor explorer: open, `dup`, `fork` and see the three tables with their
  sharing relationships; unlink a file that is still open and watch the data remain accessible until
  the last descriptor closes.
- **Diagram** — mermaid diagram of the fd table → open-file table → inode table chain with sharing.
- **Lab** — implement `link`, `unlink` and reference counting; tests assert data survives while any
  link or open descriptor remains and is freed exactly when the last one goes, including the
  open-then-unlink case.
- **Senior insight** — the "delete a file that a process still has open" behaviour is not a quirk;
  it is the mechanism behind temporary files, atomic log rotation and every "why is my disk still
  full after `rm`" question.

### 44.2 On-disk layout and allocation
- **Covers** — the superblock, inode tables, data blocks, free-space tracking with bitmaps versus
  free lists, block size and its internal-fragmentation trade, direct/indirect/double-indirect
  pointers and the maximum file size they imply, extents as the modern alternative, allocation
  policies for locality, delayed allocation, and the FAT design as the contrast.
- **Demo** — layout inspector: create files and watch the superblock, bitmaps, inodes and data blocks
  update byte by byte; a fragmentation view shows a file's blocks scattering under a fragmenting
  workload, with the resulting sequential-read cost measured.
- **Diagram** — mermaid diagram of an inode's direct, indirect and double-indirect pointer tree.
- **Lab** — implement block allocation with a locality policy (allocate near the inode and near the
  previous block); tests assert correct free-space accounting and a measured reduction in seek
  distance versus first-fit on the fixture workload.
- **Senior insight** — delayed allocation exists because the file system does not know the final
  size at first write; it buys contiguity and costs data on a crash before writeback, which is
  exactly the ext4 controversy from 2009.

### 44.3 Namespace and the VFS
- **Covers** — directory representation (linear, hashed, B-tree), path resolution step by step,
  the dentry cache and negative caching, mount points and the namespace tree, the VFS layer as the
  interface that lets one system host many file systems, `..` and symlink resolution rules,
  case sensitivity and normalisation traps (linking to M62), and per-process namespaces (M46).
- **Demo** — path-resolution tracer: resolve a path with symlinks and mount crossings, showing each
  lookup, cache hit or miss, and permission check; a symlink loop is resolved into the correct error
  rather than a hang.
- **Diagram** — mermaid diagram of path resolution crossing a mount point.
- **Lab** — implement path resolution with symlink following and a loop limit; tests assert correct
  resolution for the fixture tree, correct errors for loops and dangling links, and that `..` at the
  root stays at the root.
- **Senior insight** — path resolution is a per-component permission check, which is why a
  directory's execute bit gates traversal; and it is why a path-based security check can be defeated
  by a symlink swapped between the check and the use (TOCTOU, revisited in M59).

### 44.4 Crash consistency
- **Covers** — what a crash can leave behind, the file-system-inconsistency states (lost blocks,
  double-allocated blocks, wrong link counts), `fsck` and why it does not scale, write ordering as
  the core requirement, journaling with metadata-only, ordered and full-data modes, the commit
  protocol and checkpointing, soft updates as the alternative, and copy-on-write file systems that
  avoid the problem structurally.
- **Demo** — the crash laboratory: perform an operation, crash the device at an arbitrary point in
  the write stream, then run the checker — with and without journaling — and see exactly which
  inconsistencies appear; a "crash at every point" sweep reports the fraction of crash points that
  leave the file system inconsistent.
- **Diagram** — mermaid sequence diagram of a journal transaction: write journal, commit record,
  checkpoint, free.
- **Lab** — implement metadata journaling with the commit record and recovery replay; tests assert
  that for *every* crash point in the write sequence, recovery produces a consistent file system
  (checked by the offline checker) — an exhaustive crash sweep, not a sample.
- **Senior insight** — the commit record exists so recovery can tell a complete transaction from a
  torn one; every durable system in this platform (databases in M53, logs in M51, consensus in M55)
  has the same construct under a different name.

### 44.5 Log-structured file systems and flash
- **Covers** — the write-anywhere idea, LFS's segments and the cleaner, the cleaning cost and its
  dependence on utilisation, flash physics (pages, blocks, erase-before-write, limited erase
  cycles), the flash translation layer as an LFS in the device, wear levelling, garbage collection
  inside the SSD, write amplification and its measurement, TRIM, and why SSD performance degrades
  when full.
- **Demo** — the SSD simulator: write patterns (sequential, random, mixed) with the FTL's mapping
  and garbage collection visible, write amplification measured live, and the performance cliff
  reproduced by filling the device beyond its over-provisioning.
- **Diagram** — mermaid diagram of the FTL mapping logical pages to physical pages with GC
  relocating valid data.
- **Lab** — implement segment cleaning with a victim-selection policy (greedy versus cost-benefit);
  tests assert the cleaner reclaims correctly, that no live data is lost, and that cost-benefit
  produces lower write amplification on the fixture workload.
- **Senior insight** — random-write workloads on SSDs are slow because of write amplification inside
  the device, not because of seeks; the fix is the same as for LFS — make writes sequential — which
  is why LSM trees (M51) dominate flash-backed storage.

### 44.6 Modern file systems
- **Covers** — ext4's extents, delayed allocation and journal checksums; XFS's allocation groups and
  scalability; btrfs and ZFS with copy-on-write, snapshots, subvolumes, checksums for silent
  corruption, and integrated volume management; the write-hole problem in RAID and how CoW file
  systems close it; and choosing a file system by workload.
- **Demo** — snapshot explorer on a CoW file system: take a snapshot, modify files, and see the
  block-sharing between versions with the space accounting; a checksum mismatch is injected and the
  file system detects (and with redundancy, repairs) it.
- **Diagram** — mermaid diagram of CoW block sharing between a snapshot and the live tree.
- **Lab** — implement CoW writes with block sharing and reference counting; tests assert snapshot
  isolation (a snapshot's contents never change), correct space accounting and correct block freeing
  when a snapshot is deleted.
- **Senior insight** — checksums are the feature that turns silent data corruption into a loud
  error; without them the file system happily returns whatever the disk gave it, which is how bit
  rot reaches backups undetected.

### 44.7 The page cache, writeback and durability
- **Covers** — the page cache as the unification of file I/O and memory (linking to M43), read
  caching and readahead, write buffering and dirty-page accounting, the writeback thread and its
  thresholds, `fsync`/`fdatasync` semantics and what they do and do not guarantee, the parent-
  directory `fsync` requirement for durable renames, write barriers and disk write caches, the
  `fsyncgate` incident, and `O_DIRECT`.
- **Demo** — the durability laboratory: perform "atomic write via temp file and rename" with and
  without the necessary `fsync` calls, crash at every point, and report which sequences actually
  survive; the disk write cache can be enabled to show it breaking an otherwise correct sequence.
- **Diagram** — mermaid sequence diagram of the durable-rename pattern with every required sync.
- **Lab** — implement the durable atomic-replace sequence; tests assert that across an exhaustive
  crash sweep the file is always either the complete old or the complete new content, never
  truncated or missing.
- **Senior insight** — a successful `write` guarantees nothing about the disk, and a successful
  `fsync` that returned an error once may never report it again; both facts have caused data loss in
  major databases, and both are testable in this laboratory.

### 44.8 Network and distributed file systems
- **Covers** — NFS's stateless design and its consequences, close-to-open consistency, caching and
  the resulting staleness, file locking over a network and its failure modes, SMB's contrasting
  stateful model, object stores versus POSIX semantics (no rename, eventual listing, no partial
  write), FUSE and user-space file systems, and choosing between a file system and an object store.
- **Demo** — consistency explorer: two clients accessing the same file over a simulated NFS with
  caching, showing when each sees the other's writes under close-to-open semantics, and the same
  scenario against an object store where a rename is a copy and a delete.
- **Diagram** — mermaid sequence diagram of close-to-open consistency between two clients.
- **Lab** — implement close-to-open cache validation with attribute-cache timeouts; tests assert the
  visibility rules hold exactly (writes visible after close-then-open, not before) and that stale
  attribute caching produces the documented behaviour rather than an arbitrary one.
- **Senior insight** — "S3 is a file system" is the most expensive wrong assumption in cloud
  engineering: no atomic rename means no rename-based commit protocol, which is why data lakes
  invented manifest files and table formats.

### 44.9 Reliability and redundancy
- **Covers** — failure modes of storage (whole-disk, sector, silent corruption, correlated
  failures), RAID levels and their read/write/rebuild characteristics, the RAID-5 write hole,
  rebuild time and the second-failure risk that killed RAID-5 for large disks, erasure coding
  (from M22) and its reconstruction cost, scrubbing, end-to-end checksums, and backup strategy
  including the restore test nobody runs.
- **Demo** — reliability simulator: choose a redundancy scheme, disk count, failure rate and rebuild
  bandwidth, then run accelerated time and observe data-loss events; the RAID-5-with-large-disks
  scenario loses data at a visibly higher rate than intuition suggests.
- **Diagram** — mermaid diagram of RAID-5 stripe layout with the parity rotation and a rebuild read
  pattern.
- **Lab** — implement RAID-5 parity computation, degraded reads and rebuild; tests assert data is
  recoverable after any single-disk failure and that the rebuild reconstructs exactly the original
  contents.
- **Senior insight** — rebuild time is a risk multiplier: with multi-terabyte disks the rebuild
  window is long enough that a second failure is not unlikely, which is the actual argument for
  RAID-6 and erasure coding rather than a preference.

### 44.10 Measuring and debugging I/O
- **Covers** — IOPS versus bandwidth versus latency and when each is the right metric, queue depth
  and its effect on both throughput and latency, random versus sequential access patterns,
  read/write mixes, the difference between device latency and end-to-end latency, benchmarking
  pitfalls (page-cache hits, insufficient working-set size, missing `fsync`, warm-up), and
  interpreting an I/O latency histogram.
- **Demo** — the benchmark harness: run configurable I/O patterns against the simulated device with
  latency histograms and throughput curves, then run the same benchmark incorrectly (working set
  smaller than the cache, no sync) and watch it report numbers that are ten times better and
  entirely fictional.
- **Diagram** — mermaid diagram of the I/O path from application through page cache and queue to
  device, with a measurement point at each layer.
- **Lab** — design a benchmark that measures true device latency for a stated workload; graded on
  whether the harness's validity checks (working-set size, sync policy, warm-up, queue depth) all
  pass.
- **Senior insight** — most published storage benchmarks measure the page cache; the tell is a
  throughput number that exceeds the device's physical capability, and checking that is a
  five-second sanity test worth doing every time.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/blockdev.js` | Latency model, queues, reordering, write cache, crash injection |
| `src/js/machines/fs/vfs.js` | Common interface, descriptor tables, path resolution, mounts |
| `src/js/machines/fs/simplefs.js` | Inodes, bitmaps, indirect blocks, directories |
| `src/js/machines/fs/journal.js` | Transactions, commit records, recovery replay |
| `src/js/machines/fs/lfs.js` | Segments, cleaner, victim selection |
| `src/js/machines/fs/cowfs.js` | Copy-on-write trees, snapshots, checksums |
| `src/js/machines/fs/ftl.js` | Flash translation layer, wear levelling, write amplification |
| `src/js/machines/fs/checker.js` | Offline consistency checker used as the crash oracle |
| `src/js/machines/fs/pagecache.js` | Read caching, dirty tracking, writeback, fsync semantics |
| `src/js/machines/fs/raid.js` | RAID levels, degraded operation, rebuild, reliability model |
| `src/js/viz/disk-layout-view.js` | Block-level layout with allocation and fragmentation |

---

## Acceptance criteria

- [ ] Crash consistency is verified by an *exhaustive* crash sweep: for every prefix of the write
      stream, recovery plus the checker must produce a consistent file system.
- [ ] The unjournalled file system demonstrably fails that same sweep, and the failing crash points
      are reported.
- [ ] Reference counting for links and open descriptors is asserted, including the open-then-unlink
      case.
- [ ] The durable-rename lab passes an exhaustive crash sweep with the correct sync sequence and
      fails it with any sync omitted.
- [ ] RAID-5 rebuild reconstructs the exact original contents after any single-disk failure.
- [ ] The I/O benchmark harness refuses to report results when its validity checks fail, and the
      failing conditions are shown.

---

## Sources

- Arpaci-Dusseau, Arpaci-Dusseau — *Operating Systems: Three Easy Pieces*, persistence chapters
- Rosenblum, Ousterhout — *The design and implementation of a log-structured file system*
- Ganger, Patt — *Soft updates: a solution to the metadata update problem*
- Prabhakaran et al. — *Analysis and evolution of journaling file systems*
- Bonwick, Moore — the ZFS design papers; Rodeh, Bacik, Mason — *BTRFS: the Linux B-tree filesystem*
- Pillai et al. — *All file systems are not created equal: on the complexity of crafting crash-consistent applications*
- Rebello et al. — *Can applications recover from fsync failures?*
- Patterson, Gibson, Katz — *A case for redundant arrays of inexpensive disks (RAID)*
