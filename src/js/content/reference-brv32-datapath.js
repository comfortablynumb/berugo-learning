/** Reference entries for the single-cycle datapath and the control unit (M34.4-M34.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'single-cycle-datapath': {
      summary: 'A working processor of 5 945 gates, elaborated from M33 blocks into one netlist, '
        + 'stepped instruction by instruction with the active path highlighted, costed by area '
        + 'and by delay separately, and checked after every instruction against a behavioural '
        + 'simulator that shares none of its code.',
      intuition: 'Five multiplexers decide what the machine does; everything else runs every '
        + 'cycle whether it is needed or not.',
      formulation: {
        equations: [
          {
            label: 'The whole machine',
            expr: 'gates . transistors . clock period',
            terms: [
              { sym: 'total', meaning: '5 945 . 75 698 . 178 gate delays' },
              { sym: 'the period', meaning: '175 of logic plus 3 of flip-flop overhead' },
              { sym: 'what sets it', meaning: 'the load path: register file, ALU, data memory, write back, in series' }
            ]
          },
          {
            label: 'Per block: area and delay disagree',
            expr: 'block . gates . share . depth',
            terms: [
              { sym: 'register file', meaning: '4 271 . 72% . 16' },
              { sym: 'ALU', meaning: '869 . 15% . 148' },
              { sym: 'PC adder', meaning: '160 . 3% . 130' },
              { sym: 'control decoder', meaning: '103 . 2% . 24' },
              { sym: 'ALU function decoder', meaning: '48 . 1% . 13' }
            ]
          },
          {
            label: 'What each instruction class leaves idle',
            expr: 'class . idle blocks',
            terms: [
              { sym: 'arithmetic', meaning: 'the data memory' },
              { sym: 'load', meaning: 'nothing — this is the longest path' },
              { sym: 'store', meaning: 'the register write port' },
              { sym: 'branch', meaning: 'the data memory and the write port' },
              { sym: 'jump and link', meaning: 'the data memory' }
            ]
          },
          {
            label: 'The differential against the behavioural machine',
            expr: 'programs . instructions compared . agreements',
            terms: [
              { sym: 'formats and branches', meaning: '16 of 16' },
              { sym: 'sub-word loads and stores', meaning: '11 of 11' },
              { sym: 'the bound', meaning: '24 instructions by default, at about 220 ms per gate-level step' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The two machines share the instruction table and nothing else',
          why: 'Agreement between two implementations of the same code proves nothing.',
          breaks: 'One settles 5 945 gates; the other calls a function per instruction.'
        },
        {
          name: 'State is compared after every instruction, not at the end',
          why: 'The first disagreement names the instruction, instead of leaving a bisection.',
          breaks: 'All 32 registers and the program counter, per retire.'
        },
        {
          name: 'The combinational phase settles before the clock edge',
          why: 'A flip-flop captures what is already at its data input.',
          breaks: 'Without it every load writes zero, silently, and nothing else misbehaves.'
        },
        {
          name: 'A run that hits the event horizon is reported, not returned as an answer',
          why: 'A truncated settle looks exactly like a wrong result.',
          breaks: 'The default horizon is 5 000 events; this datapath needs 5 277.'
        }
      ],
      complexity: [
        { operation: 'one instruction', average: 'one clock period of 178 gate delays', worst: 'the same — every instruction pays for the load' },
        { operation: 'gate-level step, in the browser', average: 'about 220 ms', worst: 'why every walk of the machine is bounded and says so' },
        { operation: 'register read', average: '16 gate delays through the multiplexer trees', worst: 'unchanged; it is a tree, not a search' },
        { operation: 'ALU operation', average: '148 gate delays, ripple carry dominated', worst: 'a carry propagating the full 32 bits' },
        { operation: 'reading all 32 registers for display', average: 'read the flip-flops directly', worst: '32 settlings, if done through the read port' }
      ],
      failureModes: [
        {
          symptom: 'Every load writes zero; everything else works perfectly.',
          cause: 'The clock edge arrived before the loaded word reached the write-back path.',
          fix: 'Settle the combinational phase, then advance the clock. It is a setup-time violation.'
        },
        {
          symptom: 'A gate-level run produces plausible but wrong results with no error.',
          cause: 'The event-driven simulation hit its horizon and returned what it had reached.',
          fix: 'Raise the horizon and count unsettled runs; this datapath needs 5 277 events.'
        },
        {
          symptom: 'The gate machine and the reference diverge somewhere in a long program.',
          cause: 'Comparing only the final state, so the divergence has to be bisected.',
          fix: 'Compare after every instruction; the first mismatch names the instruction.'
        },
        {
          symptom: 'An optimisation makes the processor smaller and no faster.',
          cause: 'It shrank the register file, which is 72% of the area and 16 of 175 delays.',
          fix: 'Separate the area question from the timing question before choosing a target.'
        },
        {
          symptom: 'A new instruction works in the simulator and not in the gates.',
          cause: 'The control table gained a row that the gate decoder was not rebuilt from.',
          fix: 'Drive both from the same table and check all 42 instructions, as the next section does.'
        }
      ],
      inTheWild: [
        'Every processor design course\'s single-cycle machine, of which this is a runnable one.',
        'Verilator and similar cycle-accurate models, which are the same differential idea at scale.',
        'Chipyard and the RISC-V cores that ship a behavioural model alongside the RTL.',
        'The Harvard split at the top of every real memory hierarchy: separate L1 caches, one memory.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'chapter 4 builds this exact datapath, on paper' },
        { title: 'Harris and Harris — Digital Design and Computer Architecture, RISC-V Edition', note: 'the same machine with the gate-level detail' },
        { title: 'Nisan and Schocken — The Elements of Computing Systems', note: 'the build-it-yourself argument this milestone follows' },
        { title: 'Yuan et al. — Simulation and Modelling of RISC-V cores', note: 'differential testing against a golden model, in practice' }
      ]
    },

    'the-control-unit': {
      summary: 'The opcode-to-control-vector mapping as a nine-row table and as 103 gates, '
        + 'checked against each other on all 42 instructions and against undefined opcodes on '
        + 'all 128 values, with every signal forceable so that three real programs can be broken '
        + 'one wire at a time.',
      intuition: 'Each control signal is an OR over the handful of opcodes that need it, which '
        + 'is why the whole decoder is smaller than one adder.',
      formulation: {
        equations: [
          {
            label: 'The control table, read down its columns',
            expr: 'signal . opcodes that assert it . fan-in',
            terms: [
              { sym: 'memWrite', meaning: 'store . 1 — a wire, not a gate' },
              { sym: 'memRead', meaning: 'load . 1' },
              { sym: 'branch', meaning: 'branch . 1' },
              { sym: 'jump', meaning: 'jal, jalr . 2' },
              { sym: 'aluSrc', meaning: 'opImm, load, store, jalr, auipc . 5' },
              { sym: 'regWrite', meaning: 'op, opImm, load, jal, jalr, lui, auipc . 7' }
            ]
          },
          {
            label: 'The decoder, built and measured',
            expr: 'gates . depth . checked',
            terms: [
              { sym: 'instruction decoder', meaning: '103 . 24 . 42 of 42 instructions match the table' },
              { sym: 'ALU function decoder', meaning: '48 . 13 . funct3 plus one bit of funct7' },
              { sym: 'against the ALU', meaning: '103 gates against 869 — 2% of the processor' },
              { sym: 'undefined opcodes', meaning: 'all 128 values driven; every write signal stays low' }
            ]
          },
          {
            label: 'One signal forced, three programs (correct answers 55, 37, 5)',
            expr: 'forced signal . sum . array max . strlen',
            terms: [
              { sym: 'regWrite = 0', meaning: '0 . 0 . 0 — nothing is ever written, so every value stays zero' },
              { sym: 'aluSrc = 1', meaning: '0 . 59 049 235 . never finishes' },
              { sym: 'branch = 0', meaning: 'never finishes . never finishes . never finishes' },
              { sym: 'memWrite = 1', meaning: 'faults after 1 . faults after 1 . faults after 1' },
              { sym: 'writeBack = memory', meaning: '0 . 1 303 . never finishes' }
            ]
          },
          {
            label: 'Hardwired against microcoded',
            expr: 'property . hardwired . microcoded',
            terms: [
              { sym: 'size', meaning: '103 gates . a ROM of one vector per opcode per step' },
              { sym: 'latency', meaning: '24 gate delays . a memory access plus a sequencer' },
              { sym: 'changeable after manufacture', meaning: 'no . yes — this is what a microcode update is' },
              { sym: 'duplication for wide issue', meaning: 'copy 103 gates . copy the ROM, or arbitrate for it' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The gate decoder and the table agree on every instruction',
          why: 'The table is the specification and the gates are the implementation.',
          breaks: 'Checked on all 42 instructions, on every render.'
        },
        {
          name: 'An opcode with no row writes nothing',
          why: 'An undefined instruction must trap, not corrupt architectural state.',
          breaks: 'All 128 opcode values are driven; regWrite and memWrite stay low outside the table.'
        },
        {
          name: 'Don\'t-cares are given a defined value rather than minimised away',
          why: 'A signal nobody reads today is read by the next pipeline stage somebody adds.',
          breaks: 'The write-back source for a store is set to the ALU result, which nothing uses.'
        },
        {
          name: 'x0 cannot be written, structurally',
          why: 'A check can be refactored away; an absent wire cannot.',
          breaks: 'The register file has no write enable for row zero.'
        }
      ],
      complexity: [
        { operation: 'decode one instruction', average: '24 gate delays', worst: 'the same; it is combinational logic over 7 bits' },
        { operation: 'add a control signal', average: 'one OR gate, fan-in equal to the opcodes that want it', worst: 'grows with the instruction set, not with the pipeline' },
        { operation: 'add an instruction', average: 'one AND term plus edits to the OR fan-ins', worst: 'a microcoded design pays in ROM entries instead' },
        { operation: 'widen to N-issue', average: 'N copies of 103 gates', worst: 'a ROM must be duplicated or arbitrated for' },
        { operation: 'change behaviour after manufacture', average: 'impossible when hardwired', worst: 'a microcode load — which is what shipped for Spectre' }
      ],
      failureModes: [
        {
          symptom: 'A program returns a plausible but wrong number.',
          cause: 'A control signal is stuck in a way that keeps the machine running — aluSrc, say.',
          fix: 'Differential-test against a behavioural model; the forcing demo shows why symptoms mislead.'
        },
        {
          symptom: 'Every loop in every program runs forever.',
          cause: 'branch is never asserted, so no conditional branch is ever taken.',
          fix: 'One wire. The variety of symptoms across programs is the point of the demo.'
        },
        {
          symptom: 'The machine faults on the first instruction, whatever the program.',
          cause: 'memWrite is stuck high, so every instruction stores to the ALU result.',
          fix: 'The address goes out of range immediately, which is the least confusing failure of the six.'
        },
        {
          symptom: 'A reserved encoding does something on one implementation and traps on another.',
          cause: 'Two decoders disagree about what is legal, and neither is the authority.',
          fix: 'Name one component as the authority on legality; the instruction decoder here.'
        },
        {
          symptom: 'A signal that was a don\'t-care now matters, and its value is arbitrary.',
          cause: 'The minimiser chose it, and nobody recorded that the choice was free.',
          fix: 'Define don\'t-cares. A few gates, and the design stays explainable.'
        }
      ],
      inTheWild: [
        'Microcode updates, including the Spectre and Meltdown mitigations, which are ROM reloads.',
        'x86 micro-operation translation: a CISC contract over a hardwired RISC-like core.',
        'Wide RISC front ends with four or more identical decoders, affordable because each is tiny.',
        'Undocumented x86 instructions found by fuzzing the decoder — the two-decoders-disagree failure.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'chapter 4: the control table this section builds' },
        { title: 'Wilkes — The Best Way to Design an Automatic Calculating Machine (1951)', note: 'the paper that introduced microprogramming' },
        { title: 'Domas — Breaking the x86 ISA (Black Hat 2017)', note: 'what happens when decoders disagree about what is legal' },
        { title: 'Intel Software Developer\'s Manual, volume 3, microcode update facilities', note: 'the mechanism, documented' }
      ]
    },

    'multi-cycle-execution': {
      summary: 'The performance equation evaluated on two machines built from the same blocks: '
        + 'stage delays walked from netlists, an instruction mix counted by running the '
        + 'program, a CPI derived from that mix, and a total in gate delays — with the '
        + 'multi-cycle machine losing on every sample program and the break-even stage period '
        + 'named.',
      intuition: 'A shorter clock and more cycles is not an improvement until somebody '
        + 'multiplies.',
      formulation: {
        equations: [
          {
            label: 'The performance equation',
            expr: 'time = instructions x CPI x clock period',
            readAs: 'total time is the instruction count, times the cycles each takes, times '
              + 'the length of a cycle',
            terms: [
              { sym: 'single cycle, sum program', meaning: '44 x 1.00 x 178 = 7 832 gate delays' },
              { sym: 'multi cycle, sum program', meaning: '44 x 3.70 x 151 = 24 613 gate delays' },
              { sym: 'the verdict', meaning: '3.1x slower, with the shorter clock' }
            ]
          },
          {
            label: 'The stages, each built and walked',
            expr: 'stage . gates . longest path',
            terms: [
              { sym: 'decode', meaning: '4 271 . 16 — the register file' },
              { sym: 'execute', meaning: '869 . 148 — the ALU, and the whole problem' },
              { sym: 'address', meaning: '160 . 130 — a 32-bit ripple adder' },
              { sym: 'the period', meaning: '148 + 3 = 151, against 175 + 3 = 178' }
            ]
          },
          {
            label: 'Cycles per instruction class',
            expr: 'class . stages . cycles',
            terms: [
              { sym: 'load', meaning: 'fetch, decode, execute, memory, writeback . 5' },
              { sym: 'arithmetic and jump', meaning: 'fetch, decode, execute, writeback . 4' },
              { sym: 'store', meaning: 'fetch, decode, execute, memory . 4' },
              { sym: 'branch', meaning: 'fetch, decode, execute . 3' },
              { sym: 'system', meaning: 'fetch, decode . 2' }
            ]
          },
          {
            label: 'All five programs, both machines, in gate delays',
            expr: 'program . instructions . CPI . single . multi . ratio',
            terms: [
              { sym: 'sum', meaning: '44 . 3.70 . 7 832 . 24 613 . 3.1x' },
              { sym: 'factorial', meaning: '125 . 3.87 . 22 250 . 73 084 . 3.3x' },
              { sym: 'arrayMax', meaning: '43 . 3.84 . 7 654 . 24 915 . 3.3x' },
              { sym: 'strlen', meaning: '32 . 3.94 . 5 696 . 19 026 . 3.3x' },
              { sym: 'console', meaning: '47 . 3.96 . 8 366 . 28 086 . 3.4x' }
            ]
          },
          {
            label: 'Break-even, from the same measurements',
            expr: 'stage period below which multi-cycle wins',
            terms: [
              { sym: 'the number', meaning: '48 gate delays, of which 45 may be logic' },
              { sym: 'what we have', meaning: '148 — so 3.3x faster would be needed' },
              { sym: 'the other lever', meaning: 'CPI below 1.18, which no instruction mix reaches' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The stage delays are walked from netlists, not estimated',
          why: '"The ALU is probably the slow one" is not a measurement.',
          breaks: 'Each stage is built alone and its longest path is walked structurally.'
        },
        {
          name: 'The instruction mix is counted by running the program',
          why: 'CPI is a property of the machine and the workload together.',
          breaks: 'Five programs give five CPIs on the same machine, from 3.70 to 3.96.'
        },
        {
          name: 'Both machines are compared in gate delays, the only unit they share',
          why: 'Cycles are not comparable when the cycle lengths differ.',
          breaks: 'The multi-cycle machine takes fewer gate delays per cycle and far more cycles.'
        },
        {
          name: 'The negative result carries a break-even number',
          why: 'A rejection without a threshold cannot be acted on.',
          breaks: '48 gate delays, derived by dividing the single-cycle time by the cycle count.'
        }
      ],
      complexity: [
        { operation: 'single-cycle instruction', average: '1 cycle of 178 gate delays', worst: 'the same for every instruction, including the trivial ones' },
        { operation: 'multi-cycle instruction', average: '3.7 cycles of 151', worst: '5 cycles, for a load' },
        { operation: 'flip-flop overhead', average: '3 gate delays per cycle', worst: '11 per instruction at CPI 3.7, against 3 single-cycle' },
        { operation: 'measuring CPI', average: 'one run of the program, classes counted', worst: 'it changes with the program, which is the point' },
        { operation: 'break-even', average: 'one division', worst: 'unchanged — and it is the most useful line in the table' }
      ],
      failureModes: [
        {
          symptom: 'A design with a much better clock speed is slower in practice.',
          cause: 'The cycle count rose more than the period fell.',
          fix: 'Evaluate the product. The demo shows a 15% clock gain losing to a 3.7x cycle cost.'
        },
        {
          symptom: 'Splitting a slow operation into stages does not speed it up.',
          cause: 'One stage holds most of the work, so the period barely moves.',
          fix: 'Balance the stages first; the break-even number says how balanced they must be.'
        },
        {
          symptom: 'A CPI figure that cannot be reproduced.',
          cause: 'It was measured on a different workload, and nobody said which.',
          fix: 'Quote the workload with the CPI. Five programs here span 3.70 to 3.96.'
        },
        {
          symptom: 'A deeply staged design that gets slower as stages are added.',
          cause: 'The per-stage overhead is now most of the period.',
          fix: 'Fewer, fatter stages — the overhead does not divide, so it bounds the gain.'
        },
        {
          symptom: 'Two machines compared in cycles.',
          cause: 'Cycles mean different amounts of time on each of them.',
          fix: 'Compare in a shared unit; this section uses gate delays for exactly that reason.'
        }
      ],
      inTheWild: [
        'The classic MIPS multi-cycle datapath, which is this design in every textbook.',
        'SPEC results, which quote instructions, CPI and frequency separately for this reason.',
        'Frequency-first marketing, and the Pentium 4 pipeline that took it furthest.',
        'Any proposal to split a slow service into stages, which is the same arithmetic.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'chapter 4 and the performance equation in chapter 1' },
        { title: 'Hennessy and Patterson — Computer Architecture: A Quantitative Approach', note: 'the quantitative method, of which this equation is the core' },
        { title: 'Amdahl — Validity of the single processor approach (1967)', note: 'the same reasoning about which term you are actually improving' },
        { title: 'Hrishikesh et al. — The optimal logic depth per pipeline stage (ISCA 2002)', note: 'where the overhead per stage stops paying' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
