'use strict';

/**
 * Every figure quoted in the M07.4-M07.6 worked examples, recomputed here from
 * the example's own setup and asserted against the text that teaches it.
 *
 * The recipes mirror the section demos exactly - same stream generator, same
 * seeds, same sketch parameters - so a change that moves a number fails here
 * rather than leaving the prose quietly wrong.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-sketches-counting.js');

const HyperLogLog = require('../../src/js/algorithms/hyperloglog.js');
const CountMin = require('../../src/js/algorithms/count-min.js');
const StreamLab = require('../../src/js/machines/stream-lab.js');
const SketchLab = require('../../src/js/machines/sketch-lab.js');

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

function quotes(entry, fragments) {
  const body = text(entry);
  fragments.forEach(function (fragment) {
    assert.ok(body.indexOf(fragment) !== -1, 'the example no longer quotes "' + fragment + '"');
  });
}

/** The one stream every M07.4 and M07.5 demo runs. */
function zipfStream() {
  return StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
}

/* --------------------------------------------------------- hyperloglog */

test('hyperloglog: the stream holds 21 619 distinct keys and p = 12 estimates 21 665', function () {
  const entry = example('hyperloglog');
  const stream = zipfStream();
  const track = SketchLab.cardinalityTrack({ items: stream.items, precision: 12, seed: 3 });

  assert.strictEqual(stream.distinct, 21619);
  assert.strictEqual(Math.round(track.estimate), 21665);
  assert.strictEqual((track.relativeError * 100).toFixed(2), '0.21');
  assert.strictEqual((track.sigma * 100).toFixed(2), '1.63');
  assert.strictEqual((Math.abs(track.relativeError) / track.sigma).toFixed(2), '0.13');
  assert.strictEqual(Math.round(track.estimate) - stream.distinct, 46);

  quotes(entry, ['exact:    21 619 distinct keys', 'estimate: 21 665', 'error:    +46 = +0.21%',
    '0.13σ — well inside the claim']);
});

test('hyperloglog: the sizing arithmetic gives p = 12 and 3 072 packed bytes', function () {
  const entry = example('hyperloglog');
  const sketch = HyperLogLog.create({ precision: 12, seed: 3 });

  assert.strictEqual(Math.round(Math.pow(1.04 / 0.02, 2)), 2704);
  assert.strictEqual(sketch.m(), 4096);
  assert.strictEqual(sketch.packedBytes(), 3072);
  assert.strictEqual((sketch.standardError() * 100).toFixed(2), '1.63');
  assert.strictEqual(HyperLogLog.precisionFor(0.02), 12);

  quotes(entry, ['for σ = 2%: m = 2 704 → round up to 2^12 = 4 096', '4 096 × 6 / 8 = 3 072 bytes']);
});

test('hyperloglog: the precision sweep is the one the example lists', function () {
  const entry = example('hyperloglog');
  const stream = zipfStream();
  const sweep = SketchLab.precisionSweep({ items: stream.items, precisions: [8, 10, 12, 14], seed: 3 });
  const byPrecision = {};
  sweep.forEach(function (row) { byPrecision[row.precision] = row; });

  assert.strictEqual((byPrecision[8].sigma * 100).toFixed(2), '6.50');
  assert.strictEqual(byPrecision[8].packedBytes, 192);
  assert.strictEqual(Math.round(byPrecision[8].estimate), 21122);
  assert.strictEqual((byPrecision[8].relative * 100).toFixed(2), '-2.30');
  assert.strictEqual(byPrecision[8].sigmas.toFixed(2), '0.35');

  assert.strictEqual(byPrecision[10].packedBytes, 768);
  assert.strictEqual(Math.round(byPrecision[10].estimate), 21550);
  assert.strictEqual((byPrecision[10].relative * 100).toFixed(2), '-0.32');

  assert.strictEqual(byPrecision[14].packedBytes, 12288);
  assert.strictEqual(Math.round(byPrecision[14].estimate), 21660);
  assert.strictEqual((byPrecision[14].relative * 100).toFixed(2), '0.19');

  quotes(entry, ['p =  8: σ 6.50%, 192 B, estimate 21 122, error −2.30% (0.35σ)',
    'p = 10: σ 3.25%, 768 B, estimate 21 550, error −0.32% (0.10σ)',
    'p = 14: σ 0.81%, 12 288 B, estimate 21 660, error +0.19% (0.23σ)']);
});

test('hyperloglog: four shards sum to 36 702 and merge to 21 607', function () {
  const entry = example('hyperloglog', 1);
  const stream = zipfStream();
  const merge = SketchLab.mergeCheck({ items: stream.items, shards: 4, precision: 12 });
  const shards = merge.shards.map(function (value) { return Math.round(value); });

  assert.deepStrictEqual(shards, [9010, 9427, 9300, 8965]);
  assert.strictEqual(Math.round(merge.shardSum), 36702);
  assert.strictEqual(Math.round(merge.merged), 21607);
  assert.strictEqual(Math.round(merge.whole), 21607);
  assert.strictEqual(merge.truth, 21619);
  assert.strictEqual(merge.identical, true);
  assert.strictEqual(((merge.shardSum - merge.truth) / merge.truth * 100).toFixed(1), '69.8');
  assert.strictEqual(((merge.merged - merge.truth) / merge.truth * 100).toFixed(2), '-0.06');

  quotes(entry, ['shard estimates: 9 010, 9 427, 9 300, 8 965',
    '9 010 + 9 427 + 9 300 + 8 965 = 36 702', 'merged estimate: 21 607',
    'merged: 21 607  (−0.06%, well inside σ = 1.63%)', '4 096 registers compared: all equal']);
});

/* ------------------------------------------------------------ count-min */

test('count-min: 512 x 5 is 20 480 bytes and an additive bound of 1 062', function () {
  const entry = example('count-min-sketch');
  const stream = zipfStream();
  const scatter = SketchLab.frequencyScatter({ stream: stream, width: 512, depth: 5, seed: 3 });

  assert.strictEqual(Math.ceil(Math.E / 0.0053), 513, 'the exact answer is 513; the demo rounds to 512');
  assert.strictEqual(scatter.bytes, 20480);
  assert.strictEqual(Math.round(scatter.bound), 1062);
  assert.strictEqual(scatter.points.length, 21619);
  assert.strictEqual(scatter.total, 200000);
  assert.strictEqual((Math.exp(-5) * 100).toFixed(3), '0.674');
  assert.strictEqual(scatter.epsilon.toFixed(6), '0.005309');

  quotes(entry, ['⌈512.87⌉ = 513, and the demo uses 512', '512 × 5 = 2 560 cells, 20 480 bytes',
    'd = ⌈ln(1/δ)⌉ = 5 gives δ = e^−5 = 0.674%', '1 062 — no key may exceed']);
});

test('count-min: nothing under-counts, the worst is 363, and conservative halves the mean', function () {
  const entry = example('count-min-sketch');
  const stream = zipfStream();
  const scatter = SketchLab.frequencyScatter({ stream: stream, width: 512, depth: 5, seed: 3 });

  assert.strictEqual(scatter.summary.plain.underCounts, 0);
  assert.strictEqual(scatter.summary.conservative.underCounts, 0);
  assert.strictEqual(scatter.summary.plain.worst, 363);
  assert.strictEqual(scatter.summary.conservative.worst, 261);
  assert.strictEqual(scatter.summary.plain.meanAbs.toFixed(1), '97.9');
  assert.strictEqual(scatter.summary.conservative.meanAbs.toFixed(1), '54.2');
  assert.strictEqual((97.9 / 54.2).toFixed(2), '1.81');

  quotes(entry, ['keys estimated below their true count: 0 of 21 619', 'worst over-count: 363',
    'mean absolute error: 97.9', 'mean absolute error: 97.9 → 54.2', 'worst over-count: 363 → 261']);
});

test('count-min: the additive bound is 3.8% of the top key and 7 584% of the thousandth', function () {
  const entry = example('count-min-sketch', 1);
  const stream = zipfStream();
  const sketch = CountMin.create({ width: 512, depth: 5, seed: 3 });
  stream.items.forEach(function (key) { sketch.add(key); });

  const sorted = Array.from(stream.counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
  const bound = sketch.errorBound();

  const top = sorted[0];
  assert.strictEqual(top[1], 27954);
  assert.strictEqual(sketch.estimate(top[0]), 28025);
  assert.strictEqual((100 * bound / top[1]).toFixed(2), '3.80');

  const hundredth = sorted[99];
  assert.strictEqual(hundredth[1], 176);
  assert.strictEqual(sketch.estimate(hundredth[0]), 296);

  const thousandth = sorted[999];
  assert.strictEqual(thousandth[1], 14);
  assert.strictEqual(sketch.estimate(thousandth[0]), 110);
  assert.strictEqual(Math.round(100 * bound / thousandth[1]), 7584);

  assert.strictEqual(sorted[9999][1], 1);
  assert.strictEqual(sketch.estimate(sorted[9999][0]), 88);
  assert.strictEqual(sorted[sorted.length - 1][1], 1);
  assert.strictEqual(sketch.estimate(sorted[sorted.length - 1][0]), 115);

  quotes(entry, ['rank 1: true 27 954, estimate 28 025, over by 71', 'bound 1 062 = 3.80% of that key',
    'rank 100: true 176, estimate 296, over by 120', 'rank 1 000: true 14, estimate 110, over by 96',
    'bound 1 062 = 7 584% of that key', 'rank 10 000: true 1, estimate 88',
    'rank 21 619: true 1, estimate 115']);
});

/* ------------------------------------------------------------- quantiles */

test('quantiles: the latency stream has a mean of 58 ms and a p99 of 738.88', function () {
  const entry = example('quantile-sketches');
  const values = StreamLab.latency({ length: 200000, seed: 11, slowShare: 0.1 });
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];

  const comparison = SketchLab.quantileCompare({
    values: values, quantiles: [0.5, 0.9, 0.99, 0.999],
    reservoirSize: 1000, compression: 100, k: 200, alpha: 0.01, seed: 4
  });
  const exact = {};
  comparison.exact.forEach(function (row) { exact[row.p] = row.value; });

  assert.strictEqual((sum / values.length).toFixed(2), '58.13');
  assert.strictEqual(exact[0.5].toFixed(2), '21.15');
  assert.strictEqual(exact[0.9].toFixed(2), '67.39');
  assert.strictEqual(exact[0.99].toFixed(2), '738.88');
  assert.strictEqual(exact[0.999].toFixed(2), '1533.84');
  assert.strictEqual(comparison.exactBytes, 1600000);

  quotes(entry, ['p50 21.15 ms, p90 67.39, p99 738.88, p99.9 1 533.84',
    '200 000 doubles = 1 600 000 bytes', 'the mean, 58.13 ms, is none of them']);
});

test('quantiles: every value and rank figure in the table is the measured one', function () {
  const entry = example('quantile-sketches');
  const values = StreamLab.latency({ length: 200000, seed: 11, slowShare: 0.1 });
  const comparison = SketchLab.quantileCompare({
    values: values, quantiles: [0.5, 0.9, 0.99, 0.999],
    reservoirSize: 1000, compression: 100, k: 200, alpha: 0.01, seed: 4
  });
  const byId = {};
  comparison.rows.forEach(function (row) {
    byId[row.id] = {};
    row.answers.forEach(function (answer) { byId[row.id][answer.p] = answer; });
    byId[row.id].bytes = row.bytes;
  });

  assert.strictEqual(byId.reservoir.bytes, 8000);
  assert.strictEqual(byId['t-digest'].bytes, 944);
  assert.strictEqual(byId.kll.bytes, 2152);
  assert.strictEqual(byId.ddsketch.bytes, 4116);

  assert.strictEqual(byId.reservoir[0.999].value.toFixed(1), '938.3');
  assert.strictEqual((byId.reservoir[0.999].relative * 100).toFixed(2), '-38.82');
  assert.strictEqual(byId.kll[0.999].value.toFixed(1), '897.3');
  assert.strictEqual((byId.kll[0.999].relative * 100).toFixed(2), '-41.50');
  assert.strictEqual(byId['t-digest'][0.999].value.toFixed(1), '1594.8');
  assert.strictEqual((byId['t-digest'][0.999].relative * 100).toFixed(2), '3.98');
  assert.strictEqual(byId.ddsketch[0.999].value.toFixed(1), '1525.7');
  assert.strictEqual((byId.ddsketch[0.999].relative * 100).toFixed(2), '-0.53');

  assert.strictEqual((byId['t-digest'][0.9].rank * 100).toFixed(3), '0.267');
  assert.strictEqual((byId['t-digest'][0.9].relative * 100).toFixed(2), '23.55');
  assert.strictEqual((byId['t-digest'][0.999].rank * 100).toFixed(3), '0.013');
  assert.strictEqual((byId.kll[0.999].rank * 100).toFixed(3), '-0.489');
  assert.strictEqual((byId.ddsketch[0.9].rank * 100).toFixed(3), '-0.001');
  assert.strictEqual((byId.ddsketch[0.9].relative * 100).toFixed(2), '-0.04');

  quotes(entry, ['reservoir (8 000 B): 938.3 ms, −38.82%', 'KLL (2 152 B):        897.3 ms, −41.50%',
    't-digest (944 B):    1 594.8 ms,  +3.98%', 'DDSketch (4 116 B):  1 525.7 ms,  −0.53%',
    't-digest: rank +0.267 pp, value +23.55%', 'DDSketch: rank −0.001 pp, value −0.04%']);
});

test('quantiles: averaging eight shard p99s reads 17.39% below the truth', function () {
  const entry = example('quantile-sketches', 1);
  const shards = SketchLab.shardQuantiles({
    shards: 8, perShardLength: 25000, p: 0.99, alpha: 0.01, seed: 11
  });
  const perShard = shards.perShard.map(function (row) { return Math.round(row.quantile); });

  assert.deepStrictEqual(perShard, [558, 575, 544, 545, 533, 507, 550, 1345]);
  assert.strictEqual(shards.averaged.toFixed(2), '644.65');
  assert.strictEqual(shards.truth.toFixed(2), '780.37');
  assert.strictEqual(shards.merged.toFixed(2), '772.92');
  assert.strictEqual((shards.averagedError * 100).toFixed(2), '-17.39');
  assert.strictEqual((shards.mergedError * 100).toFixed(2), '-0.95');
  assert.ok(Math.abs(shards.mergedError) <= shards.alpha, 'the merge stays inside alpha');

  quotes(entry, ['healthy shards: 558, 575, 544, 545, 533, 507, 550 ms', 'degraded shard: 1 345 ms',
    '= 644.65 ms', 'exact p99 of the union: 780.37 ms', 'merged p99: 772.92 ms, −0.95%']);
});
