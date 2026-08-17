# M32 — Program analysis, SAT/SMT and verification

> **Track** Automata, languages and compilers · **Depends on** M29, M26 · **Sections** 11 · **Effort** XL

**Outcome.** The tools that reason about programs without running them, and the ones that run them
adversarially. Built on the Berugo compiler from M28–M30, so every analyser operates on a real
language with real IR — and the milestone ends with a solver and a model checker the earlier
milestones can call.

**Shared machinery introduced.** `machines/solver/` — a CDCL SAT solver and a DPLL(T) SMT layer with
theories, exposed as a service other milestones use (M20's encodings, M29's peephole verification,
M55's protocol models); `machines/analysis-lab.js` — runs any analyser over Berugo programs with
soundness/precision reporting against a dynamic oracle recorded from execution.

---

## Sections

### 32.1 Foundations of static analysis
- **Covers** — soundness and completeness with respect to a property, over- and
  under-approximation, false positives versus false negatives and which one a tool should choose,
  Rice's theorem as the reason approximation is mandatory (from M26), the precision axes (flow,
  path, context, field sensitivity) with their cost, and how to read a tool's documentation for its
  actual guarantees.
- **Demo** — the approximation viewer: one program, one property, analysed at four precision levels,
  with the reported result and the true answer from exhaustive execution shown side by side so the
  false positives and negatives are concrete.
- **Diagram** — mermaid diagram of the concrete state set with over- and under-approximating
  regions drawn around it.
- **Lab** — classify eight analyser behaviours as sound, complete, both or neither given their
  outputs on a fixture set; graded with explanations.
- **Senior insight** — a linter that reports no error is telling you nothing unless you know whether
  it is sound; most tools are neither sound nor complete and are still valuable, but only if you
  know which failures to expect.

### 32.2 Abstract interpretation
- **Covers** — concrete and abstract domains, Galois connections, abstraction and concretisation
  functions, the sign, parity, interval, congruence and octagon domains, transfer functions in the
  abstract, joins at merge points, widening for termination and narrowing to recover precision, and
  domain products.
- **Demo** — interval analysis over a Berugo program with per-variable intervals shown at every
  program point; the loop widens (watch the bound jump to ∞) and then narrows, with each step
  labelled.
- **Diagram** — mermaid diagram of the interval lattice with widening jumping to the top element.
- **Lab** — implement the interval domain with widening and narrowing; tests assert soundness
  against a dynamic oracle (every observed value lies inside the computed interval) over the fixture
  programs, and termination on all loops.
- **Senior insight** — widening is where precision goes to die and where termination comes from;
  a tool's usefulness on loops is almost entirely a function of its widening strategy.

### 32.3 Type-based and flow-sensitive analysis
- **Covers** — using the type system as an analysis (from M27), flow-sensitive narrowing
  (TypeScript-style control-flow analysis), nullability tracking and the billion-dollar-mistake
  argument, definite assignment, taint analysis with sources, sinks and sanitisers, and the
  annotation burden versus inference trade-off.
- **Demo** — a taint tracker over a Berugo web-handler fixture: tainted values highlighted through
  the program, sanitisers clearing taint, and the reported vulnerability at the sink with the full
  propagation path.
- **Diagram** — mermaid flowchart of a taint path from source through transformations to a sink.
- **Lab** — implement taint propagation including through data structures and function calls; tests
  assert every seeded injection is reported (no false negatives on the fixture set) and that
  sanitised paths are not reported.
- **Senior insight** — taint analysis is the highest-value static analysis in application security
  precisely because the source/sink/sanitiser model is small enough to be sound in practice for a
  fixed framework.

### 32.4 Symbolic execution
- **Covers** — symbolic values and path conditions, forking at branches, path explosion and the
  strategies against it (search heuristics, merging, summaries), constraint solving as the engine,
  concolic execution mixing concrete and symbolic, environment modelling, and generating a test
  input for each reachable path.
- **Demo** — symbolic execution of a Berugo function with the path tree drawn: each leaf shows its
  path condition and the concrete input the solver produced to reach it; a coverage readout shows
  what the generated inputs achieve.
- **Diagram** — mermaid tree of execution paths with accumulated path conditions.
- **Lab** — implement path-condition accumulation and use the SMT solver to generate inputs
  reaching a target branch; tests assert the generated input really reaches the branch when
  executed.
- **Senior insight** — symbolic execution produces test cases with a proof of reachability attached;
  that is qualitatively different from fuzzing, which is why the two are complementary rather than
  competing.

### 32.5 SAT solving
- **Covers** — CNF and the DPLL backbone, unit propagation with two-watched literals, conflict
  analysis and clause learning (1UIP), non-chronological backjumping, VSIDS activity heuristics,
  restart policies, clause deletion, phase saving, preprocessing, and DRAT proofs for unsatisfiable
  answers.
- **Demo** — the solver dashboard: watch decisions, propagations, conflicts and learned clauses in
  real time on a hard instance, with the implication graph drawn at the moment of conflict and the
  1UIP cut highlighted.
- **Diagram** — mermaid graph of an implication graph with the conflict cut marked.
- **Lab** — implement two-watched-literal unit propagation; tests assert it produces identical
  propagations to a naive counting implementation over randomised formulas, and measurably fewer
  clause visits.
- **Senior insight** — clause learning is why modern SAT solvers handle millions of variables: each
  conflict permanently prunes a region of the space. It is the single most important algorithmic
  idea in the milestone.

### 32.6 SMT solving
- **Covers** — theories (equality with uninterpreted functions, linear integer and real arithmetic,
  bit-vectors, arrays, strings), the DPLL(T) architecture, theory propagation and conflict
  explanation, eager bit-blasting versus lazy theory combination, quantifiers and E-matching with
  their incompleteness, and using an SMT solver as a general reasoning engine.
- **Demo** — an SMT session over a Berugo verification condition: the boolean skeleton, the theory
  atoms, the theory solver's conflicts fed back as clauses, and the final model or unsat core
  displayed.
- **Diagram** — mermaid diagram of the DPLL(T) loop between the SAT core and the theory solvers.
- **Lab** — implement the equality-with-uninterpreted-functions theory solver using union-find (from
  M04) with congruence closure; tests assert correct sat/unsat answers on fixtures and that returned
  models satisfy every asserted equality.
- **Senior insight** — congruence closure is union-find with a congruence rule, which means the
  data structure from M04 is doing the reasoning; most theory solvers are similarly built from
  algorithms already covered.

### 32.7 Model checking
- **Covers** — the state-transition-system model, explicit-state exploration with hashing and
  partial-order reduction, temporal logic (LTL and CTL) with the properties each can express, the
  automaton-theoretic approach via Büchi automata (from M24), bounded model checking as SAT,
  symbolic model checking with BDDs, counter-example extraction, and state-space explosion.
- **Demo** — model-check a small concurrent protocol: the reachable state graph is explored, a
  safety violation is found, and the counter-example trace is replayed step by step over the
  protocol's state; partial-order reduction is toggled to show the state-count reduction.
- **Diagram** — mermaid state diagram of a protocol's reachable states with the violating path
  highlighted.
- **Lab** — implement bounded model checking by unrolling a transition relation into CNF and calling
  the SAT solver; tests assert violations are found at the correct depth and that no violation is
  reported for correct models within the bound.
- **Senior insight** — a model checker's output is a counter-example trace, which is the most
  actionable artefact in verification: it is a bug report with an exact reproduction, produced
  before the code exists.

### 32.8 Deductive verification
- **Covers** — Hoare logic and weakest preconditions (from M27) applied to real code, loop
  invariants and how to find them, verification-condition generation, discharging VCs with SMT,
  frame conditions and the frame problem, separation logic for heap reasoning, and refinement types
  as lightweight verification.
- **Demo** — verify a Berugo function end to end: annotations in, VCs generated and displayed,
  each discharged by the SMT solver with the unsat core shown for the ones that fail, and a
  counter-example model for a genuinely wrong annotation.
- **Diagram** — mermaid flowchart from annotated program to VCs to solver results.
- **Lab** — annotate and verify binary search (the classic overflow bug included in the starting
  code); tests assert the VCs fail before the fix and are all discharged after it.
- **Senior insight** — the binary-search overflow was found by verification decades after the
  algorithm was considered settled; the value of the technique is exactly on code everyone believes
  is correct.

### 32.9 Dynamic analysis
- **Covers** — instrumentation strategies (source, IR, runtime), coverage measurement (statement,
  branch, path, MC/DC) and what each misses, data-race detection with happens-before and lockset
  algorithms and their false-positive profiles, deadlock detection at runtime, memory-error
  detection (shadow memory, redzones, quarantine), and the overhead each imposes.
- **Demo** — race detector on a concurrent Berugo program (using M47's simulated threads):
  happens-before edges drawn, the racing accesses highlighted, and the same program under the
  lockset algorithm to compare the reports and false positives.
- **Diagram** — mermaid diagram of a happens-before graph with a race between two unordered
  accesses.
- **Lab** — implement vector-clock-based happens-before race detection; tests assert every seeded
  race is detected and no race is reported for correctly synchronised fixtures.
- **Senior insight** — a race detector only sees the interleaving that happened, which is why it
  must reason about happens-before rather than actual concurrency — that is how it finds races that
  did not manifest in the observed run.

### 32.10 Fuzzing
- **Covers** — black-box, grammar-based and coverage-guided fuzzing, the AFL feedback loop with
  edge coverage and the corpus, mutation operators, seed selection and corpus minimisation,
  structure-aware fuzzing with a grammar (from M25), sanitiser integration as the oracle, crash
  triage and deduplication, and differential fuzzing as an oracle when there is no crash.
- **Demo** — coverage-guided fuzzer against the Berugo parser and VM: the corpus grows, coverage
  climbs, new edges are highlighted as they are discovered, and crashes are triaged and minimised
  automatically.
- **Diagram** — mermaid flowchart of the coverage-guided loop with the corpus feedback edge.
- **Lab** — implement corpus minimisation (keep the smallest input set achieving the same coverage);
  tests assert identical total coverage with a reduced corpus size on a recorded run.
- **Senior insight** — the oracle is the hard part, not the mutation: without sanitisers,
  assertions or a differential reference, a fuzzer can only find crashes, and most bugs are not
  crashes.

### 32.11 Specifying and verifying systems
- **Covers** — what is worth verifying and what is not, writing a specification before the code,
  TLA+ and Alloy as modelling languages, modelling a distributed protocol and checking invariants
  and liveness, refinement between an abstract spec and an implementation, property-based testing as
  executable specification, the cost/benefit calculation, and the industrial track record
  (S3, DynamoDB, CompCert, seL4).
- **Demo** — model a small replication protocol in the platform's own TLA-like modelling DSL, check
  safety and liveness with the model checker from 32.7, inject a partition, and see the invariant
  violation with a trace — the same protocol M55 later implements.
- **Diagram** — mermaid diagram relating the specification, the model, the implementation and the
  refinement obligations between them.
- **Lab** — specify and check a two-phase commit model, then find the blocking scenario the protocol
  is known for; tests assert the model checker reports it with a valid trace.
- **Senior insight** — the industrial reports agree on the same finding: the value is in the
  *specification*, which forces the ambiguities out, and the model checker mostly confirms what
  writing the spec already revealed.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/solver/sat.js` | CDCL, watched literals, VSIDS, restarts, DRAT proof logging |
| `src/js/machines/solver/smt.js` | DPLL(T) core, theory interface, model and unsat-core extraction |
| `src/js/machines/solver/theories/` | EUF with congruence closure, linear arithmetic, bit-vectors, arrays |
| `src/js/algorithms/abstract-interp.js` | Domains, transfer functions, widening and narrowing |
| `src/js/algorithms/taint.js` | Source/sink/sanitiser propagation over Berugo IR |
| `src/js/algorithms/symbolic-exec.js` | Path conditions, forking, input generation, concolic mode |
| `src/js/algorithms/model-check.js` | Explicit-state search, POR, LTL/Büchi, BMC via SAT |
| `src/js/algorithms/verify-vc.js` | Weakest preconditions, VC generation, SMT discharge |
| `src/js/algorithms/race-detect.js` | Vector clocks, happens-before, lockset |
| `src/js/algorithms/fuzzer.js` | Coverage-guided loop, mutators, corpus minimisation, triage |
| `src/js/machines/spec-dsl.js` | TLA-like modelling DSL feeding the model checker |
| `src/js/machines/analysis-lab.js` | Soundness/precision measurement against dynamic oracles |

---

## Acceptance criteria

- [ ] The SAT solver is validated on SATLIB-style fixtures: every SAT answer's model is checked
      against the formula, and every UNSAT answer emits a DRAT proof that the bundled checker
      verifies.
- [ ] The SMT solver's models satisfy every assertion, checked independently of the solver.
- [ ] Every static analyser reports its soundness result against a dynamic oracle on the fixture
      suite, and the section states which direction it approximates.
- [ ] Symbolic execution's generated inputs are executed and asserted to reach the intended branch.
- [ ] The race detector finds every seeded race and reports none on correctly synchronised code.
- [ ] The model checker's counter-examples are replayed against the model and confirmed to violate
      the property.
- [ ] The solver package is exposed as a stable interface and is consumed by at least M20 and M29 in
      their tests, proving it is a service and not a demo.

---

## Sources

- Nielson, Nielson, Hankin — *Principles of Program Analysis*
- Cousot, Cousot — *Abstract interpretation: a unified lattice model*
- Marques-Silva, Sakallah — *GRASP: a search algorithm for propositional satisfiability*
- Moskewicz et al. — *Chaff: engineering an efficient SAT solver* (VSIDS, watched literals)
- de Moura, Bjørner — *Z3: an efficient SMT solver*
- Clarke, Grumberg, Peled — *Model Checking*
- King — *Symbolic execution and program testing*; Cadar, Dunbar, Engler — *KLEE*
- Savage et al. — *Eraser: a dynamic data race detector*; Flanagan, Freund — *FastTrack*
- Newcombe et al. — *How Amazon Web Services uses formal methods*
