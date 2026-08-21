/**
 * Graded exercises for the first four dynamic-programming sections (M12.1-M12.4).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'what-dp-is': [{
      id: 'memoise-and-count',
      title: 'memoise a recursion, and report what the memo actually holds',
      prompt: 'countPaths(rows, columns, blocked) must return { paths, states }: the number of monotone ' +
        'lattice paths from (0, 0) to (rows, columns) moving only right and down, and the number of ' +
        'DISTINCT states the computation stored. `blocked` is an array of "r,c" strings that may not be ' +
        'entered. The starter recurses correctly and remembers nothing, so it recomputes the same cell an ' +
        'exponential number of times and reports its call count as its state count. Add a memo keyed on ' +
        'the cell, and make `states` the number of distinct keys stored — not the number of calls. The ' +
        'grader checks both: the paths against known values, and the state count against the analytical ' +
        'prediction of (rows + 1)(columns + 1) minus the blocked cells the recursion never reaches.',
      entry: 'countPaths',
      starter: [
        'function countPaths(rows, columns, blocked) {',
        '  const walls = new Set(blocked || []);',
        '  let calls = 0;',
        '',
        '  function go(r, c) {',
        '    calls += 1;',
        '    if (walls.has(r + "," + c)) return 0;',
        '    if (r === 0 && c === 0) return 1;',
        '    let total = 0;',
        '    if (r > 0) total += go(r - 1, c);',
        '    if (c > 0) total += go(r, c - 1);',
        '    return total;',
        '  }',
        '',
        '  // no memo: every cell is recomputed once per path that reaches it,',
        '  // and "states" is really a call count',
        '  const paths = go(rows, columns);',
        '  return { paths: paths, states: calls };',
        '}'
      ].join('\n'),
      solution: [
        'function countPaths(rows, columns, blocked) {',
        '  const walls = new Set(blocked || []);',
        '  const memo = new Map();',
        '',
        '  function go(r, c) {',
        '    const key = r + "," + c;',
        '    if (memo.has(key)) return memo.get(key);',
        '    let value;',
        '    if (walls.has(key)) value = 0;',
        '    else if (r === 0 && c === 0) value = 1;',
        '    else {',
        '      value = 0;',
        '      if (r > 0) value += go(r - 1, c);',
        '      if (c > 0) value += go(r, c - 1);',
        '    }',
        '    memo.set(key, value);',
        '    return value;',
        '  }',
        '',
        '  const paths = go(rows, columns);',
        '  return { paths: paths, states: memo.size };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the path counts are the binomial coefficients on an open grid',
          assert: function (countPaths, api) {
            api.assert.equal(countPaths(0, 0, []).paths, 1, '1 x 1 grid');
            api.assert.equal(countPaths(1, 1, []).paths, 2, '2 x 2 grid');
            api.assert.equal(countPaths(2, 2, []).paths, 6, 'C(4,2)');
            api.assert.equal(countPaths(5, 5, []).paths, 252, 'C(10,5)');
            api.assert.equal(countPaths(3, 7, []).paths, 120, 'C(10,3)');
          }
        },
        {
          name: 'blocked cells are respected',
          assert: function (countPaths, api) {
            api.assert.equal(countPaths(1, 1, ['0,1']).paths, 1, 'one route blocked of two');
            api.assert.equal(countPaths(2, 2, ['1,1']).paths, 2, 'the centre of a 3 x 3 removed');
            api.assert.equal(countPaths(2, 2, ['0,0']).paths, 0, 'the origin itself blocked');
            api.assert.equal(countPaths(3, 3, ['2,2', '1,3']).paths, 4, 'two cells removed from a 4 x 4');
          }
        },
        {
          name: 'the state count is the number of distinct cells, not the number of calls',
          assert: function (countPaths, api) {
            const small = countPaths(2, 2, []);
            api.assert.equal(small.states, 9, 'a 3 x 3 grid has 9 cells; got ' + small.states);

            const wide = countPaths(3, 7, []);
            api.assert.equal(wide.states, 32, 'a 4 x 8 grid has 32 cells; got ' + wide.states);

            const blockedRun = countPaths(5, 5, ['3,3']);
            api.assert.atMost(blockedRun.states, 36,
              'a 6 x 6 grid has 36 cells and cannot need more states; got ' + blockedRun.states);
          }
        },
        {
          name: 'the memo makes a large grid feasible at all',
          assert: function (countPaths, api) {
            const run = countPaths(12, 12, []);
            api.assert.equal(run.paths, 2704156, 'C(24,12)');
            api.assert.atMost(run.states, 169,
              'a 13 x 13 grid has 169 cells; an unmemoised run reports millions. Got ' + run.states);

            const bigger = countPaths(14, 14, []);
            api.assert.equal(bigger.paths, 40116600, 'C(28,14)');
            api.assert.atMost(bigger.states, 225, 'a 15 x 15 grid has 225 cells; got ' + bigger.states);
          }
        }
      ]
    }],

    'one-dimensional-dp': [{
      id: 'lis-with-reconstruction',
      title: 'longest increasing subsequence, with the subsequence',
      prompt: 'longestIncreasing(values) must return { length, sequence }: the length of a longest strictly ' +
        'increasing subsequence and one such subsequence itself. Use patience sorting so the cost is ' +
        'O(n log n) — maintain an array of pile tops and binary-search the insertion point. The catch is ' +
        'the reconstruction: the pile-tops array is increasing and exactly the right length and is usually ' +
        'NOT a subsequence of the input, which is what the starter returns. Record, for each value, which ' +
        'index sat on top of the pile to its left, and walk those links backwards from the last pile. The ' +
        'grader checks the length, checks the result really is a subsequence of the input, and checks it ' +
        'is strictly increasing.',
      entry: 'longestIncreasing',
      starter: [
        'function longestIncreasing(values) {',
        '  const tails = [];',
        '',
        '  for (let i = 0; i < values.length; i += 1) {',
        '    let low = 0;',
        '    let high = tails.length;',
        '    while (low < high) {',
        '      const mid = (low + high) >> 1;',
        '      if (tails[mid] < values[i]) low = mid + 1;',
        '      else high = mid;',
        '    }',
        '    tails[low] = values[i];',
        '  }',
        '',
        '  // the pile tops are increasing and the right length — and they are',
        '  // not, in general, a subsequence of the input',
        '  return { length: tails.length, sequence: tails.slice() };',
        '}'
      ].join('\n'),
      solution: [
        'function longestIncreasing(values) {',
        '  const tails = [];',
        '  const tailIndex = [];',
        '  const previous = new Array(values.length).fill(-1);',
        '',
        '  for (let i = 0; i < values.length; i += 1) {',
        '    let low = 0;',
        '    let high = tails.length;',
        '    while (low < high) {',
        '      const mid = (low + high) >> 1;',
        '      if (tails[mid] < values[i]) low = mid + 1;',
        '      else high = mid;',
        '    }',
        '    if (low > 0) previous[i] = tailIndex[low - 1];',
        '    tails[low] = values[i];',
        '    tailIndex[low] = i;',
        '  }',
        '',
        '  const out = [];',
        '  let at = tails.length ? tailIndex[tails.length - 1] : -1;',
        '  while (at !== -1) { out.push(values[at]); at = previous[at]; }',
        '  out.reverse();',
        '  return { length: tails.length, sequence: out };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the length is right on the standard cases',
          assert: function (longestIncreasing, api) {
            api.assert.equal(longestIncreasing([]).length, 0, 'empty');
            api.assert.equal(longestIncreasing([7]).length, 1, 'one element');
            api.assert.equal(longestIncreasing([10, 9, 2, 5, 3, 7, 101, 18]).length, 4, 'the classic case');
            api.assert.equal(longestIncreasing([5, 4, 3, 2, 1]).length, 1, 'strictly decreasing');
            api.assert.equal(longestIncreasing([1, 2, 3, 4, 5]).length, 5, 'already sorted');
            api.assert.equal(longestIncreasing([2, 2, 2, 2]).length, 1, 'all equal — STRICTLY increasing');
          }
        },
        {
          name: 'the returned sequence is a genuine subsequence of the input',
          assert: function (longestIncreasing, api) {
            const cases = [[10, 9, 2, 5, 3, 7, 101, 18], [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
              [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13]];

            cases.forEach(function (values, which) {
              const run = longestIncreasing(values);
              let at = 0;
              values.forEach(function (value) {
                if (at < run.sequence.length && run.sequence[at] === value) at += 1;
              });
              api.assert.equal(at, run.sequence.length,
                'case ' + which + ': the returned values are not a subsequence of the input');
            });
          }
        },
        {
          name: 'the returned sequence is strictly increasing and has the reported length',
          assert: function (longestIncreasing, api) {
            const cases = [[10, 9, 2, 5, 3, 7, 101, 18], [5, 4, 3, 2, 1], [1], [],
              [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13]];

            cases.forEach(function (values, which) {
              const run = longestIncreasing(values);
              api.assert.equal(run.sequence.length, run.length, 'case ' + which + ': length disagrees');

              for (let i = 1; i < run.sequence.length; i += 1) {
                api.assert.ok(run.sequence[i] > run.sequence[i - 1],
                  'case ' + which + ': not strictly increasing at index ' + i);
              }
            });
          }
        },
        {
          name: 'it agrees with an exhaustive search on small random inputs',
          assert: function (longestIncreasing, api) {
            for (let trial = 0; trial < 12; trial += 1) {
              const values = [];

              for (let i = 0; i < 12; i += 1) values.push(api.rng.int(9));
              let best = 0;

              for (let mask = 0; mask < 4096; mask += 1) {
                const picked = [];

                for (let bit = 0; bit < 12; bit += 1) {
                  if (mask & (1 << bit)) picked.push(values[bit]);
                }
                let increasing = true;

                for (let i = 1; i < picked.length; i += 1) {
                  if (picked[i] > picked[i - 1]) continue;
                  increasing = false;
                  break;
                }

                if (increasing && picked.length > best) best = picked.length;
              }
              api.assert.equal(longestIncreasing(values).length, best,
                'trial ' + trial + ' on [' + values.join(',') + ']');
            }
          }
        }
      ]
    }],

    'knapsack-family': [{
      id: 'bounded-binary-splitting',
      title: 'bounded knapsack by binary splitting',
      prompt: 'boundedKnapsack(items, capacity) must return { value, bundles }: the best total value when ' +
        'each item may be taken up to `item.count` times, and how many 0/1 items your expansion produced. ' +
        'The starter expands every copy separately, which is correct and turns an item with 200 copies ' +
        'into 200 rows. Replace it with binary splitting: bundle 1, 2, 4, 8, … copies plus a remainder, so ' +
        'any count from 0 to `count` is a subset of ⌊log2(count)⌋ + 1 bundles. The value must not change; ' +
        'the bundle count must drop logarithmically. The grader checks the value against exhaustive ' +
        'enumeration and checks the bundle count against the logarithmic bound.',
      entry: 'boundedKnapsack',
      starter: [
        'function boundedKnapsack(items, capacity) {',
        '  const expanded = [];',
        '',
        '  // one 0/1 item per copy: correct, and linear in the count',
        '  items.forEach(function (item) {',
        '    for (let copy = 0; copy < item.count; copy += 1) {',
        '      expanded.push({ value: item.value, weight: item.weight });',
        '    }',
        '  });',
        '',
        '  const best = new Array(capacity + 1).fill(0);',
        '  expanded.forEach(function (item) {',
        '    for (let c = capacity; c >= item.weight; c -= 1) {',
        '      const take = best[c - item.weight] + item.value;',
        '      if (take > best[c]) best[c] = take;',
        '    }',
        '  });',
        '',
        '  return { value: best[capacity], bundles: expanded.length };',
        '}'
      ].join('\n'),
      solution: [
        'function boundedKnapsack(items, capacity) {',
        '  const bundles = [];',
        '',
        '  // 1, 2, 4, ... copies plus the remainder: every count in [0, k] is',
        '  // representable as a subset of these',
        '  items.forEach(function (item) {',
        '    let left = item.count;',
        '    let size = 1;',
        '    while (left > 0) {',
        '      const take = Math.min(size, left);',
        '      bundles.push({ value: item.value * take, weight: item.weight * take });',
        '      left -= take;',
        '      size *= 2;',
        '    }',
        '  });',
        '',
        '  const best = new Array(capacity + 1).fill(0);',
        '  bundles.forEach(function (item) {',
        '    for (let c = capacity; c >= item.weight; c -= 1) {',
        '      const take = best[c - item.weight] + item.value;',
        '      if (take > best[c]) best[c] = take;',
        '    }',
        '  });',
        '',
        '  return { value: best[capacity], bundles: bundles.length };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the value matches exhaustive enumeration on small instances',
          assert: function (boundedKnapsack, api) {
            function exhaustive(items, capacity) {
              let best = 0;

              function go(index, room, value) {
                if (index === items.length) { best = Math.max(best, value); return; }

                for (let take = 0; take <= items[index].count; take += 1) {
                  const weight = take * items[index].weight;

                  if (weight > room) break;
                  go(index + 1, room - weight, value + take * items[index].value);
                }
              }
              go(0, capacity, 0);
              return best;
            }

            for (let trial = 0; trial < 8; trial += 1) {
              const items = [];

              for (let i = 0; i < 4; i += 1) {
                items.push({ value: 1 + api.rng.int(20), weight: 1 + api.rng.int(9),
                  count: 1 + api.rng.int(5) });
              }
              const capacity = 10 + api.rng.int(20);
              api.assert.equal(boundedKnapsack(items, capacity).value, exhaustive(items, capacity),
                'trial ' + trial);
            }
          }
        },
        {
          name: 'a single item type with many copies is bundled logarithmically',
          assert: function (boundedKnapsack, api) {
            const run = boundedKnapsack([{ value: 3, weight: 2, count: 200 }], 100);
            api.assert.equal(run.value, 150, '50 copies of a weight-2 item worth 3 each');
            api.assert.atMost(run.bundles, 8,
              '200 copies need at most 8 bundles (1+2+4+...+128 covers it); got ' + run.bundles);
          }
        },
        {
          name: 'every count is still representable, so the value never drops',
          assert: function (boundedKnapsack, api) {
            // one item of weight 1 and count k: taking exactly the capacity must be possible
            for (let count = 1; count <= 40; count += 1) {
              const run = boundedKnapsack([{ value: 1, weight: 1, count: count }], count);
              api.assert.equal(run.value, count,
                'count ' + count + ': every number of copies from 0 to ' + count + ' must be reachable');
            }
            const mixed = boundedKnapsack([{ value: 7, weight: 3, count: 11 }], 33);
            api.assert.equal(mixed.value, 77, 'exactly 11 copies of a weight-3 item at capacity 33');
          }
        },
        {
          name: 'the bundle count is logarithmic across several item types',
          assert: function (boundedKnapsack, api) {
            const items = [{ value: 5, weight: 3, count: 100 }, { value: 9, weight: 4, count: 100 },
              { value: 2, weight: 1, count: 100 }];
            const run = boundedKnapsack(items, 60);
            api.assert.atMost(run.bundles, 24,
              'three item types of 100 copies need at most 7 bundles each; full expansion gives 300. Got ' +
                run.bundles);
            api.assert.atLeast(run.value, 1,
              'the expansion must still be able to fill the sack; got ' + run.value);

            const single = boundedKnapsack([{ value: 1, weight: 1, count: 1 }], 1);
            api.assert.equal(single.bundles, 1, 'a single copy is a single bundle');
          }
        }
      ]
    }],

    'sequence-alignment': [{
      id: 'hirschberg-alignment',
      title: "Hirschberg's algorithm: the alignment in linear space",
      prompt: 'align(a, b) must return { distance, top, bottom }: the unit-cost edit distance and an ' +
        'alignment of the two strings, where `top` is `a` with "-" inserted and `bottom` is `b` with "-" ' +
        'inserted. Do it in O(min(|a|, |b|)) space using Hirschberg\'s divide and conquer — compute the ' +
        'last DP row forwards over the top half and backwards over the bottom half, find the column ' +
        'minimising their sum, and recurse on the two halves. The starter computes the distance with two ' +
        'rows, which is correct, and then returns the two strings padded with gaps at the end, which is ' +
        'not an alignment of them. The grader strips the gaps from each row and demands the inputs back, ' +
        'checks the rows are the same length, checks no column is a gap against a gap, and checks the ' +
        'alignment\'s own cost equals the reported distance.',
      entry: 'align',
      starter: [
        'function align(a, b) {',
        '  function lastRow(x, y) {',
        '    let previous = [];',
        '    for (let j = 0; j <= y.length; j += 1) previous.push(j);',
        '    for (let i = 1; i <= x.length; i += 1) {',
        '      const current = [i];',
        '      for (let j = 1; j <= y.length; j += 1) {',
        '        const same = x[i - 1] === y[j - 1];',
        '        current.push(Math.min(previous[j] + 1, current[j - 1] + 1,',
        '          previous[j - 1] + (same ? 0 : 1)));',
        '      }',
        '      previous = current;',
        '    }',
        '    return previous;',
        '  }',
        '',
        '  const distance = lastRow(a, b)[b.length];',
        '',
        '  // the distance is right; there is no table left to walk backwards',
        '  // through, so this pads instead of aligning',
        '  const width = Math.max(a.length, b.length);',
        '  return {',
        '    distance: distance,',
        '    top: a + "-".repeat(width - a.length),',
        '    bottom: b + "-".repeat(width - b.length)',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function align(a, b) {',
        '  function lastRow(x, y) {',
        '    let previous = [];',
        '    for (let j = 0; j <= y.length; j += 1) previous.push(j);',
        '    for (let i = 1; i <= x.length; i += 1) {',
        '      const current = [i];',
        '      for (let j = 1; j <= y.length; j += 1) {',
        '        const same = x[i - 1] === y[j - 1];',
        '        current.push(Math.min(previous[j] + 1, current[j - 1] + 1,',
        '          previous[j - 1] + (same ? 0 : 1)));',
        '      }',
        '      previous = current;',
        '    }',
        '    return previous;',
        '  }',
        '',
        '  function reverse(text) { return text.split("").reverse().join(""); }',
        '',
        '  function small(x, y) {',
        '    if (x.length === 0) return { top: "-".repeat(y.length), bottom: y };',
        '    if (y.length === 0) return { top: x, bottom: "-".repeat(x.length) };',
        '    // x is one character: place it where it matches, else substitute at 0',
        '    let at = y.indexOf(x);',
        '    if (at === -1) at = 0;',
        '    return {',
        '      top: "-".repeat(at) + x + "-".repeat(y.length - at - 1),',
        '      bottom: y',
        '    };',
        '  }',
        '',
        '  function go(x, y) {',
        '    if (x.length <= 1 || y.length === 0) return small(x, y);',
        '    const mid = Math.floor(x.length / 2);',
        '    const forward = lastRow(x.slice(0, mid), y);',
        '    const backward = lastRow(reverse(x.slice(mid)), reverse(y));',
        '    let bestAt = 0;',
        '    let bestCost = Infinity;',
        '    for (let j = 0; j <= y.length; j += 1) {',
        '      const total = forward[j] + backward[y.length - j];',
        '      if (total >= bestCost) continue;',
        '      bestCost = total;',
        '      bestAt = j;',
        '    }',
        '    const left = go(x.slice(0, mid), y.slice(0, bestAt));',
        '    const right = go(x.slice(mid), y.slice(bestAt));',
        '    return { top: left.top + right.top, bottom: left.bottom + right.bottom };',
        '  }',
        '',
        '  const alignment = go(a, b);',
        '  return { distance: lastRow(a, b)[b.length], top: alignment.top, bottom: alignment.bottom };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the distance is right',
          assert: function (align, api) {
            api.assert.equal(align('kitten', 'sitting').distance, 3, 'kitten / sitting');
            api.assert.equal(align('', '').distance, 0, 'both empty');
            api.assert.equal(align('abc', '').distance, 3, 'one empty');
            api.assert.equal(align('', 'abcd').distance, 4, 'the other empty');
            api.assert.equal(align('same', 'same').distance, 0, 'identical');
            api.assert.equal(align('intention', 'execution').distance, 5, 'intention / execution');
          }
        },
        {
          name: 'the rows strip back to the two inputs',
          assert: function (align, api) {
            const cases = [['kitten', 'sitting'], ['intention', 'execution'], ['abc', ''],
              ['', 'abcd'], ['same', 'same'], ['a', 'b'], ['abcabba', 'cbabac']];

            cases.forEach(function (pair) {
              const run = align(pair[0], pair[1]);
              api.assert.equal(run.top.split('-').join(''), pair[0],
                'the top row of ' + pair[0] + '/' + pair[1] + ' does not strip to the first input');
              api.assert.equal(run.bottom.split('-').join(''), pair[1],
                'the bottom row of ' + pair[0] + '/' + pair[1] + ' does not strip to the second input');
            });
          }
        },
        {
          name: 'the rows are the same length and no column is a gap against a gap',
          assert: function (align, api) {
            const cases = [['kitten', 'sitting'], ['intention', 'execution'], ['abcabba', 'cbabac'],
              ['aaa', 'aaaaaa'], ['xyz', 'abc']];

            cases.forEach(function (pair) {
              const run = align(pair[0], pair[1]);
              api.assert.equal(run.top.length, run.bottom.length,
                pair[0] + '/' + pair[1] + ': rows differ in length');

              for (let i = 0; i < run.top.length; i += 1) {
                api.assert.ok(!(run.top[i] === '-' && run.bottom[i] === '-'),
                  pair[0] + '/' + pair[1] + ': column ' + i + ' is a gap against a gap');
              }
            });
          }
        },
        {
          name: "the alignment's own cost equals the reported distance",
          assert: function (align, api) {
            const cases = [['kitten', 'sitting'], ['intention', 'execution'], ['abcabba', 'cbabac'],
              ['same', 'same'], ['abc', ''], ['aaa', 'aaaaaa']];

            cases.forEach(function (pair) {
              const run = align(pair[0], pair[1]);
              let cost = 0;

              for (let i = 0; i < run.top.length; i += 1) {
                if (run.top[i] === '-' || run.bottom[i] === '-') cost += 1;
                else if (run.top[i] !== run.bottom[i]) cost += 1;
              }
              api.assert.equal(cost, run.distance,
                pair[0] + '/' + pair[1] + ': the alignment costs ' + cost + ' and the distance is ' +
                  run.distance);
            });
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
