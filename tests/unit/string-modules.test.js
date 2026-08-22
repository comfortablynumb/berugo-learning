'use strict';

/**
 * Property tests for the M15.1-M15.6 string modules: every searcher against
 * the naive scan, and every derived table against the brute-force oracle the
 * module ships for exactly that purpose.
 */

const test = require('node:test');
const assert = require('node:assert');

const StringMatch = require('../../src/js/algorithms/string-match.js');
const Kmp = require('../../src/js/algorithms/kmp.js');
const Z = require('../../src/js/algorithms/z-algorithm.js');
const BoyerMoore = require('../../src/js/algorithms/boyer-moore.js');
const RabinKarp = require('../../src/js/algorithms/rabin-karp.js');
const AhoCorasick = require('../../src/js/algorithms/aho-corasick.js');
const Random = require('../../src/js/utils/random.js');

/** A deterministic corpus generator: seeded, so a failure is reproducible. */
function words(seed, count, length, alphabet) {
  const rng = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    let word = '';

    for (let j = 0; j < length; j += 1) word += alphabet[rng.int(alphabet.length)];
    out.push(word);
  }
  return out;
}

/** Text-and-pattern pairs over three alphabets, including the degenerate one. */
function pairs(seed) {
  const alphabets = ['ab', 'abcdef', 'a'];
  const out = [];

  alphabets.forEach(function (alphabet, index) {
    const texts = words(seed + index, 12, 60, alphabet);
    const patterns = words(seed + 100 + index, 12, 1 + (index % 4), alphabet);

    texts.forEach(function (text, i) {
      out.push({ text: text, pattern: patterns[i], alphabet: alphabet });
    });
  });
  return out;
}

function naivePositions(text, pattern) {
  return StringMatch.naive(text, pattern, {}).positions;
}

/* ------------------------------------------------------------- 15.1 naive */

test('string-match: the filter changes the work and never the answer', function () {
  pairs(1).forEach(function (item) {
    const plain = StringMatch.naive(item.text, item.pattern, {});
    const filtered = StringMatch.naive(item.text, item.pattern, { filter: true });

    assert.deepStrictEqual(filtered.positions, plain.positions,
      'the first-character filter moved a position on "' + item.pattern + '"');
    assert.ok(filtered.report.entered <= plain.report.entered,
      'the filter can only reduce the alignments entered');
    assert.strictEqual(filtered.report.skipped + filtered.report.entered,
      filtered.report.alignments, 'every alignment is either skipped or entered');
  });
});

test('string-match: verify catches a position list that does not hold up', function () {
  const text = 'abracadabra';
  const good = StringMatch.verify(text, 'abra', [0, 7]);

  assert.strictEqual(good.valid, true);
  assert.strictEqual(good.count, 2);
  const bad = StringMatch.verify(text, 'abra', [0, 6]);

  assert.strictEqual(bad.valid, false);
  assert.strictEqual(bad.wrong, 1);
});

test('string-match: the adversarial input realises the product bound', function () {
  [20, 40, 80].forEach(function (n) {
    const built = StringMatch.adversarialFor(n, 4);
    const run = StringMatch.naive(built.text, built.pattern, {});

    assert.deepStrictEqual(run.positions, [], 'the adversarial text must not match');
    assert.strictEqual(run.report.comparisons,
      built.pattern.length * (built.text.length - built.pattern.length + 1),
      'every alignment must run the inner loop to the end');
  });
});

/* --------------------------------------------------------------- 15.2 KMP */

test('kmp: the prefix function matches the border oracle on every pattern', function () {
  ['a', 'aa', 'abab', 'aabaaab', 'abacabadabacaba', 'aaaaab', 'abcabcabd']
    .concat(words(2, 30, 12, 'ab'))
    .concat(words(3, 20, 9, 'abc'))
    .forEach(function (pattern) {
      assert.deepStrictEqual(Kmp.prefixFunction(pattern, {}),
        Kmp.bordersByBruteForce(pattern), 'borders differ on "' + pattern + '"');
    });
});

test('kmp: the search agrees with the naive scan, overlaps included', function () {
  pairs(4).forEach(function (item) {
    assert.deepStrictEqual(Kmp.search(item.text, item.pattern, {}).positions,
      naivePositions(item.text, item.pattern),
      'kmp disagreed on "' + item.pattern + '"');
  });
  assert.deepStrictEqual(Kmp.search('aaaa', 'aa', {}).positions, [0, 1, 2]);
});

test('kmp: the smallest period is a period, and the smallest one', function () {
  words(5, 40, 12, 'ab').concat(['abcabcabc', 'aaaa', 'abcd']).forEach(function (pattern) {
    const got = Kmp.period(pattern);
    const truth = Kmp.periodsByBruteForce(pattern);

    assert.strictEqual(got.period, truth[0],
      'the period of "' + pattern + '" disagrees with the oracle');
    assert.strictEqual(got.exact, pattern.length % got.period === 0);
  });
});

test('kmp: the automaton and the border table find the same positions', function () {
  pairs(6).forEach(function (item) {
    const table = Kmp.automaton(item.pattern, item.alphabet, {});
    const got = Kmp.searchByAutomaton(item.text, item.pattern, table, {});

    assert.deepStrictEqual(got.positions, naivePositions(item.text, item.pattern),
      'the automaton disagreed on "' + item.pattern + '"');
    assert.strictEqual(table.next.length, item.pattern.length + 1,
      'one row per pattern prefix, plus the accepting row');
  });
});

/* ------------------------------------------------------- 15.3 Z-algorithm */

test('z-algorithm: the Z-array matches the quadratic definition', function () {
  ['aaaaa', 'aabxaayaab', 'abacaba', 'ab']
    .concat(words(7, 40, 14, 'ab'))
    .concat(words(8, 20, 10, 'abcd'))
    .forEach(function (text) {
      assert.deepStrictEqual(Z.zArray(text, {}).z, Z.zByBruteForce(text),
        'the Z-array differs on "' + text + '"');
    });
});

test('z-algorithm: searching through a sentinel agrees with the naive scan', function () {
  pairs(9).forEach(function (item) {
    assert.deepStrictEqual(Z.search(item.text, item.pattern, {}).positions,
      naivePositions(item.text, item.pattern),
      'the Z-search disagreed on "' + item.pattern + '"');
  });
});

test('z-algorithm: the sentinel is absent from both halves', function () {
  pairs(24).forEach(function (item) {
    const separator = Z.sentinelFor(item.text, item.pattern);

    assert.strictEqual(item.text.indexOf(separator), -1,
      'the separator must not occur in the text');
    assert.strictEqual(item.pattern.indexOf(separator), -1,
      'nor in the pattern, or the concatenation would match across it');
  });
});

test('z-algorithm: Fine and Wilf is tight one character below the bound', function () {
  [[2, 3], [3, 4], [3, 5], [4, 6], [5, 7]].forEach(function (row) {
    const p = row[0];
    const q = row[1];
    const bound = Z.fineAndWilf('', p, q);
    const atBound = Z.tightness(p, q);

    assert.strictEqual(bound.bound, p + q - Z.fineAndWilf('', p, q).gcd,
      'the bound is p + q - gcd(p, q)');
    assert.strictEqual(atBound.atBound, atBound.gcd,
      'at the bound the forced positions collapse to gcd classes');
    assert.strictEqual(atBound.belowBound, atBound.gcd + 1,
      'one character shorter and there is exactly one class more');
  });
});

test('z-algorithm: the Fibonacci word is as unperiodic as the bound allows', function () {
  const word = Z.fibonacciWord(8);

  assert.ok(word.length >= 34, 'order 8 is at least 34 characters');
  assert.deepStrictEqual(Z.zArray(word, {}).z, Z.zByBruteForce(word),
    'the Z-array of the Fibonacci word must still match the oracle');
});

/* --------------------------------------------------------- 15.4 skipping */

test('boyer-moore: all three rule settings find the naive positions', function () {
  pairs(10).forEach(function (item) {
    ['both', 'bad-character', 'good-suffix'].forEach(function (rules) {
      const got = BoyerMoore.search(item.text, item.pattern, { rules: rules });

      assert.deepStrictEqual(got.positions, naivePositions(item.text, item.pattern),
        rules + ' disagreed on "' + item.pattern + '"');
    });
  });
});

test('boyer-moore: both rules together never do more alignments than either alone', function () {
  pairs(11).forEach(function (item) {
    const both = BoyerMoore.search(item.text, item.pattern, { rules: 'both' });
    const bad = BoyerMoore.search(item.text, item.pattern, { rules: 'bad-character' });
    const good = BoyerMoore.search(item.text, item.pattern, { rules: 'good-suffix' });

    assert.ok(both.report.alignments <= bad.report.alignments,
      'taking the maximum of two shifts cannot need more alignments than one of them');
    assert.ok(both.report.alignments <= good.report.alignments,
      'and the same holds against the good-suffix rule alone');
  });
});

test('boyer-moore: Horspool and Sunday agree with the full algorithm', function () {
  pairs(12).forEach(function (item) {
    const truth = naivePositions(item.text, item.pattern);

    assert.deepStrictEqual(BoyerMoore.horspool(item.text, item.pattern, {}).positions, truth,
      'Horspool disagreed on "' + item.pattern + '"');
    assert.deepStrictEqual(BoyerMoore.sunday(item.text, item.pattern, {}).positions, truth,
      'Sunday disagreed on "' + item.pattern + '"');
  });
});

test('boyer-moore: the bad-character table never holds a zero shift', function () {
  words(13, 30, 7, 'abcd').forEach(function (pattern) {
    const table = BoyerMoore.badCharacterTable(pattern, {});

    Object.keys(table).forEach(function (symbol) {
      assert.strictEqual(table[symbol], pattern.lastIndexOf(symbol),
        'the table must hold the LAST occurrence of "' + symbol + '"');
    });
  });
});

/* ---------------------------------------------------- 15.5 rolling hashes */

test('rabin-karp: rolling a window equals hashing it from scratch', function () {
  const text = words(14, 1, 200, 'abcdef')[0];
  const base = RabinKarp.DEFAULT_BASE;
  const modulus = RabinKarp.DEFAULT_MODULUS;
  const m = 8;
  const lead = RabinKarp.power(base, m - 1, modulus);
  let window = RabinKarp.hashOf(text, 0, m, base, modulus);

  for (let start = 0; start + m < text.length; start += 1) {
    window = RabinKarp.roll(window, text.charCodeAt(start), text.charCodeAt(start + m),
      { base: base, modulus: modulus, lead: lead });
    assert.strictEqual(window, RabinKarp.hashOf(text, start + 1, m, base, modulus),
      'the rolled hash drifted at ' + start);
  }
});

test('rabin-karp: the search agrees with the naive scan and verifies every hit', function () {
  pairs(15).forEach(function (item) {
    const got = RabinKarp.search(item.text, item.pattern, {});

    assert.deepStrictEqual(got.positions, naivePositions(item.text, item.pattern),
      'rabin-karp disagreed on "' + item.pattern + '"');
    assert.strictEqual(got.report.hashHits, got.positions.length + got.report.spurious,
      'every hash hit is either a match or a counted spurious one');
  });
});

test('rabin-karp: a collision pair really collides and really differs', function () {
  const found = RabinKarp.collisionPair(16, {});
  const base = RabinKarp.DEFAULT_BASE;
  const modulus = RabinKarp.DEFAULT_MODULUS;

  assert.ok(found.a !== null && found.b !== null, 'the birthday search must find a pair');
  assert.notStrictEqual(found.a, found.b, 'a collision needs two different strings');
  assert.strictEqual(RabinKarp.hashOf(found.a, 0, found.a.length, base, modulus),
    RabinKarp.hashOf(found.b, 0, found.b.length, base, modulus), 'and one hash');
  assert.ok(found.examined <= 4 * found.expected,
    'the birthday bound is about sqrt(modulus); this took ' + found.examined);
});

test('rabin-karp: content-defined chunking survives an insertion locally', function () {
  const before = words(17, 1, 4000, 'abcdefgh')[0];
  const run = RabinKarp.insertionRun(before, { at: 500, insert: 'INSERTED' });

  assert.ok(run.shared > 0, 'content-defined chunking must share chunks');
  assert.ok(run.shared > run.fixedShared,
    'fixed-size chunking loses more after an insertion: ' + run.fixedShared +
    ' shared against ' + run.shared);
  assert.ok(run.sharedFraction > 0.8,
    'one insertion must not resynchronise more than a few boundaries');
});

/* ------------------------------------------------------- 15.6 multi-match */

test('aho-corasick: the automaton agrees with a per-pattern brute force', function () {
  const sets = [
    { patterns: ['he', 'she', 'his', 'hers', 'her'], text: 'ushers said he hushed his hers' },
    { patterns: ['a', 'ab', 'bab', 'bc', 'bca', 'c', 'caa'], text: 'abccab' },
    { patterns: words(18, 5, 3, 'ab'), text: words(19, 1, 200, 'ab')[0] },
    { patterns: words(20, 8, 4, 'abc'), text: words(21, 1, 300, 'abc')[0] }
  ];

  sets.forEach(function (set, index) {
    const automaton = AhoCorasick.build(set.patterns, {});
    const found = AhoCorasick.search(automaton, set.text, {}).matches;
    const truth = AhoCorasick.bruteForce(set.patterns, set.text);
    const verdict = AhoCorasick.compare(found, truth);

    assert.strictEqual(verdict.agree, true,
      'set ' + index + ': ' + verdict.missing + ' missing, ' + verdict.extra + ' extra');
  });
});

test('aho-corasick: dropping the output links loses exactly the nested patterns', function () {
  const set = AhoCorasick.suffixSet();
  const withLinks = AhoCorasick.build(set.patterns, {});
  const without = AhoCorasick.build(set.patterns, { outputLinks: false });
  const truth = AhoCorasick.bruteForce(set.patterns, set.text);
  const full = AhoCorasick.compare(AhoCorasick.search(withLinks, set.text, {}).matches, truth);
  const broken = AhoCorasick.compare(AhoCorasick.search(without, set.text, {}).matches, truth);

  assert.strictEqual(full.agree, true, 'with output links the automaton is correct');
  assert.strictEqual(broken.agree, false, 'without them it must lose matches');
  assert.strictEqual(broken.extra, 0, 'and it must never invent one');
  assert.ok(broken.missing > 0, 'the losses are the patterns that end inside another');
});

test('aho-corasick: one pass, whatever the pattern count', function () {
  const text = words(22, 1, 400, 'abc')[0];

  [2, 4, 8, 16].forEach(function (count) {
    const automaton = AhoCorasick.build(words(23, count, 3, 'abc'), {});
    const run = AhoCorasick.search(automaton, text, {});

    assert.strictEqual(run.report.comparisons, text.length,
      count + ' patterns still cost one character read per character');
  });
});
