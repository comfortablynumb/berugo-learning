# M35 — Pipelining, hazards and branch prediction

> **Track** Computer architecture · **Depends on** M34 · **Sections** 9 · **Effort** L

**Outcome.** The BRV32 CPU from M34, pipelined: five stages, hazard detection, forwarding, branch
prediction and precise exceptions, with a cycle-accurate visualiser that shows every stall and flush
and attributes lost cycles to a cause. The milestone ends with the software side — writing code that
a pipeline likes, measured rather than assumed.

**Shared machinery introduced.** `machines/brv32/pipeline.js` — the five-stage pipelined datapath
with per-stage state, hazard and forwarding units and a cycle log;
`machines/brv32/predictors.js` — pluggable branch predictors sharing one interface;
`viz/pipeline-view.js` — the stage/cycle diagram (instructions on rows, cycles on columns) with
stalls, flushes and forwards annotated.

---

## Sections

### 35.1 Pipelining fundamentals
- **Covers** — the laundry analogy done properly (throughput versus latency), the five classic
  stages, pipeline registers and what must be carried between stages, ideal speed-up and why it is
  never achieved, the clock-period argument, pipeline depth versus per-stage work, and fill and
  drain.
- **Demo** — the same program on the single-cycle and pipelined datapaths with the stage/cycle
  diagram animating; a summary reports IPC, total cycles, clock period and total time for both.
- **Diagram** — mermaid diagram of five instructions overlapping across five stages.
- **Lab** — implement the pipeline registers for the decode/execute boundary carrying exactly the
  needed fields; tests assert correct execution of hazard-free programs and that no stage reads
  stale state.
- **Senior insight** — pipelining improves throughput and *worsens* latency per instruction; every
  place that trade appears again (request pipelining, batch processing, GPU warps) has the same
  shape.

### 35.2 Structural hazards
- **Covers** — resource conflicts, the unified-memory conflict between instruction fetch and data
  access, single-ported register files, multi-cycle functional units, resolution by duplication,
  pipelining the resource, or stalling, and how the choice shows up as area versus CPI.
- **Demo** — run the pipeline with a unified memory and watch the structural stalls appear on the
  stage diagram; split the memory into instruction and data ports and watch them vanish, with the
  cycle count difference reported.
- **Diagram** — mermaid diagram of two stages contending for one memory port.
- **Lab** — add stall logic for a single-ported register file (two reads and one write per cycle
  contending); tests assert correctness and the predicted stall count on the fixture program.
- **Senior insight** — every structural hazard is a queueing problem in miniature; the decision to
  duplicate or stall is the same one made about connection pools and thread pools in M58.

### 35.3 Data hazards and forwarding
- **Covers** — RAW, WAR and WAW dependences and which can occur in an in-order pipeline, the hazard
  detection unit, stalling versus forwarding, the forwarding network from EX/MEM and MEM/WB, the
  load-use hazard that forwarding cannot remove, compiler scheduling to fill the slot, and the
  register-file read-during-write question from M33.
- **Demo** — dependency-aware stepping: each instruction's source operands are shown with their
  provenance (register file, EX forward, MEM forward or stall), and the forwarding paths light up on
  the datapath as they are used.
- **Diagram** — mermaid diagram of the forwarding paths overlaid on the pipeline stages.
- **Lab** — implement the forwarding unit's selection logic including the double-hazard case (two
  prior instructions writing the same register); tests assert correct operand selection against the
  reference simulator on adversarial dependency chains.
- **Senior insight** — the double-hazard case (forward from the *most recent* producer) is the
  classic bug; it only appears when two back-to-back instructions write the same register, which is
  rare in hand-written tests and common in compiler output.

### 35.4 Control hazards
- **Covers** — the branch penalty, where branches resolve and the cost of resolving late, flushing
  versus predicting, static prediction (always-not-taken, backward-taken), early branch resolution
  in decode with its added comparator and forwarding needs, delayed branches as a historical
  approach, and the penalty's growth with pipeline depth.
- **Demo** — branch-penalty explorer: move the branch-resolution stage and watch the flush count and
  IPC change on a branch-heavy program, with the wasted cycles shaded on the stage diagram.
- **Diagram** — mermaid diagram of a mispredicted branch flushing the following instructions.
- **Lab** — implement early branch resolution in the decode stage with the required forwarding;
  tests assert correct execution and a reduced flush count versus the execute-stage version.
- **Senior insight** — the branch penalty is the multiplier on every prediction miss, and it is why
  deeper pipelines demanded better predictors: the cost per mistake grew with the depth that was
  supposed to make things faster.

### 35.5 Branch prediction: the basics
- **Covers** — the prediction problem, static schemes and profile-guided hints, one-bit predictors
  and the loop-boundary double-miss, two-bit saturating counters, the branch history table with
  aliasing, the branch target buffer, the return-address stack for calls and returns, and
  measuring prediction accuracy per branch site.
- **Demo** — predictor comparison on the same program: accuracy per branch site, the state of each
  counter visualised as a small FSM, and the double-miss behaviour of the one-bit predictor on a
  nested loop made explicit.
- **Diagram** — mermaid state diagram of the two-bit saturating counter.
- **Lab** — implement the two-bit predictor and the return-address stack; tests assert the predicted
  accuracy on fixture traces and that call/return pairs are predicted correctly even when nested.
- **Senior insight** — the return-address stack is why returns are essentially free and indirect
  calls are not; it is also why deep recursion beyond the stack's depth suddenly gets slower.

### 35.6 Advanced branch prediction
- **Covers** — correlation between branches, global history and gshare's XOR indexing, local versus
  global predictors, tournament/hybrid predictors with a chooser, TAGE's tagged geometric-history
  tables, perceptron predictors, indirect-branch prediction, and the aliasing/capacity trade-offs.
- **Demo** — the predictor tournament: static, bimodal, gshare, tournament and a simplified TAGE all
  run on the same traces (including a correlated-branch fixture designed to separate them), with
  accuracy and mispredicts-per-kilo-instruction reported.
- **Diagram** — mermaid diagram of gshare indexing by PC XOR global history.
- **Lab** — implement gshare and measure its advantage on the correlated-branch fixture; tests
  assert accuracy above a threshold there and no regression on the uncorrelated fixture.
- **Senior insight** — modern predictors reach 98–99% on typical code, which sounds finished until
  you compute the cost: at a 20-cycle penalty, 2% mispredicts on a branch every 5 instructions is
  still a large fraction of runtime.

### 35.7 Precise exceptions in a pipeline
- **Covers** — why an exception in a pipelined machine is hard (multiple instructions in flight,
  some after the faulting one), the precise-exception requirement, exception flags carried down the
  pipeline, resolving at commit, flushing younger instructions, restarting, and the interaction with
  branch misprediction recovery.
- **Demo** — trigger a fault mid-pipeline and watch the flags travel with the instruction, younger
  instructions get squashed and the handler start at exactly the right PC, with the architectural
  state proven unchanged by the squashed instructions.
- **Diagram** — mermaid diagram of the exception flag propagating to the commit point.
- **Lab** — implement exception flag propagation and squash logic; tests assert precise state for
  faults in every stage, including a fault in an instruction that a mispredicted branch should have
  squashed anyway.
- **Senior insight** — "precise" means the machine can pretend it executed strictly in order, which
  is the abstraction the entire software stack depends on. Everything in M36 exists to break that
  order while preserving the illusion.

### 35.8 Deeper pipelines and their limits
- **Covers** — superpipelining, the frequency-versus-IPC trade, the optimal pipeline depth result,
  the branch penalty and hazard cost growing with depth, power and the frequency wall (from M33),
  the Pentium 4 versus Pentium M history as the industry's live experiment, and where depth settled.
- **Demo** — depth explorer: simulate the same program at pipeline depths from 3 to 20 with a
  correspondingly scaled clock period, plotting IPC, frequency and total time — the optimum appears
  as a curve with a peak, not a monotone gain.
- **Diagram** — mermaid diagram of the same work split into more, shorter stages with overhead per
  register.
- **Lab** — model pipeline-register overhead and find the optimal depth for a given workload mix;
  tests assert the model reproduces the expected optimum for two contrasting workloads.
- **Senior insight** — the pipeline-register overhead per stage is what bounds depth; the same
  "overhead per stage" argument caps how finely any pipeline — including a software one — can be
  split.

### 35.9 Writing pipeline-friendly code
- **Covers** — measuring mispredictions in real code, branchless techniques (conditional moves,
  arithmetic selection, table lookup) and when they lose, sorting data to make branches predictable,
  loop unrolling's effect on branch density, avoiding indirect calls in hot loops, profile-guided
  layout, and the measurement discipline that keeps all of this honest.
- **Demo** — the branch laboratory: a filter loop over sorted versus unsorted data with mispredict
  counts and cycle counts from the simulator (the classic "sorted array is faster" result,
  reproduced with the mechanism visible), plus a branchless variant that is insensitive to the data
  order.
- **Diagram** — mermaid decision flowchart for choosing branchless versus branchy code.
- **Lab** — convert a data-dependent branch in a hot loop into a branchless form; tests assert
  identical results and a measured reduction in simulated mispredicts, with the cycle-count
  comparison reported both ways.
- **Senior insight** — branchless code trades a possible mispredict for a guaranteed dependency; it
  wins when the branch is unpredictable and loses when it is predictable, and only measurement tells
  you which case you have.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/brv32/pipeline.js` | Five-stage datapath, pipeline registers, cycle log |
| `src/js/machines/brv32/hazards.js` | Detection unit, stall logic, forwarding unit |
| `src/js/machines/brv32/predictors.js` | Static, bimodal, gshare, tournament, TAGE-lite, BTB, RAS |
| `src/js/machines/brv32/exceptions-pipelined.js` | Flag propagation, squash, precise commit |
| `src/js/machines/pipeline-model.js` | Depth/frequency/overhead model for the depth explorer |
| `src/js/viz/pipeline-view.js` | Stage-by-cycle diagram with stalls, flushes and forwards |
| `src/js/viz/predictor-view.js` | Per-site accuracy, counter states, history registers |

---

## Acceptance criteria

- [ ] The pipelined CPU produces identical architectural state to the M34 reference simulator on
      every test program, including hazard-dense and branch-dense fixtures.
- [ ] Every stall and flush in the cycle log is attributed to a cause, and the totals reconcile:
      cycles = instructions + stalls + flushes + fill.
- [ ] The forwarding unit is tested against the double-hazard fixture; the naive version fails it.
- [ ] Predictor accuracies are measured on shared traces, and the correlated-branch fixture
      demonstrably separates gshare from bimodal.
- [ ] Exceptions are precise for faults raised in every stage, asserted by comparing architectural
      state against the reference at the handler entry.
- [ ] The sorted-versus-unsorted branch demo reproduces the effect with mispredict counts, not just
      timings.

---

## Sources

- Patterson, Hennessy — *Computer Organization and Design*, the pipelining chapters
- Hennessy, Patterson — *Computer Architecture: A Quantitative Approach*
- McFarling — *Combining branch predictors* (gshare)
- Yeh, Patt — *Two-level adaptive training branch prediction*
- Seznec, Michaud — *A case for (partially) tagged geometric history length branch prediction* (TAGE)
- Hartstein, Puzak — *The optimum pipeline depth for a microprocessor*
- Jiménez, Lin — *Dynamic branch prediction with perceptrons*
