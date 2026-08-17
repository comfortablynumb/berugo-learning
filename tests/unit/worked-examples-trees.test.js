'use strict';

/**
 * Every figure the M04 worked examples quote, recomputed from the modules.
 *
 * The assertions come in pairs: compute the number, then check the prose still
 * says it. That is what stops a demo from being retuned while the example
 * beside it keeps quoting the old figure — the failure mode the M01 examples
 * had before this suite existed.
 */

const test = require('node:test');
const assert = require('node:assert');

const Bst = require('../../src/js/algorithms/bst.js');
const Random = require('../../src/js/utils/random.js');
const TreeLab = require('../../src/js/machines/tree-lab.js');
const registries = require('../../src/js/content/registries.js');

require('../../src/js/content/examples-trees.js');

function examples(sectionId) {
  return registries.ExampleRegistry.get(sectionId);
}

function textOf(example) {
  return [example.goal, example.setup, example.answer]
    .concat(example.steps.map(function (step) { return step.do + ' ' + step.why + ' ' + step.work + ' ' + step.result; }))
    .join(' ');
}

/** The section's own key generator, so the test measures what the demo shows. */
function keysFor(order, count, seed) {
  const sorted = Array.from({ length: count }, function (_, i) { return i + 1; });
  if (order === 'sorted') return sorted;
  if (order === 'reverse') return sorted.slice().reverse();
  return TreeLab.shuffle(sorted, Random.seeded(seed));
}

function build(order, count, seed) {
  const tree = Bst.create({});
  keysFor(order, count, seed).forEach(function (key) { tree.insert(key, key); });
  return tree;
}

function depths(tree) {
  const stack = tree.root() ? [{ node: tree.root(), depth: 1 }] : [];
  let total = 0;
  let nodes = 0;
  while (stack.length) {
    const frame = stack.pop();
    total += frame.depth;
    nodes += 1;
    if (frame.node.left) stack.push({ node: frame.node.left, depth: frame.depth + 1 });
    if (frame.node.right) stack.push({ node: frame.node.right, depth: frame.depth + 1 });
  }
  return { total: total, mean: total / nodes, nodes: nodes };
}

/* ------------------------------------------------- 4.1, first worked example */

test('bst-rotations: sorted insertion costs exactly n(n − 1)/2 comparisons', function () {
  const tree = build('sorted', 1000, 1);

  assert.strictEqual(tree.stats().comparisons, 499500, '1000 × 999 / 2');
  assert.strictEqual(tree.height(), 1000, 'the tree is a spine');
  assert.strictEqual(depths(tree).mean, 500.5, '(n + 1)/2');
  assert.strictEqual(Math.ceil(Math.log2(1001)), 10, 'the ideal height');

  const text = textOf(examples('bst-rotations')[0]);
  ['499 500', '1000', '500.5', '10'].forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, 'the example must quote ' + figure);
  });
});

test('bst-rotations: the shuffled build measures 11 454 comparisons at seed 1', function () {
  const tree = build('random', 1000, 1);
  const measured = depths(tree);

  assert.strictEqual(tree.stats().comparisons, 11454);
  assert.strictEqual(tree.height(), 23);
  assert.strictEqual(Number(measured.mean.toFixed(2)), 12.45);

  const text = textOf(examples('bst-rotations')[0]);
  ['11 454', '23', '12.45'].forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, 'the example must quote ' + figure);
  });
});

test('bst-rotations: the sorted-to-shuffled ratios are 43.6x and 40.2x', function () {
  const sorted = build('sorted', 1000, 1);
  const shuffled = build('random', 1000, 1);

  const buildRatio = sorted.stats().comparisons / shuffled.stats().comparisons;
  const lookupRatio = depths(sorted).mean / depths(shuffled).mean;

  assert.strictEqual(Number(buildRatio.toFixed(1)), 43.6);
  assert.strictEqual(Number(lookupRatio.toFixed(1)), 40.2);

  const text = textOf(examples('bst-rotations')[0]);
  assert.ok(text.indexOf('43.6') !== -1);
  assert.ok(text.indexOf('40.2') !== -1);
});

test('bst-rotations: over 50 seeds the mean height is 22.3 and the mean depth 12.0', function () {
  let heights = 0;
  let means = 0;
  for (let seed = 1; seed <= 50; seed += 1) {
    const tree = build('random', 1000, seed);
    heights += tree.height();
    means += depths(tree).mean;
  }

  assert.strictEqual(Number((heights / 50).toFixed(1)), 22.3);
  assert.strictEqual(Number((means / 50).toFixed(1)), 12.0);
  assert.strictEqual(Number((4.311 * Math.log(1000)).toFixed(1)), 29.8, 'the asymptotic height');
  assert.strictEqual(Number((2 * Math.log(1000)).toFixed(1)), 13.8, 'the asymptotic depth');

  const text = textOf(examples('bst-rotations')[0]);
  ['22.3', '12.0', '29.8', '13.8'].forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, 'the example must quote ' + figure);
  });
});

/* ------------------------------------------------ 4.1, second worked example */

function totalDepth(node, depth) {
  if (!node) return 0;
  return depth + totalDepth(node.left, depth + 1) + totalDepth(node.right, depth + 1);
}

test('bst-rotations: a rotation on a balanced five-node tree is zero-sum', function () {
  const tree = Bst.create({});
  [4, 2, 8, 6, 9].forEach(function (key) { tree.insert(key, key); });

  const before = totalDepth(tree.root(), 1);
  assert.strictEqual(before, 11, '1 + 2 + 2 + 3 + 3');
  assert.strictEqual(Bst.size(tree.root().left), 1, '|A| = 1');
  assert.strictEqual(Bst.size(tree.root().right.right), 1, '|C| = 1');

  const rotated = Bst.rotateLeft(tree.root());
  assert.strictEqual(totalDepth(rotated, 1), 11, 'Δ = |A| − |C| = 0');
  assert.strictEqual(Bst.inOrder(rotated).join(','), '2,4,6,8,9', 'and the ordering is untouched');

  const text = textOf(examples('bst-rotations')[1]);
  assert.ok(text.indexOf('11') !== -1);
});

test('bst-rotations: a rotation on a five-node spine is worth exactly three levels', function () {
  const tree = Bst.create({});
  [1, 2, 3, 4, 5].forEach(function (key) { tree.insert(key, key); });

  const before = totalDepth(tree.root(), 1);
  assert.strictEqual(before, 15, '1 + 2 + 3 + 4 + 5');

  const a = Bst.size(tree.root().left);
  const c = Bst.size(tree.root().right.right);
  assert.strictEqual(a, 0, '|A| = 0');
  assert.strictEqual(c, 3, '|C| = 3');

  const rotated = Bst.rotateLeft(tree.root());
  assert.strictEqual(totalDepth(rotated, 1) - before, a - c, 'Δ = |A| − |C|');
  assert.strictEqual(totalDepth(rotated, 1), 12);

  const text = textOf(examples('bst-rotations')[1]);
  ['15', '12', '−3'].forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, 'the example must quote ' + figure);
  });
});

test('bst-rotations: repairing the 1 000-key spine needs at least 493 rotations', function () {
  const spine = Bst.create({});
  for (let key = 1; key <= 1000; key += 1) spine.insert(key, key);
  assert.strictEqual(totalDepth(spine.root(), 1), 500500, 'n(n + 1)/2');

  /* A perfectly balanced tree over 1 000 keys: 511 nodes fill nine levels and
     the remaining 489 sit at depth ten. */
  let balanced = 0;
  let placed = 0;
  for (let level = 1; placed < 1000; level += 1) {
    const here = Math.min(Math.pow(2, level - 1), 1000 - placed);
    balanced += here * level;
    placed += here;
  }
  assert.strictEqual(balanced, 8987);

  const gap = 500500 - balanced;
  assert.strictEqual(gap, 491513);
  assert.strictEqual(Math.ceil(gap / 999), 493, 'at best |A| − |C| = n − 1 per rotation');

  const text = textOf(examples('bst-rotations')[1]);
  ['500 500', '8 987', '491 513', '493'].forEach(function (figure) {
    assert.ok(text.indexOf(figure) !== -1, 'the example must quote ' + figure);
  });
});
