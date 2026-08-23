/**
 * Graded exercises for random generation and identifier design (M17.9-M17.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'random-generation': [{
      id: 'unbiased-bounded-and-shuffle',
      title: 'An unbiased bounded draw, and a shuffle that is not one character wrong',
      prompt: 'Return an object with `bounded(source, n)` and `shuffle(values, source)`. A `source` ' +
        'is `{ range, next() }` where `next()` returns an integer in [0, range). `bounded` must be ' +
        'EXACTLY uniform by rejection: compute `limit = range - (range % n)`, draw until a value ' +
        'falls below it, and return `value % n` — returning `{ value, draws }` with `draws` ' +
        'counting how many times `next()` was called. Discarding the ragged top is what makes it ' +
        'exact; `range % n` of the outputs would otherwise get one extra source value each, which ' +
        'at a range of 256 and n = 200 is a factor of two. `shuffle` must be Fisher-Yates: walk ' +
        'from the last index down and swap position i with a uniform choice from 0 through i, ' +
        'drawn through your own `bounded`. Drawing the partner from the whole array instead gives ' +
        'n to the power n equally likely execution paths for n! outcomes, and n! does not divide ' +
        'it, so the result cannot be uniform whatever generator drives it. The starter makes both ' +
        'mistakes.',
      entry: 'samplingKit',
      starter: [
        'function samplingKit() {',
        '  function bounded(source, n) {',
        '    // one draw, and the ragged top of the range folded back onto the bottom',
        '    return { value: source.next() % n, draws: 1 };',
        '  }',
        '',
        '  function shuffle(values, source) {',
        '    const out = values.slice();',
        '    for (let i = 0; i < out.length; i += 1) {',
        '      // the partner is drawn from the WHOLE array',
        '      const j = bounded(source, out.length).value;',
        '      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;',
        '    }',
        '    return out;',
        '  }',
        '',
        '  return { bounded: bounded, shuffle: shuffle };',
        '}'
      ].join('\n'),
      solution: [
        'function samplingKit() {',
        '  function bounded(source, n) {',
        '    // everything at or above the limit is discarded, so what remains',
        '    // divides evenly by n and every output is equally likely',
        '    const limit = source.range - (source.range % n);',
        '    let draws = 0;',
        '    for (;;) {',
        '      const value = source.next();',
        '      draws += 1;',
        '      if (value < limit) return { value: value % n, draws: draws };',
        '    }',
        '  }',
        '',
        '  function shuffle(values, source) {',
        '    const out = values.slice();',
        '    for (let i = out.length - 1; i > 0; i -= 1) {',
        '      // from the UNVISITED suffix: exactly n! equally likely paths',
        '      const j = bounded(source, i + 1).value;',
        '      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;',
        '    }',
        '    return out;',
        '  }',
        '',
        '  return { bounded: bounded, shuffle: shuffle };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'exhaustively uniform over every value a small source can produce',
          assert: function (samplingKit, api) {
            const kit = samplingKit();
            const range = 256;
            const n = 200;
            const counts = new Array(n).fill(0);
            let cursor = 0;

            /* Every source value exactly once, so this is not a sample: the
               counts ARE the distribution, and a biased method cannot hide
               behind noise. */
            const source = {
              range: range,
              next: function () { const v = cursor % range; cursor += 1; return v; }
            };

            let guard = 0;
            let produced = 0;
            while (cursor < range && guard < 10000) {
              guard += 1;
              if (cursor >= range) break;
              const before = cursor;
              const drawn = kit.bounded(source, n);
              if (cursor > range) break;
              counts[drawn.value] += 1;
              produced += 1;
              if (cursor === before) break;
            }

            const high = Math.max.apply(null, counts);
            const low = Math.min.apply(null, counts);
            api.assert.equal(produced, n,
              'discarding 56 of 256 source values must leave exactly 200 outputs, got ' + produced);
            api.assert.equal(high, 1, 'no output may appear twice over one pass of the source');
            api.assert.equal(low, 1, 'and none may be missing; a modulo draw gives 2 and 1');
          }
        },
        {
          name: 'the draw count reports the rejections rather than hiding them',
          assert: function (samplingKit, api) {
            const kit = samplingKit();
            let cursor = 0;
            const source = {
              range: 256,
              next: function () { const v = cursor % 256; cursor += 1; return v; }
            };

            /* The source cycles 0 .. 255 forever and exactly 56 of those values
               are rejected, so the count is deterministic rather than expected.
               The 56 rejections arrive in one run each time the cursor reaches
               200, which happens 4 times in the first 1 000 outputs - so the
               total is 1 000 + 4 x 56 = 1 224, not the 1 280 that five whole
               cycles would cost. */
            let totalDraws = 0;
            for (let i = 0; i < 1000; i += 1) totalDraws += kit.bounded(source, 200).draws;

            api.assert.equal(totalDraws, 1224,
              '1 000 outputs cost 1 000 accepted draws plus 4 complete runs of 56 rejections');
            api.assert.ok(totalDraws / 1000 > 1.2,
              'a method reporting 1.0 draws a sample is folding the ragged top of the range back ' +
              'onto the bottom instead of discarding it');
          }
        },
        {
          name: 'every permutation of three elements is equally likely',
          assert: function (samplingKit, api) {
            const kit = samplingKit();
            const source = { range: 4294967296, next: function () { return api.rng.int(4294967296); } };
            const counts = new Map();
            const trials = 120000;

            for (let i = 0; i < trials; i += 1) {
              const key = kit.shuffle([0, 1, 2], source).join('');
              counts.set(key, (counts.get(key) || 0) + 1);
            }

            api.assert.equal(counts.size, 6, 'all six orderings must occur');
            const values = Array.from(counts.values());
            const expected = trials / 6;
            let chi = 0;
            values.forEach(function (v) { chi += ((v - expected) * (v - expected)) / expected; });

            api.assert.ok(chi < 15,
              'chi-squared over 5 degrees of freedom must be below about 11 at the 5% level; got ' +
              chi.toFixed(1) + '. The naive shuffle scores over 1 000 here because 3^3 = 27 ' +
              'equally likely paths cannot spread evenly over 3! = 6 outcomes');
          }
        },
        {
          name: 'the shuffle keeps every element and reaches every position',
          assert: function (samplingKit, api) {
            const kit = samplingKit();
            const source = { range: 4294967296, next: function () { return api.rng.int(4294967296); } };
            const values = [];
            for (let i = 0; i < 50; i += 1) values.push(i);

            const positions = values.map(function () { return new Set(); });
            for (let trial = 0; trial < 400; trial += 1) {
              const shuffled = kit.shuffle(values, source);
              api.assert.equal(shuffled.length, values.length, 'length must be preserved');
              const seen = new Set(shuffled);
              api.assert.equal(seen.size, values.length, 'no element may be duplicated or lost');
              for (let i = 0; i < shuffled.length; i += 1) positions[shuffled[i]].add(i);
            }

            let narrow = 0;
            positions.forEach(function (set) { if (set.size < 30) narrow += 1; });
            api.assert.equal(narrow, 0,
              'over 400 shuffles every element should reach at least 30 of the 50 positions; ' +
              narrow + ' elements did not');
            api.assert.deepEqual(values.slice(0, 3), [0, 1, 2],
              'the input array must not be mutated');
          }
        }
      ]
    }],

    'integer-algorithms': [{
      id: 'snowflake-generator',
      title: 'A Snowflake generator that survives a clock stepping backwards',
      prompt: 'Return `createSnowflake({ clock, epoch, machine })`, where `clock()` returns ' +
        'milliseconds. Each `generate()` returns `{ id, time, sequence }` with `id` a BigInt laid ' +
        'out as `(millis - epoch) << 22n | machine << 12n | sequence`. Track the last millisecond ' +
        'issued from. When the clock reads the SAME millisecond as last time, increment the ' +
        'sequence; past 4 095 reset it to 0 and advance to the next millisecond, because 12 bits ' +
        'is a hard ceiling of 4 096 per machine per millisecond. When the clock reads a LOWER ' +
        'millisecond than the last one issued — an NTP step, a resumed virtual machine, or your ' +
        'own borrowing from a burst — keep issuing from your own last stamp rather than from the ' +
        'clock, because serving from the stale reading repeats identifiers that were already ' +
        'handed out. Also expose `stats()` returning `{ waits, borrowed }`: `waits` counts calls ' +
        'that had to use the stored stamp instead of the clock, `borrowed` counts sequence ' +
        'exhaustions. The starter trusts the clock, which is correct until it is not.',
      entry: 'createSnowflake',
      starter: [
        'function createSnowflake(options) {',
        '  const clock = options.clock;',
        '  const epoch = options.epoch || 0;',
        '  const machine = options.machine || 0;',
        '  let lastMillis = -1;',
        '  let sequence = 0;',
        '',
        '  function generate() {',
        '    // whatever the clock says, every time',
        '    const millis = clock();',
        '    if (millis === lastMillis) sequence += 1; else sequence = 0;',
        '    lastMillis = millis;',
        '    const id = (BigInt(millis - epoch) << 22n) |',
        '      (BigInt(machine) << 12n) | BigInt(sequence);',
        '    return { id: id, time: millis, sequence: sequence };',
        '  }',
        '',
        '  return { generate: generate, stats: function () { return { waits: 0, borrowed: 0 }; } };',
        '}'
      ].join('\n'),
      solution: [
        'function createSnowflake(options) {',
        '  const clock = options.clock;',
        '  const epoch = options.epoch || 0;',
        '  const machine = options.machine || 0;',
        '  let lastMillis = -1;',
        '  let sequence = 0;',
        '  let waits = 0;',
        '  let borrowed = 0;',
        '',
        '  function generate() {',
        '    let millis = clock();',
        '',
        '    // behind our own last stamp: keep issuing from the stamp, never',
        '    // from the clock, or the identifiers repeat',
        '    if (millis < lastMillis) { millis = lastMillis; waits += 1; }',
        '',
        '    if (millis === lastMillis) {',
        '      sequence += 1;',
        '      if (sequence > 4095) { sequence = 0; millis += 1; borrowed += 1; }',
        '    } else {',
        '      sequence = 0;',
        '    }',
        '    lastMillis = millis;',
        '',
        '    const id = (BigInt(millis - epoch) << 22n) |',
        '      (BigInt(machine) << 12n) | BigInt(sequence);',
        '    return { id: id, time: millis, sequence: sequence };',
        '  }',
        '',
        '  return {',
        '    generate: generate,',
        '    stats: function () { return { waits: waits, borrowed: borrowed }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a clock that steps backwards must not produce a duplicate',
          assert: function (createSnowflake, api) {
            let now = 1000;
            const generator = createSnowflake({
              clock: function () { return now; }, epoch: 0, machine: 3
            });

            const ids = [];
            for (let i = 0; i < 5; i += 1) ids.push(generator.generate());
            now -= 40;
            for (let i = 0; i < 8; i += 1) ids.push(generator.generate());

            const seen = new Set(ids.map(function (entry) { return String(entry.id); }));
            api.assert.equal(seen.size, ids.length,
              'the clock went back 40 ms; serving from it repeats 8 identifiers already issued');

            for (let i = 1; i < ids.length; i += 1) {
              api.assert.ok(ids[i].id > ids[i - 1].id,
                'identifiers must stay strictly increasing across the regression');
            }
            api.assert.ok(generator.stats().waits >= 8,
              'every call after the step had to use the stored stamp rather than the clock');
          }
        },
        {
          name: 'the 12-bit sequence is a ceiling of 4 096 per millisecond',
          assert: function (createSnowflake, api) {
            const generator = createSnowflake({
              clock: function () { return 5000; }, epoch: 0, machine: 1
            });

            const ids = [];
            for (let i = 0; i < 5000; i += 1) ids.push(generator.generate());

            const seen = new Set(ids.map(function (entry) { return String(entry.id); }));
            api.assert.equal(seen.size, 5000, '5 000 requests must produce 5 000 distinct ids');

            const milliseconds = new Set(ids.map(function (entry) { return entry.time; }));
            api.assert.equal(milliseconds.size, 2,
              '4 096 fit in one millisecond, so the other 904 must borrow exactly one more');
            api.assert.equal(ids[4095].sequence, 4095, 'the sequence must reach its maximum');
            api.assert.equal(ids[4096].sequence, 0, 'and then reset');
            api.assert.equal(generator.stats().borrowed, 1, 'one borrowing, reported as one');
          }
        },
        {
          name: 'the three fields read back by shifting and masking',
          assert: function (createSnowflake, api) {
            let now = 1700000000000;
            const epoch = 1700000000000;
            const generator = createSnowflake({
              clock: function () { now += 1; return now; }, epoch: epoch, machine: 511
            });

            for (let i = 0; i < 200; i += 1) {
              const entry = generator.generate();
              api.assert.equal(entry.id >> 22n, BigInt(entry.time - epoch),
                'the top bits must be the milliseconds since the epoch');
              api.assert.equal((entry.id >> 12n) & 0x3ffn, 511n,
                'the middle ten bits must be the machine id');
              api.assert.equal(entry.id & 0xfffn, BigInt(entry.sequence),
                'the low twelve bits must be the sequence');
              api.assert.ok(entry.id > 0n, 'the identifier must stay positive');
            }
          }
        },
        {
          name: 'a mixed workload stays unique and strictly ordered',
          assert: function (createSnowflake, api) {
            let now = 1000;
            const generator = createSnowflake({
              clock: function () { return now; }, epoch: 0, machine: 7
            });

            const ids = [];
            for (let step = 0; step < 400; step += 1) {
              const action = api.rng.int(10);
              if (action === 0) now -= 1 + api.rng.int(30);
              else if (action < 4) now += 1 + api.rng.int(3);

              const burst = 1 + api.rng.int(30);
              for (let i = 0; i < burst; i += 1) ids.push(generator.generate());
            }

            const seen = new Set(ids.map(function (entry) { return String(entry.id); }));
            api.assert.equal(seen.size, ids.length,
              ids.length - seen.size + ' duplicates over a workload with clock regressions');

            let inversions = 0;
            for (let i = 1; i < ids.length; i += 1) {
              if (ids[i].id <= ids[i - 1].id) inversions += 1;
            }
            api.assert.equal(inversions, 0,
              'a Snowflake is strictly monotonic per machine, including across regressions');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
