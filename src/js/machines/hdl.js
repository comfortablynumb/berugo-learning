/**
 * Hdl - describing hardware as data, and the verification that comes with it.
 *
 * A module is a name, a list of input and output ports, and a build function
 * that wires gates and other modules together. Nothing is drawn; the design is
 * a value, which is what makes it diffable, composable and testable - and it
 * is the whole reason hardware moved from schematics to languages.
 *
 * ELABORATION is the step people underestimate: a hierarchy of modules becomes
 * one flat netlist of gates, with the hierarchy surviving only in the labels.
 * Everything after that - simulation, timing, equivalence - works on the flat
 * netlist, which is why a bug in elaboration is a bug in everything.
 *
 * The verification side is where hardware differs from software and it is
 * worth stating plainly: the input space of a combinational block is FINITE,
 * so a testbench can be exhaustive rather than a sample. `equivalent` runs
 * every input vector against a behavioural model and reports the first
 * disagreement with the exact vector. Where the space is too large, the
 * report says how much of it was covered rather than implying it was all of
 * it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Hdl = api;
}(this, function (root) {
  'use strict';

  const Sim = root && root.LogicSim ? root.LogicSim : require('./logic-sim.js');

  /* ------------------------------------------------------------ the DSL */

  function library() {
    return { modules: {} };
  }

  /**
   * Define a module. `build(ctx, ports)` receives a context with `gate`,
   * `use` and `constant`, and the input port wires; it returns a map from
   * output port name to wire.
   */
  function define(lib, name, spec) {
    lib.modules[name] = { name: name, inputs: spec.inputs || [],
      outputs: spec.outputs || [], build: spec.build,
      about: spec.about || '' };
    return lib.modules[name];
  }

  function contextFor(lib, net, prefix) {
    return {
      gate: function (type, inputs, label) {
        return Sim.addGate(net, type, inputs, { label: prefix + (label || type) });
      },
      constant: function (value) {
        return Sim.addNode(net, value ? 'const1' : 'const0', []);
      },
      use: function (name, bindings, label) {
        return instantiate(lib, net, name, bindings, prefix + (label || name) + '.');
      },
      net: net
    };
  }

  /**
   * One instance: build the child's body into the SAME netlist, with its
   * labels prefixed. Flattening is not an optimisation here - a hierarchical
   * netlist would need every later pass to walk the hierarchy, and every later
   * pass would then have its own way of getting that wrong.
   */
  function instantiate(lib, net, name, bindings, prefix) {
    const spec = lib.modules[name];

    if (!spec) throw new Error('no module named ' + name);
    spec.inputs.forEach(function (port) {
      if (bindings[port] === undefined) {
        throw new Error(name + ': input port ' + port + ' is not connected');
      }
    });
    const outputs = spec.build(contextFor(lib, net, prefix), bindings) || {};

    spec.outputs.forEach(function (port) {
      if (outputs[port] === undefined) {
        throw new Error(name + ': output port ' + port + ' was never driven');
      }
    });
    return outputs;
  }

  /**
   * Elaborate a top-level module into a netlist: one primary input per input
   * port, the body built once, and the output ports named.
   */
  function elaborate(lib, name) {
    const spec = lib.modules[name];

    if (!spec) throw new Error('no module named ' + name);
    const net = Sim.create(name);
    const bindings = {};

    spec.inputs.forEach(function (port) { bindings[port] = Sim.addInput(net, port); });
    const outputs = spec.build(contextFor(lib, net, ''), bindings) || {};

    spec.outputs.forEach(function (port) {
      if (outputs[port] === undefined) {
        throw new Error(name + ': output port ' + port + ' was never driven');
      }
      Sim.addOutput(net, port, outputs[port]);
    });
    return net;
  }

  /* ------------------------------------------------------- the testbench */

  /**
   * Drive a list of input vectors and record what came out, with the waveform
   * of the last one. A testbench that only reported the final values would be
   * a truth table with extra steps; the history is what makes it a testbench.
   */
  function testbench(net, vectors, options) {
    const settings = options || {};
    const rows = vectors.map(function (values) {
      const run = Sim.simulate(net, values, { record: false });

      return { inputs: values, outputs: run.outputs, settleTime: run.settleTime,
        settled: run.settled };
    });
    const last = vectors.length
      ? Sim.transition(net, vectors[Math.max(0, vectors.length - 2)],
        vectors[vectors.length - 1], {})
      : null;

    return { rows: rows, waveform: last ? last.history : [],
      glitches: last ? last.outputGlitches : [],
      settled: rows.every(function (row) { return row.settled; }),
      vectors: vectors.length, limit: settings.limit };
  }

  /**
   * Exhaustive equivalence against a behavioural model, which for a
   * combinational block is available and is what hardware verification means.
   * The report carries the first failing vector, because "somewhere in here"
   * is not a bug report.
   */
  function equivalent(net, model, options) {
    const settings = options || {};
    const limit = settings.limit || 14;

    if (net.inputs.length > limit) {
      return { exhaustive: false, checked: 0, inputs: net.inputs.length,
        why: net.inputs.length + ' inputs is 2^' + net.inputs.length
          + ' vectors, past the exhaustive limit' };
    }
    const total = Math.pow(2, net.inputs.length);

    for (let mask = 0; mask < total; mask += 1) {
      const values = Sim.assignmentOf(net, mask);
      const got = Sim.outputsOf(net, Sim.evaluate(net, values));
      const wanted = model(values);
      const bad = firstDifference(got, wanted);

      if (bad) {
        return { exhaustive: true, ok: false, checked: mask + 1, at: values,
          port: bad, got: got[bad], wanted: wanted[bad],
          why: 'output ' + bad + ' is ' + got[bad] + ' where the model says ' + wanted[bad] };
      }
    }
    return { exhaustive: true, ok: true, checked: total,
      why: 'every one of the ' + total + ' input vectors agrees with the model' };
  }

  function firstDifference(got, wanted) {
    return Object.keys(wanted).filter(function (port) {
      return (got[port] ? 1 : 0) !== (wanted[port] ? 1 : 0);
    })[0] || null;
  }

  /**
   * Coverage in hardware terms. Vector coverage is the share of the input
   * space a test list visits; TOGGLE coverage is the share of wires that were
   * seen at both values, and it is the one that finds a testbench which
   * exercises a lot of inputs and never flips a control line.
   */
  function coverage(net, vectors) {
    const seenLow = {};
    const seenHigh = {};
    const visited = {};

    vectors.forEach(function (values) {
      const wires = Sim.evaluate(net, values);

      visited[JSON.stringify(values)] = true;
      Object.keys(wires).forEach(function (id) {
        if (wires[id]) seenHigh[id] = true; else seenLow[id] = true;
      });
    });
    const toggled = net.order.filter(function (id) {
      return seenLow[id] && seenHigh[id];
    });

    return { vectors: Object.keys(visited).length,
      space: Math.pow(2, net.inputs.length),
      vectorShare: Object.keys(visited).length / Math.pow(2, net.inputs.length),
      toggled: toggled.length, wires: net.order.length,
      toggleShare: net.order.length ? toggled.length / net.order.length : 0,
      stuck: net.order.filter(function (id) { return !(seenLow[id] && seenHigh[id]); })
        .map(function (id) { return net.nodes[id].label; }) };
  }

  /* ----------------------------------------------------- a small library */

  /**
   * The library the workbench section elaborates, small enough to print.
   *
   * `options.width` adds a ripple adder of that width, written as a loop over
   * one module - which is the argument for describing hardware in a language.
   * `options.bug` swaps one gate in the full adder: the sum is taken from an
   * OR of the first half adder's sum and the carry in, which is right on three
   * of the eight rows and wrong on the rest. It lives here rather than in a
   * section so that a test can elaborate the same broken design the demo does.
   */
  function standardLibrary(options) {
    const settings = options || {};
    const lib = library();

    define(lib, 'xor2', { inputs: ['a', 'b'], outputs: ['y'],
      about: 'exclusive or, built from four NANDs',
      build: function (ctx, ports) {
        const n1 = ctx.gate('nand', [ports.a, ports.b]);
        const n2 = ctx.gate('nand', [ports.a, n1]);
        const n3 = ctx.gate('nand', [ports.b, n1]);

        return { y: ctx.gate('nand', [n2, n3]) };
      } });
    define(lib, 'halfAdder', { inputs: ['a', 'b'], outputs: ['sum', 'carry'],
      about: 'one xor and one and',
      build: function (ctx, ports) {
        return { sum: ctx.use('xor2', { a: ports.a, b: ports.b }).y,
          carry: ctx.gate('and', [ports.a, ports.b]) };
      } });
    define(lib, 'fullAdder', { inputs: ['a', 'b', 'cin'], outputs: ['sum', 'carry'],
      about: 'two half adders and an or — the module the whole milestone reuses',
      build: function (ctx, ports) {
        const first = ctx.use('halfAdder', { a: ports.a, b: ports.b }, 'low');
        const second = ctx.use('halfAdder', { a: first.sum, b: ports.cin }, 'high');

        return { sum: second.sum, carry: ctx.gate('or', [first.carry, second.carry]) };
      } });
    if (settings.bug) defineBrokenAdder(lib);
    if (settings.width) defineWideAdder(lib, settings.width);
    return lib;
  }

  /** One gate changed, and nothing else: it elaborates, it simulates, and it
   *  is wrong on five of the eight input vectors. */
  function defineBrokenAdder(lib) {
    define(lib, 'fullAdder', { inputs: ['a', 'b', 'cin'], outputs: ['sum', 'carry'],
      about: 'the same module with one gate wrong: the sum comes from an OR',
      build: function (ctx, ports) {
        const first = ctx.use('halfAdder', { a: ports.a, b: ports.b }, 'low');
        const second = ctx.use('halfAdder', { a: first.sum, b: ports.cin }, 'high');

        return { sum: ctx.gate('or', [first.sum, ports.cin]),
          carry: ctx.gate('or', [first.carry, second.carry]) };
      } });
  }

  function defineWideAdder(lib, width) {
    const inputs = [];
    const outputs = [];

    for (let at = 0; at < width; at += 1) { inputs.push('a' + at); inputs.push('b' + at); }
    inputs.push('cin');
    for (let at = 0; at < width; at += 1) outputs.push('s' + at);
    outputs.push('cout');
    define(lib, 'adder' + width, { inputs: inputs, outputs: outputs,
      about: width + ' full adders, carry rippling between them',
      build: function (ctx, ports) {
        const out = {};
        let carry = ports.cin;

        for (let at = 0; at < width; at += 1) {
          const stage = ctx.use('fullAdder',
            { a: ports['a' + at], b: ports['b' + at], cin: carry }, 'bit' + at);

          out['s' + at] = stage.sum;
          carry = stage.carry;
        }
        out.cout = carry;
        return out;
      } });
  }

  return { library: library, define: define, elaborate: elaborate,
    instantiate: instantiate, testbench: testbench, equivalent: equivalent,
    coverage: coverage, standardLibrary: standardLibrary };
}));
