/**
 * Four convex hull algorithms behind one interface, plus the oracle that
 * checks them.
 *
 * Every one takes `(points, options)` and returns `{ hull, report }`, where
 * the report counts ORIENTATION TESTS rather than milliseconds. That is the
 * operation each algorithm is trying to avoid, it is deterministic, and it is
 * the only currency in which gift wrapping at O(nh) and monotone chain at
 * O(n log n) can be compared honestly.
 *
 * `options.collinear` is the parameter this file exists to make explicit. With
 * 'drop' (the default) a point lying exactly on a hull edge is discarded; with
 * 'keep' it stays. Neither is wrong and both break something downstream: drop
 * and the hull has the fewest vertices but loses points a caller may have
 * needed to see; keep and the hull is no longer strictly convex, so rotating
 * calipers can pick two adjacent collinear vertices as an antipodal pair and
 * a renderer can emit a zero-area triangle. The failure is always in the
 * OTHER file, which is why the policy has to be documented here rather than
 * discovered there.
 *
 * The policy is applied ONCE, after the strict hull, rather than inside each
 * algorithm's inner loop. Leaving it to the loops is what an earlier version
 * did, and the four then disagreed about what 'keep' meant: on ten collinear
 * points monotone chain returned eighteen vertices (it walked the line out and
 * back), gift wrapping and Graham returned ten, and quickhull ignored the
 * option entirely and returned two. A parameter the caller is told to document
 * has to mean the same thing in all four, so it is one shared pass now, and
 * the algorithms are asked only for the strict hull they all agree on.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConvexHull = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');

  const DROP = 'drop';
  const KEEP = 'keep';

  function report() {
    return { orient: 0, orientExact: 0, comparisons: 0, sorted: 0, algorithm: '' };
  }

  function settings(options) {
    const given = options || {};
    return {
      collinear: given.collinear === KEEP ? KEEP : DROP,
      report: given.report || report()
    };
  }

  /** Lexicographic by x then y, which is the order both chain algorithms need. */
  function byPosition(a, b) {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  }

  function sorted(points, stats) {
    const copy = points.slice();
    copy.sort(function (a, b) {
      if (stats) stats.comparisons += 1;
      return byPosition(a, b);
    });
    if (stats) stats.sorted = copy.length;
    return copy;
  }

  function dedupe(points) {
    const seen = new Set();
    const out = [];

    points.forEach(function (p) {
      const key = p.x + ':' + p.y;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(p);
    });
    return out;
  }

  /* The chains always build the STRICT hull: a collinear turn pops. Keeping
     collinear points is a separate pass, so that all four algorithms mean the
     same thing by it. */
  function popsChain(turn) {
    return turn <= 0;
  }

  /**
   * The one place `collinear: 'keep'` is honoured. For each hull edge, any
   * input point lying strictly between its endpoints is re-inserted, ordered
   * along the edge. Applied to the strict hull, it gives every algorithm the
   * identical answer - including quickhull, whose recursion discards collinear
   * points by construction and could not honour the option from the inside.
   */
  function applyCollinearPolicy(hull, points, config) {
    if (config.collinear !== KEEP || hull.length < 2) return hull;
    const stats = config.report;

    /* A hull of two vertices means every input point is collinear, so there is
       no interior and no second side to come back along. Walking the edge both
       ways would list each interior point twice; the honest answer is the
       points once, in order along the segment. */
    if (hull.length === 2) return alongEdge(hull[0], hull[1], points, stats, true);

    const out = [];
    for (let i = 0; i < hull.length; i += 1) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      out.push(a);
      alongEdge(a, b, points, stats, false).forEach(function (p) { out.push(p); });
    }
    return out;
  }

  /** The input points strictly between a and b, ordered from a. */
  function alongEdge(a, b, points, stats, withEnds) {
    const between = points.filter(function (p) {
      if (G.equal(p, a) || G.equal(p, b)) return false;
      return G.onSegment(a, b, p, stats);
    });
    between.sort(function (p, q) { return G.distance2(a, p) - G.distance2(a, q); });
    return withEnds ? [a].concat(between, [b]) : between;
  }

  /**
   * Every algorithm returns counter-clockwise. Quickhull naturally builds the
   * other way round - left, above, right, below is clockwise - and a caller
   * given two hulls with opposite winding gets a negative area from one of
   * them and a reflex-vertex complaint from the oracle. One shared interface
   * has to include the direction of travel.
   */
  function finish(hull, points, config) {
    let ring = hull;
    if (ring.length >= 3) {
      let twice = 0;
      for (let i = 0; i < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        twice += a.x * b.y - b.x * a.y;
      }
      if (twice < 0) ring = ring.slice().reverse();
    }
    return applyCollinearPolicy(stripCollinear(ring, config), points, config);
  }

  /**
   * Under 'drop', no vertex may be collinear with its two neighbours.
   *
   * The chains guarantee that already; quickhull does not. When several points
   * are the same distance from the base line - which is what a flat top edge
   * means - its "farthest point" test has a tie, and whichever it happens to
   * pick becomes a hull vertex with two neighbours it is collinear with. So
   * the policy is enforced here rather than trusted, and the four algorithms
   * agree by construction rather than by luck.
   */
  function stripCollinear(ring, config) {
    if (config.collinear === KEEP || ring.length < 3) return ring;
    const stats = config.report;
    let out = ring;
    let changed = true;

    while (changed && out.length > 2) {
      changed = false;
      const kept = out.filter(function (p, i) {
        const before = out[(i - 1 + out.length) % out.length];
        const after = out[(i + 1) % out.length];
        if (G.orient2d(before, p, after, stats) !== 0) return true;
        changed = true;
        return false;
      });
      out = kept;
    }
    return out;
  }

  /**
   * Andrew's monotone chain: sort once, then sweep the lower hull left to
   * right and the upper hull right to left. The practical default - no angular
   * sort, no trigonometry, no special case for the starting point, and the
   * only floating-point comparison is inside the orientation predicate.
   */
  function monotoneChain(points, options) {
    const config = settings(options);
    const stats = config.report;
    stats.algorithm = 'monotone chain';
    const pts = sorted(dedupe(points), stats);
    if (pts.length < 3) return { hull: pts, report: stats };

    function build(list) {
      const chain = [];
      list.forEach(function (p) {
        while (chain.length >= 2) {
          const turn = G.orient2d(chain[chain.length - 2], chain[chain.length - 1], p, stats);
          if (!popsChain(turn)) break;
          chain.pop();
        }
        chain.push(p);
      });
      return chain;
    }

    const lower = build(pts);
    const upper = build(pts.slice().reverse());
    const strict = lower.slice(0, -1).concat(upper.slice(0, -1));
    return { hull: finish(strict, pts, config), report: stats };
  }

  /**
   * Gift wrapping: from the leftmost point, repeatedly find the point that
   * every other point is to the left of. O(n) per hull vertex, so O(nh) in
   * total - which beats an n log n sort when the hull is tiny and is
   * catastrophic when every point is on it.
   */
  function giftWrapping(points, options) {
    const config = settings(options);
    const stats = config.report;
    stats.algorithm = 'gift wrapping';
    const pts = dedupe(points);
    if (pts.length < 3) return { hull: pts.slice(), report: stats };

    let start = 0;
    for (let i = 1; i < pts.length; i += 1) {
      if (byPosition(pts[i], pts[start]) < 0) start = i;
    }

    const hull = [];
    let current = start;
    const guard = pts.length + 1;

    do {
      hull.push(pts[current]);
      let next = (current + 1) % pts.length;

      for (let i = 0; i < pts.length; i += 1) {
        if (i === current || i === next) continue;
        const turn = G.orient2d(pts[current], pts[next], pts[i], stats);
        if (turn < 0) { next = i; continue; }
        if (turn !== 0) continue;
        if (G.distance2(pts[current], pts[i]) > G.distance2(pts[current], pts[next])) next = i;
      }
      current = next;
    } while (current !== start && hull.length <= guard);

    return { hull: finish(hull, pts, config), report: stats };
  }

  function angularOrder(pivot, stats) {
    return function (a, b) {
      if (stats) stats.comparisons += 1;
      const turn = G.orient2d(pivot, a, b, stats);
      if (turn !== 0) return -turn;
      return G.distance2(pivot, a) - G.distance2(pivot, b);
    };
  }

  /**
   * Graham scan: pick the lowest point, sort the rest by angle around it, then
   * walk once popping right turns. Same bound as monotone chain and a harder
   * sort - the comparator calls the orientation predicate, so a wrong
   * predicate makes the SORT inconsistent, which is how this one crashes
   * rather than merely producing a wrong hull.
   */
  function grahamScan(points, options) {
    const config = settings(options);
    const stats = config.report;
    stats.algorithm = 'graham scan';
    const pts = dedupe(points);
    if (pts.length < 3) return { hull: pts.slice(), report: stats };

    let pivot = pts[0];
    pts.forEach(function (p) {
      if (p.y < pivot.y || (p.y === pivot.y && p.x < pivot.x)) pivot = p;
    });

    const rest = pts.filter(function (p) { return p !== pivot; });
    rest.sort(angularOrder(pivot, stats));
    stats.sorted = rest.length;

    const hull = [pivot];
    rest.forEach(function (p) {
      while (hull.length >= 2) {
        const turn = G.orient2d(hull[hull.length - 2], hull[hull.length - 1], p, stats);
        if (!popsChain(turn)) break;
        hull.pop();
      }
      hull.push(p);
    });
    return { hull: finish(hull, pts, config), report: stats };
  }

  /**
   * The point furthest from the line a-b, on the left of it.
   *
   * Two things here are easy to get wrong and both were.
   *
   * Whether a point is outside at all is decided by the ADAPTIVE predicate,
   * never by the raw determinant. Ranking by the raw value alone is fine on
   * integer coordinates, where it happens to be exact, and wrong on points a
   * few units in the last place apart: a point that is genuinely inside can
   * carry a tiny positive value, become the apex, and put a reflex vertex on
   * the hull. On a 60-point near-collinear zigzag that produced a hull with
   * five of the input points outside it.
   *
   * Among the points that ARE outside, the raw value ranks them - it is a
   * magnitude and only its ordering is needed. Ties, which is what a flat edge
   * produces, are broken along the base direction so a real corner wins rather
   * than whichever point came first in the array.
   */
  function farthestFrom(a, b, pts, stats) {
    let best = null;
    let bestAlong = 0;
    const along = G.sub(b, a);

    pts.forEach(function (p) {
      if (G.orient2d(a, b, p, stats) <= 0) return;
      const reach = G.dot(along, G.sub(p, a));
      if (best === null) { best = p; bestAlong = reach; return; }

      const further = G.fartherFromLine(a, b, p, best, stats);
      if (further < 0) return;
      if (further === 0 && reach <= bestAlong) return;
      best = p;
      bestAlong = reach;
    });
    return best;
  }

  function quickhullSide(a, b, pts, stats, out) {
    if (!pts.length) return;
    const apex = farthestFrom(a, b, pts, stats);
    if (!apex) return;

    const left = pts.filter(function (p) { return G.orient2d(a, apex, p, stats) > 0; });
    const right = pts.filter(function (p) { return G.orient2d(apex, b, p, stats) > 0; });

    quickhullSide(a, apex, left, stats, out);
    out.push(apex);
    quickhullSide(apex, b, right, stats, out);
  }

  /**
   * Quickhull: split on the extreme points, recurse on what is outside each
   * edge. Expected O(n log n) and O(n²) when the recursion never discards
   * much - the same shape of bet quicksort makes, and it fails on the same
   * kind of input.
   */
  function quickhull(points, options) {
    const config = settings(options);
    const stats = config.report;
    stats.algorithm = 'quickhull';
    const pts = dedupe(points);
    if (pts.length < 3) return { hull: pts.slice(), report: stats };

    let left = pts[0];
    let right = pts[0];
    pts.forEach(function (p) {
      if (byPosition(p, left) < 0) left = p;
      if (byPosition(p, right) > 0) right = p;
    });

    const above = pts.filter(function (p) { return G.orient2d(left, right, p, stats) > 0; });
    const below = pts.filter(function (p) { return G.orient2d(right, left, p, stats) > 0; });

    const hull = [left];
    quickhullSide(left, right, above, stats, hull);
    hull.push(right);
    quickhullSide(right, left, below, stats, hull);
    return { hull: finish(hull, pts, config), report: stats };
  }

  /**
   * The oracle: is every input point inside or on the reported hull, and is
   * the hull itself convex and counter-clockwise? Quadratic, independent of
   * every algorithm above, and the reason their agreement means anything.
   */
  function verify(points, hull, stats) {
    const problems = [];

    /* A hull of fewer than three vertices is CORRECT when the input has no
       interior - every point on one line, or all points equal. Judging that a
       failure is an oracle bug, and it reported four on a sixty-point
       collinear set that every algorithm had handled properly. */
    if (hull.length < 3) {
      const flat = points.every(function (p) {
        return hull.length < 2 || G.orient2d(hull[0], hull[hull.length - 1], p, stats) === 0;
      });
      if (!flat) problems.push('the hull is degenerate but the points are not collinear');
      return { ok: flat, problems: problems, outside: 0, degenerate: true };
    }

    for (let i = 0; i < hull.length; i += 1) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      const c = hull[(i + 2) % hull.length];
      if (G.orient2d(a, b, c, stats) < 0) problems.push('reflex vertex at ' + ((i + 1) % hull.length));
    }

    let outside = 0;
    points.forEach(function (p) {
      for (let i = 0; i < hull.length; i += 1) {
        if (G.orient2d(hull[i], hull[(i + 1) % hull.length], p, stats) < 0) { outside += 1; return; }
      }
    });
    if (outside) problems.push(outside + ' input points fall outside the hull');

    return { ok: problems.length === 0, problems: problems, outside: outside };
  }

  const ALGORITHMS = {
    'monotone-chain': monotoneChain,
    'gift-wrapping': giftWrapping,
    'graham-scan': grahamScan,
    quickhull: quickhull
  };

  function run(name, points, options) {
    const fn = ALGORITHMS[name];
    if (!fn) throw new Error('unknown hull algorithm: ' + name);
    return fn(points, options);
  }

  return {
    DROP: DROP,
    KEEP: KEEP,
    report: report,
    names: function () { return Object.keys(ALGORITHMS); },
    run: run,
    monotoneChain: monotoneChain,
    giftWrapping: giftWrapping,
    grahamScan: grahamScan,
    quickhull: quickhull,
    verify: verify
  };
}));
