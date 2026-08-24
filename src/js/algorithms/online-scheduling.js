/**
 * Assigning arrivals to machines, and the one-line change that collapses tail load.
 *
 * Graham's list scheduling puts each arriving job on the least-loaded machine
 * and is (2 − 1/m)-competitive — a bound from 1966 that no online algorithm
 * beats by much, and one whose tight instance is worth knowing: m(m − 1) tiny
 * jobs followed by one enormous one. Offline, sorting the jobs longest-first
 * first gives 4/3 − 1/(3m), which is the same algorithm with the future
 * revealed and is the cleanest illustration of what online costs.
 *
 * The interesting result is the randomised one. Assigning each job to a
 * uniformly random machine leaves a maximum load of about log n / log log n
 * above the mean. Sampling TWO machines and taking the less loaded leaves
 * about log log n. That is an exponential improvement for one extra sample,
 * it is a one-line change to any random load balancer, and it is the highest
 * ratio of benefit to effort anywhere in this milestone.
 *
 * Consistent hashing is here as the third strategy because it answers a
 * different question — not "which machine is least loaded" but "which machine
 * would this key go to if the set of machines changed" — and its load
 * imbalance is a consequence of that constraint rather than a defect. The
 * module measures both properties, because a comparison that reports only the
 * imbalance makes it look strictly worse than random assignment, which is the
 * standard misreading.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.OnlineScheduling = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* -------------------------------------------------------- list scheduling */

  function emptyLoads(machines) {
    return new Array(machines).fill(0);
  }

  function leastLoaded(loads) {
    let best = 0;

    for (let i = 1; i < loads.length; i += 1) { if (loads[i] < loads[best]) best = i; }
    return best;
  }

  /**
   * Graham's rule: put the next job on the least-loaded machine, now, without
   * looking ahead. `order` may reorder the jobs first, which is what turns it
   * from an online algorithm into the offline LPT heuristic.
   */
  function listSchedule(jobs, machines, options) {
    const settings = options || {};
    const order = settings.longestFirst
      ? jobs.slice().sort(function (a, b) { return b - a; })
      : jobs.slice();
    const loads = emptyLoads(machines);
    const assignment = [];

    order.forEach(function (size) {
      const at = leastLoaded(loads);
      loads[at] += size;
      assignment.push(at);
    });
    return { name: settings.longestFirst ? 'LPT (offline)' : 'list scheduling (online)',
      loads: loads, assignment: assignment, makespan: Math.max.apply(null, loads),
      bound: settings.longestFirst ? 4 / 3 - 1 / (3 * machines) : 2 - 1 / machines };
  }

  /**
   * A lower bound on the offline optimum that costs nothing: the makespan is
   * at least the mean load and at least the largest single job. It is not the
   * optimum — computing that is NP-hard — so every ratio in this module is
   * against a BOUND and is therefore an over-estimate of the true ratio.
   */
  function makespanBound(jobs, machines) {
    const total = jobs.reduce(function (a, b) { return a + b; }, 0);

    return Math.max(total / machines, Math.max.apply(null, jobs));
  }

  /** Exact makespan by exhaustive assignment, for instances small enough. */
  function exactMakespan(jobs, machines, limit) {
    const cap = limit === undefined ? 200000 : limit;

    if (Math.pow(machines, jobs.length) > cap) return null;
    const loads = emptyLoads(machines);
    let best = Infinity;

    const walk = function (index) {
      if (index === jobs.length) { best = Math.min(best, Math.max.apply(null, loads)); return; }
      for (let m = 0; m < machines; m += 1) {
        loads[m] += jobs[index];
        if (Math.max.apply(null, loads) < best) walk(index + 1);
        loads[m] -= jobs[index];
      }
    };
    walk(0);
    return best;
  }

  /**
   * The family that attains Graham's bound: m(m − 1) jobs of size 1 followed
   * by one job of size m. The online rule spreads the small jobs evenly and
   * then has nowhere good to put the big one, paying 2m − 1 against an optimum
   * of m.
   */
  function grahamTrap(machines) {
    const jobs = [];

    for (let i = 0; i < machines * (machines - 1); i += 1) jobs.push(1);
    jobs.push(machines);
    return { jobs: jobs, machines: machines, optimum: machines,
      reason: 'the small jobs fill every machine to m − 1, and the big one lands on top of one' };
  }

  /* ------------------------------------------------------- balls into bins */

  /**
   * `choices` samples are taken and the least loaded wins. One choice is plain
   * random assignment; two is the change the section is about. The counters
   * are loads rather than times, so the result is the balls-in-bins maximum
   * and nothing about scheduling is assumed.
   */
  function ballsInBins(options) {
    const settings = options || {};
    const bins = settings.bins === undefined ? 1000 : settings.bins;
    const balls = settings.balls === undefined ? bins : settings.balls;
    const choices = settings.choices === undefined ? 1 : settings.choices;
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const loads = emptyLoads(bins);

    for (let i = 0; i < balls; i += 1) {
      let best = rng.int(bins);
      for (let c = 1; c < choices; c += 1) {
        const other = rng.int(bins);
        if (loads[other] < loads[best]) best = other;
      }
      loads[best] += 1;
    }
    const max = Math.max.apply(null, loads);
    return { bins: bins, balls: balls, choices: choices, loads: loads, max: max,
      mean: balls / bins, overMean: max - balls / bins, empty: loads.filter(function (v) {
        return v === 0;
      }).length };
  }

  /**
   * The sweep the claim is about. With one choice the gap above the mean grows
   * like log n / log log n; with two it grows like log log n / log 2, which is
   * nearly flat over any range a browser can run. Both predictions are
   * reported next to the measurement rather than only the ratio.
   */
  function choicesSweep(options) {
    const settings = options || {};
    const sizes = settings.sizes === undefined ? [100, 400, 1600, 6400, 25600] : settings.sizes;
    const trials = settings.trials === undefined ? 12 : settings.trials;

    return { trials: trials, rows: sizes.map(function (n) {
      return { n: n,
        one: averageMax(n, 1, trials, settings.seed),
        two: averageMax(n, 2, trials, settings.seed),
        three: averageMax(n, 3, trials, settings.seed),
        predictedOne: Math.log(n) / Math.log(Math.log(n)),
        predictedTwo: Math.log(Math.log(n)) / Math.log(2) };
    }) };
  }

  function averageMax(n, choices, trials, seed) {
    let total = 0;

    for (let t = 0; t < trials; t += 1) {
      total += ballsInBins({ bins: n, balls: n, choices: choices,
        seed: (seed === undefined ? 1 : seed) + t * 101 }).max;
    }
    return total / trials;
  }

  /* ------------------------------------------------------ consistent hashing */

  function hashKey(key, salt) {
    let h = 2166136261 ^ (salt * 0x9e3779b1);
    const text = String(key);

    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    return h >>> 0;
  }

  /**
   * A ring of virtual nodes. The point is not load balance — it is that
   * removing one machine only moves the keys that machine owned, which random
   * assignment cannot promise at all. `replicas` trades imbalance for memory,
   * and the demo sweeps it because the trade is the design.
   */
  function consistentRing(machines, replicas) {
    const points = [];

    for (let m = 0; m < machines; m += 1) {
      for (let r = 0; r < replicas; r += 1) points.push({ at: hashKey('m' + m + ':' + r, 7), machine: m });
    }
    points.sort(function (a, b) { return a.at - b.at; });
    return { points: points, machines: machines, replicas: replicas };
  }

  function ringLookup(ring, key) {
    const at = hashKey(key, 11);
    let low = 0;
    let high = ring.points.length - 1;
    let answer = 0;

    while (low <= high) {
      const middle = (low + high) >> 1;
      if (ring.points[middle].at >= at) { answer = middle; high = middle - 1; continue; }
      low = middle + 1;
    }
    return ring.points[answer % ring.points.length].machine;
  }

  /**
   * Two measurements that have to be reported together: the load imbalance,
   * where consistent hashing loses to random assignment, and the fraction of
   * keys that move when a machine is removed, where random assignment has no
   * answer at all.
   */
  function ringStudy(options) {
    const settings = options || {};
    const machines = settings.machines === undefined ? 16 : settings.machines;
    const keys = settings.keys === undefined ? 20000 : settings.keys;
    const replicas = settings.replicas === undefined ? [1, 4, 16, 64, 256] : settings.replicas;

    return { machines: machines, keys: keys, rows: replicas.map(function (count) {
      return ringRow(machines, keys, count);
    }) };
  }

  function ringRow(machines, keys, replicas) {
    const ring = consistentRing(machines, replicas);
    const smaller = consistentRing(machines - 1, replicas);
    const loads = emptyLoads(machines);
    let moved = 0;

    /* Machine m − 1 is the one removed, and its points are simply absent from
       the smaller ring — every other machine keeps the same virtual nodes. A
       key has moved exactly when its owner changes, and comparing against a
       clamped index instead counts a key that lands on its own neighbour as
       staying put, which reads as 0.0803 where the truth is 1/m. */
    for (let k = 0; k < keys; k += 1) {
      const owner = ringLookup(ring, 'k' + k);
      loads[owner] += 1;
      if (ringLookup(smaller, 'k' + k) !== owner) moved += 1;
    }
    const max = Math.max.apply(null, loads);
    const min = Math.min.apply(null, loads);
    return { replicas: replicas, points: ring.points.length, max: max, min: min,
      mean: keys / machines, imbalance: max / (keys / machines),
      spread: max / Math.max(1, min), movedOnRemoval: moved / keys,
      idealMove: 1 / machines };
  }

  return {
    listSchedule: listSchedule, makespanBound: makespanBound, exactMakespan: exactMakespan,
    grahamTrap: grahamTrap, leastLoaded: leastLoaded,
    ballsInBins: ballsInBins, choicesSweep: choicesSweep,
    consistentRing: consistentRing, ringLookup: ringLookup, ringStudy: ringStudy,
    hashKey: hashKey
  };
}));
