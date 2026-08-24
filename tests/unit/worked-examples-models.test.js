'use strict';

/**
 * Every figure the M21.7-M21.9 content quotes, recomputed from the harness and
 * then checked against the prose.
 *
 * The section controllers are not imported; the calls below reproduce what
 * they make at their default control settings, which is the contract this
 * suite is really pinning down - if a default moves, the prose is wrong and
 * this fails.
 */

const test = require('node:test');
const assert = require('node:assert');

const ModelLab = require('../../src/js/machines/model-lab.js');

require('../../src/js/content/concepts-models.js');
require('../../src/js/content/examples-models.js');
const prose = require('../support/worked-example-prose.js');

function named(rows, name, field) {
  return rows.filter(function (row) { return row[field || 'kind'] === name; })[0];
}

/* -------------------------------------------------------- 21.7 streaming */

test('streaming-model: the exact set is killed, and where', function () {
  const study = ModelLab.distinctStudy({ budget: 8192, length: 200000, universe: 20000 });

  assert.strictEqual(study.exact.killed, true, 'the budget is enforced, not warned about');
  assert.strictEqual(study.exact.at, 345, 'it died 345 items into the stream');
  assert.strictEqual(study.exact.bytes, 8208, 'at 8 208 bytes against a budget of 8 192');
  assert.strictEqual(study.exact.answer, null, 'so there is no exact answer at all');
  assert.strictEqual(study.truth, 19990, 'the stream holds 19 990 distinct values');
  assert.strictEqual(prose.grouped(study.truth * 24), '479 760',
    'the complete structure would need 479 760 bytes');

  prose.quotes('streaming-model', ['345', '200 000', '8 208', '8 192', '19 990', '479 760']);
});

test('streaming-model: HyperLogLog buys accuracy with registers at 1.04/√m', function () {
  const study = ModelLab.distinctStudy({ budget: 8192, length: 200000, universe: 20000 });
  const errorOf = function (kind) {
    return prose.fixed(named(study.sketches, kind).error * 100, 2);
  };
  const best = study.sketches.filter(function (row) { return row.withinBudget; })
    .reduce(function (winner, row) { return row.error < winner.error ? row : winner; });

  assert.strictEqual(errorOf('HyperLogLog p=4'), '11.30');
  assert.strictEqual(errorOf('HyperLogLog p=8'), '8.38');
  assert.strictEqual(errorOf('HyperLogLog p=12'), '4.33');
  assert.strictEqual(errorOf('HyperLogLog p=14'), '0.73');

  assert.strictEqual(named(study.sketches, 'HyperLogLog p=14').withinBudget, false,
    'the most accurate sketch is killed like the exact set was');
  assert.strictEqual(best.kind, 'HyperLogLog p=12', 'the best answer inside the budget');
  assert.strictEqual(best.bytes, 4096);
  assert.strictEqual(prose.grouped(best.answer), '20 855');

  const p8 = named(study.sketches, 'HyperLogLog p=8');

  assert.ok(p8.error > p8.predictedError,
    'the measured error must exceed the prediction here - the bias band is uncorrected');
  assert.strictEqual(prose.fixed(p8.predictedError * 100, 2), '6.50');

  prose.quotes('streaming-model',
    ['11.30%', '8.38%', '4.33%', '0.73%', '4 096', '20 855', '6.50%']);
});

test('streaming-model: the quantile sketches are scored on RANK', function () {
  const study = ModelLab.quantileStudy({ budget: 8192, length: 200000 });
  const worst = function (kind) {
    return prose.fixed(named(study.rows, kind).worstRankError * 100, 3);
  };
  const digest = named(study.rows, 't-digest');
  const rankAt = function (row, p) {
    return prose.fixed(row.errors.filter(function (e) { return e.p === p; })[0].rank, 4);
  };

  assert.strictEqual(rankAt(digest, 0.5), '0.5001');
  assert.strictEqual(rankAt(digest, 0.9), '0.8995');
  assert.strictEqual(rankAt(digest, 0.99), '0.9897');
  assert.strictEqual(digest.bytes, 928);
  assert.strictEqual(worst('t-digest'), '0.050');
  assert.strictEqual(worst('reservoir (1 000)'), '1.045');
  assert.strictEqual(worst('KLL'), '0.260');
  assert.ok(digest.worstRankError < named(study.rows, 'reservoir (1 000)').worstRankError,
    'the tail-focused sketch must beat the uniform one on the worst rank error');

  prose.quotes('streaming-model',
    ['0.5001', '0.8995', '0.9897', '928', '0.050%', '1.045%', '8 000']);
});

test('streaming-model: two of the five questions have no one-pass answer', function () {
  const rows = ModelLab.impossibilityTable();
  const impossible = rows.filter(function (row) { return row.possible === false; });

  assert.strictEqual(rows.length, 5, 'five questions');
  assert.strictEqual(impossible.length, 2, 'two of them are out of reach in one pass');
  assert.ok(impossible.some(function (row) { return /exactly once/.test(row.question); }),
    'the singleton question must be one of them');

  prose.quotes('streaming-model', ['2 of 5']);
});

/* ------------------------------------------------------ 21.8 work and span */

test('work-and-span: three scans, their work, their span and the price of each', function () {
  const study = ModelLab.scanStudy({ n: 256 });
  const row = function (name) { return named(study.rows, name, 'name'); };
  const sequential = row('sequential');
  const blelloch = row('blelloch (up-sweep / down-sweep)');
  const hillis = row('hillis–steele (not work-efficient)');

  assert.strictEqual(sequential.work, 256);
  assert.strictEqual(sequential.span, 256);
  assert.strictEqual(blelloch.work, 511);
  assert.strictEqual(blelloch.span, 17);
  assert.strictEqual(hillis.work, 1793);
  assert.strictEqual(hillis.span, 8);
  assert.strictEqual(prose.fixed(blelloch.work / blelloch.span, 1), '30.1');
  assert.strictEqual(prose.fixed(hillis.work / hillis.span, 1), '224.1');
  assert.strictEqual(prose.fixed(blelloch.work / sequential.work, 2), '2.00');
  assert.strictEqual(prose.fixed(hillis.work / sequential.work, 2), '7.00');
  assert.strictEqual(blelloch.correct, true, 'the work-efficient scan is checked against the loop');
  assert.strictEqual(study.logN, 8, '2·log₂(256) = 16, against a measured span of 17');

  prose.quotes('work-and-span',
    ['511', '17', '1 793', '30.1', '224.1', '2.00', '7.00', '256']);
});

test('work-and-span: the greedy schedule stays under Brent and floors at the span', function () {
  const study = ModelLab.scanStudy({ n: 256 });
  const blelloch = named(study.rows, 'blelloch (up-sweep / down-sweep)', 'name');
  const at = function (p) {
    return blelloch.schedules.filter(function (s) { return s.p === p; })[0];
  };

  blelloch.schedules.forEach(function (s) {
    assert.ok(s.time <= s.brent, 'p=' + s.p + ' exceeded Brent’s bound');
  });
  assert.strictEqual(at(1).time, 511);
  assert.strictEqual(at(1).brent, 528);
  assert.strictEqual(at(16).time, 39);
  assert.strictEqual(at(16).brent, 49);
  assert.strictEqual(at(256).time, 17);
  assert.strictEqual(at(256).brent, 19);
  assert.strictEqual(prose.fixed(at(256).speedup, 2), '30.06');
  assert.strictEqual(prose.fixed(at(1).utilisation * 100, 1), '100.0');
  assert.strictEqual(prose.fixed(at(16).utilisation * 100, 1), '81.9');
  assert.strictEqual(prose.fixed(at(256).utilisation * 100, 1), '11.7');
  assert.strictEqual(at(256).time, blelloch.span, 'the span is attained exactly');

  prose.quotes('work-and-span',
    ['528', '39', '49', '19', '30.06', '100.0%', '11.7%']);
});

test('work-and-span: Amdahl’s ceiling and Gustafson’s answer on the same fractions', function () {
  const study = ModelLab.speedupStudy({});
  const row = function (serial) {
    return study.rows.filter(function (r) { return Math.abs(r.serial - serial) < 1e-9; })[0];
  };
  const amdahlAt = function (serial, p) {
    return row(serial).amdahl.filter(function (cell) { return cell.p === p; })[0].speedup;
  };
  const gustafsonAt = function (serial, p) {
    return row(serial).gustafson.filter(function (cell) { return cell.p === p; })[0].speedup;
  };

  assert.strictEqual(row(0.001).ceiling, 1000);
  assert.strictEqual(row(0.01).ceiling, 100);
  assert.strictEqual(row(0.05).ceiling, 20);
  assert.strictEqual(row(0.2).ceiling, 5);

  assert.strictEqual(prose.fixed(amdahlAt(0.001, 1024), 1), '506.2');
  assert.strictEqual(prose.fixed(amdahlAt(0.01, 1024), 1), '91.2');
  assert.strictEqual(prose.fixed(amdahlAt(0.05, 1024), 1), '19.6');
  assert.strictEqual(prose.fixed(amdahlAt(0.05, 8), 1), '5.9');
  assert.strictEqual(prose.fixed(amdahlAt(0.2, 1024), 1), '5.0');

  assert.strictEqual(prose.fixed(gustafsonAt(0.001, 1024), 0), '1023');
  assert.strictEqual(prose.fixed(gustafsonAt(0.01, 1024), 0), '1014');
  assert.strictEqual(prose.fixed(gustafsonAt(0.05, 1024), 0), '973');
  assert.strictEqual(prose.fixed(gustafsonAt(0.2, 1024), 0), '819');
  assert.ok(amdahlAt(0.05, 1024) / amdahlAt(0.05, 8) < 4,
    '128 times the machine must buy well under four times the speed');

  prose.quotes('work-and-span',
    ['1000×', '100×', '20×', '5×', '506.2', '91.2', '19.6', '5.9', '5.0',
      '1023×', '1014×', '973×', '819×']);
});

/* ---------------------------------------------------- 21.9 cost models */

test('choosing-a-cost-model: four models, four units, one workload', function () {
  const study = ModelLab.bakeOff({ n: 65536, M: 4096 });
  const row = function (model) { return named(study.rows, model, 'model'); };

  assert.strictEqual(row('RAM (count comparisons)').prediction, 1048576);
  assert.strictEqual(row('cache-aware (count misses)').prediction, 10240);
  assert.strictEqual(row('external memory (count I/Os)').prediction, 4096);
  assert.strictEqual(row('parallel (count span)').prediction, 256);

  const units = study.rows.map(function (r) { return r.unit; });

  assert.strictEqual(new Set(units).size, 4, 'the four predictions are in four different units');
  assert.strictEqual(prose.grouped(1048576 / 256), '4 096',
    'the spread between largest and smallest is 4 096×');

  prose.quotes('choosing-a-cost-model',
    ['1 048 576', '10 240', '4 096', '256', 'comparisons', 'block transfers']);
});

test('choosing-a-cost-model: the one prediction that can be checked, is', function () {
  const study = ModelLab.bakeOff({ n: 65536, M: 4096 });

  assert.strictEqual(study.measured.transfers, study.measured.predicted,
    'the DAM prediction must match the simulator exactly');
  assert.strictEqual(study.measured.transfers, 1024);
  assert.strictEqual(study.measured.records, 16384, 'measured on 16 384 records');

  prose.quotes('choosing-a-cost-model', ['1 024', '16 384']);
});

test('choosing-a-cost-model: three of four access patterns are memory-bound', function () {
  const study = ModelLab.bindingResource({ lines: 64 });
  const row = function (name) { return named(study.rows, name, 'name'); };
  const waste = function (name) {
    return prose.fixed(row(name).bytesFetched / (row(name).accesses * 8), 1);
  };

  assert.strictEqual(row('sequential scan').misses, 512);
  assert.strictEqual(prose.fixed(row('sequential scan').missRate * 100, 1), '12.5');
  assert.strictEqual(waste('sequential scan'), '1.0');

  assert.strictEqual(row('stride of 8 doubles (one line)').accesses, 512);
  assert.strictEqual(row('stride of 8 doubles (one line)').misses, 512);
  assert.strictEqual(waste('stride of 8 doubles (one line)'), '8.0');
  assert.strictEqual(row('stride of 64 doubles (eight lines)').accesses, 64);
  assert.strictEqual(waste('stride of 64 doubles (eight lines)'), '8.0');

  assert.strictEqual(row('random probe').misses, 3604);
  assert.strictEqual(prose.fixed(row('random probe').missRate * 100, 1), '88.0');
  assert.strictEqual(waste('random probe'), '7.0');

  const bound = study.rows.filter(function (r) { return r.binding === 'memory'; });

  assert.strictEqual(bound.length, 3, 'three of the four patterns are memory-bound');
  assert.strictEqual(study.n, 4096, 'over the same 4 096-element array');

  prose.quotes('choosing-a-cost-model',
    ['12.5%', '100%', '88%', '1.0×', '8.0×', '7.0×', '3 604', '230 656', '3 of 4']);
});
