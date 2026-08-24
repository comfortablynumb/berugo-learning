/**
 * ModelLab — the space budget, the span, and which model was right.
 *
 * Three studies that share one question: what does the cost model COUNT?
 *
 * The streaming study (21.7) counts BYTES and enforces them. An exact answer
 * to "how many distinct" needs one entry per distinct key, so past a budget it
 * is not slow — it is impossible, and the study kills it rather than letting
 * it quietly succeed. The sketches answer within their stated error band using
 * space that does not grow with the stream, and the comparison is only honest
 * when both columns are held to the same budget.
 *
 * The parallel study (21.8) counts WORK and SPAN, and schedules the recorded
 * dependency graph greedily onto p processors. The measured schedule length is
 * a real number rather than Brent's formula printed back, and it is reliably
 * shorter than the bound — which is what an upper bound is for.
 *
 * The bake-off (21.9) is the point of the milestone: one workload, four
 * predictions, and the measurement beside all four. Three of the models are
 * confident, precise and wrong, and which one is right depends on the
 * workload rather than on the machine.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ModelLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Hll = scope && scope.HyperLogLog ? scope.HyperLogLog
    : require('../algorithms/hyperloglog.js');
  const CountMin = scope && scope.CountMin ? scope.CountMin
    : require('../algorithms/count-min.js');
  const Quantiles = scope && scope.QuantileSketches ? scope.QuantileSketches
    : require('../algorithms/quantile-sketches.js');
  const Parallel = scope && scope.ParallelPrimitives ? scope.ParallelPrimitives
    : require('../algorithms/parallel-primitives.js');
  const External = scope && scope.ExternalAlgorithms ? scope.ExternalAlgorithms
    : require('../algorithms/external-algorithms.js');
  const Oblivious = scope && scope.CacheOblivious ? scope.CacheOblivious
    : require('../algorithms/cache-oblivious.js');

  /* ------------------------------------------------------- 21.7 streaming */

  function streamOf(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const length = settings.length === undefined ? 200000 : settings.length;
    const universe = settings.universe === undefined ? 20000 : settings.universe;
    const skew = settings.skew === undefined ? 1.6 : settings.skew;
    const out = [];

    for (let i = 0; i < length; i += 1) out.push(Math.floor(Math.pow(rng.next(), skew) * universe));
    return out;
  }

  /**
   * Distinct count under a byte budget. The exact answer needs a set, and the
   * set is KILLED the moment it exceeds the budget — reporting a number it had
   * no room to compute is the failure mode the whole model exists to name.
   */
  function distinctStudy(options) {
    const settings = options || {};
    const stream = settings.stream || streamOf(settings);
    const budget = settings.budget === undefined ? 8192 : settings.budget;
    const bytesPerEntry = settings.bytesPerEntry === undefined ? 24 : settings.bytesPerEntry;
    const truth = new Set(stream).size;
    const exact = exactDistinct(stream, budget, bytesPerEntry);

    return { length: stream.length, truth: truth, budget: budget, exact: exact,
      sketches: [4, 8, 12, 14].map(function (precision) {
        return hllRow(stream, precision, truth, budget);
      }) };
  }

  function exactDistinct(stream, budget, bytesPerEntry) {
    const seen = new Set();

    for (let i = 0; i < stream.length; i += 1) {
      seen.add(stream[i]);
      if (seen.size * bytesPerEntry <= budget) continue;
      return { kind: 'exact set', killed: true, at: i, bytes: seen.size * bytesPerEntry,
        answer: null, reason: 'the set passed the byte budget after ' + i + ' of ' +
          stream.length + ' items; it is not slow, it does not fit' };
    }
    return { kind: 'exact set', killed: false, at: stream.length,
      bytes: seen.size * bytesPerEntry, answer: seen.size, reason: null };
  }

  function hllRow(stream, precision, truth, budget) {
    const sketch = Hll.create({ precision: precision, dense: true });

    stream.forEach(function (key) { sketch.add('k' + key); });
    const estimate = sketch.estimate();
    return { kind: 'HyperLogLog p=' + precision, bytes: sketch.bytes(),
      withinBudget: sketch.bytes() <= budget, answer: estimate,
      error: Math.abs(estimate - truth) / truth,
      predictedError: 1.04 / Math.sqrt(Math.pow(2, precision)) };
  }

  /**
   * The same shape for quantiles: an exact structure that grows with the
   * stream against a sketch that does not. The error is reported as a RANK
   * error, because that is what the bounds are stated over and a value error
   * on a heavy-tailed distribution is meaningless.
   */
  function quantileStudy(options) {
    const settings = options || {};
    const stream = settings.stream || streamOf(settings);
    const budget = settings.budget === undefined ? 8192 : settings.budget;
    const exact = Quantiles.exact();

    stream.forEach(function (value) { exact.add(value); });
    const targets = settings.targets === undefined ? [0.5, 0.9, 0.99] : settings.targets;
    const sketches = [
      { kind: 'reservoir (1 000)', make: function () { return Quantiles.reservoir({ size: 1000 }); } },
      { kind: 't-digest', make: function () { return Quantiles.tDigest({ compression: 100 }); } },
      { kind: 'KLL', make: function () { return Quantiles.kll({ k: 128 }); } }
    ];

    return { length: stream.length, budget: budget, targets: targets,
      exactBytes: stream.length * 8,
      rows: sketches.map(function (entry) {
        return quantileRow(entry, stream, exact, targets, budget);
      }) };
  }

  function quantileRow(entry, stream, exact, targets, budget) {
    const sketch = entry.make();

    stream.forEach(function (value) { sketch.add(value); });
    const errors = targets.map(function (p) {
      const guess = sketch.quantile(p);
      const rank = exact.rankOf(guess) / stream.length;
      return { p: p, value: guess, rank: rank, rankError: Math.abs(rank - p) };
    });
    const bytes = sketch.bytes ? sketch.bytes() : null;
    return { kind: entry.kind, bytes: bytes, withinBudget: bytes === null || bytes <= budget,
      errors: errors,
      worstRankError: Math.max.apply(null, errors.map(function (e) { return e.rankError; })) };
  }

  /**
   * What one pass cannot do, stated as a list rather than as a feeling. Each
   * row names the question, the space an exact answer needs, and the sketch
   * that answers it approximately — and the two rows with no sketch are the
   * ones worth remembering in a design review.
   */
  function impossibilityTable() {
    return [
      { question: 'how many distinct values?', exact: 'Ω(n) — one entry per distinct value',
        approximate: 'HyperLogLog, 1.04/√m relative error in m bytes', possible: true },
      { question: 'what is the exact median?',
        exact: 'Ω(n) in one pass; two passes suffice with O(1) extra',
        approximate: 'KLL or t-digest, bounded RANK error', possible: true },
      { question: 'how often did this key appear?', exact: 'Ω(distinct keys)',
        approximate: 'count-min, over-estimates by at most εN', possible: true },
      { question: 'which keys appeared exactly once?',
        exact: 'Ω(n) — the answer can depend on every item',
        approximate: 'none: a sketch that over-counts cannot certify a count of one',
        possible: false },
      { question: 'what is the exact maximum gap between consecutive values?',
        exact: 'Ω(n) — sorting is required',
        approximate: 'none in one pass without sorting the stream', possible: false }
    ];
  }

  /* -------------------------------------------------------- 21.8 parallel */

  /**
   * The three scans, their work and span, and a greedy schedule of each onto a
   * range of processor counts. The span is the floor: at p = n the time is the
   * span exactly, and adding processors past that changes nothing.
   */
  function scanStudy(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 256 : settings.n;
    const values = Parallel.ones(n);
    const counts = settings.processors === undefined ? [1, 2, 4, 8, 16, 32, 64, 256]
      : settings.processors;
    const runs = [Parallel.sequentialScan(values), Parallel.blellochScan(values),
      Parallel.hillisSteeleScan(values)];
    const expected = Parallel.exclusivePrefix(values);

    return { n: n, processors: counts, logN: Math.log2(n),
      rows: runs.map(function (run) {
        return { name: run.name, work: run.work, span: run.span,
          correct: run.name.indexOf('blelloch') === 0
            ? run.result.every(function (v, i) { return v === expected[i]; })
            : null,
          schedules: counts.map(function (p) {
            const s = Parallel.schedule(run.trace, p);
            return { p: p, time: s.time, brent: s.brentBound, speedup: run.work / s.time,
              utilisation: s.utilisation };
          }) };
      }) };
  }

  /** Amdahl and Gustafson on the same serial fractions, which answer
   *  different questions and are routinely quoted at each other. */
  function speedupStudy(options) {
    return Parallel.speedupTable(options || {});
  }

  /* ------------------------------------------------------- 21.9 the bake-off */

  /**
   * One workload — sorting n records — and four predictions of what it costs.
   * Three of them are wrong for any given workload and the fourth is right,
   * and which is which depends on whether the data fits in cache, in memory,
   * or neither, and on whether there are processors to spare.
   */
  function bakeOff(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 65536 : settings.n;
    const B = settings.B === undefined ? 64 : settings.B;
    const M = settings.M === undefined ? 4096 : settings.M;
    const processors = settings.processors === undefined ? 8 : settings.processors;
    const bound = External.bounds(n, M, B);

    return { n: n, B: B, M: M, processors: processors, rows: [
      { model: 'RAM (count comparisons)', counts: 'operations',
        prediction: Math.round(n * Math.log2(n)),
        unit: 'comparisons',
        rightWhen: 'the data fits in cache and one core does the work' },
      { model: 'cache-aware (count misses)', counts: 'cache misses',
        prediction: Math.round(n / B * Math.log2(n / (M / B))),
        unit: 'cache misses',
        rightWhen: 'the data fits in memory and the working set does not fit in cache' },
      { model: 'external memory (count I/Os)', counts: 'block transfers',
        prediction: bound.sort, unit: 'block transfers',
        rightWhen: 'the data does not fit in memory' },
      { model: 'parallel (count span)', counts: 'the critical path',
        prediction: Math.round(Math.pow(Math.log2(n), 2)), unit: 'dependent steps',
        rightWhen: 'there are more processors than the span can use' }
    ], measured: measuredSort(n, M, B) };
  }

  function measuredSort(n, M, B) {
    const data = External.shuffled(Math.min(n, 16384), 3);
    const disk = External.createDisk(data, { M: M, B: B });

    External.externalSort(disk);
    return { records: data.length, transfers: disk.stats().transfers,
      predicted: External.bounds(data.length, M, B).sort };
  }

  /**
   * Which resource binds, measured on one access pattern at a time. Sequential
   * work is instruction-bound; a stride longer than a cache line is
   * miss-bound; a random probe over a set larger than memory is I/O-bound. The
   * decision the section is about is reading this table, not memorising it.
   */
  function bindingResource(options) {
    const settings = options || {};
    const n = settings.n === undefined ? 4096 : settings.n;
    const patterns = [
      { name: 'sequential scan', stride: 1 },
      { name: 'stride of 8 doubles (one line)', stride: 8 },
      { name: 'stride of 64 doubles (eight lines)', stride: 64 },
      { name: 'random probe', stride: 0 }
    ];
    const rng = Random.seeded(settings.seed === undefined ? 5 : settings.seed);

    return { n: n, rows: patterns.map(function (pattern) {
      const cache = Oblivious.cacheFor({ lines: settings.lines === undefined ? 64
        : settings.lines, lineBytes: 64 });
      /* A strided walk has to COVER the array. `(i * stride) % n` revisits the
         same n/gcd positions and reported 64 misses for a stride of 64 — an
         access pattern that never leaves one cache line looks superb and is
         not the pattern that was asked for. */
      strideWalk(cache, n, pattern.stride, rng);
      const stats = cache.stats();
      return { name: pattern.name, accesses: stats.accesses, misses: stats.misses,
        missRate: stats.missRate, bytesFetched: stats.bytesFetched,
        binding: stats.missRate > 0.5 ? 'memory' : (stats.missRate > 0.05
          ? 'mixed' : 'instructions') };
    }) };
  }

  /**
   * One pass with the given stride, touching n/stride elements. Covering the
   * whole array in offset-major order instead turns a stride into a blocked
   * traversal with perfect locality — it reported the same 12.5% for a stride
   * of 64 as for a sequential scan, which is the opposite of the effect.
   */
  function strideWalk(cache, n, stride, rng) {
    if (stride === 0) {
      for (let i = 0; i < n; i += 1) cache.access(rng.int(n) * 8, 8);
      return n;
    }
    let touched = 0;

    for (let at = 0; at < n; at += stride) { cache.access(at * 8, 8); touched += 1; }
    return touched;
  }

  return {
    streamOf: streamOf, distinctStudy: distinctStudy, quantileStudy: quantileStudy,
    impossibilityTable: impossibilityTable,
    scanStudy: scanStudy, speedupStudy: speedupStudy,
    bakeOff: bakeOff, bindingResource: bindingResource
  };
}));
