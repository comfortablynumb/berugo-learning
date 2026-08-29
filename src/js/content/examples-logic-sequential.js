/** Worked examples for latches, state machines and memory (M33.6-M33.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'sequential-logic-and-state': [
      {
        title: 'The same inputs, twice, with two different answers',
        goal: 'Demonstrate state by applying identical inputs and getting different outputs.',
        setup: 'The SR latch — two cross-coupled NOR gates — driven through a five-step '
          + 'sequence from power-up. Each step is a full simulation carrying the previous '
          + 'step\'s state forward, so what the demo reports is the result of the history '
          + 'rather than of the last click.',
        steps: [
          { do: 'Apply set 0, reset 1.',
            why: 'Force a known starting value rather than trusting power-up.',
            work: 'q = 0, settling time 1 gate delay' },
          { do: 'Apply set 0, reset 0.',
            why: 'The hold condition — the first time inputs alone do not decide the output.',
            work: 'q = 0, unchanged' },
          { do: 'Apply set 1, reset 0.',
            why: 'Drive it the other way.',
            work: 'q = 1, settling time 3 gate delays' },
          { do: 'Apply set 0, reset 0 again — exactly the inputs of step 2.',
            why: 'This is the whole demonstration.',
            work: 'q = 1, where the same inputs gave 0 at step 2' },
          { do: 'Read the gate and transistor cost of the cell.',
            why: 'To see how little memory costs when it is this primitive.',
            work: '2 gates, 8 transistors' }
        ],
        answer: 'Steps 2 and 4 apply identical inputs and leave the output at 0 and then at 1. '
          + 'That is state, and it is the first time on this site that a circuit\'s output has '
          + 'depended on anything but its inputs. Structurally the cause is the cycle: the '
          + 'netlist is no longer a directed acyclic graph, so it cannot be evaluated in one '
          + 'topological pass and the simulator has to relax it to a fixed point — where it '
          + 'lands depends on where it started. Two gates and eight transistors buy that, which '
          + 'is why the SR latch is still used for arbitration and debouncing and why every '
          + 'other storage cell in this milestone is built out of one. The cost is the '
          + 'forbidden input: driving set and reset together makes both outputs agree, which is '
          + 'not a stored bit at all.'
      },
      {
        title: 'Transparent or edge-triggered: the same sequence through two cells',
        goal: 'Show what "never transparent" buys, and what it costs.',
        setup: 'The same five-step sequence applied to a D latch and to a master-slave D '
          + 'flip-flop, plus a 4-bit register clocked through six cycles against a reference '
          + 'that is one JavaScript variable.',
        steps: [
          { do: 'Drive d = 1 with the control low, on both cells.',
            why: 'Nothing should be captured yet.',
            work: 'both hold q = 0' },
          { do: 'Raise the control with d = 1.',
            why: 'The latch opens; the flip-flop sees a rising edge.',
            work: 'both give q = 1' },
          { do: 'Drop d to 0 while the control is still high.',
            why: 'This is where the two cells stop agreeing.',
            work: 'the latch follows to q = 0; the flip-flop holds q = 1' },
          { do: 'Read both cells\' gate and transistor counts.',
            why: 'The price of being edge-triggered.',
            work: 'latch 5 gates and 22 transistors; flip-flop 11 gates and 46' },
          { do: 'Clock a 4-bit register for six cycles against the reference.',
            why: 'A register is these cells plus a write-enable multiplexer.',
            work: '52 gates — 13.0 per bit — matching the reference on 6 of 6 cycles' }
        ],
        answer: 'Step 3 is the entire difference: with the control high, the latch follows the '
          + 'data down and the flip-flop does not, because the flip-flop already captured at '
          + 'the edge and its two internal latches are never open at the same time. That '
          + 'property is what makes synchronous design work — every storage element in the '
          + 'machine samples at one instant, so the logic between them has a whole period to '
          + 'settle and its glitches never reach anything. It costs roughly twice the gates, '
          + '11 against 5, and in a real cell library about 24 transistors against 12. That '
          + 'ratio is why latch-based design survives in places where area matters more than '
          + 'ease of analysis, and why almost everything else is edge-triggered.'
      }
    ],
    'hardware-state-machines': [
      {
        title: 'One machine, three encodings, identical behaviour',
        goal: 'Show that the encoding is free to choose and expensive to choose badly.',
        setup: 'A five-state Moore machine detecting the pattern 1101, synthesised three ways. '
          + 'Each netlist is checked against the transition table on every string of length 8 — '
          + '256 of them — and the timing is measured register to register rather than '
          + 'input to output.',
        steps: [
          { do: 'Synthesise with binary encoding and measure.',
            why: 'The fewest flip-flops: three bits for five states.',
            work: '3 flip-flops, 26 gates, 11 gate delays of logic, clock period 14' },
          { do: 'Synthesise with one-hot encoding.',
            why: 'A flip-flop per state, and a decode that is a single wire.',
            work: '5 flip-flops, 30 gates, 7 gate delays of logic, clock period 10' },
          { do: 'Synthesise with Gray encoding.',
            why: 'One bit changing per step where the state order allows it.',
            work: '3 flip-flops, 20 gates, 7 gate delays of logic, clock period 10' },
          { do: 'Run all three against the transition table on every 8-symbol string.',
            why: 'Different circuits are the same machine only if they always agree.',
            work: '0 mismatches out of 256 strings, for each of the three' }
        ],
        answer: 'Three circuits, one behaviour, and a clock period that differs by 40%. One-hot '
          + 'spends two extra flip-flops to cut the logic depth from 11 to 7, which on an FPGA '
          + '— where flip-flops come free with every lookup table and logic levels are scarce — '
          + 'is a straightforward win, and in an ASIC with a thousand states is not. Gray '
          + 'encoding happens to win on both axes here, with the fewest gates and the shallower '
          + 'logic, which is a reminder that these rules of thumb are shaped by the particular '
          + 'transition table rather than being laws. The right way to use this page is the way '
          + 'a tool does: synthesise all three, measure, and pick.'
      },
      {
        title: 'The table is the judge and the netlist is the claim',
        goal: 'Check a gate-level machine against its abstract definition, symbol by symbol.',
        setup: 'The binary-encoded 1101 detector, fed the string 1101101101. The abstract '
          + 'machine walks its transition table; the netlist clocks flip-flops through '
          + 'LogicSim.cycle. The gate output is read BEFORE each clock edge, which is where a '
          + 'downstream register would sample it.',
        steps: [
          { do: 'Run the abstract machine on the string and record the output.',
            why: 'The specification, executed.',
            work: 'output 0000100100 — the pattern is reported twice in ten symbols' },
          { do: 'Clock the netlist on the same string.',
            why: 'The implementation, executed.',
            work: 'output 0000100100 — identical, symbol for symbol' },
          { do: 'Follow the state at symbol 4 and symbol 5.',
            why: 'The report comes one cycle after the last symbol in a Moore machine.',
            work: 'symbol 4 moves oneOneZero to found; symbol 5 is where the output reads 1' },
          { do: 'Read the output AFTER the edge instead of before it.',
            why: 'To see the off-by-one this choice hides.',
            work: 'the 10 output bits shift by 1 cycle: 0001001000 instead of 0000100100' }
        ],
        answer: 'The two agree on every symbol, and they share no code — one walks a table of '
          + 'transitions, the other propagates values through gates and flip-flops — so the '
          + 'agreement is evidence rather than a tautology. The subtlety worth keeping is '
          + 'which side of the clock edge the output is read on. A Moore output is a function '
          + 'of the state, so it is valid throughout the cycle the machine is in that state; '
          + 'sampling it after the edge reads the NEXT state\'s output and shifts everything by '
          + 'one. That is not a bug in the machine, it is a bug in the measurement, and it is '
          + 'the same class of error as sampling a metric after the operation that changes it.'
      }
    ],
    'memory-arrays': [
      {
        title: 'Where the gates go in a register file, and what growing it costs',
        goal: 'Separate storage from access logic and watch the ratio move.',
        setup: 'A register file with one write port and two read ports, built at four shapes. '
          + 'Storage is priced by measuring a one-bit register — a flip-flop plus the '
          + 'recirculating multiplexer that implements the write enable — and multiplying, so '
          + 'the split is measured rather than estimated.',
        steps: [
          { do: 'Build 2 registers of 4 bits.',
            why: 'The smallest interesting shape.',
            work: '8 cells, 115 gates, read depth 17, access logic 10% of the gates' },
          { do: 'Build 4 registers of 4 bits.',
            why: 'One doubling of capacity.',
            work: '16 cells, 244 gates, read depth 22, access logic 15%' },
          { do: 'Build 8 registers of 4 bits.',
            why: 'Two doublings, so the trend is visible.',
            work: '32 cells, 508 gates, read depth 27, access logic 18%' },
          { do: 'Build 8 registers of 8 bits.',
            why: 'Widening rather than deepening, for contrast.',
            work: '64 cells, 980 gates, read depth 27, access logic 15%' }
        ],
        answer: 'Doubling the number of registers doubles the cells and adds a level to each '
          + 'read tree, so the access logic grows faster than the storage: from 10% of the '
          + 'gates to 18% across two doublings, while widening the registers leaves the read '
          + 'depth unchanged at 27 and the share roughly flat. The absolute split is a property '
          + 'of the cell, not a law: a flip-flop bit here is about 13 gates, so the cells '
          + 'dominate, and an SRAM cell at six transistors against a flip-flop\'s twenty would '
          + 'flip the ratio. The dimension that really hurts is not in this table at all — '
          + 'adding a third read port would duplicate an entire multiplexer tree per bit and '
          + 'leave the storage untouched.'
      },
      {
        title: 'The same cycle, read twice, with two different answers',
        goal: 'Make the read-during-write question concrete, and check both against a model.',
        setup: 'A 4-by-4-bit register file clocked through six cycles. Every cycle is sampled '
          + 'on both sides of the clock edge, and beside it runs a four-line model that writes '
          + 'on the edge and returns the value stored before it.',
        steps: [
          { do: 'Cycle 1: write 5 to r1 while reading r1.',
            why: 'A read of the register being written, on the very first cycle.',
            work: 'before the edge 0, after the edge 5, model 0 — the before column matches' },
          { do: 'Cycle 2: no write, read r1.',
            why: 'A quiet cycle, where both readings must agree.',
            work: 'before 5, after 5, model 5' },
          { do: 'Cycle 4: write 12 to r1 while reading r1.',
            why: 'The same conflict again, with a different stored value.',
            work: 'before 5, after 12, model 5' },
          { do: 'Count the cycles where the two readings differ.',
            why: 'They differ exactly on the read-during-write cycles, and nowhere else.',
            work: '3 of 6 cycles differ; 6 of 6 match the model on the before-edge reading' }
        ],
        answer: 'The same cycle has two defensible answers, and the design has to pick one. '
          + 'This file, sampled before the edge, returns the value stored last cycle — which is '
          + 'what the model says and what most simple register files do — and sampled after the '
          + 'edge it returns the value just written. The two columns differ on exactly the '
          + 'three cycles where a read port addresses the register being written and agree '
          + 'everywhere else, which is the clearest possible statement of what a read-write '
          + 'race is. In a processor this is why a pipeline needs a forwarding path: the '
          + 'instruction reading its operands in the same cycle an earlier instruction writes '
          + 'them gets the old value, and the forwarding network exists entirely to paper over '
          + 'that one fact.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
