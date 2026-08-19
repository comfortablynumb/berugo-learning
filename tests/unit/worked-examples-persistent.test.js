'use strict';

/**
 * Every figure the M09.1-M09.3 worked examples quote, recomputed.
 *
 * Each test reproduces the measurement with the parameters and seed the demo
 * uses, and then asserts the example *still quotes it*. Moving a number
 * without moving the prose fails the build, which is the only thing that keeps
 * a figure and the sentence around it attached to each other.
 */

const test = require('node:test');
const assert = require('node:assert');

const prose = require('../support/worked-example-prose.js');
const quotes = prose.quotes;
const fixed = prose.fixed;
const grouped = prose.grouped;

const VersionLab = require('../../src/js/machines/version-lab.js');
const RangeLab = require('../../src/js/machines/range-lab.js');
require('../../src/js/content/examples-persistent.js');
require('../../src/js/content/concepts-persistent.js');

/* The demo parameters. Every figure below comes from one of these calls. */
const COMPARE = { count: 400, seed: 1 };
const QUEUE_SIZE = 512;
const REUSES = 1000;

const strategies = VersionLab.persistenceCompare(COMPARE);

function strategy(name) {
  const row = strategies.filter(function (item) { return item.strategy === name; })[0];
  assert.ok(row, 'no ' + name + ' row in persistenceCompare');
  return row;
}

/* ------------------------------------------------- 9.1 persistence-basics */

test('persistence-basics: all three strategies agree on shape and on every version', function () {
  strategies.forEach(function (row) {
    assert.strictEqual(row.wrongVersions, 0, row.strategy + ' answered an old version wrongly');
    assert.strictEqual(row.shape.liveKeys, 344);
    assert.strictEqual(row.shape.depth, 18);
    assert.strictEqual(row.shape.versions, 400);
  });
  quotes('persistence-basics', ['344 live keys at depth 18', '400 versions', '1 200-key universe']);
});

test('persistence-basics: the copy-everything baseline is 5 504 000 bytes', function () {
  const shape = strategy('path-copying').shape;
  const cost = VersionLab.copyingCost(shape.versions, shape.liveKeys);

  assert.strictEqual(cost, 400 * 344 * 40);
  assert.strictEqual(cost, 5504000);
  assert.strictEqual(grouped(cost), '5 504 000');
  quotes('persistence-basics', ['400 versions × 344 live keys × 40 bytes = 5 504 000 bytes', '5.5 MB']);
});

test('persistence-basics: path copying allocates 13.12 per update for 156 720 bytes', function () {
  const shape = strategy('path-copying').shape;

  assert.strictEqual(fixed(shape.nodesPerUpdate), '13.12');
  assert.strictEqual(shape.distinctNodes, 3918);
  assert.strictEqual(shape.bytes, 156720);
  assert.ok(shape.nodesPerUpdate < shape.depth, 'a path rebuild cannot average more than the depth');
  quotes('persistence-basics', ['13.12 nodes allocated per update at depth 18',
    '3 918 distinct nodes', '156 720 bytes']);
});

test('persistence-basics: fat nodes never copy - 344 nodes, 3 574 appended entries', function () {
  const row = strategy('fat-node');

  assert.strictEqual(row.shape.distinctNodes, 344);
  assert.strictEqual(row.shape.distinctNodes, row.shape.liveKeys, 'one node per distinct key, never copied');
  assert.strictEqual(row.stats.fieldsAppended, 3574);
  assert.strictEqual(fixed(row.shape.nodesPerUpdate), '0.86');
  assert.strictEqual(row.shape.bytes, 76448);
  quotes('persistence-basics', ['344 node objects in total', '3 574 version entries appended across 400 updates',
    '0.86 nodes allocated per update, 76 448 bytes']);
});

test('persistence-basics: node copying fills 1 861 boxes and cascades 1 713 times', function () {
  const row = strategy('node-copying');

  assert.strictEqual(row.stats.boxesFilled, 1861);
  assert.strictEqual(row.stats.cascades, 1713);
  assert.strictEqual(fixed(row.shape.nodesPerUpdate), '5.14');
  assert.strictEqual(row.shape.distinctNodes, 2057);
  assert.strictEqual(row.shape.bytes, 126944);
  quotes('persistence-basics', ['1 861 boxes filled and 1 713 cascades over 400 updates',
    '5.14 nodes allocated per update', '2 057 distinct nodes, 126 944 bytes']);
});

test('persistence-basics: the three ratios the answer states', function () {
  const path = strategy('path-copying').shape;
  const fat = strategy('fat-node').shape;
  const node = strategy('node-copying').shape;
  const baseline = VersionLab.copyingCost(path.versions, path.liveKeys);

  assert.strictEqual(fixed(baseline / path.bytes, 0), '35');
  assert.strictEqual(fixed(path.bytes / fat.bytes), '2.05');
  assert.strictEqual(fixed(path.bytes / node.bytes), '1.23');
  assert.strictEqual(fixed(path.nodesPerUpdate / node.nodesPerUpdate, 1), '2.6');
  quotes('persistence-basics', ['35× less than copying', '2.05× smaller than path copying',
    '2.6× fewer allocations than path copying, at 1.23× less memory']);
});

test('persistence-basics: the read path - 8.61 probes, and 16.66 for fat nodes', function () {
  const probes = VersionLab.readProbes({});
  const byStrategy = {};
  probes.forEach(function (row) { byStrategy[row.strategy] = row; });

  assert.strictEqual(byStrategy['path-copying'].queries, 2000);
  ['path-copying', 'node-copying'].forEach(function (name) {
    assert.strictEqual(fixed(byStrategy[name].comparisons), '8.61');
    assert.strictEqual(byStrategy[name].versionLookups, 0);
    assert.strictEqual(fixed(byStrategy[name].probes), '8.61');
  });

  const fat = byStrategy['fat-node'];
  assert.strictEqual(fixed(fat.comparisons), '8.61');
  assert.strictEqual(fixed(fat.versionLookups), '8.05');
  assert.strictEqual(fixed(fat.probes), '16.66');
  assert.strictEqual(fixed(fat.probes / byStrategy['path-copying'].probes), '1.94');
  assert.strictEqual(fixed(Math.log2(400), 1), '8.6');

  quotes('persistence-basics', ['8.61 key comparisons per query', '8.05 version-list binary searches',
    '16.66 probes per query - 1.94× the other two', 'log₂ 400 = 8.6',
    'fat nodes save 2.05× the memory and cost 1.94× the read']);
});

test('persistence-basics: the side-by-side table is the two measurements, not a third', function () {
  const probes = {};
  VersionLab.readProbes({}).forEach(function (row) { probes[row.strategy] = row.probes; });

  const rows = [
    { text: 'path copying: 156 720 bytes,  8.61 probes', bytes: 156720, strategy: 'path-copying' },
    { text: 'node copying: 126 944 bytes,  8.61 probes', bytes: 126944, strategy: 'node-copying' },
    { text: 'fat nodes:     76 448 bytes, 16.66 probes', bytes: 76448, strategy: 'fat-node' }
  ];

  rows.forEach(function (row) {
    assert.strictEqual(strategy(row.strategy).shape.bytes, row.bytes);
    assert.ok(row.text.indexOf(grouped(row.bytes)) !== -1, 'the table row misquotes its own byte count');
    assert.ok(row.text.indexOf(fixed(probes[row.strategy])) !== -1, 'the table row misquotes its own probes');
    quotes('persistence-basics', row.text);
  });
});

/* ---------------------------------------------- 9.2 persistent-sequences */

const reuse = VersionLab.queueReuse({ size: QUEUE_SIZE, reuses: REUSES });
const timeline = VersionLab.queueTimeline({ size: QUEUE_SIZE });

function queue(rows, kind) {
  const row = rows.filter(function (item) { return item.kind === kind; })[0];
  assert.ok(row, 'no ' + kind + ' row');
  return row;
}

test('persistent-sequences: reusing one version re-pays the strict rotation every time', function () {
  const strict = queue(reuse, 'strict');

  assert.strictEqual(strict.steps, 510000);
  assert.strictEqual(fixed(strict.stepsPerReuse), '510.00');
  assert.strictEqual(strict.worstOperation, 510);
  quotes('persistent-sequences', ['510 000 steps for 1 000 calls', '510.00 steps per reuse',
    'worst single operation: 510']);
});

test('persistent-sequences: the memo pays the rotation once - 1 502 steps, 8 forcings', function () {
  const banker = queue(reuse, 'banker');
  const strict = queue(reuse, 'strict');

  assert.strictEqual(banker.steps, 1502);
  assert.strictEqual(banker.suspensionsForced, 8);
  assert.strictEqual(banker.memoHits, 1518);
  assert.strictEqual(fixed(banker.stepsPerReuse), '1.50');
  assert.strictEqual(banker.worstOperation, 503);
  assert.strictEqual(fixed(strict.stepsPerReuse / banker.stepsPerReuse, 0), '340');
  quotes('persistent-sequences', ['1 502 steps for the same 1 000 calls',
    'the suspension is forced 8 times and the memo is hit 1 518 times', '1.50 steps per reuse',
    '340× less work for the identical sequence of calls', 'the first to force it pays 503 steps']);
});

test('persistent-sequences: the real-time queue is 1.00 per reuse and 1 in the worst case', function () {
  const realtime = queue(reuse, 'realtime');

  assert.strictEqual(fixed(realtime.stepsPerReuse), '1.00');
  assert.strictEqual(realtime.worstOperation, 1);
  quotes('persistent-sequences', ['1.00 steps per reuse, worst operation 1']);
});

test('persistent-sequences: under linear use all three average about one step', function () {
  assert.strictEqual(timeline.length, 3);
  timeline.forEach(function (row) { assert.strictEqual(row.series.length, 2 * QUEUE_SIZE); });

  assert.strictEqual(fixed(queue(timeline, 'strict').mean), '1.49');
  assert.strictEqual(fixed(queue(timeline, 'banker').mean), '1.49');
  assert.strictEqual(fixed(queue(timeline, 'realtime').mean), '1.00');
  quotes('persistent-sequences', ['mean steps per operation over 1 024 operations',
    'strict 1.49, banker 1.49, real-time 1.00']);
});

test('persistent-sequences: the banker spike (1 014) is larger than the one it fixed (511)', function () {
  const strict = queue(timeline, 'strict').worst;
  const banker = queue(timeline, 'banker').worst;
  const realtime = queue(timeline, 'realtime').worst;

  assert.strictEqual(strict, 511);
  assert.strictEqual(banker, 1014);
  assert.strictEqual(realtime, 2);
  assert.ok(banker > strict, 'the claim the example makes is that deferral moves the spike, not that it shrinks it');
  quotes('persistent-sequences', ['strict:     511 steps in one operation',
    'banker:   1 014 steps in one operation', 'real-time:    2 steps',
    '2 rotations coming due together are forced by 1 operation: 1 014 steps, the worst in the run',
    '2 steps in the worst case over the whole run']);
});

/* ------------------------------------------------- 9.3 versioned-queries */

const versioned = VersionLab.versionedQueries({ size: 1024, updates: 500 });

test('versioned-queries: exactly 11 nodes per update, which is the ceil(log2 n) + 1 bound', function () {
  assert.strictEqual(Math.ceil(Math.log2(1024)) + 1, 11);
  assert.strictEqual(versioned.shape.depthBound, 11);
  assert.strictEqual(versioned.shape.nodesPerUpdate, 11);
  assert.strictEqual(versioned.shape.distinctNodes, 7547);
  assert.strictEqual(fixed((7547 - 2047) / 500), '11.00');
  assert.strictEqual(2 * 1024 - 1, 2047);
  quotes('versioned-queries', ['⌈log₂ 1 024⌉ + 1 = 11 nodes',
    '500 updates, 7 547 distinct nodes in total',
    'initial tree 2 047 nodes; (7 547 − 2 047) / 500 = 11.00']);
});

test('versioned-queries: every one of the 501 versions answers correctly', function () {
  assert.strictEqual(versioned.wrong, 0);
  assert.strictEqual(versioned.checks, 2004);
  quotes('versioned-queries', ['2 004 range-sum queries across all 501 versions', '0 disagreements']);
});

test('versioned-queries: 241 504 bytes of shared history against 32 817 504 copied', function () {
  assert.strictEqual(versioned.shape.bytes, 241504);
  assert.strictEqual(versioned.shape.bytesIfCopied, 32817504);
  assert.strictEqual(501 * 2047 * 32, 32817504);
  assert.strictEqual(fixed(versioned.savingAgainstCopying, 1), '135.9');
  quotes('versioned-queries', ['shared:  241 504 bytes for 501 versions',
    'copied: 32 817 504 bytes (501 × 2 047 nodes × 32)', '135.9× less']);
});

test('versioned-queries: one version per prefix costs 10.98 nodes per value', function () {
  const quantiles = VersionLab.rangeQuantiles({ size: 512, domain: 1000, probes: 300 });

  assert.strictEqual(quantiles.shape.versions, 512);
  assert.strictEqual(quantiles.shape.versions + 1, 513, 'the empty prefix is a version too');
  assert.strictEqual(fixed(quantiles.shape.nodesPerValue), '10.98');
  assert.strictEqual(quantiles.shape.distinctNodes, 5622);
  assert.strictEqual(quantiles.shape.bytes, 179904);
  quotes('versioned-queries', ['512 values, 513 versions, 10.98 nodes allocated per value',
    '5 622 distinct nodes, 179 904 bytes']);
});

test('versioned-queries: the k-th smallest costs 10.0 descents and is never wrong', function () {
  const quantiles = VersionLab.rangeQuantiles({ size: 512, domain: 1000, probes: 300 });

  assert.strictEqual(quantiles.wrong, 0);
  assert.strictEqual(quantiles.probes, 300);
  assert.strictEqual(fixed(quantiles.descentsPerQuery, 1), '10.0');
  assert.strictEqual(quantiles.shape.depthBound, 11);
  assert.ok(quantiles.descentsPerQuery <= quantiles.shape.depthBound, 'a descent cannot exceed the depth bound');
  quotes('versioned-queries', ['10.0 descents per query - ⌈log₂ 1 000⌉ + 1 = 11 is the bound',
    '0 wrong of 300 queries against a sorted slice']);
});

test('versioned-queries: the M08 comparison it quotes is still what M08 measures', function () {
  const order = RangeLab.orderStatisticRun({ n: 8192, count: 2000, seed: 6 });

  assert.strictEqual(order.mismatches, 0);
  assert.strictEqual(fixed(order.nodesPerQuery), '44.85');
  assert.strictEqual(fixed(order.comparisonsPerQuery), '57.78');
  quotes('versioned-queries', ['merge-sort tree: counts values below x, 44.85 nodes and 57.78 comparisons per query',
    'a harder question answered in a fifth of the work']);
});
