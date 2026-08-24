'use strict';

/**
 * Every figure the M21.1-M21.3 content quotes, recomputed from the harnesses
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
const CacheLab = require('../../src/js/machines/cache-lab.js');

require('../../src/js/content/concepts-online.js');
require('../../src/js/content/examples-online.js');
const prose = require('../support/worked-example-prose.js');

function rowFor(rows, key, field) {
  return rows.filter(function (row) { return row[field || 'policy'] === key; })[0];
}

/* ------------------------------------------------ 21.1 competitive ratio */

test('competitive-analysis: the break-even rule attains 2 - 1/B at five prices', function () {
  const sweep = OnlineLab.skiPriceSweep({});
  const seen = {};

  sweep.rows.forEach(function (row) {
    assert.strictEqual(row.matchesBound, true, 'B=' + row.buyPrice + ' must attain its bound');
    assert.strictEqual(row.worstAt, row.buyPrice, 'attained on day B');
    seen[row.buyPrice] = prose.fixed(row.worst, 4);
  });
  assert.strictEqual(seen[2], '1.5000');
  assert.strictEqual(seen[4], '1.7500');
  assert.strictEqual(seen[10], '1.9000');
  assert.strictEqual(seen[25], '1.9600');
  assert.strictEqual(seen[100], '1.9900');

  prose.quotes('competitive-analysis',
    ['1.5000', '1.7500', '1.9000', '1.9600', '1.9900', '2 − 1/B']);
});

test('competitive-analysis: the worst case and the mean rank the strategies differently', function () {
  const study = OnlineLab.skiStudy({ buyPrice: 10, trials: 2000 });
  const rows = study.deterministic.rows;
  const worstOf = function (name) {
    return rows.filter(function (row) { return row.strategy.name === name; })[0];
  };
  const breakEven = worstOf('break-even');
  const buyNow = worstOf('buy immediately');

  assert.strictEqual(prose.fixed(breakEven.worst, 4), '1.9000');
  assert.strictEqual(prose.fixed(breakEven.mean, 4), '1.6300');
  assert.strictEqual(prose.fixed(buyNow.worst, 4), '10.0000');
  assert.strictEqual(prose.fixed(buyNow.mean, 4), '1.6430');
  assert.ok((buyNow.mean - breakEven.mean) / breakEven.mean < 0.02,
    'the mean makes a 5x worse strategy look about 1% worse - that is the point of the row');
  assert.strictEqual(prose.fixed(worstOf('never buy').worst, 4), '3.0000');

  prose.quotes('competitive-analysis', ['1.6300', '1.6430', '10.0000', '3.0000']);
});

test('competitive-analysis: randomisation helps against one adversary and not the other', function () {
  const study = OnlineLab.skiStudy({ buyPrice: 10, trials: 2000 });

  assert.strictEqual(prose.fixed(study.randomised.obliviousWorst, 4), '1.5625');
  assert.strictEqual(prose.fixed(study.randomised.adaptiveMean, 4), '3.1428');
  assert.ok(study.randomised.obliviousWorst < 1.9,
    'against a fixed sequence it must beat the deterministic 1.9');

  prose.quotes('competitive-analysis', ['1.5625', '3.1428']);
});

test('competitive-analysis: list update on three families, against the best static order', function () {
  const study = OnlineLab.listStudy({ size: 20 });
  const ratios = {};

  study.families.forEach(function (family) {
    ratios[family.name] = {};
    family.study.rows.forEach(function (row) {
      ratios[family.name][row.policy] = prose.fixed(row.ratio, 4);
    });
  });
  const zipf = ratios['Zipf (a stationary distribution)'];
  const bursty = ratios['bursty (a working set that moves)'];
  const sweep = ratios['reverse sweep (the worst case for move-to-front)'];

  assert.strictEqual(zipf.none, '1.2850');
  assert.strictEqual(zipf.transpose, '1.0679');
  assert.strictEqual(zipf['move-to-front'], '1.2399');
  assert.strictEqual(zipf['frequency-count'], '1.0177');

  assert.strictEqual(bursty['move-to-front'], '0.3113');
  assert.ok(Number(bursty['move-to-front']) < 1,
    'an online policy beating the best STATIC order is the point of this row');
  assert.strictEqual(sweep['move-to-front'], '1.8964');

  prose.quotes('competitive-analysis', ['1.0679', '1.2399', '0.3113', '0.7278', '1.8964']);
});

/* --------------------------------------------------- 21.2 page replacement */

test('page-replacement: seven policies and Belady on the mixed trace', function () {
  const study = CacheLab.compare({ kind: 'mixed', capacity: 100, length: 20000 });
  const rate = function (name) {
    return prose.fixed(rowFor(study.rows, name, 'name').hitRate * 100, 1);
  };

  assert.strictEqual(study.distinct, 5480, 'the trace touches 5 480 distinct keys');
  assert.strictEqual(prose.fixed(study.optimum.hitRate * 100, 1), '72.6');
  assert.strictEqual(rate('fifo'), '58.7');
  assert.strictEqual(rate('lru'), '58.7');
  assert.strictEqual(rate('clock'), '58.7');
  assert.strictEqual(rate('lfu'), '72.5');
  assert.strictEqual(rate('arc'), '72.5');
  assert.strictEqual(rate('w-tinylfu'), '72.5');
  assert.strictEqual(rate('two-queue'), '67.8');

  prose.quotes('page-replacement', ['72.6', '72.5', '67.8', '58.7', '5 480', '20 000']);
});

test('page-replacement: the loop trace is where every recency policy reads zero', function () {
  const study = CacheLab.compare({ kind: 'loop', capacity: 100, length: 20000 });
  const rate = function (name) {
    return prose.fixed(rowFor(study.rows, name, 'name').hitRate * 100, 1);
  };

  assert.strictEqual(rate('fifo'), '0.0');
  assert.strictEqual(rate('lru'), '0.0');
  assert.strictEqual(rate('clock'), '0.0');
  assert.strictEqual(rate('w-tinylfu'), '81.9');
  assert.strictEqual(prose.fixed(study.optimum.hitRate * 100, 1), '82.7');

  prose.quotes('page-replacement', ['0.0%', '81.9%', '82.7%']);
});

test('page-replacement: the scan-resistance table separates the same policies', function () {
  const study = CacheLab.scanResistance({ capacity: 100 });
  const row = function (name) { return rowFor(study.rows, name, 'name'); };

  assert.strictEqual(prose.fixed(study.zipfOptimum * 100, 1), '70.7');
  assert.strictEqual(prose.fixed(study.scanOptimum * 100, 1), '33.5');
  assert.strictEqual(prose.fixed(row('lru').scan * 100, 1), '20.8');
  assert.strictEqual(prose.fixed(row('w-tinylfu').zipf * 100, 1), '56.3');
  assert.ok(row('w-tinylfu').scan > row('lru').scan,
    'admission control has to survive the scan that evicts LRU’s working set');
  assert.strictEqual(prose.fixed(row('lru').scan / row('lru').zipf * 100, 0), '45',
    'LRU retains 45% of its Zipf hit rate once a sweep is added');

  prose.quotes('page-replacement', '45%');
});

/* ------------------------------------------------- 21.3 online scheduling */

test('online-scheduling: Graham’s bound and the tighter LPT bound, against exact optima', function () {
  const study = OnlineLab.schedulingStudy({ machines: 4, jobs: 8, instances: 40 });

  assert.strictEqual(prose.fixed(study.onlineWorst, 4), '1.5000');
  assert.strictEqual(prose.fixed(study.lptWorst, 4), '1.0455');
  assert.strictEqual(prose.fixed(study.onlineBound, 4), '1.7500');
  assert.strictEqual(prose.fixed(study.lptBound, 4), '1.2500');
  assert.ok(study.onlineWorst <= study.onlineBound, 'the measurement must respect its bound');
  assert.ok(study.lptWorst <= study.lptBound, 'and so must the sorted one');

  prose.quotes('online-scheduling', ['1.5000', '1.0455', '1.7500', '1.2500']);
});

test('online-scheduling: the trap attains 2 - 1/m exactly and sorting removes it', function () {
  const trap = OnlineLab.schedulingStudy({ machines: 4, jobs: 8, instances: 40 }).trap;

  assert.strictEqual(prose.fixed(trap.onlineRatio, 4), '1.7500');
  assert.strictEqual(prose.fixed(trap.lptRatio, 4), '1.0000');
  assert.strictEqual(trap.online, 7);
  assert.strictEqual(trap.optimum, 4);
  assert.strictEqual(trap.jobs, 13);

  prose.quotes('online-scheduling', ['1.7500', '1.0000', '13']);
});

test('online-scheduling: two choices flattens the maximum load as the bins grow', function () {
  const sweep = OnlineLab.choicesStudy({});
  const row = function (n) {
    return sweep.rows.filter(function (r) { return r.n === n; })[0];
  };

  assert.strictEqual(prose.fixed(row(100).one, 2), '4.33');
  assert.strictEqual(prose.fixed(row(25600).one, 2), '6.83');
  assert.strictEqual(prose.fixed(row(25600).two, 2), '3.08');
  assert.ok(row(25600).one - row(100).one > row(25600).two - row(100).two,
    'one choice must grow faster than two across the sweep');

  prose.quotes('online-scheduling', ['6.83', '3.08']);
});

test('online-scheduling: virtual nodes flatten the ring and keep the moved share near 1/m', function () {
  const study = OnlineLab.ringStudy({});
  const row = function (replicas) {
    return study.rows.filter(function (r) { return r.replicas === replicas; })[0];
  };

  assert.strictEqual(prose.fixed(row(1).imbalance, 4), '4.4696');
  assert.strictEqual(prose.fixed(row(256).imbalance, 4), '1.0848');
  assert.ok(row(256).movedOnRemoval < 0.08,
    'removing a machine must move about a sixteenth of the keys, not more');
  assert.strictEqual(study.machines, 16, 'the default ring is sixteen machines');
  assert.strictEqual(prose.fixed(row(256).movedOnRemoval * 100, 2), '6.16');
  assert.strictEqual(prose.fixed(row(256).idealMove * 100, 2), '6.25');

  prose.quotes('online-scheduling', ['6.16%', '6.25%']);
});
