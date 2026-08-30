'use strict';

/**
 * The M35 machinery, checked against something that is not itself.
 *
 * The load-bearing test is the differential: the pipelined machine has its own
 * register file, its own operand selection and its own memory ordering, and it
 * shares only the instruction table with the M34 behavioural simulator. Running
 * both on every sample program under every configuration and comparing the
 * architectural state is the only check that can catch a forwarding unit that
 * is fast and wrong.
 *
 * The second is the accounting. Every cycle either retires an instruction,
 * commits a trap, or holds a bubble charged to whatever made it, so the three
 * counts must sum to the cycle count exactly. The first version of that
 * accounting was derived from the stall and flush events instead and was off by
 * one on every program; this suite would have caught it.
 */

const test = require('node:test');
const assert = require('node:assert');

const Pipeline = require('../../src/js/machines/brv32/pipeline.js');
const Hazards = require('../../src/js/machines/brv32/hazards.js');
const Predictors = require('../../src/js/machines/brv32/predictors.js');
const Traces = require('../../src/js/machines/brv32/branch-traces.js');
const Model = require('../../src/js/machines/pipeline-model.js');
const View = require('../../src/js/viz/pipeline-view.js');
const PredictorView = require('../../src/js/viz/predictor-view.js');
const Assembler = require('../../src/js/machines/brv32/assembler.js');
const Reference = require('../../src/js/machines/brv32/reference-sim.js');
const Programs = require('../../src/js/machines/brv32/programs.js');
const Devices = require('../../src/js/machines/brv32/devices.js');
const Traps = require('../../src/js/machines/brv32/traps.js');

const NAMES = ['sum', 'arrayMax', 'strlen', 'factorial', 'console'];

const CONFIGS = [
  { label: 'default', options: {} },
  { label: 'no forwarding', options: { forwarding: false } },
  { label: 'unified memory', options: { unifiedMemory: true } },
  { label: 'resolve in decode', options: { resolveIn: 'ID' } },
  { label: 'bimodal', options: { predictor: 'bimodal' } },
  { label: 'gshare', options: { predictor: 'gshare' } },
  { label: 'tournament', options: { predictor: 'tournament' } },
  { label: 'tage', options: { predictor: 'tage' } },
  { label: 'bimodal, decode', options: { predictor: 'bimodal', resolveIn: 'ID' } }
];

function runBoth(name, options) {
  const image = Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });
  const pipeline = Pipeline.create(Object.assign({ image: image.bytes, entry: 0 }, options));

  Pipeline.run(pipeline, { cycles: 4000, stopOnTrap: true });

  const reference = Reference.create({ image: image.bytes, entry: 0 });

  for (let at = 0; at < pipeline.retired; at += 1) Reference.step(reference);
  return { pipeline: pipeline, summary: Pipeline.summary(pipeline),
    differences: Reference.differences(Pipeline.snapshot(pipeline),
      Reference.snapshot(reference)).filter(function (row) { return row.field !== 'pc'; }) };
}

/* ------------------------------------------------------------ the oracle */

test('pipeline: agrees with the behavioural machine on every program and configuration',
  function () {
    CONFIGS.forEach(function (config) {
      NAMES.forEach(function (name) {
        const out = runBoth(name, config.options);

        assert.deepStrictEqual(out.differences, [],
          config.label + ' on ' + name + ' diverged from the reference');
        assert.ok(out.summary.retired > 0, config.label + ' on ' + name + ' retired nothing');
      });
    });
  });

/* The deliberately broken forwarding unit has to actually be broken, or the
   demo that switches it on is teaching nothing. */
test('pipeline: the naive forwarding unit is wrong on a real program', function () {
  const naive = runBoth('arrayMax', { naiveForwarding: true, predictor: 'bimodal' });

  assert.ok(naive.differences.length > 0,
    'checking MEM/WB before EX/MEM must diverge on a program with a double hazard');
  const where = Programs.CATALOGUE.arrayMax.result;

  assert.strictEqual(Pipeline.snapshot(naive.pipeline).registers[where] | 0, 59049235,
    'and it is not a small error: 59 049 235 instead of 37');
});

/* ------------------------------------------------------- the accounting */

test('pipeline: every cycle is attributed and the totals reconcile', function () {
  CONFIGS.forEach(function (config) {
    NAMES.forEach(function (name) {
      const out = runBoth(name, config.options);
      const found = View.attribution(out.summary);

      assert.strictEqual(out.summary.reconciles, true,
        config.label + ' on ' + name + ': ' + out.summary.accounted + ' accounted for ' +
        out.summary.cycles + ' cycles');
      assert.strictEqual(found.total, out.summary.cycles,
        config.label + ' on ' + name + ': the attribution table must sum to the cycles');
      assert.strictEqual(found.reconciles, true, 'and say so');
    });
  });
});

test('pipeline: forwarding removes stalls and never changes the answer', function () {
  const withIt = runBoth('arrayMax', { predictor: 'bimodal' });
  const without = runBoth('arrayMax', { predictor: 'bimodal', forwarding: false });

  assert.deepStrictEqual(withIt.differences, [], 'both are correct');
  assert.deepStrictEqual(without.differences, [], 'stalling is correct too, just slower');
  assert.ok(without.summary.stalls > withIt.summary.stalls,
    'no forwarding means more stalls');
  assert.ok(without.summary.cycles > withIt.summary.cycles, 'and more cycles');
  assert.strictEqual(withIt.summary.forwards > 0, true, 'and some operands were forwarded');
});

test('pipeline: a unified memory costs stalls only on programs that touch memory', function () {
  const sum = { unified: runBoth('sum', { predictor: 'bimodal', unifiedMemory: true }),
    split: runBoth('sum', { predictor: 'bimodal' }) };
  const factorial = { unified: runBoth('factorial', { predictor: 'bimodal',
    unifiedMemory: true }), split: runBoth('factorial', { predictor: 'bimodal' }) };

  assert.strictEqual(sum.unified.summary.structural, 0, 'the sum loop touches no memory');
  assert.strictEqual(sum.unified.summary.cycles, sum.split.summary.cycles,
    'so it pays nothing for sharing the port');
  assert.ok(factorial.unified.summary.structural > 0, 'the factorial does touch memory');
  assert.ok(factorial.unified.summary.cycles > factorial.split.summary.cycles,
    'and pays for it');
});

/* -------------------------------------------------------- the hazard unit */

test('hazards: the most recent producer wins, and a load is not a source', function () {
  const latches = {
    exMem: { decoded: { ok: true, rd: 12, row: { format: 'R' } }, value: 13 },
    memWb: { decoded: { ok: true, rd: 12, row: { format: 'R' } }, value: 3 }
  };

  assert.strictEqual(Hazards.forwardFor(12, latches, {}).value, 13,
    'the instruction one ahead is newer than the one two ahead');
  assert.strictEqual(Hazards.forwardFor(12, latches, { naiveForwarding: true }).value, 3,
    'and reversing the order picks the older value, which is the classic bug');

  const load = { exMem: { decoded: { ok: true, rd: 12, row: { format: 'I', opcode: 0x03 } },
    value: 0 }, memWb: null };

  assert.strictEqual(Hazards.forwardFor(12, load, {}).value, null,
    'a load in the memory stage has no value to forward yet');
  assert.strictEqual(Hazards.forwardFor(0, latches, {}).value, 0, 'and x0 is always zero');
});

test('hazards: the instruction one ahead of decode is in EXECUTE', function () {
  const consumer = { decoded: { ok: true, rs1: 12, rs2: 0, row: { format: 'I' } } };
  const loadInExecute = { idEx: { decoded: { ok: true, rd: 12,
    row: { format: 'I', opcode: 0x03 } } }, exMem: null, memWb: null };
  const loadInMemory = { idEx: null, exMem: { decoded: { ok: true, rd: 12,
    row: { format: 'I', opcode: 0x03 } }, value: 9 }, memWb: null };

  assert.ok(Hazards.stallFor(consumer, loadInExecute, {}),
    'a load one ahead is a load-use hazard');
  assert.strictEqual(Hazards.stallFor(consumer, loadInMemory, {}), null,
    'a load two ahead has its value and forwards normally');
});

/* --------------------------------------------------------- the predictors */

test('predictors: every kind runs, and none of them beats chance on coin flips', function () {
  const random = Traces.random({ length: 400 });

  Predictors.KINDS.forEach(function (kind) {
    const result = Predictors.evaluate(kind, random);

    assert.strictEqual(result.seen, 400, kind + ' saw the whole trace');
    assert.ok(result.accuracy < 0.6, kind + ' must not beat chance on random outcomes');
    assert.ok(result.accuracy > 0.4, kind + ' must not be beaten by chance either');
  });
});

test('predictors: two bits beat one on loops, and history beats both on alternation',
  function () {
    const nested = Traces.nested({});
    const alternating = Traces.alternating({});
    const one = Predictors.evaluate('one-bit', nested);
    const two = Predictors.evaluate('bimodal', nested);

    assert.ok(two.accuracy > one.accuracy,
      'the second bit removes the loop-boundary double miss');
    assert.strictEqual(Predictors.evaluate('bimodal', alternating).accuracy, 0,
      'and a per-site counter is wrong on every alternating outcome');
    assert.ok(Predictors.evaluate('gshare', alternating).accuracy > 0.9,
      'while one bit of history gets it almost perfectly');
  });

test('predictors: gshare separates the correlated site, and loses on a plain loop',
  function () {
    const correlated = Traces.correlated({});
    const bimodal = Predictors.evaluate('bimodal', correlated);
    const gshare = Predictors.evaluate('gshare', correlated);

    function siteAccuracy(result, pc) {
      const site = result.sites.filter(function (row) { return row.pc === pc; })[0];

      return site.right / site.seen;
    }

    assert.ok(siteAccuracy(gshare, 0x308) - siteAccuracy(bimodal, 0x308) > 0.1,
      'the correlated site is where the difference is, and it is more than ten points');
    assert.ok(Math.abs(siteAccuracy(gshare, 0x300) - 0.5) < 0.1,
      'and the two coin-flip sites are near chance for both');

    const loop = Traces.loop({});

    assert.ok(Predictors.evaluate('gshare', loop).accuracy <
      Predictors.evaluate('bimodal', loop).accuracy,
      'history is a regression on a branch that did not need it');
  });

test('predictors: the return-address stack loses its oldest entries first', function () {
  const stack = Predictors.createRas({ depth: 4 });

  for (let at = 0; at < 6; at += 1) stack.push(100 + at);
  assert.strictEqual(stack.depth(), 4, 'the depth is a hard limit');
  assert.strictEqual(stack.overflows(), 2, 'and it says how many were lost');
  assert.strictEqual(stack.pop(), 105, 'the innermost return is still there');
  assert.strictEqual(stack.pop(), 104, 'and the next');
});

test('predictors: only the counters that were used are reported', function () {
  const result = Predictors.evaluate('bimodal', Traces.nested({}));

  assert.ok(result.state.length > 0, 'some counters were touched');
  assert.ok(result.state.length <= 16, 'and the report is bounded');
  result.state.forEach(function (row) {
    assert.strictEqual(typeof row.index, 'number', 'each row names its slot');
    assert.ok(row.value >= 0 && row.value <= 3, 'and holds a two-bit value');
  });
  assert.ok(PredictorView.counters(result).length > 0, 'and the view can name them');
});

/* -------------------------------------------------- precise exceptions */

test('pipeline: every fault class is precise, with a handler that returns', function () {
  const handler = Assembler.assemble(Programs.INTERRUPT_HANDLER, { origin: 0x100 });
  const expected = { ecall: 11, illegal: 2, misalignedLoad: 4, misalignedStore: 6,
    unmapped: 5 };

  assert.strictEqual(handler.ok, true, 'the handler must assemble');
  Object.keys(expected).forEach(function (name) {
    const source = Programs.FAULTS[name] + '\n  li a3, 4\n  li a5, 7\nspin:\n  j spin\n';
    const image = Assembler.assemble(source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(machine.memory, 0x100, handler.bytes);
    Pipeline.run(machine, { cycles: 200 });

    const reference = Reference.create({ image: image.bytes, entry: 0 });

    Devices.loadImage(reference.memory, 0x100, handler.bytes);
    for (let at = 0; at < machine.retired; at += 1) Reference.step(reference);

    const differences = Reference.differences(Pipeline.snapshot(machine),
      Reference.snapshot(reference)).filter(function (row) { return row.field !== 'pc'; });

    assert.strictEqual(machine.traps.taken.length, 1, name + ' should trap exactly once');
    assert.strictEqual(machine.traps.taken[0].cause, expected[name], name + ' cause');
    assert.deepStrictEqual(differences, [], name + ' must leave precise state');
    assert.strictEqual(Pipeline.snapshot(machine).registers[13], 4,
      name + ' must resume and finish the program');
  });
});

/* A speculative instruction carries a speculative exception. A machine that
   freezes on a wrong-path fault and never unfreezes stops dead at the first
   mispredicted loop exit, which is exactly what this did. */
test('pipeline: a fault on the wrong path does not stop the machine', function () {
  const image = Assembler.assemble('  li a0, 1\nspin:\n  j spin\n', { origin: 0 });
  const machine = Pipeline.create({ image: image.bytes, entry: 0 });

  Pipeline.run(machine, { cycles: 40 });
  assert.ok(machine.retired > 5,
    'the loop must keep retiring; wrong-path fetches past the end are not faults');
  assert.strictEqual(machine.frozen, false, 'and the machine must not be stuck');
});

/* ------------------------------------------------------------- the model */

test('model: only the logic divides, and the curve has an interior bottom', function () {
  assert.strictEqual(Model.period(1, {}), 178, '175 of logic plus 3 of overhead');
  assert.strictEqual(Model.period(5, {}), 38, '35 each plus 3');
  assert.strictEqual(Model.period(20, {}), 12, '9 each plus 3');

  const curve = Model.curve({});

  assert.ok(curve.best.depth > 1, 'the optimum is not one stage');
  assert.ok(curve.best.depth < curve.settings.to, 'nor the end of the range');
  assert.ok(curve.points[curve.points.length - 1].time > curve.best.time,
    'and the curve has turned upwards by the end');
  assert.ok(curve.green.depth < curve.best.depth,
    'the power-aware optimum is shallower than the fastest, which is what happened');
});

test('model: the efficiency metric does not reward doing nothing', function () {
  const curve = Model.curve({});

  assert.ok(curve.green.depth > 1,
    'performance per watt alone would peak at one stage, which is why it is cubed');
  Model.compareWorkloads({}).forEach(function (row) {
    assert.ok(row.best.depth >= 1, row.name + ' has an optimum');
    assert.ok(row.speedup > 1, row.name + ' gains something from pipelining');
  });
});

/* ------------------------------------------------- the branch laboratory */

test('traces: the filter programs compute the same answer whatever the order or shape',
  function () {
    const data = Traces.filterData({ count: 64 });

    [false, true].forEach(function (branchless) {
      ['sorted', 'shuffled'].forEach(function (order) {
        const source = Traces.filterProgram(data[order],
          { threshold: data.threshold, branchless: branchless });
        const image = Assembler.assemble(source, { origin: 0 });

        assert.strictEqual(image.ok, true, 'the generated program must assemble');
        const machine = Pipeline.create({ image: image.bytes, entry: 0,
          predictor: 'bimodal' });

        Pipeline.run(machine, { cycles: 8000, stopOnTrap: true });
        assert.strictEqual(Pipeline.snapshot(machine).registers[13], data.answer,
          (branchless ? 'branchless' : 'branchy') + ' on ' + order +
          ' must compute the same sum');
      });
    });
  });

test('traces: sorting changes the mispredicts and nothing else', function () {
  const data = Traces.filterData({ count: 64 });

  function run(order) {
    const image = Assembler.assemble(Traces.filterProgram(data[order],
      { threshold: data.threshold }), { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal' });

    Pipeline.run(machine, { cycles: 8000, stopOnTrap: true });
    return Pipeline.summary(machine);
  }

  const sorted = run('sorted');
  const shuffled = run('shuffled');

  assert.strictEqual(sorted.retired, shuffled.retired,
    'the same instructions run either way');
  assert.ok(shuffled.mispredicts > sorted.mispredicts * 4,
    'and the only thing that changed is how predictable the branch was');
  assert.strictEqual(shuffled.cycles - sorted.cycles,
    2 * (shuffled.mispredicts - sorted.mispredicts),
    'the whole cycle difference is the extra mispredicts at two cycles each');
});
