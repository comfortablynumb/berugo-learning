/**
 * Graded exercises for the naive matcher, KMP and the Z-algorithm (M15.1-M15.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'naive-matching': [{
      id: 'overlapping-occurrences',
      title: 'Every occurrence, including the overlapping ones',
      prompt: 'findAll(text, pattern) must return { positions, comparisons }: every start position ' +
        'where `pattern` occurs in `text`, ascending, plus the number of character comparisons the ' +
        'scan made. Overlapping occurrences count separately — "aa" occurs three times in "aaaa" — ' +
        'so after a successful match the scan advances by ONE, not by the pattern length. An empty ' +
        'pattern matches nowhere. The starter advances by the pattern length after a hit, which is ' +
        'invisible on English text and loses most of the answers on anything periodic.',
      entry: 'findAll',
      starter: [
        'function findAll(text, pattern) {',
        '  const positions = [];',
        '  let comparisons = 0;',
        '  if (pattern.length === 0) return { positions: positions, comparisons: comparisons };',
        '',
        '  let start = 0;',
        '  while (start + pattern.length <= text.length) {',
        '    let i = 0;',
        '    while (i < pattern.length) {',
        '      comparisons += 1;',
        '      if (text[start + i] !== pattern[i]) break;',
        '      i += 1;',
        '    }',
        '    if (i === pattern.length) {',
        '      positions.push(start);',
        '      // skip past the whole match, so nothing is reported twice',
        '      start += pattern.length;',
        '      continue;',
        '    }',
        '    start += 1;',
        '  }',
        '  return { positions: positions, comparisons: comparisons };',
        '}'
      ].join('\n'),
      solution: [
        'function findAll(text, pattern) {',
        '  const positions = [];',
        '  let comparisons = 0;',
        '  if (pattern.length === 0) return { positions: positions, comparisons: comparisons };',
        '',
        '  for (let start = 0; start + pattern.length <= text.length; start += 1) {',
        '    let i = 0;',
        '    while (i < pattern.length) {',
        '      comparisons += 1;',
        '      if (text[start + i] !== pattern[i]) break;',
        '      i += 1;',
        '    }',
        '    if (i < pattern.length) continue;',
        '    // advance by one: an occurrence may start inside the previous one',
        '    positions.push(start);',
        '  }',
        '  return { positions: positions, comparisons: comparisons };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'overlapping occurrences are all reported',
          assert: function (findAll, api) {
            api.assert.deepEqual(findAll('aaaa', 'aa').positions, [0, 1, 2],
              '"aa" occurs three times in "aaaa"; advancing by the pattern length finds two');
            api.assert.deepEqual(findAll('aaaaaaa', 'aaa').positions, [0, 1, 2, 3, 4],
              'five overlapping occurrences of a three-character pattern in seven characters');
            api.assert.deepEqual(findAll('abababab', 'abab').positions, [0, 2, 4],
              'a periodic pattern overlaps itself at every period');
          }
        },
        {
          name: 'the positions match an independent scan on random text',
          assert: function (findAll, api) {
            function reference(text, pattern) {
              const out = [];

              if (pattern.length === 0) return out;

              for (let start = 0; start + pattern.length <= text.length; start += 1) {
                if (text.substr(start, pattern.length) !== pattern) continue;
                out.push(start);
              }
              return out;
            }

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = trial % 2 === 0 ? 'ab' : 'abcdef';
              let text = '';
              let pattern = '';

              for (let i = 0; i < 30 + api.rng.int(30); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }

              for (let i = 0; i < 1 + api.rng.int(4); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(findAll(text, pattern).positions, reference(text, pattern),
                'trial ' + trial + ' over a ' + alphabet.length + '-letter alphabet');
            }
          }
        },
        {
          name: 'an empty pattern matches nowhere, and a pattern longer than the text matches nowhere',
          assert: function (findAll, api) {
            api.assert.deepEqual(findAll('abc', '').positions, [], 'an empty pattern has no occurrences');
            api.assert.deepEqual(findAll('ab', 'abc').positions, [],
              'a pattern longer than the text cannot occur');
            api.assert.deepEqual(findAll('', 'a').positions, [], 'an empty text contains nothing');
            api.assert.equal(findAll('abc', '').comparisons, 0,
              'and the empty case must not compare anything');
          }
        },
        {
          name: 'the comparison count reaches n·m on the adversarial input',
          assert: function (findAll, api) {
            const n = 200;
            const m = 8;
            const text = 'a'.repeat(n);
            const pattern = 'a'.repeat(m - 1) + 'b';
            const got = findAll(text, pattern);

            api.assert.deepEqual(got.positions, [], 'the pattern does not occur');
            api.assert.equal(got.comparisons, (n - m + 1) * m,
              'every alignment runs to the full pattern length: ' + ((n - m + 1) * m) +
                ' comparisons, not ' + got.comparisons);
          }
        }
      ]
    }],

    'kmp-prefix-function': [{
      id: 'prefix-function-and-period',
      title: 'The border array, and the period it hands you',
      prompt: 'analyse(pattern) must return { border, period, isPower, repetitions }: the prefix ' +
        'function of the pattern as an array, the smallest period, whether the pattern is an exact ' +
        'repetition, and how many copies if it is. `border[i]` is the length of the longest PROPER ' +
        'prefix of `pattern[0..i]` that is also a suffix of it. The period is `n − border[n−1]`, ' +
        'and the pattern is an exact power exactly when that divides `n` AND is shorter than it — ' +
        'a period equal to the length is the trivial one-copy case and is not a power. The ' +
        'construction is one ' +
        'left-to-right pass whose inner loop walks the chain of borders-of-borders; the starter ' +
        'walks it only one step, which is right for most positions and wrong for the ones that ' +
        'matter.',
      entry: 'analyse',
      starter: [
        'function analyse(pattern) {',
        '  const n = pattern.length;',
        '  const border = new Array(n).fill(0);',
        '  let length = 0;',
        '',
        '  for (let i = 1; i < n; i += 1) {',
        '    // one step back on a mismatch, which is usually enough',
        '    if (length > 0 && pattern[i] !== pattern[length]) length = border[length - 1];',
        '    if (pattern[i] === pattern[length]) length += 1;',
        '    else length = 0;',
        '    border[i] = length;',
        '  }',
        '',
        '  if (n === 0) return { border: border, period: 0, isPower: true, repetitions: 0 };',
        '  const period = n - border[n - 1];',
        '  const power = period < n && n % period === 0;',
        '  return { border: border, period: period, isPower: power,',
        '    repetitions: power ? n / period : 1 };',
        '}'
      ].join('\n'),
      solution: [
        'function analyse(pattern) {',
        '  const n = pattern.length;',
        '  const border = new Array(n).fill(0);',
        '  let length = 0;',
        '',
        '  for (let i = 1; i < n; i += 1) {',
        '    // walk the whole chain: the border of a border is also a candidate',
        '    while (length > 0 && pattern[i] !== pattern[length]) length = border[length - 1];',
        '    if (pattern[i] === pattern[length]) length += 1;',
        '    border[i] = length;',
        '  }',
        '',
        '  if (n === 0) return { border: border, period: 0, isPower: true, repetitions: 0 };',
        '  const period = n - border[n - 1];',
        '  const power = period < n && n % period === 0;',
        '  return { border: border, period: period, isPower: power,',
        '    repetitions: power ? n / period : 1 };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the array matches a definition-by-definition computation',
          assert: function (analyse, api) {
            function reference(pattern) {
              const out = [];

              for (let i = 0; i < pattern.length; i += 1) {
                const prefix = pattern.slice(0, i + 1);
                let best = 0;

                for (let length = i; length >= 1; length -= 1) {
                  if (prefix.slice(0, length) !== prefix.slice(prefix.length - length)) continue;
                  best = length;
                  break;
                }
                out.push(best);
              }
              return out;
            }
            const fixed = ['ababcabab', 'aabaaab', 'aaaa', 'abcdef', 'abaababaabaab',
              'aabaabaaa', 'abacabadaba'];

            fixed.forEach(function (pattern) {
              api.assert.deepEqual(analyse(pattern).border, reference(pattern),
                'the border array of "' + pattern + '"');
            });

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = trial % 2 === 0 ? 'ab' : 'abc';
              let pattern = '';

              for (let i = 0; i < 1 + api.rng.int(20); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(analyse(pattern).border, reference(pattern),
                'trial ' + trial + ': "' + pattern + '"');
            }
          }
        },
        {
          name: 'the period is a real period, and the smallest one',
          assert: function (analyse, api) {
            function holds(pattern, p) {
              for (let i = 0; i + p < pattern.length; i += 1) {
                if (pattern[i] === pattern[i + p]) continue;
                return false;
              }
              return true;
            }

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = trial % 3 === 0 ? 'ab' : 'abc';
              let pattern = '';

              for (let i = 0; i < 2 + api.rng.int(18); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              const got = analyse(pattern);

              api.assert.ok(holds(pattern, got.period),
                '"' + pattern + '": ' + got.period + ' is not a period at all');

              for (let p = 1; p < got.period; p += 1) {
                api.assert.ok(!holds(pattern, p),
                  '"' + pattern + '": ' + p + ' is a smaller period than the reported ' + got.period);
              }
            }
          }
        },
        {
          name: 'exact powers are recognised and near-powers are not',
          assert: function (analyse, api) {
            const powers = [['abcabcabcabc', 3, 4], ['aaaaaa', 1, 6], ['abab', 2, 2],
              ['xyxyxyxy', 2, 4], ['abcabc', 3, 2]];

            powers.forEach(function (entry) {
              const got = analyse(entry[0]);

              api.assert.equal(got.period, entry[1], '"' + entry[0] + '" has period ' + entry[1]);
              api.assert.equal(got.isPower, true, '"' + entry[0] + '" is an exact power');
              api.assert.equal(got.repetitions, entry[2],
                '"' + entry[0] + '" is ' + entry[2] + ' copies');
            });
            ['abcabcabd', 'aaaaab', 'ababac', 'abcabca'].forEach(function (pattern) {
              api.assert.equal(analyse(pattern).isPower, false,
                '"' + pattern + '" is one character away from a power and is not one');
            });
          }
        },
        {
          name: 'a Fibonacci word, where the chain has to be walked more than one step',
          assert: function (analyse, api) {
            let previous = 'a';
            let current = 'ab';

            for (let step = 2; step < 8; step += 1) {
              const next = current + previous;

              previous = current;
              current = next;
            }
            const got = analyse(current);

            api.assert.equal(current.length, 34, 'this Fibonacci word has 34 characters');
            api.assert.equal(got.border[33], 13,
              'its longest border is 13, a Fibonacci number; one step back down the chain is not enough');
            api.assert.equal(got.period, 21, 'so its smallest period is 34 − 13 = 21');
            api.assert.equal(got.isPower, false, 'and 21 does not divide 34');
          }
        }
      ]
    }],

    'z-algorithm': [{
      id: 'z-array-window',
      title: 'The window that never moves left',
      prompt: 'zArray(text) must return { z, comparisons }: the Z-array of the string, where `z[i]` ' +
        'is the length of the longest common prefix of `text` and `text[i..]`, plus the number of ' +
        'character comparisons made. By convention `z[0]` is the whole length. Keep the interval ' +
        '`[l, r]` that reaches furthest right and is known to equal a prefix; a position inside it ' +
        'starts from `min(r − i, z[i − l])` rather than from zero, and only the extension past `r` ' +
        'costs comparisons. The starter forgets the `min` and copies the mirror outright, which is ' +
        'correct whenever the mirror is short and wrong exactly when it reaches the edge.',
      entry: 'zArray',
      starter: [
        'function zArray(text) {',
        '  const n = text.length;',
        '  const z = new Array(n).fill(0);',
        '  let comparisons = 0;',
        '  if (n === 0) return { z: z, comparisons: comparisons };',
        '  z[0] = n;',
        '  let left = 0;',
        '  let right = 0;',
        '',
        '  for (let i = 1; i < n; i += 1) {',
        '    // inside the window, the mirror already knows the answer',
        '    if (i < right) z[i] = z[i - left];',
        '    while (i + z[i] < n && text[z[i]] === text[i + z[i]]) {',
        '      comparisons += 1;',
        '      z[i] += 1;',
        '    }',
        '    if (i + z[i] < n) comparisons += 1;',
        '    if (i + z[i] > right) { left = i; right = i + z[i]; }',
        '  }',
        '  return { z: z, comparisons: comparisons };',
        '}'
      ].join('\n'),
      solution: [
        'function zArray(text) {',
        '  const n = text.length;',
        '  const z = new Array(n).fill(0);',
        '  let comparisons = 0;',
        '  if (n === 0) return { z: z, comparisons: comparisons };',
        '  z[0] = n;',
        '  let left = 0;',
        '  let right = 0;',
        '',
        '  for (let i = 1; i < n; i += 1) {',
        '    // the mirror is only trustworthy as far as the window reaches',
        '    if (i < right) z[i] = Math.min(right - i, z[i - left]);',
        '    while (i + z[i] < n && text[z[i]] === text[i + z[i]]) {',
        '      comparisons += 1;',
        '      z[i] += 1;',
        '    }',
        '    if (i + z[i] < n) comparisons += 1;',
        '    if (i + z[i] > right) { left = i; right = i + z[i]; }',
        '  }',
        '  return { z: z, comparisons: comparisons };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the array matches a definition-by-definition computation',
          assert: function (zArray, api) {
            function reference(text) {
              const n = text.length;
              const out = new Array(n).fill(0);

              if (n === 0) return out;
              out[0] = n;

              for (let i = 1; i < n; i += 1) {
                let length = 0;

                while (i + length < n && text[length] === text[i + length]) length += 1;
                out[i] = length;
              }
              return out;
            }
            ['aabxaabxcaabxaabxay', 'aaaaa', 'abacaba', 'abcdef', 'aabaabaab',
              'abababab', ''].forEach(function (text) {
              api.assert.deepEqual(zArray(text).z, reference(text), 'the Z-array of "' + text + '"');
            });

            for (let trial = 0; trial < 50; trial += 1) {
              const alphabet = trial % 3 === 0 ? 'a' : (trial % 3 === 1 ? 'ab' : 'abc');
              let text = '';

              for (let i = 0; i < 1 + api.rng.int(25); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(zArray(text).z, reference(text),
                'trial ' + trial + ': "' + text + '"');
            }
          }
        },
        {
          name: 'the comparison count stays linear, which is what the window is for',
          assert: function (zArray, api) {
            [200, 400, 800].forEach(function (n) {
              const text = 'a'.repeat(n);
              const got = zArray(text);

              api.assert.equal(got.z[1], n - 1, 'z[1] on a run of a\'s is n − 1');
              api.assert.ok(got.comparisons <= 2 * n,
                n + ' characters cost ' + got.comparisons + ' comparisons; the bound is ' +
                  (2 * n) + '. Copying the mirror without the min makes this quadratic');
            });
            const nested = 'aabaabaabaabaabaabaabaabaabaabaabaab';
            const run = zArray(nested);

            api.assert.ok(run.comparisons <= 2 * nested.length,
              'a periodic string is the case the min protects: ' + run.comparisons +
                ' comparisons against a bound of ' + (2 * nested.length));
          }
        },
        {
          name: 'matching by concatenation finds exactly the occurrences',
          assert: function (zArray, api) {
            function occurrences(text, pattern) {
              const out = [];

              for (let start = 0; start + pattern.length <= text.length; start += 1) {
                if (text.substr(start, pattern.length) !== pattern) continue;
                out.push(start);
              }
              return out;
            }

            for (let trial = 0; trial < 30; trial += 1) {
              const alphabet = trial % 2 === 0 ? 'ab' : 'abc';
              let text = '';
              let pattern = '';

              for (let i = 0; i < 30 + api.rng.int(20); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }

              for (let i = 0; i < 1 + api.rng.int(4); i += 1) {
                pattern += alphabet[api.rng.int(alphabet.length)];
              }
              const joined = pattern + '' + text;
              const z = zArray(joined).z;
              const found = [];

              for (let i = pattern.length + 1; i < joined.length; i += 1) {
                if (z[i] < pattern.length) continue;
                found.push(i - pattern.length - 1);
              }
              api.assert.deepEqual(found, occurrences(text, pattern),
                'trial ' + trial + ': pattern "' + pattern + '"');
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
