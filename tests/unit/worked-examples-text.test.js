'use strict';

/**
 * Every figure the M06.1-M06.3 worked examples quote, recomputed here.
 *
 * The harnesses mirror what each section's demo runs — same corpus, same key
 * counts, same derived seeds — so a learner who opens the section sees the
 * numbers the prose claims. A figure that moves fails here rather than drifting
 * quietly in the text.
 */

const test = require('node:test');
const assert = require('node:assert');

const Corpus = require('../../src/js/machines/text-corpus.js');
const Lab = require('../../src/js/machines/text-lab.js');
const Trie = require('../../src/js/algorithms/trie.js');
const RadixTrie = require('../../src/js/algorithms/radix-trie.js');
const TernaryTrie = require('../../src/js/algorithms/ternary-trie.js');
const Dawg = require('../../src/js/algorithms/dawg.js');

const WORDS = Corpus.words();
const HASH_BYTES_PER_KEY = 40;

function trieFor(layout, keys) {
  const trie = Trie.create({ layout: layout });
  (keys || WORDS).forEach(trie.insert);
  return trie;
}

/* ------------------------------------------------------------------ tries */

test('tries: 883 words hold 4 732 characters and produce 2 562 nodes', function () {
  const characters = WORDS.reduce(function (total, word) { return total + word.length; }, 0);
  const trie = trieFor('map');

  assert.strictEqual(WORDS.length, 883);
  assert.strictEqual(characters, 4732);
  assert.strictEqual(trie.nodes(), 2562);
  assert.strictEqual((trie.nodes() / WORDS.length).toFixed(2), '2.90');
  assert.strictEqual((trie.nodes() / characters).toFixed(2), '0.54');
});

test('tries: the three layouts cost 81 968, 573 888 and 64 041 bytes', function () {
  const measured = {};
  Trie.LAYOUTS.forEach(function (layout) {
    const trie = trieFor(layout);
    measured[layout] = { bytes: trie.bytes(), nodes: trie.nodes() };
  });

  assert.strictEqual(measured.map.bytes, 81968);
  assert.strictEqual(measured.array.bytes, 573888);
  assert.strictEqual(measured.sorted.bytes, 64041);

  assert.strictEqual((measured.map.bytes / WORDS.length).toFixed(1), '92.8');
  assert.strictEqual((measured.array.bytes / WORDS.length).toFixed(1), '649.9');
  assert.strictEqual((measured.sorted.bytes / WORDS.length).toFixed(1), '72.5');

  assert.strictEqual(measured.map.nodes, measured.array.nodes, 'the layout does not change the structure');
  assert.strictEqual(measured.map.nodes, measured.sorted.nodes);
  assert.strictEqual(Math.round(measured.array.bytes / measured.sorted.bytes), 9,
    'a factor of nine between the extremes');
});

test('tries: the hash-table comparison is 2.32x on memory and 5.04 steps', function () {
  const trie = trieFor('map');
  const misses = Lab.missesFor(WORDS, Math.floor(WORDS.length / 4), 4);

  trie.resetStats();
  WORDS.forEach(trie.has);
  misses.forEach(trie.has);
  const steps = trie.stats().charSteps / (WORDS.length + misses.length);

  assert.strictEqual(misses.length, 220);
  assert.strictEqual((trie.bytes() / (WORDS.length * HASH_BYTES_PER_KEY)).toFixed(2), '2.32');
  assert.strictEqual(steps.toFixed(2), '5.04');
  assert.strictEqual(WORDS.length * HASH_BYTES_PER_KEY, 35320);
});

test('tries: "con" costs 3 steps and returns 22 completions', function () {
  const trie = trieFor('map');
  trie.resetStats();
  const completions = trie.withPrefix('con');

  assert.strictEqual(completions.length, 22);
  assert.strictEqual(trie.stats().charSteps, 3, 'one step per prefix character, and no more');
  assert.strictEqual(completions.slice(0, 4).join(','), 'concept,concern,conclude,condition');
  assert.strictEqual(Math.round(WORDS.length / (3 + completions.length)), 35,
    '883 hash-table tests against 25 trie operations');
  assert.strictEqual(trie.longestPrefixOf('contracts'), 'contract');
  assert.strictEqual('contracts'.length, 9);
});

test('tries: deleting half the words prunes 2 562 nodes to 1 504', function () {
  const trie = trieFor('map');
  const half = WORDS.filter(function (_, i) { return i % 2 === 0; });

  assert.strictEqual(half.length, 442);
  half.forEach(trie.remove);

  assert.strictEqual(trie.size(), 441);
  assert.strictEqual(trie.nodes(), 1504);
  assert.ok(trie.checkInvariants().ok);
});

test('tries: a 4-symbol alphabet in a 256-slot node wastes 98%', function () {
  assert.strictEqual(Math.round(100 * (1 - 4 / 256)), 98);
  assert.strictEqual(Corpus.alphabetOf(Corpus.dna(2000, 1)).join(''), 'ACGT');
});

/* -------------------------------------------------------- compressed tries */

function keySets() {
  const words = WORDS.slice(0, 400);
  const paths = [];
  for (let i = 0; i < 400; i += 1) {
    paths.push('/usr/local/share/' + WORDS[i % WORDS.length] + '/' + WORDS[(i * 7) % WORDS.length] + '.conf');
  }
  return {
    words: words,
    paths: Array.from(new Set(paths)),
    hex: Corpus.hexKeys(400, 32, 9)
  };
}

function compare(keys) {
  const plain = Trie.create({ layout: 'map', alphabet: Corpus.alphabetOf(keys.join('')).join('') });
  keys.forEach(plain.insert);
  const radix = RadixTrie.create({});
  keys.forEach(radix.insert);
  return { plain: plain, radix: radix, keys: keys };
}

test('compressed-tries: the three key sets compress 2.14x, 9.98x and 22.45x', function () {
  const sets = keySets();

  const words = compare(sets.words);
  assert.strictEqual(words.plain.nodes(), 1206);
  assert.strictEqual(words.radix.nodes(), 564);
  assert.strictEqual((words.plain.nodes() / words.radix.nodes()).toFixed(2), '2.14');
  assert.strictEqual(words.radix.stats().splits, 163);

  const paths = compare(sets.paths);
  assert.strictEqual(paths.plain.nodes(), 5799);
  assert.strictEqual(paths.radix.nodes(), 581);
  assert.strictEqual((paths.plain.nodes() / paths.radix.nodes()).toFixed(2), '9.98');
  assert.strictEqual(paths.radix.stats().splits, 180);

  const hex = compare(sets.hex);
  assert.strictEqual(hex.plain.nodes(), 12212);
  assert.strictEqual(hex.radix.nodes(), 544);
  assert.strictEqual((hex.plain.nodes() / hex.radix.nodes()).toFixed(2), '22.45');
  assert.strictEqual(hex.radix.stats().splits, 143);
});

test('compressed-tries: the radix node count barely moves across the three', function () {
  const sets = keySets();
  const counts = [sets.words, sets.paths, sets.hex].map(function (keys) {
    return compare(keys).radix.nodes();
  });

  assert.deepStrictEqual(counts, [564, 581, 544]);
  assert.strictEqual((counts[0] / 400).toFixed(2), '1.41', 'words');
  assert.strictEqual((counts[1] / 400).toFixed(2), '1.45', 'paths');
  assert.strictEqual((counts[2] / 400).toFixed(2), '1.36', 'hex keys');
  assert.strictEqual(Math.round(100 * (1 - 581 / 5799)), 90, 'paths: 90% of the nodes removed');
  assert.strictEqual(Math.round(100 * (1 - 544 / 12212)), 96, 'hex: 96% removed');
});

test('compressed-tries: 94.5% of the nodes are node4s, and ART still loses here', function () {
  const words = WORDS.slice(0, 400);
  const plain = RadixTrie.create({});
  words.forEach(plain.insert);
  const adaptive = RadixTrie.create({ adaptive: true });
  words.forEach(adaptive.insert);

  const classes = adaptive.nodeClasses();
  assert.strictEqual(classes.node4, 533);
  assert.strictEqual(classes.node16, 30);
  assert.strictEqual(classes.node48, 1);
  assert.strictEqual(classes.node256, 0);
  assert.strictEqual((100 * classes.node4 / adaptive.nodes()).toFixed(1), '94.5');

  assert.strictEqual(plain.bytes(), 23749);
  assert.strictEqual((plain.bytes() / words.length).toFixed(1), '59.4');
  assert.strictEqual((adaptive.bytes() / words.length).toFixed(1), '96.8');
  assert.ok(adaptive.bytes() > plain.bytes(), 'the adaptive layout is larger at this key-set size');

  const uniform = plain.nodes() * 256 * 8;
  assert.strictEqual(uniform, 1155072);
  assert.strictEqual((uniform / plain.bytes()).toFixed(1), '48.6');
});

test('compressed-tries: the routing table picks the longest match', function () {
  const table = RadixTrie.routingTable([
    { cidr: '0.0.0.0/0', via: 'default gateway' },
    { cidr: '10.0.0.0/8', via: 'core router' },
    { cidr: '10.1.0.0/16', via: 'edge switch' },
    { cidr: '10.1.2.0/24', via: 'rack top-of-rack' },
    { cidr: '192.168.0.0/16', via: 'lab network' }
  ]);

  assert.strictEqual(table.lookup('10.1.2.7').length, 24);
  assert.strictEqual(table.lookup('10.1.9.9').length, 16);
  assert.strictEqual(table.lookup('10.9.9.9').length, 8);
  assert.strictEqual(table.lookup('8.8.8.8').length, 0);
  assert.strictEqual(RadixTrie.ipToBits('10.1.2.7'), '00001010000000010000001000000111');
});

test('compressed-tries: a radix lookup does 9.46 character steps to the trie\'s 5.56', function () {
  const words = WORDS.slice(0, 400);
  const plain = Trie.create({ layout: 'map', alphabet: Corpus.alphabetOf(words.join('')).join('') });
  words.forEach(plain.insert);
  const radix = RadixTrie.create({});
  words.forEach(radix.insert);

  const cost = function (structure) {
    structure.resetStats();
    words.forEach(structure.has);
    return structure.stats().charSteps / words.length;
  };

  assert.strictEqual(cost(radix).toFixed(2), '9.46');
  assert.strictEqual(cost(plain).toFixed(2), '5.56');
});

/* ---------------------------------------------------- dictionary automata */

test('dictionary-automata: 2 562 trie nodes minimise to 721 DAWG states', function () {
  const graph = Dawg.fromKeys(WORDS);
  const trie = trieFor('map');

  assert.strictEqual(graph.nodes(), 721);
  assert.strictEqual(trie.nodes(), 2562);
  assert.strictEqual((trie.nodes() / graph.nodes()).toFixed(2), '3.55');

  assert.strictEqual(graph.stats().statesMerged, 1841);
  assert.strictEqual(graph.registerSize(), 720);

  assert.strictEqual(graph.bytes(), 25450);
  assert.strictEqual(trie.bytes(), 81968);
  assert.strictEqual((trie.bytes() / graph.bytes()).toFixed(2), '3.22');
  assert.strictEqual((graph.bytes() / WORDS.length).toFixed(1), '28.8');
});

test('dictionary-automata: the DAWG lookup costs the same 5.04 steps as the trie', function () {
  const rows = Lab.compareDictionaries({ keys: WORDS, families: ['trie-map', 'dawg'] });
  const byId = {};
  rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId['trie-map'].perLookup.toFixed(2), '5.04');
  assert.strictEqual(byId.dawg.perLookup.toFixed(2), '5.04');
  assert.ok(byId['trie-map'].ok && byId.dawg.ok);
});

test('dictionary-automata: sorted input costs height 34 and 36.24 comparisons', function () {
  const rows = Lab.compareDictionaries({ keys: WORDS, families: ['ternary', 'ternary-balanced'] });
  const byId = {};
  rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId.ternary.height, 34);
  assert.strictEqual(byId['ternary-balanced'].height, 18);
  assert.strictEqual(byId.ternary.perLookup.toFixed(2), '36.24');
  assert.strictEqual(byId['ternary-balanced'].perLookup.toFixed(2), '21.32');

  assert.strictEqual(byId.ternary.nodes, byId['ternary-balanced'].nodes, 'the order does not change the count');
  assert.strictEqual(byId.ternary.nodes, 2561);
  assert.strictEqual(byId.ternary.bytesPerKey.toFixed(1), '118.9');
  assert.strictEqual(Math.round(100 * (1 - 21.32 / 36.24)), 41, '41% of the work was the order');
});

test('dictionary-automata: "cat" within one substitution visits 106 of 2 561 nodes', function () {
  const tree = TernaryTrie.create({ keys: WORDS, balanced: true });
  tree.resetStats();
  const found = tree.withinDistance('cat', 1);

  assert.strictEqual(found.join(','), 'can,car,cat,cut,eat,hat');
  assert.strictEqual(tree.stats().nodeVisits, 106);
  assert.strictEqual(tree.nodes(), 2561);
  assert.strictEqual((100 * 106 / 2561).toFixed(1), '4.1');
});
