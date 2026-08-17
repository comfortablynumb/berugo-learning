# M29 — IR, SSA and optimisation

> **Track** Automata, languages and compilers · **Depends on** M28, M13 · **Sections** 10 · **Effort** L

**Outcome.** The middle end of the Berugo compiler: a typed SSA intermediate representation, the
analyses that make optimisation legal, the classic optimisation passes, and the verification
machinery that proves a pass did not change behaviour. Every pass is inspectable before and after,
with the analysis facts it relied on displayed.

**Shared machinery introduced.** `machines/berugo/ir.js` — the IR with a verifier;
`machines/pass-lab.js` — runs any pass pipeline over any program, showing IR diffs per pass, the
analysis facts consumed, and a differential test against the reference interpreter after every pass;
`viz/cfg-view.js` — control-flow graph rendering with dominator overlay, reused by M32.

---

## Sections

### 29.1 Designing an intermediate representation
- **Covers** — why not optimise the AST, three-address code, stack IR versus register IR, typed
  versus untyped IR, virtual registers, the instruction set of the Berugo IR, lowering from the core
  language, IR invariants and the verifier, and the multi-level IR idea (high-level operations
  lowered progressively).
- **Demo** — the lowering viewer: core AST on the left, IR on the right, with each IR instruction
  attributed to the AST node that produced it; the verifier's checks are listed and can be violated
  deliberately to see it catch each one.
- **Diagram** — mermaid diagram of one expression lowered to three-address instructions.
- **Lab** — implement lowering for `if`/`while` including the block structure and jumps; tests
  assert the IR verifies and that interpreting the IR matches the reference interpreter's output.
- **Senior insight** — the IR verifier is the single highest-value piece of a compiler's middle end:
  it turns "the optimiser produced garbage somewhere" into "pass X broke invariant Y", instantly.

### 29.2 Control-flow graphs
- **Covers** — basic blocks and leaders, CFG construction, critical edges and why they are split,
  loops and back edges, natural loops and loop nesting forests, reducibility and irreducible flow
  graphs (and where they come from), unreachable-block elimination, and CFG simplification.
- **Demo** — CFG builder: source to blocks to graph with loops shaded by nesting depth; a
  goto-style irreducible fixture shows why some analyses need it handled explicitly.
- **Diagram** — mermaid flowchart of a CFG with a back edge marked and the natural loop shaded.
- **Lab** — implement natural-loop detection from back edges and compute the loop nesting forest;
  tests assert loop membership against a brute-force reachability oracle including nested and shared
  headers.
- **Senior insight** — critical-edge splitting looks like bookkeeping and is actually a correctness
  requirement for several passes; skipping it produces bugs that only appear when two paths merge.

### 29.3 Dominators
- **Covers** — dominance, immediate dominators and the dominator tree, the iterative
  Cooper–Harvey–Kennedy algorithm versus Lengauer–Tarjan, post-dominance, dominance frontiers and
  their meaning, and the queries dominance answers (is this definition available here, can this
  code be hoisted).
- **Demo** — dominator explorer: click any block to highlight the blocks it dominates, its immediate
  dominator and its dominance frontier, with the iterative algorithm's fixpoint animated round by
  round.
- **Diagram** — mermaid tree of the dominator tree beside the CFG it came from.
- **Lab** — implement the iterative dominator algorithm and dominance-frontier computation; tests
  assert results against a brute-force path-enumeration oracle on randomised CFGs.
- **Senior insight** — "does A dominate B" answers most legality questions in an optimiser, which is
  why dominator computation is the first analysis every compiler builds and caches.

### 29.4 SSA form
- **Covers** — the single-assignment property, φ-functions and their meaning, minimal versus pruned
  SSA, placing φ-functions using dominance frontiers, renaming by a dominator-tree walk, the
  memory/aliasing exception, SSA destruction and the lost-copy and swap problems, and parallel-copy
  sequentialisation.
- **Demo** — SSA construction step by step: φ placement shown per variable with the dominance
  frontier that justified it, then renaming animated over the dominator tree; destruction shows the
  copies inserted and the swap problem in a fixture designed for it.
- **Diagram** — mermaid diagram of a φ-function merging two definitions at a join point.
- **Lab** — implement φ placement and renaming; tests assert the SSA verifier passes (every use
  dominated by its definition), that the program's behaviour is unchanged, and that pruned SSA has
  no dead φ.
- **Senior insight** — SSA makes def–use chains explicit, which is why nearly every modern
  optimisation is stated in terms of it; the cost is that memory operations sit outside the property
  and need their own machinery.

### 29.5 Dataflow analysis
- **Covers** — the lattice framework, transfer functions, meet versus join, forward and backward
  analyses, the worklist algorithm and its termination argument, monotonicity and finite height,
  the classic analyses (liveness, reaching definitions, available expressions, very busy
  expressions), and precision versus speed (flow, path and context sensitivity).
- **Demo** — analysis runner: pick an analysis and watch the worklist propagate facts block by block
  until the fixpoint, with per-block in/out sets displayed and the iteration count reported.
- **Diagram** — mermaid diagram of the lattice for a constant-propagation domain with ⊤ and ⊥.
- **Lab** — implement liveness analysis with the worklist algorithm; tests assert the live sets
  against a brute-force enumeration on randomised CFGs, including loops.
- **Senior insight** — every dataflow analysis is the same algorithm with a different lattice and
  transfer function; recognising that turns "write a new analysis" into "define a domain", which is
  a day rather than a month.

### 29.6 Scalar optimisations
- **Covers** — constant folding and propagation, sparse conditional constant propagation combining
  constants with reachability, common-subexpression elimination, global value numbering, copy
  propagation, dead-code elimination (and why it needs liveness or a mark-sweep over uses),
  algebraic simplification and strength reduction, peephole rewriting, and the pass-ordering problem
  (phase ordering).
- **Demo** — the pass laboratory: assemble a pass pipeline by drag and drop, run it, and see the IR
  after each pass with instruction counts; a phase-ordering panel shows that A-then-B and B-then-A
  produce different code, with the counts for each.
- **Diagram** — mermaid flowchart of SCCP's combined constant and reachability lattice.
- **Lab** — implement SCCP; tests assert it folds constants that plain constant propagation cannot
  (those guarded by conditions it proves unreachable) and that the resulting program is
  behaviourally identical on the conformance suite.
- **Senior insight** — phase ordering is genuinely unsolved: real compilers run passes repeatedly in
  a tuned order because no fixed order is optimal, and that is why "-O2 made it slower" is a real
  bug report.

### 29.7 Loop optimisations
- **Covers** — loop-invariant code motion and its safety conditions, induction-variable recognition
  and strength reduction, loop unrolling and the code-size/branch trade-off, loop-invariant load
  hoisting and the aliasing precondition, unswitching, fusion and fission, interchange for locality
  (linking to M37), and vectorisation preconditions.
- **Demo** — the loop optimiser: apply each transformation individually to the same loop nest and
  see the IR, the instruction count in the loop body and the simulated cache behaviour from M21's
  cache model change.
- **Diagram** — mermaid diagram of LICM hoisting an expression into a preheader.
- **Lab** — implement LICM with correct safety checks (invariant, dominates all exits or is safe to
  speculate); tests assert behaviour preservation including the fixture where naive hoisting of a
  possibly-trapping operation would change semantics.
- **Senior insight** — hoisting a division or a load out of a loop is only legal if it cannot trap
  or fault when the loop body would not have executed; that single condition is where most
  hand-written "optimisations" become bugs.

### 29.8 Interprocedural optimisation
- **Covers** — call graphs and their construction with indirect calls, inlining and its heuristics
  (size, call-site frequency, recursion), the code-size/speed trade-off, inlining as the enabling
  transformation for everything else, tail-call optimisation, escape analysis and stack allocation,
  devirtualisation with type feedback, and whole-program versus separate compilation.
- **Demo** — inlining explorer: a call graph with per-edge cost/benefit estimates, an adjustable
  budget, and the resulting code-size and instruction-count changes; escape analysis marks each
  allocation as stack- or heap-bound with the reason.
- **Diagram** — mermaid call graph with inlined edges collapsed and the size budget annotated.
- **Lab** — implement escape analysis for the Berugo IR and stack-allocate non-escaping records;
  tests assert identical behaviour and a measured drop in heap allocations on the fixture set.
- **Senior insight** — inlining is the optimisation that unlocks the others, which is why compilers
  spend so much of their budget on the heuristic; it is also why a small refactor across a function
  boundary can change performance by a factor.

### 29.9 Memory and alias analysis
- **Covers** — why memory breaks SSA, memory SSA and the alias-aware def–use chain, points-to
  analysis (Andersen's inclusion-based and Steensgaard's unification-based) with their
  precision/cost trade-off, field and flow sensitivity, type-based alias analysis, load/store
  elimination and store forwarding, and the aliasing information a language's type system can
  guarantee for free.
- **Demo** — points-to viewer: the analysis's result as a graph from pointers to allocation sites,
  with Andersen and Steensgaard results compared on the same program, and the loads each one can
  eliminate.
- **Diagram** — mermaid graph of a points-to relation with an imprecise merge highlighted.
- **Lab** — implement Steensgaard's unification-based analysis; tests assert soundness (every real
  alias is reported) against a dynamic oracle recorded from the reference interpreter.
- **Senior insight** — alias analysis is where compilers give up first, and it is why `restrict`,
  ownership types and immutability pay off in generated code, not just in reasoning.

### 29.10 Verifying the optimiser
- **Covers** — the IR verifier as a per-pass gate, differential testing against the reference
  interpreter after every pass, random program generation for the middle end, translation validation
  (proving equivalence per compilation rather than proving the pass), Alive-style verification of
  peephole rules with an SMT solver (linking to M32), and shrinking a failing program to a minimal
  repro.
- **Demo** — the fuzzing harness: generate random programs, run every pass pipeline, compare against
  the reference interpreter, and automatically shrink any mismatch to a minimal failing program
  displayed alongside the offending pass.
- **Diagram** — mermaid flowchart of generate → compile → differential-test → shrink.
- **Lab** — implement the shrinker (delete statements, simplify constants, inline single-use
  temporaries while the failure persists); tests assert it reduces a seeded 200-line failing program
  to under 10 lines.
- **Senior insight** — Csmith and its descendants found hundreds of bugs in production compilers by
  exactly this loop; the shrinker is what makes the found bugs actionable, and it is usually the
  part people skip.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/berugo/ir.js` | Instructions, types, builders, verifier |
| `src/js/machines/berugo/cfg.js` | Block construction, edges, loops, simplification |
| `src/js/machines/berugo/dominators.js` | Dominator tree, post-dominators, dominance frontiers |
| `src/js/machines/berugo/ssa.js` | φ placement, renaming, destruction, parallel copies |
| `src/js/machines/berugo/dataflow.js` | Lattice framework, worklist solver, classic analyses |
| `src/js/machines/berugo/passes-scalar.js` | SCCP, GVN/CSE, DCE, copy propagation, peephole |
| `src/js/machines/berugo/passes-loop.js` | LICM, induction variables, unrolling, unswitching |
| `src/js/machines/berugo/interproc.js` | Call graph, inlining, escape analysis, devirtualisation |
| `src/js/machines/berugo/alias.js` | Andersen, Steensgaard, memory SSA |
| `src/js/machines/pass-lab.js` | Pipeline runner, IR diffs, differential testing, shrinker |
| `src/js/viz/cfg-view.js` | CFG rendering with dominator and dataflow overlays |

---

## Acceptance criteria

- [ ] The IR verifier runs after every pass in every demo and every test; a pass that produces
      invalid IR fails immediately with the violated invariant named.
- [ ] Every pass is differentially tested against the reference interpreter on the conformance suite
      and on 10⁴ generated programs.
- [ ] Dominator and dataflow results are validated against brute-force oracles on randomised CFGs.
- [ ] SSA construction is asserted minimal-with-pruning: no φ whose value is never used, every use
      dominated by its definition.
- [ ] LICM's safety conditions are tested with the trapping-operation fixture, and the naive version
      demonstrably breaks it.
- [ ] Alias analysis soundness is checked against a dynamic alias oracle recorded from execution.
- [ ] The shrinker reduces seeded failures to a minimal form, asserted by size bounds.

---

## Sources

- Cooper, Torczon — *Engineering a Compiler*
- Muchnick — *Advanced Compiler Design and Implementation*
- Cytron et al. — *Efficiently computing static single assignment form and the control dependence graph*
- Cooper, Harvey, Kennedy — *A simple, fast dominance algorithm*
- Wegman, Zadeck — *Constant propagation with conditional branches* (SCCP)
- Steensgaard — *Points-to analysis in almost linear time*; Andersen — the inclusion-based analysis
- Yang, Chen, Eide, Regehr — *Finding and understanding bugs in C compilers* (Csmith)
- Lopes et al. — *Provably correct peephole optimizations with Alive*
