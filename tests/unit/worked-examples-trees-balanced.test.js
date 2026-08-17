'use strict';

/**
 * Every figure the AVL and red-black worked examples quote, recomputed.
 *
 * The mixed workloads are generated here exactly as they were when the
 * examples were written — same seed, same draw order — so a change to the
 * generator fails this suite rather than silently invalidating the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Avl = require('../../src/js/algorithms/avl.js');
const RedBlack = require('../../src/js/algorithms/red-black.js');
const Random = require('../../src/js/utils/random.js');
const TreeLab = require('../../src/js/machines/tree-lab.js');
const registries = require('../../src/js/content/registries.js');

require('../../src/js/content/examples-trees-balanced.js');

function textOf(example) {
  return [example.goal, example.setup, example.answer]
    .concat(example.steps.map(function (step) { return step.do + ' ' + step.why + ' ' + step.work + ' ' + step.result; }))
    .join(' ');
}

function quotes(sectionId, index, figures) {
  const text = textOf(registries.ExampleRegistry.get(sectionId)[index]);
  figures.forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, sectionId + ' example ' + index + ' must quote ' + figure);
  });
}

function sortedKeys(n) {
  return Array.from({ length: n }, function (_, i) { return i + 1; });
}

function buildAvl(order, n, seed) {
  const tree = Avl.create({});
  const keys = order === 'sorted' ? sortedKeys(n) : TreeLab.shuffle(sortedKeys(n), Random.seeded(seed));
  keys.forEach(function (key) { tree.insert(key, key); });
  return { tree: tree, keys: keys };
}

/** The mixed stream the examples were measured on. */
function mixedOperations(insertShare, deleteShare) {
  const rng = Random.seeded(5);
  const operations = [];
  for (let i = 0; i < 20000; i += 1) {
    const key = rng.int(6000);
    const roll = rng.next();
    const op = roll < insertShare ? 'insert' : (roll < insertShare + deleteShare ? 'remove' : 'find');
    operations.push({ op: op, key: key });
  }
  return operations;
}

function run(tree, operations) {
  operations.forEach(function (step) {
    if (step.op === 'insert') tree.insert(step.key, step.key);
    else if (step.op === 'remove') tree.remove(step.key);
    else tree.has(step.key);
  });
  return tree;
}

/* ------------------------------------------------------------------ AVL */

test('avl-trees: the sparsest-tree recurrence gives 1, 2, 4, 7, 12, 20, 33, 54, 88, 143', function () {
  const minimal = [0, 1, 2];
  for (let h = 3; h <= 10; h += 1) minimal[h] = minimal[h - 1] + minimal[h - 2] + 1;

  assert.deepStrictEqual(minimal.slice(1), [1, 2, 4, 7, 12, 20, 33, 54, 88, 143]);
  assert.strictEqual(Number((1 / Math.log2((1 + Math.sqrt(5)) / 2)).toFixed(4)), 1.4404);
  assert.strictEqual(Math.pow(2, 10) - 1, 1023, 'a perfect tree of height 10');

  quotes('avl-trees', 0, ['1  2  4  7  12  20  33  54  88  143', '1.4404', '143', '1 023']);
});

test('avl-trees: the bound is 18.81 at n = 10 000 and both builds land inside it', function () {
  const sorted = buildAvl('sorted', 10000, 1);
  const shuffled = buildAvl('random', 10000, 1);

  assert.strictEqual(Number(sorted.tree.heightBound().toFixed(2)), 18.81);
  assert.strictEqual(Math.ceil(Math.log2(10001)), 14, 'the perfectly balanced height');
  assert.strictEqual(sorted.tree.height(), 14);
  assert.strictEqual(shuffled.tree.height(), 16);

  quotes('avl-trees', 0, ['18.81', '14', '16']);
});

test('avl-trees: sorted insertion rotates 9 986 times and never needs a double', function () {
  const sorted = buildAvl('sorted', 10000, 1).tree.stats();
  const shuffled = buildAvl('random', 10000, 1).tree.stats();

  assert.strictEqual(sorted.singleRotations, 9986);
  assert.strictEqual(sorted.doubleRotations, 0);
  assert.strictEqual(Number((sorted.rebalances / 10000).toFixed(3)), 0.999);

  assert.strictEqual(shuffled.singleRotations, 2331);
  assert.strictEqual(shuffled.doubleRotations, 2320);
  assert.strictEqual(Number((shuffled.rebalances / 10000).toFixed(3)), 0.465);

  quotes('avl-trees', 0, ['9 986', '0.999', '2 331', '2 320', '0.465']);
});

test('avl-trees: an insertion never rebalances twice, and a deletion can rebalance six times', function () {
  const tree = Avl.create({});
  let worstInsert = 0;
  TreeLab.shuffle(sortedKeys(20000), Random.seeded(3)).forEach(function (key) {
    const before = tree.stats().rebalances;
    tree.insert(key, key);
    worstInsert = Math.max(worstInsert, tree.stats().rebalances - before);
  });
  assert.strictEqual(worstInsert, 1, 'the theorem, in the counter');

  const built = buildAvl('random', 10000, 1);
  built.tree.resetStats();
  const order = TreeLab.shuffle(built.keys, Random.seeded(992));
  let worstDelete = 0;
  for (let i = 0; i < 5000; i += 1) {
    const before = built.tree.stats().rotations;
    built.tree.remove(order[i]);
    worstDelete = Math.max(worstDelete, built.tree.stats().rotations - before);
  }

  assert.strictEqual(built.tree.stats().rotations, 1919);
  assert.strictEqual(Number((1919 / 5000).toFixed(3)), 0.384);
  assert.strictEqual(worstDelete, 6);

  quotes('avl-trees', 1, ['1', '1 919', '0.384', '6']);
});

/* ------------------------------------------ the shared three-mix comparison */

const MIXES = [
  { name: 'insert-heavy', insert: 0.9, remove: 0.05, avl: { comparisons: 225915, rotations: 4338, height: 15 }, rb: { comparisons: 227170, rotations: 3606, height: 15 } },
  { name: 'balanced', insert: 0.45, remove: 0.3, avl: { comparisons: 214913, rotations: 4434, height: 14 }, rb: { comparisons: 216761, rotations: 3613, height: 15 } },
  { name: 'delete-heavy', insert: 0.3, remove: 0.55, avl: { comparisons: 205837, rotations: 4056, height: 13 }, rb: { comparisons: 205504, rotations: 3242, height: 14 } }
];

MIXES.forEach(function (mix) {
  test('trees: the ' + mix.name + ' mix measures exactly what both examples quote', function () {
    const operations = mixedOperations(mix.insert, mix.remove);
    const avl = run(Avl.create({}), operations);
    const rb = run(RedBlack.create({}), operations);

    assert.strictEqual(avl.stats().comparisons, mix.avl.comparisons, 'avl comparisons');
    assert.strictEqual(avl.stats().rotations, mix.avl.rotations, 'avl rotations');
    assert.strictEqual(avl.height(), mix.avl.height, 'avl height');

    assert.strictEqual(rb.stats().comparisons, mix.rb.comparisons, 'red-black comparisons');
    assert.strictEqual(rb.stats().rotations, mix.rb.rotations, 'red-black rotations');
    assert.strictEqual(rb.height(), mix.rb.height, 'red-black height');

    assert.strictEqual(avl.size(), rb.size(), 'both families hold the same keys');
    assert.strictEqual(avl.keys().join(','), rb.keys().join(','), 'and answer identically');

    [String(mix.avl.comparisons).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
      String(mix.rb.rotations).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')].forEach(function (figure) {
      const avlText = textOf(registries.ExampleRegistry.get('avl-trees')[1]);
      const rbText = textOf(registries.ExampleRegistry.get('red-black-trees')[1]);
      assert.ok(avlText.indexOf(figure) !== -1 || rbText.indexOf(figure) !== -1,
        'one of the two examples must quote ' + figure);
    });
  });
});

test('trees: the differences the examples draw conclusions from are the measured ones', function () {
  const insertHeavy = mixedOperations(0.9, 0.05);
  const avlA = run(Avl.create({}), insertHeavy).stats();
  const rbA = run(RedBlack.create({}), insertHeavy).stats();

  assert.strictEqual(rbA.comparisons - avlA.comparisons, 1255, 'AVL saves 1 255 comparisons');
  assert.strictEqual(avlA.rotations - rbA.rotations, 732, 'and spends 732 extra rotations');

  const deleteHeavy = mixedOperations(0.3, 0.55);
  const avlB = run(Avl.create({}), deleteHeavy).stats();
  const rbB = run(RedBlack.create({}), deleteHeavy).stats();

  assert.strictEqual(avlB.comparisons - rbB.comparisons, 333, 'AVL costs 333 more comparisons');
  assert.strictEqual(avlB.rotations - rbB.rotations, 814, 'and 814 more rotations');

  quotes('avl-trees', 1, ['1 255', '732', '333', '814']);
});

/* ------------------------------------------------------------ red-black */

test('red-black-trees: the bound is 26.58 at n = 10 000 and height is twice the black height', function () {
  const tree = RedBlack.create({});
  TreeLab.shuffle(sortedKeys(10000), Random.seeded(2)).forEach(function (key) { tree.insert(key, key); });

  assert.strictEqual(Number(tree.heightBound().toFixed(2)), 26.58);
  assert.strictEqual(tree.height(), 16);
  assert.strictEqual(tree.blackHeight(), 8);
  assert.strictEqual(tree.height(), 2 * tree.blackHeight(), 'the factor of two, exactly');

  quotes('red-black-trees', 0, ['26.58', '16', '8']);
});

test('red-black-trees: the 2-3-4 census is 1 646 / 2 200 / 1 318', function () {
  const tree = RedBlack.create({});
  TreeLab.shuffle(sortedKeys(10000), Random.seeded(2)).forEach(function (key) { tree.insert(key, key); });

  const nodes = tree.nodes234();
  const counts = { 2: 0, 3: 0, 4: 0 };
  nodes.forEach(function (node) { counts[node.degree] += 1; });

  assert.strictEqual(nodes.length, 5164);
  assert.strictEqual(counts[2], 1646);
  assert.strictEqual(counts[3], 2200);
  assert.strictEqual(counts[4], 1318);
  assert.strictEqual(Number((counts[2] / nodes.length * 100).toFixed(1)), 31.9);
  assert.strictEqual(Number((counts[3] / nodes.length * 100).toFixed(1)), 42.6);
  assert.strictEqual(Number((counts[4] / nodes.length * 100).toFixed(1)), 25.5);

  quotes('red-black-trees', 0, ['5 164', '1 646', '2 200', '1 318', '31.9', '42.6', '25.5']);
});

test('red-black-trees: building it costs 5 763 rotations and 33 239 recolourings', function () {
  const tree = RedBlack.create({});
  TreeLab.shuffle(sortedKeys(10000), Random.seeded(2)).forEach(function (key) { tree.insert(key, key); });
  const stats = tree.stats();

  assert.strictEqual(stats.rotations, 5763);
  assert.strictEqual(stats.recolours, 33239);
  assert.strictEqual(Number((stats.rotations / 10000).toFixed(3)), 0.576);
  assert.ok(stats.recolours / stats.rotations > 5.5 && stats.recolours / stats.rotations < 6.5,
    'about six recolourings per rotation');

  quotes('red-black-trees', 0, ['5 763', '33 239', '0.576', 'six']);
});
