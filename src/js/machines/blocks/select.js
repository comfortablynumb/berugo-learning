/**
 * Combinational building blocks, built from gates rather than described.
 *
 * Every block here returns a netlist the simulator in `logic-sim.js` runs, so
 * "a 4:1 multiplexer costs three 2:1 multiplexers" is a gate count this file
 * produces rather than a claim it makes. That is the point of the milestone:
 * an instruction's cost is a gate count and a gate depth, and both are
 * measurable once the circuit is data.
 *
 * The two constructions worth comparing are in here on purpose. A barrel
 * shifter built as a log-depth network of multiplexer stages has depth
 * log2(n) and a shifter built as "one multiplexer per possible distance" has
 * depth 1 and enormous width - the same trade the sections keep returning to,
 * and the reason a variable shift is one cycle on a modern CPU.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Blocks = scope.Blocks || {};
    scope.Blocks.Select = api;
  }
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');

  function inputsNamed(net, names) {
    const map = {};

    names.forEach(function (name) { map[name] = Sim.addInput(net, name); });
    return map;
  }

  function busNames(prefix, width) {
    const names = [];

    for (let at = 0; at < width; at += 1) names.push(prefix + at);
    return names;
  }

  /* ------------------------------------------------------- multiplexers */

  /** One 2:1 multiplexer as a single mux primitive: cheap to read, and the
   *  gate-level version below is what it costs in reality. */
  function mux2(net, low, high, select) {
    return Sim.addGate(net, 'mux', [low, high, select]);
  }

  /** The same thing from AND/OR/NOT, which is what a standard cell actually
   *  contains and what makes the delay comparison honest. */
  function mux2Gates(net, low, high, select) {
    const notSelect = Sim.addGate(net, 'not', [select]);
    const left = Sim.addGate(net, 'and', [low, notSelect]);
    const right = Sim.addGate(net, 'and', [high, select]);

    return Sim.addGate(net, 'or', [left, right]);
  }

  /**
   * A 2^k : 1 multiplexer as a TREE of 2:1 multiplexers: the least
   * significant select bit chooses within each pair, the next bit chooses
   * between pairs, and so on. Depth is k, which is what makes wide selects
   * affordable.
   */
  function muxTree(options) {
    const settings = options || {};
    const bits = settings.bits || 2;
    const width = Math.pow(2, bits);
    const net = Sim.create(width + ':1 multiplexer, tree of 2:1');
    const data = inputsNamed(net, busNames('d', width));
    const select = inputsNamed(net, busNames('s', bits));
    let level = busNames('d', width).map(function (name) { return data[name]; });

    for (let at = 0; at < bits; at += 1) {
      const next = [];

      for (let pair = 0; pair < level.length; pair += 2) {
        next.push(mux2(net, level[pair], level[pair + 1], select['s' + at]));
      }
      level = next;
    }
    Sim.addOutput(net, 'y', level[0]);
    return net;
  }

  /**
   * The same function as one level of AND terms: each data input is gated by
   * the decoded select value and the results are ORed. Depth is constant and
   * the gate count is far larger - the flat-versus-tree trade in its simplest
   * form.
   */
  function muxFlat(options) {
    const settings = options || {};
    const bits = settings.bits || 2;
    const width = Math.pow(2, bits);
    const net = Sim.create(width + ':1 multiplexer, one level');
    const data = inputsNamed(net, busNames('d', width));
    const select = inputsNamed(net, busNames('s', bits));
    const inverted = busNames('s', bits).map(function (name) {
      return Sim.addGate(net, 'not', [select[name]]);
    });
    const terms = [];

    for (let value = 0; value < width; value += 1) {
      terms.push(gatedInput(net, data['d' + value], value, bits, select, inverted));
    }
    Sim.addOutput(net, 'y', orTree(net, terms));
    return net;
  }

  function gatedInput(net, source, value, bits, select, inverted) {
    let node = source;

    for (let at = 0; at < bits; at += 1) {
      const line = (value >> at) & 1 ? select['s' + at] : inverted[at];

      node = Sim.addGate(net, 'and', [node, line]);
    }
    return node;
  }

  function orTree(net, nodes) {
    let level = nodes.slice();

    while (level.length > 1) {
      const next = [];

      for (let at = 0; at < level.length; at += 2) {
        next.push(at + 1 < level.length
          ? Sim.addGate(net, 'or', [level[at], level[at + 1]]) : level[at]);
      }
      level = next;
    }
    return level[0];
  }

  /* ----------------------------------------------------------- decoders */

  /** k inputs to 2^k outputs, exactly one of which is high. This is the row
   *  decoder every memory array in 33.8 is built around. */
  function decoder(options) {
    const settings = options || {};
    const bits = settings.bits || 2;
    const net = Sim.create('1 of ' + Math.pow(2, bits) + ' decoder');
    const select = inputsNamed(net, busNames('a', bits));
    const inverted = busNames('a', bits).map(function (name) {
      return Sim.addGate(net, 'not', [select[name]]);
    });

    for (let value = 0; value < Math.pow(2, bits); value += 1) {
      let node = null;

      for (let at = 0; at < bits; at += 1) {
        const line = (value >> at) & 1 ? select['a' + at] : inverted[at];

        node = node === null ? line : Sim.addGate(net, 'and', [node, line]);
      }
      Sim.addOutput(net, 'y' + value, node);
    }
    return net;
  }

  /**
   * A priority encoder: the index of the highest set input, plus a valid
   * flag. The priority chain is what makes it more than an encoder, and the
   * chain is the critical path.
   */
  function priorityEncoder(options) {
    const settings = options || {};
    const bits = settings.bits || 2;
    const width = Math.pow(2, bits);
    const net = Sim.create(width + ' input priority encoder');
    const data = inputsNamed(net, busNames('d', width));
    const higher = [];
    let seen = null;

    for (let at = width - 1; at >= 0; at -= 1) {
      const source = data['d' + at];

      higher[at] = seen === null ? null : seen;
      seen = seen === null ? source : Sim.addGate(net, 'or', [seen, source]);
    }
    encodeOutputs(net, data, higher, bits, width);
    Sim.addOutput(net, 'valid', seen);
    return net;
  }

  function encodeOutputs(net, data, higher, bits, width) {
    for (let bit = 0; bit < bits; bit += 1) {
      const terms = [];

      for (let at = 0; at < width; at += 1) {
        if (!((at >> bit) & 1)) continue;
        terms.push(winnerAt(net, data['d' + at], higher[at]));
      }
      Sim.addOutput(net, 'y' + bit, terms.length ? orTree(net, terms)
        : Sim.addNode(net, 'const0', []));
    }
  }

  /** Input `at` wins when it is high and nothing above it is. */
  function winnerAt(net, source, above) {
    if (above === null || above === undefined) return source;
    const blocked = Sim.addGate(net, 'not', [above]);

    return Sim.addGate(net, 'and', [source, blocked]);
  }

  /* ---------------------------------------------------------- comparison */

  /** Equality is a tree of XNORs; magnitude needs a chain, which is why an
   *  unsigned compare and a subtract cost about the same. */
  function comparator(options) {
    const settings = options || {};
    const width = settings.width || 4;
    const net = Sim.create(width + '-bit comparator');
    const left = inputsNamed(net, busNames('a', width));
    const right = inputsNamed(net, busNames('b', width));
    const same = [];

    for (let at = 0; at < width; at += 1) {
      same.push(Sim.addGate(net, 'xnor', [left['a' + at], right['b' + at]]));
    }
    Sim.addOutput(net, 'eq', andTree(net, same));
    Sim.addOutput(net, 'lt', lessThan(net, left, right, same, width));
    return net;
  }

  function andTree(net, nodes) {
    let level = nodes.slice();

    while (level.length > 1) {
      const next = [];

      for (let at = 0; at < level.length; at += 2) {
        next.push(at + 1 < level.length
          ? Sim.addGate(net, 'and', [level[at], level[at + 1]]) : level[at]);
      }
      level = next;
    }
    return level[0];
  }

  /** a < b when at the most significant differing bit, a has 0 and b has 1. */
  function lessThan(net, left, right, same, width) {
    const terms = [];

    for (let at = width - 1; at >= 0; at -= 1) {
      const notA = Sim.addGate(net, 'not', [left['a' + at]]);
      let term = Sim.addGate(net, 'and', [notA, right['b' + at]]);

      for (let above = at + 1; above < width; above += 1) {
        term = Sim.addGate(net, 'and', [term, same[above]]);
      }
      terms.push(term);
    }
    return orTree(net, terms);
  }

  /* ------------------------------------------------------ barrel shifter */

  /**
   * A logarithmic barrel shifter: one multiplexer stage per bit of the shift
   * amount, each stage shifting by a power of two. Depth is log2(width) mux
   * delays whatever the shift distance, which is why a variable shift is a
   * single cycle.
   */
  function barrelShifter(options) {
    const settings = options || {};
    const width = settings.width || 8;
    const stages = Math.log2(width);
    const net = Sim.create(width + '-bit barrel shifter');
    const data = inputsNamed(net, busNames('d', width));
    const amount = inputsNamed(net, busNames('s', stages));
    const zero = Sim.addNode(net, 'const0', []);
    let level = busNames('d', width).map(function (name) { return data[name]; });

    for (let stage = 0; stage < stages; stage += 1) {
      level = shiftStage(net, level, Math.pow(2, stage), amount['s' + stage],
        { zero: zero, rotate: settings.rotate });
    }
    level.forEach(function (id, at) { Sim.addOutput(net, 'y' + at, id); });
    return net;
  }

  function shiftStage(net, level, distance, control, options) {
    return level.map(function (id, at) {
      const from = at - distance;
      const source = from >= 0 ? level[from]
        : (options.rotate ? level[(from + level.length) % level.length] : options.zero);

      return mux2(net, id, source, control);
    });
  }

  return { mux2: mux2, mux2Gates: mux2Gates, muxTree: muxTree, muxFlat: muxFlat,
    decoder: decoder, priorityEncoder: priorityEncoder, comparator: comparator,
    barrelShifter: barrelShifter, orTree: orTree, andTree: andTree,
    busNames: busNames, inputsNamed: inputsNamed };
}));
