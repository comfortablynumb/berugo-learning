'use strict';

/** Unit tests for the M01 analysis engines. All pure, all DOM-free. */

const test = require('node:test');
const assert = require('node:assert');

const Asymptotics = require('../../src/js/algorithms/asymptotics.js');
const Recurrence = require('../../src/js/algorithms/recurrence.js');
const Amortised = require('../../src/js/algorithms/amortised.js');
const Probabilistic = require('../../src/js/algorithms/probabilistic.js');
const LowerBounds = require('../../src/js/algorithms/lower-bounds.js');
const CurveFit = require('../../src/js/algorithms/curve-fit.js');
const SpaceProfile = require('../../src/js/algorithms/space-profile.js');
const CrossoverLab = require('../../src/js/algorithms/crossover-lab.js');
const BenchHarness = require('../../src/js/machines/bench-harness.js');
const Random = require('../../src/js/utils/random.js');
const Ops = require('../../src/js/utils/ops-counter.js');

/* ---------------------------------------------------------------- asymptotics */

test('asymptotics: a witness is accepted or refuted with a counter-example', function () {
  const f = Asymptotics.growth('linearithmic').fn;
  const g = Asymptotics.growth('quadratic').fn;

  const good = Asymptotics.isBigO(f, g, { c: 1, n0: 1, upTo: 500 });
  assert.strictEqual(good.holds, true);
  assert.strictEqual(good.firstFailure, null);

  const bad = Asymptotics.isBigO(g, f, { c: 1, n0: 2, upTo: 500 });
  assert.strictEqual(bad.holds, false);
  assert.ok(bad.firstFailure.n >= 2, 'names the first failing n');
  assert.ok(bad.firstFailure.f > bad.firstFailure.cg, 'and shows why it failed');
});

test('asymptotics: the smallest constant is the max ratio, and it is at n = 3 here', function () {
  const c = Asymptotics.smallestConstant(
    Asymptotics.growth('linearithmic').fn, Asymptotics.growth('quadratic').fn, 1, 1000);
  assert.ok(Math.abs(c - Math.log2(3) / 3) < 1e-12, 'got ' + c);
});

test('asymptotics: a constant that must grow means there is no witness', function () {
  const f = Asymptotics.growth('quadratic').fn;
  const g = Asymptotics.growth('linearithmic').fn;
  const short = Asymptotics.smallestConstant(f, g, 2, 100);
  const long = Asymptotics.smallestConstant(f, g, 2, 10000);
  assert.ok(long > short * 5, short + ' → ' + long);
});

test('asymptotics: crossover reports the first n where the first function overtakes', function () {
  const linear = function (n) { return 10 * n; };
  const quadratic = function (n) { return 0.5 * n * n; };

  // 0.5n² passes 10n at n = 21: 0.5·441 = 220.5 > 210.
  assert.strictEqual(Asymptotics.crossover(quadratic, linear, 1000), 21);
  // The other direction: 10n is already ahead at n = 1, so it never "overtakes".
  assert.strictEqual(Asymptotics.crossover(linear, quadratic, 1000), 1);
  assert.strictEqual(Asymptotics.crossover(function (n) { return n; }, function (n) { return 5 * n; }, 100), null,
    'no crossover in range returns null, not a guess');
});

/* ----------------------------------------------------------------- recurrence */

test('recurrence: merge sort has an equal-cost level structure', function () {
  const tree = Recurrence.tree({ a: 2, b: 2, f: function (n) { return n; }, n: 1024 });
  assert.strictEqual(tree.levels.length, 11);
  tree.levels.forEach(function (level) {
    assert.ok(Math.abs(level.work - 1024) < 1e-9, 'level ' + level.depth + ' costs ' + level.work);
  });
  assert.ok(Math.abs(tree.total - 11264) < 1e-6, 'total is ' + tree.total);
});

test('recurrence: the master theorem picks each case, and refuses the gap', function () {
  assert.strictEqual(Recurrence.master({ a: 4, b: 2, k: 1 }).case, 1, 'leaves dominate');
  assert.strictEqual(Recurrence.master({ a: 2, b: 2, k: 1 }).case, 2, 'balanced');
  assert.strictEqual(Recurrence.master({ a: 2, b: 2, k: 2 }).case, 3, 'root dominates');
  assert.strictEqual(Recurrence.master({ a: 2, b: 2, k: 2, p: -1 }).case, 'gap', 'declines to answer');
  assert.strictEqual(Recurrence.master({ a: 0.5, b: 2, k: 1 }).case, 'invalid', 'a < 1');
});

test('recurrence: case 2 with p > 0 gains a log factor', function () {
  const verdict = Recurrence.master({ a: 2, b: 2, k: 1, p: 1 });
  assert.strictEqual(verdict.case, 2);
  assert.match(verdict.solution, /log\^2 n/);
});

test('recurrence: the regularity condition is checked numerically', function () {
  assert.strictEqual(Recurrence.regularityHolds({ a: 2, b: 2, f: function (n) { return n * n; } }).holds, true);
  assert.strictEqual(Recurrence.regularityHolds({ a: 2, b: 2, f: function (n) { return n; } }).holds, false,
    'f = n is the balanced case, where the ratio is exactly 1');
});

test('recurrence: linear recurrences are solved numerically', function () {
  const fib = Recurrence.linear({ coefficients: [1, 1], base: [0, 1], upTo: 20 });
  assert.strictEqual(fib[10], 55);
  assert.strictEqual(fib[20], 6765);
});

/* ------------------------------------------------------------------ amortised */

test('amortised: 1024 pushes cost 2047 units with 1023 copies', function () {
  const array = Amortised.createDynamicArray({ factor: 2, charge: 3 });
  for (let i = 0; i < 1024; i += 1) array.push();

  const summary = array.summary();
  assert.strictEqual(summary.totalCopies, 1023);
  assert.strictEqual(summary.totalCost, 2047);
  assert.ok(summary.amortised < 2, 'amortised is ' + summary.amortised);
});

test('amortised: the potential is derived per factor and never goes negative', function () {
  // The doubling form 2·size − capacity fails here for factor 3; the general
  // form (r·size − capacity)/(r − 1) is what the module implements.
  [1.25, 1.5, 2, 3, 4].forEach(function (factor) {
    const array = Amortised.createDynamicArray({ factor: factor });
    for (let i = 0; i < 3000; i += 1) array.push();
    array.trace().forEach(function (record) {
      assert.ok(record.potentialAfter >= 0,
        'factor ' + factor + ': Φ went to ' + record.potentialAfter);
    });
  });
});

test('amortised: a charge of 3 keeps the bank solvent and 1 does not', function () {
  const solvent = Amortised.createDynamicArray({ factor: 2, charge: 3 });
  const broke = Amortised.createDynamicArray({ factor: 2, charge: 1 });
  for (let i = 0; i < 2000; i += 1) { solvent.push(); broke.push(); }

  const minSolvent = solvent.trace().reduce(function (m, r) { return Math.min(m, r.bank); }, Infinity);
  const minBroke = broke.trace().reduce(function (m, r) { return Math.min(m, r.bank); }, Infinity);

  assert.ok(minSolvent >= 0, 'charge 3 stays solvent, minimum bank ' + minSolvent);
  assert.ok(minBroke < 0, 'charge 1 must go negative, minimum bank ' + minBroke);
});

test('amortised: growth factor trades copies against allocator reuse', function () {
  const doubling = Amortised.growthCost(2, 4000);
  const gentle = Amortised.growthCost(1.5, 4000);

  assert.ok(gentle.copies > doubling.copies, 'the smaller factor copies more');
  assert.strictEqual(doubling.reuseable, false, 'factor 2 can never reuse the freed blocks');
  assert.strictEqual(gentle.reuseable, true, 'factor 1.5 eventually can');
});

/* -------------------------------------------------------------- probabilistic */

test('probabilistic: the exact expectation matches a brute-force pair sum', function () {
  [2, 5, 10, 50].forEach(function (n) {
    let brute = 0;
    for (let i = 1; i <= n; i += 1) {
      for (let j = i + 1; j <= n; j += 1) brute += 2 / (j - i + 1);
    }
    assert.ok(Math.abs(Probabilistic.quicksortExpectation(n) - brute) < 1e-9, 'n = ' + n);
  });
});

test('probabilistic: the simulation agrees with the closed form', function () {
  const rng = Random.seeded(99);
  const n = 80;
  const stats = Probabilistic.sample({
    trials: 120,
    trial: function () { return Probabilistic.quicksortComparisons(n, rng); }
  });

  const predicted = Probabilistic.quicksortExpectation(n);
  const error = Math.abs(stats.mean - predicted) / predicted;
  assert.ok(error < 0.05, 'measured ' + stats.mean.toFixed(1) + ' vs predicted ' + predicted.toFixed(1));
});

test('probabilistic: 2n ln n overestimates, and the gap shrinks slowly', function () {
  const at100 = Probabilistic.quicksortAsymptotic(100) / Probabilistic.quicksortExpectation(100);
  const at1000 = Probabilistic.quicksortAsymptotic(1000) / Probabilistic.quicksortExpectation(1000);

  assert.ok(at100 > 1.4 && at100 < 1.45, 'ratio at n=100 is ' + at100.toFixed(3));
  assert.ok(at1000 > 1.25 && at1000 < 1.27, 'ratio at n=1000 is ' + at1000.toFixed(3));
  assert.ok(at1000 < at100, 'the approximation improves with n');
});

test('probabilistic: the birthday bound crosses a half at 23 for 365 days', function () {
  assert.ok(Probabilistic.birthdayCollision(22, 365) < 0.5);
  assert.ok(Probabilistic.birthdayCollision(23, 365) > 0.5);
});

/* --------------------------------------------------------------- lower bounds */

test('lower bounds: the adversary never halves the candidate set by more than half', function () {
  const tracker = LowerBounds.createDecisionTracker(4);
  assert.strictEqual(tracker.total, 24);
  assert.strictEqual(tracker.bound, 5, 'ceil(log2 24) = 5');

  let remaining = tracker.remaining();
  const pairs = [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]];
  pairs.forEach(function (pair) {
    const before = remaining;
    remaining = tracker.ask(pair[0], pair[1], tracker.adversarialAnswer(pair[0], pair[1]));
    assert.ok(remaining >= Math.floor(before / 2), before + ' → ' + remaining);
  });
});

test('lower bounds: a linear scan is forced to use exactly n − 1 comparisons', function () {
  for (let n = 2; n <= 8; n += 1) {
    const adversary = LowerBounds.createMaxAdversary(n);
    let best = 0;
    for (let i = 1; i < n; i += 1) if (adversary.compare(i, best) > 0) best = i;

    const verdict = adversary.verdict(best);
    assert.strictEqual(verdict.comparisons, n - 1, 'n = ' + n);
    assert.strictEqual(verdict.sound, true, 'n = ' + n + ': ' + verdict.reason);
  }
});

test('lower bounds: stopping early leaves the maximum undetermined', function () {
  const adversary = LowerBounds.createMaxAdversary(6);
  adversary.compare(1, 0);
  adversary.compare(2, 0);

  const verdict = adversary.verdict(0);
  assert.strictEqual(verdict.sound, false);
  assert.match(verdict.reason, /still unbeaten/);
});

test('lower bounds: log2(n!) matches the direct product', function () {
  [3, 4, 8, 12].forEach(function (n) {
    let factorial = 1;
    for (let i = 2; i <= n; i += 1) factorial *= i;
    assert.ok(Math.abs(LowerBounds.logFactorial(n) - Math.log2(factorial)) < 1e-9, 'n = ' + n);
  });
});

/* ------------------------------------------------------------------ curve fit */

test('curve fit: the doubling method recovers known exponents', function () {
  const build = function (fn) {
    const points = [];
    for (let n = 128; n <= 8192; n *= 2) points.push({ x: n, y: fn(n) });
    return points;
  };

  assert.ok(Math.abs(CurveFit.doubling(build(function (n) { return 2 * n; })).exponent - 1) < 0.02);
  assert.ok(Math.abs(CurveFit.doubling(build(function (n) { return n * n; })).exponent - 2) < 0.02);
  assert.ok(Math.abs(CurveFit.doubling(build(function (n) { return Math.pow(n, 3); })).exponent - 3) < 0.02);
});

test('curve fit: the best fit picks the right candidate for clean data', function () {
  const points = [];
  for (let n = 256; n <= 16384; n *= 2) points.push({ x: n, y: 1.5e-4 * n * Math.log2(n) });

  const fit = CurveFit.fit(points);
  assert.strictEqual(fit.best.name, 'linearithmic', 'ranked: ' +
    fit.ranked.slice(0, 3).map(function (r) { return r.label; }).join(', '));
  assert.ok(fit.best.relative < 0.01, 'residual ' + fit.best.relative);
});

test('curve fit: it declines to answer with too few points', function () {
  const fit = CurveFit.fit([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  assert.strictEqual(fit.best, null);
  assert.match(fit.note, /three points/);
});

test('curve fit: the fitted coefficient recovers the constant', function () {
  const points = [];
  for (let n = 100; n <= 3200; n *= 2) points.push({ x: n, y: 0.004 * n * n });
  const fit = CurveFit.fitOne(points, CurveFit.basis.find(function (b) { return b.name === 'quadratic'; }));
  assert.ok(Math.abs(fit.coefficient - 0.004) < 1e-9, 'got ' + fit.coefficient);
});

/* -------------------------------------------------------------- space profile */

test('space profile: the three shapes have the peaks they claim', function () {
  const results = SpaceProfile.compare(10000, 3, 256);
  const byShape = {};
  results.forEach(function (r) { byShape[r.shape] = r; });

  assert.strictEqual(byShape.materialised.peakBytes, 3 * 10000 * SpaceProfile.ITEM_BYTES);
  assert.strictEqual(byShape.chunked.peakBytes, 2 * 256 * SpaceProfile.ITEM_BYTES);
  assert.strictEqual(byShape.streaming.peakBytes, 2 * SpaceProfile.ITEM_BYTES);
});

test('space profile: only the materialised peak scales with the input', function () {
  const small = SpaceProfile.compare(1000, 3, 128);
  const large = SpaceProfile.compare(100000, 3, 128);

  assert.ok(large[0].peakBytes > small[0].peakBytes * 50, 'materialised scales');
  assert.strictEqual(large[1].peakBytes, small[1].peakBytes, 'chunked does not');
  assert.strictEqual(large[2].peakBytes, small[2].peakBytes, 'streaming does not');
});

test('space profile: the accountant tracks live bytes down as well as up', function () {
  const account = SpaceProfile.createAccountant();
  const a = account.allocate(100, 'a');
  account.allocate(50, 'b');
  account.release(a);

  const summary = account.summary();
  assert.strictEqual(summary.peakBytes, 150);
  assert.strictEqual(summary.liveBytes, 50);
  assert.strictEqual(summary.allocations, 2);
});

/* ------------------------------------------------------- crossover and harness */

test('crossover lab: both sorts are correct and counted', function () {
  const rng = Random.seeded(5);
  const values = rng.ints(200, 1000);
  const expected = values.slice().sort(function (a, b) { return a - b; });

  const insertionOps = Ops.createOps({});
  const mergeOps = Ops.createOps({});

  assert.deepStrictEqual(CrossoverLab.insertionSort(values, insertionOps), expected);
  assert.deepStrictEqual(CrossoverLab.mergeSort(values, mergeOps, 0), expected);
  assert.ok(insertionOps.snapshot().cmp > mergeOps.snapshot().cmp,
    'insertion sort should count more comparisons at n = 200');
});

test('crossover lab: the hybrid cutoff changes the comparison count, not the result', function () {
  const rng = Random.seeded(11);
  const values = rng.ints(300, 1000);
  const expected = values.slice().sort(function (a, b) { return a - b; });

  [0, 8, 32, 128].forEach(function (cutoff) {
    const ops = Ops.createOps({});
    assert.deepStrictEqual(CrossoverLab.mergeSort(values, ops, cutoff), expected, 'cutoff ' + cutoff);
  });
});

test('bench harness: the median is reported with its run count', function () {
  let tick = 0;
  const clock = function () { tick += 1; return tick * 0.5; };
  const harness = BenchHarness.createHarness({ warmup: 2, runs: 5, trim: 0, clock: clock, sink: true });

  const result = harness.run({ task: function () { return 1; }, input: null });
  assert.strictEqual(result.runs, 5);
  assert.strictEqual(result.warmup, 2);
  assert.strictEqual(result.samples.length, 5);
  assert.ok(result.medianMs > 0);
});

test('bench harness: it names what a bad configuration is hiding', function () {
  const harness = BenchHarness.createHarness({ warmup: 0, runs: 3, sink: false, trim: 0 });
  const result = harness.run({ task: function () { return 1; }, input: null });

  const joined = result.suspicious.join(' | ');
  assert.match(joined, /no warm-up/);
  assert.match(joined, /optimised away/);
  assert.match(joined, /fewer than five runs/);
});

test('bench harness: trimming removes the extremes symmetrically', function () {
  const trimmed = BenchHarness.trimmed([1, 2, 3, 4, 100], 0.4);
  assert.deepStrictEqual(trimmed, [2, 3, 4]);
  assert.strictEqual(BenchHarness.median([1, 2, 3, 4, 100]), 3, 'the median ignores the outlier');
});

test('bench harness: a sweep produces plottable points', function () {
  const harness = BenchHarness.createHarness({ warmup: 1, runs: 3 });
  const rows = harness.sweep({
    sizes: [10, 20, 40],
    makeInput: function (n) { return n; },
    task: function (n) { let s = 0; for (let i = 0; i < n * 1000; i += 1) s += i; return s; }
  });

  assert.strictEqual(rows.length, 3);
  rows.forEach(function (row) {
    assert.strictEqual(row.x, row.n);
    assert.ok(Number.isFinite(row.y), 'each row carries a median');
  });
});
