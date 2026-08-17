'use strict';

/**
 * Property tests for every priority queue in M05.
 *
 * The shape follows M04: drive a randomised operation sequence through the
 * shared interface with `pq-lab`, check the family's own invariants along the
 * way, and require the drain to come out sorted and complete. A heap that
 * passes cannot be subtly wrong - the reference map and the drain would have
 * disagreed.
 *
 * `pq-lab.replay` already does the reference bookkeeping, so a new family is
 * one line in FAMILIES and is immediately held to the same standard.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const PqLab = require('../../src/js/machines/pq-lab.js');
const EventSim = require('../../src/js/machines/event-sim.js');

const BinaryHeap = require('../../src/js/algorithms/binary-heap.js');
const LeftistHeap = require('../../src/js/algorithms/leftist-heap.js');
const BinomialHeap = require('../../src/js/algorithms/binomial-heap.js');
const PairingHeap = require('../../src/js/algorithms/pairing-heap.js');
const FibonacciHeap = require('../../src/js/algorithms/fibonacci-heap.js');
const TimerWheel = require('../../src/js/algorithms/timer-wheel.js');

const FAMILIES = [
  { name: 'binary', create: function () { return BinaryHeap.create({}); } },
  { name: '4-ary', create: function () { return BinaryHeap.create({ arity: 4 }); } },
  { name: 'leftist', create: function () { return LeftistHeap.create({}); } },
  { name: 'skew', create: function () { return LeftistHeap.create({ skew: true }); } },
  { name: 'binomial', create: function () { return BinomialHeap.create({}); } },
  { name: 'pairing', create: function () { return PairingHeap.create({}); } },
  { name: 'pairing-1pass', create: function () { return PairingHeap.create({ singlePass: true }); } },
  { name: 'fibonacci', create: function () { return FibonacciHeap.create({}); } }
];

/* Families that can address a live element. The other four have no handle, so
   `pq-lab` never emits a decrease-key for them. */
const ADDRESSABLE = [
  { name: 'indexed binary', create: function () { return BinaryHeap.create({ indexed: true }); } },
  { name: 'indexed 4-ary', create: function () { return BinaryHeap.create({ arity: 4, indexed: true }); } },
  { name: 'pairing', create: function () { return PairingHeap.create({}); } },
  { name: 'fibonacci', create: function () { return FibonacciHeap.create({}); } }
];

const MELDABLE = FAMILIES.filter(function (family) {
  return family.name !== 'binary' && family.name !== '4-ary';
});

/* -------------------------------------------------- the shared contract */

FAMILIES.forEach(function (family) {
  ['push-heavy', 'balanced', 'pop-heavy'].forEach(function (kind) {
    test(family.name + ': ' + kind + ' replay keeps order and the invariants', function () {
      const result = PqLab.replay({
        heap: family.create(),
        operations: PqLab.operations({ kind: kind, count: 8000, rng: Random.seeded(11) }),
        checkEvery: 250
      });

      assert.deepStrictEqual(result.errors, [], family.name + ' / ' + kind);
      assert.ok(result.ok);
      assert.ok(result.drained > 0, 'the workload must leave something to drain');
    });
  });
});

ADDRESSABLE.forEach(function (family) {
  test(family.name + ': a decrease-key workload keeps order', function () {
    const result = PqLab.replay({
      heap: family.create(),
      operations: PqLab.operations({ kind: 'decrease-key', count: 8000, rng: Random.seeded(13) }),
      checkEvery: 250
    });

    assert.deepStrictEqual(result.errors, [], family.name);
    assert.ok(result.stats.decreaseKeys > 0, 'the mix must actually decrease keys');
  });
});

MELDABLE.forEach(function (family) {
  test(family.name + ': melding 16 heaps loses nothing', function () {
    const result = PqLab.meldRun(family, { pieces: 16, each: 500, rng: Random.seeded(3) });

    assert.strictEqual(result.merged, 8000, family.name + ' merged ' + result.merged + ' of 8000');
    assert.ok(result.ok, 'the melded heap must drain in order');
  });
});

/* ---------------------------------------------------- the array heap */

test('binary heap: build is linear where repeated pushes are not', function () {
  const rng = Random.seeded(17);
  const keys = [];
  for (let i = 0; i < 100000; i += 1) keys.push(rng.int(1000000));

  const built = BinaryHeap.create({});
  built.build(keys.map(function (key, i) { return { key: key, id: 'n' + i }; }));
  const buildStats = built.stats();

  const pushed = BinaryHeap.create({});
  keys.forEach(function (key, i) { pushed.push(key, 'n' + i); });

  assert.ok(buildStats.comparisons / keys.length < 2,
    'build cost ' + (buildStats.comparisons / keys.length).toFixed(2) + ' comparisons per element');
  assert.ok(buildStats.comparisons < pushed.stats().comparisons, 'build must beat repeated pushes');
  assert.ok(built.checkInvariants().ok);
});

test('binary heap: buildHeapWork sums to about n', function () {
  const work = BinaryHeap.buildHeapWork(100000, 2);
  const summed = work.rows.reduce(function (total, row) { return total + row.nodes * row.height; }, 0);

  assert.strictEqual(work.total, summed, 'the reported total must be the sum of the rows');
  assert.ok(work.total < 1.1 * 100000, 'sum of heights is ' + work.total + ', which must stay near n');
  assert.strictEqual(work.rows[0].height, 0, 'height 0 is the leaf row');
  assert.ok(work.rows[0].nodes > work.rows[work.rows.length - 1].nodes, 'leaves outnumber the root');
});

test('binary heap: arity moves sift-up and sift-down in opposite directions', function () {
  const operations = PqLab.operations({ kind: 'balanced', count: 20000, rng: Random.seeded(6) });
  const measured = [2, 4, 8, 16].map(function (arity) {
    return {
      arity: arity,
      stats: PqLab.replay({
        heap: BinaryHeap.create({ arity: arity }),
        operations: operations
      }).stats
    };
  });

  for (let i = 1; i < measured.length; i += 1) {
    assert.ok(measured[i].stats.swaps < measured[i - 1].stats.swaps,
      'arity ' + measured[i].arity + ' must swap less than arity ' + measured[i - 1].arity);
  }
  assert.ok(measured[3].stats.comparisons > measured[1].stats.comparisons,
    'arity 16 must compare more than arity 4: the sift-down widens');
});

test('heapsort: the sort is correct, in place and unstable-safe', function () {
  const rng = Random.seeded(8);
  const input = [];
  for (let i = 0; i < 10000; i += 1) input.push(rng.int(1000000));

  const result = BinaryHeap.sort(input.slice());
  const expected = input.slice().sort(function (a, b) { return a - b; });

  assert.strictEqual(result.sorted.join(','), expected.join(','));
  assert.ok(result.stats.comparisons > 0 && result.stats.swaps > 0);
  assert.ok(result.stats.comparisons < 3 * input.length * Math.log2(input.length),
    'heapsort must stay inside a small multiple of n log n');
});

test('top-k: the gate does the work and the heap barely moves', function () {
  const rng = Random.seeded(2);
  const stream = [];
  for (let i = 0; i < 200000; i += 1) stream.push(rng.int(1000000));

  const result = BinaryHeap.topK(stream, 20);
  const expected = stream.slice().sort(function (a, b) { return a - b; }).slice(0, 20);

  assert.strictEqual(result.values.join(','), expected.join(','));
  assert.strictEqual(result.gateComparisons + result.stats.comparisons, result.totalComparisons,
    'the total must account for the comparisons made outside the heap');
  assert.ok(result.admitted < stream.length / 100,
    'only ' + result.admitted + ' of ' + stream.length + ' may reach the heap');
});

/* --------------------------------------------------- the mergeable heaps */

test('leftist: the right spine stays inside the null-path bound', function () {
  const heap = LeftistHeap.create({});
  const rng = Random.seeded(5);
  for (let i = 0; i < 100000; i += 1) heap.push(rng.int(1000000), 'n' + i);

  assert.ok(heap.rightSpine() <= heap.nplBound(),
    'spine ' + heap.rightSpine() + ' exceeds the bound ' + heap.nplBound());
  assert.ok(heap.checkInvariants().ok);
});

test('skew: it swaps unconditionally and keeps no bound', function () {
  const leftist = LeftistHeap.create({});
  const skew = LeftistHeap.create({ skew: true });
  const rng = Random.seeded(12);

  for (let i = 0; i < 100000; i += 1) {
    const key = rng.int(1000000);
    leftist.push(key, 'n' + i);
    skew.push(key, 'n' + i);
  }

  const skewStats = skew.stats();
  const leftistStats = leftist.stats();

  assert.strictEqual(skewStats.childSwaps, skewStats.meldSteps,
    'a skew heap swaps children at every meld step, with no rank to consult');
  assert.ok(leftistStats.childSwaps < leftistStats.meldSteps / 5,
    'a leftist heap swaps only when the null-path lengths demand it');
  assert.ok(skew.rightSpine() > leftist.nplBound(),
    'at this seed the skew spine (' + skew.rightSpine() + ') passes the leftist bound (' +
    leftist.nplBound() + '), which is exactly what dropping the rank costs');
  assert.ok(skew.checkInvariants().ok, 'and it is still a heap');
});

test('binomial: the forest is the binary expansion of the size', function () {
  const heap = BinomialHeap.create({});
  const rng = Random.seeded(9);

  [13, 100, 1000, 100000].forEach(function (target) {
    while (heap.size() < target) heap.push(rng.int(1000000), 'n' + heap.size());

    const orders = heap.orders();
    const bits = target.toString(2);
    assert.strictEqual(heap.binary(), bits, 'the forest at ' + target);
    assert.strictEqual(orders.length, bits.split('').filter(function (bit) { return bit === '1'; }).length,
      'one tree per set bit at ' + target);
    orders.forEach(function (tree) {
      assert.strictEqual(bits[bits.length - 1 - tree.order], '1',
        'order ' + tree.order + ' must match a set bit');
      assert.strictEqual(tree.size, Math.pow(2, tree.order), 'a Bk holds exactly 2^k nodes');
    });
  });
});

/* ------------------------------------------------------- the lazy heaps */

test('fibonacci: the maximum degree stays under the Fibonacci bound', function () {
  const heap = FibonacciHeap.create({});
  const rng = Random.seeded(4);

  for (let i = 0; i < 40000; i += 1) heap.push(rng.int(1000000), 'n' + i);
  for (let i = 0; i < 10000; i += 1) heap.pop();

  assert.ok(heap.maxDegree() <= heap.degreeBound(),
    'degree ' + heap.maxDegree() + ' exceeds the bound ' + heap.degreeBound());
  assert.ok(heap.roots() < heap.size(), 'consolidation must leave far fewer roots than nodes');
  assert.ok(heap.checkInvariants().ok);
});

test('fibonacci: no root carries a mark, however hard the cuts run', function () {
  const result = PqLab.replay({
    heap: FibonacciHeap.create({}),
    operations: PqLab.operations({ kind: 'decrease-key', count: 20000, rng: Random.seeded(7) }),
    checkEvery: 100
  });

  assert.deepStrictEqual(result.errors, []);
  assert.ok(result.stats.cuts > 0, 'the workload must cut');
  assert.ok(result.stats.cascadingCuts > 0, 'and cascade');
  assert.ok(result.stats.cascadingCuts < result.stats.cuts, 'a cascade is the rarer half of a cut');
});

test('pairing: the two-pass merge beats the one-pass control', function () {
  const operations = PqLab.operations({ kind: 'balanced', count: 30000, rng: Random.seeded(11) });

  const twoPass = PqLab.replay({ heap: PairingHeap.create({}), operations: operations });
  const onePass = PqLab.replay({ heap: PairingHeap.create({ singlePass: true }), operations: operations });

  assert.deepStrictEqual(twoPass.errors, []);
  assert.deepStrictEqual(onePass.errors, [], 'the control must still be a correct heap');
  assert.ok(twoPass.stats.comparisons < onePass.stats.comparisons,
    'two-pass ' + twoPass.stats.comparisons + ' against one-pass ' + onePass.stats.comparisons);
});

/* ------------------------------------------------------------- Dijkstra */

test('dijkstra: every queue produces the identical distance vector', function () {
  const graph = PqLab.gridGraph({ side: 60, rng: Random.seeded(5) });
  const builders = [
    { name: 'binary', create: function () { return BinaryHeap.create({ indexed: true }); } },
    { name: '4-ary', create: function () { return BinaryHeap.create({ arity: 4, indexed: true }); } },
    { name: 'pairing', create: function () { return PairingHeap.create({}); } },
    { name: 'fibonacci', create: function () { return FibonacciHeap.create({}); } }
  ];

  const runs = builders.map(function (builder) { return PqLab.dijkstra(graph, 0, builder, 'indexed'); });
  /* Lazy insertion pushes a node more than once, so it cannot use a handle
     map: an indexed heap rejects the duplicate. That is the trade, not a bug. */
  const lazy = PqLab.dijkstra(graph, 0, {
    name: 'binary-lazy',
    create: function () { return BinaryHeap.create({}); }
  }, 'lazy');

  runs.forEach(function (run) {
    assert.strictEqual(run.settled, graph.nodes, run.name + ' left nodes unsettled');
    assert.strictEqual(run.distance.join(','), runs[0].distance.join(','), run.name + ' disagrees');
    assert.strictEqual(run.pushes, graph.nodes, run.name + ' pushed more than once per node');
  });

  assert.strictEqual(lazy.distance.join(','), runs[0].distance.join(','), 'lazy must agree too');
  assert.ok(lazy.pushes > runs[0].pushes, 'lazy insertion pushes once per improvement');
  assert.ok(lazy.stale > 0, 'and pops entries it then has to discard');
  assert.ok(lazy.maxQueue > runs[0].maxQueue, 'so its queue peaks higher');
});

/* -------------------------------------------------------------- timers */

test('timer wheel: every timer fires on its own tick', function () {
  const wheel = TimerWheel.create({ slots: 256 });
  const rng = Random.seeded(3);
  const due = new Map();

  for (let i = 0; i < 50000; i += 1) {
    const delay = 1 + rng.int(2000);
    wheel.add(delay, 't' + i);
    due.set('t' + i, delay);
  }

  let fired = 0;
  for (let step = 1; step <= 2000; step += 1) {
    const now = step;
    wheel.tick().forEach(function (id) {
      assert.strictEqual(due.get(id), now, id + ' fired at ' + now + ' instead of ' + due.get(id));
      due.delete(id);
      fired += 1;
    });
  }

  assert.ok(fired > 0);
  assert.strictEqual(wheel.pending(), 50000 - fired, 'the rest must still be waiting');
  assert.ok(wheel.checkInvariants().ok);
});

test('timer wheel: a delay of exactly one revolution waits a revolution', function () {
  const wheel = TimerWheel.create({ slots: 64 });
  wheel.add(64, 'exact');
  wheel.add(128, 'double');

  for (let step = 1; step <= 63; step += 1) {
    assert.strictEqual(wheel.tick().length, 0, 'nothing may fire at step ' + step);
  }
  assert.deepStrictEqual(wheel.tick(), ['exact'], 'the exact-multiple timer fires at 64');

  for (let step = 65; step <= 127; step += 1) {
    assert.strictEqual(wheel.tick().length, 0, 'nothing may fire at step ' + step);
  }
  assert.deepStrictEqual(wheel.tick(), ['double'], 'the two-revolution timer fires at 128');
});

test('timer wheel: a cancelled timer never fires, and a layered wheel cascades', function () {
  const flat = TimerWheel.create({ slots: 4096 });
  const layered = TimerWheel.create({ slots: 64, levels: 2 });
  const rng = Random.seeded(3);
  const cancelled = new Set();

  for (let i = 0; i < 20000; i += 1) {
    const delay = 1 + rng.int(3000);
    flat.add(delay, 't' + i);
    layered.add(delay, 't' + i);
  }
  for (let i = 0; i < 20000; i += 1) {
    if (rng.next() < 0.5) { flat.cancel('t' + i); layered.cancel('t' + i); cancelled.add('t' + i); }
  }

  let flatFired = 0;
  let layeredFired = 0;
  for (let step = 0; step < 3100; step += 1) {
    flat.tick().forEach(function (id) {
      assert.ok(!cancelled.has(id), id + ' was cancelled and fired anyway');
      flatFired += 1;
    });
    layered.tick().forEach(function (id) {
      assert.ok(!cancelled.has(id), id + ' was cancelled and fired anyway');
      layeredFired += 1;
    });
  }

  assert.strictEqual(flatFired, layeredFired, 'the two geometries must fire the same timers');
  assert.strictEqual(flat.pending(), 0);
  assert.ok(layered.stats().cascadedEntries > 0, 'a two-level wheel promotes entries downward');
  assert.strictEqual(flat.stats().cascadedEntries, 0, 'a single-level wheel never cascades');
  assert.ok(layered.stats().entryTouches < flat.stats().entryTouches,
    'the layered wheel touches fewer entries: ' + layered.stats().entryTouches +
    ' against ' + flat.stats().entryTouches);
});

test('timer wheel: the heap-backed queue agrees and pays in comparisons', function () {
  const wheel = TimerWheel.create({ slots: 4096 });
  const backed = TimerWheel.heapBacked(function () { return BinaryHeap.create({}); });
  const rng = Random.seeded(3);

  for (let i = 0; i < 20000; i += 1) {
    const delay = 1 + rng.int(3000);
    wheel.add(delay, 't' + i);
    backed.add(delay, 't' + i);
  }

  let same = 0;
  for (let step = 0; step < 3100; step += 1) {
    const fromWheel = wheel.tick().slice().sort();
    const fromHeap = backed.tick().slice().sort();
    assert.strictEqual(fromWheel.join(','), fromHeap.join(','), 'the two queues disagree at step ' + step);
    same += fromWheel.length;
  }

  assert.strictEqual(same, 20000, 'both must fire every timer');
  assert.strictEqual(wheel.stats().comparisons, undefined, 'a wheel does not compare deadlines at all');
  assert.ok(backed.stats().comparisons > 0, 'a heap does nothing but compare deadlines');
});

/* ------------------------------------------------- the event simulator */

test('event kernel: events come out in time order, ties by sequence', function () {
  const sim = EventSim.create({ queue: BinaryHeap.create({ indexed: true }) });
  const rng = Random.seeded(5);
  const seen = [];

  for (let i = 0; i < 5000; i += 1) sim.schedule(rng.int(100), 'e' + i, i);
  sim.run({ onEvent: function (event) { seen.push({ at: event.at, payload: event.payload }); } });

  assert.strictEqual(seen.length, 5000, 'every scheduled event must run');
  for (let i = 1; i < seen.length; i += 1) {
    assert.ok(seen[i].at >= seen[i - 1].at, 'event ' + i + ' ran before an earlier one');
    if (seen[i].at === seen[i - 1].at) {
      assert.ok(seen[i].payload > seen[i - 1].payload,
        'a tie at t = ' + seen[i].at + ' must break by insertion order, not by heap internals');
    }
  }
  assert.strictEqual(sim.pending(), 0);
});

test('M/M/1: measured queue length and wait match the closed form', function () {
  [0.5, 0.8, 0.9].forEach(function (rho) {
    const run = EventSim.mm1({
      rng: Random.seeded(3),
      lambda: rho,
      mu: 1,
      horizon: 200000,
      queue: BinaryHeap.create({ indexed: true })
    });

    const errorL = Math.abs(run.meanInSystem - run.predictedInSystem) / run.predictedInSystem;
    const errorW = Math.abs(run.meanTimeInSystem - run.predictedTimeInSystem) / run.predictedTimeInSystem;

    assert.strictEqual(run.predictedInSystem, rho / (1 - rho), 'L = rho / (1 - rho)');
    assert.strictEqual(run.predictedTimeInSystem, 1 / (1 - rho), 'W = 1 / (mu - lambda)');
    assert.ok(errorL < 0.05,
      'rho ' + rho + ': L measured ' + run.meanInSystem.toFixed(3) +
      ' against ' + run.predictedInSystem.toFixed(3));
    assert.ok(errorW < 0.05,
      'rho ' + rho + ': W measured ' + run.meanTimeInSystem.toFixed(3) +
      ' against ' + run.predictedTimeInSystem.toFixed(3));

    /* Little's law on the measured numbers, not on the formula: L = lambda*W
       with the arrival rate the run actually saw. */
    assert.ok(Math.abs(run.meanInSystem / (run.arrivalRate * run.meanTimeInSystem) - 1) < 0.01,
      'rho ' + rho + ': L / (lambda W) = ' +
      (run.meanInSystem / (run.arrivalRate * run.meanTimeInSystem)).toFixed(4));
  });
});
