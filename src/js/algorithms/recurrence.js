/**
 * Recurrences: recursion trees first, the master theorem second.
 *
 * The tree is the method - it shows *where* the work is, which is what tells
 * you which master case you are in rather than making you remember three
 * inequalities. The classifier below therefore reports the per-level work as
 * well as the case, and refuses to answer when the recurrence falls in a gap
 * the theorem does not cover.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Recurrence = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const EPSILON = 1e-9;

  /**
   * Expands T(n) = a·T(n/b) + f(n) into levels.
   * Each level reports its subproblem count, size and total work.
   */
  function tree(options) {
    const a = options.a;
    const b = options.b;
    const f = options.f;
    const n = options.n;
    const levels = [];

    let size = n;
    let count = 1;
    let depth = 0;

    while (size >= 1 && depth <= (options.maxDepth || 40)) {
      const work = count * f(size);
      levels.push({ depth: depth, count: count, size: size, work: work });
      if (size <= 1) break;
      size = size / b;
      count *= a;
      depth += 1;
    }

    const total = levels.reduce(function (sum, level) { return sum + level.work; }, 0);
    return { levels: levels, total: total, leaves: count, depth: levels.length - 1 };
  }

  /**
   * Master theorem for T(n) = a·T(n/b) + f(n) with f(n) = c·n^k·(log n)^p.
   * Returns { case, solution, critical, note } or { case: 'gap', … }.
   */
  function master(options) {
    const a = options.a;
    const b = options.b;
    const k = options.k;
    const p = options.p || 0;
    const critical = Math.log(a) / Math.log(b);

    if (a < 1 || b <= 1) {
      return { case: 'invalid', note: 'the master theorem needs a >= 1 and b > 1' };
    }

    if (k < critical - EPSILON) {
      return caseOne(critical);
    }

    if (Math.abs(k - critical) <= EPSILON) {
      return caseTwo(critical, p);
    }

    return caseThree(critical, k, p);
  }

  function caseOne(critical) {
    return {
      case: 1,
      critical: critical,
      solution: 'Θ(n^' + round(critical) + ')',
      note: 'the leaves dominate: work grows down the tree'
    };
  }

  function caseTwo(critical, p) {
    if (p > -1) {
      return {
        case: 2,
        critical: critical,
        solution: 'Θ(n^' + round(critical) + ' log^' + (p + 1) + ' n)',
        note: 'every level costs about the same, so the depth multiplies it'
      };
    }
    if (Math.abs(p + 1) <= EPSILON) {
      return {
        case: 2,
        critical: critical,
        solution: 'Θ(n^' + round(critical) + ' log log n)',
        note: 'the extended case-2 boundary at p = -1'
      };
    }
    return {
      case: 2,
      critical: critical,
      solution: 'Θ(n^' + round(critical) + ')',
      note: 'p < -1: the logarithmic factor sums to a constant'
    };
  }

  function caseThree(critical, k, p) {
    if (p < 0) {
      return {
        case: 'gap',
        critical: critical,
        note: 'f grows faster than n^critical but its log factor is negative - the ' +
          'regularity condition can fail here, so the theorem does not apply'
      };
    }
    return {
      case: 3,
      critical: critical,
      solution: 'Θ(n^' + round(k) + (p ? ' log^' + p + ' n' : '') + ')',
      note: 'the root dominates, provided a·f(n/b) <= c·f(n) for some c < 1 (regularity)'
    };
  }

  function round(value) {
    return Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : value.toFixed(3);
  }

  /** The regularity condition of case 3, checked numerically over a range. */
  function regularityHolds(options) {
    const a = options.a;
    const b = options.b;
    const f = options.f;
    let worst = 0;

    for (let n = Math.max(2, options.from || 8); n <= (options.to || 4096); n *= 2) {
      const ratio = (a * f(n / b)) / f(n);
      worst = Math.max(worst, ratio);
    }

    return { holds: worst < 1 - 1e-6, worstRatio: worst };
  }

  /** Solve a linear recurrence numerically: T(n) = sum(coeff_i · T(n - i)) + g(n). */
  function linear(options) {
    const coefficients = options.coefficients;
    const base = options.base.slice();
    const g = options.g || function () { return 0; };
    const values = base.slice();

    for (let n = base.length; n <= options.upTo; n += 1) {
      let value = g(n);
      coefficients.forEach(function (coefficient, index) {
        value += coefficient * values[n - 1 - index];
      });
      values.push(value);
    }

    return values;
  }

  return { tree: tree, master: master, regularityHolds: regularityHolds, linear: linear };
}));
