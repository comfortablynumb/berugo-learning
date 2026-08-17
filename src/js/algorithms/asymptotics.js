/**
 * Asymptotic notation, made checkable.
 *
 * O, Omega and Theta are sets of functions defined by a witness pair (c, n0).
 * This module works with that definition directly: you supply the witness and
 * it reports whether the inequality actually holds over a range, and where it
 * first fails. That turns "f is O(g)" from a claim into a check - which is the
 * whole point of the section it serves.
 *
 * It is an empirical check over a finite range, not a proof, and it says so.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Asymptotics = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const GROWTH = {
    constant: { label: '1', fn: function () { return 1; }, rank: 0 },
    log: { label: 'log n', fn: function (n) { return Math.log2(n); }, rank: 1 },
    sqrt: { label: '√n', fn: function (n) { return Math.sqrt(n); }, rank: 2 },
    linear: { label: 'n', fn: function (n) { return n; }, rank: 3 },
    linearithmic: { label: 'n log n', fn: function (n) { return n * Math.log2(n); }, rank: 4 },
    quadratic: { label: 'n²', fn: function (n) { return n * n; }, rank: 5 },
    cubic: { label: 'n³', fn: function (n) { return n * n * n; }, rank: 6 },
    exponential: { label: '2ⁿ', fn: function (n) { return Math.pow(2, n); }, rank: 7 },
    factorial: { label: 'n!', fn: factorial, rank: 8 }
  };

  function factorial(n) {
    let out = 1;
    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  }

  function growth(name) {
    return GROWTH[name] || GROWTH.linear;
  }

  function names() {
    return Object.keys(GROWTH).sort(function (a, b) { return GROWTH[a].rank - GROWTH[b].rank; });
  }

  /**
   * Checks f(n) <= c·g(n) for every integer n in [n0, upTo].
   * Returns { holds, firstFailure, checked }.
   */
  function isBigO(f, g, witness) {
    const c = witness.c;
    const n0 = Math.max(1, Math.floor(witness.n0));
    const upTo = Math.max(n0, Math.floor(witness.upTo));
    let checked = 0;

    for (let n = n0; n <= upTo; n += 1) {
      checked += 1;
      const left = f(n);
      const right = c * g(n);
      if (!(left <= right)) {
        return { holds: false, firstFailure: { n: n, f: left, cg: right }, checked: checked };
      }
    }

    return { holds: true, firstFailure: null, checked: checked };
  }

  function isBigOmega(f, g, witness) {
    return isBigO(function (n) { return -f(n); }, function (n) { return -g(n); }, witness);
  }

  /** Theta needs both bounds, which is why it takes two witnesses. */
  function isTheta(f, g, lower, upper) {
    const below = isBigO(f, g, upper);
    const above = isBigO(g, f, { c: 1 / lower.c, n0: lower.n0, upTo: lower.upTo });
    return { holds: below.holds && above.holds, upper: below, lower: above };
  }

  /**
   * The smallest witness constant that works over [n0, upTo], or null when no
   * constant does (which is the interesting answer: it means f grows faster).
   */
  function smallestConstant(f, g, n0, upTo) {
    let needed = 0;
    for (let n = Math.max(1, n0); n <= upTo; n += 1) {
      const denominator = g(n);
      if (denominator === 0) continue;
      needed = Math.max(needed, f(n) / denominator);
    }
    return Number.isFinite(needed) ? needed : null;
  }

  /** Where a "slower" function with a small constant stops winning. */
  function crossover(f, g, upTo) {
    for (let n = 1; n <= upTo; n += 1) {
      if (f(n) > g(n)) return n;
    }
    return null;
  }

  function series(fn, from, to, step) {
    const points = [];
    const increment = step || 1;
    for (let n = from; n <= to; n += increment) points.push({ x: n, y: fn(n) });
    return points;
  }

  /** True when a is asymptotically dominated by b in the table above. */
  function dominates(aName, bName) {
    return growth(aName).rank < growth(bName).rank;
  }

  return {
    growth: growth,
    names: names,
    isBigO: isBigO,
    isBigOmega: isBigOmega,
    isTheta: isTheta,
    smallestConstant: smallestConstant,
    crossover: crossover,
    series: series,
    dominates: dominates
  };
}));
