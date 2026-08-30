/**
 * Graded exercises for the single-cycle datapath and the control unit
 * (M34.4-M34.5).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'single-cycle-datapath': [{
      id: 'load-datapath',
      title: 'Wire the load instruction through the datapath',
      prompt: 'Write lab() returning { execute, period }. execute(state, control) runs one cycle '
        + 'of a small datapath and returns the new { regs, pc }. state is { regs, pc, memory, '
        + 'rs1, rs2, rd, imm }. control is { aluSrc, memRead, memWrite, regWrite, writeBack } '
        + 'where writeBack is "alu" or "memory". The ALU adds its two operands: the first is '
        + 'always regs[rs1]; the second is imm when aluSrc is true and regs[rs2] otherwise. When '
        + 'memRead, the loaded value is memory[aluResult]; when memWrite, memory[aluResult] is '
        + 'set to regs[rs2]. The write-back value is the ALU result or the loaded word according '
        + 'to writeBack, and it is written to regs[rd] only when regWrite is true and rd is not '
        + '0. pc always advances by 4. period(blocks) returns the clock period: the sum of the '
        + 'delays along the longest path — register file, ALU, memory, write back — plus 3 of '
        + 'flip-flop overhead. The starter writes the ALU result back for every instruction and '
        + 'lets x0 be written.',
      entry: 'lab',
      starter: [
        'function execute(state, control) {',
        '  const regs = state.regs.slice();',
        '  const memory = state.memory;',
        '  const b = control.aluSrc ? state.imm : regs[state.rs2];',
        '  const alu = regs[state.rs1] + b;',
        '',
        '  if (control.memWrite) memory[alu] = regs[state.rs2];',
        '',
        '  // Two bugs: the loaded word is computed and then ignored, and x0',
        '  // is written like any other register.',
        '  if (control.regWrite) regs[state.rd] = alu;',
        '  return { regs: regs, pc: state.pc + 4 };',
        '}',
        '',
        'function period(blocks) {',
        '  // The overhead is not free, and it is not divided either.',
        '  return blocks.registerFile + blocks.alu + blocks.memory + blocks.writeBack;',
        '}',
        '',
        'function lab() {',
        '  return { execute: execute, period: period };',
        '}'
      ].join('\n'),
      solution: [
        '/* The load is the instruction that uses the whole datapath in series:',
        '   read a register, add the immediate to get an address, read memory,',
        '   and only then write back. Every stage feeds the next, which is why',
        '   this class sets the clock period. */',
        'function execute(state, control) {',
        '  const regs = state.regs.slice();',
        '  const memory = state.memory;',
        '  const b = control.aluSrc ? state.imm : regs[state.rs2];',
        '  const alu = regs[state.rs1] + b;',
        '  const loaded = control.memRead ? memory[alu] : 0;',
        '',
        '  if (control.memWrite) memory[alu] = regs[state.rs2];',
        '',
        '  const value = control.writeBack === "memory" ? loaded : alu;',
        '',
        '  /* x0 has no write enable in the register file. The safety is',
        '     structural rather than a check somebody could forget. */',
        '  if (control.regWrite && state.rd !== 0) regs[state.rd] = value;',
        '  return { regs: regs, pc: state.pc + 4 };',
        '}',
        '',
        '/* Only the logic divides between stages; the flip-flop overhead is paid',
        '   once per clock however the logic is arranged. */',
        'function period(blocks) {',
        '  return blocks.registerFile + blocks.alu + blocks.memory + blocks.writeBack + 3;',
        '}',
        '',
        'function lab() {',
        '  return { execute: execute, period: period };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a load writes the word from memory, not the address it computed',
          assert: function (lab, api) {
            const parts = lab();
            const memory = {};

            memory[108] = 42;
            const out = parts.execute({
              regs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0], pc: 0, memory: memory,
              rs1: 10, rs2: 0, rd: 11, imm: 8
            }, { aluSrc: true, memRead: true, memWrite: false, regWrite: true, writeBack: 'memory' });

            api.assert.equal(out.regs[11], 42, 'lw a1, 8(a0) with a0 = 100 loads memory[108]');
            api.assert.equal(out.pc, 4, 'and the program counter still advances by 4');
          }
        },
        {
          name: 'a store writes memory and no register',
          assert: function (lab, api) {
            const parts = lab();
            const memory = {};
            const regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 7];
            const out = parts.execute({
              regs: regs, pc: 16, memory: memory, rs1: 10, rs2: 11, rd: 8, imm: 8
            }, { aluSrc: true, memRead: false, memWrite: true, regWrite: false, writeBack: 'alu' });

            api.assert.equal(memory[108], 7, 'sw a1, 8(a0) stores rs2 at the computed address');
            api.assert.equal(out.regs[8], 0, 'and the write port is idle for a store');
          }
        },
        {
          name: 'x0 stays zero however hard an instruction tries',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.execute({
              regs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0], pc: 0, memory: {},
              rs1: 10, rs2: 0, rd: 0, imm: 99
            }, { aluSrc: true, memRead: false, memWrite: false, regWrite: true, writeBack: 'alu' });

            api.assert.equal(out.regs[0], 0, 'the register file has no write enable for row zero');
          }
        },
        {
          name: 'the clock period charges for the flip-flops as well as the logic',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.period({ registerFile: 16, alu: 148, memory: 8, writeBack: 3 }),
              178, '16 + 148 + 8 + 3 of logic, plus 3 of flip-flop overhead');
            api.assert.equal(parts.period({ registerFile: 0, alu: 0, memory: 0, writeBack: 0 }),
              3, 'a machine with no logic at all still pays the overhead');
          }
        }
      ]
    }],

    'the-control-unit': [{
      id: 'hardwired-decoder',
      title: 'Build the decoder from the table, and refuse what is not in it',
      prompt: 'Write lab() returning { decode, fanIn }. decode(opcode) returns the control '
        + 'vector { regWrite, aluSrc, memRead, memWrite, branch, jump, writeBack } for the given '
        + 'opcode, from this table: op (0x33) writes a register from the ALU; opImm (0x13) does '
        + 'too, with the immediate as the second operand; load (0x03) uses the immediate, reads '
        + 'memory and writes back the memory value; store (0x23) uses the immediate and writes '
        + 'memory; branch (0x63) asserts branch and nothing else; jal (0x6f) writes a register '
        + 'from "pc4" and asserts jump; jalr (0x67) does the same and also uses the immediate; '
        + 'lui (0x37) writes a register from "imm"; auipc (0x17) uses the immediate and writes '
        + 'back the ALU result. Any other opcode must return every boolean false — an undefined '
        + 'instruction must not write anything. fanIn(signal) returns how many of the nine '
        + 'opcodes assert that boolean signal, which is the fan-in of the OR gate the decoder '
        + 'builds for it. The starter falls through to the arithmetic vector for unknown '
        + 'opcodes.',
      entry: 'lab',
      starter: [
        'var TABLE = {',
        '  0x33: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x13: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x03: { regWrite: true, aluSrc: true, memRead: true, memWrite: false,',
        '    branch: false, jump: false, writeBack: "memory" },',
        '  0x23: { regWrite: false, aluSrc: true, memRead: false, memWrite: true,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x63: { regWrite: false, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: true, jump: false, writeBack: "alu" },',
        '  0x6f: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: true, writeBack: "pc4" },',
        '  0x67: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: true, writeBack: "pc4" },',
        '  0x37: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "imm" },',
        '  0x17: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" }',
        '};',
        '',
        'function decode(opcode) {',
        '  // An opcode nobody defined gets the arithmetic vector, which asserts',
        '  // regWrite. That is a machine that corrupts state on a corrupt word.',
        '  return TABLE[opcode] || TABLE[0x33];',
        '}',
        '',
        'function fanIn(signal) {',
        '  return 9;',
        '}',
        '',
        'function lab() {',
        '  return { decode: decode, fanIn: fanIn };',
        '}'
      ].join('\n'),
      solution: [
        'var TABLE = {',
        '  0x33: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x13: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x03: { regWrite: true, aluSrc: true, memRead: true, memWrite: false,',
        '    branch: false, jump: false, writeBack: "memory" },',
        '  0x23: { regWrite: false, aluSrc: true, memRead: false, memWrite: true,',
        '    branch: false, jump: false, writeBack: "alu" },',
        '  0x63: { regWrite: false, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: true, jump: false, writeBack: "alu" },',
        '  0x6f: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: true, writeBack: "pc4" },',
        '  0x67: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: true, writeBack: "pc4" },',
        '  0x37: { regWrite: true, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "imm" },',
        '  0x17: { regWrite: true, aluSrc: true, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" }',
        '};',
        '',
        '/* An unmatched opcode fires no AND term, so no OR fires, so every',
        '   signal is low. Written as a table lookup that means an explicit',
        '   all-false vector rather than a fall-through to anything. */',
        'function decode(opcode) {',
        '  if (Object.prototype.hasOwnProperty.call(TABLE, opcode)) return TABLE[opcode];',
        '  return { regWrite: false, aluSrc: false, memRead: false, memWrite: false,',
        '    branch: false, jump: false, writeBack: "alu" };',
        '}',
        '',
        '/* A column of the table is an OR gate, and its fan-in is the number of',
        '   ones in that column. Most columns are nearly empty, which is why the',
        '   whole decoder is smaller than one adder. */',
        'function fanIn(signal) {',
        '  return Object.keys(TABLE).filter(function (key) {',
        '    return TABLE[key][signal] === true;',
        '  }).length;',
        '}',
        '',
        'function lab() {',
        '  return { decode: decode, fanIn: fanIn };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the load vector reads memory, uses the immediate and writes back the word',
          assert: function (lab, api) {
            const parts = lab();
            const load = parts.decode(0x03);

            api.assert.equal(load.regWrite, true, 'a load writes a register');
            api.assert.equal(load.aluSrc, true, 'the address is rs1 plus the immediate');
            api.assert.equal(load.memRead, true, 'and it reads memory');
            api.assert.equal(load.writeBack, 'memory', 'writing back the loaded word, not the address');

            const store = parts.decode(0x23);

            api.assert.equal(store.regWrite, false, 'a store writes no register');
            api.assert.equal(store.memWrite, true, 'and it does write memory');
          }
        },
        {
          name: 'an opcode with no row writes nothing at all',
          assert: function (lab, api) {
            const parts = lab();

            for (let opcode = 0; opcode < 128; opcode += 1) {
              const known = [0x33, 0x13, 0x03, 0x23, 0x63, 0x6f, 0x67, 0x37, 0x17];

              if (known.indexOf(opcode) !== -1) continue;
              const vector = parts.decode(opcode);

              api.assert.equal(vector.regWrite, false, 'opcode ' + opcode + ' must not write a register');
              api.assert.equal(vector.memWrite, false, 'opcode ' + opcode + ' must not write memory');
            }
          }
        },
        {
          name: 'the fan-in of each column is the size of the OR gate it becomes',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.fanIn('memWrite'), 1, 'only the store row: a wire, not a gate');
            api.assert.equal(parts.fanIn('memRead'), 1, 'only the load row');
            api.assert.equal(parts.fanIn('branch'), 1, 'only the branch row');
            api.assert.equal(parts.fanIn('jump'), 2, 'jal and jalr');
            api.assert.equal(parts.fanIn('aluSrc'), 5, 'opImm, load, store, jalr and auipc');
            api.assert.equal(parts.fanIn('regWrite'), 7, 'everything except store and branch');
          }
        },
        {
          name: 'no opcode asserts more than three of the six boolean signals',
          assert: function (lab, api) {
            const parts = lab();
            const names = ['regWrite', 'aluSrc', 'memRead', 'memWrite', 'branch', 'jump'];
            let widest = 0;

            [0x33, 0x13, 0x03, 0x23, 0x63, 0x6f, 0x67, 0x37, 0x17].forEach(function (opcode) {
              const vector = parts.decode(opcode);
              const count = names.filter(function (name) { return vector[name] === true; }).length;

              if (count > widest) widest = count;
            });
            api.assert.equal(widest, 3, 'the load and jalr rows, at three each — that sparseness is the 103 gates');
          }
        }
      ]
    }],

    'multi-cycle-execution': [{
      id: 'performance-equation',
      title: 'Evaluate the performance equation, and find the break-even',
      prompt: 'Write lab() returning { cpi, time, breakEven }. cpi(counts, cycles) takes a map '
        + 'of instruction class to how many were executed and a map of class to cycles each, '
        + 'and returns the weighted average — the total cycles divided by the total '
        + 'instructions, or 0 if nothing ran. time(machine) takes { instructions, cpi, period } '
        + 'and returns the product, rounded to the nearest integer. breakEven(single, multi) '
        + 'takes two such machines and returns the clock period at which the multi-cycle '
        + 'machine would tie the single-cycle one: the single-cycle total time divided by the '
        + 'multi-cycle machine\'s cycle count, rounded DOWN, because a period above it loses. '
        + 'The starter averages the cycles instead of weighting them by how often each class '
        + 'ran, and forgets that the period is what breakEven solves for.',
      entry: 'lab',
      starter: [
        'function cpi(counts, cycles) {',
        '  // The unweighted mean of the cycle counts: right only when every',
        '  // class ran the same number of times, which no program does.',
        '  const kinds = Object.keys(counts);',
        '  let sum = 0;',
        '',
        '  kinds.forEach(function (kind) { sum += cycles[kind]; });',
        '  return kinds.length ? sum / kinds.length : 0;',
        '}',
        '',
        'function time(machine) {',
        '  return Math.round(machine.instructions * machine.cpi * machine.period);',
        '}',
        '',
        'function breakEven(single, multi) {',
        '  // Comparing the periods, which answers a different question.',
        '  return single.period - multi.period;',
        '}',
        '',
        'function lab() {',
        '  return { cpi: cpi, time: time, breakEven: breakEven };',
        '}'
      ].join('\n'),
      solution: [
        '/* Weighted by how often each class actually ran, because that is what',
        '   makes CPI a property of the machine AND the program rather than of',
        '   the machine alone. */',
        'function cpi(counts, cycles) {',
        '  let instructions = 0;',
        '  let total = 0;',
        '',
        '  Object.keys(counts).forEach(function (kind) {',
        '    instructions += counts[kind];',
        '    total += counts[kind] * cycles[kind];',
        '  });',
        '  return instructions ? total / instructions : 0;',
        '}',
        '',
        'function time(machine) {',
        '  return Math.round(machine.instructions * machine.cpi * machine.period);',
        '}',
        '',
        '/* Solve time(single) = cycles(multi) x period for the period. Rounding',
        '   down matters: at exactly the break-even the machines tie, and one',
        '   gate delay above it the multi-cycle machine loses. */',
        'function breakEven(single, multi) {',
        '  const cycles = multi.instructions * multi.cpi;',
        '',
        '  return cycles ? Math.floor(time(single) / cycles) : 0;',
        '}',
        '',
        'function lab() {',
        '  return { cpi: cpi, time: time, breakEven: breakEven };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the sum program\'s mix gives a CPI of 3.70, not the average of the classes',
          assert: function (lab, api) {
            const parts = lab();
            const counts = { arithmetic: 22, branch: 11, jump: 10, system: 1 };
            const cycles = { arithmetic: 4, load: 5, store: 4, branch: 3, jump: 4, system: 2 };
            const got = parts.cpi(counts, cycles);

            api.assert.ok(Math.abs(got - 163 / 44) < 1e-9,
              '88 + 33 + 40 + 2 = 163 cycles over 44 instructions');
            api.assert.equal(Number(got.toFixed(2)), 3.70, 'which is 3.70');
          }
        },
        {
          name: 'a program of nothing but branches has a much lower CPI on the same machine',
          assert: function (lab, api) {
            const parts = lab();
            const cycles = { arithmetic: 4, load: 5, store: 4, branch: 3, jump: 4, system: 2 };

            api.assert.equal(parts.cpi({ branch: 40 }, cycles), 3,
              'CPI is a property of the pair, never of the machine alone');
            api.assert.equal(parts.cpi({ load: 10, branch: 10 }, cycles), 4, 'half and half');
            api.assert.equal(parts.cpi({}, cycles), 0, 'nothing ran');
          }
        },
        {
          name: 'the shorter clock loses once the product is taken',
          assert: function (lab, api) {
            const parts = lab();
            const single = { instructions: 44, cpi: 1, period: 178 };
            const multi = { instructions: 44, cpi: 163 / 44, period: 151 };

            api.assert.equal(parts.time(single), 7832, '44 x 1 x 178');
            api.assert.equal(parts.time(multi), 24613, '163 cycles x 151');
            api.assert.ok(parts.time(multi) > parts.time(single),
              'a 15% shorter clock and 3.7 times the cycles');
          }
        },
        {
          name: 'the break-even period is what turns the rejection into a target',
          assert: function (lab, api) {
            const parts = lab();
            const single = { instructions: 44, cpi: 1, period: 178 };
            const multi = { instructions: 44, cpi: 163 / 44, period: 151 };

            api.assert.equal(parts.breakEven(single, multi), 48,
              '7832 / 163 = 48.0, rounded down');
            const faster = { instructions: 44, cpi: 163 / 44, period: 48 };

            api.assert.ok(parts.time(faster) <= parts.time(single),
              'at the break-even period the multi-cycle machine no longer loses');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
