/**
 * Graded exercises for conditioning, root finding and linear systems
 * (M18.1-M18.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'conditioning-and-error': [{
      id: 'condition-by-power-method',
      title: 'Estimate a condition number without an SVD',
      prompt: 'conditionEstimate(matrix) must return { largest, smallest, condition } for a ' +
        'symmetric positive definite matrix given as an array of row arrays. Estimate the largest ' +
        'eigenvalue by power iteration: start from the vector 1, 2, … n, repeatedly multiply by ' +
        'the matrix, take the Rayleigh quotient xᵀAx / xᵀx as the estimate, and normalise. Do ' +
        'not start from a vector of ones: it is an eigenvector of every matrix with constant row ' +
        'sums, and power iteration started on an eigenvector never leaves it, so the estimate ' +
        'comes back as that eigenvalue whatever the others are. Estimate ' +
        'the smallest the same way on the INVERSE — but do not form the inverse. Instead solve ' +
        'Ay = x each step by Gaussian elimination with partial pivoting; the smallest eigenvalue ' +
        'of A is the reciprocal of the largest of A⁻¹. The condition number is the ratio. Iterate ' +
        'each until the estimate stops changing by more than 1e-12 relative, or for 500 steps. ' +
        'The starter runs the power iteration for the largest eigenvalue and then reports the ' +
        'SMALLEST diagonal entry as the smallest eigenvalue, which is a real heuristic and is ' +
        'wrong by orders of magnitude on any matrix that is not diagonal.',
      entry: 'conditionEstimate',
      starter: [
        'function conditionEstimate(matrix) {',
        '  const n = matrix.length;',
        '',
        '  function apply(m, v) {',
        '    const out = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = 0; j < n; j += 1) out[i] += m[i][j] * v[j];',
        '    }',
        '    return out;',
        '  }',
        '  function dot(a, b) {',
        '    let s = 0;',
        '    for (let i = 0; i < n; i += 1) s += a[i] * b[i];',
        '    return s;',
        '  }',
        '',
        '  const x0 = [];',
        '  for (let i = 0; i < n; i += 1) x0.push(i + 1);',
        '  let x = x0;',
        '  let largest = 0;',
        '  for (let step = 0; step < 500; step += 1) {',
        '    const y = apply(matrix, x);',
        '    largest = dot(x, y) / dot(x, x);',
        '    const norm = Math.sqrt(dot(y, y));',
        '    x = y.map(function (v) { return v / norm; });',
        '  }',
        '',
        '  // the shortcut: the smallest diagonal entry, which is not an eigenvalue',
        '  let smallest = matrix[0][0];',
        '  for (let i = 1; i < n; i += 1) smallest = Math.min(smallest, matrix[i][i]);',
        '',
        '  return { largest: largest, smallest: smallest, condition: largest / smallest };',
        '}'
      ].join('\n'),
      solution: [
        'function conditionEstimate(matrix) {',
        '  const n = matrix.length;',
        '',
        '  function apply(m, v) {',
        '    const out = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = 0; j < n; j += 1) out[i] += m[i][j] * v[j];',
        '    }',
        '    return out;',
        '  }',
        '  function dot(a, b) {',
        '    let s = 0;',
        '    for (let i = 0; i < n; i += 1) s += a[i] * b[i];',
        '    return s;',
        '  }',
        '',
        '  // partial pivoting, because a small pivot destroys the row below it',
        '  function solve(m, b) {',
        '    const a = m.map(function (row, i) { return row.concat([b[i]]); });',
        '    for (let k = 0; k < n; k += 1) {',
        '      let best = k;',
        '      for (let i = k + 1; i < n; i += 1) {',
        '        if (Math.abs(a[i][k]) > Math.abs(a[best][k])) best = i;',
        '      }',
        '      const swap = a[k]; a[k] = a[best]; a[best] = swap;',
        '      for (let i = k + 1; i < n; i += 1) {',
        '        const factor = a[i][k] / a[k][k];',
        '        for (let j = k; j <= n; j += 1) a[i][j] -= factor * a[k][j];',
        '      }',
        '    }',
        '    const x = new Array(n).fill(0);',
        '    for (let i = n - 1; i >= 0; i -= 1) {',
        '      let sum = a[i][n];',
        '      for (let j = i + 1; j < n; j += 1) sum -= a[i][j] * x[j];',
        '      x[i] = sum / a[i][i];',
        '    }',
        '    return x;',
        '  }',
        '',
        '  function iterate(step) {',
        '    let x = [];',
        '    for (let i = 0; i < n; i += 1) x.push(i + 1);',
        '    let value = 0;',
        '    for (let k = 0; k < 500; k += 1) {',
        '      const y = step(x);',
        '      const next = dot(x, y) / dot(x, x);',
        '      const norm = Math.sqrt(dot(y, y));',
        '      x = y.map(function (v) { return v / norm; });',
        '',
        '      if (k > 0 && Math.abs(next - value) <= 1e-12 * Math.abs(next)) { value = next; break; }',
        '      value = next;',
        '    }',
        '    return value;',
        '  }',
        '',
        '  const largest = iterate(function (v) { return apply(matrix, v); });',
        '  // the largest eigenvalue of the inverse, without forming the inverse',
        '  const inverseLargest = iterate(function (v) { return solve(matrix, v); });',
        '  const smallest = 1 / inverseLargest;',
        '',
        '  return { largest: largest, smallest: smallest, condition: largest / smallest };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a diagonal matrix, where the eigenvalues are visible',
          assert: function (conditionEstimate, api) {
            const got = conditionEstimate([[100, 0, 0], [0, 10, 0], [0, 0, 1]]);

            api.assert.closeTo(got.largest, 100, 1e-6, 'the largest diagonal entry is an eigenvalue here');
            api.assert.closeTo(got.smallest, 1, 1e-6, 'and so is the smallest');
            api.assert.closeTo(got.condition, 100, 1e-5, 'the ratio is the condition number');
          }
        },
        {
          name: 'a matrix whose smallest eigenvalue is nowhere on the diagonal',
          assert: function (conditionEstimate, api) {
            /* Eigenvalues 3 and 1: the diagonal is 2, 2 and neither is an
               eigenvalue, which is exactly what the starter's shortcut gets
               wrong. */
            const got = conditionEstimate([[2, 1], [1, 2]]);

            api.assert.closeTo(got.largest, 3, 1e-8, 'the largest eigenvalue is 3');
            api.assert.closeTo(got.smallest, 1, 1e-8,
              'the smallest is 1, and the smallest diagonal entry is 2');
            api.assert.closeTo(got.condition, 3, 1e-7, 'so the condition number is 3, not 1');
          }
        },
        {
          name: 'the Hilbert matrix at n = 4, where the condition number is large',
          assert: function (conditionEstimate, api) {
            const n = 4;
            const hilbert = [];
            for (let i = 0; i < n; i += 1) {
              const row = [];
              for (let j = 0; j < n; j += 1) row.push(1 / (i + j + 1));
              hilbert.push(row);
            }
            const got = conditionEstimate(hilbert);

            api.assert.atLeast(got.condition, 1e4,
              'the Hilbert matrix of size 4 has a condition number above ten thousand');
            api.assert.atMost(got.condition, 1e5, 'and below a hundred thousand');
            api.assert.ok(got.smallest > 0, 'it is positive definite, so every eigenvalue is positive');
          }
        },
        {
          name: 'built spectra: the estimate tracks the condition number it was built to have',
          assert: function (conditionEstimate, api) {
            const rng = api.Random.seeded(7);

            [10, 1e3, 1e5].forEach(function (target) {
              /* A rotation applied to a known diagonal, so the eigenvalues are
                 exactly [target, 1] and nothing is on the diagonal. */
              const angle = rng.next() * Math.PI;
              const c = Math.cos(angle);
              const s = Math.sin(angle);
              const m = [
                [target * c * c + s * s, (target - 1) * c * s],
                [(target - 1) * c * s, target * s * s + c * c]
              ];
              const got = conditionEstimate(m);

              api.assert.closeTo(got.condition / target, 1, 1e-4,
                'condition number at a built spectrum of ' + target);
            });
          }
        }
      ]
    }],

    'root-finding': [{
      id: 'brent-with-fallback',
      title: 'Brent’s method, with the bisection floor that makes it safe',
      prompt: 'brentRoot(f, a, b, tolerance) must return { root, iterations, bisections } for a ' +
        'continuous f with f(a) and f(b) of opposite signs. Keep three points: b is the current ' +
        'best, a is the contra-point on the other side of the root, and c is the previous b. Each ' +
        'step, propose an interpolated point — inverse quadratic interpolation when the three ' +
        'function values are distinct, otherwise a secant step. Accept the proposal ONLY if it ' +
        'lands strictly inside the bracket AND its distance from b is less than half the ' +
        'interval width of the step before last; otherwise bisect and count it. Then re-establish ' +
        'the bracket: if f at the new point and f(a) have the same sign, move a to the old b. ' +
        'Stop when the bracket is narrower than the tolerance or f(b) is exactly zero. The two ' +
        'acceptance conditions are the whole point — the starter drops them and always takes the ' +
        'interpolated step, which is false position, and on a convex function one endpoint never ' +
        'moves and the bracket stops shrinking.',
      entry: 'brentRoot',
      starter: [
        'function brentRoot(f, a, b, tolerance) {',
        '  let fa = f(a);',
        '  let fb = f(b);',
        '  let iterations = 0;',
        '',
        '  while (iterations < 200 && Math.abs(b - a) > tolerance) {',
        '    iterations += 1;',
        '    // always interpolate, never check whether it made progress',
        '    const next = b - fb * (b - a) / (fb - fa);',
        '    const fnext = f(next);',
        '',
        '    if (fnext === 0) return { root: next, iterations: iterations, bisections: 0 };',
        '',
        '    if ((fnext < 0) === (fa < 0)) { a = next; fa = fnext; } else { b = next; fb = fnext; }',
        '  }',
        '  return { root: Math.abs(fa) < Math.abs(fb) ? a : b, iterations: iterations, bisections: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function brentRoot(f, a, b, tolerance) {',
        '  let fa = f(a);',
        '  let fb = f(b);',
        '',
        '  if (Math.abs(fa) < Math.abs(fb)) {',
        '    const t = a; a = b; b = t;',
        '    const ft = fa; fa = fb; fb = ft;',
        '  }',
        '  let c = a;',
        '  let fc = fa;',
        '  let previousStep = Math.abs(b - a);',
        '  let usedBisection = true;',
        '  let iterations = 0;',
        '  let bisections = 0;',
        '',
        '  while (iterations < 200 && Math.abs(b - a) > tolerance && fb !== 0) {',
        '    iterations += 1;',
        '    let next = null;',
        '',
        '    if (fa !== fc && fb !== fc) {',
        '      // inverse quadratic interpolation through the three points',
        '      next = a * fb * fc / ((fa - fb) * (fa - fc)) +',
        '        b * fa * fc / ((fb - fa) * (fb - fc)) +',
        '        c * fa * fb / ((fc - fa) * (fc - fb));',
        '    } else if (fb !== fa) {',
        '      next = b - fb * (b - a) / (fb - fa);',
        '    }',
        '',
        '    const low = Math.min(a, b);',
        '    const high = Math.max(a, b);',
        '    const step = Math.abs(b - a);',
        '    const inside = next !== null && next > low && next < high;',
        '    const enough = next !== null && Math.abs(next - b) < previousStep / 2;',
        '',
        '    if (!inside || !enough) {',
        '      next = (a + b) / 2;',
        '      bisections += 1;',
        '      usedBisection = true;',
        '    } else {',
        '      usedBisection = false;',
        '    }',
        '    previousStep = usedBisection ? step : previousStep;',
        '',
        '    const fnext = f(next);',
        '    c = b; fc = fb;',
        '',
        '    if ((fnext < 0) === (fa < 0)) { a = next; fa = fnext; } else { b = next; fb = fnext; }',
        '',
        '    if (Math.abs(fa) < Math.abs(fb)) {',
        '      const t = a; a = b; b = t;',
        '      const ft = fa; fa = fb; fb = ft;',
        '    }',
        '  }',
        '  return { root: b, iterations: iterations, bisections: bisections };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the textbook cubic, to twelve digits and in few iterations',
          assert: function (brentRoot, api) {
            const f = function (x) { return x * x * x - 2 * x - 5; };
            const got = brentRoot(f, 2, 3, 1e-12);

            api.assert.closeTo(got.root, 2.0945514815423265, 1e-10,
              'the root of x^3 - 2x - 5 between 2 and 3');
            api.assert.atMost(got.iterations, 30,
              'a hybrid should beat bisection, which needs about 40 for this tolerance');
          }
        },
        {
          name: 'a convex function, where false position stalls and Brent does not',
          assert: function (brentRoot, api) {
            /* exp(x) - 4 is convex, so an unguarded interpolation leaves one
               endpoint fixed and the bracket never contracts. */
            const f = function (x) { return Math.exp(x) - 4; };
            const got = brentRoot(f, 0, 5, 1e-12);

            api.assert.closeTo(got.root, Math.log(4), 1e-10, 'the root of exp(x) = 4 is ln 4');
            api.assert.atMost(got.iterations, 60,
              'the progress test must stop this stalling; false position needs hundreds here');
            api.assert.atLeast(got.bisections, 1,
              'at least one step must have failed the progress test and fallen back');
          }
        },
        {
          name: 'functions where plain Newton diverges are no trouble at all',
          assert: function (brentRoot, api) {
            const cases = [
              { f: function (x) { return Math.atan(x); }, a: -5, b: 3, truth: 0 },
              { f: function (x) { return x * x * x - 2 * x; }, a: 1, b: 3, truth: Math.sqrt(2) },
              { f: function (x) { return Math.cos(x) - x; }, a: 0, b: 1,
                truth: 0.7390851332151607 }
            ];

            cases.forEach(function (item) {
              const got = brentRoot(item.f, item.a, item.b, 1e-12);
              api.assert.closeTo(got.root, item.truth, 1e-9,
                'Brent keeps the bracket where Newton would leave it');
            });
          }
        },
        {
          name: 'the bracket is never given up, on forty random polynomials',
          assert: function (brentRoot, api) {
            const rng = api.Random.seeded(21);

            for (let trial = 0; trial < 40; trial += 1) {
              const r = rng.next() * 4 - 2;
              const s = rng.next() * 2 + 3;
              const f = function (x) { return (x - r) * (x * x + s); };
              const got = brentRoot(f, -3, 3, 1e-10);

              api.assert.closeTo(got.root, r, 1e-7,
                'the only real root is at ' + r.toFixed(4));
              api.assert.atMost(Math.abs(f(got.root)), 1e-6, 'and f is small there');
            }
          }
        }
      ]
    }],

    'linear-systems': [{
      id: 'lu-with-pivoting',
      title: 'LU with partial pivoting, and the version that fails without it',
      prompt: 'luSolve(matrix, b, options) must return { x, growth, swaps } for a square matrix ' +
        'given as an array of row arrays. Factor in place with partial pivoting unless ' +
        '`options.pivot === false`: at each column k, find the row at or below k with the largest ' +
        'absolute entry in that column and swap it up, counting the swap. Then eliminate below ' +
        'with multiplier a[i][k] / a[k][k], storing the multiplier where the zero would go so L ' +
        'and U share one array. Apply the same row swaps to b as you go. Solve by forward ' +
        'substitution through the unit-diagonal L, then back substitution through U. `growth` is ' +
        'the largest absolute entry that appeared anywhere during elimination divided by the ' +
        'largest absolute entry of the original matrix — the quantity pivoting exists to bound. ' +
        'The starter never swaps, which is fine on most matrices and catastrophic on the one ' +
        'built for it.',
      entry: 'luSolve',
      starter: [
        'function luSolve(matrix, b, options) {',
        '  const n = matrix.length;',
        '  const a = matrix.map(function (row) { return row.slice(); });',
        '  const rhs = b.slice();',
        '  let biggest = 0;',
        '  a.forEach(function (row) {',
        '    row.forEach(function (v) { biggest = Math.max(biggest, Math.abs(v)); });',
        '  });',
        '  let seen = biggest;',
        '',
        '  // no pivoting at all',
        '  for (let k = 0; k < n; k += 1) {',
        '    for (let i = k + 1; i < n; i += 1) {',
        '      const m = a[i][k] / a[k][k];',
        '      a[i][k] = m;',
        '      for (let j = k + 1; j < n; j += 1) {',
        '        a[i][j] -= m * a[k][j];',
        '        seen = Math.max(seen, Math.abs(a[i][j]));',
        '      }',
        '      rhs[i] -= m * rhs[k];',
        '    }',
        '  }',
        '  const x = new Array(n).fill(0);',
        '  for (let i = n - 1; i >= 0; i -= 1) {',
        '    let sum = rhs[i];',
        '    for (let j = i + 1; j < n; j += 1) sum -= a[i][j] * x[j];',
        '    x[i] = sum / a[i][i];',
        '  }',
        '  return { x: x, growth: seen / biggest, swaps: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function luSolve(matrix, b, options) {',
        '  const n = matrix.length;',
        '  const pivot = !options || options.pivot !== false;',
        '  const a = matrix.map(function (row) { return row.slice(); });',
        '  const rhs = b.slice();',
        '  let biggest = 0;',
        '  a.forEach(function (row) {',
        '    row.forEach(function (v) { biggest = Math.max(biggest, Math.abs(v)); });',
        '  });',
        '  let seen = biggest;',
        '  let swaps = 0;',
        '',
        '  for (let k = 0; k < n; k += 1) {',
        '    if (pivot) {',
        '      let best = k;',
        '      for (let i = k + 1; i < n; i += 1) {',
        '        if (Math.abs(a[i][k]) > Math.abs(a[best][k])) best = i;',
        '      }',
        '      if (best !== k) {',
        '        const row = a[k]; a[k] = a[best]; a[best] = row;',
        '        const value = rhs[k]; rhs[k] = rhs[best]; rhs[best] = value;',
        '        swaps += 1;',
        '      }',
        '    }',
        '    for (let i = k + 1; i < n; i += 1) {',
        '      const m = a[i][k] / a[k][k];',
        '      a[i][k] = m;',
        '      for (let j = k + 1; j < n; j += 1) {',
        '        a[i][j] -= m * a[k][j];',
        '        seen = Math.max(seen, Math.abs(a[i][j]));',
        '      }',
        '      rhs[i] -= m * rhs[k];',
        '    }',
        '  }',
        '  const x = new Array(n).fill(0);',
        '  for (let i = n - 1; i >= 0; i -= 1) {',
        '    let sum = rhs[i];',
        '    for (let j = i + 1; j < n; j += 1) sum -= a[i][j] * x[j];',
        '    x[i] = sum / a[i][i];',
        '  }',
        '  return { x: x, growth: seen / biggest, swaps: swaps };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the tiny-pivot fixture: pivoting is exact, and not pivoting is not',
          assert: function (luSolve, api) {
            const epsilon = 1e-18;
            const m = [[epsilon, 1], [1, 1]];
            const b = [1, 2];

            const good = luSolve(m, b, { pivot: true });
            api.assert.closeTo(good.x[0], 1, 1e-9, 'x1 is 1/(1 - 1e-18), which is 1 to any tolerance');
            api.assert.closeTo(good.x[1], 1, 1e-9, 'and x2 is 2 - x1');
            api.assert.equal(good.swaps, 1, 'one swap was needed and taken');
            api.assert.atMost(good.growth, 2, 'the growth factor stays at about 1');

            const bad = luSolve(m, b, { pivot: false });
            api.assert.ok(Math.abs(bad.x[0] - 1) > 0.5,
              'without pivoting the first component is destroyed, not merely inaccurate');
            api.assert.atLeast(bad.growth, 1e15, 'and the growth factor records why');
          }
        },
        {
          name: 'Wilkinson’s matrix: partial pivoting swaps nothing and growth reaches 2^(n-1)',
          assert: function (luSolve, api) {
            [4, 8, 12].forEach(function (n) {
              const m = [];
              for (let i = 0; i < n; i += 1) {
                const row = new Array(n).fill(0);
                for (let j = 0; j < i; j += 1) row[j] = -1;
                row[i] = 1;
                row[n - 1] = 1;
                m.push(row);
              }
              const b = new Array(n).fill(1);
              const got = luSolve(m, b, { pivot: true });

              api.assert.equal(got.swaps, 0,
                'the diagonal entry is already the largest in every column at n = ' + n);
              api.assert.closeTo(got.growth, Math.pow(2, n - 1), 1,
                'and the growth factor is exactly 2^(n-1) at n = ' + n);
            });
          }
        },
        {
          name: 'the residual is at machine precision on thirty random systems',
          assert: function (luSolve, api) {
            const rng = api.Random.seeded(31);

            for (let trial = 0; trial < 30; trial += 1) {
              const n = 3 + api.rng.int(5);
              const m = [];
              const truth = [];
              for (let i = 0; i < n; i += 1) {
                const row = [];
                for (let j = 0; j < n; j += 1) row.push(rng.next() * 2 - 1);
                row[i] += n;
                m.push(row);
                truth.push(rng.next() * 2 - 1);
              }
              const b = m.map(function (row) {
                let s = 0;
                for (let j = 0; j < n; j += 1) s += row[j] * truth[j];
                return s;
              });
              const got = luSolve(m, b, { pivot: true });

              let worst = 0;
              for (let i = 0; i < n; i += 1) worst = Math.max(worst, Math.abs(got.x[i] - truth[i]));
              api.assert.atMost(worst, 1e-9,
                'a diagonally dominant system of size ' + n + ' should be solved to machine precision');
            }
          }
        },
        {
          name: 'the swap count and the growth factor are reported, not invented',
          assert: function (luSolve, api) {
            /* Rows in the worst possible order: every column needs a swap. */
            const m = [[1, 2, 3], [4, 5, 6], [7, 8, 10]];
            const b = [6, 15, 25];
            const got = luSolve(m, b, { pivot: true });

            api.assert.atLeast(got.swaps, 1, 'the first column needs the last row moved up');
            api.assert.atLeast(got.growth, 1, 'growth is at least 1 by definition');
            api.assert.atMost(got.growth, 4, 'and partial pivoting keeps it small here');
            api.assert.closeTo(got.x[0], 1, 1e-9, 'the solution is [1, 1, 1]');
            api.assert.closeTo(got.x[1], 1, 1e-9, 'the solution is [1, 1, 1]');
            api.assert.closeTo(got.x[2], 1, 1e-9, 'the solution is [1, 1, 1]');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
