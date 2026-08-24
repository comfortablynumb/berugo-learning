/**
 * CacheLab — traces built to separate policies, and Belady as the ceiling.
 *
 * A cache comparison is only as good as its traces. A Zipf trace makes every
 * policy look competent because the hot keys stay hot; a scan makes the
 * recency policies collapse; a loop just larger than the cache takes LRU to
 * zero hits while an optimal offline policy gets most of them. So the lab
 * carries four families rather than one, each generated to exercise one
 * failure, and every row is reported next to Belady's optimum on the same
 * trace — because "61% of hits" means nothing until the ceiling is known.
 *
 * The working-set curve is the second thing here and it is what a capacity
 * decision is actually made from: hit rate as a function of cache size, with
 * the knee visible. A single hit rate at a single size is a point on a curve
 * whose shape is the whole answer.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CacheLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Policies = scope && scope.ReplacementPolicies ? scope.ReplacementPolicies
    : require('../algorithms/replacement-policies.js');
  const Adaptive = scope && scope.AdaptiveCaches ? scope.AdaptiveCaches
    : require('../algorithms/adaptive-caches.js');

  const TRACES = ['zipf', 'scan', 'loop', 'mixed'];
  const ALL = Policies.NAMES.concat(Adaptive.NAMES);

  /* ------------------------------------------------------------ the traces */

  /**
   * Four families, each generated to exercise one failure:
   *   zipf  — a stationary hot set, where every policy looks competent
   *   scan  — a working set plus a long one-pass sweep that evicts it
   *   loop  — a cycle just larger than the cache, LRU's worst case exactly
   *   mixed — a hot set with periodic scans through it, the realistic shape
   */
  function trace(kind, options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const length = settings.length === undefined ? 20000 : settings.length;

    if (kind === 'scan') return scanTrace(rng, settings, length);
    if (kind === 'loop') return loopTrace(settings, length);
    if (kind === 'mixed') return mixedTrace(rng, settings, length);
    return zipfTrace(rng, settings, length);
  }

  function zipfTrace(rng, settings, length) {
    const universe = settings.universe === undefined ? 500 : settings.universe;
    const skew = settings.skew === undefined ? 3 : settings.skew;
    const out = [];

    for (let i = 0; i < length; i += 1) out.push(Math.floor(Math.pow(rng.next(), skew) * universe));
    return out;
  }

  function scanTrace(rng, settings, length) {
    const working = settings.working === undefined ? 100 : settings.working;
    const scanLength = settings.scanLength === undefined ? 400 : settings.scanLength;
    const burst = settings.burst === undefined ? 200 : settings.burst;
    const out = [];
    let cold = 100000;

    while (out.length < length) {
      for (let k = 0; k < burst && out.length < length; k += 1) {
        out.push(Math.floor(Math.pow(rng.next(), 2) * working));
      }
      for (let s = 0; s < scanLength && out.length < length; s += 1) out.push(cold + s);
      cold += scanLength;
    }
    return out;
  }

  function loopTrace(settings, length) {
    const cycle = settings.cycle === undefined ? 120 : settings.cycle;
    const out = [];

    for (let i = 0; i < length; i += 1) out.push(i % cycle);
    return out;
  }

  function mixedTrace(rng, settings, length) {
    const working = settings.working === undefined ? 80 : settings.working;
    const out = [];
    let cold = 500000;

    while (out.length < length) {
      for (let k = 0; k < 300 && out.length < length; k += 1) {
        out.push(Math.floor(Math.pow(rng.next(), 2.5) * working));
      }
      for (let s = 0; s < 150 && out.length < length; s += 1) out.push(cold + s);
      cold += 150;
      for (let k = 0; k < 100 && out.length < length; k += 1) out.push(rng.int(working));
    }
    return out;
  }

  function distinctKeys(sequence) {
    return new Set(sequence).size;
  }

  /* ---------------------------------------------------------- the bake-off */

  /** Every policy on one trace at one capacity, with Belady beside them. */
  function compare(options) {
    const settings = options || {};
    const kind = settings.kind === undefined ? 'mixed' : settings.kind;
    const sequence = settings.sequence || trace(kind, settings);
    const capacity = settings.capacity === undefined ? 100 : settings.capacity;
    const optimum = Policies.belady(sequence, capacity);

    return { kind: kind, capacity: capacity, length: sequence.length,
      distinct: distinctKeys(sequence), optimum: optimum,
      rows: ALL.map(function (name) {
        const stats = runPolicy(name, capacity, sequence, settings);
        return Object.assign({}, stats,
          { ofOptimum: stats.hitRate / Math.max(1e-12, optimum.hitRate) });
      }) };
  }

  function runPolicy(name, capacity, sequence, options) {
    const policy = Policies.NAMES.indexOf(name) !== -1
      ? Policies.create(name, capacity, options)
      : Adaptive.create(name, capacity, options);

    sequence.forEach(function (key) { policy.get(key); });
    return policy.stats();
  }

  /**
   * Hit rate against cache size — the curve a capacity decision is made from.
   * A single hit rate at a single size is one point on it, and the knee is the
   * answer to "how much more memory is worth buying".
   */
  function workingSetCurve(options) {
    const settings = options || {};
    const kind = settings.kind === undefined ? 'mixed' : settings.kind;
    const sequence = settings.sequence || trace(kind, settings);
    const sizes = settings.sizes === undefined ? [10, 25, 50, 100, 200, 400] : settings.sizes;
    const names = settings.policies || ALL;

    return { kind: kind, sizes: sizes, distinct: distinctKeys(sequence),
      series: names.concat(['belady']).map(function (name) {
        return { name: name, points: sizes.map(function (capacity) {
          const stats = name === 'belady'
            ? Policies.belady(sequence, capacity)
            : runPolicy(name, capacity, sequence, settings);
          return { capacity: capacity, hitRate: stats.hitRate };
        }) };
      }) };
  }

  /** The scan separation, stated as a number: the ratio between each policy's
   *  hit rate on the scan trace and its hit rate on the Zipf trace. */
  function scanResistance(options) {
    const settings = options || {};
    const capacity = settings.capacity === undefined ? 100 : settings.capacity;
    const zipf = trace('zipf', settings);
    const scan = trace('scan', settings);

    return { capacity: capacity,
      rows: ALL.map(function (name) {
        const onZipf = runPolicy(name, capacity, zipf, settings).hitRate;
        const onScan = runPolicy(name, capacity, scan, settings).hitRate;
        return { name: name, zipf: onZipf, scan: onScan, retained: onScan / Math.max(1e-12, onZipf) };
      }),
      zipfOptimum: Policies.belady(zipf, capacity).hitRate,
      scanOptimum: Policies.belady(scan, capacity).hitRate };
  }

  /**
   * ARC's dial, over the trace. `p` is the target size of the recency half,
   * and watching it move is the clearest picture of an adaptive policy doing
   * the adapting — a fixed p would be 2Q with worse constants.
   */
  function adaptationTrace(options) {
    const settings = options || {};
    const sequence = settings.sequence || trace(settings.kind === undefined
      ? 'mixed' : settings.kind, settings);
    const capacity = settings.capacity === undefined ? 100 : settings.capacity;
    const every = settings.every === undefined ? Math.max(1, Math.floor(sequence.length / 60))
      : settings.every;
    const policy = Adaptive.arc(capacity);
    const points = [];

    sequence.forEach(function (key, at) {
      policy.get(key);
      if (at % every !== 0) return;
      const stats = policy.stats();
      points.push({ at: at, p: stats.p, t1: stats.t1, t2: stats.t2, hitRate: stats.hitRate });
    });
    return { capacity: capacity, points: points, final: policy.stats() };
  }

  return {
    TRACES: TRACES, ALL: ALL,
    trace: trace, distinctKeys: distinctKeys, compare: compare, runPolicy: runPolicy,
    workingSetCurve: workingSetCurve, scanResistance: scanResistance,
    adaptationTrace: adaptationTrace
  };
}));
