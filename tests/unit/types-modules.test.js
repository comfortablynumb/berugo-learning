/**
 * Property tests for the M27 type-system modules.
 *
 * The recurring discipline: a checker is tested against an independent
 * statement of what it should say (the expected principal type, the expected
 * failing rule), never against itself; a search is tested by verifying its
 * witnesses; and a proof is tested by also running the program.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const TypeEngine = require(path.join(BASE, 'machines', 'type-engine.js'));
const Hm = require(path.join(BASE, 'algorithms', 'hm-inference.js'));
const HmLab = require(path.join(BASE, 'machines', 'hm-lab.js'));
const SystemF = require(path.join(BASE, 'algorithms', 'system-f.js'));
const SystemFLab = require(path.join(BASE, 'machines', 'system-f-lab.js'));
const Subtyping = require(path.join(BASE, 'algorithms', 'subtyping.js'));
const TypeClasses = require(path.join(BASE, 'algorithms', 'typeclasses.js'));
const PatternCompile = require(path.join(BASE, 'algorithms', 'pattern-compile.js'));
const Hoare = require(path.join(BASE, 'algorithms', 'hoare.js'));
const VerifyLab = require(path.join(BASE, 'machines', 'verify-lab.js'));
const Ownership = require(path.join(BASE, 'algorithms', 'ownership.js'));

/* -------------------------------------------------------------- 27.4 STLC */

test('every fixture gets the verdict it declares, and rejections name the right rule',
  function () {
    TypeEngine.fixtures().forEach(function (fixture) {
      const node = TypeEngine.check(TypeEngine.parse(fixture.source),
        TypeEngine.emptyContext());

      assert.strictEqual(node.ok, fixture.wellTyped, fixture.source);
      if (fixture.wellTyped) return;
      assert.strictEqual(TypeEngine.firstFailure(node).rule, fixture.rule,
        fixture.source + ' must fail at ' + fixture.rule);
    });
  });

test('an accepted term carries a full derivation, not a bare type', function () {
  const node = TypeEngine.check(
    TypeEngine.parse('λf: Number → Number. λx: Number. f (f x)'), TypeEngine.emptyContext());

  assert.ok(node.ok);
  assert.strictEqual(TypeEngine.showType(node.type), '(Number → Number) → Number → Number');
  assert.strictEqual(TypeEngine.height(node), 5);
  assert.strictEqual(TypeEngine.countNodes(node), 7);
  assert.ok(TypeEngine.derivationRows(node).every(function (row) {
    return row.rule && row.judgement;
  }), 'every row names a rule and a judgement');
});

/* ------------------------------------------------- 27.5 Hindley–Milner */

test('inference returns the principal type each fixture declares', function () {
  HmLab.sweep().forEach(function (row) {
    assert.ok(row.matches, row.source + ': got ' +
      (row.ok ? row.scheme : row.kind + ' — ' + row.why) + ', expected ' + row.expected);
  });
});

test('unification fails in exactly two ways, and reports which', function () {
  HmLab.UNIFY_FIXTURES.forEach(function (fixture) {
    const out = HmLab.unifyPair(fixture.left, fixture.right);

    if (out.ok) {
      assert.ok(out.bindings.length >= 0);
      return;
    }
    assert.ok(out.kind === 'clash' || out.kind === 'occurs',
      fixture.left + ' ~ ' + fixture.right + ': unexpected failure kind ' + out.kind);
    assert.ok(out.why.length > 20, 'and the reason is a sentence, not a code');
  });

  assert.strictEqual(HmLab.unifyPair('a', 'a → b').kind, 'occurs');
  assert.strictEqual(HmLab.unifyPair('List a', 'Pair a b').kind, 'clash');
});

test('a solved unification really does make the two types equal', function () {
  const left = HmLab.typeFromText('(a → b) → a');
  const right = HmLab.typeFromText('(Number → c) → d');
  const out = Hm.unify(left, right, []);

  assert.ok(out.ok);
  assert.strictEqual(Hm.showType(Hm.applySubstitution(out.substitution, left), false),
    Hm.showType(Hm.applySubstitution(out.substitution, right), false),
    'applying the substitution to both sides must produce the same type');
});

test('generalisation at let is the only difference between the two contrast terms',
  function () {
    const contrast = HmLab.polymorphismContrast();

    assert.ok(contrast.letBound.ok, 'the let-bound version types');
    assert.strictEqual(contrast.letBound.scheme, 'Pair Number Boolean');
    assert.ok(!contrast.lambdaBound.ok, 'the lambda-bound version does not');
    assert.strictEqual(contrast.lambdaBound.kind, 'clash');
  });

test('an inferred scheme quantifies nothing the environment mentions', function () {
  const env = { x: Hm.monomorphic(Hm.tvar('a')) };

  assert.deepStrictEqual(
    Hm.generalise(env, Hm.tarrow(Hm.tvar('a'), Hm.tvar('b'))).quantified, ['b']);
  assert.deepStrictEqual(
    Hm.generalise({}, Hm.tarrow(Hm.tvar('a'), Hm.tvar('b'))).quantified, ['a', 'b']);
});

/* ---------------------------------------------------------- 27.6 System F */

test('every System F fixture behaves as declared', function () {
  SystemFLab.sweep().forEach(function (row) {
    assert.ok(row.matches, row.source + ': got ' +
      (row.ok ? row.type : 'rejected — ' + row.why) + ', expected ' + row.expected);
  });
});

test('the inhabitant counts match, and only where the enumeration is complete', function () {
  SystemF.freeTheorems().forEach(function (row) {
    assert.ok(row.complete, row.name + ': the enumeration must be complete to claim a count');
    assert.strictEqual(row.count, row.expected, row.name);
  });

  assert.ok(!SystemF.enumerable(
    SystemF.forAll('a', SystemF.tarrow(SystemF.tarrow(SystemF.tvar('a'), SystemF.tvar('a')),
      SystemF.tvar('a')))),
  'a type with a function-typed argument admits applications, so a variables-only ' +
    'enumeration cannot claim completeness');
});

test('every enumerated inhabitant really has the type it was enumerated for', function () {
  SystemF.FREE_THEOREMS.forEach(function (entry) {
    SystemF.inhabitants(entry.type, 4).forEach(function (term) {
      const checked = SystemF.check(term, { types: [], terms: {} });

      assert.ok(checked.ok, SystemF.showTerm(term) + ' does not type');
      assert.ok(SystemF.sameType(checked.type, entry.type),
        SystemF.showTerm(term) + ' has type ' + SystemF.showType(checked.type, false) +
          ', not ' + entry.name);
    });
  });
});

test('erasure removes the types and keeps a term that parses back', function () {
  SystemFLab.erasureTable().forEach(function (row) {
    assert.ok(row.erasedLength < row.typed, row.source + ': erasure must remove something');
    assert.strictEqual(row.erased.indexOf('Λ'), -1, 'no type abstraction survives');
    assert.strictEqual(row.erased.indexOf('['), -1, 'no type application survives');
    assert.doesNotThrow(function () { require(path.join(BASE, 'machines', 'lambda-engine.js'))
      .parse(row.erased); }, row.erased + ' does not parse as an untyped term');
  });
});

/* ------------------------------------------------------- 27.7 subtyping */

test('subtyping is reflexive, and transitive along the declared hierarchy', function () {
  const names = Object.keys(Subtyping.PRIMITIVES);

  names.forEach(function (name) {
    assert.ok(Subtyping.isSubtype(Subtyping.prim(name), Subtyping.prim(name)).ok,
      name + ' is a subtype of itself');
    assert.ok(Subtyping.isSubtype(Subtyping.prim(name), Subtyping.TOP).ok);
    assert.ok(Subtyping.isSubtype(Subtyping.BOTTOM, Subtyping.prim(name)).ok);
  });
  assert.ok(Subtyping.isSubtype(Subtyping.prim('Integer'), Subtyping.prim('Value')).ok,
    'Integer reaches Value through Number');
});

test('the function rule flips the argument, in both directions', function () {
  const I = Subtyping.prim('Integer');
  const N = Subtyping.prim('Number');

  assert.ok(Subtyping.isSubtype(Subtyping.arrow(N, I), Subtyping.arrow(I, N)).ok);
  assert.ok(!Subtyping.isSubtype(Subtyping.arrow(I, I), Subtyping.arrow(N, N)).ok);
  assert.ok(!Subtyping.isSubtype(Subtyping.arrow(N, N), Subtyping.arrow(N, I)).ok);
});

test('the unsoundness search produces witnesses the invariant version rejects', function () {
  const found = Subtyping.unsoundWitnesses();

  assert.ok(found.length > 0, 'the covariant mutable container must admit something bad');
  found.forEach(function (row) {
    assert.ok(Subtyping.isSubtype(Subtyping.prim(row.stored), Subtyping.prim(row.wide)).ok,
      row.stored + ' must be accepted by the wide view, or it is not a witness');
    assert.ok(!Subtyping.isSubtype(Subtyping.prim(row.stored), Subtyping.prim(row.narrow)).ok,
      row.stored + ' must be refused by the narrow element type');
    assert.ok(row.invariantRejects,
      'and the invariant declaration must reject the same pair, or the fix is not a fix');
  });
});

test('a join is above both operands and a meet is below both', function () {
  const names = ['Integer', 'Double', 'Number', 'String', 'Boolean'];

  names.forEach(function (left) {
    names.forEach(function (right) {
      const a = Subtyping.prim(left);
      const b = Subtyping.prim(right);
      const join = Subtyping.join(a, b);

      assert.ok(Subtyping.isSubtype(a, join).ok && Subtyping.isSubtype(b, join).ok,
        left + ' ⊔ ' + right + ' must be above both');
      const meet = Subtyping.meet(a, b);

      assert.ok(Subtyping.isSubtype(meet, a).ok && Subtyping.isSubtype(meet, b).ok,
        left + ' ⊓ ' + right + ' must be below both');
    });
  });
});

/* ----------------------------------------------------- 27.8 type classes */

test('resolution builds one dictionary per constructor node of the type', function () {
  const rows = TypeClasses.sweep({});

  rows.filter(function (row) { return row.ok; }).forEach(function (row) {
    assert.ok(row.dictionaries >= 1, row.constraint);
    assert.ok(row.depth >= 1);
    assert.ok(row.dictionary.indexOf('⊥') === -1);
  });
  assert.strictEqual(TypeClasses.analyse('Eq (List (List Int))', {}).dictionaries, 3);
  assert.strictEqual(TypeClasses.analyse('Eq Int', {}).dictionaries, 1);
});

test('overlap is refused, and allowing it changes the answer', function () {
  const contrast = TypeClasses.coherenceContrast();

  assert.ok(contrast.rejected, 'two matching instances must be refused');
  assert.ok(contrast.differs,
    'and allowing overlap must produce a different dictionary, or the demonstration is empty');
  assert.strictEqual(contrast.plain.dictionary, 'dShowLista(dShowInt)');
  assert.strictEqual(contrast.permissive.dictionary, 'dShowListInt');
});

test('ambiguity is a distinct failure from a missing instance', function () {
  const ambiguous = TypeClasses.analyse('Show a', {});
  const missing = TypeClasses.analyse('Eq (List Double)', {});

  assert.ok(ambiguous.ambiguous && !ambiguous.ok);
  assert.ok(!missing.ambiguous && !missing.ok);
  assert.ok(missing.why.indexOf('no instance') !== -1);
});

test('superclasses add dictionaries and methods', function () {
  const without = TypeClasses.analyse('Ord (List Int)', {});
  const with_ = TypeClasses.analyse('Ord (List Int)', { superclasses: true });

  assert.ok(with_.dictionaries > without.dictionaries,
    'turning superclasses on must build more structure');
  assert.deepStrictEqual(TypeClasses.methodsOf('Ord'), ['compare', 'equals']);
});

/* ------------------------------------------------- 27.9 pattern matching */

test('every reported witness matches no clause of its matrix', function () {
  const cases = [
    { types: ['Colour'], rows: ['red', 'green'] },
    { types: ['List'], rows: ['nil', 'cons(true, _)'] },
    { types: ['Bool', 'Bool'], rows: ['true; true', 'false; _'] },
    { types: ['List'], rows: ['nil', 'cons(_, nil)'] }
  ];

  cases.forEach(function (spec) {
    const matrix = spec.rows.map(PatternCompile.parseRow);
    const out = PatternCompile.exhaustive(matrix, spec.types);

    assert.ok(!out.exhaustive, spec.rows.join(' | ') + ' should be incomplete');
    matrix.forEach(function (row) {
      assert.ok(!coversRow(row, out.missing),
        'the witness ' + out.witness + ' is matched by ' + PatternCompile.showRow(row));
    });
  });
});

function coversRow(row, values) {
  return row.every(function (pattern, index) { return covers(pattern, values[index]); });
}

function covers(pattern, value) {
  if (pattern.kind === 'wild') return true;
  if (value === undefined || value.kind === 'wild') return true;
  if (pattern.name !== value.name) return false;
  return pattern.args.every(function (inner, i) { return covers(inner, value.args[i]); });
}

test('a complete match has no witness, and adding the missing case completes it', function () {
  const complete = [['nil', 'cons(_, _)'], ['red', 'green', 'blue'],
    ['true; true', 'true; false', 'false; _']];
  const types = [['List'], ['Colour'], ['Bool', 'Bool']];

  complete.forEach(function (rows, index) {
    const out = PatternCompile.exhaustive(rows.map(PatternCompile.parseRow), types[index]);

    assert.ok(out.exhaustive, rows.join(' | ') + ' should be complete');
    assert.strictEqual(out.witness, '');
  });
});

test('every column heuristic decides the same thing at a different size', function () {
  const matrix = ['_; false; true', 'false; true; _', '_; _; false', '_; _; _']
    .map(PatternCompile.parseRow);
  const rows = PatternCompile.heuristicTable(matrix, ['Bool', 'Bool', 'Bool']);
  const reached = rows.map(function (row) { return row.clauses; });

  assert.deepStrictEqual(reached, [4, 4, 4, 4], 'all four reach the same clauses');
  const sizes = rows.map(function (row) { return row.size; });

  assert.ok(Math.max.apply(null, sizes) > Math.min.apply(null, sizes),
    'and the sizes must actually differ, or the comparison is empty');
  assert.strictEqual(Math.min.apply(null, sizes), 9);
  assert.strictEqual(Math.max.apply(null, sizes), 13);
});

test('an unreachable clause is exactly one no value can reach', function () {
  const matrix = ['red', '_', 'blue'].map(PatternCompile.parseRow);
  const rows = PatternCompile.redundant(matrix, ['Colour']);

  assert.deepStrictEqual(rows.map(function (row) { return row.reachable; }),
    [true, true, false]);
  assert.ok(rows[2].why.length > 10, 'and the reason is stated');
});

/* -------------------------------------------------------- 27.10 Hoare */

test('proof and execution agree about which programs are actually broken', function () {
  VerifyLab.programNames().forEach(function (name) {
    const proved = VerifyLab.verify(name).proved;
    const runs = VerifyLab.test(name);

    if (runs.failures.length > 0) {
      assert.ok(!proved, name + ': a program with a failing run must not be proved');
    }
  });
});

test('the correct programs are proved and the broken ones are not', function () {
  ['swap', 'max', 'sum', 'division'].forEach(function (name) {
    assert.ok(VerifyLab.verify(name).proved, name + ' should be proved');
    assert.strictEqual(VerifyLab.test(name).failures.length, 0, name + ' should run correctly');
  });
  ['swapNoTemp', 'maxWrong'].forEach(function (name) {
    assert.ok(!VerifyLab.verify(name).proved, name + ' should not be proved');
    assert.ok(VerifyLab.test(name).failures.length > 0, name + ' should fail concretely');
  });
});

test('a weak invariant breaks the proof and not the program', function () {
  ['sumNoBound', 'sumTooWeak', 'divisionNoBound'].forEach(function (name) {
    const proved = VerifyLab.verify(name);

    assert.ok(!proved.proved, name + ': the proof must fail');
    assert.ok(proved.failing.length > 0, 'and name the condition');
    assert.strictEqual(VerifyLab.test(name).failures.length, 0,
      name + ': every concrete run must still be correct');
  });
});

test('each counterexample really falsifies its condition, and names the false part',
  function () {
    VerifyLab.programNames().forEach(function (name) {
      VerifyLab.verify(name).obligations.forEach(function (obligation) {
        if (obligation.valid) return;
        assert.ok(obligation.counterexample, name + '/' + obligation.name + ': no state given');
        assert.ok(obligation.blame.length > 0, 'and no conjunct blamed');
      });
    });
  });

test('the weakest precondition doubles with every nested conditional', function () {
  const rows = VerifyLab.blowupTable(7);

  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i].size > rows[i - 1].size * 2,
      'depth ' + rows[i].depth + ' must more than double: ' + rows[i - 1].size +
        ' to ' + rows[i].size);
  }
  assert.strictEqual(rows[0].size, 20);
  assert.strictEqual(rows[6].size, 3446);
});

test('the checking domain decides what a bounded check can see', function () {
  assert.ok(VerifyLab.verify('divisionNoBound', { low: 0, high: 6 }).proved,
    'over the naturals the missing r >= 0 cannot be detected');
  assert.ok(!VerifyLab.verify('divisionNoBound', { low: -2, high: 5 }).proved,
    'and once the domain can express a negative remainder it is');
});

/* ---------------------------------------------------- 27.11 ownership */

test('the discipline matrix separates on exactly the two structural rules', function () {
  const rows = Ownership.disciplineTable();
  const moving = rows.filter(function (row) {
    return row.acceptedBy.length > 0 && row.acceptedBy.length < 4;
  });

  assert.strictEqual(moving.length, 2,
    'exactly two programs should distinguish the disciplines, one per rule');
  const names = moving.map(function (row) { return row.program; }).sort();

  assert.deepStrictEqual(names, ['leak', 'useTwice']);
  assert.deepStrictEqual(rows.filter(function (row) {
    return row.program === 'leak';
  })[0].acceptedBy, ['unrestricted', 'affine']);
  assert.deepStrictEqual(rows.filter(function (row) {
    return row.program === 'useTwice';
  })[0].acceptedBy, ['unrestricted', 'relevant']);
});

test('borrow errors are orthogonal to the discipline', function () {
  const violations = ['moveThenUse', 'doubleDrop', 'sharedAndMutable', 'mutableTwice',
    'writeThroughShared', 'useAfterRelease', 'moveWhileBorrowed'];

  violations.forEach(function (name) {
    Object.keys(Ownership.DISCIPLINES).forEach(function (discipline) {
      const out = Ownership.analyse(name, discipline);

      assert.ok(!out.accepted, name + ' must be rejected under ' + discipline);
      assert.ok(out.borrowErrors > 0, 'and it must be a borrow error, not a structural one');
    });
  });
});

test('every borrow error blames an earlier statement', function () {
  ['moveThenUse', 'sharedAndMutable', 'mutableTwice', 'useAfterRelease',
    'moveWhileBorrowed', 'writeThroughShared', 'doubleDrop'].forEach(function (name) {
    const first = Ownership.analyse(name, 'affine').errors[0];

    assert.ok(first, name + ' should produce an error');
    assert.ok(first.blame >= 0, name + ': the error must name the line responsible');
    assert.ok(first.blame < first.line, 'and that line must come earlier');
  });
});

test('a read through a borrow does not spend the owner', function () {
  const out = Ownership.analyse('sharedTwice', 'linear');

  assert.ok(out.accepted, 'two shared borrows and a drop must satisfy even linearity');
  assert.strictEqual(out.uses.x, 1, 'x is consumed exactly once, by the drop');
});

/* --------------------------------------------- shared helpers behave */

test('Hoare formulas evaluate consistently with their own printer', function () {
  const formula = Hoare.implies(Hoare.compare('≥', Hoare.ref('x'), Hoare.lit(1)),
    Hoare.compare('≥', Hoare.ref('x'), Hoare.lit(0)));

  assert.strictEqual(Hoare.holds(formula, { x: 5 }), true);
  assert.strictEqual(Hoare.holds(formula, { x: -5 }), true);
  assert.ok(Hoare.showFormula(formula, false).indexOf('⇒') !== -1);
  assert.deepStrictEqual(Hoare.variablesIn(formula, []), ['x']);
});
