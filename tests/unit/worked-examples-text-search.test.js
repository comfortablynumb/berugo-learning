'use strict';

/**
 * Every figure the M06.7-M06.9 worked examples quote, recomputed here.
 *
 * The BWT run, the intersection sweep and the fuzzy comparison mirror each
 * section's demo, seeds included, so the prose and the screen agree.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const Corpus = require('../../src/js/machines/text-corpus.js');
const Lab = require('../../src/js/machines/text-lab.js');
const SuffixArray = require('../../src/js/algorithms/suffix-array.js');
const Bwt = require('../../src/js/algorithms/bwt.js');
const InvertedIndex = require('../../src/js/algorithms/inverted-index.js');
const FuzzySearch = require('../../src/js/algorithms/fuzzy-search.js');

const WORDS = Corpus.words();

function suffixArrayOf(text) {
  return SuffixArray.build(text, { method: 'sais' }).sa;
}

/* --------------------------------------------------------- BWT / FM-index */

test('burrows-wheeler: mississippi transforms and inverts in 11 LF steps', function () {
  const index = Bwt.fmIndex('mississippi', { suffixArrayOf: suffixArrayOf, blockSize: 32 });

  assert.strictEqual(index.sa.join(','), '11,10,7,4,1,0,9,8,6,3,5,2');
  assert.strictEqual(index.last.length, 12);
  assert.strictEqual(index.last.replace(Bwt.SENTINEL, '_'), 'ipssm_pissii');
  assert.strictEqual(index.runs(), 9);

  const before = index.counts.before;
  assert.strictEqual(before.get(Bwt.SENTINEL), 0);
  assert.strictEqual(before.get('i'), 1);
  assert.strictEqual(before.get('m'), 5);
  assert.strictEqual(before.get('p'), 6);
  assert.strictEqual(before.get('s'), 8);
  assert.strictEqual(before.size, 5, 'five count-table entries for a 12-character text');

  index.resetStats();
  assert.strictEqual(index.inverse(), 'mississippi');
  assert.strictEqual(index.stats().lfSteps, 11);
  assert.strictEqual(index.stats().rankQueries, 11);
  assert.strictEqual(12 * 12, 144, 'the rotation matrix that was never built');
});

test('burrows-wheeler: the checkpoint dial on 4 000 characters of DNA', function () {
  const text = Corpus.dna(4000, 1);
  const probe = text.substr(Math.floor(text.length / 3), 4);
  const truth = Corpus.occurrences(text, probe).length;

  assert.strictEqual(probe, 'ACGT');
  assert.strictEqual(truth, 195);

  const measured = [8, 32, 128].map(function (blockSize) {
    const index = Bwt.fmIndex(text, { suffixArrayOf: suffixArrayOf, blockSize: blockSize });
    index.resetStats();
    const count = index.count(probe);
    return {
      blockSize: blockSize,
      rankBytes: index.rankBytes,
      bytesPerChar: index.bytesPerChar(),
      rankSteps: index.stats().rankSteps,
      count: count
    };
  });

  assert.strictEqual(measured[0].rankBytes, 10020);
  assert.strictEqual(measured[1].rankBytes, 2520);
  assert.strictEqual(measured[2].rankBytes, 640);

  assert.strictEqual(measured[0].bytesPerChar.toFixed(2), '3.76');
  assert.strictEqual(measured[1].bytesPerChar.toFixed(2), '1.88');
  assert.strictEqual(measured[2].bytesPerChar.toFixed(2), '1.41');

  assert.strictEqual(measured[0].rankSteps, 21);
  assert.strictEqual(measured[1].rankSteps, 117);
  assert.strictEqual(measured[2].rankSteps, 533);

  measured.forEach(function (row) {
    assert.strictEqual(row.count, truth, 'block size ' + row.blockSize + ' must give the same answer');
  });

  assert.strictEqual((measured[0].bytesPerChar / measured[2].bytesPerChar).toFixed(1), '2.7');
  assert.strictEqual(Math.round(measured[2].rankSteps / measured[0].rankSteps), 25);
  assert.strictEqual((9 / measured[0].bytesPerChar).toFixed(1), '2.4',
    'even the largest FM setting is 2.4x smaller than a suffix array plus LCP');
});

test('burrows-wheeler: runs expose structure rather than creating it', function () {
  const measured = {};
  [
    { name: 'dna', text: Corpus.dna(4000, 1) },
    { name: 'logs', text: Corpus.logs(200, 2).join(' ') },
    { name: 'random', text: Corpus.randomText(4000, 26, 4) }
  ].forEach(function (entry) {
    const index = Bwt.fmIndex(entry.text, { suffixArrayOf: suffixArrayOf, blockSize: 32 });
    measured[entry.name] = {
      length: entry.text.length,
      runs: index.runs(),
      perRun: entry.text.length / index.runs()
    };
  });

  assert.strictEqual(measured.logs.length, 4951);
  assert.strictEqual(measured.logs.runs, 304);
  assert.strictEqual(measured.logs.perRun.toFixed(1), '16.3');

  assert.strictEqual(measured.dna.runs, 1008);
  assert.strictEqual(measured.dna.perRun.toFixed(1), '4.0');

  assert.strictEqual(measured.random.runs, 3855);
  assert.strictEqual(measured.random.perRun.toFixed(1), '1.0');
});

/* -------------------------------------------------------- inverted index */

function skewedLists(shortLength) {
  const rng = Random.seeded(5);
  const long = [];
  for (let i = 0; i < 100000; i += 1) long.push(i * 2);

  const chosen = new Set();
  while (chosen.size < shortLength) chosen.add(rng.int(200000));
  return { long: long, short: Array.from(chosen).sort(function (a, b) { return a - b; }) };
}

function intersectionCost(shortLength) {
  const lists = skewedLists(shortLength);
  const out = {};
  InvertedIndex.STRATEGIES.forEach(function (strategy) {
    const stats = InvertedIndex.newStats();
    const result = InvertedIndex.intersect(lists.long, lists.short, strategy, stats);
    out[strategy] = { comparisons: stats.comparisons, result: result.join(',') };
  });
  return out;
}

test('inverted-indexes: the intersection sweep, and where galloping stops winning', function () {
  const at10 = intersectionCost(10);
  assert.strictEqual(at10.linear.comparisons, 90566);
  assert.strictEqual(at10.skip.comparisons, 1749);
  assert.strictEqual(at10.galloping.comparisons, 245);
  assert.strictEqual(Math.round(90566 / 245), 370, 'galloping is 370x cheaper at 10 000:1');

  const at1000 = intersectionCost(1000);
  assert.strictEqual(at1000.linear.comparisons, 100313);
  assert.strictEqual(at1000.skip.comparisons, 87618);
  assert.strictEqual(at1000.galloping.comparisons, 11336);
  assert.strictEqual((100313 / 11336).toFixed(1), '8.8');

  const at50000 = intersectionCost(50000);
  assert.strictEqual(at50000.linear.comparisons, 124751);
  assert.strictEqual(at50000.skip.comparisons, 182123);
  assert.strictEqual(at50000.galloping.comparisons, 157906);
  assert.ok(at50000.linear.comparisons < at50000.galloping.comparisons,
    'the linear merge wins once the lists are comparable');

  [at10, at1000, at50000].forEach(function (row) {
    assert.strictEqual(row.skip.result, row.linear.result, 'skip must agree');
    assert.strictEqual(row.galloping.result, row.linear.result, 'galloping must agree');
  });
});

test('inverted-indexes: 50 995 postings, and what each encoding costs', function () {
  const documents = Corpus.zipfDocuments({ count: 5000, vocabulary: 400, perDocument: 12, seed: 5 });
  const index = InvertedIndex.create({ positions: true });
  index.addAll(documents);
  const report = index.encodingReport();

  assert.strictEqual(index.documents(), 5000);
  assert.strictEqual(index.vocabulary(), 400);
  assert.strictEqual(report.entries, 50995);

  assert.strictEqual(report.rawBytes, 203980);
  assert.strictEqual(report.varbyteBytes, 55156);
  assert.strictEqual(report.simple9Bytes, 42644);

  assert.strictEqual(report.rawBitsPerPosting, 32);
  assert.strictEqual(report.varbyteBitsPerPosting.toFixed(2), '8.65');
  assert.strictEqual(report.simple9BitsPerPosting.toFixed(2), '6.69');

  assert.strictEqual((203980 / 55156).toFixed(2), '3.70', 'variable-byte saving');
  assert.strictEqual((203980 / 42644).toFixed(2), '4.78', 'Simple-9 saving');
  assert.strictEqual(Math.round(100 * (1 - report.simple9BitsPerPosting / report.varbyteBitsPerPosting)), 23,
    'Simple-9 is 23% better than variable-byte');

  assert.strictEqual(index.positionBytes(), 60000);
  assert.strictEqual((index.positionBytes() / report.varbyteBytes).toFixed(2), '1.09',
    'the positions cost more than the postings they annotate');
});

test('inverted-indexes: shortest-first is the largest free win', function () {
  const documents = Corpus.zipfDocuments({ count: 5000, vocabulary: 400, perDocument: 12, seed: 5 });
  const index = InvertedIndex.create({ positions: true });
  index.addAll(documents);

  const sizes = index.terms().map(function (term) { return { term: term, size: index.lookup(term).length }; })
    .sort(function (a, b) { return b.size - a.size; });

  assert.strictEqual(sizes[0].term, 't0');
  assert.strictEqual(sizes[0].size, 4294);
  assert.strictEqual(sizes[sizes.length - 1].size, 13);

  const query = sizes[0].term + ' ' + sizes[sizes.length - 1].term;
  const measured = {};
  InvertedIndex.STRATEGIES.forEach(function (strategy) {
    index.resetStats();
    const hits = index.search(query, strategy);
    measured[strategy] = { hits: hits.length, comparisons: index.stats().comparisons };
  });

  assert.strictEqual(measured.linear.comparisons, 4179);
  assert.strictEqual(measured.skip.comparisons, 545);
  assert.strictEqual(measured.galloping.comparisons, 185);
  assert.strictEqual(measured.linear.hits, 12);
  assert.strictEqual(measured.skip.hits, 12);
  assert.strictEqual(measured.galloping.hits, 12);
});

/* --------------------------------------------------------- fuzzy search */

test('autocomplete-and-fuzzy: "cat" within one edit, three back-ends', function () {
  const truth = FuzzySearch.bruteForce(WORDS, 'cat', 1, null);
  assert.strictEqual(truth.join(','), 'can,car,cast,cat,cut,eat,hat');
  assert.strictEqual(truth.length, 7);

  const result = Lab.compareFuzzy({ words: WORDS, queries: ['cat'], budget: 1, gramSize: 2 });
  const byId = {};
  result.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(result.expected, 7);

  assert.strictEqual(byId['bk-tree'].visits, 289);
  assert.strictEqual(byId['bk-tree'].found, 7);
  assert.strictEqual(byId['bk-tree'].recall, 1);
  assert.strictEqual(byId['bk-tree'].exact, true);

  assert.strictEqual(byId.automaton.visits, 291);
  assert.strictEqual(byId.automaton.found, 7);
  assert.strictEqual(byId.automaton.recall, 1);

  assert.strictEqual(byId.ngram.visits, 5);
  assert.strictEqual(byId.ngram.found, 2);
  assert.strictEqual(byId.ngram.recall.toFixed(3), '0.286');
  assert.strictEqual(byId.ngram.exact, false);
  assert.strictEqual(Math.round(byId['bk-tree'].visits / byId.ngram.visits), 58,
    '58x fewer verifications, and five of the seven answers missing');

  const grams = FuzzySearch.ngramIndex(WORDS, { size: 2 });
  assert.strictEqual(grams.search('cat', 1).join(','), 'cast,cat');
});

test('autocomplete-and-fuzzy: the fuzzy cost grows with the budget', function () {
  const atOne = Lab.compareFuzzy({ words: WORDS, queries: ['cat'], budget: 1, gramSize: 2 });
  const atTwo = Lab.compareFuzzy({ words: WORDS, queries: ['cat'], budget: 2, gramSize: 2 });

  const bkOne = atOne.rows.filter(function (r) { return r.id === 'bk-tree'; })[0];
  const bkTwo = atTwo.rows.filter(function (r) { return r.id === 'bk-tree'; })[0];

  assert.strictEqual(bkOne.visits, 289);
  assert.strictEqual(bkTwo.visits, 674);
  assert.strictEqual(atOne.expected, 7);
  assert.strictEqual(atTwo.expected, 60);
  assert.strictEqual((bkTwo.visits / bkOne.visits).toFixed(1), '2.3');
  assert.strictEqual((atTwo.expected / atOne.expected).toFixed(1), '8.6');
});

test('autocomplete-and-fuzzy: the top 8 completions of "con" cost 38 visits', function () {
  const scored = FuzzySearch.scoredTrie(WORDS.map(function (word, at) {
    return { word: word, score: WORDS.length - at };
  }));

  scored.resetStats();
  const top = scored.complete('con', 8);

  assert.strictEqual(top.length, 8);
  assert.strictEqual(top.map(function (entry) { return entry.word; }).join(','),
    'concept,concern,conclude,condition,conduct,confirm,conflict,connect');
  assert.strictEqual(scored.stats().nodeVisits, 38);
  assert.strictEqual(scored.stats().pruned, 3);
  assert.strictEqual(scored.nodes(), 2562);

  const all = WORDS.filter(function (word) { return word.indexOf('con') === 0; });
  assert.strictEqual(all.length, 22, 'the subtree holds 22 completions');
  assert.ok(scored.stats().nodeVisits < scored.nodes() / 10);
});

test('autocomplete-and-fuzzy: the n-gram index misses the only answer for "recieve"', function () {
  const truth = FuzzySearch.bruteForce(WORDS, 'recieve', 2, null);
  assert.strictEqual(truth.length, 1, 'one word within two edits of the misspelling');

  const grams = FuzzySearch.ngramIndex(WORDS, { size: 2 });
  grams.resetStats();
  const found = grams.search('recieve', 2);

  assert.strictEqual(found.length, 0);
  assert.strictEqual(grams.stats().candidates, 0, 'the threshold retrieved nothing to verify');

  const bk = FuzzySearch.bkTree(WORDS);
  assert.strictEqual(bk.search('recieve', 2).join(','), truth.join(','),
    'the exact back-end finds it');
});
