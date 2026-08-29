/**
 * Graded exercises for timing, power and hardware description (M33.9-M33.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'timing-clocking-and-power': [{
      id: 'pipeline-budget',
      title: 'Pipeline arithmetic, with the overhead paid once per stage',
      prompt: 'Write lab() returning { period, pipeline }. period(logic, overhead) is the '
        + 'minimum clock period for a block with the given logic delay: the logic plus the '
        + 'flip-flop overhead. pipeline(logic, stages, overhead) cuts the LOGIC into the given '
        + 'number of stages — each stage getting ceil(logic / stages) — and adds the overhead '
        + 'to every stage, returning { period, latency, speedup, ceiling }: latency is period '
        + 'times stages, speedup is the one-stage period divided by this one, and ceiling is '
        + 'the speed-up you would reach with infinitely many stages. The starter divides the '
        + 'whole period by the stage count, which quietly assumes the flip-flop overhead can '
        + 'be split too.',
      entry: 'lab',
      starter: [
        'function period(logic, overhead) {',
        '  return logic + overhead;',
        '}',
        '',
        'function pipeline(logic, stages, overhead) {',
        '  // Dividing the whole period, overhead included. Registers do not get',
        '  // cheaper when you add more of them.',
        '  const each = Math.ceil((logic + overhead) / stages);',
        '',
        '  return { period: each, latency: each * stages,',
        '    speedup: (logic + overhead) / each,',
        '    ceiling: (logic + overhead) / overhead };',
        '}',
        '',
        'function lab() {',
        '  return { period: period, pipeline: pipeline };',
        '}'
      ].join('\n'),
      solution: [
        'function period(logic, overhead) {',
        '  return logic + overhead;',
        '}',
        '',
        '/* Only the logic divides. The flip-flop overhead — clock-to-q plus',
        '   setup — is paid once per stage whatever the stage contains, which is',
        '   what bounds the speed-up and what makes latency grow while throughput',
        '   improves. */',
        'function pipeline(logic, stages, overhead) {',
        '  const each = Math.ceil(logic / stages) + overhead;',
        '',
        '  return { period: each, latency: each * stages,',
        '    speedup: (logic + overhead) / each,',
        '    ceiling: (logic + overhead) / overhead };',
        '}',
        '',
        'function lab() {',
        '  return { period: period, pipeline: pipeline };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the overhead is paid per stage, so the speed-up is less than the stage count',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.period(35, 3), 38, '35 of logic plus 3 of overhead');
            const two = parts.pipeline(35, 2, 3);

            api.assert.equal(two.period, 21, 'ceil(35 / 2) = 18, plus 3 of overhead');
            api.assert.equal(two.latency, 42, 'and latency is worse than the 38 it started at');
            api.assert.ok(Math.abs(two.speedup - 38 / 21) < 1e-9,
              'the speed-up is 38 / 21, which is 1.81 rather than 2');
          }
        },
        {
          name: 'the speed-up saturates, and the ceiling says where',
          assert: function (lab, api) {
            const parts = lab();
            const six = parts.pipeline(35, 6, 3);
            const many = parts.pipeline(35, 35, 3);

            api.assert.equal(six.period, 9, 'ceil(35 / 6) = 6, plus 3');
            api.assert.ok(Math.abs(six.ceiling - 38 / 3) < 1e-9,
              'the ceiling is (35 + 3) / 3 = 12.67');
            api.assert.ok(many.speedup < many.ceiling,
              'even one gate delay per stage does not reach the ceiling');
            api.assert.ok(many.latency > six.latency,
              'and latency keeps getting worse all the way down');
          }
        }
      ]
    }],
    'hardware-description-and-verification': [{
      id: 'exhaustive-equivalence',
      title: 'Check a block against its model on every vector, and name the failure',
      prompt: 'Write lab() returning { equivalent }. equivalent(impl, model, inputs) drives '
        + 'EVERY input vector of `inputs` bits through both functions — each takes an array of '
        + 'bits, least significant first, and returns a number — and returns { ok, checked, at }: '
        + 'ok is true when they agree everywhere, checked is how many vectors were driven, and '
        + 'at is the first disagreeing vector as an array of bits (null when they agree). Walk '
        + 'the vectors in ascending numeric order so the reported one is genuinely the first. '
        + 'The starter checks only the first four vectors and reports success, which is the '
        + 'shape of every test suite that misses a bug and still turns the bar green.',
      entry: 'lab',
      starter: [
        'function vectorOf(mask, inputs) {',
        '  const bits = [];',
        '',
        '  for (let at = 0; at < inputs; at += 1) bits.push((mask >> at) & 1);',
        '  return bits;',
        '}',
        '',
        'function equivalent(impl, model, inputs) {',
        '  // A sample of the corners, which is what a hand-written testbench',
        '  // usually is.',
        '  const limit = Math.min(4, Math.pow(2, inputs));',
        '',
        '  for (let mask = 0; mask < limit; mask += 1) {',
        '    const bits = vectorOf(mask, inputs);',
        '',
        '    if (impl(bits) !== model(bits)) {',
        '      return { ok: false, checked: mask + 1, at: bits };',
        '    }',
        '  }',
        '  return { ok: true, checked: limit, at: null };',
        '}',
        '',
        'function lab() {',
        '  return { equivalent: equivalent };',
        '}'
      ].join('\n'),
      solution: [
        'function vectorOf(mask, inputs) {',
        '  const bits = [];',
        '',
        '  for (let at = 0; at < inputs; at += 1) bits.push((mask >> at) & 1);',
        '  return bits;',
        '}',
        '',
        '/* The input space of a combinational block is finite, so "checked" can',
        '   mean every vector rather than a sample — and the report has to carry',
        '   the failing vector, because "somewhere in here" is not a bug report. */',
        'function equivalent(impl, model, inputs) {',
        '  const total = Math.pow(2, inputs);',
        '',
        '  for (let mask = 0; mask < total; mask += 1) {',
        '    const bits = vectorOf(mask, inputs);',
        '',
        '    if (impl(bits) !== model(bits)) {',
        '      return { ok: false, checked: mask + 1, at: bits };',
        '    }',
        '  }',
        '  return { ok: true, checked: total, at: null };',
        '}',
        '',
        'function lab() {',
        '  return { equivalent: equivalent };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a correct block is checked over its whole input space',
          assert: function (lab, api) {
            const parts = lab();
            const impl = function (bits) {
              return (bits[0] ^ bits[1] ^ bits[2]) + 2 * ((bits[0] + bits[1] + bits[2]) > 1 ? 1 : 0);
            };
            const model = function (bits) {
              return bits[0] + bits[1] + bits[2];
            };
            const out = parts.equivalent(impl, model, 3);

            api.assert.equal(out.ok, true, 'a full adder agrees with integer addition');
            api.assert.equal(out.checked, 8, 'and all 8 vectors were driven');
            api.assert.equal(out.at, null, 'with no failing vector to report');
          }
        },
        {
          name: 'a typo that survives the first few vectors is still caught, and named',
          assert: function (lab, api) {
            const parts = lab();
            /* The sum bit is an OR where it should be an XOR: correct on three
               of the eight rows of a full adder, and wrong on the rest. */
            const broken = function (bits) {
              const half = bits[0] ^ bits[1];

              return (half | bits[2]) + 2 * ((bits[0] + bits[1] + bits[2]) > 1 ? 1 : 0);
            };
            const model = function (bits) {
              return bits[0] + bits[1] + bits[2];
            };
            const out = parts.equivalent(broken, model, 3);

            api.assert.equal(out.ok, false, 'the disagreement is found');
            api.assert.deepEqual(out.at, [1, 0, 1],
              'the first failing vector is a=1, b=0, cin=1');
            api.assert.equal(out.checked, 6, 'after driving 6 of the 8 vectors');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
