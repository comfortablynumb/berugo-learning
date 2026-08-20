/**
 * Graded exercises for the sweep and batch paradigm sections (M11.7-M11.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'two-pointers': [{
      id: 'monotonic-sweeps',
      title: 'a deque and a stack, both bounded by 2n operations',
      prompt: 'sweepToolkit() must return { maxInWindow, largestRectangle }. maxInWindow(values, k) returns ' +
        '{ maxima, operations }: the maximum of every window of width k, and the number of pushes plus pops ' +
        'the structure performed. largestRectangle(heights) returns { area, operations }: the largest ' +
        'rectangle under the histogram, and the same counter. Both must use a monotonic structure — a deque ' +
        'of indices in decreasing value for the first, a stack of indices in non-decreasing height for the ' +
        'second — so that every index is pushed once and popped at most once. The graded property is the ' +
        'operation total: it must stay under 3n on every input shape, which is what rules out the rescanning ' +
        'solutions the starter uses.',
      entry: 'sweepToolkit',
      starter: [
        'function sweepToolkit() {',
        '  // correct, and it rescans the whole window every step',
        '  function maxInWindow(values, k) {',
        '    const maxima = [];',
        '    let operations = 0;',
        '    for (let i = 0; i + k <= values.length; i += 1) {',
        '      let best = -Infinity;',
        '      for (let j = i; j < i + k; j += 1) {',
        '        operations += 1;',
        '        if (values[j] > best) best = values[j];',
        '      }',
        '      maxima.push(best);',
        '    }',
        '    return { maxima: maxima, operations: operations };',
        '  }',
        '',
        '  // correct, and quadratic',
        '  function largestRectangle(heights) {',
        '    let area = 0;',
        '    let operations = 0;',
        '    for (let i = 0; i < heights.length; i += 1) {',
        '      let low = heights[i];',
        '      for (let j = i; j < heights.length; j += 1) {',
        '        operations += 1;',
        '        low = Math.min(low, heights[j]);',
        '        area = Math.max(area, low * (j - i + 1));',
        '      }',
        '    }',
        '    return { area: area, operations: operations };',
        '  }',
        '',
        '  return { maxInWindow: maxInWindow, largestRectangle: largestRectangle };',
        '}'
      ].join('\n'),
      solution: [
        'function sweepToolkit() {',
        '  // the deque holds indices whose values strictly decrease, so its front',
        '  // is the window maximum and nothing else has to be looked at',
        '  function maxInWindow(values, k) {',
        '    const deque = [];',
        '    const maxima = [];',
        '    let operations = 0;',
        '',
        '    for (let i = 0; i < values.length; i += 1) {',
        '      while (deque.length && deque[0] <= i - k) { deque.shift(); operations += 1; }',
        '      while (deque.length && values[deque[deque.length - 1]] <= values[i]) {',
        '        deque.pop();',
        '        operations += 1;',
        '      }',
        '      deque.push(i);',
        '      operations += 1;',
        '      if (i >= k - 1) maxima.push(values[deque[0]]);',
        '    }',
        '    return { maxima: maxima, operations: operations };',
        '  }',
        '',
        '  // the stack holds bars of non-decreasing height; a shorter arrival',
        '  // settles every taller bar, each exactly once. The sentinel at the end',
        '  // drains the stack inside the same loop rather than in a copy of it.',
        '  function largestRectangle(heights) {',
        '    const stack = [];',
        '    let area = 0;',
        '    let operations = 0;',
        '',
        '    for (let i = 0; i <= heights.length; i += 1) {',
        '      const height = i === heights.length ? -1 : heights[i];',
        '      while (stack.length && heights[stack[stack.length - 1]] > height) {',
        '        const top = stack.pop();',
        '        operations += 1;',
        '        const left = stack.length ? stack[stack.length - 1] + 1 : 0;',
        '        area = Math.max(area, heights[top] * (i - left));',
        '      }',
        '      if (i < heights.length) { stack.push(i); operations += 1; }',
        '    }',
        '    return { area: area, operations: operations };',
        '  }',
        '',
        '  return { maxInWindow: maxInWindow, largestRectangle: largestRectangle };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the window maxima match a rescan, on four input shapes',
          assert: function (sweepToolkit, api) {
            const random = api.rng;
            const tools = sweepToolkit();

            ['random', 'ascending', 'descending', 'sawtooth'].forEach(function (shape) {
              const values = [];
              for (let i = 0; i < 600; i += 1) {
                if (shape === 'ascending') values.push(i);
                else if (shape === 'descending') values.push(600 - i);
                else if (shape === 'sawtooth') values.push(i % 7);
                else values.push(random.int(500));
              }

              [1, 2, 17, 50].forEach(function (k) {
                const got = tools.maxInWindow(values, k).maxima;
                const want = [];
                for (let i = 0; i + k <= values.length; i += 1) {
                  let best = -Infinity;
                  for (let j = i; j < i + k; j += 1) best = Math.max(best, values[j]);
                  want.push(best);
                }
                api.assert.equal(got.length, want.length, shape + ' at k = ' + k + ': length');
                for (let i = 0; i < want.length; i += 1) {
                  api.assert.equal(got[i], want[i], shape + ' at k = ' + k + ', window ' + i);
                }
              });
            });
          }
        },
        {
          name: 'the window sweep stays under 3n operations, whatever the shape',
          assert: function (sweepToolkit, api) {
            const random = api.rng;
            const tools = sweepToolkit();

            ['random', 'ascending', 'descending', 'sawtooth'].forEach(function (shape) {
              const values = [];
              for (let i = 0; i < 4000; i += 1) {
                if (shape === 'ascending') values.push(i);
                else if (shape === 'descending') values.push(4000 - i);
                else if (shape === 'sawtooth') values.push(i % 25);
                else values.push(random.int(9000));
              }

              const run = tools.maxInWindow(values, 50);
              api.assert.atMost(run.operations, 12000,
                shape + ': rescanning costs about 197 550 here; a deque should be near 8 000. Got ' +
                  run.operations);
            });
          }
        },
        {
          name: 'the largest rectangle matches brute force, including the textbook case',
          assert: function (sweepToolkit, api) {
            const random = api.rng;
            const tools = sweepToolkit();

            api.assert.equal(tools.largestRectangle([2, 1, 5, 6, 2, 3]).area, 10, 'the textbook histogram');
            api.assert.equal(tools.largestRectangle([]).area, 0, 'empty');
            api.assert.equal(tools.largestRectangle([7]).area, 7, 'one bar');
            api.assert.equal(tools.largestRectangle([3, 3, 3, 3]).area, 12, 'a flat histogram');
            api.assert.equal(tools.largestRectangle([1, 2, 3, 4, 5]).area, 9, 'strictly increasing');
            api.assert.equal(tools.largestRectangle([5, 4, 3, 2, 1]).area, 9, 'strictly decreasing');

            for (let trial = 0; trial < 40; trial += 1) {
              const heights = [];
              for (let i = 0; i < 60; i += 1) heights.push(random.int(20));

              let best = 0;
              for (let i = 0; i < heights.length; i += 1) {
                let low = heights[i];
                for (let j = i; j < heights.length; j += 1) {
                  low = Math.min(low, heights[j]);
                  best = Math.max(best, low * (j - i + 1));
                }
              }
              api.assert.equal(tools.largestRectangle(heights).area, best, 'trial ' + trial);
            }
          }
        },
        {
          name: 'the histogram sweep is also bounded by the element count',
          assert: function (sweepToolkit, api) {
            const random = api.rng;
            const tools = sweepToolkit();
            const heights = [];
            for (let i = 0; i < 4000; i += 1) heights.push(random.int(100));

            const run = tools.largestRectangle(heights);
            api.assert.atMost(run.operations, 12000,
              'the quadratic version does 8 002 000 here; a monotonic stack should be near 8 000. Got ' +
                run.operations);

            const ascending = [];
            for (let i = 0; i < 4000; i += 1) ascending.push(i);
            api.assert.atMost(tools.largestRectangle(ascending).operations, 12000,
              'ascending input keeps the whole stack and still costs 2n operations');
          }
        }
      ]
    }],

    'meet-in-the-middle': [{
      id: 'subset-sum-halves',
      title: 'the closest achievable sum, at a size the full search cannot reach',
      starterFailure: 'timeout',
      prompt: 'closestSubsetSum(values, target) returns { sum, states }: the largest achievable subset sum ' +
        'that does not exceed the target, and the number of partial sums generated. Split the items into ' +
        'two halves, enumerate every subset of each — 2^(n/2) rather than 2^n — sort one side, and for each ' +
        'sum on the other binary-search it for the largest partner that still fits. The combine step is the ' +
        'part that has to be a search: pairing every left half with every right half is 2^n again and buys ' +
        'nothing. The starter enumerates the whole set, which is correct and hopeless past about twenty ' +
        'items.',
      entry: 'closestSubsetSum',
      starter: [
        'function closestSubsetSum(values, target) {',
        '  let states = 0;',
        '  let best = 0;',
        '',
        '  // all 2^n subsets',
        '  const total = Math.pow(2, values.length);',
        '  for (let mask = 0; mask < total; mask += 1) {',
        '    states += 1;',
        '    let sum = 0;',
        '    for (let i = 0; i < values.length; i += 1) {',
        '      if (mask & (1 << i)) sum += values[i];',
        '    }',
        '    if (sum <= target && sum > best) best = sum;',
        '  }',
        '',
        '  return { sum: best, states: states };',
        '}'
      ].join('\n'),
      solution: [
        'function closestSubsetSum(values, target) {',
        '  let states = 0;',
        '',
        '  function sumsOf(items) {',
        '    const out = [];',
        '    const total = 1 << items.length;',
        '    for (let mask = 0; mask < total; mask += 1) {',
        '      let sum = 0;',
        '      for (let i = 0; i < items.length; i += 1) {',
        '        if (mask & (1 << i)) sum += items[i];',
        '      }',
        '      out.push(sum);',
        '      states += 1;',
        '    }',
        '    return out;',
        '  }',
        '',
        '  const half = Math.floor(values.length / 2);',
        '  const left = sumsOf(values.slice(0, half));',
        '  const right = sumsOf(values.slice(half));',
        '  right.sort(function (a, b) { return a - b; });',
        '',
        '  // the combine is a search, not a product: one binary search per left sum',
        '  function largestNotExceeding(limit) {',
        '    let lo = 0;',
        '    let hi = right.length;',
        '    while (lo < hi) {',
        '      const mid = lo + ((hi - lo) >> 1);',
        '      if (right[mid] <= limit) lo = mid + 1; else hi = mid;',
        '    }',
        '    return lo === 0 ? null : right[lo - 1];',
        '  }',
        '',
        '  let best = 0;',
        '  for (let i = 0; i < left.length; i += 1) {',
        '    const room = target - left[i];',
        '    if (room < 0) continue;',
        '    const partner = largestNotExceeding(room);',
        '    if (partner === null) continue;',
        '    if (left[i] + partner > best) best = left[i] + partner;',
        '  }',
        '',
        '  return { sum: best, states: states };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it matches exhaustive enumeration wherever exhaustive enumeration can run',
          assert: function (closestSubsetSum, api) {
            const random = api.rng;

            for (let trial = 0; trial < 40; trial += 1) {
              const n = 4 + random.int(13);
              const values = [];
              for (let i = 0; i < n; i += 1) values.push(1 + random.int(400));
              const target = Math.round(values.reduce(function (a, b) { return a + b; }, 0) *
                (0.2 + random.next() * 0.6));

              let best = 0;
              for (let mask = 0; mask < (1 << n); mask += 1) {
                let sum = 0;
                for (let i = 0; i < n; i += 1) {
                  if (mask & (1 << i)) sum += values[i];
                }
                if (sum <= target && sum > best) best = sum;
              }

              api.assert.equal(closestSubsetSum(values, target).sum, best,
                'trial ' + trial + ' with ' + n + ' values and target ' + target);
            }
          }
        },
        {
          name: 'the awkward targets: zero, unreachable, and larger than everything',
          assert: function (closestSubsetSum, api) {
            api.assert.equal(closestSubsetSum([5, 7, 9], 0).sum, 0, 'target 0 — the empty subset');
            api.assert.equal(closestSubsetSum([5, 7, 9], 3).sum, 0, 'nothing fits');
            api.assert.equal(closestSubsetSum([5, 7, 9], 100).sum, 21, 'everything fits');
            api.assert.equal(closestSubsetSum([], 10).sum, 0, 'no values at all');
            api.assert.equal(closestSubsetSum([10], 10).sum, 10, 'an exact single item');
            api.assert.equal(closestSubsetSum([3, 34, 4, 12, 5, 2], 9).sum, 9, 'an exact combination');
          }
        },
        {
          name: 'the state count is 2^(n/2), not 2^n',
          assert: function (closestSubsetSum, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 30; i += 1) values.push(1 + random.int(5000));
            const target = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / 2);

            const run = closestSubsetSum(values, target);
            api.assert.atMost(run.states, 200000,
              'the full enumeration generates 1 073 741 824 states at n = 30; the split should generate ' +
                'about 65 536. Got ' + run.states);
            api.assert.atLeast(run.states, 100, 'both halves still have to be enumerated');
          }
        },
        {
          name: 'it finishes at a size the full search cannot reach, and the answer is achievable',
          assert: function (closestSubsetSum, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 36; i += 1) values.push(1 + random.int(5000));
            const target = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / 2);

            const run = closestSubsetSum(values, target);
            api.assert.atMost(run.states, 1000000, 'still 2^18 per half at n = 36; got ' + run.states);
            api.assert.ok(run.sum <= target, 'the answer must not exceed the target');
            api.assert.atLeast(run.sum, target - 5000,
              'with 36 values from 1 to 5 000 the achievable sums are dense, so the best should be close');
          }
        }
      ]
    }],

    'offline-processing': [{
      id: 'mo-ordering',
      title: 'the ordering that makes the sweep linear-ish',
      prompt: 'answerOffline(values, queries, universe) returns { answers, pointerMoves }: the number of ' +
        'distinct values in each half-open range [left, right), in the order the queries were given, and ' +
        'the total number of single-element pointer movements the sweep performed. Sort the queries by ' +
        '(block of the left endpoint, right endpoint) with a block size near n / sqrt(q), keep two pointers, ' +
        'and move them one element at a time to each query in turn, maintaining a counts array and a running ' +
        'distinct total. Two things are graded beyond the answers: the results must be written back into the ' +
        'caller\'s original slots, and the pointer movement must stay within the (n + q)·sqrt(n) bound. The ' +
        'starter answers the queries in arrival order.',
      entry: 'answerOffline',
      starter: [
        'function answerOffline(values, queries, universe) {',
        '  const counts = new Array(universe).fill(0);',
        '  let distinct = 0;',
        '  let left = 0;',
        '  let right = 0;',
        '  let pointerMoves = 0;',
        '  const answers = [];',
        '',
        '  function add(value) { counts[value] += 1; if (counts[value] === 1) distinct += 1; }',
        '  function remove(value) { counts[value] -= 1; if (counts[value] === 0) distinct -= 1; }',
        '',
        '  // arrival order: the pointers thrash across the array',
        '  queries.forEach(function (query) {',
        '    while (right < query.right) { add(values[right]); right += 1; pointerMoves += 1; }',
        '    while (left > query.left) { left -= 1; add(values[left]); pointerMoves += 1; }',
        '    while (right > query.right) { right -= 1; remove(values[right]); pointerMoves += 1; }',
        '    while (left < query.left) { remove(values[left]); left += 1; pointerMoves += 1; }',
        '    answers.push(distinct);',
        '  });',
        '',
        '  return { answers: answers, pointerMoves: pointerMoves };',
        '}'
      ].join('\n'),
      solution: [
        'function answerOffline(values, queries, universe) {',
        '  const n = values.length;',
        '  const q = Math.max(1, queries.length);',
        '  const blockSize = Math.max(1, Math.round(n / Math.sqrt(q)));',
        '',
        '  // by block of the left endpoint, then by right endpoint: the right',
        '  // pointer then sweeps forward once per block and the left one never',
        '  // leaves its block',
        '  const order = queries.map(function (query, index) {',
        '    return {',
        '      index: index, left: query.left, right: query.right,',
        '      block: Math.floor(query.left / blockSize)',
        '    };',
        '  }).sort(function (a, b) {',
        '    if (a.block !== b.block) return a.block - b.block;',
        '    return a.right - b.right;',
        '  });',
        '',
        '  const counts = new Array(universe).fill(0);',
        '  const answers = new Array(queries.length).fill(0);',
        '  let distinct = 0;',
        '  let left = 0;',
        '  let right = 0;',
        '  let pointerMoves = 0;',
        '',
        '  function add(value) { counts[value] += 1; if (counts[value] === 1) distinct += 1; }',
        '  function remove(value) { counts[value] -= 1; if (counts[value] === 0) distinct -= 1; }',
        '',
        '  order.forEach(function (query) {',
        '    while (right < query.right) { add(values[right]); right += 1; pointerMoves += 1; }',
        '    while (left > query.left) { left -= 1; add(values[left]); pointerMoves += 1; }',
        '    while (right > query.right) { right -= 1; remove(values[right]); pointerMoves += 1; }',
        '    while (left < query.left) { remove(values[left]); left += 1; pointerMoves += 1; }',
        '    // back into the caller\'s slot, not into the sweep\'s order',
        '    answers[query.index] = distinct;',
        '  });',
        '',
        '  return { answers: answers, pointerMoves: pointerMoves };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every answer matches a brute-force scan, in the caller\'s order',
          assert: function (answerOffline, api) {
            const random = api.rng;
            const universe = 40;
            const values = [];
            for (let i = 0; i < 900; i += 1) values.push(random.int(universe));

            const queries = [];
            for (let i = 0; i < 250; i += 1) {
              const left = random.int(900);
              queries.push({ left: left, right: Math.min(900, left + 1 + random.int(900 - left)) });
            }

            const run = answerOffline(values, queries, universe);
            api.assert.equal(run.answers.length, queries.length, 'one answer per query');

            queries.forEach(function (query, index) {
              const seen = new Set();
              for (let i = query.left; i < query.right; i += 1) seen.add(values[i]);
              api.assert.equal(run.answers[index], seen.size,
                'query ' + index + ' over [' + query.left + ', ' + query.right + ')');
            });
          }
        },
        {
          name: 'the answers are in the caller\'s order, not the sweep\'s',
          assert: function (answerOffline, api) {
            const values = [1, 1, 2, 2, 3, 3, 4, 4];
            const queries = [
              { left: 6, right: 8 },
              { left: 0, right: 8 },
              { left: 0, right: 2 },
              { left: 2, right: 6 }
            ];

            const run = answerOffline(values, queries, 5);
            api.assert.deepEqual(run.answers, [1, 4, 1, 2],
              'the sweep answers these in a different order and must put them back');
          }
        },
        {
          name: 'the pointer movement stays inside the bound',
          assert: function (answerOffline, api) {
            const random = api.rng;
            const universe = 200;
            const n = 4000;
            const values = [];
            for (let i = 0; i < n; i += 1) values.push(random.int(universe));

            const queries = [];
            for (let i = 0; i < 600; i += 1) {
              const left = random.int(n);
              queries.push({ left: left, right: Math.min(n, left + 1 + random.int(n - left)) });
            }

            const run = answerOffline(values, queries, universe);
            const bound = (n + queries.length) * Math.sqrt(n);
            api.assert.atMost(run.pointerMoves, bound,
              'the arrival order costs about 1 420 000 moves here; the bound is ' + Math.round(bound) +
                ' and Mo\'s order reaches about 122 000. Got ' + run.pointerMoves);
          }
        },
        {
          name: 'the degenerate shapes still work',
          assert: function (answerOffline, api) {
            const values = [3, 3, 3, 3, 3];
            api.assert.deepEqual(answerOffline(values, [{ left: 0, right: 5 }], 4).answers, [1],
              'all identical');
            api.assert.deepEqual(answerOffline(values, [{ left: 2, right: 2 }], 4).answers, [0],
              'an empty range');
            api.assert.deepEqual(answerOffline([0, 1, 2, 3], [{ left: 0, right: 4 }], 4).answers, [4],
              'all distinct');
            api.assert.deepEqual(answerOffline([0, 1], [], 2).answers, [], 'no queries at all');
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
