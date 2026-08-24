/**
 * Graded exercises for competitive analysis, caching and scheduling (M21.1-M21.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'competitive-analysis': [{
      id: 'randomised-ski-rental',
      title: 'The randomised ski-rental strategy, and the adversary it beats',
      prompt: 'skiRental(buyPrice, rng) must return the day to buy, drawn from the distribution ' +
        'that gives an e/(e − 1) competitive ratio against an oblivious adversary. Buy on day i ' +
        '(from 1 to B) with probability proportional to ((B − 1)/B)^(B − i), so later days are ' +
        'more likely. Return an integer between 1 and buyPrice inclusive. Renting costs 1 a day ' +
        'and buying on day d over a season of `days` costs (d − 1) + B when d ≤ days, and `days` ' +
        'otherwise; the offline optimum is min(days, B). The tests fix each season length first ' +
        'and then draw, which is what "oblivious" means, and they check the expected ratio at ' +
        'every length against the deterministic bound of 2 − 1/B. The starter always buys on day ' +
        'B, which is the deterministic break-even rule.',
      entry: 'skiRental',
      starter: [
        'function skiRental(buyPrice, rng) {',
        '  // The deterministic break-even rule: exactly (2 - 1/B)-competitive, and the',
        '  // randomised distribution is meant to beat it.',
        '  return buyPrice;',
        '}'
      ].join('\n'),
      solution: [
        'function skiRental(buyPrice, rng) {',
        '  const weights = [];',
        '  let total = 0;',
        '',
        '  for (let i = 1; i <= buyPrice; i += 1) {',
        '    const w = Math.pow((buyPrice - 1) / buyPrice, buyPrice - i);',
        '    weights.push(w);',
        '    total += w;',
        '  }',
        '  let draw = rng.next() * total;',
        '  for (let i = 0; i < weights.length; i += 1) {',
        '    draw -= weights[i];',
        '    if (draw <= 0) return i + 1;',
        '  }',
        '  return buyPrice;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it always returns a day between 1 and the purchase price',
          assert: function (skiRental, api) {
            [2, 5, 10, 30].forEach(function (buyPrice) {
              for (let t = 0; t < 200; t += 1) {
                const day = skiRental(buyPrice, api.Random.seeded(t * 7 + 1));
                api.assert.equal(Number.isInteger(day), true,
                  'B=' + buyPrice + ': the buy day must be an integer, got ' + day);
                api.assert.atLeast(day, 1, 'B=' + buyPrice + ': the buy day must be at least 1');
                api.assert.atMost(day, buyPrice,
                  'B=' + buyPrice + ': buying after day B is never right');
              }
            });
          }
        },
        {
          name: 'the expected ratio beats the deterministic bound at every season length',
          assert: function (skiRental, api) {
            const buyPrice = 10;
            const trials = 3000;
            let worst = 0;

            for (let days = 1; days <= buyPrice * 2; days += 1) {
              let total = 0;
              for (let t = 0; t < trials; t += 1) {
                const day = skiRental(buyPrice, api.Random.seeded(t * 13 + 5));
                total += day > days ? days : (day - 1) + buyPrice;
              }
              const optimum = Math.min(days, buyPrice);
              worst = Math.max(worst, (total / trials) / optimum);
            }
            api.assert.atMost(worst, 2 - 1 / buyPrice,
              'the expected ratio must beat the deterministic bound of ' + (2 - 1 / buyPrice) +
                '; the worst season gave ' + worst);
            api.assert.atMost(worst, Math.E / (Math.E - 1) + 0.02,
              'and it must be inside e/(e-1) = 1.5820; got ' + worst);
          }
        },
        {
          name: 'it really is random, and it favours the later days',
          assert: function (skiRental, api) {
            const buyPrice = 10;
            const counts = new Array(buyPrice + 1).fill(0);

            for (let t = 0; t < 4000; t += 1) {
              counts[skiRental(buyPrice, api.Random.seeded(t * 17 + 3))] += 1;
            }
            const distinct = counts.filter(function (c) { return c > 0; }).length;
            api.assert.atLeast(distinct, 5,
              'a deterministic strategy uses one day; this used ' + distinct);
            api.assert.atLeast(counts[buyPrice], counts[1],
              'day B must be at least as likely as day 1: ' + counts[buyPrice] + ' against ' +
                counts[1]);
          }
        },
        {
          name: 'an adaptive adversary that ends the season on the buy day does better than 2',
          assert: function (skiRental, api) {
            const buyPrice = 10;
            let total = 0;
            const trials = 2000;

            for (let t = 0; t < trials; t += 1) {
              const day = skiRental(buyPrice, api.Random.seeded(t * 23 + 9));
              const cost = (day - 1) + buyPrice;
              total += cost / Math.min(day, buyPrice);
            }
            api.assert.atLeast(total / trials, 2 - 1 / buyPrice,
              'against an adversary that watches the coin, the randomised strategy must NOT ' +
                'beat the deterministic bound; got ' + (total / trials));
          }
        }
      ]
    }],

    'page-replacement': [{
      id: 'clock-and-admission',
      title: 'CLOCK, and an admission filter that survives a scan',
      prompt: 'buildCache(kind, capacity) must return { get(key), stats() } for two policies. ' +
        '"clock" is second-chance: keep one reference bit per slot and a hand; on a hit set the ' +
        'bit, and on a miss advance the hand past set bits (clearing them) and take the first ' +
        'slot whose bit is clear. "admitting" is CLOCK with a frequency filter in front: keep a ' +
        'count per key seen (a plain map is fine), and when the cache is full admit the incoming ' +
        'key ONLY if its count is strictly greater than the count of the slot the hand would ' +
        'evict — otherwise leave the cache alone. `stats()` returns { hits, misses, accesses, ' +
        'hitRate }. The starter returns a cache that admits everything and evicts the oldest ' +
        'arrival, which is FIFO and is not scan resistant.',
      entry: 'buildCache',
      starter: [
        'function buildCache(kind, capacity) {',
        '  const resident = new Set();',
        '  const order = [];',
        '  const counters = { hits: 0, misses: 0, accesses: 0 };',
        '',
        '  return {',
        '    get: function (key) {',
        '      counters.accesses += 1;',
        '      if (resident.has(key)) { counters.hits += 1; return true; }',
        '      counters.misses += 1;',
        '      resident.add(key);',
        '      order.push(key);',
        '      if (resident.size > capacity) resident.delete(order.shift());',
        '      return false;',
        '    },',
        '    stats: function () {',
        '      return { hits: counters.hits, misses: counters.misses,',
        '        accesses: counters.accesses,',
        '        hitRate: counters.accesses ? counters.hits / counters.accesses : 0 };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function buildCache(kind, capacity) {',
        '  const slots = new Array(capacity).fill(null);',
        '  const referenced = new Array(capacity).fill(false);',
        '  const where = new Map();',
        '  const counts = new Map();',
        '  const counters = { hits: 0, misses: 0, accesses: 0 };',
        '  let hand = 0;',
        '',
        '  function victimSlot() {',
        '    while (true) {',
        '      const at = hand;',
        '      hand = (hand + 1) % capacity;',
        '      if (slots[at] === null) return at;',
        '      if (referenced[at]) { referenced[at] = false; continue; }',
        '      return at;',
        '    }',
        '  }',
        '',
        '  function peekVictim() {',
        '    for (let step = 0; step < capacity * 2; step += 1) {',
        '      const at = (hand + step) % capacity;',
        '      if (slots[at] === null) return at;',
        '      if (!referenced[at]) return at;',
        '    }',
        '    return hand;',
        '  }',
        '',
        '  return {',
        '    get: function (key) {',
        '      counters.accesses += 1;',
        '      counts.set(key, (counts.get(key) || 0) + 1);',
        '      if (where.has(key)) {',
        '        referenced[where.get(key)] = true;',
        '        counters.hits += 1;',
        '        return true;',
        '      }',
        '      counters.misses += 1;',
        '      if (kind === "admitting" && where.size >= capacity) {',
        '        const candidate = peekVictim();',
        '        const sitting = slots[candidate];',
        '        if (sitting !== null && (counts.get(key) || 0) <= (counts.get(sitting) || 0)) {',
        '          return false;',
        '        }',
        '      }',
        '      const at = victimSlot();',
        '      if (slots[at] !== null) where.delete(slots[at]);',
        '      slots[at] = key;',
        '      referenced[at] = false;',
        '      where.set(key, at);',
        '      return false;',
        '    },',
        '    stats: function () {',
        '      return { hits: counters.hits, misses: counters.misses,',
        '        accesses: counters.accesses,',
        '        hitRate: counters.accesses ? counters.hits / counters.accesses : 0 };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'both caches never hold more than their capacity, and the counters add up',
          assert: function (buildCache, api) {
            ['clock', 'admitting'].forEach(function (kind) {
              const cache = buildCache(kind, 8);
              const rng = api.Random.seeded(3);
              for (let i = 0; i < 2000; i += 1) cache.get(rng.int(40));
              const stats = cache.stats();
              api.assert.equal(stats.accesses, 2000, kind + ': every access must be counted');
              api.assert.equal(stats.hits + stats.misses, 2000,
                kind + ': hits plus misses must equal accesses');
              api.assert.closeTo(stats.hitRate, stats.hits / 2000, 1e-9,
                kind + ': the hit rate must match the counts');
            });
          }
        },
        {
          name: 'CLOCK gives a second chance: a re-touched entry survives one sweep',
          assert: function (buildCache, api) {
            const cache = buildCache('clock', 4);
            [0, 1, 2, 3].forEach(function (k) { cache.get(k); });
            cache.get(0);                       /* sets the reference bit on 0 */
            [4, 5, 6].forEach(function (k) { cache.get(k); });
            api.assert.equal(cache.get(0), true,
              'key 0 was referenced again, so the hand must have skipped it once');
          }
        },
        {
          name: 'the admission filter keeps a hot set through a scan, and plain CLOCK does not',
          assert: function (buildCache, api) {
            function trace() {
              const rng = api.Random.seeded(11);
              const out = [];
              let cold = 100000;
              for (let round = 0; round < 30; round += 1) {
                for (let k = 0; k < 200; k += 1) out.push(rng.int(20));
                for (let s = 0; s < 300; s += 1) out.push(cold + s);
                cold += 300;
              }
              return out;
            }
            const requests = trace();
            const plain = buildCache('clock', 30);
            const filtered = buildCache('admitting', 30);
            requests.forEach(function (key) { plain.get(key); filtered.get(key); });

            const a = plain.stats().hitRate;
            const b = filtered.stats().hitRate;
            api.assert.atLeast(b, a * 1.05,
              'admission control must beat plain CLOCK on a scan-heavy trace: ' +
                b.toFixed(4) + ' against ' + a.toFixed(4));
          }
        },
        {
          name: 'and it is not worse on a trace with no scan in it',
          assert: function (buildCache, api) {
            const rng = api.Random.seeded(29);
            const requests = [];
            for (let i = 0; i < 8000; i += 1) {
              requests.push(Math.floor(Math.pow(rng.next(), 3) * 200));
            }
            const plain = buildCache('clock', 40);
            const filtered = buildCache('admitting', 40);
            requests.forEach(function (key) { plain.get(key); filtered.get(key); });

            const a = plain.stats().hitRate;
            const b = filtered.stats().hitRate;
            api.assert.atLeast(b, a * 0.9,
              'admission control must not cost much on a Zipf trace: ' + b.toFixed(4) +
                ' against ' + a.toFixed(4));
          }
        }
      ]
    }],

    'online-scheduling': [{
      id: 'power-of-two-choices',
      title: 'The power of two choices, and the maximum load it leaves',
      prompt: 'assign(bins, balls, choices, rng) must place `balls` items into `bins` bins by ' +
        'sampling `choices` bins uniformly at random for each item and putting it in the least ' +
        'loaded of them, breaking ties towards the first sample. Return { loads, max, mean, ' +
        'overMean } where `loads` is the per-bin count, `max` is the busiest bin, `mean` is ' +
        'balls/bins and `overMean` is max − mean. The tests check the assignment is valid, that ' +
        'two choices leaves a much smaller maximum than one, and that the advantage GROWS with ' +
        'the number of bins — which is what separates an exponential improvement from a constant ' +
        'factor. The starter samples once whatever it is asked for.',
      entry: 'assign',
      starter: [
        'function assign(bins, balls, choices, rng) {',
        '  // One sample whatever `choices` says: the baseline, with a maximum load that',
        '  // keeps growing with the bin count.',
        '  const loads = new Array(bins).fill(0);',
        '  for (let i = 0; i < balls; i += 1) loads[rng.int(bins)] += 1;',
        '  const max = Math.max.apply(null, loads);',
        '  return { loads: loads, max: max, mean: balls / bins, overMean: max - balls / bins };',
        '}'
      ].join('\n'),
      solution: [
        'function assign(bins, balls, choices, rng) {',
        '  const loads = new Array(bins).fill(0);',
        '',
        '  for (let i = 0; i < balls; i += 1) {',
        '    let best = rng.int(bins);',
        '    for (let c = 1; c < choices; c += 1) {',
        '      const other = rng.int(bins);',
        '      if (loads[other] < loads[best]) best = other;',
        '    }',
        '    loads[best] += 1;',
        '  }',
        '  const max = Math.max.apply(null, loads);',
        '  return { loads: loads, max: max, mean: balls / bins, overMean: max - balls / bins };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every ball is placed and nothing is invented',
          assert: function (assign, api) {
            [1, 2, 3].forEach(function (choices) {
              const got = assign(500, 800, choices, api.Random.seeded(choices + 1));
              api.assert.equal(got.loads.length, 500, 'one entry per bin');
              const total = got.loads.reduce(function (a, b) { return a + b; }, 0);
              api.assert.equal(total, 800, 'every ball must land somewhere, exactly once');
              api.assert.equal(got.max, Math.max.apply(null, got.loads),
                'the reported maximum must be the maximum');
              api.assert.closeTo(got.mean, 800 / 500, 1e-9, 'the mean is balls over bins');
            });
          }
        },
        {
          name: 'two choices leaves a much lower maximum than one',
          assert: function (assign, api) {
            const trials = 8;
            let one = 0;
            let two = 0;

            for (let t = 0; t < trials; t += 1) {
              one += assign(4000, 4000, 1, api.Random.seeded(t * 101 + 1)).max;
              two += assign(4000, 4000, 2, api.Random.seeded(t * 101 + 1)).max;
            }
            api.assert.atMost(two / trials, (one / trials) * 0.7,
              'two choices must be well below one: ' + (two / trials).toFixed(2) +
                ' against ' + (one / trials).toFixed(2));
            api.assert.atLeast(two / trials, 2,
              'and it must still be above the mean of 1: ' + (two / trials).toFixed(2));
          }
        },
        {
          name: 'the advantage grows with the number of bins',
          assert: function (assign, api) {
            function averageMax(n, choices) {
              let total = 0;
              for (let t = 0; t < 6; t += 1) {
                total += assign(n, n, choices, api.Random.seeded(t * 211 + 7)).max;
              }
              return total / 6;
            }
            const small = averageMax(200, 1) / averageMax(200, 2);
            const large = averageMax(12800, 1) / averageMax(12800, 2);

            api.assert.atLeast(large, small,
              'the ratio between one and two choices must grow with n: ' + small.toFixed(2) +
                ' at 200 bins against ' + large.toFixed(2) + ' at 12 800');
            api.assert.atLeast(large, 1.8,
              'and it must be substantial at the larger size: ' + large.toFixed(2));
          }
        },
        {
          name: 'the choice really is the less loaded of the samples',
          assert: function (assign, api) {
            /* Two bins and many balls: taking the lighter of two samples must
               keep them within one of each other, and one sample cannot. */
            const paired = assign(2, 2000, 2, api.Random.seeded(5));
            api.assert.atMost(paired.max - Math.min.apply(null, paired.loads), 1,
              'with two bins and two samples the loads must stay within one: ' +
                paired.loads.join(', '));
            const single = assign(2, 2000, 1, api.Random.seeded(5));
            api.assert.atLeast(single.max - Math.min.apply(null, single.loads), 2,
              'with one sample they must not: ' + single.loads.join(', '));
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
