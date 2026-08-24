/**
 * Property tests for the applied half of M25 — Pratt parsing, lexing in
 * context, error recovery and the real-language gallery.
 *
 * Each of these has an independent reference to be checked against: the Pratt
 * trees are compared with an equivalent precedence GRAMMAR parsed by Earley,
 * the ASI cases against the ECMAScript rules written out, and the recovery
 * counts against the acceptance criterion the milestone names.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const Grammar = require(path.join(BASE, 'machines', 'grammar.js'));
const Earley = require(path.join(BASE, 'algorithms', 'earley.js'));
const Pratt = require(path.join(BASE, 'algorithms', 'pratt.js'));
const Peg = require(path.join(BASE, 'algorithms', 'peg.js'));
const LexerModes = require(path.join(BASE, 'algorithms', 'lexer-modes.js'));
const ErrorRecovery = require(path.join(BASE, 'algorithms', 'error-recovery.js'));
const RealLanguages = require(path.join(BASE, 'algorithms', 'real-languages.js'));

/* ----------------------------------------------------------------- Pratt */

/**
 * The independent reference: a precedence grammar with one nonterminal per
 * level, parsed by Earley, printed in the same parenthesised form. If the
 * table and the grammar encode the same precedence they must agree on every
 * expression — which is the claim "precedence as data is equivalent to
 * precedence as grammar shape", checked rather than asserted.
 */
const PRECEDENCE_GRAMMAR = Grammar.create({
  start: 'S',
  productions: {
    S: [['S', '+', 'M'], ['M']],
    M: [['M', '*', 'P'], ['P']],
    P: [['A', '^', 'P'], ['A']],
    A: [['a'], ['b'], ['c'], ['d']]
  },
  label: 'the same precedence as a grammar'
});

/** Print an Earley tree in the parenthesised form Pratt.show produces, so the
 *  two are comparable at all. */
function flatten(tree) {
  if (!tree.children) return tree.symbol;
  const parts = tree.children.map(flatten).filter(function (t) { return t !== ''; });

  if (parts.length === 1) return parts[0];
  return '(' + parts[0] + ' ' + parts[1] + ' ' + parts[2] + ')';
}

test('the Pratt table and an equivalent grammar agree on every expression', function () {
  const table = Pratt.standard();
  const inputs = ['a', 'a + b', 'a * b', 'a + b * c', 'a * b + c', 'a + b + c', 'a * b * c',
    'a ^ b', 'a ^ b ^ c', 'a + b ^ c', 'a ^ b + c', 'a + b * c ^ d', 'a ^ b * c + d',
    'a * b ^ c * d', 'a + b + c + d'];

  inputs.forEach(function (text) {
    const tokens = Pratt.tokenise(text);
    const fromTable = Pratt.parse(table, tokens);
    const trees = Earley.trees(Earley.parse(PRECEDENCE_GRAMMAR, tokens), 4);

    assert.equal(trees.length, 1, text + ': the reference grammar must be unambiguous');
    assert.ok(fromTable.complete, text + ': the Pratt parser must consume every token');
    assert.equal(fromTable.text, flatten(trees[0]),
      text + ': the table gives ' + fromTable.text + ' and the grammar gives ' +
        flatten(trees[0]));
  });
});

test('the ten asserted parenthesisations hold, and moving a power breaks the right ones',
  function () {
    const table = Pratt.standard();
    const cases = [
      ['a + b * c', '(a + (b * c))'], ['a * b + c', '((a * b) + c)'],
      ['a + b + c', '((a + b) + c)'], ['a ^ b ^ c', '(a ^ (b ^ c))'],
      ['a + b * c ^ d', '(a + (b * (c ^ d)))'], ['- a + b', '((- a) + b)'],
      ['a ++ + b', '((a ++) + b)'], ['a ? b : c ? d : e', '(a ? b : (c ? d : e))'],
      ['( a + b ) * c', '((a + b) * c)'], ['a && b || c', '((a && b) || c)']
    ];

    cases.forEach(function (pair) {
      const out = Pratt.parse(table, Pratt.tokenise(pair[0]));

      assert.equal(out.text, pair[1], pair[0] + ' parsed as ' + out.text);
      assert.ok(out.complete, pair[0] + ' left tokens unconsumed');
    });

    const swapped = Pratt.standard();

    swapped.infix['+'] = { power: 60, right: false };
    swapped.infix['*'] = { power: 50, right: false };
    assert.equal(Pratt.parse(swapped, Pratt.tokenise('a + b * c')).text, '((a + b) * c)',
      'swapping two powers restructures exactly the expressions that depend on the ordering');

    const leftPower = Pratt.standard();

    leftPower.infix['^'] = { power: 80, right: false };
    assert.equal(Pratt.parse(leftPower, Pratt.tokenise('a ^ b ^ c')).text, '((a ^ b) ^ c)',
      'and one boolean flips the associativity');
    assert.equal(Pratt.parse(leftPower, Pratt.tokenise('a + b * c')).text, '(a + (b * c))',
      'while leaving every expression that does not involve ^ alone');
  });

/* ------------------------------------------------------------------- PEG */

test('packrat changes the cost and not the answer, at every depth', function () {
  const rows = [2, 4, 6, 8, 10, 12, 14].map(function (depth) {
    const grammar = Peg.exponentialFixture(depth);
    const memo = Peg.parse(grammar, 'a', { memo: true });
    const plain = Peg.parse(grammar, 'a', { memo: false, cap: 4000000 });

    assert.equal(memo.matched, plain.matched, 'depth ' + depth + ': matched differs');
    assert.equal(memo.complete, plain.complete, 'depth ' + depth + ': complete differs');
    assert.ok(!plain.overflow, 'depth ' + depth + ': the plain run hit its cap');
    return { depth: depth, memo: memo.steps, entries: memo.entries, plain: plain.steps };
  });

  assert.deepEqual(rows.map(function (r) { return r.memo; }), [16, 34, 52, 70, 88, 106, 124],
    'the memoised step count grows by 18 per two levels');
  assert.deepEqual(rows.map(function (r) { return r.entries; }), [4, 8, 12, 16, 20, 24, 28],
    'and the table by four entries per two levels');
  assert.deepEqual(rows.map(function (r) { return r.plain; }),
    [27, 191, 1087, 5631, 27647, 131071, 606207],
    'while the plain count multiplies');
  const ratio = rows[rows.length - 1].plain / rows[rows.length - 1].memo;

  assert.ok(ratio > 4880 && ratio < 4900, 'the quoted ratio is 4 888.8, got ' + ratio.toFixed(1));
});

test('the unreachable-alternative check finds the shadowed one and only that one', function () {
  const pair = Peg.orderedChoicePair();
  const samples = ['a', 'ab', 'b', 'abc', ''];
  const shadowed = Peg.unreachableAlternatives(pair.shortFirst, samples);

  assert.equal(shadowed.length, 1, 'the short-first order has one dead alternative');
  assert.equal(shadowed[0].index, 1);
  assert.equal(shadowed[0].shadowedBy, 0);
  assert.ok(shadowed[0].reason.indexOf('prefix') !== -1,
    'the reason must name the literal prefix: ' + shadowed[0].reason);
  assert.deepEqual(Peg.unreachableAlternatives(pair.longFirst, samples), [],
    'longest first has no dead alternative');

  assert.equal(Peg.parse(pair.shortFirst, 'ab').consumed, 1,
    'ordered choice commits to "a" and leaves the b');
  assert.ok(!Peg.parse(pair.shortFirst, 'ab').complete, 'so the parse is incomplete');
  assert.ok(Peg.parse(pair.longFirst, 'ab').complete, 'and the other order completes');
});

/* ------------------------------------------------------------- the lexer */

test('the mode stack finds interpolations the flat lexer misses, with no error either way',
  function () {
    const sources = [
      { label: 'flat', text: '`hello ${name}`', interpolations: 1, depth: 3 },
      { label: 'nested', text: '`a ${b + `c ${d} e`} f`', interpolations: 2, depth: 5 },
      { label: 'deep', text: '`p ${q + `r ${s + `t ${u} v`} w`} x`', interpolations: 3, depth: 7 }
    ];

    sources.forEach(function (source) {
      const stacked = LexerModes.lex(source.text, { useStack: true });
      const flat = LexerModes.lex(source.text, { useStack: false });
      const count = function (result) {
        return result.tokens.filter(function (t) {
          return t.type === 'interpolation-start';
        }).length;
      };

      assert.equal(count(stacked), source.interpolations,
        source.label + ': the stacked lexer must find every interpolation');
      assert.equal(stacked.maxDepth, source.depth,
        source.label + ': expected stack depth ' + source.depth + ', got ' + stacked.maxDepth);
      assert.equal(flat.maxDepth, 1, 'a single-mode lexer has depth 1 by construction');
      assert.equal(stacked.errors.length, 0, 'neither lexer reports an error');
      assert.equal(flat.errors.length, 0, 'which is exactly the problem');
      if (source.label === 'flat') return;
      assert.equal(count(flat), 0,
        source.label + ': the flat lexer must miss the nested interpolations entirely');
    });
  });

test('indentation tokens follow the rules implementations forget', function () {
  const source = ['def f():', '    a = 1', '', '    # a comment line', '    if a:',
    '        b = 2', '    c = 3', 'd = 4'].join('\n');
  const out = LexerModes.indentTokens(source);
  const count = function (type) {
    return out.tokens.filter(function (t) { return t.type === type; }).length;
  };

  assert.equal(count('LINE'), 6, '8 lines minus a blank and a comment leaves 6');
  assert.equal(count('NEWLINE'), 6, 'one NEWLINE per LINE and no more');
  assert.equal(count('INDENT'), 2);
  assert.equal(count('DEDENT'), 2, 'every block that opens must close');
  assert.deepEqual(out.errors, []);

  assert.equal(LexerModes.columnOf('\tx', 8).column, 8, 'a tab advances to the next multiple');
  assert.equal(LexerModes.columnOf('        x', 8).column, 8, 'and eight spaces reach the same');
  assert.equal(LexerModes.columnOf('    \tx', 8).column, 8,
    'four spaces then a tab is still column 8, not 12');
  assert.equal(LexerModes.columnOf('\t\tx', 8).column, 16);

  const bad = LexerModes.indentTokens(['if a:', '        b = 1', '    c = 2'].join('\n'));

  assert.equal(bad.errors.length, 1, 'a dedent to an unopened column is an error, not a guess');
  assert.equal(bad.errors[0].column, 4);
});

test('maximal munch is right for >= and wrong for >>, depending only on the operator set',
  function () {
    const text = function (tokens) {
      return tokens.map(function (t) { return t.text; }).join(' ');
    };

    assert.equal(text(LexerModes.munch('List<List<int>>', ['<', '>', '>>'])),
      'List < List < int >>', 'with >> in the set the brackets never close');
    assert.equal(text(LexerModes.munch('List<List<int>>', ['<', '>'])),
      'List < List < int > >', 'without it they do');
    assert.equal(text(LexerModes.munch('a>=b', ['>', '=', '>='])), 'a >= b',
      'the case maximal munch exists for');
    assert.equal(text(LexerModes.munch('a--b', ['-', '--'])), 'a -- b',
      'and the case that is why C needs a space there');
  });

/* ---------------------------------------------------------- the recovery */

test('three independent errors produce exactly three diagnostics under both strategies',
  function () {
    const source = ErrorRecovery.threeErrors();
    const expected = {
      stop: { errors: 1, survived: 1, repairs: 0 },
      panic: { errors: 3, survived: 4, repairs: 0 },
      repair: { errors: 3, survived: 5, repairs: 1 }
    };

    Object.keys(expected).forEach(function (strategy) {
      const out = ErrorRecovery.parse(source, strategy);

      assert.equal(out.errors, expected[strategy].errors,
        strategy + ': expected ' + expected[strategy].errors + ' diagnostics, got ' + out.errors);
      assert.equal(out.survived, expected[strategy].survived,
        strategy + ': expected ' + expected[strategy].survived + ' surviving declarations, got ' +
          out.survived);
      assert.equal(out.repairs.length, expected[strategy].repairs);
      out.diagnostics.forEach(function (diagnostic) {
        assert.ok(diagnostic.expected.length > 0, 'every diagnostic names what was expected');
        assert.ok(diagnostic.found.length > 0, 'and what was found');
      });
    });
  });

test('the valid declarations survive, by name', function () {
  const out = ErrorRecovery.parse(ErrorRecovery.threeErrors(), 'panic');
  const names = out.declarations.filter(function (d) { return d.name; })
    .map(function (d) { return d.name; });

  assert.deepEqual(names, ['a', 'd'],
    'the two `let` statements outside the errors must be recovered');
  assert.equal(out.declarations.length, 4, 'along with the two `print` statements');

  const repaired = ErrorRecovery.parse(ErrorRecovery.threeErrors(), 'repair');

  assert.deepEqual(repaired.declarations.filter(function (d) { return d.name; })
    .map(function (d) { return d.name; }), ['a', 'b', 'd'],
  'and repair additionally reconstructs the statement the first error was in');
});

test('a clean file produces nothing, and cascade suppression fires where it should', function () {
  ErrorRecovery.STRATEGIES.forEach(function (strategy) {
    const out = ErrorRecovery.parse(ErrorRecovery.clean(), strategy);

    assert.equal(out.errors, 0, strategy + ': a clean file must produce no diagnostics');
    assert.equal(out.suppressed, 0);
    assert.equal(out.survived, 3);
  });

  const missing = ErrorRecovery.parse('let a = 1 let b = 2 ;', 'repair');

  assert.equal(missing.errors, 1, 'one missing semicolon is one diagnostic');
  assert.equal(missing.survived, 2, 'and both declarations are recovered by the insertion');

  const cascading = ErrorRecovery.parse('let = = = ;', 'repair');

  assert.equal(cascading.errors, 1, 'one reported');
  assert.equal(cascading.suppressed, 1, 'and one suppressed as an echo of it');
});

/* ------------------------------------------------------ real languages */

test('every ASI case matches the specified behaviour', function () {
  const cases = RealLanguages.asiCases();

  assert.equal(cases.length, 6, 'six cases: two restricted, three continuations, one ordinary');
  cases.forEach(function (test_) {
    const out = RealLanguages.insertSemicolons(test_.source);

    assert.equal(out.text, test_.expected,
      test_.name + ': got "' + out.text + '" and expected "' + test_.expected + '"');
  });

  const restricted = RealLanguages.insertSemicolons('return\n1');

  assert.ok(restricted.inserted.some(function (entry) {
    return entry.rule.indexOf('restricted') === 0;
  }), 'the return case must be attributed to a restricted production, not to a failing parse');

  const continuation = RealLanguages.insertSemicolons('a = b\n( c )');

  assert.equal(continuation.inserted.length, 1,
    'only the end-of-program semicolon; the newline itself inserts nothing');
});

test('the typedef and angle-bracket cases differ exactly where the fix applies', function () {
  const asType = RealLanguages.classifyC('x * y ;', ['x']);
  const asVariable = RealLanguages.classifyC('x * y ;', []);

  assert.ok(asType.differs, 'with x a typedef name the two readings differ');
  assert.ok(!asVariable.differs, 'and without it they agree — which is why the bug hides');
  assert.ok(asType.withHack.indexOf('declaration') !== -1);
  assert.ok(asVariable.withHack.indexOf('multiplication') !== -1);

  const naive = RealLanguages.angleBrackets('vector<vector<int>>', false);
  const fixed = RealLanguages.angleBrackets('vector<vector<int>>', true);

  assert.ok(!naive.balanced, 'maximal munch leaves the brackets unbalanced');
  assert.equal(naive.depth, 2, 'two opened and none closed');
  assert.ok(fixed.balanced, 'splitting the token in the parser balances them');
  assert.equal(fixed.depth, 0);
});

test('the gallery covers every case the milestone names, each with an input', function () {
  const gallery = RealLanguages.gallery();

  assert.equal(gallery.length, 8);
  const languages = gallery.map(function (row) { return row.language; });

  ['C', 'C++', 'Python', 'JavaScript', 'YAML'].forEach(function (language) {
    assert.ok(languages.indexOf(language) !== -1, language + ' is missing from the gallery');
  });
  gallery.forEach(function (row) {
    assert.ok(row.input && row.input.length > 0, row.construct + ' has no runnable input');
    assert.ok(row.naive && row.naive.length > 0, row.construct + ' does not say what breaks');
    assert.ok(row.fix && row.fix.length > 0, row.construct + ' does not say what shipped');
    assert.ok(row.cost && row.cost.length > 0, row.construct + ' does not say what it cost');
  });
});
