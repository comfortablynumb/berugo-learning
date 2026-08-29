/** Concepts for the R-tree, BVH and space-filling-curve sections (M08.4-M08.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'r-trees': [
      {
        term: 'Minimum bounding rectangles, and siblings that overlap',
        plain: 'Every node stores the smallest rectangle covering its children, and two siblings may cover the same ground.',
        formal: 'MBR(node) = ⋃ MBR(child); MBR(a) ∩ MBR(b) need not be empty',
        readAs: 'A node\'s bounding rectangle is the union of its children\'s — the smallest box holding all ' +
          'of them. Unlike a k-d tree, sibling boxes are allowed to overlap, and that overlap is what ' +
          'forces a query down more than one path.',
        detail: 'This is the one structural difference from every other index in the milestone, and every ' +
          'property of an R-tree follows from it. A quadtree or a k-d tree partitions space, so a point lies in ' +
          'exactly one leaf and a point query follows one path. An R-tree covers space, so a point can lie inside ' +
          'several MBRs and a point query may have to follow several paths at once. That makes the height almost ' +
          'irrelevant and the overlap decisive, which is why the split heuristic - the thing that creates the ' +
          'overlap - is the whole design.',
        example: '20 000 rectangles: the same height 6 gives 2 250.07 candidates per query at 113.69% overlap and 239.13 at 24.49%.'
      },
      {
        term: 'Overlap governs query cost, not height',
        plain: 'Every extra intersecting sibling is another subtree the query has to enter.',
        formal: 'expected paths ≈ Π over levels (1 + overlap fraction at that level)',
        readAs: 'The Π is a product rather than a sum: multiply together, level by level, one plus how much ' +
          'the boxes overlap. Overlap compounds down the tree, which is why a small amount high up ' +
          'costs so much.',
        detail: 'Two trees can hold the same rectangles at the same height with the same fan-out and differ by an ' +
          'order of magnitude in query cost, which is not something the usual "O(log n)" summary can express. ' +
          'Overlap accumulates multiplicatively down the levels, so a small excess near the root is far more ' +
          'expensive than the same excess at the leaves. Measuring the total sibling intersection area as a ' +
          'fraction of the covered area gives one number that ranks the heuristics correctly, and it ranks them ' +
          'in the same order as the measured query cost.',
        example: 'first-fit 113.69% overlap → 356.04 nodes visited; R* 24.49% → 36.69. Same height, same data.'
      },
      {
        term: 'Choose the subtree that grows least',
        plain: 'Insert into the child whose rectangle has to expand the least, breaking ties by the smaller rectangle.',
        formal: 'argmin area(MBR(child) ∪ r) − area(MBR(child)), ties to smaller area',
        readAs: '"argmin" means "the child that minimises this", not the value itself. Choose whichever child ' +
          'grows least when the new rectangle is added, and break ties towards the smaller box.',
        detail: 'The tie-break is not cosmetic. Enlargement is frequently zero for several children at once - any ' +
          'child already containing the new rectangle enlarges by nothing - and without a second criterion the ' +
          'first such child wins every time, so one node grows fat and the tree skews. Choosing the smallest ' +
          'among the zero-enlargement candidates keeps the rectangles balanced by area, which is what keeps the ' +
          'overlap down at the next level.',
        example: 'Both quadratic and R* use this rule; they differ only in what happens when the chosen node overflows.'
      },
      {
        term: 'The split heuristic is the design',
        plain: 'When a node overflows, how you divide its entries decides how much the two halves overlap forever after.',
        formal: 'linear O(M), quadratic O(M²), R* O(M log M) over 4 sorted orders',
        detail: 'Guttman offered linear and quadratic and argued the quadratic pick was worth its extra cost; the ' +
          'R*-tree replaced both with a two-stage rule - choose the axis by the smallest total perimeter, then ' +
          'the cut on that axis by the smallest overlap. Measured on 20 000 rectangles the ranking is not the one ' +
          'the folklore gives: R* is decisively best, and linear very slightly beats quadratic. That is worth ' +
          'knowing before spending O(M²) on a heuristic that is not buying anything on your data.',
        example: 'Overlap ratio: first-fit 113.69%, linear 57.67%, quadratic 59.58%, R* 24.49%.'
      },
      {
        term: 'Forced reinsertion undoes an early mistake',
        plain: 'On the first overflow, take the entries furthest from the node\'s centre out and insert them again from the root.',
        formal: 'remove the outer 30% by centre distance, reinsert closest-first, at most once per insertion',
        detail: 'A split can only divide the entries a node happens to hold, so a rectangle placed badly early - ' +
          'when the tree was small and every choice looked equal - stays badly placed and is split around forever. ' +
          'Reinsertion is a chance to reconsider with the tree as it is now, and it is where most of the R*-tree\'s ' +
          'advantage comes from. It must be limited to once per insertion or the recursion does not terminate, ' +
          'and it must be queued rather than run mid-descent, or a split can replace a node the outer recursion ' +
          'is still holding.',
        example: 'R* reaches 24.49% overlap where the same split rule without reinsertion cannot get near it.'
      },
      {
        term: 'STR bulk loading packs the leaves',
        plain: 'Sort by x, cut into vertical slices, sort each slice by y, and fill pages to capacity.',
        formal: 'slices = ⌈√(n/M)⌉; each slice is packed into ⌈n/(slices·M)⌉ full pages',
        readAs: 'Sort-tile-recursive packing: cut the points into that many vertical slices, then fill each ' +
          'slice with full pages. Bulk-loading this way gives far less overlap than inserting one at a ' +
          'time.',
        detail: 'Incremental insertion leaves pages about 70% full because every split makes two half-empty ' +
          'nodes, so the tree is taller than it needs to be and every query pays for the extra level. A ' +
          'sort-tile-recursive build fills pages to capacity and produces near-disjoint tiles rather than ' +
          'whatever the insertion order happened to leave. It also breaks Guttman\'s minimum-fill invariant on ' +
          'purpose - the last page of each slice is short - so a test asserting that invariant against an STR ' +
          'tree is checking the wrong structure.',
        example: 'Incremental: 3 186 leaves, 69.7% full, height 6. STR: 2 254 leaves, 98.6% full, height 5.'
      },
      {
        term: 'Rebuild rather than maintain',
        plain: 'A bulk-loaded tree beats an incrementally built one so reliably that most systems rebuild periodically.',
        formal: 'STR: 28.43 nodes visited per query against 85.32 for incremental quadratic',
        detail: 'The measured gap is a factor of three on query cost and it does not close as the tree ages - it ' +
          'widens, because every insertion adds overlap and nothing removes it. Against that, a rebuild is O(n ' +
          'log n) and takes the index offline or needs a shadow copy. Systems resolve it the same way they ' +
          'resolve every other version of this question: rebuild during a maintenance window, or keep a small ' +
          'incremental delta over a large bulk-loaded base and merge on a schedule.',
        example: 'STR answers with 28.43 node visits and 247.48 candidates; R* with 36.69 and 239.13; quadratic with 85.32 and 547.07.'
      },
      {
        term: 'This is the spatial index databases actually ship',
        plain: 'PostGIS, SQLite, Oracle and SQL Server all index geometry with an R-tree or a close relative.',
        formal: 'GiST over R-tree operators in PostgreSQL; the R*Tree virtual table in SQLite',
        detail: 'The reason is that an R-tree indexes *extents* rather than points, which is what geometry ' +
          'actually is, and that it is a paged structure with a controllable fan-out - a node is a disk page, and ' +
          'the fan-out is chosen so it fills one. A quadtree over a bounded domain would need the domain fixed at ' +
          'schema time; a k-d tree cannot be updated in place. Neither objection applies to an R-tree, and both ' +
          'are fatal for a database.',
        example: 'Fan-out 9 here for legibility; a real 8 KB page holds on the order of 100 entries and gives height 4 for 10⁸ rows.'
      }
    ],

    'bounding-volumes': [
      {
        term: 'Partition the primitives, not the space',
        plain: 'A BVH splits the list of objects into two groups and bounds each; the boxes may overlap.',
        formal: 'every primitive appears in exactly one leaf, unlike a k-d tree over the same scene',
        detail: 'A k-d tree splits space, so a triangle crossing the plane must be referenced from both sides and ' +
          'the reference count is not known before the build finishes. A BVH splits the primitive list, so the ' +
          'reference count is exactly n and the tree can be sized in advance. The consequence that matters for ' +
          'animation is that the topology stays valid when the primitives move - only the boxes are wrong, and ' +
          'boxes can be recomputed bottom-up in one pass.',
        example: '20 000 triangles build 13 273 nodes with 6 637 leaves and exactly 20 000 primitive references.'
      },
      {
        term: 'The slab method, and the NaN that eats it',
        plain: 'Intersect the ray with each axis\'s pair of planes and keep the overlap of the intervals.',
        formal: 'tnear = max over axes of min(t₀,t₁); tfar = min over axes of max(t₀,t₁); hit iff tnear ≤ tfar',
        readAs: 'For each axis work out when the ray enters and leaves the slab. The ray is inside the box ' +
          'only while it is inside every slab at once, so take the latest entry and the earliest exit — ' +
          'and if the entry comes after the exit, it misses.',
        detail: 'The classic bug is the axis-parallel ray. With a direction component of zero the reciprocal is ' +
          'infinite, and if the origin sits exactly on a slab plane the numerator is zero, so the product is 0 × ' +
          '∞ = NaN. Every comparison against NaN is false, the interval test silently reports a miss, and the box ' +
          'vanishes - on precisely the axis-aligned scenes that make up most test content. Handling the ' +
          'zero-direction case explicitly costs one branch per axis and removes the whole class.',
        example: 'A ray along +x whose origin lies on the y = min plane must enter the box, and the naive form returns a miss.'
      },
      {
        term: 'The surface-area heuristic is a cost model',
        plain: 'Estimate what a split will cost a random ray, and pick the split that minimises the estimate.',
        formal: 'C = Ct + Ci·(A(L)·N(L) + A(R)·N(R))/A(P)',
        readAs: 'The surface-area heuristic: the cost of a split is a fixed traversal cost, plus the ' +
          'intersection cost weighted by how likely a random ray is to enter each side. That likelihood ' +
          'is the child\'s surface area over the parent\'s.',
        detail: 'The assumption underneath is precise and worth stating: for a uniformly distributed ray that ' +
          'already hits the parent box, the probability of hitting a child is the ratio of their surface areas. ' +
          'That turns "which split is better" into arithmetic instead of taste, which is what the word heuristic ' +
          'obscures - this is an expected-cost estimate with a stated model, not a rule of thumb. Writing the ' +
          'estimate down is also what makes it arguable: when the SAH picks badly you can point at which term was ' +
          'wrong.',
        example: 'The measured SAH cost of the median tree is 65.81 and of the SAH tree 49.44 - and the ray counts follow.'
      },
      {
        term: 'The SAH also decides not to split',
        plain: 'If no split beats leaving the primitives in one leaf, make a leaf.',
        formal: 'leaf when min C(split) ≥ Ci·N',
        readAs: 'Stop splitting once the best available split costs at least as much as simply testing every ' +
          'primitive in the node. The heuristic decides where the leaves are, rather than a fixed depth ' +
          'or count.',
        detail: 'A builder that always splits until a fixed leaf size produces a deeper tree whose extra levels ' +
          'cost traversal and buy no pruning, because the children\'s boxes are nearly the parent\'s. Comparing ' +
          'the best split cost against the cost of not splitting is one extra comparison, and it terminates the ' +
          'recursion where the geometry says it should. How much that is worth depends entirely on the leaf ' +
          'size it competes with, and the demo reports the count rather than assuming it: on this scene the ' +
          'branch fires 69 times at a leaf size of 1 and never at a leaf size of 4, because four primitives are ' +
          'already cheaper than any split of them. It is the rule that makes a small leaf size safe, not the ' +
          'rule that makes the tree small.',
        example: 'Leaf size 1: the branch fires 69 times and the tree costs 36.28. Leaf size 4: it never fires.'
      },
      {
        term: 'Binning makes the SAH affordable',
        plain: 'Instead of evaluating every possible split, bucket the centroids and evaluate only the bin boundaries.',
        formal: 'two linear sweeps give every bin boundary\'s cost in O(bins) after O(n)',
        detail: 'An exact SAH evaluates n−1 splits per axis and each needs the two child boxes, which is O(n²) ' +
          'unless the sweep is done incrementally; sorting first makes it O(n log n) per axis per node and is ' +
          'still the expensive part of a build. Binning replaces it with one pass to fill the bins and two ' +
          'sweeps - prefix from the left, suffix from the right - so each candidate costs O(1). Twelve to sixteen ' +
          'bins gives a tree within a couple of percent of the exact SAH.',
        example: '16 bins over 3 axes: 20 000 triangles build in about 70 ms against 42 ms for a median split.'
      },
      {
        term: 'Traverse with an explicit stack, nearest child first',
        plain: 'Push both children, visit the one the ray points at first, and re-test the other against the closest hit found.',
        formal: 'skip a node when its entry distance ≥ the current closest hit',
        detail: 'Visiting the near child first is what makes the far child skippable: once a hit is found, ' +
          'anything entering beyond it cannot matter. Re-testing at pop time rather than at push time is the ' +
          'detail that makes this work - the bound has usually tightened in between. The stack is explicit ' +
          'because a scene is traversed millions of times after being built once, so per-ray call overhead is the ' +
          'entire budget, and because a degenerate scene builds a deep tree.',
        example: 'Of 1 000 rays over 20 000 triangles, the SAH tree visits 25.71 nodes and tests 7.76 primitives each.'
      },
      {
        term: 'Refitting works for coherent motion and only that',
        plain: 'Recompute the boxes bottom-up after the primitives move; the topology is untouched.',
        formal: 'box(node) = box(left) ∪ box(right), one post-order pass',
        readAs: 'Every node\'s box is just its two children\'s boxes merged, so refitting the whole tree ' +
          'after the geometry moves is a single bottom-up sweep — no rebuild required.',
        detail: 'When neighbouring primitives move together the grouping is still the right grouping and refitting ' +
          'is as good as rebuilding, at a fraction of the cost - which is why animated scenes refit per frame and ' +
          'rebuild occasionally. When primitives move independently the grouping becomes nonsense: the boxes are ' +
          'still correct, so nothing fails, and the tree quietly stops pruning. The way to know which regime you ' +
          'are in is to track the tree\'s SAH cost across frames and rebuild when it drifts.',
        example: 'Coherent motion: refit cost 49.95 against a rebuild\'s 50.85. Scattered: 258.29 against 50.76, and 82.32 primitives per ray against 9.61.'
      },
      {
        term: 'BVH against k-d tree in ray tracing',
        plain: 'The BVH refits, bounds its memory and never duplicates a primitive; the k-d tree prunes empty space better.',
        formal: 'BVH: n references, overlapping boxes. k-d: unbounded references, disjoint cells',
        detail: 'A k-d tree can cut away a genuinely empty region in one plane, which a BVH cannot do because its ' +
          'boxes must contain their primitives; on static scenes with lots of empty space the k-d tree still ' +
          'wins on ray throughput. Everything else favours the BVH: predictable memory, no duplication, a cheap ' +
          'refit for animation, and a build that parallelises cleanly. Production renderers moved to BVHs for ' +
          'those reasons rather than for raw traversal speed, which is the honest version of the story.',
        example: 'The refit path is the argument: 20 000 moving triangles keep their topology and are re-bounded in one pass.'
      }
    ],

    'space-filling-curves': [
      {
        term: 'One number for two coordinates',
        plain: 'Interleave the bits of x and y and you have a single integer that mostly preserves nearness.',
        formal: 'morton(x, y) = Σ (x_i·2^(2i) + y_i·2^(2i+1))',
        readAs: 'Interleave the bits of the two coordinates — one from x, one from y, alternating — into a ' +
          'single number. That one number sorts nearby points near each other, which is what turns a ' +
          '2-D index into a 1-D one.',
        detail: 'This is the trick that lets a store with no spatial index at all answer spatial queries: the ' +
          'curve index becomes the sort key, and a rectangle becomes a set of key ranges, and a range scan is the ' +
          'one operation every ordered store already does well. It is why DynamoDB, Bigtable and every ' +
          'geo-partitioned key-value layout in production is Z-order or S2 underneath. The encoding itself is ' +
          'about ten lines of bit twiddling; everything interesting is in what happens to rectangles.',
        example: 'x and y of 16 bits each interleave into one 32-bit code, and the decode is the same shifts run backwards.'
      },
      {
        term: 'A rectangle is not one range',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a query rectangle in 2D"] --> B["its cells are scattered along<br/>the curve, not contiguous"]',
            '    B --> C["so it becomes many separate<br/>ranges on the 1D index"]',
            '    C --> D["merge adjacent ranges across<br/>the smallest gaps"]',
            '    D --> E["fewer round trips,<br/>more cells read and discarded"]'
          ].join('\n'),
          caption: 'The curve preserves nearness well enough to be useful and not well enough to be exact, and that gap is paid for in either round trips or false positives.'
        },
        plain: 'The cells of a rectangle are scattered along the curve, so a window query becomes many separate scans.',
        formal: 'ranges(rect) = the number of maximal runs of consecutive indices covering it',
        readAs: 'How many separate contiguous stretches of the curve a query rectangle breaks into. Each run ' +
          'is one range scan, so fewer runs means fewer seeks.',
        detail: 'This is the whole practical problem and it is invisible from the encoding. A 306-cell rectangle ' +
          'on a 64 × 64 grid decomposes into 45 separate Z-order ranges spanning 772 indices - so an exact answer ' +
          'means 45 round trips, and one scan of the whole span means reading 772 cells to get 306. Everything ' +
          'about using curves as a spatial index is negotiating between those two numbers, and the negotiation ' +
          'is what the "jump-in" trick and every geohash query planner is doing.',
        example: 'The same 18 × 17 rectangle: 45 Morton ranges over a span of 772, or 22 Hilbert ranges over 758.'
      },
      {
        term: 'Coalescing trades false positives for round trips',
        plain: 'Merge adjacent ranges across the smallest gaps until the count fits a budget, and scan the gaps too.',
        formal: 'scanned = cells + Σ (merged gap sizes)',
        readAs: 'Merging two nearby ranges into one saves a round trip and costs you everything in the gap ' +
          'between them. The total scanned is what you wanted plus the sum of every gap you decided to ' +
          'swallow.',
        detail: 'A store that charges per request rather than per row would much rather read a few extra cells ' +
          'than issue forty scans, so the real query planner picks a range budget and merges cheapest-gap-first ' +
          'up to it. The cost curve is steep at the low end and flat afterwards, which makes the decision easy ' +
          'once it is measured: going from four ranges to eight halves the waste, and going from sixteen to ' +
          'thirty-two barely changes it.',
        example: 'Hilbert, 306 cells: 4 ranges scan 436 cells (42.5% waste), 8 scan 347 (13.4%), 16 scan 320 (4.6%).'
      },
      {
        term: '"Hilbert has better locality" is false under the obvious metric',
        plain: 'The mean index gap between two neighbouring cells is larger for Hilbert than for Z-order.',
        formal: 'measured at order 6: mean gap 39.05 for Hilbert against 32.50 for Morton',
        detail: 'The claim gets repeated because Hilbert\'s curve is continuous - it never jumps, where Z-order ' +
          'crosses the whole grid at every power-of-two boundary - and continuity is the property people picture. ' +
          'But "how far apart in the index are two adjacent cells" is a different question, and by it Z-order ' +
          'wins on both the mean and the worst case. This is a good example of a folk claim that survives ' +
          'because nobody states which metric it is about; the fix is to name the metric the cost model actually ' +
          'uses.',
        example: 'Worst neighbour gap: Hilbert 3 413, Morton 1 366. Maximum step along the curve: Hilbert 1, Morton 63.'
      },
      {
        term: 'And true under the metric that decides query cost',
        plain: 'The number that matters is how many contiguous runs a window breaks into, and there Hilbert wins by about two.',
        formal: 'mean ranges for a 16 × 16 window at order 6: 15.68 Hilbert against 29.49 Morton',
        detail: 'Runs are round trips, and round trips are what a query costs in any real store, so this is the ' +
          'metric the cost model actually contains. The factor is close to two at every window size measured and ' +
          'is stable across placements, which is what makes it a usable design rule rather than an anecdote. The ' +
          'price is that a Hilbert conversion is a loop with a rotation per level, against Morton\'s four shift ' +
          'and mask steps - so the decision is encode cost against query cost.',
        example: 'Cells per range: Hilbert 4.06, 8.14, 16.33 at window sides 4, 8, 16; Morton 2.56, 4.59, 8.68.'
      },
      {
        term: 'Geohash is Z-order with an alphabet',
        plain: 'Interleave longitude and latitude bits, then write them five at a time in base 32.',
        formal: 'each character is 5 bits, so precision p covers 5p bits split between the two axes',
        readAs: 'A geohash character carries 5 bits, alternating between longitude and latitude. More ' +
          'characters means a smaller cell, and the shared prefix of two geohashes tells you how close ' +
          'they are.',
        detail: 'The property that makes geohash useful is a direct consequence: because the bits are ' +
          'interleaved from the most significant end, a prefix of a geohash *is* a bounding box, and truncating ' +
          'the string is zooming out. That makes "everything near here" a prefix scan in any ordered store, with ' +
          'no spatial support at all. It also inherits Z-order\'s weakness intact - two points either side of a ' +
          'major boundary have completely different prefixes, so a correct query has to check the neighbouring ' +
          'cells too.',
        example: 'The point 51.5007 N, 0.1246 W is gcpuvpmm2; three characters cover 156 km of latitude, five cover 4.9 km, seven cover 153 m.'
      },
      {
        term: 'The boundary problem, and why every query checks neighbours',
        plain: 'Two points a metre apart can sit either side of a cell boundary and share no prefix at all.',
        formal: 'adjacency in space does not imply adjacency in the code; the worst neighbour gap is Θ(grid area)',
        readAs: 'Two points can be side by side on the map and at opposite ends of the curve. The worst gap ' +
          'grows with the whole grid, which is why a range query has to be split into runs at all.',
        detail: 'The standard fix is to compute the query cell and its eight neighbours and scan all nine ' +
          'prefixes, which is why every geohash proximity recipe has that step and why leaving it out produces a ' +
          '"nearby" list that mysteriously omits things across a street. S2 and H3 exist largely to make this ' +
          'less painful - S2 by using Hilbert order on a projected cube, H3 by using hexagons, whose neighbours ' +
          'are all edge-adjacent so there is no diagonal case at all.',
        example: 'Morton\'s worst adjacent-cell gap at order 6 is 1 366 indices - the two cells are neighbours in space and a grid apart in the key.'
      },
      {
        term: 'A curve index is a filter, not an answer',
        plain: 'Scanning the ranges gives a superset; the exact predicate still has to be applied to what comes back.',
        formal: 'cells are a discretisation, so a cell overlapping the query may hold points outside it',
        detail: 'The curve indexes cells, and a query is a shape, so anything at cell granularity is approximate ' +
          'by construction - even before any range coalescing. The pipeline is therefore always the same: ' +
          'decompose the shape into ranges, scan them, then filter exactly. That is the same shape as the ' +
          'broad-phase/narrow-phase split in 8.9 and the candidate/verify split in an LSH index, and recognising ' +
          'it is what stops people expecting an index to be exact.',
        example: 'Even at zero coalescing the 306 cells of the demo rectangle are cells, not the rectangle: their contents still need testing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
