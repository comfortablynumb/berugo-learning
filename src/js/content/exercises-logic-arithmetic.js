/**
 * Graded exercises for the adders and the ALU (M33.4-M33.5).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'arithmetic-circuits': [{
      id: 'generate-and-propagate',
      title: 'Add with generate and propagate, and get the sum right too',
      prompt: 'Write lab() returning { carries, add }. carries(a, b, cin, width) returns an '
        + 'array of width+1 carry bits, starting with cin, computed from the generate and '
        + 'propagate signals: g is a AND b, p is a XOR b, and the carry out of a position is '
        + 'g OR (p AND carry in). add(a, b, cin, width) returns { sum, cout } for the same '
        + 'operands, where the sum bit of a position is p XOR the carry into it. The starter '
        + 'uses a OR b for propagate — which happens to give the right carries and the wrong '
        + 'sums, so it is exactly the bug that survives a carelessly chosen test.',
      entry: 'lab',
      starter: [
        'function signals(a, b, width) {',
        '  const g = [];',
        '  const p = [];',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    const ai = (a >> at) & 1;',
        '    const bi = (b >> at) & 1;',
        '',
        '    g.push(ai & bi);',
        '    // OR rather than XOR. The carries come out right, because a',
        '    // position that generates also propagates under this definition.',
        '    p.push(ai | bi);',
        '  }',
        '  return { g: g, p: p };',
        '}',
        '',
        'function carries(a, b, cin, width) {',
        '  const parts = signals(a, b, width);',
        '  const out = [cin ? 1 : 0];',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    out.push(parts.g[at] | (parts.p[at] & out[at]));',
        '  }',
        '  return out;',
        '}',
        '',
        'function add(a, b, cin, width) {',
        '  const parts = signals(a, b, width);',
        '  const chain = carries(a, b, cin, width);',
        '  let sum = 0;',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    sum += (parts.p[at] ^ chain[at]) << at;',
        '  }',
        '  return { sum: sum, cout: chain[width] };',
        '}',
        '',
        'function lab() {',
        '  return { carries: carries, add: add };',
        '}'
      ].join('\n'),
      solution: [
        '/* Generate and propagate depend only on the operands, so every position',
        '   computes them at once — which is what makes the carry recurrence a',
        '   prefix scan rather than a chain. Propagate must be XOR: a position',
        '   where both operands are 1 generates, it does not pass one through,',
        '   and the sum bit reads this signal directly. */',
        'function signals(a, b, width) {',
        '  const g = [];',
        '  const p = [];',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    const ai = (a >> at) & 1;',
        '    const bi = (b >> at) & 1;',
        '',
        '    g.push(ai & bi);',
        '    p.push(ai ^ bi);',
        '  }',
        '  return { g: g, p: p };',
        '}',
        '',
        'function carries(a, b, cin, width) {',
        '  const parts = signals(a, b, width);',
        '  const out = [cin ? 1 : 0];',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    out.push(parts.g[at] | (parts.p[at] & out[at]));',
        '  }',
        '  return out;',
        '}',
        '',
        'function add(a, b, cin, width) {',
        '  const parts = signals(a, b, width);',
        '  const chain = carries(a, b, cin, width);',
        '  let sum = 0;',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    sum += (parts.p[at] ^ chain[at]) << at;',
        '  }',
        '  return { sum: sum, cout: chain[width] };',
        '}',
        '',
        'function lab() {',
        '  return { carries: carries, add: add };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every 4-bit addition agrees with integer arithmetic',
          assert: function (lab, api) {
            const parts = lab();

            for (let a = 0; a < 16; a += 1) {
              for (let b = 0; b < 16; b += 1) {
                for (let cin = 0; cin < 2; cin += 1) {
                  const got = parts.add(a, b, cin, 4);
                  const want = a + b + cin;

                  api.assert.equal(got.sum + 16 * got.cout, want,
                    a + ' + ' + b + ' + ' + cin);
                }
              }
            }
          }
        },
        {
          name: 'the carry chain is what makes a ripple adder slow',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.deepEqual(parts.carries(255, 1, 0, 8), [0, 1, 1, 1, 1, 1, 1, 1, 1],
              'all-ones plus one propagates a carry through every position');
            api.assert.deepEqual(parts.carries(0, 0, 0, 8), [0, 0, 0, 0, 0, 0, 0, 0, 0],
              'and operands that generate nothing settle immediately');
            api.assert.deepEqual(parts.add(255, 1, 0, 8), { sum: 0, cout: 1 },
              '255 + 1 wraps to 0 with a carry out');
          }
        }
      ]
    }],
    'arithmetic-logic-unit': [{
      id: 'alu-flags',
      title: 'Four flags, and the difference between carry and overflow',
      prompt: 'Write lab() returning { alu }. alu(a, b, op, width) computes op 0 = add, '
        + '1 = subtract, 2 = and, 3 = xor over unsigned inputs of the given width, and returns '
        + '{ value, zero, negative, carry, overflow }. Carry is set when the UNSIGNED result '
        + 'did not fit; overflow when the SIGNED result did not — that is, when the operands '
        + '(after inverting b for a subtract) had the same sign and the result has a different '
        + 'one. Both must be 0 for the logic operations, whatever the adder alongside would '
        + 'have produced. The starter reports the carry out as overflow, which is the single '
        + 'most common signed-versus-unsigned confusion there is.',
      entry: 'lab',
      starter: [
        'function alu(a, b, op, width) {',
        '  const limit = Math.pow(2, width) - 1;',
        '  const half = Math.pow(2, width - 1);',
        '',
        '  if (op === 2 || op === 3) {',
        '    const value = (op === 2 ? (a & b) : (a ^ b)) & limit;',
        '',
        '    return { value: value, zero: value === 0 ? 1 : 0,',
        '      negative: (value >= half) ? 1 : 0, carry: 0, overflow: 0 };',
        '  }',
        '  const operand = op === 1 ? ((~b) & limit) : b;',
        '  const total = a + operand + (op === 1 ? 1 : 0);',
        '  const value = total & limit;',
        '  const carry = total > limit ? 1 : 0;',
        '',
        '  // Carry and overflow are the same event here, which is true for',
        '  // unsigned arithmetic and false for signed.',
        '  return { value: value, zero: value === 0 ? 1 : 0,',
        '    negative: (value >= half) ? 1 : 0, carry: carry, overflow: carry };',
        '}',
        '',
        'function lab() {',
        '  return { alu: alu };',
        '}'
      ].join('\n'),
      solution: [
        'function signed(value, width) {',
        '  const half = Math.pow(2, width - 1);',
        '',
        '  return value >= half ? value - Math.pow(2, width) : value;',
        '}',
        '',
        '/* Overflow is a statement about signs, not about the top carry:',
        '   two operands that agree in sign cannot legitimately produce a result',
        '   with the other sign. Carry answers the unsigned question instead,',
        '   and the two are set independently. */',
        'function overflowOf(a, operand, value, width) {',
        '  const sa = signed(a, width);',
        '  const sb = signed(operand, width);',
        '  const sr = signed(value, width);',
        '',
        '  if ((sa < 0) !== (sb < 0)) return 0;',
        '  return (sr < 0) !== (sa < 0) ? 1 : 0;',
        '}',
        '',
        'function alu(a, b, op, width) {',
        '  const limit = Math.pow(2, width) - 1;',
        '  const half = Math.pow(2, width - 1);',
        '',
        '  if (op === 2 || op === 3) {',
        '    const value = (op === 2 ? (a & b) : (a ^ b)) & limit;',
        '',
        '    return { value: value, zero: value === 0 ? 1 : 0,',
        '      negative: (value >= half) ? 1 : 0, carry: 0, overflow: 0 };',
        '  }',
        '  const operand = op === 1 ? ((~b) & limit) : b;',
        '  const total = a + operand + (op === 1 ? 1 : 0);',
        '  const value = total & limit;',
        '',
        '  return { value: value, zero: value === 0 ? 1 : 0,',
        '    negative: (value >= half) ? 1 : 0,',
        '    carry: total > limit ? 1 : 0,',
        '    overflow: overflowOf(a, operand, value, width) };',
        '}',
        '',
        'function lab() {',
        '  return { alu: alu };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'carry and overflow answer different questions at 8 bits',
          assert: function (lab, api) {
            const parts = lab();
            const wrap = parts.alu(255, 1, 0, 8);
            const over = parts.alu(127, 1, 0, 8);

            api.assert.equal(wrap.value, 0, '255 + 1 wraps to 0');
            api.assert.equal(wrap.carry, 1, 'the unsigned result did not fit');
            api.assert.equal(wrap.overflow, 0, 'but as signed values −1 + 1 = 0 is correct');
            api.assert.equal(wrap.zero, 1, 'and the zero flag is set');
            api.assert.equal(over.value, 128, '127 + 1 is 128');
            api.assert.equal(over.overflow, 1, 'the signed result did not fit');
            api.assert.equal(over.carry, 0, 'and the unsigned result did');
          }
        },
        {
          name: 'subtraction reuses the adder, and the logic operations force the flags',
          assert: function (lab, api) {
            const parts = lab();
            const borrow = parts.alu(0, 1, 1, 8);
            const same = parts.alu(42, 42, 1, 8);
            const anded = parts.alu(255, 129, 2, 8);

            api.assert.equal(borrow.value, 255, '0 − 1 is all ones');
            api.assert.equal(borrow.carry, 0, 'a clear carry after a subtract is a borrow');
            api.assert.equal(same.value, 0, 'equal operands subtract to zero');
            api.assert.equal(same.zero, 1, 'which is what a compare instruction reads');
            api.assert.equal(anded.value, 129, '255 AND 129 is 129');
            api.assert.equal(anded.carry, 0, 'carry is forced low for a logic operation');
            api.assert.equal(anded.overflow, 0, 'and so is overflow');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
