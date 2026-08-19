/**
 * The instrumented primitives every sort in M10 is handed, and the only place
 * a comparison, a swap, a move or an allocation is counted.
 *
 * No sort in this milestone counts its own work. Each one takes an `ops`
 * object and calls `ops.cmp`, `ops.swap`, `ops.move` and `ops.alloc`, so the
 * numbers two algorithms report are the same measurement rather than two
 * authors' opinions of what is worth counting. That is also what makes the
 * comparison model honest: a sort that "does fewer comparisons" by peeking at
 * the values directly cannot, because it never sees them except through here.
 *
 * The four counters are separate on purpose. Merge sort does few comparisons
 * and many moves; selection sort does many comparisons and almost no moves;
 * an in-place merge trades allocations for moves. Collapsing them into one
 * "operations" figure hides exactly the trade each algorithm is about.
 *
 * `comparator` is the learner-visible contract. `checked: true` wraps it in
 * the three axioms - irreflexive on equality, antisymmetric, transitive - and
 * records every violation instead of throwing, because a library sort handed
 * an inconsistent comparator does not throw either: it returns a wrong order.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortOps = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyStats() {
    return { comparisons: 0, swaps: 0, moves: 0, allocations: 0, allocatedSlots: 0, violations: 0 };
  }

  /** The default order: numbers ascending, everything else by `<`. */
  function naturalOrder(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  /** Sorting objects means sorting one extracted field; this is the only
   *  place that extraction happens, so a key function costs one call per
   *  comparison and the count says so. */
  function comparatorFor(settings) {
    const base = settings.comparator || naturalOrder;
    if (!settings.key) return base;
    const key = settings.key;
    return function (a, b) { return base(key(a), key(b)); };
  }

  function create(options) {
    const settings = options || {};
    const compare = comparatorFor(settings);
    const stats = emptyStats();
    const violations = [];

    function record(message) {
      stats.violations += 1;
      if (violations.length < 8) violations.push(message);
    }

    /** The three axioms, checked on the pair in hand. Transitivity needs a
     *  third element, so it is checked by `auditComparator` over a sample
     *  rather than here; these two are free. */
    function audit(a, b, result) {
      if (a === b && result !== 0) record('compare(x, x) returned ' + result + ', not 0');
      const mirrored = compare(b, a);
      if (Math.sign(result) !== -Math.sign(mirrored)) {
        record('compare(a, b) = ' + result + ' but compare(b, a) = ' + mirrored);
      }
    }

    function cmp(a, b) {
      stats.comparisons += 1;
      const result = compare(a, b);
      if (settings.checked) audit(a, b, result);
      return result;
    }

    function swap(array, i, j) {
      if (i === j) return;
      stats.swaps += 1;
      stats.moves += 2;
      const held = array[i];
      array[i] = array[j];
      array[j] = held;
    }

    function write(array, index, value) {
      stats.moves += 1;
      array[index] = value;
    }

    return {
      cmp: cmp,
      lt: function (a, b) { return cmp(a, b) < 0; },
      lte: function (a, b) { return cmp(a, b) <= 0; },
      swap: swap,
      write: write,
      move: function (count) { stats.moves += count === undefined ? 1 : count; },
      alloc: function (slots) {
        stats.allocations += 1;
        stats.allocatedSlots += slots === undefined ? 0 : slots;
      },
      comparator: function () { return compare; },
      violations: function () { return violations.slice(); },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { Object.assign(stats, emptyStats()); violations.length = 0; }
    };
  }

  /**
   * A comparator is only usable if it is a strict weak ordering. Transitivity
   * is the axiom people break, and it cannot be seen from one pair, so it is
   * checked over every triple of a small sample. The return value is a count,
   * not an exception: the point of the section is that a broken comparator is
   * silent.
   */
  function auditComparator(compare, sample) {
    const items = sample.slice(0, 12);
    const report = { pairs: 0, triples: 0, antisymmetry: 0, transitivity: 0, reflexivity: 0 };

    items.forEach(function (a) {
      if (compare(a, a) !== 0) report.reflexivity += 1;
      items.forEach(function (b) {
        report.pairs += 1;
        if (Math.sign(compare(a, b)) !== -Math.sign(compare(b, a))) report.antisymmetry += 1;
        items.forEach(function (c) {
          report.triples += 1;
          if (compare(a, b) < 0 && compare(b, c) < 0 && compare(a, c) >= 0) report.transitivity += 1;
        });
      });
    });

    report.violations = report.antisymmetry + report.transitivity + report.reflexivity;
    return report;
  }

  return {
    create: create,
    naturalOrder: naturalOrder,
    auditComparator: auditComparator,
    emptyStats: emptyStats
  };
}));
