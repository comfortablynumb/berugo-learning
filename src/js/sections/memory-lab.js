/**
 * MemoryLab - the measurement layer the ten M37 sections share.
 *
 * Same reason as `sections/ooo-lab.js`: ten sections running the same traces
 * through the same models is ten chances for two pages to quote different
 * numbers for one configuration. Everything is cached on a JSON key of the
 * name and the options, so a control sweep costs one run per distinct setting
 * and a repaint costs none.
 *
 * The workload catalogue is small and every entry is here because it separates
 * something. A sequential walk and a pointer chase over the same bytes differ
 * only in predictability; a stride of 64 bytes and one of 2 KiB differ only in
 * which sets they land in; the four matrix multiplications differ only in loop
 * order and tiling. A fixture that changes two things at once cannot attribute
 * anything.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MemoryLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Cache = scope.Memory.Cache;
  const Hierarchy = scope.Memory.Hierarchy;
  const Tlb = scope.Memory.Tlb;
  const Dram = scope.Memory.Dram;
  const Numa = scope.Memory.Numa;
  const ThreeCs = scope.ThreeCs;
  const Prefetchers = scope.Prefetchers;
  const Microbench = scope.CacheMicrobench;
  const Matrix = scope.MatrixBlocking;

  const cache = {};

  function cached(kind, key, compute) {
    const full = kind + ' ' + JSON.stringify(key);

    if (!(full in cache)) cache[full] = compute();
    return cache[full];
  }

  /* ---------------------------------------------------------- workloads */

  const L1 = { name: 'L1d', sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 };
  const SMALL = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4 };

  const WORKLOADS = {
    sequential: { label: 'sequential — every line in order, twice',
      make: function () { return Microbench.stream({ bytes: 65536, passes: 2 }).trace; } },
    chase: { label: 'pointer chase — the same lines in a shuffled order',
      make: function () {
        return Microbench.pointerChase({ bytes: 65536, passes: 2, seed: 7 }).trace;
      } },
    strided: { label: 'strided — one access every 192 bytes',
      make: function () {
        return Microbench.strided({ step: 192, count: 256, passes: 2 }).trace;
      } },
    conflicting: { label: 'conflicting — a stride of exactly the set span',
      make: function () {
        return Microbench.strided({ step: 64 * 64, count: 64, passes: 4 }).trace;
      } },
    random: { label: 'random — uniform over 1 MiB',
      make: function () {
        return Microbench.randomAccess({ bytes: 1048576, count: 4096, seed: 5 }).trace;
      } },
    hot: { label: 'hot writes — four lines written a thousand times',
      make: function () {
        const out = [];

        for (let at = 0; at < 1000; at += 1) {
          out.push({ address: (at % 4) * 64, write: true });
        }
        return out;
      } },
    streamingWrites: { label: 'streaming writes — every line written once',
      make: function () {
        const out = [];

        for (let at = 0; at < 1000; at += 1) out.push({ address: at * 64, write: true });
        return out;
      } },
    naive: { label: 'matrix multiply, naive (i, j, k)',
      make: function () { return Matrix.naive({ n: 64 }).trace; } },
    interchanged: { label: 'matrix multiply, interchanged (i, k, j)',
      make: function () { return Matrix.interchanged({ n: 64 }).trace; } },
    blocked: { label: 'matrix multiply, blocked with a tile of 16',
      make: function () { return Matrix.blocked({ n: 64, tile: 16 }).trace; } }
  };

  function names() {
    return Object.keys(WORKLOADS);
  }

  function label(name) {
    return WORKLOADS[name] ? WORKLOADS[name].label : name;
  }

  function options(only) {
    return (only || names()).map(function (name) {
      return { value: name, label: label(name) };
    });
  }

  function trace(name) {
    return cached('trace', name, function () { return WORKLOADS[name].make(); });
  }

  /* ------------------------------------------------------------- models */

  /** One cache level, run over one workload. */
  function level(name, config) {
    return cached('level', [name, config || {}], function () {
      const built = Cache.create(config || SMALL);

      trace(name).forEach(function (entry) { Cache.access(built, entry); });
      return { cache: built, summary: Cache.summary(built) };
    });
  }

  function hierarchy(name, config) {
    return cached('hierarchy', [name, config || {}], function () {
      const built = Hierarchy.create(config || {});
      const found = Hierarchy.replay(built, trace(name));

      return { hierarchy: built, summary: found.summary, spread: found.spread,
        distribution: Hierarchy.distribution(built) };
    });
  }

  function threeCs(name, config) {
    return cached('threeCs', [name, config || {}], function () {
      return ThreeCs.classify(trace(name), config || L1);
    });
  }

  function prefetch(name, config) {
    return cached('prefetch', [name, config || {}], function () {
      return Prefetchers.compare(trace(name), { cache: (config || {}).cache || SMALL,
        prefetcher: (config || {}).prefetcher });
    });
  }

  function tlb(bytes, config) {
    return cached('tlb', [bytes, config || {}], function () {
      const built = Tlb.create(config || {});

      return Tlb.replay(built, Microbench.pointerChase({ bytes: bytes, passes: 3,
        seed: 2 }).trace);
    });
  }

  function dram(name, config) {
    return cached('dram', [name, config || {}], function () {
      const built = Dram.create(config || {});
      const found = Dram.replay(built, trace(name));

      return { dram: built, summary: found };
    });
  }

  function numa(config, workload) {
    return cached('numa', [config || {}, workload || {}], function () {
      const built = Numa.create(config || {});
      const settings = workload || {};

      if (settings.kind === 'handoff') {
        return { numa: built, summary: Numa.handoff(built, settings) };
      }
      if (settings.kind === 'alternating') {
        return { numa: built, summary: Numa.alternating(built, settings) };
      }
      return { numa: built, summary: Numa.parallelFor(built, settings) };
    });
  }

  function ladder(config) {
    return cached('ladder', config || {}, function () {
      return Microbench.ladder(config || {});
    });
  }

  /* ------------------------------------------------------------- sweeps */

  /** A sweep over one cache setting, which six of the ten sections need. */
  function sweep(name, field, values, base) {
    return values.map(function (value) {
      const config = Object.assign({}, base || SMALL);

      config[field] = value;
      const found = level(name, config);

      return { value: value, summary: found.summary, hitRate: found.summary.hitRate,
        misses: found.summary.misses, traffic: found.summary.trafficOut };
    });
  }

  return { L1: L1, SMALL: SMALL, WORKLOADS: WORKLOADS, names: names, label: label,
    options: options, trace: trace, level: level, hierarchy: hierarchy,
    threeCs: threeCs, prefetch: prefetch, tlb: tlb, dram: dram, numa: numa,
    ladder: ladder, sweep: sweep };
}));
