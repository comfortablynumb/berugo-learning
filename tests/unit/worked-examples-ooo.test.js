'use strict';

/**
 * Every figure the M36 worked examples and reference tables quote, recomputed.
 *
 * The content is written from what the modules print, and this suite is what
 * stops it drifting afterwards. A milestone whose prose and simulator disagree
 * is worse than one with no prose: the reader has no way to tell which of the
 * two is wrong, and the numbers are the only reason to believe any of it.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/machines/ooo-core.js');
const Trace = require('../../src/js/machines/ooo/trace.js');
const Smt = require('../../src/js/machines/ooo/smt.js');
const Workloads = require('../../src/js/machines/ooo/workloads.js');
const Ilp = require('../../src/js/algorithms/ilp-analysis.js');
const Topdown = require('../../src/js/algorithms/topdown.js');
const SideChannel = require('../../src/js/machines/side-channel-lab.js');
const View = require('../../src/js/viz/ooo-view.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Programs = require('../../src/js/machines/brv32/programs.js');
const Traps = require('../../src/js/machines/brv32/traps.js');

const SMALL = { sets: 8, ways: 1, lineBytes: 32 };
const NEWLINE = String.fromCharCode(10);

function sourceFor(name) {
  const fixture = Workloads.get(name);

  return fixture ? fixture.source : Programs.CATALOGUE[name].source;
}

function core(name, options) {
  const image = Assembler.assemble(sourceFor(name), { origin: 0 });
  const built = Core.create(Object.assign({ image: image.bytes, entry: 0, width: 4 },
    options || {}));

  Core.run(built, { cycles: 40000, stopOnTrap: true });
  return built;
}

function summary(name, options) {
  return Core.summary(core(name, options));
}

function bound(name, options) {
  return Ilp.analyse(Trace.ofSource(sourceFor(name)).rows,
    Object.assign({ unitLatency: true }, options || {}));
}

function round(value, places) {
  return Number(value.toFixed(places));
}

/* -------------------------------------------------------------- 36.1 */

test('ilp examples: the chain and independent bounds, and their headroom', function () {
  const chain = bound('chain');
  const independent = bound('independent');
  const chainRun = summary('chain', { width: 4 });
  const indepRun = summary('independent', { width: 4 });

  assert.strictEqual(chain.instructions, 33, 'chain is 33 instructions');
  assert.strictEqual(chain.criticalPath, 33, 'and its critical path is all of them');
  assert.strictEqual(round(chain.ilp, 2), 1, 'so the bound is 1.00');
  assert.strictEqual(independent.instructions, 32, 'independent is 32 instructions');
  assert.strictEqual(independent.criticalPath, 1, 'with a critical path of one cycle');
  assert.strictEqual(round(independent.ilp, 2), 32, 'and a bound of 32.00');

  assert.strictEqual(chainRun.cycles, 38, 'chain takes 38 cycles at width 4');
  assert.strictEqual(round(chainRun.ipc, 3), 0.868, 'for an IPC of 0.868');
  assert.strictEqual(indepRun.cycles, 21, 'independent takes 21');
  assert.strictEqual(round(indepRun.ipc, 3), 1.524, 'for 1.524');

  assert.strictEqual(round(chain.ilp / chainRun.ipc, 2), 1.15, 'headroom 1.15x');
  assert.strictEqual(round(independent.ilp / indepRun.ipc, 2), 21, 'and 21.00x');
});

test('ilp examples: renaming is worth exactly eight on the independent trace', function () {
  const renamed = bound('independent');
  const plain = bound('independent', { model: 'unrenamed' });

  assert.strictEqual(renamed.counts.raw, 0, 'no addition reads another addition\'s result');
  assert.strictEqual(renamed.counts.waw, 28, 'four names written eight times each');
  assert.strictEqual(plain.criticalPath, 8, 'the longest chain is one name written eight times');
  assert.strictEqual(round(plain.ilp, 2), 4, 'so the unrenamed bound is 4.00');
  assert.strictEqual(round(renamed.ilp / plain.ilp, 1), 8, 'renaming is worth 8.0x');
});

test('ilp reference: the bounds quoted for factorial, chase and arrayMax', function () {
  assert.strictEqual(bound('factorial').criticalPath, 19, 'factorial critical path');
  assert.strictEqual(round(bound('factorial').ilp, 2), 6.53, 'and its bound');
  assert.strictEqual(bound('chase').criticalPath, 66, 'chase critical path');
  assert.strictEqual(round(bound('chase').ilp, 2), 2.02, 'and its bound');
  assert.strictEqual(round(bound('arrayMax').ilp, 2), 4.67, 'arrayMax bound');
  assert.strictEqual(round(bound('arrayMax').ilp / summary('arrayMax', { width: 4 }).ipc, 2),
    5.78, 'and its headroom');
});

test('ilp reference: the parallelism profile of factorial', function () {
  const profile = Ilp.profile(Trace.ofSource(sourceFor('factorial')).rows,
    { unitLatency: true });
  const peak = profile.reduce(function (most, row) {
    return Math.max(most, row.ready);
  }, 0);

  assert.strictEqual(profile.length, 19, 'one bucket per cycle of the critical path');
  assert.strictEqual(profile[0].ready, 26, '26 instructions could start in the first cycle');
  assert.strictEqual(peak, 26, 'and that is the peak');
  profile.slice(1).forEach(function (row) {
    assert.ok(row.ready >= 1 && row.ready <= 10, 'every later cycle offers between 1 and 10');
  });
});

/* -------------------------------------------------------------- 36.2 */

test('rename examples: the physical register sweep on stride', function () {
  const cycles = function (physical) {
    return summary('stride', { width: 4, physical: physical }).cycles;
  };

  assert.strictEqual(cycles(34), 530, '34 registers, two spare');
  assert.strictEqual(cycles(40), 362, '40');
  assert.strictEqual(cycles(48), 190, '48');
  assert.strictEqual(cycles(64), 126, '64, the default');
  assert.strictEqual(cycles(96), 126, '96 buys nothing more');
  assert.strictEqual(cycles(192), 126, 'and neither does 192');
  assert.strictEqual(round(cycles(34) / cycles(192), 2), 4.21, 'renaming depth is worth 4.21x');
});

test('rename examples: two spare registers is exactly what a file of 34 gives', function () {
  const state = core('chain', { width: 4, physical: 34 }).rename;

  assert.strictEqual(state.physical, 34, 'thirty-four physical registers');
  assert.ok(state.counters.allocated > 0, 'and the machine renamed with them');
  assert.strictEqual(summary('chain', { width: 4, physical: 34 }).cycles, 54,
    'a two-deep rename costs chain 54 cycles against 38');
});

/* -------------------------------------------------------------- 36.3 */

/**
 * The section's fixture, rebuilt here so the test and the page cannot drift.
 * The faulting address comes out of a chain, which is what keeps the faulting
 * instruction at the head of the buffer while the work behind it fills every
 * entry - the obvious version, forty additions and then a fault, drains to
 * three entries before the fault arrives.
 */
function faultFixture(kind) {
  const step = kind === 'unmapped' ? 4 : 1;
  const names = ['t1', 't2', 't3', 't4'];
  const tails = {
    ecall: ['  add a0, a0, t0', '  ecall'],
    illegal: ['  add a0, a0, t0', '  .word 0xffffffff'],
    misalignedLoad: ['  li a0, 0x10000000', '  add a0, a0, t0', '  lw a1, 0(a0)'],
    misalignedStore: ['  li a0, 0x10000000', '  add a0, a0, t0', '  sw a1, 0(a0)'],
    unmapped: ['  li a0, 0x40000000', '  add a0, a0, t0', '  lw a1, 0(a0)']
  };
  const lines = ['  li t0, 0'];

  for (let at = 0; at < 9; at += 1) lines.push('  addi t0, t0, ' + step);
  tails[kind].forEach(function (line) { lines.push(line); });
  for (let at = 0; at < 40; at += 1) {
    lines.push('  addi ' + names[at % 4] + ', zero, ' + (at + 1));
  }
  return lines.concat(['  ecall']).join(NEWLINE);
}

function faultRun(kind) {
  const image = Assembler.assemble(faultFixture(kind), { origin: 0 });
  const built = Core.create({ image: image.bytes, entry: 0, width: 4 });

  Core.run(built, { cycles: 4000, stopOnTrap: true });

  const reference = Reference.create({ image: image.bytes, entry: 0 });

  for (let at = 0; at < built.retired; at += 1) Reference.step(reference);

  let trapAt = -1;

  built.log.forEach(function (row) {
    if (trapAt < 0 && row.events.some(function (event) { return event.kind === 'trap'; })) {
      trapAt = row.cycle;
    }
  });
  return { core: built,
    inFlight: trapAt > 0 ? built.log[trapAt - 1].window.length : 0,
    squashed: built.counters.squashed,
    robSquash: built.log.reduce(function (sum, row) {
      return sum + row.events.filter(function (event) {
        return event.kind === 'squash';
      }).reduce(function (count, event) { return count + event.count; }, 0);
    }, 0),
    differences: Reference.differences(Core.snapshot(built), Reference.snapshot(reference))
      .filter(function (row) { return row.field !== 'pc'; }) };
}

test('rob examples: a misaligned store with the whole buffer behind it', function () {
  const found = faultRun('misalignedStore');

  assert.strictEqual(Traps.read(found.core.traps, Traps.CSR.mcause), 6, 'mcause is 6');
  assert.strictEqual(Traps.read(found.core.traps, Traps.CSR.mepc) >>> 0, 0x34,
    'mepc is 0x34');
  assert.strictEqual(Traps.read(found.core.traps, Traps.CSR.mtval) >>> 0, 0x10000009,
    'and mtval is the offending address');
  assert.strictEqual(found.core.retired, 13, '13 instructions retired');
  assert.strictEqual(found.inFlight, 32, 'with the whole buffer in flight before the trap');
  assert.strictEqual(found.robSquash, 31, 'and 31 buffer entries discarded');
  assert.strictEqual(found.squashed, 39,
    'plus the 8 still sitting in the fetch buffer, which are just as speculative');
  assert.deepStrictEqual(found.differences, [],
    'and the state matches the in-order machine exactly');
});

test('rob reference: all five fault classes, with their causes and their windows',
  function () {
    const expected = {
      ecall: { cause: 11, mepc: 0x2c, inFlight: 32, squashed: 39 },
      illegal: { cause: 2, mepc: 0x2c, inFlight: 2, squashed: 0 },
      misalignedLoad: { cause: 4, mepc: 0x34, inFlight: 32, squashed: 39 },
      misalignedStore: { cause: 6, mepc: 0x34, inFlight: 32, squashed: 39 },
      unmapped: { cause: 5, mepc: 0x34, inFlight: 32, squashed: 39 }
    };

    Object.keys(expected).forEach(function (kind) {
      const found = faultRun(kind);

      assert.strictEqual(Traps.read(found.core.traps, Traps.CSR.mcause),
        expected[kind].cause, kind + ' mcause');
      assert.strictEqual(Traps.read(found.core.traps, Traps.CSR.mepc) >>> 0,
        expected[kind].mepc, kind + ' mepc');
      assert.strictEqual(found.inFlight, expected[kind].inFlight, kind + ' in flight');
      assert.strictEqual(found.squashed, expected[kind].squashed, kind + ' squashed');
      assert.deepStrictEqual(found.differences, [], kind + ' is not precise');
    });
  });

test('rob examples: the window sweep is worth 4.29x on stride and nothing on chain',
  function () {
    const cycles = function (name, capacity) {
      return summary(name, { width: 4, capacity: capacity, physical: 192,
        queueSize: 128 }).cycles;
    };

    assert.strictEqual(cycles('stride', 4), 463, '4 entries');
    assert.strictEqual(cycles('stride', 16), 202, '16');
    assert.strictEqual(cycles('stride', 32), 126, '32');
    assert.strictEqual(cycles('stride', 64), 108, '64');
    assert.strictEqual(cycles('stride', 128), 108, 'and 128 buys nothing more');
    assert.strictEqual(round(cycles('stride', 4) / cycles('stride', 128), 2), 4.29,
      'the window is worth 4.29x on the array walk');
    [4, 8, 16, 32, 64, 128].forEach(function (capacity) {
      assert.strictEqual(cycles('chain', capacity), 38,
        'and exactly nothing on a dependence chain, at ' + capacity + ' entries');
    });
  });

test('rob examples: a deeper window can be slower and is always more wasteful', function () {
  const at = function (capacity) {
    return summary('arrayMax', { width: 4, capacity: capacity, physical: 192,
      queueSize: 128 });
  };

  assert.strictEqual(at(32).cycles, 52, 'arrayMax at 32 entries');
  assert.strictEqual(at(64).cycles, 54, 'and slower at 64');
  assert.strictEqual(at(32).squashed, 92, 'squashing 92 instructions');
  assert.strictEqual(at(64).squashed, 140, 'against 140');
});

/* -------------------------------------------------------------- 36.4 */

test('width examples: independent stops at width 2, and the histogram says why', function () {
  const cycles = function (width) { return summary('independent', { width: width }).cycles; };

  assert.strictEqual(cycles(1), 37, 'width 1');
  assert.strictEqual(round(summary('independent', { width: 1 }).ipc, 3), 0.865, 'IPC 0.865');
  assert.strictEqual(cycles(2), 21, 'width 2');
  assert.strictEqual(cycles(4), 21, 'and no further gain at 4');
  assert.strictEqual(cycles(8), 21, 'or at 8');
  assert.strictEqual(round(cycles(1) / cycles(2), 2), 1.76, 'a gain of 1.76x');

  const profile = View.issueProfile(core('independent', { width: 4 }));
  const two = profile.filter(function (row) { return row.issued === 2; })[0];
  const none = profile.filter(function (row) { return row.issued === 0; })[0];

  assert.strictEqual(two.cycles, 17, '17 cycles issued exactly two');
  assert.strictEqual(none.cycles, 4, 'and 4 issued nothing');
  assert.strictEqual(profile.filter(function (row) { return row.issued > 2; }).length, 0,
    'and never three, because there are two integer ports');

  const ports = View.portUse(core('independent', { width: 4 }));

  assert.strictEqual(ports[0].issued, 17, 'alu0 did 17');
  assert.strictEqual(ports[1].issued, 17, 'and alu1 did 17');
});

test('width reference: the gains across the catalogue run from 1.00x to 2.37x', function () {
  const names = Workloads.names().concat(['sum', 'factorial', 'arrayMax', 'strlen']);
  let best = 0;
  let worst = Infinity;

  names.forEach(function (name) {
    const gain = summary(name, { width: 1 }).cycles / summary(name, { width: 8 }).cycles;

    best = Math.max(best, gain);
    worst = Math.min(worst, gain);
  });
  assert.strictEqual(round(worst, 2), 1, 'chain gains nothing at all');
  assert.strictEqual(round(best, 2), 2.37, 'and alias is the best in the catalogue');
});

test('width reference: chain is flat and chase is nearly flat', function () {
  [1, 2, 4, 8].forEach(function (width) {
    assert.strictEqual(summary('chain', { width: width }).cycles, 38,
      'chain at width ' + width);
  });
  assert.strictEqual(summary('chase', { width: 1 }).cycles, 413, 'chase at width 1');
  assert.strictEqual(summary('chase', { width: 8 }).cycles, 393, 'and at width 8');
});

/* -------------------------------------------------------------- 36.5 */

test('speculation examples: the obvious fixture measures nothing', function () {
  ['alias', 'disjoint'].forEach(function (name) {
    const on = summary(name, { width: 4, memorySpeculation: true });
    const off = summary(name, { width: 4, memorySpeculation: false });

    assert.strictEqual(on.cycles, off.cycles,
      name + ' resolves both addresses before the load is selected');
    assert.strictEqual(off.lsq.waited, 0, 'so no load ever had to wait');
  });
});

test('speculation examples: the fixture that can show it, and what it shows', function () {
  const on = summary('hiddenDisjoint', { width: 4, memorySpeculation: true });
  const off = summary('hiddenDisjoint', { width: 4, memorySpeculation: false });

  assert.strictEqual(off.cycles, 59, 'conservative ordering takes 59 cycles');
  assert.strictEqual(on.cycles, 43, 'and speculation 43');
  assert.strictEqual(off.lsq.waited, 27, 'with 27 load-issue attempts refused');
  assert.strictEqual(on.lsq.waited, 0, 'and none when it may guess');
  assert.strictEqual(on.lsq.misspeculations, 0, 'the guess is always right here');
  assert.strictEqual(round(off.cycles / on.cycles, 2), 1.37, 'a gain of 1.37x');
});

test('speculation examples: being wrong every iteration costs one cycle', function () {
  const on = summary('hiddenAlias', { width: 4, memorySpeculation: true });
  const off = summary('hiddenAlias', { width: 4, memorySpeculation: false });

  assert.strictEqual(off.cycles, 60, 'conservative ordering takes 60 cycles');
  assert.strictEqual(on.cycles, 61, 'and speculating takes 61');
  assert.strictEqual(on.lsq.misspeculations, 2, 'it is wrong twice');
  assert.strictEqual(on.lsq.storeSets, 1, 'and then remembers the load');
  assert.strictEqual(on.lsq.waited, 18, 'so it waits 18 times by prediction');
  assert.strictEqual(off.lsq.waited, 27, 'against 27 by policy');
});

test('speculation reference: the wasted-work figures', function () {
  const wasted = function (name) {
    const found = summary(name, { width: 4 });

    return { retired: found.retired, fetched: found.fetched,
      share: round(100 * found.squashed / found.fetched, 1) };
  };

  assert.deepStrictEqual(wasted('factorial'), { retired: 124, fetched: 323, share: 61 },
    'factorial wastes 61.0%');
  assert.deepStrictEqual(wasted('arrayMax'), { retired: 42, fetched: 136, share: 67.6 },
    'and arrayMax 67.6%');
  assert.strictEqual(wasted('chain').share, 2.8, 'a fixture with no branches wastes 2.8%');
  assert.strictEqual(wasted('strlen').share, 32.7, 'and strlen 32.7%');
});

/* -------------------------------------------------------------- 36.6 */

test('mlp examples: identical misses, 3.90x the cycles', function () {
  const stride = core('stride', Object.assign({ width: 4 }, SMALL));
  const chase = core('chase', Object.assign({ width: 4 }, SMALL));

  assert.strictEqual(Core.summary(stride).cache.misses, 32, 'stride misses 32 times');
  assert.strictEqual(Core.summary(chase).cache.misses, 32, 'and so does chase');
  assert.strictEqual(stride.cycle, 174, 'stride takes 174 cycles');
  assert.strictEqual(chase.cycle, 678, 'and chase 678');
  assert.strictEqual(round(chase.cycle / stride.cycle, 2), 3.9, 'a factor of 3.90');
  assert.strictEqual(round(View.mlp(stride).average, 2), 3.86, 'stride overlaps 3.86 misses');
  assert.strictEqual(View.mlp(chase).average, 1, 'and chase exactly one');
  assert.strictEqual(View.mlp(stride).peak, 4, 'peaking at the four miss registers');
  assert.strictEqual(View.mlp(chase).peak, 1, 'and at one');
});

test('mlp examples: the miss-register sweep, and the program that ignores it', function () {
  const at = function (name, mshrs) {
    const built = core(name, Object.assign({ width: 4, mshrs: mshrs }, SMALL));

    return { cycles: built.cycle, mlp: round(View.mlp(built).average, 2) };
  };

  assert.deepStrictEqual(at('stride', 1), { cycles: 648, mlp: 1 }, 'one register');
  assert.deepStrictEqual(at('stride', 2), { cycles: 332, mlp: 1.98 }, 'two');
  assert.deepStrictEqual(at('stride', 4), { cycles: 174, mlp: 3.86 }, 'four');
  assert.deepStrictEqual(at('stride', 8), { cycles: 128, mlp: 5.41 }, 'eight');
  assert.deepStrictEqual(at('stride', 16), { cycles: 128, mlp: 5.41 }, 'and sixteen');
  assert.strictEqual(round(648 / 128, 2), 5.06, 'a gain of 5.06x');
  [1, 2, 4, 8, 16].forEach(function (mshrs) {
    assert.deepStrictEqual(at('chase', mshrs), { cycles: 678, mlp: 1 },
      'and chase is 678 cycles at ' + mshrs + ' registers');
  });
});

test('mlp examples: overlap needs a window as well as registers', function () {
  const cycles = function (capacity) {
    return core('stride', Object.assign({ width: 4, capacity: capacity, physical: 192,
      queueSize: 128 }, SMALL)).cycle;
  };

  assert.strictEqual(cycles(8), 378, '8 entries cannot run far enough ahead');
  assert.strictEqual(cycles(16), 202, '16');
  assert.strictEqual(cycles(32), 174, 'and 32, where the miss registers become the limit');
});

test('mlp reference: forwarding means the alias fixture never touches the cache', function () {
  const alias = summary('alias', { width: 4 });
  const disjoint = summary('disjoint', { width: 4 });

  assert.strictEqual(alias.lsq.forwarded, 8, 'eight loads forwarded');
  assert.strictEqual(alias.cache.accesses, 0, 'and not one cache access in the whole run');
  assert.strictEqual(disjoint.lsq.forwarded, 0, 'the disjoint pair forwards nothing');
  assert.strictEqual(disjoint.cache.accesses, 10, 'and reaches the cache ten times');
});

/* -------------------------------------------------------------- 36.7 */

function pair(left, right, options) {
  const settings = options || {};
  const machine = Smt.create({ width: 4, cache: SMALL,
    policy: settings.policy || 'icount', partition: settings.partition || 'shared',
    guard: settings.guard || 0, capacity: settings.capacity,
    queueSize: settings.capacity,
    threads: [{ name: left, source: sourceFor(left) },
      { name: right, source: sourceFor(right) }] });

  Smt.run(machine, { cycles: settings.cycles || 60000 });
  return Smt.summary(machine);
}

function soloCycles(name) {
  return core(name, Object.assign({ width: 4 }, SMALL)).cycle;
}

test('smt examples: the gain on a stall-heavy pair and on a saturated one', function () {
  const chain = pair('chain', 'chain');
  const independent = pair('independent', 'independent');

  assert.strictEqual(soloCycles('chain'), 38, 'chain alone is 38 cycles');
  assert.strictEqual(chain.cycles, 48, 'and two of them together take 48');
  assert.strictEqual(round(76 / chain.cycles, 2), 1.58, 'a speed-up of 1.58x');
  assert.strictEqual(round(chain.threads[0].finishedAt / 38, 2), 1.03,
    'thread 0 is 1.03x slower than alone');
  assert.strictEqual(round(chain.threads[1].finishedAt / 38, 2), 1.26, 'and thread 1 1.26x');

  assert.strictEqual(soloCycles('independent'), 21, 'independent alone is 21 cycles');
  assert.strictEqual(independent.cycles, 42, 'and two of them take 42 - exactly sequential');
  assert.strictEqual(round(42 / independent.cycles, 2), 1, 'a speed-up of 1.00x');
  assert.strictEqual(round(independent.threads[0].finishedAt / 21, 2), 1.62,
    'while thread 0 is 1.62x slower');
  assert.strictEqual(round(independent.threads[1].finishedAt / 21, 2), 2,
    'and thread 1 twice as slow');
});

test('smt examples: sharing a cache can make both threads faster', function () {
  const chase = pair('chase', 'chase');

  assert.strictEqual(soloCycles('chase'), 678, 'chase alone is 678 cycles');
  assert.strictEqual(chase.cycles, 385, 'and two of them together take 385');
  assert.strictEqual(round(1356 / chase.cycles, 2), 3.52, 'a speed-up of 3.52x');
  chase.threads.forEach(function (thread) {
    assert.ok(thread.finishedAt < 678,
      'each thread finished sooner than it did alone, because the other warmed the cache');
  });
});

test('smt examples: the two starvation failures and their two fixes', function () {
  const open = pair('chase', 'chain', { policy: 'priority', guard: 0, cycles: 150 });
  const guarded = pair('chase', 'chain', { policy: 'priority', guard: 4, cycles: 150 });

  assert.strictEqual(open.threads[0].retired, 30, 'thread 0 retires 30');
  assert.strictEqual(open.threads[1].retired, 0, 'and thread 1 nothing at all');
  assert.strictEqual(round(open.throughput, 3), 0.2, 'throughput 0.200');
  assert.strictEqual(guarded.threads[0].retired, 30, 'the guard costs thread 0 nothing here');
  assert.strictEqual(guarded.threads[1].retired, 33, 'and gives thread 1 thirty-three');
  assert.strictEqual(round(guarded.throughput, 3), 0.42, 'throughput 0.420');

  const shared = pair('chase', 'chain', { policy: 'priority', guard: 8, capacity: 32,
    cycles: 200 });
  const split = pair('chase', 'chain', { policy: 'priority', guard: 8, capacity: 32,
    partition: 'partitioned', cycles: 200 });

  assert.strictEqual(shared.threads[1].retired, 20, 'a loose guard and a shared window: 20');
  assert.strictEqual(round(shared.throughput, 3), 0.31, 'throughput 0.310');
  assert.strictEqual(split.threads[1].retired, 33, 'and partitioned it recovers to 33');
  assert.strictEqual(round(split.throughput, 3), 0.375, 'throughput 0.375');
});

/* -------------------------------------------------------------- 36.8 */

test('side-channel examples: one reload pass, and the timings it reports', function () {
  const lab = SideChannel.create({ mitigation: 'none', noise: 0 });

  SideChannel.train(lab, 6);
  SideChannel.flushProbes(lab);
  SideChannel.gadget(lab, SideChannel.secretIndex(lab, 0));

  const timings = SideChannel.reload(lab);
  const hits = timings.filter(function (row) { return row.hit; });

  assert.strictEqual(timings.length, 16, 'sixteen probe lines');
  assert.strictEqual(hits.length, 1, 'exactly one is a hit');
  assert.strictEqual(hits[0].cycles, 1, 'at one cycle');
  assert.strictEqual(hits[0].letter, 'C', 'and it is the first character of CAFEBABE');
  timings.filter(function (row) { return !row.hit; }).forEach(function (row) {
    assert.strictEqual(row.cycles, 20, 'and every miss costs twenty');
  });
});

test('side-channel examples: the recovery rates quoted at 30% noise', function () {
  const mean = function (mitigation, rounds) {
    return round(100 * SideChannel.reliability({ mitigation: mitigation, noise: 0.3 },
      { seeds: 8, rounds: rounds }).mean, 1);
  };

  assert.strictEqual(mean('none', 31), 87.5, '31 rounds recovers 87.5%');
  assert.strictEqual(mean('none', 127), 100, 'and 127 rounds the whole secret');
  assert.strictEqual(mean('fence', 127), 7.8, 'the barrier stays at chance');
  assert.strictEqual(mean('mask', 127), 0, 'and masking keeps the secret out entirely');
  assert.strictEqual(round(100 / 16, 2), 6.25, 'chance is 6.25%');
});

test('side-channel examples: masking leaks the public array, deterministically', function () {
  const found = SideChannel.recover(SideChannel.create({ mitigation: 'mask', noise: 0 }));

  assert.strictEqual(found.recovered, 'ABCDEFGH',
    'the in-bounds values, through a channel that still works perfectly');
  assert.strictEqual(found.accuracy, 0, 'and not one character of the secret');
});

test('side-channel examples: prime and probe, and its ambiguity', function () {
  const lab = SideChannel.create({});
  const found = SideChannel.primeProbe(lab, 0);
  const narrow = SideChannel.ambiguity(SideChannel.create({
    cache: { sets: 8, ways: 4, lineBytes: 64, hitCycles: 1, missCycles: 20 } }));

  assert.deepStrictEqual(found.evicted.map(function (row) { return row.set; }), [0, 2],
    'two sets lost a line');
  assert.deepStrictEqual(found.candidates, ['A', 'C'], 'giving two candidates');
  assert.strictEqual(found.expected, 'C', 'and the right answer is one of them');
  assert.strictEqual(narrow.collisions, 8, 'halving the sets collides eight of them');
  assert.strictEqual(narrow.worst, 2, 'with two values each');
});

/* -------------------------------------------------------------- 36.9 */

function shares(name, options) {
  const found = Topdown.classify(core(name, options));
  const percent = function (key) { return round(100 * found.shares[key], 1); };

  return { retiring: percent('retiring'), badSpeculation: percent('badSpeculation'),
    frontEnd: percent('frontEnd'), backEnd: percent('backEnd') };
}

test('topdown examples: chase on a small cache, and the change that fixes it', function () {
  const options = Object.assign({ width: 4 }, SMALL);
  const built = core('chase', options);
  const found = Topdown.classify(built);

  assert.strictEqual(built.cycle, 678, '678 cycles');
  assert.strictEqual(found.slots, 2712, 'and 4 x 678 = 2712 slots');
  assert.deepStrictEqual(shares('chase', options),
    { retiring: 4.9, badSpeculation: 0.7, frontEnd: 22.3, backEnd: 72.1 },
    'the four shares');
  assert.strictEqual(found.dominant.key, 'backEnd', 'back-end bound');
  assert.match(found.dominant.detail[0].reason, /reorder buffer is full/,
    'and the buffer is the reason');

  const after = shares('stride', options);

  assert.strictEqual(core('stride', options).cycle, 174, 'stride takes 174 cycles');
  assert.strictEqual(after.retiring, 23.7, 'retiring rises to 23.7%');
  assert.strictEqual(after.backEnd, 60.2, 'and back-end bound falls to 60.2%');
});

test('topdown examples: three programs, three verdicts, one machine', function () {
  const verdict = function (name) {
    return Topdown.classify(core(name, { width: 4 })).dominant.key;
  };

  assert.strictEqual(summary('chase', { width: 4 }).cycles, 393, 'chase: 393 cycles');
  assert.strictEqual(shares('chase', { width: 4 }).retiring, 8.5, '8.5% retiring');
  assert.strictEqual(shares('chase', { width: 4 }).backEnd, 85.7, 'and 85.7% back-end bound');
  assert.strictEqual(verdict('chase'), 'backEnd', 'so the verdict is the back end');

  assert.strictEqual(summary('factorial', { width: 4 }).cycles, 107, 'factorial: 107 cycles');
  assert.strictEqual(shares('factorial', { width: 4 }).retiring, 29.2, '29.2% retiring');
  assert.strictEqual(shares('factorial', { width: 4 }).badSpeculation, 51.2,
    'and 51.2% bad speculation');
  assert.strictEqual(verdict('factorial'), 'badSpeculation', 'so the verdict is speculation');

  assert.strictEqual(summary('strlen', { width: 4 }).cycles, 34, 'strlen: 34 cycles');
  assert.strictEqual(shares('strlen', { width: 4 }).retiring, 23.5, '23.5% retiring');
  assert.strictEqual(shares('strlen', { width: 4 }).frontEnd, 48.5,
    'and 48.5% front-end bound');
  assert.strictEqual(verdict('strlen'), 'frontEnd', 'so the verdict is the front end');

  assert.strictEqual(round(summary('chase', { width: 4 }).ipc, 3), 0.338, 'chase IPC');
  assert.strictEqual(round(summary('factorial', { width: 4 }).ipc, 3), 1.159, 'factorial IPC');
  assert.strictEqual(round(summary('strlen', { width: 4 }).ipc, 3), 0.912, 'strlen IPC');
});

test('topdown reference: arrayMax and the branchy programs land in bad speculation',
  function () {
    assert.strictEqual(shares('arrayMax', { width: 4 }).badSpeculation, 47.1,
      'arrayMax spends 47.1% of its slots on work it threw away');
  });
