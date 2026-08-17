/**
 * One harness for every hash table in M03.
 *
 * A table is anything with { name, set, get, delete, size, capacity, stats }.
 * The lab supplies the key stream, drives the operations, checks every answer
 * against a reference Map, and reports probe counts rather than wall-clock
 * time - so the comparison is a property of the scheme rather than of the
 * machine it ran on.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
    'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon',
    'phi', 'chi', 'psi', 'omega', 'north', 'south', 'east', 'west', 'red', 'green', 'blue',
    'user', 'session', 'token', 'order', 'item', 'price', 'total', 'index', 'value'];

  /* ------------------------------------------------------------ key streams */

  function keys(options) {
    const count = options.count;
    const rng = options.rng;
    const out = [];

    if (options.kind === 'sequential') {
      for (let i = 0; i < count; i += 1) out.push('key-' + i);
      return out;
    }
    if (options.kind === 'clustered') {
      for (let i = 0; i < count; i += 1) out.push('key-' + (i - (i % 8)) + '-' + (i % 8));
      return out;
    }
    if (options.kind === 'words') {
      for (let i = 0; i < count; i += 1) {
        out.push(WORDS[i % WORDS.length] + '-' + WORDS[(i * 7 + 3) % WORDS.length] + '-' + i);
      }
      return out;
    }
    for (let i = 0; i < count; i += 1) out.push('k' + rng.int(1 << 30) + '-' + i);
    return out;
  }

  /**
   * Keys that all land in the same bucket of a table with `buckets` slots.
   * Brute force on purpose: the cost of finding them is the number the attack
   * section cares about, and a keyed hash makes it unpayable offline.
   *
   * `examinedAt[i]` is how many candidates had been hashed when the (i+1)th
   * key was found, so a caller that searches once and then slices can still
   * quote the cost of the payload it actually used rather than the cost of
   * the whole search.
   */
  function collidingKeys(options) {
    const hash = options.hash;
    const buckets = options.buckets;
    const target = options.target || 0;
    const wanted = options.count;
    const budget = options.budget || 4000000;
    const found = [];
    const examinedAt = [];
    let examined = 0;

    while (found.length < wanted && examined < budget) {
      const candidate = 'x' + examined;
      examined += 1;
      if (hash(candidate) % buckets === target) {
        found.push(candidate);
        examinedAt.push(examined);
      }
    }
    return {
      keys: found,
      examined: examined,
      examinedAt: examinedAt,
      exhausted: found.length < wanted
    };
  }

  /* -------------------------------------------------------------- avalanche */

  /**
   * Flip each of the 32 input bits in turn and record how often each output
   * bit changes. A good mixer sits at 0.5 everywhere.
   *
   * The verdict is a statistical test rather than a fixed 40-60% band,
   * because a fixed band is wrong at small sample counts: with 256 samples
   * the standard error of each cell is 3.1 points, so the worst of 1 024
   * cells lands outside 40-60% by chance alone and a perfectly good mixer
   * "fails". See `samplesForBand` for the count that makes the band mean
   * something.
   */
  function avalanche(options) {
    const hash = options.hash;
    const samples = options.samples || 512;
    const rng = options.rng;
    const matrix = [];
    for (let i = 0; i < 32; i += 1) matrix.push(new Float64Array(32));

    for (let s = 0; s < samples; s += 1) {
      const base = rng.int(0x7fffffff) >>> 0;
      const baseHash = hash(base) >>> 0;
      for (let inBit = 0; inBit < 32; inBit += 1) {
        const flipped = hash((base ^ (1 << inBit)) >>> 0) >>> 0;
        const diff = (baseHash ^ flipped) >>> 0;
        for (let outBit = 0; outBit < 32; outBit += 1) {
          if ((diff >>> outBit) & 1) matrix[inBit][outBit] += 1;
        }
      }
    }

    return summariseAvalanche(matrix, samples);
  }

  const CELLS = 32 * 32;
  const Z_BONFERRONI = 4.1;          // family-wise ~1% over 1 024 cells

  function summariseAvalanche(matrix, samples) {
    let min = 1;
    let max = 0;
    let total = 0;
    const rows = matrix.map(function (row) {
      const fractions = Array.from(row).map(function (count) { return count / samples; });
      fractions.forEach(function (value) {
        min = Math.min(min, value);
        max = Math.max(max, value);
        total += value;
      });
      return fractions;
    });

    const worstDeviation = Math.max(Math.abs(0.5 - min), Math.abs(0.5 - max));
    const standardError = Math.sqrt(0.25 / samples);

    return {
      matrix: rows,
      min: min,
      max: max,
      mean: total / CELLS,
      samples: samples,
      standardError: standardError,
      worstDeviation: worstDeviation,
      worstZ: worstDeviation / standardError,
      passes: worstDeviation / standardError <= Z_BONFERRONI,
      withinBand: min >= 0.4 && max <= 0.6,
      samplesForBand: samplesForBand()
    };
  }

  /** Samples needed before the 40-60% band is a real criterion, not noise. */
  function samplesForBand() {
    return Math.ceil(0.25 / Math.pow(0.1 / Z_BONFERRONI, 2));
  }

  /* ------------------------------------------------------------ distribution */

  /**
   * Chi-squared against a uniform expectation. The ratio chi2/dof is the
   * readable number: near 1 is uniform, far above 1 is clumped.
   */
  function chiSquared(options) {
    const buckets = options.buckets;
    const counts = new Uint32Array(buckets);
    options.keys.forEach(function (key) { counts[options.hash(key) % buckets] += 1; });

    const expected = options.keys.length / buckets;
    let chi2 = 0;
    for (let i = 0; i < buckets; i += 1) {
      const delta = counts[i] - expected;
      chi2 += (delta * delta) / expected;
    }

    const empty = Array.from(counts).filter(function (c) { return c === 0; }).length;
    return {
      chi2: chi2,
      dof: buckets - 1,
      ratio: chi2 / (buckets - 1),
      counts: Array.from(counts),
      maxBucket: counts.reduce(function (m, c) { return Math.max(m, c); }, 0),
      emptyBuckets: empty
    };
  }

  /* --------------------------------------------------------------- workload */

  /**
   * Drives a table through inserts, lookups and deletes, checking every
   * answer against a reference Map. Correctness is asserted continuously, so
   * a scheme that loses a key fails here rather than in a demo.
   */
  function run(options) {
    const table = options.table;
    const stream = options.keys;
    const reference = new Map();
    const deleteRate = options.deleteRate || 0;
    const rng = options.rng;
    const live = [];
    let mismatches = 0;

    stream.forEach(function (key, index) {
      table.set(key, index);
      reference.set(key, index);
      live.push(key);

      if (deleteRate > 0 && rng.next() < deleteRate && live.length) {
        const victim = live.splice(rng.int(live.length), 1)[0];
        table.delete(victim);
        reference.delete(victim);
      }
      if (index % 4 === 0 && live.length) {
        const probe = live[rng.int(live.length)];
        if (table.get(probe) !== reference.get(probe)) mismatches += 1;
      }
    });

    return verify({ table: table, reference: reference, mismatches: mismatches, stream: stream });
  }

  function verify(request) {
    const table = request.table;
    const reference = request.reference;
    let mismatches = request.mismatches;

    reference.forEach(function (value, key) {
      if (table.get(key) !== value) mismatches += 1;
    });
    request.stream.forEach(function (key) {
      if (!reference.has(key) && table.get(key) !== undefined) mismatches += 1;
    });

    const stats = table.stats();
    return {
      name: table.name,
      correct: mismatches === 0,
      mismatches: mismatches,
      size: table.size(),
      capacity: table.capacity(),
      loadFactor: table.size() / table.capacity(),
      stats: stats,
      probesPerLookup: stats.lookups ? stats.lookupProbes / stats.lookups : 0,
      probesPerInsert: stats.inserts ? stats.insertProbes / stats.inserts : 0
    };
  }

  return {
    keys: keys,
    collidingKeys: collidingKeys,
    avalanche: avalanche,
    chiSquared: chiSquared,
    run: run,
    samplesForBand: samplesForBand,
    WORDS: WORDS,
    Z_BONFERRONI: Z_BONFERRONI
  };
}));
