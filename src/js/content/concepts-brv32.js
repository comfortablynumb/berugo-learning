/** Concepts for instruction set design and the BRV32 encoding (M34.1-M34.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'instruction-set-design': [
      {
        term: 'An instruction set is a contract, and its cost is that it cannot be withdrawn',
        diagram: {
          definition: [
            'flowchart TB',
            '    C["compilers, assemblers,<br/>operating systems, binaries"] --> I["the instruction set:<br/>what the bits mean"]',
            '    I --> H1["implementation 1<br/>single cycle, 5 945 gates"]',
            '    I --> H2["implementation 2<br/>pipelined"]',
            '    I --> H3["implementation 3<br/>out of order, wide"]',
            '    H1 -.->|"same answers"| H2',
            '    H2 -.->|"same answers"| H3'
          ].join('\n'),
          caption: 'One specification, many machines. Everything above the line is written once '
            + 'and runs on every implementation below it, which is the whole value and the '
            + 'whole cost.'
        },
        plain: 'The instruction set is the only thing software is allowed to depend on.',
        formal: 'architecture is what a program can observe; microarchitecture is how it was done',
        detail: [
          'Everything above the line depends on the meaning of the bits: compilers, operating '
            + 'systems, shipped binaries.',
          'Everything below it is free to change.',
          'That split is why a program from 1995 still runs, and why a mistake in the contract is '
            + 'permanent.',
          'An implementation can be replaced next year, but a defined instruction has to keep '
            + 'behaving the same way for as long as anyone runs old code.',
          'The discipline that follows is worth carrying into software design, because an API is '
            + 'the same object with a shorter lifetime.'
        ],
        example: 'This milestone builds one implementation of BRV32; M35 builds a pipelined one '
          + 'from the same 42 instructions, and the programs do not change.'
      },
      {
        term: 'Where the operands live is the first decision, and it sets the code size',
        plain: 'Stack, accumulator or registers: how an instruction names what it works on.',
        formal: 'a stack instruction names nothing, an accumulator one names one, a register one names three',
        detail: [
          'A stack machine takes its operands from the top of the stack and leaves the result '
            + 'there. An instruction is then little more than an opcode, and the code is very '
            + 'dense.',
          'An accumulator machine has one implied destination and names one source.',
          'A register machine names all three, which costs bits in every single instruction and '
            + 'buys the freedom to leave values where they are.',
          'That means no shuffling, no reloading, and an optimiser with somewhere to allocate to.',
          'Every later decision in the instruction set is downstream of this one.'
        ],
        example: 'The same expression (a + b) times two minus c. Stack machine: 7 instructions '
          + 'in 7 bytes. Accumulator: 4 in 8. Register machine: 3 in 12.'
      },
      {
        term: 'Instruction count and code size move in opposite directions',
        plain: 'The densest encoding executes the most instructions.',
        formal: 'bytes per instruction times instructions is the number that matters, and neither factor alone',
        detail: [
          'The stack program is the smallest in bytes and the largest in instruction count; the '
            + 'register program is the reverse.',
          'Which one hurts depends on what the machine is short of.',
          'A processor starved of fetch bandwidth or instruction cache wants small code, and one '
            + 'starved of execution slots wants few instructions.',
          'Quoting either number alone is how instruction-set arguments go wrong. It is the same '
            + 'error as comparing two services on requests per second without saying what a '
            + 'request is.'
        ],
        example: 'Stack: 7 instructions, 7 bytes. Register: 3 instructions, 12 bytes. Both '
          + 'compute 20, which is what makes the comparison mean anything.'
      },
      {
        term: 'A fixed-width encoding is a budget, and the immediate gets what is left',
        plain: 'Opcode bits plus register bits plus immediate bits must fit the word.',
        formal: 'immediate bits = width - opcode bits - operands x ceil(log2(registers))',
        readAs: 'the immediate gets the width minus the opcode minus, for each operand, the '
          + 'number of bits it takes to name a register.',
        detail: [
          'A register field costs the base-two logarithm of the register count, rounded up, and '
            + 'it is paid once per operand in every instruction that has them.',
          'At 32 bits there is room for three five-bit registers and a twelve-bit immediate. At '
            + '16 bits the arithmetic turns brutal.',
          'This is the calculation behind every compressed instruction set.',
          'It is also the reason those extensions restrict which registers a short instruction '
            + 'may name: the field is simply not there.'
        ],
        example: 'At 16 bits, 8 registers and 2 operands leave 5 immediate bits, so -16 to 15. '
          + 'With 32 registers and 3 operands the budget is -4, so the instruction does not fit.'
      },
      {
        term: 'RISC versus CISC is now an argument about the decoder, not the instructions',
        plain: 'Variable-width encodings are denser and much harder to decode in parallel.',
        formal: 'a fixed-width decoder knows where the next instruction starts before it decodes this one',
        detail: [
          'With a fixed width, the address of the next instruction is the current one plus four, '
            + 'so a machine can start decoding sixteen instructions at once.',
          'With a variable width, the end of an instruction is only known after decoding it.',
          'Wide fetch then needs either a serial scan, a predictor, or a cache of already-decoded '
            + 'operations.',
          'Modern x86 implementations pay for all three, and internally translate into '
            + 'fixed-width micro-operations.',
          'That is the RISC argument winning underneath a CISC contract rather than in place of '
            + 'it.'
        ],
        example: 'Fixed width also buys alignment: every BRV32 instruction is four bytes at a '
          + 'four-byte boundary, so the fetch never straddles a cache line.'
      },
      {
        term: 'Orthogonality is what makes a compiler back end possible',
        plain: 'Any operation with any register, without special cases.',
        formal: 'if an operation exists it should accept every operand the format allows',
        detail: [
          'A non-orthogonal instruction set says this operation only on that register, or this '
            + 'addressing mode only for that opcode.',
          'It pushes every exception into the register allocator and the instruction selector, '
            + 'where it becomes a permanent tax on compiler quality and a source of bugs nobody '
            + 'can test out.',
          'The x86 instruction set carries decades of these from its accumulator ancestry.',
          'The general lesson is that a special case in an interface is paid for by every caller '
            + 'for as long as the interface exists, which is a long time.'
        ],
        example: 'In BRV32 every R-format instruction accepts any three of the 32 registers, so '
          + 'the allocator never has to reserve one for a shift count or a multiply result.'
      },
      {
        term: 'A hardwired zero register is the cheapest instruction-set decision there is',
        plain: 'One register that always reads zero and discards writes.',
        formal: 'x0 turns general instructions into special ones at no encoding cost',
        detail: [
          'Move becomes add-with-zero, load-immediate becomes add-immediate-to-zero, and '
            + 'compare-with-zero becomes an ordinary branch.',
          'Discarding a result becomes writing to x0, so a jump-and-link that throws away the '
            + 'link register is just a jump.',
          'None of those needed an opcode, a format or a gate.',
          'The cost is one register out of thirty-two and a write-enable that is never asserted '
            + 'for row zero.',
          'That also makes "an instruction cannot corrupt x0" structural rather than a check '
            + 'somebody might forget.'
        ],
        example: 'The assembly section lists six idioms that appear constantly in compiler '
          + 'output, and four of them are x0 doing this.'
      },
      {
        term: 'Addressing modes fold work into the instruction, and every mode is permanent',
        plain: 'How an instruction computes the address it touches.',
        formal: 'BRV32 has exactly one mode: a register plus a signed 12-bit offset',
        detail: [
          'A scaled-index mode folds a multiply and two adds into one instruction, which is '
            + 'denser and saves instruction slots.',
          'It is then a special case in every implementation of that instruction set forever, '
            + 'including the pipeline, the scheduler and the exception logic.',
          'Keeping one mode means address arithmetic is ordinary arithmetic.',
          'The compiler can hoist it, common-subexpression it and schedule it like anything else, '
            + 'which is exactly what modern compilers want to do anyway.'
        ],
        example: 'Array indexing in BRV32 is a shift and an add before the load, which the '
          + 'assembly section shows as the slli-then-add idiom.'
      }
    ],

    'brv32-instruction-set': [
      {
        term: 'Six formats, and the fields that matter never move',
        diagram: {
          definition: [
            'flowchart TB',
            '    W["a 32-bit word"] --> O["opcode: bits 6:0<br/>always"]',
            '    W --> D["rd: bits 11:7<br/>always"]',
            '    W --> S1["rs1: bits 19:15<br/>always"]',
            '    W --> S2["rs2: bits 24:20<br/>always"]',
            '    W --> IM["immediate: gathered<br/>from whatever is left"]',
            '    S1 --> RF["register file read<br/>starts immediately"]',
            '    S2 --> RF',
            '    O --> DEC["decode: what did<br/>those reads mean?"]'
          ].join('\n'),
          caption: 'The register reads start before the decoder knows what the instruction is, '
            + 'because the fields are at fixed positions in every format. Only the immediate '
            + 'moves.'
        },
        plain: 'R, I, S, B, U and J differ mainly in where the immediate bits live.',
        formal: 'opcode is always [6:0], rd always [11:7], rs1 always [19:15], rs2 always [24:20]',
        detail: [
          'Because those four fields are at fixed positions regardless of format, a decoder can '
            + 'pull all of them out before it knows what kind of instruction it is holding.',
          'It can start the register file read at the same time, and discard any field it did '
            + 'not need.',
          'That is why a regular fixed-width encoding decodes in roughly one gate delay while a '
            + 'variable-width one needs a pipeline stage.',
          'It is the clearest case in the milestone of gates dictating a software-visible rule.'
        ],
        example: 'The datapath reads both register ports every cycle, for every instruction, '
          + 'including ones with no source registers at all. It costs nothing to be wrong.'
      },
      {
        term: 'The immediates are scrambled, and every scramble saves a wire',
        plain: 'Immediate bits are placed to keep the sign extender and the muxes small.',
        formal: 'bit 31 is the sign of the immediate in every format that has one',
        detail: [
          'The immediate fields look arbitrary until you ask what the hardware has to build.',
          'Bit 31 is the sign bit in I, S, B and J, so the sign extender is wired once to one '
            + 'wire rather than four times to four.',
          'The S and B formats differ only in where the low bits land, so a store and a branch '
            + 'share nearly all of their reassembly logic.',
          'The assembler pays for this in a few lines of shifting; the decoder saves it in every '
            + 'implementation ever built.'
        ],
        example: 'The sw encoding splits its 12-bit offset into word[31:25] and word[11:7] — '
          + 'exactly the bit positions the R format uses for funct7 and rd.'
      },
      {
        term: 'Branch and jump offsets have no bit zero, which doubles their reach',
        plain: 'Targets are even, so the low bit is not stored.',
        formal: 'B carries 13 immediate bits in 12 bits of encoding; J carries 21 in 20',
        detail: [
          'Every instruction is four bytes at a four-byte boundary, so a branch target is always '
            + 'even and storing its low bit would waste it.',
          'Dropping it means the same number of encoded bits reaches twice as far.',
          'This is a general trick: when a value is known to be a multiple of something, encode '
            + 'the quotient.',
          'It appears again in page tables, in compressed pointers and in every file format with '
            + 'a block size.'
        ],
        example: 'The B format encodes 13 bits of immediate in 12 bits of the word, which is '
          + 'plus or minus 4 KiB of reach rather than 2.'
      },
      {
        term: 'A format is defined as much by what it cannot say',
        plain: 'Each format gives up something to buy its immediate.',
        formal: 'S has no destination register; R has no immediate at all; U says nothing about the low 12 bits',
        detail: [
          'The S format spends the rd field on immediate bits, so a store has no destination. '
            + 'That is fine, because a store does not produce a value.',
          'The R format spends 15 bits on three registers and has nothing left for a constant.',
          'The U format spends 20 bits on the high half of a constant and cannot express the low '
            + 'twelve.',
          'Reading the absences is how you understand an encoding. Each one is a decision that '
            + 'bought bits somewhere else, and it explains why lui exists and why it is always '
            + 'followed by an addi.'
        ],
        example: 'Building a full 32-bit constant takes lui plus addi, because 12 bits is all an '
          + 'I-format immediate has.'
      },
      {
        term: 'Pseudo-instructions are an assembler feature, not a machine feature',
        plain: 'mv, li, j, ret and beqz are spellings of real instructions.',
        formal: 'the assembler expands them; the hardware has never heard of them',
        detail: [
          'The instruction mv rd, rs is addi rd, rs, 0, and ret is jalr x0, ra, 0.',
          'The pseudo-instruction li of a small constant is addi rd, x0, n. Of a large one it is '
            + 'lui then addi, which is two instructions from one line.',
          'Knowing which lines in a listing were written by the programmer and which by the '
            + 'assembler is a real skill when reading disassembly.',
          'The disassembler shows you the machine instructions and the source showed you the '
            + 'pseudo ones, so the line counts do not match.'
        ],
        example: 'In the factorial listing, 13 of 27 lines came from pseudo-instruction '
          + 'expansion, including the two-instruction li that sets up the stack pointer.'
      },
      {
        term: 'Alignment and endianness are part of the contract, not of the implementation',
        plain: 'Little-endian byte order, and naturally aligned accesses.',
        formal: 'a 4-byte load requires an address that is a multiple of 4, or it faults',
        detail: [
          'Endianness decides which byte of a word lives at the lowest address.',
          'The moment a program writes a word and reads a byte the answer becomes visible, so it '
            + 'has to be specified rather than left to the implementation.',
          'Alignment is an efficiency decision made visible. An aligned access never straddles '
            + 'two words, so the memory interface stays one access wide.',
          'Requiring it means unaligned accesses fault loudly, which is far better than the '
            + 'alternative of silently loading the wrong bytes.'
        ],
        example: 'The memory section drives every width against every alignment and shows which '
          + 'combinations fault rather than truncating.'
      },
      {
        term: 'Loads choose their extension, and the choice is in the opcode',
        plain: 'lb sign-extends a byte; lbu zero-extends the same byte.',
        formal: 'funct3 selects width and signedness together, in three bits',
        detail: [
          'A byte loaded into a 32-bit register has to become 32 bits somehow.',
          'Whether the top 24 are copies of the sign bit or zeros depends entirely on what the '
            + 'byte meant.',
          'The instruction set cannot infer it, so it is encoded: two instructions for every '
            + 'sub-word width.',
          'This is the hardware root of a whole family of C bugs about char signedness. It is '
            + 'why a language that does not commit to one gets different answers on different '
            + 'platforms.'
        ],
        example: 'Loading 0xFF with lb gives -1; with lbu it gives 255. Same byte, same address, '
          + 'different opcode.'
      },
      {
        term: 'A published specification is the only oracle worth having here',
        plain: 'Check the encodings against somebody else\'s numbers, not your own.',
        formal: '14 encodings from the RISC-V specification, compared byte for byte',
        detail: [
          'An assembler and a disassembler written by the same person from the same '
            + 'misunderstanding will round-trip perfectly and be wrong.',
          'Round-tripping proves self-consistency and nothing else.',
          'The only test that catches a shared misunderstanding is a set of encodings produced by '
            + 'somebody who was not in the room: the published specification, or a real '
            + 'toolchain\'s output.',
          'This is the same reason cryptographic implementations are checked against published '
            + 'test vectors and never against themselves.'
        ],
        example: 'All 14 published words match, including 0xfeb51ee3 for bne a0, a1, -4, whose '
          + 'immediate is split across four separate bit ranges.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
