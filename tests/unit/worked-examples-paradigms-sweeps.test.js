'use strict';

/**
 * Every figure the M11.7-M11.9 worked examples quote, recomputed.
 *
 * The three sweep sections all make the same kind of claim - "this costs
 * amortised O(1) per element where the obvious thing costs O(k)" - and the
 * three tests are shaped the same way: measure the sweep, measure the thing it
 * replaces, and assert both, because a ratio with only one measured half is
 * an assertion about arithmetic rather than about the code.
 *
 * The instances are the sections' own:
 *   - 11.7 builds four shapes at n = 5 000, k = 50 from `Random.seeded(7)`,
 *     and its histogram from `Random.seeded(11)`. The sawtooth period is
 *     `floor(k / 2)`, so it moves with the window.
 *   - 11.8 draws n values in [1, 5 000] from `Random.seeded(5)` and targets
 *     half the total. The n = 40 row is a real run of 2^21 states, not a
 *     projection - the projection is only for the 2^40 brute force.
 *   - 11.9 is n = 4 000, q = 600, universe 200, seed 9, with the queries from
 *     `MoAlgorithm.randomQueries(600, 4 000, 9)`.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const TwoPointers = require('../../src/js/algorithms/two-pointers.js');
const MeetInMiddle = require('../../src/js/algorithms/meet-in-middle.js');
const MoAlgorithm = require('../../src/js/algorithms/mo-algorithm.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-paradigms-sweeps.js');
require('../../src/js/content/concepts-paradigms-sweeps.js');

/* -------------------------------------------------- 11.7 two-pointers */

const WINDOW_N = 5000;
const WINDOW_K = 50;

function seriesFor(shape, n, k) {
  const values = [];
  const random = Random.seeded(7);

  for (let i = 0; i < n; i += 1) {
    if (shape === 'ascending') values.push(i);
    else if (shape === 'descending') values.push(n - i);
    else if (shape === 'sawtooth') values.push(i % Math.max(2, Math.floor(k / 2)));
    else values.push(random.int(n * 4));
  }
  return values;
}

test('two-pointers: four shapes, and two deque operations per element on all of them', function () {
  const expected = {
    random: { pushes: 5000, pops: 4994, total: 9994, perElement: '1.999', peak: 11 },
    ascending: { pushes: 5000, pops: 4999, total: 9999, perElement: '2.000', peak: 1 },
    descending: { pushes: 5000, pops: 4950, total: 9950, perElement: '1.990', peak: 50 },
    sawtooth: { pushes: 5000, pops: 4999, total: 9999, perElement: '2.000', peak: 2 }
  };

  Object.keys(expected).forEach(function (shape) {
    const row = expected[shape];
    const values = seriesFor(shape, WINDOW_N, WINDOW_K);
    const run = TwoPointers.maxInSlidingWindow(values, WINDOW_K, {});
    const total = run.report.pushes + run.report.pops;

    assert.strictEqual(run.report.pushes, row.pushes, shape + ' pushes');
    assert.strictEqual(run.report.pops, row.pops, shape + ' pops');
    assert.strictEqual(total, row.total, shape + ' total');
    assert.strictEqual(fixed(total / WINDOW_N, 3), row.perElement, shape + ' per element');
    assert.strictEqual(run.report.maxSize, row.peak, shape + ' peak deque');

    assert.deepStrictEqual(run.values, TwoPointers.maxInSlidingWindowNaive(values, WINDOW_K),
      shape + ' disagrees with the rescan');
  });

  quotes('two-pointers', ['5 000', '4 994', '9 994', '1.999', '11', '9 999', '9 950', '50']);
});

/* The peak deque is the figure that separates the shapes, and it is the one
   people expect to be about the window size. Ascending holds ONE element and
   descending holds the whole window - the same 2n operations either way. */
test('two-pointers: the deque depth is a property of the data, not of the window', function () {
  const ascending = TwoPointers.maxInSlidingWindow(seriesFor('ascending', WINDOW_N, WINDOW_K),
    WINDOW_K, {}).report;
  const descending = TwoPointers.maxInSlidingWindow(seriesFor('descending', WINDOW_N, WINDOW_K),
    WINDOW_K, {}).report;

  assert.strictEqual(ascending.maxSize, 1);
  assert.strictEqual(descending.maxSize, WINDOW_K);
  assert.strictEqual(ascending.pushes + ascending.pops, 9999);
  assert.strictEqual(descending.pushes + descending.pops, 9950);
});

test('two-pointers: the rescan it replaces is 247 550 comparisons', function () {
  const windows = WINDOW_N - WINDOW_K + 1;
  assert.strictEqual(windows, 4951);
  assert.strictEqual(windows * WINDOW_K, 247550);

  const sweep = TwoPointers.maxInSlidingWindow(seriesFor('random', WINDOW_N, WINDOW_K),
    WINDOW_K, {}).report;
  assert.strictEqual(fixed(247550 / (sweep.pushes + sweep.pops), 1), '24.8');

  quotes('two-pointers', ['247 550', '24.8×']);
});

test('two-pointers: the histogram sweep is 4 000 stack operations against 2 001 000', function () {
  const random = Random.seeded(11);
  const heights = [];

  for (let i = 0; i < 2000; i += 1) heights.push(random.int(100));
  const run = TwoPointers.largestRectangle(heights);

  assert.strictEqual(run.best.area, 793);
  assert.strictEqual(run.report.pushes, 2000);
  assert.strictEqual(run.report.pops, 2000);
  assert.strictEqual(run.report.pushes + run.report.pops, 4000);
  assert.strictEqual(2000 * 2001 / 2, 2001000);
  assert.strictEqual(TwoPointers.largestRectangleNaive(heights), 793);

  /* The rectangle really fits under the bars it claims. */
  for (let i = run.best.left; i <= run.best.right; i += 1) {
    assert.ok(heights[i] >= run.best.height, 'the rectangle pokes through bar ' + i);
  }
  assert.strictEqual((run.best.right - run.best.left + 1) * run.best.height, run.best.area);

  assert.strictEqual(TwoPointers.largestRectangle([2, 1, 5, 6, 2, 3]).best.area, 10);

  quotes('two-pointers', ['793', '4 000', '2 001 000', '2, 1, 5, 6, 2, 3']);
});

/* -------------------------------------------------- 11.8 meet-in-the-middle */

function subsetInstance(n) {
  const random = Random.seeded(5);
  const values = [];

  for (let i = 0; i < n; i += 1) values.push(1 + random.int(5000));
  const total = values.reduce(function (a, b) { return a + b; }, 0);
  return { values: values, target: Math.round(total / 2) };
}

test('meet-in-the-middle: four sizes, and the ratio against 2^n', function () {
  const expected = [
    { n: 12, states: 128, probes: 384, sum: 17043, brute: 4096, ratio: 32 },
    { n: 16, states: 512, probes: 2040, sum: 20646, brute: 65536, ratio: 128 },
    { n: 20, states: 2048, probes: 10240, sum: 27306, brute: 1048576, ratio: 512 },
    { n: 22, states: 4096, probes: 22440, sum: 27988, brute: 4194304, ratio: 1024 }
  ];

  expected.forEach(function (row) {
    const instance = subsetInstance(row.n);
    const run = MeetInMiddle.closestSubsetSum(instance.values, instance.target, {});

    assert.strictEqual(run.report.statesGenerated, row.states, 'states at n = ' + row.n);
    assert.strictEqual(run.report.probes, row.probes, 'probes at n = ' + row.n);
    assert.strictEqual(run.sum, row.sum, 'best sum at n = ' + row.n);
    assert.strictEqual(Math.pow(2, row.n), row.brute, 'the brute-force count at n = ' + row.n);
    assert.strictEqual(row.brute / row.states, row.ratio, 'the ratio at n = ' + row.n);

    const truth = MeetInMiddle.closestSubsetSumBruteForce(instance.values, instance.target,
      { maxItems: 24 });
    assert.strictEqual(Math.abs(run.sum - instance.target), Math.abs(truth.sum - instance.target),
      'the halves disagree with brute force at n = ' + row.n);
  });

  quotes('meet-in-the-middle', ['17 043', '20 646', '27 306', '27 988', '4 096', '22 440',
    '4 194 304', '32×', '128×', '512×', '1 024×']);
});

test('meet-in-the-middle: n = 40 is a real run of 2 097 152 states', function () {
  const instance = subsetInstance(40);
  const run = MeetInMiddle.closestSubsetSum(instance.values, instance.target, {});

  assert.strictEqual(run.report.statesGenerated, 2097152);
  assert.strictEqual(run.report.statesGenerated, 2 * Math.pow(2, 20));
  assert.strictEqual(run.report.probes, 20969549);
  assert.strictEqual(run.sum, 50719);
  assert.strictEqual(run.report.budgetExhausted, false);

  const sum = run.chosen.reduce(function (total, i) { return total + instance.values[i]; }, 0);
  assert.strictEqual(sum, run.sum, 'the chosen indices do not sum to the reported total');

  /* The 2^40 the row is measured against is the count only - the brute force
     is projected, and the projection says so rather than pretending to have
     run. */
  const projected = MeetInMiddle.projectedBruteForce(40, 1e9);
  assert.strictEqual(projected.states, Math.pow(2, 40));
  assert.strictEqual(projected.states, 1099511627776);
  assert.ok(projected.projectedMs > 0);

  quotes('meet-in-the-middle', ['2 097 152', '20 969 549', '1 099 511 627 776.']);
});

test('meet-in-the-middle: searching from both ends of a regular graph', function () {
  [{ branching: 3, depth: 8, plain: 3281, bidi: 22 },
    { branching: 4, depth: 8, plain: 21846, bidi: 32 }].forEach(function (row) {
    const built = MeetInMiddle.regularGraph(row.branching, row.depth);
    const plain = MeetInMiddle.breadthFirst(built.graph, 0, built.deepest);
    const bidi = MeetInMiddle.bidirectional(built.graph, 0, built.deepest);

    assert.strictEqual(plain.report.statesGenerated, row.plain, 'plain at b = ' + row.branching);
    assert.strictEqual(bidi.report.statesGenerated, row.bidi, 'bidirectional at b = ' + row.branching);
    assert.strictEqual(plain.distance, row.depth, 'plain distance at b = ' + row.branching);
    assert.strictEqual(bidi.distance, row.depth, 'bidirectional distance at b = ' + row.branching);
  });

  quotes('meet-in-the-middle', ['3 281', '21 846', '32', '149×', '683×,']);
});

/* -------------------------------------------------- 11.9 offline-processing */

const MO_N = 4000;
const MO_Q = 600;
const MO_UNIVERSE = 200;

function moWorkload() {
  const random = Random.seeded(9);
  const values = [];

  for (let i = 0; i < MO_N; i += 1) values.push(random.int(MO_UNIVERSE));
  return { values: values, queries: MoAlgorithm.randomQueries(MO_Q, MO_N, 9) };
}

function moRun(workload, blockSize) {
  return MoAlgorithm.run(workload.values, workload.queries,
    MoAlgorithm.distinctHooks(MO_UNIVERSE), { blockSize: blockSize });
}

test('offline-processing: four block sizes, and the one that minimises the moves', function () {
  const workload = moWorkload();
  const truth = MoAlgorithm.bruteForce(workload.values, workload.queries, 'distinct');
  const expected = [
    { blockSize: 16, moves: 357720, predicted: 1009600 },
    { blockSize: 63, moves: 210636, predicted: 291768 },
    { blockSize: 163, moves: 121956, predicted: 195960 },
    { blockSize: 253, moves: 109260, predicted: 215041 }
  ];

  assert.strictEqual(Math.max(1, Math.round(Math.sqrt(MO_N) / 4)), 16);
  assert.strictEqual(Math.max(1, Math.round(Math.sqrt(MO_N))), 63);
  assert.strictEqual(MoAlgorithm.blockSizeFor(MO_N, MO_Q), 163);
  assert.strictEqual(Math.max(1, Math.round(Math.sqrt(MO_N) * 4)), 253);

  expected.forEach(function (row) {
    const run = moRun(workload, row.blockSize);
    assert.strictEqual(run.report.pointerMoves, row.moves, 'moves at b = ' + row.blockSize);
    assert.strictEqual(Math.round(MO_Q * row.blockSize + MO_N * MO_N / row.blockSize),
      row.predicted, 'the model at b = ' + row.blockSize);
    assert.deepStrictEqual(run.answers, truth, 'wrong answers at b = ' + row.blockSize);
  });

  /* The tuned block size minimises the *model*; the largest block minimises
     the measurement. Both are reported, and the gap is the teaching - so the
     test asserts the disagreement rather than only the winner. */
  const cheapest = expected.slice().sort(function (a, b) { return a.moves - b.moves; })[0];
  const bestModel = expected.slice().sort(function (a, b) { return a.predicted - b.predicted; })[0];
  assert.strictEqual(bestModel.blockSize, 163);
  assert.strictEqual(cheapest.blockSize, 253);

  quotes('offline-processing', ['357 720', '210 636', '121 956', '109 260', '16', '63', '163', '253']);
});

test('offline-processing: arrival order costs 11.6x, for identical answers', function () {
  const workload = moWorkload();
  const truth = MoAlgorithm.bruteForce(workload.values, workload.queries, 'distinct');
  const tuned = moRun(workload, MoAlgorithm.blockSizeFor(MO_N, MO_Q));
  const arrival = MoAlgorithm.runUnsorted(workload.values, workload.queries,
    MoAlgorithm.distinctHooks(MO_UNIVERSE));

  assert.strictEqual(arrival.report.pointerMoves, 1420156);
  assert.strictEqual(fixed(arrival.report.pointerMoves / tuned.report.pointerMoves, 1), '11.6');
  assert.deepStrictEqual(arrival.answers, truth);
  assert.deepStrictEqual(tuned.answers, truth);
  assert.strictEqual(truth.length, MO_Q);

  quotes('offline-processing', ['1 420 156', '11.6', '600']);
});

test('offline-processing: the measurement is 42% of the (n + q)·√n bound', function () {
  const workload = moWorkload();
  const tuned = moRun(workload, MoAlgorithm.blockSizeFor(MO_N, MO_Q));
  const bound = (MO_N + MO_Q) * Math.sqrt(MO_N);

  assert.strictEqual(Math.round(bound), 290930);
  assert.strictEqual(Math.round(100 * tuned.report.pointerMoves / bound), 42);
  assert.ok(tuned.report.pointerMoves < bound, 'the bound was exceeded');

  quotes('offline-processing', ['290 930', '42%']);
});
