'use strict';

/**
 * Every figure the M15.7-M15.9 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Manacher = require('../../src/js/algorithms/manacher.js');
const Approximate = require('../../src/js/algorithms/approximate-match.js');
const Diff = require('../../src/js/algorithms/diff.js');
const MatchLab = require('../../src/js/machines/match-lab.js');

require('../../src/js/content/concepts-strings-fuzzy.js');
require('../../src/js/content/examples-strings-fuzzy.js');
const prose = require('../support/worked-example-prose.js');

const LENGTHS = [20, 50, 100, 200, 400, 800];

/** The section's own families, reproduced exactly. */
function familyString(family, size, seed) {
  if (family === 'repeated') return 'a'.repeat(size);
  const random = require('../../src/js/utils/random.js').seeded(seed);
  let out = '';

  for (let i = 0; i < size; i += 1) out += 'ab'[random.int(2)];
  return out;
}

function growth(family) {
  return LENGTHS.map(function (size) {
    const text = familyString(family, size, 1);
    const report = Manacher.emptyReport();

    Manacher.radii(text, { report: report });
    let naive = 0;

    Manacher.palindromesByBruteForce(text).forEach(function (entry) {
      naive += entry.length + 1;
    });
    return { size: size, comparisons: report.comparisons, naive: naive,
      count: Manacher.countSubstrings(text), distinct: Manacher.eertree(text, {}).distinct };
  });
}

/* ---------------------------------------------------------------- 15.7 */

test('palindromes: the default string, its mirror reuse and its two counts', function () {
  const text = 'abacabadabacaba';
  const report = Manacher.emptyReport();
  const run = Manacher.radii(text, { report: report });
  const list = Manacher.palindromes(text, {});

  assert.strictEqual(run.transformed.length, 31);
  assert.strictEqual(list.longest.length, 15);
  assert.strictEqual(list.longest.start, 0);
  assert.strictEqual(report.positions, 31);
  assert.strictEqual(report.mirrorReuse, 11);
  assert.strictEqual(report.extensions, 26);
  assert.strictEqual(Manacher.countSubstrings(text), 32);
  assert.strictEqual(Manacher.countByBruteForce(text), 32);
  assert.strictEqual(Manacher.eertree(text, {}).distinct, 15);
  assert.strictEqual(Manacher.distinctByBruteForce(text), 15);
  prose.quotes('palindromes',
    ['31 transformed characters', 'longest radius 15', '11 of 31 positions reused a mirror',
      '26 characters were actually compared', '32 palindromic substrings',
      '15 distinct palindromic substrings']);
});

test('palindromes: random binary is 1.5x and one repeated character is 200.5x', function () {
  const random = growth('random');
  const repeated = growth('repeated');

  assert.deepStrictEqual(random.map(function (row) { return row.comparisons; }),
    [79, 199, 399, 799, 1599, 3199]);
  assert.deepStrictEqual(random.map(function (row) { return row.naive; }),
    [151, 335, 653, 1230, 2432, 4899]);
  assert.strictEqual(prose.fixed(random[0].naive / random[0].comparisons, 1), '1.9');
  assert.strictEqual(prose.fixed(random[5].naive / random[5].comparisons, 1), '1.5');
  assert.deepStrictEqual(repeated.map(function (row) { return row.comparisons; }),
    [80, 200, 400, 800, 1600, 3200]);
  assert.deepStrictEqual(repeated.map(function (row) { return row.naive; }),
    [439, 2599, 10199, 40399, 160799, 641599]);
  assert.deepStrictEqual(repeated.map(function (row) {
    return prose.fixed(row.naive / row.comparisons, 1);
  }), ['5.5', '13.0', '25.5', '50.5', '100.5', '200.5']);
  prose.quotes('palindromes',
    ['Manacher 3 199 against 4 899', 'Manacher 3 200 against 641 599',
      '5.5×, 13.0×, 25.5×, 50.5×, 100.5×, 200.5× at 20, 50, 100, 200, 400 and 800']);
});

test('palindromes: the counts on a repeated run are n(n+1)/2 and n', function () {
  const repeated = growth('repeated');

  assert.deepStrictEqual(repeated.map(function (row) { return row.count; }),
    [210, 1275, 5050, 20100, 80200, 320400]);
  assert.deepStrictEqual(repeated.map(function (row) { return row.distinct; }), LENGTHS);
  repeated.forEach(function (row) {
    assert.strictEqual(row.count, row.size * (row.size + 1) / 2);
    assert.strictEqual(row.distinct, row.size);
  });
  prose.quotes('palindromes',
    ['320 400 palindromic substrings against 800 distinct ones',
      'palindromic substrings 210, 1 275, 5 050, 20 100, 80 200, 320 400']);
});

/* ---------------------------------------------------------------- 15.8 */

function logsCorpus() {
  return MatchLab.corpus('logs', { size: 4000 });
}

test('approximate-matching: 306 positions at k = 1, and two words per character', function () {
  const instance = logsCorpus();
  const report = Approximate.emptyReport();
  const dpReport = Approximate.emptyReport();
  const bitap = Approximate.bitapFuzzy(instance.text, 'orders', 1, { report: report });
  const dp = Approximate.searchByDp(instance.text, 'orders', 1, { report: dpReport });

  assert.deepStrictEqual(bitap.positions, dp.positions, 'bit-parallel must match the DP exactly');
  assert.strictEqual(bitap.positions.length, 306);
  assert.strictEqual(prose.fixed(report.words / instance.text.length), '2.00');
  prose.quotes('approximate-matching',
    ['102, 306, 510, 864 and 1 468 end positions', '2.00 words per character']);
});

test('approximate-matching: every k from 0 to 4 agrees, and only the bitap cost moves', function () {
  const instance = logsCorpus();
  const rows = [0, 1, 2, 3, 4].map(function (k) {
    const report = Approximate.emptyReport();
    const dpReport = Approximate.emptyReport();
    const bitap = Approximate.bitapFuzzy(instance.text, 'orders', k, { report: report });
    const dp = Approximate.searchByDp(instance.text, 'orders', k, { report: dpReport });

    assert.deepStrictEqual(bitap.positions, dp.positions, 'k = ' + k + ' disagreed');
    return { k: k, found: bitap.positions.length, words: report.words, cells: dpReport.cells };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.found; }),
    [102, 306, 510, 864, 1468]);
  assert.deepStrictEqual(rows.map(function (row) { return row.words; }),
    [9870, 19740, 29610, 39480, 49350]);
  rows.forEach(function (row) {
    assert.strictEqual(row.cells, 59220, 'the DP cost is flat in k');
  });
  prose.quotes('approximate-matching',
    ['102, 306, 510, 864 and 1 468 end positions',
      'bitap 9 870, 19 740, 29 610, 39 480 and 49 350 words against a flat 59 220 DP cells']);
});

test('approximate-matching: the word-size cliff arrives at 40 characters', function () {
  const instance = logsCorpus();
  const rows = [8, 16, 24, 32, 40, 48].map(function (m) {
    const report = Approximate.emptyReport();
    const dpReport = Approximate.emptyReport();
    const pattern = instance.text.substr(200, m);
    const bitap = Approximate.bitapFuzzy(instance.text, pattern, 1, { report: report });

    Approximate.searchByDp(instance.text, pattern, 1, { report: dpReport });
    return { length: m, refused: bitap.refused,
      words: prose.fixed(report.words / instance.text.length), cells: dpReport.cells };
  });

  assert.deepStrictEqual(rows.slice(0, 4).map(function (row) { return row.words; }),
    ['2.00', '2.00', '2.00', '2.00']);
  assert.deepStrictEqual(rows.slice(0, 4).map(function (row) { return row.cells; }),
    [78960, 157920, 236880, 315840]);
  assert.strictEqual(rows[4].refused, true, '40 bits do not fit a 32-bit register');
  assert.strictEqual(rows[5].refused, true);
  assert.strictEqual(Approximate.WORD_BITS, 32);
  prose.quotes('approximate-matching',
    ['2.00 words per character at 8, 16, 24 and 32',
      'DP cells go 78 960 to 315 840', 'refused outright at 40 and at 48']);
});

test('approximate-matching: the band computes 71 cells where the full grid computes 314', function () {
  const pairs = [
    ['kitten', 'sitting'], ['saturday', 'sunday'], ['flaw', 'lawn'],
    ['distance', 'difference'], ['abcdefgh', 'abcdefgh'], ['aaaaaaaa', 'bbbbbbbb']
  ];
  let banded = 0;
  let full = 0;
  let refusals = 0;

  pairs.forEach(function (pair) {
    const fullReport = Approximate.emptyReport();
    const bandReport = Approximate.emptyReport();

    Approximate.editDistance(pair[0], pair[1], { report: fullReport });
    const band = Approximate.bandedDistance(pair[0], pair[1], 1, { report: bandReport });

    banded += bandReport.cells;
    full += fullReport.cells;

    if (!band.exact) refusals += 1;
  });
  assert.strictEqual(banded, 71);
  assert.strictEqual(full, 314);
  assert.strictEqual(Math.round(1000 * (1 - banded / full)) / 10, 77.4);
  assert.strictEqual(refusals, 5);
  assert.strictEqual(Approximate.editDistance('kitten', 'sitting', {}).distance, 3);
  assert.strictEqual(Approximate.bandedDistance('kitten', 'sitting', 1, {}).exact, false);
  prose.quotes('approximate-matching',
    ['71 cells computed against 314 for the full grid', '77.4% never touched',
      '5 of the 6 pairs returned a refusal',
      '"kitten" against "sitting" has true distance 3']);
});

test('approximate-matching: q decides the candidate count and never the answer', function () {
  const instance = logsCorpus();
  const text = instance.text.slice(0, 1200);
  const rows = [2, 3, 4, 5].map(function (q) {
    const report = Approximate.emptyReport();
    const run = Approximate.filteredSearch(text, 'orders', 1, { q: q, report: report });

    return { q: q, threshold: Approximate.qgramThreshold(6, q, 1).threshold,
      candidates: report.candidates, positions: report.positions,
      results: run.positions.length };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.threshold; }), [3, 1, -1, -3]);
  assert.deepStrictEqual(rows.map(function (row) { return row.candidates; }),
    [54, 177, 1196, 1196]);
  rows.forEach(function (row) {
    assert.strictEqual(row.positions, 1196, 'every setting scans the same windows');
    assert.strictEqual(row.results, 27, 'q must never change the answer');
  });
  assert.deepStrictEqual(rows.map(function (row) {
    return prose.fixed(row.candidates / row.results, 1);
  }), ['2.0', '6.6', '44.3', '44.3']);
  prose.quotes('approximate-matching',
    ['q = 2 gives 3, q = 3 gives 1, q = 4 gives −1 and q = 5 gives −3',
      'candidates 54, 177, 1 196 and 1 196 out of 1 196 positions',
      '2.0, 6.6, 44.3 and 44.3 candidates per result, for the same 27 results']);
});

/* ---------------------------------------------------------------- 15.9 */

const BASE = ['function alpha() {', '  step();', '}', '',
  'function beta() {', '  step();', '}', '',
  'function gamma() {', '  step();', '}'];

const REORDER = ['function gamma() {', '  step();', '}', '',
  'function alpha() {', '  step();', '}', '',
  'function beta() {', '  step();', '}'];

test('diff-and-merge: Myers is shorter and patience is fewer hunks', function () {
  const myers = Diff.myers(BASE, REORDER, {});
  const patience = Diff.patience(BASE, REORDER, {});

  assert.strictEqual(myers.distance, 6);
  assert.strictEqual(Diff.hunks(myers.script).length, 3);
  assert.strictEqual(patience.distance, 8);
  assert.strictEqual(Diff.hunks(patience.script).length, 2);
  assert.strictEqual(Diff.roundTrips(BASE, REORDER, myers.script).ok, true);
  assert.strictEqual(Diff.roundTrips(BASE, REORDER, patience.script).ok, true);
  assert.strictEqual(Diff.uniqueCommon(BASE, REORDER, 0, BASE.length, 0, REORDER.length).length, 3);
  const repeated = BASE.filter(function (line) { return line === '}' || line === ''; }).length;

  assert.strictEqual(repeated, 5, 'five of the eleven lines are a lone brace or a blank');
  prose.quotes('diff-and-merge',
    ['6 operations in 3 hunks', '8 operations in 2 hunks, anchored on 3 lines unique to both files',
      '5 of the 11 lines are a lone brace or a blank']);
});

test('diff-and-merge: the work tracks the change size, not the file size', function () {
  const rows = [1, 2, 5, 10, 20, 40, 60].map(function (percent) {
    const a = [];
    const b = [];

    for (let i = 0; i < 200; i += 1) a.push('line ' + i);
    a.forEach(function (line, i) {
      b.push((i % 100) < percent ? 'changed ' + i : line);
    });
    const report = Diff.emptyReport();
    const run = Diff.myers(a, b, { report: report });

    return { percent: percent, distance: run.distance, diagonals: report.diagonals,
      snakes: report.comparisons, ok: Diff.roundTrips(a, b, run.script).ok,
      share: prose.fixed(100 * report.diagonals / (200 * 200)) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.distance; }),
    [4, 8, 20, 40, 80, 160, 240]);
  assert.deepStrictEqual(rows.map(function (row) { return row.diagonals; }),
    [13, 41, 221, 841, 3281, 12961, 29041]);
  assert.deepStrictEqual(rows.map(function (row) { return row.snakes; }),
    [210, 236, 410, 1020, 3440, 13080, 26998]);
  assert.deepStrictEqual(rows.map(function (row) { return row.share; }),
    ['0.03', '0.10', '0.55', '2.10', '8.20', '32.40', '72.60']);
  rows.forEach(function (row) {
    assert.strictEqual(row.ok, true, 'the script at ' + row.percent + '% does not produce b');
  });
  prose.quotes('diff-and-merge',
    ['edit distance 4, 13 diagonals visited, 210 snake comparisons',
      '0.03% of the 40 000 cells',
      'D 40 with 841 diagonals, and D 240 with 29 041 diagonals',
      '72.60% of N × M']);
});

test('diff-and-merge: one of five merge fixtures conflicts, and it is the genuine one', function () {
  const cases = [
    { name: 'different lines', base: ['a', 'b', 'c'], left: ['a', 'B', 'c'], right: ['a', 'b', 'C'] },
    { name: 'the same line, two ways', base: ['a', 'b', 'c'], left: ['a', 'X', 'c'], right: ['a', 'Y', 'c'] },
    { name: 'the same change twice', base: ['a', 'b'], left: ['a', 'Z'], right: ['a', 'Z'] },
    { name: 'insert beside edit', base: ['a', 'c'], left: ['a', 'b', 'c'], right: ['a', 'c', 'd'] },
    { name: 'delete beside edit', base: ['a', 'b', 'c'], left: ['a', 'c'], right: ['a', 'B', 'c'] }
  ];
  const conflicts = cases.map(function (item) {
    return Diff.merge(item.base, item.left, item.right).conflicts.length;
  });

  assert.deepStrictEqual(conflicts, [0, 1, 0, 0, 0]);
  assert.strictEqual(conflicts.filter(Boolean).length, 1);
  prose.quotes('diff-and-merge',
    ['1 of 5 conflicts', '1 conflict in 5 merge cases']);
});
