'use strict';

/**
 * Every figure the M32.5-M32.6 content quotes, recomputed from the solvers and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their shipped control settings, so a default that moves fails
 * here rather than in a reader's browser.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sat = require('../../src/js/machines/solver/sat.js');
const Check = require('../../src/js/machines/solver/check.js');
const Smt = require('../../src/js/machines/solver/smt.js');
const Basics = require('../../src/js/algorithms/sat-basics.js');
const Generators = require('../../src/js/algorithms/instance-generators.js');
const Graph = require('../../src/js/viz/implication-graph.js');

require('../../src/js/content/concepts-program-solvers.js');
require('../../src/js/content/examples-program-solvers.js');
const prose = require('../support/worked-example-prose.js');

test('sat: the four-family comparison the prose quotes', function () {
  const threshold = Generators.randomKSat({ variables: 70, clauses: 298, k: 3, seed: 7 });
  const pigeons = Generators.pigeonhole(5).formula;
  const planted = Generators.plantedKSat({ variables: 80, seed: 11 }).formula;
  const horn = Generators.hornInstance({ variables: 40, seed: 3 }).formula;

  const rows = [
    { name: 'random', cdcl: Sat.solve(threshold, {}), dpll: Basics.dpll(threshold, {}) },
    { name: 'pigeonhole', cdcl: Sat.solve(pigeons, {}), dpll: Basics.dpll(pigeons, {}) },
    { name: 'planted', cdcl: Sat.solve(planted, {}), dpll: Basics.dpll(planted, {}) },
    { name: 'horn', cdcl: Sat.solve(horn, {}), dpll: Basics.dpll(horn, {}) }
  ];
  const by = {};

  rows.forEach(function (row) { by[row.name] = row; });
  assert.strictEqual(by.random.cdcl.decisions, 125, 'CDCL decisions at the threshold');
  assert.strictEqual(by.random.dpll.stats.nodes, 5831, 'DPLL nodes on the same instance');
  assert.strictEqual(by.pigeonhole.cdcl.decisions, 183, 'pigeonhole decisions');
  assert.strictEqual(by.pigeonhole.dpll.stats.nodes, 239, 'pigeonhole nodes');
  assert.strictEqual(by.pigeonhole.cdcl.clauseVisits, 8636, 'and the clause visits it cost');
  assert.strictEqual(by.pigeonhole.cdcl.propagations, 1742, 'against its propagations');
  assert.strictEqual(by.planted.cdcl.decisions, 159, 'planted decisions');
  assert.strictEqual(by.planted.dpll.stats.nodes, 43, 'planted nodes — DPLL wins here');
  assert.strictEqual(by.horn.cdcl.decisions, 0, 'Horn needs no decision at all');
  assert.strictEqual(by.horn.dpll.stats.nodes, 1, 'and one node');

  assert.strictEqual(Math.round(by.random.dpll.stats.nodes / by.random.cdcl.decisions), 47,
    'the headline ratio');
  assert.strictEqual((by.planted.cdcl.decisions / by.planted.dpll.stats.nodes).toFixed(1), '3.7',
    'and the one that goes the other way');

  prose.quotes('sat-solving',
    ['125 decisions against 5 831 nodes', '183 decisions against 239 nodes',
      '159 decisions against 43 nodes', '0 decisions and 1 node',
      '8 636 clause visits for 1 742 propagations', 'factor of 47', 'factor of 3.7']);
});

test('sat: the pigeonhole conflict counts', function () {
  const counts = [3, 4, 5, 6].map(function (holes) {
    return Sat.solve(Generators.pigeonhole(holes).formula, {}).conflicts;
  });

  assert.deepStrictEqual(counts, [7, 28, 145, 849], 'conflicts at 3, 4, 5 and 6 holes');
  prose.quotes('sat-solving', ['7 at four holes, 28 at five, 145 at six, 849 at seven']);
});

test('sat: one conflict on pigeonhole with three holes', function () {
  const formula = Generators.pigeonhole(3).formula;
  const snapshot = Sat.firstConflict(formula, { at: 1 });
  const answer = Sat.solve(formula, {});
  const proof = Check.checkProof(formula, answer.proof);

  assert.strictEqual(formula.variables, 12, '12 variables');
  assert.strictEqual(formula.clauses.length, 22, 'and 22 clauses');
  assert.strictEqual(snapshot.level, 3, 'the first conflict is at level 3');
  assert.strictEqual(Graph.showClause(snapshot.conflict), '(not x10 or not x7)',
    'the conflicting clause');
  assert.strictEqual(Graph.showClause(snapshot.learned), '(not x5 or x12 or x9)',
    'the clause the cut produces');
  assert.strictEqual(snapshot.backjump, 2, 'and the level it jumps back to');
  assert.strictEqual(Graph.cone(snapshot).length, 12, 'the cone is 12 assignments');
  assert.strictEqual(Graph.cone(snapshot).filter(function (row) {
    return row.decision;
  }).length, 3, 'three of which are decisions');
  assert.strictEqual(answer.conflicts, 7, 'the whole run takes 7 conflicts');
  assert.strictEqual(proof.checked, 7, 'and emits 7 proof steps');
  assert.strictEqual(proof.ok && proof.empty, true, 'which replay to the empty clause');

  prose.quotes('sat-solving',
    ['level 3', '(not x10 or not x7)', '(not x5 or x12 or x9)', 'level 2',
      '12 assignments, of which 3 are decisions', '7 conflicts', '7 steps']);
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

function averageExplanation(answer) {
  const rows = answer.trace.filter(function (row) {
    return row.stage === 'theory' && !row.ok;
  });

  return rows.reduce(function (sum, row) { return sum + row.explanation; }, 0) / rows.length;
}

test('smt: the padded problem, both explanation strategies', function () {
  const minimal = [];
  const full = [];

  [0, 1, 2, 3, 4].forEach(function (k) {
    const problem = padded(k);

    minimal.push(Smt.solve(problem, { rounds: 400 }).rounds);
    full.push(Smt.solve(problem, { explanations: 'full', rounds: 400 }).rounds);
  });

  assert.deepStrictEqual(minimal, [2, 2, 2, 2, 2], 'a minimised core is flat in k');
  assert.deepStrictEqual(full, [2, 4, 10, 28, 82], 'the whole assignment is 3 to the k, plus 1');
  assert.strictEqual(Math.pow(3, 4) + 1, 82, 'which is exactly the model count, plus the last round');

  const big = padded(4);

  assert.strictEqual(averageExplanation(Smt.solve(big, { rounds: 400 })).toFixed(1), '2.0',
    'the core blames two literals');
  assert.strictEqual(averageExplanation(Smt.solve(big,
    { explanations: 'full', rounds: 400 })).toFixed(1), '10.0', 'the assignment blames ten');
  assert.strictEqual(Smt.bruteForce(big, 12).tried, 1024, '1 024 assignments enumerated');

  prose.quotes('smt-solving',
    ['2 rounds at every one of them', '2, 4, 10, 28 and 82 rounds',
      '2.0 literals with a core, 10.0 with the whole assignment', '1 024 assignments',
      '81 at k = 4']);
});

test('smt: two routes to one contradiction', function () {
  const problem = { theory: 'euf',
    atoms: [euf('a', 'b'), euf('b', 'c'), euf('a', 'c'), euf('f(a)', 'f(c)')],
    clauses: [[1, 3], [2, 3], [-4]] };
  const answer = Smt.solve(problem, {});
  const refutations = answer.trace.filter(function (row) {
    return row.stage === 'theory' && !row.ok;
  });
  const proof = Check.checkProof({ variables: problem.atoms.length, clauses: answer.clauses },
    answer.proof);

  assert.strictEqual(answer.verdict, 'unsat', 'the answer');
  assert.strictEqual(answer.rounds, 3, 'in three rounds');
  assert.deepStrictEqual(refutations.map(function (row) { return row.explanation; }), [2, 3],
    'explanations of 2 and 3 literals');
  assert.strictEqual(Smt.bruteForce(problem).tried, 16, '16 assignments for the oracle');
  assert.strictEqual(Smt.bruteForce(problem).verdict, 'unsat', 'which agrees');
  assert.strictEqual(proof.checked, 1, 'and one proof step to the empty clause');

  prose.quotes('smt-solving',
    ['explanation of 2 literals', 'explanation of 3 literals', '16 assignments tried',
      '1 proof step']);
});
