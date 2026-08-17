/**
 * HyperLogLog: distinct-count estimation from the longest run of leading zeros
 * seen per register.
 *
 * The idea in one line: if hashes are uniform, seeing a hash with ρ leading
 * zeros suggests roughly 2^ρ distinct values have gone past. One register would
 * have enormous variance, so the first bits of the hash choose one of m = 2^p
 * registers and the estimate is the *harmonic* mean of their 2^M[j] - harmonic
 * because it is the mean that a single overlarge register cannot dominate.
 * Standard error is 1.04/√m, independent of the cardinality.
 *
 * Two representations, as in HLL++: a sparse Map of (index, ρ) pairs while the
 * set is small, promoted to a dense byte per register when the sparse form
 * stops being cheaper. Both answer the same query; the sparse form is exact for
 * small sets because it is really a distinct-index count.
 *
 * The correction here is linear counting whenever a register is still zero,
 * which is what removes the raw estimator's bias below about 2.5m. HLL++
 * replaces that rule with an empirically tabulated bias correction and a
 * per-precision threshold; those tables are not in this implementation and the
 * demo says so rather than implying the accuracy they buy.
 *
 * Hashes are 32-bit, so p bits index a register and 32 − p bits are left to
 * count zeros. That caps ρ at 33 − p and means the estimate degrades once the
 * cardinality approaches the hash space, which the large-range correction
 * partially undoes.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HyperLogLog = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const TWO32 = 4294967296;

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  /** Flajolet's α_m, which removes the estimator's multiplicative bias. */
  function alphaFor(m) {
    if (m === 16) return 0.673;
    if (m === 32) return 0.697;
    if (m === 64) return 0.709;
    return 0.7213 / (1 + 1.079 / m);
  }

  function standardError(m) {
    return 1.04 / Math.sqrt(m);
  }

  /** Registers needed for a target relative error. */
  function precisionFor(relativeError) {
    const m = Math.pow(1.04 / Math.max(1e-6, relativeError), 2);
    return Math.max(4, Math.min(18, Math.ceil(Math.log2(m))));
  }

  /** ρ: one plus the number of leading zeros in the value's low bits. */
  function rankOf(value, bits) {
    let rank = 1;
    let mask = 1 << (bits - 1);
    while (mask && (value & mask) === 0) {
      rank += 1;
      mask >>>= 1;
    }
    return rank;
  }

  function create(options) {
    const settings = options || {};
    const precision = Math.max(4, Math.min(18, Math.floor(settings.precision || 12)));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const m = Math.pow(2, precision);
    const valueBits = 32 - precision;
    const alpha = alphaFor(m);
    const sparseLimit = settings.sparseLimit === undefined ? Math.floor(m / 4) : settings.sparseLimit;

    let registers = settings.dense ? new Uint8Array(m) : null;
    let sparse = settings.dense ? null : new Map();
    let stats = { adds: 0, promotions: 0, sparseAt: 0 };

    function placement(key) {
      const H = hashFunctions();
      const hash = H.murmur3(key, seed) >>> 0;
      const index = hash >>> valueBits;
      const rest = (hash << precision) >>> precision;
      return { index: index, rank: rankOf(rest, valueBits) };
    }

    function promote() {
      registers = new Uint8Array(m);
      sparse.forEach(function (rank, index) {
        if (rank > registers[index]) registers[index] = rank;
      });
      sparse = null;
      stats.promotions += 1;
    }

    function add(key) {
      const spot = placement(key);
      stats.adds += 1;

      if (registers) {
        if (spot.rank > registers[spot.index]) registers[spot.index] = spot.rank;
        return;
      }

      const current = sparse.get(spot.index) || 0;
      if (spot.rank > current) sparse.set(spot.index, spot.rank);
      stats.sparseAt = sparse.size;
      if (sparse.size > sparseLimit) promote();
    }

    function values() {
      if (registers) return registers;
      const dense = new Uint8Array(m);
      sparse.forEach(function (rank, index) { dense[index] = rank; });
      return dense;
    }

    function zeros() {
      const dense = values();
      let count = 0;
      for (let i = 0; i < m; i += 1) if (dense[i] === 0) count += 1;
      return count;
    }

    /** αm²/Σ2^−M[j] before any correction, so the demo can plot the bias. */
    function raw() {
      const dense = values();
      let sum = 0;
      for (let i = 0; i < m; i += 1) sum += Math.pow(2, -dense[i]);
      return alpha * m * m / sum;
    }

    function estimate() {
      const rawEstimate = raw();
      const empty = zeros();

      if (empty > 0 && rawEstimate <= 2.5 * m) return m * Math.log(m / empty);
      if (rawEstimate > TWO32 / 30) return -TWO32 * Math.log(1 - rawEstimate / TWO32);
      return rawEstimate;
    }

    function histogram() {
      const dense = values();
      const bins = [];
      for (let i = 0; i < m; i += 1) {
        while (bins.length <= dense[i]) bins.push(0);
        bins[dense[i]] += 1;
      }
      return bins;
    }

    return {
      kind: 'hyperloglog',
      add: add,
      estimate: estimate,
      raw: raw,
      zeros: zeros,
      histogram: histogram,
      registers: values,
      isSparse: function () { return registers === null; },
      sparseSize: function () { return registers ? 0 : sparse.size; },
      precision: function () { return precision; },
      m: function () { return m; },
      standardError: function () { return standardError(m); },
      /* Dense storage is one byte per register here. A packed HLL uses 6 bits,
         which is the number every paper quotes, so both are reported. */
      bytes: function () { return registers ? m : sparse.size * 4; },
      packedBytes: function () { return Math.ceil(m * 6 / 8); },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = { adds: 0, promotions: 0, sparseAt: 0 }; }
    };
  }

  /**
   * Register-wise maximum. This is exactly the sketch of the concatenated
   * stream - not an approximation of it - because a register holds a maximum
   * and the maximum of two maxima is the maximum of the union.
   */
  function merge(sketches) {
    if (!sketches.length) throw new Error('HyperLogLog.merge: nothing to merge');
    const first = sketches[0];
    const out = create({ precision: first.precision(), seed: 1, dense: true });
    const target = out.registers();

    sketches.forEach(function (sketch) {
      if (sketch.precision() !== first.precision()) {
        throw new Error('HyperLogLog.merge: precision ' + sketch.precision() +
          ' cannot merge with ' + first.precision());
      }
      const source = sketch.registers();
      for (let i = 0; i < target.length; i += 1) {
        if (source[i] > target[i]) target[i] = source[i];
      }
    });

    return out;
  }

  /** Register-array equality, which is how the merge criterion is checked. */
  function sameRegisters(a, b) {
    const left = a.registers();
    const right = b.registers();
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false;
    return true;
  }

  return {
    create: create,
    merge: merge,
    sameRegisters: sameRegisters,
    alphaFor: alphaFor,
    standardError: standardError,
    precisionFor: precisionFor,
    rankOf: rankOf
  };
}));
