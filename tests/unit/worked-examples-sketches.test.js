'use strict';

/**
 * Every figure quoted in the M07.1-M07.3 worked examples, recomputed here from
 * the example's own setup and asserted against the text that teaches it.
 *
 * The recipes mirror the section demos - same key counts, same probe counts,
 * same seeds - so a module change that moves a number fails the build instead
 * of quietly making the prose wrong.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-sketches.js');

const BloomFilter = require('../../src/js/algorithms/bloom-filter.js');
const FilterLab = require('../../src/js/machines/filter-lab.js');
const StreamLab = require('../../src/js/machines/stream-lab.js');

function example(sectionId, index) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[index || 0], 'missing worked example for ' + sectionId);
  return entries[index || 0];
}

function text(entry) {
  return entry.steps.map(function (step) {
    return step.work + '\n' + (step.result || '');
  }).join('\n') + '\n' + entry.answer;
}

/** Asserts that every string still appears somewhere in the example. */
function quotes(entry, fragments) {
  const body = text(entry);
  fragments.forEach(function (fragment) {
    assert.ok(body.indexOf(fragment) !== -1, 'the example no longer quotes "' + fragment + '"');
  });
}

function keysFor(count, prefix) {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) out[i] = (prefix || 'key-') + i;
  return out;
}

/* -------------------------------------------------------- bloom filters */

test('bloom-filters: the sizing arithmetic is 95 851 bits, k = 7 and 1.004%', function () {
  const entry = example('bloom-filters');
  const shape = BloomFilter.optimalParams({ n: 10000, p: 0.01 });

  assert.strictEqual(shape.m, 95851);
  assert.strictEqual(shape.k, 7);
  assert.strictEqual(Math.ceil(shape.m / 8), 11982);
  assert.strictEqual(shape.bitsPerKey.toFixed(3), '9.585');
  assert.strictEqual(((shape.m / 10000) * Math.LN2).toFixed(3), '6.644');
  assert.strictEqual((shape.predictedFpr * 100).toFixed(3), '1.004');

  quotes(entry, ['95 851 bits', '11 982 bytes', 'k = 7, rounded from 6.643', '1.004%, not 1.000%']);
});

test('bloom-filters: the filter measures 1.010% and 49 751 set bits at the sizing point', function () {
  const entry = example('bloom-filters');
  const shape = BloomFilter.optimalParams({ n: 10000, p: 0.01 });
  const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: 11 });
  keysFor(10000).forEach(filter.add);

  const measured = StreamLab.measureFpr({ filter: filter, absent: StreamLab.absentKeys({ count: 20000 }) });

  assert.strictEqual(filter.setBits(), 49751);
  assert.strictEqual((filter.fill() * 100).toFixed(1), '51.9');
  assert.strictEqual(measured.hits, 202);
  assert.strictEqual((measured.rate * 100).toFixed(3), '1.010');
  assert.strictEqual(StreamLab.falseNegatives({ filter: filter, present: keysFor(10000) }), 0);

  quotes(entry, ['bits set: 49 751 of 95 851', '51.9% full', 'false positives: 202 of 20 000 = 1.010%',
    'false negatives: 0 of 10 000']);
});

test('bloom-filters: 64 KB holds 109 396, 54 698 and 36 465 keys', function () {
  const entry = example('bloom-filters', 1);
  const bits = 64 * 1024 * 8;

  assert.strictEqual(bits, 524288);
  [[0.1, 4.79, 109396], [0.01, 9.59, 54698], [0.001, 14.38, 36465]].forEach(function (row) {
    const perKey = -Math.log(row[0]) / (Math.LN2 * Math.LN2);
    assert.strictEqual(perKey.toFixed(2), row[1].toFixed(2), 'bits per key at ' + row[0]);
    assert.strictEqual(Math.floor(bits / perKey), row[2], 'capacity at ' + row[0]);
  });

  quotes(entry, ['64 KB = 524 288 bits', '109 396 keys', '54 698 keys', '36 465 keys']);
});

test('bloom-filters: the error doubles at 1.16n and is tenfold at 1.74n', function () {
  const entry = example('bloom-filters', 1);
  const shape = BloomFilter.optimalParams({ n: 10000, p: 0.01 });

  function nAt(target) {
    let low = 1;
    let high = 200000;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (BloomFilter.fprFor({ m: shape.m, k: shape.k, n: mid }) < target) low = mid; else high = mid;
    }
    return high;
  }

  assert.strictEqual(nAt(0.02), 11616);
  assert.strictEqual(nAt(0.05), 14448);
  assert.strictEqual(nAt(0.10), 17416);
  assert.strictEqual((11616 / 10000).toFixed(2), '1.16');
  assert.strictEqual((14448 / 10000).toFixed(2), '1.44');
  assert.strictEqual((17416 / 10000).toFixed(2), '1.74');

  quotes(entry, ['n = 11 616', '5%:  n = 14 448 = 1.44n', '10%: n = 17 416 = 1.74n',
    'alert when inserts > 1.16 × the n the filter was sized for']);
});

/* ------------------------------------------------------- bloom variants */

test('bloom-variants: blocked measures 1.204% against 0.992% at 1.00 lines per query', function () {
  const entry = example('bloom-variants');
  const comparison = FilterLab.compareVariants({ n: 20000, p: 0.01, seed: 7, probes: 50000 });
  const byId = {};
  comparison.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(comparison.shape.m, 191702);
  assert.strictEqual(comparison.shape.k, 7);
  assert.strictEqual((byId.standard.measured * 100).toFixed(3), '0.992');
  assert.strictEqual((byId.blocked.measured * 100).toFixed(3), '1.204');
  assert.strictEqual(byId.standard.linesPerQuery.toFixed(2), '6.95');
  assert.strictEqual(byId.blocked.linesPerQuery.toFixed(2), '1.00');
  assert.strictEqual((byId.blocked.measured / byId.standard.measured).toFixed(2), '1.21');
  assert.strictEqual(byId.standard.bytes, 23963);

  quotes(entry, ['6.95 lines measured', 'standard: 0.992%', 'blocked:  1.204%', '1.21× the error']);
});

test('bloom-variants: the block sweep is monotone from 2.536x down to 0.952x', function () {
  const entry = example('bloom-variants');
  const sweep = FilterLab.blockSweep({ n: 20000, p: 0.01, seed: 7, probes: 50000 });
  const byBlock = {};
  sweep.rows.forEach(function (row) { byBlock[row.blockBits] = row; });

  assert.strictEqual(sweep.rows.length, 6);
  assert.strictEqual(byBlock[64].inflation.toFixed(3), '2.556');
  assert.strictEqual(byBlock[128].inflation.toFixed(3), '1.679');
  assert.strictEqual(byBlock[256].inflation.toFixed(3), '1.365');
  assert.strictEqual(byBlock[512].inflation.toFixed(3), '1.214');
  assert.strictEqual(byBlock[1024].inflation.toFixed(3), '1.083');
  assert.strictEqual(byBlock[4096].inflation.toFixed(3), '0.952');
  assert.strictEqual(byBlock[374] === undefined, true, 'blocks are powers of two');
  assert.strictEqual(byBlock[512].blocks, 374);

  quotes(entry, ['374 blocks', '128: 1.679×', ' 512 bits: 1.214×', '4096: 0.952×']);
});

test('bloom-variants: 1 024 and 4 096-bit blocks cost 2 and 8 cache lines', function () {
  const entry = example('bloom-variants', 1);
  const sweep = FilterLab.blockSweep({ n: 20000, p: 0.01, seed: 7, probes: 50000 });
  const byBlock = {};
  sweep.rows.forEach(function (row) { byBlock[row.blockBits] = row; });

  assert.strictEqual(byBlock[1024].linesPerQuery.toFixed(2), '2.00');
  assert.strictEqual(byBlock[4096].linesPerQuery.toFixed(2), '8.00');
  assert.strictEqual((byBlock[1024].measured * 100).toFixed(3), '1.074');
  assert.strictEqual((byBlock[4096].measured * 100).toFixed(3), '0.944');

  quotes(entry, ['1024 bits: 1.074%', '4096 bits: 0.944%', '1024 bits = 128 bytes = 2.00 lines',
    '4096 bits = 512 bytes = 8.00 lines']);
});

test('bloom-variants: the counting filter is 95 851 bytes and unchanged in error and lines', function () {
  const entry = example('bloom-variants', 1);
  const comparison = FilterLab.compareVariants({ n: 20000, p: 0.01, seed: 7, probes: 50000 });
  const byId = {};
  comparison.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId.counting.bytes, 95851);
  assert.strictEqual(byId.standard.bytes, 23963);
  assert.strictEqual((byId.counting.measured * 100).toFixed(2), '0.99');
  assert.strictEqual(byId.counting.linesPerQuery.toFixed(2), '6.99');
  assert.strictEqual(byId.scalable.linesPerQuery.toFixed(2), '9.11');

  quotes(entry, ['counting, 4-bit: 95 851 bytes against 23 963', 'error unchanged at 0.99%',
    'lines per query 6.99', 'paid for on the miss path (9.11 lines)']);
});

/* --------------------------------------------------- fingerprint filters */

test('fingerprint-filters: the fill stops at 7 957 inserts and 97.14% load', function () {
  const entry = example('fingerprint-filters');
  const profile = FilterLab.chainProfile({ capacity: 8192, bucketSize: 4, fingerprintBits: 8, maxKicks: 500, seed: 5 });
  const free = profile.histogram.filter(function (row) { return row.length === 0; })[0];

  assert.strictEqual(profile.inserted, 7957);
  assert.strictEqual((profile.load * 100).toFixed(2), '97.14');
  assert.strictEqual(free.count, 6876);
  assert.strictEqual((100 * free.count / profile.inserted).toFixed(1), '86.4');
  assert.strictEqual(profile.meanChain.toFixed(2), '1.94');
  assert.strictEqual(profile.longest.length, 408);
  assert.strictEqual(profile.longest.at, 7921);
  assert.strictEqual(Math.round(408 / 1.94), 210, 'the worst insert is 210x the mean');

  quotes(entry, ['inserts accepted: 7 957', '97.14% load', 'no eviction at all: 6 876 of 7 957 = 86.4%',
    'mean kicks per insert: 1.94', 'longest chain in the fill: 408, at insert 7 921']);
});

test('fingerprint-filters: the fingerprint width sets the error and not the load', function () {
  const entry = example('fingerprint-filters');
  const sweep = FilterLab.cuckooSweep({
    capacity: 8192, bucketSize: 4, seed: 5, probes: 50000, fingerprintBits: [6, 8, 10, 12, 14]
  });
  const byBits = {};
  sweep.forEach(function (row) { byBits[row.fingerprintBits] = row; });

  assert.strictEqual((byBits[6].load * 100).toFixed(2), '96.02');
  assert.strictEqual((byBits[8].load * 100).toFixed(2), '97.14');
  assert.strictEqual((byBits[10].load * 100).toFixed(2), '97.14');
  assert.strictEqual((byBits[12].load * 100).toFixed(2), '97.07');

  assert.strictEqual((byBits[6].measured * 100).toFixed(3), '11.872');
  assert.strictEqual((byBits[8].measured * 100).toFixed(3), '2.978');
  assert.strictEqual((byBits[10].measured * 100).toFixed(3), '0.678');
  assert.strictEqual((byBits[12].measured * 100).toFixed(3), '0.200');
  assert.strictEqual((byBits[14].measured * 100).toFixed(3), '0.052');
  assert.strictEqual(byBits[8].bitsPerItem.toFixed(2), '8.24');

  quotes(entry, ['f =  6: load 96.02%   f =  8: 97.14%', 'f =  6: 11.872%   f =  8: 2.978%',
    'f = 10:  0.678%   f = 12: 0.200%   f = 14: 0.052%']);
});

test('fingerprint-filters: the bucket width is what sets the load ceiling', function () {
  const entry = example('fingerprint-filters');
  const sweep = FilterLab.bucketSweep({ capacity: 8192, fingerprintBits: 8, seed: 5 });
  const byBucket = {};
  sweep.forEach(function (row) { byBucket[row.bucketSize] = row; });

  assert.strictEqual((byBucket[1].load * 100).toFixed(2), '49.77');
  assert.strictEqual((byBucket[2].load * 100).toFixed(2), '88.04');
  assert.strictEqual((byBucket[4].load * 100).toFixed(2), '97.14');
  assert.strictEqual((byBucket[8].load * 100).toFixed(2), '99.32');

  quotes(entry, ['b = 1: 49.77%   b = 2: 88.04%', 'b = 4: 97.14%   b = 8: 99.32%']);
});

test('fingerprint-filters: the Bloom/cuckoo crossover is near 0.5% achieved error', function () {
  const entry = example('fingerprint-filters', 1);

  function bloomBits(p) { return -Math.log(p) / (Math.LN2 * Math.LN2); }
  function achieved(f) { return 1 - Math.pow(1 - Math.pow(2, -f), 2 * 4 * 0.95); }

  assert.strictEqual((achieved(10) * 100).toFixed(3), '0.740');
  assert.strictEqual((achieved(11) * 100).toFixed(3), '0.370');
  assert.strictEqual((achieved(12) * 100).toFixed(3), '0.185');
  assert.strictEqual((10 / 0.95).toFixed(2), '10.53');
  assert.strictEqual(bloomBits(achieved(10)).toFixed(2), '10.21');
  assert.strictEqual((11 / 0.95).toFixed(2), '11.58');
  assert.strictEqual(bloomBits(achieved(11)).toFixed(2), '11.65');
  assert.strictEqual((8 / 0.95).toFixed(2), '8.42');
  assert.strictEqual(bloomBits(achieved(8)).toFixed(2), '7.35');
  assert.strictEqual((13 / 0.95).toFixed(2), '13.68');
  assert.strictEqual(bloomBits(achieved(13)).toFixed(2), '14.53');

  quotes(entry, ['f = 10 achieves 0.740%', 'f = 10: cuckoo 10.53 bits, Bloom at 0.740% costs 10.21',
    'f = 11: cuckoo 11.58 bits, Bloom at 0.370% costs 11.65',
    'f = 13: cuckoo 13.68, Bloom 14.53 — cuckoo by 6%']);
});

test('fingerprint-filters: the quotient filter is never the smallest of the three', function () {
  const entry = example('fingerprint-filters', 1);

  function bloomBits(p) { return -Math.log(p) / (Math.LN2 * Math.LN2); }

  assert.strictEqual(((0.75 / Math.pow(2, 7)) * 100).toFixed(3), '0.586');
  assert.strictEqual((10 / 0.75).toFixed(2), '13.33');
  assert.strictEqual(bloomBits(0.75 / Math.pow(2, 7)).toFixed(2), '10.70');
  assert.strictEqual(((0.75 / Math.pow(2, 10)) * 100).toFixed(3), '0.073');
  assert.strictEqual((13 / 0.75).toFixed(2), '17.33');
  assert.strictEqual(bloomBits(0.75 / Math.pow(2, 10)).toFixed(2), '15.03');

  quotes(entry, ['r =  7: 13.33 bits at 0.586%, where Bloom costs 10.70',
    'r = 10: 17.33 bits at 0.073%, where Bloom costs 15.03']);
});

test('fingerprint-filters: the phantom-delete damage is one key per accepted delete', function () {
  const phantom = FilterLab.phantomDeletes({ n: 4000, seed: 3, fingerprintBits: 8 });

  assert.strictEqual(phantom.accepted, 59);
  assert.strictEqual(phantom.falseNegatives, 59);
  assert.strictEqual(phantom.ghosts, 4000);
});
