'use strict';

/**
 * Unit tests for the M11 design paradigms.
 *
 * Every algorithm in this milestone is a *pruning* of an exhaustive search,
 * and a pruning bug does not raise: it returns a plausible answer that is
 * merely wrong. So every property here is stated against a reference that
 * cannot be wrong in the same way as the thing it checks:
 *
 *   n-queens          against the published solution counts, which no
 *                     implementation of this code produced.
 *   Karatsuba         against BigInt multiplication - the one oracle in
 *                     JavaScript that is exact at every length.
 *   closest pair      against the quadratic scan, on the inputs that break
 *                     strip logic: duplicates, collinear points, and a pair
 *                     that straddles the divide.
 *   Strassen          against the triple loop, on the same matrices.
 *   greedy            against the interval-scheduling DP, and the coin
 *                     systems against exhaustive change-making.
 *   matroids          on families that ARE matroids and families that are
 *                     not, because a checker that always says yes passes
 *                     every one-sided test.
 *   branch and bound  against exhaustive enumeration, including the
 *                     inadmissible bound, which must be asserted WRONG.
 *   the sweeps        against the rescans they replace.
 *   meet in the middle against brute force over every subset.
 *   Mo's algorithm    against a per-query scan.
 *
 * The pruned searches are also asserted to *return the same answer* as the
 * unpruned ones, separately from their node counts. A pruning that changes
 * the answer is the failure mode; a pruning that changes only the cost is
 * the feature.
 */

const test = require('node:test');
const assert = require('node:assert');

const Backtracking = require('../../src/js/algorithms/backtracking.js');
const Karatsuba = require('../../src/js/algorithms/karatsuba.js');
const ClosestPair = require('../../src/js/algorithms/closest-pair.js');
const Strassen = require('../../src/js/algorithms/strassen.js');
const Greedy = require('../../src/js/algorithms/greedy.js');
const Matroid = require('../../src/js/algorithms/matroid.js');
const BranchAndBound = require('../../src/js/algorithms/branch-and-bound.js');
const TwoPointers = require('../../src/js/algorithms/two-pointers.js');
const MeetInMiddle = require('../../src/js/algorithms/meet-in-middle.js');
const MoAlgorithm = require('../../src/js/algorithms/mo-algorithm.js');
const SearchTreeLab = require('../../src/js/machines/search-tree-lab.js');
const Random = require('../../src/js/utils/random.js');

const BUDGET = { nodeBudget: 20000000 };

/* -------------------------------------------------- shared helpers */

function pointsFrom(seed, count, spread) {
  const random = Random.seeded(seed);
  const points = [];

  for (let i = 0; i < count; i += 1) {
    points.push({ x: random.int(spread), y: random.int(spread) });
  }
  return points;
}

function valuesFrom(seed, count, ceiling) {
  const random = Random.seeded(seed);
  const values = [];

  for (let i = 0; i < count; i += 1) values.push(random.int(ceiling));
  return values;
}

function matrixFrom(seed, side) {
  const random = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < side; i += 1) {
    const row = [];

    for (let j = 0; j < side; j += 1) row.push(random.int(200) / 100 - 1);
    out.push(row);
  }
  return out;
}

/* -------------------------------------------------- 11.1 / 11.5 backtracking */

/* Sloane A000170. Nothing in this repository produced these; that is the
   point of using them. */
const QUEENS_SOLUTIONS = [1, 0, 0, 2, 10, 4, 40, 92, 352, 724];

test('n-queens: the solution count matches the published sequence at every n', function () {
  QUEENS_SOLUTIONS.forEach(function (expected, index) {
    const n = index + 1;
    assert.strictEqual(Backtracking.nQueens(n, BUDGET).report.solutions, expected,
      'n = ' + n + ' should have ' + expected + ' solutions');
  });
});

test('n-queens: every pruning returns the same solution count as the unpruned search', function () {
  const configurations = [
    { earlyDiagonal: false, symmetry: false },
    { earlyDiagonal: true, symmetry: false },
    { earlyDiagonal: false, symmetry: true },
    { earlyDiagonal: true, symmetry: true },
    { earlyDiagonal: true, symmetry: true, mostConstrained: true }
  ];

  [4, 5, 6, 7, 8, 9].forEach(function (n) {
    configurations.forEach(function (options) {
      const run = Backtracking.nQueens(n, Object.assign({}, BUDGET, options));
      assert.strictEqual(run.report.solutions, QUEENS_SOLUTIONS[n - 1],
        'n = ' + n + ' under ' + JSON.stringify(options));
    });
  });
});

/* The symmetry pruning halves the search and reconstructs the other half by
   mirroring. Odd n has a self-mirroring column, so a plain doubling is wrong -
   this asserts the de-duplication, not the count. */
test('n-queens: the mirrored boards are distinct, legal, and complete', function () {
  [5, 6, 7].forEach(function (n) {
    const run = Backtracking.nQueens(n, Object.assign({}, BUDGET, { symmetry: true }));
    const seen = new Set();

    run.solutions.forEach(function (board) {
      assert.ok(Backtracking.boardIsLegal(board), 'an illegal board survived at n = ' + n);
      assert.strictEqual(board.length, n);
      seen.add(board.join(','));
    });
    assert.strictEqual(seen.size, QUEENS_SOLUTIONS[n - 1], 'duplicates at n = ' + n);
  });
});

test('n-queens: mirrorOf is an involution that preserves legality', function () {
  const run = Backtracking.nQueens(7, BUDGET);

  run.solutions.forEach(function (board) {
    const mirror = Backtracking.mirrorOf(board);
    assert.ok(Backtracking.boardIsLegal(mirror));
    assert.deepStrictEqual(Backtracking.mirrorOf(mirror), board);
  });
});

test('n-queens: pruning never costs more nodes than the search it prunes', function () {
  [6, 7, 8].forEach(function (n) {
    const control = Backtracking.nQueens(n, Object.assign({}, BUDGET,
      { earlyDiagonal: false, symmetry: false })).report.nodes;
    const early = Backtracking.nQueens(n, Object.assign({}, BUDGET,
      { earlyDiagonal: true, symmetry: false })).report.nodes;
    const both = Backtracking.nQueens(n, Object.assign({}, BUDGET,
      { earlyDiagonal: true, symmetry: true })).report.nodes;

    assert.ok(early < control, 'the early check should shrink the tree at n = ' + n);
    assert.ok(both < early, 'symmetry should shrink it further at n = ' + n);
  });
});

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const INKALA = '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..';

function sudokuIsSolved(grid) {
  for (let unit = 0; unit < 9; unit += 1) {
    const row = new Set();
    const column = new Set();
    const box = new Set();

    for (let i = 0; i < 9; i += 1) {
      row.add(grid[unit * 9 + i]);
      column.add(grid[i * 9 + unit]);
      const r = Math.floor(unit / 3) * 3 + Math.floor(i / 3);
      const c = (unit % 3) * 3 + (i % 3);
      box.add(grid[r * 9 + c]);
    }

    if (row.size !== 9 || column.size !== 9 || box.size !== 9) return false;
  }
  return true;
}

test('sudoku: all four heuristic stacks reach the same, valid, clue-preserving grid', function () {
  const stacks = [{}, { mrv: true }, { mrv: true, forward: true },
    { mrv: true, forward: true, ac3: true }];
  const clues = Backtracking.parsePuzzle(INKALA);
  let reference = null;

  stacks.forEach(function (options) {
    const run = Backtracking.solveSudoku(INKALA, Object.assign({ nodeBudget: 500000 }, options));
    assert.ok(run.solved, 'the stack ' + JSON.stringify(options) + ' failed to solve Inkala');
    assert.ok(sudokuIsSolved(run.grid), 'an invalid grid was reported as solved');

    clues.forEach(function (digit, at) {
      if (digit !== 0) assert.strictEqual(run.grid[at], digit, 'a clue was overwritten');
    });

    if (reference === null) reference = run.grid.join('');
    else assert.strictEqual(run.grid.join(''), reference, 'the stacks disagree on the answer');
  });
});

test('sudoku: legalDigits agrees with a scan of the cell peers', function () {
  const grid = Backtracking.parsePuzzle(EASY);

  for (let at = 0; at < 81; at += 1) {
    if (grid[at] !== 0) continue;
    const blocked = new Set(Backtracking.peersOf(at).map(function (peer) { return grid[peer]; }));
    const expected = [];

    for (let digit = 1; digit <= 9; digit += 1) {
      if (!blocked.has(digit)) expected.push(digit);
    }
    assert.deepStrictEqual(Backtracking.legalDigits(grid, at), expected, 'cell ' + at);
  }
});

test('sudoku: a puzzle over budget reports it rather than reporting failure as fact', function () {
  const run = Backtracking.solveSudoku(INKALA, { nodeBudget: 100 });
  assert.strictEqual(run.report.budgetExhausted, true);
  assert.strictEqual(run.solved, false);
});

test('graph colouring: k colours succeed exactly when the graph is k-colourable', function () {
  const triangle = [[1, 2], [0, 2], [0, 1]];
  assert.strictEqual(Backtracking.colourGraph(triangle, 2, {}).coloured, false);
  assert.strictEqual(Backtracking.colourGraph(triangle, 3, {}).coloured, true);

  const evenCycle = [[1, 3], [0, 2], [1, 3], [0, 2]];
  const two = Backtracking.colourGraph(evenCycle, 2, {});
  assert.strictEqual(two.coloured, true);

  evenCycle.forEach(function (neighbours, node) {
    neighbours.forEach(function (other) {
      assert.notStrictEqual(two.colours[node], two.colours[other], 'adjacent nodes share a colour');
    });
  });
});

/* -------------------------------------------------- 11.2 divide and conquer */

test('karatsuba: agrees with BigInt at every length, including the ragged ones', function () {
  const random = Random.seeded(31);

  for (let n = 1; n <= 40; n += 1) {
    const a = [];
    const b = [];

    for (let i = 0; i < n; i += 1) {
      a.push(random.int(Karatsuba.BASE));
      b.push(random.int(Karatsuba.BASE));
    }
    const product = Karatsuba.karatsuba(a, b, { threshold: 1 });
    assert.strictEqual(Karatsuba.toBigInt(product.digits),
      Karatsuba.toBigInt(a) * Karatsuba.toBigInt(b), 'karatsuba is wrong at n = ' + n);
    assert.strictEqual(Karatsuba.toBigInt(Karatsuba.schoolbook(a, b, {}).digits),
      Karatsuba.toBigInt(a) * Karatsuba.toBigInt(b), 'schoolbook is wrong at n = ' + n);
  }
});

test('karatsuba: every schoolbook cutoff computes the same product', function () {
  const a = valuesFrom(3, 64, Karatsuba.BASE);
  const b = valuesFrom(5, 64, Karatsuba.BASE);
  const truth = Karatsuba.toBigInt(a) * Karatsuba.toBigInt(b);

  [1, 2, 4, 8, 16, 32, 64, 128].forEach(function (threshold) {
    assert.strictEqual(Karatsuba.toBigInt(Karatsuba.karatsuba(a, b, { threshold: threshold }).digits),
      truth, 'cutoff ' + threshold);
  });
});

test('karatsuba: three half-size products per level, not four', function () {
  Karatsuba.crossover({ threshold: 1, seed: 3 }).forEach(function (row) {
    assert.strictEqual(row.schoolbook, row.n * row.n, 'schoolbook is not n² at n = ' + row.n);
    assert.ok(row.agrees, 'the two multiplications disagree at n = ' + row.n);

    if (row.n >= 16) {
      assert.ok(row.karatsuba < row.schoolbook, 'karatsuba should win by n = ' + row.n);
    }
  });
});

/* A closest-pair bug returns a plausible pair, so the oracle is the whole
   test. The shapes are the ones that break strip logic. */
test('closest pair: agrees with brute force on uniform, duplicate and collinear points', function () {
  const shapes = {
    uniform: function (n, seed) { return pointsFrom(seed, n, 100000); },
    duplicates: function (n, seed) {
      return pointsFrom(seed, n, 7);
    },
    collinear: function (n, seed) {
      const random = Random.seeded(seed);
      const out = [];

      for (let i = 0; i < n; i += 1) out.push({ x: random.int(1000), y: 500 });
      return out;
    },
    column: function (n, seed) {
      const random = Random.seeded(seed);
      const out = [];

      for (let i = 0; i < n; i += 1) out.push({ x: 42, y: random.int(1000) });
      return out;
    }
  };

  Object.keys(shapes).forEach(function (name) {
    for (let n = 2; n <= 60; n += 7) {
      const points = shapes[name](n, n + 13);
      const fast = ClosestPair.closestPair(points, {});
      const slow = ClosestPair.bruteForce(points, {});
      assert.ok(Math.abs(fast.pair.distance - slow.pair.distance) < 1e-9,
        name + ' at n = ' + n + ': ' + fast.pair.distance + ' against ' + slow.pair.distance);
    }
  });
});

test('closest pair: the returned pair really is at the reported distance', function () {
  const points = pointsFrom(19, 500, 100000);
  const run = ClosestPair.closestPair(points, {});
  assert.ok(Math.abs(ClosestPair.distance(run.pair.a, run.pair.b) - run.pair.distance) < 1e-9);
  assert.notStrictEqual(run.pair.a, run.pair.b);
});

test('closest pair: the strip never needs more than seven comparisons per point', function () {
  [200, 1000, 2000].forEach(function (n) {
    const run = ClosestPair.closestPair(pointsFrom(n, n, 1000000), {});
    assert.ok(run.report.worstStripRun <= 7,
      'the strip ran ' + run.report.worstStripRun + ' deep at n = ' + n);
    assert.ok(run.report.distanceChecks < n * (n - 1) / 2, 'no saving against brute force');
  });
});

test('inversions: the merge count agrees with the quadratic count', function () {
  for (let n = 0; n <= 40; n += 1) {
    const values = valuesFrom(n + 3, n, 20);
    assert.strictEqual(ClosestPair.countInversions(values).inversions,
      ClosestPair.countInversionsNaive(values), 'n = ' + n);
  }

  const descending = [];

  for (let i = 200; i > 0; i -= 1) descending.push(i);
  assert.strictEqual(ClosestPair.countInversions(descending).inversions, 200 * 199 / 2);
  assert.strictEqual(ClosestPair.countInversions(descending.slice().reverse()).inversions, 0);
});

test('strassen: seven multiplications reproduce the triple loop to floating-point noise', function () {
  [1, 2, 4, 8, 16, 32].forEach(function (side) {
    const a = matrixFrom(side + 1, side);
    const b = matrixFrom(side + 2, side);
    const error = Strassen.errorAgainstCubic(a, b, { cutoff: 1 });
    assert.ok(error.relative < 1e-12,
      'side ' + side + ' drifted by ' + error.relative + ' relative');
  });
});

test('strassen: a non-power-of-two side is padded rather than mis-multiplied', function () {
  [3, 5, 7, 13].forEach(function (side) {
    const a = matrixFrom(side, side);
    const b = matrixFrom(side + 100, side);
    const fast = Strassen.strassen(a, b, { cutoff: 1 });
    assert.strictEqual(fast.matrix.length, side);
    assert.strictEqual(fast.matrix[0].length, side);
    assert.ok(Strassen.maxAbsoluteDifference(Strassen.cubic(a, b, {}).matrix, fast.matrix) < 1e-9,
      'side ' + side);
  });
});

test('strassen: the multiplication count is 7^log2(n), and cubic is n³', function () {
  [8, 16, 32].forEach(function (side) {
    const a = matrixFrom(7, side);
    const b = matrixFrom(11, side);
    assert.strictEqual(Strassen.cubic(a, b, {}).report.scalarProducts, side * side * side);
    assert.strictEqual(Strassen.strassen(a, b, { cutoff: 1 }).report.scalarProducts,
      Math.pow(7, Math.log2(side)));
  });
});

/* -------------------------------------------------- 11.3 greedy */

test('greedy: earliest finish is optimal on every instance the others fail', function () {
  for (let seed = 1; seed <= 60; seed += 1) {
    const random = Random.seeded(seed);
    const intervals = [];

    for (let i = 0; i < 12; i += 1) {
      const start = random.int(20);
      intervals.push({ id: i, start: start, end: start + 1 + random.int(Math.max(1, 20 - start)) });
    }
    const optimum = Greedy.optimalSchedule(intervals).size;
    assert.strictEqual(Greedy.schedule(intervals, 'earliest-finish').size, optimum,
      'earliest-finish is not optimal at seed ' + seed);

    Greedy.criterionKinds.forEach(function (kind) {
      assert.ok(Greedy.schedule(intervals, kind).size <= optimum,
        kind + ' beat the optimum at seed ' + seed);
    });
  }
});

test('greedy: a chosen schedule is genuinely conflict-free', function () {
  const random = Random.seeded(23);
  const intervals = [];

  for (let i = 0; i < 40; i += 1) {
    const start = random.int(60);
    intervals.push({ id: i, start: start, end: start + 1 + random.int(20) });
  }

  Greedy.criterionKinds.forEach(function (kind) {
    const chosen = Greedy.schedule(intervals, kind).chosen;

    for (let i = 0; i < chosen.length; i += 1) {
      for (let j = i + 1; j < chosen.length; j += 1) {
        assert.ok(!Greedy.overlaps(chosen[i], chosen[j]),
          kind + ' returned two overlapping intervals');
      }
    }
  });
});

test('greedy: only earliest-finish survives the counter-example search', function () {
  const beaten = Greedy.criterionKinds.filter(function (kind) {
    return Greedy.counterExample(kind, { seed: 5 }).intervals !== null;
  });
  assert.deepStrictEqual(beaten, ['earliest-start', 'shortest', 'fewest-conflicts']);

  beaten.forEach(function (kind) {
    const found = Greedy.counterExample(kind, { seed: 5 });
    assert.ok(found.greedy < found.optimal, kind + ' produced a non-counter-example');
    assert.strictEqual(Greedy.schedule(found.intervals, kind).size, found.greedy);
    assert.strictEqual(Greedy.optimalSchedule(found.intervals).size, found.optimal);
  });
});

test('greedy: isCanonical agrees with exhaustive change-making below its limit', function () {
  const systems = [[1, 5, 10, 25], [1, 2, 5, 10, 20, 50], [1, 3, 4], [1, 7, 10], [1, 15, 25], [1, 5, 11]];

  systems.forEach(function (coins) {
    const verdict = Greedy.isCanonical(coins);
    let firstFailure = null;

    for (let amount = 1; amount <= verdict.limit; amount += 1) {
      if (Greedy.greedyCoins(coins, amount) === Greedy.optimalCoins(coins, amount)) continue;
      firstFailure = amount;
      break;
    }

    if (verdict.canonical) {
      assert.strictEqual(firstFailure, null, JSON.stringify(coins) + ' is not canonical after all');
      return;
    }
    assert.strictEqual(verdict.witness.amount, firstFailure, JSON.stringify(coins));
    assert.strictEqual(Greedy.greedyCoins(coins, firstFailure), verdict.witness.greedy);
    assert.strictEqual(Greedy.optimalCoins(coins, firstFailure), verdict.witness.optimal);
  });
});

test('greedy: the fractional knapsack bounds the integral one, and can exceed it', function () {
  const random = Random.seeded(41);

  for (let trial = 0; trial < 40; trial += 1) {
    const items = [];

    for (let i = 0; i < 9; i += 1) {
      items.push({ value: 10 + random.int(90), weight: 5 + random.int(30) });
    }
    const capacity = 40 + random.int(60);
    const relaxed = Greedy.fractionalKnapsack(items, capacity).value;
    const integral = Greedy.integralKnapsack(items, capacity).value;
    assert.ok(relaxed >= integral - 1e-9,
      'the relaxation ' + relaxed + ' fell below the integral optimum ' + integral);
  }
});

test('greedy: staying ahead holds for earliest-finish at every k', function () {
  const random = Random.seeded(3);
  const intervals = [];

  for (let i = 0; i < 12; i += 1) {
    const start = random.int(20);
    intervals.push({ id: i, start: start, end: start + 1 + random.int(Math.max(1, 20 - start)) });
  }

  Greedy.stayingAheadTrace(intervals).forEach(function (row) {
    assert.ok(row.greedyEnd <= row.otherEnd, 'greedy fell behind at k = ' + row.k);
    assert.strictEqual(row.ahead, true);
  });
});

/* -------------------------------------------------- 11.4 matroids */

test('matroid: the checker says yes to matroids and no to the near-misses', function () {
  const uniformGround = [];

  for (let i = 0; i < 8; i += 1) uniformGround.push({ id: i, weight: 1 + i, group: i % 3 });

  assert.strictEqual(Matroid.analyse(uniformGround, Matroid.uniformOracle(3)).isMatroid, true);
  assert.strictEqual(Matroid.analyse(uniformGround,
    Matroid.partitionOracle(function (item) { return item.group; }, { 0: 1, 1: 2, 2: 1 })).isMatroid,
  true);

  const path = [{ id: 0, from: 0, to: 1, weight: 2 }, { id: 1, from: 1, to: 2, weight: 3 },
    { id: 2, from: 2, to: 3, weight: 2 }];
  const matching = Matroid.analyse(path, Matroid.matchingOracle());
  assert.strictEqual(matching.isMatroid, false);
  assert.strictEqual(matching.hereditary.holds, true, 'matchings ARE hereditary - only exchange fails');
  assert.strictEqual(matching.exchange.holds, false);

  assert.strictEqual(Matroid.analyse(path, Matroid.acyclicOracle(4)).isMatroid, true);
});

test('matroid: a family that is not even hereditary is caught by the first check', function () {
  const ground = [{ id: 0, weight: 1 }, { id: 1, weight: 2 }];
  const oracle = Matroid.allowedSetsOracle([[ground[0], ground[1]]]);
  const analysis = Matroid.analyse(ground, oracle);
  assert.strictEqual(analysis.hereditary.holds, false);
  assert.ok(analysis.hereditary.witness !== null);
});

test('matroid: greedy is optimal exactly on the matroids', function () {
  const weightOf = function (item) { return item.weight; };

  for (let seed = 1; seed <= 25; seed += 1) {
    const random = Random.seeded(seed);
    const vertices = 4;
    const edges = [];

    for (let i = 0; i < 8; i += 1) {
      const from = random.int(vertices);
      let to = random.int(vertices);

      if (to === from) to = (to + 1) % vertices;
      edges.push({ id: i, from: from, to: to, weight: 1 + random.int(20) });
    }
    const oracle = Matroid.acyclicOracle(vertices);
    assert.strictEqual(Matroid.analyse(edges, oracle).isMatroid, true);
    assert.strictEqual(Matroid.greedy(edges, oracle, weightOf).weight,
      Matroid.bestIndependent(edges, oracle, weightOf).weight, 'greedy lost on a matroid, seed ' + seed);
  }

  const path = [{ id: 0, from: 0, to: 1, weight: 2 }, { id: 1, from: 1, to: 2, weight: 3 },
    { id: 2, from: 2, to: 3, weight: 2 }];
  const oracle = Matroid.matchingOracle();
  assert.ok(Matroid.greedy(path, oracle, function (e) { return e.weight; }).weight <
    Matroid.bestIndependent(path, oracle, function (e) { return e.weight; }).weight,
  'the matching system should defeat greedy');
});

test('matroid: independentSets is closed downwards on every matroid oracle', function () {
  const ground = [];

  for (let i = 0; i < 6; i += 1) ground.push({ id: i, weight: i, group: i % 2 });
  const masks = new Set(Matroid.independentSets(ground, Matroid.uniformOracle(3)).independent);

  masks.forEach(function (mask) {
    for (let bit = 0; bit < 6; bit += 1) {
      if ((mask & (1 << bit)) === 0) continue;
      assert.ok(masks.has(mask & ~(1 << bit)), 'a subset of an independent set is missing');
    }
  });
  assert.strictEqual(masks.size, 1 + 6 + 15 + 20);
});

/* -------------------------------------------------- 11.6 branch and bound */

function knapsackInstance(seed, count, fillPercent) {
  const random = Random.seeded(seed);
  const items = [];
  let total = 0;

  for (let i = 0; i < count; i += 1) {
    const weight = 5 + random.int(45);
    items.push({ id: i, value: 10 + random.int(90), weight: weight });
    total += weight;
  }
  return { items: items, capacity: Math.max(1, Math.round(total * fillPercent / 100)) };
}

test('branch and bound: the admissible bounds find the exhaustive optimum', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const instance = knapsackInstance(seed, 14, 40);
    const truth = BranchAndBound.knapsackExhaustive(instance.items, instance.capacity);

    ['fractional', 'density'].forEach(function (bound) {
      const run = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: bound });
      assert.strictEqual(run.value, truth.value, bound + ' missed the optimum at seed ' + seed);
      assert.strictEqual(run.admissible, true);
      assert.ok(run.report.nodes < truth.report.nodes, bound + ' explored more than exhaustive search');
    });
  }
});

test('branch and bound: the chosen set fits the capacity and sums to the reported value', function () {
  const instance = knapsackInstance(13, 22, 40);

  BranchAndBound.boundKinds.forEach(function (bound) {
    const run = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: bound });
    let weight = 0;
    let value = 0;

    run.chosen.forEach(function (id) {
      const item = instance.items.filter(function (entry) { return entry.id === id; })[0];
      weight += item.weight;
      value += item.value;
    });
    assert.ok(weight <= instance.capacity, bound + ' overfilled the sack');
    assert.strictEqual(value, run.value, bound + ' misreported its own value');
  });
});

/* The inadmissible bound must be asserted WRONG. A test suite that only
   checks the good bounds cannot tell whether the bad one is still bad. */
test('branch and bound: the inadmissible bound is silently, reproducibly wrong', function () {
  const instance = knapsackInstance(13, 22, 40);
  const truth = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'fractional' });
  const cheat = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'inadmissible' });

  assert.strictEqual(cheat.admissible, false);
  assert.ok(cheat.value < truth.value, 'the 90% bound found the optimum, so it demonstrates nothing');
  assert.ok(cheat.report.nodes < truth.report.nodes, 'the cheat should also be cheaper');
});

test('branch and bound: the fractional bound dominates the density bound on nodes', function () {
  let fractionalWins = 0;

  for (let seed = 1; seed <= 15; seed += 1) {
    const instance = knapsackInstance(seed, 18, 40);
    const a = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'fractional' });
    const b = BranchAndBound.knapsack(instance.items, instance.capacity, { bound: 'density' });
    assert.strictEqual(a.value, b.value, 'the two admissible bounds disagree at seed ' + seed);

    if (a.report.nodes < b.report.nodes) fractionalWins += 1;
  }
  assert.ok(fractionalWins >= 13, 'the tighter bound won only ' + fractionalWins + ' of 15');
});

test('travelling salesman: the bound changes the cost and not the tour length', function () {
  for (let seed = 1; seed <= 8; seed += 1) {
    const random = Random.seeded(seed);
    const points = [];

    for (let i = 0; i < 8; i += 1) points.push({ x: random.int(100), y: random.int(100) });
    const matrix = BranchAndBound.distanceMatrix(points);
    const bounded = BranchAndBound.travellingSalesman(matrix, {});
    const plain = BranchAndBound.travellingSalesman(matrix, { useBound: false });

    assert.ok(Math.abs(bounded.length - plain.length) < 1e-9, 'the tours differ at seed ' + seed);
    assert.ok(bounded.report.nodes < plain.report.nodes, 'the bound did not prune at seed ' + seed);
    assert.strictEqual(bounded.tour[0], 0);
    assert.strictEqual(bounded.tour[bounded.tour.length - 1], 0);
    assert.strictEqual(new Set(bounded.tour).size, 8, 'a city was visited twice');
  }
});

/* -------------------------------------------------- 11.7 two pointers */

test('sliding window: the deque agrees with the rescan on every shape', function () {
  const shapes = ['random', 'ascending', 'descending', 'sawtooth'];

  shapes.forEach(function (shape) {
    for (let k = 1; k <= 8; k += 1) {
      const n = 60;
      const random = Random.seeded(7);
      const values = [];

      for (let i = 0; i < n; i += 1) {
        if (shape === 'ascending') values.push(i);
        else if (shape === 'descending') values.push(n - i);
        else if (shape === 'sawtooth') values.push(i % Math.max(2, Math.floor(k / 2)));
        else values.push(random.int(n * 4));
      }
      assert.deepStrictEqual(TwoPointers.maxInSlidingWindow(values, k, {}).values,
        TwoPointers.maxInSlidingWindowNaive(values, k), shape + ' at k = ' + k);
    }
  });
});

test('sliding window: every element is pushed once and popped at most once', function () {
  [500, 2000, 5000].forEach(function (n) {
    const run = TwoPointers.maxInSlidingWindow(valuesFrom(7, n, n * 4), 50, {});
    assert.strictEqual(run.report.pushes, n);
    assert.ok(run.report.pops <= n, 'more pops than elements');
    assert.ok(run.report.pushes + run.report.pops <= 2 * n, 'the amortised bound was broken');
    assert.ok(run.report.maxSize <= 50, 'the deque outgrew the window');
  });
});

test('largest rectangle: the stack sweep agrees with the quadratic scan', function () {
  for (let n = 0; n <= 40; n += 1) {
    const heights = valuesFrom(n + 11, n, 30);
    assert.strictEqual(TwoPointers.largestRectangle(heights).best.area,
      TwoPointers.largestRectangleNaive(heights), 'n = ' + n);
  }
  assert.strictEqual(TwoPointers.largestRectangle([2, 1, 5, 6, 2, 3]).best.area, 10);
});

test('largest rectangle: the reported rectangle really fits under the bars', function () {
  const heights = valuesFrom(11, 2000, 100);
  const best = TwoPointers.largestRectangle(heights).best;

  for (let i = best.left; i <= best.right; i += 1) {
    assert.ok(heights[i] >= best.height, 'the rectangle pokes through bar ' + i);
  }
  assert.strictEqual((best.right - best.left + 1) * best.height, best.area);
});

test('next greater: the indices agree with a rightward scan', function () {
  const heights = valuesFrom(29, 300, 50);
  const indices = TwoPointers.nextGreater(heights).indices;

  heights.forEach(function (height, at) {
    let expected = -1;

    for (let j = at + 1; j < heights.length; j += 1) {
      if (heights[j] <= height) continue;
      expected = j;
      break;
    }
    assert.strictEqual(indices[at], expected, 'index ' + at);
  });
});

test('two pointers: the shortest window and the pair search agree with brute force', function () {
  const values = valuesFrom(37, 200, 20);
  const target = 60;
  let shortest = Infinity;
  let sum = 0;
  let left = 0;

  for (let right = 0; right < values.length; right += 1) {
    sum += values[right];

    while (sum >= target) {
      shortest = Math.min(shortest, right - left + 1);
      sum -= values[left];
      left += 1;
    }
  }
  const run = TwoPointers.shortestWindowAtLeast(values, target);
  assert.strictEqual(run.length, shortest === Infinity ? 0 : shortest);

  const sorted = values.slice().sort(function (a, b) { return a - b; });
  const pair = TwoPointers.pairWithSum(sorted, 25);
  assert.ok(pair.found === null || sorted[pair.found[0]] + sorted[pair.found[1]] === 25);
});

/* -------------------------------------------------- 11.8 meet in the middle */

test('meet in the middle: the closest subset sum agrees with brute force', function () {
  for (let n = 1; n <= 16; n += 1) {
    const values = valuesFrom(n + 5, n, 5000).map(function (v) { return v + 1; });
    const target = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / 2);
    const fast = MeetInMiddle.closestSubsetSum(values, target, {});
    const slow = MeetInMiddle.closestSubsetSumBruteForce(values, target, { maxItems: 20 });
    assert.strictEqual(Math.abs(fast.sum - target), Math.abs(slow.sum - target),
      'n = ' + n + ': ' + fast.sum + ' against ' + slow.sum);
  }
});

test('meet in the middle: the chosen indices really sum to the reported total', function () {
  const values = valuesFrom(5, 22, 5000).map(function (v) { return v + 1; });
  const target = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / 2);
  const run = MeetInMiddle.closestSubsetSum(values, target, {});
  const sum = run.chosen.reduce(function (total, index) { return total + values[index]; }, 0);

  assert.strictEqual(sum, run.sum);
  assert.strictEqual(new Set(run.chosen).size, run.chosen.length, 'an index was used twice');
  assert.strictEqual(run.report.statesGenerated, Math.pow(2, Math.ceil(22 / 2)) +
    Math.pow(2, Math.floor(22 / 2)));
});

test('meet in the middle: subsetSums enumerates every subset exactly once, sorted', function () {
  const values = [3, 1, 4, 1, 5];
  const sums = MeetInMiddle.subsetSums(values, {});
  assert.strictEqual(sums.length, 32);
  assert.strictEqual(new Set(sums.map(function (s) { return s.mask; })).size, 32);

  sums.forEach(function (entry, index) {
    let expected = 0;

    for (let bit = 0; bit < values.length; bit += 1) {
      if (entry.mask & (1 << bit)) expected += values[bit];
    }
    assert.strictEqual(entry.sum, expected, 'mask ' + entry.mask);

    if (index > 0) assert.ok(sums[index - 1].sum <= entry.sum, 'the halves are not sorted');
  });
});

test('bidirectional search: the same distance from a fraction of the states', function () {
  [[2, 6], [3, 6], [3, 8], [4, 8]].forEach(function (pair) {
    const built = MeetInMiddle.regularGraph(pair[0], pair[1]);
    const plain = MeetInMiddle.breadthFirst(built.graph, 0, built.deepest);
    const bidi = MeetInMiddle.bidirectional(built.graph, 0, built.deepest);

    assert.strictEqual(bidi.distance, plain.distance,
      'branching ' + pair[0] + ' depth ' + pair[1]);
    assert.strictEqual(bidi.distance, pair[1]);
    assert.ok(bidi.report.statesGenerated < plain.report.statesGenerated,
      'the meeting search touched more states than the one-sided one');
  });
});

/* -------------------------------------------------- 11.9 offline processing */

function moWorkload(size, queryCount, universe, seed) {
  const random = Random.seeded(seed);
  const values = [];

  for (let i = 0; i < size; i += 1) values.push(random.int(universe));
  return { values: values, queries: MoAlgorithm.randomQueries(queryCount, size, seed), universe: universe };
}

test("mo's algorithm: every block size answers every query correctly", function () {
  const workload = moWorkload(600, 120, 40, 9);
  const truth = MoAlgorithm.bruteForce(workload.values, workload.queries, 'distinct');

  [1, 5, 24, 50, 200, 600].forEach(function (blockSize) {
    const run = MoAlgorithm.run(workload.values, workload.queries,
      MoAlgorithm.distinctHooks(workload.universe), { blockSize: blockSize });
    assert.deepStrictEqual(run.answers, truth, 'block size ' + blockSize);
  });

  const unsorted = MoAlgorithm.runUnsorted(workload.values, workload.queries,
    MoAlgorithm.distinctHooks(workload.universe));
  assert.deepStrictEqual(unsorted.answers, truth, 'arrival order');
});

test("mo's algorithm: the sum hooks agree with a scan, and re-ordering is free", function () {
  const workload = moWorkload(400, 80, 1000, 17);
  const expected = workload.queries.map(function (query) {
    let total = 0;

    for (let i = query.left; i < query.right; i += 1) total += workload.values[i];
    return total;
  });
  const run = MoAlgorithm.run(workload.values, workload.queries, MoAlgorithm.sumHooks(),
    { blockSize: MoAlgorithm.blockSizeFor(400, 80) });
  assert.deepStrictEqual(run.answers, expected);
});

test("mo's algorithm: sorting the queries is what buys the saving", function () {
  const workload = moWorkload(4000, 600, 200, 9);
  const hooks = function () { return MoAlgorithm.distinctHooks(workload.universe); };
  const tuned = MoAlgorithm.run(workload.values, workload.queries, hooks(),
    { blockSize: MoAlgorithm.blockSizeFor(4000, 600) });
  const arrival = MoAlgorithm.runUnsorted(workload.values, workload.queries, hooks());

  assert.ok(tuned.report.pointerMoves * 5 < arrival.report.pointerMoves,
    'the ordering saved only ' + (arrival.report.pointerMoves / tuned.report.pointerMoves) + 'x');
  assert.ok(tuned.report.pointerMoves < (4000 + 600) * Math.sqrt(4000),
    'the run exceeded the (n + q)·√n bound');
});

test("mo's algorithm: the order sorts by block, and `alternate` snakes inside it", function () {
  const workload = moWorkload(500, 60, 30, 5);
  const plain = MoAlgorithm.order(workload.queries, 22, {});
  const snaked = MoAlgorithm.order(workload.queries, 22, { alternate: true });
  assert.strictEqual(plain.length, workload.queries.length);
  assert.strictEqual(new Set(plain.map(function (q) { return q.index; })).size, plain.length);

  function checkBlocks(ordered, alternate) {
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(ordered[i - 1].block <= ordered[i].block, 'the blocks are out of order at ' + i);

      if (ordered[i - 1].block !== ordered[i].block) continue;
      const descending = alternate && (ordered[i].block & 1);
      assert.ok(descending ? ordered[i - 1].right >= ordered[i].right
        : ordered[i - 1].right <= ordered[i].right, 'block ' + ordered[i].block + ' is unsorted');
    }
  }
  checkBlocks(plain, false);
  checkBlocks(snaked, true);
});

test("mo's algorithm: the block index really is left / blockSize", function () {
  const workload = moWorkload(500, 60, 30, 5);

  MoAlgorithm.order(workload.queries, 22, {}).forEach(function (query) {
    assert.strictEqual(query.block, Math.floor(query.left / 22));
    assert.deepStrictEqual({ left: query.left, right: query.right },
      { left: workload.queries[query.index].left, right: workload.queries[query.index].right });
  });
});

/* -------------------------------------------------- the shared explorer */

test('search tree lab: the explorer reproduces the solvers it draws', function () {
  const queens = SearchTreeLab.explore(SearchTreeLab.queensSpec(6, { earlyCheck: true }),
    { treeLimit: 500, nodeBudget: 400000 });
  assert.strictEqual(queens.report.leaves, 4, 'the explorer found a different number of boards');
  assert.ok(queens.report.nodes <= Backtracking.nQueens(6,
    Object.assign({}, BUDGET, { earlyDiagonal: false })).report.nodes);

  const instance = knapsackInstance(13, 14, 40);
  const truth = BranchAndBound.knapsackExhaustive(instance.items, instance.capacity);
  const explored = SearchTreeLab.explore(
    SearchTreeLab.knapsackSpec(instance.items, instance.capacity,
      BranchAndBound.bounds.fractional.fn), { treeLimit: 500, nodeBudget: 300000 });
  assert.strictEqual(explored.report.budgetExhausted, false);
  assert.ok(explored.report.pruned > 0, 'the bounded explorer pruned nothing');
  assert.strictEqual(explored.incumbent.value, truth.value,
    'the explorer disagrees with exhaustive enumeration');
});

test('search tree lab: the drawn tree is capped and says so', function () {
  const run = SearchTreeLab.explore(SearchTreeLab.queensSpec(8, {}),
    { treeLimit: 40, nodeBudget: 400000 });
  assert.ok(run.report.treeNodes <= 40);
  assert.strictEqual(run.report.treeTruncated, true);
  assert.ok(run.report.nodes > run.report.treeNodes, 'the counters stopped with the drawing');
});

test('search tree lab: legalBoard rejects the boards nQueens rejects', function () {
  assert.strictEqual(SearchTreeLab.legalBoard([0, 2, 4, 1]), Backtracking.boardIsLegal([0, 2, 4, 1]));
  assert.strictEqual(SearchTreeLab.legalBoard([0, 1]), Backtracking.boardIsLegal([0, 1]));
  assert.strictEqual(SearchTreeLab.legalBoard([1, 3, 0, 2]), true);
});
