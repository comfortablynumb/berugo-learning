'use strict';

/**
 * Every figure the M08.7-M08.9 worked examples quote, recomputed against the
 * same generators, seeds and parameters the demos use - and checked to still
 * be present in the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const AnnIndex = require('../../src/js/algorithms/ann-index.js');
const Hnsw = require('../../src/js/algorithms/hnsw.js');
const KdTree = require('../../src/js/algorithms/kd-tree.js');
const BroadPhase = require('../../src/js/algorithms/broad-phase.js');
const RangeLab = require('../../src/js/machines/range-lab.js');
const VectorLab = require('../../src/js/machines/vector-lab.js');
const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-spatial-search.js');
require('../../src/js/content/concepts-spatial-search.js');

function proseFor(sectionId) {
  const examples = registries.ExampleRegistry.get(sectionId) || [];
  const concepts = registries.ConceptRegistry.get(sectionId) || [];
  return examples.map(function (example) {
    return [example.goal, example.setup, example.answer].concat(
      example.steps.map(function (step) { return step.do + ' ' + step.why + ' ' + step.work + ' ' + step.result; })
    ).join(' ');
  }).join(' ') + ' ' + concepts.map(function (concept) {
    return concept.plain + ' ' + concept.formal + ' ' +
      (Array.isArray(concept.detail) ? concept.detail.join(' ') : concept.detail) + ' ' + concept.example;
  }).join(' ');
}

function quotes(sectionId, figure) {
  assert.ok(proseFor(sectionId).indexOf(figure) !== -1,
    'the ' + sectionId + ' content no longer quotes "' + figure + '"');
}

function fixed(value, digits) {
  return value.toFixed(digits === undefined ? 2 : digits);
}

/* ------------------------------------------------ 8.7 range structures */

test('range-structures: four sum structures over the same operation stream', function () {
  const result = RangeLab.compare({ n: 8192, count: 20000, seed: 6, updateShare: 0.5 });
  const rows = {};
  result.rows.forEach(function (row) { rows[row.id] = row; });

  assert.strictEqual(fixed(rows['prefix-sums'].slotsPerUpdate), '4088.88');
  assert.strictEqual(fixed(rows['prefix-sums'].slotsPerQuery), '2.00');
  assert.strictEqual(fixed(rows['prefix-sums'].bytesPerElement), '16.00');
  assert.strictEqual(fixed(rows.fenwick.slotsPerUpdate), '7.49');
  assert.strictEqual(fixed(rows.fenwick.slotsPerQuery), '13.01');
  assert.strictEqual(fixed(rows.fenwick.bytesPerElement), '8.00');
  assert.strictEqual(fixed(rows['segment-tree'].slotsPerUpdate), '14.00');
  assert.strictEqual(fixed(rows['segment-tree'].slotsPerQuery), '44.90');
  assert.strictEqual(fixed(rows['segment-tree'].bytesPerElement), '32.00');
  assert.strictEqual(fixed(rows['sqrt-blocks'].slotsPerUpdate), '91.00');
  assert.strictEqual(fixed(rows['sqrt-blocks'].slotsPerQuery), '118.40');
  assert.strictEqual(fixed(rows['sqrt-blocks'].bytesPerElement), '8.09');

  ['4 088.88', '2.00', '16.00', '7.49', '13.01', '8.00', '14.00', '44.90', '32.00',
    '91.00', '118.40', '8.09'].forEach(function (figure) { quotes('range-structures', figure); });

  result.rows.forEach(function (row) { assert.strictEqual(row.mismatches, 0); });
  assert.strictEqual(result.cheapest.id, 'fenwick');
  assert.strictEqual(fixed(Math.log2(8192), 0), '13');
  assert.strictEqual(fixed(Math.sqrt(8192), 1), '90.5');
  assert.strictEqual(fixed(44.90 / 13.01, 1), '3.5');
  assert.strictEqual(fixed(91.00 / 7.49, 1), '12.1');
  assert.strictEqual(fixed(4088.88 / 7.49, 0), '546');
  ['log₂ 8 192 = 13', '√8 192 = 90.5', '3.5×', '12×', '546×'].forEach(function (figure) {
    quotes('range-structures', figure);
  });
});

test('range-structures: the constants hold across the size sweep', function () {
  const rows = {};
  [64, 1024, 8192, 65536].forEach(function (n) {
    const result = RangeLab.compare({
      n: n, count: 4000, seed: 6, updateShare: 0.5, include: ['fenwick', 'segment-tree']
    });
    rows[n] = {};
    result.rows.forEach(function (row) { rows[n][row.id] = row; });
  });

  const expected = {
    64: ['4.0', '5.9', '7.0', '17.4'],
    1024: ['6.0', '10.0', '11.0', '32.9'],
    8192: ['7.5', '13.0', '14.0', '44.9'],
    65536: ['9.0', '16.0', '17.0', '56.9']
  };

  Object.keys(expected).forEach(function (n) {
    const row = rows[n];
    assert.strictEqual(fixed(row.fenwick.slotsPerUpdate, 1), expected[n][0], 'n = ' + n);
    assert.strictEqual(fixed(row.fenwick.slotsPerQuery, 1), expected[n][1], 'n = ' + n);
    assert.strictEqual(fixed(row['segment-tree'].slotsPerUpdate, 1), expected[n][2], 'n = ' + n);
    assert.strictEqual(fixed(row['segment-tree'].slotsPerQuery, 1), expected[n][3], 'n = ' + n);
    expected[n].forEach(function (figure) { quotes('range-structures', figure); });
  });

  assert.strictEqual(fixed(17.4 / 5.9, 1), '2.9');
  assert.strictEqual(fixed(56.9 / 16.0, 1), '3.6');
  ['2.9×', '3.6×'].forEach(function (figure) { quotes('range-structures', figure); });
});

test('range-structures: lazy propagation, the sparse table and the merge-sort tree', function () {
  const lazy = RangeLab.lazyRun({ n: 8192, count: 100000, seed: 6 });
  assert.strictEqual(lazy.mismatches, 0);
  assert.strictEqual(fixed(lazy.slotsPerOperation), '44.99');
  assert.strictEqual(lazy.bytes, 524288);
  ['44.99', '524 288'].forEach(function (figure) { quotes('range-structures', figure); });

  const table = RangeLab.idempotentRun({ n: 8192, count: 20000, seed: 6 });
  assert.strictEqual(table.mismatches, 0);
  assert.strictEqual(fixed(table.tableSlotsPerQuery), '2.00');
  assert.strictEqual(fixed(table.treeSlotsPerQuery), '44.94');
  assert.strictEqual(fixed(table.memoryRatio), '3.00');
  assert.strictEqual(table.levels, 14);
  ['44.94', '3.00×', '14 levels'].forEach(function (figure) { quotes('range-structures', figure); });

  const order = RangeLab.orderStatisticRun({ n: 8192, count: 2000, seed: 6 });
  assert.strictEqual(order.mismatches, 0);
  assert.strictEqual(fixed(order.nodesPerQuery), '44.85');
  assert.strictEqual(fixed(order.comparisonsPerQuery), '57.78');
  assert.strictEqual(fixed(order.bytesPerElement, 0), '112');
  ['44.85', '57.78', '112 bytes'].forEach(function (figure) { quotes('range-structures', figure); });
  assert.strictEqual(Math.round(112 / 8), 14);
  quotes('range-structures', 'fourteen times a Fenwick tree');
});

test('range-structures: the canonical decomposition the diagram draws', function () {
  const result = RangeLab.decomposition({
    values: RangeLab.values({ n: 8192, seed: 6 }), from: 1234, to: 6789
  });

  assert.strictEqual(result.count, 12);
  assert.strictEqual(result.bound, 26);
  assert.strictEqual(result.span, 5556);
  assert.deepStrictEqual(result.nodes.slice(0, 3).map(function (node) { return node.lo + '-' + node.hi; }),
    ['1234-1235', '1236-1239', '1240-1247']);
  assert.strictEqual(result.nodes[result.nodes.length - 1].hi, 6789);

  ['[1234, 6789] of 8 192 decomposes into 12 nodes',
    '1234-1235, 1236-1239, 1240-1247'].forEach(function (figure) {
    quotes('range-structures', figure);
  });
});

/* -------------------------------------------------- 8.8 vector search */

const vectors = VectorLab.vectors({ count: 3000, dims: 48, clusters: 24, seed: 7 });
const questions = VectorLab.queries({ count: 60, dims: 48, clusters: 24, seed: 7 });
const truth = VectorLab.truthFor(vectors, questions, 10);

test('vector-search: no exact index prunes at 48 dimensions', function () {
  const vp = VectorLab.score(AnnIndex.vpTree(vectors, { leafSize: 16, seed: 7 }), questions, truth, 10);
  assert.strictEqual(vp.recall, 1);
  assert.strictEqual(fixed(vp.distancesPerQuery), '2992.67');

  const kd = KdTree.build(vectors.map(function (v) { return { id: v.id, p: v.v }; }), { leafSize: 8 });
  kd.resetStats();
  questions.forEach(function (query) { kd.nearest(query); });
  assert.strictEqual(fixed(kd.stats().distanceComputations / questions.length), '3000.00');
  assert.strictEqual(fixed(2992.67 / 3000 * 100), '99.76');

  ['2 992.67', '3 000.00', '99.76%'].forEach(function (figure) { quotes('vector-search', figure); });
});

test('vector-search: one HNSW graph, six operating points', function () {
  const graph = Hnsw.build(vectors, { M: 8, efConstruction: 100, seed: 7 });
  const shape = graph.shape();

  assert.deepStrictEqual(shape.perLayer.map(function (layer) { return layer.nodes; }), [3000, 375, 60, 8]);
  assert.strictEqual(shape.links, 51536);
  ['3 000 nodes', '375 nodes', '60 nodes', '8 nodes', '51 536 links'].forEach(function (figure) {
    quotes('vector-search', figure);
  });

  const rows = {};
  VectorLab.sweep({
    vectors: vectors, queries: questions, truth: truth, index: graph, k: 10,
    values: [10, 16, 32, 64, 128, 256]
  }).forEach(function (row) { rows[row.value] = row; });

  const expected = {
    10: ['58.8', '146.87', '20.43'],
    16: ['69.8', '181.87', '16.50'],
    32: ['83.0', '252.85', '11.86'],
    64: ['94.8', '380.30', '7.89'],
    128: ['99.0', '554.13', '5.41'],
    256: ['100.0', '863.60', '3.47']
  };

  Object.keys(expected).forEach(function (ef) {
    assert.strictEqual(fixed(rows[ef].recall * 100, 1), expected[ef][0], 'ef ' + ef);
    assert.strictEqual(fixed(rows[ef].distancesPerQuery), expected[ef][1], 'ef ' + ef);
    assert.strictEqual(fixed(rows[ef].speedup), expected[ef][2], 'ef ' + ef);
    quotes('vector-search', expected[ef][0] + '%');
    quotes('vector-search', expected[ef][1].replace(/^(\d)(\d\d\d)/, '$1 $2'));
  });
  ['20.43×', '16.50×', '11.86×', '7.89×', '5.41×', '3.47×'].forEach(function (figure) {
    quotes('vector-search', figure);
  });
});

test('vector-search: efConstruction cannot be recovered at query time', function () {
  const rows = {};
  [24, 48, 100].forEach(function (efc) {
    const graph = Hnsw.build(vectors, { M: 8, efConstruction: efc, seed: 7 });
    rows[efc] = VectorLab.score(VectorLab.efWrapper(graph, 200), questions, truth, 10);
  });

  assert.strictEqual(fixed(rows[24].recall * 100, 1), '94.3');
  assert.strictEqual(fixed(rows[48].recall * 100, 1), '96.2');
  assert.strictEqual(fixed(rows[100].recall * 100, 1), '99.8');
  ['94.3%', '96.2%', '99.8%'].forEach(function (figure) { quotes('vector-search', figure); });
});

test('vector-search: IVF probing, and the quantiser that needs re-ranking', function () {
  const ivf = AnnIndex.ivf(vectors, { lists: 64, seed: 7 });
  const rows = {};
  [1, 4, 8, 32].forEach(function (probe) {
    rows[probe] = VectorLab.score(VectorLab.probeWrapper(ivf, probe), questions, truth, 10);
  });

  assert.strictEqual(fixed(rows[1].recall * 100, 1), '32.5');
  assert.strictEqual(fixed(rows[1].distancesPerQuery), '109.37');
  assert.strictEqual(fixed(rows[4].recall * 100, 1), '79.7');
  assert.strictEqual(fixed(rows[4].distancesPerQuery), '248.47');
  assert.strictEqual(fixed(rows[8].recall * 100, 1), '95.0');
  assert.strictEqual(fixed(rows[8].distancesPerQuery), '442.83');
  assert.strictEqual(fixed(rows[32].recall * 100, 1), '100.0');
  assert.strictEqual(fixed(rows[32].distancesPerQuery), '1566.53');
  ['32.5%', '109.37', '79.7%', '248.47', '95.0%', '442.83', '1 566.53'].forEach(function (figure) {
    quotes('vector-search', figure);
  });

  const pq = AnnIndex.productQuantiser(vectors, { parts: 8, centroids: 256, seed: 7 });
  const raw = VectorLab.score(pq, questions, truth, 10);
  assert.strictEqual(fixed(raw.recall * 100, 1), '39.5');
  assert.strictEqual(fixed(raw.topHitRate * 100, 1), '10.0');
  assert.strictEqual(fixed(raw.distancesPerQuery, 0), '2048');
  assert.strictEqual(fixed(raw.bytesPerVector, 1), '40.8');
  assert.strictEqual(8 * 256, 2048);
  ['39.5%', '10.0%', '2 048', '40.8'].forEach(function (figure) { quotes('vector-search', figure); });

  const rerank = {};
  [1, 5, 10, 20, 50].forEach(function (widen) {
    rerank[widen] = VectorLab.score(VectorLab.reranked(pq, vectors, widen), questions, truth, 10);
  });
  assert.strictEqual(fixed(rerank[5].recall * 100, 1), '83.3');
  assert.strictEqual(fixed(rerank[10].recall * 100, 1), '95.0');
  assert.strictEqual(fixed(rerank[20].recall * 100, 1), '99.0');
  assert.strictEqual(fixed(rerank[50].recall * 100, 1), '99.8');
  assert.strictEqual(fixed(rerank[10].distancesPerQuery, 0), '2148');
  assert.strictEqual(fixed(rerank[10].bytesPerVector, 1), '424.8');
  ['83.3%', '2 148', '424.8'].forEach(function (figure) { quotes('vector-search', figure); });
  assert.strictEqual(48 * 8, 384);
  assert.strictEqual(384 / 8, 48);
  quotes('vector-search', '48 float64 = 384 bytes');
});

/* --------------------------------------------------- 8.9 broad phase */

const BOX = { minX: 0, minY: 0, maxX: 800, maxY: 600 };

test('broad phase: three phases, the same pairs, 726x the work', function () {
  const scene = BroadPhase.world({ count: 400, seed: 8, speed: 60, radius: 6, bounds: BOX });
  const rows = {};
  BroadPhase.phases.forEach(function (phase) {
    rows[phase] = BroadPhase.run({
      world: scene, frames: 120, phase: phase, dt: 1 / 30, checkTunnelling: true
    });
  });

  assert.strictEqual(fixed(rows.brute.testsPerFrame), '79800.00');
  assert.strictEqual(fixed(rows.sap.testsPerFrame), '2370.47');
  assert.strictEqual(fixed(rows.hash.testsPerFrame), '109.97');
  BroadPhase.phases.forEach(function (phase) {
    assert.strictEqual(fixed(rows[phase].pairsPerFrame), '70.78');
  });
  assert.strictEqual(400 * 399 / 2, 79800);

  ['79 800', '2 370.47', '109.97', '70.78'].forEach(function (figure) { quotes('broad-phase', figure); });
  assert.strictEqual(fixed(rows.brute.testsPerFrame / rows.brute.pairsPerFrame, 1), '1127.5');
  assert.strictEqual(fixed(rows.brute.testsPerFrame / rows.sap.testsPerFrame, 1), '33.7');
  assert.strictEqual(fixed(rows.brute.testsPerFrame / rows.hash.testsPerFrame, 0), '726');
  assert.strictEqual(fixed(rows.sap.testsPerFrame / rows.hash.testsPerFrame, 1), '21.6');
  ['1 127.5 tests per pair', '33.7×', '726×', '21.6×'].forEach(function (figure) {
    quotes('broad-phase', figure);
  });
});

test('broad phase: temporal coherence in the swap counter', function () {
  const scene = BroadPhase.world({ count: 400, seed: 8, speed: 60, radius: 6, bounds: BOX });
  const run = BroadPhase.run({ world: scene, frames: 120, phase: 'sap', dt: 1 / 30 });
  const later = run.frames.slice(1).reduce(function (total, frame) { return total + frame.swaps; }, 0) / 119;

  assert.strictEqual(run.frames[0].swaps, 41177);
  assert.strictEqual(run.frames[1].swaps, 165);
  assert.strictEqual(fixed(later), '164.15');
  assert.strictEqual(400 * 400 / 4, 40000);
  assert.strictEqual(fixed(164.15 / 41177 * 100, 1), '0.4');

  ['41 177', '165 swaps', '164.15', 'n²/4 = 40 000', '0.4%'].forEach(function (figure) {
    quotes('broad-phase', figure);
  });
});

test('broad phase: tunnelling against travel per step, and against the step', function () {
  const rows = {};
  [15, 60, 150, 300, 600, 1200].forEach(function (speed) {
    const run = BroadPhase.run({
      world: BroadPhase.world({ count: 400, seed: 8, speed: speed, radius: 6, bounds: BOX }),
      frames: 120, phase: 'sap', dt: 1 / 30, checkTunnelling: true
    });
    rows[speed] = { missed: run.missed, reported: run.reported, diameters: (speed / 30) / 12 };
  });

  assert.deepStrictEqual(
    [rows[15].missed, rows[60].missed, rows[150].missed, rows[300].missed, rows[600].missed, rows[1200].missed],
    [0, 1, 61, 520, 4510, 15445]);
  assert.deepStrictEqual(
    [rows[15].reported, rows[60].reported, rows[150].reported, rows[300].reported, rows[600].reported, rows[1200].reported],
    [8509, 8493, 8934, 9082, 9174, 9276]);
  assert.strictEqual(fixed(rows[15].diameters), '0.04');
  assert.strictEqual(fixed(rows[150].diameters), '0.42');
  assert.strictEqual(fixed(rows[300].diameters), '0.83');
  assert.strictEqual(fixed(rows[600].diameters), '1.67');
  assert.strictEqual(fixed(rows[1200].diameters), '3.33');

  ['0 missed of 8 509', '1 missed of 8 493', '61 missed of 8 934', '520 missed of 9 082',
    '4 510 missed of 9 174', '15 445 missed of 9 276', '0.04', '0.42', '0.83', '1.67', '3.33']
    .forEach(function (figure) { quotes('broad-phase', figure); });

});

test('broad phase: shrinking the step is the blunt fix, and it works', function () {
  const steps = {};
  [30, 60, 120, 240].forEach(function (rate) {
    const run = BroadPhase.run({
      world: BroadPhase.world({ count: 400, seed: 8, speed: 600, radius: 6, bounds: BOX }),
      frames: Math.round(4 * rate), phase: 'sap', dt: 1 / rate, checkTunnelling: true
    });
    steps[rate] = { missed: run.missed, rate: run.missed / (run.reported + run.missed) };
  });

  assert.strictEqual(fixed(steps[30].rate * 100), '32.96');
  assert.strictEqual(fixed(steps[60].rate * 100), '5.14');
  assert.strictEqual(fixed(steps[120].rate * 100), '0.66');
  assert.strictEqual(fixed(steps[240].rate * 100), '0.07');
  assert.deepStrictEqual([steps[30].missed, steps[60].missed, steps[120].missed, steps[240].missed],
    [4510, 1007, 247, 55]);
  ['32.96%', '5.14%', '0.66%', '0.07%', '4 510 → 1 007 → 247 → 55'].forEach(function (figure) {
    quotes('broad-phase', figure);
  });

});

test('broad phase: faster bodies also cost the sort more', function () {
  const swaps = {};
  [15, 60, 600, 1200].forEach(function (speed) {
    const run = BroadPhase.run({
      world: BroadPhase.world({ count: 400, seed: 8, speed: speed, radius: 6, bounds: BOX }),
      frames: 120, phase: 'sap', dt: 1 / 30
    });
    swaps[speed] = run.totals.swaps / 120;
  });
  assert.strictEqual(fixed(swaps[15]), '383.57');
  assert.strictEqual(fixed(swaps[60]), '505.93');
  assert.strictEqual(fixed(swaps[600]), '1950.82');
  assert.strictEqual(fixed(swaps[1200]), '3505.43');
  assert.strictEqual(fixed(3505.43 / 383.57, 0), '9');
  ['383.57', '505.93', '1 950.82', '3 505.43', '9×'].forEach(function (figure) {
    quotes('broad-phase', figure);
  });
});

test('broad phase: the hand-made instance no discrete phase can see', function () {
  const a = { id: 0, x: 0, y: 0, vx: 0, vy: 0, r: 1 };
  const b = { id: 1, x: 20, y: 0, vx: -1200, vy: 0, r: 1 };
  const dt = 1 / 30;

  assert.strictEqual(b.x + b.vx * dt, -20);
  assert.strictEqual(BroadPhase.bruteForce().pairs([a, b]).length, 0);
  const contact = BroadPhase.sweptContact(a, b, dt);
  assert.ok(contact !== null);
  assert.strictEqual(fixed(contact, 3), '0.015');

  ['x = −20', '0.015 s', '0.033 s'].forEach(function (figure) { quotes('broad-phase', figure); });
});
