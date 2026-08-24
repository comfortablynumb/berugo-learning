'use strict';

/**
 * Every figure the M21.4-M21.6 content quotes, recomputed from the harnesses
 * and then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const OnlineLab = require('../../src/js/machines/online-lab.js');
const DamLab = require('../../src/js/machines/dam-lab.js');

require('../../src/js/content/concepts-external.js');
require('../../src/js/content/examples-external.js');
const prose = require('../support/worked-example-prose.js');

function byPolicy(rows, policy) {
  return rows.filter(function (row) { return row.policy === policy; })[0];
}

/* ------------------------------------------------------- 21.4 bin packing */

test('bin-packing: five policies against the LP lower bound at the demo default', function () {
  const study = OnlineLab.packingStudy({ count: 200, seed: 1 });
  const bins = function (policy) { return byPolicy(study.rows, policy).bins; };
  const ratio = function (policy) { return prose.fixed(byPolicy(study.rows, policy).ratio, 4); };

  assert.strictEqual(study.rows[0].lowerBound, 63, 'the LP bound on this workload');
  assert.strictEqual(bins('next-fit'), 80);
  assert.strictEqual(bins('worst-fit'), 72);
  assert.strictEqual(bins('first-fit'), 65);
  assert.strictEqual(bins('best-fit'), 65);
  assert.strictEqual(bins('first-fit-decreasing'), 64);

  assert.strictEqual(ratio('next-fit'), '1.2698');
  assert.strictEqual(ratio('worst-fit'), '1.1429');
  assert.strictEqual(ratio('first-fit'), '1.0317');
  assert.strictEqual(ratio('first-fit-decreasing'), '1.0159');

  assert.strictEqual(prose.fixed(byPolicy(study.rows, 'next-fit').utilisation * 100, 1), '78.4');
  assert.strictEqual(prose.fixed(byPolicy(study.rows, 'first-fit').utilisation * 100, 1), '96.5');
  assert.strictEqual(prose.fixed(byPolicy(study.rows, 'first-fit-decreasing')
    .utilisation * 100, 1), '98.0');

  prose.quotes('bin-packing', ['80', '72', '65', '64', '63', '1.2698', '1.1429', '1.0317',
    '1.0159', '78.4%', '96.5%', '98.0%']);
});

test('bin-packing: the guarantees checked against EXACT optima, not the lower bound', function () {
  const study = OnlineLab.packingExactStudy({});

  assert.strictEqual(prose.fixed(study.firstFitWorst, 4), '1.2500');
  assert.strictEqual(prose.fixed(study.decreasingWorst, 4), '1.2000');
  assert.ok(study.decreasingWorst <= 11 / 9, 'FFD must be inside 11/9 = 1.2222');
  assert.strictEqual(prose.fixed(study.bound, 4), '1.2222');

  prose.quotes('bin-packing', ['1.2500', '1.2000', '1.2222', '25']);
});

test('bin-packing: the tight family holds first-fit at 5/3 and sorting is exactly optimal', function () {
  const study = OnlineLab.packingTrapStudy({});
  const last = study.rows[study.rows.length - 1];

  study.rows.forEach(function (row) {
    assert.strictEqual(prose.fixed(row.firstFitRatio, 4), '1.6667',
      'the family must hold first-fit at 5/3 at every size, including ' + row.groups);
    assert.strictEqual(prose.fixed(row.decreasingRatio, 4), '1.0000',
      'sorted, it packs perfectly at ' + row.groups + ' groups');
  });
  assert.strictEqual(last.groups, 48);
  assert.strictEqual(last.firstFit, 80);
  assert.strictEqual(last.optimum, 48);

  prose.quotes('bin-packing', ['1.6667', '1.0000', '80 bins', '48']);
});

test('bin-packing: the second axis costs every policy and collapses the offline advantage', function () {
  const study = OnlineLab.twoDimensionStudy({ count: 200, seed: 1, skew: 0.8 });
  const one = function (policy) { return prose.fixed(byPolicy(study.oneDimension, policy).ratio, 4); };
  const two = function (policy) { return prose.fixed(byPolicy(study.twoDimensions, policy).ratio, 4); };

  assert.strictEqual(one('first-fit-decreasing'), '1.1154');
  assert.strictEqual(one('worst-fit'), '1.1795');
  assert.strictEqual(two('first-fit-decreasing'), '1.1964');
  assert.strictEqual(two('worst-fit'), '1.2143');
  assert.strictEqual(two('next-fit'), '1.3929');

  const gapOne = Number(one('worst-fit')) - Number(one('first-fit-decreasing'));
  const gapTwo = Number(two('worst-fit')) - Number(two('first-fit-decreasing'));

  assert.ok(gapTwo < gapOne, 'sorting must lose most of its advantage on the second axis');

  const firstFit = byPolicy(study.twoDimensions, 'first-fit');

  assert.strictEqual(firstFit.lopsided, 20);
  assert.strictEqual(firstFit.bins, 68);
  assert.strictEqual(prose.fixed(firstFit.cpuUtilisation * 100, 1), '76.7');
  assert.strictEqual(prose.fixed(firstFit.memUtilisation * 100, 1), '82.1');

  prose.quotes('bin-packing', ['1.1154', '1.1795', '1.1964', '1.2143', '1.3929',
    '20 of 68', '76.7%', '82.1%']);
});

/* --------------------------------------------------- 21.5 external memory */

test('external-memory: the sort matches its closed form at four settings', function () {
  const expected = [
    { M: 64, B: 16, runs: 128, fanOut: 3, passes: 5, transfers: 6144 },
    { M: 128, B: 16, runs: 64, fanOut: 7, passes: 3, transfers: 4096 },
    { M: 256, B: 32, runs: 32, fanOut: 7, passes: 2, transfers: 1536 },
    { M: 1024, B: 64, runs: 8, fanOut: 15, passes: 1, transfers: 512 }
  ];

  const study = DamLab.sortStudy({ n: 8192 });

  assert.strictEqual(study.rows.length, expected.length, 'the demo sweeps four (M, B) settings');
  expected.forEach(function (spec, i) {
    const row = study.rows[i];

    assert.strictEqual(row.M, spec.M, 'row ' + i + ': memory');
    assert.strictEqual(row.B, spec.B, 'row ' + i + ': block size');
    assert.strictEqual(row.runs, spec.runs, 'M=' + spec.M + ': initial runs');
    assert.strictEqual(row.fanOut, spec.fanOut, 'M=' + spec.M + ': fan-out');
    assert.strictEqual(row.passes, spec.passes, 'M=' + spec.M + ': merge passes');
    assert.strictEqual(row.transfers, spec.transfers, 'M=' + spec.M + ': measured transfers');
    assert.strictEqual(row.predicted, spec.transfers, 'M=' + spec.M + ': predicted transfers');
    assert.strictEqual(prose.fixed(row.ratio, 4), '1.0000', 'M=' + spec.M + ': measured ÷ predicted');
    assert.strictEqual(row.peakHeld, spec.M, 'the budget is held to exactly M');
    assert.strictEqual(row.sorted, true, 'and the output is sorted');
  });

  prose.quotes('external-memory', ['6 144', '4 096', '1 536', '512', '1.0000',
    '128', '64', '32', '8']);
});

test('external-memory: the bounds table at the demo default', function () {
  const table = DamLab.boundsTable({ M: 4096, B: 64 });
  const row = table.rows[table.rows.length - 1];

  assert.strictEqual(row.n, 1e8, 'the last row is a hundred million records');
  assert.strictEqual(prose.grouped(row.scan), '1 562 500');
  assert.strictEqual(prose.grouped(row.sort), '12 500 000');
  assert.strictEqual(prose.fixed(row.search, 2), '4.43');
  table.rows.forEach(function (each) {
    assert.strictEqual(prose.fixed(each.naiveOverScan, 0), '64',
      'the naive-over-scan ratio is B in every row');
  });
  assert.strictEqual(prose.fixed(table.rows[0].search, 2), '2.21');

  prose.quotes('external-memory', ['1 562 500', '12 500 000', '4.43', '2.21', '64×']);
});

test('external-memory: a nested-loop join against a sort-merge, four sizes', function () {
  const study = DamLab.joinStudy({});
  const last = study.rows[study.rows.length - 1];

  assert.strictEqual(last.n, 128000);
  assert.strictEqual(last.nested, 128000, 'the nested loop is one transfer per row');
  assert.strictEqual(last.merge, 20000);
  assert.strictEqual(last.sortPart, 16000);
  assert.strictEqual(last.walkPart, 4000);
  assert.strictEqual(prose.fixed(last.ratio, 2), '6.40');
  assert.ok(last.sortPart > last.walkPart * 3, 'sorting must dominate the sort-merge cost');
  assert.strictEqual(study.rows[0].nested, 2000);
  assert.strictEqual(study.rows[0].n, 2000);
  assert.strictEqual(study.rows[0].merge, 192);

  prose.quotes('external-memory', ['128 000', '20 000', '16 000', '4 000', '6.40', '192']);
});

/* -------------------------------------------------- 21.6 cache-oblivious */

test('cache-oblivious: the best tile is retuned at every cache size', function () {
  const study = DamLab.multiplyStudy({ n: 64, cutoff: 8 });
  const tiles = study.rows.map(function (row) { return row.bestTile; });

  assert.deepStrictEqual(tiles, [8, 16, 32, 4], 'the tuned parameter changes at all four sizes');
  assert.deepStrictEqual(study.rows.map(function (row) { return row.bestTiled; }),
    [8704, 6144, 3072, 1536]);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.recursive; }),
    [10240, 8192, 4096, 2048]);
  assert.strictEqual(prose.fixed(study.rows[0].obliviousPenalty, 3), '1.176');
  study.rows.slice(1).forEach(function (row) {
    assert.strictEqual(prose.fixed(row.obliviousPenalty, 3), '1.333');
  });
  assert.strictEqual(study.rows[0].naive, 295424);
  assert.deepStrictEqual(study.rows.map(function (row) { return row.kilobytes; }), [2, 4, 16, 64]);

  prose.quotes('cache-oblivious', ['8 704', '6 144', '3 072', '1 536', '10 240', '8 192',
    '4 096', '2 048', '1.176', '1.333', '295 424']);
});

test('cache-oblivious: the transpose is where the strided side misses on every element', function () {
  const study = DamLab.transposeStudy({ n: 256, caches: [256] });
  const row = study.rows[0];

  assert.strictEqual(row.kilobytes, 16, 'a 16-kilobyte cache');
  assert.strictEqual(row.naive, 73728);
  assert.strictEqual(row.bestTiled, 16384);
  assert.strictEqual(row.recursive, 16384, 'the recursion matches the tuned version exactly here');

  prose.quotes('cache-oblivious', ['73 728', '16 384']);
});

test('cache-oblivious: three layouts, identical comparisons, half the misses', function () {
  const study = DamLab.layoutStudy({ heights: [10, 14, 18] });
  const row = function (height) {
    return study.rows.filter(function (r) { return r.height === height; })[0];
  };

  study.rows.forEach(function (r) {
    assert.strictEqual(prose.fixed(r.comparisons, 1), prose.fixed(r.height, 1),
      'the comparison count is the tree height in every layout');
  });
  assert.strictEqual(prose.fixed(row(10).levelOrder, 2), '1.97');
  assert.strictEqual(prose.fixed(row(10).veb, 2), '2.36');
  assert.ok(row(10).veb > row(10).levelOrder,
    'with the whole tree resident the vEB order must be slightly WORSE');
  assert.strictEqual(prose.fixed(row(18).levelOrder, 2), '11.95');
  assert.strictEqual(prose.fixed(row(18).sortedArray, 2), '12.00');
  assert.strictEqual(prose.fixed(row(18).veb, 2), '6.65');
  assert.strictEqual(prose.fixed(row(18).saving, 2), '1.80');
  assert.strictEqual(prose.fixed(row(18).predicted, 2), '6.00');

  prose.quotes('cache-oblivious', ['1.97', '2.36', '11.95', '12.00', '6.65', '1.80', '6.00',
    '18.0']);
});
