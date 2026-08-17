# M30 — Code generation, bytecode VMs and JIT

> **Track** Automata, languages and compilers · **Depends on** M29, M34 · **Sections** 10 · **Effort** L

**Outcome.** The back end: Berugo IR becomes bytecode, the bytecode runs on a VM you build, then a
JIT observes the running program and compiles hot code with inline caches and deoptimisation. The
same programs also compile to WebAssembly and run natively in the browser, so the two execution
paths can be compared on the same benchmarks.

**Shared machinery introduced.** `machines/berugo/vm.js` — the bytecode VM with a step-debugger
interface; `machines/berugo/jit.js` — tiering, profiling, inline caches, on-stack replacement and
deoptimisation; `machines/exec-lab.js` — one harness that runs a program under the AST interpreter,
the VM, the JIT and the wasm build and compares results and timings.

---

## Sections

### 30.1 Bytecode design
- **Covers** — stack machines versus register machines with the instruction-count/dispatch-count
  trade-off, instruction encoding (fixed versus variable width, operand packing), the constant pool,
  jump encoding and patching, superinstructions, the effect of instruction-set design on dispatch
  overhead, and comparing the JVM, CPython, Lua and V8 bytecode philosophies.
- **Demo** — dual compiler: compile the same Berugo function to a stack bytecode and a register
  bytecode, showing instruction counts, encoded size and executed dispatches side by side.
- **Diagram** — mermaid diagram of one expression as stack instructions and as register
  instructions.
- **Lab** — implement the register-machine code generator for expressions with a simple virtual
  register allocator; tests assert identical results to the stack version on the conformance suite
  and a lower dispatch count.
- **Senior insight** — register bytecode executes fewer, larger instructions; Lua's switch to it
  bought a substantial speed-up in the interpreter loop, and it is the same argument as CISC versus
  RISC in M34, one level up.

### 30.2 Building the interpreter
- **Covers** — the dispatch loop, switch dispatch versus computed goto versus direct/indirect
  threading (and what JavaScript can express), call frames and the frame stack, calling convention
  inside the VM, closures and upvalues, tail calls, exceptions and unwinding, and the debugger hooks
  (breakpoints, step, inspect).
- **Demo** — the VM debugger: run a program with the stack, frames, locals and upvalues displayed;
  step, set breakpoints, and watch a closure capture and an exception unwind frame by frame.
- **Diagram** — mermaid diagram of a frame's layout and the upvalue chain of a closure.
- **Lab** — implement closure creation and upvalue capture (open upvalues closed on scope exit);
  tests assert correct behaviour on the counter-factory and loop-capture fixtures that catch the
  classic aliasing bug.
- **Senior insight** — the loop-variable capture question that every language answers differently is
  decided right here, in whether the upvalue points at the slot or at a copy.

### 30.3 Instruction selection
- **Covers** — mapping IR to target instructions, macro expansion versus tree tiling, BURS/dynamic-
  programming instruction selection with costs, addressing modes and complex instructions, selection
  as a covering problem, and how selection interacts with register allocation and scheduling.
- **Demo** — tiling viewer: an IR expression tree with candidate tiles overlaid, the DP cost table
  filled, and the selected cover highlighted; changing an instruction's cost changes the selection
  live.
- **Diagram** — mermaid diagram of an expression tree covered by instruction tiles.
- **Lab** — implement dynamic-programming tile selection for a small target instruction set; tests
  assert the selected cover is minimum cost against exhaustive search on fixture trees.
- **Senior insight** — instruction selection is the point where the compiler stops being
  target-independent; keeping the cost model as data rather than as code is what makes a second
  target tractable.

### 30.4 Register allocation
- **Covers** — live ranges and interference graphs, graph colouring with Chaitin–Briggs
  simplification and coalescing, spilling and rematerialisation, linear-scan allocation for JIT
  compilers, live-range splitting, precoloured registers for calling conventions, and the
  callee/caller-saved decision.
- **Demo** — allocator comparison: the same function allocated by graph colouring and by linear
  scan, with the interference graph drawn, the spill decisions marked, and the resulting spill
  counts and code size compared.
- **Diagram** — mermaid graph of an interference graph with a spilled node highlighted.
- **Lab** — implement linear-scan allocation with interval splitting; tests assert no two
  simultaneously live values share a register, that the allocated code produces identical results,
  and that spills stay below a bound on the fixture set.
- **Senior insight** — JIT compilers use linear scan because compile time is on the critical path;
  ahead-of-time compilers use colouring because it produces better code. The choice is a latency
  decision, not a quality one.

### 30.5 Scheduling and peephole at the machine level
- **Covers** — instruction scheduling for pipelines (linking to M35), list scheduling with a
  dependence DAG, latency and resource constraints, scheduling versus register pressure, machine-
  level peephole optimisation, delay slots as a historical note, and profile-guided block layout for
  branch prediction and instruction-cache locality.
- **Demo** — the scheduler: a dependence DAG with latencies, a list-scheduled ordering, and the
  simulated pipeline timeline from M35 showing the stall cycles removed; register pressure is
  plotted alongside so the trade-off is visible.
- **Diagram** — mermaid DAG of instruction dependences with latency-weighted edges.
- **Lab** — implement list scheduling with a critical-path priority; tests assert the schedule
  respects all dependences and reduces simulated cycles versus the source order on fixtures.
- **Senior insight** — aggressive scheduling raises register pressure and can cause spills that cost
  more than the stalls it removed; the two passes fight, and that is why their order is tuned per
  target.

### 30.6 Targeting WebAssembly
- **Covers** — the wasm module format (sections, types, functions, memory, tables), the validation
  rules and structured control flow (blocks, loops, `br_table`) versus arbitrary jumps, the relooper
  and stackifier algorithms, linear memory and the absence of pointers-to-stack, the JavaScript
  interface, and the performance characteristics versus the interpreter.
- **Demo** — compile Berugo to wasm bytes in the browser, show the binary section by section, then
  instantiate and run it, with the same program's VM timing beside the wasm timing.
- **Diagram** — mermaid diagram of the CFG-to-structured-control-flow transformation.
- **Lab** — implement the stackifier for reducible CFGs (loops and blocks with branches to labels);
  tests assert the emitted module validates and produces the reference results for the conformance
  suite.
- **Senior insight** — wasm's structured control flow means an unstructured CFG has to be
  restructured, which is where the irreducible-flow-graph case from M29 becomes a real engineering
  problem rather than a footnote.

### 30.7 JIT compilation
- **Covers** — interpretation versus compilation trade-offs, tiering (interpreter → baseline →
  optimising), hotness counters and OSR entry, profiling data (types, call targets, branch bias),
  speculative optimisation with guards, deoptimisation and reconstructing interpreter state from
  compiled frames, and warm-up as a first-class problem.
- **Demo** — the tiering dashboard: run a program and watch functions cross hotness thresholds,
  get compiled, produce speculative code, then deoptimise when a guard fails, with the timeline of
  tier transitions and the reason for each deopt.
- **Diagram** — mermaid state diagram of a function's tier transitions including deoptimisation.
- **Lab** — implement OSR: transfer an executing loop from the interpreter into compiled code at a
  loop back edge; tests assert identical results and that the transfer preserves all live values.
- **Senior insight** — deoptimisation is what makes speculation safe, and it is why a benchmark that
  changes types halfway through measures the deopt path rather than the optimised one.

### 30.8 Inline caches and object shapes
- **Covers** — dynamic dispatch cost, monomorphic, polymorphic and megamorphic inline caches, hidden
  classes / shapes / maps and transition trees, property-access fast paths, why adding properties in
  a different order costs performance, dictionary mode, prototype-chain caching, and the same idea
  in method dispatch for class-based languages.
- **Demo** — shape explorer: build objects in different orders and watch the transition tree; an
  inline-cache view shows a call site moving from monomorphic to polymorphic to megamorphic with the
  measured per-access cost at each state.
- **Diagram** — mermaid tree of hidden-class transitions as properties are added.
- **Lab** — implement a monomorphic inline cache with a shape guard and a fallback; tests assert
  correct results under shape changes and a measured hit rate above a threshold on the fixture
  workload.
- **Senior insight** — "initialise all fields in the constructor, in the same order" is not
  folklore; it keeps the shape monomorphic, and this demo shows the cost of ignoring it in cycles.

### 30.9 Runtime support
- **Covers** — the calling convention between compiled code and the runtime, stack maps for
  precise stack scanning (needed by M31), safepoints, exception handling (tables versus setjmp-style
  unwinding), stack traces from compiled frames, source maps back to Berugo source, debugger support
  in optimised code, and the runtime/compiler interface boundary.
- **Demo** — a stack-trace viewer for optimised code: an exception thrown inside inlined,
  optimised frames still produces a source-level stack trace, with the inlining chain shown and the
  deoptimisation metadata that made it possible.
- **Diagram** — mermaid diagram of a stack map describing live references in a compiled frame.
- **Lab** — implement stack-map generation for the compiled frames and use it to enumerate live
  references at a safepoint; tests assert the enumerated set matches the interpreter's live set at
  the same program point.
- **Senior insight** — precise GC and inlined stack traces are both consequences of the same
  metadata; runtimes that skip it end up with conservative collection and unreadable traces.

### 30.10 Measuring a language runtime
- **Covers** — building a benchmark suite that is not a lie, warm-up and steady state, measuring
  compile time separately from run time, memory as a first-class metric, interpreter versus JIT
  versus wasm on the same programs, microbenchmark pathologies (dead-code elimination by the JIT,
  constant folding of the benchmark itself), and reporting results honestly.
- **Demo** — the runtime bake-off: every execution mode on every benchmark, with warm-up curves,
  steady-state distributions, compile-time breakdown and peak memory shown together; a "naive
  benchmark" toggle reproduces the classic mistakes and shows the fake numbers they produce.
- **Diagram** — mermaid flowchart of a correct measurement protocol for a JIT-compiled runtime.
- **Lab** — write a benchmark for a provided workload that survives the JIT's optimiser (results
  consumed, inputs opaque, warm-up separated); tests assert the measured cost scales with input size
  rather than staying flat.
- **Senior insight** — most published language benchmarks measure warm-up, allocation or the
  benchmark harness; the discipline in this section is more transferable than anything else in the
  milestone.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/berugo/bytecode.js` | Stack and register instruction sets, encoder, disassembler |
| `src/js/machines/berugo/vm.js` | Dispatch loop, frames, closures, exceptions, debugger hooks |
| `src/js/machines/berugo/isel.js` | Tree tiling with a data-driven cost model |
| `src/js/machines/berugo/regalloc.js` | Graph colouring and linear scan with splitting |
| `src/js/machines/berugo/schedule.js` | Dependence DAG, list scheduling, block layout |
| `src/js/machines/berugo/wasm-emit.js` | Module builder, stackifier, validation |
| `src/js/machines/berugo/jit.js` | Tiering, profiling, guards, OSR, deoptimisation |
| `src/js/machines/berugo/shapes.js` | Hidden classes, transition trees, inline caches |
| `src/js/machines/berugo/runtime.js` | Calling convention, stack maps, safepoints, traces |
| `src/js/machines/exec-lab.js` | Cross-mode execution and measurement harness |

---

## Acceptance criteria

- [ ] Every execution mode (AST interpreter, stack VM, register VM, JIT, wasm) produces identical
      results on the whole conformance suite, asserted in one differential test.
- [ ] The wasm output validates in the browser's own validator and runs; failures report the
      offending section.
- [ ] Register allocation is verified: no two simultaneously live values share a register, checked
      by an independent liveness pass.
- [ ] Deoptimisation restores interpreter state exactly, asserted by resuming and comparing final
      results against a never-compiled run.
- [ ] Inline-cache hit rates and shape transitions are measured, and the "same construction order"
      claim is backed by a measured difference.
- [ ] Every performance figure in this milestone reports warm-up handling and run count; the bench
      panel refuses to display a single-sample timing.

---

## Sources

- Nystrom — *Crafting Interpreters* (the bytecode VM half)
- Smith, Nair — *Virtual Machines: Versatile Platforms for Systems and Processes*
- Ierusalimschy, de Figueiredo, Celes — *The implementation of Lua 5.0* (register VM)
- Chaitin — graph-colouring register allocation; Poletto, Sarkar — *Linear scan register allocation*
- Hölzle, Chambers, Ungar — *Optimizing dynamically-typed object-oriented languages with polymorphic inline caches*
- Hölzle, Chambers, Ungar — *Debugging optimized code with dynamic deoptimization*
- Haas et al. — *Bringing the web up to speed with WebAssembly*
- Georges, Buytaert, Eeckhout — *Statistically rigorous Java performance evaluation*
