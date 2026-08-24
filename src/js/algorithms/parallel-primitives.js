/**
 * Work and span, and why span rather than core count bounds your speed-up.
 *
 * A parallel algorithm has two costs and only one of them is the running time.
 * WORK is the total number of operations — what one processor would do — and
 * SPAN (or depth) is the longest chain of operations that must happen in
 * order. Brent's theorem then bounds the time on p processors:
 *
 *     T_p ≤ work/p + span
 *
 * and the second term does not shrink. An algorithm with linear span will not
 * go faster on more cores however parallel the implementation looks, which is
 * the single most useful fact in this section and the one a "we parallelised
 * it and it did not speed up" post-mortem usually turns out to be about.
 *
 * Prefix scan is the canonical primitive because it looks inherently
 * sequential and is not. The naive loop is O(n) work and O(n) span. Blelloch's
 * up-sweep and down-sweep is O(n) work and O(log n) span — the same work, an
 * exponentially shorter critical path — and it is the building block that
 * makes parallel compaction, radix sort, quicksort partitioning and sparse
 * matrix operations possible at all.
 *
 * Everything here is SIMULATED. The counters are exact — every operation is
 * counted and every dependency is recorded — and the schedule is a greedy list
 * scheduler over the dependency graph, so the reported time is a real schedule
 * rather than the formula being printed back. That distinction matters: the
 * formula is an upper bound, and a measured greedy schedule is usually better
 * than it, which is what the demo shows.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ParallelPrimitives = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* -------------------------------------------------------- the accounting */

  /**
   * A tiny dataflow recorder. Each `op` is one unit of work depending on zero
   * or more earlier ops; its depth is one more than the deepest input, so the
   * span falls out of the recording rather than being asserted alongside it.
   */
  function tracer() {
    const ops = [];

    return {
      op: function (inputs, label) {
        let depth = 0;
        (inputs || []).forEach(function (id) {
          depth = Math.max(depth, ops[id].depth);
        });
        ops.push({ depth: depth + 1, inputs: (inputs || []).slice(), label: label || '' });
        return ops.length - 1;
      },
      work: function () { return ops.length; },
      span: function () {
        return ops.reduce(function (best, entry) { return Math.max(best, entry.depth); }, 0);
      },
      ops: function () { return ops; },
      levels: function () { return levelsOf(ops); }
    };
  }

  function levelsOf(ops) {
    const out = [];

    ops.forEach(function (entry) {
      const at = entry.depth - 1;
      while (out.length <= at) out.push(0);
      out[at] += 1;
    });
    return out;
  }

  /**
   * A greedy list schedule over the recorded graph: at each step every op
   * whose inputs are done becomes ready, and up to p of them run. The result
   * is a real schedule length, which Brent's theorem bounds from above and
   * usually by a visible margin.
   */
  function schedule(trace, processors) {
    const ops = trace.ops();
    const finished = new Array(ops.length).fill(-1);
    const readyAt = ops.map(function (entry) {
      return entry.inputs.length === 0 ? 0 : -1;
    });
    let time = 0;
    let done = 0;
    let busySteps = 0;

    while (done < ops.length) {
      const ready = [];
      for (let i = 0; i < ops.length && ready.length < processors; i += 1) {
        if (finished[i] !== -1 || !inputsDone(ops[i], finished)) continue;
        ready.push(i);
      }
      if (ready.length === 0) break;
      ready.forEach(function (i) { finished[i] = time + 1; });
      busySteps += ready.length;
      done += ready.length;
      time += 1;
    }
    return { processors: processors, time: time, work: ops.length,
      span: trace.span(), utilisation: busySteps / Math.max(1, time * processors),
      brentBound: Math.ceil(ops.length / processors) + trace.span(),
      readyAt: readyAt };
  }

  function inputsDone(entry, finished) {
    for (let i = 0; i < entry.inputs.length; i += 1) {
      if (finished[entry.inputs[i]] === -1) return false;
    }
    return true;
  }

  /* --------------------------------------------------------------- scan */

  /** The obvious loop: n additions in a chain, so span equals work. */
  function sequentialScan(values) {
    const trace = tracer();
    const out = [];
    let running = 0;
    let last = null;

    values.forEach(function (value, i) {
      running += value;
      out.push(running);
      last = trace.op(last === null ? [] : [last], 'add ' + i);
    });
    return { name: 'sequential', result: out, trace: trace,
      work: trace.work(), span: trace.span() };
  }

  /**
   * Blelloch's work-efficient scan. The up-sweep builds a reduction tree in
   * place; the down-sweep pushes partial sums back down it. Both halves are
   * n − 1 additions and log n levels, so the whole thing is 2n work and
   * 2 log n span — the same work as the loop, and an exponentially shorter
   * critical path.
   */
  function blellochScan(values) {
    const n = values.length;
    const trace = tracer();
    const buffer = values.slice();
    const owner = new Array(n).fill(null);

    upSweep(buffer, owner, trace, n);
    const total = buffer[n - 1];
    buffer[n - 1] = 0;
    owner[n - 1] = trace.op(owner[n - 1] === null ? [] : [owner[n - 1]], 'clear root');
    downSweep(buffer, owner, trace, n);
    return { name: 'blelloch (up-sweep / down-sweep)', result: buffer, total: total,
      trace: trace, work: trace.work(), span: trace.span(),
      levels: trace.levels() };
  }

  function upSweep(buffer, owner, trace, n) {
    for (let stride = 1; stride < n; stride *= 2) {
      for (let i = stride * 2 - 1; i < n; i += stride * 2) {
        const inputs = [owner[i], owner[i - stride]].filter(function (id) { return id !== null; });
        buffer[i] += buffer[i - stride];
        owner[i] = trace.op(inputs, 'up ' + stride + ':' + i);
      }
    }
  }

  function downSweep(buffer, owner, trace, n) {
    for (let stride = n / 2; stride >= 1; stride /= 2) {
      for (let i = stride * 2 - 1; i < n; i += stride * 2) {
        const inputs = [owner[i], owner[i - stride]].filter(function (id) { return id !== null; });
        const left = buffer[i - stride];
        buffer[i - stride] = buffer[i];
        buffer[i] += left;
        const id = trace.op(inputs, 'down ' + stride + ':' + i);
        owner[i] = id;
        owner[i - stride] = id;
      }
    }
  }

  /**
   * The naive parallel scan (Hillis and Steele): log n rounds of n additions
   * each. Its span is log n — as short as Blelloch's — and its WORK is
   * n log n, so it is not work-efficient. On a machine with fewer processors
   * than elements that extra factor is paid in full, which is the reason the
   * work-efficient version exists at all.
   */
  function hillisSteeleScan(values) {
    const n = values.length;
    const trace = tracer();
    let buffer = values.slice();
    let owner = new Array(n).fill(null);

    for (let stride = 1; stride < n; stride *= 2) {
      const next = buffer.slice();
      const nextOwner = owner.slice();
      for (let i = 0; i < n; i += 1) {
        if (i < stride) continue;
        next[i] = buffer[i] + buffer[i - stride];
        nextOwner[i] = trace.op([owner[i], owner[i - stride]]
          .filter(function (id) { return id !== null; }), 'hs ' + stride + ':' + i);
      }
      buffer = next;
      owner = nextOwner;
    }
    return { name: 'hillis–steele (not work-efficient)', result: buffer, trace: trace,
      work: trace.work(), span: trace.span() };
  }

  /* -------------------------------------------------------------- reduce */

  function treeReduce(values) {
    const trace = tracer();
    let level = values.map(function (value, i) { return { value: value, id: trace.op([], 'leaf ' + i) }; });

    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 >= level.length) { next.push(level[i]); continue; }
        next.push({ value: level[i].value + level[i + 1].value,
          id: trace.op([level[i].id, level[i + 1].id], 'merge') });
      }
      level = next;
    }
    return { name: 'tree reduce', total: level[0].value, trace: trace,
      work: trace.work(), span: trace.span() };
  }

  /* ------------------------------------------------- Amdahl and Gustafson */

  /**
   * Amdahl fixes the problem size and asks how fast it goes: the serial
   * fraction s caps the speed-up at 1/s however many processors there are.
   * Gustafson fixes the TIME and asks how much bigger a problem fits: the
   * answer grows without bound. They are not in conflict — they answer
   * different questions, and quoting one at the other is the standard mistake.
   */
  function amdahl(serialFraction, processors) {
    return 1 / (serialFraction + (1 - serialFraction) / processors);
  }

  function gustafson(serialFraction, processors) {
    return serialFraction + (1 - serialFraction) * processors;
  }

  function speedupTable(options) {
    const settings = options || {};
    const fractions = settings.fractions === undefined ? [0.001, 0.01, 0.05, 0.2] : settings.fractions;
    const counts = settings.processors === undefined ? [2, 8, 32, 128, 1024] : settings.processors;

    return { rows: fractions.map(function (s) {
      return { serial: s, ceiling: 1 / s,
        amdahl: counts.map(function (p) { return { p: p, speedup: amdahl(s, p) }; }),
        gustafson: counts.map(function (p) { return { p: p, speedup: gustafson(s, p) }; }) };
    }), processors: counts };
  }

  /* ------------------------------------------------------------- helpers */

  function ones(n) {
    const out = [];

    for (let i = 0; i < n; i += 1) out.push(1);
    return out;
  }

  function exclusivePrefix(values) {
    const out = [];
    let running = 0;

    values.forEach(function (value) { out.push(running); running += value; });
    return out;
  }

  return {
    tracer: tracer, schedule: schedule,
    sequentialScan: sequentialScan, blellochScan: blellochScan,
    hillisSteeleScan: hillisSteeleScan, treeReduce: treeReduce,
    amdahl: amdahl, gustafson: gustafson, speedupTable: speedupTable,
    ones: ones, exclusivePrefix: exclusivePrefix
  };
}));
