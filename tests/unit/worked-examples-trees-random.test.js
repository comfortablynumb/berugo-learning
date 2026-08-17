'use strict';

/**
 * Every figure the treap, splay and scapegoat worked examples quote.
 *
 * The treap suite is the interesting one: it recomputes both the correct
 * behaviour and the bug the second example is about, by handing the structure
 * a `priorityOf` that draws from a sequence — the mistake the platform
 * actually shipped. That keeps the example honest about a claim that no
 * invariant check can make.
 */

const test = require('node:test');
const assert = require('node:assert');

const Treap = require('../../src/js/algorithms/treap.js');
const Splay = require('../../src/js/algorithms/splay.js');
const Scapegoat = require('../../src/js/algorithms/scapegoat.js');
const Avl = require('../../src/js/algorithms/avl.js');
const Bst = require('../../src/js/algorithms/bst.js');
const Random = require('../../src/js/utils/random.js');
const TreeLab = require('../../src/js/machines/tree-lab.js');
const registries = require('../../src/js/content/registries.js');

require('../../src/js/content/examples-trees-random.js');

function textOf(example) {
  return [example.goal, example.setup, example.answer]
    .concat(example.steps.map(function (step) { return step.do + ' ' + step.why + ' ' + step.work + ' ' + step.result; }))
    .join(' ');
}

function quotes(sectionId, index, figures) {
  const text = textOf(registries.ExampleRegistry.get(sectionId)[index]);
  figures.forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, sectionId + ' example ' + (index + 1) + ' must quote ' + figure);
  });
}

function keysFor(order, n, seed) {
  const sorted = Array.from({ length: n }, function (_, i) { return i + 1; });
  if (order === 'sorted') return sorted;
  if (order === 'reverse') return sorted.slice().reverse();
  return TreeLab.shuffle(sorted, Random.seeded(seed + 500));
}

function buildTreap(order, n, seed) {
  const tree = Treap.create({ seed: seed });
  keysFor(order, n, seed).forEach(function (key) { tree.insert(key, key); });
  return tree;
}

/* -------------------------------------------------------------- treaps */

test('treaps: three insertion orders produce the identical tree', function () {
  const shapes = ['sorted', 'random', 'reverse'].map(function (order) {
    const tree = buildTreap(order, 1000, 1);
    return { order: order, height: tree.height(), root: tree.root().key, cost: tree.stats().comparisons };
  });

  shapes.forEach(function (shape) {
    assert.strictEqual(shape.height, 23, shape.order + ' height');
    assert.strictEqual(shape.root, 623, shape.order + ' root');
  });

  assert.strictEqual(shapes[0].cost, 14464, 'sorted build cost');
  assert.strictEqual(shapes[1].cost, 24230, 'shuffled build cost');
  assert.strictEqual(shapes[2].cost, 12840, 'reversed build cost');

  quotes('treaps', 0, ['23', '623', '14 464', '24 230', '12 840']);
});

test('treaps: the seed moves the shape and the order does not', function () {
  const first = buildTreap('sorted', 1000, 1);
  const second = buildTreap('sorted', 1000, 2);

  assert.strictEqual(first.height(), 23);
  assert.strictEqual(first.root().key, 623);
  assert.strictEqual(second.height(), 21);
  assert.strictEqual(second.root().key, 523);

  quotes('treaps', 0, ['21', '523']);
});

test('treaps: the height distribution is the random-BST height distribution', function () {
  let treapTotal = 0;
  let worst = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const tree = buildTreap('sorted', 1000, seed);
    treapTotal += tree.height();
    worst = Math.max(worst, tree.height());
  }

  let bstTotal = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const tree = Bst.create({});
    TreeLab.shuffle(keysFor('sorted', 1000, seed), Random.seeded(seed)).forEach(function (key) {
      tree.insert(key, key);
    });
    bstTotal += tree.height();
  }

  assert.strictEqual(Number((treapTotal / 40).toFixed(1)), 22.4);
  assert.strictEqual(worst, 26);
  assert.strictEqual(Number((bstTotal / 40).toFixed(1)), 22.3);
  assert.strictEqual(Number((3 * Math.log2(1000)).toFixed(1)), 29.9);

  const plain = Bst.create({});
  keysFor('sorted', 1000, 1).forEach(function (key) { plain.insert(key, key); });
  assert.strictEqual(plain.height(), 1000, 'the plain BST on the same sorted input');

  quotes('treaps', 0, ['22.4', '26', '22.3', '29.9', '1 000']);
});

test('treaps: drawing priorities from a sequence really does break the guarantee', function () {
  function sequenceBuilt(order) {
    const rng = Random.seeded(1);
    const tree = Treap.create({ priorityOf: function () { return rng.next(); } });
    keysFor(order, 1000, 1).forEach(function (key) { tree.insert(key, key); });
    return tree;
  }

  const sorted = sequenceBuilt('sorted');
  const reversed = sequenceBuilt('reverse');

  assert.strictEqual(sorted.height(), 21);
  assert.strictEqual(sorted.root().key, 987);
  assert.strictEqual(reversed.height(), 21);
  assert.strictEqual(reversed.root().key, 14);
  assert.notStrictEqual(sorted.root().key, reversed.root().key, 'two different trees');

  assert.strictEqual(sorted.checkInvariants().ok, true, 'and both are still valid treaps');
  assert.strictEqual(reversed.checkInvariants().ok, true,
    'which is why no invariant check could have found this');

  quotes('treaps', 1, ['987', '14']);
});

/* --------------------------------------------------------- splay trees */

const SKEWS = [
  { skew: 0.6, splay: 13.01, avl: 10.32, ratio: 1.26 },
  { skew: 0.8, splay: 11.86, avl: 10.47, ratio: 1.13 },
  { skew: 1.0, splay: 10.02, avl: 10.69, ratio: 0.94 },
  { skew: 1.2, splay: 7.80, avl: 10.94, ratio: 0.71 },
  { skew: 1.6, splay: 4.40, avl: 11.37, ratio: 0.39 },
  { skew: 2.0, splay: 2.77, avl: 11.60, ratio: 0.24 }
];

function skewRun(skew) {
  const operations = TreeLab.operations({
    kind: 'zipf', count: 20000, span: 2000, skew: skew, rng: Random.seeded(9)
  });
  const from = TreeLab.firstAccess(operations);
  const rows = TreeLab.compare({
    builders: [
      { create: function () { return Splay.create({}); } },
      { create: function () { return Avl.create({}); } }
    ],
    operations: operations,
    measureFrom: from
  });
  const accesses = operations.length - from;
  return {
    splay: rows[0].stats.comparisons / accesses,
    avl: rows[1].stats.comparisons / accesses,
    stats: rows[0].stats,
    accesses: accesses
  };
}

SKEWS.forEach(function (row) {
  test('splay-trees: at Zipf skew ' + row.skew + ' the measured cost is ' + row.splay + ' against ' + row.avl, function () {
    const measured = skewRun(row.skew);

    assert.strictEqual(Number(measured.splay.toFixed(2)), row.splay, 'splay per access');
    assert.strictEqual(Number(measured.avl.toFixed(2)), row.avl, 'avl per access');
    assert.strictEqual(Number((measured.splay / measured.avl).toFixed(2)), row.ratio, 'ratio');

    quotes('splay-trees', 0, [String(row.splay), String(row.avl)]);
  });
});

test('splay-trees: the crossover really is between skew 0.8 and 1.0', function () {
  const below = skewRun(0.8);
  const above = skewRun(1.0);

  assert.ok(below.splay > below.avl, 'at 0.8 the balanced tree is still ahead');
  assert.ok(above.splay < above.avl, 'at 1.0 splaying is ahead');
  quotes('splay-trees', 0, ['0.8', '1.0']);
});

test('splay-trees: the rotation bill at the skew where splaying wins', function () {
  const measured = skewRun(1.2);

  assert.strictEqual(measured.stats.zig, 9748);
  assert.strictEqual(measured.stats.zigzig, 32597);
  assert.strictEqual(measured.stats.zigzag, 30496);

  const steps = (measured.stats.zig + measured.stats.zigzig + measured.stats.zigzag) / measured.accesses;
  const rotations = measured.stats.rotations / measured.accesses;
  assert.strictEqual(Number(steps.toFixed(2)), 3.64, 'splay steps per read');
  assert.strictEqual(Number(rotations.toFixed(2)), 6.80, 'rotations per read — a zig-zig is two');
  assert.strictEqual(Number((1 - measured.splay / measured.avl).toFixed(2)), 0.29, '29% cheaper');

  quotes('splay-trees', 1, ['9 748', '32 597', '30 496', '3.64', '6.80', '29%']);
});

/* ---------------------------------------------------- scapegoat trees */

const ALPHAS = [
  { alpha: 0.55, limit: 16, height: 16, perInsert: 40.27 },
  { alpha: 0.6, limit: 19, height: 19, perInsert: 24.53 },
  { alpha: 0.65, limit: 22, height: 22, perInsert: 18.69 },
  { alpha: 0.7, limit: 26, height: 26, perInsert: 14.48 },
  { alpha: 0.8, limit: 42, height: 42, perInsert: 9.99 },
  { alpha: 0.9, limit: 88, height: 87, perInsert: 7.53 }
];

test('scapegoat-trees: the α sweep measures exactly what the example quotes', function () {
  ALPHAS.forEach(function (row) {
    const tree = Scapegoat.create({ alpha: row.alpha });
    for (let key = 1; key <= 10000; key += 1) tree.insert(key, key);

    assert.strictEqual(tree.heightBound(), row.limit, 'α ' + row.alpha + ' depth limit');
    assert.strictEqual(tree.height(), row.height, 'α ' + row.alpha + ' height');
    assert.strictEqual(Number((tree.stats().rebuiltNodes / 10000).toFixed(2)), row.perInsert,
      'α ' + row.alpha + ' nodes rebuilt per insert');
  });

  quotes('scapegoat-trees', 0, ['16', '22', '88', '40.27', '18.69', '9.99', '7.53']);
});

test('scapegoat-trees: the amortised cost is a small multiple of log n', function () {
  const tree = Scapegoat.create({ alpha: 0.65 });
  for (let key = 1; key <= 10000; key += 1) tree.insert(key, key);

  const perInsert = tree.stats().rebuiltNodes / 10000;
  assert.strictEqual(Number((Math.log2(10000)).toFixed(2)), 13.29);
  assert.strictEqual(Number((perInsert / Math.log2(10000)).toFixed(2)), 1.41);

  quotes('scapegoat-trees', 0, ['13.29', '1.41']);
});

test('scapegoat-trees: shuffled input is ninety times cheaper for the same height', function () {
  const sorted = Scapegoat.create({ alpha: 0.65 });
  for (let key = 1; key <= 10000; key += 1) sorted.insert(key, key);

  const shuffled = Scapegoat.create({ alpha: 0.65 });
  TreeLab.shuffle(Array.from({ length: 10000 }, function (_, i) { return i + 1; }), Random.seeded(1))
    .forEach(function (key) { shuffled.insert(key, key); });

  assert.strictEqual(sorted.stats().rebuilds, 8584);
  assert.strictEqual(shuffled.stats().rebuilds, 439);
  assert.strictEqual(Number((shuffled.stats().rebuiltNodes / 10000).toFixed(2)), 0.21);
  assert.strictEqual(sorted.height(), 22);
  assert.strictEqual(shuffled.height(), 22, 'the cheaper build is not the worse tree');

  const avlSorted = Avl.create({});
  for (let key = 1; key <= 10000; key += 1) avlSorted.insert(key, key);
  const avlShuffled = Avl.create({});
  TreeLab.shuffle(Array.from({ length: 10000 }, function (_, i) { return i + 1; }), Random.seeded(1))
    .forEach(function (key) { avlShuffled.insert(key, key); });

  assert.strictEqual(avlSorted.stats().rotations, 9986);
  assert.strictEqual(avlShuffled.stats().rebalances, 4651, 'rebalances, not rotations');
  assert.strictEqual(avlShuffled.stats().rotations, 6971, 'each double rebalance is two rotations');

  quotes('scapegoat-trees', 1, ['8 584', '439', '0.21', '22', '9 986', '4 651', '6 971']);
});

test('scapegoat-trees: deleting half the keys triggers exactly one whole-tree rebuild', function () {
  const tree = Scapegoat.create({ alpha: 0.65 });
  for (let key = 1; key <= 10000; key += 1) tree.insert(key, key);
  tree.resetStats();

  TreeLab.shuffle(Array.from({ length: 10000 }, function (_, i) { return i + 1; }), Random.seeded(77))
    .slice(0, 5000)
    .forEach(function (key) { tree.remove(key); });

  assert.strictEqual(tree.stats().fullRebuilds, 1);
  assert.strictEqual(tree.stats().rebuiltNodes, 6499, 'at the moment the count crossed 6 500');
  assert.strictEqual(tree.size(), 5000);
  assert.strictEqual(tree.checkInvariants().ok, true);

  quotes('scapegoat-trees', 1, ['6 500', '6 499']);
});
