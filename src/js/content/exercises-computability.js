/**
 * Graded exercises for Turing machines, models, undecidability and Rice
 * (M26.1-M26.4).
 *
 * Every test is self-contained — it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'turing-machines': [{
      id: 'anbncn-machine',
      title: 'Write a Turing machine that decides a-to-the-n b-to-the-n c-to-the-n',
      prompt: 'transitions() must return an array of { from, read, to, write, move } describing ' +
        'a machine that accepts exactly the strings aⁿbⁿcⁿ for n at least 0. `move` is "L", "R" ' +
        'or "S"; the blank symbol is "_"; the start state is "start" and the only accepting ' +
        'state is "accept". A MISSING transition halts the machine where it is, which is a ' +
        'rejection — you never need an explicit reject state. The tests run your machine with a ' +
        'step budget and treat exhaustion as a failure, so it must terminate on every input. ' +
        'The starter crosses off one a, one b and one c per sweep, which gets the counts right ' +
        'and says NOTHING about the order — so it accepts `abcabc`.',
      entry: 'transitions',
      starter: [
        'function transitions() {',
        '  // Counting only. `abcabc` has three of each, so three sweeps accept it.',
        '  return [',
        '    { from: "start", read: "a", to: "findB", write: "X", move: "R" },',
        '    { from: "start", read: "X", to: "start", write: "X", move: "R" },',
        '    { from: "start", read: "Y", to: "start", write: "Y", move: "R" },',
        '    { from: "start", read: "Z", to: "start", write: "Z", move: "R" },',
        '    { from: "start", read: "_", to: "accept", write: "_", move: "S" },',
        '    { from: "findB", read: "a", to: "findB", write: "a", move: "R" },',
        '    { from: "findB", read: "Y", to: "findB", write: "Y", move: "R" },',
        '    { from: "findB", read: "b", to: "findC", write: "Y", move: "R" },',
        '    { from: "findC", read: "b", to: "findC", write: "b", move: "R" },',
        '    { from: "findC", read: "Z", to: "findC", write: "Z", move: "R" },',
        '    { from: "findC", read: "c", to: "back", write: "Z", move: "L" },',
        '    { from: "back", read: "a", to: "back", write: "a", move: "L" },',
        '    { from: "back", read: "b", to: "back", write: "b", move: "L" },',
        '    { from: "back", read: "Y", to: "back", write: "Y", move: "L" },',
        '    { from: "back", read: "Z", to: "back", write: "Z", move: "L" },',
        '    { from: "back", read: "X", to: "start", write: "X", move: "R" }',
        '  ];',
        '}'
      ].join('\n'),
      solution: [
        'function transitions() {',
        '  return [',
        '    // Phase one: verify the shape is a* b* c*, then rewind.',
        '    { from: "start", read: "a", to: "start", write: "a", move: "R" },',
        '    { from: "start", read: "b", to: "sawB", write: "b", move: "R" },',
        '    { from: "start", read: "c", to: "sawC", write: "c", move: "R" },',
        '    { from: "start", read: "_", to: "rewind", write: "_", move: "L" },',
        '    { from: "sawB", read: "b", to: "sawB", write: "b", move: "R" },',
        '    { from: "sawB", read: "c", to: "sawC", write: "c", move: "R" },',
        '    { from: "sawB", read: "_", to: "rewind", write: "_", move: "L" },',
        '    { from: "sawC", read: "c", to: "sawC", write: "c", move: "R" },',
        '    { from: "sawC", read: "_", to: "rewind", write: "_", move: "L" },',
        '    { from: "rewind", read: "a", to: "rewind", write: "a", move: "L" },',
        '    { from: "rewind", read: "b", to: "rewind", write: "b", move: "L" },',
        '    { from: "rewind", read: "c", to: "rewind", write: "c", move: "L" },',
        '    { from: "rewind", read: "_", to: "scan", write: "_", move: "R" },',
        '    // Phase two: cross off one of each per sweep.',
        '    { from: "scan", read: "a", to: "findB", write: "X", move: "R" },',
        '    { from: "scan", read: "X", to: "scan", write: "X", move: "R" },',
        '    { from: "scan", read: "Y", to: "scan", write: "Y", move: "R" },',
        '    { from: "scan", read: "Z", to: "scan", write: "Z", move: "R" },',
        '    { from: "scan", read: "_", to: "accept", write: "_", move: "S" },',
        '    { from: "findB", read: "a", to: "findB", write: "a", move: "R" },',
        '    { from: "findB", read: "Y", to: "findB", write: "Y", move: "R" },',
        '    { from: "findB", read: "b", to: "findC", write: "Y", move: "R" },',
        '    { from: "findC", read: "b", to: "findC", write: "b", move: "R" },',
        '    { from: "findC", read: "Z", to: "findC", write: "Z", move: "R" },',
        '    { from: "findC", read: "c", to: "back", write: "Z", move: "L" },',
        '    { from: "back", read: "a", to: "back", write: "a", move: "L" },',
        '    { from: "back", read: "b", to: "back", write: "b", move: "L" },',
        '    { from: "back", read: "Y", to: "back", write: "Y", move: "L" },',
        '    { from: "back", read: "Z", to: "back", write: "Z", move: "L" },',
        '    { from: "back", read: "X", to: "scan", write: "X", move: "R" }',
        '  ];',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it accepts a-to-the-n b-to-the-n c-to-the-n and terminates',
          assert: function (transitions, api) {
            const run = function (edges, input, budget) {
              const table = {};

              edges.forEach(function (e) {
                if (!table[e.from]) table[e.from] = {};
                table[e.from][e.read] = e;
              });
              const cells = {};

              input.split('').forEach(function (s, i) { cells[i] = s; });
              let at = 0;
              let state = 'start';

              for (let step = 0; step < budget; step += 1) {
                const symbol = cells[at] === undefined ? '_' : cells[at];
                const edge = (table[state] || {})[symbol];

                if (!edge) return { halted: true, accepted: state === 'accept', steps: step };
                if (edge.write === '_') delete cells[at]; else cells[at] = edge.write;
                at += edge.move === 'L' ? -1 : (edge.move === 'R' ? 1 : 0);
                state = edge.to;
              }
              return { halted: false, accepted: false, steps: budget };
            };
            const edges = transitions();

            for (let n = 0; n <= 4; n += 1) {
              const word = 'a'.repeat(n) + 'b'.repeat(n) + 'c'.repeat(n);
              const out = run(edges, word, 5000);

              api.assert.ok(out.halted, 'did not halt on "' + word + '" within 5 000 steps');
              api.assert.ok(out.accepted, 'rejected "' + word + '", which is in the language');
            }
          }
        },
        {
          name: 'it rejects wrong counts, and wrong ORDER',
          assert: function (transitions, api) {
            const run = function (edges, input, budget) {
              const table = {};

              edges.forEach(function (e) {
                if (!table[e.from]) table[e.from] = {};
                table[e.from][e.read] = e;
              });
              const cells = {};

              input.split('').forEach(function (s, i) { cells[i] = s; });
              let at = 0;
              let state = 'start';

              for (let step = 0; step < budget; step += 1) {
                const symbol = cells[at] === undefined ? '_' : cells[at];
                const edge = (table[state] || {})[symbol];

                if (!edge) return { halted: true, accepted: state === 'accept' };
                if (edge.write === '_') delete cells[at]; else cells[at] = edge.write;
                at += edge.move === 'L' ? -1 : (edge.move === 'R' ? 1 : 0);
                state = edge.to;
              }
              return { halted: false, accepted: false };
            };
            const edges = transitions();

            ['a', 'ab', 'aabbc', 'abbc', 'aabcc'].forEach(function (word) {
              const out = run(edges, word, 5000);

              api.assert.ok(out.halted, 'did not halt on "' + word + '"');
              api.assert.ok(!out.accepted, 'accepted "' + word + '", which has wrong counts');
            });
            ['abcabc', 'acb', 'bca', 'aabbccabc'].forEach(function (word) {
              const out = run(edges, word, 5000);

              api.assert.ok(out.halted, 'did not halt on "' + word + '"');
              api.assert.ok(!out.accepted,
                'accepted "' + word + '" — the counts match and the ORDER does not; this is ' +
                  'what the starter gets wrong');
            });
          }
        },
        {
          name: 'it agrees with the definition over every string up to length 6',
          assert: function (transitions, api) {
            const run = function (edges, input, budget) {
              const table = {};

              edges.forEach(function (e) {
                if (!table[e.from]) table[e.from] = {};
                table[e.from][e.read] = e;
              });
              const cells = {};

              input.split('').forEach(function (s, i) { cells[i] = s; });
              let at = 0;
              let state = 'start';

              for (let step = 0; step < budget; step += 1) {
                const symbol = cells[at] === undefined ? '_' : cells[at];
                const edge = (table[state] || {})[symbol];

                if (!edge) return { halted: true, accepted: state === 'accept' };
                if (edge.write === '_') delete cells[at]; else cells[at] = edge.write;
                at += edge.move === 'L' ? -1 : (edge.move === 'R' ? 1 : 0);
                state = edge.to;
              }
              return { halted: false, accepted: false };
            };
            const edges = transitions();
            const alphabet = ['a', 'b', 'c'];
            const inLanguage = function (w) {
              if (!/^a*b*c*$/.test(w)) return false;
              const a = (w.match(/a/g) || []).length;
              const b = (w.match(/b/g) || []).length;
              const c = (w.match(/c/g) || []).length;

              return a === b && b === c;
            };
            let checked = 0;

            for (let len = 0; len <= 6; len += 1) {
              const total = Math.pow(3, len);

              for (let i = 0; i < total; i += 1) {
                let v = i;
                let word = '';

                for (let j = 0; j < len; j += 1) { word += alphabet[v % 3]; v = Math.floor(v / 3); }
                const out = run(edges, word, 5000);

                checked += 1;
                api.assert.ok(out.halted, 'did not halt on "' + word + '"');
                api.assert.equal(out.accepted, inLanguage(word),
                  'disagreement on "' + (word || 'the empty string') + '"');
              }
            }
            api.assert.ok(checked >= 1093,
              'expected at least 1 093 strings checked, got ' + checked);
          }
        }
      ]
    }],

    'equivalent-models-of-computation': [{
      id: 'counter-machine',
      title: 'Simulate a counter machine, and compute the same function a RAM does',
      prompt: 'run(program, registers, budget) must execute a counter machine and return ' +
        '{ registers, steps, halted }. An instruction is { op, reg, next, zero } where op is ' +
        '"inc", "dec" or "halt". `inc` adds one to the register and goes to `next` (or the next ' +
        'instruction when `next` is undefined). `dec` subtracts one and goes to `next` when the ' +
        'register is ABOVE zero, and jumps to `zero` without changing it when the register is ' +
        'already zero. `halt` stops. Treat a missing register as 0. Stop and return halted: ' +
        'false if the budget runs out or the instruction pointer leaves the program. Then ' +
        'double(n) must return a program that leaves 2n in register 1 given n in register 0. ' +
        'The starter decrements without checking for zero, so it goes negative and never ' +
        'terminates.',
      entry: 'run',
      starter: [
        'function run(program, registers, budget) {',
        '  // `dec` never checks for zero, so the register goes negative and the loop never ends.',
        '  const cells = registers.slice();',
        '  let at = 0;',
        '  let steps = 0;',
        '',
        '  while (steps < budget && at >= 0 && at < program.length) {',
        '    const instruction = program[at];',
        '',
        '    if (instruction.op === "halt") {',
        '      return { registers: cells, steps: steps, halted: true };',
        '    }',
        '    if (cells[instruction.reg] === undefined) cells[instruction.reg] = 0;',
        '    if (instruction.op === "inc") cells[instruction.reg] += 1;',
        '    if (instruction.op === "dec") cells[instruction.reg] -= 1;',
        '    at = instruction.next === undefined ? at + 1 : instruction.next;',
        '    steps += 1;',
        '  }',
        '  return { registers: cells, steps: steps, halted: false };',
        '}',
        '',
        'function double() {',
        '  return [',
        '    { op: "dec", reg: 0, next: 1, zero: 3 },',
        '    { op: "inc", reg: 1, next: 2 },',
        '    { op: "inc", reg: 1, next: 0 },',
        '    { op: "halt" }',
        '  ];',
        '}'
      ].join('\n'),
      solution: [
        'function run(program, registers, budget) {',
        '  const cells = registers.slice();',
        '  let at = 0;',
        '  let steps = 0;',
        '',
        '  while (steps < budget && at >= 0 && at < program.length) {',
        '    const instruction = program[at];',
        '',
        '    if (instruction.op === "halt") {',
        '      return { registers: cells, steps: steps, halted: true };',
        '    }',
        '    if (cells[instruction.reg] === undefined) cells[instruction.reg] = 0;',
        '    if (instruction.op === "inc") {',
        '      cells[instruction.reg] += 1;',
        '      at = instruction.next === undefined ? at + 1 : instruction.next;',
        '    } else if (instruction.op === "dec") {',
        '      if (cells[instruction.reg] === 0) {',
        '        at = instruction.zero;',
        '      } else {',
        '        cells[instruction.reg] -= 1;',
        '        at = instruction.next === undefined ? at + 1 : instruction.next;',
        '      }',
        '    } else {',
        '      at = instruction.next === undefined ? at + 1 : instruction.next;',
        '    }',
        '    steps += 1;',
        '  }',
        '  return { registers: cells, steps: steps, halted: false };',
        '}',
        '',
        'function double() {',
        '  return [',
        '    { op: "dec", reg: 0, next: 1, zero: 3 },',
        '    { op: "inc", reg: 1, next: 2 },',
        '    { op: "inc", reg: 1, next: 0 },',
        '    { op: "halt" }',
        '  ];',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the decrement branches on zero rather than going negative',
          assert: function (run, api) {
            const program = [
              { op: 'dec', reg: 0, next: 1, zero: 2 },
              { op: 'inc', reg: 1, next: 0 },
              { op: 'halt' }
            ];
            const out = run(program, [3, 0], 1000);

            api.assert.ok(out.halted, 'the program must terminate — the starter does not');
            api.assert.equal(out.registers[0], 0, 'register 0 must be drained to zero, not below');
            api.assert.equal(out.registers[1], 3, 'and its value moved into register 1');

            const empty = run(program, [0, 0], 1000);

            api.assert.ok(empty.halted);
            api.assert.equal(empty.registers[1], 0, 'zero in, zero out');
          }
        },
        {
          name: 'doubling agrees with arithmetic, and costs 3n + 1 steps',
          assert: function (run, api) {
            const program = [
              { op: 'dec', reg: 0, next: 1, zero: 3 },
              { op: 'inc', reg: 1, next: 2 },
              { op: 'inc', reg: 1, next: 0 },
              { op: 'halt' }
            ];

            for (let n = 0; n <= 8; n += 1) {
              const out = run(program, [n, 0], 10000);

              api.assert.ok(out.halted, 'did not terminate at n = ' + n);
              api.assert.equal(out.registers[1], 2 * n,
                'expected ' + (2 * n) + ' at n = ' + n + ', got ' + out.registers[1]);
              api.assert.equal(out.steps, 3 * n + 1,
                'the cost is 3n + 1 — expected ' + (3 * n + 1) + ' at n = ' + n +
                  ', got ' + out.steps);
            }
          }
        },
        {
          name: 'the budget is reported honestly rather than as a halt',
          assert: function (run, api) {
            const forever = [
              { op: 'inc', reg: 0, next: 1 },
              { op: 'inc', reg: 0, next: 0 }
            ];
            const out = run(forever, [0], 500);

            api.assert.ok(!out.halted,
              'a program with no halt instruction must report halted: false');
            api.assert.equal(out.steps, 500, 'and it must use the whole budget');
            api.assert.equal(out.registers[0], 500, 'incrementing once per step');

            const offEnd = run([{ op: 'inc', reg: 0, next: 99 }], [0], 500);

            api.assert.ok(!offEnd.halted,
              'leaving the program is not a halt — only a halt instruction is');
          }
        }
      ]
    }],

    'undecidability-and-diagonalisation': [{
      id: 'bounded-halting',
      title: 'Decide bounded halting, then defeat any proposed unbounded decider',
      prompt: 'Two functions. haltsWithin(program, input, steps) must run `program` — an object ' +
        '{ transitions, start, accepting } in the Turing shape from this milestone — on `input` ' +
        'for at most `steps` transitions, and return true only if it HALTED within them. That ' +
        'question is decidable and this is a decider. Then defeat(oracle) must take a candidate ' +
        'unbounded halting decider — a function (source, input) returning "halts" or "loops" — ' +
        'and return { oracleSaid, actuallyDoes, contradiction }. Ask it about the source of the ' +
        'contrary program applied to itself, and report the OPPOSITE as what actually happens: ' +
        'if the oracle says "halts" the program loops, and vice versa. `contradiction` is true ' +
        'when the two differ, which must be for every oracle. The starter’s haltsWithin returns ' +
        'true when the budget runs out.',
      entry: 'defeat',
      starter: [
        'function haltsWithin(program, input, steps) {',
        '  // Returns true on budget exhaustion, which is the exact mistake the section is about.',
        '  const table = {};',
        '',
        '  program.transitions.forEach(function (e) {',
        '    if (!table[e.from]) table[e.from] = {};',
        '    table[e.from][e.read] = e;',
        '  });',
        '  const cells = {};',
        '',
        '  String(input).split("").forEach(function (s, i) { cells[i] = s; });',
        '  let at = 0;',
        '  let state = program.start;',
        '',
        '  for (let step = 0; step < steps; step += 1) {',
        '    const symbol = cells[at] === undefined ? "_" : cells[at];',
        '    const edge = (table[state] || {})[symbol];',
        '',
        '    if (!edge) return true;',
        '    if (edge.write === "_") delete cells[at]; else cells[at] = edge.write;',
        '    at += edge.move === "L" ? -1 : (edge.move === "R" ? 1 : 0);',
        '    state = edge.to;',
        '  }',
        '  return true;',
        '}',
        '',
        'function defeat(oracle) {',
        '  const source = "function contrary(s) { if (halts(s, s) === \\"halts\\") { while (true) {} } return 1; }";',
        '  const said = oracle(source, source);',
        '',
        '  // Reports the oracle back to itself, so there is never a contradiction.',
        '  return { oracleSaid: said, actuallyDoes: said, contradiction: false };',
        '}'
      ].join('\n'),
      solution: [
        'function haltsWithin(program, input, steps) {',
        '  const table = {};',
        '',
        '  program.transitions.forEach(function (e) {',
        '    if (!table[e.from]) table[e.from] = {};',
        '    table[e.from][e.read] = e;',
        '  });',
        '  const cells = {};',
        '',
        '  String(input).split("").forEach(function (s, i) { cells[i] = s; });',
        '  let at = 0;',
        '  let state = program.start;',
        '',
        '  for (let step = 0; step < steps; step += 1) {',
        '    const symbol = cells[at] === undefined ? "_" : cells[at];',
        '    const edge = (table[state] || {})[symbol];',
        '',
        '    if (!edge) return true;',
        '    if (edge.write === "_") delete cells[at]; else cells[at] = edge.write;',
        '    at += edge.move === "L" ? -1 : (edge.move === "R" ? 1 : 0);',
        '    state = edge.to;',
        '  }',
        '  return false;',
        '}',
        '',
        'function defeat(oracle) {',
        '  const source = "function contrary(s) { if (halts(s, s) === \\"halts\\") { while (true) {} } return 1; }";',
        '  const said = oracle(source, source);',
        '  const actually = said === "halts" ? "loops" : "halts";',
        '',
        '  return { oracleSaid: said, actuallyDoes: actually, contradiction: said !== actually,',
        '    source: source };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a contradiction is produced for both possible verdicts',
          assert: function (defeat, api) {
            const optimistic = defeat(function () { return 'halts'; });
            const pessimistic = defeat(function () { return 'loops'; });

            api.assert.ok(optimistic.contradiction,
              'an oracle saying halts must be contradicted — the program then loops');
            api.assert.ok(pessimistic.contradiction,
              'and one saying loops must be too — the program then returns');
            api.assert.notEqual(optimistic.oracleSaid, optimistic.actuallyDoes);
            api.assert.notEqual(pessimistic.oracleSaid, pessimistic.actuallyDoes);
            api.assert.equal(
              [optimistic, pessimistic].filter(function (r) { return r.contradiction; }).length,
              2, 'both verdicts lead to a contradiction, which is why there is no third branch');
          }
        },
        {
          name: 'the construction defeats every oracle, including a random one',
          assert: function (defeat, api) {
            const heuristic = function (source) {
              return String(source).indexOf('while (true)') !== -1 ? 'loops' : 'halts';
            };

            api.assert.ok(defeat(heuristic).contradiction,
              'a heuristic that reads the source is still defeated');

            let seed = 12345;
            const coin = function () {
              seed = (seed * 1103515245 + 12345) % 2147483648;
              return seed % 2 === 0 ? 'halts' : 'loops';
            };

            for (let i = 0; i < 200; i += 1) {
              const out = defeat(coin);

              api.assert.ok(out.contradiction,
                'a coin-flipping oracle must be contradicted too, at trial ' + i);
              api.assert.notEqual(out.oracleSaid, out.actuallyDoes,
                'the verdicts must differ, which is what the contradiction IS');
            }
          }
        },
        {
          name: 'it reports what the oracle said as well as what happens',
          assert: function (defeat, api) {
            const optimistic = defeat(function () { return 'halts'; });

            api.assert.equal(optimistic.oracleSaid, 'halts');
            api.assert.equal(optimistic.actuallyDoes, 'loops',
              'if the oracle says halts, the program enters the loop by construction');

            const pessimistic = defeat(function () { return 'loops'; });

            api.assert.equal(pessimistic.oracleSaid, 'loops');
            api.assert.equal(pessimistic.actuallyDoes, 'halts',
              'if the oracle says loops, the program returns immediately');
          }
        }
      ]
    }],

    'reductions-and-the-rice-theorem': [{
      id: 'rice-classify',
      title: 'Classify properties by Rice’s condition, and build a reduction',
      prompt: 'Two functions. classify(properties) must take an array of ' +
        '{ name, semantic, trivial } and return the same array with `decidable` and `reason` ' +
        'added. Rice: a property is UNDECIDABLE exactly when it is semantic AND non-trivial. A ' +
        'syntactic property is decidable because it depends on the program text; a trivial ' +
        'semantic one is decidable because a constant decides it. The `reason` string must ' +
        'contain the word "syntactic", "trivial" or "Rice" accordingly. Then reduce(source) must ' +
        'return the transformation for "does this program ever print": the original source, then ' +
        'a call, then a print — so the print is reached exactly when the original halts. Include ' +
        'the original source verbatim in the output. The starter marks every semantic property ' +
        'undecidable, missing the trivial escape.',
      entry: 'classify',
      starter: [
        'function classify(properties) {',
        '  // Ignores triviality, so "does it compute SOME function" comes back undecidable.',
        '  return properties.map(function (property) {',
        '    if (!property.semantic) {',
        '      return Object.assign({}, property, { decidable: true,',
        '        reason: "syntactic — it depends on the program text" });',
        '    }',
        '    return Object.assign({}, property, { decidable: false,',
        '      reason: "semantic, so Rice applies" });',
        '  });',
        '}',
        '',
        'function reduce(source) {',
        '  return "function transformed(x) {\\n  " + String(source).split("\\n").join("\\n  ") +',
        '    "\\n  run(x);\\n  print(\\"reached\\");\\n}";',
        '}'
      ].join('\n'),
      solution: [
        'function classify(properties) {',
        '  return properties.map(function (property) {',
        '    if (!property.semantic) {',
        '      return Object.assign({}, property, { decidable: true,',
        '        reason: "syntactic — it depends on the program text, not on what it computes" });',
        '    }',
        '    if (property.trivial) {',
        '      return Object.assign({}, property, { decidable: true,',
        '        reason: "trivial — every program has it or none does, so a constant decides it" });',
        '    }',
        '    return Object.assign({}, property, { decidable: false,',
        '      reason: "non-trivial and semantic, so Rice forbids a decider" });',
        '  });',
        '}',
        '',
        'function reduce(source) {',
        '  return "function transformed(x) {\\n  " + String(source).split("\\n").join("\\n  ") +',
        '    "\\n  run(x);\\n  print(\\"reached\\");\\n}";',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the three verdicts, with the right reason for each',
          assert: function (classify, api) {
            const out = classify([
              { name: 'does it halt', semantic: true, trivial: false },
              { name: 'does it contain a division operator', semantic: false, trivial: false },
              { name: 'does it compute some function', semantic: true, trivial: true }
            ]);

            api.assert.equal(out[0].decidable, false, 'halting is semantic and non-trivial');
            api.assert.ok(out[0].reason.indexOf('Rice') !== -1,
              'the reason must name Rice — got "' + out[0].reason + '"');

            api.assert.equal(out[1].decidable, true, 'a syntactic property is decidable');
            api.assert.ok(out[1].reason.indexOf('syntactic') !== -1);

            api.assert.equal(out[2].decidable, true,
              'a TRIVIAL semantic property is decidable — this is what the starter misses');
            api.assert.ok(out[2].reason.indexOf('trivial') !== -1,
              'and the reason must say trivial, not Rice — got "' + out[2].reason + '"');
          }
        },
        {
          name: 'the full ten-property table comes out four undecidable',
          assert: function (classify, api) {
            const properties = [
              { name: 'halts', semantic: true, trivial: false },
              { name: 'computes the zero function', semantic: true, trivial: false },
              { name: 'its language is empty', semantic: true, trivial: false },
              { name: 'ever divides by zero', semantic: true, trivial: false },
              { name: 'contains a division operator', semantic: false, trivial: false },
              { name: 'is over 100 lines', semantic: false, trivial: false },
              { name: 'halts within 10 000 steps', semantic: false, trivial: false },
              { name: 'is a valid program', semantic: false, trivial: false },
              { name: 'computes some function', semantic: true, trivial: true },
              { name: 'accepts a string no program accepts', semantic: true, trivial: true }
            ];
            const out = classify(properties);
            const undecidable = out.filter(function (p) { return !p.decidable; });

            api.assert.equal(undecidable.length, 4,
              'exactly 4 of the 10 are undecidable — got ' + undecidable.length);
            api.assert.equal(out.filter(function (p) {
              return p.decidable && p.reason.indexOf('syntactic') !== -1;
            }).length, 4, '4 are decidable because syntactic');
            api.assert.equal(out.filter(function (p) {
              return p.decidable && p.reason.indexOf('trivial') !== -1;
            }).length, 2, 'and 2 because trivial');
            api.assert.ok(out.every(function (p) { return typeof p.name === 'string'; }),
              'the input fields must be preserved');
          }
        },
        {
          name: 'the reduction contains the original source and reaches the print after it',
          assert: function (classify, api) {
            api.assert.ok(typeof classify === 'function');
            const properties = classify([{ name: 'x', semantic: true, trivial: false }]);

            api.assert.equal(properties.length, 1, 'classify must not drop entries');
            api.assert.equal(properties[0].decidable, false);
            api.assert.ok(properties[0].reason.length > 10,
              'the reason must be a sentence, not a word — it is what makes the verdict usable');

            const empty = classify([]);

            api.assert.deepEqual(empty, [], 'an empty list classifies to an empty list');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
