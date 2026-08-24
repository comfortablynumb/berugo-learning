/**
 * Graded exercises for lossy and domain-specific compression (M22.8-M22.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'lossy-compression': [{
      id: 'dct-and-quantise',
      title: 'The 8 × 8 DCT, its inverse, and the one lossy step',
      prompt: 'transform(block, table) takes 64 pixel values (row-major, 0 to 255) and a 64-entry ' +
        'quantisation table, and must return { coefficients, levels, restored }. Centre the block ' +
        'on zero by subtracting 128; apply the separable 8 × 8 DCT-II, whose coefficient at (u, v) ' +
        'is a quarter times alpha(u) times alpha(v) times the sum over x and y of ' +
        'block(x,y)·cos((2x+1)uπ/16)·cos((2y+1)vπ/16), with alpha(0) = 1/√2 and alpha(u) = 1 ' +
        'otherwise; quantise by dividing each coefficient by its table entry and rounding; then ' +
        'multiply back, apply the inverse DCT, add 128 and clamp to 0..255. The starter skips the ' +
        'transform and quantises the pixels directly, which is what a codec without a transform ' +
        'would do.',
      entry: 'transform',
      starter: [
        'function transform(block, table) {',
        '  // No transform: quantise the pixels themselves, which blurs everything equally.',
        '  const levels = block.map(function (value, i) {',
        '    return Math.round((value - 128) / table[i]);',
        '  });',
        '  const restored = levels.map(function (level, i) {',
        '    return Math.min(255, Math.max(0, Math.round(level * table[i] + 128)));',
        '  });',
        '',
        '  return { coefficients: block.slice(), levels: levels, restored: restored };',
        '}'
      ].join('\n'),
      solution: [
        'function transform(block, table) {',
        '  const N = 8;',
        '  const cos = [];',
        '',
        '  for (let u = 0; u < N; u += 1) {',
        '    cos.push([]);',
        '    for (let x = 0; x < N; x += 1) {',
        '      cos[u].push(Math.cos((2 * x + 1) * u * Math.PI / (2 * N)));',
        '    }',
        '  }',
        '  function alpha(u) { return u === 0 ? Math.SQRT1_2 : 1; }',
        '',
        '  const centred = block.map(function (value) { return value - 128; });',
        '  const coefficients = new Array(64).fill(0);',
        '',
        '  for (let u = 0; u < N; u += 1) {',
        '    for (let v = 0; v < N; v += 1) {',
        '      let sum = 0;',
        '',
        '      for (let x = 0; x < N; x += 1) {',
        '        for (let y = 0; y < N; y += 1) {',
        '          sum += centred[x * N + y] * cos[u][x] * cos[v][y];',
        '        }',
        '      }',
        '      coefficients[u * N + v] = 0.25 * alpha(u) * alpha(v) * sum;',
        '    }',
        '  }',
        '  const levels = coefficients.map(function (value, i) {',
        '    return Math.round(value / table[i]);',
        '  });',
        '  const dequantised = levels.map(function (level, i) { return level * table[i]; });',
        '  const restored = new Array(64).fill(0);',
        '',
        '  for (let x = 0; x < N; x += 1) {',
        '    for (let y = 0; y < N; y += 1) {',
        '      let sum = 0;',
        '',
        '      for (let u = 0; u < N; u += 1) {',
        '        for (let v = 0; v < N; v += 1) {',
        '          sum += alpha(u) * alpha(v) * dequantised[u * N + v] * cos[u][x] * cos[v][y];',
        '        }',
        '      }',
        '      restored[x * N + y] = Math.min(255, Math.max(0,',
        '        Math.round(0.25 * sum + 128)));',
        '    }',
        '  }',
        '  return { coefficients: coefficients, levels: levels, restored: restored };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'with a table of ones the block comes back almost exactly',
          assert: function (transform, api) {
            const ones = new Array(64).fill(1);
            const block = [];

            for (let i = 0; i < 64; i += 1) block.push((i * 3 + 40) % 256);
            const result = transform(block, ones);
            let worst = 0;

            result.restored.forEach(function (value, i) {
              worst = Math.max(worst, Math.abs(value - block[i]));
            });
            api.assert.atMost(worst, 1,
              'a quantisation step of one loses at most a rounding: worst error ' + worst);
          }
        },
        {
          name: 'a flat block puts all its energy in one coefficient',
          assert: function (transform, api) {
            const flat = new Array(64).fill(200);
            const ones = new Array(64).fill(1);
            const result = transform(flat, ones);

            api.assert.atLeast(Math.abs(result.coefficients[0]), 500,
              'the DC coefficient carries the block mean, scaled');
            let others = 0;

            result.coefficients.forEach(function (value, i) {
              if (i > 0) others += Math.abs(value);
            });
            api.assert.atMost(others, 1e-6,
              'every AC coefficient of a constant block is zero');
          }
        },
        {
          name: 'the transform compacts energy into the low-frequency corner',
          assert: function (transform, api) {
            const ones = new Array(64).fill(1);
            const smooth = [];

            for (let y = 0; y < 8; y += 1) {
              for (let x = 0; x < 8; x += 1) smooth.push(40 + 20 * x + 5 * y);
            }
            const result = transform(smooth, ones);
            let corner = 0;
            let total = 0;

            result.coefficients.forEach(function (value, i) {
              const energy = value * value;

              total += energy;
              if ((i % 8) < 4 && Math.floor(i / 8) < 4) corner += energy;
            });
            api.assert.atLeast(corner / total, 0.95,
              'a smooth block should be almost entirely low-frequency');
          }
        },
        {
          name: 'a coarser table keeps fewer coefficients and loses more',
          assert: function (transform, api) {
            const block = [];

            for (let i = 0; i < 64; i += 1) block.push((i * 37 + 11) % 256);

            function run(step) {
              const table = new Array(64).fill(step);
              const result = transform(block, table);
              let nonZero = 0;
              let worst = 0;

              result.levels.forEach(function (level) { if (level !== 0) nonZero += 1; });
              result.restored.forEach(function (value, i) {
                worst = Math.max(worst, Math.abs(value - block[i]));
              });
              return { nonZero: nonZero, worst: worst };
            }
            const fine = run(2);
            const coarse = run(40);

            api.assert.atMost(coarse.nonZero, fine.nonZero,
              'a coarser step must zero at least as many coefficients');
            api.assert.atLeast(coarse.worst, fine.worst,
              'and it must lose at least as much');
          }
        }
      ]
    }],

    'domain-specific-compression': [{
      id: 'gorilla-xor',
      title: 'Gorilla-style XOR encoding for float series',
      prompt: 'encode(values) must return { bits, exact } for a Gorilla-style encoding of an ' +
        'array of doubles. The first value costs 64 bits. For every value after it, XOR its ' +
        '64-bit representation with the previous value’s: if the result is zero, spend 1 control ' +
        'bit; otherwise spend 2 control bits, 5 bits for the leading-zero count, 6 bits for the ' +
        'meaningful window width, and the window itself. `exact` must be true only if ' +
        'reconstructing the series from those XORs returns every double bit-for-bit — which it ' +
        'does, because the encoding is lossless. Use a Float64Array over an ArrayBuffer with a ' +
        'Uint32Array view to reach the bits. The starter charges 64 bits per value, which is ' +
        'exactly what storing the raw doubles costs.',
      entry: 'encode',
      starter: [
        'function encode(values) {',
        '  // No encoding at all: this is the raw size, and it is the number to beat.',
        '  return { bits: values.length * 64, exact: true };',
        '}'
      ].join('\n'),
      solution: [
        'function encode(values) {',
        '  const buffer = new ArrayBuffer(8);',
        '  const floats = new Float64Array(buffer);',
        '  const words = new Uint32Array(buffer);',
        '',
        '  function toBits(value) {',
        '    floats[0] = value;',
        '    return { high: words[1], low: words[0] };',
        '  }',
        '  function fromBits(bits) {',
        '    words[1] = bits.high;',
        '    words[0] = bits.low;',
        '    return floats[0];',
        '  }',
        '  function xorBits(a, b) {',
        '    return { high: (a.high ^ b.high) >>> 0, low: (a.low ^ b.low) >>> 0 };',
        '  }',
        '  function trailing(word) {',
        '    if (word === 0) return 32;',
        '    let count = 0;',
        '    let value = word;',
        '',
        '    while ((value & 1) === 0) {',
        '      count += 1;',
        '      value >>>= 1;',
        '    }',
        '    return count;',
        '  }',
        '  if (values.length === 0) return { bits: 0, exact: true };',
        '  let bits = 64;',
        '  let previous = toBits(values[0]);',
        '  let exact = true;',
        '',
        '  for (let i = 1; i < values.length; i += 1) {',
        '    const current = toBits(values[i]);',
        '    const x = xorBits(previous, current);',
        '',
        '    if (x.high === 0 && x.low === 0) {',
        '      bits += 1;',
        '    } else {',
        '      const leading = x.high !== 0 ? Math.clz32(x.high) : 32 + Math.clz32(x.low);',
        '      const trail = x.low !== 0 ? trailing(x.low) : 32 + trailing(x.high);',
        '',
        '      bits += 2 + 5 + 6 + (64 - leading - trail);',
        '    }',
        '    if (fromBits(xorBits(previous, x)) !== values[i]) exact = false;',
        '    previous = current;',
        '  }',
        '  return { bits: bits, exact: exact };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a constant series costs one control bit per value',
          assert: function (encode, api) {
            const constant = new Array(1000).fill(42.5);
            const result = encode(constant);

            api.assert.equal(result.exact, true, 'the encoding is lossless');
            api.assert.atMost(result.bits, 64 + 999 * 2,
              'every XOR after the first is zero, so each costs a control bit or two');
            api.assert.atLeast(result.bits, 64 + 999,
              'and it cannot cost less than one bit each');
          }
        },
        {
          name: 'a slowly-varying metric beats the raw size by a wide margin',
          assert: function (encode, api) {
            const rng = api.Random.seeded(17);
            const series = [];
            let at = 72.5;

            for (let i = 0; i < 2000; i += 1) {
              at += (rng.next() - 0.5) * 0.05;
              series.push(Math.round(at * 10) / 10);
            }
            const result = encode(series);
            const raw = series.length * 64;

            api.assert.equal(result.exact, true, 'still lossless');
            api.assert.atMost(result.bits, raw / 4,
              'a metric rounded to one decimal should compress at least fourfold: ' +
              (raw / result.bits).toFixed(2) + 'x');
          }
        },
        {
          name: 'full double precision defeats it, and that is the point',
          assert: function (encode, api) {
            const rng = api.Random.seeded(19);
            const rounded = [];
            const full = [];
            let a = 50;
            let b = 50;

            for (let i = 0; i < 2000; i += 1) {
              a += (rng.next() - 0.5) * 0.05;
              b += (rng.next() - 0.5) * 0.05;
              rounded.push(Math.round(a * 10) / 10);
              full.push(b);
            }
            const cheap = encode(rounded).bits;
            const dear = encode(full).bits;

            api.assert.atLeast(dear, cheap * 2,
              'every low mantissa bit that moves widens the window: ' + dear + ' against ' + cheap);
          }
        },
        {
          name: 'uniform noise is the floor, and it is reported rather than hidden',
          assert: function (encode, api) {
            const rng = api.Random.seeded(23);
            const noise = [];

            for (let i = 0; i < 1500; i += 1) noise.push(rng.next() * 1000);
            const result = encode(noise);
            const raw = noise.length * 64;

            api.assert.equal(result.exact, true, 'lossless even on the worst case');
            api.assert.atMost(result.bits, raw * 1.2,
              'the control bits must not make it much worse than raw');
            api.assert.atLeast(result.bits, raw * 0.5,
              'and unpredictable doubles cannot compress far: ' +
              (raw / result.bits).toFixed(2) + 'x');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
