/**
 * Quantile sketches: reservoir sampling, t-digest, KLL and DDSketch.
 *
 * All four answer "what is the p-th percentile of this stream" without keeping
 * the stream, and they fail in different directions, which is the reason to
 * put them side by side:
 *
 *   reservoir  a uniform sample of k items. Unbiased for the middle, useless
 *              at p99.9 - a 1 000-item sample holds one item past the 99.9th
 *              percentile, so the answer is one observation wide.
 *   t-digest   centroids sized by a scale function that keeps them small at
 *              both ends, so the tails are resolved finely and the middle
 *              coarsely. No formal bound; excellent in practice.
 *   KLL        compactors that halve the data one level at a time, with a
 *              proven rank-error bound.
 *   DDSketch   logarithmic buckets: the *value* is guaranteed to within a
 *              relative α, which is the guarantee a latency SLO is written in.
 *
 * `exact` is here too, and every demo runs it alongside: a sketch whose error
 * is not measured against the truth on the same stream is a claim, not a
 * measurement.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuantileSketches = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function randomLib() {
    if (scope && scope.Random) return scope.Random;
    return require('../utils/random.js');
  }

  function ascending(a, b) { return a - b; }

  /** The reference: every value kept, sorted on demand. */
  function exact(options) {
    const values = [];
    let sorted = null;

    return {
      kind: 'exact',
      add: function (value) { values.push(value); sorted = null; },
      quantile: function (p) {
        if (!values.length) return NaN;
        if (!sorted) sorted = values.slice().sort(ascending);
        const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
        return sorted[index];
      },
      /** The rank of a value, which is what a rank-error bound is stated over. */
      rankOf: function (value) {
        if (!sorted) sorted = values.slice().sort(ascending);
        let low = 0;
        let high = sorted.length;
        while (low < high) {
          const mid = (low + high) >>> 1;
          if (sorted[mid] < value) low = mid + 1; else high = mid;
        }
        return low;
      },
      count: function () { return values.length; },
      bytes: function () { return values.length * 8; },
      values: function () { return values; },
      stats: function () { return { stored: values.length }; }
    };
  }

  /**
   * Algorithm R. The i-th item (0-based) is kept with probability k/(i+1) and
   * evicts a uniformly chosen resident, which leaves every item of the stream
   * equally likely to be in the sample at every point - not only at the end.
   */
  function reservoir(options) {
    const settings = options || {};
    const size = Math.max(1, Math.floor(settings.size || 1000));
    const rng = randomLib().seeded(settings.seed === undefined ? 1 : settings.seed);
    const kept = [];
    let seen = 0;
    let replaced = 0;

    function add(value) {
      if (kept.length < size) { kept.push(value); seen += 1; return true; }
      const index = rng.int(seen + 1);
      seen += 1;
      if (index >= size) return false;
      kept[index] = value;
      replaced += 1;
      return true;
    }

    return {
      kind: 'reservoir',
      add: add,
      quantile: function (p) {
        if (!kept.length) return NaN;
        const sorted = kept.slice().sort(ascending);
        const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
        return sorted[index];
      },
      sample: function () { return kept.slice(); },
      size: function () { return size; },
      count: function () { return seen; },
      bytes: function () { return kept.length * 8; },
      stats: function () { return { stored: kept.length, seen: seen, replaced: replaced }; }
    };
  }

  /**
   * Weighted reservoir sampling (Efraimidis-Spirakis A-Res): each item gets a
   * key u^(1/w) and the k largest keys are kept. It reduces to Algorithm R at
   * equal weights and is the version to reach for when the stream is already
   * aggregated.
   */
  function weightedReservoir(options) {
    const settings = options || {};
    const size = Math.max(1, Math.floor(settings.size || 1000));
    const rng = randomLib().seeded(settings.seed === undefined ? 1 : settings.seed);
    const kept = [];
    let seen = 0;

    function add(value, weight) {
      const w = weight === undefined ? 1 : weight;
      const key = Math.pow(Math.max(rng.next(), Number.MIN_VALUE), 1 / Math.max(w, 1e-12));
      seen += 1;
      kept.push({ value: value, key: key });
      if (kept.length <= size) return true;
      kept.sort(function (a, b) { return b.key - a.key; });
      kept.length = size;
      return true;
    }

    return {
      kind: 'weighted-reservoir',
      add: add,
      quantile: function (p) {
        if (!kept.length) return NaN;
        const sorted = kept.map(function (e) { return e.value; }).sort(ascending);
        return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
      },
      sample: function () { return kept.map(function (e) { return e.value; }); },
      count: function () { return seen; },
      bytes: function () { return kept.length * 16; },
      stats: function () { return { stored: kept.length, seen: seen }; }
    };
  }

  /* --------------------------------------------------------------- t-digest */

  /** k1: δ/2π · asin(2q − 1). Flat in the middle, steep at both ends. */
  function scaleK(q, compression) {
    return (compression / (2 * Math.PI)) * Math.asin(2 * Math.min(1, Math.max(0, q)) - 1);
  }

  function scaleQ(k, compression) {
    return (Math.sin(Math.min(Math.PI / 2, Math.max(-Math.PI / 2, 2 * Math.PI * k / compression))) + 1) / 2;
  }

  /**
   * Merging t-digest. Values land in a buffer; when it fills, the buffer and
   * the existing centroids are merged in sorted order and a new centroid is
   * started whenever the scale function says the current one is full.
   */
  function tDigest(options) {
    const settings = options || {};
    const compression = Math.max(10, settings.compression || 100);
    const bufferSize = Math.max(16, Math.floor(settings.bufferSize || compression * 5));
    let centroids = [];
    let buffer = [];
    let total = 0;
    let merges = 0;

    function add(value, weight) {
      buffer.push({ mean: value, count: weight === undefined ? 1 : weight });
      total += weight === undefined ? 1 : weight;
      if (buffer.length >= bufferSize) compress();
    }

    function compress() {
      const all = centroids.concat(buffer).sort(function (a, b) { return a.mean - b.mean; });
      buffer = [];
      merges += 1;
      centroids = mergeCentroids(all, total, compression);
    }

    function quantile(p) {
      if (buffer.length) compress();
      return quantileOf(centroids, total, p);
    }

    return {
      kind: 't-digest',
      add: add,
      quantile: quantile,
      compress: compress,
      centroids: function () { if (buffer.length) compress(); return centroids.slice(); },
      compression: function () { return compression; },
      count: function () { return total; },
      bytes: function () { return (centroids.length + buffer.length) * 16; },
      stats: function () { return { centroids: centroids.length, merges: merges, buffered: buffer.length }; }
    };
  }

  function mergeCentroids(sorted, total, compression) {
    const out = [];
    let current = null;
    let weightSoFar = 0;
    let limit = scaleQ(scaleK(0, compression) + 1, compression) * total;

    sorted.forEach(function (centroid) {
      if (!current) { current = { mean: centroid.mean, count: centroid.count }; return; }
      if (weightSoFar + current.count + centroid.count <= limit) {
        const count = current.count + centroid.count;
        current.mean += (centroid.mean - current.mean) * centroid.count / count;
        current.count = count;
        return;
      }
      out.push(current);
      weightSoFar += current.count;
      limit = scaleQ(scaleK(weightSoFar / total, compression) + 1, compression) * total;
      current = { mean: centroid.mean, count: centroid.count };
    });

    if (current) out.push(current);
    return out;
  }

  /** Linear interpolation inside the centroid that straddles the target rank. */
  function quantileOf(centroids, total, p) {
    if (!centroids.length) return NaN;
    const target = p * total;
    let cumulative = 0;

    for (let i = 0; i < centroids.length; i += 1) {
      const centroid = centroids[i];
      const centre = cumulative + centroid.count / 2;
      if (target <= centre || i === centroids.length - 1) {
        if (i === 0) return centroids[0].mean;
        const previous = centroids[i - 1];
        const previousCentre = cumulative - previous.count / 2;
        const span = centre - previousCentre;
        if (span <= 0) return centroid.mean;
        const t = Math.min(1, Math.max(0, (target - previousCentre) / span));
        return previous.mean + (centroid.mean - previous.mean) * t;
      }
      cumulative += centroid.count;
    }
    return centroids[centroids.length - 1].mean;
  }

  /* -------------------------------------------------------------------- KLL */

  /**
   * KLL: a stack of compactors. Level h holds items of weight 2^h; when it
   * fills, it is sorted and every second item is promoted to level h+1 while
   * the rest are dropped. The coin that chooses odd or even is what makes the
   * error unbiased - always keeping the same parity biases every quantile in
   * one direction.
   *
   * Capacities shrink geometrically up the stack (c = 2/3), so the whole
   * sketch is O(k) items whatever the stream length.
   */
  function kll(options) {
    const settings = options || {};
    const k = Math.max(8, Math.floor(settings.k || 200));
    const c = settings.c || (2 / 3);
    const rng = randomLib().seeded(settings.seed === undefined ? 1 : settings.seed);
    const levels = [[]];
    let total = 0;
    let compactions = 0;

    function capacityOf(height) {
      const top = levels.length - 1;
      return Math.max(2, Math.ceil(k * Math.pow(c, top - height)));
    }

    function compact(height) {
      const level = levels[height];
      level.sort(ascending);
      if (height + 1 >= levels.length) levels.push([]);
      const offset = rng.int(2);
      for (let i = offset; i < level.length; i += 2) levels[height + 1].push(level[i]);
      level.length = 0;
      compactions += 1;
      if (levels[height + 1].length >= capacityOf(height + 1)) compact(height + 1);
    }

    function add(value) {
      levels[0].push(value);
      total += 1;
      if (levels[0].length >= capacityOf(0)) compact(0);
    }

    function weighted() {
      const out = [];
      levels.forEach(function (level, height) {
        const weight = Math.pow(2, height);
        level.forEach(function (value) { out.push({ value: value, weight: weight }); });
      });
      return out.sort(function (a, b) { return a.value - b.value; });
    }

    function quantile(p) {
      const items = weighted();
      if (!items.length) return NaN;
      const mass = items.reduce(function (sum, item) { return sum + item.weight; }, 0);
      let cumulative = 0;
      for (let i = 0; i < items.length; i += 1) {
        cumulative += items[i].weight;
        if (cumulative >= p * mass) return items[i].value;
      }
      return items[items.length - 1].value;
    }

    return {
      kind: 'kll',
      add: add,
      quantile: quantile,
      items: weighted,
      levels: function () { return levels.map(function (level) { return level.length; }); },
      k: function () { return k; },
      count: function () { return total; },
      stored: function () {
        return levels.reduce(function (sum, level) { return sum + level.length; }, 0);
      },
      bytes: function () {
        return levels.reduce(function (sum, level) { return sum + level.length; }, 0) * 8;
      },
      stats: function () { return { compactions: compactions, levels: levels.length }; }
    };
  }

  /* --------------------------------------------------------------- DDSketch */

  /**
   * Logarithmic buckets: bucket i covers [γ^i, γ^(i+1)) for γ = (1+α)/(1−α),
   * and the representative value γ^i·2/(γ+1) is within a relative α of every
   * value in the bucket. The guarantee is therefore on the *value*, not on the
   * rank, which is the form a latency target is actually written in - "p99
   * under 250 ms, ±2%" is a DDSketch statement and not a t-digest one.
   */
  function ddSketch(options) {
    const settings = options || {};
    const alpha = Math.min(0.5, Math.max(1e-4, settings.alpha || 0.01));
    const gamma = (1 + alpha) / (1 - alpha);
    const logGamma = Math.log(gamma);
    const positive = new Map();
    let zeros = 0;
    let total = 0;

    function indexOf(value) {
      return Math.ceil(Math.log(value) / logGamma);
    }

    function add(value, weight) {
      const w = weight === undefined ? 1 : weight;
      total += w;
      if (value <= 0) { zeros += w; return; }
      const index = indexOf(value);
      positive.set(index, (positive.get(index) || 0) + w);
    }

    function quantile(p) {
      if (!total) return NaN;
      const target = p * total;
      const keys = Array.from(positive.keys()).sort(ascending);
      let cumulative = zeros;
      if (cumulative >= target) return 0;

      for (let i = 0; i < keys.length; i += 1) {
        cumulative += positive.get(keys[i]);
        if (cumulative >= target) return 2 * Math.pow(gamma, keys[i]) / (gamma + 1);
      }
      return 2 * Math.pow(gamma, keys[keys.length - 1]) / (gamma + 1);
    }

    return {
      kind: 'ddsketch',
      add: add,
      quantile: quantile,
      alpha: function () { return alpha; },
      gamma: function () { return gamma; },
      buckets: function () { return positive.size; },
      count: function () { return total; },
      bytes: function () { return positive.size * 12; },
      /** Merge is bucket-wise addition, so shards combine with no re-scan. */
      mergeFrom: function (other) {
        other.rawBuckets().forEach(function (count, index) {
          positive.set(index, (positive.get(index) || 0) + count);
        });
        total += other.count();
        return true;
      },
      rawBuckets: function () { return positive; },
      stats: function () { return { buckets: positive.size, zeros: zeros }; }
    };
  }

  return {
    exact: exact,
    reservoir: reservoir,
    weightedReservoir: weightedReservoir,
    tDigest: tDigest,
    kll: kll,
    ddSketch: ddSketch,
    scaleK: scaleK,
    scaleQ: scaleQ,
    quantileOf: quantileOf
  };
}));
