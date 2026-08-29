'use strict';

/**
 * Property tests for the M32.5-M32.6 solvers.
 *
 * A solver is the one kind of module where "it returned an answer" proves
 * nothing at all: a wrong UNSAT looks exactly like a right one. So every
 * assertion here is against something that does not share the search — brute
 * force over every assignment, a model checker that walks the clauses, and a
 * DRAT checker that replays the proof by unit propagation alone.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sat = require('../../src/js/machines/solver/sat.js');
const Check = require('../../src/js/machines/solver/check.js');
const Smt = require('../../src/js/machines/solver/smt.js');
const Basics = require('../../src/js/algorithms/sat-basics.js');
const Generators = require('../../src/js/algorithms/instance-generators.js');
const Graph = require('../../src/js/viz/implication-graph.js');
const Random = require('../../src/js/utils/random.js');

function randomFormula(seed, variables, clauses) {
  const rng = Random.seeded(seed);
  const next = function (bound) { return rng.int(bound); };
  const rows = [];

  for (let at = 0; at < clauses; at += 1) {
    const clause = [];

    while (clause.length < 3) {
      const variable = 1 + next(variables);

      if (clause.some(function (literal) { return Math.abs(literal) === variable; })) continue;
      clause.push(next(2) ? variable : -variable);
    }
    rows.push(clause);
  }
  return { variables: variables, clauses: rows };
}

/* ---------------------------------------------------------------- CDCL */

test('sat: 300 random formulas, every verdict agreed with brute force', function () {
  let sat = 0;
  let unsat = 0;

  for (let seed = 1; seed <= 300; seed += 1) {
    const formula = randomFormula(seed, 8, 40);
    const answer = Sat.solve(formula, {});
    const truth = Check.bruteForce(formula);

    assert.strictEqual(answer.verdict, truth.verdict, 'seed ' + seed + ' disagreed');
    if (answer.verdict === 'sat') sat += 1; else unsat += 1;
  }
  assert.ok(sat > 20 && unsat > 20,
    'the corpus must contain both answers, found ' + sat + ' sat and ' + unsat + ' unsat');
});

test('sat: every model satisfies the formula and every proof replays', function () {
  let models = 0;
  let proofs = 0;

  for (let seed = 1; seed <= 120; seed += 1) {
    const formula = randomFormula(seed, 10, 50);
    const answer = Sat.solve(formula, {});

    if (answer.verdict === 'sat') {
      const out = Check.checkModel(formula, answer.model);

      assert.strictEqual(out.ok, true, 'seed ' + seed + ': ' + out.why);
      models += 1;
      continue;
    }
    const proof = Check.checkProof(formula, answer.proof);

    assert.strictEqual(proof.ok, true, 'seed ' + seed + ': ' + proof.why);
    assert.strictEqual(proof.empty, true, 'the proof must reach the empty clause');
    proofs += 1;
  }
  assert.ok(models > 10 && proofs > 10,
    'both kinds of evidence must be exercised: ' + models + ' models, ' + proofs + ' proofs');
});

test('sat: the pigeonhole family costs what it is famous for costing', function () {
  const seen = [3, 4, 5, 6].map(function (holes) {
    const answer = Sat.solve(Generators.pigeonhole(holes).formula, {});

    assert.strictEqual(answer.verdict, 'unsat', 'pigeonhole is unsatisfiable by construction');
    return answer.conflicts;
  });

  assert.deepStrictEqual(seen, [7, 28, 145, 849], 'conflicts at 3, 4, 5 and 6 holes');
});

/* The learned clause is only useful if it has the two properties the cut is
   chosen for. Asserting them is the difference between testing that conflict
   analysis runs and testing that it is right. */
test('sat: a learned clause is falsified now and has one literal at the conflict level',
  function () {
    let checked = 0;

    [3, 4, 5].forEach(function (holes) {
      [1, 2, 3].forEach(function (at) {
        const snapshot = Sat.firstConflict(Generators.pigeonhole(holes).formula, { at: at });

        if (!snapshot.found) return;
        const value = {};

        snapshot.trail.forEach(function (row) {
          value[Math.abs(row.literal)] = row.literal > 0;
        });
        const levels = snapshot.learned.map(function (literal) {
          assert.strictEqual(value[Math.abs(literal)], literal < 0,
            'every literal of the learned clause must be false under the current assignment');
          return snapshot.trail.filter(function (row) {
            return Math.abs(row.literal) === Math.abs(literal);
          })[0].level;
        });

        assert.strictEqual(levels.filter(function (level) {
          return level === snapshot.level;
        }).length, 1, 'exactly one literal at the conflict level — this is what 1UIP means');
        assert.ok(snapshot.backjump < snapshot.level, 'and the backjump goes strictly back');
        checked += 1;
      });
    });
    assert.ok(checked >= 6, 'expected several conflicts to inspect, checked ' + checked);
  });

test('sat: the implication graph is drawn from the conflict cone, not the whole trail',
  function () {
    const snapshot = Sat.firstConflict(Generators.pigeonhole(5).formula, { at: 1 });
    const rows = Graph.cone(snapshot);

    assert.ok(snapshot.found, 'there is a conflict to draw');
    assert.ok(rows.length < snapshot.trail.length,
      'the cone must be smaller than the trail, or it is not a cone');
    rows.forEach(function (row) {
      assert.ok(snapshot.trail.indexOf(row) !== -1, 'every node is a real trail entry');
    });
  });

test('sat: clause learning wins at the threshold and loses on a planted instance', function () {
  const threshold = Generators.randomKSat({ variables: 70, clauses: 298, k: 3, seed: 7 });
  const planted = Generators.plantedKSat({ variables: 80, seed: 11 }).formula;

  const hard = { cdcl: Sat.solve(threshold, {}), dpll: Basics.dpll(threshold, {}) };
  const easy = { cdcl: Sat.solve(planted, {}), dpll: Basics.dpll(planted, {}) };

  assert.strictEqual(hard.cdcl.verdict, 'unsat', 'this instance is unsatisfiable');
  assert.ok(hard.dpll.stats.nodes / hard.cdcl.decisions > 20,
    'learning should win by more than an order of magnitude at the threshold, found ' +
    (hard.dpll.stats.nodes / hard.cdcl.decisions).toFixed(1));
  assert.strictEqual(easy.cdcl.verdict, 'sat', 'the planted instance has a solution');
  assert.ok(easy.dpll.stats.nodes < easy.cdcl.decisions,
    'and on a planted instance the simpler search should win, which is the honest part');
});

/* ----------------------------------------------------------------- SMT */

function euf(left, right, equal) {
  return { left: left, right: right, equal: equal !== false };
}

function padded(k) {
  const atoms = [euf('a', 'b'), euf('f(a)', 'f(b)')];
  const clauses = [[1], [-2]];

  for (let at = 1; at <= k; at += 1) {
    atoms.push(euf('u' + at, 'v' + at));
    atoms.push(euf('u' + at, 'w' + at));
    clauses.push([atoms.length - 1, atoms.length]);
  }
  return { theory: 'euf', atoms: atoms, clauses: clauses };
}

const PROBLEMS = {
  congruence: { theory: 'euf', atoms: [euf('a', 'b'), euf('f(a)', 'f(b)')],
    clauses: [[1], [-2]] },
  transitive: { theory: 'euf', atoms: [euf('a', 'b'), euf('b', 'c'), euf('f(a)', 'f(c)')],
    clauses: [[1], [2], [-3]] },
  choice: { theory: 'euf',
    atoms: [euf('a', 'b'), euf('b', 'c'), euf('a', 'c'), euf('f(a)', 'f(c)')],
    clauses: [[1, 3], [2, 3], [-4]] },
  cycle: { theory: 'difference',
    atoms: [{ left: 'x', right: 'y', bound: 3, equal: true },
      { left: 'y', right: 'z', bound: -2, equal: true },
      { left: 'z', right: 'x', bound: -2, equal: true }],
    clauses: [[1], [2], [3]] },
  feasible: { theory: 'difference',
    atoms: [{ left: 'x', right: 'y', bound: 3, equal: true },
      { left: 'y', right: 'z', bound: -2, equal: true },
      { left: 'z', right: 'x', bound: 4, equal: true }],
    clauses: [[1], [2], [3]] }
};

test('smt: every fixture agrees with brute force over all assignments', function () {
  Object.keys(PROBLEMS).forEach(function (name) {
    const answer = Smt.solve(PROBLEMS[name], {});
    const truth = Smt.bruteForce(PROBLEMS[name]);

    assert.strictEqual(answer.verdict, truth.verdict, name + ' disagreed with brute force');
    assert.notStrictEqual(truth.verdict, 'skipped', name + ' was too large to check');
  });
});

test('smt: a satisfiable answer is re-checked in both halves', function () {
  const answer = Smt.solve(PROBLEMS.feasible, {});
  const out = Smt.checkAnswer(PROBLEMS.feasible, answer);

  assert.strictEqual(answer.verdict, 'sat', 'the feasible system is satisfiable');
  assert.strictEqual(out.ok, true, out.why);
  assert.ok(out.checked > 0, 'and something was actually checked');
});

test('smt: explanation quality is the difference between two rounds and eighty-two',
  function () {
    const minimal = [];
    const full = [];

    [0, 1, 2, 3, 4].forEach(function (k) {
      const problem = padded(k);

      minimal.push(Smt.solve(problem, { rounds: 400 }).rounds);
      full.push(Smt.solve(problem, { explanations: 'full', rounds: 400 }).rounds);
    });

    assert.deepStrictEqual(minimal, [2, 2, 2, 2, 2],
      'a core names the two atoms that clash, whatever else is in the problem');
    assert.deepStrictEqual(full, [2, 4, 10, 28, 82],
      'the whole assignment blocks one model per round: 3 to the k, plus one');
  });

test('smt: the loop reports refutations rather than hiding them', function () {
  const answer = Smt.solve(PROBLEMS.choice, {});
  const refutations = answer.trace.filter(function (row) {
    return row.stage === 'theory' && !row.ok;
  });

  assert.strictEqual(answer.verdict, 'unsat', 'both routes lead to the same contradiction');
  assert.strictEqual(refutations.length, 2, 'the theory refuted two models');
  assert.deepStrictEqual(refutations.map(function (row) { return row.explanation; }), [2, 3],
    'and explained itself in 2 and 3 literals');
});

test('smt: the theory really is doing the work, not the boolean structure', function () {
  const answer = Smt.solve(PROBLEMS.congruence, {});
  const boolean = Sat.solve({ variables: PROBLEMS.congruence.atoms.length,
    clauses: PROBLEMS.congruence.clauses }, {});

  assert.strictEqual(boolean.verdict, 'sat',
    'the skeleton alone is satisfiable — the contradiction is entirely in the theory');
  assert.strictEqual(answer.verdict, 'unsat', 'and the theory finds it');
});
