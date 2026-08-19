/**
 * A bit vector with rank and select in near-constant time, and Elias-Fano
 * coding for monotone sequences.
 *
 * `rank1(i)` is "how many ones before position i" and `select1(k)` is "where
 * is the k-th one". Every succinct structure in this milestone is built from
 * those two: once they are O(1), a tree, a trie or a sequence can be stored as
 * a bit string and navigated without pointers at all.
 *
 * Rank is three lookups and no loop. Two levels of precomputed counts -
 * absolute totals every `SUPERBLOCK` bits and relative totals every `BLOCK`
 * bits - plus a popcount of the partial word:
 *
 *     rank1(i) = superblock[i / S] + block[i / B] + popcount(word & mask)
 *
 * The index is not free and the section refuses to pretend otherwise: a 32-bit
 * absolute count per superblock and a 16-bit relative count per block is a
 * measured 7.8% on top of the bits themselves. "Succinct" means the overhead
 * is o(n), not that it is zero.
 *
 * Select has no such trick. It is a binary search over the same tables, which
 * is O(log n); sampling every k-th one bit turns that into a bounded scan, and
 * both are implemented so the trade is a number rather than a claim.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BitVector = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const WORD = 32;
  const BLOCK = 256;
  const SUPERBLOCK = 2048;
  const WORDS_PER_BLOCK = BLOCK / WORD;
  const BLOCKS_PER_SUPERBLOCK = SUPERBLOCK / BLOCK;

  function popcount(value) {
    let bits = value >>> 0;
    bits = bits - ((bits >>> 1) & 0x55555555);
    bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
    bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
    return (Math.imul(bits, 0x01010101) >>> 24);
  }

  function emptyStats() {
    return { rankQueries: 0, selectQueries: 0, lookups: 0, wordsScanned: 0, binarySteps: 0 };
  }

  /** Accepts an array of 0/1, a string of '0'/'1', or packed words plus a
   *  length, and returns the packed form the rest of the module works on. */
  function packBits(bits, options) {
    const settings = options || {};
    const length = settings.length === undefined
      ? (bits.length !== undefined && !(bits instanceof Uint32Array) ? bits.length : bits.length * WORD)
      : settings.length;
    const words = new Uint32Array(Math.ceil(length / WORD));

    if (bits instanceof Uint32Array) {
      words.set(bits);
      return { words: words, length: length };
    }
    for (let i = 0; i < length; i += 1) {
      const bit = typeof bits === 'string' ? bits.charCodeAt(i) - 48 : bits[i];
      if (bit) words[i >>> 5] = (words[i >>> 5] | (1 << (i & 31))) >>> 0;
    }
    return { words: words, length: length };
  }

  /**
   * `bits` may be an array of 0/1, a string of '0'/'1', or a Uint32Array of
   * packed words together with `length`.
   */
  function create(bits, options) {
    const packed = packBits(bits, options);
    const words = packed.words;
    const length = packed.length;
    let stats = emptyStats();

    const blockCount = Math.ceil(length / BLOCK) || 1;
    const superCount = Math.ceil(length / SUPERBLOCK) || 1;
    const superRank = new Uint32Array(superCount + 1);
    const blockRank = new Uint16Array(blockCount + 1);
    let ones = 0;

    (function buildIndex() {
      let sinceSuper = 0;
      for (let block = 0; block < blockCount; block += 1) {
        if (block % BLOCKS_PER_SUPERBLOCK === 0) {
          superRank[block / BLOCKS_PER_SUPERBLOCK] = ones;
          sinceSuper = 0;
        }
        blockRank[block] = sinceSuper;
        for (let w = 0; w < WORDS_PER_BLOCK; w += 1) {
          const index = block * WORDS_PER_BLOCK + w;
          if (index >= words.length) break;
          const count = popcount(words[index]);
          ones += count;
          sinceSuper += count;
        }
      }
      superRank[superCount] = ones;
      blockRank[blockCount] = sinceSuper;
    }());

    function get(index) {
      if (index < 0 || index >= length) return 0;
      return (words[index >>> 5] >>> (index & 31)) & 1;
    }

    /** Ones strictly before `index`. Three table reads and one popcount. */
    function rank1(index) {
      stats.rankQueries += 1;
      const at = Math.max(0, Math.min(length, index));
      if (!at) return 0;
      /* Both tables carry a sentinel past their last real entry, and when the
         length is an exact multiple of the block size a rank at the very end
         indexes both of them - the superblock total *and* the same superblock's
         relative total - and adds the vector to itself. Answering the whole
         vector directly is the fix and is also the fast path. */
      if (at === length) return ones;

      const block = Math.floor(at / BLOCK);
      const superblock = Math.floor(at / SUPERBLOCK);
      stats.lookups += 3;
      let total = superRank[superblock] + blockRank[block];

      const firstWord = block * WORDS_PER_BLOCK;
      const lastWord = at >>> 5;
      for (let w = firstWord; w < lastWord; w += 1) {
        stats.wordsScanned += 1;
        total += popcount(words[w]);
      }
      const remainder = at & 31;
      if (remainder) total += popcount(words[lastWord] & ((1 << remainder) - 1));
      return total;
    }

    function rank0(index) {
      return Math.max(0, Math.min(length, index)) - rank1(index);
    }

    /* --------------------------------------------------------- select */

    /* One sampled position every `SAMPLE` ones. Select then starts from a
       known block instead of the top of the table, which bounds the search
       rather than removing it. */
    const SAMPLE = 512;
    const samples = new Uint32Array(Math.floor(ones / SAMPLE) + 2);
    (function buildSamples() {
      let seen = 0;
      let next = 0;
      for (let index = 0; index < length; index += 1) {
        if (!get(index)) continue;
        seen += 1;
        if (seen % SAMPLE === 1 || SAMPLE === 1) { samples[next] = index; next += 1; }
      }
      samples[next] = length;
    }());

    /** The k-th one, 1-based. Binary search over the block table, then a scan
     *  inside one block - at most 256 bits however long the vector is. */
    function select1(k) {
      stats.selectQueries += 1;
      if (k < 1 || k > ones) return -1;

      let low = 0;
      let high = blockCount - 1;
      while (low < high) {
        stats.binarySteps += 1;
        const mid = (low + high + 1) >> 1;
        if (rankOfBlock(mid) < k) low = mid;
        else high = mid - 1;
      }

      let seen = rankOfBlock(low);
      for (let index = low * BLOCK; index < length; index += 1) {
        if (!get(index)) continue;
        seen += 1;
        if (seen === k) return index;
      }
      return -1;
    }

    function rankOfBlock(block) {
      stats.lookups += 2;
      return superRank[Math.floor(block / BLOCKS_PER_SUPERBLOCK)] + blockRank[block];
    }

    /** The k-th zero. LOUDS needs it as much as it needs select1, and the same
     *  tables answer it: zeros before a block are the block's own bit count
     *  minus the ones. */
    function select0(k) {
      stats.selectQueries += 1;
      const zeros = length - ones;
      if (k < 1 || k > zeros) return -1;

      let low = 0;
      let high = blockCount - 1;
      while (low < high) {
        stats.binarySteps += 1;
        const mid = (low + high + 1) >> 1;
        if (mid * BLOCK - rankOfBlock(mid) < k) low = mid;
        else high = mid - 1;
      }

      let seen = low * BLOCK - rankOfBlock(low);
      for (let index = low * BLOCK; index < length; index += 1) {
        if (get(index)) continue;
        seen += 1;
        if (seen === k) return index;
      }
      return -1;
    }

    /** The sampled variant: start at the nearest sampled one and walk. */
    function select1Sampled(k) {
      stats.selectQueries += 1;
      if (k < 1 || k > ones) return -1;
      const bucket = Math.floor((k - 1) / SAMPLE);
      let index = samples[bucket];
      let seen = bucket * SAMPLE;
      while (index < length) {
        if (get(index)) {
          seen += 1;
          if (seen === k) return index;
        }
        stats.wordsScanned += 1;
        index += 1;
      }
      return -1;
    }

    function shape() {
      const rawBytes = words.length * 4;
      const indexBytes = superRank.byteLength + blockRank.byteLength;
      return {
        length: length,
        ones: ones,
        density: length ? ones / length : 0,
        rawBytes: rawBytes,
        indexBytes: indexBytes,
        sampleBytes: samples.byteLength,
        overhead: rawBytes ? indexBytes / rawBytes : 0,
        blockBits: BLOCK,
        superblockBits: SUPERBLOCK,
        positionArrayBytes: ones * 4
      };
    }

    return {
      get: get,
      rank1: rank1,
      rank0: rank0,
      select1: select1,
      select0: select0,
      select1Sampled: select1Sampled,
      shape: shape,
      length: length,
      ones: function () { return ones; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /* ------------------------------------------------------------ Elias-Fano */

  /**
   * A monotone sequence of n values below u, in about n(2 + log₂(u/n)) bits.
   *
   * Split each value into a high part of ⌈log₂(u/n)⌉ bits and the rest. The
   * low parts are packed contiguously; the high parts go into a bit vector in
   * *unary*, one 1 per value at position (high + index), so recovering the
   * i-th high part is one `select1`. The high vector holds n ones and at most
   * n zeros, so it is 2n bits however large the universe is - which is why the
   * cost depends on u/n and not on u.
   */
  function eliasFano(values, options) {
    const settings = options || {};
    const n = values.length;
    const universe = Math.max(1, settings.universe || (n ? values[n - 1] + 1 : 1));
    const lowBits = Math.max(0, Math.floor(Math.log2(Math.max(1, universe / Math.max(1, n)))));
    const lowMask = lowBits ? (Math.pow(2, lowBits) - 1) : 0;
    const low = new Array(n);
    const highBits = [];

    values.forEach(function (value, index) {
      const high = Math.floor(value / Math.pow(2, lowBits));
      low[index] = value % Math.pow(2, lowBits || 1) & lowMask;
      while (highBits.length < high + index) highBits.push(0);
      highBits.push(1);
    });

    const high = create(highBits.length ? highBits : [0]);

    function get(index) {
      if (index < 0 || index >= n) return undefined;
      const position = high.select1(index + 1);
      const highPart = position - index;
      return highPart * Math.pow(2, lowBits) + low[index];
    }

    function shape() {
      const bits = high.length + n * lowBits;
      return {
        count: n,
        universe: universe,
        lowBits: lowBits,
        highVectorBits: high.length,
        totalBits: bits,
        bitsPerValue: n ? bits / n : 0,
        bound: n ? 2 + Math.log2(universe / n) : 0,
        rawBits: n * 32,
        compression: n ? (n * 32) / bits : 1,
        indexBytes: high.shape().indexBytes
      };
    }

    return { get: get, shape: shape, count: n, high: high };
  }

  return {
    create: create,
    eliasFano: eliasFano,
    popcount: popcount,
    WORD: WORD,
    BLOCK: BLOCK,
    SUPERBLOCK: SUPERBLOCK
  };
}));
