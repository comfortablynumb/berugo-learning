/** Concepts for the range-structure, vector-search and broad-phase sections (M08.7-M08.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'range-structures': [
      {
        term: 'Prefix sums, and the limit that motivates everything else',
        plain: 'Precompute every prefix and a range sum is two reads; but one changed element invalidates every prefix after it.',
        formal: 'query O(1), point update O(n)',
        detail: 'This is the right structure far more often than people admit - analytics tables that are ' +
          'rebuilt nightly and read all day want exactly this and nothing more. It is also the baseline that ' +
          'makes the rest of the file legible: every structure below is buying update cost with query cost, and ' +
          'the exchange rate is the whole subject. Measuring it rather than assuming it is worth doing, because ' +
          'the O(n) update is not a small n in practice.',
        example: 'n = 8 192: 4 088.88 array slots touched per update and exactly 2.00 per query.'
      },
      {
        term: 'Fenwick: one array, and i & −i',
        plain: 'Slot i covers the (i & −i) values ending at i, and that single expression is both the coverage and the step.',
        formal: 'update: i += i & −i;  prefix: i −= i & −i',
        detail: 'There are no children, no padding to a power of two and no recursion: a Fenwick tree over n ' +
          'values is n+1 numbers, which is half a segment tree\'s array and a quarter of its allocation. The ' +
          'lowest-set-bit expression is doing double duty - it is the length of the range a slot covers and the ' +
          'offset to the next slot to touch - which is why the code is four lines and why it is genuinely hard to ' +
          'read the first time. The restriction is that it needs an inverse: a range is one prefix minus another, ' +
          'so there is no Fenwick tree for min.',
        example: 'n = 8 192: 7.49 slots per update and 13.01 per query, at 8 bytes per element. log₂ 8 192 = 13.'
      },
      {
        term: 'Segment trees generalise to any monoid',
        plain: 'Store a combined value per node; anything associative with an identity works - min, max, gcd, matrices.',
        formal: 'node = combine(left, right); a query is the combination of at most 2 log n stored nodes',
        detail: 'The generalisation is the point and the constant is the price: a segment tree touches about four ' +
          'times as many array slots as a Fenwick tree for the same query, and costs four times the memory ' +
          'because the array is padded to 4n. Neither number is visible in "both are O(log n)", and both are ' +
          'decisive when the operation *does* have an inverse. The ten-second decision is: does my operation have ' +
          'an inverse, and do I need range updates.',
        example: 'n = 8 192: 14.00 slots per update and 44.90 per query, at 32 bytes per element against Fenwick\'s 8.'
      },
      {
        term: 'The canonical decomposition',
        plain: 'Any interval, however awkward, is the disjoint union of at most 2 log n stored nodes.',
        formal: '|decomposition(l, r)| ≤ 2⌈log₂ n⌉',
        detail: 'This is the structure\'s whole idea and it is worth looking at once as a list of ranges rather ' +
          'than as a proof. The nodes come in two staircases - one climbing out of the left endpoint by powers of ' +
          'two and one descending into the right - and the bound is two per level because at most one node per ' +
          'level can be partially covered on each side. Seeing the staircase is also what makes lazy propagation ' +
          'obvious: a pending update applies to whole canonical nodes, so it can wait at the node it covers.',
        example: 'The interval [1234, 6789] of 8 192 decomposes into 12 nodes: 1234-1235, 1236-1239, 1240-1247, … 2048-4095, 4096-6143, … 6788-6789.'
      },
      {
        term: 'Lazy propagation, and the convention that decides correctness',
        plain: 'A pending range update sits at the node it covers and is pushed to children only when someone descends.',
        formal: 'tree[node] is already correct for its subtree; lazy[node] is owed to the children',
        detail: 'Getting the convention backwards - storing a value that still needs its own pending update ' +
          'applied - produces a structure that is right whenever a query range happens to align with a node ' +
          'boundary, which is most hand-picked examples and none of a hundred thousand random ones. That is the ' +
          'single most common bug in this file, it never throws, and the only thing that finds it is a brute ' +
          'replay of the same operations on a plain array.',
        example: '100 000 mixed range-add and range-min operations over 8 192 values: 0 mismatches, 44.99 slots per operation.'
      },
      {
        term: 'Sparse tables: O(1) queries by overlapping',
        plain: 'Cover any range with two power-of-two blocks that overlap in the middle.',
        formal: 'query(l, r) = combine(table[k][l], table[k][r − 2^k + 1]) with k = ⌊log₂(r − l + 1)⌋',
        detail: 'Overlapping is only legal because the operation is idempotent - min(a, a) = a - which is exactly ' +
          'why there is no sparse table for sums, and why the module refuses a sum monoid instead of returning ' +
          'wrong answers. The price is O(n log n) memory and no updates at all: the table is built once from a ' +
          'static array. For a read-only array of static minima it is unbeatable, and for anything that changes ' +
          'it is not in the running.',
        example: 'n = 8 192: exactly 2.00 slots per query against the segment tree\'s 44.94, at 3.00× the memory.'
      },
      {
        term: 'Sqrt decomposition: worse on paper, written most often',
        plain: 'Blocks of √n each with a cached aggregate; a query walks two partial blocks and the whole blocks between.',
        formal: 'update O(√n), query O(√n)',
        detail: 'It loses to every tree here and it is the one people reach for under time pressure, because ' +
          'changing what it aggregates is two lines and there is no index arithmetic to get wrong. It is also the ' +
          'only structure in the file that extends painlessly to queries no monoid can express - "the k-th ' +
          'smallest in this range", "how many distinct values" - by keeping whatever per-block summary the ' +
          'question needs. Knowing when a worse asymptotic is the right engineering answer is part of the ' +
          'material.',
        example: 'n = 8 192: 91.00 slots per update and 118.40 per query, against Fenwick\'s 7.49 and 13.01. √8 192 = 90.5.'
      },
      {
        term: 'Order statistics need a merge-sort tree',
        plain: '"How many values below x in this range" is not a monoid, because the answer for a union is not a function of the halves\' answers.',
        formal: 'store each node\'s range sorted; a query binary-searches inside each canonical node',
        detail: 'The impossibility is worth being precise about: combining two counts requires knowing x at ' +
          'combine time, and a monoid\'s combine sees only the two stored values. Storing the sorted range ' +
          'instead makes the query O(log² n) - the canonical decomposition, then a binary search in each node - ' +
          'and costs O(n log n) memory because every level stores a full copy of the data. That is the price of ' +
          'a question the cheaper structures cannot ask.',
        example: 'n = 8 192: 44.85 nodes and 57.78 comparisons per query, at 112 bytes per element against Fenwick\'s 8.'
      }
    ],

    'vector-search': [
      {
        term: 'Exact search stops working, and the number says when',
        plain: 'Past about ten dimensions a k-d tree touches essentially every point, so it is a scan with pointer chasing added.',
        formal: 'vol(ball)/vol(cube) → 0, so almost every subtree intersects the search radius',
        detail: 'This is not a gradual slope with a usable middle. On the same 4 000 points a k-d tree touches ' +
          '0.3% of the data at two dimensions, 16.1% at eight, 99.5% at sixteen and 100% at thirty-two - and a ' +
          'VP-tree, which needs only a metric and prunes by the triangle inequality, does no better. The rule ' +
          'that follows is worth stating flatly: above roughly ten dimensions there is no exact index worth ' +
          'building, and the question changes from "which tree" to "what recall do I need".',
        example: '3 000 vectors in 48 dimensions: the VP-tree computes 2 992.67 distances per query of a possible 3 000.'
      },
      {
        term: 'Recall is the quantity, and it has to be measured',
        plain: 'The fraction of the true k nearest an approximate index actually returns, against brute force on your own data.',
        formal: 'recall@k = |returned ∩ true| / k',
        detail: 'An approximate index has no exact answer to be compared against, so "it works" is not a ' +
          'statement anyone can check - and a recall of 0.8 is not "slightly slower", it is a different answer ' +
          'three times in ten. Shipping without measuring it is how "the search got worse" bugs enter a product ' +
          'silently: latency dashboards look better after the change, and nothing at all reports the quality that ' +
          'was traded for it. Recall must be measured on the actual corpus; it does not transfer between ' +
          'datasets.',
        example: 'HNSW at M = 8: recall 58.8% at ef = 10, 83.0% at 32, 94.8% at 64 and 100% at 256. Same index, same data.'
      },
      {
        term: 'HNSW is a skip list in metric space',
        plain: 'A proximity graph at layer 0, a thinning subset at each layer above, and a greedy walk that descends.',
        formal: 'level ~ ⌊−ln(U)·1/ln M⌋; enter at the top, walk greedily, drop a layer, repeat',
        detail: 'The upper layers are long-range links, and they do exactly what a skip list\'s upper levels do ' +
          'over a sorted list: without them a greedy walk on a proximity graph takes O(n^(1/d)) hops to cross the ' +
          'space, and with them it takes a logarithmic number. The layer assignment is the same exponential draw ' +
          'as a skip list\'s coin flips, and the resulting layer sizes fall by roughly a factor of M each time, ' +
          'so the top layers hold a handful of nodes and cost nothing.',
        example: '3 000 vectors at M = 8: 3 000 nodes at layer 0, 375 at layer 1, 60 at layer 2 and 8 at layer 3.'
      },
      {
        term: 'M is a build decision, ef is a query dial',
        plain: 'M fixes the connections per node and costs memory; ef sizes the search beam and can change per request.',
        formal: 'M and efConstruction are baked into the graph; ef is passed at query time',
        detail: 'This split is what makes the structure deployable: one index serves a cheap autocomplete request ' +
          'at ef = 16 and an accurate batch job at ef = 256, with no rebuild and no second copy. The corollary is ' +
          'the trap - efConstruction is *not* recoverable at query time. A graph built with too narrow a beam has ' +
          'the wrong edges, and no amount of query-time ef finds neighbours the graph does not link to.',
        example: 'Same M and same query ef: efConstruction 48 reaches 91.4% recall where efConstruction 200 reaches 96.8%.'
      },
      {
        term: 'The neighbour heuristic is what makes the graph navigable',
        plain: 'Keep a candidate only if the new node is closer to it than any already-kept neighbour is.',
        formal: 'keep c iff d(new, c) < d(kept_i, c) for every kept_i',
        detail: 'Taking the M nearest instead builds a graph with exactly the same degree that a greedy walk gets ' +
          'stuck in, because all M links point into the cluster the node is already in and none bridge to ' +
          'anywhere else. The heuristic spends the same budget on links that reach somewhere new, which is what ' +
          'keeps the walk from having to backtrack. It has to be paired with a fill-back rule, because a node ' +
          'the heuristic leaves with one link is a dead end.',
        example: 'Same M, same efConstruction, same query ef: the heuristic reaches materially higher recall than nearest-M.'
      },
      {
        term: 'IVF: partition, then probe',
        plain: 'k-means the corpus into lists and search only the few lists nearest the query.',
        formal: 'cost ≈ lists + probe·(n/lists); recall rises with probe',
        detail: 'The failure is structural rather than random: a true neighbour just over a cell boundary is ' +
          'invisible no matter how many vectors the probed lists hold, which is why raising `probe` helps and ' +
          'raising the list count alone does not. It is the easiest index here to reason about and to shard - ' +
          'each list is an independent shard - and it is the base layer of nearly every production vector store, ' +
          'usually with quantised codes inside each list.',
        example: '3 000 vectors, 64 lists: probe 1 gives 32.5% recall for 109.37 distances, probe 8 gives 95.0% for 442.83.'
      },
      {
        term: 'Product quantisation: one byte per subspace',
        plain: 'Split the vector into parts, cluster each part separately, and store the centroid index instead of the numbers.',
        formal: 'a d-dimensional float vector becomes `parts` bytes; distance is a table lookup per part',
        detail: 'The distance is asymmetric on purpose - the query stays exact and only the stored side is ' +
          'quantised - which costs one lookup table per query and is much more accurate than quantising both ' +
          'sides. The memory result is dramatic: 48 floats is 384 bytes and eight codes is eight. The recall ' +
          'result taken alone is dismal, and that is not a bug: on its own the structure is a shortlist ' +
          'generator, not a search index.',
        example: '3 000 vectors of 48 dimensions: 384 bytes each becomes 8, and recall@10 falls from 100% to 39.5%.'
      },
      {
        term: 'Re-ranking is what makes a quantised index usable',
        plain: 'Fetch a wide shortlist with the cheap codes, then rescore it with the exact vectors.',
        formal: 'retrieve k·R candidates approximately, compute R·k exact distances, keep the top k',
        detail: 'This is not an optimisation bolted on afterwards; it is the design, and quoting a quantiser\'s ' +
          'standalone recall describes a system nobody ships. The honest accounting has to include what ' +
          're-ranking needs: the exact vectors, somewhere. In a real deployment they live on disk or on a ' +
          'colder tier and the codes live in RAM, so the memory win is real - but it is a win in *fast* memory, ' +
          'not in total bytes, and saying otherwise is the most common overclaim in this area.',
        example: 'The same 8-byte codes: 39.5% recall alone, 83.3% re-ranking 5×, 95.0% at 10× and 99.0% at 20×.'
      }
    ],

    'broad-phase': [
      {
        term: 'The broad phase may be wrong in one direction only',
        plain: 'It may propose pairs that do not touch; it may never miss a pair that does.',
        formal: 'proposed ⊇ actual; the narrow phase computes actual from proposed',
        detail: 'That asymmetry is what makes the split work and what makes the broad phase cheap: it can use ' +
          'axis-aligned boxes, a grid, anything conservative, because a false positive costs one exact test and ' +
          'a false negative costs a bug nobody can reproduce. It also fixes the only two numbers worth reporting ' +
          '- pairs tested and pairs found - since their ratio is the whole difference between a working broad ' +
          'phase and an expensive no-op that happens to return the right answer.',
        example: '400 bodies: all pairs tests 79 800 per frame, sweep and prune 2 370.47, a grid 109.97 - all returning the same 70.78 pairs.'
      },
      {
        term: 'Sweep and prune sorts on one axis and scans forward',
        plain: 'Sort the boxes by their low edge; for each, test forward only while the next box starts before this one ends.',
        formal: 'stop the inner scan at the first b with b.min > a.max',
        detail: 'The early exit is the whole algorithm, and it prunes on one axis only - which is the honest ' +
          'limitation. Two objects far apart vertically but overlapping horizontally are still tested, so on a ' +
          'scene that is wide in both directions the pruning is one-dimensional and a grid does better. It is ' +
          'chosen anyway when objects vary wildly in size, which breaks a uniform grid, or when the world is ' +
          'unbounded, or when allocation per frame is unacceptable.',
        example: 'On this scene sweep and prune tests 2 370.47 pairs per frame and a spatial hash tests 109.97 - the grid wins by 21×.'
      },
      {
        term: 'Temporal coherence is why the insertion sort is right',
        plain: 'Between two frames almost nothing changes order, so re-sorting the previous order costs almost nothing.',
        formal: 'insertion sort is O(n + inversions), and inversions per frame is near zero',
        detail: 'This is the one place where insertion sort is the correct choice rather than the naive one, and ' +
          'it is worth seeing the two numbers side by side: the first frame is a full sort of a random order at ' +
          'about n²/4 swaps, and every frame after it is a couple of hundred. A comparison-optimal sort would be ' +
          'slower here, because O(n log n) is a *lower bound* on comparisons and insertion sort is not paying it ' +
          '- the input is not random.',
        example: '400 bodies: frame 1 costs 41 177 swaps, frame 2 costs 165, and the mean over the rest is 164.15.'
      },
      {
        term: 'A grid prunes in two dimensions and rebuilds each frame',
        plain: 'Bucket the boxes by cell every frame and test only within and across neighbouring cells.',
        formal: 'cost = n insertions + n queries, with no state carried between frames',
        detail: 'Having no state is both the cost and the point: the grid does strictly more work per frame than ' +
          'an incremental structure on a well-behaved scene, and it is completely unbothered by an object that ' +
          'teleports, spawns or despawns - the cases that corrupt an incrementally maintained sorted order if ' +
          'the bookkeeping is not exactly right. On a scene of similarly sized objects in a bounded world it also ' +
          'happens to be the fastest thing here.',
        example: 'The grid tests 109.97 pairs per frame against sweep and prune\'s 2 370.47, for the identical pair set.'
      },
      {
        term: 'Tunnelling: a contact neither endpoint of the step can see',
        plain: 'A body moving further than its own size can be on either side of another and touch it at neither sample.',
        formal: 'the swept test has a root in [0, dt] and neither frame\'s contact set contains the pair',
        detail: 'This is a property of the time step, not of the index: no broad phase fixes it, and testing all ' +
          'pairs exactly at the frame boundaries misses it just as thoroughly as the cheapest grid does. It is ' +
          'also worth defining precisely, because the loose version over-counts badly - a contact that begins ' +
          'mid-step and is still a contact at the next sample is one frame of latency, which every discrete ' +
          'engine has, and is not tunnelling at all.',
        example: 'A static disc and one crossing it at 1 200 units/s: apart at the start of the step, apart at the end, overlapping in between.'
      },
      {
        term: 'The miss rate is a function of travel per frame',
        plain: 'Express speed as diameters travelled per step and the failure appears exactly where you would expect.',
        formal: 'misses ≈ 0 below ~0.5 diameters per step, and climb steeply above 1',
        detail: 'Below half a diameter of travel the samples overlap enough that essentially nothing is missed; ' +
          'at one diameter the failure is already material, and beyond that it dominates. That makes the ' +
          'engineering rule concrete rather than folkloric - bound the product of maximum speed and time step ' +
          'against the smallest object radius, and either clamp the speed or subdivide the step when the bound is ' +
          'exceeded.',
        example: '400 bodies of radius 6 over 120 frames: 0 misses at 0.04 diameters per step, 61 at 0.42, 4 510 at 1.67 and 15 445 at 3.33.'
      },
      {
        term: 'Shrinking the step is the blunt fix, and it works',
        plain: 'Halving the time step roughly quarters the missed contacts, at twice the frames.',
        formal: 'misses fall super-linearly in dt because both the travel and the exposure shrink',
        detail: 'It is not elegant and it is what most engines actually do, under the name substepping, because ' +
          'the alternative - continuous collision detection for every pair - is far more expensive and far more ' +
          'code. The usual production compromise is to substep only the fast bodies, or to run a swept test only ' +
          'for pairs whose combined travel exceeds their combined radius, which is a cheap conservative filter.',
        example: 'At 600 units/s: 32.96% of contacts missed at dt = 1/30, 5.14% at 1/60, 0.66% at 1/120 and 0.07% at 1/240.'
      },
      {
        term: 'The continuous test is a quadratic in t',
        plain: 'Relative motion is a straight line, so "do these two ever touch during the step" is a root-finding question.',
        formal: '|Δp + tΔv|² = (r₁ + r₂)² has a root in [0, dt]',
        detail: 'Writing it down is what turns tunnelling from a mystery into arithmetic, and the same quadratic ' +
          'is the exact-time-of-impact solver a continuous engine uses. Two cases have to be handled before the ' +
          'discriminant: already overlapping at t = 0, which returns immediately, and zero relative velocity, ' +
          'which has no quadratic term at all and would divide by zero. Both are common - resting contacts and ' +
          'bodies moving together are the normal state of a physics scene.',
        example: 'A disc at rest and one at 1 200 units/s 20 units away: the root lies at about 0.015 s, inside a 0.033 s step.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
