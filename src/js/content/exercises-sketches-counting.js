/**
 * Graded exercises for the counting and quantile sections (M07.4-M07.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    hyperloglog: [{
      id: 'hll-registers-and-estimate',
      title: 'Register update and the harmonic-mean estimator',
      prompt: 'makeHll(precision) must return { add, estimate, registers, rank }. rank(value, bits) ' +
        'is one plus the number of leading zeros in the low `bits` bits of value. add(key) takes the ' +
        'first `precision` bits of the hash as the register index and the rest as the rank, and ' +
        'raises that register only if the new rank is larger. estimate() is α_m·m²/Σ2^−M[j], with ' +
        'linear counting — m·ln(m/zeros) — substituted whenever a register is still zero and the raw ' +
        'estimate is at most 2.5m.',
      entry: 'makeHll',
      starter: [
        'function makeHll(precision) {',
        '  // provided: a 32-bit string hash',
        '  function hash(key) {',
        '    let h = 0x811c9dc5;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const m = Math.pow(2, precision);',
        '  const alpha = 0.7213 / (1 + 1.079 / m);',
        '  const registers = new Uint8Array(m);',
        '',
        '  return {',
        '    rank: function (value, bits) { return 1; },',
        '    add: function (key) {},',
        '    registers: function () { return registers; },',
        '    estimate: function () { return 0; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeHll(precision) {',
        '  function hash(key) {',
        '    let h = 0x811c9dc5;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    h ^= h >>> 16;',
        '    h = Math.imul(h, 0x85ebca6b) >>> 0;',
        '    h ^= h >>> 13;',
        '    h = Math.imul(h, 0xc2b2ae35) >>> 0;',
        '    h ^= h >>> 16;',
        '    return h >>> 0;',
        '  }',
        '',
        '  const m = Math.pow(2, precision);',
        '  const alpha = 0.7213 / (1 + 1.079 / m);',
        '  const registers = new Uint8Array(m);',
        '  const valueBits = 32 - precision;',
        '',
        '  function rank(value, bits) {',
        '    let out = 1;',
        '    let mask = 1 << (bits - 1);',
        '    while (mask && (value & mask) === 0) {',
        '      out += 1;',
        '      mask >>>= 1;',
        '    }',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    rank: rank,',
        '    registers: function () { return registers; },',
        '    add: function (key) {',
        '      const h = hash(key);',
        '      const index = h >>> valueBits;',
        '      const rest = (h << precision) >>> precision;',
        '      const r = rank(rest, valueBits);',
        '      if (r > registers[index]) registers[index] = r;',
        '    },',
        '    estimate: function () {',
        '      let sum = 0;',
        '      let zeros = 0;',
        '      for (let i = 0; i < m; i += 1) {',
        '        sum += Math.pow(2, -registers[i]);',
        '        if (registers[i] === 0) zeros += 1;',
        '      }',
        '      const raw = alpha * m * m / sum;',
        '      if (zeros > 0 && raw <= 2.5 * m) return m * Math.log(m / zeros);',
        '      return raw;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'rank counts leading zeros within the given width',
          assert: function (makeHll, api) {
            const hll = makeHll(10);
            api.assert.equal(hll.rank(128, 8), 1, 'the top bit is set, so rank is 1');
            api.assert.equal(hll.rank(64, 8), 2, 'one leading zero');
            api.assert.equal(hll.rank(1, 8), 8, 'seven leading zeros');
            api.assert.equal(hll.rank(0, 8), 9, 'all eight bits clear');
            api.assert.equal(hll.rank(3, 4), 3, 'within a four-bit window');
          }
        },
        {
          name: 'a register only ever rises, and duplicates change nothing',
          assert: function (makeHll, api) {
            const hll = makeHll(8);
            for (let i = 0; i < 2000; i += 1) hll.add('key-' + i);

            const before = Array.prototype.slice.call(hll.registers());
            for (let round = 0; round < 3; round += 1) {
              for (let i = 0; i < 2000; i += 1) hll.add('key-' + i);
            }
            const after = hll.registers();

            for (let i = 0; i < before.length; i += 1) {
              api.assert.equal(after[i], before[i],
                'register ' + i + ' moved when the same keys were re-added');
            }
          }
        },
        {
          name: 'the estimate is within 3 standard errors at three cardinalities',
          assert: function (makeHll, api) {
            const precision = 10;
            const sigma = 1.04 / Math.sqrt(Math.pow(2, precision));

            [1000, 10000, 60000].forEach(function (n) {
              const hll = makeHll(precision);
              for (let i = 0; i < n; i += 1) hll.add('u' + n + '-' + i);
              const estimate = hll.estimate();
              const error = Math.abs(estimate - n) / n;
              api.assert.ok(error <= 3 * sigma,
                'n = ' + n + ': estimate ' + Math.round(estimate) + ' is ' +
                (error / sigma).toFixed(2) + ' sigma out, and 3 is the limit');
            });
          }
        },
        {
          name: 'small cardinalities need the linear-counting correction',
          assert: function (makeHll, api) {
            const hll = makeHll(12);
            for (let i = 0; i < 200; i += 1) hll.add('small-' + i);

            const estimate = hll.estimate();
            api.assert.ok(Math.abs(estimate - 200) < 20,
              'at 200 distinct keys the estimate was ' + Math.round(estimate) +
              '; the raw harmonic estimator reads about 15 times too high here');
          }
        },
        {
          name: 'register-wise maximum equals the sketch of the union',
          assert: function (makeHll, api) {
            const left = makeHll(10);
            const right = makeHll(10);
            const whole = makeHll(10);

            for (let i = 0; i < 5000; i += 1) { left.add('x' + i); whole.add('x' + i); }
            for (let i = 2500; i < 8000; i += 1) { right.add('x' + i); whole.add('x' + i); }

            const a = left.registers();
            const b = right.registers();
            const w = whole.registers();
            for (let i = 0; i < w.length; i += 1) {
              api.assert.equal(Math.max(a[i], b[i]), w[i],
                'register ' + i + ': the maximum of the two shards must equal the whole-stream value');
            }
          }
        }
      ]
    }],

    'count-min-sketch': [{
      id: 'count-min-conservative',
      title: 'Count-min with conservative update and a heavy-hitter query',
      prompt: 'makeCountMin(width, depth, conservative) must return { add, estimate, total, top }. ' +
        'add(key) increments one cell per row; with conservative set, raise only the cells currently ' +
        'at the key\'s minimum. estimate(key) is the minimum over the rows. top(fraction) returns the ' +
        'keys whose estimate is at least fraction × total, which needs a candidate set kept beside ' +
        'the matrix — the matrix holds no keys. The estimate must never fall below the true count, ' +
        'whichever update rule is in use.',
      entry: 'makeCountMin',
      starter: [
        'function makeCountMin(width, depth, conservative) {',
        '  // provided: a 32-bit string hash and a finaliser',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
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
        '  const cells = new Float64Array(width * depth);',
        '  let seen = 0;',
        '',
        '  return {',
        '    add: function (key) {},',
        '    estimate: function (key) { return 0; },',
        '    total: function () { return seen; },',
        '    top: function (fraction) { return []; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeCountMin(width, depth, conservative) {',
        '  function hash(key, seed) {',
        '    let h = seed >>> 0;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      h ^= key.charCodeAt(i);',
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
        '  const cells = new Float64Array(width * depth);',
        '  const candidates = new Map();',
        '  let seen = 0;',
        '',
        '  function columns(key) {',
        '    const h1 = hash(key, 0x811c9dc5);',
        '    const h2 = (hash(key, 0x9e3779b9) | 1) >>> 0;',
        '    const out = new Array(depth);',
        '    for (let i = 0; i < depth; i += 1) {',
        '      out[i] = i * width + (mix((h1 + Math.imul(i, h2) + i * i) >>> 0) % width);',
        '    }',
        '    return out;',
        '  }',
        '',
        '  function minimumOf(list) {',
        '    let smallest = Infinity;',
        '    for (let i = 0; i < list.length; i += 1) {',
        '      if (cells[list[i]] < smallest) smallest = cells[list[i]];',
        '    }',
        '    return smallest;',
        '  }',
        '',
        '  function estimate(key) {',
        '    return minimumOf(columns(key));',
        '  }',
        '',
        '  return {',
        '    estimate: estimate,',
        '    total: function () { return seen; },',
        '    add: function (key) {',
        '      const list = columns(key);',
        '      seen += 1;',
        '',
        '      if (conservative) {',
        '        const target = minimumOf(list) + 1;',
        '        list.forEach(function (index) {',
        '          if (cells[index] < target) cells[index] = target;',
        '        });',
        '      } else {',
        '        list.forEach(function (index) { cells[index] += 1; });',
        '      }',
        '',
        '      // O(1) per update: a key stays a candidate only while its own',
        '      // estimate is at least seen/SLOTS, which bounds the map by SLOTS',
        '      // without ever scanning it.',
        '      const score = estimate(key);',
        '      if (score * 1024 >= seen) candidates.set(key, score);',
        '      else candidates.delete(key);',
        '    },',
        '    top: function (fraction) {',
        '      const out = [];',
        '      candidates.forEach(function (value, key) {',
        '        const score = estimate(key);',
        '        if (score >= fraction * seen) out.push({ key: key, estimate: score });',
        '      });',
        '      return out.sort(function (a, b) { return b.estimate - a.estimate; });',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the estimate is never below the true count',
          assert: function (makeCountMin, api) {
            [false, true].forEach(function (conservative) {
              const sketch = makeCountMin(256, 5, conservative);
              const truth = new Map();

              for (let i = 0; i < 30000; i += 1) {
                const key = 'k' + (i % 4001);
                sketch.add(key);
                truth.set(key, (truth.get(key) || 0) + 1);
              }

              truth.forEach(function (count, key) {
                api.assert.ok(sketch.estimate(key) >= count,
                  (conservative ? 'conservative' : 'plain') + ': ' + key + ' estimated ' +
                  sketch.estimate(key) + ' against a true count of ' + count);
              });
            });
          }
        },
        {
          name: 'the estimate never exceeds the true count by more than epsilon times N',
          assert: function (makeCountMin, api) {
            const width = 256;
            const sketch = makeCountMin(width, 5, false);
            const truth = new Map();

            for (let i = 0; i < 30000; i += 1) {
              const key = 'k' + (i % 4001);
              sketch.add(key);
              truth.set(key, (truth.get(key) || 0) + 1);
            }

            const bound = (Math.E / width) * sketch.total();
            truth.forEach(function (count, key) {
              api.assert.ok(sketch.estimate(key) - count <= bound,
                key + ' is over by ' + (sketch.estimate(key) - count) +
                ', and the bound is ' + bound.toFixed(1));
            });
          }
        },
        {
          name: 'conservative update is measurably tighter and still never under-counts',
          assert: function (makeCountMin, api) {
            const plain = makeCountMin(256, 5, false);
            const careful = makeCountMin(256, 5, true);
            const truth = new Map();

            for (let i = 0; i < 30000; i += 1) {
              const key = 'k' + ((i * i) % 4001);
              plain.add(key);
              careful.add(key);
              truth.set(key, (truth.get(key) || 0) + 1);
            }

            let plainError = 0;
            let carefulError = 0;
            truth.forEach(function (count, key) {
              plainError += plain.estimate(key) - count;
              carefulError += careful.estimate(key) - count;
              api.assert.ok(careful.estimate(key) >= count, key + ' under-counted by the careful sketch');
            });

            api.assert.ok(carefulError < plainError,
              'conservative total error ' + carefulError + ' should be below plain ' + plainError);
          }
        },
        {
          name: 'every true heavy hitter is reported',
          assert: function (makeCountMin, api) {
            const sketch = makeCountMin(512, 5, true);
            const truth = new Map();

            for (let i = 0; i < 40000; i += 1) {
              const heavy = i % 7 === 0;
              const key = heavy ? 'hot-' + (i % 21) : 'cold-' + (i % 9973);
              sketch.add(key);
              truth.set(key, (truth.get(key) || 0) + 1);
            }

            const fraction = 0.002;
            const threshold = fraction * sketch.total();
            const reported = new Set(sketch.top(fraction).map(function (row) { return row.key; }));

            truth.forEach(function (count, key) {
              if (count < threshold) return;
              api.assert.ok(reported.has(key),
                key + ' occurs ' + count + ' times, above the ' + threshold + ' threshold, and was not reported');
            });
          }
        }
      ]
    }],

    'quantile-sketches': [{
      id: 'reservoir-algorithm-r',
      title: 'Reservoir sampling, and proving it is uniform',
      prompt: 'makeReservoir(size) must return { add, sample, seen } implementing Algorithm R: the ' +
        'first `size` items are kept outright, and the i-th item after that (0-based over the whole ' +
        'stream) replaces a uniformly chosen resident with probability size/(i+1). Use the supplied ' +
        '`rng`: rng.int(n) returns an unbiased integer in [0, n). The invariant to preserve is that ' +
        'the sample is a uniform draw from everything seen *at every point*, not only at the end.',
      entry: 'makeReservoir',
      starter: [
        'function makeReservoir(size) {',
        '  const kept = [];',
        '  let seen = 0;',
        '',
        '  return {',
        '    add: function (value) { if (kept.length < size) kept.push(value); seen += 1; },',
        '    sample: function () { return kept.slice(); },',
        '    seen: function () { return seen; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeReservoir(size) {',
        '  const kept = [];',
        '  let seen = 0;',
        '',
        '  return {',
        '    add: function (value) {',
        '      if (kept.length < size) {',
        '        kept.push(value);',
        '        seen += 1;',
        '        return true;',
        '      }',
        '      const index = rng.int(seen + 1);',
        '      seen += 1;',
        '      if (index >= size) return false;',
        '      kept[index] = value;',
        '      return true;',
        '    },',
        '    sample: function () { return kept.slice(); },',
        '    seen: function () { return seen; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the reservoir holds min(size, seen) items and counts everything',
          assert: function (makeReservoir, api) {
            const reservoir = makeReservoir(5);
            for (let i = 0; i < 3; i += 1) reservoir.add(i);
            api.assert.equal(reservoir.sample().length, 3, 'a short stream is kept whole');
            api.assert.equal(reservoir.seen(), 3, 'seen counts every item');

            for (let i = 3; i < 500; i += 1) reservoir.add(i);
            api.assert.equal(reservoir.sample().length, 5, 'the sample never exceeds the size');
            api.assert.equal(reservoir.seen(), 500, 'seen counts every item, kept or not');
          }
        },
        {
          name: 'every item of the stream appears with the same frequency over 10 000 trials',
          assert: function (makeReservoir, api) {
            const streamLength = 20;
            const size = 5;
            const trials = 10000;
            const counts = new Array(streamLength).fill(0);

            for (let trial = 0; trial < trials; trial += 1) {
              const reservoir = makeReservoir(size);
              for (let i = 0; i < streamLength; i += 1) reservoir.add(i);
              reservoir.sample().forEach(function (value) { counts[value] += 1; });
            }

            const expected = trials * size / streamLength;
            counts.forEach(function (count, index) {
              api.assert.ok(Math.abs(count - expected) <= 0.08 * expected,
                'item ' + index + ' was kept ' + count + ' times, expected about ' + expected +
                ' — a bias here means the replacement probability is wrong');
            });
          }
        },
        {
          name: 'the last item is no more likely to survive than the first',
          assert: function (makeReservoir, api) {
            const trials = 10000;
            let first = 0;
            let last = 0;

            for (let trial = 0; trial < trials; trial += 1) {
              const reservoir = makeReservoir(10);
              for (let i = 0; i < 1000; i += 1) reservoir.add(i);
              const sample = reservoir.sample();
              if (sample.indexOf(0) !== -1) first += 1;
              if (sample.indexOf(999) !== -1) last += 1;
            }

            api.assert.ok(Math.abs(first - last) <= 0.25 * trials * 10 / 1000,
              'the first item survived ' + first + ' times and the last ' + last +
              ' — always keeping the newest item is the classic wrong implementation');
          }
        },
        {
          name: 'the sample is uniform partway through the stream, not only at the end',
          assert: function (makeReservoir, api) {
            const trials = 6000;
            const counts = new Array(12).fill(0);

            for (let trial = 0; trial < trials; trial += 1) {
              const reservoir = makeReservoir(4);
              for (let i = 0; i < 12; i += 1) reservoir.add(i);
              reservoir.sample().forEach(function (value) { counts[value] += 1; });
              for (let i = 12; i < 40; i += 1) reservoir.add(i);
            }

            const expected = trials * 4 / 12;
            counts.forEach(function (count, index) {
              api.assert.ok(Math.abs(count - expected) <= 0.1 * expected,
                'partway through, item ' + index + ' was in the sample ' + count +
                ' times against an expected ' + Math.round(expected));
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
