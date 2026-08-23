# Build state

Where the implementation stands, and exactly what the next session should pick up.
Update this file at the end of any session that leaves work unfinished.

**Last updated:** 2026-08-22 (M15 complete; the tree is green — next is M16, computational geometry)

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

**The tree is GREEN.** `npm test` reports 2 740 unit tests with 0 failures (6 skipped — the
wall-clock-budget starters the inline sandbox cannot fail); the wiring audit passes at 146 sections
and 696 modules, the render audit activates all 146 with no exception and no empty table,
`npm run lint:size` passes across 775 files, and `npm run build:css` is up to date.

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
senior engineer who may not. Two things changed, across all 146 sections.

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

## Next

**M16 — computational geometry**, then onward through `doc/milestones/` in the order
`doc/ROADMAP.md` gives.

M11 through M15 are complete apart from a human browser pass, which needs the Chrome extension
connected. `tools/section-dump.js` covers everything else the browser used to be needed for — it
prints every metric, table and note a section renders, at any control setting, and since the
`input`-event fix above that is finally true of slider settings too.

A shared helper exists for the figure tests: `tests/support/worked-example-prose.js` exports
`proseFor`, `quotes`, `fixed` and `grouped`.

The shape to copy, unchanged through M14:

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
   four of M13's six bugs and all four of M14's false claims were found;
7. the four content files, split per quarter of the milestone to stay under 1 000 lines;
8. `<topic>-modules.test.js` (property tests against a brute-force reference) and
   `worked-examples-<topic>*.test.js` (recompute every quoted figure *and* assert the prose still
   quotes it);
9. `npm test && npm run lint:size && npm run build:css`, then the doc updates.
