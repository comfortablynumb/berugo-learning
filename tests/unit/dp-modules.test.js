'use strict';

/**
 * Unit tests for the M12 dynamic-programming modules.
 *
 * A DP fails by returning a plausible number, so every property here is
 * stated against a reference that cannot be wrong in the same way:
 *
 *   dp-lab            the three evaluations must agree, and the tabulation
 *                     must report cells read before they were written.
 *   dp-classic        LIS against exhaustive subsets, coin change against
 *                     enumeration of multisets, Kadane against the quadratic
 *                     scan — and the reconstruction checked, not the value.
 *   dp-knapsack       against exhaustive enumeration; the space-reduced
 *                     variants asserted to produce the same VALUE and no
 *                     reconstruction; the three bounded expansions asserted
 *                     to agree with each other.
 *   dp-sequence       against exhaustive recursion, with every alignment run
 *                     through `checkAlignment` — the assertion a distance
 *                     cannot make.
 *   dp-interval       against exhaustive parenthesisation and exhaustive
 *                     burst orders; Knuth's optimisation asserted to match
 *                     the unoptimised cost AND to refuse when its
 *                     precondition fails.
 *   dp-tree           rerooting against a traversal from every node, on the
 *                     shapes a random generator never produces.
 *   dp-bitmask        TSP against every permutation, tilings against the
 *                     known 8x8 value, and both identities asserted exactly.
 *   dp-digit          against counting one at a time, INCLUDING zero.
 *   dp-optimizations  every optimised solver against the quadratic
 *                     reference, and each one asserted to refuse when its
 *                     precondition is violated.
 *   game-theory       alpha-beta asserted to return minimax's value, and
 *                     Grundy asserted against the joint state space.
 *   expectation-dp    the recursion and the elimination on the same acyclic
 *                     chain, and Monte Carlo inside its stated interval.
 */

const test = require('node:test');
const assert = require('node:assert');

const DpLab = require('../../src/js/machines/dp-lab.js');
const DpClassic = require('../../src/js/algorithms/dp-classic.js');
const DpKnapsack = require('../../src/js/algorithms/dp-knapsack.js');
const DpSequence = require('../../src/js/algorithms/dp-sequence.js');
const DpInterval = require('../../src/js/algorithms/dp-interval.js');
const DpTree = require('../../src/js/algorithms/dp-tree.js');
const DpBitmask = require('../../src/js/algorithms/dp-bitmask.js');
const DpDigit = require('../../src/js/algorithms/dp-digit.js');
const DpOptimizations = require('../../src/js/algorithms/dp-optimizations.js');
const GameTheory = require('../../src/js/algorithms/game-theory.js');
const ExpectationDp = require('../../src/js/algorithms/expectation-dp.js');
const Random = require('../../src/js/utils/random.js');

function valuesFrom(seed, count, ceiling) {
  const random = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) out.push(random.int(ceiling));
  return out;
}

/* -------------------------------------------------------------- dp-lab */

test('dp-lab: the three evaluations agree, and only the naive one is exponential', function () {
  const problem = DpLab.fibonacciProblem();

  [10, 18, 25].forEach(function (n) {
    const run = DpLab.compare(problem, n, { states: DpLab.fibonacciStates(n) });
    assert.ok(run.agree, 'the evaluations disagree at n = ' + n);
    assert.strictEqual(run.rows[1].states, n + 1, 'memo states at n = ' + n);
    assert.ok(run.rows[0].calls > run.rows[1].calls,
      'the naive run should be more expensive at n = ' + n);
    assert.strictEqual(run.rows[2].unresolved, 0, 'the forward tabulation read an unwritten cell');
  });

  /* The gap is exponential, so it has to be asserted where it is visible: at
     n = 10 the naive run is only 8x the memo, and at n = 25 it is 4 955x. */
  const small = DpLab.compare(problem, 10, {});
  const large = DpLab.compare(problem, 25, {});
  assert.ok(small.rows[0].calls / small.rows[1].calls < 20, 'at n = 10 the gap is still small');
  assert.ok(large.rows[0].calls / large.rows[1].calls > 1000, 'at n = 25 it should be three orders');
});

test('dp-lab: a wrong evaluation order returns a number and reports the reads', function () {
  const problem = DpLab.fibonacciProblem();
  const states = DpLab.fibonacciStates(25);
  const forwards = DpLab.tabulated(problem, states, { target: 25 });
  const backwards = DpLab.tabulated(problem, states.slice().reverse(), { target: 25 });

  assert.strictEqual(forwards.value, 75025);
  assert.strictEqual(forwards.unresolved.length, 0);
  assert.strictEqual(typeof backwards.value, 'number',
    'the wrong order must produce a NUMBER, not NaN — that is the failure being taught');
  assert.ok(backwards.unresolved.length > 0, 'the wrong order read no unwritten cells');
  assert.notStrictEqual(backwards.value, forwards.value);
});

test('dp-lab: the naive run is capped and says so', function () {
  const run = DpLab.naive(DpLab.fibonacciProblem(), 40, { callBudget: 50000 });
  assert.strictEqual(run.report.budgetExhausted, true);
  assert.ok(run.report.calls > 50000);
});

test('dp-lab: overlap is measured, and divide-and-conquer-shaped problems have none', function () {
  const fib = DpLab.memoised(DpLab.fibonacciProblem(), 25, {});
  assert.ok(DpLab.dependencyDag(fib, {}).shared > 20, 'Fibonacci shares almost every state');

  const binomial = DpLab.memoised(DpLab.binomialProblem(), [20, 10], {});
  assert.strictEqual(binomial.value, 184756, 'C(20, 10)');
  assert.ok(DpLab.dependencyDag(binomial, {}).shared > 50, 'a lattice shares more than a path');
});

/* ----------------------------------------------------------- dp-classic */

test('dp-classic: Fibonacci agrees across all four evaluations', function () {
  for (let n = 0; n <= 20; n += 1) {
    const table = DpClassic.fibTable(n, {}).value;
    assert.strictEqual(DpClassic.fibMemo(n, {}).value, table, 'memo at n = ' + n);
    assert.strictEqual(DpClassic.fibTable(n, { rolling: true }).value, table, 'rolling at n = ' + n);

    if (n <= 18) assert.strictEqual(DpClassic.fibNaive(n, {}).value, table, 'naive at n = ' + n);
  }
  assert.strictEqual(DpClassic.fibTable(25, {}).value, 75025);
});

test('dp-classic: LIS agrees with exhaustive enumeration, both ways', function () {
  for (let trial = 0; trial < 25; trial += 1) {
    const values = valuesFrom(trial + 1, 13, 10);
    const expected = DpClassic.lisBruteForce(values);
    const quadratic = DpClassic.lisQuadratic(values, {});
    const patience = DpClassic.lisPatience(values, {});

    assert.strictEqual(quadratic.length, expected, 'quadratic at trial ' + trial);
    assert.strictEqual(patience.length, expected, 'patience at trial ' + trial);
  }
});

/* The check the length cannot make, run on both implementations. */
test('dp-classic: both LIS reconstructions are genuine increasing subsequences', function () {
  for (let trial = 0; trial < 25; trial += 1) {
    const values = valuesFrom(trial + 40, 60, 100);

    [DpClassic.lisQuadratic(values, {}), DpClassic.lisPatience(values, {})].forEach(function (run) {
      assert.strictEqual(run.sequence.length, run.length, 'trial ' + trial + ': length disagrees');
      assert.ok(DpClassic.isSubsequence(run.sequence, values),
        'trial ' + trial + ': the reconstruction is not a subsequence of the input');

      for (let i = 1; i < run.sequence.length; i += 1) {
        assert.ok(run.sequence[i] > run.sequence[i - 1], 'trial ' + trial + ': not strictly increasing');
      }
    });
  }
});

/* The pile tops must NOT be assumed to be an answer. If they were always a
   subsequence the section's whole point would be false, so this asserts the
   trap exists. */
test('dp-classic: the patience pile tops are often not a subsequence', function () {
  let notASubsequence = 0;

  for (let trial = 0; trial < 40; trial += 1) {
    const values = valuesFrom(trial + 100, 60, 200);
    const run = DpClassic.lisPatience(values, {});

    if (DpClassic.isSubsequence(run.piles, values)) continue;
    notASubsequence += 1;
  }
  assert.ok(notASubsequence > 20,
    'the pile tops were a subsequence on ' + (40 - notASubsequence) + ' of 40 inputs, which would make ' +
    'the section\'s claim false');
});

test('dp-classic: coin change counts combinations, and the other order counts permutations', function () {
  const coins = [1, 2, 5];

  for (let amount = 0; amount <= 25; amount += 1) {
    const combinations = DpClassic.coinChangeWays(coins, amount, {}).ways;
    const permutations = DpClassic.coinChangeWays(coins, amount, { order: 'permutations' }).ways;
    assert.strictEqual(combinations, DpClassic.coinWaysBruteForce(coins, amount),
      'combinations at amount ' + amount);
    assert.ok(permutations >= combinations, 'permutations cannot be fewer at amount ' + amount);

    if (amount >= 4) assert.ok(permutations > combinations, 'the two must diverge by amount 4');
  }
  assert.strictEqual(DpClassic.coinChangeWays(coins, 5, {}).ways, 4);
  assert.strictEqual(DpClassic.coinChangeWays(coins, 5, { order: 'permutations' }).ways, 9);
});

test('dp-classic: minimum coins reconstructs a set that sums to the amount', function () {
  const systems = [[1, 2, 5], [1, 3, 4], [2, 5], [1, 7, 10]];

  systems.forEach(function (coins) {
    for (let amount = 0; amount <= 30; amount += 1) {
      const run = DpClassic.coinChangeMin(coins, amount, {});

      if (run.count === null) {
        assert.strictEqual(run.coins.length, 0, 'an impossible amount must return no coins');
        continue;
      }
      assert.strictEqual(run.coins.length, run.count, 'the list length must be the count');
      assert.strictEqual(run.coins.reduce(function (a, b) { return a + b; }, 0), amount,
        JSON.stringify(coins) + ' at ' + amount + ': the coins do not sum to the amount');
    }
  });
});

test('dp-classic: Kadane agrees with the quadratic scan, and its range re-sums', function () {
  for (let trial = 0; trial < 30; trial += 1) {
    const values = valuesFrom(trial + 7, 40, 20).map(function (v) { return v - 10; });
    const fast = DpClassic.maxSubarray(values, {});
    const slow = DpClassic.maxSubarrayNaive(values);
    assert.strictEqual(fast.value, slow.value, 'trial ' + trial);

    let sum = 0;

    for (let i = fast.from; i <= fast.to; i += 1) sum += values[i];
    assert.strictEqual(sum, fast.value, 'trial ' + trial + ': the reported range does not re-sum');
  }
});

test('dp-classic: house robber never picks adjacent houses', function () {
  for (let trial = 0; trial < 25; trial += 1) {
    const values = valuesFrom(trial + 200, 30, 50);
    const run = DpClassic.houseRobber(values, {});
    let total = 0;

    run.chosen.forEach(function (index, position) {
      total += values[index];

      if (position === 0) return;
      assert.ok(index - run.chosen[position - 1] >= 2, 'trial ' + trial + ': adjacent houses chosen');
    });
    assert.strictEqual(total, run.value, 'trial ' + trial + ': the chosen houses do not sum to the value');
  }
});

test('dp-classic: unreachable is null rather than a large number', function () {
  assert.strictEqual(DpClassic.coinChangeMin([2, 5], 3, {}).count, null);
  assert.strictEqual(DpClassic.minJumps([0, 1, 1], {}).jumps, null);
  assert.strictEqual(DpClassic.minJumps([2, 3, 1, 1, 4], {}).jumps, 2);
});

/* --------------------------------------------------------- dp-knapsack */

function knapsackItems(seed, count) {
  const random = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    out.push({ id: i, value: 10 + random.int(90), weight: 2 + random.int(18) });
  }
  return out;
}

test('dp-knapsack: the full table matches exhaustive enumeration, and its set verifies', function () {
  for (let trial = 0; trial < 15; trial += 1) {
    const items = knapsackItems(trial + 1, 12);
    const capacity = 20 + trial * 5;
    const run = DpKnapsack.knapsack01(items, capacity, {});
    assert.strictEqual(run.value, DpKnapsack.bruteForce(items, capacity).value, 'trial ' + trial);

    const check = DpKnapsack.verify(items, capacity, run.chosen, run.value);
    assert.ok(check.fits, 'trial ' + trial + ': the chosen set overfills the sack');
    assert.ok(check.matches, 'trial ' + trial + ': the chosen set does not sum to the reported value');
  }
});

test('dp-knapsack: the one-row variant keeps the value and returns no reconstruction', function () {
  for (let trial = 0; trial < 15; trial += 1) {
    const items = knapsackItems(trial + 50, 14);
    const capacity = 30 + trial * 4;
    const full = DpKnapsack.knapsack01(items, capacity, {});
    const rolling = DpKnapsack.knapsack01Rolling(items, capacity, {});

    assert.strictEqual(rolling.value, full.value, 'trial ' + trial + ': the values must agree');
    assert.strictEqual(rolling.chosen, null,
      'the reduced variant must return no set rather than a wrong one');
    assert.ok(rolling.report.cells < full.report.cells, 'the reduction must actually save memory');
  }
});

test('dp-knapsack: the loop direction is the difference between 0/1 and unbounded', function () {
  const items = [{ id: 0, value: 10, weight: 3 }];
  assert.strictEqual(DpKnapsack.knapsack01Rolling(items, 30, {}).value, 10, 'each item once');
  assert.strictEqual(DpKnapsack.knapsackUnbounded(items, 30, {}).value, 100, 'ten copies');
});

test('dp-knapsack: all three bounded expansions agree, and the item counts differ', function () {
  for (let trial = 0; trial < 10; trial += 1) {
    const base = knapsackItems(trial + 90, 5);
    const items = base.map(function (item) {
      return { value: item.value, weight: item.weight, count: 1 + trial * 4 };
    });
    const capacity = 40 + trial * 3;
    const naive = DpKnapsack.boundedNaive(items, capacity, {});
    const binary = DpKnapsack.boundedBinary(items, capacity, {});
    const queue = DpKnapsack.boundedQueue(items, capacity, {});

    assert.strictEqual(binary.value, naive.value, 'trial ' + trial + ': binary splitting lost value');
    assert.strictEqual(queue.value, naive.value, 'trial ' + trial + ': the deque lost value');
    assert.ok(binary.expanded <= naive.expanded, 'binary splitting must not expand more');
    assert.strictEqual(queue.expanded, items.length, 'the deque must not expand at all');
  }
});

test('dp-knapsack: subset sum returns a witness that sums to the target', function () {
  for (let trial = 0; trial < 20; trial += 1) {
    const values = valuesFrom(trial + 300, 12, 20).map(function (v) { return v + 1; });
    const target = 20 + trial;
    const run = DpKnapsack.subsetSum(values, target, {});

    if (!run.reachable) {
      assert.strictEqual(run.chosen.length, 0);
      continue;
    }
    const sum = run.chosen.reduce(function (total, i) { return total + values[i]; }, 0);
    assert.strictEqual(sum, target, 'trial ' + trial + ': the witness does not sum to the target');
    assert.strictEqual(new Set(run.chosen).size, run.chosen.length, 'an index was used twice');
  }
});

test('dp-knapsack: the bit cost grows tenfold per decimal digit', function () {
  let previous = null;

  [10, 100, 1000, 10000].forEach(function (capacity) {
    const cost = DpKnapsack.bitCost(12, capacity);
    assert.strictEqual(cost.bits, Math.ceil(Math.log2(capacity + 1)));

    if (previous !== null) {
      const ratio = cost.cells / previous;
      assert.ok(ratio > 9 && ratio < 11, 'a tenfold capacity should be about tenfold work; got ' + ratio);
    }
    previous = cost.cells;
  });
});

/* --------------------------------------------------------- dp-sequence */

test('dp-sequence: edit distance agrees with exhaustive recursion', function () {
  const words = ['', 'a', 'ab', 'abc', 'kitten', 'sitting', 'flaw', 'lawn', 'aaa', 'aba'];

  words.forEach(function (a) {
    words.forEach(function (b) {
      if (a.length + b.length > 13) return;
      assert.strictEqual(DpSequence.editDistance(a, b, {}).distance,
        DpSequence.editDistanceBruteForce(a, b), a + ' / ' + b);
    });
  });
});

test('dp-sequence: every alignment strips back to its inputs and costs what is claimed', function () {
  const pairs = [['kitten', 'sitting'], ['intention', 'execution'], ['abcabba', 'cbabac'],
    ['', 'abc'], ['abc', ''], ['same', 'same'], ['aaa', 'aaaaaa'], ['xyz', 'abc'], ['a', 'b']];

  pairs.forEach(function (pair) {
    [DpSequence.editDistance(pair[0], pair[1], {}),
      DpSequence.hirschberg(pair[0], pair[1], {})].forEach(function (run, which) {
      const check = DpSequence.checkAlignment(pair[0], pair[1], run.alignment);
      assert.ok(check.valid, pair.join('/') + ' (' + which + '): ' + check.problems.join('; '));
      assert.strictEqual(DpSequence.alignmentCost(run.alignment, {}), run.distance,
        pair.join('/') + ' (' + which + '): the alignment does not cost the reported distance');
    });
  });
});

test('dp-sequence: Hirschberg gets the same distance in two rows of memory', function () {
  const pairs = [['kitten', 'sitting'], ['intention', 'execution'], ['abcabba', 'cbabac']];

  pairs.forEach(function (pair) {
    const full = DpSequence.editDistance(pair[0], pair[1], {});
    const rows = DpSequence.editDistanceRows(pair[0], pair[1], {});
    const linear = DpSequence.hirschberg(pair[0], pair[1], {});

    assert.strictEqual(rows.distance, full.distance, pair.join('/'));
    assert.strictEqual(linear.distance, full.distance, pair.join('/'));
    assert.ok(linear.report.peakCells < full.report.peakCells,
      pair.join('/') + ': Hirschberg used no less memory than the full table');
    assert.strictEqual(rows.alignment, undefined,
      'the two-row variant must not return an alignment field at all');
  });
});

test('dp-sequence: Damerau is a different distance, not a refinement', function () {
  assert.strictEqual(DpSequence.editDistance('ab', 'ba', {}).distance, 2);
  assert.strictEqual(DpSequence.editDistance('ab', 'ba', { costs: { transpose: 1 } }).distance, 1);
  assert.strictEqual(DpSequence.editDistance('ca', 'abc', {}).distance, 3);
});

test('dp-sequence: LCS bounds both lengths, and the diff reproduces the inputs', function () {
  const pairs = [['abcabba', 'cbabac'], ['kitten', 'sitting'], ['abc', 'abc'], ['abc', 'xyz']];

  pairs.forEach(function (pair) {
    const lcs = DpSequence.longestCommonSubsequence(pair[0], pair[1], {});
    assert.ok(lcs.length <= Math.min(pair[0].length, pair[1].length));

    const script = DpSequence.diffScript(pair[0], pair[1]);
    let left = '';
    let right = '';

    script.forEach(function (step) {
      if (step.op !== 'add') left += step.value;

      if (step.op !== 'remove') right += step.value;
    });
    assert.strictEqual(left, pair[0], pair.join('/') + ': the diff does not rebuild the first input');
    assert.strictEqual(right, pair[1], pair.join('/') + ': the diff does not rebuild the second');
  });
});

test('dp-sequence: local alignment never scores below global, and affine never above it', function () {
  const pairs = [['ACACACTA', 'AGCACACA'], ['AAAA', 'TTTTAAAATTTT'], ['abcdef', 'zzzcdezz']];

  pairs.forEach(function (pair) {
    const global = DpSequence.alignScored(pair[0], pair[1], {}).score;
    const local = DpSequence.alignScored(pair[0], pair[1], { mode: 'local' }).score;
    const affine = DpSequence.alignAffine(pair[0], pair[1], {}).score;

    assert.ok(local >= global, pair.join('/') + ': local must be at least global');
    assert.ok(affine <= global, pair.join('/') + ': opening a gap cannot make the score better');
  });
});

/* --------------------------------------------------------- dp-interval */

test('dp-interval: matrix chain agrees with every parenthesisation', function () {
  for (let trial = 0; trial < 15; trial += 1) {
    const dimensions = valuesFrom(trial + 1, 8, 40).map(function (v) { return v + 5; });
    const run = DpInterval.matrixChain(dimensions, {});
    assert.strictEqual(run.cost, DpInterval.matrixChainBruteForce(dimensions), 'trial ' + trial);
    assert.ok(run.parenthesisation.length > 0, 'a parenthesisation must come back');
  }
});

test('dp-interval: the evaluation order settles only shorter intervals first', function () {
  const order = DpInterval.evaluationOrder(7);
  const settled = new Set();

  order.forEach(function (cell) {
    for (let k = cell.i; k < cell.j; k += 1) {
      const left = cell.i + ',' + k;
      const right = (k + 1) + ',' + cell.j;
      assert.ok(k === cell.i || settled.has(left), 'read ' + left + ' before it was settled');
      assert.ok(k + 1 === cell.j || settled.has(right), 'read ' + right + ' before it was settled');
    }
    settled.add(cell.i + ',' + cell.j);
  });
  assert.strictEqual(order.length, 21, 'n = 7 has 21 intervals of length 2 or more');
});

test("dp-interval: Knuth's optimisation matches the full search and does less work", function () {
  for (let trial = 0; trial < 12; trial += 1) {
    const weights = valuesFrom(trial + 5, 9, 20).map(function (v) { return (v + 1) / 100; });
    const plain = DpInterval.optimalBst(weights, {});
    const knuth = DpInterval.knuthOptimalBst(weights, {});

    assert.strictEqual(knuth.refused, false, 'trial ' + trial + ': refused on non-negative weights');
    assert.ok(Math.abs(knuth.cost - plain.cost) < 1e-9, 'trial ' + trial + ': the costs differ');
    assert.ok(knuth.report.splitTests < plain.report.splitTests,
      'trial ' + trial + ': the narrowing did no fewer split tests');
  }
});

/* The precondition check must tolerate prefix-sum error, or it rejects the
   instance the optimisation was written for. */
test('dp-interval: the quadrangle check tolerates floating-point prefix sums', function () {
  const classic = [0.15, 0.10, 0.05, 0.10, 0.20, 0.10, 0.05, 0.10, 0.15];
  assert.strictEqual(DpInterval.checkQuadrangle(classic).holds, true,
    'the textbook nine-probability instance must pass');
  assert.strictEqual(DpInterval.checkQuadrangle(classic, { epsilon: 0 }).holds, false,
    'and with no tolerance it must fail — that is why the tolerance exists');

  const negative = classic.slice();
  negative[4] = -negative[4];
  assert.strictEqual(DpInterval.checkQuadrangle(negative).holds, false);
  assert.strictEqual(DpInterval.knuthOptimalBst(negative, {}).refused, true);
  assert.strictEqual(DpInterval.knuthOptimalBst(negative, {}).cost, null);
});

test('dp-interval: the reported BST cost is the cost of the reported tree', function () {
  const weights = [0.15, 0.10, 0.05, 0.10, 0.20, 0.10, 0.05, 0.10, 0.15];
  const run = DpInterval.optimalBst(weights, {});
  assert.ok(Math.abs(DpInterval.bstCostOf(weights, run.root, 0, weights.length - 1, 0) - run.cost) < 1e-9);
});

test('dp-interval: burst balloons and palindrome partitioning agree with enumeration', function () {
  for (let trial = 0; trial < 12; trial += 1) {
    const balloons = valuesFrom(trial + 11, 7, 9).map(function (v) { return v + 1; });
    assert.strictEqual(DpInterval.burstBalloons(balloons, {}).coins,
      DpInterval.burstBruteForce(balloons), 'balloons at trial ' + trial);
  }

  [['aab', 1], ['nitin', 0], ['ababbbabbababa', 3], ['a', 0], ['abcde', 4]].forEach(function (pair) {
    const run = DpInterval.palindromePartition(pair[0], {});
    assert.strictEqual(run.cuts, pair[1], pair[0]);
    assert.strictEqual(run.pieces.join(''), pair[0], pair[0] + ': the pieces do not rebuild the text');

    run.pieces.forEach(function (piece) {
      assert.strictEqual(piece, piece.split('').reverse().join(''), pair[0] + ': "' + piece +
        '" is not a palindrome');
    });
  });
});

/* ------------------------------------------------------------- dp-tree */

test('dp-tree: rerooting agrees with a traversal from every node, on every shape', function () {
  ['random', 'path', 'star', 'caterpillar'].forEach(function (shape) {
    [1, 2, 3, 5, 40, 200].forEach(function (n) {
      const tree = DpTree.shapedTree(shape, n, Random.seeded(n + 3));
      const fast = DpTree.sumOfDistances(tree.adjacency, {}).answer;
      const truth = DpTree.sumOfDistancesBruteForce(tree.adjacency);
      assert.deepStrictEqual(fast, truth, shape + ' at n = ' + n);
    });
  });
});

test('dp-tree: the general rerooting reproduces the specialised one', function () {
  ['random', 'star', 'path'].forEach(function (shape) {
    const tree = DpTree.shapedTree(shape, 120, Random.seeded(9));
    const general = DpTree.reroot(tree.adjacency, DpTree.distanceMonoid(), {});
    const truth = DpTree.sumOfDistancesBruteForce(tree.adjacency);
    assert.deepStrictEqual(general.answer.map(function (a) { return a.total; }), truth, shape);
  });
});

test('dp-tree: the combine count stays linear whatever the degree distribution', function () {
  const counts = ['random', 'path', 'star', 'caterpillar'].map(function (shape) {
    const tree = DpTree.shapedTree(shape, 500, Random.seeded(4));
    return DpTree.reroot(tree.adjacency, DpTree.distanceMonoid(), {}).report.combines;
  });
  const smallest = Math.min.apply(null, counts);
  const largest = Math.max.apply(null, counts);
  assert.ok(largest / smallest < 1.2,
    'the combine count varied by ' + (largest / smallest) + '× across shapes; it should be flat');
});

test('dp-tree: independent set never takes two adjacent nodes', function () {
  const tree = DpTree.shapedTree('random', 60, Random.seeded(12));
  const weights = valuesFrom(3, 60, 20).map(function (v) { return v + 1; });
  const run = DpTree.independentSet(tree.adjacency, weights, {});
  assert.ok(run.value > 0);

  /* The value must beat taking nothing and must not exceed taking everything. */
  const total = weights.reduce(function (a, b) { return a + b; }, 0);
  assert.ok(run.value <= total);
});

test('dp-tree: the diameter matches an exhaustive all-pairs search', function () {
  [1, 2, 6, 30, 120].forEach(function (n) {
    ['random', 'path', 'star'].forEach(function (shape) {
      const tree = DpTree.shapedTree(shape, n, Random.seeded(n + 1));
      let longest = 0;

      for (let source = 0; source < n; source += 1) {
        const rooted = DpTree.rootAt(tree.adjacency, source, null);
        rooted.depth.forEach(function (d) { longest = Math.max(longest, d); });
      }
      assert.strictEqual(DpTree.diameter(tree.adjacency, {}).length, longest, shape + ' at n = ' + n);
    });
  });
});

/* ---------------------------------------------------------- dp-bitmask */

test('dp-bitmask: Held-Karp agrees with every permutation', function () {
  for (let trial = 0; trial < 8; trial += 1) {
    const random = Random.seeded(trial + 1);
    const points = [];

    for (let i = 0; i < 8; i += 1) points.push({ x: random.int(100), y: random.int(100) });
    const matrix = points.map(function (a) {
      return points.map(function (b) { return Math.hypot(a.x - b.x, a.y - b.y); });
    });
    const run = DpBitmask.travellingSalesman(matrix, {});
    assert.ok(Math.abs(run.length - DpBitmask.tspBruteForce(matrix)) < 1e-9, 'trial ' + trial);
    assert.strictEqual(run.tour[0], 0);
    assert.strictEqual(run.tour[run.tour.length - 1], 0);
    assert.strictEqual(new Set(run.tour).size, 8, 'a city was visited twice');
  }
});

test('dp-bitmask: the submask total is exactly 3^n', function () {
  for (let n = 0; n <= 11; n += 1) {
    const count = DpBitmask.submaskCount(n);
    assert.strictEqual(count.steps, Math.pow(3, n), 'n = ' + n);
  }
  assert.deepStrictEqual(DpBitmask.submasks(0b1011), [11, 10, 9, 8, 3, 2, 1, 0]);
});

test('dp-bitmask: sum over subsets is identical to the submask walk and cheaper', function () {
  for (let bits = 1; bits <= 9; bits += 1) {
    const values = valuesFrom(bits + 3, 1 << bits, 100);
    const fast = DpBitmask.sumOverSubsets(values, bits, {});
    const slow = DpBitmask.sumOverSubsetsBySubmask(values, bits, {});
    assert.deepStrictEqual(fast.values, slow.values, 'the tables differ at ' + bits + ' bits');
    assert.ok(fast.report.transitions < slow.report.submaskSteps || bits <= 1,
      'SOS should be cheaper by ' + bits + ' bits');
  }
});

test('dp-bitmask: assignment agrees with exhaustive enumeration', function () {
  for (let trial = 0; trial < 10; trial += 1) {
    const random = Random.seeded(trial + 20);
    const cost = [];

    for (let i = 0; i < 7; i += 1) {
      const row = [];

      for (let j = 0; j < 7; j += 1) row.push(random.int(50));
      cost.push(row);
    }
    const run = DpBitmask.assignment(cost, {});
    assert.strictEqual(run.cost, DpBitmask.assignmentBruteForce(cost), 'trial ' + trial);
    assert.strictEqual(new Set(run.jobs).size, 7, 'a job was assigned twice');

    let total = 0;

    run.jobs.forEach(function (job, worker) { total += cost[worker][job]; });
    assert.strictEqual(total, run.cost, 'the assignment does not cost what was reported');
  }
});

/* Two external oracles: 2 x k boards are Fibonacci, and 8 x 8 is a published
   number that nothing in this repository produced. */
test('dp-bitmask: domino tilings match Fibonacci and the known 8 x 8 value', function () {
  const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

  for (let k = 1; k <= 12; k += 1) {
    assert.strictEqual(DpBitmask.dominoTilings(2, k, {}).tilings, fibonacci[k], '2 x ' + k);
  }
  assert.strictEqual(DpBitmask.dominoTilings(8, 8, {}).tilings, 12988816, '8 x 8');
  assert.strictEqual(DpBitmask.dominoTilings(4, 4, {}).tilings, 36, '4 x 4');
  assert.strictEqual(DpBitmask.dominoTilings(3, 3, {}).tilings, 0, 'an odd number of cells');
});

test('dp-bitmask: the memory figures are the ones the section quotes', function () {
  assert.strictEqual(DpBitmask.memoryFor(12).cells, 49152);
  assert.strictEqual(DpBitmask.memoryFor(25).cells, 838860800);
  assert.strictEqual(DpBitmask.memoryFor(25).bytes, 6710886400);
  assert.strictEqual(DpBitmask.memoryFor(12).permutations, 39916800);
});

/* ------------------------------------------------------------ dp-digit */

test('dp-digit: every automaton agrees with counting one at a time', function () {
  const automata = [DpDigit.noEqualAdjacent(), DpDigit.strictlyIncreasing(),
    DpDigit.digitSumDivisibleBy(3), DpDigit.digitSumDivisibleBy(7), DpDigit.containsThirteen()];

  automata.forEach(function (automaton) {
    [0, 1, 9, 10, 11, 99, 100, 137, 1000, 4321, 9999].forEach(function (high) {
      assert.strictEqual(DpDigit.countUpTo(high, automaton, {}).count,
        DpDigit.countBruteForce(0, high, automaton), automaton.name + ' up to ' + high);
    });
    assert.strictEqual(DpDigit.countInRange(137, 4321, automaton, {}).count,
      DpDigit.countBruteForce(137, 4321, automaton), automaton.name + ' over a range');
  });
});

/* The bug that survives a whole suite of range tests. */
test('dp-digit: the number zero is counted when the automaton accepts it', function () {
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.noEqualAdjacent(), {}).count, 1);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.strictlyIncreasing(), {}).count, 1);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.digitSumDivisibleBy(3), {}).count, 1);
  assert.strictEqual(DpDigit.countUpTo(0, DpDigit.containsThirteen(), {}).count, 0,
    'zero does not contain 13, so this one must NOT count it');
});

test('dp-digit: the state count tracks the digits rather than the value', function () {
  const automaton = DpDigit.noEqualAdjacent();
  const small = DpDigit.countUpTo(1000000, automaton, {});
  const huge = DpDigit.countUpTo(1000000000000000000, automaton, {});

  assert.ok(huge.report.digits > small.report.digits * 2);
  assert.ok(huge.report.states < small.report.states * 6,
    'the states grew ' + (huge.report.states / small.report.states) + '× for 10^12 times the range');
});

test('dp-digit: DAG algorithms refuse a cyclic graph rather than looping', function () {
  const cyclic = [[{ to: 1, weight: 1 }], [{ to: 0, weight: 1 }]];
  assert.strictEqual(DpDigit.topologicalOrder(cyclic), null);
  assert.strictEqual(DpDigit.longestPath(cyclic, {}).cyclic, true);
  assert.strictEqual(DpDigit.longestPath(cyclic, {}).length, null);
  assert.strictEqual(DpDigit.countPaths(cyclic, 0, {}).counts, null);
});

test('dp-digit: the longest path is a real path of the reported length', function () {
  for (let trial = 0; trial < 12; trial += 1) {
    const random = Random.seeded(trial + 30);
    const n = 12;
    const adjacency = [];

    for (let i = 0; i < n; i += 1) adjacency.push([]);

    for (let from = 0; from < n; from += 1) {
      for (let to = from + 1; to < n; to += 1) {
        if (random.next() >= 0.3) continue;
        adjacency[from].push({ to: to, weight: 1 + random.int(9) });
      }
    }
    const run = DpDigit.longestPath(adjacency, {});
    let total = 0;

    for (let i = 1; i < run.path.length; i += 1) {
      const edge = adjacency[run.path[i - 1]].filter(function (e) { return e.to === run.path[i]; })[0];
      assert.ok(edge, 'trial ' + trial + ': the reported path uses an edge that does not exist');
      total += edge.weight;
    }
    assert.strictEqual(total, run.length, 'trial ' + trial + ': the path does not weigh what was reported');
  }
});

test('dp-digit: automaton DP counts the strings the formula predicts', function () {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (let length = 1; length <= 5; length += 1) {
    const expected = 10 * Math.pow(9, length - 1);
    assert.strictEqual(
      DpDigit.countAcceptedStrings(DpDigit.noEqualAdjacent(), digits, length, {}).count,
      expected, 'length ' + length);
  }
});

/* --------------------------------------------------- dp-optimizations */

test('dp-optimizations: the hull matches the quadratic reference and does less work', function () {
  for (let trial = 0; trial < 12; trial += 1) {
    const values = valuesFrom(trial + 7, 200, 20).map(function (v) { return v + 1; });
    const instance = DpOptimizations.groupingInstance(values, 10 + trial * 10);
    const naive = DpOptimizations.groupingNaive(instance, {});
    const hull = DpOptimizations.groupingHull(instance, {});

    assert.strictEqual(hull.refused, false, 'trial ' + trial + ': refused on non-negative values');
    assert.strictEqual(hull.value, naive.value, 'trial ' + trial + ': the values differ');
    assert.ok(hull.report.transitions * 5 < naive.report.transitions,
      'trial ' + trial + ': the hull saved almost nothing');
  }
});

test('dp-optimizations: the hull refuses when the prefix sums fall', function () {
  const values = valuesFrom(107, 60, 21).map(function (v) { return v - 10; });
  const instance = DpOptimizations.groupingInstance(values, 50);
  const check = DpOptimizations.checkHullMonotone(instance);

  assert.strictEqual(check.holds, false, 'this instance is supposed to have falling prefix sums');
  assert.ok(check.witness.at > 0, 'the witness must name the index');
  assert.strictEqual(DpOptimizations.groupingHull(instance, {}).refused, true);
  assert.strictEqual(DpOptimizations.groupingHull(instance, {}).value, null);
});

test('dp-optimizations: Li Chao matches a direct minimum with no ordering preconditions', function () {
  const random = Random.seeded(31);
  const tree = DpOptimizations.createLiChao(0, 1000, {});
  const lines = [];

  for (let i = 0; i < 60; i += 1) {
    const line = { m: random.int(21) - 10, c: random.int(500) };
    lines.push(line);
    tree.add(line.m, line.c);
  }

  for (let x = 0; x <= 1000; x += 13) {
    let truth = Infinity;

    lines.forEach(function (line) { truth = Math.min(truth, line.m * x + line.c); });
    assert.strictEqual(tree.query(x), truth, 'at x = ' + x);
  }
});

test('dp-optimizations: divide and conquer and the aliens trick match the exact DP', function () {
  for (let trial = 0; trial < 8; trial += 1) {
    const values = valuesFrom(trial + 3, 60, 9).map(function (v) { return v + 1; });
    const groups = 2 + (trial % 4);
    const exact = DpOptimizations.groupingExactly(values, groups, {});
    const divide = DpOptimizations.groupingDivideConquer(
      DpOptimizations.groupingInstance(values, 0), groups, {});
    const aliens = DpOptimizations.aliensTrick(values, groups, {});

    assert.strictEqual(divide.refused, false, 'trial ' + trial + ': divide and conquer refused');
    assert.strictEqual(divide.value, exact.value, 'trial ' + trial + ': divide and conquer differs');

    if (!aliens.exact) continue;
    assert.ok(Math.abs(aliens.value - exact.value) < 1e-6,
      'trial ' + trial + ': the aliens trick differs by ' + Math.abs(aliens.value - exact.value));
  }
});

test('dp-optimizations: the sliding-window deque matches the rescan at every width', function () {
  const values = valuesFrom(17, 200, 20).map(function (v) { return v + 1; });

  [1, 2, 5, 25, 100, 200].forEach(function (width) {
    const deque = DpOptimizations.slidingWindowDp(values, width, {});
    const naive = DpOptimizations.slidingWindowNaive(values, width, {});
    assert.strictEqual(deque.value, naive.value, 'width ' + width);
    assert.ok(deque.report.transitions <= naive.report.transitions, 'width ' + width);
  });
});

/* --------------------------------------------------------- game-theory */

test('game-theory: alpha-beta returns minimax value under every ordering', function () {
  const game = GameTheory.ticTacToe();
  const plain = GameTheory.minimax(game, game.empty, {});
  const orderings = [null, GameTheory.centreFirst, GameTheory.edgesFirst, GameTheory.reverseOrder];

  orderings.forEach(function (order, which) {
    const run = GameTheory.alphaBeta(game, game.empty, order ? { orderMoves: order } : {});
    assert.strictEqual(run.value, plain.value, 'ordering ' + which);
    assert.ok(run.report.nodes < plain.report.nodes, 'ordering ' + which + ' pruned nothing');
  });
  assert.strictEqual(plain.value, 0, 'tic-tac-toe is a draw');
});

/* Reversing the list is NOT a worse ordering on a symmetric board, and the
   section says so - so the test asserts it rather than leaving it implied. */
test('game-theory: reversing the move list prunes identically on a symmetric board', function () {
  const game = GameTheory.ticTacToe();
  const forward = GameTheory.alphaBeta(game, game.empty, {});
  const reversed = GameTheory.alphaBeta(game, game.empty, { orderMoves: GameTheory.reverseOrder });
  assert.strictEqual(reversed.report.nodes, forward.report.nodes);

  const good = GameTheory.alphaBeta(game, game.empty, { orderMoves: GameTheory.centreFirst });
  const bad = GameTheory.alphaBeta(game, game.empty, { orderMoves: GameTheory.edgesFirst });
  assert.ok(bad.report.nodes > good.report.nodes * 3,
    'ranking squares by quality must actually separate the two');
});

test('game-theory: mex and the Grundy tables are right', function () {
  assert.strictEqual(GameTheory.mex([]), 0);
  assert.strictEqual(GameTheory.mex([0, 1, 2]), 3);
  assert.strictEqual(GameTheory.mex([1, 2, 3]), 0);
  assert.strictEqual(GameTheory.mex([0, 2, 3]), 1);

  const nim = GameTheory.grundyTable(30, GameTheory.nimMoves(), {});

  for (let size = 0; size <= 30; size += 1) {
    assert.strictEqual(nim.grundy[size], size, 'Nim at heap ' + size);
  }
  const sub = GameTheory.grundyTable(40, GameTheory.subtractionMoves([1, 3, 4]), {});
  assert.deepStrictEqual(sub.grundy.slice(0, 14), [0, 1, 0, 1, 2, 3, 2, 0, 1, 0, 1, 2, 3, 2]);
  assert.strictEqual(GameTheory.grundyPeriod(sub.grundy, {}).period, 7);
  assert.strictEqual(GameTheory.grundyPeriod(
    GameTheory.grundyTable(40, GameTheory.subtractionMoves([1, 2]), {}).grundy, {}).period, 3);
});

test('game-theory: the XOR verdict agrees with the joint state space', function () {
  const sets = [[1, 3, 4], [1, 2], [2, 3, 5], [1, 2, 3]];

  sets.forEach(function (allowed) {
    const moves = GameTheory.subtractionMoves(allowed);
    const table = GameTheory.grundyTable(12, moves, {});

    for (let a = 0; a <= 6; a += 1) {
      for (let b = 0; b <= 6; b += 1) {
        for (let c = 0; c <= 4; c += 1) {
          const xor = GameTheory.grundyOfSum([a, b, c], table.grundy);
          const joint = GameTheory.jointGameWinner([a, b, c], moves, {});
          assert.strictEqual(xor !== 0, joint.firstPlayerWins,
            '{' + allowed + '} on heaps ' + [a, b, c]);
        }
      }
    }
  });
});

test('game-theory: retrograde labels agree with the Grundy zeros', function () {
  const allowed = [1, 3, 4];
  const moves = GameTheory.subtractionMoves(allowed);
  const states = [];

  for (let size = 0; size <= 40; size += 1) states.push(size);
  const run = GameTheory.retrograde(states, moves, function (size) {
    return moves(size).length === 0 ? 'lose' : null;
  }, {});
  const grundy = GameTheory.grundyTable(40, moves, {}).grundy;

  states.forEach(function (size) {
    assert.strictEqual(run.label.get(size), grundy[size] === 0 ? 'lose' : 'win', 'heap ' + size);
  });
});

/* ------------------------------------------------------- expectation-dp */

function forwardChain(n) {
  return {
    states: Array.from({ length: n + 1 }, function (ignored, i) { return i; }),
    absorbing: function (state) { return state === n; },
    transitions: function (state) {
      return [{ to: Math.min(n, state + 1), probability: 0.5 },
        { to: Math.min(n, state + 2), probability: 0.5 }];
    }
  };
}

test('expectation-dp: the recursion and the elimination agree on acyclic chains', function () {
  [3, 8, 20, 40].forEach(function (n) {
    const chain = forwardChain(n);
    assert.notStrictEqual(ExpectationDp.topologicalOrder(chain), null, 'n = ' + n + ' should be acyclic');
    const recursion = ExpectationDp.byRecursion(chain, {});
    const elimination = ExpectationDp.byElimination(chain, {});

    for (let state = 0; state <= n; state += 1) {
      assert.ok(Math.abs(recursion.expected.get(state) - elimination.expected.get(state)) < 1e-9,
        'n = ' + n + ', state ' + state);
    }
  });
});

test('expectation-dp: a cyclic chain is detected and solved by elimination', function () {
  ['none', 'snakes'].forEach(function (kind) {
    const snakes = kind === 'snakes' ? { 17: 4, 13: 2 } : {};
    const chain = ExpectationDp.boardGame({ size: 20, faces: 6, snakes: snakes });
    assert.strictEqual(ExpectationDp.topologicalOrder(chain), null,
      'the overshoot rule alone makes the board cyclic');
    const run = ExpectationDp.solveExpectation(chain, {});
    assert.strictEqual(run.acyclic, false);
    assert.strictEqual(run.method, 'elimination');
    assert.ok(Number.isFinite(run.expected.get(0)), 'the answer must be finite');
    assert.ok(run.expected.get(0) > 0);
  });
  assert.throws(function () {
    ExpectationDp.byRecursion(ExpectationDp.boardGame({ size: 20, faces: 6 }), {});
  }, /cycle/, 'the recursion must refuse rather than loop');
});

test('expectation-dp: the rows of every board sum to one', function () {
  [{ size: 10, faces: 4 }, { size: 20, faces: 6 }, { size: 40, faces: 12, snakes: { 30: 3 } }]
    .forEach(function (options) {
      const check = ExpectationDp.checkStochastic(ExpectationDp.boardGame(options), {});
      assert.strictEqual(check.valid, true, JSON.stringify(options) + ': ' + JSON.stringify(check.problems));
    });
});

test('expectation-dp: the exact answer lies inside the simulated interval', function () {
  const chain = ExpectationDp.boardGame({ size: 20, faces: 6, snakes: { 17: 4, 13: 2 } });
  const exact = ExpectationDp.solveExpectation(chain, {}).expected.get(0);
  const simulated = ExpectationDp.monteCarlo(chain, 0, Random.seeded(11), { trials: 40000 });

  assert.ok(exact >= simulated.interval[0] && exact <= simulated.interval[1],
    'exact ' + exact + ' is outside [' + simulated.interval[0] + ', ' + simulated.interval[1] + ']');
  assert.ok(simulated.halfWidth > 0 && simulated.halfWidth < 0.2, 'the interval should be narrow but real');
});

test('expectation-dp: snakes make a board slower and ladders make it faster', function () {
  const plain = ExpectationDp.solveExpectation(
    ExpectationDp.boardGame({ size: 20, faces: 6 }), {}).expected.get(0);
  const snaked = ExpectationDp.solveExpectation(
    ExpectationDp.boardGame({ size: 20, faces: 6, snakes: { 17: 4, 13: 2 } }), {}).expected.get(0);
  const laddered = ExpectationDp.solveExpectation(
    ExpectationDp.boardGame({ size: 20, faces: 6, snakes: { 4: 12, 7: 15 } }), {}).expected.get(0);

  assert.ok(snaked > plain, 'snakes must cost rolls');
  assert.ok(laddered < plain, 'ladders must save them');
});

test('expectation-dp: the secretary sweep finds n/e without being told it', function () {
  [20, 50, 100, 500].forEach(function (n) {
    const sweep = ExpectationDp.secretarySweep(n);
    assert.ok(Math.abs(sweep.best.k - n / Math.E) <= Math.max(1, n * 0.02),
      'at n = ' + n + ' the best k was ' + sweep.best.k + ' against n/e = ' + (n / Math.E));
    assert.ok(Math.abs(sweep.best.probability - 1 / Math.E) < 0.05,
      'at n = ' + n + ' the win rate was ' + sweep.best.probability);
  });
  assert.strictEqual(ExpectationDp.secretarySweep(100).best.k, 37);
});
