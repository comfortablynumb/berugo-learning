/** Worked examples for the R-tree, BVH and curve sections (M08.4-M08.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'r-trees': [
      {
        title: 'Four split heuristics, one set of rectangles',
        goal: 'Show that R-tree query cost is decided by sibling overlap rather than by height, by building the ' +
          'same data four ways and measuring both.',
        setup: '20 000 rectangles of side about 12 in a 1 000 × 1 000 domain, fan-out 9, 200 window queries of ' +
          'side 60. Every build sees the rectangles in the same order.',
        steps: [
          {
            do: 'Check that the four trees are the same shape before comparing them.',
            why: 'If they differed in height the comparison would be about height, which is the thing being ruled out.',
            work: 'first-fit  3 697 nodes, height 6, 71.6% full\n' +
              'linear     3 762 nodes, height 6, 70.3% full\n' +
              'quadratic  3 782 nodes, height 6, 69.7% full\n' +
              'R*         3 593 nodes, height 6, 73.1% full',
            result: 'same height, node counts within 5% - any difference is not structural'
          },
          {
            do: 'Measure the total sibling overlap as a fraction of the area covered.',
            why: 'This is the quantity the heuristics are actually competing on.',
            work: 'first-fit 113.69%\nlinear     57.67%\nquadratic  59.58%\nR*         24.49%',
            result: 'a 4.6× spread from the same rectangles at the same height'
          },
          {
            do: 'Run the 200 window queries against each.',
            why: 'To find out whether the overlap number predicts the cost.',
            work: 'first-fit  356.04 nodes visited, 2 250.07 candidates per query\n' +
              'linear      78.90 nodes visited,   499.41 candidates\n' +
              'quadratic   85.32 nodes visited,   547.07 candidates\n' +
              'R*          36.69 nodes visited,   239.13 candidates',
            result: 'the ranking matches the overlap ranking exactly, over a 9.7× range in node visits'
          },
          {
            do: 'Note the result that contradicts the usual summary.',
            why: 'Guttman argued the quadratic pick was worth its O(M²); here it is not.',
            work: 'linear:    O(M) seeds, 57.67% overlap, 499.41 candidates\n' +
              'quadratic: O(M²) seeds, 59.58% overlap, 547.07 candidates',
            result: 'linear is 3.2% better on overlap and 8.7% better on cost, for less work'
          },
          {
            do: 'Confirm every tree returns the same answers.',
            why: 'A cheaper index that has stopped returning some rectangles is not cheaper.',
            work: 'all four return 105.89 results per query\n' +
              'all four disagree with brute force on 0 of 200 queries',
            result: 'identical answers, 9.7× apart in cost'
          }
        ],
        answer: 'Four trees, the same 20 000 rectangles, the same height 6 and the same answers - and a 9.7× ' +
          'range in query cost, ordered exactly by sibling overlap. R* wins on both, at 24.49% overlap and 36.69 ' +
          'node visits. The result worth carrying away is the one that contradicts the textbook: on this data ' +
          'Guttman\'s linear split beats his quadratic split on both measures while doing asymptotically less ' +
          'work, so "quadratic is the better heuristic" is a claim to check on your own rectangles rather than ' +
          'inherit.'
      },
      {
        title: 'Bulk loading, and why systems rebuild instead of maintaining',
        goal: 'Invert the first example: stop improving the split heuristic and remove the splits entirely by ' +
          'building the tree bottom-up from the sorted data.',
        setup: 'The same 20 000 rectangles and the same 200 window queries, built once by repeated insertion ' +
          'with the quadratic split and once by sort-tile-recursive packing.',
        steps: [
          {
            do: 'Say where the incremental tree\'s space goes.',
            why: 'Every split makes two nodes out of one, and neither is full afterwards.',
            work: 'incremental: 3 186 leaves at 69.7% full, height 6\n' +
              'a full leaf holds 9; the mean leaf holds 6.3',
            result: 'about 30% of every page is empty, and that costs a whole level'
          },
          {
            do: 'Pack the leaves instead: sort by x, cut into slices, sort each slice by y, fill pages.',
            why: 'The data is all present at build time, so there is no reason to leave room.',
            work: 'slices = ⌈√(20 000/9)⌉ = 48\n' +
              'STR: 2 254 leaves at 98.6% full, height 5',
            result: 'one level shorter and 29% fewer leaves for the same rectangles'
          },
          {
            do: 'Compare the overlap the two builds leave behind.',
            why: 'Packing tiles the plane; splitting divides whatever a node happened to hold.',
            work: 'incremental quadratic: 59.58% overlap\nSTR:                  35.89% overlap',
            result: 'bulk loading beats the split heuristic without having a heuristic'
          },
          {
            do: 'Run the same queries.',
            why: 'The two effects - shorter tree, less overlap - should compound.',
            work: 'quadratic: 85.32 nodes visited, 547.07 candidates per query\n' +
              'STR:       28.43 nodes visited, 247.48 candidates',
            result: '3.0× fewer node visits and 2.2× fewer candidates'
          },
          {
            do: 'Compare STR against the best incremental build, not the worst.',
            why: 'Otherwise the comparison flatters bulk loading by choosing a weak opponent.',
            work: 'R*:  36.69 nodes visited, 239.13 candidates, 24.49% overlap\n' +
              'STR: 28.43 nodes visited, 247.48 candidates, 35.89% overlap',
            result: 'STR visits 22.5% fewer nodes; R* tests 3.4% fewer candidates. Effectively a draw.'
          },
          {
            do: 'State the invariant STR deliberately breaks.',
            why: 'A test that asserts Guttman\'s minimum fill against an STR tree is checking the wrong structure.',
            work: 'the last page of each slice is short by construction\n' +
              'minimum fill at fan-out 9 is ⌈9 × 0.4⌉ = 4, and STR leaves pages below it\n' +
              'minimum fill is an insertion invariant, not a property of R-trees',
            result: 'the invariant check takes a flag, and the caller says which structure it built'
          }
        ],
        answer: 'Sort-tile-recursive packing gets a tree one level shorter with 98.6% full pages and 35.89% ' +
          'overlap, and answers the same queries in 28.43 node visits against the incremental quadratic tree\'s ' +
          '85.32 - a factor of three, from removing the splits rather than improving them. Against a properly ' +
          'tuned R* build it is a draw. The practical consequence is the one databases act on: a rebuild is O(n ' +
          'log n) and is worth scheduling, because insertion adds overlap monotonically and nothing removes it.'
      }
    ],

    'bounding-volumes': [
      {
        title: 'The surface-area heuristic, and what it costs a ray',
        goal: 'Take the SAH seriously as a cost model - evaluate it, minimise it, and then check that the rays ' +
          'agree with the model.',
        setup: '20 000 triangles in six clumps inside a 100-unit cube, 1 000 rays, leaf size 4, 16 bins per axis. ' +
          'One tree splits at the median centroid on the widest axis; the other minimises the SAH.',
        steps: [
          {
            do: 'Write the cost model down before building anything.',
            why: 'The assumption is specific and worth stating: for a random ray that already hits the parent, the chance of hitting a child is the surface-area ratio.',
            work: 'C(split) = Ct + Ci · (A(L)·N(L) + A(R)·N(R)) / A(P)\n' +
              'with Ct = 1 and Ci = 2 here',
            result: 'a number per candidate split, not a preference'
          },
          {
            do: 'Build both trees and evaluate the model on each.',
            why: 'The SAH build is minimising exactly this, so it had better win on it.',
            work: 'median split: 15 423 nodes, 7 712 leaves, depth 13, SAH cost 65.81\n' +
              'SAH split:    13 273 nodes, 6 637 leaves, depth 18, SAH cost 49.44',
            result: '24.9% lower modelled cost, from a deeper but smaller tree'
          },
          {
            do: 'Cast the rays and see whether the model predicted anything.',
            why: 'A cost model that does not correlate with measured cost is decoration.',
            work: 'median: 40.70 nodes visited, 9.14 primitives tested per ray\n' +
              'SAH:    25.71 nodes visited, 7.76 primitives tested\n' +
              'brute force: 20 000 primitives tested per ray',
            result: '36.8% fewer node visits and 15.1% fewer primitive tests, both in the direction the model said'
          },
          {
            do: 'Measure the sibling overlap the two builds leave.',
            why: 'This is the mechanism behind the number - overlapping children are both entered.',
            work: 'median split: 215 703 units of overlapping surface area\n' +
              'SAH split:    148 414',
            result: '31.2% less overlap, which is where the node visits went'
          },
          {
            do: 'Check how often the model\'s other half - the decision not to split at all - actually fires.',
            why: 'It is the part of the SAH most summaries lead with, and on this scene at this leaf size it does nothing.',
            work: 'leaf size 4: 0 leaves made because splitting would have cost more\n' +
              'leaf size 1: 69 of them, and the tree cost falls to 36.28\n' +
              'four primitives are already cheaper than any split of them',
            result: 'the leaf rule makes a small leaf size safe; it is not where this tree\'s win comes from'
          },
          {
            do: 'Confirm the two trees answer identically.',
            why: 'Both must agree with brute force on hit, miss and distance for every ray.',
            work: '1 000 rays, 254 hits, 746 misses\n' +
              'median and SAH: 0 rays disagree with brute force',
            result: 'the same picture, 1.6× fewer node visits'
          }
        ],
        answer: 'The SAH is an expected-cost estimate with a stated assumption, and on this scene it works: 49.44 ' +
          'modelled against the median split\'s 65.81, and 25.71 node visits per ray against 40.70. Both trees ' +
          'return the identical 254 hits. Notice the shape of the win - the SAH tree is *deeper* (18 against 13) ' +
          'and *smaller* (13 273 nodes against 15 423) - and notice where it does *not* come from: the ' +
          'leave-it-alone branch fires zero times at this leaf size. What the model buys here is uneven splits ' +
          'that let subtrees bottom out at different rates, which a median cut cannot express.'
      },
      {
        title: 'Refitting an animated scene, and the motion that destroys it',
        goal: 'Invert the first example: keep the tree the SAH built and stop rebuilding it, then find the motion ' +
          'for which that is a mistake.',
        setup: 'The same 20 000 triangles and 1 000 rays. The scene is moved twice - once coherently, so ' +
          'neighbouring triangles move together, and once with each triangle displaced independently - and after ' +
          'each move the tree is refitted bottom-up and compared with a full rebuild.',
        steps: [
          {
            do: 'Note what a refit is allowed to change.',
            why: 'This is the property that a BVH has and a k-d tree does not.',
            work: 'box(node) = box(left) ∪ box(right), one post-order pass over 13 273 nodes\n' +
              'the assignment of all 20 000 primitives to leaves is untouched',
            result: 'the topology stays valid however far the primitives move'
          },
          {
            do: 'Move the scene coherently and refit.',
            why: 'Neighbouring triangles staying neighbours is the case animation is normally in.',
            work: 'SAH cost before 49.44 → after refit 49.95; a rebuild gives 50.85\n' +
              'primitives tested per ray: refit 7.99, rebuild 8.24',
            result: 'the refit is indistinguishable from the rebuild, and slightly better'
          },
          {
            do: 'Move every triangle independently and refit the same tree.',
            why: 'To find where "the topology stays valid" stops meaning "the tree is still good".',
            work: 'SAH cost before 49.44 → after refit 258.29; a rebuild gives 50.76\n' +
              'primitives tested per ray: refit 82.32, rebuild 9.61',
            result: '8.6× more primitive tests, from a tree that is still perfectly correct'
          },
          {
            do: 'Check the root box, which is the number people usually watch.',
            why: 'It is the obvious health metric and it does not detect this.',
            work: 'coherent motion:  root surface area × 0.98\n' +
              'scattered motion: root surface area × 1.16',
            result: 'a 16% root growth accompanies a 5.2× cost regression - the root says nothing'
          },
          {
            do: 'Use the tree\'s own SAH cost as the health metric instead.',
            why: 'It is the quantity the build optimised, so drift in it is exactly the signal wanted.',
            work: 'coherent: 49.44 → 49.95, a 1.0% drift\n' +
              'scattered: 49.44 → 258.29, a 5.2× drift',
            result: 'one number that separates the two regimes cleanly'
          }
        ],
        answer: 'Refitting is free and correct, and whether it is *good* depends entirely on whether the motion ' +
          'preserved the grouping. Under coherent motion the refitted tree costs 49.95 against a rebuild\'s ' +
          '50.85 and there is no reason to rebuild at all; under independent motion it costs 258.29 against ' +
          '50.76 and tests 82.32 primitives per ray against 9.61 - a tree that is still perfectly correct and ' +
          'has quietly stopped pruning. The root box grows only 16% in that case and detects nothing, so the ' +
          'metric to watch is the tree\'s own SAH cost.'
      }
    ],

    'space-filling-curves': [
      {
        title: 'A rectangle becomes a set of key ranges',
        goal: 'Turn a two-dimensional window query into the one-dimensional range scans a key-value store can ' +
          'actually serve, and price the result.',
        setup: 'A 64 × 64 grid (order 6), an 18 × 17 rectangle at (9, 5), and both curves.',
        steps: [
          {
            do: 'Count what the query wants.',
            why: 'Everything below is measured against this.',
            work: '18 × 17 = 306 cells',
            result: '306 cells, out of 4 096 in the grid'
          },
          {
            do: 'Decompose the rectangle into Z-order ranges.',
            why: 'A rectangle is contiguous in space and almost never contiguous along the curve.',
            work: '45 maximal runs of consecutive Morton indices\n' +
              'spanning 772 index positions from first to last',
            result: '45 round trips for an exact answer, or one scan of 772 cells to get 306'
          },
          {
            do: 'Do the same on the Hilbert curve.',
            why: 'This is the comparison the whole section is about.',
            work: '22 maximal runs, spanning 758 index positions',
            result: 'half the ranges for the same 306 cells'
          },
          {
            do: 'Coalesce to a range budget and price the waste.',
            why: 'A store that charges per request prefers reading extra cells to issuing forty scans.',
            work: 'Hilbert to  4 ranges: 436 cells scanned, 130 false positives (42.5% waste)\n' +
              'Hilbert to  8 ranges: 347 scanned,  41 false (13.4%)\n' +
              'Hilbert to 16 ranges: 320 scanned,  14 false (4.6%)\n' +
              'Hilbert to 22 ranges: 306 scanned,   0 false',
            result: 'the curve is steep below 8 ranges and flat above 16'
          },
          {
            do: 'Compare the same budgets on Z-order.',
            why: 'To find out whether the curve choice still matters once a budget is imposed.',
            work: 'Morton to  4 ranges: 489 scanned, 183 false (59.8%)\n' +
              'Morton to  8 ranges: 387 scanned,  81 false (26.5%)\n' +
              'Morton to 16 ranges: 338 scanned,  32 false (10.5%)',
            result: 'at every budget Z-order wastes about twice as much'
          }
        ],
        answer: 'A 306-cell rectangle is 45 Z-order ranges or 22 Hilbert ranges, and the choice between "many ' +
          'exact scans" and "one wasteful scan" is the query plan. At a budget of eight ranges the Hilbert plan ' +
          'reads 347 cells and the Z-order plan reads 387 for the same 306 wanted - so the curve is worth about ' +
          'a factor of two in waste at every budget. And even at zero waste the result is a superset: cells are ' +
          'a discretisation, so the exact predicate still has to be applied to whatever comes back.'
      },
      {
        title: '"Hilbert has better locality" - under which metric?',
        goal: 'Invert the first example. Instead of using the curves, test the sentence everyone repeats about ' +
          'them, and find the metric under which it is false.',
        setup: 'The same 64 × 64 grid. Two different measurements of "locality": the index gap between cells ' +
          'that are neighbours in space, and the number of contiguous runs a square window breaks into.',
        steps: [
          {
            do: 'Measure the obvious thing first: how far apart in the index are two adjacent cells?',
            why: 'This is what "close in space means close in the key" says, read literally.',
            work: 'mean gap over all adjacent pairs: Hilbert 39.05, Morton 32.50\n' +
              'worst gap:                          Hilbert 3 413, Morton 1 366',
            result: 'Z-order wins on both the mean and the worst case'
          },
          {
            do: 'Check the property that made people believe the claim.',
            why: 'The Hilbert curve really does have a property Z-order lacks; it is just not that one.',
            work: 'maximum step along the curve: Hilbert 1.00, Morton 63.01\n' +
              'mean step:                    Hilbert 1.00, Morton 1.64',
            result: 'Hilbert is continuous; Z-order crosses the grid at every power-of-two boundary'
          },
          {
            do: 'Measure the thing a query actually pays for: runs per window.',
            why: 'Runs are round trips, and round trips are the cost model.',
            work: 'window 4 × 4:   Hilbert  3.94 runs, Morton  6.25\n' +
              'window 8 × 8:   Hilbert  7.86 runs, Morton 13.95\n' +
              'window 16 × 16: Hilbert 15.68 runs, Morton 29.49',
            result: 'Hilbert wins by 1.59×, 1.77× and 1.88× - and the ratio grows'
          },
          {
            do: 'Restate it as cells per range, which is what a scan returns.',
            why: 'The reciprocal is easier to reason about when sizing a request budget.',
            work: 'Hilbert: 4.06, 8.14, 16.33 cells per range at sides 4, 8, 16\n' +
              'Morton:  2.56, 4.59,  8.68',
            result: 'a Hilbert range carries about twice as many useful cells'
          },
          {
            do: 'Price the difference against the encoding cost.',
            why: 'Because that is the whole trade, and Hilbert is not free.',
            work: 'Morton:  4 shift-and-mask steps, branch-free\n' +
              'Hilbert: one rotation per bit of order - a loop, 6 iterations here',
            result: 'roughly an order of magnitude more work per conversion, once per row'
          }
        ],
        answer: 'Under the obvious metric the claim is false: Hilbert\'s mean neighbour gap is 39.05 against ' +
          'Z-order\'s 32.50 and its worst is 3 413 against 1 366. Under the metric the cost model actually ' +
          'contains - contiguous runs per window - it is true and worth about a factor of two, growing with ' +
          'window size. Both statements are about "locality" and they point opposite ways, which is exactly why ' +
          'the metric has to be named. The engineering answer follows: Hilbert if queries dominate, Z-order if ' +
          'ingest does, and the crossover is measurable rather than a matter of taste.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
