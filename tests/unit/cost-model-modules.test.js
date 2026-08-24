'use strict';

/**
 * Property tests for the M21.4-M21.9 modules: bin packing, the external-memory
 * simulator, the cache-oblivious layouts and the parallel primitives.
 *
 * The figures the prose quotes live in worked-examples-external.test.js and
 * worked-examples-models.test.js; what is pinned here is what must hold at
 * every setting - conservation, bounds, and the reference answers a ratio is
 * measured against.
 */

const test = require('node:test');
const assert = require('node:assert');

const Packing = require('../../src/js/algorithms/bin-packing.js');
const External = require('../../src/js/algorithms/external-algorithms.js');
const Oblivious = require('../../src/js/algorithms/cache-oblivious.js');
const Parallel = require('../../src/js/algorithms/parallel-primitives.js');

function total(values) {
  return values.reduce(function (a, b) { return a + b; }, 0);
}

/* ------------------------------------------------------- 21.4 bin packing */

test('every policy places every item and overfills no bin', function () {
  [1, 5, 9].forEach(function (seed) {
    const items = Packing.randomItems({ count: 150, seed: seed });

    Packing.POLICIES.forEach(function (policy) {
      const packed = Packing.pack(items, 1, policy);

      assert.strictEqual(packed.placement.length, items.length, policy + ' lost items');
      assert.ok(Math.abs(total(packed.loads) - total(items)) < 1e-9,
        policy + ' changed the total size');
      packed.loads.forEach(function (load) {
        assert.ok(load <= 1 + 1e-9, policy + ' overfilled a bin: ' + load);
      });
      assert.strictEqual(packed.bins, packed.loads.length, policy + ' miscounted its bins');
    });
  });
});

test('no packing beats the lower bound, and the lower bound is the size', function () {
  [2, 7].forEach(function (seed) {
    const items = Packing.randomItems({ count: 120, seed: seed });
    const bound = Packing.lowerBound(items, 1);

    assert.strictEqual(bound, Math.ceil(total(items) - 1e-9), 'the LP bound is total size over capacity');
    Packing.POLICIES.forEach(function (policy) {
      assert.ok(Packing.pack(items, 1, policy).bins >= bound,
        policy + ' claimed fewer bins than the lower bound');
    });
  });
});

test('first-fit-decreasing respects (11/9)·OPT + 6/9 against exact optima', function () {
  for (let seed = 1; seed <= 25; seed += 1) {
    const items = Packing.randomItems({ count: 11, seed: seed * 13 });
    const exact = Packing.exactBins(items, 1);
    const optimum = exact.bins;
    const ffd = Packing.pack(items, 1, 'first-fit-decreasing').bins;
    const nextFit = Packing.pack(items, 1, 'next-fit').bins;

    assert.strictEqual(exact.exhausted, false, 'eleven items must be solved, not abandoned');
    assert.ok(ffd <= 11 / 9 * optimum + 6 / 9 + 1e-9,
      'seed ' + seed + ': FFD used ' + ffd + ' against an optimum of ' + optimum);
    assert.ok(nextFit <= 2 * optimum, 'seed ' + seed + ': next-fit must stay inside 2·OPT');
    assert.ok(ffd >= optimum, 'a heuristic cannot beat the optimum');
  }
});

test('the first-fit trap has an optimum of one bin per group and sorting attains it', function () {
  [6, 12, 24].forEach(function (groups) {
    const trap = Packing.firstFitTrap(groups);
    const firstFit = Packing.pack(trap.items, trap.capacity, 'first-fit').bins;
    const sorted = Packing.pack(trap.items, trap.capacity, 'first-fit-decreasing').bins;

    assert.strictEqual(trap.optimum, groups, 'one seventh, one third and one half fill a bin');
    assert.strictEqual(Packing.lowerBound(trap.items, trap.capacity) <= groups, true,
      'the claimed optimum must be at least the LP bound');
    assert.strictEqual(sorted, groups, 'sorted, the trap packs perfectly');
    assert.ok(firstFit / trap.optimum > 1.6,
      'at ' + groups + ' groups first-fit must be driven past 1.6');
    assert.ok(firstFit / trap.optimum <= 1.7 + 1e-9,
      'and it cannot exceed 1.7·OPT');
  });
});

test('two dimensions never need fewer bins than either axis alone', function () {
  const jobs = Packing.randomJobs({ count: 150, seed: 3, skew: 0.8 });
  const cpu = jobs.map(function (job) { return job.cpu; });
  const mem = jobs.map(function (job) { return job.mem; });

  Packing.POLICIES.forEach(function (policy) {
    const packed = Packing.pack2d(jobs, policy);

    assert.ok(packed.bins >= Packing.lowerBound(cpu, 1), policy + ' beat the CPU bound');
    assert.ok(packed.bins >= Packing.lowerBound(mem, 1), policy + ' beat the memory bound');
    assert.ok(packed.lopsided <= packed.bins, policy + ' counted more lopsided bins than bins');
    packed.loads.forEach(function (load) {
      assert.ok(load.cpu <= 1 + 1e-9 && load.mem <= 1 + 1e-9,
        policy + ' overfilled an axis');
    });
  });
});

/* --------------------------------------------------- 21.5 external memory */

test('the bound formulas agree with their own definitions', function () {
  [[10000, 1024, 32], [1e6, 4096, 64], [1e8, 8192, 256]].forEach(function (spec) {
    const bound = External.bounds(spec[0], spec[1], spec[2]);

    assert.strictEqual(bound.scan, Math.ceil(spec[0] / spec[2]), 'a scan is N/B');
    assert.strictEqual(bound.fanOut, Math.floor(spec[1] / spec[2]) - 1,
      'the fan-out keeps one block per run plus one for output');
    assert.strictEqual(bound.initialRuns, Math.ceil(spec[0] / spec[1]), 'a run is one memory-full');
    assert.ok(bound.sort >= bound.scan, 'sorting cannot be cheaper than scanning');
    assert.ok(Math.abs(bound.search - Math.log(spec[0]) / Math.log(spec[2])) < 1e-9,
      'a search is log base B');
  });
});

test('more memory never makes the model predict more passes', function () {
  let previous = Infinity;

  [256, 512, 1024, 2048, 4096, 8192].forEach(function (M) {
    const passes = External.bounds(1e6, M, 64).mergePasses;

    assert.ok(passes <= previous, 'passes rose from ' + previous + ' to ' + passes + ' at M=' + M);
    previous = passes;
  });
});

test('external sort sorts, and costs exactly what the formula says', function () {
  [[64, 16], [128, 16], [256, 32], [1024, 64]].forEach(function (spec) {
    const disk = External.createDisk(External.shuffled(8192, 3), { M: spec[0], B: spec[1] });
    const sorted = External.externalSort(disk);
    const stats = disk.stats();
    const predicted = 2 * Math.ceil(8192 / spec[1]) * (1 + sorted.passes);

    for (let i = 1; i < sorted.order.length; i += 1) {
      assert.ok(sorted.order[i - 1] <= sorted.order[i], 'the output is not sorted');
    }
    assert.strictEqual(sorted.order.length, 8192, 'records were lost');
    assert.strictEqual(stats.transfers, predicted,
      'M=' + spec[0] + ' B=' + spec[1] + ': ' + stats.transfers + ' against ' + predicted);
    assert.ok(stats.peakHeld <= spec[0], 'the budget was exceeded: ' + stats.peakHeld);
  });
});

test('the memory budget is enforced by refusing, not by warning', function () {
  const disk = External.createDisk(External.shuffled(1024, 1), { M: 64, B: 16 });

  assert.throws(function () {
    for (let at = 0; at < 1024 / 16; at += 1) disk.readBlock(at);
  }, /memory/i, 'holding more than M records has to throw');
});

test('a nested-loop join costs one transfer per outer row and a sort-merge costs blocks', function () {
  [2000, 8000, 32000].forEach(function (rows) {
    const outer = External.randomKeys(rows, 1);
    const inner = External.randomKeys(rows, 2);
    const nested = External.nestedLoopJoin(outer, inner, { M: 8192, B: 64 });
    const merge = External.sortMergeJoin(outer, inner, { M: 8192, B: 64 });

    assert.strictEqual(nested.transfers, rows, 'the nested loop is one random block per row');
    assert.strictEqual(nested.perRecord, 1, 'which is exactly one transfer per record');
    assert.ok(merge.transfers < nested.transfers,
      'at ' + rows + ' rows the sort-merge must win: ' + merge.transfers);
    assert.strictEqual(merge.transfers, merge.sortTransfers + merge.walkTransfers,
      'the sort-merge cost is its two parts');
    assert.ok(merge.sortTransfers > merge.walkTransfers, 'and sorting dominates it');
  });
});

/* -------------------------------------------------- 21.6 cache-oblivious */

test('blocking beats the row-major loop, and a big enough cache makes them equal', function () {
  const n = 64;
  const pair = { from: Oblivious.matrix(n, 0, 8), to: Oblivious.matrix(n, n * n * 8, 8) };
  const small = function () { return Oblivious.cacheFor({ lines: 64, lineBytes: 64 }); };
  const naive = Oblivious.transposeNaive(pair, small()).stats.misses;
  const tiled = Oblivious.transposeTiled(pair, small(), 8).stats.misses;
  const recursive = Oblivious.transposeRecursive(pair, small(), { cutoff: 1 }).stats.misses;

  assert.ok(tiled < naive, 'a tile must beat the strided loop');
  assert.ok(recursive <= naive, 'so must the recursion');

  const huge = function () { return Oblivious.cacheFor({ lines: 1 << 16, lineBytes: 64 }); };

  assert.strictEqual(Oblivious.transposeNaive(pair, huge()).stats.misses,
    Oblivious.transposeRecursive(pair, huge(), { cutoff: 1 }).stats.misses,
    'with everything resident the layout cannot matter - only compulsory misses remain');
});

test('the recursive multiply stays close to the best RETUNED tile at every cache size', function () {
  const n = 32;
  const m = { a: Oblivious.matrix(n, 0, 8), b: Oblivious.matrix(n, n * n * 8, 8),
    c: Oblivious.matrix(n, 2 * n * n * 8, 8) };

  [16, 32, 128, 512].forEach(function (lines) {
    const make = function () { return Oblivious.cacheFor({ lines: lines, lineBytes: 64 }); };
    const best = [4, 8, 16].map(function (tile) {
      return Oblivious.multiplyTiled(m, make(), tile).stats.misses;
    }).reduce(function (a, b) { return Math.min(a, b); });
    const recursive = Oblivious.multiplyRecursive(m, make(), { cutoff: 4 }).stats.misses;

    assert.ok(recursive <= best * 1.6,
      'at ' + lines + ' lines the recursion cost ' + recursive + ' against a best tile of ' + best);
  });
});

test('the van Emde Boas order is a permutation with a contiguous top subtree', function () {
  [1, 2, 3, 4, 6, 8].forEach(function (height) {
    const order = Oblivious.vebOrder(height);
    const nodes = Math.pow(2, height) - 1;
    const seen = order.slice().sort(function (a, b) { return a - b; });

    assert.strictEqual(order.length, nodes, 'height ' + height + ': every node appears');
    seen.forEach(function (value, i) {
      assert.strictEqual(value, i, 'height ' + height + ': index ' + i + ' is missing');
    });
    assert.strictEqual(order[0], 0, 'the root is stored first');

    const top = Math.pow(2, Math.ceil(height / 2)) - 1;
    const prefix = order.slice(0, top).sort(function (a, b) { return a - b; });

    prefix.forEach(function (value, i) {
      assert.strictEqual(value, i, 'height ' + height + ': the top subtree is not a prefix');
    });
  });
});

test('the vEB layout is not level order, and it saves misses only on a big tree', function () {
  const order = Oblivious.vebOrder(6);
  const level = order.map(function (unused, i) { return i; });

  assert.notStrictEqual(order.join(','), level.join(','),
    'a vEB order equal to level order is the offset bug, not a layout');

  const deep = ['level', 'sorted', 'veb'].map(function (kind) {
    return Oblivious.searchLayout({ height: 16, kind: kind, lines: 64, queries: 500 });
  });

  deep.forEach(function (run) {
    assert.strictEqual(run.comparisons, 16 * 500,
      run.kind + ' did different work - then the miss column is not about layout');
  });
  assert.ok(deep[2].missesPerQuery < deep[0].missesPerQuery,
    'on a tree far larger than the cache the vEB layout must win');
});

/* --------------------------------------------------- 21.7-21.9 parallel */

test('all three scans compute the prefix sums they claim to', function () {
  [8, 64, 256].forEach(function (n) {
    const values = Parallel.ones(n);
    const sequential = Parallel.sequentialScan(values);
    const hillis = Parallel.hillisSteeleScan(values);
    const blelloch = Parallel.blellochScan(values);

    assert.deepStrictEqual(hillis.result, sequential.result,
      'Hillis-Steele must match the sequential inclusive scan');
    assert.deepStrictEqual(blelloch.result, Parallel.exclusivePrefix(values),
      'Blelloch computes the EXCLUSIVE scan');
    assert.strictEqual(blelloch.total, n, 'the total is the sum of n ones');
  });
});

test('work and span match their formulas, and the trade between them is real', function () {
  [16, 64, 256].forEach(function (n) {
    const levels = Math.log2(n);
    const sequential = Parallel.sequentialScan(Parallel.ones(n));
    const blelloch = Parallel.blellochScan(Parallel.ones(n));
    const hillis = Parallel.hillisSteeleScan(Parallel.ones(n));

    assert.strictEqual(sequential.work, sequential.span, 'a sequential scan has span equal to work');
    assert.strictEqual(blelloch.work, 2 * n - 1, 'Blelloch does 2(n − 1) additions plus the root');
    assert.strictEqual(blelloch.span, 2 * levels + 1, 'and its span is 2·log₂ n + 1');
    assert.ok(hillis.span < blelloch.span, 'Hillis-Steele must have the shorter path');
    assert.ok(hillis.work > blelloch.work, 'and must pay for it in work');
  });
});

test('a greedy schedule is bounded below by both lower bounds and above by Brent', function () {
  const blelloch = Parallel.blellochScan(Parallel.ones(256));

  [1, 2, 4, 8, 16, 32, 64, 256, 1024].forEach(function (p) {
    const run = Parallel.schedule(blelloch.trace, p);

    assert.ok(run.time >= run.span, p + ' processors beat the span');
    assert.ok(run.time >= Math.ceil(run.work / p), p + ' processors beat work over p');
    assert.ok(run.time <= run.brentBound, p + ' processors exceeded Brent’s bound');
    assert.ok(Math.abs(run.utilisation - run.work / (p * run.time)) < 1e-9, 'utilisation');
  });
  assert.strictEqual(Parallel.schedule(blelloch.trace, 1024).time, blelloch.span,
    'past the parallelism, more processors change nothing');
});

test('Amdahl is capped by the serial fraction and Gustafson is not', function () {
  [0.001, 0.01, 0.05, 0.2].forEach(function (serial) {
    const ceiling = 1 / serial;

    [8, 32, 128, 1024, 1e6].forEach(function (p) {
      const speedup = Parallel.amdahl(serial, p);

      assert.ok(speedup <= ceiling + 1e-9, 'Amdahl passed its own ceiling at p=' + p);
      assert.ok(speedup <= p + 1e-9, 'no speed-up exceeds the processor count');
    });
    assert.ok(Parallel.gustafson(serial, 1024) > Parallel.amdahl(serial, 1024),
      'the scaled question always answers higher');
    assert.ok(Math.abs(Parallel.gustafson(serial, 1024) - (serial + 1024 * (1 - serial))) < 1e-9,
      'Gustafson is linear in the processor count');
  });
});

test('the speed-up table reports the ceiling each row cannot pass', function () {
  const table = Parallel.speedupTable(0.05, [1, 8, 32, 1024]);

  table.rows.forEach(function (row) {
    assert.ok(Math.abs(row.ceiling - 1 / row.serial) < 1e-9, 'the ceiling is 1/s');
    row.amdahl.forEach(function (cell) {
      assert.ok(cell.speedup <= row.ceiling + 1e-9,
        'a row at serial ' + row.serial + ' passed its ceiling at p=' + cell.p);
    });
  });
});
