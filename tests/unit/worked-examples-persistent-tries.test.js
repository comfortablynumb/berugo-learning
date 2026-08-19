'use strict';

/**
 * Every figure the M09.4-M09.6 worked examples quote, recomputed.
 *
 * Same contract as the other worked-example suites: reproduce the measurement
 * with the demo's own parameters and seed, then assert the prose still quotes
 * the result. A module change that moves a number fails here rather than
 * leaving a sentence that used to be true.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;
const grouped = prose.grouped;

const VersionLab = require('../../src/js/machines/version-lab.js');
const Zipper = require('../../src/js/algorithms/zipper.js');
const FingerTree = require('../../src/js/algorithms/finger-tree.js');
require('../../src/js/content/examples-persistent-tries.js');
require('../../src/js/content/concepts-persistent-tries.js');

const BITS = 5;
const BRANCH = 32;

const maps = VersionLab.mapCompare({ count: 20000, seed: 5 });
const vectors = VersionLab.vectorAllocations({ count: 20000 });
const monoids = VersionLab.monoidCompare({ count: 1000, seed: 7 });
const sequence = VersionLab.sequenceOps({ count: 3000, at: 1500 });

/* ---------------------------------------------- 9.4 bit-partitioned-tries */

test('bit-partitioned-tries: the depth bound is arithmetic on the hash width', function () {
  assert.strictEqual(Math.ceil(32 / BITS), 7);
  assert.strictEqual(Math.pow(BRANCH, 7), 34359738368);
  assert.strictEqual(grouped(Math.pow(BRANCH, 7)), '34 359 738 368');
  assert.strictEqual(Math.pow(BRANCH, 4), 1048576);
  assert.strictEqual(grouped(Math.pow(BRANCH, 4)), '1 048 576');
  quotes('bit-partitioned-tries', ['⌈32 / 5⌉ = 7 levels', '32^7 = 34 359 738 368',
    'depth 4 already covers 1 048 576']);
});

test('bit-partitioned-tries: 15 695 keys reach depth 6 of the possible 7', function () {
  assert.strictEqual(maps.wrong, 0);
  assert.strictEqual(maps.distinctKeys, 15695);
  assert.strictEqual(maps.shape.entries, maps.distinctKeys);
  assert.strictEqual(maps.shape.maxDepth, 6);
  assert.strictEqual(maps.depthBound, 7);
  assert.ok(maps.shape.maxDepth < maps.depthBound, 'the measured depth must stay inside the bound');

  assert.strictEqual(vectors.shape.levels, 3);
  assert.strictEqual(Math.ceil(Math.log(200000) / Math.log(BRANCH)), 4);
  quotes('bit-partitioned-tries', ['15 695 distinct keys in the HAMT reach depth 6 of a possible 7',
    '20 000 vector elements need 3 levels; 200 000 need 4']);
});

test('bit-partitioned-tries: a dense 32-slot node would cost 1 037 520 bytes', function () {
  assert.strictEqual(maps.shape.nodes, 3930);
  assert.strictEqual(maps.shape.bytesDense, 3930 * (8 + 32 * 8));
  assert.strictEqual(maps.shape.bytesDense, 1037520);
  assert.strictEqual(fixed(maps.shape.meanFanout), '4.99');
  assert.strictEqual(fixed((1 - maps.shape.meanFanout / BRANCH) * 100, 0), '84');
  quotes('bit-partitioned-tries', ['3 930 nodes × (8 + 32 × 8) bytes = 1 037 520 bytes',
    'mean fan-out actually used: 4.99 of 32', '84% of every dense node is empty']);
});

test('bit-partitioned-tries: the bitmap layout is 219 872 bytes and 4.72x smaller', function () {
  assert.strictEqual(maps.shape.slots, 19624);
  assert.strictEqual(maps.shape.bytesSparse, 3930 * 16 + 19624 * 8);
  assert.strictEqual(maps.shape.bytesSparse, 219872);
  assert.strictEqual(fixed(maps.denseSaving), '4.72');
  assert.strictEqual(fixed(maps.shape.bytesDense / maps.shape.bytesSparse), '4.72');
  quotes('bit-partitioned-tries', ['3 930 nodes × 16 bytes + 19 624 occupied slots × 8 = 219 872 bytes',
    '4.72× smaller, with no search added']);
});

test('bit-partitioned-tries: children.length === popcount(bitmap) on every node', function () {
  assert.strictEqual(maps.shape.emptySlots, 0);
  assert.strictEqual(maps.shape.slots, Math.round(maps.shape.meanFanout * maps.shape.nodes),
    'the mean fan-out is the occupied slots over the nodes and nothing else');
  quotes('bit-partitioned-tries', ['children.length === popcount(bitmap), on every node',
    'measured: 0 nodes disagree']);
});

test('bit-partitioned-tries: a transient allocates 2.85x less for the same vector', function () {
  assert.strictEqual(vectors.wrong, 0);
  assert.strictEqual(vectors.persistent.nodesAllocated, 1840);
  assert.strictEqual(vectors.shape.nodes, 645);
  assert.strictEqual(vectors.transient.nodesAllocated, 645);
  assert.strictEqual(vectors.transient.nodesMutated, 1195);
  assert.strictEqual(vectors.persistent.nodesAllocated - vectors.shape.nodes, 1195);
  assert.strictEqual(fixed(vectors.saving), '2.85');
  assert.strictEqual(vectors.shape.tail, BRANCH);
  quotes('bit-partitioned-tries', ['20 000 appends allocate 1 840 nodes', 'the final vector holds 645 nodes',
    'about 1 200 nodes built and immediately made garbage',
    '645 nodes allocated, 1 195 mutated in place', '2.85× fewer allocations',
    'all 20 000 indices compared between the two vectors', '0 differences',
    '1 840 objects over 20 000 appends']);
});

/* ------------------------------------------------------- 9.5 finger-trees */

function monoid(name) {
  const row = monoids.filter(function (item) { return item.monoid === name; })[0];
  assert.ok(row, 'no ' + name + ' row in monoidCompare');
  return row;
}

test('finger-trees: four monoids, four root measures, one shape', function () {
  assert.strictEqual(monoid('size').measure, 1000);
  assert.strictEqual(monoid('sum').measure, 49956);
  assert.strictEqual(monoid('priority').measure, 999);
  assert.strictEqual(monoid('intervalEnd').measure, 499);
  assert.strictEqual(grouped(49956), '49 956');

  const reference = monoid('size').widths;
  assert.deepStrictEqual(reference, ['1/3', '1/4', '1/3', '1/4', '1/3', '1/1']);
  monoids.forEach(function (row) {
    assert.strictEqual(row.count, 1000);
    assert.deepStrictEqual(row.widths, reference, row.monoid + ' changed the shape, which it must not');
    assert.strictEqual(row.spine, 6);
    assert.strictEqual(row.digitElements, 24);
  });

  quotes('finger-trees', ['size (+, 0):            1 000', 'sum of values (+, 0):     49 956',
    'max priority (max, −∞):      999', 'max interval end (max, −∞):  499',
    'digit widths down the spine, all four trees: 1/3, 1/4, 1/3, 1/4, 1/3, 1/1']);
});

test('finger-trees: splitting 3 000 elements visits 14 nodes and rejoining allocates 20', function () {
  assert.strictEqual(sequence.count, 3000);
  assert.strictEqual(sequence.at, 1500);
  assert.strictEqual(sequence.splitVisits, 14);
  assert.strictEqual(sequence.leftLength, 1500);
  assert.strictEqual(sequence.concatAllocated, 20);
  assert.strictEqual(sequence.rejoinedLength, 3000);
  assert.ok(sequence.splitVisits < sequence.count, 'a split that scans is not the operation the prose claims');
  quotes('finger-trees', ['3 000 elements, split at 1 500', '14 nodes visited',
    'reassembling the halves allocates 20 nodes',
    'no element is examined until the final digit - 14 nodes across 3 000 elements']);
});

test('finger-trees: the spine of a 3 000-element tree is 7 levels holding 26 digit elements', function () {
  assert.strictEqual(sequence.shape.spine, 7);
  assert.strictEqual(sequence.shape.digitElements, 26);
  assert.strictEqual(sequence.shape.measure, 3000);
  assert.strictEqual(sequence.shape.monoid, 'size');
  quotes('finger-trees', ['a spine of 7 levels holding 26 elements in its digits',
    'on a finger tree: 14 nodes visited to split 3 000 elements']);
});

test('finger-trees: every monoid the demo measures really is associative with an identity', function () {
  const SAMPLES = [0, 1, 7, -3, 499, 999, 49956];

  assert.strictEqual(monoids.length, 4);
  monoids.forEach(function (row) {
    const monoidDef = FingerTree.monoids[row.monoid];
    assert.ok(monoidDef, 'the demo measured a monoid the module does not define');

    SAMPLES.forEach(function (a) {
      assert.strictEqual(monoidDef.combine(monoidDef.identity, a), a, row.monoid + ' has a left identity');
      assert.strictEqual(monoidDef.combine(a, monoidDef.identity), a, row.monoid + ' has a right identity');
      SAMPLES.forEach(function (b) {
        SAMPLES.forEach(function (c) {
          assert.strictEqual(
            monoidDef.combine(monoidDef.combine(a, b), c),
            monoidDef.combine(a, monoidDef.combine(b, c)),
            row.monoid + ' is not associative at (' + a + ', ' + b + ', ' + c + ')'
          );
        });
      });
    });
  });

  /* The two the example names as disqualified, shown failing the same check. */
  assert.notStrictEqual((7 - 3) - 1, 7 - (3 - 1));
  assert.notStrictEqual(((7 + 3) / 2 + 1) / 2, (7 + (3 + 1) / 2) / 2);

  quotes('finger-trees', ['combine must be associative with an identity',
    'max, min, sum, gcd and "rightmost" qualify',
    'subtraction and mean do not - all 4 monoids measured here qualify']);
});

/* ------------------------------------------------------------ 9.6 zippers */

const zipperAt12 = VersionLab.zipperCost({ depth: 12, edits: 50 });

test('zippers: 50 edits at depth 12 cost 600 nodes directly and 12 through a zipper', function () {
  assert.strictEqual(zipperAt12.pathCopying.nodesRebuilt, 600);
  assert.strictEqual(zipperAt12.pathCopying.moves, 1200);
  assert.strictEqual(zipperAt12.pathCopying.rebuilds, 50);
  assert.strictEqual(50 * 12, 600);

  assert.strictEqual(zipperAt12.zipper.nodesRebuilt, 12);
  assert.strictEqual(zipperAt12.zipper.moves, 24);
  assert.strictEqual(zipperAt12.zipper.rebuilds, 1);

  quotes('zippers', ['50 edits × 12 nodes rebuilt = 600 nodes', '50 descents of 12 moves each = 1 200 moves',
    '50 separate rebuilds', 'one descent of 12 moves to reach the node', 'one rebuild of 12 nodes on the way out',
    '12 nodes, 24 moves and 1 rebuild']);
});

test('zippers: the ratio is the edit count at every depth the example tries', function () {
  const cases = [
    { depth: 12, edits: 50, direct: 600, expect: 50 },
    { depth: 8, edits: 50, direct: 400, expect: 50 },
    { depth: 16, edits: 100, direct: 1600, expect: 100 }
  ];

  cases.forEach(function (item) {
    const measured = VersionLab.zipperCost({ depth: item.depth, edits: item.edits });
    assert.strictEqual(measured.zipper.nodesRebuilt, item.depth, 'a zipper rebuilds the path once');
    assert.strictEqual(measured.pathCopying.nodesRebuilt, item.direct);
    assert.strictEqual(measured.ratio, item.expect);
    assert.strictEqual(measured.ratio, item.edits, 'the saving is the edit count, not a function of the depth');
  });

  quotes('zippers', ['600 / 12 = 50 - exactly the number of edits',
    'at depth 8 with 50 edits: 400 / 8 = 50', 'at depth 16 with 100 edits: 1 600 / 16 = 100',
    'the saving is the edit count, independent of the depth']);
});

test('zippers: bouncing to the root between edits costs the same 600 nodes', function () {
  assert.strictEqual(zipperAt12.pathCopying.nodesRebuilt, 50 * 12);
  assert.strictEqual(zipperAt12.pathCopying.rebuilds, 50);
  assert.ok(zipperAt12.pathCopying.nodesRebuilt > zipperAt12.zipper.nodesRebuilt,
    'the bouncing case is the one the zipper does not help');
  quotes('zippers', ['edit, toRoot, re-focus, edit, toRoot, …', '50 edits × 12 nodes = 600 nodes rebuilt',
    'exactly the direct method - the zipper adds nothing and costs a little']);
});

test('zippers: editing through a zipper leaves the source tree untouched', function () {
  const engine = Zipper.tree();
  const leaf = engine.node('leaf', []);
  const source = engine.node('root', [engine.node('a', [leaf]), engine.node('b', [])]);

  let zipper = engine.focus(source);
  zipper = engine.down(zipper, 0);
  zipper = engine.down(zipper, 0);
  const other = engine.focus(source);

  for (let i = 0; i < 50; i += 1) {
    zipper = engine.edit(zipper, function () { return 'edited'; });
  }
  const rebuilt = engine.toRoot(zipper);

  assert.strictEqual(rebuilt.children[0].children[0].value, 'edited');
  assert.strictEqual(source.children[0].children[0].value, 'leaf', 'the source must be untouched');
  assert.strictEqual(other.node, source, 'the second zipper still holds the version it was made in');
  assert.strictEqual(engine.toRoot(other), source);

  quotes('zippers', ['editing through zipper A produces a new tree; zipper B still holds the 12 old nodes',
    'two zippers into one tree are two independent views, not two cursors',
    'the original\'s value at the edited path',
    'unchanged - which is why the old version is still reachable']);
});

test('zippers: the crumbs pin one node per level of the path', function () {
  const engine = Zipper.tree();

  function build(level) {
    if (!level) return engine.node(level, []);
    return engine.node(level, [build(level - 1), engine.node(-level, [])]);
  }

  let zipper = engine.focus(build(12));
  for (let i = 0; i < 12; i += 1) zipper = engine.down(zipper, 0);

  assert.strictEqual(zipper.crumbs.length, 12, 'one crumb per level descended');
  quotes('zippers', ['the focus and every crumb hold real nodes',
    'the focus and all 12 crumbs pin that whole version', 'a forgotten zipper is a retained snapshot']);
});
