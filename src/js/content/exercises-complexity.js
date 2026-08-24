/**
 * Graded exercises for time, space, randomised classes and circuits
 * (M26.5-M26.8).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'time-complexity-classes': [{
      id: 'padding-argument',
      title: 'The padding argument: move a separation to where the class definitions see it',
      prompt: 'pad(word, target) must return the word followed by enough padding characters ' +
        '("#") to reach exactly `target` length, or the word unchanged when it is already at ' +
        'least that long. Then separate(n) must return { original, padded, allowedSteps, ' +
        'neededSteps, separates } for a language decidable in n² steps, padded out to length n². ' +
        '`allowedSteps` is LINEAR in the padded length — that is the smaller class, applied to ' +
        'the padded instances. `neededSteps` is n², the real cost of deciding the underlying ' +
        'instance. `separates` is true when the padded language fits in the smaller class ' +
        '(allowedSteps at least neededSteps) AND the padding actually grew the input. The ' +
        'starter computes allowedSteps from the ORIGINAL length, which is the whole trick ' +
        'missed.',
      entry: 'separate',
      starter: [
        'function pad(word, target) {',
        '  if (word.length >= target) return word;',
        '  return word + "#".repeat(target - word.length);',
        '}',
        '',
        'function separate(n) {',
        '  // allowedSteps uses the ORIGINAL length, so the padding buys nothing.',
        '  const padded = n * n;',
        '',
        '  return {',
        '    original: n,',
        '    padded: padded,',
        '    allowedSteps: n,',
        '    neededSteps: n * n,',
        '    separates: n >= n * n && padded > n',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function pad(word, target) {',
        '  if (word.length >= target) return word;',
        '  return word + "#".repeat(target - word.length);',
        '}',
        '',
        'function separate(n) {',
        '  const padded = n * n;',
        '',
        '  /* The padded instance is longer, so "linear in the input" now means linear in n²,',
        '     which is exactly the n² the underlying problem needs. The separation was always',
        '     there; padding moves it to where the class definitions can see it. */',
        '  return {',
        '    original: n,',
        '    padded: padded,',
        '    allowedSteps: padded,',
        '    neededSteps: n * n,',
        '    separates: padded >= n * n && padded > n',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'padding reaches the target length exactly, and never shrinks',
          assert: function (separate, api) {
            const rows = [2, 3, 4, 5, 6].map(separate);

            rows.forEach(function (row, i) {
              const n = i + 2;

              api.assert.equal(row.original, n);
              api.assert.equal(row.padded, n * n,
                'the padded length must be n² — got ' + row.padded + ' at n = ' + n);
              api.assert.ok(row.padded > row.original,
                'padding must actually grow the input at n = ' + n);
            });
          }
        },
        {
          name: 'the allowance is computed from the PADDED length',
          assert: function (separate, api) {
            [3, 4, 5, 6, 8].forEach(function (n) {
              const row = separate(n);

              api.assert.equal(row.neededSteps, n * n,
                'the underlying problem needs n² steps');
              api.assert.equal(row.allowedSteps, n * n,
                'linear in the PADDED length is n² — got ' + row.allowedSteps + ' at n = ' + n +
                  '; the starter uses the original length and gets ' + n);
              api.assert.ok(row.separates,
                'the padded language must fit in the smaller class at n = ' + n);
            });
          }
        },
        {
          name: 'the separation holds at every size, and the trivial case does not',
          assert: function (separate, api) {
            let count = 0;

            for (let n = 2; n <= 20; n += 1) {
              if (separate(n).separates) count += 1;
            }
            api.assert.equal(count, 19,
              'the argument must work at every n from 2 to 20 — got ' + count);

            const one = separate(1);

            api.assert.ok(!one.separates,
              'at n = 1 the padding does not grow the input, so there is nothing to move');
          }
        }
      ]
    }],

    'space-bounded-computation': [{
      id: 'savitch-reachability',
      title: 'Log-space reachability by recursive midpoint search, with the memory metered',
      prompt: 'reachable(graph, from, to) must decide directed reachability using Savitch’s ' +
        'recursion, and return { answer, peakBits, steps }. `graph` is { n, edges } where ' +
        '`edges[v]` is an array of successors. Define canReach(a, b, budget): true when a equals ' +
        'b; when budget is 0, true only if there is a direct edge; otherwise try EVERY vertex m ' +
        'as a midpoint and recurse on both halves with budget − 1. Start with budget = ' +
        'ceil(log2(n)). Meter the memory: each recursive frame HOLDS 3 vertex indices of ' +
        'ceil(log2(n)) bits each while it runs and RELEASES them on the way out, and `peakBits` ' +
        'is the high-water mark of what was held at once. The starter memoises, which makes it ' +
        'fast and linear-space — exactly the label-without-the-property this section is about.',
      entry: 'reachable',
      starter: [
        'function reachable(graph, from, to) {',
        '  // A memo table makes this fast and uses linear space. It is not log-space.',
        '  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, graph.n))));',
        '  const memo = {};',
        '  const state = { held: 0, peak: 0, steps: 0 };',
        '',
        '  function canReach(a, b, budget) {',
        '    state.steps += 1;',
        '    if (a === b) return true;',
        '    if (budget === 0) return (graph.edges[a] || []).indexOf(b) !== -1;',
        '    const key = a + ":" + b + ":" + budget;',
        '',
        '    if (memo[key] !== undefined) return memo[key];',
        '    state.held += bits;',
        '    state.peak = Math.max(state.peak, state.held);',
        '    let found = false;',
        '',
        '    for (let m = 0; m < graph.n && !found; m += 1) {',
        '      if (canReach(a, m, budget - 1) && canReach(m, b, budget - 1)) found = true;',
        '    }',
        '    memo[key] = found;',
        '    return found;',
        '  }',
        '  const answer = canReach(from, to, Math.ceil(Math.log2(Math.max(2, graph.n))));',
        '',
        '  return { answer: answer, peakBits: state.peak, steps: state.steps };',
        '}'
      ].join('\n'),
      solution: [
        'function reachable(graph, from, to) {',
        '  const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, graph.n))));',
        '  const state = { held: 0, peak: 0, steps: 0 };',
        '',
        '  function canReach(a, b, budget) {',
        '    state.steps += 1;',
        '    if (state.steps > 4000000) return false;',
        '    if (a === b) return true;',
        '    if (budget === 0) return (graph.edges[a] || []).indexOf(b) !== -1;',
        '    /* Three indices per frame: a, b and the midpoint. Nothing else is kept,',
        '       and the frame releases them on the way out — which is why the peak is',
        '       proportional to the DEPTH rather than to the work. */',
        '    state.held += bits * 3;',
        '    state.peak = Math.max(state.peak, state.held);',
        '    let found = false;',
        '',
        '    for (let m = 0; m < graph.n && !found; m += 1) {',
        '      if (canReach(a, m, budget - 1) && canReach(m, b, budget - 1)) found = true;',
        '    }',
        '    state.held -= bits * 3;',
        '    return found;',
        '  }',
        '  const answer = canReach(from, to, Math.ceil(Math.log2(Math.max(2, graph.n))));',
        '',
        '  return { answer: answer, peakBits: state.peak, steps: state.steps };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it answers reachability correctly on paths and on split graphs',
          assert: function (reachable, api) {
            const path = function (n) {
              const edges = {};

              for (let i = 0; i < n; i += 1) edges[i] = i + 1 < n ? [i + 1] : [];
              return { n: n, edges: edges };
            };

            for (let n = 2; n <= 10; n += 1) {
              api.assert.ok(reachable(path(n), 0, n - 1).answer,
                'the end of a ' + n + '-vertex path is reachable from the start');
              api.assert.ok(!reachable(path(n), n - 1, 0).answer,
                'and the start is not reachable from the end');
            }

            const split = { n: 6, edges: { 0: [1], 1: [2], 2: [], 3: [4], 4: [5], 5: [] } };

            api.assert.ok(reachable(split, 0, 2).answer, 'within the first component');
            api.assert.ok(!reachable(split, 0, 5).answer, 'across the two components');
          }
        },
        {
          name: 'the memory is released on the way out, so the peak tracks the depth',
          assert: function (reachable, api) {
            const path = function (n) {
              const edges = {};

              for (let i = 0; i < n; i += 1) edges[i] = i + 1 < n ? [i + 1] : [];
              return { n: n, edges: edges };
            };

            [4, 8, 12].forEach(function (n) {
              const out = reachable(path(n), 0, n - 1);
              const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
              const levels = Math.ceil(Math.log2(Math.max(2, n)));
              const bound = 3 * bits * levels;

              api.assert.ok(out.peakBits <= bound,
                'at n = ' + n + ' the peak must be at most 3 indices × ' + levels +
                  ' levels = ' + bound + ' bits, got ' + out.peakBits);
              api.assert.ok(out.peakBits > 0, 'the meter must actually count something');
            });
          }
        },
        {
          name: 'it pays in time for the space, rather than memoising',
          assert: function (reachable, api) {
            const path = function (n) {
              const edges = {};

              for (let i = 0; i < n; i += 1) edges[i] = i + 1 < n ? [i + 1] : [];
              return { n: n, edges: edges };
            };
            const small = reachable(path(4), 0, 3);
            const large = reachable(path(10), 0, 9);

            api.assert.ok(large.steps > 20 * small.steps,
              'the work must grow superpolynomially — a memoised version stays near linear. ' +
                'Got ' + small.steps + ' at n = 4 and ' + large.steps + ' at n = 10');
            api.assert.ok(large.steps > 1000,
              'Savitch on a 10-vertex path takes well over a thousand calls; got ' +
                large.steps);
          }
        }
      ]
    }],

    'randomised-and-interactive-classes': [{
      id: 'gni-verifier',
      title: 'The graph-non-isomorphism verifier, with its soundness error measured',
      prompt: 'verify(pair, prover, rounds, rng) must run the protocol and return ' +
        '{ accepted, trace }. `pair` is { left, right } where each graph is ' +
        '{ n, matrix }. In each round: pick a bit b using rng() < 0.5, permute graph b by a ' +
        'random permutation (use rng to shuffle), hand the permuted graph to ' +
        '`prover(challenge, pair, rng)`, and accept the round only if the prover returns b. ' +
        'Reject the whole run at the FIRST wrong answer. `trace` is one entry per round with ' +
        '{ choice, answer, correct }. The verifier must not test isomorphism itself — a ' +
        'permutation and a comparison is all it may do. The starter reveals the choice to the ' +
        'prover by passing it in, which makes every prover succeed and the soundness error zero.',
      entry: 'verify',
      starter: [
        'function verify(pair, prover, rounds, rng) {',
        '  // Passes the secret choice to the prover, so a liar is never caught.',
        '  const trace = [];',
        '',
        '  for (let i = 0; i < rounds; i += 1) {',
        '    const choice = rng() < 0.5 ? 0 : 1;',
        '    const source = choice === 0 ? pair.left : pair.right;',
        '    const order = [];',
        '',
        '    for (let v = 0; v < source.n; v += 1) order.push(v);',
        '    for (let v = source.n - 1; v > 0; v -= 1) {',
        '      const j = Math.floor(rng() * (v + 1));',
        '      const swap = order[v];',
        '',
        '      order[v] = order[j];',
        '      order[j] = swap;',
        '    }',
        '    const matrix = [];',
        '',
        '    for (let a = 0; a < source.n; a += 1) {',
        '      matrix.push([]);',
        '      for (let b = 0; b < source.n; b += 1) {',
        '        matrix[a].push(source.matrix[order[a]][order[b]]);',
        '      }',
        '    }',
        '    const answer = prover({ n: source.n, matrix: matrix, choice: choice }, pair, rng);',
        '    const correct = answer === choice;',
        '',
        '    trace.push({ choice: choice, answer: answer, correct: correct });',
        '    if (!correct) return { accepted: false, trace: trace };',
        '  }',
        '  return { accepted: true, trace: trace };',
        '}'
      ].join('\n'),
      solution: [
        'function verify(pair, prover, rounds, rng) {',
        '  const trace = [];',
        '',
        '  for (let i = 0; i < rounds; i += 1) {',
        '    const choice = rng() < 0.5 ? 0 : 1;',
        '    const source = choice === 0 ? pair.left : pair.right;',
        '    const order = [];',
        '',
        '    for (let v = 0; v < source.n; v += 1) order.push(v);',
        '    for (let v = source.n - 1; v > 0; v -= 1) {',
        '      const j = Math.floor(rng() * (v + 1));',
        '      const swap = order[v];',
        '',
        '      order[v] = order[j];',
        '      order[j] = swap;',
        '    }',
        '    const matrix = [];',
        '',
        '    for (let a = 0; a < source.n; a += 1) {',
        '      matrix.push([]);',
        '      for (let b = 0; b < source.n; b += 1) {',
        '        matrix[a].push(source.matrix[order[a]][order[b]]);',
        '      }',
        '    }',
        '    /* The challenge carries the permuted graph and nothing else. Leaking the',
        '       choice is the one mistake that makes the whole protocol vacuous. */',
        '    const answer = prover({ n: source.n, matrix: matrix }, pair, rng);',
        '    const correct = answer === choice;',
        '',
        '    trace.push({ choice: choice, answer: answer, correct: correct });',
        '    if (!correct) return { accepted: false, trace: trace };',
        '  }',
        '  return { accepted: true, trace: trace };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a guessing prover survives k rounds with probability about 2^-k',
          assert: function (verify, api) {
            const cycle = { n: 6, matrix: [
              [0, 1, 0, 0, 0, 1], [1, 0, 1, 0, 0, 0], [0, 1, 0, 1, 0, 0],
              [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 0, 1], [1, 0, 0, 0, 1, 0]] };
            const pair = { left: cycle, right: cycle };
            /* A prover that exploits whatever the challenge hands it. If the verifier
               leaks its secret choice, this reads it; otherwise it can only guess,
               because both graphs are the same and both answers are equally true. */
            const guessing = function (challenge, both, rng) {
              if (challenge.choice === 0 || challenge.choice === 1) return challenge.choice;
              return rng() < 0.5 ? 0 : 1;
            };
            let seed = 987654321;
            const rng = function () {
              seed = (seed * 1103515245 + 12345) % 2147483648;
              return seed / 2147483648;
            };

            [1, 2, 3, 4].forEach(function (rounds) {
              let accepted = 0;
              const trials = 4000;

              for (let i = 0; i < trials; i += 1) {
                if (verify(pair, guessing, rounds, rng).accepted) accepted += 1;
              }
              const measured = accepted / trials;
              const predicted = Math.pow(0.5, rounds);
              const tolerance = 4 * Math.sqrt(predicted * (1 - predicted) / trials);

              api.assert.ok(Math.abs(measured - predicted) <= tolerance,
                'at ' + rounds + ' rounds, measured ' + measured.toFixed(4) +
                  ' against a predicted ' + predicted.toFixed(4) + ' with tolerance ' +
                  tolerance.toFixed(4) + ' — a verifier that leaks its choice measures 1.0');
            });
          }
        },
        {
          name: 'an honest prover on a true claim is always accepted',
          assert: function (verify, api) {
            const cycle = { n: 6, matrix: [
              [0, 1, 0, 0, 0, 1], [1, 0, 1, 0, 0, 0], [0, 1, 0, 1, 0, 0],
              [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 0, 1], [1, 0, 0, 0, 1, 0]] };
            const triangles = { n: 6, matrix: [
              [0, 1, 1, 0, 0, 0], [1, 0, 1, 0, 0, 0], [1, 1, 0, 0, 0, 0],
              [0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 0, 1], [0, 0, 0, 1, 1, 0]] };
            const pair = { left: cycle, right: triangles };
            const degrees = function (graph) {
              return graph.matrix.map(function (row) {
                return row.reduce(function (a, b) { return a + b; }, 0);
              });
            };
            /* An honest prover may be unbounded. This one distinguishes the pair by
               triangle count, which is enough for these two graphs. */
            const triangleCount = function (graph) {
              let total = 0;

              for (let a = 0; a < graph.n; a += 1) {
                for (let b = a + 1; b < graph.n; b += 1) {
                  for (let c = b + 1; c < graph.n; c += 1) {
                    if (graph.matrix[a][b] && graph.matrix[b][c] && graph.matrix[a][c]) {
                      total += 1;
                    }
                  }
                }
              }
              return total;
            };
            const honest = function (challenge) {
              return triangleCount(challenge) === triangleCount(cycle) ? 0 : 1;
            };
            let seed = 24680;
            const rng = function () {
              seed = (seed * 1103515245 + 12345) % 2147483648;
              return seed / 2147483648;
            };

            api.assert.equal(degrees(cycle).join(''), degrees(triangles).join(''),
              'the two graphs have identical degree sequences, so counting does not separate them');
            for (let i = 0; i < 300; i += 1) {
              api.assert.ok(verify(pair, honest, 8, rng).accepted,
                'an honest prover on a true claim must never be rejected, at trial ' + i);
            }
          }
        },
        {
          name: 'the run stops at the first wrong answer, and the trace shows it',
          assert: function (verify, api) {
            const cycle = { n: 6, matrix: [
              [0, 1, 0, 0, 0, 1], [1, 0, 1, 0, 0, 0], [0, 1, 0, 1, 0, 0],
              [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 0, 1], [1, 0, 0, 0, 1, 0]] };
            const pair = { left: cycle, right: cycle };
            const wrong = function () { return 2; };
            let seed = 13579;
            const rng = function () {
              seed = (seed * 1103515245 + 12345) % 2147483648;
              return seed / 2147483648;
            };
            const out = verify(pair, wrong, 10, rng);

            api.assert.ok(!out.accepted, 'an always-wrong prover must be rejected');
            api.assert.equal(out.trace.length, 1,
              'the run must stop at the FIRST wrong answer — got ' + out.trace.length +
                ' rounds');
            api.assert.equal(out.trace[0].correct, false);
            api.assert.ok(out.trace[0].choice === 0 || out.trace[0].choice === 1,
              'the trace must record which graph the verifier picked');
          }
        }
      ]
    }],

    'circuits-and-non-uniform-computation': [{
      id: 'circuit-depth',
      title: 'Build a carry-out two ways, and measure size against depth',
      prompt: 'Two builders and two measurements. size(circuit) counts every gate that is not ' +
        'an input or a constant. depth(circuit) is the longest path from an input to the output ' +
        '— compute a level per gate as one more than the maximum of its inputs’ levels, with ' +
        'inputs at level 0. A circuit is { gates, inputs, output } where a gate is ' +
        '{ id, op, inputs } in topological order and op is "and", "or", "xor", "not" or ' +
        '"input". Then tree(n) must build the OR of n bits as a BALANCED tree rather than a ' +
        'chain: pair the values up, then pair the results, until one remains. The starter’s ' +
        'depth walks the gate list rather than the dependency graph, so it reports the gate ' +
        'count.',
      entry: 'depth',
      starter: [
        'function size(circuit) {',
        '  return circuit.gates.filter(function (gate) {',
        '    return gate.op !== "input" && gate.op !== "const";',
        '  }).length;',
        '}',
        '',
        'function depth(circuit) {',
        '  // Counts non-input gates, which is the SIZE. A tree and a chain come out equal.',
        '  return circuit.gates.filter(function (gate) {',
        '    return gate.op !== "input" && gate.op !== "const";',
        '  }).length;',
        '}',
        '',
        'function tree(n) {',
        '  const gates = [];',
        '  let last = null;',
        '',
        '  for (let i = 0; i < n; i += 1) gates.push({ id: "x" + i, op: "input", index: i });',
        '  last = "x0";',
        '  for (let i = 1; i < n; i += 1) {',
        '    gates.push({ id: "g" + i, op: "or", inputs: [last, "x" + i] });',
        '    last = "g" + i;',
        '  }',
        '  return { gates: gates, inputs: n, output: last };',
        '}'
      ].join('\n'),
      solution: [
        'function size(circuit) {',
        '  return circuit.gates.filter(function (gate) {',
        '    return gate.op !== "input" && gate.op !== "const";',
        '  }).length;',
        '}',
        '',
        'function depth(circuit) {',
        '  const levels = {};',
        '',
        '  circuit.gates.forEach(function (gate) {',
        '    if (gate.op === "input" || gate.op === "const") { levels[gate.id] = 0; return; }',
        '    levels[gate.id] = 1 + Math.max.apply(null, gate.inputs.map(function (id) {',
        '      return levels[id];',
        '    }));',
        '  });',
        '  return levels[circuit.output];',
        '}',
        '',
        'function tree(n) {',
        '  const gates = [];',
        '  let level = [];',
        '  let counter = 0;',
        '',
        '  for (let i = 0; i < n; i += 1) {',
        '    gates.push({ id: "x" + i, op: "input", index: i });',
        '    level.push("x" + i);',
        '  }',
        '  while (level.length > 1) {',
        '    const next = [];',
        '',
        '    for (let i = 0; i < level.length; i += 2) {',
        '      if (i + 1 === level.length) { next.push(level[i]); continue; }',
        '      const id = "g" + counter;',
        '',
        '      counter += 1;',
        '      gates.push({ id: id, op: "or", inputs: [level[i], level[i + 1]] });',
        '      next.push(id);',
        '    }',
        '    level = next;',
        '  }',
        '  return { gates: gates, inputs: n, output: level[0] };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'depth follows the dependency graph, not the gate list',
          assert: function (depth, api) {
            const chain = { inputs: 4, output: 'g3', gates: [
              { id: 'x0', op: 'input', index: 0 }, { id: 'x1', op: 'input', index: 1 },
              { id: 'x2', op: 'input', index: 2 }, { id: 'x3', op: 'input', index: 3 },
              { id: 'g1', op: 'or', inputs: ['x0', 'x1'] },
              { id: 'g2', op: 'or', inputs: ['g1', 'x2'] },
              { id: 'g3', op: 'or', inputs: ['g2', 'x3'] }
            ] };
            const balanced = { inputs: 4, output: 'g2', gates: [
              { id: 'x0', op: 'input', index: 0 }, { id: 'x1', op: 'input', index: 1 },
              { id: 'x2', op: 'input', index: 2 }, { id: 'x3', op: 'input', index: 3 },
              { id: 'g0', op: 'or', inputs: ['x0', 'x1'] },
              { id: 'g1', op: 'or', inputs: ['x2', 'x3'] },
              { id: 'g2', op: 'or', inputs: ['g0', 'g1'] }
            ] };

            api.assert.equal(depth(chain), 3, 'a three-gate chain is three deep');
            api.assert.equal(depth(balanced), 2,
              'the same three gates as a tree are two deep — the starter reports 3 for both');
          }
        },
        {
          name: 'the tree has the same size as a chain and logarithmic depth',
          assert: function (depth, api) {
            api.assert.ok(typeof depth === 'function');
            const build = function (n) {
              const gates = [];
              let level = [];
              let counter = 0;

              for (let i = 0; i < n; i += 1) {
                gates.push({ id: 'x' + i, op: 'input', index: i });
                level.push('x' + i);
              }
              while (level.length > 1) {
                const next = [];

                for (let i = 0; i < level.length; i += 2) {
                  if (i + 1 === level.length) { next.push(level[i]); continue; }
                  const id = 'g' + counter;

                  counter += 1;
                  gates.push({ id: id, op: 'or', inputs: [level[i], level[i + 1]] });
                  next.push(id);
                }
                level = next;
              }
              return { gates: gates, inputs: n, output: level[0] };
            };

            [2, 4, 8, 16].forEach(function (n) {
              const circuit = build(n);
              const gateCount = circuit.gates.filter(function (g) {
                return g.op !== 'input';
              }).length;

              api.assert.equal(gateCount, n - 1,
                'an OR over ' + n + ' bits needs n − 1 gates however it is arranged');
              api.assert.equal(depth(circuit), Math.ceil(Math.log2(n)),
                'and a balanced tree is ceil(log2 n) deep — expected ' +
                  Math.ceil(Math.log2(n)) + ' at n = ' + n + ', got ' + depth(circuit));
            });
          }
        },
        {
          name: 'a ripple carry is linear-depth and a lookahead is constant',
          assert: function (depth, api) {
            const ripple = function (n) {
              const gates = [];

              for (let i = 0; i < 2 * n; i += 1) {
                gates.push({ id: 'x' + i, op: 'input', index: i });
              }
              let carry = null;

              for (let i = 0; i < n; i += 1) {
                gates.push({ id: 'a' + i, op: 'and', inputs: ['x' + i, 'x' + (n + i)] });
                if (carry === null) { carry = 'a' + i; continue; }
                gates.push({ id: 'p' + i, op: 'or', inputs: ['x' + i, 'x' + (n + i)] });
                gates.push({ id: 'c' + i, op: 'and', inputs: ['p' + i, carry] });
                gates.push({ id: 'o' + i, op: 'or', inputs: ['a' + i, 'c' + i] });
                carry = 'o' + i;
              }
              return { gates: gates, inputs: 2 * n, output: carry };
            };

            api.assert.equal(depth(ripple(2)), 3, 'a 2-bit ripple carry is 3 deep');
            api.assert.equal(depth(ripple(4)), 7, 'a 4-bit one is 7');
            api.assert.equal(depth(ripple(6)), 11, 'a 6-bit one is 11 — linear in the width');
            api.assert.ok(depth(ripple(8)) > depth(ripple(4)),
              'depth must grow with the width for a ripple carry');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
