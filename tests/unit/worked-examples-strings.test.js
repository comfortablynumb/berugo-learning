'use strict';

/**
 * Every figure the M15.1-M15.3 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Kmp = require('../../src/js/algorithms/kmp.js');
const Z = require('../../src/js/algorithms/z-algorithm.js');
const MatchLab = require('../../src/js/machines/match-lab.js');

require('../../src/js/content/concepts-strings.js');
require('../../src/js/content/examples-strings.js');
const prose = require('../support/worked-example-prose.js');

function rowFor(run, key) {
  return run.rows.filter(function (row) { return row.key === key; })[0];
}

/* ---------------------------------------------------------------- 15.1 */

test('naive-matching: English costs 1.05 comparisons per character', function () {
  const instance = MatchLab.corpus('english', {});
  const run = MatchLab.compareMatchers(instance, {});
  const naive = rowFor(run, 'naive');

  assert.strictEqual(naive.report.comparisons, 4211);
  assert.strictEqual(instance.text.length, 4000);
  assert.strictEqual(prose.fixed(naive.report.comparisons / instance.text.length), '1.05');
  assert.strictEqual(naive.report.alignments, 3998);
  assert.strictEqual(naive.report.entered, 3998);
  assert.strictEqual(run.disagreements, 0, 'the work columns mean nothing until every row agrees');
  prose.quotes('naive-matching', ['4 211 comparisons over 4 000 characters', '1.05']);
});

test('naive-matching: the filter enters 191 alignments and saves no comparison', function () {
  const instance = MatchLab.corpus('english', {});
  const run = MatchLab.compareMatchers(instance, {});
  const plain = rowFor(run, 'naive');
  const filtered = rowFor(run, 'naive-filter');

  assert.strictEqual(filtered.report.comparisons, plain.report.comparisons);
  assert.strictEqual(filtered.report.entered, 191);
  assert.strictEqual(filtered.report.skipped, 3807);
  assert.strictEqual(prose.fixed(plain.report.entered / filtered.report.entered, 1), '20.9');
  prose.quotes('naive-matching',
    ['4 211 with the filter and 4 211 without', '3 998 entries fall to 191', '20.9',
      '3 807 alignments skipped', '191 of 3 998 alignments entered']);
});

test('naive-matching: the adversarial corpus arrives at 11.97 per character', function () {
  const instance = MatchLab.corpus('adversarial', {});
  const run = MatchLab.compareMatchers(instance, {});
  const naive = rowFor(run, 'naive');

  assert.strictEqual(instance.pattern.length, 12);
  assert.strictEqual(naive.report.comparisons, 47868);
  assert.strictEqual(prose.fixed(naive.report.comparisons / instance.text.length), '11.97');
  assert.strictEqual(naive.report.entered, 3989);
  assert.strictEqual(naive.report.alignments, 3989);
  const filtered = rowFor(run, 'naive-filter');

  assert.strictEqual(filtered.report.skipped, 0, 'the filter skips nothing here');
  prose.quotes('naive-matching',
    ['47 868 comparisons', '11.97', '3 989 of 3 989 alignments enter the inner loop']);
});

test('naive-matching: the cost rises monotonically as the alphabet shrinks', function () {
  const rates = {};

  ['english', 'dna', 'binary', 'repeated'].forEach(function (name) {
    const instance = MatchLab.corpus(name, {});
    const naive = rowFor(MatchLab.compareMatchers(instance, {}), 'naive');

    rates[name] = prose.fixed(naive.report.comparisons / instance.text.length);
  });
  assert.deepStrictEqual(rates,
    { english: '1.05', dna: '1.35', binary: '1.99', repeated: '4.00' });
  assert.strictEqual(MatchLab.alphabetOf(MatchLab.corpus('english', {}).text).length, 26);
  assert.strictEqual(MatchLab.alphabetOf(MatchLab.corpus('dna', {}).text).length, 4);
  assert.strictEqual(MatchLab.alphabetOf(MatchLab.corpus('binary', {}).text).length, 2);
  prose.quotes('naive-matching',
    ['English 26 symbols at 1.05, DNA 4 at 1.35, binary 2 at 1.99']);
});

/* ---------------------------------------------------------------- 15.2 */

test('kmp-prefix-function: the border array of "ababcabab" and what it says', function () {
  const pattern = 'ababcabab';
  const border = Kmp.prefixFunction(pattern, {});

  assert.deepStrictEqual(border, [0, 0, 1, 2, 0, 1, 2, 3, 4]);
  assert.deepStrictEqual(border, Kmp.bordersByBruteForce(pattern));
  const period = Kmp.period(pattern);

  assert.strictEqual(period.border, 4);
  assert.strictEqual(period.period, 5);
  assert.strictEqual(period.exact, false, '5 does not divide 9');
  const counts = Kmp.prefixOccurrences('aabaaab');

  assert.strictEqual(counts[0], 5, 'the first character occurs five times');
  assert.strictEqual(counts[6], 1, 'and the whole string once');
  prose.quotes('kmp-prefix-function',
    ['0, 0, 1, 2, 0, 1, 2, 3, 4', '9 − 4 = 5', 'the first character occurs 5 times']);
});

test('kmp-prefix-function: KMP is slightly slower than the naive scan on English', function () {
  const instance = MatchLab.corpus('english', { pattern: 'ababcabab' });
  const run = MatchLab.compareMatchers(instance, { pattern: 'ababcabab' });
  const kmp = rowFor(run, 'kmp');
  const naive = rowFor(run, 'naive');

  assert.strictEqual(prose.fixed(kmp.report.comparisons / instance.text.length), '1.08');
  assert.strictEqual(prose.fixed(naive.report.comparisons / instance.text.length), '1.07');
  assert.ok(kmp.report.comparisons > naive.report.comparisons,
    'KMP buys the absence of a cliff, not speed');
  assert.strictEqual(run.disagreements, 0);
  prose.quotes('kmp-prefix-function', ['KMP 1.08 comparisons per character against the naive 1.07']);
});

test('kmp-prefix-function: 6.0x on the adversarial corpus and one per character on the repeated one',
  function () {
    const adversarial = MatchLab.corpus('adversarial', {});
    const hard = MatchLab.compareMatchers(adversarial, {});

    assert.strictEqual(rowFor(hard, 'naive').report.comparisons, 47868);
    assert.strictEqual(rowFor(hard, 'kmp').report.comparisons, 7989);
    assert.strictEqual(prose.fixed(47868 / 7989, 1), '6.0');
    const repeated = MatchLab.corpus('repeated', {});
    const easy = MatchLab.compareMatchers(repeated, {});

    assert.strictEqual(rowFor(easy, 'kmp').report.comparisons, 4000);
    assert.strictEqual(rowFor(easy, 'naive').report.comparisons, 15988);
    assert.strictEqual(prose.fixed(15988 / 4000, 1), '4.0');
    prose.quotes('kmp-prefix-function',
      ['naive 47 868 comparisons, KMP 7 989', '6.0', 'KMP 4 000 comparisons', '15 988', '4.0']);
  });

test('kmp-prefix-function: the automaton costs 40 cells on DNA and 260 on English', function () {
  const pattern = 'ababcabab';
  const dna = Kmp.automaton(pattern, 'ACGT', {});
  const english = Kmp.automaton(pattern, 'abcdefghijklmnopqrstuvwxyz', {});

  assert.strictEqual(dna.states, 10);
  assert.strictEqual(dna.cells, 40);
  assert.strictEqual(english.states, 10);
  assert.strictEqual(english.cells, 260);
  assert.strictEqual(prose.fixed(260 / 40, 1), '6.5');
  const text = MatchLab.corpus('dna', {}).text;
  const run = Kmp.searchByAutomaton(text, pattern, dna, {});

  assert.strictEqual(run.report.comparisons, 4000, 'one lookup per character, no inner loop');
  prose.quotes('kmp-prefix-function',
    ['10 states, 40 cells', '10 states, 260 cells', '6.5', '4 000 comparisons']);
});

/* ---------------------------------------------------------------- 15.3 */

test('z-algorithm: the window answers 11 of 18 positions on the traced string', function () {
  const text = 'aabxaabxcaabxaabxay';
  const run = Z.zArray(text, { trace: true });

  assert.strictEqual(text.length, 19);
  assert.deepStrictEqual(run.z, Z.zByBruteForce(text));
  const inside = run.trace.filter(function (entry) { return entry.kind === 'inside'; });

  assert.strictEqual(run.trace.length, 18, 'position 0 is the whole string and is not traced');
  assert.strictEqual(inside.length, 11);
  assert.strictEqual(run.trace.length - inside.length, 7);
  const extensions = run.trace.reduce(function (sum, entry) { return sum + entry.extended; }, 0);

  assert.strictEqual(extensions, 14);
  let edge = 0;

  run.trace.forEach(function (entry) {
    assert.ok(entry.right >= edge, 'the right edge fell at position ' + entry.at);
    edge = entry.right;
  });
  prose.quotes('z-algorithm',
    ['19 values', '11 of 18 positions were inside the window', '7 started from nothing',
      '14 extensions']);
});

test('z-algorithm: matching by concatenation costs more than KMP on English', function () {
  const instance = MatchLab.corpus('english', { pattern: 'ababcabab' });
  const run = MatchLab.compareMatchers(instance, { pattern: 'ababcabab' });

  assert.strictEqual(rowFor(run, 'z').report.comparisons, 4320);
  assert.strictEqual(rowFor(run, 'kmp').report.comparisons, 4304);
  assert.deepStrictEqual(rowFor(run, 'z').positions, run.truth);
  prose.quotes('z-algorithm', ['4 320 comparisons against KMP’s 4 304'.replace('’', "'")]);
});

test('z-algorithm: Fine and Wilf never applies to a Fibonacci word', function () {
  const rows = [8, 34].map(function (length) {
    let order = 1;

    while (Z.fibonacciWord(order).length < length) order += 1;
    const word = Z.fibonacciWord(order);
    const periods = Kmp.periodsByBruteForce(word).filter(function (p) { return p < word.length; });

    return { length: word.length, p: periods[0], q: periods[1],
      bound: Z.fineAndWilf(word, periods[0], periods[1]).bound };
  });

  assert.strictEqual(rows[0].length, 8);
  assert.strictEqual(rows[0].p, 5);
  assert.strictEqual(rows[0].q, 7);
  assert.strictEqual(rows[0].bound, 11);
  assert.strictEqual(rows[1].length, 34);
  assert.strictEqual(rows[1].p, 21);
  assert.strictEqual(rows[1].q, 29);
  assert.strictEqual(rows[1].bound, 49);
  rows.forEach(function (row) {
    assert.ok(row.bound > row.length, 'the bound must exceed the length, or the lemma applies');
  });
  prose.quotes('z-algorithm',
    ['length 8 with periods 5 and 7 gives a bound of 11', 'length 34 with 21 and 29']);
});

test('z-algorithm: the bound is tight to the character, coprime or not', function () {
  const coprime = Z.tightness(5, 8);

  assert.strictEqual(coprime.bound, 12);
  assert.strictEqual(coprime.gcd, 1);
  assert.strictEqual(coprime.atBound, 1);
  assert.strictEqual(coprime.belowBound, 2);
  const shared = Z.tightness(6, 9);

  assert.strictEqual(shared.bound, 12);
  assert.strictEqual(shared.gcd, 3);
  assert.strictEqual(shared.atBound, 3);
  assert.strictEqual(shared.belowBound, 4);
  prose.quotes('z-algorithm',
    ['for p = 5 and q = 8 the bound is 12', 'p = 6 and q = 9 give a bound of 12 with 3 classes']);
});
