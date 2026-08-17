'use strict';

/**
 * Property tests for every text structure in M06.
 *
 * Two shapes, matching the two halves of the milestone:
 *
 *   - the dictionaries are driven through one interface by `text-lab` and
 *     checked against a sorted reference key list, the way M04 checked its
 *     trees;
 *   - the substring indexes are cross-checked against each other *and* against
 *     brute force, because every one of them can be subtly wrong in a way that
 *     passes its own membership tests — a suffix automaton missing its clone
 *     case accepts a superset and looks perfect from the inside.
 *
 * The adversarial inputs matter more than the corpora here. A one-letter
 * alphabet breaks SA-IS tie-breaks, the Fibonacci word is the extremal case for
 * distinct substrings, and random text is where the BWT stops compressing.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const Corpus = require('../../src/js/machines/text-corpus.js');
const Lab = require('../../src/js/machines/text-lab.js');

const Trie = require('../../src/js/algorithms/trie.js');
const RadixTrie = require('../../src/js/algorithms/radix-trie.js');
const TernaryTrie = require('../../src/js/algorithms/ternary-trie.js');
const Dawg = require('../../src/js/algorithms/dawg.js');
const SuffixTree = require('../../src/js/algorithms/suffix-tree.js');
const SuffixArray = require('../../src/js/algorithms/suffix-array.js');
const SuffixAutomaton = require('../../src/js/algorithms/suffix-automaton.js');
const Bwt = require('../../src/js/algorithms/bwt.js');
const InvertedIndex = require('../../src/js/algorithms/inverted-index.js');
const FuzzySearch = require('../../src/js/algorithms/fuzzy-search.js');

const WORDS = Corpus.words();

const TEXTS = [
  { name: 'banana', text: 'banana' },
  { name: 'mississippi', text: 'mississippi' },
  { name: 'one letter', text: Corpus.repeated('a', 200) },
  { name: 'two letters', text: Corpus.randomText(300, 2, 4) },
  { name: 'fibonacci word', text: Corpus.fibonacciWord(13) },
  { name: 'dna', text: Corpus.dna(400, 1) },
  { name: 'english', text: WORDS.join(' ').slice(0, 400) }
];

function suffixArrayOf(text) {
  return SuffixArray.build(text, { method: 'sais' }).sa;
}

/* ------------------------------------------------------ the dictionaries */

Lab.DICTIONARY_FAMILIES.forEach(function (family) {
  test(family.id + ': holds exactly the key set and its own invariants', function () {
    const result = Lab.compareDictionaries({ keys: WORDS, families: [family.id] })[0];

    assert.ok(result.ok, family.id + ': ' + result.errors.join('; '));
    assert.ok(result.nodes > 0);
    assert.ok(result.bytes > 0);
  });
});

test('tries: the three layouts hold the identical structure', function () {
  const built = Trie.LAYOUTS.map(function (layout) {
    const trie = Trie.create({ layout: layout });
    WORDS.forEach(trie.insert);
    return { layout: layout, trie: trie };
  });

  const reference = WORDS.slice().sort().join(',');
  built.forEach(function (entry) {
    assert.strictEqual(entry.trie.keys().join(','), reference, entry.layout);
    assert.strictEqual(entry.trie.nodes(), built[0].trie.nodes(),
      'the layout must not change the node count');
    assert.ok(entry.trie.checkInvariants().ok);
  });

  const bytes = built.map(function (entry) { return entry.trie.bytes(); });
  assert.ok(bytes[1] > bytes[0], 'the alphabet-array layout is the largest');
  assert.ok(bytes[2] < bytes[0], 'the sorted-child layout is the smallest');
});

test('tries: a TrieView snapshot works for every child layout', function () {
  /* The child container differs by layout, so a snapshot that reaches into
     node.children directly works for one of the three and throws for the other
     two - which is exactly what happened, and only in the browser. */
  Trie.LAYOUTS.forEach(function (layout) {
    const trie = Trie.create({ layout: layout });
    WORDS.slice(0, 200).forEach(trie.insert);

    const snapshot = Lab.snapshot(trie.root(), {
      limit: 40,
      childrenOf: trie.childrenOf,
      labelOf: function (child, symbol) { return symbol; }
    });

    let counted = 0;
    (function count(node) { counted += 1; node.children.forEach(count); }(snapshot));

    assert.ok(counted > 1, layout + ': the snapshot is empty');
    assert.ok(counted <= 45, layout + ': the snapshot ignored its budget');
    assert.ok(snapshot.children.length > 0, layout + ': the root has no children');
    assert.ok(snapshot.children.every(function (child) { return child.label.length <= 1; }),
      layout + ': a plain-trie edge carries one character');
  });
});

test('tries: deletion prunes the nodes it made unreachable', function () {
  const trie = Trie.create({ layout: 'map' });
  WORDS.forEach(trie.insert);
  const before = trie.nodes();

  const half = WORDS.filter(function (_, i) { return i % 2 === 0; });
  half.forEach(trie.remove);

  assert.strictEqual(trie.size(), WORDS.length - half.length);
  assert.ok(trie.nodes() < before, 'the node count must fall: ' + before + ' → ' + trie.nodes());
  assert.ok(trie.checkInvariants().ok, trie.checkInvariants().errors.join('; '));
  assert.strictEqual(trie.keys().join(','),
    WORDS.filter(function (_, i) { return i % 2 === 1; }).sort().join(','));
});

test('tries: withPrefix and longestPrefixOf agree with a linear scan', function () {
  const trie = Trie.create({ layout: 'map' });
  WORDS.forEach(trie.insert);

  ['con', 'a', 'zz', '', 'contract'].forEach(function (prefix) {
    const expected = WORDS.filter(function (word) { return word.indexOf(prefix) === 0; }).sort();
    assert.strictEqual(trie.withPrefix(prefix).join(','), expected.join(','), 'prefix "' + prefix + '"');
  });

  ['contracts', 'according', 'zzz', 'a'].forEach(function (text) {
    const expected = WORDS.filter(function (word) { return text.indexOf(word) === 0; })
      .reduce(function (best, word) { return word.length > best.length ? word : best; }, '');
    assert.strictEqual(trie.longestPrefixOf(text), expected || null, 'longestPrefixOf("' + text + '")');
  });
});

test('radix trie: compression never changes the key set, on any shape of key', function () {
  const sets = [
    { name: 'words', keys: WORDS.slice(0, 400) },
    { name: 'hex', keys: Corpus.hexKeys(400, 32, 9) },
    { name: 'shared prefix', keys: Corpus.sharedPrefixKeys(200, 40) }
  ];

  sets.forEach(function (set) {
    const radix = RadixTrie.create({});
    set.keys.forEach(radix.insert);

    assert.strictEqual(radix.keys().join(','), set.keys.slice().sort().join(','), set.name);
    assert.ok(radix.checkInvariants().ok, set.name + ': ' + radix.checkInvariants().errors.join('; '));
    assert.ok(radix.nodes() <= 2 * set.keys.length,
      set.name + ': ' + radix.nodes() + ' nodes for ' + set.keys.length + ' keys, over the 2k bound');
  });
});

test('radix trie: a key ending at a split point survives', function () {
  const radix = RadixTrie.create({});
  ['romane', 'romanus', 'roman', 'rom', 'r'].forEach(radix.insert);

  assert.strictEqual(radix.keys().join(','), 'r,rom,roman,romane,romanus');
  ['r', 'rom', 'roman', 'romane', 'romanus'].forEach(function (key) {
    assert.strictEqual(radix.has(key), true, key + ' must be present');
  });
  assert.strictEqual(radix.has('roma'), false, 'a prefix that is not a key');
  assert.ok(radix.checkInvariants().ok);
});

test('radix trie: a prefix ending inside an edge still has completions', function () {
  const radix = RadixTrie.create({});
  WORDS.forEach(radix.insert);

  ['conn', 'contrac', 'x', ''].forEach(function (prefix) {
    const expected = WORDS.filter(function (word) { return word.indexOf(prefix) === 0; }).sort();
    assert.strictEqual(radix.withPrefix(prefix).join(','), expected.join(','),
      'prefix "' + prefix + '" ends inside an edge');
  });
});

test('radix trie: longest-prefix match routes an address to the deepest rule', function () {
  const table = RadixTrie.routingTable([
    { cidr: '0.0.0.0/0', via: 'default' },
    { cidr: '10.0.0.0/8', via: 'core' },
    { cidr: '10.1.0.0/16', via: 'edge' },
    { cidr: '10.1.2.0/24', via: 'rack' }
  ]);

  assert.strictEqual(table.lookup('10.1.2.7').via, 'rack');
  assert.strictEqual(table.lookup('10.1.2.7').length, 24);
  assert.strictEqual(table.lookup('10.1.9.9').via, 'edge');
  assert.strictEqual(table.lookup('10.9.9.9').via, 'core');
  assert.strictEqual(table.lookup('8.8.8.8').via, 'default');
  assert.strictEqual(RadixTrie.ipToBits('10.1.2.7').length, 32);
});

test('ternary tree: insertion order changes the height and not the key set', function () {
  const sorted = TernaryTrie.create({ keys: WORDS });
  const balanced = TernaryTrie.create({ keys: WORDS, balanced: true });

  const reference = WORDS.slice().sort().join(',');
  assert.strictEqual(sorted.keys().join(','), reference);
  assert.strictEqual(balanced.keys().join(','), reference);
  assert.strictEqual(sorted.nodes(), balanced.nodes(), 'the node count is the key set, not the order');
  assert.ok(balanced.height() < sorted.height(),
    'median order ' + balanced.height() + ' must beat sorted order ' + sorted.height());
  assert.ok(sorted.checkInvariants().ok);
  assert.ok(balanced.checkInvariants().ok);
});

test('ternary tree: withinDistance equals a brute-force scan', function () {
  const tree = TernaryTrie.create({ keys: WORDS, balanced: true });

  ['cat', 'hous', 'able', 'zzz'].forEach(function (query) {
    [0, 1, 2].forEach(function (budget) {
      const expected = WORDS.filter(function (word) {
        if (word.length !== query.length) return false;
        let differences = 0;
        for (let i = 0; i < word.length; i += 1) if (word[i] !== query[i]) differences += 1;
        return differences <= budget;
      }).sort();

      assert.strictEqual(tree.withinDistance(query, budget).join(','), expected.join(','),
        '"' + query + '" within ' + budget);
    });
  });
});

test('dawg: minimisation loses nothing and merges something', function () {
  const graph = Dawg.fromKeys(WORDS);
  const trie = Trie.create({ layout: 'map' });
  WORDS.forEach(trie.insert);

  assert.strictEqual(graph.keys().join(','), WORDS.slice().sort().join(','));
  assert.strictEqual(graph.size(), WORDS.length);
  assert.ok(graph.nodes() < trie.nodes(),
    graph.nodes() + ' states against ' + trie.nodes() + ' trie nodes');
  assert.ok(graph.stats().statesMerged > 0);
  assert.ok(graph.checkInvariants().ok, graph.checkInvariants().errors.join('; '));
});

test('dawg: unsorted input is rejected rather than silently wrong', function () {
  const graph = Dawg.create({});
  graph.insert('banana');
  assert.throws(function () { graph.insert('apple'); }, /sorted order/);
});

test('dawg: enumeration follows paths, not states', function () {
  /* Words sharing a suffix reach the same state by different paths; a walk
     that memoises on the state loses all but one of them. */
  const graph = Dawg.fromKeys(['talking', 'walking', 'running', 'talk', 'walk']);

  assert.strictEqual(graph.keys().join(','), 'running,talk,talking,walk,walking');
  assert.ok(graph.nodes() < 20, 'the shared "ing" must be merged: ' + graph.nodes() + ' states');
  assert.ok(graph.checkInvariants().ok);
});

/* --------------------------------------------------- the substring indexes */

TEXTS.forEach(function (entry) {
  test('substring indexes agree on ' + entry.name, function () {
    const result = Lab.compareSubstringIndexes({ text: entry.text, probes: 120, seed: 6 });

    assert.strictEqual(result.disagreements.length, 0,
      entry.name + ': ' + JSON.stringify(result.disagreements.slice(0, 3)));
    assert.ok(result.distinctSubstrings.agree,
      entry.name + ': array ' + result.distinctSubstrings.array +
      ' against automaton ' + result.distinctSubstrings.automaton);
    result.rows.forEach(function (row) {
      assert.ok(row.ok, entry.name + ' / ' + row.label + ': invariants broken');
    });
  });
});

TEXTS.forEach(function (entry) {
  test('distinct substrings match brute force on ' + entry.name, function () {
    if (entry.text.length > 400) return;
    const brute = Corpus.distinctSubstrings(entry.text).size;
    assert.strictEqual(SuffixArray.build(entry.text).distinctSubstrings(), brute, 'suffix array');
    assert.strictEqual(SuffixAutomaton.build(entry.text).distinctSubstrings(), brute, 'suffix automaton');
  });
});

test('suffix array: the three constructions produce the identical array', function () {
  TEXTS.forEach(function (entry) {
    const naive = SuffixArray.build(entry.text, { method: 'naive' }).sa.join(',');
    const doubling = SuffixArray.build(entry.text, { method: 'doubling' }).sa.join(',');
    const sais = SuffixArray.build(entry.text, { method: 'sais' }).sa.join(',');

    assert.strictEqual(doubling, naive, entry.name + ': doubling disagrees with the naive sort');
    assert.strictEqual(sais, naive, entry.name + ': SA-IS disagrees with the naive sort');
  });
});

test('suffix array: LCP entries are exact, and the search range is right', function () {
  TEXTS.forEach(function (entry) {
    const built = SuffixArray.build(entry.text);
    assert.ok(built.checkInvariants().ok, entry.name + ': ' + built.checkInvariants().errors.join('; '));

    const patterns = Lab.samplePatterns(entry.text, 40, 8);
    patterns.forEach(function (pattern) {
      const expected = Corpus.occurrences(entry.text, pattern);
      assert.strictEqual(built.occurrences(pattern).join(','), expected.join(','),
        entry.name + ': occurrences of "' + pattern + '"');
    });
  });
});

test('suffix tree: every suffix ends at its own leaf', function () {
  TEXTS.forEach(function (entry) {
    const tree = SuffixTree.build(entry.text);
    assert.ok(tree.checkInvariants().ok, entry.name + ': ' + tree.checkInvariants().errors.join('; '));
    assert.strictEqual(tree.leaves(), entry.text.length + 1, entry.name + ': leaf count');

    const array = SuffixArray.build(entry.text + '$');
    assert.strictEqual(tree.suffixArray().join(','), array.sa.slice(1).join(','),
      entry.name + ': the tree and the array disagree on the suffix order');
  });
});

test('suffix tree: occurrence counts match brute force', function () {
  ['banana', 'mississippi', Corpus.dna(300, 1)].forEach(function (text) {
    const tree = SuffixTree.build(text);
    Lab.samplePatterns(text, 40, 9).forEach(function (pattern) {
      assert.strictEqual(tree.countOccurrences(pattern), Corpus.occurrences(text, pattern).length,
        'count of "' + pattern + '" in a ' + text.length + '-character text');
    });
  });
});

test('suffix automaton: the endpos identity holds and the bounds are respected', function () {
  TEXTS.forEach(function (entry) {
    const automaton = SuffixAutomaton.build(entry.text);
    assert.ok(automaton.checkInvariants().ok,
      entry.name + ': ' + automaton.checkInvariants().errors.join('; '));

    const n = entry.text.length;
    assert.ok(automaton.stateCount() <= 2 * n - 1, entry.name + ': state bound');
    assert.ok(automaton.transitions() <= Math.max(1, 3 * n - 4), entry.name + ': transition bound');
  });
});

test('suffix automaton: it accepts only substrings, where the oracle does not', function () {
  /* Texts chosen because the oracle demonstrably over-accepts on them. On many
     strings - banana among them - the oracle happens to be exact, which is
     precisely why "I tried a few and it worked" is not a test. */
  ['abbbaab', 'aabbabb', 'abbbaabb'].forEach(function (text) {
    const automaton = SuffixAutomaton.build(text);
    const oracle = SuffixAutomaton.factorOracle(text);
    const real = Corpus.distinctSubstrings(text);

    const letters = Corpus.alphabetOf(text);
    const probes = [];
    const grow = function (prefix) {
      if (prefix.length >= 4) return;
      letters.forEach(function (symbol) { probes.push(prefix + symbol); grow(prefix + symbol); });
    };
    grow('');

    const automatonWrong = probes.filter(function (p) { return automaton.has(p) !== real.has(p); });
    const oracleWrong = probes.filter(function (p) { return oracle.has(p) !== real.has(p); });

    assert.strictEqual(automatonWrong.length, 0, text + ': the automaton is wrong on ' + automatonWrong.join(','));
    assert.ok(oracleWrong.length > 0,
      text + ': the oracle should over-accept here, and the comparison is the section\'s point');
    assert.strictEqual(oracle.states, text.length + 1, 'the oracle always has exactly n + 1 states');
  });
});

test('suffix automaton: occurrence counts match brute force', function () {
  ['banana', 'mississippi', Corpus.dna(300, 1)].forEach(function (text) {
    const automaton = SuffixAutomaton.build(text);
    Lab.samplePatterns(text, 40, 11).forEach(function (pattern) {
      assert.strictEqual(automaton.countOccurrences(pattern), Corpus.occurrences(text, pattern).length,
        'count of "' + pattern + '"');
    });
  });
});

/* ------------------------------------------------------------ BWT and FM */

test('bwt: the transform round-trips on every corpus', function () {
  TEXTS.forEach(function (entry) {
    const index = Bwt.fmIndex(entry.text, { suffixArrayOf: suffixArrayOf });
    assert.strictEqual(index.inverse(), entry.text, entry.name + ': round trip');
    assert.ok(index.checkInvariants().ok, entry.name + ': ' + index.checkInvariants().errors.join('; '));
  });
});

test('fm-index: counting and locating match brute force', function () {
  ['banana', 'mississippi', Corpus.dna(400, 1)].forEach(function (text) {
    const index = Bwt.fmIndex(text, { suffixArrayOf: suffixArrayOf, sampleEvery: 8 });

    Lab.samplePatterns(text, 40, 12).forEach(function (pattern) {
      const expected = Corpus.occurrences(text, pattern);
      assert.strictEqual(index.count(pattern), expected.length, 'count of "' + pattern + '"');
      assert.strictEqual(index.locate(pattern).join(','), expected.join(','), 'locate "' + pattern + '"');
    });
  });
});

test('fm-index: the rank backend is a space/time dial and not a correctness one', function () {
  const text = Corpus.dna(2000, 1);
  const pattern = text.substr(500, 4);

  const scan = Bwt.fmIndex(text, { suffixArrayOf: suffixArrayOf, rank: 'scan' });
  const sampled = [8, 32, 128].map(function (blockSize) {
    return Bwt.fmIndex(text, { suffixArrayOf: suffixArrayOf, blockSize: blockSize });
  });

  const truth = Corpus.occurrences(text, pattern).length;
  assert.strictEqual(scan.count(pattern), truth, 'the scanning backend');
  sampled.forEach(function (index, i) {
    assert.strictEqual(index.count(pattern), truth, 'block size ' + [8, 32, 128][i]);
    assert.strictEqual(index.inverse(), text, 'block size ' + [8, 32, 128][i] + ' round trip');
  });

  assert.ok(sampled[0].rankBytes > sampled[2].rankBytes, 'tighter checkpoints cost more space');
  assert.strictEqual(scan.rankBytes, 0, 'the scanning backend stores nothing');
});

test('bwt: runs expose structure and do not create it', function () {
  const structured = Bwt.fmIndex(Corpus.logs(200, 2).join(' '), { suffixArrayOf: suffixArrayOf });
  const random = Bwt.fmIndex(Corpus.randomText(4000, 26, 4), { suffixArrayOf: suffixArrayOf });

  const structuredPerRun = structured.last.length / structured.runs();
  const randomPerRun = random.last.length / random.runs();

  assert.ok(structuredPerRun > 5, 'log text should run: ' + structuredPerRun.toFixed(1) + ' characters per run');
  assert.ok(randomPerRun < 1.2, 'random text should not: ' + randomPerRun.toFixed(1));
});

/* --------------------------------------------------------- inverted index */

test('inverted index: the three strategies return the identical result', function () {
  const documents = Corpus.zipfDocuments({ count: 2000, vocabulary: 200, perDocument: 10, seed: 5 });
  const index = InvertedIndex.create({ positions: true });
  index.addAll(documents);

  assert.ok(index.checkInvariants().ok, index.checkInvariants().errors.join('; '));

  const terms = index.terms();
  const rng = Random.seeded(5);
  for (let round = 0; round < 20; round += 1) {
    const query = terms[rng.int(terms.length)] + ' ' + terms[rng.int(terms.length)];
    const results = InvertedIndex.STRATEGIES.map(function (strategy) {
      return index.search(query, strategy).join(',');
    });
    assert.strictEqual(results[1], results[0], query + ': skip disagrees');
    assert.strictEqual(results[2], results[0], query + ': galloping disagrees');
  }
});

test('inverted index: search and phrase agree with a linear scan', function () {
  const documents = Corpus.logs(400, 2);
  const index = InvertedIndex.create({ positions: true });
  index.addAll(documents);

  ['api users', 'get health', 'post orders', 'delete session'].forEach(function (query) {
    const terms = InvertedIndex.tokenize(query);
    const expectedAnd = documents.map(function (text, id) { return { text: text, id: id }; })
      .filter(function (entry) {
        const tokens = InvertedIndex.tokenize(entry.text);
        return terms.every(function (term) { return tokens.indexOf(term) !== -1; });
      }).map(function (entry) { return entry.id; });

    assert.strictEqual(index.search(query, 'galloping').join(','), expectedAnd.join(','), 'AND ' + query);

    const expectedPhrase = documents.map(function (text, id) { return { text: text, id: id }; })
      .filter(function (entry) {
        return InvertedIndex.tokenize(entry.text).join(' ').indexOf(terms.join(' ')) !== -1;
      }).map(function (entry) { return entry.id; });

    assert.strictEqual(index.phrase(query, 'galloping').join(','), expectedPhrase.join(','), 'phrase ' + query);
  });
});

test('inverted index: gap coding round-trips and shrinks the postings', function () {
  const documents = Corpus.zipfDocuments({ count: 3000, vocabulary: 300, perDocument: 10, seed: 7 });
  const index = InvertedIndex.create({});
  index.addAll(documents);

  index.terms().forEach(function (term) {
    const list = index.lookup(term);
    assert.strictEqual(InvertedIndex.fromGaps(InvertedIndex.toGaps(list)).join(','), list.join(','), term);
  });

  const report = index.encodingReport();
  assert.ok(report.varbyteBitsPerPosting < report.rawBitsPerPosting, 'variable-byte must beat raw ids');
  assert.ok(report.simple9BitsPerPosting < report.varbyteBitsPerPosting, 'Simple-9 must beat variable-byte');
});

test('inverted index: galloping wins at skew and loses at parity', function () {
  const rng = Random.seeded(5);
  const long = [];
  for (let i = 0; i < 100000; i += 1) long.push(i * 2);

  const costOf = function (shortLength) {
    const chosen = new Set();
    const source = Random.seeded(5);
    while (chosen.size < shortLength) chosen.add(source.int(200000));
    const short = Array.from(chosen).sort(function (a, b) { return a - b; });

    const out = {};
    InvertedIndex.STRATEGIES.forEach(function (strategy) {
      const stats = InvertedIndex.newStats();
      const result = InvertedIndex.intersect(long, short, strategy, stats);
      out[strategy] = { comparisons: stats.comparisons, result: result.join(',') };
    });
    return out;
  };

  const skewed = costOf(10);
  const even = costOf(50000);

  assert.strictEqual(skewed.galloping.result, skewed.linear.result, 'the same answer at high skew');
  assert.strictEqual(even.galloping.result, even.linear.result, 'and at parity');
  assert.ok(skewed.galloping.comparisons < skewed.linear.comparisons / 100,
    'galloping should be two orders of magnitude cheaper at 10 000:1');
  assert.ok(even.galloping.comparisons > even.linear.comparisons,
    'and more expensive when the lists are comparable — which is the section\'s point');
  assert.ok(rng.int(2) >= 0);
});

/* ------------------------------------------------------------ fuzzy search */

test('fuzzy: the exact back-ends equal brute force and the n-gram index does not', function () {
  const queries = ['cat', 'hous', 'recieve', 'managment', 'abov'];

  [1, 2].forEach(function (budget) {
    const result = Lab.compareFuzzy({ words: WORDS, queries: queries, budget: budget, gramSize: 2 });

    const byId = {};
    result.rows.forEach(function (row) { byId[row.id] = row; });

    assert.strictEqual(byId['bk-tree'].exact, true, 'the BK-tree must be exact at budget ' + budget);
    assert.strictEqual(byId.automaton.exact, true, 'the automaton must be exact at budget ' + budget);
    assert.strictEqual(byId['bk-tree'].recall, 1, 'and its recall must be 1');
    assert.strictEqual(byId.automaton.recall, 1);
    assert.ok(byId.ngram.recall < 1, 'the n-gram index is approximate, and the section says so');
    assert.ok(byId.ngram.visits < byId['bk-tree'].visits, 'and it is much cheaper');
  });
});

test('fuzzy: the BK-tree prunes, and the metric it depends on holds', function () {
  const tree = FuzzySearch.bkTree(WORDS);

  assert.ok(tree.checkMetric().ok, tree.checkMetric().errors.join('; '));

  tree.resetStats();
  tree.search('cat', 1);
  assert.ok(tree.stats().nodeVisits < WORDS.length,
    'a distance-1 query visited ' + tree.stats().nodeVisits + ' of ' + WORDS.length + ' nodes');
  assert.ok(tree.stats().pruned > 0, 'and skipped some subtrees entirely');
});

test('fuzzy: the Levenshtein automaton cuts subtrees it cannot recover from', function () {
  const dictionary = FuzzySearch.dictionaryTrie(WORDS);
  const stats = FuzzySearch.newStats();
  const found = FuzzySearch.automatonSearch(dictionary.root, 'cat', 1, stats);

  assert.strictEqual(found.join(','), FuzzySearch.bruteForce(WORDS, 'cat', 1, null).join(','));
  assert.ok(stats.nodeVisits < dictionary.nodes(),
    'visited ' + stats.nodeVisits + ' of ' + dictionary.nodes() + ' trie nodes');
  assert.ok(stats.pruned > 0);
});

test('fuzzy: top-k completion returns the best k and prunes the rest', function () {
  const scored = FuzzySearch.scoredTrie(WORDS.map(function (word, at) {
    return { word: word, score: WORDS.length - at };
  }));

  scored.resetStats();
  const top = scored.complete('con', 8);
  const all = WORDS.filter(function (word) { return word.indexOf('con') === 0; });

  assert.strictEqual(top.length, 8);
  assert.strictEqual(top[0].word, all[0], 'the highest-scoring completion comes first');
  for (let i = 1; i < top.length; i += 1) {
    assert.ok(top[i].score < top[i - 1].score, 'the results must be ordered by score');
  }
  assert.ok(scored.stats().nodeVisits < scored.nodes() / 10,
    'visited ' + scored.stats().nodeVisits + ' of ' + scored.nodes() + ' nodes');

  assert.strictEqual(scored.complete('zzzz', 5).length, 0, 'a prefix nothing starts with');
  assert.strictEqual(scored.complete('con', 100).length, all.length, 'k larger than the subtree');
});
