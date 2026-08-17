'use strict';

/**
 * Every figure the M05.1-M05.4 worked examples quote, recomputed here.
 *
 * The harnesses below mirror what each section's demo runs - same seeds, same
 * sizes, same generator call order - so a learner who opens the section sees
 * the numbers the prose claims. If a module changes and a figure moves, this
 * file fails and the prose gets corrected rather than quietly drifting.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const PqLab = require('../../src/js/machines/pq-lab.js');
const BinaryHeap = require('../../src/js/algorithms/binary-heap.js');
const LeftistHeap = require('../../src/js/algorithms/leftist-heap.js');
const BinomialHeap = require('../../src/js/algorithms/binomial-heap.js');
const PairingHeap = require('../../src/js/algorithms/pairing-heap.js');
const FibonacciHeap = require('../../src/js/algorithms/fibonacci-heap.js');

function randomKeys(seed, count, span) {
  const rng = Random.seeded(seed);
  const keys = [];
  for (let i = 0; i < count; i += 1) keys.push(rng.int(span));
  return keys;
}

/** The binary-heaps demo: bh-count 100 000, bh-seed 4, one order at a time. */
function buildAndPush(order) {
  let keys = randomKeys(4, 100000, 1000000);
  if (order === 'ascending') keys = keys.slice().sort(function (a, b) { return a - b; });
  if (order === 'descending') keys = keys.slice().sort(function (a, b) { return b - a; });

  const built = BinaryHeap.create({});
  built.build(keys.map(function (key, i) { return { key: key, id: 'n' + i }; }));

  const pushed = BinaryHeap.create({});
  keys.forEach(function (key, i) { pushed.push(key, 'n' + i); });

  return { build: built.stats(), push: pushed.stats() };
}

/* ------------------------------------------------------- binary heaps */

test('binary-heaps: the sum of heights tabulates to 100 058 for n = 100 000', function () {
  const work = BinaryHeap.buildHeapWork(100000, 2);

  assert.strictEqual(work.total, 100058);
  assert.strictEqual(work.rows[0].nodes, 50000, 'height 0 holds ceil(n/2) leaves');
  assert.strictEqual(work.rows[1].nodes, 25000, 'height 1 holds ceil(n/4)');
  assert.strictEqual(work.rows[2].nodes, 12500, 'height 2 holds 12 500');
  assert.strictEqual(work.rows[3].nodes, 6250, 'height 3 holds 6 250');
  assert.strictEqual(work.rows[15].nodes, 2, 'height 15 holds 2');
  assert.strictEqual(work.rows[16].nodes, 1, 'height 16 holds the root alone');

  assert.strictEqual(work.rows[1].nodes * 1, 25000, '1 x 25 000 = 25 000');
  assert.strictEqual(work.rows[2].nodes * 2, 25000, '2 x 12 500 = 25 000');
  assert.strictEqual(work.rows[3].nodes * 3, 18750, '3 x 6 250 = 18 750');
});

test('binary-heaps: a real build measures 187 880 comparisons and 74 217 swaps', function () {
  const measured = buildAndPush('random');

  assert.strictEqual(measured.build.comparisons, 187880);
  assert.strictEqual(measured.build.swaps, 74217);
  assert.strictEqual((measured.build.comparisons / 100000).toFixed(2), '1.88');
  assert.strictEqual((measured.build.swaps / 100000).toFixed(2), '0.74');
});

test('binary-heaps: n log2 n predicts 1 660 964, which is 8.8x the truth', function () {
  const naive = Math.round(100000 * Math.log2(100000));

  assert.strictEqual(naive, 1660964);
  assert.strictEqual(Math.log2(100000).toFixed(2), '16.61');
  assert.strictEqual((naive / 187880).toFixed(1), '8.8');
});

test('binary-heaps: build against push on ascending, random and descending input', function () {
  const ascending = buildAndPush('ascending');
  assert.strictEqual(ascending.build.comparisons, 99999);
  assert.strictEqual(ascending.push.comparisons, 99999);
  assert.strictEqual(ascending.build.swaps, 0);
  assert.strictEqual(ascending.push.swaps, 0);

  const random = buildAndPush('random');
  assert.strictEqual(random.build.comparisons, 187880);
  assert.strictEqual(random.push.comparisons, 227758);
  assert.strictEqual((random.push.comparisons / 100000).toFixed(2), '2.28');
  assert.strictEqual(Math.round(100 * (random.push.comparisons / random.build.comparisons - 1)), 21);

  const descending = buildAndPush('descending');
  assert.strictEqual(descending.build.comparisons, 199978);
  assert.strictEqual(descending.push.comparisons, 1468787);
  assert.strictEqual((descending.build.comparisons / 100000).toFixed(2), '2.00');
  assert.strictEqual((descending.push.comparisons / 100000).toFixed(2), '14.69');
  assert.strictEqual((descending.push.comparisons / descending.build.comparisons).toFixed(1), '7.3');
});

/* ---------------------------------------------------------- d-ary heaps */

test('d-ary-heaps: the balanced sweep bottoms out at d = 3', function () {
  const operations = PqLab.operations({ kind: 'balanced', count: 50000, rng: Random.seeded(6) });
  const measured = {};

  [2, 3, 4, 8, 16].forEach(function (arity) {
    measured[arity] = PqLab.replay({
      heap: BinaryHeap.create({ arity: arity }),
      operations: operations
    }).stats;
  });

  assert.strictEqual(measured[2].comparisons, 366125);
  assert.strictEqual(measured[3].comparisons, 338230);
  assert.strictEqual(measured[4].comparisons, 355873);
  assert.strictEqual(measured[8].comparisons, 465605);
  assert.strictEqual(measured[16].comparisons, 602679);

  assert.strictEqual(measured[2].swaps, 225089);
  assert.strictEqual(measured[4].swaps, 123883);
  assert.strictEqual(measured[8].swaps, 87789);
  assert.strictEqual(measured[16].swaps, 60050);

  assert.strictEqual(Math.round(100 * (measured[2].comparisons / measured[3].comparisons - 1)), 8,
    'd = 2 costs 8% more than the minimum');
  assert.strictEqual(Math.round(100 * (measured[8].comparisons / measured[3].comparisons - 1)), 38,
    'd = 8 costs 38% more');
  assert.strictEqual(Math.round(100 * (measured[4].comparisons / measured[3].comparisons - 1)), 5,
    'the d = 4 penalty against the optimum is 5%');
});

test('d-ary-heaps: a decrease-key mix moves the minimum to d = 4', function () {
  const operations = PqLab.operations({ kind: 'decrease-key', count: 50000, rng: Random.seeded(6) });
  const measured = {};

  [2, 4, 8].forEach(function (arity) {
    measured[arity] = PqLab.replay({
      heap: BinaryHeap.create({ arity: arity, indexed: true }),
      operations: operations
    }).stats;
  });

  assert.strictEqual(measured[2].comparisons, 385548);
  assert.strictEqual(measured[4].comparisons, 366740);
  assert.strictEqual(measured[8].comparisons, 453924);
  assert.ok(measured[4].comparisons < measured[2].comparisons,
    'the sift-up-heavy mix rewards the shallower tree');
});

test('d-ary-heaps: the level counts a million elements imply', function () {
  const levels = function (arity) { return Math.ceil(Math.log(1000000) / Math.log(arity)); };

  assert.strictEqual(levels(2), 20);
  assert.strictEqual(levels(4), 10);
  assert.strictEqual(levels(16), 5);
  assert.strictEqual(64 / 4, 16, 'a 64-byte line holds 16 four-byte keys');
});

/* -------------------------------------------------------------- heapsort */

test('heapsort: 10 000 elements at seed 8 cost 235 305 comparisons and 114 155 swaps', function () {
  const result = BinaryHeap.sort(randomKeys(8, 10000, 1000000));
  const nLogN = Math.round(10000 * Math.log2(10000));

  assert.strictEqual(result.stats.comparisons, 235305);
  assert.strictEqual(result.stats.swaps, 114155);
  assert.strictEqual(nLogN, 132877);
  assert.strictEqual(Math.log2(10000).toFixed(2), '13.29');
  assert.strictEqual((result.stats.comparisons / nLogN).toFixed(2), '1.77');
  assert.strictEqual((result.stats.swaps / 10000).toFixed(1), '11.4');
});

test('heapsort: top-20 of a million costs 1 001 977 comparisons and admits 246', function () {
  /* The demo streams from seed hs-seed + 1 over a 1e9 span, which is what
     makes 246 admissions rather than a few hundred more. */
  const streamRng = Random.seeded(9);
  const stream = Array.from({ length: 1000000 }, function () { return streamRng.int(1e9); });
  const top = BinaryHeap.topK(stream, 20);
  const sortEstimate = Math.round(1000000 * Math.log2(1000000));

  assert.strictEqual(top.gateComparisons, 999980, 'one comparison per element after the heap fills');
  assert.strictEqual(top.stats.comparisons, 1997);
  assert.strictEqual(top.totalComparisons, 1001977);
  assert.strictEqual(top.admitted, 246);
  assert.strictEqual(sortEstimate, 19931569);
  assert.strictEqual(Math.round(sortEstimate / top.totalComparisons), 20, '20x fewer comparisons');
  assert.strictEqual(1000000 / 20, 50000, '50 000x less memory');
});

/* ------------------------------------------------------- mergeable heaps */

test('mergeable-heaps: the forest is the binary expansion of the size', function () {
  assert.strictEqual((13).toString(2), '1101');
  assert.strictEqual(8 + 4 + 1, 13, 'B3 + B2 + B0');
  assert.strictEqual((100000).toString(2), '11000011010100000');
  assert.strictEqual((100000).toString(2).split('').filter(function (b) { return b === '1'; }).length, 6);
  assert.strictEqual((100000).toString(2).length, 17, 'floor(log2 n) + 1 orders can be present');
  assert.strictEqual((3).toString(2), '11');
  assert.strictEqual(3 + 1, 4, 'a carry out of bit 0 and bit 1 leaves a single B2');

  const heap = BinomialHeap.create({});
  const rng = Random.seeded(3);
  for (let i = 0; i < 100000; i += 1) heap.push(rng.int(1000000), 'b' + i);
  assert.strictEqual(heap.binary(), '11000011010100000');
  assert.strictEqual(heap.trees(), 6);
});

test('mergeable-heaps: folding 16 heaps of 1 000 at seed 3', function () {
  const measured = {};

  [
    { name: 'leftist', create: function () { return LeftistHeap.create({}); } },
    { name: 'binomial', create: function () { return BinomialHeap.create({}); } },
    { name: 'pairing', create: function () { return PairingHeap.create({}); } },
    { name: 'fibonacci', create: function () { return FibonacciHeap.create({}); } },
    { name: 'binary', create: function () { return BinaryHeap.create({}); } }
  ].forEach(function (builder) {
    measured[builder.name] = PqLab.meldRun(builder, {
      pieces: 16, each: 1000, rng: Random.seeded(3)
    }).stats.comparisons;
  });

  assert.strictEqual(measured.leftist, 222679);
  assert.strictEqual(measured.binomial, 260411);
  assert.strictEqual(measured.pairing, 256286);
  assert.strictEqual(measured.fibonacci, 268497);
  assert.strictEqual(measured.binary, 513212);
  assert.strictEqual((measured.binary / measured.leftist).toFixed(1), '2.3');
  assert.strictEqual(Math.round(100 * (measured.fibonacci / measured.leftist - 1)), 21,
    'a 21% spread from the cheapest mergeable family to the dearest');
});

test('mergeable-heaps: the leftist and skew spines after 100 000 pushes', function () {
  /* The demo pushes both heaps from mh-seed + 1, so the key sequence is
     identical and only the rebalancing rule differs. */
  const leftist = LeftistHeap.create({});
  const skew = LeftistHeap.create({ skew: true });
  const leftistRng = Random.seeded(4);
  const skewRng = Random.seeded(4);

  for (let i = 0; i < 100000; i += 1) leftist.push(leftistRng.int(1e6), 'l' + i);
  for (let i = 0; i < 100000; i += 1) skew.push(skewRng.int(1e6), 's' + i);

  assert.strictEqual(leftist.stats().rightSpine, 11);
  assert.strictEqual(leftist.nplBound(), 16);
  assert.strictEqual(leftist.stats().childSwaps, 74344);

  assert.strictEqual(skew.stats().rightSpine, 13);
  assert.strictEqual(skew.stats().childSwaps, 1071593);
  assert.strictEqual(Math.round(skew.stats().childSwaps / leftist.stats().childSwaps), 14,
    'fourteen times the pointer writing');
  assert.ok(skew.stats().rightSpine > leftist.stats().rightSpine, 'and a longer spine');
});
