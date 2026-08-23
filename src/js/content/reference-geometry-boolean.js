/** Reference entries for boolean operations and rotating calipers (M16.7-M16.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'polygon-clipping': {
      summary: 'A clipper that is exactly right on convex regions and confidently wrong on concave ' +
        'ones, a rasterised oracle that answers every operation, and the buffering parameter nobody ' +
        'sets.',
      intuition: 'Sutherland-Hodgman intersects half-planes, and a concave region is not the ' +
        'intersection of its edges\' half-planes.',
      formulation: {
        equations: [
          {
            label: 'When the algorithm is correct',
            expr: 'exactly when the clip region equals the intersection of its edges\' half-planes',
            terms: [
              { sym: 'convex clips', meaning: 'the identity holds by definition — the square at 0.0% error, the band at 0.3%' },
              { sym: 'concave clips', meaning: 'the half-plane of a notch cuts away parts genuinely inside the region' },
              { sym: 'measured', meaning: 'the notch clip returns 0 vertices and an area of 0.0 where the answer is 2 800.0' }
            ]
          },
          {
            label: 'The two failure shapes',
            expr: 'of 5 concave clips, 2 return nothing and 3 return a plausible wrong polygon',
            terms: [
              { sym: 'the loud one', meaning: 'notch and shallow: 0 vertices, 100.0% error, and someone investigates' },
              { sym: 'the silent one', meaning: 'l-shape 66.7%, chevron 66.8%, star 60.0% — right shape, right winding, wrong area' },
              { sym: 'the fix', meaning: 'decompose the clip into convex pieces; 6 pieces give 2 800.0, the sampled value exactly' }
            ]
          },
          {
            label: 'The rasterised oracle',
            expr: 'sample the plane and count; union, intersection, difference and exclusive-or from the same three lines',
            terms: [
              { sym: 'measured', meaning: 'intersection 2 800.0 from 44 800 of 160 000 cells; union 9 600.0; difference 800.0; xor 6 800.0' },
              { sym: 'the resolution floor', meaning: 'each cell is 0.0625 in area, so a smaller disagreement is not one' },
              { sym: 'the free identity', meaning: 'union + intersection = the two areas added — 12 400.0 here, needing no ground truth' }
            ]
          },
          {
            label: 'Offsetting, which is a Minkowski sum with a disc',
            expr: 'the disc is a polygon, and the shortfall falls with the square of its corner count',
            terms: [
              { sym: '3 corners', meaning: '2 717.4 against a true 3 081.1 — 11.80% short' },
              { sym: '16 corners', meaning: '3 075.9 — 0.17% short' },
              { sym: '64 corners', meaning: '3 080.7 — 0.01% short' },
              { sym: 'the direction of the bias', meaning: 'the approximating disc is inscribed, so a buffer is always too small, never too large' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Area of the union plus area of the intersection equals the two areas added',
          why: 'It is inclusion-exclusion on two sets and holds for any shapes at all.',
          breaks: 'A traversal bug in a boolean library usually fails this before anything else.'
        },
        {
          name: 'The exclusive-or equals the union minus the intersection',
          why: 'A second free identity, from outputs you already have.',
          breaks: 'An entry/exit misclassification shows up as an asymmetry between the two.'
        },
        {
          name: 'A clipper is checked against an independent reference, not against a picture',
          why: 'The common failure returns a plausible polygon with the wrong area.',
          breaks: 'A 60% shortfall passes every eyeball test and every schema validation.'
        },
        {
          name: 'The oracle\'s resolution is quoted with its answer',
          why: 'Its error is one cell along the boundary.',
          breaks: 'A sub-cell difference gets treated as a bug, or a real one as noise.'
        }
      ],
      complexity: [
        { operation: 'Sutherland-Hodgman', average: 'Θ(n·m) for n subject and m clip vertices', worst: 'correct only for convex clips — 100.0% error on the notch' },
        { operation: 'convex decomposition then clip', average: 'one pass per piece plus a union', worst: '6 pieces on the notch clip, landing on 2 800.0 exactly' },
        { operation: 'Greiner-Hormann', average: 'Θ((n + m + k) log …) with k intersections', worst: 'degenerate where the boundaries coincide rather than cross' },
        { operation: 'rasterised oracle', average: 'Θ(cells × edges)', worst: '160 000 cells at 0.0625 each — the reference, never the algorithm' },
        { operation: 'Minkowski sum with a c-corner disc', average: 'Θ((n + c) log (n + c))', worst: 'the offset polygon gains up to n + c vertices — 20 at 16 corners here' },
        { operation: 'memory', average: 'Θ(n + m) for the clipper', worst: 'the sampler is Θ(1) — it counts rather than storing' }
      ],
      failureModes: [
        {
          symptom: 'A clip against a concave region returns an empty polygon.',
          cause: 'Sutherland-Hodgman intersected half-planes that do not describe the region.',
          fix: 'Decompose the clip into convex pieces and union the results.'
        },
        {
          symptom: 'A clipped area is 60 to 70% smaller than it should be, and looks fine.',
          cause: 'The same bug, on a concave clip whose half-planes do not collapse to nothing.',
          fix: 'Assert areas against a sampler or a decomposition; nothing visual catches it.'
        },
        {
          symptom: 'A boolean library returns garbage when two polygons share an edge.',
          cause: 'The entry/exit classification is undefined where boundaries coincide.',
          fix: 'Snap coordinates to a grid first, and treat that snap as the correctness decision it is.'
        },
        {
          symptom: 'Buffered geometries are consistently a little too small.',
          cause: 'The disc approximating the buffer is inscribed, and the corner count is at its default.',
          fix: 'Raise the corner count: 3 corners lose 11.80% of the area and 16 lose 0.17%.'
        }
      ],
      inTheWild: [
        { system: 'Clipper2 and Vatti-based libraries', how: 'the production answer for arbitrary polygon booleans, with integer coordinates throughout' },
        { system: 'GEOS, JTS and PostGIS', how: 'ST_Buffer takes a quad-segment count — this section\'s corner parameter under another name' },
        { system: 'GPU and graphics pipelines', how: 'Sutherland-Hodgman against the view frustum, where the clip really is convex' },
        { system: 'CNC and motion planning', how: 'Minkowski sums to grow obstacles by the tool or the robot, turning a shape into a point' }
      ],
      sources: [
        { title: 'Reentrant polygon clipping', where: 'Sutherland, Hodgman — Communications of the ACM, 1974' },
        { title: 'Efficient clipping of arbitrary polygons', where: 'Greiner, Hormann — ACM Transactions on Graphics, 1998' },
        { title: 'A generic solution to polygon clipping', where: 'Bala Vatti — Communications of the ACM, 1992' },
        { title: 'Computational Geometry: Algorithms and Applications', where: 'de Berg, Cheong, van Kreveld, Overmars — Minkowski sums, chapter 13' }
      ]
    },

    'rotating-calipers': {
      summary: 'One theorem that turns a continuous optimisation into an O(h) scan, three ' +
        'quantities read off a rotating pair of supporting lines, and references slow enough to be ' +
        'obviously right.',
      intuition: 'The minimum-area rectangle has a side flush with a hull edge, so there are only h ' +
        'angles worth trying and every other one is provably worse.',
      formulation: {
        equations: [
          {
            label: 'The theorem',
            expr: 'a rectangle touching the hull only at isolated vertices can be rotated to a smaller one',
            terms: [
              { sym: 'the consequence', meaning: 'only edge-flush rectangles cannot be improved, and there are h of them' },
              { sym: 'measured', meaning: '9 hull edges, 9 candidate angles, winner at −135.09° with an area of 932.6' },
              { sym: 'the runner-up', meaning: '933.8 at 44.84° — nearly the same shape at a very different angle' }
            ]
          },
          {
            label: 'What the rotation buys',
            expr: 'the ratio of the minimum rectangle to the axis-aligned box',
            terms: [
              { sym: 'diagonal data', meaning: '932.6 against 10 058.0 — a ratio of 0.093, or 10.79× less area' },
              { sym: 'a grid', meaning: 'ratio 1.000 at a best angle of 0.0° — the rotation buys nothing' },
              { sym: 'the rest', meaning: 'convex-heavy 0.973, circle 0.998, clustered 0.999, uniform 1.000' },
              { sym: 'the rule', meaning: 'it pays exactly when the data has a grain the axes do not share' }
            ]
          },
          {
            label: 'The three references',
            expr: 'two exact and one discretised, and the discretised one is asserted one-sidedly',
            terms: [
              { sym: 'diameter', meaning: 'every pair, O(n²): 141.487 against 141.487, exact' },
              { sym: 'minimum rectangle', meaning: '3 600 evenly spaced angles at a step of 0.0250°: 932.779 against the scan\'s 932.559' },
              { sym: 'enclosing circle', meaning: 'every point tested against the circle — coverage is exact or the circle is wrong' },
              { sym: 'the one-sided assertion', meaning: 'the scan must never be worse than the sweep; being better is the sweep missing the optimum' }
            ]
          },
          {
            label: 'Welzl\'s circle',
            expr: 'expected linear time, from a randomised incremental construction with a basis of at most three points',
            terms: [
              { sym: 'why three', meaning: 'a circle through three points is determined, so the recursion is bounded' },
              { sym: 'why shuffle', meaning: 'the i-th point falls outside with probability at most 3/i, so rebuilds telescope' },
              { sym: 'measured', meaning: 'radius 70.74 with 2 points on the boundary, after 2 594 rebuild steps' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The diameter agrees exactly with a scan over every pair',
          why: 'It is an exact combinatorial answer, not an optimisation.',
          breaks: 'An off-by-one in the antipodal walk is right on most inputs and quietly too small on the rest.'
        },
        {
          name: 'The minimum rectangle is never worse than a fine rotation sweep',
          why: 'The scan is provably complete and the sweep is a sample.',
          breaks: 'Asserting equality instead makes the test fail on the discretisation rather than on a bug.'
        },
        {
          name: 'The enclosing circle covers every input point',
          why: 'The cheapest of the three checks, and the one that catches the most.',
          breaks: 'A circle that misses a point is not an enclosing circle under any definition.'
        },
        {
          name: 'Everything here needs a convex ring',
          why: 'The whole technique assumes the boundary turns one way.',
          breaks: 'A reflex vertex from a broken predicate makes the caliper walk skip antipodal pairs.'
        }
      ],
      complexity: [
        { operation: 'hulling first', average: 'Θ(n log n)', worst: 'the precondition, and usually the dominant cost' },
        { operation: 'diameter by calipers', average: 'Θ(h)', worst: 'against Θ(n²) for the pairwise reference' },
        { operation: 'minimum-area rectangle', average: 'Θ(h) — one candidate angle per hull edge', worst: '9 angles here; hull sizes across the fixtures run 5 to 80' },
        { operation: 'width', average: 'Θ(h), a different minimum from the rectangle\'s short side', worst: 'attained at a different angle, and computing it from the rectangle is a quiet mistake' },
        { operation: 'Welzl\'s smallest circle', average: 'Θ(n) expected on a shuffled order', worst: 'degrades on adversarial order — the shuffle is part of the algorithm' },
        { operation: 'rotation sweep reference', average: 'Θ(3 600 · h)', worst: 'a step of 0.0250°, so it usually misses the optimum by a fraction of a step' }
      ],
      failureModes: [
        {
          symptom: 'A bounding box is far larger than the shape it bounds.',
          cause: 'The box is axis-aligned and the data has a grain the axes do not share.',
          fix: 'Use the minimum-area rectangle: 10.79× less enclosed area on the diagonal fixture.'
        },
        {
          symptom: 'A diameter is right on random data and slightly too small on some inputs.',
          cause: 'The antipodal walk skipped a pair, usually at a collinear hull edge.',
          fix: 'Compare against an all-pairs scan with equality, not with a tolerance.'
        },
        {
          symptom: 'The minimum-rectangle test fails intermittently against a rotation sweep.',
          cause: 'The assertion is two-sided, and the sweep\'s 0.0250° step misses the optimum.',
          fix: 'Assert only that the scan is no worse; a better answer is the sweep\'s discretisation.'
        },
        {
          symptom: 'Welzl\'s algorithm is quadratic on real data.',
          cause: 'The input order was not randomised, so every point forces a rebuild.',
          fix: 'Shuffle before inserting; the expected-linear bound depends on it.'
        }
      ],
      inTheWild: [
        { system: 'OpenCV', how: 'minAreaRect and minEnclosingCircle are these two algorithms, used for every oriented bounding box' },
        { system: 'Physics and game engines', how: 'oriented bounding boxes and bounding spheres as broad-phase proxies' },
        { system: 'Packing and nesting software', how: 'minimum-area rectangles decide how parts are laid out on stock material' },
        { system: 'Point-cloud and LiDAR pipelines', how: 'oriented boxes around detected objects, where axis-aligned boxes are badly wrong' }
      ],
      sources: [
        { title: 'Solution to problem 75-12: the minimum area rectangle enclosing a convex polygon', where: 'Godfried Toussaint — SIAM Review, 1983' },
        { title: 'Solving geometric problems with the rotating calipers', where: 'Godfried Toussaint — IEEE MELECON, 1983' },
        { title: 'Smallest enclosing disks (balls and ellipsoids)', where: 'Emo Welzl — New Results and New Trends in Computer Science, 1991' },
        { title: 'Computational Geometry in C', where: 'Joseph O\'Rourke — 2nd edition, 1998' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
