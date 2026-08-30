/**
 * PredictorView - accuracy per site, and the counters behind it.
 *
 * An overall accuracy figure hides exactly the branch that is costing you: a
 * predictor at 95% on a program with one hot branch at 50% and a hundred cold
 * ones at 100% has a problem the average will never show. So the per-site
 * table is the primary view here and the total is a footnote, which is the
 * opposite of how these numbers are usually reported.
 *
 * The counter state is the second view, and it is worth showing raw. A
 * two-bit saturating counter is four states and a rule, and watching the
 * values sit at 3 for a loop branch and oscillate around 1 and 2 for an
 * unpredictable one explains more than any description of the state machine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PredictorView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const COUNTER_NAMES = ['strongly not taken', 'weakly not taken',
    'weakly taken', 'strongly taken'];

  /** Per-site rows, worst first - because the worst site is the one worth
   *  looking at, and sorting by address buries it. */
  function sites(result, options) {
    const settings = options || {};
    const rows = result.sites.map(function (site) {
      return { pc: site.pc, seen: site.seen, right: site.right,
        accuracy: site.seen ? site.right / site.seen : 0,
        misses: site.seen - site.right };
    });

    rows.sort(function (left, right) { return right.misses - left.misses; });
    return settings.limit ? rows.slice(0, settings.limit) : rows;
  }

  /** The counters, named rather than numbered. A table of 0s and 3s means
   *  nothing until somebody says which end is which. */
  function counters(result, options) {
    const settings = options || {};
    const values = result.state || [];

    return values.slice(0, settings.limit || 16).map(function (row) {
      const value = typeof row === 'number' ? row : row.value;
      const index = typeof row === 'number' ? 0 : row.index;

      return { index: index, value: value,
        name: COUNTER_NAMES[value] === undefined ? String(value) : COUNTER_NAMES[value] };
    });
  }

  /**
   * Mispredicts per thousand instructions, which is the unit that lets a
   * predictor's accuracy be compared with a pipeline's penalty. "99% accurate"
   * and "a 20-cycle penalty" cannot be multiplied together until one of them
   * is expressed per instruction.
   */
  function perThousand(result, instructions) {
    const misses = result.seen - result.correct;

    if (!instructions) return null;
    return 1000 * misses / instructions;
  }

  /** What the misses cost, in cycles, at a stated penalty. This is the number
   *  that turns a percentage into an argument. */
  function costOf(result, options) {
    const settings = options || {};
    const penalty = settings.penalty === undefined ? 2 : settings.penalty;
    const misses = result.seen - result.correct;
    const instructions = settings.instructions || result.seen;

    return { misses: misses, penalty: penalty, cycles: misses * penalty,
      share: instructions ? (misses * penalty) / (instructions + misses * penalty) : 0 };
  }

  /** A tournament row: one predictor on one trace, with everything a
   *  comparison needs stated rather than assumed. */
  function row(result, options) {
    const settings = options || {};

    return { kind: result.kind, name: result.name, about: result.about,
      seen: result.seen, correct: result.correct, accuracy: result.accuracy,
      misses: result.seen - result.correct,
      perThousand: perThousand(result, settings.instructions),
      cost: costOf(result, settings) };
  }

  return { COUNTER_NAMES: COUNTER_NAMES, sites: sites, counters: counters,
    perThousand: perThousand, costOf: costOf, row: row };
}));
