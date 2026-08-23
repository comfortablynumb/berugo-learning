/**
 * EntropyLab - the harness for randomness and identity (M17.9 and M17.10).
 *
 * The two sections share a shape: a family of schemes that all look
 * interchangeable from the outside, and a measurement that separates them
 * completely. For generators the separating measurement is *never* a
 * one-dimensional histogram - every generator here passes that, including
 * RANDU - it is the structure in consecutive outputs and the behaviour of
 * individual bits. For identifiers it is not "are they unique", which they all
 * are, it is what they cost an index and what they tell a stranger.
 *
 * A verdict here is always a comparison against a stated threshold. The
 * chi-squared statistic is reported next to its 95th percentile, so "passes"
 * means a number was smaller than another number rather than a chart looking
 * about right - and the reverse reading matters too: a statistic far *below*
 * the expectation is its own kind of failure, and a full-period generator
 * sweeping every value exactly once produces exactly that.
 *
 * The clock for the identifier work is injected. That is what makes a
 * backwards clock step a fixture rather than an anecdote, and the backwards
 * step is the only interesting thing about a Snowflake generator.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.EntropyLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Prng = scope && scope.Prng ? scope.Prng : require('../algorithms/prng.js');
  const Ids = scope && scope.IdGenerators ? scope.IdGenerators
    : require('../algorithms/id-generators.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* ------------------------------------------------------- 17.9 generators */

  /**
   * Every generator on the same four tests. The first two are the ones people
   * run and everything passes; the last two are the ones that separate them.
   */
  function generatorTable(options) {
    const settings = options || {};
    const samples = settings.samples || 200000;
    const seed = settings.seed || 12345;
    return Prng.GENERATORS.map(function (entry) {
      return generatorRow(entry.id, { samples: samples, seed: seed });
    });
  }

  function generatorRow(id, settings) {
    const high = Prng.sourceOf(Prng.build(id, settings.seed), 24);
    const low = Prng.sourceOf(Prng.build(id, settings.seed), 8, 'low');
    const highCounts = Prng.bucketCounts(high, { buckets: 64, samples: settings.samples });
    const lowCounts = Prng.bucketCounts(low, { buckets: 64, samples: settings.samples });
    const generator = Prng.build(id, settings.seed);

    return {
      id: id,
      label: generator.label,
      stateBits: generator.stateBits,
      period: generator.period,
      highBits: Prng.uniformityVerdict(highCounts.buckets, settings.samples),
      lowBits: Prng.uniformityVerdict(lowCounts.buckets, settings.samples),
      lowestBitPeriod: Prng.bitPeriod(Prng.build(id, settings.seed), 0, 256),
      planeIdentity: Prng.lcgPlaneResidual(Prng.build(id, settings.seed), 500).holds
    };
  }

  /** Consecutive outputs as points, which is where a lattice shows. */
  function scatter(id, options) {
    const settings = options || {};
    return {
      id: id,
      points: Prng.pairs(Prng.build(id, settings.seed || 1), settings.count || 2000),
      triples: Prng.triples(Prng.build(id, settings.seed || 1),
        Math.min(settings.count || 2000, 2000)),
      identity: Prng.lcgPlaneResidual(Prng.build(id, settings.seed || 1), 2000)
    };
  }

  /** How often each bit position comes up set, per generator. */
  function bitHeat(id, options) {
    const settings = options || {};
    const frequencies = Prng.bitFrequencies(Prng.build(id, settings.seed || 1),
      settings.samples || 20000);
    const periods = [];
    for (let bit = 0; bit < 8; bit += 1) {
      periods.push({ bit: bit, period: Prng.bitPeriod(Prng.build(id, settings.seed || 1),
        bit, settings.periodBudget || 512) });
    }
    return {
      id: id,
      frequencies: frequencies,
      periods: periods,
      worstDeviation: frequencies.reduce(function (worst, value) {
        return Math.max(worst, Math.abs(value - 0.5));
      }, 0)
    };
  }

  /**
   * The three bounded samplers on the same source, at a width where the bias
   * is visible. `moduloBias` states what the bias must be with no sampling at
   * all, and the chi-squared column shows it arriving.
   */
  function biasTable(options) {
    const settings = options || {};
    const bits = settings.bits || 8;
    const n = settings.n || 200;
    const samples = settings.samples || 400000;

    return {
      bits: bits, n: n, samples: samples,
      predicted: Prng.moduloBias(Math.pow(2, bits), n),
      atFullWidth: Prng.moduloBias(Prng.TWO32, n),
      rows: Prng.BOUNDED_METHODS.map(function (method) {
        return biasRow(method, { bits: bits, n: n, samples: samples,
          seed: settings.seed || 99, generator: settings.generator || 'pcg32' });
      })
    };
  }

  function biasRow(method, settings) {
    const source = Prng.sourceOf(Prng.build(settings.generator, settings.seed), settings.bits);
    const counts = Prng.bucketCounts(source, { buckets: settings.n, samples: settings.samples,
      method: method.run });
    const verdict = Prng.uniformityVerdict(counts.buckets, settings.samples);
    return {
      id: method.id, label: method.label,
      statistic: verdict.statistic, critical: verdict.critical, passes: verdict.passes,
      drawsPerSample: counts.draws / counts.samples,
      highest: Math.max.apply(null, counts.buckets),
      lowest: Math.min.apply(null, counts.buckets),
      spread: Math.max.apply(null, counts.buckets) / Math.max(1, Math.min.apply(null, counts.buckets))
    };
  }

  /**
   * Both shuffles over every permutation of a short array. Three elements is
   * the right size: six outcomes is a readable table, and 3^3 = 27 paths do
   * not divide into 6, so the bias is forced rather than incidental.
   */
  function shuffleTable(options) {
    const settings = options || {};
    const size = settings.size || 3;
    const trials = settings.trials || 120000;
    const expected = trials / factorial(size);

    return {
      size: size, trials: trials, expected: expected,
      paths: Math.pow(size, size), outcomes: factorial(size),
      divides: Math.pow(size, size) % factorial(size) === 0,
      correct: shuffleRows(size, trials, { seed: settings.seed || 5, naive: false, expected: expected }),
      naive: shuffleRows(size, trials, { seed: settings.seed || 5, naive: true, expected: expected })
    };
  }

  function shuffleRows(size, trials, settings) {
    const source = Prng.sourceOf(Prng.build('pcg32', settings.seed));
    const rows = Prng.permutationCounts(size, { trials: trials, source: source,
      naive: settings.naive });
    const counts = rows.map(function (row) { return row.count; });
    const verdict = Prng.uniformityVerdict(counts, trials);
    return {
      rows: rows.map(function (row) {
        return { permutation: row.permutation, count: row.count,
          ratio: row.count / settings.expected };
      }),
      statistic: verdict.statistic, critical: verdict.critical, passes: verdict.passes,
      spread: Math.max.apply(null, counts) / Math.max(1, Math.min.apply(null, counts))
    };
  }

  function factorial(n) {
    let out = 1;
    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  }

  /** The tiny LCG's period, walked rather than derived. */
  function periodProbe(options) {
    const settings = options || {};
    const family = Prng.LCG_FAMILIES[Prng.LCG_FAMILIES.length - 1];
    return Prng.measurePeriod(Prng.lcg(family, settings.seed || 1), settings.budget || 1000);
  }

  /* ------------------------------------------------------ 17.10 identifiers */

  const SCHEME_IDS = ['sequential', 'uuid4', 'uuid7', 'ulid', 'snowflake'];

  /**
   * A batch of ids from one scheme, with a clock that advances at a stated
   * rate. `millisPerStep` under one means several ids share a millisecond,
   * which is the regime where the time-ordered schemes differ from each other.
   */
  function batch(schemeId, options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 42);
    const stride = settings.idsPerMillisecond || 3;
    let millis = settings.epoch || 1700000000000;
    let issued = 0;

    const generator = Ids.build(schemeId, {
      random: function () { return rng.next(); },
      clock: function () {
        if (issued > 0 && issued % stride === 0) millis += 1;
        issued += 1;
        return millis;
      },
      epoch: settings.epoch || 1700000000000,
      machine: settings.machine || 7
    });

    const ids = [];
    for (let i = 0; i < (settings.count || 20000); i += 1) {
      const id = generator.generate();
      if (id) ids.push(id);
    }
    return { ids: ids, generator: generator };
  }

  /** Every scheme, on the properties that separate them. */
  function schemeTable(options) {
    const settings = options || {};
    return SCHEME_IDS.map(function (id) { return schemeRow(id, settings); });
  }

  function schemeRow(id, settings) {
    const produced = batch(id, settings);
    const order = Ids.sortability(produced.ids);
    const locality = Ids.localitySimulation(produced.ids,
      { pages: settings.pages || 4096, window: settings.window || 64 });
    const unique = Ids.uniqueness(produced.ids);
    const outlook = Ids.collisionOutlook(produced.generator.randomBits || 0, settings.count || 20000);

    return {
      id: id,
      label: produced.generator.label,
      bits: produced.generator.bits,
      randomBits: produced.generator.randomBits || 0,
      sample: produced.ids[0].text,
      length: produced.ids[0].text.length,
      duplicates: unique.duplicates,
      acrossTime: order.acrossTime,
      withinTime: order.withinTime,
      samePairs: order.samePairs,
      timeOrdered: order.timeOrdered,
      strictlyMonotonic: order.monotonic,
      peakWorkingSet: locality.peakWorkingSet,
      meanWorkingSet: locality.meanWorkingSet,
      switchRate: locality.switchRate,
      collisionProbability: outlook.probability,
      leakage: Ids.LEAKAGE[id]
    };
  }

  /**
   * A Snowflake generator driven through a clock that steps backwards. Both
   * policies are run so the trade is a table: waiting keeps monotonicity and
   * stalls, refusing keeps latency and drops ids. Serving from the stale
   * reading - the third option, and the one that ships - produces duplicates,
   * which is why it is not offered.
   */
  function clockRegression(options) {
    const settings = options || {};
    const step = settings.step || 40;
    const before = settings.before || 5;
    const after = settings.after || 8;

    return ['wait', 'refuse'].map(function (policy) {
      return regressionRow(policy, { step: step, before: before, after: after,
        machine: settings.machine || 3 });
    });
  }

  function regressionRow(policy, settings) {
    let now = 1000;
    const generator = Ids.snowflake({ clock: function () { return now; }, epoch: 0,
      machine: settings.machine, onRegression: policy });
    const ids = [];

    for (let i = 0; i < settings.before; i += 1) pushId(ids, generator.generate());
    now -= settings.step;
    for (let i = 0; i < settings.after; i += 1) pushId(ids, generator.generate());

    const order = Ids.sortability(ids);
    return {
      policy: policy,
      requested: settings.before + settings.after,
      issued: ids.length,
      dropped: settings.before + settings.after - ids.length,
      duplicates: Ids.uniqueness(ids).duplicates,
      monotonic: order.monotonic,
      stats: generator.stats()
    };
  }

  function pushId(ids, id) {
    if (id) ids.push(id);
  }

  /**
   * A burst inside one millisecond. Snowflake's twelve sequence bits are 4 096
   * ids per machine per millisecond, and past that the generator must borrow
   * from the future or stall - a hard ceiling that is easy to forget until a
   * backfill job hits it.
   */
  function burst(options) {
    const settings = options || {};
    const fixed = 5000;
    const generator = Ids.snowflake({ clock: function () { return fixed; }, epoch: 0,
      machine: settings.machine || 1 });
    const ids = [];
    for (let i = 0; i < (settings.count || 5000); i += 1) pushId(ids, generator.generate());

    const milliseconds = new Set();
    for (let i = 0; i < ids.length; i += 1) milliseconds.add(ids[i].time);
    return {
      requested: settings.count || 5000,
      issued: ids.length,
      duplicates: Ids.uniqueness(ids).duplicates,
      monotonic: Ids.sortability(ids).monotonic,
      millisecondsUsed: milliseconds.size,
      borrowedFromTheFuture: milliseconds.size - 1,
      perMillisecondCeiling: 4096,
      stats: generator.stats()
    };
  }

  /** How the locality gap moves with the buffer-pool window. */
  function localitySweep(options) {
    const settings = options || {};
    const windows = settings.windows || [8, 32, 64, 256, 1024];
    return SCHEME_IDS.map(function (id) {
      const produced = batch(id, settings);
      return {
        id: id,
        points: windows.map(function (window) {
          const found = Ids.localitySimulation(produced.ids,
            { pages: settings.pages || 4096, window: window });
          return { window: window, peak: found.peakWorkingSet, mean: found.meanWorkingSet };
        })
      };
    });
  }

  return {
    SCHEME_IDS: SCHEME_IDS,
    generatorTable: generatorTable,
    scatter: scatter,
    bitHeat: bitHeat,
    biasTable: biasTable,
    shuffleTable: shuffleTable,
    periodProbe: periodProbe,
    batch: batch,
    schemeTable: schemeTable,
    clockRegression: clockRegression,
    burst: burst,
    localitySweep: localitySweep
  };
}));
