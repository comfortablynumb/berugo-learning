'use strict';

/**
 * Property tests for the M21.1-M21.3 modules: replacement policies, adaptive
 * caches, the online-decision studies and online scheduling.
 *
 * These pin down what has to be true of the modules whatever their settings -
 * conservation laws, bounds that cannot be crossed, and the reference answers
 * that make a ratio mean anything. The figures the prose quotes are checked
 * separately in worked-examples-online.test.js.
 */

const test = require('node:test');
const assert = require('node:assert');

const Policies = require('../../src/js/algorithms/replacement-policies.js');
const Adaptive = require('../../src/js/algorithms/adaptive-caches.js');
const Decisions = require('../../src/js/algorithms/online-decisions.js');
const Scheduling = require('../../src/js/algorithms/online-scheduling.js');
const Random = require('../../src/js/utils/random.js');

const ONLINE = Policies.NAMES.filter(function (name) { return name !== 'belady'; })
  .concat(Adaptive.NAMES);

function cacheFor(name, capacity) {
  return Policies.NAMES.indexOf(name) >= 0
    ? Policies.create(name, capacity)
    : Adaptive.create(name, capacity);
}

/** Resident entries only - ARC's b1/b2 and 2Q's out list are ghosts, which hold no data. */
function residentCount(cache) {
  const state = cache.state();

  if (state.resident) return state.resident.length;
  if (state.counts) return state.counts.length;

  if (state.slots) {
    return state.slots.filter(function (slot) { return slot !== null; }).length;
  }
  if (state.t1) return state.t1.length + state.t2.length;
  if (state.in) return state.in.length + state.main.length;
  return state.window.length + state.probation.length + state.protected.length;
}

function trace(length, universe, seed) {
  const rng = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < length; i += 1) out.push(Math.floor(rng.next() * universe));
  return out;
}

function randomJobs(seed, count, max) {
  const rng = Random.seeded(seed);
  const jobs = [];

  for (let i = 0; i < count; i += 1) jobs.push(1 + Math.floor(rng.next() * max));
  return jobs;
}

function total(values) {
  return values.reduce(function (a, b) { return a + b; }, 0);
}

/* --------------------------------------------------------- 21.2 policies */

test('every policy accounts for every request exactly once', function () {
  const requests = trace(4000, 400, 5);

  ONLINE.forEach(function (name) {
    const stats = Policies.replay(cacheFor(name, 100), requests);

    assert.strictEqual(stats.accesses, 4000, name + ' lost requests');
    assert.strictEqual(stats.hits + stats.misses, 4000, name + ' double-counted');
    assert.ok(Math.abs(stats.hitRate - stats.hits / 4000) < 1e-12, name + ' hit rate');
  });
});

test('no policy ever holds more than its capacity', function () {
  const requests = trace(2000, 500, 9);

  [10, 50, 200].forEach(function (capacity) {
    ONLINE.forEach(function (name) {
      const cache = cacheFor(name, capacity);

      requests.forEach(function (key) {
        cache.get(key);
        assert.ok(residentCount(cache) <= capacity,
          name + ' at ' + capacity + ' held ' + residentCount(cache));
      });
    });
  });
});

test('Belady is an upper bound on every online policy, on every trace', function () {
  [[3000, 300, 3], [3000, 60, 4], [2000, 2000, 5]].forEach(function (spec) {
    const requests = trace(spec[0], spec[1], spec[2]);
    const optimum = Policies.belady(requests, 50).hitRate;

    ONLINE.forEach(function (name) {
      const hitRate = Policies.replay(cacheFor(name, 50), requests).hitRate;

      assert.ok(hitRate <= optimum + 1e-12,
        name + ' beat the offline optimum: ' + hitRate + ' against ' + optimum);
    });
  });
});

test('a cache larger than the working set settles into hits', function () {
  const requests = [];

  for (let round = 0; round < 40; round += 1) {
    for (let key = 0; key < 20; key += 1) requests.push(key);
  }
  ONLINE.forEach(function (name) {
    const stats = Policies.replay(cacheFor(name, 40), requests);

    assert.ok(stats.hitRate >= 0.9,
      name + ' hit only ' + stats.hitRate + ' on 20 keys cycling in a cache of 40');
  });
});

test('a strictly sequential scan defeats every recency and frequency policy', function () {
  const requests = [];

  for (let i = 0; i < 5000; i += 1) requests.push(i);
  ['fifo', 'lru', 'clock', 'lfu'].forEach(function (name) {
    const stats = Policies.replay(Policies.create(name, 100), requests);

    assert.strictEqual(stats.hits, 0, name + ' cannot hit on a trace with no repeats');
  });
});

test('ARC keeps its target inside the cache size', function () {
  const requests = trace(6000, 700, 11);
  const cache = Adaptive.arc(120);

  requests.forEach(function (key) {
    cache.get(key);
    const p = cache.state().p;

    assert.ok(p >= 0 && p <= 120, 'ARC target left [0, capacity]: ' + p);
  });
});

test('the frequency sketch never under-counts until it decays', function () {
  const sketch = Adaptive.frequencySketch(4096);
  const counts = {};

  for (let i = 0; i < 500; i += 1) {
    const key = i % 37;

    sketch.increment(key);
    counts[key] = (counts[key] || 0) + 1;
  }
  assert.strictEqual(sketch.resets(), 0, 'this many increments must not trigger a decay');
  Object.keys(counts).forEach(function (key) {
    assert.ok(sketch.estimate(Number(key)) >= counts[key],
      'the sketch under-counted key ' + key + ': ' + sketch.estimate(Number(key)) +
      ' against ' + counts[key]);
  });
});

/* ------------------------------------------------- 21.1 online decisions */

test('the break-even rule never exceeds 2 - 1/B, and attains it at day B', function () {
  [2, 3, 5, 10, 25, 100].forEach(function (buyPrice) {
    const sweep = Decisions.skiSweep({ buyPrice: buyPrice, horizon: buyPrice * 3 });
    const row = sweep.rows.filter(function (r) { return r.strategy.name === 'break-even'; })[0];

    assert.ok(Math.abs(sweep.bound - (2 - 1 / buyPrice)) < 1e-12, 'the stated bound is 2 - 1/B');
    assert.ok(row.worst <= sweep.bound + 1e-12,
      'B=' + buyPrice + ': worst ratio ' + row.worst + ' exceeds the bound');
    assert.ok(Math.abs(row.worst - sweep.bound) < 1e-12,
      'B=' + buyPrice + ': the bound must be attained, not merely respected');
    assert.strictEqual(row.worstAt, buyPrice, 'B=' + buyPrice + ': attained on day B');
  });
});

test('the offline optimum for ski rental is min(days, B), and nothing beats it', function () {
  [4, 10, 30].forEach(function (buyPrice) {
    for (let days = 0; days <= buyPrice * 2; days += 1) {
      const optimum = Decisions.skiOptimum(days, buyPrice);

      assert.strictEqual(optimum, Math.min(days, buyPrice));
      [Decisions.breakEvenStrategy, Decisions.alwaysBuy, Decisions.alwaysRent]
        .forEach(function (strategy) {
          const cost = Decisions.skiCost(strategy(buyPrice), days, buyPrice);

          assert.ok(cost >= optimum - 1e-12, 'a strategy beat the offline optimum');
        });
    }
  });
});

test('the two mistakes are worse than the break-even rule at their worst', function () {
  const sweep = Decisions.skiSweep({ buyPrice: 10, horizon: 40 });
  const worstOf = function (name) {
    return sweep.rows.filter(function (r) { return r.strategy.name === name; })[0].worst;
  };

  assert.ok(worstOf('never buy') > worstOf('break-even'), 'renting forever must be worse');
  assert.ok(worstOf('buy immediately') > worstOf('break-even'), 'buying immediately must be worse');
  assert.strictEqual(worstOf('buy immediately'), 10,
    'buying immediately on a one-day season costs B times the optimum');
});

test('the randomised strategy is helped by an oblivious adversary and hurt by an adaptive one', function () {
  const study = Decisions.randomisedStudy({ buyPrice: 10, trials: 600 });

  assert.ok(Math.abs(study.deterministicBound - (2 - 1 / 10)) < 1e-12,
    'the deterministic bound is 2 - 1/B');
  assert.ok(study.obliviousWorst < study.deterministicBound,
    'against a fixed sequence, randomisation must beat the deterministic bound');
  assert.ok(study.adaptiveMean > study.obliviousWorst,
    'an adversary that sees the coin must do better than one that does not');
});

test('list update: every policy pays at least one access per request', function () {
  const study = Decisions.listStudy({ size: 20, seed: 3 });

  study.rows.forEach(function (row) {
    assert.ok(row.cost >= study.requests,
      row.policy + ' paid less than one access per request');
    assert.ok(row.ratio > 0 && Number.isFinite(row.ratio), row.policy + ' ratio is not finite');
  });
  assert.ok(study.reference > 0, 'the reference order must have a cost');
  const best = study.rows.filter(function (r) { return r.policy === 'best static order'; })[0];

  assert.strictEqual(best.cost, study.reference, 'the reference IS the best static order');
  assert.strictEqual(best.ratio, 1, 'and it scores 1 against itself');
});

test('the best static order is the best of the static orders', function () {
  const requests = Decisions.zipfRequests(12, { seed: 7, count: 3000 });
  const identity = [];

  for (let i = 0; i < 12; i += 1) identity.push(i);
  const best = Decisions.bestStatic(identity, requests);

  for (let trial = 0; trial < 20; trial += 1) {
    const order = Decisions.startingOrder(12, { seed: trial + 40 });
    let cost = 0;

    requests.forEach(function (key) { cost += order.indexOf(key) + 1; });
    assert.ok(best.cost <= cost, 'a random static order beat the best static order');
  }
});

/* ------------------------------------------------ 21.3 online scheduling */

test('list scheduling conserves work and respects Graham’s bound', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const jobs = randomJobs(seed, 8, 20);

    [2, 3, 4].forEach(function (machines) {
      const schedule = Scheduling.listSchedule(jobs, machines);
      const optimum = Scheduling.exactMakespan(jobs, machines);
      const bound = 2 - 1 / machines;

      assert.strictEqual(total(schedule.loads), total(jobs), 'work was created or lost');
      assert.ok(optimum !== null, 'the instance must be small enough to solve exactly');
      assert.ok(schedule.makespan <= optimum * bound + 1e-9,
        'seed ' + seed + ': ' + schedule.makespan + ' exceeds ' + bound + ' times ' + optimum);
      assert.ok(schedule.makespan >= optimum, 'an online schedule cannot beat the optimum');
    });
  }
});

test('the lower bound is a lower bound, on every instance', function () {
  for (let seed = 1; seed <= 15; seed += 1) {
    const jobs = randomJobs(seed * 5, 8, 30);

    [2, 3, 4].forEach(function (machines) {
      const bound = Scheduling.makespanBound(jobs, machines);
      const optimum = Scheduling.exactMakespan(jobs, machines);

      assert.ok(bound <= optimum + 1e-9,
        'the max of the average load and the largest job cannot exceed the optimum');
      assert.ok(bound >= Math.max.apply(null, jobs) - 1e-9,
        'no schedule finishes before its longest job');
    });
  }
});

test('longest-first respects the tighter 4/3 - 1/(3m) bound', function () {
  for (let seed = 1; seed <= 20; seed += 1) {
    const jobs = randomJobs(seed * 3, 8, 20);

    [2, 3, 4].forEach(function (machines) {
      const lpt = Scheduling.listSchedule(jobs, machines, { longestFirst: true });
      const optimum = Scheduling.exactMakespan(jobs, machines);
      const bound = 4 / 3 - 1 / (3 * machines);

      assert.ok(lpt.makespan <= optimum * bound + 1e-9,
        'seed ' + seed + ' on ' + machines + ': ' + lpt.makespan + ' against ' + optimum);
    });
  }
});

test('the Graham trap attains the online bound and sorting removes it', function () {
  [2, 3, 4, 5].forEach(function (machines) {
    const trap = Scheduling.grahamTrap(machines);
    const online = Scheduling.listSchedule(trap.jobs, machines).makespan;
    const sorted = Scheduling.listSchedule(trap.jobs, machines, { longestFirst: true }).makespan;

    assert.ok(Math.abs(online / trap.optimum - (2 - 1 / machines)) < 1e-9,
      'the trap must attain 2 - 1/m exactly at m = ' + machines);
    assert.ok(sorted < online, 'sorting must help on the trap');
    assert.strictEqual(sorted, trap.optimum, 'sorted, the trap is packed perfectly');
  });
});

test('two choices beats one, and the gap widens with the bin count', function () {
  const sweep = Scheduling.choicesSweep({ sizes: [100, 400, 1600], trials: 6 });

  sweep.rows.forEach(function (row) {
    assert.ok(row.two <= row.one, 'two choices was worse at ' + row.bins + ' bins');
    assert.ok(row.three <= row.two + 1e-9, 'three choices was worse than two at ' + row.bins);
  });
  const first = sweep.rows[0];
  const last = sweep.rows[sweep.rows.length - 1];

  assert.ok(last.one > first.one, 'the single-choice maximum must grow with the bin count');
  assert.ok(last.two - first.two <= last.one - first.one,
    'two choices must grow more slowly than one');
});

test('balls in bins conserves the balls', function () {
  [1, 2, 3].forEach(function (choices) {
    const study = Scheduling.ballsInBins({ bins: 200, balls: 200, choices: choices, seed: 4 });

    assert.strictEqual(total(study.loads), 200,
      'balls were created or lost at ' + choices + ' choices');
    assert.ok(study.max >= 1, 'some bin must hold at least one ball');
  });
});

test('more virtual nodes buy a flatter ring and move about one machine’s share', function () {
  const study = Scheduling.ringStudy({ machines: 8, keys: 4000, seed: 2 });
  const first = study.rows[0];
  const last = study.rows[study.rows.length - 1];

  assert.ok(last.imbalance < first.imbalance,
    'replicas must flatten the load: ' + last.imbalance + ' against ' + first.imbalance);
  study.rows.forEach(function (row) {
    assert.strictEqual(row.points, study.machines * row.replicas, 'points per machine');
    assert.ok(total([row.max, -row.mean]) >= 0, 'the maximum cannot be below the mean');
  });
  assert.ok(Math.abs(last.movedOnRemoval - last.idealMove) < last.idealMove * 0.6,
    'at many replicas the moved share must approach 1/m: ' + last.movedOnRemoval);
});

test('a ring lookup is stable and returns a real machine', function () {
  const ring = Scheduling.consistentRing(6, 32);

  for (let key = 0; key < 500; key += 1) {
    const owner = Scheduling.ringLookup(ring, key);

    assert.strictEqual(owner, Scheduling.ringLookup(ring, key),
      'the ring is not a function of the key');
    assert.ok(owner >= 0 && owner < 6, 'the ring returned machine ' + owner);
  }
});
