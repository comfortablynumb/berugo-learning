/**
 * Graded exercises for precise exceptions, depth and pipeline-friendly code
 * (M35.7-M35.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'precise-exceptions-pipelined': [{
      id: 'precise-squash',
      title: 'Squash at detection, commit at write-back',
      prompt: 'Write lab() returning { detect, commits }. detect(pipeline, fault) records a '
        + 'fault on the instruction in the stage that found it and returns the new pipeline. '
        + 'A pipeline is { IF, ID, EX, MEM, WB }, each holding null or an entry '
        + '{ id, faulted }; fault is { stage, id }. Everything YOUNGER than that stage — that '
        + 'is, earlier in the order IF, ID, EX, MEM, WB — becomes null, and the entry in the '
        + 'faulting stage gets faulted set to true. Older stages are untouched. '
        + 'commits(pipeline, entry) decides what happens when an instruction reaches '
        + 'write-back: return "trap" when entry.faulted is true, "retire" when it is a real '
        + 'entry that is not faulted, and "nothing" when it is null or a bubble '
        + '(entry.bubble true). The starter squashes the older stages instead of the younger '
        + 'ones, and lets a faulted instruction retire.',
      entry: 'lab',
      starter: [
        'var ORDER = ["IF", "ID", "EX", "MEM", "WB"];',
        '',
        'function detect(pipeline, fault) {',
        '  var at = ORDER.indexOf(fault.stage);',
        '  var out = Object.assign({}, pipeline);',
        '',
        '  // Squashing the OLDER stages: this throws away completed work and',
        '  // leaves the younger instructions to reach memory.',
        '  ORDER.forEach(function (stage, index) {',
        '    if (index > at) out[stage] = null;',
        '  });',
        '  if (out[fault.stage]) out[fault.stage] = Object.assign({}, out[fault.stage],',
        '    { faulted: true });',
        '  return out;',
        '}',
        '',
        'function commits(pipeline, entry) {',
        '  if (!entry || entry.bubble) return "nothing";',
        '  // A faulted instruction retires like any other, so the trap never',
        '  // happens and the register gets written.',
        '  return "retire";',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect, commits: commits };',
        '}'
      ].join('\n'),
      solution: [
        'var ORDER = ["IF", "ID", "EX", "MEM", "WB"];',
        '',
        '/* Younger means earlier in the pipeline. Killing them the moment the',
        '   fault is detected is what stops a store two stages behind reaching',
        '   memory before the trap; leaving the older ones alone is what lets',
        '   them finish, which is the other half of precise. */',
        'function detect(pipeline, fault) {',
        '  var at = ORDER.indexOf(fault.stage);',
        '  var out = Object.assign({}, pipeline);',
        '',
        '  ORDER.forEach(function (stage, index) {',
        '    if (index < at) out[stage] = null;',
        '  });',
        '  if (out[fault.stage]) {',
        '    out[fault.stage] = Object.assign({}, out[fault.stage], { faulted: true });',
        '  }',
        '  return out;',
        '}',
        '',
        '/* Write-back is the commit point, so it is the only place a fault turns',
        '   into a trap - and the only place a register is written. */',
        'function commits(pipeline, entry) {',
        '  if (!entry || entry.bubble) return "nothing";',
        '  return entry.faulted ? "trap" : "retire";',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect, commits: commits };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a fault in the memory stage kills the two younger instructions',
          assert: function (lab, api) {
            const parts = lab();
            const before = { IF: { id: 5 }, ID: { id: 4 }, EX: { id: 3 }, MEM: { id: 2 },
              WB: { id: 1 } };
            const after = parts.detect(before, { stage: 'MEM', id: 2 });

            api.assert.equal(after.IF, null, 'the instruction in fetch never happened');
            api.assert.equal(after.ID, null, 'nor the one in decode');
            api.assert.equal(after.EX, null, 'nor the one in execute');
            api.assert.equal(after.MEM.faulted, true, 'the faulting one is marked');
            api.assert.equal(after.WB.id, 1, 'and the older one is untouched');
          }
        },
        {
          name: 'an older instruction still reaches write-back and retires',
          assert: function (lab, api) {
            const parts = lab();
            const after = parts.detect({ IF: { id: 5 }, ID: { id: 4 }, EX: { id: 3 },
              MEM: { id: 2 }, WB: { id: 1 } }, { stage: 'EX', id: 3 });

            api.assert.equal(parts.commits(after, after.WB), 'retire',
              'it is architecturally before the fault and must complete');
            api.assert.equal(after.MEM.id, 2, 'and so is the one in memory');
          }
        },
        {
          name: 'the faulted instruction traps rather than retiring',
          assert: function (lab, api) {
            const parts = lab();
            const after = parts.detect({ IF: { id: 3 }, ID: { id: 2 }, EX: null, MEM: null,
              WB: { id: 1, faulted: true } }, { stage: 'WB', id: 1 });

            api.assert.equal(parts.commits(after, after.WB), 'trap',
              'a fault reaching write-back writes the CSRs, not a register');
            api.assert.equal(parts.commits(after, null), 'nothing', 'an empty stage does nothing');
            api.assert.equal(parts.commits(after, { bubble: true }), 'nothing',
              'and neither does a bubble');
          }
        },
        {
          name: 'a fault detected at fetch squashes nothing, because nothing is younger',
          assert: function (lab, api) {
            const parts = lab();
            const before = { IF: { id: 5 }, ID: { id: 4 }, EX: { id: 3 }, MEM: { id: 2 },
              WB: { id: 1 } };
            const after = parts.detect(before, { stage: 'IF', id: 5 });

            api.assert.equal(after.IF.faulted, true, 'the fetch itself faulted');
            api.assert.equal(after.ID.id, 4, 'and everything else is older, so it survives');
            api.assert.equal(after.WB.id, 1, 'all the way down');
          }
        }
      ]
    }],

    'pipeline-depth-limits': [{
      id: 'depth-model',
      title: 'The depth curve, and its two optima',
      prompt: 'Write lab() returning { period, cpi, curve }. period(depth, settings) is '
        + 'ceil(logic / depth) + overhead, taking logic and overhead from settings. '
        + 'cpi(depth, settings) is 1 + hazardStalls + branchRate x mispredictRate x penalty, '
        + 'where the penalty is max(1, round(depth x resolveFraction)). curve(settings) '
        + 'evaluates depths from settings.from to settings.to and returns '
        + '{ points, best, green }: points is one { depth, period, cpi, time, power, '
        + 'efficiency } per depth where time is instructions x cpi x period, power is '
        + '(1 + latchShare x depth) / period, and efficiency is (1 / time) cubed divided by '
        + 'power; best is the point with the lowest time and green the point with the highest '
        + 'efficiency. The starter divides the whole period rather than the logic, and reports '
        + 'performance per watt rather than performance cubed per watt.',
      entry: 'lab',
      starter: [
        'function period(depth, settings) {',
        '  // The overhead is divided along with the logic, which assumes a',
        '  // pipeline register gets cheaper when you add more of them.',
        '  return Math.ceil((settings.logic + settings.overhead) / Math.max(1, depth));',
        '}',
        '',
        'function cpi(depth, settings) {',
        '  var penalty = Math.max(1, Math.round(depth * settings.resolveFraction));',
        '',
        '  return 1 + settings.hazardStalls +',
        '    settings.branchRate * settings.mispredictRate * penalty;',
        '}',
        '',
        'function curve(settings) {',
        '  var points = [];',
        '',
        '  for (var depth = settings.from; depth <= settings.to; depth += 1) {',
        '    var p = period(depth, settings);',
        '    var time = settings.instructions * cpi(depth, settings) * p;',
        '    var power = (1 + settings.latchShare * depth) / p;',
        '',
        '    // Performance per watt, which is maximised by an arbitrarily slow',
        '    // machine because power falls faster than speed does.',
        '    points.push({ depth: depth, period: p, cpi: cpi(depth, settings), time: time,',
        '      power: power, efficiency: (1 / time) / power });',
        '  }',
        '  var best = points[0];',
        '  var green = points[0];',
        '',
        '  points.forEach(function (point) {',
        '    if (point.time < best.time) best = point;',
        '    if (point.efficiency > green.efficiency) green = point;',
        '  });',
        '  return { points: points, best: best, green: green };',
        '}',
        '',
        'function lab() {',
        '  return { period: period, cpi: cpi, curve: curve };',
        '}'
      ].join('\n'),
      solution: [
        '/* Only the logic divides. The pipeline register between two stages is',
        '   paid in full by every stage, whatever the stage contains, and that is',
        '   what puts a floor under the period however deep the machine gets. */',
        'function period(depth, settings) {',
        '  return Math.ceil(settings.logic / Math.max(1, depth)) + settings.overhead;',
        '}',
        '',
        'function cpi(depth, settings) {',
        '  var penalty = Math.max(1, Math.round(depth * settings.resolveFraction));',
        '',
        '  return 1 + settings.hazardStalls +',
        '    settings.branchRate * settings.mispredictRate * penalty;',
        '}',
        '',
        '/* Performance CUBED per watt. The simpler ratio is maximised by doing',
        '   nothing at all, because power falls faster than speed does - which is',
        '   why the pipeline-depth literature uses this metric and not that one. */',
        'function curve(settings) {',
        '  var points = [];',
        '',
        '  for (var depth = settings.from; depth <= settings.to; depth += 1) {',
        '    var p = period(depth, settings);',
        '    var c = cpi(depth, settings);',
        '    var time = settings.instructions * c * p;',
        '    var power = (1 + settings.latchShare * depth) / p;',
        '',
        '    points.push({ depth: depth, period: p, cpi: c, time: time, power: power,',
        '      efficiency: Math.pow(1 / time, 3) / power });',
        '  }',
        '',
        '  var best = points[0];',
        '  var green = points[0];',
        '',
        '  points.forEach(function (point) {',
        '    if (point.time < best.time) best = point;',
        '    if (point.efficiency > green.efficiency) green = point;',
        '  });',
        '  return { points: points, best: best, green: green };',
        '}',
        '',
        'function lab() {',
        '  return { period: period, cpi: cpi, curve: curve };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'only the logic divides, and the overhead is paid per stage',
          assert: function (lab, api) {
            const parts = lab();
            const settings = { logic: 175, overhead: 3 };

            api.assert.equal(parts.period(1, settings), 178, '175 of logic plus 3');
            api.assert.equal(parts.period(5, settings), 38, '35 each, plus 3');
            api.assert.equal(parts.period(20, settings), 12,
              '9 each plus 3 — the overhead is now a quarter of the period');
          }
        },
        {
          name: 'the penalty grows with the depth, and so does the CPI',
          assert: function (lab, api) {
            const parts = lab();
            const settings = { hazardStalls: 0.15, branchRate: 0.25, mispredictRate: 0.12,
              resolveFraction: 0.8 };

            api.assert.ok(Math.abs(parts.cpi(1, settings) - 1.18) < 1e-9,
              'a penalty of 1 at one stage');
            api.assert.ok(Math.abs(parts.cpi(20, settings) - 1.63) < 1e-9,
              'a penalty of 16 at twenty — the same design change that shortened the clock');
            api.assert.ok(parts.cpi(40, settings) > parts.cpi(20, settings),
              'and it keeps rising');
          }
        },
        {
          name: 'the curve has a bottom rather than falling forever',
          assert: function (lab, api) {
            const parts = lab();
            const found = parts.curve({ logic: 175, overhead: 3, resolveFraction: 0.8,
              instructions: 1000, branchRate: 0.25, mispredictRate: 0.12, hazardStalls: 0.15,
              latchShare: 0.1, from: 1, to: 40 });

            api.assert.equal(found.points.length, 40, 'one point per depth');
            api.assert.ok(found.best.depth > 1 && found.best.depth < 40,
              'the optimum is inside the range, not at either end');
            api.assert.ok(found.points[39].time > found.best.time,
              'and the curve has turned upwards by the end of it');
          }
        },
        {
          name: 'the efficiency optimum is shallower than the performance one',
          assert: function (lab, api) {
            const parts = lab();
            const found = parts.curve({ logic: 175, overhead: 3, resolveFraction: 0.8,
              instructions: 1000, branchRate: 0.25, mispredictRate: 0.12, hazardStalls: 0.15,
              latchShare: 0.1, from: 1, to: 40 });

            api.assert.ok(found.green.depth > 1,
              'not depth one — that is what cubing the performance term prevents');
            api.assert.ok(found.green.depth < found.best.depth,
              'and shallower than the fastest, which is what the industry found');
          }
        }
      ]
    }],

    'pipeline-friendly-code': [{
      id: 'branchless-crossover',
      title: 'The branchless transform, and where it starts paying',
      prompt: 'Write lab() returning { mask, filter, breakEven }. mask(value, threshold) '
        + 'returns the branchless selector: 0 when value is below the threshold and -1 (all '
        + 'ones) when it is not — compute it as (value < threshold ? 1 : 0) minus one, so there '
        + 'is no branch in the arithmetic itself. filter(values, threshold) sums the values at '
        + 'or above the threshold using that mask and returns { sum, operations } where '
        + 'operations counts four per element, because every element pays for the load, the '
        + 'comparison, the mask and the add whether or not it passes. breakEven(runs) takes '
        + '{ branchy: { cycles, mispredicts }, branchless: { cycles, mispredicts }, penalty } — '
        + 'both measured at the same penalty — and returns the misprediction penalty at which '
        + 'the two are equal: the extra cycles the branchless version spends, divided by the '
        + 'mispredicts it avoids, plus the penalty already charged. Return null when it avoids '
        + 'none. The starter builds the mask with a conditional, which is the branch it was '
        + 'supposed to remove, and counts only the elements that pass.',
      entry: 'lab',
      starter: [
        'function mask(value, threshold) {',
        '  // A branch, in the function whose entire purpose is not having one.',
        '  if (value < threshold) return 0;',
        '  return -1;',
        '}',
        '',
        'function filter(values, threshold) {',
        '  var sum = 0;',
        '  var operations = 0;',
        '',
        '  values.forEach(function (value) {',
        '    // Only the elements that pass are counted, so the branchless',
        '    // version looks cheaper than it is.',
        '    if (value >= threshold) { sum += value; operations += 4; }',
        '  });',
        '  return { sum: sum, operations: operations };',
        '}',
        '',
        'function breakEven(runs) {',
        '  var saved = runs.branchy.mispredicts - runs.branchless.mispredicts;',
        '',
        '  // The penalty already charged is forgotten, so the answer is short by',
        '  // exactly that much.',
        '  if (saved <= 0) return null;',
        '  return (runs.branchless.cycles - runs.branchy.cycles) / saved;',
        '}',
        '',
        'function lab() {',
        '  return { mask: mask, filter: filter, breakEven: breakEven };',
        '}'
      ].join('\n'),
      solution: [
        '/* A comparison produces 0 or 1; subtracting one turns that into 0 or',
        '   all-ones. No branch, and the same three instructions execute for',
        '   every element whatever its value - which is the cost being weighed. */',
        'function mask(value, threshold) {',
        '  return (value < threshold ? 1 : 0) - 1;',
        '}',
        '',
        'function filter(values, threshold) {',
        '  var sum = 0;',
        '',
        '  values.forEach(function (value) {',
        '    sum += value & mask(value, threshold);',
        '  });',
        '  return { sum: sum, operations: 4 * values.length };',
        '}',
        '',
        '/* Solve for the penalty at which the two runs cost the same. Both were',
        '   measured at some penalty already, so that has to be added back - a',
        '   break-even reported relative to nothing is not a number anybody can',
        '   compare their machine against. */',
        'function breakEven(runs) {',
        '  var saved = runs.branchy.mispredicts - runs.branchless.mispredicts;',
        '',
        '  if (saved <= 0) return null;',
        '  return runs.penalty + (runs.branchless.cycles - runs.branchy.cycles) / saved;',
        '}',
        '',
        'function lab() {',
        '  return { mask: mask, filter: filter, breakEven: breakEven };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the mask is 0 below the threshold and all ones at or above it',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.mask(10, 128), 0, 'below');
            api.assert.equal(parts.mask(128, 128), -1, 'exactly at the threshold counts');
            api.assert.equal(parts.mask(200, 128), -1, 'and above');
            api.assert.equal(200 & parts.mask(200, 128), 200, 'the mask passes the value through');
            api.assert.equal(10 & parts.mask(10, 128), 0, 'or replaces it with zero');
          }
        },
        {
          name: 'the branchless filter computes the same sum as a branchy one',
          assert: function (lab, api) {
            const parts = lab();
            const values = [10, 200, 128, 127, 255, 0, 129];
            const got = parts.filter(values, 128);
            let want = 0;

            values.forEach(function (value) { if (value >= 128) want += value; });
            api.assert.equal(got.sum, want, 'same answer as the obvious loop');
            api.assert.equal(got.sum, 712, '200 + 128 + 255 + 129');
          }
        },
        {
          name: 'every element pays, which is the whole cost of going branchless',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.filter([1, 2, 3, 4], 128).operations, 16,
              'four elements, none of which pass, and all of which are paid for');
            api.assert.equal(parts.filter([200, 200], 128).operations, 8,
              'and the count does not depend on the data at all');
          }
        },
        {
          name: 'the measured break-even is about five cycles of penalty',
          assert: function (lab, api) {
            const parts = lab();
            const found = parts.breakEven({
              branchy: { cycles: 563, mispredicts: 34 },
              branchless: { cycles: 654, mispredicts: 1 },
              penalty: 2
            });

            api.assert.ok(Math.abs(found - (2 + 91 / 33)) < 1e-9,
              '91 extra cycles over 33 avoided mispredicts, plus the 2 already charged');
            api.assert.ok(found > 4.5 && found < 5.5,
              'about 4.8 — below it branchy wins, above it branchless does');
            api.assert.equal(parts.breakEven({
              branchy: { cycles: 503, mispredicts: 4 },
              branchless: { cycles: 654, mispredicts: 4 }, penalty: 2 }), null,
              'and on sorted data there are no mispredicts to avoid, so it never pays');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
