# Roadmap

65 milestones, one file each in [`milestones/`](milestones/). Each milestone is an independently
shippable slice: a group of sections that share machinery, ship together, and leave the platform
green (`npm test`) at the end.

Read [`architecture.md`](architecture.md) first — it is the normative "how"; a milestone only says
"what".

- **Sections** — how many navigable sections the milestone adds.
- **Effort** — S ≈ one working session, M ≈ two or three, L ≈ a week of sessions, XL ≈ more.
- **Depends** — milestones whose modules this one reuses. Nothing depends on a later number except
  where stated.

---

## Track 0 — How to use this site

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M00](milestones/M00-platform-foundation.md) | Platform foundation and the runnable-code engine | 4 | L | — |

## Track 1 — Data structures

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M02](milestones/M02-linear-structures.md) | Linear structures and memory layout | 9 | M | M01 |
| [M03](milestones/M03-hashing.md) | Hashing and hash tables | 9 | M | M02 |
| [M04](milestones/M04-search-trees.md) | Search trees and disjoint sets | 10 | L | M02 |
| [M05](milestones/M05-heaps.md) | Heaps and priority queues | 8 | M | M02 |
| [M06](milestones/M06-tries-and-text-indexes.md) | Tries, suffix structures and text indexes | 9 | L | M04 |
| [M07](milestones/M07-probabilistic-structures.md) | Probabilistic and streaming sketches | 9 | M | M03 |
| [M08](milestones/M08-spatial-indexes.md) | Spatial and multidimensional indexes | 9 | M | M04 |
| [M09](milestones/M09-persistent-structures.md) | Persistent, immutable and succinct structures | 9 | L | M04, M06 |

## Track 2 — Algorithms

M01 sits here rather than under the platform track: analysis is the first thing the algorithms
track needs, and "how to use this site" should mean the site.

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M01](milestones/M01-complexity-and-analysis.md) | Complexity, analysis and benchmarking methodology | 9 | M | M00 |
| [M10](milestones/M10-sorting-and-selection.md) | Sorting, selection and searching | 10 | L | M01, M05 |
| [M11](milestones/M11-design-paradigms.md) | Algorithm design paradigms | 9 | M | M10 |
| [M12](milestones/M12-dynamic-programming.md) | Dynamic programming | 11 | L | M11 |
| [M13](milestones/M13-graphs-i.md) | Graph algorithms I — traversal, order, shortest paths, MST | 10 | L | M04, M05 |
| [M14](milestones/M14-graphs-ii.md) | Graph algorithms II — flow, matching, connectivity, spectral | 10 | L | M13 |
| [M15](milestones/M15-string-algorithms.md) | String algorithms and pattern matching | 11 | L | M06 |
| [M16](milestones/M16-computational-geometry.md) | Computational geometry | 10 | L | M08, M10 |
| [M17](milestones/M17-numbers-and-bits.md) | Numbers, bits and floating point | 10 | M | M01 |
| [M18](milestones/M18-numerical-methods.md) | Numerical methods, transforms and optimisation | 10 | L | M17 |
| [M19](milestones/M19-randomized-algorithms.md) | Randomised and approximation algorithms | 9 | M | M11, M17 |
| [M20](milestones/M20-np-completeness.md) | NP-completeness, reductions and metaheuristics | 9 | M | M13, M19 |
| [M21](milestones/M21-online-and-external.md) | Online, external-memory and cache-oblivious algorithms | 9 | M | M10, M37 |
| [M22](milestones/M22-compression-and-coding.md) | Compression, information theory and error correction | 11 | L | M05, M15 |
| [M23](milestones/M23-cryptography.md) | Applied cryptography and constant-time programming | 11 | L | M17, M22 |

## Track 3 — Automata, languages and compilers

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M24](milestones/M24-regular-languages.md) | Regular languages and finite automata | 11 | L | M02, M13 |
| [M25](milestones/M25-context-free-parsing.md) | Context-free languages and parsing | 12 | XL | M24 |
| [M26](milestones/M26-computability.md) | Computability and complexity theory | 10 | L | M24, M20 |
| [M27](milestones/M27-lambda-and-types.md) | Lambda calculus, type systems and semantics | 11 | L | M25 |
| [M28](milestones/M28-compiler-frontend.md) | Compiler front end — build a language | 9 | L | M25, M27 |
| [M29](milestones/M29-ir-and-optimization.md) | IR, SSA and optimisation | 10 | L | M28, M13 |
| [M30](milestones/M30-codegen-vm-jit.md) | Code generation, bytecode VMs and JIT | 10 | L | M29, M34 |
| [M31](milestones/M31-garbage-collection.md) | Garbage collection and runtime memory | 9 | L | M30, M43 |
| [M32](milestones/M32-program-analysis.md) | Program analysis, SAT/SMT and verification | 11 | XL | M29, M26 |

## Track 4 — Computer architecture

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M33](milestones/M33-digital-logic.md) | Digital logic and sequential circuits | 10 | L | M24 |
| [M34](milestones/M34-isa-and-datapath.md) | ISA, assembly, datapath and control | 10 | L | M33 |
| [M35](milestones/M35-pipelining.md) | Pipelining, hazards and branch prediction | 9 | L | M34 |
| [M36](milestones/M36-out-of-order.md) | Superscalar, out-of-order execution and speculation | 9 | L | M35 |
| [M37](milestones/M37-memory-hierarchy.md) | Caches and the memory hierarchy | 10 | L | M34 |
| [M38](milestones/M38-coherence-and-consistency.md) | Cache coherence and memory consistency | 9 | L | M37 |
| [M39](milestones/M39-linking-and-loading.md) | Linking, loading and the ABI | 9 | M | M34 |
| [M40](milestones/M40-gpu-and-accelerators.md) | GPUs, SIMD and domain-specific accelerators | 9 | L | M37 |

## Track 5 — Operating systems

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M41](milestones/M41-processes-and-scheduling.md) | Processes, threads and scheduling | 10 | L | M34 |
| [M42](milestones/M42-synchronization.md) | Synchronisation, deadlock and the classic problems | 10 | L | M41, M38 |
| [M43](milestones/M43-virtual-memory.md) | Virtual memory, paging and allocators | 11 | L | M37, M41 |
| [M44](milestones/M44-file-systems.md) | File systems and crash consistency | 10 | L | M43 |
| [M45](milestones/M45-io-and-event-loops.md) | I/O, interrupts, event loops and async runtimes | 10 | L | M41, M44 |
| [M46](milestones/M46-virtualization.md) | Virtualisation, containers and isolation | 9 | L | M43, M44 |
| [M47](milestones/M47-concurrency-in-practice.md) | Concurrency and parallelism in practice | 11 | XL | M42, M38 |

## Track 6 — Networking

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M48](milestones/M48-link-ip-routing.md) | Link layer, IP and routing | 9 | M | M13 |
| [M49](milestones/M49-transport-and-congestion.md) | Transport: TCP, UDP, QUIC and congestion control | 10 | L | M48, M24 |
| [M50](milestones/M50-web-stack.md) | DNS, TLS and the web protocol stack | 10 | L | M49, M23 |

## Track 7 — Data systems

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M51](milestones/M51-storage-engines.md) | Storage engines and indexes | 10 | L | M04, M44 |
| [M52](milestones/M52-query-processing.md) | Query processing and optimisation | 10 | L | M51, M12 |
| [M53](milestones/M53-transactions.md) | Transactions, isolation and recovery | 10 | L | M51, M42 |

## Track 8 — Distributed systems

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M54](milestones/M54-distributed-time.md) | Distributed time, consistency and replication | 10 | L | M49, M53 |
| [M55](milestones/M55-consensus.md) | Consensus and fault tolerance | 9 | XL | M54 |
| [M56](milestones/M56-partitioning-and-crdts.md) | Partitioning, membership, gossip and CRDTs | 10 | L | M54, M03 |
| [M57](milestones/M57-streaming-and-resilience.md) | Stream processing and resilience engineering | 10 | L | M56, M07 |

## Track 9 — Engineering practice

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M58](milestones/M58-performance-engineering.md) | Performance engineering and queueing theory | 10 | L | M01, M37 |
| [M59](milestones/M59-security-engineering.md) | Security engineering and side channels | 11 | L | M23, M50 |
| [M60](milestones/M60-architecture-and-api-design.md) | Software architecture, API and schema design | 11 | L | M52, M57 |
| [M61](milestones/M61-testing-and-observability.md) | Testing, debugging and observability | 10 | L | M32, M58 |
| [M62](milestones/M62-systems-data.md) | Systems data: Unicode, time, serialisation, RNG and IDs | 10 | M | M17, M22 |

## Track 10 — Practice and mastery

| ID | Milestone | Sections | Effort | Depends |
|---|---|---|---|---|
| [M63](milestones/M63-build-your-own-x.md) | Build-your-own-X capstones | 12 | XL | many |
| [M64](milestones/M64-challenge-arena.md) | Challenge arena, progress and spaced repetition | 8 | L | M00 |

---

## Totals

| | |
|---|---|
| Milestones | 65 |
| Sections | 634 |
| Tracks | 11 |

Every section carries: one interactive demo, one editable code lab with at least two graded
exercises, at least four concepts, at least one worked example with real arithmetic, and one
reference entry. The content tests in M00 enforce that floor for every section added afterwards.

---

## Suggested build order

The dependency table allows several orders. This one keeps the platform demonstrably useful at
every stage and front-loads the machinery later milestones reuse.

**Phase 1 — a platform worth opening (M00, M01, M02, M03, M04, M05, M10)**
The engine, the analysis vocabulary, and the data structures and sorting work that every later
track leans on. At the end of this phase the site is already a strong data-structures trainer.

**Phase 2 — the algorithms core (M11, M12, M13, M14, M15, M17)**
Paradigms, dynamic programming, graphs and strings — the material an interview-grade senior is
expected to hold, with the visual demos that make it stick.

**Phase 3 — the theory spine (M24, M25, M26, M27)**
Automata through parsing through computability. M24 and M25 are also the machinery the compiler
track and the protocol state machines reuse, so building them early pays twice.

**Phase 4 — the machine (M33, M34, M35, M37, M41, M42, M43)**
A CPU you can single-step, a cache you can thrash, a scheduler you can starve, an allocator you
can fragment. This is the phase that most distinguishes the platform from every other
learn-to-code site.

**Phase 5 — systems at scale (M48, M49, M51, M53, M54, M55)**
Networking, storage and consensus, all as simulators with injectable faults.

**Phase 6 — depth and craft (everything remaining, then M63, M64)**
The specialised algorithm milestones, the runtime milestones, engineering practice, and finally
the capstones and the practice arena that tie it together.

A milestone is done when its acceptance criteria pass, `npm test` is green, `npm run lint:size`
reports no new offenders, and the README curriculum table is updated.

---

## Scope notes

- **Beyond the original brief.** The brief named algorithms, data structures, automata and
  language theory, operating systems and low-level architecture. Compilers and runtimes,
  networking, data systems, distributed systems, security, performance engineering and the craft
  track were added; the reasoning and the full list are in
  [`topic-suggestions.md`](topic-suggestions.md). Tracks 6 to 10 can be cut without affecting
  tracks 0 to 5.
- **Nothing here is a stub.** Every demo listed in a milestone is implementable in a browser with
  the stack in `architecture.md`. Where a real system cannot be reproduced faithfully (a real
  kernel, real silicon, a real network), the section models it explicitly, says so in the
  orientation text, and states what the model omits.
- **No claimed feature ships as a placeholder.** If a section cannot be built as described, the
  milestone is edited before the code is written.
