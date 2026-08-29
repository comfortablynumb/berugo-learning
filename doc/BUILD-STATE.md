# Build state

Where the implementation stands, and exactly what the next session should pick up.
Update this file at the end of any session that leaves work unfinished.

**Last updated:** 2026-08-27 (M31 complete — nine sections, 307 in the tree. The tree is GREEN.)

---

## Shipped and verified

| Milestone | Sections | State |
|---|---|---|
| M00 — platform foundation | 4 | ✅ built, tested, verified in Chrome |
| M01 — complexity and analysis | 9 | ✅ built, tested, verified in Chrome |
| M02 — linear structures and memory layout | 9 | ✅ built, tested, verified in Chrome |
| M03 — hashing and hash tables | 9 | ✅ built, tested, verified in Chrome |
| M04 — search trees and disjoint sets | 10 | ✅ built, tested, verified in Chrome |
| M05 — heaps and priority queues | 8 | ✅ built, tested, verified in Chrome |
| M06 — tries, suffix structures and text indexes | 9 | ✅ built, tested, verified in Chrome |
| M07 — probabilistic and streaming sketches | 9 | ✅ built, tested, verified in Chrome |
| M08 — spatial and multidimensional indexes | 9 | ✅ built, tested, verified in Chrome |
| M09 — persistent, immutable and succinct structures | 9 | ✅ built, tested, verified in Chrome |
| M10 — sorting, selection and searching | 10 | ✅ built, tested, verified in Chrome |
| M11 — algorithm design paradigms | 9 | ✅ built, tested, render-audited |
| M12 — dynamic programming | 11 | ✅ built, tested, render-audited |
| M13 — graph algorithms I | 10 | ✅ built, tested, render-audited |
| M14 — graph algorithms II | 10 | ✅ built, tested, render-audited |
| M15 — string algorithms and pattern matching | 11 | ✅ built, tested, render-audited |
| M16 — computational geometry | 10 | ✅ built, tested, verified in Chrome |
| M17 — numbers, bits and floating point | 10 | ✅ built, tested, render-audited |
| M18 — numerical methods, transforms and optimisation | 10 | ✅ built, tested, render-audited |
| M19 — randomised and approximation algorithms | 9 | ✅ built, tested, render-audited |
| M20 — NP-completeness, reductions and metaheuristics | 9 | ✅ built, tested, render-audited |
| M21 — online, external-memory and cache-oblivious algorithms | 9 | ✅ built, tested, render-audited |
| M22 — compression, information theory and error correction | 11 | ✅ built, tested, render-audited |
| M23 — applied cryptography and constant-time programming | 11 | ✅ built, tested, render-audited |
| M24 — regular languages and finite automata | 11 | ✅ built, tested, render-audited |
| M25 — context-free languages and parsing | 12 | ✅ built, tested, render-audited |
| M26 — computability and complexity theory | 10 | ✅ built, tested, render-audited |
| M27 — lambda calculus, type systems and semantics | 11 | ✅ built, tested, render-audited |
| M28 — compiler front end: build a language | 9 | ✅ built, tested, render-audited |
| M29 — IR, SSA and optimisation | 10 | ✅ built, tested, render-audited |
| M30 — code generation, bytecode VMs and JIT | 10 | ✅ built, tested, render-audited |
| M31 — garbage collection and runtime memory | 9 | ✅ built, tested, verified in Chrome |

**The tree is GREEN.** `npm test` reports 5 323 unit tests with 0 failures (6 skipped — the
wall-clock-budget starters the inline sandbox cannot fail); the wiring audit passes at 307 sections
and 1 444 modules, the render audit activates all 307 with no exception and no empty table,
`npm run lint:size` passes at 1 587 files, and `npm run build:css` is up to date.

All nine M07 sections were opened in Chrome on `npm start`: the three tabs render, every demo
figure matches the prose *exactly* (see "aligning the demo with the prose" below), the references
tab carries a full entry, and all nine graded exercises were run through the **real Worker
sandbox** — every solution passes (4/4 ×7, 5/5 ×1, 4/4) and every starter fails. Four bugs were
found *only* by the browser pass or by the new template-id test; see the M07 notes.

### M02 notes worth keeping

- `machines/cache-sim.js` was added during M02 (fully associative LRU over 64-byte lines).
  It exists because *distinct cache lines* is the wrong measure for a single pass — a full
  traversal touches every line once whatever the layout — so `linear-structures.traverse()`,
  `createRecordArray.sumField()` and `algorithms/cache-layouts.js` all report **misses** now.
- `cache-layouts.js` was reworked: `blockedSearch` binary-searches the separator array (it used
  to scan linearly), and `compare()` runs each layout's whole query stream through one cache so
  residency between queries is what gets measured. Measured at n=65 536 / 32 KB cache:
  sorted 4.33 misses/query, eytzinger 3.46, blocked 1.57.
- `text-buffers.js` ropes now rebalance (`rebalanceIfNeeded`), because repeated appends grew a
  right spine of height 395 for 4 000 characters.
- `call-stack.js` `recursiveInOrder` checks the depth budget *before* incrementing, so
  `peakDepth` never exceeds `maxDepth`.

---

## Content depth pass (after M03)

Every teaching section was brought to the same floor, and the floor is now enforced by
`tests/unit/content-coverage.test.js`: **>= 6 concepts, 2 worked examples, >= 2 invariants,
>= 3 failure modes, >= 3 sources, 1 graded exercise**. In practice each section carries 8-9
concepts and exactly two worked examples.

The second worked example is deliberately the case that *inverts* the first:

| Section | First example derives | Second example inverts it |
|---|---|---|
| code-engine | a runtime prediction | how to size a step budget that separates two algorithms |
| js-systems | decoding 1.5 by hand | why 0.1 + 0.2 lands above 0.3 (an exact tie, rounded to even) |
| asymptotic-notation | a witness pair | the case a bound is about, and the sentence that is false |
| recurrences | merge sort three ways | a split the master theorem cannot touch |
| amortised-analysis | the doubling argument | the shrink threshold that destroys it |
| average-case | an exact expectation | three tail bounds, two of them useless |
| lower-bounds | 5 comparisons for 4 elements | min and max together in ⌈3n/2⌉ − 2 |
| constants-and-cache | a measured crossover | two loops, same work, 16× the traffic |
| space-complexity | pipeline peaks | the recursion stack an "in-place" sort still needs |
| empirical-complexity | reading a ratio table | two curves the table cannot separate |
| benchmarking | costing four protocol mistakes | how many runs a 5% claim needs |
| memory-layout | stride and wasted bandwidth | AoS and SoA each winning one access pattern |
| dynamic-arrays | growth factors | the shift cost of a middle insert |
| linked-lists | list against array on a scan | the workload where the list wins |
| stacks-and-frames | the frame budget | three traversals, and what each keeps live |
| queues-and-rings | sizing from a burst | Little's law and the 1/(1 − ρ) wall |
| batching-pipelines | choosing a batch size | the latency that batch buys with |
| pools-and-arenas | fragmentation | an arena that cannot fragment |
| text-buffers | one minute of typing | moving the edits, inverting the ranking |
| cache-layouts | misses per query | the size below which the clever layout loses |
| hash-functions | how many avalanche samples | which end of the hash is broken |
| universal-hashing | pricing a flooding attack | testing the multiplier, not the keys |
| separate-chaining | the Poisson prediction | what treeify costs when nothing goes wrong |
| open-addressing | the tombstone trap | three probe sequences on the same keys |
| robin-hood | mean against tail | what Robin Hood costs on the insert side |
| swiss-tables | what a group probe saves | deletion, and what the control byte remembers |
| rehashing | the spike and the incremental fix | deleting the rehash by reserving |
| perfect-hashing | what a static key set is worth | the CHD λ dial: build time against bits |
| hash-in-practice | the hole problem | the workload picking the scheme |

Two arithmetic slips in the pre-existing M01 examples were found by writing
`tests/unit/worked-examples-analysis.test.js` (which did not exist): the converse witness constant
at n = 10⁶ (50 173 → 50 172) and the 2n ln n ratio at n = 100 (1.086 → 1.422). Two more figures were
made precise rather than rounded: "within 2%" → 2.1%, "~8% slower" → 7.5%.

Every figure in every second example is recomputed in
`worked-examples.test.js`, `worked-examples-analysis.test.js`, `worked-examples-linear.test.js` and
`worked-examples-hashing.test.js`, and each assertion also checks the prose still quotes it.

---

## The three-tab section frame (after the content depth pass)

Every section is now **Description / Examples / References**, with Description opening by default.
The change is entirely in `components/section-shell.js`, so all 29 teaching sections got it at once
and no section controller was touched.

| Tab | Blocks |
|---|---|
| Description | orientation, concepts (with their explanations), diagram, senior insight |
| Examples | interactive demo and charts, worked examples, code lab |
| References | the reference block |

Prev/next navigation stays **outside** the tabs, so it is reachable from all three.

### What the frame is made of

- `components/tab-controller.js` is still the only tab implementation, and it was unused until now.
  Two things had to change for a per-section strip: `panelClass` must carry the section id
  (it hides panels by CSS selector, and every section is in the DOM at once, so one shared class
  would let one section's tab hide another's panel), and `init()` returns `null` without jQuery so
  the node tests can exercise `markup()` without a DOM.
- **A chart drawn inside a hidden panel measures no width** and falls back to the 220px floor.
  `ChartBase` now keeps a set of live charts and exposes `refreshVisible()`, which the shell calls
  on every tab change; `destroy()` deregisters. Verified in Chrome: after switching to Examples the
  dynamic-arrays chart repaints at a 1030px viewBox, and a sweep of all 29 sections found no chart
  left at the fallback width.
- **The sticky strip sits at `top: var(--header-height)`, not 0.** The app header is sticky in the
  same scroll context with a higher z-index, so a strip stuck at 0 slides underneath it and
  vanishes exactly when the learner scrolls far enough to want it.
- A section with only one non-empty part renders **no strip at all**, which is what keeps the home
  and settings pages plain.

### Concept explanations

All **235 concepts** across the 29 teaching sections now carry a `detail` paragraph (mean 576
characters, shortest 502) covering the mechanism, why it is built that way, and what breaks when it
is ignored. `plain` remains the one-line gloss. `content-coverage.test.js` enforces a 240-character
floor, rejects a `detail` that merely repeats `plain`, and rejects one that does not end a sentence.

The concepts files were split per half-milestone to stay under 1 000 lines - `concepts-analysis.js`
+ `concepts-analysis-practice.js`, `concepts-linear.js` + `concepts-linear-buffers.js`,
`concepts-hashing.js` + `concepts-hashing-schemes.js` - matching the existing
`exercises-hashing-schemes.js` split. All six are wired into `index.html`.

The rewrite preserved every existing `term`/`plain`/`formal`/`example` string byte-for-byte; that
was checked by loading the pre-rewrite files and the current ones into two registries and comparing
field by field, rather than by reading the diff.

Two places where the explanation had to reconcile prose that was already there:

- `separate-chaining` / **Longest chain** quotes `ln m / ln ln m` and "about 6 for a thousand
  buckets", and those disagree (the formula gives 3.58). The detail says the asymptotic form drops
  constants that matter at real sizes and that the measured maximum at m = 1 000 is about 6.
- `linked-lists` / **Misses, not lines** restates why the M02 cache work counts misses against a
  bounded LRU rather than distinct lines - the same point the M02 notes below record.

`search-index.js` indexes the new `detail` text, so the search corpus grew with the content.

---

## Application chrome

- **The sidebar lists all eleven tracks**, built or not. `views/sidebar-view.js` renders two
  collapse levels (track -> milestone -> sections) as an accordion - one track and one milestone
  open at a time, because additive expansion turns back into a flat list after twenty sections -
  and opens the current section's pair *on arrival only*, since re-opening on every refresh would
  make the current track impossible to collapse.
- **Planned tracks live in `core/curriculum.js`** as `planned: [{ id, title, sections }]` entries
  with no section objects. Track 0 is now *How to use this site* (M00 only); M01 moved to the
  Algorithms track, where the analysis milestone belongs, and `doc/ROADMAP.md` was updated to
  match. Built 31 + planned 603 = the 634 the roadmap promises, and the home map now shows both.
- **Global search.** `core/search-index.js` builds one corpus from the curriculum plus every
  content registry (concepts, worked examples, reference entries, exercises); `views/search-view.js`
  renders the header dropdown with keyboard control. The old sidebar section-search is gone: it
  could only find a section you already knew the name of.
- **Text scale.** `core/text-scale.js` sets one `--text-scale` multiplier on `html { font-size }`,
  which every rem in the stylesheet follows. Charts are drawn in pixels and deliberately do not
  scale.
- **Installable.** `manifest.webmanifest`, `assets/icon-{192,512}.png` (generated PNGs, committed,
  no build step) and `sw.js`. The service worker is **network-first with a cache fallback**, not
  cache-first: this project is developed by editing the files it would cache. `core/installer.js`
  registers it and shows the Install button only when the browser fires `beforeinstallprompt`.

---

## M03 notes worth keeping

Spec: `doc/milestones/M03-hashing.md`. Nine sections under the `data-structures` track.

### Modules

`algorithms/`: `hash-functions.js`, `hash-table-chained.js`, `hash-table-open.js`,
`hash-table-robinhood.js`, `swiss-table.js`, `hash-rehash.js`, `perfect-hash.js`,
`ordered-map.js`. `machines/hash-lab.js`. `viz/avalanche-view.js`, `viz/bucket-view.js`.

Content is split across `concepts-hashing.js`, `examples-hashing.js`, `reference-hashing.js`,
`exercises-hashing.js` (3.1–3.5) and `exercises-hashing-schemes.js` (3.6–3.9) — one file per
milestone would have passed 1 000 lines.

Tests: `tests/unit/hash-modules.test.js` (property tests) and
`tests/unit/worked-examples-hashing.test.js` (every quoted figure recomputed).

### Four bugs the M03 tests found, and how they were fixed

1. **`hash-rehash.js` lost a key mid-migration.** Both tables are linear-probed, and migrating a
   slot emptied it — cutting every probe chain that ran through it. A key already scanned past by
   the cursor but not yet moved was reachable in neither table. Slots vacated by a migration *or a
   delete* are now `DEAD`, which does not stop a probe walk, and growth is driven by occupancy
   (`used`) rather than live count. This is what the "findable at every step" criterion is for.
2. **`hash-table-chained.js` charged every comparison to both counters.** `locate()` incremented
   `lookupProbes` *and* `insertProbes` whichever operation asked, so `lookupProbes / lookups`
   reported the insert path as well and a 2 000-long chain read as 2 001 probes per lookup instead
   of 1 000.5. The counter is now passed in by the caller. Three demo figures moved, all of them
   towards theory: chaining now measures 1.50 comparisons at α = 1 against the predicted 1 + α/2,
   and the treeified flood measures 9.98 against log₂(2 000) = 10.97.
3. **`perfect-hash.js` `seededHash` could not terminate for an unfinalised base hash.** It appends
   the seed to the key, and FNV-1a's low bits are preserved under a common suffix — so two keys
   agreeing in the low bits collided modulo b² for *every* seed and the search threw. It now mixes
   the result through `murmurFinalise`, and a test builds FKS with fnv1a, djb2 and murmur3.
4. **The robin-hood section threw on the cuckoo table**, which had neither `distances()` nor
   `probeWalk()`, so all four metrics on 3.5 rendered as "—". Cuckoo now reports real distances
   (0 for the left table, 1 for the right), and `distancesFor` throws a named error instead of a
   `TypeError` if a future scheme reports neither.

Also: the universal-hashing demo searches once for 6 000 colliding keys and slices, so it was
quoting the cost of the whole search as the cost of the payload. `HashLab.collidingKeys` now
returns `examinedAt[]`, and a search that runs out of budget says so in the metric note instead of
silently handing back a smaller payload than the slider asked for.

### Design decisions that are easy to undo by accident

- **`avalanche()` verdict is a statistical test, not the 40–60% band.** A fixed band rejects a
  good mixer at small sample counts: with 256 samples a cell's standard error is 3.1 points and
  the worst of 1 024 cells strays outside the band by chance. `passes` tests
  `worstDeviation / standardError <= 4.1` (Bonferroni over 1 024 cells); `withinBand` and
  `samplesForBand()` (= 421) are reported separately.
- **A Swiss group is 16 bytes, not a cache line.** A 64-byte line holds four groups, so one fetch
  covers the metadata for 64 slots.
- **The open-addressing demo uses a *rolling* churn** (delete one live key, insert one new key)
  with growth disabled. The obvious "delete all, re-insert all" cycle shows nothing, because each
  insert reuses the tombstone the matching delete just made.
- **`blockedSearch` binary-searches its separators.** A linear scan made the "blocked" layout
  worse than the sorted array, which is the opposite of the point.

### Measured figures quoted in `examples-hashing.js`

Every one is recomputed by `tests/unit/worked-examples-hashing.test.js`, which also asserts that
the example still quotes it — so moving a number without moving the prose fails the build. Seeds
and recipes live in that test.

---

## M04 notes worth keeping

Spec: `doc/milestones/M04-search-trees.md`. Ten sections under the `data-structures` track, all
built on one shared interface so `machines/tree-lab.js` drives every family without special cases:
`insert · remove · has · keys · range · size · height · checkInvariants · stats · resetStats`.

### Modules

`algorithms/`: `bst.js` (the shared primitives and the plain BST), `avl.js`, `red-black.js`,
`treap.js`, `splay.js`, `scapegoat.js`, `btree.js`, `augmented-tree.js`, `skip-list.js`, `dsu.js`.
`machines/tree-lab.js` (workload generation and replay), `viz/tree-view.js`, `viz/forest-view.js`.

Content is split per pair of sections — `concepts-trees.js`, `-trees-balanced`, `-trees-random`,
`-trees-indexes`, `-trees-sets` — because one file per milestone passes 1 000 lines once every
concept carries its explanation.

### Five bugs and design errors the M04 tests found

1. **The treap drew priorities from a sequence at insertion time**, so the same key set inserted
   sorted and reversed produced different trees — destroying the one guarantee a treap exists for,
   while every invariant still passed. Priorities are now `hash(key, seed)`. No invariant check
   could have caught this; the "three orders, one shape" demo table did.
2. **`rangeSum` walked every node in the range**, which is correct and makes the augmentation
   decorative: 1 020 node visits for 1 001 keys. It now returns a subtree's stored sum when the
   subtree lies entirely inside the range — 51 visits for the same query.
3. **The skip-list cost formula was wrong.** It read `(1/(1−p))·log_{1/p}(n)`, which predicts 11
   comparisons at p = 0.25 against 32 measured. Pugh's bound is `L/p + 1/(1−p)`, and reading it
   properly is the section's whole point: the two factors move in opposite directions, so search
   cost is nearly flat in p and what p really trades is memory (`1/(1−p)` pointers per node).
4. **`predictedReads` assumed full pages.** A sequential B+ load leaves pages ~50% full, so
   log_B(n) is a level short on two of three geometries. `predictedReadsAtFill()` uses the measured
   occupancy and matches exactly. Both are shown in the demo, and the gap is the teaching.
5. **The AVL constant.** The bound is Knuth's `1.4404·log₂(n+2) − 0.328`; the widely copied 1.4405
   is 1/log₂φ rounded the wrong way. The test computes it rather than quoting it.

### Design decisions that are easy to undo by accident

- **`bst.js` is iterative everywhere.** A sorted build gives height n, and at the 10⁵-operation
  sequences `tree-lab` replays, a recursive height() or traversal is a stack overflow rather than a
  slow answer.
- **Red-black deletion carries the `(node, parent)` pair** instead of using a sentinel, because the
  node being fixed can be null and a null has no parent to ask.
- **`tree-lab.replay` takes `measureFrom`.** A build-then-access workload must not charge the build
  to the access phase, or the build swamps the effect: it is the difference between splay measuring
  0.94× AVL and 0.71× at the same skew.
- **The splay Zipf demo defaults to skew 1.2.** The crossover is between skew 0.8 and 1.0, and
  quoting a win without stating the skew is the classic overclaim — so the chart sweeps the range.

### Measured figures quoted in the M04 examples

`worked-examples-trees.test.js`, `-trees-balanced`, `-trees-random` and `-trees-indexes` recompute
every one and assert the prose still quotes it. The mixed AVL/red-black workloads are regenerated
in the test with the same seed and draw order, so a change to the generator fails the suite rather
than silently invalidating the prose.

## M05 notes worth keeping

Spec: `doc/milestones/M05-heaps.md`. Eight sections under the `data-structures` track, all built on
one shared interface so `machines/pq-lab.js` replays a single workload against every family:
`push · pop · peek · meld · size · checkInvariants · stats · resetStats`, plus `decreaseKey` on the
families that can address a live element.

### Modules

`algorithms/`: `binary-heap.js` (the array heap at any arity, plus `sort`, `topK` and
`buildHeapWork`), `leftist-heap.js` (leftist and the `skew: true` variant on one meld),
`binomial-heap.js`, `pairing-heap.js` (two-pass, plus a `singlePass: true` control),
`fibonacci-heap.js`, `timer-wheel.js` (hierarchical wheel plus a `heapBacked` control).
`machines/pq-lab.js` (workload generation, replay, meld runs, grid graph, Dijkstra in indexed and
lazy modes), `machines/event-sim.js` (event kernel plus an M/M/1 run), `viz/heap-view.js`.

Content is split per half-milestone — `concepts-heaps.js` / `-heaps-advanced.js` and the same for
examples, reference and exercises — for the same reason as M04: one file per milestone passes
1 000 lines once every concept carries its explanation.

### Seven bugs the M05 tests found

1. **The timer wheel's `rounds` counter was off by one revolution** when a delay is an exact
   multiple of the wheel width: the entry lands in the slot it was filed from, so the first visit
   to that slot *is* the due tick. 6 400 timers fired a revolution late. `tick()` now compares
   `entry.due > now` directly; `rounds` survives only as a reporting field.
2. **A Fibonacci `pop()` promoted children without clearing their mark**, so a root could carry a
   mark — which is what `checkInvariants` exists to catch, and did.
3. **`leftist.meld` read `other.size()` after `detach()`**, which zeroes it, so the melded count
   came out short. The incoming size is captured first.
4. **`buildHeapWork` inverted the heights**, giving the leaves the maximum height, so the sum came
   out at n log n and appeared to disprove the very argument the section makes. Height 0 is the
   leaf row and the total is ~n.
5. **`topK` under-reported its cost** by counting only the comparisons made inside the heap: the
   gate — one comparison per element against the current worst — happens outside it and is 99.8%
   of the work. `gateComparisons`, `admitted` and `totalComparisons` are now reported separately.
6. **The lazy Dijkstra cannot use an indexed heap.** Duplicate insertion pushes the same node more
   than once and the handle map rejects it. That is the trade, and the test now states it.
7. **Eleven quoted figures were wrong**, all from writing the sentence before the measurement, and
   all found by `worked-examples-heaps*.test.js` — see below.

### Design decisions that are easy to undo by accident

- **The pairing heap keeps its one-pass variant.** Comparing the pairing pass against a Fibonacci
  heap confounds it with five other differences; comparing it against itself-minus-pairing does
  not, and the 17.3% is then attributable to the merge alone.
- **The timer wheel is the only structure whose stats have no `comparisons` field**, because it
  makes none — a bucket index is arithmetic. Do not add a zero for symmetry; the absence is the
  point, and the tests assert `undefined`.
- **`event-sim` keys the queue on `at * 1e6 + sequence`**, so two events at the same instant break
  by insertion order rather than by heap internals — otherwise a simulation is not reproducible
  across queue implementations.
- **The Fibonacci sections lead with two columns, comparisons and wall clock, that disagree.**
  The heap does the fewest comparisons on the Dijkstra run and takes the longest. Dropping either
  column turns the section into an overclaim in one direction or the other.

### Measured figures quoted in the M05 examples

`worked-examples-heaps.test.js` and `-heaps-advanced.test.js` recompute every one, and their
harnesses mirror each section's demo exactly — same seed, same size, same derived seeds (the
timers demo cancels from `seed + 500` and drives the simulator from `seed + 7`, and the mergeable
demo pushes its spine heaps from `seed + 1`). Eleven figures were corrected against measurement
during the build:

| Quoted | Measured | Why it was wrong |
|---|---|---|
| descending build 199 998 / push 1 468 946 | 199 978 / 1 468 787 | written from a different seed |
| height 16 holds 2 nodes | 1 (height 15 holds 2) | off-by-one reading the table |
| leftist spine 13, skew spine 20 | 11 and 13 | the demo derives the spine seed as `seed + 1` |
| skew 1 044 536 child swaps | 1 071 593 | same |
| Fibonacci 7 029 cuts / 1 569 cascaded on Dijkstra | 2 702 / 31 | copied from the decrease-key mix |
| degree probe: 40 000 nodes, 10 000 pops, degree 15 | 20 000 / 4 000 / 13 | the demo probes smaller |
| the mergeable families are within 20% | 21% spread | rounded the wrong way |
| one-pass costs 17% more | it costs 21% more, which is a 17.3% saving | two framings of one ratio; the demo reports the saving, so the prose does too |
| heap 3 059 313 comparisons, 60 517 timers fired | 3 059 516 and 60 619 | the demo cancels by index *with replacement*, so ~39% are cancelled, not 50% |
| wheel 20.00 touches/tick, 2 × 64 at 12.23, 98 480 cascaded, 39% fewer | 22.19, 12.22, 108 932, 45% | same |
| M/M/1 within 1.5%, L = 8.871 at ρ = 0.9 | within 1%, L = 9.025 | the demo runs the simulator from `seed + 7` |

The lesson from M04 held and is worth repeating: **measure first, then write the sentence.** Every
one of these came from the other order.

## M06 notes worth keeping

Spec: `doc/milestones/M06-tries-and-text-indexes.md`. Nine sections under the `data-structures`
track. Two shared harnesses rather than one, because the milestone has two halves:
`machines/text-corpus.js` (bundled corpora and adversarial generators) and `machines/text-lab.js`
(`compareDictionaries`, `compareSubstringIndexes`, `compareFuzzy`).

### Modules

`algorithms/`: `trie.js` (three child layouts behind one interface), `radix-trie.js` (path
compression, edge splitting, ART node classes, IPv4 routing), `ternary-trie.js`, `dawg.js`
(incremental minimisation with a register), `suffix-tree.js` (Ukkonen with a phase trace),
`suffix-array.js` (naive / doubling / SA-IS plus Kasai), `suffix-automaton.js` (online, with the
clone case and a factor-oracle control), `bwt.js` (transform, LF inverse, FM-index with two rank
backends), `inverted-index.js` (three intersection strategies, gap coding, positions),
`fuzzy-search.js` (BK-tree, Levenshtein automaton, n-gram index, scored trie).
`viz/trie-view.js` (edge-labelled tree) and `viz/matrix-view.js` (HTML tables for suffix arrays,
rotation matrices and DP traces).

Content is split per third of the milestone — `-text`, `-text-suffix`, `-text-search` — for the
same file-size reason as M04 and M05.

### Six bugs and wrong claims the M06 work found

1. **`TextLab.snapshot` assumed `node.children` is a Map.** True for a radix trie and a suffix
   tree, false for all three plain-trie layouts, so the tries section threw on load and drew no
   chart. Fixed with a `childrenOf` option and `Trie.childrenOf`; the node tests never called
   `snapshot`, so **only the browser check found it** — there is now a regression test.
2. **Two metric ids collided with container ids** (`sa-rounds`, `ii-query`), so `getElementById`
   returned the metric tile and a whole table was rendered inside it. A template-wide check for
   `metric id ∩ element id` is a one-line script and worth running per section.
3. **The BWT inverse stepped LF before reading**, which drops the final character and shifts the
   rest. Read first, then step. The round-trip assertion catches it on every input.
4. **"Path compression saves most of the nodes on keys sharing a long prefix" is false** — a plain
   trie already shares prefixes. Measured: 400 keys sharing a 40-character prefix compress only
   1.10×. What compression removes is the *unshared tail*, so the demo's key sets are now words
   (2.14×), paths (9.98×) and 32-character hex keys (22.45×).
5. **The factor oracle is exact on many strings**, `banana` and `abcbc` among them, so the section
   default was changed to `abbbaab` where it demonstrably accepts `aba`, `abaa` and `abba`. That
   is itself the lesson: "I tried a few substrings and it worked" is not a test.
6. **Kasai's character comparisons were being reported as construction cost**, making SA-IS look
   like it compared characters. Split into `lcpSteps`.

### Design decisions that are easy to undo by accident

- **The naive suffix-array construction stays in the module.** It is the only cheap oracle for the
  other two, and a fast-but-subtly-wrong construction produces an array that answers most queries
  correctly. The test asserts all three agree on four corpora including a one-letter alphabet.
- **`Bwt.SENTINEL` is `String.fromCharCode(1)`, built rather than written**, so the source carries
  no control character and no escape. `MatrixView.display` renders it as `␀`, because a glyphless
  character in a table reads as a column that mysteriously sorts first.
- **The suffix-tree byte model is stated, not quoted.** The 20-bytes-per-character figure in the
  textbooks is Kurtz's engineered implementation; a direct one measures 35-48, and the section says
  so rather than repeating the constant it does not have.
- **The n-gram index is kept although it is wrong**, and its recall is a column in the table.
  Removing it would remove the section's point, which is that an approximate back-end is
  indistinguishable from an exact one until somebody measures.

### Measured figures quoted in the M06 examples

`worked-examples-text.test.js`, `-text-suffix` and `-text-search` recompute every one against the
same corpora and seeds the demos use. Landmarks: 883 words → 2 562 trie nodes / 721 DAWG states;
the three trie layouts cost 81 968, 573 888 and 64 041 bytes; DNA 2 000 costs 42.3, 34.7, 9.0 and
1.9 bytes per character across tree, automaton, array and FM-index; the intersection sweep is
90 566 / 1 749 / 245 comparisons at 10-against-100 000 and 124 751 / 182 123 / 157 906 at
50 000-against-100 000; "cat" within one edit is 7 answers with the n-gram index returning 2.

## M07 notes worth keeping

Spec: `doc/milestones/M07-probabilistic-structures.md`. Nine sections under the `data-structures`
track. Four harnesses rather than one, because the milestone covers four different questions:
`machines/stream-lab.js` (generators, exact references, `errorSeries`, the adversarial key search),
`machines/filter-lab.js` (membership), `machines/sketch-lab.js` (cardinality, frequency, quantiles,
similarity, windows) and `machines/sketch-chooser.js` (the ranking and the two attacks).

### Modules

`algorithms/`: `bloom-filter.js` (standard, counting, blocked, scalable, plus `optimalParams`),
`cuckoo-filter.js` (partial-key cuckoo hashing with a victim slot), `quotient-filter.js`
(three metadata bits, the sorted read-out and the merge), `hyperloglog.js` (sparse and dense,
linear counting, exact merge), `count-min.js` (count-min, conservative update, count-sketch,
heavy-hitter heap), `quantile-sketches.js` (exact, reservoir, weighted reservoir, t-digest, KLL,
DDSketch), `minhash-lsh.js` (shingles, signatures, banding, SimHash, random projection),
`window-counters.js` (DGIM/exponential histogram, an exact ring, space-saving over a Stream-Summary
bucket list, lossy counting, decayed counters). `viz/error-band-view.js` (`render`, `scatter`,
`curve`, `bars`).

Content is split per third of the milestone — `-sketches`, `-sketches-counting`, `-sketches-streams`.

### Six bugs and wrong claims the M07 work found

1. **The blocked Bloom filter's in-block offsets were stepped by a stride**, so every key's k
   offsets were the same pattern translated by one hash: only `blockBits` distinct patterns exist
   and the measured error was **28×** the prediction (0.281 against 0.010). Re-mixing each offset
   through the finaliser restores the model, and the residual 1.21× at 512-bit blocks is the real
   occupancy-variance penalty the section teaches.
2. **Double hashing breaks the count-min guarantee.** `h1 + i·h2` is fine for a Bloom filter, whose
   analysis needs no independence between probes, and wrong here: two keys whose h1 *and* h2 agree
   modulo w collide in every row at once. Measured on a Zipf stream at w = 2 719, d = 5, that put
   count-sketch's worst error at 6 939 against a stated bound of 2 808. Avalanching each row's
   combined value before the modulo brought it to 879.
3. **A cuckoo filter that drops the orphan of a failed eviction chain acquires a false negative**
   at the exact moment it fills — one key lost at 97.1% load. The orphan is now held in a victim
   slot that `has` and `remove` consult, and `add` reports the filter full.
4. **Count-sketch with an even depth averages the two middle rows** instead of choosing between
   them, mixing a good row with a bad one. Forcing an odd depth took the worst measured error from
   6 465 to 1 019 at the same width.
5. **`bt-scan` was both a slider and a table in `b-trees-template.js`**, so `$('#bt-scan tbody')`
   resolved to the range input and the range-scan table was never written. Five more sections had a
   metric id whose `-note` span collided with a hand-written paragraph, and `d-ary-heaps` shared
   *six* ids with `dictionary-automata` (`da-count`, `da-seed`, `da-height`, `da-chart`,
   `da-legend`, `da-table`) — every one of them broken whenever both sections were visited.
   `tests/unit/template-ids.test.js` is the permanent check.
6. **A count-min scatter is 21 619 SVG circles.** `ErrorBandView.sampleFor` now draws at most
   3 000 — the heaviest quarter of the budget plus a fixed stride through the tail — and the note
   says how many of how many were drawn.

### Aligning the demo with the prose

The browser pass found four sections whose demo defaults did not reproduce the figures their own
orientation quoted: different probe counts, a different key universe, a shorter stream. A learner
opening the section saw 1.28× where the text said 1.21×. The demos now use the worked example's
parameters, and the recomputation cost that made those parameters tempting to shrink is paid for
by `Helpers.memoise` — one-slot memoisation keyed on the controls a measurement actually depends
on. Switching the count-min estimator went from 414 ms to 7 ms; the uncached paths are 190–620 ms.

### Design decisions that are easy to undo by accident

- **Every filter's `predictedFpr` is load-aware.** A cuckoo table rounded up to a power of two is
  half empty, and the full-table formula overstates its error by exactly that factor. `spaceAtError`
  therefore reports two memory columns: as built, and at the design load the papers assume.
- **The quotient filter has no `remove`.** Deletion is an unshift of the cluster tail and a
  partially correct one corrupts run boundaries into false negatives. Shipping a filter that cannot
  delete, next to a cuckoo filter that can, is the honest pairing.
- **HLL++'s empirical bias tables are not implemented and the section says so.** Between n = 2.5m
  and 4m both the raw estimator and linear counting read 2.5–5.0% high — more than 3σ — and the
  correction panel shows that band rather than hiding it.
- **The shards in `shardQuantiles` are deliberately not identical.** Over statistically identical
  shards, averaging per-shard p99s happens to land within 0.1% of the truth and the mistake looks
  correct. One degraded shard is the only interesting case, and there the average reads 17.4% low.
- **`stream-lab.searchKeys` reports `examined` and `exhausted`.** An attack that needs four million
  candidates is a different threat from one that needs four hundred, and a search that runs out of
  budget must say so rather than return a shorter list — the same rule M03's `collidingKeys` learned.

### Measured figures quoted in the M07 examples

`worked-examples-sketches.test.js`, `-sketches-counting` and `-sketches-streams` recompute every
one *and* assert the example still quotes it, so moving a number without moving the prose fails the
build. Landmarks: 9.59 bits per key and k = 7 at 1%, measured 1.010% against a predicted 1.004% and
16.05% at twice the sized n; blocked filters at 1.00 cache lines against 6.95 for 1.21× the error;
a cuckoo filter stopping at 7 957 of 8 192 slots with 86.4% of inserts evicting nothing and a
longest chain of 408; HyperLogLog at p = 12 estimating 21 665 against 21 619 while the four shard
estimates sum to 36 702; count-min's 1 062-count bound reading as 3.8% of the heaviest key and
7 584% of the thousandth; DDSketch 0.53% out at p99.9 where a 1 000-item reservoir is 38.8% out;
128 min-hashes split 16×8 finding 27.3% of the duplicate pairs and 32×4 finding all of them at 50%
precision; DGIM at 600 bits and 26.14% against an exact 20 000; and 50 manufactured false positives
from 5 179 probes, none of which survive a different seed.

## M08 notes worth keeping

Spec: `doc/milestones/M08-spatial-indexes.md`. Nine sections under the `data-structures` track.
Every index is validated against a brute-force oracle on uniform, clustered, collinear, coincident
and lattice inputs, and the oracle disagreement count is a *reported field* rather than an
exception — a spatial index fails by returning a plausible subset, and nothing else notices.

### Modules

`algorithms/`: `spatial-hash.js` (direct-addressed grid and hashed grid on one interface),
`quadtree.js` (point, loose and octree), `kd-tree.js` (median build, three pruning bounds including
the broken one), `r-tree.js` (four splits, forced reinsertion, STR bulk load), `bvh.js` (median and
binned SAH, slab traversal, refit), `space-filling.js` (Morton, Hilbert, geohash, range
decomposition and coalescing), `range-structures.js` (prefix sums, Fenwick, segment tree, lazy,
sparse table, sqrt blocks, merge-sort tree), `ann-index.js` (brute force, VP-tree, IVF, product
quantisation, k-means), `hnsw.js`, `broad-phase.js` (sweep and prune, moving hash, swept test).
`machines/`: `spatial-lab.js` (generators, oracles, query runner, cell and dimension sweeps),
`range-lab.js`, `vector-lab.js` (recall scoring and the re-ranking wrapper).
`viz/spatial-view.js` (canvas: partitions, curves, proximity graphs).

**Three harnesses and two ANN files rather than the spec's one each.** `spatial-lab` + `range-lab` +
`vector-lab` answer three unrelated questions, and `ann-index` + `hnsw` in one file passes 1 000
lines. The size limit wins over the spec's table.

Content is split per third of the milestone — `-spatial`, `-spatial-volumes`, `-spatial-search`.

### Five bugs the M08 oracles found

1. **The k-d tree read the splitting plane off the far *child* instead of the parent.** A leaf has
   no split value, so the subtraction produced NaN, every comparison against NaN is false, and the
   backtrack pruned exactly the leaves holding the answer. It was wrong on 50–160 of 250 queries per
   configuration and looked completely normal. `boundFor` now takes the parent node, and the
   signature carries the reason.
2. **R* forced reinsertion re-entered the tree from the root mid-descent**, so a split could replace
   a node the outer recursion was still holding and everything under it was lost — 1 227 rectangles
   missing across 60 window queries, with `checkInvariants` passing. Reinsertion is now queued and
   drained after the insertion unwinds, and restricted to leaves.
3. **The direct-addressed grid clamped out-of-range cells onto the edge row**, which is a collision
   in the one mode that is supposed to have none: it reported phantom candidates the concepts say
   only the hashed mode can produce. Out-of-bounds items now live in their own list.
4. **`missed` over-counted tunnelling by an order of magnitude.** A contact that begins mid-step and
   is still a contact at the next sample is one frame of latency, not a missed contact. Counting it
   gave 1 187 "missed" at a speed that actually misses 1. The next frame's exact contact set is now
   consulted before anything is called missed.
5. **"The SAH's other half is the decision not to split"** was an overclaim, caught by the demo's own
   counter on the first page load: at leaf size 4 that branch fires **zero** times on this scene,
   because four primitives are already cheaper than any split of them. It fires 69 times at leaf
   size 1. The win at leaf size 4 comes from uneven split positions instead, and the prose, the
   concept, the reference entry and a test now say so.

### The measurement that corrects a folk claim

"Hilbert has better locality than Z-order" is **false** under the metric people picture and **true**
under the one a query planner contains. At order 6 the mean index gap between two spatially adjacent
cells is 39.05 for Hilbert and 32.50 for Morton, and the worst is 3 413 against 1 366 — Z-order wins
both. The number a query actually pays is contiguous runs per window, and a 16 × 16 window costs
15.68 Hilbert ranges against 29.49 Morton ones. `windowRanges()` exists to measure the second, and
the tests assert both directions so the prose cannot drift back to the convenient half.

### Design decisions that are easy to undo by accident

- **`kd-tree` ships the broken variant on purpose.** `pruneWith: 'descent'` is the tree with the
  backtrack deleted; it costs 4.87 distance computations against 69.28 and is wrong on 60.2% of
  queries while reporting a plausible mean distance of 60.272 against a true 42.701. The section's
  whole claim is that this is undetectable without an oracle, so the learner has to be able to
  select it and watch the counter move.
- **The k-d demo's oracle is chained, not brute force.** Verifying 500 nearest queries against
  20 000 points costs more than everything else in the section; the box-bound run is checked against
  brute force on the first 200 and, being exact, is then the oracle for the other two over all 500.
  That is what makes the demo's "301 of 500" the same number the prose quotes — the first browser
  pass showed "115 of 200" beside a prose figure of 60.2%.
- **`checkInvariants` on an R-tree takes a `minFill` flag.** STR leaves the last page of each slice
  short *by construction*; asserting Guttman's minimum against a bulk-loaded tree is checking the
  wrong structure's invariant.
- **A quantiser's recall is never reported without its re-ranking row.** Eight bytes a vector recalls
  39.5% and returns the true nearest first one time in ten; the same codes with an exact rescoring
  stage recall 95.0%. The memory column rises when re-ranking is on, because the exact vectors have
  to be somewhere — the saving is in fast memory, not in total bytes.
- **`SpatialView` has a `boxTone` dial.** A thousand quadtree nodes want the faintest stroke that
  still reads as a subdivision; a dozen R-tree MBRs over the same points want the strongest, or they
  vanish into the data they exist to explain. Both were wrong on the first browser pass, along with
  the curve shading, which now goes *over* the curve at half alpha instead of under it.

### Measured figures quoted in the M08 examples

`worked-examples-spatial.test.js`, `-spatial-volumes` and `-spatial-search` recompute every one *and*
assert the example still quotes it. Landmarks: a grid's predicted 112.50 candidates against a
measured 109.98 on uniform points and 148.19 on clustered ones, with the work minimum at a cell of 15
rather than the folklore c = r; 20 000 coincident points on three sites building 137 nodes and a
6 667-point leaf at any depth cap; a k-d tree's 8 191 nodes from 720 512 comparisons, and 0.3% of the
data touched at two dimensions against 100% at thirty-two; four R-tree splits at 113.69%, 57.67%,
59.58% and 24.49% overlap giving 356.04, 78.90, 85.32 and 36.69 node visits at the same height 6,
with STR at 98.6% fill and 28.43; a SAH BVH at 49.44 modelled cost and 25.71 nodes per ray against a
median split's 65.81 and 40.70, and the same tree at 258.29 after scattered motion; 306 cells
decomposing into 45 Morton or 22 Hilbert ranges; Fenwick's 7.49/13.01 slots against a segment tree's
14.00/44.90 at four times the memory; HNSW from 58.8% recall at 20.4× to 99.0% at 5.4×; and 79 800,
2 370.47 and 109.97 pair tests per frame for the identical 70.78 pairs.

Two results contradict the textbook and are worth carrying forward. **Guttman's linear split beats
his quadratic split** on this rectangle set, on both overlap and query cost, while doing
asymptotically less work. And on this scene **a rebuilt grid beats sweep and prune by 21.6×**,
because sweep and prune prunes one axis and a grid prunes two — SAP earns its place on varied object
sizes, unbounded worlds and zero-allocation frames, not by default.

### The browser pass, again

All nine sections were opened in Chrome on `npm start`: three tabs each, a rendered mermaid diagram
in every Description, a full reference block in every References, and every demo figure compared
against the section's own prose. All nine graded exercises were run through the **real Worker
sandbox** — every reference solution passes every test and every starter fails at least one.

Four of the things fixed in this milestone were invisible to the whole test suite and obvious on the
first page load: the SAH overclaim, the k-d demo verifying a prefix while the prose quoted the whole
set, the R-tree MBRs drawn in a tone that made them disappear into the data, and the curve shading
drawn underneath a curve dense enough to swallow it. Step 9 is not optional.


---

## M09 notes worth keeping

Shipped: 9 algorithm modules, 2 machines (`version-lab.js` for 9.1-9.6, `succinct-lab.js` for
9.7-9.9), `viz/dag-view.js` (canvas: `tree` shared/copied colouring, `dag` per-version bars),
9 template + section pairs, 12 content files, and the `curriculum.js` M09 group with its
`planned` entry emptied.

### Modules

| Section id | prefix | module | exercise |
|---|---|---|---|
| `persistence-basics` | `pb-` | `persistent-bst.js` | path-copying insert; old versions must still answer |
| `persistent-sequences` | `psq-` | `persistent-queue.js` | banker's queue with an explicit memoised suspension |
| `versioned-queries` | `vq-` | `persistent-segment-tree.js` | persistent segment tree, 11 nodes per update |
| `bit-partitioned-tries` | `bpt-` | `hamt.js` | popcount-indexed sparse nodes |
| `finger-trees` | `ftr-` | `finger-tree.js` | split by measure, counted through a `measure` getter |
| `zippers` | `zip-` | `zipper.js` | tree zipper, graded on reference identity of untouched subtrees |
| `rank-and-select` | `rk-` | `bit-vector.js` | two-level index: rank inside a block, select without a scan |
| `succinct-trees` | `sct-` | `succinct-tree.js` | LOUDS navigation (the starter omits the super-root) |
| `compressed-bitmaps` | `cbm-` | `roaring.js` | Roaring container selection and the two intersection paths |

### Four `create` factories that had to be shrunk, and the three moves that do it

`bit-vector.js`, `finger-tree.js`, `persistent-queue.js` and `roaring.js` all had a `create(options)`
over the 50-own-line limit. Copy these three moves rather than inventing a fourth:

- **Hoist the argument normalisation** to module scope — `bit-vector.js` grew a
  `packBits(bits, options)` returning `{ words, length }`, `finger-tree.js` a `monoidFor(choice)`.
- **Move every doc comment that sits *between* two nested functions to the first line *inside*
  the body it documents.** Own lines become child lines and the comment survives verbatim. That
  move plus the compaction below took `persistent-queue.js` from 65 own lines to 46 and
  `roaring.js` from 58 to 43.
- **Compact the public `return { … }`**: plain `name: name` pairs several to a line, only the
  inline closures on their own lines.

Remember how the lint counts: **own lines = span minus the spans of nested functions**, and a
one-line `foo: function () { … }` counts as a nested function. Blank lines and comments sitting
directly inside `create` are the expensive ones, not the code.

### The browser pass

All nine sections were opened in Chrome on `npm start`. The three tabs render, each Description
carries its mermaid diagram (6-9 nodes, no syntax errors) and 8 concepts, each References tab
carries a full entry, and **zero JavaScript errors** were raised across the whole pass. Every
metric readout matches the prose: `pb-` 3 918 / 13.12 / 156 720 / 8.61, `vq-` 11.00 / 241 504 /
135.9× / 0, `bpt-` 3 930 / 19 624 / 6 / 4.72×, `ftr-` 1 000 / 7 / 14 / 20, `zip-` 12 / 600 / 50× /
24, `rk-` 7.9% / 3.0 / 8.0 / 14.7×, `sct-` 2.0002 / 1 358 / 5.8× / 1.67, `cbm-` 41 232 / 16.49 /
15.30× / 3.44×. All nine exercises were run through the **real Worker sandbox** in the page:
every solution passes 4/4 and every starter fails.

One reading needs its context recorded, because it looks wrong and is not: `psq-build` (worst
operation while building) is **0** for the banker's queue. A pure build is all pushes, and the
banker's queue defers every rotation, so nothing is forced. The 1 014-step spike the prose quotes
comes from `queueTimeline` — push everything, *then* pop everything — and it is on the chart
legend directly above the metric ("banker's — worst 1014, mean 1.49"). Two different experiments,
both labelled.

### Measured figures quoted in the M09 examples

Recomputed in `worked-examples-persistent.test.js`, `-persistent-tries` and `-succinct`, which
also assert the prose still quotes each one. The exact calls that produce them:

#### 9.1–9.3 (`examples-persistent.js`)

```
VersionLab.persistenceCompare({ count: 400, seed: 1 })   // universe defaults to 3x = 1 200
  400 versions, 344 live keys, depth 18, 0 wrong versions for all three
  path-copying  3 918 distinct, 13.12/update, 156 720 bytes
  fat-node        344 distinct,  0.86/update,  76 448 bytes, 3 574 field appends
  node-copying  2 057 distinct,  5.14/update, 126 944 bytes, 1 861 boxes, 1 713 cascades
VersionLab.copyingCost(400, 344) = 5 504 000
VersionLab.readProbes({})   // 2 000 queries, probeSeed 99, version drawn BEFORE the key
  path-copying 8.61 | fat-node 8.61 + 8.05 = 16.66 | node-copying 8.61
VersionLab.queueReuse({ size: 512, reuses: 1000 })
  strict 510.00 steps/reuse (worst 510) | banker 1.50 (worst 503, 8 suspensions forced)
  realtime 1.00 (worst 1) | worst while building: 511 / 0 / 1
VersionLab.queueTimeline({ size: 512 })
  worst 511 / 1 014 / 2, mean 1.49 / 1.49 / 1.00
VersionLab.versionedQueries({ size: 1024, updates: 500 })
  11 nodes/update = the ceil(log2 n) + 1 bound, 241 504 bytes vs 32 817 504 copied (135.9x),
  0 wrong of 2 004 checks
VersionLab.rangeQuantiles({ size: 512, domain: 1000, probes: 300 })
  10.98 nodes/value, 9.97 -> quoted as "10.0" descents/query, 179 904 bytes, 0 wrong
```

#### 9.4–9.6 (`examples-persistent-tries.js`)

```
VersionLab.mapCompare({ count: 20000, seed: 5 })
  15 695 distinct keys, 3 930 nodes, 19 624 slots, mean fan-out 4.99, depth 6 (bound 7),
  219 872 sparse vs 1 037 520 dense = 4.72x, 0 empty slots, 0 wrong
VersionLab.vectorAllocations({ count: 20000 })
  1 840 allocations persistent vs 645 with a transient = 2.85x, 1 195 mutated in place,
  levels 3, tail 32, 0 wrong
VersionLab.monoidCompare({ count: 1000, seed: 7 })   // pushBack one at a time, NOT fromArray
  size 1 000 | sum 49 956 | priority 999 | intervalEnd 499
  identical widths on all four: 1/3, 1/4, 1/3, 1/4, 1/3, 1/1 — spine 6, 24 digit elements
VersionLab.sequenceOps({ count: 3000, at: 1500 })
  spine 7, 26 digit elements, split visits 14 nodes, concat allocates 20, rejoins to 3 000
VersionLab.zipperCost({ depth: 12, edits: 50 })
  zipper 12 rebuilt / 24 moves / 1 rebuild; from the root 600 / 1 200 / 50; ratio 50x
```

#### 9.7–9.9 (`examples-succinct.js`)

```
SuccinctLab.bitVectorRun({ bits: 65536, density: 0.5 })
  32 583 ones, 8 192 data + 646 index = 7.9% overhead,
  rank 3.0 lookups + 3.5 word popcounts, select 8.0 binary steps,
  positions array 130 332 = 14.7x
  at density 0.02: positions array 4 984 against 8 838 stored — the ARRAY wins
  at 1 048 576 bits: select 12.0 steps, overhead 7.8%
SuccinctLab.eliasFanoRun({})        // 5 000 values, gap 400, seed 17
  9.5686 bits/value against a 9.6496 bound, 3.34x against 32-bit, 0 wrong
SuccinctLab.treeEncodings({ nodes: 5000 })     // seed 23
  LOUDS 10 001 bits = 2.0002/node, 1 252 + 106 = 1 358 bytes; BP exactly 2.0000 bits/node
  pointer tree 240 000 bytes (48/node) -> 177x for the shape, and 5.8x once 40 000 bytes of
  8-byte payload is added to the LOUDS side. 0 scan steps in 14 999 navigation calls.
SuccinctLab.waveletRun({})          // 4 000 symbols, alphabet 256, seed 31
  8 levels, 255 vectors, exactly 8 bits/symbol = the bound, 16.0 rank calls/quantile, 0 wrong
SuccinctLab.bitmapKinds({ count: 20000, seed: 37 })
  sparse 77 array containers, 41 232 bytes | WAH 141 972 | raw 630 784 | sorted 80 000
  dense  1 bitmap, 8 208 | WAH 5 164 | raw 8 192   <- Roaring LOSES here, and the prose says so
  runs   8 208 -> 808 after runOptimize | WAH 1 920
SuccinctLab.intersectionPaths({})
  array x bitmap: 3 elements touched, 3 probes, 0 words | bitmap x bitmap: 2 048 words
```

### Things that will bite if forgotten

- `api.rng`, never `api.random`, inside a graded exercise test.
- `inTheWild` in a reference entry must be an **array of `{ system, how }`**; a string throws in
  `core/search-index.js` on first render.
- Every `work` string of every worked-example step must contain a digit — seven M09 sections
  failed that check and were fixed by putting the real measured number into the step.
- A template element id may not equal a control id. `rk-density` was both; the table is now
  `rk-crossover`.
- `versionDag` scores every version as it builds, so it is quadratic in the version count. The
  `persistence-basics` section caps the drawn DAG at `DAG_VERSIONS = 240` (about 110 ms); 800
  versions took 3 s.
- `Format.exact` on a fractional value prints the fraction, so `nodesPerUpdate` goes through
  `Format.fixed`.

### Five module bugs the M09 oracles found (all fixed, keep them fixed)

1. `persistent-bst.shape()` under-counted fat nodes — 14 distinct for 333 keys, because one
   global visited set stopped the walk at version 1. It needs a **per-version** set as well.
2. `hamt.vector` root overflow built one level too few (`newPath(vec.shift - BITS, …)` should be
   `newPath(vec.shift, …)`); every index past the first overflow read `undefined`.
3. `finger-tree.append`'s left-empty case used `reduce` where it needed `reduceRight`, reversing
   the middle run — 163 of 600 split/concat checks failed.
4. `bit-vector.rank1(length)` double-counted at exact block multiples (6 144 for 4 096 ones);
   fixed with an `if (at === length) return ones;` fast path.
5. `persistent-bst.resetStats` **rebound** the stats object while the strategy engine held the
   original by parameter, so every engine-side counter read 0 afterwards. It must be
   `Object.assign(stats, emptyStats())`.

---

## M10 notes worth keeping

Spec: `doc/milestones/M10-sorting-and-selection.md`. Ten sections under the `algorithms` track,
all driven through one instrumented primitive set (`algorithms/sort-ops.js`) so comparisons,
moves, swaps and allocations are four separate budgets rather than one "operations" figure.

### Modules

`algorithms/`: `sorts-elementary.js` (the global is `root.SortsElementary`), `merge-sort.js`
(four schedules on one merge), `quick-sort.js` (three partitions × four pivot rules, introsort,
`adversarialInput`), `timsort.js`, `pdqsort.js`, `radix-sort.js`, `selection.js`,
`binary-search.js` (seven mutations and the probe-case list), `answer-search.js`,
`external-sort.js`, `sorting-networks.js`, plus `sort-ops.js`.
`machines/sort-lab.js` — 7 generators × 15 algorithms, with a reference sort as the oracle and a
stability verdict per run. `viz/array-view.js` (bars / runs / compare) and `viz/network-view.js`
(lattice / depths).

Content is split per third of the milestone — `-sorting`, `-sorting-library`, `-searching`.

### Section ids and prefixes

| Section id | prefix | module(s) |
|---|---|---|
| `sorting-contract` | `soc-` | `sorts-elementary.js`, `sort-ops.js` |
| `merge-sort` | `mgs-` | `merge-sort.js` |
| `quicksort` | `qks-` | `quick-sort.js` |
| `library-sorts` | `lib-` | `timsort.js`, `pdqsort.js` |
| `non-comparison-sorts` | `ncs-` | `radix-sort.js` |
| `selection-and-order` | `sel-` | `selection.js` |
| `binary-search` | `bin-` | `binary-search.js` |
| `searching-the-answer` | `ans-` | `answer-search.js` |
| `external-sorting` | `ext-` | `external-sort.js`, `sorting-networks.js` |
| `sorting-in-practice` | `sip-` | `sort-lab.js` (the chooser) |

### The browser pass, and the one bug that only it could find

All ten sections were opened in Chrome on `npm start`: three tabs each, a rendered mermaid diagram
in every Description, a full reference block in every References, **zero JavaScript errors**, no
empty table body anywhere, and every metric compared against the section's own prose. All ten
graded exercises were run through the **real Worker sandbox** in the page — every solution passes
4/4 and every starter fails.

**`selection-and-order-section.js` did not parse.** An unescaped apostrophe in
`quickselect's cost is an expectation` — the backslash-collapsing corruption this file warns about
below — made the whole file a syntax error, so the section rendered *nothing at all*. Every unit
test passed, because `node --test` never loads a section controller, and the wiring audit only
checked that the file existed. **The wiring audit now compiles every script `index.html` loads**
(`new vm.Script`, `script-does-not-parse`), which is the permanent version of that check.

### Four figures the demos were not showing

The M07 lesson repeated itself: four sections opened on parameters their own prose does not use.

- `soc-size` was 1 200 where the example measures 2 000; `mgs-size` was 2 048 (and the slider could
  not reach 2 000 at a step of 256); `sip-size` was 5 000.
- `library-sorts` ran seed 5 at 4 000 elements, so the page showed 3 152 and 15 767 beside a
  paragraph claiming 3 099 and 15 410. The three memoised runs now use seed 3, and the pdqsort
  table is **pinned at 20 000** — the size its worked example measures — with an `all-equal` row
  added, because that column is not one of `SortLab`'s generated shapes.
- `searching-the-answer` generated a random package list, so it could not show the worked example's
  answer. Seed **0** now means the example's own instance (weights 1, 2, … n), and it is the
  default.

### Three reporting defects the figure tests and the page found

1. **The introsort figures on the anti-quicksort input were written from a run this code does not
   perform.** The prose claimed 4 970 / 10 999 / 24 526 comparisons at depth 10 / 11 / 13. Measured:
   15 373 / 35 374 / 79 717 at depth **18 / 20 / 22** — the depth limit fires, once, and caps the
   recursion at exactly 2·ceil(log2 n), which is a better fact than the one that was there. The
   ratio at n = 2 048 is 13×, not 43×.
2. **`mutationReport` called a hang a wrong answer.** A mutation that spins returns the verdict
   `'did not terminate'`, and the reason column reported `'wrong answer'` for it. `reasonFor` now
   passes the verdict through, so `low-mid` reads 6 non-terminating and `rounded-mid` 11 — which is
   the section's actual claim: the loudest failures are the safest.
3. **The chooser divided by zero and reported the quotient.** LSD radix wins on comparisons with 0
   of them, and `sip-margin` computed `runnerUp / max(1, winner)` — printing 3 099.00× as if it
   were a margin. The margin is now `—` with the note that the winner makes no comparisons, and the
   winner's note reports its moves instead.

### Two measurement decisions — do not undo them

- **Selection figures are the mean of seven pivot seeds** (`PIVOT_SEEDS` in
  `selection-and-order-section.js`, mirrored in `worked-examples-sorting-library.test.js`). A single
  quickselect run is one sample of an expectation and reported 7.09n at n = 80 000 where the mean is
  3.92n; the flat-constant claim the section makes is only true of the mean. The run count travels
  with the figure in the metric note.
- **`binary-search-section.js` builds its skewed keys geometrically** (`Math.floor(Math.pow(1.001, i))`,
  probed at index 9 000). An arithmetic skew gave interpolation search 5 probes, which demonstrates
  nothing; the geometric one gives 13 against binary search's 13, which is the real result —
  interpolation's whole advantage is a property of the distribution.

### Measured figures quoted in the M10 examples

Every one is recomputed by `worked-examples-sorting.test.js`, `-sorting-library` and `-searching`,
which also assert the prose still quotes it, so moving a number without moving the sentence fails
the build. `L` = `SortLab`, and `L.compare({kind, size, seed: 3})` unless another seed is named.

#### 10.1 `sorting-contract` (n = 2 000, seed 3)

```
random:   shell 29 853 | insertion 993 838 | bubble 1 994 247 | selection 1 999 000
moves:    selection 3 984 (1 992 swaps) | shell 23 509 | insertion 993 828 | bubble 1 983 686
sorted:   insertion 1 999 cmp / 0 moves | bubble 1 999 | shell 15 194 / 0 | selection 1 999 000
selection sort is exactly n(n-1)/2 = 1 999 000 on ALL SEVEN shapes
Array.prototype.sort: [1,2,10].sort() -> [1,10,2]; [5,40,300].sort() -> [300,40,5]; [1,2,3] unchanged
```

#### 10.2 `merge-sort` (n = 2 000, seed 3)

```
random:  top-down 19 407 cmp / 43 904 moves / 1 alloc
         bottom-up 19 420 / 24 000 / 1
         natural 21 281 / 40 382 / 444 swaps
         in-place 26 763 / 102 734 / 51 367 swaps / 0 alloc
natural on sorted:     0 passes, 2 000 cmp, 1 run
natural on reversed:   0 passes, 2 000 cmp, 1 000 swaps, 1 run
natural on organ-pipe: 1 pass, 4 000 cmp, 2 runs
```

#### 10.3 `quicksort`

```
2 000 identical values:
  lomuto/median-of-three   2 004 997 cmp, depth 2 000, 1 999 partitions
  hoare/median-of-three       31 723 cmp, depth 12
  three-way/ninther            2 012 cmp, depth 2, 1 partition
few-unique n = 2 000: lomuto 676 647 | hoare 32 506 | three-way 3 389
QuickSort.adversarialInput(n, {partition:'lomuto', pivot:'median-of-three'}):
  n =   512    66 304 cmp, depth  257   (n²/4 =    65 536) | introsort 15 373, depth 18
  n = 1 024   263 680 cmp, depth  513   (n²/4 =   262 144) | introsort 35 374, depth 20
  n = 2 048 1 051 648 cmp, depth 1 025  (n²/4 = 1 048 576) | introsort 79 717, depth 22
adversarialInput against three-way/ninther, n = 2 048:
  no depth limit 361 451 cmp, depth 344 | introsort 78 223, depth 22, 1 heapsort escape
every configuration reports 0 elements out of place — the failure is purely a slowdown
```

#### 10.4 `library-sorts`

```
Timsort nearly-sorted n = 2 000: 3 099 cmp (1.55/element); bottom-up merge 15 410
Timsort random n = 2 000: 19 399
minRunLength: 10->10, 63->32, 64->16, 65->17, 1000->32, 2048->16, 20000->20   (range [16,32])
de Gouw et al. run lengths [120, 80, 25, 20, 30], n = 275, minRun: 1
  fixed rule: settled stacks [120] [120,80] [120,80,25] [120,80,25,20] [275], 0 violations
  buggy rule: settles at [120, 80, 45, 30] -> 1 violation (120 <= 80 + 45 = 125)
  BOTH SORT CORRECTLY — 0 out of place either way
pdqsort n = 20 000, seed 3:
  sorted    40 010 cmp, depth  1, 1 partial-insertion win
  equal     40 024 cmp, depth  2, 1 equal block
  few       60 008 cmp, depth  3, 3 equal blocks
  random   319 511 cmp, depth 17, 91 pattern breaks
  organ    428 593 cmp, depth 23, 394 pattern breaks, 0 heapsort fallbacks
```

#### 10.5 `non-comparison-sorts`

```
LSD radix: 0 comparisons at every digit width, every shape
countingCost(range, n = 1000): 2^8 -> 1 024 bytes / 1 256 ops / wins
                               2^16 -> 262 144 bytes / 66 536 ops / loses
                               2^32 -> 17 179 869 184 bytes / loses      (n log2 n ~ 9 966)
digit widths: 4 bits 16 buckets 64 B 8 passes | 8 bits 256 / 1 024 B / 4 | 16 bits 65 536 / 262 144 B / 2
stability, 2 000 tagged elements, 8-bit digits:
  keys 0..19   stable -> sorted+ties kept; unstable -> SORTED, ties reversed  (damage invisible)
  keys 0..10^6 stable -> sorted+ties kept; unstable -> NOT SORTED             (first pair already wrong)
signed LSD: [-2147483648, -100, -1, 0, 1, 100, 2147483647]
signed:false: [0, 1, 100, 2147483647, -2147483648, -100, -1]
```

#### 10.6 `selection-and-order` — MEAN OF SEVEN PIVOT SEEDS [3,11,17,29,41,53,67]

```
L.input('random', n, 7), k = 50th percentile:
  n =  5 000  quick 16 221 (3.24n) | mom  40 921 (8.18n) | sort   54 966 (10.99n)
  n = 20 000  quick 59 772 (2.99n) | mom 161 904 (8.10n) | sort  259 880 (12.99n)  <- demo default
  n = 80 000  quick 313 625 (3.92n) | mom 661 550 (8.27n) | sort 1 199 064 (14.99n)
introselect at 20 000 = 59 772 (2.99n) — identical to quickselect on this input
k sweep at 20 000: k=0% 2.31n | 25% 2.84n | 50% 2.99n | 100% 1.81n
```

#### 10.7 `binary-search`

```
mutationReport(), 13 probe checks:
  correct             0/13   <- the control; must stay 0
  closed-interval     3/13   wrong answer
  lte-probe           5/13   wrong answer
  high-mid-minus-one  1/13   wrong answer   <- caught by ONE case
  low-mid             6/13   did not terminate
  inclusive-loop      4/13   READ PAST THE END — never a wrong answer
  rounded-mid        11/13   did not terminate
10 000 keys, uniform (i*3) and geometric (1.001^i):
  lowerBound   13 probes on both   (the bound ceil(log2 10 000) is 14)
  branchless   15 on both — no early exit, so ⌈log₂ n⌉ + 1 always
  interpolation 1 uniform / 13 geometric
  exponential search for index 3: bound 4, searches [2, 5)
midpointComparison(2 000 000 000, 2 100 000 000): safe 2 050 000 000, bits32 -97 483 648, overflows
```

#### 10.8 `searching-the-answer`

```
shipCapacity([1..10], 5): answer 15, 5 checks, range 10..55, span 46, predicate flips exactly 1
aggressiveCows([1,2,4,8,9], 3): answer 3, 3 checks   (a LAST-true search)
non-monotone x===3 || x>=7 over [0,10]: 3 flips; binary search returns 7, truth is 3
searchCost(1e9): 30 checks against a sweep of 1e9
ternary integer: peak of -(x-37)^2+500 over [0,1000] found at 37 in 30 probes
ternary real: peak of -(x-3.5)^2+9 over [0,10] -> 3.499999970, width 4.44e-16 after 200 rounds
```

#### 10.9 `external-sorting`

```
L.input('random', 10 000, 5), memory 100, order 4:
  sort-and-flush        100 runs, mean 100.0, 4 passes, 100 000 transfers
  replacement selection  51 runs, mean 196.1, 3 passes,  80 000 transfers   <- 2M, Knuth's snowplough
  sorted input + replacement selection: 1 run, 0 merge passes
merge order 2/4/8/16 -> 7/4/3/2 passes; 160 000 / 100 000 / 80 000 / 60 000 transfers
ioCost(1e9, 1e7, 1e5, 99): 10 000 blocks, 100 runs, 2 passes, 60 000 block transfers
networks — ALL pass exhaustive zero-one verification, 0 failures:
  n= 4 bitonic  6/depth 3 | odd-even  5/3  | insertion   6/5   (16 inputs)
  n= 8 bitonic 24/depth 6 | odd-even 19/6  | insertion  28/13  (256 inputs)
  n=16 bitonic 80/depth 10| odd-even 63/10 | insertion 120/29  (65 536 inputs)
  n=1024 bitonic 28 160/55 | odd-even 24 063/55
  n=1025 pads to 2048: bitonic 67 584/66 — 1 023 sentinels for one extra element
bitonic(8) single-comparator deletion is caught by between 1 and 225 of the 256 zero-one inputs
bitonic depth == log2(n)(log2(n)+1)/2 exactly at 8, 16, 64, 1024
```

#### 10.10 `sorting-in-practice` (n = 2 000, seed 3, comparisons)

```
shape          winner                     | lomuto med-3 | selection | radix
random         Timsort        19 399      |     25 011   | 1 999 000 | 0 cmp / 8 000 moves
sorted         insertion       1 999      |     21 033   | 1 999 000 | 0 / 4 000
nearly-sorted  Timsort         3 099      |    104 120   | 1 999 000 | 0 / 4 000
few-unique     three-way       3 389      |    676 647   | 1 999 000 | 0 / 4 000
reversed       natural merge   2 000      |     34 331   | 1 999 000 | 0 / 4 000
organ-pipe     natural merge   4 000      |    323 989   | 1 999 000 | 0 / 4 000
adversarial    Timsort         8 708      |  1 003 000   | 1 999 000 | 0 / 4 000
Lomuto ranges 21 033 -> 1 003 000 across the shapes: a factor of 48
```

### Eleven module bugs the M10 work found (all fixed — keep them fixed)

1. `merge-sort`: the stability flag was passed **inverted** at all three `merge()` call sites
   (`!stable` for `takeLeftOnTie`), so every "stable" schedule was unstable and the
   `unstableMerge` option made them stable.
2. `merge-sort`: symmetric in-place merge (`inPlaceSort`) **is** stable — the lower-bound /
   upper-bound cut asymmetry is what preserves tie order. It was declared `stable: false`.
3. `quick-sort`: Hoare's scheme **hangs** if the pivot sits at `to - 1`. Fixed by swapping the
   chosen pivot to `from` first. It does not return a wrong answer; it does not return.
4. `pdqsort`: `breakPatterns` swapped across the pivot boundary, which silently undoes the
   partition just computed. It must swap strictly inside one side. 9 of 2 128 shape/size
   combinations came back unsorted.
5. `sorting-networks`: `j /= 2` in the bitonic loop walks into 0.5, 0.25, … and never reaches 0,
   so the round counter (and therefore the depth) was meaningless — 3 228 instead of 6 — while
   the comparator list stayed correct. Use `j >>= 1`.
6. `radix-sort`: `countingSort` computed min/max off the **values** rather than through the key
   function, so sorting objects by a field threw `Invalid array length`.
7. `radix-sort`: `lsdRadixSort` read `source[0]` on an empty array. Guarded with an early return.
8. `answer-search`: `lastTrue` implemented as `firstTrue` on the negated predicate is **one too
   small** whenever the entire range is feasible — the exact off-by-one the module's own doc
   comment warns about. It needs its own invariant and a midpoint that rounds **up**.
9. `answer-search`: `ternarySearchInteger` had its two branches inverted and returned the range
   endpoint instead of the peak.
10. `external-sort`: `predictedPasses` used `Math.max(1, …)` and so reported 1 pass when run
    generation had already produced a single run. Extracted as `passesFor(runs, order)`.
11. `binary-search`: the `inclusive-loop` mutation is caught by **no** output check in
    JavaScript. `mutationReport` now runs each mutation against a `Proxy` that records reads past
    the end, which is the only way that defect is observable here.

### Things that will bite if forgotten

- **Heredocs collapse backslashes in this environment.** Two content files were corrupted by
  `python - <<'PY'` — once turning `\'` into `'` and once turning `\n` into a literal newline
  inside a string. Use the Write/Edit tools for anything containing escapes.
- `root.SortsElementary` is the global for `sorts-elementary.js` (not `Elementary`).
- `Helpers.memoise` takes a **single string key**; a multi-argument compute function silently
  memoises on the first argument only.
- `Format.bytes` exists — do not hand-roll a byte formatter.
- A section `config()` over 50 own lines is the usual size-lint failure; the fix used here (and
  in `bloom-filters-section.js`) is to extract `diagram()` as its own function.
- Elementary sorts are excluded from the `sorting-in-practice` chooser above 3 000 rows, because
  timing a quadratic sort at 30 000 measures patience. `candidatesFor(size)` does it.

---

## M11 notes worth keeping

Spec: `doc/milestones/M11-design-paradigms.md`. Nine sections under the `algorithms` track, built
on ten pure modules plus `machines/search-tree-lab.js` — one generic explorer that drives the
n-queens and knapsack searches through the same `spec` interface, so the drawn tree and the
counters come from the same walk the solver performs.

Shipped: 10 algorithm modules, 1 machine, `viz/search-tree-view.js`, 9 template + section pairs,
12 content files, 3 test files (52 module property tests + 31 figure tests), and the
`curriculum.js` M11 group with its `planned` entry emptied.

### Section ids and prefixes

Checked against every existing template; none collide.

| Section id | prefix | module(s) |
|---|---|---|
| `exhaustive-search` | `xs-` | `backtracking.js`, `search-tree-lab.js` |
| `divide-and-conquer` | `dnc-` | `karatsuba.js`, `strassen.js`, `closest-pair.js` |
| `greedy-algorithms` | `grd-` | `greedy.js` |
| `matroids` | `mtr-` | `matroid.js` |
| `backtracking` | `bkt-` | `backtracking.js` |
| `branch-and-bound` | `bnb-` | `branch-and-bound.js`, `search-tree-lab.js` |
| `two-pointers` | `tpw-` | `two-pointers.js` |
| `meet-in-the-middle` | `mim-` | `meet-in-middle.js` |
| `offline-processing` | `ofl-` | `mo-algorithm.js` |

Content files are `concepts|examples|reference|exercises-paradigms{,-search,-sweeps}.js`, split
1-3 / 4-6 / 7-9.

### Measured figures quoted in the M11 examples

All measured from the code on disk, with the seeds the sections use. Nothing here needs
re-deriving; the missing figure tests should assert exactly these.

#### 11.1 `exhaustive-search` — n-queens

```
                    control(leaf)   early    sym+leaf   both    solutions
n =  6                    1 957       153        979      77            4
n =  8                  109 601     2 057     54 801   1 029           92
n = 10                9 864 101    35 539  4 932 051  17 770          724
fractions at n = 8: early 1.88% | symmetry 50.00% | both 0.94% (= the product)
first solution only, n = 8: 114 nodes natural order, 9 with most-constrained-first
```

#### 11.2 `divide-and-conquer`

```
Karatsuba.crossover({ threshold: 1, seed: 3 }) — schoolbook / karatsuba / ratio / n^1.585
  n =    4        16 /     17 / 0.94 /      9      (Karatsuba LOSES)
  n =    8        64 /     45 / 1.42 /     27
  n =   16       256 /    128 / 2.00 /     81
  n =  128    16 384 /  3 715 / 4.41 /  2 187      (1.70x the model)
  n =  512   262 144 / 33 498 / 7.83 / 19 683      (1.70x)
  n = 1024 1 048 576 /100 273 /10.46 / 59 049      (1.70x)
  all 9 sizes agree with BigInt exactly
closest pair, 2 000 uniform points (LCG seed 11): 2 314 checks against 1 999 000, worst strip run 2
inversions over 2 000 values (seed 17): 984 529 inversions from 19 447 comparisons
Strassen (seed 23), cubic / strassen / ratio / relative error:
  side  16    4 096 /   2 401 / 1.71 / 2.80e-15
  side  64  262 144 / 117 649 / 2.23 / 1.20e-14
  side 128 2 097 152 / 823 543 / 2.55 / 3.40e-14
```

#### 11.3 `greedy-algorithms`

```
counterExample(criterion, { seed: 5 }) — climbs the ladder [[4,10],[6,12],[9,14],[11,18],[14,22]]
  earliest-finish    none in 200 000 instances
  earliest-start     loses 1/2 at 4 intervals after 5 instances
  shortest           loses 1/2 at 4 intervals after 554
  fewest-conflicts   loses 3/4 at 9 intervals after 94 996
isCanonical: 1,5,10,25 canonical (limit 35) | 1,2,5,10,20,50 canonical (limit 70)
             1,3,4 fails at 6 (3 vs 2) | 1,7,10 fails at 14 (5 vs 2) | 1,15,25 fails at 30 (6 vs 2)
             1,5,11 fails at 15 — above the largest coin, which is the exercise's point
fractional knapsack 240 against a 0/1 optimum of 220 on (60,10),(100,20),(120,30) at capacity 50
stayingAheadTrace on the section default (12 intervals, span 20, seed 3):
  greedy ends 5, 10, 11, 15, 18 against the mirror-rule rival's 5, 10, 11, 15, 20
```

#### 11.4 `matroids`

```
matching on the 3-edge path, weights 2, 3, 2: not a matroid, 5 independent sets,
  exchange witness {1-2} cannot be extended from {0-1, 2-3}, greedy 3 against a best of 4
graphic, 8 edges over 4 vertices (Random.seeded(5)): matroid, 62 independent of 256 subsets,
  greedy 46 = best 46; negated weights give a minimum forest of 16
```

#### 11.5 `backtracking` — Sudoku, node budget 500 000

```
                 none      MRV    +forward   +propagation
easy            4 209       52         52              1
escargot        8 970      218        210             15
inkala         49 559   10 102      9 180            929
antibrute     500 000+  45 268     39 223          6 050
platinum       419 195  500 000+   500 000+       500 000+     <- the ranking INVERTS here
inkala backtracks: 49 498 / 10 041 / 10 041 / 1 837; propagations 0 / 0 / 0 / 9 089
```

#### 11.6 `branch-and-bound` — 22 items, Random.seeded(13), capacity 164, optimum 658

```
fractional relaxation   70 nodes,  23 pruned, value 658
best remaining density 282 nodes, 129 pruned, value 658
90% of the relaxation   40 nodes,  13 pruned, value 640   <- inadmissible, and silently wrong
exhaustive           4 194 304 subsets
TSP, 9 cities (Random.seeded(13)): 2 502 nodes with the bound, 109 601 without, both 226.019
```

#### 11.7 `two-pointers` — n = 5 000, k = 50, Random.seeded(7)

```
shape        pushes   pops   total   per element   peak deque
random        5 000  4 994   9 994      1.999          11
ascending     5 000  4 999   9 999      2.000           1
descending    5 000  4 950   9 950      1.990          50
sawtooth      5 000  4 999   9 999      2.000           2
rescanning each window: (5 000 - 50 + 1) x 50 = 247 550 comparisons
largest rectangle, 2 000 bars (Random.seeded(11)): area 793, 4 000 stack ops against 2 001 000
[2, 1, 5, 6, 2, 3] -> 10
```

#### 11.8 `meet-in-the-middle` — Random.seeded(5), target = half the total

```
n     mid states   probes    best sum    brute states    ratio
12          128      384      17 043           4 096       32
16          512    2 040      20 646          65 536      128
20        2 048   10 240      27 306       1 048 576      512
22        4 096   22 440      27 988       4 194 304    1 024
40    2 097 152 20 969 549    50 719      1.10e12 (projected)
bidirectional: b=3 d=8 -> 3 281 forwards / 22 both ways | b=4 d=8 -> 21 846 / 32; both distance 8
```

#### 11.9 `offline-processing` — n = 4 000, q = 600, universe 200, seed 9

```
block size    moves    predicted q.b + n²/b
16 (√n/4)   357 720          1 009 600
63 (√n)     210 636            291 768
163 (n/√q)  121 956            195 960     <- the minimiser
253 (4√n)   109 260            215 041
arrival order: 1 420 156 moves (11.6x), 600/600 answers match brute force
bound (n + q)·√n = 290 930; the measurement is 42% of it
```

### Decisions that are easy to undo by accident

- **`backtracking.js`'s Sudoku keeps a candidate mask per cell, maintained incrementally.**
  Recomputing masks from the peers made the section's matrix take 42 s; bitmasks took it to 5.1 s
  and incremental maintenance to 2.16 s, with identical node counts at every cell. The matrix is
  also memoised on the budget alone, because it does not depend on the selected puzzle.
- **`nQueens` collects boards whenever `symmetry` is on, even under `countOnly`**, because the
  count is produced by mirroring them and de-duplicating — doubling is wrong for odd n.
- **`greedy.stayingAheadTrace` builds its rival with the mirror rule** (latest start first). The
  obvious reconstruction from the DP re-derives earliest-finish, so every row ties and the table
  demonstrates nothing.
- **`SearchTreeLab.explore` draws at most `treeLimit` nodes and reports `treeTruncated`.** The
  unpruned configurations reach millions of nodes; the counters keep counting after the drawing
  stops.
- **The counter-example search in `greedy.js` climbs a size ladder** and reports how many instances
  it tried. That number is the teaching point: 5 for earliest-start, 94 996 for fewest-conflicts.

### The verification pass, and why it is not the Chrome pass

M11's module tests and figure tests are written, and the figure tests assert both halves: every
number recomputed from the module, and the prose asserted to still quote it. One overclaim died
that way — the exhaustive-search example said the two prunings' surviving fractions multiply
"exactly", and they do not: the measured 0.9389% sits above the 0.9384% the product gives, because
some mirrored boards would have been cut by the diagonal check anyway. The prose now states the
overlap, and the test asserts **both** directions (they agree at two decimal places, and they are
not equal) so it cannot drift back to either overclaim.

**The Chrome extension was not connected in this session, so step 9 was not performed for M11.**
What replaced it is `tests/render-audit.js` — see the section below. That audit catches the two
failure classes that produced almost every browser-only bug in M06, M07 and M10 (something that
throws on render, and a DOM target a section declares and never writes), and it found none in M11.
It cannot catch the third class: anything about *layout and colour* — a chart at its fallback
width, an MBR stroke that vanishes into the data, a mermaid diagram that fails to lay out. Those
still want a human at a browser, and M11 has not had one.

---

## The render audit (new in this session)

`tests/render-audit.js`, wired into `npm test` as `test:render`. It boots the real `index.html` in
jsdom, executes all 496 scripts in document order, calls `BerugoStart()`, and activates every
section in the curriculum. It fails on:

- an exception while a section renders or updates;
- a `console.error` raised during a section's activation;
- a content container that stays under 500 characters;
- a table with a `<thead>` and an empty `<tbody>`;
- a metric tile reading the em-dash placeholder **whose tile carries no note**.

Three things about it that are easy to get wrong when extending it:

- **`navigation.go` is asynchronous.** It sets `location.hash` and waits for `hashchange`, which
  jsdom delivers on a later turn — so the audit would check an unrendered container. `activate()`
  sets the hash first, which makes `go` take the "already there" branch and render synchronously.
- **jQuery's ready callback never fires** for scripts appended after the document is parsed, so
  `window.BerugoApp` does not exist and the audit calls `window.BerugoStart()` itself.
- **The placeholder rule is about the note, not the dash.** Ten tiles legitimately report an
  em-dash — the chooser's margin column cannot rank a winner that makes no comparisons, the
  counter-example tile has no counter-example in range, the code engine has not run yet — and every
  one of them carries a note saying so. Asserting "no dashes" would be wrong; asserting "no
  *unexplained* dashes" is the rule the content already follows.

jsdom has no layout, so `getBBox`, `ResizeObserver`, `matchMedia` and the 2D canvas context are
stubbed and `Worker` is left undefined (the runner falls back to its inline backend). Nothing the
audit reports is about pixels, and it is **not** a substitute for opening the page.

It runs in about 50 seconds, because activating a section runs its demo — including the Sudoku
matrix and the 2^21-state meet-in-the-middle run.

---

## M12 notes worth keeping

Spec: `doc/milestones/M12-dynamic-programming.md`. Eleven sections under the `algorithms` track.

### Modules

`algorithms/`: `dp-classic.js` (1-D family, coin change, LIS), `dp-knapsack.js` (0/1, unbounded,
three bounded expansions, subset sum, `bitCost`), `dp-sequence.js` (edit distance, Hirschberg,
LCS, scored and affine alignment, `checkAlignment`), `dp-interval.js` (matrix chain, optimal BST,
Knuth, `checkQuadrangle`), `dp-tree.js` (rooted DPs, `reroot`, `prefixSuffix`, `shapedTree`),
`dp-bitmask.js` (Held-Karp, assignment, submasks, SOS, broken profile, `memoryFor`),
`dp-digit.js` (digit DP, DAG DP, automaton DP), `dp-optimizations.js` (CHT, Li Chao, D&C
optimisation, monotonic queue, aliens), `game-theory.js`, `expectation-dp.js`.
`machines/dp-lab.js` (naive / memoised / tabulated through one instrument, plus the subproblem
DAG). `viz/dp-table-view.js` (HTML table with settled / active / depends / traceback marks).

`dp-classic.js` and `dp-knapsack.js` are two files where the spec's table said one, for the usual
size reason.

### Section ids and prefixes

| Section id | prefix | module(s) |
|---|---|---|
| `what-dp-is` | `wdp-` | `dp-lab.js` |
| `one-dimensional-dp` | `odp-` | `dp-classic.js` |
| `knapsack-family` | `knp-` | `dp-knapsack.js` |
| `sequence-alignment` | `seq-` | `dp-sequence.js` |
| `interval-dp` | `ivl-` | `dp-interval.js` |
| `tree-dp` | `trd-` | `dp-tree.js` |
| `bitmask-dp` | `bmk-` | `dp-bitmask.js` |
| `digit-dp` | `dgt-` | `dp-digit.js` |
| `dp-optimisations` | `dop-` | `dp-optimizations.js` |
| `game-dp` | `gdp-` | `game-theory.js` |
| `expectation-dp` | `exp-` | `expectation-dp.js` |

### Five findings worth keeping

1. **`checkQuadrangle` needed a tolerance.** Interval weights are differences of prefix sums, so
   the textbook nine two-decimal probabilities violate the quadrangle inequality by
   1.11e-16 and an exact `<=` rejects exactly the instance Knuth's optimisation was written for.
   The tolerance scales with the total weight. `worked-examples-dp-structured.test.js` asserts
   **both** directions - that it passes with the tolerance and fails without - so the tolerance
   cannot be removed as decoration.
2. **`countUpTo` dropped the number zero.** The natural `started && accepting` termination never
   counts it, so every prefix count came out one short on every property that accepts zero while
   every *range* stayed correct, because the error cancels in the subtraction. Range tests cannot
   find this; only counting one at a time from zero can.
3. **Reversing a move list is not a worse alpha-beta ordering.** On a symmetric board it prunes
   identically (18 297 nodes either way). A genuinely bad ordering has to be bad about the *game*,
   so `edgesFirst` replaced `worstOrder` and gives 42 094 against centre-first's 7 275. Both the
   identity and the spread are asserted.
4. **Prefix/suffix rerooting LOSES on low-degree trees.** At n = 2 000 the naive "all but one"
   loop costs 7 994 combines on a path and 9 990 on a caterpillar against rerooting's flat 11 994;
   it wins by 333x only on a star. The section says "insurance with a premium" rather than
   claiming a uniform win, and the test asserts the path case is cheaper so the framing cannot
   silently become false.
5. **A tabulation run in the wrong order must return a NUMBER.** `DpLab.tabulated` substitutes 0
   for a cell that has not been written - not `undefined`, which would poison the arithmetic to
   NaN and give the game away. That is what makes `unresolved` the only evidence, which is the
   whole point of 12.1's last table.

### Decisions that are easy to undo by accident

- **`knapsack01Rolling` returns `chosen: null`, not a list.** The rows a traceback would walk do
  not exist; returning a plausible item list is the bug the section is about.
- **`editDistanceRows` returns no `alignment` field at all**, for the same reason, and the test
  asserts `undefined` rather than asserting a value.
- **The optimised solvers refuse rather than answering.** `knuthOptimalBst`, `groupingHull` and
  `groupingDivideConquer` all return `refused: true` with a witness when their precondition fails;
  `force: true` exists so the demo can show what running it anyway produces.
- **The naive `DpLab` run is capped and says so**, and the row renders "stopped" rather than a
  smaller number.
- **The drawn knapsack table is pinned at 10 items x 24 capacity.** A 400-column table is
  unreadable and the point of drawing it is the two incoming edges.
- **`dominoTilings` puts the NARROW side in the mask.** 2 x 12 is 4 profiles; 12 x 2 is 4 096.

### External oracles used

Nothing in this repository produced these, which is why they are worth having: C(24, 12) =
2 704 156, the 8 x 8 domino tiling count 12 988 816, the 2 x k Fibonacci tilings, Nim's Grundy
value being the heap size, the period-7 sequence of the subtraction game {1, 3, 4}, and 1/e for
the secretary problem.

### Measured figures quoted in the M12 examples

`worked-examples-dp.test.js`, `-dp-structured` and `-dp-advanced` recompute every one at the
sections' own default control values *and* assert the prose still quotes it. Landmarks: 242 785
naive calls against 26 memoised states and 23 shared; a reversed tabulation returning 0 from 48
unwritten reads; LIS at 1 999 000 against 11 411 transitions for length 85; coin change 4 against
9 at an amount of 5 and 29 against 26 547 at 20; a 793-cell knapsack table giving 571 with a
chosen set weighing 59; bounded expansions of 240 / 36 / 6 items at 11 800 / 621 / 366
transitions; Hirschberg at 16 peak cells against 56 with five splits; 15 intervals and 35 split
tests for 18 984 multiplications; 156 against 72 split tests at cost 2.590000; 1 999 combines for
2 000 roots; 49 152 Held-Karp cells against 39 916 800 tours; 3^n exact at 81 / 6 561 / 531 441;
SOS at 5 120 against 59 049; 3 155 numbers in 137..4 321 from 45 states; the hull at 783
transitions against 80 200 for 80 131; alpha-beta at 7 275 / 18 297 / 42 094 for the same value;
and a board solving to 10.476469 rolls that is cyclic before any snake is placed.

### The verification pass

Steps 1-8 are complete: 64 module property tests, 49 figure tests, 88 concepts, 22 worked
examples, 11 reference entries and 11 graded exercises (every solution 4/4, every starter
failing), plus the render audit over all 115 sections. **The Chrome extension was not connected
in this session, so step 9 has not been performed for M11 or M12.** The render audit covers what
throws and what is left unwritten; it cannot see chart widths, colour separation or mermaid
layout.

---

## M13 notes worth keeping

Spec: `doc/milestones/M13-graphs-i.md`. Ten sections under the `algorithms` track, all driven
through `machines/graph-lab.js`, which carries a brute-force oracle for every claim: mutual
reachability for SCCs, remove-and-recount for bridges, Bellman-Ford for Dijkstra, a threshold
binary search for the minimax path, the naive climb for LCA, and `routingAllPairs` for contraction
hierarchies.

### Modules

`algorithms/`: `graph-core.js`, `traversal.js`, `topological.js`, `scc.js`, `biconnectivity.js`,
`shortest-paths.js`, `astar.js`, `contraction-hierarchies.js`, `mst.js`, `tree-queries.js`.
`machines/graph-lab.js`, `viz/graph-view.js` (canvas; fixed / circular / grouped / **tree** layouts,
no force layout on purpose).

Content is split per quarter of the milestone — `-graphs` (13.1-13.3), `-graphs-paths` (13.4-13.6),
`-graphs-routes` (13.7-13.8), `-graphs-trees` (13.9-13.10) — rather than per third, because the
exercise files are the size constraint and four sections of them pass 1 000 lines.

### Six bugs the M13 work found, all fixed

1. **An edge-list Bellman-Ford walked a directed subgraph of an undirected graph.** `graph.edges`
   holds an undirected edge once, so relaxing only `from → to` is a different graph. On the 13.5
   demo the "reference implementation" reported 185 against Dijkstra's 181 and 392 disagreements —
   on a graph with no negative edge — directly under a note saying the disagreement column is zero.
   `GraphCore.directedEdges(graph)` now expands each edge into its two arcs, and `johnson` does the
   same internally. **Only the section dump found this**; no unit test called `bellmanFord` on an
   undirected graph.
2. **`astar` counted stale lazy-heap pops as reopenings.** A consistent heuristic appeared to reopen
   495 nodes and to expand 31% more than Dijkstra, which made "a consistent heuristic never reopens"
   untestable. A pop is *stale* when its key exceeds the node's current f — pure bookkeeping — and a
   *genuine* reopening when the key matches it. With the two separated, the consistent run reports
   0 reopenings and 1 600 expansions (exactly Dijkstra's) and the inconsistent one reports 508.
3. **The 13.4 redundancy slider duplicated the wrong edges.** `withParallelEdges` duplicates the
   *first* n edges, which on a barbell are all inside one clique, so the bridge count never moved
   under a caption saying the counts must fall. `GraphCore.duplicateEdges(graph, ids)` was added and
   the section now duplicates the current *bridges*. The panel then teaches something better than
   intended: one redundant cable takes the barbell from 1 bridge to 0 and leaves both articulation
   points exactly where they were — edge redundancy and vertex redundancy are different purchases.
4. **The 13.6 Johnson panel was vacuous.** The all-pairs graph had only positive weights, so every
   potential was 0 and no edge was reweighted, under prose about the triangle inequality. The graph
   is now built by *undoing* a reweighting — `w = base − p[u] + p[v]` — which guarantees negative
   edges and no negative cycle, and the panel shows the ten most negative edges rather than the
   first ten.
5. **The 13.6 orientation quoted a 2.96% arbitrage the demo does not find.** The measured loop is
   JPY → GBP → JPY at a multiplier of 1.007000 — 0.70% — and the prose now says so.
6. **A uniform grid cannot demonstrate an inadmissible heuristic.** Every monotone path ties, so
   Manhattan ×5 still returns the optimum, and an A* exercise asserting "a stronger heuristic
   expands fewer nodes" fails on a corner-to-corner query because *every* cell lies on a shortest
   path. Both the section and the exercise use a weighted grid, or same-row endpoints, for that
   reason.

### Two tools that now live in `tools/`

- **`tools/section-dump.js <section-id> [control=value ...]`** boots the app exactly as the render
  audit does and prints every metric tile, table and note. This is the instrument for "measure
  first, then write the sentence that quotes the measurement", and it found bugs 1, 3, 4 and 5
  above in the first five minutes of using it. Control overrides go through the section's own
  control panel, so a dump at non-default settings uses the same code path a click would.
- **`tools/wire-section.js <curriculum-file> <after-id> <spec.json>`** replaces the lost `wire13.py`:
  it appends curriculum entries, adds the `<section>` containers and adds the two script tags, and
  refuses on an apostrophe in a curriculum string or a template with no matching controller.

### Design decisions that are easy to undo by accident

- **`contraction-hierarchies` ships two broken witness searches on purpose.** `witness: 'none'`
  never searches (492 shortcuts instead of 18, 8.94× edge growth, 0 wrong) and
  `witness: 'ignore-contracted'` searches through vertices that are already gone (20 shortcuts, a
  1.32× growth that looks right, and 42 of 1 260 pairs wrong with 20 reported unreachable). The
  section's whole claim is that the second failure is invisible without an exhaustive check, so the
  learner has to be able to select it and watch the counter move.
- **The witness search may be approximate towards "add the shortcut" and never towards "skip it".**
  Hop limits 2, 3, 5 and 8 give 176, 118, 84 and 84 shortcuts and 0 wrong of 4 032 at every depth.
- **`GraphView.treeLayout` exists because a ring hides depth.** A path of 1 000 and a star of 1 000
  draw identically on a circle and could not behave more differently.
- **The 13.10 traced query skips pairs where one node is the other's ancestor.** About a third of
  random pairs finish inside the levelling loop and show none of the interesting half.
- **`GraphLab.routingAllPairs` reports the disagreement count as a field.** On a deliberately broken
  hierarchy the disagreement *is* the demo.
- **Every traversal in every M13 module is iterative**, and two exercises assert it by running a
  chain of 60 000 and 100 000 vertices.

### Measured figures quoted in the M13 examples

`worked-examples-graphs.test.js`, `-graphs-paths`, `-graphs-routes` and `-graphs-trees` recompute
every one *and* assert the prose still quotes it. Landmarks: a 400-node grid at 25.3 KB / 38.8 KB /
1.2 MB with the matrix-CSR crossover at exactly n²/4; BFS and DFS at 400 nodes and 1 520 edges with
peaks of 20 and 400; 399 tree + 361 back = 760 edges; a 118-unit build with a critical path of 25
over 7 packages, makespans 118/59/36/25/25/25 and never more than 11 workers busy; one back edge
leaving 37 of 40 placed and the cycle 34 → 19 → 34; 15 SCCs from 74 edges condensing to 14, against
18 components with a 71.7% giant and 17 singletons on a random digraph; a barbell at 1 bridge and 2
cut vertices of 381 edges, and a path at 39 and 38; 181 agreed by three algorithms at 20 880 / 3 480
/ 6 516 relaxations with 253 stale pops of 1 153; d[1] correct and d[3] = 3 against 2; an arbitrage
loop of two currencies at 1.007000; 554 of 1 600 Floyd-Warshall cells wrong at identical work;
Johnson at 5 124 relaxations against 26 520 and 64 000; Manhattan and Euclidean expanding all 1 600
cells against ALT's 98; 295 at 18.47% and 361 at 44.98% for 11× and 19× fewer expansions; 128 with
reopening and 155 without, a 21.09% gap; IDA* at 1 068, 34 164 and a budget exhausted; 18 shortcuts
for 28 876 witness steps and a query at 37 against 64; 4 460 pairs and 0 wrong across six fixtures;
295× the preprocessing for 9× the nodes; three MSTs at 270 costing 1 666 / 2 280 / 1 170 with
non-identical edge sets and a runner-up that ties; 136 of 198 shortest paths with a worse worst hop;
and 1 630 naive steps against 1 916 lifting jumps on a shallow tree, inverting to 11 783 against 621
on a path.

Two results are worth carrying forward. **An admissible, consistent, geometric heuristic can prune
exactly nothing** — on terrain whose steps cost 1 to 9, a unit-step Manhattan bound expands all
1 600 cells, which is Dijkstra, and only a heuristic in the same units as the edges (ALT, at 98)
closes the gap. And **binary lifting loses to the naive climb on shallow trees**: 1 916 jumps
against 1 630 steps plus 1 800 cells of preprocessing on a 200-node tree of depth 13, inverting by
19× on a path. Shape is the variable the complexity table hides.

## M14 notes worth keeping

Spec: `doc/milestones/M14-graphs-ii.md`. Ten sections under the `algorithms` track.

### Modules

`algorithms/`: `max-flow.js`, `push-relabel.js`, `min-cost-flow.js`, `matching.js`,
`weighted-matching.js`, `two-sat.js`, `coloring.js`, `layout.js`, `spectral.js`, `centrality.js`.
`machines/`: `flow-lab.js` (7 network shapes), `reduction-lab.js` (5 reductions that round-trip),
`matching-lab.js` (bipartite shapes, stable runs, general graphs, cost matrices),
`sat-lab.js` (four instance families, the threshold sweep, the three-literal relaxation),
`graph-analysis-lab.js` (colouring, cliques, Chaitin allocation, layouts, planarity checks,
PageRank, communities). `viz/flow-view.js`, and `GraphView.bipartiteLayout`, which was added
because a matching drawn on a ring is unreadable.

Content is split per **quarter** of the milestone — `-flow` (14.1-14.3), `-flow-cost` (14.4-14.5),
`-matching` (14.6-14.7), `-graph-analysis` (14.8-14.10).

Tests: `flow-modules.test.js` (30 property tests, every family against an independent oracle) and
`worked-examples-flow.test.js`, `-flow-cost`, `-matching`, `-graph-analysis` (44 figure tests).

### Nine bugs the module work found, all fixed

1. **The push-relabel global relabel was unsound.** It set every vertex unreachable from the sink
   to height 2n, which the main loop treated as "stuck", so excess that has to drain *back to the
   source* was abandoned — the run finished with vertices still holding excess and the height
   invariant violated, while the reported value came out right anyway. It now relabels in three
   groups: distance to the sink, n plus distance to the source, and one common height for anything
   in neither. Verified across 20 seeds × 2 rules × 4 heuristic combinations.
2. **`checkHeights` must skip arcs out of the source.** `h(s) = n` is a boundary condition, not a
   constraint, and the standard formulation excludes those arcs.
3. **Cycle cancelling sliced the wrong side of the parent walk.** `closeCycle` returned the tail
   *leading into* the cycle rather than the cycle, so it cancelled arcs that were on no cycle and
   corrupted the flow — costs came out *below* the true optimum, which is impossible for a valid
   flow and is what gave it away.
4. **`checkOptimal` scanned reduced costs against a potential the algorithm only maintained on
   reachable vertices**, so it reported violations on provably optimal flows. It now checks the
   theorem instead: a flow is minimum-cost for its value exactly when its residual has no
   negative-cost cycle.
5. **Min-cost flow looped for ever on a negative-cost cycle.** That instance has no minimum at all;
   `successiveShortestPaths` now detects it in the one Bellman-Ford pass it already runs and
   returns `{ refused }`. `cycleCancelling` grew a `cancelLimit` backstop.
6. **The segmentation generator had no noise**, so the smoothness slider changed nothing at all
   under a caption about robustness. It now flips `noise` per cent of pixels and carries a `truth`
   array, and the misclassified count falls 10 → 0 as smoothness rises.
7. **`randomNetwork` and the min-cost-flow general network left the sink unreachable**, so the
   panels read "value 0" and "0 units at cost 0". Both now wire a spine or a fan first.
8. **`greedyNoResidual` marked vertices on push**, which makes the middle arc of the classic
   counter-example unreachable and the counter-example silently succeed. It now backtracks properly
   and marks on expansion, and the natural edge order is the one that fails.
9. **`tools/wire-section.js` duplicated a section on re-run.** Wiring is three separate writes, so a
   failure in the second left the first applied. It now refuses on an id already present, and
   accepts `group:<milestone>` to seed an empty milestone group.

### The tool bug that would have poisoned the content

**`tools/section-dump.js` only fired `change`.** A `range` or `number` control listens for `input`,
so every control override on a slider silently dumped the *default* settings under a command line
that asked for something else. It now fires both. This was found while checking the claim that one
more scheduling conflict makes the 14.7 instance unsatisfiable — the dump kept reporting the
satisfiable default at every setting. Any figure written from a slider override before this fix is
suspect; the M14 figures were all re-derived after it.

### Four claims that turned out to be false, and are now taught as false

- **"Dropping the dangling mass makes the PageRank ranking drift"** — the milestone spec's own
  senior insight — is wrong. Over **4 589** small link graphs with dangling pages there are **0**
  strictly inverted pairs, while the worst mass leak is **85.0%**. The order survives; the numbers
  do not, which makes the bug *more* dangerous than the folk description, because the output people
  eyeball is perfect. `leakSearch` runs the search and the section reports it.
- **Fruchterman-Reingold's energy does not fall monotonically.** It rises on 68 of 200 iterations
  on the grid and 82 of 200 on a scale-free graph — about a third. A finite step capped by the
  temperature can overshoot the minimum it aimed at; the cooling schedule shrinks the overshoots
  rather than preventing them. The spec's lab asked for a monotonicity test; the exercise asserts
  determinism and a falling endpoint instead, which are true.
- **The two push-relabel heuristics are not additive.** Global relabelling alone does 44 relabels
  against 50 for the pair, because a gap lift raises vertices to heights the next global pass then
  corrects. Reporting only the combined 7.38× would have hidden one component doing negative work.
- **Euler's bound is not a planarity test.** It catches K5 at 10 edges against 9 and misses K3,3
  entirely at 9 against 12; only the bipartite refinement `E ≤ 2V − 4` catches the second, at 9
  against 8. Two non-planar graphs, two different arguments, and neither ever proves planarity.

### Design decisions that are easy to undo by accident

- **`contraction-hierarchies`-style deliberate breakage appears twice here.** `greedyNoResidual` is
  shipped so the 1 999 can be rendered, and `MatchingLab.naiveMatching` is bipartite-style
  augmentation on a general graph. Both are wrong on purpose and both are *rarely* wrong, which is
  the teaching: the naive matcher is short on 5 of 300 random graphs — 1.7%.
- **`oddCycleFixture` ships two orderings of one graph.** The same eight edges give 2 as found and
  3 sorted ascending. That is the section's best sentence and it is one array away from being lost:
  do not "tidy" `ODD_CYCLE_FAILING` into sorted order.
- **`AnalysisLab.build` connects the graph unless asked not to.** Three of the four spectral
  questions have a degenerate answer on a disconnected graph — Fiedler value 0, a bisection that
  cuts nothing, betweenness undefined across components — so an accidental isolated vertex silently
  replaces the demonstration with a trivial one. `connect: false` is how the disconnected case is
  still testable.
- **The exact chromatic number is capped at 18 vertices.** The search costs roughly 4× per two
  vertices — 47 ms at 18, 180 ms at 20, 754 ms at 22 — and an interactive demo cannot pay 3 s on a
  slider move. Above the cap the metric reads "not run" and says why, which is itself the point.
- **`checkAllocated` excludes spilled vertices from the colouring check.** A spilled vertex holds no
  register, so feeding it in as one more colour makes every pair of spilled neighbours look like a
  conflict — the opposite of what happened.
- **A metric id `x` owns the element id `x-note`.** Three collisions were introduced and caught by
  `tests/unit/template-ids.test.js` while building this milestone (`clr-clique-note`,
  `lay-planar-note`, `lay-energy-note`), plus two control/element collisions (`tsat-clauses`,
  `tsat-relax`). Run that test before the render audit; it is faster and the message is clearer.

### Measured figures quoted in the M14 examples

Every one is recomputed by `worked-examples-flow.test.js`, `-flow-cost`, `-matching` and
`-graph-analysis`, which also assert the prose still quotes it. Landmarks: a maximum flow of 22 on
18 vertices and 39 arcs whose residual has 54 arcs of which 28 are backward, with Ford-Fulkerson at
13 paths / 576 arc visits against Dinic's 10 in one phase / 247; 1 999 against 2 000 and 2 of 20
random networks short by up to 9.5%; a segmentation cut of 159 with 4 of 64 pixels wrong, rising to
242 while the errors fall to 0; five project instances at 40, 22, 12, 18 and 27 realised profit
against all 256 subsets; push-relabel at 50 relabels tuned, 369 untuned and 44 with global
relabelling alone; a min-cost curve of 1, 2, 4, 9, 18, 28 with marginals 1, 1, 2, 5, 9, 10, reached
by three methods and 720 permutations; a bipartite matching of 9 at 45, 57 and 280 units of work
with a Koenig cover of 9; Hopcroft-Karp phases 2, 2, 2, 3, 4, 4 against √V of 2.83 to 16.00 and
edge counts crossing over between 16 and 32 a side; a stable matching moving the left side's rank
from 10 to 20 with 5 better off and 0 worse; 2 against 3 on six vertices and 3 against 3 on the
same edges sorted; a 2-SAT satisfiable rate falling 100% → 5% across a ratio of 0.4 to 2.0, and a
three-literal relaxation wrongly negative on 0, 11, 46, 77, 93 and 85 of 100; greedy colourings at
5, 3 and 4 against an exact 3, with 2, 4 and 2 on a two-colourable graph; a clique of 3, an
independent set of 8 and a cover of 10 from one search, with the pivot saving 1.56× on the same 24
maximal cliques; spills of 5, 3, 0, 0 and 0 at 2 to 6 registers; crossings of 0, 70 and 0 on a grid
and 45, 268 and 96 on a scale-free graph; PageRank converging in 20 to 48 iterations against a
predicted 34 to 2 292; and Louvain recovering four planted communities exactly at modularity 0.6773
while returning nine at 0.2476 from noise.

## M15 — string algorithms and pattern matching (complete)

All eleven sections are wired, rendering, dumped and content-complete; the module and figure tests
are written and the whole tree is green. Only the human browser pass is outstanding, as it is for
M11–M14.

**What landed:**

- content, the fuzzy quarter (15.7–15.9): `concepts-strings-fuzzy.js`, `examples-strings-fuzzy.js`,
  `reference-strings-fuzzy.js`, `exercises-strings-fuzzy.js`;
- content, the text quarter (15.10–15.11): `concepts-strings-text.js`, `examples-strings-text.js`,
  `reference-strings-text.js`, `exercises-strings-text.js`;
- all eight wired into `index.html`;
- `tests/unit/string-modules.test.js` (23 tests, 15.1–15.6) and
  `tests/unit/string-modules-text.test.js` (23 tests, 15.7–15.11);
- `tests/unit/worked-examples-strings.test.js` (12), `-skip.test.js` (12), `-fuzzy.test.js` (11),
  `-text.test.js` (10).

`npm test` is green at 2 740 tests / 0 failures, `npm run lint:size` passes and `lib/tailwind.css`
is rebuilt. The size lint caught one offender on the wrap-up run: the three-way-merge exercise's
"four independent fixtures merge clean and the fifth conflicts" assertion was 52 lines because it
re-merged three of the four fixtures after the loop to check their output. Each fixture already
carries its expected `lines`, so the loop now asserts conflicts *and* lines — 46 lines, and the
trailing-insertion fixture's output is checked for the first time.

### Two real defects found and fixed while writing the tests

- `text-pipeline.js` used `settings.merges || 40`, so asking for **zero** byte-pair merges silently
  gave forty. The section's slider has `min: 0`, so a learner moving it to zero saw the default and
  the note claiming "move the merge slider to zero and it is a character tokeniser" was false. Now
  `settings.merges === undefined ? 40 : settings.merges`; at 0 merges the demo reports 1.00
  characters per token on a vocabulary of 24, and the default 60-merge figures are unchanged.
- The diff worked example claimed "4 of the 11 lines are a lone brace or a blank". The fixture has
  three `}` and two blanks — **five**. Corrected in `examples-strings-fuzzy.js`, and the test now
  counts it rather than trusting it.

### Figures worth keeping (all recomputed in the figure tests)

Naive matching 1.05 comparisons per character on English against 11.97 on the adversarial corpus,
with 191 of 3 998 alignments entering the inner loop and the first-character filter saving *no*
comparison at all; KMP slightly slower than naive on English (1.08 against 1.07) and 6.0× faster on
the adversarial corpus, with an automaton costing 40 cells on DNA and 260 on English for the same
ten states; the Z-window answering 11 of 18 positions with 14 extensions, and Fine–Wilf tight to the
character (5/8 → bound 12, one free symbol at the bound and two below; 6/9 → three classes and four).
Boyer-Moore falling 0.611 → 0.106 characters examined per character while KMP stays flat at 1.05,
with the bad-character rule deciding 1 195 of 1 374 contested shifts, and the best of Boyer-Moore /
Horspool / Sunday changing hands four times across seven corpora; Rabin-Karp 19 spurious hits at
modulus 101 and 0 at a million with the same 12 occurrences, a colliding pair in 1 536 tries against
a √M estimate of 1 000, 200 spurious hits under attack and 0 across 20 random bases; Aho-Corasick 11
matches with the output chain and 9 without — the two lost are exactly `he` inside `she` — and 4 000
comparisons at every set size from 1 to 32 patterns against 135 036 for separate scans.
Manacher 11 of 31 positions reused and 26 characters compared on "abacabadabacaba", 32 palindromic
substrings against 15 distinct, and a ratio against expansion of 1.5× on random binary but 200.5× on
a repeated character (doubling with the length); Wu-Manber agreeing with a DP reference at every k
(102/306/510/864/1 468 positions) with a flat 2.00 words per character to length 32 and a refusal at
40, a band computing 71 cells against 314 with 5 of 6 pairs refusing, and a q-gram filter whose
threshold goes negative at q = 4 so candidates per result jump 2.0 → 6.6 → 44.3 for the same 27
results; Myers 6 operations in 3 hunks against patience's 8 in 2, work tracking D not N (13
diagonals at 1% changed, 29 041 at 60%), and 1 of 5 merge fixtures conflicting.
Backtracking 1 048 576 steps against 142 for the state-set simulation at 18 characters — a ratio
growing 5.6× → 7384.3× and exhausting a 2 000 000-step budget at 20 — with the state-set peak stuck
at 4 out of 5 states, three of six patterns catastrophic (all of them nesting a quantifier over the
same characters) and 0 of 12 verdict fixtures disagreeing; Drain-style extraction giving 4 templates
from 300 lines with `GET <*> <*> <*>` covering 182, a threshold sweep of 3/4/4/4/7/7/8/8, Jaro-Winkler
scoring two different services and two different accounts at 0.956 while Levenshtein scores one name
against itself reordered at 0.059, and blocking cutting 267 records to 12 candidates without moving
precision off 50% or recall off 100%.

## The notation pass (after M15, before M16)

The Description tab was written at a reader who already reads mathematics, and the audience is a
senior engineer who may not. Two things changed, across all 146 sections then live (156 now).

**A decoder.** `content/notation.js` is a glossary of every symbol the curriculum uses, carrying
how to *say* it and what it does. `utils/notation-markup.js` escapes and annotates in one pass —
escaping first and injecting after would let the matcher chip something inside `&amp;` — and marks
the *first* occurrence of each symbol per concept, because Θ appears nine hundred times and a page
underlining all of them is unreadable. The formal line is the exception and asks for all of it,
since it *is* the notation. The panel is pure CSS (hover, tap and keyboard focus);
`components/notation-panel.js` measures which chips would run off the column and flips those to
hang from the right, because nothing in CSS can measure that.

**A reading.** Concepts grew a `readAs` field: the formal statement as a sentence you could say
out loud, rendered as "In words" directly beneath it. 578 of 1 161 concepts carry one, and every
one of the 261 formal lines using hard notation does.

Three tests hold the line, all in `tests/unit/notation.test.js`:

- every mathematical character in any registered content has a glossary entry, so a milestone that
  introduces a symbol has to explain it in the same commit;
- every formal line using hard notation carries a `readAs` (quantifiers, set operators, Σ/Π,
  ceilings, norms, Greek variables, argmin, `E[…]`, `n!`, `ln`, `lim`, `mod`);
- a reading is a sentence rather than a restatement — at least 80 characters, ending in a full
  stop.

`content/notation-local.js` pins a letter where a section fixes its meaning: α is the load factor
in the eight hashing sections, the balance parameter in scapegoat trees and the inverse Ackermann
function in disjoint sets; ε and δ are the accuracy and confidence dials across the nine sketch
sections. The rule for adding to it is in its header — pin only where the section really does use
the letter in one sense throughout.

### Two content defects the decoder exposed

- **`·` was doing two jobs.** It is multiplication nearly everywhere, but 22 formal lines used it
  as a bullet between alternatives — `zig · zig-zig · zig-zag` is a list, not a product — and one
  line had it both ways at once (`fat node O(log n · log v)`, separated from its neighbours by
  bullets). Those are semicolons now. Prose and worked-example lines still use both, so the
  glossary entry says so and tells the reader how to tell them apart.
- **Ambiguity the prose had absorbed.** `L1 ≈ 1 ns · L2 ≈ 4 ns` was a list of latencies reading as
  a product; `best[i−1][·]` used the dot as an "any index" placeholder. Both are words now.

## M16 — computational geometry (complete)

Ten sections, 156 in the tree. The modules, the harness, the scene renderer, the templates and the
controllers landed first (commits `654e8b3` through `fc1b079`); this pass added the four content
files per quarter, the module property tests and the figure tests, and wired all sixteen content
files into `index.html`.

### The shape of the milestone

Every section pairs a fast, subtle routine against something slow and obviously right, and reports
the disagreement count as a field rather than throwing:

- `orient2d` and `inCircle` against exact BigInt arithmetic (`geometry-exact.js`);
- four hull algorithms against each other *and* against an "every point inside, no reflex vertex"
  oracle, under both collinear policies;
- Bentley-Ottmann against a pairwise scan, on four fixtures built to be degenerate;
- rectangle-union area against inclusion-exclusion over every non-empty subset;
- Delaunay against an exhaustive every-triangle-against-every-vertex circumcircle check;
- two Voronoi constructions that share no code, both against a brute-force nearest-site grid;
- Sutherland-Hodgman and a convex decomposition against a 160 000-cell rasteriser;
- calipers against an all-pairs diameter scan and a 3 600-angle rotation sweep;
- Möller-Trumbore against a plane-and-edge-cross-products reference, plus a barycentric round-trip;
- SAT against a sampling oracle, and the minimum translation vector against "apply it and ask again".

### Figures worth keeping (all recomputed in the figure tests)

Over 4 000 near-collinear triples the naive determinant contradicts itself 1 121 times and is wrong
642 times; the tolerance test at 1e-12 contradicts itself **0** times and is wrong **4 000** times,
calling a real turn collinear on every one of them; the adaptive predicate scores 0 and 0, at an
escalation rate of 0.00% on ordinary points and 62.67% on the adversarial ones. Ray casting and the
winding number disagree on 44 of 441 probes at the pentagram's centre and on 0 probes for all six
simple fixtures — and on 0 for the bowtie, which crosses itself but encircles each lobe only once.
Four hull algorithms return the identical 12-vertex hull from 200 points at 789, 1 314, 1 651 and
2 400 orientation tests; at 1 024 points gift wrapping costs 16 384 tests on a cloud and 1 047 552
on a circle while the monotone chain goes 4 077 → 4 090.

A 12-segment sweep processes 24 events against 66 pairwise tests for the same 12 crossings, and
agrees with brute force on all 7 fixtures (3 segments → 1 crossing on shared endpoints, 4 → 5 on
verticals, 3 → 1 on a triple point, 3 → 2 on a collinear overlap); rectangle union is 876.00 from 9
compressed slabs and from 63 subset terms. Delaunay puts 108 triangles over 60 points with 0
empty-circle violations from 7 531 predicate calls, 0 of them exact; 60 legal flips keep the points,
the region and the triangle count and take violations to 562, the mean smallest angle from 26.79° to
18.94°, skinny triangles from 34 to 57 and sub-ten-degree ones from 18 to 37. Ear clipping gives
vertices − 2 triangles on all 6 simple fixtures at 100.00% of the area, with ear tests running 1 for
a square to 21 for a comb. Half-plane intersection and the Delaunay dual give the same 24 cells and
the same 10 660.52 of area, agreeing to 3.33e-15, with 19 unbounded cells, 0 of 900 grid points
misassigned and 0 sites outside their own cell; twelve Lloyd rounds take movement 137.675 → 14.859
and the largest-to-smallest ratio 65.6× → 3.2×, monotonically and never to zero.

Sutherland-Hodgman returns 0 vertices against 2 of the 5 concave clips and a plausible polygon at
66.7%, 66.8% and 60.0% error against the other 3, while the convex rows sit at 0.0% and 0.3% — that
0.3% being the sampler's own resolution of 0.0625 per cell. Union 9 600.0 plus intersection 2 800.0
is 12 400.0 and the exclusive-or of 6 800.0 is their difference. A buffer's disc loses 11.80% of its
area at 3 corners, 0.17% at 16 and 0.01% at 64, always inscribed and therefore always short.
Rotating calipers finds a 932.6 rectangle against a 10 058.0 axis-aligned box on diagonal data —
10.79× — and exactly 1.000 of the box on a grid, with the diameter exact against every pair and the
rectangle 0.024% better than a 3 600-angle sweep whose step is 0.0250°. Gimbal freedom drains
13.91% / 29.29% / 45.88% / 63.40% / 81.54% at pitches 15 / 30 / 45 / 60 / 75, from a baseline of
0.8103° that is *measured* rather than derived — two perpendicular nudges differ by the nudge times
√2, not twice it. 20 000 rays give 715 hits and 0 disagreements with a differently-derived reference
and 0 barycentric round-trip errors. Bresenham and rounding produce identical pixel sets on 2 492 of
3 000 lines with endpoints and pixel counts equal on all 3 000; coverage sums to 377.63 against a
true area of 377.50 with 67 of 411 touched pixels partly covered; flattening goes 8 → 110 segments
for a 256× tighter tolerance; and the SAT push separates the shapes at every overlapping separation,
where taking the direction from the centroids fails 38 of 800 pairs.

### Three module subtleties the new tests pinned down

- **`Calipers.supportOf` returns every point ON the circle, not Welzl's basis.** The basis is at
  most three points; a point set that already lies on a circle puts all of them on the boundary. A
  property test asserting `support.length <= 3` is wrong, and the section's note quoting "2 points
  sit on it" is about the diagonal fixture rather than a universal bound.
- **The diameter can differ from the pairwise scan by one ulp on tie-heavy sets.** On 60 points
  arranged on a circle there are many antipodal pairs at the same distance and the two walks can
  land on different ones. Equality holds on the section's own fixture and is asserted there; the
  property test uses a relative tolerance of 1e-9 and says why.
- **A ring whose signed area cancels to zero has no orientation to reverse.** The bowtie's two lobes
  are wound opposite ways, so `isCounterClockwise` is false for it and for its reverse. The
  orientation property test skips zero-area rings rather than pretending otherwise.

### One content figure the dumps corrected

The first draft of the containment prose claimed the pentagram fills 1 980.0 under the even-odd rule
and 3 600.0 under the non-zero rule. 1 980.0 is the *star* fixture's area — a different, simple,
eight-vertex polygon — and the section never computes an even-odd fill area at all. The step is now
the measurement the section does make: the same silhouette drawn as an 8-vertex simple ring produces
0 disagreeing probes where the 5-vertex crossing ring produces 44.

## The browser pass (M16, and a defect it found in every log-scale chart)

All ten M16 sections were opened in Chrome on `npm start`: three tabs each, every mermaid diagram
rendered, every scene canvas painted, every table populated, no metric left on a placeholder, no
console errors, and both themes correct. All ten graded exercises were then run through the **real
Worker sandbox** rather than the inline one — every solution passes (4/4, 3/3, 4/4, 4/4, 3/3, 3/3,
4/4, 3/3, 3/3, 3/3) and every starter fails (2/4, 1/3, 3/4, 1/4, 1/3, 1/3, 2/4, 0/3, 0/3, 2/3).
BigInt works in the Worker, which the `orient2d` lab depends on.

### The defect: every log-Y chart in the platform was drawing nothing

The convex-hulls chart rendered its axes, its grid, its legend and its caption — and no data. The
four series paths were `M215.867,NaN L344.508,NaN …`, every y a NaN, and the y axis carried no tick
labels at all.

`viz/growth-plot.js` built the y domain as `[config.yMin === undefined ? 0 : config.yMin, max]`.
A d3 log scale given a floor of zero **does not throw**: `makeScale` clamped the floor to
`Number.MIN_VALUE`, and then `.nice()` rounded it down to the power of ten below — `1e-324`, which
underflows to exactly zero. From that point every point maps to NaN.

**28 sections across M01 through M16 pass `logY: true` without a `yMin`.** All of them were drawing
an empty plot, and had been for as long as those sections have existed.

Nothing headless could have caught it. jsdom has no layout, so the render audit sees a populated
`<svg>` and a non-empty table; the figure tests only ever look at the numbers going *in*. It took
opening the page.

**The fix** is in one place rather than at 28 call sites: `logDomain()` forces a positive floor for
any logarithmic axis, and the y floor for a log chart is now the smallest strictly positive value in
the series rather than zero. Linear axes are untouched — the arithmetic there is identical to what
it was.

A sweep of all 154 teaching sections in the browser, before and after, went from `convex-hulls` and
`dynamic-arrays` (and the rest of the 28) carrying NaN paths to **zero NaN paths anywhere**.

`tests/unit/growth-plot.test.js` pins the invariant: a logarithmic axis is never handed a floor of
zero or below, a zero in the data cannot become that floor, and every cost-curve shape the sections
actually pass maps to finite positions. `logDomain` and `lowestPositive` are exported for it.


## M17 — numbers, bits and floating point (complete)

Ten sections, 166 in the tree. Ten algorithm modules, four harnesses, one viz renderer, ten
template + section pairs, sixteen content files, one module property suite and three figure suites.

### The shape of the milestone

Every section pairs an implementation against an oracle that cannot share a bug with it: fixed-width
arithmetic against BigInt, bit tricks against the loop they replace over *all* 2^16 low words,
bitsets against `Set`, summation against an exact BigInt sum of exactly the doubles involved, money
against an exact rational ledger, big integers against BigInt again, Miller-Rabin against a sieve,
and the generators against a two-tailed chi-squared threshold.

### Modules

`algorithms/`: `integer-ops.js`, `bit-tricks.js`, `bitset.js`, `float-inspect.js`, `summation.js`,
`fixed-decimal.js`, `bignum.js`, `number-theory.js`, `prng.js`, `id-generators.js`.
`machines/`: `number-lab.js` (17.1-17.3), `float-lab.js` (17.4-17.6), `bignum-lab.js` (17.7-17.8),
`entropy-lab.js` (17.9-17.10). `viz/bit-view.js` (bit rows, field colouring, a heat strip and the
two's-complement wheel).

Four harnesses rather than the spec's one, for the same reason M08 needed three: they answer
unrelated questions and one file would pass 1 000 lines.

### Six defects and false claims the measurements found

1. **`Random.seeded` yields only 32 significant bits**, so a sum of fewer than 2^21 of its values is
   *exactly representable* — naive summation over them scored a relative error of exactly zero at
   five separate seeds. A summation section built on that data demonstrates the opposite of its own
   claim. `FloatLab.unit` builds a full 53-bit mantissa from two draws, and the figure test asserts
   the naive error is non-trivial so it cannot regress.
2. **Carry was computed from the signed sum**, which gets the canonical case backwards: at eight bits
   (−1) + 1 is 0, inside 0 … 255, so that model reports no carry where the hardware raises one.
   Both flags now come from the bit patterns, and "0xFF + 0x01 carries and does not overflow" is
   true in the demo rather than only in the prose.
3. **A wall-clock "crossover at 64 bits"** that was pure noise: below the recursion floor both
   algorithms run the identical kernel. `crossingOf` now requires the ratio to stay above one for
   every larger size.
4. **65 537 and 65 535 do not have the same bit length** — 17 against 16 — so "identical bit lengths,
   so identical squaring counts" was false. The control is now 131 071, which is 17 bits with every
   bit set, and the claim holds exactly at both settings.
5. **A chi-squared verdict named only one tail.** RANDU scores 0.1 where 63 is expected, which is
   *too even* rather than a pass — a full-period generator enumerates rather than samples, and so
   does the Numerical Recipes LCG's low byte at exactly 0.0. `uniformityVerdict` now reports
   `uneven`, `too even` or `plausible`.
6. **The Carmichael table reported a trial-division factor in a column headed "witness".**
   `millerRabin` short-circuits on the small primes and returned 3 for 561, which is a factor and
   not a Miller-Rabin witness at all. The table now takes its witness from the rounds themselves,
   and base 2 catches all eight with the reason shown.

Two further claims were corrected against measurement rather than being defects: the add-back rate
("one input in a few thousand" → **1 in 500 034 quotient digits**, and the earlier search never
reached it at all because its divisors were single-limb), and Kahan's order-independence (it is not
exact — compensation removes the *linear* growth of the error, and four orderings agree to an ulp
or two rather than exactly).

### The measurement that refutes the folk claim

**Summing money in doubles does not lose cents.** A million transactions total to within 6.855e-5 of
a cent and round to the correct cent at every size tested. What a double loses is *equality*: across
500 independent ledgers the total differed from the exact value 442 times (88.4%) while formatting
identically every time. The cent is genuinely lost at **multiplication** — applying 8.75% puts the
product a fraction of an ulp below a half-cent tie on 1 026 of 200 000 lines, and applying 20% loses
nothing at all, with nothing about either rate saying which kind it is.

### Figures worth keeping (all recomputed in the figure tests)

Carry and overflow disagreeing on 100 + 100 at int8 (overflow only, exact 200, wrapping −56,
saturating 127) and on 100 × 100 (both, exact 10 000, wrapping 16); 128 negatives against 127
positives; SWAR popcount at 12 operations against 96 on all 85 536 checked inputs while the De
Bruijn bit scan costs 5.00 against 4.00 on the mean and 5 against 46 at the worst; 0xDEADBEEF
tracing 0x9959699A → 0x33233334 → 0x06050607 → 24. A bitset crossing at 3 906 elements — 0.391% —
with 31 250 words touched for answers of 417, 39 583 and 19 583 elements, iteration at 51 031 steps
against 1 000 000, and a sieve writing the identical 2 122 048 marks at 122.1 KB against 28.1 MB.
0.1 as 3 602 879 701 896 397 / 2⁵⁵ with all fifty-five decimal places, a gap of 1.3878e-17 either
side, 107 374 182 doubles lost to binary32, and the ladder at 1 / 2 / 262 144 for 2⁵² / 2⁵³ / 2⁷⁰.
Naive summation at 1.002e-11 against pairwise's 4.329e-15 for 1% more operations and Kahan's
7.126e-17 for four times as many; four orderings at 50 078 / 0 / 50 078 / 41 434 doubles from
exact; the one-pass variance at 2.18103808e+4 against a true 8.32836041e-2. Karatsuba at
65 536 / 13 834 multiplications and 65 536 / 49 374 total limb operations at 4 096 bits; the
add-back at 1 in 500 034 against Knuth's 3.05e-5 estimate; 561 trailing 263 → 166 → 67 → 1 for base
2; rho at 2 532 operations against trial division's exhausted 5 000 000, a speedup of 1 975 where
√11 489 279 is 3 390; the linear sieve at 921 501 marks against 2 122 048 for 4× the memory; Euclid
at 14.06 divisions a pair against Stein's 77.06. RANDU's bits 0 to 5 with periods 1, 2, 1, 4, 8 and
16 and its plane identity holding with residual 0; modulo bias predicted at 2.000× and measured at
2.219× against rejection's 1.2790 draws a sample; Fisher-Yates at chi-squared 7.0 against the naive
shuffle's 1 509.7 over a threshold of 11.0. And a random UUID at 64 pages of working set in a
64-insert window against a sequence's 14, UUIDv7 at 15 with 6 735 of 13 333 same-millisecond pairs
out of order, a 40 ms clock regression issuing 13 of 13 under waiting and 5 of 13 under refusing
with 0 duplicates either way, and a 5 000-identifier burst borrowing exactly 1 millisecond.

## M18 — numerical methods, transforms and optimisation (complete)

Ten sections, 176 in the tree. Eleven algorithm modules, two harnesses, one viz renderer, ten
template + section pairs, sixteen content files and three figure suites.

### The shape of the milestone

The milestone rests on one distinction and every section is an instance of it: the conditioning of
the **problem** and the stability of the **algorithm** are different things, and a stable algorithm
on an ill-conditioned problem still returns a bad answer without that being a contradiction. So
every demo reports both a residual and a solution error where they differ, and the pattern that
recurs is an easily computed quantity that measures agreement with what you *specified* rather than
with what you *wanted* — the residual in 18.1, "it passes through every data point" in 18.6,
"the trajectory looks plausible" in 18.8.

### Modules

`algorithms/`: `linalg.js`, `qr-svd.js`, `root-finding.js`, `iterative-solvers.js`, `eigen.js`,
`interpolation.js`, `quadrature.js`, `autodiff.js`, `ode-solvers.js`, `fft.js`, `optimization.js`.
`machines/`: `numeric-lab.js` (18.1-18.5), `analysis-lab.js` (18.6-18.10).
`viz/function-plot.js` (curves with a y clip, log-scaled contour bands with optimiser paths, and a
convergence plot that delegates to `GrowthPlot`).

Two harnesses rather than the spec's one: the linear-algebra half and the calculus half answer
unrelated questions, and one file would pass 1 000 lines.

### Defects and false claims the measurements found

1. **The exact reference for the pivoting demo was destroyed by its own cancellation.** The obvious
   derivation of the answer to `[[e, 1], [1, 1]] x = [1, 2]` solves for x₂ first and recovers
   x₁ = (1 − x₂)/e. At e = 1e-18 that subtraction cancels to exactly zero, so the "exact" reference
   came back as [0, 1] — which is the *wrong* answer, and it scored the correctly pivoted solve as
   the failure. The arrangement that survives is x₁ = 1/(1 − e), x₂ = 2 − x₁, and
   `exactTinyPivotSolution` now carries a comment saying why.

2. **Fitting a convergence order to bisection produced a confident 1.857.** Bisection halves the
   *bracket*, not the error, so its iterate errors are not geometric and the fit is a curve through
   a sequence that does not have the assumed form. Worse, 1.857 invites a comparison against
   Newton's 1.957 that means nothing at all. `convergenceOrder` now excludes steps at machine
   precision and non-monotone steps and returns null when fewer than two usable ratios remain; the
   bracketing methods report `bracketContraction` instead, which is exactly 0.5000 for bisection and
   1.0000 for false position.

3. **"RK4 makes an orbit decay" did not reproduce at the step the demo first used.** At h = 0.01
   both RK4 and Verlet hold the orbit to a part in 10⁹ and there is nothing to see. The effect is
   real at h = 0.1 over 200 000 steps, where RK4's radius decays monotonically to 0.994302 (its own
   minimum) and Verlet oscillates inside 1.000000–1.004988. The demo defaults to the step where the
   difference exists and says so in the note, and `orbitStudy` carries the reasoning in a comment.

4. **Jacobi preconditioning is a no-op on the demo's default matrix.** A uniform diagonal makes the
   rescaling exactly the identity, so the condition number and the iteration count do not move —
   and an earlier note claimed an improvement anyway. `scaledPoisson(n, spread)` was added so the
   demo has a matrix with a varying diagonal to switch to, and the note now branches on whether
   preconditioning actually helped rather than asserting that it did.

5. **The low-rank truncation error exceeded its own bound.** Eckart–Young states the optimum in two
   norms and they are different numbers: the spectral error is σₖ₊₁ and the Frobenius error is the
   root of the sum of the squares of *all* the dropped values. The demo measured a Frobenius
   difference and printed it against the spectral bound, so the table showed 2.97e-1 "exceeding" a
   bound of 2.85e-1. `lowRank` now returns `frobeniusBound` alongside `errorBound`, the table shows
   both, and the note names the units error explicitly, because it is the mistake a reader is most
   likely to make themselves.

6. **κ(AᵀA) stops climbing at high degree, and it is not the problem improving.** The ratio column
   reads 1.000 while the Gram matrix is measurable and then collapses to 0.682 and 0.000 — because
   its smallest singular value has fallen below the largest one times machine epsilon and the SVD
   cannot resolve it. The reported condition number saturates near 1/ε. The note now says the
   measurement has hit its own floor rather than letting the reader conclude the squaring stopped.

7. **The starting vector for inverse iteration was an eigenvector.** The all-ones vector is an
   eigenvector of every matrix with constant row sums — including `[[2, 1], [1, 2]]`, which the
   condition-number exercise used as a test — so power iteration started there reports that
   eigenvalue whatever the others are. Both affected exercises now start from 1, 2, … n, and the
   trap is a concept in its own right in 18.5, because it is a real bug in a three-line algorithm.

8. **The line search was described as reaching a better answer "in a fraction of the iterations".**
   It does not: on Rosenbrock both it and the best fixed step run the full 5 000, and the line
   search gets four orders further at 64 587 gradient evaluations against 10 000. The claim is now
   that it never diverges and gets further in the same iteration budget, at about six times the
   evaluations — which is the actual trade.

9. **Adaptive Simpson looks like the loser in the quadrature table and is not.** It spends 1 023
   evaluations on eˣ, against Gauss–Legendre's 4, because the integrand is smooth and the adaptation
   has nothing to find. The note now says the table measures its overhead rather than its value, and
   names the case it exists for.

10. **Two prose ratios were wrong against the measurement.** "Gauss–Seidel takes about half as many
    sweeps as Jacobi" — measured 2 711 against 7 621, which is 2.81× — and "the central-difference
    column is off by around 10⁻⁸", which ranges from 4.2e-11 to 2.2e-8 across the four fixtures.
    Both now quote what the measurement says.

### Figures worth keeping (all recomputed in the figure tests)

A residual pinned at ~1e-16 across κ = 1 → 1.07e16 while the relative error goes 1.65e-16 → 1.89e-1,
and the Hilbert ladder at κ 5.24e2 → 1.73e18 with the error reaching 2.01e0 and the residual still
2.04e-16. Five root finders on x³ − 2x − 5: bisection 41 iterations / 43 evaluations / contraction
0.5000, false position 31 / contraction 1.0000, Newton 6 / 12 / order 1.957, secant 8 / 9 / order
1.580 (the cheapest in the table), Brent 9 / 10. Newton on x³ − 2x returning the wrong root from 3
of 9 starts, flipping between 0.8150 and 0.8165 where f′ vanishes at √(2/3) = 0.816497; the fixed
points |g′| = 0.3820 converging in 28 and 3.2361 never. Pivoting: growth 1e18 and answer [0, 1]
without, growth 1 and [1, 1] with, one swap; Wilkinson attaining 2ⁿ⁻¹ exactly at every size with
zero swaps; the inverse at 8.4× the factorisation's error. Jacobi 7 621 / Gauss–Seidel 2 711 / SOR
271 / CG 40 at size 40, with the ω sweep finding 153 at ω = 1.85 against 2 163 at ω = 1; the scaled
matrix at κ 1.75e7 → 6.81e2 and CG 196 → 40. κ(A) 2.15e7 against κ(AᵀA) 4.63e14 at degree 10 with
the ratio 1.002; QR at 6.92e-15 against the normal equations' 1.31e-10 there and 3.77e-16 against
2.28e-8 at degree 14; orthogonality loss 1.023e-1 / 2.164e-10 / 2.337e-15. Power iteration 33 at a
gap of 0.5 and 1 802 at 0.99 against predictions of 33 and 2 291; shifted inverse at 10–24 for every
eigenvalue including the smallest; QR in 37 sweeps; Wilkinson's polynomial moving a root 3.906e-8 at
n = 5 and 9.051e-1 at n = 20. Runge at 4.384e-1 → 2.572e+2 for 5 → 25 nodes against Chebyshev's
8.166e-3 and a spline's 1.926e-3; overshoot 0.1094 below and 0.1078 above against the monotone
cubic's 0.0000, both interpolating to 1.1e-16. The V curve at h = 1e-8 / 2.97e-9 forward and
h = 1e-5 / 1.11e-11 central against √ε = 1.49e-8 and ∛ε = 6.06e-6, complex step exactly 0;
Gauss–Legendre 9.33e-10 in 4 evaluations against Simpson's 2.326e-6 in 9, exact at 2n − 1 and not
2n; autodiff exact on every fixture at 9.60× less work than forward mode on 24 inputs, with the tape
for sin(xy) + eˣ giving 2.619990 and 0.347128 from six nodes. Orders 0.998 / 1.996 / 3.995 / 2.000;
the orbit at RK4 → 0.994302 (drift 5.73e-3) against Verlet inside 1.000000–1.004988 (2.46e-5), and
5.56e-9 against 2.50e-9 at h = 0.01; stiffness limit 2.000e-3, 500 explicit steps against 10
implicit at 50× the limit. Butterflies exactly (n/2)log₂n — 1 024 against 65 536 at n = 256, a 64.0×
saving, agreeing with the naive DFT to 2.89e-12; round trip 1.29e-12 at n = 65 536; windows at 74× /
642× / 22 244× / 54 709× with Hamming *below* Hann on distant rejection; aliasing folding 4 of 8
components, 1 100 Hz onto 100 Hz; convolution at 96 butterflies against 48 schoolbook operations, so
the crossover is above these lengths. Rosenbrock: fixed 0.01 diverging to 4.146e+35 in 5 iterations,
fixed 0.001 reaching 3.761e-3, line search 9.105e-7 at 64 587 evaluations, BFGS 4.251e-21 in 36,
Newton 3.744e-21 in 22; the stability cliff at 1 834 / 1 016 / no convergence / diverged in 79 /
diverged in 14; conditioning 2 / 30 / 75 / 279 / 841 / 1 439 / 9 244 for descent against 2 for
Newton throughout; coordinate descent 2 iterations aligned and 68 rotated.

## M19 — randomised and approximation algorithms (complete)

Nine sections, 185 in the tree. Eight algorithm modules, two harnesses, no new viz renderer
(`ErrorBandView` and `GraphView` covered every chart), nine template + section pairs, twelve
content files, one property suite and three figure suites.

### The shape of the milestone

Every section is arranged around the same discipline, and it is the reason the milestone exists:
**a bound, an expectation and a measurement are three different numbers, and they are routinely
printed in the same column.** So every table names which it is showing, every ratio is measured
against an exact optimum from an enumeration oracle rather than assumed, and every tight instance
is generated rather than described.

### Modules

`algorithms/`: `karger.js`, `monte-carlo.js`, `mcmc.js`, `fingerprinting.js`, `approximation.js`,
`lp-rounding.js` (including a tableau simplex with Bland's rule), `fptas.js`, `derandomize.js`.
`machines/`: `randomized-lab.js` (19.1-19.5), `approx-lab.js` (19.6-19.9, plus every exact oracle).

Two harnesses rather than one because the repetition studies and the exact-optimum studies answer
unrelated questions, and one file would pass 1 000 lines.

### Defects and false claims the measurements found

1. **The set-cover "tight instance" was not tight — greedy solved it in one set.** The first
   construction was a chain of halving sets over two rows, and the largest chain set covered the
   entire universe, so greedy paid 1 against an optimum of 2. Vazirani's weighted family replaced
   it: n singletons priced at 1/(n − i) plus the whole universe at 1 + ε, where greedy pays
   *exactly* H(n) — 5.4331 at n = 128, matching the harmonic column to every digit.

2. **The vertex-cover trap instance was too small to show the effect it exists for.** At k = 8
   highest-degree greedy scored 1.50 against the matching algorithm's 1.75, which is the opposite
   of the lesson. The ratio grows like H(k) − 1, so the demo sweeps k up to 200; the curves cross
   around k = 20 and reach 3.82 against 1.98 at k = 100. The optimum was confirmed to be k by
   computing the maximum matching and invoking König, rather than asserted.

3. **A fingerprint collision rate of zero was about to be quoted as agreement with the n/p bound.**
   Two sequences differing in one position have a *monomial* difference whose only root is base
   zero, which is never drawn — so the measured rate is 0 at every field size while the bound reads
   1.0 at p = 101. `adversarialPair` now builds the worst case: choose the bases to defeat, expand
   the polynomial with exactly those roots, and use its coefficients as the difference. That
   measures 0.08575 against a bound of 0.0792. The demo shows both columns side by side, because
   the contrast is the teaching.

4. **The dimension sweep showed the grid winning in every dimension, which is backwards.** The
   integrand was a product of sines, and the midpoint rule integrates a full period *exactly* — so
   the grid column read 1e-15 at d = 12 and the curse of dimensionality was invisible. A product of
   exponentials has a non-zero second derivative everywhere, and the grid error then climbs
   2.48e-9 → 7.98e-2 across d = 1 to 8 while the sampled error does not move. The Monte Carlo
   column is also averaged over 20 seeds, because one seed made the crossover column jump around.

5. **The "inside its 95% interval" column reported NO for two correct estimators.** A single run's
   coverage flag is a coin weighted 19 to 1, and every estimator in a row shares the seed stream, so
   one bad draw hits several at once and looks systematic. `intervalCoverage` replaced it with
   coverage over 200 seeds: 96.0%, 96.0%, 95.0% — and 100.0% for the stratified estimator, whose
   interval comes from the stratum width and is genuinely conservative.

6. **Karger's bound looked sixty-six times too pessimistic, and it is exact.** The demo was
   measuring "found *a* minimum cut" while the theorem is about one *nominated* cut. On C12 the
   first reads 100.00% and the second 1.65% against a bound of 1.52%. `repeat()` now reports both,
   plus the count of distinct minimum cuts found — 66, which is n(n−1)/2 exactly, so the demo also
   exhibits the counting corollary rather than only quoting it.

7. **The Freivalds metric read 47.3% detection beside a bound of "at least 50%".** Sampling error
   at 400 trials, not a violation — the standard error is 2.5 points. The trial count went to 4 000
   and the note now carries ±0.8%. For a single corrupted entry the failure probability is *exactly*
   1/2 per round, so the measured 0.50850 is the bound being attained rather than respected.

8. **The FPTAS's default epsilon showed an achieved ratio of exactly 100%.** True and
   uninformative. The default moved to ε = 0.5, where the guarantee is 50% and the measured value is
   99.6452% — which is the point of the section. The sweep also exposed the fact nobody writes down:
   at ε = 0.01 the scaling divisor K = ε·P_max/n falls to 0.503, so the "approximate" table is
   514 000 cells against the exact DP's 258 640, for the identical answer.

9. **Five metric ids collided with their own note paragraphs.** `rzd-vegas` and `rzd-vegas-note`,
   `mce-rare`, `arx-tsp`, `lpr-sat`, `drz-walk` — every one a metric whose auto-generated `-note`
   span had the same id as a hand-written one. `tests/unit/template-ids.test.js` caught all five
   before the render audit did, which is why step 4 of the shape says to run it first.

### Design decisions that are easy to undo by accident

- **`spreadOf` reports `min` and `max`, never `best` and `worst`.** Which end is bad flips between
  a minimisation study and a maximisation one, and a column labelled "worst" that silently means
  "largest" is how a MAX-SAT table ends up quoting its best case as its guarantee.
- **`karger.js` ships the uniform-supernode rule on purpose.** It is the plausible misreading of
  "contract a random edge", it raises no error, and it drops the measured success rate from 34.55%
  to 23.40%. The section's claim is that the analysis is about the *distribution* and not the loop.
- **`fptas.scaleWeights` is kept although it is wrong.** It returns 6 931 against a true optimum of
  6 764 with a weight of 5 631 against a capacity of 5 465, and a value *above* the optimum is the
  only visible symptom of an infeasible answer.
- **Every approximation's feasibility is checked separately from its cost.** A cover that misses an
  edge is smaller than a valid one and flatters the ratio column; the studies report an `invalid`
  count next to the ratio for exactly that reason.
- **The MCMC width sweep keeps width 0.3, which is worse than both its neighbours.** It has the
  worst effective sample size in the table (23.2) because it crosses between modes just often
  enough to make the chain a poor predictor of itself. A monotone sweep would be tidier and would
  hide the fact that proposal tuning is a search rather than a direction.

### Figures worth keeping (all recomputed in the figure tests)

561 fooling Fermat on 318 of 558 bases (56.99%) and Miller-Rabin on 8 (1.43%), with amplification
measured at 1.385e-2, 4.000e-4 and then 0 of 20 000; a Las Vegas mean of 5.074 against 1/p = 5, a
99th percentile of 21 against 20.64, a worst of 36, and 454 of 4 000 over a budget of 10 (11.3%
against a predicted 10.7%). Two cliques joined by two edges: 32 edges, one optimal partition of
2 047 examined, 691 of 2 000 runs succeeding (34.55%) against a bound of 1.52%, the supernode rule
at 23.40%, and 3 020 contractions at the bound against 110 at the measured rate and 64 for one
Karger-Stein call across 63 recursive calls. C12 with 66 minimum cuts, 100.00% "some cut" and 1.65%
"this cut". The five estimators on the exponential integrand at 4 000 evaluations: errors 3.748e-3,
2.966e-3, 2.142e-3, 1.088e-6 and 5.214e-4, with variance factors 61.87x, 60.16x and 0.97x, and
interval coverage 96.0/96.0/95.0/100.0%; on sin squared of 10x, antithetic gives 1.41x and makes the
error 2.5x worse while the control variate gives 1.01x. The rate at 1.083e-1 → 7.898e-3 (predicted
6.767e-3) → 1.590e-3 (predicted 1.692e-3), with van der Corput at 5.115e-2 → 1.311e-5 tracking a
star discrepancy of 6.250e-2 → 1.526e-5. The dimension sweep at 2.48e-9 / 3.19e-3 in one dimension
and 7.98e-2 / 1.11e-2 in eight, crossing at d = 5. P(Z > 4) = 3.167124e-5 needing 31 574 draws a
hit, plain sampling returning 0, shift 2 at 3.907% with ESS 387.3, shift 4 at 0.121% with ESS
3 628.9, shift 7 at 15.709% with 19 982 hits and ESS 75.4.

MCMC: acceptance 92.7 / 79.1 / 43.5 / 17.1 / 6.3 / 1.2% against ESS 74.9 / 23.2 / 174.8 / 559.7 /
456.1 / 151.4 and errors 1.3849 / 0.3504 / 0.1380 / 0.0663 / 0.0687 / 0.3838; tau = 267.2 at width
0.1 giving a naive bar of 0.00557 against an honest 0.09099 (16.3x) on an error of 1.3849, a
second-mode share of 1.3% against 35.0%, and R-hat = 1.5081 over chains at −2.2719, −1.6051,
−1.4836 and +1.2352. Freivalds at 432 000 operations to multiply and 43 200 to check eight times,
with miss rates 0.50850 / 0.24550 / 0.12300 / 0.05650 / 0.03275 / 0.01575 / 0.00925 / 0.00500 and 0
false alarms; Schwartz-Zippel accepting 2 000 of 2 000 true claims and 3 and 4 of 2 000 false ones
against bounds of 0.00198 and 0.00297; fingerprints at 0 of 4 000 for a one-character difference
and 343 / 41 / 5 / 0 of 4 000 for a built pair against bounds of 0.0792 down to 8.00e-6; a Merkle
tree over 79 chunks with 7-hash proofs.

Vertex cover on 200 graphs: matching 1.5161 / 1.4286 / 2.0000, degree greedy 1.0321 / 1.0000 /
1.2857, LP rounding 1.4950, the relaxation itself at 0.8812 — with 0 bound violations and 0
infeasible answers. The trap at k = 20 / 60 / 100 giving 46 / 201 / 382 against optima of
20 / 60 / 100 while the matching cover holds at 1.90 / 1.97 / 1.98. Greedy set cover at H(n)
exactly — 2.0833, 4.7439, 5.4331 at n = 4, 64, 128 — against ln 128 = 4.8520, and 1.2330 mean on
120 random instances. TSP on 60 ten-city instances: MST/OPT 0.7326, doubling 1.1428 / 1.1520 /
1.3275, Christofides 1.0675 / 1.0635 / 1.2281. k-centre 1.0547 / 1.4313 / 1.2297 from 120 / 560 /
1 820 enumerated centre sets; list scheduling 1.1465 / 1.4074 against LPT's 1.0294 / 1.0882, and
the trap attaining exactly 1.75 = 2 − 1/4 where LPT is optimal.

LP: 150 of 150 half-integral, gap mean 1.1456 and worst 1.3333, complete graphs at 1.3333 → 1.8667
matching 2 − 2/n exactly, one instance at LP 6.00 with all twelve coordinates at 0.500 rounding to
12 against an exact 7. MAX-SAT: coin 79.00 / 79.31 / 60.00%, LP rounding 97.62 / 100.00 / 82.76%,
best-of-two the same with an 82.76% floor inside 3/4, conditional expectations 98.66 / 100.00 /
93.10%. Knapsack: exact 6 764 at 258 640 cells; ε = 0.5 giving 6 740 (99.6452%) at 10 100 cells
(25.6x smaller) with K = 25.150, through to ε = 0.01 at 514 000 cells with K = 0.503; the PTAS at
21 / 211 / 1 351 / 6 196 subsets for k = 1 to 4; weight scaling at 6 931 with weight 5 631 against
a capacity of 5 465 (over by 166); density greedy at 2 of 100 on the trap. Derandomisation: 37
edges so |E|/2 = 18.5, random mean 18.67 with 232 of 500 below the bound and a best of 26, the
conditional walk at 25, a 32-point pairwise-independent family averaging exactly 18.5000 with a
best of 24 against a full space of 65 536, an exact maximum of 28 from 32 768 assignments, and an
independence profile of 0.0000 pairwise and 0.1250 at the triple (0, 1, 2). MAX-SAT the same way:
expectation 35.00, random mean 35.10 with 178 of 500 below and a worst at 70.0%, the walk at 39
against an exact 40 from 16 384 assignments.


## M20 — NP-completeness, reductions and metaheuristics (complete)

Nine sections, 194 in the tree. Nine algorithm modules (four pre-existing, five new), three
harnesses, no new viz renderer — `ErrorBandView` and `GraphView` covered every chart — nine
template + section pairs, twelve content files, two property suites and three figure suites.

### The shape of the milestone

Every section is arranged around one discipline and it is what makes the whole thing measurable:
**a hardness claim is a claim about the NO side.** A backtracking search on a planted YES instance
often finds the answer faster than the verifier checks it — the demo has a row where it does — and
nothing about the complexity class is visible there. So every comparison runs an instance with a
planted answer and an instance with a *stated structural obstruction* side by side, and the column
that carries the lesson is always the second one.

### Modules

`algorithms/`: `sat-basics.js`, `np-verifiers.js`, `instance-generators.js`, `reductions.js`
(all four pre-existing, now pinned by tests), plus `qbf.js`, `fpt.js`, `metaheuristics.js`,
`encodings.js` and `rostering.js`.
`machines/`: `np-lab.js` (20.1–20.5), `heuristic-lab.js` (20.6 and 20.8), `solver-lab.js`
(20.7 and 20.9).

**Three harnesses rather than the spec's two.** `heuristic-lab` answers "which search wins under a
budget" and `solver-lab` answers "what does an encoding cost and does the model say what you meant";
they share nothing, and one file would pass 1 000 lines. `rostering.js` is a separate algorithm
module for the same reason — the size limit wins over the spec's table.

Content is split per third of the milestone — `-np`, `-np-beyond`, `-np-solvers`.

### Eight defects and false claims the measurements found

1. **`Qbf.expandUniversals` was wrong for any prefix with more than one quantifier block.** It gave
   every existential a fresh copy per expansion, which is correct only when every ∃ follows every ∀.
   For `∃a ∀b ∃c`, `a` is chosen *before* `b` and must be SHARED across copies; giving it a fresh
   copy makes the expansion strictly weaker. On pattern `EAE` at seed 14 a FALSE sentence expanded
   to a satisfiable formula. Each existential now gets one copy per assignment of the universals
   that *precede* it in the prefix. Only the round-trip test caught this — the answer was plausible
   on most instances.

2. **`Rostering.checkNoDayAfterNight` reported a violation for every rest day** in a scenario with
   no night shift. `indexOf('night')` returns −1, which is also the rest-day marker, so
   `row[day] === night` was true on every rest day. The encoder had already been guarded; the
   *validator* had not, which is exactly the asymmetry the two-implementations discipline exists to
   surface.

3. **The reduction round-trip suite had never once completed**, and the reason is structural: the
   target solvers are exhaustive searches, so an unsatisfiable source makes them enumerate. At
   eighteen random clauses over three variables that is ~30 s per reduction. The suite now uses the
   cheapest unsatisfiable 3-CNF there is — the eight clauses that rule out all eight assignments of
   three variables — and finishes in milliseconds. **The demo is limited by the target solve, not by
   the reduction**, and both the section and the module header say so.

4. **The clique row's NO instance was measuring the sparsity, not the problem.** A sparse graph
   asked for a clique three sizes above what it has is refuted in a few dozen steps: the row read
   2.4× search-to-verify where the other three read 110× to 819×. A graph at density 0.5 asked the
   same question reads 19.1×.

5. **`hornStudy` compared Horn against Horn and showed nothing.** DPLL solves both in 1 node. It
   became `islandStudy`: six clause families of the same variable count, where the node column spans
   1 to 1 439 and the differences are structural rather than size.

6. **`kernelSweep` grew random graphs, which never demonstrates the kernel.** At k = 12 a dense
   random graph is decided by the rules or not shrunk at all. `Generators.hubInstance` builds the
   fixture kernelisation is *for* — a few hubs joined to a great many leaves plus a scatter among the
   leaves — and the kernel then holds at 13–14 edges while the instance grows from 137 edges to
   1 953.

7. **Annealing returned its own starting tour**, at every budget under a few thousand. The cooling
   rate was a fixed 0.9995, which is a random walk when the budget is 1 500: the temperature never
   falls far enough to settle. `Meta.coolingFor` now derives the rate from the *remaining budget* so
   the temperature falls a thousandfold across whatever it is given.

8. **`or-opt` was charged a full tour costing per candidate move** while 2-opt was charged a
   four-lookup delta, so the same budget bought or-opt n times less search. Both now use an O(1)
   delta. This is the commonest way a budgeted comparison is rigged without anybody intending it,
   and it was in this milestone's own code first.

Also: five `config()` functions passed the 50-line limit once the eight-bullet orientation arrays
were written; hoisting the array into its own `orientation()` fixed all of them without touching a
byte of prose. Two template id collisions (`rdx-steps` against its own `-note`, `saz-php` against a
metric) were caught by `template-ids.test.js` before the render audit ran, which is why step 4 of
the shape says to run it first.

### Design decisions that are easy to undo by accident

- **The bundled solver is DPLL and the encoding column cannot show what it is supposed to.** It
  branches on the first unassigned variable, so the auxiliary variables an encoding introduces are
  numbered after every decision variable and never change the search order: all three at-most-one
  encodings give *identical* node counts. That is a fact about this solver rather than about
  encodings, and 20.7 states it rather than printing the column and letting a reader draw the
  obvious wrong conclusion. The propagation column is where the difference is visible.
- **`largestIndependentSet` stays a plain enumeration.** It is the oracle the gadget constructions
  are checked against, and a fast-but-subtly-wrong solver would produce a plausible answer on most
  instances. The cost is the demo's instance size, and the section says so.
- **The metaheuristic tournament reports evaluations OFFERED and evaluations USED.** Three of the
  eight methods converge and cannot spend the rest of the budget. Dropping either column turns the
  table into an overclaim in one direction or the other.
- **The cooling sweep keeps a setting that is worse than both its neighbours** (13.06 against 2.61
  and 52.23). A monotone sweep would be tidier and would hide the fact that tuning a proposal
  distribution is a search rather than a direction — the same note M19's MCMC width sweep carries.
- **`restartStudy` shares its random stream with the baseline.** The first attempt of every trial
  uses the same seed the no-restart run used, so the difference between the columns is the strategy
  rather than the seeds.
- **The feasibility frontier keeps a row the solver cannot decide.** At 5 nurses the instance is
  infeasible by a one-line counting argument and the solver exhausts its budget without a proof,
  next to a row at 4 nurses that it *does* refute. Those two rows look identical to a caller, and
  that is the section's whole point.
- **`rostering.js` holds the requirement twice, in code that shares nothing.** `encode` builds
  clauses; `validate` reads a finished grid and checks each requirement in the requirement's own
  terms. A checker derived from the encoder checks the encoder against itself.

### Measured figures quoted in the M20 examples

`worked-examples-np.test.js`, `-np-beyond` and `-np-solvers` recompute every one *and* assert the
prose still quotes it. Landmarks:

Verification 24 steps against 4 794 to refute at 12 vertices, 2n exactly across a sweep from 8 to 15
where refutation goes 369 → 28 378 at about 1.96× per vertex; 3-colouring's YES search at 13 steps
against 20 to verify, and 2 213 to refute. Nine clauses becoming 27 vertices and 54 edges, solved in
10 steps satisfiable and 4 662 unsatisfiable through independent set, 5 279 through clique and
127 382 through 3-colouring; all five reductions agreeing and validating on both answers.

Six families at 42 variables: Horn 85 clauses / 170 propagation steps / 1 node, Horn with a
contradiction 87 / 86 / 1, random 3-SAT at ratios 2, 4.27 and 8 giving 15, 30 and 53 nodes, and
PHP(6) giving 1 439 on 133 clauses. The pigeonhole family measuring **exactly** 2·h! − 1 nodes and
h! conflicts from h = 3 to 8: 11, 47, 239, 1 439, 10 079, 80 639 against 22 to 297 clauses.

Five prefixes on one 14-clause matrix: TRUE, FALSE, FALSE, TRUE, FALSE with 37, 223, 546, 277 and 46
evaluation nodes and expansions of 14, 152, 208, 78 and 264 clauses; every row satisfiable as plain
SAT. The two games at 6/19/51/127 and 6/14/30/62 nodes, TRUE and FALSE at every size on identical
clauses, with strategies of 2, 4, 8 and 16 entries.

Vertex cover on 20 vertices and 45 edges at k = 12: brute force 1 048 576 subsets, edge branching
925 nodes, degree branching 13, all returning a valid cover of 12. Fitted bases 2.0030 / 3.0163 /
1.4991 / 1.6712 across the four rule combinations, with edge branching at 127 nodes at the smallest
budget and 4 095 at the largest refutable one against degree branching's 7 and 53. The kernel at 13,
14, 14, 14, 14 edges while the instance grows 46 → 646 vertices and 137 → 1 953 edges, with 6 hubs
forced every time. Treewidth 3, 4, 6, 7, 10 giving 16 to 2 048 states per bag.

Eight metaheuristics on 30 cities at 40 000 evaluations: nearest neighbour 588.75 in 30, 2-opt
481.52 in 2 430 (6.1% of the budget), or-opt 521.42 in 9 282, annealing 486.03, tabu 489.00, genetic
552.96, ant colony 486.03, GRASP 481.52, against an MST bound of 403.41 and Christofides at 499.40.
The winner at 2 000 is 2-opt at 489.02 and at 160 000 it is annealing, with four methods tied at
481.52. Cooling at 0.00 / 2.61 / 13.06 / 52.23 giving 513.39 / 486.03 / 489.28 / 486.03, and 7
accepted moves with 0 worsening at temperature zero. Fifteen cities against an exact optimum of
327.51: five of eight optimal at a budget of 1 500, nearest neighbour 1.1646, genetic 1.0088, ant
colony 1.0604.

At-most-one priced exactly: 10 / 12 / 11 clauses at n = 5, 4 950 / 350 / 296 at n = 100, and
1 999 000 / 6 999 / 5 996 at n = 2 000 — a factor of 333. Six models of an 18-task 6-slot instance,
all agreeing with a 327-step hand-written colourer: 108 / 144 / 198 variables, 720 / 720 / 702
clauses, 1 439 nodes each, 18 010 / 21 923 / 21 150 propagations, and 1 node each with six unit
clauses of symmetry breaking. The slot sweep at 11, 47, 239, 1 439 nodes — 2·c! − 1 exactly — and 1
with symmetry breaking, collapsing to 17/19 against 12 once the answer is YES.

The phase transition at 44 variables over 60 instances per ratio: satisfiable fraction 100% down to
0%, crossing one half at 4.38; medians 10, 14, 20, 36, 134, 256, 313, 247, 137, 53 with the peak at
ratio 4.50 and a worst of 931 there; ratio 3 showing a median of 20 against a worst of 255. WalkSAT
on one instance over 40 seeds: median 1 125, mean 1 582, p90 3 724, worst 6 060; a cutoff of 1 000
giving mean 1 314 and p90 2 836 with 37 restarts, a cutoff of 3 000 doing almost nothing, and a
cutoff of 100 taking 2 666 restarts to make the mean 6 747 — **4.3× worse than no restarts**.

The roster: 8 013 clauses over 3 789 variables of which 3 600 are counters, solved in 4 707 nodes,
with 189 / 3 171 / 54 / 1 935 / 2 664 clauses carrying the five requirements and all five holding in
the produced grid. Shifts per nurse 5, 5, 5, 5, 5, 4, 2, 2, 2 — a spread of 3 the model does not
constrain. The frontier at 4 / 5 / 6 / 7 / 8 nurses: proved infeasible in 14 663 nodes, budget
exhausted at 40 000, then feasible at 6 327, 247 and 33.

"""

## M21 — online, external-memory and cache-oblivious algorithms (complete)

Nine sections, 203 in the tree. Eight new algorithm modules, four harnesses, no new viz renderer —
`ErrorBandView`, `GraphView` and `MetricGrid` covered every chart — nine template + section pairs,
twelve content files, two property suites and three figure suites.

### The shape of the milestone

Every section is arranged around one discipline: **a ratio means nothing until its denominator is
named.** A competitive ratio measured against a lower bound flatters; measured against a weaker
reference it under-states; measured as a mean rather than a maximum it inverts the ranking outright.
So every study in this milestone states what it is dividing by — an exact optimum where one is
computable, an LP bound where it is not, the best *static* order where the true offline optimum is
NP-hard — and reports the worst case with the mean beside it rather than instead of it.

### Modules

`algorithms/`: `replacement-policies.js` (FIFO, LRU, LFU, CLOCK, Belady), `adaptive-caches.js`
(ARC, 2Q, W-TinyLFU with a frequency sketch), `online-decisions.js` (ski rental, list update),
`online-scheduling.js` (Graham, LPT, balls-in-bins, consistent hashing), `bin-packing.js`
(five policies, 1-D and 2-D, exact branch and bound), `external-algorithms.js` (a DAM simulator
that *throws* when the live record count exceeds M), `cache-oblivious.js` (transpose, multiply and
the van Emde Boas layout), `parallel-primitives.js` (Blelloch, Hillis–Steele, greedy scheduling,
Amdahl and Gustafson).
`machines/`: `online-lab.js` (21.1, 21.3, 21.4), `cache-lab.js` (21.2), `dam-lab.js` (21.5, 21.6),
`model-lab.js` (21.7–21.9).

### What the measurements found

Three real defects, each caught by insisting the number be recomputed rather than quoted:

- **`vebOrder` recursed over array offsets rather than heap indices.** A subtree of a complete
  binary tree does not occupy a contiguous index range, so laying the bottom trees out by adding a
  base offset produced a permutation that measured *identically* to level order — a silent null
  result that looks like "the technique does not help" rather than a bug. `cost-model-modules`
  now asserts the layout is not level order and that its top subtree is a contiguous prefix.
- **The first-fit trap perturbed sixths UP.** A sixth, a third and a half sum to exactly one, so
  adding epsilon to each makes one of each overflow the bin — the family's stated optimum of one
  bin per group is then unreachable, and the measured 1.7083 was a ratio against a number no
  packing attains. Johnson's actual family is *sevenths*, thirds and halves, which sum to 0.977 and
  survive the perturbation: first-fit now measures 1.6667 at every size and the sorted version is
  exactly optimal. The exact solver confirms the optimum at six groups.
- **`schedulingStudy` mixed exact and lower-bound denominators**, producing an apparently violated
  LPT theorem. Filtering to the exactly-solved rows fixed it; the bound holds at 1.0455 against
  1.2500.

Two more were narrowly avoided by dumping the section at its shipped defaults: the loop-trace hit
rates in 21.2 were drafted from a development probe (81.1 / 81.9) and ship as 81.9 / 82.7, and the
two-dimensional worst-fit ratio was drafted as 1.2182 and measures 1.2143.

### The figures

Ski rental attaining 2 − 1/B at B = 2, 4, 10, 25, 100 — 1.5000, 1.7500, 1.9000, 1.9600, 1.9900 —
each on day B, against a mean of 1.6300 where "buy immediately" means 1.6430 and is 5× worse at its
maximum. Randomised: 1.5625 oblivious, 3.1428 adaptive. List update against the best static order,
on three families: do-nothing 1.2850, transpose 1.0679, move-to-front 1.2399 and frequency-count
1.0177 on Zipf; move-to-front **0.3113** on a moving working set and 1.8964 on the reverse sweep.

Page replacement on 20 000 requests over 5 480 distinct keys at 100 entries: Belady 72.6%,
W-TinyLFU / LFU / ARC 72.5%, 2Q 67.8%, FIFO / LRU / CLOCK 58.7%. On a loop of 120 keys: everything
0.0% except W-TinyLFU at 81.9%, with Belady at 82.7%. Scan resistance: LRU keeps 45% of its Zipf
hit rate once a sweep is added; W-TinyLFU 58%.

Scheduling: online worst 1.5000 against a bound of 1.7500, LPT worst 1.0455 against 1.2500, and the
trap attaining 1.7500 exactly on 13 jobs across 4 machines while sorted it is 1.0000. Two choices
holding the maximum load at 3.08 where one choice reaches 6.83 at 25 600 bins. A consistent ring's
imbalance falling 4.4696 to 1.0848 from 1 to 256 virtual nodes, moving 6.16% of keys against an
ideal 6.25%.

Bin packing on 200 uniform items with an LP bound of 63: next-fit 80 bins at 78.4% utilisation,
worst-fit 72, first-fit and best-fit 65 at 96.5%, FFD 64 at 98.0%. Against *exact* optima on 25
instances of twelve items: first-fit 1.2500, FFD 1.2000 against 11/9 = 1.2222. The tight family at
6, 12, 24 and 48 groups: 1.6667 every time, 1.0000 sorted. Two dimensions on anti-correlated jobs:
every policy worse and the spread collapsed — FFD 1.1154 to 1.1964, worst-fit 1.1795 to 1.2143,
with 20 of 68 bins full on one axis only.

External memory: the sort matching its closed form at 1.0000 across (64, 16), (128, 16), (256, 32)
and (1 024, 64) — 6 144, 4 096, 1 536 and 512 transfers — with peak-held equal to M in every row
and the fan-out 3, 7, 7, 15 giving 5, 3, 2, 1 merge passes. The bounds table at M = 4 096, B = 64:
a scan of 1 562 500 and a sort of 12 500 000 at 10^8 records, a search of 4.43, and
naive-over-scan 64× in every row. Joins at 128 000 rows a side: 128 000 transfers against 20 000,
of which 16 000 is sorting.

Cache-obliviousness: the best tile **retuned at every cache size** is 8, 16, 32, 4 at 2, 4, 16 and
64 KB, measuring 8 704, 6 144, 3 072 and 1 536 misses against the parameterless recursion's 10 240,
8 192, 4 096 and 2 048 — penalties of 1.176, 1.333, 1.333, 1.333, against an unblocked loop's
295 424 at 2 KB. The transpose at 256 × 256 and 16 KB: 73 728 misses row-major against 16 384 for
both blocked versions. Three layouts of one tree at height 18: 11.95, 12.00 and 6.65 misses per
search on 18.0 comparisons each — and at height 10 the vEB order is *worse* (2.36 against 1.97),
which is what the theory says and is not what a small benchmark would report.

Streaming: the exact set killed at item 345 of 200 000 at 8 208 bytes against a budget of 8 192,
where the complete answer needs 479 760; HyperLogLog at 11.30%, 8.38%, 4.33% and 0.73% for 16, 256,
4 096 and 16 384 bytes, the last of which is killed too; p=8 measuring 8.38% against a predicted
6.50% because the raw estimator's bias band is uncorrected, reported rather than dropped. Quantiles
as **ranks**: t-digest 0.5001 / 0.8995 / 0.9897 at 928 bytes with a worst rank error of 0.050%,
against a 1 000-item reservoir's 1.045% at 8 000 bytes. Two of five questions with no one-pass
answer at all.

Work and span at n = 256: sequential 256 / 256, Blelloch 511 / 17 (parallelism 30.1×, 2.00× the
work), Hillis–Steele 1 793 / 8 (224.1×, 7.00×). Greedy schedules of the Blelloch graph measuring
511, 39, 19 and 17 steps at 1, 16, 64 and 256 processors against Brent bounds of 528, 49, 25 and 19,
with utilisation falling 100.0% to 11.7% and the span attained exactly. Amdahl ceilings 1000×,
100×, 20× and 5× against Gustafson's 1023×, 1014×, 973× and 819× on the same four serial fractions.

Cost models: one sort of 65 536 records predicted as 1 048 576 comparisons, 10 240 cache misses,
4 096 block transfers and 256 dependent steps — a spread of 4 096× in four incomparable units, of
which only the DAM row can be validated, and it matches its simulator at 1 024 against 1 024. Four
access patterns over one 4 096-element array: a sequential scan at 12.5% misses and 1.0 bytes
fetched per byte used, strides of 8 and 64 doubles both at 100% and 8.0×, a random probe at 88.0%
and 7.0× — three of the four memory-bound on identical arithmetic.

## M22 — compression, information theory and error correction (complete)

Eleven sections, 214 in the tree. Eleven new algorithm modules, five harnesses, one new viz
renderer (`bitstream-view.js`), eleven template + section pairs, sixteen content files, two
property suites and two figure suites.

### The shape of the milestone

Every section is arranged around one discipline: **a compressed size is never reported without the
entropy of a stated model beside it.** "Three times compression" is a claim with no unit, because
the ratio is a property of the data rather than of the codec — the same codec measures 24.79× on
JSON logs and 0.889× on random bytes in this milestone's own tables. So every study names its
corpus, prints the entropy in the next column, reports expansion rather than dropping the row, and
verifies the round-trip before the size is allowed to mean anything.

### Modules

`algorithms/`: `entropy.js` (order-k estimation with the reliability of each estimate reported),
`huffman.js` (classic, canonical, adaptive, and three costings of the table), `arithmetic-coder.js`
(integer arithmetic coding with the underflow counter, plus rANS), `lz.js` (LZ77/LZSS with hash
chains and a configurable search depth, plus LZW), `deflate.js` (a full RFC 1951 decoder — stored,
fixed and dynamic blocks — and a fixed-Huffman encoder), `context-model.js` (order-k, PPM with
escapes and exclusion, an adaptive linear mixer), `bwt-pipeline.js` (BWT, MTF, RLE and the
inverses), `lossy-codec.js` (DCT, quantisation, PSNR, SSIM, generation loss), `integer-codecs.js`
(delta, zigzag, varint, bit-packing, frame-of-reference, Simple-8b, Gorilla), `checksums.js`
(parity, Internet checksum, Fletcher, Adler, CRC-32 two ways, and a CRC forgery), `ecc.js`
(Hamming, SECDED, Reed–Solomon over GF(256), erasure repair).
`machines/`: `codec-lab.js` (seven corpora, the bake-off, the Pareto sweep, the edge cases),
`coding-lab.js` (22.1–22.4, 22.6, 22.7), `lossy-lab.js` (22.8), `columnar-lab.js` (22.9),
`integrity-lab.js` (22.10, 22.11).
`viz/`: `bitstream-view.js` — a coded bitstream with per-symbol attribution, plus the arithmetic
coder's interval strip.

### What the measurements found

Four claims the measurements corrected, three of them received wisdom:

- **Canonical Huffman is not simply smaller than an explicit tree.** At 11.7% alphabet density the
  plain canonical table costs 1 024 bits against the tree's 299 — it pays four bits each for 226
  symbols that never appear. What actually makes the sparse case cheap is DEFLATE's run-length
  layer over the length array, at 178 bits, and a first implementation leaves that out.
- **Generation loss is conditional.** Re-encoding a JPEG at the same quality on the same 8×8 grid
  reaches a fixed point after ONE round — zero pixels change on every subsequent round, because
  every coefficient is already a multiple of its quantisation step. It is a crop, a resize or a
  different block alignment that keeps the damage accumulating: shifted three pixels per round, the
  PSNR falls 34.16 → 30.67 dB over five rounds. The rule is not "never re-encode" but "never
  re-encode after anything has moved".
- **A bare LZSS loses to LZW on prose.** 2.134× against 1.922×, because LZSS spends 21 bits on
  every match (a flag, a 12-bit distance, an 8-bit length) and LZW spends 12 on everything. The
  prose says so rather than explaining it away, and points at the entropy stage — which is exactly
  what DEFLATE adds and what reverses the ranking.
- **A bigger LZ window is not automatically better**, because every match pays the wider distance
  field. The window sweep prints which size won rather than asserting one.

And one defect the search caught: the burst study's pattern count used `1 << (length - 2)`, which
goes negative at length 33, so the row silently ran zero trials and reported a 0% catch rate for
CRC-32 — a number that looks like a catastrophic failure and was an empty loop.

### The figures

Entropy of 3 000 bytes of English at orders 0–4: 4.5623, 1.9578, 0.6345, 0.2235, 0.1225 bits per
byte, with floors of 1 711 and 238 bytes at orders 0 and 2. The estimator checked against six
closed forms over 20 000 symbols each — worst error 0.0110 bits, on an 8-state Markov chain. And
the row the reliability columns exist for: random bytes measure 0.036 bits per byte at order 2 over
2 944 contexts seen 1.0 times each, which would mean random data is 99.5% predictable. Three of
seven corpora fail that check and their redundancy column is left blank.

Huffman at 4.6173 bits per symbol against an entropy of 4.5623 — 1.0121×, Kraft sum exactly 1.0000
— with a per-symbol waste column that goes both ways (space +0.53, "e" −0.31). The two-symbol
sweep pins Huffman at exactly 1.0000 bits at every skew while the entropy falls to 0.0114: waste
1.00× at an even split, 12.38× at 99:1, **87.66× at 999:1**, with the arithmetic coder inside
1.052× of the floor in the same row.

Arithmetic coding at 13 688 bits against an information content of 13 687.0 — **+1.03 bits over the
whole message** — where Huffman on the same frequencies is +165.0 and rANS +25.0 (of which 32 is
the state flush). The pending-underflow counter reached 10, which is the field that is easy to omit
and produces a coder that passes short tests and corrupts real files.

LZ77's level ladder on 6 000 bytes of prose: 3 985 → 3 245 bytes and 0.22 → 2.28 chain links per
byte from depth 1 to 64 — **10.5× the work for 22.8% better compression**, with the decoder reading
1 435 tokens instead of 1 694. Lazy matching worth 4.61%. The window sweep at 64/256/1 024/4 096
bytes: 1.163, 1.426, 1.728, 1.838.

The bake-off: six codecs over seven corpora, with **two different winners** — DEFLATE at 24.79× on
JSON logs and the BWT chain at 2.841× on mixed prose, where LZSS is last at 1.740×. Every codec
expands random bytes, and DEFLATE's 0.998 against a bare entropy coder's 0.893 is entirely the
stored block, at five bytes of overhead. 66 of 66 round-trips verified, including empty input, one
byte, and a thousand identical bytes where Huffman spends 1 026 bits and the arithmetic coder 14.

Context modelling: the plain order-k model bottoms out at 3.0088 bits at order 2 and rises to
3.1418 by order 4 — sparsity, at 8.3 observations per context — while PPM with escapes keeps
falling to 1.1009 at 0.1027 escapes per symbol, which is 0.350× the plain model at the same order.
An adaptive mixture of four orders reaches 2.996 with the weights migrating from order 1 (0.7528 at
symbol 373) to order 2 (0.766 at the end), having never been told which order to use.

The BWT chain: 4.5612 bits per byte before the transform and **4.5612 after it** — identical,
because a permutation cannot change symbol counts — then 0.7405 after move-to-front, at 92.6%
zeros. Floors of 1 141, 1 141, 186 and 151 bytes. The block sweep at 64/256/1 024/4 096 bytes gives
ratios of 1.739, 2.079, 6.024 and 10.753, with the zero share explaining every one of them.

Lossy: quality 10 to 100 giving 225 to 1 820 bytes, PSNR 27.21 to 66.62 dB and SSIM 0.8207 to
1.0000 — with SSIM saturating at 0.9936 by quality 90 while PSNR climbs another 25 dB, and quality
100 measuring a finite 66.62 dB because the transform is floating point rounded back to integers.

Columnar: a sorted timestamp column at 1 080 bytes with delta plus Simple-8b against 16 000 raw,
and the same values shuffled at 3 880 — **sorting is worth 3.59×, more than any encoding choice on
the row**. Gorilla on the same random walk measures 1.32× at full double precision and 9.23×
rounded to one decimal place, 59.93× rounded to whole units, 62.02× on a constant and 1.34× on
uniform noise — every series round-tripping bit for bit.

Detection: all six detectors catch 100.0% of single-bit flips and 0.0% to 100.0% of byte swaps, a
plain sum being blind to permutation by construction. CRC-32 against five published vectors on two
implementations, and bursts searched at every position — exhaustively to 9 bits, sampled to 34 —
with the byte sum failing at 9, the 16-bit detectors at 17 and CRC-32 not at all. Then a forged
CRC: four appended bytes solved as a 32×32 GF(2) system, hitting a chosen target exactly.

Correction: **112 of 112** single-bit errors corrected with the syndrome equal to the flipped
position every time, and **448 of 448** double-bit errors detected rather than miscorrected. RS(16,
10) correcting 1, 2 and 3 errors and reporting beyond-limit at 4; repairing 6 erasures and refusing
the 7th — exactly twice the error limit from identical parity. And the durability table: RS(14, 10)
at 1.40× storage tolerating 4 losses against 3× replication at 3.00× tolerating 2, with the column
nobody quotes — 10 fragment reads to rebuild one loss, against 1.

## M25 notes worth keeping

Twelve sections: grammars and ambiguity, grammar transformations, pushdown automata, LL(1),
shift-reduce and LR(0)/SLR, LALR and canonical LR(1), general parsing (Earley, CYK, GLR), PEGs
and packrat, Pratt parsing, lexing in context, error recovery, and parsing real languages.

### The rule that shaped the milestone

**Every parser is differentially tested against Earley on the same grammar and the same inputs,
and Earley is checked against a brute-force derivation search so the reference is not trusted
either.** `machines/parse-lab.js` runs all eight parsers over every string up to a length and
reports a NAMED failing input rather than a percentage — 13 186 parser-input checks across eight
fixtures, zero disagreements. That sweep found the two real bugs listed below, both of which
would have passed any spot check.

### Modules

`machines/`: `grammar.js` (one shape, FIRST/FOLLOW with fixed points, nullable, language
enumeration, `sameLanguage`, the shared parse-tree format), `parse-lab.js` (eight parsers over one
grammar, `run`, `classify`, `sweep`, and the eight fixtures every section and test shares).

`algorithms/`: `earley.js` (chart with the Aycock–Horspool nullable fix and a cycle-guarded tree
reconstruction), `cyk.js` (CNF internally, table rows, tree), `grammar-transform.js` (six steps
and a pipeline that re-checks against the ORIGINAL grammar), `ll-parser.js` (table with a reason
per cell, `diagnose`, `conflictExample`), `lr-items.js` (closure, goto, collection, `mergeByCore`),
`lr-parser.js` (four flavours, conflict reports carrying both raw actions), `glr.js` (a real
graph-structured stack with a per-position reduction fixed point, and a shared packed forest),
`pda.js` (breadth-first over configurations, CFG→PDA), `peg.js` (packrat, ordered choice, the
unreachable-alternative check, the exponential fixture), `pratt.js` (binding-power table, both
denotations, ternary), `lexer-modes.js` (mode stack, maximal munch, the offside rule),
`error-recovery.js` (three strategies, a cost model, cascade suppression),
`real-languages.js` (ASI, the lexer hack, angle brackets, the gallery).

`viz/`: `parse-tree-view.js` (trees and forests as SVG markup), `parse-table-view.js` (LL and LR
tables as scrolling HTML with conflicted cells marked and their reason on hover).

### What was wrong before it was right

- **GLR silently lost derivations, twice.** The first version kept one back-pointer per stack top,
  so two branches shifting into the same state merged into one and half the trees vanished; the
  tree count disagreed with Earley from three operands upwards. The second version had a real
  graph-structured stack and reduced in a single pass — but adding an edge to a vertex already
  reduced from opens paths that were not there the first time, so it still lost trees. Both are
  fixed: vertices carry a list of back-edges, and the reduce sweep runs to a fixed point per input
  position. Catalan agreement with Earley to 42 trees is the check.
- **Earley rejected the empty string for `S → A A A A`, `A → a | ε`.** The classic nullable bug: a
  nullable nonterminal completes in the column it was predicted in, so a prediction made after the
  completion never learns about it. Fixed with the Aycock–Horspool rule — when predicting a
  nullable nonterminal, advance the predicting item immediately. That grammar is now a fixture in
  the sweep and a case in the graded exercise.
- **`ParseLab` was calling `LlParser.parse(built, tokens)` when the signature is
  `(grammar, tokens, built)`.** It threw, the `safely` wrapper caught it, the row reported
  `built: false`, and LL(1) was silently excluded from every sweep. The sweep count went from
  13 124 to 13 186 when it was fixed. A test harness that swallows its own errors is worse than
  no harness.
- **The PEG unreachable check found nothing.** `firstWinner` required an alternative to consume
  the WHOLE input, and ordered choice commits to the first that succeeds at all — which is the
  entire hazard. Now `("a" / "ab")` correctly reports alternative 2 as shadowed.
- **The PEG exponential fixture was not exponential.** Both the first construction and Ford's own
  expression grammar succeed on their first alternative, so nothing backtracks. The fixture is now
  `Aᵢ ← Aᵢ₊₁ Aᵢ₊₁ "z" / Aᵢ₊₁` on the input `a`: at depth 14, 606 207 plain steps against 124
  memoised, a ratio of 4 888.8 with 28 memo entries.
- **The ASI exercise starter accidentally implemented the rule it was meant to omit**, because
  `return` matched the identifier pattern in `endsExpression`. The exercises test caught it as
  "the starter passes every test, so the exercise is vacuous".
- **Two sections quoted figures their default control setting did not show.** The LR section's
  prose named twelve states and two conflicts while defaulting to a six-state grammar, and the
  transformations section quoted 6 → 33 productions while defaulting to a three-rule one. Both
  defaults were changed to the grammar the prose describes.
- **The grammars section claimed two grammars were the same language and they were not.** The
  precedence grammar has parentheses and a second operator, so it accepts `(a)` and `a*a`. The
  comparison now COMPUTES which fixtures share a language instead of asserting it, and finds
  three that do.

### Three things M25 added to the shape and worth keeping

- **A differential harness must not swallow its own errors.** `safely` turned a signature mismatch
  into "this parser is not applicable to this grammar", which is a legitimate outcome for a
  different reason — so the row looked correct and the coverage silently dropped. If a harness has
  a "not applicable" state, it needs a separate "threw" state, and the counts have to be asserted.
- **When two components produce the same kind of answer, assert the COUNT, not just the verdict.**
  GLR and Earley agreed on acceptance while disagreeing on tree counts through two rewrites. The
  acceptance sweep never saw it.
- **A section's default control setting is part of its prose.** Every figure the orientation and
  the insight quote must be visible on arrival, or the learner reads a number and sees a different
  one. `node tools/section-dump.js <id>` with no arguments shows exactly what they will see.

### Measured figures quoted in the M25 examples

- Tree counts for `E → E + E | a`: 1, 1, 2, 5 for one to four operands; 21 chart items, 6 columns.
- The transformation pipeline on the precedence grammar: 6/3 → 6/3 → 9/3 → 11/5 → 11/5 → 33/22.
- Bracket PDA: 1 state, 4 transitions; `()` 5 configurations depth 2, `(())` 7 and 3, `(())()`
  10 and 3. CFG→PDA against Earley: 31 inputs, 0 mismatches.
- LL(1): 3 productions/1 conflict/witness "a"; 4/1/"ibtx"; 6/4/"(a)". After both repairs: 4/0,
  5/1 (the ambiguous one is not fixed), 8/0. The LL(1) parse of `a + a + a` is 13 steps,
  7 of them expansions.
- LR on the precedence grammar: LR(0) 12 states 2 shift/reduce, SLR 12/0, LALR 12/0 from 22
  canonical with 10 merged, LR(1) 22/0. The SLR parse of `a + a * a` is 14 steps.
- The dangling-else conflict: state 7 on `e`, shift to 8 against reduce by `S → i E t S`, items
  `S → i E t S •` and `S → i E t S • e S`; it survives all four flavours.
- The non-LALR grammar: LR(1) 14 states 0 conflicts, LALR 13 states 1 core merged 2 reduce/reduce.
- Forest against trees on the ambiguous sum: 11/2, 24/14, 41/132, 62/1 430, 87/16 796.
- The sweep: 13 186 parser-input checks, 0 disagreements.
- Packrat at depths 2–14: memo 16/34/52/70/88/106/124 steps, plain 27/191/1 087/5 631/27 647/
  131 071/606 207, ratio up to 4 888.8× with 28 entries.
- Pratt: `a + b * c ^ d` → `(a + (b * (c ^ d)))`, depth 4, 4 calls; 18 table rows; ten asserted
  parenthesisations.
- Lexing: the nested template gives 15 tokens / depth 5 / 2 interpolations with a mode stack and
  12 / 1 / 0 without, with 0 errors either way. Indentation: 2 INDENT, 2 DEDENT, 6 LINE from
  8 lines; tab columns 0, 8, 8, 16.
- Recovery on three independent errors: stop 1 diagnostic / 1 survivor, panic 3 / 4, repair
  3 / 5 with 1 insertion. `let = = = ;` under repair: 1 reported, 1 suppressed.
- ASI: 6 of 6 cases match the specification, including the three that insert nothing.

---

## M26 notes worth keeping

Ten sections: Turing machines, equivalent models, undecidability and diagonalisation, reductions
and the Rice theorem, time complexity classes, space-bounded computation, randomised and
interactive classes, circuits and non-uniform computation, Kolmogorov complexity, and quantum
computation.

### The rule that shaped the milestone

**A limit is only worth stating once the thing it limits has been run.** Every machine is checked
against a definition written from the LANGUAGE rather than from the machine; every model
equivalence is demonstrated by executing the same function in each and comparing the answers; the
halting construction is run against 200 arbitrary candidate deciders; the interactive proof's
soundness is measured over thousands of runs against 2^-k; every Grover amplitude is compared to
sin²((2k+1)θ); and the Kolmogorov counting bound is verified by brute force over every string up
to sixteen bits.

That discipline found the two real bugs below, both of which pass any spot check.

### Modules

`machines/`: `turing-machine.js` (sparse two-way tape, three outcomes with `budget` distinct from
`rejected`, encode/decode, five programs), `model-zoo.js` (counter machine, RAM, elementary
cellular automata, 2-tag systems, SKI reduction — one interface each).

`algorithms/`: `undecidability.js` (diagonal table and machine, `defeat` against a live candidate
oracle, five mapping reductions as printable program transformations, Rice classification, the
decidability tower), `space-bounded.js` (a memory meter with hold/release so the peak is a real
high-water mark, BFS and Savitch, three graph families), `interactive-proofs.js` (graph
non-isomorphism with honest, guessing and stubborn provers, and a `soundness` sweep with a
binomial tolerance), `circuits.js` (size, depth, layers, exhaustive truth tables, seven families
including both adders), `kolmogorov.js` (four codecs, `upperBound`, `countingBound`, `verifyBound`,
`incompressibleFraction`), `quantum-sim.js` (state vector, six single-qubit gates, CNOT, phase
oracle, Grover with the analytic comparison built in, Deutsch–Jozsa).

`content/complexity-atlas.js`: fifteen problems with class, best algorithm, best lower bound and
open questions in four separate columns, and an `unconditional` flag.

### What was wrong before it was right

- **I overwrote an existing M01 section.** The M26 space section was written to
  `sections/space-complexity-{template,section}.js`, which is M01's "Space complexity and working
  set". Both files were restored from git with no diff and the M26 section became
  `space-bounded-computation`. **Check `git ls-files` for a section id before writing to it** —
  the id check I ran covered the four remaining sections and not the six already written.
- **The aⁿbⁿcⁿ machine accepted `abcabc`.** Crossing off one a, one b and one c per sweep gets the
  counts right and says nothing about the ORDER. A separate verification phase that the input
  matches `a* b* c*` fixed it, taking the machine from 15 transitions to 29. Only the exhaustive
  check over 3 280 strings found it; every hand-picked case passed.
- **The unary doubler grew its tape until the budget stopped it.** It marked its own output as
  input, so each pass doubled again. Two distinct mark symbols — one for consumed input, one for
  produced output — fixed it, and the machine is now 2n² + 4n + 2 steps.
- **`ComplexityAtlas.byClass` matched substrings.** Graph isomorphism carries the class label "not
  known to be NP-complete", and a substring test listed it UNDER NP-complete — the exact opposite
  of what the entry says. Exact match now.
- **The diagonal table had constant rows.** The first behaviour function depended only on the row
  index, so half the rows were all-H or all-L and the diagonal looked like a coincidence rather
  than a construction. A proper mixing hash gives every row and every column both outcomes.
- **The Grover "peak" was the maximum over the run.** Grover is a rotation, so at three qubits an
  iteration well past the optimum edges ahead of the first peak — reporting that made the formula
  look wrong when it is exactly right. The demo reports the probability AT the predicted
  iteration, which is what the formula claims.
- **Two exercises were vacuous.** The interactive-proof starter leaked the verifier's secret
  choice and the test's prover ignored it; and the Kolmogorov starter omitted the literal codec,
  which turns out never to change the compressed COUNT at these lengths. The first was fixed by
  making the prover exploit a leak when offered one; the second by having `verifyBound` also
  report the worst case over all strings, which the literal codec bounds at exactly n.

### Three things M26 added to the shape and worth keeping

- **Check that a section id is free before writing the file, not after.** `git ls-files
  --error-unmatch src/js/sections/<id>-template.js` answers it in one command, and the prefix
  check I did run (`grep` for the control-id prefix) would never have caught a whole-section
  collision.
- **A simulator for a model that may not terminate needs three outcomes, not two.** `halted`,
  `rejected` and `budget` are different facts, and collapsing the third into the second makes a
  computability demo teach the opposite of the truth. This is the same lesson as M25's "a harness
  must not swallow its own errors", one level up.
- **When a formula predicts a curve, compare against the formula at the point it predicts.**
  Reporting a run maximum instead of the value at the predicted iteration made a correct
  implementation look wrong. Ask what the closed form actually claims before deciding what to
  measure.

### Measured figures quoted in the M26 examples

- aⁿbⁿcⁿ: 16, 37, 66, 103, 148 steps for one to five triples, using 5, 8, 11, 14, 17 tape cells;
  29 transitions over 9 states; 3 280 strings checked with 0 disagreements.
- Palindromes: 511 strings up to length 8, 0 disagreements. Increment on `1011`: 8 steps.
  The machine encoding is 116 characters and round-trips.
- Doubling in three models: RAM 2 steps at every input, counter machine 3n + 1, Turing machine
  2n² + 4n + 2 — 2, 31 and 242 at n = 10, all answering 20.
- SKI: `SIIx` to `xx` in 3 steps, `S(K(SI))Kxy` to `yx` in 5. The 2-tag system halts in 24.
- Undecidability: 200 of 200 arbitrary deciders defeated by a 6-line construction. Bounded
  halting over five machines decides 1 of 5 at a budget of 10 and 4 of 5 at 200 and at 2 000.
- Rice: 4 of 10 properties undecidable, 4 syntactic, 2 trivially semantic; 5 reductions.
- Time: at n = 40, n log n is 213 operations, n² is 1 600, n¹⁰ is 1.05 × 10^16 and 2ⁿ is
  1.10 × 10^12; 2^60 is 1.15 × 10^18, about 36 years at a billion per second. A thousandfold
  faster machine buys ten more inputs: n = 44, 54, 64, 74 at 10^6, 10^9, 10^12, 10^15 ops/s.
  The atlas has 15 problems, 8 with unconditional bounds and 8 with a genuine open question.
- Space: BFS against Savitch on paths — 8/4 against 12/18 at n = 4, 24/8 against 27/417 at 8,
  48/12 against 48/9 325 at 12, a time ratio of 777.1×. BFS memory against the Savitch bound:
  24/27, 384/108, 2 048/192, 10 240/300 at 8, 64, 256, 1 024 vertices.
- Interactive proofs: measured 0.50500, 0.25400, 0.06600, 0.01350 against 2^-k of 0.5, 0.25,
  0.0625, 0.015625 over 2 000 trials per row, all within three sigma. The honest prover is
  accepted 500 of 500 at eight rounds.
- Circuits: ripple carry 5/3, 13/7, 21/11, 29/15 at widths 2, 4, 6, 8; lookahead 6/3, 15/3, 28/3,
  45/3. OR over 16 bits: chain 15 gates/depth 15, tree 15/4, unbounded fan-in 1/1.
- Kolmogorov: the counting bound at (10,1) allows 511 and 2 compress; at (12,2) allows 1 023 and
  26 compress; at (16,2) allows 16 383 and 136; at (16,4) allows 4 095 and 52. Over 99% of strings
  resist every codec — 65 064 of 65 536 at n = 16. All zeros compresses to 9 bits, alternating to
  10, and the perfect-squares string to 32 (the literal).
- Quantum: Grover peaks at 1.0000, 0.9613, 0.9992, 0.9966 at the predicted iterations 1, 3, 4, 6
  for 2 to 6 qubits, matching sin²((2k+1)θ) to within 1.7 × 10^-15. Past the optimum at four
  qubits it falls 0.961 → 0.582 → 0.125. Deutsch–Jozsa gives exactly 1.000000 and exactly
  0.000000 in one query against a classical worst case of 2^(n−1) + 1.

---

## M27 notes worth keeping

**The measurements the sections turn on.** Every one is produced by the module and asserted by
`tests/unit/worked-examples-lambda.test.js`, which recomputes it *and* checks the prose still
quotes it.

- **27.1** `(λx. λy. x) y` reduces to `λy'. y` with the rename logged; the naive answer `λy. y` is
  the identity and the right answer is a constant function. Five strategies on `(λx. λy. y) Ω`:
  normal, call-by-name and head reduction finish in **1 step**, applicative and call-by-value
  spend the whole budget at 50, 200 and 2 000 with the term unchanged. Factorial through Y:
  9, 34, 159, 838, 5 057, 34 938 β-steps for 1, 1, 2, 6, 24, 120.
- **27.2** Bracket abstraction sizes, plain against optimised: `λx y. x` 3 → 7 → 1;
  `λf x. f (f x)` 7 → 35 → 11; `λx y z. x z (y z)` 10 → 61 → 1; `λa b c d. a b c d` 11 → 107 → 1.
  All 7 fixtures agree with their lambda terms by α-equivalence.
- **27.3** `(1 + 2) * (3 + 4)` gives 21 in 3 steps under both orders with different middle terms.
  The eager-`if` variant gets stuck after 2 steps on `if iszero 0 then 1 + 1 else true + 1` and
  has **2 applicable rules** there. Small step and big step agree on 8 of 8 fixtures.
- **27.4** The exhaustive sweep: 215 terms of depth one, 64 well-typed, 0 stuck, 24 rejected that
  would have run. With 2 000 sampled deeper terms: 224 / 0 / 99 of 1 991, 400 preservation steps
  and 0 type changes.
- **27.5** The let-polymorphism fixture: 13 rule applications, 12 equations, 9 fresh variables,
  `Pair Number Boolean`. The lambda-bound version is rejected with a clash.
- **27.6** Inhabitants: 1, 1, 2, 0, 0 for `∀α. α → α`, `∀α β. α → β → α`, `∀α. α → α → α`,
  `∀α. α`, `∀α β. α → β`. Erasure: 12 → 5, 20 → 5 (identical erasures), 51 → 27, 23 → 9.
- **27.7** 2 unsound pairs found by search, storing a Double and an Integer respectively; the
  invariant declaration rejects both.
- **27.8** `Eq (List (List Int))` → `dEqLista(dEqLista(dEqInt))`, 3 dictionaries at depth 3;
  `Ord (List Int)` with superclasses → 5. 6 of 9 goals resolve.
- **27.9** Witnesses `cons(false, nil)`, `blue`, `true , false`. Heuristic sizes 13, 9, 9, 13 on
  the four-clause three-column matrix, all reaching 4 clauses.
- **27.10** 3 correct programs with proofs that fail, 0 proofs that pass while execution fails.
  wp blow-up 20, 58, 142, 326, 726, 1 590, 3 446.
- **27.11** 12 programs × 4 disciplines, separating on exactly 2 rows: `leak` on weakening and
  `useTwice` on contraction.

### Bugs the process caught, and what found them

- **GLR-style silent loss, again in a new place: the number-first read-back.** `λt. λf. f` is
  Church FALSE *and* Church ZERO — the two encodings picked the same term — so reading numerals
  first reported three booleans as `0`. Found by `tools/section-dump.js`, not by a test. The fix
  reads each result at the kind its encoding claims and *marks the overloaded rows* rather than
  hiding them, which turned a bug into the section's argument for types.
- **The evaluation context was not value-gated.** `E ::= E + e | v + E` is the textbook
  definition, and the `v` is load-bearing: without it, enumerating every permitted step finds two
  at any term with two reducible operands, so the standard rules were non-deterministic *as
  rules* while the implementation happened to be deterministic. The dump reported
  "Deterministic = NO" at the default setting. Determinism is now checked by `allSteps`, which
  enumerates rather than trusting the stepper.
- **`divisionNoBound` verified over the naturals.** Restricting the bounded checker's domain to
  `[0, 6]` silently proves invariants that hold only because nothing could go below zero. The
  default domain is now `[-2, 5]`, and both results are shown in the section as the honest limit
  of a bounded check.
- **The default control setting made the heuristic table uniform.** The pattern-matching demo
  opened on a two-clause match where all four column heuristics give 3 nodes, so the section's
  central claim had no visible support. Changed to the four-clause three-column matrix, where
  they give 13, 9, 9 and 13.
- **Two exercises were vacuous and one solution was wrong.** The instance-resolution starter's
  "two-way match" bug was never exercised by any test (the constructor names differed first), so
  the starter passed; the exhaustiveness solution produced a legitimate witness that was not the
  one the test named. Both were found by `tests/unit/exercises.test.js`, which asserts the
  reference solution passes *and* the starter does not.

### Three things M27 added to the shape and worth keeping

- **The sandbox hands a graded test exactly one value.** There is no `helpers` argument. An
  exercise that needs several functions must expose them through one entry — `function lab() {
  return { … }; }` with `entry: 'lab'` — and the tests unpack it. Writing tests against a
  `helpers` parameter that does not exist costs a rewrite of every assertion.
- **A search's witnesses are the thing to test, not its count.** `unsoundWitnesses` and the
  exhaustiveness checker both return values; the module tests verify each one independently
  (the stored value really is accepted by the wide view and refused by the narrow one; the
  pattern witness really matches no clause). A count is not evidence that the search works.
- **When a claim is only true under a side condition, compute the side condition.** The
  inhabitant enumerator builds abstractions and variables and never applications, so its count is
  complete exactly when every argument position of the type is a bare type variable.
  `enumerable(type)` says so, the metric prints it, and the test asserts it — rather than the
  section quietly claiming five counts of which two would have been wrong on a different type.

---

## M28 — compiler front end: build a language (complete)

Nine sections, 278 in the tree, and the compiler track opens. Twelve modules in
`machines/berugo/`, one new viz renderer (`viz/ast-view.js`) with its own stylesheet
(`src/css/viz-compiler.css`), nine template + section pairs, twelve content files, one property
suite and one figure suite.

### The shape of the milestone

Every stage is a pure function of the one before it, and that is asserted rather than intended: the
whole pipeline runs twice on every conformance program and five artefact fingerprints are compared.
Comparison is by fingerprint rather than deep equality because the artefacts are cyclic — a binding
points at its scope, a scope at its bindings, a reference at the node it came from — and a
structural comparison either loops or has to be told which edges to ignore, which is how it stops
seeing the change it was written to find.

The second discipline is the one that earned its place: **a claim about a stage is checked by
running it.** Five defects in this milestone looked correct in the source, two carried comments
arguing they were right, and every one was found by execution.

### Modules

`machines/berugo/`: `spec.js` (the machine-readable language: 11 features with four rules each, 17
conformance programs, a 12-program error suite, 5 non-goals, and the cost table), `lexer.js`
(spans, trivia, error tokens, interpolation modes, incremental relex), `ast.js` (30 node kinds, one
children table, the shared precedence table, the minimal-parenthesis printer and its deliberately
broken variant), `parser.js` (recursive descent plus Pratt, total, error nodes), `resolve.js`
(scope tree, occurrence-keyed binding table, capture analysis, suggestions), `typecheck.js`
(bidirectional over Hindley–Milner, both spans on every mismatch, a type per node), `desugar.js`
(four switchable lowerings with hygiene by construction), `diagnostics.js` (catalogue, three
suppression rules, machine-applicable fixes), `interp.js` (the reference interpreter over surface
AND core, with three outcomes), `ide.js` (hover, definition, references, completion, a rename that
verifies itself), `fuzz.js` (grammar-driven generator, four properties, the sabotage runner),
`pipeline.js` (stage runner, fingerprints, purity, and the three suites).

`viz/ast-view.js` renders trees, source with marked ranges, token chips and diagnostics as HTML —
the useful thing is the correspondence between a node and a range of characters, which wants
selectable text and a `data-span` per row rather than eighty circles.

### What was wrong before it was right

Every one of these was found by running something, and none by review.

- **A conformance program made itself recurse forever.** `a + b` lowered to a call named `add`, and
  the conformance suite contains `fn add(a, b) { return a + b; }`. The core called the user's
  function until the stack ran out. Three more captures of the same family followed once the first
  was found — `len`, `is_some`/`payload0`, and `unmatched` — and the fix is not a longer prefix but
  a character the lexer will not accept at the start of an identifier: every generated name now
  begins with `$`, so collision is impossible rather than unlikely.
- **The `for` lowering read one element past the end.** It advanced the index at the top of the
  body behind a first-iteration flag, so the guard `i < len(xs)` was tested against the index from
  *before* the advance. There is exactly one safe placement: bind the element, advance, then run
  the body. Nothing between those two points can be skipped by any control flow the language has,
  and no flag is needed — which is the usual sign a placement is right.
- **`&&` and `||` lowered to strict calls.** A call evaluates its arguments, so
  `d != 0 && 10 / d > 1` — the idiom written precisely because the right side is unsafe when the
  left is false — divided by zero in the core and not on the surface. They lower to `if`, the only
  core form that does not evaluate one of its branches. The first fix only repaired `||`, because
  membership was tested with `if (SHORT_CIRCUIT[op])` and `&&`'s value in that table is `false`.
- **The type checker crashed on every function containing a `let`.** `checkFunctionBody` stored a
  sentinel in the type ENVIRONMENT under a reserved key, and generalisation walks every key and
  reads a scheme off each value. Fifteen conformance programs were green because not one of them
  had a `let` inside a function. The fix was the sentinel, and the *other* fix was a sixteenth
  program: a coverage gap cannot be closed by a better assertion.
- **Ten nodes per conformance run carried a span with no end.** `spanFrom(start, end)` read
  `end.end`, and several call sites pass a NODE, which carries its end inside `span`. The nodes
  looked fine in the tree and underlined nothing. A crash gets fixed the day it appears; this needs
  its own assertion, and it now has one over every conformance program and every mutated file.
- **The type table stated something false on the error path.** `check` recorded the EXPECTED type
  whether or not the constraint solved, so hovering the `Bool` in `n + flag` reported `Number`. On
  success the two are the same type after substitution, so the bug only exists on the path nobody
  exercises while building the happy case.
- **A numeral running into an identifier scanned as two valid tokens.** `0x1` was the number `0`
  followed by the name `x1` — a perfectly well-formed stream for a program nobody wrote — and the
  parser then reported a missing semicolon several tokens to the right.
- **Rename accepted a rename that introduced a name clash.** Comparing the reference-to-binding
  structure catches a rename that changes what a name refers to and does NOT catch one that binds
  a name twice in a scope: the references still resolve by position, so the shape is identical.
  Comparing the resolver's errors as well closes it, and neither check implies the other.

### Design decisions that are easy to undo by accident

- **The differential comparison includes the bindings a program leaves behind.** Every conformance
  program is a list of `let`s, so its value is `unit`, and a comparison of values alone passes
  whatever the core computed — seventeen green rows proving nothing. With bindings it makes 31
  observations. This is the M22 lesson in a new unit: a ratio hides its denominator, and a
  differential suite hides its observation count.
- **Generated names are excluded from that comparison by their `$` prefix.** They have no surface
  counterpart, so the exclusion has to be exact rather than a heuristic — which is the second thing
  the hygiene prefix buys.
- **The round-trip property is always reported beside its sabotage.** A printer with one line
  changed loses 106 of 2 000; the real one loses 0. Publishing only the second is publishing a
  number whose meaning has not been established, and the rate is a few per cent rather than most
  because a sabotage that fails everything is too coarse to locate anything.
- **`brokenPrinter` lives in `ast.js` behind a `noRightParens` option**, not in the test, so both
  printers walk exactly the same code.
- **Mutation fuzzing has the weakest oracle on purpose.** It asks only that a tree came back and
  that every span lies inside the file, and that weakness is what lets it be pointed at truncated
  and corrupted files — the population an editor deals with all day and every other property
  excludes by construction.
- **The interpreter's three outcomes are `ok`, `runtime` and `budget`**, and a JavaScript
  `RangeError` from runaway recursion is classified as `budget`. Collapsing it into `runtime` would
  report a non-terminating program as a broken one, which is the M26 lesson arriving again.
- **A memoise key that contains source code is JSON, not a delimited string.** There is no
  separator a program cannot contain; a newline appears in every one. Two of the three section keys
  used `'\n \n'` and the third had acquired an invisible character in the same position.

### Three things M28 adds to the shape and worth keeping

- **A green suite is a statement about the oracles, not about the code.** After it passes, the
  useful question is not "what else could I assert" but "what is every oracle I have blind to".
  Each of the six defects above sat in some oracle's blind spot and was caught by adding a property
  that could see it — running the core, writing down a shape nobody had, comparing the bindings a
  program leaves behind — never by asserting harder with the ones already there. `testing-a-front-end`
  ships that question as a table.
- **A coverage column is worth its cost even when the gap is harmless.** Modules were implemented
  twice and run by nothing, which turned out to be fine; a `let` inside a function was also run by
  nothing, and the checker crashed on every such program. Nothing distinguishes the two from
  reading, and closing the gap is the only way to find out which you have.
- **Presence in a lookup table is `hasOwnProperty`, not truthiness.** `SHORT_CIRCUIT['&&']` is
  `false` because `false` is what `&&` yields without evaluating its right side, so the natural
  membership test sent one of the two operators down the wrong path while the source read
  identically for both.

### Measured figures quoted in the M28 examples

`tests/unit/worked-examples-compiler.test.js` recomputes every one *and* asserts the prose still
quotes it; `tests/unit/compiler-modules.test.js` carries the property tests. Landmarks: 21 units of
parser work against 25 after it, with `match` at 4 and 5 and arrays and modules at 1 and 3 for the
worst ratio of 3.00; a 138-character sample giving 26 tokens, 23 pieces of trivia and 3 error
tokens each followed by a real one; 24 of 27 tokens reused after an edit near the end of a file;
13 nodes and 1 error node for a file with two broken statements; 9 of 11 grouping fixtures printing
back unchanged and 2 losing brackets the tree never needed; 2 000 round trips with 0 failures
against 106 for the broken printer; one tree printing to 88, 100 and 82 characters and reparsing
identically all three times; 4 scopes, 7 bindings and 1 capture where `a` has 3 occurrences and 2
bindings; three mistakes checked twice where 2 of 3 move their diagnostic code and the third does
not, because the call was already where the two types met; 23 nodes lowering to 44 with the same
`total = 8` either way; 15 raw diagnostics cut to 12, all three suppressions by stage gating; 3 of
12 error programs getting a fix, 3 removing their own diagnostic and 2 leaving the file clean; and
2 000 mutants producing 0 crashes, 0 lost spans and about 71% diagnostics.

Two figures were corrected against measurement during the build, both written from the shape of the
argument rather than from the table: "operators and literals lead the parser ranking" (they are
joint second; `match` leads that one too, at 4) and "32 observations" (31).

---

## M31 — garbage collection and runtime memory (complete)

Nine sections, 307 in the tree. Ten algorithm modules, two machines
(`machines/heap-sim.js`, `machines/gc-lab.js`), one new viz renderer
(`viz/heap-map-view.js`), nine template + section pairs, twelve content files, one property
suite and three figure suites.

### The shape of the milestone

**One oracle, run at every collection.** `HeapSim.reachable` is a plain breadth-first walk that
shares no code with any collector, and the rule for every design in the milestone is that the set
it reclaims must contain no reachable object. `GcLab.replay` brackets each collection with it and
reports `wrong` as a field rather than throwing, so a broken collector shows up as a column in the
comparison table rather than as a crash. That check found **three real defects**, and all three
were reporting healthy statistics while they lost live objects.

The second discipline is **turn the mechanism off and check that it fails**. The barrier-free
generational collector, the barrier-free incremental marker, the one-entry mark stack and the
zero-depth quarantine all ship, and every one of them is asserted to be worse. A demonstration
that has never failed has not been demonstrated.

### Modules

`algorithms/`: `gc-manual.js` (quarantine, poison, the four failures and a seeded fixture whose
last fault the default depth misses), `gc-refcount.js` (retain/release, trial deletion, the cascade
and the cycle fixtures), `gc-mark-sweep.js` (tri-colour, a bounded mark stack, overflow recovery,
sweep, compaction, fragmentation), `gc-copying.js` (Cheney with an external-root scan, generational
minor collection, promotion, the survival curve at two horizons), `gc-barriers.js` (none /
remembered set / card table, the fast-path filter, and the post-collection refresh),
`gc-incremental.js` (incremental marking, Dijkstra and Yuasa barriers, the hand-built lost-object
fixture and the randomised interleaving harness), `gc-regions.js` (partition, census, garbage-first,
emptiest-first, an exact knapsack optimum and an adversarial region set), `gc-weak.js` (four
strengths, an object-keyed cache, two-cycle finalisation with resurrection, the handle-exhaustion
scenario), `heap-analysis.js` (retained size and the dominator tree over the object graph, using
M13's pass unchanged). `machines/heap-sim.js` (a recorded trace from M30's VM, a synthetic
generator, the heap and the oracle), `machines/gc-lab.js` (eight drivers behind one five-call
interface, pause distributions, throughput, sweeps). `viz/heap-map-view.js`.

Content is split per third of the milestone — `-memory`, `-memory-generational`,
`-memory-practice`.

### Six defects found by running things

1. **The generational collector never scanned an old root.** `cheney` ran every root through the
   same young filter as every other object, so an old root — the long-lived container, or an entry
   from the remembered set — was rejected and therefore never scanned. Its young children were
   unreachable to the collector and were freed while live: **16 objects**, with all three barrier
   settings producing the identical failure, which is what said the barrier was not the problem.
2. **The barrier record was cleared after every minor collection.** An old object pointing at a
   young one that SURVIVED still points at a young one, and no further store re-records it.
   `GcBarriers.refresh` rebuilds the record from the objects the collection already scanned and
   the ones it promoted, which costs no scan the pause had not already paid for.
3. **Overflow recovery left objects grey forever.** It shaded the dropped children grey itself and
   then handed the grey ids to `markFrom`, which pushes only WHITE objects — so they were never
   scanned, their own children stayed white, and **26 live objects** were swept, with `overflows`
   and `rescans` both reporting that the recovery had run.
4. **The same mark loop dropped ROOTS.** It pushed the whole root set before scanning anything, so
   a stack smaller than the root set dropped roots — and a dropped root is unrecoverable, because
   the recovery looks for a black object with a white child and a root has no parent. **Six live
   objects** at a stack limit of 2, while the rescan counter reported eleven successful passes.
   Roots are now entered one at a time and drained: the stack bound belongs to the traversal, not
   to the enumeration of the roots.
5. **The synthetic trace was not a possible program.** New objects were unrooted between their
   allocation and the store that linked them, and the sixteen-holder retained spine was built
   before any roots event at all — so a collector with a small nursery collected during the
   construction, found an empty root set, and freed the whole structure. Every later store into the
   deleted spine was then silently dropped, and the run ended with a third of the live set while
   passing the oracle at every collection. A frame holds a new value in a register, and a register
   is a root: `hold()` publishes it immediately.
6. **A finaliser ran on every cycle.** A resurrected object stayed in the queue, so its cleanup was
   called again and again. Real runtimes mark it finalised at the first call and never look again —
   which means a resurrected object is never cleaned up at all, and that is a worse outcome than a
   leak. Two related fixes: finalisation now costs two cycles (queue in one, run and free in the
   next) and everything reachable from the queue is kept, because a finaliser running against
   freed objects would be reading freed memory inside a managed runtime.

### Two dials that did nothing, and how they were caught

- **`survival` measured 0.000 at every setting from 0 to 0.5.** Survivors were linked into objects
  that were themselves rotating root slots, so the holder was overwritten a few steps later and
  took the whole subtree with it. A generational-hypothesis demo that cannot show the hypothesis
  holding cannot show it failing either. The fix is a bounded set of retained slots — a cache, a
  session table, a registry — which also gives the trace a steady state.
- **The barrier's throughput cost read 0.000 for every barrier.** The lab charged a flat unit per
  store while marking, which is the same for all three designs. It now charges the check plus the
  objects the barrier actually shades, and the honest finding is that on a trace with 262 stores
  out of 3 285 steps the barrier costs one unit — the note says so rather than hiding it.

### Where the folklore did not survive

- **"Reference counting has no pause" means "it has no COLLECTION".** Dropping the head of a
  200-node chain frees all 200 objects at that one store. The pause is still there; it has moved
  into a specific write, and which write depends on the shape of your data rather than on the size
  of your heap — which is arguably worse, because it correlates with nothing a monitor watches.
- **Incremental marking bounds the median pause and not the tail.** The p50 is the slice exactly
  (1, 8 and 64 at slices of 1, 8 and 64); the p99 is 76, 100 and 121, because the sweep at the end
  of each cycle is still one pass over the heap. "Concurrent marking" tells you which half was
  fixed.
- **Garbage-first is exactly optimal on a real heap**, which says the heuristic is fine and
  demonstrates nothing about it — most of its choices were free, because a wholly dead region costs
  nothing to take. The constructed set where it returns 73.0 per cent is what makes the comparison
  mean anything, and both optima are solved by dynamic programming rather than assumed.

### Design decisions that are easy to undo by accident

- **The stress harness draws both ends of every store from the currently reachable set.** A mutator
  cannot store into an object it cannot reach, nor publish a reference it does not hold. Drawing
  from the whole heap failed SATB on 329 of 2 000 runs with failures that were real given the
  stores and impossible in any program — SATB's correctness rests on exactly that precondition, and
  allocation is the single exception, which is why SATB collectors allocate black.
- **`survivalCurve` reports two horizons.** "Still live at the end of the window" is what a minor
  collection over a nursery of that size copies; "still live a window later" is always smaller.
  Quoting one while meaning the other is how a survival rate ends up disagreeing with the collector
  measured beside it.
- **Addresses come from a bump pointer, not from the object id.** An id-derived address overlaps as
  soon as an object is larger than the stride, and a heap whose objects overlap has no
  fragmentation to measure and no coherent card table.
- **`floatingPeak` and `uncollected` are different numbers.** One is the worst case of dead objects
  a COLLECTION left behind; the other is what is dead at the end of the run, which for a reference
  counter is its leaked cycles and for a tracing collector is mostly garbage the next collection
  has not reached.
- **The cycle collector is triggered by the candidate count, not the heap size.** A counting runtime
  never notices the memory is gone, so waiting for the heap to fill waits for a signal that may
  never arrive. CPython counts allocations for the same reason.

### Measured figures quoted in the M31 examples

`tests/unit/worked-examples-memory.test.js`, `-memory-generational` and `-memory-practice`
recompute every one *and* assert the prose still quotes it; `tests/unit/gc-modules.test.js` carries
the property tests and a regression for each of the six defects. Landmarks: a quarantine sweep at
0, 2, 2, 4 and 5 of 5 caught for 0, 8, 16, 32 and 36 bytes held; a triangle of 0 / 0.576 / 7 240
against 381 / 0.666 / 8 192 against 90 / 0.619 / 7 792, with an 8-byte header costing 12 792 of
44 608 bytes; 3 757 count adjustments over 5 101 steps reclaiming 1 354 objects and leaking 154,
taken to 8 by cycle collection at 11 pauses; 922 objects of which 89 are reachable, collected at
2 775 units with a stack of 1 against 1 011 with 64 and the same 833 reclaimed at every limit;
23 080 free bytes in 57 pieces with a largest of 5 160 against one run of 23 080; 218.0 / 367.3 /
669.0 / 1 270.0 against 162.2 / 163.7 / 165.0 / 178.0 across four heap sizes; a measured survival of
17.2 per cent; three barriers at 0 / 786 / 262 units of store cost, 0 / 349 / 655 scanned, 0 / 1 880
/ 332 bytes of table and 208 / 0 / 0 live objects freed; 15 of 2 000 and 76 of 10 000 interleavings
lost with no barrier against 650 and 1 521 floating for the two that work; a p50 of 1, 8 and 64 with
a p99 of 76, 100 and 121; eight designs where the best p99, best throughput and smallest peak are
three different rows; garbage-first at 37 760 of 37 776 on the real heap and 73 of 100 on the
constructed one; a handle limit exhausted at iteration 17 with 0.27 KB of 4 KB in use and 0
collections; a cache holding 600 bytes strong and 312 weak; 84, 3 and 1 allocations all computing
820 with 70, 6 and 0 units of collector work; and a retained set flat at 2 128 bytes with a slope of
0.0 against one climbing 7 120 to 12 432 at 1 040.0 a sample, with one object retaining 12 248 of
12 432 through a 368-hop path.

### The browser pass, again

All nine sections were opened in Chrome on `npm start`: three tabs each, a rendered mermaid diagram
in every Description (4 to 8 nodes, no syntax errors), a full reference block in every References,
every chart at a real 1 030px rather than the 220px fallback, and the heap map and fragmentation
strips measured — 10 x 10 tiles over a 1 030px map, and a swept strip whose widest free run is 260px
against a compacted one at 1 167px, which is the fragmentation result as a picture.

It found a defect the render audit cannot see. `ChartBase` takes `summary` as a FUNCTION, and all
nine sections passed a string: the chart still drew, so nothing failed, and every repaint threw
`config.summaryFn is not a function` into the console while the accessibility summary was never
written. `ChartBase` now accepts either, which removes the trap for every future section.

### Four things M31 adds to the shape and worth keeping

- **An oracle that runs at the end is not an oracle.** A collector that frees a reachable object
  produces a completely plausible run: the program carries on until it touches the object, which
  may be much later or never. Three of this milestone's defects were only visible at the moment of
  collection, and two of them were reporting success while they happened.
- **A generator is part of the fixture and can be the thing that is wrong.** Two dials measured
  nothing and one trace was not a possible program. The test that caught the last one asserts a
  property of the TRACE — every allocation is followed by a roots event that includes it — rather
  than a property of any collector.
- **Turn the mechanism off and assert that it fails.** Every barrier, every bound and every
  quarantine depth in this milestone has a setting that breaks it, and the broken setting is a row
  in the table. The barrier-free generational run is faster on every column except the one that
  matters.
- **Report the unit and the horizon.** "Survival rate", "floating garbage" and "pause" each name
  two different numbers in this milestone, and each pair is reported separately rather than
  averaged into something that describes neither.

---

## Next

**M32 — Program analysis, SAT/SMT and verification (11 sections) is IN PROGRESS.** Ten of its
twelve modules are built, wired into `index.html`, and committed green; nothing of its sections,
content or tests exists yet. The spec is `doc/milestones/M32-program-analysis.md`.

### What is built and what it is verified against

| Module | State | Oracle it passes |
|---|---|---|
| `machines/solver/sat.js` | done | 400 random formulas, 0 mismatches against brute force; pigeonhole 4/3, 5/4, 6/5 UNSAT at 7, 28 and 145 conflicts with DRAT proofs verified |
| `machines/solver/check.js` | done | is the oracle: model checking, RUP proof checking, brute force, model counting |
| `machines/solver/smt.js` | done | 150 random EUF problems, 0 mismatches, every sat answer independently checked |
| `machines/solver/theories/euf.js` | done | congruence closure, minimal unsat cores by deletion |
| `machines/solver/theories/difference.js` | done | 300 random systems, 0 mismatches against brute force |
| `machines/solver/theories/linear.js` | done | 400 random systems, 0 false unsats against a fine grid |
| `algorithms/abstract-interp.js` | done | interval / sign / parity domains, widen and narrow |
| `machines/static-lab.js` | done | the dynamic soundness oracle, plus `verifyPaths` |
| `algorithms/taint.js` | done | six fixtures, plus a policy sweep pricing both failure directions |
| `algorithms/symbolic-exec.js` | done | every generated input executed and asserted to reach its path |
| `algorithms/model-check.js` | done | explicit search and BMC required to agree on the violation depth |
| `algorithms/verify-vc.js` | done | the binary-search overflow fails, the fixed version discharges 3 of 3 |
| `algorithms/race-detect.js` | done | happens-before against locksets on five fixtures |
| `algorithms/fuzzer.js` | done | found two real front-end crashes in 3 000 mutations |
| `machines/spec-dsl.js` | **not started** | — |

### Where the work is parked

The curriculum group and the first section (`static-analysis-foundations`, complete and dumping
correctly) are committed on the branch **`wip/m32-sections`**, which is deliberately RED: the
curriculum names eleven sections and only one has files, so the audits report ten `no-container`
problems. `feat/m10-sorting-and-selection` is green and has none of it.

To resume: `git checkout wip/m32-sections`, write the remaining ten template + section pairs, add
the `<section data-section=...>` containers and the script tags to `index.html`, then the twelve
content files and the tests. Merge back only once `npm test` is green.

### Section ids and prefixes, all checked free

`static-analysis-foundations` (saf), `abstract-interpretation` (abs), `taint-analysis` (tnt),
`symbolic-execution` (sye), `sat-solving` (sat), `smt-solving` (smt), `model-checking` (mck),
`deductive-verification` (dvf), `dynamic-analysis` (dya), `coverage-guided-fuzzing` (cgf),
`specifying-systems` (spy).

### Findings to build the content around

- The SAT solver's backtracking was off by one decision level, which at level 0 emptied the trail
  including the assignments made by UNIT clauses. Random 3-CNF has no unit clauses, so 400
  differentials never saw it; the BMC encoding, which pins the initial state with one unit clause
  per variable, saw it immediately. Fixing it also cut pigeonhole 6/5 from 388 conflicts to 145.
- The BMC encoding let a selector be true without its premise, so the trace teleported and reported
  a mutual-exclusion violation at depth 1 that the search puts at depth 4.
- EUF term keys built from ids do not re-parse, so the unsat-core minimisation was silently a
  no-op; and terms interned after the merges never trigger congruence.
- An SMT blocking clause matched back to the first atom with the same terms, which is the wrong one
  when two atoms share them.
- The fuzzer found `let:` and `{=` — four and two characters — crashing `Pipeline.run`, whose
  contract is to report errors rather than raise them. Guarding the two nodes moved the failure one
  node along; the fix that holds is a boundary at the stage runner.
- Widening and narrowing recover `[0, 11]` from `[0, +∞]` on a counting loop and do NOT recover the
  outer bound of a nested loop, which is a real limitation of the classic scheme and is worth
  reporting rather than chasing.

### Then

M33 — digital logic — starts the computer-architecture track. After M32 the compilers track is
complete and `doc/ROADMAP.md` gives the order.

Two debts M28 deferred are still open: mutation of captured variables (which is why `resolve.js`
records captures per function) and a decision-tree compilation for `match`. M31 added a third: the
VM still holds JavaScript object references rather than addresses into `HeapSim`, so the collectors
run against a recorded trace of a program rather than against the program itself.

M11 through M15 and M17 through M24 are complete apart from a human browser pass, which needs the
Chrome extension connected; M16 and M31 have had one. `tools/section-dump.js` covers everything
else the browser used to be needed for.

A shared helper exists for the figure tests: `tests/support/worked-example-prose.js` exports
`proseFor`, `quotes`, `fixed` and `grouped`.

The shape to copy, unchanged through M31:

1. pure modules in `algorithms/` first, behind one shared interface;
2. a `machines/` harness that drives every implementation through that interface, carrying a
   brute-force oracle whose disagreement count is a reported field rather than an exception;
3. `viz/` renderers, and the CSS classes they need;
4. `sections/<id>-template.js` + `<id>-section.js` — run `tests/unit/template-ids.test.js` first,
   it catches control/element and metric/`-note` collisions faster than the render audit does;
5. wire with `node tools/wire-section.js src/js/core/curriculum-<track>.js <after-id> <spec.json>`
   (or `group:<milestone>` to seed an empty group), then `node tests/render-audit.js <id>`;
6. **dump every section with `node tools/section-dump.js <id>` and write the content from what it
   prints.** Measure first, then write the sentence that quotes the measurement — this is where
   four of M13's six bugs, all four of M14's false claims, six of M20's eight and two of M31's six
   were found;
7. the four content files, split per third or quarter of the milestone to stay under 1 000 lines;
8. `<topic>-modules.test.js` (property tests against a brute-force reference) and
   `worked-examples-<topic>*.test.js` (recompute every quoted figure *and* assert the prose still
   quotes it);
9. `npm test && npm run lint:size && npm run build:css`, then the doc updates.

**Check every new file path is free before writing it** — `git ls-files --error-unmatch <path>`.
M26 destroyed a section this way and M32 destroyed M18's `machines/analysis-lab.js`; the new
harness is `machines/static-lab.js`. The milestone specs name files without knowing what other
milestones took.

Two things M20 added to the shape and worth keeping:

- **An eight-bullet orientation array pushes `config()` over the 50-line limit.** Hoist it into its
  own `orientation()` function; it costs nothing and preserves every string.
- **When a demo's default settings are chosen after the prose is drafted, the figures disagree.**
  Dump the section at its shipped defaults and align the prose to *that*, not to the probe you ran
  while developing the module. Five figures in M20 were written from a different graph and caught
  by the figure suite.

Three things M21 added to the shape and worth keeping:

- **A ratio's denominator is part of the measurement.** Name it in the table header and in the
  prose: exact optimum, LP bound, or a weaker reference. M21's scheduling suite reported an
  apparently violated theorem purely by mixing two denominators in one column.
- **When a demo constructs an adversarial family, solve a small case exactly.** The first-fit trap
  claimed an optimum its own items could not reach for as long as nobody checked; one call to the
  exact solver at six groups would have caught it on the day it was written.
- **A null result is a bug until proved otherwise.** The vEB layout measuring exactly level order
  looked like an honest negative finding and was an off-by-a-recursion. Where a technique is
  *supposed* to win, assert that it does, and let the assertion fail.

Three things M26 added to the shape and worth keeping:

- **Check that a section id is free before writing the file, not after.** M26 overwrote an M01
  section by reusing `space-complexity`; the prefix check I did run would never have caught it.
  `git ls-files --error-unmatch src/js/sections/<id>-template.js` answers it in one command, and
  it belongs at step 4 of the shape below.
- **A simulator for a model that may not terminate needs three outcomes, not two.** `halted`,
  `rejected` and `budget` are different facts, and collapsing the third into the second makes a
  computability demo teach the opposite of the truth.
- **When a formula predicts a curve, measure at the point the formula predicts.** Reporting a run
  maximum instead of the value at the predicted iteration made a correct Grover implementation
  look wrong for an afternoon.

Three things M27 added to the shape and worth keeping:

- **The sandbox hands a graded test exactly one value — there is no `helpers` argument.** An
  exercise needing several functions exposes them through one `lab()` entry.
- **Test a search's witnesses, not its count.** Verify independently that each one really has the
  property the search claims to have found.
- **When a claim holds only under a side condition, compute the side condition and print it.**
  `SystemF.enumerable` is the pattern: the metric says whether the enumeration it just reported
  is complete.

Three things M25 added to the shape and worth keeping:

- **A differential harness must not swallow its own errors.** M25's `safely` wrapper turned a
  wrong call signature into "this parser is not applicable to this grammar" — a legitimate outcome
  for a different reason — so LL(1) was silently absent from every sweep and the row looked fine.
  If a harness has a "not applicable" state it needs a separate "threw" state, and the check count
  has to be asserted.
- **When two components produce the same kind of answer, assert the COUNT, not just the verdict.**
  GLR and Earley agreed on acceptance while disagreeing on tree counts through two rewrites of the
  graph-structured stack. The acceptance sweep never saw it; `trees(...).length` did.
- **A section's default control setting is part of its prose.** Two M25 sections quoted figures
  their shipped default did not show. `node tools/section-dump.js <id>` with no arguments prints
  exactly what a learner sees on arrival; align the prose to that.

Three things M22 added to the shape and worth keeping:

- **A size is not a measurement until the floor is beside it.** Every compression table in this
  milestone carries the entropy of a stated model in the next column, because a ratio hides its
  denominator and a bits-per-symbol figure invites the question. It is the same discipline M21
  applied to competitive ratios, in a different unit.
- **A left-shift by a variable is a 32-bit trap.** `1 << (length - 2)` goes negative at length 33,
  so the burst search ran zero trials and reported a 0% catch rate — a number that reads as a
  catastrophic failure and was an empty loop. Use `Math.pow(2, n)` where n can reach 31.
- **When a demo contradicts the folklore, run the loop before rewriting the prose.** Generation
  loss, canonical Huffman's table size and LZW's ratio against LZSS were all written from received
  wisdom and all three measured differently. The prose now says what the demo prints.

---

## M23 — applied cryptography and constant-time programming (complete)

Eleven sections, 225 in the tree. Nine algorithm modules, one harness (`machines/crypto-lab.js`),
one new viz renderer (`viz/block-image-view.js`), eleven template + section pairs, sixteen content
files, two property suites, two figure suites and a dedicated disclaimer test.

### The shape of the milestone

Every section is arranged around one discipline: **the attack executes, or it does not ship.** The
spec's acceptance criteria say so explicitly and they were taken literally. The padding oracle
really decrypts, the length extension really forges, the nonce repeat really recovers a plaintext
and then a tag GCM accepts, the timing attack really empties a token, and the ECDSA nonce reuse
really returns the private key. Nothing in the milestone says "imagine the attacker recovers the
key".

The second discipline is that **every primitive is validated against somebody else's answer before
any property is asserted about it.** A cryptographic implementation with a wrong constant produces
stable, well-distributed, completely wrong output, and no test written against your own
implementation detects it. `crypto-lab.js` checks six published vectors at render time, and
`tests/unit/crypto-modules.test.js` additionally checks SHA-1, SHA-256, HMAC, AES at all three key
sizes, CBC, CTR and PBKDF2 against node's own `crypto`.

### Modules

`algorithms/`: `crypto-hash.js` (SHA-1, SHA-256 with resumable state, HMAC, `glueFor`, the
length-extension attack), `block-cipher.js` (AES with a computed S-box, ECB/CBC/CTR, PKCS#7),
`aead.js` (GHASH, AES-GCM, ChaCha20, Poly1305, ChaCha20-Poly1305, encrypt-then-MAC, constant-time
tag compare, the nonce-reuse study), `public-key.js` (modPow, RSA, trial-division factoring, the
malleability attack, Diffie–Hellman, brute-force discrete log, curve arithmetic, ECDH, the
key-size table), `signatures.js` (ECDSA, deterministic nonces, nonce-reuse recovery, certificates
and chain validation), `kdf.js` (PBKDF2, a memory-hard sketch, the cracking-cost model, iteration
tuning, register/verify with rehash detection), `constant-time.js` (mask, select, `lessThan`,
branchless equals, scanning lookup, the timing attack and profile), `threshold.js` (Shamir split
and reconstruct, Lagrange interpolation anywhere, the underdetermination study, commitments,
Merkle trees and proofs), `ratchet.js` (chain steps, forward secrecy, the DH ratchet,
post-compromise recovery, a scripted conversation).

`machines/`: `crypto-lab.js` (the vector harness, the padding oracle, ECB leakage, LCG recovery, a
CSPRNG, the requirement-to-primitive chooser and the standing disclaimer).

`viz/`: `block-image-view.js` (bytes drawn as a greyscale bitmap, so the ECB picture is a picture).

### What was wrong before it was right

- **AES-192, AES-256 and every decryption were wrong.** The S-box build read `exp[255 - log[i]]`,
  which indexes `exp[255]` — undefined — so `SBOX[1]` came out `0x63` instead of `0x7c`. AES-128
  encryption happened to agree with the vector; nothing else did. `% 255` fixed all three key sizes
  and both directions. This is the milestone's own lesson landing on the milestone: without the
  FIPS-197 vector, the output would have looked perfect forever.
- **`lessThan(0, 0xffffffff)` returned 0.** The branchless comparison needs the Hacker's Delight
  form `((~x & y) | (~(x ^ y) & (x - y))) >>> 31`; the first attempt was subtly wrong only at the
  sign boundary, which is exactly where a hand-checked example would not have looked.
- **ECDSA threw "Cannot mix BigInt".** The demo curve's order was composite, so some nonces had no
  inverse. A prime-order generator (order 3 359 over p = 10 007) was needed before the signature
  scheme worked at all — which is itself the parameter lesson from the public-key section.
- **The double ratchet delivered nothing after the first change of direction.** `dhRatchet` derived
  two different chain keys with `'send'` and `'receive'` labels, so the two parties never agreed.
  It now derives ONE chain key and assigns it by role.
- **`underdetermined()` was a stub that asserted its own conclusion.** It marked every candidate
  "consistent" by comparing array lengths. It now interpolates the polynomial through each candidate
  and checks that it reproduces every held share, and reports how many distinct values the
  candidates imply for a share nobody holds — 8 for 8 candidates, which is the same fact from the
  other side.
- **A metric id and a table id collided in three sections.** `MetricGrid` writes its note into
  `#<id>-note`, so a hand-written `<p id="thr-vectors-note">` was overwritten by the table's note
  and the metric's note vanished. `template-ids.test.js` catches the control/element case; this one
  was found by reading `section-dump.js` output, which is what that tool is for.

### Three things M23 added to the shape and worth keeping

- **A milestone-wide invariant deserves its own test.** The standing disclaimer is an acceptance
  criterion, so `tests/unit/crypto-disclaimer.test.js` walks M23's curriculum group and asserts
  each template renders a warning callout, each controller writes a module `DISCLAIMER` into it,
  and each orientation opens with the warning bullet. It found two sections mid-build.
- **Read the exported value, not the source text.** That test first parsed `const DISCLAIMER = …`
  out of the file and broke on a semicolon inside the string. `require(path).DISCLAIMER` is shorter
  and cannot be defeated by punctuation.
- **A curriculum file will cross 1 000 lines mid-milestone.** `curriculum-algorithms.js` did, at
  M23. The split is `curriculum-algorithms-later.js` holding M17 onward, spliced on with
  `.concat(later)` — a milestone boundary, so nothing but the line count moves.

---

## M24 — regular languages and finite automata (complete)

Eleven sections, 236 in the tree, and the automata track opens. Nine algorithm modules, two
harnesses (`machines/automaton.js` and `machines/language-lab.js`), one new viz renderer
(`viz/automaton-view.js`), eleven template + section pairs, twelve content files, two property
suites and one figure suite.

### The shape of the milestone

Every conversion in this milestone is a theorem with an algorithm attached, and the discipline is
that **an implementation of a theorem is checked by exhaustive string testing, not by reading**.
Thompson and Glushkov are checked against JavaScript's own `RegExp` over every string up to length
9. The subset construction, ε-removal, trimming, completing and relabelling are each checked
against the machine they came from. Three minimisation algorithms are checked against a
brute-force Myhill–Nerode count that never builds a machine at all. State elimination is checked
by compiling the expression back. Containment returns a counter-example, and the counter-example
is re-run through both original machines.

The second discipline is that **a "no" arrives with a witness**. Containment, equivalence,
emptiness and Büchi model checking all return the shortest string or lasso that proves the answer,
and every one of those is confirmed against the sources rather than trusted.

### Modules

`machines/`: `automaton.js` (one representation for DFA, NFA, ε-NFA and their conversions, with
execution traces, ε-closure, subset construction, trim, complete, reverse, ε-removal, relabel and
exhaustive equivalence), `language-lab.js` (the eight-language catalogue with a real recogniser
each, the exponential subset family, the pumping game and Myhill–Nerode families).

`algorithms/`: `regex-compile.js` (parser, Thompson, Glushkov positions, and state elimination
back to a pattern), `derivatives.js` (Brzozowski with the similarity rules that make it
terminate), `minimization.js` (Moore, Hopcroft, Brzozowski and the brute-force oracle),
`automaton-ops.js` (product with four accepting rules, complement, emptiness, containment,
equivalence, concatenation, star), `transducer.js` (Mealy, Moore, composition, weighted best
path), `lexer-gen.js` (maximal munch with priority, and shadowing analysis), `redos-analysis.js`
(two structural detectors, attack-string generation, and a counted backtracking matcher),
`hmm.js` (Viterbi, forward, forward–backward, brute-force reference, and the underflow
measurement), `buchi.js` (Büchi acceptance, lassos, nested depth-first emptiness, safety and
liveness monitors).

`viz/`: `automaton-view.js` (state graphs with the active states lit, circle or BFS-layer layout).

### What was wrong before it was right

- **The ReDoS detector found nothing, then found everything.** The first version tracked state
  SETS in both components of the product, so the two runs it needed to compare had already merged
  and `off-diagonal` never fired. Tracking single states over the ε-free machine then flagged
  every pattern, because ε-removal turns one run into several parallel targets. The fix is two
  detectors on two different objects: overlap on the Glushkov position automaton, which is
  ε-free and position-faithful, and nested quantifiers on the syntax tree, because `(a*)*` and
  `a*` have identical position automata and only the shape separates them. Nine fixtures, nine
  correct verdicts, including `(a|ab)*c` which looks dangerous and is not.
- **Three correct minimisation algorithms appeared to disagree.** Moore and Hopcroft returned the
  minimal TOTAL machine and Brzozowski the minimal trimmed one, and the oracle counted classes
  over reachable prefixes only. All three were right; the conventions were not the same. Every
  path now completes, and the oracle partitions all of Σ*.
- **A memoise key was joined with a pipe, and the pattern contained one.** `'(a|b)*abb' + '|' +
  order` split back into `(a` — an unclosed group — and took the whole section down at render. The
  key is joined with a newline now.
- **The three-state divisibility machine accepts the empty string.** The definition rejected it,
  so the batch tester reported 510 of 511. The machine is right and the definition was: the empty
  numeral reads as zero, and excluding it needs a fourth state that is a copy of the first and not
  accepting — which is the whole difference between "k states" and "k + 1".
- **`underdetermined()` asserted its own conclusion.** It marked every candidate consistent by
  comparing array lengths. It now interpolates the polynomial through each candidate and checks it
  reproduces every held share.
- **A derivative starter exhausted 4 GB of heap.** Its guard capped the STATE count, and without
  simplification each derivative tree is about twice the size of the last, so sixty states is
  billions of nodes. The guard is on the iteration count now.

### Three things M24 added to the shape and worth keeping

- **A memoise key must not be joined with a character the values contain.** The pipe was a
  reasonable default until a milestone whose data is regular expressions. A newline is a better
  one, and the failure it caused was a whole section rendering zero characters.
- **When a detector reports on structure, it needs a fixture list with known verdicts — including
  the safe-looking-dangerous and the dangerous-looking-safe.** The ReDoS analyser was wrong in
  both directions before the fixtures existed, and each wrong direction looked plausible on its
  own.
- **`tests/render-audit.js` now reports four stack frames rather than one.** The message alone
  rarely says which of a section's dozen measurement calls threw; four frames named the parser
  immediately.

---

## M29 — IR, SSA and optimisation (complete)

Ten sections, 288 in the tree. Eleven modules under `machines/berugo/`, one harness
(`machines/pass-lab.js`), one new viz renderer (`viz/cfg-view.js`), ten template + section pairs,
twelve content files, one property suite and three figure suites.

### The shape of the milestone

Every pass in this milestone is **gated after every pass by three checks that see three different
things**, and the third is the only one that matters:

- the **IR verifier**, ten named invariants, which catches structural damage and names the pass
  that caused it rather than leaving eleven passes to bisect;
- the **SSA check**, which is the two invariants the verifier cannot state without a dominator
  tree — one definition per register, every use dominated by it, with a phi's operands judged on
  the EDGE;
- the **differential run**, which is the only gate that can see a pass producing perfectly valid
  IR that computes the wrong answer.

The second discipline is that **every analysis is checked against a second implementation of its
own definition**, never against itself: dominance against removing a block and asking what became
unreachable, loop membership against a path enumeration, liveness against a path enumeration,
aliasing against a replay of which registers really held the same object. Each oracle is
exponential, useless at scale, and cannot be subtly wrong, which is the whole reason to have it.

### Modules

`machines/berugo/`: `ir.js` (18 opcodes, blocks, the ten invariants, verify, clone),
`ir-lower.js` (core tree to blocks, with the origin of every instruction), `ir-interp.js` (the
reference interpreter over the IR, phis included), `cfg.js` (blocks, back edges, natural loops,
nesting, critical edges and their splitting, reducibility), `dominators.js` (Cooper-Harvey-Kennedy
plus frontiers, post-dominance and the brute-force oracle), `ssa.js` (placement, renaming, pruning,
destruction, the parallel-copy sequencer and the checker), `dataflow.js` (one worklist solver with
four parameterisations plus the liveness oracle), `passes-scalar.js` (copy propagation, dead code,
value numbering, SCCP, peephole), `passes-loop.js` (LICM safe and naive, induction variables,
unswitching opportunities, the cost model), `interproc.js` (call graph, inlining plan, escape
analysis, tail calls), `alias.js` (Andersen, Steensgaard, alias pairs, the dynamic oracle,
redundant loads). `machines/pass-lab.js` (run any pipeline, gate after every pass, phase ordering,
the conformance suite, the shrinker). `viz/cfg-view.js`.

Content is split per third of the milestone — `-middle-end`, `-middle-end-passes`,
`-middle-end-opt`.

### Four defects found only by running things

Every one of these produced output that read as correct, and three of them were in the code the
section is *about*.

1. **The `twoLatches` fixture had one latch.** Berugo lowers both arms of an `if` into a join
   before the latch, so a `while` containing a conditional has exactly one back edge. The fixture
   was named for a shape it did not have, the concept said "a `continue` produces exactly that"
   beside a program with no `continue`, and the worked example claimed "1 loop from 2 back edges"
   where the count was 1 and 1. `Cfg.mergeLoop` was therefore never once executed. The fixture now
   says `continue`, which really does produce two back edges to one header.
2. **The SSA cycle breaker saved the wrong register.** `breakCycle` copied `pair.from` into the
   temporary and redirected everybody reading the source; the value that has to be saved is the one
   the copy is about to DESTROY, its destination. `a = b; b = a` became `t = b; a = t; b = a`, so
   both registers ended up holding `b` — which is precisely the failure the temporary exists to
   prevent, in the routine whose only purpose is preventing it.
3. **The IR interpreter ran a block's phis one at a time.** The phis at the top of a block happen
   simultaneously, all reading the registers as the predecessor left them. Sequentially,
   `a = phi(b)` assigns the new `a` and the next phi reads it. That is the same swap problem one
   level down, and it meant a *correctly* destructed program disagreed with the SSA program it came
   from. `runPhis` now reads every value before committing any.
4. **No recursive call was ever an edge in the call graph.** A self-call lowers to
   `const "!down"` and a `call` through it, not to a `makeClosure`, so `closureMap` did not see it
   and the call was filed as indirect. `graph.recursive` was therefore always empty, the rule that
   excludes recursion from inlining outright had never run, and the concept "a self-recursive
   function is detected as a cycle in the call graph and never inlined" was false. A `!name` that
   names a function of this program is now a direct edge; one that names a runtime native still is
   not.

And one stub that asserted its own conclusion: `swapCycle()` in `ssa-form-section.js` returned
`agrees: true` as a literal. It could not have measured anything — it branched on a Number, which
`IrInterp.truth` rejects, and would have looped forever if it had not. It now builds a terminating
loop with a counter, returns `a - b` so a collapsed cycle reports 0 where the swap reports 1, and
runs the function before and after destruction. That is what turned defects 2 and 3 up.

### Design decisions that are easy to undo by accident

- **The naive LICM pass ships and has to fail.** `licm-naive` hoists anything invariant, and on the
  trap fixture — a division whose only guard is the loop condition — it turns a program that
  finished into one that faults. The safe pass's refusal proves nothing unless the unsafe one is
  runnable and demonstrably wrong, so the figure suite asserts `after === 'runtime'`.
- **The fuzzing sweep's headline is a zero under a broken pipeline.** 400 generated programs find
  nothing with naive LICM enabled, because the grammar cannot write a division guarded by its own
  loop condition. Coverage is a property of the generator, not of the number of programs, and the
  section says so and seeds the shape by hand rather than reporting 400/0 as reassurance.
- **`Loop.report`'s weighted column names its assumption in the table.** Ten iterations per nesting
  level is made up; it cancels when comparing two loops in one function and means nothing in a
  report, and the caption says which use is which.
- **Escape analysis reports the reason, not the verdict.** "Returned" is exact and "passed to a
  call" is conservative, and only the second could be recovered by an interprocedural summary.
  Collapsing them gives a number nobody can act on.
- **The dynamic alias oracle under-approximates by construction** — one input, one path — so it can
  prove an analysis unsound and can never prove one correct. The tests assert `missed` is empty and
  never that the reported set is minimal.
- **`Cfg.criticalEdges` returns the edges and `splitCriticalEdges` returns `{ split, edges }`.**
  Two different shapes for two different questions; a test that calls `.split` on the first gets
  `undefined`, which is falsy, and passes.

### Measured figures quoted in the M29 examples

`tests/unit/worked-examples-middle-end.test.js`, `-passes` and `-opt` recompute every one *and*
assert the prose still quotes it; `tests/unit/middle-end-modules.test.js` carries the property
tests and every oracle. Landmarks: three statements of source giving 4 blocks, 32 instructions,
22 registers and 4 slots with all 10 invariants holding; 17 of 17 conformance programs verifying
and 17 of 17 agreeing with the core; 7 blocks and 8 edges with 2 nested loops, and 0 critical edges
and 0 irreducible graphs across every lowered fixture against 6 of 7 and irreducible for the
hand-built one, which splitting takes from 5 blocks to 11; 2 dominator rounds over 7 blocks, 6
changes then 0, agreeing with the removal oracle on all 7; 9 phis placed, 3 pruned, 6 kept, and a
hand-built swap needing 3 phis, 7 copies and 1 temporary; four analyses at 1.50, 1.75, 1.00 and
2.00 visits per block and liveness agreeing with the enumeration on 5 of 5; SCCP at 7 instructions
against folding-without-reachability's 12 and the full pipeline's 6, from 19, and 100 of 229
instructions removed across the suite; 3 of 5 fixtures sensitive to phase order, each by one
instruction in the same direction; LICM hoisting 4 and refusing 1 against a naive 5 and 0; 2 direct
calls at ratios 1.00 and 1.67 spending 6 of 40, and 9 of 11 allocations across the suite living on
the stack; 22 Andersen pairs in 2 rounds against 28 Steensgaard from 7 merges, both supersets of
the 16 that really happened; and 400 programs with 0 failures beside a seeded program shrunk from
15 lines to 6 over 11 rounds and 51 compiles.

Two figures were corrected against measurement during the build, both written from the shape of
the argument: "1 of 5 fixtures has an eliminable load" (it is 2, and the fixture where the two
analyses differ is not one of them) and the hand-built swap's "2 phis, 5 copies" (3 and 7, once the
fixture could actually be run).

### Three things M29 adds to the shape and worth keeping

- **A fixture named for a property must be asserted to have it.** `twoLatches` had one latch for as
  long as nobody counted, and the merge path it existed to exercise was dead. Assert the shape, not
  just the result computed from it.
- **A hardcoded `true` in a results row is a stub, whatever it is called.** `agrees: true` passed
  every test in the suite and every render audit. Anything a table reports as a check must be the
  return value of running the check.
- **An interpreter is part of the oracle and can be the thing that is wrong.** The differential run
  compares two runs of the same interpreter, so a defect in it is invisible to every program where
  both sides hit it — and visible only where one side has phis and the other does not. The swap is
  that program, which is why the milestone needed one that could actually execute.

---

## M30 — code generation, bytecode VMs and JIT (complete)

Ten sections, 298 in the tree. Nine modules under `machines/berugo/`, one harness
(`machines/exec-lab.js`), one new viz renderer (`viz/bytecode-view.js`), ten template + section
pairs, twelve content files, one property suite and three figure suites.

### The shape of the milestone

Five back ends now exist for one language — the IR interpreter, a stack VM, a register VM, a
tiered JIT and a WebAssembly module — and the only claim worth making about any of them is that
it computes what the front end computed. So the differential from M29 is reused verbatim rather
than reimplemented: value, output, outcome and every binding, with the first difference named.
`ExecLab.suite()` runs 59 comparisons across 17 programs and four back ends and reports 0
disagreements, with 9 programs outside the WebAssembly subset and each one carrying its reason.

The second discipline is that **the unit a measurement is denominated in is part of the
measurement**. Three of this milestone's four defects were invisible in the obvious unit and
obvious in the right one: a spill count that rose when splitting improved the code, a split count
that rose when the split did nothing at all, and a stack-map check that reported precision as
failure because it asked about the present rather than the future.

### Modules

`machines/berugo/`: `bytecode.js` (two instruction sets, a constant pool, two encodings, a
block-local virtual register allocator, superinstruction analysis, a disassembler), `vm.js` (a
resumable step machine over an explicit frame stack, closures, open and closed upvalues, a step
debugger, both instruction sets through one loop), `isel.js` (tree regions, a data-driven tile
table, dynamic-programming cover, an exhaustive oracle, a cost sweep), `regalloc.js`
(Chaitin-Briggs colouring, conservative coalescing, Poletto-Sarkar linear scan with real interval
splitting, placements over spans, an independent verifier), `schedule.js` (a dependence DAG with
true, memory and effect edges, critical paths, list scheduling, an in-order pipeline model,
register pressure, a legality check), `wasm-emit.js` (LEB128, sections, Ramsey's stackifier, a
stated numeric subset with a whole-program type fixpoint, a trapping divide), `jit.js` (closure
compilation, profiling, guarded fast paths, deoptimisation, on-stack replacement, a deopt
blacklist), `shapes.js` (transition trees, inline caches with four states, cost studies),
`runtime.js` (a written-down calling convention, bytecode liveness, stack maps, a dynamic
safepoint oracle, source maps, stack traces). `machines/exec-lab.js` (every mode, one
comparison, and the benchmark protocol). `viz/bytecode-view.js`.

Content is split per third of the milestone — `-back-end`, `-back-end-target`,
`-back-end-runtime`.

### Four defects found only by running things

1. **A call invoked its own first argument.** The register code generator released a scratch
   register as soon as each operand was placed, so the callee's register was free again before
   the argument run was laid out and the first argument reused it. The symptom is "41 is not a
   function" rather than a wrong number, and it is invisible on every program with no direct
   call. The fix is two regions: permanent registers recycled at each value's last use, and
   scratch taken strictly above them and dropped only when the whole IR instruction is emitted.
2. **Interval splitting was decorative.** The allocator kept one register per value and re-queued
   a spilled interval's tail under an invented name, so nothing ever read the tail: the split
   counter rose, the code was unchanged, and the spilled-points measure got WORSE (28 against 18)
   because the same value was counted twice. The allocation is now a list of placements —
   register, span, colour — and the verifier reads the colour at a point.
3. **Splitting still saved nothing, for a second reason.** With placements fixed, the tail
   resumed one point after the eviction, which is a position where nothing has expired, so it
   spilled again immediately for the rest of its life. Resuming at the first point some active
   interval has ended took it from 15 points to 9 and made the feature real.
4. **The stack-map check was written backwards.** It compared the map against what the frame
   HELD and reported 15 failures across the suite, every one of them a register still holding an
   object the program would never read again — which is precisely what a precise collector is
   entitled to ignore. The question is about the future, so the check now opens an observation at
   each safepoint and records what that frame reads before writing until it returns.

### Where the textbook claim did not survive

**"Graph colouring produces better code than linear scan" is false on this function once
splitting is real.** Points spent in memory, at 1 / 2 / 3 / 4 / 6 registers: colouring 25 / 22 /
18 / 13 / 0, linear scan 30 / 23 / 17 / 9 / 1. Colouring is ahead at 1, 2 and 6 and behind at 3
and 4. The reason is stated rather than hidden: splitting expresses a value that holds a register
for part of its life and sits in memory for the rest, which an interference graph built from
whole live ranges cannot represent at all. The section says what the sweep shows and names the
conditions — small functions, short live ranges, no spill-cost heuristic — under which it is
saying it.

A second, smaller one: the register instruction set was expected to pay for its speed in bytes
and does not. On the loop sample it is 196 bytes against the stack set's 204, because the stack
generator spends so many instructions moving values through scratch slots that its one-byte
opcodes add up.

### Design decisions that are easy to undo by accident

- **The stack generator's peephole is a switch, and the honest ratio is the one with it on.**
  Without it the suite is 517 stack instructions instead of 383, and the stack-against-register
  ratio reads 1.97 instead of 1.46. Leaving it out would have supported the section's conclusion
  more strongly while being wrong about why.
- **Every bytecode instruction carries the origin and span of the IR instruction it came from.**
  30.9's source map, its stack trace and its stack maps are one field read three ways, and the
  obligation is on the code generator rather than on a later pass.
- **The WebAssembly subset is reported per program with a reason.** 8 of 17 compile. A back end
  that silently skipped the rest would show a perfect agreement column that means nothing, and
  the reasons are the shape of the work a real wasm back end for a dynamic language has to do.
- **A polymorphic binding is outside the subset, not printed wrong.** Erasing every value into an
  f64 costs the observables: a Bool survives only because the declared type is carried across,
  and a value whose type the checker could not pin down cannot be printed back at all.
- **A JIT guard is checked BEFORE the instruction consumes anything.** That single ordering is
  the whole correctness argument for deoptimisation, and getting it wrong produces a wrong answer
  only on the rare input the guard rejects.
- **A function that deoptimises twice stops being speculated on.** Without it a genuinely
  polymorphic function recompiles and falls back on every pass through a loop, and the program
  gets slower the longer it runs.
- **The safepoint set is calls and allocations only.** A map at every instruction would be larger
  than the code it describes, and nothing else can trigger a collection.

### Measured figures quoted in the M30 examples

`tests/unit/worked-examples-back-end.test.js`, `-target` and `-runtime` recompute every one *and*
assert the prose still quotes it; `tests/unit/back-end-modules.test.js` carries the property
tests and every oracle. Landmarks: 74 stack instructions against 43 register on the loop sample,
244 dispatches against 125 for 1.95 times, and 204 bytes against 196; 383 against 262 and 503
against 319 across the suite, with 517 when the peephole is off; 20 adjacent pairs of which the
top two are worth 18 of 74 dispatches; a session stopped at main:6 after 6 dispatches with 1
frame live, and 9 native calls across the suite; 7 expression trees covered by 17 tiles at 24
cycles, agreeing with an exhaustive search on 7 of 7, with the fused tile chosen at a price of 4
and abandoned at 5; 13 points in memory for colouring against 9 for linear scan at 4 registers,
25 against 30 at 1, and 11 live ranges with a highest degree of 9 over 25 edges; 34 cycles to 32
with the peak rising from 2 to 3, and a saving fixed at 2 cycles across latencies from 1 to 16;
a 237-byte wasm module over 5 sections of which 168 are code, 8 of 17 programs in the subset
totalling 1 177 bytes and all 8 agreeing; a JIT reaching the optimising tier at dispatch 3 204
with 4 guarded fast paths and 0 failures, and a deopt fixture failing 1 guard at dispatch 6 922
and still agreeing; 1.00, 1.50 and 5.99 units per property access for one, two and every field
order, with the cliff between 2.50 at four shapes and 7.98 at five; 5 safepoints of 31
instructions with 27 carrying a span, 26 safepoints across the suite covering all 44 observed
reads with 0 missed; and 4 810 dispatches against 9 614 with the cost per iteration flat at 16.40
down to 16.02 across a sixteenfold input.

### Four things M30 adds to the shape and worth keeping

- **Choose the unit before choosing the measurement.** A spill count, a split count and a
  "registers holding a reference" count all moved in a direction that made a defect look like a
  feature or a feature look like a defect. Points spent in memory, and reads observed after a
  safepoint, are the units those questions are actually paid in.
- **A demonstration that has never failed has not been demonstrated.** The naive stack generator,
  the unsplit allocator, the naive benchmark and the broken LICM pipeline from M29 are all
  shipped and all asserted to be worse. A switch nobody has turned is a switch nobody believes.
- **When the measurement contradicts the textbook, print the measurement.** The register
  allocation section now says linear scan wins at three and four registers on this function,
  names the mechanism, and names the conditions under which that is true — rather than quietly
  choosing a fixture where the expected answer appears.
- **A subset stated per program is a result; a subset hidden is a lie.** The wasm section reports
  8 of 17 with nine reasons, and the nine reasons are more instructive than the eight agreements.

## Readability pass — the decoder reached one tab of three (complete)

Read the platform end to end as its stated audience: a senior engineer with no
maths background. The teaching was sound; the plumbing that makes it readable
was not, and six defects sat where no existing test looked.

### What was wrong

- **The notation decoder ran on the Description tab only.** `section-concepts`
  and `section-shell` annotated their text; `section-examples`,
  `section-reference` and the code lab's prompt piped everything through `esc`.
  That is 1 198 section-symbol pairs in the worked examples, 2 117 in the
  reference blocks and 287 in the lab prompts rendered with nothing to hover —
  and the worked example's `work` field is the densest arithmetic on the
  platform. The reader who most needed the decoder met it least.
- **Four containers clipped the panel anyway.** `.worked-example` and
  `.reference-block` set `overflow: hidden` for their rounded corners, and
  `.step-work` and `.equation` set `overflow-x: auto`. Every one of those is a
  clipping context, so a chip inside them opens a panel nobody can see. The
  corners are now rounded on the two bands that have a background, and the two
  monospace blocks wrap (`overflow-wrap: anywhere`) rather than scroll — they
  were already `pre-wrap`, so the scroll only ever caught an unbreakable token.
- **488 "In the wild" entries rendered as an empty bullet.** The field is
  written in two shapes — `{ system, how }` in most sections and one sentence in
  122 others — and the renderer read only the first, so 122 sections showed a
  list of `<li><span class="sym"></span> — </li>`. `escapeHtml(undefined)`
  returns `''`, which is why it failed silently instead of printing "undefined".
- **623 source notes, 121 source authors and 46 equation readings were never
  rendered at all.** The `readAs` on a reference equation is the plain-English
  sentence for exactly this audience — "A machine is a finite set of states, an
  alphabet, a transition function…" — written 46 times and shown zero.
- **The `HARD` regex in `notation.test.js` was built from a string, so its `\b`
  was a backspace character.** `E[…]`, `n!`, `mod`, `ln` and `lim` were named in
  the comment and matched by nothing. It is a regex literal now, and it
  immediately found two formal lines with no reading (`derandomisation`,
  `using-solvers`).
- **Three modules threw on every page load.** `model-check.js`, `verify-vc.js` and
  `spec-dsl.js` read `Berugo.Sat`, `Berugo.SatCheck` and `Berugo.TheoryLinear` at load
  time, and their script tags sat eight lines *above* the solver that defines them. The
  `pick` fallback then reached for `require`, which does not exist in a browser, so all
  three failed to register — silently, because a module that throws before
  `root.X = api` is indistinguishable from one nobody has wired yet. They are the parked
  M32 modules, so no section broke, but the console carried three exceptions on every
  load and the next person to build M32 would have found `SpecDsl` undefined. The tags now
  follow the solver.
- **`iff`, `modulo`, `argmin` and `argmax` had no glossary entry.** `iff` is the
  worst of them: 53 uses, and a reader who has not met it reads it as a typo for
  `if` and takes away half the statement. `argmin`/`argmax` were named in the
  readAs guard's own HARD set while being undecodable everywhere else.

### Three things this pass adds to the shape and worth keeping

- **A renderer that escapes is not a renderer that teaches.** Every guarantee
  the content layer makes — the glossary, the readings, the coverage floors —
  is worth exactly as much as the component that renders it. The audit that
  found this was one line: count `abbr.notation` per tab.
- **Content written and never rendered fails silently in both directions.** No
  test read the content *through* the renderer, so a field the renderer did not
  know about was indistinguishable from a field that did not exist.
  `content-rendering.test.js` now takes the longest plain-prose run out of every
  string in a reference and worked-example entry and requires it in the rendered
  text. It found the authors and the equation readings on its first run.
- **A guard built from a string literal is a guard you have not read.** The
  `\b` bug survived because the comment above it described the intent
  convincingly, and nobody ran the pattern against an example it claimed to
  catch. `notation-rendering.test.js` asserts on rendered output for that
  reason: it can only pass by actually rendering a chip.

## Readability pass, second round — reading the site as its audience (complete)

Driven by the reader's own report: the first teaching section was hard, the type
was too small, and the content did not use the window. All three were true.

### What was wrong

- **The first teaching section was written in the platform's oldest style.**
  `asymptotic-notation` opened with "O, Ω and Θ are sets of functions, and
  membership is decided by a witness", which is the formal definition, a set-
  theoretic framing and an undefined term of art, in that order, in sentence
  one — and it is the first thing anybody reads. The measurement says the style
  drifted the right way over time and this section was left behind: 155 of 305
  orientations now open with a bolded plain-English claim, and only 11 open cold
  with notation. Most of those 11 are fine hooks ("Insertion sort is Θ(n²) and
  merge sort is Θ(n log n), and for small n insertion sort wins anyway"). Three
  genuinely opened with a definition rather than a claim; all three now lead
  with the claim.
- **The root font was 14px.** That put body prose at 0.875rem = 12.25px and a
  metric note at 10.5px. It is 17px now, which lifts everything in the
  stylesheet proportionally because every size here is in rem.
- **The Description tab was capped at 68rem and the section body at 1400px.**
  Both caps are gone; all three panels take the width of the window.
- **The formal line sat in the paragraph flow.** It was an `inline-block` chip
  with 3px of padding, so a reader skimming a concept could not see where the
  notation stopped and the prose resumed. The formal line and its reading are
  now one block with an accent bar, set apart above and below, and "In words."
  is set as a label rather than as the first two words of the sentence.
- **Two of the 305 mermaid diagrams did not parse**, and rendered in the browser
  as `<pre class="mermaid-error">`. `top-down-parsing-and-ll1` had a round
  bracket inside an unquoted node label — `H[not LL(1): …]` ends the label at
  the bracket — and `randomised-and-interactive-classes` had a semicolon in a
  sequence-diagram note, which mermaid reads as the end of the statement.

### Three things this round adds to the shape and worth keeping

- **A guard tuned to a corpus is not a guard.** The first attempt at catching
  broken diagrams was two hand-written rules about brackets and semicolons.
  They fired on `Y1(("y"))` and `E_p[f(X)]`, which parse fine, because a regex
  cannot tell a node definition from the same characters inside a label; and
  they would have been "fixed" by whittling them down against the current
  corpus until they went quiet. They were deleted. mermaid loads under jsdom in
  about 200ms if it arrives through a script element rather than `eval`, so
  `tests/unit/mermaid-syntax.test.js` runs the real parser over all 305
  definitions and asserts it still rejects both shapes that shipped broken.
- **Read the source the way the source is written.** The first extraction glued
  every string literal in a `definition:` array together with a newline, which
  invents a line break wherever one element is concatenated across two source
  lines — and reported `pushdown-automata` as broken when it renders perfectly.
  Evaluating the array literal is the accurate reading; scanning for quotes is
  not.
- **The audit that finds a style problem is a distribution, not an example.**
  "The first section is hard to read" is an anecdote until you can say 155 of
  305 open with a claim and 11 open with notation. The number is what said this
  was three sections to fix rather than a curriculum to rewrite.

## Readability pass, third round — pictures in the Description tab (complete)

The Description tab was a wall: an orientation, then eight to thirteen concepts
each carrying a 240-character explanation, and one diagram after all of them.

### What changed for every section

- **The section diagram moved above the concepts.** It used to sit after every
  one of them, which is the one place a reader who is already lost will not
  reach. Orientation, then the shape of the thing, then the concepts that fill
  it in.
- **Block headings carry an icon** (`src/js/utils/icons.js`): concepts, diagram,
  demo, worked examples, code lab, reference, and the senior insight. Inline
  SVG in `currentColor`, `aria-hidden` because the heading beside each one
  already says the same thing in words. They are landmarks for the eye on a long
  page, not information.
- **A concept may now carry its own diagram.** `concept.diagram = { definition,
  caption }` renders between the formal line and the explanation — the picture
  arrives before the paragraph it summarises, not after. The host is mounted the
  same way the section diagram is, and a declared diagram with no host throws
  rather than leaving a silent empty box.

### What was wrong

- **Two of the 305 section diagrams did not parse.** Fixed in the previous round
  and now guarded; the guard grew to cover concept diagrams too.

### Coverage

**401 concept diagrams, and every one of the 305 teaching sections has at least
one.** With the section diagram that is 706 diagrams across the curriculum.

They are chosen rather than generated. A diagram earns its place where it
replaces a paragraph, and a good number of them earn it by showing a *failure*
rather than a mechanism: the three Newton failures that all return a number, the
concave clip that comes back plausible and two-thirds too small, the PRNG
histogram that passes for RANDU, the small pivot no check catches, the greedy
flow that terminates and reports success below the maximum, and the object-keyed
map where every leaked entry is genuinely reachable.

There are 2 461 concepts, so this is roughly one diagram for every six. That
ratio is the point: a diagram on every concept would be a diagram nobody looks
at.

### Two things this round adds to the shape and worth keeping

- **A picture before the paragraph, or it is decoration.** The concept diagram
  is placed between the formal line and the explanation on purpose. Placed after
  the explanation it illustrates something the reader has already had to
  construct in their head, which is the point at which it stops helping.
- **Build the slot, then fill it honestly.** The alternative was to generate a
  diagram for all 305 sections from the concept list — a chain of boxes labelled
  with the terms. It would have looked like full coverage and taught nobody.
  Eighteen diagrams that replace a paragraph each are worth more than 305 that
  restate a heading.

## Diagram labels were being cut off, in three different ways (complete)

Reported from the browser: nodes in "The sorting contract" showed text that
stopped mid-phrase. Three separate causes, all silent, all of which read as a
typo rather than as a rendering fault.

- **Node labels were capped at mermaid's default `wrappingWidth` of 200px**,
  and mermaid styles labels `white-space: nowrap` — so a wider label is not
  wrapped, it is clipped. "what do you know about the input?" rendered as "what
  do you know about the". Measuring every label line in every diagram at the
  16px mermaid gives them, **908 lines were over that cap**. The widest is 678px
  (the simply-typed lambda calculus), so `wrappingWidth` is now 720.
- **Edge labels do not honour `wrappingWidth` at all.** Their background div is
  hard-coded `max-width: 200px`, so raising the flowchart setting fixed the
  nodes and left 15 edge labels clipped. Those are wrapped in the content with
  an explicit `<br/>`, which is the only thing that breaks them — including
  labels that already had a `<br/>` but whose *second* line was still too long.
  Three label syntaxes carry edge text and the first fix only handled one:
  `-->|label|`, `-. "label" .->`, and a state diagram's `A --> B: label`.
- **Every remaining label lost its last character or two.** mermaid sizes the
  `foreignObject` from its own measurement, that measurement runs a few pixels
  under what the browser paints, and the `foreignObject` clips. "one transfer
  moves B records" rendered as "one transfer moves B record". The label now
  paints outside its measured box.

### Two things worth keeping

- **A screenshot found what four hundred measurements had explained away.** 95
  labels overflowed by 4 to 17 pixels, a spread that looked exactly like a
  padding artifact in `scrollWidth`, and the labels' `textContent` was complete
  — `textContent` says nothing about what is painted. One zoomed screenshot
  showed the missing "s".
- **The measurement has to happen where the rendering happens.** mermaid cannot
  be measured in jsdom, so the widths behind `wrappingWidth = 720` and behind
  the wrapping script were taken in a real browser, with the app's own font at
  the size mermaid actually uses. A guess would have been wrong in both
  directions.
