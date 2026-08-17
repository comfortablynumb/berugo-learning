# M20 — NP-completeness, reductions and metaheuristics

> **Track** Algorithms · **Depends on** M13, M19 · **Sections** 9 · **Effort** M

**Outcome.** The ability to recognise a hard problem, prove it hard, and then ship something anyway.
Most senior engineers can define NP-complete and few can build a reduction or choose between
exact-exponential, parameterised, heuristic and solver-based approaches — this milestone is about
the second half.

**Shared machinery introduced.** `machines/reduction-lab.js` extended (from M14) with a
verification harness: every reduction must map an instance forward, solve the target, map the
solution back and validate it against the source instance; `machines/heuristic-lab.js` — a
tournament harness that runs every metaheuristic on the same instances under the same evaluation
budget and reports solution quality over time.

---

## Sections

### 20.1 Decision problems, P, NP and certificates
- **Covers** — decision versus search versus optimisation forms, the formal definitions of P and NP,
  verifiers and certificates, why "checkable in polynomial time" is the useful definition, co-NP and
  the asymmetry of proving unsatisfiability, NP-hard versus NP-complete, and the actual content of
  the P vs NP question.
- **Demo** — certificate checker: for each of six problems, supply a candidate certificate and watch
  the polynomial-time verifier accept or reject, with the verification cost counted; the search
  version is run alongside to contrast the effort.
- **Diagram** — mermaid diagram of the P / NP / NP-complete / NP-hard containment picture with the
  open question marked.
- **Lab** — implement verifiers for Hamiltonian cycle, subset sum and 3-colouring; tests assert each
  accepts valid certificates, rejects invalid ones, and runs in polynomial time as measured by the
  step counter.
- **Senior insight** — the practical reading of NP is "easy to check, hard to find", and that gap is
  what makes proof-of-work, puzzle-based auth and verifiable computation possible at all.

### 20.2 Reductions
- **Covers** — polynomial-time many-one reduction, the direction of the arrow and the mistake
  everyone makes with it, gadget construction, proving NP-hardness by reduction from a known-hard
  problem, reduction as a modelling tool rather than only a proof device, and Turing reductions.
- **Demo** — reduction viewer: pick a reduction (3-SAT → clique, vertex cover → set cover, 3-SAT →
  3-colouring), see the source instance, the constructed gadgets and the target instance side by
  side, then solve the target and watch the solution map back.
- **Diagram** — mermaid diagram of a clause gadget in the 3-SAT → clique reduction.
- **Lab** — implement the 3-SAT → independent set reduction with the solution mapping back; tests
  assert satisfiable instances map to instances with the required independent-set size and
  unsatisfiable ones do not.
- **Senior insight** — the arrow points from the problem you want to *solve* to the problem you can
  *call*. Getting it backwards proves nothing, and it is the most common error in hardness
  arguments.

### 20.3 SAT and the NP-complete zoo
- **Covers** — the Cook–Levin theorem and its idea (encode a computation as a formula), CNF and
  3-CNF, the standard reduction chain from 3-SAT through clique, vertex cover, Hamiltonian cycle,
  subset sum, partition and 3-colouring, and the boundaries (2-SAT, Horn-SAT and XOR-SAT are
  polynomial).
- **Demo** — the reduction chain as a navigable graph: click any edge to see the gadget and run the
  reduction on a live instance; the polynomial islands (2-SAT, Horn-SAT) are marked and their
  algorithms runnable.
- **Diagram** — mermaid graph of the reduction chain from Cook–Levin outward.
- **Lab** — implement Horn-SAT satisfiability by unit propagation in linear time; tests assert
  agreement with a brute-force checker and correct handling of empty and contradictory clause sets.
- **Senior insight** — the polynomial special cases matter more day to day than the hardness result:
  a great deal of real configuration and dependency logic is Horn-SAT, which is why package
  resolvers can be fast.

### 20.4 Beyond NP
- **Covers** — PSPACE and quantified Boolean formulas, games and two-player reachability as the
  canonical PSPACE-complete problems, EXPTIME, the polynomial hierarchy and what a Σ₂ problem looks
  like in practice (minimisation with an adversary), counting classes (#P) and the hardness of
  counting solutions, and where common problems actually sit.
- **Demo** — a small QBF instance evaluated as a game tree with alternating quantifiers shown as
  players; the same formula with all quantifiers existential is solved as plain SAT for comparison.
- **Diagram** — mermaid diagram of the complexity-class containment tower.
- **Lab** — implement a QBF evaluator by recursive quantifier expansion; tests assert results
  against a truth-table oracle for small variable counts.
- **Senior insight** — "find the smallest configuration that no adversary can break" is a Σ₂
  problem, which is why security-hardening optimisation is qualitatively harder than plain
  optimisation, not just bigger.

### 20.5 Exact exponential and parameterised algorithms
- **Covers** — when exponential is acceptable, branch and reduce with measured branching factors,
  inclusion–exclusion for counting, DP over subsets (from M12), fixed-parameter tractability,
  kernelisation with the vertex-cover kernel as the worked example, treewidth and DP over tree
  decompositions, and the W-hierarchy at a high level.
- **Demo** — vertex cover solved by brute force, by branch-and-reduce and by kernelisation plus
  search on the same instances, with node counts and kernel sizes reported; a parameter slider
  shows the O(1.47^k · n) behaviour.
- **Diagram** — mermaid diagram of the kernelisation rules shrinking an instance before search.
- **Lab** — implement the high-degree and degree-1 kernelisation rules for vertex cover; tests
  assert the kernel has at most k² edges and that the optimum is preserved exactly.
- **Senior insight** — "NP-hard" says nothing about your instance size. Parameterised complexity is
  the honest framing: exponential in the parameter you actually control, polynomial in the data.

### 20.6 Heuristics and metaheuristics
- **Covers** — constructive heuristics and local search, neighbourhood design, 2-opt and
  or-opt for TSP, simulated annealing with cooling schedules, tabu search with memory, genetic
  algorithms (encoding, crossover, mutation, selection pressure), ant colony optimisation, GRASP,
  and how to compare heuristics honestly under a fixed budget.
- **Demo** — the metaheuristic tournament: all methods attack the same TSP or scheduling instance
  under one evaluation budget, with best-so-far curves plotted together and the exact optimum drawn
  as a line where it is known.
- **Diagram** — mermaid diagram of a local-search landscape with basins, plateaus and the escape
  mechanisms each method uses.
- **Lab** — implement simulated annealing with a cooling schedule for TSP; tests assert the tour is
  valid, that the result beats a nearest-neighbour construction on all fixtures, and that
  temperature-zero behaviour degenerates to hill climbing.
- **Senior insight** — comparing metaheuristics by "best result found" without fixing the evaluation
  budget is meaningless, and it is how most published comparisons are done.

### 20.7 Using solvers instead of algorithms
- **Covers** — encoding a problem into SAT, ILP or CP, the encoding-quality effect on solve time
  (naive versus commander versus sequential at-most-one encodings), symmetry breaking, warm starts,
  incremental solving, reading a solver's proof or infeasibility certificate, and knowing when the
  solver is the right answer.
- **Demo** — the same scheduling problem encoded three ways and handed to the SAT solver built in
  M32 (or a bundled DPLL implementation until then): clause counts, decision counts and solve times
  compared.
- **Diagram** — mermaid flowchart of the model → encode → solve → decode pipeline.
- **Lab** — encode graph colouring into CNF with an at-most-one constraint of your choice; tests
  assert satisfiability agreement with a direct colouring algorithm and report the clause count for
  each encoding.
- **Senior insight** — for most NP-hard problems in industry the correct move is to encode and call
  a solver; the engineering effort goes into the encoding, and a good encoding beats a clever
  hand-written search almost every time.

### 20.8 Hardness in practice
- **Covers** — worst case versus typical case, phase transitions in random 3-SAT around the
  clause-to-variable ratio of 4.27, generating genuinely hard instances, backdoors and structure in
  real-world instances, why industrial SAT instances with millions of variables solve in seconds,
  and heavy-tailed runtime distributions with restarts as the fix.
- **Demo** — phase-transition explorer: generate random 3-SAT across clause ratios, plot the
  satisfiable fraction and the median solve time, and watch the hardness spike at the crossover.
- **Diagram** — mermaid diagram relating clause ratio, satisfiability probability and solve time.
- **Lab** — implement a random-restart wrapper around a stochastic local-search solver; tests assert
  the restart strategy's median solve time is lower than the no-restart version on the heavy-tailed
  fixture.
- **Senior insight** — heavy-tailed runtimes mean an unlucky run can be 1000× the median; restarts
  turn that into a bounded expectation, which is the same argument as hedged requests in M57.

### 20.9 Reduction workshop
- **Covers** — modelling real problems as known problems: shift scheduling as colouring or ILP,
  dependency resolution as SAT, resource allocation as flow or matching, routing as TSP variants,
  layout as quadratic assignment, and the discipline of checking whether the real constraints
  actually match the model's.
- **Demo** — the workshop: pick a real-world scenario, choose a target formulation, and the lab
  builds the instance, solves it, maps back and validates — including showing where the model
  diverges from the stated requirements.
- **Diagram** — mermaid flowchart from requirements to a chosen formulation with the assumptions
  labelled.
- **Lab** — model a nurse-rostering scenario as an ILP and validate the returned schedule against
  every stated constraint; graded on constraint satisfaction, not just solver output.
- **Senior insight** — the failure mode is not a slow solver, it is a model that quietly does not
  represent the requirement; validating the mapped-back solution against the original constraints is
  the only defence.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/np-verifiers.js` | Certificate verifiers for the standard problems |
| `src/js/algorithms/reductions.js` | Gadget-based reductions with forward and backward maps |
| `src/js/algorithms/sat-basics.js` | CNF representation, DPLL, unit propagation, Horn-SAT, 2-SAT bridge |
| `src/js/algorithms/qbf.js` | Quantifier expansion evaluator |
| `src/js/algorithms/fpt.js` | Branch and reduce, kernelisation, treewidth DP |
| `src/js/algorithms/metaheuristics.js` | Local search, annealing, tabu, genetic, ACO, GRASP |
| `src/js/algorithms/encodings.js` | At-most-one encodings, symmetry breaking, ILP builders |
| `src/js/algorithms/instance-generators.js` | Random 3-SAT at controlled ratios, hard fixtures |
| `src/js/machines/reduction-lab.js` | Round-trip verification of every reduction |
| `src/js/machines/heuristic-lab.js` | Budgeted tournament harness with best-so-far curves |

---

## Acceptance criteria

- [ ] Every reduction round-trips: the mapped-back solution is validated against the source
      instance's constraints in a test, for both satisfiable and unsatisfiable cases.
- [ ] Verifiers are asserted polynomial by the step counter, not by inspection.
- [ ] Kernelisation preserves the exact optimum on all fixtures, verified against brute force.
- [ ] Every metaheuristic comparison fixes the evaluation budget, and the harness fails the run if
      budgets differ.
- [ ] The phase-transition demo reproduces the hardness peak near ratio 4.27 with measured data.
- [ ] Encoding comparisons report clause counts and solve statistics, and all encodings are asserted
      equisatisfiable.

---

## Sources

- Garey, Johnson — *Computers and Intractability*
- Cook — *The complexity of theorem-proving procedures*; Levin — the independent result
- Karp — *Reducibility among combinatorial problems*
- Arora, Barak — *Computational Complexity: A Modern Approach*
- Cygan et al. — *Parameterized Algorithms*
- Cheeseman, Kanefsky, Taylor — *Where the really hard problems are* (phase transitions)
- Gomes, Selman, Kautz — *Boosting combinatorial search through randomization* (restarts)
