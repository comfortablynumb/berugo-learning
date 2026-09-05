/** Concepts for the toolchain and the instruction-set comparison (M34.9-M34.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'assembler-linker-and-loading': [
      {
        term: 'An object file is bytes, symbols and holes',
        diagram: {
          definition: [
            'flowchart LR',
            '    S["source"] --> A["assembler"]',
            '    A --> B["bytes<br/>what could be encoded"]',
            '    A --> Y["symbols<br/>what this file offers"]',
            '    A --> H["relocations<br/>what it could not fill"]',
            '    B --> L["linker"]',
            '    Y --> L',
            '    H --> L',
            '    L --> I["one image, no holes"]'
          ].join('\n'),
          caption: 'Every object format in existence is those three things with more metadata '
            + 'around them. The relocation list is what makes separate compilation possible.'
        },
        plain: 'What it encoded, what it defines, and what it still needs.',
        formal: 'a relocation is (address, shape, symbol) — a hole of a known kind',
        detail: [
          'The bytes are everything the assembler could work out on its own.',
          'The symbols are what this file offers to others.',
          'The relocations are what it could not fill in: a list of "at this address there is a '
            + 'hole of this shape, for this name".',
          'Being able to write down what you do not know is exactly what lets a file be assembled '
            + 'in isolation. It is why a change to one source file does not mean re-assembling '
            + 'the other thousand.'
        ],
        example: 'main.o is 20 bytes, defines _start, and needs target — one branch-shaped hole '
          + 'at address 8.'
      },
      {
        term: 'Two passes, because a label can be used before it is defined',
        plain: 'Measure everything first, then encode.',
        formal: 'pass one assigns addresses; pass two encodes against them',
        detail: [
          'Every instruction\'s size is known without knowing any addresses, so the first pass '
            + 'can walk the source and give every label an address.',
          'Only then can a forward branch be encoded, because its offset is the difference '
            + 'between two addresses that now both exist.',
          'A single-pass assembler could only handle programs with no forward references.',
          'That means no loops with a bottom test, and no calls to anything defined later.'
        ],
        example: 'Pseudo-instructions complicate this: li of a large constant is two words, so '
          + 'the first pass has to know the expansion to get the addresses right.'
      },
      {
        term: 'A relocation has a shape, and patching the wrong one is worse than failing',
        plain: 'A branch offset, a jump offset and a data word go in different places.',
        formal: 'the linker re-packs through the same field tables the assembler used',
        detail: [
          'The B-format immediate is scrambled across four bit ranges, the J-format across four '
            + 'different ones, and a data word is a plain 32 bits.',
          'Writing a value into the wrong field produces an instruction that decodes perfectly '
            + 'and goes somewhere else.',
          'That is far harder to find than a link error.',
          'Driving both the assembler and the linker from one field table is what makes it '
            + 'impossible for them to disagree.'
        ],
        example: 'The linker clears the immediate bits by mask and re-packs with the ISA\'s own '
          + 'packImmediate, so there is no second implementation to keep in step.'
      },
      {
        term: 'Placement is where addresses first exist, which is why range errors are linker errors',
        plain: 'Until each object has a base, no distance can be computed.',
        formal: 'offset = target address - relocation address, and both come from placement',
        detail: [
          'An assembler cannot know how far away a function in another file is, so it cannot know '
            + 'whether a branch will reach.',
          'The linker gives every object a base, builds one symbol table, and only then can each '
            + 'hole be measured.',
          'That is why "relocation out of range" appears the day somebody adds a few thousand '
            + 'bytes somewhere unrelated.',
          'It is why the code that broke is never the code that changed.'
        ],
        example: 'The same branch links cleanly with the target 12 bytes away and fails at 5 012 '
          + 'bytes — the source of both is identical.'
      },
      {
        term: 'Out of range must be reported, never truncated',
        plain: 'There is no correct encoding, so refuse.',
        formal: 'the B field reaches -4 096 to 4 094; anything else is an error with the number',
        detail: [
          'Keeping the low bits of an offset that does not fit produces a branch to a '
            + 'plausible-looking address, which decodes and executes and goes somewhere wrong.',
          'Refusing costs a build and saves a debugging session that could take days.',
          'The report is much more useful with the number in it.',
          '"Needs 5012" tells you how far over you are, and therefore whether the fix is a veneer '
            + 'or a reorganisation.'
        ],
        example: 'The demo reports "out of range for a conditional branch, plus or minus 4 KB: '
          + 'needs 5012" and produces no image at all.'
      },
      {
        term: 'A veneer is what a real linker inserts when the offset does not fit',
        plain: 'Branch to a nearby stub, and let the stub take the longer jump.',
        formal: 'a branch reaches 4 KB and a jump reaches 1 MB, so two hops cover what one cannot',
        detail: [
          'The stub costs an instruction and a few bytes, and it is generated by the linker '
            + 'rather than written by anybody.',
          'That is why a disassembly of a large binary is full of tiny functions with '
            + 'machine-generated names.',
          'It also explains why link times and binary sizes grow non-linearly with code size.',
          'Past a threshold, calls that used to be direct start needing help.'
        ],
        example: 'The veneer scenario links and runs: the branch reaches the stub 12 bytes away '
          + 'and the stub jumps 5 004 bytes to the real target.'
      },
      {
        term: 'Report every failure, not the first',
        plain: 'A linker that stops at the first undefined symbol makes you build once per name.',
        formal: 'collect the failures and return them all',
        detail: [
          'It is a small change in the code: accumulate rather than throw.',
          'It is a large change in how the tool feels to use, because the cost of a build cycle '
            + 'is what makes a slow feedback loop expensive.',
          'The same argument applies to type checkers, parsers, form validators and configuration '
            + 'loaders.',
          'Any tool whose output is a list of problems should produce the list.'
        ],
        example: 'The link result carries an applied entry per relocation, each with its own '
          + 'verdict, rather than throwing on the first bad one.'
      },
      {
        term: 'Loading is placement again, at run time',
        plain: 'Copy the image to the addresses it was linked for and jump to the entry symbol.',
        formal: 'the loader honours the addresses the linker chose',
        detail: [
          'That works as long as those addresses are available, which stops being true the moment '
            + 'several programs or libraries share an address space.',
          'Then you need position-independent code, which addresses everything relative to the '
            + 'program counter.',
          'The alternative is load-time relocation, which redoes the linker\'s patching with the '
            + 'real base.',
          'That choice is the start of M39, and it is also why address-space layout randomisation '
            + 'is possible at all.'
        ],
        example: 'The demo loads at 0 and jumps to _start; the whole image is 28 bytes in the '
          + 'simple case.'
      }
    ],

    'real-instruction-sets': [
      {
        term: 'The measurement first: ten instructions each, and only the bytes differ',
        diagram: {
          definition: [
            'flowchart TB',
            '    F["sum an array of ints"] --> R["RISC-V<br/>10 instructions, 40 bytes"]',
            '    F --> A["ARM64<br/>10 instructions, 40 bytes"]',
            '    F --> X["x86-64<br/>10 instructions, 23 bytes"]',
            '    R --> L["loop body: 4 instructions"]',
            '    A --> L',
            '    X --> L'
          ].join('\n'),
          caption: 'The same function on three machines. The instruction counts are identical '
            + 'and the byte counts are not, which is a much narrower claim than the usual '
            + 'argument makes.'
        },
        plain: 'One function, three instruction sets, and the counts are almost the same.',
        formal: '10 instructions and a 4-instruction loop on all three; 40, 40 and 23 bytes',
        detail: [
          'The usual RISC-versus-CISC framing predicts that the complex instruction set needs '
            + 'fewer instructions and the simple ones need more.',
          'On this function that does not happen: all three take ten.',
          'What x86-64 actually wins is size, by a factor of 1.74, entirely through '
            + 'variable-length encoding.',
          'Measuring a specific thing produces a smaller and much more defensible claim than '
            + 'repeating a general one.'
        ],
        example: 'The loop body is four instructions everywhere, and 16, 16 and 11 bytes.'
      },
      {
        term: 'ARM64 buys an instruction with addressing and gives it back to condition codes',
        plain: 'Post-increment saves one; the split compare and branch costs one.',
        formal: 'ldr w4, [x0], #4 folds the pointer advance; cmp then b.ne is two instructions',
        detail: [
          'RISC-V needs an addi to advance the pointer, and gets its loop test in a single '
            + 'compare-and-branch.',
          'ARM64 folds the advance into the load and then spends two instructions on the test, '
            + 'because the comparison writes a flags register that the branch reads.',
          'The two effects cancel exactly on this loop.',
          'That is a much more interesting result than either design winning: the differences are '
            + 'real and they are not additive.'
        ],
        example: 'RISC-V: lw, addi, add, bne. ARM64: ldr post-increment, add, cmp, b.ne. Four '
          + 'each.'
      },
      {
        term: 'Condition codes are a hidden dependency between instructions that look independent',
        plain: 'A compare writes flags; a branch reads them; nothing in the syntax says so.',
        formal: 'on x86 most arithmetic writes the flags as a side effect',
        detail: [
          'Two instructions that read as unrelated share a register nobody wrote down.',
          'A compiler must model it in its scheduler, and an out-of-order machine must rename it '
            + 'exactly as it renames the general registers.',
          'RISC-V left condition codes out for that reason, and pays an instruction for every '
            + 'comparison that is not immediately branched on.',
          'Whether that was right is arguable. That the cost was invisible in the listing and '
            + 'enormous in the implementation is not.'
        ],
        example: 'The flags cost nothing in the four-instruction loop count here, and everything '
          + 'in the renamer that M36 has to build.'
      },
      {
        term: 'Density is real, it is about 1.7x here, and it is paid for in the decoder',
        plain: 'A one-byte return and a two-byte zeroing against ten fixed four-byte words.',
        formal: 'x86-64: 23 bytes in lengths of 1, 2 and 3. RISC-V and ARM64: 40 bytes of 4',
        detail: [
          'Smaller code means more instructions per cache line and fewer instruction-cache '
            + 'misses, which is a genuine and sometimes decisive advantage on large programs.',
          'The price is that instruction boundaries are unknown until each instruction is decoded.',
          'A wide front end then needs length predictors, a micro-operation cache, or both.',
          'That is real area and real power, spent on a problem a fixed-width machine does not '
            + 'have.'
        ],
        example: 'ret is one byte on x86-64 and four on both RISC machines; zeroing a register '
          + 'is two bytes against four.'
      },
      {
        term: 'Variable-length decode is a serial dependency at the very front of the pipeline',
        plain: 'You cannot know where instruction two starts until instruction one is decoded.',
        formal: 'fixed width: next = pc + 4, always',
        detail: [
          'A fixed-width machine can hand sixteen bytes to four decoders at once, because the '
            + 'boundaries are arithmetic.',
          'A variable-width machine has a chain: length one, then start two, then length two.',
          'Every wide x86 implementation attacks this with predictors, and with a cache of '
            + 'already-decoded micro-operations that lets hot loops skip decoding entirely.',
          'That is an elegant fix and a lot of silicon.'
        ],
        example: 'Our own control decoder is 103 gates precisely because the fields are at fixed '
          + 'positions and their meaning is known immediately.'
      },
      {
        term: 'Register count is an encoding decision before it is a microarchitectural one',
        plain: '16 registers on x86-64, 32 on the others.',
        formal: 'a register field costs the logarithm of the count, once per operand',
        detail: [
          'The x86-64 architecture has sixteen architectural registers, because the encoding '
            + 'could not afford more without another prefix byte.',
          'RISC-V and ARM64 have thirty-two, because a fixed 32-bit word had room for three '
            + 'five-bit fields.',
          'The physical register file is far larger in all three — hundreds of entries — and '
            + 'renaming is what connects the small architectural number to the large physical one.',
          'So the architectural count is about spill pressure and encoding, not about how much '
            + 'storage the chip has.'
        ],
        example: 'This is the field-packing arithmetic from 34.1, met in three shipped '
          + 'instruction sets.'
      },
      {
        term: 'Every one of these differences shows up in compiler output',
        plain: 'Twenty lines of assembly tell you more than any summary.',
        formal: 'the listing is where an instruction set stops being a description',
        detail: [
          'Whether the addressing mode was used, whether the compare was folded into the branch, '
            + 'whether the constant needed two instructions, whether the loop was unrolled. All '
            + 'of that is visible in the listing.',
          'None of it is inferable from the source or from a benchmark total.',
          'It is also the only way to settle an argument about an instruction set without '
            + 'appealing to authority.',
          'That is why every one of these sections ends with a listing rather than a claim.'
        ],
        example: 'The listings here are annotated per row with which design decision produced '
          + 'that instruction.'
      },
      {
        term: 'A comparison is only as honest as what it says it held constant',
        plain: 'Same function, same optimisation intent, lengths stated per instruction.',
        formal: 'the listings are reference assembly checked against the encoding rules, not compiler output',
        detail: [
          'There is no x86 assembler in this project, so the byte counts come from the published '
            + 'encoding rules.',
          'They are listed instruction by instruction with the bytes, so any single row can be '
            + 'checked against the manual.',
          'Saying that plainly is worth more than the numbers.',
          'A comparison that does not state its method is unfalsifiable, and most published '
            + 'instruction-set comparisons do not state theirs.'
        ],
        example: 'add eax, [rdi+rcx*4] is listed as 03 04 8f — three bytes, checkable against '
          + 'any x86 encoding reference.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
