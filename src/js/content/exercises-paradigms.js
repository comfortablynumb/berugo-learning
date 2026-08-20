/**
 * Graded exercises for the first three paradigm sections (M11.1-M11.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'exhaustive-search': [{
      id: 'queens-symmetry',
      title: 'symmetry breaking that keeps every solution',
      prompt: 'solveQueens(n) must return { solutions, nodes }: the number of distinct n-queens boards, and ' +
        'the number of partial boards the search examined — count one node per call to your recursive ' +
        'helper, including the root. The provided starter already prunes the diagonals at placement time. ' +
        'Add symmetry breaking: a board and its left-right mirror are the same board reflected, so ' +
        'restricting the first row to the left half halves the tree exactly. The catch is the recovery — ' +
        'the count must still be the true number of solutions, and for odd n a middle-column board can be ' +
        'its own mirror, so doubling is wrong. Mirror each board found and count the distinct results.',
      entry: 'solveQueens',
      starter: [
        'function solveQueens(n) {',
        '  const board = new Array(n).fill(-1);',
        '  const used = new Array(n).fill(false);',
        '  let nodes = 0;',
        '  let solutions = 0;',
        '',
        '  function attacks(row, column) {',
        '    for (let r = 0; r < row; r += 1) {',
        '      if (row - r === Math.abs(column - board[r])) return true;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  // the whole first row is searched, so every solution is found twice',
        '  function descend(row) {',
        '    nodes += 1;',
        '    if (row === n) { solutions += 1; return; }',
        '    for (let column = 0; column < n; column += 1) {',
        '      if (used[column] || attacks(row, column)) continue;',
        '      board[row] = column;',
        '      used[column] = true;',
        '      descend(row + 1);',
        '      used[column] = false;',
        '      board[row] = -1;',
        '    }',
        '  }',
        '',
        '  descend(0);',
        '  return { solutions: solutions, nodes: nodes };',
        '}'
      ].join('\n'),
      solution: [
        'function solveQueens(n) {',
        '  const board = new Array(n).fill(-1);',
        '  const used = new Array(n).fill(false);',
        '  const found = [];',
        '  let nodes = 0;',
        '',
        '  function attacks(row, column) {',
        '    for (let r = 0; r < row; r += 1) {',
        '      if (row - r === Math.abs(column - board[r])) return true;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  // the first row is restricted to the left half; the boards not visited',
        '  // are exactly the mirrors of the ones that were',
        '  const halfWidth = Math.ceil(n / 2);',
        '',
        '  function descend(row) {',
        '    nodes += 1;',
        '    if (row === n) { found.push(board.slice()); return; }',
        '    const limit = row === 0 ? halfWidth : n;',
        '    for (let column = 0; column < limit; column += 1) {',
        '      if (used[column] || attacks(row, column)) continue;',
        '      board[row] = column;',
        '      used[column] = true;',
        '      descend(row + 1);',
        '      used[column] = false;',
        '      board[row] = -1;',
        '    }',
        '  }',
        '',
        '  descend(0);',
        '',
        '  // mirror everything found and count the distinct boards: doubling is',
        '  // wrong for odd n, where a middle-column board can be its own mirror',
        '  const seen = new Set();',
        '  found.forEach(function (solution) {',
        '    seen.add(solution.join(","));',
        '    seen.add(solution.map(function (c) { return n - 1 - c; }).join(","));',
        '  });',
        '',
        '  return { solutions: seen.size, nodes: nodes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the solution counts are the published ones, for n = 4 to 10',
          assert: function (solveQueens, api) {
            const expected = { 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724 };
            Object.keys(expected).forEach(function (key) {
              const n = Number(key);
              api.assert.equal(solveQueens(n).solutions, expected[key], 'solutions at n = ' + n);
            });
          }
        },
        {
          name: 'odd n is handled: a middle-column board is not counted twice',
          assert: function (solveQueens, api) {
            api.assert.equal(solveQueens(5).solutions, 10, 'n = 5');
            api.assert.equal(solveQueens(7).solutions, 40, 'n = 7');
            api.assert.equal(solveQueens(9).solutions, 352, 'n = 9');
            api.assert.equal(solveQueens(1).solutions, 1, 'n = 1 — one board, its own mirror');
          }
        },
        {
          name: 'the tree is halved: the node count drops with the solution count intact',
          assert: function (solveQueens, api) {
            const eight = solveQueens(8);
            api.assert.equal(eight.solutions, 92, 'still 92 solutions at n = 8');
            api.assert.atMost(eight.nodes, 1100,
              'the unrestricted search visits 2 057 nodes; halving the first row should reach about 1 029. Got ' +
                eight.nodes);

            const ten = solveQueens(10);
            api.assert.equal(ten.solutions, 724, 'still 724 solutions at n = 10');
            api.assert.atMost(ten.nodes, 18500,
              'the unrestricted search visits 35 539 nodes at n = 10; got ' + ten.nodes);
          }
        },
        {
          name: 'the node count is real, and the search still prunes the diagonals',
          assert: function (solveQueens, api) {
            const six = solveQueens(6);
            api.assert.equal(six.solutions, 4, 'n = 6');
            api.assert.atLeast(six.nodes, 20, 'a search of any kind visits more than a handful of nodes');
            api.assert.atMost(six.nodes, 120,
              'checking the diagonals at the leaf instead of at placement would visit about 979; got ' + six.nodes);
          }
        }
      ]
    }],

    'divide-and-conquer': [{
      id: 'karatsuba-digits',
      title: 'Karatsuba over digit arrays, counted',
      prompt: 'multiply(a, b) takes two little-endian arrays of decimal digits and returns ' +
        '{ digits, products }: the product in the same representation, and the number of single-digit ' +
        'multiplications performed. Use Karatsuba — split each operand in half, compute ac, bd and ' +
        '(a+b)(c+d), and recover the middle term by subtraction — recursing until an operand is a single ' +
        'digit. The provided starter is the schoolbook algorithm: correct, and n² digit products. The ' +
        'graded properties are that the answer matches BigInt exactly at every length, including unequal ' +
        'lengths and zero, and that the product count is well below n² at 256 digits.',
      entry: 'multiply',
      starter: [
        'function multiply(a, b) {',
        '  let products = 0;',
        '  const out = new Array(a.length + b.length).fill(0);',
        '',
        '  // n² digit products, and nothing about the split',
        '  for (let i = 0; i < a.length; i += 1) {',
        '    for (let j = 0; j < b.length; j += 1) {',
        '      out[i + j] += a[i] * b[j];',
        '      products += 1;',
        '    }',
        '  }',
        '',
        '  let carry = 0;',
        '  for (let i = 0; i < out.length; i += 1) {',
        '    const total = out[i] + carry;',
        '    out[i] = ((total % 10) + 10) % 10;',
        '    carry = Math.floor((total - out[i]) / 10);',
        '  }',
        '  while (carry > 0) { out.push(carry % 10); carry = Math.floor(carry / 10); }',
        '  while (out.length > 1 && out[out.length - 1] === 0) out.pop();',
        '',
        '  return { digits: out, products: products };',
        '}'
      ].join('\n'),
      solution: [
        'function multiply(a, b) {',
        '  let products = 0;',
        '',
        '  function trim(digits) {',
        '    const out = digits.slice();',
        '    while (out.length > 1 && out[out.length - 1] === 0) out.pop();',
        '    return out;',
        '  }',
        '',
        '  function carry(digits) {',
        '    const out = digits.slice();',
        '    let held = 0;',
        '    for (let i = 0; i < out.length; i += 1) {',
        '      const total = out[i] + held;',
        '      out[i] = ((total % 10) + 10) % 10;',
        '      held = Math.floor((total - out[i]) / 10);',
        '    }',
        '    while (held > 0) { out.push(held % 10); held = Math.floor(held / 10); }',
        '    return trim(out);',
        '  }',
        '',
        '  function add(x, y) {',
        '    const out = new Array(Math.max(x.length, y.length)).fill(0);',
        '    for (let i = 0; i < out.length; i += 1) out[i] = (x[i] || 0) + (y[i] || 0);',
        '    return carry(out);',
        '  }',
        '',
        '  function subtract(x, y) {',
        '    const out = x.slice();',
        '    for (let i = 0; i < out.length; i += 1) out[i] -= (y[i] || 0);',
        '    return carry(out);',
        '  }',
        '',
        '  function shift(digits, places) {',
        '    if (digits.length === 1 && digits[0] === 0) return [0];',
        '    return new Array(places).fill(0).concat(digits);',
        '  }',
        '',
        '  function karatsuba(x, y) {',
        '    const n = Math.max(x.length, y.length);',
        '    if (n === 1) {',
        '      products += 1;',
        '      return carry([x[0] * y[0]]);',
        '    }',
        '',
        '    const half = n >> 1;',
        '    const lowX = trim(x.slice(0, Math.min(half, x.length)));',
        '    const highX = trim(x.slice(Math.min(half, x.length)));',
        '    const lowY = trim(y.slice(0, Math.min(half, y.length)));',
        '    const highY = trim(y.slice(Math.min(half, y.length)));',
        '',
        '    // three products, not four: the middle term comes back by subtraction',
        '    const low = karatsuba(lowX, lowY);',
        '    const high = karatsuba(highX, highY);',
        '    const middle = subtract(subtract(karatsuba(add(lowX, highX), add(lowY, highY)), low), high);',
        '',
        '    return carry(add(add(shift(high, 2 * half), shift(middle, half)), low));',
        '  }',
        '',
        '  return { digits: karatsuba(trim(a), trim(b)), products: products };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with BigInt at every length, including unequal ones',
          assert: function (multiply, api) {
            const random = api.rng;
            function toBig(digits) {
              let value = 0n;
              for (let i = digits.length - 1; i >= 0; i -= 1) value = value * 10n + BigInt(digits[i]);
              return value;
            }

            for (let trial = 0; trial < 120; trial += 1) {
              const na = 1 + random.int(40);
              const nb = 1 + random.int(40);
              const a = [];
              const b = [];
              for (let i = 0; i < na; i += 1) a.push(random.int(10));
              for (let i = 0; i < nb; i += 1) b.push(random.int(10));
              a[na - 1] = Math.max(1, a[na - 1]);
              b[nb - 1] = Math.max(1, b[nb - 1]);

              const got = toBig(multiply(a, b).digits);
              const want = toBig(a) * toBig(b);
              api.assert.equal(String(got), String(want),
                'lengths ' + na + ' and ' + nb + ': ' + api.assert.show(a) + ' × ' + api.assert.show(b));
            }
          }
        },
        {
          name: 'zero and single digits do not break the recursion',
          assert: function (multiply, api) {
            api.assert.deepEqual(multiply([0], [0]).digits, [0], '0 × 0');
            api.assert.deepEqual(multiply([0], [1, 2, 3]).digits, [0], '0 × 321');
            api.assert.deepEqual(multiply([7], [6]).digits, [2, 4], '7 × 6 = 42, little-endian');
            api.assert.deepEqual(multiply([1], [9, 9, 9]).digits, [9, 9, 9], '1 × 999');
            api.assert.deepEqual(multiply([9, 9], [9, 9]).digits, [1, 0, 8, 9], '99 × 99 = 9801');
          }
        },
        {
          name: 'it does far fewer than n² digit products',
          assert: function (multiply, api) {
            const random = api.rng;
            const a = [];
            const b = [];
            for (let i = 0; i < 256; i += 1) { a.push(random.int(10)); b.push(random.int(10)); }
            a[255] = Math.max(1, a[255]);
            b[255] = Math.max(1, b[255]);

            const run = multiply(a, b);
            api.assert.atMost(run.products, 20000,
              'schoolbook does 65 536 products at 256 digits; Karatsuba should be near 11 000. Got ' + run.products);
            api.assert.atLeast(run.products, 1000, 'the products still have to happen');
          }
        },
        {
          name: 'the count scales like n^1.585, not like n²',
          assert: function (multiply, api) {
            const random = api.rng;
            function operandsOf(n) {
              const a = [];
              const b = [];
              for (let i = 0; i < n; i += 1) { a.push(random.int(10)); b.push(random.int(10)); }
              a[n - 1] = Math.max(1, a[n - 1]);
              b[n - 1] = Math.max(1, b[n - 1]);
              return [a, b];
            }

            const small = operandsOf(64);
            const large = operandsOf(256);
            const ratio = multiply(large[0], large[1]).products /
              Math.max(1, multiply(small[0], small[1]).products);

            api.assert.atMost(ratio, 12,
              'quadrupling n multiplies n² by 16 and n^1.585 by about 9. Got a ratio of ' + ratio.toFixed(1));
          }
        }
      ]
    }],

    'greedy-algorithms': [{
      id: 'greedy-toolkit',
      title: 'the scheduler with a proof, and the checker that finds the coin systems without one',
      prompt: 'greedyToolkit() must return { schedule, isCanonical }. schedule(intervals) takes objects with ' +
        'start and end and returns the largest set of pairwise non-overlapping intervals — use the ' +
        'earliest-finish-time rule, which is the one of the four plausible criteria that has an exchange ' +
        'argument. isCanonical(denominations) decides whether greedy change-making is optimal for that coin ' +
        'set, returning { canonical, witness }, where witness is the smallest amount greedy gets wrong or ' +
        'null. Pearson\'s result bounds the search: a non-canonical system has a counter-example below the ' +
        'sum of the two largest coins, so a sweep of that range settles it. The starter schedules by ' +
        'earliest start and checks coins only as far as the largest one.',
      entry: 'greedyToolkit',
      starter: [
        'function greedyToolkit() {',
        '  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }',
        '',
        '  // earliest start: plausible, and it loses on four intervals',
        '  function schedule(intervals) {',
        '    const order = intervals.slice().sort(function (a, b) { return a.start - b.start; });',
        '    const chosen = [];',
        '    order.forEach(function (interval) {',
        '      if (chosen.every(function (taken) { return !overlaps(taken, interval); })) chosen.push(interval);',
        '    });',
        '    return chosen;',
        '  }',
        '',
        '  function greedyCoins(coins, amount) {',
        '    let remaining = amount;',
        '    let used = 0;',
        '    coins.slice().sort(function (a, b) { return b - a; }).forEach(function (coin) {',
        '      const take = Math.floor(remaining / coin);',
        '      used += take;',
        '      remaining -= take * coin;',
        '    });',
        '    return remaining === 0 ? used : Infinity;',
        '  }',
        '',
        '  function optimalCoins(coins, amount) {',
        '    const best = new Array(amount + 1).fill(Infinity);',
        '    best[0] = 0;',
        '    for (let value = 1; value <= amount; value += 1) {',
        '      coins.forEach(function (coin) {',
        '        if (coin <= value && best[value - coin] + 1 < best[value]) best[value] = best[value - coin] + 1;',
        '      });',
        '    }',
        '    return best[amount];',
        '  }',
        '',
        '  // only as far as the largest coin, which misses most witnesses',
        '  function isCanonical(denominations) {',
        '    const coins = denominations.slice().sort(function (a, b) { return a - b; });',
        '    const limit = coins[coins.length - 1];',
        '    for (let amount = 1; amount <= limit; amount += 1) {',
        '      if (greedyCoins(coins, amount) > optimalCoins(coins, amount)) {',
        '        return { canonical: false, witness: amount };',
        '      }',
        '    }',
        '    return { canonical: true, witness: null };',
        '  }',
        '',
        '  return { schedule: schedule, isCanonical: isCanonical };',
        '}'
      ].join('\n'),
      solution: [
        'function greedyToolkit() {',
        '  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }',
        '',
        '  // earliest finish time: the interval that ends soonest leaves the most',
        '  // timeline for everything after it, which is the exchange argument',
        '  function schedule(intervals) {',
        '    const order = intervals.slice().sort(function (a, b) {',
        '      return a.end - b.end || a.start - b.start;',
        '    });',
        '    const chosen = [];',
        '    let lastEnd = -Infinity;',
        '    order.forEach(function (interval) {',
        '      if (interval.start < lastEnd) return;',
        '      chosen.push(interval);',
        '      lastEnd = interval.end;',
        '    });',
        '    return chosen;',
        '  }',
        '',
        '  function greedyCoins(coins, amount) {',
        '    let remaining = amount;',
        '    let used = 0;',
        '    for (let i = coins.length - 1; i >= 0; i -= 1) {',
        '      const take = Math.floor(remaining / coins[i]);',
        '      used += take;',
        '      remaining -= take * coins[i];',
        '    }',
        '    return remaining === 0 ? used : Infinity;',
        '  }',
        '',
        '  function optimalCoins(coins, limit) {',
        '    const best = new Array(limit + 1).fill(Infinity);',
        '    best[0] = 0;',
        '    for (let value = 1; value <= limit; value += 1) {',
        '      for (let i = 0; i < coins.length; i += 1) {',
        '        if (coins[i] <= value && best[value - coins[i]] + 1 < best[value]) {',
        '          best[value] = best[value - coins[i]] + 1;',
        '        }',
        '      }',
        '    }',
        '    return best;',
        '  }',
        '',
        '  // Pearson: a non-canonical system has a witness below the sum of the',
        '  // two largest coins, so this sweep decides the question either way',
        '  function isCanonical(denominations) {',
        '    const coins = denominations.slice().sort(function (a, b) { return a - b; });',
        '    if (coins[0] !== 1) return { canonical: false, witness: null };',
        '',
        '    const limit = coins[coins.length - 1] + coins[Math.max(0, coins.length - 2)];',
        '    const best = optimalCoins(coins, limit);',
        '    for (let amount = 1; amount <= limit; amount += 1) {',
        '      if (greedyCoins(coins, amount) > best[amount]) {',
        '        return { canonical: false, witness: amount };',
        '      }',
        '    }',
        '    return { canonical: true, witness: null };',
        '  }',
        '',
        '  return { schedule: schedule, isCanonical: isCanonical };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the schedule is optimal on every random instance, against an exact oracle',
          assert: function (greedyToolkit, api) {
            const random = api.rng;
            const tools = greedyToolkit();

            for (let trial = 0; trial < 200; trial += 1) {
              const count = 3 + random.int(10);
              const span = 8 + random.int(14);
              const intervals = [];
              for (let i = 0; i < count; i += 1) {
                const start = random.int(span);
                intervals.push({ start: start, end: start + 1 + random.int(Math.max(1, span - start)) });
              }

              const sorted = intervals.slice().sort(function (a, b) { return a.end - b.end; });
              const best = new Array(sorted.length + 1).fill(0);
              for (let i = 0; i < sorted.length; i += 1) {
                let previous = i;
                while (previous > 0 && sorted[previous - 1].end > sorted[i].start) previous -= 1;
                best[i + 1] = Math.max(best[i], best[previous] + 1);
              }

              const got = tools.schedule(intervals);
              api.assert.equal(got.length, best[sorted.length],
                'trial ' + trial + ' with ' + count + ' intervals');
            }
          }
        },
        {
          name: 'the schedule it returns is actually feasible',
          assert: function (greedyToolkit, api) {
            const random = api.rng;
            const tools = greedyToolkit();
            const intervals = [];
            for (let i = 0; i < 40; i += 1) {
              const start = random.int(30);
              intervals.push({ start: start, end: start + 1 + random.int(Math.max(1, 30 - start)) });
            }

            const chosen = tools.schedule(intervals).slice()
              .sort(function (a, b) { return a.start - b.start; });
            for (let i = 1; i < chosen.length; i += 1) {
              api.assert.ok(chosen[i - 1].end <= chosen[i].start,
                'overlap between ' + api.assert.show(chosen[i - 1]) + ' and ' + api.assert.show(chosen[i]));
            }
            api.assert.atLeast(chosen.length, 1, 'a non-empty instance has a non-empty schedule');
          }
        },
        {
          name: 'the canonical systems are accepted and the witnesses are exact',
          assert: function (greedyToolkit, api) {
            const tools = greedyToolkit();

            api.assert.equal(tools.isCanonical([1, 5, 10, 25]).canonical, true, 'US coins');
            api.assert.equal(tools.isCanonical([1, 2, 5, 10, 20, 50]).canonical, true, 'euro coins');

            const three = tools.isCanonical([1, 3, 4]);
            api.assert.equal(three.canonical, false, '1, 3, 4 is not canonical');
            api.assert.equal(three.witness, 6, 'the smallest witness for 1, 3, 4');

            const seven = tools.isCanonical([1, 7, 10]);
            api.assert.equal(seven.canonical, false, '1, 7, 10 is not canonical');
            api.assert.equal(seven.witness, 14, 'the smallest witness for 1, 7, 10');
          }
        },
        {
          name: 'the search reaches past the largest coin, which is where witnesses hide',
          assert: function (greedyToolkit, api) {
            const tools = greedyToolkit();

            const fifteen = tools.isCanonical([1, 15, 25]);
            api.assert.equal(fifteen.canonical, false, '1, 15, 25 is not canonical');
            api.assert.equal(fifteen.witness, 30,
              'the witness is 30 — above the largest coin, so a sweep to 25 misses it');

            const wide = tools.isCanonical([1, 5, 11]);
            api.assert.equal(wide.canonical, false, '1, 5, 11 is not canonical');
            api.assert.equal(wide.witness, 15,
              'its witness is 15 — above the largest coin, so a sweep to 11 misses it as well');
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
