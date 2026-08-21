'use strict';

/**
 * Every figure the M12.5-M12.8 worked examples quote, recomputed.
 *
 * The instances are the sections' own defaults: a six-matrix chain from
 * seed 3, nine optimal-BST weights from seed 11, a 2 000-node tree from
 * seed 4, twelve cities from seed 13, and the range 137…4 321.
 *
 * Two of these assert a *negative* result, because the section's claim
 * depends on it: the quadrangle inequality must fail with no tolerance (or
 * the tolerance is decoration), and the naive rerooting loop must be cheaper
 * on a path (or the "insurance with a premium" framing is wrong).
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const DpInterval = require('../../src/js/algorithms/dp-interval.js');
const DpTree = require('../../src/js/algorithms/dp-tree.js');
const DpBitmask = require('../../src/js/algorithms/dp-bitmask.js');
const DpDigit = require('../../src/js/algorithms/dp-digit.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-dp-structured.js');
require('../../src/js/content/concepts-dp-structured.js');

/* -------------------------------------------------- 12.5 interval-dp */

function chainDimensions() {
  const random = Random.seeded(3);
  const out = [];

  for (let i = 0; i <= 6; i += 1) out.push(5 + random.int(45));
  return out;
}

test('interval-dp: fifteen intervals, 35 split tests, 18 984 multiplications', function () {
  const dimensions = chainDimensions();
  const run = DpInterval.matrixChain(dimensions, {});

  assert.strictEqual(DpInterval.evaluationOrder(6).length, 15);
  assert.strictEqual(run.report.states, 15);
  assert.strictEqual(run.report.splitTests, 35);
  assert.strictEqual(run.cost, 18984);
  assert.strictEqual(DpInterval.matrixChainBruteForce(dimensions), 18984);
  assert.strictEqual(run.parenthesisation, '(M0 ((((M1 M2) M3) M4) M5))');

  quotes('interval-dp', ['15', '35', '18 984', '(M0 ((((M1 M2) M3) M4) M5))']);
});

test('interval-dp: the sweep settles 5 intervals of length 2, then 4, 3, 2, 1', function () {
  const byLength = {};

  DpInterval.evaluationOrder(6).forEach(function (cell) {
    byLength[cell.length] = (byLength[cell.length] || 0) + 1;
  });
  assert.deepStrictEqual(byLength, { 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 });

  quotes('interval-dp', ['5', '4', '3', '2', '1']);
});

function bstWeights() {
  const random = Random.seeded(11);
  const out = [];

  for (let i = 0; i < 9; i += 1) out.push((1 + random.int(20)) / 100);
  return out;
}

test("interval-dp: Knuth's optimisation halves the split tests for the same cost", function () {
  const weights = bstWeights();
  const plain = DpInterval.optimalBst(weights, {});
  const knuth = DpInterval.knuthOptimalBst(weights, {});

  assert.strictEqual(plain.report.splitTests, 156);
  assert.strictEqual(knuth.report.splitTests, 72);
  assert.strictEqual(fixed(plain.cost, 6), '2.590000');
  assert.strictEqual(fixed(knuth.cost, 6), '2.590000');
  assert.strictEqual(knuth.refused, false);
  assert.strictEqual(fixed(plain.report.splitTests / knuth.report.splitTests, 1), '2.2');

  quotes('interval-dp', ['156', '72', '2.590000', '2.2']);
});

/* The tolerance is not decoration: with an exact comparison this instance
   fails, so both directions are asserted. */
test('interval-dp: the classic weights violate the inequality by 1.11e-16', function () {
  const classic = [0.15, 0.10, 0.05, 0.10, 0.20, 0.10, 0.05, 0.10, 0.15];
  const sums = [0];

  classic.forEach(function (weight, i) { sums.push(sums[i] + weight); });
  const w = function (i, j) { return sums[j + 1] - sums[i]; };
  let worst = 0;

  for (let a = 0; a < 9; a += 1) {
    for (let b = a; b < 9; b += 1) {
      for (let c = b; c < 9; c += 1) {
        for (let d = c; d < 9; d += 1) {
          worst = Math.max(worst, (w(a, c) + w(b, d)) - (w(a, d) + w(b, c)));
        }
      }
    }
  }
  assert.ok(worst > 0, 'the violation must exist, or the tolerance has nothing to tolerate');
  assert.ok(worst < 1e-15, 'and it must be floating-point noise, not a real violation');
  assert.strictEqual(worst.toExponential(2), '1.11e-16');

  assert.strictEqual(DpInterval.checkQuadrangle(classic).holds, true);
  assert.strictEqual(DpInterval.checkQuadrangle(classic, { epsilon: 0 }).holds, false);

  /* The tolerance scales with the total weight, so the demo's own nine
     weights - which total 1.02 rather than exactly 1 - get a slightly larger
     one. That is the figure the example quotes. */
  assert.strictEqual(fixed(DpInterval.checkQuadrangle(bstWeights()).epsilon * 1e9, 2), '1.02');
  assert.strictEqual(fixed(DpInterval.checkQuadrangle(classic).epsilon * 1e9, 2), '1.00');

  quotes('interval-dp', ['1.11', '1.02']);
});

test('interval-dp: a negative weight fails at (0, 0, 2, 4) and the solver refuses', function () {
  const weights = bstWeights();
  const negative = weights.slice();
  negative[4] = -negative[4];
  const check = DpInterval.checkQuadrangle(negative);

  assert.strictEqual(check.holds, false);
  assert.deepStrictEqual([check.witness.a, check.witness.b, check.witness.c, check.witness.d],
    [0, 0, 2, 4]);
  assert.strictEqual(DpInterval.knuthOptimalBst(negative, {}).refused, true);

  quotes('interval-dp', ['0, 0, 2, 4']);
});

test('interval-dp: eight balloons yield 2 019 coins, checked exhaustively', function () {
  const random = Random.seeded(3);
  const letters = 'aabbc';
  let text = '';

  for (let i = 0; i < 14; i += 1) text += letters[random.int(5)];
  const balloons = [];

  for (let i = 0; i < 8; i += 1) balloons.push(1 + random.int(9));

  assert.strictEqual(DpInterval.burstBalloons(balloons, {}).coins, 2019);
  assert.strictEqual(DpInterval.burstBruteForce(balloons), 2019);

  const palindrome = DpInterval.palindromePartition(text, {});
  assert.strictEqual(palindrome.pieces.join(''), text, 'the pieces must rebuild the text');

  quotes('interval-dp', ['2 019']);
});

/* -------------------------------------------------- 12.6 tree-dp */

function shapeRow(shape, n) {
  const tree = DpTree.shapedTree(shape, n, Random.seeded(4));
  const run = DpTree.reroot(tree.adjacency, DpTree.distanceMonoid(), {});
  const degrees = tree.adjacency.map(function (edges) { return edges.length; });
  return {
    tree: tree,
    combines: run.report.combines,
    naive: degrees.reduce(function (total, d) { return total + d * d; }, 0),
    maxDegree: degrees.reduce(function (a, b) { return Math.max(a, b); }, 0),
    depth: DpTree.rootAt(tree.adjacency, 0, null).depth
      .reduce(function (a, b) { return Math.max(a, b); }, 0)
  };
}

test('tree-dp: 1 999 combines answer for all 2 000 roots', function () {
  const tree = DpTree.shapedTree('random', 2000, Random.seeded(4));
  const run = DpTree.sumOfDistances(tree.adjacency, {});

  assert.strictEqual(run.report.combines, 1999);
  assert.strictEqual(run.report.passes, 2);
  assert.strictEqual(fixed(run.report.combines / 2000, 2), '1.00');

  quotes('tree-dp', ['1 999', '2', '1.00']);
});

test('tree-dp: the 400-node oracle agrees at every node, and the root totals 2 159', function () {
  const tree = DpTree.shapedTree('random', 400, Random.seeded(4));
  const fast = DpTree.sumOfDistances(tree.adjacency, {});
  const truth = DpTree.sumOfDistancesBruteForce(tree.adjacency);

  assert.deepStrictEqual(fast.answer, truth);
  assert.strictEqual(fast.answer[0], 2159);

  quotes('tree-dp', ['2 159', '400']);
});

/* The negative result the section's framing depends on: on a path the naive
   loop is CHEAPER, and if that ever stops being true the prose is wrong. */
test('tree-dp: prefix/suffix loses on a path and wins by 333x on a star', function () {
  const rows = {
    random: shapeRow('random', 2000),
    path: shapeRow('path', 2000),
    star: shapeRow('star', 2000),
    caterpillar: shapeRow('caterpillar', 2000)
  };

  Object.keys(rows).forEach(function (shape) {
    assert.strictEqual(rows[shape].combines, 11994, shape + ' combines must be flat across shapes');
  });

  assert.strictEqual(rows.random.depth, 19);
  assert.strictEqual(rows.random.maxDegree, 11);
  assert.strictEqual(rows.path.naive, 7994);
  assert.strictEqual(rows.star.naive, 3998000);
  assert.strictEqual(fixed(rows.path.naive / rows.path.combines, 1), '0.7');
  assert.strictEqual(fixed(rows.caterpillar.naive / rows.caterpillar.combines, 1), '0.8');
  assert.strictEqual(fixed(rows.star.naive / rows.star.combines, 1), '333.3');
  assert.ok(rows.path.naive < rows.path.combines,
    'the naive loop must be CHEAPER on a path, or the "premium" framing is wrong');

  quotes('tree-dp', ['11 994', '7 994', '3 998 000', '333.3', '0.7', '0.8', '19', '11']);
});

test('tree-dp: the star rerooting agrees with a traversal from every node', function () {
  const tree = DpTree.shapedTree('star', 2000, Random.seeded(4));
  const fast = DpTree.sumOfDistances(tree.adjacency, {}).answer;
  assert.deepStrictEqual(fast, DpTree.sumOfDistancesBruteForce(tree.adjacency));
  assert.strictEqual(fast.length, 2000);

  quotes('tree-dp', ['2 000']);
});

/* -------------------------------------------------- 12.7 bitmask-dp */

function cityMatrix(count) {
  const random = Random.seeded(13);
  const points = [];

  for (let i = 0; i < count; i += 1) points.push({ x: random.int(100), y: random.int(100) });
  return points.map(function (a) {
    return points.map(function (b) { return Math.hypot(a.x - b.x, a.y - b.y); });
  });
}

test('bitmask-dp: 49 152 cells replace 39 916 800 tours', function () {
  const run = DpBitmask.travellingSalesman(cityMatrix(12), {});

  assert.strictEqual(run.report.cells, 49152);
  assert.strictEqual(run.report.cells, Math.pow(2, 12) * 12);
  assert.strictEqual(run.report.states, 11265);
  assert.strictEqual(run.report.transitions, 56342);
  assert.strictEqual(fixed(run.length, 6), '250.147376');
  assert.strictEqual(DpBitmask.memoryFor(12).permutations, 39916800);

  quotes('bitmask-dp', ['49 152', '39 916 800', '11 265', '56 342', '250.147376']);
});

test('bitmask-dp: at ten cities the table agrees with every permutation', function () {
  const matrix = cityMatrix(10);
  const table = DpBitmask.travellingSalesman(matrix, {});
  const brute = DpBitmask.tspBruteForce(matrix);

  assert.strictEqual(fixed(table.length, 6), '234.512447');
  assert.strictEqual(fixed(brute, 6), '234.512447');

  quotes('bitmask-dp', ['234.512447']);
});

test('bitmask-dp: the submask total is exactly 3^n, against an assumed 4^n', function () {
  [{ n: 4, steps: 81, naive: 256 }, { n: 8, steps: 6561, naive: 65536 },
    { n: 12, steps: 531441, naive: 16777216 }].forEach(function (row) {
    const count = DpBitmask.submaskCount(row.n);
    assert.strictEqual(count.steps, row.steps, 'n = ' + row.n);
    assert.strictEqual(count.predicted, row.steps, 'n = ' + row.n + ' must equal 3^n exactly');
    assert.strictEqual(count.naive, row.naive, '4^n at n = ' + row.n);
  });
  assert.strictEqual(Math.round(16777216 / 531441), 32, '4^12 overstates the work by about 32x');

  quotes('bitmask-dp', ['81', '6 561', '531 441', '16 777 216', '32']);
});

test('bitmask-dp: sum over subsets is 5 120 against 59 049 at ten bits', function () {
  const random = Random.seeded(3);
  const values = [];

  for (let i = 0; i < 1024; i += 1) values.push(random.int(100));
  const fast = DpBitmask.sumOverSubsets(values, 10, {});
  const slow = DpBitmask.sumOverSubsetsBySubmask(values, 10, {});

  assert.strictEqual(fast.report.transitions, 5120);
  assert.strictEqual(slow.report.submaskSteps, 59049);
  assert.deepStrictEqual(fast.values, slow.values);
  assert.strictEqual(fixed(59049 / 5120, 1), '11.5');

  quotes('bitmask-dp', ['5 120', '59 049', '1 024', '11.5']);
});

test('bitmask-dp: the memory wall in bytes', function () {
  assert.strictEqual(DpBitmask.memoryFor(12).bytes, 393216);
  assert.strictEqual(DpBitmask.memoryFor(20).bytes, 167772160);
  assert.strictEqual(DpBitmask.memoryFor(22).bytes, 738197504);
  assert.strictEqual(DpBitmask.memoryFor(25).cells, 838860800);
  assert.strictEqual(DpBitmask.memoryFor(25).bytes, 6710886400);
  assert.strictEqual(fixed(DpBitmask.memoryFor(25).bytes / 1e9, 1), '6.7');

  quotes('bitmask-dp', ['838 860 800', '6.7']);
});

/* -------------------------------------------------- 12.8 digit-dp */

const adjacent = DpDigit.noEqualAdjacent();

test('digit-dp: 3 155 numbers in 137…4 321, from 45 states rather than 4 185 values', function () {
  const run = DpDigit.countInRange(137, 4321, adjacent, {});

  assert.strictEqual(run.count, 3155);
  assert.strictEqual(run.upper, 3270);
  assert.strictEqual(run.lower, 115);
  assert.strictEqual(run.report.states, 45);
  assert.strictEqual(DpDigit.countBruteForce(137, 4321, adjacent), 3155);
  assert.strictEqual(4321 - 137 + 1, 4185);

  quotes('digit-dp', ['3 155', '3 270', '115', '45', '4 185']);
});

test('digit-dp: the other three properties over the same range', function () {
  [{ automaton: DpDigit.strictlyIncreasing(), count: 185 },
    { automaton: DpDigit.digitSumDivisibleBy(3), count: 1395 },
    { automaton: DpDigit.containsThirteen(), count: 184 }].forEach(function (row) {
    assert.strictEqual(DpDigit.countInRange(137, 4321, row.automaton, {}).count, row.count,
      row.automaton.name);
    assert.strictEqual(DpDigit.countBruteForce(137, 4321, row.automaton), row.count,
      row.automaton.name + ' against a one-by-one count');
  });

  quotes('digit-dp', ['185', '1 395', '184']);
});

test('digit-dp: fifteen orders of magnitude of range, eight times the states', function () {
  const rows = [{ bound: 1000, count: 820, states: 25, digits: 4 },
    { bound: 1000000, count: 597871, states: 58, digits: 7 },
    { bound: 1000000000000, count: 317733228541, states: 124, digits: 13 },
    { bound: 1000000000000000000, count: 168856464709123940, states: 190, digits: 19 }];

  rows.forEach(function (row) {
    const run = DpDigit.countUpTo(row.bound, adjacent, {});
    assert.strictEqual(run.count, row.count, 'count up to ' + row.bound);
    assert.strictEqual(run.report.states, row.states, 'states up to ' + row.bound);
    assert.strictEqual(run.report.digits, row.digits, 'digits of ' + row.bound);
  });
  assert.strictEqual(Math.round(rows[3].states / rows[0].states), 8);

  quotes('digit-dp', ['820', '25', '317 733 228 541', '124',
    '168 856 464 709 123 940', '190']);
});

/* The bug that ranges cannot see. */
test('digit-dp: zero is counted by two of the four properties', function () {
  assert.strictEqual(DpDigit.countUpTo(0, adjacent, {}).count, 1);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.strictlyIncreasing(), {}).count, 1);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.containsThirteen(), {}).count, 0);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.digitSumDivisibleBy(3), {}).count, 1);

  /* And the reason it survives: the error cancels in the subtraction. */
  const upper = DpDigit.countUpTo(4321, adjacent, {}).count;
  const lower = DpDigit.countUpTo(136, adjacent, {}).count;
  assert.strictEqual((upper - 1) - (lower - 1), upper - lower,
    'a uniformly one-short prefix count still gives the right range');
});
