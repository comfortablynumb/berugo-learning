/**
 * BlockModels - behavioural models of the combinational blocks.
 *
 * These exist to be the independent judge. Each one says what a block should
 * compute, in arithmetic rather than in gates, and `Hdl.equivalent` drives
 * every input vector through both. A netlist checked against itself proves
 * nothing; a netlist checked against a model written from the specification is
 * the whole of combinational verification, and for blocks this small it is
 * exhaustive rather than sampled.
 *
 * The bit ordering is the netlist's: port `d0` is the least significant bit,
 * so `valueOf(values, 'd', 4)` reads d0..d3 as a binary number with d0 at the
 * bottom. Getting that backwards produces a model that disagrees with a
 * correct circuit, which is a good reason to have exactly one place that does
 * it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.Models = api;
  }
}(this, function () {
  'use strict';

  function valueOf(values, prefix, width) {
    let total = 0;

    for (let at = 0; at < width; at += 1) {
      total += (values[prefix + at] ? 1 : 0) << at;
    }
    return total;
  }

  function bitsOut(prefix, value, width) {
    const out = {};

    for (let at = 0; at < width; at += 1) out[prefix + at] = (value >> at) & 1;
    return out;
  }

  function multiplexer(bits) {
    return function (values) {
      return { y: values['d' + valueOf(values, 's', bits)] ? 1 : 0 };
    };
  }

  function decoder(bits) {
    const width = Math.pow(2, bits);

    return function (values) {
      const chosen = valueOf(values, 'a', bits);
      const out = {};

      for (let at = 0; at < width; at += 1) out['y' + at] = at === chosen ? 1 : 0;
      return out;
    };
  }

  /** The index of the highest set input, and a valid flag. When nothing is
   *  set the index outputs are 0, which is why the flag has to exist. */
  function priorityEncoder(bits) {
    const width = Math.pow(2, bits);

    return function (values) {
      let winner = -1;

      for (let at = 0; at < width; at += 1) if (values['d' + at]) winner = at;
      const out = bitsOut('y', winner < 0 ? 0 : winner, bits);

      out.valid = winner < 0 ? 0 : 1;
      return out;
    };
  }

  function comparator(width) {
    return function (values) {
      const left = valueOf(values, 'a', width);
      const right = valueOf(values, 'b', width);

      return { eq: left === right ? 1 : 0, lt: left < right ? 1 : 0 };
    };
  }

  /** Shift left by the amount on the `s` bus, filling with zeros or rotating.
   *  Written as arithmetic on the whole word rather than per bit, so it shares
   *  no structure at all with the multiplexer stages it is judging. */
  function barrelShifter(width, rotate) {
    const stages = Math.log2(width);
    const mask = Math.pow(2, width) - 1;

    return function (values) {
      const word = valueOf(values, 'd', width);
      const by = valueOf(values, 's', stages);
      const shifted = (word << by) & mask;
      const wrapped = rotate ? (word >> (width - by)) & mask : 0;

      return bitsOut('y', by === 0 ? word : (shifted | wrapped), width);
    };
  }

  function modelFor(kind, options) {
    const settings = options || {};
    const bits = settings.bits || 2;

    if (kind === 'muxTree' || kind === 'muxFlat') return multiplexer(bits);
    if (kind === 'decoder') return decoder(bits);
    if (kind === 'priorityEncoder') return priorityEncoder(bits);
    if (kind === 'comparator') return comparator(settings.width || 4);
    return barrelShifter(settings.width || 8, settings.rotate);
  }

  return { modelFor: modelFor, valueOf: valueOf, bitsOut: bitsOut,
    multiplexer: multiplexer, decoder: decoder, priorityEncoder: priorityEncoder,
    comparator: comparator, barrelShifter: barrelShifter };
}));
