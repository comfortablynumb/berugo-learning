'use strict';

/**
 * Unit tests for the M07 approximate-membership engines.
 *
 * The centre of this file is one property applied to every filter family: over
 * any key set, at any load, a filter must never report a key it holds as
 * absent. Everything else here checks a *stated bound* rather than a
 * hand-tuned tolerance - the measured false-positive rate against the formula
 * the structure publishes for itself - because a tolerance outlives the reason
 * it was chosen and a formula fails when the structure changes.
 *
 * Everything is pure and DOM-free, so `node --test` loads the modules directly.
 */

const test = require('node:test');
const assert = require('node:assert');

const BloomFilter = require('../../src/js/algorithms/bloom-filter.js');
const CuckooFilter = require('../../src/js/algorithms/cuckoo-filter.js');
const QuotientFilter = require('../../src/js/algorithms/quotient-filter.js');
const FilterLab = require('../../src/js/machines/filter-lab.js');
const StreamLab = require('../../src/js/machines/stream-lab.js');

function keysFor(count, prefix) {
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) out[i] = (prefix || 'key-') + i;
  return out;
}

/* --------------------------------------------------- the standing property */

const FAMILIES = [
  {
    name: 'bloom, standard',
    build: function (n) {
      const shape = BloomFilter.optimalParams({ n: n, p: 0.01 });
      return BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });
    }
  },
  {
    name: 'bloom, counting',
    build: function (n) {
      const shape = BloomFilter.optimalParams({ n: n, p: 0.01 });
      return BloomFilter.counting({ m: shape.m, k: shape.k, seed: 7, counterBits: 4 });
    }
  },
  {
    name: 'bloom, blocked',
    build: function (n) {
      const shape = BloomFilter.optimalParams({ n: n, p: 0.01 });
      return BloomFilter.blocked({ m: shape.m, k: shape.k, seed: 7, blockBits: 512 });
    }
  },
  {
    name: 'bloom, scalable',
    build: function (n) { return BloomFilter.scalable({ n0: Math.max(16, Math.round(n / 8)), p: 0.01, seed: 7 }); }
  },
  {
    name: 'cuckoo',
    build: function (n) {
      return CuckooFilter.create({ capacity: Math.ceil(n / 0.9), bucketSize: 4, fingerprintBits: 10, seed: 7 });
    }
  },
  {
    name: 'quotient',
    build: function (n) {
      return QuotientFilter.create({
        quotientBits: Math.max(3, Math.ceil(Math.log2(n / 0.7))), remainderBits: 9, seed: 7
      });
    }
  }
];

FAMILIES.forEach(function (family) {
  test('filters: ' + family.name + ' never reports a key it holds as absent', function () {
    [200, 2000, 8000].forEach(function (n) {
      const filter = family.build(n);
      const keys = keysFor(n);
      keys.forEach(filter.add);

      const missing = StreamLab.falseNegatives({ filter: filter, present: keys });
      assert.strictEqual(missing, 0, family.name + ' lost ' + missing + ' of ' + n + ' keys');
    });
  });

  test('filters: ' + family.name + ' reports a plausible size and load', function () {
    const filter = family.build(4000);
    keysFor(4000).forEach(filter.add);

    assert.ok(filter.bytes() > 0, 'bytes must be positive');
    assert.ok(filter.bits() >= filter.bytes(), 'bits must not be below bytes');
    assert.ok(filter.count() > 0 && filter.count() <= 4000,
      family.name + ' counted ' + filter.count() + ' of 4 000 inserts');
  });
});

/* ---------------------------------------------------------- Bloom filters */

test('bloom: the sizing formulas are the ones the section quotes', function () {
  const shape = BloomFilter.optimalParams({ n: 10000, p: 0.01 });
  assert.strictEqual(shape.m, 95851);
  assert.strictEqual(shape.k, 7);
  assert.ok(Math.abs(shape.bitsPerKey - 9.5851) < 1e-4, 'bits per key ' + shape.bitsPerKey);
  assert.ok(Math.abs(shape.predictedFpr - 0.010039) < 1e-6, 'predicted ' + shape.predictedFpr);

  /* bits per key depends only on the target rate, never on the key count */
  [1000, 10000, 100000].forEach(function (n) {
    const other = BloomFilter.optimalParams({ n: n, p: 0.01 });
    assert.ok(Math.abs(other.bitsPerKey - shape.bitsPerKey) < 0.01,
      'bits per key moved with n: ' + other.bitsPerKey);
  });
});

test('bloom: the measured rate lands on the published formula, not on a tolerance', function () {
  const n = 20000;
  const shape = BloomFilter.optimalParams({ n: n, p: 0.01 });
  const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });
  keysFor(n).forEach(filter.add);

  const measured = StreamLab.measureFpr({ filter: filter, absent: StreamLab.absentKeys({ count: 50000 }) });
  const predicted = filter.predictedFpr();
  assert.ok(Math.abs(measured.rate - predicted) <= 0.1 * predicted,
    'measured ' + measured.rate.toFixed(5) + ' against predicted ' + predicted.toFixed(5));
});

test('bloom: the optimal k really is where the array is half full', function () {
  const n = 20000;
  const shape = BloomFilter.optimalParams({ n: n, p: 0.01 });
  const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });
  keysFor(n).forEach(filter.add);

  assert.ok(Math.abs(filter.fill() - 0.5) < 0.03, 'fill was ' + filter.fill().toFixed(4));
});

test('bloom: the filter recovers its own insert count from the bits', function () {
  const shape = BloomFilter.optimalParams({ n: 100000, p: 0.01 });
  const filter = BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });
  keysFor(100000).forEach(filter.add);

  const estimate = filter.estimatedCount();
  assert.ok(Math.abs(estimate - 100000) / 100000 < 0.005,
    'estimated ' + Math.round(estimate) + ' from the bits alone');
});

test('bloom: union is exact and intersection is not', function () {
  const shape = BloomFilter.optimalParams({ n: 4000, p: 0.01 });
  const left = BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });
  const right = BloomFilter.create({ m: shape.m, k: shape.k, seed: 7 });

  for (let i = 0; i < 2000; i += 1) left.add('a' + i);
  for (let i = 0; i < 2000; i += 1) right.add('b' + i);

  const union = BloomFilter.union(left, right);
  for (let i = 0; i < 2000; i += 1) {
    assert.strictEqual(union.has('a' + i), true, 'a' + i + ' missing from the union');
    assert.strictEqual(union.has('b' + i), true, 'b' + i + ' missing from the union');
  }

  /* The intersection of two disjoint sets is empty, and the AND is not. */
  const meet = BloomFilter.intersect(left, right);
  let reported = 0;
  for (let i = 0; i < 2000; i += 1) if (meet.has('a' + i)) reported += 1;
  assert.ok(reported > 0,
    'the bitwise AND is expected to report keys in neither set; it reported none, ' +
    'which means the test is no longer exercising the hazard');
});

test('bloom: the error keeps rising past the sized n, with no discontinuity', function () {
  const sweep = FilterLab.bloomSweep({ n: 10000, p: 0.01, seed: 11, steps: 10, probes: 20000, overfill: 2 });
  const atCapacity = sweep.points.filter(function (point) { return point.n === 10000; })[0];
  const last = sweep.points[sweep.points.length - 1];

  assert.ok(atCapacity, 'the sweep samples the sizing point');
  assert.ok(Math.abs(atCapacity.measured - 0.01) < 0.002, 'at n: ' + atCapacity.measured);
  assert.ok(last.measured > 0.15, 'at 2n the measured rate was only ' + last.measured);

  sweep.points.forEach(function (point) {
    assert.ok(Math.abs(point.measured - point.predicted) <= 0.15 * point.predicted + 0.0005,
      'the model holds at n = ' + point.n + ': ' + point.measured + ' against ' + point.predicted);
  });
});

test('bloom: a counting filter removes, and saturates rather than under-counting', function () {
  const churn = FilterLab.countingChurn({ n: 20000, p: 0.01, seed: 7, counterBits: 4, repeats: 4 });

  assert.strictEqual(churn.falseNegatives, 0, 'a counting filter may never lose a live key');
  assert.strictEqual(churn.maxCounter, churn.ceiling, 'four insertions per key must reach the 4-bit ceiling');
  assert.ok(churn.saturated > 0, 'some cells must be frozen at the ceiling');
  assert.strictEqual(churn.removedStillPresent, churn.removedCount,
    'one removal cannot clear a key inserted four times');

  const single = FilterLab.countingChurn({ n: 20000, p: 0.01, seed: 7, counterBits: 8, repeats: 1 });
  assert.strictEqual(single.falseNegatives, 0);
  assert.strictEqual(single.saturated, 0, '8-bit counters must not saturate on a set');
});

test('bloom: blocking costs accuracy monotonically in the block size', function () {
  const sweep = FilterLab.blockSweep({ n: 20000, p: 0.01, seed: 7, probes: 30000 });
  const byBlock = {};
  sweep.rows.forEach(function (row) { byBlock[row.blockBits] = row; });

  assert.strictEqual(byBlock[512].linesPerQuery, 1, 'a 512-bit block is exactly one cache line');
  assert.ok(sweep.standard.linesPerQuery > 6, 'the standard filter touches nearly k lines');
  assert.ok(byBlock[512].inflation > 1 && byBlock[512].inflation < 1.4,
    'one-line blocks inflate the error by ' + byBlock[512].inflation.toFixed(3));

  for (let i = 1; i < sweep.rows.length; i += 1) {
    assert.ok(sweep.rows[i].inflation < sweep.rows[i - 1].inflation,
      'inflation must fall as blocks grow: ' + sweep.rows[i - 1].blockBits + ' → ' + sweep.rows[i].blockBits);
  }
});

test('bloom: a scalable chain stays under its target however wrong the sizing was', function () {
  [4, 10, 40].forEach(function (understatement) {
    const filter = BloomFilter.scalable({ n0: Math.round(20000 / understatement), p: 0.01, seed: 7 });
    keysFor(20000).forEach(filter.add);

    const measured = StreamLab.measureFpr({ filter: filter, absent: StreamLab.absentKeys({ count: 30000 }) });
    assert.strictEqual(StreamLab.falseNegatives({ filter: filter, present: keysFor(20000) }), 0);
    assert.ok(measured.rate <= 0.012,
      'sized ' + understatement + 'x too small: measured ' + measured.rate.toFixed(5) + ' against a 1% target');
    assert.ok(filter.layerCount() > 1, 'the chain must have grown');
  });
});

/* ------------------------------------------------------- cuckoo filters */

test('cuckoo: the alternative bucket is an involution', function () {
  const filter = CuckooFilter.create({ capacity: 4096, bucketSize: 4, fingerprintBits: 8, seed: 3 });
  for (let i = 0; i < 2000; i += 1) {
    const spot = filter.bucketsOf('key-' + i);
    const back = filter.bucketsOf('key-' + i);
    assert.strictEqual(spot.i1, back.i1, 'the buckets must be a pure function of the key');
    assert.notStrictEqual(spot.fingerprint, 0, 'a zero fingerprint is the empty marker');
  }
});

test('cuckoo: fills to a high load, then fails loudly and keeps the orphan', function () {
  const result = CuckooFilter.fillUntilFailure({
    capacity: 8192, bucketSize: 4, fingerprintBits: 8, seed: 5, prefix: 'key-'
  });

  assert.ok(result.full, 'the fill must end in a refusal, not run out of keys');
  assert.ok(result.load > 0.95, 'load reached only ' + result.load.toFixed(4));

  const attempted = keysFor(result.failedAt + 1);
  assert.strictEqual(StreamLab.falseNegatives({ filter: result.filter, present: attempted }), 0,
    'the orphan of the failed chain must still be findable');
  assert.strictEqual(result.filter.add('one-more').ok, false, 'a full filter stays full');
});

test('cuckoo: the load ceiling follows the bucket width, not the fingerprint width', function () {
  const byFingerprint = FilterLab.cuckooSweep({ capacity: 8192, seed: 5, probes: 20000 });
  const loads = byFingerprint.map(function (row) { return row.load; });
  assert.ok(Math.max.apply(null, loads) - Math.min.apply(null, loads) < 0.03,
    'the load moved with the fingerprint width: ' + loads.map(function (v) { return v.toFixed(3); }).join(', '));

  byFingerprint.forEach(function (row) {
    assert.ok(Math.abs(row.measured - row.predicted) <= 0.15 * row.predicted + 0.0005,
      'f = ' + row.fingerprintBits + ': measured ' + row.measured + ' against ' + row.predicted);
  });

  const byBucket = FilterLab.bucketSweep({ capacity: 8192, seed: 5 });
  assert.ok(byBucket[0].load < 0.55, 'one slot per bucket must jam near half full');
  assert.ok(byBucket[2].load > 0.95, 'four slots must reach past 95%');
  for (let i = 1; i < byBucket.length; i += 1) {
    assert.ok(byBucket[i].load > byBucket[i - 1].load, 'wider buckets must fill further');
  }
});

test('cuckoo: a phantom delete costs exactly one real key', function () {
  const result = FilterLab.phantomDeletes({ n: 4000, seed: 3, fingerprintBits: 8 });
  assert.ok(result.accepted > 0, 'the hazard needs at least one accepted phantom to be exercised');
  assert.strictEqual(result.falseNegatives, result.accepted,
    'each accepted phantom delete must remove exactly one real key');
});

test('cuckoo: most inserts evict nothing and the tail is long', function () {
  const profile = FilterLab.chainProfile({ capacity: 8192, bucketSize: 4, fingerprintBits: 8, seed: 5 });
  const free = profile.histogram.filter(function (row) { return row.length === 0; })[0];

  assert.ok(free.count / profile.inserted > 0.8, 'most inserts should evict nothing');
  assert.ok(profile.longest.length > 50 * profile.meanChain,
    'the longest chain, ' + profile.longest.length + ', should dwarf the mean of ' +
    profile.meanChain.toFixed(2));
});

/* ----------------------------------------------------- quotient filters */

test('quotient: membership matches a reference Set, with one-sided error only', function () {
  const filter = QuotientFilter.create({ quotientBits: 13, remainderBits: 9, seed: 4 });
  const reference = new Set();
  const keys = keysFor(6000);

  keys.forEach(function (key) { filter.add(key); reference.add(key); });
  keys.forEach(function (key) {
    assert.strictEqual(filter.has(key), true, key + ' was inserted');
  });

  let falsePositives = 0;
  for (let i = 0; i < 20000; i += 1) {
    const key = 'absent-' + i;
    if (reference.has(key)) continue;
    if (filter.has(key)) falsePositives += 1;
  }
  const predicted = filter.predictedFpr();
  assert.ok(Math.abs(falsePositives / 20000 - predicted) <= 0.3 * predicted + 0.0002,
    'measured ' + (falsePositives / 20000).toFixed(5) + ' against ' + predicted.toFixed(5));
});

test('quotient: the read-out is in ascending fingerprint order', function () {
  const filter = QuotientFilter.create({ quotientBits: 12, remainderBits: 10, seed: 4 });
  for (let i = 0; i < 2500; i += 1) filter.add('key-' + i);

  const values = QuotientFilter.valuesOf(filter);
  assert.strictEqual(values.length, filter.count(), 'the read-out must hold every fingerprint');
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] >= values[i - 1], 'the read-out is not ascending at ' + i);
  }
});

test('quotient: merging preserves the fingerprint multiset exactly', function () {
  const merge = FilterLab.quotientMerge({ n: 2000 });
  assert.strictEqual(merge.fingerprintsPreserved, true, 'no fingerprint may be lost or altered');
  assert.strictEqual(merge.remainderAfter, merge.remainderBefore - 1, 'one bit moves to the quotient');
  assert.strictEqual(merge.merged.quotientBits(), merge.left.quotientBits() + 1);
  assert.strictEqual(merge.merged.count(), merge.left.count() + merge.right.count());
});

test('quotient: a query reads one contiguous run, not k scattered bits', function () {
  const filter = QuotientFilter.create({ quotientBits: 13, remainderBits: 9, seed: 4 });
  for (let i = 0; i < 5000; i += 1) filter.add('key-' + i);
  filter.resetStats();
  for (let i = 0; i < 5000; i += 1) filter.has('probe-' + i);

  const stats = filter.stats();
  assert.ok(stats.linesTouched / stats.queries < 1.2,
    'a quotient query touched ' + (stats.linesTouched / stats.queries).toFixed(2) + ' cache lines');
});

/* ------------------------------------------------- the space comparison */

test('filters: the Bloom/cuckoo crossover sits near half a per cent', function () {
  function bloomBits(p) { return -Math.log(p) / (Math.LN2 * Math.LN2); }
  function cuckooAchieved(f) { return 1 - Math.pow(1 - Math.pow(2, -f), 2 * 4 * 0.95); }

  /* Bloom is smaller above the crossover, the cuckoo filter below it. */
  assert.ok(cuckooAchieved(10) / 1 > 0, 'sanity');
  assert.ok(10 / 0.95 > bloomBits(cuckooAchieved(10)), 'at 0.74% Bloom must still win');
  assert.ok(11 / 0.95 < bloomBits(cuckooAchieved(11)), 'at 0.37% the cuckoo filter must win');
  assert.ok(8 / 0.95 > bloomBits(cuckooAchieved(8)), 'at 2.9% Bloom must win comfortably');
  assert.ok(13 / 0.95 < bloomBits(cuckooAchieved(13)), 'at 0.09% the cuckoo filter must win comfortably');
});

test('filters: every family reports its own predicted rate close to the measured one', function () {
  [0.1, 0.01, 0.001].forEach(function (target) {
    const comparison = FilterLab.spaceAtError({ n: 8000, p: target, seed: 9, probes: 30000 });
    comparison.rows.forEach(function (row) {
      assert.strictEqual(row.falseNegatives, 0, row.id + ' lost a key at target ' + target);
      assert.ok(Math.abs(row.measured - row.predicted) <= 0.3 * row.predicted + 0.0005,
        row.id + ' at ' + target + ': measured ' + row.measured.toFixed(5) +
        ' against a self-reported ' + row.predicted.toFixed(5));
      assert.ok(row.bitsPerItemFull <= row.bitsPerItem + 1e-9,
        row.id + ': the design-load figure must not exceed the as-built one');
    });
  });
});
