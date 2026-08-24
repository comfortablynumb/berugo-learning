/**
 * Graded exercises for languages, DFAs, NFAs and regexes (M24.1-M24.4).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'languages-and-the-hierarchy': [{
      id: 'classify-by-memory',
      title: 'Classify ten languages by the weakest machine that recognises them',
      prompt: 'classify(id) must return { klass, needs } for each of ten languages, where ' +
        '`klass` is "regular", "context-free", "context-sensitive" or "undecidable" and `needs` ' +
        'names what the recogniser must remember. The ten ids and their answers: "even-a", ' +
        '"ends-abb", "div3", "no-aaa" and "starts-a" are regular and need "a bounded amount"; ' +
        '"anbn", "palindrome" and "balanced" are context-free and need "one unbounded count"; ' +
        '"anbncn" is context-sensitive and needs "two unbounded counts"; "halting" is ' +
        'undecidable and needs "nothing that exists". The starter calls everything regular, ' +
        'which is the mistake the section is about.',
      entry: 'classify',
      starter: [
        'function classify(id) {',
        '  // Everything is regular, which is what people assume until it bites.',
        '  return { klass: \'regular\', needs: \'a bounded amount\' };',
        '}'
      ].join('\n'),
      solution: [
        'function classify(id) {',
        '  const regular = [\'even-a\', \'ends-abb\', \'div3\', \'no-aaa\', \'starts-a\'];',
        '  const contextFree = [\'anbn\', \'palindrome\', \'balanced\'];',
        '',
        '  if (regular.indexOf(id) !== -1) {',
        '    return { klass: \'regular\', needs: \'a bounded amount\' };',
        '  }',
        '  if (contextFree.indexOf(id) !== -1) {',
        '    return { klass: \'context-free\', needs: \'one unbounded count\' };',
        '  }',
        '  if (id === \'anbncn\') {',
        '    return { klass: \'context-sensitive\', needs: \'two unbounded counts\' };',
        '  }',
        '  if (id === \'halting\') {',
        '    return { klass: \'undecidable\', needs: \'nothing that exists\' };',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the near-miss pair lands on different levels',
          assert: function (classify, api) {
            api.assert.equal(classify('ends-abb').klass, 'regular',
              'a suffix test needs a bounded amount of memory');
            api.assert.equal(classify('anbn').klass, 'context-free',
              'equal run lengths need an unbounded count');
            api.assert.notEqual(classify('ends-abb').klass, classify('anbn').klass,
              'these two must not collapse to one answer');
          }
        },
        {
          name: 'one stack is not two, and undecidable is its own category',
          assert: function (classify, api) {
            api.assert.equal(classify('anbncn').klass, 'context-sensitive',
              'two pairs of counts need more than one stack');
            api.assert.equal(classify('anbncn').needs, 'two unbounded counts');
            api.assert.equal(classify('halting').klass, 'undecidable',
              'no machine of any size decides this');
            api.assert.equal(classify('halting').needs, 'nothing that exists');
          }
        },
        {
          name: 'all ten are answered, and the levels are used',
          assert: function (classify, api) {
            const ids = ['even-a', 'ends-abb', 'div3', 'no-aaa', 'starts-a', 'anbn',
              'palindrome', 'balanced', 'anbncn', 'halting'];
            const counts = {};

            ids.forEach(function (id) {
              const row = classify(id);

              api.assert.ok(row && row.klass && row.needs, id + ' must be classified');
              counts[row.klass] = (counts[row.klass] || 0) + 1;
            });
            api.assert.equal(counts.regular, 5, 'five regular languages');
            api.assert.equal(counts['context-free'], 3, 'three context-free');
            api.assert.equal(counts['context-sensitive'], 1, 'one context-sensitive');
            api.assert.equal(counts.undecidable, 1, 'one undecidable');
          }
        }
      ]
    }],

    'deterministic-finite-automata': [{
      id: 'divisible-by-seven',
      title: 'Build a DFA for binary numerals divisible by seven',
      prompt: 'divisibleBy(k) must return { states, start, accepting, delta } for a DFA over ' +
        '{"0", "1"} accepting binary numerals divisible by k, with the empty numeral read as ' +
        'zero. `states` is an array of names, `delta[state][symbol]` is the destination name, ' +
        'and the machine must have exactly k states — one per remainder. Reading a numeral left ' +
        'to right doubles the value and adds the bit, so the remainder transforms as ' +
        'r → (2r + b) mod k. The starter returns a two-state machine that only tracks parity.',
      entry: 'divisibleBy',
      starter: [
        'function divisibleBy(k) {',
        '  // Parity only: correct for k = 2 and wrong for everything else.',
        '  return {',
        '    states: [\'r0\', \'r1\'],',
        '    start: \'r0\',',
        '    accepting: [\'r0\'],',
        '    delta: { r0: { 0: \'r0\', 1: \'r1\' }, r1: { 0: \'r0\', 1: \'r1\' } }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function divisibleBy(k) {',
        '  const states = [];',
        '  const delta = {};',
        '',
        '  for (let r = 0; r < k; r += 1) {',
        '    states.push(\'r\' + r);',
        '    delta[\'r\' + r] = {',
        '      0: \'r\' + ((2 * r) % k),',
        '      1: \'r\' + ((2 * r + 1) % k)',
        '    };',
        '  }',
        '  return { states: states, start: \'r0\', accepting: [\'r0\'], delta: delta };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'divisibility by 7 agrees with arithmetic on every string up to length 12',
          assert: function (divisibleBy, api) {
            const machine = divisibleBy(7);

            api.assert.equal(machine.states.length, 7, 'one state per remainder');

            const run = function (word) {
              let state = machine.start;

              for (let i = 0; i < word.length; i += 1) {
                state = machine.delta[state][word[i]];
              }
              return machine.accepting.indexOf(state) !== -1;
            };
            let words = [''];
            let checked = 0;

            for (let length = 0; length <= 12; length += 1) {
              const next = [];

              words.forEach(function (word) {
                let value = 0;

                word.split('').forEach(function (bit) { value = value * 2 + Number(bit); });
                api.assert.equal(run(word), value % 7 === 0,
                  '"' + word + '" is ' + value + ', which is ' +
                  (value % 7 === 0 ? '' : 'not ') + 'divisible by 7');
                checked += 1;
                next.push(word + '0');
                next.push(word + '1');
              });
              words = next;
            }
            api.assert.atLeast(checked, 8191, 'every string up to length 12 must be checked');
          }
        },
        {
          name: 'it works for other divisors too, including 3 and 5',
          assert: function (divisibleBy, api) {
            [2, 3, 5, 11].forEach(function (k) {
              const machine = divisibleBy(k);

              api.assert.equal(machine.states.length, k, k + ' needs exactly ' + k + ' states');
              const run = function (word) {
                let state = machine.start;

                for (let i = 0; i < word.length; i += 1) state = machine.delta[state][word[i]];
                return machine.accepting.indexOf(state) !== -1;
              };

              for (let n = 0; n < 200; n += 1) {
                api.assert.equal(run(n.toString(2)), n % k === 0,
                  n + ' modulo ' + k);
              }
            });
          }
        },
        {
          name: 'the transition function is total, and the empty numeral is zero',
          assert: function (divisibleBy, api) {
            const machine = divisibleBy(7);

            machine.states.forEach(function (state) {
              ['0', '1'].forEach(function (symbol) {
                api.assert.ok(machine.delta[state][symbol] !== undefined,
                  state + ' must have a destination on ' + symbol);
                api.assert.ok(machine.states.indexOf(machine.delta[state][symbol]) !== -1,
                  'and it must be a state of the machine');
              });
            });
            api.assert.ok(machine.accepting.indexOf(machine.start) !== -1,
              'the empty numeral reads as zero, so the start state accepts');
          }
        }
      ]
    }],

    'nondeterminism-and-subsets': [{
      id: 'subset-construction',
      title: 'Implement ε-closure and the subset construction',
      prompt: 'determinise(nfa) must return a DFA accepting the same language. The NFA is ' +
        '{ states, alphabet, start, accepting, delta } where `delta[state][symbol]` is an ARRAY ' +
        'of destinations and the empty string "" is the ε symbol. Name each DFA state by joining ' +
        'its sorted members with commas inside braces — "{q0,q1}", and "{}" for the empty set. ' +
        'A DFA state is accepting when its set contains an accepting NFA state. The starter ' +
        'ignores ε-transitions entirely, which is the usual first bug.',
      entry: 'determinise',
      opsLimit: 4000000,
      starter: [
        'function determinise(nfa) {',
        '  // No epsilon closure at all: every machine with an epsilon edge comes out wrong.',
        '  function name(set) { return \'{\' + set.slice().sort().join(\',\') + \'}\'; }',
        '  function move(set, symbol) {',
        '    const seen = {};',
        '',
        '    set.forEach(function (state) {',
        '      ((nfa.delta[state] || {})[symbol] || []).forEach(function (n) { seen[n] = true; });',
        '    });',
        '    return Object.keys(seen).sort();',
        '  }',
        '  const start = nfa.start.slice().sort();',
        '  const order = [start];',
        '  const seen = {};',
        '  const delta = {};',
        '',
        '  seen[name(start)] = true;',
        '  for (let i = 0; i < order.length; i += 1) {',
        '    const current = order[i];',
        '',
        '    delta[name(current)] = {};',
        '    nfa.alphabet.forEach(function (symbol) {',
        '      const next = move(current, symbol);',
        '',
        '      if (!seen[name(next)]) { seen[name(next)] = true; order.push(next); }',
        '      delta[name(current)][symbol] = name(next);',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(name), alphabet: nfa.alphabet.slice(), start: name(start),',
        '    accepting: order.filter(function (set) {',
        '      return set.some(function (s) { return nfa.accepting.indexOf(s) !== -1; });',
        '    }).map(name),',
        '    delta: delta',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function determinise(nfa) {',
        '  function name(set) { return \'{\' + set.slice().sort().join(\',\') + \'}\'; }',
        '  function closure(set) {',
        '    const seen = {};',
        '    const stack = set.slice();',
        '',
        '    set.forEach(function (state) { seen[state] = true; });',
        '    while (stack.length) {',
        '      const state = stack.pop();',
        '',
        '      ((nfa.delta[state] || {})[\'\'] || []).forEach(function (next) {',
        '        if (seen[next]) return;',
        '        seen[next] = true;',
        '        stack.push(next);',
        '      });',
        '    }',
        '    return Object.keys(seen).sort();',
        '  }',
        '  function step(set, symbol) {',
        '    const seen = {};',
        '',
        '    set.forEach(function (state) {',
        '      ((nfa.delta[state] || {})[symbol] || []).forEach(function (n) { seen[n] = true; });',
        '    });',
        '    return closure(Object.keys(seen).sort());',
        '  }',
        '  const start = closure(nfa.start);',
        '  const order = [start];',
        '  const seen = {};',
        '  const delta = {};',
        '',
        '  seen[name(start)] = true;',
        '  for (let i = 0; i < order.length; i += 1) {',
        '    const current = order[i];',
        '',
        '    delta[name(current)] = {};',
        '    nfa.alphabet.forEach(function (symbol) {',
        '      const next = step(current, symbol);',
        '',
        '      if (!seen[name(next)]) { seen[name(next)] = true; order.push(next); }',
        '      delta[name(current)][symbol] = name(next);',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(name), alphabet: nfa.alphabet.slice(), start: name(start),',
        '    accepting: order.filter(function (set) {',
        '      return set.some(function (s) { return nfa.accepting.indexOf(s) !== -1; });',
        '    }).map(name),',
        '    delta: delta',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an ε-free NFA determinises correctly',
          assert: function (determinise, api) {
            const nfa = { states: ['q0', 'q1', 'q2', 'q3'], alphabet: ['a', 'b'],
              start: ['q0'], accepting: ['q3'],
              delta: { q0: { a: ['q0', 'q1'], b: ['q0'] }, q1: { b: ['q2'] },
                q2: { b: ['q3'] }, q3: {} } };
            const dfa = determinise(nfa);
            const runDfa = function (word) {
              let state = dfa.start;

              for (let i = 0; i < word.length; i += 1) state = dfa.delta[state][word[i]];
              return dfa.accepting.indexOf(state) !== -1;
            };

            let words = [''];

            for (let length = 0; length <= 8; length += 1) {
              const next = [];

              words.forEach(function (word) {
                api.assert.equal(runDfa(word), word.slice(-3) === 'abb',
                  '"' + word + '" ends in abb: ' + (word.slice(-3) === 'abb'));
                next.push(word + 'a');
                next.push(word + 'b');
              });
              words = next;
            }
          }
        },
        {
          name: 'ε-transitions are followed, before and after every move',
          assert: function (determinise, api) {
            /* a*b*, written with epsilon edges so that ignoring them is wrong. */
            const nfa = { states: ['s', 'a', 'b'], alphabet: ['a', 'b'],
              start: ['s'], accepting: ['b'],
              delta: { s: { '': ['a'] }, a: { a: ['a'], '': ['b'] }, b: { b: ['b'] } } };
            const dfa = determinise(nfa);
            const runDfa = function (word) {
              let state = dfa.start;

              for (let i = 0; i < word.length; i += 1) state = dfa.delta[state][word[i]];
              return dfa.accepting.indexOf(state) !== -1;
            };

            api.assert.equal(runDfa(''), true, 'the empty string is in a*b*');
            api.assert.equal(runDfa('aaa'), true, 'and so is a run of a');
            api.assert.equal(runDfa('bbb'), true, 'and a run of b');
            api.assert.equal(runDfa('aabb'), true, 'and a run of each');
            api.assert.equal(runDfa('ba'), false, 'but not b before a');
            api.assert.equal(runDfa('aba'), false, 'nor a return to a');
          }
        },
        {
          name: 'the result is deterministic and total',
          assert: function (determinise, api) {
            const nfa = { states: ['q0', 'q1'], alphabet: ['a', 'b'], start: ['q0'],
              accepting: ['q1'], delta: { q0: { a: ['q0', 'q1'] }, q1: {} } };
            const dfa = determinise(nfa);

            dfa.states.forEach(function (state) {
              dfa.alphabet.forEach(function (symbol) {
                const target = dfa.delta[state][symbol];

                api.assert.ok(typeof target === 'string',
                  state + ' on ' + symbol + ' must go to exactly one state');
                api.assert.ok(dfa.states.indexOf(target) !== -1,
                  'and that state must be in the machine: ' + target);
              });
            });
            api.assert.ok(dfa.states.indexOf('{}') !== -1,
              'the empty set is reachable here and must be a real state');
          }
        }
      ]
    }],

    'regular-expressions-and-constructions': [{
      id: 'brzozowski-derivatives',
      title: 'Build a DFA from derivatives, with the rules that make it terminate',
      prompt: 'derivativeDfa(tree, alphabet) must return { states, start, accepting, delta } ' +
        'where every state is the printed form of a derivative. A tree node is one of ' +
        '{ type: "empty" }, { type: "none" }, { type: "literal", symbol }, ' +
        '{ type: "alt", left, right }, { type: "concat", left, right } or ' +
        '{ type: "star", child }. Take derivatives until the set stops growing, SIMPLIFYING each ' +
        'one first — flatten and sort alternations, drop duplicates and ∅ branches, and apply ' +
        'the ε and ∅ identities for concatenation — or the set never closes. A state is ' +
        'accepting when its derivative matches the empty string. The starter omits the ' +
        'simplification and hits the state cap.',
      entry: 'derivativeDfa',
      opsLimit: 6000000,
      starterFailure: 'assert',
      starter: [
        'function derivativeDfa(tree, alphabet) {',
        '  // No simplification: the derivative set grows forever and this bails out early.',
        '  function nullable(n) {',
        '    if (n.type === \'empty\' || n.type === \'star\') return true;',
        '    if (n.type === \'none\' || n.type === \'literal\') return false;',
        '    if (n.type === \'alt\') return nullable(n.left) || nullable(n.right);',
        '    return nullable(n.left) && nullable(n.right);',
        '  }',
        '  function show(n) {',
        '    if (n.type === \'none\') return \'0\';',
        '    if (n.type === \'empty\') return \'e\';',
        '    if (n.type === \'literal\') return n.symbol;',
        '    if (n.type === \'star\') return \'(\' + show(n.child) + \')*\';',
        '    if (n.type === \'alt\') return \'(\' + show(n.left) + \'|\' + show(n.right) + \')\';',
        '    return \'(\' + show(n.left) + show(n.right) + \')\';',
        '  }',
        '  function derive(n, s) {',
        '    if (n.type === \'empty\' || n.type === \'none\') return { type: \'none\' };',
        '    if (n.type === \'literal\') {',
        '      return n.symbol === s ? { type: \'empty\' } : { type: \'none\' };',
        '    }',
        '    if (n.type === \'alt\') {',
        '      return { type: \'alt\', left: derive(n.left, s), right: derive(n.right, s) };',
        '    }',
        '    if (n.type === \'star\') {',
        '      return { type: \'concat\', left: derive(n.child, s), right: n };',
        '    }',
        '    const head = { type: \'concat\', left: derive(n.left, s), right: n.right };',
        '',
        '    if (!nullable(n.left)) return head;',
        '    return { type: \'alt\', left: head, right: derive(n.right, s) };',
        '  }',
        '  const order = [tree];',
        '  const seen = { };',
        '  const delta = {};',
        '',
        '  seen[show(tree)] = true;',
        '  // The guard is on the ITERATION count, not the state count: without',
        '  // simplification each derivative tree is about twice the size of the last,',
        '  // so twenty rounds is already millions of nodes.',
        '  for (let i = 0; i < order.length && i < 12; i += 1) {',
        '    const node = order[i];',
        '',
        '    delta[show(node)] = {};',
        '    alphabet.forEach(function (symbol) {',
        '      const next = derive(node, symbol);',
        '',
        '      if (!seen[show(next)]) { seen[show(next)] = true; order.push(next); }',
        '      delta[show(node)][symbol] = show(next);',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(show), start: show(tree),',
        '    accepting: order.filter(nullable).map(show), delta: delta',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function derivativeDfa(tree, alphabet) {',
        '  const NONE = { type: \'none\' };',
        '  const EMPTY = { type: \'empty\' };',
        '',
        '  function nullable(n) {',
        '    if (n.type === \'empty\' || n.type === \'star\') return true;',
        '    if (n.type === \'none\' || n.type === \'literal\') return false;',
        '    if (n.type === \'alt\') return nullable(n.left) || nullable(n.right);',
        '    return nullable(n.left) && nullable(n.right);',
        '  }',
        '  function show(n) {',
        '    if (n.type === \'none\') return \'0\';',
        '    if (n.type === \'empty\') return \'e\';',
        '    if (n.type === \'literal\') return n.symbol;',
        '    if (n.type === \'star\') return \'(\' + show(n.child) + \')*\';',
        '    if (n.type === \'alt\') return \'(\' + show(n.left) + \'|\' + show(n.right) + \')\';',
        '    return \'(\' + show(n.left) + show(n.right) + \')\';',
        '  }',
        '  function flatten(n, out) {',
        '    if (n.type !== \'alt\') { out.push(n); return; }',
        '    flatten(n.left, out);',
        '    flatten(n.right, out);',
        '  }',
        '  function simplify(n) {',
        '    if (n.type === \'literal\' || n.type === \'empty\' || n.type === \'none\') return n;',
        '    if (n.type === \'star\') {',
        '      const child = simplify(n.child);',
        '',
        '      if (child.type === \'none\' || child.type === \'empty\') return EMPTY;',
        '      if (child.type === \'star\') return child;',
        '      return { type: \'star\', child: child };',
        '    }',
        '    if (n.type === \'concat\') {',
        '      const left = simplify(n.left);',
        '      const right = simplify(n.right);',
        '',
        '      if (left.type === \'none\' || right.type === \'none\') return NONE;',
        '      if (left.type === \'empty\') return right;',
        '      if (right.type === \'empty\') return left;',
        '      return { type: \'concat\', left: left, right: right };',
        '    }',
        '    const parts = [];',
        '',
        '    flatten(simplify(n.left), parts);',
        '    flatten(simplify(n.right), parts);',
        '    const kept = [];',
        '    const seen = {};',
        '',
        '    parts.forEach(function (part) {',
        '      const key = show(part);',
        '',
        '      if (part.type === \'none\' || seen[key]) return;',
        '      seen[key] = true;',
        '      kept.push(part);',
        '    });',
        '    if (kept.length === 0) return NONE;',
        '    kept.sort(function (a, b) { return show(a) < show(b) ? -1 : 1; });',
        '    return kept.reduce(function (l, r) { return { type: \'alt\', left: l, right: r }; });',
        '  }',
        '  function derive(n, s) {',
        '    if (n.type === \'empty\' || n.type === \'none\') return NONE;',
        '    if (n.type === \'literal\') return n.symbol === s ? EMPTY : NONE;',
        '    if (n.type === \'alt\') {',
        '      return { type: \'alt\', left: derive(n.left, s), right: derive(n.right, s) };',
        '    }',
        '    if (n.type === \'star\') {',
        '      return { type: \'concat\', left: derive(n.child, s), right: n };',
        '    }',
        '    const head = { type: \'concat\', left: derive(n.left, s), right: n.right };',
        '',
        '    if (!nullable(n.left)) return head;',
        '    return { type: \'alt\', left: head, right: derive(n.right, s) };',
        '  }',
        '  const start = simplify(tree);',
        '  const order = [start];',
        '  const seen = {};',
        '  const delta = {};',
        '',
        '  seen[show(start)] = true;',
        '  for (let i = 0; i < order.length && order.length < 400; i += 1) {',
        '    const node = order[i];',
        '',
        '    delta[show(node)] = {};',
        '    alphabet.forEach(function (symbol) {',
        '      const next = simplify(derive(node, symbol));',
        '',
        '      if (!seen[show(next)]) { seen[show(next)] = true; order.push(next); }',
        '      delta[show(node)][symbol] = show(next);',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(show), start: show(start),',
        '    accepting: order.filter(nullable).map(show), delta: delta',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it closes on a small set for a starred pattern',
          assert: function (derivativeDfa, api) {
            /* a* — without the similarity rules the derivatives grow forever. */
            const tree = { type: 'star', child: { type: 'literal', symbol: 'a' } };
            const dfa = derivativeDfa(tree, ['a', 'b']);

            api.assert.atMost(dfa.states.length, 4,
              'a* has very few distinct derivatives once they are simplified, not ' +
              dfa.states.length);
            api.assert.ok(dfa.accepting.indexOf(dfa.start) !== -1,
              'a* matches the empty string, so the start state accepts');
          }
        },
        {
          name: 'the machine accepts exactly (a|b)*abb',
          assert: function (derivativeDfa, api) {
            const a = { type: 'literal', symbol: 'a' };
            const b = { type: 'literal', symbol: 'b' };
            const anyStar = { type: 'star', child: { type: 'alt', left: a, right: b } };
            const tree = { type: 'concat', left: anyStar,
              right: { type: 'concat', left: a, right: { type: 'concat', left: b, right: b } } };
            const dfa = derivativeDfa(tree, ['a', 'b']);
            const run = function (word) {
              let state = dfa.start;

              for (let i = 0; i < word.length; i += 1) {
                state = dfa.delta[state][word[i]];
                if (state === undefined) return false;
              }
              return dfa.accepting.indexOf(state) !== -1;
            };
            let words = [''];

            for (let length = 0; length <= 9; length += 1) {
              const next = [];

              words.forEach(function (word) {
                api.assert.equal(run(word), word.slice(-3) === 'abb',
                  '"' + word + '"');
                next.push(word + 'a');
                next.push(word + 'b');
              });
              words = next;
            }
          }
        },
        {
          name: 'a nullable star inside a star still terminates',
          assert: function (derivativeDfa, api) {
            /* (a*)* — the pattern whose derivatives diverge without simplification. */
            const inner = { type: 'star', child: { type: 'literal', symbol: 'a' } };
            const tree = { type: 'star', child: inner };
            const dfa = derivativeDfa(tree, ['a', 'b']);

            api.assert.atMost(dfa.states.length, 6,
              '(a*)* must close on a handful of states, not ' + dfa.states.length);

            const run = function (word) {
              let state = dfa.start;

              for (let i = 0; i < word.length; i += 1) {
                state = dfa.delta[state][word[i]];
                if (state === undefined) return false;
              }
              return dfa.accepting.indexOf(state) !== -1;
            };

            api.assert.equal(run(''), true, '(a*)* matches the empty string');
            api.assert.equal(run('aaaa'), true, 'and any run of a');
            api.assert.equal(run('b'), false, 'and nothing containing b');
            api.assert.equal(run('aab'), false, 'not even with a prefix of a');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
