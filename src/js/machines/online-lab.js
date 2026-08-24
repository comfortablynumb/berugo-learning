/**
 * OnlineLab — the offline optimum that makes a competitive ratio a measurement.
 *
 * A competitive ratio is a quotient, and the denominator is the part people
 * skip. Every study here computes the offline optimum — exactly where it is
 * cheap, and by an explicit LOWER BOUND where the exact answer is NP-hard —
 * and says which of the two it used. A ratio against a lower bound is an
 * over-estimate of the true ratio, and reporting it as though it were exact is
 * the standard way a heuristic ends up looking worse than it is.
 *
 * The second discipline is that a competitive ratio is a MAXIMUM over inputs
 * rather than a mean. Every sweep here reports the worst case it found, the
 * input that produced it, and the mean beside them, because the mean is
 * usually the friendlier number and is not what the bound is about.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.OnlineLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');
  const Decisions = scope && scope.OnlineDecisions ? scope.OnlineDecisions
    : require('../algorithms/online-decisions.js');
  const Scheduling = scope && scope.OnlineScheduling ? scope.OnlineScheduling
    : require('../algorithms/online-scheduling.js');
  const BinPacking = scope && scope.BinPacking ? scope.BinPacking
    : require('../algorithms/bin-packing.js');

  /* ------------------------------------------------------ 21.1 ski rental */

  /**
   * The three deterministic strategies over every season length, plus the
   * randomised one under both adversary models. The break-even rule must
   * attain 2 − 1/B exactly, and it does — which makes the table a measurement
   * of the theorem rather than a restatement of it.
   */
  function skiStudy(options) {
    const settings = options || {};
    const buyPrice = settings.buyPrice === undefined ? 10 : settings.buyPrice;
    const deterministic = Decisions.skiSweep({ buyPrice: buyPrice,
      horizon: settings.horizon === undefined ? buyPrice * 3 : settings.horizon });
    const randomised = Decisions.randomisedStudy({ buyPrice: buyPrice,
      trials: settings.trials === undefined ? 2000 : settings.trials, seed: settings.seed });

    return { buyPrice: buyPrice, deterministic: deterministic, randomised: randomised,
      attained: deterministic.rows.filter(function (row) {
        return row.strategy.name === 'break-even';
      })[0] };
  }

  /** How the deterministic bound moves with the purchase price: 2 − 1/B rises
   *  towards 2, so a cheap purchase makes the online rule nearly optimal. */
  function skiPriceSweep(options) {
    const settings = options || {};
    const prices = settings.prices === undefined ? [2, 4, 10, 25, 100] : settings.prices;

    return { rows: prices.map(function (buyPrice) {
      const sweep = Decisions.skiSweep({ buyPrice: buyPrice, horizon: buyPrice * 3 });
      const breakEven = sweep.rows.filter(function (row) {
        return row.strategy.name === 'break-even';
      })[0];
      return { buyPrice: buyPrice, worst: breakEven.worst, worstAt: breakEven.worstAt,
        bound: sweep.bound, mean: breakEven.mean, matchesBound: Math.abs(breakEven.worst -
          sweep.bound) < 1e-9 };
    }) };
  }

  /** List update on three request families, scored against the best static
   *  order — not the offline optimum, which for this problem is NP-hard. */
  function listStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 20 : settings.size;

    return { size: size, families: [
      { name: 'Zipf (a stationary distribution)',
        study: Decisions.listStudy({ size: size, seed: settings.seed }) },
      { name: 'bursty (a working set that moves)',
        study: Decisions.listStudy({ size: size,
          requests: Decisions.burstyRequests(size, { seed: settings.seed }) }) },
      { name: 'reverse sweep (the worst case for move-to-front)',
        study: Decisions.listStudy({ size: size,
          requests: Decisions.reverseSweep(size, 50) }) }
    ] };
  }

  /* ------------------------------------------------- 21.3 online scheduling */

  /**
   * List scheduling against LPT and against the exact optimum where the
   * instance is small enough for it. The `optimumKind` field says which
   * denominator each row used, because a ratio against a bound and a ratio
   * against an optimum are different numbers.
   */
  function schedulingStudy(options) {
    const settings = options || {};
    const machines = settings.machines === undefined ? 4 : settings.machines;
    const instances = settings.instances === undefined ? 40 : settings.instances;
    const jobs = settings.jobs === undefined ? 8 : settings.jobs;
    const rows = [];

    for (let seed = 1; seed <= instances; seed += 1) {
      rows.push(schedulingRow(seed, machines, jobs, settings));
    }
    /* Only the rows with an EXACT denominator can be compared against the
       proved bounds. Mixing in rows scored against a lower bound produced an
       LPT "worst" of 1.3647 against a bound of 1.2500, which reads as a
       violated theorem and is a violated denominator. */
    const exact = rows.filter(function (row) { return row.optimumKind === 'exact'; });

    return { machines: machines, instances: instances, jobs: jobs, rows: rows,
      exactRows: exact.length,
      onlineWorst: worstOf(exact, 'onlineRatio'), lptWorst: worstOf(exact, 'lptRatio'),
      onlineMean: meanOf(exact, 'onlineRatio'), lptMean: meanOf(exact, 'lptRatio'),
      onlineBound: 2 - 1 / machines, lptBound: 4 / 3 - 1 / (3 * machines),
      trap: trapRow(machines) };
  }

  function schedulingRow(seed, machines, jobs, settings) {
    const rng = Random.seeded(seed * 13 + (settings.seed === undefined ? 0 : settings.seed));
    const sizes = [];

    for (let i = 0; i < jobs; i += 1) sizes.push(1 + rng.int(20));
    const exact = Scheduling.exactMakespan(sizes, machines,
      settings.exactLimit === undefined ? 2000000 : settings.exactLimit);
    const denominator = exact === null ? Scheduling.makespanBound(sizes, machines) : exact;
    const online = Scheduling.listSchedule(sizes, machines).makespan;
    const lpt = Scheduling.listSchedule(sizes, machines, { longestFirst: true }).makespan;

    return { seed: seed, jobs: sizes, optimum: denominator,
      optimumKind: exact === null ? 'lower bound' : 'exact',
      online: online, lpt: lpt,
      onlineRatio: online / denominator, lptRatio: lpt / denominator };
  }

  function trapRow(machines) {
    const trap = Scheduling.grahamTrap(machines);
    const online = Scheduling.listSchedule(trap.jobs, machines);
    const lpt = Scheduling.listSchedule(trap.jobs, machines, { longestFirst: true });

    return { machines: machines, jobs: trap.jobs.length, optimum: trap.optimum,
      online: online.makespan, lpt: lpt.makespan,
      onlineRatio: online.makespan / trap.optimum, lptRatio: lpt.makespan / trap.optimum,
      bound: online.bound, reason: trap.reason };
  }

  function worstOf(rows, field) {
    return rows.reduce(function (best, row) { return Math.max(best, row[field]); }, 0);
  }

  function meanOf(rows, field) {
    return rows.reduce(function (sum, row) { return sum + row[field]; }, 0) / rows.length;
  }

  /** The two-choices sweep, with both asymptotic predictions beside it. */
  function choicesStudy(options) {
    return Scheduling.choicesSweep(options || {});
  }

  /** Consistent hashing measured on both properties at once: the imbalance it
   *  costs, and the key movement it saves. */
  function ringStudy(options) {
    return Scheduling.ringStudy(options || {});
  }

  /* ------------------------------------------------------ 21.4 bin packing */

  /**
   * Every policy on one workload in one dimension, scored against the LP lower
   * bound, and — on instances small enough — against the exact optimum too.
   * The two denominators disagree, and reporting only the first makes every
   * policy look better than it is.
   */
  function packingStudy(options) {
    const settings = options || {};
    const items = settings.items || BinPacking.randomItems({
      count: settings.count === undefined ? 200 : settings.count,
      seed: settings.seed === undefined ? 1 : settings.seed });
    const bound = BinPacking.lowerBound(items, 1);

    return { items: items.length, lowerBound: bound,
      totalSize: items.reduce(function (a, b) { return a + b; }, 0),
      rows: BinPacking.POLICIES.map(function (policy) {
        const packed = BinPacking.pack(items, 1, policy);
        return Object.assign({}, packed, { ratio: packed.bins / bound });
      }) };
  }

  /** The same policies against the EXACT optimum on many small instances, so
   *  the 11/9 claim is checked rather than quoted. */
  function packingExactStudy(options) {
    const settings = options || {};
    const instances = settings.instances === undefined ? 25 : settings.instances;
    const count = settings.count === undefined ? 12 : settings.count;
    const rows = [];

    for (let seed = 1; seed <= instances; seed += 1) {
      const items = BinPacking.randomItems({ count: count, seed: seed, low: 0.1, high: 0.7 });
      const exact = BinPacking.exactBins(items, 1);
      if (exact.exhausted) continue;
      rows.push({ seed: seed, optimum: exact.bins,
        firstFit: BinPacking.pack(items, 1, 'first-fit').bins,
        decreasing: BinPacking.pack(items, 1, 'first-fit-decreasing').bins });
    }
    return { instances: rows.length, rows: rows,
      firstFitWorst: rows.reduce(function (best, row) {
        return Math.max(best, row.firstFit / row.optimum);
      }, 0),
      decreasingWorst: rows.reduce(function (best, row) {
        return Math.max(best, row.decreasing / row.optimum);
      }, 0),
      bound: 11 / 9 };
  }

  /** The trap that pushes first-fit to 1.7, at three sizes. */
  function packingTrapStudy(options) {
    const settings = options || {};
    const sizes = settings.sizes === undefined ? [6, 12, 24, 48] : settings.sizes;

    return { rows: sizes.map(function (groups) {
      const trap = BinPacking.firstFitTrap(groups);
      const firstFit = BinPacking.pack(trap.items, 1, 'first-fit');
      const decreasing = BinPacking.pack(trap.items, 1, 'first-fit-decreasing');
      return { groups: groups, items: trap.items.length, optimum: trap.optimum,
        firstFit: firstFit.bins, decreasing: decreasing.bins,
        firstFitRatio: firstFit.bins / trap.optimum,
        decreasingRatio: decreasing.bins / trap.optimum };
    }), reason: BinPacking.firstFitTrap(2).reason };
  }

  /** One dimension against two, on jobs whose axes are anti-correlated. */
  function twoDimensionStudy(options) {
    const settings = options || {};
    const jobs = settings.jobs || BinPacking.randomJobs({
      count: settings.count === undefined ? 200 : settings.count,
      seed: settings.seed === undefined ? 2 : settings.seed,
      skew: settings.skew });
    const capacity = { cpu: 1, mem: 1 };
    const flat = jobs.map(function (job) { return Math.max(job.cpu, job.mem); });

    return { jobs: jobs.length, capacity: capacity,
      oneDimension: BinPacking.POLICIES.map(function (policy) {
        const packed = BinPacking.pack(flat, 1, policy);
        return Object.assign({}, packed, { ratio: packed.bins / packed.lowerBound });
      }),
      twoDimensions: BinPacking.POLICIES.map(function (policy) {
        const packed = BinPacking.pack2d(jobs, capacity, policy);
        return Object.assign({}, packed, { ratio: packed.bins / packed.lowerBound });
      }) };
  }

  return {
    skiStudy: skiStudy, skiPriceSweep: skiPriceSweep, listStudy: listStudy,
    schedulingStudy: schedulingStudy, choicesStudy: choicesStudy, ringStudy: ringStudy,
    packingStudy: packingStudy, packingExactStudy: packingExactStudy,
    packingTrapStudy: packingTrapStudy, twoDimensionStudy: twoDimensionStudy
  };
}));
