'use strict';

/**
 * The M37 algorithms and views, checked against something that is not
 * themselves.
 *
 * Two checks carry this half. The three-Cs reconciliation is the first:
 * compulsory, capacity and conflict are defined by what two OTHER caches would
 * have done with the same access, so they are exhaustive and disjoint by
 * construction and must sum to the miss count exactly. A classifier whose
 * categories do not add up has a case it has not thought about, and the sum is
 * the only assertion that can find it.
 *
 * The second is that a measurement reports what it claims to. A discovery
 * method is worth nothing until it has been run against a machine whose
 * configuration is known, and each of the confounders it is designed to avoid
 * has to be shown breaking it - otherwise the controls are decoration, which is
 * exactly what they were until the harness modelled a prefetcher and a bounded
 * number of outstanding accesses.
 *
 * The machines these run against are in `cache-modules.test.js`.
 */

const test = require('node:test');
const assert = require('node:assert');

const Cache = require('../../src/js/machines/memory/cache.js');
const Hierarchy = require('../../src/js/machines/memory/hierarchy.js');
const ThreeCs = require('../../src/js/algorithms/three-cs.js');
const Prefetchers = require('../../src/js/algorithms/prefetchers.js');
const Microbench = require('../../src/js/algorithms/cache-microbench.js');
const Matrix = require('../../src/js/algorithms/matrix-blocking.js');
const CacheView = require('../../src/js/viz/cache-view.js');

const SMALL = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4 };

function run(cache, trace) {
  trace.forEach(function (entry) {
    Cache.access(cache, typeof entry === 'number' ? { address: entry } : entry);
  });
  return Cache.summary(cache);
}

function walk(step, count, passes, write) {
  const out = [];

  for (let pass = 0; pass < passes; pass += 1) {
    for (let at = 0; at < count; at += 1) out.push({ address: at * step, write: write });
  }
  return out;
}

/* ----------------------------------------------------------------- three Cs */

test('three Cs: the categories sum to the miss count, on every fixture', function () {
  const fixtures = [Matrix.naive({ n: 24 }).trace, Matrix.interchanged({ n: 24 }).trace,
    Microbench.pointerChase({ bytes: 262144, passes: 3 }).trace,
    Microbench.strided({ step: 4096, count: 64, passes: 4 }).trace,
    Microbench.randomAccess({ bytes: 262144, count: 2048, seed: 4 }).trace];

  fixtures.forEach(function (trace, at) {
    const found = ThreeCs.classify(trace, { sets: 64, ways: 8, lineBytes: 64 });
    const counts = found.counts;

    assert.strictEqual(counts.compulsory + counts.capacity + counts.conflict, found.misses,
      'fixture ' + at + ' reconciles exactly');
    assert.strictEqual(found.reconciles, true, 'and says so itself');
    assert.strictEqual(found.timeline.length, found.misses, 'one timeline entry per miss');
  });
});

test('three Cs: a fully associative cache has no conflict misses by definition', function () {
  const trace = Matrix.naive({ n: 24 }).trace;
  const full = ThreeCs.classify(trace, { sets: 1, ways: 512, lineBytes: 64 });

  assert.strictEqual(full.counts.conflict, 0, 'there is no mapping left to get wrong');
  assert.strictEqual(full.misses, full.idealMisses,
    'and the reference cache is the cache itself');
});

test('three Cs: raising associativity removes conflicts and not capacity', function () {
  const trace = Microbench.strided({ step: 4096, count: 48, passes: 4 }).trace;
  const rows = ThreeCs.sweepAssociativity(trace, { sets: 64, ways: 8, lineBytes: 64 },
    [1, 8, 64, 512]);

  assert.ok(rows[0].conflict > 0, 'a direct-mapped cache has conflicts on this walk');
  assert.strictEqual(rows[3].conflict, 0, 'and a fully associative one has none');
  rows.forEach(function (row) {
    assert.strictEqual(row.compulsory, rows[0].compulsory,
      'the compulsory count is a property of the trace, not of the shape');
  });
});

/* -------------------------------------------------------------- prefetchers */

test('prefetchers: coverage, accuracy and traffic are consistent with each other',
  function () {
    const trace = Microbench.strided({ step: 192, count: 256, passes: 2 }).trace;

    Prefetchers.compare(trace, { cache: SMALL }).forEach(function (row) {
      assert.ok(row.accuracy >= 0 && row.accuracy <= 1, row.kind + ': accuracy is a fraction');
      assert.ok(row.coverage <= 1, row.kind + ': coverage is a fraction');
      assert.strictEqual(row.traffic, row.demandMisses + row.prefetched,
        row.kind + ': traffic is every line the level below supplied');
      assert.ok(row.usedPrefetches <= row.prefetched, row.kind + ': used at most what it issued');
    });
  });

test('prefetchers: the confidence counter refuses a pattern with no structure', function () {
  const random = Microbench.randomAccess({ bytes: 1048576, count: 2048, seed: 9 }).trace;
  const strided = Microbench.strided({ step: 192, count: 256, passes: 2 }).trace;

  [1, 2, 3].forEach(function (confidence) {
    const noise = Prefetchers.run(random, 'stride', { cache: SMALL,
      prefetcher: { confidence: confidence } });
    const real = Prefetchers.run(strided, 'stride', { cache: SMALL,
      prefetcher: { confidence: confidence } });

    assert.strictEqual(noise.prefetched, 0,
      'at confidence ' + confidence + ' a delta that never repeats issues nothing');
    assert.ok(real.prefetched > 400, 'while a repeated one is acted on');
  });
  assert.ok(Prefetchers.run(random, 'nextLine', { cache: SMALL }).prefetched > 1000,
    'and a design with no confidence mechanism fires on the noise instead');
});

test('prefetchers: the best coverage on the page can still be the wrong answer', function () {
  const trace = Microbench.strided({ step: 192, count: 256, passes: 2 }).trace;
  const rows = Prefetchers.compare(trace, { cache: SMALL });
  const baseline = rows[0];
  const stride = rows.filter(function (row) { return row.kind === 'stride'; })[0];
  const stream = rows.filter(function (row) { return row.kind === 'stream'; })[0];

  assert.ok(stream.coverage > stride.coverage, 'stream removes the most misses');
  assert.ok(stream.traffic > 2 * stride.traffic, 'and moves more than twice the lines to do it');
  assert.match(Prefetchers.verdict(stream, baseline), /net loss/,
    'which the verdict is willing to call a net loss');
  assert.match(Prefetchers.verdict(stride, baseline), /removed \d+ misses/,
    'while the cheaper design is reported as a win');
});

test('prefetchers: nothing helps a pointer chase, and that is not a gap', function () {
  const chase = Microbench.pointerChase({ bytes: 65536, passes: 2, seed: 7 }).trace;
  const rows = Prefetchers.compare(chase, { cache: SMALL });

  rows.slice(1).forEach(function (row) {
    assert.ok(row.coverage < 0.2,
      row.kind + ' cannot predict an address that is the value of the last load');
  });
});

/* ------------------------------------------------------------ microbenchmarks */

test('microbench: a chase touches every line once a pass and is not in address order',
  function () {
    const found = Microbench.pointerChase({ bytes: 65536, passes: 3, seed: 7 });
    const lines = found.trace.slice(0, found.lines).map(function (entry) {
      return entry.address / 64;
    });
    const ordered = lines.slice().sort(function (left, right) { return left - right; });

    assert.strictEqual(found.lines, 1024, '64 KiB of 64-byte lines');
    assert.strictEqual(found.trace.length, 3072, 'three passes over all of them');
    assert.deepStrictEqual(ordered, ordered.map(function (value, at) { return at; }),
      'every line exactly once');
    assert.notDeepStrictEqual(lines, ordered,
      'and not in address order, which is what defeats a prefetcher');
  });

test('microbench: a stream is the same lines in order, which is a different measurement',
  function () {
    const found = Microbench.stream({ bytes: 65536, passes: 3 });
    const lines = found.trace.slice(0, found.lines).map(function (entry) {
      return entry.address / 64;
    });

    assert.deepStrictEqual(lines, lines.map(function (value, at) { return at; }),
      'in address order, exactly');
    assert.strictEqual(found.trace.length,
      Microbench.pointerChase({ bytes: 65536, passes: 3 }).trace.length,
      'and the same number of accesses to the same bytes');
  });

test('microbench: the steps recover the configured capacities, and the size below',
  function () {
    const curve = Microbench.ladder({ sizes: Microbench.defaultSizes() });
    const found = Microbench.steps(curve).map(function (step) { return step.capacity; });
    const wanted = Hierarchy.PRESET.map(function (level) {
      return level.sets * level.ways * level.lineBytes;
    });

    assert.deepStrictEqual(found, wanted, 'three steps, on the three capacities, in order');
    curve.forEach(function (row, at) {
      if (!at) return;
      assert.ok(row.cycles >= curve[at - 1].cycles - 1e-9,
        'and the curve never goes down as the working set grows');
    });
  });

function ladderFor(pattern, options) {
  const curve = Microbench.ladder(Object.assign({ sizes: Microbench.defaultSizes(),
    pattern: pattern, passes: 4, seed: 2 }, options || {}));

  return { curve: curve, steps: Microbench.steps(curve),
    flat: curve.map(function (row) { return Number(row.cycles.toFixed(1)); }) };
}

test('microbench: the three patterns touch the same bytes and answer differently',
  function () {
    const chase = Microbench.pointerChase({ bytes: 65536, passes: 2, seed: 2 });
    const ordered = Microbench.orderedChase({ bytes: 65536, passes: 2 });
    const stream = Microbench.stream({ bytes: 65536, passes: 2 });
    const bytesOf = function (found) {
      return found.trace.map(function (entry) { return entry.address; }).sort().join(',');
    };

    assert.strictEqual(bytesOf(ordered), bytesOf(chase), 'the same addresses');
    assert.strictEqual(bytesOf(stream), bytesOf(chase), 'in all three walks');
    assert.deepStrictEqual(ordered.trace.map(function (entry) { return entry.address; }),
      stream.trace.map(function (entry) { return entry.address; }),
      'and the ordered chase is the sequential walk, address for address');
    assert.strictEqual(ordered.kind, 'chase', 'what differs is that its accesses depend');
    assert.strictEqual(stream.kind, 'stream', 'and that a walk\'s do not');
  });

test('microbench: only the shuffled chase measures the hierarchy', function () {
  const chase = ladderFor('chase');
  const ordered = ladderFor('ordered');
  const stream = ladderFor('stream');
  const hit = Hierarchy.PRESET[0].hitCycles;

  assert.strictEqual(chase.steps.length, 3, 'the chase finds all three capacities');
  assert.strictEqual(ordered.steps.length, 0, 'an ordered chase finds none at all');
  assert.ok(ordered.flat.every(function (value) { return value <= hit + 0.5; }),
    'because the prefetcher answers, at about the L1 hit time whatever the size');
  assert.ok(ordered.curve[ordered.curve.length - 1].prefetched > 1000000,
    'having issued a prefetch for very nearly every line');
  assert.strictEqual(chase.curve[chase.curve.length - 1].prefetched, 0,
    'while a shuffled chase gives it no repeated delta to act on, so it issues nothing');
  assert.strictEqual(stream.steps.length, 0, 'a sequential walk finds none either');
  assert.ok(stream.flat.every(function (value) { return value < hit; }),
    'and reports a per-access time below the L1 latency, which no latency can be');
});

test('microbench: with nothing to fool, the pattern control would be decoration',
  function () {
    const chase = ladderFor('chase', { prefetch: false });
    const ordered = ladderFor('ordered', { prefetch: false });

    assert.deepStrictEqual(ordered.flat, chase.flat,
      'with no prefetcher the two chases are the same measurement, which is why one is '
        + 'modelled: a control whose mechanism is missing changes nothing and looks like a '
        + 'control that does not matter');
    assert.strictEqual(ordered.steps.length, 3, 'and both find all three capacities');
  });

test('microbench: including the first pass lifts the curve and loses a step', function () {
  const warm = ladderFor('chase');
  const cold = ladderFor('chase', { warm: false });

  cold.curve.forEach(function (row, at) {
    assert.ok(row.cycles >= warm.curve[at].cycles, 'every point is lifted, at ' + row.bytes);
  });
  assert.strictEqual(cold.flat[0], 81.3, 'a 1 KiB working set now reads as 81.3 cycles');
  assert.deepStrictEqual(cold.steps.map(function (step) { return step.capacity; }),
    [524288, 8388608], 'and the 32 KiB step no longer clears the threshold');
});

test('microbench: the associativity comes out of a conflict set', function () {
  [2, 4, 8, 16].forEach(function (ways) {
    const levels = [Object.assign({}, Hierarchy.PRESET[0], { ways: ways,
      sets: Math.max(1, Math.round(32768 / (ways * 64))) })];
    const found = Microbench.discoverAssociativity({ hierarchy: { levels: levels },
      stride: levels[0].sets * 64, limit: 32 });

    assert.strictEqual(found.associativity, ways, ways + ' ways, recovered exactly');
    assert.strictEqual(found.failedAt, ways + 1, 'and one more than that is where it broke');
  });
});

/* ------------------------------------------------------------ matrix blocking */

function addresses(version) {
  return version.trace.map(function (entry) {
    return entry.address + (entry.write ? 'w' : 'r');
  }).sort();
}

test('matrix: the four versions do the same work in a different order', function () {
  const naive = Matrix.naive({ n: 16 });
  const interchanged = Matrix.interchanged({ n: 16 });
  const blocked = Matrix.blocked({ n: 16, tile: 4 });

  assert.strictEqual(naive.trace.length, 3 * 16 * 16 * 16, 'three accesses per multiply');
  assert.deepStrictEqual(addresses(interchanged), addresses(naive),
    'interchanging the loops changes the order and not one address');
  assert.deepStrictEqual(addresses(blocked), addresses(naive), 'and neither does blocking');
  assert.notDeepStrictEqual(interchanged.trace, naive.trace, 'the order really did change');
  assert.notDeepStrictEqual(blocked.trace, naive.trace, 'and blocking changed it again');
});

test('matrix: each transformation removes the category it was aimed at', function () {
  const shape = { sets: 64, ways: 8, lineBytes: 64 };
  const naive = ThreeCs.classify(Matrix.naive({ n: 64 }).trace, shape);
  const interchanged = ThreeCs.classify(Matrix.interchanged({ n: 64 }).trace, shape);
  const blocked = ThreeCs.classify(Matrix.blocked({ n: 64, tile: 16 }).trace, shape);

  assert.strictEqual(naive.dominant.key, 'conflict', 'the naive nest is a layout problem');
  assert.strictEqual(interchanged.counts.conflict, 0, 'which the loop order removes entirely');
  assert.strictEqual(interchanged.dominant.key, 'capacity',
    'leaving a working set that does not fit');
  assert.ok(blocked.counts.capacity < interchanged.counts.capacity / 4,
    'which is what the tiling is for');
  assert.strictEqual(blocked.counts.compulsory, naive.counts.compulsory,
    'and no version can avoid touching the data once');
});

test('matrix: padding breaks the alignment, and cannot help where there is none', function () {
  const shape = { sets: 64, ways: 8, lineBytes: 64 };
  const plain = ThreeCs.classify(Matrix.naive({ n: 64 }).trace, shape);
  const padded = ThreeCs.classify(Matrix.naive({ n: 64, pad: 1 }).trace, shape);
  const blocked = ThreeCs.classify(Matrix.blocked({ n: 64, tile: 16 }).trace, shape);
  const both = ThreeCs.classify(Matrix.blocked({ n: 64, tile: 16, pad: 1 }).trace, shape);

  assert.ok(padded.misses < plain.misses / 2, 'one element per row halves the trips');
  assert.strictEqual(padded.counts.conflict, 0, 'because it removes every conflict miss');
  assert.ok(both.misses > blocked.misses,
    'and on a version with no conflicts left it is faintly harmful rather than neutral: '
      + both.misses + ' against ' + blocked.misses + ', because the padding is still data');
  assert.ok(both.counts.compulsory > blocked.counts.compulsory,
    'which is where the extra trips are - more lines to touch once');
});

test('matrix: the tile rule is three tiles that fit, rounded down', function () {
  [[32768, 8], [262144, 8], [32768, 4]].forEach(function (row) {
    const tile = Matrix.tileFor(row[0], row[1]);

    assert.ok(3 * tile * tile * row[1] <= row[0], 'three tiles of ' + tile + ' fit');
    assert.ok(3 * (tile + 1) * (tile + 1) * row[1] > row[0], 'and one element more does not');
  });
  assert.strictEqual(Matrix.tileFor(32768, 8), 36, 'which is 36 for 32 KiB of 8-byte elements');
  assert.strictEqual(Matrix.layout({ n: 64, pad: 1 }).stride, 65 * 8,
    'and padding is added to the row stride, which is what breaks the alignment');
});

/* --------------------------------------------------------------- the views */

test('cache view: the grid and the spread report what the cache holds', function () {
  const cache = Cache.create(SMALL);

  run(cache, walk(64, 24, 2));
  const resident = Cache.resident(cache);
  const rows = CacheView.grid(cache, resident);
  const spread = CacheView.spread(cache, resident);
  const filled = rows.reduce(function (sum, row) { return sum + row.length; }, 0);

  assert.strictEqual(rows.length, SMALL.sets, 'one row per set');
  assert.strictEqual(filled, resident.length, 'and one cell per resident line');
  assert.strictEqual(spread.lines, resident.length, 'the spread agrees');
  assert.strictEqual(spread.used, rows.filter(function (row) {
    return row.length > 0;
  }).length, 'and counts the sets that are in use at all');
  assert.ok(spread.share > 0 && spread.share <= 1, 'as a fraction of the table');
});

test('cache view: a conflicting stride collapses the table into one row', function () {
  const cache = Cache.create(SMALL);

  run(cache, walk(SMALL.sets * SMALL.lineBytes, 32, 3));
  const spread = CacheView.spread(cache, Cache.resident(cache));

  assert.strictEqual(spread.used, 1, 'a sixteen-set cache using one set');
  assert.strictEqual(spread.capacityUsed, 4 / 64, 'and a sixteenth of its capacity');
  assert.strictEqual(CacheView.heatClass(0, 4), 'cache-heat-0', 'an empty set reads as empty');
  assert.strictEqual(CacheView.heatClass(4, 4), CacheView.HEAT[CacheView.HEAT.length - 1],
    'and a full one as full');
});

test('cache view: the decomposition is the one in the module, spelled out', function () {
  const cache = Cache.create(SMALL);
  const parts = Cache.decode(cache, 0x1234);
  const shown = CacheView.decomposition(cache, parts, 0x1234);
  const byField = {};

  shown.forEach(function (row) { byField[row.field] = row.value; });
  assert.strictEqual(byField.index, parts.index, 'the same set');
  assert.strictEqual(byField.tag, parts.tag, 'the same tag');
  assert.strictEqual(byField.offset, parts.offset, 'and the same offset');
  assert.strictEqual(byField.address, '0x1234', 'against the address it came from');
});
