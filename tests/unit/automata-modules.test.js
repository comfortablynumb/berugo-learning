'use strict';

/**
 * Property tests for the M24 automaton toolkit.
 *
 * Every conversion in this milestone is a theorem with an algorithm attached,
 * and an implementation of a theorem can still be wrong. So each one is checked
 * by EXHAUSTIVE string testing against the machine it came from, and the
 * minimisations are checked against a brute-force Myhill–Nerode computation
 * that never looks at a machine at all — the only reference that cannot share
 * a bug with the algorithms it is judging.
 */

const test = require('node:test');
const assert = require('node:assert');

const Automaton = require('../../src/js/machines/automaton.js');
const Regex = require('../../src/js/algorithms/regex-compile.js');
const Derivatives = require('../../src/js/algorithms/derivatives.js');
const Minimization = require('../../src/js/algorithms/minimization.js');
const Ops = require('../../src/js/algorithms/automaton-ops.js');
const LanguageLab = require('../../src/js/machines/language-lab.js');

const PATTERNS = ['(a|b)*abb', 'a*b*', '(ab)+', 'a?b?a', '((a|b)(a|b))*',
  '(a|b)*a(a|b)(a|b)', '(b|ab*a)*', 'a*', '(a|b)*'];
const ALPHABET = ['a', 'b'];

function thompson(pattern) {
  return Regex.thompson(pattern, ALPHABET);
}

/* --------------------------------------------------- against a real engine */

test('regex-compile: Thompson and Glushkov agree with JavaScript’s own RegExp', function () {
  PATTERNS.forEach(function (pattern) {
    const native = new RegExp('^(?:' + pattern + ')$');
    const machines = [thompson(pattern), Regex.glushkov(pattern, ALPHABET)];

    Automaton.strings(ALPHABET, 9).forEach(function (word) {
      machines.forEach(function (machine, i) {
        assert.strictEqual(Automaton.accepts(machine, word), native.test(word),
          (i === 0 ? 'thompson' : 'glushkov') + '("' + pattern + '") on "' + word + '"');
      });
    });
  });
});

test('derivatives: the DFA agrees with Thompson’s NFA, and closes', function () {
  PATTERNS.concat(['(a*)*', '(a+)+']).forEach(function (pattern) {
    const built = Derivatives.build(pattern, ALPHABET);

    assert.strictEqual(built.truncated, false,
      'the derivative set for ' + pattern + ' must close, not hit the cap');
    const check = Automaton.agree(thompson(pattern), built.dfa, 8);

    assert.strictEqual(check.equivalent, true,
      pattern + ' disagrees on "' + check.counterExample + '"');
  });
});

/* ---------------------------------------------------------- determinisation */

test('automaton: the subset construction preserves the language exactly', function () {
  PATTERNS.forEach(function (pattern) {
    const nfa = thompson(pattern);
    const check = Automaton.agree(nfa, Automaton.toDfa(nfa).dfa, 9);

    assert.strictEqual(check.equivalent, true,
      pattern + ': the DFA disagrees on "' + check.counterExample + '"');
    assert.ok(check.tested > 1000, 'the check must be exhaustive, not a sample');
  });
});

test('automaton: ε-removal, trim, complete and relabel all preserve the language', function () {
  PATTERNS.forEach(function (pattern) {
    const nfa = thompson(pattern);
    const variants = [
      ['ε-free', Automaton.removeEpsilon(nfa)],
      ['trimmed', Automaton.trim(nfa)],
      ['complete', Automaton.complete(Automaton.toDfa(nfa).dfa)],
      ['relabelled', Automaton.relabel(Automaton.toDfa(nfa).dfa).machine]
    ];

    variants.forEach(function (entry) {
      const check = Automaton.agree(nfa, entry[1], 8);

      assert.strictEqual(check.equivalent, true,
        pattern + ' ' + entry[0] + ': disagrees on "' + check.counterExample + '"');
    });
    assert.strictEqual(Automaton.summary(Automaton.removeEpsilon(nfa)).epsilon, false,
      'ε-removal must actually remove them');
    assert.strictEqual(
      Automaton.summary(Automaton.complete(Automaton.toDfa(nfa).dfa)).total, true,
      'completing must make the transition function total');
  });
});

test('language-lab: the exponential family hits 2^(n+1) exactly after minimisation', function () {
  const rows = LanguageLab.blowUp(7);

  rows.forEach(function (row) {
    assert.strictEqual(row.minimalStates, row.predicted,
      'n = ' + row.n + ': expected ' + row.predicted + ' minimal states, got ' +
      row.minimalStates);
    assert.strictEqual(row.dfaStates, row.predicted + 1,
      'and the subset construction over-produces by exactly one at n = ' + row.n);
    assert.strictEqual(row.positions, 2 * row.n + 4,
      'the position automaton grows linearly');
  });
  assert.strictEqual(rows[rows.length - 1].minimalStates, 256, 'n = 7 reaches 256');
});

/* ------------------------------------------------------------ minimisation */

test('minimization: three algorithms agree with the brute-force class count', function () {
  PATTERNS.forEach(function (pattern) {
    const dfa = Automaton.relabel(Automaton.toDfa(thompson(pattern)).dfa).machine;
    const moore = Minimization.moore(dfa);
    const hopcroft = Minimization.hopcroft(dfa);
    const brzozowski = Minimization.brzozowski(dfa);
    const classes = Minimization.myhillNerode(
      Automaton.complete(Automaton.trim(dfa)), 5).count;

    assert.strictEqual(moore.after, classes, pattern + ': Moore against the oracle');
    assert.strictEqual(hopcroft.after, classes, pattern + ': Hopcroft against the oracle');
    assert.strictEqual(brzozowski.after, classes, pattern + ': Brzozowski against the oracle');
    [moore, hopcroft, brzozowski].forEach(function (result) {
      assert.strictEqual(Automaton.agree(dfa, result.minimal, 8).equivalent, true,
        pattern + ': a minimisation changed the language');
    });
  });
});

test('minimization: the result is minimal, and every class pair has a witness', function () {
  PATTERNS.forEach(function (pattern) {
    const dfa = Automaton.toDfa(thompson(pattern)).dfa;
    const minimal = Minimization.hopcroft(dfa).minimal;
    const check = Minimization.isMinimal(minimal, 5);

    assert.strictEqual(check.minimal, true,
      pattern + ': ' + check.states + ' states against ' + check.classes + ' classes');

    const oracle = Minimization.myhillNerode(Automaton.complete(Automaton.trim(dfa)), 5);

    oracle.witnesses.forEach(function (row) {
      assert.notStrictEqual(row.suffix, null,
        pattern + ': "' + row.left + '" and "' + row.right + '" have no witness suffix');
    });
  });
});

test('minimization: refinement terminates and only ever splits', function () {
  PATTERNS.forEach(function (pattern) {
    const dfa = Automaton.relabel(Automaton.toDfa(thompson(pattern)).dfa).machine;
    const run = Minimization.moore(dfa);

    for (let i = 1; i < run.rounds.length; i += 1) {
      assert.ok(run.rounds[i].blocks.length >= run.rounds[i - 1].blocks.length,
        pattern + ': round ' + i + ' has fewer blocks than round ' + (i - 1));
    }
    const last = run.rounds[run.rounds.length - 1];
    const previous = run.rounds[run.rounds.length - 2] || last;

    assert.strictEqual(last.blocks.length, previous.blocks.length,
      'the last round must split nothing');
  });
});

/* --------------------------------------------------- Kleene, the other way */

test('regex-compile: state elimination round-trips in every order', function () {
  PATTERNS.forEach(function (pattern) {
    const minimal = Automaton.relabel(
      Minimization.hopcroft(Automaton.toDfa(thompson(pattern)).dfa).minimal).machine;
    const orders = [minimal.states.slice(), minimal.states.slice().reverse()];

    orders.forEach(function (order, i) {
      const back = Regex.toRegex(minimal, order);
      const rebuilt = Regex.thompson(back.pattern, ALPHABET);
      const check = Automaton.agree(minimal, rebuilt, 7);

      assert.strictEqual(check.equivalent, true,
        pattern + ' order ' + i + ': "' + back.pattern + '" disagrees on "' +
        check.counterExample + '"');
      assert.strictEqual(back.steps.length, minimal.states.length,
        'one step per eliminated state');
    });
  });
});

/* ------------------------------------------------------------- closure ops */

test('automaton-ops: the product computes each Boolean operation correctly', function () {
  const pairs = [['(a|b)*abb', '(a|b)*b'], ['a*b*', '(a|b)*'], ['(ab)*', '(ab)*'],
    ['a(a|b)*', '(a|b)*a(a|b)*'], ['(b|ab*a)*', '((a|b)(a|b))*']];

  pairs.forEach(function (pair) {
    const first = thompson(pair[0]);
    const second = thompson(pair[1]);

    Object.keys(Ops.RULES).forEach(function (operation) {
      const built = Ops.product(first, second, operation);

      Automaton.strings(ALPHABET, 7).forEach(function (word) {
        const expected = Ops.RULES[operation](Automaton.accepts(first, word),
          Automaton.accepts(second, word));

        assert.strictEqual(Automaton.accepts(built.machine, word), expected,
          operation + '(' + pair[0] + ', ' + pair[1] + ') on "' + word + '"');
      });
    });
  });
});

test('automaton-ops: complement flips exactly, on a total machine', function () {
  PATTERNS.forEach(function (pattern) {
    const machine = thompson(pattern);
    const complemented = Ops.complement(machine);

    Automaton.strings(ALPHABET, 8).forEach(function (word) {
      assert.notStrictEqual(Automaton.accepts(complemented, word),
        Automaton.accepts(machine, word),
        'complement(' + pattern + ') agrees with the original on "' + word + '"');
    });
    assert.strictEqual(Ops.isEmpty(Ops.product(machine, complemented, 'intersection').machine),
      true, pattern + ' intersected with its complement must be empty');
  });
});

test('automaton-ops: a containment failure returns a real counter-example', function () {
  const pairs = [['(a|b)*b', '(a|b)*abb'], ['(a|b)*', 'a*b*'], ['a*b*', 'a*'],
    ['((a|b)(a|b))*', '(b|ab*a)*']];

  pairs.forEach(function (pair) {
    const first = thompson(pair[0]);
    const second = thompson(pair[1]);
    const result = Ops.contains(first, second);

    assert.strictEqual(result.contained, false, pair[0] + ' should not be inside ' + pair[1]);
    assert.strictEqual(Automaton.accepts(first, result.counterExample), true,
      'the witness "' + result.counterExample + '" must be accepted by the first');
    assert.strictEqual(Automaton.accepts(second, result.counterExample), false,
      'and rejected by the second');
  });
});

test('automaton-ops: equivalence is exact, in both directions', function () {
  const same = [['(a|b)*abb', '(a|b)*abb'], ['(ab)+', 'ab(ab)*'], ['a*a*', 'a*']];

  same.forEach(function (pair) {
    const result = Ops.equivalent(thompson(pair[0]), thompson(pair[1]));

    assert.strictEqual(result.equivalent, true,
      pair[0] + ' and ' + pair[1] + ' should be equivalent, counter-example "' +
      result.counterExample + '"');
  });

  const different = [['(a|b)*abb', '(a|b)*b'], ['a*b*', '(a|b)*']];

  different.forEach(function (pair) {
    const result = Ops.equivalent(thompson(pair[0]), thompson(pair[1]));

    assert.strictEqual(result.equivalent, false, pair[0] + ' and ' + pair[1] + ' differ');
    const first = Automaton.accepts(thompson(pair[0]), result.counterExample);
    const second = Automaton.accepts(thompson(pair[1]), result.counterExample);

    assert.notStrictEqual(first, second,
      'the witness "' + result.counterExample + '" must separate them');
  });
});

test('automaton-ops: shortest returns the shortest word, and null on an empty language', function () {
  assert.strictEqual(Ops.shortestWord(thompson('(a|b)*abb')), 'abb');
  assert.strictEqual(Ops.shortestWord(thompson('a*b*')), '');
  assert.strictEqual(Ops.shortestWord(thompson('(ab)+')), 'ab');

  const empty = Ops.product(thompson('a*'), thompson('b(a|b)*'), 'intersection');

  assert.strictEqual(Ops.shortestWord(empty.machine), null,
    'nothing starts with b and consists only of a');
});

test('automaton-ops: concatenation and star build the languages they claim', function () {
  const a = thompson('a*');
  const b = thompson('b*');
  const joined = Ops.concat(a, b);
  const native = new RegExp('^(?:a*b*)$');

  Automaton.strings(ALPHABET, 7).forEach(function (word) {
    assert.strictEqual(Automaton.accepts(joined, word), native.test(word),
      'concat(a*, b*) on "' + word + '"');
  });

  const starred = Ops.star(thompson('ab'));
  const nativeStar = new RegExp('^(?:(?:ab)*)$');

  Automaton.strings(ALPHABET, 7).forEach(function (word) {
    assert.strictEqual(Automaton.accepts(starred, word), nativeStar.test(word),
      'star(ab) on "' + word + '"');
  });
});

/* ---------------------------------------------------------- language lab */

test('language-lab: every regular row is confirmed by an automaton', function () {
  LanguageLab.catalogue().forEach(function (row) {
    const study = LanguageLab.study(row.id, 6);

    if (row.pattern === null) {
      assert.strictEqual(study.machineAgrees, null,
        row.id + ' offers no automaton, so none should be reported');
      return;
    }
    assert.strictEqual(study.machineAgrees.agrees, true,
      row.id + ': the automaton disagrees on ' + study.machineAgrees.disagreements + ' strings');
    assert.strictEqual(row.klass, 'regular',
      'only a regular row may carry a pattern');
  });
});

test('language-lab: the pumping game refutes the non-regular languages and declines the regular one', function () {
  const words = { anbn: 'aaaabbbb', palindrome: 'aaaabaaaa', squares: 'a'.repeat(16) };

  Object.keys(words).forEach(function (id) {
    const round = LanguageLab.pumpingRound({ word: words[id], pumpingLength: 4,
      accepts: LanguageLab.entry(id).accepts, maxExponent: 3 });

    assert.strictEqual(round.everySplitLoses, true,
      id + ': ' + round.survivors.length + ' decompositions survived pumping');
    assert.ok(round.splits.length >= 10, 'every decomposition must be enumerated');
  });

  const control = LanguageLab.pumpingRound({ word: 'a'.repeat(8), pumpingLength: 4,
    accepts: LanguageLab.entry('even-a').accepts, maxExponent: 3 });

  assert.strictEqual(control.everySplitLoses, false,
    'the lemma must decline on a language that is regular');
  assert.ok(control.survivors.length > 0, 'and some decomposition must survive');
});

test('language-lab: the distinguishing family is pairwise separated, and grows', function () {
  [4, 6, 9].forEach(function (size) {
    const family = LanguageLab.anbnFamily(size);

    assert.strictEqual(family.prefixes.length, size);
    assert.strictEqual(family.pairs.length, size * (size - 1) / 2);
    assert.strictEqual(family.allDistinguished, true,
      'every pair needs a witness at size ' + size);
    family.pairs.forEach(function (row) {
      const accepts = LanguageLab.entry('anbn').accepts;

      assert.notStrictEqual(accepts(row.left + row.suffix), accepts(row.right + row.suffix),
        '"' + row.suffix + '" must separate "' + row.left + '" from "' + row.right + '"');
    });
  });

  const regular = LanguageLab.distinguishingFamily({
    prefixes: ['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa'],
    suffixes: ['a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa'],
    accepts: LanguageLab.entry('even-a').accepts });

  assert.strictEqual(regular.allDistinguished, false,
    'a regular language’s family must collapse rather than grow');
});
