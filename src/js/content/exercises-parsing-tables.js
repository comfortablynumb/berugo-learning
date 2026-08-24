/**
 * Graded exercises for LR tables, general parsing and PEGs (M25.5-M25.8).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'shift-reduce-and-lr0': [{
      id: 'lr0-item-sets',
      title: 'Build the LR(0) item-set collection with closure and goto',
      prompt: 'collection(grammar) must return { states, transitions }. `grammar` is ' +
        '{ start, rules } as before, already augmented — its start symbol has exactly one ' +
        'production. An ITEM is { rule: index into a flat production list, dot: number }; state ' +
        '0 is the closure of the single item for the start production with the dot at 0. ' +
        'CLOSURE: while some item has the dot before a nonterminal, add every production of ' +
        'that nonterminal with the dot at 0. GOTO(state, symbol): take every item whose dot is ' +
        'before that symbol, advance the dot, and close. States are compared by their item SETS, ' +
        'so a state reached twice must not be added twice. Transitions are ' +
        '{ from, symbol, to }. The starter never closes, so every state holds one item.',
      entry: 'collection',
      starter: [
        'function collection(grammar) {',
        '  // No closure: the parser never learns which productions it might be starting.',
        '  const productions = [];',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      productions.push({ lhs: name, rhs: rhs.slice() });',
        '    });',
        '  });',
        '  const key = function (items) {',
        '    return items.map(function (i) { return i.rule + ":" + i.dot; }).sort().join("|");',
        '  };',
        '  const states = [[{ rule: 0, dot: 0 }]];',
        '  const index = {};',
        '  const transitions = [];',
        '',
        '  index[key(states[0])] = 0;',
        '  for (let i = 0; i < states.length; i += 1) {',
        '    const symbols = [];',
        '',
        '    states[i].forEach(function (item) {',
        '      const rhs = productions[item.rule].rhs;',
        '',
        '      if (item.dot < rhs.length && symbols.indexOf(rhs[item.dot]) === -1) {',
        '        symbols.push(rhs[item.dot]);',
        '      }',
        '    });',
        '    symbols.forEach(function (symbol) {',
        '      const moved = states[i].filter(function (item) {',
        '        return productions[item.rule].rhs[item.dot] === symbol;',
        '      }).map(function (item) { return { rule: item.rule, dot: item.dot + 1 }; });',
        '',
        '      if (!moved.length) return;',
        '      const k = key(moved);',
        '',
        '      if (index[k] === undefined) { index[k] = states.length; states.push(moved); }',
        '      transitions.push({ from: i, symbol: symbol, to: index[k] });',
        '    });',
        '  }',
        '  return { states: states, transitions: transitions, productions: productions };',
        '}'
      ].join('\n'),
      solution: [
        'function collection(grammar) {',
        '  const productions = [];',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      productions.push({ lhs: name, rhs: rhs.slice() });',
        '    });',
        '  });',
        '',
        '  function key(items) {',
        '    return items.map(function (i) { return i.rule + ":" + i.dot; })',
        '      .sort().filter(function (k, i, all) { return all.indexOf(k) === i; }).join("|");',
        '  }',
        '',
        '  function closure(items) {',
        '    const out = items.slice();',
        '    const seen = {};',
        '',
        '    out.forEach(function (i) { seen[i.rule + ":" + i.dot] = true; });',
        '    for (let i = 0; i < out.length; i += 1) {',
        '      const rhs = productions[out[i].rule].rhs;',
        '      const symbol = rhs[out[i].dot];',
        '',
        '      if (symbol === undefined || !grammar.rules[symbol]) continue;',
        '      productions.forEach(function (p, index) {',
        '        if (p.lhs !== symbol || seen[index + ":0"]) return;',
        '        seen[index + ":0"] = true;',
        '        out.push({ rule: index, dot: 0 });',
        '      });',
        '    }',
        '    return out;',
        '  }',
        '',
        '  const states = [closure([{ rule: 0, dot: 0 }])];',
        '  const index = {};',
        '  const transitions = [];',
        '',
        '  index[key(states[0])] = 0;',
        '  for (let i = 0; i < states.length; i += 1) {',
        '    const symbols = [];',
        '',
        '    states[i].forEach(function (item) {',
        '      const symbol = productions[item.rule].rhs[item.dot];',
        '',
        '      if (symbol !== undefined && symbols.indexOf(symbol) === -1) symbols.push(symbol);',
        '    });',
        '    symbols.forEach(function (symbol) {',
        '      const moved = states[i].filter(function (item) {',
        '        return productions[item.rule].rhs[item.dot] === symbol;',
        '      }).map(function (item) { return { rule: item.rule, dot: item.dot + 1 }; });',
        '',
        '      if (!moved.length) return;',
        '      const closed = closure(moved);',
        '      const k = key(closed);',
        '',
        '      if (index[k] === undefined) { index[k] = states.length; states.push(closed); }',
        '      transitions.push({ from: i, symbol: symbol, to: index[k] });',
        '    });',
        '  }',
        '  return { states: states, transitions: transitions, productions: productions };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'state 0 is closed: the start item pulls in every production it can begin with',
          assert: function (collection, api) {
            const g = {
              start: 'Z',
              rules: { Z: [['E']], E: [['E', '+', 'T'], ['T']], T: [['a']] }
            };
            const built = collection(g);

            api.assert.equal(built.states[0].length, 4,
              'Z -> . E, E -> . E + T, E -> . T and T -> . a — expected 4, got ' +
                built.states[0].length);
            const lhs = built.states[0].map(function (item) {
              return built.productions[item.rule].lhs;
            }).sort();

            api.assert.deepEqual(lhs, ['E', 'E', 'T', 'Z'],
              'closure must add both E rules and the T rule to the start item');
            api.assert.ok(built.states[0].every(function (item) { return item.dot === 0; }),
              'every item added by closure has its dot at the start');
          }
        },
        {
          name: 'the expression grammar has the expected number of states',
          assert: function (collection, api) {
            const g = {
              start: 'Z',
              rules: { Z: [['E']], E: [['E', '+', 'T'], ['T']], T: [['T', '*', 'F'], ['F']],
                F: [['(', 'E', ')'], ['a']] }
            };
            const built = collection(g);

            api.assert.equal(built.states.length, 12,
              'the classic expression grammar has 12 LR(0) states — got ' + built.states.length);
            api.assert.ok(built.transitions.length >= 12,
              'every state but the accepting ones has at least one outgoing transition');
            built.transitions.forEach(function (edge) {
              api.assert.ok(edge.to < built.states.length, 'a transition points off the end');
            });
          }
        },
        {
          name: 'a state reached by two routes is not duplicated',
          assert: function (collection, api) {
            const g = {
              start: 'Z',
              rules: { Z: [['S']], S: [['a', 'X'], ['b', 'X']], X: [['c']] }
            };
            const built = collection(g);
            const keys = built.states.map(function (items) {
              return items.map(function (i) { return i.rule + ':' + i.dot; })
                .sort().filter(function (k, i, all) { return all.indexOf(k) === i; }).join('|');
            });

            api.assert.equal(keys.length, new Set(keys).size,
              'two states have identical item sets, so goto did not deduplicate');
            const afterX = built.transitions.filter(function (e) { return e.symbol === 'c'; });

            api.assert.equal(afterX.length, 2,
              'both routes reach a state on c — expected 2 transitions, got ' + afterX.length);
            api.assert.equal(afterX[0].to, afterX[1].to,
              'both must land in the SAME state, since the item sets are equal');
          }
        }
      ]
    }],

    'lalr-and-canonical-lr1': [{
      id: 'merge-by-core',
      title: 'Merge LR(1) states by core, and detect the conflicts it induces',
      prompt: 'mergeByCore(states) must take an array of LR(1) states — each an array of items ' +
        '{ rule, dot, lookahead } — and return { states, mapping, induced }. Group states whose ' +
        'CORE (the items with lookaheads stripped) is equal; each group becomes one merged ' +
        'state holding the union of the items, deduplicated on (rule, dot, lookahead). ' +
        '`mapping[i]` is the merged index of original state i, in first-appearance order. ' +
        '`induced` counts REDUCE/REDUCE conflicts present after the merge and absent before: a ' +
        'merged state has one when two DIFFERENT completed items (dot at the end of their rule, ' +
        'given by `lengths[rule]`) share a lookahead, and neither source state had that clash. ' +
        'The starter merges but never counts, so the cost of the merge is invisible.',
      entry: 'mergeByCore',
      starter: [
        'function mergeByCore(states, lengths) {',
        '  // Merges correctly and reports induced: 0 always, which is the whole point missed.',
        '  const groups = {};',
        '  const order = [];',
        '  const mapping = {};',
        '',
        '  states.forEach(function (items, i) {',
        '    const core = items.map(function (it) { return it.rule + ":" + it.dot; })',
        '      .sort().filter(function (k, j, all) { return all.indexOf(k) === j; }).join("|");',
        '',
        '    if (!groups[core]) { groups[core] = []; order.push(core); }',
        '    groups[core].push(i);',
        '  });',
        '  const merged = order.map(function (core, index) {',
        '    const out = [];',
        '    const seen = {};',
        '',
        '    groups[core].forEach(function (source) {',
        '      mapping[source] = index;',
        '      states[source].forEach(function (item) {',
        '        const k = item.rule + ":" + item.dot + ":" + item.lookahead;',
        '',
        '        if (seen[k]) return;',
        '        seen[k] = true;',
        '        out.push(item);',
        '      });',
        '    });',
        '    return out;',
        '  });',
        '  return { states: merged, mapping: mapping, induced: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function mergeByCore(states, lengths) {',
        '  const groups = {};',
        '  const order = [];',
        '  const mapping = {};',
        '',
        '  function coreOf(items) {',
        '    return items.map(function (it) { return it.rule + ":" + it.dot; })',
        '      .sort().filter(function (k, j, all) { return all.indexOf(k) === j; }).join("|");',
        '  }',
        '',
        '  function clashes(items) {',
        '    const byLookahead = {};',
        '    let count = 0;',
        '',
        '    items.forEach(function (item) {',
        '      if (item.dot !== lengths[item.rule]) return;',
        '      if (!byLookahead[item.lookahead]) byLookahead[item.lookahead] = [];',
        '      if (byLookahead[item.lookahead].indexOf(item.rule) === -1) {',
        '        byLookahead[item.lookahead].push(item.rule);',
        '      }',
        '    });',
        '    Object.keys(byLookahead).forEach(function (look) {',
        '      if (byLookahead[look].length > 1) count += byLookahead[look].length - 1;',
        '    });',
        '    return count;',
        '  }',
        '',
        '  states.forEach(function (items, i) {',
        '    const core = coreOf(items);',
        '',
        '    if (!groups[core]) { groups[core] = []; order.push(core); }',
        '    groups[core].push(i);',
        '  });',
        '  let induced = 0;',
        '  const merged = order.map(function (core, index) {',
        '    const out = [];',
        '    const seen = {};',
        '',
        '    groups[core].forEach(function (source) {',
        '      mapping[source] = index;',
        '      states[source].forEach(function (item) {',
        '        const k = item.rule + ":" + item.dot + ":" + item.lookahead;',
        '',
        '        if (seen[k]) return;',
        '        seen[k] = true;',
        '        out.push(item);',
        '      });',
        '    });',
        '    const before = groups[core].reduce(function (total, source) {',
        '      return total + clashes(states[source]);',
        '    }, 0);',
        '',
        '    induced += Math.max(0, clashes(out) - before);',
        '    return out;',
        '  });',
        '  return { states: merged, mapping: mapping, induced: induced };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'equal cores merge and unequal cores do not',
          assert: function (mergeByCore, api) {
            const lengths = { 0: 1, 1: 1, 2: 2 };
            const states = [
              [{ rule: 0, dot: 1, lookahead: 'c' }],
              [{ rule: 0, dot: 1, lookahead: 'd' }],
              [{ rule: 2, dot: 1, lookahead: '$' }]
            ];
            const out = mergeByCore(states, lengths);

            api.assert.equal(out.states.length, 2,
              'the first two share a core and must become one — got ' + out.states.length);
            api.assert.equal(out.mapping[0], out.mapping[1], 'states 0 and 1 merge');
            api.assert.notEqual(out.mapping[0], out.mapping[2], 'state 2 has a different core');
            api.assert.equal(out.states[out.mapping[0]].length, 2,
              'the merged state holds the union of the lookaheads');
          }
        },
        {
          name: 'the classic non-LALR pair induces exactly two reduce/reduce conflicts',
          assert: function (mergeByCore, api) {
            const lengths = { 0: 1, 1: 1 };
            const states = [
              [{ rule: 0, dot: 1, lookahead: 'c' }, { rule: 1, dot: 1, lookahead: 'd' }],
              [{ rule: 0, dot: 1, lookahead: 'd' }, { rule: 1, dot: 1, lookahead: 'c' }]
            ];
            const out = mergeByCore(states, lengths);

            api.assert.equal(out.states.length, 1, 'the two cores are equal');
            api.assert.equal(out.states[0].length, 4, 'all four items survive the union');
            api.assert.equal(out.induced, 2,
              'after the merge both rules reduce on both c and d — expected 2 induced ' +
                'conflicts, got ' + out.induced);
          }
        },
        {
          name: 'a merge that pools nothing new induces nothing',
          assert: function (mergeByCore, api) {
            const lengths = { 0: 1, 1: 1 };
            const same = [
              [{ rule: 0, dot: 1, lookahead: 'c' }],
              [{ rule: 0, dot: 1, lookahead: 'c' }]
            ];

            api.assert.equal(mergeByCore(same, lengths).induced, 0,
              'identical lookaheads cannot create a clash');

            const alreadyBad = [
              [{ rule: 0, dot: 1, lookahead: 'c' }, { rule: 1, dot: 1, lookahead: 'c' }],
              [{ rule: 0, dot: 1, lookahead: 'c' }, { rule: 1, dot: 1, lookahead: 'c' }]
            ];

            api.assert.equal(mergeByCore(alreadyBad, lengths).induced, 0,
              'a conflict both sources already had was not induced by the merge');
          }
        }
      ]
    }],

    'general-parsing-earley-cyk-glr': [{
      id: 'earley-recognise',
      title: 'Earley recognition, with the nullable rule that breaks naive implementations',
      prompt: 'recognise(grammar, tokens) must return whether the grammar derives the token ' +
        'array. `grammar` is { start, rules } with ε as an empty right-hand side. Build one ' +
        'column per input position from 0 to n. Seed column 0 with every production of the ' +
        'start symbol, dot 0, origin 0. In each column, to a fixed point: PREDICT a dot before ' +
        'a nonterminal by adding its productions with origin = this column; SCAN a dot before a ' +
        'terminal matching the input by adding the advanced item to the NEXT column; COMPLETE a ' +
        'finished item by advancing every item in its ORIGIN column whose dot sits before its ' +
        'left-hand side. Accept when the last column holds a finished start production with ' +
        'origin 0. **The nullable case**: when predicting a nonterminal that can derive nothing, ' +
        'also advance the predicting item immediately. The starter omits that, and rejects the ' +
        'empty string for `S -> A A A A` with `A -> a | eps`.',
      entry: 'recognise',
      starter: [
        'function recognise(grammar, tokens) {',
        '  // No nullable handling: a prediction made after the completion never learns.',
        '  const productions = [];',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      productions.push({ lhs: name, rhs: rhs.slice() });',
        '    });',
        '  });',
        '  const columns = [];',
        '',
        '  for (let i = 0; i <= tokens.length; i += 1) columns.push([]);',
        '  const seen = columns.map(function () { return {}; });',
        '',
        '  function add(at, item) {',
        '    const k = item.rule + ":" + item.dot + ":" + item.origin;',
        '',
        '    if (seen[at][k]) return;',
        '    seen[at][k] = true;',
        '    columns[at].push(item);',
        '  }',
        '  productions.forEach(function (p, i) {',
        '    if (p.lhs === grammar.start) add(0, { rule: i, dot: 0, origin: 0 });',
        '  });',
        '  for (let at = 0; at <= tokens.length; at += 1) {',
        '    for (let i = 0; i < columns[at].length; i += 1) {',
        '      const item = columns[at][i];',
        '      const rhs = productions[item.rule].rhs;',
        '      const next = rhs[item.dot];',
        '',
        '      if (next === undefined) {',
        '        columns[item.origin].forEach(function (waiting) {',
        '          if (productions[waiting.rule].rhs[waiting.dot] !== productions[item.rule].lhs) {',
        '            return;',
        '          }',
        '          add(at, { rule: waiting.rule, dot: waiting.dot + 1, origin: waiting.origin });',
        '        });',
        '        continue;',
        '      }',
        '      if (grammar.rules[next]) {',
        '        productions.forEach(function (p, index) {',
        '          if (p.lhs === next) add(at, { rule: index, dot: 0, origin: at });',
        '        });',
        '        continue;',
        '      }',
        '      if (tokens[at] === next) {',
        '        add(at + 1, { rule: item.rule, dot: item.dot + 1, origin: item.origin });',
        '      }',
        '    }',
        '  }',
        '  return columns[tokens.length].some(function (item) {',
        '    return productions[item.rule].lhs === grammar.start && item.origin === 0',
        '      && item.dot === productions[item.rule].rhs.length;',
        '  });',
        '}'
      ].join('\n'),
      solution: [
        'function recognise(grammar, tokens) {',
        '  const productions = [];',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      productions.push({ lhs: name, rhs: rhs.slice() });',
        '    });',
        '  });',
        '  const nullable = {};',
        '',
        '  for (let round = 0; round < 30; round += 1) {',
        '    productions.forEach(function (p) {',
        '      if (p.rhs.every(function (s) { return nullable[s]; })) nullable[p.lhs] = true;',
        '    });',
        '  }',
        '  const columns = [];',
        '',
        '  for (let i = 0; i <= tokens.length; i += 1) columns.push([]);',
        '  const seen = columns.map(function () { return {}; });',
        '',
        '  function add(at, item) {',
        '    const k = item.rule + ":" + item.dot + ":" + item.origin;',
        '',
        '    if (seen[at][k]) return;',
        '    seen[at][k] = true;',
        '    columns[at].push(item);',
        '  }',
        '  productions.forEach(function (p, i) {',
        '    if (p.lhs === grammar.start) add(0, { rule: i, dot: 0, origin: 0 });',
        '  });',
        '  for (let at = 0; at <= tokens.length; at += 1) {',
        '    for (let i = 0; i < columns[at].length; i += 1) {',
        '      const item = columns[at][i];',
        '      const rhs = productions[item.rule].rhs;',
        '      const next = rhs[item.dot];',
        '',
        '      if (next === undefined) {',
        '        const lhs = productions[item.rule].lhs;',
        '',
        '        columns[item.origin].forEach(function (waiting) {',
        '          if (productions[waiting.rule].rhs[waiting.dot] !== lhs) return;',
        '          add(at, { rule: waiting.rule, dot: waiting.dot + 1, origin: waiting.origin });',
        '        });',
        '        continue;',
        '      }',
        '      if (grammar.rules[next]) {',
        '        productions.forEach(function (p, index) {',
        '          if (p.lhs === next) add(at, { rule: index, dot: 0, origin: at });',
        '        });',
        '        if (nullable[next]) {',
        '          add(at, { rule: item.rule, dot: item.dot + 1, origin: item.origin });',
        '        }',
        '        continue;',
        '      }',
        '      if (tokens[at] === next) {',
        '        add(at + 1, { rule: item.rule, dot: item.dot + 1, origin: item.origin });',
        '      }',
        '    }',
        '  }',
        '  return columns[tokens.length].some(function (item) {',
        '    return productions[item.rule].lhs === grammar.start && item.origin === 0',
        '      && item.dot === productions[item.rule].rhs.length;',
        '  });',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the nullable grammar that breaks naive Earley',
          assert: function (recognise, api) {
            const g = {
              start: 'S',
              rules: { S: [['A', 'A', 'A', 'A']], A: [['a'], []] }
            };

            api.assert.ok(recognise(g, []),
              'the empty string IS derivable — this is the Aycock-Horspool case');
            api.assert.ok(recognise(g, ['a']), 'one a and three epsilons');
            api.assert.ok(recognise(g, ['a', 'a']), 'two a and two epsilons');
            api.assert.ok(recognise(g, ['a', 'a', 'a', 'a']), 'four a');
            api.assert.ok(!recognise(g, ['a', 'a', 'a', 'a', 'a']), 'five a is too many');
          }
        },
        {
          name: 'left recursion and ambiguity need no grammar massaging',
          assert: function (recognise, api) {
            const left = { start: 'E', rules: { E: [['E', '+', 'T'], ['T']], T: [['a']] } };

            api.assert.ok(recognise(left, ['a']), 'left recursion is fine in Earley');
            api.assert.ok(recognise(left, ['a', '+', 'a', '+', 'a']));
            api.assert.ok(!recognise(left, ['a', '+']));

            const amb = { start: 'E', rules: { E: [['E', '+', 'E'], ['a']] } };

            api.assert.ok(recognise(amb, ['a', '+', 'a', '+', 'a']),
              'ambiguity affects the tree count, not acceptance');
            api.assert.ok(!recognise(amb, ['+', 'a']));
          }
        },
        {
          name: 'it agrees with a brute-force derivation search over every short string',
          assert: function (recognise, api) {
            const g = { start: 'S', rules: { S: [['(', 'S', ')', 'S'], []] } };
            const balanced = function (tokens) {
              let depth = 0;

              for (let i = 0; i < tokens.length; i += 1) {
                depth += tokens[i] === '(' ? 1 : -1;
                if (depth < 0) return false;
              }
              return depth === 0;
            };
            let checked = 0;

            for (let length = 0; length <= 6; length += 1) {
              for (let mask = 0; mask < Math.pow(2, length); mask += 1) {
                const tokens = [];

                for (let bit = 0; bit < length; bit += 1) {
                  tokens.push((mask >> bit) & 1 ? ')' : '(');
                }
                checked += 1;
                api.assert.equal(recognise(g, tokens), balanced(tokens),
                  'disagreement on "' + tokens.join('') + '"');
              }
            }
            api.assert.ok(checked >= 127, 'expected at least 127 inputs, got ' + checked);
          }
        }
      ]
    }],

    'pegs-and-packrat-parsing': [{
      id: 'packrat',
      title: 'Add packrat memoisation, and measure that it changed only the cost',
      prompt: 'parse(grammar, input, options) must evaluate a PEG and return ' +
        '{ end, steps, entries } — `end` is the position reached or -1 for failure, `steps` ' +
        'counts every expression evaluation, and `entries` is the number of memo entries used ' +
        '(0 when `options.memo` is false). Expressions are { type } objects: `lit` with `text`, ' +
        '`ref` with `name`, `seq` with `parts`, `choice` with `parts`. Ordered choice returns ' +
        'the FIRST alternative that succeeds. Memoise on (rule name, position) only — that pair ' +
        'is the whole of packrat. Seed a memo entry with -1 before evaluating it, so a ' +
        'left-recursive rule rejects instead of hanging. The starter counts steps and never ' +
        'caches, so the fixture is exponential.',
      entry: 'parse',
      starter: [
        'function parse(grammar, input, options) {',
        '  // No cache: the same (rule, position) pair is recomputed on every path to it.',
        '  const state = { steps: 0 };',
        '',
        '  function evaluate(expression, at) {',
        '    state.steps += 1;',
        '    if (state.steps > 4000000) return -1;',
        '    if (expression.type === "lit") {',
        '      return input.slice(at, at + expression.text.length) === expression.text',
        '        ? at + expression.text.length : -1;',
        '    }',
        '    if (expression.type === "ref") return evaluate(grammar.rules[expression.name], at);',
        '    if (expression.type === "seq") {',
        '      let position = at;',
        '',
        '      for (let i = 0; i < expression.parts.length; i += 1) {',
        '        position = evaluate(expression.parts[i], position);',
        '        if (position === -1) return -1;',
        '      }',
        '      return position;',
        '    }',
        '    for (let i = 0; i < expression.parts.length; i += 1) {',
        '      const position = evaluate(expression.parts[i], at);',
        '',
        '      if (position !== -1) return position;',
        '    }',
        '    return -1;',
        '  }',
        '  const end = evaluate(grammar.rules[grammar.start], 0);',
        '',
        '  return { end: end, steps: state.steps, entries: 0 };',
        '}'
      ].join('\n'),
      solution: [
        'function parse(grammar, input, options) {',
        '  const settings = options || {};',
        '  const state = { steps: 0, memo: settings.memo === false ? null : {} };',
        '',
        '  function evaluate(expression, at) {',
        '    state.steps += 1;',
        '    if (state.steps > 4000000) return -1;',
        '    if (expression.type === "lit") {',
        '      return input.slice(at, at + expression.text.length) === expression.text',
        '        ? at + expression.text.length : -1;',
        '    }',
        '    if (expression.type === "ref") return evaluateRule(expression.name, at);',
        '    if (expression.type === "seq") {',
        '      let position = at;',
        '',
        '      for (let i = 0; i < expression.parts.length; i += 1) {',
        '        position = evaluate(expression.parts[i], position);',
        '        if (position === -1) return -1;',
        '      }',
        '      return position;',
        '    }',
        '    for (let i = 0; i < expression.parts.length; i += 1) {',
        '      const position = evaluate(expression.parts[i], at);',
        '',
        '      if (position !== -1) return position;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  function evaluateRule(name, at) {',
        '    if (!state.memo) return evaluate(grammar.rules[name], at);',
        '    const key = name + ":" + at;',
        '',
        '    if (state.memo[key] !== undefined) return state.memo[key];',
        '    state.memo[key] = -1;',
        '    const result = evaluate(grammar.rules[name], at);',
        '',
        '    state.memo[key] = result;',
        '    return result;',
        '  }',
        '  const end = evaluateRule(grammar.start, 0);',
        '',
        '  return { end: end, steps: state.steps,',
        '    entries: state.memo ? Object.keys(state.memo).length : 0 };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the cache changes the cost and not the answer',
          assert: function (parse, api) {
            const fixture = function (depth) {
              const rules = {};

              for (let i = 0; i < depth; i += 1) {
                const next = 'A' + (i + 1);

                rules['A' + i] = { type: 'choice', parts: [
                  { type: 'seq', parts: [{ type: 'ref', name: next },
                    { type: 'ref', name: next }, { type: 'lit', text: 'z' }] },
                  { type: 'ref', name: next }
                ] };
              }
              rules['A' + depth] = { type: 'lit', text: 'a' };
              return { start: 'A0', rules: rules };
            };

            [4, 8, 10].forEach(function (depth) {
              const memo = parse(fixture(depth), 'a', { memo: true });
              const plain = parse(fixture(depth), 'a', { memo: false });

              api.assert.equal(memo.end, plain.end,
                'the cache changed the result at depth ' + depth);
              api.assert.equal(memo.end, 1, 'both must consume the single character');
            });
          }
        },
        {
          name: 'memoised steps grow linearly and plain steps do not',
          assert: function (parse, api) {
            const fixture = function (depth) {
              const rules = {};

              for (let i = 0; i < depth; i += 1) {
                const next = 'A' + (i + 1);

                rules['A' + i] = { type: 'choice', parts: [
                  { type: 'seq', parts: [{ type: 'ref', name: next },
                    { type: 'ref', name: next }, { type: 'lit', text: 'z' }] },
                  { type: 'ref', name: next }
                ] };
              }
              rules['A' + depth] = { type: 'lit', text: 'a' };
              return { start: 'A0', rules: rules };
            };
            const four = parse(fixture(4), 'a', { memo: true });
            const ten = parse(fixture(10), 'a', { memo: true });
            const plainFour = parse(fixture(4), 'a', { memo: false });
            const plainTen = parse(fixture(10), 'a', { memo: false });

            api.assert.atMost(ten.steps, four.steps * 4,
              'memoised growth must be linear-ish: 4 to 10 levels should not multiply steps by ' +
                'more than four, got ' + four.steps + ' then ' + ten.steps);
            api.assert.atLeast(plainTen.steps / plainFour.steps, 50,
              'without the cache the growth must be dramatic — got a ratio of ' +
                (plainTen.steps / plainFour.steps).toFixed(1));
            api.assert.equal(ten.entries, 21,
              'one entry per (rule, position) actually reached — got ' + ten.entries);
            api.assert.equal(four.entries, 9,
              'and 9 at depth 4, so the table grows by two entries per level');
          }
        },
        {
          name: 'ordered choice commits to the first success, and left recursion rejects',
          assert: function (parse, api) {
            const shortFirst = { start: 'S', rules: { S: { type: 'choice', parts: [
              { type: 'lit', text: 'a' }, { type: 'lit', text: 'ab' }] } } };
            const longFirst = { start: 'S', rules: { S: { type: 'choice', parts: [
              { type: 'lit', text: 'ab' }, { type: 'lit', text: 'a' }] } } };

            api.assert.equal(parse(shortFirst, 'ab', { memo: true }).end, 1,
              'the choice commits to "a" and consumes 1 of 2');
            api.assert.equal(parse(longFirst, 'ab', { memo: true }).end, 2,
              'longest first consumes both');

            const left = { start: 'A', rules: { A: { type: 'choice', parts: [
              { type: 'seq', parts: [{ type: 'ref', name: 'A' }, { type: 'lit', text: 'x' }] },
              { type: 'lit', text: 'y' }] } } };
            const out = parse(left, 'y', { memo: true });

            api.assert.equal(out.end, 1,
              'seeding the memo entry with failure turns the hang into a rejection of the ' +
                'recursive alternative, so "y" still parses');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
