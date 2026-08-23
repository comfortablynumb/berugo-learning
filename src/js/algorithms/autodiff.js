/**
 * Automatic differentiation, in both modes, with the cost asymmetry that is
 * the whole reason machine learning works measured rather than asserted.
 *
 * Autodiff is neither symbolic differentiation nor a finite difference. It is
 * the chain rule applied mechanically to the operations a program actually
 * performed, so the derivative is exact to machine precision - no step size,
 * no cancellation, no expression swell.
 *
 * The two modes propagate the chain rule in opposite directions and that
 * decides which one to use:
 *
 * - **Forward mode** carries a derivative alongside every value. One pass
 *   gives the derivative with respect to ONE input, so n inputs cost n passes.
 *   Cheap for few inputs and many outputs.
 * - **Reverse mode** records the operations on a tape, then walks it backwards
 *   accumulating adjoints. One backward pass gives the derivative with respect
 *   to EVERY input at once, at a cost of about one extra forward evaluation
 *   regardless of how many there are.
 *
 * That asymmetry is why gradient-based training scales to billions of
 * parameters: a loss has one output and billions of inputs, which is exactly
 * reverse mode's shape and exactly forward mode's worst case. `costRatio`
 * measures it by counting operations rather than quoting it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Autodiff = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ----------------------------------------------------------- forward */

  /**
   * A dual number: value plus derivative. Every operation carries the chain
   * rule with it, so evaluating the function evaluates its derivative too -
   * there is no separate differentiation step at all.
   */
  function dual(value, derivative) {
    return { value: value, derivative: derivative || 0 };
  }

  function constant(value) { return dual(value, 0); }
  function variable(value) { return dual(value, 1); }

  const Forward = {
    add: function (a, b) { return dual(a.value + b.value, a.derivative + b.derivative); },
    sub: function (a, b) { return dual(a.value - b.value, a.derivative - b.derivative); },
    mul: function (a, b) {
      return dual(a.value * b.value, a.derivative * b.value + a.value * b.derivative);
    },
    div: function (a, b) {
      return dual(a.value / b.value,
        (a.derivative * b.value - a.value * b.derivative) / (b.value * b.value));
    },
    sin: function (a) { return dual(Math.sin(a.value), Math.cos(a.value) * a.derivative); },
    cos: function (a) { return dual(Math.cos(a.value), -Math.sin(a.value) * a.derivative); },
    exp: function (a) {
      const value = Math.exp(a.value);
      return dual(value, value * a.derivative);
    },
    log: function (a) { return dual(Math.log(a.value), a.derivative / a.value); },
    sqrt: function (a) {
      const value = Math.sqrt(a.value);
      return dual(value, a.derivative / (2 * value));
    },
    pow: function (a, k) {
      return dual(Math.pow(a.value, k), k * Math.pow(a.value, k - 1) * a.derivative);
    }
  };

  /**
   * The gradient by forward mode: one pass per input, because each pass seeds
   * exactly one variable with a derivative of 1. `passes` is reported so the
   * comparison against reverse mode is a count rather than an argument.
   */
  function forwardGradient(f, at) {
    const gradient = new Float64Array(at.length);
    let value = 0;

    for (let i = 0; i < at.length; i += 1) {
      const inputs = at.map(function (x, j) { return i === j ? variable(x) : constant(x); });
      const result = f(inputs, Forward);
      gradient[i] = result.derivative;
      value = result.value;
    }
    return { value: value, gradient: gradient, passes: at.length };
  }

  /* ----------------------------------------------------------- reverse */

  /**
   * A tape. Every operation appends a node recording its inputs and the local
   * partial derivatives; the backward sweep then walks the tape in reverse,
   * multiplying each node's adjoint into its inputs'. Nothing is symbolic and
   * nothing is re-evaluated - the tape IS the computation, already done.
   */
  function createTape() {
    const nodes = [];
    let operations = 0;

    function push(value, parents) {
      nodes.push({ value: value, parents: parents || [] });
      return nodes.length - 1;
    }

    function record(value, parents) {
      operations += 1;
      return { index: push(value, parents), value: value };
    }

    const api = {
      nodes: nodes,
      constant: function (value) { return { index: push(value, []), value: value }; },
      variable: function (value) { return { index: push(value, []), value: value }; },
      add: function (a, b) {
        return record(a.value + b.value, [{ index: a.index, partial: 1 },
          { index: b.index, partial: 1 }]);
      },
      sub: function (a, b) {
        return record(a.value - b.value, [{ index: a.index, partial: 1 },
          { index: b.index, partial: -1 }]);
      },
      mul: function (a, b) {
        return record(a.value * b.value, [{ index: a.index, partial: b.value },
          { index: b.index, partial: a.value }]);
      },
      div: function (a, b) {
        return record(a.value / b.value, [{ index: a.index, partial: 1 / b.value },
          { index: b.index, partial: -a.value / (b.value * b.value) }]);
      },
      sin: function (a) {
        return record(Math.sin(a.value), [{ index: a.index, partial: Math.cos(a.value) }]);
      },
      cos: function (a) {
        return record(Math.cos(a.value), [{ index: a.index, partial: -Math.sin(a.value) }]);
      },
      exp: function (a) {
        const value = Math.exp(a.value);
        return record(value, [{ index: a.index, partial: value }]);
      },
      log: function (a) {
        return record(Math.log(a.value), [{ index: a.index, partial: 1 / a.value }]);
      },
      sqrt: function (a) {
        const value = Math.sqrt(a.value);
        return record(value, [{ index: a.index, partial: 1 / (2 * value) }]);
      },
      pow: function (a, k) {
        return record(Math.pow(a.value, k),
          [{ index: a.index, partial: k * Math.pow(a.value, k - 1) }]);
      },
      operations: function () { return operations; },
      size: function () { return nodes.length; }
    };
    return api;
  }

  /**
   * The backward sweep. Seed the output's adjoint with 1 and walk the tape in
   * reverse; each node distributes its adjoint to its parents scaled by the
   * local partial. One pass, every input's derivative.
   */
  function backward(tape, output) {
    const adjoints = new Float64Array(tape.nodes.length);
    adjoints[output.index] = 1;
    let touched = 0;

    for (let i = tape.nodes.length - 1; i >= 0; i -= 1) {
      const adjoint = adjoints[i];
      if (adjoint === 0) continue;
      const parents = tape.nodes[i].parents;
      for (let p = 0; p < parents.length; p += 1) {
        adjoints[parents[p].index] += adjoint * parents[p].partial;
        touched += 1;
      }
    }
    return { adjoints: adjoints, touched: touched };
  }

  /** The gradient by reverse mode: one forward evaluation and one backward
   *  sweep, whatever the number of inputs. */
  function reverseGradient(f, at) {
    const tape = createTape();
    const inputs = at.map(function (x) { return tape.variable(x); });
    const output = f(inputs, tape);
    const swept = backward(tape, output);

    const gradient = new Float64Array(at.length);
    for (let i = 0; i < at.length; i += 1) gradient[i] = swept.adjoints[inputs[i].index];
    return { value: output.value, gradient: gradient, passes: 1,
      tapeSize: tape.size(), operations: tape.operations(), touched: swept.touched };
  }

  /**
   * The cost of each mode on the same function, in recorded operations. This
   * is the measurement the whole section rests on: forward mode's cost is
   * proportional to the number of inputs and reverse mode's is not.
   */
  function costRatio(f, at) {
    const tape = createTape();
    const inputs = at.map(function (x) { return tape.variable(x); });
    f(inputs, tape);
    const perPass = tape.operations();

    return {
      inputs: at.length,
      operationsPerPass: perPass,
      forwardOperations: perPass * at.length,
      reverseOperations: perPass + reverseGradient(f, at).touched,
      ratio: (perPass * at.length) / Math.max(1, perPass + reverseGradient(f, at).touched)
    };
  }

  /** The computation graph, for the demo to draw: one row per node with its
   *  value, its parents and its adjoint after the sweep. */
  function graphOf(f, at) {
    const tape = createTape();
    const inputs = at.map(function (x) { return tape.variable(x); });
    const output = f(inputs, tape);
    const swept = backward(tape, output);

    return tape.nodes.map(function (node, index) {
      return {
        index: index,
        value: node.value,
        parents: node.parents.map(function (parent) { return parent.index; }),
        partials: node.parents.map(function (parent) { return parent.partial; }),
        adjoint: swept.adjoints[index],
        isInput: inputs.some(function (input) { return input.index === index; }),
        isOutput: index === output.index
      };
    });
  }

  /* ------------------------------------------------------------ fixtures */

  /**
   * Functions written once against an operation set, so the identical source
   * runs under dual numbers, under a tape and under plain arithmetic. That is
   * what makes the three answers comparable - there is no second
   * implementation to disagree with.
   */
  const FIXTURES = [
    {
      id: 'polynomial',
      label: 'x² + 3xy + y³',
      inputs: 2,
      at: [1.5, -0.7],
      f: function (v, ops) {
        return ops.add(ops.add(ops.pow(v[0], 2), ops.mul(ops.mul(ops.constant
          ? ops.constant(3) : { value: 3, derivative: 0 }, v[0]), v[1])), ops.pow(v[1], 3));
      },
      gradient: function (at) {
        return [2 * at[0] + 3 * at[1], 3 * at[0] + 3 * at[1] * at[1]];
      }
    },
    {
      id: 'trigonometric',
      label: 'sin(xy) + exp(x)',
      inputs: 2,
      at: [0.4, 1.3],
      f: function (v, ops) {
        return ops.add(ops.sin(ops.mul(v[0], v[1])), ops.exp(v[0]));
      },
      gradient: function (at) {
        return [at[1] * Math.cos(at[0] * at[1]) + Math.exp(at[0]),
          at[0] * Math.cos(at[0] * at[1])];
      }
    },
    {
      id: 'rosenbrock',
      label: '(1 − x)² + 100(y − x²)²',
      inputs: 2,
      at: [-1.2, 1],
      f: function (v, ops) {
        const one = ops.constant ? ops.constant(1) : { value: 1, derivative: 0 };
        const hundred = ops.constant ? ops.constant(100) : { value: 100, derivative: 0 };
        const first = ops.pow(ops.sub(one, v[0]), 2);
        const second = ops.mul(hundred, ops.pow(ops.sub(v[1], ops.pow(v[0], 2)), 2));
        return ops.add(first, second);
      },
      gradient: function (at) {
        return [-2 * (1 - at[0]) - 400 * at[0] * (at[1] - at[0] * at[0]),
          200 * (at[1] - at[0] * at[0])];
      }
    },
    {
      id: 'wide',
      label: 'a sum of squares over many inputs',
      inputs: 24,
      at: null,
      f: function (v, ops) {
        let total = ops.constant ? ops.constant(0) : { value: 0, derivative: 0 };
        for (let i = 0; i < v.length; i += 1) {
          total = ops.add(total, ops.mul(ops.pow(v[i], 2), ops.sin(v[i])));
        }
        return total;
      },
      gradient: function (at) {
        return at.map(function (x) {
          return 2 * x * Math.sin(x) + x * x * Math.cos(x);
        });
      }
    }
  ];

  function fixtureFor(id) {
    for (let i = 0; i < FIXTURES.length; i += 1) {
      if (FIXTURES[i].id === id) return FIXTURES[i];
    }
    return FIXTURES[0];
  }

  /** Default evaluation points, so the wide fixture has one without carrying a
   *  24-element literal. */
  function pointFor(fixture) {
    if (fixture.at) return fixture.at.slice();
    const out = [];
    for (let i = 0; i < fixture.inputs; i += 1) out.push(0.3 + 0.11 * i);
    return out;
  }

  /** Forward mode needs `constant` on its operation set, which dual numbers do
   *  not otherwise carry. */
  const ForwardOps = Object.assign({ constant: constant, variable: variable }, Forward);

  return {
    dual: dual,
    constant: constant,
    variable: variable,
    Forward: ForwardOps,
    forwardGradient: forwardGradient,
    createTape: createTape,
    backward: backward,
    reverseGradient: reverseGradient,
    costRatio: costRatio,
    graphOf: graphOf,
    FIXTURES: FIXTURES,
    fixtureFor: fixtureFor,
    pointFor: pointFor
  };
}));
