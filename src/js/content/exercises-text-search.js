/**
 * Graded exercises for the index and search sections (M06.7-M06.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'burrows-wheeler': [{
      id: 'inverse-bwt',
      title: 'Inverting the transform with LF-mapping',
      prompt: 'inverseBwt(last) recovers the original text from the transform\'s last column. The ' +
        'sentinel is "$" and it sorts before every other character. Build the count table C[c], ' +
        'walk LF from row 0, and read the last column at each row. Read the character *then* step: ' +
        'stepping first drops the final character and shifts everything by one, which is the ' +
        'off-by-one this exercise exists for. Do not build the rotation matrix — it is O(n²) and ' +
        'the tests use inputs where that matters.',
      entry: 'inverseBwt',
      starter: [
        'function inverseBwt(last) {',
        '  // C[c] = how many characters sort strictly before c',
        '  // rank(c, i) = occurrences of c in last[0 .. i)',
        '  // LF(row) = C[last[row]] + rank(last[row], row)',
        '  return "";',
        '}'
      ].join('\n'),
      solution: [
        'function inverseBwt(last) {',
        '  const n = last.length;',
        '  const tally = new Map();',
        '  for (let i = 0; i < n; i += 1) tally.set(last[i], (tally.get(last[i]) || 0) + 1);',
        '',
        '  const symbols = Array.from(tally.keys()).sort();',
        '  const before = new Map();',
        '  let sum = 0;',
        '  symbols.forEach(function (symbol) { before.set(symbol, sum); sum += tally.get(symbol); });',
        '',
        '  /* rank(c, i) for every row, in one pass, so the walk is linear. */',
        '  const running = new Map();',
        '  const rank = new Array(n).fill(0);',
        '  for (let i = 0; i < n; i += 1) {',
        '    const seen = running.get(last[i]) || 0;',
        '    rank[i] = seen;',
        '    running.set(last[i], seen + 1);',
        '  }',
        '',
        '  const out = new Array(n - 1);',
        '  let row = 0;',
        '  for (let i = n - 2; i >= 0; i -= 1) {',
        '    out[i] = last[row];',
        '    row = before.get(last[row]) + rank[row];',
        '  }',
        '  return out.join("");',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it round-trips the textbook cases',
          assert: function (inverseBwt, api) {
            const transform = function (input) {
              const text = input + '$';
              const rotations = [];
              for (let i = 0; i < text.length; i += 1) rotations.push(text.slice(i) + text.slice(0, i));
              rotations.sort();
              return rotations.map(function (row) { return row[row.length - 1]; }).join('');
            };

            ['banana', 'mississippi', 'abracadabra', 'a', 'ab'].forEach(function (input) {
              const last = transform(input);
              api.assert.equal(inverseBwt(last), input,
                input + ': transform is "' + last + '" and it did not round-trip');
            });
          }
        },
        {
          name: 'the last character is not dropped',
          assert: function (inverseBwt, api) {
            /* The classic failure: stepping LF before reading loses the final
               character and shifts the rest, which is invisible on a
               palindrome and obvious here. */
            const transform = function (input) {
              const text = input + '$';
              const rotations = [];
              for (let i = 0; i < text.length; i += 1) rotations.push(text.slice(i) + text.slice(0, i));
              rotations.sort();
              return rotations.map(function (row) { return row[row.length - 1]; }).join('');
            };

            ['abcdef', 'xyzzy', 'hello'].forEach(function (input) {
              const recovered = inverseBwt(transform(input));
              api.assert.equal(recovered.length, input.length,
                input + ': recovered ' + recovered.length + ' characters of ' + input.length);
              api.assert.equal(recovered[recovered.length - 1], input[input.length - 1],
                input + ': the final character is wrong — read before stepping, not after');
              api.assert.equal(recovered, input);
            });
          }
        },
        {
          name: 'repeated characters and long runs are handled',
          assert: function (inverseBwt, api) {
            const transform = function (input) {
              const text = input + '$';
              const rotations = [];
              for (let i = 0; i < text.length; i += 1) rotations.push(text.slice(i) + text.slice(0, i));
              rotations.sort();
              return rotations.map(function (row) { return row[row.length - 1]; }).join('');
            };

            let run = '';
            for (let i = 0; i < 60; i += 1) run += 'a';
            api.assert.equal(inverseBwt(transform(run)), run, '60 copies of one character');

            let alternating = '';
            for (let i = 0; i < 40; i += 1) alternating += i % 2 ? 'b' : 'a';
            api.assert.equal(inverseBwt(transform(alternating)), alternating, 'abab…');

            api.assert.equal(inverseBwt(transform('aaabbbaaa')), 'aaabbbaaa');
          }
        },
        {
          name: 'it is linear, so a large input finishes',
          assert: function (inverseBwt, api) {
            /* 20 000 characters. A rank query answered by scanning is O(n) per
               step and makes this Θ(n²) — about 400 million character reads. */
            const rng = api.Random.seeded(13);
            let input = '';
            for (let i = 0; i < 20000; i += 1) input += 'acgt'[rng.int(4)];

            const text = input + '$';
            const order = [];
            for (let i = 0; i < text.length; i += 1) order.push(i);
            order.sort(function (a, b) {
              const x = text.slice(a);
              const y = text.slice(b);
              return x < y ? -1 : (x > y ? 1 : 0);
            });
            const last = order.map(function (at) {
              return text[(at - 1 + text.length) % text.length];
            }).join('');

            api.assert.equal(inverseBwt(last), input, '20 000 characters must round-trip');
          }
        }
      ]
    }],

    'inverted-indexes': [{
      id: 'galloping-intersect',
      title: 'Galloping intersection',
      prompt: 'gallop(a, b) intersects two sorted, strictly increasing arrays of document ids. Take ' +
        'the shorter list as the driver, and for each of its elements find the target in the longer ' +
        'one by probing 1, 2, 4, 8 … positions ahead and then binary-searching the bracket. Carry ' +
        'the cursor forward between targets — restarting from the beginning is correct and throws ' +
        'away the whole advantage. The result must be sorted and must equal a linear merge.',
      entry: 'gallop',
      starter: [
        'function gallop(a, b) {',
        '  const short = a.length <= b.length ? a : b;',
        '  const long = a.length <= b.length ? b : a;',
        '  const out = [];',
        '  // for each target in short: probe exponentially into long, then binary search',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function gallop(a, b) {',
        '  const short = a.length <= b.length ? a : b;',
        '  const long = a.length <= b.length ? b : a;',
        '  const out = [];',
        '  let at = 0;',
        '',
        '  short.forEach(function (target) {',
        '    if (at >= long.length) return;',
        '',
        '    let step = 1;',
        '    let low = at;',
        '    while (low + step < long.length && long[low + step] < target) {',
        '      low += step;',
        '      step *= 2;',
        '    }',
        '',
        '    let high = Math.min(low + step, long.length - 1);',
        '    while (low <= high) {',
        '      const mid = (low + high) >> 1;',
        '      if (long[mid] === target) { out.push(target); low = mid + 1; break; }',
        '      if (long[mid] < target) low = mid + 1;',
        '      else high = mid - 1;',
        '    }',
        '    at = low;',
        '  });',
        '',
        '  return out.sort(function (x, y) { return x - y; });',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with a linear merge at every skew',
          assert: function (gallop, api) {
            const merge = function (a, b) {
              const out = [];
              let i = 0;
              let j = 0;
              while (i < a.length && j < b.length) {
                if (a[i] === b[j]) { out.push(a[i]); i += 1; j += 1; continue; }
                if (a[i] < b[j]) i += 1;
                else j += 1;
              }
              return out;
            };

            const rng = api.Random.seeded(17);
            [[10, 5000], [100, 5000], [1000, 5000], [2500, 5000], [5000, 5000]].forEach(function (pair) {
              const longSet = new Set();
              while (longSet.size < pair[1]) longSet.add(rng.int(20000));
              const shortSet = new Set();
              while (shortSet.size < pair[0]) shortSet.add(rng.int(20000));

              const long = Array.from(longSet).sort(function (a, b) { return a - b; });
              const short = Array.from(shortSet).sort(function (a, b) { return a - b; });

              api.assert.equal(gallop(short, long).join(','), merge(short, long).join(','),
                pair[0] + ' against ' + pair[1]);
              api.assert.equal(gallop(long, short).join(','), merge(short, long).join(','),
                'and with the arguments the other way round');
            });
          }
        },
        {
          name: 'the edge cases are handled',
          assert: function (gallop, api) {
            api.assert.equal(gallop([], [1, 2, 3]).length, 0, 'an empty list intersects to nothing');
            api.assert.equal(gallop([1, 2, 3], []).length, 0, 'either way round');
            api.assert.equal(gallop([1, 2, 3], [1, 2, 3]).join(','), '1,2,3', 'identical lists');
            api.assert.equal(gallop([1, 3, 5], [2, 4, 6]).length, 0, 'disjoint lists');
            api.assert.equal(gallop([5], [1, 2, 3, 4, 5]).join(','), '5',
              'a single element at the very end of the long list');
            api.assert.equal(gallop([1], [1, 2, 3, 4, 5]).join(','), '1',
              'and at the very start');
          }
        },
        {
          name: 'it beats a linear merge by an order of magnitude at high skew',
          assert: function (gallop, api) {
            /* Wrap the long list in a counting proxy so the reads are visible.
               A linear merge reads about 100 000 entries; galloping should
               read a few hundred. */
            const rng = api.Random.seeded(19);
            const long = [];
            for (let i = 0; i < 100000; i += 1) long.push(i * 2);
            const shortSet = new Set();
            while (shortSet.size < 20) shortSet.add(rng.int(200000));
            const short = Array.from(shortSet).sort(function (a, b) { return a - b; });

            let reads = 0;
            const watched = new Proxy(long, {
              get: function (target, key) {
                if (typeof key === 'string' && /^[0-9]+$/.test(key)) reads += 1;
                return target[key];
              }
            });

            const result = gallop(short, watched);
            const expected = short.filter(function (value) { return value % 2 === 0; });
            api.assert.equal(result.join(','), expected.join(','), 'the result must still be correct');
            api.assert.ok(reads < 2000,
              'read ' + reads + ' entries of the 100 000-entry list; galloping 20 targets should ' +
              'read a few hundred, and a linear walk would read about 100 000');
          }
        },
        {
          name: 'the cursor carries forward between targets',
          assert: function (gallop, api) {
            /* Every target is near the end. Restarting the probe from 0 each
               time is correct and does log(n) work per target from scratch;
               carrying the cursor makes the later probes trivial. */
            const long = [];
            for (let i = 0; i < 50000; i += 1) long.push(i);
            const short = [];
            for (let i = 49000; i < 49100; i += 1) short.push(i);

            let reads = 0;
            const watched = new Proxy(long, {
              get: function (target, key) {
                if (typeof key === 'string' && /^[0-9]+$/.test(key)) reads += 1;
                return target[key];
              }
            });

            api.assert.equal(gallop(short, watched).length, 100, 'all 100 targets are present');
            api.assert.ok(reads < 1200,
              'read ' + reads + ' entries for 100 consecutive targets; carrying the cursor should ' +
              'make every probe after the first almost free');
          }
        }
      ]
    }],

    'autocomplete-and-fuzzy': [{
      id: 'bk-tree',
      title: 'BK-tree insert and bounded query',
      prompt: 'buildBkTree(words) returns { search }. Each node keys its children by their edit ' +
        'distance to it, and search(query, k) descends only into children keyed between ' +
        'd(query, node) − k and d(query, node) + k — the triangle inequality proves the rest cannot ' +
        'hold a match. distance(a, b) is given. The result must equal a brute-force scan exactly, ' +
        'and the visit count must be well below the dictionary size, or the pruning is not working.',
      entry: 'buildBkTree',
      starter: [
        'function distance(a, b) {',
        '  if (a === b) return 0;',
        '  let previous = [];',
        '  for (let j = 0; j <= b.length; j += 1) previous.push(j);',
        '  for (let i = 1; i <= a.length; i += 1) {',
        '    const current = [i];',
        '    for (let j = 1; j <= b.length; j += 1) {',
        '      const cost = a[i - 1] === b[j - 1] ? 0 : 1;',
        '      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));',
        '    }',
        '    previous = current;',
        '  }',
        '  return previous[b.length];',
        '}',
        '',
        'function buildBkTree(words) {',
        '  let root = null;',
        '  let visits = 0;',
        '',
        '  // insert each word: descend by d(word, node) until that key is free',
        '',
        '  return {',
        '    search: function (query, k) { return []; },',
        '    visits: function () { return visits; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function distance(a, b) {',
        '  if (a === b) return 0;',
        '  let previous = [];',
        '  for (let j = 0; j <= b.length; j += 1) previous.push(j);',
        '  for (let i = 1; i <= a.length; i += 1) {',
        '    const current = [i];',
        '    for (let j = 1; j <= b.length; j += 1) {',
        '      const cost = a[i - 1] === b[j - 1] ? 0 : 1;',
        '      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));',
        '    }',
        '    previous = current;',
        '  }',
        '  return previous[b.length];',
        '}',
        '',
        'function buildBkTree(words) {',
        '  let root = null;',
        '  let visits = 0;',
        '',
        '  words.forEach(function (word) {',
        '    if (!root) { root = { word: word, children: new Map() }; return; }',
        '    let node = root;',
        '    for (;;) {',
        '      const d = distance(word, node.word);',
        '      if (d === 0) return;',
        '      const child = node.children.get(d);',
        '      if (!child) { node.children.set(d, { word: word, children: new Map() }); return; }',
        '      node = child;',
        '    }',
        '  });',
        '',
        '  return {',
        '    search: function (query, k) {',
        '      const out = [];',
        '      if (!root) return out;',
        '      const stack = [root];',
        '',
        '      while (stack.length) {',
        '        const node = stack.pop();',
        '        visits += 1;',
        '        const d = distance(query, node.word);',
        '        if (d <= k) out.push(node.word);',
        '        node.children.forEach(function (child, key) {',
        '          if (key >= d - k && key <= d + k) stack.push(child);',
        '        });',
        '      }',
        '      return out.sort();',
        '    },',
        '    visits: function () { return visits; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the result equals brute force at every budget',
          assert: function (buildBkTree, api) {
            const words = ('able about above accept access account across act action active add ' +
              'address admit adopt adult cat cats car card care cart can cane cast cost cut cup ' +
              'hat hate have head hear heat help here hill hit hold hole home hope hot hour house')
              .split(' ');

            const edit = function (a, b) {
              let previous = [];
              for (let j = 0; j <= b.length; j += 1) previous.push(j);
              for (let i = 1; i <= a.length; i += 1) {
                const current = [i];
                for (let j = 1; j <= b.length; j += 1) {
                  const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                  current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));
                }
                previous = current;
              }
              return previous[b.length];
            };

            const tree = buildBkTree(words);
            ['cat', 'hot', 'acces', 'adress', 'zzz'].forEach(function (query) {
              [0, 1, 2].forEach(function (k) {
                const expected = words.filter(function (w) { return edit(query, w) <= k; }).sort();
                api.assert.equal(tree.search(query, k).join(','), expected.join(','),
                  '"' + query + '" at budget ' + k);
              });
            });
          }
        },
        {
          name: 'the pruning actually prunes',
          assert: function (buildBkTree, api) {
            const rng = api.Random.seeded(23);
            const words = [];
            const seen = new Set();
            while (seen.size < 1200) {
              let word = '';
              const length = 4 + rng.int(5);
              for (let i = 0; i < length; i += 1) word += 'abcdefghij'[rng.int(10)];
              if (!seen.has(word)) { seen.add(word); words.push(word); }
            }

            const tree = buildBkTree(words);
            const before = tree.visits();
            tree.search(words[0], 1);
            const visited = tree.visits() - before;

            api.assert.ok(visited < words.length,
              'a distance-1 query visited ' + visited + ' of ' + words.length +
              ' nodes; without pruning it would visit all of them');
          }
        },
        {
          name: 'a budget of 0 finds exactly the exact match',
          assert: function (buildBkTree, api) {
            const words = ['cat', 'cats', 'cast', 'car', 'dog', 'dogs'];
            const tree = buildBkTree(words);

            api.assert.equal(tree.search('cat', 0).join(','), 'cat', 'only the word itself');
            api.assert.equal(tree.search('cot', 0).length, 0, 'a near miss at budget 0 is a miss');
            api.assert.equal(tree.search('cot', 1).join(','), 'cat', 'and a hit at budget 1');
          }
        },
        {
          name: 'duplicates and a single-word dictionary work',
          assert: function (buildBkTree, api) {
            const tree = buildBkTree(['cat', 'cat', 'cat']);
            api.assert.equal(tree.search('cat', 0).join(','), 'cat', 'a duplicate is not a second node');
            api.assert.equal(tree.search('cot', 1).join(','), 'cat');

            const one = buildBkTree(['solitary']);
            api.assert.equal(one.search('solitary', 0).join(','), 'solitary');
            api.assert.equal(one.search('nothing', 2).length, 0);

            const none = buildBkTree([]);
            api.assert.equal(none.search('anything', 3).length, 0, 'an empty dictionary returns nothing');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
