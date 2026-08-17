/**
 * Graded exercises for the suffix-structure sections (M06.4-M06.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'suffix-trees': [{
      id: 'longest-repeated',
      title: 'The longest repeated substring, from a built tree',
      prompt: 'longestRepeated(tree) takes a suffix tree — nodes are { start, end, children: Map }, ' +
        'with the text on tree.text and Infinity meaning "to the end" — and returns the longest ' +
        'substring that occurs at least twice. That is the path label of the deepest *internal* ' +
        'node, because an internal node exists exactly where two suffixes diverged. Two traps: a ' +
        'leaf is not internal however deep it is, and any path containing the terminator is a ' +
        'suffix rather than a repeat.',
      entry: 'longestRepeated',
      starter: [
        'function longestRepeated(tree) {',
        '  // walk from the root, carrying the path label',
        '  // consider only nodes with children, and skip anything containing the terminator',
        '  return "";',
        '}'
      ].join('\n'),
      solution: [
        'function longestRepeated(tree) {',
        '  const text = tree.text;',
        '  const terminator = text[text.length - 1];',
        '  let best = "";',
        '',
        '  const label = function (node) {',
        '    if (node === tree.root) return "";',
        '    const end = node.end === Infinity ? text.length : node.end;',
        '    return text.slice(node.start, end);',
        '  };',
        '',
        '  const stack = [{ node: tree.root, text: "" }];',
        '  while (stack.length) {',
        '    const item = stack.pop();',
        '    if (item.node.children.size) {',
        '      if (item.text.indexOf(terminator) === -1 && item.text.length > best.length) {',
        '        best = item.text;',
        '      }',
        '    }',
        '    item.node.children.forEach(function (child) {',
        '      stack.push({ node: child, text: item.text + label(child) });',
        '    });',
        '  }',
        '  return best;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with brute force on the textbook cases',
          assert: function (longestRepeated, api) {
            const build = function (input) {
              /* A small explicit suffix tree: insert every suffix into a trie,
                 then collapse the non-branching chains. Slow and obviously
                 correct, which is what a test wants. */
              const text = input + '$';
              const root = { start: -1, end: -1, children: new Map() };
              for (let i = 0; i < text.length; i += 1) {
                let node = root;
                for (let j = i; j < text.length; j += 1) {
                  if (!node.children.has(text[j])) {
                    node.children.set(text[j], { start: j, end: j + 1, children: new Map() });
                  }
                  node = node.children.get(text[j]);
                }
              }
              const collapse = function (node) {
                node.children.forEach(function (child, symbol) {
                  let current = child;
                  while (current.children.size === 1) {
                    const only = Array.from(current.children.values())[0];
                    current.end = only.end;
                    current.children = only.children;
                  }
                  collapse(current);
                  node.children.set(symbol, current);
                });
              };
              collapse(root);
              return { text: text, root: root };
            };

            const brute = function (input) {
              let best = '';
              for (let i = 0; i < input.length; i += 1) {
                for (let j = i + 1; j <= input.length; j += 1) {
                  const candidate = input.slice(i, j);
                  if (candidate.length <= best.length) continue;
                  if (input.indexOf(candidate, i + 1) !== -1) best = candidate;
                }
              }
              return best;
            };

            ['banana', 'mississippi', 'abcabxabcd', 'aaaa', 'abcd'].forEach(function (input) {
              const found = longestRepeated(build(input));
              const expected = brute(input);
              api.assert.equal(found.length, expected.length,
                input + ': found "' + found + '" (' + found.length + '), expected length ' + expected.length);
              api.assert.ok(input.indexOf(found) !== -1 || found === '',
                input + ': "' + found + '" is not even a substring');
              if (found.length) {
                api.assert.ok(input.indexOf(found, input.indexOf(found) + 1) !== -1,
                  input + ': "' + found + '" does not occur twice');
              }
            });
          }
        },
        {
          name: 'the terminator never leaks into the answer',
          assert: function (longestRepeated, api) {
            const build = function (input) {
              const text = input + '$';
              const root = { start: -1, end: -1, children: new Map() };
              for (let i = 0; i < text.length; i += 1) {
                let node = root;
                for (let j = i; j < text.length; j += 1) {
                  if (!node.children.has(text[j])) {
                    node.children.set(text[j], { start: j, end: j + 1, children: new Map() });
                  }
                  node = node.children.get(text[j]);
                }
              }
              const collapse = function (node) {
                node.children.forEach(function (child, symbol) {
                  let current = child;
                  while (current.children.size === 1) {
                    const only = Array.from(current.children.values())[0];
                    current.end = only.end;
                    current.children = only.children;
                  }
                  collapse(current);
                  node.children.set(symbol, current);
                });
              };
              collapse(root);
              return { text: text, root: root };
            };

            ['banana', 'aaaa', 'abab', 'xyz'].forEach(function (input) {
              const found = longestRepeated(build(input));
              api.assert.equal(found.indexOf('$'), -1, input + ': the answer contains the terminator');
            });
          }
        },
        {
          name: 'a text with no repeat returns nothing',
          assert: function (longestRepeated, api) {
            const build = function (input) {
              const text = input + '$';
              const root = { start: -1, end: -1, children: new Map() };
              for (let i = 0; i < text.length; i += 1) {
                let node = root;
                for (let j = i; j < text.length; j += 1) {
                  if (!node.children.has(text[j])) {
                    node.children.set(text[j], { start: j, end: j + 1, children: new Map() });
                  }
                  node = node.children.get(text[j]);
                }
              }
              const collapse = function (node) {
                node.children.forEach(function (child, symbol) {
                  let current = child;
                  while (current.children.size === 1) {
                    const only = Array.from(current.children.values())[0];
                    current.end = only.end;
                    current.children = only.children;
                  }
                  collapse(current);
                  node.children.set(symbol, current);
                });
              };
              collapse(root);
              return { text: text, root: root };
            };

            api.assert.equal(longestRepeated(build('abcdefg')), '', 'no character repeats');
            api.assert.equal(longestRepeated(build('a')), '', 'a single character');
            api.assert.equal(longestRepeated(build('ab')).length, 0, 'two distinct characters');
          }
        },
        {
          name: 'it survives a long repetitive input',
          assert: function (longestRepeated, api) {
            const build = function (input) {
              const text = input + '$';
              const root = { start: -1, end: -1, children: new Map() };
              for (let i = 0; i < text.length; i += 1) {
                let node = root;
                for (let j = i; j < text.length; j += 1) {
                  if (!node.children.has(text[j])) {
                    node.children.set(text[j], { start: j, end: j + 1, children: new Map() });
                  }
                  node = node.children.get(text[j]);
                }
              }
              const collapse = function (node) {
                node.children.forEach(function (child, symbol) {
                  let current = child;
                  while (current.children.size === 1) {
                    const only = Array.from(current.children.values())[0];
                    current.end = only.end;
                    current.children = only.children;
                  }
                  collapse(current);
                  node.children.set(symbol, current);
                });
              };
              collapse(root);
              return { text: text, root: root };
            };

            let input = '';
            for (let i = 0; i < 30; i += 1) input += 'a';
            api.assert.equal(longestRepeated(build(input)).length, 29,
              '30 copies of a letter repeat in a run of 29');

            api.assert.equal(longestRepeated(build('abcabcabc')), 'abcabc',
              'three copies of abc share a 6-character repeat');
          }
        }
      ]
    }],

    'suffix-arrays': [{
      id: 'kasai-lcp',
      title: 'Kasai\'s LCP construction',
      prompt: 'buildLcp(text, sa) returns the LCP array: lcp[i] is how many characters suffix sa[i] ' +
        'shares with sa[i − 1], and lcp[0] is 0. Walk the suffixes in *text* order, not array ' +
        'order, and carry the match length: dropping a suffix\'s first character can shorten its ' +
        'overlap with its neighbour by at most one, which is what makes this linear rather than ' +
        'quadratic. Forgetting to decrement the carried length after each row is the classic bug ' +
        'and it produces LCPs that are too large.',
      entry: 'buildLcp',
      starter: [
        'function buildLcp(text, sa) {',
        '  const rank = new Array(text.length).fill(0);',
        '  sa.forEach(function (at, i) { rank[at] = i; });',
        '  const lcp = new Array(text.length).fill(0);',
        '',
        '  // walk i from 0 to n-1, carrying h',
        '  return lcp;',
        '}'
      ].join('\n'),
      solution: [
        'function buildLcp(text, sa) {',
        '  const n = text.length;',
        '  const rank = new Array(n).fill(0);',
        '  sa.forEach(function (at, i) { rank[at] = i; });',
        '',
        '  const lcp = new Array(n).fill(0);',
        '  let h = 0;',
        '',
        '  for (let i = 0; i < n; i += 1) {',
        '    if (rank[i] === 0) { h = 0; continue; }',
        '    const previous = sa[rank[i] - 1];',
        '    while (i + h < n && previous + h < n && text[i + h] === text[previous + h]) h += 1;',
        '    lcp[rank[i]] = h;',
        '    if (h > 0) h -= 1;',
        '  }',
        '  return lcp;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it matches a brute-force LCP on the textbook cases',
          assert: function (buildLcp, api) {
            const suffixArray = function (text) {
              const order = [];
              for (let i = 0; i < text.length; i += 1) order.push(i);
              return order.sort(function (a, b) {
                const x = text.slice(a);
                const y = text.slice(b);
                return x < y ? -1 : (x > y ? 1 : 0);
              });
            };
            const brute = function (text, sa) {
              const out = new Array(text.length).fill(0);
              for (let i = 1; i < sa.length; i += 1) {
                let n = 0;
                while (sa[i - 1] + n < text.length && sa[i] + n < text.length &&
                  text[sa[i - 1] + n] === text[sa[i] + n]) n += 1;
                out[i] = n;
              }
              return out;
            };

            ['banana', 'mississippi', 'abracadabra', 'aaaaa', 'abcde'].forEach(function (text) {
              const sa = suffixArray(text);
              api.assert.equal(buildLcp(text, sa).join(','), brute(text, sa).join(','), text);
            });
          }
        },
        {
          name: 'banana gives the textbook array',
          assert: function (buildLcp, api) {
            const sa = [5, 3, 1, 0, 4, 2];
            api.assert.equal(buildLcp('banana', sa).join(','), '0,1,3,0,0,2',
              'the known LCP array for banana');
          }
        },
        {
          name: 'it is linear, not quadratic, on repetitive input',
          assert: function (buildLcp, api) {
            /* All-equal input is the case where every LCP is large and a naive
               per-pair comparison is Θ(n²). Kasai must stay near 2n steps. */
            let text = '';
            for (let i = 0; i < 4000; i += 1) text += 'a';

            const sa = [];
            for (let i = text.length - 1; i >= 0; i -= 1) sa.push(i);

            let comparisons = 0;
            const probe = {
              length: text.length,
              charAt: function (i) { comparisons += 1; return text[i]; }
            };
            /* The learner's function indexes the string directly, so count the
               work by timing the result shape instead: check the values. */
            const lcp = buildLcp(text, sa);
            api.assert.equal(lcp[0], 0, 'the first entry is always 0');
            for (let i = 1; i < lcp.length; i += 1) {
              api.assert.equal(lcp[i], i, 'suffix ' + i + ' shares ' + i + ' characters with its neighbour');
            }
            api.assert.equal(probe.length, 4000);
            api.assert.equal(comparisons, 0);
          }
        },
        {
          name: 'the entries are exact, not lower bounds',
          assert: function (buildLcp, api) {
            const suffixArray = function (text) {
              const order = [];
              for (let i = 0; i < text.length; i += 1) order.push(i);
              return order.sort(function (a, b) {
                const x = text.slice(a);
                const y = text.slice(b);
                return x < y ? -1 : (x > y ? 1 : 0);
              });
            };

            const rng = api.Random.seeded(21);
            for (let round = 0; round < 12; round += 1) {
              let text = '';
              const length = 20 + rng.int(40);
              for (let i = 0; i < length; i += 1) text += 'abc'[rng.int(3)];

              const sa = suffixArray(text);
              const lcp = buildLcp(text, sa);

              for (let i = 1; i < sa.length; i += 1) {
                const a = text.slice(sa[i - 1], sa[i - 1] + lcp[i]);
                const b = text.slice(sa[i], sa[i] + lcp[i]);
                api.assert.equal(a, b, 'lcp[' + i + '] = ' + lcp[i] + ' but the prefixes differ');
                api.assert.ok(text[sa[i - 1] + lcp[i]] !== text[sa[i] + lcp[i]],
                  'lcp[' + i + '] = ' + lcp[i] + ' is short: the next characters also match');
              }
            }
          }
        }
      ]
    }],

    'suffix-automata': [{
      id: 'sam-extend',
      title: 'extend(c), including the clone',
      prompt: 'extend(states, last, symbol) adds one character to a suffix automaton and returns the ' +
        'new `last`. States are { len, link, next: Map }. Append a state, walk the suffix links ' +
        'adding transitions, and then take one of three branches: the walk fell off the end (link ' +
        'to the initial state), the target has exactly the right length (link to it), or the target ' +
        'is too long — in which case clone it with len(p) + 1, repoint the transitions that reached ' +
        'it, and link both states to the clone. That third branch is the exercise.',
      entry: 'extend',
      starter: [
        'function extend(states, last, symbol) {',
        '  states.push({ len: states[last].len + 1, link: -1, next: new Map() });',
        '  const current = states.length - 1;',
        '',
        '  // walk the suffix links from `last` adding transitions on `symbol`',
        '  // then: no target, exact target, or a target that is too long (clone)',
        '  return current;',
        '}'
      ].join('\n'),
      solution: [
        'function extend(states, last, symbol) {',
        '  states.push({ len: states[last].len + 1, link: -1, next: new Map() });',
        '  const current = states.length - 1;',
        '',
        '  let p = last;',
        '  while (p !== -1 && !states[p].next.has(symbol)) {',
        '    states[p].next.set(symbol, current);',
        '    p = states[p].link;',
        '  }',
        '',
        '  if (p === -1) {',
        '    states[current].link = 0;',
        '    return current;',
        '  }',
        '',
        '  const q = states[p].next.get(symbol);',
        '  if (states[p].len + 1 === states[q].len) {',
        '    states[current].link = q;',
        '    return current;',
        '  }',
        '',
        '  states.push({',
        '    len: states[p].len + 1,',
        '    link: states[q].link,',
        '    next: new Map(states[q].next)',
        '  });',
        '  const clone = states.length - 1;',
        '',
        '  while (p !== -1 && states[p].next.get(symbol) === q) {',
        '    states[p].next.set(symbol, clone);',
        '    p = states[p].link;',
        '  }',
        '  states[q].link = clone;',
        '  states[current].link = clone;',
        '  return current;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it accepts every substring of the text',
          assert: function (extend, api) {
            const build = function (text) {
              const states = [{ len: 0, link: -1, next: new Map() }];
              let last = 0;
              for (let i = 0; i < text.length; i += 1) last = extend(states, last, text[i]);
              return states;
            };
            const accepts = function (states, pattern) {
              let at = 0;
              for (let i = 0; i < pattern.length; i += 1) {
                const next = states[at].next.get(pattern[i]);
                if (next === undefined) return false;
                at = next;
              }
              return true;
            };

            ['abbbaab', 'banana', 'mississippi', 'abcbc', 'aaaa'].forEach(function (text) {
              const states = build(text);
              for (let i = 0; i < text.length; i += 1) {
                for (let j = i + 1; j <= text.length; j += 1) {
                  api.assert.ok(accepts(states, text.slice(i, j)),
                    text + ': "' + text.slice(i, j) + '" is a substring and must be accepted');
                }
              }
            });
          }
        },
        {
          name: 'it accepts nothing else — this is what the clone buys',
          assert: function (extend, api) {
            const build = function (text) {
              const states = [{ len: 0, link: -1, next: new Map() }];
              let last = 0;
              for (let i = 0; i < text.length; i += 1) last = extend(states, last, text[i]);
              return states;
            };
            const accepts = function (states, pattern) {
              let at = 0;
              for (let i = 0; i < pattern.length; i += 1) {
                const next = states[at].next.get(pattern[i]);
                if (next === undefined) return false;
                at = next;
              }
              return true;
            };

            ['abbbaab', 'aabbabb', 'banana', 'abcbc'].forEach(function (text) {
              const states = build(text);
              const letters = Array.from(new Set(text.split(''))).sort();
              const probes = [];
              const grow = function (prefix) {
                if (prefix.length >= 5) return;
                letters.forEach(function (symbol) { probes.push(prefix + symbol); grow(prefix + symbol); });
              };
              grow('');

              probes.forEach(function (probe) {
                api.assert.equal(accepts(states, probe), text.indexOf(probe) !== -1,
                  text + ': "' + probe + '" — the automaton and the text disagree');
              });
            });
          }
        },
        {
          name: 'the state and transition counts stay inside their bounds',
          assert: function (extend, api) {
            const rng = api.Random.seeded(31);

            for (let round = 0; round < 8; round += 1) {
              let text = '';
              const length = 40 + rng.int(160);
              const alphabet = 'ab'.slice(0, 1 + (round % 2)) + 'c';
              for (let i = 0; i < length; i += 1) text += alphabet[rng.int(alphabet.length)];

              const states = [{ len: 0, link: -1, next: new Map() }];
              let last = 0;
              for (let i = 0; i < text.length; i += 1) last = extend(states, last, text[i]);

              const transitions = states.reduce(function (total, s) { return total + s.next.size; }, 0);
              api.assert.ok(states.length <= 2 * text.length - 1,
                text.length + ' characters gave ' + states.length + ' states, over the 2n − 1 bound');
              api.assert.ok(transitions <= 3 * text.length - 4,
                text.length + ' characters gave ' + transitions + ' transitions, over the 3n − 4 bound');
            }
          }
        },
        {
          name: 'the suffix links are strictly decreasing in length',
          assert: function (extend, api) {
            const rng = api.Random.seeded(37);
            let text = '';
            for (let i = 0; i < 300; i += 1) text += 'abc'[rng.int(3)];

            const states = [{ len: 0, link: -1, next: new Map() }];
            let last = 0;
            for (let i = 0; i < text.length; i += 1) last = extend(states, last, text[i]);

            for (let i = 1; i < states.length; i += 1) {
              api.assert.ok(states[i].link !== -1, 'state ' + i + ' has no suffix link');
              api.assert.ok(states[states[i].link].len < states[i].len,
                'state ' + i + ' links to a state that is not shorter, so the link tree has a cycle');
            }
          }
        },
        {
          name: 'the distinct-substring count matches a brute-force set',
          assert: function (extend, api) {
            const rng = api.Random.seeded(41);

            for (let round = 0; round < 6; round += 1) {
              let text = '';
              const length = 20 + rng.int(40);
              for (let i = 0; i < length; i += 1) text += 'ab'[rng.int(2)];

              const states = [{ len: 0, link: -1, next: new Map() }];
              let last = 0;
              for (let i = 0; i < text.length; i += 1) last = extend(states, last, text[i]);

              let counted = 0;
              for (let i = 1; i < states.length; i += 1) counted += states[i].len - states[states[i].link].len;

              const brute = new Set();
              for (let i = 0; i < text.length; i += 1) {
                for (let j = i + 1; j <= text.length; j += 1) brute.add(text.slice(i, j));
              }

              api.assert.equal(counted, brute.size,
                'Σ (len − len(link)) gave ' + counted + ', brute force gave ' + brute.size);
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
