'use strict';

/**
 * Every figure the M12.9-M12.11 worked examples quote, recomputed.
 *
 * Three of these tests assert something the section needs to be true and
 * would rather not be, so they are asserted rather than left implied:
 *
 *   - the hull must REFUSE on the negative instance, and forcing it must not
 *     quietly succeed;
 *   - reversing the tic-tac-toe move list must prune IDENTICALLY, because the
 *     example's whole point is that "try it backwards" measures nothing;
 *   - the plain 20-square board must be CYCLIC before any snake is added,
 *     because the example claims the overshoot rule alone does it.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;

const DpOptimizations = require('../../src/js/algorithms/dp-optimizations.js');
const GameTheory = require('../../src/js/algorithms/game-theory.js');
const ExpectationDp = require('../../src/js/algorithms/expectation-dp.js');
const Random = require('../../src/js/utils/random.js');
require('../../src/js/content/examples-dp-advanced.js');
require('../../src/js/content/concepts-dp-advanced.js');

/* -------------------------------------------------- 12.9 dp-optimisations */

function groupingValues(seed, count, ceiling, offset) {
  const random = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) out.push(offset + random.int(ceiling));
  return out;
}

const positive = groupingValues(7, 400, 20, 1);

test('dp-optimisations: the hull is 783 transitions against 80 200 for the same 80 131', function () {
  const instance = DpOptimizations.groupingInstance(positive, 50);
  const naive = DpOptimizations.groupingNaive(instance, {});
  const hull = DpOptimizations.groupingHull(instance, {});

  assert.strictEqual(naive.report.transitions, 80200);
  assert.strictEqual(naive.report.transitions, 400 * 401 / 2);
  assert.strictEqual(naive.value, 80131);
  assert.strictEqual(naive.groups.length, 362);

  assert.strictEqual(hull.refused, false);
  assert.strictEqual(hull.value, 80131);
  assert.strictEqual(hull.report.transitions, 783);
  assert.strictEqual(hull.report.hullSize, 385);
  assert.strictEqual(Math.round(naive.report.transitions / hull.report.transitions), 102);

  quotes('dp-optimisations', ['80 200', '80 131', '783', '385', '102', '362']);
});

/* The negative case the section is built around. */
test('dp-optimisations: the hull refuses on falling prefix sums, and forcing it throws', function () {
  const values = groupingValues(107, 60, 21, -10);
  const instance = DpOptimizations.groupingInstance(values, 50);
  const check = DpOptimizations.checkHullMonotone(instance);

  assert.strictEqual(check.holds, false);
  assert.strictEqual(check.witness.at, 2);
  assert.strictEqual(DpOptimizations.groupingNaive(instance, {}).value, 213);
  assert.strictEqual(DpOptimizations.groupingHull(instance, {}).refused, true);
  assert.strictEqual(DpOptimizations.groupingHull(instance, {}).value, null);

  assert.throws(function () {
    DpOptimizations.groupingHull(instance, { force: true });
  }, /queries must not decrease/,
  'on this instance the hull detects the violation itself — the example says so');

  quotes('dp-optimisations', ['2', '213']);
});

test('dp-optimisations: three routes to exactly four groups agree at 453 673', function () {
  const values = positive.slice(0, 120);
  const instance = DpOptimizations.groupingInstance(values, 0);
  const exact = DpOptimizations.groupingExactly(values, 4, {});
  const divide = DpOptimizations.groupingDivideConquer(instance, 4, {});
  const aliens = DpOptimizations.aliensTrick(values, 4, {});

  assert.strictEqual(exact.value, 453673);
  assert.strictEqual(exact.report.transitions, 29040);
  assert.strictEqual(divide.refused, false);
  assert.strictEqual(divide.value, 453673);
  assert.strictEqual(divide.report.transitions, 3262);
  assert.strictEqual(aliens.exact, true);
  assert.strictEqual(aliens.value, 453673);
  assert.strictEqual(Math.round(aliens.penalty), 90646);

  quotes('dp-optimisations', ['453 673', '29 040', '3 262', '90 646']);
});

test('dp-optimisations: the sliding deque is 400 transitions against 18 775', function () {
  const width = Math.max(2, Math.floor(400 / 8));
  const deque = DpOptimizations.slidingWindowDp(positive, width, {});
  const naive = DpOptimizations.slidingWindowNaive(positive, width, {});

  assert.strictEqual(width, 50);
  assert.strictEqual(deque.report.transitions, 400);
  assert.strictEqual(naive.report.transitions, 18775);
  assert.strictEqual(deque.value, naive.value);
  assert.strictEqual(deque.value, 30);

  quotes('dp-optimisations', ['400', '18 775', '50', '30']);
});

/* -------------------------------------------------- 12.10 game-dp */

const ticTacToe = GameTheory.ticTacToe();
const minimax = GameTheory.minimax(ticTacToe, ticTacToe.empty, {});

function alphaBeta(order) {
  return GameTheory.alphaBeta(ticTacToe, ticTacToe.empty, order ? { orderMoves: order } : {});
}

test('game-dp: minimax is 549 946 nodes and alpha-beta is 7 275 under a good ordering', function () {
  assert.strictEqual(minimax.report.nodes, 549946);
  assert.strictEqual(minimax.report.leaves, 255168);
  assert.strictEqual(minimax.value, 0);

  const plain = alphaBeta(null);
  const centre = alphaBeta(GameTheory.centreFirst);
  const edges = alphaBeta(GameTheory.edgesFirst);

  assert.strictEqual(plain.report.nodes, 18297);
  assert.strictEqual(plain.report.pruned, 6930);
  assert.strictEqual(centre.report.nodes, 7275);
  assert.strictEqual(centre.report.pruned, 3668);
  assert.strictEqual(edges.report.nodes, 42094);
  assert.strictEqual(edges.report.pruned, 13146);

  [plain, centre, edges].forEach(function (run, which) {
    assert.strictEqual(run.value, minimax.value, 'ordering ' + which + ' returned a different value');
  });
  assert.strictEqual(fixed(minimax.report.nodes / centre.report.nodes, 1), '75.6');
  assert.strictEqual(fixed(edges.report.nodes / centre.report.nodes, 1), '5.8');

  quotes('game-dp', ['549 946', '255 168', '18 297', '6 930', '7 275', '3 668', '42 094',
    '13 146', '5.8']);
});

/* The claim the example makes: this measures nothing. */
test('game-dp: reversing the move list prunes identically', function () {
  const forward = alphaBeta(null);
  const reversed = alphaBeta(GameTheory.reverseOrder);

  assert.strictEqual(reversed.report.nodes, forward.report.nodes);
  assert.strictEqual(reversed.report.pruned, forward.report.pruned);
  assert.strictEqual(reversed.report.nodes, 18297);
});

test('game-dp: the Grundy sequences, and the periods found rather than assumed', function () {
  const nim = GameTheory.grundyTable(40, GameTheory.nimMoves(), {});
  const sub134 = GameTheory.grundyTable(40, GameTheory.subtractionMoves([1, 3, 4]), {});
  const sub12 = GameTheory.grundyTable(40, GameTheory.subtractionMoves([1, 2]), {});

  assert.deepStrictEqual(nim.grundy.slice(0, 5), [0, 1, 2, 3, 4]);
  assert.strictEqual(GameTheory.grundyPeriod(nim.grundy, {}), null,
    'Nim has no period — its Grundy value is the heap size');
  assert.deepStrictEqual(sub134.grundy.slice(0, 7), [0, 1, 0, 1, 2, 3, 2]);
  assert.strictEqual(GameTheory.grundyPeriod(sub134.grundy, {}).period, 7);
  assert.strictEqual(GameTheory.grundyPeriod(sub12.grundy, {}).period, 3);

  quotes('game-dp', ['0, 1, 0, 1, 2, 3, 2', '7', '3']);
});

test('game-dp: the XOR agrees with the joint state space on three heaps of seven', function () {
  const nimMoves = GameTheory.nimMoves();
  const subMoves = GameTheory.subtractionMoves([1, 3, 4]);
  const nim = GameTheory.grundyTable(7, nimMoves, {});
  const sub = GameTheory.grundyTable(7, subMoves, {});

  assert.strictEqual(GameTheory.grundyOfSum([7, 7, 7], nim.grundy), 7);
  assert.strictEqual(GameTheory.grundyOfSum([7, 7, 7], sub.grundy), 0);

  const nimJoint = GameTheory.jointGameWinner([7, 7, 7], nimMoves, {});
  const subJoint = GameTheory.jointGameWinner([7, 7, 7], subMoves, {});

  assert.strictEqual(nimJoint.firstPlayerWins, true);
  assert.strictEqual(subJoint.firstPlayerWins, false);
  assert.strictEqual(nimJoint.report.states, 65);
  assert.strictEqual(subJoint.report.states, 393);
  assert.strictEqual(GameTheory.grundyTable(40, subMoves, {}).report.states, 41);

  quotes('game-dp', ['65', '393', '41', '7']);
});

/* -------------------------------------------------- 12.11 expectation-dp */

function board(kind) {
  const snakes = kind === 'snakes' ? { 17: 4, 13: 2 }
    : (kind === 'ladders' ? { 4: 12, 7: 15 } : {});
  return ExpectationDp.boardGame({ size: 20, faces: 6, snakes: snakes });
}

test('expectation-dp: the plain board is already cyclic, and solves to 10.476469', function () {
  const chain = board('none');

  assert.strictEqual(ExpectationDp.topologicalOrder(chain), null,
    'the overshoot rule alone must make it cyclic — the example claims exactly this');
  assert.strictEqual(ExpectationDp.checkStochastic(chain, {}).valid, true);

  const run = ExpectationDp.solveExpectation(chain, {});
  assert.strictEqual(run.acyclic, false);
  assert.strictEqual(run.method, 'elimination');
  assert.strictEqual(run.report.pivots, 20);
  assert.strictEqual(fixed(run.expected.get(0), 6), '10.476469');

  /* Squares 15 to 19 are the ones that name themselves. */
  [15, 16, 17, 18, 19].forEach(function (square) {
    const selfLoop = chain.transitions(square).filter(function (edge) { return edge.to === square; });
    assert.ok(selfLoop.length > 0, 'square ' + square + ' should have a self-loop');
  });

  quotes('expectation-dp', ['10.476469', '20']);
});

test('expectation-dp: two snakes raise it to 13.850548 and two ladders lower it', function () {
  const snaked = ExpectationDp.solveExpectation(board('snakes'), {}).expected.get(0);
  const plain = ExpectationDp.solveExpectation(board('none'), {}).expected.get(0);
  const laddered = ExpectationDp.solveExpectation(board('ladders'), {}).expected.get(0);

  assert.strictEqual(fixed(snaked, 6), '13.850548');
  assert.ok(snaked > plain, 'snakes must cost rolls');
  assert.ok(laddered < plain, 'ladders must save them');

  quotes('expectation-dp', ['13.850548']);
});

test('expectation-dp: the acyclic control agrees to nine decimal places', function () {
  const n = 20;
  const chain = {
    states: Array.from({ length: n + 1 }, function (ignored, i) { return i; }),
    absorbing: function (state) { return state === n; },
    transitions: function (state) {
      return [{ to: Math.min(n, state + 1), probability: 0.5 },
        { to: Math.min(n, state + 2), probability: 0.5 }];
    }
  };

  assert.notStrictEqual(ExpectationDp.topologicalOrder(chain), null);
  const recursion = ExpectationDp.byRecursion(chain, {});
  const elimination = ExpectationDp.byElimination(chain, {});

  assert.strictEqual(fixed(recursion.expected.get(0), 9), '13.555555344');
  assert.strictEqual(fixed(elimination.expected.get(0), 9), '13.555555344');

  quotes('expectation-dp', ['13.555555344']);
});

test('expectation-dp: the exact answer lies inside the simulated 95% interval', function () {
  const chain = board('snakes');
  const exact = ExpectationDp.solveExpectation(chain, {}).expected.get(0);
  const simulated = ExpectationDp.monteCarlo(chain, 0, Random.seeded(11), { trials: 40000 });

  assert.strictEqual(fixed(simulated.mean, 6), '13.862425');
  assert.strictEqual(fixed(simulated.halfWidth, 6), '0.078203');
  assert.strictEqual(fixed(simulated.interval[0], 4), '13.7842');
  assert.strictEqual(fixed(simulated.interval[1], 4), '13.9406');
  assert.ok(exact >= simulated.interval[0] && exact <= simulated.interval[1]);
  assert.strictEqual(fixed(100 * 2 * simulated.halfWidth / exact, 1), '1.1',
    'the interval is about 1.1% wide, which is why "agrees" needs a confidence');

  quotes('expectation-dp', ['13.862425', '0.078203', '13.7842', '13.9406', '1.1']);
});

test('expectation-dp: the secretary sweep finds k = 37 and 0.371043', function () {
  const sweep = ExpectationDp.secretarySweep(100);

  assert.strictEqual(sweep.best.k, 37);
  assert.strictEqual(fixed(sweep.best.probability, 6), '0.371043');
  assert.strictEqual(fixed(sweep.overE, 3), '36.788');
  assert.strictEqual(fixed(sweep.limit, 6), '0.367879');
  assert.strictEqual(fixed(sweep.rows[0].probability, 6), '0.010000');
  assert.strictEqual(fixed(sweep.rows[99].probability, 6), '0.010000');

  quotes('expectation-dp', ['37', '0.371043', '36.788', '0.367879']);
});
