/**
 * Graded exercises for the similarity, window and selection sections (M07.7-M07.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'minhash-and-lsh': [{
      id: 'minhash-and-banding',
      title: 'The signature, the estimate and the band keys',
      prompt: 'makeMinHash(length) must return { signature, estimate, bandKeys }. signature(tokens) ' +
        'returns a Uint32Array of `length` minima — position i holds the smallest value of the i-th ' +
        'hash over the set. estimate(a, b) is the fraction of positions where two signatures agree, ' +
        'which is an unbiased estimate of the Jaccard similarity. bandKeys(signature, bands, rows) ' +
        'returns one hash per band over that band\'s rows, so two documents are candidates when any ' +
        'band key matches.',
      entry: 'makeMinHash',
      starter: [
        'function makeMinHash(length) {',
        '  // provided: a seeded 32-bit string hash and a finaliser',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    const text = String(key);',
        '    for (let i = 0; i < text.length; i += 1) {',
        '      h ^= text.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  return {',
        '    signature: function (tokens) { return new Uint32Array(length); },',
        '    estimate: function (a, b) { return 1; },',
        '    bandKeys: function (signature, bands, rows) { return []; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeMinHash(length) {',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    const text = String(key);',
        '    for (let i = 0; i < text.length; i += 1) {',
        '      h ^= text.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return mix(h);',
        '  }',
        '',
        '  function mix(value) {',
        '    let h = value >>> 0;',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  return {',
        '    signature: function (tokens) {',
        '      const out = new Uint32Array(length).fill(0xffffffff);',
        '      tokens.forEach(function (token) {',
        '        const base = hash(token, 0x811c9dc5);',
        '        const step = (hash(token, 0x9e3779b9) | 1) >>> 0;',
        '        for (let i = 0; i < length; i += 1) {',
        '          const value = mix((base + Math.imul(i, step)) >>> 0);',
        '          if (value < out[i]) out[i] = value;',
        '        }',
        '      });',
        '      return out;',
        '    },',
        '    estimate: function (a, b) {',
        '      let same = 0;',
        '      for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) same += 1;',
        '      return same / a.length;',
        '    },',
        '    bandKeys: function (signature, bands, rows) {',
        '      const out = new Array(bands);',
        '      for (let band = 0; band < bands; band += 1) {',
        '        let key = 0x811c9dc5;',
        '        for (let row = 0; row < rows; row += 1) {',
        '          key = mix((key ^ signature[band * rows + row]) >>> 0);',
        '        }',
        '        out[band] = key >>> 0;',
        '      }',
        '      return out;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a set is perfectly similar to itself and to a reordering of itself',
          assert: function (makeMinHash, api) {
            const minhash = makeMinHash(128);
            const tokens = [];
            for (let i = 0; i < 200; i += 1) tokens.push('t' + i);

            const a = minhash.signature(tokens);
            const b = minhash.signature(tokens.slice().reverse());

            api.assert.equal(a.length, 128, 'the signature has one entry per hash');
            api.assert.equal(minhash.estimate(a, a), 1, 'a set is identical to itself');
            api.assert.equal(minhash.estimate(a, b), 1, 'a minimum does not depend on insertion order');
          }
        },
        {
          name: 'the estimate tracks the exact Jaccard similarity across the range',
          assert: function (makeMinHash, api) {
            const minhash = makeMinHash(128);

            [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (target) {
              const size = 400;
              const shared = Math.round(size * 2 * target / (1 + target));
              const left = [];
              const right = [];
              for (let i = 0; i < size; i += 1) left.push('t' + i);
              for (let i = 0; i < size; i += 1) right.push('t' + (i + size - shared));

              const leftSet = new Set(left);
              let intersection = 0;
              right.forEach(function (token) { if (leftSet.has(token)) intersection += 1; });
              const exact = intersection / (left.length + right.length - intersection);

              const estimate = minhash.estimate(minhash.signature(left), minhash.signature(right));
              api.assert.ok(Math.abs(estimate - exact) <= 0.14,
                'exact ' + exact.toFixed(3) + ', estimated ' + estimate.toFixed(3) +
                ' — three standard errors is 0.13 at L = 128');
            });
          }
        },
        {
          name: 'band keys partition the signature and match only on identical bands',
          assert: function (makeMinHash, api) {
            const minhash = makeMinHash(128);
            const tokens = [];
            for (let i = 0; i < 300; i += 1) tokens.push('t' + i);

            const signature = minhash.signature(tokens);
            const keys = minhash.bandKeys(signature, 16, 8);
            api.assert.equal(keys.length, 16, 'one key per band');

            const same = minhash.bandKeys(signature, 16, 8);
            for (let i = 0; i < 16; i += 1) {
              api.assert.equal(keys[i], same[i], 'band ' + i + ' must be a pure function of its rows');
            }

            const changed = signature.slice();
            changed[3] = (changed[3] ^ 0xffff) >>> 0;
            const after = minhash.bandKeys(changed, 16, 8);
            api.assert.notEqual(after[0], keys[0], 'changing row 3 must change band 0');
            api.assert.equal(after[1], keys[1], 'changing row 3 must not change band 1');
          }
        },
        {
          name: 'the S-curve is what the banding actually produces',
          assert: function (makeMinHash, api) {
            const minhash = makeMinHash(128);
            const bands = 16;
            const rows = 8;

            function collides(target) {
              let hits = 0;
              for (let trial = 0; trial < 60; trial += 1) {
                const size = 300;
                const shared = Math.round(size * 2 * target / (1 + target));
                const left = [];
                const right = [];
                for (let i = 0; i < size; i += 1) left.push('r' + trial + '-t' + i);
                for (let i = 0; i < size; i += 1) right.push('r' + trial + '-t' + (i + size - shared));

                const a = minhash.bandKeys(minhash.signature(left), bands, rows);
                const b = minhash.bandKeys(minhash.signature(right), bands, rows);
                if (a.some(function (key, index) { return key === b[index]; })) hits += 1;
              }
              return hits / 60;
            }

            const low = collides(0.4);
            const high = collides(0.9);
            api.assert.ok(low < 0.25, 'at similarity 0.4 the curve predicts 0.02; measured ' + low.toFixed(3));
            api.assert.ok(high > 0.75, 'at similarity 0.9 the curve predicts 0.998; measured ' + high.toFixed(3));
          }
        }
      ]
    }],

    'windowed-counting': [{
      id: 'space-saving-top-k',
      title: 'Space-saving, and the counter-replacement rule',
      prompt: 'makeSpaceSaving(counters) must return { add, estimate, errorOf, top, minimum, size }. ' +
        'A monitored key is incremented. An unmonitored key, once the table is full, takes over the ' +
        'entry with the *smallest* count: its new count is that minimum plus one and its recorded ' +
        'error is that minimum. That rule is what makes every count an upper bound with readable ' +
        'slack, and what guarantees that any key occurring more than N/m times is still in the table.',
      entry: 'makeSpaceSaving',
      starter: [
        'function makeSpaceSaving(counters) {',
        '  const entries = new Map();',
        '  let total = 0;',
        '',
        '  return {',
        '    add: function (key) {',
        '      total += 1;',
        '      if (entries.has(key)) entries.get(key).count += 1;',
        '      else if (entries.size < counters) entries.set(key, { count: 1, error: 0 });',
        '    },',
        '    estimate: function (key) { return entries.has(key) ? entries.get(key).count : 0; },',
        '    errorOf: function (key) { return entries.has(key) ? entries.get(key).error : 0; },',
        '    minimum: function () { return 0; },',
        '    size: function () { return entries.size; },',
        '    top: function (k) { return []; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeSpaceSaving(counters) {',
        '  const entries = new Map();',
        '  let total = 0;',
        '',
        '  function smallest() {',
        '    let victim = null;',
        '    entries.forEach(function (entry, key) {',
        '      if (!victim || entry.count < victim.entry.count) victim = { key: key, entry: entry };',
        '    });',
        '    return victim;',
        '  }',
        '',
        '  return {',
        '    add: function (key) {',
        '      total += 1;',
        '      const existing = entries.get(key);',
        '      if (existing) { existing.count += 1; return existing; }',
        '',
        '      if (entries.size < counters) {',
        '        const fresh = { count: 1, error: 0 };',
        '        entries.set(key, fresh);',
        '        return fresh;',
        '      }',
        '',
        '      const victim = smallest();',
        '      entries.delete(victim.key);',
        '      const taken = { count: victim.entry.count + 1, error: victim.entry.count };',
        '      entries.set(key, taken);',
        '      return taken;',
        '    },',
        '    estimate: function (key) { return entries.has(key) ? entries.get(key).count : 0; },',
        '    errorOf: function (key) { return entries.has(key) ? entries.get(key).error : 0; },',
        '    minimum: function () {',
        '      const victim = smallest();',
        '      return victim ? victim.entry.count : 0;',
        '    },',
        '    size: function () { return entries.size; },',
        '    total: function () { return total; },',
        '    top: function (k) {',
        '      const out = [];',
        '      entries.forEach(function (entry, key) {',
        '        out.push({ key: key, count: entry.count, error: entry.error });',
        '      });',
        '      out.sort(function (a, b) { return b.count - a.count; });',
        '      return out.slice(0, k === undefined ? out.length : k);',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a replacement inherits the minimum rather than starting at one',
          assert: function (makeSpaceSaving, api) {
            const sketch = makeSpaceSaving(3);
            for (let i = 0; i < 10; i += 1) sketch.add('a');
            for (let i = 0; i < 5; i += 1) sketch.add('b');
            for (let i = 0; i < 4; i += 1) sketch.add('c');

            api.assert.equal(sketch.size(), 3, 'the table holds exactly its capacity');
            api.assert.equal(sketch.minimum(), 4, 'the smallest counter is c at 4');

            sketch.add('d');
            api.assert.equal(sketch.estimate('d'), 5, 'd takes over the minimum of 4 and becomes 5');
            api.assert.equal(sketch.errorOf('d'), 4, 'the inherited part is recorded as the error');
            api.assert.equal(sketch.estimate('c'), 0, 'c was evicted');
          }
        },
        {
          name: 'count minus error brackets the truth for every monitored key',
          assert: function (makeSpaceSaving, api) {
            const sketch = makeSpaceSaving(120);
            const truth = new Map();

            for (let i = 0; i < 120000; i += 1) {
              const key = i % 5 === 0 ? 'hot-' + (i % 35) : 'cold-' + ((i * 7919) % 20011);
              sketch.add(key);
              truth.set(key, (truth.get(key) || 0) + 1);
            }

            sketch.top().forEach(function (row) {
              const actual = truth.get(row.key) || 0;
              api.assert.ok(row.count >= actual,
                row.key + ': reported ' + row.count + ' below a true count of ' + actual);
              api.assert.ok(row.count - row.error <= actual,
                row.key + ': the lower bound ' + (row.count - row.error) +
                ' is above the true count ' + actual);
            });
          }
        },
        {
          name: 'every key above N/m occurrences is still monitored',
          assert: function (makeSpaceSaving, api) {
            const counters = 120;
            const sketch = makeSpaceSaving(counters);
            const truth = new Map();
            const total = 120000;

            for (let i = 0; i < total; i += 1) {
              const key = i % 5 === 0 ? 'hot-' + (i % 35) : 'cold-' + ((i * 7919) % 20011);
              sketch.add(key);
              truth.set(key, (truth.get(key) || 0) + 1);
            }

            const guaranteed = total / counters;
            const monitored = new Set(sketch.top().map(function (row) { return row.key; }));

            truth.forEach(function (count, key) {
              if (count <= guaranteed) return;
              api.assert.ok(monitored.has(key),
                key + ' occurs ' + count + ' times, above the guaranteed threshold of ' +
                guaranteed.toFixed(1) + ', and is not in the table');
            });
          }
        },
        {
          name: 'top(k) returns the k largest counters, in order',
          assert: function (makeSpaceSaving, api) {
            const sketch = makeSpaceSaving(50);
            for (let round = 0; round < 40; round += 1) {
              for (let i = 0; i < 30; i += 1) {
                for (let j = 0; j <= i; j += 1) sketch.add('k' + i);
              }
            }

            const top = sketch.top(5);
            api.assert.equal(top.length, 5, 'exactly five rows');
            for (let i = 1; i < top.length; i += 1) {
              api.assert.ok(top[i - 1].count >= top[i].count, 'rows must be sorted descending');
            }
            api.assert.equal(top[0].key, 'k29', 'k29 was added most often');
          }
        }
      ]
    }],

    'choosing-sketches': [{
      id: 'size-a-plan-to-a-budget',
      title: 'Sizing three sketches to one memory budget',
      prompt: 'makePlan(options) takes { budgetBytes, keys, maxFpr } and must return ' +
        '{ feasible, bloom, hll, countMin }. Split the budget into three equal parts. The Bloom ' +
        'filter gets m = ⌊third × 8⌋ bits for `keys` keys, with k = max(1, round((m/keys)·ln 2)) and ' +
        'the achieved rate (1 − e^(−k·keys/m))^k. The HyperLogLog gets the largest precision p in ' +
        '[4, 18] whose packed size ⌈2^p × 6 / 8⌉ fits. The count-min sketch fixes depth at 5 and takes ' +
        'the largest width whose 8-byte cells fit, reporting ε = e/width. `feasible` is false when ' +
        'the Bloom filter cannot reach maxFpr, and the plan is still returned so the caller can see ' +
        'how far short it fell.',
      entry: 'makePlan',
      starter: [
        'function makePlan(options) {',
        '  const third = Math.floor(options.budgetBytes / 3);',
        '',
        '  return {',
        '    feasible: true,',
        '    bloom: { m: 0, k: 0, bytes: 0, fpr: 0 },',
        '    hll: { precision: 4, bytes: 0, sigma: 0 },',
        '    countMin: { width: 0, depth: 5, bytes: 0, epsilon: 0 }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makePlan(options) {',
        '  const third = Math.floor(options.budgetBytes / 3);',
        '  const keys = options.keys;',
        '',
        '  const m = Math.floor(third * 8);',
        '  const k = Math.max(1, Math.round((m / keys) * Math.LN2));',
        '  const fpr = Math.pow(1 - Math.exp(-k * keys / m), k);',
        '',
        '  let precision = 4;',
        '  for (let p = 4; p <= 18; p += 1) {',
        '    if (Math.ceil(Math.pow(2, p) * 6 / 8) <= third) precision = p;',
        '  }',
        '',
        '  const depth = 5;',
        '  const width = Math.max(1, Math.floor(third / (8 * depth)));',
        '',
        '  return {',
        '    feasible: fpr <= options.maxFpr,',
        '    bloom: { m: m, k: k, bytes: Math.ceil(m / 8), fpr: fpr },',
        '    hll: {',
        '      precision: precision,',
        '      bytes: Math.ceil(Math.pow(2, precision) * 6 / 8),',
        '      sigma: 1.04 / Math.sqrt(Math.pow(2, precision))',
        '    },',
        '    countMin: {',
        '      width: width,',
        '      depth: depth,',
        '      bytes: width * depth * 8,',
        '      epsilon: Math.E / width',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every component fits its third, and the plan fits the budget',
          assert: function (makePlan, api) {
            [65536, 262144, 1048576].forEach(function (budget) {
              const plan = makePlan({ budgetBytes: budget, keys: 20000, maxFpr: 0.05 });
              const third = Math.floor(budget / 3);

              api.assert.ok(plan.bloom.bytes <= third, 'bloom ' + plan.bloom.bytes + ' > third ' + third);
              api.assert.ok(plan.hll.bytes <= third, 'hll ' + plan.hll.bytes + ' > third ' + third);
              api.assert.ok(plan.countMin.bytes <= third, 'count-min ' + plan.countMin.bytes + ' > third ' + third);
              api.assert.ok(plan.bloom.bytes + plan.hll.bytes + plan.countMin.bytes <= budget,
                'the whole plan must fit ' + budget);
            });
          }
        },
        {
          name: 'each component is the largest that fits',
          assert: function (makePlan, api) {
            const budget = 262144;
            const plan = makePlan({ budgetBytes: budget, keys: 20000, maxFpr: 0.05 });
            const third = Math.floor(budget / 3);

            api.assert.ok(Math.ceil(Math.pow(2, plan.hll.precision + 1) * 6 / 8) > third,
              'precision ' + plan.hll.precision + ' is not maximal — the next one also fits');
            api.assert.ok((plan.countMin.width + 1) * plan.countMin.depth * 8 > third,
              'width ' + plan.countMin.width + ' is not maximal');
            api.assert.equal(plan.countMin.depth, 5, 'depth is fixed at 5');
          }
        },
        {
          name: 'the derived accuracy figures follow from the parameters',
          assert: function (makePlan, api) {
            const plan = makePlan({ budgetBytes: 262144, keys: 20000, maxFpr: 0.05 });

            const expectedK = Math.max(1, Math.round((plan.bloom.m / 20000) * Math.LN2));
            api.assert.equal(plan.bloom.k, expectedK, 'k must come from (m/n) ln 2');

            const expectedFpr = Math.pow(1 - Math.exp(-plan.bloom.k * 20000 / plan.bloom.m), plan.bloom.k);
            api.assert.ok(Math.abs(plan.bloom.fpr - expectedFpr) < 1e-12, 'the achieved rate must use the rounded k');

            const expectedSigma = 1.04 / Math.sqrt(Math.pow(2, plan.hll.precision));
            api.assert.ok(Math.abs(plan.hll.sigma - expectedSigma) < 1e-12, 'sigma is 1.04/sqrt(m)');

            api.assert.ok(Math.abs(plan.countMin.epsilon - Math.E / plan.countMin.width) < 1e-12,
              'epsilon is e/width');
          }
        },
        {
          name: 'an impossible budget is reported as infeasible, not silently accepted',
          assert: function (makePlan, api) {
            const tight = makePlan({ budgetBytes: 4096, keys: 200000, maxFpr: 0.01 });
            api.assert.equal(tight.feasible, false,
              '4 KB cannot hold a 1% filter over 200 000 keys — it needs about 240 KB');
            api.assert.ok(tight.bloom.fpr > 0.01, 'the plan must still say how far short it fell');

            const roomy = makePlan({ budgetBytes: 1048576, keys: 20000, maxFpr: 0.01 });
            api.assert.equal(roomy.feasible, true, '1 MB is ample for 20 000 keys at 1%');
            api.assert.ok(roomy.bloom.fpr < 0.01, 'and the achieved rate must beat the target');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
