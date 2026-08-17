'use strict';

/**
 * Every figure the M05.5-M05.8 worked examples quote, recomputed here.
 *
 * The Dijkstra grid, the pairing replay, the timer run and the M/M/1 run all
 * mirror their section's demo exactly - same seeds, same sizes, same derived
 * seeds (the timers demo cancels from seed + 500, the simulator runs from
 * seed + 7). A figure that moves fails here rather than drifting in the prose.
 */

const test = require('node:test');
const assert = require('node:assert');

const Random = require('../../src/js/utils/random.js');
const PqLab = require('../../src/js/machines/pq-lab.js');
const EventSim = require('../../src/js/machines/event-sim.js');
const BinaryHeap = require('../../src/js/algorithms/binary-heap.js');
const PairingHeap = require('../../src/js/algorithms/pairing-heap.js');
const FibonacciHeap = require('../../src/js/algorithms/fibonacci-heap.js');
const TimerWheel = require('../../src/js/algorithms/timer-wheel.js');

/** The 150 x 150 grid at seed 5, shared by M05.5, M05.6 and M05.7. */
function dijkstraRuns() {
  const graph = PqLab.gridGraph({ side: 150, rng: Random.seeded(5) });
  const runs = {};

  [
    { name: 'binary', create: function () { return BinaryHeap.create({ indexed: true }); } },
    { name: 'fourAry', create: function () { return BinaryHeap.create({ arity: 4, indexed: true }); } },
    { name: 'pairing', create: function () { return PairingHeap.create({}); } },
    { name: 'fibonacci', create: function () { return FibonacciHeap.create({}); } }
  ].forEach(function (builder) {
    runs[builder.name] = PqLab.dijkstra(graph, 0, builder, 'indexed');
  });

  runs.lazy = PqLab.dijkstra(graph, 0, {
    create: function () { return BinaryHeap.create({}); }
  }, 'lazy');
  runs.graph = graph;
  return runs;
}

/** The timers demo: 100 000 timers, delays and run length both 5 000 ticks,
 *  50% cancelled by index drawn with replacement from seed + 500. */
function timerRun(make) {
  const timer = make();
  const rng = Random.seeded(3);
  const cancelRng = Random.seeded(503);

  timer.resetStats();
  for (let i = 0; i < 100000; i += 1) timer.add(1 + rng.int(5000), 'x' + i);
  for (let i = 0; i < 50000; i += 1) timer.cancel('x' + cancelRng.int(100000));

  let fired = 0;
  for (let tick = 0; tick < 5000; tick += 1) fired += timer.tick().length;
  return { fired: fired, stats: timer.stats() };
}

/* ---------------------------------------------------- Fibonacci heaps */

test('fibonacci-heaps: the comparison ranking on the 22 500-node Dijkstra', function () {
  const runs = dijkstraRuns();

  assert.strictEqual(runs.graph.nodes, 22500);
  assert.strictEqual(runs.graph.edges, 89400);

  assert.strictEqual(runs.fibonacci.stats.comparisons, 258493);
  assert.strictEqual(runs.pairing.stats.comparisons, 278257);
  assert.strictEqual(runs.binary.stats.comparisons, 336961);
  assert.strictEqual(runs.fourAry.stats.comparisons, 363106);

  assert.ok(runs.fibonacci.stats.comparisons < runs.pairing.stats.comparisons);
  assert.ok(runs.pairing.stats.comparisons < runs.binary.stats.comparisons);
  assert.ok(runs.binary.stats.comparisons < runs.fourAry.stats.comparisons);
  assert.strictEqual(Math.round(100 * (runs.pairing.stats.comparisons / runs.fibonacci.stats.comparisons - 1)), 8,
    'the pairing heap does 8% more comparisons');
});

test('fibonacci-heaps: the decrease-key traffic and the cut bill', function () {
  const runs = dijkstraRuns();

  assert.strictEqual(runs.binary.stats.decreaseKeys, 7065);
  assert.strictEqual(runs.binary.settled, 22500);
  assert.strictEqual(Math.round(100 * 7065 / 22500), 31, 'about a third of the relaxations improved an entry');

  assert.strictEqual(runs.fibonacci.stats.cuts, 2702);
  assert.strictEqual(runs.fibonacci.stats.cascadingCuts, 31);
});

test('fibonacci-heaps: the degree bound on the demo probe', function () {
  /* The section probes with 20 000 pushes and 4 000 pops at fh-seed. */
  const probe = FibonacciHeap.create({});
  const rng = Random.seeded(5);
  for (let i = 0; i < 20000; i += 1) probe.push(rng.int(1e6), 'p' + i);
  for (let i = 0; i < 4000; i += 1) probe.pop();

  assert.strictEqual(probe.size(), 16000);
  assert.strictEqual(probe.maxDegree(), 13);
  assert.strictEqual(probe.degreeBound(), 20);
  assert.strictEqual(probe.roots(), 6);
  assert.ok(probe.maxDegree() < probe.degreeBound(), 'the cascade keeps the degree under the bound');
});

test('fibonacci-heaps: the Fredman-Tarjan bound on this graph', function () {
  const runs = dijkstraRuns();
  const bound = runs.graph.edges + runs.graph.nodes * Math.log2(runs.graph.nodes);

  assert.strictEqual(Math.log2(22500).toFixed(2), '14.46');
  assert.strictEqual(Math.round(bound / 100) * 100, 414700, 'E + V log V is about 414 700 here');
  assert.strictEqual(runs.fibonacci.pushes, 22500, 'Dijkstra pushes once per node');
  assert.strictEqual(runs.fibonacci.stats.melds, 0, 'and melds not at all');
  assert.strictEqual(runs.fibonacci.stats.decreaseKeys, 7053);
});

/* ------------------------------------------------------- pairing heaps */

test('pairing-heaps: the pairing pass saves 17.3% over 30 000 operations', function () {
  const operations = PqLab.operations({ kind: 'balanced', count: 30000, rng: Random.seeded(11) });
  const twoPass = PqLab.replay({ heap: PairingHeap.create({}), operations: operations });
  const onePass = PqLab.replay({ heap: PairingHeap.create({ singlePass: true }), operations: operations });

  assert.strictEqual(twoPass.stats.comparisons, 46189);
  assert.strictEqual(onePass.stats.comparisons, 55856);
  assert.strictEqual(onePass.stats.comparisons - twoPass.stats.comparisons, 9667);
  assert.strictEqual((100 * (1 - twoPass.stats.comparisons / onePass.stats.comparisons)).toFixed(1), '17.3',
    'the demo reports the saving as a share of the one-pass count, and so does the prose');
  assert.strictEqual((twoPass.stats.comparisons / 30000).toFixed(2), '1.54');
});

test('pairing-heaps: eight orphaned children cost seven links either way', function () {
  /* Pass one pairs 8 children into 4, pass two folds those 4 into 1: 4 + 3.
     A single left-to-right fold does 7 links as well - and leaves a path. */
  const children = 8;
  const pairs = Math.ceil(children / 2);

  assert.strictEqual(pairs, 4, 'four pairs');
  assert.strictEqual(pairs - 1, 3, 'three folds');
  assert.strictEqual(pairs + (pairs - 1), 7, 'seven links in the two-pass merge');
  assert.strictEqual(children - 1, 7, 'and seven in the one-pass fold');
});

test('pairing-heaps: the decrease-key mix the Fibonacci heap should have won', function () {
  const operations = PqLab.operations({ kind: 'decrease-key', count: 20000, rng: Random.seeded(7) });
  const pairing = PqLab.replay({ heap: PairingHeap.create({}), operations: operations });
  const fibonacci = PqLab.replay({ heap: FibonacciHeap.create({}), operations: operations });

  assert.strictEqual(pairing.stats.comparisons, 93946);
  assert.strictEqual(pairing.stats.cuts, 11923);
  assert.strictEqual(fibonacci.stats.comparisons, 106945);
  assert.strictEqual(fibonacci.stats.cuts, 7029);
  assert.strictEqual(fibonacci.stats.cascadingCuts, 1569);

  assert.strictEqual(Math.round(100 * (1 - pairing.stats.comparisons / fibonacci.stats.comparisons)), 12,
    'the pairing heap wins by 12%');
  assert.ok(pairing.stats.cuts > fibonacci.stats.cuts, 'it cuts more often and does less per cut');
});

/* --------------------------------------------- indexed priority queues */

test('indexed-priority-queues: decrease-key against duplicate insertion', function () {
  const runs = dijkstraRuns();

  assert.strictEqual(runs.binary.pushes, 22500, 'exactly one entry per node');
  assert.strictEqual(runs.lazy.pushes, 29573, 'one entry per improvement');
  assert.strictEqual(Math.round(100 * (runs.lazy.pushes / runs.binary.pushes - 1)), 31, '31% more entries');

  assert.strictEqual(runs.lazy.stale, 7073);
  assert.strictEqual(Math.round(100 * runs.lazy.stale / runs.lazy.pushes), 24, '24% of the queue traffic');

  assert.strictEqual(runs.binary.maxQueue, 291);
  assert.strictEqual(runs.lazy.maxQueue, 398);
  assert.strictEqual(Math.round(100 * (runs.lazy.maxQueue / runs.binary.maxQueue - 1)), 37, '37% larger');

  assert.strictEqual(runs.binary.stats.comparisons, 336961);
  assert.strictEqual(runs.lazy.stats.comparisons, 444333);
  assert.strictEqual(Math.round(100 * (runs.lazy.stats.comparisons / runs.binary.stats.comparisons - 1)), 32);
});

test('indexed-priority-queues: the density the two bounds turn on', function () {
  const runs = dijkstraRuns();

  assert.strictEqual((runs.graph.edges / runs.graph.nodes).toFixed(2), '3.97');
  assert.strictEqual(runs.lazy.distance.join(','), runs.binary.distance.join(','),
    'the two strategies must agree on every distance');

  const complete = 22500 * 22499 / 2;
  assert.strictEqual((complete / 1e8).toFixed(1), '2.5', 'a complete graph on 22 500 nodes holds ~2.5e8 edges');
  assert.ok(complete / runs.graph.edges > 1000, 'four orders of magnitude on the same node count');
});

/* ------------------------------------------------------ timers and events */

test('timers-and-events: the wheel spends no comparisons and the heap spends three million', function () {
  const flat = timerRun(function () { return TimerWheel.create({ slots: 4096, levels: 1 }); });
  const layered = timerRun(function () { return TimerWheel.create({ slots: 64, levels: 2 }); });
  const heap = timerRun(function () {
    return TimerWheel.heapBacked(function () { return BinaryHeap.create({}); });
  });

  assert.strictEqual(heap.stats.comparisons, 3059516);
  assert.strictEqual(flat.stats.comparisons, undefined, 'a wheel has no comparison counter to report');
  assert.strictEqual(layered.stats.comparisons, undefined);

  assert.strictEqual((heap.stats.entryTouches / 5000).toFixed(2), '20.00');
  assert.strictEqual((flat.stats.entryTouches / 5000).toFixed(2), '22.19');
  assert.strictEqual((layered.stats.entryTouches / 5000).toFixed(2), '12.22');
  assert.strictEqual(layered.stats.cascadedEntries, 108932);
  assert.strictEqual(flat.stats.cascadedEntries, 0);

  assert.strictEqual(Math.round(100 * (1 - layered.stats.entryTouches / flat.stats.entryTouches)), 45,
    'the second level cuts the per-tick walk by 45%');

  assert.strictEqual(flat.fired, 60619);
  assert.strictEqual(layered.fired, 60619);
  assert.strictEqual(heap.fired, 60619);
});

test('timers-and-events: the M/M/1 run reproduces the closed forms to within 1%', function () {
  /* The demo drives the simulator from te-seed + 7 with a plain binary heap. */
  const measured = [0.5, 0.8, 0.9].map(function (rho) {
    const run = EventSim.mm1({
      rng: Random.seeded(10), lambda: rho, mu: 1, horizon: 200000, queue: BinaryHeap.create({})
    });
    return {
      rho: rho,
      L: run.meanInSystem,
      W: run.meanTimeInSystem,
      predictedL: run.predictedInSystem,
      predictedW: run.predictedTimeInSystem,
      little: run.meanInSystem / (run.arrivalRate * run.meanTimeInSystem)
    };
  });

  assert.strictEqual(measured[0].L.toFixed(3), '1.002');
  assert.strictEqual(measured[1].L.toFixed(3), '3.968');
  assert.strictEqual(measured[2].L.toFixed(3), '9.025');

  assert.strictEqual(measured[0].W.toFixed(3), '2.008');
  assert.strictEqual(measured[1].W.toFixed(3), '4.958');
  assert.strictEqual(measured[2].W.toFixed(3), '10.028');

  measured.forEach(function (row) {
    assert.strictEqual(row.predictedL, row.rho / (1 - row.rho), 'L = rho / (1 - rho)');
    assert.strictEqual(row.predictedW, 1 / (1 - row.rho), 'W = 1 / (mu - lambda)');
    assert.ok(Math.abs(row.L - row.predictedL) / row.predictedL < 0.01,
      'rho ' + row.rho + ' is off by more than 1% on L');
    assert.ok(Math.abs(row.W - row.predictedW) / row.predictedW < 0.01,
      'rho ' + row.rho + ' is off by more than 1% on W');
    assert.strictEqual(row.little.toFixed(4), '1.0000', "Little's law, on the measured numbers");
  });
});
