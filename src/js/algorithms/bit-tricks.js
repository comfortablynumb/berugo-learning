/**
 * The bit-manipulation toolkit, each trick paired with the obvious loop it
 * replaces and both instrumented, so "faster" is a count rather than a claim.
 *
 * Two things make this file worth having as a module rather than as snippets.
 * The first is that every routine here has a naive twin in the same file and
 * the tests run them against each other over all 2^16 low words - a bit trick
 * that is right on the values you tried is the single most common way this
 * material goes wrong, because the failures cluster at zero, at the sign bit
 * and at powers of two, and those are exactly the values a hand-written check
 * skips. The second is the counter: `ops` on every result is the number of
 * primitive operations the routine performed, so the demo can show that
 * popcount by SWAR is twelve operations for any input while the loop is
 * thirty-two, without either of them being timed.
 *
 * Everything operates on JavaScript's int32 semantics, unsigned where it
 * matters. `>>>` is the only shift that yields an unsigned result, so it
 * appears everywhere a value must not go negative; `>>` where sign extension
 * is wanted, which is once, deliberately, in the branchless absolute value.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitTricks = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------- popcount */

  /** The definition: look at every bit, whatever the input. */
  function popcountLoop(x) {
    let value = x >>> 0;
    let count = 0;
    let ops = 0;
    for (let i = 0; i < 32; i += 1) {
      count += value & 1;
      value >>>= 1;
      ops += 3;
    }
    return { count: count, ops: ops };
  }

  /**
   * Kernighan's loop: `x & (x - 1)` clears the lowest set bit, so the loop
   * runs once per set bit rather than once per bit. Data-dependent, which is
   * its virtue on sparse words and its vice in a branch predictor.
   */
  function popcountKernighan(x) {
    let value = x >>> 0;
    let count = 0;
    let ops = 0;
    while (value !== 0) {
      value &= value - 1;
      count += 1;
      ops += 3;
    }
    return { count: count, ops: ops };
  }

  /**
   * SWAR: treat the 32-bit word as a vector of small counters and sum
   * pairwise. Stage one turns 16 pairs of bits into 16 two-bit counts, stage
   * two into 8 four-bit counts, and so on; the final multiply-and-shift sums
   * four byte-counters at once because 0x01010101 times a value is the sum of
   * its bytes in the top byte. No branches, no data dependence, constant work.
   */
  function popcountSwar(x) {
    let v = x >>> 0;
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    v = (v + (v >>> 4)) & 0x0f0f0f0f;
    return { count: (Math.imul(v, 0x01010101) >>> 24), ops: 12 };
  }

  /** The stages of the SWAR reduction, for the demo to display. */
  function popcountStages(x) {
    const stages = [];
    let v = x >>> 0;
    stages.push({ label: 'input', value: v >>> 0, meaning: '32 one-bit counters' });
    v = v - ((v >>> 1) & 0x55555555);
    stages.push({ label: 'pairs', value: v >>> 0, meaning: '16 two-bit counters, each 0 to 2' });
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    stages.push({ label: 'nibbles', value: v >>> 0, meaning: '8 four-bit counters, each 0 to 4' });
    v = (v + (v >>> 4)) & 0x0f0f0f0f;
    stages.push({ label: 'bytes', value: v >>> 0, meaning: '4 eight-bit counters, each 0 to 8' });
    const total = Math.imul(v, 0x01010101) >>> 24;
    stages.push({ label: 'sum', value: total, meaning: 'one multiply sums the four byte counters' });
    return stages;
  }

  const TABLE8 = (function () {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) table[i] = table[i >> 1] + (i & 1);
    return table;
  }());

  function popcountTable(x) {
    const v = x >>> 0;
    const count = TABLE8[v & 0xff] + TABLE8[(v >>> 8) & 0xff] +
      TABLE8[(v >>> 16) & 0xff] + TABLE8[(v >>> 24) & 0xff];
    return { count: count, ops: 12 };
  }

  /* ----------------------------------------------------------- bit scans */

  function ctzLoop(x) {
    const v = x >>> 0;
    if (v === 0) return { index: 32, ops: 1 };
    let index = 0;
    let ops = 0;
    while (((v >>> index) & 1) === 0) { index += 1; ops += 3; }
    return { index: index, ops: ops + 1 };
  }

  /**
   * The De Bruijn trick. `x & -x` isolates the lowest set bit, leaving a power
   * of two; multiplying a De Bruijn sequence by 2^k rotates it so that the top
   * five bits are a distinct pattern for each k, which indexes a table. One
   * and, one negate, one multiply, one shift, one load - constant, branchless,
   * and completely opaque until you know that the sequence is chosen so that
   * every five-bit window of it is different.
   */
  const DE_BRUIJN32 = 0x077cb531;
  const DE_BRUIJN_TABLE = (function () {
    const table = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      table[(Math.imul(DE_BRUIJN32, 1 << i) >>> 27)] = i;
    }
    return table;
  }());

  function ctzDeBruijn(x) {
    const v = x >>> 0;
    if (v === 0) return { index: 32, ops: 1 };
    const isolated = v & -v;
    return { index: DE_BRUIJN_TABLE[Math.imul(DE_BRUIJN32, isolated) >>> 27], ops: 5 };
  }

  function clzLoop(x) {
    const v = x >>> 0;
    if (v === 0) return { index: 32, ops: 1 };
    let index = 0;
    let ops = 0;
    while (((v >>> (31 - index)) & 1) === 0) { index += 1; ops += 3; }
    return { index: index, ops: ops + 1 };
  }

  /** JavaScript hands this one over: `Math.clz32` is a single instruction on
   *  every engine, and the loop above exists only as its oracle. */
  function clz(x) {
    return { index: Math.clz32(x >>> 0), ops: 1 };
  }

  function lowestSetBit(x) { return (x & -x) >>> 0; }
  function clearLowestSetBit(x) { return (x & (x - 1)) >>> 0; }

  /* --------------------------------------------------- powers and rounding */

  function isPowerOfTwo(x) {
    const v = x >>> 0;
    return v !== 0 && (v & (v - 1)) === 0;
  }

  /**
   * Round up to a power of two by smearing the highest set bit down over every
   * lower position and then adding one. The `- 1` at the top is what makes an
   * exact power of two map to itself instead of to the next one.
   */
  function nextPowerOfTwoSmear(x) {
    /* Zero is the trick's one wrong answer and it is worth keeping in view.
       `0 - 1` smears to all ones and `+ 1` carries off the top of the word, so
       the routine returns 0 for an input of 0 - which is Hacker's Delight's
       stated behaviour and not what a caller sizing a buffer wants. The guard
       is the fix; deleting it is how a growth policy ends up allocating a
       zero-length array on the first push. */
    if ((x >>> 0) === 0) return { value: 1, ops: 1 };
    let v = (x >>> 0) - 1;
    v |= v >>> 1; v |= v >>> 2; v |= v >>> 4; v |= v >>> 8; v |= v >>> 16;
    return { value: (v + 1) >>> 0, ops: 12 };
  }

  function nextPowerOfTwoLoop(x) {
    const v = x >>> 0;
    let power = 1;
    let ops = 0;
    while (power < v) { power *= 2; ops += 2; }
    return { value: power >>> 0, ops: ops + 1 };
  }

  /* --------------------------------------------------------- Gray coding */

  /** Successive Gray codes differ in exactly one bit, which is why a rotary
   *  encoder uses them: a reading caught mid-transition is one of the two
   *  neighbours rather than an arbitrary third value. */
  function grayEncode(x) { return ((x >>> 0) ^ ((x >>> 0) >>> 1)) >>> 0; }

  function grayDecode(x) {
    let v = x >>> 0;
    v ^= v >>> 1; v ^= v >>> 2; v ^= v >>> 4; v ^= v >>> 8; v ^= v >>> 16;
    return v >>> 0;
  }

  /* ------------------------------------------------------- bit reversal */

  function reverseLoop(x) {
    let v = x >>> 0;
    let out = 0;
    let ops = 0;
    for (let i = 0; i < 32; i += 1) {
      out = ((out << 1) | (v & 1)) >>> 0;
      v >>>= 1;
      ops += 4;
    }
    return { value: out >>> 0, ops: ops };
  }

  /** The same pairwise-swap idea as SWAR popcount, run in the other
   *  direction: swap adjacent bits, then pairs, then nibbles, then bytes. */
  function reverseSwar(x) {
    let v = x >>> 0;
    v = ((v >>> 1) & 0x55555555) | ((v & 0x55555555) << 1);
    v = ((v >>> 2) & 0x33333333) | ((v & 0x33333333) << 2);
    v = ((v >>> 4) & 0x0f0f0f0f) | ((v & 0x0f0f0f0f) << 4);
    v = ((v >>> 8) & 0x00ff00ff) | ((v & 0x00ff00ff) << 8);
    return { value: ((v >>> 16) | (v << 16)) >>> 0, ops: 17 };
  }

  /* --------------------------------------------------------- branchless */

  /**
   * `x >> 31` is all ones for a negative int32 and all zeros otherwise, which
   * turns a sign test into a mask. This is the one place in the file that
   * wants the arithmetic shift rather than the logical one.
   */
  function absBranchless(x) {
    const v = x | 0;
    const mask = v >> 31;
    return ((v + mask) ^ mask) | 0;
  }

  function minBranchless(a, b) {
    return (b | 0) + (((a | 0) - (b | 0)) & (((a | 0) - (b | 0)) >> 31)) | 0;
  }

  function maxBranchless(a, b) {
    return (a | 0) - (((a | 0) - (b | 0)) & (((a | 0) - (b | 0)) >> 31)) | 0;
  }

  /* ------------------------------------------------------------- fields */

  function testBit(x, i) { return (((x >>> 0) >>> i) & 1) === 1; }
  function setBit(x, i) { return ((x >>> 0) | (1 << i)) >>> 0; }
  function clearBit(x, i) { return ((x >>> 0) & ~(1 << i)) >>> 0; }
  function toggleBit(x, i) { return ((x >>> 0) ^ (1 << i)) >>> 0; }

  /** A mask of `count` ones. Built by shifting rather than by `(1 << n) - 1`
   *  because a shift of 32 in JavaScript is a shift of 0, so the full-width
   *  mask would come out as zero. */
  function maskOf(count) {
    if (count >= 32) return 0xffffffff >>> 0;
    return ((1 << count) - 1) >>> 0;
  }

  function extractField(x, offset, count) {
    return (((x >>> 0) >>> offset) & maskOf(count)) >>> 0;
  }

  function insertField(x, value, field) {
    const mask = maskOf(field.count) << field.offset;
    return (((x >>> 0) & ~mask) | ((value & maskOf(field.count)) << field.offset)) >>> 0;
  }

  /** Every trick the explorer can show, with the loop it is measured against. */
  const CATALOGUE = [
    { id: 'popcount', label: 'population count', fast: popcountSwar, slow: popcountLoop,
      field: 'count' },
    { id: 'popcount-kernighan', label: 'popcount, Kernighan', fast: popcountKernighan,
      slow: popcountLoop, field: 'count' },
    { id: 'popcount-table', label: 'popcount, byte table', fast: popcountTable,
      slow: popcountLoop, field: 'count' },
    { id: 'ctz', label: 'count trailing zeros', fast: ctzDeBruijn, slow: ctzLoop, field: 'index' },
    { id: 'clz', label: 'count leading zeros', fast: clz, slow: clzLoop, field: 'index' },
    { id: 'next-pow2', label: 'round up to a power of two', fast: nextPowerOfTwoSmear,
      slow: nextPowerOfTwoLoop, field: 'value' },
    { id: 'reverse', label: 'reverse the bits', fast: reverseSwar, slow: reverseLoop,
      field: 'value' }
  ];

  function trickFor(id) {
    for (let i = 0; i < CATALOGUE.length; i += 1) {
      if (CATALOGUE[i].id === id) return CATALOGUE[i];
    }
    return CATALOGUE[0];
  }

  return {
    popcountLoop: popcountLoop,
    popcountKernighan: popcountKernighan,
    popcountSwar: popcountSwar,
    popcountTable: popcountTable,
    popcountStages: popcountStages,
    ctzLoop: ctzLoop,
    ctzDeBruijn: ctzDeBruijn,
    clzLoop: clzLoop,
    clz: clz,
    lowestSetBit: lowestSetBit,
    clearLowestSetBit: clearLowestSetBit,
    isPowerOfTwo: isPowerOfTwo,
    nextPowerOfTwoSmear: nextPowerOfTwoSmear,
    nextPowerOfTwoLoop: nextPowerOfTwoLoop,
    grayEncode: grayEncode,
    grayDecode: grayDecode,
    reverseLoop: reverseLoop,
    reverseSwar: reverseSwar,
    absBranchless: absBranchless,
    minBranchless: minBranchless,
    maxBranchless: maxBranchless,
    testBit: testBit,
    setBit: setBit,
    clearBit: clearBit,
    toggleBit: toggleBit,
    maskOf: maskOf,
    extractField: extractField,
    insertField: insertField,
    DE_BRUIJN32: DE_BRUIJN32,
    CATALOGUE: CATALOGUE,
    trickFor: trickFor
  };
}));
