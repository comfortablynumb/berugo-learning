'use strict';

/**
 * Unit tests for the M09 persistent structures.
 *
 * The standing property is not "the structure works" but "*every version* of
 * the structure works". A persistent structure that is correct at the latest
 * version and wrong three versions back passes every test that checks the end
 * state, and fails in production as a snapshot read returning data that never
 * existed - so every test here replays the whole history against a plain
 * model rather than checking the tip.
 *
 * The second property is that sharing is real: copied nodes per update must be
 * O(depth) for path copying, and the total must stay far below versions × size.
 *
 * Everything is pure and DOM-free.
 */

const test = require('node:test');
const assert = require('node:assert');

const PersistentBst = require('../../src/js/algorithms/persistent-bst.js');
const PersistentQueue = require('../../src/js/algorithms/persistent-queue.js');
const PersistentSegmentTree = require('../../src/js/algorithms/persistent-segment-tree.js');
const Hamt = require('../../src/js/algorithms/hamt.js');
const FingerTree = require('../../src/js/algorithms/finger-tree.js');
const Zipper = require('../../src/js/algorithms/zipper.js');
const VersionLab = require('../../src/js/machines/version-lab.js');
const Random = require('../../src/js/utils/random.js');

/* ------------------------------------------- every version, every strategy */

PersistentBst.strategies.forEach(function (strategy) {
  test('persistence: ' + strategy + ' answers correctly at every version', function () {
    const rows = VersionLab.persistenceCompare({ count: 500, seed: 2 });
    const row = rows.filter(function (entry) { return entry.strategy === strategy; })[0];
    assert.strictEqual(row.wrongVersions, 0,
      row.wrongVersions + ' of ' + row.shape.versions + ' versions disagreed with the model');
    assert.ok(row.shape.liveKeys > 100, 'the key stream has to actually populate the tree');
  });

  test('persistence: ' + strategy + ' shares rather than copying the world', function () {
    const rows = VersionLab.persistenceCompare({ count: 400, seed: 3 });
    const row = rows.filter(function (entry) { return entry.strategy === strategy; })[0];
    const copyingEverything = row.shape.versions * row.shape.liveKeys;
    assert.ok(row.shape.distinctNodes < copyingEverything / 20,
      strategy + ' kept ' + row.shape.distinctNodes + ' nodes against ' + copyingEverything + ' for full copies');
  });
});

test('persistence: path copying costs O(depth) nodes per update, and the others less', function () {
  const rows = {};
  VersionLab.persistenceCompare({ count: 400, seed: 3 }).forEach(function (row) {
    rows[row.strategy] = row;
  });
  const depth = rows['path-copying'].shape.depth;

  /* Rotations mean an update touches a little more than one path, so the
     bound is a small multiple of the depth rather than the depth itself. */
  assert.ok(rows['path-copying'].shape.nodesPerUpdate < depth,
    'path copying allocated ' + rows['path-copying'].shape.nodesPerUpdate.toFixed(2) + ' per update at depth ' + depth);
  assert.ok(rows['fat-node'].shape.nodesPerUpdate < 1.5,
    'a fat node only allocates for a genuinely new key');
  assert.ok(rows['node-copying'].shape.nodesPerUpdate < rows['path-copying'].shape.nodesPerUpdate,
    'node copying must beat path copying on allocation, which is its whole claim');
});

test('persistence: an old version is unaffected by later updates', function () {
  const tree = PersistentBst.create({ strategy: 'path-copying' });
  const early = [];
  for (let i = 0; i < 50; i += 1) { tree.insert(i * 7 % 97); early.push(tree.keys().slice()); }
  for (let i = 0; i < 200; i += 1) tree.insert(500 + i);

  for (let version = 1; version <= 50; version += 1) {
    assert.deepStrictEqual(tree.keys(version), early[version - 1], 'version ' + version + ' moved');
  }
  assert.strictEqual(tree.has(500, 50), false, 'a later key must not appear in an earlier version');
  assert.strictEqual(tree.has(500, tree.versions()), true);
});

/* ------------------------------------------------------------- the queues */

PersistentQueue.kinds.forEach(function (kind) {
  test('queue: ' + kind + ' is FIFO under a mixed operation sequence', function () {
    const queue = PersistentQueue.create({ kind: kind });
    const random = Random.seeded(7);
    let current = queue.empty();
    const model = [];

    for (let i = 0; i < 2000; i += 1) {
      if (!model.length || random.next() < 0.6) {
        current = queue.snoc(current, i);
        model.push(i);
        continue;
      }
      assert.strictEqual(queue.head(current), model[0], 'head disagreed at step ' + i);
      current = queue.tail(current);
      model.shift();
    }

    assert.deepStrictEqual(queue.toArray(current), model);
  });
});

test('queue: persistence destroys the strict queue\'s amortised bound', function () {
  const rows = {};
  VersionLab.queueReuse({ size: 512, reuses: 1000 }).forEach(function (row) { rows[row.kind] = row; });

  assert.ok(rows.strict.stepsPerReuse > 100,
    'the strict queue must re-pay the rotation on every reuse: ' + rows.strict.stepsPerReuse);
  assert.ok(rows.banker.stepsPerReuse < 5,
    'the memoised suspension must pay it once: ' + rows.banker.stepsPerReuse);
  assert.ok(rows.strict.stepsPerReuse / rows.banker.stepsPerReuse > 50,
    'and the gap has to be an order of magnitude to be the section\'s point');
});

test('queue: only the real-time queue has a bounded worst operation', function () {
  const rows = {};
  VersionLab.queueTimeline({ size: 512 }).forEach(function (row) { rows[row.kind] = row; });

  assert.ok(rows.realtime.worst <= 4,
    'the real-time queue must never spike: worst was ' + rows.realtime.worst);
  assert.ok(rows.strict.worst > 100, 'the strict queue spikes at a rotation');
  assert.ok(rows.banker.worst > 100,
    'and so does the banker\'s queue - laziness fixes persistence, not the worst case');
  assert.ok(rows.realtime.mean <= rows.strict.mean + 1e-9,
    'without costing more on average');
});

/* -------------------------------------------------- versioned range queries */

test('segment tree: every version answers range sums correctly after 500 updates', function () {
  const result = VersionLab.versionedQueries({ size: 1024, updates: 500 });
  assert.strictEqual(result.wrong, 0, result.wrong + ' of ' + result.checks + ' historical queries were wrong');
  assert.strictEqual(result.shape.nodesPerUpdate, result.shape.depthBound,
    'an update must rebuild exactly one root-to-leaf path');
  assert.ok(result.savingAgainstCopying > 50,
    'sharing must beat copying every version by a large factor: ' + result.savingAgainstCopying);
});

test('segment tree: the prefix construction answers range k-th smallest exactly', function () {
  const result = VersionLab.rangeQuantiles({ size: 512, domain: 1000, probes: 300 });
  assert.strictEqual(result.wrong, 0, result.wrong + ' of ' + result.probes + ' quantile queries were wrong');
  assert.ok(result.descentsPerQuery <= result.shape.depthBound,
    'the query is one descent of the value domain, not a search of the range');
});

test('segment tree: countBelow agrees with a scan', function () {
  const random = Random.seeded(11);
  const values = [];
  for (let i = 0; i < 400; i += 1) values.push(random.int(500));
  const index = PersistentSegmentTree.prefixCounts(values, { domain: 500 });

  for (let probe = 0; probe < 200; probe += 1) {
    const a = random.int(400);
    const b = random.int(400);
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const threshold = random.int(500);
    let want = 0;
    for (let i = from; i <= to; i += 1) if (values[i] < threshold) want += 1;
    assert.strictEqual(index.countBelow(from, to, threshold), want);
  }
});

/* ----------------------------------------------------- HAMT and the vector */

test('hamt: a map of 20 000 keys agrees with a plain Map', function () {
  const result = VersionLab.mapCompare({ count: 20000, seed: 13 });
  assert.strictEqual(result.wrong, 0);
  assert.ok(result.shape.maxDepth <= result.depthBound,
    'depth ' + result.shape.maxDepth + ' passed the ⌈32/5⌉ = ' + result.depthBound + ' bound');
  assert.ok(result.denseSaving > 3,
    'popcount-indexed sparse nodes must beat 32-slot dense ones: ' + result.denseSaving);
});

test('hamt: node arrays hold no empty slots', function () {
  const engine = Hamt.map({});
  const random = Random.seeded(17);
  let node = engine.empty();
  for (let i = 0; i < 5000; i += 1) node = engine.set(node, 'k' + random.int(9000), i);

  const shape = engine.shape(node);
  assert.strictEqual(shape.emptySlots, 0,
    'a node whose child array is longer than its popcount is carrying holes');
  assert.ok(shape.meanFanout > 1 && shape.meanFanout <= 32);
});

test('hamt: keys whose hashes collide are all retained', function () {
  const engine = Hamt.map({});
  let node = engine.empty();
  const keys = [];
  for (let i = 0; i < 400; i += 1) { keys.push('collide-' + i); node = engine.set(node, 'collide-' + i, i); }

  keys.forEach(function (key, i) { assert.strictEqual(engine.get(node, key), i); });
  assert.strictEqual(engine.entries(node).length, 400);
});

test('vector: 200 000 appends index correctly and stay shallow', function () {
  const engine = Hamt.vector({});
  let vector = engine.empty();
  for (let i = 0; i < 200000; i += 1) vector = engine.push(vector, i);

  for (let i = 0; i < 200000; i += 31) {
    assert.strictEqual(engine.get(vector, i), i, 'index ' + i);
  }
  const shape = engine.shape(vector);
  assert.strictEqual(shape.levels, 4, '200 000 elements need four levels of 32');
  assert.ok(shape.capacityAtDepth >= 200000);
});

test('vector: an update leaves every other version alone', function () {
  const engine = Hamt.vector({});
  let base = engine.empty();
  for (let i = 0; i < 5000; i += 1) base = engine.push(base, i);

  const changed = engine.set(base, 1234, 'changed');
  assert.strictEqual(engine.get(base, 1234), 1234);
  assert.strictEqual(engine.get(changed, 1234), 'changed');
  assert.strictEqual(engine.get(changed, 1235), 1235);
});

test('vector: a transient allocates far less for the same answer', function () {
  const result = VersionLab.vectorAllocations({ count: 20000 });
  assert.strictEqual(result.wrong, 0, 'the two builds must produce identical vectors');
  assert.ok(result.saving > 2,
    'a transient must reuse the nodes it owns: ' + result.saving.toFixed(2) + '×');
  assert.ok(result.transient.nodesMutated > 0, 'and the reuse has to be visible as a counter');
});

/* -------------------------------------------------------- the finger tree */

test('finger tree: order survives pushes at both ends', function () {
  const engine = FingerTree.create({ monoid: 'size' });
  const random = Random.seeded(19);
  let tree = engine.empty();
  const model = [];

  for (let i = 0; i < 3000; i += 1) {
    if (random.next() < 0.5) { tree = engine.pushBack(tree, i); model.push(i); }
    else { tree = engine.pushFront(tree, i); model.unshift(i); }
  }

  assert.deepStrictEqual(engine.toArray(tree), model);
  assert.strictEqual(engine.measure(tree), model.length);
});

test('finger tree: split then concat reconstructs the original exactly', function () {
  const engine = FingerTree.create({ monoid: 'size' });
  const random = Random.seeded(23);
  const model = [];
  let tree = engine.empty();
  for (let i = 0; i < 1500; i += 1) { tree = engine.pushBack(tree, i); model.push(i); }

  for (let probe = 0; probe < 300; probe += 1) {
    const at = random.int(model.length + 1);
    const parts = engine.split(tree, function (measure) { return measure > at; });
    assert.strictEqual(engine.toArray(parts[0]).length, at, 'split at ' + at + ' cut in the wrong place');
    assert.deepStrictEqual(engine.toArray(engine.concat(parts[0], parts[1])), model);
  }
});

test('finger tree: the same code is a priority queue when the monoid changes', function () {
  const engine = FingerTree.create({ monoid: 'priority' });
  const random = Random.seeded(29);
  let tree = engine.empty();
  const priorities = [];

  for (let i = 0; i < 400; i += 1) {
    const item = { id: i, priority: random.int(100000) };
    tree = engine.pushBack(tree, item);
    priorities.push(item.priority);
  }

  const descending = priorities.slice().sort(function (a, b) { return b - a; });
  const popped = [];
  let current = tree;
  for (let i = 0; i < priorities.length; i += 1) {
    const best = engine.measure(current);
    const parts = engine.split(current, function (measure) { return measure >= best; });
    const view = engine.popFront(parts[1]);
    popped.push(view.head.priority);
    current = engine.concat(parts[0], view.tail);
  }

  assert.deepStrictEqual(popped, descending);
});

test('finger tree: concatenating two independently built trees preserves order', function () {
  const engine = FingerTree.create({ monoid: 'size' });
  let left = engine.empty();
  let right = engine.empty();
  const model = [];
  for (let i = 0; i < 700; i += 1) { left = engine.pushBack(left, 'l' + i); model.push('l' + i); }
  for (let i = 0; i < 900; i += 1) { right = engine.pushBack(right, 'r' + i); model.push('r' + i); }

  assert.deepStrictEqual(engine.toArray(engine.concat(left, right)), model);
});

/* ------------------------------------------------------------- the zipper */

test('zipper: navigating without editing rebuilds an identical tree', function () {
  const engine = Zipper.tree();
  const random = Random.seeded(31);

  function build(depth) {
    if (!depth) return engine.node(random.int(100), []);
    const width = 1 + random.int(3);
    const children = [];
    for (let i = 0; i < width; i += 1) children.push(build(depth - 1));
    return engine.node(random.int(100), children);
  }

  const source = build(6);
  let zipper = engine.focus(source);
  for (let step = 0; step < 200; step += 1) {
    const move = random.int(4);
    const next = move === 0 ? engine.down(zipper, 0)
      : move === 1 ? engine.up(zipper)
        : move === 2 ? engine.left(zipper) : engine.right(zipper);
    if (next) zipper = next;
  }

  assert.deepStrictEqual(engine.toRoot(zipper), source);
});

test('zipper: an edit lands where the focus is and nowhere else', function () {
  const engine = Zipper.tree();
  const leaf = engine.node('leaf', []);
  const source = engine.node('root', [engine.node('a', [leaf]), engine.node('b', [])]);

  let zipper = engine.focus(source);
  zipper = engine.down(zipper, 0);
  zipper = engine.down(zipper, 0);
  assert.strictEqual(engine.value(zipper), 'leaf');
  assert.deepStrictEqual(engine.path(zipper), [0, 0]);

  const rebuilt = engine.toRoot(engine.edit(zipper, function () { return 'edited'; }));
  assert.strictEqual(rebuilt.children[0].children[0].value, 'edited');
  assert.strictEqual(rebuilt.children[1].value, 'b');
  assert.strictEqual(source.children[0].children[0].value, 'leaf', 'the original must be untouched');
});

test('zipper: local edits cost one rebuild rather than one per edit', function () {
  const result = Zipper.editCost({ depth: 12, edits: 50 });
  assert.strictEqual(result.zipper.rebuilds, 1);
  assert.strictEqual(result.pathCopying.rebuilds, 50);
  assert.ok(result.ratio >= 40,
    'the zipper rebuilt ' + result.zipper.nodesRebuilt + ' nodes against ' + result.pathCopying.nodesRebuilt);
});

test('zipper: the list zipper is the same idea and round-trips', function () {
  const engine = Zipper.list();
  const items = [];
  for (let i = 0; i < 200; i += 1) items.push(i);

  let zipper = engine.focus(items, 0);
  for (let i = 0; i < 120; i += 1) zipper = engine.forward(zipper) || zipper;
  assert.strictEqual(engine.position(zipper), 120);
  assert.strictEqual(engine.value(zipper), 120);

  const edited = engine.toArray(engine.replace(zipper, 'x'));
  assert.strictEqual(edited[120], 'x');
  assert.strictEqual(edited.length, 200);
  assert.strictEqual(items[120], 120, 'the source array must be untouched');
});
