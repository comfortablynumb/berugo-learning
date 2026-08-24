/**
 * Property tests for the M25 parsing modules.
 *
 * The governing rule of this milestone is that every parser is differentially
 * tested against Earley on the same grammar and the same inputs, and that any
 * disagreement fails the build with the input named. Earley itself is checked
 * against a brute-force derivation search, so the reference is not taken on
 * trust either.
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
const LrItems = require(path.join(BASE, 'algorithms', 'lr-items.js'));
const LrParser = require(path.join(BASE, 'algorithms', 'lr-parser.js'));
const Glr = require(path.join(BASE, 'algorithms', 'glr.js'));
const Pda = require(path.join(BASE, 'algorithms', 'pda.js'));
const Transform = require(path.join(BASE, 'algorithms', 'grammar-transform.js'));
const ParseLab = require(path.join(BASE, 'machines', 'parse-lab.js'));

/* ------------------------------------------------------------- the sweep */

test('every parser agrees with Earley on every fixture, over every short input', function () {
  let checked = 0;

  ParseLab.fixtureNames().forEach(function (name) {
    const result = ParseLab.sweep(ParseLab.fixture(name), 4);

    checked += result.checked;
    assert.deepEqual(result.failures, [],
      name + ': a parser disagreed with Earley — ' + JSON.stringify(result.failures.slice(0, 3)));
  });
  assert.ok(checked > 13000,
    'expected more than 13 000 parser-input checks, ran ' + checked);
});

/** Earley is the reference for everything else, so it is checked against a
 *  brute-force derivation search rather than being assumed. */
test('Earley agrees with a brute-force derivation search', function () {
  const grammars = ['ambiguousSum', 'balanced', 'nullable', 'll1Ready'];

  grammars.forEach(function (name) {
    const grammar = ParseLab.fixture(name);
    const language = Grammar.language(grammar, 5).words;

    ParseLab.exhaustive(grammar.terminals, 4).forEach(function (tokens) {
      const derivable = language.indexOf(tokens.join('')) !== -1;

      assert.equal(Earley.parse(grammar, tokens).accepted, derivable,
        name + ': disagreement on "' + (tokens.join(' ') || 'the empty string') + '"');
    });
  });
});

/* ------------------------------------------------------------ ε-handling */

test('the nullable grammar that breaks naive Earley is handled by all three parsers', function () {
  const grammar = ParseLab.fixture('nullable');

  [[], ['a'], ['a', 'a'], ['a', 'a', 'a'], ['a', 'a', 'a', 'a']].forEach(function (tokens) {
    assert.ok(Earley.parse(grammar, tokens).accepted,
      'Earley must accept ' + tokens.length + ' a-s');
    assert.ok(Cyk.parse(grammar, tokens).accepted, 'CYK must agree');
    assert.ok(Glr.parse(grammar, tokens).accepted, 'GLR must agree');
  });
  assert.ok(!Earley.parse(grammar, ['a', 'a', 'a', 'a', 'a']).accepted, 'five a is too many');
  assert.equal(Earley.ambiguity(grammar, [], 50), 1, 'one way to make all four empty');
  assert.equal(Earley.ambiguity(grammar, ['a', 'a'], 50), 6,
    'four choose two ways to place the two a-s');
});

/* --------------------------------------------------- grammar transforms */

test('every transformation preserves the language on every fixture', function () {
  const order = ['useless', 'epsilon', 'unit', 'left-recursion', 'left-factor', 'cnf'];

  ParseLab.fixtureNames().forEach(function (name) {
    const grammar = ParseLab.fixture(name);
    const result = Transform.pipeline(grammar, order, 5);

    result.rows.forEach(function (row) {
      assert.ok(row.preserved,
        name + ' lost its language at the ' + row.step + ' step: missing ' +
          JSON.stringify(row.missing) + ' extra ' + JSON.stringify(row.extra));
    });
  });
});

test('left-recursion elimination removes both direct and indirect recursion', function () {
  const indirect = Grammar.create({
    start: 'A',
    productions: { A: [['B', 'x'], ['c']], B: [['A', 'y'], ['d']] },
    label: 'indirect'
  });
  const out = Transform.eliminateLeftRecursion(indirect).grammar;

  assert.deepEqual(Transform.leftRecursive(out), [],
    'Paull’s ordering must clear the indirect cycle');
  assert.ok(Grammar.sameLanguage(indirect, out, 6).same, 'and keep the language');

  const direct = ParseLab.fixture('leftRecursive');
  const fixed = Transform.eliminateLeftRecursion(direct).grammar;

  assert.deepEqual(Transform.leftRecursive(direct), ['E'], 'E is left recursive to begin with');
  assert.deepEqual(Transform.leftRecursive(fixed), [], 'and is not afterwards');
});

/* ------------------------------------------------------------- LL tables */

test('the LL(1) table is conflict-free exactly when the grammar is', function () {
  const expectations = {
    ll1Ready: 0, balanced: 0, leftRecursive: 1, danglingElse: 1, precedenceSum: 4
  };

  Object.keys(expectations).forEach(function (name) {
    const built = LlParser.table(ParseLab.fixture(name));

    assert.equal(built.conflicts.length, expectations[name],
      name + ': expected ' + expectations[name] + ' conflicts, got ' + built.conflicts.length);
    assert.equal(built.isLL1, expectations[name] === 0);
  });
});

test('every LL(1) conflict names a reachable input', function () {
  ['leftRecursive', 'danglingElse'].forEach(function (name) {
    const grammar = ParseLab.fixture(name);
    const built = LlParser.table(grammar);

    built.conflicts.forEach(function (conflict) {
      const witness = LlParser.conflictExample(grammar, conflict, 5);

      assert.ok(typeof witness === 'string' && witness.length > 0,
        name + ': the conflict on ' + conflict.nonterminal + '/' + conflict.terminal +
          ' has no witness up to length 5');
    });
  });
});

test('the diagnosis names the cause, and the repair that matches it works', function () {
  assert.equal(LlParser.diagnose(ParseLab.fixture('leftRecursive')).leftRecursive.length, 1);
  assert.equal(LlParser.diagnose(ParseLab.fixture('danglingElse')).sharedPrefixes.length, 1);

  const repaired = Transform.leftFactor(
    Transform.eliminateLeftRecursion(ParseLab.fixture('leftRecursive')).grammar).grammar;

  assert.equal(LlParser.table(repaired).conflicts.length, 0,
    'left-recursion elimination fixes a left-recursive grammar');

  const stubborn = Transform.leftFactor(
    Transform.eliminateLeftRecursion(ParseLab.fixture('danglingElse')).grammar).grammar;

  assert.equal(LlParser.table(stubborn).conflicts.length, 1,
    'and neither repair fixes an ambiguous one — that is the point of the section');
});

/* ------------------------------------------------------------- LR tables */

test('merging by core never induces a shift/reduce conflict', function () {
  ParseLab.fixtureNames().forEach(function (name) {
    const by = {};

    LrParser.compare(ParseLab.fixture(name)).forEach(function (row) { by[row.mode] = row; });
    /* Shift actions come from transitions, which depend on the core alone — so
       LALR, which merges cores, must have exactly the shift/reduce conflicts
       canonical LR(1) has. LR(0) is excluded: it reduces on every terminal and
       therefore has shift/reduce conflicts about lookahead rather than cores. */
    assert.equal(by.lalr.shiftReduce, by.lr1.shiftReduce,
      name + ': LALR has ' + by.lalr.shiftReduce + ' shift/reduce conflicts and canonical ' +
        'LR(1) has ' + by.lr1.shiftReduce + ' — a merge cannot create one');
    assert.ok(by.lr0.shiftReduce >= by.slr.shiftReduce,
      name + ': restricting reduce to FOLLOW can only remove conflicts');
    assert.equal(new Set([by.lr0.states, by.slr.states, by.lalr.states]).size, 1,
      name + ': LR(0), SLR and LALR must all have the LR(0) state count');
    assert.ok(by.lr1.states >= by.lalr.states,
      name + ': canonical LR(1) never has fewer states than the merged table');
  });
});

test('the standard non-LALR grammar: LR(1) is clean and the merge costs two conflicts',
  function () {
    const rows = LrParser.compare(ParseLab.fixture('nonLalr'));
    const by = {};

    rows.forEach(function (row) { by[row.mode] = row; });
    assert.equal(by.lr1.states, 14, 'canonical LR(1) needs 14 states');
    assert.equal(by.lr1.conflicts, 0, 'and has no conflicts');
    assert.equal(by.lalr.states, 13, 'LALR merges one pair down to 13');
    assert.equal(by.lalr.merged, 1, 'exactly one core appeared twice');
    assert.equal(by.lalr.reduceReduce, 2, 'and the merge induced two reduce/reduce conflicts');
    assert.equal(by.lalr.shiftReduce, 0, 'a merge cannot induce a shift/reduce conflict');
  });

test('the dangling-else conflict survives every flavour and names its items', function () {
  LrParser.MODES.forEach(function (mode) {
    const built = LrParser.build(ParseLab.fixture('danglingElse'), mode);

    assert.equal(built.conflicts.length, 1, mode + ': the ambiguity is in the grammar');
    const conflict = built.conflicts[0];

    assert.equal(conflict.kind, 'shift/reduce');
    assert.equal(conflict.terminal, 'e');
    assert.ok(conflict.first.length > 0 && conflict.second.length > 0,
      'both competing actions must be named');
    assert.ok(conflict.items.length >= 2,
      'the report must name the items responsible, not only a count');
    assert.ok(conflict.items.some(function (item) { return item.indexOf('•') !== -1; }),
      'the items carry the dot');
  });
});

test('closure adds exactly the productions the dot can begin', function () {
  const augmented = LrItems.augment(ParseLab.fixture('leftRecursive'));
  const collection = LrItems.collection(augmented, 'lr0');
  const rows = LrItems.stateRows(collection);

  assert.equal(rows[0].kernel.length, 1, 'state 0 has one kernel item');
  assert.ok(rows[0].items.length > rows[0].kernel.length, 'and closure adds more');
  rows[0].items.forEach(function (item) {
    assert.ok(item.indexOf('→ •') !== -1 || item === rows[0].kernel[0],
      'every closure item has its dot at the start: ' + item);
  });
});

/* ------------------------------------------------------------------ GLR */

test('GLR unfolds exactly as many trees as Earley finds', function () {
  const grammar = ParseLab.fixture('ambiguousSum');

  for (let operands = 1; operands <= 6; operands += 1) {
    const tokens = ['a'];

    for (let i = 1; i < operands; i += 1) { tokens.push('+'); tokens.push('a'); }
    const fromGlr = Glr.trees(Glr.parse(grammar, tokens), 500).length;
    const fromEarley = Earley.trees(Earley.parse(grammar, tokens), 500).length;

    assert.equal(fromGlr, fromEarley,
      operands + ' operands: GLR found ' + fromGlr + ' trees and Earley ' + fromEarley);
  }
});

test('the forest grows quadratically while the tree count does not', function () {
  const grammar = ParseLab.fixture('ambiguousSum');
  const rows = [3, 5, 7, 9, 11].map(function (operands) {
    const tokens = ['a'];

    for (let i = 1; i < operands; i += 1) { tokens.push('+'); tokens.push('a'); }
    return { operands: operands, nodes: Glr.parse(grammar, tokens).nodes,
      trees: Earley.ambiguity(grammar, tokens, 40000) };
  });

  assert.deepEqual(rows.map(function (r) { return r.nodes; }), [11, 24, 41, 62, 87],
    'the forest node count is bounded by the (symbol, span) pairs');
  assert.deepEqual(rows.map(function (r) { return r.trees; }), [2, 14, 132, 1430, 16796],
    'and the tree count is the Catalan sequence');
});

/* ------------------------------------------------------------------ PDA */

test('the CFG to PDA construction accepts exactly what the grammar derives', function () {
  ['balanced', 'll1Ready', 'nullable'].forEach(function (name) {
    const grammar = ParseLab.fixture(name);
    const machine = Pda.fromGrammar(grammar);
    let checked = 0;

    ParseLab.exhaustive(grammar.terminals, 4).forEach(function (tokens) {
      const run = Pda.run(machine, tokens, 8000);

      if (run.exhausted && !run.accepted) return;
      checked += 1;
      assert.equal(run.accepted, Earley.parse(grammar, tokens).accepted,
        name + ': disagreement on "' + (tokens.join(' ') || 'the empty string') + '"');
    });
    assert.ok(checked >= 5, name + ': only ' + checked + ' inputs were conclusive');
  });
});

test('the hand-built machines recognise their advertised languages', function () {
  const brackets = Pda.brackets();
  const balanced = function (text) {
    let depth = 0;

    for (let i = 0; i < text.length; i += 1) {
      depth += text[i] === '(' ? 1 : -1;
      if (depth < 0) return false;
    }
    return depth === 0;
  };

  ParseLab.exhaustive(['(', ')'], 6).forEach(function (tokens) {
    assert.equal(Pda.accepts(brackets, tokens, 20000), balanced(tokens.join('')),
      'brackets: disagreement on "' + tokens.join('') + '"');
  });

  const anbn = Pda.anbn();

  for (let n = 0; n <= 4; n += 1) {
    const tokens = [];

    for (let i = 0; i < n; i += 1) tokens.push('a');
    for (let i = 0; i < n; i += 1) tokens.push('b');
    assert.ok(Pda.accepts(anbn, tokens, 20000), 'a^' + n + 'b^' + n + ' must be accepted');
  }
  assert.ok(!Pda.accepts(anbn, ['a', 'a', 'b'], 20000), 'unequal counts are rejected');
  assert.ok(!Pda.accepts(anbn, ['b', 'a'], 20000), 'wrong order is rejected');
});

test('a capped search reports the cap rather than a rejection', function () {
  const machine = Pda.fromGrammar(ParseLab.fixture('ambiguousSum'));
  const run = Pda.run(machine, ['a', '+', 'a', '+', 'a', '+', 'a'], 400);

  assert.ok(run.exhausted || run.accepted,
    'a left-recursive grammar either accepts or exhausts the cap; a bare false would be a lie');
});
