/** Worked examples for sweeps, triangulation and Voronoi diagrams (M16.4-M16.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'sweep-line-algorithms': [
      {
        title: 'What the sweep pays for, and what it stops paying for',
        goal: 'Count the work a sweep does against the work a pairwise scan does on the same ' +
          'segments, and find the input where the sweep is the worse choice.',
        setup: '12 random segments with the sweep line, the event queue and the ordered status ' +
          'structure all instrumented, checked against a separate brute-force implementation.',
        steps: [
          {
            do: 'Stop the sweep partway and read the status structure.',
            why: 'It holds exactly the segments the line currently crosses, ordered by where.',
            work: 'at x = 39.9 the line crosses 8 of the 12 segments',
            result: 'only those 8 can possibly cross each other at that moment'
          },
          {
            do: 'Count events processed against pairs tested by brute force.',
            why: 'That is the comparison the paradigm is making.',
            work: '24 events against 66 pairs',
            result: 'the sweep tests neighbours, not pairs'
          },
          {
            do: 'Compare the crossings found with the brute-force result.',
            why: 'Neighbour testing is only a saving if it misses nothing.',
            work: '12 intersections found, 12 by brute force, 0 disagreements',
            result: 'the same answer for a third of the tests'
          },
          {
            do: 'Switch to the grid fixture, where every horizontal meets every vertical.',
            why: 'Here k is quadratic in n and the output term dominates.',
            work: '6 segments produce 9 crossings, and the sweep still agrees exactly',
            result: 'output-sensitivity cuts both ways'
          },
          {
            do: 'Switch to the sparse fixture.',
            why: 'The honest counterweight to an output-sensitive bound.',
            work: '12 segments, 0 crossings, and every event still maintains the two structures',
            result: 'the log factor is paid whether or not anything is found'
          }
        ],
        answer: 'The sweep replaced 66 pairwise tests with 24 events and found the same 12 ' +
          'crossings. The bound is O((n + k) log n) and both terms are real: on the grid the ' +
          'crossings dominate, and on the sparse fixture the structure is maintained for an answer ' +
          'of zero. At a few dozen segments the quadratic scan is genuinely faster as well as ' +
          'simpler — the sweep earns its keep when n is large and k is not.'
      },
      {
        title: 'The four degeneracies, and an oracle that shares no code',
        goal: 'Break each assumption the clean description of a sweep makes, and check the answer ' +
          'against an implementation that could not fail the same way.',
        setup: 'Seven fixtures — one random, one grid, one sparse and four built to be degenerate — ' +
          'run through both the sweep and a pairwise scan.',
        steps: [
          {
            do: 'Run the shared-endpoint fixture, where three segments meet at one point.',
            why: 'The clean version assumes an event involves exactly two segments.',
            work: '3 segments, 1 intersection by both methods',
            result: 'one event has to remove and add at the same moment'
          },
          {
            do: 'Run the vertical fixture.',
            why: 'A vertical segment has no single y at the sweep position.',
            work: '4 segments, 5 intersections by both methods',
            result: 'the case has to be carried explicitly rather than divided by zero'
          },
          {
            do: 'Run the three-through-one fixture.',
            why: 'One intersection belonging to three segments is not two pairwise crossings reported twice.',
            work: '3 segments, 1 intersection by both methods',
            result: 'duplicate rejection in the event queue is load-bearing'
          },
          {
            do: 'Run the collinear-overlap fixture.',
            why: 'Here the intersection is an interval rather than a point.',
            work: '3 segments, 2 intersections by both methods',
            result: 'a single representative point has to be chosen and documented'
          },
          {
            do: 'Total the disagreements across all seven fixtures.',
            why: 'The claim is only worth making if the oracle is independent.',
            work: '0 disagreements over 7 fixtures',
            result: 'and the brute force never touches an event queue'
          }
        ],
        answer: 'All four degenerate fixtures agree exactly, and none of them would have announced a ' +
          'failure at runtime — a sweep that mishandles a shared endpoint returns a plausible answer ' +
          'with one crossing missing. The claim is worth making only because the brute force is a ' +
          'separate implementation rather than the same code behind a flag: a bug in the status ' +
          'ordering or the duplicate rejection cannot hide in both.'
      },
      {
        title: 'Rectangle union: compressing an axis, and an oracle that cannot scale',
        goal: 'Compute the area covered by overlapping rectangles with a sweep, and check it against ' +
          'a method that is exact and exponential.',
        setup: '6 axis-aligned rectangles, swept over compressed y-slabs, with inclusion-exclusion ' +
          'over every non-empty subset as the reference.',
        steps: [
          {
            do: 'Compress the y-axis to the coordinates that actually appear.',
            why: 'Inside a slab nothing changes, so the covered height is constant there.',
            work: '6 rectangles give 9 slabs',
            result: 'a continuous axis becomes a small finite one'
          },
          {
            do: 'Sweep the x-events once, tracking which slabs are covered.',
            why: 'Area accumulates as covered height times the gap to the next event.',
            work: 'sweep area 876.00',
            result: 'one pass, no integration'
          },
          {
            do: 'Run inclusion-exclusion over every non-empty subset.',
            why: 'It is exact and needs nothing but rectangle intersection.',
            work: '63 terms summed, giving 876.00',
            result: 'the two agree to the last digit'
          },
          {
            do: 'Extrapolate the oracle to 30 rectangles.',
            why: 'To see why it is a test and not an algorithm.',
            work: '2³⁰ − 1 terms, over a billion',
            result: 'exact, obviously correct and unusable'
          }
        ],
        answer: '876.00 from both, from 63 subset terms one way and 9 slabs and one x-pass the ' +
          'other. That pairing — an exponential method that is obviously right against a linear one ' +
          'that is subtle — is the pattern the whole milestone uses, and coordinate compression is ' +
          'the move that makes the fast side possible: the geometry is continuous, the interesting ' +
          'positions are finite, and an index over the finite set is the algorithm.'
      }
    ],

    'polygon-triangulation': [
      {
        title: 'Ear clipping, and the count that is a theorem',
        goal: 'Triangulate six polygons of different shapes and separate what the shape changes ' +
          'from what it cannot.',
        setup: 'Six fixtures from a 4-vertex square to a 12-vertex comb, with ear tests counted and ' +
          'the triangles\' areas summed against the ring\'s.',
        steps: [
          {
            do: 'Triangulate the square and the comb, and count triangles.',
            why: 'The count is fixed by a theorem: n vertices give n − 2 triangles.',
            work: 'the square gives 2 from 4 vertices, the comb 10 from 12',
            result: 'the shape does not move the output size at all'
          },
          {
            do: 'Count ear tests for the same two.',
            why: 'This is what the shape does change.',
            work: '1 ear test for the square against 21 for the comb',
            result: 'a convex polygon finds an ear at the first vertex every time'
          },
          {
            do: 'Sum the triangle areas and compare with the shoelace area of the ring.',
            why: 'The count is necessary; overlapping triangles keep it intact.',
            work: '100.00% of the area preserved on all 6 fixtures',
            result: 'the check that actually catches an overlap'
          },
          {
            do: 'Read the middling fixtures.',
            why: 'To see the work track the reflex vertices rather than the vertex count.',
            work: 'the L-shape 4 triangles from 5 tests, the star 6 from 7, the spiky 6 from 5',
            result: 'ear tests scale with how far you must walk to find a convex vertex'
          }
        ],
        answer: 'Six shapes, six triangle counts fixed at vertices minus two, and ear tests from 1 ' +
          'to 21. The count is worth asserting on every run because it costs nothing and catches ' +
          'almost every clipping bug; the area sum is what catches the rest, since overlapping ' +
          'triangles pass the count and push the total above the polygon\'s area.'
      },
      {
        title: 'What Delaunay buys, measured by undoing it',
        goal: 'Take a Delaunay mesh, flip some of its diagonals, and measure exactly what was lost — ' +
          'with the vertices, the region and the triangle count all held fixed.',
        setup: '60 points triangulated into 108 triangles, then the same mesh after 60 legal flips, ' +
          'with every triangle checked against every vertex for the empty-circle property.',
        steps: [
          {
            do: 'Check the empty-circle property exhaustively on the Delaunay mesh.',
            why: 'It is the definition, and it is checkable rather than eyeballable.',
            work: '108 triangles against 60 vertices: 0 violations, from 7 531 predicate calls',
            result: 'and 0 of those calls needed exact arithmetic'
          },
          {
            do: 'Flip 60 diagonals, each one legal on its own quadrilateral.',
            why: 'Flipping changes which diagonals are drawn and nothing else.',
            work: 'still 108 triangles, the same 60 points, the same covered region',
            result: 'a fair comparison rather than a rigged one'
          },
          {
            do: 'Re-run the empty-circle check on the flipped mesh.',
            why: 'A flip fixes one quadrilateral and can break its neighbours.',
            work: '562 violations, up from 0',
            result: 'the property is global, and local flips propagate'
          },
          {
            do: 'Compare the angle distributions.',
            why: 'This is what "maximises the minimum angle" means in numbers.',
            work: 'mean smallest angle 26.79° against 18.94°; 34 skinny triangles against 57',
            result: 'every flip away from Delaunay is a flip towards worse angles'
          },
          {
            do: 'Read the worst bucket, under ten degrees.',
            why: 'Those are the triangles that ruin an interpolation.',
            work: '18 triangles for Delaunay against 37 for the flipped mesh',
            result: 'twice as many, from the identical point set'
          }
        ],
        answer: 'Same points, same region, same 108 triangles — and 0 empty-circle violations ' +
          'against 562, a mean smallest angle of 26.79° against 18.94°, and 18 triangles under ten ' +
          'degrees against 37. Delaunay does not eliminate skinny triangles: its own worst angle ' +
          'here is 0.52°, forced by two points sitting close together. It produces as few as the ' +
          'point set permits, which is the guarantee that makes it the default mesh for terrain and ' +
          'interpolation.'
      }
    ],

    'voronoi-diagrams': [
      {
        title: 'Two constructions that share no code, and the check that they are both right',
        goal: 'Build the same diagram by intersecting half-planes and by dualising a triangulation, ' +
          'then verify both against the definition rather than against each other.',
        setup: '24 sites in a clipped box, built twice, with a 900-point nearest-site grid as the ' +
          'independent reference.',
        steps: [
          {
            do: 'Build every cell by clipping the box with one half-plane per other site.',
            why: 'That is the definition, and it is an algorithm at this scale.',
            work: '24 cells, total area 10 660.52',
            result: 'O(n) clips per cell, and correct by construction'
          },
          {
            do: 'Build the same diagram from the Delaunay dual instead.',
            why: 'It is what libraries actually do, and it shares no code with the first.',
            work: '24 cells, total area 10 660.52, worst cell gap 6.71e-12',
            result: 'agreement to 3.33e-15 of relative area — noise, not a difference'
          },
          {
            do: 'Count the cells that reach the clip box.',
            why: 'Those are the ones that would run to infinity, and they are where the dual is hard.',
            work: '19 of 24 — the sites on the convex hull',
            result: 'two rays per hull site, generated rather than read off'
          },
          {
            do: 'Rasterise the box and find each sample\'s nearest site by brute force.',
            why: 'Almost any partition into convex cells looks like a Voronoi diagram.',
            work: '0 of 900 grid points land in the wrong cell',
            result: 'the definition applied directly'
          },
          {
            do: 'Check that every site is inside its own cell.',
            why: 'The grid check alone passes for a diagram that is subtly wrong.',
            work: '0 of 24 sites outside their own cell, by both constructions',
            result: 'both conditions, not either one'
          }
        ],
        answer: 'Two independent constructions, identical to 3.33e-15, and both verified against a ' +
          'brute-force nearest-site grid rather than against one another. Building from the Delaunay ' +
          'dual is a dozen lines on top of a triangulation you already need, which is why Fortune\'s ' +
          'sweep is worth understanding and rarely worth implementing — and the 19 unbounded cells ' +
          'are where the dual construction earns its test suite.'
      },
      {
        title: 'Lloyd relaxation, and a fixed point it never reaches',
        goal: 'Even out a lumpy random diagram by moving each site to its cell\'s centroid, and ' +
          'find where to stop.',
        setup: 'The same 24 sites, relaxed for 12 rounds, with the total site movement and the cell ' +
          'area spread recorded after each round.',
        steps: [
          {
            do: 'Measure the starting diagram\'s unevenness.',
            why: 'A random point set has a few very lopsided cells.',
            work: 'area spread 0.8447, largest cell 65.6× the smallest',
            result: 'the thing relaxation is meant to fix'
          },
          {
            do: 'Run one round and measure the movement.',
            why: 'The first round does most of the work.',
            work: 'total site movement 137.675',
            result: 'the lopsided cells correct immediately'
          },
          {
            do: 'Run eleven more and read the same two numbers.',
            why: 'To see the shape of the decay rather than its endpoint.',
            work: 'movement 137.675 → 14.859, area spread 0.8447 → 0.2956',
            result: 'both monotone, both still falling at round 12'
          },
          {
            do: 'Read the largest-over-smallest ratio down the rounds.',
            why: 'It is the most legible measure of evenness.',
            work: '65.6×, 20.4×, 11.0×, 8.4×, 7.5× … 3.2× at round 12',
            result: 'a fast start and a long slow tail'
          },
          {
            do: 'Look for the round at which it converges.',
            why: 'There is not one, and that is the point.',
            work: 'neither curve reaches zero in 12 rounds',
            result: 'the stopping rule is a threshold you choose'
          }
        ],
        answer: 'Twelve rounds take the largest-to-smallest cell ratio from 65.6× to 3.2× and total ' +
          'movement from 137.675 to 14.859, both monotonically and neither to zero. A centroidal ' +
          'diagram is a fixed point relaxation approaches rather than lands on, so "run until ' +
          'converged" is not an implementable instruction — plot the movement, pick a point on the ' +
          'curve, and note that each round costs a full reconstruction.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
