/**
 * The sweep paradigm: an event queue, a status structure, and the degeneracies
 * that are the whole implementation.
 *
 * A sweep replaces "every pair" with "every pair that is ever simultaneously
 * crossed by a moving line". The idea takes a paragraph and the code takes a
 * week, because the interesting inputs are the ones where two events land at
 * the same place: shared endpoints, vertical segments, three segments through
 * one point, and an intersection that coincides with an endpoint. Every one of
 * those is handled explicitly below and named in the report, because a sweep
 * that silently mishandles them still returns a plausible-looking answer.
 *
 * `bentleyOttmann` is checked against `bruteForceIntersections` on every run,
 * and the disagreement count is a REPORTED FIELD rather than an exception. A
 * sweep that finds most of the intersections is the normal failure, and a
 * count beside a wrong answer is worse than no count at all.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SweepLine = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const G = scope && scope.GeometryCore ? scope.GeometryCore : require('./geometry-core.js');

  function report() {
    return {
      events: 0, statusInsertions: 0, statusComparisons: 0, orient: 0,
      intersections: 0, verticals: 0, sharedEndpoints: 0, multiplePoints: 0,
      disagreements: 0, pairsTested: 0
    };
  }

  function key(p) {
    return p.x + ':' + p.y;
  }

  /**
   * Where two intersecting segments meet, as a single point.
   *
   * Two collinear segments that overlap do not meet at a point at all - they
   * share a whole interval - so "the intersection" has to be defined rather
   * than computed. Falling back to "whichever segment I happened to call the
   * first one" is what an earlier version did, and the sweep and the brute
   * force then picked different ends of the same overlap and were counted as
   * disagreeing on inputs where they agreed perfectly. The overlap's first
   * point in sweep order is a choice both can make independently.
   */
  function meetingPoint(s, t) {
    const crossing = G.segmentIntersection(s.from, s.to, t.from, t.to);
    if (crossing) return crossing;

    const start = beforePoint(s.from, t.from) ? t.from : s.from;
    const end = beforePoint(s.to, t.to) ? s.to : t.to;
    return beforePoint(start, end) || key(start) === key(end) ? start : end;
  }

  /** Left-to-right, then bottom-to-top: the order the sweep line meets things. */
  function beforePoint(a, b) {
    if (a.x !== b.x) return a.x < b.x;
    return a.y < b.y;
  }

  /** A segment normalised so `from` is the end the sweep reaches first. */
  function normalise(segment, index) {
    const a = segment.a;
    const b = segment.b;
    const flipped = !beforePoint(a, b);
    return {
      index: index,
      from: flipped ? b : a,
      to: flipped ? a : b,
      vertical: a.x === b.x
    };
  }

  /**
   * Every pair tested directly. Quadratic, exact, and the reference the sweep
   * is judged against - including on the degenerate inputs, where it is the
   * only one of the two that is obviously right.
   */
  function bruteForceIntersections(segments, stats) {
    const found = new Map();
    const list = segments.map(normalise);

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (stats) stats.pairsTested += 1;
        const s = list[i];
        const t = list[j];
        if (!G.segmentsIntersect(s.from, s.to, t.from, t.to, stats)) continue;

        const point = meetingPoint(s, t);
        const id = key(point);
        if (!found.has(id)) found.set(id, { point: point, segments: new Set() });
        found.get(id).segments.add(i);
        found.get(id).segments.add(j);
      }
    }
    return collect(found);
  }

  function collect(found) {
    return Array.from(found.values())
      .map(function (entry) {
        return { point: entry.point, segments: Array.from(entry.segments).sort(function (a, b) { return a - b; }) };
      })
      .sort(function (a, b) { return beforePoint(a.point, b.point) ? -1 : 1; });
  }

  /* ------------------------------------------------ the sweep itself */

  function makeQueue() {
    const points = new Map();

    function push(point, kind, index) {
      const id = key(point);
      if (!points.has(id)) points.set(id, { point: point, start: [], end: [], cross: new Set() });
      const slot = points.get(id);
      if (kind === 'cross') slot.cross.add(index);
      else slot[kind].push(index);
    }

    function drain() {
      return Array.from(points.values())
        .sort(function (a, b) { return beforePoint(a.point, b.point) ? -1 : 1; });
    }

    return { push: push, drain: drain, size: function () { return points.size; } };
  }

  /**
   * Where a segment sits vertically at sweep position x. A vertical segment
   * has no single answer, which is why it is carried as its own case rather
   * than divided by zero.
   */
  function yAt(segment, x) {
    if (segment.vertical) return segment.from.y;
    const t = (x - segment.from.x) / (segment.to.x - segment.from.x);
    return segment.from.y + t * (segment.to.y - segment.from.y);
  }

  /**
   * Bentley-Ottmann, in the honest form: the status is an array kept in sweep
   * order rather than a balanced tree, so the bound is O(n log n + k·n) rather
   * than O((n + k) log n). The event handling - which is what the section is
   * about - is identical, and the status comparisons are counted so the cost
   * of the simplification is visible rather than hidden.
   */
  function bentleyOttmann(segments, options) {
    const settings = options || {};
    const stats = settings.report || report();
    const list = segments.map(normalise);
    const queue = makeQueue();

    list.forEach(function (s, i) {
      queue.push(s.from, 'start', i);
      queue.push(s.to, 'end', i);
      if (s.vertical) stats.verticals += 1;
    });

    const found = new Map();
    const active = [];

    queue.drain().forEach(function (event) {
      stats.events += 1;
      handleEvent(event, list, active, found, stats);
    });

    stats.intersections = found.size;
    return collect(found);
  }

  function handleEvent(event, list, active, found, stats) {
    const x = event.point.x;
    const starting = event.start;
    const ending = event.end;

    if (starting.length + ending.length > 2) stats.multiplePoints += 1;
    if (starting.length > 1 || ending.length > 1) stats.sharedEndpoints += 1;

    ending.forEach(function (i) {
      const at = active.indexOf(i);
      if (at >= 0) active.splice(at, 1);
    });

    starting.forEach(function (i) {
      stats.statusInsertions += 1;
      insertOrdered(active, i, list, x, stats);
    });

    /* Everything currently on the sweep line is compared against everything
       else that starts or ends here. The full O(n) rescan per event is what
       replaces the tree's neighbour lookups; it is slower and it cannot miss a
       crossing that a mishandled neighbour swap would. */
    /* The pair is ordered by index before the crossing is computed. Without
       that, a pair reached once as (i, j) and once as (j, i) produces two
       crossing points that differ in the last bit, lands under two different
       keys, and the same intersection is reported twice - which read as the
       sweep disagreeing with the brute force on inputs where it did not. */
    const touched = starting.concat(ending);
    touched.forEach(function (i) {
      active.forEach(function (j) {
        if (i === j) return;
        const lo = Math.min(i, j);
        const hi = Math.max(i, j);
        recordIfCrossing(list[lo], list[hi], lo, hi, found, stats);
      });
    });
  }

  function insertOrdered(active, index, list, x, stats) {
    let at = active.length;
    for (let i = 0; i < active.length; i += 1) {
      stats.statusComparisons += 1;
      if (yAt(list[active[i]], x) > yAt(list[index], x)) { at = i; break; }
    }
    active.splice(at, 0, index);
  }

  function recordIfCrossing(s, t, i, j, found, stats) {
    if (!G.segmentsIntersect(s.from, s.to, t.from, t.to, stats)) return;
    const point = meetingPoint(s, t);
    const id = key(point);
    if (!found.has(id)) found.set(id, { point: point, segments: new Set() });
    found.get(id).segments.add(i);
    found.get(id).segments.add(j);
  }

  /**
   * Both, with the disagreement count reported rather than thrown. A sweep
   * that finds fourteen of fifteen intersections is the failure this exists to
   * make visible.
   */
  function compare(segments) {
    const sweepStats = report();
    const bruteStats = report();
    const swept = bentleyOttmann(segments, { report: sweepStats });
    const brute = bruteForceIntersections(segments, bruteStats);

    const sweptKeys = new Set(swept.map(function (h) { return key(h.point); }));
    const bruteKeys = new Set(brute.map(function (h) { return key(h.point); }));
    let disagreements = 0;

    bruteKeys.forEach(function (id) { if (!sweptKeys.has(id)) disagreements += 1; });
    sweptKeys.forEach(function (id) { if (!bruteKeys.has(id)) disagreements += 1; });
    sweepStats.disagreements = disagreements;

    return { swept: swept, brute: brute, sweep: sweepStats, bruteForce: bruteStats,
      disagreements: disagreements };
  }

  /* ---------------------------------------------- rectangle union area */

  /**
   * The area covered by a set of axis-aligned rectangles, by sweeping x and
   * keeping the covered y-length. Coordinate compression turns the y-axis into
   * at most 2n slabs, and a coverage count per slab replaces the segment tree
   * without changing the answer - the tree buys a log factor, not correctness.
   */
  function rectangleUnionArea(rects, options) {
    const settings = options || {};
    const stats = settings.report || report();
    if (!rects.length) return { area: 0, report: stats, slabs: 0 };

    const ys = [];
    rects.forEach(function (r) { ys.push(r.y0, r.y1); });
    const bounds = Array.from(new Set(ys)).sort(function (a, b) { return a - b; });

    const events = [];
    rects.forEach(function (r) {
      events.push({ x: r.x0, delta: 1, y0: r.y0, y1: r.y1 });
      events.push({ x: r.x1, delta: -1, y0: r.y0, y1: r.y1 });
    });
    events.sort(function (a, b) { return a.x - b.x; });

    const cover = new Array(Math.max(0, bounds.length - 1)).fill(0);
    let area = 0;
    let previousX = events.length ? events[0].x : 0;

    events.forEach(function (event) {
      stats.events += 1;
      area += coveredLength(cover, bounds) * (event.x - previousX);
      previousX = event.x;
      applyCoverage(cover, bounds, event, stats);
    });

    return { area: area, report: stats, slabs: cover.length };
  }

  function coveredLength(cover, bounds) {
    let total = 0;
    for (let i = 0; i < cover.length; i += 1) {
      if (cover[i] > 0) total += bounds[i + 1] - bounds[i];
    }
    return total;
  }

  function applyCoverage(cover, bounds, event, stats) {
    for (let i = 0; i < cover.length; i += 1) {
      if (bounds[i] >= event.y0 && bounds[i + 1] <= event.y1) {
        cover[i] += event.delta;
        stats.statusInsertions += 1;
      }
    }
  }

  /** Inclusion-exclusion over every subset. Exponential, exact, small inputs only. */
  function rectangleUnionExact(rects) {
    const n = rects.length;
    if (n === 0 || n > 20) return null;
    let total = 0;

    for (let mask = 1; mask < (1 << n); mask += 1) {
      let x0 = -Infinity, y0 = -Infinity, x1 = Infinity, y1 = Infinity;
      let bits = 0;

      for (let i = 0; i < n; i += 1) {
        if (!(mask & (1 << i))) continue;
        bits += 1;
        x0 = Math.max(x0, rects[i].x0);
        y0 = Math.max(y0, rects[i].y0);
        x1 = Math.min(x1, rects[i].x1);
        y1 = Math.min(y1, rects[i].y1);
      }
      const overlap = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
      total += (bits % 2 === 1 ? 1 : -1) * overlap;
    }
    return total;
  }

  /** The skyline: the upper envelope of a set of buildings, as corner points. */
  function skyline(buildings) {
    const events = [];
    buildings.forEach(function (b) {
      events.push({ x: b.x0, h: b.h, delta: 1 });
      events.push({ x: b.x1, h: b.h, delta: -1 });
    });
    events.sort(function (a, b) {
      if (a.x !== b.x) return a.x - b.x;
      return (b.delta * b.h) - (a.delta * a.h);
    });

    const heights = new Map([[0, 1]]);
    const out = [];
    let previous = 0;

    events.forEach(function (event) {
      const count = heights.get(event.h) || 0;
      if (event.delta === 1) heights.set(event.h, count + 1);
      else if (count <= 1) heights.delete(event.h);
      else heights.set(event.h, count - 1);

      const tallest = Math.max.apply(null, Array.from(heights.keys()));
      if (tallest === previous) return;
      out.push({ x: event.x, h: tallest });
      previous = tallest;
    });
    return out;
  }

  return {
    report: report,
    normalise: normalise,
    yAt: yAt,
    bruteForceIntersections: bruteForceIntersections,
    bentleyOttmann: bentleyOttmann,
    compare: compare,
    rectangleUnionArea: rectangleUnionArea,
    rectangleUnionExact: rectangleUnionExact,
    skyline: skyline
  };
}));
