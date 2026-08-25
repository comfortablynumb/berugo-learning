'use strict';

/**
 * Property tests for the Berugo compiler package (M28).
 *
 * The discipline here is that a claim about a stage is checked by RUNNING it,
 * not by reading it. Five defects in this milestone looked correct in the
 * source and two carried comments arguing they were right; every one was found
 * by execution. So the properties below run things:
 *
 *   - the whole conformance suite through every stage, with the type compared
 *     against the type the spec states;
 *   - every conformance program and its desugaring, both executed and compared
 *     on value, output, outcome and the bindings each leaves behind;
 *   - the round-trip property, and the same corpus through a deliberately
 *     broken printer so the pass has a sensitivity;
 *   - thousands of corrupted files, requiring a tree and a usable span from
 *     every one;
 *   - each capture and short-circuit trap, kept runnable rather than recorded
 *     as an anecdote.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Lexer = require(path.join(BERUGO, 'lexer.js'));
const Ast = require(path.join(BERUGO, 'ast.js'));
const Parser = require(path.join(BERUGO, 'parser.js'));
const Resolve = require(path.join(BERUGO, 'resolve.js'));
const Typecheck = require(path.join(BERUGO, 'typecheck.js'));
const Desugar = require(path.join(BERUGO, 'desugar.js'));
const Diagnostics = require(path.join(BERUGO, 'diagnostics.js'));
const Interp = require(path.join(BERUGO, 'interp.js'));
const Ide = require(path.join(BERUGO, 'ide.js'));
const Fuzz = require(path.join(BERUGO, 'fuzz.js'));
const Pipeline = require(path.join(BERUGO, 'pipeline.js'));

/* ----------------------------------------------------------------- the spec */

test('spec: every feature is covered by a conformance program', function () {
  const gaps = Spec.coverage().filter(function (row) { return !row.covered; });

  assert.deepStrictEqual(gaps.map(function (row) { return row.feature; }), [],
    'a feature nothing runs is a feature nobody has checked — modules were implemented in ' +
    'two stages and exercised by zero programs until the coverage column said so');
});

test('spec: every stage this milestone claims has a section', function () {
  Spec.STAGES.filter(function (stage) { return stage.milestone === 'M28'; })
    .forEach(function (stage) {
      assert.ok(stage.section, stage.id + ' names no section');
      assert.ok(/^28\.\d$/.test(stage.section), stage.id + ' has a malformed section number');
    });
});

test('spec: every non-goal names a reason and a destination', function () {
  assert.ok(Spec.NON_GOALS.length >= 3);
  Spec.NON_GOALS.forEach(function (goal) {
    assert.ok(goal.why, goal.id + ' has no reason');
    assert.ok(goal.deferredTo, goal.id + ' has no destination');
  });
});

/* ---------------------------------------------------------------- the lexer */

test('lexer: every character of a file is reachable from the token stream', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    const out = Lexer.lex(program.source);
    let covered = 0;

    out.tokens.forEach(function (token) {
      (token.trivia || []).forEach(function (piece) { covered += piece.end - piece.start; });
      covered += token.end - token.start;
    });
    assert.strictEqual(covered, program.source.length,
      program.id + ': trivia plus tokens must account for the whole file, which is the ' +
      'property a formatter needs');
  });
});

test('lexer: a malformed literal is an error token and scanning continues', function () {
  const out = Lexer.lex('let s = "oops;\nlet n = 1.2.3;\nlet q = 0x1;\nlet ok = 1 + 2;');
  const errors = out.tokens.filter(function (token) { return token.kind === 'error'; });

  assert.strictEqual(errors.length, 3, 'three malformed literals, three error tokens');
  errors.forEach(function (token) {
    const index = out.tokens.indexOf(token);

    assert.ok(out.tokens[index + 1], 'every error token is followed by another token');
    assert.notStrictEqual(out.tokens[index + 1].kind, 'error',
      'and the token after it is real — which is what "scanning continued" means');
  });
  assert.ok(out.tokens.some(function (token) { return token.kind === 'number'; }),
    'the good line still scans');
});

test('lexer: a numeral running into an identifier is one error, not a valid split', function () {
  [['0x1', 3], ['1abc', 4], ['1e', 2], ['1.2.3', 5]].forEach(function (pair) {
    const out = Lexer.lex('let n = ' + pair[0] + ';');
    const token = out.tokens[3];

    assert.strictEqual(token.kind, 'error', pair[0] + ' must be one error token');
    assert.strictEqual(token.end - token.start, pair[1],
      pair[0] + ' must span all ' + pair[1] + ' characters — maximal munch alone gives two ' +
      'valid tokens and the parser then complains several tokens to the right');
  });
  ['42', '3.5', '1_000_000', '1_000.5e2', '2e-3'].forEach(function (text) {
    assert.strictEqual(Lexer.lex('let n = ' + text + ';').tokens[3].kind, 'number',
      text + ' is well formed');
  });
});

test('lexer: an incremental relex agrees with a full rescan', function () {
  const source = 'let a = 1; let b = 2; let c = a + b;';
  const previous = Lexer.lex(source);

  [3, 11, 19, 30].forEach(function (at) {
    const out = Lexer.relex(previous, { start: at, end: at + 1, text: 'x' });
    const full = Lexer.lex(out.source);

    assert.strictEqual(out.tokens.length, full.tokens.length,
      'an incremental lexer that drifts is worse than none');
    assert.ok(out.reused <= out.total, 'the reuse count cannot exceed the token count');
    assert.ok(out.rescannedFrom <= at, 'the safe boundary is at or before the edit');
  });
});

/* --------------------------------------------------------------- the parser */

test('parser: every node of every conformance program has a usable span', function () {
  Spec.CONFORMANCE.concat(Spec.ERROR_SUITE).forEach(function (program) {
    const tree = Parser.parse(program.source).tree;

    Ast.visit(tree, { enter: function (node) {
      assert.ok(node.span, program.id + ': ' + node.kind + ' has no span');
      assert.strictEqual(typeof node.span.start, 'number',
        program.id + ': ' + node.kind + ' has no span start');
      assert.strictEqual(typeof node.span.end, 'number',
        program.id + ': ' + node.kind + ' has no span END — a span with no extent underlines ' +
        'nothing and crashes nothing, so nobody notices');
      assert.ok(node.span.end >= node.span.start && node.span.end <= program.source.length,
        program.id + ': ' + node.kind + ' has a span outside the source');
    } });
  });
});

test('parser: the printer removes brackets the tree does not need', function () {
  const cases = [
    ['1 + (2 * 3)', '1 + 2 * 3'], ['((1)) + 2', '1 + 2'],
    ['1 - (2 - 3)', '1 - (2 - 3)'], ['1 - 2 - 3', '1 - 2 - 3'],
    ['1 + 2 * 3', '1 + 2 * 3']
  ];

  cases.forEach(function (pair) {
    const value = Parser.parse('let v = ' + pair[0] + ';').tree.items[0].value;

    assert.strictEqual(Ast.print(value), pair[1],
      pair[0] + ' must print as ' + pair[1] + ' — minimal, not merely faithful');
  });
});

test('parser: every operator is left associative, encoded by the power difference', function () {
  Object.keys(Ast.PRECEDENCE).forEach(function (op) {
    const powers = Ast.PRECEDENCE[op];

    assert.strictEqual(powers.right, powers.left + 1,
      op + ': the right power must be exactly one more than the left, which is what makes it ' +
      'left associative');
  });
});

/* --------------------------------------------------------------- resolution */

test('resolve: shadowing gives two bindings for one spelling', function () {
  const source = 'let a = 1;\nfn f(a) {\n  let b = a + 1;\n  return fn(n) => n * b;\n}\n'
    + 'let b = f(a);\nlet c = a + b(2);';
  const table = Resolve.resolve(Parser.parse(source).tree);
  const byName = {};

  table.references.forEach(function (entry) {
    byName[entry.binding.name] = byName[entry.binding.name] || new Set();
    byName[entry.binding.name].add(entry.binding);
  });
  assert.strictEqual(byName.a.size, 2, 'a means two different things');
  assert.strictEqual(byName.b.size, 2, 'and so does b');
  assert.strictEqual(Resolve.summary(table).captured, 1, 'the lambda captures one binding');
});

test('resolve: a suggestion is withheld beyond three edits', function () {
  const table = Resolve.resolve(Parser.parse(
    'let value = 1;\nlet total = 0;\nlet z = valu + totl;\nlet w = accumulator;').tree);
  const errors = table.errors.filter(function (entry) {
    return entry.code === 'E-RESOLVE-UNBOUND';
  });

  assert.strictEqual(errors.length, 3, 'three unresolved names');
  assert.strictEqual(errors[0].suggestion, 'value', 'valu is one edit from value');
  assert.strictEqual(errors[1].suggestion, 'total', 'totl is one edit from total');
  assert.strictEqual(errors[2].suggestion, null,
    'accumulator is close to nothing, and a guess four edits away is the compiler thinking ' +
    'out loud rather than helping');
});

/* --------------------------------------------------------------------- IDE */

test('ide: rename touches one binding and refuses when a name would change meaning', function () {
  const source = 'let a = 1;\nfn f(a) {\n  let b = a + 1;\n  return b;\n}\nlet b = f(a);';

  const parameter = Ide.rename(source, 16, 'p');
  assert.ok(parameter.ok, 'renaming the parameter is allowed');
  assert.strictEqual(parameter.touched, 2, 'and it touches exactly the two inner occurrences');
  assert.ok(parameter.source.indexOf('let a = 1;') === 0, 'leaving the outer a alone');

  /* Two refusals with two different causes, because either check alone
     accepts a rename it should not. This one keeps the reference structure
     identical — the references still resolve by position — and introduces a
     second `let b` in one scope, which only the error comparison sees. */
  const collide = Ide.rename(source, 4, 'b');
  assert.strictEqual(collide.ok, false, 'renaming the outer a to b must be refused');
  assert.ok(/twice in one scope/.test(collide.why),
    'and the reason is the clash, not a change of meaning: ' + collide.why);

  /* This one changes what a name refers to, which the structure check sees
     and the error comparison would not — the renamed program has no new
     resolution error at all. */
  const captured = Ide.rename('let a = 1;\nfn f() {\n  let b = 2;\n  return a + b;\n}', 4, 'b');
  assert.strictEqual(captured.ok, false, 'renaming a to b must be refused here too');
  assert.ok(/refers to/.test(captured.why),
    'and here the reason is the capture: ' + captured.why);

  const keyword = Ide.rename(source, 4, 'let');
  assert.strictEqual(keyword.ok, false, 'a keyword is not a valid identifier');
});

test('ide: renaming a function does not rewrite the fn keyword', function () {
  const source = 'let a = 1;\nfn f(x) { return x; }\nlet b = f(a);';
  const out = Ide.rename(source, 14, 'compute');

  assert.ok(out.ok, 'renaming f is allowed');
  assert.ok(out.source.indexOf('fn compute(x)') !== -1,
    'a text search for f inside "fn f(x)" finds the f of fn, renames that, and produces a ' +
    'file that no longer parses — the name span has to come from the token stream');
  assert.strictEqual(out.touched, 2, 'the declaration and the one call');
});

/* --------------------------------------------------------------- the checker */

test('typecheck: every conformance program infers exactly the type the spec states', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    const typed = Typecheck.typecheck(Parser.parse(program.source).tree);

    assert.strictEqual(typed.errors.length, 0, program.id + ' must check cleanly');
    assert.strictEqual(typed.last, program.expect,
      program.id + ': asserting the exact type is what makes this a test — a checker that ' +
      'inferred Number for everything would pass a weaker version on most of these');
  });
});

test('typecheck: a let inside a function body does not crash the checker', function () {
  /* No conformance program had one for the whole build, and the checker
     crashed on every such program while fifteen rows stayed green. */
  const sources = [
    'fn f(a) { let b = a + 1; return b; }',
    'fn f(a) { let b = a; let c = b; return c; }',
    'fn counter(s) { let step = 2; return fn(n) => n * step + s; } let up = counter(1);'
  ];

  sources.forEach(function (source) {
    const typed = Typecheck.typecheck(Parser.parse(source).tree);

    assert.strictEqual(typed.errors.length, 0, source + ' must check cleanly');
  });
});

test('typecheck: a failed check records the actual type, not the expectation', function () {
  const parsed = Parser.parse('let n = 1;\nlet flag = true;\nlet bad = n + flag;');
  const typed = Typecheck.typecheck(parsed.tree);
  const flags = Ast.collect(parsed.tree, function (node) {
    return node.kind === 'name' && node.name === 'flag';
  });

  assert.ok(flags.length, 'the reference exists');
  assert.strictEqual(typed.typeOf(flags[0]), 'Bool',
    'recording the expectation would make hover report Number for a Bool, and the type table ' +
    'is read by other tools');
});

test('typecheck: a mismatch carries both spans', function () {
  Spec.ERROR_SUITE.filter(function (program) {
    return program.stage === 'typecheck' && program.code !== 'E-TYPE-EXHAUSTIVE';
  }).forEach(function (program) {
    const typed = Typecheck.typecheck(Parser.parse(program.source).tree);
    const first = typed.errors[0];

    assert.ok(first, program.id + ' must report something');
    assert.ok(first.span && typeof first.span.end === 'number',
      program.id + ' must carry a primary span with an extent');
    assert.ok(first.related, program.id + ' must name what imposed the expectation');
  });
});

/* -------------------------------------------------------------- desugaring */

test('desugar: the surface program and its core agree on every conformance program', function () {
  let observations = 0;

  Spec.CONFORMANCE.forEach(function (program) {
    const outcome = Interp.compareWithCore(program.source);

    assert.ok(outcome.ok, program.id + ' must parse');
    assert.ok(outcome.agree, program.id + ': ' + outcome.why);
    observations += outcome.observed;
  });
  assert.ok(observations >= 30,
    'a suite agreeing on zero observations agrees about nothing: every conformance program ' +
    'returns unit, so the comparison has to include the bindings each leaves behind — it made ' +
    observations + ' observations');
});

test('desugar: the three capture and short-circuit traps all agree now', function () {
  const traps = [
    ['fn add(a, b) { return a * b; }\nlet s = add(3, 4) + 1;', 's = 13'],
    ['fn len(x) { return 99; }\nlet t = 0;\nfor v in [1, 2, 3] { t = t + v; }', 't = 6'],
    ['let d = 0;\nlet safe = d != 0 && 10 / d > 1;', 'safe = false'],
    ['let x = true || (1 / 0 == 0);', 'x = true'],
    ['let t = 0;\nfor v in [1, 2, 3, 4] { if v == 2 { continue; } else {}; t = t + v; }', 't = 8'],
    ['let t = 0;\nfor v in [1, 2, 3, 4] { if v == 3 { break; } else {}; t = t + v; }', 't = 3']
  ];

  traps.forEach(function (trap) {
    const outcome = Interp.compareWithCore(trap[0]);

    assert.ok(outcome.agree, trap[0] + ': ' + outcome.why);
    assert.ok(outcome.surface.bindings.indexOf(trap[1]) !== -1,
      trap[0] + ' must leave ' + trap[1] + ', got ' + outcome.surface.bindings.join('; '));
  });
});

test('desugar: every name a lowering introduces is unusable as a source identifier', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    const lowered = Desugar.desugar(Parser.parse(program.source).tree);
    const declared = Ast.collect(lowered.core, function (node) {
      return node.origin !== undefined && (node.kind === 'letDecl' || node.kind === 'name');
    });
    const surface = new Set(Ast.collect(Parser.parse(program.source).tree, function (node) {
      return node.kind === 'name' || node.kind === 'letDecl' || node.kind === 'fnDecl';
    }).map(function (node) { return node.name; }));

    declared.forEach(function (node) {
      if (!node.name || surface.has(node.name)) return;
      assert.strictEqual(node.name.charAt(0), '$',
        program.id + ': the lowering introduced "' + node.name + '", which a user program ' +
        'could also bind — a convention makes collision unlikely, a lexer rule makes it ' +
        'impossible');
    });
  });
});

test('desugar: every synthesised node carries the origin span', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    const lowered = Desugar.desugar(Parser.parse(program.source).tree);
    const audit = Desugar.spanAudit(lowered.core, program.source);

    assert.deepStrictEqual(audit.problems, [],
      program.id + ': a synthesised node with no origin produces a message about code the ' +
      'developer never wrote');
  });
});

/* ------------------------------------------------------------- diagnostics */

test('diagnostics: every error program produces exactly one, with the stated code', function () {
  const suite = Pipeline.errorSuite();

  suite.rows.forEach(function (row) {
    assert.strictEqual(row.reported, 1,
      row.id + ' reported ' + row.reported + ' diagnostics for one mistake');
    assert.strictEqual(row.got, row.expected, row.id + ' reported the wrong code');
  });
  assert.ok(suite.raw > suite.reported,
    'the suppression rules must actually remove something, or they are untested: ' +
    suite.raw + ' raw against ' + suite.reported + ' reported');
});

test('diagnostics: every dropped diagnostic is kept with the rule that removed it', function () {
  const parsed = Parser.parse('let s = "oops;\nlet n = valu + 1;\nlet b = 1 + true;');
  const table = Resolve.resolve(parsed.tree);
  const typed = Typecheck.typecheck(parsed.tree);
  const raw = Diagnostics.collect({ parse: parsed.errors, resolve: table.errors,
    typecheck: typed.errors });
  const out = Diagnostics.suppress(raw);

  assert.strictEqual(out.kept.length + out.dropped.length, raw.length, 'nothing is lost');
  out.dropped.forEach(function (entry) {
    assert.ok(['stage', 'contained', 'duplicate'].indexOf(entry.droppedBy) !== -1,
      'every drop names its rule — suppression you cannot inspect is indistinguishable from ' +
      'a compiler that failed to notice');
  });
  assert.ok(Diagnostics.suppress(raw, { gate: false }).kept.length > out.kept.length,
    'turning a rule off must report more');
});

test('diagnostics: every offered fix removes the diagnostic it was offered for', function () {
  const suite = Pipeline.fixSuite();

  assert.ok(suite.offered >= 3, 'at least three fixes are offered');
  suite.rows.forEach(function (row) {
    assert.ok(row.removed, row.id + ": the fix did not remove its own diagnostic");
  });
  assert.ok(suite.clean < suite.offered,
    'and "file clean" must be reported separately, because a source can hold two mistakes — ' +
    'conflating them would mark a correct fix as a failure');
});

test('diagnostics: every code a stage emits is in the catalogue', function () {
  const seen = new Set();

  Spec.ERROR_SUITE.concat(Spec.CONFORMANCE).forEach(function (program) {
    Pipeline.run(program.source).raw.forEach(function (entry) { seen.add(entry.code); });
  });
  seen.forEach(function (code) {
    assert.ok(Diagnostics.CATALOGUE[code],
      code + ' has no catalogue entry, so its message carries no rule for a reader who has ' +
      'not met it before');
  });
});

/* ---------------------------------------------------------------- pipeline */

test('pipeline: every stage is a pure function of its input', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    const out = Pipeline.purity(program.source);

    assert.deepStrictEqual(out.differing, [],
      program.id + ': these stages differ on a second run, which means one of them carried ' +
      'state — a module-level counter for fresh type variables is the classic');
    assert.strictEqual(out.stages, 5, 'all five artefacts are fingerprinted');
  });
});

test('pipeline: the whole suite passes every criterion at once', function () {
  const summary = Pipeline.summary();

  assert.strictEqual(summary.conformance, Spec.CONFORMANCE.length + '/' + Spec.CONFORMANCE.length);
  assert.strictEqual(summary.errors, Spec.ERROR_SUITE.length + '/' + Spec.ERROR_SUITE.length);
  assert.ok(summary.cascade > 0, 'the suppression rules removed ' + summary.cascade);
  assert.ok(summary.ok, 'the summary reports a failure');
});

/* --------------------------------------------------------------- properties */

test('fuzz: the round-trip property holds over ten thousand generated programs', function () {
  const sweep = Fuzz.roundTripSweep({ count: 10000, seed: 1 });

  assert.strictEqual(sweep.failures.length, 0,
    sweep.failures.length ? sweep.failures[0].why + ' on ' + sweep.failures[0].source : '');
  assert.strictEqual(sweep.checked, 10000);
});

test('fuzz: the property catches a deliberately broken printer', function () {
  const out = Fuzz.sabotage({ count: 2000, seed: 1 });

  assert.strictEqual(out.honest.failures.length, 0, 'the real printer round-trips everything');
  assert.ok(out.caught > 0,
    'zero failures against correct code is equally consistent with a working property and a ' +
    'generator that never produced anything hard — the broken printer is what separates them');
  assert.ok(out.caught < out.broken.checked,
    'and a sabotage that fails everything is too coarse to locate anything');
  assert.ok(out.detects, 'the property must detect the break and not the honest printer');
});

test('fuzz: the parser is total and keeps every span inside the file', function () {
  const out = Fuzz.fuzzParser({ count: 10000, seed: 7 });

  assert.deepStrictEqual(out.crashes.slice(0, 3), [], 'a corrupted file must still yield a tree');
  assert.deepStrictEqual(out.lostSpans.slice(0, 3), [],
    'a span outside its own source underlines nothing and crashes nothing, so it needs its ' +
    'own assertion');
  assert.strictEqual(out.parsed, 10000, 'every mutant parsed');
  assert.ok(out.withErrors > out.checked * 0.5,
    'most mutants must actually be broken, or the fuzzer is corrupting whitespace');
  assert.ok(out.withErrors < out.checked,
    'and some must not, because a corruption can leave a valid program');
});

test('fuzz: the surface and the core agree over two thousand generated programs', function () {
  const out = Fuzz.differential({ count: 2000, seed: 11 });

  assert.deepStrictEqual(out.failures.slice(0, 3), []);
  assert.strictEqual(out.ran + out.budget, 2000, 'every program is accounted for');
  assert.strictEqual(out.budget, 0,
    'a suite whose failures are all "did not finish" is testing the budget: the generator ' +
    'writes its own loop counters so every program terminates');
});

test('interp: the three outcomes are kept apart', function () {
  const ok = Interp.run('let a = 1 + 1;');
  const runtime = Interp.run('let a = 1 / 0;');
  const budget = Interp.run('let i = 0; while true { i = i + 1; }', { budget: 500 });

  assert.strictEqual(ok.outcome, 'ok');
  assert.strictEqual(runtime.outcome, 'runtime', 'a fault is a runtime outcome');
  assert.strictEqual(budget.outcome, 'budget',
    'a program that did not finish is a different fact from one that crashed, and collapsing ' +
    'them makes a hang look like a bug');
  assert.strictEqual(Interp.run('let a = ;').outcome, 'parse');
});
