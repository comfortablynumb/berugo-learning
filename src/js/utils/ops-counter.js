/**
 * Instrumented primitives.
 *
 * The platform never rewrites learner code to count operations - it hands the
 * algorithm instrumented primitives and counts what actually passes through
 * them. Every readout in the UI names the counter it is showing, so "faster"
 * always has a unit.
 *
 * The step budget lives here too: it is the only bound the sandbox can enforce
 * from inside, because a bare `while (true) {}` can only be stopped by
 * terminating the worker.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Ops = api;
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';

  function StepBudgetError(limit) {
    const error = new Error('step budget of ' + limit + ' instrumented operations exceeded');
    error.name = 'StepBudgetExceeded';
    return error;
  }

  function createOps(options) {
    const settings = options || {};
    const limit = settings.limit === undefined ? 5e7 : settings.limit;
    const counts = Object.create(null);
    let total = 0;

    function bump(name, amount) {
      const n = amount === undefined ? 1 : amount;
      counts[name] = (counts[name] || 0) + n;
      total += n;
      if (limit > 0 && total > limit) throw StepBudgetError(limit);
      return n;
    }

    function cmp(a, b) {
      bump('cmp');
      if (a < b) return -1;
      return a > b ? 1 : 0;
    }

    function cmpWith(comparator, a, b) {
      bump('cmp');
      return comparator(a, b);
    }

    function swap(array, i, j) {
      bump('swap');
      bump('read', 2);
      bump('write', 2);
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
      return array;
    }

    // A counting view over an array. Reads and writes are explicit calls rather
    // than a Proxy so the cost of the instrumentation itself stays visible and
    // the same code runs identically in the worker and in node tests.
    function view(array) {
      return {
        length: array.length,
        get: function (i) { bump('read'); return array[i]; },
        set: function (i, value) { bump('write'); array[i] = value; return value; },
        raw: function () { return array; }
      };
    }

    function snapshot() {
      return Object.assign({ total: total }, counts);
    }

    function reset() {
      Object.keys(counts).forEach(function (key) { delete counts[key]; });
      total = 0;
    }

    return {
      count: bump,
      cmp: cmp,
      cmpWith: cmpWith,
      swap: swap,
      view: view,
      snapshot: snapshot,
      reset: reset,
      get total() { return total; }
    };
  }

  return { createOps: createOps };
}));
