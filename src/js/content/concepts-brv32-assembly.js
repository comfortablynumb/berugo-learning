/** Concepts for assembly programming (M34.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'assembly-programming': [
      {
        term: 'A stack frame exists because a call destroys registers',
        diagram: {
          definition: [
            'flowchart TB',
            '    E["entry: ra holds the return address,<br/>a0 holds the argument"] --> P["prologue:<br/>addi sp, sp, -8<br/>sw ra, 4(sp)<br/>sw a0, 0(sp)"]',
            '    P --> B["body: free to call anything —<br/>ra and a0 are safe on the stack"]',
            '    B --> X["epilogue:<br/>lw ra, 4(sp)<br/>addi sp, sp, 8"]',
            '    X --> R["ret: jalr x0, ra, 0"]',
            '    B -.->|"recursive call"| E'
          ].join('\n'),
          caption: 'The prologue saves exactly what the body would lose, and the epilogue undoes '
            + 'it exactly. Each invocation of a recursive function gets its own copy.'
        },
        plain: 'Anything a function still needs after a call has to be somewhere a call cannot reach.',
        formal: 'the prologue saves, the epilogue restores, and the stack pointer ends where it started',
        detail: [
          'The return address arrives in a register, and the moment the function calls anything '
            + 'that register is overwritten by the new call.',
          'The same is true of any argument or local it still needs afterwards.',
          'So the prologue pushes them, the body runs, and the epilogue pops them and returns.',
          'That discipline is exactly what makes recursion work. Each invocation gets its own '
            + 'copy of everything it saved, and the frames stack up in memory in the order the '
            + 'calls were made.'
        ],
        example: 'In the factorial demo the frames are 8 bytes each — a saved return address and '
          + 'a saved argument — and three of them are visible on the stack mid-run.'
      },
      {
        term: 'The calling convention is a treaty, and the hardware does not enforce any of it',
        plain: 'Which registers survive a call is an agreement between compilers, not a rule.',
        formal: 'caller-saved registers may be destroyed by a call; callee-saved must be restored',
        detail: [
          'Argument registers and temporaries are caller-saved: if you still need one after a '
            + 'call, save it yourself.',
          'The saved registers and the stack pointer are callee-saved: a function that uses one '
            + 'must put it back before returning.',
          'Nothing in the processor checks this.',
          'A callee that fails to restore a saved register produces a failure in its caller, '
            + 'doing something unrelated, some time later.',
          'That is why hand-written assembly that mostly works is such a dangerous thing to have '
            + 'in a codebase.'
        ],
        example: 'a0-a7 carry arguments and may be destroyed by a call; s0-s11 must come back '
          + 'unchanged; sp must be restored exactly, not approximately.'
      },
      {
        term: 'The stack grows down, and the pointer moves exactly twice',
        plain: 'One subtraction at entry, one addition at exit, and everything between is an offset.',
        formal: 'sp decreases on entry by the frame size and increases by the same amount on exit',
        detail: [
          'Moving the pointer once means every local has a constant offset from it for the whole '
            + 'body of the function.',
          'The assembler can then fold that offset into the load and store immediates.',
          'Moving it repeatedly would work, and would make every offset depend on where you are '
            + 'in the function, which is how hand-written assembly goes wrong.',
          'The downward direction is convention rather than necessity, chosen so the stack and '
            + 'the heap grow towards each other from opposite ends of the address space.'
        ],
        example: 'The factorial\'s prologue is addi sp, sp, -8 and its epilogue is addi sp, sp, '
          + '8; three frames deep, sp has moved 24 bytes from where it started.'
      },
      {
        term: 'Reading compiler output is the most durable skill in this track',
        plain: 'The assembly is what actually ran; the source is what you hoped would.',
        formal: 'the compiler is free to do anything that preserves observable behaviour',
        detail: [
          'Whether a call was inlined, whether a bounds check survived, whether a loop was '
            + 'vectorised, whether that atomic became a fence: none of these are answerable from '
            + 'the source.',
          'All of them are visible in twenty lines of assembly.',
          'Being able to read it turns performance arguments from opinion into observation, and '
            + 'it is the one skill in this milestone that stays useful whatever language you end '
            + 'up writing.',
          'It also makes the optimiser\'s behaviour concrete rather than magical, which is what '
            + 'M29 spends a milestone on.'
        ],
        example: 'A multiplication in a BRV32 program compiles to a loop of additions, because '
          + 'the base instruction set has no multiply — visible immediately in the listing.'
      },
      {
        term: 'Pseudo-instructions mean the listing has more lines than the source',
        plain: 'The assembler writes instructions you did not.',
        formal: 'li of a large constant is two instructions; mv, j, ret and beqz are one each',
        detail: [
          'A pseudo-instruction is a spelling, not an instruction: the machine has never heard of '
            + 'ret or mv.',
          'Most expand to exactly one real instruction.',
          'Loading a 32-bit constant expands to lui plus addi, so one source line becomes two '
            + 'words and every address after it shifts.',
          'When you compare a disassembly against the source that produced it, the line counts '
            + 'will not match. Knowing which lines the assembler invented is the difference '
            + 'between reading the listing and guessing at it.'
        ],
        example: 'The factorial listing is 27 words, of which 13 came from pseudo-instruction '
          + 'expansion — including the two-word li that sets up the stack pointer.'
      },
      {
        term: 'x0 is the reason so much of the instruction set never needed an opcode',
        plain: 'Six common idioms are ordinary instructions with the zero register in them.',
        formal: 'mv is addi rd, rs, 0; li is addi rd, x0, n; ret is jalr x0, ra, 0',
        detail: [
          'A register that always reads zero and discards writes turns general instructions into '
            + 'special ones for free.',
          'Move, load-immediate, compare-with-zero, jump-without-linking and discard-this-result '
            + 'all fall out of it without a single extra encoding.',
          'Recognising the pattern is how you read compiler output fluently.',
          'These shapes appear constantly, and none of them looks like what it does until you '
            + 'notice the x0.'
        ],
        example: 'beq rs, x0, target is branch-if-zero; jalr x0, ra, 0 is return, because the '
          + 'link it would write goes to x0 and vanishes.'
      },
      {
        term: 'Array indexing is a shift and an add, because there is one addressing mode',
        plain: 'Scale the index, add the base, then load with a constant offset.',
        formal: 'the only addressing mode is register plus signed 12-bit immediate',
        detail: [
          'With a single addressing mode, everything else is ordinary arithmetic the compiler can '
            + 'hoist out of loops, share between accesses and schedule like any other '
            + 'instruction.',
          'That is a real advantage over a machine with a scaled-index mode, where the address '
            + 'arithmetic is hidden inside the memory instruction and cannot be reused.',
          'It costs an instruction per access in naive code.',
          'Strength reduction — incrementing a pointer instead of recomputing an index — removes '
            + 'that in every loop that matters.'
        ],
        example: 'slli t0, t1, 2 then add t0, t0, base then lw a0, 0(t0): multiply the index by '
          + 'four because a word is four bytes.'
      },
      {
        term: 'A single-step view is worth more than any amount of reasoning about registers',
        plain: 'Run one instruction, look at everything, repeat.',
        formal: 'the architectural state is 32 registers, the program counter and memory — all of it visible',
        detail: [
          'Assembly is one of the few places where the entire state of the computation is small '
            + 'enough to display.',
          'A bug there does not need to be reasoned about: step to it and look.',
          'The habit generalises badly to large systems and superbly to small ones, and this '
            + 'milestone is a small one.',
          'That is exactly why single-stepping a recursive call until the frames stack up teaches '
            + 'more about calling conventions than any diagram of a frame can.'
        ],
        example: 'Stepping the factorial to instruction 24 shows sp at 0x10000ee8, three calls '
          + 'in flight, and a0 holding 2 on the way down.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
