/**
 * Graded exercises for the advanced dynamic-programming sections (M12.9-M12.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'dp-optimisations': [{
      id: 'convex-hull-trick',
      title: 'the convex hull trick, and the precondition that licenses it',
      prompt: 'groupCost(values, penalty) must return { value, transitions, monotone }: the minimum of ' +
        'dp[j] = min over i of dp[i] + (P[j] − P[i])² + penalty, how many candidate evaluations the ' +
        'transition performed, and whether the preconditions held. The starter tries every earlier split, ' +
        'which is O(n²) and always correct. Expand the square: dp[j] = P[j]² + penalty + min over i of ' +
        '((−2·P[i])·P[j] + dp[i] + P[i]²), which is the minimum of a set of LINES evaluated at x = P[j]. ' +
        'Maintain the lower envelope on a stack and answer each query with a forward-only pointer. Both ' +
        'preconditions — slopes must not increase, queries must not decrease — hold only when the prefix ' +
        'sums are non-decreasing, so CHECK that and fall back to the quadratic search when it fails. A ' +
        'narrowed search on data that does not satisfy it is faster and silently wrong.',
      entry: 'groupCost',
      starter: [
        'function groupCost(values, penalty) {',
        '  const n = values.length;',
        '  const prefix = [0];',
        '  for (let i = 0; i < n; i += 1) prefix.push(prefix[i] + values[i]);',
        '',
        '  const dp = new Array(n + 1).fill(Infinity);',
        '  dp[0] = 0;',
        '  let transitions = 0;',
        '',
        '  // every earlier split, always',
        '  for (let j = 1; j <= n; j += 1) {',
        '    for (let i = 0; i < j; i += 1) {',
        '      transitions += 1;',
        '      const width = prefix[j] - prefix[i];',
        '      const candidate = dp[i] + width * width + penalty;',
        '      if (candidate < dp[j]) dp[j] = candidate;',
        '    }',
        '  }',
        '',
        '  return { value: dp[n], transitions: transitions, monotone: true };',
        '}'
      ].join('\n'),
      solution: [
        'function groupCost(values, penalty) {',
        '  const n = values.length;',
        '  const prefix = [0];',
        '  for (let i = 0; i < n; i += 1) prefix.push(prefix[i] + values[i]);',
        '',
        '  let monotone = true;',
        '  for (let i = 1; i <= n; i += 1) {',
        '    if (prefix[i] >= prefix[i - 1]) continue;',
        '    monotone = false;',
        '    break;',
        '  }',
        '',
        '  const dp = new Array(n + 1).fill(Infinity);',
        '  dp[0] = 0;',
        '  let transitions = 0;',
        '',
        '  if (!monotone) {',
        '    for (let j = 1; j <= n; j += 1) {',
        '      for (let i = 0; i < j; i += 1) {',
        '        transitions += 1;',
        '        const width = prefix[j] - prefix[i];',
        '        const candidate = dp[i] + width * width + penalty;',
        '        if (candidate < dp[j]) dp[j] = candidate;',
        '      }',
        '    }',
        '    return { value: dp[n], transitions: transitions, monotone: false };',
        '  }',
        '',
        '  const lines = [];',
        '  let pointer = 0;',
        '',
        '  function bad(a, b, c) {',
        '    return (c.c - a.c) * (a.m - b.m) <= (b.c - a.c) * (a.m - c.m);',
        '  }',
        '',
        '  function add(m, c) {',
        '    const line = { m: m, c: c };',
        '    while (lines.length >= 2 && bad(lines[lines.length - 2], lines[lines.length - 1], line)) {',
        '      lines.pop();',
        '      if (pointer >= lines.length) pointer = Math.max(0, lines.length - 1);',
        '    }',
        '    lines.push(line);',
        '  }',
        '',
        '  function query(x) {',
        '    while (pointer + 1 < lines.length &&',
        '           lines[pointer + 1].m * x + lines[pointer + 1].c <=',
        '           lines[pointer].m * x + lines[pointer].c) {',
        '      pointer += 1;',
        '      transitions += 1;',
        '    }',
        '    transitions += 1;',
        '    return lines[pointer].m * x + lines[pointer].c;',
        '  }',
        '',
        '  add(-2 * prefix[0], dp[0] + prefix[0] * prefix[0]);',
        '  for (let j = 1; j <= n; j += 1) {',
        '    const x = prefix[j];',
        '    dp[j] = query(x) + x * x + penalty;',
        '    add(-2 * prefix[j], dp[j] + prefix[j] * prefix[j]);',
        '  }',
        '',
        '  return { value: dp[n], transitions: transitions, monotone: true };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the value matches the quadratic reference on random non-negative data',
          assert: function (groupCost, api) {
            function reference(values, penalty) {
              const n = values.length;
              const prefix = [0];

              for (let i = 0; i < n; i += 1) prefix.push(prefix[i] + values[i]);
              const dp = new Array(n + 1).fill(Infinity);
              dp[0] = 0;

              for (let j = 1; j <= n; j += 1) {
                for (let i = 0; i < j; i += 1) {
                  const width = prefix[j] - prefix[i];
                  dp[j] = Math.min(dp[j], dp[i] + width * width + penalty);
                }
              }
              return dp[n];
            }

            for (let trial = 0; trial < 10; trial += 1) {
              const values = [];

              for (let i = 0; i < 60; i += 1) values.push(1 + api.rng.int(20));
              const penalty = 10 + api.rng.int(100);
              api.assert.equal(groupCost(values, penalty).value, reference(values, penalty),
                'trial ' + trial);
            }
          }
        },
        {
          name: 'the transition count is linear rather than quadratic',
          assert: function (groupCost, api) {
            [100, 200, 400].forEach(function (n) {
              const values = [];

              for (let i = 0; i < n; i += 1) values.push(1 + api.rng.int(20));
              const run = groupCost(values, 50);
              api.assert.atMost(run.transitions, 8 * n,
                'at n = ' + n + ' the quadratic version does ' + (n * (n + 1) / 2) +
                  ' transitions; a hull should be a small multiple of n. Got ' + run.transitions);
            });
          }
        },
        {
          name: 'the preconditions are checked rather than assumed',
          assert: function (groupCost, api) {
            const positive = [3, 1, 4, 1, 5, 9, 2, 6];
            api.assert.equal(groupCost(positive, 10).monotone, true,
              'non-negative values keep the prefix sums non-decreasing');

            const mixed = [3, -5, 4, 2, -1, 6, -2, 8];
            api.assert.equal(groupCost(mixed, 10).monotone, false,
              'a negative value makes the prefix sums fall, so both preconditions break');
          }
        },
        {
          name: 'the answer stays correct when the preconditions do not hold',
          assert: function (groupCost, api) {
            function reference(values, penalty) {
              const n = values.length;
              const prefix = [0];

              for (let i = 0; i < n; i += 1) prefix.push(prefix[i] + values[i]);
              const dp = new Array(n + 1).fill(Infinity);
              dp[0] = 0;

              for (let j = 1; j <= n; j += 1) {
                for (let i = 0; i < j; i += 1) {
                  const width = prefix[j] - prefix[i];
                  dp[j] = Math.min(dp[j], dp[i] + width * width + penalty);
                }
              }
              return dp[n];
            }

            for (let trial = 0; trial < 8; trial += 1) {
              const values = [];

              for (let i = 0; i < 40; i += 1) values.push(api.rng.int(21) - 10);
              const penalty = 5 + api.rng.int(50);
              api.assert.equal(groupCost(values, penalty).value, reference(values, penalty),
                'trial ' + trial + ': falling back must still be correct, not merely refuse');
            }
          }
        }
      ]
    }],

    'game-dp': [{
      id: 'grundy-of-a-sum',
      title: 'Grundy numbers, and the XOR that replaces a product state space',
      prompt: 'gameWinner(heaps, allowed) must return { grundy, firstPlayerWins }: the Grundy value of a sum ' +
        'of subtraction games — each heap may lose any amount in `allowed` — and whether the player to ' +
        'move wins. The starter searches the JOINT state space over all heaps at once, which is correct ' +
        'and exponential in the number of heaps; the grader uses six heaps of forty, where that is not an ' +
        'option. Compute a Grundy table for ONE heap using the minimum excludant of the reachable values, ' +
        'then XOR the heaps\' values together. The result is exact, not an approximation: a position is ' +
        'lost exactly when the XOR is zero.',
      entry: 'gameWinner',
      starterFailure: 'timeout',
      starter: [
        'function gameWinner(heaps, allowed) {',
        '  const memo = new Map();',
        '',
        '  // the whole product state space',
        '  function winning(state) {',
        '    const key = state.join(",");',
        '    if (memo.has(key)) return memo.get(key);',
        '    let result = false;',
        '    for (let i = 0; i < state.length && !result; i += 1) {',
        '      for (let a = 0; a < allowed.length && !result; a += 1) {',
        '        if (allowed[a] > state[i]) continue;',
        '        const child = state.slice();',
        '        child[i] = state[i] - allowed[a];',
        '        if (!winning(child)) result = true;',
        '      }',
        '    }',
        '    memo.set(key, result);',
        '    return result;',
        '  }',
        '',
        '  const wins = winning(heaps.slice());',
        '  return { grundy: wins ? 1 : 0, firstPlayerWins: wins };',
        '}'
      ].join('\n'),
      solution: [
        'function gameWinner(heaps, allowed) {',
        '  let limit = 0;',
        '  heaps.forEach(function (heap) { if (heap > limit) limit = heap; });',
        '',
        '  const grundy = new Array(limit + 1).fill(0);',
        '  for (let size = 0; size <= limit; size += 1) {',
        '    const seen = new Set();',
        '    allowed.forEach(function (take) {',
        '      if (take > size) return;',
        '      seen.add(grundy[size - take]);',
        '    });',
        '    let mex = 0;',
        '    while (seen.has(mex)) mex += 1;',
        '    grundy[size] = mex;',
        '  }',
        '',
        '  let total = 0;',
        '  heaps.forEach(function (heap) { total ^= grundy[heap]; });',
        '  return { grundy: total, firstPlayerWins: total !== 0 };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the Grundy sequence of a single heap is right',
          assert: function (gameWinner, api) {
            // {1,3,4} has the well-known period-7 sequence 0,1,0,1,2,3,2
            const expected = [0, 1, 0, 1, 2, 3, 2, 0, 1, 0, 1, 2, 3, 2];

            expected.forEach(function (value, size) {
              api.assert.equal(gameWinner([size], [1, 3, 4]).grundy, value,
                'heap of ' + size + ' under {1,3,4}');
            });
          }
        },
        {
          name: 'the winner agrees with a joint search on small instances',
          assert: function (gameWinner, api) {
            function joint(heaps, allowed) {
              const memo = new Map();

              function winning(state) {
                const key = state.join(',');

                if (memo.has(key)) return memo.get(key);
                let result = false;

                for (let i = 0; i < state.length && !result; i += 1) {
                  for (let a = 0; a < allowed.length && !result; a += 1) {
                    if (allowed[a] > state[i]) continue;
                    const child = state.slice();
                    child[i] = state[i] - allowed[a];

                    if (!winning(child)) result = true;
                  }
                }
                memo.set(key, result);
                return result;
              }
              return winning(heaps.slice());
            }
            const sets = [[1, 3, 4], [1, 2], [2, 3, 5], [1, 2, 3]];

            sets.forEach(function (allowed) {
              for (let trial = 0; trial < 6; trial += 1) {
                const heaps = [1 + api.rng.int(9), 1 + api.rng.int(9), 1 + api.rng.int(9)];
                api.assert.equal(gameWinner(heaps, allowed).firstPlayerWins, joint(heaps, allowed),
                  'heaps [' + heaps.join(',') + '] under {' + allowed.join(',') + '}');
              }
            });
          }
        },
        {
          name: 'the XOR is the Grundy value of the sum, not a boolean',
          assert: function (gameWinner, api) {
            // under {1,2} the Grundy value is size mod 3
            api.assert.equal(gameWinner([4], [1, 2]).grundy, 1, '4 mod 3');
            api.assert.equal(gameWinner([5], [1, 2]).grundy, 2, '5 mod 3');
            api.assert.equal(gameWinner([4, 5], [1, 2]).grundy, 3, '1 XOR 2');
            api.assert.equal(gameWinner([4, 5, 3], [1, 2]).grundy, 3, '1 XOR 2 XOR 0');
            api.assert.equal(gameWinner([4, 4], [1, 2]).grundy, 0, 'two equal heaps cancel');
            api.assert.equal(gameWinner([4, 4], [1, 2]).firstPlayerWins, false, 'and that is a loss');
          }
        },
        {
          name: 'six heaps of forty are answered without building the product',
          assert: function (gameWinner, api) {
            const heaps = [40, 39, 38, 37, 36, 35];
            const run = gameWinner(heaps, [1, 3, 4]);
            api.assert.ok(typeof run.grundy === 'number', 'a Grundy value must come back');
            api.assert.equal(run.firstPlayerWins, run.grundy !== 0,
              'the verdict must follow from the XOR');

            // 41^6 joint states is about 4.75e9 — the whole point is not to build it
            const same = gameWinner([40, 40, 40, 40, 40, 40], [1, 3, 4]);
            api.assert.equal(same.grundy, 0, 'six identical heaps cancel in pairs');
            api.assert.equal(same.firstPlayerWins, false, 'so the player to move loses');
          }
        }
      ]
    }],

    'expectation-dp': [{
      id: 'expected-rolls-with-cycles',
      title: 'an expectation a recursion cannot compute',
      prompt: 'expectedRolls(size, faces, snakes) must return the expected number of rolls to reach square ' +
        '`size` from square 0, where a roll that would pass the end leaves you where you are and `snakes` ' +
        'maps a square to the square it sends you to. The starter is a memoised recursion, which is ' +
        'correct on a board where every move goes forwards and never terminates here — the overshoot rule ' +
        'is a self-loop, so E[s] depends on E[s]. Build the linear system instead: ' +
        'E[s] − Σ p(s→t)·E[t] = 1 for each transient square, and solve it by Gaussian elimination with ' +
        'PARTIAL PIVOTING. Without pivoting a zero on the diagonal gives Infinity, then NaN, propagated ' +
        'far from the row that actually failed.',
      entry: 'expectedRolls',
      starterFailure: 'timeout',
      starter: [
        'function expectedRolls(size, faces, snakes) {',
        '  const jump = snakes || {};',
        '  const memo = new Map();',
        '',
        '  // assumes every move goes forwards; the overshoot rule is a self-loop,',
        '  // so this asks E[s] for E[s] and never finishes',
        '  function expected(square) {',
        '    if (square === size) return 0;',
        '    if (memo.has(square)) return memo.get(square);',
        '    let total = 1;',
        '    for (let roll = 1; roll <= faces; roll += 1) {',
        '      let landed = square + roll > size ? square : square + roll;',
        '      if (jump[landed] !== undefined) landed = jump[landed];',
        '      total += expected(landed) / faces;',
        '    }',
        '    memo.set(square, total);',
        '    return total;',
        '  }',
        '  return expected(0);',
        '}'
      ].join('\n'),
      solution: [
        'function expectedRolls(size, faces, snakes) {',
        '  const jump = snakes || {};',
        '  const n = size; // transient squares are 0 .. size - 1',
        '  const matrix = [];',
        '',
        '  for (let square = 0; square < n; square += 1) {',
        '    const row = new Array(n + 1).fill(0);',
        '    row[square] = 1;',
        '    row[n] = 1;',
        '    for (let roll = 1; roll <= faces; roll += 1) {',
        '      let landed = square + roll > size ? square : square + roll;',
        '      if (jump[landed] !== undefined) landed = jump[landed];',
        '      if (landed === size) continue;',
        '      row[landed] -= 1 / faces;',
        '    }',
        '    matrix.push(row);',
        '  }',
        '',
        '  // partial pivoting: a square with no self-loop puts a zero on the diagonal',
        '  for (let column = 0; column < n; column += 1) {',
        '    let pivot = column;',
        '    for (let r = column + 1; r < n; r += 1) {',
        '      if (Math.abs(matrix[r][column]) <= Math.abs(matrix[pivot][column])) continue;',
        '      pivot = r;',
        '    }',
        '    const swap = matrix[column];',
        '    matrix[column] = matrix[pivot];',
        '    matrix[pivot] = swap;',
        '    if (Math.abs(matrix[column][column]) < 1e-12) continue;',
        '    for (let r = column + 1; r < n; r += 1) {',
        '      const factor = matrix[r][column] / matrix[column][column];',
        '      if (factor === 0) continue;',
        '      for (let k = column; k <= n; k += 1) matrix[r][k] -= factor * matrix[column][k];',
        '    }',
        '  }',
        '',
        '  const out = new Array(n).fill(0);',
        '  for (let r = n - 1; r >= 0; r -= 1) {',
        '    let value = matrix[r][n];',
        '    for (let c = r + 1; c < n; c += 1) value -= matrix[r][c] * out[c];',
        '    out[r] = Math.abs(matrix[r][r]) < 1e-12 ? Infinity : value / matrix[r][r];',
        '  }',
        '  return out[0];',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the simplest boards are right',
          assert: function (expectedRolls, api) {
            // one square away with a one-sided die: exactly one roll
            api.assert.closeTo(expectedRolls(1, 1, {}), 1, 1e-9, 'one square, a d1');
            api.assert.closeTo(expectedRolls(3, 1, {}), 3, 1e-9, 'three squares, a d1');
            // a d2 board of 1: half the rolls overshoot and stay put, so E = 2
            api.assert.closeTo(expectedRolls(1, 2, {}), 2, 1e-9, 'one square, a d2 — half the rolls waste');
            api.assert.closeTo(expectedRolls(1, 6, {}), 6, 1e-9, 'one square, a d6 — five sixths waste');
          }
        },
        {
          name: 'it agrees with a simulation of the same rules',
          assert: function (expectedRolls, api) {
            function simulate(size, faces, snakes, trials, rng) {
              const jump = snakes || {};
              let total = 0;

              for (let trial = 0; trial < trials; trial += 1) {
                let square = 0;
                let rolls = 0;

                while (square !== size && rolls < 100000) {
                  const roll = 1 + rng.int(faces);
                  let landed = square + roll > size ? square : square + roll;

                  if (jump[landed] !== undefined) landed = jump[landed];
                  square = landed;
                  rolls += 1;
                }
                total += rolls;
              }
              return total / trials;
            }
            const exact = expectedRolls(20, 6, {});
            const mean = simulate(20, 6, {}, 40000, api.rng);
            api.assert.closeTo(mean, exact, 0.35,
              'the simulation gave ' + mean.toFixed(4) + ' against an exact ' + exact.toFixed(4));
          }
        },
        {
          name: 'snakes make it harder, and are handled by the same solve',
          assert: function (expectedRolls, api) {
            const plain = expectedRolls(20, 6, {});
            const snaked = expectedRolls(20, 6, { 17: 4, 13: 2 });
            api.assert.ok(snaked > plain,
              'two snakes must increase the expected rolls: got ' + snaked.toFixed(4) +
                ' against ' + plain.toFixed(4));

            const laddered = expectedRolls(20, 6, { 4: 12, 7: 15 });
            api.assert.ok(laddered < plain,
              'two ladders must decrease it: got ' + laddered.toFixed(4) +
                ' against ' + plain.toFixed(4));
            api.assert.ok(Number.isFinite(snaked), 'the answer must be a finite number, not NaN or Infinity');
            api.assert.ok(Number.isFinite(laddered), 'and so must this one');
          }
        },
        {
          name: 'a large board is solved without recursing forever',
          assert: function (expectedRolls, api) {
            const big = expectedRolls(60, 6, { 55: 10, 48: 20, 33: 5 });
            api.assert.ok(Number.isFinite(big), 'a 60-square board with three snakes must return a number');
            api.assert.ok(big > 20, 'it should take well over 20 rolls; got ' + big.toFixed(4));
            api.assert.ok(big < 500, 'and it should be nowhere near 500; got ' + big.toFixed(4));

            // the answer must not depend on unreachable decoration
            const same = expectedRolls(60, 6, { 55: 10, 48: 20, 33: 5 });
            api.assert.closeTo(same, big, 1e-9, 'the solve must be deterministic');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
