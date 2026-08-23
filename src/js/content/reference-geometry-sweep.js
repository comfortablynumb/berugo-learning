/** Reference entries for sweeps, triangulation and Voronoi diagrams (M16.4-M16.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'sweep-line-algorithms': {
      summary: 'One paradigm — an event queue and a status structure — behind segment intersection, ' +
        'rectangle union, closest pair and the skyline, and the degeneracies that decide whether an ' +
        'implementation is right.',
      intuition: 'Two segments can only cross after they have become neighbours along the sweep ' +
        'line, so test neighbours rather than pairs.',
      formulation: {
        equations: [
          {
            label: 'The two structures',
            expr: 'a queue ordered by sweep position, a status ordered along the line',
            terms: [
              { sym: 'the queue', meaning: 'what happens next; it grows as intersections are discovered' },
              { sym: 'the status', meaning: 'what the line crosses now — 8 of 12 segments at x = 39.9 in the default scene' },
              { sym: 'everything left of the line', meaning: 'is finished with, which is what makes the paradigm work at all' }
            ]
          },
          {
            label: 'The bound',
            expr: 'O((n + k) log n), where k is the number of crossings reported',
            terms: [
              { sym: 'measured', meaning: '24 events against 66 pairs on 12 segments, and the same 12 crossings' },
              { sym: 'when k is large', meaning: 'the 6-segment grid produces 9 crossings — k grows quadratically while n does not' },
              { sym: 'when k is zero', meaning: 'the sparse fixture maintains both structures for an answer of nothing' }
            ]
          },
          {
            label: 'The four degeneracies',
            expr: 'each breaks a different assumption the clean description makes',
            terms: [
              { sym: 'shared endpoints', meaning: '3 segments meet at one point: one event removes and adds at once — 1 crossing' },
              { sym: 'vertical segments', meaning: 'no single y at the sweep position — 4 segments, 5 crossings' },
              { sym: 'three through one', meaning: 'one intersection belongs to three segments — 1 crossing, not several reports' },
              { sym: 'collinear overlap', meaning: 'the meeting is an interval, so a point must be chosen — 2 crossings' },
              { sym: 'measured', meaning: '0 disagreements with a pairwise scan across all 7 fixtures' }
            ]
          },
          {
            label: 'Rectangle union',
            expr: 'compress the y-axis to the coordinates that appear, then sweep x once',
            terms: [
              { sym: 'measured', meaning: '6 rectangles compress to 9 slabs and give an area of 876.00' },
              { sym: 'the oracle', meaning: 'inclusion-exclusion over every non-empty subset: 63 terms, also 876.00' },
              { sym: 'why it stays a test', meaning: '2ⁿ − 1 terms — over a billion at 30 rectangles' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The status order is the order along the sweep line, at the current position',
          why: 'Neighbour testing is only sound if the order is genuinely maintained.',
          breaks: 'A stale comparator makes two crossing segments never adjacent, and the crossing is lost silently.'
        },
        {
          name: 'A discovered intersection is queued once and only ahead of the sweep',
          why: 'The same crossing is reachable from both sides.',
          breaks: 'Duplicate events flip the status order twice and corrupt everything after them.'
        },
        {
          name: 'Every degenerate fixture agrees with a pairwise scan',
          why: 'None of these cases announce themselves at runtime.',
          breaks: 'The sweep returns a plausible answer with one crossing missing.'
        },
        {
          name: 'The oracle is a separate implementation, not the same code with a flag',
          why: 'Agreement is evidence only if the two sides can fail independently.',
          breaks: 'A shared bug in the intersection predicate passes both.'
        }
      ],
      complexity: [
        { operation: 'Bentley-Ottmann', average: 'Θ((n + k) log n)', worst: 'k can be Θ(n²) — the grid fixture has 9 crossings from 6 segments' },
        { operation: 'pairwise scan', average: 'Θ(n²) whatever the output', worst: '66 pair tests at n = 12, against 24 sweep events' },
        { operation: 'rectangle union by sweep', average: 'Θ(n log n) over compressed slabs', worst: '9 slabs from 6 rectangles' },
        { operation: 'inclusion-exclusion', average: 'Θ(2ⁿ)', worst: '63 terms at 6 rectangles, over a billion at 30' },
        { operation: 'closest pair by sweep', average: 'Θ(n log n)', worst: 'the status only ever holds a constant number of candidates' },
        { operation: 'memory', average: 'Θ(n) for the status, Θ(n + k) for the queue', worst: 'the queue is where discovered crossings accumulate' }
      ],
      failureModes: [
        {
          symptom: 'A sweep finds most intersections and misses one, with no error raised.',
          cause: 'A degeneracy — a shared endpoint or a vertical segment — broke the status ordering.',
          fix: 'Run the degenerate fixtures against a pairwise scan; nothing else surfaces it.'
        },
        {
          symptom: 'The status structure ends up in an impossible order and the sweep loops.',
          cause: 'A comparator that reads y at a stale sweep position, or an orientation test that contradicted itself.',
          fix: 'Recompute the comparison key at the current event, and use the robust predicate.'
        },
        {
          symptom: 'An intersection is reported twice, or a crossing behind the line is queued.',
          cause: 'No duplicate rejection, or no check that the event lies ahead of the sweep.',
          fix: 'Key events by coordinates and discard anything not strictly ahead.'
        },
        {
          symptom: 'The sweep is slower than the double loop it replaced.',
          cause: 'n is small and k is near zero, so the log factor buys nothing.',
          fix: 'Measure the crossover; below a few hundred segments the quadratic scan usually wins.'
        }
      ],
      inTheWild: [
        { system: 'GEOS, JTS and PostGIS', how: 'noding and overlay are sweeps, and their bug reports are degeneracy reports' },
        { system: 'CAD and PCB tooling', how: 'design-rule checks are rectangle and polygon sweeps over compressed coordinates' },
        { system: 'Layout and rendering engines', how: 'scanline fill and occlusion are sweeps with the same two structures' },
        { system: 'Interval scheduling and analytics', how: 'the skyline and union-of-intervals problems are the one-dimensional case' }
      ],
      sources: [
        { title: 'Algorithms for reporting and counting geometric intersections', where: 'Bentley, Ottmann — IEEE Transactions on Computers, 1979' },
        { title: 'Computational Geometry: Algorithms and Applications', where: 'de Berg, Cheong, van Kreveld, Overmars — chapter 2' },
        { title: 'Computational Geometry in C', where: 'Joseph O\'Rourke — 2nd edition, 1998' },
        { title: 'Robust plane sweep for intersecting segments', where: 'Boissonnat, Preparata — SIAM Journal on Computing, 2000' }
      ]
    },

    'polygon-triangulation': {
      summary: 'A triangle count fixed by a theorem, an ear test with a condition people leave out, ' +
        'and the one triangulation of a point set that interpolation survives.',
      intuition: 'Any valid triangulation joins the same points; Delaunay is the one whose worst ' +
        'triangle is least bad, and every flip away from it is a flip towards worse angles.',
      formulation: {
        equations: [
          {
            label: 'The count',
            expr: 'a simple polygon with n vertices has n − 2 triangles and n − 3 diagonals',
            terms: [
              { sym: 'measured', meaning: 'a 4-vertex square gives 2 triangles; a 12-vertex comb gives 10' },
              { sym: 'what the shape changes', meaning: 'ear tests — 1 for the square, 21 for the comb' },
              { sym: 'the stronger check', meaning: 'area preserved: 100.00% on all 6 fixtures, which catches overlaps the count does not' }
            ]
          },
          {
            label: 'The ear test',
            expr: 'convex at the vertex AND no other vertex inside the triangle it cuts off',
            terms: [
              { sym: 'the second condition', meaning: 'the one people omit; omitting it produces overlapping triangles with a correct count' },
              { sym: 'the optimisation', meaning: 'only reflex vertices need testing, which is what makes it usable past a few thousand vertices' },
              { sym: 'the cost', meaning: 'Θ(n²) naively — every candidate against every remaining vertex' }
            ]
          },
          {
            label: 'The empty-circle property',
            expr: 'no vertex lies inside any triangle\'s circumcircle; the test is the sign of a 4×4 determinant',
            terms: [
              { sym: 'the lift', meaning: 'add x² + y² as a third coordinate and "inside the circle" becomes "below the plane"' },
              { sym: 'measured', meaning: '108 triangles against 60 vertices: 0 violations from 7 531 predicate calls, 0 exact' },
              { sym: 'why not circumcentres', meaning: 'a nearly degenerate triangle has an enormous centre and a meaningless radius; only the sign is needed' }
            ]
          },
          {
            label: 'What Delaunay buys, measured by undoing it',
            expr: '60 legal flips, same points, same region, same 108 triangles',
            terms: [
              { sym: 'empty-circle violations', meaning: '0 before, 562 after' },
              { sym: 'mean smallest angle', meaning: '26.79° before, 18.94° after' },
              { sym: 'skinny triangles under 20°', meaning: '34 before, 57 after; under 10°, 18 before and 37 after' },
              { sym: 'the honest limit', meaning: 'Delaunay\'s own worst angle here is 0.52° — close points force skinny triangles whatever the mesh' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A triangulation of an n-vertex simple polygon has exactly n − 2 triangles',
          why: 'It costs nothing to assert and catches almost every ear-clipping bug.',
          breaks: 'A clipped reflex vertex or a crossing diagonal changes the count immediately.'
        },
        {
          name: 'The triangles sum to the polygon\'s area exactly',
          why: 'Overlaps and gaps both keep the count intact.',
          breaks: 'Overlapping triangles push the total above the ring\'s area and render as double-shaded seams.'
        },
        {
          name: 'After legalisation no vertex lies inside any circumcircle',
          why: 'It is the definition, and it is checkable exhaustively.',
          breaks: 'Skipping the propagation leaves the mesh correct near the insertion and wrong two triangles away.'
        },
        {
          name: 'Every flip strictly improves the sorted angle vector',
          why: 'That is why the flip loop terminates rather than cycling.',
          breaks: 'A flip accepted on a non-convex quadrilateral can repeat forever.'
        }
      ],
      complexity: [
        { operation: 'ear clipping', average: 'Θ(n²) with the naive containment test', worst: '21 ear tests for a 12-vertex comb, 1 for a square' },
        { operation: 'monotone decomposition', average: 'Θ(n log n)', worst: 'the practical choice above a few thousand vertices' },
        { operation: 'incremental Delaunay', average: 'Θ(n log n) expected with a random insertion order', worst: 'Θ(n²) on an adversarial order' },
        { operation: 'the flip loop', average: 'Θ(n) flips typically', worst: 'Θ(n²) flips in the worst case, always terminating' },
        { operation: 'empty-circle verification', average: 'Θ(t·n) — every triangle against every vertex', worst: '7 531 predicate calls at 108 triangles and 60 points' },
        { operation: 'memory', average: 'Θ(n) for the mesh plus adjacency', worst: 'adjacency is what makes flips O(1) rather than a search' }
      ],
      failureModes: [
        {
          symptom: 'A triangulated polygon renders with double-shaded seams.',
          cause: 'The ear test checked convexity but not containment, so triangles overlap.',
          fix: 'Add the containment condition and assert the area sum, not just the triangle count.'
        },
        {
          symptom: 'Triangles appear outside the polygon, filling its notches.',
          cause: 'A point-set triangulation was used where a polygon triangulation was meant.',
          fix: 'Use ear clipping or constrained Delaunay; unconstrained Delaunay fills the convex hull.'
        },
        {
          symptom: 'A Delaunay mesh violates the empty-circle property away from the last insertion.',
          cause: 'Legalisation was not propagated to the edges each flip exposed.',
          fix: 'Recurse on both exposed edges after every flip, and verify exhaustively on small inputs.'
        },
        {
          symptom: 'Interpolated terrain shows creases along thin triangles.',
          cause: 'The mesh is not Delaunay, or the points genuinely force slivers.',
          fix: 'Legalise; if the worst angle is still tiny, the fix is point insertion, not a better triangulation.'
        }
      ],
      inTheWild: [
        { system: 'Triangle and TetGen', how: 'Shewchuk\'s mesh generators — constrained Delaunay with quality guarantees' },
        { system: 'GIS terrain models', how: 'TINs are Delaunay triangulations, chosen for exactly the angle property' },
        { system: 'Game and graphics engines', how: 'ear clipping for concave polygon fills, since the meshes are small and the code is short' },
        { system: 'Finite-element solvers', how: 'element quality is angle quality, and skinny elements are where convergence dies' }
      ],
      sources: [
        { title: 'Computational Geometry: Algorithms and Applications', where: 'de Berg, Cheong, van Kreveld, Overmars — chapter 9' },
        { title: 'Computing Dirichlet tessellations', where: 'Adrian Bowyer — The Computer Journal, 1981' },
        { title: 'Computing the n-dimensional Delaunay tessellation with application to Voronoi polytopes', where: 'David Watson — The Computer Journal, 1981' },
        { title: 'Delaunay Refinement Algorithms for Triangular Mesh Generation', where: 'Jonathan Shewchuk — Computational Geometry, 2002' }
      ]
    },

    'voronoi-diagrams': {
      summary: 'Cells as intersected half-planes, the same diagram read off a Delaunay ' +
        'triangulation, the unbounded cells that are the whole difficulty, and a relaxation that ' +
        'never quite converges.',
      intuition: 'A wrong diagram still looks right, so the only check worth trusting is the ' +
        'definition applied directly: a brute-force nearest-site grid.',
      formulation: {
        equations: [
          {
            label: 'The definition, used as an algorithm',
            expr: 'a cell is the box clipped by one perpendicular-bisector half-plane per other site',
            terms: [
              { sym: 'the cost', meaning: 'Θ(n) clips per cell, Θ(n²) overall — fine at a few hundred sites' },
              { sym: 'measured', meaning: '24 cells, total area 10 660.52' },
              { sym: 'why keep it', meaning: 'it shares no code with the dual construction, so it cannot fail the same way' }
            ]
          },
          {
            label: 'The dual',
            expr: 'every Delaunay triangle contributes its circumcentre as a Voronoi vertex',
            terms: [
              { sym: 'why it works', meaning: 'a circumcentre is equidistant from its three sites and nearer them than any other — the Voronoi vertex condition' },
              { sym: 'measured', meaning: 'the same 24 cells and the same 10 660.52, agreeing to 3.33e-15 of relative area' },
              { sym: 'the practical point', meaning: 'a dozen lines on top of a triangulation you already need, against Fortune\'s sweep' }
            ]
          },
          {
            label: 'The unbounded cells',
            expr: 'a hull site has no triangle on its outer side, so its cell runs to infinity',
            terms: [
              { sym: 'measured', meaning: '19 of 24 cells reach the clip box' },
              { sym: 'what must be generated', meaning: 'two rays per hull site, perpendicular to the hull edges, then clipped' },
              { sym: 'the check', meaning: '0 of 900 grid points in the wrong cell, and 0 of 24 sites outside their own' }
            ]
          },
          {
            label: 'Lloyd relaxation',
            expr: 'move each site to its cell\'s centroid and rebuild; a centroidal diagram is the fixed point',
            terms: [
              { sym: 'round 1', meaning: 'movement 137.675, area spread 0.8447, largest cell 65.6× the smallest' },
              { sym: 'round 12', meaning: 'movement 14.859, spread 0.2956, ratio 3.2×' },
              { sym: 'the shape', meaning: 'monotone, fast at first and slow afterwards, and never zero' },
              { sym: 'the cost', meaning: 'a full reconstruction per round — this is k-means with cells as clusters' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every site lies inside its own cell',
          why: 'The cheapest possible check, and it fails immediately when the ray direction is wrong.',
          breaks: 'A cell that excludes its site is not a Voronoi cell under any definition.'
        },
        {
          name: 'A point is in a cell if and only if that cell\'s site is its nearest',
          why: 'It is the definition, and it is what a brute-force grid tests directly.',
          breaks: 'Nothing about the picture reveals a subtly wrong partition.'
        },
        {
          name: 'The cells partition the clip box with no gaps and no overlaps',
          why: 'The areas must sum to the box\'s area.',
          breaks: 'A missing ray leaves a wedge that belongs to nobody.'
        },
        {
          name: 'Every cell corner is a Delaunay triangle\'s circumcentre',
          why: 'It is what the duality asserts, and it is checkable per vertex.',
          breaks: 'A corner that is not one means the triangulation was not Delaunay to begin with.'
        }
      ],
      complexity: [
        { operation: 'half-plane intersection per cell', average: 'Θ(n) clips, Θ(n²) total', worst: 'usable to a few hundred sites, and the reference implementation' },
        { operation: 'Delaunay dual', average: 'Θ(n log n), dominated by the triangulation', worst: 'the hull sites need generated rays rather than read-off vertices' },
        { operation: 'Fortune\'s sweep', average: 'Θ(n log n) directly', worst: 'a beach line of parabolic arcs — the hardest status structure in the milestone' },
        { operation: 'nearest-site grid check', average: 'Θ(samples × n)', worst: '900 samples against 24 sites, and 0 misassigned' },
        { operation: 'Lloyd round', average: 'one full construction per round', worst: 'movement 137.675 → 14.859 over 12 rounds, still falling' },
        { operation: 'point location in the diagram', average: 'Θ(log n) with an index over the cells', worst: 'this is what the diagram is built for' }
      ],
      failureModes: [
        {
          symptom: 'The diagram looks right and a nearest-site lookup returns the wrong site.',
          cause: 'An unbounded cell was closed the wrong way, or a ray direction was flipped.',
          fix: 'Rasterise and compare against brute-force nearest site; nothing visual catches it.'
        },
        {
          symptom: 'Cells overlap, or a wedge of the box belongs to no cell.',
          cause: 'A hull site\'s two rays were missing or clipped in the wrong order.',
          fix: 'Assert that the cell areas sum to the box area; a gap shows up as a shortfall.'
        },
        {
          symptom: 'A cell does not contain its own site.',
          cause: 'The circumcentres were joined in insertion order rather than angular order.',
          fix: 'Sort the ring by angle about the site, and check containment for every site.'
        },
        {
          symptom: 'Relaxation "never converges".',
          cause: 'It does not: the centroidal diagram is approached, not reached.',
          fix: 'Pick a movement threshold or a fixed round count, and note each round is a full rebuild.'
        }
      ],
      inTheWild: [
        { system: 'd3-delaunay and Delaunator', how: 'the browser standard — triangulate, then dualise, exactly as this section does' },
        { system: 'Procedural map generation', how: 'Voronoi regions with Lloyd relaxation for evenly sized provinces and biomes' },
        { system: 'Facility location and coverage', how: 'cells are service areas; circumcentres are the points furthest from every site' },
        { system: 'Rendering and sampling', how: 'centroidal diagrams give blue-noise point sets for stippling and anti-aliasing' }
      ],
      sources: [
        { title: 'A sweepline algorithm for Voronoi diagrams', where: 'Steven Fortune — Algorithmica, 1987' },
        { title: 'Spatial Tessellations: Concepts and Applications of Voronoi Diagrams', where: 'Okabe, Boots, Sugihara, Chiu — 2nd edition, 2000' },
        { title: 'Least squares quantization in PCM', where: 'Stuart Lloyd — IEEE Transactions on Information Theory, 1982' },
        { title: 'Computational Geometry: Algorithms and Applications', where: 'de Berg, Cheong, van Kreveld, Overmars — chapter 7' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
