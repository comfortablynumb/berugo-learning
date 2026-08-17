/**
 * Graded exercises for the analysis sections (M01).
 * Tests are serialised into the sandbox, so each one is self-contained.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'asymptotic-notation': [{
      id: 'smallest-witness',
      title: 'Find the smallest witness constant',
      prompt: 'smallestC(f, g, n0, upTo) returns the smallest constant c for which f(n) ≤ c·g(n) ' +
        'holds at every integer n in [n0, upTo], or null when g(n) is zero somewhere it would be ' +
        'needed. That constant is max f(n)/g(n) over the range — a witness is only a witness if one ' +
        'fixed number works everywhere.',
      entry: 'smallestC',
      starter: [
        'function smallestC(f, g, n0, upTo) {',
        '  // return the smallest c with f(n) <= c*g(n) for all n in [n0, upTo]',
        '  return 1;',
        '}'
      ].join('\n'),
      solution: [
        'function smallestC(f, g, n0, upTo) {',
        '  let needed = 0;',
        '  for (let n = n0; n <= upTo; n += 1) {',
        '    const bottom = g(n);',
        '    if (bottom === 0) {',
        '      if (f(n) > 0) return null;',
        '      continue;',
        '    }',
        '    needed = Math.max(needed, f(n) / bottom);',
        '  }',
        '  return needed;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'n log n against n²: a small constant suffices',
          assert: function (smallestC, api) {
            const c = smallestC(function (n) { return n * Math.log2(n); }, function (n) { return n * n; }, 1, 1000);
            api.assert.ok(c <= 1, 'expected c ≤ 1, got ' + c);
            api.assert.closeTo(c, 0.5283, 0.001, 'the maximum of log2(n)/n is at n = 3');
          } },
        { name: 'n² against n log n: the constant grows with the range',
          assert: function (smallestC, api) {
            const f = function (n) { return n * n; };
            const g = function (n) { return n * Math.log2(n); };
            const small = smallestC(f, g, 2, 100);
            const large = smallestC(f, g, 2, 10000);
            api.assert.ok(large > small * 5, 'a growing requirement means there is no witness: ' +
              small.toFixed(1) + ' → ' + large.toFixed(1));
          } },
        { name: 'equal functions need exactly c = 1',
          assert: function (smallestC, api) {
            const f = function (n) { return 3 * n + 7; };
            api.assert.closeTo(smallestC(f, f, 1, 500), 1, 1e-12);
          } },
        { name: 'the threshold n0 is respected',
          assert: function (smallestC, api) {
            // f is huge only at n = 1, so starting at n0 = 2 must ignore it.
            const f = function (n) { return n === 1 ? 1000 : n; };
            const g = function (n) { return n; };
            api.assert.closeTo(smallestC(f, g, 2, 100), 1, 1e-12, 'below n0 must not count');
            api.assert.closeTo(smallestC(f, g, 1, 100), 1000, 1e-9, 'at n0 = 1 it must count');
          } }
      ]
    }],

    recurrences: [{
      id: 'level-work',
      title: 'Sum a recursion tree level by level',
      prompt: 'levelWork(a, b, k, n) returns an array whose i-th entry is the total work at depth i ' +
        'of T(n) = a·T(n/b) + f(n) with f(x) = x^k. Stop once the subproblem size drops below 1. ' +
        'The shape of this array is what decides the master case.',
      entry: 'levelWork',
      starter: [
        'function levelWork(a, b, k, n) {',
        '  const levels = [];',
        '  // depth i has a^i subproblems of size n / b^i',
        '  return levels;',
        '}'
      ].join('\n'),
      solution: [
        'function levelWork(a, b, k, n) {',
        '  const levels = [];',
        '  let size = n;',
        '  let count = 1;',
        '  while (size >= 1) {',
        '    levels.push(count * Math.pow(size, k));',
        '    size = size / b;',
        '    count *= a;',
        '  }',
        '  return levels;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'merge sort: every level costs n',
          assert: function (levelWork, api) {
            const levels = levelWork(2, 2, 1, 1024);
            api.assert.equal(levels.length, 11, 'depths 0..10 inclusive');
            levels.forEach(function (work, depth) {
              api.assert.closeTo(work, 1024, 1e-9, 'level ' + depth);
            });
          } },
        { name: 'binary search: one subproblem, constant work per level',
          assert: function (levelWork, api) {
            const levels = levelWork(1, 2, 0, 1024);
            api.assert.equal(levels.length, 11);
            api.assert.closeTo(levels.reduce(function (a, b) { return a + b; }, 0), 11, 1e-9);
          } },
        { name: 'leaf-heavy: work grows down the tree',
          assert: function (levelWork, api) {
            const levels = levelWork(4, 2, 1, 1024);
            api.assert.closeTo(levels[0], 1024, 1e-9, 'root');
            api.assert.ok(levels[levels.length - 1] > levels[0] * 100,
              'the bottom level should dominate in case 1');
            for (let i = 1; i < levels.length; i += 1) {
              api.assert.ok(levels[i] > levels[i - 1], 'monotone increase at depth ' + i);
            }
          } },
        { name: 'root-heavy: work shrinks down the tree',
          assert: function (levelWork, api) {
            const levels = levelWork(2, 2, 2, 1024);
            for (let i = 1; i < levels.length; i += 1) {
              api.assert.ok(levels[i] < levels[i - 1], 'monotone decrease at depth ' + i);
            }
            const total = levels.reduce(function (a, b) { return a + b; }, 0);
            api.assert.ok(total < 2 * levels[0], 'a shrinking geometric series stays near its first term');
          } }
      ]
    }],

    'amortised-analysis': [{
      id: 'potential',
      title: 'Choose a potential that pays for the copy',
      prompt: 'Implement potential(size, capacity) for a doubling array so that the amortised cost ' +
        'of every push is bounded by a small constant. It must be non-negative, zero immediately ' +
        'after a grow, and large enough just before the next one to cover copying `size` elements.',
      entry: 'potential',
      starter: [
        'function potential(size, capacity) {',
        '  // amortised cost = real cost + potential(after) - potential(before)',
        '  return 0;',
        '}'
      ].join('\n'),
      solution: [
        'function potential(size, capacity) {',
        '  return 2 * size - capacity;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'non-negative whenever the array is at least half full',
          assert: function (potential, api) {
            for (let capacity = 1; capacity <= 1024; capacity *= 2) {
              for (let size = Math.ceil(capacity / 2); size <= capacity; size += 1) {
                api.assert.atLeast(potential(size, capacity), 0, 'size ' + size + '/' + capacity);
              }
            }
          } },
        { name: 'zero right after a doubling grow',
          assert: function (potential, api) {
            [1, 2, 4, 8, 512].forEach(function (size) {
              api.assert.equal(potential(size, size * 2), 0, 'after growing from ' + size);
            });
          } },
        { name: 'amortised cost of every push stays under 4',
          assert: function (potential, api) {
            let size = 0;
            let capacity = 1;
            for (let push = 0; push < 2048; push += 1) {
              const before = potential(size, capacity);
              let cost = 1;
              if (size === capacity) { cost += size; capacity *= 2; }
              size += 1;
              const amortised = cost + potential(size, capacity) - before;
              api.assert.atMost(amortised, 4, 'push ' + push + ' (size ' + size + ')');
              api.assert.atLeast(amortised, 0, 'push ' + push + ' must not be free');
            }
          } }
      ]
    }],

    'average-case': [{
      id: 'expected-comparisons',
      title: 'Compute quicksort\'s expected comparisons exactly',
      prompt: 'expected(n) returns the exact expected number of comparisons for randomised ' +
        'quicksort on n distinct elements: the sum over all pairs of 2/(gap + 1), where gap is the ' +
        'difference in rank. Derive it with indicator variables rather than a recurrence.',
      entry: 'expected',
      starter: [
        'function expected(n) {',
        '  // pairs at rank distance g are compared with probability 2 / (g + 1)',
        '  return 0;',
        '}'
      ].join('\n'),
      solution: [
        'function expected(n) {',
        '  let total = 0;',
        '  for (let gap = 1; gap < n; gap += 1) {',
        '    total += (n - gap) * (2 / (gap + 1));',
        '  }',
        '  return total;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'small cases match a direct pair-by-pair sum',
          assert: function (expected, api) {
            [2, 3, 5, 10, 40].forEach(function (n) {
              let brute = 0;
              for (let i = 1; i <= n; i += 1) {
                for (let j = i + 1; j <= n; j += 1) brute += 2 / (j - i + 1);
              }
              api.assert.closeTo(expected(n), brute, 1e-9, 'n = ' + n);
            });
          } },
        { name: 'n = 100 lands on the documented value',
          assert: function (expected, api) {
            api.assert.closeTo(expected(100), 647.85, 0.05);
          } },
        { name: 'it tracks 2n ln n from below',
          assert: function (expected, api) {
            [100, 500, 2000].forEach(function (n) {
              const approximation = 2 * n * Math.log(n);
              api.assert.ok(expected(n) < approximation, 'exact should be below 2n ln n at n = ' + n);
              api.assert.ok(expected(n) > approximation * 0.65,
                'and within 35% of it at n = ' + n + ' — the convergence is slow');
            });
          } },
        { name: 'a simulation agrees with the formula',
          assert: function (expected, api) {
            const n = 60;
            let total = 0;
            const trials = 60;
            for (let t = 0; t < trials; t += 1) {
              const values = api.rng.shuffle(Array.from({ length: n }, function (_, i) { return i; }));
              let comparisons = 0;
              const sort = function (array) {
                if (array.length <= 1) return array;
                const pivot = array[api.rng.int(array.length)];
                const less = []; const equal = []; const greater = [];
                array.forEach(function (value) {
                  // the pivot is not compared with itself: the analysis counts pairs
                  if (value === pivot) { equal.push(value); return; }
                  comparisons += 1;
                  if (value < pivot) less.push(value); else greater.push(value);
                });
                return sort(less).concat(equal, sort(greater));
              };
              sort(values);
              total += comparisons;
            }
            const measured = total / trials;
            const predicted = expected(n);
            api.assert.closeTo(measured / predicted, 1, 0.08,
              'measured ' + measured.toFixed(1) + ' vs predicted ' + predicted.toFixed(1));
          } }
      ]
    }],

    'lower-bounds': [{
      id: 'adversary',
      title: 'Answer like an adversary',
      prompt: 'answer(orders, i, j) receives the permutations still consistent with everything asked ' +
        'so far and must return true (meaning "a[i] < a[j]") or false — whichever keeps more ' +
        'permutations alive. That single rule is what forces every comparison sort to ⌈log₂ n!⌉ ' +
        'comparisons.',
      entry: 'answer',
      starter: [
        'function answer(orders, i, j) {',
        '  // an order is an array of ranks: order[i] is the rank of element i',
        '  return true;',
        '}'
      ].join('\n'),
      solution: [
        'function answer(orders, i, j) {',
        '  let less = 0;',
        '  for (const order of orders) if (order[i] < order[j]) less += 1;',
        '  return less >= orders.length - less;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'always keeps at least half the orders alive',
          assert: function (answer, api) {
            const permutations = function (n) {
              if (n <= 1) return [[0]];
              const out = [];
              permutations(n - 1).forEach(function (smaller) {
                for (let k = 0; k <= smaller.length; k += 1) {
                  const copy = smaller.slice();
                  copy.splice(k, 0, n - 1);
                  out.push(copy);
                }
              });
              return out;
            };

            for (let n = 3; n <= 5; n += 1) {
              let live = permutations(n);
              for (let step = 0; step < 4; step += 1) {
                const i = api.rng.int(n);
                let j = api.rng.int(n);
                if (j === i) j = (j + 1) % n;
                const before = live.length;
                const said = answer(live, i, j);
                live = live.filter(function (order) { return (order[i] < order[j]) === said; });
                api.assert.atLeast(live.length, Math.floor(before / 2),
                  'n = ' + n + ': dropped from ' + before + ' to ' + live.length);
              }
            }
          } },
        { name: 'returns the majority branch on a lopsided set',
          assert: function (answer, api) {
            const orders = [[0, 1], [0, 1], [0, 1], [1, 0]];
            api.assert.equal(answer(orders, 0, 1), true, 'three of four have a[0] < a[1]');
            const flipped = [[1, 0], [1, 0], [0, 1]];
            api.assert.equal(answer(flipped, 0, 1), false, 'two of three have a[0] > a[1]');
          } },
        { name: 'forces five comparisons to sort four elements',
          assert: function (answer, api) {
            const permutations = function (n) {
              if (n <= 1) return [[0]];
              const out = [];
              permutations(n - 1).forEach(function (smaller) {
                for (let k = 0; k <= smaller.length; k += 1) {
                  const copy = smaller.slice();
                  copy.splice(k, 0, n - 1);
                  out.push(copy);
                }
              });
              return out;
            };

            let live = permutations(4);
            let asked = 0;
            while (live.length > 1 && asked < 20) {
              let best = null;
              for (let i = 0; i < 4; i += 1) {
                for (let j = i + 1; j < 4; j += 1) {
                  const said = answer(live, i, j);
                  const next = live.filter(function (order) { return (order[i] < order[j]) === said; });
                  if (next.length !== live.length && (!best || next.length < best.length)) best = next;
                }
              }
              if (!best) break;
              live = best;
              asked += 1;
            }
            api.assert.equal(live.length, 1, 'the order is determined');
            api.assert.atLeast(asked, 5, 'the adversary must force at least ⌈log2 24⌉ = 5');
          } }
      ]
    }],

    'constants-and-cache': [{
      id: 'hybrid-sort',
      title: 'Build the hybrid every library sort uses',
      prompt: 'hybrid(values, cutoff) sorts ascending: insertion sort at or below the cutoff, merge ' +
        'sort above it. Route every comparison through ops.cmp so the tests can check the count — ' +
        'the cutoff is a measured constant, and this is how you measure it.',
      entry: 'hybrid',
      starter: [
        'function hybrid(values, cutoff) {',
        '  // below the cutoff: insertion sort (tiny constant, no allocation)',
        '  // above it: split, recurse, merge',
        '  return values.slice().sort(function (a, b) { return ops.cmp(a, b); });',
        '}'
      ].join('\n'),
      solution: [
        'function hybrid(values, cutoff) {',
        '  if (values.length <= 1) return values.slice();',
        '',
        '  if (values.length <= cutoff) {',
        '    const array = values.slice();',
        '    for (let i = 1; i < array.length; i += 1) {',
        '      const key = array[i];',
        '      let j = i - 1;',
        '      while (j >= 0 && ops.cmp(array[j], key) > 0) { array[j + 1] = array[j]; j -= 1; }',
        '      array[j + 1] = key;',
        '    }',
        '    return array;',
        '  }',
        '',
        '  const mid = values.length >> 1;',
        '  const left = hybrid(values.slice(0, mid), cutoff);',
        '  const right = hybrid(values.slice(mid), cutoff);',
        '  const out = [];',
        '  let i = 0; let j = 0;',
        '  while (i < left.length && j < right.length) {',
        '    if (ops.cmp(left[i], right[j]) <= 0) { out.push(left[i]); i += 1; }',
        '    else { out.push(right[j]); j += 1; }',
        '  }',
        '  while (i < left.length) { out.push(left[i]); i += 1; }',
        '  while (j < right.length) { out.push(right[j]); j += 1; }',
        '  return out;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'sorts correctly at every cutoff, including the edges',
          assert: function (hybrid, api) {
            [0, 1, 4, 16, 64, 1000].forEach(function (cutoff) {
              const values = api.rng.ints(300, 1000);
              const expected = values.slice().sort(function (a, b) { return a - b; });
              api.assert.deepEqual(hybrid(values, cutoff), expected, 'cutoff ' + cutoff);
            });
            api.assert.deepEqual(hybrid([], 8), [], 'empty');
            api.assert.deepEqual(hybrid([5], 8), [5], 'single');
          } },
        { name: 'leaves its input untouched',
          assert: function (hybrid, api) {
            const values = api.rng.ints(50, 100);
            const copy = values.slice();
            hybrid(values, 8);
            api.assert.deepEqual(values, copy, 'the input array must not be mutated');
          } },
        { name: 'every comparison goes through ops.cmp',
          assert: function (hybrid, api) {
            const before = api.ops.snapshot().cmp || 0;
            hybrid(api.rng.ints(256, 1000), 16);
            const used = (api.ops.snapshot().cmp || 0) - before;
            api.assert.atLeast(used, 255, 'sorting 256 items needs at least n − 1 comparisons');
            api.assert.atMost(used, 256 * 10, 'and far fewer than a quadratic number');
          } },
        { name: 'a bigger cutoff means more comparisons on random input',
          assert: function (hybrid, api) {
            const values = api.rng.ints(512, 5000);
            const count = function (cutoff) {
              const before = api.ops.snapshot().cmp || 0;
              hybrid(values, cutoff);
              return (api.ops.snapshot().cmp || 0) - before;
            };
            const small = count(4);
            const large = count(128);
            api.assert.ok(large > small, 'insertion sort trades comparisons for a smaller constant: ' +
              small + ' at cutoff 4 vs ' + large + ' at 128');
          } }
      ]
    }],

    'space-complexity': [{
      id: 'bounded-peak',
      title: 'Keep the peak bounded',
      prompt: 'sumChunked(values, chunkSize, track) must sum every value while never holding more ' +
        'than chunkSize items at once. Call track(liveCount) whenever the number of items you are ' +
        'holding changes — the test watches that number and fails if the peak scales with the input.',
      entry: 'sumChunked',
      starter: [
        'function sumChunked(values, chunkSize, track) {',
        '  const all = values.slice();   // this is the bug: it holds everything',
        '  track(all.length);',
        '  let total = 0;',
        '  for (const value of all) total += value;',
        '  track(0);',
        '  return total;',
        '}'
      ].join('\n'),
      solution: [
        'function sumChunked(values, chunkSize, track) {',
        '  let total = 0;',
        '  for (let start = 0; start < values.length; start += chunkSize) {',
        '    const chunk = values.slice(start, start + chunkSize);',
        '    track(chunk.length);',
        '    for (const value of chunk) total += value;',
        '    track(0);',
        '  }',
        '  return total;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'the sum is right for every chunk size',
          assert: function (sumChunked, api) {
            const values = api.rng.ints(1000, 100);
            const expected = values.reduce(function (a, b) { return a + b; }, 0);
            [1, 7, 64, 1000, 5000].forEach(function (size) {
              api.assert.equal(sumChunked(values, size, function () {}), expected, 'chunk ' + size);
            });
            api.assert.equal(sumChunked([], 8, function () {}), 0, 'empty input');
          } },
        { name: 'peak live items never exceeds the chunk size',
          assert: function (sumChunked, api) {
            const values = api.rng.ints(4000, 100);
            [16, 128, 512].forEach(function (size) {
              let peak = 0;
              sumChunked(values, size, function (live) { peak = Math.max(peak, live); });
              api.assert.atMost(peak, size, 'chunk size ' + size + ' peaked at ' + peak);
            });
          } },
        { name: 'the peak does not grow with the input',
          assert: function (sumChunked, api) {
            const measure = function (n) {
              let peak = 0;
              sumChunked(api.rng.ints(n, 10), 32, function (live) { peak = Math.max(peak, live); });
              return peak;
            };
            const small = measure(500);
            const large = measure(8000);
            api.assert.equal(small, large, 'peak was ' + small + ' at n=500 and ' + large + ' at n=8000');
          } }
      ]
    }],

    'empirical-complexity': [{
      id: 'estimate-exponent',
      title: 'Read the exponent off the measurements',
      prompt: 'estimateExponent(points) takes [{x, y}] measurements at doubling sizes and returns the ' +
        'estimated exponent k, using the ratios of the last three doublings. For Θ(n^k) the cost ' +
        'ratio between successive doublings tends to 2^k.',
      entry: 'estimateExponent',
      starter: [
        'function estimateExponent(points) {',
        '  // exponent = log(cost ratio) / log(size ratio), averaged over the last few pairs',
        '  return 1;',
        '}'
      ].join('\n'),
      solution: [
        'function estimateExponent(points) {',
        '  const sorted = points.slice().sort(function (a, b) { return a.x - b.x; });',
        '  const exponents = [];',
        '  for (let i = 1; i < sorted.length; i += 1) {',
        '    const sizeRatio = sorted[i].x / sorted[i - 1].x;',
        '    const costRatio = sorted[i].y / sorted[i - 1].y;',
        '    if (sizeRatio > 1 && costRatio > 0) exponents.push(Math.log(costRatio) / Math.log(sizeRatio));',
        '  }',
        '  const tail = exponents.slice(Math.max(0, exponents.length - 3));',
        '  if (!tail.length) return NaN;',
        '  return tail.reduce(function (a, b) { return a + b; }, 0) / tail.length;',
        '}'
      ].join('\n'),
      tests: [
        { name: 'recovers 1, 2 and 3 from clean synthetic data',
          assert: function (estimateExponent, api) {
            const build = function (fn) {
              const points = [];
              for (let n = 256; n <= 8192; n *= 2) points.push({ x: n, y: fn(n) });
              return points;
            };
            api.assert.closeTo(estimateExponent(build(function (n) { return 0.7 * n; })), 1, 0.05, 'linear');
            api.assert.closeTo(estimateExponent(build(function (n) { return 3e-5 * n * n; })), 2, 0.05, 'quadratic');
            api.assert.closeTo(estimateExponent(build(function (n) { return 1e-8 * n * n * n; })), 3, 0.05, 'cubic');
          } },
        { name: 'n log n reads between 1 and 1.2, as it should',
          assert: function (estimateExponent, api) {
            const points = [];
            for (let n = 256; n <= 8192; n *= 2) points.push({ x: n, y: 1e-3 * n * Math.log2(n) });
            const k = estimateExponent(points);
            api.assert.ok(k > 1 && k < 1.2, 'expected just above 1, got ' + k.toFixed(3));
          } },
        { name: 'unsorted input is handled, and constants do not matter',
          assert: function (estimateExponent, api) {
            const shuffled = [{ x: 2048, y: 4 }, { x: 256, y: 0.0625 }, { x: 1024, y: 1 },
              { x: 512, y: 0.25 }, { x: 4096, y: 16 }];
            api.assert.closeTo(estimateExponent(shuffled), 2, 0.02, 'quadratic regardless of order');
          } },
        { name: 'noise does not move the estimate much',
          assert: function (estimateExponent, api) {
            const points = [];
            for (let n = 256; n <= 8192; n *= 2) {
              points.push({ x: n, y: 3e-5 * n * n * (1 + (api.rng.next() - 0.5) * 0.06) });
            }
            api.assert.closeTo(estimateExponent(points), 2, 0.15, 'within tolerance under 3% noise');
          } }
      ]
    }],

    benchmarking: [{
      id: 'robust-report',
      title: 'Report a measurement that can be refuted',
      prompt: 'report(samples) returns { median, mad, runs, suspicious } for an array of timings. ' +
        'The median and MAD must be robust to outliers, and suspicious must be true when the MAD ' +
        'exceeds 25% of the median or when there are fewer than five samples.',
      entry: 'report',
      starter: [
        'function report(samples) {',
        '  const mean = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;',
        '  return { median: mean, mad: 0, runs: samples.length, suspicious: false };',
        '}'
      ].join('\n'),
      solution: [
        'function report(samples) {',
        '  const middle = function (values) {',
        '    const sorted = values.slice().sort(function (a, b) { return a - b; });',
        '    const mid = Math.floor(sorted.length / 2);',
        '    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;',
        '  };',
        '  const median = middle(samples);',
        '  const mad = middle(samples.map(function (v) { return Math.abs(v - median); }));',
        '  return {',
        '    median: median,',
        '    mad: mad,',
        '    runs: samples.length,',
        '    suspicious: samples.length < 5 || (median > 0 && mad / median > 0.25)',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        { name: 'median and MAD are computed correctly',
          assert: function (report, api) {
            const result = report([1, 2, 3, 4, 5, 6, 7]);
            api.assert.equal(result.median, 4);
            api.assert.equal(result.mad, 2, 'deviations are 3,2,1,0,1,2,3 → median 2');
            api.assert.equal(result.runs, 7);
          } },
        { name: 'one huge outlier moves the mean and not the median',
          assert: function (report, api) {
            const clean = [10, 10.2, 9.9, 10.1, 10, 9.8, 10.1];
            const withPause = clean.concat([250]);
            const mean = withPause.reduce(function (a, b) { return a + b; }, 0) / withPause.length;

            api.assert.closeTo(report(withPause).median, 10.05, 0.2, 'median barely moves');
            api.assert.ok(mean > 39, 'the mean is dragged to ' + mean.toFixed(1) + ' by one pause');
          } },
        { name: 'a noisy or tiny sample is flagged',
          assert: function (report, api) {
            api.assert.equal(report([10, 10.1, 9.9, 10, 10.05, 9.95]).suspicious, false, 'clean run');
            api.assert.equal(report([10, 40, 12, 38, 11, 41]).suspicious, true, 'bimodal run');
            api.assert.equal(report([10, 10, 10]).suspicious, true, 'three samples is not a distribution');
          } },
        { name: 'the run count always travels with the number',
          assert: function (report, api) {
            [1, 5, 21, 100].forEach(function (n) {
              const samples = [];
              for (let i = 0; i < n; i += 1) samples.push(10 + api.rng.next());
              api.assert.equal(report(samples).runs, n, 'runs must be reported for n = ' + n);
            });
          } }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
