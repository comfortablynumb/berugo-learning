/**
 * A set of small integers stored as bits in a typed array, plus the bitboard
 * arithmetic that is the same idea applied to an 8 x 8 grid.
 *
 * The argument for this structure is bandwidth, not cleverness. A `Set` of a
 * million integers is a hash table of a million boxed values - tens of
 * megabytes, one cache miss per lookup, and an intersection that walks one set
 * probing the other. The same million elements as bits are 125 KB, which fits
 * in L2, and an intersection is 31 250 word-wise ANDs with no branches and
 * perfect prefetching. What decides between them is density: at one element in
 * ten thousand the bitset is storing mostly zeros and the hash set wins on
 * memory outright, which is why `Roaring` (M09) exists to switch between the
 * two per block.
 *
 * `forEachSetBit` is where the M17 bit tricks earn their place. Iterating by
 * testing all 32 bits of every word costs the universe size; iterating with
 * `x & -x` to isolate the lowest set bit and `x & (x - 1)` to clear it costs
 * the population. On a sparse bitset that is the difference between reading
 * 31 250 words and doing 100 iterations.
 *
 * Word count is deliberately exposed. A bitset's cost is words touched, and a
 * section that claims an operation is cheap without showing that number is
 * asking to be believed rather than checked.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Bitset = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BITS_PER_WORD = 32;

  function wordsFor(universe) {
    return Math.ceil(universe / BITS_PER_WORD);
  }

  function create(universe) {
    const size = Math.max(1, universe | 0);
    const state = { universe: size, words: new Uint32Array(wordsFor(size)), touched: 0 };
    return wrap(state);
  }

  function fromValues(values, universe) {
    const set = create(universe);
    for (let i = 0; i < values.length; i += 1) set.add(values[i]);
    set.resetStats();
    return set;
  }

  /** Both operands must agree on the universe, or the word loop silently
   *  reads past the shorter one and the answer is a subset with no complaint. */
  function requireSameUniverse(a, b) {
    if (a.universe === b.universe) return;
    throw new Error('bitset universes differ: ' + a.universe + ' against ' + b.universe);
  }

  function wrap(state) {
    const api = {};

    api.universe = state.universe;
    api.words = state.words;

    api.add = function (value) {
      state.words[value >>> 5] |= (1 << (value & 31));
      state.touched += 1;
      return api;
    };

    api.remove = function (value) {
      state.words[value >>> 5] &= ~(1 << (value & 31));
      state.touched += 1;
      return api;
    };

    api.has = function (value) {
      state.touched += 1;
      if (value < 0 || value >= state.universe) return false;
      return (state.words[value >>> 5] & (1 << (value & 31))) !== 0;
    };

    api.size = function () {
      let total = 0;
      for (let i = 0; i < state.words.length; i += 1) total += popcount(state.words[i]);
      return total;
    };

    api.clear = function () { state.words.fill(0); return api; };
    api.wordCount = function () { return state.words.length; };
    api.bytes = function () { return state.words.length * 4; };
    api.stats = function () { return { touched: state.touched, words: state.words.length }; };
    api.resetStats = function () { state.touched = 0; return api; };
    api.snapshot = function () { return Array.from(state.words); };

    /* The three set operations are the same loop with a different operator,
       and all three cost one pass over the words whatever the population. */
    api.unionWith = function (other) { return combine(api, state, other, orOp); };
    api.intersectWith = function (other) { return combine(api, state, other, andOp); };
    api.differenceWith = function (other) { return combine(api, state, other, andNotOp); };
    api.xorWith = function (other) { return combine(api, state, other, xorOp); };

    api.forEachSetBit = function (visit) { return iterate(state, visit); };
    api.forEachByScan = function (visit) { return scan(state, visit); };
    api.toArray = function () {
      const out = [];
      iterate(state, function (value) { out.push(value); });
      return out;
    };

    api.rank = function (position) { return rank(state, position); };
    api.select = function (index) { return select(state, index); };
    return api;
  }

  function orOp(a, b) { return (a | b) >>> 0; }
  function andOp(a, b) { return (a & b) >>> 0; }
  function andNotOp(a, b) { return (a & ~b) >>> 0; }
  function xorOp(a, b) { return (a ^ b) >>> 0; }

  function combine(api, state, other, op) {
    requireSameUniverse({ universe: state.universe }, { universe: other.universe });
    const words = other.words;
    for (let i = 0; i < state.words.length; i += 1) {
      state.words[i] = op(state.words[i], words[i]);
      state.touched += 1;
    }
    return api;
  }

  function popcount(x) {
    let v = x >>> 0;
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    v = (v + (v >>> 4)) & 0x0f0f0f0f;
    return Math.imul(v, 0x01010101) >>> 24;
  }

  /**
   * Iterate the population, not the universe. Each step isolates the lowest
   * set bit with `word & -word`, converts it to an index with `Math.clz32`,
   * and clears it with `word & (word - 1)`.
   */
  function iterate(state, visit) {
    let steps = 0;
    for (let w = 0; w < state.words.length; w += 1) {
      let word = state.words[w] >>> 0;
      while (word !== 0) {
        const isolated = (word & -word) >>> 0;
        const index = 31 - Math.clz32(isolated);
        visit((w << 5) + index);
        word = (word & (word - 1)) >>> 0;
        steps += 1;
      }
      steps += 1;
    }
    return { steps: steps };
  }

  /** The version everybody writes first: one test per element of the universe. */
  function scan(state, visit) {
    let steps = 0;
    for (let i = 0; i < state.universe; i += 1) {
      steps += 1;
      if ((state.words[i >>> 5] & (1 << (i & 31))) !== 0) visit(i);
    }
    return { steps: steps };
  }

  /** How many set bits lie strictly below `position`. */
  function rank(state, position) {
    const limit = Math.max(0, Math.min(position, state.universe));
    const full = limit >>> 5;
    let total = 0;
    for (let i = 0; i < full; i += 1) total += popcount(state.words[i]);
    const rest = limit & 31;
    if (rest !== 0) total += popcount(state.words[full] & ((1 << rest) - 1));
    return total;
  }

  /** The position of the (index + 1)-th set bit, or -1. */
  function select(state, index) {
    let remaining = index;
    for (let w = 0; w < state.words.length; w += 1) {
      const count = popcount(state.words[w]);
      if (count > remaining) return (w << 5) + selectInWord(state.words[w], remaining);
      remaining -= count;
    }
    return -1;
  }

  function selectInWord(word, index) {
    let value = word >>> 0;
    let remaining = index;
    while (value !== 0) {
      const isolated = (value & -value) >>> 0;
      if (remaining === 0) return 31 - Math.clz32(isolated);
      value = (value & (value - 1)) >>> 0;
      remaining -= 1;
    }
    return -1;
  }

  /* --------------------------------------------------------- bitboards */

  /**
   * A chess board is 64 squares, which is one BigInt of 64 bits with square 0
   * at a1 and square 63 at h8. Every "where can this piece move" question is
   * then a shift and a mask: shifting left by 1 moves a whole board one file
   * to the right, and the mask exists because the piece on the h file must not
   * reappear on the a file of the next rank. Forgetting that mask is the
   * canonical bitboard bug, and it does not look like a bug - it looks like a
   * rook that occasionally teleports.
   */
  const FILE_A = 0x0101010101010101n;
  const FILE_H = 0x8080808080808080n;
  const FILE_B = FILE_A << 1n;
  const FILE_G = FILE_H >> 1n;
  const NOT_A = ~FILE_A & 0xffffffffffffffffn;
  const NOT_H = ~FILE_H & 0xffffffffffffffffn;
  const NOT_AB = ~(FILE_A | FILE_B) & 0xffffffffffffffffn;
  const NOT_GH = ~(FILE_G | FILE_H) & 0xffffffffffffffffn;
  const FULL = 0xffffffffffffffffn;

  function square(file, rank) { return 1n << BigInt(rank * 8 + file); }

  function kingAttacks(board) {
    const east = (board << 1n) & NOT_A;
    const west = (board >> 1n) & NOT_H;
    const spread = (board | east | west) & FULL;
    return ((spread << 8n) | (spread >> 8n) | east | west) & FULL;
  }

  /* The mask belongs AFTER the shift, and it is a different mask for the
     one-file jumps than for the two-file ones - a knight leaving the g file
     eastwards lands two files over, so both g and h have to be excluded. */
  const KNIGHT_JUMPS = [
    { shift: 17n, up: true, mask: NOT_A }, { shift: 15n, up: true, mask: NOT_H },
    { shift: 10n, up: true, mask: NOT_AB }, { shift: 6n, up: true, mask: NOT_GH },
    { shift: 17n, up: false, mask: NOT_H }, { shift: 15n, up: false, mask: NOT_A },
    { shift: 10n, up: false, mask: NOT_GH }, { shift: 6n, up: false, mask: NOT_AB }
  ];

  function knightAttacks(board) {
    let out = 0n;
    for (let i = 0; i < KNIGHT_JUMPS.length; i += 1) {
      const jump = KNIGHT_JUMPS[i];
      const moved = jump.up ? (board << jump.shift) & FULL : board >> jump.shift;
      out |= moved & jump.mask;
    }
    return out & FULL;
  }

  /** A sliding piece needs the occupancy: it stops at the first blocker, so
   *  the ray is grown one step at a time and each step is masked. */
  function rookAttacks(board, occupancy) {
    const dirs = [
      { shift: 8n, up: true, mask: FULL },
      { shift: 8n, up: false, mask: FULL },
      { shift: 1n, up: true, mask: NOT_A },
      { shift: 1n, up: false, mask: NOT_H }
    ];
    let out = 0n;
    for (let i = 0; i < dirs.length; i += 1) out |= ray(board, occupancy, dirs[i]);
    return out & FULL;
  }

  function ray(board, occupancy, dir) {
    let out = 0n;
    let front = board;
    for (let step = 0; step < 7; step += 1) {
      front = (dir.up ? (front << dir.shift) : (front >> dir.shift)) & dir.mask & FULL;
      if (front === 0n) break;
      out |= front;
      front &= ~occupancy & FULL;
      if (front === 0n) break;
    }
    return out;
  }

  function boardBits(board) {
    const out = [];
    for (let i = 0; i < 64; i += 1) out.push(Number((board >> BigInt(i)) & 1n));
    return out;
  }

  function boardPopcount(board) {
    let count = 0;
    let value = board;
    while (value !== 0n) { value &= value - 1n; count += 1; }
    return count;
  }

  return {
    BITS_PER_WORD: BITS_PER_WORD,
    create: create,
    fromValues: fromValues,
    wordsFor: wordsFor,
    popcount: popcount,
    requireSameUniverse: requireSameUniverse,
    square: square,
    kingAttacks: kingAttacks,
    knightAttacks: knightAttacks,
    rookAttacks: rookAttacks,
    boardBits: boardBits,
    boardPopcount: boardPopcount,
    FILE_A: FILE_A,
    FILE_H: FILE_H,
    FULL: FULL
  };
}));
