/** Concepts for boolean operations and rotating calipers (M16.7-M16.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'polygon-clipping': [
      {
        term: 'Sutherland-Hodgman clips against half-planes, and a concave clip is not one',
        plain: 'It cuts the subject with each clip edge extended to an infinite line, one after another.',
        formal: 'correct exactly when the clip region equals the intersection of its edges\' half-planes',
        detail: 'For a convex clip that identity holds by definition, which is why the algorithm is ' +
          'so short and why it is still the right choice for a viewport or a frustum. A concave clip ' +
          'is a different set: the half-plane of a notch\'s edge cuts away parts of the subject that ' +
          'are genuinely inside the clip region, and the intersection of all the half-planes collapses ' +
          'to something strictly smaller than the region — sometimes to nothing at all. Nothing in ' +
          'the algorithm detects this; it returns a polygon and the polygon is wrong.',
        example: 'Against the notch clip it returns no polygon at all — 0 vertices and an area of ' +
          '0.0 where the answer is 2 800.0.'
      },
      {
        term: 'The failure has two shapes, and the silent one is the common one',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["clip against a concave region"] --> B["the algorithm cuts against<br/>each edge as an infinite line"]',
            '    B --> C["loud failure: the result<br/>collapses to nothing"]',
            '    B --> D["quiet failure: a plausible polygon,<br/>a third of the right size"]',
            '    D --> E["and nothing in the output<br/>says which one you got"]'
          ].join('\n'),
          caption: 'An empty result gets noticed in testing. A polygon that is merely too small looks like a polygon, which is why the concavity precondition has to be checked rather than hoped for.'
        },
        plain: 'Either the result collapses to nothing, or it comes back plausible and two-thirds too small.',
        formal: 'of 5 concave clips, 2 return an empty polygon and 3 return a wrong area',
        detail: 'An empty result is at least obvious: something downstream renders nothing and ' +
          'someone investigates. A polygon with the right shape, the right winding and the wrong ' +
          'area passes every eyeball test and every schema validation, and the error only surfaces ' +
          'when a number computed from it — a coverage percentage, a billed area, a collision volume ' +
          '— is quietly too small. That is why the check for this algorithm has to be an area ' +
          'comparison against an independent reference rather than a look at the picture.',
        example: 'The L-shaped and chevron clips both return a 4- or 5-vertex polygon with 66.7% and ' +
          '66.8% of the area missing.'
      },
      {
        term: 'Decomposing the clip into convex pieces is the cheap correct fix',
        plain: 'Split the concave clip into convex parts, clip against each, and take the union of the results.',
        formal: 'correctness follows from the half-plane identity holding on every piece',
        detail: 'It reuses the algorithm you already have rather than replacing it with Greiner-' +
          'Hormann or Vatti, and its cost is one Sutherland-Hodgman pass per piece plus a union at ' +
          'the end. For a clip that changes rarely — a country boundary, a level geometry, a print ' +
          'bleed — the decomposition is computed once and amortised over every clip against it. The ' +
          'catch is that the pieces\' results must be unioned rather than concatenated: they share ' +
          'edges, and a renderer using the non-zero rule will not care while an area sum very much ' +
          'will.',
        example: '6 convex pieces clipped separately give 2 800.0, matching the sampled reference ' +
          'exactly.'
      },
      {
        term: 'A rasterised oracle answers every boolean operation with no case analysis',
        plain: 'Sample the plane on a grid, test each cell against both polygons, and count.',
        formal: 'its error is one cell along the boundary, so the resolution is the floor of what a difference can mean',
        detail: 'This is the reason it is a good reference and a bad algorithm: no traversal, no ' +
          'entry-exit classification, no degeneracy handling, and it computes union, intersection, ' +
          'difference and exclusive-or with the same three lines. Its accuracy is bounded by the ' +
          'cell size rather than by the algorithm, so a disagreement smaller than a cell means ' +
          'nothing at all, and a disagreement of 60% means the clipper is broken. Quoting the ' +
          'resolution alongside the number is what keeps that distinction honest.',
        example: '160 000 sample cells, each 0.0625 in area, put the convex rows at 0.3% error or ' +
          'below — which is the sampler\'s error, not the clipper\'s.'
      },
      {
        term: 'Union plus intersection equals the sum of the two areas, always',
        plain: 'A free consistency check on any clipper, needing no reference implementation at all.',
        formal: 'area(A ∪ B) + area(A ∩ B) = area(A) + area(B)',
        readAs: 'The area covered by either shape, plus the area covered by both, always equals the ' +
          'two shapes\' areas added together — because the overlap is counted twice on the right and ' +
          'once in each term on the left.',
        detail: 'It is inclusion-exclusion on two sets, and it holds whatever the shapes are: ' +
          'concave, self-touching, disjoint. That makes it the cheapest possible regression test for ' +
          'a boolean library, because it needs no ground truth — you compute two of your own outputs ' +
          'and check an identity. Pair it with the exclusive-or, which must equal the union minus the ' +
          'intersection, and a surprising number of traversal bugs fail one of the two immediately.',
        example: 'Union 9 600.0 and intersection 2 800.0 sum to 12 400.0, and the exclusive-or of ' +
          '6 800.0 is exactly their difference.'
      },
      {
        term: 'Shared edges and coincident vertices are the whole difficulty in boolean geometry',
        plain: 'Two polygons that touch along an edge have no clean entry or exit point there.',
        formal: 'the entry/exit classification is undefined where the boundaries coincide rather than cross',
        detail: 'Greiner-Hormann, Weiler-Atherton and Vatti all walk the two boundaries alternately, ' +
          'switching at intersection vertices classified as entering or leaving the other polygon. A ' +
          'shared edge is neither, and a vertex lying exactly on the other boundary is both, so ' +
          'every robust implementation either perturbs the input or snaps the coordinates to a grid ' +
          'first. That snap is presented as preprocessing and is really a correctness decision: it ' +
          'changes the input to one the algorithm can handle.',
        example: 'The band clip is convex and touches the subject along two edges; it lands at 0.3% ' +
          'against the sampler, entirely within the sampler\'s own resolution.'
      },
      {
        term: 'Offsetting a polygon is its Minkowski sum with a disc, and the disc is always a polygon',
        plain: 'Buffering by a radius means sweeping a disc around the boundary, and the disc is approximated by corners.',
        formal: 'the shortfall falls with the square of the corner count',
        detail: 'Every buffering library exposes the corner count — quad segments, arc tolerance, ' +
          'circle steps — and almost nobody sets it, so the default silently decides how much area ' +
          'the buffered geometry loses. The approximating polygon is inscribed, so the result is ' +
          'always too small rather than too large, and the error compounds when buffers are chained. ' +
          'For a geofence or a safety margin that bias is in the wrong direction, and the fix is one ' +
          'parameter rather than a different algorithm.',
        example: 'At 3 corners the offset area is 2 717.4 against a true 3 081.1 — 11.80% short; at ' +
          '16 corners it is 0.17% and at 64 corners 0.01%.'
      },
      {
        term: 'Minkowski sums turn motion planning into a containment test',
        plain: 'Grow the obstacles by the shape of the robot, and the robot becomes a point.',
        formal: 'the configuration-space obstacle is the obstacle summed with the reflected robot',
        detail: 'This is the reason the operation matters beyond buffering. Once every obstacle has ' +
          'been grown by the moving shape, a collision-free path for the shape is exactly a path for ' +
          'a single point through the free space, and the whole problem becomes a graph search over ' +
          'a region rather than a continuous geometric one. The same construction is what a CNC tool ' +
          'path, a printed-circuit clearance rule and a collision margin in a game engine all ' +
          'compute, usually without naming it.',
        example: 'The same code that offsets a polygon by a 16-corner disc computes the ' +
          'configuration-space obstacle for a 16-sided robot.'
      }
    ],

    'rotating-calipers': [
      {
        term: 'The minimum-area rectangle has a side flush with a hull edge',
        plain: 'So there are only h candidate angles, one per hull edge, and every other angle is provably worse.',
        formal: 'a continuous optimisation collapses to an O(h) scan',
        detail: 'The proof is a rotation argument. Suppose the minimum rectangle touched the hull ' +
          'only at isolated vertices; then it can be rotated slightly either way without losing ' +
          'contact, and one of those two rotations makes the area smaller — so it was not the ' +
          'minimum. The only rectangles that cannot be improved that way are the ones already flush ' +
          'with an edge. That single theorem is what makes the scan complete rather than a sample, ' +
          'and it is the same collapse from infinite to finite that the separating-axis test uses.',
        example: '9 hull edges give 9 candidate angles, and the winner at −135.09° has an area of ' +
          '932.6 against 933.8 for the next best.'
      },
      {
        term: 'What the rotation buys depends entirely on whether the data has a grain',
        plain: 'On diagonally arranged points the minimum rectangle is a tenth of the axis-aligned box; on a grid it is the same box.',
        formal: 'the ratio ranges from 0.093 to 1.000 across the six fixture sets',
        detail: 'The axis-aligned bounding box is the default everywhere — in spatial indexes, ' +
          'collision broad phases, layout and image cropping — because it is free to compute and ' +
          'free to test. It is also arbitrarily bad when the data is not aligned with the axes, and ' +
          'the fixture sets make that concrete: a diagonal cloud gives a 10.79× reduction in ' +
          'enclosed area from the same points with no approximation at all, while a grid gives ' +
          'exactly nothing. The technique pays precisely when the data has a direction the axes do ' +
          'not share.',
        example: 'The diagonal set: 932.6 against an axis-aligned 10 058.0 — a ratio of 0.093 at a ' +
          'best angle of −135.1°.'
      },
      {
        term: 'The diameter is a pair of antipodal points, and there are only h of those',
        plain: 'The furthest two points of a set are both on the hull, and the calipers walk the pairs in one rotation.',
        formal: 'the diameter must agree exactly with a brute-force scan over all pairs, not approximately',
        detail: 'Both endpoints being on the hull is easy to see — moving either one outward along ' +
          'its direction increases the distance — and it is what reduces an O(n²) search to a walk ' +
          'over the hull. The calipers rotate two parallel supporting lines together, and the pairs ' +
          'of points they touch at each step are the antipodal pairs; the diameter is the largest ' +
          'distance among them. Because this is an exact combinatorial answer rather than an ' +
          'optimisation, the test for it is equality rather than tolerance.',
        example: 'The diameter is 141.487 by calipers and 141.487 by the O(n²) scan over every pair ' +
          '— exact agreement.'
      },
      {
        term: 'The rotation sweep is the reference, and being better than it is expected',
        plain: 'A fine sweep over angles is approximate by construction; the exact scan may beat it and must never lose to it.',
        formal: 'the sweep\'s step is 0.0250°, so a gap smaller than that means it never tried the winning angle',
        detail: 'Checking an exact method against a discretised one needs the asymmetry stated ' +
          'explicitly, or the test is meaningless. The scan tries h angles and is provably complete; ' +
          'the sweep tries 3 600 evenly spaced ones and will usually miss the optimum by a fraction ' +
          'of its step. So the assertion is one-sided: the scan must never be worse than the sweep, ' +
          'and when it is slightly better that is the sweep\'s discretisation showing, not a bug in ' +
          'the scan.',
        example: 'Calipers 932.559 against the 3 600-angle sweep\'s 932.779 — the scan is better by ' +
          '0.024%, which is the sweep missing the optimum.'
      },
      {
        term: 'The smallest enclosing circle is determined by two or three points, never more',
        plain: 'Welzl\'s algorithm exploits that: pick points at random and rebuild only when one falls outside.',
        formal: 'expected linear time, from a randomised incremental construction with a constant-size basis',
        detail: 'The basis being at most three is what makes the recursion bounded: a circle through ' +
          'three points is determined, so once three boundary points are fixed there is nothing left ' +
          'to search. Randomising the insertion order is what makes the expected cost linear — the ' +
          'probability that the i-th point falls outside the circle of the first i − 1 is at most ' +
          '3/i, so the rebuilds telescope. On adversarial order it degrades, which is why the ' +
          'shuffle is part of the algorithm rather than a nicety.',
        example: 'The default set\'s circle has a radius of 70.74 with 2 points on it, found after ' +
          '2 594 rebuild steps.'
      },
      {
        term: 'Calipers only work on a convex ring, so the hull is a precondition rather than a step',
        plain: 'Everything in this section takes h, the hull size, as its cost — not n.',
        formal: 'O(n log n) to hull, then O(h) for diameter, width and the rectangle scan',
        detail: 'That split is why the hull section comes first, and it changes how the cost should ' +
          'be quoted: a million points with a twelve-vertex hull cost a sort and then almost ' +
          'nothing. It also means the hull\'s collinear policy leaks in here — a hull that keeps ' +
          'points lying on its edges produces duplicate candidate angles, which is harmless for the ' +
          'answer and inflates h, while a hull with a reflex vertex from a broken predicate makes ' +
          'the caliper walk skip antipodal pairs entirely.',
        example: 'Hull sizes across the fixture sets run from 5 on a grid to 80 on a circle, and ' +
          'each one is the number of candidate angles tried.'
      },
      {
        term: 'Width is the other caliper measurement, and it is not the rectangle\'s short side',
        plain: 'The width is the smallest distance between two parallel supporting lines.',
        formal: 'the minimum over hull edges of the furthest vertex\'s distance from that edge',
        detail: 'It answers a different question from the minimum-area rectangle and can be attained ' +
          'at a different angle: the rectangle trades width against height to minimise a product, ' +
          'while the width minimises one dimension outright. It is the measurement that matters for ' +
          '"will this shape fit through that gap", for the thickness of a milled part and for the ' +
          'tightest slab in a collision test — and computing it from the minimum-area rectangle is a ' +
          'common and quiet mistake.',
        example: 'The winning rectangle at −135.09° is 141.47 by 6.59, and the next candidate at ' +
          '44.84° is 141.47 by 6.60 — nearly the same shape at a very different angle.'
      },
      {
        term: 'Every result here is checkable against a slow method, so check it',
        plain: 'All pairs for the diameter, a fine angle sweep for the rectangle, every point for the circle.',
        formal: 'three references, two exact and one discretised, and the discretised one is one-sided',
        detail: 'Calipers code is short and subtle: an off-by-one in the antipodal walk gives an ' +
          'answer that is right on most inputs and quietly too small on some, which is exactly the ' +
          'failure the milestone keeps meeting. The references cost O(n²), O(3 600 n) and O(n), all ' +
          'affordable at test sizes, and between them they pin down every number the section quotes. ' +
          'Verifying that the enclosing circle covers every point is the cheapest of the three and ' +
          'catches the most.',
        example: 'Diameter exact, enclosing circle covering every point exactly, and the rectangle ' +
          'within 0.024% of a 3 600-angle sweep.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
