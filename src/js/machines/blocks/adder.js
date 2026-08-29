/**
 * Adders, and the reason integer addition is one cycle.
 *
 * Three constructions of the same function, built from gates so the
 * comparison is a measurement:
 *
 * - **ripple-carry** is n full adders in a chain. Gate count is linear and so
 *   is the delay, because bit k cannot decide until bit k-1 has.
 * - **carry-lookahead** computes, for every bit, whether it GENERATES a carry
 *   on its own (a and b) and whether it would PROPAGATE one arriving from
 *   below (a xor b). Those two signals are available immediately, so the
 *   carries can be computed by a tree instead of a chain - more gates, less
 *   depth.
 * - **carry-select** computes both answers for the upper half, one assuming a
 *   carry in and one assuming none, and picks with a multiplexer when the
 *   real carry arrives. Roughly double the area of the upper half, roughly
 *   half the delay.
 *
 * The multiplier is here for the other half of the lesson: it is an array of
 * adders, its depth is the reason multiply costs several cycles, and division
 * by restoring subtraction is a chain of the same again - which is why the
 * latency tables in an optimisation manual look the way they do.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.Adder = api;
  }
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Select = root && root.Blocks && root.Blocks.Select
    ? root.Blocks.Select : require('./select.js');

  function operandInputs(net, width) {
    const a = [];
    const b = [];

    for (let at = 0; at < width; at += 1) a.push(Sim.addInput(net, 'a' + at));
    for (let at = 0; at < width; at += 1) b.push(Sim.addInput(net, 'b' + at));
    return { a: a, b: b, carry: Sim.addInput(net, 'cin') };
  }

  /** sum = a xor b xor cin; carry = ab + cin(a xor b). */
  function fullAdder(net, a, b, carry) {
    const half = Sim.addGate(net, 'xor', [a, b]);
    const sum = Sim.addGate(net, 'xor', [half, carry]);
    const both = Sim.addGate(net, 'and', [a, b]);
    const through = Sim.addGate(net, 'and', [half, carry]);

    return { sum: sum, carry: Sim.addGate(net, 'or', [both, through]) };
  }

  function emitSum(net, bits, carry) {
    bits.forEach(function (id, at) { Sim.addOutput(net, 's' + at, id); });
    Sim.addOutput(net, 'cout', carry);
  }

  /* ------------------------------------------------------- ripple carry */

  function rippleCarry(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const net = Sim.create(width + '-bit ripple-carry adder');
    const ports = operandInputs(net, width);
    const sums = [];
    let carry = ports.carry;

    for (let at = 0; at < width; at += 1) {
      const stage = fullAdder(net, ports.a[at], ports.b[at], carry);

      sums.push(stage.sum);
      carry = stage.carry;
    }
    emitSum(net, sums, carry);
    return net;
  }

  /* --------------------------------------------------- carry lookahead */

  /**
   * The lookahead itself: c1 = g0 + p0·c0, c2 = g1 + p1·g0 + p1·p0·c0, and so
   * on. Each carry is a two-level expression over signals that are all
   * available at once, so the depth stops growing with the width - at the
   * price of gates that grow quadratically, which is why real adders build
   * this in four-bit blocks and ripple between the blocks.
   */
  function lookaheadCarries(net, generate, propagate, carryIn) {
    const carries = [carryIn];

    for (let at = 0; at < generate.length; at += 1) {
      const terms = [generate[at]];

      for (let lower = at; lower >= 0; lower -= 1) {
        let term = lower === at ? propagate[at] : propagate[at];

        for (let inner = at - 1; inner >= lower; inner -= 1) {
          term = Sim.addGate(net, 'and', [term, inner === lower && lower === 0
            ? propagate[0] : propagate[inner]]);
        }
        terms.push(Sim.addGate(net, 'and', [term,
          lower === 0 ? carryIn : generate[lower - 1]]));
      }
      carries.push(Select.orTree(net, terms));
    }
    return carries;
  }

  function carryLookahead(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const net = Sim.create(width + '-bit carry-lookahead adder');
    const ports = operandInputs(net, width);
    const generate = [];
    const propagate = [];

    for (let at = 0; at < width; at += 1) {
      generate.push(Sim.addGate(net, 'and', [ports.a[at], ports.b[at]]));
      propagate.push(Sim.addGate(net, 'xor', [ports.a[at], ports.b[at]]));
    }
    const carries = lookaheadCarries(net, generate, propagate, ports.carry);
    const sums = propagate.map(function (id, at) {
      return Sim.addGate(net, 'xor', [id, carries[at]]);
    });

    emitSum(net, sums, carries[width]);
    return net;
  }

  /* ------------------------------------------------------ carry select */

  /**
   * The lower half ripples. The upper half is computed twice, in parallel,
   * for both possible incoming carries, and a multiplexer picks when the
   * truth arrives. The delay is the lower half plus one multiplexer.
   */
  function carrySelect(options) {
    const settings = options || {};
    const width = settings.width || 8;
    const half = Math.floor(width / 2);
    const net = Sim.create(width + '-bit carry-select adder');
    const ports = operandInputs(net, width);
    const lower = rippleInto(net, ports, 0, half, ports.carry);
    const zero = Sim.addNode(net, 'const0', []);
    const one = Sim.addNode(net, 'const1', []);
    const ifZero = rippleInto(net, ports, half, width, zero);
    const ifOne = rippleInto(net, ports, half, width, one);
    const sums = lower.sums.concat(ifZero.sums.map(function (id, at) {
      return Select.mux2(net, id, ifOne.sums[at], lower.carry);
    }));

    emitSum(net, sums, Select.mux2(net, ifZero.carry, ifOne.carry, lower.carry));
    return net;
  }

  function rippleInto(net, ports, from, to, carryIn) {
    const sums = [];
    let carry = carryIn;

    for (let at = from; at < to; at += 1) {
      const stage = fullAdder(net, ports.a[at], ports.b[at], carry);

      sums.push(stage.sum);
      carry = stage.carry;
    }
    return { sums: sums, carry: carry };
  }

  /* -------------------------------------------------------- multiplier */

  /**
   * An unsigned array multiplier: one AND per partial-product bit, then a
   * ripple of adders down the array. The gate count is quadratic in the width
   * and the depth is linear, which is the whole answer to "why is multiply
   * slower than add".
   */
  function arrayMultiplier(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const net = Sim.create(width + '-bit array multiplier');
    const a = [];
    const b = [];

    for (let at = 0; at < width; at += 1) a.push(Sim.addInput(net, 'a' + at));
    for (let at = 0; at < width; at += 1) b.push(Sim.addInput(net, 'b' + at));
    const rows = partialProducts(net, a, b, width);
    const product = accumulate(net, rows, width);

    product.forEach(function (id, at) { Sim.addOutput(net, 'p' + at, id); });
    return net;
  }

  function partialProducts(net, a, b, width) {
    const rows = [];

    for (let row = 0; row < width; row += 1) {
      const bits = [];

      for (let col = 0; col < width; col += 1) {
        bits.push(Sim.addGate(net, 'and', [a[col], b[row]]));
      }
      rows.push(bits);
    }
    return rows;
  }

  function accumulate(net, rows, width) {
    const zero = Sim.addNode(net, 'const0', []);
    let running = rows[0].concat([zero]);

    for (let row = 1; row < width; row += 1) {
      running = addShifted(net, running, rows[row], row, zero);
    }
    return running.slice(0, width * 2);
  }

  /** Add one partial-product row, shifted left by `row` bits, to the running
   *  total — which is exactly what long multiplication does on paper. */
  function addShifted(net, running, bits, row, zero) {
    const out = running.slice(0, row);
    let carry = zero;

    for (let at = 0; at < bits.length; at += 1) {
      const left = running[row + at] === undefined ? zero : running[row + at];
      const stage = fullAdder(net, left, bits[at], carry);

      out.push(stage.sum);
      carry = stage.carry;
    }
    out.push(carry);
    return out;
  }

  return { fullAdder: fullAdder, rippleCarry: rippleCarry,
    carryLookahead: carryLookahead, carrySelect: carrySelect,
    arrayMultiplier: arrayMultiplier, operandInputs: operandInputs,
    rippleInto: rippleInto };
}));
