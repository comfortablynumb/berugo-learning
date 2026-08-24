/**
 * Graded exercises for Fourier transforms and optimisation (M18.9-M18.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'fourier-transforms': [{
      id: 'iterative-radix-2-fft',
      title: 'An iterative radix-2 FFT, with the bit-reversal that makes it in-place',
      prompt: 'fft(re, im, inverse) must transform the two arrays in place and return ' +
        '{ re, im, butterflies }. Start with the bit-reversal permutation: for each index i, ' +
        'compute the index with its log₂n bits reversed and swap when the reversed index is ' +
        'larger, so each pair is swapped once. Then run log₂n stages; at stage with half-size m, ' +
        'walk the array in blocks of 2m and combine element j with element j + m using the twiddle ' +
        'factor e^(∓2πik/2m), where the sign is negative for the forward transform. Count one ' +
        'butterfly per combined pair — the total must come to exactly (n/2)log₂n. For the inverse, ' +
        'flip the twiddle sign and divide every output by n. The starter computes the naive DFT, ' +
        'which is correct and costs n² operations, and reports no butterflies because it performs ' +
        'none.',
      entry: 'fft',
      starter: [
        'function fft(re, im, inverse) {',
        '  const n = re.length;',
        '  const outRe = new Array(n).fill(0);',
        '  const outIm = new Array(n).fill(0);',
        '  const sign = inverse ? 1 : -1;',
        '',
        '  // the naive DFT: n^2 operations, no butterflies at all',
        '  for (let k = 0; k < n; k += 1) {',
        '    for (let j = 0; j < n; j += 1) {',
        '      const angle = sign * 2 * Math.PI * j * k / n;',
        '      const c = Math.cos(angle);',
        '      const s = Math.sin(angle);',
        '      outRe[k] += re[j] * c - im[j] * s;',
        '      outIm[k] += re[j] * s + im[j] * c;',
        '    }',
        '  }',
        '  for (let i = 0; i < n; i += 1) {',
        '    re[i] = inverse ? outRe[i] / n : outRe[i];',
        '    im[i] = inverse ? outIm[i] / n : outIm[i];',
        '  }',
        '  return { re: re, im: im, butterflies: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function fft(re, im, inverse) {',
        '  const n = re.length;',
        '  let levels = 0;',
        '  while ((1 << levels) < n) levels += 1;',
        '',
        '  // bit-reversal permutation, so the iterative stages can work in place',
        '  for (let i = 0; i < n; i += 1) {',
        '    let reversed = 0;',
        '    for (let bit = 0; bit < levels; bit += 1) {',
        '      reversed = (reversed << 1) | ((i >>> bit) & 1);',
        '    }',
        '',
        '    if (reversed > i) {',
        '      const tr = re[i]; re[i] = re[reversed]; re[reversed] = tr;',
        '      const ti = im[i]; im[i] = im[reversed]; im[reversed] = ti;',
        '    }',
        '  }',
        '',
        '  const sign = inverse ? 1 : -1;',
        '  let butterflies = 0;',
        '',
        '  for (let size = 2; size <= n; size *= 2) {',
        '    const half = size / 2;',
        '    const step = sign * 2 * Math.PI / size;',
        '    for (let start = 0; start < n; start += size) {',
        '      for (let k = 0; k < half; k += 1) {',
        '        const angle = step * k;',
        '        const wr = Math.cos(angle);',
        '        const wi = Math.sin(angle);',
        '        const a = start + k;',
        '        const b = a + half;',
        '',
        '        const tr = re[b] * wr - im[b] * wi;',
        '        const ti = re[b] * wi + im[b] * wr;',
        '        re[b] = re[a] - tr;',
        '        im[b] = im[a] - ti;',
        '        re[a] = re[a] + tr;',
        '        im[a] = im[a] + ti;',
        '        butterflies += 1;',
        '      }',
        '    }',
        '  }',
        '',
        '  if (inverse) {',
        '    for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }',
        '  }',
        '  return { re: re, im: im, butterflies: butterflies };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with the naive DFT, and costs exactly (n/2)log2(n) butterflies',
          assert: function (fft, api) {
            [8, 16, 32, 64].forEach(function (n) {
              const re = [];
              const im = [];
              for (let i = 0; i < n; i += 1) {
                re.push(Math.sin(3 * i) + 0.3 * Math.cos(7 * i));
                im.push(0);
              }
              const naiveRe = new Array(n).fill(0);
              const naiveIm = new Array(n).fill(0);
              for (let k = 0; k < n; k += 1) {
                for (let j = 0; j < n; j += 1) {
                  const angle = -2 * Math.PI * j * k / n;
                  naiveRe[k] += re[j] * Math.cos(angle);
                  naiveIm[k] += re[j] * Math.sin(angle);
                }
              }
              const got = fft(re.slice(), im.slice(), false);

              api.assert.equal(got.butterflies, (n / 2) * Math.log2(n),
                'the butterfly count at n = ' + n + ' must be exactly (n/2)log2(n)');
              for (let k = 0; k < n; k += 1) {
                api.assert.closeTo(got.re[k], naiveRe[k], 1e-9, 'real part of bin ' + k);
                api.assert.closeTo(got.im[k], naiveIm[k], 1e-9, 'imaginary part of bin ' + k);
              }
            });
          }
        },
        {
          name: 'forward then inverse returns the original signal',
          assert: function (fft, api) {
            const rng = api.Random.seeded(9);
            [64, 256, 1024].forEach(function (n) {
              const re = [];
              const im = [];
              for (let i = 0; i < n; i += 1) {
                re.push(Math.sin(0.01 * i) + 0.5 * Math.cos(0.13 * i));
                im.push(0);
              }
              const original = re.slice();
              const forward = fft(re, im, false);
              const back = fft(forward.re, forward.im, true);

              let worst = 0;
              for (let i = 0; i < n; i += 1) {
                worst = Math.max(worst, Math.abs(back.re[i] - original[i]));
              }
              api.assert.atMost(worst, 1e-10,
                'the round trip at n = ' + n + ' must return the input, measured ' + worst);
              api.assert.ok(rng.next() >= 0, 'the seeded generator is available');
            });
          }
        },
        {
          name: 'a pure tone on a bin gives one clean spike',
          assert: function (fft, api) {
            const n = 64;
            const bin = 5;
            const re = [];
            const im = [];
            for (let i = 0; i < n; i += 1) {
              re.push(Math.cos(2 * Math.PI * bin * i / n));
              im.push(0);
            }
            const got = fft(re, im, false);

            for (let k = 0; k < n / 2; k += 1) {
              const magnitude = Math.hypot(got.re[k], got.im[k]);
              if (k === bin) {
                api.assert.closeTo(magnitude, n / 2, 1e-8,
                  'the energy is concentrated in bin ' + bin);
              } else {
                api.assert.atMost(magnitude, 1e-8,
                  'and every other bin is empty, including bin ' + k);
              }
            }
          }
        },
        {
          name: 'polynomial multiplication through the convolution theorem is exact after rounding',
          assert: function (fft, api) {
            const a = [3, 1, 4, 1, 5, 9, 2, 6];
            const b = [2, 7, 1, 8, 2, 8];
            const needed = a.length + b.length - 1;
            let size = 1;
            while (size < needed) size *= 2;

            const ar = new Array(size).fill(0);
            const ai = new Array(size).fill(0);
            const br = new Array(size).fill(0);
            const bi = new Array(size).fill(0);
            a.forEach(function (v, i) { ar[i] = v; });
            b.forEach(function (v, i) { br[i] = v; });

            const fa = fft(ar, ai, false);
            const fb = fft(br, bi, false);
            const pr = new Array(size).fill(0);
            const pi = new Array(size).fill(0);
            for (let k = 0; k < size; k += 1) {
              pr[k] = fa.re[k] * fb.re[k] - fa.im[k] * fb.im[k];
              pi[k] = fa.re[k] * fb.im[k] + fa.im[k] * fb.re[k];
            }
            const back = fft(pr, pi, true);

            const schoolbook = new Array(needed).fill(0);
            a.forEach(function (av, i) {
              b.forEach(function (bv, j) { schoolbook[i + j] += av * bv; });
            });
            for (let k = 0; k < needed; k += 1) {
              api.assert.equal(Math.round(back.re[k]), schoolbook[k],
                'coefficient ' + k + ' must match the schoolbook product after rounding');
            }
          }
        }
      ]
    }],

    'optimisation': [{
      id: 'backtracking-line-search',
      title: 'A backtracking line search satisfying the Armijo condition',
      prompt: 'descend(problem, start, options) must return { x, iterations, evaluations, ' +
        'monotone } for a problem exposing f(x) and gradient(x) over arrays. Take the steepest ' +
        'descent direction d = −g. If options.lineSearch is set, choose the step by backtracking: ' +
        'begin at t = 1 and halve until f(x + td) ≤ f(x) + c·t·(g · d) with c = 1e-4 — note that ' +
        'g · d is negative for a descent direction, so the right-hand side is BELOW f(x) and the ' +
        'condition demands a decrease proportional to the step taken, not merely any decrease. ' +
        'Otherwise use the fixed options.step. Stop when the gradient norm falls below the ' +
        'tolerance or the iteration limit is reached. Count every f and gradient call in ' +
        '`evaluations`, and set `monotone` to whether the objective never rose. The starter uses ' +
        'a fixed step and ignores the lineSearch flag, so it diverges on any surface whose ' +
        'curvature exceeds twice the reciprocal of that step.',
      entry: 'descend',
      starter: [
        'function descend(problem, start, options) {',
        '  const settings = options || {};',
        '  const step = settings.step === undefined ? 0.01 : settings.step;',
        '  const tolerance = settings.tolerance === undefined ? 1e-8 : settings.tolerance;',
        '  const limit = settings.limit === undefined ? 5000 : settings.limit;',
        '',
        '  let x = start.slice();',
        '  let evaluations = 0;',
        '  let iterations = 0;',
        '  let monotone = true;',
        '  let previous = problem.f(x);',
        '  evaluations += 1;',
        '',
        '  while (iterations < limit) {',
        '    const g = problem.gradient(x);',
        '    evaluations += 1;',
        '    let norm = 0;',
        '    for (let i = 0; i < g.length; i += 1) norm += g[i] * g[i];',
        '    norm = Math.sqrt(norm);',
        '',
        '    if (norm < tolerance) break;',
        '    iterations += 1;',
        '',
        '    // a fixed step, whatever the surface does',
        '    x = x.map(function (v, i) { return v - step * g[i]; });',
        '    const value = problem.f(x);',
        '    evaluations += 1;',
        '',
        '    if (value > previous) monotone = false;',
        '    previous = value;',
        '  }',
        '  return { x: x, iterations: iterations, evaluations: evaluations, monotone: monotone };',
        '}'
      ].join('\n'),
      solution: [
        'function descend(problem, start, options) {',
        '  const settings = options || {};',
        '  const fixed = settings.step === undefined ? 0.01 : settings.step;',
        '  const tolerance = settings.tolerance === undefined ? 1e-8 : settings.tolerance;',
        '  const limit = settings.limit === undefined ? 5000 : settings.limit;',
        '  const c = 1e-4;',
        '',
        '  let x = start.slice();',
        '  let evaluations = 0;',
        '  let iterations = 0;',
        '  let monotone = true;',
        '  let value = problem.f(x);',
        '  evaluations += 1;',
        '',
        '  while (iterations < limit) {',
        '    const g = problem.gradient(x);',
        '    evaluations += 1;',
        '    let norm = 0;',
        '    for (let i = 0; i < g.length; i += 1) norm += g[i] * g[i];',
        '    norm = Math.sqrt(norm);',
        '',
        '    if (!Number.isFinite(norm) || norm < tolerance) break;',
        '    iterations += 1;',
        '',
        '    // d = -g, so slope = g . d = -|g|^2, which is negative',
        '    const slope = -norm * norm;',
        '    let t = fixed;',
        '',
        '    if (settings.lineSearch) {',
        '      t = 1;',
        '      for (let probe = 0; probe < 60; probe += 1) {',
        '        const trial = x.map(function (v, i) { return v - t * g[i]; });',
        '        const trialValue = problem.f(trial);',
        '        evaluations += 1;',
        '',
        '        // the Armijo condition: a decrease PROPORTIONAL to the step',
        '        if (trialValue <= value + c * t * slope) break;',
        '        t /= 2;',
        '      }',
        '    }',
        '    const next = x.map(function (v, i) { return v - t * g[i]; });',
        '    const nextValue = problem.f(next);',
        '    evaluations += 1;',
        '',
        '    if (nextValue > value) monotone = false;',
        '    x = next;',
        '    value = nextValue;',
        '',
        '    if (!Number.isFinite(value)) break;',
        '  }',
        '  return { x: x, iterations: iterations, evaluations: evaluations, monotone: monotone };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the objective never rises when a line search chooses the step',
          assert: function (descend, api) {
            const problem = {
              f: function (x) { return 100 * (x[1] - x[0] * x[0]) * (x[1] - x[0] * x[0]) +
                (1 - x[0]) * (1 - x[0]); },
              gradient: function (x) {
                return [-2 * (1 - x[0]) - 400 * x[0] * (x[1] - x[0] * x[0]),
                  200 * (x[1] - x[0] * x[0])];
              }
            };
            const got = descend(problem, [-1.2, 1], { lineSearch: true, limit: 3000 });

            api.assert.equal(got.monotone, true,
              'the Armijo condition guarantees a decrease at every accepted step');
            api.assert.atMost(problem.f(got.x), 1e-3,
              'and it must make real progress, reaching ' + problem.f(got.x));
          }
        },
        {
          name: 'it converges where a fixed step of the same size diverges',
          assert: function (descend, api) {
            /* Curvature 400 in one direction, so the stability limit for a fixed
               step is 2/400 = 0.005 and a step of 0.01 explodes. */
            const problem = {
              f: function (x) { return 200 * x[0] * x[0] + x[1] * x[1]; },
              gradient: function (x) { return [400 * x[0], 2 * x[1]]; }
            };
            const diverged = descend(problem, [1, 1], { step: 0.01, limit: 200 });
            api.assert.ok(!Number.isFinite(problem.f(diverged.x)) ||
              problem.f(diverged.x) > 1e6,
            'a fixed step of 0.01 is above the stability limit and must blow up');

            /* Converges in 1 732 iterations - the count is set by the
               condition number of 200, which a first-order method pays for
               even with the step chosen optimally at every step. */
            const searched = descend(problem, [1, 1], { lineSearch: true, limit: 5000 });
            api.assert.atMost(problem.f(searched.x), 1e-12,
              'the line search converges on the same surface with no step specified');
            api.assert.atMost(searched.iterations, 4000,
              'and it terminates rather than running to the limit');
          }
        },
        {
          name: 'a quadratic bowl is solved from several starting points',
          assert: function (descend, api) {
            const problem = {
              f: function (x) { return (x[0] - 3) * (x[0] - 3) + 4 * (x[1] + 1) * (x[1] + 1); },
              gradient: function (x) { return [2 * (x[0] - 3), 8 * (x[1] + 1)]; }
            };
            const rng = api.Random.seeded(5);

            for (let trial = 0; trial < 12; trial += 1) {
              const start = [rng.next() * 20 - 10, rng.next() * 20 - 10];
              const got = descend(problem, start, { lineSearch: true, limit: 500 });

              api.assert.closeTo(got.x[0], 3, 1e-4, 'the minimiser has x = 3');
              api.assert.closeTo(got.x[1], -1, 1e-4, 'and y = -1');
              api.assert.equal(got.monotone, true, 'with the objective falling at every step');
            }
          }
        },
        {
          name: 'the evaluation count reflects the probing a line search does',
          assert: function (descend, api) {
            const problem = {
              f: function (x) { return 100 * (x[1] - x[0] * x[0]) * (x[1] - x[0] * x[0]) +
                (1 - x[0]) * (1 - x[0]); },
              gradient: function (x) {
                return [-2 * (1 - x[0]) - 400 * x[0] * (x[1] - x[0] * x[0]),
                  200 * (x[1] - x[0] * x[0])];
              }
            };
            const searched = descend(problem, [-1.2, 1], { lineSearch: true, limit: 200 });

            api.assert.atLeast(searched.evaluations, searched.iterations * 3,
              'each iteration probes several candidate steps before accepting one');
            api.assert.atLeast(searched.iterations, 1, 'and it did take steps');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
