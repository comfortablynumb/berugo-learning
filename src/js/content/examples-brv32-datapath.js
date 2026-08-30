/** Worked examples for the single-cycle datapath and the control unit (M34.4-M34.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'single-cycle-datapath': [
      {
        title: 'Where the gates are and where the time is, and why they are different places',
        goal: 'Take one processor apart by area and by delay, and notice the two answers '
          + 'disagree.',
        setup: 'The single-cycle BRV32 datapath, elaborated from M33 blocks into one flat '
          + 'netlist. Gate counts are counted; the longest path through each block is walked '
          + 'structurally, so it covers every input pattern rather than the ones a simulation '
          + 'happened to drive. The clock model charges 3 gate delays of flip-flop overhead.',
        steps: [
          { do: 'Count the whole machine.',
            why: 'One number to hold the rest against.',
            work: '5 945 gates, 75 698 transistors, clock period 178 gate delays' },
          { do: 'Split the period into logic and overhead.',
            why: 'Only the logic term is anybody\'s to spend.',
            work: '175 of logic plus 3 of flip-flop overhead, so the overhead is 1.7%' },
          { do: 'Rank the blocks by gate count.',
            why: 'This is the area question.',
            work: 'register file 4 271 (72%), ALU 869 (15%), PC adder 160 (3%), control decoder '
              + '103 (2%), ALU function decoder 48 (1%)' },
          { do: 'Rank the same blocks by depth.',
            why: 'This is the timing question, and the order changes.',
            work: 'ALU 148, PC adder 130, control decoder 24, register file 16, function decoder 13' },
          { do: 'Compare the two rankings.',
            why: 'The largest block is the second shallowest.',
            work: 'the register file is 72% of the area and 16 delays; the ALU is 15% of the area '
              + 'and 148 delays — 85% of the 175 the period charges for' }
        ],
        answer: 'The biggest block and the slowest block are different blocks, by a wide margin. '
          + 'The register file is 1 024 flip-flops and two 32-to-1 multiplexer trees per bit: '
          + 'enormous and shallow. The ALU is a 32-bit ripple carry, a barrel shifter and a '
          + 'result multiplexer: small and deep. So a plan to shrink this processor and a plan '
          + 'to speed it up touch different parts of it, and a team that has not separated the '
          + 'two questions will optimise the wrong one. The same confusion is everywhere in '
          + 'software profiling — the function with the most allocations and the function on the '
          + 'critical path are rarely the same function, and a flame graph answers only one of '
          + 'those questions.'
      },
      {
        title: 'Two machines, one program, compared after every instruction',
        goal: 'Establish that the gate-level processor is correct, using something that does not '
          + 'share its assumptions.',
        setup: 'A program is loaded into two machines. One is 5 945 gates settled by an '
          + 'event-driven simulator; the other calls a JavaScript function per instruction from '
          + 'the instruction table. They share the instruction definitions and nothing else — no '
          + 'datapath code, no control logic, no memory model. After each instruction retires, '
          + 'all 32 registers and the program counter are compared.',
        steps: [
          { do: 'Run the first program: lui, addi, sw, lw, branches, jal, jalr, auipc.',
            why: 'One instruction per format, including both branch outcomes.',
            work: '16 of 16 instructions agree on architectural state' },
          { do: 'Run the second: the sub-word accesses, lbu, sh and lh.',
            why: 'Width and sign extension are where a datapath usually diverges.',
            work: '11 of 11 agree' },
          { do: 'Bound the run and say so.',
            why: 'A gate-level step costs about 220 ms, so this cannot run to completion.',
            work: 'the differential defaults to 24 instructions and reports the limit rather than hiding it' },
          { do: 'Raise the simulator\'s event horizon.',
            why: 'The default is 5 000 events and this datapath needs 5 277.',
            work: 'raised to 200 000; a run that hits the horizon returns partial results that look exactly like wrong answers' },
          { do: 'Settle before clocking, not after.',
            why: 'A flip-flop captures what is already at its data input.',
            work: 'skipping that settling made every load write 0, silently, while everything else worked' }
        ],
        answer: 'Every instruction agrees, and the last two steps are worth more than the first '
          + 'two. Both are failures that produce plausible output: a run that quietly hit its '
          + 'event horizon looks like a wrong answer, and a missing settle before the clock edge '
          + 'makes exactly one instruction class — loads — write zero while the rest of the '
          + 'machine works perfectly. Neither raises an error. That is what a differential '
          + 'oracle buys: not a proof, but a second opinion computed a completely different way, '
          + 'checked often enough that the first disagreement names the instruction rather than '
          + 'leaving you to bisect a wrong final answer.'
      }
    ],

    'the-control-unit': [
      {
        title: 'One wire stuck, three programs, three unrelated-looking failures',
        goal: 'Learn what each control signal does by removing it and watching what breaks.',
        setup: 'Three programs with known answers — a counted sum that gives 55, an array '
          + 'maximum that gives 37 and a string length that gives 5 — run on a machine whose '
          + 'control vector can be overridden one signal at a time. Everything else about the '
          + 'processor is unchanged.',
        steps: [
          { do: 'Run all three with nothing forced.',
            why: 'A baseline, or the failures below mean nothing.',
            work: '55, 37 and 5 — every program computes what it should' },
          { do: 'Force regWrite low.',
            why: 'No register is ever written.',
            work: '0, 0 and 0: every value stays zero, so the first branch-if-zero is taken immediately' },
          { do: 'Force branch low.',
            why: 'No conditional branch is ever taken.',
            work: 'all 3 never finish — every loop runs until the 3 000-instruction budget stops it' },
          { do: 'Force memWrite high.',
            why: 'Every instruction now stores to whatever the ALU computed.',
            work: 'all three fault after 1 instruction, on the first address outside memory' },
          { do: 'Force aluSrc high, then writeBack to the memory source.',
            why: 'The two subtlest ones: the machine keeps running and computes rubbish.',
            work: 'aluSrc: 0, 59 049 235, never finishes. writeBack: 0, 1 303, never finishes' }
        ],
        answer: 'Six configurations, six different-looking bugs, one wire each. The last step is '
          + 'the instructive one: forcing regWrite or memWrite produces a machine that obviously '
          + 'does not work, but forcing aluSrc produces a machine that runs happily and returns '
          + '59 049 235 — a plausible-looking number computed with a constant where a register '
          + 'should have been. That is what makes control bugs hard: the symptoms are '
          + 'indistinguishable from algorithm bugs, and they vary by program. It is also the '
          + 'argument for the differential test in the previous section, because a second '
          + 'implementation catches all six on the instruction where they first diverge.'
      },
      {
        title: 'The control table is the decoder, read down its columns',
        goal: 'Turn a nine-row specification into 103 gates, and check them against each other.',
        setup: 'Nine opcodes — op, opImm, load, store, branch, jal, jalr, lui and auipc — each '
          + 'with a row of control-signal values. The gate decoder is built from that table as '
          + 'one AND term per opcode and one OR per signal, then driven with all 42 instructions '
          + 'and all 128 possible opcode values.',
        steps: [
          { do: 'Count the ones in the memWrite column.',
            why: 'A column is an OR gate; its fan-in is the number of ones.',
            work: '1 — only the store row, so memWrite is a wire from a single AND term' },
          { do: 'Count the ones in the regWrite column.',
            why: 'The widest signal in the table.',
            work: '7 of 9 rows: op, opImm, load, jal, jalr, lui and auipc' },
          { do: 'Add up the whole decoder.',
            why: 'Sparse columns make small gates.',
            work: '103 gates at depth 24, against the ALU\'s 869 at depth 148' },
          { do: 'Drive all 42 instructions through both the table and the gates.',
            why: 'The gates are supposed to implement the table, and that is checkable.',
            work: '42 of 42 agree on every signal' },
          { do: 'Drive all 128 opcode values, including the ones with no row.',
            why: 'An unknown instruction must not write anything.',
            work: 'all 118 opcodes with no row leave regWrite and memWrite low' }
        ],
        answer: '103 gates and 24 gate delays, which is 2% of the processor\'s area and well off '
          + 'its critical path — and that is the whole reason RISC decode is cheap enough to '
          + 'duplicate four times in a wide machine. The measurement that produces it is the '
          + 'first step: no control signal is asserted by more than seven of the nine opcodes '
          + 'and four of them by exactly one, so every OR gate is tiny. The last step is the safety '
          + 'property, and it is checked rather than argued: it follows from the structure — an '
          + 'unmatched opcode fires no AND term — but structures get refactored by people who '
          + 'did not know which parts were load-bearing.'
      }
    ],

    'multi-cycle-execution': [
      {
        title: 'The shorter clock loses, and the equation says by how much',
        goal: 'Evaluate the performance equation on two real machines rather than arguing about '
          + 'one factor of it.',
        setup: 'The sum program — 44 instructions, answer 55 — run on the single-cycle datapath '
          + 'of 34.4 and on a multi-cycle machine built from the same blocks. The stage delays '
          + 'come from building each stage as a netlist and walking it; the instruction mix '
          + 'comes from running the program and counting classes. Both machines charge 3 gate '
          + 'delays of flip-flop overhead per cycle.',
        steps: [
          { do: 'Measure the three stages.',
            why: 'The clock period of the multi-cycle machine is the worst of them.',
            work: 'decode 16 gate delays, execute 148, address 130' },
          { do: 'Compute both clock periods.',
            why: 'The whole path against the worst stage, both plus overhead.',
            work: 'single cycle 175 + 3 = 178; multi cycle 148 + 3 = 151, a 15% saving' },
          { do: 'Count the class mix by running the program.',
            why: 'CPI is a property of the machine and the program together.',
            work: '22 arithmetic, 11 branch, 10 jump, 1 system — CPI 3.70' },
          { do: 'Multiply out both machines.',
            why: 'Only the product compares them.',
            work: 'single: 44 x 178 = 7 832. multi: 163 x 151 = 24 613' },
          { do: 'Take the ratio.',
            why: 'This is the answer the design was supposed to improve.',
            work: '24 613 / 7 832 = 3.1 times slower' }
        ],
        answer: 'The machine with the shorter clock is 3.1 times slower, and the reason is '
          + 'visible in the first step: one stage holds 148 of the 175 gate delays, so cutting '
          + 'the datapath into stages saves 15% of the period and costs 3.7 times the cycles. '
          + 'This is the standard textbook progression — single cycle, multi cycle, pipelined — '
          + 'applied to a datapath whose numbers are measured rather than assumed, and the '
          + 'middle step turns out to be a regression. That is worth seeing, because the '
          + 'textbook ordering suggests each design is better than the last, and what actually '
          + 'makes multi-cycle worthwhile historically was sharing hardware, not speed.'
        },
      {
        title: 'What would have to change: the break-even stage period',
        goal: 'Turn a rejected design into a number somebody could aim at.',
        setup: 'The same comparison, rearranged. If the multi-cycle machine takes a fixed number '
          + 'of cycles for this program, there is a stage period at which its total time equals '
          + 'the single-cycle machine\'s, and that period is a specification for the slowest '
          + 'stage.',
        steps: [
          { do: 'Fix the cycle counts.',
            why: 'They depend on the program, not on the clock.',
            work: 'single cycle 44 cycles, multi cycle 163 cycles for the same 44 instructions' },
          { do: 'Divide the single-cycle time by the multi-cycle cycle count.',
            why: 'This is the period at which the two machines tie.',
            work: '7 832 / 163 = 48 gate delays' },
          { do: 'Subtract the flip-flop overhead.',
            why: 'The stage logic gets what is left.',
            work: '48 - 3 = 45 gate delays of logic in the slowest stage' },
          { do: 'Compare with the stage we have.',
            why: 'The gap is the size of the engineering problem.',
            work: 'the execute stage is 148, so it would have to be 3.3 times faster' },
          { do: 'Check the other lever.',
            why: 'CPI is the only other term that could move.',
            work: 'CPI would have to fall below 178 / 151 = 1.18, which no instruction mix reaches' }
        ],
        answer: 'The break-even stage period is 48 gate delays, of which 45 may be logic — '
          + 'against an execute stage that measures 148. That single number is worth more than '
          + 'the rejection it summarises, because it says exactly where the work would have to '
          + 'happen: the 32-bit ripple-carry adder inside the ALU. A carry-lookahead adder from '
          + 'M33.6 cuts that path substantially and not by a factor of three, so the honest '
          + 'conclusion is that this datapath cannot be rescued by staging alone. The second '
          + 'lever is closed too: no realistic instruction mix gets CPI below 1.18. Reporting '
          + 'both bounds is what turns "we tried it and it was slower" into a result somebody '
          + 'can build on.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
