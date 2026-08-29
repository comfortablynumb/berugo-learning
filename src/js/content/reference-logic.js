/** Reference entries for gates, minimisation and the blocks (M33.1-M33.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'boolean-algebra-and-gates': {
      summary: 'Gate-level simulation with per-gate delays, truth tables derived by running '
        + 'the netlist, canonical and minimised forms generated from those tables, and the '
        + 'NAND-only constructions of NOT, AND, OR and XOR priced in gates, transistors and '
        + 'gate delays — with a zero-delay reference and an event-driven simulation checked '
        + 'against each other on every row.',
      intuition: 'A Boolean function is a table and a circuit is one implementation of it; the '
        + 'table says what, the transistor count says how much, and the gate delays say when.',
      formulation: {
        equations: [
          {
            label: 'What a gate costs in static CMOS',
            expr: 'gate · transistors · gate delays',
            terms: [
              { sym: 'inverter', meaning: '2 transistors, 1 delay' },
              { sym: 'NAND, NOR', meaning: '4 transistors, 1 delay — one pull-up and one pull-down network' },
              { sym: 'AND, OR', meaning: '6 transistors, 2 delays — an inverting gate plus an inverter' },
              { sym: 'XOR, XNOR', meaning: '12 transistors, 3 delays' }
            ]
          },
          {
            label: 'The NAND-only constructions, measured',
            expr: 'function · NANDs · transistors · delay',
            terms: [
              { sym: 'not', meaning: '1 · 4 · 1' },
              { sym: 'and', meaning: '2 · 8 · 2' },
              { sym: 'or', meaning: '3 · 12 · 2' },
              { sym: 'xor', meaning: '4 · 16 · 3, against 12 transistors for the library cell' }
            ]
          },
          {
            label: 'Three-input circuits from the demo',
            expr: 'circuit · gates · depth · minterms',
            terms: [
              { sym: 'majority of three', meaning: '5 gates, depth 6, ones on rows 3, 5, 6, 7' },
              { sym: '2:1 multiplexer cell', meaning: '1 gate, depth 3, ones on rows 1, 3, 6, 7' },
              { sym: 'a·b + b\'·c', meaning: '4 gates, depth 5, ones on rows 3, 4, 5, 7 — and it glitches' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The truth table is derived from the netlist, never asserted alongside it',
          why: 'A table written by hand beside a circuit is a second claim that can drift from the first.',
          breaks: 'The demo evaluates every input combination through the same netlist the simulator runs.'
        },
        {
          name: 'The zero-delay reference and the event-driven run agree on every row',
          why: 'Two evaluators sharing no code is the only cheap check on either.',
          breaks: 'They agree on values and differ on timing, which is exactly the intended split.'
        },
        {
          name: 'Every cost is counted in transistors as well as gates',
          why: 'Gate counts are not comparable across gate types; an XOR is six inverters.',
          breaks: 'A design that looks cheaper in gates can be more expensive in area.'
        }
      ],
      complexity: [
        { operation: 'evaluate a netlist, zero delay', average: 'one pass in topological order', worst: 'the same; a DAG has no cycles to relax' },
        { operation: 'event-driven simulation', average: 'proportional to the wires that actually change', worst: 'every gate re-evaluated once per input change' },
        { operation: 'derive a truth table', average: '2^n evaluations', worst: 'the same, which is why it stops at a handful of inputs' },
        { operation: 'canonical sum of products', average: 'one term per 1-row', worst: '2^(n-1) terms, and always more than needed' }
      ],
      failureModes: [
        {
          symptom: 'A circuit is correct on every row of its truth table and misbehaves in the machine.',
          cause: 'It glitches during a transition, and something downstream is level-sensitive.',
          fix: 'Simulate the transitions, not just the rows; add the redundant terms, or sample only at a clock edge.'
        },
        {
          symptom: 'A netlist built from wide AND and OR gates is far slower than the diagram suggested.',
          cause: 'Fan-in limits: an eight-input gate is a tree of two-input gates in a real library.',
          fix: 'Count depth with the library you actually have, which is what the demo does.'
        },
        {
          symptom: 'Two designs with the same gate count differ by a factor of two in area.',
          cause: 'Gate counts hide gate types; an XOR is 12 transistors and a NAND is 4.',
          fix: 'Compare transistors, or compare cell areas from the library.'
        },
        {
          symptom: 'A "simplified" expression produces a larger circuit.',
          cause: 'Algebraic simplicity is not circuit cost — inverting gates are cheaper than non-inverting ones.',
          fix: 'Let De Morgan rewrite into NANDs and NORs, and measure the result.'
        }
      ],
      inTheWild: [
        'Standard cell libraries, whose datasheets are exactly this table: area, delay and power per cell.',
        'FPGA lookup tables, which are multiplexers with their data inputs held in configuration memory.',
        'The instruction latency tables in processor manuals, which are gate depths in disguise.',
        'Logic synthesis tools, which spend their lives rewriting AND-OR structures into inverting gates.'
      ],
      sources: [
        { title: 'Shannon — A Symbolic Analysis of Relay and Switching Circuits (1937)', note: 'the master\'s thesis that made switching circuits Boolean algebra' },
        { title: 'Weste and Harris — CMOS VLSI Design', note: 'where the transistor counts and delay models come from' },
        { title: 'Harris and Harris — Digital Design and Computer Architecture', note: 'the gates-to-processor path this milestone follows' },
        { title: 'Sheffer — A set of five independent postulates for Boolean algebras (1913)', note: 'the NAND stroke, and functional completeness' }
      ]
    },
    'logic-minimisation': {
      summary: 'Quine–McCluskey prime implicant generation, the prime implicant chart with '
        + 'essentials marked, greedy covering against an exhaustive search over every subset of '
        + 'the primes, a Karnaugh map printed in Gray-code order, and static hazards found from '
        + 'the cover and then confirmed by simulating both directions of every adjacent pair.',
      intuition: 'Merging minterms is exact and cheap; choosing which of the resulting terms to '
        + 'keep is set cover, and the term the minimiser removes is sometimes the one holding '
        + 'the output up during a transition.',
      formulation: {
        equations: [
          {
            label: 'The four-variable classic, cover by cover',
            expr: 'cover · terms · literals · gates · depth',
            terms: [
              { sym: 'canonical sum of products', meaning: '10 · 40 · 43 · 25' },
              { sym: 'essentials then greedy', meaning: '3 · 7 · 10 · 7' },
              { sym: 'exhaustive minimum', meaning: '3 · 7 · 10 · 7 — greedy is optimal here' },
              { sym: 'with hazard-removing terms', meaning: '7 · 19 · 22 · 15' }
            ]
          },
          {
            label: 'Where greedy loses: minterms 0,1,2,5,6,7',
            expr: 'method · terms · literals · what it searched',
            terms: [
              { sym: 'greedy', meaning: '4 terms, 8 literals — no essential primes to anchor it' },
              { sym: 'exhaustive', meaning: '3 terms, 6 literals, after 64 subsets of 6 primes' }
            ]
          },
          {
            label: 'Hazards on the minimised classic function',
            expr: 'measurement · value',
            terms: [
              { sym: 'adjacent pairs of ones', meaning: '13' },
              { sym: 'pairs that glitch, simulated both ways', meaning: '4, all on the falling edge' },
              { sym: 'after adding the redundant terms', meaning: '0 of 13, for 12 extra gates' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every cover is evaluated back against the original minterms',
          why: 'A minimiser that drops a row produces a smaller circuit for a different function.',
          breaks: 'The demo builds each cover as gates and re-checks it on every row of the table.'
        },
        {
          name: 'An essential prime implicant appears in every cover',
          why: 'Some minterm is covered by it and by nothing else, so no search can avoid it.',
          breaks: 'Taking essentials first is free; it is the rest that is NP-hard.'
        },
        {
          name: 'A hazard is confirmed by simulation, never inferred from the cover alone',
          why: 'Whether a gap appears depends on the delays, and the two directions are not symmetric.',
          breaks: 'The demo drives each adjacent pair in both directions and reports which edge dips.'
        },
        {
          name: 'The exhaustive search reports how many subsets it walked',
          why: '"Minimal" without a search space is an opinion.',
          breaks: 'Past the prime limit the demo refuses and says why rather than quietly going greedy.'
        }
      ],
      complexity: [
        { operation: 'prime implicant generation', average: 'repeated merging to a fixed point', worst: 'exponential in the variables; the prime count can be 3^n/n' },
        { operation: 'greedy covering', average: 'primes times minterms per round', worst: 'the same, and it can exceed the minimum' },
        { operation: 'exhaustive covering', average: '2^p subsets of p primes', worst: 'the same — this is set cover, which is NP-hard' },
        { operation: 'hazard detection', average: 'one check per adjacent pair of ones', worst: 'n times the minterm count' },
        { operation: 'espresso in production', average: 'polynomial heuristics: expand, irredundant, reduce', worst: 'no minimality guarantee, and it finishes' }
      ],
      failureModes: [
        {
          symptom: 'The minimised circuit is correct on every row and glitches in the machine.',
          cause: 'Two adjacent 1-rows are covered by different terms and by no common one.',
          fix: 'Add the redundant prime implicant that covers the pair — the demo shows it costing 12 gates.'
        },
        {
          symptom: 'A minimiser produces a larger cover than a hand-drawn Karnaugh map.',
          cause: 'The function has no essential primes, so greedy is doing all the work and can overshoot.',
          fix: 'Run an exact cover for small functions; accept the heuristic for large ones and say so.'
        },
        {
          symptom: 'Minimisation does nothing at all for a parity or checksum function.',
          cause: 'No two minterms are adjacent, so nothing merges — two-level logic is the wrong shape.',
          fix: 'Use multi-level logic: a tree of exclusive-ors, which two-level minimisation cannot find.'
        },
        {
          symptom: 'The synthesised circuit differs from the specification on rows nobody tested.',
          cause: 'Don\'t-cares were treated as zeros in the spec and as free by the tool, or vice versa.',
          fix: 'Say explicitly which rows are unconstrained; they are worth real gates when declared.'
        }
      ],
      inTheWild: [
        'Espresso, the Berkeley minimiser whose heuristics every synthesis tool still descends from.',
        'PLA and PAL devices, whose structure is literally a sum-of-products cover.',
        'FPGA technology mapping, where the covering problem reappears as packing logic into lookup tables.',
        'Asynchronous and clock-gating logic, where hazard-free covers are a hard requirement rather than a nicety.'
      ],
      sources: [
        { title: 'Quine — The problem of simplifying truth functions (1952)', note: 'and McCluskey (1956), who made it an algorithm' },
        { title: 'Karnaugh — The map method for synthesis of combinational logic circuits (1953)', note: 'the human interface to the same merging' },
        { title: 'Brayton et al. — Logic Minimization Algorithms for VLSI Synthesis', note: 'espresso, and why exact minimisation is not what ships' },
        { title: 'Unger — Hazards, critical races, and metastability', note: 'the hazard theory the demo measures' }
      ]
    },
    'combinational-blocks': {
      summary: 'Multiplexers built as trees and as decoded arrays, decoders, priority encoders, '
        + 'comparators and barrel shifters, each elaborated into gates, measured in gates, '
        + 'transistors and depth, and checked against a behavioural model over the whole input '
        + 'space where the input count allows it — with the refusal stated where it does not.',
      intuition: 'Six blocks, six cost shapes; every architectural limit in a datapath is one '
        + 'of these curves seen from above.',
      formulation: {
        equations: [
          {
            label: 'Multiplexer: tree against flat, from two-input gates',
            expr: 'width · tree gates/depth · flat gates/depth',
            terms: [
              { sym: '2:1', meaning: '1 / 3 against 4 / 5' },
              { sym: '4:1', meaning: '3 / 6 against 13 / 9' },
              { sym: '8:1', meaning: '7 / 9 against 34 / 13' },
              { sym: '16:1', meaning: '15 / 12 against 83 / 17 — the flat form loses on both axes' }
            ]
          },
          {
            label: 'The other blocks, measured and checked',
            expr: 'block · gates · depth · vectors checked',
            terms: [
              { sym: '2-bit decoder', meaning: '6 · 3 · 4 of 4' },
              { sym: '3-bit decoder', meaning: '19 · 5' },
              { sym: '4-input priority encoder', meaning: '9 · 7 · 16 of 16' },
              { sym: '4-bit comparator', meaning: '24 gates, 152 transistors · 13 · 256 of 256' },
              { sym: '8-bit barrel shifter', meaning: '24 gates, 288 transistors · 9 · 2 048 of 2 048' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every block is checked against a model written from its specification',
          why: 'A model derived from the circuit agrees by construction and proves nothing.',
          breaks: 'The models here are arithmetic — shift, compare, index — and share no structure with the gates.'
        },
        {
          name: 'A check is exhaustive or it says how much it covered',
          why: '"Verified" with no denominator is not a result.',
          breaks: 'Past the input limit the demo reports the space size and declines rather than sampling silently.'
        },
        {
          name: 'Depth is measured with two-input gates throughout',
          why: 'Constant-depth claims assume unbounded fan-in, which no cell library provides.',
          breaks: 'It is why the flat multiplexer measures deeper than the tree rather than shallower.'
        }
      ],
      complexity: [
        { operation: 'multiplexer, tree', average: 'gates proportional to the width, depth to its logarithm', worst: 'the same; the structure is data-independent' },
        { operation: 'multiplexer, flat', average: 'gates proportional to the width, plus a decoder', worst: 'depth is two logarithms with two-input gates, not constant' },
        { operation: 'decoder', average: 'one term per output, each of log-width depth', worst: 'outputs grow exponentially with address bits' },
        { operation: 'priority encoder', average: 'a chain: depth grows with the width', worst: 'the same, and it cannot be made a tree' },
        { operation: 'comparator', average: 'equality in log depth, magnitude in a chain', worst: 'magnitude costs about what a subtraction costs' },
        { operation: 'barrel shifter', average: 'log-width stages, whatever the distance', worst: 'the same — which is what makes it constant time' }
      ],
      failureModes: [
        {
          symptom: 'A "constant depth" flat multiplexer is slower than the tree it replaced.',
          cause: 'The wide AND and OR became trees in the cell library.',
          fix: 'Only use the flat form where a wide term really is one gate: a PLA row, a word line, domino logic.'
        },
        {
          symptom: 'Interrupt latency grows as sources are added, while address decoding does not.',
          cause: 'Priority is a chain because the answer depends on order; decoding is not.',
          fix: 'Tree-structured arbiters trade fairness or strict priority for depth; pick deliberately.'
        },
        {
          symptom: 'A shift instruction\'s timing depends on the shift amount.',
          cause: 'The shifter is a sequence of single-place shifts rather than a barrel shifter.',
          fix: 'Use log-depth stages; it is also the fix for the timing side channel.'
        },
        {
          symptom: 'A block passes every test and fails in the machine on one input.',
          cause: 'The test list was a sample and the model was derived from the design.',
          fix: 'Write the model from the specification and drive the whole input space while you still can.'
        }
      ],
      inTheWild: [
        'Register file read ports, forwarding networks and next-PC selection, all multiplexer trees.',
        'Interrupt controllers and cache victim selection, both priority encoders.',
        'Cache tag comparison, a comparator array whose depth is part of the hit latency.',
        'Constant-time cryptographic code, which relies on the shifter and the multiplexer being data-independent.'
      ],
      sources: [
        { title: 'Harris and Harris — Digital Design and Computer Architecture', note: 'the standard treatment of these blocks' },
        { title: 'Hennessy and Patterson — Computer Architecture, appendix on arithmetic and datapaths', note: 'where the blocks meet a pipeline' },
        { title: 'Weste and Harris — CMOS VLSI Design', note: 'why fan-in limits turn wide gates into trees' },
        { title: 'Xilinx and Intel FPGA architecture documentation', note: 'lookup tables as multiplexers, and why one-hot is cheap there' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
