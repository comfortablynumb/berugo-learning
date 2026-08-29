/** Reference entries for latches, state machines and memory (M33.6-M33.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'sequential-logic-and-state': {
      summary: 'SR and D latches and a master-slave flip-flop simulated as real feedback — '
        + 'relaxed to a fixed point rather than evaluated in one pass — driven through '
        + 'sequences that replay from power-up, with transparency measured rather than '
        + 'asserted, and a register clocked against a one-variable reference on both sides of '
        + 'the clock edge.',
      intuition: 'Feedback is memory: the netlist stops being a tree, and the answer starts '
        + 'depending on what happened earlier.',
      formulation: {
        equations: [
          {
            label: 'The three cells, measured',
            expr: 'cell · gates · transistors · transparent when',
            terms: [
              { sym: 'SR latch', meaning: '2 · 8 · always — it has no enable, and set with reset is forbidden' },
              { sym: 'D latch', meaning: '5 · 22 · while the enable is high' },
              { sym: 'master-slave flip-flop', meaning: '11 · 46 · never' }
            ]
          },
          {
            label: 'State, demonstrated: the SR sequence',
            expr: 'step · inputs · q after',
            terms: [
              { sym: '1', meaning: 's=0 r=1 · q = 0' },
              { sym: '2', meaning: 's=0 r=0 · q = 0 — hold' },
              { sym: '3', meaning: 's=1 r=0 · q = 1' },
              { sym: '4', meaning: 's=0 r=0 · q = 1 — the same inputs as step 2, a different answer' }
            ]
          },
          {
            label: 'What must fit around a clock edge',
            expr: 'constraint · what it means · what fixes it',
            terms: [
              { sym: 'setup', meaning: 'data stable before the edge · a slower clock' },
              { sym: 'hold', meaning: 'data stable after the edge · adding delay, and nothing else' },
              { sym: 'clock-to-q', meaning: 'output valid after the edge · a faster cell' },
              { sym: 'metastability', meaning: 'data changed inside the aperture · more time, and a probability' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'q and not-q disagree in every legal state',
          why: 'It is the definition of a stored bit, and the forbidden input violates it.',
          breaks: 'The demo reports the violation rather than hiding it, because that state is not storage.'
        },
        {
          name: 'A reading is a replay from power-up, not a snapshot',
          why: 'A stateful cell has no value independent of its history.',
          breaks: 'Reporting whatever the last control click produced would make the sequence table meaningless.'
        },
        {
          name: 'Transparency is measured by moving the data and watching the output',
          why: 'It is a property of the circuit, and asserting it would beg the question the section asks.',
          breaks: 'The latch reports "q followed d" and the flip-flop reports "q ignored d" under the same test.'
        },
        {
          name: 'A register\'s write enable never gates the clock',
          why: 'A gated clock arrives later, so two registers stop sampling at the same instant.',
          breaks: 'The demo recirculates the old value through a multiplexer instead, at one mux per bit.'
        }
      ],
      complexity: [
        { operation: 'evaluate a netlist with feedback', average: 'bounded relaxation to a fixed point', worst: 'may not converge — a symmetric latch oscillates unless initialised' },
        { operation: 'the SR latch', average: '2 gates, 8 transistors', worst: 'the same; the cost is the forbidden input, not the area' },
        { operation: 'the flip-flop', average: '11 gates, 46 transistors — about twice the latch', worst: 'in a real library about 24 transistors against 12' },
        { operation: 'an n-bit register', average: 'about 13 gates per bit including the enable multiplexer', worst: 'the same; it is entirely per-bit' },
        { operation: 'metastability resolution', average: 'a few gate delays', worst: 'unbounded — the probability decays exponentially, it never reaches zero' }
      ],
      failureModes: [
        {
          symptom: 'A latch-based design passes simulation and fails intermittently in hardware.',
          cause: 'A glitch on the data line during the transparent window was stored.',
          fix: 'Use edge-triggered flip-flops, or prove the data is stable for the whole enable window.'
        },
        {
          symptom: 'A timing failure that a slower clock does not fix.',
          cause: 'It is a hold violation: a path is too fast and overwrites the value being captured.',
          fix: 'Insert delay buffers on the offending path — the one case where making something slower is correct.'
        },
        {
          symptom: 'A signal from another clock domain occasionally produces impossible state.',
          cause: 'Metastability: the flip-flop was still undecided when the next stage sampled it.',
          fix: 'Two flip-flops in series at the crossing, and quote a mean time between failures.'
        },
        {
          symptom: 'A pipeline stage reads a register the previous instruction just wrote and gets the old value.',
          cause: 'Read-during-write returns the value stored before the edge, which is a design choice.',
          fix: 'Add a forwarding path, or specify a write-first register file and pay for it.'
        }
      ],
      inTheWild: [
        'Every synchronous digital design, which is nearly all of them, and the clock trees they need.',
        'Clock-domain crossing synchronisers, the two-flip-flop structure and the MTBF calculations behind it.',
        'Latch-based ASIC design, where transparency is used deliberately to borrow time across stages.',
        'Pipeline forwarding networks, which exist entirely because of the read-during-write answer.'
      ],
      sources: [
        { title: 'Eccles and Jordan — the trigger relay patent (1918)', note: 'the cross-coupled pair, before transistors existed' },
        { title: 'Chaney and Molnar — Anomalous behavior of synchronizer and arbiter circuits (1973)', note: 'metastability, measured' },
        { title: 'Weste and Harris — CMOS VLSI Design', note: 'flip-flop structures, setup and hold, and clock distribution' },
        { title: 'Ginosar — Metastability and Synchronizers: A Tutorial', note: 'why the answer is a probability rather than a fix' }
      ]
    },
    'hardware-state-machines': {
      summary: 'A five-state Moore or Mealy sequence detector synthesised from its transition '
        + 'table into flip-flops and minimised next-state logic under binary, one-hot and Gray '
        + 'encodings, with the register-to-register timing reported per encoding and every '
        + 'netlist checked against the abstract machine on all 256 strings of length eight.',
      intuition: 'A state machine is a register and two blocks of logic; the encoding changes '
        + 'nothing about behaviour and everything about cost.',
      formulation: {
        equations: [
          {
            label: 'One machine, three encodings',
            expr: 'encoding · flip-flops · gates · logic depth · clock period',
            terms: [
              { sym: 'binary', meaning: '3 · 26 · 11 · 14' },
              { sym: 'one-hot', meaning: '5 · 30 · 7 · 10' },
              { sym: 'gray', meaning: '3 · 20 · 7 · 10' },
              { sym: 'mismatches', meaning: '0 for all three, over 256 strings of length 8' }
            ]
          },
          {
            label: 'The clock period, decomposed',
            expr: 'period = clock-to-q + next-state logic + setup',
            readAs: 'the period is the flip-flop output delay plus the logic plus the setup time',
            terms: [
              { sym: 'binary', meaning: '2 + 11 + 1 = 14' },
              { sym: 'one-hot and gray', meaning: '2 + 7 + 1 = 10' },
              { sym: 'the measurement', meaning: 'register-to-register, not input-to-output' }
            ]
          },
          {
            label: 'Moore against Mealy',
            expr: 'property · Moore · Mealy',
            terms: [
              { sym: 'output depends on', meaning: 'the state · the state and the input' },
              { sym: 'when it appears', meaning: 'the cycle after the last symbol · the same cycle' },
              { sym: 'stability', meaning: 'the whole period · follows the input, glitches included' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The netlist is checked against the transition table, not against another netlist',
          why: 'The table is the specification; the gates are the claim.',
          breaks: 'The two share no code, so agreement over 256 strings is evidence.'
        },
        {
          name: 'The gate output is read before the clock edge',
          why: 'That is where a downstream register samples it.',
          breaks: 'Reading after the edge shifts the whole output by a cycle and looks like a broken machine.'
        },
        {
          name: 'The clock period comes from the register-to-register path',
          why: 'A Moore output can be a wire off the register, so the input-to-output path is misleadingly short.',
          breaks: 'Using the combinational critical path reports a period of 1 for a machine that needs 14.'
        }
      ],
      complexity: [
        { operation: 'binary encoding', average: 'ceil(log2 k) flip-flops for k states', worst: 'the decode logic is deeper, and there are unused codes' },
        { operation: 'one-hot encoding', average: 'k flip-flops, decode is one wire', worst: 'k flip-flops is real area past a few dozen states' },
        { operation: 'next-state synthesis', average: 'one minimisation per state bit', worst: 'the covering problem from two sections earlier, per bit' },
        { operation: 'exhaustive checking', average: '2^L strings of length L', worst: 'the same; the demo stops at L = 8, which is 256' }
      ],
      failureModes: [
        {
          symptom: 'A machine wedges after a glitch or a power event and never recovers.',
          cause: 'The state register landed in an unused code with no defined transition out.',
          fix: 'Safe state encoding: every unused code jumps to reset. It costs gates and it is why it is a decision.'
        },
        {
          symptom: 'A state machine will not meet timing however the tool is coaxed.',
          cause: 'One state contains deeply nested conditions, so the next-state logic is deep.',
          fix: 'Split that state in two, which costs a cycle of latency and shortens the period.'
        },
        {
          symptom: 'A Mealy output glitches and something downstream reacts to the glitch.',
          cause: 'The output is a function of the input, so it inherits the input\'s transitions.',
          fix: 'Register the output — which makes it Moore, one cycle later.'
        },
        {
          symptom: 'The synthesised machine produces output one cycle later than the model.',
          cause: 'The comparison read the gate output on the wrong side of the clock edge.',
          fix: 'Sample where a real consumer would, before the edge, and re-check.'
        }
      ],
      inTheWild: [
        'Processor control units, cache controllers and bus protocol engines — all of them this shape.',
        'FPGA synthesis, where one-hot is often the default because flip-flops come with every lookup table.',
        'Safety-critical designs (automotive, aerospace) that mandate safe state encodings.',
        'Gray-coded counters crossing clock domains, where one bit changing at a time is the point.'
      ],
      sources: [
        { title: 'Moore — Gedanken-experiments on sequential machines (1956)', note: 'and Mealy (1955), the two output conventions' },
        { title: 'Harris and Harris — Digital Design and Computer Architecture', note: 'FSM synthesis, encoding and the standard examples' },
        { title: 'Cummings — Synthesis and Scripting Techniques for Designing Multi-Asynchronous Clock Designs', note: 'why Gray coding is a crossing technique' },
        { title: 'De Micheli — Synthesis and Optimization of Digital Circuits', note: 'state assignment as an optimisation problem' }
      ]
    },
    'memory-arrays': {
      summary: 'A register file with one write port and two read ports, built from decoders, '
        + 'flip-flop cells and multiplexer trees, measured at four shapes with storage and '
        + 'access logic separated, and clocked against a behavioural model with every cycle '
        + 'sampled on both sides of the clock edge so the read-during-write answer is visible '
        + 'rather than assumed.',
      intuition: 'A memory is a decoder, some cells and a multiplexer; capacity is the cheap '
        + 'dimension and concurrent access is the expensive one.',
      formulation: {
        equations: [
          {
            label: 'A register file as it grows',
            expr: 'shape · cells · gates · read depth · access share',
            terms: [
              { sym: '2 x 4 bits', meaning: '8 · 115 · 17 · 10%' },
              { sym: '4 x 4 bits', meaning: '16 · 244 · 22 · 15%' },
              { sym: '8 x 4 bits', meaning: '32 · 508 · 27 · 18%' },
              { sym: '8 x 8 bits', meaning: '64 · 980 · 27 · 15%' }
            ]
          },
          {
            label: 'Read during write, six cycles',
            expr: 'measurement · value',
            terms: [
              { sym: 'cycles matching the model before the edge', meaning: '6 of 6' },
              { sym: 'cycles where before and after disagree', meaning: '3 of 6 — exactly the read-during-write ones' },
              { sym: 'what the model returns', meaning: 'the value stored before the edge' }
            ]
          },
          {
            label: 'Storage technologies, per bit',
            expr: 'technology · transistors · why',
            terms: [
              { sym: 'flip-flop', meaning: 'about 20 — made of gates, needs no special process' },
              { sym: 'SRAM cell', meaning: '6 — cross-coupled inverters plus two access transistors' },
              { sym: 'DRAM cell', meaning: '1 plus a capacitor — and the charge leaks' },
              { sym: 'CAM entry', meaning: 'SRAM plus a comparator, which is why associativity is small' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reference writes on the edge and reads the value stored before it',
          why: 'The read-during-write answer must be stated, not left implicit.',
          breaks: 'The before-edge column matches the model on every cycle; the after-edge column does not.'
        },
        {
          name: 'Storage is priced by measuring one register bit, not by assuming one gate',
          why: 'A flip-flop bit here is about 13 gates including its recirculating multiplexer.',
          breaks: 'Assuming a gate per bit would overstate the access overhead by a factor of ten.'
        },
        {
          name: 'Every register file cycle is checked against the model',
          why: 'A memory that is right for five cycles and wrong on the sixth is the normal kind of bug.',
          breaks: 'The demo prints the model\'s value beside both readings, every cycle.'
        }
      ],
      complexity: [
        { operation: 'write port', average: 'a decoder term per register, shared across all bits', worst: 'grows with the number of registers only' },
        { operation: 'read port', average: 'a multiplexer tree per bit, of log-depth in the register count', worst: 'duplicated in full for every additional port' },
        { operation: 'capacity', average: 'cells grow in proportion; access logic grows faster', worst: 'measured here from 10% to 18% of gates across two doublings' },
        { operation: 'multiported arrays', average: 'area and delay grow with ports times capacity', worst: 'quadratic pressure, which is why banking exists' },
        { operation: 'content-addressable lookup', average: 'a comparator per entry, all switching at once', worst: 'the power bill is why fully associative structures stay small' }
      ],
      failureModes: [
        {
          symptom: 'An instruction reads a stale operand written by the instruction before it.',
          cause: 'The register file returns the value stored before the clock edge.',
          fix: 'Forward the result, or build a write-first file and pay for the bypass in the array.'
        },
        {
          symptom: 'Adding a read port makes the whole design miss timing.',
          cause: 'Each port is a complete multiplexer tree per bit, and it is on the critical path.',
          fix: 'Bank the array, or replicate it — two copies with one read port each is often cheaper than one with two.'
        },
        {
          symptom: 'A memory-bound loop is far slower with a random access pattern than a sequential one.',
          cause: 'DRAM is a grid: a row activation is expensive and columns within an open row are not.',
          fix: 'Restructure for locality; it is a row-buffer effect one level below the cache.'
        },
        {
          symptom: 'A large associative structure burns unexpected power.',
          cause: 'A CAM compares every entry on every lookup.',
          fix: 'Use set associativity: a decoder to pick a set, then a handful of comparators.'
        }
      ],
      inTheWild: [
        'Processor register files, and the bypass networks that exist because of read-during-write.',
        'SRAM caches and tag arrays, where the six-transistor cell sets the capacity per square millimetre.',
        'DRAM row buffers, refresh and the timing parameters every memory controller schedules around.',
        'TLBs and fully associative caches, built from content-addressable memory and kept small for that reason.'
      ],
      sources: [
        { title: 'Jacob, Ng and Wang — Memory Systems: Cache, DRAM, Disk', note: 'the definitive treatment of the array below the cache' },
        { title: 'Hennessy and Patterson — Computer Architecture, the memory hierarchy chapters', note: 'why the levels have the sizes they have' },
        { title: 'Weste and Harris — CMOS VLSI Design', note: 'SRAM cell design, sense amplifiers and array organisation' },
        { title: 'Kim et al. — Flipping Bits in Memory Without Accessing Them (Rowhammer, 2014)', note: 'what happens when DRAM density meets physics' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
