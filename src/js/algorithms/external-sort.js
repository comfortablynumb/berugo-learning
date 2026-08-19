/**
 * External merge sort: run generation, replacement selection, k-way merging,
 * and the I/O model that makes all three decisions for you.
 *
 * Once the data does not fit in memory the CPU stops being the thing you are
 * spending. The model is Aggarwal and Vitter's: N records, M of them
 * resident, B per block transfer, and the cost of a sort is
 *
 *     (N/B) · log_{M/B}(N/B)   block transfers
 *
 * which says the only lever that matters is the *base of the logarithm* -
 * the merge order. Doubling memory does not halve the work; it changes how
 * many runs one pass can consume, and each pass is a full read and a full
 * write of the entire dataset. The number to minimise is passes, and this
 * module reports it rather than a time.
 *
 * Two ways to make the initial runs:
 *
 *   sort-and-flush        fill memory, sort it, write it. Every run is
 *                         exactly M records.
 *   replacement selection a heap that keeps emitting the smallest record
 *                         still >= the last one written, and defers the rest
 *                         to the next run. On random input it produces runs
 *                         of *2M* on average - a factor of two fewer runs for
 *                         no extra I/O - and on already-sorted input it
 *                         produces a single run and the sort is one pass.
 *
 * The demo's whole point is that halving the run count can remove an entire
 * merge pass, and a merge pass is 2N of I/O.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExternalSort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** Fill memory, sort, flush. Run count is ceil(N/M), always. */
  function sortAndFlushRuns(values, memory, ops) {
    const runs = [];
    for (let from = 0; from < values.length; from += memory) {
      const chunk = values.slice(from, from + memory);
      ops.alloc(chunk.length);
      chunk.sort(function (a, b) { return ops.cmp(a, b); });
      runs.push(chunk);
    }
    return runs;
  }

  /**
   * Replacement selection. The heap holds M records; the smallest one that is
   * still >= the last emitted value extends the current run, and anything
   * smaller is frozen for the next one. When every resident record is frozen
   * the run ends and the frozen set becomes the new heap.
   *
   * The 2M average is Knuth's snowplough argument: the heap is a plough
   * going round a circular road while snow falls uniformly, and in the steady
   * state it clears twice its own capacity per circuit.
   */
  function replacementSelectionRuns(values, memory, ops) {
    const heap = [];
    const frozen = [];
    const runs = [];
    let current = [];
    let at = 0;
    let lastEmitted = null;

    function less(a, b) { return ops.cmp(a, b) < 0; }

    function siftUp(index) {
      let i = index;
      while (i > 0) {
        const parent = (i - 1) >>> 1;
        if (!less(heap[i], heap[parent])) break;
        ops.swap(heap, i, parent);
        i = parent;
      }
    }

    function siftDown(index) {
      let i = index;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= heap.length) return;
        const right = left + 1;
        const best = right < heap.length && less(heap[right], heap[left]) ? right : left;
        if (!less(heap[best], heap[i])) return;
        ops.swap(heap, i, best);
        i = best;
      }
    }

    function push(value) { heap.push(value); ops.move(); siftUp(heap.length - 1); }

    function pop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) { heap[0] = last; siftDown(0); }
      return top;
    }

    while (at < values.length && heap.length < memory) { push(values[at]); at += 1; }

    while (heap.length || frozen.length) {
      if (!heap.length) {
        frozen.forEach(push);
        frozen.length = 0;
        runs.push(current);
        current = [];
        lastEmitted = null;
        continue;
      }

      const smallest = pop();
      current.push(smallest);
      ops.move();
      lastEmitted = smallest;

      if (at < values.length) {
        const next = values[at];
        at += 1;
        if (ops.cmp(next, lastEmitted) >= 0) push(next);
        else frozen.push(next);
      }
    }

    if (current.length) runs.push(current);
    return runs;
  }

  /**
   * One k-way merge pass over a list of runs, using a heap of run cursors.
   * `reads` counts records pulled and `writes` records emitted, so a pass
   * over N records costs exactly N of each - which is the point.
   */
  function mergePass(runs, order, ops) {
    const out = [];
    let reads = 0;
    let writes = 0;

    for (let group = 0; group < runs.length; group += order) {
      const batch = runs.slice(group, group + order);
      const heap = [];

      function less(a, b) { return ops.cmp(a.value, b.value) < 0; }

      function siftUp(index) {
        let i = index;
        while (i > 0) {
          const parent = (i - 1) >>> 1;
          if (!less(heap[i], heap[parent])) break;
          ops.swap(heap, i, parent);
          i = parent;
        }
      }

      function siftDown(index) {
        let i = index;
        for (;;) {
          const left = 2 * i + 1;
          if (left >= heap.length) return;
          const right = left + 1;
          const best = right < heap.length && less(heap[right], heap[left]) ? right : left;
          if (!less(heap[best], heap[i])) return;
          ops.swap(heap, i, best);
          i = best;
        }
      }

      batch.forEach(function (run, index) {
        if (!run.length) return;
        heap.push({ value: run[0], run: index, at: 0 });
        reads += 1;
        siftUp(heap.length - 1);
      });

      const merged = [];
      ops.alloc(batch.reduce(function (total, run) { return total + run.length; }, 0));

      while (heap.length) {
        const top = heap[0];
        merged.push(top.value);
        writes += 1;
        const source = batch[top.run];
        if (top.at + 1 < source.length) {
          heap[0] = { value: source[top.at + 1], run: top.run, at: top.at + 1 };
          reads += 1;
        } else {
          const last = heap.pop();
          if (heap.length) heap[0] = last;
        }
        if (heap.length) siftDown(0);
      }
      out.push(merged);
    }

    return { runs: out, reads: reads, writes: writes };
  }

  /** Merge passes needed to reduce `runs` runs to one, `order` at a time.
   *  Zero when run generation already produced a single run - which is the
   *  case replacement selection is chasing. */
  function passesFor(runs, order) {
    if (runs <= 1) return 0;
    return Math.ceil(Math.log(runs) / Math.log(order));
  }

  /**
   * The whole sort, reported as passes and record transfers rather than time.
   * `runGeneration` picks how the initial runs are made, and the two options
   * differ only in the run count - which is what decides the pass count.
   */
  function sort(values, ops, options) {
    const settings = options || {};
    const memory = Math.max(2, Math.floor(settings.memory || 64));
    const order = Math.max(2, Math.floor(settings.order || 4));
    const useReplacement = settings.runGeneration === 'replacement-selection';

    let runs = useReplacement
      ? replacementSelectionRuns(values, memory, ops)
      : sortAndFlushRuns(values, memory, ops);

    const initialRuns = runs.length;
    const runLengths = runs.map(function (run) { return run.length; });
    let passes = 0;
    let reads = values.length;
    let writes = values.length;

    while (runs.length > 1) {
      const pass = mergePass(runs, order, ops);
      runs = pass.runs;
      reads += pass.reads;
      writes += pass.writes;
      passes += 1;
    }

    const sorted = runs[0] || [];
    for (let i = 0; i < values.length; i += 1) ops.write(values, i, sorted[i]);

    return {
      memory: memory, order: order, runGeneration: useReplacement ? 'replacement-selection' : 'sort-and-flush',
      initialRuns: initialRuns, runLengths: runLengths,
      meanRunLength: values.length / Math.max(1, initialRuns),
      mergePasses: passes, recordReads: reads, recordWrites: writes,
      totalTransfers: reads + writes,
      predictedPasses: passesFor(initialRuns, order)
    };
  }

  /**
   * The Aggarwal-Vitter figure, in block transfers rather than records. It is
   * the model the merge order is chosen from, and it is arithmetic - so the
   * section computes it instead of quoting it.
   */
  function ioCost(records, memory, blockSize, order) {
    const blocks = Math.ceil(records / blockSize);
    const runs = Math.ceil(records / memory);
    const passes = passesFor(runs, order);
    return {
      records: records, memory: memory, blockSize: blockSize, order: order,
      blocks: blocks, runs: runs, mergePasses: passes,
      blockTransfers: 2 * blocks * (passes + 1),
      maxOrder: Math.max(2, Math.floor(memory / blockSize) - 1)
    };
  }

  return {
    passesFor: passesFor,
    sortAndFlushRuns: sortAndFlushRuns,
    replacementSelectionRuns: replacementSelectionRuns,
    mergePass: mergePass,
    sort: sort,
    ioCost: ioCost
  };
}));
