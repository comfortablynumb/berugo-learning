/**
 * Graded exercises for pipelining, structural hazards and forwarding
 * (M35.1-M35.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'pipelining-fundamentals': [{
      id: 'pipeline-accounting',
      title: 'Account for every cycle, and price the two clocks',
      prompt: 'Write lab() returning { attribute, time }. attribute(run) takes '
        + '{ cycles, retired, traps, causes } — causes being a map from a bubble\'s reason to '
        + 'how many of them reached write-back — and returns { rows, total, reconciles }: rows '
        + 'is one { name, cycles } per contributor starting with "instructions retired" and '
        + 'then "traps committed" (omitted when there are none) and then one row per cause in '
        + 'the order the keys appear, total is their sum, and reconciles says whether the total '
        + 'equals run.cycles. time(machine) takes { cycles, retired, period, pipelined } and '
        + 'returns the total in gate delays: cycles times period when pipelined is true, and '
        + 'retired times period when it is false — because an unpipelined machine takes one '
        + 'cycle per instruction and a pipelined one does not. The starter charges the fill as '
        + 'a constant four rather than counting what actually arrived, and multiplies by the '
        + 'instruction count either way.',
      entry: 'lab',
      starter: [
        'function attribute(run) {',
        '  // A constant fill, and the causes ignored. This is the version that',
        '  // was off by one on every program.',
        '  var rows = [{ name: "instructions retired", cycles: run.retired },',
        '    { name: "filling the pipeline", cycles: 4 }];',
        '  var total = rows.reduce(function (sum, row) { return sum + row.cycles; }, 0);',
        '',
        '  return { rows: rows, total: total, reconciles: total === run.cycles };',
        '}',
        '',
        'function time(machine) {',
        '  // Instructions times period, whether or not the machine is pipelined.',
        '  return machine.retired * machine.period;',
        '}',
        '',
        'function lab() {',
        '  return { attribute: attribute, time: time };',
        '}'
      ].join('\n'),
      solution: [
        '/* Every cycle either retired an instruction, committed a trap, or held',
        '   a bubble - and the bubbles are counted where they arrived rather than',
        '   where they were made, which is what makes the total exact. */',
        'function attribute(run) {',
        '  var rows = [{ name: "instructions retired", cycles: run.retired }];',
        '',
        '  if (run.traps) rows.push({ name: "traps committed", cycles: run.traps });',
        '  Object.keys(run.causes || {}).forEach(function (why) {',
        '    rows.push({ name: why, cycles: run.causes[why] });',
        '  });',
        '',
        '  var total = rows.reduce(function (sum, row) { return sum + row.cycles; }, 0);',
        '',
        '  return { rows: rows, total: total, reconciles: total === run.cycles };',
        '}',
        '',
        '/* A pipelined machine is charged per cycle and an unpipelined one per',
        '   instruction, because that is what each of them takes. Using the same',
        '   formula for both is how a pipeline gets credited for cycles it never',
        '   spent. */',
        'function time(machine) {',
        '  return machine.pipelined ? machine.cycles * machine.period',
        '    : machine.retired * machine.period;',
        '}',
        '',
        'function lab() {',
        '  return { attribute: attribute, time: time };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the sum program: 43 retired, one trap, four of fill and four of flush',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.attribute({ cycles: 52, retired: 43, traps: 1,
              causes: { 'filling the pipeline': 4, flush: 4 } });

            api.assert.equal(got.total, 52, '43 + 1 + 4 + 4');
            api.assert.equal(got.reconciles, true, 'and that is the cycle count');
            api.assert.equal(got.rows.length, 4, 'one row per contributor');
            api.assert.equal(got.rows[0].name, 'instructions retired', 'retirement first');
          }
        },
        {
          name: 'a run with no trap omits the trap row',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.attribute({ cycles: 13, retired: 8, traps: 0,
              causes: { 'filling the pipeline': 4, stall: 1 } });

            api.assert.equal(got.rows.length, 3, 'no trap, so three rows');
            api.assert.equal(got.total, 13, '8 + 4 + 1');
            api.assert.equal(got.reconciles, true, 'still exact');
          }
        },
        {
          name: 'a total that does not match is reported rather than hidden',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.attribute({ cycles: 52, retired: 43, traps: 1,
              causes: { 'filling the pipeline': 4 } });

            api.assert.equal(got.total, 48, 'the causes given do not cover the run');
            api.assert.equal(got.reconciles, false,
              'a model whose cycles do not add up has to say so');
          }
        },
        {
          name: 'the pipelined machine is charged per cycle and the other per instruction',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.time({ cycles: 43, retired: 43, period: 178,
              pipelined: false }), 7654, 'single cycle: 43 instructions at 178');
            api.assert.equal(parts.time({ cycles: 52, retired: 43, period: 151,
              pipelined: true }), 7852, 'pipelined: 52 cycles at 151 — and it lost');
            api.assert.equal(parts.time({ cycles: 52, retired: 43, period: 38,
              pipelined: true }), 1976, 'and with the stages balanced, it wins');
          }
        }
      ]
    }],

    'structural-hazards': [{
      id: 'memory-port-stalls',
      title: 'Stall the fetch when the memory stage has the port',
      prompt: 'Write lab() returning { stall, cost }. stall(latches, config) decides whether '
        + 'the fetch stage has to wait: with config.unifiedMemory true it must, and only if, '
        + 'the instruction in the memory stage — latches.memory — is a load or a store '
        + '(row.kind is "load" or "store"). Return { stage: "IF", reason: ... } when it stalls '
        + 'and null otherwise, and never stall when config.unifiedMemory is false, when the '
        + 'memory stage is empty or holds a bubble, or when the instruction there does not '
        + 'touch memory. cost(run) takes { unified, split } — two cycle counts for the same '
        + 'program — and returns { cycles, share }: the difference, and it as a fraction of the '
        + 'split-memory run. The starter stalls whenever anything at all is in the memory '
        + 'stage, and divides the saving by the wrong run.',
      entry: 'lab',
      starter: [
        'function stall(latches, config) {',
        '  // Everything in the memory stage is treated as a memory access,',
        '  // including the arithmetic instructions that are just passing through.',
        '  if (!config.unifiedMemory) return null;',
        '  if (!latches.memory) return null;',
        '  return { stage: "IF", reason: "the memory port is busy" };',
        '}',
        '',
        'function cost(run) {',
        '  var cycles = run.unified - run.split;',
        '',
        '  // Divided by the unified run, so the share is always understated.',
        '  return { cycles: cycles, share: cycles / run.unified };',
        '}',
        '',
        'function lab() {',
        '  return { stall: stall, cost: cost };',
        '}'
      ].join('\n'),
      solution: [
        '/* Only a load or a store uses the data port. An arithmetic instruction',
        '   occupies the memory stage and does nothing there, which is why a',
        '   program with no memory instructions pays nothing for sharing. */',
        'function stall(latches, config) {',
        '  if (!config.unifiedMemory) return null;',
        '  var entry = latches.memory;',
        '',
        '  if (!entry || entry.bubble || !entry.row) return null;',
        '  if (entry.row.kind !== "load" && entry.row.kind !== "store") return null;',
        '  return { stage: "IF",',
        '    reason: "structural: the memory stage is using the only memory port" };',
        '}',
        '',
        '/* The saving is a share of the machine you would otherwise have built,',
        '   which is the split one - dividing by the slower run flatters the',
        '   hardware you are trying to justify. */',
        'function cost(run) {',
        '  var cycles = run.unified - run.split;',
        '',
        '  return { cycles: cycles, share: run.split ? cycles / run.split : 0 };',
        '}',
        '',
        'function lab() {',
        '  return { stall: stall, cost: cost };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a load in the memory stage stalls the fetch; an add does not',
          assert: function (lab, api) {
            const parts = lab();
            const config = { unifiedMemory: true };

            api.assert.ok(parts.stall({ memory: { row: { kind: 'load' } } }, config),
              'a load uses the port');
            api.assert.ok(parts.stall({ memory: { row: { kind: 'store' } } }, config),
              'and so does a store');
            api.assert.equal(parts.stall({ memory: { row: { kind: 'alu' } } }, config), null,
              'an arithmetic instruction is only passing through');
            api.assert.equal(parts.stall({ memory: { bubble: true } }, config), null,
              'and a bubble is not an instruction');
          }
        },
        {
          name: 'two memories means no contention, whatever is in the stage',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.stall({ memory: { row: { kind: 'load' } } },
              { unifiedMemory: false }), null, 'a second port removes the conflict entirely');
            api.assert.equal(parts.stall({ memory: null }, { unifiedMemory: true }), null,
              'and an empty stage cannot contend');
          }
        },
        {
          name: 'the cost is a share of the machine you would otherwise have built',
          assert: function (lab, api) {
            const parts = lab();
            const strlen = parts.cost({ unified: 51, split: 46 });

            api.assert.equal(strlen.cycles, 5, '51 against 46');
            api.assert.ok(Math.abs(strlen.share - 5 / 46) < 1e-9,
              'divided by the split run, which is 10.9%');

            const sum = parts.cost({ unified: 52, split: 52 });

            api.assert.equal(sum.cycles, 0, 'a program with no memory instructions pays nothing');
            api.assert.equal(sum.share, 0, 'and its share is zero, not undefined');
          }
        }
      ]
    }],

    'data-hazards-and-forwarding': [{
      id: 'forwarding-unit',
      title: 'The forwarding unit, including the double hazard',
      prompt: 'Write lab() returning { forward, stall }. forward(register, latches, config) '
        + 'chooses where the execute stage should read one source operand from. latches has '
        + 'exMem (the instruction in the memory stage) and memWb (the one in write-back); each '
        + 'is null, a bubble, or an entry { rd, writes, load, value }. Return '
        + '{ source, value } where source is "x0" for register 0, "EX/MEM forward" or '
        + '"MEM/WB forward" when a producer is found, and "register file" otherwise (with value '
        + 'null, because the caller reads the file). EX/MEM must be checked FIRST — it is the '
        + 'more recent producer — and a load in EX/MEM is not a forwarding source at all, '
        + 'because its value does not exist yet. When config.forwarding is false, always return '
        + 'the register file. stall(consumer, latches, config) returns a reason string when the '
        + 'instruction in decode has to wait: with forwarding, only when the instruction in '
        + 'execute — latches.idEx — is a load writing a register the consumer reads; without '
        + 'forwarding, whenever idEx or exMem writes one. Return null otherwise. The starter '
        + 'checks MEM/WB first, which is the classic bug, and looks for the load in the wrong '
        + 'latch.',
      entry: 'lab',
      starter: [
        'function producer(entry, register) {',
        '  return entry && !entry.bubble && entry.writes && entry.rd === register;',
        '}',
        '',
        'function forward(register, latches, config) {',
        '  if (register === 0) return { source: "x0", value: 0 };',
        '  if (config && config.forwarding === false) {',
        '    return { source: "register file", value: null };',
        '  }',
        '  // MEM/WB first. When both wrote the register, this picks the OLDER',
        '  // value, and the machine is right on almost every program.',
        '  if (producer(latches.memWb, register)) {',
        '    return { source: "MEM/WB forward", value: latches.memWb.value };',
        '  }',
        '  if (producer(latches.exMem, register)) {',
        '    return { source: "EX/MEM forward", value: latches.exMem.value };',
        '  }',
        '  return { source: "register file", value: null };',
        '}',
        '',
        'function stall(consumer, latches, config) {',
        '  // The load is looked for in the memory stage, which is one stage too',
        '  // late: by then it is a perfectly good forwarding source.',
        '  var ahead = latches.exMem;',
        '',
        '  if (config && config.forwarding === false) {',
        '    if (producer(latches.idEx, consumer.rs1) || producer(latches.idEx, consumer.rs2)) {',
        '      return "no forwarding";',
        '    }',
        '    return null;',
        '  }',
        '  if (ahead && ahead.load &&',
        '    (ahead.rd === consumer.rs1 || ahead.rd === consumer.rs2)) return "load-use";',
        '  return null;',
        '}',
        '',
        'function lab() {',
        '  return { forward: forward, stall: stall };',
        '}'
      ].join('\n'),
      solution: [
        'function producer(entry, register) {',
        '  return Boolean(entry && !entry.bubble && entry.writes && entry.rd === register);',
        '}',
        '',
        '/* EX/MEM first, because when two instructions ahead both wrote this',
        '   register the newer one is the one you want. A load there has no value',
        '   yet - that case is a stall, not a forward, and the detection unit has',
        '   already arranged one. */',
        'function forward(register, latches, config) {',
        '  if (register === 0) return { source: "x0", value: 0 };',
        '  if (config && config.forwarding === false) {',
        '    return { source: "register file", value: null };',
        '  }',
        '  if (producer(latches.exMem, register) && !latches.exMem.load) {',
        '    return { source: "EX/MEM forward", value: latches.exMem.value };',
        '  }',
        '  if (producer(latches.memWb, register)) {',
        '    return { source: "MEM/WB forward", value: latches.memWb.value };',
        '  }',
        '  return { source: "register file", value: null };',
        '}',
        '',
        '/* The instruction one ahead of decode is in EXECUTE. Getting that',
        '   mapping wrong hides completely behind forwarding: the machine still',
        '   computes the right answers and simply never stalls. */',
        'function stall(consumer, latches, config) {',
        '  var reads = [consumer.rs1, consumer.rs2];',
        '  var noForwarding = Boolean(config && config.forwarding === false);',
        '',
        '  for (var at = 0; at < reads.length; at += 1) {',
        '    if (reads[at] === 0) continue;',
        '    if (producer(latches.idEx, reads[at])) {',
        '      if (noForwarding) return "no forwarding: waiting for the instruction ahead";',
        '      if (latches.idEx.load) return "load-use: the value is not loaded yet";',
        '    }',
        '    if (noForwarding && producer(latches.exMem, reads[at])) {',
        '      return "no forwarding: waiting for two instructions ahead";',
        '    }',
        '  }',
        '  return null;',
        '}',
        '',
        'function lab() {',
        '  return { forward: forward, stall: stall };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the double hazard: the more recent producer wins',
          assert: function (lab, api) {
            const parts = lab();
            const latches = {
              exMem: { rd: 12, writes: true, load: false, value: 13 },
              memWb: { rd: 12, writes: true, load: false, value: 3 }
            };
            const got = parts.forward(12, latches, {});

            api.assert.equal(got.source, 'EX/MEM forward',
              'the instruction one ahead is newer than the one two ahead');
            api.assert.equal(got.value, 13,
              'and 13 is the value the program means, not the 3 from before it');
          }
        },
        {
          name: 'a load in the memory stage is not a forwarding source',
          assert: function (lab, api) {
            const parts = lab();
            const latches = {
              exMem: { rd: 12, writes: true, load: true, value: 0 },
              memWb: null
            };

            api.assert.equal(parts.forward(12, latches, {}).source, 'register file',
              'the loaded word does not exist until the end of the memory stage');
            api.assert.equal(parts.forward(0, latches, {}).source, 'x0',
              'and x0 is never forwarded from anywhere');
          }
        },
        {
          name: 'the load-use stall looks at the execute stage, not the memory stage',
          assert: function (lab, api) {
            const parts = lab();
            const consumer = { rs1: 12, rs2: 0 };

            api.assert.ok(parts.stall(consumer,
              { idEx: { rd: 12, writes: true, load: true }, exMem: null }, {}),
              'the load is one instruction ahead, which is the execute stage');
            api.assert.equal(parts.stall(consumer,
              { idEx: null, exMem: { rd: 12, writes: true, load: true, value: 9 } }, {}), null,
              'a load two ahead has reached the memory stage and forwards normally');
            api.assert.equal(parts.stall(consumer,
              { idEx: { rd: 12, writes: true, load: false }, exMem: null }, {}), null,
              'an arithmetic producer forwards, so there is nothing to wait for');
          }
        },
        {
          name: 'without forwarding, every nearby producer costs a stall',
          assert: function (lab, api) {
            const parts = lab();
            const consumer = { rs1: 12, rs2: 0 };
            const config = { forwarding: false };

            api.assert.ok(parts.stall(consumer,
              { idEx: { rd: 12, writes: true, load: false }, exMem: null }, config),
              'a producer in execute');
            api.assert.ok(parts.stall(consumer,
              { idEx: null, exMem: { rd: 12, writes: true, load: false } }, config),
              'and one in memory');
            api.assert.equal(parts.forward(12,
              { exMem: { rd: 12, writes: true, value: 5 }, memWb: null }, config).source,
              'register file', 'and nothing is forwarded at all');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
