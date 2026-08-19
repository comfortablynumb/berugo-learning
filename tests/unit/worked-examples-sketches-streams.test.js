'use strict';

/**
 * Every figure quoted in the M07.7-M07.9 worked examples, recomputed here from
 * the example's own setup and asserted against the text that teaches it.
 *
 * The corpora, streams and seeds are the ones the section demos use, so a
 * change that moves a number fails here rather than leaving the prose quietly
 * wrong.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-sketches-streams.js');

const MinHashLsh = require('../../src/js/algorithms/minhash-lsh.js');
const StreamLab = require('../../src/js/machines/stream-lab.js');
const SketchLab = require('../../src/js/machines/sketch-lab.js');
const SketchChooser = require('../../src/js/machines/sketch-chooser.js');

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

function corpus() {
  return StreamLab.documents({ groups: 12, perGroup: 4, words: 60, seed: 3 });
}

/* ------------------------------------------------------- minhash and lsh */

test('minhash-and-lsh: 60 documents give 1 770 pairs and 11 true duplicates', function () {
  const entry = example('minhash-and-lsh');
  const documents = corpus();
  const result = SketchLab.deduplicate({
    documents: documents, bands: 16, rows: 8, threshold: 0.5, shingle: 5, seed: 2
  });

  assert.strictEqual(documents.length, 60);
  assert.strictEqual(result.allPairs, 1770);
  assert.strictEqual(result.truePairs, 11);
  assert.strictEqual(result.signatureLength, 128);
  assert.strictEqual((result.standardError * 100).toFixed(2), '8.84');
  assert.strictEqual((result.worstEstimateError * 100).toFixed(2), '10.34');

  quotes(entry, ['pairs: 60 × 59 / 2 = 1 770', 'pairs at or above 0.50 Jaccard: 11',
    'standard error 1/√128 = 8.84%', 'worst estimate error over all 1 770 pairs: 10.34%']);
});

test('minhash-and-lsh: the three splits give 0, 3 and 22 candidate pairs', function () {
  const entry = example('minhash-and-lsh');
  const documents = corpus();

  const strict = SketchLab.deduplicate({ documents: documents, bands: 8, rows: 16, threshold: 0.5, shingle: 5, seed: 2 });
  const middle = SketchLab.deduplicate({ documents: documents, bands: 16, rows: 8, threshold: 0.5, shingle: 5, seed: 2 });
  const loose = SketchLab.deduplicate({ documents: documents, bands: 32, rows: 4, threshold: 0.5, shingle: 5, seed: 2 });

  assert.strictEqual(strict.curveThreshold.toFixed(3), '0.878');
  assert.strictEqual(strict.candidates, 0);
  assert.strictEqual(strict.recall, 0);

  assert.strictEqual(middle.curveThreshold.toFixed(3), '0.707');
  assert.strictEqual(middle.candidates, 3);
  assert.strictEqual((middle.recall * 100).toFixed(1), '27.3');
  assert.strictEqual(middle.precision, 1);

  assert.strictEqual(loose.curveThreshold.toFixed(3), '0.420');
  assert.strictEqual(loose.candidates, 22);
  assert.strictEqual(loose.recall, 1);
  assert.strictEqual((loose.precision * 100).toFixed(1), '50.0');
  assert.strictEqual((100 * (1 - 22 / 1770)).toFixed(1), '98.8');

  quotes(entry, ['curve threshold (1/8)^(1/16) = 0.878', 'candidates proposed: 0',
    '16 × 8: threshold 0.707, 3 candidates, recall 27.3%, precision 100%',
    '32 × 4: threshold 0.420, 22 candidates, recall 100%, precision 50.0%',
    '32 × 4: 22 candidates verified exactly', '98.8% of the pairs never examined']);
});

test('minhash-and-lsh: SimHash is 8 bytes and needs its own tuning', function () {
  const entry = example('minhash-and-lsh', 1);
  const documents = corpus();
  const simhash = SketchLab.simhashCompare({
    documents: documents, bits: 64, shingle: 5, threshold: 0.5, seed: 2
  });
  const byCutoff = {};
  simhash.sweep.forEach(function (row) { byCutoff[row.cutoff] = row; });

  assert.strictEqual(simhash.bytesPerDocument, 8);
  assert.strictEqual(byCutoff[12].flagged, 2);
  assert.strictEqual((byCutoff[12].recall * 100).toFixed(1), '18.2');
  assert.strictEqual(byCutoff[16].flagged, 9);
  assert.strictEqual((byCutoff[16].recall * 100).toFixed(1), '63.6');
  assert.strictEqual((byCutoff[16].precision * 100).toFixed(1), '77.8');
  assert.strictEqual(byCutoff[20].flagged, 30);
  assert.strictEqual(byCutoff[20].recall, 1);
  assert.strictEqual((byCutoff[20].precision * 100).toFixed(1), '36.7');

  quotes(entry, ['SimHash, 64 bits: 8 bytes', '≤ 12 bits: 2 flagged, recall 18.2%, precision 100%',
    '≤ 16 bits: 9 flagged, recall 63.6%, precision 77.8%',
    '≤ 20 bits: 30 flagged, recall 100%, precision 36.7%']);
});

test('minhash-and-lsh: Johnson-Lindenstrauss asks for 364 dimensions and 64 delivers 29.95%', function () {
  const entry = example('minhash-and-lsh', 1);

  assert.strictEqual(MinHashLsh.jlDimension({ points: 60, epsilon: 0.3 }), 364);

  const measured = SketchLab.projectionCheck({ points: 60, dimensions: 400, target: 64, epsilon: 0.3, seed: 6 });
  assert.strictEqual((measured.worstDistortion * 100).toFixed(2), '29.95');
  assert.strictEqual((measured.meanDistortion * 100).toFixed(2), '6.68');
  assert.ok(measured.worstDistortion <= 0.3, 'the promise is 30% and it was met');
  assert.strictEqual((364 / 64).toFixed(1), '5.7');

  quotes(entry, ['ε = 0.3 asks for 364 dimensions', 'projecting into 64: worst distortion 29.95%, mean 6.68%',
    'about 5.7× conservative here']);
});

/* ------------------------------------------------------ windowed counting */

test('windowed-counting: DGIM is 600 bits at 26.14% and 4 350 at 2.97%', function () {
  const entry = example('windowed-counting');
  const bits = StreamLab.binary({ length: 200000, period: 9000, seed: 7 });
  const comparison = SketchLab.windowCompare({ bits: bits, windowSize: 20000, perSizes: [2, 4, 8, 16] });
  const byPerSize = {};
  comparison.rows.forEach(function (row) { byPerSize[row.perSize] = row; });

  assert.strictEqual(comparison.exactBits, 20000);
  assert.strictEqual(Math.ceil(Math.log2(20001)), 15);

  assert.strictEqual(byPerSize[2].buckets, 20);
  assert.strictEqual(byPerSize[2].bits, 600);
  assert.strictEqual((byPerSize[2].worstRelative * 100).toFixed(2), '26.14');
  assert.strictEqual(byPerSize[2].compression.toFixed(1), '33.3');

  assert.strictEqual(byPerSize[4].buckets, 41);
  assert.strictEqual(byPerSize[4].bits, 1230);
  assert.strictEqual((byPerSize[4].worstRelative * 100).toFixed(2), '12.93');

  assert.strictEqual(byPerSize[8].buckets, 76);
  assert.strictEqual(byPerSize[8].bits, 2280);
  assert.strictEqual((byPerSize[8].worstRelative * 100).toFixed(2), '6.38');

  assert.strictEqual(byPerSize[16].buckets, 145);
  assert.strictEqual(byPerSize[16].bits, 4350);
  assert.strictEqual((byPerSize[16].worstRelative * 100).toFixed(2), '2.97');
  assert.strictEqual(byPerSize[16].compression.toFixed(1), '4.6');
  assert.strictEqual((byPerSize[16].statedBound * 100).toFixed(2), '2.45');

  quotes(entry, ['one bit per position in the window: 20 000 bits',
    '20 buckets, each carrying a size and a timestamp of ⌈log₂ 20 001⌉ = 15 bits',
    '20 × 2 × 15 = 600 bits', 'worst relative error over the run: 26.14%',
    'r =  4: 41 buckets, 1 230 bits, worst error 12.93%',
    'r =  8: 76 buckets, 2 280 bits, worst error  6.38%',
    'measured: 145 buckets, 4 350 bits, 2.97%',
    'half the oldest bucket over the total: 2.45% at the moment of measurement']);
});

test('windowed-counting: the three top-k structures, and their three directions', function () {
  const entry = example('windowed-counting', 1);
  const stream = StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 });
  const topK = SketchLab.streamTopK({
    stream: stream, counters: 200, epsilon: 0.0005, halfLife: 20000, k: 10, support: 0.001
  });

  assert.strictEqual(topK.spaceSaving.monitored, 200);
  assert.strictEqual(topK.spaceSaving.bytes, 8000);
  assert.strictEqual(topK.spaceSaving.worstOver, 0);
  assert.strictEqual(Math.round(topK.spaceSaving.guaranteedThreshold), 1000);

  assert.strictEqual(topK.lossy.width, 2000);
  assert.strictEqual(topK.lossy.monitored, 270);
  assert.strictEqual(topK.lossy.bytes, 10800);
  assert.strictEqual(topK.lossy.errorBound, 100);
  assert.strictEqual(topK.lossy.worstUnder, 0);

  assert.strictEqual(topK.decayed.keys, 21619);
  assert.strictEqual(topK.decayed.bytes, 518856);
  assert.strictEqual(topK.truth[0].count, 27954);
  assert.strictEqual(Math.round(topK.decayed.rows[0].value), 4048);
  assert.strictEqual(Math.round(518856 / 8000), 65);

  quotes(entry, ['guaranteed to hold every key above N/m = 1 000', 'memory: 8 000 bytes',
    'count ≤ truth ≤ count + εN = count + 100', '270 entries kept, 10 800 bytes',
    '21 619 keys retained, 518 856 bytes', 'key-0 reads 4 048 against 27 954']);
});

/* ------------------------------------------------------ choosing sketches */

test('choosing-sketches: the chooser recommends what the example says at 64 KB and 2%', function () {
  const entry = example('choosing-sketches');

  const membership = SketchChooser.recommend({
    question: 'membership', budget: 65536, tolerance: 0.02, probes: 20000, seed: 3
  });
  const byId = {};
  membership.rows.forEach(function (row) { byId[row.id] = row; });

  assert.strictEqual(byId.bloom.bytes, 25903);
  assert.strictEqual((byId.bloom.error * 100).toFixed(3), '1.045');
  assert.strictEqual(byId.blocked.bytes, 25920);
  assert.strictEqual((byId.blocked.error * 100).toFixed(3), '1.200');
  assert.strictEqual(byId['bloom-tight'].bytes, 38854);
  assert.strictEqual(byId.quotient.bytes, 40960);
  assert.strictEqual(byId.cuckoo.bytes, 32768);
  assert.strictEqual((byId.cuckoo.error * 100).toFixed(3), '2.005');
  assert.strictEqual(byId.cuckoo.verdict, 'too inaccurate');
  assert.strictEqual(byId.exact.bytes, 1234098);
  assert.strictEqual(byId.exact.verdict, 'too large');
  assert.strictEqual(membership.winner.id, 'bloom');

  quotes(entry, ['Bloom 1%:      25 903 B, measured 1.045%  — usable',
    'blocked Bloom:  25 920 B, measured 1.200%  — usable',
    'cuckoo f = 8:   32 768 B, measured 2.005%  — too inaccurate',
    'a Set:       1 234 098 B, exact           — too large',
    'the 1% Bloom filter, at 25 903 bytes']);
});

test('choosing-sketches: distinct, frequency and hot-key rankings match the example', function () {
  const entry = example('choosing-sketches');

  const distinct = SketchChooser.recommend({
    question: 'distinct', budget: 65536, tolerance: 0.02, probes: 4000, seed: 3
  });
  const distinctById = {};
  distinct.rows.forEach(function (row) { distinctById[row.id] = row; });
  assert.strictEqual(distinctById.hll10.bytes, 768);
  assert.strictEqual((distinctById.hll10.error * 100).toFixed(3), '0.318');
  assert.strictEqual(distinctById.hll12.bytes, 3072);
  assert.strictEqual(distinctById.hll14.bytes, 12288);
  assert.strictEqual(distinct.winner.id, 'hll10');
  assert.strictEqual(Math.round(distinctById.exact.bytes / 768), 1607);

  const frequency = SketchChooser.recommend({
    question: 'frequency', budget: 65536, tolerance: 0.02, probes: 4000, seed: 3
  });
  const frequencyById = {};
  frequency.rows.forEach(function (row) { frequencyById[row.id] = row; });
  assert.strictEqual(frequencyById['cm-cons'].bytes, 10240);
  assert.strictEqual((frequencyById['cm-cons'].error * 100).toFixed(2), '4.49');
  assert.strictEqual(frequencyById['cm-large'].bytes, 81920);
  assert.strictEqual(frequency.winner, null, 'nothing fits at 64 KB and 2%');

  const heavy = SketchChooser.recommend({
    question: 'heavy', budget: 65536, tolerance: 0.02, probes: 4000, seed: 3
  });
  const heavyById = {};
  heavy.rows.forEach(function (row) { heavyById[row.id] = row; });
  assert.strictEqual(heavyById.ss200.bytes, 8000);
  assert.strictEqual(heavyById.ss200.error, 0);
  assert.strictEqual(heavyById.ss50.bytes, 2000);
  assert.strictEqual(Math.round(heavyById.ss50.error * 20), 9, '9 of the true top 20 missed');
  assert.strictEqual(heavy.winner.id, 'ss200');

  quotes(entry, ['HLL p = 10:   768 B, 0.318%  — usable', 'p = 10, at 768 bytes and 1 607× smaller than exact',
    'count-min 256 × 5, conservative: 10 240 B, worst relative error over the top 100: 4.49%',
    'no candidate meets both constraints',
    'space-saving 200 counters:  8 000 B, 0 of the true top 20 missed',
    'space-saving 50 counters:   2 000 B, 9 of 20 missed']);
});

test('choosing-sketches: the two attacks cost what the example says', function () {
  const entry = example('choosing-sketches', 1);

  const one = SketchChooser.filterAttack({ n: 5000, p: 0.01, want: 50, budget: 400000 });
  assert.strictEqual(one.found, 50);
  assert.strictEqual(one.examined, 5179);
  assert.strictEqual(one.perHit.toFixed(1), '103.6');
  assert.strictEqual(one.transferred, 0);
  assert.strictEqual(one.expectedPerHit.toFixed(1), '99.6');

  const ten = SketchChooser.filterAttack({ n: 5000, p: 0.1, want: 50, budget: 400000 });
  assert.strictEqual(ten.perHit.toFixed(1), '9.0');
  const tight = SketchChooser.filterAttack({ n: 5000, p: 0.001, want: 50, budget: 400000 });
  assert.strictEqual(tight.perHit.toFixed(1), '967.7');

  const flood = SketchChooser.sketchAttack({
    width: 32, depth: 3, want: 8, budget: 600000, honest: 100, perAttacker: 5000
  });
  assert.strictEqual(flood.found, 8);
  assert.strictEqual(flood.examined, 305021);
  assert.strictEqual(flood.expectedPerHit, 32768);
  assert.strictEqual(flood.before, 100);
  assert.strictEqual(flood.after, 40100);
  assert.strictEqual(flood.productionCost.toExponential(2), '3.60e+16');

  quotes(entry, ['target 1%: 50 false positives from 5 179 probes — 103.6 each',
    '1/ε predicts 99.6', 'target 10%:  9.0 probes per hit', 'target 0.1%: 967.7',
    'reported present: 0', 'find keys colliding with a victim in all 3 rows: 8 found in 305 021 probes',
    'victim goes from 100 to 40 100', 'a 2 048 × 5 sketch: w^d = 3.60 × 10¹⁶ candidates per collision']);
});
