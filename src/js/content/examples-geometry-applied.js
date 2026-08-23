/** Worked examples for transforms, 3-D geometry and applied geometry (M16.9-M16.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'transforms-and-3d': [
      {
        title: 'The same two operations, the opposite order, and where the origin lands',
        goal: 'Compose a rotation and a translation both ways round, and find the single number in ' +
          'the matrix that says which order was used.',
        setup: 'One rotation and one translation, composed in both orders, with the resulting ' +
          'matrices printed and two known points pushed through each.',
        steps: [
          {
            do: 'Read the top two rows of both matrices.',
            why: 'The rotation part is identical; only one column differs.',
            work: 'both start 0.71 −0.71 0.00 and 0.71 0.71 0.00',
            result: 'the rotation is the same rotation in both'
          },
          {
            do: 'Read the translation column of each.',
            why: 'That is where the order actually shows up.',
            work: '28.28 and 28.28 for one order, 40.00 and 0.00 for the other',
            result: 'the same translation, rotated or not'
          },
          {
            do: 'Push the origin through both.',
            why: 'A pure rotation fixes the origin; a composition that translates first does not.',
            work: 'the origin lands at (28.3, 28.3, 0.0) and at (40.0, 0.0, 0.0)',
            result: 'the tell for this bug, and it needs no picture'
          },
          {
            do: 'Push the point (1, 0, 0) through both and measure the separation.',
            why: 'To put a number on "the rotation is wrong".',
            work: '(29.0, 29.0, 0.0) against (40.7, 0.7, 0.0) — 30.61 apart',
            result: 'two plausible outlines from the same two operations'
          }
        ],
        answer: 'Neither order is wrong; they are different transforms, and code that assumes the ' +
          'other convention produces the other outline. Four conventions travel with every matrix — ' +
          'row or column vectors, pre- or post-multiply, radians or degrees, and the Euler axis ' +
          'order — and none of them are in the type. If a scene rotates about the wrong point, the ' +
          'translation was applied first, and no amount of adjusting the angle will fix it.'
      },
      {
        title: 'Gimbal lock as a number, and a ray test checked against different algebra',
        goal: 'Measure how much rotational freedom is left at each pitch, then verify a ' +
          'ray-triangle routine against an implementation that shares none of its derivation.',
        setup: 'Yaw and roll each nudged by a hundredth of a radian at ten pitches, and 20 000 ' +
          'random rays cast at triangles with two independent intersection routines.',
        steps: [
          {
            do: 'Nudge yaw and roll separately at pitch zero and measure how far apart the results sit.',
            why: 'This is the baseline, and it has to be measured rather than derived.',
            work: 'the two results are 0.8103° apart',
            result: 'not twice the nudge — two perpendicular nudges differ by the nudge times √2'
          },
          {
            do: 'Repeat at pitches of 15, 30 and 45 degrees.',
            why: 'To see whether the freedom disappears suddenly or gradually.',
            work: 'gaps of 0.6976°, 0.5730° and 0.4385° — 13.91%, 29.29% and 45.88% lost',
            result: 'roughly half the freedom is gone by 45 degrees'
          },
          {
            do: 'Continue to 60, 75 and 90 degrees.',
            why: 'The pole is where the two axes coincide entirely.',
            work: '63.40%, 81.54% and finally 100.00% at a gap of 0.0000°',
            result: 'a degree of freedom no longer exists, stated as a number'
          },
          {
            do: 'Cast 20 000 rays at triangles with Möller-Trumbore.',
            why: 'It returns the barycentric coordinates as part of the intersection.',
            work: '715 hits and 19 285 misses, with 0 parallel cases',
            result: 'the degenerate case is rejected rather than divided by'
          },
          {
            do: 'Repeat with a plane intersection plus three edge cross products, and compare.',
            why: 'A reference that shares algebra with the routine is not a reference.',
            work: '0 disagreements, and 0 barycentric round-trip errors on every hit',
            result: 'two structures, one answer'
          }
        ],
        answer: 'Freedom drains away for the whole approach to the pole — 45.88% gone at 45 degrees, ' +
          '63.40% at 60 — which is why a camera controller feels sluggish long before anything ' +
          'visibly locks. The ray test agrees with a completely different derivation on all 20 000 ' +
          'rays, and the barycentric round-trip rebuilds each hit point from u and v and confirms it ' +
          'lands where the routine said. Agreement between one routine and itself would have been ' +
          'worth nothing.'
      }
    ],

    'applied-geometry': [
      {
        title: 'Two line algorithms, one polygon fill, and a coverage sum that must balance',
        goal: 'Find where Bresenham and rounding disagree, and check that an anti-aliasing filter ' +
          'is adding exactly as much ink as the shape contains.',
        setup: '3 000 random lines drawn by both algorithms, and one polygon filled with ' +
          'supersampled coverage per pixel.',
        steps: [
          {
            do: 'Draw 3 000 lines both ways and compare the pixel sets.',
            why: 'If they disagreed about anything structural it would show up here.',
            work: '2 492 identical sets — 83.1% — and 508 differing',
            result: 'they differ on a sixth of the lines'
          },
          {
            do: 'Check the endpoints and the pixel counts on the differing lines.',
            why: 'To find out what kind of disagreement it is.',
            work: 'endpoints equal on 3 000 of 3 000, and pixel counts equal on 3 000 of 3 000',
            result: 'the same line, a different tie broken'
          },
          {
            do: 'Fill a polygon and count the pixels.',
            why: 'The fill is the other half of the rasteriser.',
            work: '378 pixels filled, and 411 touched at all',
            result: '67 pixels are only partly covered'
          },
          {
            do: 'Sum the coverage fractions and compare with the shoelace area.',
            why: 'A biased filter makes thin shapes systematically too light or too heavy.',
            work: 'coverages sum to 377.63 against a true area of 377.50',
            result: 'the filter is adding the right amount of ink'
          },
          {
            do: 'Flatten a Bézier at five tolerances and read the segment counts.',
            why: 'To price a defensively tight tolerance before setting one.',
            work: '8, 14, 28, 56 and 110 segments at tolerances 4, 1, 0.25, 0.0625 and 0.015625',
            result: '256× the precision for 13.8× the segments'
          }
        ],
        answer: 'The two line algorithms agree about where a line starts, where it ends and how many ' +
          'pixels it takes, and disagree only about which pixel to pick when the ideal path runs ' +
          'exactly between two — so a renderer using one for outlines and the other for fills draws ' +
          'them a pixel apart along every shared edge. The coverage sum of 377.63 against 377.50 is ' +
          'the check that an anti-aliasing filter is unbiased, and flattening is far cheaper per ' +
          'digit of precision than it looks: the segment count grows roughly with the square root of ' +
          'the tolerance ratio.'
      },
      {
        title: 'The separating axis, and the push that has to actually push',
        goal: 'Slide two convex shapes apart step by step, watching the axis count, the overlap ' +
          'depth and whether the reported push separates them.',
        setup: 'Two convex polygons at nine separations, tested against a sampling oracle, with the ' +
          'minimum translation vector applied and the test re-run each time.',
        steps: [
          {
            do: 'Test the overlapping pair and count the axes examined.',
            why: 'The test exits the moment an axis separates the shapes.',
            work: '9 axes tested while overlapping, 2 once separated',
            result: 'a clear miss is cheaper than a hit'
          },
          {
            do: 'Check every verdict against a sampling oracle.',
            why: 'The theorem is only true for convex shapes, so the claim is worth testing.',
            work: 'the oracle agrees at all 9 separations',
            result: 'overlap at 0, 3 and 6; no overlap from 9 onwards'
          },
          {
            do: 'Read the overlap depth as the shapes slide apart.',
            why: 'It is the length of the minimum translation vector.',
            work: '8.243, 5.315 and 2.386 at separations of 0, 3 and 6',
            result: 'the depth falls smoothly to the point of contact'
          },
          {
            do: 'Apply the push and re-run the test.',
            why: 'A push that does not separate is the one thing this vector must never be.',
            work: 'at all 3 overlapping separations, applying it separates the shapes',
            result: 'a checkable property rather than a geometric claim'
          },
          {
            do: 'Take the push direction from the two centroids instead, as an earlier version did.',
            why: 'It is intuitive, cheap and right most of the time.',
            work: 'wrong for 38 of 800 overlapping pairs',
            result: 'a body that jitters or sinks rather than one that visibly teleports'
          }
        ],
        answer: 'The axis of smallest overlap is the shortest way out, and the centroid direction is ' +
          'a plausible substitute that fails on exactly the shapes where it matters — long thin ones ' +
          'in shallow contact, 38 of 800 pairs here. The sign has to come from the projections on ' +
          'the chosen axis too. Both halves are pinned down by checks that share no algebra with the ' +
          'test: a sampling oracle for the verdict, and applying the push and asking again for the ' +
          'vector.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
