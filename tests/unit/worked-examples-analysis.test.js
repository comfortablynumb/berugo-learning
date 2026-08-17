'use strict';

/**
 * Every figure in the M01 worked examples, recomputed from the example's own
 * setup - both the derivation example and the counter-example each section
 * carries.
 *
 * The rule, as everywhere else in this suite: a number that can be derived is
 * derived here, and the assertion also checks that the text still quotes it,
 * so moving a figure without moving the prose fails the build.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-analysis.js');

const Probabilistic = require('../../src/js/algorithms/probabilistic.js');
const LowerBounds = require('../../src/js/algorithms/lower-bounds.js');
const SpaceProfile = require('../../src/js/algorithms/space-profile.js');
const CurveFit = require('../../src/js/algorithms/curve-fit.js');
const CacheSim = require('../../src/js/machines/cache-sim.js');
const Random = require('../../src/js/utils/random.js');

function example(sectionId, index) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[index], 'missing worked example ' + sectionId + '#' + index);
  return entries[index];
}

function body(entry) {
  return entry.steps.map(function (step) {
    return step.work + '\n' + (step.result || '');
  }).join('\n') + '\n' + entry.answer;
}

function quotes(entry, fragments) {
  const text = body(entry);
  fragments.forEach(function (fragment) {
    assert.ok(text.indexOf(fragment) !== -1, 'the example no longer quotes "' + fragment + '"');
  });
}

/* --------------------------------------------------------- asymptotic notation */

test('asymptotic-notation: the witness holds and the converse constant diverges', function () {
  const entry = example('asymptotic-notation', 0);

  for (let n = 1; n <= 1000; n += 1) {
    assert.ok(n * Math.log2(n) <= 1 * n * n, 'c = 1, n0 = 1 fails at n = ' + n);
  }

  assert.strictEqual((3 / Math.log2(3) / 3).toFixed(3), '0.631', 'guard on the divided form');
  assert.strictEqual((1000 / Math.log2(1000)).toFixed(1), '100.3', 'required c at n = 1000');
  assert.strictEqual(Math.ceil(1e6 / Math.log2(1e6)), 50172, 'required c at n = 1e6');
  assert.ok(1e6 / Math.log2(1e6) > 1000 / Math.log2(1000), 'and it is still growing');

  quotes(entry, ['c ≥ 100.3', 'c ≥ 50 172']);
});

test('asymptotic-notation: insertion sort best and worst, and the n/2 gap', function () {
  const entry = example('asymptotic-notation', 1);

  function insertionComparisons(values) {
    let comparisons = 0;
    const a = values.slice();
    for (let i = 1; i < a.length; i += 1) {
      let j = i - 1;
      const key = a[i];
      while (j >= 0) {
        comparisons += 1;
        if (a[j] <= key) break;
        a[j + 1] = a[j];
        j -= 1;
      }
      a[j + 1] = key;
    }
    return comparisons;
  }

  const n = 1000;
  const sorted = [];
  for (let i = 0; i < n; i += 1) sorted.push(i);
  const reversed = sorted.slice().reverse();

  assert.strictEqual(insertionComparisons(sorted), n - 1);
  assert.strictEqual(insertionComparisons(sorted), 999);
  assert.strictEqual(insertionComparisons(reversed), (n * (n - 1)) / 2);
  assert.strictEqual(insertionComparisons(reversed), 499500);
  assert.strictEqual(499500 / 999, 500, 'the ratio is n/2');

  const small = [];
  for (let i = 0; i < 10; i += 1) small.push(i);
  assert.strictEqual(insertionComparisons(small.slice().reverse()), 45);
  assert.strictEqual(insertionComparisons(small), 9);
  assert.strictEqual(45 / 9, 5, 'and n/2 again at n = 10');

  quotes(entry, ['comparisons = n − 1 = 999', '1000 × 999 / 2 = 499,500', '499,500 / 999 = 500×',
    'at n = 10: 45 / 9 = 5×']);
});

/* ------------------------------------------------------------------ recurrences */

test('recurrences: the merge-sort tree sums to 11 264 at n = 1024', function () {
  const entry = example('recurrences', 0);
  const n = 1024;
  const depth = Math.log2(n);

  let total = 0;
  for (let level = 0; level <= depth; level += 1) total += Math.pow(2, level) * (n / Math.pow(2, level));

  assert.strictEqual(depth, 10);
  assert.strictEqual(total, 11264, 'eleven rows of 1024');
  assert.strictEqual(n * depth, 10240, 'the n log n term alone');
  quotes(entry, ['total = 1024 × (10 + 1) = 11,264', 'Θ(n log n)']);
});

test('recurrences: the uneven split is bounded by its two path lengths', function () {
  const entry = example('recurrences', 1);

  function solve(n, memo) {
    if (n <= 1) return 0;
    if (memo.has(n)) return memo.get(n);
    const smaller = Math.max(1, Math.floor(n / 3));
    const value = n + solve(smaller, memo) + solve(n - smaller, memo);
    memo.set(n, value);
    return value;
  }

  const n = 1024;
  const exact = solve(n, new Map());
  const shortest = Math.log(n) / Math.log(3);
  const longest = Math.log(n) / Math.log(1.5);
  const entropy = -(1 / 3) * Math.log(1 / 3) - (2 / 3) * Math.log(2 / 3);
  const estimate = (n * Math.log(n)) / entropy;

  assert.strictEqual(exact, 11379);
  assert.strictEqual(shortest.toFixed(2), '6.31');
  assert.strictEqual(longest.toFixed(2), '17.10');
  assert.strictEqual(Math.round(n * shortest), 6461, 'lower bound');
  assert.strictEqual(Math.round(n * longest), 17505, 'upper bound');
  assert.ok(exact > n * shortest && exact < n * longest, 'the exact value sits inside the bounds');

  assert.strictEqual(entropy.toFixed(4), '0.6365');
  assert.strictEqual(Math.round(estimate), 11151);
  assert.strictEqual((Math.abs(estimate - exact) / exact * 100).toFixed(1), '2.0',
    'the entropy estimate is within 2.1%');
  assert.strictEqual(Math.round((exact / (n * 10) - 1) * 100), 11, 'about 11% above an even split');

  quotes(entry, ['log₃ 1024   = 6.31', 'log₁.₅ 1024 = 17.10', '= 6,461', '= 17,505',
    '= 0.6365 nats', '= 11,151', '11,379']);
});

/* ----------------------------------------------------------- amortised analysis */

test('amortised-analysis: 1024 pushes cost 2047 units', function () {
  const entry = example('amortised-analysis', 0);
  let capacity = 1;
  let copies = 0;

  for (let size = 1; size <= 1024; size += 1) {
    if (size > capacity) { copies += size - 1; capacity *= 2; }
  }

  assert.strictEqual(copies, 1023, 'the geometric series');
  assert.strictEqual(Math.pow(2, 10) - 1, 1023);
  assert.strictEqual(1024 + copies, 2047, 'writes plus copies');
  assert.ok(2047 / 1024 < 2, 'amortised under 2');
  quotes(entry, ['2¹⁰ − 1 = 1023', 'total cost = 1024 writes + 1023 copies = 2047']);
});

test('amortised-analysis: shrinking at half costs 512 copies per operation', function () {
  const entry = example('amortised-analysis', 1);

  function churn(shrinkAt, operations) {
    let capacity = 1024;
    let size = 513;
    let copies = 0;
    let resizes = 0;

    for (let i = 0; i < operations; i += 1) {
      if (i % 2 === 0) {
        size -= 1;
        if (capacity > 1 && size <= Math.floor(capacity * shrinkAt)) {
          copies += size;
          capacity = Math.max(1, Math.floor(capacity / 2));
          resizes += 1;
        }
      } else {
        if (size === capacity) { copies += size; capacity *= 2; resizes += 1; }
        size += 1;
      }
    }
    return { copies: copies, resizes: resizes };
  }

  const bad = churn(0.5, 1000);
  const good = churn(0.25, 1000);

  assert.strictEqual(bad.copies, 512000);
  assert.strictEqual(bad.resizes, 1000, '500 contractions and 500 expansions');
  assert.strictEqual(bad.copies / 1000, 512, 'per operation');
  assert.strictEqual(good.copies, 0, 'the quarter rule never touches a threshold here');

  quotes(entry, ['copies = 1,000 × 512 = 512,000', '512,000 / 1,000 = 512 copies per operation',
    'copies over 1,000 operations = 0', '≤ 4 copies per operation']);
});

/* ---------------------------------------------------------------- average case */

test('average-case: the exact quicksort expectation and how far 2n ln n is', function () {
  const entry = example('average-case', 0);
  const exact = Probabilistic.quicksortExpectation(100);
  const asymptotic = 2 * 100 * Math.log(100);

  assert.strictEqual(exact.toFixed(2), '647.85');
  assert.strictEqual(asymptotic.toFixed(2), '921.03');
  assert.strictEqual((asymptotic / exact).toFixed(3), '1.422');
  assert.strictEqual(Math.round((asymptotic / exact - 1) * 100), 42);

  const bigger = Probabilistic.quicksortExpectation(1000);
  assert.strictEqual(Math.round((2 * 1000 * Math.log(1000) / bigger - 1) * 100), 26,
    'and it only falls to 26% by n = 1000');

  quotes(entry, ['E[X] ≈ 647.85', '2n ln n = 2 × 100 × 4.6052 = 921.03', 'ratio = 921.03 / 647.85 = 1.422']);
});

test('average-case: the three tail bounds on the coupon collector', function () {
  const entry = example('average-case', 1);
  const n = 100;

  let harmonic = 0;
  for (let i = 1; i <= n; i += 1) harmonic += 1 / i;
  const mean = n * harmonic;
  const sd = n * Math.PI / Math.sqrt(6);
  const threshold = n * Math.log(n) + 3 * n;

  assert.strictEqual(harmonic.toFixed(4), '5.1874');
  assert.strictEqual(mean.toFixed(1), '518.7');
  assert.strictEqual((n * (Math.log(n) + 0.5772)).toFixed(1), '518.2', 'the asymptotic form');
  assert.strictEqual((n * n * Math.PI * Math.PI / 6).toFixed(0), '16449', 'the variance bound');
  assert.strictEqual(sd.toFixed(1), '128.3');
  assert.strictEqual(threshold.toFixed(1), '760.5');

  const bounds = Probabilistic.tailBounds({ mean: mean, sd: sd, threshold: threshold });
  assert.strictEqual(bounds.markov.toFixed(3), '0.682');
  assert.strictEqual(bounds.chebyshev.toFixed(3), '0.281');
  assert.strictEqual(Math.exp(-3).toFixed(4), '0.0498');
  assert.strictEqual((bounds.markov / Math.exp(-3)).toFixed(1), '13.7', 'the union bound is 13.7x tighter');

  quotes(entry, ['H₁₀₀ = 5.1874', 'E[T] = 100 × 5.1874 = 518.7', 'sd < 128.3', '= 0.682', '= 0.281',
    'e⁻³ = 0.0498', '13.7× tighter']);
});

/* ---------------------------------------------------------------- lower bounds */

test('lower-bounds: four elements need five comparisons', function () {
  const entry = example('lower-bounds', 0);

  assert.strictEqual(LowerBounds.permutations(4).length, 24);
  assert.strictEqual(Math.log2(24).toFixed(3), '4.585');
  assert.strictEqual(Math.ceil(Math.log2(24)), 5);
  assert.strictEqual(Math.pow(2, 4), 16);
  assert.strictEqual(24 - 16, 8, 'orders that must share a leaf');
  assert.ok(LowerBounds.logFactorial(4) > 4 && LowerBounds.logFactorial(4) < 5);
  quotes(entry, ['h ≥ log₂24 = 4.585', '2⁴ = 16 < 24']);
});

test('lower-bounds: min and max together need exactly ceil(3n/2) - 2', function () {
  const entry = example('lower-bounds', 1);

  assert.strictEqual(LowerBounds.minMaxComparisons(100), 148);
  assert.strictEqual(2 * 100 - 2, 198);
  assert.strictEqual(50 + 49 + 49, 148, 'pairs, then winners, then losers');
  assert.strictEqual(Math.ceil(3 * 100 / 2) - 2, 148, 'the closed form');
  assert.strictEqual(((198 - 148) / 198 * 100).toFixed(1), '25.3');

  assert.strictEqual(LowerBounds.minMaxComparisons(1000), 1498);
  assert.strictEqual(((1998 - 1498) / 1998 * 100).toFixed(1), '25.0');
  assert.strictEqual(2 * 100 - 2 - Math.floor(100 / 2), 148, 'the facts argument lands on the same number');

  quotes(entry, ['total: 2n − 2 = 198', 'total: 50 + 49 + 49 = 148', '⌈150⌉ − 2 = 148',
    'at n = 1000: 1,498 against 1,998']);
});

/* --------------------------------------------------------- constants and cache */

test('constants-and-cache: the comparison-count crossover is n = 16', function () {
  const entry = example('constants-and-cache', 0);

  assert.strictEqual(0.25 * 16 * 16, 64);
  assert.strictEqual(16 * Math.log2(16), 64, 'the two costs meet at n = 16');
  assert.strictEqual(0.25 * 16, Math.log2(16), 'the divided form');
  assert.strictEqual(0.25 * 64 * 64, 1024, 'insertion sort at n = 64');
  quotes(entry, ['n = 16:  4.0 vs 4.0', 'insertion 1024 cmp']);
});

test('constants-and-cache: column-major moves 16x the bytes for the same work', function () {
  const entry = example('constants-and-cache', 1);
  const size = 1024;

  function traverse(order) {
    const cache = CacheSim.create({ lines: 512, lineBytes: 64 });
    for (let a = 0; a < size; a += 1) {
      for (let b = 0; b < size; b += 1) {
        const row = order === 'row' ? a : b;
        const column = order === 'row' ? b : a;
        cache.access((row * size + column) * 4);
      }
    }
    return cache.stats();
  }

  const rows = traverse('row');
  const columns = traverse('col');

  assert.strictEqual(rows.accesses, columns.accesses, 'identical work');
  assert.strictEqual(rows.accesses, 1048576);
  assert.strictEqual(rows.misses, 65536, 'one miss per 16 elements');
  assert.strictEqual(rows.misses, size * size / 16);
  assert.strictEqual(columns.misses, 1048576, 'every access misses');
  assert.strictEqual(columns.misses / rows.misses, 16);
  assert.strictEqual(rows.bytesFetched / (1024 * 1024), 4, 'MiB fetched, row-major');
  assert.strictEqual(columns.bytesFetched / (1024 * 1024), 64, 'MiB fetched, column-major');
  assert.strictEqual((rows.missRate * 100).toFixed(1), '6.3');
  assert.strictEqual(32 * 1024 / 4, 8192, 'elements that fit the cache');

  quotes(entry, ['1,048,576 / 16 = 65,536', 'row-major 65,536 misses (6.3%), column-major 1,048,576 (100%)',
    '= 4 MiB', '= 64 MiB']);
});

/* ------------------------------------------------------------ space complexity */

test('space-complexity: the three pipeline shapes and their peaks', function () {
  const entry = example('space-complexity', 0);

  assert.strictEqual(1e6 * 64 / 1e6, 64, 'MB per stage');
  assert.strictEqual(3 * 64, 192, 'three stages live');
  assert.strictEqual(1024 * 64, 65536, 'bytes per chunk');
  assert.strictEqual(Math.round(2 * 65536 / 1000), 131, 'kB for two chunks');
  assert.strictEqual(64 * 2, 128, 'bytes streaming');
  assert.strictEqual(192e6 / 128, 1500000, 'the ratio the example claims');
  quotes(entry, ['3 stages live at once = 192 MB', '2 live at a time ≈ 131 kB', '64 B × 2 = 128 B']);
});

test('space-complexity: the recursion stack an in-place quicksort needs', function () {
  const entry = example('space-complexity', 1);
  const n = 1e6;

  const balanced = SpaceProfile.recursionDepth({ depth: Math.ceil(Math.log2(n)), frameBytes: 96 });
  const degenerate = SpaceProfile.recursionDepth({ depth: n, frameBytes: 96 });

  assert.strictEqual(balanced.depth, 20);
  assert.strictEqual(balanced.peakBytes, 1920);
  assert.strictEqual(degenerate.peakBytes, 96000000);
  assert.strictEqual((degenerate.peakBytes / 1024 / 1024).toFixed(1), '91.6');
  assert.strictEqual(degenerate.peakBytes / balanced.peakBytes, 50000);
  assert.strictEqual(Math.floor(1024 * 1024 / 96), 10922, 'frames in a 1 MiB stack');
  assert.strictEqual((10922 / n * 100).toFixed(1), '1.1', 'per cent of the way in');

  quotes(entry, ['20 × 96 B = 1,920 B', '= 91.6 MiB', 'ratio to the balanced case: 50,000×',
    '1 MiB / 96 B = 10,922 frames']);
});

/* -------------------------------------------------------- empirical complexity */

test('empirical-complexity: the ratio table identifies a quadratic', function () {
  const entry = example('empirical-complexity', 0);
  const points = [{ x: 1000, y: 1.9 }, { x: 2000, y: 7.4 }, { x: 4000, y: 29.8 }, { x: 8000, y: 119.1 }];
  const table = CurveFit.doubling(points);

  assert.deepStrictEqual(table.rows.map(function (row) { return row.ratio.toFixed(2); }),
    ['3.89', '4.03', '4.00']);
  assert.strictEqual(Math.log2(4).toFixed(2), '2.00');
  assert.strictEqual(Math.log2(3.89).toFixed(2), '1.96');
  assert.strictEqual((1.9 * 64).toFixed(1), '121.6', 'the n² extrapolation from n = 1000');
  assert.strictEqual((1.9 * 8 * 13 / 10).toFixed(1), '19.8', 'the n log n extrapolation');
  assert.strictEqual(((121.6 / 119.1 - 1) * 100).toFixed(1), '2.1');
  assert.strictEqual(Math.round(119.1 / 19.8), 6, 'n log n is off by 6x');
  assert.strictEqual(Math.round(8000 / 119.1), 67, 'implied rate');

  quotes(entry, ['1.9 × 64 = 121.6 ms', 'within 2.1%']);
});

test('empirical-complexity: n log n and n^1.1 are not separable over this range', function () {
  const entry = example('empirical-complexity', 1);
  const sizes = [1000, 2000, 4000, 8000, 16000];
  const linearithmic = sizes.map(function (n) { return { x: n, y: n * Math.log2(n) }; });
  const power = sizes.map(function (n) { return { x: n, y: Math.pow(n, 1.1) }; });

  const a = CurveFit.doubling(linearithmic);
  const b = CurveFit.doubling(power);

  assert.deepStrictEqual(a.rows.map(function (r) { return r.ratio.toFixed(3); }),
    ['2.201', '2.182', '2.167', '2.154']);
  assert.deepStrictEqual(b.rows.map(function (r) { return r.ratio.toFixed(3); }),
    ['2.144', '2.144', '2.144', '2.144']);

  const worstGap = Math.max.apply(null, a.rows.map(function (row, i) {
    return Math.abs(row.ratio - b.rows[i].ratio) / row.ratio * 100;
  }));
  assert.ok(worstGap < 2.6 && worstGap > 2.5, 'largest disagreement is ' + worstGap.toFixed(2) + '%');

  assert.strictEqual(a.exponent.toFixed(3), '1.116');
  assert.strictEqual(b.exponent.toFixed(3), '1.100');
  assert.strictEqual((a.exponent - b.exponent).toFixed(3), '0.016');

  const rng = Random.seeded(42);
  const noisy = linearithmic.map(function (point) {
    return { x: point.x, y: point.y * (1 + (rng.next() - 0.5) * 0.04) };
  });
  assert.strictEqual(CurveFit.doubling(noisy).exponent.toFixed(3), '1.111');

  assert.strictEqual(CurveFit.fit(linearithmic).best.relative.toFixed(4), '0.0000');
  assert.strictEqual(CurveFit.fit(power).best.label, 'O(n log n)', 'the fitter mislabels the power law');
  assert.strictEqual(CurveFit.fit(power).best.relative.toFixed(4), '0.0050');
  assert.strictEqual(CurveFit.fit(noisy).best.relative.toFixed(4), '0.0087');
  assert.ok(CurveFit.fit(power).best.relative < CurveFit.fit(noisy).best.relative,
    'the misfit is smaller than the noise floor, which is the point');

  assert.strictEqual((Math.log2(1e3) / Math.pow(1e3, 0.1)).toFixed(1), '5.0');
  assert.strictEqual((Math.log2(1e6) / Math.pow(1e6, 0.1)).toFixed(1), '5.0');

  quotes(entry, ['2.201, 2.182, 2.167, 2.154', '2.144, 2.144, 2.144, 2.144', 'largest disagreement: 2.6%',
    'k = 1.116', 'k = 1.100', 'relative residual 0.0050', 'relative residual 0.0087']);
});

/* ---------------------------------------------------------------- benchmarking */

test('benchmarking: each protocol mistake costs what the example says', function () {
  const entry = example('benchmarking', 0);

  assert.strictEqual(((4.3 / 4.0 - 1) * 100).toFixed(1), '7.5', 'no warm-up');
  assert.strictEqual((11.0 / 4.0).toFixed(2), '2.75', 'a single sample, nearly 3x');
  assert.strictEqual(4.0 / 0.002, 2000, 'removing the sink');
  assert.strictEqual(20000 / 0.002, 1e7, 'elements per ms');
  assert.strictEqual(1e7 * 1000, 1e10, 'elements per second');
  quotes(entry, ['4.0 / 0.002 = 2000×', '= 10⁷ elements per ms = 10¹⁰ per second', '7.5% slower']);
});

test('benchmarking: the run count a 5% claim needs', function () {
  const entry = example('benchmarking', 1);
  const constant = 2 * Math.pow(1.959964 + 0.841621, 2);

  function runs(cv, delta) { return constant * Math.pow(cv / delta, 2); }
  function detectable(n, cv) { return cv * Math.sqrt(constant / n); }

  assert.strictEqual(constant.toFixed(3), '15.698');
  assert.strictEqual(runs(0.08, 0.05).toFixed(1), '40.2');
  assert.strictEqual(Math.ceil(runs(0.08, 0.05)), 41);
  assert.strictEqual(runs(0.03, 0.05).toFixed(1), '5.7');
  assert.strictEqual(Math.ceil(runs(0.03, 0.05)), 6);
  assert.strictEqual(runs(0.08, 0.02).toFixed(1), '251.2');
  assert.strictEqual(Math.ceil(runs(0.08, 0.02)), 252);

  assert.strictEqual((detectable(15, 0.08) * 100).toFixed(1), '8.2');
  assert.strictEqual((detectable(21, 0.08) * 100).toFixed(1), '6.9');
  assert.strictEqual((detectable(41, 0.08) * 100).toFixed(1), '5.0');
  assert.strictEqual(Math.pow(0.08 / 0.04, 2), 4, 'halving the noise divides the runs by four');
  assert.strictEqual((252 * 4 / 60).toFixed(0), '17', 'minutes per arm at 4 s a run');

  quotes(entry, ['2·(1.960 + 0.842)² = 15.698', '15.698 × 2.56 = 40.2', 'n = 15 ⇒ δ = 8.2%',
    '5.7 ⇒ 6 runs', 'n = 15.698 × 16 = 251.2 ⇒ 252 runs per arm']);
});
