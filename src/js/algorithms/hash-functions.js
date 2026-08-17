/**
 * Hash functions for tables: FNV-1a, djb2, murmur3's finaliser, an xxhash-style
 * finaliser, multiply-shift and tabulation hashing.
 *
 * All arithmetic goes through Math.imul and >>> 0, because JavaScript numbers
 * are doubles and a plain `*` silently loses the low bits the moment the
 * product exceeds 2^53 - which is exactly what a mixing step produces.
 *
 * None of these are cryptographic. 3.2 makes the distinction concrete by
 * attacking the unkeyed ones.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HashFunctions = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const WORD = 0x100000000;

  /* ------------------------------------------------------------- finalisers */

  /** murmur3's fmix32: the mixing step, with no message absorption. */
  function murmurFinalise(value) {
    let h = value >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** The xxhash32 avalanche step - same shape, different constants. */
  function xxFinalise(value) {
    let h = value >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca77) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae3d) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** A deliberately weak finaliser: the section proves it fails avalanche. */
  function weakFinalise(value) {
    return ((value >>> 0) ^ ((value >>> 0) >>> 16)) >>> 0;
  }

  /* ------------------------------------------------------ string/number hashes */

  function fnv1a(key) {
    const text = String(key);
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function djb2(key) {
    const text = String(key);
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) {
      h = (Math.imul(h, 33) + text.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  /** djb2 with no finalising mix: low bits stay correlated. This is the bad one. */
  function djb2Raw(key) {
    return djb2(key);
  }

  function murmur3(key, seed) {
    const text = String(key);
    let h = (seed || 0) >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      let k = Math.imul(text.charCodeAt(i), 0xcc9e2d51) >>> 0;
      k = ((k << 15) | (k >>> 17)) >>> 0;
      k = Math.imul(k, 0x1b873593) >>> 0;
      h = (h ^ k) >>> 0;
      h = ((h << 13) | (h >>> 19)) >>> 0;
      h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    }
    return murmurFinalise((h ^ text.length) >>> 0);
  }

  /* --------------------------------------------------------- universal family */

  /**
   * Multiply-shift (Dietzfelbinger): h(x) = (a·x mod 2^w) >>> (w − m) with a
   * odd. Universal for w-bit keys, and two instructions on real hardware.
   */
  function multiplyShift(key, odd, bits) {
    const a = (odd | 1) >>> 0;
    const product = Math.imul(a, key >>> 0) >>> 0;
    return bits >= 32 ? product : product >>> (32 - bits);
  }

  /**
   * Tabulation hashing: split the key into bytes, look each byte up in its own
   * random table, XOR. Three-independent, and immune to the attack in 3.2 as
   * long as the tables are secret.
   */
  function buildTabulation(rng) {
    const tables = [];
    for (let byte = 0; byte < 4; byte += 1) {
      const table = new Uint32Array(256);
      for (let value = 0; value < 256; value += 1) table[value] = rng.int(WORD) >>> 0;
      tables.push(table);
    }
    return tables;
  }

  function tabulate(tables, key) {
    const k = key >>> 0;
    return (tables[0][k & 0xff] ^ tables[1][(k >>> 8) & 0xff] ^
      tables[2][(k >>> 16) & 0xff] ^ tables[3][(k >>> 24) & 0xff]) >>> 0;
  }

  /* ------------------------------------------------------------ composite keys */

  /** The bug: XOR is commutative, so (a, b) and (b, a) land in the same bucket. */
  function combineXor(parts) {
    return parts.reduce(function (acc, part) { return (acc ^ part) >>> 0; }, 0) >>> 0;
  }

  /** boost::hash_combine, which is order-sensitive because of the shifts. */
  function combineOrdered(parts) {
    return parts.reduce(function (acc, part) {
      const mixed = (part >>> 0) + 0x9e3779b9 + ((acc << 6) >>> 0) + (acc >>> 2);
      return (acc ^ mixed) >>> 0;
    }, 0) >>> 0;
  }

  const FUNCTIONS = {
    'fnv-1a': { label: 'FNV-1a', fn: fnv1a, note: 'byte-at-a-time, no finaliser' },
    djb2: { label: 'djb2', fn: djb2Raw, note: 'multiply-add, no finaliser' },
    murmur3: { label: 'murmur3', fn: function (key) { return murmur3(key, 0); }, note: 'mix plus finalise' },
    weak: { label: 'weak (identity + one shift)', fn: function (key) { return weakFinalise(fnv1a(key)); },
      note: 'included so the avalanche test can fail something' }
  };

  return {
    fnv1a: fnv1a,
    djb2: djb2Raw,
    murmur3: murmur3,
    murmurFinalise: murmurFinalise,
    xxFinalise: xxFinalise,
    weakFinalise: weakFinalise,
    multiplyShift: multiplyShift,
    buildTabulation: buildTabulation,
    tabulate: tabulate,
    combineXor: combineXor,
    combineOrdered: combineOrdered,
    FUNCTIONS: FUNCTIONS
  };
}));
