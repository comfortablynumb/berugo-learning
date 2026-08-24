'use strict';

/**
 * Every figure the M20.1-M20.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sat = require('../../src/js/algorithms/sat-basics.js');
const NpLab = require('../../src/js/machines/np-lab.js');

require('../../src/js/content/concepts-np.js');
require('../../src/js/content/examples-np.js');
const prose = require('../support/worked-example-prose.js');

function rowFor(study, id) {
  return study.rows.filter(function (row) { return row.id === id; })[0];
}

/* ------------------------------------------------------ 20.1 certificates */

test('decision-problems: the four rows at the demo default', function () {
  const study = NpLab.certificateStudy({ size: 12, seed: 3 });
  const hamiltonian = rowFor(study, 'hamiltonian');
  const subset = rowFor(study, 'subset-sum');
  const colouring = rowFor(study, 'colouring');
  const clique = rowFor(study, 'clique');

  assert.strictEqual(hamiltonian.verifySteps, 24);
  assert.strictEqual(hamiltonian.searchYesSteps, 82);
  assert.strictEqual(hamiltonian.searchNoSteps, 4794);
  assert.strictEqual(prose.fixed(hamiltonian.ratioNo, 1), '199.8');

  assert.strictEqual(subset.verifySteps, 5);
  assert.strictEqual(subset.searchYesSteps, 3138);
  assert.strictEqual(subset.searchNoSteps, 4096);
  assert.strictEqual(prose.fixed(subset.ratioNo, 1), '819.2');

  assert.strictEqual(colouring.verifySteps, 20);
  assert.strictEqual(colouring.searchYesSteps, 13);
  assert.strictEqual(colouring.searchNoSteps, 2213);
  assert.strictEqual(prose.fixed(colouring.ratioNo, 1), '110.7');

  assert.strictEqual(clique.verifySteps, 16);
  assert.strictEqual(clique.searchNoSteps, 306);
  assert.strictEqual(prose.fixed(clique.ratioNo, 1), '19.1');

  prose.quotes('decision-problems', ['24', '82', '4 794', '199.8', '819.2', '110.7', '19.1',
    '3 138', '13', '20', '306', '16']);
});

test('decision-problems: every bad certificate is rejected', function () {
  const study = NpLab.certificateStudy({ size: 12, seed: 3 });
  const rejected = study.rows.filter(function (row) {
    return row.wrongRejected && row.malformedRejected && row.verifyAccepted;
  });

  assert.strictEqual(rejected.length, 4, 'all four verifiers must be total');
  prose.quotes('decision-problems', '8 of 8');
});

test('decision-problems: the cost sweep is 2n against a factor of 1.96', function () {
  const sweep = NpLab.costSweep({ from: 8, to: 15 });

  sweep.rows.forEach(function (row) {
    assert.strictEqual(row.verify, 2 * row.n, 'verification at n = ' + row.n);
  });
  assert.strictEqual(sweep.rows[0].searchNo, 369);
  assert.strictEqual(sweep.rows[sweep.rows.length - 1].searchNo, 28378);
  assert.strictEqual(prose.fixed(sweep.growth, 2), '1.96');

  prose.quotes('decision-problems', ['369', '28 378', '1.96', '2n', '16', '30']);
});

/* --------------------------------------------------------- 20.2 reductions */

test('reductions: the demo default builds 27 vertices and 54 edges from 9 clauses', function () {
  const study = NpLab.reductionStudy({ name: 'sat-to-independent-set', seed: 2 });

  assert.strictEqual(study.source.instance.variables, 5);
  assert.strictEqual(study.source.instance.clauses.length, 9);
  assert.strictEqual(study.targetSize.vertices, 27);
  assert.strictEqual(study.targetSize.edges, 54);
  assert.strictEqual(study.targetSize.target, 9);
  assert.strictEqual(study.result.steps, 10);
  assert.strictEqual(study.answer, 'YES');
  assert.strictEqual(study.valid, true);

  prose.quotes('reductions', ['27', '54', '9', '10', '5 variables']);
});

test('reductions: the mapped assignment satisfies the source formula', function () {
  const study = NpLab.reductionStudy({ name: 'sat-to-independent-set', seed: 2 });
  const formula = study.source.instance;

  assert.strictEqual(Sat.countSatisfied(formula, Sat.fromBooleans(study.result.mapped)),
    formula.clauses.length);
});

test('reductions: the audit round-trips all five, both answers', function () {
  const audit = NpLab.reductionAudit({ seed: 2 });
  const steps = {};

  audit.rows.forEach(function (row) { steps[row.name + '/' + row.answer] = row.steps; });
  assert.strictEqual(audit.allAgree, true);
  assert.strictEqual(audit.rows.length, 10);
  assert.strictEqual(steps['sat-to-independent-set/YES'], 10);
  assert.strictEqual(steps['sat-to-independent-set/NO'], 4662);
  assert.strictEqual(steps['sat-to-clique/NO'], 5279);
  assert.strictEqual(steps['sat-to-colouring/YES'], 221);
  assert.strictEqual(steps['sat-to-colouring/NO'], 127382);
  assert.strictEqual(steps['vertex-cover-to-set-cover/YES'], 8);
  assert.strictEqual(steps['subset-sum-to-partition/YES'], 1712);

  prose.quotes('reductions', ['4 662', '5 279', '221', '127 382', '1 712']);
});

test('reductions: the three SAT targets have the shapes the prose quotes', function () {
  const rows = NpLab.reductionAudit({ seed: 2 }).rows;
  const noRow = function (name) {
    return rows.filter(function (row) {
      return row.name === name && row.answer === 'NO';
    })[0];
  };

  assert.strictEqual(noRow('sat-to-independent-set').size.vertices, 24);
  assert.strictEqual(noRow('sat-to-independent-set').size.edges, 72);
  assert.strictEqual(noRow('sat-to-clique').size.edges, 204);
  assert.strictEqual(noRow('sat-to-colouring').size.vertices, 57);
  assert.strictEqual(noRow('sat-to-colouring').size.edges, 108);

  prose.quotes('reductions', ['24 vertices', '72 edges', '204', '57', '108']);
});

/* ------------------------------------------------------------ 20.3 the zoo */

test('sat-zoo: six families of 42 variables, and the node column', function () {
  const study = NpLab.islandStudy({ variables: 42, seed: 3, holes: 6 });
  const byLabel = {};

  study.rows.forEach(function (row) { byLabel[row.label] = row; });
  const horn = byLabel['Horn — a requirements graph'];
  const contradictory = byLabel['Horn with a contradiction'];
  const critical = byLabel['random 3-SAT at the threshold (ratio 4.27)'];
  const php = byLabel['pigeonhole PHP(6)'];

  assert.strictEqual(horn.horn, true);
  assert.strictEqual(horn.clauses, 85);
  assert.strictEqual(horn.linearSteps, 170);
  assert.strictEqual(horn.nodes, 1);
  assert.strictEqual(horn.conflicts, 0);

  assert.strictEqual(contradictory.clauses, 87);
  assert.strictEqual(contradictory.linearSteps, 86);
  assert.strictEqual(contradictory.nodes, 1);
  assert.strictEqual(contradictory.satisfiable, false);

  assert.strictEqual(byLabel['random 3-SAT below the threshold (ratio 2)'].clauses, 84);
  assert.strictEqual(byLabel['random 3-SAT below the threshold (ratio 2)'].nodes, 15);
  assert.strictEqual(critical.clauses, 179);
  assert.strictEqual(critical.nodes, 30);
  assert.strictEqual(critical.conflicts, 11);
  assert.strictEqual(byLabel['random 3-SAT above it (ratio 8)'].clauses, 336);
  assert.strictEqual(byLabel['random 3-SAT above it (ratio 8)'].nodes, 53);
  assert.strictEqual(php.clauses, 133);
  assert.strictEqual(php.nodes, 1439);
  assert.strictEqual(php.conflicts, 720);

  prose.quotes('sat-zoo', ['85', '170', '87', '86', '84', '179', '336', '133', '1 439', '720',
    '15', '30', '53', '11', '27']);
});

test('sat-zoo: the pigeonhole sweep is exactly 2·h! − 1 nodes and h! conflicts', function () {
  const sweep = NpLab.pigeonholeSweep({ from: 3, to: 8 });
  const factorial = function (n) {
    let value = 1;
    for (let i = 2; i <= n; i += 1) value *= i;
    return value;
  };

  assert.strictEqual(sweep.rows.length, 6);
  sweep.rows.forEach(function (row) {
    assert.strictEqual(row.nodes, 2 * factorial(row.holes) - 1,
      'PHP(' + row.holes + ') nodes');
    assert.strictEqual(row.conflicts, factorial(row.holes), 'PHP(' + row.holes + ') conflicts');
    assert.strictEqual(row.satisfiable, false);
  });
  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.clauses; }),
    [22, 45, 81, 133, 204, 297]);
  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.nodes; }),
    [11, 47, 239, 1439, 10079, 80639]);
  assert.deepStrictEqual(sweep.rows.map(function (row) { return row.variables; }),
    [12, 20, 30, 42, 56, 72]);

  prose.quotes('sat-zoo', ['11', '47', '239', '1 439', '10 079', '80 639',
    '22', '45', '81', '204', '297', '12', '20', '30', '42', '56', '72',
    '6', '24', '120', '720', '5 040', '40 320']);
});

test('sat-zoo: the chain has nine links and three islands', function () {
  const chain = NpLab.reductionChain();

  assert.strictEqual(chain.edges.length, 9);
  assert.strictEqual(chain.islands.length, 3);
  assert.strictEqual(chain.nodes.filter(function (node) {
    return node.kind === 'island';
  }).length, 3);

  prose.quotes('sat-zoo', ['Nine links', 'three islands'].filter(function (text) {
    return prose.proseFor('sat-zoo').indexOf(text) !== -1;
  }));
});
