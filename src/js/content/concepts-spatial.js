/** Concepts for the grid, quadtree and k-d tree sections (M08.1-M08.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'uniform-grids': [
      {
        term: 'Bucket by cell, scan the neighbourhood',
        plain: 'Divide space into equal squares, put each object in the square it lands in, and a query reads only the squares it touches.',
        formal: 'cell(x, y) = (⌊x/c⌋, ⌊y/c⌋); a radius-r query reads the cells covering [x±r, y±r]',
        readAs: 'Divide each coordinate by the cell size and round down, and you have the cell a point lives ' +
          'in. A query within radius r has to read every cell touching the square from x−r to x+r and ' +
          'y−r to y+r.',
        detail: [
          'There is no tree, no balancing and no comparison: the cell index is two divisions and ' +
            'the bucket is an array offset.',
          'That is the entire structure, and it is why a grid beats every tree in this milestone ' +
            'whenever the data is evenly dense.',
          'The constant factor of "compute an index, read an array" is unbeatable by anything that ' +
            'follows pointers.',
          'Everything a grid gets wrong follows from the same fact. The cells are fixed before the ' +
            'data arrives, so the structure cannot react to where the data actually is.'
        ],
        example: '20 000 points in 1 000 × 1 000 with 25-unit cells: a radius-25 query reads 9 cells and tests 109.98 points to return 38.48.'
      },
      {
        term: 'The cell size is a work minimum, not a rule of thumb',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["cells much smaller than<br/>the query radius"] --> B["scan many nearly empty buckets —<br/>overhead dominates"]',
            '    C["cells much larger"] --> D["scan few buckets, each full of<br/>objects that are far away"]',
            '    B --> E["total work has a minimum<br/>in between"]',
            '    D --> E',
            '    E --> F["and it is measurable,<br/>not a matter of taste"]'
          ].join('\n'),
          caption: 'There is a genuine optimum here and it moves with the data density and the query radius, which means it can be measured rather than argued about.'
        },
        plain: 'Small cells scan many nearly empty buckets; large cells scan few buckets full of far-away objects.',
        formal: 'work(c) ≈ (⌈2r/c⌉+1)² + ρ·((⌈2r/c⌉+1)·c)²',
        readAs: 'Two costs pull in opposite ways. The number of cells you visit grows as cells get ' +
          'smaller, and the points inside them grow as cells get larger. Here ρ is the point ' +
          'density, and the best cell size is where the two curves cross.',
        detail: [
          'Both terms are visible in the same sweep and they move in opposite directions, so the ' +
            'total has a genuine minimum rather than a monotone slope.',
          'The folklore answer - "make the cell the query radius" - is close but not exact.',
          'On 20 000 uniform points with radius 25 the measured minimum is at a cell of 15. There, ' +
            '18.84 cells and 82.22 candidates cost less than the 9 cells and 109.98 candidates at ' +
            'c = 25.',
          'The right move is to sweep it once against your own density and query radius, because ' +
            'both appear in the formula and neither is a constant of nature.'
        ],
        example: 'Cells of 5, 15, 25 and 200 cost 180.1, 101.1, 119.0 and 1 150.0 units of work for the same answer.'
      },
      {
        term: 'Candidates per result is the only comparable number',
        plain: 'Divide the objects tested by the objects returned; 1.0 is perfect and anything large is wasted work.',
        formal: 'selectivity = πr² / (scanned cell area)',
        readAs: 'What fraction of the area you scanned actually falls inside the query circle. πr² is the ' +
          'circle\'s area; everything beyond it is work you did and threw away.',
        detail: [
          'Raw counts cannot be compared across structures whose nodes mean different things, ' +
            'because a quadtree node and a grid cell are not the same unit.',
          '"Points examined per point returned" is the same quantity everywhere, and it is what ' +
            'actually costs time.',
          'It also exposes the failure mode that a hit rate hides. A query returning the right ' +
            'answer after testing forty times as many candidates is correct and useless, and no ' +
            'correctness test will ever complain about it.'
        ],
        example: 'On clustered points the grid tests 4.31 candidates per result, the quadtree 1.68 and the k-d tree 1.69.'
      },
      {
        term: 'Density variation is what kills a grid',
        plain: 'A grid assumes objects are spread evenly; a cluster puts hundreds of them in one bucket.',
        formal: 'cost is ρ_local·(scanned area), and ρ_local can be many times the mean ρ',
        readAs: 'The cost depends on the density where the query lands, not the average density of the whole ' +
          'map. A grid sized on the mean falls apart in a city centre.',
        detail: [
          'The mean density is unchanged when the data clusters - the same 20 000 points are in ' +
            'the same box.',
          'So a sizing calculation based on the average is still "right" and the query is still ' +
            'slow, because a query only ever meets local density.',
          'That is why the trees in the rest of this milestone exist. They subdivide where the data ' +
            'is, so the number of objects per leaf stays bounded whatever the distribution does.',
          'It is also why the grid keeps its place: when density really is uniform, the trees are ' +
            'paying for an adaptation they do not need.'
        ],
        example: 'Clustered: the grid tests 148.19 candidates for 34.41 results and the longest bucket holds 269 points.'
      },
      {
        term: 'Hashing the cell removes the bounds and adds collisions',
        plain: 'Mix the cell coordinates into a fixed table instead of addressing an array, so space can be unbounded.',
        formal: 'bucket = mix(cx·p₁ ⊕ cy·p₂) mod m',
        readAs: 'Turn a pair of cell coordinates into one bucket index: multiply each by its own large prime, ' +
          'XOR them together, mix, and take the remainder. Unbounded space, bounded memory.',
        detail: [
          'A direct-addressed grid costs memory proportional to the *area* it covers, occupied or ' +
            'not, which is fatal for sparse or unbounded worlds.',
          'Hashing makes memory proportional to the objects instead, at the price that two ' +
            'unrelated cells can share a bucket and a query then examines objects nowhere near it.',
          'Those phantom candidates are invisible unless they are counted, and their rate is set ' +
            'entirely by the table load.',
          'The fix is a bigger table, and the decision is memory against wasted comparisons like ' +
            'any other hash table.'
        ],
        example: 'Spread 20 000 points over 100× the area. A direct grid needs 160 000 cells and 1.6 MB for 2 257 occupied ones; the hash needs 4 096 buckets and 345 KB.'
      },
      {
        term: 'Phantom candidates are the hash\'s real price',
        plain: 'Objects found in the right bucket but the wrong cell, rejected by a coordinate check the direct grid never makes.',
        formal: 'phantoms per query ≈ (occupied cells / buckets) × candidates',
        detail: [
          'The rate halves every time the table doubles, exactly as a chained hash table\'s chain ' +
            'length does.',
          'It is worth measuring rather than assuming, because the numbers are larger than ' +
            'intuition suggests.',
          'At 1 600 occupied cells and a 256-entry table, 86.3% of everything a query touches is a ' +
            'phantom. A 4 096-entry table brings that to 29.1% and an 8 192-entry one to 16.5%.',
          'A spatial hash sized "roughly like the object count" is usually running at the wrong end ' +
            'of that curve.'
        ],
        example: 'At 25-unit cells: 256 buckets cost 694.11 phantoms per query, 4 096 cost 45.22 and 8 192 cost 21.76.'
      },
      {
        term: 'Objects larger than a cell straddle it',
        plain: 'An object overlapping four cells is stored in all four, so one query can meet it four times.',
        formal: 'placements(o) = ⌈w/c + 1⌉ · ⌈h/c + 1⌉',
        readAs: 'How many cells one object of width w and height h can straddle, worst case. An object larger ' +
          'than a cell has to be registered in every cell it touches, and this is that count.',
        detail: [
          'There are exactly two workable answers and one broken one.',
          'Store the object in every cell it overlaps and deduplicate at query time - which is what ' +
            'this module does, and it reports the repeats rather than hiding them.',
          'Or store it once at a coarser level, which is the loose quadtree of 8.2.',
          'The broken answer is to store it in the cell of its centre, which silently misses every ' +
            'query that overlaps the object but not its middle.',
          'Duplicate placement also makes the memory a function of the cell size, and at small ' +
            'cells that dominates everything else.'
        ],
        example: '5 000 boxes of side ~60 with 10-unit cells cost 64.56 placements each; with 50-unit cells, 5.62.'
      },
      {
        term: 'The prediction is a test, not a formality',
        plain: 'Compute what a uniform grid should cost from density alone, then compare it with the measurement.',
        formal: 'E[candidates] = (n/A) · ((⌈2r/c⌉+1)·c)²',
        readAs: 'On average, the density (points over area) times the area you scan. It is the formula the ' +
          'demo\'s candidate counts are checked against.',
        detail: [
          'Agreement means the data really is uniform at the scale the query works at, and the grid ' +
            'is the right structure.',
          'Disagreement is the single cheapest signal that it is not, and it arrives before any ' +
            'user notices a slow tail.',
          'This is the same discipline as reporting a predicted false-positive rate next to a ' +
            'measured one.',
          'The formula is a claim the structure makes about itself, and a system that never checks ' +
            'it finds out from a latency graph months later.'
        ],
        example: 'Uniform, cell 25: predicted 112.50 candidates, measured 109.98 - 2.2% apart. Clustered: predicted 112.50, measured 148.19.'
      }
    ],

    quadtrees: [
      {
        term: 'Subdivision of space, not of the data',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a node owns a square of space"] --> B{"too many objects in it?"}',
            '    B -->|yes| C["split into four equal quarters"]',
            '    C --> B',
            '    B -->|no| D["stop"]',
            '    D --> E["the shape follows the space,<br/>so clustered data makes<br/>a lopsided tree"]'
          ].join('\n'),
          caption: 'A k-d tree splits so each side holds half the points; a quadtree splits space evenly and lets the points fall where they may. That difference is the whole comparison.'
        },
        plain: 'A node owns a square; when it holds too many objects it splits into four children of a quarter the area.',
        formal: 'a node at depth d owns a square of side S/2^d',
        readAs: 'Each level halves the side of the region, so depth d covers the whole space divided by 2 to ' +
          'the power d. Ten levels take a kilometre down to a metre.',
        detail: [
          'This is the one structural difference from a k-d tree and everything else follows from ' +
            'it.',
          'The splits are at fixed geometric positions, so the tree\'s shape is a function of the ' +
            'coordinates rather than of the data.',
          'That makes a node\'s square computable from its path with no stored bounds, makes the ' +
            'structure trivially parallelisable, and makes the depth unbounded when points crowd ' +
            'together.',
          'A k-d tree splits at a data point and is therefore balanced by construction. A quadtree ' +
            'is not, and buys simplicity with that.'
        ],
        example: '20 000 clustered points at capacity 8 build 7 721 nodes and reach depth 11; the same count uniform reaches depth 7.'
      },
      {
        term: 'The depth cap is a correctness requirement',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["split until one point per leaf"] --> B["two identical points"]',
            '    B --> C["every split puts both<br/>in the same child"]',
            '    C --> B',
            '    C --> D["recursion to the depth limit,<br/>or until memory runs out"]'
          ].join('\n'),
          caption: 'Coincident points cannot be separated by any subdivision, so the stopping rule has to be a depth cap and not a count. Duplicate coordinates are common in real data.'
        },
        plain: 'Coincident points never separate, so "split until one point per leaf" recurses until the stack dies.',
        formal: 'if p₁ = p₂ then every subdivision puts both in the same child, for every depth',
        readAs: 'Two points at identical coordinates can never be separated by splitting, so the tree grows ' +
          'forever trying. This is the degenerate case every quadtree implementation has to handle ' +
          'explicitly.',
        detail: [
          'This is the bug that actually takes quadtrees down in production, and it is not an edge ' +
            'case.',
          'Duplicate coordinates arrive from rounded GPS fixes, from default positions, from ' +
            'grid-snapped level data and from any integer coordinate system.',
          'The fix is two rules together: cap the depth, and let a leaf bucket exceed its capacity ' +
            'once the cap is reached.',
          'Either alone is wrong. A cap with a hard capacity has nowhere to put the point, and an ' +
            'overflowing bucket without a cap still recurses.'
        ],
        example: '20 000 points on 3 distinct sites, capacity 8: the tree stops at the cap with 137 nodes and a leaf holding 6 667.'
      },
      {
        term: 'Capacity trades nodes against candidates',
        plain: 'A small bucket means a deep tree with tight leaves; a large one means a shallow tree with loose leaves.',
        formal: 'nodes ≈ n/capacity · 4/3; candidates per query grows with capacity',
        detail: [
          'Both ends of the sweep are real costs and neither dominates.',
          'Small buckets waste memory on nodes and waste time descending them; large buckets test ' +
            'objects the query has already excluded geometrically.',
          'The curve is shallow in the middle, which is the practical point.',
          'Anything from about four to sixteen is defensible, and the choice is usually made by ' +
            'what a node costs in your memory layout rather than by the query count.'
        ],
        example: 'Capacity 2 → 29 893 nodes and 50.31 candidates per query; capacity 64 → 1 185 nodes and 87.73.'
      },
      {
        term: 'The empty-node problem',
        plain: 'A split makes four children whether or not anything is in them, so sparse regions cost nodes that hold nothing.',
        formal: 'empty leaves grow with the variance of the density',
        detail: [
          'A quadtree over clustered data spends a real fraction of its memory describing ' +
            'emptiness, because a split is triggered by one crowded quadrant and pays for all four.',
          'The classic answer is a linear quadtree, which stores only the occupied leaves keyed by ' +
            'their Morton code and drops the pointers entirely (see 8.6).',
          'The other is simply not subdividing children that would be empty.',
          'Measuring it is the first step: if the empty fraction is small, the pointer version is ' +
            'fine and simpler.'
        ],
        example: 'Clustered, capacity 4: 2 016 of 11 428 leaves are empty. Uniform: 86 of 4 858.'
      },
      {
        term: 'Pruning is a number, not a claim',
        plain: 'Count the nodes a query rejects without looking inside them; that count is what the tree bought.',
        formal: 'visited + pruned = nodes reached; the useful work is visited',
        detail: [
          'Every structure in this milestone claims to prune, and the claim is worth exactly what ' +
            'the counter says.',
          'Reporting both halves also catches the case where a tree prunes beautifully and still ' +
            'loses, because the nodes it visits are cheap to reject but numerous.',
          'That is what a deep tree over clustered data does.',
          'The pair of numbers is more informative than either, and it is the pair that makes two ' +
            'different structures comparable at all.'
        ],
        example: 'Clustered, capacity 8: a radius query visits 29.84 nodes and prunes 20.07, testing 57.78 points.'
      },
      {
        term: 'Loose quadtrees, for objects with extent',
        plain: 'Inflate each node\'s square by a factor for containment, so a box straddling a boundary still fits a child.',
        formal: 'loose(node) = centre ± halfSize · k, typically k = 1.5 or 2',
        detail: [
          'An object with size does not fit any child once it crosses the midline. A plain quadtree ' +
            'strands it at the parent, and a query near the boundary tests every stranded object.',
          'Inflating the boxes pushes most of them back down at the cost of overlapping siblings, ' +
            'so a query now descends into more than one child.',
          'The two effects fight, and the result is not monotone in the looseness.',
          'Measured over 5 000 boxes, 1.5 is three times better than a tight tree and 2.0 is worse ' +
            'than 1.5.'
        ],
        example: '5 000 boxes of side ~60: looseness 1 tests 1 792.18 candidates per query, 1.5 tests 606.29, 2 tests 1 159.50.'
      },
      {
        term: 'An object\'s size sets its level',
        plain: 'In a loose tree an object lives at the depth where a node is about as big as it is, whatever the depth cap says.',
        formal: 'depth(o) ≈ log₂(S / size(o))',
        readAs: 'Where an object settles in a loose tree: log base 2 of how many times its size divides into ' +
          'the world. Big objects sit near the root, small ones near the leaves, and nothing has to be ' +
          'duplicated.',
        detail: [
          'This is the property that makes loose quadtrees the standard choice for moving objects.',
          'An object that moves a little stays in the same node, because the node it belongs to is ' +
            'decided by its size rather than by its exact position.',
          'It also explains a result that looks like a bug the first time you see it. Raising the ' +
            'depth cap changes nothing at all, because the tree was never limited by the cap.',
          'The natural depth is set by the object, and the cap only ever binds for points.'
        ],
        example: '5 000 boxes of side ~60 in a 1 000-unit world build only 321-393 nodes, five levels deep, at any cap.'
      },
      {
        term: 'Octrees are the same structure with eight children',
        plain: 'Three axes instead of two: each split makes eight children, and everything else is unchanged.',
        formal: 'children = 2^d for d dimensions',
        readAs: 'A quadtree in 2 dimensions has 4 children, an octree in 3 has 8, and in d dimensions it is 2 ' +
          'to the power d. By 10 dimensions that is 1 024 children per node, which is why these ' +
          'structures stop at 3.',
        detail: [
          'The generalisation is mechanical and the cost is not.',
          'Fan-out doubles, so the tree is shallower for the same point count. But a node carries ' +
            'eight pointers instead of four, and a split creates eight children for one crowded ' +
            'octant.',
          'So the empty-node problem gets worse in exactly the ratio the fan-out improved.',
          'Past three dimensions this stops being useful at all. Sixteen children per node in four ' +
            'dimensions is why nobody writes a hextree, and why 8.8 reaches for a different family ' +
            'entirely.'
        ],
        example: 'A node costs 8 child pointers against 4, and one crowded octant creates 8 children rather than 4.'
      }
    ],

    'kd-trees': [
      {
        term: 'Alternating splits at data points',
        plain: 'Split on x, then y, then x again, each time at the median of the points in that node.',
        formal: 'axis = depth mod d; the split value is a coordinate of an actual point',
        readAs: 'Cycle through the axes as you descend — the remainder of the depth divided by the number of ' +
          'dimensions — and split on a real point\'s coordinate rather than a midpoint, so the tree ' +
          'stays balanced on the data you actually have.',
        detail: 'Splitting at the median rather than at the middle of the box is what makes the tree balanced on ' +
          'any distribution, which is precisely what a quadtree cannot promise. The cost is that a node has to ' +
          'store its split value - the geometry is no longer implied by the path - and that the tree cannot be ' +
          'rebalanced cheaply after an update, because moving a split moves every point that was classified by ' +
          'it. Balanced-and-static against unbalanced-and-dynamic is the trade against a quadtree, and it is why ' +
          'both survive.',
        example: '20 000 points, leaf size 8: 8 191 nodes at depth 12 exactly, built with 720 512 comparisons.'
      },
      {
        term: 'The descent finds a candidate; the backtrack makes it right',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["walk down to the leaf<br/>the query falls in"] --> B["a nearby point —<br/>often not the nearest"]',
            '    B --> C["unwind, and at each node ask:<br/>could the far side hold<br/>anything closer?"]',
            '    C -->|yes| D["search it too"]',
            '    C -->|no| E["prune the whole subtree"]'
          ].join('\n'),
          caption: 'Stopping at the leaf is the classic bug: it gives a plausible answer almost every time and a wrong one often enough to matter. The backtrack is the algorithm.'
        },
        plain: 'Walking down to the leaf the query falls in gives a nearby point, very often not the nearest one.',
        formal: 'after the near side, revisit the far side whenever |q[axis] − split| < best',
        readAs: 'Search the side the query falls on first, then check whether the splitting plane is closer ' +
          'than the best point found so far. The bars are absolute distance. If it is not, the entire ' +
          'far subtree can be skipped.',
        detail: 'The nearest neighbour is frequently on the other side of a plane the query is close to, so the ' +
          'descent alone is a heuristic with no bound at all. Deleting the backtrack does not produce a crash or ' +
          'an empty result: it produces a plausible point at a plausible distance, on every query, and nothing ' +
          'downstream can tell. That is why the only acceptable test for this code is agreement with brute force ' +
          'over thousands of randomised queries - a handful of hand-checked examples pass with the backtrack ' +
          'removed.',
        example: 'A correct nearest query over 20 000 points visits 51.50 nodes and prunes 23.97; the descent alone visits 12.'
      },
      {
        term: 'The pruning bound can be the plane or the box',
        plain: 'Compare the best distance so far against the splitting plane, or against the far subtree\'s actual bounding box.',
        formal: 'plane: (q[axis] − split)²; box: Σ max(min[i] − q[i], 0, q[i] − max[i])²',
        readAs: 'Two ways to bound how close a subtree could possibly be. The plane distance uses only the ' +
          'splitting axis; the box distance adds up the shortfall on every axis, which is tighter and ' +
          'prunes more.',
        detail: 'The plane bound is the textbook one and costs a subtraction; the box bound costs a few more ' +
          'operations and is never weaker, because the subtree\'s points lie inside the box and the box lies ' +
          'beyond the plane. The difference is much larger than the extra arithmetic, which makes this one of the ' +
          'few places where the obvious micro-optimisation is the wrong way round. Storing the box also costs ' +
          'memory per node, so the trade is real - but it is memory against a factor of three, not against a few ' +
          'percent.',
        example: 'Clustered, 20 000 points: the plane bound costs 69.28 distance computations per query, the box bound 19.77.'
      },
      {
        term: 'k-nearest needs a bounded worst-so-far',
        plain: 'Keep the k best found so far; the pruning bound is the worst of them, and is infinite until you have k.',
        formal: 'prune when bound ≥ best[k−1], with best[k−1] = ∞ while |best| < k',
        readAs: 'Skip a subtree once it cannot beat the worst of the k answers you are holding. Until you ' +
          'have k of them that worst answer counts as infinity, so nothing is pruned at all.',
        detail: 'The infinite bound is not a special case bolted on: until k candidates exist there is nothing to ' +
          'prune against, and a search that prunes early there returns fewer than k answers. Keeping the set ' +
          'sorted rather than in a heap is worth it below a few dozen neighbours, because the bound is then a ' +
          'single array read at a known index and the insert is a short memmove. Above that the heap wins, and ' +
          'the crossover is worth measuring rather than guessing.',
        example: 'k = 10 costs 149.49 distance computations per query against 69.28 for k = 1 - 2.2×, not 10×.'
      },
      {
        term: 'Deletion is a tombstone and a rebuild',
        plain: 'Removing a point properly means finding a replacement along the same axis; every real implementation marks it instead.',
        formal: 'a proper delete is O(n^(1−1/d)) and rebalances nothing',
        readAs: 'Removing a point costs n to the power (1 − 1/d) — in 2 dimensions about √n, and worse as ' +
          'dimensions rise — and leaves the tree no better balanced than it found it.',
        detail: 'Marking is cheap and correct - a marked point is skipped when scoring - but it does not make the ' +
          'tree smaller, so the traversal still walks past the tombstones and the leaves stay as full as they ' +
          'were. That cost is invisible in the answers and visible in the counters, which is exactly why the ' +
          'counter exists. The production pattern is to mark on delete and rebuild when the tombstone fraction ' +
          'passes a threshold, the same policy an LSM tree uses for the same reason.',
        example: 'Deleting half of 20 000 points leaves every answer correct and every query still walking the tombstones.'
      },
      {
        term: 'Degenerate inputs are the ones to test',
        plain: 'All points on a line, or all at one location, are the inputs that break naive implementations.',
        formal: 'collinear data makes one axis useless; coincident data makes the median split empty',
        detail: 'Collinear points make every split on the wasted axis a no-op, so the tree does half as much ' +
          'useful work per level and the pruning bound is zero on alternate levels. Coincident points make the ' +
          'median equal to the minimum and the maximum at once, which is where an implementation that partitions ' +
          'strictly puts every point on one side and recurses forever. Both are cheap to generate and both belong ' +
          'in the test suite; neither is exotic in real coordinate data.',
        example: 'The invariant check runs against 1 000 collinear and 1 000 coincident points on every build.'
      },
      {
        term: 'The curse of dimensionality is measurable',
        plain: 'As dimensions rise, a ball of radius r fills a vanishing share of the box, so nothing prunes.',
        formal: 'vol(ball)/vol(cube) → 0, so almost every subtree intersects the search radius',
        readAs: 'As dimensions rise, a ball takes up a vanishing fraction of the cube around it, so a search ' +
          'radius that seems small still reaches into nearly every branch. That is the curse of ' +
          'dimensionality in one line, and it is why exact nearest-neighbour search degrades to a full ' +
          'scan.',
        detail: 'This is not a slow degradation with a useful middle: the fraction of the data a k-d tree touches ' +
          'goes from a third of a percent at two dimensions to essentially all of it by sixteen, on the same ' +
          'point count. Past that the tree is a linear scan with pointer chasing added, which is strictly worse ' +
          'than the scan it replaced. The practical rule that follows is worth stating plainly: above about ten ' +
          'dimensions, stop looking for an exact index and start choosing a recall target.',
        example: '4 000 points, one nearest query: 0.3% of the data touched at 2 dimensions, 16.1% at 8, 99.5% at 16, 100% at 32.'
      },
      {
        term: 'Bulk build, never incremental',
        plain: 'Build from the whole point set with median selection; inserting one at a time gives an unbalanced tree.',
        formal: 'quickselect per level makes the build O(n log n) with no sorting',
        detail: 'An incremental k-d tree has the same failure mode as an unbalanced BST - sorted input builds a ' +
          'path - and there is no cheap rotation to fix it, because a rotation would change which axis classifies ' +
          'which points. Quickselect gives the median in linear expected time per level, so the whole build is ' +
          'O(n log n) without ever sorting the array; the counter matters because a build that sorts at every ' +
          'level is O(n log² n) and it is not obvious from reading the code which one you wrote.',
        example: '20 000 points build in 720 512 comparisons - about 36 per point, or 3 per level of the 12.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
