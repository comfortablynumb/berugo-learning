/** Worked examples for boolean operations and rotating calipers (M16.7-M16.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'polygon-clipping': [
      {
        title: 'The clip that returns nothing, and the one that returns two-thirds of nothing',
        goal: 'Run Sutherland-Hodgman against seven clip polygons, and separate the shapes where it ' +
          'is correct from the shapes where it is confidently wrong.',
        setup: 'One subject polygon clipped by seven regions — five concave, two convex — with a ' +
          'convex decomposition and a 160 000-cell sampler as independent references.',
        steps: [
          {
            do: 'Clip against the notch and read the result.',
            why: 'The notch is the simplest concave clip in the set.',
            work: 'Sutherland-Hodgman returns 0 vertices and an area of 0.0; the answer is 2 800.0',
            result: '100.0% error, and at least an obvious one'
          },
          {
            do: 'Clip against the L-shape and the chevron.',
            why: 'These are the failures that do not announce themselves.',
            work: 'a 4-vertex polygon of area 900.0 against 2 700.0, and a 5-vertex one of 900.0 against 2 700.0',
            result: '66.7% and 66.8% missing, from results that look entirely plausible'
          },
          {
            do: 'Read the two convex rows.',
            why: 'The algorithm is correct there by construction, so they calibrate the sampler.',
            work: 'the square at 0.0% error and the band at 0.3%',
            result: 'that 0.3% is the sampler\'s resolution, not the clipper\'s error'
          },
          {
            do: 'Decompose each concave clip into convex pieces and clip against each.',
            why: 'The half-plane identity holds on every piece, so the union is right.',
            work: '6 pieces for the notch, totalling 2 800.0 — the sampled value exactly',
            result: 'the decomposition column matches the sampled column on every row'
          },
          {
            do: 'Count how the five concave clips fail.',
            why: 'The distribution is the practical point.',
            work: '2 return an empty polygon, 3 return a wrong area',
            result: 'the majority failure is the silent one'
          }
        ],
        answer: 'Sutherland-Hodgman is correct exactly when the clip region equals the intersection ' +
          'of its edges\' half-planes, which is the definition of convex. Against the five concave ' +
          'clips it returns nothing twice and a plausible polygon missing 60 to 67% of its area ' +
          'three times, with no error raised in either case. Decomposing the clip into convex pieces ' +
          'reuses the same algorithm and lands on the sampled area exactly.'
      },
      {
        title: 'A sampler that answers all four operations, and a corner count nobody sets',
        goal: 'Use a rasterised reference to check every boolean operation at once, then measure ' +
          'what the default disc approximation costs a buffered polygon.',
        setup: 'The same two polygons under union, intersection, difference and exclusive-or on a ' +
          '160 000-cell grid, and one polygon offset by discs of 3 to 64 corners.',
        steps: [
          {
            do: 'Run all four operations through the sampler.',
            why: 'It needs no case analysis, which is what makes it a usable oracle.',
            work: 'intersection 2 800.0 from 44 800 cells, union 9 600.0 from 153 600, difference 800.0, xor 6 800.0',
            result: 'one mechanism, four answers, no traversal logic'
          },
          {
            do: 'Check union plus intersection against the two areas added.',
            why: 'It is an identity, so it needs no ground truth at all.',
            work: '9 600.0 + 2 800.0 = 12 400.0, and the exclusive-or of 6 800.0 is their difference',
            result: 'a free regression test for any clipper'
          },
          {
            do: 'Quote the sampler\'s resolution alongside its answers.',
            why: 'A disagreement smaller than a cell means nothing.',
            work: 'each of the 160 000 cells is 0.0625 in area',
            result: 'the floor below which a difference is not a difference'
          },
          {
            do: 'Offset the polygon by a disc of 3 corners and then of 16.',
            why: 'Buffering is a Minkowski sum, and the disc is always a polygon.',
            work: '2 717.4 against a true 3 081.1 — 11.80% short — then 3 075.9, 0.17% short',
            result: 'the approximating disc is inscribed, so the result is always too small'
          },
          {
            do: 'Read the shortfall down the corner counts.',
            why: 'To know what the default in a buffering library is actually costing.',
            work: '11.80%, 3.91%, 0.65%, 0.29%, 0.17%, 0.04%, 0.01% at 3, 6, 8, 12, 16, 32 and 64 corners',
            result: 'the error falls with the square of the corner count'
          }
        ],
        answer: 'A grid sampler answers union, intersection, difference and exclusive-or with the ' +
          'same three lines and an error of one cell along the boundary — 0.0625 per cell here — ' +
          'which makes it the right reference and a useless algorithm. The buffering figures are the ' +
          'practical sting: every library exposes the corner count and almost nobody sets it, and ' +
          'the bias is always downward, so a buffered geometry is quietly smaller than the one that ' +
          'was asked for.'
      }
    ],

    'rotating-calipers': [
      {
        title: 'Nine angles, and the theorem that says the other infinity are worse',
        goal: 'Find the minimum-area enclosing rectangle by trying one angle per hull edge, and ' +
          'check the result against a brute-force rotation sweep.',
        setup: 'A diagonally arranged point set with a 9-vertex hull, with every hull-edge angle ' +
          'tried and a 3 600-angle sweep as the reference.',
        steps: [
          {
            do: 'Hull the points and count the edges.',
            why: 'Calipers work on a convex ring, and h is the cost.',
            work: '9 hull vertices, so 9 candidate angles',
            result: 'a continuous optimisation reduced to nine trials'
          },
          {
            do: 'Try each candidate angle and take the smallest area.',
            why: 'The minimum rectangle always has a side flush with a hull edge.',
            work: 'the winner at −135.09° measures 141.47 by 6.59 for an area of 932.6',
            result: 'the runner-up at 44.84° is 933.8 — nearly the same shape at a very different angle'
          },
          {
            do: 'Compare against the axis-aligned bounding box.',
            why: 'That is the default everywhere, and it is free.',
            work: '932.6 against 10 058.0 — a ratio of 0.093, or 10.79× less area',
            result: 'the same points, no approximation, an order of magnitude tighter'
          },
          {
            do: 'Run a 3 600-angle rotation sweep as the reference.',
            why: 'The exact scan has to be checked against something.',
            work: 'the sweep\'s best is 932.779 against the scan\'s 932.559 — 0.024% apart',
            result: 'the scan is better, which is the sweep missing the optimum'
          },
          {
            do: 'State the assertion the right way round.',
            why: 'A discretised reference cannot be an equality test.',
            work: 'the sweep\'s step is 0.0250°, larger than the gap between the two answers',
            result: 'the scan must never be worse than the sweep, and never is'
          }
        ],
        answer: 'One theorem — the minimum rectangle has a side flush with a hull edge — turns an ' +
          'optimisation over every angle into nine trials, and on this set it finds a rectangle ' +
          '10.79× smaller in area than the axis-aligned box. The reference sweep is one-sided by ' +
          'construction: at a step of 0.0250° it will usually miss the optimum, so being beaten by ' +
          '0.024% is the expected outcome rather than a discrepancy.'
      },
      {
        title: 'Where the rotation buys nothing, and the two answers that must be exact',
        goal: 'Measure the same three quantities across six point sets, and find where the ' +
          'technique earns its keep and where it does not.',
        setup: 'Six fixture sets — diagonal, uniform, circle, clustered, convex-heavy and grid — ' +
          'with the diameter checked against every pair and the enclosing circle against every point.',
        steps: [
          {
            do: 'Compute the minimum rectangle and the axis-aligned box for each set.',
            why: 'The ratio between them is what the rotation actually buys.',
            work: 'diagonal 0.093, convex-heavy 0.973, circle 0.998, clustered 0.999, uniform 1.000, grid 1.000',
            result: 'one set gains an order of magnitude and two gain nothing at all'
          },
          {
            do: 'Read the best angle alongside the ratio.',
            why: 'It explains the ratio rather than merely accompanying it.',
            work: 'the grid\'s best angle is 0.0° and the diagonal set\'s is −135.1°',
            result: 'the technique pays exactly when the data has a grain the axes do not share'
          },
          {
            do: 'Compute the diameter by calipers and by scanning every pair.',
            why: 'Both endpoints are on the hull, so the walk is complete rather than a heuristic.',
            work: '141.487 against 141.487 — exact agreement',
            result: 'an exact combinatorial answer, tested with equality rather than tolerance'
          },
          {
            do: 'Build the smallest enclosing circle and test every point against it.',
            why: 'It is the cheapest of the three checks and catches the most.',
            work: 'radius 70.74, 2 points on the boundary, 2 594 rebuild steps, and every point covered',
            result: 'never more than three points determine it'
          },
          {
            do: 'Count hull sizes across the sets.',
            why: 'Every cost here is in h, not n.',
            work: 'from 5 on the grid to 80 on the circle',
            result: 'h is the number of candidate angles tried'
          }
        ],
        answer: 'The rotation is worth 10.79× on diagonal data and exactly nothing on a grid, and ' +
          'the best-angle column says which case you are in. The two exact quantities — the diameter ' +
          'and the enclosing circle\'s coverage — are checked with equality against O(n²) and O(n) ' +
          'references, and the one approximate reference is asserted one-sidedly. Calipers code is ' +
          'short and subtle, and an off-by-one in the antipodal walk is right on most inputs and ' +
          'quietly too small on the rest.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
