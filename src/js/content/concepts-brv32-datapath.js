/** Concepts for the single-cycle datapath and the control unit (M34.4-M34.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'single-cycle-datapath': [
      {
        term: 'A processor is five multiplexers and the things they choose between',
        diagram: {
          definition: [
            'flowchart LR',
            '    PC["program counter"] --> IM["instruction memory"]',
            '    IM --> RF["register file<br/>4 271 gates, depth 16"]',
            '    RF -->|"rs1 or PC"| M1{"mux 1"}',
            '    RF -->|"rs2 or immediate"| M2{"mux 2"}',
            '    M1 --> ALU["ALU<br/>869 gates, depth 148"]',
            '    M2 --> ALU',
            '    ALU --> DM["data memory"]',
            '    ALU --> M3{"mux 3: write back"}',
            '    DM --> M3',
            '    M3 --> RF',
            '    ALU --> M4{"mux 4: next PC"}',
            '    M4 --> PC'
          ].join('\n'),
          caption: 'The control unit\'s entire job is setting those muxes. Everything in the '
            + 'picture is present for every instruction, whether it is needed or not.'
        },
        plain: 'The control unit chooses operands, result source and next address; the rest is fixed.',
        formal: 'five multiplexers: ALU operand A, ALU operand B, write-back source, next PC, ALU function',
        detail: [
          'The first mux decides whether the ALU\'s first operand is a register or the program '
            + 'counter, which is how auipc works. The second decides register or immediate.',
          'The third decides what is written back: the ALU result, a loaded word, the return '
            + 'address or the immediate.',
          'The fourth decides the next program counter, and the fifth, inside the ALU, decides '
            + 'which function to apply.',
          'Once you see the datapath as those five choices, a new instruction stops being '
            + 'mysterious. It is a new row in a table of mux settings.'
        ],
        example: 'For sw, only 2 of the 10 control signals are asserted, and the write-back path '
          + 'is idle for the whole cycle.'
      },
      {
        term: 'Single-cycle means every instruction pays for the slowest one',
        plain: 'One clock period per instruction, sized for the longest path in the machine.',
        formal: 'period = the longest register-to-register path, which is the load instruction',
        detail: [
          'A load needs the register file, then the ALU to compute the address, then the data '
            + 'memory, then the write-back path.',
          'All of that is in series, and all of it is inside one clock period.',
          'Every other instruction finishes earlier and then waits, because the clock is the same '
            + 'for all of them.',
          'That waste is not a defect of this design; it is the design.',
          'It is also exactly what pipelining removes, which is why building this machine first '
            + 'makes M35 a fix for a measured problem rather than a technique to memorise.'
        ],
        example: 'The clock period is 178 gate delays — 175 of logic plus 3 of flip-flop '
          + 'overhead — set by the load path.'
      },
      {
        term: 'The biggest block and the slowest block are not the same block',
        plain: 'Storage dominates area; arithmetic dominates delay.',
        formal: 'register file: 4 271 gates at depth 16. ALU: 869 gates at depth 148',
        detail: [
          'The register file is 72% of the gates and only 16 gate delays deep, because it is '
            + '1 024 flip-flops and two wide multiplexer trees: enormous, and shallow.',
          'The ALU is 15% of the gates and 148 delays, because a 32-bit ripple carry has to '
            + 'propagate end to end.',
          'So "make it smaller" and "make it faster" are different projects that touch different '
            + 'blocks, and a plan that confuses them optimises the wrong thing.',
          'The same split shows up in software constantly. The biggest allocation and the slowest '
            + 'function are rarely the same line.'
        ],
        example: 'The ALU\'s 148 gate delays are 85% of the 175 the clock period charges for; '
          + 'the register file\'s 4 271 gates are 72% of the area and contribute 16 delays.'
      },
      {
        term: 'Every block runs every cycle, and most of them are wasted',
        plain: 'Nothing is switched off, so the idle blocks still cost power and area.',
        formal: 'an instruction class uses a subset of the datapath; the rest is powered and unused',
        detail: [
          'A store reads two registers and writes memory, so the write-back path does nothing.',
          'A branch uses neither the data memory nor the write port, and an arithmetic '
            + 'instruction never touches the data memory.',
          'In this design those blocks are still driven, still switching and still charged for in '
            + 'the clock period.',
          'Naming which ones are idle per instruction class is the clearest way to see where the '
            + 'inefficiency is, and it is the argument for both pipelining and clock gating.'
        ],
        example: 'Only the load class uses the register file, the ALU, the data memory and the '
          + 'write-back path in series — which is why it sets the clock.'
      },
      {
        term: 'A flip-flop captures what is already at its input',
        plain: 'The value must be settled before the clock edge, not after it.',
        formal: 'setup time: the data input must be stable for some interval before the edge',
        detail: [
          'This is the single most common mistake when driving a gate-level machine by hand.',
          'Applying a load\'s result and then clocking captures nothing, because the loaded word '
            + 'has to have propagated all the way onto the write-back path before the edge rises.',
          'It is a perfect miniature of a setup-time violation, and the symptom is the worst '
            + 'kind: every load writes zero, silently, while everything else works.',
          'In the simulator it means settling the combinational phase before advancing the clock, '
            + 'in that order, every time.'
        ],
        example: 'Skipping that settling made every load in the gate machine write zero, with no '
          + 'error and no warning anywhere.'
      },
      {
        term: 'A differential test against an independent implementation is the only real check',
        plain: 'Two machines, one program, the same architectural state after every instruction.',
        formal: 'compare 32 registers and the program counter after each retire',
        detail: [
          'The gate machine propagates values through 5 945 gates; the behavioural machine calls '
            + 'a JavaScript function per instruction.',
          'They share the instruction table and nothing else, so agreement is evidence rather '
            + 'than a tautology.',
          'Comparing after every instruction rather than at the end is what makes a failure '
            + 'diagnosable. The first disagreement names the instruction, so you are looking at '
            + 'one instruction instead of a wrong final answer.',
          'Bisecting a divergence is far more expensive than recording it.'
        ],
        example: 'Over programs covering lui, addi, sw, lw, branches taken and not taken, jal, '
          + 'jalr, auipc, lbu, sh and lh: 16 of 16 and 11 of 11 instructions agree.'
      },
      {
        term: 'A gate-level step is expensive, so anything that walks the machine must be bounded',
        plain: 'Settling 5 945 gates costs real time, and the cost multiplies.',
        formal: 'about 220 ms per instruction, so a differential run is capped and says so',
        detail: [
          'Reading all 32 registers through the read port would mean 32 settlings for one display '
            + 'refresh, so the viewer reads the flip-flops directly instead.',
          'The differential run defaults to 24 instructions rather than to completion.',
          'Both limits are stated rather than hidden, because a silently truncated check looks '
            + 'exactly like a passing one.',
          'That habit of saying what you did not do is what separates a measurement from a '
            + 'reassurance.'
        ],
        example: 'The event-driven simulator\'s default horizon is 5 000 events and this '
          + 'datapath needs 5 277; a run that hits the horizon returns partial results that look '
          + 'like wrong answers.'
      },
      {
        term: 'The instruction memory and the data memory are separate here, and that is a lie',
        plain: 'Two memories means two accesses in one cycle without arbitration.',
        formal: 'a Harvard split at the top of the hierarchy; one memory below it',
        detail: [
          'A single-cycle machine has to fetch an instruction and access data in the same cycle, '
            + 'which a single-ported memory cannot do.',
          'Splitting them makes the design possible and does not match how memory actually works.',
          'Real machines resolve it with split first-level caches over a unified memory: the same '
            + 'trick, one level down, where it is cheap.',
          'The split is a modelling convenience rather than a fact. Knowing that keeps you from '
            + 'being surprised by self-modifying code, instruction cache flushes and the fence '
            + 'instructions that go with them.'
        ],
        example: 'M37 builds the cache that makes this split real, and M30\'s JIT is the case '
          + 'where writing data and then executing it forces the issue.'
      }
    ],

    'the-control-unit': [
      {
        term: 'The control unit is one AND term per opcode and one OR per signal',
        diagram: {
          definition: [
            'flowchart LR',
            '    OP["opcode bits 6:0"] --> D["decoder:<br/>one AND term per opcode"]',
            '    D --> O1["OR: regWrite"]',
            '    D --> O2["OR: aluSrc"]',
            '    D --> O3["OR: memRead"]',
            '    D --> O4["OR: memWrite"]',
            '    D --> O5["OR: branch, jump, jalr"]',
            '    F3["funct3 + one bit of funct7"] --> AD["ALU function decoder<br/>48 gates, depth 13"]',
            '    O1 --> V["the control vector"]',
            '    O2 --> V',
            '    O3 --> V',
            '    O4 --> V',
            '    O5 --> V',
            '    AD --> V'
          ].join('\n'),
          caption: '103 gates, 24 gate delays. Each signal is the OR of the handful of opcodes '
            + 'that need it, which is why the whole thing is smaller than one adder.'
        },
        plain: 'Decode the opcode, then OR together the opcodes that want each signal.',
        formal: 'the gate decoder matches the control table on all 42 instructions',
        detail: [
          'The AND terms are a decoder, the block from M33.3, and each control signal is the OR '
            + 'of the opcodes that assert it.',
          'Because most signals are zero for most instructions, each OR has only two or three '
            + 'inputs.',
          'The whole control unit is 103 gates against the ALU\'s 869.',
          'That sparseness is the reason a wide processor can afford four copies of its decoder, '
            + 'and the reason decode is not on anybody\'s critical path in a RISC design.'
        ],
        example: 'Only jalr asserts as many as four of the seven boolean signals; most opcodes '
          + 'assert two, and op, branch and lui assert one.'
      },
      {
        term: 'Read the control table down the columns, not across the rows',
        plain: 'A column is a gate; a row is just an instruction.',
        formal: 'signal = OR over the opcodes whose row has a 1 in that column',
        detail: [
          'Reading across a row tells you what one instruction does, which you already knew.',
          'Reading down a column tells you what the hardware is.',
          'memWrite is asserted by exactly one opcode, so it is a wire from one AND term. '
            + 'regWrite is asserted by seven, so it is a seven-input OR.',
          'The table is not documentation of the decoder, it is the decoder, and being able to '
            + 'flip between the two readings is the skill the section is for.'
        ],
        example: 'memWrite has a single 1 in the whole column — the store row — so the store '
          + 'signal needs no OR gate at all.'
      },
      {
        term: 'Forcing one signal is the fastest way to learn what it does',
        plain: 'Stick a wire and watch three real programs fail differently.',
        formal: 'regWrite low turns 55 into 0; branch low never terminates; memWrite high faults after 1 instruction',
        detail: [
          'Each forced signal produces a distinct and instructive failure.',
          'With regWrite low, no register is ever written, so every value stays zero and the first '
            + 'branch-if-zero is taken immediately.',
          'With branch low, no conditional branch is ever taken and every loop runs until the '
            + 'budget stops it.',
          'With memWrite high, every instruction stores to whatever the ALU computed, and the '
            + 'first address outside memory faults.',
          'The variety is the lesson. "The control unit is wrong" produces symptoms that look '
            + 'like completely different bugs.'
        ],
        example: 'aluSrc forced high gives 0 on one program, 59 049 235 on another and a '
          + 'non-terminating run on the third — one stuck wire, three unrelated-looking failures.'
      },
      {
        term: 'Hardwired against microcoded is a trade of size against changeability',
        plain: 'Logic is small and permanent; a ROM is large and reloadable.',
        formal: 'hardwired: 103 gates, 24 gate delays. microcoded: a ROM of one vector per opcode per step',
        detail: [
          'A microcoded control unit replaces the OR array with a memory.',
          'The opcode addresses a ROM whose contents are the control vectors, and a counter walks '
            + 'several of them for one instruction.',
          'That is slower and much larger, and it can be changed after the chip is manufactured.',
          'That is why complex instruction sets and microcode grew up together, and why RISC '
            + 'machines hardwire. A small decoder is cheap enough to duplicate four times for a '
            + 'wide machine, and a ROM is not.'
        ],
        example: 'Every microcode update ever shipped — including the Spectre mitigations — is '
          + 'literally rewriting the contents of that ROM on a machine that is otherwise '
          + 'hardwired.'
      },
      {
        term: 'An undefined opcode must produce no writes, and that has to be checked',
        plain: 'The default for every write signal is off.',
        formal: 'every opcode value outside the table leaves regWrite and memWrite low',
        detail: [
          'An instruction the decoder does not recognise has to trap, not corrupt state.',
          'Building the decoder as an OR of the opcodes that want a signal gives that for free: an '
            + 'unmatched opcode matches no AND term, so no OR fires.',
          'But "for free" is a claim, and the section checks it over all 128 opcode values on '
            + 'every render.',
          'A safety property that follows from the structure is still worth testing, because the '
            + 'structure can be changed by somebody who did not know it was load-bearing.'
        ],
        example: 'All 128 opcode values are driven through the decoder; every one outside the '
          + 'table leaves both write signals low.'
      },
      {
        term: 'A don\'t-care is a decision about who gets blamed later',
        plain: 'Leave unused signals at zero rather than minimising them away.',
        formal: 'a signal that does not matter for an instruction is still given a defined value',
        detail: [
          'Minimising with don\'t-cares produces smaller logic, and a decoder whose output for '
            + 'those cases is whatever the minimiser found convenient.',
          'That is fine until somebody reads the signal in a context where it does matter: a new '
            + 'instruction, a debug port, a pipeline stage that forwards it.',
          'Then the bug has no author.',
          'Defining the value costs a few gates and makes the design explainable, which is usually '
            + 'the better trade for anything a person has to reason about later.'
        ],
        example: 'The write-back source for a store is set to the ALU result, which nothing '
          + 'reads, rather than left free for the minimiser.'
      },
      {
        term: 'Two decoders that disagree are how a reserved encoding becomes a security bug',
        plain: 'The instruction decoder and the ALU decoder must agree on what is legal.',
        formal: 'a funct3 with no meaning for its opcode: the ALU decoder still produces a code, the instruction decoder rejects the word',
        detail: [
          'When one part of a machine accepts an encoding that another part rejects, the gap '
            + 'between them is where undefined behaviour lives.',
          'Undefined behaviour in a processor has historically meant an undocumented instruction, '
            + 'a privilege check that was skipped, or a state that no software knows how to save.',
          'The fix is that exactly one component decides legality and the rest follow it.',
          'The same discipline applies to any system with two parsers, which is why HTTP request '
            + 'smuggling exists.'
        ],
        example: 'The instruction decoder is the authority here; the ALU decoder\'s output for a '
          + 'rejected word is never used.'
      },
      {
        term: 'Structural safety beats a check that can be forgotten',
        plain: 'x0 cannot be written because the write enable for row zero does not exist.',
        formal: 'the register file has no write-enable wire for register 0',
        detail: [
          'The alternative is a comparison against zero somewhere in the write-back path.',
          'That works, and it can be removed by a refactor, bypassed by a new write port, or '
            + 'forgotten in the pipelined version.',
          'Making the wire absent means the property holds in every future implementation without '
            + 'anybody having to remember it.',
          'Preferring structure over checks is one of the most transferable ideas in this '
            + 'milestone. The software equivalent is a type that cannot represent the invalid '
            + 'state.'
        ],
        example: 'No instruction, correct or corrupted, can change x0 in this machine — not '
          + 'because it is checked but because there is nothing to change it with.'
      }
    ],

    'multi-cycle-execution': [
      {
        term: 'Time is instructions times CPI times clock period, and every design moves two of them',
        diagram: {
          definition: [
            'flowchart LR',
            'I["instructions<br/>set by the ISA<br/>and the compiler"] --> T["total time"]',
            'C["cycles per instruction<br/>set by the machine<br/>AND the program"] --> T',
            'P["clock period<br/>set by the slowest<br/>path that must fit"] --> T',
            'T --> Q["the only number<br/>worth comparing"]'
          ].join('\n'),
          caption: 'Three factors, and a change to any one of them usually moves another. '
            + 'Quoting one alone is how benchmarks mislead without saying anything false.'
        },
        plain: 'Only the product compares two machines; no single factor does.',
        formal: 'time = instructions x cycles per instruction x clock period',
        detail: 'A machine with a shorter clock and a higher CPI can be slower, and a machine '
          + 'with fewer instructions and a longer clock can be slower too. Every real design '
          + 'change moves at least two of the three, which is why the equation has to be '
          + 'evaluated rather than reasoned around. It is also the most transferable idea in '
          + 'the architecture track, because the same three factors appear whenever work is '
          + 'decomposed into steps: how many units, how many steps each, how long a step.',
        example: 'The multi-cycle machine here has a 15% shorter clock and takes 3.7 times the '
          + 'cycles, which is a 3.1-times loss on the sum program.'
      },
      {
        term: 'A multi-cycle machine cuts the datapath into stages and pays in cycles',
        plain: 'A register between two stages means only one of them has to fit in a cycle.',
        formal: 'the period is the longest stage plus the flip-flop overhead, not the longest path',
        detail: 'Putting a register between two blocks means a signal only crosses one of them '
          + 'per clock, so the period is set by the worst stage rather than by the whole path. '
          + 'The instruction now takes several cycles, and the components can be shared between '
          + 'stages because they are busy at different times — which is the historical reason '
          + 'these machines existed, back when transistors were scarcer than clock cycles.',
        example: 'Three stages measured here: decode at 16 gate delays, execute at 148 and '
          + 'address at 130, so the period is 148 + 3 = 151 against the single-cycle 178.'
      },
      {
        term: 'CPI is a property of the machine and the program together',
        plain: 'Different instruction classes visit different numbers of stages.',
        formal: 'CPI is the class mix, weighted by the cycles each class needs',
        detail: 'A load walks all five stages; a store needs no write-back; a branch is finished '
          + 'once the ALU has compared. So the CPI of a program is decided by what it actually '
          + 'executed, not by the machine alone, and quoting a CPI without naming the workload '
          + 'says nothing. The demo counts the mix by running the program rather than taking it '
          + 'from a table, which is the only way the number means anything.',
        example: 'The sum loop is 50% arithmetic, 25% branches and 23% jumps, giving CPI 3.70; '
          + 'the console program reaches 3.96 on the same machine.'
      },
      {
        term: 'The gain is bounded by the worst stage, and an unbalanced split gains nothing',
        plain: 'Cutting a path helps only in proportion to how evenly it divides.',
        formal: 'a stage holding 148 of 175 gate delays leaves 27 to save',
        detail: 'This datapath has one stage holding almost the whole critical path, so cutting '
          + 'it into stages shortens the clock by 15% and multiplies the cycles by nearly four. '
          + 'That is not a failure of the multi-cycle idea; it is what the idea does when the '
          + 'work does not divide. The same shape appears in every software pipeline: adding '
          + 'stages around a bottleneck adds per-stage overhead to a critical path that did not '
          + 'get shorter.',
        example: 'The measured verdict is single-cycle by 3.1 to 3.4 times on all five sample '
          + 'programs, and the margin barely moves with the instruction mix.'
      },
      {
        term: 'A negative result is worth much more with a break-even number attached',
        plain: 'Say what would have to change, not just that it did not work.',
        formal: 'multi-cycle wins here once the stage period drops below 48 gate delays',
        detail: '"Multi-cycle loses" is an observation that ends a conversation. "Multi-cycle '
          + 'wins once the slowest stage is under 45 gate delays" is a specification somebody '
          + 'can aim at, derived from the same measurements by rearranging the equation. '
          + 'Producing that number costs one division and turns a rejected design into a '
          + 'condition on the adder, which is where the work would actually have to happen.',
        example: 'The execute stage would have to fall from 148 gate delays to 45 — a '
          + 'carry-lookahead adder from M33.6 gets part of the way and not all of it.'
      },
      {
        term: 'The flip-flop overhead is paid per cycle, so more cycles means more overhead',
        plain: 'Every stage boundary costs clock-to-q and setup, whatever it contains.',
        formal: '3 gate delays per cycle, times CPI cycles, rather than once per instruction',
        detail: 'A single-cycle machine pays the overhead once per instruction. A machine with a '
          + 'CPI of 3.7 pays it 3.7 times per instruction, which is a real cost even though the '
          + 'per-cycle figure looks tiny. It is also what puts a floor under pipelining depth: '
          + 'the overhead does not divide, so cutting the logic into more and more stages drives '
          + 'the overhead\'s share of the period towards one.',
        example: 'At 3 delays of overhead and a CPI of 3.70, the multi-cycle machine spends 11 '
          + 'gate delays per instruction on flip-flops against the single-cycle machine\'s 3.'
      },
      {
        term: 'Sharing hardware between stages was the point, and the trade has inverted',
        plain: 'One memory can serve fetch and data access if they happen in different cycles.',
        formal: 'stages that are busy at different times can use the same block',
        detail: 'A single-cycle machine needs separate instruction and data memories because it '
          + 'must access both in one cycle. A multi-cycle machine can use one, because fetch and '
          + 'memory access are different cycles — and the same applies to adders, which can '
          + 'compute the next program counter in one cycle and an address in another. That was '
          + 'a decisive argument when transistors were the scarce resource. It is not one now, '
          + 'which is why the design is taught and not built.',
        example: 'The single-cycle machine here has a Harvard split precisely because it cannot '
          + 'share; M37 makes that split real with separate first-level caches.'
      },
      {
        term: 'Pipelining is the design that takes the short clock without paying the cycles',
        plain: 'Overlap the stages instead of serialising them.',
        formal: 'one instruction finishes per cycle at the stage period, in the ideal case',
        detail: 'Multi-cycle shortens the period and multiplies the cycles; pipelining shortens '
          + 'the period and keeps a throughput of one instruction per cycle by having several '
          + 'instructions in flight at once. That is strictly better on this arithmetic, and it '
          + 'costs the hazards, forwarding and misprediction penalties that M35 spends a '
          + 'milestone on. The measurement here is what makes that cost worth paying rather '
          + 'than a technique to memorise.',
        example: 'At the same 151-delay stage period, an ideal pipeline would run the sum '
          + 'program in about 44 x 151 gate delays rather than 163 x 151.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
