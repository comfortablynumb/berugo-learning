/**
 * TwoLevel - a sum-of-products cover, built as gates.
 *
 * A minimiser produces terms; this turns terms into a netlist, so that a cover
 * can be priced in gates, transistors and delay rather than in literals, and
 * so that the hazard a cover contains can be found by simulating it rather
 * than by reasoning about it.
 *
 * It lives in a module rather than inside a section for two reasons: the
 * timing section builds the same circuits the minimisation section does, and a
 * figure test can recompute a published gate count only if the code that
 * produced it is importable.
 *
 * Terms are strings of '0', '1' and '-', most significant bit first, matching
 * `algorithms/boolean-min.js`. A term of all dashes is the constant 1, which
 * is a legal cover and has to build.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.TwoLevel = api;
  }
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');

  /** A balanced-enough chain of two-input gates. Real libraries have no wide
   *  AND, so a term of five literals is four gates and the depth grows with
   *  it — which is why "one level of logic" is a fiction above fan-in two. */
  function tree(net, type, wires) {
    if (!wires.length) return Sim.addNode(net, 'const1', []);
    return wires.reduce(function (left, right) {
      return Sim.addGate(net, type, [left, right]);
    });
  }

  /** One product term. Inverters are shared across terms, because a real
   *  netlist inverts each input once. */
  function product(net, term, names, wires, inverters) {
    const literals = [];

    term.split('').forEach(function (ch, at) {
      const name = names[at];

      if (ch === '-') return;
      if (ch === '1') { literals.push(wires[name]); return; }
      if (inverters[name] === undefined) {
        inverters[name] = Sim.addGate(net, 'not', [wires[name]]);
      }
      literals.push(inverters[name]);
    });
    return tree(net, 'and', literals);
  }

  function netFor(terms, names) {
    const net = Sim.create('sum of products');
    const wires = {};
    const inverters = {};

    names.forEach(function (name) { wires[name] = Sim.addInput(net, name); });
    const products = terms.map(function (term) {
      return product(net, term, names, wires, inverters);
    });

    Sim.addOutput(net, 'y', tree(net, 'or', products));
    return net;
  }

  /** Input values for a minterm, keyed by name, with names[0] the most
   *  significant bit — the convention the minimiser uses. */
  function valuesOf(mask, names) {
    const bits = names.length;
    const values = {};

    names.forEach(function (name, at) {
      values[name] = (mask >> (bits - 1 - at)) & 1;
    });
    return values;
  }

  function literalsOf(terms) {
    return terms.reduce(function (sum, term) {
      return sum + term.split('').filter(function (ch) { return ch !== '-'; }).length;
    }, 0);
  }

  return { netFor: netFor, valuesOf: valuesOf, literalsOf: literalsOf, tree: tree };
}));
