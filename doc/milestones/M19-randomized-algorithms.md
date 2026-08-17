# M19 — Randomised and approximation algorithms

> **Track** Algorithms · **Depends on** M11, M17 · **Sections** 9 · **Effort** M

**Outcome.** Two ways of beating problems you cannot solve exactly and quickly: flip coins, or
settle for provably-close. Both come with guarantees, and the guarantees are the content — an
approximation without a ratio and a randomised algorithm without an error bound are just heuristics.

**Shared machinery introduced.** `machines/randomized-lab.js` — seeded repetition harness that runs
an algorithm N times and reports the empirical distribution of results and runtimes against the
theoretical bound; `machines/approx-lab.js` — computes the exact optimum by brute force or ILP for
small instances so every approximation ratio shown is measured, not assumed.

---

## Sections

### 19.1 Randomised algorithm design
- **Covers** — Las Vegas (always correct, random runtime) versus Monte Carlo (fixed runtime, random
  correctness), one-sided and two-sided error, amplification by repetition and the error decay,
  expectation versus concentration, and the difference between randomising the algorithm and
  assuming a random input.
- **Demo** — error-amplification lab: run a one-sided Monte Carlo algorithm k times and watch the
  measured failure rate fall as 2^−k, plotted against the bound; a Las Vegas variant shows the
  runtime distribution instead.
- **Diagram** — mermaid diagram of the two error models and how repetition affects each.
- **Lab** — convert a Monte Carlo primality check into a Las Vegas one and vice versa; tests assert
  the correctness and termination properties each variant claims.
- **Senior insight** — "randomised" is not "flaky": amplification makes the failure probability
  smaller than the chance of a cosmic-ray bit flip, and that is a defensible engineering position.

### 19.2 Random contraction and Karger's min cut
- **Covers** — edge contraction, Karger's algorithm and its 2/(n(n−1)) success probability, why
  repetition gives high probability, Karger–Stein's recursive improvement, and random sampling as a
  general graph-algorithm technique.
- **Demo** — contraction animated on a graph with the surviving cut highlighted; a repetition
  counter shows the empirical success rate converging to the theoretical bound as trials increase.
- **Diagram** — mermaid diagram of two vertices contracting into a supernode.
- **Lab** — implement Karger's contraction with a DSU and the repetition wrapper; tests assert the
  minimum cut is found with the claimed probability over many seeds, cross-checked against a
  max-flow min-cut computation from M14.
- **Senior insight** — an algorithm that succeeds with probability 1/n² is still practical if a run
  is cheap; the cost model is "expected total work", not "probability of one run".

### 19.3 Monte Carlo estimation and variance reduction
- **Covers** — estimating integrals, areas and probabilities by sampling, the 1/√N error rate and
  its dimension independence, confidence intervals, antithetic variates, control variates,
  importance sampling, stratified sampling, and quasi-Monte Carlo with low-discrepancy sequences.
- **Demo** — estimate a quantity with each variance-reduction technique in parallel; the error-
  versus-samples curves are plotted together and the achieved variance reduction is reported as a
  factor.
- **Diagram** — mermaid diagram of importance sampling reweighting samples from a proposal
  distribution.
- **Lab** — implement importance sampling for a rare-event probability; tests assert the estimate is
  within the confidence interval of an exact computation and that the variance is at least 10×
  lower than naive sampling.
- **Senior insight** — Monte Carlo error does not depend on dimension, which is why it wins in high
  dimensions and loses badly in one dimension where quadrature converges exponentially faster.

### 19.4 Markov chain Monte Carlo
- **Covers** — sampling from a distribution you can only evaluate up to a constant, the
  Metropolis–Hastings acceptance rule, detailed balance, Gibbs sampling, burn-in, autocorrelation
  and effective sample size, mixing time, and diagnosing a chain that has not converged.
- **Demo** — sample a 2-D distribution with adjustable proposal width: the trace plot,
  autocorrelation and acceptance rate all update, showing the too-small (slow mixing) and too-large
  (low acceptance) failure modes.
- **Diagram** — mermaid diagram of the propose–accept–reject loop with the detailed-balance
  condition stated.
- **Lab** — implement Metropolis–Hastings for a mixture distribution and compute the effective
  sample size; tests assert the sampled moments match the analytic ones within the interval implied
  by the effective sample size.
- **Senior insight** — a chain that has not mixed produces confident, wrong answers with a small
  standard error; the diagnostics are not optional, and effective sample size is the number that
  matters, not the sample count.

### 19.5 Fingerprinting and identity testing
- **Covers** — verifying rather than computing, Freivalds' algorithm for matrix-product checking in
  O(n²), polynomial identity testing and the Schwartz–Zippel lemma, randomised equality checking
  over a network with hashes, and Merkle-style verification (previewing M54).
- **Demo** — Freivalds' verification of a deliberately corrupted matrix product: the detection
  probability rises with each independent trial, plotted against 1 − 2^−k.
- **Diagram** — mermaid diagram of the verification identity A(Bx) = (AB)x.
- **Lab** — implement Freivalds' algorithm and a Schwartz–Zippel identity test; tests assert
  detection of injected errors within the stated probability over many seeds and no false alarms on
  correct inputs.
- **Senior insight** — verifying a result can be asymptotically cheaper than producing it, which is
  the foundation of every "trust but verify" distributed protocol.

### 19.6 Approximation algorithms and ratios
- **Covers** — the approximation-ratio definition for minimisation and maximisation, 2-approximate
  vertex cover by maximal matching, greedy set cover and its ln n bound with the tightness example,
  metric TSP 2-approximation via MST, Christofides' 3/2 bound, k-centre greedy, and load balancing
  by list scheduling.
- **Demo** — run each approximation next to the exact optimum from `approx-lab` on small instances:
  the measured ratio distribution is plotted against the proven bound, and the worst-case instance
  for each algorithm is one click away.
- **Diagram** — mermaid diagram of the MST-doubling argument for metric TSP.
- **Lab** — implement greedy set cover and the tight instance generator; tests assert the ratio
  bound holds on random instances and that the generated instance actually attains close to ln n.
- **Senior insight** — the ratio is worst case. Greedy set cover is usually within a few percent of
  optimal in practice, and knowing both facts is what lets you ship it.

### 19.7 LP relaxation and rounding
- **Covers** — integer programs and their linear relaxations, the integrality gap, deterministic
  rounding for vertex cover, randomised rounding for set cover and MAX-SAT, the primal–dual method,
  and a conceptual account of the SDP-based 0.878 MAX-CUT algorithm.
- **Demo** — an ILP instance and its relaxation solved side by side, showing the fractional
  solution, the rounding step and the resulting integral cost, with the integrality gap measured
  over many random instances.
- **Diagram** — mermaid diagram of a fractional vertex being rounded, with the feasibility check.
- **Lab** — implement randomised rounding for MAX-SAT with the derandomised fallback; tests assert
  the expected fraction of satisfied clauses meets the 1 − 1/e (and 3/4 combined) bound over many
  seeds.
- **Senior insight** — LP relaxation turns a modelling problem into a solved one: write the
  constraints honestly, relax, round, and you have a provable approximation without inventing an
  algorithm.

### 19.8 PTAS, FPTAS and the limits of approximation
- **Covers** — approximation schemes, the knapsack FPTAS by profit scaling, PTAS for Euclidean TSP
  at a conceptual level, APX-hardness, the PCP theorem's consequence that some problems admit no
  PTAS unless P = NP, and hardness of approximation results for set cover and MAX-3SAT.
- **Demo** — knapsack FPTAS with an ε slider: the scaled profits, the resulting solution quality and
  the runtime all update, tracing the ε ↔ time curve.
- **Diagram** — mermaid diagram of profit scaling shrinking the DP table.
- **Lab** — implement the knapsack FPTAS; tests assert the solution is within (1 − ε) of optimal for
  ε in {0.5, 0.1, 0.01} on random instances and that runtime scales as predicted.
- **Senior insight** — an FPTAS is the best possible outcome for an NP-hard problem: you name the
  error you can tolerate and pay for exactly that much accuracy.

### 19.9 Derandomisation
- **Covers** — the method of conditional expectations, pairwise independence and small sample
  spaces, k-wise independent hash families, derandomising MAX-CUT's random assignment, and the
  trade between randomness and running time.
- **Demo** — MAX-CUT solved by random assignment across many seeds (distribution shown) and then by
  conditional expectations (single deterministic run), with the deterministic result at or above
  the random mean every time.
- **Diagram** — mermaid decision tree of the conditional-expectation greedy choice per vertex.
- **Lab** — derandomise the random MAX-CUT assignment using conditional expectations; tests assert
  the deterministic cut is at least |E|/2 on every fixture, which the random version only achieves
  in expectation.
- **Senior insight** — "in expectation" can often be converted into "always" mechanically; the
  conditional-expectation argument is a proof technique that turns directly into code.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/karger.js` | Contraction min cut and Karger–Stein |
| `src/js/algorithms/monte-carlo.js` | Estimators, variance reduction, low-discrepancy sequences |
| `src/js/algorithms/mcmc.js` | Metropolis–Hastings, Gibbs, diagnostics, effective sample size |
| `src/js/algorithms/fingerprinting.js` | Freivalds, Schwartz–Zippel, hash-based equality |
| `src/js/algorithms/approximation.js` | Vertex cover, set cover, TSP, Christofides, k-centre |
| `src/js/algorithms/lp-rounding.js` | Relaxation, deterministic and randomised rounding, primal–dual |
| `src/js/algorithms/fptas.js` | Knapsack scaling scheme |
| `src/js/algorithms/derandomize.js` | Conditional expectations, k-wise independent families |
| `src/js/machines/randomized-lab.js` | Seeded repetition, empirical distributions versus bounds |
| `src/js/machines/approx-lab.js` | Exact optima for small instances, ratio measurement |

---

## Acceptance criteria

- [ ] Every randomised algorithm is run over at least 200 seeds, and the empirical failure rate is
      asserted against the theoretical bound rather than eyeballed.
- [ ] Every approximation algorithm's measured ratio is compared against the exact optimum on all
      small instances, and the worst-case generator produces a ratio close to the proven bound.
- [ ] MCMC diagnostics report effective sample size, and the tests use it to size their tolerance.
- [ ] The knapsack FPTAS meets its (1 − ε) guarantee for every tested ε, with runtime scaling
      measured.
- [ ] Derandomised MAX-CUT meets the |E|/2 bound deterministically on every fixture.
- [ ] All demos state whether a shown result is a bound, an expectation or a measurement.

---

## Sources

- Motwani, Raghavan — *Randomized Algorithms*
- Mitzenmacher, Upfal — *Probability and Computing*
- Karger — *Global min-cuts in RNC*; Karger, Stein — *A new approach to the minimum cut problem*
- Vazirani — *Approximation Algorithms*
- Williamson, Shmoys — *The Design of Approximation Algorithms*
- Freivalds — *Probabilistic machines can use less running time*
- Goemans, Williamson — *Improved approximation algorithms for maximum cut* (SDP)
