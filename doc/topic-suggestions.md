# Topic suggestions and scope

The brief named five areas: **algorithms, data structures, automata and language theory, operating
systems, low-level computer architecture** — and asked for more. This document records where the
named areas landed, what was added and why, what was deliberately left out, and how to cut the plan
down if it is too large.

---

## 1. The named areas, and where they are

| Brief | Milestones | Sections |
|---|---|---|
| Data structures | M02–M09 | 72 |
| Algorithms | M01, M10–M23 | 149 |
| Automata and language theory | M24–M27 | 44 |
| Operating systems | M41–M47 | 71 |
| Low-level computer architecture | M33–M40 | 75 |

Two things were deepened rather than merely covered:

- **Automata and language theory** normally stops at the pumping lemma. Here it continues into
  computability, type systems and semantics (M26, M27), because those are the parts a senior
  engineer actually meets — in type checkers, in static analysis, and in every argument about what a
  language can guarantee.
- **Low-level architecture** is built rather than described: gates in M33 become an ALU, the ALU
  becomes a CPU in M34, the CPU is pipelined in M35 and made out-of-order in M36. Nothing in that
  track is a diagram of someone else's processor.

---

## 2. What was added, and why

### Compilers and runtimes (M28–M32) — *strongly recommended*
Language theory without a compiler is half the subject. This track builds one language end to end:
front end, SSA-based optimiser, bytecode VM, JIT, garbage collector, and the program-analysis and
solver machinery. It also produces the SAT/SMT solver and model checker that four other milestones
call into.

**Why a senior engineer wants it:** almost every performance surprise, every "why did the optimiser
do that", every GC pause and every static-analysis false positive comes from here.

### Networking (M48–M50) — *strongly recommended*
TCP, congestion control, QUIC, DNS, TLS and the HTTP versions, as simulators you can break. Without
this track the distributed-systems material has no substrate, and "the network is slow" stays an
unanalysable statement.

### Data systems (M51–M53) — *strongly recommended*
Storage engines, query processing and transactions. This is where the data-structures track cashes
out (B+trees and LSM trees over a real page cache), and it is the single largest source of
production incidents that engineers cannot diagnose.

### Distributed systems (M54–M57) — *strongly recommended*
Time, consistency, replication, consensus, partitioning, CRDTs, streaming and resilience. Every
service a senior engineer builds today is distributed; the theory here is what turns folklore
("just use a lock") into reasoning.

### Engineering practice (M58–M62) — *recommended*
Performance engineering with queueing theory, security engineering, architecture and API design,
testing/debugging/observability, and the systems-data substrate (Unicode, time, serialisation, IDs).
These are the skills that most separate senior from mid-level engineers, and they are the ones with
the least good interactive material anywhere.

### Practice and mastery (M63–M64) — *recommended*
Twelve build-your-own-X capstones and the challenge/spaced-repetition layer. Without this the
platform is a very good reference; with it, it is a training system.

---

## 3. Topics inside the named areas that are easy to omit

These are all in the plan, and all of them are routinely missing from curricula at this level:

- **Amortised and probabilistic analysis done properly** (M01), including adversary arguments and
  lower bounds — the material that tells you when to *stop* optimising.
- **Cache-conscious data structures** (M02, M21, M37): Eytzinger layouts, blocking, false sharing.
  The same algorithm, relaid out, is routinely 2–3× faster.
- **Probabilistic and streaming sketches** (M07) — Bloom, HyperLogLog, count-min, t-digest.
  Ubiquitous in production, rarely taught.
- **Succinct and persistent structures** (M09) — the basis of immutable collections and of every
  index that fits in RAM.
- **String algorithms and text indexes** (M06, M15) through to suffix automata, FM-indexes and diff.
- **Computational geometry with robustness** (M16) — the predicates, not just the algorithms.
- **Floating point and numerics** (M17, M18), including autodiff and the stability material.
- **Compression, coding and information theory** (M22) and **applied cryptography** (M23).
- **Memory consistency and coherence** (M38) — the hardware model that every concurrency bug
  ultimately references.
- **Linking, loading and the ABI** (M39) — where a large share of real build failures live.
- **GPU and accelerator architecture** (M40), with real WebGPU kernels.
- **Crash consistency** (M44) and **I/O models** (M45), tested by actually crashing the simulator.
- **Virtualisation and containers** (M46) as kernel mechanisms rather than as products.

---

## 4. Candidates considered and left out (with reasons)

Each of these is a plausible future track. They are listed so the decision is recorded rather than
forgotten.

| Candidate | Why not now |
|---|---|
| **Machine learning and deep learning** | Already covered thoroughly by the reference project (`learning-ml`, 71 topics). Duplicating it here would be waste. A short **ML systems engineering** bridge (serving, batching, quantisation, vector search, GPU utilisation, data pipelines) would *not* be duplication and is the strongest candidate for a 66th milestone. |
| **Graphics and game engines** | Partially covered (M16 geometry, M40 GPU, the M63.10 renderer capstone). A full track (shading, animation, physics engines, scene graphs, ECS) is a different subject with its own depth. |
| **Embedded and real-time systems** | Real-time scheduling is in M41 and digital logic in M33, but interrupt-driven firmware, RTOS design, power management and hardware bring-up would need their own track and are outside "software engineering skills for senior developers" as most readers will use it. |
| **DevOps and infrastructure** | Kubernetes, IaC, CI/CD platforms, service meshes. Deliberately excluded because it is tool-specific and dates quickly; the durable parts (containers, isolation, deployment strategy, observability) are in M46, M60 and M61. |
| **Information retrieval and recommendation** | Inverted indexes, BM25 and vector search are in M06, M08 and M51. Full IR (learning to rank, evaluation methodology) overlaps the ML project. |
| **Blockchain and distributed ledgers** | Byzantine consensus is in M55 and Merkle trees in M23. A full track would be mostly economics and protocol trivia at the expense of transferable skill. |
| **Quantum computing** | One section in M26 covers the model, Grover, Shor and the post-quantum consequence. A full track is not yet load-bearing for a working engineer. |
| **Formal methods in depth** | M27 and M32 cover Hoare logic, abstract interpretation, SAT/SMT, model checking and TLA-style specification. A dedicated track (Coq, Lean, refinement proofs) is a specialist path. |
| **Compilers for accelerators / MLIR** | Would extend M29–M30 substantially; a good future addition once the base compiler track exists. |
| **Human factors: technical writing, code review, mentoring, estimation** | Genuinely senior skills, but they cannot be taught with runnable JavaScript examples, which is this platform's whole premise. Better served by prose elsewhere; M60's ADR work and M61's post-incident material cover the parts that produce artefacts. |
| **Accessibility and i18n as a track** | Unicode, collation and time are in M62; accessibility is applied as a *constraint on the platform itself* (M00's WCAG requirement) rather than taught as a topic. |
| **Energy and sustainability** | Power is covered where it drives design decisions (M33's power wall, M36's speculation cost, M40's efficiency). A full track would be mostly measurement methodology that M58 already teaches. |

---

## 5. If the plan is too large

65 milestones and ~634 sections is a multi-year build. Three honest ways to cut it:

**Cut by track.** Tracks 0–5 (M00–M47) are the brief as stated, plus compilers. That is 48
milestones and still the most complete interactive treatment of the material that exists. Tracks
6–10 can be added later without rework, because nothing in tracks 0–5 depends on them.

**Cut by depth.** Every milestone's sections are ordered from foundational to specialised. Building
the first 60% of each milestone's sections yields a complete curriculum at shallower depth, and the
remaining sections can be added per milestone as demand appears. The section format makes this
clean: sections are independent within a milestone.

**Cut by section count per milestone.** Set a hard cap (say six sections) and merge the rest. This
loses the most and is the least reversible; prefer one of the first two.

The recommended first release is **Phase 1 of the build order in the roadmap** (M00–M05 plus M10):
the engine, the analysis vocabulary, the core data structures and sorting. That is already a strong
standalone product, and everything after it is additive.
