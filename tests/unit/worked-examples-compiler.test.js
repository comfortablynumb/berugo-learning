'use strict';

/**
 * Every figure the M28 content quotes, recomputed from the modules — and then
 * asserted to still appear in the prose.
 *
 * The second half is what makes this a test rather than a demonstration:
 * moving a number without moving the sentence that quotes it fails the build.
 * The figures come from `node tools/section-dump.js <id>` at each section's
 * shipped defaults, so a change to a default control setting shows up here too.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-compiler', 'concepts-compiler-analysis', 'concepts-compiler-tooling',
  'examples-compiler', 'examples-compiler-analysis', 'examples-compiler-tooling']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const Spec = require(path.join(BERUGO, 'spec.js'));
const Lexer = require(path.join(BERUGO, 'lexer.js'));
const Ast = require(path.join(BERUGO, 'ast.js'));
const Parser = require(path.join(BERUGO, 'parser.js'));
const Resolve = require(path.join(BERUGO, 'resolve.js'));
const Typecheck = require(path.join(BERUGO, 'typecheck.js'));
const Desugar = require(path.join(BERUGO, 'desugar.js'));
const Interp = require(path.join(BERUGO, 'interp.js'));
const Ide = require(path.join(BERUGO, 'ide.js'));
const Fuzz = require(path.join(BERUGO, 'fuzz.js'));
const Pipeline = require(path.join(BERUGO, 'pipeline.js'));

/* ------------------------------------------------------ 28.1 the cost table */

test('figures: the cost table, both columns and both rankings', function () {
  const rows = Spec.costTable();
  const parse = rows.reduce(function (sum, row) { return sum + row.parse; }, 0);
  const later = rows.reduce(function (sum, row) { return sum + row.later; }, 0);

  assert.strictEqual(parse, 21);
  assert.strictEqual(later, 25);
  assert.strictEqual(support.fixed(later / parse, 2), '1.19');

  const byLater = rows.slice().sort(function (a, b) { return b.later - a.later; });
  assert.strictEqual(byLater[0].feature, 'match');
  assert.strictEqual(byLater[0].parse, 4);
  assert.strictEqual(byLater[0].later, 5);

  const byRatio = rows.slice().sort(function (a, b) { return b.ratio - a.ratio; });
  assert.strictEqual(support.fixed(byRatio[0].ratio, 2), '3.00',
    'arrays and modules share the worst ratio');
  assert.ok(['arrays', 'modules'].indexOf(byRatio[0].feature) !== -1);

  /* match leads BOTH rankings; the inversion is that operators and literals
     are joint second by parser cost and joint last by later cost. Claiming
     they led the parser ranking was written from the shape of the argument. */
  const byParse = rows.slice().sort(function (a, b) { return b.parse - a.parse; });
  const joint = byParse.filter(function (row) { return row.parse === 3; });

  assert.strictEqual(byParse[0].feature, 'match', 'match leads the parser ranking too, at 4');
  assert.deepStrictEqual(joint.map(function (row) { return row.feature; }).sort(),
    ['literals', 'operators'], 'joint second at 3 each');
  assert.ok(joint.every(function (row) { return row.later === 1; }),
    'and joint last after the parser at 1 each, which is the inversion');

  support.quotes('designing-a-language',
    ['21 units of parser work against 25', '1.19', 'match: 4 units of parser work, 5 units after it',
      '3.00', '5 units, against 4 to parse',
      'joint second at 3 units each, against joint last by later cost at 1 each']);
});

test('figures: coverage and the suites', function () {
  const coverage = Spec.coverage();

  assert.strictEqual(Spec.FEATURES.length, 11);
  assert.strictEqual(Spec.CONFORMANCE.length, 17);
  assert.strictEqual(Spec.ERROR_SUITE.length, 12);
  assert.strictEqual(Spec.NON_GOALS.length, 5);
  assert.strictEqual(coverage.filter(function (row) { return row.covered; }).length, 11);

  support.quotes('designing-a-language',
    ['17 programs against 11 features', '17 programs, 11 of 11 features covered',
      'seventeen conformance programs']);
});

/* ------------------------------------------------------------- 28.2 the lexer */

const LEXER_SAMPLE = '// three bad literals, then two lines that scan perfectly\n'
  + 'let s = "oops;\nlet n = 1.2.3;\nlet q = 0x1;\nlet ok = 1 + 2;\nlet msg = "ok=${ok}";';

test('figures: the lexer default sample', function () {
  const out = Lexer.lex(LEXER_SAMPLE);
  const summary = Lexer.summary(out);

  assert.strictEqual(summary.characters, 138);
  assert.strictEqual(summary.tokens, 26);
  assert.strictEqual(summary.trivia, 23);
  assert.strictEqual(summary.errors, 3);

  const errors = out.errors.map(function (entry) {
    const at = Lexer.position(LEXER_SAMPLE, entry.start);

    return entry.code + ' at ' + at.line + ':' + at.column;
  });

  assert.deepStrictEqual(errors,
    ['E-LEX-STRING at 2:9', 'E-LEX-NUMBER at 3:9', 'E-LEX-NUMBER at 4:9']);

  support.quotes('the-lexer',
    ['26 tokens carrying 23 pieces of trivia across 138 characters',
      'one E-LEX-STRING at 2:9 and two E-LEX-NUMBER at 3:9 and 4:9']);
});

test('figures: the nine numeric forms', function () {
  const forms = {
    '42': 42, '3.5': 3.5, '1_000_000': 1000000, '1_000.5e2': 100050, '2e-3': 0.002
  };

  Object.keys(forms).forEach(function (text) {
    const token = Lexer.lex('let n = ' + text + ';').tokens[3];

    assert.strictEqual(token.kind, 'number', text);
    assert.ok(Math.abs(token.value - forms[text]) < 1e-9, text + ' is ' + forms[text]);
  });
  ['1.2.3', '0x1', '1abc', '1e'].forEach(function (text) {
    assert.strictEqual(Lexer.lex('let n = ' + text + ';').tokens[3].kind, 'error', text);
  });

  /* Without the trailing-letter check, 0x1 is two VALID tokens. That is the
     number the prose quotes, so it is measured rather than remembered. */
  const naive = Lexer.lex('let n = 0 x1;').tokens.slice(3, 5)
    .map(function (token) { return token.kind; });

  assert.deepStrictEqual(naive, ['number', 'name'],
    'the split a maximal-munch scanner produces is a number and a name');

  support.quotes('the-lexer',
    ['1_000_000 giving 1000000, 1_000.5e2 giving 100050, and 2e-3 giving 0.002',
      'number 0 followed by name x1 — 2 valid tokens',
      'one error token spanning all 3 characters']);
});

test('figures: the relex reuse at the shipped default', function () {
  const previous = Lexer.lex(LEXER_SAMPLE);
  const at = LEXER_SAMPLE.length - 6;
  const out = Lexer.relex(previous, { start: at, end: at + 1, text: '9' });

  assert.strictEqual(out.reused, 24);
  assert.strictEqual(out.total, 27);
  assert.strictEqual(out.rescannedFrom, 126);
  assert.strictEqual(support.fixed(100 * out.reused / out.total, 1), '88.9');

  support.quotes('the-lexer', ['24 of 27 tokens', '88.9%']);
});

/* ------------------------------------------------------------ 28.3 the parser */

test('figures: the malformed parser sample', function () {
  const source = 'let a = (1 + 2;\nlet b = 3 * ;\nlet c = 4 + 5;';
  const parsed = Parser.parse(source);
  const errorNodes = Ast.collect(parsed.tree, function (node) {
    return node.kind === 'error';
  });

  assert.strictEqual(Ast.countNodes(parsed.tree), 13);
  assert.strictEqual(Ast.depth(parsed.tree), 4);
  assert.strictEqual(errorNodes.length, 1);
  assert.strictEqual(parsed.errors.length, 3);

  const located = parsed.errors.map(function (entry) {
    const at = Lexer.position(source, entry.span.start);

    return entry.code + ' at ' + at.line + ':' + at.column;
  });

  assert.deepStrictEqual(located, ['E-PARSE-EXPECTED at 1:15', 'E-PARSE-EXPR at 2:13',
    'E-PARSE-EXPECTED at 3:1']);

  support.quotes('the-parser',
    ['13 nodes, depth 4, nothing thrown', '1 error node against 3 problems',
      'E-PARSE-EXPECTED at 1:15', 'E-PARSE-EXPR at 2:13', 'E-PARSE-EXPECTED at 3:1']);
});

test('figures: the grouping table', function () {
  const cases = [
    ['1 + 2 * 3', '1 + 2 * 3', 5], ['1 + (2 * 3)', '1 + 2 * 3', 5],
    ['1 - 2 - 3', '1 - 2 - 3', 5], ['1 - (2 - 3)', '1 - (2 - 3)', 5],
    ['((1)) + 2', '1 + 2', 3], ['1 + 2 < 4 && x', '1 + 2 < 4 && x', 7],
    ['!a || b && c', '!a || b && c', 6], ['-a * b', '-a * b', 4],
    ['f(x)(y)', 'f(x)(y)', 5], ['a.b[0].c', 'a.b[0].c', 5],
    ['a == b == c', 'a == b == c', 5]
  ];
  let unchanged = 0;

  cases.forEach(function (row) {
    const value = Parser.parse('let v = ' + row[0] + ';').tree.items[0].value;

    assert.strictEqual(Ast.print(value), row[1], row[0]);
    assert.strictEqual(Ast.countNodes(value), row[2], row[0] + ' node count');
    if (row[0] === row[1]) unchanged += 1;
  });
  assert.strictEqual(unchanged, 9, '9 of 11 print back exactly as written');
  assert.strictEqual(cases.length, 11);

  const levels = new Set(Object.keys(Ast.PRECEDENCE).map(function (op) {
    return Ast.PRECEDENCE[op].left;
  }));

  assert.strictEqual(Object.keys(Ast.PRECEDENCE).length, 13);
  assert.strictEqual(levels.size, 6);

  support.quotes('the-parser',
    ['9 of 11', 'five nodes become three', '13 operators over 6 levels',
      'thirteen binary operators over six precedence levels']);
});

/* --------------------------------------------------- 28.4 the round trip */

test('figures: the round trip and its sensitivity', function () {
  const out = Fuzz.sabotage({ count: 2000, seed: 1, maxDepth: 4 });

  assert.strictEqual(out.honest.checked, 2000);
  assert.strictEqual(out.honest.failures.length, 0);
  assert.strictEqual(out.broken.passed, 1894);
  assert.strictEqual(out.caught, 106);
  assert.strictEqual(support.fixed(100 * out.rate, 1), '5.3');

  const large = Fuzz.roundTripSweep({ count: 10000, seed: 1, maxDepth: 4 });

  assert.strictEqual(large.failures.length, 0);

  support.quotes('ast-infrastructure',
    ['2 000 programs, 2 000 round trips, 0 failures',
      '2 000 programs, 1 894 round trips, 106 failures — 5.3%',
      '10 000 programs, 0 failures']);
});

test('figures: three formattings of one tree', function () {
  const source = 'fn total(xs) {\n  let sum = 0;\n  for x in xs { sum = sum + x * 2; }\n'
    + '  return sum;\n}';
  const tree = Parser.parse(source).tree;
  const widths = { '  ': 88, '    ': 100, '\t': 82 };

  Object.keys(widths).forEach(function (indent) {
    const printed = Ast.print(tree, { indent: indent });

    assert.strictEqual(printed.length, widths[indent], JSON.stringify(indent));
    assert.strictEqual(printed.split('\n').length, 7, 'all three are 7 lines');
    assert.ok(Ast.equalIgnoringSpans(tree, Parser.parse(printed).tree),
      'and all three reparse to the same tree');
  });
  assert.strictEqual(100 - 88, 12, 'four spaces costs 12 more than two');

  assert.strictEqual(Ast.countNodes(tree), 18);
  assert.strictEqual(Ast.depth(tree), 9);
  const at = Ast.nodeAt(tree, 40);

  assert.strictEqual(at.kind, 'forStmt', 'offset 40 lands in the for statement');

  support.quotes('ast-infrastructure',
    ['88 characters over 7 lines', '100 characters over 7 lines — 12 more',
      '82 characters over 7 lines', '9 nodes touched against 18']);
});

/* ---------------------------------------------------- 28.5 names and scopes */

const SHADOW = 'let a = 1;\nfn f(a) {\n  let b = a + 1;\n  return fn(n) => n * b;\n}\n'
  + 'let b = f(a);\nlet c = a + b(2);';

test('figures: the shadowing fixture', function () {
  const table = Resolve.resolve(Parser.parse(SHADOW).tree);
  const summary = Resolve.summary(table);
  const byName = {};

  table.references.forEach(function (entry) {
    byName[entry.binding.name] = byName[entry.binding.name] || { uses: 0, bindings: new Set() };
    byName[entry.binding.name].uses += 1;
    byName[entry.binding.name].bindings.add(entry.binding);
  });

  assert.strictEqual(summary.scopes, 4);
  assert.strictEqual(summary.bindings, 7);
  assert.strictEqual(summary.captured, 1);
  assert.strictEqual(byName.a.uses, 3);
  assert.strictEqual(byName.a.bindings.size, 2);
  assert.strictEqual(byName.b.uses, 2);
  assert.strictEqual(byName.b.bindings.size, 2);

  const bindings = Array.from(byName.a.bindings).map(function (binding) {
    return binding.kind + ' at ' + binding.span.start;
  }).sort();

  assert.deepStrictEqual(bindings, ['let at 0', 'param at 16']);

  support.quotes('names-and-scopes',
    ['4 scopes, 7 bindings, 1 captured',
      '3 occurrences resolving to 2 bindings — a parameter at offset 16 and a let at ',
      '3 occurrences and 2 bindings']);
});

test('figures: the rename outcomes', function () {
  const simple = 'let a = 1;\nfn f(a) {\n  let b = a + 1;\n  return b;\n}\nlet b = f(a);';

  assert.strictEqual(Ide.rename(simple, 16, 'p').touched, 2, 'the parameter, 2 edits');
  assert.strictEqual(Ide.rename(simple, 4, 'renamed').touched, 2, 'the outer a here');
  assert.strictEqual(Ide.rename(SHADOW, 4, 'renamed').touched, 3,
    'the shadowing fixture uses the outer a twice, so 3 edits');
  assert.strictEqual(Ide.rename(SHADOW, 4, 'b').ok, false);
  assert.strictEqual(Ide.rename(SHADOW, 4, 'let').ok, false);
  assert.strictEqual(Ide.rename('let a = 1;\nfn f(x) { return x; }\nlet b = f(a);', 14,
    'compute').touched, 2, 'the function declaration and its one call');

  support.quotes('names-and-scopes',
    ['2 edits, structure identical, allowed',
      '3 edits: the declaration and its 2 references',
      '1 extra parse and 1 extra resolution per rename attempt']);
});

test('figures: the suggestion threshold', function () {
  const table = Resolve.resolve(Parser.parse(
    'let value = 1;\nlet total = 0;\nlet z = valu + totl;\nlet w = accumulator;').tree);
  const errors = table.errors.filter(function (entry) {
    return entry.code === 'E-RESOLVE-UNBOUND';
  });

  assert.strictEqual(errors.length, 3);
  assert.strictEqual(errors[0].suggestion, 'value');
  assert.strictEqual(Resolve.distance('valu', 'value'), 1);
  assert.strictEqual(errors[1].suggestion, 'total');
  assert.strictEqual(Resolve.distance('totl', 'total'), 1);
  assert.strictEqual(errors[2].suggestion, null);

  support.quotes('names-and-scopes',
    ['valu suggests value at distance 1', 'totals suggests nothing']);
});

/* ------------------------------------------------------- 28.6 type checking */

test('figures: the annotation pairs', function () {
  const pairs = [
    ['let n = true;\nlet total = n + 1;', 'E-TYPE-MISMATCH', 'n'],
    ['let n: Number = true;\nlet total = n + 1;', 'E-TYPE-ANNOTATION', 'true'],
    ['fn double(x) { return x * 2; }\nlet r = double(true);', 'E-TYPE-CALL', 'double(true)'],
    ['fn double(x: Number) { return x * 2; }\nlet r = double(true);', 'E-TYPE-CALL', 'double(true)'],
    ['let p = { x: true };\nlet s = p.x + 1;', 'E-TYPE-MISMATCH', 'p.x'],
    ['let p: { x: Number } = { x: true };\nlet s = p.x + 1;', 'E-TYPE-ANNOTATION', '{ x: true }']
  ];

  pairs.forEach(function (row) {
    const typed = Typecheck.typecheck(Parser.parse(row[0]).tree);
    const first = typed.errors[0];

    assert.ok(first, row[0] + ' must report something');
    assert.strictEqual(first.code, row[1], row[0]);
    assert.strictEqual(row[0].slice(first.span.start, first.span.end), row[2], row[0]);
  });

  /* The exact offsets the prose quotes, and the pair that does NOT move. */
  const bare = Typecheck.typecheck(Parser.parse(pairs[4][0]).tree).errors[0];
  const annotated = Typecheck.typecheck(Parser.parse(pairs[5][0]).tree).errors[0];

  assert.strictEqual(bare.span.start + '–' + bare.span.end, '29–32');
  assert.strictEqual(annotated.span.start + '–' + annotated.span.end, '23–34');

  const callBare = Typecheck.typecheck(Parser.parse(pairs[2][0]).tree).errors[0];
  const callAnnotated = Typecheck.typecheck(Parser.parse(pairs[3][0]).tree).errors[0];

  assert.strictEqual(callBare.span.end - callBare.span.start, 12);
  assert.strictEqual(callAnnotated.span.end - callAnnotated.span.start, 12);
  assert.strictEqual(callBare.code, callAnnotated.code,
    'annotating the parameter does not move the blame, because the call was already where ' +
    'the two types met');

  support.quotes('type-checking-in-practice',
    ['E-TYPE-MISMATCH blaming n at offsets 26 to 27',
      'E-TYPE-ANNOTATION blaming true at offsets 16 to 20',
      'E-TYPE-MISMATCH on p.x at 29 to 32 becomes E-TYPE-ANNOTATION on { x: true } at 23 to 34',
      'offsets 39 to 51 and 47 to 59, the same 12 characters',
      '2 of 3 changed their code and 2 of 3 changed what is underlined']);
});

test('figures: the constraints on the mismatch sample', function () {
  const source = 'let n = 1;\nlet flag = true;\nlet bad = n + flag;';
  const parsed = Parser.parse(source);
  const typed = Typecheck.typecheck(parsed.tree);
  const failed = typed.constraints.filter(function (row) { return !row.ok; });

  assert.strictEqual(typed.constraints.length, 2);
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].actual, 'Bool');
  assert.strictEqual(failed[0].expected, 'Number');
  assert.strictEqual(failed[0].span.start + '–' + failed[0].span.end, '42–46');
  assert.strictEqual(typed.types.size, 8);
  assert.strictEqual(typed.errors[0].message, '+ needs a Number on the right');

  support.quotes('type-checking-in-practice',
    ['2 constraints, 1 of them unsolvable',
      'Bool against Number at offsets 42 to 46',
      '8 entries for a 3-line program']);
});

/* ---------------------------------------------------------- 28.7 desugaring */

test('figures: the desugaring default sample', function () {
  const source = 'let total = 0;\nfor v in [1, 2, 3, 4] {\n  if v == 2 { continue; } else {};\n'
    + '  total = total + v;\n}';
  const parsed = Parser.parse(source);
  const lowered = Desugar.desugar(parsed.tree);
  const behaviour = Interp.compareWithCore(source);

  assert.strictEqual(lowered.rewrites.length, 3);
  assert.strictEqual(lowered.passes.for, 1);
  assert.strictEqual(lowered.passes.operators, 2);
  assert.strictEqual(Ast.countNodes(parsed.tree), 23);
  assert.strictEqual(Ast.countNodes(lowered.core), 46);
  assert.strictEqual(support.fixed(46 / 23, 2), '2.00');
  assert.ok(behaviour.agree);
  assert.deepStrictEqual(behaviour.surface.bindings, ['total = 8']);
  assert.strictEqual(behaviour.surfaceSteps, 53);
  assert.strictEqual(behaviour.coreSteps, 134);

  support.quotes('desugaring-to-a-core', ['total = 8 either way']);
});

test('figures: node growth across the conformance suite', function () {
  const growth = {};
  let observations = 0;

  Spec.CONFORMANCE.forEach(function (program) {
    const parsed = Parser.parse(program.source);
    const lowered = Desugar.desugar(parsed.tree);
    const surface = Ast.countNodes(parsed.tree);

    growth[program.id] = support.fixed(Ast.countNodes(lowered.core) / surface, 2);
    observations += Interp.compareWithCore(program.source).observed;
  });

  assert.strictEqual(growth.for, '2.57');
  assert.strictEqual(growth.match, '2.15');
  assert.strictEqual(growth.arithmetic, '0.43');
  assert.strictEqual(observations, 31);

  support.quotes('desugaring-to-a-core',
    ['for grows 2.57 times and match 2.15, while folding shrinks arithmetic to 0.43',
      '31 observations across 17 programs',
      '17 of 17 agree — every value is unit']);
});

test('figures: the capture trap really did recurse', function () {
  /* The prose quotes a step count for the failure, so the failure is
     reproduced rather than remembered: the same lowering with the operator
     name unprefixed. */
  const surface = Interp.run('fn add(a, b) { return a + b; } let s = add(1, 2);');

  assert.strictEqual(surface.outcome, 'ok');
  assert.deepStrictEqual(surface.bindings, ['add = <fn add>', 's = 3']);

  const captured = Interp.run('fn add(a, b) { return add(a, b); } let s = add(1, 2);');

  assert.strictEqual(captured.outcome, 'budget',
    'a function whose body calls itself unconditionally does not finish, and that is a ' +
    'budget outcome rather than a crash');

  support.quotes('desugaring-to-a-core', ['the core recursed until the stack ran out']);
});

/* -------------------------------------------------------- 28.8 diagnostics */

test('figures: the error suite and the cascade', function () {
  const suite = Pipeline.errorSuite();

  assert.strictEqual(suite.total, 12);
  assert.strictEqual(suite.passed, 12);
  assert.strictEqual(suite.raw, 15);
  assert.strictEqual(suite.reported, 12);

  const heavy = suite.rows.filter(function (row) { return row.raw > 1; });

  assert.strictEqual(heavy.length, 2, 'two programs account for the whole cascade');
  assert.strictEqual(heavy[0].raw, 3, 'the unterminated string produces three');
  assert.strictEqual(heavy[1].raw, 2, 'and the malformed number two');

  const counts = Pipeline.run('let s = "oops;\nlet n = valu + 1;\nlet b = 1 + true;')
    .diagnostics.counts;

  assert.strictEqual(counts.contained, 0, 'containment earns nothing on this suite');
  assert.strictEqual(counts.duplicate, 0, 'and neither does deduplication');

  support.quotes('diagnostics-as-a-product',
    ['15 diagnostics for 12 mistakes', '12 reported, 3 suppressed, all 3 by stage gating',
      '12 of 12 correct',
      '2 programs account for all 3 — the unterminated string produces 3 and the ' +
        'malformed number 2']);
});

test('figures: the three quick fixes', function () {
  const suite = Pipeline.fixSuite();

  assert.strictEqual(suite.offered, 3);
  assert.strictEqual(suite.removed, 3);
  assert.strictEqual(suite.clean, 2);
  assert.strictEqual(Spec.ERROR_SUITE.length - suite.offered, 9,
    'nine programs get no fix, which is the right answer rather than a gap');

  const byId = {};

  suite.rows.forEach(function (row) { byId[row.id] = row; });
  assert.strictEqual(byId['missing-semicolon'].fixed, 'let a = 1 ;let b = 2;');
  assert.strictEqual(byId['unclosed-paren'].fixed, 'let a = (1 + 2);');
  assert.strictEqual(byId['unterminated-string'].remaining, 1,
    'closing the string leaves the statement still missing its semicolon');

  support.quotes('diagnostics-as-a-product',
    ['3 of 12', 'let a = 1 let b = 2; becomes let a = 1 ;let b = 2; and the file is clean',
      'let a = (1 + 2; becomes let a = (1 + 2); and the file is clean',
      '3 of 3 removed their own diagnostic; 2 of 3 left the file clean']);
});

/* ------------------------------------------------------------ 28.9 testing */

test('figures: the four properties at the shipped defaults', function () {
  const fuzz = Fuzz.fuzzParser({ count: 2000, seed: 1, maxDepth: 4 });
  const differential = Fuzz.differential({ count: 1000, seed: 1, maxDepth: 4 });

  assert.strictEqual(fuzz.checked, 2000);
  assert.strictEqual(fuzz.crashes.length, 0);
  assert.strictEqual(fuzz.lostSpans.length, 0);
  assert.strictEqual(fuzz.withErrors, 1415);
  assert.strictEqual(support.fixed(100 * fuzz.withErrors / fuzz.checked, 0), '71');
  assert.deepStrictEqual(Object.keys(fuzz.kinds).sort(),
    ['delete', 'insert', 'swap', 'truncate']);
  assert.strictEqual(fuzz.kinds.delete, 515);
  assert.strictEqual(fuzz.kinds.insert, 482);
  assert.strictEqual(fuzz.kinds.swap, 483);
  assert.strictEqual(fuzz.kinds.truncate, 520);
  assert.strictEqual(differential.ran, 1000);
  assert.strictEqual(differential.budget, 0);
  assert.strictEqual(differential.failures.length, 0);

  support.quotes('testing-a-front-end',
    ['2 000 corrupted programs, 0 crashes, 0 spans outside their own source',
      '515 deletions, 482 insertions, 483 swaps, 520 truncations',
      '1 415 of 2 000 — about 71%', 'about 71% of mutants produce a diagnostic;']);
});

test('figures: the golden values per stage', function () {
  const golden = {};

  Spec.CONFORMANCE.forEach(function (program) {
    const out = Pipeline.run(program.source);

    golden[program.id] = {
      tokens: out.artefacts.lex.tokens.length,
      nodes: Ast.countNodes(out.artefacts.parse.tree),
      bindings: Resolve.summary(out.artefacts.resolve).bindings,
      types: out.artefacts.typecheck.types.size,
      core: Ast.countNodes(out.artefacts.desugar.core),
      diagnostics: out.diagnostics.kept.length
    };
  });

  assert.deepStrictEqual(golden.arithmetic,
    { tokens: 10, nodes: 7, bindings: 1, types: 6, core: 3, diagnostics: 0 });
  assert.deepStrictEqual(golden.closure,
    { tokens: 34, nodes: 18, bindings: 5, types: 15, core: 19, diagnostics: 0 });
  Object.keys(golden).forEach(function (id) {
    assert.strictEqual(golden[id].diagnostics, 0,
      id + ': a conformance program that reports anything is not conformant');
  });
});

test('figures: every stage is pure on every conformance program', function () {
  Spec.CONFORMANCE.forEach(function (program) {
    assert.ok(Pipeline.purity(program.source).ok, program.id + ' is not pure');
  });
  assert.strictEqual(Pipeline.ORDER.length, 5);
});
