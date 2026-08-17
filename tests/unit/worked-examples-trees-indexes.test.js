'use strict';

/**
 * Every figure the B-tree, augmented-tree, skip-list and DSU examples quote.
 *
 * The B-tree suite is the one worth reading: it recomputes both predictions —
 * the textbook log_B(n) and the honest log_{B x fill}(n) — and asserts that
 * the first is a level short on two of three geometries while the second is
 * exact. A demo that quoted only the textbook figure would be quietly wrong,
 * and this is what stops that.
 */

const test = require('node:test');
const assert = require('node:assert');

const BTree = require('../../src/js/algorithms/btree.js');
const AugmentedTree = require('../../src/js/algorithms/augmented-tree.js');
const SkipList = require('../../src/js/algorithms/skip-list.js');
const Dsu = require('../../src/js/algorithms/dsu.js');
const Avl = require('../../src/js/algorithms/avl.js');
const Random = require('../../src/js/utils/random.js');
const TreeLab = require('../../src/js/machines/tree-lab.js');
const registries = require('../../src/js/content/registries.js');

require('../../src/js/content/examples-trees-indexes.js');
require('../../src/js/content/examples-trees-sets.js');

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

/* -------------------------------------------------------------- B+ trees */

const GEOMETRIES = [
  { page: 512, order: 32, height: 5, reads: 5, nominal: 4, fill: 0.516 },
  { page: 4096, order: 256, height: 3, reads: 3, nominal: 3, fill: 0.502 },
  { page: 16384, order: 1024, height: 3, reads: 3, nominal: 2, fill: 0.500 }
];

function sequentialTree(page, keyBytes, count) {
  const tree = BTree.create({ pageBytes: page, keyBytes: keyBytes || 8, pointerBytes: 8 });
  for (let key = 0; key < count; key += 1) tree.insert(key, key);
  return tree;
}

GEOMETRIES.forEach(function (row) {
  test('b-trees: a ' + row.page + '-byte page holds ' + row.order + ' children and reads ' + row.reads + ' pages', function () {
    const tree = sequentialTree(row.page, 8, 1000000);
    tree.resetStats();
    tree.get(500000);

    assert.strictEqual(tree.order(), row.order, 'order');
    assert.strictEqual(tree.height(), row.height, 'height');
    assert.strictEqual(tree.stats().pageReads, row.reads, 'measured page reads');
    assert.strictEqual(tree.predictedReads(), row.nominal, 'the textbook log_B(n)');
    assert.strictEqual(tree.predictedReadsAtFill(), row.reads,
      'the fill-aware prediction must match the measurement exactly');
    assert.strictEqual(Number(tree.occupancy().fill.toFixed(3)), row.fill, 'fill');
  });
});

test('b-trees: the textbook prediction is short by a level on two of the three geometries', function () {
  const short = GEOMETRIES.filter(function (row) { return row.nominal !== row.reads; });
  assert.strictEqual(short.length, 2, 'two of three under-predict');
  short.forEach(function (row) {
    assert.strictEqual(row.reads - row.nominal, 1, 'and each is short by exactly one level');
  });

  quotes('b-trees', 0, ['256', '32', '1 024', '2.49', '51.6%', '50.0%']);
});

test('b-trees: a random load fills pages to ln 2 and a sequential one to a half', function () {
  const sequential = sequentialTree(1024, 8, 100000);
  const random = BTree.create({ pageBytes: 1024, keyBytes: 8, pointerBytes: 8 });
  TreeLab.shuffle(Array.from({ length: 100000 }, function (_, i) { return i; }), Random.seeded(1))
    .forEach(function (key) { random.insert(key, key); });

  assert.strictEqual(Number((sequential.occupancy().fill * 100).toFixed(1)), 50.8);
  assert.strictEqual(Number((random.occupancy().fill * 100).toFixed(1)), 68.6);
  assert.strictEqual(Number((Math.log(2) * 100).toFixed(1)), 69.3, 'the theoretical figure');

  assert.strictEqual(sequential.occupancy().nodes, 3222);
  assert.strictEqual(random.occupancy().nodes, 2367);
  assert.strictEqual(sequential.height(), 4, 'the sequential load is a level deeper');
  assert.strictEqual(random.height(), 3, 'for the same keys');

  quotes('b-trees', 1, ['50.8%', '68.6%', '69.3%', '3 222', '2 367', 'height 4', 'height 3']);
});

test('b-trees: a range scan pays the descent once and then one page per leaf', function () {
  const tree = sequentialTree(4096, 8, 1000000);
  const measured = [10, 100, 1000, 10000].map(function (length) {
    tree.resetStats();
    const scanned = tree.range(400000, 400000 + length - 1);
    assert.strictEqual(scanned.length, length, 'the scan returns every key');
    return tree.stats().pageReads;
  });

  assert.deepStrictEqual(measured, [3, 3, 10, 81]);
  assert.strictEqual(10000 * 3, 30000, 'ten thousand separate lookups');

  quotes('b-trees', 1, ['81', '30 000', '370']);
});

/* -------------------------------------------------------- augmented trees */

test('augmented-trees: select(50 000) visits 13 nodes on a 100 000-key tree', function () {
  const tree = AugmentedTree.create({ fields: ['size'] });
  for (let key = 1; key <= 100000; key += 1) tree.insert(key, key);

  tree.resetStats();
  const answer = tree.select(50000);

  assert.strictEqual(answer, 50000);
  assert.strictEqual(tree.stats().nodeVisits, 13);
  assert.strictEqual(tree.height(), 17);

  quotes('augmented-trees', 0, ['13', '17', '50 000']);
});

test('augmented-trees: stabbing 18 211 intervals visits 22 nodes and prunes 6 subtrees', function () {
  const tree = AugmentedTree.create({ fields: ['size', 'maxEnd'] });
  const rng = Random.seeded(4);
  const intervals = new Map();

  for (let i = 0; i < 20000; i += 1) {
    const start = rng.int(100000);
    const end = start + rng.int(50);
    tree.insert(start, start, end);
    intervals.set(start, end);
  }

  assert.strictEqual(intervals.size, 18211, 'distinct start keys');

  tree.resetStats();
  const hits = tree.stab(50000);
  const brute = Array.from(intervals.entries()).filter(function (entry) {
    return entry[0] <= 50000 && 50000 <= entry[1];
  });

  assert.strictEqual(hits.length, brute.length, 'the tree agrees with the scan');
  assert.strictEqual(hits.length, 7);
  assert.strictEqual(tree.stats().nodeVisits, 22);
  assert.strictEqual(tree.stats().prunedSubtrees, 6);

  quotes('augmented-trees', 0, ['18 211', '22', '6', '7']);
});

test('augmented-trees: a pruning range sum visits 51 nodes where a walk visits 1 020', function () {
  const tree = AugmentedTree.create({ fields: ['size', 'sum'] });
  for (let key = 1; key <= 100000; key += 1) tree.insert(key, key);

  tree.resetStats();
  const total = tree.rangeSum(1000, 2000);

  assert.strictEqual(total, (1000 + 2000) * 1001 / 2);
  assert.strictEqual(total, 1501500);
  assert.strictEqual(tree.stats().nodeVisits, 51);
  assert.strictEqual(tree.stats().prunedSubtrees, 7);

  /* What the same query costs when the field is stored but not used. */
  let walked = 0;
  (function walk(node) {
    if (!node) return;
    walked += 1;
    if (node.key >= 1000) walk(node.left);
    if (node.key <= 2000) walk(node.right);
  }(tree.root()));
  assert.strictEqual(walked, 1020, 'the naive version visits every node in range');

  quotes('augmented-trees', 0, ['1 501 500', '51', '1 020']);
});

/* ------------------------------------------------------------ skip lists */

const PS = [
  { p: 0.5, levels: 17, cost: 30.89, tower: 1.999, pointers: 199877 },
  { p: 0.368, levels: 15, cost: 32.99, tower: 1.582, pointers: 158181 },
  { p: 0.25, levels: 8, cost: 32.13, tower: 1.333, pointers: 133297 }
];

PS.forEach(function (row) {
  test('skip-lists: p = ' + row.p + ' measures ' + row.cost + ' comparisons and ' + row.tower + ' pointers per node', function () {
    const list = SkipList.create({ p: row.p, seed: 5, maxLevel: 24 });
    for (let key = 0; key < 100000; key += 1) list.insert(key, key);

    list.resetStats();
    for (let i = 0; i < 1000; i += 1) list.has((i * 97) % 100000);

    const towers = list.towers();
    const pointers = towers.reduce(function (sum, tower) { return sum + tower.height; }, 0);

    assert.strictEqual(list.height(), row.levels, 'levels');
    assert.strictEqual(Number((list.stats().comparisons / 1000).toFixed(2)), row.cost, 'comparisons per search');
    assert.strictEqual(Number((pointers / towers.length).toFixed(3)), row.tower, 'pointers per node');
    assert.strictEqual(pointers, row.pointers, 'total pointers');
    assert.strictEqual(Number(list.expectedTowerHeight().toFixed(3)), Number((1 / (1 - row.p)).toFixed(3)));
  });
});

test('skip-lists: halving p changes the memory by a third and the search by four percent', function () {
  const half = PS[0];
  const quarter = PS[2];

  assert.strictEqual(Number(((quarter.cost / half.cost - 1) * 100).toFixed(1)), 4.0, 'search cost');
  assert.strictEqual(Number(((1 - quarter.pointers / half.pointers) * 100).toFixed(1)), 33.3, 'memory');

  quotes('skip-lists', 0, ['30.89', '32.13', '1.999', '1.333', '199 877', '133 297']);
});

test('skip-lists: an AVL tree over the same keys costs 15.68 comparisons per search', function () {
  const tree = Avl.create({});
  for (let key = 0; key < 100000; key += 1) tree.insert(key, key);

  tree.resetStats();
  for (let i = 0; i < 1000; i += 1) tree.has((i * 97) % 100000);

  assert.strictEqual(Number((tree.stats().comparisons / 1000).toFixed(2)), 15.68);
  assert.strictEqual(tree.height(), 17);

  quotes('skip-lists', 1, ['15.68', '30.89']);
});

/* ------------------------------------------------------------------- DSU */

const STRATEGIES = [
  { name: 'none', depth: 8, hops: 1.993, writes: 0 },
  { name: 'compression', depth: 3, hops: 1.017, writes: 17751 },
  { name: 'splitting', depth: 3, hops: 1.042, writes: 20250 },
  { name: 'halving', depth: 4, hops: 0.859, writes: 23280 }
];

STRATEGIES.forEach(function (row) {
  test('disjoint-sets: ' + row.name + ' measures depth ' + row.depth + ' and ' + row.hops + ' hops per find', function () {
    const dsu = Dsu.create({ size: 100000, compress: row.name });
    const rng = Random.seeded(3);
    for (let i = 0; i < 100000; i += 1) dsu.union(rng.int(100000), rng.int(100000));

    dsu.resetStats();
    for (let i = 0; i < 100000; i += 1) dsu.find(rng.int(100000));

    assert.strictEqual(dsu.maxDepth(), row.depth, 'deepest node');
    assert.strictEqual(Number((dsu.stats().nodeVisits / 100000).toFixed(3)), row.hops, 'hops per find');
    assert.strictEqual(dsu.stats().pointerWrites, row.writes, 'pointer writes');
    assert.strictEqual(dsu.checkInvariants().ok, true);
  });
});

test('disjoint-sets: the examples quote the measured figures and the honest α', function () {
  assert.strictEqual(Dsu.inverseAckermann(65536), 4);
  assert.strictEqual(Dsu.inverseAckermann(Math.pow(2, 65536)), 5,
    'and 5 only past 2^16, which no input reaches');

  quotes('disjoint-sets', 0, ['8', '1.993', '3', '1.017', '17 751', '20 250', '23 280', '2^65536']);
  quotes('disjoint-sets', 1, ['17 751', '1.993', '1.017']);
});
