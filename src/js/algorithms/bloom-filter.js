/**
 * Bloom filters: the standard bit array, the counting variant, the blocked
 * variant and the scalable chain - all behind one interface so the demos and
 * `machines/stream-lab.js` can drive them without special cases.
 *
 * Every variant reports `bits`, `bytes`, `linesTouched` and `predictedFpr`
 * alongside the answers, because the whole value proposition of a filter is a
 * bound you can check. A filter that reports only yes/no cannot be audited,
 * and the section's job is to audit it.
 *
 * The k indices come from two hashes rather than k of them
 * (Kirsch-Mitzenmacher): g_i = h1 + i*h2 + i², which is indistinguishable from
 * k independent hashes for the false-positive rate and costs two hashes per
 * key instead of k. The i² term is there because h2 can share a factor with m
 * and then h1 + i*h2 cycles early.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BloomFilter = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const LINE_BYTES = 64;
  const LN2 = Math.LN2;

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  /** The two base hashes every variant derives its probe sequence from. */
  function basis(key, seed) {
    const H = hashFunctions();
    const h1 = H.murmur3(key, seed >>> 0);
    const h2 = H.murmur3(key, (seed + 0x9e3779b9) >>> 0) | 1;
    return { h1: h1 >>> 0, h2: h2 >>> 0 };
  }

  /* ---------------------------------------------------------- bit storage */

  function createBits(m) {
    const words = new Uint32Array(Math.ceil(m / 32));

    function get(index) {
      return (words[index >>> 5] >>> (index & 31)) & 1;
    }

    function set(index) {
      const word = index >>> 5;
      const mask = 1 << (index & 31);
      const already = (words[word] & mask) !== 0;
      words[word] |= mask;
      return !already;
    }

    function popcount() {
      let total = 0;
      for (let i = 0; i < words.length; i += 1) {
        let v = words[i];
        v = v - ((v >>> 1) & 0x55555555);
        v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
        total += Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
      }
      return total;
    }

    return { words: words, get: get, set: set, popcount: popcount };
  }

  /** Distinct 64-byte lines a set of bit indices lands in. */
  function linesFor(indices) {
    const lines = new Set();
    indices.forEach(function (index) { lines.add(Math.floor(index / 8 / LINE_BYTES)); });
    return lines.size;
  }

  /* -------------------------------------------------------------- sizing */

  /**
   * m = −n ln p / (ln 2)², k = (m/n) ln 2. The k is rounded, so the achieved
   * error is not exactly p and `predictedFpr` is computed from the rounded k
   * rather than from the formula it came out of.
   */
  function optimalParams(options) {
    const n = Math.max(1, Math.floor(options.n));
    const p = Math.min(0.999, Math.max(1e-9, options.p));
    const m = Math.max(8, Math.ceil(-n * Math.log(p) / (LN2 * LN2)));
    const k = Math.max(1, Math.round((m / n) * LN2));
    return {
      m: m,
      k: k,
      bitsPerKey: m / n,
      idealK: (m / n) * LN2,
      predictedFpr: fprFor({ m: m, k: k, n: n })
    };
  }

  /** (1 − e^(−kn/m))^k — the textbook estimate, and what every demo plots. */
  function fprFor(options) {
    const m = options.m;
    const k = options.k;
    const n = options.n;
    if (!m || !k) return 1;
    return Math.pow(1 - Math.exp(-k * n / m), k);
  }

  /** The n at which a filter of this shape reaches the target error. */
  function capacityFor(options) {
    const m = options.m;
    const k = options.k;
    const p = options.p;
    const inner = 1 - Math.pow(p, 1 / k);
    if (inner <= 0 || inner >= 1) return 0;
    return Math.floor(-(m / k) * Math.log(inner));
  }

  /* ------------------------------------------------------ standard filter */

  function create(options) {
    const settings = options || {};
    const m = Math.max(8, Math.floor(settings.m || 1024));
    const k = Math.max(1, Math.floor(settings.k || 3));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const bits = createBits(m);
    let inserted = 0;
    let stats = emptyStats();

    function indices(key) {
      const base = basis(key, seed);
      const out = new Array(k);
      for (let i = 0; i < k; i += 1) {
        out[i] = (((base.h1 + Math.imul(i, base.h2) + i * i) >>> 0) % m);
      }
      return out;
    }

    function charge(list, kind) {
      stats[kind] += 1;
      stats.bitProbes += list.length;
      stats.linesTouched += linesFor(list);
    }

    function add(key) {
      const list = indices(key);
      let fresh = false;
      list.forEach(function (index) { if (bits.set(index)) fresh = true; });
      charge(list, 'inserts');
      inserted += 1;
      return fresh;
    }

    function has(key) {
      const list = indices(key);
      charge(list, 'queries');
      for (let i = 0; i < list.length; i += 1) {
        if (!bits.get(list[i])) return false;
      }
      return true;
    }

    return {
      kind: 'standard',
      add: add,
      has: has,
      indices: indices,
      seed: function () { return seed; },
      words: function () { return bits.words; },
      bits: function () { return m; },
      k: function () { return k; },
      bytes: function () { return Math.ceil(m / 8); },
      count: function () { return inserted; },
      setBits: function () { return bits.popcount(); },
      fill: function () { return bits.popcount() / m; },
      predictedFpr: function () { return fprFor({ m: m, k: k, n: inserted }); },
      /* The estimate from the bits that are actually set, which is what a
         filter can report about itself without knowing n. */
      observedLoadFpr: function () { return Math.pow(bits.popcount() / m, k); },
      estimatedCount: function () {
        const fillRatio = bits.popcount() / m;
        if (fillRatio >= 1) return Infinity;
        return -(m / k) * Math.log(1 - fillRatio);
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  function emptyStats() {
    return { queries: 0, inserts: 0, bitProbes: 0, linesTouched: 0, overflows: 0 };
  }

  /** Bitwise union of two filters with the same shape - the set union, exactly. */
  function union(a, b) {
    const out = create({ m: a.bits(), k: a.k(), seed: a.seed() });
    const target = out.words();
    const left = a.words();
    const right = b.words();
    for (let i = 0; i < target.length; i += 1) target[i] = (left[i] | right[i]) >>> 0;
    return out;
  }

  /**
   * Bitwise intersection. This is *not* the filter of the intersection: it can
   * report a key neither set contains, because the key's bits may be covered
   * by different keys on each side.
   */
  function intersect(a, b) {
    const out = create({ m: a.bits(), k: a.k(), seed: a.seed() });
    const target = out.words();
    const left = a.words();
    const right = b.words();
    for (let i = 0; i < target.length; i += 1) target[i] = (left[i] & right[i]) >>> 0;
    return out;
  }

  /* ------------------------------------------------------ counting filter */

  /**
   * One small counter per cell instead of one bit, so a delete can decrement.
   * A counter that saturates can never be decremented again without risking a
   * false negative, so it sticks at the maximum and the filter counts how
   * often that happened.
   */
  function counting(options) {
    const settings = options || {};
    const m = Math.max(8, Math.floor(settings.m || 1024));
    const k = Math.max(1, Math.floor(settings.k || 3));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const counterBits = Math.max(2, Math.floor(settings.counterBits || 4));
    const max = Math.pow(2, counterBits) - 1;
    const cells = new Uint8Array(m);
    let inserted = 0;
    let stats = emptyStats();

    function indices(key) {
      const base = basis(key, seed);
      const out = new Array(k);
      for (let i = 0; i < k; i += 1) {
        out[i] = (((base.h1 + Math.imul(i, base.h2) + i * i) >>> 0) % m);
      }
      return out;
    }

    function charge(list, kind) {
      stats[kind] += 1;
      stats.bitProbes += list.length;
      stats.linesTouched += linesFor(list.map(function (i) { return i * counterBits; }));
    }

    function add(key) {
      const list = indices(key);
      list.forEach(function (index) {
        if (cells[index] >= max) { stats.overflows += 1; return; }
        cells[index] += 1;
      });
      charge(list, 'inserts');
      inserted += 1;
      return true;
    }

    function remove(key) {
      const list = indices(key);
      if (!list.every(function (index) { return cells[index] > 0; })) return false;
      list.forEach(function (index) {
        if (cells[index] >= max) return;         // saturated: never decremented
        cells[index] -= 1;
      });
      inserted = Math.max(0, inserted - 1);
      return true;
    }

    function has(key) {
      const list = indices(key);
      charge(list, 'queries');
      return list.every(function (index) { return cells[index] > 0; });
    }

    return {
      kind: 'counting',
      add: add,
      has: has,
      remove: remove,
      indices: indices,
      cells: function () { return cells; },
      bits: function () { return m * counterBits; },
      k: function () { return k; },
      bytes: function () { return Math.ceil(m * counterBits / 8); },
      count: function () { return inserted; },
      maxCounter: function () { return cells.reduce(function (a, b) { return Math.max(a, b); }, 0); },
      saturated: function () {
        return cells.reduce(function (total, v) { return total + (v >= max ? 1 : 0); }, 0);
      },
      fill: function () {
        return cells.reduce(function (total, v) { return total + (v > 0 ? 1 : 0); }, 0) / m;
      },
      predictedFpr: function () { return fprFor({ m: m, k: k, n: inserted }); },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------- blocked filter */

  /**
   * One hash picks a block; all k bits land inside it. A block is a cache line
   * (512 bits), so a query touches one line instead of k. The cost is a worse
   * error rate at the same m: block occupancy varies, and the overloaded
   * blocks contribute more false positives than the empty ones save.
   */
  function blocked(options) {
    const settings = options || {};
    const blockBits = Math.max(64, Math.floor(settings.blockBits || 512));
    const blocks = Math.max(1, Math.round((settings.m || 1024) / blockBits));
    const m = blocks * blockBits;
    const k = Math.max(1, Math.floor(settings.k || 3));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const bits = createBits(m);
    let inserted = 0;
    let stats = emptyStats();

    /* The in-block positions are re-mixed per i rather than stepped by a
       stride. A stride makes the k offsets a fixed pattern translated by one
       hash, so only `blockBits` distinct patterns exist and the measured error
       is 28× the prediction. Re-mixing costs one more finaliser per bit and
       restores the model. */
    function indices(key) {
      const H = hashFunctions();
      const base = basis(key, seed);
      const block = (base.h1 % blocks) * blockBits;
      const out = new Array(k);
      for (let i = 0; i < k; i += 1) {
        const mixed = H.murmurFinalise((base.h2 ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
        out[i] = block + (mixed % blockBits);
      }
      return out;
    }

    function charge(list, kind) {
      stats[kind] += 1;
      stats.bitProbes += list.length;
      stats.linesTouched += Math.max(1, Math.ceil(blockBits / 8 / LINE_BYTES));
    }

    function add(key) {
      const list = indices(key);
      list.forEach(bits.set);
      charge(list, 'inserts');
      inserted += 1;
      return true;
    }

    function has(key) {
      const list = indices(key);
      charge(list, 'queries');
      return list.every(function (index) { return bits.get(index) === 1; });
    }

    return {
      kind: 'blocked',
      add: add,
      has: has,
      indices: indices,
      words: function () { return bits.words; },
      bits: function () { return m; },
      k: function () { return k; },
      blocks: function () { return blocks; },
      blockBits: function () { return blockBits; },
      bytes: function () { return Math.ceil(m / 8); },
      count: function () { return inserted; },
      setBits: function () { return bits.popcount(); },
      fill: function () { return bits.popcount() / m; },
      predictedFpr: function () { return fprFor({ m: m, k: k, n: inserted }); },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------ scalable filter */

  /**
   * A chain of filters. When the newest one reaches the capacity it was sized
   * for, a larger one with a *tighter* target error is added in front of it.
   * The errors form a geometric series, so the whole chain's error is bounded
   * by p/(1 − tighten) however many layers appear - which is the property that
   * makes the structure usable when n is genuinely unknown.
   */
  function scalable(options) {
    const settings = options || {};
    const p = settings.p || 0.01;
    const growth = settings.growth || 2;
    const tighten = settings.tighten || 0.5;
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const layers = [];
    let capacity = Math.max(16, Math.floor(settings.n0 || 1000));
    let target = p * (1 - tighten);

    function addLayer() {
      const shape = optimalParams({ n: capacity, p: target });
      layers.push({
        filter: create({ m: shape.m, k: shape.k, seed: (seed + layers.length * 7919) >>> 0 }),
        capacity: capacity,
        target: target
      });
      capacity = Math.floor(capacity * growth);
      target *= tighten;
    }

    addLayer();

    function current() { return layers[layers.length - 1]; }

    function has(key) {
      for (let i = 0; i < layers.length; i += 1) {
        if (layers[i].filter.has(key)) return true;
      }
      return false;
    }

    function add(key) {
      if (has(key)) return false;
      if (current().filter.count() >= current().capacity) addLayer();
      current().filter.add(key);
      return true;
    }

    function total(field) {
      return layers.reduce(function (sum, layer) { return sum + layer.filter[field](); }, 0);
    }

    return {
      kind: 'scalable',
      add: add,
      has: has,
      layers: function () {
        return layers.map(function (layer) {
          return {
            capacity: layer.capacity,
            target: layer.target,
            bits: layer.filter.bits(),
            k: layer.filter.k(),
            count: layer.filter.count(),
            fpr: layer.filter.predictedFpr()
          };
        });
      },
      layerCount: function () { return layers.length; },
      bits: total.bind(null, 'bits'),
      bytes: total.bind(null, 'bytes'),
      count: total.bind(null, 'count'),
      /* 1 − Π(1 − p_i): a key must miss every layer to be reported absent. */
      predictedFpr: function () {
        return 1 - layers.reduce(function (product, layer) {
          return product * (1 - layer.filter.predictedFpr());
        }, 1);
      },
      boundedFpr: function () { return p; },
      stats: function () {
        return layers.reduce(function (acc, layer) {
          const s = layer.filter.stats();
          Object.keys(s).forEach(function (key) { acc[key] += s[key]; });
          return acc;
        }, emptyStats());
      },
      resetStats: function () { layers.forEach(function (layer) { layer.filter.resetStats(); }); }
    };
  }

  return {
    create: create,
    counting: counting,
    blocked: blocked,
    scalable: scalable,
    union: union,
    intersect: intersect,
    optimalParams: optimalParams,
    fprFor: fprFor,
    capacityFor: capacityFor,
    LINE_BYTES: LINE_BYTES
  };
}));
