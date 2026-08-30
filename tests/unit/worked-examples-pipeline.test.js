'use strict';

/**
 * Every figure the M35 content quotes, recomputed from the pipeline, the
 * predictors and the depth model, and then checked against the prose.
 *
 * The pipeline runs are the expensive part, so each configuration is built
 * once and shared. Nothing here re-derives a number the modules already
 * report: the point is to run the same code the demo runs and assert the
 * prose still quotes what it produced.
 */

const test = require('node:test');
const assert = require('node:assert');

const Pipeline = require('../../src/js/machines/brv32/pipeline.js');
const Predictors = require('../../src/js/machines/brv32/predictors.js');
const Traces = require('../../src/js/machines/brv32/branch-traces.js');
const Model = require('../../src/js/machines/pipeline-model.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Programs = require('../../src/js/machines/brv32/programs.js');
const Devices = require('../../src/js/machines/brv32/devices.js');

require('../../src/js/content/concepts-pipeline.js');
require('../../src/js/content/examples-pipeline.js');
require('../../src/js/content/concepts-pipeline-control.js');
require('../../src/js/content/examples-pipeline-control.js');
require('../../src/js/content/concepts-pipeline-limits.js');
require('../../src/js/content/examples-pipeline-limits.js');
const prose = require('../support/worked-example-prose.js');

const SINGLE_PERIOD = 178;
const STAGE_PERIOD = 151;
const BALANCED_PERIOD = 38;

function run(name, options) {
  const image = Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });
  const machine = Pipeline.create(Object.assign({ image: image.bytes, entry: 0 }, options));

  Pipeline.run(machine, { cycles: 4000, stopOnTrap: true });
  return Pipeline.summary(machine);
}

/* -------------------------------------------------- 35.1 fundamentals */

test('pipelining: this datapath is slower pipelined, and 3.9x faster balanced', function () {
  const summary = run('sum', { predictor: 'bimodal' });

  assert.strictEqual(summary.retired, 43, 'the sum program');
  assert.strictEqual(summary.cycles, 52, 'takes 52 cycles');
  assert.strictEqual(Number(summary.ipc.toFixed(3)), 0.827, 'an IPC of 0.827');
  assert.strictEqual(summary.retired * SINGLE_PERIOD, 7654, 'single cycle');
  assert.strictEqual(summary.cycles * STAGE_PERIOD, 7852, 'pipelined as built — slower');
  assert.strictEqual(summary.cycles * BALANCED_PERIOD, 1976, 'and balanced');
  assert.strictEqual(Number((7654 / 1976).toFixed(1)), 3.9, 'which is 3.9 times faster');

  prose.quotes('pipelining-fundamentals',
    ['43 instructions x 178 gate delays = 7 654',
      '52 cycles for 43 instructions — an IPC of 0.827',
      '52 x 151 = 7 852 against 7 654 — pipelining lost by 3%',
      '175 / 5 + 3 = 38 a stage, so 52 x 38 = 1 976 — 3.9 times faster']);
});

test('pipelining: the cycle attribution reconciles exactly', function () {
  const summary = run('sum', { predictor: 'bimodal' });

  assert.strictEqual(summary.traps, 1, 'the closing ecall');
  assert.strictEqual(summary.causes['filling the pipeline'], 4, 'four of fill');
  assert.strictEqual(summary.causes.flush, 4, 'and four of flush');
  assert.strictEqual(summary.causes.stall, undefined, 'with no stalls at all');
  assert.strictEqual(43 + 1 + 4 + 4, summary.cycles, 'and they sum to the cycle count');
  assert.strictEqual(summary.reconciles, true, 'which the summary asserts');

  prose.quotes('pipelining-fundamentals',
    ['43 + 1 + 4 + 4 = 52, which is the cycle count exactly',
      '52 cycles = 43 retired + 1 trap + 4 of fill + 4 of flush']);
});

/* ------------------------------------------------- 35.2 structural */

test('structural: what a second memory port is worth, per program', function () {
  const expected = { sum: [52, 52, 0], arrayMax: [65, 62, 3], strlen: [51, 46, 5],
    factorial: [177, 161, 16] };

  Object.keys(expected).forEach(function (name) {
    const unified = run(name, { predictor: 'bimodal', unifiedMemory: true });
    const split = run(name, { predictor: 'bimodal' });
    const want = expected[name];

    assert.strictEqual(unified.cycles, want[0], name + ' with one memory');
    assert.strictEqual(split.cycles, want[1], name + ' with two');
    assert.strictEqual(unified.cycles - split.cycles, want[2], name + ' cost of sharing');
  });
  assert.strictEqual(Number((100 * 5 / 46).toFixed(1)), 10.9, 'strlen pays 10.9%');
  assert.strictEqual(Number((100 * 16 / 161).toFixed(1)), 9.9, 'and the factorial 9.9%');

  prose.quotes('structural-hazards',
    ['6 memory instructions: 65 cycles unified against 62 split — 3 cycles',
      '6 memory instructions: 51 against 46 — 5 cycles, or 10.9%',
      '19 memory instructions: 177 against 161 — 16 cycles, or 9.9%']);
});

/* ------------------------------------------- 35.3 data hazards */

const FIXTURES = {
  chain: ['  li a0, 1', '  addi a1, a0, 4', '  addi a2, a1, 10', '  addi a3, a2, 15',
    '  ecall'],
  double: ['  li a0, 1', '  li a1, 2', '  add a2, a0, a1', '  addi a2, a2, 10',
    '  add a3, a2, a0', '  ecall'],
  loaduse: ['  li a0, 0x10000000', '  li a1, 42', '  sw a1, 0(a0)', '  lw a2, 0(a0)',
    '  addi a3, a2, 1', '  ecall'],
  scheduled: ['  li a0, 0x10000000', '  li a1, 42', '  sw a1, 0(a0)', '  lw a2, 0(a0)',
    '  li a4, 99', '  addi a3, a2, 1', '  ecall'],
  independent: ['  li a0, 1', '  li a1, 2', '  li a2, 3', '  li a3, 4', '  ecall']
};

const UNITS = { full: {}, naive: { naiveForwarding: true }, none: { forwarding: false } };

function fixture(name, unit) {
  const image = Assembler.assemble(FIXTURES[name].join('\n'), { origin: 0 });
  const machine = Pipeline.create(Object.assign({ image: image.bytes, entry: 0 },
    UNITS[unit]));

  Pipeline.run(machine, { cycles: 200, stopOnTrap: true });
  return { summary: Pipeline.summary(machine),
    answer: Pipeline.snapshot(machine).registers[13] | 0 };
}

test('forwarding: the double hazard is the one fixture the naive unit fails', function () {
  const expected = {
    chain: { full: [9, 30], naive: [9, 30], none: [15, 30] },
    double: { full: [10, 14], naive: [10, 4], none: [16, 14] },
    loaduse: { full: [12, 43], naive: [12, 43], none: [17, 43] },
    scheduled: { full: [12, 43], naive: [12, 43], none: [17, 43] },
    independent: { full: [9, 4], naive: [9, 4], none: [9, 4] }
  };

  Object.keys(expected).forEach(function (name) {
    Object.keys(expected[name]).forEach(function (unit) {
      const got = fixture(name, unit);
      const want = expected[name][unit];

      assert.strictEqual(got.summary.cycles, want[0], name + ' / ' + unit + ' cycles');
      assert.strictEqual(got.answer, want[1], name + ' / ' + unit + ' answer');
    });
  });

  prose.quotes('data-hazards-and-forwarding',
    ['both give 30, in 9 cycles', 'the correct unit gives 14; the naive one gives 4',
      '9 cycles with forwarding, 15 without — 6 stall cycles',
      'still 12 cycles — but 8 instructions retired instead of 7']);
});

test('forwarding: the scheduled fixture takes the same cycles and retires one more', function () {
  const loaduse = fixture('loaduse', 'full');
  const scheduled = fixture('scheduled', 'full');

  assert.strictEqual(loaduse.summary.cycles, scheduled.summary.cycles, '12 cycles either way');
  assert.strictEqual(scheduled.summary.retired, loaduse.summary.retired + 1,
    'and the scheduled one gets an extra instruction into the slot');
  assert.strictEqual(loaduse.summary.loadUse, 1, 'the load-use stall the wiring cannot remove');
  assert.strictEqual(scheduled.summary.loadUse, 0, 'and the compiler filling it');
});

/* ----------------------------------------------- 35.4 control hazards */

test('control: resolving in decode halves the flushes and loses on two programs', function () {
  const expected = { sum: [70, 22, 69, 11, 0], arrayMax: [72, 20, 70, 12, 1],
    strlen: [54, 12, 56, 8, 0], factorial: [197, 68, 205, 34, 19] };

  Object.keys(expected).forEach(function (name) {
    const ex = run(name, {});
    const id = run(name, { resolveIn: 'ID' });
    const want = expected[name];

    assert.strictEqual(ex.cycles, want[0], name + ' EX cycles');
    assert.strictEqual(ex.flushes, want[1], name + ' EX flushes');
    assert.strictEqual(id.cycles, want[2], name + ' ID cycles');
    assert.strictEqual(id.flushes, want[3], name + ' ID flushes');
    assert.strictEqual(id.stalls - ex.stalls, want[4], name + ' extra stalls');
    assert.ok(id.flushes < ex.flushes, name + ': decode throws away less');
  });
  assert.strictEqual(Number((100 * 22 / 70).toFixed(1)), 31.4, 'the sum loop loses 31% to flushes');

  prose.quotes('control-hazards',
    ['70 cycles, 22 of them flushes — 31% of the run',
      '69 cycles, 11 flushes, and no extra stalls',
      'strlen 54 becomes 56; factorial 197 becomes 205, with 19 extra stalls']);
});

/* -------------------------------------------- 35.5 and 35.6 predictors */

function accuracy(kind, trace) {
  return Number((100 * Predictors.evaluate(kind, trace).accuracy).toFixed(1));
}

test('predictors: the basic tournament, to one decimal place', function () {
  const expected = {
    loop: [10.0, 90.0, 80.0, 88.0],
    nested: [17.5, 82.5, 65.0, 80.8],
    alternating: [50.0, 50.0, 0.0, 0.0],
    random: [47.5, 47.5, 49.8, 50.2]
  };
  const kinds = ['static-not-taken', 'static-backward', 'one-bit', 'bimodal'];

  Object.keys(expected).forEach(function (name) {
    const trace = Traces.build(name);

    kinds.forEach(function (kind, index) {
      assert.strictEqual(accuracy(kind, trace), expected[name][index],
        kind + ' on ' + name);
    });
  });

  prose.quotes('branch-prediction-basics',
    ['65.0% over 120 branches — 42 mispredicts', '80.8% — 23 mispredicts, roughly half',
      'never-taken 17.5%, backward-taken 82.5% — better than the one-bit table']);
});

test('predictors: the nested fixture per site, and the mispredict counts', function () {
  const nested = Traces.nested({});
  const one = Predictors.evaluate('one-bit', nested);
  const two = Predictors.evaluate('bimodal', nested);

  assert.strictEqual(nested.length, 120, 'the fixture');
  assert.strictEqual(one.seen - one.correct, 42, 'the one-bit predictor misses 42');
  assert.strictEqual(two.seen - two.correct, 23, 'and the two-bit one 23');

  const sites = {};

  two.sites.forEach(function (site) { sites[site.pc] = site; });
  assert.strictEqual(sites[0x500].seen, 100, 'the inner branch runs 100 times');
  assert.strictEqual(Number((100 * sites[0x500].right / 100).toFixed(1)), 79.0, 'at 79.0%');
  assert.strictEqual(sites[0x504].seen, 20, 'the outer branch 20 times');
  assert.strictEqual(Number((100 * sites[0x504].right / 20).toFixed(1)), 90.0, 'at 90.0%');

  prose.quotes('branch-prediction-basics',
    ['the inner branch is at 79.0% over 100 executions; the outer at 90.0% over 20']);
});

test('predictors: the advanced tournament, and the correlated site', function () {
  const expected = {
    correlated: [57.3, 63.7, 63.0, 63.3],
    alternating: [0.0, 97.0, 96.5, 98.5],
    nested: [80.8, 87.5, 94.2, 95.8],
    loop: [88.0, 64.0, 92.0, 80.0],
    random: [50.2, 49.0, 47.0, 54.5]
  };
  const kinds = ['bimodal', 'gshare', 'tournament', 'tage'];

  Object.keys(expected).forEach(function (name) {
    const trace = Traces.build(name);

    kinds.forEach(function (kind, index) {
      assert.strictEqual(accuracy(kind, trace), expected[name][index], kind + ' on ' + name);
    });
  });

  const correlated = Traces.correlated({});

  function site(kind, pc) {
    const result = Predictors.evaluate(kind, correlated);
    const found = result.sites.filter(function (row) { return row.pc === pc; })[0];

    return Number((100 * found.right / found.seen).toFixed(1));
  }

  assert.strictEqual(site('bimodal', 0x308), 73.3, 'the per-site counter caps out');
  assert.strictEqual(site('gshare', 0x308), 88.8, 'and history separates the cases');
  assert.strictEqual(Number((88.8 - 73.3).toFixed(1)), 15.5, 'a 15.5-point difference');
  assert.strictEqual(Number((63.7 - 57.3).toFixed(1)), 6.4, 'against 6.4 overall');

  prose.quotes('advanced-branch-prediction',
    ['bimodal 73.3%, gshare 88.8% — 15.5 points',
      'bimodal 88.0%, gshare 64.0% — history made it substantially worse',
      '(50 + 50 + 100) / 3 = 66.7%, so gshare is close to the maximum available']);
});

/* ------------------------------------------ 35.7 precise exceptions */

test('precise: a misaligned load, detected in memory and committed one cycle later',
  function () {
    const handler = Assembler.assemble(Programs.INTERRUPT_HANDLER, { origin: 0x100 });
    const source = Programs.FAULTS.misalignedLoad +
      '\n  li a3, 4\n  li a5, 7\nspin:\n  j spin\n';
    const image = Assembler.assemble(source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(machine.memory, 0x100, handler.bytes);
    Pipeline.run(machine, { cycles: 200 });

    const events = [];

    machine.log.forEach(function (cycle) {
      cycle.events.forEach(function (event) {
        if (event.kind === 'fault' || event.kind === 'trap') {
          events.push({ cycle: cycle.cycle, kind: event.kind, id: event.id });
        }
      });
    });
    const trap = events.filter(function (row) { return row.kind === 'trap'; })[0];
    const detection = events.filter(function (row) {
      return row.kind === 'fault' && row.id === trap.id;
    })[0];

    assert.strictEqual(detection.cycle, 5, 'detected in the memory stage at cycle 5');
    assert.strictEqual(trap.cycle, 6, 'and committed at write-back one cycle later');
    assert.strictEqual(machine.traps.taken[0].cause, 4, 'misaligned load');
    assert.strictEqual(machine.traps.taken[0].pc, 0x8, 'at 0x8');
    assert.strictEqual(Pipeline.summary(machine).squashed, 5, '5 instructions squashed');

    const reference = Reference.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(reference.memory, 0x100, handler.bytes);
    for (let at = 0; at < machine.retired; at += 1) Reference.step(reference);
    assert.deepStrictEqual(Reference.differences(Pipeline.snapshot(machine),
      Reference.snapshot(reference)).filter(function (row) { return row.field !== 'pc'; }), [],
    'and the state is precise');

    prose.quotes('precise-exceptions-pipelined',
      ['cycle 5, with two younger instructions already in decode and fetch',
        'mcause 4, mepc 0x8, mtval 0x10000001 — the address that was wrong',
        '5 instructions fetched after the fault and never committed']);
  });

/* ---------------------------------------------------- 35.8 the depth model */

test('depth: the curve, its bottom and the two optima', function () {
  const branchy = Object.assign({}, Model.WORKLOADS.branchy);
  const curve = Model.curve(branchy);

  function timeAt(depth) {
    return Math.round(Model.timeAt(depth, branchy));
  }

  assert.strictEqual(Model.period(1, {}), 178, 'one stage');
  assert.strictEqual(Model.period(5, {}), 38, 'five');
  assert.strictEqual(Model.period(20, {}), 12, 'twenty');
  assert.strictEqual(timeAt(1), 220275, 'time at one stage');
  assert.strictEqual(timeAt(5), 51300, 'at five');
  assert.strictEqual(timeAt(20), 21600, 'at twenty');
  assert.strictEqual(timeAt(36), 18300, 'at thirty-six');
  assert.strictEqual(timeAt(40), 19200, 'and the curve has turned by forty');
  assert.strictEqual(curve.best.depth, 35, 'the fastest depth');
  assert.strictEqual(curve.green.depth, 18, 'and the most efficient one');
  assert.strictEqual(Number((100 * Model.pointAt(20, {}).overheadShare).toFixed(0)), 25,
    'at twenty stages the overhead is a quarter of the period');

  prose.quotes('pipeline-depth-limits',
    ['period 178, CPI 1.238, time 220 275', 'period 38, CPI 1.350, time 51 300',
      'period 12, CPI 1.800, time 21 600', '18 300 at thirty-six and 19 200 at forty',
      'fastest at 35 stages; most efficient at 18']);
});

test('depth: raising the overhead moves the optimum towards what was built', function () {
  const rows = [[3, 35, 18], [10, 25, 11], [17, 18, 8]];

  rows.forEach(function (row) {
    const curve = Model.curve(Object.assign({ overhead: row[0] }, Model.WORKLOADS.branchy));

    assert.strictEqual(curve.best.depth, row[1], 'fastest at overhead ' + row[0]);
    assert.strictEqual(curve.green.depth, row[2], 'most efficient at overhead ' + row[0]);
  });

  const realistic = Model.compareWorkloads({ overhead: 17 });
  const byKey = {};

  realistic.forEach(function (row) { byKey[row.key] = row; });
  assert.strictEqual(byKey.predictable.best.depth, 35, 'predictable branches want depth');
  assert.strictEqual(byKey.branchy.best.depth, 18, 'and unpredictable ones want half of it');

  prose.quotes('pipeline-depth-limits',
    ['fastest at 25 stages, most efficient at 11',
      'predictable branches want 35 stages; unpredictable ones want 18']);
});

/* ------------------------------------------- 35.9 the branch laboratory */

test('branchless: the sorted-array result, and where the transform starts paying', function () {
  const data = Traces.filterData({ count: 64 });

  function measure(order, branchless) {
    const image = Assembler.assemble(Traces.filterProgram(data[order],
      { threshold: data.threshold, branchless: branchless }), { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal' });

    Pipeline.run(machine, { cycles: 8000, stopOnTrap: true });
    return { summary: Pipeline.summary(machine),
      answer: Pipeline.snapshot(machine).registers[13] };
  }

  const sorted = measure('sorted', false);
  const shuffled = measure('shuffled', false);
  const branchless = measure('shuffled', true);
  const branchlessSorted = measure('sorted', true);

  assert.strictEqual(data.answer, 6947, 'the answer');
  [sorted, shuffled, branchless, branchlessSorted].forEach(function (row) {
    assert.strictEqual(row.answer, 6947, 'every configuration computes it');
  });
  assert.strictEqual(sorted.summary.cycles, 503, 'branchy sorted');
  assert.strictEqual(sorted.summary.mispredicts, 4, 'with 4 mispredicts');
  assert.strictEqual(shuffled.summary.cycles, 563, 'branchy shuffled');
  assert.strictEqual(shuffled.summary.mispredicts, 34, 'with 34');
  assert.strictEqual(branchless.summary.cycles, 654, 'branchless, either order');
  assert.strictEqual(branchlessSorted.summary.cycles, 654, 'identical, which is the point');
  assert.strictEqual(sorted.summary.retired, 424, 'the branchy instruction count');
  assert.strictEqual(branchless.summary.retired, 581, 'and the branchless one');
  assert.strictEqual(563 - 503, 2 * (34 - 4), 'the difference is exactly the mispredicts');

  const saved = shuffled.summary.mispredicts - branchless.summary.mispredicts;
  const breakEven = 2 + (branchless.summary.cycles - shuffled.summary.cycles) / saved;

  assert.strictEqual(Number(breakEven.toFixed(1)), 4.8, 'the break-even penalty');

  prose.quotes('pipeline-friendly-code',
    ['503 cycles, 4 mispredicts, answer 6 947',
      '563 cycles, 34 mispredicts, answer 6 947',
      '654 cycles either way, 1 mispredict, answer 6 947',
      '581 against 424 — 157 extra instructions for 64 elements']);
});

test('branchless: the same code on four machines, scaled by the penalty', function () {
  const data = Traces.filterData({ count: 64 });

  function measure(order, branchless) {
    const image = Assembler.assemble(Traces.filterProgram(data[order],
      { threshold: data.threshold, branchless: branchless }), { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal' });

    Pipeline.run(machine, { cycles: 8000, stopOnTrap: true });
    return Pipeline.summary(machine);
  }

  const branchy = measure('shuffled', false);
  const branchless = measure('shuffled', true);

  function at(summary, penalty) {
    return summary.cycles + (penalty - 2) * summary.mispredicts;
  }

  assert.strictEqual(at(branchy, 5), 665, 'branchy at a 5-cycle penalty');
  assert.strictEqual(at(branchless, 5), 657, 'and branchless');
  assert.strictEqual(at(branchy, 20), 1175, 'branchy at 20');
  assert.strictEqual(at(branchless, 20), 672, 'and branchless');
  assert.ok(at(branchy, 2) < at(branchless, 2), 'branchy wins on this machine');
  assert.ok(at(branchy, 5) > at(branchless, 5), 'and loses on a slightly deeper one');

  prose.quotes('pipeline-friendly-code',
    ['at 5 cycles: 665 against 657. At 20: 1 175 against 672']);
});
