/**
 * Where asymptotics stop predicting: the crossover.
 *
 * Two implementations of the same task, instrumented and measured, so the
 * point where the "slower" one wins can be found rather than assumed. The
 * sorts here are deliberately minimal - M10 builds the real ones - because
 * what this module teaches is the *measurement*, not the algorithm.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CrossoverLab = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function insertionSort(values, ops) {
    const array = values.slice();
    for (let i = 1; i < array.length; i += 1) {
      const key = array[i];
      let j = i - 1;
      while (j >= 0 && (ops ? ops.cmp(array[j], key) > 0 : array[j] > key)) {
        if (ops) ops.count('move');
        array[j + 1] = array[j];
        j -= 1;
      }
      array[j + 1] = key;
    }
    return array;
  }

  function merge(left, right, ops) {
    const out = [];
    let i = 0;
    let j = 0;

    while (i < left.length && j < right.length) {
      const order = ops ? ops.cmp(left[i], right[j]) : (left[i] < right[j] ? -1 : 1);
      if (order <= 0) { out.push(left[i]); i += 1; } else { out.push(right[j]); j += 1; }
      if (ops) ops.count('move');
    }

    while (i < left.length) { out.push(left[i]); i += 1; if (ops) ops.count('move'); }
    while (j < right.length) { out.push(right[j]); j += 1; if (ops) ops.count('move'); }
    return out;
  }

  function mergeSort(values, ops, cutoff) {
    const limit = cutoff || 0;
    if (values.length <= 1) return values.slice();
    if (limit && values.length <= limit) return insertionSort(values, ops);

    const mid = values.length >> 1;
    if (ops) ops.count('alloc', 2);
    return merge(
      mergeSort(values.slice(0, mid), ops, limit),
      mergeSort(values.slice(mid), ops, limit),
      ops
    );
  }

  /** Sequential versus pointer-chasing traversal over the same element count. */
  function traversal(n, shuffled, rng) {
    const next = new Int32Array(n);
    for (let i = 0; i < n; i += 1) next[i] = (i + 1) % n;

    if (shuffled) {
      const order = rng.shuffle(Array.from({ length: n }, function (_, i) { return i; }));
      for (let i = 0; i < n; i += 1) next[order[i]] = order[(i + 1) % n];
    }

    return {
      next: next,
      /** Simulated locality cost: a sequential step is cheap, a jump is not. */
      walk: function (steps) {
        let cursor = 0;
        let jumps = 0;
        for (let i = 0; i < steps; i += 1) {
          const target = next[cursor];
          if (target !== cursor + 1) jumps += 1;
          cursor = target;
        }
        return { jumps: jumps, steps: steps, jumpRate: jumps / steps };
      }
    };
  }

  /** Runs both sorts at each size and reports the counted work and the times. */
  function sweep(options) {
    const harness = options.harness;
    const rng = options.rng;
    const makeOps = options.makeOps;
    const cutoff = options.cutoff || 0;

    return options.sizes.map(function (n) {
      const input = rng.shuffle(Array.from({ length: n }, function (_, i) { return i; }));

      const insertionOps = makeOps();
      insertionSort(input, insertionOps);
      const mergeOps = makeOps();
      mergeSort(input, mergeOps, cutoff);

      const insertionTime = harness.run({ task: function (data) { return insertionSort(data, null); }, input: input });
      const mergeTime = harness.run({ task: function (data) { return mergeSort(data, null, cutoff); }, input: input });

      return {
        n: n,
        insertion: { ops: insertionOps.snapshot(), medianMs: insertionTime.medianMs, runs: insertionTime.runs },
        merge: { ops: mergeOps.snapshot(), medianMs: mergeTime.medianMs, runs: mergeTime.runs }
      };
    });
  }

  /** The smallest n at which merge sort's measured median beats insertion's. */
  function crossoverOf(rows, metric) {
    const read = metric || function (row, key) { return row[key].medianMs; };
    for (let i = 0; i < rows.length; i += 1) {
      if (read(rows[i], 'merge') < read(rows[i], 'insertion')) return rows[i].n;
    }
    return null;
  }

  return {
    insertionSort: insertionSort,
    mergeSort: mergeSort,
    traversal: traversal,
    sweep: sweep,
    crossoverOf: crossoverOf
  };
}));
