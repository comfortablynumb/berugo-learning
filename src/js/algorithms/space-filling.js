/**
 * Space-filling curves: Morton (Z-order), Hilbert and geohash.
 *
 * All three answer the same question - how do you give a two-dimensional cell
 * a single number, such that cells close in space are usually close in that
 * number? - and the answer is what lets a key-value store with no spatial index
 * at all serve a "what is near this" query. The curve turns a rectangle into a
 * set of *key ranges*, and a range scan is the one thing every ordered store
 * already does well.
 *
 * The interesting quantity is not the encoding, which is ten lines of bit
 * twiddling. It is the decomposition: a rectangle almost never maps to one
 * contiguous run of curve indices, and how badly it fragments is the whole
 * difference between the two curves. `decompose` reports the exact set of runs
 * and `coalesce` reports what merging them down to a budget costs in cells
 * scanned that the rectangle never contained - which is the number a real
 * query planner is actually trading against round trips.
 *
 * Coordinates are non-negative integers below 2^order. Morton is defined for
 * 16 bits per axis (a 32-bit code); past that a code stops being an exact
 * integer and the module says so rather than silently losing bits.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpaceFilling = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_BITS = 16;
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  /* ------------------------------------------------------------- Morton */

  /** Spreads the low 16 bits of n so that bit i lands at position 2i. */
  function part1by1(n) {
    let x = n & 0x0000ffff;
    x = (x | (x << 8)) & 0x00ff00ff;
    x = (x | (x << 4)) & 0x0f0f0f0f;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x >>> 0;
  }

  /** The inverse: gathers the even bits of n back into the low 16. */
  function compact1by1(n) {
    let x = n & 0x55555555;
    x = (x | (x >>> 1)) & 0x33333333;
    x = (x | (x >>> 2)) & 0x0f0f0f0f;
    x = (x | (x >>> 4)) & 0x00ff00ff;
    x = (x | (x >>> 8)) & 0x0000ffff;
    return x >>> 0;
  }

  function checkBits(value, name) {
    if (!Number.isFinite(value) || value < 0 || value >= (1 << MAX_BITS)) {
      throw new RangeError('SpaceFilling: ' + name + ' must be an integer in [0, 65536)');
    }
  }

  /** x contributes the even bit positions, y the odd ones. */
  function morton2d(x, y) {
    checkBits(x, 'x');
    checkBits(y, 'y');
    return (part1by1(x) | (part1by1(y) << 1)) >>> 0;
  }

  function mortonDecode(code) {
    const value = code >>> 0;
    return { x: compact1by1(value), y: compact1by1(value >>> 1) };
  }

  /* ------------------------------------------------------------ Hilbert */

  /** The quadrant rotation that makes the curve continuous across a split. */
  function rotate(side, point, quadrant) {
    if (quadrant.ry !== 0) return point;
    const flipped = quadrant.rx === 1
      ? { x: side - 1 - point.x, y: side - 1 - point.y }
      : point;
    return { x: flipped.y, y: flipped.x };
  }

  function hilbertIndex(x, y, order) {
    const side = 1 << order;
    let point = { x: x, y: y };
    let index = 0;

    for (let step = side >> 1; step > 0; step >>= 1) {
      const quadrant = {
        rx: (point.x & step) > 0 ? 1 : 0,
        ry: (point.y & step) > 0 ? 1 : 0
      };
      index += step * step * ((3 * quadrant.rx) ^ quadrant.ry);
      point = rotate(side, point, quadrant);
    }

    return index;
  }

  function hilbertDecode(index, order) {
    const side = 1 << order;
    let rest = index;
    let point = { x: 0, y: 0 };

    for (let step = 1; step < side; step <<= 1) {
      const quadrant = { rx: 1 & (rest >> 1), ry: 1 & (rest ^ (1 & (rest >> 1))) };
      point = rotate(step, point, quadrant);
      point = { x: point.x + step * quadrant.rx, y: point.y + step * quadrant.ry };
      rest = Math.floor(rest / 4);
    }

    return point;
  }

  /* ------------------------------------------------- one curve interface */

  const CURVES = {
    morton: {
      id: 'morton',
      label: 'Morton (Z-order)',
      index: function (x, y, order) { return morton2d(x, y) & ((1 << (2 * order)) - 1); },
      decode: function (index) { return mortonDecode(index); }
    },
    hilbert: {
      id: 'hilbert',
      label: 'Hilbert',
      index: function (x, y, order) { return hilbertIndex(x, y, order); },
      decode: function (index, order) { return hilbertDecode(index, order); }
    }
  };

  function curveFor(name) {
    const curve = CURVES[name || 'morton'];
    if (!curve) throw new Error('SpaceFilling: unknown curve "' + name + '"');
    return curve;
  }

  /** The cells of a 2^order grid in curve order, for drawing the path. */
  function path(options) {
    const settings = options || {};
    const order = Math.max(1, Math.min(8, Math.floor(settings.order || 4)));
    const curve = curveFor(settings.curve);
    const side = 1 << order;
    const out = new Array(side * side);

    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        out[curve.index(x, y, order)] = { x: x, y: y };
      }
    }

    return { order: order, side: side, curve: curve.id, cells: out };
  }

  /* ------------------------------------------------------- decomposition */

  function cellsInRect(rect, order, curve) {
    const side = 1 << order;
    const x0 = Math.max(0, Math.floor(rect.x0));
    const y0 = Math.max(0, Math.floor(rect.y0));
    const x1 = Math.min(side - 1, Math.floor(rect.x1));
    const y1 = Math.min(side - 1, Math.floor(rect.y1));
    const out = [];

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) out.push(curve.index(x, y, order));
    }

    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function runsOf(indices) {
    const runs = [];
    indices.forEach(function (index) {
      const last = runs[runs.length - 1];
      if (last && index === last.end + 1) last.end = index;
      else runs.push({ start: index, end: index });
    });
    return runs;
  }

  /**
   * The exact decomposition of a rectangle into curve ranges: every cell the
   * rectangle covers, and nothing else. `ranges` is the number of separate
   * scans a store would have to issue.
   */
  function decompose(rect, options) {
    const settings = options || {};
    const order = Math.max(1, Math.min(8, Math.floor(settings.order || 4)));
    const curve = curveFor(settings.curve);
    const indices = cellsInRect(rect, order, curve);
    const runs = runsOf(indices);

    return {
      curve: curve.id,
      order: order,
      cells: indices.length,
      ranges: runs.length,
      runs: runs,
      scanned: indices.length,
      falsePositives: 0,
      span: indices.length ? indices[indices.length - 1] - indices[0] + 1 : 0
    };
  }

  /**
   * Merging runs down to a budget, cheapest gap first.
   *
   * A store that charges per round trip would rather scan a few cells it does
   * not want than issue forty scans, and this is that trade made explicit: the
   * cells scanned goes up by exactly the size of every gap swallowed.
   */
  function coalesce(decomposition, maxRanges) {
    const budget = Math.max(1, Math.floor(maxRanges));
    const runs = decomposition.runs.map(function (run) { return { start: run.start, end: run.end }; });

    while (runs.length > budget) {
      let best = 0;
      let bestGap = Infinity;
      for (let i = 0; i + 1 < runs.length; i += 1) {
        const gap = runs[i + 1].start - runs[i].end - 1;
        if (gap < bestGap) { bestGap = gap; best = i; }
      }
      runs[best].end = runs[best + 1].end;
      runs.splice(best + 1, 1);
    }

    const scanned = runs.reduce(function (total, run) { return total + (run.end - run.start + 1); }, 0);
    return {
      curve: decomposition.curve,
      order: decomposition.order,
      cells: decomposition.cells,
      ranges: runs.length,
      runs: runs,
      scanned: scanned,
      falsePositives: scanned - decomposition.cells,
      span: decomposition.span
    };
  }

  /* ------------------------------------------------------------ locality */

  /**
   * Two measurements of "close in the number means close in space".
   *
   * `jumpMean` walks the curve and measures how far each step moves; a Hilbert
   * curve never moves more than one cell, so its mean and max are both 1 and
   * Morton's are not. `neighbourMean` goes the other way: for every pair of
   * orthogonally adjacent cells it measures the gap in index, which is what
   * decides whether a neighbour lands in the same page.
   */
  function locality(options) {
    const laid = path(options);
    const cells = laid.cells;
    let jumpTotal = 0;
    let jumpMax = 0;

    for (let i = 1; i < cells.length; i += 1) {
      const dx = cells[i].x - cells[i - 1].x;
      const dy = cells[i].y - cells[i - 1].y;
      const step = Math.sqrt(dx * dx + dy * dy);
      jumpTotal += step;
      if (step > jumpMax) jumpMax = step;
    }

    const neighbours = neighbourGaps(laid);
    return {
      curve: laid.curve,
      order: laid.order,
      side: laid.side,
      jumpMean: jumpTotal / (cells.length - 1),
      jumpMax: jumpMax,
      neighbourMean: neighbours.mean,
      neighbourMax: neighbours.max
    };
  }

  /**
   * The locality measurement that actually decides query cost: how many
   * contiguous runs a square window breaks into, averaged over every placement
   * of that window on the grid.
   *
   * This exists because the usual summary - "Hilbert has better locality" - is
   * false under the obvious metric. At order 6 the mean index gap between two
   * orthogonally adjacent cells is 39.05 for Hilbert and 32.50 for Morton, and
   * the worst gap is 3 413 against 1 366; by that measure Z-order wins. What
   * Hilbert actually wins is this: a 16x16 window is 12 runs on the Hilbert
   * curve and 22 on Morton's, and runs are round trips.
   */
  function windowRanges(options) {
    const settings = options || {};
    const order = Math.max(1, Math.min(8, Math.floor(settings.order || 4)));
    const side = Math.max(1, Math.floor(settings.side || 8));
    const grid = 1 << order;
    const step = Math.max(1, Math.floor(settings.step || 1));
    let total = 0;
    let worst = 0;
    let count = 0;

    for (let y = 0; y + side <= grid; y += step) {
      for (let x = 0; x + side <= grid; x += step) {
        const result = decompose({ x0: x, y0: y, x1: x + side - 1, y1: y + side - 1 },
          { order: order, curve: settings.curve });
        total += result.ranges;
        if (result.ranges > worst) worst = result.ranges;
        count += 1;
      }
    }

    return {
      curve: curveFor(settings.curve).id,
      order: order,
      side: side,
      windows: count,
      cells: side * side,
      meanRanges: total / count,
      worstRanges: worst,
      cellsPerRange: (side * side) / (total / count)
    };
  }

  function neighbourGaps(laid) {
    const curve = curveFor(laid.curve);
    const side = laid.side;
    let total = 0;
    let count = 0;
    let max = 0;

    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const here = curve.index(x, y, laid.order);
        if (x + 1 < side) { const gap = Math.abs(curve.index(x + 1, y, laid.order) - here); total += gap; count += 1; if (gap > max) max = gap; }
        if (y + 1 < side) { const gap = Math.abs(curve.index(x, y + 1, laid.order) - here); total += gap; count += 1; if (gap > max) max = gap; }
      }
    }

    return { mean: total / count, max: max };
  }

  /* ------------------------------------------------------------ geohash */

  function bisect(state, bit) {
    const mid = (state.low + state.high) / 2;
    if (bit) state.low = mid;
    else state.high = mid;
  }

  /**
   * Geohash is Z-order with a base-32 alphabet and a longitude-first
   * interleave, which is why a geohash prefix *is* a bounding box: dropping
   * characters drops precision bits from both axes at once.
   */
  function geohash(point, precision) {
    const digits = Math.max(1, Math.min(12, Math.floor(precision || 7)));
    const lon = { low: -180, high: 180 };
    const lat = { low: -90, high: 90 };
    let text = '';
    let value = 0;
    let bits = 0;
    let even = true;

    while (text.length < digits) {
      const axis = even ? lon : lat;
      const target = even ? point.lon : point.lat;
      const bit = target > (axis.low + axis.high) / 2 ? 1 : 0;
      bisect(axis, bit);
      value = (value << 1) | bit;
      even = !even;
      bits += 1;
      if (bits === 5) { text += BASE32[value]; value = 0; bits = 0; }
    }

    return { hash: text, lonRange: [lon.low, lon.high], latRange: [lat.low, lat.high] };
  }

  function geohashDecode(hash) {
    const lon = { low: -180, high: 180 };
    const lat = { low: -90, high: 90 };
    let even = true;

    String(hash).split('').forEach(function (ch) {
      const value = BASE32.indexOf(ch);
      if (value < 0) throw new Error('SpaceFilling: "' + ch + '" is not a geohash character');
      for (let bit = 4; bit >= 0; bit -= 1) {
        bisect(even ? lon : lat, (value >> bit) & 1);
        even = !even;
      }
    });

    return {
      lon: (lon.low + lon.high) / 2,
      lat: (lat.low + lat.high) / 2,
      lonRange: [lon.low, lon.high],
      latRange: [lat.low, lat.high]
    };
  }

  return {
    morton2d: morton2d,
    mortonDecode: mortonDecode,
    hilbertIndex: hilbertIndex,
    hilbertDecode: hilbertDecode,
    path: path,
    decompose: decompose,
    coalesce: coalesce,
    locality: locality,
    windowRanges: windowRanges,
    geohash: geohash,
    geohashDecode: geohashDecode,
    curves: function () { return Object.keys(CURVES).map(function (id) { return CURVES[id]; }); },
    MAX_BITS: MAX_BITS
  };
}));
