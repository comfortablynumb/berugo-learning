/**
 * Count-min sketch and count-sketch: two d×w counter matrices that answer
 * "how often have I seen this key" from space independent of the key count.
 *
 * They differ in the direction of the error, and that is the whole design
 * decision. Count-min adds every collision into the counter, so an estimate is
 * never below the truth and is above it by at most ε·N with probability 1 − δ,
 * for w = ⌈e/ε⌉ and d = ⌈ln(1/δ)⌉. Count-sketch multiplies by a ±1 hash before
 * adding, so collisions cancel in expectation and the estimate is unbiased -
 * which means it can be *below* the truth.
 *
 * One-sided error is safe where an over-count is conservative (rate limiting,
 * shedding load) and unsafe where it is money (billing, quotas). Knowing which
 * way the error points is the thing to take away from this module.
 *
 * Conservative update is the cheap improvement: on an increment, raise only the
 * counters that are currently at the minimum. It preserves the never-under
 * guarantee - a counter is still an upper bound - and it stops a key from
 * inflating cells it was never the reason for.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CountMin = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  /** w = ⌈e/ε⌉, d = ⌈ln(1/δ)⌉ — the sizing the guarantee is stated for. */
  function paramsFor(options) {
    const epsilon = Math.max(1e-6, options.epsilon);
    const delta = Math.min(0.5, Math.max(1e-9, options.delta));
    const width = Math.ceil(Math.E / epsilon);
    const depth = Math.ceil(Math.log(1 / delta));
    return {
      width: width,
      depth: depth,
      epsilon: Math.E / width,
      delta: Math.exp(-depth),
      cells: width * depth,
      bytes: width * depth * 4
    };
  }

  /**
   * One hash per row, and the *finalised* combination rather than the raw
   * one. Plain double hashing (h1 + i·h2) is fine for a Bloom filter and wrong
   * here: two keys whose h1 and h2 both agree modulo w collide in every row at
   * once, which is the one event both guarantees exclude. Measured on a Zipf
   * stream at w = 2 719, d = 5, that put count-sketch's worst error at 6 939
   * against a stated bound of 2 808. Avalanching each row's value first makes
   * a row collision independent of the others.
   */
  function rowHashes(key, depth, seed) {
    const H = hashFunctions();
    const h1 = H.murmur3(key, seed) >>> 0;
    const h2 = (H.murmur3(key, (seed + 0x9e3779b9) >>> 0) | 1) >>> 0;
    const out = new Array(depth);
    for (let i = 0; i < depth; i += 1) {
      out[i] = H.murmurFinalise((h1 + Math.imul(i, h2) + i * i) >>> 0);
    }
    return out;
  }

  function create(options) {
    const settings = options || {};
    const width = Math.max(2, Math.floor(settings.width || 256));
    const depth = Math.max(1, Math.floor(settings.depth || 4));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const conservative = Boolean(settings.conservative);
    const cells = new Float64Array(width * depth);
    let total = 0;
    let stats = emptyStats();

    function columns(key) {
      const hashes = rowHashes(key, depth, seed);
      const out = new Array(depth);
      for (let i = 0; i < depth; i += 1) out[i] = i * width + (hashes[i] % width);
      return out;
    }

    function minimumOf(list) {
      let smallest = Infinity;
      for (let i = 0; i < list.length; i += 1) {
        if (cells[list[i]] < smallest) smallest = cells[list[i]];
      }
      return smallest;
    }

    function add(key, count) {
      const amount = count === undefined ? 1 : count;
      const list = columns(key);
      stats.updates += 1;
      stats.cellWrites += depth;
      total += amount;

      if (!conservative) {
        list.forEach(function (index) { cells[index] += amount; });
        return;
      }

      const target = minimumOf(list) + amount;
      list.forEach(function (index) {
        if (cells[index] < target) { cells[index] = target; return; }
        stats.cellsSkipped += 1;
      });
    }

    function estimate(key) {
      stats.queries += 1;
      return minimumOf(columns(key));
    }

    /** The additive bound the guarantee promises at the current stream length. */
    function errorBound() {
      return (Math.E / width) * total;
    }

    return {
      kind: conservative ? 'count-min-conservative' : 'count-min',
      add: add,
      estimate: estimate,
      columns: columns,
      cells: function () { return cells; },
      width: function () { return width; },
      depth: function () { return depth; },
      total: function () { return total; },
      epsilon: function () { return Math.E / width; },
      delta: function () { return Math.exp(-depth); },
      errorBound: errorBound,
      bytes: function () { return width * depth * 8; },
      /* min over rows of the row-wise inner product: the standard estimator
         for Σ f_a(i)·f_b(i), and it over-estimates for the same reason. */
      dotProduct: function (other) {
        const theirs = other.cells();
        let best = Infinity;
        for (let row = 0; row < depth; row += 1) {
          let sum = 0;
          for (let col = 0; col < width; col += 1) {
            sum += cells[row * width + col] * theirs[row * width + col];
          }
          if (sum < best) best = sum;
        }
        return best;
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  function emptyStats() {
    return { updates: 0, queries: 0, cellWrites: 0, cellsSkipped: 0 };
  }

  /**
   * Count-sketch: the same matrix with a ±1 hash applied before the add, and a
   * median rather than a minimum at query time. Collisions cancel instead of
   * accumulating, so the estimator is unbiased - and can under-count, which no
   * count-min ever does.
   */
  function countSketch(options) {
    const settings = options || {};
    const width = Math.max(2, Math.floor(settings.width || 256));
    /* An odd depth, always. The estimator is a median, and the median of an
       even number of values averages the two middle ones - which mixes a good
       row with a bad one instead of choosing between them, and measurably
       widens the tail. */
    const requested = Math.max(1, Math.floor(settings.depth || 5));
    const depth = requested % 2 ? requested : requested + 1;
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const cells = new Float64Array(width * depth);
    let total = 0;
    let stats = emptyStats();

    function placements(key) {
      const H = hashFunctions();
      const hashes = rowHashes(key, depth, seed);
      const out = new Array(depth);
      for (let i = 0; i < depth; i += 1) {
        const sign = (H.murmurFinalise((hashes[i] ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0) & 1) ? 1 : -1;
        out[i] = { index: i * width + (hashes[i] % width), sign: sign };
      }
      return out;
    }

    function add(key, count) {
      const amount = count === undefined ? 1 : count;
      stats.updates += 1;
      stats.cellWrites += depth;
      total += amount;
      placements(key).forEach(function (spot) { cells[spot.index] += spot.sign * amount; });
    }

    function estimate(key) {
      stats.queries += 1;
      const values = placements(key).map(function (spot) { return spot.sign * cells[spot.index]; });
      values.sort(function (a, b) { return a - b; });
      const middle = Math.floor(values.length / 2);
      return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    }

    return {
      kind: 'count-sketch',
      add: add,
      estimate: estimate,
      placements: placements,
      cells: function () { return cells; },
      width: function () { return width; },
      depth: function () { return depth; },
      total: function () { return total; },
      /* ‖f‖₂-relative rather than ‖f‖₁-relative: the reason count-sketch beats
         count-min on a heavy-tailed stream at the same width. */
      epsilon: function () { return Math.sqrt(Math.E / width); },
      errorBound: function (l2Norm) { return Math.sqrt(Math.E / width) * l2Norm; },
      bytes: function () { return width * depth * 8; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /**
   * A count-min sketch plus the heap that makes heavy hitters answerable.
   *
   * The sketch alone cannot enumerate anything - it has no keys in it - so a
   * heavy-hitter query needs a candidate set kept alongside. That set is the
   * part that costs memory proportional to the answer, and pretending the
   * sketch does it alone is the usual overclaim.
   */
  function heavyHitters(options) {
    const settings = options || {};
    const fraction = settings.fraction || 0.01;
    const sketch = create(settings);
    const candidates = new Map();

    function add(key, count) {
      sketch.add(key, count);
      const estimate = sketch.estimate(key);
      if (estimate >= fraction * sketch.total()) candidates.set(key, estimate);
      else candidates.delete(key);
    }

    function top() {
      const out = [];
      candidates.forEach(function (ignored, key) {
        const estimate = sketch.estimate(key);
        if (estimate >= fraction * sketch.total()) out.push({ key: key, estimate: estimate });
      });
      return out.sort(function (a, b) { return b.estimate - a.estimate; });
    }

    return {
      kind: 'count-min-heavy-hitters',
      add: add,
      top: top,
      sketch: function () { return sketch; },
      estimate: sketch.estimate,
      total: sketch.total,
      candidateCount: function () { return candidates.size; },
      fraction: function () { return fraction; },
      bytes: function () { return sketch.bytes() + candidates.size * 32; }
    };
  }

  return {
    create: create,
    countSketch: countSketch,
    heavyHitters: heavyHitters,
    paramsFor: paramsFor
  };
}));
