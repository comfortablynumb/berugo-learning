/** Worked examples for the grid, quadtree and k-d tree sections (M08.1-M08.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'uniform-grids': [
      {
        title: 'Sizing a grid from density and query radius',
        goal: 'Predict a uniform grid\'s cost from two numbers - point density and query radius - and then find ' +
          'the cell size that actually minimises the work.',
        setup: '20 000 uniformly distributed points in a 1 000 × 1 000 domain, 200 radius-25 queries, cell size ' +
          'swept from 5 to 200.',
        steps: [
          {
            do: 'Write down the density and the answer size the query must return.',
            why: 'Both are properties of the problem, not of the index, and neither changes with cell size.',
            work: 'density = 20 000 / 1 000² = 0.02 points per unit²\n' +
              'expected results = π · 25² · 0.02 = 39.27\n' +
              'measured over 200 queries: 38.48',
            result: 'every cell size must return the same 38.48 points per query'
          },
          {
            do: 'Predict the candidates at a cell size of 25, where the cell divides the query diameter exactly.',
            why: 'A radius-25 query spans 50 units, which is exactly two cells, so the scanned region is 3 × 3 for every alignment.',
            work: 'cells per axis = ⌈50/25⌉ + 1 = 3, so 9 cells\n' +
              'scanned area = (3 · 25)² = 5 625\n' +
              'predicted candidates = 0.02 · 5 625 = 112.50',
            result: 'measured 109.98 against a predicted 112.50 - 2.2% apart'
          },
          {
            do: 'Check the prediction again at a cell size of 50.',
            why: 'To confirm the agreement is the formula working, not one lucky point.',
            work: 'cells per axis = ⌈50/50⌉ + 1 = 2, so 4 cells\n' +
              'scanned area = 100² = 10 000, predicted 200.00\n' +
              'measured 193.66',
            result: '3.2% apart, with the measured count below the prediction both times'
          },
          {
            do: 'Sweep the cell size and add the two costs together.',
            why: 'Cells scanned and candidates tested move in opposite directions, so the total has a real minimum.',
            work: 'c = 5:   121.00 cells + 59.10 candidates = 180.10\n' +
              'c = 15:   18.84 cells + 82.22 candidates = 101.06\n' +
              'c = 25:    9.00 cells + 109.98 candidates = 118.98\n' +
              'c = 200:   1.53 cells + 1 148.47 candidates = 1 150.00',
            result: 'the measured minimum is at c = 15, not at c = r = 25'
          },
          {
            do: 'Explain why the prediction is loose at 15 and exact at 25.',
            why: 'Because a formula that disagrees with a measurement is telling you something specific.',
            work: '⌈50/15⌉ + 1 = 5 cells per axis, so the formula says 25 cells\n' +
              'measured 18.84, because 50 units span 4 cells for most alignments and 5 for the rest',
            result: 'the formula is a worst case; it is exact only when the cell divides 2r'
          }
        ],
        answer: 'Density and radius predict a uniform grid\'s cost to within about 3% whenever the cell divides ' +
          'the query diameter, and over-predict otherwise because the formula is a worst case over alignments. ' +
          'The work minimum here is at a cell of 15 rather than the folklore c = r, and it is shallow: 15 costs ' +
          '101.06 units and 25 costs 118.98, while 5 and 200 cost 180.10 and 1 150.00. The lesson is that the ' +
          'sweep takes one run and the rule of thumb costs 18%.'
      },
      {
        title: 'The same grid on clustered points, where the prediction stops working',
        goal: 'Invert the first example: keep every parameter identical, cluster the points, and watch the ' +
          'sizing calculation stay "right" while the query gets slower.',
        setup: 'The same 20 000 points and the same 200 radius-25 queries, but the points are drawn from 35 ' +
          'gaussian blobs instead of uniformly. The mean density is unchanged.',
        steps: [
          {
            do: 'Re-run the prediction. Nothing in it has changed.',
            why: 'Mean density is the only input, and clustering does not change the mean.',
            work: 'density = 20 000 / 1 000² = 0.02, cell 25 → predicted 112.50 candidates',
            result: 'the formula still says 112.50, exactly as before'
          },
          {
            do: 'Measure it.',
            why: 'A query never meets the mean density; it meets the density where it happens to land.',
            work: 'measured candidates per query: 148.19\n' +
              'measured results per query: 34.41\n' +
              'candidates per result: 4.31, against 2.86 on uniform points',
            result: '31.7% over prediction, and half as much of the work is useful'
          },
          {
            do: 'Look at the worst bucket rather than the average.',
            why: 'The average hides the tail, and the tail is what a latency graph shows.',
            work: 'uniform, cell 25: every cell holds about 12.5 points\n' +
              'clustered, cell 25: the longest bucket holds 269\n' +
              'clustered, cell 200: the longest bucket holds 2 047',
            result: 'one bucket holds 21× the mean, and no cell size fixes it'
          },
          {
            do: 'Give the same clustered points to a quadtree and a k-d tree instead.',
            why: 'Both subdivide where the data is, so the objects per leaf stay bounded whatever the density does.',
            work: 'grid:     148.19 candidates → 4.31 per result\n' +
              'quadtree:  57.78 candidates → 1.68 per result\n' +
              'k-d tree:  58.16 candidates → 1.69 per result',
            result: 'the trees test 2.6× fewer candidates on the same query set'
          },
          {
            do: 'Check that the trees are not simply better, by running the same three on uniform points.',
            why: 'Because the honest claim is about the distribution, not about the structures.',
            work: 'uniform: grid 109.98, quadtree 80.85, k-d tree 73.67 candidates per query\n' +
              'memory:  grid 332 800 bytes, quadtree 790 896, k-d tree 967 640',
            result: 'the grid is within 1.49× on candidates at 42% of the quadtree\'s memory'
          }
        ],
        answer: 'Clustering leaves the sizing calculation intact and makes it wrong: the prediction is still ' +
          '112.50 and the measurement is 148.19, because a query meets local density and the formula knows only ' +
          'the mean. On uniform points the grid tests 1.36× the quadtree\'s candidates for 42% of its memory ' +
          'and is the right choice; on clustered points it tests 2.56× as many and is not. The signal that ' +
          'distinguishes the two cases is free: compare the prediction with the measurement, and the disagreement ' +
          'arrives long before a user notices a slow tail.'
      }
    ],

    quadtrees: [
      {
        title: 'Choosing a bucket capacity',
        goal: 'Find what a quadtree\'s leaf capacity actually buys, by measuring both ends of the trade on the ' +
          'same points and the same queries.',
        setup: '20 000 clustered points in a 1 000 × 1 000 domain, depth cap 14, 200 radius-25 queries, leaf ' +
          'capacity swept from 2 to 64.',
        steps: [
          {
            do: 'Build at capacity 2 and count the tree.',
            why: 'The tightest bucket is the best case for candidate count and the worst for everything else.',
            work: 'nodes 29 893, leaves 22 420, empty leaves 7 832\n' +
              'depth reached 14 (the cap), largest leaf 7\n' +
              'memory 1 914 864 bytes = 95.7 per point',
            result: '50.31 candidates per query, and 84.21 node visits to find them'
          },
          {
            do: 'Build at capacity 64 and count it again.',
            why: 'The loosest bucket inverts every one of those numbers.',
            work: 'nodes 1 185, leaves 889, empty leaves 94\n' +
              'depth reached 8, largest leaf 64\n' +
              'memory 536 880 bytes = 26.8 per point',
            result: '87.73 candidates per query, and 11.45 node visits'
          },
          {
            do: 'Put the two costs side by side across the whole sweep.',
            why: 'To see whether the curve has a knee or is simply flat in the middle.',
            work: 'cap  2: 29 893 nodes, 50.31 candidates, 84.21 visits\n' +
              'cap  8:  7 721 nodes, 57.78 candidates, 29.84 visits\n' +
              'cap 16:  4 165 nodes, 63.55 candidates, 20.43 visits\n' +
              'cap 32:  2 221 nodes, 72.41 candidates, 14.97 visits',
            result: 'candidates rise 1.74× from capacity 2 to 64; nodes fall 25×'
          },
          {
            do: 'Note where the pruning goes.',
            why: 'A deeper tree prunes more nodes and visits more of them, which is not obviously a win.',
            work: 'cap  2: 26.69 nodes pruned per query, 84.21 visited\n' +
              'cap 64: 15.15 nodes pruned per query, 11.45 visited',
            result: 'capacity 2 rejects more subtrees and still does 7× the node work'
          }
        ],
        answer: 'The candidate count is nearly flat - 50.31 to 87.73 across a 32-fold change in capacity - and ' +
          'everything else is not: nodes fall 25×, memory falls 3.6× and node visits fall 7.4×. So the capacity ' +
          'is not really a query-cost dial at all; it is a memory and traversal dial that costs a little accuracy ' +
          'at the leaves. Anything from 4 to 16 is defensible, and the choice should be made on what a node costs ' +
          'in your memory layout rather than on the candidate column.'
      },
      {
        title: 'The input with no size: coincident points',
        goal: 'Invert the first example - instead of tuning the tree, feed it the input that makes tuning ' +
          'irrelevant, and show why the depth cap is a correctness requirement rather than a knob.',
        setup: '20 000 points sitting on exactly 3 distinct locations, capacity 8, depth cap swept from 8 to 20.',
        steps: [
          {
            do: 'Say why the usual rule cannot terminate.',
            why: 'Every quadtree tutorial says "split until a leaf holds at most `capacity` points".',
            work: 'if p₁ = p₂, every subdivision puts both in the same child\n' +
              'the child holds the same 6 667 points as its parent, forever',
            result: 'the split rule has no fixed point, so the recursion is unbounded'
          },
          {
            do: 'Build with a depth cap of 8 and read the leaf.',
            why: 'The cap must be paired with a bucket that is allowed to exceed its capacity.',
            work: 'nodes 89, depth reached 8, largest leaf 6 667\n' +
              'capacity was 8; the leaf holds 833× that',
            result: 'the tree terminates, and the overflowing leaf is the reason'
          },
          {
            do: 'Raise the cap and see what changes.',
            why: 'Because the instinct is that a deeper tree would separate them eventually.',
            work: 'cap  8: 89 nodes,  depth  8, largest leaf 6 667\n' +
              'cap 12: 137 nodes, depth 12, largest leaf 6 667\n' +
              'cap 16: 185 nodes, depth 16, largest leaf 6 667\n' +
              'cap 20: 233 nodes, depth 20, largest leaf 6 667',
            result: '12 nodes per extra level, and the leaf never gets smaller'
          },
          {
            do: 'Try the degenerate limit: all 20 000 points on one site.',
            why: 'To confirm the node count is driven by the distinct sites, not by the point count.',
            work: 'distinct 1, cap 12: 49 nodes, one leaf of 20 000\n' +
              'distinct 3, cap 12: 137 nodes, largest leaf 6 667\n' +
              'distinct 10, cap 12: 405 nodes, largest leaf 2 000',
            result: 'the node count follows the distinct sites; the 20 000 points are irrelevant'
          },
          {
            do: 'Price what the cap costs on ordinary data, so it is not a free choice.',
            why: 'A cap set too low turns every leaf into a linear scan.',
            work: '20 000 clustered points at capacity 8 reach depth 11 naturally\n' +
              'a cap of 8 would truncate them, and the largest leaf grows accordingly',
            result: 'the cap must sit above the depth the data naturally reaches'
          }
        ],
        answer: 'Coincident points make the standard split rule non-terminating, and the fix is two rules ' +
          'together: cap the depth, and let the leaf bucket overflow when the cap is reached. Either alone is ' +
          'still broken. Raising the cap buys nothing at all here - 12 nodes per level, the same 6 667-point leaf ' +
          'at every setting - because the tree is subdividing space and the points occupy no space. That is why ' +
          'the depth cap belongs in the correctness argument rather than the tuning section, and why a test suite ' +
          'for a quadtree needs a coincident-point case that is not an afterthought.'
      }
    ],

    'kd-trees': [
      {
        title: 'The descent is a guess; the backtrack is the answer',
        goal: 'Measure exactly what nearest-neighbour search costs with and without the backtrack, and exactly ' +
          'how wrong the version without it is.',
        setup: '20 000 clustered points, leaf size 8, 500 nearest-neighbour queries, each answer compared with ' +
          'brute force.',
        steps: [
          {
            do: 'Build the tree and record its shape.',
            why: 'Median splits make the depth exact, which makes the descent cost exact too.',
            work: 'nodes 8 191, leaves 4 096, depth exactly 12, mean leaf 4.88 points\n' +
              'built with 720 512 comparisons - 36 per point, 3 per level',
            result: 'a perfectly balanced tree over data that is not uniform'
          },
          {
            do: 'Run the descent alone: walk to the leaf the query falls in and take the best point there.',
            why: 'This is the algorithm every buggy k-d tree implements, and it is very fast.',
            work: '13 nodes visited, 1 leaf, 4.87 distance computations per query\n' +
              'brute force costs 20 000 distance computations',
            result: '4 100× cheaper than a scan, and it returns a point for every query'
          },
          {
            do: 'Score those answers against brute force.',
            why: 'Because the answers look completely reasonable.',
            work: 'wrong on 301 of 500 queries - 60.2%\n' +
              'mean reported distance 60.272 against a true 42.701\n' +
              'median overshoot on a wrong answer 1.38×, worst 17.91×',
            result: 'plausible, confidently wrong three times in five'
          },
          {
            do: 'Add the backtrack with the splitting-plane bound.',
            why: 'Re-examining the far side of every split closer than the best distance so far is what makes it correct.',
            work: '51.50 nodes visited, 14.26 leaves, 69.28 distance computations per query\n' +
              'wrong on 0 of 500',
            result: '14× the cost of the descent, and 0.35% of a brute-force scan'
          },
          {
            do: 'Swap the plane bound for the far subtree\'s bounding box.',
            why: 'The box lies beyond the plane, so the bound is never weaker and often much tighter.',
            work: 'plane bound: 69.28 distances, 51.50 nodes, 14.26 leaves\n' +
              'box bound:   19.77 distances, 27.08 nodes,  4.05 leaves\n' +
              'both wrong on 0 of 500',
            result: '3.5× fewer distance computations for a few more operations per node'
          }
        ],
        answer: 'The descent costs 4.87 distance computations and is wrong 60.2% of the time, reporting a mean ' +
          'neighbour distance of 60.272 where the truth is 42.701. The backtrack costs 69.28 and is never wrong. ' +
          'Nothing about the broken version looks broken from the outside - it returns a nearby point at a ' +
          'believable distance on every query - which is why the only acceptable test is agreement with brute ' +
          'force over hundreds of queries. Given that the backtrack is compulsory, the box bound is the free ' +
          'part: 19.77 distances against 69.28, for the same exact answers.'
      },
      {
        title: 'The dimension where the tree stops being a tree',
        goal: 'Invert the first example: keep the algorithm correct and the implementation identical, and raise ' +
          'the dimension until pruning stops working entirely.',
        setup: '4 000 uniform points, one nearest-neighbour query each over 50 queries, dimension swept from 2 ' +
          'to 128. The tree, the leaf size and the bound are unchanged throughout.',
        steps: [
          {
            do: 'State the geometric reason before measuring.',
            why: 'The result is not an implementation artefact and should not look like one.',
            work: 'the volume of a unit ball over the volume of the enclosing cube → 0 as d grows\n' +
              'so almost every subtree intersects the search radius, and almost nothing prunes',
            result: 'the prediction is that the scanned fraction climbs to 1'
          },
          {
            do: 'Measure the fraction of the data touched, dimension by dimension.',
            why: 'A fraction is comparable across dimensions; a raw count is not.',
            work: 'd =  2:    13.66 distances per query - 0.3% of the data\n' +
              'd =  4:    65.10 - 1.6%\n' +
              'd =  8:   644.90 - 16.1%\n' +
              'd = 16: 3 981.56 - 99.5%',
            result: 'the useful range ends somewhere between 8 and 16 dimensions'
          },
          {
            do: 'Push it further to see whether it levels off.',
            why: 'To find out whether high dimensions are slow or simply hopeless.',
            work: 'd =  32: 4 000.00 distances - 100.0%\n' +
              'd =  64: 4 000.00 - 100.0%\n' +
              'd = 128: 4 000.00 - 100.0%',
            result: 'every point, every query - a full scan with a tree walk on top'
          },
          {
            do: 'Watch the pruning counter rather than the cost.',
            why: 'It shows the mechanism failing, not just the symptom.',
            work: 'd =  2: 9.26 subtrees pruned per query\n' +
              'd =  8: 55.26 pruned\n' +
              'd = 16: 1.96 pruned\n' +
              'd = 32: 0.00 pruned',
            result: 'pruning peaks and then collapses to nothing'
          },
          {
            do: 'Check that the failure is the geometry and not this particular tree.',
            why: 'A VP-tree prunes with the triangle inequality instead of axis-aligned planes.',
            work: '3 000 vectors in 48 dimensions, VP-tree, exact nearest:\n' +
              '2 992.67 distance computations per query of a possible 3 000',
            result: 'a different exact structure fails in the same place, by 0.24%'
          }
        ],
        answer: 'The same correct algorithm goes from touching 0.3% of the data at two dimensions to 100% at ' +
          'thirty-two, and the pruning counter shows why: subtrees pruned peaks at eight dimensions and is zero ' +
          'by thirty-two. A VP-tree, which prunes by metric rather than by axis, manages 2 992.67 of 3 000 - it ' +
          'fails identically. There is no exact index worth building up here, which is why 8.8 stops asking for ' +
          'exactness and starts asking for a recall number instead.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
