'use strict';

/**
 * Every figure quoted in the M03 worked examples, recomputed here from the
 * example's own setup and asserted against the text that teaches it.
 *
 * The measured figures are reproduced with the same recipe the section demos
 * use - same hash, same capacity, same seeds - so a module change that moves a
 * number fails the build instead of quietly making the prose wrong.
 */

const test = require('node:test');
const assert = require('node:assert');

const registries = require('../../src/js/content/registries.js');
require('../../src/js/content/examples-hashing.js');

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

const murmur = function (key) { return Hash.murmur3(key, 0); };

function example(sectionId) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[0], 'missing worked example for ' + sectionId);
  return entries[0];
}

function text(entry) {
  return entry.steps.map(function (step) {
    return step.work + '\n' + (step.result || '');
  }).join('\n') + '\n' + entry.answer;
}

/** Asserts that every string appears somewhere in the example. */
function quotes(entry, fragments) {
  const body = text(entry);
  fragments.forEach(function (fragment) {
    assert.ok(body.indexOf(fragment) !== -1, 'the example no longer quotes "' + fragment + '"');
  });
}

/* --------------------------------------------------------- hash functions */

test('hash-functions: the sample count the 40-60% band needs is 421', function () {
  const entry = example('hash-functions');

  assert.strictEqual(Lab.samplesForBand(), 421);
  assert.ok(Math.abs(Math.sqrt(0.25 / 256) - 0.0313) < 0.0001, 'SE at 256 samples');
  assert.ok(Math.abs(Math.sqrt(0.25 / 1024) - 0.0156) < 0.0001, 'SE at 1024 samples');
  assert.strictEqual(Math.ceil(0.25 / Math.pow(0.1 / 4.1, 2)), 421, 'z = 4.1 gives n = 421');
  quotes(entry, ['SE = 0.0313', 'n ≥ 0.25 / (0.10/4.1)² = 421']);
});

test('hash-functions: murmur3 fails at 256 samples and passes at 512, the weak one never', function () {
  const entry = example('hash-functions');
  const short = Lab.avalanche({ hash: Hash.murmurFinalise, samples: 256, rng: Random.seeded(17) });
  const long = Lab.avalanche({ hash: Hash.murmurFinalise, samples: 512, rng: Random.seeded(17) });
  const weak = Lab.avalanche({ hash: Hash.weakFinalise, samples: 512, rng: Random.seeded(17) });

  assert.strictEqual(short.min.toFixed(3), '0.391');
  assert.strictEqual(short.max.toFixed(3), '0.633');
  assert.strictEqual(short.worstZ.toFixed(2), '4.25');
  assert.strictEqual(short.passes, false);

  assert.strictEqual(long.min.toFixed(3), '0.420');
  assert.strictEqual(long.max.toFixed(3), '0.570');
  assert.strictEqual(long.worstZ.toFixed(2), '3.62');
  assert.strictEqual(long.passes, true);

  assert.strictEqual(weak.min, 0);
  assert.strictEqual(weak.max, 1);
  assert.strictEqual(weak.worstZ.toFixed(1), '22.6');

  quotes(entry, ['range 0.391–0.633, worst 4.25σ', 'range 0.420–0.570, worst 3.62σ',
    'range 0.000–1.000, worst 22.6σ']);
});

test('hash-functions: chi-squared reads 0.97 for both the good and the broken hash', function () {
  const entry = example('hash-functions');
  const keys = Lab.keys({ kind: 'words', count: 4096, rng: Random.seeded(23) });

  const good = Lab.chiSquared({ hash: murmur, keys: keys, buckets: 512 });
  const weak = Lab.chiSquared({
    hash: function (key) { return Hash.weakFinalise(Hash.fnv1a(key)); }, keys: keys, buckets: 512
  });

  assert.strictEqual(good.ratio.toFixed(3), '0.971');
  assert.strictEqual(weak.ratio.toFixed(3), '0.965');
  quotes(entry, ['murmur3: 0.971', 'weak:    0.965']);
});

/* -------------------------------------------------------- universal hashing */

test('universal-hashing: the attack costs 2 124 047 hashes and 2 001 000 comparisons', function () {
  const entry = example('universal-hashing');
  const attack = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 2000, budget: 4000000 });

  assert.strictEqual(attack.keys.length, 2000);
  assert.strictEqual(attack.examined, 2124047);
  assert.strictEqual(2000 * 2001 / 2, 2001000, 'the closed form for the insert cost');
  assert.ok(Math.abs(attack.examined - 2000 * 1024) / (2000 * 1024) < 0.1,
    'and it is within 10% of the expected 2 048 000');

  quotes(entry, ['measured: 2,124,047 hashed', 'measured: 2,001,000',
    '(1 + 2 + … + 2,000) / 2,000 = 1,000.5']);
});

/** The three tables the example compares, on the same 2 000 colliding keys. */
function flood(options) {
  const attack = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 2000, budget: 4000000 });
  const table = Chained.create({
    hash: options.hash, capacity: 1024, maxLoad: 1e9, treeifyAt: options.treeifyAt || 0
  });

  attack.keys.forEach(function (key, i) { table.set(key, i); });
  const inserted = table.stats();
  attack.keys.forEach(function (key) { table.get(key); });
  const looked = table.stats();

  return {
    insertProbes: inserted.insertProbes,
    maxChain: looked.maxChain,
    perLookup: (looked.lookupProbes - inserted.lookupProbes) / attack.keys.length
  };
}

test('universal-hashing: treeify is 104x better and a keyed hash 507x', function () {
  const entry = example('universal-hashing');
  const seed = Random.seeded(987654321).int(1 << 30);

  const naive = flood({ hash: Hash.djb2 });
  const treeified = flood({ hash: Hash.djb2, treeifyAt: 8 });
  const keyed = flood({ hash: function (key) { return Hash.murmur3(key, seed); } });

  assert.strictEqual(naive.insertProbes, 2001000);
  assert.strictEqual(naive.maxChain, 2000);
  assert.strictEqual(naive.perLookup, 1000.5, 'a successful lookup walks half the chain');

  assert.strictEqual(treeified.insertProbes, 19238);
  assert.strictEqual(treeified.perLookup.toFixed(2), '9.98');
  assert.strictEqual(Math.round(naive.insertProbes / treeified.insertProbes), 104);
  assert.ok(treeified.perLookup < Math.log2(2000) + 1, 'binary search on a 2 000-entry bucket');

  assert.strictEqual(keyed.insertProbes, 3949);
  assert.strictEqual(keyed.maxChain, 9);
  assert.strictEqual(keyed.perLookup.toFixed(2), '1.97');
  assert.strictEqual(Math.round(naive.insertProbes / keyed.insertProbes), 507);

  quotes(entry, ['insert comparisons: 19,238', 'per lookup: 9.98, against log2(2,000) = 10.97',
    'insert comparisons: 3,949 = 507× less', 'per lookup: 1.97', 'longest bucket: 9']);
});

/* -------------------------------------------------------- separate chaining */

test('separate-chaining: the Poisson figures are what the example claims', function () {
  const entry = example('separate-chaining');
  const poisson = function (k) {
    let factorial = 1;
    for (let i = 2; i <= k; i += 1) factorial *= i;
    return Math.exp(-1) / factorial;
  };

  assert.strictEqual((poisson(0) * 1000).toFixed(0), '368', 'empty buckets');
  assert.strictEqual((poisson(1) * 1000).toFixed(0), '368', 'singletons');
  assert.strictEqual((poisson(2) * 1000).toFixed(0), '184', 'pairs');

  let cumulative = 0;
  for (let k = 0; k <= 4; k += 1) cumulative += poisson(k);
  assert.strictEqual((1 - cumulative).toFixed(5), '0.00366', 'P(>= 5)');
  assert.strictEqual(((1 - cumulative) * 1000).toFixed(1), '3.7', 'buckets with five or more');

  let toFive = cumulative + poisson(5);
  assert.strictEqual((1 - toFive).toFixed(6), '0.000594', 'P(>= 6)');
  quotes(entry, ['empty ≈ 1000 × 0.3679 = 368', 'P(≥5) = 1 − Σ_{k≤4} = 0.00366 ⇒ 3.7 buckets',
    'P(≥6) = 0.000594']);
});

test('separate-chaining: a measured table really does average 1 + alpha/2 comparisons', function () {
  const table = Chained.create({ hash: murmur, capacity: 1000, maxLoad: 1e9 });
  const keys = Lab.keys({ kind: 'random', count: 1000, rng: Random.seeded(31) });
  keys.forEach(function (key, i) { table.set(key, i); });

  const before = table.stats();
  keys.forEach(function (key) { table.get(key); });
  const perLookup = (table.stats().lookupProbes - before.lookupProbes) / keys.length;

  assert.ok(Math.abs(perLookup - 1.5) < 0.15,
    'measured ' + perLookup.toFixed(2) + ' comparisons against a predicted 1.5');
  assert.ok(Math.abs(before.emptyBuckets - 368) < 40, 'empty buckets ' + before.emptyBuckets);
});

/* --------------------------------------------------------- open addressing */

/** The section's own recipe: fill to alpha, then roll deletes and inserts. */
function churn(deletion, rounds) {
  const table = Open.create({
    hash: murmur, capacity: 1024, probe: 'linear', deletion: deletion, maxLoad: 1e9
  });
  const live = [];
  Lab.keys({ kind: 'random', count: 716, rng: Random.seeded(61) })
    .forEach(function (key, i) { table.set(key, i); live.push(key); });

  const rng = Random.seeded(97);
  for (let step = 0; step < rounds; step += 1) {
    table.delete(live.splice(rng.int(live.length), 1)[0]);
    table.set('churn-' + step, step);
    live.push('churn-' + step);
  }

  const absent = [];
  for (let i = 0; i < 400; i += 1) absent.push('absent-' + i);

  return {
    hit: probesFor(table, live),
    miss: probesFor(table, absent),
    tombstones: table.stats().tombstones,
    size: table.size(),
    load: table.stats().load
  };
}

function probesFor(table, keys) {
  const before = table.stats();
  keys.forEach(function (key) { table.get(key); });
  const after = table.stats();
  return (after.lookupProbes - before.lookupProbes) / (after.lookups - before.lookups);
}

test('open-addressing: the fresh table matches the closed forms', function () {
  const entry = example('open-addressing');
  const fresh = churn('tombstone', 0);

  assert.strictEqual(Open.expectedProbes(0.7, true).toFixed(2), '2.17');
  assert.strictEqual(Open.expectedProbes(0.7, false).toFixed(2), '6.06');
  assert.strictEqual(fresh.hit.toFixed(2), '2.11');
  assert.strictEqual(fresh.miss.toFixed(1), '6.0');
  assert.ok(Math.abs(fresh.hit - 2.17) / 2.17 < 0.03, 'within 3% of theory');

  quotes(entry, ['½(1 + 1/(1−0.70)) = 2.17', 'measured: 2.11 hit, 6.0 miss']);
});

test('open-addressing: 5 000 churn operations leave 308 tombstones and a full table', function () {
  const entry = example('open-addressing');
  const tombstoned = churn('tombstone', 5000);

  assert.strictEqual(tombstoned.size, 716, 'the live count never moved');
  assert.strictEqual(tombstoned.load.toFixed(2), '0.70', 'nor did the load factor');
  assert.strictEqual(tombstoned.tombstones, 308);
  assert.strictEqual(tombstoned.tombstones + tombstoned.size, 1024, 'every slot is non-empty');
  assert.strictEqual(tombstoned.hit.toFixed(2), '5.01');
  assert.strictEqual(tombstoned.miss, 1024, 'a miss scans the whole table');
  assert.strictEqual(Math.round(1024 / 6.0), 171, 'the stated 171x');

  quotes(entry, ['after 5 000 operations: 308 tombstones', 'hit:  2.11 → 5.01 probes  (2.4×)',
    'miss: 6.0 → 1,024 probes  (171×)']);
});

test('open-addressing: backward-shift deletion holds the same workload flat', function () {
  const entry = example('open-addressing');
  const shifted = churn('backward-shift', 5000);

  assert.strictEqual(shifted.tombstones, 0);
  assert.strictEqual(shifted.size, 716);
  assert.strictEqual(shifted.hit.toFixed(2), '2.26');
  assert.strictEqual(shifted.miss.toFixed(1), '5.5');

  quotes(entry, ['hit:  2.11 → 2.26', 'miss: 6.0 → 5.5', 'tombstones: 0 throughout']);
});

/* -------------------------------------------------------------- robin hood */

function rhKeys() {
  return Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });
}

test('robin-hood: the mean is identical and the variance is 7.5x lower', function () {
  const entry = example('robin-hood');
  const keys = rhKeys();

  const linear = Open.create({ hash: murmur, capacity: 2048, probe: 'linear', maxLoad: 0.999 });
  keys.forEach(function (key, i) { linear.set(key, i); });
  const plain = RobinHood.summarise(keys.map(function (key) {
    return linear.probeWalk(key).length - 1;
  }));

  const robin = RobinHood.createRobinHood({ hash: murmur, capacity: 2048, maxLoad: 0.999 });
  keys.forEach(function (key, i) { robin.set(key, i); });
  const rich = RobinHood.summarise(robin.distances());

  assert.strictEqual(plain.meanDistance.toFixed(2), '2.88');
  assert.strictEqual(rich.meanDistance.toFixed(2), '2.88');
  assert.strictEqual(plain.meanDistance, rich.meanDistance, 'identical, as they must be');

  assert.strictEqual(plain.varianceDistance.toFixed(2), '68.77');
  assert.strictEqual(rich.varianceDistance.toFixed(2), '9.16');
  assert.strictEqual(plain.p99Distance, 44);
  assert.strictEqual(rich.p99Distance, 14);
  assert.strictEqual(plain.maxDistance, 92);
  assert.strictEqual(rich.maxDistance, 17);

  quotes(entry, ['mean distance: linear 2.88, robin hood 2.88', 'variance: 68.77 → 9.16',
    'p99:      44 → 14', 'worst:    92 → 17']);
});

test('robin-hood: hopscotch at H = 8 cannot hold the load, and cuckoo pays in memory', function () {
  const entry = example('robin-hood');
  const keys = rhKeys();

  const tight = RobinHood.createHopscotch({ hash: murmur, capacity: 2048, neighbourhood: 8 });
  keys.forEach(function (key, i) { tight.set(key, i); });
  assert.strictEqual(tight.stats().resizes, 1, 'it grew exactly once');
  assert.strictEqual(tight.capacity(), 4096);
  assert.strictEqual((tight.size() / tight.capacity()).toFixed(2), '0.42');
  assert.strictEqual(tight.stats().maxDistance, 7);

  const roomy = RobinHood.createHopscotch({ hash: murmur, capacity: 2048, neighbourhood: 32 });
  keys.forEach(function (key, i) { roomy.set(key, i); });
  assert.strictEqual(roomy.stats().resizes, 0, 'H = 32 holds the same load');
  assert.strictEqual((roomy.size() / roomy.capacity()).toFixed(2), '0.85');
  assert.strictEqual(roomy.stats().maxDistance, 31);

  const cuckoo = RobinHood.createCuckoo({ hash: murmur, capacity: 1740 });
  keys.forEach(function (key, i) { cuckoo.set(key, i); });
  assert.strictEqual(cuckoo.capacity(), 3480);
  assert.strictEqual((cuckoo.size() / cuckoo.capacity()).toFixed(2), '0.50');
  assert.strictEqual(cuckoo.stats().cycles, 0);

  quotes(entry, ['it grew once: 4 096 slots, final load 0.42, worst distance 7',
    'at H = 32 it holds α = 0.85 with worst distance 31',
    'two tables of 1 740 slots = 3 480 slots for 1 740 keys', 'load 0.50, 0 insertion cycles']);
});

/* ------------------------------------------------------------ swiss tables */

test('swiss-tables: 1.08 groups and 1.06 comparisons per lookup, as alpha^16 predicts', function () {
  const entry = example('swiss-tables');
  const keys = rhKeys();
  const table = Swiss.create({ hash: murmur, capacity: 2048, maxLoad: 0.9 });
  keys.forEach(function (key, i) { table.set(key, i); });

  const before = table.stats();
  keys.forEach(function (key) { table.get(key); });
  const after = table.stats();

  const groups = (after.lookupGroups - before.lookupGroups) / keys.length;
  const comparisons = (after.lookupProbes - before.lookupProbes) / keys.length;

  assert.strictEqual(table.capacity(), 2048);
  assert.strictEqual(table.groups(), 128, '2 048 slots is 128 groups of 16');
  assert.strictEqual((table.size() / table.capacity()).toFixed(2), '0.85');
  assert.strictEqual(groups.toFixed(3), '1.080');
  assert.strictEqual(comparisons.toFixed(3), '1.059');

  assert.strictEqual(Math.pow(0.85, 16).toFixed(4), '0.0743');
  assert.strictEqual((1 / (1 - Math.pow(0.85, 16))).toFixed(3), '1.080');
  assert.strictEqual(Open.expectedProbes(0.85, true).toFixed(2), '3.83');
  assert.strictEqual((1 / 128).toFixed(4), '0.0078', 'the 7-bit tag false-match rate');

  quotes(entry, ['groups = 2,048 / 16 = 128 groups of 16 bytes', 'α^16 = 0.85^16 = 0.074',
    'measured groups per lookup: 1.080', 'measured key comparisons per lookup: 1.059',
    '½(1 + 1/(1−0.85)) = 3.83']);
});

/* -------------------------------------------------------------- rehashing */

test('rehashing: the synchronous spike and the incremental cap are what is claimed', function () {
  const entry = example('rehashing');
  const keys = Lab.keys({ kind: 'random', count: 20000, rng: Random.seeded(37) });
  const results = Rehash.compare({ hash: murmur, keys: keys, movePerOp: 4, capacity: 16 });
  const sync = results[0];
  const incremental = results[1];

  assert.strictEqual(sync.median, 2);
  assert.strictEqual(sync.p99, 18);
  assert.strictEqual(sync.p999, 42);
  assert.strictEqual(sync.peak, 14567);
  assert.strictEqual(sync.total, 84633);
  assert.strictEqual((sync.total / keys.length).toFixed(1), '4.2', 'amortised cost per insert');

  assert.strictEqual(incremental.median, 3);
  assert.strictEqual(incremental.p99, 37);
  assert.strictEqual(incremental.p999, 63);
  assert.strictEqual(incremental.peak, 98);
  assert.strictEqual(incremental.total, 149468);

  assert.strictEqual(Math.round(sync.peak / incremental.peak), 149);
  assert.strictEqual((incremental.total / sync.total).toFixed(2), '1.77');
  assert.strictEqual(Math.round(sync.peak / sync.p999), 347, 'the worst case over the p99.9');

  quotes(entry, ['measured peak: 14,567 slot writes in a single insert',
    'total work: 84,633 for 20,000 inserts = 4.2 per insert',
    'synchronous:  median 2, p99 18, p99.9 42, worst 14,567',
    'incremental: median 3, p99 37, p99.9 63, worst 98',
    'total work: 84,633 → 149,468 = 1.77×']);
});

/* --------------------------------------------------------- perfect hashing */

test('perfect-hashing: FKS takes 1 528 slots and CHD 3.00 bits per key', function () {
  const entry = example('perfect-hashing');
  const keys = Lab.keys({ kind: 'words', count: 500, rng: Random.seeded(53) });
  const hashed = Perfect.seededHash(Hash.murmur3);

  const fks = Perfect.buildFks({ keys: keys, hash: hashed });
  assert.strictEqual(fks.secondarySlots, 1028);
  assert.strictEqual(fks.slotsUsed, 1528);
  assert.strictEqual(fks.spaceRatio.toFixed(2), '3.06');
  assert.strictEqual(fks.seedAttempts, 166);

  const chd = Perfect.buildChd({ keys: keys, hash: hashed, lambda: 4 });
  assert.strictEqual(chd.buckets, 125, '500 / lambda 4');
  assert.strictEqual(chd.maxDisplacement, 3080);
  assert.strictEqual(Math.ceil(Math.log2(3081)), 12, 'twelve bits per displacement');
  assert.strictEqual(chd.bitsPerKey.toFixed(2), '3.00');
  assert.strictEqual(chd.displacementAttempts, 21961);
  assert.strictEqual(chd.minimal, true);
  assert.strictEqual(Math.ceil(125 * 12 / 8), 188, 'the structure is 188 bytes');

  assert.strictEqual(Math.ceil(500 / 0.7), 715, 'a hash table needs at least 715 slots');
  assert.strictEqual((500 / 1024 * 100).toFixed(0), '49', 'so 1 024 slots are 49% occupied');

  quotes(entry, ['secondary slots: 1,028', 'total: 500 + 1,028 = 1,528 slots = 3.06 per key',
    'largest displacement: 3,080 ⇒ 12 bits each', 'space = 125 × 12 / 500 = 3.00 bits per key',
    'FKS: 166 seed trials', 'CHD: 21,961 displacement trials']);
});

/* -------------------------------------------------------- hash in practice */

test('hash-in-practice: 41 000 slots without compaction, 1 000 with it', function () {
  const entry = example('hash-in-practice');
  const loose = Ordered.churn({ rounds: 40000, liveKeys: 1000, compactAt: 0 });
  const tight = Ordered.churn({ rounds: 40000, liveKeys: 1000, compactAt: 0.5 });

  assert.strictEqual(loose.size, 1000);
  assert.strictEqual(loose.slots, 41000);
  assert.strictEqual(loose.growth, 41);

  assert.strictEqual(tight.size, 1000);
  assert.strictEqual(tight.slots, 1000);
  assert.strictEqual(tight.growth, 1);
  assert.strictEqual(tight.stats.compactions, 40);
  assert.ok(tight.stats.entriesMoved <= 40000, 'one move per delete, amortised');

  quotes(entry, ['measured: 41,000 slots for 1,000 entries',
    'measured: 1,000 slots for 1,000 entries, 40 compactions',
    '40 compactions over 40,000 deletes']);
});

/* ==========================================================================
   The second worked example in each section, measured against the same
   modules the demos drive.
   ========================================================================== */

function second(sectionId) {
  const entries = registries.ExampleRegistry.get(sectionId);
  assert.ok(entries && entries[1], 'missing second worked example for ' + sectionId);
  return entries[1];
}

test('hash-functions: the low bits and the high bits fail separately', function () {
  const entry = second('hash-functions');
  const words = Lab.keys({ kind: 'words', count: 4096, rng: Random.seeded(23) });
  const sequential = Lab.keys({ kind: 'sequential', count: 4096, rng: Random.seeded(1) });

  function ends(base, keys) {
    return {
      low: Lab.chiSquared({ hash: function (k) { return base(k) & 511; }, keys: keys, buckets: 512 }),
      high: Lab.chiSquared({ hash: function (k) { return base(k) >>> 23; }, keys: keys, buckets: 512 })
    };
  }

  const fnvWords = ends(Hash.fnv1a, words);
  const djbWords = ends(Hash.djb2, words);
  const murmurWords = ends(murmur, words);

  assert.strictEqual(fnvWords.low.ratio.toFixed(3), '0.794');
  assert.strictEqual(fnvWords.high.ratio.toFixed(3), '1.242');
  assert.strictEqual(djbWords.low.ratio.toFixed(3), '1.465');
  assert.strictEqual(djbWords.high.ratio.toFixed(3), '67.818');
  assert.strictEqual(murmurWords.low.ratio.toFixed(3), '0.971');
  assert.strictEqual(murmurWords.high.ratio.toFixed(3), '1.009');

  const fnvSeq = ends(Hash.fnv1a, sequential);
  const djbSeq = ends(Hash.djb2, sequential);
  const murmurSeq = ends(murmur, sequential);

  assert.strictEqual(fnvSeq.low.ratio.toFixed(3), '0.863');
  assert.strictEqual(fnvSeq.high.ratio.toFixed(3), '1.556');
  assert.strictEqual(fnvSeq.high.maxBucket, 20);
  assert.strictEqual(djbSeq.low.ratio.toFixed(3), '2.843');
  assert.strictEqual(djbSeq.high.ratio.toFixed(3), '2536.851');
  assert.strictEqual(djbSeq.high.maxBucket, 3096);
  assert.strictEqual(Math.round(3096 / 4096 * 100), 76, 'the share of keys in one bucket');
  assert.strictEqual(murmurSeq.low.ratio.toFixed(3), '1.009');
  assert.strictEqual(murmurSeq.high.ratio.toFixed(3), '0.976');

  quotes(entry, ['djb2           1.465       67.818', 'djb2           2.843     2,536.851     3,096 of 4,096',
    'murmur3        1.009        0.976']);
});

test('universal-hashing: the guarantee is about the multiplier, not the keys', function () {
  const entry = second('universal-hashing');
  const bits = 10;
  const buckets = 1 << bits;
  const trials = 40000;
  const rng = Random.seeded(41);

  let collisions = 0;
  for (let t = 0; t < trials; t += 1) {
    const a = rng.int(0x7fffffff) | 1;
    if (Hash.multiplyShift(0x1234abcd, a, bits) === Hash.multiplyShift(0x1234abce, a, bits)) collisions += 1;
  }
  assert.strictEqual(collisions, 43);
  assert.strictEqual((collisions / trials).toFixed(5), '0.00108');
  assert.strictEqual((2 / buckets).toFixed(5), '0.00195');
  assert.ok(collisions / trials <= 2 / buckets, 'inside the universality bound');

  function spread(a) {
    const counts = new Uint32Array(buckets);
    for (let k = 0; k < 4096; k += 1) counts[Hash.multiplyShift(k * 65536, a, bits)] += 1;
    const expected = 4096 / buckets;
    let chi = 0;
    counts.forEach(function (c) { chi += (c - expected) * (c - expected) / expected; });
    return {
      ratio: chi / (buckets - 1),
      worst: Math.max.apply(null, Array.from(counts)),
      empty: Array.from(counts).filter(function (c) { return c === 0; }).length
    };
  }

  const golden = spread(2654435769);
  const structured = spread(65537);
  const tiny = spread(3);

  assert.strictEqual(golden.ratio.toFixed(2), '0.17');
  assert.strictEqual(golden.worst, 6);
  assert.strictEqual(golden.empty, 0);
  assert.strictEqual(structured.ratio.toFixed(2), '60.06');
  assert.strictEqual(structured.worst, 64);
  assert.strictEqual(structured.empty, 960);
  assert.strictEqual(tiny.ratio.toFixed(2), '17.36');
  assert.strictEqual(tiny.empty, 832);
  assert.strictEqual(65537 % 2, 1, 'and it is odd, which is all the theorem asks');

  const tables = Hash.buildTabulation(Random.seeded(77));
  const counts = new Uint32Array(1024);
  for (let i = 0; i < 100000; i += 1) counts[Hash.tabulate(tables, i * 1024) % 1024] += 1;
  const expected = 100000 / 1024;
  let chi = 0;
  counts.forEach(function (c) { chi += (c - expected) * (c - expected) / expected; });
  assert.strictEqual((chi / 1023).toFixed(3), '0.889');

  quotes(entry, ['collisions: 43 ⇒ rate 0.00108', '2/m = 2/1024 = 0.00195',
    'chi²/dof 0.17, worst bucket 6, 0 buckets empty',
    'chi²/dof 60.06, worst bucket 64, 960 of 1,024 buckets empty', 'chi²/dof 0.889']);
});

test('separate-chaining: treeify is free on random keys and 59x on crafted ones', function () {
  const entry = second('separate-chaining');

  function chained(options) {
    const table = Chained.create({
      hash: options.hash, capacity: 1024, maxLoad: 1e9, treeifyAt: options.treeifyAt || 0
    });
    options.keys.forEach(function (key, i) { table.set(key, i); });
    const inserted = table.stats();
    options.keys.forEach(function (key) { table.get(key); });
    const looked = table.stats();
    return {
      insertProbes: inserted.insertProbes,
      maxChain: looked.maxChain,
      treeBuckets: looked.treeBuckets,
      perLookup: (looked.lookupProbes - inserted.lookupProbes) / options.keys.length
    };
  }

  const random = Lab.keys({ kind: 'random', count: 1024, rng: Random.seeded(31) });
  const plain = chained({ hash: murmur, keys: random, treeifyAt: 0 });
  const treeified = chained({ hash: murmur, keys: random, treeifyAt: 8 });

  assert.deepStrictEqual(plain, treeified, 'the threshold never fires on well-mixed keys');
  assert.strictEqual(plain.insertProbes, 1537);
  assert.strictEqual(plain.maxChain, 5);
  assert.strictEqual(plain.treeBuckets, 0);
  assert.strictEqual(plain.perLookup.toFixed(2), '1.50');

  let cumulative = 0;
  for (let k = 0; k <= 7; k += 1) {
    let factorial = 1;
    for (let i = 2; i <= k; i += 1) factorial *= i;
    cumulative += Math.exp(-1) / factorial;
  }
  assert.strictEqual((1 - cumulative).toExponential(2), '1.02e-5', 'P(bucket reaches 8) at alpha = 1');
  assert.strictEqual((1024 * (1 - cumulative)).toFixed(4), '0.0105');

  const attack = Lab.collidingKeys({ hash: Hash.djb2, buckets: 1024, count: 1024, budget: 4000000 }).keys;
  const flooded = chained({ hash: Hash.djb2, keys: attack, treeifyAt: 0 });
  const defended = chained({ hash: Hash.djb2, keys: attack, treeifyAt: 8 });

  assert.strictEqual(flooded.insertProbes, 524800);
  assert.strictEqual(flooded.perLookup.toFixed(1), '512.5');
  assert.strictEqual(defended.insertProbes, 8890);
  assert.strictEqual(defended.perLookup.toFixed(2), '9.01');
  assert.strictEqual(defended.treeBuckets, 1);
  assert.strictEqual(defended.maxChain, 1024, 'the bucket is as long as ever');
  assert.strictEqual(Math.round(flooded.insertProbes / defended.insertProbes), 59);
  assert.strictEqual(Math.round(flooded.perLookup / defended.perLookup), 57);

  quotes(entry, ['treeifyAt 0: 1,537 insert comparisons, longest chain 5, 1.50 per lookup',
    'treeifyAt 0: 524,800 insert comparisons, 512.5 per lookup',
    'treeifyAt 8:   8,890 insert comparisons,   9.01 per lookup']);
});

test('open-addressing: the three probe sequences at alpha = 0.9', function () {
  const entry = second('open-addressing');

  function measure(probe) {
    const capacity = probe === 'double' ? 1031 : 1024;
    const count = Math.floor(capacity * 0.9);
    const table = Open.create({ hash: murmur, capacity: capacity, probe: probe, maxLoad: 1e9 });
    const keys = Lab.keys({ kind: 'random', count: count, rng: Random.seeded(83) });
    keys.forEach(function (key, i) { table.set(key, i); });

    const before = table.stats();
    keys.forEach(function (key) { table.get(key); });
    const afterHits = table.stats();
    const absent = [];
    for (let i = 0; i < 200; i += 1) absent.push('absent-' + i);
    absent.forEach(function (key) { table.get(key); });
    const afterMisses = table.stats();

    return {
      hit: (afterHits.lookupProbes - before.lookupProbes) / count,
      miss: (afterMisses.lookupProbes - afterHits.lookupProbes) / 200,
      longestCluster: afterHits.longestCluster,
      maxInsertProbe: afterHits.maxInsertProbe
    };
  }

  const linear = measure('linear');
  const quadratic = measure('quadratic');
  const double = measure('double');

  assert.strictEqual(linear.hit.toFixed(2), '4.64');
  assert.strictEqual(linear.miss.toFixed(1), '31.2');
  assert.strictEqual(linear.longestCluster, 126);
  assert.strictEqual(linear.maxInsertProbe, 97);

  assert.strictEqual(quadratic.hit.toFixed(2), '2.55');
  assert.strictEqual(quadratic.miss.toFixed(1), '11.1');
  assert.strictEqual(quadratic.longestCluster, 97);
  assert.strictEqual(quadratic.maxInsertProbe, 21);

  assert.strictEqual(double.hit.toFixed(2), '2.55');
  assert.strictEqual(double.miss.toFixed(1), '10.2');
  assert.strictEqual(double.longestCluster, 44);
  assert.strictEqual(double.maxInsertProbe, 31);

  assert.strictEqual(Open.expectedProbes(0.9, true).toFixed(2), '5.50');
  assert.strictEqual(Open.expectedProbes(0.9, false).toFixed(1), '50.5');
  assert.strictEqual(Math.round(linear.miss / double.miss), 3, 'three times the miss cost');
  assert.strictEqual(126 * 8, 1008, 'bytes in the longest linear run');
  assert.strictEqual(Math.ceil(1008 / 64), 16, 'cache lines, read sequentially');

  quotes(entry, ['linear       4.64   31.2        126               97',
    'quadratic    2.55   11.1         97               21',
    'double       2.55   10.2         44               31']);
});

test('robin-hood: same probes, 2.46 writes per insert', function () {
  const entry = second('robin-hood');
  const keys = Lab.keys({ kind: 'random', count: 1740, rng: Random.seeded(83) });

  const linear = Open.create({ hash: murmur, capacity: 2048, probe: 'linear', maxLoad: 0.999 });
  keys.forEach(function (key, i) { linear.set(key, i); });

  const robin = RobinHood.createRobinHood({ hash: murmur, capacity: 2048, maxLoad: 0.999 });
  keys.forEach(function (key, i) { robin.set(key, i); });

  assert.strictEqual(linear.stats().insertProbes, 6757);
  assert.strictEqual(robin.stats().insertProbes, 6757);
  assert.strictEqual(robin.stats().displacements, 2537);
  assert.strictEqual((1 + 2537 / 1740).toFixed(2), '2.46');
  assert.strictEqual(linear.stats().maxInsertProbe, 93);
  assert.strictEqual(robin.stats().maxInsertProbe, 7);
  assert.strictEqual(Math.round(93 / 7), 13, 'a 13x shorter worst insert');

  quotes(entry, ['linear probing: 6,757 probes over 1,740 inserts',
    '= 2.46 writes per insert', 'worst single insert: linear 93 probes, robin hood 7']);
});

test('swiss-tables: deletions leave control bytes, not holes', function () {
  const entry = second('swiss-tables');
  const table = Swiss.create({ hash: murmur, capacity: 2048, maxLoad: 0.875 });
  const keys = Lab.keys({ kind: 'random', count: 1400, rng: Random.seeded(51) });

  keys.forEach(function (key, i) { table.set(key, i); });
  for (let i = 0; i < 700; i += 1) table.delete(keys[i]);

  const stats = table.stats();
  assert.strictEqual(table.size(), 700);
  assert.strictEqual(stats.deleted, 700);
  assert.strictEqual(stats.load.toFixed(3), '0.342');
  assert.strictEqual(stats.resizes, 0);

  const before = table.stats();
  keys.slice(700).forEach(function (key) { table.get(key); });
  const after = table.stats();
  assert.strictEqual(((after.lookupGroups - before.lookupGroups) / 700).toFixed(3), '1.051');

  assert.strictEqual((1 / 128).toFixed(4), '0.0078');
  assert.strictEqual((1 / 16).toFixed(4), '0.0625');
  assert.strictEqual(Math.round((1 / 16) / (1 / 128)), 8, 'eight times the false matches');
  assert.strictEqual(Swiss.EMPTY, 0x80);
  assert.strictEqual(Swiss.DELETED, 0xfe);
  assert.strictEqual(Swiss.TAG_MASK, 0x7f);

  keys.slice(700).forEach(function (key, i) {
    assert.strictEqual(table.get(key), i + 700, 'every surviving key is still reachable');
  });

  quotes(entry, ['DELETED control bytes: 700', 'load reported: 0.342',
    'groups per lookup with 700 DELETED bytes: 1.051', 'false match rate = 1/128 = 0.0078']);
});

test('rehashing: reserving the capacity removes the spike entirely', function () {
  const entry = second('rehashing');
  const keys = Lab.keys({ kind: 'random', count: 20000, rng: Random.seeded(37) });

  function run(capacity) {
    const table = Rehash.create({ hash: murmur, capacity: capacity, mode: 'synchronous' });
    keys.forEach(function (key, i) { table.set(key, i); });
    const trace = table.trace();
    return {
      total: trace.reduce(function (a, b) { return a + b; }, 0),
      peak: table.stats().peakWork,
      resizes: table.stats().resizes,
      p999: Rehash.percentile(trace, 0.999),
      capacity: table.capacity()
    };
  }

  const grown = run(16);
  const reserved = run(32768);

  assert.strictEqual(grown.total, 84633);
  assert.strictEqual(grown.peak, 14567);
  assert.strictEqual(grown.resizes, 11);
  assert.strictEqual(grown.p999, 42);

  assert.strictEqual(reserved.total, 36043);
  assert.strictEqual(reserved.peak, 44);
  assert.strictEqual(reserved.resizes, 0);
  assert.strictEqual(reserved.p999, 22);
  assert.strictEqual(reserved.capacity, grown.capacity, 'both end at the same size');

  assert.strictEqual(Math.ceil(20000 / 0.7 / 32768), 1, '20 000 keys at load 0.7 fit 32 768 slots');
  assert.strictEqual((grown.total / reserved.total).toFixed(2), '2.35');
  assert.strictEqual(Math.round(grown.peak / reserved.peak), 331);

  quotes(entry, ['total work: 84,633 units', 'total work: 36,043 units',
    'worst single insert: 44', 'reserved, 32,768    36,043           44']);
});

test('perfect-hashing: lambda trades build time for bits per key', function () {
  const entry = second('perfect-hashing');
  const keys = Lab.keys({ kind: 'words', count: 500, rng: Random.seeded(53) });
  const hashed = Perfect.seededHash(Hash.murmur3);

  const rows = [2, 3, 4, 5, 6].map(function (lambda) {
    const built = Perfect.buildChd({ keys: keys, hash: hashed, lambda: lambda });
    return {
      lambda: lambda,
      buckets: built.buckets,
      bits: built.bitsPerKey,
      maxDisplacement: built.maxDisplacement,
      trials: built.displacementAttempts,
      largest: built.largestBucket,
      minimal: built.minimal
    };
  });

  assert.deepStrictEqual(rows.map(function (r) { return r.buckets; }), [250, 167, 125, 100, 84]);
  assert.deepStrictEqual(rows.map(function (r) { return r.bits.toFixed(2); }),
    ['4.50', '4.01', '3.00', '2.80', '2.52']);
  assert.deepStrictEqual(rows.map(function (r) { return r.trials; }),
    [3809, 10668, 21961, 62119, 227969]);
  assert.deepStrictEqual(rows.map(function (r) { return r.maxDisplacement; }),
    [274, 2998, 3080, 10824, 32538]);
  assert.strictEqual(rows[4].largest, 15, 'the largest bucket at lambda = 6');
  assert.ok(rows.every(function (r) { return r.minimal; }), 'every setting is still minimal');

  assert.strictEqual(Math.round((1 - 2.52 / 4.50) * 100), 44, 'space saved from lambda 2 to 6');
  assert.strictEqual(Math.round(227969 / 3809), 60, 'build cost multiplier');

  quotes(entry, ['2      250       4.50            274            3,809',
    '6       84       2.52         32,538          227,969',
    'λ = 6 ⇒ largest bucket 15 keys']);
});

test('hash-in-practice: the ranking changes with the workload', function () {
  const entry = second('hash-in-practice');
  const keys = Lab.keys({ kind: 'random', count: 5000, rng: Random.seeded(3) });

  const schemes = {
    'swiss table': function () { return Swiss.create({ hash: murmur, capacity: 32 }); },
    chaining: function () { return Chained.create({ hash: murmur, capacity: 16, treeifyAt: 8 }); },
    'linear/tombstone': function () { return Open.create({ hash: murmur, capacity: 16, probe: 'linear' }); },
    'linear/shift': function () {
      return Open.create({ hash: murmur, capacity: 16, probe: 'linear', deletion: 'backward-shift' });
    },
    'robin hood': function () { return RobinHood.createRobinHood({ hash: murmur, capacity: 16 }); }
  };

  function probes(name, deleteRate) {
    const result = Lab.run({
      table: schemes[name](), keys: keys, rng: Random.seeded(23), deleteRate: deleteRate
    });
    assert.strictEqual(result.correct, true, name + ' must still be correct');
    return result;
  }

  const read = {};
  const churn = {};
  Object.keys(schemes).forEach(function (name) {
    read[name] = probes(name, 0);
    churn[name] = probes(name, 0.45);
  });

  assert.strictEqual(read['swiss table'].probesPerLookup.toFixed(2), '1.04');
  assert.strictEqual(read.chaining.probesPerLookup.toFixed(2), '1.30');
  assert.strictEqual(read['linear/tombstone'].probesPerLookup.toFixed(2), '1.80');
  assert.strictEqual(read['linear/shift'].probesPerLookup.toFixed(2), '1.80');
  assert.strictEqual(read['robin hood'].probesPerLookup.toFixed(2), '1.94');

  assert.strictEqual(churn['swiss table'].probesPerLookup.toFixed(2), '1.04');
  assert.strictEqual(churn.chaining.probesPerLookup.toFixed(2), '1.90');
  assert.strictEqual(churn['linear/tombstone'].probesPerLookup.toFixed(2), '2.13');
  assert.strictEqual(churn['robin hood'].probesPerLookup.toFixed(2), '3.01');
  assert.strictEqual(churn['linear/shift'].probesPerLookup.toFixed(2), '3.72');

  const tomb = churn['linear/tombstone'];
  const shift = churn['linear/shift'];
  assert.strictEqual(tomb.size, 2750);
  assert.strictEqual(shift.size, 2750, 'the same live set');
  assert.strictEqual(tomb.capacity, 8192);
  assert.strictEqual(shift.capacity, 4096);
  assert.strictEqual(tomb.loadFactor.toFixed(3), '0.336');
  assert.strictEqual(shift.loadFactor.toFixed(3), '0.671');
  assert.strictEqual(tomb.stats.tombstones, 342);
  assert.strictEqual(shift.stats.tombstones, 0);

  quotes(entry, ['swiss table    1.04', 'linear/backward-shift 3.72',
    'linear/tombstone   2.13  2,750    8,192   0.336      342',
    'linear/shift       3.72  2,750    4,096   0.671        0']);
});
