'use strict';

/**
 * Every figure the M15.10-M15.11 worked examples quote, recomputed from the
 * modules and then checked against the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Regex = require('../../src/js/algorithms/regex-engine.js');
const Pipeline = require('../../src/js/algorithms/text-pipeline.js');
const TextCorpus = require('../../src/js/machines/text-corpus.js');

require('../../src/js/content/concepts-strings-text.js');
require('../../src/js/content/examples-strings-text.js');
const prose = require('../support/worked-example-prose.js');

/* --------------------------------------------------------------- 15.10 */

function pathologicalAt(n) {
  const built = Regex.pathological(n);

  return Regex.compare(built.pattern, built.text, {});
}

test('regex-engines: five states, and a state-set peak that does not move', function () {
  const verdict = pathologicalAt(18);

  assert.strictEqual(verdict.pattern, '(a+)+b');
  assert.strictEqual(verdict.nfaStates, 5);
  assert.strictEqual(verdict.setSizePeak, 4);
  assert.strictEqual(verdict.backtrackSteps, 1048576);
  assert.strictEqual(verdict.nfaSteps, 142);
  assert.strictEqual(verdict.backtrackMatched, false, 'the input is an almost-match');
  assert.strictEqual(verdict.nfaMatched, false);
  assert.strictEqual(verdict.agree, true);
  prose.quotes('regex-engines',
    ['5 states', 'a state-set peak of 4 out of 5 states', '1 048 576 steps', '142']);
});

test('regex-engines: the ratio grows by about sixteen every four characters', function () {
  const rows = [6, 8, 10, 12, 14, 16, 18].map(pathologicalAt);

  assert.deepStrictEqual(rows.map(function (row) { return row.backtrackSteps; }),
    [256, 1024, 4096, 16384, 65536, 262144, 1048576]);
  assert.deepStrictEqual(rows.map(function (row) { return row.nfaSteps; }),
    [46, 62, 78, 94, 110, 126, 142]);
  assert.deepStrictEqual(rows.map(function (row) { return row.setSizePeak; }),
    [4, 4, 4, 4, 4, 4, 4]);
  assert.deepStrictEqual(rows.map(function (row) {
    return prose.fixed(row.backtrackSteps / row.nfaSteps, 1);
  }), ['5.6', '16.5', '52.5', '174.3', '595.8', '2080.5', '7384.3']);
  rows.forEach(function (row) {
    assert.strictEqual(row.agree, true, 'the engines must agree before any ratio means anything');
  });
  prose.quotes('regex-engines',
    ['5.6', '16.5', '52.5', '174.3', '595.8', '2080.5', '7384.3',
      '262 144 it took at 16 characters']);
});

test('regex-engines: past eighteen characters one engine stops answering', function () {
  [20, 22].forEach(function (n) {
    const verdict = pathologicalAt(n);

    assert.strictEqual(verdict.exhausted, true, 'the budget must run out at n = ' + n);
    assert.strictEqual(verdict.agree, null, 'an exhausted run has no verdict to compare');
  });
  assert.strictEqual(pathologicalAt(20).nfaSteps, 158);
  assert.strictEqual(pathologicalAt(22).nfaSteps, 174);
  assert.strictEqual(pathologicalAt(18).exhausted, false);
  prose.quotes('regex-engines',
    ['backtracking exhausts 2 000 000 steps; the simulation takes 158 and 174']);
});

test('regex-engines: nesting over the same characters is the trigger, not length', function () {
  const patterns = ['(a+)+b', '(a|a)*b', '(a*)*b', 'a*b', '(ab)*c', '(a|b)*abb'];
  const rows = patterns.map(function (pattern) {
    return [12, 20].map(function (n) {
      return Regex.compare(pattern, 'a'.repeat(n), {});
    });
  });

  assert.deepStrictEqual(rows.slice(0, 3).map(function (row) { return row[0].backtrackSteps; }),
    [16384, 32766, 16385]);
  rows.slice(0, 3).forEach(function (row, i) {
    assert.strictEqual(row[1].exhausted, true, patterns[i] + ' must exhaust the budget at n = 20');
  });
  rows.slice(3).forEach(function (row, i) {
    assert.strictEqual(row[1].exhausted, false, patterns[i + 3] + ' must not blow up');
  });
  assert.deepStrictEqual(rows.slice(3).map(function (row) {
    return [row[0].backtrackSteps, row[1].backtrackSteps];
  }), [[28, 44], [6, 6], [68, 108]]);
  assert.deepStrictEqual(rows.slice(3).map(function (row) {
    return prose.fixed(row[1].backtrackSteps / row[0].backtrackSteps, 1);
  }), ['1.6', '1.0', '1.6']);
  assert.deepStrictEqual(rows.map(function (row) { return row[1].nfaSteps; }),
    [158, 205, 164, 123, 8, 244]);
  prose.quotes('regex-engines',
    ['`(a+)+b` 16 384 steps at n = 12, `(a|a)*b` 32 766, `(a*)*b` 16 385',
      '`a*b` 28 to 44 steps, `(ab)*c` 6 to 6, `(a|b)*abb` 68 to 108',
      '158, 205, 164, 123, 8 and 244 steps at n = 20']);
});

test('regex-engines: the twelve verdict fixtures agree, which is what licenses the rest',
  function () {
    const fixtures = [
      ['abc', 'abc'], ['abc', 'abd'], ['a*', ''], ['a*', 'aaa'], ['a|b', 'b'],
      ['(a|b)*abb', 'aababb'], ['(a|b)*abb', 'aabab'], ['a.c', 'axc'],
      ['a+b', 'aaab'], ['a+b', 'b'], ['(ab)+', 'ababab'], ['a?b', 'b']
    ];
    const disagreements = fixtures.filter(function (row) {
      return Regex.compare(row[0], row[1], {}).agree !== true;
    });

    assert.strictEqual(fixtures.length, 12);
    assert.strictEqual(disagreements.length, 0);
    prose.quotes('regex-engines', ['0 of 12 disagree']);
  });

/* --------------------------------------------------------------- 15.11 */

const THRESHOLDS = [20, 30, 40, 50, 60, 70, 80, 90];
const PAIRS = [
  ['Jon Smyth', 'John Smith'], ['service-a', 'service-b'],
  ['Elizabeth Windsor', 'Windsor Elizabeth'], ['catherine', 'katherine'],
  ['user-1234', 'user-1235'], ['MacDonald', 'McDonald']
];
const NEAR = ['John Smith', 'Jon Smith', 'Jane Smith', 'John Smyth', 'Jonathan Smith',
  'J. Smith', 'John Smithson', 'Joan Smit', 'Johnny Smith', 'Jon Smythe', 'James Smith'];
const FIRST = ['Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Laura', 'Peter', 'Anna',
  'Thomas', 'Helen', 'George', 'Clara', 'Henry', 'Alice', 'Oliver', 'Grace'];
const LAST = ['Brown', 'Jones', 'Wilson', 'Taylor', 'Davies', 'Evans', 'Thomas', 'Roberts',
  'Walker', 'Wright', 'Green', 'Hall', 'Wood', 'Clarke', 'Baker', 'Harris'];
const EXPECTED = ['John Smith', 'Jon Smith', 'John Smyth', 'Jon Smythe'];

function directory() {
  const out = NEAR.slice();

  FIRST.forEach(function (first) {
    LAST.forEach(function (last) { out.push(first + ' ' + last); });
  });
  return out;
}

function templatesAt(threshold) {
  const report = Pipeline.emptyReport();
  const run = Pipeline.extractTemplates(TextCorpus.logs(300),
    { threshold: threshold / 100, report: report });

  return { run: run, report: report, biggest: run.templates[0] };
}

test('text-processing: four templates from three hundred lines', function () {
  const state = templatesAt(50);

  assert.strictEqual(TextCorpus.logs(300).length, 300);
  assert.strictEqual(state.run.templates.length, 4);
  assert.strictEqual(state.report.comparisons, 1348);
  assert.deepStrictEqual(state.biggest.tokens, ['GET', '<*>', '<*>', '<*>']);
  assert.strictEqual(state.biggest.count, 182);
  assert.deepStrictEqual(state.run.templates.slice(1).map(function (entry) { return entry.count; }),
    [41, 39, 38]);
  state.run.templates.slice(1).forEach(function (entry) {
    assert.strictEqual(entry.tokens.filter(function (t) { return t === '<*>'; }).length, 0,
      'a repeated literal line must not be generalised');
  });
  prose.quotes('text-processing',
    ['4 templates from 300 lines, at 1 348 token comparisons',
      '`GET <*> <*> <*>` covers 182 lines with 3 of its 4 positions wildcarded',
      '41, 39 and 38 lines, 0 of 4 wildcards each']);
});

test('text-processing: the threshold sweep, and the two degenerate ends', function () {
  const rows = THRESHOLDS.map(function (threshold) {
    const state = templatesAt(threshold);

    return { threshold: threshold, templates: state.run.templates.length,
      covers: state.biggest.count, comparisons: state.report.comparisons,
      wildcards: state.biggest.tokens.filter(function (t) { return t === '<*>'; }).length };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.templates; }),
    [3, 4, 4, 4, 7, 7, 8, 8]);
  assert.deepStrictEqual(rows.map(function (row) { return row.covers; }),
    [182, 182, 182, 182, 79, 79, 46, 46]);
  assert.deepStrictEqual(rows.map(function (row) { return row.wildcards; }),
    [3, 3, 3, 3, 1, 1, 0, 0]);
  assert.deepStrictEqual(rows.map(function (row) { return row.comparisons; }),
    [1188, 1348, 1348, 1348, 2704, 2704, 2832, 2832]);
  assert.strictEqual(prose.fixed(2832 / 1188, 1), '2.4');
  prose.quotes('text-processing',
    ['3, 4, 4, 4, 7, 7, 8, 8 templates', 'the largest falls from 182 lines to 46',
      '1 188 comparisons at 0.20 against 2 832 at 0.90']);
});

test('text-processing: no metric is right on all six pairs', function () {
  const rows = PAIRS.map(function (pair) {
    const a = Pipeline.normalise(pair[0]);
    const b = Pipeline.normalise(pair[1]);

    return {
      levenshtein: prose.fixed(Pipeline.levenshteinRatio(a, b), 3),
      jaro: prose.fixed(Pipeline.jaroWinkler(a, b, {}), 3),
      jaccard: prose.fixed(Pipeline.jaccard(Pipeline.shingles(a, 2), Pipeline.shingles(b, 2)), 3),
      cosine: prose.fixed(Pipeline.cosine(a, b, 2), 3)
    };
  });

  assert.deepStrictEqual(rows[0], { levenshtein: '0.800', jaro: '0.917', jaccard: '0.417', cosine: '0.589' });
  assert.deepStrictEqual(rows[1], { levenshtein: '0.889', jaro: '0.956', jaccard: '0.778', cosine: '0.875' });
  assert.deepStrictEqual(rows[2], { levenshtein: '0.059', jaro: '0.407', jaccard: '0.778', cosine: '0.875' });
  assert.deepStrictEqual(rows[4], { levenshtein: '0.889', jaro: '0.956', jaccard: '0.778', cosine: '0.875' });
  assert.strictEqual(rows[1].jaro, rows[4].jaro,
    'two different services and two different accounts score the same');
  prose.quotes('text-processing',
    ['0.800 Levenshtein, 0.917 Jaro-Winkler, 0.417 Jaccard, 0.589 cosine',
      '0.956 Jaro-Winkler', '0.059 by Levenshtein ratio, 0.778 by Jaccard on 2-grams']);
});

test('text-processing: blocking moves the cost by 22x and the answer not at all', function () {
  const records = directory();
  const rows = [true, false].map(function (block) {
    const report = Pipeline.emptyReport();
    const run = Pipeline.namePipeline('Jon Smyth', records,
      { cutoff: 0.85, block: block, report: report });

    return { block: block, report: report, run: run,
      score: Pipeline.score(run.matches, EXPECTED) };
  });

  assert.strictEqual(records.length, 267);
  assert.strictEqual(rows[0].report.candidates, 12);
  assert.strictEqual(prose.fixed(rows[0].run.selectivity, 3), '0.045');
  assert.strictEqual(rows[1].report.candidates, 267);
  assert.strictEqual(prose.fixed(rows[1].run.selectivity, 3), '1.000');
  assert.strictEqual(prose.fixed(267 / 12, 0), '22');
  rows.forEach(function (row) {
    assert.strictEqual(Math.round(100 * row.score.precision), 50);
    assert.strictEqual(Math.round(100 * row.score.recall), 100);
    assert.strictEqual(row.score.found, 8);
    assert.strictEqual(row.score.expected, 4);
  });
  assert.deepStrictEqual(rows[0].run.matches.map(function (m) { return m.record; }),
    rows[1].run.matches.map(function (m) { return m.record; }),
    'a sound filter cannot change the answer');
  prose.quotes('text-processing',
    ['267 records to 12 candidates, selectivity 0.045, against 267 to 267 at 1.000',
      'precision 50% and recall 100% in both', '22x']);
});

test('text-processing: the tokenisers and the byte-pair vocabulary', function () {
  const line = 'POST /api/login 401 33ms';

  assert.strictEqual(Pipeline.whitespace(line).length, 4);
  assert.strictEqual(Pipeline.ruleBased(line).length, 8);
  const text = TextCorpus.logs(300).join(' ');
  const bpe = Pipeline.bytePairEncoding(text, { merges: 60 });

  assert.strictEqual(bpe.report.merges, 60);
  assert.strictEqual(bpe.vocabulary.size, 84);
  assert.strictEqual(prose.fixed(bpe.characters / bpe.tokens), '4.90');
  const none = Pipeline.bytePairEncoding(text, { merges: 0 });

  assert.strictEqual(prose.fixed(none.characters / none.tokens), '1.00',
    'zero merges must be a character tokeniser, not the default');
  prose.quotes('text-processing',
    ['4 tokens by whitespace and 8 by character class',
      '60 merges over this corpus reach 4.90 characters per token on a vocabulary of 84']);
});
