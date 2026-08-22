'use strict';

/**
 * Every figure the M15.4-M15.6 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const BoyerMoore = require('../../src/js/algorithms/boyer-moore.js');
const RabinKarp = require('../../src/js/algorithms/rabin-karp.js');
const AhoCorasick = require('../../src/js/algorithms/aho-corasick.js');
const MatchLab = require('../../src/js/machines/match-lab.js');

require('../../src/js/content/concepts-strings-skip.js');
require('../../src/js/content/examples-strings-skip.js');
const prose = require('../support/worked-example-prose.js');

function rateRow(sweep, key) {
  return sweep.map(function (entry) { return prose.fixed(entry.rates[key], 3); });
}

/* ---------------------------------------------------------------- 15.4 */

test('boyer-moore: the only matcher whose cost per character falls', function () {
  const sweep = MatchLab.lengthSweep(MatchLab.corpus('english', {}), { lengths: [2, 4, 8, 16, 32], from: 400 });

  assert.deepStrictEqual(sweep.map(function (entry) { return entry.length; }),
    [2, 4, 8, 16, 32]);
  sweep.forEach(function (entry) {
    assert.strictEqual(entry.agree, true, 'length ' + entry.length + ' had a disagreement');
  });
  assert.deepStrictEqual(rateRow(sweep, 'boyer-moore'),
    ['0.611', '0.324', '0.165', '0.131', '0.106']);
  assert.deepStrictEqual(rateRow(sweep, 'kmp'),
    ['1.048', '1.056', '1.055', '1.054', '1.052']);
  assert.deepStrictEqual(rateRow(sweep, 'naive'),
    ['1.057', '1.068', '1.072', '1.080', '1.096']);
  prose.quotes('boyer-moore',
    ['0.611, 0.324, 0.165, 0.131, 0.106', '1.048, 1.056, 1.055, 1.054, 1.052',
      '1.057, 1.068, 1.072, 1.080, 1.096']);
});

test('boyer-moore: 58% of KMP at length 2 and 10% at length 32', function () {
  const sweep = MatchLab.lengthSweep(MatchLab.corpus('english', {}), { lengths: [2, 4, 8, 16, 32], from: 400 });
  const first = sweep[0];
  const last = sweep[sweep.length - 1];
  const shortShare = Math.round(100 * first.rates['boyer-moore'] / first.rates.kmp);
  const longShare = Math.round(100 * last.rates['boyer-moore'] / last.rates.kmp);

  assert.strictEqual(shortShare, 58);
  assert.strictEqual(longShare, 10);
  assert.strictEqual(prose.fixed(shortShare / longShare, 1), '5.8');
  prose.quotes('boyer-moore',
    ['at length 2 Boyer-Moore does 58% of KMP', 'at length 32 it does 10%', '5.8']);
});

test('boyer-moore: the bad-character table for "the" slides by 1, 1, 2 and 3', function () {
  const table = BoyerMoore.badCharacterTable('the', {});
  const m = 'the'.length;

  assert.strictEqual(m - 1 - table.e, 0, 'the last character is never a shift source');
  assert.strictEqual(m - 1 - table.h, 1);
  assert.strictEqual(m - 1 - table.t, 2);
  assert.strictEqual(Object.keys(table).length, 3, 'three distinct characters, 23 letters absent');
  prose.quotes('boyer-moore',
    ['e slides by 1, h by 1, t by 2', 'the other 23 letters by the ' + 'full 3']);
});

test('boyer-moore: the bad-character rule decides 87% of the contested shifts', function () {
  const english = MatchLab.corpus('english', {});
  const sweep = MatchLab.ruleSweep(english, {});
  const byRule = {};

  sweep.forEach(function (row) { byRule[row.rules] = row; });
  assert.strictEqual(byRule.both.comparisons, 1553);
  assert.strictEqual(byRule['bad-character'].comparisons, 1615);
  assert.strictEqual(byRule['good-suffix'].comparisons, 3641);
  assert.strictEqual(byRule.both.badWins, 1195);
  assert.strictEqual(byRule.both.goodWins, 139);
  assert.strictEqual(byRule.both.ties, 40);
  assert.strictEqual(Math.round(100 * 1195 / (1195 + 139 + 40)), 87);
  prose.quotes('boyer-moore',
    ['both 1 553 comparisons, bad character alone 1 615, good suffix alone 3 641',
      'bad character 1 195, good suffix 139, tied 40', '87%',
      '1 195 of 1 374 contested shifts']);
});

test('boyer-moore: the best of the three variants changes hands with the alphabet', function () {
  const table = {};

  ['english', 'source', 'dna', 'binary', 'adversarial', 'repeated'].forEach(function (name) {
    const instance = MatchLab.corpus(name, {});
    const run = MatchLab.compareMatchers(instance, {});

    table[name] = ['boyer-moore', 'horspool', 'sunday'].map(function (key) {
      return run.rows.filter(function (row) { return row.key === key; })[0].report.comparisons;
    });
  });
  assert.deepStrictEqual(table.english, [1553, 1553, 1265]);
  assert.deepStrictEqual(table.source, [80, 77, 74]);
  assert.deepStrictEqual(table.dna, [1927, 2611, 2108]);
  assert.deepStrictEqual(table.binary, [1855, 5978, 5328]);
  assert.deepStrictEqual(table.adversarial, [3989, 3989, 23940]);
  assert.deepStrictEqual(table.repeated, [15988, 15988, 15988]);
  prose.quotes('boyer-moore',
    ['English 1 553 / 1 553 / 1 265 and source 80 / 77 / 74',
      'DNA 1 927 / 2 611 / 2 108 and binary 1 855 / 5 978 / 5 328',
      'adversarial 3 989 / 3 989 / 23 940 and repeated 15 988']);
});

/* ---------------------------------------------------------------- 15.5 */

test('rolling-hashes: the modulus moves the spurious hits and not the answer', function () {
  const text = MatchLab.corpus('english', {}).text;
  const rows = [101, 1009, 1000003, 999999937].map(function (modulus) {
    const run = RabinKarp.search(text, 'the', { modulus: modulus });

    return { modulus: modulus, hits: run.report.hashHits, spurious: run.report.spurious,
      comparisons: run.report.comparisons, found: run.positions.length,
      positions: run.positions };
  });

  assert.strictEqual(rows[0].hits, 31);
  assert.strictEqual(rows[0].spurious, 19);
  assert.strictEqual(rows[0].comparisons, 55);
  assert.strictEqual(rows[0].found, 12);
  assert.strictEqual(prose.fixed((text.length - 2) / 101), '39.58');
  [2, 3].forEach(function (i) {
    assert.strictEqual(rows[i].spurious, 0, 'a million-plus modulus is exact here');
    assert.strictEqual(rows[i].hits, 12);
    assert.strictEqual(rows[i].comparisons, 36);
  });
  rows.forEach(function (row) {
    assert.deepStrictEqual(row.positions, rows[0].positions,
      'the modulus must never change the occurrence list');
    assert.strictEqual(row.found, 12);
  });
  prose.quotes('rolling-hashes',
    ['31 hash hits, 12 real occurrences, 19 spurious, 55 character comparisons',
      '3 998/101 = 39.58 predicted against 19 measured',
      '12 hits and 12 occurrences at both — 0 spurious, 36 comparisons',
      '12 occurrences at all four settings']);
});

test('rolling-hashes: a colliding pair costs 1 536 tries against an estimate of 1 000', function () {
  const found = RabinKarp.collisionPair(16, {});

  assert.strictEqual(found.examined, 1536);
  assert.strictEqual(found.expected, 1000);
  assert.notStrictEqual(found.a, found.b);
  assert.strictEqual(RabinKarp.hashOf(found.a, 0, 16, RabinKarp.DEFAULT_BASE, RabinKarp.DEFAULT_MODULUS),
    RabinKarp.hashOf(found.b, 0, 16, RabinKarp.DEFAULT_BASE, RabinKarp.DEFAULT_MODULUS));
  prose.quotes('rolling-hashes', ['1 536 tries against an estimate of 1 000']);
});

test('rolling-hashes: the attack costs work, not correctness, and randomising the base ends it',
  function () {
    const run = RabinKarp.attackRun({});

    assert.strictEqual(run.built, true, 'the attack needs a colliding pair to exist');
    assert.strictEqual(run.fixedSpurious, 200);
    assert.strictEqual(run.fixedComparisons, 1200);
    assert.strictEqual(run.textLength, 3200);
    assert.strictEqual(run.randomisedWorst, 0);
    assert.strictEqual(run.randomisedTotal, 0);
    assert.strictEqual(run.trials, 20);
    assert.strictEqual(run.widerModulus, 0);
    const text = run.block.repeat(200);
    const search = RabinKarp.search(text, run.pattern, {});

    assert.strictEqual(search.positions.length, 0, 'the attack is a performance attack');
    prose.quotes('rolling-hashes',
      ['200 spurious hits over 3 200 characters, at 1 200 character comparisons',
        '0 occurrences reported', '0 spurious hits at the worst of 20 trials, 0 in total']);
  });

/* ---------------------------------------------------------------- 15.6 */

test('aho-corasick: eleven matches with the output chain and nine without', function () {
  const set = AhoCorasick.suffixSet();
  const instance = { name: 'suffix', text: set.text, pattern: set.patterns[0] };
  const withLinks = MatchLab.multiRun(instance, { patterns: set.patterns });
  const without = MatchLab.multiRun(instance,
    { patterns: set.patterns, outputLinks: false });

  assert.strictEqual(withLinks.states, 10);
  assert.strictEqual(withLinks.matches.length, 11);
  assert.strictEqual(withLinks.compare.missing, 0);
  assert.strictEqual(withLinks.compare.extra, 0);
  assert.strictEqual(withLinks.failureFollows, 10);
  assert.strictEqual(withLinks.outputFollows, 2);
  assert.strictEqual(without.matches.length, 9);
  assert.strictEqual(without.compare.missing, 2);
  assert.strictEqual(without.compare.extra, 0);
  assert.strictEqual(without.failureFollows, 10, 'the failure links are untouched');
  prose.quotes('aho-corasick',
    ['10 states', '11 matches, 0 missing and 0 extra',
      '10 failure-link follows and 2 output-link follows',
      '9 matches against a true 11 — 2 missed']);
});

test('aho-corasick: the missing matches are exactly the nested ones', function () {
  const set = AhoCorasick.suffixSet();
  const withLinks = AhoCorasick.build(set.patterns, {});
  const without = AhoCorasick.build(set.patterns, { outputLinks: false });
  const key = function (m) { return set.patterns[m.pattern] + '@' + m.start; };
  const full = AhoCorasick.search(withLinks, set.text, {}).matches.map(key);
  const partial = AhoCorasick.search(without, set.text, {}).matches.map(key);
  const lost = full.filter(function (entry) { return partial.indexOf(entry) === -1; });

  assert.deepStrictEqual(lost.sort(), ['he@18', 'he@2']);
  assert.strictEqual(set.text.substr(1, 3), 'she');
  assert.strictEqual(set.text.substr(17, 3), 'she');
  prose.quotes('aho-corasick',
    ['"he" at position 2 inside "she" at position 1', '"he" at 18 inside "she" at 17']);
});

test('aho-corasick: one pass whatever the pattern count, against one scan each', function () {
  const english = MatchLab.corpus('english', {});
  const sweep = MatchLab.patternCountSweep(english, {});

  assert.deepStrictEqual(sweep.map(function (row) { return row.count; }), [1, 2, 4, 8, 16, 32]);
  sweep.forEach(function (row) {
    assert.strictEqual(row.comparisons, 4000, row.count + ' patterns still cost one pass');
    assert.strictEqual(row.agree, true, row.count + ' patterns disagreed with the oracle');
  });
  assert.deepStrictEqual(sweep.map(function (row) { return row.separate; }),
    [4303, 8645, 17288, 34654, 68864, 135036]);
  assert.deepStrictEqual(sweep.map(function (row) { return row.states; }),
    [5, 11, 20, 42, 73, 138]);
  assert.strictEqual(prose.fixed(sweep[0].saving), '1.08');
  assert.strictEqual(prose.fixed(sweep[5].saving), '33.76');
  prose.quotes('aho-corasick',
    ['4 000 at every size from 1 to 32 patterns',
      '4 303, 8 645, 17 288, 34 654, 68 864, 135 036',
      '1.08× at one pattern and 33.76× at thirty-two',
      '5, 11, 20, 42, 73, 138 states']);
});

test('aho-corasick: the dense table costs 40 cells on DNA and 400 on source code', function () {
  const set = AhoCorasick.suffixSet();
  const automaton = AhoCorasick.build(set.patterns, {});
  const dna = AhoCorasick.toAutomaton(automaton, 'ACGT');
  const alphabet = MatchLab.alphabetOf(MatchLab.corpus('source', {}).text);
  const wide = AhoCorasick.toAutomaton(automaton, alphabet);

  assert.strictEqual(automaton.report.states, 10);
  assert.strictEqual(alphabet.length, 40, 'the source corpus uses forty distinct symbols');
  assert.strictEqual(dna.cells, 40);
  assert.strictEqual(wide.cells, 400);
  prose.quotes('aho-corasick',
    ['40 cells on a 4-symbol alphabet and 400 on a 40-symbol one']);
});
