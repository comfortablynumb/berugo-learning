/** Reference entries for the R-tree, BVH and curve sections (M08.4-M08.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'r-trees': {
      summary: 'A paged, height-balanced tree of minimum bounding rectangles whose siblings may overlap, with ' +
        'the split heuristic and the bulk-load strategy deciding query cost.',
      intuition: 'Unlike every other index here an R-tree *covers* space rather than partitioning it, so a point ' +
        'can lie inside several rectangles and a query may follow several paths. Overlap, not height, is what a ' +
        'query pays for.',
      formulation: {
        equations: [
          {
            label: 'The bounding rectangle',
            expr: 'MBR(node) = ⋃ MBR(child), and MBR(a) ∩ MBR(b) need not be empty',
            terms: [
              { sym: 'consequence', meaning: 'a point query is not one root-to-leaf path' }
            ]
          },
          {
            label: 'Subtree choice',
            expr: 'argmin [area(MBR ∪ r) − area(MBR)], ties to the smaller area',
            terms: [
              { sym: 'why the tie-break', meaning: 'zero enlargement is common, and without it one node grows fat' }
            ]
          },
          {
            label: 'Overlap against cost',
            expr: 'measured over 20 000 rectangles at fan-out 9, height 6 throughout',
            terms: [
              { sym: 'first-fit', meaning: '113.69% overlap → 356.04 nodes visited per query' },
              { sym: 'linear', meaning: '57.67% → 78.90' },
              { sym: 'quadratic', meaning: '59.58% → 85.32' },
              { sym: 'R*', meaning: '24.49% → 36.69' }
            ]
          },
          {
            label: 'STR bulk load',
            expr: 'slices = ⌈√(n/M)⌉; sort by x, slice, sort each slice by y, pack',
            terms: [
              { sym: 'measured', meaning: '2 254 leaves at 98.6% full and height 5, against 3 186 at 69.7% and height 6' },
              { sym: 'cost', meaning: '28.43 nodes visited per query against the incremental quadratic tree\'s 85.32' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every MBR is the tight union of its children',
          why: 'A loose MBR is still correct and prunes less; a too-tight one drops rectangles.',
          breaks: 'A rectangle inside a child but outside the parent\'s MBR is unreachable by any query.'
        },
        {
          name: 'Every node except the root holds between m and M entries',
          why: 'It is what bounds the height and keeps pages usefully full.',
          breaks: 'The tree degenerates towards a list; note that STR breaks this on purpose and the check takes a flag.'
        },
        {
          name: 'Forced reinsertion happens at most once per insertion',
          why: 'A reinsertion can trigger another overflow, which can trigger another reinsertion.',
          breaks: 'Non-termination; and re-entering the tree mid-descent can let a split replace a node the caller still holds, losing its entries.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'O(log_M n) paths × overlap factor', worst: 'O(n) when everything overlaps' },
        { operation: 'insert', average: 'O(M log_M n)', worst: 'O(M² log_M n) with the quadratic split' },
        { operation: 'STR bulk load', average: 'O(n log n)', worst: 'O(n log n)' },
        { operation: 'memory', average: 'O(n/m) nodes', worst: 'O(n/m)' },
        { operation: 'height', average: 'O(log_M n)', worst: 'O(log_m n)' }
      ],
      failureModes: [
        {
          symptom: 'Query cost keeps rising as rows are inserted, with the height unchanged.',
          cause: 'Overlap accumulates with every split and nothing removes it.',
          fix: 'Measure overlap as a fraction of coverage; schedule a bulk rebuild rather than tuning the split further.'
        },
        {
          symptom: 'Rectangles are in the tree and queries do not return them.',
          cause: 'An MBR was not refreshed after a split, a reinsertion, or a delete.',
          fix: 'Recompute a node\'s MBR from its entries on the way back up, and check tightness in the invariant test.'
        },
        {
          symptom: 'A bulk-loaded tree fails the invariant check.',
          cause: 'STR leaves the last page of each slice short, which is not an R-tree bug.',
          fix: 'Make the minimum-fill assertion opt-out and say which structure was built.'
        },
        {
          symptom: 'The quadratic split is not beating the linear one.',
          cause: 'It does not always; the O(M²) pick is not universally better.',
          fix: 'Measure both on your own rectangles, and try R* before spending more on seed selection.'
        }
      ],
      inTheWild: [
        { system: 'PostGIS', how: 'GiST over R-tree operators - the spatial index in PostgreSQL' },
        { system: 'SQLite', how: 'the R*Tree virtual table, shipped in the amalgamation' },
        { system: 'Oracle Spatial, SQL Server, MySQL', how: 'R-tree variants for geometry columns' },
        { system: 'rbush', how: 'the standard JavaScript implementation: R*-style split with STR bulk loading' }
      ],
      sources: [
        { title: 'R-Trees: A Dynamic Index Structure for Spatial Searching', where: 'Antonin Guttman - SIGMOD, 1984' },
        { title: 'The R*-tree: An Efficient and Robust Access Method', where: 'Beckmann, Kriegel, Schneider, Seeger - SIGMOD, 1990' },
        { title: 'STR: A Simple and Efficient Algorithm for R-Tree Packing', where: 'Leutenegger, Lopez, Edgington - ICDE, 1997' },
        { title: 'R-Trees: Theory and Applications', where: 'Manolopoulos, Nanopoulos, Papadopoulos, Theodoridis - Springer, 2006' }
      ]
    },

    'bounding-volumes': {
      summary: 'A binary tree over primitives rather than space, built with the surface-area heuristic, ' +
        'traversed with an explicit stack and the slab test, and refitted rather than rebuilt when the scene ' +
        'moves coherently.',
      intuition: 'Splitting the primitive list rather than space means every primitive appears once and the ' +
        'boxes are allowed to overlap. That is what makes the topology survive animation - only the boxes are ' +
        'wrong after a move, and boxes recompute in one bottom-up pass.',
      formulation: {
        equations: [
          {
            label: 'The surface-area heuristic',
            expr: 'C = Ct + Ci·(A(L)·N(L) + A(R)·N(R)) / A(P)',
            terms: [
              { sym: 'assumption', meaning: 'for a random ray hitting the parent, P[hits a child] ∝ surface area' },
              { sym: 'measured', meaning: 'SAH tree cost 49.44 against the median split\'s 65.81' }
            ]
          },
          {
            label: 'The leaf decision',
            expr: 'make a leaf when min C(split) ≥ Ci · N',
            terms: [
              { sym: 'measured', meaning: 'fires 69 times at leaf size 1 and never at leaf size 4 - four primitives already beat any split of them' }
            ]
          },
          {
            label: 'The slab test',
            expr: 'tnear = max min(t₀,t₁); tfar = min max(t₀,t₁); hit iff tnear ≤ tfar',
            terms: [
              { sym: 'the trap', meaning: 'direction 0 with the origin on the plane gives 0 × ∞ = NaN, and every comparison against NaN is false' }
            ]
          },
          {
            label: 'Refit against rebuild',
            expr: 'box(node) = box(left) ∪ box(right), one post-order pass',
            terms: [
              { sym: 'coherent motion', meaning: 'refit cost 49.95 against a rebuild\'s 50.85 - no reason to rebuild' },
              { sym: 'scattered motion', meaning: 'refit cost 258.29 against 50.76, and 82.32 primitives per ray against 9.61' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A node\'s box contains every primitive beneath it',
          why: 'A ray missing the box must be able to skip the whole subtree.',
          breaks: 'Missed intersections - and only on the rays that happen to enter through the gap.'
        },
        {
          name: 'Every primitive is in exactly one leaf',
          why: 'It is the difference from a k-d tree and it is what bounds the memory in advance.',
          breaks: 'Duplicate hits, and a build whose memory cannot be sized before it runs.'
        },
        {
          name: 'The far child is re-tested against the current closest hit',
          why: 'The bound tightens between pushing a node and popping it.',
          breaks: 'Nothing incorrect, but the traversal loses most of its pruning.'
        }
      ],
      complexity: [
        { operation: 'build, binned SAH', average: 'O(n log n)', worst: 'O(n log n) with a fixed bin count' },
        { operation: 'build, median split', average: 'O(n log n)', worst: 'O(n log n)' },
        { operation: 'ray query', average: 'O(log n)', worst: 'O(n) on a degenerate scene' },
        { operation: 'refit', average: 'O(n)', worst: 'O(n)' },
        { operation: 'memory', average: 'O(n) nodes and exactly n primitive references', worst: 'O(n)' }
      ],
      failureModes: [
        {
          symptom: 'Axis-aligned geometry is invisible to axis-aligned rays.',
          cause: '0 × ∞ = NaN in the slab test when the origin lies exactly on a slab plane.',
          fix: 'Handle a zero direction component explicitly: inside the slab, skip the axis; outside, miss.'
        },
        {
          symptom: 'An animated scene gets slower every frame while staying correct.',
          cause: 'Refitting preserves a grouping that the motion has invalidated.',
          fix: 'Track the tree\'s own SAH cost across frames and rebuild on drift; the root box grows only 16% and detects nothing.'
        },
        {
          symptom: 'The SAH build is no faster to trace than a median split.',
          cause: 'Splitting to a fixed leaf size, so the "do not split" branch of the heuristic never fires.',
          fix: 'Compare the best split cost against Ci·N and stop when splitting loses.'
        },
        {
          symptom: 'Build time dominates.',
          cause: 'An exact SAH sweep sorts at every node.',
          fix: 'Bin the centroids - 12 to 16 bins gives a tree within a couple of percent for a fraction of the cost.'
        }
      ],
      inTheWild: [
        { system: 'Embree and OptiX', how: 'SAH-built BVHs, the reference implementations for CPU and GPU ray tracing' },
        { system: 'RTX and RDNA hardware', how: 'BVH traversal in fixed-function silicon' },
        { system: 'The Box2D dynamic tree', how: 'the same structure as a broad phase, refitted per frame' },
        { system: 'PBRT', how: 'the teaching implementation, with binned SAH and the leaf-cost comparison' }
      ],
      sources: [
        { title: 'Heuristics for Ray Tracing Using Space Subdivision', where: 'MacDonald and Booth - The Visual Computer, 1990' },
        { title: 'On Fast Construction of SAH-based Bounding Volume Hierarchies', where: 'Ingo Wald - IEEE Symposium on Interactive Ray Tracing, 2007' },
        { title: 'Fast, Minimum Storage Ray/Triangle Intersection', where: 'Möller and Trumbore - Journal of Graphics Tools, 1997' },
        { title: 'An Efficient and Robust Ray-Box Intersection Algorithm', where: 'Williams, Barrus, Morley, Shirley - Journal of Graphics Tools, 2005' }
      ]
    },

    'space-filling-curves': {
      summary: 'Morton, Hilbert and geohash: a single ordering over cells that turns a rectangle into a set of ' +
        'key ranges, so an ordered key-value store with no spatial support can serve spatial queries.',
      intuition: 'Interleave the bits of the coordinates and nearby cells usually get nearby numbers. The ' +
        'encoding is trivial; everything interesting is what happens to a rectangle, which is almost never one ' +
        'contiguous run.',
      formulation: {
        equations: [
          {
            label: 'Morton',
            expr: 'morton(x, y) = Σ (x_i·2^(2i) + y_i·2^(2i+1))',
            terms: [
              { sym: 'cost', meaning: 'four shift-and-mask steps per axis, branch-free' },
              { sym: 'inverse', meaning: 'the same steps run backwards, gathering the even and odd bits' }
            ]
          },
          {
            label: 'Decomposition',
            expr: 'ranges(rect) = maximal runs of consecutive indices covering it',
            terms: [
              { sym: 'measured', meaning: 'an 18 × 17 rectangle of 306 cells: 45 Morton ranges, 22 Hilbert ranges' },
              { sym: 'span', meaning: '772 and 758 index positions respectively' }
            ]
          },
          {
            label: 'Coalescing to a budget',
            expr: 'scanned = cells + Σ merged gaps',
            terms: [
              { sym: 'Hilbert', meaning: '4 ranges → 42.5% waste, 8 → 13.4%, 16 → 4.6%' },
              { sym: 'Morton', meaning: '4 ranges → 59.8% waste, 8 → 26.5%, 16 → 10.5%' }
            ]
          },
          {
            label: 'Locality, two ways',
            expr: 'neighbour index gap, and runs per window',
            terms: [
              { sym: 'gap', meaning: 'Hilbert 39.05 mean and 3 413 worst; Morton 32.50 and 1 366 - Z-order wins' },
              { sym: 'runs', meaning: '16 × 16 window: Hilbert 15.68, Morton 29.49 - Hilbert wins by 1.88×' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The conversion round-trips for every coordinate in the bit width',
          why: 'The index is the only key; a lossy encoding loses rows.',
          breaks: 'Points land in the wrong cell and no query finds them again.'
        },
        {
          name: 'The index is a bijection over the grid',
          why: 'Two cells sharing an index makes range decomposition meaningless.',
          breaks: 'The decomposition returns fewer cells than the rectangle contains.'
        },
        {
          name: 'The scan result is filtered exactly afterwards',
          why: 'Cells are a discretisation, so a covered cell may hold points outside the query.',
          breaks: 'Results outside the requested shape, before any range coalescing is even considered.'
        }
      ],
      complexity: [
        { operation: 'Morton encode/decode', average: 'O(1) - 4 shift-mask steps', worst: 'O(1)' },
        { operation: 'Hilbert encode/decode', average: 'O(order)', worst: 'O(order)' },
        { operation: 'exact decomposition', average: 'O(cells log cells)', worst: 'O(cells log cells)' },
        { operation: 'coalescing to b ranges', average: 'O(ranges²) greedily', worst: 'O(ranges²)' },
        { operation: 'query in the store', average: 'O(ranges round trips + cells scanned)', worst: 'one scan of the whole span' }
      ],
      failureModes: [
        {
          symptom: '"Nearby" results omit things a street away.',
          cause: 'Two points either side of a cell boundary share no prefix.',
          fix: 'Query the cell and its eight neighbours; this is the step every geohash recipe has and everyone drops.'
        },
        {
          symptom: 'One window query issues forty scans.',
          cause: 'An exact decomposition, on a store that charges per round trip.',
          fix: 'Coalesce to a range budget and accept the false positives; the curve is steep below eight ranges and flat above sixteen.'
        },
        {
          symptom: 'A scan returns far more rows than the window contains.',
          cause: 'The range budget was set too low, or the whole span was scanned as one range.',
          fix: 'Report cells scanned against cells wanted; at four ranges the waste is 42.5% on Hilbert and 59.8% on Morton.'
        },
        {
          symptom: 'Coordinates above 2^16 produce nonsense codes.',
          cause: 'A 32-bit Morton code holds 16 bits per axis and silently truncates.',
          fix: 'Range-check the inputs and throw; or move to 64-bit codes and accept that they are not exact integers in JavaScript.'
        }
      ],
      inTheWild: [
        { system: 'S2 (Google)', how: 'a Hilbert curve over a projected cube; the cell id is the sort key' },
        { system: 'geohash', how: 'Z-order in base 32, used across Elasticsearch, Redis and DynamoDB layouts' },
        { system: 'H3 (Uber)', how: 'hexagons, so every neighbour is edge-adjacent and the diagonal case disappears' },
        { system: 'Tiled textures and cache-oblivious matrices', how: 'Morton order as a memory layout rather than an index' }
      ],
      sources: [
        { title: 'A Computer Oriented Geodetic Data Base', where: 'G. M. Morton - IBM technical report, 1966' },
        { title: 'Analysis of the Clustering Properties of the Hilbert Space-Filling Curve', where: 'Moon, Jagadish, Faloutsos, Saltz - TKDE, 2001' },
        { title: 'S2 Geometry Library', where: 'Google - s2geometry.io, cell IDs and the Hilbert ordering' },
        { title: 'Foundations of Multidimensional and Metric Data Structures', where: 'Hanan Samet, section 2.1 on space ordering' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
