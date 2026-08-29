'use strict';

/**
 * Every figure the M33.4-M33.5 content quotes, recomputed from the adder, the
 * multiplier and the ALU, and then checked against the prose.
 *
 * The ALU rows are checked against `Blocks.Alu.reference` here for the same
 * reason the section checks them there: the reference is written from the
 * definitions of the operations and the flags, so agreeing with it means
 * something.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Adder = require('../../src/js/machines/blocks/adder.js');
const Alu = require('../../src/js/machines/blocks/alu.js');

require('../../src/js/content/concepts-logic-arithmetic.js');
require('../../src/js/content/examples-logic-arithmetic.js');
const prose = require('../support/worked-example-prose.js');

function measure(net) {
  return { gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
    depth: Sim.criticalPath(net).delay };
}

function operands(a, b, carry, width) {
  const values = {};

  for (let at = 0; at < width; at += 1) {
    values['a' + at] = (a >> at) & 1;
    values['b' + at] = (b >> at) & 1;
  }
  values.cin = carry ? 1 : 0;
  return values;
}

function sumOf(net, a, b, carry, width) {
  const out = Sim.outputsOf(net, Sim.evaluate(net, operands(a, b, carry, width)));
  let total = 0;

  for (let at = 0; at < width; at += 1) total += (out['s' + at] ? 1 : 0) << at;
  return total + (out.cout ? 1 : 0) * Math.pow(2, width);
}

test('adders: three structures at three widths', function () {
  const rows = [4, 8, 16].map(function (width) {
    return { width: width,
      ripple: measure(Adder.rippleCarry({ width: width })),
      lookahead: measure(Adder.carryLookahead({ width: width })),
      select: measure(Adder.carrySelect({ width: width })) };
  });
  const pick = function (kind, field) {
    return rows.map(function (row) { return row[kind][field]; });
  };

  assert.deepStrictEqual(pick('ripple', 'gates'), [20, 40, 80], 'ripple gates');
  assert.deepStrictEqual(pick('ripple', 'depth'), [19, 35, 67], 'ripple depths');
  assert.deepStrictEqual(pick('lookahead', 'gates'), [42, 180, 1000], 'lookahead gates');
  assert.deepStrictEqual(pick('lookahead', 'depth'), [16, 26, 44], 'lookahead depths');
  assert.deepStrictEqual(pick('select', 'gates'), [33, 65, 129], 'carry-select gates');
  assert.deepStrictEqual(pick('select', 'depth'), [14, 22, 38], 'carry-select depths');
  assert.strictEqual(rows[1].ripple.transistors, 336, 'the 8-bit ripple adder in transistors');
  assert.strictEqual((1000 / 80).toFixed(1), '12.5', 'the lookahead gate ratio at 16 bits');

  prose.quotes('arithmetic-circuits',
    ['ripple 20 gates at depth 19; lookahead 42 at 16; select 33 at 14',
      'ripple 40 at 35; lookahead 180 at 26; select 65 at 22',
      'ripple 80 at 67; lookahead 1 000 at 44; select 129 at 38',
      '20, 40 and 80 gates at depths 19, 35 and 67',
      '42, 180 and 1 000 gates',
      '129 gates at depth 38 where lookahead needs 1 000 for depth 44']);
});

test('adders: every 4-bit sum is right, and the 8-bit worst case is measured', function () {
  const four = Adder.rippleCarry({ width: 4 });
  const eight = Adder.rippleCarry({ width: 8 });
  let checked = 0;

  for (let a = 0; a < 16; a += 1) {
    for (let b = 0; b < 16; b += 1) {
      for (let cin = 0; cin < 2; cin += 1) {
        assert.strictEqual(sumOf(four, a, b, cin, 4), a + b + cin, a + '+' + b + '+' + cin);
        checked += 1;
      }
    }
  }
  assert.strictEqual(checked, 512, 'which is the whole input space at 4 bits');

  const worst = Sim.transition(eight, operands(0, 0, false, 8), operands(255, 1, false, 8), {});

  assert.strictEqual(worst.settleTime, 32, 'the measured worst-case settling time');
  assert.strictEqual(Sim.criticalPath(eight).delay, 35, 'against a structural path of 35');

  prose.quotes('arithmetic-circuits',
    ['2^9 = 512 vectors is the whole space',
      'settles after 32 gate delays; the structural critical path is 35',
      'critical path of 35 gate delays and settles in 32']);
});

test('multipliers: quadratic gates, linear depth, and every product checked', function () {
  const rows = [2, 3, 4].map(function (width) {
    const net = Adder.arrayMultiplier({ width: width });
    const limit = Math.pow(2, width);
    let products = 0;

    for (let a = 0; a < limit; a += 1) {
      for (let b = 0; b < limit; b += 1) {
        const out = Sim.outputsOf(net, Sim.evaluate(net, operands(a, b, false, width)));
        let got = 0;

        for (let at = 0; at < 2 * width; at += 1) got += (out['p' + at] ? 1 : 0) << at;
        assert.strictEqual(got, a * b, width + '-bit: ' + a + ' x ' + b);
        products += 1;
      }
    }
    return { width: width, gates: Sim.gateCount(net),
      depth: Sim.criticalPath(net).delay, products: products };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.gates; }), [14, 39, 76], 'gates');
  assert.deepStrictEqual(rows.map(function (row) { return row.depth; }), [13, 27, 41], 'depths');
  assert.deepStrictEqual(rows.map(function (row) { return row.products; }), [16, 64, 256],
    'products checked');

  const adder = measure(Adder.rippleCarry({ width: 4 }));

  assert.strictEqual((76 / adder.gates).toFixed(1), '3.8', 'gates against a 4-bit adder');
  assert.strictEqual((41 / adder.depth).toFixed(2), '2.16', 'and depth against it');

  prose.quotes('arithmetic-circuits',
    ['14 gates at depth 13, exact on all 16 products',
      '39 gates at depth 27, exact on all 64 products',
      '76 gates at depth 41, exact on all 256 products',
      '3.8 times the gates and 2.16 times the depth of the adder',
      '14, 39 and 76 gates at depths 13, 27 and 41']);
});

/* ------------------------------------------------------------------ ALU */

function aluInputs(a, b, op, width) {
  const values = {};

  for (let at = 0; at < width; at += 1) {
    values['a' + at] = (a >> at) & 1;
    values['b' + at] = (b >> at) & 1;
  }
  values.op0 = op & 1;
  values.op1 = (op >> 1) & 1;
  return values;
}

function aluRun(net, a, b, op, width) {
  const out = Sim.outputsOf(net, Sim.evaluate(net, aluInputs(a, b, op, width)));
  let value = 0;

  for (let at = 0; at < width; at += 1) value += (out['r' + at] ? 1 : 0) << at;
  return { value: value, zero: out.zero ? 1 : 0, negative: out.negative ? 1 : 0,
    carry: out.carry ? 1 : 0, overflow: out.overflow ? 1 : 0 };
}

function aluWant(a, b, op, width) {
  const model = Alu.reference(a, b, op, width);

  return Object.assign({ value: model.value },
    Alu.flagsOf(model.value, model.carry, model.overflow, width));
}

test('alu: what four operations and four flags cost on top of the adder', function () {
  const alu = measure(Alu.alu({ width: 8 }));
  const adder = measure(Adder.rippleCarry({ width: 8 }));

  assert.strictEqual(alu.gates, 92, 'the whole 8-bit ALU');
  assert.strictEqual(alu.transistors, 838, 'in transistors');
  assert.strictEqual(alu.depth, 47, 'and its critical path');
  assert.strictEqual(adder.gates, 40, 'the adder inside it');
  assert.strictEqual(adder.depth, 35, 'and its depth');
  assert.strictEqual(alu.gates - adder.gates, 52, 'the difference in gates');
  assert.strictEqual(alu.depth - adder.depth, 12, 'and in gate delays');
  assert.strictEqual(8 + 16 + 16 + 12 + adder.gates, alu.gates,
    'the per-part breakdown adds up to the measured total');
  assert.strictEqual(Math.round(100 * adder.gates / alu.gates), 43, 'the adder is 43%');

  prose.quotes('arithmetic-logic-unit',
    ['92 gates, 838 transistors, critical path 47 gate delays',
      '40 gates at depth 35 — 43% of the ALU’s gates'.replace('’', '\''),
      'inversion 8, logic paths 16, result muxes 16, flags 12 — 92 in total',
      '52 extra gates and 12 extra gate delays']);
});

test('alu: the corner cases, and the exhaustive check at four bits', function () {
  const net = Alu.alu({ width: 8 });
  const wrap = aluRun(net, 255, 1, 0, 8);
  const over = aluRun(net, 127, 1, 0, 8);
  const borrow = aluRun(net, 0, 1, 1, 8);
  const most = aluRun(net, 0, 128, 1, 8);

  assert.deepStrictEqual([wrap.value, wrap.zero, wrap.carry, wrap.overflow], [0, 1, 1, 0],
    '255 + 1 sets carry and zero, not overflow');
  assert.deepStrictEqual([over.value, over.negative, over.carry, over.overflow],
    [128, 1, 0, 1], '127 + 1 sets overflow and negative, not carry');
  assert.deepStrictEqual([borrow.value, borrow.negative, borrow.carry], [255, 1, 0],
    '0 - 1 leaves the carry clear, which is the borrow convention');
  assert.deepStrictEqual([most.value, most.overflow], [128, 1],
    'negating the most negative value overflows');
  [wrap, over, borrow, most].forEach(function (row, at) {
    const cases = [[255, 1, 0], [127, 1, 0], [0, 1, 1], [0, 128, 1]][at];

    assert.deepStrictEqual(row, aluWant(cases[0], cases[1], cases[2], 8),
      'and the reference agrees, flag for flag');
  });

  const small = Alu.alu({ width: 4 });
  let checked = 0;

  for (let a = 0; a < 16; a += 1) {
    for (let b = 0; b < 16; b += 1) {
      for (let op = 0; op < 4; op += 1) {
        assert.deepStrictEqual(aluRun(small, a, b, op, 4), aluWant(a, b, op, 4),
          a + ' op' + op + ' ' + b);
        checked += 1;
      }
    }
  }
  assert.strictEqual(checked, 1024, 'every combination of operands and operation');
  assert.strictEqual(Math.pow(2, 8) * Math.pow(2, 8) * 4, 262144, 'the 8-bit space');

  prose.quotes('arithmetic-logic-unit',
    ['result 0, flags zero and carry', 'result 128, flags negative and overflow — carry is clear',
      'result 255, flag negative only — the carry flag is CLEAR after a borrow',
      'all 1 024 combinations of operands and operation agree, flag for flag',
      'sampled 300 times with a stated seed']);
});
