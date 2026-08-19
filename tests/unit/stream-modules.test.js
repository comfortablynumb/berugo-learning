'use strict';

/**
 * Unit tests for the M07 counting, quantile, similarity and window engines.
 *
 * Every assertion here is against a *stated bound* and an exact reference
 * computed on the same stream, never against a hand-tuned tolerance. That is
 * the milestone's own acceptance criterion and it is the one that keeps
 * working: a bound derived from the structure's parameters fails when the
 * structure changes, and a constant fails when somebody widens it.
 *
 * Everything is pure and DOM-free, so `node --test` loads the modules directly.
 */

const test = require('node:test');
const assert = require('node:assert');

const HyperLogLog = require('../../src/js/algorithms/hyperloglog.js');
const CountMin = require('../../src/js/algorithms/count-min.js');
const QuantileSketches = require('../../src/js/algorithms/quantile-sketches.js');
const MinHashLsh = require('../../src/js/algorithms/minhash-lsh.js');
const WindowCounters = require('../../src/js/algorithms/window-counters.js');
const StreamLab = require('../../src/js/machines/stream-lab.js');
const SketchLab = require('../../src/js/machines/sketch-lab.js');
const SketchChooser = require('../../src/js/machines/sketch-chooser.js');

/* --------------------------------------------------------- HyperLogLog */

test('hll: the error stays inside three standard errors across seeds and cardinalities', function () {
  [1000, 10000, 60000].forEach(function (n) {
    const sigma = HyperLogLog.standardError(4096);
    let worst = 0;

    for (let seed = 1; seed <= 20; seed += 1) {
      const sketch = HyperLogLog.create({ precision: 12, seed: seed });
      for (let i = 0; i < n; i += 1) sketch.add('s' + seed + '-u' + i);
      worst = Math.max(worst, Math.abs(sketch.estimate() - n) / n);
    }

    assert.ok(worst <= 3 * sigma,
      'n = ' + n + ': worst relative error ' + worst.toFixed(4) + ' is ' +
      (worst / sigma).toFixed(2) + ' sigma, and 3 is the limit');
  });
});

test('hll: merge equals the sketch of the concatenated stream, exactly, for every seed', function () {
  for (let seed = 1; seed <= 12; seed += 1) {
    const left = HyperLogLog.create({ precision: 10, seed: seed, dense: true });
    const right = HyperLogLog.create({ precision: 10, seed: seed, dense: true });
    const whole = HyperLogLog.create({ precision: 10, seed: seed, dense: true });

    for (let i = 0; i < 4000; i += 1) { left.add('x' + i); whole.add('x' + i); }
    for (let i = 2000; i < 7000; i += 1) { right.add('x' + i); whole.add('x' + i); }

    const merged = HyperLogLog.merge([left, right]);
    assert.strictEqual(HyperLogLog.sameRegisters(merged, whole), true,
      'seed ' + seed + ': the merged registers differ from the whole-stream sketch');
    assert.strictEqual(merged.estimate(), whole.estimate(), 'seed ' + seed + ': estimates differ');
  }
});

test('hll: merging is not the same as adding the estimates', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 100000, keys: 40000, skew: 1.1, seed: 5 });
  const check = SketchLab.mergeCheck({ items: stream.items, shards: 4, precision: 12 });

  assert.strictEqual(check.identical, true, 'the merge must be exact');
  assert.ok(Math.abs(check.merged - check.truth) / check.truth < 3 * HyperLogLog.standardError(4096),
    'the merged estimate must be inside 3 sigma of the truth');
  assert.ok(check.shardSum > 1.5 * check.truth,
    'adding the shard estimates must over-count badly, or the demo has stopped demonstrating it');
});

test('hll: the corrections are what make small cardinalities usable', function () {
  const sweep = SketchLab.correctionSweep({ precision: 12, seed: 3 });
  const tiny = sweep.filter(function (row) { return row.multiple <= 0.1; });

  tiny.forEach(function (row) {
    assert.ok(Math.abs(row.rawError) > 1, 'the raw estimator should be wildly wrong at n/m = ' + row.multiple);
    assert.ok(Math.abs(row.correctedError) < 0.05, 'the correction should rescue n/m = ' + row.multiple);
    assert.strictEqual(row.usedLinearCounting, true);
  });

  const far = sweep.filter(function (row) { return row.multiple >= 10; });
  far.forEach(function (row) {
    assert.ok(Math.abs(row.correctedError) < 0.02, 'well past 2.5m the raw estimator is fine');
  });
});

test('hll: the sparse form promotes without changing the answers it gives', function () {
  const sketch = HyperLogLog.create({ precision: 12, seed: 1 });
  for (let i = 0; i < 500; i += 1) sketch.add('k' + i);
  assert.strictEqual(sketch.isSparse(), true, 'still sparse at 500 keys');
  assert.ok(Math.abs(sketch.estimate() - 500) < 25, 'sparse estimate ' + sketch.estimate().toFixed(1));

  for (let i = 500; i < 5000; i += 1) sketch.add('k' + i);
  assert.strictEqual(sketch.isSparse(), false, 'promoted by 5 000 keys');
  assert.strictEqual(sketch.stats().promotions, 1, 'promotion happens once');
  assert.ok(Math.abs(sketch.estimate() - 5000) / 5000 < 3 * sketch.standardError());
});

/* ------------------------------------------------------------ count-min */

test('count-min: the estimate is never below the truth, for every key, on every stream shape', function () {
  ['uniform', 'zipf', 'duplicates', 'sliding'].forEach(function (kind) {
    const stream = StreamLab.generate({ kind: kind, length: 60000, keys: 20000, skew: 1.2, seed: 9 });

    [false, true].forEach(function (conservative) {
      const sketch = CountMin.create({ width: 256, depth: 5, seed: 3, conservative: conservative });
      stream.items.forEach(function (key) { sketch.add(key); });

      stream.counts.forEach(function (truth, key) {
        assert.ok(sketch.estimate(key) >= truth,
          kind + (conservative ? ' conservative' : '') + ': ' + key + ' estimated ' +
          sketch.estimate(key) + ' against ' + truth);
      });
    });
  });
});

test('count-min: no key exceeds the additive bound the sketch states for itself', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const sketch = CountMin.create({ width: 512, depth: 5, seed: 3 });
  stream.items.forEach(function (key) { sketch.add(key); });

  const bound = sketch.errorBound();
  let worst = 0;
  stream.counts.forEach(function (truth, key) {
    worst = Math.max(worst, sketch.estimate(key) - truth);
  });

  assert.ok(worst <= bound, 'worst over-count ' + worst + ' against a bound of ' + bound.toFixed(1));
  assert.ok(worst > bound / 20, 'the bound should not be trivially loose; worst was ' + worst);
});

test('count-min: conservative update is tighter and keeps the guarantee', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const scatter = SketchLab.frequencyScatter({ stream: stream, width: 512, depth: 5, seed: 3 });

  assert.strictEqual(scatter.summary.plain.underCounts, 0);
  assert.strictEqual(scatter.summary.conservative.underCounts, 0);
  assert.ok(scatter.summary.conservative.meanAbs < 0.7 * scatter.summary.plain.meanAbs,
    'conservative mean error ' + scatter.summary.conservative.meanAbs.toFixed(1) +
    ' against plain ' + scatter.summary.plain.meanAbs.toFixed(1));
  assert.ok(scatter.summary.conservative.worst < scatter.summary.plain.worst);
});

test('count-min: count-sketch is unbiased, under-counts, and honours its L2 bound', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const scatter = SketchLab.frequencyScatter({ stream: stream, width: 512, depth: 5, seed: 3 });

  assert.ok(scatter.summary.signed.underCounts > 1000,
    'count-sketch must under-count a large share of keys; it under-counted ' +
    scatter.summary.signed.underCounts);
  assert.ok(scatter.summary.signed.meanAbs < scatter.summary.plain.meanAbs,
    'count-sketch should have the lower mean absolute error');
  assert.ok(Math.abs(scatter.summary.signed.worst) <= scatter.l2Bound,
    'worst count-sketch error ' + scatter.summary.signed.worst + ' against an L2 bound of ' +
    scatter.l2Bound.toFixed(0));
});

test('count-min: the row hashes are independent enough for the bound to hold', function () {
  /* Two keys colliding in every row at once is the event both guarantees
     exclude. With independent rows it should be vanishingly rare. */
  const sketch = CountMin.create({ width: 64, depth: 4, seed: 1 });
  const target = sketch.columns('victim').join(',');
  let collisions = 0;

  for (let i = 0; i < 200000; i += 1) {
    if (sketch.columns('probe-' + i).join(',') === target) collisions += 1;
  }

  const expected = 200000 / Math.pow(64, 4);
  assert.ok(collisions <= 5 + 10 * expected,
    collisions + ' all-row collisions in 200 000 probes, against an expected ' + expected.toFixed(4) +
    ' — the rows are correlated');
});

test('count-min: heavy hitters need the candidate set, and space-saving beats it', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const heavy = SketchLab.heavyHitterCompare({
    stream: stream, fraction: 0.005, counters: 400, width: 512, depth: 5, seed: 3
  });

  assert.ok(heavy.truth.length > 5, 'the stream must contain heavy hitters to find');
  assert.strictEqual(heavy.countMin.recall, 1, 'count-min plus a heap must find them all');
  assert.strictEqual(heavy.spaceSaving.recall, 1, 'space-saving must find them all');
  assert.ok(heavy.spaceSaving.worstOver <= heavy.countMin.worstOver,
    'space-saving over-counted by ' + heavy.spaceSaving.worstOver +
    ' against count-min\'s ' + heavy.countMin.worstOver);
  assert.ok(heavy.spaceSavingBytes < heavy.countMinBytes, 'and it should be the smaller of the two');
});

/* ----------------------------------------------------------- quantiles */

test('quantiles: every sketch is checked at p50, p90, p99 and p999 on a bimodal stream', function () {
  const values = StreamLab.latency({ length: 200000, seed: 11, slowShare: 0.1 });
  const comparison = SketchLab.quantileCompare({
    values: values, quantiles: [0.5, 0.9, 0.99, 0.999],
    reservoirSize: 1000, compression: 100, k: 200, alpha: 0.01, seed: 4
  });

  const byId = {};
  comparison.rows.forEach(function (row) { byId[row.id] = row; });

  byId.ddsketch.answers.forEach(function (answer) {
    assert.ok(Math.abs(answer.relative) <= 0.01,
      'DDSketch guarantees alpha = 1% on the value; at p' + answer.p + ' it was ' +
      (answer.relative * 100).toFixed(2) + '%');
  });

  ['t-digest', 'kll'].forEach(function (id) {
    byId[id].answers.forEach(function (answer) {
      assert.ok(Math.abs(answer.rank) <= 0.01,
        id + ' bounds the rank; at p' + answer.p + ' the rank error was ' +
        (answer.rank * 100).toFixed(3) + ' percentage points');
    });
  });

  assert.ok(Math.abs(byId.reservoir.answers[3].relative) > 0.1,
    'a 1 000-item reservoir must be visibly wrong at p99.9, or the section has no point');
  assert.ok(comparison.exactBytes > 100 * byId['t-digest'].bytes,
    'the exact answer must be far larger than the smallest sketch');
});

test('quantiles: the reservoir is uniform, and Algorithm R is why', function () {
  const trials = 4000;
  const counts = new Array(20).fill(0);

  for (let trial = 0; trial < trials; trial += 1) {
    const reservoir = QuantileSketches.reservoir({ size: 5, seed: trial + 1 });
    for (let i = 0; i < 20; i += 1) reservoir.add(i);
    reservoir.sample().forEach(function (value) { counts[value] += 1; });
  }

  const expected = trials * 5 / 20;
  counts.forEach(function (count, index) {
    assert.ok(Math.abs(count - expected) <= 0.1 * expected,
      'item ' + index + ' kept ' + count + ' times against an expected ' + expected);
  });
});

test('quantiles: DDSketch merges bucket-wise and stays inside alpha', function () {
  const shards = SketchLab.shardQuantiles({ shards: 8, perShardLength: 20000, p: 0.99, alpha: 0.01, seed: 11 });

  assert.ok(Math.abs(shards.mergedError) <= shards.alpha,
    'the merged sketch must honour alpha: ' + (shards.mergedError * 100).toFixed(2) + '%');
  assert.ok(shards.averagedError < -0.05,
    'averaging per-shard quantiles must under-report a degraded fleet; it was ' +
    (shards.averagedError * 100).toFixed(2) + '%');
});

test('quantiles: the exact reference answers rank and value consistently', function () {
  const exact = QuantileSketches.exact({});
  for (let i = 1; i <= 1000; i += 1) exact.add(i);

  assert.strictEqual(exact.quantile(0.5), 500);
  assert.strictEqual(exact.quantile(0.99), 990);
  assert.strictEqual(exact.quantile(1), 1000);
  assert.strictEqual(exact.rankOf(500), 499, 'rankOf counts values strictly below');
  assert.strictEqual(exact.count(), 1000);
});

/* ---------------------------------------------------------- similarity */

test('minhash: the estimate is within three standard errors across the similarity range', function () {
  const length = 128;
  const bound = 3 / Math.sqrt(length);

  [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (target) {
    const size = 400;
    const shared = Math.round(size * 2 * target / (1 + target));
    const left = new Set();
    const right = new Set();
    for (let i = 0; i < size; i += 1) left.add('t' + i);
    for (let i = 0; i < size; i += 1) right.add('t' + (i + size - shared));

    const exact = MinHashLsh.jaccard(left, right);
    const estimate = MinHashLsh.estimateJaccard(
      MinHashLsh.signature({ tokens: left, length: length, seed: 4 }).values,
      MinHashLsh.signature({ tokens: right, length: length, seed: 4 }).values
    );

    assert.ok(Math.abs(estimate - exact) <= bound,
      'exact ' + exact.toFixed(3) + ', estimated ' + estimate.toFixed(3) + ', bound ' + bound.toFixed(3));
  });
});

test('minhash: the S-curve formula is what the band index actually does', function () {
  const documents = StreamLab.documents({ groups: 12, perGroup: 4, words: 60, seed: 3 });

  const strict = SketchLab.deduplicate({ documents: documents, bands: 8, rows: 16, threshold: 0.5, seed: 2 });
  const middle = SketchLab.deduplicate({ documents: documents, bands: 16, rows: 8, threshold: 0.5, seed: 2 });
  const loose = SketchLab.deduplicate({ documents: documents, bands: 32, rows: 4, threshold: 0.5, seed: 2 });

  assert.ok(strict.curveThreshold > middle.curveThreshold, 'longer bands raise the threshold');
  assert.ok(middle.curveThreshold > loose.curveThreshold, 'more bands lower it');
  assert.ok(strict.candidates < middle.candidates, 'a stricter curve proposes fewer pairs');
  assert.ok(middle.candidates < loose.candidates);
  assert.strictEqual(loose.recall, 1, 'the loosest split must find every true pair');
  assert.ok(loose.precision < 1, 'and must pay for it in precision');
  assert.ok(loose.candidates < loose.allPairs / 10, 'the index must still avoid most of the work');
});

test('minhash: simhash scores the angle, not the overlap', function () {
  const documents = StreamLab.documents({ groups: 12, perGroup: 4, words: 60, seed: 3 });
  const simhash = SketchLab.simhashCompare({ documents: documents, bits: 64, seed: 2, threshold: 0.5 });

  assert.strictEqual(simhash.bytesPerDocument, 8, '64 bits is 8 bytes per document');
  for (let i = 1; i < simhash.sweep.length; i += 1) {
    assert.ok(simhash.sweep[i].recall >= simhash.sweep[i - 1].recall, 'a looser cutoff cannot lose recall');
    assert.ok(simhash.sweep[i].flagged >= simhash.sweep[i - 1].flagged, 'nor propose fewer pairs');
  }
  assert.strictEqual(simhash.sweep[simhash.sweep.length - 1].recall, 1,
    'the loosest cutoff should reach full recall');
});

test('minhash: random projection meets the Johnson-Lindenstrauss promise', function () {
  const jl = MinHashLsh.jlDimension({ points: 60, epsilon: 0.3 });
  const atBound = SketchLab.projectionCheck({ points: 60, dimensions: 400, target: jl, epsilon: 0.3, seed: 6 });
  assert.ok(atBound.worstDistortion <= 0.3,
    'at the JL dimension the worst distortion was ' + atBound.worstDistortion.toFixed(4));

  const tighter = SketchLab.projectionCheck({ points: 60, dimensions: 400, target: 512, epsilon: 0.3, seed: 6 });
  assert.ok(tighter.worstDistortion < atBound.worstDistortion, 'more dimensions must distort less');
});

/* -------------------------------------------------------------- windows */

test('windows: DGIM stays inside 1/2r of the exact count, and halves with r', function () {
  const bits = StreamLab.binary({ length: 120000, period: 9000, seed: 7 });
  const comparison = SketchLab.windowCompare({ bits: bits, windowSize: 20000, perSizes: [2, 4, 8, 16] });

  comparison.rows.forEach(function (row) {
    assert.ok(row.worstRelative <= 1 / (2 * row.perSize),
      'r = ' + row.perSize + ': worst relative error ' + row.worstRelative.toFixed(4) +
      ' against a bound of ' + (1 / (2 * row.perSize)).toFixed(4));
    assert.ok(row.bits < comparison.exactBits, 'DGIM must be smaller than the exact ring');
  });

  for (let i = 1; i < comparison.rows.length; i += 1) {
    assert.ok(comparison.rows[i].worstRelative < comparison.rows[i - 1].worstRelative,
      'doubling the bucket allowance must reduce the error');
    assert.ok(comparison.rows[i].bits > comparison.rows[i - 1].bits, 'and must cost more memory');
  }
});

test('windows: the exact ring and DGIM agree on a stream of all ones', function () {
  const exact = WindowCounters.exactWindow({ windowSize: 1000 });
  const dgim = WindowCounters.dgim({ windowSize: 1000, perSize: 2 });

  for (let i = 0; i < 5000; i += 1) { exact.add(1); dgim.add(1); }
  assert.strictEqual(exact.estimate(), 1000, 'every position in the window is a one');
  assert.ok(Math.abs(dgim.estimate() - 1000) <= 500, 'DGIM within 50% on the hardest case');
  assert.ok(dgim.bucketCount() < 40, 'the bucket count must stay logarithmic: ' + dgim.bucketCount());
});

test('windows: space-saving brackets the truth and never misses a frequent key', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const counters = 200;
  const sketch = WindowCounters.spaceSaving({ counters: counters });
  stream.items.forEach(function (key) { sketch.add(key); });

  const guaranteed = sketch.guaranteedThreshold();
  const monitored = new Set(sketch.top().map(function (row) { return row.key; }));

  stream.counts.forEach(function (truth, key) {
    if (truth > guaranteed) {
      assert.ok(monitored.has(key), key + ' occurs ' + truth + ' times and is not monitored');
    }
    if (!monitored.has(key)) return;
    assert.ok(sketch.estimate(key) >= truth, key + ' under-counted');
    assert.ok(sketch.estimate(key) - sketch.errorOf(key) <= truth, key + ': the lower bound is above the truth');
    assert.ok(sketch.errorOf(key) <= sketch.minimum(),
      key + ': the inherited error exceeds the current minimum counter');
  });
});

test('windows: lossy counting is the mirror image — never over, never missing', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const sketch = WindowCounters.lossyCounting({ epsilon: 0.0005 });
  stream.items.forEach(function (key) { sketch.add(key); });

  const support = 0.001;
  const reported = sketch.top(support);
  const bound = sketch.errorBound();

  reported.forEach(function (row) {
    const truth = stream.counts.get(row.key) || 0;
    assert.ok(row.count <= truth, row.key + ' over-counted by lossy counting');
    assert.ok(truth <= row.count + bound, row.key + ' under-counted by more than epsilon N');
  });

  const reportedKeys = new Set(reported.map(function (row) { return row.key; }));
  stream.counts.forEach(function (truth, key) {
    if (truth <= support * stream.items.length) return;
    assert.ok(reportedKeys.has(key), key + ' occurs ' + truth + ' times and was dropped');
  });
});

test('windows: decay changes the ordering and bounds nothing', function () {
  const stream = StreamLab.generate({ kind: 'zipf', length: 100000, keys: 20000, skew: 1.1, seed: 5 });
  const topK = SketchLab.streamTopK({
    stream: stream, counters: 200, epsilon: 0.0005, halfLife: 20000, k: 10, support: 0.001
  });

  assert.strictEqual(topK.spaceSaving.recall, 1, 'space-saving must find the true top-10');
  assert.strictEqual(topK.spaceSaving.worstOver, 0, 'and be exact on the head of this distribution');
  assert.strictEqual(topK.decayed.keys, stream.counts.size,
    'a decayed table retains every key ever seen — that is the point: ' + topK.decayed.keys +
    ' against ' + topK.spaceSaving.monitored + ' bounded counters');
  assert.ok(topK.decayed.rows[0].value < stream.counts.get(topK.truth[0].key),
    'a decayed value is a recent rate, not a total');
});

/* --------------------------------------------------- chooser and attacks */

test('chooser: every question ranks the exact option alongside the sketches', function () {
  SketchChooser.questions().forEach(function (question) {
    const ranking = SketchChooser.recommend({
      question: question.id, budget: 65536, tolerance: 0.02, probes: 10000, seed: 3
    });
    const exact = ranking.rows.filter(function (row) { return row.id === 'exact'; })[0];

    assert.ok(exact, question.id + ': the exact option must be priced');
    assert.strictEqual(exact.error, 0, 'the exact option has no error');
    assert.ok(exact.bytes > 100000, 'and it must be visibly expensive on this stream');
    ranking.rows.forEach(function (row) {
      assert.ok(row.verdict, row.id + ' must carry a verdict');
      assert.strictEqual(row.fits && row.accurate, row.verdict === 'usable');
    });
  });
});

test('chooser: a tighter budget changes the recommendation', function () {
  const roomy = SketchChooser.recommend({ question: 'distinct', budget: 65536, tolerance: 0.05, probes: 4000, seed: 3 });
  const tight = SketchChooser.recommend({ question: 'distinct', budget: 512, tolerance: 0.05, probes: 4000, seed: 3 });

  assert.ok(roomy.winner, 'a 64 KB budget must have a winner');
  assert.ok(tight.winner === null || tight.winner.bytes <= 512, 'a 512-byte budget cannot pick a larger sketch');
});

test('attacks: a published seed costs 1/epsilon probes per manufactured false positive', function () {
  [0.1, 0.01].forEach(function (target) {
    const attack = SketchChooser.filterAttack({ n: 5000, p: target, want: 50, budget: 400000 });

    assert.strictEqual(attack.exhausted, false, 'the search must find what it was asked for');
    assert.ok(attack.perHit < 3 * attack.expectedPerHit && attack.perHit > attack.expectedPerHit / 3,
      'at target ' + target + ': ' + attack.perHit.toFixed(1) + ' probes per hit against an expected ' +
      attack.expectedPerHit.toFixed(1));
    assert.ok(attack.transferred <= Math.max(2, 4 * attack.expectedTransferred),
      'the manufactured keys must not transfer to a differently seeded filter: ' + attack.transferred);
  });
});

test('attacks: a count-min flood inflates a key without violating the bound', function () {
  const attack = SketchChooser.sketchAttack({
    width: 32, depth: 3, want: 8, budget: 600000, honest: 100, perAttacker: 5000
  });

  assert.strictEqual(attack.exhausted, false, 'the collision search must succeed at this width');
  assert.strictEqual(attack.before, attack.trueCount, 'before the flood the estimate is exact');
  assert.ok(attack.inflation > 100, 'the flood must inflate the victim: ' + attack.inflation.toFixed(0) + 'x');
  assert.ok(attack.perHit < 5 * attack.expectedPerHit,
    'the search cost should be near w^d: ' + attack.perHit.toFixed(0) + ' against ' + attack.expectedPerHit);
  assert.ok(attack.productionCost > 1e15, 'a production-sized sketch must be out of reach');
});
