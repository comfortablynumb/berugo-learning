/**
 * Graded exercises for MCMC, fingerprinting and approximation ratios (M19.4-M19.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'markov-chain-monte-carlo': [{
      id: 'metropolis-with-effective-sample-size',
      title: 'Metropolis–Hastings, and the sample size that is not the draw count',
      prompt: 'sampleChain(logTarget, width, steps, rng) must run a symmetric random-walk ' +
        'Metropolis chain on one real coordinate and report an honest error bar. Start at 0. At ' +
        'each step propose y = x + rng.gaussian(0, width), accept it when ' +
        'log(u) < logTarget(y) − logTarget(x) for u drawn from rng.next(), and — this is the ' +
        'part that is easy to get wrong — record the CURRENT position whether the move was ' +
        'accepted or rejected. Then compute the integrated autocorrelation time ' +
        'τ = 1 + 2·Σ ρₖ, summing consecutive PAIRS of autocorrelations and stopping as soon as a ' +
        'pair sums below zero (Geyer’s rule; stopping at the first negative single lag ' +
        'underestimates τ). Return { chain, mean, acceptanceRate, tau, ess, standardError } with ' +
        'ess = steps/τ and standardError = √(variance/ess). The starter records only the ' +
        'accepted moves, which samples the wrong distribution and reports σ/√N as its interval.',
      entry: 'sampleChain',
      starter: [
        'function sampleChain(logTarget, width, steps, rng) {',
        '  const chain = [];',
        '  let x = 0;',
        '  let logP = logTarget(x);',
        '  let accepted = 0;',
        '',
        '  for (let i = 0; i < steps; i += 1) {',
        '    const y = x + rng.gaussian(0, width);',
        '    const logQ = logTarget(y);',
        '    if (Math.log(Math.max(rng.next(), 1e-300)) < logQ - logP) {',
        '      x = y; logP = logQ; accepted += 1;',
        '      chain.push(x);           // only the accepted moves are recorded',
        '    }',
        '  }',
        '  let mean = 0;',
        '  for (let i = 0; i < chain.length; i += 1) mean += chain[i];',
        '  mean /= Math.max(chain.length, 1);',
        '  let sq = 0;',
        '  for (let i = 0; i < chain.length; i += 1) sq += (chain[i] - mean) * (chain[i] - mean);',
        '  const variance = chain.length > 1 ? sq / (chain.length - 1) : 0;',
        '',
        '  return { chain: chain, mean: mean, acceptanceRate: accepted / steps,',
        '    tau: 1, ess: chain.length,',
        '    standardError: Math.sqrt(variance / Math.max(chain.length, 1)) };',
        '}'
      ].join('\n'),
      solution: [
        'function sampleChain(logTarget, width, steps, rng) {',
        '  const chain = new Array(steps);',
        '  let x = 0;',
        '  let logP = logTarget(x);',
        '  let accepted = 0;',
        '',
        '  for (let i = 0; i < steps; i += 1) {',
        '    const y = x + rng.gaussian(0, width);',
        '    const logQ = logTarget(y);',
        '    if (Math.log(Math.max(rng.next(), 1e-300)) < logQ - logP) {',
        '      x = y; logP = logQ; accepted += 1;',
        '    }',
        '    chain[i] = x;              // recorded on every step, accepted or not',
        '  }',
        '',
        '  let mean = 0;',
        '  for (let i = 0; i < steps; i += 1) mean += chain[i];',
        '  mean /= steps;',
        '  let sq = 0;',
        '  for (let i = 0; i < steps; i += 1) sq += (chain[i] - mean) * (chain[i] - mean);',
        '  const variance = steps > 1 ? sq / (steps - 1) : 0;',
        '',
        '  const maxLag = Math.min(steps - 2, 1000);',
        '  const rho = new Array(maxLag + 1);',
        '  for (let lag = 0; lag <= maxLag; lag += 1) {',
        '    let sum = 0;',
        '    for (let i = 0; i + lag < steps; i += 1) {',
        '      sum += (chain[i] - mean) * (chain[i + lag] - mean);',
        '    }',
        '    rho[lag] = variance === 0 ? 0 : (sum / (steps - lag)) / variance;',
        '  }',
        '',
        '  let sum = 0;',
        '  for (let k = 1; k + 1 <= maxLag; k += 2) {',
        '    const pair = rho[k] + rho[k + 1];',
        '    if (pair < 0) break;',
        '    sum += pair;',
        '  }',
        '  const tau = Math.max(1 + 2 * sum, 1);',
        '  const ess = steps / tau;',
        '',
        '  return { chain: chain, mean: mean, acceptanceRate: accepted / steps,',
        '    tau: tau, ess: ess, standardError: Math.sqrt(variance / ess) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it recovers the mean of a standard normal, and records every step',
          assert: function (sampleChain, api) {
            const logTarget = function (x) { return -0.5 * x * x; };
            const got = sampleChain(logTarget, 2.4, 20000, api.Random.seeded(5));

            api.assert.equal(got.chain.length, 20000,
              'the chain must have one entry per step, including rejections');
            api.assert.atMost(Math.abs(got.mean), 0.15,
              'the mean of a standard normal is 0, estimated ' + got.mean);
          }
        },
        {
          name: 'a shifted target is recovered too, so the constant really does cancel',
          assert: function (sampleChain, api) {
            /* Written unnormalised on purpose: this density is missing its 1/sqrt(2 pi)
               and the chain must be indifferent to that. */
            const logTarget = function (x) { return -0.5 * (x - 3) * (x - 3) / 4 + 17; };
            const got = sampleChain(logTarget, 3, 20000, api.Random.seeded(9));

            api.assert.atMost(Math.abs(got.mean - 3), 0.25,
              'the target is centred at 3, estimated ' + got.mean);
            api.assert.atLeast(got.acceptanceRate, 0.05, 'the chain must be moving');
            api.assert.atMost(got.acceptanceRate, 0.95,
              'an acceptance rate above 0.95 means the proposal is not exploring');
          }
        },
        {
          name: 'the correlation time rises as the proposal shrinks, and the ESS falls with it',
          assert: function (sampleChain, api) {
            const logTarget = function (x) { return -0.5 * x * x; };
            const wide = sampleChain(logTarget, 2.4, 20000, api.Random.seeded(3));
            const narrow = sampleChain(logTarget, 0.05, 20000, api.Random.seeded(3));

            api.assert.atLeast(narrow.tau, wide.tau * 3,
              'a 50x smaller proposal must have a much longer correlation time: ' +
                narrow.tau + ' against ' + wide.tau);
            api.assert.atMost(narrow.ess, wide.ess,
              'and therefore fewer effective samples');
            api.assert.atMost(wide.ess, 20000,
              'the effective sample size can never exceed the draw count');
          }
        },
        {
          name: 'the reported interval is honest: it widens with the correlation',
          assert: function (sampleChain, api) {
            const logTarget = function (x) { return -0.5 * x * x; };
            const narrow = sampleChain(logTarget, 0.05, 20000, api.Random.seeded(11));
            const naive = Math.sqrt(1 / 20000);

            api.assert.atLeast(narrow.standardError, naive * 3,
              'a correlated chain must report a wider bar than sigma/sqrt(N) = ' + naive +
                ', got ' + narrow.standardError);
            api.assert.atMost(Math.abs(narrow.mean), 4 * narrow.standardError,
              'and the true mean of 0 must lie inside four of those bars');
          }
        }
      ]
    }],

    'fingerprinting': [{
      id: 'freivalds-and-identity-testing',
      title: 'Freivalds’ check and a Schwartz–Zippel identity test',
      prompt: 'verify(a, b, c, rounds, rng) must check the claim A·B = C without computing the ' +
        'product. Each round: draw a vector x of n independent bits with rng.int(2), compute ' +
        'A(Bx) and Cx as matrix–vector products, and reject if they differ. Return ' +
        '{ accepted, roundsRun, operations } where `operations` counts one unit per ' +
        'multiply-add performed — so a round costs 3n² and never n³. Reject as soon as a round ' +
        'disagrees, reporting the round number in roundsRun; if every round agrees, roundsRun is ' +
        '`rounds`. The starter computes the full product and compares it entry by entry: always ' +
        'correct, and it costs n³ operations, which is the thing verification exists to avoid.',
      entry: 'verify',
      starter: [
        'function verify(a, b, c, rounds, rng) {',
        '  const n = a.length;',
        '  let operations = 0;',
        '  let accepted = true;',
        '',
        '  // the honest, expensive answer: compute A*B and compare',
        '  for (let i = 0; i < n; i += 1) {',
        '    for (let j = 0; j < n; j += 1) {',
        '      let total = 0;',
        '      for (let k = 0; k < n; k += 1) { total += a[i][k] * b[k][j]; operations += 1; }',
        '      if (total !== c[i][j]) accepted = false;',
        '    }',
        '  }',
        '  return { accepted: accepted, roundsRun: rounds, operations: operations };',
        '}'
      ].join('\n'),
      solution: [
        'function verify(a, b, c, rounds, rng) {',
        '  const n = a.length;',
        '  const counter = { operations: 0 };',
        '',
        '  function apply(m, v) {',
        '    const out = new Array(n).fill(0);',
        '    for (let i = 0; i < n; i += 1) {',
        '      for (let j = 0; j < n; j += 1) {',
        '        out[i] += m[i][j] * v[j];',
        '        counter.operations += 1;',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '',
        '  for (let round = 0; round < rounds; round += 1) {',
        '    const x = new Array(n);',
        '    for (let i = 0; i < n; i += 1) x[i] = rng.int(2);',
        '',
        '    const left = apply(a, apply(b, x));',
        '    const right = apply(c, x);',
        '    let same = true;',
        '    for (let i = 0; i < n; i += 1) { if (left[i] !== right[i]) { same = false; break; } }',
        '',
        '    if (!same) {',
        '      return { accepted: false, roundsRun: round + 1, operations: counter.operations };',
        '    }',
        '  }',
        '  return { accepted: true, roundsRun: rounds, operations: counter.operations };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it never rejects a correct product — the error is one-sided',
          assert: function (verify, api) {
            [6, 12, 20].forEach(function (n) {
              const rng = api.Random.seeded(n + 3);
              const a = [];
              const b = [];
              for (let i = 0; i < n; i += 1) {
                const rowA = [];
                const rowB = [];
                for (let j = 0; j < n; j += 1) { rowA.push(rng.int(10)); rowB.push(rng.int(10)); }
                a.push(rowA);
                b.push(rowB);
              }
              const c = [];
              for (let i = 0; i < n; i += 1) {
                const row = new Array(n).fill(0);
                for (let k = 0; k < n; k += 1) {
                  for (let j = 0; j < n; j += 1) row[j] += a[i][k] * b[k][j];
                }
                c.push(row);
              }
              for (let t = 0; t < 25; t += 1) {
                const got = verify(a, b, c, 8, api.Random.seeded(t * 31 + n));
                api.assert.ok(got.accepted,
                  'a correct product was rejected at n = ' + n + ', seed ' + t);
                api.assert.equal(got.roundsRun, 8, 'all eight rounds must run when nothing differs');
              }
            });
          }
        },
        {
          name: 'it costs 3n² per round, not n³',
          assert: function (verify, api) {
            const n = 24;
            const rng = api.Random.seeded(4);
            const a = [];
            const b = [];
            for (let i = 0; i < n; i += 1) {
              const rowA = [];
              const rowB = [];
              for (let j = 0; j < n; j += 1) { rowA.push(rng.int(5)); rowB.push(rng.int(5)); }
              a.push(rowA);
              b.push(rowB);
            }
            const c = [];
            for (let i = 0; i < n; i += 1) {
              const row = new Array(n).fill(0);
              for (let k = 0; k < n; k += 1) {
                for (let j = 0; j < n; j += 1) row[j] += a[i][k] * b[k][j];
              }
              c.push(row);
            }
            const got = verify(a, b, c, 4, api.Random.seeded(2));

            api.assert.equal(got.operations, 4 * 3 * n * n,
              'four rounds of three matrix-vector products is ' + (4 * 3 * n * n) +
                ' operations, got ' + got.operations);
          }
        },
        {
          name: 'one wrong entry is caught about half the time per round, over 400 seeds',
          assert: function (verify, api) {
            const n = 16;
            const rng = api.Random.seeded(8);
            const a = [];
            const b = [];
            for (let i = 0; i < n; i += 1) {
              const rowA = [];
              const rowB = [];
              for (let j = 0; j < n; j += 1) { rowA.push(rng.int(9) + 1); rowB.push(rng.int(9) + 1); }
              a.push(rowA);
              b.push(rowB);
            }
            const c = [];
            for (let i = 0; i < n; i += 1) {
              const row = new Array(n).fill(0);
              for (let k = 0; k < n; k += 1) {
                for (let j = 0; j < n; j += 1) row[j] += a[i][k] * b[k][j];
              }
              c.push(row);
            }
            c[5][7] += 1;

            let missed = 0;
            const trials = 400;
            for (let t = 0; t < trials; t += 1) {
              if (verify(a, b, c, 1, api.Random.seeded(t * 17 + 1)).accepted) missed += 1;
            }
            api.assert.atMost(missed / trials, 0.62,
              'one round should miss it about half the time, measured ' + (missed / trials));
            api.assert.atLeast(missed / trials, 0.38,
              'and it should not be caught every time either — measured ' + (missed / trials));
          }
        },
        {
          name: 'eight rounds bring the miss rate under 5%',
          assert: function (verify, api) {
            const n = 12;
            const rng = api.Random.seeded(13);
            const a = [];
            const b = [];
            for (let i = 0; i < n; i += 1) {
              const rowA = [];
              const rowB = [];
              for (let j = 0; j < n; j += 1) { rowA.push(rng.int(7) + 1); rowB.push(rng.int(7) + 1); }
              a.push(rowA);
              b.push(rowB);
            }
            const c = [];
            for (let i = 0; i < n; i += 1) {
              const row = new Array(n).fill(0);
              for (let k = 0; k < n; k += 1) {
                for (let j = 0; j < n; j += 1) row[j] += a[i][k] * b[k][j];
              }
              c.push(row);
            }
            c[2][9] -= 3;

            let missed = 0;
            const trials = 400;
            for (let t = 0; t < trials; t += 1) {
              if (verify(a, b, c, 8, api.Random.seeded(t * 23 + 5)).accepted) missed += 1;
            }
            api.assert.atMost(missed / trials, 0.05,
              '2^-8 is 0.0039; measured ' + (missed / trials));
          }
        }
      ]
    }],

    'approximation-ratios': [{
      id: 'greedy-set-cover-and-its-tight-instance',
      title: 'Greedy set cover, and the instance that makes the bound exact',
      prompt: 'Write two functions. greedySetCover(universe, sets) repeatedly takes the set with ' +
        'the best coverage per unit cost — newly covered elements divided by cost, with a cost ' +
        'of 1 when none is given — until everything is covered, returning ' +
        '{ chosen, cost, harmonicBound } where harmonicBound is H(m) for m the largest set size. ' +
        'tightInstance(n) returns { universe, sets, optimum } for Vazirani’s family: n singleton ' +
        'sets, the i-th costing 1/(n − i), plus one set containing the whole universe at cost ' +
        '1.01. On that family greedy takes every singleton in order and pays H(n), while the ' +
        'optimum is 1.01. Return both from one object: { greedySetCover, tightInstance }. The ' +
        'starter’s greedy scores by raw coverage and ignores cost, which is the unweighted ' +
        'algorithm and takes the universal set immediately.',
      entry: 'buildSetCover',
      starter: [
        'function buildSetCover() {',
        '  function greedySetCover(universe, sets) {',
        '    const covered = new Array(universe).fill(false);',
        '    const chosen = [];',
        '    let cost = 0;',
        '    let remaining = universe;',
        '',
        '    while (remaining > 0) {',
        '      let pick = -1;',
        '      let bestGain = 0;',
        '      for (let s = 0; s < sets.length; s += 1) {',
        '        let gain = 0;',
        '        sets[s].members.forEach(function (e) { if (!covered[e]) gain += 1; });',
        '        // the unweighted rule: most elements wins, whatever it costs',
        '        if (gain > bestGain) { bestGain = gain; pick = s; }',
        '      }',
        '      if (pick === -1) break;',
        '      chosen.push(pick);',
        '      cost += sets[pick].cost === undefined ? 1 : sets[pick].cost;',
        '      sets[pick].members.forEach(function (e) {',
        '        if (!covered[e]) { covered[e] = true; remaining -= 1; }',
        '      });',
        '    }',
        '    let largest = 0;',
        '    sets.forEach(function (s) { largest = Math.max(largest, s.members.length); });',
        '    let harmonic = 0;',
        '    for (let i = 1; i <= largest; i += 1) harmonic += 1 / i;',
        '    return { chosen: chosen, cost: cost, harmonicBound: harmonic };',
        '  }',
        '',
        '  function tightInstance(n) {',
        '    const sets = [];',
        '    const all = [];',
        '    for (let i = 0; i < n; i += 1) { all.push(i); sets.push({ members: [i], cost: 1 }); }',
        '    sets.push({ members: all, cost: 1.01 });',
        '    return { universe: n, sets: sets, optimum: 1.01 };',
        '  }',
        '',
        '  return { greedySetCover: greedySetCover, tightInstance: tightInstance };',
        '}'
      ].join('\n'),
      solution: [
        'function buildSetCover() {',
        '  function greedySetCover(universe, sets) {',
        '    const covered = new Array(universe).fill(false);',
        '    const chosen = [];',
        '    let cost = 0;',
        '    let remaining = universe;',
        '',
        '    while (remaining > 0) {',
        '      let pick = -1;',
        '      let bestScore = 0;',
        '      for (let s = 0; s < sets.length; s += 1) {',
        '        let gain = 0;',
        '        for (let j = 0; j < sets[s].members.length; j += 1) {',
        '          if (!covered[sets[s].members[j]]) gain += 1;',
        '        }',
        '        if (gain === 0) continue;',
        '        const price = sets[s].cost === undefined ? 1 : sets[s].cost;',
        '        const score = gain / price;',
        '        if (score > bestScore) { bestScore = score; pick = s; }',
        '      }',
        '      if (pick === -1) break;',
        '      chosen.push(pick);',
        '      cost += sets[pick].cost === undefined ? 1 : sets[pick].cost;',
        '      for (let j = 0; j < sets[pick].members.length; j += 1) {',
        '        const e = sets[pick].members[j];',
        '        if (!covered[e]) { covered[e] = true; remaining -= 1; }',
        '      }',
        '    }',
        '',
        '    let largest = 0;',
        '    for (let s = 0; s < sets.length; s += 1) {',
        '      largest = Math.max(largest, sets[s].members.length);',
        '    }',
        '    let harmonic = 0;',
        '    for (let i = 1; i <= largest; i += 1) harmonic += 1 / i;',
        '    return { chosen: chosen, cost: cost, harmonicBound: harmonic };',
        '  }',
        '',
        '  function tightInstance(n) {',
        '    const sets = [];',
        '    const all = [];',
        '    for (let i = 0; i < n; i += 1) {',
        '      all.push(i);',
        '      sets.push({ members: [i], cost: 1 / (n - i) });',
        '    }',
        '    sets.push({ members: all, cost: 1.01 });',
        '    return { universe: n, sets: sets, optimum: 1.01 };',
        '  }',
        '',
        '  return { greedySetCover: greedySetCover, tightInstance: tightInstance };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'greedy always produces a valid cover on random instances',
          assert: function (buildSetCover, api) {
            const built = buildSetCover();

            for (let t = 0; t < 30; t += 1) {
              const rng = api.Random.seeded(t * 19 + 2);
              const universe = 20;
              const sets = [];
              for (let s = 0; s < 12; s += 1) {
                const members = [];
                for (let e = 0; e < universe; e += 1) { if (rng.next() < 0.3) members.push(e); }
                sets.push({ members: members, cost: 1 });
              }
              const all = [];
              for (let e = 0; e < universe; e += 1) all.push(e);
              sets.push({ members: all, cost: 7 });

              const got = built.greedySetCover(universe, sets);
              const covered = new Array(universe).fill(false);
              got.chosen.forEach(function (s) {
                sets[s].members.forEach(function (e) { covered[e] = true; });
              });
              for (let e = 0; e < universe; e += 1) {
                api.assert.ok(covered[e], 'element ' + e + ' uncovered on instance ' + t);
              }
            }
          }
        },
        {
          name: 'the tight instance makes greedy pay exactly H(n)',
          assert: function (buildSetCover, api) {
            const built = buildSetCover();

            [4, 8, 16, 32, 64].forEach(function (n) {
              const instance = built.tightInstance(n);
              const got = built.greedySetCover(instance.universe, instance.sets);
              let harmonic = 0;
              for (let i = 1; i <= n; i += 1) harmonic += 1 / i;

              api.assert.closeTo(got.cost, harmonic, 1e-9,
                'greedy must pay H(' + n + ') = ' + harmonic + ', paid ' + got.cost);
              api.assert.equal(got.chosen.length, n,
                'it must take all ' + n + ' singletons and never the universal set');
            });
          }
        },
        {
          name: 'the ratio on the tight instance grows like ln n',
          assert: function (buildSetCover, api) {
            const built = buildSetCover();
            const small = built.tightInstance(8);
            const large = built.tightInstance(128);
            const ratioSmall = built.greedySetCover(small.universe, small.sets).cost / small.optimum;
            const ratioLarge = built.greedySetCover(large.universe, large.sets).cost / large.optimum;

            api.assert.atLeast(ratioLarge - ratioSmall, 2.4,
              'H(128) − H(8) is about 2.72, measured ' + (ratioLarge - ratioSmall));
            api.assert.atLeast(ratioLarge, Math.log(128) * 0.99,
              'the ratio at n = 128 must be at least ln 128 = ' + Math.log(128) +
                ', measured ' + ratioLarge);
          }
        },
        {
          name: 'greedy never exceeds its own H(m) bound on random instances',
          assert: function (buildSetCover, api) {
            const built = buildSetCover();

            for (let t = 0; t < 25; t += 1) {
              const rng = api.Random.seeded(t * 29 + 11);
              const universe = 14;
              const sets = [];
              for (let s = 0; s < 10; s += 1) {
                const members = [];
                for (let e = 0; e < universe; e += 1) { if (rng.next() < 0.35) members.push(e); }
                sets.push({ members: members, cost: 1 });
              }
              const all = [];
              for (let e = 0; e < universe; e += 1) all.push(e);
              sets.push({ members: all, cost: 5 });

              const got = built.greedySetCover(universe, sets);
              let best = Infinity;
              for (let mask = 1; mask < (1 << sets.length); mask += 1) {
                const covered = new Array(universe).fill(false);
                let cost = 0;
                for (let s = 0; s < sets.length; s += 1) {
                  if (!((mask >>> s) & 1)) continue;
                  cost += sets[s].cost;
                  sets[s].members.forEach(function (e) { covered[e] = true; });
                }
                let complete = true;
                for (let e = 0; e < universe; e += 1) { if (!covered[e]) complete = false; }
                if (complete && cost < best) best = cost;
              }
              api.assert.atMost(got.cost, best * got.harmonicBound + 1e-9,
                'instance ' + t + ': greedy paid ' + got.cost + ' against an optimum of ' + best +
                  ' and a bound of ' + (best * got.harmonicBound));
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
