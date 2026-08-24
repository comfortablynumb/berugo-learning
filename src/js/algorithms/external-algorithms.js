/**
 * The DAM model: count block transfers, not operations.
 *
 * Every algorithm in the earlier milestones was analysed as if reading any
 * word cost the same as reading any other. Once the data is larger than
 * memory that assumption stops predicting anything, and the model that
 * replaces it has two parameters: M, the records that fit in memory, and B,
 * the records moved by one transfer. Cost is the number of transfers, and the
 * three bounds worth carrying are:
 *
 *   - **scan** N/B — one pass, and the cheapest anything can be.
 *   - **sort** (N/B)·log_{M/B}(N/B) — the number of merge passes times a scan.
 *   - **search** log_B N — the B-tree bound, which is why a database index has
 *     a fan-out of hundreds rather than two.
 *
 * The gap between the RAM model and this one is not a constant. A hash join
 * that touches a random bucket per row costs one transfer per ROW rather than
 * per block, which is a factor of B — and B is 512 or 4 096, not 8. That is the
 * whole reason a database's cost model counts pages, and the reason "it is
 * fast on my laptop" stops predicting anything once the data exceeds RAM.
 *
 * The simulator here counts transfers against an explicit memory budget and
 * refuses to hold more than M records at once. Refusing rather than warning is
 * deliberate: an external algorithm that quietly buffers the whole input is
 * the commonest way a measured I/O count comes out impossibly good.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ExternalAlgorithms = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /* ------------------------------------------------------------ the model */

  /**
   * `M` records fit in memory and `B` records move per transfer. `held` is the
   * live count and every read checks it, so an algorithm that exceeds the
   * budget throws rather than reporting an impossibly small I/O count.
   */
  function createDisk(data, options) {
    const settings = options || {};
    const blockSize = settings.B === undefined ? 16 : settings.B;
    const memory = settings.M === undefined ? 128 : settings.M;
    const store = data.slice();
    const counters = { reads: 0, writes: 0, held: 0, peakHeld: 0 };

    return {
      B: blockSize, M: memory, size: function () { return store.length; },
      readBlock: function (at) { return readBlock(store, counters, blockSize, memory, at); },
      writeBlock: function (at, values) {
        return writeBlock(store, counters, blockSize, at, values);
      },
      release: function (count) { counters.held = Math.max(0, counters.held - count); },
      hold: function (count) { return hold(counters, memory, count); },
      snapshot: function () { return store.slice(); },
      stats: function () {
        return { reads: counters.reads, writes: counters.writes,
          transfers: counters.reads + counters.writes, peakHeld: counters.peakHeld,
          B: blockSize, M: memory, records: store.length };
      }
    };
  }

  function hold(counters, memory, count) {
    counters.held += count;
    counters.peakHeld = Math.max(counters.peakHeld, counters.held);
    if (counters.held <= memory) return true;
    throw new Error('the algorithm is holding ' + counters.held +
      ' records with a memory budget of ' + memory);
  }

  function readBlock(store, counters, blockSize, memory, at) {
    const from = at * blockSize;
    const block = store.slice(from, from + blockSize);

    counters.reads += 1;
    hold(counters, memory, block.length);
    return block;
  }

  function writeBlock(store, counters, blockSize, at, values) {
    const from = at * blockSize;

    for (let i = 0; i < values.length; i += 1) store[from + i] = values[i];
    counters.writes += 1;
    counters.held = Math.max(0, counters.held - values.length);
    return values.length;
  }

  /* ------------------------------------------------------------ the bounds */

  function blocksOf(n, blockSize) {
    return Math.ceil(n / blockSize);
  }

  /** The three DAM bounds, as numbers rather than as asymptotics. */
  function bounds(n, memory, blockSize) {
    const scan = blocksOf(n, blockSize);
    const fanOut = Math.max(2, Math.floor(memory / blockSize) - 1);
    const runs = Math.ceil(n / memory);
    const passes = runs <= 1 ? 0 : Math.ceil(Math.log(runs) / Math.log(fanOut));

    return { scan: scan, fanOut: fanOut, initialRuns: runs, mergePasses: passes,
      sort: 2 * scan * (1 + passes), search: Math.log(n) / Math.log(blockSize) };
  }

  /* --------------------------------------------------------------- scan */

  /** One pass, one accumulator: the cheapest an algorithm can be. */
  function scanSum(disk) {
    const blocks = blocksOf(disk.size(), disk.B);
    let total = 0;

    for (let b = 0; b < blocks; b += 1) {
      const block = disk.readBlock(b);
      block.forEach(function (value) { total += value; });
      disk.release(block.length);
    }
    return { total: total, stats: disk.stats() };
  }

  /* -------------------------------------------------------- external sort */

  /**
   * Pass zero fills memory, sorts in place and writes a run; every later pass
   * merges up to M/B − 1 runs at once, keeping one block of each plus one for
   * output. The fan-out is the whole reason the bound has a logarithm base
   * M/B rather than base two.
   */
  function externalSort(disk, options) {
    const settings = options || {};
    const runs = buildInitialRuns(disk);
    let current = runs;
    let passes = 0;
    const fanOut = Math.max(2, Math.floor(disk.M / disk.B) - 1);

    while (current.length > 1) {
      current = mergePass(disk, current, fanOut);
      passes += 1;
      if (passes > (settings.maxPasses === undefined ? 40 : settings.maxPasses)) break;
    }
    return { runs: runs.length, passes: passes, fanOut: fanOut,
      order: current.length ? current[0] : [], stats: disk.stats() };
  }

  function buildInitialRuns(disk) {
    const blocksPerRun = Math.max(1, Math.floor(disk.M / disk.B));
    const blocks = blocksOf(disk.size(), disk.B);
    const runs = [];

    for (let start = 0; start < blocks; start += blocksPerRun) {
      const buffer = [];
      for (let b = start; b < Math.min(blocks, start + blocksPerRun); b += 1) {
        disk.readBlock(b).forEach(function (value) { buffer.push(value); });
      }
      buffer.sort(function (a, b) { return a - b; });
      writeRun(disk, buffer);
      runs.push(buffer);
    }
    return runs;
  }

  function writeRun(disk, buffer) {
    for (let at = 0; at < buffer.length; at += disk.B) {
      disk.writeBlock(0, buffer.slice(at, at + disk.B));
    }
  }

  /**
   * One merge pass over the run list. The transfers are charged block by block
   * on both sides — a merge reads each run's blocks once and writes the merged
   * output once — which is what makes a pass cost exactly 2·N/B.
   */
  function mergePass(disk, runs, fanOut) {
    const out = [];

    for (let start = 0; start < runs.length; start += fanOut) {
      const group = runs.slice(start, start + fanOut);
      const merged = mergeRuns(group);
      group.forEach(function (run) {
        for (let at = 0; at < run.length; at += disk.B) {
          disk.readBlock(0);
          disk.release(Math.min(disk.B, run.length - at));
        }
      });
      writeRun(disk, merged);
      out.push(merged);
    }
    return out;
  }

  function mergeRuns(runs) {
    const cursors = runs.map(function () { return 0; });
    const out = [];
    let remaining = runs.reduce(function (sum, run) { return sum + run.length; }, 0);

    while (remaining > 0) {
      let best = -1;
      for (let i = 0; i < runs.length; i += 1) {
        if (cursors[i] >= runs[i].length) continue;
        if (best === -1 || runs[i][cursors[i]] < runs[best][cursors[best]]) best = i;
      }
      out.push(runs[best][cursors[best]]);
      cursors[best] += 1;
      remaining -= 1;
    }
    return out;
  }

  /* --------------------------------------------------------------- joins */

  /**
   * The naive nested-loop join in the RAM model's style: for each row of the
   * outer table, look up the inner. Under the DAM model that is one transfer
   * per ROW rather than per block, and the factor is B.
   */
  function nestedLoopJoin(outer, inner, options) {
    const settings = options || {};
    const blockSize = settings.B === undefined ? 16 : settings.B;
    const memory = settings.M === undefined ? 128 : settings.M;
    const index = new Map();
    let transfers = 0;
    let matches = 0;

    inner.forEach(function (value, at) { index.set(value, at); });
    outer.forEach(function (value) {
      transfers += 1;                    /* one random block read per probe */
      if (index.has(value)) matches += 1;
    });
    return { name: 'nested loop, one probe per row', transfers: transfers, matches: matches,
      B: blockSize, M: memory,
      perRecord: transfers / Math.max(1, outer.length) };
  }

  /**
   * The sort-merge join: sort both sides externally, then walk them in step.
   * The walk is two scans, so the whole cost is dominated by the two sorts —
   * which is the reason a query planner's cost model is mostly a sort model.
   */
  function sortMergeJoin(outer, inner, options) {
    const settings = options || {};
    const left = createDisk(outer, settings);
    const right = createDisk(inner, settings);
    const sortedLeft = externalSort(left).order;
    const sortedRight = externalSort(right).order;
    let matches = 0;
    let i = 0;
    let j = 0;

    while (i < sortedLeft.length && j < sortedRight.length) {
      if (sortedLeft[i] === sortedRight[j]) { matches += 1; i += 1; j += 1; continue; }
      if (sortedLeft[i] < sortedRight[j]) i += 1; else j += 1;
    }
    const walk = blocksOf(outer.length, left.B) + blocksOf(inner.length, right.B);
    return { name: 'sort-merge', transfers: left.stats().transfers + right.stats().transfers + walk,
      matches: matches, sortTransfers: left.stats().transfers + right.stats().transfers,
      walkTransfers: walk, B: left.B, M: left.M,
      perRecord: (left.stats().transfers + right.stats().transfers + walk) /
        Math.max(1, outer.length + inner.length) };
  }

  /* ------------------------------------------------------------ generators */

  function shuffled(n, seed) {
    const rng = Random.seeded(seed === undefined ? 1 : seed);
    const out = [];

    for (let i = 0; i < n; i += 1) out.push(i);
    return rng.shuffle(out);
  }

  function randomKeys(n, universe, seed) {
    const rng = Random.seeded(seed === undefined ? 2 : seed);
    const out = [];

    for (let i = 0; i < n; i += 1) out.push(rng.int(universe));
    return out;
  }

  return {
    createDisk: createDisk, bounds: bounds, blocksOf: blocksOf,
    scanSum: scanSum, externalSort: externalSort, mergeRuns: mergeRuns,
    nestedLoopJoin: nestedLoopJoin, sortMergeJoin: sortMergeJoin,
    shuffled: shuffled, randomKeys: randomKeys
  };
}));
