'use strict';

/**
 * Every figure the M32.7-M32.8 content quotes, recomputed and then checked
 * against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const ModelCheck = require('../../src/js/algorithms/model-check.js');
const VerifyVc = require('../../src/js/algorithms/verify-vc.js');
const Template = require('../../src/js/sections/model-checking-template.js');
const VerifyTemplate = require('../../src/js/sections/deductive-verification-template.js');

require('../../src/js/content/concepts-program-verification.js');
require('../../src/js/content/examples-program-verification.js');
const prose = require('../support/worked-example-prose.js');

function reachable(spec) {
  return ModelCheck.explore(ModelCheck.create(Object.assign({}, spec, {
    invariant: function () { return true; }, invariantName: 'nothing'
  })), { states: 200000 }).states;
}

test('model checking: the two-process race, both methods', function () {
  const model = ModelCheck.create(Template.lockSpec(2));
  const search = ModelCheck.explore(model, {});
  const compared = ModelCheck.compare(model, 8, {});

  assert.strictEqual(search.states, 16, '16 states visited');
  assert.strictEqual(search.transitions, 26, '26 transitions followed');
  assert.strictEqual(search.at, 6, 'the violation is at depth 6');
  assert.strictEqual(compared.bmcDepth, 6, 'and the unrolling agrees');
  assert.strictEqual(compared.rows[0].clauses, 103, '103 clauses at depth 0');
  assert.strictEqual(compared.rows[8].clauses, 15207, '15 207 at depth 8');
  assert.strictEqual(compared.rows[6].clauses, 11431, '11 431 at the violation');
  assert.strictEqual(compared.rows[1].clauses - compared.rows[0].clauses, 1888,
    'growing by 1 888 per step');

  prose.quotes('model-checking',
    ['16 states and 26 transitions', 'depth 6', '103 clauses at depth 0',
      '1 888 per step', '15 207 at depth 8', '11 431']);
});

test('model checking: Peterson, exhausted', function () {
  const spec = Template.petersonSpec();
  const out = ModelCheck.explore(ModelCheck.create(spec), {});

  assert.strictEqual(out.violated, false, 'no violation');
  assert.strictEqual(reachable(spec), 20, '20 reachable states');
  assert.strictEqual(Math.pow(2, spec.vars.length), 128, 'of 128 the variables allow');

  prose.quotes('model-checking', ['20 reachable states of 128']);
});

test('model checking: the three exponentials', function () {
  const rows = [2, 3, 4, 5, 6].map(function (processes) {
    const spec = Template.lockSpec(processes);
    const found = ModelCheck.explore(ModelCheck.create(spec), { states: 200000 });

    return { space: Math.pow(2, spec.vars.length), reachable: reachable(spec),
      toFind: found.states };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.space; }),
    [64, 512, 4096, 32768, 262144], 'the space the variables allow');
  assert.deepStrictEqual(rows.map(function (row) { return row.reachable; }),
    [16, 64, 256, 1024, 4096], 'the reachable set');
  assert.deepStrictEqual(rows.map(function (row) { return row.toFind; }),
    [16, 45, 107, 223, 421], 'and the states visited before the violation');

  prose.quotes('model-checking',
    ['64, 4 096 and 262 144', '16, 256 and 4 096', '16, 107 and 421', '421']);
});

test('model checking: the unrolling grows about sixteen-fold per process', function () {
  const rows = [2, 3, 4].map(function (processes) {
    return ModelCheck.encode(ModelCheck.create(Template.lockSpec(processes)), 1).clauses.length;
  });

  assert.deepStrictEqual(rows, [1991, 32778, 440333], 'clauses at depth 1');
  prose.quotes('model-checking', ['1 991 clauses at depth 1', '32 778', '440 333']);
});

/* ------------------------------------------------------------- verification */

function rowsFor(name) {
  const programs = VerifyTemplate.build(VerifyVc);

  return VerifyVc.generate(programs[name]).vcs.map(function (vc) {
    return VerifyVc.discharge(vc);
  });
}

test('verification: the five programmes, conditions and outcomes', function () {
  const expected = {
    midpoint: [1, 0], midpointFixed: [1, 1], counting: [6, 5],
    countingWeak: [2, 1], max: [4, 4]
  };

  Object.keys(expected).forEach(function (name) {
    const rows = rowsFor(name);

    assert.strictEqual(rows.length, expected[name][0], name + ': conditions generated');
    assert.strictEqual(rows.filter(function (row) { return row.discharged; }).length,
      expected[name][1], name + ': conditions discharged');
  });

  const midpoint = rowsFor('midpoint')[0];

  assert.deepStrictEqual(midpoint.witness, { sum: 1500, lo: 625, hi: 875 },
    'the integer counter-example the prose quotes');

  const weak = rowsFor('countingWeak').filter(function (row) { return !row.discharged; })[0];

  assert.deepStrictEqual(weak.witness, { n: -1, i: -1 },
    'and the unreachable one the missing invariant produces');

  const loop = rowsFor('counting').filter(function (row) { return !row.discharged; })[0];

  assert.strictEqual(loop.rationalOnly, true, 'the loop failure is fractional only');
  assert.strictEqual(loop.model.n, 0.5, 'refuted at n = 0.5');

  prose.quotes('deductive-verification',
    ['1 condition', '6 conditions, 5 discharged', '2 conditions, 1 discharged',
      'lo = 625, hi = 875, sum = 1500', 'n = -1, i = -1', 'n = 0.5']);
});

test('verification: the branch programme has three paths', function () {
  const programs = VerifyTemplate.build(VerifyVc);

  assert.strictEqual(VerifyVc.generate(programs.max).paths, 3, 'two branches and the join');
  assert.strictEqual(VerifyVc.generate(programs.midpoint).paths, 1, 'and one straight line');

  prose.quotes('deductive-verification', ['3 paths', '1 path']);
});
