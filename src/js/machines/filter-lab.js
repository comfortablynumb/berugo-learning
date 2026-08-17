/**
 * Approximate-membership comparisons: one key set, one probe set, every filter
 * family measured the same way.
 *
 * The rule this harness exists to enforce is that a filter is never reported on
 * its predicted error alone. Every row carries the predicted rate, the rate
 * measured against a probe set of keys known to be absent, the bytes it cost
 * and the cache lines a query touched - and the false-negative count, which
 * must be zero for everything here except a cuckoo filter that has been asked
 * to delete something it never held.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FilterLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  const BloomFilter = load('../algorithms/bloom-filter.js', 'BloomFilter');
  const CuckooFilter = load('../algorithms/cuckoo-filter.js', 'CuckooFilter');
  const QuotientFilter = load('../algorithms/quotient-filter.js', 'QuotientFilter');
  const StreamLab = load('./stream-lab.js', 'StreamLab');

  /* The load each bucketed family is designed for: a cuckoo filter with four
     slots per bucket fills past 95%, a quotient filter's runs grow unusable
     past about 75%. Both are measured in the demos rather than assumed. */
  const CUCKOO_LOAD = 0.95;
  const QUOTIENT_LOAD = 0.75;

  function keysFor(count, prefix) {
    const out = new Array(count);
    for (let i = 0; i < count; i += 1) out[i] = (prefix || 'key-') + i;
    return out;
  }

  /* --------------------------------------------------------- Bloom sizing */

  /**
   * Inserts into a filter sized for (n, p) and samples the error as it fills.
   * The point is the last few rows: past the n it was sized for, the measured
   * rate keeps climbing and nothing in the filter says so.
   */
  function bloomSweep(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 10000));
    const target = settings.p || 0.01;
    const overfill = settings.overfill === undefined ? 2 : settings.overfill;
    const steps = Math.max(2, Math.floor(settings.steps || 20));
    const optimal = BloomFilter.optimalParams({ n: n, p: target });
    const k = Math.max(1, Math.floor(settings.k || optimal.k));
    const shape = { m: optimal.m, k: k, bitsPerKey: optimal.bitsPerKey, optimalK: optimal.k };
    const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: settings.seed || 1 });
    const probes = StreamLab.absentKeys({ count: settings.probes || 20000 });
    const total = Math.round(n * overfill);
    const points = [];
    const every = Math.max(1, Math.round(total / steps));

    for (let i = 0; i < total; i += 1) {
      filter.add('key-' + i);
      if ((i + 1) % every !== 0 && i !== total - 1) continue;
      const measured = StreamLab.measureFpr({ filter: filter, absent: probes });
      points.push({
        n: i + 1,
        fill: filter.fill(),
        predicted: BloomFilter.fprFor({ m: shape.m, k: shape.k, n: i + 1 }),
        measured: measured.rate,
        overCapacity: i + 1 > n
      });
    }

    return { shape: shape, filter: filter, points: points, probes: probes.length, target: target };
  }

  /* ------------------------------------------------------- Bloom variants */

  const VARIANTS = [
    {
      id: 'standard', label: 'standard Bloom',
      build: function (shape, seed) { return BloomFilter.create({ m: shape.m, k: shape.k, seed: seed }); }
    },
    {
      id: 'counting', label: 'counting Bloom (4-bit)',
      build: function (shape, seed) {
        return BloomFilter.counting({ m: shape.m, k: shape.k, seed: seed, counterBits: 4 });
      }
    },
    {
      id: 'blocked', label: 'blocked Bloom (512-bit blocks)',
      build: function (shape, seed) {
        return BloomFilter.blocked({ m: shape.m, k: shape.k, seed: seed, blockBits: 512 });
      }
    }
  ];

  /**
   * The same keys and the same probes through every Bloom variant, plus a
   * scalable chain sized for a tenth of the key count so its layers are
   * visible. Memory, error and lines per query are all reported: the blocked
   * filter's whole case is the third column and it costs a little of the
   * second.
   */
  function compareVariants(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 20000));
    const target = settings.p || 0.01;
    const seed = settings.seed || 1;
    const shape = BloomFilter.optimalParams({ n: n, p: target });
    const keys = keysFor(n);
    const probes = StreamLab.absentKeys({ count: settings.probes || 50000 });

    const rows = VARIANTS.map(function (variant) {
      return measureFilter({ filter: variant.build(shape, seed), keys: keys, probes: probes, meta: variant });
    });

    const scalable = BloomFilter.scalable({
      n0: Math.max(16, Math.round(n / (settings.layers || 10))),
      p: target,
      seed: seed
    });
    rows.push(measureFilter({
      filter: scalable,
      keys: keys,
      probes: probes,
      meta: { id: 'scalable', label: 'scalable Bloom (' + (settings.layers || 10) + ' layers of headroom)' }
    }));

    return { shape: shape, rows: rows, keys: n, probes: probes.length, target: target, scalable: scalable };
  }

  /** Build, fill, probe, and report both errors and both costs. */
  function measureFilter(options) {
    const filter = options.filter;
    options.keys.forEach(filter.add);
    filter.resetStats();

    const measured = StreamLab.measureFpr({ filter: filter, absent: options.probes });
    const missing = StreamLab.falseNegatives({ filter: filter, present: options.keys });
    const stats = filter.stats();

    return {
      id: options.meta.id,
      label: options.meta.label,
      bytes: filter.bytes(),
      bitsPerKey: filter.bits() / options.keys.length,
      predicted: filter.predictedFpr(),
      measured: measured.rate,
      falseNegatives: missing,
      linesPerQuery: stats.queries ? stats.linesTouched / stats.queries : 0,
      probesPerQuery: stats.queries ? stats.bitProbes / stats.queries : 0
    };
  }

  /**
   * A counting filter under a *multiset* load: every key inserted `repeats`
   * times, then half of them removed once each.
   *
   * Two things show up and only one is obvious. The counters saturate — a
   * 4-bit counter stops at 15 — and a saturated counter can never be safely
   * decremented again, so it sticks. What that costs is not a wrong count but
   * a filter that slowly stops forgetting: the removals leave those cells set
   * for ever and the error rate drifts up towards a filter that was never
   * emptied.
   */
  function countingChurn(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 20000));
    const repeats = Math.max(1, Math.floor(settings.repeats || 1));
    const counterBits = Math.max(2, Math.floor(settings.counterBits || 4));
    const shape = BloomFilter.optimalParams({ n: n, p: settings.p || 0.01 });
    const filter = BloomFilter.counting({
      m: shape.m, k: shape.k, seed: settings.seed || 1, counterBits: counterBits
    });
    const keys = keysFor(n);

    for (let pass = 0; pass < repeats; pass += 1) keys.forEach(filter.add);

    const removed = keys.slice(0, Math.floor(n / 2));
    removed.forEach(filter.remove);
    const survivors = keys.slice(Math.floor(n / 2));

    return {
      counterBits: counterBits,
      repeats: repeats,
      maxCounter: filter.maxCounter(),
      ceiling: Math.pow(2, counterBits) - 1,
      saturated: filter.saturated(),
      overflows: filter.stats().overflows,
      cells: shape.m,
      bytes: filter.bytes(),
      standardBytes: Math.ceil(shape.m / 8),
      /* After `repeats` insertions a single removal cannot empty a cell, so
         removed keys are still reported present. That is correct arithmetic
         and a surprising API. */
      removedStillPresent: removed.reduce(function (total, key) {
        return total + (filter.has(key) ? 1 : 0);
      }, 0),
      removedCount: removed.length,
      falseNegatives: StreamLab.falseNegatives({ filter: filter, present: survivors }),
      fill: filter.fill()
    };
  }

  /**
   * Block size against error and against cache lines. A smaller block is
   * cheaper to fetch and more unevenly loaded, and the unevenness costs error:
   * the blocks that end up above the average contribute more false positives
   * than the ones below it save.
   */
  function blockSweep(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 20000));
    const target = settings.p || 0.01;
    const shape = BloomFilter.optimalParams({ n: n, p: target });
    const keys = keysFor(n);
    const probes = StreamLab.absentKeys({ count: settings.probes || 30000 });

    const standard = BloomFilter.create({ m: shape.m, k: shape.k, seed: settings.seed || 1 });
    keys.forEach(standard.add);
    standard.resetStats();
    const base = StreamLab.measureFpr({ filter: standard, absent: probes });

    const rows = (settings.blockBits || [64, 128, 256, 512, 1024, 4096]).map(function (blockBits) {
      const filter = BloomFilter.blocked({ m: shape.m, k: shape.k, seed: settings.seed || 1, blockBits: blockBits });
      keys.forEach(filter.add);
      filter.resetStats();
      const measured = StreamLab.measureFpr({ filter: filter, absent: probes });
      const stats = filter.stats();
      return {
        blockBits: blockBits,
        blockBytes: blockBits / 8,
        blocks: filter.blocks(),
        measured: measured.rate,
        predicted: filter.predictedFpr(),
        inflation: measured.rate / base.rate,
        linesPerQuery: stats.linesTouched / Math.max(1, stats.queries)
      };
    });

    return {
      shape: shape,
      standard: {
        measured: base.rate,
        predicted: standard.predictedFpr(),
        linesPerQuery: standard.stats().linesTouched / Math.max(1, standard.stats().queries)
      },
      rows: rows
    };
  }

  /* ---------------------------------------------------- fingerprint filters */

  /**
   * Fills cuckoo filters at several fingerprint sizes until an insert fails.
   * The achieved load factor is nearly independent of the fingerprint size and
   * the error rate is entirely determined by it, which is the separation the
   * section is built to show.
   */
  function cuckooSweep(options) {
    const settings = options || {};
    const capacity = Math.max(64, Math.floor(settings.capacity || 8192));
    const bucketSize = settings.bucketSize || 4;
    const sizes = settings.fingerprintBits || [6, 8, 10, 12, 14];
    const probes = StreamLab.absentKeys({ count: settings.probes || 50000 });

    return sizes.map(function (bits) {
      const result = CuckooFilter.fillUntilFailure({
        capacity: capacity, bucketSize: bucketSize, fingerprintBits: bits,
        seed: settings.seed || 1, prefix: 'key-'
      });
      const measured = StreamLab.measureFpr({ filter: result.filter, absent: probes });
      return {
        fingerprintBits: bits,
        inserted: result.inserted,
        load: result.load,
        failedAt: result.failedAt,
        kicks: result.filter.stats().kicks,
        kicksPerInsert: result.filter.stats().kicks / Math.max(1, result.inserted),
        predicted: result.filter.predictedFpr(),
        measured: measured.rate,
        bitsPerItem: result.filter.bits() / Math.max(1, result.inserted)
      };
    });
  }

  /** Bucket size against achieved load: two slots per bucket is not enough. */
  function bucketSweep(options) {
    const settings = options || {};
    const capacity = Math.max(64, Math.floor(settings.capacity || 8192));
    return (settings.bucketSizes || [1, 2, 4, 8]).map(function (bucketSize) {
      const result = CuckooFilter.fillUntilFailure({
        capacity: capacity, bucketSize: bucketSize,
        fingerprintBits: settings.fingerprintBits || 8,
        seed: settings.seed || 1, prefix: 'key-'
      });
      return {
        bucketSize: bucketSize,
        load: result.load,
        inserted: result.inserted,
        predicted: result.filter.predictedFpr(),
        kicksPerInsert: result.filter.stats().kicks / Math.max(1, result.inserted)
      };
    });
  }

  /**
   * Fills a cuckoo filter and records how long each eviction chain ran.
   *
   * The distribution is the point. Almost every insert finds a free slot with
   * no eviction at all; a handful walk dozens of buckets, and those are what
   * the `maxKicks` bound is protecting the caller from. An insert cost quoted
   * as an average hides a tail that is three orders of magnitude longer.
   */
  function chainProfile(options) {
    const settings = options || {};
    const filter = CuckooFilter.create({
      capacity: settings.capacity || 8192,
      bucketSize: settings.bucketSize || 4,
      fingerprintBits: settings.fingerprintBits || 8,
      maxKicks: settings.maxKicks || 500,
      seed: settings.seed || 1
    });
    const histogram = new Map();
    let longest = { length: -1 };
    let inserted = 0;

    for (let i = 0; i < filter.capacity() * 2; i += 1) {
      const result = filter.add('key-' + i);
      if (!result.ok) break;
      inserted += 1;
      const length = result.chain.length;
      histogram.set(length, (histogram.get(length) || 0) + 1);
      if (length > longest.length) longest = { length: length, chain: result.chain, at: i };
    }

    return {
      filter: filter,
      inserted: inserted,
      load: filter.load(),
      longest: longest,
      histogram: Array.from(histogram.entries())
        .map(function (pair) { return { length: pair[0], count: pair[1] }; })
        .sort(function (a, b) { return a.length - b.length; }),
      meanChain: filter.stats().kicks / Math.max(1, inserted)
    };
  }

  /**
   * Deleting keys that were never inserted. Every accepted delete removes some
   * other key's fingerprint, so the false-negative count afterwards is the
   * damage - and the filter reported nothing at the time.
   */
  function phantomDeletes(options) {
    const settings = options || {};
    const n = Math.max(1, Math.floor(settings.n || 4000));
    const keys = keysFor(n);
    const filter = CuckooFilter.create({
      capacity: settings.capacity || n * 2,
      bucketSize: 4,
      fingerprintBits: settings.fingerprintBits || 8,
      seed: settings.seed || 1
    });
    keys.forEach(filter.add);

    const ghosts = StreamLab.absentKeys({ count: settings.ghosts || n, prefix: 'ghost-' });
    let accepted = 0;
    ghosts.forEach(function (key) { if (filter.remove(key)) accepted += 1; });

    return {
      inserted: n,
      ghosts: ghosts.length,
      accepted: accepted,
      falseNegatives: StreamLab.falseNegatives({ filter: filter, present: keys }),
      predicted: filter.predictedFpr()
    };
  }

  /**
   * Bloom, cuckoo and quotient at a comparable error rate, each measured.
   *
   * Two columns, not one. `bitsPerItem` is what these n keys actually cost,
   * including the power-of-two rounding a bucketed table cannot avoid;
   * `bitsPerItemFull` is what the same structure costs at the load it is
   * designed for, which is the figure every paper's comparison table quotes.
   * They differ by up to 2× and the gap is entirely rounding.
   */
  function spaceAtError(options) {
    const settings = options || {};
    const n = Math.max(64, Math.floor(settings.n || 8000));
    const target = settings.p || 0.01;
    const keys = keysFor(n);
    const probes = StreamLab.absentKeys({ count: settings.probes || 50000 });
    const seed = settings.seed || 1;

    const shape = BloomFilter.optimalParams({ n: n, p: target });
    const bloom = BloomFilter.create({ m: shape.m, k: shape.k, seed: seed });
    keys.forEach(bloom.add);

    const fingerprintBits = Math.max(4, Math.ceil(Math.log2(2 * 4 * CUCKOO_LOAD / target)));
    const cuckoo = CuckooFilter.create({
      capacity: Math.ceil(n / CUCKOO_LOAD), bucketSize: 4,
      fingerprintBits: fingerprintBits, seed: seed
    });
    keys.forEach(cuckoo.add);

    const remainderBits = Math.max(1, Math.ceil(Math.log2(QUOTIENT_LOAD / target)));
    const quotient = QuotientFilter.create({
      quotientBits: Math.max(3, Math.ceil(Math.log2(n / QUOTIENT_LOAD))),
      remainderBits: remainderBits, seed: seed
    });
    keys.forEach(quotient.add);

    return {
      keys: n,
      target: target,
      probes: probes.length,
      rows: [
        rowFor({ id: 'bloom', label: 'Bloom, k = ' + shape.k, filter: bloom, capacity: n }, keys, probes),
        rowFor({
          id: 'cuckoo', label: 'cuckoo, f = ' + fingerprintBits + ' bits',
          filter: cuckoo, capacity: cuckoo.capacity() * CUCKOO_LOAD
        }, keys, probes),
        rowFor({
          id: 'quotient', label: 'quotient, r = ' + remainderBits + ' bits',
          filter: quotient, capacity: quotient.slots() * QUOTIENT_LOAD
        }, keys, probes)
      ]
    };
  }

  function rowFor(spec, keys, probes) {
    const filter = spec.filter;
    filter.resetStats();
    const measured = StreamLab.measureFpr({ filter: filter, absent: probes });
    const stats = filter.stats();
    return {
      id: spec.id,
      label: spec.label,
      bytes: filter.bytes(),
      bitsPerItem: filter.bits() / keys.length,
      bitsPerItemFull: filter.bits() / spec.capacity,
      predicted: filter.predictedFpr(),
      measured: measured.rate,
      falseNegatives: StreamLab.falseNegatives({ filter: filter, present: keys }),
      linesPerQuery: stats.queries ? stats.linesTouched / stats.queries : 0,
      deletes: spec.id === 'cuckoo' ? 'yes' : (spec.id === 'bloom' ? 'never' : 'not in this build')
    };
  }

  /**
   * Two quotient filters merged into one. The check that matters is that the
   * merged read-out is exactly the two sorted read-outs interleaved: no key was
   * rehashed, because no key was available to rehash.
   */
  function quotientMerge(options) {
    const settings = options || {};
    const n = Math.max(16, Math.floor(settings.n || 2000));
    const left = QuotientFilter.create({ quotientBits: settings.quotientBits || 12, remainderBits: settings.remainderBits || 10, seed: 4 });
    const right = QuotientFilter.create({ quotientBits: settings.quotientBits || 12, remainderBits: settings.remainderBits || 10, seed: 4 });

    for (let i = 0; i < n; i += 1) left.add('left-' + i);
    for (let i = 0; i < n; i += 1) right.add('right-' + i);

    const before = QuotientFilter.valuesOf(left).concat(QuotientFilter.valuesOf(right))
      .sort(function (a, b) { return a - b; });
    const result = QuotientFilter.merge(left, right);
    const after = QuotientFilter.valuesOf(result.filter);

    return {
      left: left,
      right: right,
      merged: result.filter,
      fingerprintsPreserved: before.length === after.length &&
        before.every(function (value, index) { return value === after[index]; }),
      bitsBefore: left.bits() + right.bits(),
      bitsAfter: result.filter.bits(),
      remainderBefore: left.remainderBits(),
      remainderAfter: result.filter.remainderBits()
    };
  }

  return {
    bloomSweep: bloomSweep,
    compareVariants: compareVariants,
    countingChurn: countingChurn,
    blockSweep: blockSweep,
    cuckooSweep: cuckooSweep,
    bucketSweep: bucketSweep,
    chainProfile: chainProfile,
    phantomDeletes: phantomDeletes,
    spaceAtError: spaceAtError,
    quotientMerge: quotientMerge,
    keysFor: keysFor,
    VARIANTS: VARIANTS
  };
}));
