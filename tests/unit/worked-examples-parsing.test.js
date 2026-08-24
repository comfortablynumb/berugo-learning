/**
 * Every figure the M25 worked examples quote, recomputed from the modules —
 * and then checked to still be quoted.
 *
 * Both halves matter. Recomputing catches a module that drifted from the prose;
 * the quote check catches prose that drifted from the module. A test that does
 * only the first passes happily while the section teaches a number nothing
 * produces any more.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BASE = path.join(__dirname, '..', '..', 'src', 'js');
const Grammar = require(path.join(BASE, 'machines', 'grammar.js'));
const Earley = require(path.join(BASE, 'algorithms', 'earley.js'));
const Cyk = require(path.join(BASE, 'algorithms', 'cyk.js'));
const LlParser = require(path.join(BASE, 'algorithms', 'll-parser.js'));
const LrParser = require(path.join(BASE, 'algorithms', 'lr-parser.js'));
const LrItems = require(path.join(BASE, 'algorithms', 'lr-items.js'));
const Glr = require(path.join(BASE, 'algorithms', 'glr.js'));
const Pda = require(path.join(BASE, 'algorithms', 'pda.js'));
const Peg = require(path.join(BASE, 'algorithms', 'peg.js'));
const Pratt = require(path.join(BASE, 'algorithms', 'pratt.js'));
const Transform = require(path.join(BASE, 'algorithms', 'grammar-transform.js'));
const LexerModes = require(path.join(BASE, 'algorithms', 'lexer-modes.js'));
const ErrorRecovery = require(path.join(BASE, 'algorithms', 'error-recovery.js'));
const RealLanguages = require(path.join(BASE, 'algorithms', 'real-languages.js'));
const ParseLab = require(path.join(BASE, 'machines', 'parse-lab.js'));

const CONTENT = path.join(BASE, 'content');

['grammars', 'tables', 'practice'].forEach(function (third) {
  require(path.join(CONTENT, 'examples-parsing-' + third + '.js'));
  require(path.join(CONTENT, 'concepts-parsing-' + third + '.js'));
});

const prose = require('../support/worked-example-prose.js');

function sum(operands) {
  const tokens = ['a'];

  for (let i = 1; i < operands; i += 1) { tokens.push('+'); tokens.push('a'); }
  return tokens;
}

/* -------------------------------------------------- 25.1 ambiguity counts */

test('25.1: the tree counts, the chart size and the witness', function () {
  const grammar = ParseLab.fixture('ambiguousSum');
  const counts = [1, 2, 3, 4].map(function (n) {
    return Earley.ambiguity(grammar, sum(n), 400);
  });

  assert.deepEqual(counts, [1, 1, 2, 5], 'the Catalan sequence, not powers of two');

  const result = Earley.parse(grammar, sum(3));
  const items = result.columns.reduce(function (total, column) {
    return total + column.length;
  }, 0);

  assert.equal(items, 21, 'chart items for the three-operand case');
  assert.equal(result.columns.length, 6, 'one column per position plus the end');

  const shapes = Earley.trees(result, 5).map(Grammar.shape);

  assert.deepEqual(shapes,
    ['E(E(E(a) + E(a)) + E(a))', 'E(E(a) + E(E(a) + E(a)))'],
    'both readings, left-nested and right-nested');

  prose.quotes('grammars-and-ambiguity', ['1 tree', '2 trees', '5 trees', '21 chart items',
    '6 columns', 'E(E(E(a) + E(a)) + E(a))', 'E(E(a) + E(E(a) + E(a)))']);
});

test('25.1: the rewrite gives one tree and the dangling else keeps two', function () {
  const precedence = ParseLab.fixture('precedenceSum');
  const times = Earley.trees(Earley.parse(precedence, ['a', '+', 'a', '*', 'a']), 4);
  const plus = Earley.trees(Earley.parse(precedence, sum(3)), 4);

  assert.equal(times.length, 1);
  assert.equal(Grammar.shape(times[0]), 'E(E(T(F(a))) + T(T(F(a)) * F(a)))');
  assert.equal(plus.length, 1);
  assert.equal(Grammar.shape(plus[0]), 'E(E(E(T(F(a))) + T(F(a))) + T(F(a)))');

  const dangling = ParseLab.fixture('danglingElse');

  assert.equal(Earley.ambiguity(dangling, ['i', 'b', 't', 'x'], 50), 1);
  assert.equal(
    Earley.ambiguity(dangling, ['i', 'b', 't', 'i', 'b', 't', 'x', 'e', 'x'], 50), 2,
    'the else has two homes');

  prose.quotes('grammars-and-ambiguity',
    ['E(E(T(F(a))) + T(T(F(a)) * F(a)))', 'E(E(E(T(F(a))) + T(F(a))) + T(F(a)))',
      'S(i E(b) t S(x))']);
});

/* ---------------------------------------------- 25.2 transformation costs */

test('25.2: the pipeline figures on the precedence grammar', function () {
  const grammar = ParseLab.fixture('precedenceSum');
  const order = ['useless', 'epsilon', 'unit', 'left-recursion', 'left-factor', 'cnf'];
  const result = Transform.pipeline(grammar, order, 6);
  const shape = result.rows.map(function (row) {
    return row.productions + '/' + row.nonterminals;
  });

  assert.equal(grammar.productions.length, 6, 'six productions to start');
  assert.equal(grammar.nonterminals.length, 3, 'over three nonterminals');
  assert.deepEqual(shape, ['6/3', '6/3', '9/3', '11/5', '11/5', '33/22'],
    'the measured pipeline: unit expands, left recursion adds two tails, CNF binarises');
  result.rows.forEach(function (row) {
    assert.ok(row.preserved, row.step + ' changed the language');
  });

  const check = Grammar.sameLanguage(grammar, result.rows.length
    ? Transform.STEPS.cnf(grammar).grammar : grammar, 6);

  assert.equal(check.tested, 30, 'thirty strings compared in both directions');

  prose.quotes('grammar-transformations',
    ['6 productions', '6 → 9 productions', '9 → 11 productions', '11 → 33 productions',
      '3 → 5 nonterminals', '5 → 22 nonterminals', '30 strings']);
});

test('25.2: the tree shapes before and after left-recursion elimination', function () {
  const before = ParseLab.fixture('leftRecursive');
  const after = Transform.eliminateLeftRecursion(before).grammar;
  const shapeOf = function (grammar, tokens) {
    return Grammar.shape(Earley.trees(Earley.parse(grammar, tokens), 1)[0]);
  };

  assert.equal(before.productions.length, 3);
  assert.equal(after.productions.length, 4);
  assert.equal(shapeOf(before, ['a']), 'E(T(a))');
  assert.equal(shapeOf(after, ['a']), "E(T(a) E'())");
  assert.equal(shapeOf(before, sum(2)), 'E(E(T(a)) + T(a))');
  assert.equal(shapeOf(after, sum(2)), "E(T(a) E'(+ T(a) E'()))");
  assert.equal(shapeOf(before, sum(3)), 'E(E(E(T(a)) + T(a)) + T(a))');
  assert.equal(shapeOf(after, sum(3)), "E(T(a) E'(+ T(a) E'(+ T(a) E'())))");
  assert.ok(Grammar.sameLanguage(before, after, 6).same, 'and the language is untouched');

  prose.quotes('grammar-transformations',
    ['E(T(a))', "E(T(a) E'())", 'E(E(T(a)) + T(a))', "E(T(a) E'(+ T(a) E'()))",
      'E(E(E(T(a)) + T(a)) + T(a))', "E(T(a) E'(+ T(a) E'(+ T(a) E'())))"]);
});

/* -------------------------------------------------------------- 25.3 PDA */

test('25.3: the bracket machine’s configuration counts and stack depths', function () {
  const machine = Pda.brackets();
  const measure = function (tokens) {
    const run = Pda.run(machine, tokens, 20000);

    return { accepted: run.accepted, steps: run.steps,
      depth: run.trace.reduce(function (best, snap) {
        return Math.max(best, snap.stack ? snap.stack.split(' ').length : 0);
      }, 0) };
  };

  assert.equal(machine.states.length, 1, 'one state');
  assert.equal(machine.transitions.length, 4, 'and four transitions');
  assert.deepEqual(measure(['(', ')']), { accepted: true, steps: 5, depth: 2 });
  assert.deepEqual(measure(['(', '(', ')', ')']), { accepted: true, steps: 7, depth: 3 });
  assert.deepEqual(measure(['(', ')', '(']), { accepted: false, steps: 6, depth: 2 });
  assert.deepEqual(measure(['(', '(', ')', ')', '(', ')']),
    { accepted: true, steps: 10, depth: 3 });

  prose.quotes('pushdown-automata',
    ['5 configurations explored, deepest stack 2', '7 configurations, deepest stack 3',
      '6 configurations', '10 configurations, deepest stack 3', '1 state, 4 transitions']);
});

test('25.3: the construction agrees with Earley on 31 inputs', function () {
  const grammar = ParseLab.fixture('balanced');
  const machine = Pda.fromGrammar(grammar);
  const inputs = ParseLab.exhaustive(grammar.terminals, 4);
  let checked = 0;
  let mismatches = 0;

  assert.equal(machine.transitions.length, 4,
    'two expands for the two productions, two matches for the two terminals');
  assert.equal(inputs.length, 31, 'every string up to length four over two terminals');
  inputs.forEach(function (tokens) {
    const run = Pda.run(machine, tokens, 8000);

    if (run.exhausted && !run.accepted) return;
    checked += 1;
    if (run.accepted !== Earley.parse(grammar, tokens).accepted) mismatches += 1;
  });
  assert.equal(checked, 31);
  assert.equal(mismatches, 0);

  const anbn = Pda.anbn();

  assert.ok(Pda.accepts(anbn, ['a', 'a', 'b', 'b'], 20000));
  assert.ok(!Pda.accepts(anbn, ['a', 'a', 'b'], 20000));

  prose.quotes('pushdown-automata', ['31 inputs', '0 mismatches out of 31', '4 transitions']);
});

/* ------------------------------------------------------------ 25.4 LL(1) */

test('25.4: conflict counts, witnesses and the repairs', function () {
  const rows = ['leftRecursive', 'danglingElse', 'precedenceSum'].map(function (name) {
    const grammar = ParseLab.fixture(name);
    const built = LlParser.table(grammar);
    const fixed = Transform.leftFactor(
      Transform.eliminateLeftRecursion(grammar).grammar).grammar;

    return {
      name: name, productions: grammar.productions.length, conflicts: built.conflicts.length,
      after: LlParser.table(fixed).conflicts.length, afterRules: fixed.productions.length,
      witness: LlParser.conflictExample(grammar, built.conflicts[0], 5)
    };
  });

  assert.deepEqual(rows.map(function (r) { return r.productions; }), [3, 4, 6]);
  assert.deepEqual(rows.map(function (r) { return r.conflicts; }), [1, 1, 4]);
  assert.deepEqual(rows.map(function (r) { return r.after; }), [0, 1, 0],
    'two are fixed and the ambiguous one is not');
  assert.deepEqual(rows.map(function (r) { return r.afterRules; }), [4, 5, 8]);
  assert.deepEqual(rows.map(function (r) { return r.witness; }), ['a', 'ibtx', '(a)']);

  prose.quotes('top-down-parsing-and-ll1',
    ['3 productions, 1 conflict', '4 productions, 0 conflicts', '4 productions, 1 conflict',
      '5 productions, 1 conflict', '6 productions, 4 conflicts', 'witness "a"',
      'witness "ibtx"']);
});

test('25.4: FIRST, FOLLOW and the thirteen-step parse', function () {
  const grammar = ParseLab.fixture('ll1Ready');
  const analysis = Grammar.first(grammar);
  const follows = Grammar.follow(grammar, analysis);
  const keys = function (set) { return Object.keys(set).sort().join(','); };

  assert.equal(keys(analysis.sets.E), 'a');
  assert.equal(keys(analysis.sets.R), '+');
  assert.equal(keys(analysis.sets.T), 'a');
  assert.equal(keys(follows.E), '$');
  assert.equal(keys(follows.R), '$');
  assert.equal(keys(follows.T), '$,+');
  assert.deepEqual(Object.keys(Grammar.nullable(grammar)), ['R'], 'only R is nullable');

  const run = LlParser.parse(grammar, sum(3), LlParser.table(grammar));

  assert.ok(run.accepted);
  assert.equal(run.steps.length, 13, 'thirteen steps for a five-token input');
  const expands = run.steps.filter(function (step) {
    return step.action.indexOf('expand') === 0;
  });

  assert.equal(expands.length, 7, 'seven of them expansions, spelling out the derivation');

  prose.quotes('top-down-parsing-and-ll1',
    ['13 steps', '7 expansions', 'FIRST(E)={a}', 'FOLLOW(T)={+,$}']);
});

/* -------------------------------------------------------- 25.5/25.6 LR */

test('25.5: what FOLLOW buys on the precedence grammar', function () {
  const grammar = ParseLab.fixture('precedenceSum');
  const by = {};

  LrParser.compare(grammar).forEach(function (row) { by[row.mode] = row; });
  assert.equal(by.lr0.states, 12);
  assert.equal(by.lr0.shiftReduce, 2);
  assert.equal(by.slr.states, 12);
  assert.equal(by.slr.conflicts, 0);
  assert.equal(by.lalr.states, 12);
  assert.equal(by.lalr.merged, 10);
  assert.equal(by.lr1.states, 22);

  const built = LrParser.build(grammar, 'slr');

  assert.equal(LrParser.parse(built, ['a', '+', 'a', '*', 'a']).steps.length, 14);

  const rows = LrItems.stateRows(built.collection);

  assert.equal(rows[0].kernel.length, 1);
  assert.equal(rows[0].items.length - rows[0].kernel.length, 6, 'closure adds six items');

  prose.quotes('shift-reduce-and-lr0',
    ['12 item sets', '2 shift/reduce conflicts', '0 conflicts, still 12 states',
      'canonical LR(1) 22', '14 shift and reduce steps']);
});

test('25.5: the dangling-else conflict, named in full', function () {
  const built = LrParser.build(ParseLab.fixture('danglingElse'), 'slr');

  assert.equal(built.states, 10);
  assert.equal(built.conflicts.length, 1);
  const conflict = built.conflicts[0];

  assert.equal(conflict.state, 7);
  assert.equal(conflict.terminal, 'e');
  assert.equal(conflict.first, 'shift to state 8');
  assert.equal(conflict.second, 'reduce by S → i E t S');
  assert.deepEqual(conflict.items.sort(),
    ['S → i E t S •', 'S → i E t S • e S'].sort());

  const counts = LrParser.compare(ParseLab.fixture('danglingElse'))
    .map(function (row) { return row.conflicts; });

  assert.deepEqual(counts, [1, 1, 1, 1], 'it survives every flavour');

  prose.quotes('shift-reduce-and-lr0',
    ['10 states, 1 shift/reduce conflict', 'state 7, on the token `e`',
      'shift to state 8', 'reduce by `S → i E t S`', 'LR(0) 1, SLR 1, LALR 1, LR(1) 1']);
});

test('25.6: the merge, on the standard witness grammar', function () {
  const by = {};

  LrParser.compare(ParseLab.fixture('nonLalr')).forEach(function (row) { by[row.mode] = row; });
  assert.deepEqual([by.lr0.states, by.slr.states, by.lalr.states, by.lr1.states],
    [13, 13, 13, 14]);
  assert.deepEqual([by.lr0.reduceReduce, by.slr.reduceReduce, by.lalr.reduceReduce,
    by.lr1.reduceReduce], [6, 2, 2, 0]);
  assert.equal(by.lalr.merged, 1);
  assert.equal(by.lalr.shiftReduce, 0, 'a merge never induces a shift/reduce conflict');

  const built = LrParser.build(ParseLab.fixture('nonLalr'), 'lalr');
  const states = built.conflicts.map(function (c) { return c.state; });

  assert.deepEqual(states, [6, 6], 'both conflicts live in the merged state');
  assert.deepEqual(built.conflicts.map(function (c) { return c.terminal; }).sort(), ['c', 'd']);

  prose.quotes('lalr-and-canonical-lr1',
    ['14 states, 0 conflicts', '13 states, 1 core merged',
      '2 reduce/reduce conflicts, 0 shift/reduce', 'LR(0) 6 reduce/reduce, SLR 2, LALR 2, LR(1) 0',
      'state 6, merged from LR(1) states 6 and 9']);
});

test('25.6: where the merge costs nothing', function () {
  const figures = ['precedenceSum', 'balanced', 'ambiguousSum'].map(function (name) {
    const by = {};

    LrParser.compare(ParseLab.fixture(name)).forEach(function (row) { by[row.mode] = row; });
    return [by.lr0.states, by.lr0.conflicts, by.slr.conflicts, by.lalr.merged, by.lr1.states];
  });

  assert.deepEqual(figures[0], [12, 2, 0, 10, 22]);
  assert.deepEqual(figures[1], [6, 3, 0, 4, 10]);
  assert.deepEqual(figures[2], [5, 1, 1, 0, 5]);

  prose.quotes('lalr-and-canonical-lr1',
    ['LR(0) 12 states / 2 conflicts', 'LALR 12 / 0 with 10 merged',
      'LR(0) 6 / 3', 'LALR 6 / 0 with 4 merged', 'LR(1) 10 / 0',
      '5 states, 1 shift/reduce conflict, 0 merged']);
});

/* --------------------------------------------------------- 25.7 general */

test('25.7: the forest against the tree count', function () {
  const grammar = ParseLab.fixture('ambiguousSum');
  const rows = [3, 5, 7, 9, 11].map(function (operands) {
    const tokens = sum(operands);
    const forest = Glr.parse(grammar, tokens);

    return { tokens: tokens.length, nodes: forest.nodes, ambiguous: forest.ambiguous,
      trees: Earley.ambiguity(grammar, tokens, 40000) };
  });

  assert.deepEqual(rows.map(function (r) { return r.tokens; }), [5, 9, 13, 17, 21]);
  assert.deepEqual(rows.map(function (r) { return r.nodes; }), [11, 24, 41, 62, 87]);
  assert.deepEqual(rows.map(function (r) { return r.ambiguous; }), [1, 6, 15, 28, 45]);
  assert.deepEqual(rows.map(function (r) { return r.trees; }), [2, 14, 132, 1430, 16796]);

  prose.quotes('general-parsing-earley-cyk-glr',
    ['11 forest nodes, 1 of them ambiguous, 2 distinct trees', '24 nodes, 6 ambiguous, 14 trees',
      '41 nodes, 15 ambiguous, 132 trees', '62 nodes, 28 ambiguous, 1 430 trees',
      '87 nodes, 45 ambiguous, 16 796 trees']);
});

test('25.7: the sweep, and the nullable grammar', function () {
  const total = ParseLab.fixtureNames().reduce(function (acc, name) {
    const result = ParseLab.sweep(ParseLab.fixture(name), 4);

    assert.deepEqual(result.failures, [], name + ' disagreed');
    return acc + result.checked;
  }, 0);

  assert.equal(total, 13186, 'the exhaustive check count the section quotes');

  const nullable = ParseLab.fixture('nullable');

  assert.ok(Earley.parse(nullable, []).accepted);
  assert.ok(Cyk.parse(nullable, []).accepted);
  assert.ok(Glr.parse(nullable, []).accepted);
  assert.equal(Earley.ambiguity(nullable, [], 50), 1);
  assert.equal(Earley.ambiguity(nullable, ['a', 'a'], 50), 6);

  prose.quotes('general-parsing-earley-cyk-glr',
    ['13 186', 'all 3 accept', '1 tree', '6 trees']);
});

/* ------------------------------------------------------------- 25.8 PEG */

test('25.8: the packrat growth table and the ordered-choice pair', function () {
  const rows = [4, 8, 12, 14].map(function (depth) {
    const grammar = Peg.exponentialFixture(depth);
    const memo = Peg.parse(grammar, 'a', { memo: true });
    const plain = Peg.parse(grammar, 'a', { memo: false, cap: 4000000 });

    return { depth: depth, memo: memo.steps, entries: memo.entries, plain: plain.steps,
      ratio: Number((plain.steps / memo.steps).toFixed(1)) };
  });

  assert.deepEqual(rows.map(function (r) { return r.memo; }), [34, 70, 106, 124]);
  assert.deepEqual(rows.map(function (r) { return r.entries; }), [8, 16, 24, 28]);
  assert.deepEqual(rows.map(function (r) { return r.plain; }), [191, 5631, 131071, 606207]);
  assert.deepEqual(rows.map(function (r) { return r.ratio; }), [5.6, 80.4, 1236.5, 4888.8]);

  const pair = Peg.orderedChoicePair();

  assert.equal(Peg.parse(pair.shortFirst, 'ab').consumed, 1);
  assert.ok(!Peg.parse(pair.shortFirst, 'ab').complete);
  assert.equal(Peg.parse(pair.longFirst, 'ab').consumed, 2);
  assert.ok(Peg.parse(pair.longFirst, 'ab').complete);
  assert.equal(
    Peg.unreachableAlternatives(pair.shortFirst, ['a', 'ab', 'b', 'abc', '']).length, 1);

  prose.quotes('pegs-and-packrat-parsing',
    ['34 steps / 8 entries, plain 191 steps', '5.6×', '70 / 16, plain 5 631', '80.4×',
      '106 / 24, plain 131 071', '1 236.5×', '124 / 28, plain 606 207', '4 888.8×',
      'consumed 1 of 2', 'consumed 2 of 2']);
});

/* ----------------------------------------------------------- 25.9 Pratt */

test('25.9: the Pratt trees, depths and call counts', function () {
  const table = Pratt.standard();
  const measure = function (text) {
    const out = Pratt.parse(table, Pratt.tokenise(text));

    return { text: out.text, depth: Pratt.depth(out.tree), calls: out.steps };
  };

  assert.deepEqual(measure('a + b * c ^ d'),
    { text: '(a + (b * (c ^ d)))', depth: 4, calls: 4 });
  assert.deepEqual(measure('- a + b'), { text: '((- a) + b)', depth: 3, calls: 3 });
  assert.deepEqual(measure('a ++ + b'), { text: '((a ++) + b)', depth: 3, calls: 2 });
  assert.deepEqual(measure('a ? b : c ? d : e'),
    { text: '(a ? b : (c ? d : e))', depth: 3, calls: 5 });
  assert.equal(Pratt.tableRows(table).length, 18, 'eighteen rows in the standard table');

  prose.quotes('pratt-parsing-and-precedence',
    ['(a + (b * (c ^ d))) — depth 4, 4 recursive calls', '((- a) + b), depth 3, 3 calls',
      '((a ++) + b), 2 calls', '(a ? b : (c ? d : e)), 5 calls']);
});

/* --------------------------------------------------------- 25.10 lexing */

test('25.10: the two lexers, and the indentation tokens', function () {
  const cases = [
    { text: '`hello ${name}`', stacked: [6, 3, 1], flat: [3, 1, 0] },
    { text: '`a ${b + `c ${d} e`} f`', stacked: [15, 5, 2], flat: [12, 1, 0] },
    { text: '`p ${q + `r ${s + `t ${u} v`} w`} x`', stacked: [23, 7, 3], flat: [16, 1, 0] }
  ];

  cases.forEach(function (test_) {
    const measure = function (useStack) {
      const out = LexerModes.lex(test_.text, { useStack: useStack });

      return [out.tokens.length, out.maxDepth,
        out.tokens.filter(function (t) { return t.type === 'interpolation-start'; }).length];
    };

    assert.deepEqual(measure(true), test_.stacked, test_.text + ' with the stack');
    assert.deepEqual(measure(false), test_.flat, test_.text + ' without it');
    assert.equal(LexerModes.lex(test_.text, { useStack: true }).errors.length, 0);
    assert.equal(LexerModes.lex(test_.text, { useStack: false }).errors.length, 0);
  });

  const indent = LexerModes.indentTokens(['def f():', '    a = 1', '', '    # a comment line',
    '    if a:', '        b = 2', '    c = 3', 'd = 4'].join('\n'));
  const count = function (type) {
    return indent.tokens.filter(function (t) { return t.type === type; }).length;
  };

  assert.deepEqual([count('INDENT'), count('DEDENT'), count('LINE')], [2, 2, 6]);
  assert.deepEqual(['if a:', '\tb = 1', '        c = 2', '\t\td = 3'].map(function (line) {
    return LexerModes.columnOf(line, 8).column;
  }), [0, 8, 8, 16]);

  prose.quotes('lexing-in-context',
    ['6 tokens, depth 3, 1 interpolation', '15 tokens, depth 5, 2 interpolations',
      '23 tokens, depth 7, 3 interpolations', '12 tokens, depth 1, 0 interpolations',
      '2 INDENT, 2 DEDENT, 6 LINE tokens', 'columns 0, 8, 8, 16']);
});

/* ------------------------------------------------------- 25.11 recovery */

test('25.11: the recovery counts on both fixtures', function () {
  const three = ErrorRecovery.compare(ErrorRecovery.threeErrors());
  const shape = three.map(function (row) {
    return [row.strategy, row.errors, row.suppressed, row.survived, row.repairs];
  });

  assert.deepEqual(shape, [
    ['stop', 1, 0, 1, 0], ['panic', 3, 0, 4, 0], ['repair', 3, 0, 5, 1]
  ]);

  const missing = ErrorRecovery.compare('let a = 1 let b = 2 ;').map(function (row) {
    return [row.errors, row.survived, row.repairs];
  });

  assert.deepEqual(missing, [[1, 0, 0], [1, 1, 0], [1, 2, 1]]);

  const cascade = ErrorRecovery.compare('let = = = ;').map(function (row) {
    return [row.errors, row.suppressed, row.repairs];
  });

  assert.deepEqual(cascade, [[1, 0, 0], [1, 0, 0], [1, 1, 1]]);

  prose.quotes('error-recovery-and-diagnostics',
    ['1 diagnostic, 1 declaration kept', '3 diagnostics, 4 declarations kept',
      '3 diagnostics, 5 declarations kept, 1 repair applied',
      '1 diagnostic, 2 declarations survive, 1 repair',
      '1 diagnostic reported, 1 suppressed as a cascade, 1 repair applied']);
});

/* -------------------------------------------------- 25.12 real languages */

test('25.12: every ASI case, and the two ambiguity fixes', function () {
  RealLanguages.asiCases().forEach(function (test_) {
    assert.equal(RealLanguages.insertSemicolons(test_.source).text, test_.expected,
      test_.name);
  });
  assert.equal(RealLanguages.asiCases().length, 6);

  assert.equal(RealLanguages.classifyC('x * y ;', ['x']).withHack,
    'a declaration of y as a pointer to x');
  assert.equal(RealLanguages.classifyC('x * y ;', []).withHack,
    'a multiplication of x by y');

  const naive = RealLanguages.angleBrackets('vector<vector<int>>', false);
  const fixed = RealLanguages.angleBrackets('vector<vector<int>>', true);

  assert.equal(naive.tokens.join(' '), 'vector < vector < int >>');
  assert.equal(naive.depth, 2);
  assert.equal(fixed.tokens.join(' '), 'vector < vector < int > >');
  assert.equal(fixed.depth, 0);
  assert.equal(RealLanguages.gallery().length, 8);

  prose.quotes('parsing-real-languages',
    ['return ; 1 ;', 'a ; ++ b ;', 'a = b ( c ) ;', 'a = b [ c ] ;', 'a = b + c ;',
      'a = 1 ; b = 2 ;', 'a declaration of y as a pointer to x', 'a multiplication of x by y',
      'vector < vector < int >>', 'vector < vector < int > >', '8 such constructs']);
});
