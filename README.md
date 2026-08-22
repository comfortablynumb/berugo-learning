# Berugo Learning

An interactive, browser-only platform where senior engineers learn and **practise** computer science
and systems engineering — algorithms, data structures, automata and language theory, compilers,
computer architecture, operating systems, networking, data systems, distributed systems and
engineering craft — with a runnable JavaScript demo, an editable code lab and graded exercises in
every section.

**Not a tutorial site.** Every claim it makes is executable: if a section states a cost, a bound or
a failure mode, the demo measures or exhibits it. Where a real system cannot be reproduced
faithfully in a browser, the section models it, says so plainly, and states what the model omits.

---

## Status

**M00–M14 shipped (135 sections). Building the curriculum, milestone by milestone.**

- ✅ Curriculum designed: 65 milestones, 634 sections, 11 tracks — one file per milestone in
  [`doc/milestones/`](doc/milestones/)
- ✅ Architecture and conventions fixed — [`doc/architecture.md`](doc/architecture.md)
- ✅ Build order and dependency graph — [`doc/ROADMAP.md`](doc/ROADMAP.md)
- ✅ Scope decisions recorded — [`doc/topic-suggestions.md`](doc/topic-suggestions.md)
- ✅ **M00 — platform foundation**: shell, curriculum-driven navigation, worker sandbox, graded
  code labs, content registries, D3/mermaid pipelines, progress, and three automated checks.
  4 sections live.
- ✅ **M01 — complexity, analysis and benchmarking**: witness checking, recursion trees and the
  master theorem, the three amortised arguments, indicator-variable analysis against simulation,
  decision-tree and adversary lower bounds, measured crossovers, peak-memory shapes, the doubling
  experiment, and a benchmark harness whose mistakes are switchable. 9 sections live.
- ✅ **M02 — linear structures and memory layout**: alignment and stride, AoS vs SoA, growth
  policies, pointer chasing against a simulated cache, the call stack as a memory budget, ring
  buffers and full-queue policy, batch-size trade-offs, bump/free-list/first-fit allocators and
  fragmentation, gap buffers vs piece tables vs ropes, and cache-conscious search layouts.
  9 sections live.
- ✅ **M03 — hashing and hash tables**: avalanche as a statistical test rather than a band, the
  hash-flooding attack priced against treeification and a keyed hash, chaining under the Poisson
  model, the tombstone trap and backward-shift deletion, Robin Hood against hopscotch and cuckoo,
  Swiss-table group probing, the rehash spike and its incremental fix, FKS and CHD on a static key
  set, and the insertion-ordered map behind `Map`. 9 sections live.
- ✅ **Every section carries two worked examples**: one that derives the result and one that
  inverts it — the load factor where the cache-conscious layout loses, the workload where the better
  deletion strategy ranks last, the range where a doubling table cannot tell two curves apart. Every
  figure in them is recomputed by a test.
- ✅ **M04 — search trees and disjoint sets**: rotations and the three delete cases, AVL against its
  Fibonacci bound, red-black as a 2-3-4 tree, treaps whose shape ignores insertion order, splaying
  and the skew where it starts paying, scapegoat rebuilds under the α dial, B+ trees sized from the
  page, the augmentation rule, skip lists and what p really trades, and union-find with the
  rollback its compression makes impossible. 10 sections live.
- ✅ **M05 — heaps and priority queues**: the array heap and why Floyd's build is linear, arity as a
  cache decision, heapsort's guarantee against its cache behaviour and the top-k it wins, leftist,
  skew and binomial melds, Fibonacci heaps read as an existence result, pairing heaps that beat
  them on a real machine, the position map that makes decrease-key addressable, and timing wheels
  against a heap with an M/M/1 simulator to check itself. 8 sections live.
- ✅ **M06 — tries, suffix structures and text indexes**: the prefix query a hash table cannot
  answer, path compression measured against the keys that make it pay, ternary trees and DAWG
  minimisation, Ukkonen phase by phase, suffix arrays with three constructions cross-checked,
  the suffix-automaton clone case beside the factor oracle that skips it, the BWT inverted without
  its matrix, posting-list intersection at every skew, and three fuzzy back-ends ranked by recall
  rather than latency. 9 sections live.
- ✅ **M07 — probabilistic and streaming sketches**: Bloom sizing and the error that keeps climbing
  past the n you sized for with no signal, counting/blocked/scalable variants each buying one
  property in a different currency, cuckoo and quotient filters with their load ceiling and the
  delete that silently corrupts, HyperLogLog's exact merge against the shard sum that over-counts
  by 70%, count-min's one-sided error beside count-sketch's unbiased one, four quantile sketches
  scored on value *and* rank, MinHash banding as an explicit precision/recall dial, DGIM and
  space-saving against an exact reference, and a chooser that measures its candidates rather than
  looking them up — with two working attacks on an unkeyed sketch. 9 sections live.
- ✅ **Three tabs per section, Description first**: every one of the 667 concepts across the built
  sections carries a full explanation — the mechanism, why it is built that way, and what breaks
  when it is ignored — and the coverage test rejects a concept that carries only a one-line gloss.
  Examples holds the demo, its charts and the code lab; References holds the reference block.
- ✅ **M08 — spatial and multidimensional indexes**: a uniform grid whose predicted cost is compared
  with its measured one on every query, the quadtree depth cap as a correctness requirement rather
  than a knob, a k-d tree with the backtrack deleted so the 60% wrong-answer rate is visible, four
  R-tree splits ordered by overlap rather than height, the surface-area heuristic evaluated as a
  cost model and then checked against the rays, Morton against Hilbert under two metrics that
  disagree, six one-dimensional range structures with the constant O(log n) hides, HNSW and product
  quantisation scored on recall rather than latency, and sweep and prune beside the tunnelling
  failure no broad phase can fix. 9 sections live.
- ✅ **M09 — persistent, immutable and succinct structures**: path copying, fat nodes and node
  copying priced on both axes so the cheapest write turns out to be the most expensive read, an
  amortised bound broken on purpose by reusing one version a thousand times and repaired by a
  memoised suspension, persistent segment trees whose 11 nodes per update are exactly the bound,
  bit-partitioned tries where the depth claim and the sparse-node claim are shown to be separate,
  one finger tree answering four unrelated queries by changing only the monoid, a zipper whose
  saving is the edit count rather than the depth, a two-level rank/select index that reports its
  own 7.9% overhead and the density at which the obvious array beats it, LOUDS at 2.0002 bits a
  node with the 177× headline corrected to 5.8× once the payload is added, and Roaring shown
  losing to WAH on the one input it is usually assumed to win. 9 sections live.
- ✅ **M10 — sorting, selection and searching**: four elementary sorts whose ranking inverts between
  the comparison column and the move column, four merge schedules doing identical merges and differing
  by a factor of two in movement, three partition loops on 2 000 identical values costing 2 004 997,
  31 723 and 2 012, the anti-quicksort input that drives median-of-three above n²/4 while returning
  perfectly sorted output, Timsort's merge-stack invariant broken by the de Gouw run lengths with both
  versions sorting correctly, radix sort made silently wrong by one loop direction and the key range
  that decides whether anyone notices, selection reported as the mean of seven pivot seeds because one
  run is one sample, seven binary-search mutations against thirteen probe cases where one defect is
  caught by a single case and another by no output check at all, binary search over an answer axis
  nobody stored, replacement selection removing a whole merge pass, sorting networks proved by
  exhaustion over every zero-one input, and a chooser that takes the workload as its input. 10
  sections live.

- ✅ **M11 — algorithm design paradigms**: n-queens with two prunings whose surviving fractions
  nearly multiply — 1.88% and 50.00% leaving 0.9389% where the product predicts 0.9384%, and the
  section says why the difference is there — Karatsuba measured at a flat 1.70× the n^1.585 model and
  *losing* at four digits, Strassen trading 12.5% of the multiplications for a relative error that
  grows with the side, three greedy criteria beaten by a search that reports how many instances it
  needed (5, 554 and 94 996) beside one that survives 200 000, matroids where the same greedy loop is
  exact and a matching system where it is not, a Sudoku matrix in which MRV wins on four puzzles and
  loses on the fifth, an inadmissible bound that is cheaper, silent and wrong (640 against 658),
  monotonic sweeps at two deque operations per element against a 24.8× rescan, meet in the middle
  turning 2^40 into 2^21, and Mo's algorithm whose tuned block size minimises the model while a
  larger one minimises the measurement. 9 sections live.

- ✅ **M12 — dynamic programming**: three evaluations of one recurrence measured through a single
  instrument (242 785 naive calls against 26 memoised states at n = 25), a tabulation run in the wrong
  order returning 0 from 48 cells read before they were written, patience sorting's pile tops shown to
  be increasing, exactly the right length and *not a subsequence*, coin change answering two different
  questions one loop-swap apart (4 against 9), a knapsack table whose capacity gains a digit and grows
  tenfold while the input grows 3.3 bits, Hirschberg recovering the alignment at 16 peak cells against
  56, Knuth's optimisation taking 156 split tests to 72 — and refusing when the quadrangle inequality
  fails, which it does by 1.11 × 10⁻¹⁶ of pure floating-point noise unless the check carries a
  tolerance, rerooting answering all 2 000 roots in 1 999 combines while the prefix/suffix trick is
  measured *losing* on a path and winning by 333× on a star, Held-Karp replacing 39 916 800 tours with
  49 152 cells against a 6.7 GB wall at n = 25, digit DP counting to 10¹⁸ in 190 states, four DP
  optimisations each refusing when its precondition fails, alpha-beta spanning 7 275 to 42 094 nodes
  for the same value while *reversing* the move list changes nothing at all, and a board game that is
  cyclic before any snake is placed. 11 sections live.

- ✅ **M13 — graph algorithms I**: three representations of one graph costing 25.3 KB, 38.8 KB and
  1.2 MB with the crossover measured at exactly half density, BFS and DFS doing identical work and
  differing 20 against 400 in peak memory, a build whose 4.72× speedup ceiling is reached at eight
  workers and never moves again, one extra import turning 40 ordered packages into 37 and a named
  cycle, Tarjan and Kosaraju agreeing on a partition that condenses 74 edges into 14, one redundant
  cable taking a barbell from one bridge to none while leaving both cut vertices exactly where they
  were, a four-vertex graph on which Dijkstra is confidently wrong one hop downstream of the negative
  edge, a Floyd-Warshall loop order that does the same 64 000 relaxations and is wrong on 554 of
  1 600 cells, an admissible and consistent Manhattan estimate that prunes nothing at all against ALT
  landmarks at 16.33×, a witness search that skips two shortcuts and answers 42 of 1 260 pairs
  incorrectly — twenty of them claiming no route exists — three spanning-tree algorithms agreeing on
  270 and disagreeing on which 59 edges make it, the minimax path the MST answers for free on 136 of
  198 pairs where the cheapest route does not, and binary lifting measured *losing* to the naive climb
  on a 200-node tree of depth 13 and winning by 19× on a path. 10 sections live.

- ✅ **M14 — graph algorithms II**: a maximum flow of 22 confirmed by six algorithms whose arc visits
  spread 3.4×, path filling without a residual arc returning 1 999 where the answer is 2 000 and
  falling short on 2 of 20 networks nobody arranged, a segmentation whose cut capacity rises from 92
  to 242 across the very sweep that takes its misclassification from 15.6% to zero, five project
  instances confirmed against all 256 subsets, push-relabel doing 369 relabels untuned against 50 —
  and 44 with *one* of its two heuristics, which beats the pair — a min-cost curve of 1, 2, 4, 9, 18,
  28 whose marginals never fall, Hopcroft-Karp measured *losing* to Kuhn below 32 vertices a side and
  saving 2.74× at 256, a stable matching whose proposing side moves the other side's aggregate rank
  from 10 to 20 with nobody worse off, a six-vertex graph on which bipartite-style augmentation
  returns 2 where the answer is 3 — and returns 3 on the same eight edges in a different order — a
  2-SAT relaxation of three-literal clauses that is wrongly negative on 46 of 100 instances and
  wrongly positive on none, three greedy colourings of one graph at 5, 3 and 4 against an exhaustive
  3, a force-directed layout finding a planar embedding of a grid while its energy *rises* on 34% of
  the iterations, Euler's bound catching K5 and missing K3,3 entirely, and a PageRank vector that
  leaks 57% of its probability while inverting nothing at all across 4 589 link graphs. 10 sections
  live.

`npm test` is green — wiring audit, 2 550 unit tests, and a **render audit** that boots the whole
app headlessly and activates all 135 sections, failing on anything that throws while rendering, any
table left with an empty body, and any metric tile still showing a placeholder without a note
explaining it. `npm run lint:size` reports no offenders.

### The shell

- **The whole syllabus in the nav.** The sidebar lists all eleven tracks — *How to use this site*,
  Algorithms, Data structures, Computer architecture, Operating systems, Automata/languages/compilers,
  Networking, Data systems, Distributed systems, Engineering practice, Practice and mastery — and
  opens to milestones, then sections. Tracks that are planned and not built are listed with their
  milestones and section counts, marked as planned, so the map shows what the platform teaches
  rather than only what happens to be finished. One track and one milestone stay open at a time, so
  the nav is the same height at 135 sections and at 634.
- **Search across everything.** The header search indexes concepts, worked examples, reference
  entries and exercises as well as section titles, so "tombstone", "Little's law" or "round half to
  even" lands on the section that explains it. Ctrl/Cmd+K focuses it; arrows and Enter drive it.
- **Text size and theme** live in the header. The size is a multiplier on the root font, so every
  rem in the stylesheet follows it, and both preferences persist.
- **Installable and offline.** A manifest, icons and a network-first service worker make it an
  installable app that keeps working with no network. The Install button appears only when the
  browser says it can.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| UI | jQuery + Tailwind CSS | No framework; every section reads as plain DOM code |
| Structural diagrams | mermaid.js | State machines, pipelines, protocols, memory layouts |
| Charts and data-driven visuals | D3 v7 via `viz/chart-base.js` | Scales, axes, transitions and the layout algorithms (force, hierarchy, quadtree, contour); Canvas past a few thousand elements |
| Code execution | Web Worker sandbox with hard timeouts | Learner code never touches the page |
| Storage | `localStorage` behind an adapter interface | Theme, progress, lab state — all local, all exportable |
| Build | `tailwindcss` CLI only | One command; no bundler, no transpiler |

All dependencies are vendored into `lib/`, and mermaid and D3 load on first use rather than sitting
in the shell. The site works offline — but it must be **served**, not opened as a file, because Web
Workers do not start from a `file://` origin.

---

## Quick start

> Available from M00 onwards.

```bash
npm install          # devDependencies only: tailwindcss, serve
npm run build:css    # compile lib/tailwind.css
npm start            # serve on http://localhost:3002
```

Then open `http://localhost:3002`. Other commands:

```bash
npm test             # wiring audit + unit tests — must be green before any commit
npm run test:wiring  # static audit of index.html and every module
npm run test:unit    # node --test over the DOM-free logic modules
npm run lint:size    # files over 1000 lines, functions over 50 lines
```

---

## What a section looks like

Every section is the same three tabs, and **Description** is the one that opens:

| Tab | What is in it |
|---|---|
| **Description** | Orientation — what the thing is, what problem it solves, and the misconception experienced engineers usually carry about it — then **every concept explained in full**: a plain statement, the formal one, a paragraph on the mechanism and on what breaks without it, and a concrete instance. Then the structural diagram and the senior insight. |
| **Examples** | The interactive demo with its charts and live metrics, the worked examples that show the arithmetic with real numbers, and the editable code lab with its graded exercises. |
| **References** | Formulation, invariants, complexity, failure modes, real-world uses, sources. |

The concept explanations are the substance of the Description tab: 523 of them across the built
sections, averaging about 530 characters each, and the coverage test rejects a concept that carries
only a one-line gloss.

For example, section **3.4 Open addressing** (milestone M03) opens on Description with why open
addressing beats chaining on cache locality and eight concepts explained — including why the choice
of probe sequence decides whether you can delete without tombstones at all. Examples gives you a
slot array where you insert keys and watch the probe sequence walk, with a live plot of the expected
probe count `1/(1-α)` against the measured one, and a code lab that has you implement backward-shift
deletion, whose tests assert that lookups do not degrade after 10⁵ mixed operations — which the
tombstone version fails. References states the complexity table, the load-factor limits and the
tombstone failure mode with its production symptoms.

---

## The runnable-code engine

The differentiator: everything is runnable, and you can edit it.

```js
// What a graded exercise looks like as data
{
  id: 'open-addressing-backward-shift',
  prompt: 'Implement deletion by backward shift, not by tombstone.',
  starter: 'export function remove(table, key) {\n  // ...\n}',
  tests: [
    { name: 'removes the key',        assert: (fn) => /* ... */ },
    { name: 'no lookup regression',   assert: (fn) => /* 1e5 mixed ops */ },
    { name: 'cluster invariant holds', assert: (fn) => /* ... */ }
  ]
}
```

- **Sandboxed.** Runs in a Web Worker created from a Blob URL, with a wall-clock budget (2 s by
  default) and a step budget. Overrun terminates the worker and reports `timeout`. Learner code
  cannot reach the page, storage or the network.
- **Measured honestly.** Complexity demos do not rewrite your code to count operations — they hand
  the algorithm instrumented primitives (`ops.cmp`, `ops.swap`, an instrumented array, an
  instrumented cache) and count what passes through them. Every readout names its counter. Timings
  are medians over repeated runs with the run count shown, never a single sample.
- **Deterministic.** The worker gets a seed and a seeded RNG, so two runs with the same seed produce
  the same trace. "Change one line and compare" actually works.

---

## Curriculum

Full detail in [`doc/ROADMAP.md`](doc/ROADMAP.md); one file per milestone in
[`doc/milestones/`](doc/milestones/).

| Track | Milestones | Covers |
|---|---|---|
| 0 · Platform | M00–M01 | The engine; complexity, analysis and benchmarking methodology |
| 1 · Data structures | M02–M09 | Memory layout, hashing, search trees, heaps, text indexes, sketches, spatial indexes, persistent and succinct structures |
| 2 · Algorithms | M10–M23 | Sorting, design paradigms, DP, graphs, strings, geometry, numbers and floating point, numerical methods, randomised and approximation algorithms, NP-completeness, online and external memory, compression and coding, applied cryptography |
| 3 · Languages and compilers | M24–M32 | Automata, parsing, computability, lambda calculus and types, then a full compiler: front end, SSA optimiser, VM and JIT, garbage collector, program analysis with SAT/SMT and model checking |
| 4 · Computer architecture | M33–M40 | Gates to ALU to CPU to pipeline to out-of-order; caches, coherence and consistency; linking and the ABI; GPUs and accelerators |
| 5 · Operating systems | M41–M47 | Processes and scheduling, synchronisation, virtual memory and allocators, file systems and crash consistency, I/O and event loops, virtualisation, applied concurrency |
| 6 · Networking | M48–M50 | Link/IP/routing, TCP and congestion control and QUIC, DNS/TLS/HTTP and the web stack |
| 7 · Data systems | M51–M53 | Storage engines and indexes, query processing and optimisation, transactions and recovery |
| 8 · Distributed systems | M54–M57 | Time and consistency and replication, consensus, partitioning and CRDTs, streaming and resilience |
| 9 · Engineering practice | M58–M62 | Performance engineering and queueing theory, security engineering, architecture and API design, testing and observability, systems data (Unicode, time, serialisation, IDs) |
| 10 · Practice and mastery | M63–M64 | Twelve build-your-own-X capstones; challenge arena, spaced repetition, mastery map |

Three things run through the whole curriculum rather than sitting in one track:

- **One machine, built up.** M33's gates become M34's CPU, which M35 pipelines, M36 makes
  out-of-order, M37 gives a memory hierarchy, M41 runs an OS on, and M46 virtualises.
- **One language, built up.** M28's front end feeds M29's optimiser, M30's VM and JIT, M31's
  collector and M32's analysers — and M34's CPU runs its compiled output.
- **One measurement discipline.** Every number names its counter or its run count. Every bound is
  compared against a measurement. Every claimed guarantee has a test that breaks the version without
  it.

---

## Project structure

```
berugo-learning/
├── index.html            # shell only: sidebar mount, header, one empty container per section
├── lib/                  # vendored jquery / mermaid / d3 + built tailwind.css
├── src/
│   ├── css/              # main.css @imports base, themes, layout, components, code-lab, viz, content
│   └── js/
│       ├── core/         # curriculum, section-registry, navigation, state, runner, progress, theme
│       ├── algorithms/   # pure implementations — no DOM, unit tested
│       ├── machines/     # simulators: CPU, cache, scheduler, VM, storage engine, TCP, Raft, ...
│       ├── viz/          # chart-base + D3/Canvas renderers, one concern per file
│       ├── sections/     # <id>-template.js (markup) + <id>-section.js (controller)
│       ├── content/      # concepts-*.js, examples-*.js, reference-*.js, exercises-*.js
│       ├── components/   # section-shell (the three-tab frame), tab-controller, code-lab
│       └── utils/        # helpers, palette, format, random, js-highlight
├── tests/                # wiring-audit.js, file-size-check.js, unit/
└── doc/                  # ROADMAP.md, architecture.md, topic-suggestions.md, milestones/
```

---

## Adding a section

1. `algorithms/<name>.js` or `machines/<name>.js` — the logic. Pure, DOM-free, unit tested.
2. `sections/<id>-template.js` — markup only, no logic. `sections/<id>-section.js` — the controller,
   which calls `SectionRegistry.register({ id, init })`.
3. Add the entry to `core/curriculum.js` in the right group. The sidebar, home map, header title and
   prev/next links all follow automatically — there is no separate navigation to update.
4. Add `concepts`, `examples`, `reference` and `exercises` entries under `src/js/content/`. The
   coverage test fails if any are missing — including a concept without its `detail` paragraph,
   which is what the Description tab is made of.
5. Add the script tags to `index.html`. The wiring audit fails on a module the shell never loads,
   and the content coverage and exercise suites discover new content files by themselves.
6. Add module property tests in `tests/unit/<topic>-modules.test.js`, and recompute every figure the
   worked examples quote in `tests/unit/worked-examples-<topic>.test.js` — a measured number that
   moves should fail the build rather than quietly make the prose wrong.
7. `npm test && npm run build:css`, then open the section in Chrome and run its exercise through the
   real worker.

Conventions that the audit and the size lint enforce: no inline scripts, no markup in `index.html`,
no colour literals (use `utils/palette.js` or the `--hue-*` variables), charts through
`viz/chart-base.js` rather than a hand-rolled margin convention, no hand-rolled tab strips,
files under 1000 lines, functions under 50 lines, at most four parameters, dependencies behind
interfaces so unit tests can pass doubles.

---

## Documentation

| Document | What it is |
|---|---|
| [`doc/ROADMAP.md`](doc/ROADMAP.md) | The 65 milestones, their dependencies, effort estimates and the recommended build order |
| [`doc/architecture.md`](doc/architecture.md) | Normative: how the platform is built — module layout, the runner protocol, diagram rules, content-as-data, testing, performance budget |
| [`doc/topic-suggestions.md`](doc/topic-suggestions.md) | What was added beyond the original brief and why, what was left out, and how to cut scope |
| [`doc/milestones/*.md`](doc/milestones/) | One per milestone: every section with what it covers, its demo, its diagram, its lab and the senior-level insight, plus modules, acceptance criteria and sources |
| [`CLAUDE.md`](CLAUDE.md) | Minimal project context for tooling and new sessions |

---

## Licence

MIT.
