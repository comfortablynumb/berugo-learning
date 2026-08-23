/** Concepts for sweeps, triangulation and Voronoi diagrams (M16.4-M16.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'sweep-line-algorithms': [
      {
        term: 'A sweep replaces a two-dimensional problem with a one-dimensional one that changes',
        plain: 'Move an imaginary line across the plane and keep only what it currently touches.',
        formal: 'an event queue ordered by sweep position, and a status structure ordered along the line',
        detail: 'The two structures answer different questions and confusing them is the usual first ' +
          'mistake. The queue says what happens next and is ordered by x; the status says what the ' +
          'line is crossing right now and is ordered by y at the current x. Everything the sweep ' +
          'knows lives in those two objects, and everything to the left of the line has been dealt ' +
          'with for good. That is the whole paradigm, and it is why closest pair, rectangle union, ' +
          'the skyline problem and segment intersection are the same algorithm wearing different ' +
          'clothes.',
        example: 'On the default scene the line at x = 39.9 crosses 8 of 12 segments, and only those ' +
          '8 can possibly cross each other at that moment.'
      },
      {
        term: 'Two segments can only cross after they have become neighbours',
        plain: 'So test neighbours in the status order rather than every pair.',
        formal: 'adjacency in the status structure is a necessary condition for an intersection',
        detail: 'This is the observation the whole of Bentley-Ottmann rests on. Before two segments ' +
          'cross, their order along the sweep line must swap, and to swap they must first be ' +
          'adjacent — so it is enough to test a pair when an insertion, a removal or a swap makes ' +
          'them neighbours. The saving is not a constant factor: brute force tests every pair ' +
          'whether or not any of them cross, while the sweep does work proportional to the number of ' +
          'crossings it actually reports.',
        example: 'The default scene processes 24 events and finds 12 intersections, against 66 pairs ' +
          'tested by brute force.'
      },
      {
        term: 'Discovered intersections become new events, and the queue must accept them',
        plain: 'The event queue is not built once at the start; it grows as the sweep runs.',
        formal: 'O((n + k) log n): k is the number of crossings, and it is an output term',
        readAs: 'The cost is the number of segments plus the number of crossings found, each ' +
          'multiplied by the log of the segment count — so an input with no crossings costs nothing ' +
          'for the crossings it does not have.',
        detail: 'When a crossing is found it is pushed as a future event, because at that point the ' +
          'two segments swap places in the status order and expose two new neighbouring pairs. This ' +
          'is what makes the algorithm output-sensitive and also what makes it delicate: the same ' +
          'crossing can be discovered from either side, so the queue must reject duplicates, and a ' +
          'crossing discovered behind the sweep line must be ignored rather than queued in the past.',
        example: 'A 6-segment grid where every horizontal meets every vertical produces 9 crossings ' +
          'from 6 segments — k grows quadratically while n does not.'
      },
      {
        term: 'The paradigm is a paragraph and the implementation is the degeneracies',
        plain: 'Shared endpoints, vertical segments, three segments through one point, and overlapping collinear pairs.',
        formal: 'each one breaks a different assumption the clean description quietly makes',
        detail: 'The clean version assumes every segment has one y at the sweep position, that every ' +
          'event involves exactly two segments and that intersections are isolated points. A ' +
          'vertical segment breaks the first, a shared endpoint or a triple crossing breaks the ' +
          'second, and a collinear overlap breaks the third — its intersection is an interval, so a ' +
          'single point has to be chosen and documented. None of these announce themselves at ' +
          'runtime: the algorithm returns a plausible answer with a crossing missing.',
        example: 'Four fixtures built to be degenerate, and the sweep agrees with brute force on all ' +
          'four: 1, 5, 1 and 2 crossings respectively.'
      },
      {
        term: 'The oracle has to be a separate implementation, not the same code with a flag',
        plain: 'Brute force over all pairs is quadratic, obviously correct, and affordable at the sizes that matter for testing.',
        formal: 'agreement between two implementations that share no code is evidence; self-agreement is not',
        detail: 'A comparison test is only worth the confidence you put in it if the two sides can ' +
          'fail independently. Brute force tests every pair with the segment-intersection predicate ' +
          'and never touches an event queue or a status order, so a bug in the sweep\'s ordering, ' +
          'its duplicate rejection or its degeneracy handling cannot hide in both. That is exactly ' +
          'why the degenerate fixtures are worth running: they are where a sweep and a pairwise ' +
          'check are most likely to disagree.',
        example: 'Across 7 fixtures, 0 disagreements between the sweep and the pairwise check.'
      },
      {
        term: 'Coordinate compression turns a continuous axis into a small number of slabs',
        plain: 'Only the coordinates that actually appear can matter, so relabel them 0, 1, 2 and work on those.',
        formal: 'n rectangles produce at most 2n distinct y values and therefore at most 2n − 1 slabs',
        detail: 'Inside a slab nothing changes, so the covered height is constant there and the ' +
          'sweep only has to track which slabs are covered as x events arrive. This is what makes ' +
          'rectangle-union area a sweep problem rather than an integration problem, and the same ' +
          'move appears everywhere in this milestone and in offline range queries: the geometry is ' +
          'continuous, the interesting positions are finite, and an index over the finite set is the ' +
          'whole algorithm.',
        example: '6 rectangles compress to 9 slabs, and the sweep walks the x-events once over them.'
      },
      {
        term: 'Inclusion-exclusion is a perfect oracle and a useless algorithm',
        plain: 'It is exact, needs no geometry beyond rectangle intersection, and costs one term per non-empty subset.',
        formal: '2ⁿ − 1 terms: 63 at 6 rectangles, and over a billion at 30',
        readAs: 'The number of terms doubles with every rectangle added, so six rectangles need ' +
          'sixty-three of them and thirty rectangles need more than a billion.',
        detail: 'That combination is exactly what an oracle should be: obviously right, easy to get ' +
          'right, and unaffordable in production. Keeping one in the test suite is the cheapest way ' +
          'to be sure the fast algorithm is correct rather than plausible, and the exponential cost ' +
          'is not a problem there because the fixtures are small on purpose. The same shape recurs ' +
          'across this milestone — a rasteriser for boolean operations, a pairwise scan for ' +
          'intersections, a nearest-site grid for Voronoi.',
        example: 'On the 6-rectangle fixture, inclusion-exclusion sums 63 terms and the sweep agrees ' +
          'to the last digit: 876.00 both ways.'
      },
      {
        term: 'Sparse input pays for a structure it never uses',
        plain: 'When there are almost no crossings, the sweep still maintains the queue and the status order.',
        formal: 'the log factor is per event, and it is paid whether or not k is large',
        detail: 'This is the honest counterweight to the output-sensitive bound. On a scene with no ' +
          'crossings at all the sweep still sorts the endpoints, inserts and removes every segment ' +
          'in an ordered structure, and tests each neighbouring pair, while a brute-force scan on a ' +
          'few dozen segments is a tight double loop over contiguous memory. The crossover is much ' +
          'higher than the asymptotics suggest, and for small n the quadratic version is genuinely ' +
          'faster as well as simpler to get right.',
        example: 'The sparse fixture has 12 segments and 0 crossings, so every event maintains a ' +
          'structure that never reports anything.'
      }
    ],

    'polygon-triangulation': [
      {
        term: 'Every simple polygon has exactly n − 2 triangles, whatever its shape',
        plain: 'Twelve vertices always give ten triangles; a run that gives a different number has failed.',
        formal: 'a triangulation of a simple polygon with n vertices has n − 2 triangles and n − 3 diagonals',
        detail: 'This is a theorem rather than a coincidence, and it makes an assertion available ' +
          'that costs nothing and catches almost every ear-clipping bug: a clip that removed a ' +
          'reflex vertex, a diagonal that crossed an edge, an ear test that accepted a vertex with a ' +
          'point inside it. What the shape does change is the work, not the output size — a convex ' +
          'polygon finds an ear at the first vertex every time, while a comb has to walk past every ' +
          'reflex vertex before it finds one.',
        example: 'Across 6 fixtures the triangle count is always vertices minus two, while ear tests ' +
          'range from 1 on a square to 21 on a 12-vertex comb.'
      },
      {
        term: 'An ear is a vertex whose diagonal stays inside and encloses nothing',
        plain: 'Convex at the vertex, and no other vertex of the polygon inside the triangle it cuts off.',
        formal: 'both conditions are needed: convexity alone admits a triangle containing a reflex vertex',
        detail: 'The second condition is the one people leave out, and leaving it out produces a ' +
          'triangulation whose triangles overlap while the vertex count still works out. Testing it ' +
          'naively is what makes ear clipping quadratic: every candidate is checked against every ' +
          'remaining vertex. The optimisation everyone reaches for — only test reflex vertices — is ' +
          'correct, because a convex vertex inside the ear would force a reflex one inside it too, ' +
          'and it is the difference between usable and not on a few thousand vertices.',
        example: 'The comb needs 21 ear tests to produce its 10 triangles, against 1 for a square ' +
          'that produces 2.'
      },
      {
        term: 'Any valid triangulation joins the same points; only the diagonals differ',
        plain: 'Two triangulations of one point set have the same vertices, the same covered region and the same triangle count.',
        formal: 'every triangulation of a point set is reachable from every other by a sequence of edge flips',
        detail: 'That is why the comparison in this section is fair rather than rigged: the second ' +
          'row is literally the first one with some diagonals flipped, so nothing about the input ' +
          'has changed. It also explains what "optimal triangulation" can mean at all — since the ' +
          'set of triangulations is connected by flips, a local rule that improves each quadrilateral ' +
          'can reach a global optimum, which is not true of most optimisation problems and is the ' +
          'reason the flip algorithm terminates at the right answer.',
        example: '60 legal flips leave 108 triangles over the same 60 points, covering the identical ' +
          'region.'
      },
      {
        term: 'The empty-circle property is the definition, and the in-circle predicate is the test',
        plain: 'A triangulation is Delaunay when no vertex lies inside any triangle\'s circumcircle.',
        formal: 'the sign of a 4×4 determinant in the lifted coordinates x, y, x² + y²',
        readAs: 'Lift each point onto a paraboloid by adding its distance from the origin squared as ' +
          'a third coordinate; then "inside the circle through the other three" becomes "below the ' +
          'plane through the other three", which is an orientation test one dimension up.',
        detail: 'Stating it as a determinant rather than as "compute the circumcentre and compare ' +
          'radii" matters for the same reason it mattered in the primitives section: the ' +
          'circumcentre of a nearly degenerate triangle is enormous and its radius is meaningless, ' +
          'whereas the determinant only ever needs its sign. The property is also checkable ' +
          'exhaustively, which is what makes Delaunay one of the few geometric outputs you can ' +
          'verify rather than eyeball.',
        example: 'The default mesh checks every one of its 108 triangles against all 60 vertices and ' +
          'finds 0 violations, at a cost of 7 531 predicate calls, 0 of which needed exact arithmetic.'
      },
      {
        term: 'A flip fixes one quadrilateral and can break its neighbours, so the repair propagates',
        plain: 'Flipping the shared diagonal of two triangles changes the circumcircles of the triangles beyond them.',
        formal: 'legalise recursively: after a flip, re-test the two edges the flip exposed',
        detail: 'This is the entire incremental Delaunay algorithm. Insert a point, split the ' +
          'triangle containing it into three, then legalise the three outer edges — and each ' +
          'legalisation that flips exposes two more edges to test. The recursion terminates because ' +
          'every flip strictly increases the sorted vector of angles, so no configuration can repeat. ' +
          'Omitting the propagation is the classic bug: the mesh looks right near the inserted point ' +
          'and violates the property two triangles away.',
        example: 'Undoing 60 flips takes the mesh from 0 empty-circle violations to 562.'
      },
      {
        term: 'Delaunay maximises the smallest angle, and that is what interpolation cares about',
        plain: 'Of all triangulations of a point set, it is the one whose worst triangle is least bad.',
        formal: 'the sorted angle vector of the Delaunay triangulation is lexicographically maximal',
        detail: 'A skinny triangle is a bad interpolation basis: a value at a point inside it is ' +
          'dominated by two vertices that are close together and barely influenced by the third, so ' +
          'terrain rendered from one shows visible creases and a finite-element solution over one ' +
          'converges badly. Delaunay does not eliminate skinny triangles — two points very close ' +
          'together force one however the mesh is drawn — it produces as few as the point set ' +
          'permits, which is a much more useful guarantee than it first sounds.',
        example: 'Mean smallest angle 26.79° for Delaunay against 18.94° after the flips, with 34 ' +
          'skinny triangles against 57 and 18 against 37 under ten degrees.'
      },
      {
        term: 'Point-set triangulation and polygon triangulation are different problems',
        plain: 'One covers the convex hull of a set of points; the other covers the inside of a possibly concave ring.',
        formal: 'a constrained triangulation forces given edges to appear and gives up the empty-circle property on them',
        detail: 'Confusing them produces triangles outside the polygon, which is the single most ' +
          'common triangulation bug in rendering code. Delaunay over a polygon\'s vertices fills the ' +
          'convex hull, including the notches; ear clipping over a point set is not even defined. ' +
          'The bridge is constrained Delaunay: force the polygon edges in, then legalise everything ' +
          'else, accepting that a constrained edge may violate the empty-circle property because it ' +
          'is required to be there.',
        example: 'The comb has 12 vertices and 10 triangles from ear clipping, all inside the ring; ' +
          'a Delaunay triangulation of the same 12 points would fill the teeth as well.'
      },
      {
        term: 'The area check is cheap, and it catches what the triangle count does not',
        plain: 'The triangles must sum to the polygon\'s area exactly, not approximately.',
        formal: 'a correct triangulation preserves 100% of the signed area and has no overlaps',
        detail: 'The count is a necessary condition and this one is much closer to sufficient: ' +
          'overlapping triangles push the total above the polygon\'s area, and a missed region ' +
          'pushes it below, while both keep the count intact. It is one shoelace sum per triangle ' +
          'and it turns "the triangulation looked right in the picture" into a test that runs on ' +
          'every fixture in a second. Pair it with a check that every triangle is wound the same way ' +
          'as the ring and very little is left to go wrong.',
        example: 'All 6 polygon fixtures preserve 100.00% of their area, from a 4-vertex square to a ' +
          '12-vertex comb.'
      }
    ],

    'voronoi-diagrams': [
      {
        term: 'A cell is the intersection of half-planes, one per other site',
        plain: 'Everything closer to this site than to that one is a half-plane; intersect them all.',
        formal: 'the perpendicular bisector of two sites is the boundary between their cells',
        detail: 'This is the definition, and it is also a perfectly usable algorithm at small scale: ' +
          'clip a bounding box by one half-plane per other site and what remains is the cell. It is ' +
          'O(n) clips per cell and therefore O(n²) overall, which is far too slow for a million ' +
          'sites and completely fine for a few hundred — and it is worth having in the test suite ' +
          'whatever you use in production, because it shares no code with the dual construction and ' +
          'so cannot fail the same way.',
        example: 'Half-plane intersection and the Delaunay dual give the same 24 cells and the same ' +
          'total area of 10 660.52, agreeing to 3.33e-15 of relative area.'
      },
      {
        term: 'The Voronoi diagram is the Delaunay triangulation turned inside out',
        plain: 'Every Delaunay triangle contributes its circumcentre as a Voronoi vertex, and every Delaunay edge a cell boundary.',
        formal: 'the two are duals: triangles become vertices, edges become edges, vertices become cells',
        detail: 'This is why almost every library builds the triangulation and dualises rather than ' +
          'implementing Fortune\'s sweep. The dual is a walk over a structure you already have: for ' +
          'each site, collect the triangles around it, take their circumcentres in angular order, ' +
          'and that ring is the cell. The empty-circle property is what makes it work — a ' +
          'circumcentre is equidistant from its triangle\'s three sites and closer to them than to ' +
          'any other, which is exactly the condition for being a Voronoi vertex.',
        example: 'Every one of the 24 cell corners in the default scene sits at a Delaunay triangle\'s ' +
          'circumcentre.'
      },
      {
        term: 'Cells on the hull are unbounded, and those rays are the whole difficulty',
        plain: 'A site on the convex hull has no triangle on its outer side, so its cell runs to infinity.',
        formal: 'the unbounded cells are exactly the cells of the hull vertices',
        detail: 'For an interior site the circumcentres form a closed ring and the cell reads ' +
          'straight off the triangulation. For a hull site the ring is open at both ends and the two ' +
          'missing edges are rays perpendicular to the hull edges, which have to be generated rather ' +
          'than read off and then clipped to whatever box the caller wants. Getting the ray ' +
          'direction or the clip order wrong produces a diagram that looks entirely plausible, which ' +
          'is why the brute-force check matters more here than anywhere else in the milestone.',
        example: '19 of 24 cells reach the clip box, which is to say 19 of the sites are on the hull ' +
          'and their cells are genuinely unbounded.'
      },
      {
        term: 'A wrong diagram still looks right, so check it against a nearest-site grid',
        plain: 'Rasterise the box, find each pixel\'s nearest site by brute force, and compare with the cell it landed in.',
        formal: 'the definition made executable: a point is in a cell if and only if that cell\'s site is its nearest',
        detail: 'Voronoi output is the hardest thing in this milestone to eyeball, because almost ' +
          'any partition of the plane into convex cells around scattered points looks like a Voronoi ' +
          'diagram. The grid check is the definition applied directly and it costs one distance per ' +
          'site per sample, which is nothing at test sizes. Two things must both hold: every site ' +
          'lies inside its own cell, and every sampled point is assigned to its nearest site. Either ' +
          'alone passes for a diagram that is subtly wrong.',
        example: '0 of 900 grid points land in the wrong cell, and 0 of 24 sites fall outside their ' +
          'own cell.'
      },
      {
        term: 'Fortune\'s sweep is worth understanding and rarely worth implementing',
        plain: 'It builds the diagram in O(n log n) with a beach line of parabolic arcs and two kinds of event.',
        formal: 'site events add an arc; circle events remove one and emit a Voronoi vertex',
        detail: 'The insight is genuinely beautiful: the boundary between the region already decided ' +
          'and the region still to come is a chain of parabolas, because a point is equidistant from ' +
          'a site behind the sweep and the sweep line itself exactly on a parabola. The reason to ' +
          'know it is that it is the standard example of a sweep whose status structure is not a ' +
          'simple ordering, and the reason not to write it is that dualising a Delaunay ' +
          'triangulation gets the same diagram in a dozen lines on top of a routine you already need.',
        example: 'The two constructions in this section agree on total area to 6.71e-12 in the worst ' +
          'cell, which is floating-point noise rather than a difference.'
      },
      {
        term: 'Lloyd relaxation moves each site to its cell\'s centroid, and repeats',
        plain: 'A few rounds turn a lumpy random diagram into an evenly spaced one.',
        formal: 'a centroidal diagram is a fixed point: every site sits at the centroid of its own cell',
        detail: 'Each round rebuilds the diagram from the moved sites, which means the cost is a ' +
          'full construction per round — and it is why relaxation is usually run for a fixed small ' +
          'number of rounds rather than to convergence. It is the standard way to get blue-noise ' +
          'point distributions for stippling, sampling and procedural map generation, and it is also ' +
          'exactly k-means with the cells as clusters, which is worth noticing because the ' +
          'convergence behaviour and the failure modes transfer.',
        example: 'The largest cell is 65.6× the smallest at round 1 and 3.2× at round 12.'
      },
      {
        term: 'Relaxation approaches its fixed point rather than landing on it',
        plain: 'Movement falls fast for a round or two and then decays slowly, and never reaches zero.',
        formal: 'the stopping rule is a threshold you choose, not a state the algorithm reports',
        detail: 'The first round does most of the work because a random point set has a handful of ' +
          'very lopsided cells that correct immediately; after that both the total movement and the ' +
          'area spread fall monotonically but slowly. Since neither reaches zero, "run until ' +
          'converged" is not an implementable instruction — the number of rounds is a parameter, and ' +
          'the honest way to set it is to plot the movement and pick a point on the curve rather ' +
          'than to wait for a flag that never arrives.',
        example: 'Total site movement falls 137.675 → 14.859 over 12 rounds while area spread falls ' +
          '0.8447 → 0.2956, both monotonically and neither to zero.'
      },
      {
        term: 'The diagram answers nearest-neighbour queries in the shape of the space, not the data',
        plain: 'Once built, "which site is nearest" is a point-location query rather than a search over sites.',
        formal: 'the cell containing the query point names the nearest site, whatever the site count',
        detail: 'That is the practical reason to build one: nearest-facility lookups, coverage maps, ' +
          'service areas and cell-tower assignment are all this query, and a spatial index over the ' +
          'cells answers them without touching the sites at all. It also composes: the Delaunay dual ' +
          'is the natural neighbour graph, the cell areas are a coverage measure, and the ' +
          'circumcentres are the points furthest from every site — which is where you put the next ' +
          'facility.',
        example: 'The default scene\'s 24 cells partition the box exactly: total area 10 660.52 with ' +
          'a worst cell gap of 6.71e-12.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
