/**
 * Graded exercises for Boyer-Moore, rolling hashes and Aho-Corasick (M15.4-M15.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'boyer-moore': [{
      id: 'bad-character-shift',
      title: 'The bad-character rule, and the shift that must never be zero',
      prompt: 'horspool(text, pattern) must return { positions, comparisons }: every occurrence of ' +
        '`pattern` in `text`, ascending, plus the character comparisons made. Build a shift table ' +
        'from the pattern — for each character, how far the pattern must slide when that character ' +
        'is aligned with the pattern\'s LAST position — then compare each alignment right to left ' +
        'and slide by the table entry for `text[start + m − 1]`, or by the full pattern length when ' +
        'that character is absent. The trap is the pattern\'s own last character: it must NOT be in ' +
        'the table, because its entry would be 0 and the scan would never advance. The starter ' +
        'includes it and hangs on any text containing it.',
      entry: 'horspool',
      starter: [
        'function horspool(text, pattern) {',
        '  const positions = [];',
        '  let comparisons = 0;',
        '  const m = pattern.length;',
        '  if (m === 0 || m > text.length) return { positions: positions, comparisons: comparisons };',
        '',
        '  const shift = {};',
        '  // every character of the pattern, including the last one',
        '  for (let i = 0; i < m; i += 1) shift[pattern[i]] = m - 1 - i;',
        '',
        '  let start = 0;',
        '  let steps = 0;',
        '  while (start + m <= text.length) {',
        '    steps += 1;',
        '    if (steps > 4 * text.length) break;   // a guard, not a fix',
        '    let j = m - 1;',
        '    while (j >= 0) {',
        '      comparisons += 1;',
        '      if (text[start + j] !== pattern[j]) break;',
        '      j -= 1;',
        '    }',
        '    if (j < 0) positions.push(start);',
        '    const symbol = text[start + m - 1];',
        '    start += shift[symbol] === undefined ? m : shift[symbol];',
        '  }',
        '  return { positions: positions, comparisons: comparisons };',
        '}'
      ].join('\n'),
      solution: [
        'function horspool(text, pattern) {',
        '  const positions = [];',
        '  let comparisons = 0;',
        '  const m = pattern.length;',
        '  if (m === 0 || m > text.length) return { positions: positions, comparisons: comparisons };',
        '',
        '  const shift = {};',
        '  // every character EXCEPT the last: its entry would be 0 and stall the scan',
        '  for (let i = 0; i < m - 1; i += 1) shift[pattern[i]] = m - 1 - i;',
        '',
        '  let start = 0;',
        '  while (start + m <= text.length) {',
        '    let j = m - 1;',
        '    while (j >= 0) {',
        '      comparisons += 1;',
        '      if (text[start + j] !== pattern[j]) break;',
        '      j -= 1;',
        '    }',
        '    if (j < 0) positions.push(start);',
        '    const symbol = text[start + m - 1];',
        '    start += shift[symbol] === undefined ? m : shift[symbol];',
        '  }',
        '  return { positions: positions, comparisons: comparisons };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the positions match an independent scan, including overlaps',
          assert: function (horspool, api) {
            function reference(text, pattern) {
              const out = [];

              if (pattern.length === 0 || pattern.length > text.length) return out;

              for (let start = 0; start + pattern.length <= text.length; start += 1) {
                if (text.substr(start, pattern.length) !== pattern) continue;
                out.push(start);
              }
              return out;
            }
            api.assert.deepEqual(horspool('aaaa', 'aa').positions, [0, 1, 2],
              'overlapping occurrences count separately');

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = trial % 2 === 0 ? 'ab' : 'abcdef';
              let text = '';
              let pattern = '';

              for (let i = 0; i < 40 + api.rng.int(30); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }

              for (let i = 0; i < 1 + api.rng.int(5); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(horspool(text, pattern).positions, reference(text, pattern),
                'trial ' + trial + ': pattern "' + pattern + '"');
            }
          }
        },
        {
          name: 'the scan terminates on a text made of the pattern\'s last character',
          assert: function (horspool, api) {
            const got = horspool('aaaaaaaaaaaaaaaaaaaa', 'baa');

            api.assert.deepEqual(got.positions, [],
              '"baa" does not occur in a run of a\'s — but the shift for "a" must not be 0, ' +
                'or the scan never advances past the first alignment');
            const second = horspool('xxxxxxxxxxxxxxxxxxxx', 'yx');

            api.assert.deepEqual(second.positions, [],
              'the same trap with a two-character pattern');
            const third = horspool('abababababababab', 'bab');

            api.assert.deepEqual(third.positions, [1, 3, 5, 7, 9, 11, 13],
              'and it must still find every occurrence when the last character does recur');
          }
        },
        {
          name: 'it examines fewer characters than the text length on natural-looking input',
          assert: function (horspool, api) {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz ';
            let text = '';

            for (let i = 0; i < 4000; i += 1) text += alphabet[api.rng.int(alphabet.length)];
            const pattern = 'qzjxvk';
            const got = horspool(text, pattern);

            api.assert.deepEqual(got.positions, [],
              'a six-letter pattern of rare letters is very unlikely to occur');
            api.assert.ok(got.comparisons < text.length,
              'skipping should examine fewer than ' + text.length + ' characters; it examined ' +
                got.comparisons + '. A shift of 1 everywhere means the table is not being used');
          }
        }
      ]
    }],

    'rolling-hashes': [{
      id: 'rolling-window',
      title: 'The rolling update, and the verification that keeps it correct',
      prompt: 'rabinKarp(text, pattern, base, modulus) must return { positions, hits, comparisons }: ' +
        'the occurrences of `pattern`, the number of windows whose fingerprint matched the ' +
        'pattern\'s, and the character comparisons made. Compute the pattern\'s hash and the first ' +
        'window\'s, then roll: subtract the leading term, multiply by the base, add the new ' +
        'character, all modulo `modulus`. On a fingerprint match, VERIFY character by character — a ' +
        'hit is not an occurrence. The starter reports every hit as an occurrence, which is right ' +
        'at a large modulus and wrong at a small one, so it passes casual testing and fails on ' +
        'exactly the input that makes the algorithm interesting.',
      entry: 'rabinKarp',
      starter: [
        'function rabinKarp(text, pattern, base, modulus) {',
        '  const positions = [];',
        '  let hits = 0;',
        '  let comparisons = 0;',
        '  const m = pattern.length;',
        '  if (m === 0 || m > text.length) {',
        '    return { positions: positions, hits: hits, comparisons: comparisons };',
        '  }',
        '',
        '  let lead = 1;',
        '  for (let i = 0; i < m - 1; i += 1) lead = (lead * base) % modulus;',
        '  let target = 0;',
        '  let window = 0;',
        '  for (let i = 0; i < m; i += 1) {',
        '    target = (target * base + pattern.charCodeAt(i)) % modulus;',
        '    window = (window * base + text.charCodeAt(i)) % modulus;',
        '  }',
        '',
        '  for (let start = 0; start + m <= text.length; start += 1) {',
        '    if (window === target) {',
        '      hits += 1;',
        '      // the fingerprints agree, so the strings agree',
        '      positions.push(start);',
        '    }',
        '    if (start + m >= text.length) break;',
        '    let next = (window - text.charCodeAt(start) * lead) % modulus;',
        '    next = (next * base + text.charCodeAt(start + m)) % modulus;',
        '    window = next < 0 ? next + modulus : next;',
        '  }',
        '  return { positions: positions, hits: hits, comparisons: comparisons };',
        '}'
      ].join('\n'),
      solution: [
        'function rabinKarp(text, pattern, base, modulus) {',
        '  const positions = [];',
        '  let hits = 0;',
        '  let comparisons = 0;',
        '  const m = pattern.length;',
        '  if (m === 0 || m > text.length) {',
        '    return { positions: positions, hits: hits, comparisons: comparisons };',
        '  }',
        '',
        '  let lead = 1;',
        '  for (let i = 0; i < m - 1; i += 1) lead = (lead * base) % modulus;',
        '  let target = 0;',
        '  let window = 0;',
        '  for (let i = 0; i < m; i += 1) {',
        '    target = (target * base + pattern.charCodeAt(i)) % modulus;',
        '    window = (window * base + text.charCodeAt(i)) % modulus;',
        '  }',
        '',
        '  for (let start = 0; start + m <= text.length; start += 1) {',
        '    if (window === target) {',
        '      hits += 1;',
        '      // a hit is a filter result; the characters decide',
        '      let i = 0;',
        '      while (i < m) {',
        '        comparisons += 1;',
        '        if (text[start + i] !== pattern[i]) break;',
        '        i += 1;',
        '      }',
        '      if (i === m) positions.push(start);',
        '    }',
        '    if (start + m >= text.length) break;',
        '    let next = (window - text.charCodeAt(start) * lead) % modulus;',
        '    next = (next * base + text.charCodeAt(start + m)) % modulus;',
        '    window = next < 0 ? next + modulus : next;',
        '  }',
        '  return { positions: positions, hits: hits, comparisons: comparisons };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the occurrences are right at a large modulus',
          assert: function (rabinKarp, api) {
            function reference(text, pattern) {
              const out = [];

              for (let start = 0; start + pattern.length <= text.length; start += 1) {
                if (text.substr(start, pattern.length) !== pattern) continue;
                out.push(start);
              }
              return out;
            }

            for (let trial = 0; trial < 25; trial += 1) {
              const alphabet = 'abcdef';
              let text = '';
              let pattern = '';

              for (let i = 0; i < 60 + api.rng.int(40); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }

              for (let i = 0; i < 2 + api.rng.int(3); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(rabinKarp(text, pattern, 257, 1000003).positions,
                reference(text, pattern), 'trial ' + trial + ' at modulus 1 000 003');
            }
          }
        },
        {
          name: 'and they are still right at a modulus small enough to collide',
          assert: function (rabinKarp, api) {
            function reference(text, pattern) {
              const out = [];

              for (let start = 0; start + pattern.length <= text.length; start += 1) {
                if (text.substr(start, pattern.length) !== pattern) continue;
                out.push(start);
              }
              return out;
            }
            let collided = 0;

            for (let trial = 0; trial < 25; trial += 1) {
              const alphabet = 'abcdef';
              let text = '';
              let pattern = '';

              for (let i = 0; i < 200; i += 1) text += alphabet[api.rng.int(alphabet.length)];

              for (let i = 0; i < 3; i += 1) pattern += alphabet[api.rng.int(alphabet.length)];
              const truth = reference(text, pattern);
              const got = rabinKarp(text, pattern, 257, 31);

              api.assert.deepEqual(got.positions, truth,
                'trial ' + trial + ' at modulus 31: a hit is not an occurrence, and reporting ' +
                  'every hit gives ' + got.positions.length + ' positions against ' + truth.length);

              if (got.hits > truth.length) collided += 1;
            }
            api.assert.ok(collided > 0,
              'a modulus of 31 over 198 windows must produce spurious hits somewhere in 25 trials, ' +
                'or this test is not exercising the verification at all');
          }
        },
        {
          name: 'the rolling update matches a recomputed hash at every window',
          assert: function (rabinKarp, api) {
            function hashOf(text, start, length, base, modulus) {
              let value = 0;

              for (let i = 0; i < length; i += 1) {
                value = (value * base + text.charCodeAt(start + i)) % modulus;
              }
              return value;
            }
            const alphabet = 'abcde';

            for (let trial = 0; trial < 10; trial += 1) {
              let text = '';

              for (let i = 0; i < 120; i += 1) text += alphabet[api.rng.int(alphabet.length)];
              const m = 4;
              /* Search for each window in turn: the matcher must find it at that
                 position, which it can only do if the rolling hash is right there. */
              for (let start = 0; start + m <= text.length; start += 7) {
                const pattern = text.substr(start, m);
                const got = rabinKarp(text, pattern, 257, 1000003);

                api.assert.ok(got.positions.indexOf(start) !== -1,
                  'the window at ' + start + ' is "' + pattern +
                    '" and must be found there; a wrong rolling update misses it');
                api.assert.equal(hashOf(text, start, m, 257, 1000003),
                  hashOf(pattern, 0, m, 257, 1000003),
                  'the two hashes of the same string must agree');
              }
            }
          }
        }
      ]
    }],

    'aho-corasick': [{
      id: 'output-links',
      title: 'The output chain, and the matches that vanish without it',
      prompt: 'multiSearch(patterns, text) must return { matches, states }: every occurrence of ' +
        'every pattern as `{ pattern, start }` sorted by start then pattern index, and the number ' +
        'of automaton states. Build the trie, then the failure links by breadth-first search, then ' +
        'scan the text once. The part that matters is the reporting: when one pattern is a SUFFIX ' +
        'of another — "he" inside "she" — reaching the state for the longer one must also report ' +
        'the shorter, and nothing in the trie says so. Follow the chain of failure links from each ' +
        'state reached and report every pattern that ends along it. The starter reports only the ' +
        'state\'s own patterns, which finds everything except the nested ones.',
      entry: 'multiSearch',
      starter: [
        'function multiSearch(patterns, text) {',
        '  const states = [{ next: {}, fail: 0, ends: [] }];',
        '  patterns.forEach(function (pattern, id) {',
        '    let at = 0;',
        '    for (let i = 0; i < pattern.length; i += 1) {',
        '      if (states[at].next[pattern[i]] === undefined) {',
        '        states.push({ next: {}, fail: 0, ends: [] });',
        '        states[at].next[pattern[i]] = states.length - 1;',
        '      }',
        '      at = states[at].next[pattern[i]];',
        '    }',
        '    states[at].ends.push(id);',
        '  });',
        '',
        '  const queue = [];',
        '  Object.keys(states[0].next).forEach(function (symbol) {',
        '    const child = states[0].next[symbol];',
        '    states[child].fail = 0;',
        '    queue.push(child);',
        '  });',
        '  let head = 0;',
        '  while (head < queue.length) {',
        '    const at = queue[head];',
        '    head += 1;',
        '    Object.keys(states[at].next).forEach(function (symbol) {',
        '      const child = states[at].next[symbol];',
        '      let back = states[at].fail;',
        '      while (back !== 0 && states[back].next[symbol] === undefined) back = states[back].fail;',
        '      const target = states[back].next[symbol];',
        '      states[child].fail = target === undefined || target === child ? 0 : target;',
        '      queue.push(child);',
        '    });',
        '  }',
        '',
        '  const matches = [];',
        '  let at = 0;',
        '  for (let i = 0; i < text.length; i += 1) {',
        '    while (at !== 0 && states[at].next[text[i]] === undefined) at = states[at].fail;',
        '    at = states[at].next[text[i]] === undefined ? 0 : states[at].next[text[i]];',
        '    // report what this state ends, and nothing else',
        '    states[at].ends.forEach(function (id) {',
        '      matches.push({ pattern: id, start: i - patterns[id].length + 1 });',
        '    });',
        '  }',
        '  matches.sort(function (a, b) { return a.start - b.start || a.pattern - b.pattern; });',
        '  return { matches: matches, states: states.length };',
        '}'
      ].join('\n'),
      solution: [
        'function multiSearch(patterns, text) {',
        '  const states = [{ next: {}, fail: 0, ends: [] }];',
        '  patterns.forEach(function (pattern, id) {',
        '    let at = 0;',
        '    for (let i = 0; i < pattern.length; i += 1) {',
        '      if (states[at].next[pattern[i]] === undefined) {',
        '        states.push({ next: {}, fail: 0, ends: [] });',
        '        states[at].next[pattern[i]] = states.length - 1;',
        '      }',
        '      at = states[at].next[pattern[i]];',
        '    }',
        '    states[at].ends.push(id);',
        '  });',
        '',
        '  const queue = [];',
        '  Object.keys(states[0].next).forEach(function (symbol) {',
        '    const child = states[0].next[symbol];',
        '    states[child].fail = 0;',
        '    queue.push(child);',
        '  });',
        '  let head = 0;',
        '  while (head < queue.length) {',
        '    const at = queue[head];',
        '    head += 1;',
        '    Object.keys(states[at].next).forEach(function (symbol) {',
        '      const child = states[at].next[symbol];',
        '      let back = states[at].fail;',
        '      while (back !== 0 && states[back].next[symbol] === undefined) back = states[back].fail;',
        '      const target = states[back].next[symbol];',
        '      states[child].fail = target === undefined || target === child ? 0 : target;',
        '      queue.push(child);',
        '    });',
        '  }',
        '',
        '  const matches = [];',
        '  let at = 0;',
        '  for (let i = 0; i < text.length; i += 1) {',
        '    while (at !== 0 && states[at].next[text[i]] === undefined) at = states[at].fail;',
        '    at = states[at].next[text[i]] === undefined ? 0 : states[at].next[text[i]];',
        '    // walk the failure chain: every pattern ending along it also ends here',
        '    let link = at;',
        '    while (true) {',
        '      states[link].ends.forEach(function (id) {',
        '        matches.push({ pattern: id, start: i - patterns[id].length + 1 });',
        '      });',
        '      if (link === 0) break;',
        '      link = states[link].fail;',
        '    }',
        '  }',
        '  matches.sort(function (a, b) { return a.start - b.start || a.pattern - b.pattern; });',
        '  return { matches: matches, states: states.length };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the nested case: he inside she',
          assert: function (multiSearch, api) {
            const patterns = ['he', 'she', 'his', 'hers', 'her'];
            const got = multiSearch(patterns, 'ushers said he hushed his hers');
            const keys = got.matches.map(function (m) { return patterns[m.pattern] + '@' + m.start; });

            api.assert.ok(keys.indexOf('she@1') !== -1, '"she" occurs at position 1');
            api.assert.ok(keys.indexOf('he@2') !== -1,
              '"he" occurs at position 2, INSIDE "she" — and nothing in the trie says so. ' +
                'Only the failure chain reports it');
            api.assert.ok(keys.indexOf('hers@2') !== -1, '"hers" occurs at position 2');
            api.assert.ok(keys.indexOf('her@2') !== -1, '"her" occurs at position 2');
            api.assert.equal(got.matches.length, 11,
              'eleven occurrences in total; reporting only each state\'s own patterns gives nine');
          }
        },
        {
          name: 'the matches match a brute-force multi-pattern search',
          assert: function (multiSearch, api) {
            function reference(patterns, text) {
              const out = [];

              patterns.forEach(function (pattern, id) {
                if (pattern.length === 0) return;

                for (let start = 0; start + pattern.length <= text.length; start += 1) {
                  if (text.substr(start, pattern.length) !== pattern) continue;
                  out.push({ pattern: id, start: start });
                }
              });
              return out.sort(function (a, b) { return a.start - b.start || a.pattern - b.pattern; });
            }

            for (let trial = 0; trial < 30; trial += 1) {
              const alphabet = 'abc';
              const patterns = [];

              for (let p = 0; p < 1 + api.rng.int(5); p += 1) {
                let pattern = '';

                for (let i = 0; i < 1 + api.rng.int(4); i += 1) {
                  pattern += alphabet[api.rng.int(alphabet.length)];
                }

                if (patterns.indexOf(pattern) !== -1) continue;
                patterns.push(pattern);
              }
              let text = '';

              for (let i = 0; i < 40 + api.rng.int(30); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(multiSearch(patterns, text).matches, reference(patterns, text),
                'trial ' + trial + ' with patterns ' + JSON.stringify(patterns));
            }
          }
        },
        {
          name: 'nothing is reported twice, and the state count is the distinct-prefix count',
          assert: function (multiSearch, api) {
            const got = multiSearch(['ab', 'abc', 'abcd'], 'abcdabcd');
            const keys = got.matches.map(function (m) { return m.pattern + '@' + m.start; });
            const seen = {};

            keys.forEach(function (key) {
              api.assert.ok(!seen[key], 'match ' + key + ' is reported more than once');
              seen[key] = true;
            });
            api.assert.equal(got.matches.length, 6,
              'each of the three nested patterns occurs twice');
            api.assert.equal(got.states, 5,
              'the prefixes are "", a, ab, abc, abcd — five states, because the trie shares them');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
