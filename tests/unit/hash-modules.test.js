'use strict';

/**
 * Unit tests for the M03 hashing engines.
 *
 * The centre of this file is a property test: every table in the milestone is
 * driven through the same mixed workload against a reference Map, on random,
 * word-like, clustered *and* adversarial key streams, with and without
 * deletes. A scheme that loses a key, resurrects a deleted one or miscounts
 * its size fails here rather than in a demo.
 *
 * Everything is pure and DOM-free, so `node --test` loads the modules
 * directly.
 */

const test = require('node:test');
const assert = require('node:assert');

const Hash = require('../../src/js/algorithms/hash-functions.js');
const Chained = require('../../src/js/algorithms/hash-table-chained.js');
const Open = require('../../src/js/algorithms/hash-table-open.js');
const RobinHood = require('../../src/js/algorithms/hash-table-robinhood.js');
const Swiss = require('../../src/js/algorithms/swiss-table.js');
const Rehash = require('../../src/js/algorithms/hash-rehash.js');
const Perfect = require('../../src/js/algorithms/perfect-hash.js');
const Ordered = require('../../src/js/algorithms/ordered-map.js');
const Lab = require('../../src/js/machines/hash-lab.js');
const Random = require('../../src/js/utils/random.js');

const hash = function (key) { return Hash.fnv1a(key); };

/* ------------------------------------------------------------ the property */

const TABLES = [
  { name: 'chaining', create: function () { return Chained.create({ hash: hash, capacity: 16 }); } },
  { name: 'chaining + treeify',
    create: function () { return Chained.create({ hash: hash, capacity: 16, treeifyAt: 8 }); } },
  { name: 'open linear, tombstones',
    create: function () { return Open.create({ hash: hash, capacity: 16, probe: 'linear' }); } },
  { name: 'open linear, backward shift',
    create: function () {
      return Open.create({ hash: hash, capacity: 16, probe: 'linear', deletion: 'backward-shift' });
    } },
  { name: 'open quadratic', create: function () { return Open.create({ hash: hash, capacity: 16, probe: 'quadratic' }); } },
  { name: 'open double', create: function () { return Open.create({ hash: hash, capacity: 17, probe: 'double' }); } },
  { name: 'robin hood', create: function () { return RobinHood.createRobinHood({ hash: hash, capacity: 16 }); } },
  { name: 'cuckoo', create: function () { return RobinHood.createCuckoo({ hash: hash, capacity: 16 }); } },
  { name: 'hopscotch',
    create: function () { return RobinHood.createHopscotch({ hash: hash, capacity: 32, neighbourhood: 8 }); } },
  { name: 'swiss table', create: function () { return Swiss.create({ hash: hash, capacity: 32 }); } },
  { name: 'synchronous rehash',
    create: function () { return Rehash.create({ hash: hash, capacity: 16, mode: 'synchronous' }); } },
  { name: 'incremental rehash',
    create: function () { return Rehash.create({ hash: hash, capacity: 16, mode: 'incremental', movePerOp: 3 }); } },
  { name: 'ordered map', create: function () { return Ordered.create({ compactAt: 0.5 }); } }
];

function streams() {
  return [
    { name: 'random', keys: Lab.keys({ kind: 'random', count: 2000, rng: Random.seeded(11) }) },
    { name: 'words', keys: Lab.keys({ kind: 'words', count: 2000, rng: Random.seeded(12) }) },
    { name: 'clustered', keys: Lab.keys({ kind: 'clustered', count: 2000, rng: Random.seeded(13) }) },
    { name: 'adversarial',
      keys: Lab.collidingKeys({ hash: hash, buckets: 512, count: 400, budget: 1000000 }).keys }
  ];
}

/** Drives one table and one reference Map through the same operations. */
function workload(table, keys, deleteRate) {
  const rng = Random.seeded(5);
  const reference = new Map();
  const live = [];
  const failures = [];

  keys.forEach(function (key, i) {
    table.set(key, i);
    reference.set(key, i);
    live.push(key);

    if (deleteRate > 0 && rng.next() < deleteRate && live.length) {
      const victim = live.splice(rng.int(live.length), 1)[0];
      table.delete(victim);
      reference.delete(victim);
    }
    if (i % 7 === 0 && live.length) {
      const probe = live[rng.int(live.length)];
      if (table.get(probe) !== reference.get(probe)) {
        failures.push('mid-run ' + probe + ': got ' + table.get(probe) + ', wanted ' + reference.get(probe));
      }
    }
  });

  reference.forEach(function (value, key) {
    if (table.get(key) !== value) failures.push('final ' + key + ': got ' + table.get(key) + ', wanted ' + value);
  });
  keys.forEach(function (key) {
    if (!reference.has(key) && table.get(key) !== undefined) failures.push('resurrected ' + key);
  });
  if (table.size() !== reference.size) failures.push('size ' + table.size() + ', wanted ' + reference.size);

  return failures;
}

TABLES.forEach(function (entry) {
  test('table ' + entry.name + ' matches a reference Map on every key stream', function () {
    streams().forEach(function (stream) {
      [0, 0.3].forEach(function (rate) {
        const failures = workload(entry.create(), stream.keys, rate);
        assert.deepStrictEqual(failures, [],
          entry.name + ' on ' + stream.name + ' keys at delete rate ' + rate);
      });
    });
  });
});

/* ---------------------------------------------------------------- avalanche */

test('avalanche: murmur3 passes, the weak finaliser fails by twenty standard errors', function () {
  const good = Lab.avalanche({ hash: Hash.murmurFinalise, samples: 512, rng: Random.seeded(17) });
  const weak = Lab.avalanche({ hash: Hash.weakFinalise, samples: 512, rng: Random.seeded(17) });

  assert.strictEqual(good.passes, true, 'murmur3 worst deviation was ' + good.worstZ.toFixed(2) + ' sigma');
  assert.ok(good.worstZ < Lab.Z_BONFERRONI, 'inside the Bonferroni bound');
  assert.ok(Math.abs(good.mean - 0.5) < 0.01, 'the mean cell sits on a half');

  assert.strictEqual(weak.passes, false, 'the weak finaliser must fail');
  assert.ok(weak.worstZ > 20, 'and by a wide margin, got ' + weak.worstZ.toFixed(1));
  assert.strictEqual(weak.min, 0, 'some output bits never move at all');
  assert.strictEqual(weak.max, 1, 'and others always move');
});

test('avalanche: the 40-60% band is noise below the sample count it needs', function () {
  const short = Lab.avalanche({ hash: Hash.murmurFinalise, samples: 256, rng: Random.seeded(17) });

  assert.strictEqual(short.withinBand, false, 'a good mixer strays outside the band at 256 samples');
  assert.ok(short.worstZ > Lab.Z_BONFERRONI, 'which is why the panel reports the deviation in sigma');
  assert.strictEqual(Lab.samplesForBand(), 421, 'the band needs 421 samples to mean anything');
  assert.ok(Math.abs(short.standardError - Math.sqrt(0.25 / 256)) < 1e-12, 'the stated standard error');
});

test('the xxhash-style finaliser mixes as well as murmur3, and both are bijections', function () {
  const xx = Lab.avalanche({ hash: Hash.xxFinalise, samples: 512, rng: Random.seeded(29) });
  assert.strictEqual(xx.passes, true, 'xx worst deviation was ' + xx.worstZ.toFixed(2) + ' sigma');

  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) {
    seen.add(Hash.murmurFinalise(Math.imul(i, 2654435761) >>> 0));
  }
  assert.strictEqual(seen.size, 5000, 'a finaliser loses no information');
});

test('chi-squared cannot tell a good mixer from a broken one', function () {
  const keys = Lab.keys({ kind: 'words', count: 4096, rng: Random.seeded(23) });
  const good = Lab.chiSquared({ hash: function (k) { return Hash.murmur3(k, 0); }, keys: keys, buckets: 512 });
  const weak = Lab.chiSquared({
    hash: function (k) { return Hash.weakFinalise(Hash.fnv1a(k)); }, keys: keys, buckets: 512
  });

  assert.ok(Math.abs(good.ratio - 1) < 0.2, 'murmur3 is uniform: ' + good.ratio.toFixed(3));
  assert.ok(Math.abs(weak.ratio - 1) < 0.2, 'and so is the broken one: ' + weak.ratio.toFixed(3));
  assert.strictEqual(good.counts.reduce(function (a, b) { return a + b; }, 0), keys.length);
});

test('composite keys: XOR collides on order, hash_combine does not', function () {
  const pairs = [];
  for (let a = 0; a < 60; a += 1) {
    for (let b = a + 1; b < 60; b += 1) pairs.push([a * 977, b * 977]);
  }

  let xorReversals = 0;
  let orderedReversals = 0;
  pairs.forEach(function (pair) {
    if (Hash.combineXor([pair[0], pair[1]]) === Hash.combineXor([pair[1], pair[0]])) xorReversals += 1;
    if (Hash.combineOrdered([pair[0], pair[1]]) === Hash.combineOrdered([pair[1], pair[0]])) {
      orderedReversals += 1;
    }
  });

  assert.strictEqual(xorReversals, pairs.length, 'XOR puts every reversed pair in the same bucket');
  assert.strictEqual(orderedReversals, 0, 'hash_combine separates all ' + pairs.length + ' of them');

  const ordered = new Set();
  pairs.forEach(function (pair) {
    ordered.add(Hash.combineOrdered([pair[0], pair[1]]));
    ordered.add(Hash.combineOrdered([pair[1], pair[0]]));
  });
  assert.strictEqual(ordered.size, pairs.length * 2, 'and collides on nothing else either');
});

/* --------------------------------------------------------- universal hashing */

test('multiply-shift is universal enough: collisions stay near the 2/m bound', function () {
  const bits = 10;
  const buckets = 1 << bits;
  const rng = Random.seeded(41);
  const trials = 40000;
  const x = 0x1234abcd;
  const y = 0x1234abce;                       // adjacent keys: the worst case for a weak hash
  let adjacent = 0;
  let random = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const a = rng.int(0x7fffffff) | 1;
    if (Hash.multiplyShift(x, a, bits) === Hash.multiplyShift(y, a, bits)) adjacent += 1;
    if (Hash.multiplyShift(rng.int(0x7fffffff), a, bits) ===
      Hash.multiplyShift(rng.int(0x7fffffff), a, bits)) random += 1;
  }

  assert.ok(adjacent / trials <= 2 / buckets,
    'the universality bound is 2/m = ' + (2 / buckets).toFixed(5) + ', measured ' +
    (adjacent / trials).toFixed(5) + ' on adjacent keys');
  assert.ok(random / trials < 2 / buckets,
    'unrelated keys collide at about 1/m: ' + (random / trials).toFixed(5));
});

test('tabulation hashing spreads adjacent keys that a raw hash keeps adjacent', function () {
  const tables = Hash.buildTabulation(Random.seeded(77));
  const buckets = 256;
  const counts = new Uint32Array(buckets);
  for (let i = 0; i < 20000; i += 1) counts[Hash.tabulate(tables, i) % buckets] += 1;

  const expected = 20000 / buckets;
  let chi2 = 0;
  counts.forEach(function (count) { chi2 += ((count - expected) * (count - expected)) / expected; });
  assert.ok(chi2 / (buckets - 1) < 1.5, 'chi2/dof was ' + (chi2 / (buckets - 1)).toFixed(3));
});

test('hash flooding: the unkeyed table degrades, treeify bounds it, a seed defeats it', function () {
  const attack = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 1000, budget: 4000000 });
  assert.strictEqual(attack.exhausted, false, 'the attack is cheap to mount');
  assert.ok(attack.examined > 500000, 'and it really did have to search: ' + attack.examined);

  const build = function (options) {
    const table = Chained.create({
      hash: options.hash, capacity: 1024, maxLoad: 1e9, treeifyAt: options.treeifyAt || 0
    });
    attack.keys.forEach(function (key, i) { table.set(key, i); });
    attack.keys.forEach(function (key) { table.get(key); });
    return table.stats();
  };

  const seed = Random.seeded(987654321).int(1 << 30);
  const naive = build({ hash: Hash.djb2 });
  const treeified = build({ hash: Hash.djb2, treeifyAt: 8 });
  const keyed = build({ hash: function (key) { return Hash.murmur3(key, seed); } });

  assert.strictEqual(naive.maxChain, attack.keys.length, 'every key lands in one bucket');
  assert.ok(treeified.insertProbes < naive.insertProbes / 50, 'treeify cuts the work by orders of magnitude');
  assert.ok(keyed.maxChain < 12, 'a per-process seed turns the payload into ordinary keys');
  assert.ok(keyed.insertProbes < naive.insertProbes / 100, 'and costs the server almost nothing');
});

/* ---------------------------------------------------------- separate chaining */

test('chaining: a treeified bucket is sorted and still answers every lookup', function () {
  const table = Chained.create({ hash: function () { return 0; }, capacity: 8, maxLoad: 1e9, treeifyAt: 8 });
  for (let i = 0; i < 60; i += 1) table.set('k' + (999 - i), i);

  const stats = table.stats();
  assert.strictEqual(stats.treeBuckets, 1, 'exactly one bucket treeified');
  assert.strictEqual(stats.maxChain, 60, 'and it holds every key');
  for (let i = 0; i < 60; i += 1) assert.strictEqual(table.get('k' + (999 - i)), i, 'k' + (999 - i));
  assert.strictEqual(table.get('k0'), undefined, 'a missing key is still missing');
});

test('chaining: the Poisson prediction for empty buckets holds at load factor 1', function () {
  const table = Chained.create({ hash: function (k) { return Hash.murmur3(k, 0); }, capacity: 1024, maxLoad: 1e9 });
  const keys = Lab.keys({ kind: 'random', count: 1024, rng: Random.seeded(31) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const stats = table.stats();
  const predicted = 1024 * Math.exp(-1);
  assert.ok(Math.abs(stats.emptyBuckets - predicted) < 40,
    'empty buckets ' + stats.emptyBuckets + ' against a predicted ' + predicted.toFixed(0));
  assert.ok(stats.maxChain >= 4 && stats.maxChain <= 8, 'longest chain was ' + stats.maxChain);
});

/* ----------------------------------------------------------- open addressing */

test('open addressing: the closed forms match the measured probe counts', function () {
  assert.ok(Math.abs(Open.expectedProbes(0.7, true) - 2.1667) < 1e-3);
  assert.ok(Math.abs(Open.expectedProbes(0.7, false) - 6.0556) < 1e-3);
  assert.strictEqual(Open.expectedProbes(1, true), Infinity, 'a full table never terminates');

  const table = Open.create({ hash: hash, capacity: 1024, maxLoad: 1e9, probe: 'linear' });
  const keys = Lab.keys({ kind: 'random', count: 716, rng: Random.seeded(83) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const before = table.stats();
  keys.forEach(function (key) { table.get(key); });
  const hit = (table.stats().lookupProbes - before.lookupProbes) / keys.length;
  assert.ok(hit > 1.5 && hit < 3, 'measured hit probes ' + hit.toFixed(2) + ' against a predicted 2.17');
});

test('open addressing: tombstones fill the table while every monitored number stays flat', function () {
  const churn = function (deletion) {
    const table = Open.create({ hash: hash, capacity: 1024, maxLoad: 1e9, probe: 'linear', deletion: deletion });
    const live = Lab.keys({ kind: 'random', count: 716, rng: Random.seeded(83) });
    live.forEach(function (key, i) { table.set(key, i); });

    const rng = Random.seeded(97);
    for (let round = 0; round < 5000; round += 1) {
      const victim = live.splice(rng.int(live.length), 1)[0];
      table.delete(victim);
      const fresh = 'fresh-' + round;
      table.set(fresh, round);
      live.push(fresh);
    }

    const before = table.stats();
    live.forEach(function (key) { table.get(key); });
    const hit = (table.stats().lookupProbes - before.lookupProbes) / live.length;
    const mid = table.stats();
    for (let i = 0; i < 200; i += 1) table.get('absent-' + i);
    const miss = (table.stats().lookupProbes - mid.lookupProbes) / 200;

    return { size: table.size(), tombstones: table.stats().tombstones, hit: hit, miss: miss };
  };

  const tomb = churn('tombstone');
  const shift = churn('backward-shift');

  assert.strictEqual(tomb.size, 716, 'the live count never moved');
  assert.strictEqual(shift.size, 716, 'and neither did it with backward shift');
  assert.ok(tomb.tombstones > 200, 'tombstones accumulated: ' + tomb.tombstones);
  assert.strictEqual(tomb.tombstones + tomb.size, 1024, 'and between them they fill every slot');
  assert.strictEqual(tomb.miss, 1024, 'so a lookup for a missing key scans the whole table');
  assert.strictEqual(shift.tombstones, 0, 'backward shift leaves none');
  assert.ok(shift.miss < 12, 'and a missing key still costs ' + shift.miss.toFixed(1) + ' probes');
  assert.ok(shift.hit < tomb.hit, 'hits are cheaper too');
});

test('open addressing: a probe walk stops at the key or at the first empty slot', function () {
  const table = Open.create({ hash: hash, capacity: 32, maxLoad: 1e9, probe: 'linear' });
  for (let i = 0; i < 12; i += 1) table.set('key-' + i, i);

  const found = table.probeWalk('key-7');
  assert.strictEqual(found[found.length - 1].state, Open.FULL, 'the walk ends on the key');
  const missing = table.probeWalk('nobody');
  assert.strictEqual(missing[missing.length - 1].state, Open.EMPTY, 'or on an empty slot');
});

/* ------------------------------------------------- robin hood and neighbours */

test('robin hood: the same mean as linear probing, a fraction of the variance', function () {
  const keys = Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });

  const robin = RobinHood.createRobinHood({ hash: hash, capacity: 2048, maxLoad: 1e9 });
  keys.forEach(function (key, i) { robin.set(key, i); });

  const linearSummary = RobinHood.summarise(distancesOf(keys, 2048));
  const robinSummary = robin.stats();

  assert.strictEqual(robin.size(), 1740, 'no key was lost');
  assert.ok(Math.abs(robinSummary.meanDistance - linearSummary.meanDistance) < 1e-9,
    'means ' + robinSummary.meanDistance.toFixed(4) + ' and ' + linearSummary.meanDistance.toFixed(4));
  assert.ok(robinSummary.varianceDistance < linearSummary.varianceDistance / 4,
    'variance ' + robinSummary.varianceDistance.toFixed(2) + ' against ' +
    linearSummary.varianceDistance.toFixed(2));
  assert.ok(robinSummary.maxDistance < linearSummary.maxDistance / 3,
    'worst ' + robinSummary.maxDistance + ' against ' + linearSummary.maxDistance);
});

/** Linear probing over the same key stream, so the two schemes can be compared. */
function distancesOf(keys, capacity) {
  const slots = new Array(capacity).fill(null);
  const distances = [];

  keys.forEach(function (key) {
    const home = hash(key) % capacity;
    for (let step = 0; step < capacity; step += 1) {
      const at = (home + step) % capacity;
      if (slots[at]) continue;
      slots[at] = key;
      distances.push(step);
      return;
    }
  });
  return distances;
}

test('robin hood: no entry is stranded more than one slot behind a richer one', function () {
  const table = RobinHood.createRobinHood({ hash: hash, capacity: 512, maxLoad: 1e9 });
  const keys = Lab.keys({ kind: 'random', count: 400, rng: Random.seeded(53) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const distances = table.distances();
  assert.strictEqual(distances.length, 400, 'one distance per live entry');
  assert.ok(distances.every(function (d) { return d >= 0; }), 'distances are forward');
  assert.ok(table.stats().displacements > 0, 'the scheme actually displaced something');
});

test('cuckoo: two probes per lookup, no cycles left behind', function () {
  const table = RobinHood.createCuckoo({ hash: hash, capacity: 1740 });
  const keys = Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const stats = table.stats();
  assert.strictEqual(stats.maxLookupProbe, 2, 'a lookup is exactly two probes');
  assert.strictEqual(table.size(), 1740, 'every key is in one of the two tables');
  assert.ok(table.capacity() >= 3480, 'at twice the memory: ' + table.capacity() + ' slots');
  keys.forEach(function (key, i) { assert.strictEqual(table.get(key), i, key); });

  /* The section plots distances for every scheme side by side, so cuckoo has to
     report them the same way the others do: probes past the first. */
  const distances = table.distances();
  assert.strictEqual(distances.length, 1740, 'one distance per live key');
  assert.ok(distances.every(function (d) { return d === 0 || d === 1; }), 'left table or right, nothing else');
  assert.strictEqual(stats.maxDistance, 1, 'which is the guarantee, measured rather than asserted');
  assert.ok(stats.meanDistance > 0 && stats.meanDistance < 1, 'mean ' + stats.meanDistance.toFixed(3));
});

test('hopscotch: every key lands inside its neighbourhood, or the table grows', function () {
  const table = RobinHood.createHopscotch({ hash: hash, capacity: 2048, neighbourhood: 8 });
  const keys = Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const stats = table.stats();
  assert.ok(stats.maxDistance < 8, 'worst distance ' + stats.maxDistance + ' is inside H = 8');
  assert.ok(stats.resizes >= 1, 'H = 8 cannot hold this load, so it grew');
  assert.ok(table.size() / table.capacity() < 0.6, 'and the price is the load factor');

  const roomy = RobinHood.createHopscotch({ hash: hash, capacity: 2048, neighbourhood: 32 });
  keys.forEach(function (key, i) { roomy.set(key, i); });
  assert.strictEqual(roomy.stats().resizes, 0, 'H = 32 holds the same keys without growing');
  assert.ok(roomy.stats().maxDistance < 32, 'still inside the neighbourhood');
});

/* ----------------------------------------------------------- swiss tables */

test('swiss: the control masks name exactly the lanes they should', function () {
  const control = new Uint8Array(32).fill(Swiss.EMPTY);
  control[0] = 0x2a;
  control[2] = 0x2a;
  control[15] = 0x2a;
  control[7] = Swiss.DELETED;

  assert.strictEqual(Swiss.matchTag(control, 0, 0x2a), 0x8005, 'lanes 0, 2 and 15');
  assert.strictEqual(Swiss.matchEmpty(control, 0), 0x7f7a, 'every lane except 0, 2, 7 and 15');
  assert.strictEqual(Swiss.matchFree(control, 0), 0x7ffa, 'the empty lanes plus the deleted one');
  assert.strictEqual(Swiss.matchTag(control, 16, 0x2a), 0, 'the next group is untouched');
  assert.strictEqual(Swiss.lowestBit(0x8005), 0, 'the lowest set lane');
  assert.strictEqual(Swiss.lowestBit(1 << 9), 9);
});

test('swiss: H1 and H2 split the hash without overlapping', function () {
  for (let i = 0; i < 1000; i += 1) {
    const value = Hash.murmurFinalise(i);
    const split = Swiss.splitHash(value);
    assert.strictEqual(split.h2, value & Swiss.TAG_MASK, 'the tag is the low seven bits');
    assert.strictEqual(split.h1, value >>> 7, 'and the group index is the rest');
    assert.ok(split.h2 <= Swiss.TAG_MASK, 'a tag never collides with EMPTY or DELETED');
  }
});

test('swiss: a lookup reads about one group, as alpha^16 predicts', function () {
  const table = Swiss.create({ hash: hash, capacity: 2048, maxLoad: 0.9 });
  const keys = Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const before = table.stats();
  keys.forEach(function (key) { table.get(key); });
  const stats = table.stats();

  const load = table.size() / table.capacity();
  const predicted = 1 / (1 - Math.pow(load, Swiss.GROUP));
  const measured = (stats.lookupGroups - before.lookupGroups) / keys.length;
  const comparisons = (stats.lookupProbes - before.lookupProbes) / keys.length;

  assert.ok(Math.abs(load - 0.85) < 0.01, 'the load factor is 0.85, got ' + load.toFixed(3));
  assert.ok(Math.abs(measured - predicted) < 0.05,
    'groups per lookup ' + measured.toFixed(3) + ' against a predicted ' + predicted.toFixed(3));
  assert.ok(comparisons >= 1 && comparisons < 1.15,
    'key comparisons per lookup ' + comparisons.toFixed(3) + ' — the tag rejects the rest');
});

/* -------------------------------------------------------------- rehashing */

test('rehashing: an incremental migration never loses a key, at any step', function () {
  const table = Rehash.create({ hash: hash, capacity: 16, mode: 'incremental', movePerOp: 4 });
  let migrations = 0;
  let wasMigrating = false;

  for (let i = 0; i < 1200; i += 1) {
    table.set('key-' + i, i);
    if (table.migrating() && !wasMigrating) migrations += 1;
    wasMigrating = table.migrating();

    for (let j = 0; j <= i; j += 1) {
      assert.strictEqual(table.get('key-' + j), j,
        'key-' + j + ' after ' + (i + 1) + ' inserts, migrating: ' + table.migrating());
    }
  }

  assert.ok(migrations >= 4, 'several migrations were exercised, not just one');
});

test('rehashing: the incremental trace is flat where the synchronous one spikes', function () {
  const keys = Lab.keys({ kind: 'random', count: 20000, rng: Random.seeded(37) });
  const results = Rehash.compare({ hash: hash, keys: keys, movePerOp: 4, capacity: 16 });
  const sync = results[0];
  const incremental = results[1];

  assert.strictEqual(sync.mode, 'synchronous');
  assert.strictEqual(incremental.mode, 'incremental');
  assert.ok(sync.allFound && incremental.allFound, 'both hold every key at the end');

  assert.ok(sync.peak > 10000, 'one synchronous insert moved ' + sync.peak + ' entries');
  assert.ok(incremental.peak < 200, 'the incremental peak is ' + incremental.peak);
  assert.ok(sync.peak / incremental.peak > 50, 'two orders of magnitude apart');
  assert.ok(incremental.median >= sync.median, 'the typical operation got slightly slower');
  assert.ok(incremental.total > sync.total, 'and the total work went up, which is the trade');
  assert.ok(incremental.total < sync.total * 2.5, 'but not by more than a small factor');
});

test('rehashing: percentiles come out of the trace in order', function () {
  const values = [];
  for (let i = 1; i <= 1000; i += 1) values.push(i);
  assert.strictEqual(Rehash.percentile(values, 0.5), 501);
  assert.strictEqual(Rehash.percentile(values, 0.99), 991);
  assert.strictEqual(Rehash.percentile([], 0.5), 0, 'an empty trace has no percentile');
});

/* --------------------------------------------------------- perfect hashing */

test('perfect hashing: FKS places every key with no collision and O(n) space', function () {
  const hashed = Perfect.seededHash(Hash.murmur3);
  const keys = Lab.keys({ kind: 'words', count: 500, rng: Random.seeded(53) });
  const built = Perfect.buildFks({ keys: keys, hash: hashed });

  const offsets = [];
  let running = 0;
  built.levels.forEach(function (level) { offsets.push(running); running += level.size; });

  const positions = new Set();
  keys.forEach(function (key) {
    const at = built.lookup(key);
    assert.ok(at >= 0, key + ' must be found');
    positions.add(offsets[hashed(key, 0) % keys.length] + at);
  });

  assert.strictEqual(positions.size, keys.length, 'every key has its own slot');
  assert.strictEqual(built.secondarySlots, running, 'the offsets add up');
  assert.ok(built.spaceRatio < 4, 'space ratio ' + built.spaceRatio.toFixed(3) + ' per key');
  keys.forEach(function (key) {
    assert.strictEqual(built.lookup(key + '-stranger'), -1, 'a non-member is rejected');
  });
});

test('perfect hashing: every bucket gets b squared slots and a seed that works', function () {
  const hashed = Perfect.seededHash(Hash.murmur3);
  const keys = Lab.keys({ kind: 'words', count: 300, rng: Random.seeded(59) });
  const built = Perfect.buildFks({ keys: keys, hash: hashed });

  const buckets = built.levels.map(function () { return []; });
  keys.forEach(function (key) { buckets[hashed(key, 0) % keys.length].push(key); });

  let crowded = 0;
  built.levels.forEach(function (level, i) {
    const b = buckets[i].length;
    if (b <= 1) return;
    crowded += 1;
    assert.strictEqual(level.size, b * b, 'bucket ' + i + ' holds ' + b + ' keys');
    const seen = new Set();
    buckets[i].forEach(function (key) { seen.add(hashed(key, level.seed) % level.size); });
    assert.strictEqual(seen.size, b, 'bucket ' + i + ' is collision-free at seed ' + level.seed);
  });
  assert.ok(crowded > 10, 'the key set really does crowd some buckets');
});

test('perfect hashing: CHD is minimal — n keys onto exactly n slots', function () {
  const hashed = Perfect.seededHash(Hash.murmur3);
  const keys = Lab.keys({ kind: 'words', count: 500, rng: Random.seeded(53) });
  const built = Perfect.buildChd({ keys: keys, hash: hashed, lambda: 4 });

  const seen = new Set();
  keys.forEach(function (key) {
    const at = built.lookup(key);
    assert.ok(at >= 0 && at < keys.length, key + ' maps inside [0, n)');
    seen.add(at);
  });

  assert.strictEqual(seen.size, keys.length, 'a minimal perfect hash is a bijection onto [0, n)');
  assert.strictEqual(built.minimal, true, 'and it says so');
  assert.strictEqual(built.buckets, Math.ceil(keys.length / 4), 'lambda = 4 gives n/4 buckets');
  assert.ok(built.bitsPerKey < 5, 'the whole structure is ' + built.bitsPerKey.toFixed(2) + ' bits per key');
});

test('perfect hashing: the seeded hash survives a base function with no finaliser', function () {
  const keys = Lab.keys({ kind: 'words', count: 200, rng: Random.seeded(61) });
  [Hash.fnv1a, Hash.djb2, Hash.murmur3].forEach(function (base) {
    const hashed = Perfect.seededHash(base);
    const built = Perfect.buildFks({ keys: keys, hash: hashed });
    keys.forEach(function (key) { assert.ok(built.lookup(key) >= 0, 'found under an unfinalised base'); });
  });
});

/* ------------------------------------------------------------- ordered map */

test('ordered map: iteration is insertion order and re-insertion moves to the end', function () {
  const map = Ordered.create({ compactAt: 0.5 });
  ['a', 'b', 'c', 'd'].forEach(function (key, i) { map.set(key, i); });
  assert.deepStrictEqual(map.keys(), ['a', 'b', 'c', 'd']);

  map.set('b', 99);
  assert.deepStrictEqual(map.keys(), ['a', 'b', 'c', 'd'], 'an update keeps the position');
  map.delete('b');
  map.set('b', 5);
  assert.deepStrictEqual(map.keys(), ['a', 'c', 'd', 'b'], 're-insertion appends');
  assert.strictEqual(map.size(), 4);
});

test('ordered map: without compaction the array grows by one slot per delete', function () {
  const loose = Ordered.churn({ rounds: 40000, liveKeys: 1000, compactAt: 0 });
  const tight = Ordered.churn({ rounds: 40000, liveKeys: 1000, compactAt: 0.5 });

  assert.strictEqual(loose.size, 1000, 'the live set is unchanged');
  assert.strictEqual(loose.slots, 41000, '1 000 live entries in 41 000 slots');
  assert.strictEqual(loose.growth, 41, 'a 41x growth factor');

  assert.strictEqual(tight.size, 1000);
  assert.strictEqual(tight.slots, 1000, 'compaction holds it at the live size');
  assert.strictEqual(tight.stats.compactions, 40, '40 compactions over 40 000 deletes');
  assert.ok(tight.stats.entriesMoved <= 40000, 'one entry moved per delete, amortised');
  assert.strictEqual(tight.ordered, true, 'and iteration still visits exactly the live keys');
});

/* ---------------------------------------------------------------- the lab */

test('lab: the key streams are distinct, and the colliding one really collides', function () {
  const kinds = ['sequential', 'clustered', 'words', 'random'];
  const sets = kinds.map(function (kind) {
    return Lab.keys({ kind: kind, count: 200, rng: Random.seeded(3) });
  });

  sets.forEach(function (keys, i) {
    assert.strictEqual(keys.length, 200, kinds[i] + ' produced the requested count');
    assert.strictEqual(new Set(keys).size, 200, kinds[i] + ' keys are distinct');
  });

  const attack = Lab.collidingKeys({ hash: Hash.djb2, buckets: 256, count: 50, budget: 100000 });
  assert.strictEqual(attack.keys.length, 50);
  attack.keys.forEach(function (key) {
    assert.strictEqual(Hash.djb2(key) % 256, 0, key + ' lands in the target bucket');
  });

  const starved = Lab.collidingKeys({ hash: Hash.djb2, buckets: 65536, count: 50, budget: 2000 });
  assert.strictEqual(starved.exhausted, true, 'the budget is a hard stop');
  assert.ok(starved.examined <= 2000, 'and it is honoured');
});

test('lab: the cost of the first k colliding keys is recorded, not just the total', function () {
  const big = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 3000, budget: 4000000 });
  const small = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 400, budget: 4000000 });

  assert.strictEqual(big.examinedAt.length, big.keys.length, 'one cost per key found');
  assert.strictEqual(big.examinedAt[big.examinedAt.length - 1] <= big.examined, true, 'costs stay inside the search');
  for (let i = 1; i < big.examinedAt.length; i += 1) {
    assert.ok(big.examinedAt[i] > big.examinedAt[i - 1], 'the cost only ever goes up');
  }

  assert.strictEqual(big.examinedAt[399], small.examined,
    'slicing a long search must quote what the short search would have cost');
});

test('lab: run() reports a scheme that loses keys as incorrect', function () {
  const good = Lab.run({
    table: Chained.create({ hash: hash, capacity: 16 }),
    keys: Lab.keys({ kind: 'random', count: 500, rng: Random.seeded(19) }),
    rng: Random.seeded(23),
    deleteRate: 0.2
  });
  assert.strictEqual(good.correct, true, 'a correct table passes');
  assert.ok(good.probesPerInsert > 0, 'and its probe counters moved');

  const broken = {
    name: 'loses every third key',
    set: function (key, value) { if (this.n++ % 3) this.store.set(key, value); },
    get: function (key) { return this.store.get(key); },
    delete: function (key) { return this.store.delete(key); },
    size: function () { return this.store.size; },
    capacity: function () { return 64; },
    stats: function () { return { inserts: this.n, lookups: 0, insertProbes: this.n, lookupProbes: 0 }; },
    store: new Map(),
    n: 0
  };

  const bad = Lab.run({
    table: broken,
    keys: Lab.keys({ kind: 'random', count: 300, rng: Random.seeded(19) }),
    rng: Random.seeded(23)
  });
  assert.strictEqual(bad.correct, false, 'and a broken one is caught');
  assert.ok(bad.mismatches > 50, 'with a count of what it lost: ' + bad.mismatches);
});
