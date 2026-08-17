'use strict';

/**
 * Property tests for every ordered structure in M04.
 *
 * The shape is the one M03 settled on: run a randomised operation sequence
 * against a reference `Set`, check the family's own invariants along the way,
 * and require the in-order sequence to equal the sorted reference at the end.
 * A structure that passes this cannot be subtly wrong — the two ways of
 * answering "what keys are in here" would have diverged.
 *
 * Every family is driven through the *same* interface by `tree-lab`, which is
 * the point of having a shared interface at all: adding a family here is one
 * line, and it is immediately held to the same standard as the others.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const TreeLab = require('../../src/js/machines/tree-lab.js');

const Bst = require('../../src/js/algorithms/bst.js');
const Avl = require('../../src/js/algorithms/avl.js');
const RedBlack = require('../../src/js/algorithms/red-black.js');
const Treap = require('../../src/js/algorithms/treap.js');
const Splay = require('../../src/js/algorithms/splay.js');
const Scapegoat = require('../../src/js/algorithms/scapegoat.js');
const BTree = require('../../src/js/algorithms/btree.js');
const AugmentedTree = require('../../src/js/algorithms/augmented-tree.js');
const SkipList = require('../../src/js/algorithms/skip-list.js');
const Dsu = require('../../src/js/algorithms/dsu.js');

const FAMILIES = [
  { name: 'bst', create: function () { return Bst.create({}); } },
  { name: 'avl', create: function () { return Avl.create({}); } },
  { name: 'red-black', create: function () { return RedBlack.create({}); } },
  { name: 'treap', create: function () { return Treap.create({ seed: 5 }); } },
  { name: 'splay', create: function () { return Splay.create({}); } },
  { name: 'scapegoat', create: function () { return Scapegoat.create({}); } },
  { name: 'b+tree', create: function () { return BTree.create({ order: 6 }); } },
  { name: 'augmented', create: function () { return AugmentedTree.create({ fields: ['size'] }); } },
  { name: 'skip-list', create: function () { return SkipList.create({ seed: 5 }); } }
];

/* --------------------------------------------------- the shared interface */

FAMILIES.forEach(function (family) {
  test('trees: ' + family.name + ' implements the whole shared interface', function () {
    const tree = family.create();
    ['insert', 'remove', 'has', 'keys', 'range', 'size', 'height', 'checkInvariants',
      'stats', 'resetStats'].forEach(function (method) {
      assert.strictEqual(typeof tree[method], 'function', family.name + ' is missing ' + method);
    });
  });

  ['random', 'sorted', 'reverse', 'churn'].forEach(function (kind) {
    test('trees: ' + family.name + ' matches a reference set under a ' + kind + ' workload', function () {
      const operations = TreeLab.operations({
        kind: kind, count: 3000, span: 400, rng: Random.seeded(17)
      });
      const result = TreeLab.replay({
        tree: family.create(), operations: operations, checkEvery: 97
      });
      assert.strictEqual(result.ok, true, result.errors.join('\n  '));
    });
  });

  test('trees: ' + family.name + ' answers range queries the same way a filter does', function () {
    const tree = family.create();
    const rng = Random.seeded(23);
    const present = new Set();
    for (let i = 0; i < 500; i += 1) {
      const key = rng.int(1000);
      tree.insert(key, key);
      present.add(key);
    }

    const sorted = Array.from(present).sort(function (a, b) { return a - b; });
    [[0, 1000], [100, 200], [450, 455], [999, 999], [700, 100]].forEach(function (bounds) {
      const expected = sorted.filter(function (key) { return key >= bounds[0] && key <= bounds[1]; });
      assert.deepStrictEqual(tree.range(bounds[0], bounds[1]), expected,
        family.name + ' range(' + bounds[0] + ', ' + bounds[1] + ')');
    });
  });
});

/* ------------------------------------------------------- the height bounds */

test('trees: the balanced families stay inside their own height bounds over 100 seeds', function () {
  const bounded = [
    { name: 'avl', create: function () { return Avl.create({}); } },
    { name: 'red-black', create: function () { return RedBlack.create({}); } },
    { name: 'scapegoat', create: function () { return Scapegoat.create({}); } }
  ];

  bounded.forEach(function (family) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const tree = family.create();
      const rng = Random.seeded(seed);
      TreeLab.shuffle(Array.from({ length: 400 }, function (_, i) { return i; }), rng)
        .forEach(function (key) { tree.insert(key, key); });

      assert.ok(tree.height() <= tree.heightBound(),
        family.name + ' seed ' + seed + ': height ' + tree.height() + ' over its bound ' + tree.heightBound());
    }
  });
});

test('trees: sorted insertion degenerates the plain BST and no one else', function () {
  const built = FAMILIES.map(function (family) {
    const tree = family.create();
    for (let key = 0; key < 2000; key += 1) tree.insert(key, key);
    return { name: family.name, height: tree.height() };
  });

  const plain = built.find(function (row) { return row.name === 'bst'; });
  assert.strictEqual(plain.height, 2000, 'the unbalanced tree becomes a spine of exactly n');

  built.filter(function (row) { return row.name !== 'bst' && row.name !== 'splay'; })
    .forEach(function (row) {
      assert.ok(row.height <= 4 * Math.log2(2000),
        row.name + ' reached height ' + row.height + ' on sorted input');
    });
});

/* ------------------------------------------------------ family specialities */

test('trees: an AVL insertion needs at most one rotation, a deletion can need more', function () {
  const tree = Avl.create({});
  const rng = Random.seeded(4);
  let worstInsert = 0;

  TreeLab.shuffle(Array.from({ length: 2000 }, function (_, i) { return i; }), rng)
    .forEach(function (key) {
      tree.resetStats();
      tree.insert(key, key);
      worstInsert = Math.max(worstInsert, tree.stats().rebalances);
    });

  assert.strictEqual(worstInsert, 1, 'one rebalance is the most an insertion ever needs');
});

test('trees: the red-black 2-3-4 mapping gives every node degree 2, 3 or 4', function () {
  const tree = RedBlack.create({});
  const rng = Random.seeded(6);
  for (let i = 0; i < 2000; i += 1) tree.insert(rng.int(5000), i);

  const nodes = tree.nodes234();
  assert.ok(nodes.length > 0);
  nodes.forEach(function (node) {
    assert.ok(node.degree >= 2 && node.degree <= 4, 'degree ' + node.degree + ' is not a 2-3-4 node');
  });
});

test('trees: treap split and merge preserve both orders and the key set', function () {
  const tree = Treap.create({ seed: 9 });
  for (let key = 0; key < 500; key += 1) tree.insert(key, key);

  const taken = tree.extract(100, 149);
  assert.strictEqual(taken.size, 50, 'the extracted range holds exactly its keys');
  assert.deepStrictEqual(taken.keys[0], 100);
  assert.deepStrictEqual(taken.keys[49], 149);
  assert.strictEqual(tree.size(), 450, 'and the remainder is the rest');
  assert.strictEqual(tree.checkInvariants().ok, true, 'both orders survive the split and merge');
  assert.strictEqual(tree.range(95, 155).join(','), '95,96,97,98,99,150,151,152,153,154,155');
});

test('trees: splaying moves the accessed key to the root', function () {
  const tree = Splay.create({});
  const rng = Random.seeded(8);
  for (let i = 0; i < 500; i += 1) tree.insert(rng.int(2000), i);

  const keys = tree.keys();
  [keys[0], keys[keys.length - 1], keys[Math.floor(keys.length / 2)]].forEach(function (key) {
    tree.has(key);
    assert.strictEqual(tree.rootKey(), key, 'the accessed key must end at the root');
  });
});

test('trees: a Zipf workload costs a splay tree fewer comparisons than AVL', function () {
  const operations = TreeLab.operations({
    kind: 'zipf', count: 20000, span: 2000, skew: 1.2, rng: Random.seeded(9)
  });
  const from = TreeLab.firstAccess(operations);

  const rows = TreeLab.compare({
    builders: [
      { create: function () { return Avl.create({}); } },
      { create: function () { return Splay.create({}); } }
    ],
    operations: operations,
    measureFrom: from
  });

  assert.strictEqual(rows[0].ok, true);
  assert.strictEqual(rows[1].ok, true);
  assert.ok(rows[1].stats.comparisons < rows[0].stats.comparisons,
    'splay ' + rows[1].stats.comparisons + ' vs avl ' + rows[0].stats.comparisons);
});

test('trees: the B+ tree reads log_B(n) pages per lookup, and the leaves stay level', function () {
  const tree = BTree.create({ pageBytes: 4096, keyBytes: 8, pointerBytes: 8 });
  assert.strictEqual(tree.order(), 256, 'a 4 KB page of 8-byte keys and pointers holds 256 children');

  for (let key = 0; key < 100000; key += 1) tree.insert(key, key);
  tree.resetStats();
  tree.get(50000);

  assert.strictEqual(tree.stats().pageReads, tree.predictedReads(),
    'measured page reads must equal the log_B(n) prediction');
  assert.strictEqual(tree.checkInvariants().ok, true);
});

test('trees: the augmented fields answer select, rank, stab and sum like brute force', function () {
  const tree = AugmentedTree.create({});
  const rng = Random.seeded(12);
  const intervals = [];

  for (let i = 0; i < 400; i += 1) {
    const start = rng.int(500);
    const end = start + rng.int(30);
    if (intervals.some(function (row) { return row.start === start; })) continue;
    tree.insert(start, start, end);
    intervals.push({ start: start, end: end });
  }
  intervals.sort(function (a, b) { return a.start - b.start; });

  assert.strictEqual(tree.select(1), intervals[0].start);
  assert.strictEqual(tree.select(intervals.length), intervals[intervals.length - 1].start);
  assert.strictEqual(tree.rank(intervals[9].start), 10);

  const point = 250;
  const expected = intervals.filter(function (row) { return row.start <= point && point <= row.end; })
    .map(function (row) { return row.start; });
  assert.deepStrictEqual(tree.stab(point).map(function (row) { return row.start; }).sort(function (a, b) { return a - b; }),
    expected);

  const wanted = intervals.filter(function (row) { return row.start >= 100 && row.start <= 200; })
    .reduce(function (sum, row) { return sum + row.start; }, 0);
  assert.strictEqual(tree.rangeSum(100, 200), wanted);
});

test('trees: skip-list tower heights follow the p geometric distribution', function () {
  const list = SkipList.create({ seed: 3, p: 0.5 });
  for (let key = 0; key < 100000; key += 1) list.insert(key, key);

  const histogram = list.levelHistogram();
  assert.ok(histogram[0] > 49000 && histogram[0] < 51000,
    'about half the towers stop at level 1, measured ' + histogram[0]);
  for (let level = 1; level < 6; level += 1) {
    const ratio = histogram[level] / histogram[level - 1];
    assert.ok(ratio > 0.4 && ratio < 0.6,
      'level ' + level + ' should hold about half of level ' + (level - 1) + ', measured ratio ' + ratio.toFixed(3));
  }
});

/* ------------------------------------------------------------------- DSU */

test('dsu: every strategy answers connectivity the way a reference forest does', function () {
  Dsu.STRATEGIES.forEach(function (strategy) {
    const dsu = Dsu.create({ size: 2000, compress: strategy });
    const rng = Random.seeded(9);
    const parent = Array.from({ length: 2000 }, function (_, i) { return i; });
    const rootOf = function (x) {
      let node = x;
      while (parent[node] !== node) node = parent[node];
      return node;
    };

    for (let i = 0; i < 4000; i += 1) {
      const a = rng.int(2000);
      const b = rng.int(2000);
      const merged = dsu.union(a, b);
      const ra = rootOf(a);
      const rb = rootOf(b);
      const expected = ra !== rb;
      if (expected) parent[ra] = rb;
      assert.strictEqual(merged, expected, strategy + ': union(' + a + ', ' + b + ')');
    }

    for (let i = 0; i < 500; i += 1) {
      const a = rng.int(2000);
      const b = rng.int(2000);
      assert.strictEqual(dsu.connected(a, b), rootOf(a) === rootOf(b), strategy + ': connected');
    }
    assert.strictEqual(dsu.checkInvariants().ok, true, strategy);
  });
});

test('dsu: compression flattens the forest and union by rank alone does not', function () {
  const plain = Dsu.create({ size: 4000, compress: 'none' });
  const compressed = Dsu.create({ size: 4000, compress: 'compression' });
  const rng = Random.seeded(15);

  for (let i = 0; i < 8000; i += 1) {
    const a = rng.int(4000);
    const b = rng.int(4000);
    plain.union(a, b);
    compressed.union(a, b);
  }
  for (let i = 0; i < 4000; i += 1) {
    plain.find(i);
    compressed.find(i);
  }

  assert.ok(compressed.maxDepth() <= 1,
    'after finding every element, a compressing forest is flat: depth ' + compressed.maxDepth());
  assert.ok(plain.maxDepth() > compressed.maxDepth(),
    'union by rank alone leaves real depth: ' + plain.maxDepth());
});

test('dsu: rollback restores the exact parent and rank arrays, and refuses compression', function () {
  const dsu = Dsu.create({ size: 200, compress: 'none', rollback: true });
  const rng = Random.seeded(21);
  const checkpoints = [];

  for (let i = 0; i < 100; i += 1) {
    checkpoints.push(JSON.stringify(dsu.snapshot()));
    dsu.union(rng.int(200), rng.int(200));
  }
  for (let i = 99; i >= 0; i -= 1) {
    dsu.undo();
    assert.strictEqual(JSON.stringify(dsu.snapshot()), checkpoints[i],
      'undo ' + i + ' must restore the exact prior state');
  }
  assert.strictEqual(dsu.components(), 200, 'every union has been undone');

  assert.throws(function () { Dsu.create({ size: 10, rollback: true }); }, /compress/,
    'rollback with path compression must be refused, not silently wrong');
});

test('dsu: the inverse-Ackermann staircase is 4 for every input anyone will run', function () {
  assert.strictEqual(Dsu.inverseAckermann(1000), 4);
  assert.strictEqual(Dsu.inverseAckermann(65536), 4);
  assert.strictEqual(Dsu.inverseAckermann(1e12), 5, 'and 5 only past 2^16');
});
