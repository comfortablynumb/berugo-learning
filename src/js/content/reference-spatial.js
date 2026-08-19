/** Reference entries for the grid, quadtree and k-d tree sections (M08.1-M08.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'uniform-grids': {
      summary: 'Bucketing by fixed-size cell, either direct-addressed over a bounded domain or hashed over an ' +
        'unbounded one, with the cell size chosen from density and query radius.',
      intuition: 'There is no tree and nothing to balance: two divisions give the cell, the bucket is an array ' +
        'offset, and a query reads only the cells its own box touches. Everything a grid gets wrong follows from ' +
        'the cells being fixed before the data arrives.',
      formulation: {
        equations: [
          {
            label: 'The cell',
            expr: 'cell(x, y) = (⌊x/c⌋, ⌊y/c⌋)',
            terms: [
              { sym: 'c', meaning: 'cell size - the only tuning parameter there is' },
              { sym: 'bucket', meaning: 'cy·cols + cx directly, or mix(cx·p₁ ⊕ cy·p₂) mod m when hashed' }
            ]
          },
          {
            label: 'Expected candidates',
            expr: 'E[candidates] = (n/A) · ((⌈2r/c⌉+1)·c)²',
            terms: [
              { sym: 'measured', meaning: 'predicted 112.50 against a measured 109.98 at c = 25, r = 25' },
              { sym: 'caveat', meaning: 'a worst case over alignments; exact only when c divides 2r' }
            ]
          },
          {
            label: 'Work',
            expr: 'work(c) ≈ cells scanned + candidates tested',
            terms: [
              { sym: 'minimum', meaning: 'measured at c = 15 for r = 25 - not at c = r' },
              { sym: 'flatness', meaning: '101.06 at c = 15 against 118.98 at c = 25 and 1 150.00 at c = 200' }
            ]
          },
          {
            label: 'Hash collisions',
            expr: 'phantoms per query ≈ (occupied cells / buckets) × candidates',
            terms: [
              { sym: 'measured', meaning: '86.3% of touched entries wasted at 256 buckets, 16.5% at 8 192' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every object is in every cell it overlaps',
          why: 'A window query reads whole cells, so an object present in only one of them is invisible to a query touching another.',
          breaks: 'Filing by the centre cell silently misses every query overlapping the object but not its middle.'
        },
        {
          name: 'A query deduplicates its candidates',
          why: 'An object stored in four cells is met four times by a query reading all four.',
          breaks: 'The caller receives duplicates, and a count query is simply wrong.'
        },
        {
          name: 'Nothing lies outside the addressable domain',
          why: 'A direct-addressed grid covers exactly its bounds, so an out-of-range cell has no bucket.',
          breaks: 'Clamping folds distant cells onto the edge row, which is a collision in the one mode that is supposed to have none.'
        }
      ],
      complexity: [
        { operation: 'insert (point)', average: 'O(1)', worst: 'O(1)' },
        { operation: 'insert (box)', average: 'O(cells covered)', worst: 'O(area/c²)' },
        { operation: 'radius query', average: 'O(cells + ρ·scanned area)', worst: 'O(n) when everything is in one cell' },
        { operation: 'memory, direct', average: 'O(area/c² + n)', worst: 'O(area/c²) with no points at all' },
        { operation: 'memory, hashed', average: 'O(m + n)', worst: 'O(m + n)' }
      ],
      failureModes: [
        {
          symptom: 'Queries are fast on average and occasionally 20× slower.',
          cause: 'Density varies; the slow queries land in a cluster and the mean density predicted nothing.',
          fix: 'Compare the predicted candidate count with the measured one; if they disagree, use a quadtree or a k-d tree.'
        },
        {
          symptom: 'Memory is dominated by empty cells.',
          cause: 'A direct-addressed grid over a large or sparse domain allocates by area, not by occupancy.',
          fix: 'Switch to a hashed grid: 20 000 points over 160 000 cells cost 1.6 MB direct against 345 KB hashed.'
        },
        {
          symptom: 'Most of the candidates a query tests are nowhere near it.',
          cause: 'The hash table is too small, so unrelated cells share buckets.',
          fix: 'Count the phantom candidates and enlarge the table; the rate halves every doubling.'
        },
        {
          symptom: 'Object counts come back too high.',
          cause: 'Objects larger than a cell are stored in several and returned once per cell.',
          fix: 'Deduplicate by identity within a query, with a stamp rather than a set allocation per query.'
        }
      ],
      inTheWild: [
        { system: 'Particle systems and boids', how: 'a hashed grid almost universally: every object is the same size and the density is uniform by construction' },
        { system: 'Fluid neighbour searches (SPH)', how: 'a grid sized to the smoothing radius, which is the textbook c = r case' },
        { system: 'Box2D and Bullet', how: 'a grid broad phase offered alongside sweep and prune' },
        { system: 'Teschner et al. (2003)', how: 'the standard reference for the hashed variant, and the source of the prime-multiply hash used here' }
      ],
      sources: [
        { title: 'Optimized Spatial Hashing for Collision Detection of Deformable Objects', where: 'Teschner, Heidelberger, Müller, Pomerantes, Gross - VMV 2003' },
        { title: 'Real-Time Collision Detection', where: 'Christer Ericson, chapter 7 - grids and hashing' },
        { title: 'Foundations of Multidimensional and Metric Data Structures', where: 'Hanan Samet, chapter 1' },
        { title: 'Hierarchical Spatial Hashing', where: 'Eitz and Lixu - The Visual Computer, 2007' }
      ]
    },

    quadtrees: {
      summary: 'Recursive subdivision of space into four equal quadrants, with a bucket per leaf, a depth cap ' +
        'for correctness, and a loose variant for objects with extent.',
      intuition: 'A node owns a square and splits it into four when it holds too many objects. Because the ' +
        'splits are at fixed geometric positions, the tree\'s shape follows the coordinates rather than the data ' +
        '- which is what makes it simple and what makes it degenerate.',
      formulation: {
        equations: [
          {
            label: 'Node geometry',
            expr: 'a node at depth d owns a square of side S/2^d',
            terms: [
              { sym: 'consequence', meaning: 'the square is computable from the path; no bounds need storing' }
            ]
          },
          {
            label: 'The termination condition',
            expr: 'split when |items| > capacity AND depth < maxDepth',
            terms: [
              { sym: 'why both', meaning: 'coincident points never separate, so the capacity alone never terminates' },
              { sym: 'measured', meaning: '20 000 points on 3 sites: 137 nodes, a leaf of 6 667, at any cap' }
            ]
          },
          {
            label: 'The capacity trade',
            expr: 'nodes ≈ (4/3)·n/capacity; candidates grow with capacity',
            terms: [
              { sym: 'measured', meaning: 'capacity 2 → 29 893 nodes and 50.31 candidates; capacity 64 → 1 185 and 87.73' }
            ]
          },
          {
            label: 'Loose bounds',
            expr: 'loose(node) = centre ± halfSize · k',
            terms: [
              { sym: 'measured', meaning: '5 000 boxes: k = 1 costs 1 792.18 candidates, k = 1.5 costs 606.29, k = 2 costs 1 159.50' },
              { sym: 'non-monotone', meaning: 'looser boxes push items down and make siblings overlap; the two fight' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every item lies inside its node\'s (loose) box',
          why: 'A query prunes a node by testing that box, so an item outside it is unreachable.',
          breaks: 'Points outside the root are silently dropped unless they are held separately and always scanned.'
        },
        {
          name: 'A leaf under the depth cap is at or under capacity',
          why: 'Otherwise a split was skipped and the leaf is a linear scan for no reason.',
          breaks: 'Query cost drifts upward with no change to the data or the parameters.'
        },
        {
          name: 'A leaf at the depth cap may exceed capacity',
          why: 'This is the escape hatch that makes coincident points terminate.',
          breaks: 'Enforcing the capacity at the cap has nowhere to put the point - the insert cannot complete.'
        }
      ],
      complexity: [
        { operation: 'insert', average: 'O(log n)', worst: 'O(maxDepth) - always, since the cap bounds it' },
        { operation: 'range query', average: 'O(log n + k)', worst: 'O(n) on coincident data' },
        { operation: 'build', average: 'O(n log n)', worst: 'O(n · maxDepth)' },
        { operation: 'memory', average: 'O(n)', worst: 'O(n · maxDepth) with pathological clustering' },
        { operation: 'octree, same operations', average: 'as above with fan-out 8', worst: 'as above' }
      ],
      failureModes: [
        {
          symptom: 'Stack overflow, or a build that never finishes.',
          cause: 'Coincident points and a split-until-capacity rule with no depth cap.',
          fix: 'Cap the depth and let the leaf bucket overflow at the cap; both rules, not either.'
        },
        {
          symptom: 'The tree is mostly empty nodes.',
          cause: 'One crowded quadrant triggers a split that creates all four children.',
          fix: 'Measure the empty fraction; if it is large, use a linear quadtree keyed by Morton code (8.6) and drop the pointers.'
        },
        {
          symptom: 'Objects with size pile up at the root.',
          cause: 'A box straddling the midline fits no child, so the parent keeps it.',
          fix: 'Use loose bounds, and measure the looseness rather than assuming larger is better.'
        },
        {
          symptom: 'Raising maxDepth changes nothing.',
          cause: 'In a loose tree an object\'s level is set by its size, so the cap was never binding.',
          fix: 'Nothing to fix - read the itemsAtInternal count and recognise which regime you are in.'
        }
      ],
      inTheWild: [
        { system: '2-D game engines', how: 'the standard index for scene queries, usually loose so moving objects keep their node' },
        { system: 'GIS tiling schemes', how: 'a quadtree over the world, with the tile path as the node id' },
        { system: 'Voxel engines and point clouds', how: 'octrees for sparse volume data, where most of the space is empty' },
        { system: 'Barnes-Hut n-body simulation', how: 'a quadtree or octree whose internal nodes carry a centre of mass' }
      ],
      sources: [
        { title: 'Quad Trees: A Data Structure for Retrieval on Composite Keys', where: 'Finkel and Bentley - Acta Informatica, 1974' },
        { title: 'The Quadtree and Related Hierarchical Data Structures', where: 'Hanan Samet - ACM Computing Surveys, 1984' },
        { title: 'Loose Octrees', where: 'Thatcher Ulrich - Game Programming Gems, 2000' },
        { title: 'Foundations of Multidimensional and Metric Data Structures', where: 'Hanan Samet, chapters 1-2' }
      ]
    },

    'kd-trees': {
      summary: 'Alternating axis-aligned splits at the median data point, with nearest-neighbour search that is ' +
        'correct only because of the backtrack, and a well-defined dimension past which it stops working.',
      intuition: 'Splitting at the median rather than the middle of the box makes the tree balanced on any ' +
        'distribution. The descent to a leaf finds a plausible neighbour quickly; re-examining the far side of ' +
        'every close split is what makes it the right one.',
      formulation: {
        equations: [
          {
            label: 'The split',
            expr: 'axis = depth mod d, value = median of that coordinate',
            terms: [
              { sym: 'cost', meaning: 'quickselect per level gives O(n log n) overall; sorting per level gives O(n log² n)' },
              { sym: 'measured', meaning: '20 000 points build in 720 512 comparisons - 36 per point over 12 levels' }
            ]
          },
          {
            label: 'The pruning bound',
            expr: 'plane: (q[a] − split)²    box: Σ max(min[i] − q[i], 0, q[i] − max[i])²',
            terms: [
              { sym: 'measured', meaning: '69.28 distance computations per query with the plane, 19.77 with the box' },
              { sym: 'why', meaning: 'the subtree lies inside its box and the box lies beyond the plane' }
            ]
          },
          {
            label: 'What the backtrack is worth',
            expr: 'descent alone: 4.87 distances, wrong on 60.2% of queries',
            terms: [
              { sym: 'undetectable', meaning: 'mean reported distance 60.272 against a true 42.701' },
              { sym: 'tail', meaning: 'median overshoot 1.38× when wrong, worst 17.91×' }
            ]
          },
          {
            label: 'The curse',
            expr: 'vol(ball)/vol(cube) → 0, so pruning fails',
            terms: [
              { sym: 'measured', meaning: '4 000 points: 0.3% scanned at d = 2, 16.1% at d = 8, 99.5% at d = 16, 100% at d = 32' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Left points are at or below the split, right points at or above it',
          why: 'The pruning bound assumes the far subtree lies beyond the plane.',
          breaks: 'A misplaced point is unreachable by any query that prunes correctly.'
        },
        {
          name: 'The backtrack visits the far side whenever the bound is under the best distance so far',
          why: 'The nearest neighbour is frequently on the other side of a plane the query sits near.',
          breaks: 'A plausible wrong answer on 60% of queries, with nothing downstream able to tell.'
        },
        {
          name: 'The pruning bound is infinite until k candidates exist',
          why: 'There is nothing to prune against before the result set is full.',
          breaks: 'k-nearest returns fewer than k results, and does it silently.'
        }
      ],
      complexity: [
        { operation: 'build', average: 'O(n log n)', worst: 'O(n log n) with quickselect; O(n²) with a bad pivot rule' },
        { operation: 'nearest, low d', average: 'O(log n)', worst: 'O(n)' },
        { operation: 'nearest, high d', average: 'O(n)', worst: 'O(n) - measured at 100% from d = 32' },
        { operation: 'range query', average: 'O(√n + k) in 2-D', worst: 'O(n)' },
        { operation: 'delete', average: 'O(1) as a tombstone', worst: 'O(n^(1−1/d)) done properly' }
      ],
      failureModes: [
        {
          symptom: 'Nearest neighbour returns a nearby but wrong point.',
          cause: 'No backtrack, or a bound read off the far child instead of the parent\'s split.',
          fix: 'Compare against brute force over thousands of randomised queries; a handful of examples passes either bug.'
        },
        {
          symptom: 'The tree is a path.',
          cause: 'Built incrementally from sorted input rather than by median selection.',
          fix: 'Bulk build. There is no cheap rotation, because a rotation changes which axis classified which points.'
        },
        {
          symptom: 'Search cost rises steadily with no change to the data.',
          cause: 'Tombstones accumulating from deletions.',
          fix: 'Track the tombstone fraction and rebuild past a threshold, exactly as an LSM tree compacts.'
        },
        {
          symptom: 'The index is slower than a linear scan.',
          cause: 'Too many dimensions; the tree touches every point and chases pointers doing it.',
          fix: 'Above about ten dimensions stop asking for exactness - see 8.8 and pick a recall target.'
        }
      ],
      inTheWild: [
        { system: 'scipy.spatial.cKDTree', how: 'the standard low-dimensional exact k-d tree in Python' },
        { system: 'PCL and FLANN', how: 'k-d trees for point-cloud registration and as the exact baseline for approximate indexes' },
        { system: 'Photon mapping', how: 'a k-d tree over photon hits, queried by k-nearest during the gather pass' },
        { system: 'ANN benchmark suites', how: 'k-d trees as the exact answer every approximate index is scored against' }
      ],
      sources: [
        { title: 'Multidimensional Binary Search Trees Used for Associative Searching', where: 'Jon Bentley - CACM, 1975' },
        { title: 'An Algorithm for Finding Best Matches in Logarithmic Expected Time', where: 'Friedman, Bentley, Finkel - TOMS, 1977' },
        { title: 'When Is "Nearest Neighbor" Meaningful?', where: 'Beyer, Goldstein, Ramakrishnan, Shaft - ICDT, 1999' },
        { title: 'Foundations of Multidimensional and Metric Data Structures', where: 'Hanan Samet, chapter 1.5' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
