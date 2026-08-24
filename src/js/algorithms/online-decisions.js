/**
 * Deciding without the future, and the ratio that prices the decision.
 *
 * An online algorithm makes irrevocable choices as requests arrive and is
 * scored against an offline optimum that saw the whole sequence first. The
 * competitive ratio is the worst that quotient can be over every input, and it
 * is not an average — an algorithm is c-competitive when NO adversary can push
 * it past c, which makes the bound a promise rather than a summary.
 *
 * Ski rental is the smallest problem in which anything interesting happens.
 * Renting costs 1 a day, buying costs B once, and the season ends on a day the
 * adversary chooses. Rent too long and you pay more than B; buy too early and
 * the season ends tomorrow. The optimal deterministic rule is one line — rent
 * until you have spent B, then buy — and it is exactly (2 − 1/B)-competitive,
 * with the adversary's worst case being the day after you buy.
 *
 * Randomisation genuinely helps here, which is not obvious. Against an
 * OBLIVIOUS adversary — one that fixes the input before seeing your coins — a
 * randomised buy day drawn from the right distribution is e/(e − 1)-competitive
 * in expectation, about 1.582 against the deterministic 2. Against an ADAPTIVE
 * adversary it is worth nothing, because an adversary that watches your coins
 * can end the season the day after whatever you rolled. The module measures
 * both, because the difference between the two adversary models is the whole
 * reason randomisation is not free.
 *
 * List update is the second problem and it exists to make one point: the
 * offline optimum for it is NP-hard, so this module scores against the best
 * STATIC order — sort by access frequency, which is what an offline algorithm
 * with no reordering would do — and says so rather than calling it OPT.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.OnlineDecisions = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* ------------------------------------------------------------ ski rental */

  /** Renting every day costs `days`; buying on day d costs (d − 1) + B. */
  function skiCost(strategy, days, buyPrice) {
    if (strategy.buyOn === null || strategy.buyOn > days) return days;
    return (strategy.buyOn - 1) + buyPrice;
  }

  /** The offline optimum knows the season length: rent it all, or buy at once. */
  function skiOptimum(days, buyPrice) {
    return Math.min(days, buyPrice);
  }

  /**
   * Rent until the total spent would reach the purchase price, then buy — that
   * is, buy at the start of day B. Its worst case is the season ending exactly
   * then, which costs (B − 1) + B against an optimum of B.
   */
  function breakEvenStrategy(buyPrice) {
    return { name: 'break-even', buyOn: buyPrice,
      note: 'rent until you have spent what buying costs' };
  }

  function alwaysBuy() {
    return { name: 'buy immediately', buyOn: 1, note: 'optimal for a long season, terrible for a short one' };
  }

  function alwaysRent() {
    return { name: 'never buy', buyOn: null, note: 'optimal for a short season, unbounded for a long one' };
  }

  /**
   * The randomised rule: buy on day i with probability proportional to
   * ((B − 1)/B)^(B − i). Its expected cost is within e/(e − 1) of the optimum
   * against an oblivious adversary, and the distribution is what makes the
   * bound hold at every season length rather than on average over lengths.
   */
  function randomisedStrategy(buyPrice, rng) {
    const weights = [];
    let total = 0;

    for (let i = 1; i <= buyPrice; i += 1) {
      const w = Math.pow((buyPrice - 1) / buyPrice, buyPrice - i);
      weights.push(w);
      total += w;
    }
    let draw = rng.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      draw -= weights[i];
      if (draw <= 0) return { name: 'randomised', buyOn: i + 1, weights: weights };
    }
    return { name: 'randomised', buyOn: buyPrice, weights: weights };
  }

  /**
   * The whole point of competitive analysis: sweep every season length and
   * report the WORST ratio, not the mean. A strategy is c-competitive when no
   * length pushes it past c, so the maximum is the measurement and the average
   * is a different (and much friendlier) number.
   */
  function skiSweep(options) {
    const settings = options || {};
    const buyPrice = settings.buyPrice === undefined ? 10 : settings.buyPrice;
    const horizon = settings.horizon === undefined ? buyPrice * 3 : settings.horizon;
    const strategies = settings.strategies ||
      [alwaysRent(), alwaysBuy(), breakEvenStrategy(buyPrice)];

    return { buyPrice: buyPrice, horizon: horizon,
      rows: strategies.map(function (strategy) {
        return sweepOne(strategy, buyPrice, horizon);
      }),
      bound: 2 - 1 / buyPrice };
  }

  function sweepOne(strategy, buyPrice, horizon) {
    const ratios = [];
    let worst = 0;
    let worstAt = 0;

    for (let days = 1; days <= horizon; days += 1) {
      const ratio = skiCost(strategy, days, buyPrice) / skiOptimum(days, buyPrice);
      ratios.push({ days: days, cost: skiCost(strategy, days, buyPrice),
        optimum: skiOptimum(days, buyPrice), ratio: ratio });
      if (ratio <= worst) continue;
      worst = ratio;
      worstAt = days;
    }
    return { strategy: strategy, ratios: ratios, worst: worst, worstAt: worstAt,
      mean: ratios.reduce(function (sum, r) { return sum + r.ratio; }, 0) / ratios.length };
  }

  /**
   * The randomised strategy under two adversaries. The oblivious one fixes the
   * season length first and the coin is drawn afterwards; the adaptive one
   * watches the draw and ends the season the day the buy happens. The gap
   * between the two columns is what "randomisation helps" actually means.
   */
  function randomisedStudy(options) {
    const settings = options || {};
    const buyPrice = settings.buyPrice === undefined ? 10 : settings.buyPrice;
    const trials = settings.trials === undefined ? 4000 : settings.trials;
    const oblivious = [];
    const adaptive = [];

    for (let days = 1; days <= buyPrice * 2; days += 1) {
      oblivious.push(obliviousRow(days, buyPrice, trials, settings.seed));
    }
    for (let t = 0; t < trials; t += 1) {
      const picked = randomisedStrategy(buyPrice, Random.seeded((settings.seed || 5) + t));
      adaptive.push(skiCost(picked, picked.buyOn, buyPrice) / skiOptimum(picked.buyOn, buyPrice));
    }
    return { buyPrice: buyPrice, trials: trials, oblivious: oblivious,
      obliviousWorst: Math.max.apply(null, oblivious.map(function (row) { return row.ratio; })),
      adaptiveMean: adaptive.reduce(function (a, b) { return a + b; }, 0) / adaptive.length,
      bound: Math.E / (Math.E - 1), deterministicBound: 2 - 1 / buyPrice };
  }

  function obliviousRow(days, buyPrice, trials, seed) {
    let total = 0;

    for (let t = 0; t < trials; t += 1) {
      const picked = randomisedStrategy(buyPrice, Random.seeded((seed || 5) + t));
      total += skiCost(picked, days, buyPrice);
    }
    const mean = total / trials;
    return { days: days, meanCost: mean, optimum: skiOptimum(days, buyPrice),
      ratio: mean / skiOptimum(days, buyPrice) };
  }

  /* ------------------------------------------------------------ list update */

  /**
   * The cost model is the one the literature uses: accessing the item at
   * position i costs i, and moving it towards the front afterwards is free.
   * Without the free-move rule every policy is dominated by doing nothing, and
   * the problem stops being about anything.
   */
  function listUpdate(order, requests, policy) {
    const list = order.slice();
    let cost = 0;
    let moves = 0;

    requests.forEach(function (key) {
      const at = list.indexOf(key);
      cost += at + 1;
      if (policy === 'move-to-front') {
        list.splice(at, 1);
        list.unshift(key);
        if (at > 0) moves += 1;
        return;
      }
      if (policy === 'transpose' && at > 0) {
        list[at] = list[at - 1];
        list[at - 1] = key;
        moves += 1;
      }
    });
    return { policy: policy, cost: cost, moves: moves, order: list };
  }

  /** Frequency count keeps the list sorted by how often each item was asked
   *  for — an online policy with a memory rather than a rule about position. */
  function frequencyCount(order, requests) {
    const counts = new Map();
    let list = order.slice();
    let cost = 0;

    order.forEach(function (key) { counts.set(key, 0); });
    requests.forEach(function (key) {
      cost += list.indexOf(key) + 1;
      counts.set(key, (counts.get(key) || 0) + 1);
      list = list.slice().sort(function (a, b) { return counts.get(b) - counts.get(a); });
    });
    return { policy: 'frequency-count', cost: cost, moves: requests.length, order: list };
  }

  /**
   * The best STATIC order — items sorted by request count — which is the
   * reference this module scores against. It is not the offline optimum:
   * optimal offline list update with free moves is NP-hard, and calling a
   * static bound OPT is the overclaim this note exists to prevent.
   */
  function bestStatic(order, requests) {
    const counts = new Map();

    order.forEach(function (key) { counts.set(key, 0); });
    requests.forEach(function (key) { counts.set(key, counts.get(key) + 1); });
    const sorted = order.slice().sort(function (a, b) { return counts.get(b) - counts.get(a); });
    let cost = 0;

    requests.forEach(function (key) { cost += sorted.indexOf(key) + 1; });
    return { policy: 'best static order', cost: cost, order: sorted, moves: 0 };
  }

  /**
   * The initial order is SHUFFLED by default, and that is not cosmetic. The
   * Zipf generator makes low indices hot, so an identity starting order is
   * already the frequency order — "do nothing" then scores 1.003 and
   * move-to-front looks like a disaster. Measured that way the demo teaches
   * the opposite of the truth, so the starting order is randomised and the
   * identity order is available as a control.
   */
  function listStudy(options) {
    const settings = options || {};
    const size = settings.size === undefined ? 20 : settings.size;
    const requests = settings.requests || zipfRequests(size, settings);
    const order = startingOrder(size, settings);
    const reference = bestStatic(order, requests);
    const rows = [
      listUpdate(order, requests, 'none'),
      listUpdate(order, requests, 'transpose'),
      listUpdate(order, requests, 'move-to-front'),
      frequencyCount(order, requests),
      reference
    ];
    return { size: size, requests: requests.length, reference: reference.cost,
      initialOrder: order.slice(),
      rows: rows.map(function (row) {
        return Object.assign({}, row, { ratio: row.cost / reference.cost });
      }) };
  }

  function startingOrder(size, settings) {
    const order = [];

    for (let i = 0; i < size; i += 1) order.push(i);
    if (settings.identityStart) return order;
    return Random.seeded(settings.orderSeed === undefined ? 17 : settings.orderSeed)
      .shuffle(order);
  }

  function zipfRequests(size, settings) {
    const rng = Random.seeded(settings.seed === undefined ? 3 : settings.seed);
    const count = settings.count === undefined ? 4000 : settings.count;
    const skew = settings.skew === undefined ? 2 : settings.skew;
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(Math.floor(Math.pow(rng.next(), skew) * size));
    return out;
  }

  /**
   * The sequence move-to-front is FOR: a small working set that shifts. On a
   * stationary Zipf trace transpose beats it, which is the honest result and
   * the reason both traces are in the demo — move-to-front pays one move per
   * access to buy adaptation, and adaptation is worth nothing when the
   * distribution never moves.
   */
  function burstyRequests(size, options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 4 : settings.seed);
    const count = settings.count === undefined ? 4000 : settings.count;
    const width = settings.width === undefined ? 3 : settings.width;
    const runLength = settings.runLength === undefined ? 40 : settings.runLength;
    const out = [];

    while (out.length < count) {
      const base = rng.int(Math.max(1, size - width));
      for (let i = 0; i < runLength && out.length < count; i += 1) {
        out.push(base + rng.int(width));
      }
    }
    return out;
  }

  /** The sequence that defeats move-to-front: walk the list backwards, so
   *  every request is at the end and every move puts the next one further. */
  function reverseSweep(size, rounds) {
    const out = [];

    for (let r = 0; r < rounds; r += 1) {
      for (let i = size - 1; i >= 0; i -= 1) out.push(i);
    }
    return out;
  }

  return {
    skiCost: skiCost, skiOptimum: skiOptimum,
    breakEvenStrategy: breakEvenStrategy, alwaysBuy: alwaysBuy, alwaysRent: alwaysRent,
    randomisedStrategy: randomisedStrategy, skiSweep: skiSweep, randomisedStudy: randomisedStudy,
    listUpdate: listUpdate, frequencyCount: frequencyCount, bestStatic: bestStatic,
    listStudy: listStudy, zipfRequests: zipfRequests, reverseSweep: reverseSweep,
    burstyRequests: burstyRequests, startingOrder: startingOrder
  };
}));
