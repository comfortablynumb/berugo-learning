/** Reference entries for transforms, 3-D geometry and applied geometry (M16.9-M16.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'transforms-and-3d': {
      summary: 'Homogeneous coordinates so that translation is a matrix, four conventions that ' +
        'travel with every matrix and appear in none of them, gimbal lock measured as a number, ' +
        'and a ray test checked against different algebra.',
      intuition: 'Nearly every "the rotation is wrong" bug is a composition-order or convention ' +
        'mismatch, and the tell is where the origin lands.',
      formulation: {
        equations: [
          {
            label: 'Composition order',
            expr: 'A·B and B·A are different transforms, and both are correct',
            terms: [
              { sym: 'the rotation part', meaning: 'identical in both — 0.71 −0.71 0.00 and 0.71 0.71 0.00' },
              { sym: 'the translation column', meaning: '28.28, 28.28 for one order against 40.00, 0.00 for the other' },
              { sym: 'the tell', meaning: 'the origin lands at (28.3, 28.3) or at (40.0, 0.0) — a pure rotation fixes it' },
              { sym: 'measured', meaning: '(1, 0, 0) lands 30.61 apart under the two orders' }
            ]
          },
          {
            label: 'The four conventions',
            expr: 'row or column vectors, pre- or post-multiply, radians or degrees, Euler axis order',
            terms: [
              { sym: 'what carries them', meaning: 'nothing: a 4×4 array of numbers answers none of the four' },
              { sym: 'the cheapest fix', meaning: 'a comment at the top of the file, and a test that transforms one known point' },
              { sym: 'the symptom', meaning: 'everything looks nearly right, which is what makes it expensive' }
            ]
          },
          {
            label: 'Gimbal lock, measured',
            expr: 'nudge yaw and roll separately and see how far apart the results sit',
            terms: [
              { sym: 'the baseline', meaning: '0.8103° at pitch zero — measured, not derived, because two perpendicular nudges differ by the nudge times √2' },
              { sym: 'the drain', meaning: '13.91% lost at 15°, 29.29% at 30°, 45.88% at 45°, 63.40% at 60°, 81.54% at 75°' },
              { sym: 'the pole', meaning: '100.00% at 90°, where the gap is 0.0000° and the two axes have merged' },
              { sym: 'the wrong mental model', meaning: '"it only breaks at exactly 90" — half the freedom is gone by 45' }
            ]
          },
          {
            label: 'Möller-Trumbore',
            expr: 'solve for the distance and the barycentric coordinates in one system',
            terms: [
              { sym: 'why it matters', meaning: 'u and v are what a renderer interpolates normals, colours and texture coordinates with' },
              { sym: 'the degenerate case', meaning: 'a ray parallel to the triangle appears as a zero determinant and must be rejected' },
              { sym: 'measured', meaning: '20 000 rays, 715 hits, 19 285 misses, 0 parallel, 0 disagreements with an independent reference' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A pure rotation fixes the origin',
          why: 'It is the fastest way to tell which order a composition used.',
          breaks: 'A scene rotating about the wrong point has translated first, and the angle is not the problem.'
        },
        {
          name: 'The conventions are written down where the matrices are built',
          why: 'The type carries none of them and the runtime will not complain.',
          breaks: 'Two libraries disagreeing on any one compose correctly and produce garbage.'
        },
        {
          name: 'The gimbal baseline is measured rather than assumed',
          why: 'Two nudges about perpendicular axes differ by the nudge times √2, not by twice it.',
          breaks: 'Assuming twice the nudge makes every percentage too small and the curve the wrong shape.'
        },
        {
          name: 'The ray-triangle reference shares no algebra with the routine',
          why: 'Agreement between one routine and itself is worth nothing.',
          breaks: 'A shared sign error passes both implementations on every ray.'
        }
      ],
      complexity: [
        { operation: 'composing transforms', average: 'Θ(1) per matrix product — 4×4', worst: 'collapsing the pipeline to one matrix is why it is done up front' },
        { operation: 'transforming a point', average: 'Θ(1), one matrix-vector product', worst: 'plus the perspective divide, the only non-linear step' },
        { operation: 'Euler angles', average: 'three numbers, and an order to get wrong', worst: 'freedom lost 45.88% at pitch 45° and 100.00% at 90°' },
        { operation: 'quaternion slerp', average: 'Θ(1), shortest arc at constant angular speed', worst: 'needs a sign check for the double cover, or it takes the long way round' },
        { operation: 'Möller-Trumbore', average: 'Θ(1) per ray-triangle pair', worst: '715 hits from 20 000 rays here, with 0 parallel cases' },
        { operation: 'the plane-and-edges reference', average: 'Θ(1) too, and a different structure', worst: 'slower in practice, and it recomputes the barycentric coordinates separately' }
      ],
      failureModes: [
        {
          symptom: 'A model rotates about the wrong point.',
          cause: 'The translation was applied before the rotation.',
          fix: 'Push the origin through the matrix; a pure rotation leaves it where it was.'
        },
        {
          symptom: 'Transforms are right in one library and mirrored or transposed in another.',
          cause: 'Row-vector against column-vector convention, which reverses the reading of a product.',
          fix: 'State all four conventions in a comment and pin them with a one-point test.'
        },
        {
          symptom: 'A camera feels sluggish and imprecise well before it locks.',
          cause: 'Euler angles losing rotational freedom on the approach to the pole.',
          fix: 'Store orientation as a quaternion; the drain is a property of three sequential axes.'
        },
        {
          symptom: 'A ray tracer returns hits with garbage texture coordinates.',
          cause: 'The barycentric coordinates were recomputed rather than taken from the intersection.',
          fix: 'Use the ones Möller-Trumbore already produced, and round-trip the hit point to check them.'
        }
      ],
      inTheWild: [
        { system: 'Every GPU pipeline', how: 'model, view, projection and viewport as four matrices collapsed into one' },
        { system: 'Game engines and animation', how: 'quaternions for orientation and slerp for blending, Euler angles only in the editor UI' },
        { system: 'Ray tracers and path tracers', how: 'Möller-Trumbore in the innermost loop, with its barycentric coordinates reused downstream' },
        { system: 'Robotics and aerospace', how: 'gimbal lock as a physical failure mode, not only a numerical one' }
      ],
      sources: [
        { title: 'Fast, Minimum Storage Ray/Triangle Intersection', where: 'Möller, Trumbore — Journal of Graphics Tools, 1997' },
        { title: 'Real-Time Rendering', where: 'Akenine-Möller, Haines, Hoffman — 4th edition, 2018' },
        { title: 'Animating rotation with quaternion curves', where: 'Ken Shoemake — SIGGRAPH, 1985' },
        { title: 'Geometric Tools for Computer Graphics', where: 'Schneider, Eberly, 2002' }
      ]
    },

    'applied-geometry': {
      summary: 'Where continuous geometry meets a pixel grid: two line algorithms that differ only ' +
        'in a tie-break, coverage that has to balance, flattening that is cheaper than it looks, ' +
        'and a collision push that must actually push.',
      intuition: 'Every result here is checkable — sum the coverage, apply the translation vector ' +
        'and ask again — and the checks are what separate a plausible rasteriser from a correct one.',
      formulation: {
        equations: [
          {
            label: 'Bresenham against rounding',
            expr: 'the same line, and a different pixel wherever the ideal path runs between two',
            terms: [
              { sym: 'measured', meaning: '3 000 lines, 2 492 identical pixel sets — 83.1% — and 508 differing' },
              { sym: 'what never differs', meaning: 'the endpoints and the pixel count, on every line' },
              { sym: 'the consequence', meaning: 'one for outlines and the other for fills draws them a pixel apart along every shared edge' }
            ]
          },
          {
            label: 'Coverage, and whether the filter is unbiased',
            expr: 'the summed per-pixel coverage must equal the shape\'s area',
            terms: [
              { sym: 'measured', meaning: 'coverages sum to 377.63 against a true area of 377.50' },
              { sym: 'the pixels that matter', meaning: '67 of 411 touched pixels are only partly covered — the ones anti-aliasing exists for' },
              { sym: 'a biased filter', meaning: 'makes thin shapes systematically too light or too heavy, and it compounds across a scene' }
            ]
          },
          {
            label: 'Curve flattening',
            expr: 'the segment count grows roughly with the square root of the tolerance ratio',
            terms: [
              { sym: 'measured', meaning: '8, 14, 28, 56 and 110 segments at tolerances 4, 1, 0.25, 0.0625 and 0.015625' },
              { sym: 'the ratio', meaning: '256× the precision for 13.8× the segments' },
              { sym: 'the measured error', meaning: 'always comfortably inside the bound, because subdivision stops when the flatness test passes' }
            ]
          },
          {
            label: 'The separating axis test',
            expr: 'only the two shapes\' edge normals can separate them, so the search is finite',
            terms: [
              { sym: 'the early exit', meaning: '9 axes tested while overlapping, 2 once separated — a clear miss is cheaper than a hit' },
              { sym: 'the push', meaning: 'the axis of SMALLEST overlap, and the sign from the projections on it' },
              { sym: 'measured', meaning: 'depths of 8.243, 5.315 and 2.386, and applying the push separates the shapes every time' },
              { sym: 'the plausible wrong answer', meaning: 'the direction between the centroids — wrong for 38 of 800 overlapping pairs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Per-pixel coverage sums to the shape\'s area',
          why: 'It is the difference between a coverage computation and a plausible blur.',
          breaks: 'Text renders thin and hairlines vanish at some zoom levels and not others.'
        },
        {
          name: 'Applying the minimum translation vector separates the shapes',
          why: 'It converts a subtle geometric claim into a property that holds or does not.',
          breaks: 'A body jitters or sinks through a surface rather than visibly teleporting.'
        },
        {
          name: 'The overlap verdict agrees with a sampling oracle',
          why: 'The separating-axis theorem holds only for convex shapes.',
          breaks: 'A concave shape passed in directly gives confident wrong answers.'
        },
        {
          name: 'One rasterisation convention across the whole system',
          why: 'Pixel centre against pixel corner is a half-pixel shift.',
          breaks: 'Two subsystems draw the same geometry half a pixel apart and nobody can find why.'
        }
      ],
      complexity: [
        { operation: 'Bresenham line', average: 'Θ(pixels), integer arithmetic only', worst: 'identical pixel sets to a rounding implementation on 83.1% of lines' },
        { operation: 'scanline polygon fill', average: 'Θ(edges log edges + pixels)', worst: '411 pixels touched for 378 filled here' },
        { operation: 'coverage anti-aliasing', average: 'Θ(pixels × samples) when supersampled', worst: '67 partly covered pixels out of 411' },
        { operation: 'Bézier flattening', average: 'segments grow with √(1/tolerance)', worst: '110 segments at a tolerance of 0.015625, against 8 at 4' },
        { operation: 'separating axis test', average: 'Θ(n + m) axes for convex shapes', worst: '9 axes when overlapping, 2 with an early exit' },
        { operation: 'sampling oracle for overlap', average: 'Θ(samples × edges)', worst: 'the reference, and it agreed at all 9 separations' }
      ],
      failureModes: [
        {
          symptom: 'A hairline seam appears between two shapes that share an edge.',
          cause: 'The outline and the fill use different tie-breaking, so they land a pixel apart.',
          fix: 'Use one line algorithm throughout; the pixel counts and endpoints already agree.'
        },
        {
          symptom: 'Thin shapes and text render systematically too light.',
          cause: 'The anti-aliasing filter is biased.',
          fix: 'Sum the per-pixel coverage and compare with the shoelace area — 377.63 against 377.50 here.'
        },
        {
          symptom: 'A collision response makes bodies jitter or sink into surfaces.',
          cause: 'The push direction came from the centroids rather than from the axis of smallest overlap.',
          fix: 'Take direction and sign from the chosen axis, then apply the push and re-run the test.'
        },
        {
          symptom: 'A radius search returns the wrong places, and only for some users.',
          cause: 'Latitude and longitude treated as planar coordinates.',
          fix: 'Project locally or use a geodesic distance; the error reaches a factor of two at 60° north.'
        }
      ],
      inTheWild: [
        { system: 'Font rasterisers', how: 'coverage-based anti-aliasing, where an unbiased filter is the whole product' },
        { system: 'Skia, Cairo and browser rendering', how: 'flattening tolerance per zoom level, and one rasterisation convention throughout' },
        { system: 'Physics engines', how: 'SAT with the minimum translation vector for convex shapes, and decomposition for concave ones' },
        { system: 'Mapping stacks', how: 'projected coordinates everywhere, because planar formulas on raw degrees are wrong away from the equator' }
      ],
      sources: [
        { title: 'Algorithm for computer control of a digital plotter', where: 'Jack Bresenham — IBM Systems Journal, 1965' },
        { title: 'Real-Time Collision Detection', where: 'Christer Ericson, 2004 — the separating axis test and the minimum translation vector' },
        { title: 'Computer Graphics: Principles and Practice', where: 'Hughes, van Dam, McGuire et al. — 3rd edition, 2013' },
        { title: 'A Rasterizing Algorithm for Drawing Curves', where: 'Alois Zingl, 2012 — Bresenham extended to curves' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
