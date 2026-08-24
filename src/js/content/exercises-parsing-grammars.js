/**
 * Graded exercises for grammars, transformations, PDAs and LL(1) (M25.1-M25.4).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'grammars-and-ambiguity': [{
      id: 'count-parse-trees',
      title: 'Count the parse trees of an input, so ambiguity becomes a number',
      prompt: 'countTrees(grammar, tokens) must return how many DISTINCT parse trees the ' +
        'grammar has for the token array. `grammar` is { start, rules } where rules maps a ' +
        'nonterminal to an array of right-hand sides, each an array of symbols; a symbol is a ' +
        'nonterminal exactly when it appears as a key of `rules`. Two trees are distinct when ' +
        'their shapes differ, not when their derivation orders do — so count STRUCTURES. Cap ' +
        'the recursion so a left-recursive rule cannot loop forever: never expand a nonterminal ' +
        'over the same span twice on one path. The starter counts derivations, which ' +
        'double-counts everything.',
      entry: 'countTrees',
      starter: [
        'function countTrees(grammar, tokens) {',
        '  // Counts DERIVATIONS: expanding left-first and right-first are counted separately,',
        '  // so a two-operator sum comes back as 4 rather than 2.',
        '  function ways(symbol, from, to) {',
        '    if (!grammar.rules[symbol]) {',
        '      return (to - from === 1 && tokens[from] === symbol) ? 1 : 0;',
        '    }',
        '    let total = 0;',
        '',
        '    grammar.rules[symbol].forEach(function (rhs) {',
        '      total += split(rhs, 0, from, to) * 2;',
        '    });',
        '    return total;',
        '  }',
        '',
        '  function split(rhs, at, from, to) {',
        '    if (at === rhs.length) return from === to ? 1 : 0;',
        '    let total = 0;',
        '',
        '    for (let mid = from; mid <= to; mid += 1) {',
        '      const left = ways(rhs[at], from, mid);',
        '',
        '      if (left) total += left * split(rhs, at + 1, mid, to);',
        '    }',
        '    return total;',
        '  }',
        '  return ways(grammar.start, 0, tokens.length);',
        '}'
      ].join('\n'),
      solution: [
        'function countTrees(grammar, tokens) {',
        '  const memo = {};',
        '  const active = {};',
        '',
        '  function ways(symbol, from, to) {',
        '    if (!grammar.rules[symbol]) {',
        '      return (to - from === 1 && tokens[from] === symbol) ? 1 : 0;',
        '    }',
        '    const key = symbol + ":" + from + ":" + to;',
        '',
        '    if (memo[key] !== undefined) return memo[key];',
        '    if (active[key]) return 0;',
        '    active[key] = true;',
        '    let total = 0;',
        '',
        '    grammar.rules[symbol].forEach(function (rhs) {',
        '      total += split(rhs, 0, from, to);',
        '    });',
        '    active[key] = false;',
        '    memo[key] = total;',
        '    return total;',
        '  }',
        '',
        '  function split(rhs, at, from, to) {',
        '    if (at === rhs.length) return from === to ? 1 : 0;',
        '    let total = 0;',
        '',
        '    for (let mid = from; mid <= to; mid += 1) {',
        '      const left = ways(rhs[at], from, mid);',
        '',
        '      if (left) total += left * split(rhs, at + 1, mid, to);',
        '    }',
        '    return total;',
        '  }',
        '  return ways(grammar.start, 0, tokens.length);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the ambiguous sum grammar gives 1, 1, 2 and 5 trees',
          assert: function (countTrees, api) {
            const g = { start: 'E', rules: { E: [['E', '+', 'E'], ['a']] } };
            const sum = function (n) {
              const out = ['a'];

              for (let i = 1; i < n; i += 1) { out.push('+'); out.push('a'); }
              return out;
            };

            api.assert.equal(countTrees(g, sum(1)), 1, 'one operand is one tree');
            api.assert.equal(countTrees(g, sum(2)), 1, 'one operator has one placement');
            api.assert.equal(countTrees(g, sum(3)), 2,
              'a + a + a has two trees, not two derivations of one');
            api.assert.equal(countTrees(g, sum(4)), 5, 'the Catalan numbers, not powers of two');
          }
        },
        {
          name: 'an unambiguous grammar gives exactly one, and a rejection gives zero',
          assert: function (countTrees, api) {
            const g = {
              start: 'E',
              rules: { E: [['E', '+', 'T'], ['T']], T: [['T', '*', 'F'], ['F']],
                F: [['(', 'E', ')'], ['a']] }
            };

            api.assert.equal(countTrees(g, ['a', '+', 'a', '*', 'a']), 1,
              'precedence in the grammar shape admits one nesting');
            api.assert.equal(countTrees(g, ['a', '+', 'a', '+', 'a']), 1,
              'left recursion forces left associativity');
            api.assert.equal(countTrees(g, ['a', '+']), 0, 'not in the language');
            api.assert.equal(countTrees(g, []), 0, 'the empty string is not in this language');
          }
        },
        {
          name: 'the dangling else has two trees, and a left-recursive rule does not loop',
          assert: function (countTrees, api) {
            const g = {
              start: 'S',
              rules: { S: [['i', 'E', 't', 'S'], ['i', 'E', 't', 'S', 'e', 'S'], ['x']],
                E: [['b']] }
            };

            api.assert.equal(countTrees(g, ['i', 'b', 't', 'x']), 1, 'one if, no else');
            api.assert.equal(
              countTrees(g, ['i', 'b', 't', 'i', 'b', 't', 'x', 'e', 'x']), 2,
              'the else has two homes');

            const loop = { start: 'A', rules: { A: [['A'], ['a']] } };

            api.assert.equal(countTrees(loop, ['a']), 1,
              'a unit cycle must not loop; the guard drops the infinite family');
          }
        }
      ]
    }],

    'grammar-transformations': [{
      id: 'eliminate-left-recursion',
      title: 'Eliminate left recursion, including the indirect case',
      prompt: 'eliminate(grammar) must return a new grammar in the same shape, with no ' +
        'nonterminal able to reach itself as its own leftmost symbol. `grammar` is ' +
        '{ start, rules } as before, and `order` is the key order of `rules`. Use Paull\'s ' +
        'algorithm: for each nonterminal A(i) in order, substitute every earlier A(j) that ' +
        'appears leftmost in one of A(i)\'s right-hand sides by that A(j)\'s right-hand sides, ' +
        'then eliminate A(i)\'s DIRECT left recursion by splitting it into `A -> β A\'` and ' +
        '`A\' -> α A\' | ε`. Represent ε as an empty array. The starter handles only the direct ' +
        'case, which terminates on the fixtures and loops on a real grammar.',
      entry: 'eliminate',
      starter: [
        'function eliminate(grammar) {',
        '  // Direct recursion only: A -> B x with B -> A y still loops.',
        '  const rules = {};',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    const recursive = [];',
        '    const plain = [];',
        '',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      if (rhs[0] === name) recursive.push(rhs.slice(1)); else plain.push(rhs.slice());',
        '    });',
        '    if (recursive.length === 0) { rules[name] = plain; return; }',
        '    const tail = name + "\'";',
        '',
        '    rules[name] = plain.map(function (rhs) { return rhs.concat([tail]); });',
        '    rules[tail] = recursive.map(function (rhs) { return rhs.concat([tail]); })',
        '      .concat([[]]);',
        '  });',
        '  return { start: grammar.start, rules: rules };',
        '}'
      ].join('\n'),
      solution: [
        'function eliminate(grammar) {',
        '  const order = Object.keys(grammar.rules);',
        '  const rules = {};',
        '',
        '  order.forEach(function (name) { rules[name] = grammar.rules[name].map(copy); });',
        '',
        '  function copy(rhs) { return rhs.slice(); }',
        '',
        '  order.forEach(function (name, i) {',
        '    for (let j = 0; j < i; j += 1) {',
        '      rules[name] = substitute(rules[name], order[j]);',
        '    }',
        '    directly(name);',
        '  });',
        '',
        '  function substitute(bodies, earlier) {',
        '    const out = [];',
        '',
        '    bodies.forEach(function (rhs) {',
        '      if (rhs[0] !== earlier) { out.push(rhs); return; }',
        '      rules[earlier].forEach(function (inner) {',
        '        out.push(inner.concat(rhs.slice(1)));',
        '      });',
        '    });',
        '    return out;',
        '  }',
        '',
        '  function directly(name) {',
        '    const recursive = [];',
        '    const plain = [];',
        '',
        '    rules[name].forEach(function (rhs) {',
        '      if (rhs[0] === name) recursive.push(rhs.slice(1)); else plain.push(rhs);',
        '    });',
        '    if (recursive.length === 0) return;',
        '    let tail = name + "\'";',
        '',
        '    while (rules[tail]) tail += "\'";',
        '    rules[name] = plain.map(function (rhs) { return rhs.concat([tail]); });',
        '    rules[tail] = recursive.map(function (rhs) { return rhs.concat([tail]); })',
        '      .concat([[]]);',
        '  }',
        '  return { start: grammar.start, rules: rules };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the direct case: the language survives and the recursion is gone',
          assert: function (eliminate, api) {
            const g = { start: 'E', rules: { E: [['E', '+', 'T'], ['T']], T: [['a']] } };
            const out = eliminate(g);
            const words = function (grammar, max) {
              const found = {};
              const walk = function (form, depth) {
                if (depth > 14 || form.length > max + 2) return;
                const at = form.findIndex(function (s) { return Boolean(grammar.rules[s]); });

                if (at === -1) { if (form.length <= max) found[form.join(' ')] = true; return; }
                grammar.rules[form[at]].forEach(function (rhs) {
                  walk(form.slice(0, at).concat(rhs).concat(form.slice(at + 1)), depth + 1);
                });
              };

              walk([grammar.start], 0);
              return Object.keys(found).sort();
            };

            api.assert.deepEqual(words(out, 5), words(g, 5),
              'the language must be identical up to length 5');
            const leftmost = function (grammar, name, seen) {
              if (seen.indexOf(name) !== -1) return true;
              return grammar.rules[name].some(function (rhs) {
                if (!rhs.length || !grammar.rules[rhs[0]]) return false;
                return leftmost(grammar, rhs[0], seen.concat([name]));
              });
            };

            Object.keys(out.rules).forEach(function (name) {
              api.assert.ok(!leftmost(out, name, []),
                name + ' can still reach itself as its own leftmost symbol');
            });
          }
        },
        {
          name: 'the indirect case: A -> B x, B -> A y must also terminate',
          assert: function (eliminate, api) {
            const g = {
              start: 'A',
              rules: { A: [['B', 'x'], ['c']], B: [['A', 'y'], ['d']] }
            };
            const out = eliminate(g);
            const leftmost = function (grammar, name, seen) {
              if (seen.indexOf(name) !== -1) return true;
              return grammar.rules[name].some(function (rhs) {
                if (!rhs.length || !grammar.rules[rhs[0]]) return false;
                return leftmost(grammar, rhs[0], seen.concat([name]));
              });
            };

            Object.keys(out.rules).forEach(function (name) {
              api.assert.ok(!leftmost(out, name, []),
                'indirect recursion through ' + name + ' survived — Paull’s ordering is needed');
            });
            api.assert.ok(Object.keys(out.rules).length > Object.keys(g.rules).length,
              'the rewrite introduces at least one tail nonterminal');
          }
        },
        {
          name: 'a grammar with no left recursion is returned with its language intact',
          assert: function (eliminate, api) {
            const g = { start: 'E', rules: { E: [['T', 'R']], R: [['+', 'T', 'R'], []],
              T: [['a']] } };
            const out = eliminate(g);
            const words = function (grammar, max) {
              const found = {};
              const walk = function (form, depth) {
                if (depth > 14 || form.length > max + 2) return;
                const at = form.findIndex(function (s) { return Boolean(grammar.rules[s]); });

                if (at === -1) { if (form.length <= max) found[form.join(' ')] = true; return; }
                grammar.rules[form[at]].forEach(function (rhs) {
                  walk(form.slice(0, at).concat(rhs).concat(form.slice(at + 1)), depth + 1);
                });
              };

              walk([grammar.start], 0);
              return Object.keys(found).sort();
            };

            api.assert.deepEqual(words(out, 5), words(g, 5),
              'nothing to eliminate, so the language must be untouched');
          }
        }
      ]
    }],

    'pushdown-automata': [{
      id: 'cfg-to-pda',
      title: 'Build the CFG to PDA construction, and run it',
      prompt: 'toPda(grammar) must return { transitions } for the standard construction: one ' +
        'EXPAND transition per production — { read: "", pop: A, push: rhs } — and one MATCH ' +
        'transition per terminal — { read: a, pop: a, push: [] }. `grammar` is { start, rules } ' +
        'as before. A terminal is any symbol appearing in some right-hand side that is not a key ' +
        'of `rules`. Then accepts(grammar, tokens) must run the machine from the stack [start] ' +
        'and return whether the whole input is consumed with the stack empty — searching ' +
        'breadth-first over configurations, deduplicating on (stack, position), and returning ' +
        'false once a step cap is reached. The starter follows only the first applicable ' +
        'transition, which is a depth-first walk that commits to one guess.',
      entry: 'accepts',
      starter: [
        'function toPda(grammar) {',
        '  const transitions = [];',
        '  const terminals = {};',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      transitions.push({ read: "", pop: name, push: rhs.slice() });',
        '      rhs.forEach(function (s) { if (!grammar.rules[s]) terminals[s] = true; });',
        '    });',
        '  });',
        '  Object.keys(terminals).forEach(function (a) {',
        '    transitions.push({ read: a, pop: a, push: [] });',
        '  });',
        '  return { transitions: transitions };',
        '}',
        '',
        'function accepts(grammar, tokens) {',
        '  // Commits to the first applicable transition, so it reports false rejections.',
        '  const machine = toPda(grammar);',
        '  let stack = [grammar.start];',
        '  let at = 0;',
        '',
        '  for (let step = 0; step < 500; step += 1) {',
        '    if (stack.length === 0) return at === tokens.length;',
        '    const top = stack[stack.length - 1];',
        '    const edge = machine.transitions.filter(function (e) {',
        '      return e.pop === top && (e.read === "" || e.read === tokens[at]);',
        '    })[0];',
        '',
        '    if (!edge) return false;',
        '    stack = stack.slice(0, -1).concat(edge.push.slice().reverse());',
        '    if (edge.read !== "") at += 1;',
        '  }',
        '  return false;',
        '}'
      ].join('\n'),
      solution: [
        'function toPda(grammar) {',
        '  const transitions = [];',
        '  const terminals = {};',
        '',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      transitions.push({ read: "", pop: name, push: rhs.slice() });',
        '      rhs.forEach(function (s) { if (!grammar.rules[s]) terminals[s] = true; });',
        '    });',
        '  });',
        '  Object.keys(terminals).forEach(function (a) {',
        '    transitions.push({ read: a, pop: a, push: [] });',
        '  });',
        '  return { transitions: transitions };',
        '}',
        '',
        'function accepts(grammar, tokens) {',
        '  const machine = toPda(grammar);',
        '  const seen = {};',
        '  const queue = [{ stack: [grammar.start], at: 0 }];',
        '  let steps = 0;',
        '',
        '  seen[grammar.start + "|0"] = true;',
        '  while (queue.length && steps < 20000) {',
        '    const current = queue.shift();',
        '',
        '    steps += 1;',
        '    if (current.stack.length === 0) {',
        '      if (current.at === tokens.length) return true;',
        '      continue;',
        '    }',
        '    const top = current.stack[current.stack.length - 1];',
        '',
        '    machine.transitions.forEach(function (edge) {',
        '      if (edge.pop !== top) return;',
        '      if (edge.read !== "" && edge.read !== tokens[current.at]) return;',
        '      if (edge.read !== "" && current.at >= tokens.length) return;',
        '      const stack = current.stack.slice(0, -1)',
        '        .concat(edge.push.slice().reverse());',
        '',
        '      if (stack.length > 40) return;',
        '      const next = { stack: stack, at: current.at + (edge.read === "" ? 0 : 1) };',
        '      const key = stack.join(",") + "|" + next.at;',
        '',
        '      if (seen[key]) return;',
        '      seen[key] = true;',
        '      queue.push(next);',
        '    });',
        '  }',
        '  return false;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the machine has one expand per production and one match per terminal',
          assert: function (accepts, api) {
            api.assert.ok(typeof accepts === 'function');
            const g = { start: 'S', rules: { S: [['(', 'S', ')', 'S'], []] } };

            api.assert.ok(accepts(g, []), 'the empty string is balanced');
            api.assert.ok(accepts(g, ['(', ')']), '() is balanced');
            api.assert.ok(accepts(g, ['(', '(', ')', ')']), '(()) is balanced');
            api.assert.ok(accepts(g, ['(', ')', '(', ')']), '()() is balanced');
          }
        },
        {
          name: 'it rejects exactly what the grammar does, over every short string',
          assert: function (accepts, api) {
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
                api.assert.equal(accepts(g, tokens), balanced(tokens),
                  'disagreement on "' + tokens.join('') + '"');
              }
            }
            api.assert.ok(checked >= 127, 'expected at least 127 inputs, got ' + checked);
          }
        },
        {
          name: 'a grammar needing a guess is not rejected by committing to the first move',
          assert: function (accepts, api) {
            const g = { start: 'S', rules: { S: [['a', 'S', 'b'], ['a', 'a']] } };

            api.assert.ok(accepts(g, ['a', 'a']), 'the second alternative alone');
            api.assert.ok(accepts(g, ['a', 'a', 'a', 'b']),
              'the first alternative wrapping the second — a depth-first walk gets this wrong');
            api.assert.ok(accepts(g, ['a', 'a', 'a', 'a', 'b', 'b']), 'two levels of nesting');
            api.assert.ok(!accepts(g, ['a', 'b']), 'not derivable');
          }
        }
      ]
    }],

    'top-down-parsing-and-ll1': [{
      id: 'first-follow-table',
      title: 'Compute FIRST and FOLLOW, and build the LL(1) table',
      prompt: 'buildTable(grammar) must return { cells, conflicts }. `grammar` is ' +
        '{ start, rules } as before, with ε written as an empty right-hand side. `cells` maps ' +
        'a nonterminal to a map from terminal to the right-hand side chosen, using "$" for end ' +
        'of input. Enter `A -> α` in cell (A, a) for every terminal a in FIRST(α); if α is ' +
        'nullable, also enter it for every a in FOLLOW(A). Push { nonterminal, terminal } into ' +
        '`conflicts` when a cell would receive a SECOND, different right-hand side, and leave ' +
        'the first one in place. FIRST and FOLLOW both need a fixed point. The starter never ' +
        'consults FOLLOW, so a nullable right-hand side gets no cell at all.',
      entry: 'buildTable',
      starter: [
        'function buildTable(grammar) {',
        '  // FIRST only: R -> eps never reaches the table, so the parser cannot finish.',
        '  const cells = {};',
        '  const conflicts = [];',
        '  const nullable = {};',
        '  const first = {};',
        '',
        '  Object.keys(grammar.rules).forEach(function (n) { first[n] = {}; cells[n] = {}; });',
        '  for (let round = 0; round < 20; round += 1) {',
        '    Object.keys(grammar.rules).forEach(function (name) {',
        '      grammar.rules[name].forEach(function (rhs) {',
        '        if (rhs.length === 0) { nullable[name] = true; return; }',
        '        for (let i = 0; i < rhs.length; i += 1) {',
        '          const s = rhs[i];',
        '',
        '          if (!grammar.rules[s]) { first[name][s] = true; return; }',
        '          Object.keys(first[s]).forEach(function (t) { first[name][t] = true; });',
        '          if (!nullable[s]) return;',
        '        }',
        '      });',
        '    });',
        '  }',
        '  Object.keys(grammar.rules).forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      if (rhs.length === 0) return;',
        '      const head = grammar.rules[rhs[0]] ? first[rhs[0]] : { [rhs[0]]: true };',
        '',
        '      Object.keys(head).forEach(function (t) {',
        '        if (cells[name][t]) { conflicts.push({ nonterminal: name, terminal: t }); return; }',
        '        cells[name][t] = rhs;',
        '      });',
        '    });',
        '  });',
        '  return { cells: cells, conflicts: conflicts };',
        '}'
      ].join('\n'),
      solution: [
        'function buildTable(grammar) {',
        '  const names = Object.keys(grammar.rules);',
        '  const nullable = {};',
        '  const first = {};',
        '  const follow = {};',
        '  const cells = {};',
        '  const conflicts = [];',
        '',
        '  names.forEach(function (n) { first[n] = {}; follow[n] = {}; cells[n] = {}; });',
        '  follow[grammar.start].$ = true;',
        '',
        '  function isNonterminal(s) { return Boolean(grammar.rules[s]); }',
        '',
        '  function firstOf(sequence) {',
        '    const set = {};',
        '',
        '    for (let i = 0; i < sequence.length; i += 1) {',
        '      const s = sequence[i];',
        '',
        '      if (!isNonterminal(s)) { set[s] = true; return { set: set, nullable: false }; }',
        '      Object.keys(first[s]).forEach(function (t) { set[t] = true; });',
        '      if (!nullable[s]) return { set: set, nullable: false };',
        '    }',
        '    return { set: set, nullable: true };',
        '  }',
        '',
        '  for (let round = 0; round < 40; round += 1) {',
        '    names.forEach(function (name) {',
        '      grammar.rules[name].forEach(function (rhs) {',
        '        const head = firstOf(rhs);',
        '',
        '        Object.keys(head.set).forEach(function (t) { first[name][t] = true; });',
        '        if (head.nullable) nullable[name] = true;',
        '      });',
        '    });',
        '  }',
        '  for (let round = 0; round < 40; round += 1) {',
        '    names.forEach(function (name) {',
        '      grammar.rules[name].forEach(function (rhs) {',
        '        for (let i = 0; i < rhs.length; i += 1) {',
        '          if (!isNonterminal(rhs[i])) continue;',
        '          const rest = firstOf(rhs.slice(i + 1));',
        '',
        '          Object.keys(rest.set).forEach(function (t) { follow[rhs[i]][t] = true; });',
        '          if (!rest.nullable) continue;',
        '          Object.keys(follow[name]).forEach(function (t) { follow[rhs[i]][t] = true; });',
        '        }',
        '      });',
        '    });',
        '  }',
        '  names.forEach(function (name) {',
        '    grammar.rules[name].forEach(function (rhs) {',
        '      const head = firstOf(rhs);',
        '      const targets = Object.keys(head.set);',
        '',
        '      if (head.nullable) {',
        '        Object.keys(follow[name]).forEach(function (t) {',
        '          if (targets.indexOf(t) === -1) targets.push(t);',
        '        });',
        '      }',
        '      targets.forEach(function (t) {',
        '        if (cells[name][t] && cells[name][t].join(" ") !== rhs.join(" ")) {',
        '          conflicts.push({ nonterminal: name, terminal: t });',
        '          return;',
        '        }',
        '        cells[name][t] = rhs;',
        '      });',
        '    });',
        '  });',
        '  return { cells: cells, conflicts: conflicts };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the LL(1) grammar builds a conflict-free table, with FOLLOW filling the eps cell',
          assert: function (buildTable, api) {
            const g = { start: 'E', rules: { E: [['T', 'R']], R: [['+', 'T', 'R'], []],
              T: [['a']] } };
            const built = buildTable(g);

            api.assert.equal(built.conflicts.length, 0, 'this grammar is LL(1)');
            api.assert.deepEqual(built.cells.E.a, ['T', 'R']);
            api.assert.deepEqual(built.cells.R['+'], ['+', 'T', 'R']);
            api.assert.deepEqual(built.cells.R.$, [],
              'R -> eps must reach the $ cell via FOLLOW(R)');
            api.assert.deepEqual(built.cells.T.a, ['a']);
          }
        },
        {
          name: 'left recursion and a shared prefix each produce exactly one conflict',
          assert: function (buildTable, api) {
            const left = { start: 'E', rules: { E: [['E', '+', 'T'], ['T']], T: [['a']] } };
            const one = buildTable(left);

            api.assert.equal(one.conflicts.length, 1,
              'E on "a" wants both E + T and T — got ' + one.conflicts.length);
            api.assert.equal(one.conflicts[0].nonterminal, 'E');
            api.assert.equal(one.conflicts[0].terminal, 'a');

            const shared = {
              start: 'S',
              rules: { S: [['i', 'E', 't', 'S'], ['i', 'E', 't', 'S', 'e', 'S'], ['x']],
                E: [['b']] }
            };
            const two = buildTable(shared);

            api.assert.equal(two.conflicts.length, 1, 'S on "i" is the only conflict');
            api.assert.equal(two.conflicts[0].terminal, 'i');
          }
        },
        {
          name: 'FOLLOW propagates through a nullable tail',
          assert: function (buildTable, api) {
            const g = {
              start: 'S',
              rules: { S: [['A', 'B', 'c']], A: [['a'], []], B: [['b'], []] }
            };
            const built = buildTable(g);

            api.assert.equal(built.conflicts.length, 0, 'this grammar is LL(1)');
            api.assert.deepEqual(built.cells.A.a, ['a']);
            api.assert.deepEqual(built.cells.A.b, [],
              'A -> eps must be reachable on "b", which follows A through nullable B');
            api.assert.deepEqual(built.cells.A.c, [],
              'and on "c", which follows A when B is empty too');
            api.assert.deepEqual(built.cells.B.c, [], 'B -> eps on the terminal that follows B');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
