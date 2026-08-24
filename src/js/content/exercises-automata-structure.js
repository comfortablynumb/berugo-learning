/**
 * Graded exercises for minimisation, closure, non-regularity and transducers (M24.5-M24.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'minimisation-and-canonical-forms': [{
      id: 'partition-refinement',
      title: 'Minimise a DFA by partition refinement, and prove it is minimal',
      prompt: 'minimise(dfa) must return { blocks, states } for a TOTAL, trimmed DFA given as ' +
        '{ states, alphabet, start, accepting, delta } with `delta[state][symbol]` a single ' +
        'destination name. `blocks` is an array of arrays of state names, each block sorted, and ' +
        '`states` is their count. Start from accepting against rejecting, then repeatedly split ' +
        'any block whose members send some symbol into different blocks, until nothing splits. ' +
        'The starter stops after one round, which is the classic incomplete refinement.',
      entry: 'minimise',
      starter: [
        'function minimise(dfa) {',
        '  // One round only: correct for the easiest machines and wrong for the rest.',
        '  const accepting = [];',
        '  const rejecting = [];',
        '',
        '  dfa.states.forEach(function (state) {',
        '    (dfa.accepting.indexOf(state) !== -1 ? accepting : rejecting).push(state);',
        '  });',
        '  const blocks = [accepting, rejecting].filter(function (b) { return b.length > 0; });',
        '',
        '  return { blocks: blocks.map(function (b) { return b.slice().sort(); }),',
        '    states: blocks.length };',
        '}'
      ].join('\n'),
      solution: [
        'function minimise(dfa) {',
        '  function indexOf(blocks, state) {',
        '    for (let i = 0; i < blocks.length; i += 1) {',
        '      if (blocks[i].indexOf(state) !== -1) return i;',
        '    }',
        '    return -1;',
        '  }',
        '  const accepting = [];',
        '  const rejecting = [];',
        '',
        '  dfa.states.forEach(function (state) {',
        '    (dfa.accepting.indexOf(state) !== -1 ? accepting : rejecting).push(state);',
        '  });',
        '  let blocks = [accepting, rejecting].filter(function (b) { return b.length > 0; });',
        '',
        '  for (let round = 0; round <= dfa.states.length; round += 1) {',
        '    const next = [];',
        '',
        '    blocks.forEach(function (block) {',
        '      const groups = {};',
        '',
        '      block.forEach(function (state) {',
        '        const key = dfa.alphabet.map(function (symbol) {',
        '          return indexOf(blocks, dfa.delta[state][symbol]);',
        '        }).join(\',\');',
        '',
        '        if (!groups[key]) groups[key] = [];',
        '        groups[key].push(state);',
        '      });',
        '      Object.keys(groups).sort().forEach(function (key) { next.push(groups[key]); });',
        '    });',
        '    if (next.length === blocks.length) { blocks = next; break; }',
        '    blocks = next;',
        '  }',
        '  return { blocks: blocks.map(function (b) { return b.slice().sort(); }),',
        '    states: blocks.length };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a machine needing two rounds of refinement is minimised correctly',
          assert: function (minimise, api) {
            /* (a|b)*abb, determinised and completed: 5 states, 4 after refinement. */
            const dfa = { states: ['q0', 'q1', 'q2', 'q3', 'q4'], alphabet: ['a', 'b'],
              start: 'q0', accepting: ['q3'],
              delta: {
                q0: { a: 'q1', b: 'q0' }, q1: { a: 'q1', b: 'q2' },
                q2: { a: 'q1', b: 'q3' }, q3: { a: 'q1', b: 'q0' },
                q4: { a: 'q4', b: 'q4' }
              } };
            const result = minimise({ states: ['q0', 'q1', 'q2', 'q3'], alphabet: dfa.alphabet,
              start: 'q0', accepting: ['q3'], delta: dfa.delta });

            api.assert.equal(result.states, 4,
              'this machine is already minimal, so nothing may be merged');
            result.blocks.forEach(function (block) {
              api.assert.equal(block.length, 1, 'every block is a single state: ' + block);
            });
          }
        },
        {
          name: 'states that cannot be told apart are merged',
          assert: function (minimise, api) {
            /* Two copies of the same 2-state machine, which must collapse. */
            const dfa = { states: ['a0', 'a1', 'b0', 'b1'], alphabet: ['x'],
              start: 'a0', accepting: ['a1', 'b1'],
              delta: { a0: { x: 'a1' }, a1: { x: 'a0' }, b0: { x: 'b1' }, b1: { x: 'b0' } } };
            const result = minimise(dfa);

            api.assert.equal(result.states, 2, 'the two copies must collapse into two states');
            const sizes = result.blocks.map(function (b) { return b.length; }).sort();

            api.assert.deepEqual(sizes, [2, 2], 'each block holds one state from each copy');
          }
        },
        {
          name: 'refinement runs to a fixed point, not for one round',
          assert: function (minimise, api) {
            /* A chain where the split only reaches the start after three rounds. */
            const dfa = { states: ['s0', 's1', 's2', 's3'], alphabet: ['a'],
              start: 's0', accepting: ['s3'],
              delta: { s0: { a: 's1' }, s1: { a: 's2' }, s2: { a: 's3' }, s3: { a: 's3' } } };
            const result = minimise(dfa);

            api.assert.equal(result.states, 4,
              'each state is a different distance from acceptance, so none may merge');

            const flat = [];

            result.blocks.forEach(function (block) {
              block.forEach(function (state) { flat.push(state); });
            });
            api.assert.equal(new Set(flat).size, 4, 'every state appears exactly once');
          }
        }
      ]
    }],

    'closure-and-the-product': [{
      id: 'intersect-and-decide',
      title: 'Intersect two machines, then decide containment with a counter-example',
      prompt: 'decide(op, args) must handle three operations on TOTAL DFAs given as ' +
        '{ states, alphabet, start, accepting, delta } with a single destination per symbol. ' +
        'op "product" takes { first, second, rule } where rule is "intersection", "union" or ' +
        '"difference", and returns the product machine with pair states named "(p,q)". ' +
        'op "shortest" takes { machine } and returns the shortest accepted string, or null when ' +
        'the language is empty — search breadth-first so the answer really is shortest. ' +
        'op "contains" takes { first, second } and returns { contained, counterExample }, using ' +
        'the difference and the search. The starter builds the product but always accepts when ' +
        'the FIRST component does, which is neither intersection nor difference.',
      entry: 'decide',
      opsLimit: 4000000,
      starter: [
        'function decide(op, args) {',
        '  function pair(p, q) { return \'(\' + p + \',\' + q + \')\'; }',
        '  if (op === \'product\') {',
        '    const first = args.first;',
        '    const second = args.second;',
        '    const start = [first.start, second.start];',
        '    const order = [start];',
        '    const seen = {};',
        '    const delta = {};',
        '',
        '    seen[pair(start[0], start[1])] = true;',
        '    for (let i = 0; i < order.length; i += 1) {',
        '      const current = order[i];',
        '      const name = pair(current[0], current[1]);',
        '',
        '      delta[name] = {};',
        '      first.alphabet.forEach(function (symbol) {',
        '        const next = [first.delta[current[0]][symbol], second.delta[current[1]][symbol]];',
        '',
        '        if (!seen[pair(next[0], next[1])]) {',
        '          seen[pair(next[0], next[1])] = true;',
        '          order.push(next);',
        '        }',
        '        delta[name][symbol] = pair(next[0], next[1]);',
        '      });',
        '    }',
        '    return {',
        '      states: order.map(function (p) { return pair(p[0], p[1]); }),',
        '      alphabet: first.alphabet.slice(),',
        '      start: pair(start[0], start[1]),',
        '      accepting: order.filter(function (p) {',
        '        return first.accepting.indexOf(p[0]) !== -1;',
        '      }).map(function (p) { return pair(p[0], p[1]); }),',
        '      delta: delta',
        '    };',
        '  }',
        '  if (op === \'shortest\') return \'\';',
        '  return { contained: true, counterExample: null };',
        '}'
      ].join('\n'),
      solution: [
        'function decide(op, args) {',
        '  function pair(p, q) { return \'(\' + p + \',\' + q + \')\'; }',
        '  function rules(name) {',
        '    if (name === \'union\') return function (a, b) { return a || b; };',
        '    if (name === \'difference\') return function (a, b) { return a && !b; };',
        '    return function (a, b) { return a && b; };',
        '  }',
        '  function product(first, second, ruleName) {',
        '    const rule = rules(ruleName);',
        '    const start = [first.start, second.start];',
        '    const order = [start];',
        '    const seen = {};',
        '    const delta = {};',
        '',
        '    seen[pair(start[0], start[1])] = true;',
        '    for (let i = 0; i < order.length; i += 1) {',
        '      const current = order[i];',
        '      const name = pair(current[0], current[1]);',
        '',
        '      delta[name] = {};',
        '      first.alphabet.forEach(function (symbol) {',
        '        const next = [first.delta[current[0]][symbol], second.delta[current[1]][symbol]];',
        '',
        '        if (!seen[pair(next[0], next[1])]) {',
        '          seen[pair(next[0], next[1])] = true;',
        '          order.push(next);',
        '        }',
        '        delta[name][symbol] = pair(next[0], next[1]);',
        '      });',
        '    }',
        '    return {',
        '      states: order.map(function (p) { return pair(p[0], p[1]); }),',
        '      alphabet: first.alphabet.slice(),',
        '      start: pair(start[0], start[1]),',
        '      accepting: order.filter(function (p) {',
        '        return rule(first.accepting.indexOf(p[0]) !== -1,',
        '          second.accepting.indexOf(p[1]) !== -1);',
        '      }).map(function (p) { return pair(p[0], p[1]); }),',
        '      delta: delta',
        '    };',
        '  }',
        '  function shortest(machine) {',
        '    const seen = {};',
        '    const queue = [{ state: machine.start, word: \'\' }];',
        '',
        '    seen[machine.start] = true;',
        '    while (queue.length) {',
        '      const node = queue.shift();',
        '',
        '      if (machine.accepting.indexOf(node.state) !== -1) return node.word;',
        '      machine.alphabet.forEach(function (symbol) {',
        '        const next = machine.delta[node.state][symbol];',
        '',
        '        if (seen[next]) return;',
        '        seen[next] = true;',
        '        queue.push({ state: next, word: node.word + symbol });',
        '      });',
        '    }',
        '    return null;',
        '  }',
        '  if (op === \'product\') return product(args.first, args.second, args.rule);',
        '  if (op === \'shortest\') return shortest(args.machine);',
        '  const difference = product(args.first, args.second, \'difference\');',
        '  const witness = shortest(difference);',
        '',
        '  return { contained: witness === null, counterExample: witness };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'intersection and union differ, and only in the accepting set',
          assert: function (decide, api) {
            const endsB = { states: ['n', 'y'], alphabet: ['a', 'b'], start: 'n',
              accepting: ['y'], delta: { n: { a: 'n', b: 'y' }, y: { a: 'n', b: 'y' } } };
            const startsA = { states: ['s', 'ok', 'no'], alphabet: ['a', 'b'], start: 's',
              accepting: ['ok'],
              delta: { s: { a: 'ok', b: 'no' }, ok: { a: 'ok', b: 'ok' },
                no: { a: 'no', b: 'no' } } };
            const both = decide('product', { first: endsB, second: startsA,
              rule: 'intersection' });
            const either = decide('product', { first: endsB, second: startsA, rule: 'union' });

            api.assert.equal(both.states.length, either.states.length,
              'the same graph is built for both operations');
            api.assert.equal(decide('shortest', { machine: both }), 'ab',
              'the shortest string starting with a and ending with b');
            api.assert.equal(decide('shortest', { machine: either }), 'a',
              'the shortest string doing either');
          }
        },
        {
          name: 'containment returns the shortest counter-example, or none',
          assert: function (decide, api) {
            const endsB = { states: ['n', 'y'], alphabet: ['a', 'b'], start: 'n',
              accepting: ['y'], delta: { n: { a: 'n', b: 'y' }, y: { a: 'n', b: 'y' } } };
            const endsAB = { states: ['q0', 'q1', 'q2'], alphabet: ['a', 'b'], start: 'q0',
              accepting: ['q2'],
              delta: { q0: { a: 'q1', b: 'q0' }, q1: { a: 'q1', b: 'q2' },
                q2: { a: 'q1', b: 'q0' } } };

            const forward = decide('contains', { first: endsAB, second: endsB });

            api.assert.equal(forward.contained, true,
              'everything ending in ab also ends in b');
            api.assert.equal(forward.counterExample, null, 'so there is no counter-example');

            const backward = decide('contains', { first: endsB, second: endsAB });

            api.assert.equal(backward.contained, false, 'the other direction fails');
            api.assert.equal(backward.counterExample, 'b',
              'and "b" is the shortest string proving it');
          }
        },
        {
          name: 'the search is breadth-first, so the word really is shortest',
          assert: function (decide, api) {
            /* A machine where a depth-first search would find "aaab" before "b". */
            const machine = { states: ['s', 'x', 'y', 'z', 'f'], alphabet: ['a', 'b'],
              start: 's', accepting: ['f'],
              delta: {
                s: { a: 'x', b: 'f' }, x: { a: 'y', b: 'x' }, y: { a: 'z', b: 'y' },
                z: { a: 'z', b: 'f' }, f: { a: 'f', b: 'f' }
              } };

            api.assert.equal(decide('shortest', { machine: machine }), 'b',
              'the one-character answer must be found before any longer one');

            const empty = { states: ['s'], alphabet: ['a'], start: 's', accepting: [],
              delta: { s: { a: 's' } } };

            api.assert.equal(decide('shortest', { machine: empty }), null,
              'an empty language returns null rather than a string');
          }
        }
      ]
    }],

    'proving-non-regularity': [{
      id: 'distinguishing-set',
      title: 'Build a distinguishing family and prove aⁿbⁿ is not regular',
      prompt: 'distinguish(size) must return { prefixes, pairs } for the language aⁿbⁿ. ' +
        '`prefixes` is an array of `size` prefixes, and `pairs` holds one entry ' +
        '{ left, right, suffix } for every unordered pair, where `suffix` is a string that one ' +
        'of them can be followed by to land in the language and the other cannot. Every pair ' +
        'must have a witness — a null suffix would mean the two prefixes are the same state, ' +
        'and then the family proves nothing. The starter returns prefixes that are all ' +
        'equivalent, so no witness exists.',
      entry: 'distinguish',
      starter: [
        'function distinguish(size) {',
        '  // Every prefix is the same string, so no suffix can tell any two apart.',
        '  const prefixes = [];',
        '',
        '  for (let i = 1; i <= size; i += 1) prefixes.push(\'ab\');',
        '  const pairs = [];',
        '',
        '  for (let i = 0; i < prefixes.length; i += 1) {',
        '    for (let j = i + 1; j < prefixes.length; j += 1) {',
        '      pairs.push({ left: prefixes[i], right: prefixes[j], suffix: null });',
        '    }',
        '  }',
        '  return { prefixes: prefixes, pairs: pairs };',
        '}'
      ].join('\n'),
      solution: [
        'function distinguish(size) {',
        '  const prefixes = [];',
        '',
        '  for (let i = 1; i <= size; i += 1) prefixes.push(\'a\'.repeat(i));',
        '  const pairs = [];',
        '',
        '  for (let i = 0; i < prefixes.length; i += 1) {',
        '    for (let j = i + 1; j < prefixes.length; j += 1) {',
        '      pairs.push({ left: prefixes[i], right: prefixes[j],',
        '        suffix: \'b\'.repeat(i + 1) });',
        '    }',
        '  }',
        '  return { prefixes: prefixes, pairs: pairs };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every pair has a witness that really distinguishes it',
          assert: function (distinguish, api) {
            const inLanguage = function (word) {
              const n = word.split('').filter(function (c) { return c === 'a'; }).length;

              return word === 'a'.repeat(n) + 'b'.repeat(word.length - n)
                && word.length === 2 * n;
            };
            const result = distinguish(6);

            api.assert.equal(result.prefixes.length, 6, 'six prefixes were asked for');
            api.assert.equal(result.pairs.length, 15, 'six prefixes give fifteen pairs');
            result.pairs.forEach(function (row) {
              api.assert.ok(typeof row.suffix === 'string',
                'every pair needs a witness: ' + row.left + ' against ' + row.right);
              api.assert.notEqual(inLanguage(row.left + row.suffix),
                inLanguage(row.right + row.suffix),
                '"' + row.suffix + '" must separate "' + row.left + '" from "' + row.right + '"');
            });
          }
        },
        {
          name: 'the prefixes are distinct, and the family grows',
          assert: function (distinguish, api) {
            const small = distinguish(3);
            const large = distinguish(9);

            api.assert.equal(new Set(small.prefixes).size, 3, 'no repeated prefixes');
            api.assert.equal(new Set(large.prefixes).size, 9, 'and none at the larger size');
            api.assert.equal(large.pairs.length, 36, 'nine prefixes give thirty-six pairs');
            api.assert.ok(large.prefixes.every(function (p) {
              return p.indexOf('b') === -1;
            }), 'the family lives entirely in the run of a, where the count is unbounded');
          }
        },
        {
          name: 'the conclusion follows: no finite machine suffices',
          assert: function (distinguish, api) {
            const inLanguage = function (word) {
              const n = word.split('').filter(function (c) { return c === 'a'; }).length;

              return word === 'a'.repeat(n) + 'b'.repeat(word.length - n)
                && word.length === 2 * n;
            };

            [4, 7, 12].forEach(function (size) {
              const result = distinguish(size);

              api.assert.equal(result.prefixes.length, size,
                'the family extends to any size, which is the proof');
              result.pairs.forEach(function (row) {
                api.assert.notEqual(inLanguage(row.left + row.suffix),
                  inLanguage(row.right + row.suffix),
                  'every pair is still distinguished at size ' + size);
              });
            });
          }
        }
      ]
    }],

    transducers: [{
      id: 'compose-transducers',
      title: 'Compose two Mealy machines into one pass',
      prompt: 'compose(first, second) must return a Mealy machine doing both jobs in a single ' +
        'traversal. A machine is { states, alphabet, start, delta } where ' +
        '`delta[state][symbol]` is { to, out } and `out` may be the empty string. The composed ' +
        'state is a pair named "(p,q)": for each input symbol, move the first machine once, then ' +
        'feed EVERY character it wrote through the second machine in order, collecting what the ' +
        'second writes. The starter feeds only the first character the first machine wrote, ' +
        'which is right whenever it writes exactly one and wrong otherwise.',
      entry: 'compose',
      starter: [
        'function compose(first, second) {',
        '  // Only the first written character is passed on, so deletions and',
        '  // multi-character outputs are silently dropped.',
        '  function pair(p, q) { return \'(\' + p + \',\' + q + \')\'; }',
        '  const start = [first.start, second.start];',
        '  const order = [start];',
        '  const seen = {};',
        '  const delta = {};',
        '',
        '  seen[pair(start[0], start[1])] = true;',
        '  for (let i = 0; i < order.length; i += 1) {',
        '    const current = order[i];',
        '    const name = pair(current[0], current[1]);',
        '',
        '    delta[name] = {};',
        '    first.alphabet.forEach(function (symbol) {',
        '      const outer = first.delta[current[0]][symbol];',
        '',
        '      if (!outer) return;',
        '      const written = outer.out.charAt(0);',
        '      const inner = second.delta[current[1]][written];',
        '',
        '      if (!inner) return;',
        '      const next = [outer.to, inner.to];',
        '',
        '      if (!seen[pair(next[0], next[1])]) {',
        '        seen[pair(next[0], next[1])] = true;',
        '        order.push(next);',
        '      }',
        '      delta[name][symbol] = { to: pair(next[0], next[1]), out: inner.out };',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(function (p) { return pair(p[0], p[1]); }),',
        '    alphabet: first.alphabet.slice(),',
        '    start: pair(start[0], start[1]), delta: delta',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function compose(first, second) {',
        '  function pair(p, q) { return \'(\' + p + \',\' + q + \')\'; }',
        '  function edge(current, symbol) {',
        '    const outer = first.delta[current[0]][symbol];',
        '',
        '    if (!outer) return null;',
        '    let inner = current[1];',
        '    let written = \'\';',
        '    const middle = outer.out.split(\'\');',
        '',
        '    for (let i = 0; i < middle.length; i += 1) {',
        '      const move = second.delta[inner][middle[i]];',
        '',
        '      if (!move) return null;',
        '      written += move.out;',
        '      inner = move.to;',
        '    }',
        '    return { to: [outer.to, inner], out: written };',
        '  }',
        '  const start = [first.start, second.start];',
        '  const order = [start];',
        '  const seen = {};',
        '  const delta = {};',
        '',
        '  seen[pair(start[0], start[1])] = true;',
        '  for (let i = 0; i < order.length; i += 1) {',
        '    const current = order[i];',
        '    const name = pair(current[0], current[1]);',
        '',
        '    delta[name] = {};',
        '    first.alphabet.forEach(function (symbol) {',
        '      const found = edge(current, symbol);',
        '',
        '      if (found === null) return;',
        '      if (!seen[pair(found.to[0], found.to[1])]) {',
        '        seen[pair(found.to[0], found.to[1])] = true;',
        '        order.push(found.to);',
        '      }',
        '      delta[name][symbol] = { to: pair(found.to[0], found.to[1]), out: found.out };',
        '    });',
        '  }',
        '  return {',
        '    states: order.map(function (p) { return pair(p[0], p[1]); }),',
        '    alphabet: first.alphabet.slice(),',
        '    start: pair(start[0], start[1]), delta: delta',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the composed machine matches running both in sequence',
          assert: function (compose, api) {
            const run = function (machine, input) {
              let state = machine.start;
              let out = '';

              for (let i = 0; i < input.length; i += 1) {
                const move = machine.delta[state][input[i]];

                if (!move) return null;
                out += move.out;
                state = move.to;
              }
              return out;
            };
            const alphabet = ['A', 'B', 'a', 'b', ' '];
            const foldDelta = { q: {} };

            alphabet.forEach(function (symbol) {
              foldDelta.q[symbol] = { to: 'q', out: symbol.toLowerCase() };
            });
            const fold = { states: ['q'], alphabet: alphabet, start: 'q', delta: foldDelta };
            const lower = ['a', 'b', ' '];
            const collapseDelta = { text: {}, space: {} };

            lower.forEach(function (symbol) {
              if (symbol === ' ') {
                collapseDelta.text[symbol] = { to: 'space', out: ' ' };
                collapseDelta.space[symbol] = { to: 'space', out: '' };
                return;
              }
              collapseDelta.text[symbol] = { to: 'text', out: symbol };
              collapseDelta.space[symbol] = { to: 'text', out: symbol };
            });
            const collapse = { states: ['text', 'space'], alphabet: lower, start: 'text',
              delta: collapseDelta };
            const composed = compose(fold, collapse);

            ['A  B', 'aB  ba', '   ', 'AaBb', 'a b  a'].forEach(function (input) {
              api.assert.equal(run(composed, input), run(collapse, run(fold, input)),
                'composed and chained must agree on "' + input + '"');
            });
          }
        },
        {
          name: 'a machine that writes two characters per symbol still composes',
          assert: function (compose, api) {
            const run = function (machine, input) {
              let state = machine.start;
              let out = '';

              for (let i = 0; i < input.length; i += 1) {
                const move = machine.delta[state][input[i]];

                if (!move) return null;
                out += move.out;
                state = move.to;
              }
              return out;
            };
            /* The first machine doubles every symbol; the second deletes every second one,
               so the composition is the identity — and only if all output is passed on. */
            const doubler = { states: ['d'], alphabet: ['x', 'y'], start: 'd',
              delta: { d: { x: { to: 'd', out: 'xx' }, y: { to: 'd', out: 'yy' } } } };
            const dropper = { states: ['keep', 'drop'], alphabet: ['x', 'y'], start: 'keep',
              delta: {
                keep: { x: { to: 'drop', out: 'x' }, y: { to: 'drop', out: 'y' } },
                drop: { x: { to: 'keep', out: '' }, y: { to: 'keep', out: '' } }
              } };
            const composed = compose(doubler, dropper);

            ['x', 'xy', 'yyxx', 'xyxyxy'].forEach(function (input) {
              api.assert.equal(run(composed, input), input,
                'doubling then dropping every second character is the identity on "' +
                input + '"');
            });
          }
        },
        {
          name: 'deletions are carried through',
          assert: function (compose, api) {
            const run = function (machine, input) {
              let state = machine.start;
              let out = '';

              for (let i = 0; i < input.length; i += 1) {
                const move = machine.delta[state][input[i]];

                if (!move) return null;
                out += move.out;
                state = move.to;
              }
              return out;
            };
            /* The first machine deletes every x; the second upper-cases what survives. */
            const stripper = { states: ['s'], alphabet: ['x', 'y'], start: 's',
              delta: { s: { x: { to: 's', out: '' }, y: { to: 's', out: 'y' } } } };
            const shouter = { states: ['s'], alphabet: ['y'], start: 's',
              delta: { s: { y: { to: 's', out: 'Y' } } } };
            const composed = compose(stripper, shouter);

            api.assert.equal(run(composed, 'xyxxy'), 'YY',
              'the x characters are consumed and write nothing at all');
            api.assert.equal(run(composed, 'xxxx'), '',
              'an input that is entirely deleted produces no output');
            api.assert.equal(run(composed, 'yy'), 'YY', 'and nothing is lost when nothing is deleted');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
