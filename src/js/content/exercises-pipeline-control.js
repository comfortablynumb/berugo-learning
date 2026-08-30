/**
 * Graded exercises for control hazards and branch prediction (M35.4-M35.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'control-hazards': [{
      id: 'branch-penalty',
      title: 'Price a resolution point, both halves of it',
      prompt: 'Write lab() returning { penalty, resolve, cost }. penalty(stage) is the number '
        + 'of instructions thrown away when a branch resolving in that stage turns out to have '
        + 'been guessed wrong: the pipeline is IF, ID, EX, MEM, WB in that order, and the '
        + 'penalty is the number of stages strictly between fetch and the resolution stage, '
        + 'plus one. So resolving in ID costs 1 and resolving in EX costs 2. resolve(run) takes '
        + '{ redirects, stage, extraStalls } and returns { flushes, stalls, lost }: flushes is '
        + 'redirects times the penalty, stalls is extraStalls, and lost is their sum. '
        + 'cost(workload) takes { branchRate, mispredictRate, penalty } and returns the cycles '
        + 'lost per instruction, which is the product of the three. The starter treats the '
        + 'penalty as the stage index and forgets that early resolution costs stalls at all.',
      entry: 'lab',
      starter: [
        'var STAGES = ["IF", "ID", "EX", "MEM", "WB"];',
        '',
        'function penalty(stage) {',
        '  // The index, which is one too many everywhere.',
        '  return STAGES.indexOf(stage);',
        '}',
        '',
        'function resolve(run) {',
        '  var flushes = run.redirects * penalty(run.stage);',
        '',
        '  // The stalls early resolution costs are simply not counted, which',
        '  // makes it look free.',
        '  return { flushes: flushes, stalls: 0, lost: flushes };',
        '}',
        '',
        'function cost(workload) {',
        '  return workload.mispredictRate * workload.penalty;',
        '}',
        '',
        'function lab() {',
        '  return { penalty: penalty, resolve: resolve, cost: cost };',
        '}'
      ].join('\n'),
      solution: [
        'var STAGES = ["IF", "ID", "EX", "MEM", "WB"];',
        '',
        '/* The penalty is how many instructions were fetched on the guess, which',
        '   is the distance from fetch to the resolution stage. */',
        'function penalty(stage) {',
        '  var at = STAGES.indexOf(stage);',
        '',
        '  return at <= 0 ? 0 : at;',
        '}',
        '',
        '/* Early resolution buys flushes and costs stalls, because a branch whose',
        '   operand is still being computed one instruction ahead cannot be',
        '   compared yet - there is nothing anywhere to forward. Reporting only',
        '   the flush saving is how it comes to look free. */',
        'function resolve(run) {',
        '  var flushes = run.redirects * penalty(run.stage);',
        '  var stalls = run.extraStalls || 0;',
        '',
        '  return { flushes: flushes, stalls: stalls, lost: flushes + stalls };',
        '}',
        '',
        'function cost(workload) {',
        '  return workload.branchRate * workload.mispredictRate * workload.penalty;',
        '}',
        '',
        'function lab() {',
        '  return { penalty: penalty, resolve: resolve, cost: cost };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'resolving in decode costs one instruction and in execute costs two',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.penalty('ID'), 1, 'one instruction was fetched on the guess');
            api.assert.equal(parts.penalty('EX'), 2, 'two');
            api.assert.equal(parts.penalty('MEM'), 3, 'and a later resolution costs more still');
            api.assert.equal(parts.penalty('IF'), 0, 'a branch resolved at fetch costs nothing');
          }
        },
        {
          name: 'the sum loop: eleven redirects, and decode halves the flushes',
          assert: function (lab, api) {
            const parts = lab();
            const ex = parts.resolve({ redirects: 11, stage: 'EX', extraStalls: 0 });
            const id = parts.resolve({ redirects: 11, stage: 'ID', extraStalls: 0 });

            api.assert.equal(ex.flushes, 22, '11 redirects at 2 cycles');
            api.assert.equal(id.flushes, 11, 'and at 1');
            api.assert.equal(id.lost, 11, 'with no extra stalls, decode wins outright');
          }
        },
        {
          name: 'the factorial: decode halves the flushes and loses anyway',
          assert: function (lab, api) {
            const parts = lab();
            const ex = parts.resolve({ redirects: 34, stage: 'EX', extraStalls: 0 });
            const id = parts.resolve({ redirects: 34, stage: 'ID', extraStalls: 19 });

            api.assert.equal(ex.lost, 68, '34 redirects at 2');
            api.assert.equal(id.flushes, 34, 'halved, as promised');
            api.assert.equal(id.lost, 53,
              'but 19 stalls on top — and the measured run loses by more still');
          }
        },
        {
          name: 'the cost per instruction grows straight in proportion to the depth',
          assert: function (lab, api) {
            const parts = lab();
            const workload = { branchRate: 0.2, mispredictRate: 0.05 };

            api.assert.ok(Math.abs(parts.cost(Object.assign({ penalty: 1 }, workload)) - 0.010)
              < 1e-9, 'five stages');
            api.assert.ok(Math.abs(parts.cost(Object.assign({ penalty: 7 }, workload)) - 0.070)
              < 1e-9, 'twenty stages — 7% of a machine whose ideal is 1.000');
          }
        }
      ]
    }],

    'branch-prediction-basics': [{
      id: 'two-bit-and-returns',
      title: 'A two-bit counter and a return-address stack',
      prompt: 'Write lab() returning { counter, run, returns }. counter(value, taken) advances '
        + 'a two-bit saturating counter: taken moves it up and not-taken moves it down, '
        + 'clamped to 0 and 3. run(outcomes, bits) runs a predictor over a list of booleans '
        + 'starting from state 1 (weakly not taken) and returns { correct, accuracy, state }: a '
        + 'prediction is "taken" when the state is 2 or more for a two-bit predictor (bits = 2) '
        + 'and when the state is 1 for a one-bit predictor (bits = 1), which clamps to 0 and 1 '
        + 'instead. returns(events, depth) models a return-address stack of the given depth: an '
        + 'event is { call: address } or { ret: address }, a call pushes and a return pops, a '
        + 'push beyond the depth discards the OLDEST entry, and a return is predicted correctly '
        + 'when the popped address equals the event\'s address. Return { predicted, correct }. '
        + 'The starter uses a one-bit rule for both widths and lets the stack grow forever.',
      entry: 'lab',
      starter: [
        'function counter(value, taken) {',
        '  // No saturation: it walks straight past both ends.',
        '  return taken ? value + 1 : value - 1;',
        '}',
        '',
        'function run(outcomes, bits) {',
        '  var state = 1;',
        '  var correct = 0;',
        '',
        '  outcomes.forEach(function (taken) {',
        '    // The one-bit rule, whatever the width was supposed to be.',
        '    if ((state >= 1) === taken) correct += 1;',
        '    state = counter(state, taken);',
        '  });',
        '  return { correct: correct, accuracy: correct / outcomes.length, state: state };',
        '}',
        '',
        'function returns(events, depth) {',
        '  var stack = [];',
        '  var predicted = 0;',
        '  var correct = 0;',
        '',
        '  events.forEach(function (event) {',
        '    // No depth limit, so deep recursion never misses.',
        '    if (event.call !== undefined) { stack.push(event.call); return; }',
        '    predicted += 1;',
        '    if (stack.pop() === event.ret) correct += 1;',
        '  });',
        '  return { predicted: predicted, correct: correct };',
        '}',
        '',
        'function lab() {',
        '  return { counter: counter, run: run, returns: returns };',
        '}'
      ].join('\n'),
      solution: [
        '/* Saturating: the ends are the point. From strongly taken it takes two',
        '   mistakes to start predicting not-taken, which is what stops a loop',
        '   exit costing two mispredicts instead of one. */',
        'function counter(value, taken) {',
        '  if (taken) return Math.min(3, value + 1);',
        '  return Math.max(0, value - 1);',
        '}',
        '',
        'function run(outcomes, bits) {',
        '  var wide = bits !== 1;',
        '  var state = wide ? 1 : 0;',
        '  var correct = 0;',
        '',
        '  outcomes.forEach(function (taken) {',
        '    var guess = wide ? state >= 2 : state === 1;',
        '',
        '    if (guess === taken) correct += 1;',
        '    state = wide ? counter(state, taken) : (taken ? 1 : 0);',
        '  });',
        '  return { correct: correct,',
        '    accuracy: outcomes.length ? correct / outcomes.length : 0, state: state };',
        '}',
        '',
        '/* A fixed depth is the whole reason deep recursion stops being free: a',
        '   push beyond it loses the OLDEST entry, so the outermost returns are',
        '   the ones that mispredict, and nothing anywhere reports it. */',
        'function returns(events, depth) {',
        '  var stack = [];',
        '  var predicted = 0;',
        '  var correct = 0;',
        '',
        '  events.forEach(function (event) {',
        '    if (event.call !== undefined) {',
        '      stack.push(event.call);',
        '      if (stack.length > depth) stack.shift();',
        '      return;',
        '    }',
        '    predicted += 1;',
        '    if (stack.length && stack.pop() === event.ret) correct += 1;',
        '  });',
        '  return { predicted: predicted, correct: correct };',
        '}',
        '',
        'function lab() {',
        '  return { counter: counter, run: run, returns: returns };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the counter saturates at both ends',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.counter(3, true), 3, 'strongly taken stays there');
            api.assert.equal(parts.counter(0, false), 0, 'and so does strongly not taken');
            api.assert.equal(parts.counter(3, false), 2,
              'one mistake weakens the prediction rather than reversing it');
            api.assert.equal(parts.counter(2, false), 1, 'and the second one reverses it');
          }
        },
        {
          name: 'a loop entered five times: one bit misses twice per entry, two bits once',
          assert: function (lab, api) {
            const parts = lab();
            const outcomes = [];

            for (let visit = 0; visit < 5; visit += 1) {
              for (let at = 0; at < 10; at += 1) outcomes.push(at < 9);
            }
            const one = parts.run(outcomes, 1);
            const two = parts.run(outcomes, 2);

            api.assert.equal(outcomes.length, 50, 'five entries of ten iterations');
            api.assert.equal(50 - one.correct, 10, 'the one-bit predictor misses twice per entry');
            api.assert.equal(50 - two.correct, 6,
              'the two-bit one misses the exits and warms up once');
            api.assert.ok(two.accuracy > one.accuracy, 'so the extra bit pays');
          }
        },
        {
          name: 'alternating outcomes defeat both widths completely',
          assert: function (lab, api) {
            const parts = lab();
            const outcomes = [];

            for (let at = 0; at < 20; at += 1) outcomes.push(at % 2 === 0);
            api.assert.equal(parts.run(outcomes, 1).correct, 0,
              '"whatever happened last time" is exactly wrong every time');
            api.assert.ok(parts.run(outcomes, 2).correct <= 1,
              'and a wider counter does not help either — this needs history');
          }
        },
        {
          name: 'recursion deeper than the stack loses the outermost returns',
          assert: function (lab, api) {
            const parts = lab();

            function nest(depth) {
              const events = [];

              for (let at = 0; at < depth; at += 1) events.push({ call: 100 + at });
              for (let at = depth - 1; at >= 0; at -= 1) events.push({ ret: 100 + at });
              return events;
            }

            const shallow = parts.returns(nest(4), 8);

            api.assert.equal(shallow.predicted, 4, 'four returns');
            api.assert.equal(shallow.correct, 4, 'and a stack of eight predicts all of them');

            const deep = parts.returns(nest(12), 8);

            api.assert.equal(deep.predicted, 12, 'twelve returns');
            api.assert.equal(deep.correct, 8,
              'and only the innermost eight survive; the outer four were pushed out');
          }
        }
      ]
    }],

    'advanced-branch-prediction': [{
      id: 'gshare',
      title: 'gshare, and the fixture that shows why it exists',
      prompt: 'Write lab() returning { create, evaluate }. create(bits) returns a gshare '
        + 'predictor: a table of 2^bits two-bit counters all starting at 1, and a global '
        + 'history register starting at 0. Its slot for a program counter is '
        + '((pc >>> 2) XOR history) masked to bits bits; predict(pc) is whether that counter is '
        + '2 or more; update(pc, taken) saturates that counter and then shifts the outcome into '
        + 'the history, keeping the low bits bits. Expose predict, update and a sites() that '
        + 'is not needed by the tests. evaluate(predictor, trace) runs a list of '
        + '{ pc, taken } through it and returns { accuracy, sites } where sites maps each pc to '
        + '{ seen, right }. The starter never shifts the history, which turns gshare back into '
        + 'a plain bimodal predictor and passes every test that does not involve correlation.',
      entry: 'lab',
      starter: [
        'function create(bits) {',
        '  var size = 1 << bits;',
        '  var table = new Array(size).fill(1);',
        '  var history = 0;',
        '',
        '  function slot(pc) {',
        '    return (((pc >>> 2) ^ history) & (size - 1));',
        '  }',
        '',
        '  return {',
        '    predict: function (pc) { return table[slot(pc)] >= 2; },',
        '    update: function (pc, taken) {',
        '      var at = slot(pc);',
        '',
        '      table[at] = taken ? Math.min(3, table[at] + 1) : Math.max(0, table[at] - 1);',
        '      // The history is never updated, so the exclusive-or is always',
        '      // with zero and this is a bimodal predictor wearing a hat.',
        '    },',
        '    sites: function () { return table; }',
        '  };',
        '}',
        '',
        'function evaluate(predictor, trace) {',
        '  var sites = {};',
        '  var right = 0;',
        '',
        '  trace.forEach(function (row) {',
        '    var site = sites[row.pc] || (sites[row.pc] = { seen: 0, right: 0 });',
        '',
        '    site.seen += 1;',
        '    if (predictor.predict(row.pc) === row.taken) { right += 1; site.right += 1; }',
        '    predictor.update(row.pc, row.taken);',
        '  });',
        '  return { accuracy: right / trace.length, sites: sites };',
        '}',
        '',
        'function lab() {',
        '  return { create: create, evaluate: evaluate };',
        '}'
      ].join('\n'),
      solution: [
        '/* The history shift is the whole predictor. Without it the exclusive-or',
        '   is always with zero, every branch site gets exactly one counter, and',
        '   this is a bimodal predictor that happens to have a shift register',
        '   nobody writes to. */',
        'function create(bits) {',
        '  var size = 1 << bits;',
        '  var table = new Array(size).fill(1);',
        '  var history = 0;',
        '',
        '  function slot(pc) {',
        '    return (((pc >>> 2) ^ history) & (size - 1));',
        '  }',
        '',
        '  return {',
        '    predict: function (pc) { return table[slot(pc)] >= 2; },',
        '    update: function (pc, taken) {',
        '      var at = slot(pc);',
        '',
        '      table[at] = taken ? Math.min(3, table[at] + 1) : Math.max(0, table[at] - 1);',
        '      history = ((history << 1) | (taken ? 1 : 0)) & (size - 1);',
        '    },',
        '    sites: function () { return table; }',
        '  };',
        '}',
        '',
        'function evaluate(predictor, trace) {',
        '  var sites = {};',
        '  var right = 0;',
        '',
        '  trace.forEach(function (row) {',
        '    var site = sites[row.pc] || (sites[row.pc] = { seen: 0, right: 0 });',
        '',
        '    site.seen += 1;',
        '    if (predictor.predict(row.pc) === row.taken) { right += 1; site.right += 1; }',
        '    predictor.update(row.pc, row.taken);',
        '  });',
        '  return { accuracy: trace.length ? right / trace.length : 0, sites: sites };',
        '}',
        '',
        'function lab() {',
        '  return { create: create, evaluate: evaluate };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'on a plain loop, history makes it WORSE than a per-site counter',
          assert: function (lab, api) {
            const parts = lab();
            const trace = [];

            for (let visit = 0; visit < 6; visit += 1) {
              for (let at = 0; at < 10; at += 1) trace.push({ pc: 0x100, taken: at < 9 });
            }
            const got = parts.evaluate(parts.create(8), trace);

            /* A bimodal predictor is gshare with the history held at zero, so
               the comparison is exactly the cost of the exclusive-or. */
            let counter = 1;
            let right = 0;

            trace.forEach(function (row) {
              if ((counter >= 2) === row.taken) right += 1;
              counter = row.taken ? Math.min(3, counter + 1) : Math.max(0, counter - 1);
            });
            api.assert.ok(right / trace.length > 0.8, 'one counter handles a loop easily');
            api.assert.ok(got.accuracy < right / trace.length,
              'and spreading it across history patterns costs accuracy — this is the '
                + 'regression nobody mentions when describing gshare as an improvement');
          }
        },
        {
          name: 'alternating outcomes, which no per-site counter can do at all',
          assert: function (lab, api) {
            const parts = lab();
            const trace = [];

            for (let at = 0; at < 120; at += 1) trace.push({ pc: 0x200, taken: at % 2 === 0 });
            const got = parts.evaluate(parts.create(8), trace);

            api.assert.ok(got.accuracy > 0.9,
              'one bit of history is enough, and a counter without it scores zero');
          }
        },
        {
          name: 'the correlated fixture: the third branch is decided by the first two',
          assert: function (lab, api) {
            const parts = lab();
            const trace = [];
            let seed = 12345;

            for (let at = 0; at < 300; at += 1) {
              seed = (seed * 1664525 + 1013904223) >>> 0;
              const first = (seed >>> 16) % 2 === 1;

              seed = (seed * 1664525 + 1013904223) >>> 0;
              const second = (seed >>> 16) % 2 === 1;

              trace.push({ pc: 0x300, taken: first });
              trace.push({ pc: 0x304, taken: second });
              trace.push({ pc: 0x308, taken: first && second });
            }
            const got = parts.evaluate(parts.create(10), trace);
            const site = got.sites[0x308];

            api.assert.equal(site.seen, 300, 'the correlated site ran 300 times');
            api.assert.ok(site.right / site.seen > 0.80,
              'history separates the four cases; a per-site counter caps out around 0.75');
          }
        },
        {
          name: 'the history is bounded by the table width',
          assert: function (lab, api) {
            const parts = lab();
            const predictor = parts.create(4);

            for (let at = 0; at < 64; at += 1) predictor.update(0x400, true);
            api.assert.equal(predictor.predict(0x400), true,
              'sixty-four taken outcomes and the predictor still says taken');
            api.assert.equal(predictor.sites().length, 16, 'four bits is sixteen counters');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
