/** Reference entry for assembly programming (M34.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'assembly-programming': {
      summary: 'Five real programs assembled and single-stepped: registers, memory and the '
        + 'stack visible at every instruction, a recursion whose frames stack up on screen, the '
        + 'calling convention as a table nothing in the hardware enforces, and the six idioms '
        + 'that make up most of what a compiler emits.',
      intuition: 'A frame holds exactly what a call was about to destroy, and nothing else.',
      formulation: {
        equations: [
          {
            label: 'The five programs, run to completion',
            expr: 'program . instructions . result',
            terms: [
              { sym: 'sum 1..10', meaning: '44 . 55' },
              { sym: 'factorial 5 by recursion', meaning: '125 . 120' },
              { sym: 'array maximum', meaning: '43 . 37' },
              { sym: 'string length', meaning: '32 . 5' },
              { sym: 'console write', meaning: '47 . "hi there"' }
            ]
          },
          {
            label: 'Where the factorial\'s instructions go',
            expr: '125 total',
            terms: [
              { sym: 'inside multiply', meaning: '58 — 46%, because the base ISA has no multiply' },
              { sym: 'recursion depth', meaning: '5 frames, 8 bytes each, 40 bytes at the deepest' },
              { sym: 'against the sum loop', meaning: '2.8x, and half of that is the missing instruction' }
            ]
          },
          {
            label: 'The frame, and what each word is for',
            expr: 'addi sp, sp, -8 . sw ra, 4(sp) . sw a0, 0(sp) . [body] . lw ra, 4(sp) . addi sp, sp, 8 . ret',
            terms: [
              { sym: 'ra', meaning: 'the call is about to overwrite it — 16 in the outer frame, 48 in every inner one' },
              { sym: 'a0', meaning: 'the argument, which the call also overwrites' },
              { sym: 'sp', meaning: 'moves exactly twice, so every offset in the body is constant' }
            ]
          },
          {
            label: 'The calling convention, which nothing enforces',
            expr: 'register . role . who preserves it',
            terms: [
              { sym: 'x0 (zero)', meaning: 'always reads zero, discards writes . nobody' },
              { sym: 'x1 (ra)', meaning: 'return address . the caller, if it calls again' },
              { sym: 'x2 (sp)', meaning: 'stack pointer . the callee, exactly' },
              { sym: 'x5-x7, x28-x31 (t0-t6)', meaning: 'temporaries . the caller' },
              { sym: 'x8-x9, x18-x27 (s0-s11)', meaning: 'saved . the callee' },
              { sym: 'x10-x17 (a0-a7)', meaning: 'arguments and returns . the caller' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The stack pointer ends where it started',
          why: 'Every prologue is undone by exactly one epilogue.',
          breaks: 'The factorial reaches 40 bytes deep and returns sp to 0x10000f00 before the ecall.'
        },
        {
          name: 'A frame holds what a call would destroy, and nothing more',
          why: 'It is the only rule needed to decide what to save.',
          breaks: 'Each factorial frame is exactly two words: the return address and the argument.'
        },
        {
          name: 'The convention is a treaty, not a hardware check',
          why: 'A callee that fails to restore s0 breaks its caller, later, elsewhere.',
          breaks: 'Nothing in the datapath inspects the register number against a role.'
        },
        {
          name: 'Every program is run, and its answer is checked before its cost is quoted',
          why: 'An instruction count for a wrong answer is not a measurement.',
          breaks: 'The demo prints the result beside the instruction count for all five programs.'
        }
      ],
      complexity: [
        { operation: 'function call', average: '1 jal plus the prologue', worst: 'plus a spill per live temporary' },
        { operation: 'frame setup', average: '1 addi plus one store per saved value', worst: 'grows with the number of live values, not with the code' },
        { operation: 'recursion of depth d', average: 'd frames live at once', worst: 'd times the frame size of stack, and no compiler will warn you' },
        { operation: 'multiply, in the base ISA', average: 'a loop of additions', worst: '58 of the factorial\'s 125 instructions' },
        { operation: 'array element access', average: 'slli, add, then the load', worst: 'one instruction per access until strength reduction removes it' }
      ],
      failureModes: [
        {
          symptom: 'A recursive function returns garbage after the first level.',
          cause: 'The return address was left in ra, and the recursive call overwrote it.',
          fix: 'Save ra in the prologue. It is the first thing the frame exists for.'
        },
        {
          symptom: 'A caller misbehaves after calling a function that works correctly.',
          cause: 'The callee used a saved register and did not restore it.',
          fix: 'Save every s-register you touch; nothing in the hardware will tell you.'
        },
        {
          symptom: 'A stack overflow that appears only on large inputs.',
          cause: 'Recursion depth times frame size exceeded the stack; no check exists.',
          fix: 'Bound the depth, or convert to iteration. The demo makes the arithmetic visible.'
        },
        {
          symptom: 'A disassembly listing that does not line up with the source.',
          cause: 'Pseudo-instructions expanded — 13 of the factorial\'s 27 words.',
          fix: 'Read the expansion column; li of a large constant is two words, not one.'
        },
        {
          symptom: 'An instruction count that seems far too high for the algorithm.',
          cause: 'An operation the instruction set does not have is being done in software.',
          fix: 'Attribute the instructions by address, as the second worked example does.'
        }
      ],
      inTheWild: [
        'godbolt.org, which is this section with real compilers behind it.',
        'The RISC-V calling convention specification, which the demo\'s table reproduces.',
        'Stack canaries and shadow stacks, which exist because the return address is just a word in memory.',
        'The M extension for multiply, and every benchmark comparison that forgot to say whether it was enabled.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'chapter 2: procedures, stack frames and the convention' },
        { title: 'The RISC-V ELF psABI specification', note: 'the register roles, normatively' },
        { title: 'Bryant and O\'Hallaron — Computer Systems: A Programmer\'s Perspective', note: 'chapter 3 on machine-level programs, with the x86-64 version of the same ideas' },
        { title: 'Matt Godbolt — "What has my compiler done for me lately?" (CppCon 2017)', note: 'the case for reading assembly, made entertainingly' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
