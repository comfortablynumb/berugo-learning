/** Worked examples for pipelining, structural hazards and forwarding (M35.1-M35.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'pipelining-fundamentals': [
      {
        title: 'Pipelining this datapath makes it slower, and the reason is one stage',
        goal: 'Run the textbook improvement on a real datapath and find out it does not apply.',
        setup: 'The sum program on the M34 single-cycle machine and on the same datapath cut '
          + 'into five stages. Both are measured in gate delays, which is the only unit they '
          + 'share. The single-cycle period of 178 and the block delays behind the stage period '
          + 'were both measured in M34.4.',
        steps: [
          { do: 'Take the single-cycle baseline.',
            why: 'One instruction per cycle at the whole datapath\'s delay.',
            work: '43 instructions x 178 gate delays = 7 654' },
          { do: 'Find the pipelined clock period.',
            why: 'It is the longest stage, not the longest path.',
            work: 'the ALU is 148 of the 175 gate delays, so the period is 148 + 3 = 151' },
          { do: 'Run the program on the pipeline.',
            why: 'Cycles, not instructions, once they overlap.',
            work: '52 cycles for 43 instructions — an IPC of 0.827' },
          { do: 'Multiply out.',
            why: 'Only the product compares two machines.',
            work: '52 x 151 = 7 852 against 7 654 — pipelining lost by 3%' },
          { do: 'Repeat with the logic divided evenly between the stages.',
            why: 'To separate "pipelining" from "this datapath".',
            work: '175 / 5 + 3 = 38 a stage, so 52 x 38 = 1 976 — 3.9 times faster' }
        ],
        answer: 'Pipelining this datapath into five stages is slightly slower than not '
          + 'pipelining it, and pipelining a balanced version of it is nearly four times '
          + 'faster. The difference is not the pipeline: it is that the ALU holds 85% of the '
          + 'logic delay, so cutting the machine into five pieces produces one piece almost as '
          + 'long as the whole. That makes "pipeline it" an incomplete instruction. The '
          + 'complete one is "balance the stages, then pipeline it", and balancing this one '
          + 'means replacing the ripple-carry adder from 33.6 with a lookahead design — which '
          + 'is a change to the arithmetic rather than to the pipeline, and would never be '
          + 'found by looking at the pipeline.'
      },
      {
        title: 'Every cycle accounted for, and why the accounting had to be rebuilt',
        goal: 'Attribute all 52 cycles, and see why deriving the attribution from the events '
          + 'was wrong.',
        setup: 'The same run. Every cycle, the write-back stage either retires an instruction, '
          + 'commits a trap, or holds a bubble — and each bubble is charged to whatever created '
          + 'it. The three counts must sum to the cycle count, by construction rather than by '
          + 'coincidence.',
        steps: [
          { do: 'Count the retiring cycles.',
            why: 'This is the work the program actually needed.',
            work: '43 instructions retired' },
          { do: 'Count the trap.',
            why: 'The final ecall commits a trap instead of writing a register.',
            work: '1 cycle' },
          { do: 'Count the fill.',
            why: 'The first instruction takes five cycles; nothing retires during four of them.',
            work: '4 cycles' },
          { do: 'Count the flushes.',
            why: 'Two per redirect, and the loop redirects twice with a predictor.',
            work: '4 cycles' },
          { do: 'Add them up and compare with the cycle count.',
            why: 'A model whose cycles do not add up is measuring something it has not described.',
            work: '43 + 1 + 4 + 4 = 52, which is the cycle count exactly' }
        ],
        answer: 'Fifty-two cycles, fully attributed. The first version of this accounting was '
          + 'derived from the stall and flush events instead, and it was off by exactly one on '
          + 'every program — because a bubble created near the end of a run never reaches '
          + 'write-back, and a pipeline that refills after a trap pays the fill twice while the '
          + 'formula charged it once. Both are the same mistake in different clothes: counting '
          + 'the cause rather than the effect. Charging each empty write-back cycle to the '
          + 'bubble that actually arrived there is exact by construction, and it is worth the '
          + 'rewrite, because an attribution that is nearly right is one that nobody can use to '
          + 'settle an argument.'
      }
    ],

    'structural-hazards': [
      {
        title: 'What a second memory port is worth, per program',
        goal: 'Price a piece of hardware by measuring the stalls it removes.',
        setup: 'Four programs, each run twice on the same pipeline: once with a single memory '
          + 'serving both instruction fetch and data access, and once with separate ports. '
          + 'Everything else is identical, including the branch predictor, so the only '
          + 'difference in the cycle counts is contention for the port.',
        steps: [
          { do: 'Run the sum loop, which never touches memory.',
            why: 'The case where the second port buys nothing at all.',
            work: '0 memory instructions, 52 cycles either way' },
          { do: 'Run the array maximum.',
            why: 'A load every iteration.',
            work: '6 memory instructions: 65 cycles unified against 62 split — 3 cycles' },
          { do: 'Run the string length.',
            why: 'A byte load in a tighter loop.',
            work: '6 memory instructions: 51 against 46 — 5 cycles, or 10.9%' },
          { do: 'Run the factorial.',
            why: 'Loads and stores around every call.',
            work: '19 memory instructions: 177 against 161 — 16 cycles, or 9.9%' },
          { do: 'Compare the memory-instruction count with the cost.',
            why: 'This is the whole basis for the decision.',
            work: '0, 6, 6 and 19 memory instructions against 0, 3, 5 and 16 cycles of cost' }
        ],
        answer: 'A whole second memory buys nothing on one of these four programs and about 10% '
          + 'on two of them. That is the entire argument for the Harvard split, and notice what '
          + 'it is not: it is not an argument about architecture, it is a measurement of a '
          + 'workload. Choosing benchmarks that all contain loads would justify the hardware; '
          + 'choosing the sum loop alone would reject it. The general form of this decision — '
          + 'duplicate the resource or queue for it — arrives constantly in software, at '
          + 'connection pools and thread pools and service replicas, and almost always without '
          + 'anybody counting the stalls first. The processor version is worth studying '
          + 'precisely because the instrumentation is already fitted.'
      },
      {
        title: 'The stall is invisible in the answer, which is why it survives',
        goal: 'Confirm that a structural hazard is a performance problem and never a '
          + 'correctness one.',
        setup: 'The array-maximum program on the unified-memory machine and the split-memory '
          + 'machine, with the architectural state of both compared against the M34 behavioural '
          + 'simulator at the same number of retired instructions.',
        steps: [
          { do: 'Run with one memory and read the answer.',
            why: 'The program computes a maximum; the port arrangement should not change it.',
            work: '37, in 65 cycles' },
          { do: 'Run with two memories and read the answer.',
            why: 'The same comparison.',
            work: '37, in 62 cycles' },
          { do: 'Compare both against the behavioural simulator.',
            why: 'A cycle-count difference could hide a correctness difference.',
            work: '0 register differences in both configurations' },
          { do: 'Look at where the 3 cycles went.',
            why: 'They are the only visible trace of the hazard.',
            work: '6 structural stalls appear in the attribution and nowhere else' },
          { do: 'Ask what would have reported this in production.',
            why: 'This is the point of the example.',
            work: 'nothing: a 4.8% slowdown against a model that was probably wrong about '
              + 'something else too' }
        ],
        answer: 'Identical answers, a 4.8% difference in cycles, and no error anywhere. That is '
          + 'what makes a structural hazard the kind of thing that lives in a design for years: '
          + 'it cannot fail a test, it cannot corrupt anything, and its only symptom is a '
          + 'benchmark being slightly slower than expected — which is a description of almost '
          + 'every benchmark. The attribution table is the only thing that turns it into a '
          + 'number somebody can act on, and building that table is the reason this simulator '
          + 'records a cause for every cycle rather than just counting them.'
      }
    ],

    'data-hazards-and-forwarding': [
      {
        title: 'The double hazard: right on four fixtures, wrong on the fifth',
        goal: 'Run the classic forwarding bug and see exactly how narrow it is.',
        setup: 'Five dependency shapes and two forwarding units. The correct unit checks the '
          + 'EX/MEM latch before MEM/WB, so the more recent producer wins; the naive one checks '
          + 'them the other way round. Every answer is compared against the M34 behavioural '
          + 'simulator, which shares none of the pipeline\'s code.',
        steps: [
          { do: 'Run the dependency chain on both units.',
            why: 'Every instruction reads the one before it — the obvious test.',
            work: 'both give 30, in 9 cycles' },
          { do: 'Run the load-use and scheduled fixtures on both.',
            why: 'The other shapes a person would think to write.',
            work: 'both give 43, in 12 cycles' },
          { do: 'Run the independent fixture on both.',
            why: 'The control: nothing to forward.',
            work: 'both give 4, in 9 cycles' },
          { do: 'Run the double hazard: two writes to a2, then a read.',
            why: 'The one shape that separates them.',
            work: 'the correct unit gives 14; the naive one gives 4' },
          { do: 'Run the array-maximum program on the naive unit.',
            why: 'A real program rather than a fixture.',
            work: 'it computes 59 049 235 instead of 37' }
        ],
        answer: 'The naive forwarding unit is correct on four of five hand-written fixtures and '
          + 'wrong on a real program. That gap is the whole lesson, and it is not about '
          + 'pipelines. The bug needs two back-to-back writes to the same register followed by '
          + 'a read — a shape a person writing test assembly produces almost never, because a '
          + 'person names a fresh register for a fresh value, and a register allocator produces '
          + 'constantly, because it reuses a register the moment the previous value is dead. '
          + 'The machine passes every test somebody would think to write and fails on compiler '
          + 'output. The remedy is not more hand-written tests: it is an oracle generated by a '
          + 'different process, which is why the answer column here comes from a machine that '
          + 'shares none of this one\'s code.'
      },
      {
        title: 'What forwarding is worth, and the one stall it cannot remove',
        goal: 'Measure the wires, then find the case no wiring fixes.',
        setup: 'The same five fixtures, run with full forwarding and with none. Without '
          + 'forwarding, a consumer waits until its producer has written the register file, '
          + 'which is two cycles for an adjacent producer and one for a producer two ahead.',
        steps: [
          { do: 'Run the dependency chain both ways.',
            why: 'Four instructions, each depending on the last: the worst case for stalling.',
            work: '9 cycles with forwarding, 15 without — 6 stall cycles' },
          { do: 'Run the independent fixture both ways.',
            why: 'The control: nothing depends on anything.',
            work: '9 cycles either way, and no forwards used' },
          { do: 'Run the load-use fixture with full forwarding.',
            why: 'This is the case forwarding is supposed to fix and does not.',
            work: '12 cycles, of which 1 is a stall the wiring cannot remove' },
          { do: 'Move an unrelated instruction into the slot.',
            why: 'What a compiler does about it.',
            work: 'still 12 cycles — but 8 instructions retired instead of 7' },
          { do: 'Count the operands that came from a latch.',
            why: 'Forwarding is invisible unless the provenance is printed.',
            work: '4 of the double-hazard fixture\'s operands are forwarded and 1 read from the '
              + 'register file' }
        ],
        answer: 'Forwarding removes six of the fifteen cycles a four-instruction dependency '
          + 'chain would otherwise take, and it removes none of the load-use stall, because the '
          + 'loaded value does not exist when the consumer needs it. The fourth step is the '
          + 'honest version of what instruction scheduling buys: the stall did not disappear, '
          + 'it got filled with work, and the machine retired eight instructions in the twelve '
          + 'cycles it had been taking to retire seven. That only pays when there is genuinely '
          + 'something else to do, which is why scheduling is hardest in exactly the tight '
          + 'loops where it would help most, and why unrolling — which manufactures independent '
          + 'work — is its usual companion.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
