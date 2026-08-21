'use strict';

/**
 * Every figure the M11.4-M11.6 worked examples quote, recomputed.
 *
 * Three sections whose whole subject is a *claim about a search*, so each
 * figure is asserted next to the thing that makes it meaningful:
 *
 *   - 11.4 asserts greedy's answer against `bestIndependent`, which is
 *     exhaustive, in both directions: equal on the matroid, strictly worse on
 *     the matching system. A matroid test that only checks the matroid cannot
 *     tell whether the checker does anything.
 *   - 11.5 rebuilds the whole 5 x 4 Sudoku matrix at the section's budget of
 *     500 000 nodes, including the two cells that exhaust it. Those cells are
 *     asserted to *report* exhaustion rather than to hold a number, because
 *     the section's claim is that MRV inverts on "platinum blonde" and an
 *     unfinished run is not a smaller number.
 *   - 11.6 asserts the inadmissible bound is WRONG (640 against 658) as well
 *     as cheap. That is the section, and a suite that only checks the sound
 *     bounds would pass with it repaired.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const Backtracking = require('../../src/js/algorithms/backtracking.js');
const Matroid = require('../../src/js/algorithms/matroid.js');
const BranchAndBound = require('../../src/js/algorithms/branch-and-bound.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-paradigms-search.js');
require('../../src/js/content/concepts-paradigms-search.js');

const weightOf = function (item) { return item.weight; };

/* -------------------------------------------------- 11.4 matroids */

/* The three-edge path with weights 2, 3, 2. Greedy takes the middle edge and
   is then stuck; the best matching is the two ends. */
const PATH = [
  { id: 0, from: 0, to: 1, weight: 2 },
  { id: 1, from: 1, to: 2, weight: 3 },
  { id: 2, from: 2, to: 3, weight: 2 }
];

test('matroids: matchings are hereditary, fail exchange, and defeat greedy', function () {
  const oracle = Matroid.matchingOracle();
  const analysis = Matroid.analyse(PATH, oracle);

  assert.strictEqual(analysis.groundSize, 3);
  assert.strictEqual(analysis.independentCount, 5);
  assert.strictEqual(analysis.oracleCalls, Math.pow(2, 3));
  assert.strictEqual(analysis.hereditary.holds, true);
  assert.strictEqual(analysis.exchange.holds, false);
  assert.strictEqual(analysis.isMatroid, false);

  /* The witness has to be the pair the section names: the singleton {1-2}
     cannot be extended from the two-edge matching {0-1, 2-3}. */
  const witness = analysis.exchange.witness;
  assert.deepStrictEqual(witness.smaller.map(function (e) { return e.id; }), [1]);
  assert.deepStrictEqual(witness.larger.map(function (e) { return e.id; }), [0, 2]);

  const greedy = Matroid.greedy(PATH, oracle, weightOf);
  const best = Matroid.bestIndependent(PATH, oracle, weightOf);
  assert.strictEqual(greedy.weight, 3);
  assert.strictEqual(best.weight, 4);
  assert.strictEqual(fixed(greedy.weight / best.weight), '0.75');

  quotes('matroids', ['2, 3, 2', '2^3']);
});

test('matroids: the same shape as a graphic matroid, where greedy is exact', function () {
  const random = Random.seeded(5);
  const vertices = Math.max(3, Math.ceil(Math.sqrt(8 * 2)));
  const edges = [];

  for (let i = 0; i < 8; i += 1) {
    const from = random.int(vertices);
    let to = random.int(vertices);

    if (to === from) to = (to + 1) % vertices;
    edges.push({ id: i, from: from, to: to, weight: 1 + random.int(20), vertices: vertices });
  }
  assert.strictEqual(vertices, 4);

  const oracle = Matroid.acyclicOracle(vertices);
  const analysis = Matroid.analyse(edges, oracle);
  assert.strictEqual(analysis.independentCount, 62);
  assert.strictEqual(analysis.oracleCalls, 256);
  assert.strictEqual(analysis.isMatroid, true);

  assert.strictEqual(Matroid.greedy(edges, oracle, weightOf).weight, 46);
  assert.strictEqual(Matroid.bestIndependent(edges, oracle, weightOf).weight, 46);

  /* Negating the weights turns Kruskal's maximum spanning forest into the
     minimum one, using the same greedy loop - which is the point of stating
     the exchange property rather than the algorithm. */
  const negated = function (edge) { return -edge.weight; };
  assert.strictEqual(-Matroid.greedy(edges, oracle, negated).weight, 16);

  /* Every spanning forest of this graph has the same size, so the two answers
     are comparable at all. */
  assert.strictEqual(Matroid.greedy(edges, oracle, weightOf).chosen.length, vertices - 1);

  quotes('matroids', ['62', '256', '46', '16']);
});

/* -------------------------------------------------- 11.5 backtracking */

const PUZZLES = {
  easy: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  escargot: '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
  inkala: '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..',
  antibrute: '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9',
  platinum: '.....6....59.....82....8....45........3........6..3.54...325..6..................'
};

const STACKS = [{}, { mrv: true }, { mrv: true, forward: true },
  { mrv: true, forward: true, ac3: true }];

const SUDOKU_BUDGET = 500000;

function sudokuRow(puzzle) {
  return STACKS.map(function (options) {
    return Backtracking.solveSudoku(PUZZLES[puzzle],
      Object.assign({ nodeBudget: SUDOKU_BUDGET }, options)).report;
  });
}

test('backtracking: the five-puzzle matrix at a budget of 500 000 nodes', function () {
  const expected = {
    easy: [4209, 52, 52, 1],
    escargot: [8970, 218, 210, 15],
    inkala: [49559, 10102, 9180, 929],
    antibrute: [500000, 45268, 39223, 6050],
    platinum: [419195, 500000, 500000, 500000]
  };
  const exhausted = { antibrute: [true, false, false, false], platinum: [false, true, true, true] };

  Object.keys(expected).forEach(function (puzzle) {
    sudokuRow(puzzle).forEach(function (report, index) {
      assert.strictEqual(report.nodes, expected[puzzle][index],
        puzzle + ' under stack ' + index);
      const budgetOut = (exhausted[puzzle] || [false, false, false, false])[index];
      assert.strictEqual(report.budgetExhausted, budgetOut,
        puzzle + ' stack ' + index + ' misreports whether it finished');
    });
  });

  quotes('backtracking', ['52', '218', '929', '49 559', '10 102', '9 180', '45 268',
    '6 050', '419 195', '500 000']);
});

/* The ranking inverts here, and that is the section. Asserting it as a
   *comparison* rather than as two numbers is what keeps the claim true if the
   budget ever moves. */
test('backtracking: MRV wins on four puzzles and loses on "platinum blonde"', function () {
  ['easy', 'escargot', 'inkala', 'antibrute'].forEach(function (puzzle) {
    const row = sudokuRow(puzzle);
    assert.ok(row[1].nodes < row[0].nodes || row[0].budgetExhausted,
      'MRV did not win on ' + puzzle);
    assert.ok(row[3].nodes < row[1].nodes, 'propagation did not help on ' + puzzle);
    assert.strictEqual(row[3].budgetExhausted, false);
  });

  const platinum = sudokuRow('platinum');
  assert.strictEqual(platinum[0].budgetExhausted, false, 'first-empty-cell order should FINISH here');
  assert.ok(platinum.slice(1).every(function (report) { return report.budgetExhausted; }),
    'every MRV stack should run out of budget on platinum blonde');
});

test('backtracking: what propagation actually replaces on Inkala', function () {
  const row = sudokuRow('inkala');
  assert.deepStrictEqual(row.map(function (report) { return report.backtracks; }),
    [49498, 10041, 10041, 1837]);
  assert.deepStrictEqual(row.map(function (report) { return report.propagations; }),
    [0, 0, 0, 9089]);

  /* Forward checking and MRV backtrack identically; forward checking only
     removes nodes, and the difference (10 102 against 9 180) is entirely in
     the nodes, not in the backtracks. That is the row's teaching. */
  assert.strictEqual(row[1].backtracks, row[2].backtracks);
  assert.ok(row[2].nodes < row[1].nodes);

  quotes('backtracking', ['49 498', '9 089']);
});

/* -------------------------------------------------- 11.6 branch and bound */

const ITEM_COUNT = 22;
const FILL_PERCENT = 40;

function knapsackInstance() {
  const random = Random.seeded(13);
  const items = [];
  let total = 0;

  for (let i = 0; i < ITEM_COUNT; i += 1) {
    const weight = 5 + random.int(45);
    items.push({ id: i, value: 10 + random.int(90), weight: weight });
    total += weight;
  }
  return { items: items, capacity: Math.max(1, Math.round(total * FILL_PERCENT / 100)) };
}

test('branch-and-bound: three bounds on the same 22-item instance', function () {
  const instance = knapsackInstance();
  assert.strictEqual(instance.capacity, 164);

  const expected = {
    fractional: { nodes: 70, pruned: 23, value: 658, admissible: true },
    density: { nodes: 282, pruned: 129, value: 658, admissible: true },
    inadmissible: { nodes: 40, pruned: 13, value: 640, admissible: false }
  };

  BranchAndBound.boundKinds.forEach(function (kind) {
    const run = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: kind });
    assert.strictEqual(run.report.nodes, expected[kind].nodes, kind + ' nodes');
    assert.strictEqual(run.report.pruned, expected[kind].pruned, kind + ' pruned');
    assert.strictEqual(run.value, expected[kind].value, kind + ' value');
    assert.strictEqual(run.admissible, expected[kind].admissible, kind + ' admissibility');
  });

  quotes('branch-and-bound', ['22', '164', '70', '23', '658', '282', '129', '40', '13', '640']);
});

test('branch-and-bound: the inadmissible bound is cheap, wrong, and silent about it', function () {
  const instance = knapsackInstance();
  const sound = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'fractional' });
  const cheat = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'inadmissible' });

  assert.ok(cheat.report.nodes < sound.report.nodes, 'the cheat should be cheaper');
  assert.strictEqual(cheat.value, 640);
  assert.strictEqual(sound.value, 658);
  assert.strictEqual(fixed(100 * (sound.value - cheat.value) / sound.value), '2.74');

  /* Nothing in the run says it is wrong. The chosen set is a legal packing,
     the search terminated, and the only signal is the `admissible` flag the
     module reports because the *bound* is known to be unsound - not because
     anything noticed the answer was short. */
  let weight = 0;

  cheat.chosen.forEach(function (id) {
    weight += instance.items.filter(function (item) { return item.id === id; })[0].weight;
  });
  assert.ok(weight <= instance.capacity, 'the cheat returned an illegal packing, which would be a hint');
  assert.strictEqual(cheat.report.budgetExhausted, false);
});

test('branch-and-bound: 70 nodes against 4 194 304 subsets', function () {
  const instance = knapsackInstance();
  const exhaustive = BranchAndBound.knapsackExhaustive(instance.items, instance.capacity);

  assert.strictEqual(exhaustive.report.nodes, Math.pow(2, ITEM_COUNT));
  assert.strictEqual(exhaustive.report.nodes, 4194304);
  assert.strictEqual(exhaustive.value, 658);

  const sound = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'fractional' });
  assert.strictEqual(Math.round(exhaustive.report.nodes / sound.report.nodes), 59919);

  quotes('branch-and-bound', ['4 194 304', '59 919×']);
});

test('branch-and-bound: the TSP bound changes the cost and not the tour', function () {
  const random = Random.seeded(13);
  const points = [];

  for (let i = 0; i < 9; i += 1) points.push({ x: random.int(100), y: random.int(100) });
  const matrix = BranchAndBound.distanceMatrix(points);
  const bounded = BranchAndBound.travellingSalesman(matrix, {});
  const plain = BranchAndBound.travellingSalesman(matrix, { useBound: false });

  assert.strictEqual(bounded.report.nodes, 2502);
  assert.strictEqual(plain.report.nodes, 109601);
  assert.strictEqual(fixed(bounded.length, 3), '226.019');
  assert.strictEqual(fixed(plain.length, 3), '226.019');
  assert.deepStrictEqual(bounded.tour, plain.tour);

  /* 8! = 40 320 leaves with the first city pinned; the unbounded search
     really does enumerate every permutation. */
  assert.strictEqual(plain.report.leaves, 40320);

  quotes('branch-and-bound', ['2 502', '109 601', '226.019']);
});
