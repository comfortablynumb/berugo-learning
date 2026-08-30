/** Worked examples for ILP, dynamic scheduling and the reorder buffer (M36.1-M36.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'instruction-level-parallelism': [
      {
        title: 'Two programs with the same arithmetic and a 32-fold difference in ceiling',
        goal: 'Compute the ILP bound of both halves of the chain/independent pair, and see '
          + 'which of the two numbers the machine actually gets near.',
        setup: 'Both fixtures perform 32 additions. `chain` writes them as one dependence '
          + 'chain through t0; `independent` writes them over four register names with no true '
          + 'dependence. Both traces come from the M34 behavioural simulator, and the '
          + 'dependence graph is built over the executed instructions.',
        steps: [
          { do: 'Count the instructions in each trace.',
            why: 'The bound is a ratio, so the numerator has to be a real count.',
            work: 'chain 33 instructions, independent 32' },
          { do: 'Find the longest chain of read-after-write edges in `chain`.',
            why: 'That chain is how long the program takes on an unlimited machine.',
            work: '32 additions each reading the previous result, plus the initial li: 33 cycles' },
          { do: 'Divide.',
            why: 'Instructions over critical path is the highest IPC any machine could report.',
            work: '33 / 33 = 1.00' },
          { do: 'Do the same for `independent`, counting only true dependences.',
            why: 'No addition reads any other addition\'s result.',
            work: 'critical path 1 cycle, so 32 / 1 = 32.00' },
          { do: 'Now run both on the simulator at issue width 4.',
            why: 'The gap between bound and measurement is what the hardware costs.',
            work: 'chain 38 cycles for an IPC of 0.868; independent 21 cycles for 1.524' },
          { do: 'Take the ratio of bound to measurement in each case.',
            why: 'That headroom is the whole diagnostic.',
            work: 'chain 1.00 / 0.868 = 1.15x; independent 32.00 / 1.524 = 21.00x' }
        ],
        answer: 'Two programs doing exactly the same arithmetic, and their ceilings differ by '
          + 'a factor of 32. `chain` reaches 87% of its ceiling and there is nothing left to '
          + 'win: no width, no window and no better predictor changes a chain of 32 true '
          + 'dependences, and the only useful edit is in the source. `independent` reaches 5% '
          + 'of its ceiling, so the code has parallelism the machine is failing to use, and '
          + 'now the questions about ports and width are worth asking - the answer there turns '
          + 'out to be that the core has two integer ports and the code would need 32. The '
          + 'two headroom figures point at completely different work, and computing them costs '
          + 'one pass over a trace.'
        },
      {
        title: 'What renaming is worth, as an arithmetic difference on one trace',
        goal: 'Show that the 32.00 bound for `independent` depends entirely on register '
          + 'renaming, by recomputing it with the name dependences counted.',
        setup: 'The same `independent` trace: 32 additions written over t0, t1, t2 and t3, so '
          + 'each name is written eight times. A machine that renames sees no dependence '
          + 'between two writes to one name; a machine without a physical register file must '
          + 'order them.',
        steps: [
          { do: 'Count the read-after-write edges in the trace.',
            why: 'These are the only real dependences.',
            work: '0 - no addition reads another addition\'s result' },
          { do: 'Count the write-after-write edges.',
            why: 'Eight writes to each of four names is seven ordered pairs per name.',
            work: '4 names x 7 = 28 edges' },
          { do: 'Find the critical path with only true dependences allowed to constrain.',
            why: 'That is the renamed machine.',
            work: '1 cycle, so the bound is 32 / 1 = 32.00' },
          { do: 'Find it again with the name dependences constraining as well.',
            why: 'That is a scoreboard, which has to order two writes to one name.',
            work: 'the longest chain is the eight writes to one name: 8 cycles, so 32 / 8 = 4.00' },
          { do: 'Take the ratio.',
            why: 'This is what the physical register file buys on this code.',
            work: '32.00 / 4.00 = 8.0x' }
        ],
        answer: 'Renaming is worth a factor of eight on this trace, and the reason is that '
          + 'nothing in it is a real dependence at all - all 28 constraints a scoreboard would '
          + 'respect are artefacts of there being 32 register names rather than 32 values. '
          + 'That matters beyond the fixture, because this is precisely the code a compiler '
          + 'emits when it runs out of registers: a loop unrolled eight times over four spare '
          + 'names looks obviously parallel to a reader and is eight-way serialised to a '
          + 'machine that cannot rename. It is also why the fixture was written over four '
          + 'names on purpose. Written over 32 distinct names it would have shown a bound of '
          + '32.00 under both models and proved nothing.'
      }
    ],

    'dynamic-scheduling': [
      {
        title: 'Pricing the physical register file by shrinking it',
        goal: 'Measure how much renaming depth is worth on a real program, using the one '
          + 'lever a real machine has.',
        setup: 'The `stride` fixture at issue width 4, run six times with different physical '
          + 'register file sizes. Thirty-two of the registers always hold the architectural '
          + 'state, so a file of 34 leaves two spare and the machine can only have two renamed '
          + 'writes in flight at once.',
        steps: [
          { do: 'Run with 34 physical registers.',
            why: 'Two spare: renaming exists but is two deep.',
            work: '530 cycles' },
          { do: 'Run with 40.',
            why: 'Eight spare.',
            work: '362 cycles' },
          { do: 'Run with 48.',
            why: 'Sixteen spare.',
            work: '190 cycles' },
          { do: 'Run with 64, the default.',
            why: 'Thirty-two spare, matched to the 32-entry reorder buffer.',
            work: '126 cycles' },
          { do: 'Run with 96 and 192.',
            why: 'To find where more registers stop buying anything.',
            work: '126 cycles both times - the curve is flat past 64' },
          { do: 'Take the ratio between the smallest and the flat part.',
            why: 'That is what renaming depth is worth here.',
            work: '530 / 126 = 4.21x' }
        ],
        answer: 'Renaming depth is worth 4.21x on this program, and the curve goes flat at 64 '
          + 'physical registers - exactly twice the architectural count and exactly the size '
          + 'of the reorder buffer. That coincidence is a design rule rather than an accident: '
          + 'the file has to be large enough that every in-flight instruction can have a '
          + 'destination, and larger than that is silicon nobody uses. Note what this '
          + 'measurement is not: at 34 registers the machine is still renaming, it simply '
          + 'cannot rename far ahead. Removing renaming altogether is a different and larger '
          + 'number, and the only way to get it here is the dependence-graph comparison from '
          + '36.1, because the simulator has no unrenamed mode to run.'
      },
      {
        title: 'The register leak that produces an empty pipeline that cannot dispatch',
        goal: 'Trace the free-list bug that made a 34-register machine deadlock, and see why '
          + 'the symptom was so misleading.',
        setup: 'A machine with 34 physical registers running `independent`, which writes t0, '
          + 't1, t2 and t3 in turn. The original release rule returned a register to the free '
          + 'list only if its number was 32 or above, on the theory that registers 0 to 31 '
          + 'permanently hold the architectural mapping.',
        steps: [
          { do: 'Count the free registers at the start.',
            why: 'Thirty-two are mapped to architectural names, and the rest are free.',
            work: '34 - 32 = 2 free, numbered 32 and 33' },
          { do: 'Rename the first two instructions.',
            why: 'Each takes one register from the free list.',
            work: 'free list is empty; t0 now means p32 and t1 means p33' },
          { do: 'Commit the first instruction and apply the release rule.',
            why: 'Commit frees the register the name used to mean.',
            work: 'the old mapping of t0 was p5, and 5 < 32, so nothing is freed' },
          { do: 'Try to dispatch the third instruction, which writes t2.',
            why: 'It needs a physical register and there are none.',
            work: 'dispatch stalls with "no free physical register", and 0 registers ever come back' },
          { do: 'Observe the machine after 200 cycles.',
            why: 'The symptom is the thing that made this hard to find.',
            work: 'retired 2, reorder buffer 0 entries, issue queue 0, free list 0' }
        ],
        answer: 'The machine stalls forever with an EMPTY pipeline, which is the opposite of '
          + 'what a resource exhaustion is expected to look like and is why the bug survived a '
          + 'clean architectural differential: every program that had enough registers ran '
          + 'perfectly. The rule was wrong because physical registers 1 to 31 are ordinary '
          + 'members of the file that merely start out mapped; once an instruction overwrites '
          + 'the name one of them held, it is as dead as any other superseded register and has '
          + 'to come back. Only register 0 stays reserved, because it is the one x0 means and '
          + 'writes to it are dropped, so an instruction allocated it would wait forever for a '
          + 'value that never arrives. This is the second leak of this kind in the same file, '
          + 'and both had the same signature.'
      }
    ],

    'reorder-buffer-and-precise-state': [
      {
        title: 'A misaligned store with the whole reorder buffer behind it',
        goal: 'Raise a fault deep inside a running machine and check the state the handler '
          + 'sees against a machine that never had more than one instruction in flight.',
        setup: 'A nine-instruction dependence chain producing the value 9, then '
          + '`add a0, a0, t0` against a base of 0x10000000 and `sw a1, 0(a0)`, then forty '
          + 'independent additions and an ecall. The chain is what makes this work: the store '
          + 'cannot compute its address for nine cycles, so it sits at the head of the buffer '
          + 'while the independent work behind it fills every entry.',
        steps: [
          { do: 'Run to the trap and read the window size in the cycle before it.',
            why: 'A fault raised into an empty machine proves nothing about precise state.',
            work: '32 instructions in flight, which is the whole buffer' },
          { do: 'Read the cause register.',
            why: 'A misaligned store is cause 6.',
            work: 'mcause = 6, "misaligned store"' },
          { do: 'Read the exception program counter and the trap value.',
            why: 'The handler needs the exact instruction and the exact address.',
            work: 'mepc = 0x34, mtval = 0x10000009' },
          { do: 'Count what the trap discarded.',
            why: 'Everything younger than the fault has to be made never to have happened.',
            work: '39 instructions: 31 from the buffer and 8 from the fetch buffer, '
              + 'against 13 retired' },
          { do: 'Step the M34 behavioural simulator 13 times and compare every register and '
            + 'control register.',
            why: 'Comparing a few chosen fields would miss the one that moved.',
            work: '0 differences' }
        ],
        answer: 'Identical state, with the whole buffer occupied and 39 instructions '
          + 'discarded - 31 from the reorder buffer and 8 more that had been fetched and not '
          + 'yet dispatched, which are exactly as speculative and were missed by the first '
          + 'version of the squash. Two things about this fixture are worth more than the result. The '
          + 'first is that the obvious version of it - forty additions and then the fault - '
          + 'measures nothing: the additions are independent, so they retire as fast as they '
          + 'arrive and the window has drained to three entries by the time the fault reaches '
          + 'the head. Making the faulting ADDRESS depend on a chain is what fills the window. '
          + 'The second is that this fixture used to fail outright, because the machine '
          + 'checked whether a store was legal by attempting the write - which is exactly what '
          + 'an in-order machine may do and what an out-of-order machine may not. The '
          + 'misaligned store then never faulted at all, and the register comparison still '
          + 'passed, because a machine that skips a trap retires MORE instructions and both '
          + 'still hold the right values.'
      },
      {
        title: 'Pricing the window on two programs that disagree about it',
        goal: 'Sweep the reorder buffer size and see that the same control is worth 4.3x on '
          + 'one program and nothing at all on another.',
        setup: '`stride` and `chain` at issue width 4, with the physical register file and the '
          + 'issue queue held large so that the buffer is the only limit. `stride` is 32 '
          + 'independent loads; `chain` is 32 additions in one dependence chain.',
        steps: [
          { do: 'Run `stride` with a 4-entry buffer.',
            why: 'The smallest window that can hold anything.',
            work: '463 cycles' },
          { do: 'Raise it to 16 and then to 32.',
            why: 'Each extra entry is another load whose miss can overlap.',
            work: '202 cycles, then 126' },
          { do: 'Raise it to 64 and 128.',
            why: 'To find where it stops paying.',
            work: '108 cycles both times' },
          { do: 'Run `chain` across the whole sweep.',
            why: 'A dependence chain never has anything waiting to dispatch.',
            work: '38 cycles at 4, 8, 16, 32, 64 and 128 entries' },
          { do: 'Compare the two ratios.',
            why: 'One control, two completely different answers.',
            work: 'stride 463 / 108 = 4.29x; chain 38 / 38 = 1.00x' }
        ],
        answer: 'The buffer is worth 4.29x on the array walk and exactly nothing on the '
          + 'dependence chain, which is the honest version of "bigger windows are better". '
          + 'What the window actually buys is the ability to run far enough ahead to find the '
          + 'next independent long-latency operation, so it pays in proportion to how much '
          + 'independent work is waiting behind the head of the buffer. That is a memory-level '
          + 'parallelism argument rather than an instruction-level one, and it is why reorder '
          + 'buffers kept growing from around 40 entries to several hundred long after issue '
          + 'widths had stopped rising. It is also why the sweep can go the wrong way: on '
          + '`arrayMax` the machine takes 52 cycles at 32 entries and 54 at 64, because the '
          + 'extra depth was spent running down a mispredicted path.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
