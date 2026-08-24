/**
 * Graded exercises for production automata, weighted machines and Büchi (M24.9-M24.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'automata-in-production': [{
      id: 'maximal-munch',
      title: 'Write the maximal-munch scanner loop with rule priority',
      prompt: 'scan(rules, input) must tokenise the input and return an array of ' +
        '{ type, text, at }. Each rule is { name, match, skip } where `match(input, from)` ' +
        'returns the length of the longest match starting at `from`, or 0 for no match, and ' +
        'declaration order is priority. At each position take the LONGEST match across all ' +
        'rules; break ties by the earliest rule; emit nothing for a rule marked `skip`; and ' +
        'throw an Error if no rule matches or the longest match has length 0. The starter ' +
        'returns at the first rule that matches, which is the classic bug.',
      entry: 'scan',
      starter: [
        'function scan(rules, input) {',
        '  // First success wins: ">>=" comes back as ">>" then "=".',
        '  const tokens = [];',
        '  let at = 0;',
        '',
        '  while (at < input.length) {',
        '    let chosen = null;',
        '',
        '    for (let i = 0; i < rules.length && chosen === null; i += 1) {',
        '      const length = rules[i].match(input, at);',
        '',
        '      if (length > 0) chosen = { rule: rules[i], length: length };',
        '    }',
        '    if (chosen === null) throw new Error(\'no rule matches at \' + at);',
        '    if (!chosen.rule.skip) {',
        '      tokens.push({ type: chosen.rule.name,',
        '        text: input.slice(at, at + chosen.length), at: at });',
        '    }',
        '    at += chosen.length;',
        '  }',
        '  return tokens;',
        '}'
      ].join('\n'),
      solution: [
        'function scan(rules, input) {',
        '  const tokens = [];',
        '  let at = 0;',
        '',
        '  while (at < input.length) {',
        '    let chosen = null;',
        '',
        '    for (let i = 0; i < rules.length; i += 1) {',
        '      const length = rules[i].match(input, at);',
        '',
        '      if (length > 0 && (chosen === null || length > chosen.length)) {',
        '        chosen = { rule: rules[i], length: length };',
        '      }',
        '    }',
        '    if (chosen === null || chosen.length === 0) {',
        '      throw new Error(\'no rule matches at \' + at);',
        '    }',
        '    if (!chosen.rule.skip) {',
        '      tokens.push({ type: chosen.rule.name,',
        '        text: input.slice(at, at + chosen.length), at: at });',
        '    }',
        '    at += chosen.length;',
        '  }',
        '  return tokens;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the longest match wins over a shorter one that already succeeded',
          assert: function (scan, api) {
            const literal = function (name, text) {
              return { name: name, match: function (input, from) {
                return input.slice(from, from + text.length) === text ? text.length : 0;
              } };
            };
            const rules = [literal('gt', '>'), literal('shift', '>>'),
              literal('shift-assign', '>>='), literal('assign', '=')];
            const tokens = scan(rules, '>>=');

            api.assert.equal(tokens.length, 1,
              '">>=" is one token, not three — got ' + tokens.length);
            api.assert.equal(tokens[0].type, 'shift-assign');
            api.assert.equal(tokens[0].text, '>>=');

            const two = scan(rules, '>>>');

            api.assert.equal(two.length, 2, '">>>" is shift then gt');
            api.assert.equal(two[0].type, 'shift');
            api.assert.equal(two[1].type, 'gt');
          }
        },
        {
          name: 'ties in length are broken by declaration order',
          assert: function (scan, api) {
            const keyword = function (word) {
              return { name: word, match: function (input, from) {
                return input.slice(from, from + word.length) === word ? word.length : 0;
              } };
            };
            const identifier = { name: 'identifier', match: function (input, from) {
              let length = 0;

              while (from + length < input.length && /[a-z]/.test(input[from + length])) {
                length += 1;
              }
              return length;
            } };
            const rules = [keyword('if'), keyword('in'), identifier];

            api.assert.equal(scan(rules, 'if')[0].type, 'if',
              'the keyword is declared first, so it wins the tie');
            api.assert.equal(scan(rules, 'in')[0].type, 'in', 'and so is this one');
            api.assert.equal(scan(rules, 'ifx')[0].type, 'identifier',
              'but a longer identifier match beats a keyword — maximal munch first');
            api.assert.equal(scan(rules, 'ifx')[0].text, 'ifx');
          }
        },
        {
          name: 'skipped rules produce no token, and no match is an error',
          assert: function (scan, api) {
            const spaces = { name: 'space', skip: true, match: function (input, from) {
              let length = 0;

              while (from + length < input.length && input[from + length] === ' ') length += 1;
              return length;
            } };
            const word = { name: 'word', match: function (input, from) {
              let length = 0;

              while (from + length < input.length && /[a-z]/.test(input[from + length])) {
                length += 1;
              }
              return length;
            } };
            const tokens = scan([spaces, word], 'ab   cd e');

            api.assert.equal(tokens.length, 3, 'three words, and the spaces are skipped');
            api.assert.deepEqual(tokens.map(function (t) { return t.text; }),
              ['ab', 'cd', 'e']);
            api.assert.equal(tokens[1].at, 5, 'positions are of the original input');

            api.assert.throws(function () { scan([word], 'ab!cd'); },
              'a character no rule matches must raise rather than loop');
          }
        }
      ]
    }],

    'weighted-and-probabilistic': [{
      id: 'viterbi-log-domain',
      title: 'Decode with Viterbi in the log domain',
      prompt: 'viterbi(model, observations) must return { path, logProbability } for the most ' +
        'probable state sequence. The model is { states, logInitial, logTransition, ' +
        'logEmission } with every probability ALREADY stored as a natural logarithm, so combine ' +
        'them by ADDING. Fill one trellis column per observation keeping the best score into ' +
        'each cell and a back-pointer, then read the path back from the best final cell. A ' +
        'missing entry in a table means log probability −Infinity. The starter multiplies plain ' +
        'probabilities recovered with Math.exp, which underflows to zero on long sequences.',
      entry: 'viterbi',
      opsLimit: 4000000,
      starter: [
        'function viterbi(model, observations) {',
        '  // Back to plain probabilities, which reach exactly zero after a few hundred steps.',
        '  function at(table, from, to) {',
        '    const row = table[from];',
        '',
        '    return row && row[to] !== undefined ? Math.exp(row[to]) : 0;',
        '  }',
        '  let column = {};',
        '',
        '  model.states.forEach(function (state) {',
        '    column[state] = { score: Math.exp(model.logInitial[state])',
        '      * at(model.logEmission, state, observations[0]), from: null };',
        '  });',
        '  const trellis = [column];',
        '',
        '  for (let t = 1; t < observations.length; t += 1) {',
        '    const next = {};',
        '',
        '    model.states.forEach(function (state) {',
        '      let best = { score: -1, from: model.states[0] };',
        '',
        '      model.states.forEach(function (from) {',
        '        const score = trellis[t - 1][from].score * at(model.logTransition, from, state);',
        '',
        '        if (score > best.score) best = { score: score, from: from };',
        '      });',
        '      next[state] = { score: best.score * at(model.logEmission, state, observations[t]),',
        '        from: best.from };',
        '    });',
        '    trellis.push(next);',
        '  }',
        '  const last = trellis[trellis.length - 1];',
        '  let best = model.states[0];',
        '',
        '  model.states.forEach(function (s) { if (last[s].score > last[best].score) best = s; });',
        '  const path = [best];',
        '',
        '  for (let t = trellis.length - 1; t > 0; t -= 1) path.unshift(trellis[t][path[0]].from);',
        '  return { path: path, logProbability: Math.log(last[best].score) };',
        '}'
      ].join('\n'),
      solution: [
        'function viterbi(model, observations) {',
        '  function at(table, from, to) {',
        '    const row = table[from];',
        '',
        '    return row && row[to] !== undefined ? row[to] : -Infinity;',
        '  }',
        '  const trellis = [{}];',
        '',
        '  model.states.forEach(function (state) {',
        '    trellis[0][state] = { score: model.logInitial[state]',
        '      + at(model.logEmission, state, observations[0]), from: null };',
        '  });',
        '  for (let t = 1; t < observations.length; t += 1) {',
        '    const column = {};',
        '',
        '    model.states.forEach(function (state) {',
        '      let best = { score: -Infinity, from: model.states[0] };',
        '',
        '      model.states.forEach(function (from) {',
        '        const score = trellis[t - 1][from].score + at(model.logTransition, from, state);',
        '',
        '        if (score > best.score) best = { score: score, from: from };',
        '      });',
        '      column[state] = { score: best.score',
        '        + at(model.logEmission, state, observations[t]), from: best.from };',
        '    });',
        '    trellis.push(column);',
        '  }',
        '  const last = trellis[trellis.length - 1];',
        '  let best = model.states[0];',
        '',
        '  model.states.forEach(function (s) { if (last[s].score > last[best].score) best = s; });',
        '  const path = [best];',
        '',
        '  for (let t = trellis.length - 1; t > 0; t -= 1) path.unshift(trellis[t][path[0]].from);',
        '  return { path: path, logProbability: last[best].score };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it matches brute-force enumeration on a small model',
          assert: function (viterbi, api) {
            const model = {
              states: ['sunny', 'rainy'],
              logInitial: { sunny: Math.log(0.6), rainy: Math.log(0.4) },
              logTransition: {
                sunny: { sunny: Math.log(0.7), rainy: Math.log(0.3) },
                rainy: { sunny: Math.log(0.4), rainy: Math.log(0.6) }
              },
              logEmission: {
                sunny: { walk: Math.log(0.6), shop: Math.log(0.3), clean: Math.log(0.1) },
                rainy: { walk: Math.log(0.1), shop: Math.log(0.4), clean: Math.log(0.5) }
              }
            };
            const score = function (path, observations) {
              let total = model.logInitial[path[0]]
                + model.logEmission[path[0]][observations[0]];

              for (let t = 1; t < path.length; t += 1) {
                total += model.logTransition[path[t - 1]][path[t]]
                  + model.logEmission[path[t]][observations[t]];
              }
              return total;
            };
            const enumerate = function (length) {
              let out = [[]];

              for (let i = 0; i < length; i += 1) {
                const next = [];

                out.forEach(function (prefix) {
                  model.states.forEach(function (s) { next.push(prefix.concat([s])); });
                });
                out = next;
              }
              return out;
            };

            [['walk', 'shop', 'clean'], ['clean', 'clean', 'clean'],
              ['walk', 'walk', 'shop', 'clean', 'clean']].forEach(function (observations) {
              const found = viterbi(model, observations);
              let best = { path: null, score: -Infinity };

              enumerate(observations.length).forEach(function (path) {
                const value = score(path, observations);

                if (value > best.score) best = { path: path, score: value };
              });
              api.assert.closeTo(found.logProbability, best.score, 1e-9,
                'the score must match the best enumerated path');
              api.assert.deepEqual(found.path, best.path, 'and so must the path itself');
            });
          }
        },
        {
          name: 'it survives a sequence long enough to underflow plain probabilities',
          assert: function (viterbi, api) {
            const model = {
              states: ['sunny', 'rainy'],
              logInitial: { sunny: Math.log(0.6), rainy: Math.log(0.4) },
              logTransition: {
                sunny: { sunny: Math.log(0.7), rainy: Math.log(0.3) },
                rainy: { sunny: Math.log(0.4), rainy: Math.log(0.6) }
              },
              logEmission: {
                sunny: { clean: Math.log(0.1) }, rainy: { clean: Math.log(0.5) }
              }
            };
            const observations = [];

            for (let i = 0; i < 1000; i += 1) observations.push('clean');
            const found = viterbi(model, observations);

            api.assert.ok(isFinite(found.logProbability),
              'the log-domain score must stay finite at 1 000 steps, got ' +
              found.logProbability);
            api.assert.ok(found.logProbability < -900,
              'and it must be a genuinely small probability: ' + found.logProbability);
            api.assert.equal(found.path.length, 1000, 'one state per observation');
            api.assert.ok(found.path.every(function (s) { return s === 'rainy'; }),
              'rainy explains "clean" better at every step');
          }
        },
        {
          name: 'a missing table entry is an impossible transition, not a zero score',
          assert: function (viterbi, api) {
            const model = {
              states: ['a', 'b'],
              logInitial: { a: Math.log(0.5), b: Math.log(0.5) },
              logTransition: { a: { a: Math.log(1) }, b: { b: Math.log(1) } },
              logEmission: { a: { x: Math.log(0.9), y: Math.log(0.1) },
                b: { x: Math.log(0.1), y: Math.log(0.9) } }
            };
            const found = viterbi(model, ['x', 'x', 'x']);

            api.assert.deepEqual(found.path, ['a', 'a', 'a'],
              'b cannot reach a, so the path must stay in a');
            api.assert.ok(isFinite(found.logProbability), 'and the score must be finite');

            const mixed = viterbi(model, ['x', 'y', 'y']);

            api.assert.equal(mixed.path.length, 3, 'a path is still returned');
            api.assert.ok(mixed.path.every(function (s) { return s === mixed.path[0]; }),
              'and it cannot switch, because no transition between a and b exists');
          }
        }
      ]
    }],

    'automata-over-infinite-words': [{
      id: 'nested-dfs',
      title: 'Find an accepting cycle with a nested depth-first search',
      prompt: 'emptiness(machine) must return { empty, stem, cycle } for a Büchi automaton ' +
        '{ states, alphabet, start, accepting, delta } where `delta[state][symbol]` is an array ' +
        'of destinations. Search outward from the start; when an accepting state is FINISHED in ' +
        'the outer search, run an inner search from it looking for a path back to itself. A hit ' +
        'is an accepting cycle: return `empty: false` with the symbols of the stem and the ' +
        'cycle. When no accepting cycle exists return `empty: true` with both arrays empty. The ' +
        'starter reports emptiness whenever an accepting state is merely reachable, which misses ' +
        'the cycle requirement entirely.',
      entry: 'emptiness',
      opsLimit: 4000000,
      starter: [
        'function emptiness(machine) {',
        '  // Reachability only: an accepting state that is not on a cycle is reported as a bug.',
        '  const seen = {};',
        '  const queue = [{ state: machine.start, word: [] }];',
        '',
        '  seen[machine.start] = true;',
        '  while (queue.length) {',
        '    const node = queue.shift();',
        '',
        '    if (machine.accepting.indexOf(node.state) !== -1) {',
        '      return { empty: false, stem: node.word, cycle: [] };',
        '    }',
        '    machine.alphabet.forEach(function (symbol) {',
        '      ((machine.delta[node.state] || {})[symbol] || []).forEach(function (next) {',
        '        if (seen[next]) return;',
        '        seen[next] = true;',
        '        queue.push({ state: next, word: node.word.concat([symbol]) });',
        '      });',
        '    });',
        '  }',
        '  return { empty: true, stem: [], cycle: [] };',
        '}'
      ].join('\n'),
      solution: [
        'function emptiness(machine) {',
        '  const outer = {};',
        '  const inner = {};',
        '  const stack = [];',
        '  let found = null;',
        '',
        '  function successors(state, symbol) {',
        '    return (machine.delta[state] || {})[symbol] || [];',
        '  }',
        '  function innerSearch(state, seed, path) {',
        '    if (found) return;',
        '    const mark = seed + \'@\' + state;',
        '',
        '    if (inner[mark]) return;',
        '    inner[mark] = true;',
        '    machine.alphabet.forEach(function (symbol) {',
        '      successors(state, symbol).forEach(function (next) {',
        '        if (found) return;',
        '        if (next === seed) {',
        '          found = { stem: stack.slice(), cycle: path.concat([symbol]) };',
        '          return;',
        '        }',
        '        innerSearch(next, seed, path.concat([symbol]));',
        '      });',
        '    });',
        '  }',
        '  function outerSearch(state) {',
        '    if (outer[state] || found) return;',
        '    outer[state] = true;',
        '    machine.alphabet.forEach(function (symbol) {',
        '      successors(state, symbol).forEach(function (next) {',
        '        stack.push(symbol);',
        '        outerSearch(next);',
        '        stack.pop();',
        '      });',
        '    });',
        '    if (machine.accepting.indexOf(state) === -1 || found) return;',
        '    innerSearch(state, state, []);',
        '  }',
        '  outerSearch(machine.start);',
        '  if (found === null) return { empty: true, stem: [], cycle: [] };',
        '  return { empty: false, stem: found.stem, cycle: found.cycle };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an accepting state with no cycle is NOT a counter-example',
          assert: function (emptiness, api) {
            /* q1 accepts but is a dead end: no infinite run visits it forever. */
            const machine = { states: ['q0', 'q1'], alphabet: ['a'], start: 'q0',
              accepting: ['q1'], delta: { q0: { a: ['q1'] }, q1: {} } };
            const result = emptiness(machine);

            api.assert.equal(result.empty, true,
              'reaching an accepting state is not enough — it must be on a cycle');
          }
        },
        {
          name: 'an accepting cycle is found, and the lasso really loops',
          assert: function (emptiness, api) {
            const machine = { states: ['idle', 'wait'], alphabet: ['r', 'g'], start: 'idle',
              accepting: ['wait'],
              delta: { idle: { r: ['wait'], g: ['idle'] }, wait: { r: ['wait'] } } };
            const result = emptiness(machine);

            api.assert.equal(result.empty, false, 'wait loops on r forever, so it accepts');
            api.assert.ok(result.cycle.length > 0, 'the cycle must be non-empty');

            let state = machine.start;

            result.stem.forEach(function (symbol) {
              state = ((machine.delta[state] || {})[symbol] || [])[0];
            });
            api.assert.ok(state !== undefined, 'the stem must be a real path');
            let onCycle = state;

            result.cycle.forEach(function (symbol) {
              onCycle = ((machine.delta[onCycle] || {})[symbol] || [])[0];
            });
            api.assert.equal(onCycle, state,
              'and the cycle must return to where the stem ended');
            api.assert.ok(machine.accepting.indexOf(state) !== -1,
              'and that state must be accepting');
          }
        },
        {
          name: 'a cycle among non-accepting states is not a counter-example',
          assert: function (emptiness, api) {
            const machine = { states: ['a', 'b', 'c'], alphabet: ['x'], start: 'a',
              accepting: ['c'],
              delta: { a: { x: ['b'] }, b: { x: ['a'] }, c: { x: ['c'] } } };
            const result = emptiness(machine);

            api.assert.equal(result.empty, true,
              'a and b cycle forever but neither is accepting, and c is unreachable');

            const reachable = { states: ['a', 'b', 'c'], alphabet: ['x'], start: 'a',
              accepting: ['c'],
              delta: { a: { x: ['b', 'c'] }, b: { x: ['a'] }, c: { x: ['c'] } } };

            api.assert.equal(emptiness(reachable).empty, false,
              'once c is reachable and loops, the language is non-empty');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
