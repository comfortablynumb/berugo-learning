/**
 * Graded exercises for the structured dynamic-programming sections (M12.5-M12.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'interval-dp': [{
      id: 'knuth-optimal-bst',
      title: "optimal BST cost, with Knuth's optimisation and its precondition",
      prompt: 'optimalBst(weights) must return { cost, splitTests, quadrangle }: the minimum weighted search ' +
        'cost of a binary search tree over keys with the given access weights, how many split points the ' +
        'search tested in total, and whether the quadrangle inequality holds for these weights. The starter ' +
        'tests every split in every interval, which is O(n³) and always correct. Narrow the split range at ' +
        '[i, j] to [root[i][j−1], root[i+1][j]] — but only when the quadrangle inequality holds, and report ' +
        'that as `quadrangle`. Test the inequality with a TOLERANCE: interval weights are differences of ' +
        'prefix sums, so two-decimal probabilities violate it by around 1e-16 of pure floating-point error, ' +
        'and an exact comparison rejects the very instances the optimisation was written for. When it does ' +
        'not hold, fall back to the full search rather than returning a wrong answer.',
      entry: 'optimalBst',
      starter: [
        'function optimalBst(weights) {',
        '  const n = weights.length;',
        '  const sums = [0];',
        '  for (let i = 0; i < n; i += 1) sums.push(sums[i] + weights[i]);',
        '',
        '  const best = [];',
        '  const root = [];',
        '  for (let i = 0; i <= n; i += 1) {',
        '    best.push(new Array(n + 1).fill(0));',
        '    root.push(new Array(n + 1).fill(-1));',
        '  }',
        '  let splitTests = 0;',
        '',
        '  for (let i = 0; i < n; i += 1) { best[i][i] = weights[i]; root[i][i] = i; }',
        '',
        '  for (let length = 2; length <= n; length += 1) {',
        '    for (let i = 0; i + length - 1 < n; i += 1) {',
        '      const j = i + length - 1;',
        '      let bestCost = Infinity;',
        '      let bestRoot = i;',
        '      // every split, always',
        '      for (let r = i; r <= j; r += 1) {',
        '        splitTests += 1;',
        '        const left = r > i ? best[i][r - 1] : 0;',
        '        const right = r < j ? best[r + 1][j] : 0;',
        '        if (left + right >= bestCost) continue;',
        '        bestCost = left + right;',
        '        bestRoot = r;',
        '      }',
        '      best[i][j] = bestCost + (sums[j + 1] - sums[i]);',
        '      root[i][j] = bestRoot;',
        '    }',
        '  }',
        '',
        '  return { cost: n === 0 ? 0 : best[0][n - 1], splitTests: splitTests, quadrangle: true };',
        '}'
      ].join('\n'),
      solution: [
        'function optimalBst(weights) {',
        '  const n = weights.length;',
        '  const sums = [0];',
        '  for (let i = 0; i < n; i += 1) sums.push(sums[i] + weights[i]);',
        '  const w = function (i, j) { return sums[j + 1] - sums[i]; };',
        '  const epsilon = 1e-9 * Math.max(1, Math.abs(sums[n]));',
        '',
        '  let holds = true;',
        '  for (let a = 0; a < n && holds; a += 1) {',
        '    for (let b = a; b < n && holds; b += 1) {',
        '      for (let c = b; c < n && holds; c += 1) {',
        '        for (let d = c; d < n; d += 1) {',
        '          const inequality = w(a, c) + w(b, d) <= w(a, d) + w(b, c) + epsilon;',
        '          const monotone = w(b, c) <= w(a, d) + epsilon;',
        '          if (inequality && monotone) continue;',
        '          holds = false;',
        '          break;',
        '        }',
        '      }',
        '    }',
        '  }',
        '',
        '  const best = [];',
        '  const root = [];',
        '  for (let i = 0; i <= n; i += 1) {',
        '    best.push(new Array(n + 1).fill(0));',
        '    root.push(new Array(n + 1).fill(-1));',
        '  }',
        '  let splitTests = 0;',
        '',
        '  for (let i = 0; i < n; i += 1) { best[i][i] = weights[i]; root[i][i] = i; }',
        '',
        '  for (let length = 2; length <= n; length += 1) {',
        '    for (let i = 0; i + length - 1 < n; i += 1) {',
        '      const j = i + length - 1;',
        '      const from = holds ? root[i][j - 1] : i;',
        '      const to = holds ? root[i + 1][j] : j;',
        '      let bestCost = Infinity;',
        '      let bestRoot = from;',
        '      for (let r = from; r <= to; r += 1) {',
        '        splitTests += 1;',
        '        const left = r > i ? best[i][r - 1] : 0;',
        '        const right = r < j ? best[r + 1][j] : 0;',
        '        if (left + right >= bestCost) continue;',
        '        bestCost = left + right;',
        '        bestRoot = r;',
        '      }',
        '      best[i][j] = bestCost + w(i, j);',
        '      root[i][j] = bestRoot;',
        '    }',
        '  }',
        '',
        '  return { cost: n === 0 ? 0 : best[0][n - 1], splitTests: splitTests, quadrangle: holds };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the cost is right on small instances that can be checked by hand',
          assert: function (optimalBst, api) {
            api.assert.equal(optimalBst([]).cost, 0, 'no keys');
            api.assert.closeTo(optimalBst([1]).cost, 1, 1e-9, 'one key sits at the root');
            api.assert.closeTo(optimalBst([1, 1]).cost, 3, 1e-9, 'two equal keys: 1 at depth 1, 1 at depth 2');
            api.assert.closeTo(optimalBst([2, 1]).cost, 4, 1e-9, 'the heavier key belongs at the root');
            api.assert.closeTo(optimalBst([1, 1, 1]).cost, 5, 1e-9, 'three equal keys make a balanced tree');
          }
        },
        {
          name: 'the narrowed search returns the unnarrowed cost',
          assert: function (optimalBst, api) {
            function reference(weights) {
              const n = weights.length;
              const sums = [0];

              for (let i = 0; i < n; i += 1) sums.push(sums[i] + weights[i]);
              const best = [];

              for (let i = 0; i <= n; i += 1) best.push(new Array(n + 1).fill(0));

              for (let i = 0; i < n; i += 1) best[i][i] = weights[i];

              for (let length = 2; length <= n; length += 1) {
                for (let i = 0; i + length - 1 < n; i += 1) {
                  const j = i + length - 1;
                  let bestCost = Infinity;

                  for (let r = i; r <= j; r += 1) {
                    const left = r > i ? best[i][r - 1] : 0;
                    const right = r < j ? best[r + 1][j] : 0;
                    bestCost = Math.min(bestCost, left + right);
                  }
                  best[i][j] = bestCost + (sums[j + 1] - sums[i]);
                }
              }
              return n === 0 ? 0 : best[0][n - 1];
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const weights = [];

              for (let i = 0; i < 8; i += 1) weights.push((1 + api.rng.int(20)) / 100);
              api.assert.closeTo(optimalBst(weights).cost, reference(weights), 1e-9, 'trial ' + trial);
            }
          }
        },
        {
          name: 'the precondition check tolerates prefix-sum error',
          assert: function (optimalBst, api) {
            // the classic nine-probability instance: two-decimal values whose
            // prefix sums drift by about 1e-16
            const classic = [0.15, 0.10, 0.05, 0.10, 0.20, 0.10, 0.05, 0.10, 0.15];
            const run = optimalBst(classic);
            api.assert.equal(run.quadrangle, true,
              'non-negative weights satisfy the quadrangle inequality; an exact comparison rejects them');
            api.assert.closeTo(run.cost, 2.5, 1e-9, 'the classic instance costs 2.5');
          }
        },
        {
          name: 'the narrowing actually happens, and does not on a negative weight',
          assert: function (optimalBst, api) {
            const classic = [0.15, 0.10, 0.05, 0.10, 0.20, 0.10, 0.05, 0.10, 0.15];
            const run = optimalBst(classic);
            api.assert.atMost(run.splitTests, 110,
              'the full search tests 156 splits over 9 keys; the narrowed one should be well under 110. Got ' +
                run.splitTests);

            const negative = classic.slice();
            negative[4] = -negative[4];
            const broken = optimalBst(negative);
            api.assert.equal(broken.quadrangle, false,
              'a negative weight breaks monotonicity on nested intervals');
            api.assert.atLeast(broken.splitTests, 156,
              'with the precondition false the search must fall back to every split; got ' +
                broken.splitTests);
          }
        }
      ]
    }],

    'tree-dp': [{
      id: 'reroot-sum-of-distances',
      title: 'rerooting: the sum of distances from every node',
      prompt: 'sumOfDistances(n, edges) must return an array whose vth entry is the total distance from ' +
        'node v to every other node, computed in O(n) total — one downward pass and one upward pass, not ' +
        'a traversal from each node. The starter runs a breadth-first search from every node, which is ' +
        'correct and O(n²); it times out on the large inputs the grader uses. Compute subtree sizes and ' +
        'below-totals in one post-order pass, then derive every other node with ' +
        'answer[child] = answer[parent] + n − 2·size(child). Make both passes ITERATIVE: the grader runs a ' +
        'path of 20 000 nodes, and a recursive traversal is a stack overflow rather than a slow answer.',
      entry: 'sumOfDistances',
      starterFailure: 'timeout',
      starter: [
        'function sumOfDistances(n, edges) {',
        '  const adjacency = [];',
        '  for (let i = 0; i < n; i += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge[0]].push(edge[1]);',
        '    adjacency[edge[1]].push(edge[0]);',
        '  });',
        '',
        '  // correct, and a traversal from every node: O(n^2)',
        '  const out = [];',
        '  for (let source = 0; source < n; source += 1) {',
        '    const depth = new Array(n).fill(-1);',
        '    depth[source] = 0;',
        '    const queue = [source];',
        '    let head = 0;',
        '    let total = 0;',
        '    while (head < queue.length) {',
        '      const node = queue[head];',
        '      head += 1;',
        '      total += depth[node];',
        '      adjacency[node].forEach(function (next) {',
        '        if (depth[next] !== -1) return;',
        '        depth[next] = depth[node] + 1;',
        '        queue.push(next);',
        '      });',
        '    }',
        '    out.push(total);',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function sumOfDistances(n, edges) {',
        '  const adjacency = [];',
        '  for (let i = 0; i < n; i += 1) adjacency.push([]);',
        '  edges.forEach(function (edge) {',
        '    adjacency[edge[0]].push(edge[1]);',
        '    adjacency[edge[1]].push(edge[0]);',
        '  });',
        '',
        '  // an explicit stack: a path of 20 000 nodes is a recursion 20 000 deep',
        '  const parent = new Array(n).fill(-1);',
        '  const order = [];',
        '  const seen = new Array(n).fill(false);',
        '  const stack = [0];',
        '  seen[0] = true;',
        '  while (stack.length) {',
        '    const node = stack.pop();',
        '    order.push(node);',
        '    adjacency[node].forEach(function (next) {',
        '      if (seen[next]) return;',
        '      seen[next] = true;',
        '      parent[next] = node;',
        '      stack.push(next);',
        '    });',
        '  }',
        '',
        '  const size = new Array(n).fill(1);',
        '  const below = new Array(n).fill(0);',
        '  for (let i = order.length - 1; i > 0; i -= 1) {',
        '    const node = order[i];',
        '    const up = parent[node];',
        '    size[up] += size[node];',
        '    below[up] += below[node] + size[node];',
        '  }',
        '',
        '  const answer = new Array(n).fill(0);',
        '  answer[0] = below[0];',
        '  order.forEach(function (node) {',
        '    if (node === 0) return;',
        '    answer[node] = answer[parent[node]] + n - 2 * size[node];',
        '  });',
        '  return answer;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the small cases are right',
          assert: function (sumOfDistances, api) {
            api.assert.deepEqual(sumOfDistances(1, []), [0], 'a single node');
            api.assert.deepEqual(sumOfDistances(2, [[0, 1]]), [1, 1], 'an edge');
            api.assert.deepEqual(sumOfDistances(3, [[0, 1], [0, 2]]), [2, 3, 3], 'a three-node star');
            api.assert.deepEqual(sumOfDistances(4, [[0, 1], [1, 2], [2, 3]]), [6, 4, 4, 6], 'a path of four');
            api.assert.deepEqual(sumOfDistances(6, [[0, 1], [0, 2], [2, 3], [2, 4], [2, 5]]),
              [8, 12, 6, 10, 10, 10], 'the classic LeetCode instance');
          }
        },
        {
          name: 'it agrees with a traversal from every node on random trees',
          assert: function (sumOfDistances, api) {
            for (let trial = 0; trial < 8; trial += 1) {
              const n = 12 + api.rng.int(20);
              const edges = [];

              for (let i = 1; i < n; i += 1) edges.push([api.rng.int(i), i]);
              const adjacency = [];

              for (let i = 0; i < n; i += 1) adjacency.push([]);
              edges.forEach(function (edge) {
                adjacency[edge[0]].push(edge[1]);
                adjacency[edge[1]].push(edge[0]);
              });

              const truth = [];

              for (let source = 0; source < n; source += 1) {
                const depth = new Array(n).fill(-1);
                depth[source] = 0;
                const queue = [source];
                let head = 0;
                let total = 0;

                while (head < queue.length) {
                  const node = queue[head];
                  head += 1;
                  total += depth[node];
                  adjacency[node].forEach(function (next) {
                    if (depth[next] !== -1) return;
                    depth[next] = depth[node] + 1;
                    queue.push(next);
                  });
                }
                truth.push(total);
              }
              api.assert.deepEqual(sumOfDistances(n, edges), truth, 'trial ' + trial + ' at n = ' + n);
            }
          }
        },
        {
          name: 'a star with a huge degree is handled without a quadratic blow-up',
          assert: function (sumOfDistances, api) {
            const n = 20000;
            const edges = [];

            for (let i = 1; i < n; i += 1) edges.push([0, i]);
            const answer = sumOfDistances(n, edges);
            api.assert.equal(answer.length, n, 'one entry per node');
            api.assert.equal(answer[0], n - 1, 'the centre is one step from everything');
            api.assert.equal(answer[1], 2 * n - 3, 'a leaf is 1 from the centre and 2 from every other leaf');
            api.assert.equal(answer[n - 1], 2 * n - 3, 'and so is the last leaf');
          }
        },
        {
          name: 'a path of twenty thousand nodes does not overflow the stack',
          assert: function (sumOfDistances, api) {
            const n = 20000;
            const edges = [];

            for (let i = 1; i < n; i += 1) edges.push([i - 1, i]);
            const answer = sumOfDistances(n, edges);
            api.assert.equal(answer.length, n, 'one entry per node');
            // an endpoint of a path totals 0 + 1 + ... + (n-1)
            api.assert.equal(answer[0], (n - 1) * n / 2, 'the first node of the path');
            api.assert.equal(answer[n - 1], (n - 1) * n / 2, 'and the last');
            // the centre is the minimum
            api.assert.ok(answer[n / 2] < answer[0], 'the middle of a path is closer to everything');
          }
        }
      ]
    }],

    'bitmask-dp': [{
      id: 'submasks-and-sos',
      title: 'sum over subsets, in n·2ⁿ rather than 3ⁿ',
      prompt: 'sumOverSubsets(values, bits) must return { table, operations }: an array where table[mask] is ' +
        'the sum of values[sub] over every submask sub of mask, and the number of accumulate operations ' +
        'performed. The starter walks every submask of every mask with the ' +
        '`for (sub = mask; sub; sub = (sub - 1) & mask)` idiom, which is correct and costs 3ⁿ in total. ' +
        'Replace it with SOS DP: relax one bit at a time, with the BIT loop OUTSIDE the mask loop, for ' +
        'n·2ⁿ. The table must be identical; the operation count must drop. Swapping the two loops gives a ' +
        'partly relaxed table that looks entirely ordinary, so the grader checks every entry.',
      entry: 'sumOverSubsets',
      starter: [
        'function sumOverSubsets(values, bits) {',
        '  const size = 1 << bits;',
        '  const table = new Array(size).fill(0);',
        '  let operations = 0;',
        '',
        '  // every submask of every mask: 3^n in total',
        '  for (let mask = 0; mask < size; mask += 1) {',
        '    let sub = mask;',
        '    while (true) {',
        '      operations += 1;',
        '      table[mask] += values[sub];',
        '      if (sub === 0) break;',
        '      sub = (sub - 1) & mask;',
        '    }',
        '  }',
        '  return { table: table, operations: operations };',
        '}'
      ].join('\n'),
      solution: [
        'function sumOverSubsets(values, bits) {',
        '  const size = 1 << bits;',
        '  const table = values.slice(0, size);',
        '  let operations = 0;',
        '',
        '  // the BIT loop is outside: after round b, every entry has absorbed',
        '  // the submasks differing only in bits 0..b',
        '  for (let bit = 0; bit < bits; bit += 1) {',
        '    for (let mask = 0; mask < size; mask += 1) {',
        '      if ((mask & (1 << bit)) === 0) continue;',
        '      operations += 1;',
        '      table[mask] += table[mask ^ (1 << bit)];',
        '    }',
        '  }',
        '  return { table: table, operations: operations };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the table is right at small sizes, checked entry by entry',
          assert: function (sumOverSubsets, api) {
            const values = [1, 2, 4, 8];
            const run = sumOverSubsets(values, 2);
            api.assert.deepEqual(run.table, [1, 3, 5, 15],
              'sums over subsets of 00, 01, 10, 11');

            const one = sumOverSubsets([5, 7], 1);
            api.assert.deepEqual(one.table, [5, 12], 'a single bit');

            const zero = sumOverSubsets([9], 0);
            api.assert.deepEqual(zero.table, [9], 'no bits at all');
          }
        },
        {
          name: 'it agrees with a direct submask walk on random inputs',
          assert: function (sumOverSubsets, api) {
            for (let bits = 1; bits <= 8; bits += 1) {
              const size = 1 << bits;
              const values = [];

              for (let i = 0; i < size; i += 1) values.push(api.rng.int(100));
              const truth = new Array(size).fill(0);

              for (let mask = 0; mask < size; mask += 1) {
                let sub = mask;

                while (true) {
                  truth[mask] += values[sub];

                  if (sub === 0) break;
                  sub = (sub - 1) & mask;
                }
              }
              api.assert.deepEqual(sumOverSubsets(values, bits).table, truth,
                'the tables differ at ' + bits + ' bits');
            }
          }
        },
        {
          name: 'the operation count is n·2^n rather than 3^n',
          assert: function (sumOverSubsets, api) {
            [4, 6, 8, 10].forEach(function (bits) {
              const size = 1 << bits;
              const values = new Array(size).fill(1);
              const run = sumOverSubsets(values, bits);
              api.assert.atMost(run.operations, bits * size,
                'at ' + bits + ' bits, n·2^n is ' + (bits * size) + '; got ' + run.operations);
              api.assert.ok(run.operations < Math.pow(3, bits),
                'at ' + bits + ' bits, 3^n is ' + Math.pow(3, bits) + '; got ' + run.operations);
            });
          }
        },
        {
          name: 'the full-ones mask totals everything, at every size',
          assert: function (sumOverSubsets, api) {
            for (let bits = 1; bits <= 10; bits += 1) {
              const size = 1 << bits;
              const values = [];
              let total = 0;

              for (let i = 0; i < size; i += 1) {
                const value = 1 + api.rng.int(9);
                values.push(value);
                total += value;
              }
              const run = sumOverSubsets(values, bits);
              api.assert.equal(run.table[size - 1], total,
                'the all-ones mask must sum every value at ' + bits + ' bits');
              api.assert.equal(run.table[0], values[0], 'the empty mask has one submask: itself');
            }
          }
        }
      ]
    }],

    'digit-dp': [{
      id: 'digit-dp-adjacent',
      title: 'count a huge range without visiting it',
      prompt: 'countNoRepeats(low, high) must return the count of integers in the inclusive range [low, high] ' +
        'with no two equal ADJACENT digits. The starter counts them one at a time, which is correct and ' +
        'proportional to the size of the range; the grader uses bounds up to 10¹⁵, where that is not an ' +
        'option. Walk the bound\'s digits instead, carrying (position, previous digit, tight, started). ' +
        'Two things the grader checks specifically: the tight flag — the count must not run past the ' +
        'bound — and the number ZERO, which the natural "count it if it started and the automaton accepts" ' +
        'termination silently drops, making every prefix count one short while every range stays right.',
      entry: 'countNoRepeats',
      starterFailure: 'timeout',
      starter: [
        'function countNoRepeats(low, high) {',
        '  let count = 0;',
        '',
        '  // correct, and proportional to the size of the range',
        '  for (let value = Math.max(0, low); value <= high; value += 1) {',
        '    const digits = String(value);',
        '    let ok = true;',
        '    for (let i = 1; i < digits.length; i += 1) {',
        '      if (digits[i] !== digits[i - 1]) continue;',
        '      ok = false;',
        '      break;',
        '    }',
        '    if (ok) count += 1;',
        '  }',
        '  return count;',
        '}'
      ].join('\n'),
      solution: [
        'function countNoRepeats(low, high) {',
        '  function countUpTo(limit) {',
        '    if (limit < 0) return 0;',
        '    const digits = String(limit).split("").map(Number);',
        '    const memo = new Map();',
        '',
        '    function go(at, previous, tight, started) {',
        '      // the all-zeros path IS the number zero, and it has no repeats',
        '      if (at === digits.length) return started ? 1 : 1;',
        '      const key = at + "|" + previous + "|" + (started ? 1 : 0);',
        '      if (!tight && memo.has(key)) return memo.get(key);',
        '      const cap = tight ? digits[at] : 9;',
        '      let total = 0;',
        '      for (let digit = 0; digit <= cap; digit += 1) {',
        '        const stillTight = tight && digit === cap;',
        '        if (!started && digit === 0) {',
        '          total += go(at + 1, -1, stillTight, false);',
        '          continue;',
        '        }',
        '        if (digit === previous) continue;',
        '        total += go(at + 1, digit, stillTight, true);',
        '      }',
        '      if (!tight) memo.set(key, total);',
        '      return total;',
        '    }',
        '    return go(0, -1, true, false);',
        '  }',
        '  return countUpTo(high) - countUpTo(low - 1);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with a one-by-one count on small ranges',
          assert: function (countNoRepeats, api) {
            function brute(low, high) {
              let count = 0;

              for (let value = Math.max(0, low); value <= high; value += 1) {
                const digits = String(value);
                let ok = true;

                for (let i = 1; i < digits.length; i += 1) {
                  if (digits[i] !== digits[i - 1]) continue;
                  ok = false;
                  break;
                }

                if (ok) count += 1;
              }
              return count;
            }
            const cases = [[0, 9], [0, 99], [0, 100], [1, 1], [11, 11], [10, 22],
              [137, 4321], [0, 5000], [999, 1001]];

            cases.forEach(function (pair) {
              api.assert.equal(countNoRepeats(pair[0], pair[1]), brute(pair[0], pair[1]),
                'range [' + pair[0] + ', ' + pair[1] + ']');
            });
          }
        },
        {
          name: 'the number zero is counted',
          assert: function (countNoRepeats, api) {
            api.assert.equal(countNoRepeats(0, 0), 1, 'zero has no adjacent digits, so it qualifies');
            api.assert.equal(countNoRepeats(0, 9), 10, 'every single digit qualifies, including 0');
            api.assert.equal(countNoRepeats(0, 10), 11, '0 through 9, plus 10');
            api.assert.equal(countNoRepeats(0, 11), 11, '11 has a repeat, so the count does not move');
          }
        },
        {
          name: 'the tight flag stops the count running past the bound',
          assert: function (countNoRepeats, api) {
            // 0..99 has 10 single digits plus 9*9 = 81 two-digit numbers with
            // distinct adjacent digits = 91
            api.assert.equal(countNoRepeats(0, 99), 91, 'the whole two-digit range');
            api.assert.equal(countNoRepeats(0, 50), 47, 'a bound in the middle of the range');
            api.assert.equal(countNoRepeats(0, 1000), 820, 'up to a round thousand');
            api.assert.equal(countNoRepeats(1023, 1023), 1, 'a single qualifying value on its own');
            api.assert.equal(countNoRepeats(1000, 1000), 0, '1000 contains "00"');
            api.assert.equal(countNoRepeats(1100, 1100), 0, '1100 contains "11" and "00"');
          }
        },
        {
          name: 'a range far too large to iterate is answered anyway',
          assert: function (countNoRepeats, api) {
            api.assert.equal(countNoRepeats(0, 1000000), 597871, 'up to a million');
            api.assert.equal(countNoRepeats(0, 999999999), 435848050, 'up to a billion');
            api.assert.equal(countNoRepeats(1, 1000000000000000), 231627523606479,
              'up to 10^15 — impossible to iterate');
            api.assert.equal(countNoRepeats(500000000000000, 1000000000000000),
              countNoRepeats(0, 1000000000000000) - countNoRepeats(0, 499999999999999),
              'the range is the difference of two prefixes');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
