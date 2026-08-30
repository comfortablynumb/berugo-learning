/** Worked examples for the toolchain and the instruction-set comparison (M34.9-M34.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'assembler-linker-and-loading': [
      {
        title: 'Two objects, one hole, and a program that runs',
        goal: 'Follow a symbol from an unresolved reference to a working branch.',
        setup: 'main.o sets two registers equal and branches to a label called target, which it '
          + 'does not define. target.o defines target and sets a0 to 42. Each is assembled '
          + 'independently at origin 0, knowing nothing about the other.',
        steps: [
          { do: 'Assemble main.o alone.',
            why: 'It can encode everything except the branch offset.',
            work: '20 bytes, defines _start, and one relocation: branch-shaped, at address 8, for target' },
          { do: 'Assemble target.o alone.',
            why: 'It needs nothing, so it has no relocations.',
            work: '8 bytes, defines target at its own offset 0' },
          { do: 'Place both.',
            why: 'This is the first moment any address is real.',
            work: 'main.o at 0x0 and target.o at 0x14, giving an image of 28 bytes' },
          { do: 'Resolve the hole.',
            why: 'Now the distance can be computed.',
            work: 'target is at 0x14, the branch is at 0x8, so the offset is 12 — inside the '
              + '4 094-byte reach' },
          { do: 'Load the image and run it.',
            why: 'Loading is placement again, at run time.',
            work: '5 instructions, then ecall, with a0 = 42' }
        ],
        answer: 'A0 = 42, from two files that were assembled in complete ignorance of each '
          + 'other. The step worth dwelling on is the fourth: the offset 12 did not exist while '
          + 'the objects were separate, and could not have. That is the whole reason linking is '
          + 'a separate program rather than a stage of the assembler, and the reason a range '
          + 'error is a linker error. The relocation record — address, shape, symbol — is what '
          + 'carried the question across the gap, and it is the same triple in every object '
          + 'format there has ever been.'
      },
      {
        title: 'The same branch, 5 012 bytes away, and the veneer that fixes it',
        goal: 'Break a link by adding unrelated data, then repair it the way a real linker does.',
        setup: 'The identical two objects, with a third object of 5 000 zero bytes placed '
          + 'between them. Nothing in either source changes. Then a fourth scenario inserts a '
          + 'stub: main.o branches to a nearby veneer, and the veneer takes a jump — a wider '
          + 'relocation shape — to the real target.',
        steps: [
          { do: 'Link main.o and target.o with 5 000 bytes in between.',
            why: 'Placement now puts them further apart than a branch can reach.',
            work: 'the offset needed is 5 012 and the field reaches 4 094' },
          { do: 'Read what the linker does about it.',
            why: 'Truncating would produce a branch to a plausible wrong address.',
            work: 'it refuses, and reports "out of range for a conditional branch: needs 5012"' },
          { do: 'Link main.o alone.',
            why: 'The other failure, for contrast.',
            work: 'undefined symbol: target — 0 offsets to compute, because there is no target address' },
          { do: 'Insert a veneer immediately after main.o.',
            why: 'A branch reaches 4 094 bytes; a jump reaches 1 048 574.',
            work: 'the branch reaches the veneer at offset 12; the veneer jumps 5 004 to target' },
          { do: 'Run the linked image.',
            why: 'Two hops where one would not fit.',
            work: '5 032 bytes, and a0 = 42 — the same answer as the direct link' }
        ],
        answer: 'The same source that linked cleanly fails once 5 000 unrelated bytes are placed '
          + 'in between, and the fix is an instruction nobody wrote. That is why large binaries '
          + 'contain thousands of tiny machine-generated functions, and why a link can start '
          + 'failing on the day somebody adds a table to a file you have never opened. The '
          + 'second and third steps are the pair worth keeping: an undefined symbol and an '
          + 'out-of-range relocation are both "the linker could not fill this hole", and they '
          + 'are completely different problems — one is a missing name and the other is a '
          + 'distance. A tool that reported only "link failed" would leave you to work out '
          + 'which.'
      }
    ],

    'real-instruction-sets': [
      {
        title: 'Sum an array, three ways, counted',
        goal: 'Compare three instruction sets on one function, and get a smaller answer than '
          + 'the usual argument predicts.',
        setup: 'The function sums an array of 32-bit integers. Each listing is reference '
          + 'assembly checked against the published encoding rules, with the encoded length on '
          + 'every row and the actual bytes on every x86-64 row, so any single line can be '
          + 'verified against the manual.',
        steps: [
          { do: 'Count the RISC-V version.',
            why: 'One addressing mode and no flags.',
            work: '10 instructions, 40 bytes, loop body 4 instructions and 16 bytes' },
          { do: 'Count the ARM64 version.',
            why: 'Rich addressing and condition codes.',
            work: '10 instructions, 40 bytes, loop body 4 and 16 — identical' },
          { do: 'Count the x86-64 version.',
            why: 'Variable width, condition codes, memory operands in arithmetic.',
            work: '10 instructions, 23 bytes, loop body 4 instructions and 11 bytes' },
          { do: 'Work out where ARM64\'s two effects went.',
            why: 'It has advantages RISC-V does not, and the loop is still four.',
            work: 'post-increment saves 1 instruction; cmp plus b.ne costs 1 back, so the loop is 4 either way' },
          { do: 'Take the density ratio.',
            why: 'This is the only column that moved.',
            work: '40 / 23 = 1.74 times denser' }
        ],
        answer: 'Ten instructions on all three, a four-instruction loop on all three, and a '
          + '1.74x difference in code size. That is a far narrower claim than "CISC needs fewer '
          + 'instructions", and it is the one the measurement supports. The fourth step is the '
          + 'most instructive: ARM64\'s post-increment load genuinely saves an instruction and '
          + 'its condition codes genuinely cost one, so two real differences cancel and the '
          + 'totals match by coincidence rather than by similarity. Any comparison that reports '
          + 'only the total would conclude the two architectures are the same, which they are '
          + 'not.'
      },
      {
        title: 'What the density costs: the front end that has to find the boundaries',
        goal: 'Price the 1.74x advantage in what the decoder must do to get it.',
        setup: 'The same three listings, read as an instruction stream rather than as a '
          + 'function. The question is what a front end has to do to hand four instructions per '
          + 'cycle to the back end.',
        steps: [
          { do: 'Find the second instruction in the RISC-V stream.',
            why: 'The boundary is arithmetic.',
            work: 'address + 4, with no decoding at all; 4 boundaries known from 16 bytes' },
          { do: 'Find the second instruction in the x86-64 stream.',
            why: 'The length is a property of the instruction.',
            work: 'decode the first — 2 bytes for xor eax, eax — then start there' },
          { do: 'Extend that to four instructions.',
            why: 'This is what a wide machine needs every cycle.',
            work: 'a serial chain of 4 length computations, against 4 independent decodes' },
          { do: 'Price our own fixed-width decoder for comparison.',
            why: 'We built one, so the number is real.',
            work: '103 gates at 24 gate delays — cheap enough to duplicate four times' },
          { do: 'Count the byte savings the chain buys.',
            why: 'The advantage has to be weighed against the cost.',
            work: '17 bytes on 40 — enough to matter when instruction cache misses are expensive' }
        ],
        answer: 'The density is bought with a serial dependency at the very front of the '
          + 'pipeline, and every wide x86 implementation spends real area on evading it: length '
          + 'predictors, and a cache of already-decoded micro-operations that lets a hot loop '
          + 'skip decoding entirely. That is an elegant answer to a self-inflicted problem, and '
          + 'it works — which is why the density advantage survives. The honest summary is that '
          + 'neither side of this argument won: the variable-width instruction set kept its '
          + 'code-size advantage and paid for it in the front end, and the fixed-width ones kept '
          + 'their trivial decode and pay for it in bytes. Our own 103-gate decoder is what the '
          + 'other side of that trade looks like when you can afford it.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
