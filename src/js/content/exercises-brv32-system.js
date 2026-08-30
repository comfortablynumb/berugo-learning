/**
 * Graded exercises for the memory interface, I/O, exceptions and privilege
 * (M34.7-M34.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'memory-interface-and-io': [{
      id: 'load-widths',
      title: 'Sub-word loads: alignment first, then extension',
      prompt: 'Write lab() returning { load, extend }. extend(value, width, signed) turns a '
        + 'raw unsigned value of the given byte width into the 32-bit number a register would '
        + 'hold: sign-extended when signed is true and the top bit of that width is set, and '
        + 'unchanged otherwise. At width 4 there is nothing to extend. load(memory, address, '
        + 'width, signed) is the interface: return { fault: "misaligned" } when the address is '
        + 'not a multiple of the width, { fault: "unmapped" } when the address is outside '
        + '0x10000000 to 0x10000fff, and otherwise { value } assembled little-endian from '
        + 'memory[address], memory[address+1] ... and passed through extend. Check the region '
        + 'before the alignment is irrelevant — check alignment first, then the region, and '
        + 'never return a value and a fault together. The starter reads the bytes big-endian '
        + 'and never sign-extends.',
      entry: 'lab',
      starter: [
        'function extend(value, width, signed) {',
        '  // No extension at all: every load comes back unsigned.',
        '  return value;',
        '}',
        '',
        'function load(memory, address, width, signed) {',
        '  if (address % width !== 0) return { fault: "misaligned" };',
        '  if (address < 0x10000000 || address > 0x10000fff) return { fault: "unmapped" };',
        '',
        '  // Big-endian: the byte at the lowest address takes the HIGH bits.',
        '  let value = 0;',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    value = (value << 8) | (memory[address + at] || 0);',
        '  }',
        '  return { value: extend(value >>> 0, width, signed) };',
        '}',
        '',
        'function lab() {',
        '  return { load: load, extend: extend };',
        '}'
      ].join('\n'),
      solution: [
        '/* At the register width there is nothing left to extend, which is why',
        '   there is no lwu in a 32-bit machine: the value already fills the',
        '   register and the question does not arise. */',
        'function extend(value, width, signed) {',
        '  if (!signed || width === 4) return value | 0;',
        '  const sign = 1 << (8 * width - 1);',
        '',
        '  return ((value & (sign - 1)) - (value & sign)) | 0;',
        '}',
        '',
        '/* Little-endian: the byte at the lowest address contributes the lowest',
        '   bits. A fault returns a reason and no value, because the trap handler',
        '   is going to read the reason and there is no data to give it. */',
        'function load(memory, address, width, signed) {',
        '  if (address % width !== 0) return { fault: "misaligned" };',
        '  if (address < 0x10000000 || address > 0x10000fff) return { fault: "unmapped" };',
        '',
        '  let value = 0;',
        '',
        '  for (let at = 0; at < width; at += 1) {',
        '    value |= (memory[address + at] || 0) << (8 * at);',
        '  }',
        '  return { value: extend(value >>> 0, width, signed) };',
        '}',
        '',
        'function lab() {',
        '  return { load: load, extend: extend };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the same byte is -128 signed and 128 unsigned',
          assert: function (lab, api) {
            const parts = lab();
            const memory = {};

            memory[0x10000000] = 0x80;
            memory[0x10000001] = 0xbe;
            memory[0x10000002] = 0xed;
            memory[0x10000003] = 0xfe;

            api.assert.equal(parts.load(memory, 0x10000000, 1, true).value, -128, 'lb');
            api.assert.equal(parts.load(memory, 0x10000000, 1, false).value, 128, 'lbu');
            api.assert.equal(parts.load(memory, 0x10000003, 1, true).value, -2, '0xfe as lb');
          }
        },
        {
          name: 'little-endian: the low address holds the low bits',
          assert: function (lab, api) {
            const parts = lab();
            const memory = {};

            memory[0x10000000] = 0x78;
            memory[0x10000001] = 0x56;
            memory[0x10000002] = 0x34;
            memory[0x10000003] = 0x12;

            api.assert.equal(parts.load(memory, 0x10000000, 4, true).value, 0x12345678,
              'the word reads back as it was written');
            api.assert.equal(parts.load(memory, 0x10000000, 2, false).value, 0x5678,
              'and a half word takes the low two bytes');
          }
        },
        {
          name: 'at the register width the two opcodes agree',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.extend(0xfeedbe80, 4, true), parts.extend(0xfeedbe80, 4, false),
              'there is nothing left to extend, which is why lwu does not exist here');
            api.assert.equal(parts.extend(0xbe80, 2, true), -16768, 'lh');
            api.assert.equal(parts.extend(0xbe80, 2, false), 48768, 'lhu');
          }
        },
        {
          name: 'alignment is checked before the region, and a fault carries no value',
          assert: function (lab, api) {
            const parts = lab();
            const memory = {};

            api.assert.equal(parts.load(memory, 0x10000001, 2, true).fault, 'misaligned',
              'a half word at an odd address');
            api.assert.equal(parts.load(memory, 0x10000002, 4, true).fault, 'misaligned',
              'a word two bytes along');
            api.assert.equal(parts.load(memory, 0x10000001, 1, true).fault, undefined,
              'a byte is aligned at every address');
            api.assert.equal(parts.load(memory, 0x30000000, 4, true).fault, 'unmapped',
              'aligned, and nowhere');
            api.assert.equal(parts.load(memory, 0x30000000, 4, true).value, undefined,
              'never a value and a fault together');
          }
        }
      ]
    }],

    'exceptions-and-privilege': [{
      id: 'trap-entry-exit',
      title: 'Trap entry, trap exit, and the return address an interrupt needs',
      prompt: 'Write lab() returning { enter, exit, resume }. enter(state, trap, pc) records a '
        + 'trap: set state.mepc to pc — the address of the offending instruction, not the next '
        + 'one — set state.mcause to trap.cause with bit 31 set when trap.interrupt is true '
        + '(use `>>> 0` so the result is unsigned), set state.mtval to trap.value or 0, save '
        + 'the current state.mode into state.previousMode, set state.mode to 3 (machine), and '
        + 'return the handler address state.mtvec. exit(state) restores state.mode from '
        + 'previousMode (3 if there is none) and returns state.mepc. resume(state) is what a '
        + 'correct handler computes before returning: mepc plus 4 for a synchronous exception, '
        + 'and mepc unchanged for an interrupt — read the sign bit of mcause to tell them '
        + 'apart. The starter advances unconditionally, which is right for every exception and '
        + 'wrong for every interrupt.',
      entry: 'lab',
      starter: [
        'function enter(state, trap, pc) {',
        '  // The interrupt bit is never set, so nothing downstream can tell',
        '  // the two kinds apart.',
        '  state.mepc = pc;',
        '  state.mcause = trap.cause;',
        '  state.mtval = trap.value || 0;',
        '  state.previousMode = state.mode;',
        '  state.mode = 3;',
        '  return state.mtvec;',
        '}',
        '',
        'function exit(state) {',
        '  state.mode = state.previousMode === undefined ? 3 : state.previousMode;',
        '  return state.mepc;',
        '}',
        '',
        'function resume(state) {',
        '  // Correct for all five exception classes, and wrong for every',
        '  // interrupt: it skips the instruction that was interrupted.',
        '  return state.mepc + 4;',
        '}',
        '',
        'function lab() {',
        '  return { enter: enter, exit: exit, resume: resume };',
        '}'
      ].join('\n'),
      solution: [
        '/* mepc is the offending instruction, not the following one, because a',
        '   fault handler may have to restart the access it could not complete. */',
        'function enter(state, trap, pc) {',
        '  state.mepc = pc;',
        '  state.mcause = (trap.interrupt ? (0x80000000 | trap.cause) : trap.cause) >>> 0;',
        '  state.mtval = trap.value || 0;',
        '  state.previousMode = state.mode;',
        '  state.mode = 3;',
        '  return state.mtvec;',
        '}',
        '',
        'function exit(state) {',
        '  state.mode = state.previousMode === undefined ? 3 : state.previousMode;',
        '  return state.mepc;',
        '}',
        '',
        '/* An exception has already happened, so resume after it. An interrupt',
        '   arrived BETWEEN instructions, so the one at mepc has not run yet and',
        '   skipping it loses work with no error anywhere. */',
        'function resume(state) {',
        '  const asynchronous = ((state.mcause >>> 31) & 1) === 1;',
        '',
        '  return asynchronous ? state.mepc : state.mepc + 4;',
        '}',
        '',
        'function lab() {',
        '  return { enter: enter, exit: exit, resume: resume };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an exception saves the offending instruction and its value',
          assert: function (lab, api) {
            const parts = lab();
            const state = { mtvec: 0x100, mode: 0 };
            const to = parts.enter(state, { cause: 4, value: 0x10000001 }, 0x8);

            api.assert.equal(to, 0x100, 'control goes to mtvec, which the program did not choose');
            api.assert.equal(state.mepc, 0x8, 'the instruction that trapped, not the next one');
            api.assert.equal(state.mcause, 4, 'load address misaligned');
            api.assert.equal(state.mtval, 0x10000001, 'the address that was wrong');
            api.assert.equal(state.mode, 3, 'and the privilege is raised');
          }
        },
        {
          name: 'an interrupt sets the sign bit of mcause',
          assert: function (lab, api) {
            const parts = lab();
            const state = { mtvec: 0x100, mode: 0 };

            parts.enter(state, { cause: 7, interrupt: true }, 0xc);
            api.assert.equal(state.mcause >>> 0, 0x80000007,
              'bit 31 is how a handler tells the two kinds apart');
            api.assert.equal(state.mtval, 0, 'an interrupt has no offending value');
          }
        },
        {
          name: 'mret restores the privilege the trap interrupted',
          assert: function (lab, api) {
            const parts = lab();
            const state = { mtvec: 0x100, mode: 0 };

            parts.enter(state, { cause: 11 }, 0x4);
            api.assert.equal(state.mode, 3, 'machine mode inside the handler');
            api.assert.equal(parts.exit(state), 0x4, 'and mret returns to mepc');
            api.assert.equal(state.mode, 0, 'back in user mode');
          }
        },
        {
          name: 'the return address differs by kind, and that is the whole exercise',
          assert: function (lab, api) {
            const parts = lab();
            const fault = { mtvec: 0x100, mode: 0 };

            parts.enter(fault, { cause: 11 }, 0x4);
            api.assert.equal(parts.resume(fault), 0x8,
              'an ecall has already happened, so resume after it');

            const timer = { mtvec: 0x100, mode: 0 };

            parts.enter(timer, { cause: 7, interrupt: true }, 0xc);
            api.assert.equal(parts.resume(timer), 0xc,
              'the instruction at 0xc has not run yet; advancing here loses it silently');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
