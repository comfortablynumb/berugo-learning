/** Worked examples for instruction set design and the BRV32 encoding (M34.1-M34.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'instruction-set-design': [
      {
        title: 'One expression, three machines, and the number each one is proud of',
        goal: 'Watch instruction count and code size move in opposite directions, on the same '
          + 'computation.',
        setup: 'The expression (a + b) times two minus c, with a = 7, b = 5 and c = 4, so the '
          + 'answer is 20. Each machine executes it with its own operand convention: a stack '
          + 'machine with one-byte instructions, an accumulator machine with two-byte '
          + 'instructions, and a register machine with four-byte ones. All three are run, not '
          + 'described, and all three are required to produce 20 before their sizes are compared.',
        steps: [
          { do: 'Run the stack program.',
            why: 'An instruction that names no operands can be one byte wide.',
            work: 'push a, push b, add, push 2, mul, push c, sub: 7 instructions, 7 bytes, result 20' },
          { do: 'Run the accumulator program.',
            why: 'One implied destination, so each instruction names one source.',
            work: 'load a, add b, add acc, sub c: 4 instructions at 2 bytes each = 8 bytes, result 20' },
          { do: 'Run the register program.',
            why: 'Three named operands cost bits and buy freedom.',
            work: 'add t0, a, b; slli t0, t0, 1; sub t0, t0, c: 3 instructions at 4 bytes = 12 bytes, result 20' },
          { do: 'Put the three pairs beside each other.',
            why: 'This is the trade, and neither column alone is the answer.',
            work: '7 and 7, 4 and 8, 3 and 12 — instructions fall by 2.3x while bytes rise by 1.7x' },
          { do: 'Ask which machine wins.',
            why: 'The honest answer needs a second fact about the hardware.',
            work: 'a machine fetching 4 bytes per cycle runs the register program in 3 fetches and '
              + 'the stack program in 2, but issues 7 instructions instead of 3' }
        ],
        answer: 'All three compute 20, so the comparison is about encoding rather than about '
          + 'algorithms. The stack machine is the densest at 7 bytes and executes the most '
          + 'instructions at 7; the register machine is the sparsest at 12 bytes and executes '
          + 'the fewest at 3. There is no winner without a third number — whether the machine is '
          + 'short of fetch bandwidth or of execution slots — and that is exactly why '
          + 'instruction-set arguments run so long. What settled the question in practice was '
          + 'neither column: register machines won because values that stay in registers do not '
          + 'have to be reloaded, which is an argument about the memory hierarchy that M37 '
          + 'makes with numbers.'
      },
      {
        title: 'The immediate gets what is left, and at 16 bits there is nothing left',
        goal: 'Do the encoding arithmetic that decides how many registers an instruction set has.',
        setup: 'A fixed-width instruction has to hold an opcode, some register fields, and '
          + 'whatever constant it carries. The opcode is fixed at 5 bits (32 operations); each '
          + 'register field costs the base-two logarithm of the register count, rounded up; the '
          + 'immediate gets the remainder. The question is what remainder there is at 16 bits.',
        steps: [
          { do: 'Price 8 registers with 2 operand fields.',
            why: 'The friendliest case: a small register file and a two-address instruction.',
            work: '3 bits per register x 2 = 6, plus 5 of opcode = 11, leaving 5 immediate bits: -16 to 15' },
          { do: 'Raise the register file to 16, then 32.',
            why: 'Each doubling costs one bit per operand, twice over.',
            work: '16 registers leave 3 bits (-4 to 3); 32 registers leave 1 bit (-1 to 0)' },
          { do: 'Go back to 8 registers and ask for 3 operands.',
            why: 'Three-address form is what makes an instruction set orthogonal.',
            work: '3 x 3 = 9 register bits plus 5 of opcode = 14, leaving 2 immediate bits: -2 to 1' },
          { do: 'Ask for 32 registers and 3 operands at 16 bits.',
            why: 'The combination every designer wants.',
            work: '5 x 3 = 15 plus 5 = 20 bits needed in a 16-bit word: -4 bits left, so it does not fit' },
          { do: 'Repeat the first calculation at 32 bits.',
            why: 'To see what the extra word width actually bought.',
            work: '32 registers, 3 operands: 15 + 7 of opcode leaves 10 bits, and BRV32 spends '
              + 'that on funct3 and funct7 rather than on an immediate' }
        ],
        answer: 'At 16 bits, a three-address instruction over 32 registers is impossible: it '
          + 'needs 20 bits and has 16. That single row is why every compressed instruction set '
          + 'in existence — RISC-V C, ARM Thumb, MIPS16 — restricts short instructions to a '
          + 'subset of registers and to two-address forms, and why they are an extension rather '
          + 'than a replacement. The general shape is worth keeping: in a fixed-width format the '
          + 'fields compete directly, so adding a bit anywhere takes it from somewhere, and the '
          + 'field that pays is almost always the immediate. The same arithmetic reappears in '
          + 'page table entries, in floating-point formats and in every packed binary protocol.'
      }
    ],

    'brv32-instruction-set': [
      {
        title: 'Encoding sw a1, 8(a0) by hand, and finding the specification agrees',
        goal: 'Build a 32-bit instruction word field by field and check it against a published '
          + 'encoding.',
        setup: 'A store of register a1 to the address in a0 plus 8. The S format exists because '
          + 'a store has no destination register, so the five bits that would name one are '
          + 'available for the offset. Register numbers: a0 is x10, a1 is x11. The store opcode '
          + 'is 0x23 and funct3 for a word store is 0x2.',
        steps: [
          { do: 'Place the opcode in bits 6:0.',
            why: 'The opcode is at a fixed position in every format.',
            work: '0x23 = 0100011, so the word so far is 0x00000023' },
          { do: 'Place rs1 = 10 in bits 19:15 and rs2 = 11 in bits 24:20.',
            why: 'The source registers are at fixed positions too, which is what lets the '
              + 'register file read start before decode finishes.',
            work: '10 << 15 = 0x00050000 and 11 << 20 = 0x00b00000' },
          { do: 'Place funct3 = 2 in bits 14:12.',
            why: 'funct3 selects the width: 0 byte, 1 half, 2 word.',
            work: '2 << 12 = 0x00002000' },
          { do: 'Split the immediate 8 into its two fields.',
            why: 'The S format holds imm[11:5] at word[31:25] and imm[4:0] at word[11:7].',
            work: '8 = 000000001000, so imm[11:5] = 0 and imm[4:0] = 8, giving 8 << 7 = 0x00000400' },
          { do: 'Or the pieces together and compare with the specification.',
            why: 'A round trip proves self-consistency; a published number proves correctness.',
            work: '0x23 | 0x50000 | 0xb00000 | 0x2000 | 0x400 = 0x00b52423, which is the '
              + 'specification value exactly' }
        ],
        answer: '0x00b52423, and it matches the published encoding byte for byte — as do all 14 '
          + 'reference words the section checks, including the awkward ones. The step worth '
          + 'remembering is the fourth: the offset was split across two non-adjacent fields and '
          + 'reassembled, which is the scrambling that makes the encoding look arbitrary. It is '
          + 'not arbitrary. The bits landed where they did so that the store shares its wiring '
          + 'with the branch format and its sign bit with every other format, and the assembler '
          + 'absorbs the cost in about four lines of shifting so that every decoder ever built '
          + 'can be smaller.'
      },
      {
        title: 'A backward branch: four immediate fields, one sign bit, and twice the reach',
        goal: 'Decode 0xfeb51ee3 and see why the B format is scrambled the way it is.',
        setup: 'The word 0xfeb51ee3, taken from the reference encodings, is bne a0, a1, -4 — a '
          + 'branch back to the instruction before it. Its 13-bit immediate is stored in 12 bits '
          + 'of the word, spread across four separate ranges, and the low bit is not stored at '
          + 'all.',
        steps: [
          { do: 'Read the fixed fields.',
            why: 'They are in the same places as in every other format.',
            work: 'opcode 0x63 (branch), funct3 = 1 (bne), rs1 = 10 (a0), rs2 = 11 (a1)' },
          { do: 'Gather the four immediate fields.',
            why: 'This is the whole of the B format.',
            work: 'imm[12] from word[31] = 1; imm[10:5] from word[30:25] = 63; imm[4:1] from '
              + 'word[11:8] = 14; imm[11] from word[7] = 1' },
          { do: 'Reassemble, remembering that bit 0 is not stored.',
            why: 'Targets are even, so the low bit is known to be zero.',
            work: '1 111111 1110 0 = 0x1ffc as 13 bits, which sign-extends to -4' },
          { do: 'Ask what the missing bit 0 bought.',
            why: 'The field is 12 bits of storage carrying 13 bits of value.',
            work: 'reach is plus or minus 4096 bytes instead of 2048 — 1 024 instructions each way' },
          { do: 'Compare with the S format that stores 12 bits of value in 12 bits.',
            why: 'S and B differ only in where the low bits sit.',
            work: 'S: imm[11:5] and imm[4:0]. B: imm[12|10:5] and imm[4:1|11]. Bit 11 moved to '
              + 'word[7] so that bits 10:5 and 4:1 could stay exactly where S puts them' }
        ],
        answer: 'The immediate is -4, reassembled from four fields, and the fourth step is the '
          + 'one that explains the design. Dropping the always-zero low bit doubles the reach of '
          + 'the same number of stored bits. The fifth step explains the rest: the odd-looking '
          + 'placement of bit 11 at word[7] is there so that the bulk of the field stays exactly '
          + 'where the S format keeps it, letting a store and a branch share almost all of their '
          + 'immediate wiring. Every one of these decisions costs the assembler a line and saves '
          + 'the decoder a multiplexer, in every implementation, for the life of the instruction '
          + 'set. That asymmetry — software pays once, hardware pays forever — is the shape to '
          + 'take away.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
