/**
 * Cuckoo filter: a set of fingerprints in a cuckoo hash table.
 *
 * Two things make it different from a Bloom filter. It stores an f-bit
 * fingerprint rather than setting k bits, so a delete is a removal rather than
 * an impossibility; and the second candidate bucket is derived from the first
 * by XOR with a hash of the fingerprint, so a relocation can compute the
 * alternative bucket from the stored fingerprint alone - the original key is
 * never needed and never kept.
 *
 *   i1 = h(x) mod b · i2 = i1 ⊕ (h(fingerprint) mod b)
 *
 * That XOR is an involution only when the bucket count is a power of two, so
 * the constructor rounds it to one. With any other modulus i2's alternative is
 * not i1 and relocation loses items silently.
 *
 * The hazard the section is built around: `remove` decrements nothing and
 * checks nothing. Removing an item that was never inserted deletes some other
 * item's fingerprint, and from then on the filter reports false negatives -
 * the one thing a filter is supposed never to do.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CuckooFilter = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const EMPTY = 0;

  function hashFunctions() {
    if (scope && scope.HashFunctions) return scope.HashFunctions;
    return require('./hash-functions.js');
  }

  function randomLib() {
    if (scope && scope.Random) return scope.Random;
    return require('../utils/random.js');
  }

  function powerOfTwoAtLeast(value) {
    let size = 1;
    while (size < value) size *= 2;
    return size;
  }

  /**
   * ≈ 2bα/2^f: a query tests the fingerprints in two buckets, and there are
   * 2b slots holding 2bα of them. The load matters and is easy to drop: a
   * half-empty table's error is half the full-table formula's, so quoting the
   * formula for a table rounded up to a power of two overstates the error by
   * the rounding factor.
   */
  function fprFor(options) {
    const load = options.load === undefined ? 1 : options.load;
    const slots = 2 * options.bucketSize * load;
    return 1 - Math.pow(1 - 1 / Math.pow(2, options.fingerprintBits), slots);
  }

  /**
   * Bits per item at a given load factor. The comparison against Bloom is the
   * point: (f + 3)/α against 1.44 log2(1/ε), and the cuckoo filter wins below
   * about 3% error and loses above it.
   */
  function bitsPerItem(options) {
    return (options.fingerprintBits + 3) / Math.max(1e-9, options.load);
  }

  function create(options) {
    const settings = options || {};
    const bucketSize = Math.max(1, Math.floor(settings.bucketSize || 4));
    const fingerprintBits = Math.min(16, Math.max(4, Math.floor(settings.fingerprintBits || 8)));
    const buckets = powerOfTwoAtLeast(Math.max(2, Math.ceil((settings.capacity || 1024) / bucketSize)));
    const maxKicks = Math.max(1, Math.floor(settings.maxKicks || 500));
    const seed = (settings.seed === undefined ? 1 : settings.seed) >>> 0;
    const table = new Uint16Array(buckets * bucketSize);
    const rng = randomLib().seeded(seed ^ 0x5bf03635);
    const mask = Math.pow(2, fingerprintBits) - 1;
    let items = 0;
    let stats = emptyStats();
    /* The orphan of a failed relocation chain. Dropping it instead would cost
       a false negative - the one error a filter must never make - so it is
       held here and the filter declares itself full. */
    let victim = null;

    /* A zero fingerprint is the empty marker, so it is folded to 1 rather than
       rejected: rejecting it would leak 1/2^f of the key space out of the
       filter entirely. */
    function fingerprintOf(key) {
      const H = hashFunctions();
      const value = H.murmur3(key, (seed + 0x27d4eb2f) >>> 0) & mask;
      return value === EMPTY ? 1 : value;
    }

    function primaryOf(key) {
      const H = hashFunctions();
      return H.murmur3(key, seed) % buckets;
    }

    function alternativeOf(index, fingerprint) {
      const H = hashFunctions();
      return (index ^ (H.murmurFinalise(fingerprint) % buckets)) % buckets;
    }

    function slotsOf(index) {
      return index * bucketSize;
    }

    function findIn(index, fingerprint) {
      const base = slotsOf(index);
      for (let i = 0; i < bucketSize; i += 1) {
        stats.slotReads += 1;
        if (table[base + i] === fingerprint) return base + i;
      }
      return -1;
    }

    function placeIn(index, fingerprint) {
      const base = slotsOf(index);
      for (let i = 0; i < bucketSize; i += 1) {
        if (table[base + i] === EMPTY) { table[base + i] = fingerprint; return true; }
      }
      return false;
    }

    /** The eviction walk, returned so the demo can draw the chain it took. */
    function relocate(startIndex, startFingerprint) {
      const chain = [];
      let index = startIndex;
      let fingerprint = startFingerprint;

      for (let kick = 0; kick < maxKicks; kick += 1) {
        const base = slotsOf(index);
        const slot = base + rng.int(bucketSize);
        const evicted = table[slot];
        table[slot] = fingerprint;
        chain.push({ bucket: index, evicted: evicted });
        stats.kicks += 1;
        fingerprint = evicted;
        index = alternativeOf(index, fingerprint);
        if (placeIn(index, fingerprint)) return { ok: true, chain: chain };
      }

      stats.insertFailures += 1;
      victim = { fingerprint: fingerprint, i1: index, i2: alternativeOf(index, fingerprint) };
      return { ok: false, chain: chain, orphan: fingerprint };
    }

    function add(key) {
      const fingerprint = fingerprintOf(key);
      const i1 = primaryOf(key);
      const i2 = alternativeOf(i1, fingerprint);
      stats.inserts += 1;
      if (victim) return { ok: false, chain: [], bucket: i1, full: true };

      if (placeIn(i1, fingerprint) || placeIn(i2, fingerprint)) {
        items += 1;
        return { ok: true, chain: [], bucket: i1 };
      }

      const result = relocate(rng.next() < 0.5 ? i1 : i2, fingerprint);
      items += 1;                      // the victim is still in the filter's set
      return { ok: result.ok, chain: result.chain, bucket: i1, full: !result.ok };
    }

    function has(key) {
      const fingerprint = fingerprintOf(key);
      const i1 = primaryOf(key);
      const i2 = alternativeOf(i1, fingerprint);
      stats.queries += 1;
      stats.linesTouched += i1 === i2 ? 1 : 2;
      if (matchesVictim(fingerprint, i1, i2)) return true;
      return findIn(i1, fingerprint) !== -1 || findIn(i2, fingerprint) !== -1;
    }

    /**
     * Removes one matching fingerprint. It does not and cannot check that the
     * key was ever inserted: another key sharing this fingerprint and bucket
     * is indistinguishable, and deleting it introduces a false negative.
     */
    function remove(key) {
      const fingerprint = fingerprintOf(key);
      const i1 = primaryOf(key);
      const i2 = alternativeOf(i1, fingerprint);
      stats.removes += 1;

      if (matchesVictim(fingerprint, i1, i2)) { victim = null; items -= 1; return true; }

      const primary = findIn(i1, fingerprint);
      const slot = primary !== -1 ? primary : findIn(i2, fingerprint);
      if (slot === -1) return false;
      table[slot] = EMPTY;
      items -= 1;
      return true;
    }

    function matchesVictim(fingerprint, i1, i2) {
      if (!victim || victim.fingerprint !== fingerprint) return false;
      return victim.i1 === i1 || victim.i1 === i2 || victim.i2 === i1 || victim.i2 === i2;
    }

    function occupancy() {
      const counts = new Array(bucketSize + 1).fill(0);
      for (let b = 0; b < buckets; b += 1) {
        let used = 0;
        for (let i = 0; i < bucketSize; i += 1) if (table[slotsOf(b) + i] !== EMPTY) used += 1;
        counts[used] += 1;
      }
      return counts;
    }

    return {
      kind: 'cuckoo',
      add: add,
      has: has,
      remove: remove,
      fingerprintOf: fingerprintOf,
      bucketsOf: function (key) {
        const fingerprint = fingerprintOf(key);
        const i1 = primaryOf(key);
        return { fingerprint: fingerprint, i1: i1, i2: alternativeOf(i1, fingerprint) };
      },
      table: function () { return table; },
      buckets: function () { return buckets; },
      bucketSize: function () { return bucketSize; },
      fingerprintBits: function () { return fingerprintBits; },
      capacity: function () { return buckets * bucketSize; },
      count: function () { return items; },
      load: function () { return items / (buckets * bucketSize); },
      bits: function () { return buckets * bucketSize * fingerprintBits; },
      bytes: function () { return Math.ceil(buckets * bucketSize * fingerprintBits / 8); },
      occupancy: occupancy,
      full: function () { return victim !== null; },
      predictedFpr: function () {
        return fprFor({ bucketSize: bucketSize, fingerprintBits: fingerprintBits, load: items / (buckets * bucketSize) });
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  function emptyStats() {
    return { queries: 0, inserts: 0, removes: 0, kicks: 0, insertFailures: 0, slotReads: 0, linesTouched: 0 };
  }

  /**
   * Fills a filter until an insert fails, and reports where that happened.
   * The failure point is the number the section is about: a cuckoo filter has
   * a hard ceiling, and a Bloom filter does not.
   */
  function fillUntilFailure(options) {
    const filter = create(options);
    const limit = options.limit || filter.capacity() * 2;
    let inserted = 0;

    for (let i = 0; i < limit; i += 1) {
      const result = filter.add((options.prefix || 'k') + i);
      if (!result.ok) {
        return { filter: filter, inserted: inserted, failedAt: i, load: filter.load(), full: true };
      }
      inserted += 1;
    }

    return { filter: filter, inserted: inserted, failedAt: null, load: filter.load(), full: false };
  }

  return {
    create: create,
    fillUntilFailure: fillUntilFailure,
    fprFor: fprFor,
    bitsPerItem: bitsPerItem
  };
}));
