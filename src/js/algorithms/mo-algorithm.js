/**
 * Mo's algorithm: answering range queries out of order, and the ordering
 * argument that makes it O((n + q)·sqrt(n)).
 *
 * A query structure that must answer online has to be built for the worst
 * order it might be asked in. Given every query up front, the order is a free
 * variable - and choosing it well turns a problem with no efficient online
 * structure (distinct values in a range) into a linear-ish sweep.
 *
 * Sort the queries by (left / blockSize, right), keep two pointers, and move
 * them to each query's endpoints in turn. The left pointer moves at most
 * blockSize per query inside a block, and the right pointer moves monotonically
 * within a block and resets once per block: q·blockSize + n²/blockSize total,
 * minimised at blockSize = n/sqrt(q), which is the sqrt in the bound.
 *
 * `pointerMoves` is the measurement, not the wall clock. The theoretical bound
 * is a statement about that counter, so a demo that reports milliseconds is
 * reporting something else.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MoAlgorithm = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { leftMoves: 0, rightMoves: 0, pointerMoves: 0, adds: 0, removes: 0, blockSize: 0, blocks: 0 };
  }

  /** blockSize = n / sqrt(q) is the minimiser of q·b + n²/b. The common choice
   *  of sqrt(n) is that formula with q = n, and it is measurably worse when q
   *  is much smaller or much larger than n. */
  function blockSizeFor(n, q) {
    if (q <= 0) return Math.max(1, Math.floor(Math.sqrt(Math.max(1, n))));
    return Math.max(1, Math.round(n / Math.sqrt(q)));
  }

  /**
   * Mo's ordering: by block of the left endpoint, then by right endpoint. The
   * alternating direction inside odd blocks ("Hilbert-lite") saves a constant
   * factor and is switchable so the saving is measurable rather than assumed.
   */
  function order(queries, blockSize, options) {
    const settings = options || {};
    return queries.map(function (query, index) {
      return { index: index, left: query.left, right: query.right, block: Math.floor(query.left / blockSize) };
    }).sort(function (a, b) {
      if (a.block !== b.block) return a.block - b.block;
      if (settings.alternate && (a.block & 1)) return b.right - a.right;
      return a.right - b.right;
    });
  }

  /**
   * Run a workload offline. `hooks` supplies add(value), remove(value) and
   * answer() so the same driver serves distinct-count, sum, mode or anything
   * else with an O(1) incremental update - which is the real precondition, and
   * the one people forget when they reach for this.
   */
  function run(values, queries, hooks, options) {
    const settings = options || {};
    const report = emptyReport();
    const blockSize = settings.blockSize || blockSizeFor(values.length, queries.length);
    report.blockSize = blockSize;
    report.blocks = Math.ceil(values.length / blockSize);

    const sorted = order(queries, blockSize, settings);
    const answers = new Array(queries.length).fill(null);
    let left = 0;
    let right = 0;

    hooks.reset();

    sorted.forEach(function (query) {
      while (right < query.right) { hooks.add(values[right]); right += 1; report.rightMoves += 1; report.adds += 1; }
      while (left > query.left) { left -= 1; hooks.add(values[left]); report.leftMoves += 1; report.adds += 1; }
      while (right > query.right) { right -= 1; hooks.remove(values[right]); report.rightMoves += 1; report.removes += 1; }
      while (left < query.left) { hooks.remove(values[left]); left += 1; report.leftMoves += 1; report.removes += 1; }
      answers[query.index] = hooks.answer();
    });

    report.pointerMoves = report.leftMoves + report.rightMoves;
    return { answers: answers, report: report, blockSize: blockSize };
  }

  /** The same workload in the order it arrived, so the ordering's saving is a
   *  ratio between two measured counters rather than a claim. */
  function runUnsorted(values, queries, hooks) {
    const report = emptyReport();
    const answers = [];
    let left = 0;
    let right = 0;
    hooks.reset();

    queries.forEach(function (query) {
      while (right < query.right) { hooks.add(values[right]); right += 1; report.rightMoves += 1; }
      while (left > query.left) { left -= 1; hooks.add(values[left]); report.leftMoves += 1; }
      while (right > query.right) { right -= 1; hooks.remove(values[right]); report.rightMoves += 1; }
      while (left < query.left) { hooks.remove(values[left]); left += 1; report.leftMoves += 1; }
      answers.push(hooks.answer());
    });

    report.pointerMoves = report.leftMoves + report.rightMoves;
    return { answers: answers, report: report };
  }

  /** Distinct values in a range: the query with no simple online structure,
   *  and the reason Mo's algorithm is worth knowing. */
  function distinctHooks(universe) {
    const counts = new Array(universe).fill(0);
    let distinct = 0;

    return {
      reset: function () { counts.fill(0); distinct = 0; },
      add: function (value) {
        counts[value] += 1;
        if (counts[value] === 1) distinct += 1;
      },
      remove: function (value) {
        counts[value] -= 1;
        if (counts[value] === 0) distinct -= 1;
      },
      answer: function () { return distinct; }
    };
  }

  /** Sum over a range - answerable online by a prefix sum, and included so the
   *  section can say plainly when Mo's algorithm is the wrong tool. */
  function sumHooks() {
    let total = 0;
    return {
      reset: function () { total = 0; },
      add: function (value) { total += value; },
      remove: function (value) { total -= value; },
      answer: function () { return total; }
    };
  }

  /** The brute-force oracle. Every offline answer is checked against it,
   *  because a mis-ordered sweep returns plausible numbers. */
  function bruteForce(values, queries, kind) {
    return queries.map(function (query) {
      if (kind === 'sum') {
        let total = 0;
        for (let i = query.left; i < query.right; i += 1) total += values[i];
        return total;
      }
      const seen = new Set();
      for (let i = query.left; i < query.right; i += 1) seen.add(values[i]);
      return seen.size;
    });
  }

  /**
   * The block-size sweep. The bound q·b + n²/b has a minimum, the minimum is
   * not at sqrt(n) unless q = n, and the curve is flat enough near the bottom
   * that being roughly right is enough - all three of which are visible only
   * in a sweep.
   */
  function blockSweep(values, queries, universe) {
    const sizes = [];
    const n = values.length;
    for (let b = Math.max(1, Math.floor(Math.sqrt(n) / 4)); b <= Math.ceil(Math.sqrt(n) * 4); b = Math.ceil(b * 1.35)) {
      sizes.push(b);
    }

    return sizes.map(function (blockSize) {
      const measured = run(values, queries, distinctHooks(universe), { blockSize: blockSize });
      return {
        blockSize: blockSize,
        pointerMoves: measured.report.pointerMoves,
        predicted: queries.length * blockSize + (n * n) / blockSize
      };
    });
  }

  /** Random queries over a range, with the width distribution as a parameter -
   *  narrow queries and wide queries stress different halves of the bound. */
  function randomQueries(count, n, seed, width) {
    let state = (seed || 1) >>> 0;
    function next(bound) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % bound;
    }

    const out = [];
    for (let i = 0; i < count; i += 1) {
      const left = next(n);
      const span = width ? 1 + next(width) : 1 + next(n - left);
      out.push({ left: left, right: Math.min(n, left + span) });
    }
    return out;
  }

  return {
    emptyReport: emptyReport,
    blockSizeFor: blockSizeFor,
    order: order,
    run: run,
    runUnsorted: runUnsorted,
    distinctHooks: distinctHooks,
    sumHooks: sumHooks,
    bruteForce: bruteForce,
    blockSweep: blockSweep,
    randomQueries: randomQueries
  };
}));
