# M43 — Virtual memory, paging and allocators

> **Track** Operating systems · **Depends on** M37, M41 · **Sections** 11 · **Effort** L

**Outcome.** The full memory stack from the OS side: page faults and demand paging, replacement and
reclaim, the kernel's own allocators, and the user-space `malloc` implementations underneath every
program — each one built, instrumented and measured for fragmentation, locality and tail latency.

**Shared machinery introduced.** `machines/os/vm.js` — page tables, fault handling, COW, mmap,
reclaim and swap over the M37 TLB and cache models; `machines/allocator-lab.js` — replays real-shaped
allocation traces (short-lived churn, long-lived mixed sizes, producer/consumer across threads,
fragmenting patterns) through any allocator and reports fragmentation, locality, latency
distribution and peak RSS; `viz/heap-map-view.js`.

---

## Sections

### 43.1 Virtual memory from the OS side
- **Covers** — the address-space abstraction and what it buys (isolation, relocation, sharing,
  overcommit), page tables as the OS's data structure rather than the hardware's, the kernel/user
  split and the higher-half mapping, per-process page tables and the switch cost, page-table memory
  overhead, and the fault as the OS's only hook.
- **Demo** — address-space inspector: a process's mappings with permissions and backing (anonymous,
  file, shared), the page table walked interactively, and the kernel mapping shown as shared across
  processes.
- **Diagram** — mermaid diagram of two processes' page tables mapping distinct physical frames plus
  a shared kernel region.
- **Lab** — implement page-table construction and teardown for a new process; tests assert isolation
  (no process can reach another's frames) and that teardown frees exactly the frames it allocated.
- **Senior insight** — page tables themselves cost memory proportional to the *mapped* space, which
  is why a process that maps 100 GB sparsely still pays, and why huge pages reduce the table depth
  as well as the TLB pressure.

### 43.2 Demand paging
- **Covers** — minor versus major faults, the fault path in detail, anonymous versus file-backed
  pages, copy-on-write and `fork` (from M41) measured, `mmap` semantics (private, shared, anonymous,
  file), readahead and fault-around heuristics, prefaulting and `MAP_POPULATE`, and the latency
  distribution a major fault imposes.
- **Demo** — fault tracer: run a program and watch each fault classified (minor, major, COW,
  protection) with its cost; a COW-heavy `fork` workload shows the copies happening lazily as writes
  arrive.
- **Diagram** — mermaid flowchart of the page-fault handler's decision tree.
- **Lab** — implement the COW fault path; tests assert correct data after divergent writes, that the
  page count matches the number of written pages, and that read-only access never copies.
- **Senior insight** — a major fault is a disk access hiding behind a memory instruction; a program
  whose latency is mysteriously bimodal with no I/O in its code is usually taking major faults.

### 43.3 Page replacement
- **Covers** — the eviction decision, FIFO and Belady's anomaly, optimal (Belady's algorithm) as the
  offline bound, LRU and its implementation cost, CLOCK and second chance, the active/inactive list
  design, referenced and dirty bits, the working-set model and its estimation, thrashing and its
  characteristic collapse, and swap as the last resort.
- **Demo** — replacement comparison on the same reference string with the frame contents shown per
  step: FIFO exhibits Belady's anomaly on the classic sequence (more frames, more faults), and the
  optimum is displayed as the unreachable baseline.
- **Diagram** — mermaid diagram of the CLOCK hand sweeping reference bits.
- **Lab** — implement CLOCK with a second-chance sweep; tests assert the fault count is within a
  stated factor of LRU on real traces and reproduce Belady's anomaly for FIFO on the designed
  fixture.
- **Senior insight** — thrashing is not gradual: the system crosses a threshold and collapses,
  because every fault evicts a page that is about to be needed. That non-linearity is why memory
  headroom is a stability property, not a performance one.

### 43.4 Overcommit, reclaim and the OOM killer
- **Covers** — overcommit policies and why they exist, virtual versus resident size, the reclaim
  path (background and direct reclaim), watermarks, writeback of dirty pages before eviction,
  memory pressure signals, the OOM killer's scoring and its consequences, cgroup memory limits and
  per-cgroup reclaim, and the difference between "out of memory" and "out of address space".
- **Demo** — a workload driven into memory pressure with the reclaim path visible: background
  reclaim, then direct reclaim stalls appearing in the latency trace, then the OOM kill with the
  victim's score shown; a cgroup limit reproduces the same at container scale.
- **Diagram** — mermaid diagram of the watermarks and the reclaim actions triggered at each.
- **Lab** — implement watermark-driven background reclaim; tests assert that allocation latency
  stays bounded (no direct-reclaim stalls) under a workload that stalls without it.
- **Senior insight** — direct reclaim is synchronous in the allocating thread, which is why a memory-
  pressured machine shows latency spikes in unrelated code paths; the fix is headroom or earlier
  reclaim, not faster allocation.

### 43.5 Kernel memory allocation
- **Covers** — why the kernel cannot use the same allocator as user space, the buddy allocator with
  splitting and coalescing, order-N allocations and external fragmentation, the slab allocator's
  object caches and constructors, SLUB's simplifications, per-CPU caches to avoid locking, and
  allocation from interrupt context.
- **Demo** — buddy allocator visualiser: the free-list orders shown as a tree, allocations splitting
  blocks and frees coalescing them, with fragmentation measured as the largest available order over
  time.
- **Diagram** — mermaid diagram of a buddy block splitting to satisfy a request and coalescing on
  free.
- **Lab** — implement buddy split and coalesce; tests assert every free block's buddy relationship,
  correct coalescing to the maximum possible order, and no overlap across allocations under a
  randomised trace.
- **Senior insight** — the slab allocator exists because the buddy allocator's page granularity is
  wrong for the thousands of small kernel objects; the same "size-class cache over a page allocator"
  design reappears in every user-space allocator in the next two sections.

### 43.6 User-space allocators: the classic design
- **Covers** — the `malloc`/`free` contract, chunk headers and boundary tags, free lists and bins by
  size, first-fit versus best-fit versus segregated fits, splitting and coalescing, the top chunk
  and `brk`/`mmap` thresholds, alignment requirements, and the metadata-corruption failure mode that
  turns a heap bug into an exploit.
- **Demo** — heap visualiser over a real allocation trace: chunks with headers, bins populated,
  splits and coalesces animated, and a buffer overflow corrupting an adjacent header shown as the
  allocator subsequently misbehaving.
- **Diagram** — mermaid diagram of a chunk with boundary tags and the adjacent-chunk coalescing
  check.
- **Lab** — implement segregated free lists with coalescing; tests assert no overlapping allocations,
  correct alignment, that all freed memory is reusable, and a fragmentation figure below a threshold
  on the fixture traces.
- **Senior insight** — inline metadata makes coalescing O(1) and makes a one-byte overflow a heap
  corruption; hardened allocators move metadata out of band for exactly that reason, and pay
  locality for it.

### 43.7 Modern allocators
- **Covers** — thread caches and why allocation must scale with cores, size classes and their
  rounding waste, arenas and per-thread heaps, transferring memory between threads (the
  producer/consumer allocation pattern), returning memory to the OS (`madvise`, decay policies),
  tcmalloc/jemalloc/mimalloc design differences, and the metrics that distinguish them.
- **Demo** — allocator bake-off: the implemented allocators plus a size-class thread-cached design
  run on all trace shapes, with throughput, p99 allocation latency, fragmentation and peak RSS
  reported; the cross-thread free pattern separates the designs sharply.
- **Diagram** — mermaid diagram of a thread cache backed by a central heap with batch refill and
  flush.
- **Lab** — implement a thread cache with batched refill/flush over the central allocator; tests
  assert correctness across simulated threads, no memory lost on thread exit, and measured
  scalability across thread counts.
- **Senior insight** — the allocator's hardest workload is allocate-on-one-thread, free-on-another;
  every modern design's most complex machinery exists to handle that case without a global lock.

### 43.8 Fragmentation
- **Covers** — internal fragmentation from size-class rounding, external fragmentation and its
  measurement, the difference between fragmentation and a leak, allocator-level compaction and why C
  cannot do it, memory-defragmentation techniques (relocation with handles, arena reset),
  transparent huge pages and their fragmentation-induced stalls, and long-running-process
  fragmentation growth.
- **Demo** — the fragmentation grinder: a long-running mixed-size trace with RSS, live bytes and
  fragmentation ratio plotted; the gap between live bytes and RSS widens visibly and different
  allocators diverge.
- **Diagram** — mermaid diagram of external fragmentation: enough free bytes, no contiguous run.
- **Lab** — measure and reduce fragmentation for a provided trace by choosing size classes; tests
  assert the fragmentation ratio drops below a target without increasing peak RSS.
- **Senior insight** — "the process grows forever but there is no leak" is fragmentation, and the
  fix is usually size-class or lifetime segregation (arenas per phase), not chasing allocations.

### 43.9 Memory safety and debugging
- **Covers** — the bug classes (overflow, use after free, double free, uninitialised read, leak),
  guard pages and redzones, quarantine and delayed reuse, shadow memory as used by
  AddressSanitizer, allocator hardening (out-of-band metadata, pointer mangling, randomisation),
  Valgrind-style interpretation versus compile-time instrumentation, and the overhead each costs.
- **Demo** — the detector: run a program with seeded memory bugs under a shadow-memory checker in
  the simulator, with each bug reported at the exact access, the allocation and free stacks shown,
  and the overhead measured against an uninstrumented run.
- **Diagram** — mermaid diagram of shadow memory encoding allocation state per granule.
- **Lab** — implement redzone and quarantine checking in the allocator; tests assert detection of
  every seeded overflow and use-after-free in the fixture, with no false positives on the clean
  workload.
- **Senior insight** — quarantine turns a use-after-free from silent corruption into a detected
  error, at the cost of memory; that is the same trade as a GC's delayed reclamation, which is why
  managed runtimes do not have this bug class.

### 43.10 Memory-mapped files and shared memory
- **Covers** — `mmap` of files and the page cache relationship, shared versus private mappings,
  `msync` and durability, the mmap-versus-read/write debate with its actual trade-offs (page-fault
  cost, no error handling on access, TLB pressure, no readahead control), shared memory between
  processes, zero-copy patterns, and why databases mostly stopped using mmap for their buffer pool.
- **Demo** — the same file processed with read/write and with mmap, measuring faults, syscalls,
  copies and total time; a shared-mapping demo shows two processes observing each other's writes
  immediately.
- **Diagram** — mermaid diagram of a shared file mapping backed by the page cache in two processes.
- **Lab** — implement `mmap` with lazy population and `msync` write-back; tests assert data
  visibility across processes for shared mappings, isolation for private ones, and that dirty pages
  reach the backing store only on sync or eviction.
- **Senior insight** — mmap makes I/O errors into signals rather than return values and removes the
  database's control over eviction order; the "Are you sure you want to use mmap in your DBMS" paper
  is the readable version of this argument.

### 43.11 Measuring memory
- **Covers** — VSZ, RSS, PSS, USS and what each counts, shared pages and the double-counting
  problem, `smaps`-style per-mapping accounting, the container-memory accounting question (page
  cache counted against the limit), allocation profiling and flame graphs of allocation sites, leak
  detection by growth analysis, and estimating a working set.
- **Demo** — memory forensics: a running workload's memory broken down by mapping and by allocation
  site, with growth over time attributed; a seeded leak is located from the allocation profile alone.
- **Diagram** — mermaid diagram distinguishing VSZ, RSS, PSS and USS on a shared mapping.
- **Lab** — implement allocation-site attribution and rank sites by retained bytes; tests assert the
  seeded leak's site ranks first and that the retained-bytes total reconciles with the heap's live
  set.
- **Senior insight** — RSS is the wrong metric for a process sharing a lot of memory, and it is the
  one every dashboard shows; PSS is what actually sums to the machine's usage, and knowing the
  difference resolves most "our memory does not add up" investigations.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/os/vm.js` | Page tables, fault handling, COW, mmap, reclaim, swap |
| `src/js/machines/os/replacement.js` | FIFO, LRU, CLOCK, optimal, active/inactive lists, working set |
| `src/js/machines/os/reclaim.js` | Watermarks, background and direct reclaim, OOM scoring, cgroups |
| `src/js/algorithms/buddy-allocator.js` | Split/coalesce with order tracking |
| `src/js/algorithms/slab-allocator.js` | Object caches, per-CPU caches |
| `src/js/algorithms/malloc-classic.js` | Boundary tags, bins, splitting, coalescing |
| `src/js/algorithms/malloc-modern.js` | Size classes, thread caches, arenas, decay/madvise |
| `src/js/algorithms/heap-hardening.js` | Redzones, quarantine, shadow memory, out-of-band metadata |
| `src/js/machines/allocator-lab.js` | Trace replay, fragmentation, latency and RSS metrics |
| `src/js/viz/heap-map-view.js` | Chunk-level heap map with state colouring |

---

## Acceptance criteria

- [ ] Every allocator satisfies the core invariants under randomised traces: no overlapping live
      allocations, correct alignment, all freed memory reusable, no leak of internal metadata.
- [ ] COW fault handling is verified by page-copy counts, not by inspection.
- [ ] Belady's anomaly is reproduced for FIFO on the designed reference string, as a test.
- [ ] Replacement policies are compared against the offline optimum on every trace.
- [ ] Allocation latency is reported as a distribution; fragmentation is reported as both a ratio and
      an absolute gap between live bytes and RSS.
- [ ] The hardened allocator detects every seeded memory bug with zero false positives on the clean
      workload.
- [ ] The measurement section's numbers reconcile: per-mapping accounting sums to the process total.

---

## Sources

- Arpaci-Dusseau, Arpaci-Dusseau — *Operating Systems: Three Easy Pieces*, virtualisation chapters
- Wilson, Johnstone, Neely, Boles — *Dynamic storage allocation: a survey and critical review*
- Berger, McKinley, Blumofe, Wilson — *Hoard: a scalable memory allocator*
- Evans — the jemalloc design notes; Google — the TCMalloc design document
- Leijen, Zorn, de Moura — *Mimalloc: free list sharding in action*
- Serebryany et al. — *AddressSanitizer: a fast address sanity checker*
- Crotty, Leis, Pavlo — *Are you sure you want to use MMAP in your database management system?*
