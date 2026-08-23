/**
 * GeometryLab - the harness every M16 section drives.
 *
 * Two jobs. The first is scenes: seeded point sets, polygons and segment sets
 * that every section can name, so a figure quoted in one section is
 * reproducible in another and in the test suite. The second, and the one that
 * matters, is DEGENERATE INPUT. Geometry code is not judged on random points;
 * it is judged on collinear runs, coincident points, shared endpoints and
 * coordinates that are nearly but not quite equal - and every generator here
 * exists so a section can put an algorithm on one of those and show what
 * happens.
 *
 * Every comparison reports disagreement as a FIELD rather than throwing. An
 * algorithm that gets most of the answer right is the normal failure in this
 * subject, and a work count beside a wrong answer is worse than no count.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GeometryLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        G: require('../algorithms/geometry-core.js'),
        Exact: require('../algorithms/geometry-exact.js'),
        Poly: require('../algorithms/polygon.js'),
        Hull: require('../algorithms/convex-hull.js'),
        Sweep: require('../algorithms/sweep-line.js'),
        Tri: require('../algorithms/triangulation.js'),
        Vor: require('../algorithms/voronoi.js'),
        Clip: require('../algorithms/clipping.js'),
        Cal: require('../algorithms/calipers.js'),
        Raster: require('../algorithms/raster.js'),
        Random: require('../utils/random.js')
      };
    }
    return { G: scope.GeometryCore, Exact: scope.GeometryExact, Poly: scope.Polygon,
      Hull: scope.ConvexHull, Sweep: scope.SweepLine, Tri: scope.Triangulation,
      Vor: scope.Voronoi, Clip: scope.Clipping, Cal: scope.Calipers,
      Raster: scope.Raster, Random: scope.Random };
  }

  const SCENES = ['uniform', 'clustered', 'circle', 'grid', 'collinear',
    'coincident', 'near-collinear', 'convex-heavy'];

  function generator(seed) {
    const M = modules();
    return M.Random.seeded(seed === undefined ? 12345 : seed);
  }

  /* --------------------------------------------------------- scenes */

  /**
   * A named point set. The degenerate ones are the point: 'collinear' puts
   * every point on one line, 'coincident' repeats points, and 'near-collinear'
   * offsets them by a single unit in the last place - which is the input that
   * separates a robust predicate from one that merely looks careful.
   */
  function points(scene, count, seed) {
    const M = modules();
    const rng = generator(seed);
    const n = Math.max(3, count || 40);
    const out = [];

    if (scene === 'collinear') {
      for (let i = 0; i < n; i += 1) out.push(M.G.point(i * 3, i * 3));
      return out;
    }
    if (scene === 'coincident') {
      for (let i = 0; i < n; i += 1) {
        const k = Math.floor(i / 3);
        out.push(M.G.point(k * 7 % 60, (k * 13) % 60));
      }
      return out;
    }
    if (scene === 'near-collinear') {
      for (let i = 0; i < n; i += 1) {
        const x = 0.5 + i * 0.25;
        const y = 0.5 + i * 0.25;
        out.push(M.G.point(x, y + (i % 2 ? 1 : -1) * y * Math.pow(2, -52)));
      }
      return out;
    }
    if (scene === 'circle') {
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        out.push(M.G.point(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)));
      }
      return out;
    }
    if (scene === 'grid') {
      const side = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i += 1) {
        out.push(M.G.point((i % side) * 10, Math.floor(i / side) * 10));
      }
      return out;
    }
    if (scene === 'clustered') {
      for (let i = 0; i < n; i += 1) {
        const cx = 20 + 60 * Math.floor(rng.next() * 3) / 2;
        const cy = 20 + 60 * Math.floor(rng.next() * 3) / 2;
        out.push(M.G.point(cx + rng.next() * 12 - 6, cy + rng.next() * 12 - 6));
      }
      return out;
    }
    if (scene === 'convex-heavy') {
      for (let i = 0; i < n; i += 1) {
        const a = rng.next() * Math.PI * 2;
        const r = 45 * Math.sqrt(0.85 + rng.next() * 0.15);
        out.push(M.G.point(50 + r * Math.cos(a), 50 + r * Math.sin(a)));
      }
      return out;
    }
    for (let i = 0; i < n; i += 1) {
      out.push(M.G.point(Math.round(rng.next() * 1000) / 10, Math.round(rng.next() * 1000) / 10));
    }
    return out;
  }

  const POLYGONS = {
    square: [[10, 10], [90, 10], [90, 90], [10, 90]],
    'l-shape': [[10, 10], [90, 10], [90, 45], [45, 45], [45, 90], [10, 90]],
    comb: [[5, 5], [95, 5], [95, 70], [75, 70], [75, 25], [55, 25], [55, 70],
      [35, 70], [35, 25], [15, 25], [15, 70], [5, 70]],
    chevron: [[10, 10], [90, 10], [50, 50], [90, 90], [10, 90]],
    star: [[50, 95], [61, 61], [95, 50], [61, 39], [50, 5], [39, 39], [5, 50], [39, 61]],
    pentagram: [[50, 95], [21, 5], [97, 60], [3, 60], [79, 5]],
    bowtie: [[10, 10], [90, 90], [90, 10], [10, 90]],
    spiky: [[10, 10], [50, 12], [90, 10], [88, 50], [90, 90], [50, 88], [10, 90], [12, 50]]
  };

  function polygon(name) {
    const M = modules();
    const raw = POLYGONS[name] || POLYGONS.square;
    return raw.map(function (p) { return M.G.point(p[0], p[1]); });
  }

  function polygonNames() {
    return Object.keys(POLYGONS);
  }

  /**
   * Segment sets, including the four degeneracies a sweep is judged on:
   * shared endpoints, vertical segments, three segments through one point, and
   * a collinear overlap.
   */
  function segments(scene, count, seed) {
    const M = modules();
    const rng = generator(seed);
    const seg = function (x1, y1, x2, y2) {
      return { a: M.G.point(x1, y1), b: M.G.point(x2, y2) };
    };

    if (scene === 'shared-endpoints') {
      return [seg(10, 10, 50, 50), seg(50, 50, 90, 10), seg(50, 50, 50, 90)];
    }
    if (scene === 'vertical') {
      return [seg(30, 0, 30, 90), seg(60, 0, 60, 90), seg(0, 45, 90, 45), seg(0, 20, 90, 70)];
    }
    if (scene === 'three-through-one') {
      return [seg(0, 0, 90, 90), seg(0, 90, 90, 0), seg(45, 0, 45, 90)];
    }
    if (scene === 'collinear-overlap') {
      return [seg(10, 40, 60, 40), seg(40, 40, 90, 40), seg(20, 10, 20, 80)];
    }
    if (scene === 'grid') {
      const out = [];
      const lines = Math.max(2, Math.round(Math.sqrt(count || 8)));
      for (let i = 0; i < lines; i += 1) {
        const at = 10 + i * (80 / Math.max(1, lines - 1));
        out.push(seg(0, at, 90, at));
        out.push(seg(at, 0, at, 90));
      }
      return out;
    }
    if (scene === 'sparse') {
      const out = [];
      for (let i = 0; i < (count || 10); i += 1) out.push(seg(0, i * 6, 90, i * 6 + 2));
      return out;
    }

    const out = [];
    for (let i = 0; i < (count || 12); i += 1) {
      out.push(seg(Math.round(rng.next() * 90), Math.round(rng.next() * 90),
        Math.round(rng.next() * 90), Math.round(rng.next() * 90)));
    }
    return out;
  }

  function segmentScenes() {
    return ['random', 'shared-endpoints', 'vertical', 'three-through-one',
      'collinear-overlap', 'grid', 'sparse'];
  }

  /* ------------------------------------------------------ predicates */

  /**
   * The whole of 16.1 in one call: run a triple through every permutation with
   * each predicate and report whether the answers are self-consistent.
   *
   * Consistency is not "the same answer six times". Swapping two arguments
   * must FLIP the sign, so the three even permutations must agree with each
   * other, the three odd ones must agree with each other, and the two groups
   * must be opposite. Anything else is a contradiction rather than an
   * inaccuracy.
   */
  function permutationCheck(a, b, c) {
    const M = modules();
    const even = [[a, b, c], [b, c, a], [c, a, b]];
    const odd = [[a, c, b], [c, b, a], [b, a, c]];

    function run(fn) {
      const e = even.map(function (t) { return fn(t[0], t[1], t[2]); });
      const o = odd.map(function (t) { return fn(t[0], t[1], t[2]); });
      const consistent = e[0] === e[1] && e[1] === e[2] &&
        o[0] === o[1] && o[1] === o[2] && e[0] === -o[0];
      return { even: e, odd: o, consistent: consistent };
    }

    return {
      naive: run(M.G.orient2dNaive),
      epsilon: run(function (p, q, r) { return M.G.orient2dEpsilon(p, q, r); }),
      adaptive: run(function (p, q, r) { return M.G.orient2d(p, q, r); }),
      value: M.G.orient2dValue(a, b, c)
    };
  }

  /**
   * A sweep over a family of near-collinear triples, counting how often each
   * predicate contradicts itself. This is the measurement 16.1 quotes.
   */
  function robustnessSweep(trials, seed) {
    const M = modules();
    const rng = generator(seed);
    const n = trials || 2000;
    const counts = { trials: n, naive: 0, epsilon: 0, adaptive: 0, escalations: 0,
      naiveWrong: 0, epsilonWrong: 0, epsilonFlattened: 0 };
    const stats = M.G.report();

    for (let i = 0; i < n; i += 1) {
      const ax = rng.next(), ay = rng.next();
      const dx = rng.next() * 2 - 1, dy = rng.next() * 2 - 1;
      const t = rng.next() * 10, s = rng.next() * 10;
      const a = M.G.point(ax, ay);
      const b = M.G.point(ax + dx * t, ay + dy * t);
      const baseY = ay + dy * s;
      const c = M.G.point(ax + dx * s,
        baseY + (rng.next() < 0.5 ? 1 : -1) * Math.abs(baseY) * Math.pow(2, -52));

      const checked = permutationCheck(a, b, c);
      if (!checked.naive.consistent) counts.naive += 1;
      if (!checked.epsilon.consistent) counts.epsilon += 1;
      if (!checked.adaptive.consistent) counts.adaptive += 1;

      /* Consistency is not correctness, and the epsilon comparison is the
         reason to measure both. It is almost perfectly SELF-CONSISTENT on
         these inputs, because it answers "collinear" for all of them - and
         they are not collinear. It has traded contradictions for a different
         failure: a hull built on it silently drops real vertices. */
      const truth = M.G.orient2d(a, b, c, stats);
      if (checked.naive.even[0] !== truth) counts.naiveWrong += 1;
      if (checked.epsilon.even[0] !== truth) counts.epsilonWrong += 1;
      if (checked.epsilon.even[0] === 0 && truth !== 0) counts.epsilonFlattened += 1;
    }
    counts.escalations = stats.orientExact;
    return counts;
  }

  /** How often the filter has to escalate on ordinary, non-degenerate data. */
  function escalationRate(trials, seed) {
    const M = modules();
    const rng = generator(seed);
    const stats = M.G.report();
    const n = trials || 5000;

    for (let i = 0; i < n; i += 1) {
      M.G.orient2d(M.G.point(rng.next(), rng.next()), M.G.point(rng.next(), rng.next()),
        M.G.point(rng.next(), rng.next()), stats);
    }
    return { calls: stats.orient, exact: stats.orientExact,
      rate: stats.orient ? stats.orientExact / stats.orient : 0 };
  }

  /* ----------------------------------------------------------- hulls */

  /** Every hull algorithm on one point set, with the oracle's verdict. */
  function compareHulls(pts, collinear) {
    const M = modules();
    const policy = collinear === 'keep' ? M.Hull.KEEP : M.Hull.DROP;

    const rows = M.Hull.names().map(function (name) {
      const stats = M.Hull.report();
      const built = M.Hull.run(name, pts, { collinear: policy, report: stats });
      const check = M.Hull.verify(pts, built.hull);
      return { name: name, hull: built.hull, vertices: built.hull.length,
        orient: stats.orient, exact: stats.orientExact, comparisons: stats.comparisons,
        ok: check.ok, problems: check.problems };
    });

    const shapes = new Set(rows.map(function (r) { return canonical(r.hull); }));
    return { rows: rows, agree: shapes.size <= 1, disagreements: Math.max(0, shapes.size - 1) };
  }

  function canonical(hull) {
    if (!hull.length) return '';
    let at = 0;
    hull.forEach(function (p, i) {
      if (p.x < hull[at].x || (p.x === hull[at].x && p.y < hull[at].y)) at = i;
    });
    return hull.slice(at).concat(hull.slice(0, at))
      .map(function (p) { return p.x + ',' + p.y; }).join(' ');
  }

  /* ----------------------------------------------------- containment */

  /** Both containment tests on a set of probes, with the disagreements found. */
  function containmentProbe(ring, probes) {
    const M = modules();
    const rows = probes.map(function (p) {
      const r = M.Poly.contains(ring, p);
      return { point: p, ray: r.ray, winding: r.winding, crossings: r.crossings,
        windingCount: r.windingCount, agree: r.agree };
    });
    return { rows: rows, disagreements: rows.filter(function (r) { return !r.agree; }).length };
  }

  return {
    SCENES: SCENES,
    modules: modules,
    points: points,
    polygon: polygon,
    polygonNames: polygonNames,
    segments: segments,
    segmentScenes: segmentScenes,
    permutationCheck: permutationCheck,
    robustnessSweep: robustnessSweep,
    escalationRate: escalationRate,
    compareHulls: compareHulls,
    canonical: canonical,
    containmentProbe: containmentProbe
  };
}));
