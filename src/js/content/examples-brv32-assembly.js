/** Worked examples for assembly programming (M34.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'assembly-programming': [
      {
        title: 'Five stack frames, counted on the way down',
        goal: 'Watch a recursion build frames, and see exactly what each one had to save.',
        setup: 'The factorial program computes 5! by recursion, following the calling convention '
          + 'exactly. The stack starts at 0x10000f00 and grows down. Each invocation makes an '
          + '8-byte frame — addi sp, sp, -8 — and puts two things in it: the return address, '
          + 'which its own recursive call is about to overwrite, and its argument, which the '
          + 'call will also overwrite.',
        steps: [
          { do: 'Step to instruction 24 and read the stack pointer.',
            why: 'The depth is the distance from where it started.',
            work: 'sp = 0x10000ee8, which is 24 bytes below 0x10000f00 — 3 frames in flight' },
          { do: 'Read the six words those frames hold.',
            why: 'Two per frame, and the pattern is the whole calling convention.',
            work: '5 with return address 16, then 4 with 48, then 3 with 48' },
          { do: 'Explain the two different return addresses.',
            why: 'One frame was entered from a different call site.',
            work: '16 is the instruction after the initial jal at 0x0c; 48 is the instruction '
              + 'after the recursive jal at 0x2c, so every deeper frame saves 48' },
          { do: 'Run to the deepest point.',
            why: 'The recursion bottoms out at a0 < 2.',
            work: 'the stack reaches 40 bytes — 5 frames, one per value from 5 down to 1' },
          { do: 'Let it finish and read the answer.',
            why: 'Every epilogue must undo exactly one prologue.',
            work: '125 instructions, a0 = 120, and sp is back at 0x10000f00' }
        ],
        answer: '5 frames of 8 bytes each, 40 bytes at the deepest point, and the stack pointer '
          + 'back exactly where it started when the program traps on ecall. The second step is '
          + 'the one worth staring at: the frames hold precisely the two values the call was '
          + 'about to destroy, and nothing else. That is the whole rule for what goes in a '
          + 'frame. The third step is the one people get wrong when they write assembly by hand '
          + '— the return address differs between frames because it is a property of the call '
          + 'site, not of the function, which is exactly why it cannot live in a fixed location '
          + 'and why a recursion without a stack does not work.'
      },
      {
        title: 'Why the factorial costs 125 instructions and the sum loop costs 44',
        goal: 'Attribute a 2.8x difference in instruction count to a missing instruction rather '
          + 'than to the algorithm.',
        setup: 'Five programs, all run to completion on the behavioural simulator with a budget '
          + 'of 3 000 instructions: a counted sum, a recursive factorial, an array maximum, a '
          + 'string length and a console write. Each ends in ecall, and the instruction count '
          + 'includes it.',
        steps: [
          { do: 'Run all five and record what each computes.',
            why: 'A cost comparison needs the answers to be right first.',
            work: 'sum = 55, factorial = 120, array max = 37, strlen = 5, console prints "hi there"' },
          { do: 'Record the instruction counts.',
            why: 'This is the number the chart plots.',
            work: '44, 125, 43, 32 and 47 instructions' },
          { do: 'Ask where the factorial spends its 125.',
            why: 'Recursion of depth 5 does not obviously cost three times a 10-iteration loop.',
            work: '58 of the 125 — 46% — are executed inside the multiply subroutine' },
          { do: 'Look at what multiply is.',
            why: 'The base instruction set has no multiply instruction.',
            work: '4 calls at 4 instructions of setup and return, plus 3 per iteration over 14 iterations: 16 + 42 = 58' },
          { do: 'Count the source lines against the assembled words.',
            why: 'The listing has more lines than the program does.',
            work: '27 words, of which 13 were written by the assembler expanding '
              + 'pseudo-instructions' }
        ],
        answer: 'The factorial is 2.8 times the sum loop, and almost half of its instructions are '
          + 'not factorial at all: they are the software multiply that the instruction set does '
          + 'not provide. That is the point of the example. "How many instructions does this '
          + 'algorithm take" is a question about the instruction set as much as about the '
          + 'algorithm, which is why RISC-V puts multiply in an optional extension and why '
          + 'measuring instruction counts across architectures without saying which extensions '
          + 'were enabled produces numbers that mean nothing. The last step is the reading '
          + 'skill: half the listing was written by the assembler, and a disassembly will show '
          + 'you those thirteen words rather than the source lines they came from.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
