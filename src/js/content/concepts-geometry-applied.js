/** Concepts for transforms, 3-D geometry and applied geometry (M16.9-M16.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'transforms-and-3d': [
      {
        term: 'Homogeneous coordinates exist so that translation is a matrix',
        plain: 'Add a fourth coordinate fixed at one, and moving a point becomes multiplication like everything else.',
        formal: 'a 4×4 matrix composes rotation, scale, shear, translation and projection uniformly',
        detail: 'A rotation or a scale is linear and fits in a 3×3 matrix; a translation is not, ' +
          'because it moves the origin. Carrying an extra coordinate makes the translation part of ' +
          'the same object, which is what lets a whole pipeline collapse into one matrix multiplied ' +
          'once per vertex rather than a sequence of special-cased steps. The fourth coordinate also ' +
          'carries perspective: dividing by it at the end is what makes distant things smaller, and ' +
          'that division is the only non-linear step in the pipeline.',
        example: 'The two compositions in this section differ in their translation column — 28.28 ' +
          'against 40.00 — and in nothing else.'
      },
      {
        term: 'Composition order is not commutative, and both orders are correct',
        plain: 'Rotate then translate is a different transform from translate then rotate, and neither is a bug.',
        formal: 'matrix multiplication does not commute: A·B and B·A are different transforms',
        detail: 'This is the most common source of "the rotation is wrong" in graphics, and it is ' +
          'never a maths error — it is two pieces of code disagreeing about the order, or about ' +
          'whether vectors are rows or columns, which reverses the reading of a product. The tell is ' +
          'where the origin lands: a pure rotation fixes the origin, so if the scene is rotating ' +
          'about the wrong point the translation was applied first. No amount of adjusting the angle ' +
          'fixes that.',
        example: 'The same two operations applied in opposite orders send (1, 0, 0) to (29.0, 29.0) ' +
          'and to (40.7, 0.7) — 30.61 apart.'
      },
      {
        term: 'Four conventions travel with every matrix, and none of them are in the type',
        plain: 'Row or column vectors, pre- or post-multiply, radians or degrees, and which order the Euler axes apply.',
        formal: 'two libraries disagreeing on any one of them compose correctly and produce garbage',
        detail: 'A 4×4 array of numbers carries no answer to any of these questions, so the ' +
          'compiler cannot help and the runtime will not complain. The cheapest fix in graphics is a ' +
          'comment at the top of the file stating all four, and the second cheapest is a unit test ' +
          'that transforms one known point and checks where it lands. Both cost minutes; the bug ' +
          'they prevent costs days, because everything looks nearly right.',
        example: 'The two matrices here differ in exactly one thing — the order — and produce ' +
          'outlines that look equally plausible.'
      },
      {
        term: 'Gimbal lock is a slow drain, not a cliff at ninety degrees',
        plain: 'Rotational freedom bleeds away all the way to the pole; half of it is gone by 45 degrees.',
        formal: 'at pitch 90° two of the three Euler axes coincide and one degree of freedom no longer exists',
        readAs: 'When the middle rotation reaches a right angle, the first and third axes end up ' +
          'pointing the same way, so turning one of them is indistinguishable from turning the ' +
          'other and the pair can no longer produce every orientation.',
        detail: 'The measurement makes this concrete: nudge yaw by a hundredth of a radian, then ' +
          'separately nudge roll by the same amount the other way, and see how far apart the two ' +
          'results sit. Away from the pole they are different rotations about different axes and the ' +
          'gap is large; at ninety degrees they are the same rotation and the gap is zero. It is why ' +
          'a camera controller starts feeling sluggish and imprecise long before anything visibly ' +
          'locks, and why "it only breaks at exactly 90" is the wrong mental model.',
        example: 'Freedom lost runs 0.00%, 13.91%, 29.29%, 45.88%, 63.40%, 81.54% at pitches of 0, ' +
          '15, 30, 45, 60 and 75 degrees.'
      },
      {
        term: 'The baseline for that measurement is the gap at pitch zero, not twice the nudge',
        plain: 'Two nudges about perpendicular axes differ by the nudge times the square root of two.',
        formal: 'the reference gap is 0.8103°, and every later gap is read against it',
        detail: 'This is the kind of detail that decides whether a measurement means anything. ' +
          'Reaching for "twice the nudge" as the baseline is the obvious move and it is wrong by a ' +
          'factor of √2, which would make every percentage in the table too small and the curve the ' +
          'wrong shape. Measuring the baseline instead of deriving it removes the question, and it ' +
          'is the same discipline as measuring the escalation rate rather than assuming it in the ' +
          'primitives section.',
        example: 'A nudge of 0.01 radians about two perpendicular axes leaves the results 0.8103° ' +
          'apart at pitch zero, and 0.0000° apart at ninety.'
      },
      {
        term: 'Quaternions avoid the problem by never having three separate axes',
        plain: 'One rotation about one axis, stored as four numbers, with no order to get wrong.',
        formal: 'slerp interpolates along the shortest arc at constant angular speed',
        detail: 'Euler angles are three sequential rotations, and the sequence is what creates both ' +
          'the ordering convention and the lock. A quaternion represents the whole orientation at ' +
          'once, so interpolating between two of them follows the shortest path on the sphere of ' +
          'orientations at a constant rate — which is what makes animated camera moves and skeletal ' +
          'blending look right. The costs are real: they are hard to read in a debugger, the double ' +
          'cover means q and −q are the same orientation, and slerp needs a sign check or it takes ' +
          'the long way round.',
        example: 'The gimbal measurement is done with Euler angles precisely because a quaternion ' +
          'would show no drain at all.'
      },
      {
        term: 'Möller-Trumbore intersects a ray and a triangle without building the plane',
        plain: 'It solves for the barycentric coordinates directly, so the containment test comes free.',
        formal: 'the same computation yields the distance along the ray and the coordinates u and v within the triangle',
        readAs: 'Rather than finding where the ray meets the triangle\'s plane and then asking ' +
          'whether that point is inside the triangle, the method solves one small system whose ' +
          'answers are the distance and the two numbers that say where in the triangle the hit is.',
        detail: 'Those coordinates are not a by-product to be discarded — they are what a renderer ' +
          'interpolates the normal, the texture coordinate and the colour with, so getting them from ' +
          'the intersection instead of recomputing them is most of the reason the method is ' +
          'standard. The degenerate case is a ray parallel to the triangle, which shows up as a ' +
          'determinant at zero and must be rejected rather than divided by.',
        example: '20 000 random rays produced 715 hits, 0 parallel cases and 0 barycentric ' +
          'round-trip errors.'
      },
      {
        term: 'A reference that shares algebra with the routine is not a reference',
        plain: 'Check the ray-triangle test against a plane intersection plus three edge cross products.',
        formal: 'agreement between two implementations with no shared derivation is evidence; self-agreement is not',
        detail: 'The plane-and-edges method has a completely different structure: it finds the ' +
          'plane, intersects the ray with it, and then tests the point against three cross products. ' +
          'If both agree on twenty thousand rays including the hits, the misses and the ' +
          'near-tangential cases, that means something. The barycentric round-trip is the second ' +
          'half of the check and it is nearly free: rebuild the hit point from u and v and confirm ' +
          'it lands where the routine said it did.',
        example: '0 disagreements across 20 000 rays, 715 hits and 19 285 misses.'
      }
    ],

    'applied-geometry': [
      {
        term: 'Bresenham and rounding draw the same line and disagree about which pixel',
        plain: 'Same endpoints, same pixel count, and a different choice wherever the ideal path runs between two pixels.',
        formal: 'they differ only in how a tie is broken, and one breaks it consistently',
        detail: 'Bresenham carries an integer error term and breaks every tie the same way; ' +
          'rounding a floating-point midpoint breaks it however the arithmetic happened to land. ' +
          'Neither is more correct in isolation, and a renderer that uses one for outlines and the ' +
          'other for fills draws them a pixel apart along every shared edge — which shows up as a ' +
          'hairline seam between adjacent shapes that no amount of adjusting the geometry fixes.',
        example: 'Over 3 000 lines the two agree exactly on 2 492 of them (83.1%) and always agree ' +
          'on the endpoints and the pixel count.'
      },
      {
        term: 'Anti-aliasing is coverage, and coverage must be unbiased',
        plain: 'Shade each pixel by the fraction of it that falls inside the shape, and the fractions must sum to the area.',
        formal: 'the summed coverage equals the polygon\'s area, or the filter is adding or removing ink',
        detail: 'This is the check that separates a real coverage computation from a plausible ' +
          'blur. A filter that is biased makes thin shapes systematically too light or too heavy, ' +
          'and the error compounds across a scene — text renders thin, hairlines disappear at some ' +
          'zoom levels and reappear at others. Summing the coverages and comparing with the shoelace ' +
          'area is one line and catches it immediately.',
        example: 'Coverages sum to 377.63 against a true area of 377.50, with 67 of 411 touched ' +
          'pixels only partly covered.'
      },
      {
        term: 'Curve flattening costs far less precision-per-segment than it looks',
        plain: 'Tightening the tolerance by 256 times multiplies the segment count by only about 14.',
        formal: 'the segment count grows roughly with the square root of the tolerance ratio',
        detail: 'The relationship follows from a curve\'s local flatness: halving the allowed ' +
          'deviation only requires subdividing until the chord is about √2 shorter, not twice ' +
          'shorter. That makes a defensively tight tolerance much cheaper than the intuition ' +
          'suggests, which is worth knowing when the alternative is visible faceting on a large ' +
          'shape. The measured error is also always comfortably inside the bound, because ' +
          'subdivision stops when the flatness test passes rather than when the error exactly meets ' +
          'the tolerance.',
        example: 'Tolerance 4 gives 8 segments and 1/256 of it gives 110 — 13.8× the segments for ' +
          '256× the precision.'
      },
      {
        term: 'The separating axis theorem collapses infinitely many candidate lines to a handful',
        plain: 'Two convex shapes miss exactly when some line exists that they project onto without overlapping.',
        formal: 'only the edge normals of the two shapes can be separating, so the test is finite',
        detail: 'That collapse is the same move as rotating calipers: a continuous search becomes a ' +
          'scan over a combinatorial set, and the theorem is what licenses ignoring everything else. ' +
          'It also gives the test a natural early exit — the moment an axis separates the shapes the ' +
          'answer is "no overlap" and nothing further runs — so a clear miss is cheaper than a hit. ' +
          'The theorem is only true for convex shapes, which is why engines decompose concave ones ' +
          'rather than generalising the test.',
        example: 'An overlapping pair tests all 9 axes; a clearly separated pair exits after 2.'
      },
      {
        term: 'The minimum translation vector is the axis of smallest overlap, not the line between the centroids',
        plain: 'Push along the separating axis that was hardest to find, by exactly the overlap on it.',
        formal: 'the shortest push out of contact is the minimum overlap over the candidate axes',
        detail: 'Taking the direction from one centroid to the other is intuitive, cheap and right ' +
          'most of the time, which is what makes it a bad bug: it fails on the shapes where it ' +
          'matters, the long thin ones in shallow contact, and the failure is a body that jitters or ' +
          'sinks through a surface rather than one that visibly teleports. The sign of the push has ' +
          'to come from the projections on the chosen axis too, not from the centroids, or the ' +
          'vector separates them in the wrong direction.',
        example: 'An earlier version of this section took the push direction from the two centroids, ' +
          'and it was wrong for 38 of 800 overlapping pairs.'
      },
      {
        term: 'A collision test is checkable: apply the push and ask again',
        plain: 'The one thing a minimum translation vector must never be is a push that does not separate.',
        formal: 'move one shape by the vector, re-run the test, and require no overlap',
        detail: 'It costs a second run of a test that is already cheap, and it converts a subtle ' +
          'geometric claim into a property that either holds or does not. Pair it with a sampling ' +
          'oracle for the overlap verdict itself — scatter points and check whether any lies in both ' +
          'shapes — and the whole routine is pinned down by two checks that share no algebra with ' +
          'it. This is the same pattern as the hull oracle and the nearest-site grid.',
        example: 'At three separations the shapes overlap by 8.243, 5.315 and 2.386, and applying ' +
          'the push separates them in every case.'
      },
      {
        term: 'A pixel grid is a sampling of a continuous shape, and the sample decides the answer',
        plain: 'Whether a pixel is "in" depends on where you test it, and the convention has to be stated.',
        formal: 'sampling at the pixel centre is a choice; sampling at the corner gives a shape shifted by half a pixel',
        detail: 'Every rasteriser answers this, usually implicitly, and mismatched conventions ' +
          'between two parts of a system produce a half-pixel offset that people spend days chasing. ' +
          'The fill rule matters here too — the same top-left rule that decides which of two adjacent ' +
          'triangles owns their shared edge exists so that a shared edge is drawn once rather than ' +
          'twice or not at all, which is the rasterisation form of the boundary problem from the ' +
          'containment section.',
        example: '378 pixels are filled for a polygon whose true area is 377.50, and 411 pixels are ' +
          'touched at all.'
      },
      {
        term: 'Treating latitude and longitude as planar is the most common geometry bug in application code',
        plain: 'A degree of longitude is 111 km at the equator and 56 km at 60 degrees north.',
        formal: 'the distortion grows with the cosine of the latitude, so it is invisible at the equator',
        detail: 'The bug survives testing because tests are usually written with coordinates near ' +
          'where the developer is, or near zero, and it is a correctness bug rather than a precision ' +
          'one: a radius search returns the wrong places, a nearest-facility lookup picks the wrong ' +
          'facility, and a bounding box excludes real results. The fixes are ordinary — project to a ' +
          'local planar system, use a geodesic distance, or scale longitude by the cosine of the ' +
          'latitude — and the hard part is noticing the problem exists.',
        example: 'Every planar formula in this milestone is correct on a projected coordinate system ' +
          'and wrong on raw degrees, by a factor that reaches two at 60° north.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
