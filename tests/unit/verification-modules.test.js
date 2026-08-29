'use strict';

/**
 * Property tests for the M32.7-M32.8 checkers.
 *
 * The model checker is tested against itself in the only way that catches an
 * encoding bug: two methods that share no code must agree on the DEPTH of the
 * shortest counter-example, and every trace must replay against the model. The
 * verifier is tested by separating its three kinds of failure, because a tool
 * that reports "cannot prove" for all of them is the failure mode.
 */

const test = require('node:test');
const assert = require('node:assert');

const ModelCheck = require('../../src/js/algorithms/model-check.js');
const VerifyVc = require('../../src/js/algorithms/verify-vc.js');
const Template = require('../../src/js/sections/model-checking-template.js');
const VerifyTemplate = require('../../src/js/sections/deductive-verification-template.js');

function lock(processes) {
  return ModelCheck.create(Template.lockSpec(processes));
}

function reachable(spec) {
  return ModelCheck.explore(ModelCheck.create(Object.assign({}, spec, {
    invariant: function () { return true; }, invariantName: 'nothing'
  })), { states: 200000 }).states;
}

test('model checking: the racing protocol breaks and the trace replays', function () {
  const model = lock(2);
  const out = ModelCheck.explore(model, {});

  assert.strictEqual(out.violated, true, 'check-then-set is not mutual exclusion');
  assert.strictEqual(out.at, 6, 'and the shortest interleaving is six steps');
  const replay = ModelCheck.replay(model, out.trace);

  assert.strictEqual(replay.ok, true, replay.why);
  assert.strictEqual(replay.steps, 6, 'the replay takes the same six steps');
});

/* Breadth-first is not a preference: a depth-first search finds a violation
   and not the shortest one, and the length is most of what makes a
   counter-example usable. This checks the property rather than the algorithm. */
test('model checking: no shorter counter-example exists than the one reported', function () {
  const model = lock(2);
  const out = ModelCheck.explore(model, {});

  for (let depth = 0; depth < out.at; depth += 1) {
    assert.strictEqual(ModelCheck.bmc(model, depth, {}).violated, false,
      'the unrolling finds nothing at depth ' + depth + ', so ' + out.at + ' is shortest');
  }
  assert.strictEqual(ModelCheck.bmc(model, out.at, {}).violated, true,
    'and it does find one at the reported depth');
});

test('model checking: the two methods agree on the depth, not merely the verdict', function () {
  const compared = ModelCheck.compare(lock(2), 8, {});

  assert.strictEqual(compared.searchDepth, 6, 'the explicit search says 6');
  assert.strictEqual(compared.bmcDepth, 6, 'and so does the unrolling');
  assert.strictEqual(compared.agree, true, 'which is the check worth having');
});

test('model checking: Peterson is exhausted with no violation', function () {
  const spec = Template.petersonSpec();
  const out = ModelCheck.explore(ModelCheck.create(spec), {});

  assert.strictEqual(out.violated, false, 'the protocol is correct');
  assert.strictEqual(out.exhausted, false, 'and the search finished rather than gave up');
  assert.strictEqual(out.states, 20, 'over 20 reachable states');
  assert.strictEqual(reachable(spec), 20, 'which is all of them');
  assert.strictEqual(ModelCheck.compare(ModelCheck.create(spec), 8, {}).bmcDepth, null,
    'and the unrolling finds nothing up to depth 8 — which is not a proof');
});

test('model checking: the reachable set grows as four to the processes', function () {
  const counts = [2, 3, 4, 5, 6].map(function (processes) {
    return reachable(Template.lockSpec(processes));
  });

  assert.deepStrictEqual(counts, [16, 64, 256, 1024, 4096], 'four to the power of k');
  counts.forEach(function (count, at) {
    const spec = Template.lockSpec(at + 2);

    assert.ok(Math.pow(2, spec.vars.length) > count,
      'and always far below the space the variables allow');
  });
});

test('model checking: finding the bug is cheaper than proving there is none', function () {
  [2, 4, 6].forEach(function (processes) {
    const spec = Template.lockSpec(processes);
    const found = ModelCheck.explore(ModelCheck.create(spec), { states: 200000 });

    assert.strictEqual(found.violated, true, 'every size of this protocol is broken');
    assert.ok(found.states <= reachable(spec),
      'and the search stops before visiting the whole reachable set');
  });
});

/* ------------------------------------------------------------- verification */

function verify(name) {
  const programs = VerifyTemplate.build(VerifyVc);
  const generated = VerifyVc.generate(programs[name]);

  return generated.vcs.map(function (vc) {
    return { vc: vc, out: VerifyVc.discharge(vc) };
  });
}

function counts(rows) {
  return { total: rows.length,
    discharged: rows.filter(function (row) { return row.out.discharged; }).length,
    integer: rows.filter(function (row) { return row.out.witness; }).length,
    rational: rows.filter(function (row) { return row.out.rationalOnly; }).length };
}

test('verification: the binary-search midpoint fails with a state a programme can reach',
  function () {
    const rows = verify('midpoint');
    const summary = counts(rows);

    assert.deepStrictEqual(summary, { total: 1, discharged: 0, integer: 1, rational: 0 },
      'one condition, refuted, with an integer counter-example');
    const witness = rows[0].out.witness;

    Object.keys(witness).forEach(function (name) {
      assert.strictEqual(Number.isInteger(witness[name]), true,
        name + ' must be a whole number for this to be a state');
    });
    assert.strictEqual(rows[0].vc.assumptions.every(function (row) {
      return VerifyVc.holdsAt(row, witness);
    }), true, 'every assumption holds in it');
    assert.strictEqual(VerifyVc.holdsAt(rows[0].vc.goal, witness), false,
      'and the goal does not, which is what a refutation means');
  });

test('verification: the rearranged midpoint discharges', function () {
  assert.deepStrictEqual(counts(verify('midpointFixed')),
    { total: 1, discharged: 1, integer: 0, rational: 0 },
    'the same condition, proved');
});

/* The difference between "your invariant is wrong" and "my arithmetic is
   weaker than your programme" is the one a verifier must not blur, so it is
   asserted rather than described. */
test('verification: the counting loop fails only over the rationals', function () {
  const rows = verify('counting');

  assert.deepStrictEqual(counts(rows), { total: 6, discharged: 5, integer: 0, rational: 1 },
    'six conditions, five proved, one refuted only fractionally');
  const failed = rows.filter(function (row) { return !row.out.discharged; })[0];

  assert.strictEqual(failed.out.witness, null, 'no rounding of the model refutes the goal');
  assert.ok(failed.out.integral.fractional.length > 0, 'and the model really is fractional');
});

test('verification: a missing invariant fails with a state the precondition forbids',
  function () {
    const rows = verify('countingWeak');

    assert.deepStrictEqual(counts(rows), { total: 2, discharged: 1, integer: 1, rational: 0 },
      'fewer conditions and no proof');
    const failed = rows.filter(function (row) { return !row.out.discharged; })[0];

    assert.strictEqual(failed.out.witness.n < 0, true,
      'the counter-example has n below zero, which the precondition forbids — the loop cut ' +
      'discarded it');
  });

test('verification: a branch verifies on every path', function () {
  assert.deepStrictEqual(counts(verify('max')),
    { total: 4, discharged: 4, integer: 0, rational: 0 },
    'two assertions on each of two branches');
  assert.strictEqual(VerifyVc.generate(VerifyTemplate.build(VerifyVc).max).paths, 3,
    'and three paths through the programme');
});

test('verification: weakest precondition of an assignment is substitution', function () {
  const goal = VerifyVc.condition(VerifyVc.variable('x'), 'le', VerifyVc.number(10));
  const out = VerifyVc.wp({ op: 'assign', name: 'x',
    expr: VerifyVc.plus(VerifyVc.variable('y'), VerifyVc.number(1)) }, [goal]);

  assert.strictEqual(VerifyVc.showCondition(out[0]), 'y + 1 <= 10',
    'x is replaced by the expression assigned to it');
});
