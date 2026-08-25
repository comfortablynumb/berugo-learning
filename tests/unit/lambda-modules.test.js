/**
 * Property tests for the M27 lambda and semantics modules.
 *
 * Every construction here is checked against something independent: the
 * combinator compiler against the lambda reducer it is supposed to agree with,
 * the small-step semantics against the big-step one, and the type system
 * against actually running the programs it accepts. A module checked only
 * against itself proves nothing.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const Lambda = require(path.join(BASE, 'machines', 'lambda-engine.js'));
const Combinators = require(path.join(BASE, 'algorithms', 'combinators.js'));
const SmallStep = require(path.join(BASE, 'algorithms', 'small-step.js'));
const ArithTypes = require(path.join(BASE, 'algorithms', 'arith-types.js'));

/* ------------------------------------------------ 27.1 the lambda calculus */

test('substitution renames exactly the binders that would capture, and no others', function () {
  const fixture = Lambda.captureFixture();
  const reduced = Lambda.reduce(fixture.term, 'normal', { budget: 20 });

  assert.strictEqual(reduced.text, fixture.right);
  assert.notStrictEqual(reduced.text, fixture.wrong,
    'the naive answer is the identity and the right answer is a constant function');
  assert.strictEqual(reduced.renames.length, 1, 'exactly one binder needed renaming');

  const safe = Lambda.reduce(Lambda.parse('(λx. λz. x) y'), 'normal', { budget: 20 });

  assert.strictEqual(safe.renames.length, 0,
    'z cannot capture y, so renaming it would be gratuitous');
  assert.strictEqual(safe.text, 'λz. y');
});

test('α-equivalence is decided by de Bruijn form, not by names', function () {
  const pairs = [['λx y. x y', 'λa b. a b'], ['λx. x', 'λq. q'],
    ['λf x. f (f x)', 'λg y. g (g y)']];

  pairs.forEach(function (pair) {
    assert.ok(Lambda.alphaEqual(Lambda.parse(pair[0]), Lambda.parse(pair[1])),
      pair[0] + ' and ' + pair[1] + ' are the same term');
    assert.strictEqual(Lambda.toDeBruijn(Lambda.parse(pair[0])),
      Lambda.toDeBruijn(Lambda.parse(pair[1])));
  });
  assert.ok(!Lambda.alphaEqual(Lambda.parse('λx y. x'), Lambda.parse('λx y. y')),
    'and two genuinely different functions must not collide');
});

test('every Church encoding reduces to what it claims, read back at its own kind', function () {
  const numbers = [['plus two three', 5], ['mult two three', 6],
    ['succ (succ zero)', 2], ['succ (plus two three)', 6]];

  numbers.forEach(function (pair) {
    const out = Lambda.reduce(Lambda.parse(Lambda.expand(pair[0])), 'normal',
      { budget: 4000, traceLimit: 0 });

    assert.strictEqual(Lambda.toNumber(out.term), pair[1], pair[0]);
  });

  const booleans = [['isZero zero', true], ['isZero one', false], ['not true', false],
    ['and true false', false], ['or false true', true]];

  booleans.forEach(function (pair) {
    const out = Lambda.reduce(Lambda.parse(Lambda.expand(pair[0])), 'normal',
      { budget: 4000, traceLimit: 0 });

    assert.strictEqual(Lambda.toBoolean(out.term), pair[1], pair[0]);
  });
});

test('Church false and Church zero really are the same term', function () {
  const no = Lambda.reduce(Lambda.parse(Lambda.expand('not true')), 'normal',
    { budget: 100, traceLimit: 0 });

  assert.strictEqual(Lambda.toBoolean(no.term), false);
  assert.strictEqual(Lambda.toNumber(no.term), 0,
    'reading a numeral out of Church false succeeds and gives zero, which is why the ' +
      'section reads each result at the kind its encoding claims');
});

test('the strategies disagree about termination and never about the answer', function () {
  const diverging = Lambda.parse(Lambda.expand('(λx. λy. y) omega'));
  const rows = Lambda.compare(diverging, { budget: 200, traceLimit: 0 });
  const finished = rows.filter(function (row) { return row.normal; });

  assert.strictEqual(finished.length, 3, 'normal, call-by-name and head reduction finish');
  finished.forEach(function (row) {
    assert.strictEqual(row.steps, 1, row.strategy + ' takes one step');
    assert.strictEqual(row.text, 'λy. y');
  });
  rows.filter(function (row) { return !row.normal; }).forEach(function (row) {
    assert.strictEqual(row.outcome, 'budget');
    assert.strictEqual(row.steps, 200, row.strategy + ' makes no progress at all');
  });

  const converging = Lambda.parse(Lambda.expand('plus two three'));

  Lambda.compare(converging, { budget: 4000, traceLimit: 0 })
    .filter(function (row) { return row.strategy === 'normal' || row.strategy === 'applicative'; })
    .forEach(function (row) {
      assert.strictEqual(row.text, 'λf. λx. f (f (f (f (f x))))',
        'Church–Rosser: where both reach a normal form they agree');
    });
});

test('factorial through Y is correct at every n, and the cost is the honest part', function () {
  const expected = [1, 1, 2, 6, 24, 120];

  expected.forEach(function (value, n) {
    const out = Lambda.reduce(Lambda.factorial(n), 'normal', { budget: 60000, traceLimit: 0 });

    assert.strictEqual(out.outcome, 'normal', 'factorial ' + n + ' reaches a normal form');
    assert.strictEqual(Lambda.toNumber(out.term), value, 'factorial ' + n);
  });
});

/* ---------------------------------------------------- 27.2 combinators */

test('compilation removes every binder', function () {
  const hasLambda = function (term) {
    if (term.type === 'lam') return true;
    if (term.type === 'var') return false;
    return hasLambda(term.left) || hasLambda(term.right);
  };

  Combinators.fixtures().concat(['λa b c d. a b c d']).forEach(function (source) {
    [true, false].forEach(function (optimise) {
      const out = Combinators.compileWithSteps(Lambda.parse(source), optimise);

      assert.ok(!hasLambda(out.term), source + ' still has a binder in it');
    });
  });
});

test('the compiled term computes the same function as the lambda term', function () {
  Combinators.fixtures().forEach(function (source) {
    const out = Combinators.agrees(source, ['p', 'q', 'r'], 4000);

    assert.ok(out.agree, source + ': ' + out.lambdaResult + ' against ' + out.combinatorResult);
  });

  const twice = Combinators.agrees('λf x. f (f x)', ['g', 'z'], 4000);

  assert.strictEqual(twice.lambdaResult, 'g (g z)');
  assert.strictEqual(twice.combinatorResult, 'g (g z)');
});

test('the optimisations never grow a term, and sometimes collapse it entirely', function () {
  const rows = Combinators.sizeComparison(Combinators.fixtures()
    .concat(['λa b c d. a b c d']));

  rows.forEach(function (row) {
    assert.ok(row.optimised <= row.naive,
      row.source + ': the optimised form must never be larger than the plain one');
    assert.ok(row.ratio >= 1, row.source + ': the ratio is at least one');
  });

  const worst = rows.slice().sort(function (a, b) { return b.ratio - a.ratio; })[0];

  assert.strictEqual(worst.source, 'λa b c d. a b c d');
  assert.strictEqual(worst.naive, 107);
  assert.strictEqual(worst.optimised, 1);
});

test('graph reduction fires a rule only when the spine has enough arguments', function () {
  const partial = Lambda.parse('S K');

  assert.strictEqual(Combinators.step(partial), null,
    'S has arity three and only two arguments are present');
  assert.strictEqual(Combinators.reduce(Lambda.parse('S K K a'), 100).text, 'a',
    'S K K is the identity');
  assert.strictEqual(Combinators.spineOf(Lambda.parse('a b c d')).length, 4);
});

/* --------------------------------------------- 27.3 operational semantics */

test('the small step and the big step agree on every fixture, failures included', function () {
  SmallStep.fixtures().forEach(function (fixture) {
    const compared = SmallStep.compare(fixture.source);
    const run = SmallStep.run(SmallStep.parse(fixture.source), 200);

    assert.strictEqual(run.outcome, fixture.expect, fixture.source);
    assert.ok(compared.agree, fixture.source + ': the two semantics disagree');
  });
});

test('the standard rules are deterministic and the eager-if rules are not', function () {
  const terms = ['(1 + 2) * (3 + 4)', '2 + 3 * 4', 'if 2 < 3 then 10 else 20',
    'if iszero 0 then 1 + 1 else true + 1', 'pred (pred (2 + 3))'];

  terms.forEach(function (term) {
    ['standard', 'rightToLeft'].forEach(function (variant) {
      const out = SmallStep.determinism(term, variant);

      assert.ok(out.deterministic,
        variant + ' on ' + term + ': ' + out.most + ' rules applied at ' + out.witness);
    });
  });

  const eager = SmallStep.determinism('if iszero 0 then 1 + 1 else true + 1', 'eagerIf');

  assert.ok(!eager.deterministic, 'the eager rules must be non-deterministic somewhere');
  assert.strictEqual(eager.most, 2);
});

test('reordering the congruence holes changes the trace and never the answer', function () {
  SmallStep.fixtures().forEach(function (fixture) {
    const left = SmallStep.run(SmallStep.parse(fixture.source), 200, 'standard');
    const right = SmallStep.run(SmallStep.parse(fixture.source), 200, 'rightToLeft');

    assert.strictEqual(left.text, right.text, fixture.source + ': confluence');
    assert.strictEqual(left.outcome, right.outcome);
  });

  const traces = ['standard', 'rightToLeft'].map(function (variant) {
    return SmallStep.run(SmallStep.parse('(1 + 2) * (3 + 4)'), 50, variant)
      .trace.map(function (row) { return row.term; }).join(' ');
  });

  assert.notStrictEqual(traces[0], traces[1],
    'the two orders must actually produce different traces, or the comparison is empty');
});

test('the eager-if rules get stuck on a branch that never runs', function () {
  const term = 'if iszero 0 then 1 + 1 else true + 1';

  assert.strictEqual(SmallStep.run(SmallStep.parse(term), 200, 'standard').outcome, 'value');
  assert.strictEqual(SmallStep.run(SmallStep.parse(term), 200, 'eagerIf').outcome, 'stuck');
});

test('printing carries precedence, so a trace cannot lie about the term', function () {
  ['1 + 2 * (3 + 4)', '(1 + 2) * (3 + 4)', '1 < 2 + 3', 'pred (2 + 3)'].forEach(function (text) {
    const printed = SmallStep.show(SmallStep.parse(text), 0);

    assert.strictEqual(SmallStep.show(SmallStep.parse(printed), 0), printed,
      text + ' does not round-trip through the printer');
  });
});

/* ------------------------------------------------------- 27.4 soundness */

test('progress and preservation hold over the exhaustive term set', function () {
  const out = ArithTypes.sweep({ sample: 0 });

  assert.strictEqual(out.terms, 215, 'every term of depth one over five atoms');
  assert.strictEqual(out.wellTypedStuck, 0, 'progress: no well-typed term gets stuck');
  assert.strictEqual(out.preservationFailures, 0, 'preservation: no step changes a type');
  assert.ok(out.preservationChecked > 0, 'and some steps were actually checked');
  assert.ok(out.sound);
});

test('the conservatism is real and is counted', function () {
  const out = ArithTypes.sweep({ sample: 0 });

  assert.ok(out.illTypedFine > 0,
    'a sound checker must reject some programs that would have run');
  assert.strictEqual(out.illTypedFine, 24);
  assert.strictEqual(out.wellTypedFine, 64);
  assert.strictEqual(out.illTypedStuck, 151 - 24);
});

test('the sampled sweep is reproducible and finds no unsoundness either', function () {
  const first = ArithTypes.sweep({ sample: 2000, seed: 20260824 });
  const second = ArithTypes.sweep({ sample: 2000, seed: 20260824 });

  assert.deepStrictEqual(
    [first.terms, first.wellTyped, first.illTypedFine],
    [second.terms, second.wellTyped, second.illTypedFine],
    'the same seed must give the same sweep');
  assert.strictEqual(first.wellTypedStuck, 0);
  assert.strictEqual(first.preservationFailures, 0);
});

test('the typing rules reject exactly what the semantics gets stuck on, and a little more',
  function () {
    const rejected = ['if 1 then 2 else 3', 'true + 1', 'pred true',
      'if true then 1 else false'];

    rejected.forEach(function (text) {
      assert.ok(!ArithTypes.typeOf(SmallStep.parse(text)).ok, text + ' must be rejected');
    });
    ['2 + 3 * 4', 'if 2 < 3 then 10 else 20', 'iszero (pred 1)'].forEach(function (text) {
      const out = ArithTypes.typeOf(SmallStep.parse(text));

      assert.ok(out.ok, text + ' must type');
      assert.ok(out.type === 'Number' || out.type === 'Boolean');
    });
  });
