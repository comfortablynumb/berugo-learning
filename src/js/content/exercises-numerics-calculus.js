/**
 * Graded exercises for interpolation, differentiation and differential
 * equations (M18.6-M18.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'interpolation': [{
      id: 'natural-cubic-spline',
      title: 'A natural cubic spline, by solving the tridiagonal system',
      prompt: 'buildSpline(nodes, values) must return a function f(x) that evaluates the natural ' +
        'cubic spline through the given points, with `f.secondDerivative(x)` available on it. Let ' +
        'hᵢ be the gap between consecutive nodes. Continuity of the first and second derivatives ' +
        'at the interior knots gives a tridiagonal system in the second derivatives mᵢ: ' +
        'hᵢ₋₁mᵢ₋₁ + 2(hᵢ₋₁ + hᵢ)mᵢ + hᵢmᵢ₊₁ = 6((yᵢ₊₁ − yᵢ)/hᵢ − (yᵢ − yᵢ₋₁)/hᵢ₋₁). The natural ' +
        'boundary condition sets m₀ and mₙ₋₁ to zero. Solve it with the Thomas algorithm — one ' +
        'forward sweep and one back substitution, O(n) rather than O(n³) — then evaluate the cubic ' +
        'on the interval containing x. The starter interpolates linearly between the points, which ' +
        'is exact at the nodes and has a discontinuous first derivative, so it is C⁰ and not C².',
      entry: 'buildSpline',
      starter: [
        'function buildSpline(nodes, values) {',
        '  function find(x) {',
        '    let i = 0;',
        '    while (i < nodes.length - 2 && x > nodes[i + 1]) i += 1;',
        '    return i;',
        '  }',
        '',
        '  // straight lines between the points: exact at the nodes, and not C1',
        '  const f = function (x) {',
        '    const i = find(x);',
        '    const t = (x - nodes[i]) / (nodes[i + 1] - nodes[i]);',
        '    return values[i] * (1 - t) + values[i + 1] * t;',
        '  };',
        '  f.secondDerivative = function () { return 0; };',
        '  return f;',
        '}'
      ].join('\n'),
      solution: [
        'function buildSpline(nodes, values) {',
        '  const n = nodes.length;',
        '  const h = [];',
        '  for (let i = 0; i < n - 1; i += 1) h.push(nodes[i + 1] - nodes[i]);',
        '',
        '  // the tridiagonal system in the second derivatives, with m0 = m[n-1] = 0',
        '  const lower = new Array(n).fill(0);',
        '  const diag = new Array(n).fill(1);',
        '  const upper = new Array(n).fill(0);',
        '  const rhs = new Array(n).fill(0);',
        '',
        '  for (let i = 1; i < n - 1; i += 1) {',
        '    lower[i] = h[i - 1];',
        '    diag[i] = 2 * (h[i - 1] + h[i]);',
        '    upper[i] = h[i];',
        '    rhs[i] = 6 * ((values[i + 1] - values[i]) / h[i] -',
        '      (values[i] - values[i - 1]) / h[i - 1]);',
        '  }',
        '',
        '  // Thomas algorithm: forward sweep then back substitution, O(n)',
        '  const c = new Array(n).fill(0);',
        '  const d = new Array(n).fill(0);',
        '  c[0] = upper[0] / diag[0];',
        '  d[0] = rhs[0] / diag[0];',
        '  for (let i = 1; i < n; i += 1) {',
        '    const denominator = diag[i] - lower[i] * c[i - 1];',
        '    c[i] = upper[i] / denominator;',
        '    d[i] = (rhs[i] - lower[i] * d[i - 1]) / denominator;',
        '  }',
        '  const m = new Array(n).fill(0);',
        '  m[n - 1] = d[n - 1];',
        '  for (let i = n - 2; i >= 0; i -= 1) m[i] = d[i] - c[i] * m[i + 1];',
        '',
        '  function find(x) {',
        '    let low = 0;',
        '    let high = n - 2;',
        '    while (low < high) {',
        '      const mid = (low + high + 1) >> 1;',
        '',
        '      if (nodes[mid] <= x) low = mid; else high = mid - 1;',
        '    }',
        '    return low;',
        '  }',
        '',
        '  const f = function (x) {',
        '    const i = find(x);',
        '    const step = h[i];',
        '    const a = nodes[i + 1] - x;',
        '    const b = x - nodes[i];',
        '    return (m[i] * a * a * a + m[i + 1] * b * b * b) / (6 * step) +',
        '      (values[i] / step - m[i] * step / 6) * a +',
        '      (values[i + 1] / step - m[i + 1] * step / 6) * b;',
        '  };',
        '  f.secondDerivative = function (x) {',
        '    const i = find(x);',
        '    const step = h[i];',
        '    return (m[i] * (nodes[i + 1] - x) + m[i + 1] * (x - nodes[i])) / step;',
        '  };',
        '  return f;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it interpolates every data point exactly',
          assert: function (buildSpline, api) {
            const nodes = [0, 1, 2, 3, 4, 5];
            const values = [0, 1, 0, 2, 1, 3];
            const f = buildSpline(nodes, values);

            nodes.forEach(function (x, i) {
              api.assert.closeTo(f(x), values[i], 1e-9,
                'the spline must pass through the point at x = ' + x);
            });
          }
        },
        {
          name: 'the second derivative is continuous at every interior knot',
          assert: function (buildSpline, api) {
            const nodes = [0, 1, 2, 3, 4, 5];
            const values = [0, 1, 0, 2, 1, 3];
            const f = buildSpline(nodes, values);
            const h = 1e-6;

            for (let i = 1; i < nodes.length - 1; i += 1) {
              const left = f.secondDerivative(nodes[i] - h);
              const right = f.secondDerivative(nodes[i] + h);
              api.assert.closeTo(left, right, 1e-4,
                'the curvature must match across the knot at x = ' + nodes[i]);
            }
            api.assert.closeTo(f.secondDerivative(nodes[0] + 1e-9), 0, 1e-6,
              'the natural boundary condition sets the curvature to zero at the left end');
            api.assert.closeTo(f.secondDerivative(nodes[nodes.length - 1] - 1e-9), 0, 1e-6,
              'and at the right end');
          }
        },
        {
          name: 'it beats a high-degree polynomial on Runge’s function',
          assert: function (buildSpline, api) {
            const count = 21;
            const nodes = [];
            const values = [];
            for (let i = 0; i < count; i += 1) {
              const x = -1 + 2 * i / (count - 1);
              nodes.push(x);
              values.push(1 / (1 + 25 * x * x));
            }
            const f = buildSpline(nodes, values);

            let worst = 0;
            for (let i = 0; i <= 400; i += 1) {
              const x = -1 + 2 * i / 400;
              worst = Math.max(worst, Math.abs(f(x) - 1 / (1 + 25 * x * x)));
            }
            api.assert.atMost(worst, 0.02,
              'a spline through 21 equally spaced nodes must stay close, where the ' +
              'degree-20 polynomial reaches an error above 50');
          }
        },
        {
          name: 'a cubic is reproduced exactly away from the natural boundary',
          assert: function (buildSpline, api) {
            /* A natural spline forces zero curvature at the ends, so it cannot
               reproduce a cubic there - but the middle of a long run should be
               essentially exact. */
            const nodes = [];
            const values = [];
            for (let i = 0; i <= 40; i += 1) {
              const x = i / 4;
              nodes.push(x);
              values.push(1 + 2 * x - 0.5 * x * x + 0.1 * x * x * x);
            }
            const f = buildSpline(nodes, values);

            /* Stay four units clear of both ends: the natural boundary
               condition's error decays geometrically inwards, so the middle is
               essentially exact and the ends are not. */
            let worst = 0;
            for (let i = 32; i <= 48; i += 1) {
              const x = i / 8;
              const truth = 1 + 2 * x - 0.5 * x * x + 0.1 * x * x * x;
              worst = Math.max(worst, Math.abs(f(x) - truth));
            }
            api.assert.atMost(worst, 1e-6,
              'away from the ends a cubic spline reproduces a cubic to machine precision');
          }
        }
      ]
    }],

    'differentiation-and-autodiff': [{
      id: 'dual-numbers-and-tape',
      title: 'Forward mode with dual numbers, reverse mode with a tape',
      prompt: 'gradients(f, at) must return { forward, reverse, forwardPasses, reversePasses } ' +
        'where both entries are the full gradient of f. The function f is written against an ' +
        'operations object, so f(vars, ops) can be evaluated under any arithmetic you supply: ops ' +
        'has constant, add, sub, mul, div, sin, cos, exp and pow(a, k). For FORWARD mode, ' +
        'implement dual numbers — each value carries { value, derivative }, add adds both parts, ' +
        'mul uses the product rule, sin(a) has derivative cos(a.value) × a.derivative — and run f ' +
        'once per input with that input seeded to derivative 1 and the rest to 0, so ' +
        'forwardPasses is the input count. For REVERSE mode, run f once recording each operation ' +
        'as a node with its parents and its local partials, then walk the tape backwards from an ' +
        'output adjoint of 1, adding each node’s adjoint times the local partial into each parent. ' +
        'A node with two children accumulates both contributions, which is why the adjoints are ' +
        'added rather than assigned. reversePasses is 1 whatever the input count. The starter ' +
        'returns central differences for both, which is accurate to about eight digits and to no ' +
        'more.',
      entry: 'gradients',
      starter: [
        'function gradients(f, at) {',
        '  const plain = {',
        '    constant: function (v) { return { value: v }; },',
        '    add: function (a, b) { return { value: a.value + b.value }; },',
        '    sub: function (a, b) { return { value: a.value - b.value }; },',
        '    mul: function (a, b) { return { value: a.value * b.value }; },',
        '    div: function (a, b) { return { value: a.value / b.value }; },',
        '    sin: function (a) { return { value: Math.sin(a.value) }; },',
        '    cos: function (a) { return { value: Math.cos(a.value) }; },',
        '    exp: function (a) { return { value: Math.exp(a.value) }; },',
        '    pow: function (a, k) { return { value: Math.pow(a.value, k); } }',
        '  };',
        '  function evaluate(point) {',
        '    return f(point.map(function (v) { return { value: v }; }), plain).value;',
        '  }',
        '',
        '  // central differences for both: about eight correct digits, and no more',
        '  const h = 1e-6;',
        '  const g = at.map(function (value, i) {',
        '    const up = at.slice(); up[i] += h;',
        '    const down = at.slice(); down[i] -= h;',
        '    return (evaluate(up) - evaluate(down)) / (2 * h);',
        '  });',
        '  return { forward: g, reverse: g.slice(),',
        '    forwardPasses: at.length, reversePasses: at.length };',
        '}'
      ].join('\n'),
      solution: [
        'function gradients(f, at) {',
        '  const n = at.length;',
        '',
        '  // ---- forward mode: dual numbers, one pass per input',
        '  const dual = {',
        '    constant: function (v) { return { value: v, derivative: 0 }; },',
        '    add: function (a, b) {',
        '      return { value: a.value + b.value, derivative: a.derivative + b.derivative };',
        '    },',
        '    sub: function (a, b) {',
        '      return { value: a.value - b.value, derivative: a.derivative - b.derivative };',
        '    },',
        '    mul: function (a, b) {',
        '      return { value: a.value * b.value,',
        '        derivative: a.derivative * b.value + a.value * b.derivative };',
        '    },',
        '    div: function (a, b) {',
        '      return { value: a.value / b.value,',
        '        derivative: (a.derivative * b.value - a.value * b.derivative) /',
        '          (b.value * b.value) };',
        '    },',
        '    sin: function (a) {',
        '      return { value: Math.sin(a.value), derivative: Math.cos(a.value) * a.derivative };',
        '    },',
        '    cos: function (a) {',
        '      return { value: Math.cos(a.value), derivative: -Math.sin(a.value) * a.derivative };',
        '    },',
        '    exp: function (a) {',
        '      const e = Math.exp(a.value);',
        '      return { value: e, derivative: e * a.derivative };',
        '    },',
        '    pow: function (a, k) {',
        '      return { value: Math.pow(a.value, k),',
        '        derivative: k * Math.pow(a.value, k - 1) * a.derivative };',
        '    }',
        '  };',
        '  const forward = [];',
        '  for (let seed = 0; seed < n; seed += 1) {',
        '    const vars = at.map(function (v, i) {',
        '      return { value: v, derivative: i === seed ? 1 : 0 };',
        '    });',
        '    forward.push(f(vars, dual).derivative);',
        '  }',
        '',
        '  // ---- reverse mode: one forward recording pass, one backward sweep',
        '  const nodes = [];',
        '  function node(value, parents, partials) {',
        '    nodes.push({ value: value, parents: parents, partials: partials });',
        '    return { value: value, index: nodes.length - 1 };',
        '  }',
        '  const tape = {',
        '    constant: function (v) { return node(v, [], []); },',
        '    add: function (a, b) { return node(a.value + b.value, [a.index, b.index], [1, 1]); },',
        '    sub: function (a, b) { return node(a.value - b.value, [a.index, b.index], [1, -1]); },',
        '    mul: function (a, b) {',
        '      return node(a.value * b.value, [a.index, b.index], [b.value, a.value]);',
        '    },',
        '    div: function (a, b) {',
        '      return node(a.value / b.value, [a.index, b.index],',
        '        [1 / b.value, -a.value / (b.value * b.value)]);',
        '    },',
        '    sin: function (a) { return node(Math.sin(a.value), [a.index], [Math.cos(a.value)]); },',
        '    cos: function (a) { return node(Math.cos(a.value), [a.index], [-Math.sin(a.value)]); },',
        '    exp: function (a) {',
        '      const e = Math.exp(a.value);',
        '      return node(e, [a.index], [e]);',
        '    },',
        '    pow: function (a, k) {',
        '      return node(Math.pow(a.value, k), [a.index], [k * Math.pow(a.value, k - 1)]);',
        '    }',
        '  };',
        '  const inputs = at.map(function (v) { return node(v, [], []); });',
        '  const output = f(inputs, tape);',
        '',
        '  const adjoints = new Array(nodes.length).fill(0);',
        '  adjoints[output.index] = 1;',
        '  for (let i = nodes.length - 1; i >= 0; i -= 1) {',
        '    const here = adjoints[i];',
        '',
        '    if (here === 0) continue;',
        '    nodes[i].parents.forEach(function (parent, k) {',
        '      // ADD, because a node feeding two children contributes to both',
        '      adjoints[parent] += here * nodes[i].partials[k];',
        '    });',
        '  }',
        '  const reverse = inputs.map(function (input) { return adjoints[input.index]; });',
        '',
        '  return { forward: forward, reverse: reverse,',
        '    forwardPasses: n, reversePasses: 1 };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'both modes are exact on a polynomial, where a difference is not',
          assert: function (gradients, api) {
            const f = function (v, ops) {
              return ops.add(ops.add(ops.pow(v[0], 2),
                ops.mul(ops.mul(ops.constant(3), v[0]), v[1])), ops.pow(v[1], 3));
            };
            const at = [1.5, -0.7];
            const truth = [2 * at[0] + 3 * at[1], 3 * at[0] + 3 * at[1] * at[1]];
            const got = gradients(f, at);

            api.assert.closeTo(got.forward[0], truth[0], 1e-13, 'forward mode, first partial');
            api.assert.closeTo(got.forward[1], truth[1], 1e-13, 'forward mode, second partial');
            api.assert.closeTo(got.reverse[0], truth[0], 1e-13, 'reverse mode, first partial');
            api.assert.closeTo(got.reverse[1], truth[1], 1e-13, 'reverse mode, second partial');
          }
        },
        {
          name: 'a shared input accumulates both contributions',
          assert: function (gradients, api) {
            /* x feeds both the product and the exponential, so its adjoint is a
               SUM. Assigning instead of adding loses one of the two terms. */
            const f = function (v, ops) {
              return ops.add(ops.sin(ops.mul(v[0], v[1])), ops.exp(v[0]));
            };
            const at = [0.4, 1.3];
            const truth = [at[1] * Math.cos(at[0] * at[1]) + Math.exp(at[0]),
              at[0] * Math.cos(at[0] * at[1])];
            const got = gradients(f, at);

            api.assert.closeTo(got.reverse[0], truth[0], 1e-12,
              'the x adjoint must include both the product term and the exponential term');
            api.assert.closeTo(got.reverse[1], truth[1], 1e-12, 'and y takes only the product term');
            api.assert.closeTo(got.forward[0], got.reverse[0], 1e-12, 'the two modes must agree');
          }
        },
        {
          name: 'reverse mode takes one pass whatever the input count',
          assert: function (gradients, api) {
            const width = 24;
            const f = function (v, ops) {
              let total = ops.constant(0);
              for (let i = 0; i < v.length; i += 1) {
                total = ops.add(total, ops.mul(ops.pow(v[i], 2), ops.sin(v[i])));
              }
              return total;
            };
            const at = [];
            for (let i = 0; i < width; i += 1) at.push(0.3 + i / 20);
            const got = gradients(f, at);

            api.assert.equal(got.reversePasses, 1,
              'one backward sweep gives the whole gradient');
            api.assert.equal(got.forwardPasses, width,
              'forward mode needs one sweep per input');

            for (let i = 0; i < width; i += 1) {
              const x = at[i];
              const truth = 2 * x * Math.sin(x) + x * x * Math.cos(x);
              api.assert.closeTo(got.reverse[i], truth, 1e-12, 'partial ' + i);
            }
          }
        },
        {
          name: 'it beats a central difference on the accuracy the V curve allows',
          assert: function (gradients, api) {
            const f = function (v, ops) {
              const one = ops.constant(1);
              const hundred = ops.constant(100);
              return ops.add(ops.pow(ops.sub(one, v[0]), 2),
                ops.mul(hundred, ops.pow(ops.sub(v[1], ops.pow(v[0], 2)), 2)));
            };
            const at = [-1.2, 1];
            const truth = [-2 * (1 - at[0]) - 400 * at[0] * (at[1] - at[0] * at[0]),
              200 * (at[1] - at[0] * at[0])];
            const got = gradients(f, at);

            [0, 1].forEach(function (i) {
              const error = Math.abs(got.reverse[i] - truth[i]) / Math.abs(truth[i]);
              api.assert.atMost(error, 1e-13,
                'autodiff must be exact to machine precision, not to the 1e-8 a difference gives');
            });
          }
        }
      ]
    }],

    'differential-equations': [{
      id: 'verlet-and-rk4',
      title: 'Velocity Verlet and RK4, and the order study that checks them',
      prompt: 'integrate(system, options) must return { state, energy, order } for a second-order ' +
        'system given as { position, velocity, acceleration(position), energy(position, ' +
        'velocity) }. options carries { method, step, steps }. For `verlet`, use velocity Verlet: ' +
        'x := x + v·h + a·h²/2, then compute the new acceleration, then v := v + (a_old + ' +
        'a_new)·h/2 — one acceleration evaluation per step if you carry the old one forward. For ' +
        '`rk4`, use the classical four-stage formula on the coupled first-order system, weighting ' +
        'the two midpoint stages twice. Return `energy` as the relative drift ' +
        '|E_final − E_initial| / |E_initial|, and `order` as the convergence order measured by ' +
        'running the same integration at the given step and at half of it and taking log₂ of the ' +
        'error ratio against a reference at a sixteenth of the step. The starter uses explicit ' +
        'Euler, which is first order and loses energy visibly.',
      entry: 'integrate',
      starter: [
        'function integrate(system, options) {',
        '  function run(step, steps) {',
        '    let x = system.position;',
        '    let v = system.velocity;',
        '    for (let i = 0; i < steps; i += 1) {',
        '      // explicit Euler: both updates from the OLD state',
        '      const a = system.acceleration(x);',
        '      const nextX = x + v * step;',
        '      v = v + a * step;',
        '      x = nextX;',
        '    }',
        '    return { x: x, v: v };',
        '  }',
        '',
        '  const coarse = run(options.step, options.steps);',
        '  const fine = run(options.step / 2, options.steps * 2);',
        '  const reference = run(options.step / 16, options.steps * 16);',
        '  const e0 = system.energy(system.position, system.velocity);',
        '  const e1 = system.energy(coarse.x, coarse.v);',
        '',
        '  const coarseError = Math.abs(coarse.x - reference.x);',
        '  const fineError = Math.abs(fine.x - reference.x);',
        '  return {',
        '    state: [coarse.x, coarse.v],',
        '    energy: Math.abs((e1 - e0) / e0),',
        '    order: Math.log2(coarseError / fineError)',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function integrate(system, options) {',
        '  const method = options.method || "verlet";',
        '',
        '  function verletRun(step, steps) {',
        '    let x = system.position;',
        '    let v = system.velocity;',
        '    let a = system.acceleration(x);',
        '    for (let i = 0; i < steps; i += 1) {',
        '      x = x + v * step + 0.5 * a * step * step;',
        '      const next = system.acceleration(x);',
        '      v = v + 0.5 * (a + next) * step;',
        '      a = next;',
        '    }',
        '    return { x: x, v: v };',
        '  }',
        '',
        '  function rk4Run(step, steps) {',
        '    let x = system.position;',
        '    let v = system.velocity;',
        '    for (let i = 0; i < steps; i += 1) {',
        '      const k1x = v;',
        '      const k1v = system.acceleration(x);',
        '      const k2x = v + 0.5 * step * k1v;',
        '      const k2v = system.acceleration(x + 0.5 * step * k1x);',
        '      const k3x = v + 0.5 * step * k2v;',
        '      const k3v = system.acceleration(x + 0.5 * step * k2x);',
        '      const k4x = v + step * k3v;',
        '      const k4v = system.acceleration(x + step * k3x);',
        '',
        '      // the midpoint stages carry twice the weight - Simpson again',
        '      x = x + step * (k1x + 2 * k2x + 2 * k3x + k4x) / 6;',
        '      v = v + step * (k1v + 2 * k2v + 2 * k3v + k4v) / 6;',
        '    }',
        '    return { x: x, v: v };',
        '  }',
        '',
        '  const run = method === "rk4" ? rk4Run : verletRun;',
        '  const coarse = run(options.step, options.steps);',
        '  const fine = run(options.step / 2, options.steps * 2);',
        '  const reference = run(options.step / 16, options.steps * 16);',
        '',
        '  const e0 = system.energy(system.position, system.velocity);',
        '  const e1 = system.energy(coarse.x, coarse.v);',
        '',
        '  const coarseError = Math.abs(coarse.x - reference.x);',
        '  const fineError = Math.abs(fine.x - reference.x);',
        '  const order = fineError > 0 && Number.isFinite(coarseError / fineError)',
        '    ? Math.log2(coarseError / fineError) : null;',
        '',
        '  return {',
        '    state: [coarse.x, coarse.v],',
        '    energy: Math.abs((e1 - e0) / e0),',
        '    order: order',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'both methods integrate a unit spring to its exact cosine',
          assert: function (integrate, api) {
            const spring = {
              position: 1, velocity: 0,
              acceleration: function (x) { return -x; },
              energy: function (x, v) { return 0.5 * (x * x + v * v); }
            };
            ['verlet', 'rk4'].forEach(function (method) {
              const got = integrate(spring, { method: method, step: 0.001, steps: 1000 });
              api.assert.closeTo(got.state[0], Math.cos(1), 1e-5,
                method + ' must reach cos(1) after one time unit');
              api.assert.closeTo(got.state[1], -Math.sin(1), 1e-5,
                method + ' must reach -sin(1) for the velocity');
            });
          }
        },
        {
          name: 'the measured orders are 2 for Verlet and 4 for RK4',
          assert: function (integrate, api) {
            const spring = {
              position: 1, velocity: 0,
              acceleration: function (x) { return -x; },
              energy: function (x, v) { return 0.5 * (x * x + v * v); }
            };
            const verlet = integrate(spring, { method: 'verlet', step: 0.02, steps: 50 });
            const rk4 = integrate(spring, { method: 'rk4', step: 0.05, steps: 20 });

            api.assert.closeTo(verlet.order, 2, 0.2,
              'velocity Verlet is second order, measured ' + verlet.order);
            api.assert.closeTo(rk4.order, 4, 0.3,
              'RK4 is fourth order, measured ' + rk4.order);
          }
        },
        {
          name: 'Verlet holds its energy over 100 000 steps',
          assert: function (integrate, api) {
            const spring = {
              position: 1, velocity: 0,
              acceleration: function (x) { return -x; },
              energy: function (x, v) { return 0.5 * (x * x + v * v); }
            };
            const got = integrate(spring, { method: 'verlet', step: 0.05, steps: 100000 });

            api.assert.atMost(got.energy, 1e-3,
              'a symplectic method keeps the energy error bounded over a long run, measured ' +
              got.energy);
          }
        },
        {
          name: 'a stiffer spring changes the answer but not the order',
          assert: function (integrate, api) {
            const k = 9;
            const spring = {
              position: 1, velocity: 0,
              acceleration: function (x) { return -k * x; },
              energy: function (x, v) { return 0.5 * (k * x * x + v * v); }
            };
            const got = integrate(spring, { method: 'rk4', step: 0.01, steps: 100 });

            api.assert.closeTo(got.state[0], Math.cos(Math.sqrt(k) * 1), 1e-6,
              'the exact solution is cos(sqrt(k) t)');
            api.assert.closeTo(got.order, 4, 0.4,
              'the order is a property of the method, not of the system');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
