/** Worked examples for the memory interface, I/O, exceptions and privilege (M34.7-M34.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'memory-interface-and-io': [
      {
        title: 'The same four bytes, read six ways',
        goal: 'Watch width and signedness produce five different numbers from one address.',
        setup: 'The word 0xfeedbe80 stored at 0x10000000, little-endian, so the byte at the '
          + 'lowest address is 0x80 and the byte at the highest is 0xfe. Every load is driven '
          + 'through the real address decoder, and every result comes back from it rather than '
          + 'being computed for the table.',
        steps: [
          { do: 'Load one byte, signed.',
            why: 'lb takes the byte at the lowest address and copies its top bit upward.',
            work: '0x80 has its top bit set, so the answer is -128' },
          { do: 'Load the same byte, unsigned.',
            why: 'lbu fills the upper 24 bits with zeros instead.',
            work: '128 — the same byte, the same address, a different opcode' },
          { do: 'Load a half word, both ways.',
            why: 'Two bytes now: 0xbe80.',
            work: 'signed -16 768, unsigned 48 768' },
          { do: 'Load the whole word.',
            why: 'At four bytes there is no choice left to make.',
            work: '-17 973 632 either way — the value already fills the register' },
          { do: 'Load a byte from 0x10000003.',
            why: 'The highest byte of the word.',
            work: '0xfe, which is -2 signed and 254 unsigned' }
        ],
        answer: 'Five different numbers from one address and one set of bytes, chosen entirely '
          + 'by the opcode. The fourth step is the one that closes the loop: at the register '
          + 'width the distinction disappears, which is why sign extension is a question about '
          + 'narrow loads specifically. This is the hardware root of an entire family of C bugs '
          + 'about whether `char` is signed — the language leaves it to the platform, the '
          + 'platform means which of these two instructions the compiler emits, and code that '
          + 'compares a `char` against 0x80 gets different answers on ARM and x86 for exactly '
          + 'this reason.'
      },
      {
        title: 'Every width against every alignment, and what each failure says',
        goal: 'Drive the whole matrix through the real decoder and read the faults.',
        setup: 'Six addresses — four consecutive bytes in RAM, one console register and one '
          + 'unmapped address — crossed with three widths. Eighteen accesses, each one a real '
          + 'call into the address decoder, with the fault reported as a cause and a value '
          + 'rather than thrown.',
        steps: [
          { do: 'Drive the four RAM addresses at all three widths.',
            why: 'Alignment is one modulo test, applied uniformly.',
            work: '0x...00 takes all 3 widths; 0x...01 takes 1; 0x...02 takes 2; 0x...03 takes 1' },
          { do: 'Count the faults in the RAM rows.',
            why: 'These are the alignment failures specifically.',
            work: '5 of 12 accesses fault: cause 4, load address misaligned' },
          { do: 'Drive the unmapped address.',
            why: 'A different failure, at a different stage of the decode.',
            work: 'all 3 widths fault with cause 5, load access fault — alignment was never reached' },
          { do: 'Total the matrix.',
            why: 'The eighteen results are the whole behaviour of the interface.',
            work: '8 of 18 fault, and the other 10 return a value' },
          { do: 'Read what each fault carries.',
            why: 'A fault is architectural state, and the value is the diagnosis.',
            work: 'cause 4 with mtval 0x10000001; cause 5 with mtval 0x30000000' }
        ],
        answer: 'Eight faults of eighteen accesses, in two distinct classes, and the useful part '
          + 'is that they are distinct. A misaligned access reached a mapped region and was '
          + 'refused for its shape; an unmapped access never got that far. The handler can tell '
          + 'them apart from the cause alone, and the offending address is in mtval either way. '
          + 'That is the whole argument for faulting rather than improvising: a machine that '
          + 'quietly read the wrong bytes from 0x10000001 would produce a number, the program '
          + 'would carry on, and the failure would surface somewhere else entirely with nothing '
          + 'to connect it back.'
      }
    ],

    'exceptions-and-privilege': [
      {
        title: 'Five exception classes, and the state the hardware saved for each',
        goal: 'Raise every synchronous class from a running program and read the CSRs.',
        setup: 'Five short programs, each one doing something the machine refuses, followed by '
          + 'an instruction that sets a3 and a spin loop. A handler is loaded at the trap vector '
          + '0x100; it reads mcause, advances mepc past the offending instruction and returns '
          + 'with mret.',
        steps: [
          { do: 'Execute ecall.',
            why: 'A deliberate exception — this is what a system call is.',
            work: 'cause 11, mepc = 0x4, mtval = 0' },
          { do: 'Execute a word with no opcode.',
            why: 'An illegal instruction, which must trap rather than do anything.',
            work: 'cause 2, mepc = 0x4, mtval = 0xffffffff — the offending word itself' },
          { do: 'Load a word from an odd address.',
            why: 'A misaligned access.',
            work: 'cause 4, mepc = 0x8, mtval = 0x10000001 — the address that was wrong' },
          { do: 'Store a word to 0x10000002, then load from 0x40000000.',
            why: 'The store side of the same check, and an unmapped region.',
            work: 'cause 6 with mtval 0x10000002; cause 5 with mtval 0x40000000' },
          { do: 'Let each one return.',
            why: 'The handler advances mepc by 4 and executes mret.',
            work: 'all five continue, set a3 = 4, and reach the spin loop — 1 trap each' }
        ],
        answer: 'Five classes, five causes, and in four of them mtval names the exact value that '
          + 'was wrong — the address, or the instruction word itself. That is the difference '
          + 'between "a load faulted" and "a load of 0x10000001 faulted", which is the '
          + 'difference between a message and a diagnosis. The last step is the one that makes '
          + 'the mechanism a mechanism rather than a crash: every one of these programs '
          + 'continues afterwards and finishes normally. A trap is a redirection, and whether it '
          + 'becomes a crash is a decision the handler makes, which is exactly what an operating '
          + 'system is for.'
      },
      {
        title: 'The handler that skips four bytes, and the interrupt it silently eats',
        goal: 'See a correct-looking handler lose one instruction per interrupt, with no error '
          + 'anywhere.',
        setup: 'A program that sets four registers and spins, with the timer armed to interrupt '
          + 'after three instructions. Two handlers, identical except for one branch: the first '
          + 'checks the sign bit of mcause and takes a different path for an interrupt; the '
          + 'second always advances mepc by four, which is correct for every synchronous '
          + 'exception in the previous example.',
        steps: [
          { do: 'Run with the cause-aware handler.',
            why: 'It resumes at the interrupted instruction and re-arms the timer.',
            work: '1 trap taken, and the program ends with a0 = 1, a1 = 2, a2 = 3, a3 = 4' },
          { do: 'Run with the unconditional handler.',
            why: 'It does exactly what worked for all five exception classes.',
            work: '5 traps taken, and a3 is still 0 at the end' },
          { do: 'Find the missing instruction.',
            why: 'mepc pointed at an instruction that had not run yet.',
            work: 'the interrupt landed before li a3, 4; adding 4 to mepc skipped it entirely' },
          { do: 'Ask why there were 5 traps rather than 1.',
            why: 'The interrupt condition is a level, not an event.',
            work: 'the handler never wrote the timer, so the condition still held on all 5 returns' },
          { do: 'Look for the error message.',
            why: 'This is the point of the example.',
            work: '0 — neither run reports anything; one of them simply computes the wrong answer' }
        ],
        answer: 'One branch on the sign bit of mcause is the difference between a program that '
          + 'finishes correctly and one that quietly loses an instruction per interrupt, at a '
          + 'rate set by the timer. Both runs complete, neither raises an error, and the only '
          + 'evidence is a register holding 0 where it should hold 4. The second failure — five '
          + 'traps instead of one — is the acknowledgement bug, and it is a livelock rather than '
          + 'a crash: while the interrupt condition holds, the machine re-enters the handler the '
          + 'instant it returns. Both defects are in the class of bug that testing finds only if '
          + 'the test happens to check the value, which is why hardware people talk about '
          + 'precise exceptions with such care.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
