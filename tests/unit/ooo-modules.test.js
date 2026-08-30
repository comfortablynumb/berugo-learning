'use strict';

/**
 * The M36 machinery, checked against something that is not itself.
 *
 * Three checks carry this suite and the rest are detail.
 *
 * The first is the differential. The out-of-order core has its own register
 * file, its own memory ordering and its own commit rule, and shares only the
 * instruction table with the M34 behavioural simulator; running both on every
 * program under every configuration and comparing the architectural state is
 * the only check that can catch a machine that is fast and wrong. It has to be
 * swept over the width, because two of the bugs this file found were correct at
 * width 1 and broken at width 2.
 *
 * The second is the ILP bound, and it exists because the differential cannot
 * see a timing bug at all - both machines still compute the right answer. The
 * dependence graph is derived from the program rather than from the machine,
 * so a measured IPC above it is a defect no correctness test could find.
 *
 * The third is the top-down accounting. Every issue slot is charged to exactly
 * one of four categories, so the four have to sum to the budget on every
 * program; a classifier that does not reconcile is describing the machine
 * rather than measuring it.
 */

const test = require('node:test');
const assert = require('node:assert');

const Core = require('../../src/js/machines/ooo-core.js');
const Cache = require('../../src/js/machines/ooo/cache.js');
const Rename = require('../../src/js/machines/ooo/rename.js');
const Rob = require('../../src/js/machines/ooo/rob.js');
const Scheduler = require('../../src/js/machines/ooo/scheduler.js');
const Lsq = require('../../src/js/machines/ooo/lsq.js');
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
const Devices = require('../../src/js/machines/brv32/devices.js');

const SMALL = { sets: 8, ways: 1, lineBytes: 32 };
const REAL = ['sum', 'factorial', 'arrayMax', 'strlen', 'console'];

const CONFIGS = [
  { label: 'default', options: {} },
  { label: 'width 1', options: { width: 1 } },
  { label: 'width 2', options: { width: 2 } },
  { label: 'width 8', options: { width: 8 } },
  { label: 'a tiny window', options: { capacity: 8 } },
  { label: 'few physical registers', options: { physical: 40 } },
  { label: 'conservative memory', options: { memorySpeculation: false } },
  { label: 'a short load/store queue', options: { lsqSize: 4 } },
  { label: 'one miss register', options: { mshrs: 1 } },
  { label: 'a small cache', options: SMALL }
];

function sourceFor(name) {
  const fixture = Workloads.get(name);

  return fixture ? fixture.source : Programs.CATALOGUE[name].source;
}

function imageFor(name) {
  return Assembler.assemble(sourceFor(name), { origin: 0 }).bytes;
}

function run(name, options) {
  const core = Core.create(Object.assign({ image: imageFor(name), entry: 0 },
    options || {}));

  Core.run(core, { cycles: 40000, stopOnTrap: true });
  return core;
}

/**
 * The program counter is excluded on purpose. The out-of-order machine takes
 * the closing trap and lands on the handler vector; the reference is stepped
 * only as many times as the other machine retired, so it is standing one
 * instruction short of that trap. Every other field is comparable.
 */
function differences(name, core) {
  const reference = Reference.create({ image: imageFor(name), entry: 0 });

  for (let at = 0; at < core.retired; at += 1) Reference.step(reference);
  return Reference.differences(Core.snapshot(core), Reference.snapshot(reference))
    .filter(function (row) { return row.field !== 'pc'; });
}

const NAMES = Workloads.names().concat(REAL);

/* ------------------------------------------------------- the differential */

NAMES.forEach(function (name) {
  test('ooo: ' + name + ' agrees with the in-order reference in every configuration',
    function () {
      CONFIGS.forEach(function (config) {
        const core = run(name, config.options);

        assert.deepStrictEqual(differences(name, core), [],
          name + ' under ' + config.label + ' disagrees with the behavioural simulator');
        assert.ok(core.retired > 0, name + ' under ' + config.label + ' retired nothing');
        assert.ok(core.cycle < 40000, name + ' under ' + config.label + ' never terminated');
      });
    });
});

/* ------------------------------------------------------------ the bound */

test('ooo: the measured IPC never exceeds the dependence bound', function () {
  NAMES.forEach(function (name) {
    const rows = Trace.ofSource(sourceFor(name)).rows;
    const unit = Ilp.analyse(rows, { unitLatency: true });
    const machine = Ilp.analyse(rows, {});

    [1, 2, 4, 8].forEach(function (width) {
      const summary = Core.summary(run(name, { width: width }));

      assert.ok(Ilp.respects(unit.ilp, summary.ipc),
        name + ' at width ' + width + ' reports IPC ' + summary.ipc.toFixed(3) +
        ' against a unit-latency bound of ' + unit.ilp.toFixed(3));
      assert.ok(Ilp.respects(machine.ilp, summary.ipc),
        name + ' at width ' + width + ' exceeds the machine-latency bound');
    });
  });
});

test('ilp: renaming is what separates the chain fixture from its pair', function () {
  const chain = Trace.ofSource(sourceFor('chain')).rows;
  const independent = Trace.ofSource(sourceFor('independent')).rows;
  const options = { unitLatency: true };

  assert.strictEqual(Ilp.analyse(chain, options).criticalPath, chain.length,
    'every instruction in the chain waits for the one before');
  assert.strictEqual(Ilp.analyse(independent, options).ilp, independent.length,
    'and none of the independent ones waits for anything');
  assert.strictEqual(
    Ilp.analyse(independent, { unitLatency: true, model: 'unrenamed' }).ilp, 4,
    'without renaming, eight writes to each of four names serialise it');
});

test('ilp: the two name dependences are the only ones renaming removes', function () {
  const rows = [
    { id: 0, reads: [], writes: 5, latency: 1, address: null, access: null },
    { id: 1, reads: [5], writes: 6, latency: 1, address: null, access: null },
    { id: 2, reads: [], writes: 5, latency: 1, address: null, access: null }
  ];
  const counts = Ilp.analyse(rows, {}).counts;

  assert.strictEqual(counts.raw, 1, 'instruction 1 reads what 0 wrote');
  assert.strictEqual(counts.waw, 1, 'instruction 2 overwrites what 0 wrote');
  assert.strictEqual(counts.war, 1, 'and it overwrites what 1 read');
});

test('ilp: a memory dependence needs the addresses, not the opcodes', function () {
  const same = [
    { id: 0, reads: [], writes: null, latency: 1, address: 256, access: 'write' },
    { id: 1, reads: [], writes: 5, latency: 2, address: 256, access: 'read' }
  ];
  const apart = [
    { id: 0, reads: [], writes: null, latency: 1, address: 256, access: 'write' },
    { id: 1, reads: [], writes: 5, latency: 2, address: 512, access: 'read' }
  ];

  assert.strictEqual(Ilp.analyse(same, {}).criticalPath, 3, 'the load waits for the store');
  assert.strictEqual(Ilp.analyse(apart, {}).criticalPath, 2, 'and here it does not');
  assert.strictEqual(Ilp.analyse(apart, { model: 'conservative' }).criticalPath, 3,
    'a machine that cannot disambiguate has to make it wait anyway');
});

/* ------------------------------------------------------------- top-down */

test('topdown: the four categories account for every issue slot', function () {
  NAMES.forEach(function (name) {
    [1, 4, 8].forEach(function (width) {
      const core = run(name, { width: width });
      const found = Topdown.classify(core);
      const total = found.rows.reduce(function (sum, row) { return sum + row.slots; }, 0);

      assert.strictEqual(total, width * core.log.length,
        name + ' at width ' + width + ' charges ' + total + ' of ' +
        (width * core.log.length) + ' slots');
      assert.strictEqual(found.reconciles, true, name + ' does not reconcile');
    });
  });
});

test('topdown: the shares sum to one within rounding', function () {
  const found = Topdown.classify(run('chase', Object.assign({ width: 4 }, SMALL)));
  const total = Object.keys(found.shares).reduce(function (sum, key) {
    return sum + found.shares[key];
  }, 0);

  assert.ok(Math.abs(total - 1) < 1e-9, 'the shares sum to ' + total);
  assert.strictEqual(found.dominant.key, 'backEnd',
    'a pointer chase on a small cache is back-end bound');
});

test('topdown: a trapping instruction is retiring, not bad speculation', function () {
  const log = [
    { cycle: 0, events: [{ kind: 'dispatch', id: 0 }], window: [] },
    { cycle: 1, events: [{ kind: 'trap', id: 0 }], window: [] }
  ];
  const found = Topdown.classify({ log: log, config: { width: 1 } });

  assert.strictEqual(found.rows[0].slots, 1, 'it reaches the head of the buffer and commits');
  assert.strictEqual(found.rows[0].key, 'retiring', 'and that is the retiring category');
});

/* -------------------------------------------------------- the structures */

test('cache: probe observes and access disturbs', function () {
  const cache = Cache.create({ sets: 4, ways: 1, lineBytes: 16 });

  assert.strictEqual(Cache.probe(cache, 0).hit, false, 'nothing is resident yet');
  assert.strictEqual(Cache.probe(cache, 0).hit, false, 'and probing did not install it');
  Cache.access(cache, 0);
  assert.strictEqual(Cache.probe(cache, 0).hit, true, 'accessing did');
  Cache.flush(cache, 0);
  assert.strictEqual(Cache.probe(cache, 0).hit, false, 'and a flush evicts exactly that line');
});

test('cache: a set holds no more than its ways, and evicts the least recently used',
  function () {
    const cache = Cache.create({ sets: 1, ways: 2, lineBytes: 16 });

    Cache.access(cache, 0);
    Cache.access(cache, 16);
    Cache.access(cache, 0);
    Cache.access(cache, 32);
    assert.strictEqual(Cache.probe(cache, 16).hit, false, 'the oldest use went');
    assert.strictEqual(Cache.probe(cache, 0).hit, true, 'and the one touched again stayed');
  });

test('rename: a freed register comes back whatever its number', function () {
  const state = Rename.create({ physical: 34 });
  const history = [];

  for (let at = 0; at < 50; at += 1) {
    if (history.length >= 2) Rename.release(state, history.shift().old);
    const dest = Rename.allocate(state, 1 + (at % 4));

    assert.ok(dest, 'no free physical register at step ' + at + ' - the pool is leaking');
    history.push(dest);
  }
});

test('rename: physical register zero is never handed out', function () {
  const state = Rename.create({ physical: 40 });

  Rename.release(state, 0);
  assert.strictEqual(state.free.indexOf(0), -1, 'x0 must always read zero');
});

test('rename: a checkpoint keeps registers freed while the branch was in flight',
  function () {
    const state = Rename.create({ physical: 40 });
    const dest = Rename.allocate(state, 5);

    Rename.checkpoint(state, 99);
    Rename.release(state, dest.old);
    Rename.restore(state, 99);
    assert.ok(state.free.indexOf(dest.old) !== -1,
      'a register freed by a commit is free in every future, including a restored one');
  });

test('rename: unwinding restores the mapping the checkpoint would have', function () {
  const state = Rename.create({ physical: 48 });
  const before = state.table.slice();
  const first = Rename.allocate(state, 5);
  const second = Rename.allocate(state, 6);

  Rename.unwind(state, [{ arch: 6, phys: second.phys, old: second.old },
    { arch: 5, phys: first.phys, old: first.old }]);
  assert.deepStrictEqual(state.table, before, 'youngest first, and the table is back');
  assert.ok(state.free.indexOf(first.phys) !== -1, 'and both registers are free again');
});

test('rob: commit is in order however completion happened', function () {
  const rob = Rob.create({ capacity: 8 });

  [0, 1, 2].forEach(function (id) {
    Rob.dispatch(rob, { id: id, state: 'dispatched' });
  });
  rob.entries[2].state = 'completed';
  assert.strictEqual(Rob.canCommit(rob), false, 'the youngest finished first, and waits');
  rob.entries[0].state = 'completed';
  assert.strictEqual(Rob.canCommit(rob), true, 'and now the head may go');
});

test('rob: an inclusive squash removes the named entry as well', function () {
  const rob = Rob.create({ capacity: 8 });

  [0, 1, 2, 3].forEach(function (id) { Rob.dispatch(rob, { id: id }); });
  assert.strictEqual(Rob.squashAfter(rob, 1).length, 2, 'everything younger than 1');
  assert.strictEqual(rob.entries.length, 2, 'and 0 and 1 survive');
  assert.strictEqual(Rob.squashInclusive(rob, 1).length, 1, 'and now 1 goes too');
});

test('scheduler: a pipelined port takes one operation per cycle whatever the latency',
  function () {
    const scheduler = Scheduler.create({ width: 4 });
    const load = function (id) {
      return { id: id, kind: 'load', ready: true, sources: [], latency: 2 };
    };

    Scheduler.enqueue(scheduler, load(0));
    Scheduler.enqueue(scheduler, load(1));
    assert.strictEqual(Scheduler.select(scheduler, 0).length, 1, 'one memory port');
    assert.strictEqual(Scheduler.select(scheduler, 1).length, 1,
      'and it is free again the next cycle, despite a two-cycle latency');
  });

test('scheduler: every instruction kind has a port that can serve it', function () {
  ['alu', 'load', 'store', 'branch', 'jump', 'system'].forEach(function (kind) {
    const scheduler = Scheduler.create({});

    assert.ok(Scheduler.hasPortFor(scheduler, kind),
      'nothing can issue a ' + kind + ', so the machine would deadlock on one');
  });
});

test('lsq: a load waits for an unresolved store only when told to speculate is off',
  function () {
    const careful = Lsq.create({ memorySpeculation: false });
    const eager = Lsq.create({});

    [careful, eager].forEach(function (lsq) {
      Lsq.allocate(lsq, { id: 0, kind: 'store', pc: 16 });
      Lsq.allocate(lsq, { id: 1, kind: 'load', pc: 20 });
    });
    assert.strictEqual(Lsq.loadMayIssue(careful, 1).ok, false, 'conservative ordering');
    assert.strictEqual(Lsq.loadMayIssue(eager, 1).ok, true, 'and the guess');
  });

test('lsq: a store that lands on a completed younger load reports the offender', function () {
  const lsq = Lsq.create({});

  Lsq.allocate(lsq, { id: 0, kind: 'store', pc: 16 });
  Lsq.allocate(lsq, { id: 1, kind: 'load', pc: 20 });
  Lsq.resolveLoad(lsq, 1, 256);
  Lsq.complete(lsq, 1, 7);

  const offenders = Lsq.resolveStore(lsq, 0, 256, 9);

  assert.strictEqual(offenders.length, 1, 'the load read an address the store then wrote');
  assert.strictEqual(Lsq.loadMayIssue(lsq, 1).ok, true,
    'the queue entry is still there; the store set is what makes it wait next time');
  assert.strictEqual(Object.keys(lsq.storeSets).length, 1, 'and that load is remembered');
});

test('lsq: a miss with every register busy cannot start', function () {
  const lsq = Lsq.create({ mshrs: 1 });
  const cache = Cache.create({ sets: 4, ways: 1, lineBytes: 16 });

  assert.strictEqual(Lsq.begin(lsq, cache, 0, 0).ok, true, 'the first miss takes the register');
  assert.strictEqual(Lsq.begin(lsq, cache, 64, 0).ok, false, 'and the second cannot start');
  Lsq.retire(lsq, 100);
  assert.strictEqual(Lsq.begin(lsq, cache, 64, 100).ok, true, 'until the first returns');
});

/* --------------------------------------------------- memory parallelism */

test('mlp: the same misses, overlapped or not', function () {
  const stride = run('stride', Object.assign({ width: 4 }, SMALL));
  const chase = run('chase', Object.assign({ width: 4 }, SMALL));

  assert.strictEqual(Core.summary(stride).cache.misses,
    Core.summary(chase).cache.misses,
    'the fixtures are built to miss the same number of times');
  assert.ok(View.mlp(stride).average > 3, 'the array overlaps its misses');
  assert.strictEqual(View.mlp(chase).average, 1,
    'and the chase cannot overlap two, ever');
  assert.ok(chase.cycle > 3 * stride.cycle,
    'which is worth more than three times the cycles');
});

test('mlp: miss registers help the array and do nothing for the chase', function () {
  const cycles = function (name, mshrs) {
    return run(name, Object.assign({ width: 4, mshrs: mshrs }, SMALL)).cycle;
  };

  assert.ok(cycles('stride', 8) < cycles('stride', 1) / 4,
    'eight registers against one is worth more than four times on the array');
  assert.strictEqual(cycles('chase', 8), cycles('chase', 1),
    'and exactly nothing on the chase');
});

test('mlp: the measured parallelism never exceeds the registers available', function () {
  [1, 2, 4, 8].forEach(function (mshrs) {
    const core = run('stride', Object.assign({ width: 4, mshrs: mshrs }, SMALL));

    assert.ok(View.mlp(core).peak <= mshrs,
      'peaked at ' + View.mlp(core).peak + ' with ' + mshrs + ' registers');
  });
});

/* -------------------------------------------------- precise exceptions */

test('ooo: five fault classes, each raised with the window full, are precise', function () {
  const names = ['t0', 't1', 't2', 't3'];
  const prelude = ['  # fill the window'];

  for (let at = 0; at < 40; at += 1) {
    prelude.push('  addi ' + names[at % 4] + ', zero, ' + (at + 1));
  }
  Object.keys(Programs.FAULTS).forEach(function (kind) {
    const source = prelude.join('\n') + '\n' + Programs.FAULTS[kind] + '\n  ecall';
    const image = Assembler.assemble(source, { origin: 0 });
    const core = Core.create({ image: image.bytes, entry: 0, width: 4, physical: 128,
      queueSize: 64 });

    Core.run(core, { cycles: 4000, stopOnTrap: true });

    const reference = Reference.create({ image: image.bytes, entry: 0 });

    for (let at = 0; at < core.retired; at += 1) Reference.step(reference);
    assert.deepStrictEqual(
      Reference.differences(Core.snapshot(core), Reference.snapshot(reference))
        .filter(function (row) { return row.field !== 'pc'; }), [],
      kind + ' leaves a state the in-order machine could not have produced');
    assert.ok(core.traps.taken.length, kind + ' never trapped at all');
    assert.ok(Math.max.apply(null, core.log.map(function (row) {
      return row.window.length;
    })) > 16, kind + ' was raised into an empty machine, which proves nothing');
  });
});

test('ooo: a misaligned store faults without ever writing memory', function () {
  const source = '  li a0, 0x10000002\n  li a1, 0x1234\n  sw a1, 0(a0)\n  ecall';
  const image = Assembler.assemble(source, { origin: 0 });
  const core = Core.create({ image: image.bytes, entry: 0, width: 4 });

  Core.run(core, { cycles: 400, stopOnTrap: true });
  assert.strictEqual(core.traps.taken[0].cause, Devices.CAUSE.misalignedStore,
    'checking a store by attempting the write means it never faults at all');
  assert.strictEqual(Devices.read(core.memory, 0x10000000, 4, false).value, 0,
    'and nothing was written');
});

/* ------------------------------------------------------------ the trace */

test('trace: one row per retired instruction, with the addresses the run produced',
  function () {
    const trace = Trace.ofSource(sourceFor('stride'));
    const loads = trace.rows.filter(function (row) { return row.kind === 'load'; });

    assert.ok(trace.rows.length > 100, 'a loop executed many times is many rows');
    assert.ok(loads.length > 0, 'and the loads are classified as loads');
    loads.forEach(function (row) {
      assert.strictEqual(typeof row.address, 'number', 'every load records its address');
      assert.strictEqual(row.access, 'read', 'and which direction it went');
    });
    assert.match(trace.stopped, /trap/, 'the trace stops at the closing trap');
  });

/* --------------------------------------------------------------- SMT */

function smt(spec) {
  const machine = Smt.create({ width: 4, cache: SMALL, policy: spec.policy,
    partition: spec.partition, guard: spec.guard, capacity: spec.capacity,
    queueSize: spec.capacity,
    threads: [{ name: 'a', source: sourceFor(spec.left) },
      { name: 'b', source: sourceFor(spec.right) }] });

  Smt.run(machine, { cycles: spec.cycles });
  return Smt.summary(machine);
}

test('smt: strict priority starves the second thread, and the guard stops it', function () {
  const starved = smt({ left: 'chase', right: 'chain', policy: 'priority', guard: 0,
    partition: 'shared', cycles: 150 });
  const guarded = smt({ left: 'chase', right: 'chain', policy: 'priority', guard: 4,
    partition: 'shared', cycles: 150 });

  assert.strictEqual(starved.threads[1].retired, 0,
    'an unguarded priority policy gives thread 1 nothing at all');
  assert.ok(guarded.threads[1].retired > 0, 'and the guard fixes exactly that');
  assert.ok(guarded.threads[1].longestStarve <= 4, 'within the bound it promises');
  assert.ok(guarded.throughput > starved.throughput, 'and the pair goes faster for it');
});

test('smt: fair policies never starve a thread, on any of these pairs', function () {
  ['icount', 'roundRobin'].forEach(function (policy) {
    [['chase', 'chain'], ['chain', 'independent'], ['stride', 'chase']].forEach(function (pair) {
      const found = smt({ left: pair[0], right: pair[1], policy: policy, guard: 0,
        partition: 'shared', cycles: 200 });

      assert.strictEqual(found.starved, 0,
        policy + ' starved a thread on ' + pair.join(' + '));
    });
  });
});

test('smt: partitioning protects a thread the guard alone cannot', function () {
  const shared = smt({ left: 'chase', right: 'chain', policy: 'priority', guard: 8,
    partition: 'shared', capacity: 32, cycles: 200 });
  const split = smt({ left: 'chase', right: 'chain', policy: 'priority', guard: 8,
    partition: 'partitioned', capacity: 32, cycles: 200 });

  assert.ok(split.threads[1].retired > shared.threads[1].retired,
    'a stalled thread holding the whole window blocks the other at dispatch');
  assert.ok(split.throughput > shared.throughput, 'and the pair loses throughput for it');
});

test('smt: two threads on one core beat running them one after the other', function () {
  const together = smt({ left: 'chain', right: 'chain', policy: 'icount', guard: 0,
    partition: 'shared', cycles: 60000 });
  const alone = Core.summary(run('chain', Object.assign({ width: 4 }, SMALL))).cycles;

  assert.ok(together.cycles < 2 * alone, 'the whole point of SMT');
  assert.ok(together.cycles > alone, 'and each thread is slower than it was alone');
});

/* -------------------------------------------------------- side channel */

test('side channel: the unmitigated receiver recovers the secret', function () {
  const found = SideChannel.recover(SideChannel.create({ mitigation: 'none', noise: 0 }));

  assert.strictEqual(found.recovered, found.mitigation === 'none' ? 'CAFEBABE' : '',
    'a noiseless channel is exact');
  assert.strictEqual(found.accuracy, 1, 'every character');
});

test('side channel: the leak needs the misprediction, not merely the code', function () {
  const untrained = SideChannel.recover(SideChannel.create({ mitigation: 'none', noise: 0,
    train: 0 }));

  assert.strictEqual(untrained.accuracy, 0,
    'without training the bounds check is predicted correctly and nothing speculates');
  assert.strictEqual(untrained.counters.speculated, 0, 'no speculative access happened');
});

test('side channel: repetition beats noise, and the mitigation stays at chance', function () {
  const options = { noise: 0.3 };
  const open = SideChannel.reliability(Object.assign({ mitigation: 'none' }, options),
    { seeds: 8, rounds: 127 });
  const fenced = SideChannel.reliability(Object.assign({ mitigation: 'fence' }, options),
    { seeds: 8, rounds: 127 });
  const masked = SideChannel.reliability(Object.assign({ mitigation: 'mask' }, options),
    { seeds: 8, rounds: 127 });

  assert.ok(open.mean > 0.9, 'the channel recovers the secret reliably: ' + open.mean);
  assert.ok(fenced.mean < 4 * open.chance,
    'the barrier leaves the receiver at chance: ' + fenced.mean);
  assert.ok(masked.mean < 4 * open.chance,
    'and masking keeps the secret out of the channel: ' + masked.mean);
});

test('side channel: one round is not enough once there is noise', function () {
  const once = SideChannel.reliability({ mitigation: 'none', noise: 0.3 },
    { seeds: 8, rounds: 1 });
  const many = SideChannel.reliability({ mitigation: 'none', noise: 0.3 },
    { seeds: 8, rounds: 31 });

  assert.ok(once.mean < many.mean, 'repetition is what makes a noisy channel reliable');
});

test('side channel: prime and probe reports its ambiguity rather than hiding it', function () {
  const wide = SideChannel.ambiguity(SideChannel.create({}));
  const narrow = SideChannel.ambiguity(SideChannel.create({
    cache: { sets: 8, ways: 4, lineBytes: 64, hitCycles: 1, missCycles: 20 } }));

  assert.strictEqual(wide.collisions, 0, 'one value per set on this geometry');
  assert.ok(narrow.collisions > 0, 'and two values per set on half the sets');
  assert.strictEqual(narrow.worst, 2, 'so every reading has two answers');
});

test('side channel: prime and probe finds the victim\'s set among its candidates',
  function () {
    const lab = SideChannel.create({});
    const found = SideChannel.primeProbe(lab, 0);

    assert.ok(found.evicted.length > 0, 'the victim evicted something');
    assert.ok(found.candidates.indexOf(found.expected) !== -1,
      'and the right answer is in the candidate list');
  });
