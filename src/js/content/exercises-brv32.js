/**
 * Graded exercises for instruction set design and the BRV32 encoding
 * (M34.1-M34.2).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'instruction-set-design': [{
      id: 'field-packing',
      title: 'Fit the instruction, or report that it does not fit',
      prompt: 'Write lab() returning { pack, best }. pack(spec) takes '
        + '{ width, opcodeBits, registers, operands } and returns '
        + '{ registerBits, immediateBits, encodable, low, high }: registerBits is the operand '
        + 'count times the bits needed to name one of `registers` registers, immediateBits is '
        + 'whatever the width has left after the opcode and the register fields, and encodable '
        + 'is whether that remainder is zero or more. low and high are the signed range the '
        + 'immediate can hold — 0 and 0 when there are no immediate bits left. best(width, '
        + 'opcodeBits, operands) returns the largest register count, a power of two from 2 to '
        + '64, that still leaves at least one immediate bit. The starter uses log2 without '
        + 'rounding up and calls a negative remainder zero, which turns "this does not fit" '
        + 'into "this has no immediate".',
      entry: 'lab',
      starter: [
        'function pack(spec) {',
        '  // Two bugs. A register field is ceil(log2(n)) bits, not log2(n):',
        '  // 24 registers needs 5 bits, not 4.58. And a negative remainder',
        '  // means the instruction cannot be encoded at all.',
        '  const perRegister = Math.log2(spec.registers);',
        '  const registerBits = perRegister * spec.operands;',
        '  const left = Math.max(0, spec.width - spec.opcodeBits - registerBits);',
        '',
        '  return { registerBits: registerBits, immediateBits: left, encodable: true,',
        '    low: left > 0 ? -Math.pow(2, left - 1) : 0,',
        '    high: left > 0 ? Math.pow(2, left - 1) - 1 : 0 };',
        '}',
        '',
        'function best(width, opcodeBits, operands) {',
        '  return 32;',
        '}',
        '',
        'function lab() {',
        '  return { pack: pack, best: best };',
        '}'
      ].join('\n'),
      solution: [
        '/* A register field costs the base-two logarithm of the register count,',
        '   rounded UP - 24 registers needs 5 bits and wastes 8 encodings - and it',
        '   is paid once per operand. A negative remainder is not a small',
        '   immediate: it means the fields do not fit in the word at all, and',
        '   saying so is the whole value of the calculation. */',
        'function pack(spec) {',
        '  const perRegister = Math.ceil(Math.log2(spec.registers));',
        '  const registerBits = perRegister * spec.operands;',
        '  const left = spec.width - spec.opcodeBits - registerBits;',
        '',
        '  return { registerBits: registerBits, immediateBits: left, encodable: left >= 0,',
        '    low: left > 0 ? -Math.pow(2, left - 1) : 0,',
        '    high: left > 0 ? Math.pow(2, left - 1) - 1 : 0 };',
        '}',
        '',
        'function best(width, opcodeBits, operands) {',
        '  let answer = 0;',
        '',
        '  for (let n = 2; n <= 64; n *= 2) {',
        '    if (pack({ width: width, opcodeBits: opcodeBits, registers: n,',
        '      operands: operands }).immediateBits >= 1) answer = n;',
        '  }',
        '  return answer;',
        '}',
        '',
        'function lab() {',
        '  return { pack: pack, best: best };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the friendly case: 16 bits, 8 registers, 2 operands leaves 5 immediate bits',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.pack({ width: 16, opcodeBits: 5, registers: 8, operands: 2 });

            api.assert.equal(got.registerBits, 6, '3 bits per register, twice');
            api.assert.equal(got.immediateBits, 5, '16 - 5 - 6');
            api.assert.equal(got.low, -16, 'a signed 5-bit field reaches -16');
            api.assert.equal(got.high, 15, 'and 15');
            api.assert.equal(got.encodable, true, 'it fits');
          }
        },
        {
          name: 'a negative remainder means it does not fit, not that it has no immediate',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.pack({ width: 16, opcodeBits: 5, registers: 32, operands: 3 });

            api.assert.equal(got.registerBits, 15, '5 bits per register, three times');
            api.assert.equal(got.immediateBits, -4, '16 - 5 - 15, reported as negative');
            api.assert.equal(got.encodable, false, 'the instruction does not fit in the word');
          }
        },
        {
          name: 'a register count that is not a power of two rounds the field up',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.pack({ width: 32, opcodeBits: 7, registers: 24, operands: 3 });

            api.assert.equal(got.registerBits, 15, '24 registers still needs 5 bits each');
            api.assert.equal(got.immediateBits, 10, '32 - 7 - 15');
          }
        },
        {
          name: 'the largest register file that still leaves an immediate bit',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.best(16, 5, 2), 32, '32 registers leaves exactly 1 bit');
            api.assert.equal(parts.best(16, 5, 3), 8, '3 operands, so 8 is the last that fits');
            api.assert.equal(parts.best(32, 7, 3), 64, '32 bits is roomy enough for all of them');
          }
        }
      ]
    }],

    'brv32-instruction-set': [{
      id: 'encode-decode-formats',
      title: 'Encode and decode the S and B formats, scrambling included',
      prompt: 'Write lab() returning { encodeS, decodeB }. encodeS(rs1, rs2, funct3, imm) '
        + 'returns the 32-bit word for a store: opcode 0x23 in bits 6:0, imm[4:0] in bits 11:7, '
        + 'funct3 in 14:12, rs1 in 19:15, rs2 in 24:20 and imm[11:5] in 31:25. Return it as an '
        + 'unsigned number (finish with >>> 0). decodeB(word) returns the signed branch offset: '
        + 'imm[12] is word[31], imm[10:5] is word[30:25], imm[4:1] is word[11:8], imm[11] is '
        + 'word[7], and bit 0 is always zero — then sign-extend the 13-bit result. The starter '
        + 'writes the whole store immediate into the low field and reads the branch immediate '
        + 'as if it were contiguous and unsigned.',
      entry: 'lab',
      starter: [
        'function encodeS(rs1, rs2, funct3, imm) {',
        '  // The offset does not fit in five bits, and the top seven have',
        '  // nowhere to go if you never put them there.',
        '  return (0x23 | ((imm & 0x1f) << 7) | (funct3 << 12) |',
        '    (rs1 << 15) | (rs2 << 20)) >>> 0;',
        '}',
        '',
        'function decodeB(word) {',
        '  // Contiguous, and unsigned. Neither is true.',
        '  return ((word >>> 20) & 0xfff) * 2;',
        '}',
        '',
        'function lab() {',
        '  return { encodeS: encodeS, decodeB: decodeB };',
        '}'
      ].join('\n'),
      solution: [
        '/* The S immediate is split so that its low five bits land exactly where',
        '   the R format keeps rd, and its top seven where funct7 lives - which is',
        '   why a store needs no extra multiplexer anywhere in the decoder. */',
        'function encodeS(rs1, rs2, funct3, imm) {',
        '  const low = imm & 0x1f;',
        '  const high = (imm >> 5) & 0x7f;',
        '',
        '  return (0x23 | (low << 7) | (funct3 << 12) | (rs1 << 15) |',
        '    (rs2 << 20) | (high << 25)) >>> 0;',
        '}',
        '',
        '/* Four fields, and no bit zero: a branch target is always even, so the',
        '   low bit is not stored and the same twelve bits of encoding reach twice',
        '   as far. Sign-extend from bit 12, which is where word[31] landed. */',
        'function decodeB(word) {',
        '  const value = (((word >>> 31) & 1) << 12) | (((word >>> 25) & 0x3f) << 5) |',
        '    (((word >>> 8) & 0xf) << 1) | (((word >>> 7) & 1) << 11);',
        '',
        '  return (value & 0xfff) - (value & 0x1000);',
        '}',
        '',
        'function lab() {',
        '  return { encodeS: encodeS, decodeB: decodeB };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'sw a1, 8(a0) is the word the specification prints',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.encodeS(10, 11, 2, 8) >>> 0, 0x00b52423,
              'rs1 = a0 = 10, rs2 = a1 = 11, funct3 = 2, offset 8');
          }
        },
        {
          name: 'a negative store offset puts its top bits in the high field',
          assert: function (lab, api) {
            const parts = lab();
            const word = parts.encodeS(2, 1, 2, -4) >>> 0;

            api.assert.equal((word >>> 25) & 0x7f, 0x7f, 'imm[11:5] of -4 is all ones');
            api.assert.equal((word >>> 7) & 0x1f, 0x1c, 'imm[4:0] of -4 is 11100');
            api.assert.equal(word, 0xfe112e23 >>> 0, 'sw ra, -4(sp)');
          }
        },
        {
          name: 'bne a0, a1, -4 decodes to -4, from four separate fields',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.decodeB(0xfeb51ee3 >>> 0), -4, 'a branch to the previous instruction');
            api.assert.equal(parts.decodeB(0x00b50463 >>> 0), 8, 'beq a0, a1, 8 skips one instruction');
          }
        },
        {
          name: 'the offset is always even and reaches a full 4 KiB each way',
          assert: function (lab, api) {
            const parts = lab();

            for (let word = 0; word < 64; word += 1) {
              const raw = ((word * 2654435761) >>> 0);
              api.assert.equal(Math.abs(parts.decodeB(raw) % 2), 0, 'bit 0 is never stored');
              api.assert.ok(parts.decodeB(raw) >= -4096 && parts.decodeB(raw) <= 4094,
                'a 13-bit signed offset reaches -4096 to 4094');
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
