'use strict';

/**
 * Every figure the M06.4-M06.6 worked examples quote, recomputed here.
 *
 * The construction traces, the size comparisons and the oracle probe set all
 * mirror what the sections run, so the prose and the screen cannot drift apart
 * without this file failing.
 */

const test = require('node:test');
const assert = require('node:assert');

const Corpus = require('../../src/js/machines/text-corpus.js');
const Lab = require('../../src/js/machines/text-lab.js');
const SuffixTree = require('../../src/js/algorithms/suffix-tree.js');
const SuffixArray = require('../../src/js/algorithms/suffix-array.js');
const SuffixAutomaton = require('../../src/js/algorithms/suffix-automaton.js');

/* ---------------------------------------------------------- suffix trees */

test('suffix-trees: banana$ builds in 7 phases with the remainder climbing to 3', function () {
  const tree = SuffixTree.build('banana', { trace: true });
  const trace = tree.trace;

  assert.strictEqual(trace.length, 7, 'one phase per character of banana$');
  assert.deepStrictEqual(trace.map(function (step) { return step.remainder; }), [0, 0, 0, 1, 2, 3, 0]);
  assert.deepStrictEqual(trace.map(function (step) { return step.activeLength; }), [0, 0, 0, 1, 2, 3, 0]);
  assert.deepStrictEqual(trace.map(function (step) { return step.nodes; }), [2, 3, 4, 4, 4, 4, 11]);
  assert.deepStrictEqual(trace.map(function (step) { return step.added; }), ['b', 'a', 'n', 'a', 'n', 'a', '$']);
});

test('suffix-trees: the finished banana tree, and the trie it replaces', function () {
  const tree = SuffixTree.build('banana');
  const stats = tree.stats();

  assert.strictEqual(tree.nodes(), 11);
  assert.strictEqual(tree.leaves(), 7, 'seven suffixes of banana$');
  assert.strictEqual(6 * 7 / 2, 21, 'the uncompressed suffix trie would hold 21 nodes');

  assert.strictEqual(stats.phases, 7);
  assert.strictEqual(stats.extensions, 10);
  assert.strictEqual(stats.rule2, 7);
  assert.strictEqual(stats.rule3, 3);
  assert.strictEqual(stats.splits, 3);
  assert.strictEqual(stats.suffixLinks, 3);

  assert.strictEqual(tree.longestRepeated(), 'ana');
  assert.ok(tree.checkInvariants().ok);
});

test('suffix-trees: four indexes agree on DNA and cost 42.3, 34.7, 9.0 and 1.9 bytes', function () {
  const text = Corpus.dna(2000, 1);
  const result = Lab.compareSubstringIndexes({ text: text, probes: 60, seed: 6 });

  assert.strictEqual(result.patterns, 60);
  assert.strictEqual(result.disagreements.length, 0);

  const byId = {};
  result.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId['suffix-tree'].units, 3527);
  assert.strictEqual(byId['suffix-array'].units, 2000);
  assert.strictEqual(byId['suffix-automaton'].units, 3668);
  assert.strictEqual(byId['fm-index'].units, 2001);

  assert.strictEqual((byId['suffix-tree'].units / text.length).toFixed(2), '1.76');
  assert.strictEqual((byId['suffix-automaton'].units / text.length).toFixed(2), '1.83');

  assert.strictEqual(byId['suffix-tree'].bytesPerChar.toFixed(1), '42.3');
  assert.strictEqual(byId['suffix-automaton'].bytesPerChar.toFixed(1), '34.7');
  assert.strictEqual(byId['suffix-array'].bytesPerChar.toFixed(1), '9.0');
  assert.strictEqual(byId['fm-index'].bytesPerChar.toFixed(1), '1.9');

  assert.strictEqual(Math.round(byId['suffix-tree'].bytesPerChar / byId['fm-index'].bytesPerChar), 22,
    'a spread of 22x between the largest and the smallest');
});

test('suffix-trees: scaled to a 3-gigabase genome', function () {
  const genome = 3e9;
  assert.strictEqual(Math.round(42.3 * genome / 1e9), 127, 'suffix tree, GB');
  assert.strictEqual(Math.round(9.0 * genome / 1e9), 27, 'suffix array plus LCP, GB');
  assert.strictEqual((1.88 * genome / 1e9).toFixed(1), '5.6', 'FM-index, GB');
});

/* --------------------------------------------------------- suffix arrays */

test('suffix-arrays: mississippi doubles to the textbook array in 3 rounds', function () {
  const built = SuffixArray.build('mississippi', { method: 'doubling', trace: true });

  assert.strictEqual(built.sa.join(','), '10,7,4,1,0,9,8,6,3,5,2');
  assert.strictEqual(built.lcp.join(','), '0,1,1,4,0,0,1,0,2,1,3');
  assert.strictEqual(built.trace.length, 3, 'the ranks are all distinct after 3 rounds');

  assert.strictEqual(built.longestRepeated(), 'issi');
  assert.strictEqual(Math.max.apply(null, built.lcp), 4);

  assert.strictEqual(11 * 12 / 2, 66);
  assert.strictEqual(built.lcp.reduce(function (a, b) { return a + b; }, 0), 13);
  assert.strictEqual(built.distinctSubstrings(), 53);
  assert.strictEqual(SuffixAutomaton.build('mississippi').distinctSubstrings(), 53,
    'the automaton must reach the same number by a different route');
  assert.strictEqual(Corpus.distinctSubstrings('mississippi').size, 53, 'and so must brute force');
});

test('suffix-arrays: "ssi" occupies one range of the mississippi array', function () {
  const built = SuffixArray.build('mississippi');
  const range = built.rangeOf('ssi');

  assert.strictEqual(range.first, 9);
  assert.strictEqual(range.last, 11);
  assert.strictEqual(range.count, 2);
  assert.strictEqual(built.occurrences('ssi').join(','), '2,5');
  assert.strictEqual(Corpus.occurrences('mississippi', 'ssi').join(','), '2,5');
});

test('suffix-arrays: the three constructions on 4 000 characters of DNA', function () {
  const text = Corpus.dna(4000, 1);
  const measured = {};

  ['naive', 'doubling', 'sais'].forEach(function (method) {
    const built = SuffixArray.build(text, { method: method });
    measured[method] = { stats: built.stats(), sa: built.sa.join(',') };
  });

  assert.strictEqual(measured.naive.stats.comparisons, 42555);
  assert.strictEqual(measured.naive.stats.charComparisons, 77241942);
  assert.strictEqual(Math.round(77241942 / 42555), 1815, 'characters touched per comparison');

  assert.strictEqual(measured.doubling.stats.comparisons, 159592);
  assert.strictEqual(measured.doubling.stats.charComparisons, 0, 'doubling compares integers');
  assert.strictEqual(measured.doubling.stats.rounds, 6);
  assert.strictEqual(Math.ceil(Math.log2(4000)), 12, 'and exits well before the log n bound');

  assert.strictEqual(measured.sais.stats.comparisons, 0, 'SA-IS compares nothing');
  assert.strictEqual(measured.sais.stats.charComparisons, 0);
  assert.strictEqual(measured.sais.stats.recursions, 4);

  assert.strictEqual(measured.doubling.sa, measured.naive.sa);
  assert.strictEqual(measured.sais.sa, measured.naive.sa);
});

test('suffix-arrays: all three agree on all four corpora, including one letter', function () {
  const corpora = [
    Corpus.dna(4000, 1),
    Corpus.words().join(' ').slice(0, 4000),
    Corpus.repeated('a', 4000),
    Corpus.randomText(4000, 2, 4)
  ];

  assert.strictEqual(corpora.length, 4);
  corpora.forEach(function (text, at) {
    const reference = SuffixArray.build(text, { method: 'sais' }).sa.join(',');
    assert.strictEqual(SuffixArray.build(text, { method: 'naive' }).sa.join(','), reference, 'corpus ' + at);
    assert.strictEqual(SuffixArray.build(text, { method: 'doubling' }).sa.join(','), reference, 'corpus ' + at);
  });
});

/* ------------------------------------------------------ suffix automata */

test('suffix-automata: abbbaab needs 10 states, 13 transitions and 2 clones', function () {
  const text = 'abbbaab';
  const automaton = SuffixAutomaton.build(text, { trace: true });

  assert.strictEqual(text.length, 7);
  assert.strictEqual(automaton.stateCount(), 10);
  assert.strictEqual(automaton.transitions(), 13);
  assert.strictEqual(automaton.clones(), 2);

  assert.strictEqual(2 * text.length - 1, 13, 'the state bound');
  assert.strictEqual(3 * text.length - 4, 17, 'the transition bound');
  assert.strictEqual(text.length + 1, 8, 'prefix states, before any clone');
  assert.strictEqual(8 + automaton.clones(), automaton.stateCount(), 'prefixes plus clones');

  assert.ok(automaton.checkInvariants().ok, automaton.checkInvariants().errors.join('; '));
});

test('suffix-automata: abbbaab has 21 distinct substrings, three ways', function () {
  const text = 'abbbaab';
  const automaton = SuffixAutomaton.build(text);
  const array = SuffixArray.build(text);

  assert.strictEqual(automaton.distinctSubstrings(), 21);
  assert.strictEqual(array.distinctSubstrings(), 21);
  assert.strictEqual(Corpus.distinctSubstrings(text).size, 21);

  assert.strictEqual(7 * 8 / 2, 28);
  assert.strictEqual(array.lcp.reduce(function (a, b) { return a + b; }, 0), 7);
  assert.strictEqual(28 - 7, 21);
  assert.strictEqual(automaton.stateCount() - 1, 9, 'nine non-initial states contribute the sum');
});

test('suffix-automata: the oracle is 8 states and wrong on 3 of 30 probes', function () {
  const text = 'abbbaab';
  const automaton = SuffixAutomaton.build(text);
  const oracle = SuffixAutomaton.factorOracle(text);
  const real = Corpus.distinctSubstrings(text);

  assert.strictEqual(oracle.states, 8, 'exactly n + 1, always');
  assert.strictEqual(automaton.stateCount(), 10);
  assert.strictEqual(Math.round(100 * (1 - oracle.states / automaton.stateCount())), 20,
    'the oracle is 20% smaller');

  const letters = Corpus.alphabetOf(text);
  const probes = [];
  const grow = function (prefix) {
    if (prefix.length >= 4) return;
    letters.forEach(function (symbol) { probes.push(prefix + symbol); grow(prefix + symbol); });
  };
  grow('');

  assert.strictEqual(probes.length, 30, 'every string of length 1 to 4 over two letters');

  const automatonWrong = probes.filter(function (p) { return automaton.has(p) !== real.has(p); });
  const oracleWrong = probes.filter(function (p) { return oracle.has(p) !== real.has(p); });

  assert.strictEqual(automatonWrong.length, 0);
  assert.strictEqual(oracleWrong.sort().join(','), 'aba,abaa,abba');

  real.forEach(function (substring) {
    assert.strictEqual(oracle.has(substring), true,
      'the oracle accepts every real substring too, which is why a spot check passes it');
  });
});
