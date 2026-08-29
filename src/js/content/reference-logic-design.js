/** Reference entries for timing, power and hardware description (M33.9-M33.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'timing-clocking-and-power': {
      summary: 'Static timing analysis over the circuits the earlier sections built: four path '
        + 'classes, the critical path printed gate by gate, slack against a target, a pipeline '
        + 'estimate with its speed-up ceiling, and switching activity measured by simulation '
        + 'with the glitch share reported as wasted energy.',
      intuition: 'The clock period is a budget of clock-to-q plus logic plus setup, and only '
        + 'the middle term is yours to spend.',
      formulation: {
        equations: [
          {
            label: 'The clock period and its overhead',
            expr: 'period = clockToQ + logic + setup',
            readAs: 'the period is the flip-flop output delay plus the logic delay plus the setup time',
            terms: [
              { sym: '8-bit ripple adder', meaning: '2 + 35 + 1 = 38, so overhead is 8% of the period' },
              { sym: 'slack against a target of 30', meaning: '−8: the design does not run that fast' },
              { sym: 'the four path classes', meaning: 'register-to-register sets the period; the rest are interface contracts' }
            ]
          },
          {
            label: 'Pipelining 35 gate delays of logic',
            expr: 'stages · period · speed-up · latency',
            terms: [
              { sym: '1', meaning: '38 · 1.00 · 38' },
              { sym: '2', meaning: '21 · 1.81 · 42' },
              { sym: '4', meaning: '12 · 3.17 · 48' },
              { sym: '6', meaning: '9 · 4.22 · 54' },
              { sym: 'ceiling', meaning: '(35 + 3) / 3 = 12.67, at infinitely many stages' }
            ]
          },
          {
            label: 'Switching that computed nothing, over 32 seeded transitions',
            expr: 'circuit · changes · glitches · wasted share',
            terms: [
              { sym: '8-bit ripple adder', meaning: '887 · 197 · 22.2%' },
              { sym: '8-bit carry-lookahead adder', meaning: '1 938 · 384 · 19.8%' },
              { sym: '8-bit ALU', meaning: '3 157 · 1 296 · 41.1%' },
              { sym: 'the 1101 state machine', meaning: '153 · 0 · 0%' }
            ]
          },
          {
            label: 'Dynamic power, and the multicore argument',
            expr: 'P = activity x voltage^2 x frequency, plus leakage x voltage',
            readAs: 'power is activity times voltage squared times frequency, plus a leakage term',
            terms: [
              { sym: 'one core at full speed', meaning: 'relative power 1.200' },
              { sym: 'two cores at half the frequency and voltage', meaning: '0.350 — about 29%' },
              { sym: 'the square', meaning: 'is why frequency scaling stopped and core counts rose' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Timing is analysed structurally, over every input pattern at once',
          why: 'A passing simulation only covers the vectors you drove.',
          breaks: 'The critical path is a walk of the netlist, not a measurement of one run.'
        },
        {
          name: 'The register-to-register class is the one that sets the period',
          why: 'The other three are contracts with whatever is on the other side of the boundary.',
          breaks: 'A combinational block has no clock of its own; its delay is somebody else\'s budget.'
        },
        {
          name: 'Activity is measured, and the driving vectors are stated',
          why: 'A uniform walk of the low bits measures the sampling method rather than the circuit.',
          breaks: 'Seeded random vectors across all inputs report 22.2% glitching where the walk reported 0%.'
        },
        {
          name: 'Power figures are relative, never absolute',
          why: 'Watts need a process, a capacitance and a voltage this model does not have.',
          breaks: 'Ratios between designs are meaningful; the numbers themselves are not watts.'
        }
      ],
      complexity: [
        { operation: 'path enumeration', average: 'one forward pass per start point', worst: 'start points times nodes, which is why tools are incremental' },
        { operation: 'setup closure', average: 'shorten the worst path, then the next one', worst: 'iterative, and each fix promotes another path' },
        { operation: 'hold closure', average: 'insert buffers on the fastest paths', worst: 'can be thousands of cells, and it is done after placement' },
        { operation: 'pipelining', average: 'period = ceil(logic / k) + overhead', worst: 'speed-up ceiling is (logic + overhead) / overhead — 12.67 here' },
        { operation: 'activity measurement', average: 'one simulated transition per vector pair', worst: 'depends entirely on the vectors, which is the trap' }
      ],
      failureModes: [
        {
          symptom: 'Slack is negative on a path nobody can shorten.',
          cause: 'The logic between two registers is genuinely too deep for the target period.',
          fix: 'Add a pipeline register, restructure the logic, or accept a slower clock — the three real options.'
        },
        {
          symptom: 'A timing failure that gets worse when the clock is slowed.',
          cause: 'It is a hold violation, and both clock edges move together.',
          fix: 'Insert delay on the too-fast path; nothing about the clock helps.'
        },
        {
          symptom: 'Pipelining deeper stops helping and starts hurting.',
          cause: 'The flip-flop overhead is now most of the period, and latency keeps growing.',
          fix: 'Fewer, fatter stages — and in a processor, remember the branch misprediction cost per stage.'
        },
        {
          symptom: 'A design meets timing and burns far more power than expected.',
          cause: 'Unbalanced path delays produce glitches, and every glitch is full-price switching.',
          fix: 'Balance the paths, add hazard-removing terms, and clock-gate what is idle.'
        },
        {
          symptom: 'A power or performance benchmark reports suspiciously clean numbers.',
          cause: 'The stimulus does not exercise the behaviour being measured.',
          fix: 'State how the vectors were generated; the demo shows the same circuit reporting 0% and 22.2%.'
        }
      ],
      inTheWild: [
        'Synopsys PrimeTime and OpenSTA, whose reports have exactly these four path classes.',
        'Dennard scaling and its end, which is the voltage-squared term meeting leakage.',
        'Dynamic voltage and frequency scaling in every phone and laptop.',
        'Clock gating, the largest single dynamic-power lever in a modern design.'
      ],
      sources: [
        { title: 'Bhasker and Chadha — Static Timing Analysis for Nanometer Designs', note: 'the standard treatment of paths, slack and closure' },
        { title: 'Dennard et al. — Design of ion-implanted MOSFETs with very small physical dimensions (1974)', note: 'the scaling rule whose end reshaped computing' },
        { title: 'Horowitz — Computing\'s Energy Problem (ISSCC 2014)', note: 'where the energy actually goes in a modern chip' },
        { title: 'Weste and Harris — CMOS VLSI Design', note: 'switching activity, glitch power and clock distribution' }
      ]
    },
    'hardware-description-and-verification': {
      summary: 'A module hierarchy described as data, elaborated into one flat netlist, driven '
        + 'by a testbench, checked against a behavioural model over its whole input space, and '
        + 'measured for vector and toggle coverage — with an injectable one-gate typo that '
        + 'elaborates cleanly, passes a hand-written corner-case list at 80% toggle coverage, '
        + 'and is caught only by the exhaustive check, which names the failing vector.',
      intuition: 'Only a second, independent statement of what the design should do can say it '
        + 'is right; everything else says what happened.',
      formulation: {
        equations: [
          {
            label: 'The library, elaborated',
            expr: 'module · instances · gates · depth · vectors checked',
            terms: [
              { sym: 'xor2 (four NANDs)', meaning: '0 · 4 · 3 · 4 of 4' },
              { sym: 'halfAdder', meaning: '1 · 5 · 3 · 4 of 4' },
              { sym: 'fullAdder', meaning: '4 · 11 · 7 · 8 of 8' },
              { sym: 'adder4', meaning: '20 · 44 · 19 · 512 of 512' }
            ]
          },
          {
            label: 'The injected typo: sum taken from an OR',
            expr: 'check · verdict',
            terms: [
              { sym: 'elaboration', meaning: 'passes — 12 gates instead of 11, at the same depth' },
              { sym: 'corner-case testbench', meaning: 'passes — 4 vectors, 50.0% of the space, 80% toggle coverage' },
              { sym: 'exhaustive equivalence', meaning: 'fails at a=1 b=0 cin=1, where sum is 1 and should be 0' },
              { sym: 'the 4-bit adder above it', meaning: 'fails too, and names a 9-bit vector' }
            ]
          },
          {
            label: 'Coverage against effort, on the full adder',
            expr: 'test list · vectors · input space · toggle coverage',
            terms: [
              { sym: 'every vector', meaning: '8 · 100.0% · 100%' },
              { sym: 'corner cases by hand', meaning: '4 · 50.0% · 80%' },
              { sym: 'one vector', meaning: '1 · 12.5% · 0%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The model is written from the specification, never derived from the netlist',
          why: 'An oracle that shares the implementation\'s structure agrees with its bugs.',
          breaks: 'The adder model adds two numbers; the netlist ripples carries through gates.'
        },
        {
          name: 'Elaboration refuses an unconnected input port or an undriven output',
          why: 'These are the errors that produce a netlist which simulates and means nothing.',
          breaks: 'Instantiation throws with the module and port named rather than wiring a zero.'
        },
        {
          name: 'A check is exhaustive or it reports what fraction it covered',
          why: '"Verified" without a denominator is a claim nobody can check.',
          breaks: 'Past the input limit the demo declines and states the space size.'
        },
        {
          name: 'Coverage is reported as a property of the tests, not of the design',
          why: 'Toggle coverage never looks at whether an output was right.',
          breaks: 'The demo shows 80% toggle coverage on a test list that passes a broken design.'
        }
      ],
      complexity: [
        { operation: 'elaboration', average: 'linear in the instantiated gate count', worst: 'the same, and it is why hierarchy is free at run time' },
        { operation: 'testbench simulation', average: 'one event-driven run per vector', worst: 'proportional to the vectors you wrote, which is the limitation' },
        { operation: 'exhaustive equivalence', average: '2^n evaluations for n inputs', worst: 'unusable past about twenty inputs — the reason formal methods exist' },
        { operation: 'formal equivalence via SAT', average: 'a miter plus a solver call', worst: 'NP-hard in theory, routine in practice for structurally similar netlists' },
        { operation: 'coverage measurement', average: 'one evaluation per vector, plus bookkeeping per wire', worst: 'cheap, which is part of why it is over-trusted' }
      ],
      failureModes: [
        {
          symptom: 'A design passes every test and is wrong.',
          cause: 'The tests were examples and the oracle was the implementation.',
          fix: 'Write the model separately and check the whole input space, or as much of it as you can afford.'
        },
        {
          symptom: 'High coverage numbers and a buggy design.',
          cause: 'Toggle and line coverage measure activity, not correctness.',
          fix: 'Treat coverage as a floor — the untouched wires are a real finding — and never as a goal.'
        },
        {
          symptom: 'A description that simulates correctly synthesises into a mess of latches.',
          cause: 'It was written as a sequence of statements rather than as structure.',
          fix: 'Drive every output on every path; the language describes hardware that exists continuously.'
        },
        {
          symptom: 'A bug appears only in the flattened netlist, never in module-level tests.',
          cause: 'Elaboration or a port binding was wrong, so the parts were right and the whole was not.',
          fix: 'Verify the elaborated top level, since every downstream tool reads that and not the source.'
        }
      ],
      inTheWild: [
        'Verilog, VHDL and SystemVerilog, and the elaboration step every one of them has.',
        'Chisel, Amaranth, SpinalHDL and other host-language generators, which are exactly "hardware as data".',
        'Formal equivalence checking in every synthesis flow, built on the SAT machinery from the previous milestone.',
        'UVM and constrained-random verification, where coverage closure is a sign-off criterion.'
      ],
      sources: [
        { title: 'IEEE 1364 and 1800 — the Verilog and SystemVerilog standards', note: 'where elaboration is defined normatively' },
        { title: 'Bachrach et al. — Chisel: Constructing Hardware in a Scala Embedded Language (2012)', note: 'the argument for hardware as a value' },
        { title: 'Kuehlmann and Krohm — Equivalence checking using cuts and heaps (1997)', note: 'how industrial equivalence checking actually scales' },
        { title: 'Foster — Trends in Functional Verification', note: 'the industry data on where verification effort goes' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
