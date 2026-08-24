/**
 * Graded exercises for randomised design, contraction and Monte Carlo (M19.1-M19.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'randomised-design': [{
      id: 'las-vegas-and-monte-carlo',
      title: 'One primality routine, both error models',
      prompt: 'testPrimality(n, mode, rounds, rng) must implement a Miller–Rabin test in two ' +
        'modes on the same core. In "monteCarlo" mode it runs exactly `rounds` random bases and ' +
        'returns { probablePrime, roundsRun, exhaustive: false } — always finishing in `rounds` ' +
        'rounds and occasionally saying "probablePrime" about a composite. In "lasVegas" mode it ' +
        'tries bases 2, 3, 4, … in order until one exposes n as composite or every base up to ' +
        'n − 2 has been tried, returning { probablePrime, roundsRun, exhaustive: true } — always ' +
        'correct, with a runtime that depends on the input. A round on base a: write n − 1 as ' +
        'd·2ˢ with d odd; compute x = a^d mod n; if x is 1 or n − 1 the round passes; otherwise ' +
        'square x up to s − 1 times and the round passes if any square reaches n − 1. Treat ' +
        'n < 4 and even n as special cases. The starter always answers "probablePrime" without ' +
        'testing anything, which is a valid Monte Carlo algorithm with a failure probability of 1.',
      entry: 'testPrimality',
      starter: [
        'function testPrimality(n, mode, rounds, rng) {',
        '  // it always finishes, and it is wrong on every composite',
        '  if (n < 2) return { probablePrime: false, roundsRun: 0, exhaustive: mode === "lasVegas" };',
        '  if (n % 2 === 0) return { probablePrime: n === 2, roundsRun: 0, exhaustive: mode === "lasVegas" };',
        '  return { probablePrime: true, roundsRun: mode === "lasVegas" ? n - 3 : rounds,',
        '    exhaustive: mode === "lasVegas" };',
        '}'
      ].join('\n'),
      solution: [
        'function testPrimality(n, mode, rounds, rng) {',
        '  const lasVegas = mode === "lasVegas";',
        '  if (n < 2) return { probablePrime: false, roundsRun: 0, exhaustive: lasVegas };',
        '  if (n < 4) return { probablePrime: true, roundsRun: 0, exhaustive: lasVegas };',
        '  if (n % 2 === 0) return { probablePrime: false, roundsRun: 0, exhaustive: lasVegas };',
        '',
        '  function modPow(base, exponent, modulus) {',
        '    let result = 1;',
        '    let b = base % modulus;',
        '    let e = exponent;',
        '    while (e > 0) {',
        '      if (e % 2 === 1) result = (result * b) % modulus;',
        '      b = (b * b) % modulus;',
        '      e = Math.floor(e / 2);',
        '    }',
        '    return result;',
        '  }',
        '',
        '  let d = n - 1;',
        '  let s = 0;',
        '  while (d % 2 === 0) { d /= 2; s += 1; }',
        '',
        '  function roundPasses(a) {',
        '    let x = modPow(a, d, n);',
        '    if (x === 1 || x === n - 1) return true;',
        '    for (let i = 1; i < s; i += 1) {',
        '      x = (x * x) % n;',
        '      if (x === n - 1) return true;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  if (lasVegas) {',
        '    let tried = 0;',
        '    for (let a = 2; a <= n - 2; a += 1) {',
        '      tried += 1;',
        '      if (!roundPasses(a)) return { probablePrime: false, roundsRun: tried, exhaustive: true };',
        '    }',
        '    return { probablePrime: true, roundsRun: tried, exhaustive: true };',
        '  }',
        '',
        '  for (let r = 0; r < rounds; r += 1) {',
        '    const a = 2 + rng.int(n - 3);',
        '    if (!roundPasses(a)) {',
        '      return { probablePrime: false, roundsRun: r + 1, exhaustive: false };',
        '    }',
        '  }',
        '  return { probablePrime: true, roundsRun: rounds, exhaustive: false };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the Las Vegas mode is never wrong, on primes or on Carmichael numbers',
          assert: function (testPrimality, api) {
            const primes = [5, 7, 11, 13, 17, 97, 101, 8191];
            const composites = [9, 15, 21, 25, 341, 561, 1105, 1729, 2465, 8911];

            primes.forEach(function (p) {
              const got = testPrimality(p, 'lasVegas', 0, api.rng);
              api.assert.ok(got.probablePrime, p + ' is prime and must be reported as such');
              api.assert.ok(got.exhaustive, 'Las Vegas mode reports exhaustive: true');
            });
            composites.forEach(function (c) {
              const got = testPrimality(c, 'lasVegas', 0, api.rng);
              api.assert.ok(!got.probablePrime, c + ' is composite and Las Vegas must expose it');
            });
          }
        },
        {
          name: 'the Monte Carlo mode always runs exactly the rounds it was given, on a prime',
          assert: function (testPrimality, api) {
            [4, 8, 16].forEach(function (rounds) {
              [101, 8191, 65537].forEach(function (p) {
                const got = testPrimality(p, 'monteCarlo', rounds, api.Random.seeded(rounds + p));
                api.assert.equal(got.roundsRun, rounds,
                  'a prime survives every round, so roundsRun must be ' + rounds);
                api.assert.ok(got.probablePrime, p + ' must be reported as probably prime');
                api.assert.ok(!got.exhaustive, 'Monte Carlo mode reports exhaustive: false');
              });
            });
          }
        },
        {
          name: 'the Monte Carlo failure rate on 561 falls at least as fast as the liar density',
          assert: function (testPrimality, api) {
            const trials = 4000;
            const counts = [1, 2, 3].map(function (rounds) {
              let fooled = 0;
              for (let t = 0; t < trials; t += 1) {
                const rng = api.Random.seeded(t * 131 + rounds);
                if (testPrimality(561, 'monteCarlo', rounds, rng).probablePrime) fooled += 1;
              }
              return fooled / trials;
            });

            api.assert.atMost(counts[0], 0.25,
              'one round must be fooled at most a quarter of the time, measured ' + counts[0]);
            api.assert.atMost(counts[1], counts[0],
              'two rounds cannot be fooled more often than one');
            api.assert.atMost(counts[2], 0.01,
              'three rounds on 561 should be well under 1%, measured ' + counts[2]);
          }
        },
        {
          name: 'neither mode ever calls a prime composite — the error is one-sided',
          assert: function (testPrimality, api) {
            const primes = [3, 5, 7, 11, 13, 31, 61, 127, 8191, 131071];

            primes.forEach(function (p) {
              for (let t = 0; t < 40; t += 1) {
                const rng = api.Random.seeded(t * 17 + p);
                api.assert.ok(testPrimality(p, 'monteCarlo', 6, rng).probablePrime,
                  'the prime ' + p + ' was rejected on seed ' + t + ', which cannot happen');
              }
              api.assert.ok(testPrimality(p, 'lasVegas', 0, api.rng).probablePrime,
                'the prime ' + p + ' was rejected in Las Vegas mode');
            });
          }
        }
      ]
    }],

    'random-contraction': [{
      id: 'karger-contraction',
      title: 'Contraction with a disjoint-set forest, and the repetition wrapper',
      prompt: 'minCut(n, edges, trials, makeRng) must run Karger’s contraction `trials` times ' +
        'and return { cut, trials, successes, contractions } where `cut` is the smallest cut ' +
        'found, `successes` counts the runs that matched that best value and `contractions` is ' +
        'the total number of merges across all runs. One run: give every vertex its own ' +
        'component; repeatedly draw a uniformly random edge from the FULL edge list, and if its ' +
        'endpoints are in different components, merge them and count a contraction; stop when ' +
        'two components remain; the run’s cut is the number of edges whose endpoints are in ' +
        'different components. Use makeRng(t) for run t so the runs are reproducible. Drawing ' +
        'uniformly from the edge list is the whole algorithm — a self-loop drawn is simply ' +
        'skipped, which keeps the surviving edges uniformly weighted. The starter merges the ' +
        'first available edge instead of a random one, which is deterministic and usually wrong.',
      entry: 'minCut',
      starter: [
        'function minCut(n, edges, trials, makeRng) {',
        '  // the single-vertex cut: isolate whichever vertex has the fewest edges.',
        '  // It is a real cut, it is deterministic, and on a graph whose minimum cut',
        '  // separates two large groups it is nowhere near it.',
        '  const degree = new Array(n).fill(0);',
        '  edges.forEach(function (edge) { degree[edge.from] += 1; degree[edge.to] += 1; });',
        '',
        '  let best = Infinity;',
        '  for (let v = 0; v < n; v += 1) { if (degree[v] < best) best = degree[v]; }',
        '  return { cut: best, trials: trials, successes: trials, contractions: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function minCut(n, edges, trials, makeRng) {',
        '  let best = Infinity;',
        '  let successes = 0;',
        '  let contractions = 0;',
        '  const runs = [];',
        '',
        '  for (let t = 0; t < trials; t += 1) {',
        '    const rng = makeRng(t);',
        '    const parent = [];',
        '    for (let i = 0; i < n; i += 1) parent.push(i);',
        '',
        '    function find(x) {',
        '      let root = x;',
        '      while (parent[root] !== root) root = parent[root];',
        '      while (parent[x] !== root) { const next = parent[x]; parent[x] = root; x = next; }',
        '      return root;',
        '    }',
        '',
        '    let alive = n;',
        '    let guard = 0;',
        '    while (alive > 2 && guard < edges.length * 200) {',
        '      guard += 1;',
        '      const edge = edges[rng.int(edges.length)];',
        '      const a = find(edge.from);',
        '      const b = find(edge.to);',
        '      if (a === b) continue;',
        '      parent[a] = b;',
        '      alive -= 1;',
        '      contractions += 1;',
        '    }',
        '',
        '    let cut = 0;',
        '    for (let i = 0; i < edges.length; i += 1) {',
        '      if (find(edges[i].from) !== find(edges[i].to)) cut += 1;',
        '    }',
        '    runs.push(cut);',
        '    if (cut < best) best = cut;',
        '  }',
        '',
        '  for (let i = 0; i < runs.length; i += 1) { if (runs[i] === best) successes += 1; }',
        '  return { cut: best, trials: trials, successes: successes, contractions: contractions };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it finds the minimum cut of two cliques joined by a few edges',
          assert: function (minCut, api) {
            [{ size: 5, bridges: 1 }, { size: 6, bridges: 2 }, { size: 6, bridges: 3 }]
              .forEach(function (shape) {
                const edges = [];
                for (let side = 0; side < 2; side += 1) {
                  const base = side * shape.size;
                  for (let i = 0; i < shape.size; i += 1) {
                    for (let j = i + 1; j < shape.size; j += 1) {
                      edges.push({ from: base + i, to: base + j });
                    }
                  }
                }
                for (let b = 0; b < shape.bridges; b += 1) {
                  edges.push({ from: b % shape.size, to: shape.size + (b % shape.size) });
                }
                const got = minCut(2 * shape.size, edges, 400, function (t) {
                  return api.Random.seeded(t * 97 + 5);
                });
                api.assert.equal(got.cut, shape.bridges,
                  'the minimum cut is the ' + shape.bridges + ' bridging edges');
              });
          }
        },
        {
          name: 'every run performs exactly n − 2 contractions',
          assert: function (minCut, api) {
            const n = 10;
            const edges = [];
            for (let i = 0; i < n; i += 1) {
              for (let j = i + 1; j < n; j += 1) edges.push({ from: i, to: j });
            }
            const trials = 50;
            const got = minCut(n, edges, trials, function (t) { return api.Random.seeded(t + 1); });

            api.assert.equal(got.contractions, trials * (n - 2),
              'contracting from n components to 2 takes exactly n − 2 merges per run');
          }
        },
        {
          name: 'on a cycle it finds a minimum cut of 2 and the rate beats the bound',
          assert: function (minCut, api) {
            const n = 10;
            const edges = [];
            for (let i = 0; i < n; i += 1) edges.push({ from: i, to: (i + 1) % n });
            const trials = 500;
            const got = minCut(n, edges, trials, function (t) {
              return api.Random.seeded(t * 31 + 7);
            });

            api.assert.equal(got.cut, 2, 'removing any two edges disconnects a cycle');
            api.assert.atLeast(got.successes / trials, 2 / (n * (n - 1)),
              'the measured success rate must be at least the 2/(n(n−1)) bound');
          }
        },
        {
          name: 'the answer is always a real cut: never below the true minimum',
          assert: function (minCut, api) {
            const n = 8;
            const rng = api.Random.seeded(21);
            const seen = new Set();
            const edges = [];
            while (edges.length < 16) {
              const a = rng.int(n);
              const b = rng.int(n);
              if (a === b) continue;
              const key = Math.min(a, b) + '-' + Math.max(a, b);
              if (seen.has(key)) continue;
              seen.add(key);
              edges.push({ from: a, to: b });
            }
            let exact = Infinity;
            for (let mask = 1; mask < (1 << (n - 1)); mask += 1) {
              let weight = 0;
              edges.forEach(function (edge) {
                if (((mask >>> edge.from) & 1) !== ((mask >>> edge.to) & 1)) weight += 1;
              });
              if (weight < exact) exact = weight;
            }
            const got = minCut(n, edges, 300, function (t) { return api.Random.seeded(t * 13 + 3); });

            api.assert.atLeast(got.cut, exact,
              'contraction can never return a cut smaller than the true minimum');
            api.assert.equal(got.cut, exact,
              '300 runs on 8 vertices should find it; measured ' + got.cut + ' against ' + exact);
          }
        }
      ]
    }],

    'monte-carlo-estimation': [{
      id: 'importance-sampling-rare-event',
      title: 'Importance sampling for a tail probability, with the weight diagnostic',
      prompt: 'estimateTail(threshold, shift, samples, rng) must estimate P(Z > threshold) for a ' +
        'standard normal Z by sampling from N(shift, 1) and reweighting. For each draw ' +
        'x = shift + rng.gaussian(0, 1), the contribution is exp(−shift·x + shift²/2) when ' +
        'x > threshold and 0 otherwise — that factor is the ratio of the standard normal density ' +
        'to the shifted one. Return { estimate, standardError, hits, weightEss } where `estimate` ' +
        'is the mean contribution, `standardError` is √(sample variance / samples) using the ' +
        'unbiased (n − 1) variance, `hits` counts the draws past the threshold and `weightEss` is ' +
        '(Σw)²/Σw² over the contributions, which is how many equally weighted draws the sample is ' +
        'worth. The starter samples from the standard normal itself, which is unbiased and ' +
        'usually returns exactly zero.',
      entry: 'estimateTail',
      starter: [
        'function estimateTail(threshold, shift, samples, rng) {',
        '  const values = [];',
        '  let hits = 0;',
        '',
        '  // plain sampling: correct, and it almost never sees the event',
        '  for (let i = 0; i < samples; i += 1) {',
        '    const x = rng.gaussian(0, 1);',
        '    const value = x > threshold ? 1 : 0;',
        '    if (value > 0) hits += 1;',
        '    values.push(value);',
        '  }',
        '  let mean = 0;',
        '  for (let i = 0; i < samples; i += 1) mean += values[i];',
        '  mean /= samples;',
        '  let sq = 0;',
        '  for (let i = 0; i < samples; i += 1) sq += (values[i] - mean) * (values[i] - mean);',
        '  const variance = samples > 1 ? sq / (samples - 1) : 0;',
        '  return { estimate: mean, standardError: Math.sqrt(variance / samples),',
        '    hits: hits, weightEss: hits };',
        '}'
      ].join('\n'),
      solution: [
        'function estimateTail(threshold, shift, samples, rng) {',
        '  const values = new Array(samples);',
        '  let hits = 0;',
        '',
        '  for (let i = 0; i < samples; i += 1) {',
        '    const x = shift + rng.gaussian(0, 1);',
        '    if (x > threshold) {',
        '      values[i] = Math.exp(-shift * x + 0.5 * shift * shift);',
        '      hits += 1;',
        '    } else {',
        '      values[i] = 0;',
        '    }',
        '  }',
        '',
        '  let mean = 0;',
        '  for (let i = 0; i < samples; i += 1) mean += values[i];',
        '  mean /= samples;',
        '',
        '  let sq = 0;',
        '  let sum = 0;',
        '  let sumSquares = 0;',
        '  for (let i = 0; i < samples; i += 1) {',
        '    sq += (values[i] - mean) * (values[i] - mean);',
        '    sum += values[i];',
        '    sumSquares += values[i] * values[i];',
        '  }',
        '  const variance = samples > 1 ? sq / (samples - 1) : 0;',
        '',
        '  return {',
        '    estimate: mean,',
        '    standardError: Math.sqrt(variance / samples),',
        '    hits: hits,',
        '    weightEss: sumSquares === 0 ? 0 : (sum * sum) / sumSquares',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a well-chosen shift estimates P(Z > 4) to within 2%, where plain sampling sees nothing',
          assert: function (estimateTail, api) {
            const exact = 3.167124183311998e-5;
            const got = estimateTail(4, 4, 20000, api.Random.seeded(3));

            api.assert.atLeast(got.hits, 5000,
              'sampling from N(4,1) should put about half the draws past 4, got ' + got.hits);
            api.assert.atMost(Math.abs(got.estimate - exact) / exact, 0.02,
              'the relative error must be under 2%, measured ' +
                (Math.abs(got.estimate - exact) / exact));
          }
        },
        {
          name: 'it is at least 10x more accurate than plain sampling at the same budget',
          assert: function (estimateTail, api) {
            const exact = 3.167124183311998e-5;
            const shifted = estimateTail(4, 4, 20000, api.Random.seeded(11));
            const plain = estimateTail(4, 0, 20000, api.Random.seeded(11));
            const shiftedError = Math.abs(shifted.estimate - exact);
            const plainError = Math.abs(plain.estimate - exact);

            api.assert.atMost(shiftedError * 10, plainError,
              'shifted error ' + shiftedError + ' must be at least 10x below plain ' + plainError);
          }
        },
        {
          name: 'the estimate stays inside its own interval, and the interval is not zero',
          assert: function (estimateTail, api) {
            const exact = 3.167124183311998e-5;
            let covered = 0;

            for (let t = 0; t < 30; t += 1) {
              const got = estimateTail(4, 4, 8000, api.Random.seeded(t * 41 + 1));
              api.assert.ok(got.standardError > 0,
                'a shifted estimator sees the event, so its standard error must be positive');
              if (Math.abs(got.estimate - exact) <= 2.5 * got.standardError) covered += 1;
            }
            api.assert.atLeast(covered, 26,
              'at least 26 of 30 runs should land inside 2.5 standard errors, got ' + covered);
          }
        },
        {
          name: 'over-shifting collapses the weight ESS even as the hit count rises',
          assert: function (estimateTail, api) {
            const good = estimateTail(4, 4, 20000, api.Random.seeded(7));
            const over = estimateTail(4, 8, 20000, api.Random.seeded(7));

            api.assert.atLeast(over.hits, good.hits,
              'a bigger shift puts MORE draws past the threshold, which is the trap');
            api.assert.atMost(over.weightEss * 4, good.weightEss,
              'and its weight ESS must collapse: ' + over.weightEss + ' against ' + good.weightEss);
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
