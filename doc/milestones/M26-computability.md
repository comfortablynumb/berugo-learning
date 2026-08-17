# M26 — Computability and complexity theory

> **Track** Automata, languages and compilers · **Depends on** M24, M20 · **Sections** 10 · **Effort** L

**Outcome.** The limits: what no program can do, and what no efficient program can do. For a senior
engineer the payoff is practical — knowing why static analysers must approximate, why "just detect
infinite loops" is not a feature request, and what a quantum computer would and would not change.

**Shared machinery introduced.** `machines/turing-machine.js` — a Turing machine simulator with
tape, head, configuration history, step budget and multi-tape support; `machines/model-zoo.js` —
alternative computation models (counter machine, RAM, cellular automaton, tag system, SKI reduction)
sharing one execution/trace interface so equivalence can be demonstrated by running them.

---

## Sections

### 26.1 Turing machines
- **Covers** — the formal model, configurations and transitions, acceptance and halting, multi-tape
  and nondeterministic variants and their polynomial equivalence, the universal Turing machine, the
  Church–Turing thesis and its status as a thesis rather than a theorem, and encoding machines as
  data.
- **Demo** — the Turing machine simulator running classic programs (binary increment, palindrome
  check, unary multiplication) with tape, head and state trace; a step budget makes non-halting
  visible rather than hanging the page.
- **Diagram** — mermaid state diagram of a small Turing machine's transition function.
- **Lab** — write a Turing machine that decides `{aⁿbⁿcⁿ}` (not context-free, but decidable); tests
  assert correct accept/reject on strings up to a bound and termination within a step budget.
- **Senior insight** — the universal machine is the first program that takes a program as input;
  every interpreter, VM and container runtime in this platform is a descendant of that one idea.

### 26.2 Equivalent models of computation
- **Covers** — lambda calculus (developed in M27), counter and register machines, the RAM model,
  cellular automata (Rule 110), tag systems, combinatory logic, and simulation as the proof
  technique that establishes equivalence; also which models are equivalent in *efficiency* and not
  merely in power.
- **Demo** — the model zoo: run the same computation in four models side by side with step counts,
  and watch a cross-compiler translate a program from one model to another and execute it.
- **Diagram** — mermaid graph of the simulation relationships between models.
- **Lab** — implement a two-counter-machine simulator and encode a small program on it; tests assert
  it computes the same function as a reference implementation for all inputs in range.
- **Senior insight** — equal power is not equal efficiency: a two-counter machine is Turing complete
  and exponentially slower, which is exactly the distinction that makes complexity theory a separate
  subject from computability.

### 26.3 Undecidability and diagonalisation
- **Covers** — decidable versus recognisable (recursively enumerable) versus co-recognisable, the
  diagonalisation argument, the halting problem's proof in full, the acceptance problem, why
  recognisers can loop forever, and the enumeration view of recognisability.
- **Demo** — the diagonal construction rendered as a table of machines against inputs, with the
  contradictory diagonal machine constructed and its self-application highlighted; a
  "halting oracle" toggle lets the learner watch the contradiction unfold concretely.
- **Diagram** — mermaid diagram of the diagonal argument's table and the constructed contradiction.
- **Lab** — implement a bounded halting checker (`haltsWithin(machine, input, steps)`), then
  demonstrate that removing the bound is impossible by constructing the diagonal machine against any
  proposed total decider the learner supplies; tests assert the contradiction is produced for any
  candidate.
- **Senior insight** — bounded halting is decidable and useful; unbounded is not. Nearly every
  practical tool in this space (timeouts, step budgets, fuel) is that substitution.

### 26.4 Reductions and Rice's theorem
- **Covers** — mapping reductions for undecidability, proving a problem undecidable by reducing
  halting to it, Rice's theorem and the sweeping consequence that every non-trivial semantic
  property of programs is undecidable, the syntactic escape hatch, and the practical fallout for
  static analysis, dead-code detection, type inference and termination checking.
- **Demo** — a reduction builder: choose a target problem, and the tool constructs the machine that
  reduces halting to it, then explains why a decider for the target would decide halting.
- **Diagram** — mermaid diagram of a mapping reduction and the contradiction it produces.
- **Lab** — prove "does this program ever print" undecidable by constructing the reduction in code
  (the reduction is a program transformation); tests assert the transformation's semantics match the
  specification on fixtures.
- **Senior insight** — Rice's theorem is why every static analyser is either unsound or incomplete,
  and knowing which one your tool chose is the difference between trusting a green build and
  understanding it.

### 26.5 Time complexity classes
- **Covers** — TIME and NTIME, P and NP revisited formally, EXPTIME, the time hierarchy theorem and
  what it proves (there are problems requiring more time), the polynomial-time Church–Turing
  thesis and its exceptions, and why P is used as the proxy for "tractable" despite n¹⁰⁰.
- **Demo** — a class navigator: pick a problem, see its known class membership, the best known
  algorithm, the best known lower bound, and the open questions, all rendered from a curated data
  file.
- **Diagram** — mermaid diagram of the time-class tower with the known strict separations marked.
- **Lab** — implement a padding argument showing a hierarchy-theorem-style separation for a
  simplified model; tests assert the constructed language is decidable in the larger bound and
  provably not in the smaller under the model's assumptions.
- **Senior insight** — the hierarchy theorems are among the few unconditional separations we have;
  everything else in complexity is "unless P = NP", and being precise about which is which is what
  makes a complexity claim credible.

### 26.6 Space complexity
- **Covers** — SPACE and NSPACE, L and NL, PSPACE and PSPACE-completeness (QBF, generalised games),
  Savitch's theorem, the relationship P ⊆ PSPACE and space-time trade-offs, NL = coNL
  (Immerman–Szelepcsényi), and reachability as the canonical NL-complete problem.
- **Demo** — a space-bounded machine simulator with a hard work-tape limit: solve reachability in
  log space by re-deriving instead of storing, with the recomputation cost counted against the
  memory saved.
- **Diagram** — mermaid diagram of Savitch's recursive midpoint search.
- **Lab** — implement log-space graph reachability (Savitch-style recursive midpoint) and measure
  its space usage against BFS; tests assert correctness and that the working memory stays within the
  logarithmic bound.
- **Senior insight** — space can be reused and time cannot, which is why space classes behave so
  differently; the practical version is that recomputation is a legitimate alternative to caching,
  and streaming systems make that trade constantly.

### 26.7 Randomised and interactive classes
- **Covers** — BPP, RP, co-RP and ZPP with their error definitions, amplification, BPP's relation to
  P (and the derandomisation conjecture), interactive proofs, IP = PSPACE at a conceptual level,
  Arthur–Merlin protocols, and probabilistically checkable proofs with the PCP theorem's statement
  and consequence for approximation.
- **Demo** — an interactive-proof game: the learner plays the verifier against a prover that may be
  lying, using the graph-non-isomorphism protocol, and watches the soundness error fall with each
  round.
- **Diagram** — mermaid sequence diagram of the graph-non-isomorphism interactive proof.
- **Lab** — implement the verifier for the graph-non-isomorphism protocol; tests assert an honest
  prover always convinces it and a dishonest one succeeds with probability at most 2^−k over k
  rounds.
- **Senior insight** — interactive proofs are the theory under zero-knowledge, verifiable
  computation and rollups: a weak verifier can check a claim it could never compute, which is a
  genuinely useful engineering pattern.

### 26.8 Circuits and non-uniform computation
- **Covers** — Boolean circuits, size and depth, circuit families and non-uniformity, P/poly and
  why it contains undecidable languages, AC⁰ and NC and the parallel-complexity reading, known
  lower bounds (parity not in AC⁰), the natural-proofs and relativisation barriers, and the link to
  hardware in M33.
- **Demo** — circuit builder: construct a circuit for a function, measure size and depth, compare
  against the same function as a formula and as a Turing machine, and see the parallel-time reading
  of depth.
- **Diagram** — mermaid diagram of a circuit's layered structure with depth annotated.
- **Lab** — build a constant-depth circuit family for a function in AC⁰ and show the size growth;
  tests assert correctness for all inputs at each width and record the size/depth trend.
- **Senior insight** — depth is latency and size is area — this is the same trade the ALU section in
  M33 makes physically, and it is why carry-lookahead exists.

### 26.9 Kolmogorov complexity and randomness
- **Covers** — descriptive complexity, the invariance theorem, incompressibility and the counting
  argument that most strings are random, the uncomputability of K, connections to entropy (M22),
  the minimum description length principle, Berry's paradox formalised, and Occam's razor as a
  formal statement.
- **Demo** — compressibility explorer: compare a string's compressed size under several codecs
  against its length, with the incompressibility bound shown; a "generate a random string" control
  demonstrates that almost all strings resist every codec.
- **Diagram** — mermaid diagram of the counting argument bounding how many strings can compress.
- **Lab** — empirically estimate K for a set of strings via the best available codec and demonstrate
  the counting bound; tests assert that at most 2^(n−k) strings of length n compress by k bits, by
  exhaustive check for small n.
- **Senior insight** — "compression as intelligence" and "the model that explains the data most
  briefly generalises best" are both MDL arguments, and this section is where they stop being
  slogans.

### 26.10 Quantum computation
- **Covers** — qubits, superposition and entanglement without mysticism, unitary gates and
  reversibility, measurement, the circuit model, Deutsch–Jozsa as the smallest speed-up,
  Grover's quadratic search, Shor's factoring algorithm and its consequence for RSA and ECC, BQP's
  relationship to P and NP (and the fact that BQP is not known to contain NP), error correction and
  the physical reality, and post-quantum cryptography's timeline.
- **Demo** — a small state-vector simulator: build a circuit from gates, watch amplitudes and
  measurement probabilities update, run Deutsch–Jozsa and Grover on 3–4 qubits and see the amplitude
  amplification per iteration.
- **Diagram** — mermaid diagram of a quantum circuit with the measurement stage marked.
- **Lab** — implement Grover's diffusion operator on a state-vector simulator; tests assert the
  marked state's probability follows the predicted sin²((2k+1)θ) curve and peaks at the expected
  iteration count.
- **Senior insight** — quantum computers do not brute-force NP; Grover's quadratic speed-up means
  doubling symmetric key sizes suffices, while Shor's exponential speed-up is what actually breaks
  RSA and ECC. That asymmetry is the entire post-quantum migration plan.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/turing-machine.js` | Tape, head, transitions, multi-tape, budgets, traces |
| `src/js/machines/model-zoo.js` | Counter machine, RAM, cellular automaton, tag system, SKI |
| `src/js/algorithms/undecidability.js` | Diagonal construction, mapping reductions, Rice instances |
| `src/js/algorithms/space-bounded.js` | Savitch-style reachability with measured working memory |
| `src/js/algorithms/interactive-proofs.js` | Verifier implementations with soundness accounting |
| `src/js/algorithms/circuits.js` | Circuit construction, size/depth measurement, evaluation |
| `src/js/algorithms/kolmogorov.js` | Compressibility estimation and counting-bound checks |
| `src/js/algorithms/quantum-sim.js` | State-vector simulator, standard gates, Grover, Deutsch–Jozsa |
| `src/js/content/complexity-atlas.js` | Curated problem → class → best-known-bound data |

---

## Acceptance criteria

- [ ] Every Turing machine program terminates within its declared step budget or is explicitly
      labelled non-halting; the simulator never hangs the page.
- [ ] Model equivalences are demonstrated by execution: a program translated between models computes
      the same function on all tested inputs.
- [ ] The diagonal construction produces a contradiction against any learner-supplied "total
      decider", asserted in tests.
- [ ] The log-space reachability lab's working memory is measured, not claimed.
- [ ] The interactive-proof verifier's soundness error is measured over many dishonest-prover runs
      and matches 2^−k.
- [ ] The quantum simulator's amplitudes are validated against analytic values for all fixture
      circuits, and Grover's peak iteration count matches the formula.

---

## Sources

- Sipser — *Introduction to the Theory of Computation*
- Arora, Barak — *Computational Complexity: A Modern Approach*
- Turing — *On computable numbers, with an application to the Entscheidungsproblem*
- Rice — *Classes of recursively enumerable sets and their decision problems*
- Savitch — *Relationships between nondeterministic and deterministic tape complexities*
- Li, Vitányi — *An Introduction to Kolmogorov Complexity and Its Applications*
- Nielsen, Chuang — *Quantum Computation and Quantum Information*
- Aaronson — *Quantum Computing Since Democritus*
