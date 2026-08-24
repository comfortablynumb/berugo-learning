/**
 * Graded exercises for Kolmogorov complexity and quantum computation
 * (M26.9-M26.10).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'kolmogorov-complexity-and-randomness': [{
      id: 'counting-bound',
      title: 'Check the counting bound exhaustively, and report an upper bound honestly',
      prompt: 'Two functions. upperBound(bits) must run a binary string through three codecs ' +
        'and return { best, codec }. The LITERAL codec always costs the string length. The RUN ' +
        'codec costs 5 bits per maximal run of equal characters, with runs capped at 15 ' +
        'characters. The PERIOD codec costs p + 8 bits when the string is an exact repetition ' +
        'of its first p characters for the smallest such p at most half the length, and the ' +
        'string length + 8 when there is none. Report the SMALLEST — which means no string can ' +
        'ever exceed its own length, because the literal is always available. Then ' +
        'verifyBound(n, k) must generate every binary string of length n and return ' +
        '{ total, compressed, bound, withinBound, worstCase }: `compressed` counts those with an ' +
        'upper bound at most n − k, `bound` is 2^(n−k) − 1, and `worstCase` is the largest ' +
        'upper bound over all of them. The starter omits the literal codec, so its worst case ' +
        'exceeds the string length — it claims a description longer than the string it ' +
        'describes.',
      entry: 'verifyBound',
      starter: [
        'function upperBound(bits) {',
        '  // No literal codec, so an incompressible string still reports a small number.',
        '  let runs = 0;',
        '  let i = 0;',
        '',
        '  while (i < bits.length) {',
        '    let length = 1;',
        '',
        '    while (i + length < bits.length && bits[i + length] === bits[i] && length < 15) {',
        '      length += 1;',
        '    }',
        '    runs += 1;',
        '    i += length;',
        '  }',
        '  let period = bits.length + 8;',
        '',
        '  for (let p = 1; p <= bits.length / 2; p += 1) {',
        '    let matches = true;',
        '',
        '    for (let j = p; j < bits.length && matches; j += 1) {',
        '      if (bits[j] !== bits[j % p]) matches = false;',
        '    }',
        '    if (matches) { period = p + 8; break; }',
        '  }',
        '  const best = Math.min(runs * 5, period);',
        '',
        '  return { best: best, codec: best === period ? "period" : "run" };',
        '}',
        '',
        'function verifyBound(n, k) {',
        '  const total = Math.pow(2, n);',
        '  let compressed = 0;',
        '  let worstCase = 0;',
        '',
        '  for (let mask = 0; mask < total; mask += 1) {',
        '    const bits = mask.toString(2).padStart(n, "0");',
        '    const best = upperBound(bits).best;',
        '',
        '    if (best <= n - k) compressed += 1;',
        '    worstCase = Math.max(worstCase, best);',
        '  }',
        '  const bound = Math.pow(2, n - k) - 1;',
        '',
        '  return { total: total, compressed: compressed, bound: bound,',
        '    withinBound: compressed <= bound, worstCase: worstCase };',
        '}'
      ].join('\n'),
      solution: [
        'function upperBound(bits) {',
        '  let runs = 0;',
        '  let i = 0;',
        '',
        '  while (i < bits.length) {',
        '    let length = 1;',
        '',
        '    while (i + length < bits.length && bits[i + length] === bits[i] && length < 15) {',
        '      length += 1;',
        '    }',
        '    runs += 1;',
        '    i += length;',
        '  }',
        '  let period = bits.length + 8;',
        '',
        '  for (let p = 1; p <= bits.length / 2; p += 1) {',
        '    let matches = true;',
        '',
        '    for (let j = p; j < bits.length && matches; j += 1) {',
        '      if (bits[j] !== bits[j % p]) matches = false;',
        '    }',
        '    if (matches) { period = p + 8; break; }',
        '  }',
        '  /* The literal encoding is always available and is what the others must beat.',
        '     Leaving it out makes an incompressible string look compressible. */',
        '  const candidates = [',
        '    { bits: bits.length, codec: "literal" },',
        '    { bits: runs * 5, codec: "run" },',
        '    { bits: period, codec: "period" }',
        '  ];',
        '  const winner = candidates.reduce(function (a, b) {',
        '    return b.bits < a.bits ? b : a;',
        '  });',
        '',
        '  return { best: winner.bits, codec: winner.codec };',
        '}',
        '',
        'function verifyBound(n, k) {',
        '  const total = Math.pow(2, n);',
        '  let compressed = 0;',
        '  let worstCase = 0;',
        '',
        '  for (let mask = 0; mask < total; mask += 1) {',
        '    const bits = mask.toString(2).padStart(n, "0");',
        '    const best = upperBound(bits).best;',
        '',
        '    if (best <= n - k) compressed += 1;',
        '    worstCase = Math.max(worstCase, best);',
        '  }',
        '  const bound = Math.pow(2, n - k) - 1;',
        '',
        '  return { total: total, compressed: compressed, bound: bound,',
        '    withinBound: compressed <= bound, worstCase: worstCase };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the bound holds at every size, with room to spare',
          assert: function (verifyBound, api) {
            [[10, 1], [10, 2], [12, 1], [12, 2], [12, 3]].forEach(function (pair) {
              const out = verifyBound(pair[0], pair[1]);

              api.assert.equal(out.total, Math.pow(2, pair[0]),
                'every string of length ' + pair[0] + ' must be generated');
              api.assert.equal(out.bound, Math.pow(2, pair[0] - pair[1]) - 1,
                'the bound is 2^(n−k) − 1');
              api.assert.ok(out.withinBound,
                'at n = ' + pair[0] + ', k = ' + pair[1] + ' the count ' + out.compressed +
                  ' exceeds the bound ' + out.bound + ' — which would mean a decoder that ' +
                  'cannot decode');
            });
          }
        },
        {
          name: 'almost nothing actually compresses, because the literal is in the running',
          assert: function (verifyBound, api) {
            const twelve = verifyBound(12, 1);

            api.assert.ok(twelve.compressed < 100,
              'at n = 12 fewer than a hundred of the 4 096 strings compress by even one bit — ' +
                'got ' + twelve.compressed + ', against a ceiling of ' + twelve.bound + '.');
            api.assert.ok(twelve.compressed > 0,
              'and some do — all zeros and the alternating string, at least');

            const strict = verifyBound(12, 3);

            api.assert.ok(strict.compressed <= twelve.compressed,
              'demanding more compression cannot find more strings');
          }
        },
        {
          name: 'no string is ever described in more bits than it has',
          assert: function (verifyBound, api) {
            [8, 10, 12].forEach(function (n) {
              const out = verifyBound(n, 2);

              api.assert.equal(out.worstCase, n,
                'the literal encoding is always available, so the worst upper bound over all ' +
                  'strings of length ' + n + ' is exactly ' + n + ' — got ' + out.worstCase +
                  '. A codec set without the literal claims descriptions longer than the ' +
                  'strings they describe.');
            });

            const out = verifyBound(12, 2);

            api.assert.equal(out.total, 4096);
            api.assert.equal(out.bound, 1023);
            api.assert.ok(out.bound - out.compressed > 900,
              'real codecs come nowhere near saturating the ceiling — expected headroom over ' +
                '900, got ' + (out.bound - out.compressed));
          }
        }
      ]
    }],

    'quantum-computation': [{
      id: 'grover-diffusion',
      title: 'Implement Grover’s diffusion operator, and check it against the formula',
      prompt: 'grover(n, target, iterations) must simulate Grover search on a real amplitude ' +
        'vector of length 2^n and return an array of { iteration, measured, predicted } — one ' +
        'entry for iteration 0 through `iterations`. Start with every amplitude at ' +
        '1/sqrt(2^n) (an equal superposition). Each iteration does two things: the ORACLE ' +
        'negates the amplitude at `target`, and the DIFFUSION operator reflects every amplitude ' +
        'about their mean, sending a to 2·mean − a. `measured` is the amplitude at target ' +
        'squared, and `predicted` is sin((2k+1)·theta) squared where sin(theta) = 1/sqrt(2^n). ' +
        'The starter negates about zero instead of about the mean, which is a sign flip and not ' +
        'a rotation, so the amplitude never grows.',
      entry: 'grover',
      starter: [
        'function grover(n, target, iterations) {',
        '  // Reflects about ZERO rather than about the mean, so nothing amplifies.',
        '  const size = Math.pow(2, n);',
        '  const theta = Math.asin(1 / Math.sqrt(size));',
        '  const amplitudes = [];',
        '',
        '  for (let i = 0; i < size; i += 1) amplitudes.push(1 / Math.sqrt(size));',
        '  const rows = [];',
        '  const record = function (k) {',
        '    rows.push({ iteration: k, measured: amplitudes[target] * amplitudes[target],',
        '      predicted: Math.pow(Math.sin((2 * k + 1) * theta), 2) });',
        '  };',
        '',
        '  record(0);',
        '  for (let k = 1; k <= iterations; k += 1) {',
        '    amplitudes[target] = -amplitudes[target];',
        '    for (let i = 0; i < size; i += 1) amplitudes[i] = -amplitudes[i];',
        '    record(k);',
        '  }',
        '  return rows;',
        '}'
      ].join('\n'),
      solution: [
        'function grover(n, target, iterations) {',
        '  const size = Math.pow(2, n);',
        '  const theta = Math.asin(1 / Math.sqrt(size));',
        '  const amplitudes = [];',
        '',
        '  for (let i = 0; i < size; i += 1) amplitudes.push(1 / Math.sqrt(size));',
        '  const rows = [];',
        '  const record = function (k) {',
        '    rows.push({ iteration: k, measured: amplitudes[target] * amplitudes[target],',
        '      predicted: Math.pow(Math.sin((2 * k + 1) * theta), 2) });',
        '  };',
        '',
        '  record(0);',
        '  for (let k = 1; k <= iterations; k += 1) {',
        '    amplitudes[target] = -amplitudes[target];',
        '    /* Reflect about the MEAN. The oracle put the marked amplitude below it,',
        '       so the reflection throws it far above — and that pair of steps is a',
        '       rotation of the state by a fixed angle towards the answer. */',
        '    let mean = 0;',
        '',
        '    for (let i = 0; i < size; i += 1) mean += amplitudes[i];',
        '    mean /= size;',
        '    for (let i = 0; i < size; i += 1) amplitudes[i] = 2 * mean - amplitudes[i];',
        '    record(k);',
        '  }',
        '  return rows;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the amplitude follows the formula at every iteration',
          assert: function (grover, api) {
            [2, 3, 4, 5].forEach(function (n) {
              const rows = grover(n, 1, Math.ceil(Math.sqrt(Math.pow(2, n))) + 2);

              rows.forEach(function (row) {
                api.assert.ok(Math.abs(row.measured - row.predicted) < 1e-9,
                  'at n = ' + n + ', k = ' + row.iteration + ': measured ' +
                    row.measured.toFixed(9) + ' against a predicted ' +
                    row.predicted.toFixed(9) + '. Reflecting about zero gives a flat curve.');
              });
            });
          }
        },
        {
          name: 'the amplitude actually grows, and peaks where the formula says',
          assert: function (grover, api) {
            [2, 4, 5].forEach(function (n) {
              const size = Math.pow(2, n);
              const optimal = Math.round((Math.PI / 4) * Math.sqrt(size) - 0.5);
              const rows = grover(n, 3 % size, optimal + 2);
              const start = rows[0].measured;
              const atOptimal = rows.filter(function (r) {
                return r.iteration === optimal;
              })[0];

              api.assert.ok(Math.abs(start - 1 / size) < 1e-9,
                'the starting probability must be 1/N — got ' + start.toFixed(6) +
                  ' at n = ' + n);
              api.assert.ok(atOptimal.measured > 0.9,
                'at the optimal iteration the marked probability must exceed 0.9 — got ' +
                  atOptimal.measured.toFixed(4) + ' at n = ' + n);
              api.assert.ok(atOptimal.measured > start * 3,
                'amplification means the probability grows — at n = ' + n + ' it goes from ' +
                  start.toFixed(4) + ' to ' + atOptimal.measured.toFixed(4) +
                  ', and the starter leaves it flat');
            });
          }
        },
        {
          name: 'running past the optimum makes it worse, because it is a rotation',
          assert: function (grover, api) {
            const rows = grover(4, 3, 6);
            const optimal = Math.round((Math.PI / 4) * Math.sqrt(16) - 0.5);
            const peak = rows.filter(function (r) { return r.iteration === optimal; })[0];
            const after = rows.filter(function (r) { return r.iteration === optimal + 2; })[0];

            api.assert.equal(optimal, 3, 'round(pi/4 * sqrt(16) - 0.5) is 3');
            api.assert.ok(peak.measured > 0.95,
              'the peak at k = 3 must be above 0.95 — got ' + peak.measured.toFixed(4));
            api.assert.ok(after.measured < peak.measured,
              'two iterations past the optimum the probability must FALL — got ' +
                after.measured.toFixed(4) + ' against ' + peak.measured.toFixed(4));
            api.assert.ok(after.measured < 0.3,
              'and it falls a long way: the state has rotated past the answer');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
