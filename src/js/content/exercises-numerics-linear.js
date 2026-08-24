/**
 * Graded exercises for least squares, QR, the SVD and eigenvalues
 * (M18.4-M18.5).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'least-squares': [{
      id: 'householder-least-squares',
      title: 'Householder QR, and the least-squares solve it gives you',
      prompt: 'householderSolve(matrix, b) must return { x, orthogonalityLoss } for an ' +
        'overdetermined system given as an array of m row arrays of n entries, with m ≥ n. Work ' +
        'column by column: for column k, take the sub-column from row k down, build the ' +
        'Householder vector v = a + sign(a₀)‖a‖e₁ — the sign choice is what avoids cancellation ' +
        'when a₀ and the norm nearly agree — and apply the reflection H = I − 2vvᵀ/(vᵀv) to the ' +
        'remaining columns and to b. Because H is orthogonal, ‖Ax − b‖ is unchanged by it, so ' +
        'after n columns the problem is triangular and the first n rows of b give x by back ' +
        'substitution. Return the loss ‖QᵀQ − I‖ measured on the accumulated Q as a check on your ' +
        'own work. The starter uses classical Gram–Schmidt, which is the textbook derivation and ' +
        'loses orthogonality catastrophically on an ill-conditioned matrix.',
      entry: 'householderSolve',
      starter: [
        'function householderSolve(matrix, b) {',
        '  const m = matrix.length;',
        '  const n = matrix[0].length;',
        '',
        '  // classical Gram-Schmidt: every projection is of the ORIGINAL column',
        '  const q = [];',
        '  const r = [];',
        '  for (let k = 0; k < n; k += 1) {',
        '    const original = [];',
        '    for (let i = 0; i < m; i += 1) original.push(matrix[i][k]);',
        '    const v = original.slice();',
        '    const row = new Array(n).fill(0);',
        '',
        '    for (let j = 0; j < k; j += 1) {',
        '      let dot = 0;',
        '      for (let i = 0; i < m; i += 1) dot += q[j][i] * original[i];',
        '      row[j] = dot;',
        '      for (let i = 0; i < m; i += 1) v[i] -= dot * q[j][i];',
        '    }',
        '    let norm = 0;',
        '    for (let i = 0; i < m; i += 1) norm += v[i] * v[i];',
        '    norm = Math.sqrt(norm);',
        '    row[k] = norm;',
        '    q.push(v.map(function (value) { return value / norm; }));',
        '    r.push(row);',
        '  }',
        '',
        '  const qtb = q.map(function (column) {',
        '    let s = 0;',
        '    for (let i = 0; i < m; i += 1) s += column[i] * b[i];',
        '    return s;',
        '  });',
        '  const x = new Array(n).fill(0);',
        '  for (let i = n - 1; i >= 0; i -= 1) {',
        '    let sum = qtb[i];',
        '    for (let j = i + 1; j < n; j += 1) sum -= r[j][i] * x[j];',
        '    x[i] = sum / r[i][i];',
        '  }',
        '',
        '  let loss = 0;',
        '  for (let a = 0; a < n; a += 1) {',
        '    for (let c = 0; c < n; c += 1) {',
        '      let dot = 0;',
        '      for (let i = 0; i < m; i += 1) dot += q[a][i] * q[c][i];',
        '      loss = Math.max(loss, Math.abs(dot - (a === c ? 1 : 0)));',
        '    }',
        '  }',
        '  return { x: x, orthogonalityLoss: loss };',
        '}'
      ].join('\n'),
      solution: [
        'function householderSolve(matrix, b) {',
        '  const m = matrix.length;',
        '  const n = matrix[0].length;',
        '  const a = matrix.map(function (row) { return row.slice(); });',
        '  const rhs = b.slice();',
        '  const vectors = [];',
        '',
        '  for (let k = 0; k < n; k += 1) {',
        '    let norm = 0;',
        '    for (let i = k; i < m; i += 1) norm += a[i][k] * a[i][k];',
        '    norm = Math.sqrt(norm);',
        '',
        '    if (norm === 0) { vectors.push(null); continue; }',
        '',
        '    // the sign choice: add rather than subtract when a[k][k] is positive,',
        '    // so the leading entry never cancels',
        '    const sign = a[k][k] >= 0 ? 1 : -1;',
        '    const v = new Array(m).fill(0);',
        '    for (let i = k; i < m; i += 1) v[i] = a[i][k];',
        '    v[k] += sign * norm;',
        '',
        '    let vv = 0;',
        '    for (let i = k; i < m; i += 1) vv += v[i] * v[i];',
        '',
        '    if (vv === 0) { vectors.push(null); continue; }',
        '',
        '    for (let c = k; c < n; c += 1) {',
        '      let dot = 0;',
        '      for (let i = k; i < m; i += 1) dot += v[i] * a[i][c];',
        '      const scale = 2 * dot / vv;',
        '      for (let i = k; i < m; i += 1) a[i][c] -= scale * v[i];',
        '    }',
        '    let dotB = 0;',
        '    for (let i = k; i < m; i += 1) dotB += v[i] * rhs[i];',
        '    const scaleB = 2 * dotB / vv;',
        '    for (let i = k; i < m; i += 1) rhs[i] -= scaleB * v[i];',
        '',
        '    vectors.push({ v: v, vv: vv, from: k });',
        '  }',
        '',
        '  const x = new Array(n).fill(0);',
        '  for (let i = n - 1; i >= 0; i -= 1) {',
        '    let sum = rhs[i];',
        '    for (let j = i + 1; j < n; j += 1) sum -= a[i][j] * x[j];',
        '    x[i] = sum / a[i][i];',
        '  }',
        '',
        '  // rebuild the first n columns of Q by applying the reflections in reverse',
        '  const q = [];',
        '  for (let c = 0; c < n; c += 1) {',
        '    const column = new Array(m).fill(0);',
        '    column[c] = 1;',
        '    for (let k = n - 1; k >= 0; k -= 1) {',
        '      const h = vectors[k];',
        '',
        '      if (!h) continue;',
        '      let dot = 0;',
        '      for (let i = h.from; i < m; i += 1) dot += h.v[i] * column[i];',
        '      const scale = 2 * dot / h.vv;',
        '      for (let i = h.from; i < m; i += 1) column[i] -= scale * h.v[i];',
        '    }',
        '    q.push(column);',
        '  }',
        '  let loss = 0;',
        '  for (let p = 0; p < n; p += 1) {',
        '    for (let c = 0; c < n; c += 1) {',
        '      let dot = 0;',
        '      for (let i = 0; i < m; i += 1) dot += q[p][i] * q[c][i];',
        '      loss = Math.max(loss, Math.abs(dot - (p === c ? 1 : 0)));',
        '    }',
        '  }',
        '  return { x: x, orthogonalityLoss: loss };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an exact fit recovers the coefficients it was built from',
          assert: function (householderSolve, api) {
            /* Data generated from 2 - 3x + x^2, sampled at eight points, so the
               least-squares answer is that polynomial exactly. */
            const nodes = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75];
            const m = nodes.map(function (x) { return [1, x, x * x]; });
            const b = nodes.map(function (x) { return 2 - 3 * x + x * x; });
            const got = householderSolve(m, b);

            api.assert.closeTo(got.x[0], 2, 1e-9, 'the constant term');
            api.assert.closeTo(got.x[1], -3, 1e-9, 'the linear term');
            api.assert.closeTo(got.x[2], 1, 1e-9, 'the quadratic term');
          }
        },
        {
          name: 'the residual is orthogonal to every column, which is what least squares means',
          assert: function (householderSolve, api) {
            const rng = api.Random.seeded(13);
            const m = [];
            const b = [];
            for (let i = 0; i < 20; i += 1) {
              const x = i / 19;
              m.push([1, x, x * x, x * x * x]);
              b.push(Math.exp(x) + 0.01 * rng.gaussian(0, 1));
            }
            const got = householderSolve(m, b);

            for (let c = 0; c < 4; c += 1) {
              let dot = 0;
              for (let i = 0; i < 20; i += 1) {
                let fitted = 0;
                for (let j = 0; j < 4; j += 1) fitted += m[i][j] * got.x[j];
                dot += m[i][c] * (fitted - b[i]);
              }
              api.assert.atMost(Math.abs(dot), 1e-9,
                'the residual must be orthogonal to column ' + c);
            }
          }
        },
        {
          name: 'Q stays orthogonal on an ill-conditioned Vandermonde',
          assert: function (householderSolve, api) {
            /* Degree 9 at 12 nodes: condition number about 7e6, where classical
               Gram-Schmidt loses orthogonality to about 1e-1. */
            const points = 12;
            const degree = 9;
            const m = [];
            const b = [];
            for (let i = 0; i < points; i += 1) {
              const x = i / (points - 1);
              const row = [];
              let power = 1;
              for (let j = 0; j <= degree; j += 1) { row.push(power); power *= x; }
              m.push(row);
              b.push(Math.exp(x));
            }
            const got = householderSolve(m, b);

            api.assert.atMost(got.orthogonalityLoss, 1e-12,
              'Householder must stay orthogonal to machine precision here');
          }
        },
        {
          name: 'it beats the normal equations on a matrix built to punish them',
          assert: function (householderSolve, api) {
            const points = 14;
            const degree = 8;
            const truth = [];
            for (let j = 0; j <= degree; j += 1) truth.push(1 / (j + 1));

            const m = [];
            const b = [];
            for (let i = 0; i < points; i += 1) {
              const x = i / (points - 1);
              const row = [];
              let power = 1;
              for (let j = 0; j <= degree; j += 1) { row.push(power); power *= x; }
              m.push(row);
              let value = 0;
              for (let j = 0; j <= degree; j += 1) value += row[j] * truth[j];
              b.push(value);
            }
            const got = householderSolve(m, b);

            let worst = 0;
            for (let j = 0; j <= degree; j += 1) {
              worst = Math.max(worst, Math.abs(got.x[j] - truth[j]));
            }
            api.assert.atMost(worst, 1e-6,
              'the exact coefficients must be recovered despite the conditioning');
          }
        }
      ]
    }],

    'eigenvalues': [{
      id: 'shifted-inverse-iteration',
      title: 'Shifted inverse iteration, reaching the eigenvalue you name',
      prompt: 'nearestEigenpair(matrix, shift) must return { value, vector, iterations, residual } ' +
        'for a symmetric matrix, finding the eigenvalue nearest `shift`. Form A − σI once and ' +
        'factor it with partial pivoting; then iterate x := solve(A − σI, x) followed by ' +
        'normalisation. Do not form the inverse — factor once outside the loop and solve inside ' +
        'it. Report the eigenvalue as the Rayleigh quotient xᵀAx / xᵀx of the final vector, not as ' +
        'σ plus the reciprocal of anything, because the quotient is accurate to the square of the ' +
        'vector’s error. Stop when ‖Ax − λx‖ falls below 1e-12 or after 200 steps, and return that ' +
        'residual. Start from the vector 1, 2, … n rather than from all ones, which is an ' +
        'eigenvector of any matrix with constant row sums and would pin the iteration to that ' +
        'eigenvalue forever. Any fixed starting vector can in principle be deficient in the ' +
        'direction you want — which is why production implementations randomise it — but 1, 2, ' +
        '… n is what these tests are built against. The starter runs plain power iteration, ' +
        'which finds only the largest eigenvalue and ignores the shift entirely.',
      entry: 'nearestEigenpair',
      starter: [
        'function nearestEigenpair(matrix, shift) {',
        '  const n = matrix.length;',
        '',
        '  function apply(v) {',
        '    const out = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = 0; j < n; j += 1) out[i] += matrix[i][j] * v[j];',
        '    }',
        '    return out;',
        '  }',
        '  function dot(a, b) {',
        '    let s = 0;',
        '    for (let i = 0; i < n; i += 1) s += a[i] * b[i];',
        '    return s;',
        '  }',
        '',
        '  let x = [];',
        '  for (let i = 0; i < n; i += 1) x.push(i + 1);',
        '  let iterations = 0;',
        '',
        '  // plain power iteration: the shift is never used at all',
        '  for (let step = 0; step < 200; step += 1) {',
        '    iterations += 1;',
        '    const y = apply(x);',
        '    const norm = Math.sqrt(dot(y, y));',
        '    x = y.map(function (v) { return v / norm; });',
        '  }',
        '  const value = dot(x, apply(x)) / dot(x, x);',
        '  const r = apply(x).map(function (v, i) { return v - value * x[i]; });',
        '  return { value: value, vector: x, iterations: iterations,',
        '    residual: Math.sqrt(dot(r, r)) };',
        '}'
      ].join('\n'),
      solution: [
        'function nearestEigenpair(matrix, shift) {',
        '  const n = matrix.length;',
        '',
        '  function apply(v) {',
        '    const out = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = 0; j < n; j += 1) out[i] += matrix[i][j] * v[j];',
        '    }',
        '    return out;',
        '  }',
        '  function dot(a, b) {',
        '    let s = 0;',
        '    for (let i = 0; i < n; i += 1) s += a[i] * b[i];',
        '    return s;',
        '  }',
        '',
        '  // factor A - shift*I ONCE, with partial pivoting',
        '  const lu = [];',
        '  for (let i = 0; i < n; i += 1) {',
        '    const row = matrix[i].slice();',
        '    row[i] -= shift;',
        '    lu.push(row);',
        '  }',
        '  const order = [];',
        '  for (let i = 0; i < n; i += 1) order.push(i);',
        '',
        '  for (let k = 0; k < n; k += 1) {',
        '    let best = k;',
        '    for (let i = k + 1; i < n; i += 1) {',
        '      if (Math.abs(lu[i][k]) > Math.abs(lu[best][k])) best = i;',
        '    }',
        '    const row = lu[k]; lu[k] = lu[best]; lu[best] = row;',
        '    const index = order[k]; order[k] = order[best]; order[best] = index;',
        '',
        '    for (let i = k + 1; i < n; i += 1) {',
        '      const m = lu[i][k] / lu[k][k];',
        '      lu[i][k] = m;',
        '      for (let j = k + 1; j < n; j += 1) lu[i][j] -= m * lu[k][j];',
        '    }',
        '  }',
        '',
        '  function solve(b) {',
        '    const y = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      let sum = b[order[i]];',
        '      for (let j = 0; j < i; j += 1) sum -= lu[i][j] * y[j];',
        '      y[i] = sum;',
        '    }',
        '    const out = new Array(n).fill(0);',
        '    for (let i = n - 1; i >= 0; i -= 1) {',
        '      let sum = y[i];',
        '      for (let j = i + 1; j < n; j += 1) sum -= lu[i][j] * out[j];',
        '      out[i] = sum / lu[i][i];',
        '    }',
        '    return out;',
        '  }',
        '',
        '  let x = [];',
        '  for (let i = 0; i < n; i += 1) x.push(i + 1);',
        '  let norm = Math.sqrt(dot(x, x));',
        '  x = x.map(function (v) { return v / norm; });',
        '  let value = dot(x, apply(x));',
        '  let residual = Infinity;',
        '  let iterations = 0;',
        '',
        '  for (let step = 0; step < 200; step += 1) {',
        '    iterations += 1;',
        '    const y = solve(x);',
        '    norm = Math.sqrt(dot(y, y));',
        '',
        '    if (!Number.isFinite(norm) || norm === 0) break;',
        '    x = y.map(function (v) { return v / norm; });',
        '',
        '    // the Rayleigh quotient, accurate to the SQUARE of the vector error',
        '    value = dot(x, apply(x)) / dot(x, x);',
        '    const r = apply(x).map(function (v, i) { return v - value * x[i]; });',
        '    residual = Math.sqrt(dot(r, r));',
        '',
        '    if (residual < 1e-12) break;',
        '  }',
        '  return { value: value, vector: x, iterations: iterations, residual: residual };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it reaches the SMALLEST eigenvalue, which power iteration cannot',
          assert: function (nearestEigenpair, api) {
            const m = [[10, 0, 0], [0, 5, 0], [0, 0, 1]];
            const got = nearestEigenpair(m, 1.2);

            api.assert.closeTo(got.value, 1, 1e-9,
              'aiming at 1.2 must find the eigenvalue 1, not the eigenvalue 10');
            api.assert.atMost(got.residual, 1e-10, 'and the eigenpair residual must be tiny');
            api.assert.atMost(got.iterations, 60, 'in far fewer steps than power iteration needs');
          }
        },
        {
          name: 'every eigenvalue of a spread spectrum is reachable by naming it',
          assert: function (nearestEigenpair, api) {
            const spectrum = [10, 5, 2, 1];
            const n = spectrum.length;
            /* A symmetric matrix with that spectrum, built by conjugating the
               diagonal with a fixed rotation in the (0, 2) plane. */
            const c = Math.cos(0.7);
            const s = Math.sin(0.7);
            const m = [];
            for (let i = 0; i < n; i += 1) m.push(new Array(n).fill(0));
            for (let i = 0; i < n; i += 1) m[i][i] = spectrum[i];
            const a00 = m[0][0];
            const a22 = m[2][2];
            m[0][0] = c * c * a00 + s * s * a22;
            m[2][2] = s * s * a00 + c * c * a22;
            m[0][2] = c * s * (a00 - a22);
            m[2][0] = m[0][2];

            spectrum.forEach(function (target) {
              const got = nearestEigenpair(m, target + 0.2);
              api.assert.closeTo(got.value, target, 1e-8,
                'aiming 0.2 above ' + target + ' must find ' + target);
            });
          }
        },
        {
          name: 'the returned vector really is an eigenvector',
          assert: function (nearestEigenpair, api) {
            const m = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
            const got = nearestEigenpair(m, 4.4);
            const n = 3;

            let norm = 0;
            for (let i = 0; i < n; i += 1) norm += got.vector[i] * got.vector[i];
            api.assert.closeTo(Math.sqrt(norm), 1, 1e-9, 'the vector must be normalised');

            for (let i = 0; i < n; i += 1) {
              let av = 0;
              for (let j = 0; j < n; j += 1) av += m[i][j] * got.vector[j];
              api.assert.closeTo(av, got.value * got.vector[i], 1e-8,
                'A v must equal lambda v in component ' + i);
            }
          }
        },
        {
          name: 'the all-ones trap: a constant-row-sum matrix does not fool it',
          assert: function (nearestEigenpair, api) {
            /* Row sums are all 4, so [1, 1, 1] is an eigenvector for 4 and the
               other eigenvalue is 1. An implementation started on the all-ones
               vector reports 4 whatever shift it is given. */
            const m = [[2, 1, 1], [1, 2, 1], [1, 1, 2]];
            const got = nearestEigenpair(m, 0.8);

            api.assert.ok(Math.abs(got.value - 4) > 0.5,
              'aiming at 0.8 must not return the constant-row-sum eigenvalue 4');
            api.assert.closeTo(got.value, 1, 1e-7, 'the eigenvalue nearest 0.8 is 1');
            api.assert.atMost(got.residual, 1e-9, 'and the residual must confirm it');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
