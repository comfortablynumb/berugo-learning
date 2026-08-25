/**
 * Every figure the M27 worked examples quote, recomputed from the modules —
 * and then checked to still be quoted.
 *
 * Recomputing catches a module that drifted from the prose; the quote check
 * catches prose that drifted from the module. A test that does only the first
 * passes happily while the section teaches a number nothing produces any more.
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
const TypeEngine = require(path.join(BASE, 'machines', 'type-engine.js'));
const HmLab = require(path.join(BASE, 'machines', 'hm-lab.js'));
const SystemF = require(path.join(BASE, 'algorithms', 'system-f.js'));
const SystemFLab = require(path.join(BASE, 'machines', 'system-f-lab.js'));
const Subtyping = require(path.join(BASE, 'algorithms', 'subtyping.js'));
const TypeClasses = require(path.join(BASE, 'algorithms', 'typeclasses.js'));
const PatternCompile = require(path.join(BASE, 'algorithms', 'pattern-compile.js'));
const VerifyLab = require(path.join(BASE, 'machines', 'verify-lab.js'));
const Ownership = require(path.join(BASE, 'algorithms', 'ownership.js'));

const CONTENT = path.join(BASE, 'content');

['lambda', 'types', 'semantics'].forEach(function (third) {
  require(path.join(CONTENT, 'examples-' + third + '.js'));
  require(path.join(CONTENT, 'concepts-' + third + '.js'));
});

const prose = require('../support/worked-example-prose.js');

/* --------------------------------------- 27.1 the untyped lambda calculus */

test('27.1: Church arithmetic, and the step counts the prose quotes', function () {
  const cases = [['plus two three', 6, 5], ['mult two three', 7, 6],
    ['succ (succ zero)', 6, 2]];

  cases.forEach(function (row) {
    const out = Lambda.reduce(Lambda.parse(Lambda.expand(row[0])), 'normal',
      { budget: 4000, traceLimit: 0 });

    assert.strictEqual(out.steps, row[1], row[0] + ' step count');
    assert.strictEqual(Lambda.toNumber(out.term), row[2], row[0] + ' value');
  });

  const zero = Lambda.reduce(Lambda.parse(Lambda.expand('isZero zero')), 'normal',
    { budget: 4000, traceLimit: 0 });
  const one = Lambda.reduce(Lambda.parse(Lambda.expand('isZero one')), 'normal',
    { budget: 4000, traceLimit: 0 });

  assert.strictEqual(zero.steps, 3);
  assert.strictEqual(one.steps, 4);
  prose.quotes('the-untyped-lambda-calculus',
    ['6 β-steps', '7 β-steps', 'reads back as 5', 'reads back as 6',
      '3 steps to λt. λf. t', '4 steps to λt. λf. f']);
});

test('27.1: the three strategies that finish and the two that never do', function () {
  const term = Lambda.parse(Lambda.expand('(λx. λy. y) omega'));

  [50, 200, 2000].forEach(function (budget) {
    const rows = Lambda.compare(term, { budget: budget, traceLimit: 0 });
    const done = rows.filter(function (row) { return row.normal; });

    assert.strictEqual(done.length, 3, 'at budget ' + budget);
    done.forEach(function (row) { assert.strictEqual(row.steps, 1); });
    rows.filter(function (row) { return !row.normal; }).forEach(function (row) {
      assert.strictEqual(row.steps, budget, row.strategy + ' makes no progress');
    });
  });
  prose.quotes('the-untyped-lambda-calculus',
    ['1 β-step, reaching the normal form λy. y', 'at 50, at 200 and at 2 000 steps',
      'all 3 settings']);
});

test('27.1: factorial through Y — the values, the steps and the growth', function () {
  const steps = [];
  const sizes = [];

  [0, 1, 2, 3, 4, 5].forEach(function (n) {
    const out = Lambda.reduce(Lambda.factorial(n), 'normal', { budget: 60000, traceLimit: 0 });

    steps.push(out.steps);
    sizes.push(out.size);
    assert.strictEqual(Lambda.toNumber(out.term), [1, 1, 2, 6, 24, 120][n]);
  });
  assert.deepStrictEqual(steps, [9, 34, 159, 838, 5057, 34938]);
  assert.deepStrictEqual(sizes, [5, 5, 7, 15, 51, 243]);

  const growth = steps.slice(1).map(function (value, i) {
    return prose.fixed(value / steps[i], 1);
  });

  assert.deepStrictEqual(growth, ['3.8', '4.7', '5.3', '6.0', '6.9']);
  prose.quotes('the-untyped-lambda-calculus',
    ['9 and 34 β-steps', '159 steps', '838 steps', '5 057 steps', '34 938 steps',
      '3.8×, 4.7×, 5.3×, 6.0× and 6.9×', 'size 5, 5, 7, 15, 51, 243']);
});

/* ---------------------------------------------------- 27.2 combinators */

test('27.2: the size table, plain against optimised', function () {
  const rows = Combinators.sizeComparison(['λx. x', 'λx y. x', 'λf x. f (f x)',
    'λx y z. x z (y z)', 'λa b c d. a b c d']);
  const expected = [[2, 1, 1], [3, 7, 1], [7, 35, 11], [10, 61, 1], [11, 107, 1]];

  rows.forEach(function (row, i) {
    assert.deepStrictEqual([row.original, row.naive, row.optimised], expected[i], row.source);
  });
  assert.strictEqual(prose.fixed(rows[1].ratio, 1), '7.0');
  assert.strictEqual(prose.fixed(rows[2].ratio, 1), '3.2');
  assert.strictEqual(prose.fixed(rows[3].ratio, 1), '61.0');
  assert.strictEqual(prose.fixed(rows[4].ratio, 1), '107.0');
  prose.quotes('combinatory-logic-and-compilation',
    ['3 → 7 plain, 1 optimised, a ratio of 7.0×', '7 → 35 plain, 11 optimised, 3.2×',
      '10 → 61 plain, 1 optimised, 61.0×', '11 → 107 plain, 1 optimised, 107.0×']);
});

test('27.2: the agreement table and its step counts', function () {
  const rows = [['λx. x', 'I', 1, 1], ['λx y. x', 'K', 2, 1],
    ['λf g x. f (g x)', 'S (K S) K', 3, 4]];

  rows.forEach(function (row) {
    const out = Combinators.agrees(row[0], ['p', 'q', 'r'], 4000);

    assert.ok(out.agree, row[0]);
    assert.strictEqual(out.compiled, row[1]);
    assert.strictEqual(out.lambdaSteps, row[2], row[0] + ' β-steps');
    assert.strictEqual(out.combinatorSteps, row[3], row[0] + ' combinator steps');
  });

  const twice = Combinators.agrees('λf x. f (f x)', ['g', 'z'], 4000);

  assert.strictEqual(twice.compiled, 'S (S (K S) K) I');
  assert.strictEqual(twice.lambdaSteps, 2);
  assert.strictEqual(twice.combinatorSteps, 6);
  prose.quotes('combinatory-logic-and-compilation',
    ['compiles to I; both give p q r, in 1 step each',
      'compiles to K; both give p r, in 2 β-steps and 1 combinator step',
      'S (S (K S) K) I', '2 β-steps and 6 ', 'S (K S) K', '3 β-steps and 4 combinator steps']);
});

/* ------------------------------------------- 27.3 operational semantics */

test('27.3: the two evaluation orders and their traces', function () {
  const traces = ['standard', 'rightToLeft'].map(function (variant) {
    const run = SmallStep.run(SmallStep.parse('(1 + 2) * (3 + 4)'), 50, variant);

    assert.strictEqual(run.steps, 3);
    assert.strictEqual(run.text, '21');
    return run.trace.map(function (row) { return row.term; });
  });

  assert.strictEqual(traces[0][1], '3 * (3 + 4)');
  assert.strictEqual(traces[1][1], '(1 + 2) * 7');
  assert.strictEqual(traces[0][2], '3 * 7');
  prose.quotes('operational-semantics',
    ['3 * (3 + 4) → 3 * 7 → 21', '(1 + 2) * 7 → 3 * 7 → 21', 'in 3 steps']);
});

test('27.3: the eager rules get stuck, and are non-deterministic', function () {
  const term = 'if iszero 0 then 1 + 1 else true + 1';
  const standard = SmallStep.run(SmallStep.parse(term), 200, 'standard');
  const eager = SmallStep.run(SmallStep.parse(term), 200, 'eagerIf');

  assert.strictEqual(standard.steps, 3);
  assert.strictEqual(standard.text, '2');
  assert.strictEqual(eager.outcome, 'stuck');
  assert.strictEqual(eager.steps, 2);
  assert.strictEqual(eager.text, 'if true then 2 else true + 1');
  assert.strictEqual(SmallStep.determinism(term, 'eagerIf').most, 2);

  const differing = SmallStep.fixtures().filter(function (fixture) {
    return SmallStep.run(SmallStep.parse(fixture.source), 200, 'standard').text
      !== SmallStep.run(SmallStep.parse(fixture.source), 200, 'eagerIf').text;
  });

  assert.strictEqual(differing.length, 1);
  assert.strictEqual(SmallStep.fixtures().length, 8);
  prose.quotes('operational-semantics',
    ['3 steps to the value 2', 'stuck after 2 steps', 'if true then 2 else true + 1',
      '2 rules apply', '1 of the 8 fixture rows differs']);
});

test('27.3: small step and big step agree on every fixture', function () {
  let value = 0;
  let stuck = 0;

  SmallStep.fixtures().forEach(function (fixture) {
    const compared = SmallStep.compare(fixture.source);

    assert.ok(compared.agree, fixture.source);
    if (compared.smallOutcome === 'value') value += 1;
    if (compared.smallOutcome === 'stuck') stuck += 1;
  });
  assert.strictEqual(value + stuck, 8);
  assert.strictEqual(stuck, 3);

  const sum = SmallStep.compare('2 + 3 * 4');

  assert.strictEqual(sum.smallSteps, 2);
  assert.strictEqual(sum.bigHeight, 3);
  assert.strictEqual(sum.bigNodes, 5);
  prose.quotes('operational-semantics',
    ['8 of 8 agree, including all three stuck cases',
      '2 steps to 14. big step: the same 14, in a derivation 3 deep ']);
});

/* --------------------------------------------------------- 27.4 STLC */

test('27.4: the soundness sweep at the default sample size', function () {
  const out = ArithTypes.sweep({ sample: 2000, seed: 20260824 });

  assert.strictEqual(out.wellTypedFine, 224);
  assert.strictEqual(out.wellTypedStuck, 0);
  assert.strictEqual(out.illTypedFine, 99);
  assert.strictEqual(out.illTypedStuck, 1892);
  assert.strictEqual(out.illTyped, 1991);
  assert.strictEqual(out.preservationChecked, 400);
  assert.strictEqual(out.preservationFailures, 0);
  assert.strictEqual(prose.fixed(out.conservatism * 100, 1), '5.0');
  prose.quotes('the-simply-typed-lambda-calculus',
    ['224 of them', '0 — no well-typed term', '400 steps checked, 0 type changes',
      '1 892 of them', '99 — five per cent of all rejections']);
});

test('27.4: the derivation and the failing rules the fixtures name', function () {
  const node = TypeEngine.check(
    TypeEngine.parse('λf: Number → Number. λx: Number. f (f x)'), TypeEngine.emptyContext());

  assert.strictEqual(TypeEngine.showType(node.type), '(Number → Number) → Number → Number');
  assert.strictEqual(TypeEngine.height(node), 5);
  assert.strictEqual(TypeEngine.countNodes(node), 7);
  assert.strictEqual(TypeEngine.fixtures().length, 13);

  TypeEngine.fixtures().forEach(function (fixture) {
    const checked = TypeEngine.check(TypeEngine.parse(fixture.source),
      TypeEngine.emptyContext());

    assert.strictEqual(checked.ok, fixture.wellTyped, fixture.source);
  });
  prose.quotes('the-simply-typed-lambda-calculus',
    ['derivation height 5 with 7 nodes', 'Thirteen fixtures',
      'T-App: the function expects Number and the argument is Boolean']);
});

/* ------------------------------------------------- 27.5 Hindley–Milner */

test('27.5: the let-polymorphism figures', function () {
  const bound = HmLab.analyse('let id = λx. x in pair (id 3) (id true)');

  assert.strictEqual(bound.scheme, 'Pair Number Boolean');
  assert.strictEqual(bound.steps, 13);
  assert.strictEqual(bound.unificationCount, 12);
  assert.strictEqual(bound.freshVariables, 9);
  assert.strictEqual(bound.size, 12);

  const generalise = bound.log.filter(function (row) { return row.rule === 'W-Let'; })[0];

  assert.strictEqual(generalise.text, 'generalise id : ∀α. α → α');
  prose.quotes('type-inference-and-hindley-milner',
    ['13 rule applications with 12 equations solved', 'generalise id : ∀α. α → α',
      '9 invented for a term of size 12']);
});

test('27.5: the unification fixtures and their bindings', function () {
  const solved = HmLab.unifyPair('a → b', 'Number → Boolean');

  assert.ok(solved.ok);
  assert.strictEqual(solved.trace.length, 3);
  assert.deepStrictEqual(solved.bindings, ['a := Number', 'b := Boolean']);

  const chained = HmLab.unifyPair('(a → b) → a', '(Number → c) → d');

  assert.deepStrictEqual(chained.bindings, ['a := Number', 'b := c', 'd := Number']);
  assert.strictEqual(HmLab.unifyPair('a', 'a → b').kind, 'occurs');
  assert.strictEqual(HmLab.unifyPair('a → a', 'Number → Boolean').kind, 'clash');
  prose.quotes('type-inference-and-hindley-milner',
    ['3 calls, 2 bindings: a := Number, b := Boolean',
      '3 bindings: a := Number, b := c, d := Number']);
});

/* ---------------------------------------------------------- 27.6 System F */

test('27.6: the inhabitant counts', function () {
  const rows = SystemF.freeTheorems();
  const counts = rows.map(function (row) { return row.count; });

  assert.deepStrictEqual(counts, [1, 1, 2, 0, 0]);
  assert.deepStrictEqual(rows[0].terms, ['λx0. x0']);
  assert.deepStrictEqual(rows[2].terms, ['λx0. λx1. x0', 'λx0. λx1. x1']);
  prose.quotes('polymorphism-and-system-f',
    ['1 inhabitant: λx0. x0', '2 inhabitants: λx0. λx1. x0 and λx0. λx1. x1',
      '0 inhabitants — this is the empty type']);
});

test('27.6: the rank-2 term, and what erasure removes', function () {
  const contrast = SystemFLab.rankContrast();

  assert.ok(contrast.written.ok);
  assert.strictEqual(contrast.written.type, '(∀a. a → a) → Mixed');
  assert.strictEqual(contrast.written.nodes, 12);
  assert.strictEqual(contrast.written.height, 6);
  assert.ok(!contrast.inferred.ok);

  const rows = SystemFLab.erasureTable();

  assert.strictEqual(rows[0].typed, 12);
  assert.strictEqual(rows[0].erasedLength, 5);
  assert.strictEqual(rows[1].erasedLength, 5);
  assert.strictEqual(rows[0].erased, rows[1].erased);
  assert.strictEqual(rows[4].typed, 51);
  assert.strictEqual(rows[4].erasedLength, 27);
  assert.strictEqual(rows[6].typed, 23);
  assert.strictEqual(rows[6].erasedLength, 9);
  prose.quotes('polymorphism-and-system-f',
    ['(∀a. a → a) → Mixed, in 12 rule applications at height 6',
      '12 characters become 5', '51 characters become 27', '23 characters become 9']);
});

/* ------------------------------------------------------- 27.7 subtyping */

test('27.7: the unsoundness witnesses', function () {
  const found = Subtyping.unsoundWitnesses();

  assert.strictEqual(found.length, 2);
  assert.strictEqual(found[0].narrow, 'Integer');
  assert.strictEqual(found[0].wide, 'Number');
  assert.strictEqual(found[0].stored, 'Double');
  assert.strictEqual(found[1].narrow, 'Double');
  assert.strictEqual(found[1].stored, 'Integer');
  found.forEach(function (row) { assert.ok(row.invariantRejects); });
  prose.quotes('subtyping-and-variance',
    ['1 witness: Double', 'CovariantArray<Double> ≤ CovariantArray<Number>, breaking on ',
      'yes for both of the 2']);
});

test('27.7: the variance table and the function rule', function () {
  const rows = Subtyping.varianceTable();
  const byName = {};

  rows.forEach(function (row) { byName[row.name] = row; });
  assert.deepStrictEqual([byName.List.widening, byName.List.narrowing], [true, false]);
  assert.deepStrictEqual([byName.Sink.widening, byName.Sink.narrowing], [false, true]);
  assert.deepStrictEqual([byName.Ref.widening, byName.Ref.narrowing], [false, false]);

  const I = Subtyping.prim('Integer');
  const N = Subtyping.prim('Number');

  assert.strictEqual(Subtyping.isSubtype(Subtyping.arrow(N, I),
    Subtyping.arrow(I, N)).rule, 'S-Arrow');
  assert.ok(!Subtyping.isSubtype(Subtyping.arrow(I, I), Subtyping.arrow(N, N)).ok);
  prose.quotes('subtyping-and-variance',
    ['yes, by S-Arrow, with 2 premises', 'all 4 differ: List widens and does not narrow']);
});

/* ----------------------------------------------------- 27.8 type classes */

test('27.8: the dictionary expressions and their counts', function () {
  const rows = [['Eq Int', 'dEqInt', 1, 1],
    ['Eq (List Int)', 'dEqLista(dEqInt)', 2, 2],
    ['Eq (List (List Int))', 'dEqLista(dEqLista(dEqInt))', 3, 3],
    ['Eq (Pair Int (List Bool))', 'dEqPairab(dEqInt, dEqLista(dEqBool))', 4, 3]];

  rows.forEach(function (row) {
    const out = TypeClasses.analyse(row[0], {});

    assert.strictEqual(out.dictionary, row[1], row[0]);
    assert.strictEqual(out.dictionaries, row[2]);
    assert.strictEqual(out.depth, row[3]);
  });

  const ord = TypeClasses.analyse('Ord (List Int)', { superclasses: true });

  assert.strictEqual(ord.dictionary, 'dOrdLista(dOrdInt(dEqInt), dEqLista(dEqInt))');
  assert.strictEqual(ord.dictionaries, 5);
  prose.quotes('beyond-plain-generics',
    ['dEqLista(dEqLista(dEqInt)) — 3 dictionaries, depth 3',
      'dOrdLista(dOrdInt(dEqInt), dEqLista(dEqInt)) — 5 dictionaries, depth 3']);
});

test('27.8: coherence changes the answer, and six of nine goals resolve', function () {
  const contrast = TypeClasses.coherenceContrast();

  assert.strictEqual(contrast.plain.dictionary, 'dShowLista(dShowInt)');
  assert.ok(!contrast.strict.ok);
  assert.strictEqual(contrast.permissive.dictionary, 'dShowListInt');

  const solved = TypeClasses.sweep({}).filter(function (row) { return row.ok; });

  assert.strictEqual(solved.length, 6);
  assert.strictEqual(TypeClasses.GOALS.length, 9);
  prose.quotes('beyond-plain-generics',
    ['dShowLista(dShowInt) — 2 dictionaries', 'dShowListInt — 1 dictionary',
      '6 of 9 goals resolve']);
});

/* ------------------------------------------------ 27.9 pattern matching */

test('27.9: the witnesses and the heuristic sizes', function () {
  const cases = [[['nil', 'cons(true, _)'], ['List'], 'cons(false, nil)'],
    [['red', 'green'], ['Colour'], 'blue'],
    [['true; true', 'false; _'], ['Bool', 'Bool'], 'true , false']];

  cases.forEach(function (spec) {
    const out = PatternCompile.exhaustive(spec[0].map(PatternCompile.parseRow), spec[1]);

    assert.strictEqual(out.witness, spec[2], spec[0].join(' | '));
  });

  const matrix = ['_; false; true', 'false; true; _', '_; _; false', '_; _; _']
    .map(PatternCompile.parseRow);
  const rows = PatternCompile.heuristicTable(matrix, ['Bool', 'Bool', 'Bool']);

  assert.deepStrictEqual(rows.map(function (row) { return row.size; }), [13, 9, 9, 13]);
  assert.deepStrictEqual(rows.map(function (row) { return row.tests; }), [6, 4, 4, 6]);
  assert.deepStrictEqual(rows.map(function (row) { return row.clauses; }), [4, 4, 4, 4]);
  prose.quotes('algebraic-data-types-and-pattern-matching',
    ['cons(false, nil)', '13 nodes, 6 tests, depth 4', '9 nodes, 4 tests, depth 4']);
});

test('27.9: how many values each type has at each depth bound', function () {
  const expected = { Bool: [2, 2, 2], Colour: [3, 3, 3], Option: [3, 3, 3],
    List: [3, 7, 15], Tree: [3, 19, 723] };

  Object.keys(expected).forEach(function (name) {
    const counts = [1, 2, 3].map(function (depth) {
      return PatternCompile.valueCount(name, depth);
    });

    assert.deepStrictEqual(counts, expected[name], name);
  });
  prose.quotes('algebraic-data-types-and-pattern-matching', ['3, 7, 15', '3, 19, 723']);
});

/* ---------------------------------------------------------- 27.10 Hoare */

test('27.10: the proof-against-execution sweep', function () {
  const rows = VerifyLab.programNames().map(function (name) {
    return { name: name, proved: VerifyLab.verify(name).proved,
      failing: VerifyLab.verify(name).failing,
      runs: VerifyLab.test(name) };
  });
  const weak = rows.filter(function (row) {
    return !row.proved && row.runs.failures.length === 0;
  });
  const broken = rows.filter(function (row) {
    return row.proved && row.runs.failures.length > 0;
  });

  assert.strictEqual(weak.length, 3, 'three correct programs with invariants too weak');
  assert.strictEqual(broken.length, 0, 'and no proof that passed while execution failed');
  assert.deepStrictEqual(weak.map(function (row) { return row.name; }).sort(),
    ['divisionNoBound', 'sumNoBound', 'sumTooWeak']);

  const byName = {};

  rows.forEach(function (row) { byName[row.name] = row; });
  assert.strictEqual(byName.swap.runs.runs, 64);
  assert.strictEqual(byName.max.runs.runs, 512);
  assert.strictEqual(byName.sum.runs.runs, 48);
  assert.strictEqual(byName.division.runs.runs, 1920);
  assert.deepStrictEqual(byName.sumTooWeak.failing, ['preservation', 'exit']);
  prose.quotes('denotational-and-axiomatic-semantics',
    ['proved; 64 and 512 runs, all correct', '48, 48 and 1 920 concrete runs are correct',
      '2 of the 3 conditions fail']);
});

test('27.10: the counterexamples and the conjuncts they blame', function () {
  const cases = [['swapNoTemp', 'entry', 'y = a'], ['maxWrong', 'entry', 'x ≥ y'],
    ['sumNoBound', 'exit', '2 * s = n * (n - 1)'], ['divisionNoBound', 'exit', 'r ≥ 0']];

  cases.forEach(function (spec) {
    const failed = VerifyLab.verify(spec[0]).obligations.filter(function (row) {
      return row.name === spec[1];
    })[0];

    assert.ok(!failed.valid, spec[0] + '/' + spec[1] + ' should fail');
    assert.strictEqual(failed.blame, spec[2], spec[0] + ' blames the wrong conjunct');
  });
  prose.quotes('denotational-and-axiomatic-semantics',
    ['blaming y = a', 'blaming x ≥ y', '2 * s = n * (n - 1)', 'divisionNoBound on r >= 0']);
});

test('27.10: the weakest-precondition blow-up', function () {
  const rows = VerifyLab.blowupTable(7);

  assert.deepStrictEqual(rows.map(function (row) { return row.size; }),
    [20, 58, 142, 326, 726, 1590, 3446]);
  assert.strictEqual(prose.fixed(rows[1].ratio, 2), '2.90');
  assert.strictEqual(prose.fixed(rows[2].ratio, 2), '2.45');
  assert.strictEqual(prose.fixed(rows[6].ratio, 2), '2.17');
  prose.quotes('denotational-and-axiomatic-semantics',
    ['20 nodes', '58 nodes, 2.90×', '142 nodes then 326 nodes, 2.45× and 2.30×',
      '726, 1 590 and 3 446 nodes', '2.17×']);
});

/* ------------------------------------------------------- 27.11 ownership */

test('27.11: the discipline matrix', function () {
  const rows = Ownership.disciplineTable();
  const byName = {};

  rows.forEach(function (row) { byName[row.program] = row; });
  assert.strictEqual(rows.length, 12);
  assert.deepStrictEqual(byName.leak.acceptedBy, ['unrestricted', 'affine']);
  assert.deepStrictEqual(byName.useTwice.acceptedBy, ['unrestricted', 'relevant']);

  const everywhere = rows.filter(function (row) { return row.acceptedBy.length === 4; });
  const nowhere = rows.filter(function (row) { return row.acceptedBy.length === 0; });

  assert.strictEqual(everywhere.length, 3);
  assert.strictEqual(nowhere.length, 7);
  assert.deepStrictEqual(everywhere.map(function (row) { return row.program; }),
    ['moveOnce', 'sharedTwice', 'mutableThenRelease']);
  prose.quotes('substructural-types-and-ownership',
    ['3 programs — moveOnce, sharedTwice and mutableThenRelease', 'by all 4 disciplines',
      'accepted by 2 of the 4', 'rejected by all 4']);
});

test('27.11: every error names the line responsible', function () {
  const cases = [['moveThenUse', 2, 1], ['sharedAndMutable', 2, 1], ['mutableTwice', 2, 1],
    ['useAfterRelease', 3, 2], ['moveWhileBorrowed', 2, 1]];

  cases.forEach(function (spec) {
    const first = Ownership.analyse(spec[0], 'affine').errors[0];

    assert.strictEqual(first.line, spec[1], spec[0] + ' error line');
    assert.strictEqual(first.blame, spec[2], spec[0] + ' blame line');
  });
  prose.quotes('substructural-types-and-ownership',
    ['line 2 "use x": x was already moved out of (see line 1)',
      'line 3 "use a": a outlived its borrow (see line 2)']);
});
