'use strict';

/**
 * Every figure the M33.9-M33.10 content quotes, recomputed from the timing
 * analyser and the hardware-description library, and then checked against the
 * prose.
 *
 * The activity measurement is the one to watch: it depends on how the inputs
 * are driven, so the vectors are generated here exactly as the section
 * generates them — seeded, across every input — and the figure test would move
 * if that changed, which is the point.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Timing = require('../../src/js/machines/timing.js');
const Adder = require('../../src/js/machines/blocks/adder.js');
const Alu = require('../../src/js/machines/blocks/alu.js');
const Fsm = require('../../src/js/machines/fsm-synth.js');
const TwoLevel = require('../../src/js/machines/blocks/two-level.js');
const Hdl = require('../../src/js/machines/hdl.js');
const Random = require('../../src/js/utils/random.js');

require('../../src/js/content/concepts-logic-design.js');
require('../../src/js/content/examples-logic-design.js');
const prose = require('../support/worked-example-prose.js');

function vectorFor(net, random) {
  const values = {};

  net.inputs.forEach(function (id) { values[net.nodes[id].label] = random.int(2); });
  return values;
}

function transitionsFor(net) {
  const random = Random.seeded(20250829);
  const pairs = [];

  for (let at = 0; at < 32; at += 1) {
    pairs.push([vectorFor(net, random), vectorFor(net, random)]);
  }
  return pairs;
}

test('timing: the report on the 8-bit ripple adder', function () {
  const net = Adder.rippleCarry({ width: 8 });
  const report = Timing.frequency(net, { target: 30 });
  const worst = report.worst['input to output'];

  assert.strictEqual(report.logic, 35, 'the logic delay');
  assert.strictEqual(report.overhead, 3, 'clock-to-q plus setup');
  assert.strictEqual(report.period, 38, 'so the period is 38');
  assert.strictEqual(report.slack, -8, 'and the slack against a target of 30 is negative');
  assert.strictEqual(report.limitedBy, 'input to output', 'this block has no clock of its own');
  assert.strictEqual(worst.delay, 35, 'the worst path');
  assert.strictEqual(worst.from, 'a0', 'from the lowest operand bit');
  assert.strictEqual(worst.to, 'cout', 'to the carry out');
  assert.strictEqual(Math.round(100 * report.overhead / report.period), 8,
    'the overhead is 8% of the period');
  assert.strictEqual(report.worst['register to register'], undefined,
    'and there is no register-to-register path at all');

  prose.quotes('timing-clocking-and-power',
    ['one class present: input to output, 35 gate delays from a0 to cout',
      '35 of logic plus 3 of overhead = 38, so the overhead is 8% of the period',
      'slack −8: the design does not run at that speed']);
});

test('timing: pipelining divides the logic and not the overhead', function () {
  const estimate = Timing.pipelineEstimate(35, 8, {});
  const rows = {};

  estimate.rows.forEach(function (row) { rows[row.stages] = row; });
  assert.strictEqual(rows[1].period, 38, 'one stage is the unpipelined period');
  assert.strictEqual(rows[2].period, 21, 'two stages');
  assert.strictEqual(rows[2].speedup.toFixed(2), '1.81', 'for 1.81 times');
  assert.strictEqual(rows[2].latency, 42, 'and worse latency than the 38 it started at');
  assert.strictEqual(rows[4].period, 12, 'four stages');
  assert.strictEqual(rows[4].speedup.toFixed(2), '3.17', 'for 3.17 times');
  assert.strictEqual(rows[6].period, 9, 'six stages');
  assert.strictEqual(rows[6].speedup.toFixed(2), '4.22', 'for 4.22 times');
  assert.strictEqual(rows[6].latency, 54, 'at a latency of 54');
  assert.strictEqual(estimate.ceiling.toFixed(2), '12.67', 'and the ceiling is 12.67');

  prose.quotes('timing-clocking-and-power',
    ['2 stages: period 21, speed-up 1.81. 6 stages: period 9, speed-up 4.22',
      '(35 + 3) / 3 = 12.67 times, at infinitely many stages',
      'six stages a single addition takes 54 gate delays instead of 38']);
});

test('timing: switching that computed nothing, and the sampling that hides it', function () {
  const nets = {
    ripple: Adder.rippleCarry({ width: 8 }),
    lookahead: Adder.carryLookahead({ width: 8 }),
    alu: Alu.alu({ width: 8 }),
    fsm: Fsm.synthesise(Fsm.sequenceDetector('moore'), 'binary').net,
    hazard: TwoLevel.netFor(['11-', '-01'], ['a', 'b', 'c'])
  };
  const measured = {};

  Object.keys(nets).forEach(function (name) {
    measured[name] = Timing.activity(nets[name], transitionsFor(nets[name]));
  });

  assert.strictEqual(measured.ripple.changes, 887, 'ripple wire changes');
  assert.strictEqual(measured.ripple.wasted, 197, 'of which glitches');
  assert.strictEqual((100 * measured.ripple.wastedShare).toFixed(1), '22.2', 'the wasted share');
  assert.strictEqual(measured.lookahead.changes, 1938, 'lookahead changes');
  assert.strictEqual((100 * measured.lookahead.wastedShare).toFixed(1), '19.8', 'its share');
  assert.strictEqual(measured.alu.changes, 3157, 'ALU changes');
  assert.strictEqual(measured.alu.wasted, 1296, 'ALU glitches');
  assert.strictEqual((100 * measured.alu.wastedShare).toFixed(1), '41.1', 'the ALU share');
  assert.strictEqual(measured.fsm.changes, 153, 'the state machine switches');
  assert.strictEqual(measured.fsm.wasted, 0, 'and never glitches');

  /* The measurement the section rejected: consecutive vectors that differ in
     one or two bits, which reports a clean circuit because a glitch needs
     several inputs moving at once. */
  const walk = [];
  const net = nets.ripple;
  const step = Math.max(1, Math.floor(Math.pow(2, 10) / 32));

  for (let at = 0; at + step < Math.pow(2, 10); at += step) {
    walk.push([Sim.assignmentOf(net, at), Sim.assignmentOf(net, at + step)]);
  }
  assert.strictEqual(Timing.activity(net, walk).wasted, 0,
    'a uniform walk of the low bits measures no glitching at all');

  prose.quotes('timing-clocking-and-power',
    ['887 wire changes, of which 197 were glitches — 22.2% wasted',
      '3 157 changes, 1 296 of them glitches — 41.1% wasted',
      'lookahead 19.8% of 1 938 changes; the state machine 0 of 153',
      'collapses to 0 of 887']);
});

test('timing: the multicore power comparison', function () {
  const scale = Timing.scaling({ cores: 2, exponent: 1 });

  assert.strictEqual(scale.single.total.toFixed(3), '1.200', 'one core at full speed');
  assert.strictEqual(scale.many.total.toFixed(3), '0.350', 'two cores at half the frequency');
  assert.strictEqual(Math.round(100 * scale.ratio), 29, 'about 29% of the power');
  assert.strictEqual(scale.voltage.toFixed(3), '0.500', 'with the voltage halved');

  prose.quotes('timing-clocking-and-power',
    ['two cores at half frequency use about 29% of the power']);
});

/* --------------------------------------------- hardware description */

function elaborate(name, bug) {
  return Hdl.elaborate(Hdl.standardLibrary({ bug: bug, width: 4 }), name);
}

function instances(net) {
  const seen = {};

  net.order.forEach(function (id) {
    const label = String(net.nodes[id].label || '');
    const cut = label.lastIndexOf('.');

    if (cut > 0) seen[label.slice(0, cut)] = true;
  });
  return Object.keys(seen).length;
}

function adderModel(values) {
  let a = 0;
  let b = 0;

  for (let at = 0; at < 4; at += 1) {
    a += (values['a' + at] ? 1 : 0) << at;
    b += (values['b' + at] ? 1 : 0) << at;
  }
  const total = a + b + (values.cin ? 1 : 0);
  const out = { cout: (total >> 4) & 1 };

  for (let at = 0; at < 4; at += 1) out['s' + at] = (total >> at) & 1;
  return out;
}

function fullAdderModel(values) {
  const total = (values.a ? 1 : 0) + (values.b ? 1 : 0) + (values.cin ? 1 : 0);

  return { sum: total & 1, carry: total > 1 ? 1 : 0 };
}

test('hdl: the library elaborates and every module checks out', function () {
  const rows = {
    xor2: { net: elaborate('xor2', false), vectors: 4, gates: 4, depth: 3, instances: 0 },
    halfAdder: { net: elaborate('halfAdder', false), vectors: 4, gates: 5, depth: 3,
      instances: 1 },
    fullAdder: { net: elaborate('fullAdder', false), vectors: 8, gates: 11, depth: 7,
      instances: 4 },
    adder4: { net: elaborate('adder4', false), vectors: 512, gates: 44, depth: 19,
      instances: 20 }
  };

  Object.keys(rows).forEach(function (name) {
    const row = rows[name];

    assert.strictEqual(Sim.gateCount(row.net), row.gates, name + ' gates');
    assert.strictEqual(Sim.criticalPath(row.net).delay, row.depth, name + ' depth');
    assert.strictEqual(instances(row.net), row.instances, name + ' module instances');
    assert.strictEqual(Math.pow(2, row.net.inputs.length), row.vectors, name + ' input space');
  });

  const full = Hdl.equivalent(rows.fullAdder.net, fullAdderModel, {});
  const wide = Hdl.equivalent(rows.adder4.net, adderModel, {});

  assert.strictEqual(full.ok, true, 'the full adder agrees with integer addition');
  assert.strictEqual(full.checked, 8, 'over all 8 vectors');
  assert.strictEqual(wide.ok, true, 'and so does the 4-bit adder');
  assert.strictEqual(wide.checked, 512, 'over all 512');

  prose.quotes('hardware-description-and-verification',
    ['4 gates at depth 3, agreeing on all 4 vectors',
      '11 gates at depth 7 from 4 module instances, agreeing on all 8 vectors',
      '44 gates at depth 19 from 20 module instances',
      'all 512 agree, so the block is verified rather than tested']);
});

test('hdl: the injected typo passes the corner cases and fails the exhaustive check', function () {
  const broken = elaborate('fullAdder', true);
  const wide = elaborate('adder4', true);
  const verdict = Hdl.equivalent(broken, fullAdderModel, {});

  assert.strictEqual(Sim.gateCount(broken), 12, 'one gate more than the correct version');
  assert.strictEqual(Sim.criticalPath(broken).delay, 7, 'at the same depth');
  assert.strictEqual(verdict.ok, false, 'and it is wrong');
  assert.deepStrictEqual(verdict.at, { a: 1, b: 0, cin: 1 }, 'at exactly this vector');
  assert.strictEqual(verdict.port, 'sum', 'on the sum output');
  assert.strictEqual(Sim.gateCount(wide), 48, 'the adder above it grows too');
  assert.strictEqual(Hdl.equivalent(wide, adderModel, {}).ok, false, 'and fails as well');

  const all = [];
  const total = Math.pow(2, broken.inputs.length);

  for (let mask = 0; mask < total; mask += 1) all.push(Sim.assignmentOf(broken, mask));
  const corner = [0, 1, total - 1, Math.floor(total / 2)].map(function (mask) {
    return Sim.assignmentOf(broken, mask);
  });
  const single = [Sim.assignmentOf(broken, 0)];
  const cover = function (vectors) { return Hdl.coverage(broken, vectors); };
  const passes = function (vectors) {
    return vectors.every(function (values) {
      const got = Sim.outputsOf(broken, Sim.evaluate(broken, values));
      const want = fullAdderModel(values);

      return Object.keys(want).every(function (port) {
        return (got[port] ? 1 : 0) === (want[port] ? 1 : 0);
      });
    });
  };

  assert.strictEqual(cover(corner).vectors, 4, 'the corner list drives four vectors');
  assert.strictEqual((100 * cover(corner).vectorShare).toFixed(1), '50.0', 'half the space');
  assert.strictEqual(Math.round(100 * cover(corner).toggleShare), 80, 'at 80% toggle coverage');
  assert.strictEqual(passes(corner), true, 'and it passes the broken design');
  assert.strictEqual(Math.round(100 * cover(single).toggleShare), 0, 'one vector toggles nothing');
  assert.strictEqual((100 * cover(single).vectorShare).toFixed(1), '12.5', 'and covers an eighth');
  assert.strictEqual(passes(all), false, 'while the exhaustive list does not pass it');

  prose.quotes('hardware-description-and-verification',
    ['12 gates instead of 11 at the same depth 7',
      'fails, and names the vector: a=1 b=0 cin=1',
      '4 vectors, 50.0% of the input space, 80% toggle coverage — and it PASSES',
      'drives half the input space, toggles 80% of the wires, and passes a design that is '
        + 'wrong']);
});
