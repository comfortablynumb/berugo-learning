/**
 * Voronoi diagrams, two ways, with each checked against the other and both
 * against a brute-force nearest-site grid.
 *
 * The Voronoi cell of a site is every point closer to that site than to any
 * other. That definition is directly constructible: a point is closer to site
 * i than to site j exactly when it lies on i's side of the perpendicular
 * bisector between them, so the cell is the intersection of n − 1 half-planes.
 * `diagram` does exactly that, clipped to a box. It is O(n) clips per cell and
 * O(n²) overall, and it is correct by construction - there is no case analysis
 * to get wrong, and an unbounded cell is bounded by the box for free.
 *
 * `dualCells` is the construction worth learning: the diagram is the exact
 * dual of the Delaunay triangulation, so a cell is the circumcentres of the
 * triangles around its site, in angular order. It is far faster - one
 * triangulation instead of n² clips - and it is what almost every library
 * actually does, which is why Fortune's sweep is worth understanding rather
 * than necessarily implementing.
 *
 * The dual has one case the half-planes do not: a site on the convex hull has
 * an OPEN fan rather than a closed loop, because the two outer edges of its
 * cell run to infinity. Those are emitted as long rays perpendicular to the
 * hull edges and then clipped, which is the whole of the extra work. Seeding
 * the box corners instead - which is the obvious shortcut - gives every hull
 * cell all four corners, and grid points then land in cells they do not
 * belong to: 87 of 900 on the first set this was tried on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Voronoi = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');
  const P = scope && scope.Polygon ? scope.Polygon : require('./polygon.js');
  const T = scope && scope.Triangulation ? scope.Triangulation : require('./triangulation.js');

  function report() {
    return { orient: 0, inCircle: 0, triangles: 0, cells: 0, unbounded: 0,
      clips: 0, gridPoints: 0, misassigned: 0, iterations: 0, movement: 0,
      areaGap: 0 };
  }

  function defaultBounds(sites, pad) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sites.forEach(function (s) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    });
    const margin = pad === undefined ? Math.max(1, (maxX - minX + maxY - minY) / 8) : pad;
    return { x0: minX - margin, y0: minY - margin, x1: maxX + margin, y1: maxY + margin };
  }

  function boxRing(box) {
    return [
      G.point(box.x0, box.y0), G.point(box.x1, box.y0),
      G.point(box.x1, box.y1), G.point(box.x0, box.y1)
    ];
  }

  function boxSpan(box) {
    return Math.max(box.x1 - box.x0, box.y1 - box.y0);
  }

  /* ------------------------------------------- half-plane construction */

  /**
   * How far p sits on the wrong side of the bisector between `keep` and
   * `against`. Negative or zero means p is at least as close to `keep`, so it
   * stays. This is the squared-distance comparison rearranged, so it needs no
   * square root and no normalisation.
   */
  function bisectorValue(p, keep, against) {
    return 2 * (p.x * (against.x - keep.x) + p.y * (against.y - keep.y)) -
      (against.x * against.x + against.y * against.y) +
      (keep.x * keep.x + keep.y * keep.y);
  }

  function clipHalfPlane(ring, keep, against) {
    const out = [];

    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const va = bisectorValue(a, keep, against);
      const vb = bisectorValue(b, keep, against);

      if (va <= 0) out.push(a);
      if ((va <= 0) === (vb <= 0)) continue;
      const t = va / (va - vb);
      out.push(G.point(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)));
    }
    return out;
  }

  /** One cell, as the box cut down by every other site's bisector. */
  function cellByHalfPlanes(sites, index, box, stats) {
    let ring = boxRing(box);
    const site = sites[index];

    for (let j = 0; j < sites.length && ring.length; j += 1) {
      if (j === index) continue;
      if (stats) stats.clips += 1;
      ring = clipHalfPlane(ring, site, sites[j]);
    }
    return ring;
  }

  function dedupeSites(sites) {
    const seen = new Set();
    const out = [];
    sites.forEach(function (s) {
      const id = s.x + ':' + s.y;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(s);
    });
    return out;
  }

  /**
   * The diagram, by half-plane intersection. Correct by construction and the
   * reference the dual is measured against.
   */
  function diagram(sites, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const pts = dedupeSites(sites);
    const box = settings.bounds || defaultBounds(pts, settings.pad);

    const cells = pts.map(function (site, i) {
      const ring = cellByHalfPlanes(pts, i, box, stats);
      const touchesBox = ring.some(function (p) {
        return p.x <= box.x0 + 1e-9 || p.x >= box.x1 - 1e-9 ||
          p.y <= box.y0 + 1e-9 || p.y >= box.y1 - 1e-9;
      });
      if (touchesBox) stats.unbounded += 1;

      return { site: site, index: i, ring: ring, unbounded: touchesBox,
        area: ring.length >= 3 ? P.area(ring) : 0 };
    });

    stats.cells = cells.length;
    return { sites: pts, cells: cells, bounds: box, report: stats };
  }

  /* ------------------------------------------------ the Delaunay dual */

  function edgeId(i, j) {
    return i < j ? i + ':' + j : j + ':' + i;
  }

  /** Edges belonging to one triangle only: the hull of the triangulation. */
  function boundaryEdges(triangles) {
    const counts = new Map();
    triangles.forEach(function (t, ti) {
      [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
        const id = edgeId(e[0], e[1]);
        if (!counts.has(id)) counts.set(id, { count: 0, a: e[0], b: e[1], triangle: ti });
        counts.get(id).count += 1;
      });
    });

    const out = [];
    counts.forEach(function (entry) { if (entry.count === 1) out.push(entry); });
    return out;
  }

  /**
   * The far end of the ray a hull edge sends outward: from the circumcentre of
   * the one triangle on that edge, perpendicular to the edge, in the direction
   * away from the triangle's third vertex.
   */
  function outwardRay(points, edge, triangle, centre, span) {
    const a = points[edge.a];
    const b = points[edge.b];
    const opposite = triangle.find(function (i) { return i !== edge.a && i !== edge.b; });
    const along = G.sub(b, a);
    let normal = G.point(along.y, -along.x);

    const mid = G.point((a.x + b.x) / 2, (a.y + b.y) / 2);
    if (G.dot(normal, G.sub(points[opposite], mid)) > 0) normal = G.scale(normal, -1);

    const len = G.length(normal) || 1;
    return G.add(centre, G.scale(normal, span * 4 / len));
  }

  /**
   * Cells from the Delaunay dual. The taught construction: one cell vertex per
   * incident triangle, plus two rays for a site on the hull.
   */
  function dualCells(sites, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const pts = dedupeSites(sites);
    const box = settings.bounds || defaultBounds(pts, settings.pad);
    const mesh = T.delaunay(pts, { report: stats });
    stats.triangles = mesh.triangles.length;

    const centres = mesh.triangles.map(function (t) {
      return T.circumcentre(mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]]);
    });

    const around = new Map();
    mesh.triangles.forEach(function (t, ti) {
      if (!centres[ti]) return;
      t.forEach(function (i) {
        if (!around.has(i)) around.set(i, []);
        around.get(i).push(centres[ti]);
      });
    });

    const span = boxSpan(box);
    boundaryEdges(mesh.triangles).forEach(function (edge) {
      const centre = centres[edge.triangle];
      if (!centre) return;
      const far = outwardRay(mesh.points, edge, mesh.triangles[edge.triangle], centre, span);
      [edge.a, edge.b].forEach(function (i) {
        if (!around.has(i)) around.set(i, []);
        around.get(i).push(far);
      });
    });

    const cells = mesh.points.map(function (site, i) {
      const fan = around.get(i) || [];
      const ordered = angularSort(unique(fan), site);
      const ring = clipToBox(ordered, box);
      const unbounded = ordered.length !== fan.length ? false : ring.length !== ordered.length;
      if (unbounded) stats.unbounded += 1;

      return { site: site, index: i, ring: ring, unbounded: unbounded,
        area: ring.length >= 3 ? P.area(ring) : 0 };
    });

    stats.cells = cells.length;
    return { sites: mesh.points, cells: cells, bounds: box, mesh: mesh, report: stats };
  }

  function clipToBox(ring, box) {
    const sides = [
      { inside: function (p) { return p.x >= box.x0; }, cut: function (a, b) { return atX(a, b, box.x0); } },
      { inside: function (p) { return p.x <= box.x1; }, cut: function (a, b) { return atX(a, b, box.x1); } },
      { inside: function (p) { return p.y >= box.y0; }, cut: function (a, b) { return atY(a, b, box.y0); } },
      { inside: function (p) { return p.y <= box.y1; }, cut: function (a, b) { return atY(a, b, box.y1); } }
    ];

    let output = ring;
    sides.forEach(function (side) {
      if (!output.length) return;
      output = clipAgainst(output, side.inside, side.cut);
    });
    return output;
  }

  function clipAgainst(ring, inside, cut) {
    const out = [];
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(cut(a, b));
    }
    return out;
  }

  function atX(a, b, x) {
    const t = (x - a.x) / (b.x - a.x);
    return G.point(x, a.y + t * (b.y - a.y));
  }

  function atY(a, b, y) {
    const t = (y - a.y) / (b.y - a.y);
    return G.point(a.x + t * (b.x - a.x), y);
  }

  function unique(points) {
    const seen = new Set();
    const out = [];
    points.forEach(function (p) {
      const id = p.x.toFixed(9) + ':' + p.y.toFixed(9);
      if (seen.has(id)) return;
      seen.add(id);
      out.push(p);
    });
    return out;
  }

  function angularSort(points, centre) {
    return points.slice().sort(function (a, b) {
      return Math.atan2(a.y - centre.y, a.x - centre.x) -
        Math.atan2(b.y - centre.y, b.x - centre.x);
    });
  }

  /* ------------------------------------------------------- the oracle */

  function nearestSiteGrid(sites, box, steps, stats) {
    const grid = [];

    for (let iy = 0; iy < steps; iy += 1) {
      for (let ix = 0; ix < steps; ix += 1) {
        const p = G.point(
          box.x0 + (ix + 0.5) * (box.x1 - box.x0) / steps,
          box.y0 + (iy + 0.5) * (box.y1 - box.y0) / steps
        );
        let best = 0;
        let bestD = Infinity;

        sites.forEach(function (s, i) {
          const d = G.distance2(s, p);
          if (d >= bestD) return;
          bestD = d;
          best = i;
        });
        if (stats) stats.gridPoints += 1;
        grid.push({ point: p, site: best });
      }
    }
    return grid;
  }

  /**
   * Every cell must contain its own site, and every grid point must fall in
   * the cell of the site nearest to it.
   */
  function verify(built, steps) {
    const stats = built.report || report();
    const grid = nearestSiteGrid(built.sites, built.bounds, steps || 40, stats);
    let siteOutside = 0;
    let misassigned = 0;

    built.cells.forEach(function (cell) {
      if (cell.ring.length < 3) { siteOutside += 1; return; }
      if (P.contains(cell.ring, cell.site).winding === P.OUT) siteOutside += 1;
    });

    grid.forEach(function (g) {
      const cell = built.cells[g.site];
      if (!cell || cell.ring.length < 3) { misassigned += 1; return; }
      if (P.contains(cell.ring, g.point).winding === P.OUT) misassigned += 1;
    });

    stats.misassigned = misassigned;
    return { ok: siteOutside === 0 && misassigned === 0, siteOutside: siteOutside,
      misassigned: misassigned, gridPoints: grid.length, grid: grid };
  }

  /** How closely the dual reproduces the half-plane diagram, cell by cell. */
  function compareConstructions(sites, options) {
    const settings = options || {};
    const box = settings.bounds || defaultBounds(dedupeSites(sites), settings.pad);
    const exact = diagram(sites, { bounds: box });
    const dual = dualCells(sites, { bounds: box });
    let worst = 0;
    let total = 0;

    exact.cells.forEach(function (cell, i) {
      const other = dual.cells[i];
      const gap = Math.abs(cell.area - (other ? other.area : 0));
      total += gap;
      worst = Math.max(worst, gap);
    });

    const area = exact.cells.reduce(function (s, c) { return s + c.area; }, 0);
    return { exact: exact, dual: dual, worstGap: worst, totalGap: total,
      relative: area > 0 ? total / area : 0, bounds: box };
  }

  /**
   * Lloyd relaxation: move every site to the centroid of its own cell and
   * rebuild. It converges to a centroidal diagram - cells of roughly equal
   * size and roundness - which is what turns a random point set into an even
   * one for stippling, meshing and procedural maps.
   */
  function lloyd(sites, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const rounds = settings.rounds === undefined ? 1 : settings.rounds;
    const box = settings.bounds || defaultBounds(dedupeSites(sites), settings.pad);
    let current = dedupeSites(sites);
    const history = [];

    for (let round = 0; round < rounds; round += 1) {
      const built = diagram(current, { bounds: box, report: stats });
      let moved = 0;

      const next = built.cells.map(function (cell) {
        if (cell.ring.length < 3) return cell.site;
        const centre = P.centroid(cell.ring);
        if (!centre) return cell.site;
        moved += G.distance(cell.site, centre);
        return centre;
      });

      stats.iterations += 1;
      stats.movement = moved;
      history.push({ round: round + 1, movement: moved, spread: areaSpread(built.cells).spread });
      current = next;
    }
    return { sites: current, history: history, bounds: box, report: stats };
  }

  /** How evenly the cells are sized - the number Lloyd drives down. */
  function areaSpread(cells) {
    const areas = cells.map(function (c) { return c.area; }).filter(function (a) { return a > 0; });
    if (!areas.length) return { mean: 0, spread: 0, ratio: 0 };
    const mean = areas.reduce(function (s, a) { return s + a; }, 0) / areas.length;
    const variance = areas.reduce(function (s, a) { return s + (a - mean) * (a - mean); }, 0) / areas.length;

    return { mean: mean, spread: Math.sqrt(variance) / mean,
      ratio: Math.max.apply(null, areas) / Math.min.apply(null, areas) };
  }

  return {
    report: report,
    defaultBounds: defaultBounds,
    boxRing: boxRing,
    bisectorValue: bisectorValue,
    clipHalfPlane: clipHalfPlane,
    clipToBox: clipToBox,
    diagram: diagram,
    dualCells: dualCells,
    nearestSiteGrid: nearestSiteGrid,
    verify: verify,
    compareConstructions: compareConstructions,
    lloyd: lloyd,
    areaSpread: areaSpread
  };
}));
