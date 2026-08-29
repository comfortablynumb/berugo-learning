/**
 * The ALU, and the four flags every conditional branch in M34 will read.
 *
 * One adder, a few logic gates, and a multiplexer that chooses which result
 * leaves. Subtraction is the same adder with the second operand inverted and
 * a carry forced in, which is two's complement doing its job - and it is why
 * `sub` and `cmp` cost exactly what `add` costs.
 *
 * The flags are where the teaching is, because two of them mean different
 * things for signed and unsigned operands and every "why does my comparison
 * behave oddly at the boundary" question resolves to which one the branch
 * read:
 *
 * - **zero** - every result bit is 0.
 * - **negative** - the top result bit, which is only a sign if you meant the
 *   operands to be signed.
 * - **carry** - a carry out of the top bit. For UNSIGNED arithmetic this is
 *   the overflow flag.
 * - **overflow** - the carry into the top bit differs from the carry out of
 *   it. For SIGNED arithmetic this is the overflow flag, and it is a
 *   different signal from carry.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.Alu = api;
  }
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Select = root && root.Blocks && root.Blocks.Select
    ? root.Blocks.Select : require('./select.js');

  /** op is two bits: 00 add, 01 subtract, 10 and, 11 xor. */
  const OPERATIONS = [
    { code: 0, name: 'add', about: 'a + b' },
    { code: 1, name: 'subtract', about: 'a - b, by inverting b and forcing a carry in' },
    { code: 2, name: 'and', about: 'bitwise and' },
    { code: 3, name: 'xor', about: 'bitwise exclusive or' }
  ];

  function operandBits(net, width) {
    const a = [];
    const b = [];

    for (let at = 0; at < width; at += 1) a.push(Sim.addInput(net, 'a' + at));
    for (let at = 0; at < width; at += 1) b.push(Sim.addInput(net, 'b' + at));
    return { a: a, b: b };
  }

  /**
   * The adder path, with the second operand conditionally inverted. `op0` is
   * both the invert control and the carry in, which is the whole trick: b
   * inverted plus one is minus b.
   */
  function adderPath(net, ports, op0, width) {
    const sums = [];
    let carry = op0;
    let intoTop = null;

    for (let at = 0; at < width; at += 1) {
      const operand = Sim.addGate(net, 'xor', [ports.b[at], op0]);
      const half = Sim.addGate(net, 'xor', [ports.a[at], operand]);
      const sum = Sim.addGate(net, 'xor', [half, carry]);
      const both = Sim.addGate(net, 'and', [ports.a[at], operand]);
      const through = Sim.addGate(net, 'and', [half, carry]);

      if (at === width - 1) intoTop = carry;
      sums.push(sum);
      carry = Sim.addGate(net, 'or', [both, through]);
    }
    return { sums: sums, carry: carry, intoTop: intoTop };
  }

  function logicPaths(net, ports, width) {
    const ands = [];
    const xors = [];

    for (let at = 0; at < width; at += 1) {
      ands.push(Sim.addGate(net, 'and', [ports.a[at], ports.b[at]]));
      xors.push(Sim.addGate(net, 'xor', [ports.a[at], ports.b[at]]));
    }
    return { ands: ands, xors: xors };
  }

  /**
   * Build the ALU. The result multiplexer is per bit: two 2:1 multiplexers
   * and a third choosing between the arithmetic and logic halves, which is
   * where the operation select spends its delay.
   */
  function alu(options) {
    const settings = options || {};
    const width = settings.width || 8;
    const net = Sim.create(width + '-bit ALU');
    const ports = operandBits(net, width);
    const op0 = Sim.addInput(net, 'op0');
    const op1 = Sim.addInput(net, 'op1');
    const arithmetic = adderPath(net, ports, op0, width);
    const logic = logicPaths(net, ports, width);
    const results = [];

    for (let at = 0; at < width; at += 1) {
      const logical = Select.mux2(net, logic.ands[at], logic.xors[at], op0);

      results.push(Select.mux2(net, arithmetic.sums[at], logical, op1));
    }
    results.forEach(function (id, at) { Sim.addOutput(net, 'r' + at, id); });
    addFlags(net, results, arithmetic, op1, width);
    return net;
  }

  function addFlags(net, results, arithmetic, op1, width) {
    const anyBit = Select.orTree(net, results);

    Sim.addOutput(net, 'zero', Sim.addGate(net, 'not', [anyBit]));
    Sim.addOutput(net, 'negative', results[width - 1]);
    /* Carry and overflow are meaningless for the logic operations, so they
       are forced low there rather than left as whatever the adder happened to
       compute — a flag that is stale rather than wrong is worse. */
    const notLogic = Sim.addGate(net, 'not', [op1]);

    Sim.addOutput(net, 'carry', Sim.addGate(net, 'and', [arithmetic.carry, notLogic]));
    const differ = Sim.addGate(net, 'xor', [arithmetic.intoTop, arithmetic.carry]);

    Sim.addOutput(net, 'overflow', Sim.addGate(net, 'and', [differ, notLogic]));
  }

  /* ---------------------------------------------------------- reference */

  function mask(width) {
    return Math.pow(2, width) - 1;
  }

  function signed(value, width) {
    const half = Math.pow(2, width - 1);

    return value >= half ? value - Math.pow(2, width) : value;
  }

  /**
   * The behavioural model, written from the definitions rather than from the
   * circuit. Every gate-level result is checked against this over the whole
   * input space, which is what "verified" means for a block this size.
   */
  function reference(a, b, op, width) {
    const limit = mask(width);

    if (op === 2) return { value: a & b & limit, carry: 0, overflow: 0 };
    if (op === 3) return { value: (a ^ b) & limit, carry: 0, overflow: 0 };
    const operand = op === 1 ? (~b) & limit : b;
    const total = a + operand + (op === 1 ? 1 : 0);
    const value = total & limit;

    return { value: value, carry: total > limit ? 1 : 0,
      overflow: overflowOf(a, operand, value, width) };
  }

  /** Signed overflow: both operands had the same sign and the result does
   *  not. This is the definition the flag exists for. */
  function overflowOf(a, operand, value, width) {
    const sa = signed(a, width);
    const sb = signed(operand, width);
    const sr = signed(value, width);

    if ((sa < 0) !== (sb < 0)) return 0;
    return (sr < 0) !== (sa < 0) ? 1 : 0;
  }

  function flagsOf(value, carry, overflow, width) {
    return { zero: value === 0 ? 1 : 0,
      negative: (value >> (width - 1)) & 1,
      carry: carry, overflow: overflow };
  }

  return { OPERATIONS: OPERATIONS, alu: alu, reference: reference,
    flagsOf: flagsOf, signed: signed, overflowOf: overflowOf, mask: mask,
    adderPath: adderPath };
}));
