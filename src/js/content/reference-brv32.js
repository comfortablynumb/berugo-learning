/** Reference entries for instruction set design and the BRV32 encoding (M34.1-M34.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'instruction-set-design': {
      summary: 'The same expression executed on a stack, an accumulator and a register machine, '
        + 'with instruction counts and byte counts measured rather than asserted; plus the '
        + 'field-packing arithmetic that decides how many registers a fixed-width instruction '
        + 'set can afford, and a table of the design decisions real instruction sets answered '
        + 'differently.',
      intuition: 'An instruction set is a contract that outlives every machine that implements '
        + 'it, and its first clause is where the operands live.',
      formulation: {
        equations: [
          {
            label: 'Three machine models on (a + b) x 2 - c, all producing 20',
            expr: 'model . instructions . bytes each . total bytes',
            terms: [
              { sym: 'stack', meaning: '7 . 1 . 7 — operands implied, so an instruction is an opcode' },
              { sym: 'accumulator', meaning: '4 . 2 . 8 — one implied destination, one named source' },
              { sym: 'register', meaning: '3 . 4 . 12 — all three operands named' },
              { sym: 'the trade', meaning: 'instructions fall 2.3x while bytes rise 1.7x' }
            ]
          },
          {
            label: 'What is left for the immediate in a fixed-width instruction',
            expr: 'immediate = width - opcode - operands x ceil(log2(registers))',
            readAs: 'the immediate gets the width, minus the opcode bits, minus one register '
              + 'field per operand',
            terms: [
              { sym: '16 bits, 8 registers, 2 operands', meaning: '16 - 5 - 6 = 5 bits: -16 to 15' },
              { sym: '16 bits, 16 registers, 2 operands', meaning: '16 - 5 - 8 = 3 bits: -4 to 3' },
              { sym: '16 bits, 32 registers, 2 operands', meaning: '16 - 5 - 10 = 1 bit: -1 to 0' },
              { sym: '16 bits, 8 registers, 3 operands', meaning: '16 - 5 - 9 = 2 bits: -2 to 1' },
              { sym: '16 bits, 32 registers, 3 operands', meaning: '-4 bits: the instruction does not fit' }
            ]
          },
          {
            label: 'The decisions, and who chose which way',
            expr: 'decision . what it buys . what it costs',
            terms: [
              { sym: 'fixed width', meaning: 'trivial decode and PC + 4; 12 bytes where a stack encoding needs 7' },
              { sym: 'many registers', meaning: 'values stay put; 5 bits per operand, three times per instruction' },
              { sym: 'condition codes', meaning: 'a compare and a branch share work; a hidden dependency between instructions' },
              { sym: 'rich addressing modes', meaning: 'address arithmetic folded in; a special case in every future implementation' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'All three machines are run, and all three must produce 20',
          why: 'Comparing code sizes for computations that differ is comparing nothing.',
          breaks: 'The demo prints the result per model; a mismatch would invalidate the byte counts above it.'
        },
        {
          name: 'A register field costs the logarithm of the register count, per operand',
          why: 'This is the entire arithmetic of instruction encoding.',
          breaks: '32 registers and three operands is 15 bits before any opcode is paid for.'
        },
        {
          name: 'A negative immediate width means the instruction does not fit, not a small immediate',
          why: 'The table reports it as unencodable rather than clamping to zero.',
          breaks: '16 bits, 32 registers, 3 operands reports -4 and says so in words.'
        },
        {
          name: 'Architecture is what a program can observe; everything else may change',
          why: 'It is the line that makes binaries portable across implementations.',
          breaks: 'M35 replaces the whole implementation and runs the same programs unchanged.'
        }
      ],
      complexity: [
        { operation: 'stack machine, per operand', average: 'one instruction, one byte', worst: 'values reloaded whenever the order is wrong' },
        { operation: 'register machine, per operation', average: 'one instruction, four bytes', worst: 'plus spill code when the allocator runs out' },
        { operation: 'field packing', average: 'one subtraction per design', worst: 'negative, meaning no encoding exists at that width' },
        { operation: 'fixed-width fetch', average: 'next address is PC + 4', worst: 'always — that is the point of it' },
        { operation: 'variable-width fetch', average: 'one instruction per scan step', worst: 'the end is unknown until the instruction is decoded' }
      ],
      failureModes: [
        {
          symptom: 'An instruction set comparison that proves whatever the author wanted.',
          cause: 'One of instruction count and code size was quoted, and the other was not.',
          fix: 'Quote both, and say what the machine is short of; the demo prints the pair per model.'
        },
        {
          symptom: 'A 16-bit encoding that cannot express half the instructions it needs.',
          cause: 'The register file was sized before the field arithmetic was done.',
          fix: 'Compute the immediate remainder first; it is the constraint, and it is one subtraction.'
        },
        {
          symptom: 'A compiler back end full of special cases and poor register allocation.',
          cause: 'The instruction set is not orthogonal — operations restricted to particular registers.',
          fix: 'Nothing, once shipped. It is why orthogonality is decided before the first implementation.'
        },
        {
          symptom: 'A wide processor whose front end cannot keep the back end fed.',
          cause: 'A variable-width encoding: instruction boundaries are unknown until decode.',
          fix: 'A micro-operation cache, a length predictor, or both — which is what x86 implementations do.'
        },
        {
          symptom: 'An addressing mode that was cheap to add and is now impossible to remove.',
          cause: 'It is architectural, so every future implementation must support it.',
          fix: 'Add modes only when the measurement justifies a permanent cost; BRV32 keeps exactly one.'
        }
      ],
      inTheWild: [
        'The Java and CPython virtual machines are stack machines, for exactly the density reason.',
        'ARM Thumb and RISC-V C: 16-bit encodings with restricted register fields, from this arithmetic.',
        'x86-64 keeping 16 architectural registers because the encoding could not afford more.',
        'RISC-V omitting condition codes so that instructions carry no hidden dependency.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'chapter 2 is this section, at length' },
        { title: 'Hennessy and Patterson — Computer Architecture: A Quantitative Approach, appendix A', note: 'instruction set principles, with the measurements' },
        { title: 'Waterman — Design of the RISC-V Instruction Set Architecture (PhD thesis, 2016)', note: 'why each field is where it is, from the person who put it there' },
        { title: 'Blem, Menon and Sankaralingam — Power Struggles: ISA delusions (HPCA 2013)', note: 'measured comparison of ARM, x86 and MIPS on the same workloads' }
      ]
    },

    'brv32-instruction-set': {
      summary: 'The six BRV32 instruction formats, the scrambled immediate fields and the '
        + 'hardware reason for each scramble, an encoder and decoder that round-trip over the '
        + 'whole 42-instruction table, and 14 encodings taken from the RISC-V specification and '
        + 'compared byte for byte.',
      intuition: 'The fields that the decoder needs first never move; only the immediate does, '
        + 'and it moves as little as it can.',
      formulation: {
        equations: [
          {
            label: 'The six formats and what each cannot express',
            expr: 'format . immediate bits . what it gives up',
            terms: [
              { sym: 'R', meaning: '0 . any constant at all — 15 bits go to three registers' },
              { sym: 'I', meaning: '12 . a second source register' },
              { sym: 'S', meaning: '12 . a destination register; its bits hold the offset' },
              { sym: 'B', meaning: '13 . an odd offset — bit 0 is always zero' },
              { sym: 'U', meaning: '20 . anything about the low twelve bits' },
              { sym: 'J', meaning: '21 . a target more than a megabyte away' }
            ]
          },
          {
            label: 'Fixed field positions, in every format',
            expr: 'opcode [6:0] . rd [11:7] . rs1 [19:15] . rs2 [24:20]',
            terms: [
              { sym: 'why', meaning: 'the register file read starts before the decoder knows the instruction' },
              { sym: 'bit 31', meaning: 'the sign of the immediate in I, S, B and J — one sign extender, one wire' },
              { sym: 'S against B', meaning: 'they differ only in where the low bits sit, so they share wiring' }
            ]
          },
          {
            label: 'sw a1, 8(a0) built field by field',
            expr: 'opcode | rs1 | rs2 | funct3 | immediate',
            terms: [
              { sym: '0x23', meaning: 'the store opcode, bits 6:0' },
              { sym: '10 << 15', meaning: '0x00050000 — rs1 is a0' },
              { sym: '11 << 20', meaning: '0x00b00000 — rs2 is a1' },
              { sym: '2 << 12', meaning: '0x00002000 — funct3 selects the word width' },
              { sym: 'imm 8', meaning: 'imm[11:5] = 0 at word[31:25], imm[4:0] = 8 at word[11:7] = 0x400' },
              { sym: 'result', meaning: '0x00b52423, matching the specification' }
            ]
          },
          {
            label: 'bne a0, a1, -4 taken apart',
            expr: '0xfeb51ee3 . four immediate fields . no bit zero',
            terms: [
              { sym: 'imm[12] from word[31]', meaning: '1 — the sign' },
              { sym: 'imm[10:5] from word[30:25]', meaning: '63' },
              { sym: 'imm[4:1] from word[11:8]', meaning: '14' },
              { sym: 'imm[11] from word[7]', meaning: '1' },
              { sym: 'reassembled', meaning: '0x1ffc as 13 bits, which is -4' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Encode then decode returns the instruction it started with',
          why: 'A round trip is the cheapest check and it runs over the whole table.',
          breaks: 'It proves self-consistency only — a shared misunderstanding round-trips perfectly.'
        },
        {
          name: 'The encodings are checked against a published specification',
          why: 'It is the only column in this milestone not produced by our own code.',
          breaks: '14 of 14 agree, including the four-field B immediate and the negative offset.'
        },
        {
          name: 'Bit 31 is the immediate sign in every format that has an immediate',
          why: 'One sign extender, wired to one wire, rather than one per format.',
          breaks: 'It is visible in the field decomposition table, which names the source bits.'
        },
        {
          name: 'B and J immediates have no bit 0, and it is not stored rather than assumed',
          why: 'Every instruction is 4-byte aligned, so a branch target is always even.',
          breaks: 'The B format carries 13 bits of value in 12 bits of encoding, doubling its reach.'
        }
      ],
      complexity: [
        { operation: 'decode fixed fields', average: 'wire slicing — no logic at all', worst: 'the same, in every format' },
        { operation: 'immediate reassembly', average: 'up to 4 fields shifted and or-ed', worst: 'the J format, at 4 fields spanning 21 bits' },
        { operation: 'encode', average: 'one table lookup plus field packing', worst: 'unchanged; the table is 42 rows' },
        { operation: 'pseudo-instruction expansion', average: '1 real instruction', worst: '2, for a full 32-bit constant' },
        { operation: 'specification check', average: '14 published words compared byte for byte', worst: 'as many as somebody else has published' }
      ],
      failureModes: [
        {
          symptom: 'The assembler and disassembler agree perfectly and both are wrong.',
          cause: 'They were written from the same misunderstanding, so round-tripping proves nothing.',
          fix: 'Compare against published encodings; the section keeps 14 of them for this reason.'
        },
        {
          symptom: 'A branch to an address computed by the assembler lands two bytes off.',
          cause: 'The always-zero low bit of the B immediate was stored rather than dropped.',
          fix: 'The offset is halved before encoding and doubled after decoding, in one place.'
        },
        {
          symptom: 'A large constant loads the wrong value by exactly 4096.',
          cause: 'lui plus addi, where the addi immediate is negative and nobody added 1 to the upper part.',
          fix: 'The classic RISC-V rounding rule; the assembler applies it and the section shows the pair.'
        },
        {
          symptom: 'A byte loaded from memory is 255 in one build and -1 in another.',
          cause: 'lb and lbu are different instructions, and the source did not say which it meant.',
          fix: 'Pick the opcode from the declared type; this is the hardware root of char-signedness bugs.'
        },
        {
          symptom: 'A disassembly listing has more lines than the source it came from.',
          cause: 'Pseudo-instructions expanded — 13 of 27 lines in the factorial listing.',
          fix: 'Nothing to fix; know which is which. The section tags every expanded line.'
        }
      ],
      inTheWild: [
        'The RISC-V specification\'s format diagram, which is this section\'s table with fewer words.',
        'objdump and llvm-mc, whose output can be pasted beside the encoder\'s to check it.',
        'ARM64\'s similar fixed-width regularity, and x86\'s prefixes as the opposite decision.',
        'The RISC-V C extension, which is this arithmetic redone in 16 bits with restricted fields.'
      ],
      sources: [
        { title: 'The RISC-V Instruction Set Manual, Volume I: Unprivileged ISA', note: 'chapter 2 and the format diagrams; the source of the 14 checked encodings' },
        { title: 'Waterman and Asanovic — the base integer instruction formats', note: 'the immediate scrambling explained by its authors' },
        { title: 'Harris and Harris — Digital Design and Computer Architecture, RISC-V Edition', note: 'the decoder that these field positions are designed for' },
        { title: 'Patterson and Waterman — The RISC-V Reader', note: 'short, and it walks each format with the reasoning' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
