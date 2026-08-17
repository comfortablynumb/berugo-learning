# M34 — ISA, assembly, datapath and control

> **Track** Computer architecture · **Depends on** M33 · **Sections** 10 · **Effort** L

**Outcome.** A complete, working CPU: an instruction set designed here, an assembler, a single-cycle
datapath built from M33's gates, a control unit, exceptions and memory-mapped I/O — all executable
and single-steppable in the browser, running real programs including ones compiled from Berugo
by M30.

**The machine.** **BRV32** — a RISC-V RV32I-compatible subset (so real toolchains and documentation
apply) with 32 registers, fixed 32-bit encoding, load/store architecture and the standard
instruction formats. Compatibility is deliberate: the learner can compare the simulator's behaviour
against the published specification and against real assemblers.

**Shared machinery introduced.** `machines/brv32/` — ISA definition as data (encodings, semantics,
formats), assembler, disassembler, reference (behavioural) simulator and the gate-level datapath;
`viz/datapath-view.js` — the datapath schematic with live signal values and per-instruction path
highlighting.

---

## Sections

### 34.1 Instruction set design
- **Covers** — what an ISA is as a contract between hardware and software, RISC versus CISC and the
  actual arguments (decode complexity, code density, µop translation), register machines versus
  stack and accumulator machines, instruction formats and encoding density, addressing modes,
  orthogonality, and the ISA design decisions that constrain the microarchitecture.
- **Demo** — encoding explorer: the same short program encoded for a register machine, a stack
  machine and an accumulator machine, with instruction counts and total bytes compared; a field-
  packing view shows how many bits each design has left for immediates.
- **Diagram** — mermaid diagram of the three machine models executing the same expression.
- **Lab** — design an encoding for a given instruction set within a fixed 16-bit width and maximise
  the immediate range; graded on encodability of the full instruction list and the achieved range.
- **Senior insight** — fixed-width encoding costs code density and buys trivial decode and
  alignment; that single trade explains most of the visible difference between ARM64 and x86-64.

### 34.2 The BRV32 instruction set
- **Covers** — the register file and the zero register, the R/I/S/B/U/J formats and why immediates
  are scrambled the way they are, the base integer instruction list, pseudo-instructions and how the
  assembler expands them, the memory model (alignment, endianness) and the calling convention this
  ISA implies.
- **Demo** — the interactive encoder/decoder: type an instruction and see its bit fields, or edit
  bits and see the instruction change; the immediate-reconstruction logic is shown field by field so
  the scrambling stops looking arbitrary.
- **Diagram** — mermaid diagram of the six instruction formats with field boundaries aligned.
- **Lab** — implement the encoder and decoder for all six formats; tests assert round-trip against
  the full instruction list and byte-exact agreement with reference encodings from the RISC-V
  specification.
- **Senior insight** — the immediate-field scrambling exists so the same wire positions feed the
  sign extender across formats — a decode-hardware optimisation visible in the software encoding
  rules, which is a nice demonstration that ISAs are shaped by gates.

### 34.3 Assembly programming
- **Covers** — writing real programs: arithmetic, control flow, loops, arrays, the stack, function
  calls and the calling convention (argument registers, return address, saved registers), stack
  frames and prologue/epilogue, recursion, and reading compiler-generated assembly.
- **Demo** — the assembly IDE: write assembly, assemble, single-step with registers, memory and the
  stack displayed; a "compile Berugo to assembly" view shows the compiler's output for the same
  algorithm beside the hand-written version.
- **Diagram** — mermaid diagram of a stack frame with saved registers, locals and the return address.
- **Lab** — write a recursive function in assembly following the calling convention exactly; tests
  assert correct results, that callee-saved registers are preserved, and that the stack pointer is
  restored.
- **Senior insight** — being able to read the compiler's assembly output is the most durable skill in
  this whole track: it is how you settle "did the compiler actually optimise that" without guessing.

### 34.4 The single-cycle datapath
- **Covers** — the components (PC, instruction memory, register file, ALU, data memory, sign
  extender, adders, multiplexers) all instantiated from M33's blocks, the datapath for each
  instruction class, the register-read/execute/memory/write-back flow within one clock, and why the
  clock period equals the slowest instruction's path.
- **Demo** — the datapath schematic with live values: step one instruction at a time and watch the
  active path light up, muxes switch and the register file update; a per-instruction-class overlay
  shows which parts of the datapath are idle.
- **Diagram** — mermaid diagram of the single-cycle datapath with the major muxes labelled.
- **Lab** — wire the datapath for the load instruction (address computation, memory read, write
  back); tests assert correct execution of a load-heavy program against the behavioural reference.
- **Senior insight** — in a single-cycle design every instruction pays the cost of the slowest one,
  which is precisely the inefficiency pipelining in M35 removes — and seeing the idle blocks makes
  that obvious rather than abstract.

### 34.5 The control unit
- **Covers** — decoding the opcode into control signals, hardwired control as combinational logic
  versus microcoded control as a ROM-based state machine, the control-signal table, don't-care
  signals, microprogramming and its historical role, and how x86 uses µop translation today.
- **Demo** — control-signal viewer: for each instruction the full signal vector is shown with the
  logic that produced it, and the learner can flip a signal manually and watch the instruction do
  something wrong (a memorable way to learn what each signal does).
- **Diagram** — mermaid diagram of the decoder producing the control-signal vector.
- **Lab** — implement the hardwired control decoder from the signal table; tests assert every
  instruction's signal vector matches the specification and that no undefined opcode produces a
  write.
- **Senior insight** — microcode is why a CISC instruction can be updated after manufacture (the
  microcode updates shipped for Spectre mitigations are literally this), and why RISC decoders are
  small enough to duplicate for wide issue.

### 34.6 Multi-cycle execution
- **Covers** — splitting instructions into multiple cycles to shorten the clock period, the
  multi-cycle datapath with shared components, the control FSM, CPI as a metric, the performance
  equation (time = instructions × CPI × cycle time), and comparing single-cycle, multi-cycle and
  pipelined designs on the same program.
- **Demo** — run the same program on the single-cycle and multi-cycle machines with cycle counts,
  clock periods and total time reported; the control FSM's state is displayed as it advances through
  each instruction.
- **Diagram** — mermaid state diagram of the multi-cycle control FSM.
- **Lab** — extend the control FSM with the states for a new instruction; tests assert correct
  execution and the expected cycle count per instruction class.
- **Senior insight** — the performance equation is the only honest way to compare designs: a lower
  CPI at a lower clock can lose, and marketing numbers routinely quote one factor while the other
  moves.

### 34.7 Memory interface and I/O
- **Covers** — the memory interface signals, alignment requirements and unaligned-access handling,
  endianness in loads and stores of different widths, sign versus zero extension on loads,
  memory-mapped I/O, device registers, polling versus interrupt-driven I/O (previewing M45), and a
  simple memory-mapped console and timer for the simulator.
- **Demo** — memory-mapped I/O in action: a program writes to the console device address and text
  appears; a timer device raises an interrupt and the handler runs, all visible in the datapath.
- **Diagram** — mermaid diagram of the address space with RAM, ROM and device regions.
- **Lab** — implement byte and half-word loads with correct sign extension and alignment checking;
  tests assert results against the reference for every combination of address alignment and width,
  including the fault cases.
- **Senior insight** — "memory-mapped" means the device is just an address, which is why a wild
  pointer write can reboot a machine and why MMIO ordering needs volatile/fence semantics that
  ordinary memory does not.

### 34.8 Exceptions, interrupts and privilege
- **Covers** — synchronous exceptions versus asynchronous interrupts, the trap mechanism, cause and
  EPC registers, vectored versus single-entry handlers, precise exceptions and why they are hard
  (foreshadowing M35 and M36), privilege modes and the machine/supervisor/user split, and how a
  system call is implemented at this level.
- **Demo** — trigger each exception class (illegal instruction, misaligned access, environment call,
  timer interrupt) and watch the trap: state saved, PC redirected, handler runs, `mret` returns —
  with all CSR values visible.
- **Diagram** — mermaid sequence diagram of a trap from user code through the handler and back.
- **Lab** — implement the trap entry/exit logic including CSR updates; tests assert precise state
  save/restore for every exception class and that a nested interrupt during a handler behaves as
  specified.
- **Senior insight** — the whole user/kernel boundary in M41–M46 is this mechanism; a system call is
  a deliberate exception, and privilege is a two-bit register plus the checks the hardware performs
  against it.

### 34.9 Assembler, linker and loading
- **Covers** — two-pass assembly, the symbol table, label resolution, relocations, pseudo-instruction
  expansion, sections, a minimal linker producing a flat image, the loader placing it in the
  simulator's memory, and running compiler-produced code (from M30) on the CPU built here.
- **Demo** — the toolchain pipeline: source → object with relocations → linked image → loaded memory
  → executing CPU, each stage inspectable, with a deliberately unresolved symbol producing a real
  linker error.
- **Diagram** — mermaid flowchart of the assemble-link-load pipeline with the artefacts between
  stages.
- **Lab** — implement relocation application in the linker for branch and load-immediate patterns;
  tests assert the linked image executes correctly and that out-of-range relocations are reported
  rather than truncated.
- **Senior insight** — relocation is where "why does this link and not that" lives; the range limits
  of branch relocations are the reason large binaries need veneers and thunks, which M39 covers in
  full.

### 34.10 Real instruction sets compared
- **Covers** — x86-64, ARM64 and RISC-V compared on encoding, register count, addressing modes,
  condition codes versus compare-and-branch, SIMD extensions, memory-ordering models (previewing
  M38), decode complexity and µop caches, and how each ISA's design shows up in compiler output and
  performance characteristics.
- **Demo** — the same C-like function compiled for three ISAs (using precompiled reference output),
  displayed side by side with instruction counts, code size and a per-instruction explanation of
  what each design chose differently.
- **Diagram** — mermaid diagram comparing the decode paths of a fixed-width and a variable-width
  ISA.
- **Lab** — given three unlabelled assembly listings, identify the ISA from encoding and idiom
  evidence and explain the identification; graded against the ground truth.
- **Senior insight** — condition codes are the hidden dependency: they serialise instructions that
  look independent, which is why RISC-V omitted them and why x86 register renaming has to rename the
  flags register too.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/brv32/isa.js` | Instruction definitions, formats, encodings, semantics as data |
| `src/js/machines/brv32/assembler.js` | Two-pass assembler, pseudo-instructions, relocations |
| `src/js/machines/brv32/disassembler.js` | Bytes to assembly with field breakdown |
| `src/js/machines/brv32/reference-sim.js` | Behavioural simulator (the oracle for the gate-level CPU) |
| `src/js/machines/brv32/datapath.js` | Gate-level single-cycle and multi-cycle datapaths from M33 blocks |
| `src/js/machines/brv32/control.js` | Hardwired decoder and microcoded FSM variants |
| `src/js/machines/brv32/devices.js` | Memory map, console, timer, interrupt controller |
| `src/js/machines/brv32/traps.js` | CSRs, exception entry/exit, privilege modes |
| `src/js/machines/brv32/linker.js` | Sections, symbol resolution, relocation application, image loading |
| `src/js/viz/datapath-view.js` | Datapath schematic with live values and path highlighting |
| `src/js/viz/register-view.js` | Register file, CSRs and memory inspector |

---

## Acceptance criteria

- [ ] The gate-level datapath and the behavioural reference simulator produce identical
      architectural state after every instruction, over the full test-program suite.
- [ ] Encoder/decoder round-trips for every instruction and matches reference encodings from the
      RISC-V specification byte for byte.
- [ ] The assembler's output for the test programs matches a reference assembler's output (checked-in
      fixtures) instruction for instruction.
- [ ] Every exception class is triggered by a test program and produces precise state.
- [ ] Berugo programs compiled by M30's back end run on this CPU and produce the same results as the
      VM and wasm paths.
- [ ] Unaligned and out-of-range cases fault rather than silently truncating, asserted per case.

---

## Sources

- Patterson, Hennessy — *Computer Organization and Design: RISC-V Edition*
- The RISC-V Instruction Set Manual, volumes I and II
- Harris, Harris — *Digital Design and Computer Architecture: RISC-V Edition*
- Nisan, Schocken — *The Elements of Computing Systems*
- Intel and ARM architecture reference manuals (for the comparison section)
