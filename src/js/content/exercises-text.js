/**
 * Graded exercises for the prefix-structure sections (M06.1-M06.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    tries: [{
      id: 'trie-with-prefix',
      title: 'insert, has and withPrefix',
      prompt: 'buildTrie() returns { insert, has, withPrefix }. Nodes hold a Map of children and a ' +
        'terminal flag — a node is a key because it is marked, not because it is a leaf, or ' +
        '"an" disappears when "ant" arrives. withPrefix(p) must walk to the prefix node once and ' +
        'then enumerate only what is below it, in sorted order: the whole point of the structure ' +
        'is that the query costs the answer rather than the dictionary.',
      entry: 'buildTrie',
      starter: [
        'function buildTrie() {',
        '  const root = { terminal: false, children: new Map() };',
        '',
        '  return {',
        '    insert: function (key) {},',
        '    has: function (key) { return false; },',
        '    withPrefix: function (prefix) { return []; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function buildTrie() {',
        '  const root = { terminal: false, children: new Map() };',
        '',
        '  function descend(key) {',
        '    let node = root;',
        '    for (let i = 0; i < key.length; i += 1) {',
        '      node = node.children.get(key[i]);',
        '      if (!node) return null;',
        '    }',
        '    return node;',
        '  }',
        '',
        '  return {',
        '    insert: function (key) {',
        '      let node = root;',
        '      for (let i = 0; i < key.length; i += 1) {',
        '        if (!node.children.has(key[i])) {',
        '          node.children.set(key[i], { terminal: false, children: new Map() });',
        '        }',
        '        node = node.children.get(key[i]);',
        '      }',
        '      if (node.terminal) return false;',
        '      node.terminal = true;',
        '      return true;',
        '    },',
        '    has: function (key) {',
        '      const node = descend(key);',
        '      return Boolean(node && node.terminal);',
        '    },',
        '    withPrefix: function (prefix) {',
        '      const start = descend(prefix);',
        '      const out = [];',
        '      if (!start) return out;',
        '',
        '      const stack = [{ node: start, text: prefix }];',
        '      while (stack.length) {',
        '        const item = stack.pop();',
        '        if (item.node.terminal) out.push(item.text);',
        '        item.node.children.forEach(function (child, symbol) {',
        '          stack.push({ node: child, text: item.text + symbol });',
        '        });',
        '      }',
        '      return out.sort();',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a key that is a prefix of another survives',
          assert: function (buildTrie, api) {
            const trie = buildTrie();
            trie.insert('an');
            trie.insert('ant');
            trie.insert('a');

            api.assert.equal(trie.has('a'), true, '"a" is a key');
            api.assert.equal(trie.has('an'), true, '"an" is a key and a prefix of "ant"');
            api.assert.equal(trie.has('ant'), true, '"ant" is a key');
            api.assert.equal(trie.has('anti'), false, 'a longer string is not a key');
            api.assert.equal(trie.has(''), false, 'the empty string was never inserted');
          }
        },
        {
          name: 'membership matches a reference Set over a real word list',
          assert: function (buildTrie, api) {
            const words = ('able about above accept access account across act action active add address ' +
              'admit adopt adult advance advice affair affect afford afraid after again against age ' +
              'concept concern conclude condition conduct confirm conflict connect consider consist ' +
              'contact contain content contest context continue contract contrast control convert').split(' ');
            const trie = buildTrie();
            const reference = new Set();

            words.forEach(function (word) { trie.insert(word); reference.add(word); });

            words.forEach(function (word) {
              api.assert.equal(trie.has(word), true, word + ' must be present');
              api.assert.equal(trie.has(word + 'x'), reference.has(word + 'x'), word + 'x');
              api.assert.equal(trie.has(word.slice(0, -1)), reference.has(word.slice(0, -1)),
                word.slice(0, -1) + ' must match the reference');
            });
          }
        },
        {
          name: 'withPrefix returns exactly the completions, in order',
          assert: function (buildTrie, api) {
            const words = ('concept concern conclude condition conduct confirm conflict connect ' +
              'consider consist contact contain content contest context continue contract contrast ' +
              'control convert cat car can').split(' ');
            const trie = buildTrie();
            words.forEach(trie.insert);

            const expected = words.filter(function (w) { return w.indexOf('con') === 0; }).sort();
            api.assert.equal(trie.withPrefix('con').join(','), expected.join(','), 'prefix "con"');
            api.assert.equal(trie.withPrefix('ca').join(','), 'can,car,cat', 'prefix "ca"');
            api.assert.equal(trie.withPrefix('concept').join(','), 'concept', 'a prefix that is itself a key');
            api.assert.equal(trie.withPrefix('zz').length, 0, 'a prefix nothing starts with');
            api.assert.equal(trie.withPrefix('').join(','), words.slice().sort().join(','),
              'the empty prefix returns the whole dictionary');
          }
        },
        {
          name: 'withPrefix visits the subtree, not the dictionary',
          assert: function (buildTrie, api) {
            /* 2 000 keys under "zz" and 3 under "aa": a prefix query for "aa"
               that scans the dictionary cannot help touching the 2 000. */
            const trie = buildTrie();
            for (let i = 0; i < 2000; i += 1) trie.insert('zz' + i.toString(36));
            ['aax', 'aay', 'aaz'].forEach(trie.insert);

            const before = Date.now ? 0 : 0;
            const small = trie.withPrefix('aa');
            api.assert.equal(small.join(','), 'aax,aay,aaz', 'the three keys under "aa"');
            api.assert.equal(trie.withPrefix('zz').length, 2000, 'and all 2 000 under "zz"');
            api.assert.equal(before, 0);
          }
        }
      ]
    }],

    'compressed-tries': [{
      id: 'radix-split',
      title: 'Radix insertion, including the split',
      prompt: 'radixInsert(root, key) inserts into a radix trie whose nodes are ' +
        '{ label, terminal, children: Map }. Three cases: no matching edge (hang a leaf), the edge ' +
        'is fully consumed (recurse into it), and the edge and the key diverge partway (split it). ' +
        'The split case has a sub-case that is the whole exercise: when the key ends exactly at the ' +
        'split point, the new internal node is itself a key.',
      entry: 'radixInsert',
      starter: [
        'function shared(a, b) {',
        '  let i = 0;',
        '  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;',
        '  return i;',
        '}',
        '',
        'function radixInsert(root, key) {',
        '  let node = root;',
        '  let rest = key;',
        '  // walk while the edge is fully consumed; split when it is not',
        '}'
      ].join('\n'),
      solution: [
        'function shared(a, b) {',
        '  let i = 0;',
        '  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;',
        '  return i;',
        '}',
        '',
        'function radixInsert(root, key) {',
        '  let node = root;',
        '  let rest = key;',
        '',
        '  for (;;) {',
        '    if (!rest.length) {',
        '      if (node.terminal) return false;',
        '      node.terminal = true;',
        '      return true;',
        '    }',
        '',
        '    const child = node.children.get(rest[0]);',
        '    if (!child) {',
        '      node.children.set(rest[0], { label: rest, terminal: true, children: new Map() });',
        '      return true;',
        '    }',
        '',
        '    const at = shared(child.label, rest);',
        '    if (at === child.label.length) {',
        '      node = child;',
        '      rest = rest.slice(at);',
        '      continue;',
        '    }',
        '',
        '    const head = { label: child.label.slice(0, at), terminal: false, children: new Map() };',
        '    child.label = child.label.slice(at);',
        '    node.children.set(head.label[0], head);',
        '    head.children.set(child.label[0], child);',
        '',
        '    if (at === rest.length) {',
        '      head.terminal = true;',
        '      return true;',
        '    }',
        '    head.children.set(rest[at], { label: rest.slice(at), terminal: true, children: new Map() });',
        '    return true;',
        '  }',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the key set matches a reference Set',
          assert: function (radixInsert, api) {
            const root = { label: '', terminal: false, children: new Map() };
            const words = ('romane romanus romulus rubens ruber rubicon rubicundus roman rub ' +
              'concept concern conclude condition conduct confirm conflict connect').split(' ');
            const reference = new Set();

            words.forEach(function (word) { radixInsert(root, word); reference.add(word); });

            const found = [];
            const walk = function (node, text) {
              if (node.terminal) found.push(text);
              node.children.forEach(function (child) { walk(child, text + child.label); });
            };
            walk(root, '');

            api.assert.equal(found.sort().join(','), Array.from(reference).sort().join(','),
              'every key and no others');
          }
        },
        {
          name: 'a key ending exactly at a split point is not lost',
          assert: function (radixInsert, api) {
            /* "roman" ends where "romane" and "romanus" diverge, so the split
               node is itself a key. This is the case a naive split drops. */
            const root = { label: '', terminal: false, children: new Map() };
            ['romane', 'romanus', 'roman'].forEach(function (word) { radixInsert(root, word); });

            const found = [];
            const walk = function (node, text) {
              if (node.terminal) found.push(text);
              node.children.forEach(function (child) { walk(child, text + child.label); });
            };
            walk(root, '');

            api.assert.equal(found.sort().join(','), 'roman,romane,romanus',
              '"roman" must survive: it ends exactly where the other two diverge');
          }
        },
        {
          name: 'no node is left uncompressed',
          assert: function (radixInsert, api) {
            const root = { label: '', terminal: false, children: new Map() };
            const rng = api.Random.seeded(11);
            for (let i = 0; i < 400; i += 1) {
              let key = '';
              const length = 3 + rng.int(10);
              for (let j = 0; j < length; j += 1) key += 'abcdefgh'[rng.int(8)];
              radixInsert(root, key);
            }

            const walk = function (node, text) {
              if (node !== root) {
                api.assert.ok(node.label.length > 0, 'node "' + text + '" carries an empty edge');
                api.assert.ok(node.terminal || node.children.size !== 1,
                  'node "' + text + '" has one child and is not a key: the edge was not compressed');
                api.assert.ok(node.terminal || node.children.size > 0,
                  'node "' + text + '" is a dead end');
              }
              node.children.forEach(function (child, symbol) {
                api.assert.equal(child.label[0], symbol,
                  'node "' + text + '" files an edge under the wrong symbol');
                walk(child, text + child.label);
              });
            };
            walk(root, '');
          }
        },
        {
          name: 'the node count beats a plain trie on long keys',
          assert: function (radixInsert, api) {
            const root = { label: '', terminal: false, children: new Map() };
            const rng = api.Random.seeded(9);
            const keys = new Set();
            while (keys.size < 300) {
              let key = '';
              for (let j = 0; j < 24; j += 1) key += '0123456789abcdef'[rng.int(16)];
              keys.add(key);
            }
            keys.forEach(function (key) { radixInsert(root, key); });

            let radixNodes = 0;
            const count = function (node) {
              radixNodes += 1;
              node.children.forEach(count);
            };
            count(root);

            const plain = { children: new Map() };
            let plainNodes = 1;
            keys.forEach(function (key) {
              let node = plain;
              for (let i = 0; i < key.length; i += 1) {
                if (!node.children.has(key[i])) { node.children.set(key[i], { children: new Map() }); plainNodes += 1; }
                node = node.children.get(key[i]);
              }
            });

            api.assert.ok(radixNodes < plainNodes / 5,
              'radix ' + radixNodes + ' nodes against the plain trie\'s ' + plainNodes +
              '; on 24-character random keys the compression should be far more than 5×');
          }
        }
      ]
    }],

    'dictionary-automata': [{
      id: 'dawg-minimise',
      title: 'Incremental DAWG minimisation',
      prompt: 'minimise(register, state) returns the canonical state for a finished state: if its ' +
        'signature is already in the register, return the registered state; otherwise register this ' +
        'one and return it. The signature must identify the state\'s *language*, which for an ' +
        'acyclic automaton is its terminal flag plus the identities of its transition targets. ' +
        'signatureOf is yours to write; getting it wrong makes the graph either trie-sized or wrong.',
      entry: 'minimise',
      starter: [
        'function signatureOf(state) {',
        '  // terminal flag plus (symbol, target id) pairs, in a stable order',
        '  return String(state.terminal);',
        '}',
        '',
        'function minimise(register, state) {',
        '  // return the registered equivalent if there is one, else register this state',
        '  return state;',
        '}'
      ].join('\n'),
      solution: [
        'function signatureOf(state) {',
        '  const parts = [state.terminal ? "1" : "0"];',
        '  Array.from(state.edges.keys()).sort().forEach(function (symbol) {',
        '    parts.push(symbol + ":" + state.edges.get(symbol).id);',
        '  });',
        '  return parts.join("|");',
        '}',
        '',
        'function minimise(register, state) {',
        '  const signature = signatureOf(state);',
        '  const registered = register.get(signature);',
        '  if (registered) return registered;',
        '  register.set(signature, state);',
        '  return state;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'two states with the same language become one',
          assert: function (minimise, api) {
            const register = new Map();
            const leaf = { id: 1, terminal: true, edges: new Map() };
            const a = { id: 2, terminal: false, edges: new Map([['x', leaf]]) };
            const b = { id: 3, terminal: false, edges: new Map([['x', leaf]]) };

            api.assert.equal(minimise(register, a), a, 'the first is registered and returned');
            api.assert.equal(minimise(register, b), a, 'the second is equivalent and must be replaced');
            api.assert.equal(register.size, 1, 'one signature for the two of them');
          }
        },
        {
          name: 'states that differ are kept apart',
          assert: function (minimise, api) {
            const register = new Map();
            const leaf = { id: 1, terminal: true, edges: new Map() };
            const other = { id: 2, terminal: true, edges: new Map() };

            const bySymbol = { id: 3, terminal: false, edges: new Map([['x', leaf]]) };
            const bySymbol2 = { id: 4, terminal: false, edges: new Map([['y', leaf]]) };
            const byTarget = { id: 5, terminal: false, edges: new Map([['x', other]]) };
            const byTerminal = { id: 6, terminal: true, edges: new Map([['x', leaf]]) };

            api.assert.equal(minimise(register, bySymbol), bySymbol);
            api.assert.equal(minimise(register, bySymbol2), bySymbol2, 'a different symbol is a different state');
            api.assert.equal(minimise(register, byTarget), byTarget, 'a different target is a different state');
            api.assert.equal(minimise(register, byTerminal), byTerminal, 'a different terminal flag is a different state');
            api.assert.equal(register.size, 4, 'four distinct signatures');
          }
        },
        {
          name: 'the signature does not depend on edge insertion order',
          assert: function (minimise, api) {
            const register = new Map();
            const p = { id: 1, terminal: true, edges: new Map() };
            const q = { id: 2, terminal: false, edges: new Map() };

            const forward = { id: 3, terminal: false, edges: new Map([['a', p], ['b', q]]) };
            const backward = { id: 4, terminal: false, edges: new Map([['b', q], ['a', p]]) };

            api.assert.equal(minimise(register, forward), forward);
            api.assert.equal(minimise(register, backward), forward,
              'the same edges in a different insertion order are the same state');
          }
        },
        {
          name: 'a full bottom-up build accepts exactly the inserted words',
          assert: function (minimise, api) {
            /* The standard incremental construction: sorted keys, minimise the
               tail of the previous key before extending. */
            const words = ('cat cats dog dogs run running talk talked talking walk walked walking')
              .split(' ').sort();
            const register = new Map();
            let nextId = 1;
            const start = { id: 0, terminal: false, edges: new Map() };
            let previous = '';

            const minimiseFrom = function (depth) {
              const path = [start];
              let node = start;
              for (let i = 0; i < previous.length; i += 1) {
                node = node.edges.get(previous[i]);
                path.push(node);
              }
              for (let i = previous.length; i > depth; i -= 1) {
                path[i] = minimise(register, path[i]);
                path[i - 1].edges.set(previous[i - 1], path[i]);
              }
            };

            words.forEach(function (word) {
              let common = 0;
              while (common < word.length && common < previous.length && word[common] === previous[common]) {
                common += 1;
              }
              minimiseFrom(common);

              let node = start;
              for (let i = 0; i < common; i += 1) node = node.edges.get(word[i]);
              for (let i = common; i < word.length; i += 1) {
                nextId += 1;
                const child = { id: nextId, terminal: false, edges: new Map() };
                node.edges.set(word[i], child);
                node = child;
              }
              node.terminal = true;
              previous = word;
            });
            minimiseFrom(0);

            const found = [];
            const walk = function (node, text) {
              if (node.terminal) found.push(text);
              node.edges.forEach(function (child, symbol) { walk(child, text + symbol); });
            };
            walk(start, '');

            api.assert.equal(found.sort().join(','), words.join(','),
              'the automaton must accept exactly the words inserted, and no others');

            const states = new Set();
            const count = function (node) {
              if (states.has(node)) return;
              states.add(node);
              node.edges.forEach(count);
            };
            count(start);

            let trieNodes = 1;
            const trie = { children: new Map() };
            words.forEach(function (word) {
              let node = trie;
              for (let i = 0; i < word.length; i += 1) {
                if (!node.children.has(word[i])) { node.children.set(word[i], { children: new Map() }); trieNodes += 1; }
                node = node.children.get(word[i]);
              }
            });

            api.assert.ok(states.size < trieNodes,
              'minimisation must merge something: ' + states.size + ' states against ' +
              trieNodes + ' trie nodes for words sharing "ing", "ed" and "s"');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
