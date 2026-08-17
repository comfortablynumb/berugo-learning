# Build state

Where the implementation stands, and exactly what the next session should pick up.
Update this file at the end of any session that leaves work unfinished.

**Last updated:** 2026-08-17

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

At the last green point: `npm test` = wiring audit (58 sections, 278 modules) +
**1 040 unit tests, 0 failing, 1 skipped**, `npm run lint:size` = 310 files, no offenders.

All nine M06 sections were opened in Chrome on `npm start`: the three tabs render, every demo
figure matches the prose, the references tab carries a full entry, and all nine graded exercises
were run through the **real Worker sandbox** — every solution passes (4/4 ×7, 5/5 ×1, 4/4), and
`exercises.test.js` holds every starter to failing at least one. Two bugs were found *only* by
that browser pass; see the M06 notes.

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

---

## Next

Roadmap build order (`doc/ROADMAP.md`): **M07 probabilistic and streaming sketches** → M08
spatial indexes → M09 persistent structures → onward through `doc/milestones/`.

The M07 spec is `doc/milestones/M07-probabilistic-structures.md`. The shape to copy, unchanged
through M06:

1. pure modules in `algorithms/` first, behind one shared interface;
2. a `machines/` harness that drives every implementation through that interface;
3. `viz/` renderers, and the CSS classes they need — M06 shipped `trie-view` and `matrix-view`
   with no styles until the browser pass;
4. `sections/<id>-template.js` + `<id>-section.js`, checking that **no metric id collides with an
   element id** in the same template;
5. the four content files, split per third of the milestone to stay under 1 000 lines;
6. wire `core/curriculum.js` (moving the milestone out of `planned`) and `index.html`;
7. `<topic>-modules.test.js` (property tests against a brute-force reference) and
   `worked-examples-<topic>.test.js` (recompute every quoted figure);
8. `npm test && npm run lint:size && npm run build:css`;
9. Chrome: every section, every tab, every demo figure against the prose, and every exercise
   through the real Worker sandbox.

Measure the figures *before* writing the prose that quotes them, and do not skip step 9 — the two
worst bugs in M06 were invisible to the whole test suite and obvious on the first page load.
