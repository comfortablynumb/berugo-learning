/**
 * Perfect hashing for a key set that is fixed at build time.
 *
 * Two constructions: FKS, which is the classic two-level scheme with a
 * guaranteed O(1) worst case and O(n) space; and hash-and-displace (the CHD
 * family), which produces a *minimal* perfect hash - every key maps to a
 * distinct index in [0, n) with no holes at all.
 *
 * Both pay their cost once, at build time, and then answer a lookup with a
 * single probe and no comparison chain. If the keys never change, a hash
 * table is doing work nobody asked for.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PerfectHash = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  /* ------------------------------------------------------------------- FKS */

  /**
   * Level 1 spreads n keys over n buckets; level 2 gives a bucket of b keys a
   * table of b² slots, which by the birthday bound is collision-free after a
   * handful of seed retries. Expected total space is O(n) because
   * E[Σ b_i²] < 2n.
   */
  function buildFks(options) {
    const keys = options.keys;
    const hash = options.hash;
    const n = keys.length;
    const buckets = [];
    for (let i = 0; i < n; i += 1) buckets.push([]);
    keys.forEach(function (key) { buckets[hash(key, 0) % n].push(key); });

    let attempts = 0;
    const levels = buckets.map(function (bucket) {
      if (bucket.length <= 1) return { size: bucket.length, seed: 0, slots: bucket.slice() };
      const size = bucket.length * bucket.length;
      for (let seed = 1; seed < 4096; seed += 1) {
        attempts += 1;
        const slots = tryPlace(bucket, hash, seed, size);
        if (slots) return { size: size, seed: seed, slots: slots };
      }
      throw new Error('no collision-free seed for a bucket of ' + bucket.length);
    });

    const secondary = levels.reduce(function (sum, level) { return sum + level.size; }, 0);
    return {
      kind: 'fks',
      n: n,
      levels: levels,
      slotsUsed: n + secondary,
      secondarySlots: secondary,
      seedAttempts: attempts,
      spaceRatio: (n + secondary) / n,
      lookup: function (key) {
        const level = levels[hash(key, 0) % n];
        if (!level.size) return -1;
        if (level.size === 1) return level.slots[0] === key ? 0 : -1;
        const at = hash(key, level.seed) % level.size;
        return level.slots[at] === key ? at : -1;
      }
    };
  }

  function tryPlace(bucket, hash, seed, size) {
    const slots = new Array(size).fill(undefined);
    for (let i = 0; i < bucket.length; i += 1) {
      const at = hash(bucket[i], seed) % size;
      if (slots[at] !== undefined) return null;
      slots[at] = bucket[i];
    }
    return slots;
  }

  /* ----------------------------------------------- hash, displace, compress */

  /**
   * Keys are grouped by a first hash into r = ceil(n / lambda) buckets, the
   * buckets are placed largest-first, and each bucket gets a displacement d
   * such that every key in it lands on a still-free slot. Only the
   * displacement array is stored, so the structure is a few bits per key.
   */
  function buildChd(options) {
    const keys = options.keys;
    const hash = options.hash;
    const lambda = options.lambda || 4;
    const n = keys.length;
    const r = Math.max(1, Math.ceil(n / lambda));

    const buckets = [];
    for (let i = 0; i < r; i += 1) buckets.push({ index: i, keys: [] });
    keys.forEach(function (key) { buckets[hash(key, 0) % r].keys.push(key); });
    buckets.sort(function (a, b) { return b.keys.length - a.keys.length; });

    const displacements = new Int32Array(r).fill(-1);
    const taken = new Array(n).fill(false);
    const placed = new Array(n).fill(undefined);
    let attempts = 0;

    buckets.forEach(function (bucket) {
      if (!bucket.keys.length) { displacements[bucket.index] = 0; return; }
      for (let d = 0; d < 100000; d += 1) {
        attempts += 1;
        const slots = tryDisplace(bucket.keys, hash, d, { n: n, taken: taken });
        if (!slots) continue;
        slots.forEach(function (slot, i) { taken[slot] = true; placed[slot] = bucket.keys[i]; });
        displacements[bucket.index] = d;
        return;
      }
      throw new Error('no displacement found for bucket ' + bucket.index);
    });

    return finishChd({ n: n, r: r, hash: hash, displacements: displacements,
      placed: placed, attempts: attempts, buckets: buckets });
  }

  function tryDisplace(bucketKeys, hash, d, space) {
    const slots = [];
    const used = new Set();
    for (let i = 0; i < bucketKeys.length; i += 1) {
      const at = hash(bucketKeys[i], d + 1) % space.n;
      if (space.taken[at] || used.has(at)) return null;
      used.add(at);
      slots.push(at);
    }
    return slots;
  }

  function finishChd(state) {
    const hash = state.hash;
    const displacements = state.displacements;
    const maxDisplacement = displacements.reduce(function (m, d) { return Math.max(m, d); }, 0);
    const bitsPerEntry = Math.max(1, Math.ceil(Math.log2(maxDisplacement + 1)));
    const largest = state.buckets.length ? state.buckets[0].keys.length : 0;

    return {
      kind: 'chd',
      n: state.n,
      buckets: state.r,
      displacements: Array.from(displacements),
      maxDisplacement: maxDisplacement,
      largestBucket: largest,
      displacementAttempts: state.attempts,
      bitsPerKey: (state.r * bitsPerEntry) / state.n,
      minimal: state.placed.every(function (key) { return key !== undefined; }),
      lookup: function (key) {
        const d = displacements[hash(key, 0) % state.r];
        return hash(key, d + 1) % state.n;
      },
      placed: state.placed
    };
  }

  /**
   * A seeded string hash, so both constructions can retry with a new seed.
   *
   * The finaliser is not decoration. Both constructions reduce modulo a small
   * power of two (b² slots, n slots), so they read the *low* bits, and a
   * byte-at-a-time hash with no finaliser has the property that appending the
   * same suffix to two keys preserves whatever their low bits already agreed
   * on. Two such keys then collide under every seed and the search for a
   * collision-free one never terminates. Mixing the result makes the
   * construction work for any base function, including the unfinalised ones
   * next door.
   */
  function seededHash(base) {
    const finalise = hashFunctions().murmurFinalise;
    return function (key, seed) {
      return finalise(base(String(key) + '\u0001' + (seed || 0)));
    };
  }

  return { buildFks: buildFks, buildChd: buildChd, seededHash: seededHash };
}));
