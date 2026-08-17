# M16 — Computational geometry

> **Track** Algorithms · **Depends on** M08, M10 · **Sections** 10 · **Effort** L

**Outcome.** Geometry as most engineers meet it — maps, hit testing, layout, collision, rendering —
with the robustness problem front and centre. Geometry is the one algorithmic area where floating
point does not merely lose precision, it produces contradictory answers that crash the algorithm.

**Shared machinery introduced.** `algorithms/geometry-core.js` with exact-sign predicates
(orientation, in-circle) implemented adaptively; `machines/geometry-lab.js` — draggable scenes,
degenerate-input generators (collinear, coincident, near-collinear) and a brute-force oracle;
`viz/geometry-view.js` — canvas scene renderer with sweep lines, hulls and construction overlays.

---

## Sections

### 16.1 Primitives and robustness
- **Covers** — points and vectors, dot and cross products, the orientation predicate as the
  foundation of everything, why `a - b < epsilon` comparisons are not a fix, floating-point failure
  in orientation tests, adaptive exact predicates (Shewchuk), integer coordinates as the practical
  escape, and the "impossible" states a non-robust predicate produces.
- **Demo** — robustness breaker: three nearly collinear points where the naive orientation test
  reports inconsistent answers depending on argument order, with the exact predicate returning a
  consistent sign; a zoom control shows the failure band.
- **Diagram** — mermaid flowchart of the adaptive predicate's escalation from fast to exact.
- **Lab** — implement `orient2d` with an error-bound check that escalates to exact arithmetic; tests
  assert consistency under all six argument permutations on adversarial coordinates.
- **Senior insight** — every "the convex hull crashed" and "the polygon has a hole in it" bug traces
  back to an orientation test that answered differently for the same three points in a different
  order.

### 16.2 Polygons, areas and containment
- **Covers** — the shoelace formula and signed area, orientation of a polygon, convexity testing,
  point-in-polygon by ray casting and by winding number, the boundary and vertex cases, polygon
  simplification (Douglas–Peucker, Visvalingam), and self-intersection detection.
- **Demo** — draw a polygon, drop test points, and see both containment algorithms report per point,
  with the ray crossings and the accumulated winding drawn; the on-edge and vertex-hit cases are
  reachable deliberately.
- **Diagram** — mermaid diagram of the ray-crossing parity rule with a vertex-grazing case.
- **Lab** — implement point-in-polygon by winding number handling vertex hits correctly; tests
  assert agreement with ray casting on non-degenerate cases and correct results on the degenerate
  fixtures where they differ.
- **Senior insight** — ray casting and winding number disagree on self-intersecting polygons, and
  which one is "right" depends on your fill rule. GIS and SVG made opposite choices.

### 16.3 Convex hulls
- **Covers** — gift wrapping (Jarvis) at O(nh), Graham scan with the angular sort, Andrew's monotone
  chain and why it is the practical default, quickhull's expected behaviour, incremental and
  dynamic hulls, collinear-point policy, and hulls in three dimensions at a conceptual level.
- **Demo** — the same point set hulled by all four algorithms with the construction animated and the
  orientation-test count compared; a degenerate set (all collinear, duplicated points) is one click
  away.
- **Diagram** — mermaid diagram of the monotone chain building upper and lower hulls.
- **Lab** — implement monotone chain with an explicit policy for collinear points; tests assert hull
  correctness against a brute-force "is every point inside" oracle on degenerate and random inputs.
- **Senior insight** — "keep or drop collinear points" must be a documented parameter; downstream
  code (area, rotating calipers, rendering) breaks differently depending on the choice.

### 16.4 Sweep-line algorithms
- **Covers** — the sweep paradigm with an event queue and a status structure, Bentley–Ottmann
  segment intersection in O((n + k) log n), closest pair by sweep, rectangle-union area, the
  skyline problem, and the degeneracy handling that dominates the implementation.
- **Demo** — segment-intersection sweep with the sweep line, the event queue and the ordered status
  structure all drawn; intersections are inserted as new events as they are discovered.
- **Diagram** — mermaid diagram of the status structure ordering at a sweep position.
- **Lab** — implement rectangle-union area with a sweep and a coordinate-compressed segment tree;
  tests assert the area matches a fine-grid rasterisation within tolerance and exactly matches a
  brute-force inclusion–exclusion for small inputs.
- **Senior insight** — the sweep is easy and the degeneracies are hard: shared endpoints, vertical
  segments and simultaneous events are where every implementation is judged.

### 16.5 Triangulation
- **Covers** — polygon triangulation by ear clipping and its O(n²), monotone decomposition in
  O(n log n), Delaunay triangulation by incremental insertion with edge flips, the empty-circle
  property, the in-circle predicate, constrained Delaunay, and mesh quality.
- **Demo** — triangulate a drawn polygon by ear clipping with ears highlighted as they are found;
  a Delaunay view shows flips restoring the empty-circle property, with the circumcircle drawn for
  the tested triangle.
- **Diagram** — mermaid diagram of an edge flip and the empty-circle test that triggered it.
- **Lab** — implement the in-circle predicate and the flip loop; tests assert the Delaunay property
  for every triangle against a brute-force circumcircle check.
- **Senior insight** — Delaunay maximises the minimum angle, which is why it is the default mesh for
  interpolation and terrain: skinny triangles are what make interpolated surfaces look wrong.

### 16.6 Voronoi diagrams
- **Covers** — the Voronoi cell definition, duality with Delaunay, Fortune's sweep with the beach
  line and parabolic arcs, site and circle events, unbounded cells and clipping, Lloyd relaxation,
  and applications (nearest facility, coverage, stippling, procedural maps).
- **Demo** — Fortune's algorithm animated with the beach line, the sweep and the emerging edges;
  drag a site and the diagram rebuilds; Lloyd relaxation iterates on demand and the centroidal
  convergence is plotted.
- **Diagram** — mermaid diagram of the beach line with a circle event about to remove an arc.
- **Lab** — implement Voronoi construction by dualising a Delaunay triangulation; tests assert every
  cell contains its site and that cell membership matches a brute-force nearest-site rasterisation.
- **Senior insight** — building Voronoi from Delaunay is dramatically easier than Fortune's sweep
  and is what most libraries do; the sweep is worth understanding, not necessarily implementing.

### 16.7 Boolean operations and clipping
- **Covers** — Sutherland–Hodgman convex clipping and its failure on concave clips,
  Weiler–Atherton, Greiner–Hormann with degeneracy handling, Vatti's scanbeam approach, Minkowski
  sums and their use in motion planning, and offsetting/buffering a polygon.
- **Demo** — two draggable polygons with union, intersection, difference and XOR computed live, the
  intersection points and the traversal order drawn; a degenerate overlap (shared edge) is a preset.
- **Diagram** — mermaid diagram of the entry/exit classification at intersection vertices.
- **Lab** — implement Sutherland–Hodgman and demonstrate its concave failure, then fix the case with
  a convex decomposition of the clip polygon; tests assert areas against a rasterised reference.
- **Senior insight** — shared edges and coincident vertices are the whole difficulty in boolean
  geometry; robust libraries snap coordinates to a grid first, which is a correctness decision
  disguised as a preprocessing step.

### 16.8 Rotating calipers and optimisation on hulls
- **Covers** — the calipers technique, diameter of a point set, width, minimum-area and
  minimum-perimeter enclosing rectangles, closest and farthest pairs on a hull, convex polygon
  intersection, and the smallest enclosing circle by Welzl's randomised algorithm.
- **Demo** — calipers rotating around a hull with the antipodal pairs highlighted and the current
  candidate rectangle drawn; the minimum found is marked with its area.
- **Diagram** — mermaid diagram of antipodal pairs during a caliper rotation.
- **Lab** — implement minimum-area enclosing rectangle via calipers; tests assert the area is at
  most the axis-aligned bounding box and matches a brute-force rotation search within tolerance.
- **Senior insight** — the minimum-area rectangle always has a side flush with a hull edge; that
  single theorem turns a continuous optimisation into an O(n) scan.

### 16.9 Transforms and 3-D geometry
- **Covers** — homogeneous coordinates, affine and projective transforms, composition order and the
  row/column-vector convention trap, rotation representations (matrices, Euler angles, gimbal lock,
  quaternions, slerp), plane and ray intersection, half-space clipping, barycentric coordinates,
  and the projection pipeline.
- **Demo** — transform composer: stack translate/rotate/scale/shear operations and see the matrix,
  the transformed shape and the effect of reordering; a quaternion view interpolates two
  orientations against Euler interpolation to exhibit gimbal lock.
- **Diagram** — mermaid flowchart of the model → view → projection → viewport pipeline.
- **Lab** — implement ray-triangle intersection (Möller–Trumbore) returning barycentric coordinates;
  tests assert hits and misses against an analytic reference including edge-grazing rays.
- **Senior insight** — nearly every "the rotation is wrong" bug is a composition-order or
  convention mismatch, not a maths error; writing the convention in a comment at the top of the
  file is the cheapest fix in graphics.

### 16.10 Applied geometry
- **Covers** — rasterisation (Bresenham lines, scanline polygon fill, anti-aliasing), curve
  flattening for Bézier paths, hit testing with tolerance, path simplification for maps, geodesic
  distance versus planar approximation, projections and their distortions, and collision response
  basics (separating axis theorem).
- **Demo** — a mini renderer: draw shapes and watch Bresenham and scanline fill them pixel by pixel
  with an anti-aliasing toggle; an SAT collision view shows the candidate axes and the separating
  one when it exists.
- **Diagram** — mermaid diagram of SAT projecting two polygons onto a candidate axis.
- **Lab** — implement the separating axis test for convex polygons returning the minimum
  translation vector; tests assert collision agreement with a sampling oracle and that applying the
  MTV separates the shapes.
- **Senior insight** — treating latitude/longitude as planar coordinates is the most common geometry
  bug in application code, and it grows with latitude — correct in the tests written in the office,
  wrong for users at 60°N.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/geometry-core.js` | Vectors, adaptive exact predicates, primitives |
| `src/js/algorithms/polygon.js` | Area, containment, convexity, simplification, self-intersection |
| `src/js/algorithms/convex-hull.js` | Jarvis, Graham, monotone chain, quickhull, dynamic hull |
| `src/js/algorithms/sweep-line.js` | Event queue, status structure, Bentley–Ottmann, rectangle union |
| `src/js/algorithms/triangulation.js` | Ear clipping, monotone decomposition, Delaunay with flips |
| `src/js/algorithms/voronoi.js` | Fortune's sweep and Delaunay dualisation, Lloyd relaxation |
| `src/js/algorithms/clipping.js` | Sutherland–Hodgman, Greiner–Hormann, Minkowski sums |
| `src/js/algorithms/calipers.js` | Diameter, width, enclosing rectangle, Welzl circle |
| `src/js/algorithms/transforms-3d.js` | Matrices, quaternions, projections, ray intersections |
| `src/js/algorithms/raster.js` | Bresenham, scanline fill, anti-aliasing, curve flattening, SAT |
| `src/js/machines/geometry-lab.js` | Scenes, degenerate generators, brute-force oracles |
| `src/js/viz/geometry-view.js` | Canvas scene renderer with construction overlays |

---

## Acceptance criteria

- [ ] `orient2d` and `inCircle` return consistent signs under all argument permutations on the
      adversarial coordinate fixtures; the naive versions demonstrably do not.
- [ ] Every algorithm is run against the degenerate generators (collinear, coincident, duplicate,
      near-collinear) and either handles them or documents and detects them.
- [ ] Hull, triangulation and boolean results are validated against brute-force or rasterised
      oracles within a stated tolerance.
- [ ] Delaunay output satisfies the empty-circle property for every triangle, checked exhaustively
      on inputs up to 200 points.
- [ ] Voronoi cells contain their sites and match a nearest-site rasterisation.
- [ ] The SAT lab's minimum translation vector provably separates the shapes when applied.

---

## Sources

- de Berg, Cheong, van Kreveld, Overmars — *Computational Geometry: Algorithms and Applications*
- Shewchuk — *Adaptive precision floating-point arithmetic and fast robust geometric predicates*
- Andrew — *Another efficient algorithm for convex hulls in two dimensions*
- Bentley, Ottmann — *Algorithms for reporting and counting geometric intersections*
- Fortune — *A sweepline algorithm for Voronoi diagrams*
- Greiner, Hormann — *Efficient clipping of arbitrary polygons*
- Welzl — *Smallest enclosing disks*
- Möller, Trumbore — *Fast, minimum storage ray/triangle intersection*
