/**
 * Graded exercises for latches, state machines and memory (M33.6-M33.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'sequential-logic-and-state': [{
      id: 'latch-against-flipflop',
      title: 'A transparent latch and an edge-triggered flip-flop, side by side',
      prompt: 'Write lab() returning { run }. run(steps, kind) applies a list of '
        + '{ d, clk } steps in order, starting from a stored 0, and returns the array of stored '
        + 'values after each step. With kind "latch" the cell is transparent: while clk is 1 '
        + 'the stored value follows d. With kind "flipflop" it is edge-triggered: the stored '
        + 'value changes only on a RISING edge of clk — that is, only when clk is 1 and was 0 '
        + 'at the previous step — and it takes the value d has at that moment. The starter '
        + 'treats both the same way, which is the mistake that makes a design work in '
        + 'simulation and latch a glitch in hardware.',
      entry: 'lab',
      starter: [
        'function run(steps, kind) {',
        '  const out = [];',
        '  let stored = 0;',
        '',
        '  steps.forEach(function (step) {',
        '    // Level-sensitive in both cases: whenever the clock is high the',
        '    // value follows the data, edge or no edge.',
        '    if (step.clk) stored = step.d ? 1 : 0;',
        '    out.push(stored);',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      solution: [
        '/* The whole difference is whether the clock is read as a LEVEL or as an',
        '   EDGE. A latch is open for as long as the enable is high, so anything',
        '   that happens to the data during that window is stored; a flip-flop is',
        '   open only at the instant the clock rises, which is what lets a whole',
        '   machine sample its state at one moment. */',
        'function run(steps, kind) {',
        '  const out = [];',
        '  let stored = 0;',
        '  let previousClock = 0;',
        '',
        '  steps.forEach(function (step) {',
        '    const clock = step.clk ? 1 : 0;',
        '',
        '    if (kind === "latch") {',
        '      if (clock) stored = step.d ? 1 : 0;',
        '    } else if (clock === 1 && previousClock === 0) {',
        '      stored = step.d ? 1 : 0;',
        '    }',
        '    previousClock = clock;',
        '    out.push(stored);',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the latch follows the data while the enable is high',
          assert: function (lab, api) {
            const parts = lab();
            const steps = [{ d: 1, clk: 0 }, { d: 1, clk: 1 }, { d: 0, clk: 1 },
              { d: 0, clk: 0 }, { d: 1, clk: 0 }];

            api.assert.deepEqual(parts.run(steps, 'latch'), [0, 1, 0, 0, 0],
              'step 3 drops the data while the enable is still high, and the latch follows');
          }
        },
        {
          name: 'the flip-flop captures only at the rising edge',
          assert: function (lab, api) {
            const parts = lab();
            const steps = [{ d: 1, clk: 0 }, { d: 1, clk: 1 }, { d: 0, clk: 1 },
              { d: 0, clk: 0 }, { d: 1, clk: 0 }];

            api.assert.deepEqual(parts.run(steps, 'flipflop'), [0, 1, 1, 1, 1],
              'the data falling while the clock is high changes nothing');
            api.assert.deepEqual(parts.run([{ d: 1, clk: 1 }, { d: 0, clk: 1 },
              { d: 0, clk: 0 }, { d: 0, clk: 1 }], 'flipflop'), [1, 1, 1, 0],
              'and the next capture waits for the clock to fall and rise again');
          }
        }
      ]
    }],
    'hardware-state-machines': [{
      id: 'overlapping-detector',
      title: 'A 1101 detector that does not miss overlapping matches',
      prompt: 'Write lab() returning { detect }. detect(input) takes a string of 0s and 1s and '
        + 'returns a string of the same length: the output of a Moore machine that reports 1 in '
        + 'the cycle AFTER it has seen the pattern 1101. Matches may overlap — after a match, '
        + 'the trailing 1 of the pattern is also the leading 1 of a possible next one, so the '
        + 'machine must return to the "seen 11" state on a 1 rather than starting over. The '
        + 'starter resets to the start state after every match, which is the classic '
        + 'off-by-one-pattern bug and is invisible until two matches overlap.',
      entry: 'lab',
      starter: [
        'function next(state, bit) {',
        '  if (state === "start") return bit ? "one" : "start";',
        '  if (state === "one") return bit ? "oneOne" : "start";',
        '  if (state === "oneOne") return bit ? "oneOne" : "oneOneZero";',
        '  if (state === "oneOneZero") return bit ? "found" : "start";',
        '  // After a match, start again from scratch — which throws away the 1',
        '  // that has already been seen.',
        '  return "start";',
        '}',
        '',
        'function detect(input) {',
        '  let state = "start";',
        '  let out = "";',
        '',
        '  for (let at = 0; at < input.length; at += 1) {',
        '    out += state === "found" ? "1" : "0";',
        '    state = next(state, input[at] === "1" ? 1 : 0);',
        '  }',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect };',
        '}'
      ].join('\n'),
      solution: [
        '/* The overlap is the whole exercise. After a match the machine has just',
        '   consumed a 1, so on another 1 it is already in "seen 11", and on a 0',
        '   it is in "seen 110" — never back at the start. Getting this wrong',
        '   costs one match in every overlapping pair and nothing else, which is',
        '   why a test on a single occurrence passes it. */',
        'function next(state, bit) {',
        '  if (state === "start") return bit ? "one" : "start";',
        '  if (state === "one") return bit ? "oneOne" : "start";',
        '  if (state === "oneOne") return bit ? "oneOne" : "oneOneZero";',
        '  if (state === "oneOneZero") return bit ? "found" : "start";',
        '  return bit ? "oneOne" : "oneOneZero";',
        '}',
        '',
        'function detect(input) {',
        '  let state = "start";',
        '  let out = "";',
        '',
        '  for (let at = 0; at < input.length; at += 1) {',
        '    out += state === "found" ? "1" : "0";',
        '    state = next(state, input[at] === "1" ? 1 : 0);',
        '  }',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a single occurrence is reported one cycle after the pattern completes',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.detect('110100'), '000010',
              'the pattern ends at symbol 4, and a Moore output appears at symbol 5');
            api.assert.equal(parts.detect('000000'), '000000', 'and nothing else reports');
          }
        },
        {
          name: 'overlapping occurrences are all reported',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.detect('1101101101'), '0000100100',
              'three overlapping patterns, of which a resetting machine finds one');
            api.assert.equal(parts.detect('11011').length, 5, 'the output is the same length');
          }
        }
      ]
    }],
    'memory-arrays': [{
      id: 'read-during-write',
      title: 'A register file that answers the read-during-write question',
      prompt: 'Write lab() returning { run }. run(cycles, size) simulates a register file of '
        + '`size` registers, all starting at 0. Each cycle is { read, write, data, we }: the '
        + 'read port returns the value stored BEFORE the clock edge, and the write — when we is '
        + '1 — takes effect at the edge, so it is visible from the next cycle onwards. Return '
        + 'the array of values the read port produced. The starter applies the write first and '
        + 'then reads, so a cycle that reads the register it is writing returns the new value — '
        + 'which is a legitimate design and NOT the one specified here, and the difference is '
        + 'exactly why a pipeline needs a forwarding path.',
      entry: 'lab',
      starter: [
        'function run(cycles, size) {',
        '  const cells = [];',
        '  const out = [];',
        '',
        '  for (let at = 0; at < size; at += 1) cells.push(0);',
        '  cycles.forEach(function (cycle) {',
        '    // Write first, then read: the port sees the value written this',
        '    // very cycle.',
        '    if (cycle.we) cells[cycle.write] = cycle.data;',
        '    out.push(cells[cycle.read]);',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      solution: [
        '/* Sample the read port from the state BEFORE the edge, then apply the',
        '   write. Both orders describe real register files; the difference shows',
        '   up only on the cycles where a port reads the register being written,',
        '   and that handful of cycles is what a forwarding network exists for. */',
        'function run(cycles, size) {',
        '  const cells = [];',
        '  const out = [];',
        '',
        '  for (let at = 0; at < size; at += 1) cells.push(0);',
        '  cycles.forEach(function (cycle) {',
        '    out.push(cells[cycle.read]);',
        '    if (cycle.we) cells[cycle.write] = cycle.data;',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { run: run };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a write is visible from the next cycle, not the one that performs it',
          assert: function (lab, api) {
            const parts = lab();
            const cycles = [
              { read: 1, write: 1, data: 5, we: 1 },
              { read: 1, write: 0, data: 9, we: 0 },
              { read: 1, write: 1, data: 12, we: 1 },
              { read: 1, write: 0, data: 0, we: 0 }
            ];

            api.assert.deepEqual(parts.run(cycles, 4), [0, 5, 5, 12],
              'cycles 1 and 3 read the register they write, and see the old value');
          }
        },
        {
          name: 'writes to other registers are unaffected, and a disabled write stores nothing',
          assert: function (lab, api) {
            const parts = lab();
            const cycles = [
              { read: 2, write: 3, data: 7, we: 1 },
              { read: 3, write: 2, data: 4, we: 0 },
              { read: 2, write: 0, data: 0, we: 0 },
              { read: 3, write: 3, data: 1, we: 1 }
            ];

            api.assert.deepEqual(parts.run(cycles, 4), [0, 7, 0, 7],
              'register 2 was never written, and register 3 keeps 7 until the last edge');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
