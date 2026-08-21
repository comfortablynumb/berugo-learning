'use strict';

/**
 * Every figure the M11.1-M11.3 worked examples quote, recomputed.
 *
 * The instances are built exactly as the sections build them, because that is
 * the only way the page and the prose can be asserted to agree:
 *
 *   - `divide-and-conquer` seeds its operands, points, values and matrices
 *     with its *own* LCG (`state = state * 1664525 + 1013904223`), not with
 *     `utils/random.js`, and the Strassen entries are `((s % 2001) - 1000)/100`
 *     with `cutoff: 1`. Seeded any other way the ratios move and the section
 *     stops matching its own page.
 *   - `greedy-algorithms` derives its counter-examples from seed 5 and its
 *     staying-ahead trace from twelve intervals over a span of 20 at seed 3.
 *
 * Each figure is asserted twice: recomputed from the module, and asserted to
 * still appear in the section's prose. Moving a number without moving the
 * sentence fails the build.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;
const grouped = prose.grouped;

const Backtracking = require('../../src/js/algorithms/backtracking.js');
const Karatsuba = require('../../src/js/algorithms/karatsuba.js');
const ClosestPair = require('../../src/js/algorithms/closest-pair.js');
const Strassen = require('../../src/js/algorithms/strassen.js');
const Greedy = require('../../src/js/algorithms/greedy.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-paradigms.js');
require('../../src/js/content/concepts-paradigms.js');

const BUDGET = { nodeBudget: 20000000 };

/* -------------------------------------------------- 11.1 exhaustive-search */

function queenNodes(n, early, symmetry) {
  return Backtracking.nQueens(n, Object.assign({}, BUDGET,
    { earlyDiagonal: early, symmetry: symmetry })).report.nodes;
}

test('exhaustive-search: the four-configuration matrix at n = 6, 8 and 10', function () {
  const expected = {
    6: { control: 1957, early: 153, symmetry: 979, both: 77, solutions: 4 },
    8: { control: 109601, early: 2057, symmetry: 54801, both: 1029, solutions: 92 },
    10: { control: 9864101, early: 35539, symmetry: 4932051, both: 17770, solutions: 724 }
  };

  Object.keys(expected).forEach(function (key) {
    const n = Number(key);
    const row = expected[key];
    assert.strictEqual(queenNodes(n, false, false), row.control, 'control at n = ' + n);
    assert.strictEqual(queenNodes(n, true, false), row.early, 'early check at n = ' + n);
    assert.strictEqual(queenNodes(n, false, true), row.symmetry, 'symmetry at n = ' + n);
    assert.strictEqual(queenNodes(n, true, true), row.both, 'both at n = ' + n);
    assert.strictEqual(Backtracking.nQueens(n, BUDGET).report.solutions, row.solutions);
  });

  quotes('exhaustive-search', ['1 957', '153', '77', '109 601', '2 057', '54 801', '1 029',
    '9 864 101', '35 539', '92', '724']);
});

/* The two prunings are *nearly* independent, so their fractions nearly
   multiply. The prose used to say "exactly", and this assertion is what
   caught it: the measured 0.9389% sits above the 0.9384% the product gives,
   because some mirrored boards would have been cut by the diagonal check
   anyway. Both directions are asserted - that the two agree at two decimal
   places, and that they are NOT equal - so the prose cannot drift back to
   either overclaim. */
test('exhaustive-search: the surviving fractions at n = 8 multiply, but only nearly', function () {
  const control = queenNodes(8, false, false);
  const early = queenNodes(8, true, false) / control;
  const symmetry = queenNodes(8, false, true) / control;
  const both = queenNodes(8, true, true) / control;
  const product = early * symmetry;

  assert.strictEqual(fixed(100 * early), '1.88');
  assert.strictEqual(fixed(100 * symmetry), '50.00');
  assert.strictEqual(fixed(100 * both), '0.94');
  assert.strictEqual(fixed(100 * product), '0.94');

  assert.strictEqual(fixed(100 * both, 4), '0.9389');
  assert.strictEqual(fixed(100 * product, 4), '0.9384');
  assert.ok(both > product, 'the prunings overlap, so the pair must leave MORE than the product');
  assert.ok(both / product < 1.001, 'the overlap grew past a tenth of a percent');

  quotes('exhaustive-search', ['1.88%', '50.00%', '0.94%', '0.9389%', '0.9384%']);
});

test('exhaustive-search: ordering pays for itself only when one solution is wanted', function () {
  const natural = Backtracking.nQueens(8, Object.assign({}, BUDGET, { firstOnly: true }));
  const constrained = Backtracking.nQueens(8, Object.assign({}, BUDGET,
    { firstOnly: true, mostConstrained: true }));

  assert.strictEqual(natural.report.nodes, 114);
  assert.strictEqual(constrained.report.nodes, 9);
  assert.strictEqual(natural.report.solutions, 1);
  assert.strictEqual(constrained.report.solutions, 1);

  quotes('exhaustive-search', ['114']);
});

/* -------------------------------------------------- 11.2 divide-and-conquer */

/* The section's own LCG. `utils/random.js` produces a different stream and
   every figure below would move. */
function lcg(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

const crossover = Karatsuba.crossover({ threshold: 1, seed: 3 });

function crossoverRow(n) {
  return crossover.filter(function (row) { return row.n === n; })[0];
}

test('divide-and-conquer: the Karatsuba crossover table, and where Karatsuba loses', function () {
  const expected = [
    { n: 4, schoolbook: 16, karatsuba: 17, ratio: '0.94' },
    { n: 8, schoolbook: 64, karatsuba: 45, ratio: '1.42' },
    { n: 16, schoolbook: 256, karatsuba: 128, ratio: '2.00' },
    { n: 128, schoolbook: 16384, karatsuba: 3715, ratio: '4.41' },
    { n: 512, schoolbook: 262144, karatsuba: 33498, ratio: '7.83' },
    { n: 1024, schoolbook: 1048576, karatsuba: 100273, ratio: '10.46' }
  ];

  expected.forEach(function (row) {
    const measured = crossoverRow(row.n);
    assert.strictEqual(measured.schoolbook, row.schoolbook, 'schoolbook at n = ' + row.n);
    assert.strictEqual(measured.karatsuba, row.karatsuba, 'karatsuba at n = ' + row.n);
    assert.strictEqual(fixed(measured.ratio), row.ratio, 'ratio at n = ' + row.n);
    assert.strictEqual(measured.agrees, true, 'BigInt disagrees at n = ' + row.n);
  });

  assert.ok(crossoverRow(4).karatsuba > crossoverRow(4).schoolbook,
    'the n = 4 row must be the one where Karatsuba LOSES');

  quotes('divide-and-conquer', ['16', '0.94', '45', '1.42', '256', '128', '2.00',
    '16 384', '3 715', '4.41', '262 144', '33 498', '7.83', '1 048 576', '100 273', '10.46']);
});

test('divide-and-conquer: the measured cost is a constant 1.70x the n^1.585 model', function () {
  [128, 512, 1024].forEach(function (n) {
    const row = crossoverRow(n);
    assert.strictEqual(fixed(row.karatsuba / row.predicted), '1.70', 'the model factor at n = ' + n);
    assert.strictEqual(Math.round(row.predicted), { 128: 2187, 512: 19683, 1024: 59049 }[n]);
  });

  quotes('divide-and-conquer', ['1.70', '2 187', '19 683', '59 049']);
});

test('divide-and-conquer: 2 314 distance checks against 1 999 000, and a strip that runs 2 deep', function () {
  const next = lcg(11);
  const points = [];

  for (let i = 0; i < 2000; i += 1) {
    const x = next() % 1000000;
    points.push({ x: x / 1000, y: (next() % 1000000) / 1000 });
  }
  const fast = ClosestPair.closestPair(points, {});
  const slow = ClosestPair.bruteForce(points, {});

  assert.strictEqual(fast.report.distanceChecks, 2314);
  assert.strictEqual(slow.report.distanceChecks, 2000 * 1999 / 2);
  assert.strictEqual(slow.report.distanceChecks, 1999000);
  assert.strictEqual(fast.report.worstStripRun, 2);
  assert.ok(Math.abs(fast.pair.distance - slow.pair.distance) < 1e-12,
    'the fast pair is not the closest pair');

  quotes('divide-and-conquer', ['2 314', '1 999 000']);
});

test('divide-and-conquer: 984 529 inversions from 19 447 comparisons', function () {
  const next = lcg(17);
  const values = [];

  for (let i = 0; i < 2000; i += 1) values.push(next() % 100000);
  const run = ClosestPair.countInversions(values);

  assert.strictEqual(run.inversions, 984529);
  assert.strictEqual(run.comparisons, 19447);
  assert.strictEqual(ClosestPair.countInversionsNaive(values), run.inversions);
  assert.ok(run.comparisons < 2000 * 1999 / 2);

  quotes('divide-and-conquer', ['984 529', '19 447']);
});

function strassenPair(side) {
  const next = lcg(23);

  function matrix() {
    const out = [];

    for (let i = 0; i < side; i += 1) {
      const row = [];

      for (let j = 0; j < side; j += 1) row.push(((next() % 2001) - 1000) / 100);
      out.push(row);
    }
    return out;
  }
  const a = matrix();
  return { a: a, b: matrix() };
}

test('divide-and-conquer: Strassen trades 12.5% of the multiplications for error', function () {
  const expected = [
    { side: 16, cubic: 4096, fast: 2401, ratio: '1.71', error: 2.81e-15 },
    { side: 64, cubic: 262144, fast: 117649, ratio: '2.23', error: 1.20e-14 },
    { side: 128, cubic: 2097152, fast: 823543, ratio: '2.55', error: 3.41e-14 }
  ];

  expected.forEach(function (row) {
    const pair = strassenPair(row.side);
    const cubic = Strassen.cubic(pair.a, pair.b, {});
    const fast = Strassen.strassen(pair.a, pair.b, { cutoff: 1 });

    assert.strictEqual(cubic.report.scalarProducts, row.cubic, 'cubic at side ' + row.side);
    assert.strictEqual(fast.report.scalarProducts, row.fast, 'strassen at side ' + row.side);
    assert.strictEqual(fast.report.scalarProducts,
      Math.pow(7, Math.log2(row.side)), 'not 7^log2(n) at side ' + row.side);
    assert.strictEqual(fixed(cubic.report.scalarProducts / fast.report.scalarProducts), row.ratio);

    const measured = Strassen.errorAgainstCubic(pair.a, pair.b, { cutoff: 1 }).relative;
    assert.ok(measured > 0, 'an exact answer would mean the recursion never ran at side ' + row.side);
    assert.ok(measured < row.error, 'the error grew at side ' + row.side + ': ' + measured);
  });

  quotes('divide-and-conquer', ['4 096', '2 401', '1.71', '2 097 152', '823 543', '2.55']);
});

/* -------------------------------------------------- 11.3 greedy-algorithms */

const COUNTER_EXAMPLES = {
  'earliest-finish': { beaten: false, attempts: 200000 },
  'earliest-start': { beaten: true, attempts: 5, count: 4, greedy: 1, optimal: 2 },
  shortest: { beaten: true, attempts: 554, count: 4, greedy: 1, optimal: 2 },
  'fewest-conflicts': { beaten: true, attempts: 94996, count: 9, greedy: 3, optimal: 4 }
};

test('greedy-algorithms: how many instances each criterion survives', function () {
  Object.keys(COUNTER_EXAMPLES).forEach(function (kind) {
    const expected = COUNTER_EXAMPLES[kind];
    const found = Greedy.counterExample(kind, { seed: 5 });
    assert.strictEqual(found.attempts, expected.attempts, kind + ' attempts');

    if (!expected.beaten) {
      assert.strictEqual(found.intervals, null, kind + ' was beaten after all');
      return;
    }
    assert.strictEqual(found.count, expected.count, kind + ' instance size');
    assert.strictEqual(found.greedy, expected.greedy, kind + ' greedy answer');
    assert.strictEqual(found.optimal, expected.optimal, kind + ' optimum');
  });

  quotes('greedy-algorithms', ['200 000', '554', '94 996']);
});

test('greedy-algorithms: the three coin systems that fail, and where they fail first', function () {
  const canonical = [[1, 5, 10, 25], [1, 2, 5, 10, 20, 50]];
  const broken = [
    { coins: [1, 3, 4], amount: 6, greedy: 3, optimal: 2 },
    { coins: [1, 7, 10], amount: 14, greedy: 5, optimal: 2 },
    { coins: [1, 15, 25], amount: 30, greedy: 6, optimal: 2 },
    { coins: [1, 5, 11], amount: 15, greedy: 5, optimal: 3 }
  ];

  canonical.forEach(function (coins) {
    const verdict = Greedy.isCanonical(coins);
    assert.strictEqual(verdict.canonical, true, JSON.stringify(coins));
    assert.strictEqual(verdict.witness, null);
  });
  assert.strictEqual(Greedy.isCanonical(canonical[0]).limit, 35);
  assert.strictEqual(Greedy.isCanonical(canonical[1]).limit, 70);

  broken.forEach(function (row) {
    const verdict = Greedy.isCanonical(row.coins);
    assert.strictEqual(verdict.canonical, false, JSON.stringify(row.coins));
    assert.strictEqual(verdict.witness.amount, row.amount, JSON.stringify(row.coins));
    assert.strictEqual(verdict.witness.greedy, row.greedy);
    assert.strictEqual(verdict.witness.optimal, row.optimal);
  });

  /* 15 is above the largest coin, which is the whole point of the last row:
     a system can be canonical on every amount below its largest coin and
     fail at the first amount above it. */
  assert.ok(broken[3].amount > Math.max.apply(null, broken[3].coins));

  quotes('greedy-algorithms', ['1, 5, 10, 25', '35', '1, 2, 5, 10, 20, 50', '70',
    '1, 3, 4', '1, 7, 10', '14', '1, 15, 25', '30']);
});

test('greedy-algorithms: the relaxation is worth 240 where the integral optimum is 220', function () {
  const items = [{ value: 60, weight: 10 }, { value: 100, weight: 20 }, { value: 120, weight: 30 }];
  const relaxed = Greedy.fractionalKnapsack(items, 50);

  assert.strictEqual(relaxed.value, 240);
  assert.strictEqual(Greedy.integralKnapsack(items, 50).value, 220);
  assert.strictEqual(relaxed.taken[2].fraction.toFixed(4), (2 / 3).toFixed(4),
    'the last item should be taken two-thirds');

  quotes('greedy-algorithms', ['240', '220']);
});

test('greedy-algorithms: staying ahead, and the rival that ties until the last interval', function () {
  const random = Random.seeded(3);
  const intervals = [];

  for (let i = 0; i < 12; i += 1) {
    const start = random.int(20);
    intervals.push({ id: i, start: start, end: start + 1 + random.int(Math.max(1, 20 - start)) });
  }
  const trace = Greedy.stayingAheadTrace(intervals);

  assert.deepStrictEqual(trace.map(function (row) { return row.greedyEnd; }), [5, 10, 11, 15, 18]);
  assert.deepStrictEqual(trace.map(function (row) { return row.otherEnd; }), [5, 10, 11, 15, 20]);
  assert.ok(trace.every(function (row) { return row.ahead; }), 'greedy fell behind');

  /* The rival is built with the mirror rule, so it reaches the same count.
     A trace where greedy also *wins* on size demonstrates nothing about the
     staying-ahead argument, which is about the ends and not the count. */
  assert.strictEqual(trace.length, Greedy.optimalSchedule(intervals).size);

  quotes('greedy-algorithms', ['5, 9, 12, 13, 16, 45']);
  assert.strictEqual(grouped(1957), '1 957');
});
