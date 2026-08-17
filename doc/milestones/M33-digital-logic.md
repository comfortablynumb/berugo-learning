# M33 — Digital logic and sequential circuits

> **Track** Computer architecture · **Depends on** M24 · **Sections** 10 · **Effort** L

**Outcome.** From a transistor-level abstraction up to a working ALU, register file and control
unit, all simulated gate by gate in the browser. This is the foundation the CPU in M34 is literally
built from: the same gate netlists, wired together.

**Shared machinery introduced.** `machines/logic-sim.js` — an event-driven gate-level simulator with
propagation delays, glitch detection, clock generation and waveform recording;
`machines/hdl.js` — a small hardware-description DSL in JavaScript (modules, ports, wires,
instantiation) so circuits are written as data and can be tested, composed and rendered;
`viz/circuit-view.js` and `viz/waveform-view.js`.

---

## Sections

### 33.1 Boolean algebra and gates
- **Covers** — Boolean functions and truth tables, AND/OR/NOT/XOR/NAND/NOR, functional completeness
  and universal gates, De Morgan's laws, canonical forms (sum of products, product of sums),
  the physical reality behind a gate (transistors as switches, CMOS pull-up/pull-down, fan-in and
  fan-out, propagation delay) at the level needed to reason about cost.
- **Demo** — gate playground: wire gates together, toggle inputs, watch values propagate with real
  delays; a truth-table panel derives the circuit's function automatically and the canonical forms
  are generated from it.
- **Diagram** — mermaid diagram of a CMOS inverter's pull-up/pull-down structure.
- **Lab** — build XOR from NAND gates only; tests assert the truth table matches for all inputs and
  count the gates used against the known minimum.
- **Senior insight** — everything above this is an abstraction over "a gate takes time and area".
  Depth becomes latency and width becomes area, which is the same trade the circuit-complexity
  section in M26 stated formally.

### 33.2 Combinational logic design and minimisation
- **Covers** — the design flow from specification to truth table to minimised expression to gates,
  Karnaugh maps up to five variables, don't-care conditions, the Quine–McCluskey algorithm and prime
  implicants, multi-level logic and factoring, and static hazards/glitches with the redundant-term
  fix.
- **Demo** — enter a truth table (with don't-cares) and watch the K-map fill, groups form, and the
  minimised expression and gate netlist generate; a glitch view runs the circuit with delays and
  highlights the transient wrong output.
- **Diagram** — mermaid diagram of a K-map grouping with the resulting product terms.
- **Lab** — implement Quine–McCluskey prime-implicant generation and the covering step; tests assert
  the result is minimal against exhaustive search for functions up to five variables.
- **Senior insight** — glitches do not matter in synchronous logic (the clock samples after
  settling) and matter enormously in asynchronous logic. Knowing which regime you are in is the
  whole question.

### 33.3 Standard combinational blocks
- **Covers** — multiplexers and demultiplexers, encoders, priority encoders and decoders,
  comparators, parity generators, barrel shifters, and building larger blocks from smaller ones —
  plus the mux-as-universal-element observation that makes lookup tables (and FPGAs) work.
- **Demo** — block builder: assemble an n-bit mux, a decoder and a barrel shifter from gates, then
  measure the gate count and critical-path delay of each construction against the alternatives.
- **Diagram** — mermaid diagram of a 4:1 mux built from 2:1 muxes with the select bits routed.
- **Lab** — build an 8-bit barrel shifter as a log-depth mux network; tests assert correct shifts and
  rotates for all inputs and a critical path of log₂(8) mux delays.
- **Senior insight** — a barrel shifter costs a mux network, which is why variable shifts are one
  cycle on modern CPUs and were multi-cycle on early ones; instruction costs are gate counts.

### 33.4 Arithmetic circuits
- **Covers** — half and full adders, ripple-carry and its linear delay, carry-lookahead with
  generate/propagate, carry-select and carry-save, subtraction via two's complement (linking to
  M17), overflow detection, array and Wallace-tree multipliers, and restoring division.
- **Demo** — adder comparison: ripple-carry, carry-lookahead and carry-select for the same width,
  with gate count, critical path and simulated settling waveform side by side; the delay-versus-area
  trade is plotted as width increases.
- **Diagram** — mermaid diagram of the generate/propagate lookahead tree.
- **Lab** — build a 16-bit carry-lookahead adder from 4-bit blocks; tests assert correct sums and
  flags for randomised inputs and a critical path shorter than the ripple-carry version by the
  predicted factor.
- **Senior insight** — the reason integer add is one cycle and integer divide is twenty is visible
  right here in gate depth; instruction latency tables are a readout of these circuits.

### 33.5 The arithmetic logic unit
- **Covers** — combining the arithmetic and logic units under an operation selector, flag generation
  (zero, negative, carry, overflow) and their exact definitions, shift integration, the ALU's
  critical path as a frequency limit, and the interface the datapath in M34 will use.
- **Demo** — the ALU built from the previous sections' blocks: select an operation, feed operands,
  watch the internal signals and flags settle, with the critical path highlighted for the selected
  operation.
- **Diagram** — mermaid diagram of the ALU's internal structure with the operation mux.
- **Lab** — implement flag computation for add, subtract and compare including the signed-overflow
  rule; tests assert flags against an exhaustive 8-bit reference, including the INT_MIN edge cases.
- **Senior insight** — carry and overflow are different flags for different signedness, and every
  "why does my comparison behave oddly at the boundary" question resolves to which flag the branch
  instruction read.

### 33.6 Sequential logic and state
- **Covers** — feedback and bistability, SR latches, D latches and the transparency problem,
  edge-triggered D flip-flops, setup and hold times, clock-to-Q delay, metastability and MTBF,
  synchronisers for crossing clock domains, and registers built from flip-flops.
- **Demo** — waveform laboratory: drive a flip-flop with data changing near the clock edge and watch
  setup/hold violations produce metastable output; a synchroniser chain is added and the failure
  probability falls.
- **Diagram** — mermaid diagram of a two-flop synchroniser across a clock-domain boundary.
- **Lab** — build a D flip-flop from gates and verify edge-triggered behaviour; tests assert it
  samples only at the clock edge and hold the value across the cycle, checked over randomised input
  waveforms.
- **Senior insight** — metastability is a probability, not a possibility, and every asynchronous
  input into a synchronous system needs a synchroniser. Software people meet the same problem as
  torn reads across threads.

### 33.7 Finite state machines in hardware
- **Covers** — Moore and Mealy machines in silicon (connecting to M24), state registers plus
  next-state logic, state encoding (binary, one-hot, Gray) with their area/speed trade-offs,
  unreachable and illegal states, reset strategy, and control units as FSMs.
- **Demo** — draw a state machine, choose an encoding, and the tool synthesises the next-state logic
  and output logic as gates, reporting flip-flop count and critical path per encoding; the machine
  runs against an input sequence with the waveform recorded.
- **Diagram** — mermaid state diagram of a traffic-light controller with outputs annotated.
- **Lab** — synthesise a sequence detector as both Moore and Mealy machines; tests assert identical
  accepted sequences and the expected one-cycle output-timing difference between them.
- **Senior insight** — one-hot encoding costs flip-flops and buys a shorter critical path, which is
  why FPGA designs use it freely and ASIC designs do not; the same trade appears in software as
  bitsets versus enums.

### 33.8 Memory arrays
- **Covers** — the SRAM cell (six transistors, why it is fast and large), the DRAM cell (one
  transistor and a capacitor, why it needs refresh), address decoders, word and bit lines, sense
  amplifiers, register files with multiple read ports and one write port, ROM and PLA structures,
  and the area/speed/density comparison that produces the memory hierarchy.
- **Demo** — build a small register file with two read ports and one write port from decoders and
  muxes, then read/write it live; an array-size slider shows decoder depth and access delay growing.
- **Diagram** — mermaid diagram of a memory array with row decoder, columns and sense amplifiers.
- **Lab** — build a 4×8-bit register file with two read ports; tests assert simultaneous
  reads, correct write timing (write on the edge, read the old value in the same cycle) and correct
  behaviour when reading the register being written.
- **Senior insight** — the read-during-write behaviour of a register file is exactly the forwarding
  question in M35; the pipeline's bypass network exists because this array cannot answer it in time.

### 33.9 Timing, clocking and power
- **Covers** — the critical path and maximum clock frequency, slack, clock skew and jitter, clock
  distribution, pipelining as the way to shorten the critical path (previewing M35), dynamic power
  (CV²f) and static leakage, clock gating and power gating, the power wall and why frequency
  stopped scaling, and Dennard scaling's end.
- **Demo** — timing analyser: for a built circuit, report the critical path with the gate-by-gate
  delay contribution, the maximum frequency, and the effect of inserting a pipeline register (higher
  frequency, higher latency) with the numbers for both.
- **Diagram** — mermaid diagram of a combinational path between registers with delays annotated.
- **Lab** — pipeline a provided combinational block to double its throughput; tests assert identical
  results with the expected added latency and a maximum frequency at least 1.8× the original.
- **Senior insight** — the reason CPUs went multicore rather than faster is entirely in this
  section's power equation; understanding it is what makes the parallelism work in M47 feel
  necessary rather than fashionable.

### 33.10 Hardware description and verification
- **Covers** — describing hardware as data rather than drawings, the structural/behavioural
  distinction, simulation strategies (event-driven versus cycle-accurate), testbenches and stimulus
  generation, self-checking tests, assertion-based verification, coverage in hardware terms, and
  formal equivalence checking against a reference implementation.
- **Demo** — the HDL workbench: write a module in the DSL, elaborate it into a netlist, simulate
  with a generated testbench, view waveforms, and run an equivalence check against a behavioural
  model.
- **Diagram** — mermaid flowchart from HDL source through elaboration and simulation to the
  waveform and equivalence result.
- **Lab** — write a testbench that exhaustively verifies the ALU from 33.5 against a behavioural
  reference; tests assert full input coverage for 8-bit operands and report any mismatch with the
  exact input vector.
- **Senior insight** — hardware verification is exhaustive where software testing is sampled,
  because the input space is finite and the cost of a bug is a respin. The discipline transfers:
  exhaustive testing is available more often in software than people assume.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/logic-sim.js` | Event-driven gate simulation, delays, glitch detection, clocking |
| `src/js/machines/hdl.js` | Module/port/wire DSL, elaboration to netlists, hierarchy |
| `src/js/algorithms/boolean-min.js` | K-map grouping, Quine–McCluskey, hazard detection |
| `src/js/machines/blocks/` | Mux, decoder, comparator, shifter, adders, multiplier, ALU, register file |
| `src/js/machines/fsm-synth.js` | State machine to next-state logic with encoding options |
| `src/js/machines/timing.js` | Critical-path analysis, slack, frequency, power estimation |
| `src/js/viz/circuit-view.js` | Schematic rendering with live signal values |
| `src/js/viz/waveform-view.js` | Multi-signal waveform with cursors and timing markers |

---

## Acceptance criteria

- [ ] Every built block is verified exhaustively against a behavioural reference for its full input
      space where feasible (8-bit operands), randomly beyond that.
- [ ] Quine–McCluskey output is asserted minimal against exhaustive search up to five variables.
- [ ] The simulator's propagation delays produce the predicted critical paths, and the timing
      analyser's frequency matches the simulated settling time.
- [ ] The glitch demo reproduces a real static hazard and the redundant-term fix removes it,
      asserted from the recorded waveform.
- [ ] The register file's read-during-write behaviour is specified and tested explicitly.
- [ ] The ALU built here is the same module instantiated by M34's datapath — no separate
      reimplementation, enforced by an import check in the tests.

---

## Sources

- Harris, Harris — *Digital Design and Computer Architecture*
- Nisan, Schocken — *The Elements of Computing Systems* (the Nand2Tetris approach)
- Weste, Harris — *CMOS VLSI Design*
- Katz, Borriello — *Contemporary Logic Design*
- Hennessy, Patterson — *Computer Architecture: A Quantitative Approach*, appendix on arithmetic
