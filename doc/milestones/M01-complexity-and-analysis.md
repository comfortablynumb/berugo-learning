# M01 — Complexity, analysis and benchmarking methodology

> **Track** Platform · **Depends on** M00 · **Sections** 9 · **Effort** M

**Outcome.** The vocabulary and the measuring instruments the rest of the site uses. A senior
engineer knows big-O; what they usually lack is the discipline to tell an asymptotic claim from a
measured one, and the habit of checking which one the situation actually calls for.

**Shared machinery introduced.** `utils/ops-counter.js` (instrumented comparator, swap counter,
array proxy), `viz/plot.js` growth plots with log axes, `algorithms/curve-fit.js` (least squares
over a candidate basis), `components/bench-panel.js` (repeat, warm up, report median and MAD).
Every later milestone that shows a cost curve uses these.

---

## Sections

### 1.1 Asymptotic notation, precisely
- **Covers** — O, Ω, Θ, o, ω as sets of functions; the limit definitions; why `f = O(g)` is an
  abuse of notation; transitivity and the arithmetic that does and does not hold; common false
  friends (`O(n log n)` vs `O(log n!)`, `2^{n+1}` vs `2^n`, `O(n^2)` inside a loop).
- **Demo** — two functions plotted with adjustable constants and a draggable n₀; the panel states
  whether the witness pair (c, n₀) currently satisfies the definition, and highlights the crossover.
- **Diagram** — mermaid graph of the containment hierarchy of the standard growth classes.
- **Lab** — implement `isBigO(f, g, c, n0, upTo)` as an empirical checker; implement `dominates`
  over a small symbolic representation of `n^a (log n)^b c^n`.
- **Senior insight** — asymptotics describe a limit, and production inputs are rarely in it. The
  notation is a tool for ruling things out, not for predicting runtime.

### 1.2 Recurrences
- **Covers** — substitution with induction, recursion trees, the master theorem and all three
  cases plus the regularity condition, the gap cases it cannot handle, Akra–Bazzi for uneven
  splits, and linear recurrences with characteristic roots.
- **Demo** — recursion-tree builder: set the split factor, branching and merge cost; the tree
  renders level by level with per-level work, the geometric series is summed live, and the master
  case is identified and explained.
- **Diagram** — mermaid tree for T(n) = aT(n/b) + f(n) with per-level totals annotated.
- **Lab** — solve five recurrences by writing a `levelWork(level)` function; the harness compares
  the summed series against the closed form the exercise expects.
- **Senior insight** — the master theorem is a lookup table for one shape. Recursion trees are the
  method; learn to draw them and you never need to remember which case is which.

### 1.3 Amortised analysis
- **Covers** — aggregate, accounting and potential methods; dynamic array growth and why the
  factor matters; the difference between amortised and average-case; when amortised is not good
  enough (latency-sensitive paths, real-time systems).
- **Demo** — dynamic array with adjustable growth factor and an operation trace: bar chart of
  per-operation cost with the amortised average overlaid, plus a running potential function
  Φ = 2·size − capacity displayed as a credit balance.
- **Diagram** — mermaid state diagram of push → grow → copy with the credit flow annotated.
- **Lab** — implement `DynamicArray` with a configurable growth factor; the tests assert the total
  copy count stays within the amortised bound for 10⁵ pushes and that shrinking does not thrash.
- **Senior insight** — growth factor 2 versus 1.5 is a memory-reuse argument, not a speed one;
  1.5 lets the allocator reuse freed blocks. This is the whole reason several standard libraries
  disagree.

### 1.4 Average-case and probabilistic analysis
- **Covers** — indicator random variables, linearity of expectation, expected comparisons in
  randomised quicksort, the birthday bound, expected chain length in hashing, concentration
  intuition (Markov, Chebyshev, Chernoff without the algebra ceremony), and the difference between
  a randomised algorithm and an assumption about the input.
- **Demo** — sampling laboratory: run an algorithm N times over random inputs, plot the histogram
  of the counted operations against the predicted expectation and the tail bound.
- **Diagram** — mermaid flowchart separating "random input, deterministic algorithm" from
  "arbitrary input, randomised algorithm".
- **Lab** — estimate the expected number of comparisons of randomised quicksort by simulation and
  compare with 2n ln n; implement the indicator-variable derivation as a closed-form function.
- **Senior insight** — "average case" silently assumes a distribution over inputs that your
  adversary, or your users, may not honour. Randomising the algorithm moves the assumption from
  the world to your own coin.

### 1.5 Lower bounds and adversary arguments
- **Covers** — decision-tree lower bound for comparison sorting, information-theoretic counting
  arguments, adversary arguments for finding max and second max, the 3n/2 bound for min-and-max,
  and why lower bounds are what stop you optimising forever.
- **Demo** — decision-tree explorer for n = 3 and n = 4 permutations: every comparison splits the
  set of consistent permutations; the panel shows the remaining candidates and the minimum height
  ⌈log₂ n!⌉ against the tree the learner's comparison order produces.
- **Diagram** — mermaid decision tree for sorting three elements.
- **Lab** — write an adversary that forces any comparison-based max-finder to use n−1 comparisons;
  the harness plays it against the learner's algorithm.
- **Senior insight** — a lower bound tells you when to stop tuning and start changing the model:
  radix sort beats the bound by not being comparison-based.

### 1.6 Constants, cache and the failure of asymptotics
- **Covers** — why insertion sort beats merge sort under ~32 elements, cache-line effects,
  branch misprediction cost, allocation cost, why linked lists lose to arrays at nearly every size,
  and how library sorts hybridise as a result.
- **Demo** — crossover finder: two implementations, an input-size sweep, and the measured crossover
  point with a marker; the operation counters and the wall clock are plotted side by side so the
  learner can see them disagree.
- **Diagram** — mermaid flowchart of a hybrid sort's dispatch policy.
- **Lab** — tune the insertion-sort cutoff inside a provided merge sort to minimise measured time
  on a fixed workload; the harness reports the median of repeated runs.
- **Senior insight** — the same asymptotic class can differ by 50× in practice. Ranking algorithms
  by exponent is a first filter, never a decision.

### 1.7 Space complexity and working set
- **Covers** — auxiliary versus total space, in-place definitions and how loosely the word is
  used, recursion stack depth, tail calls, streaming versus batch, and the working-set idea that
  the memory-hierarchy milestone later makes concrete.
- **Demo** — memory profile of the same task written three ways (materialised, chunked, streaming):
  a live peak-memory bar and an allocation timeline driven by an instrumented allocator.
- **Diagram** — mermaid comparison of the three dataflow shapes.
- **Lab** — rewrite a materialising pipeline as a generator chain; tests assert identical output
  and a peak-allocation count below a threshold.
- **Senior insight** — space is usually the constraint that actually bites in production, and it
  is the one most job-interview algorithm practice ignores.

### 1.8 Empirical complexity
- **Covers** — the doubling experiment, log–log slope estimation, fitting candidate curves and
  choosing between them, residual inspection, and how to detect that you measured the wrong thing
  (warm cache, dead-code elimination, an input generator that is itself quadratic).
- **Demo** — doubling lab: run any registered algorithm across sizes, view the ratio table
  (T(2n)/T(n)), the log–log fit with the estimated exponent, and the best-fitting curve from the
  candidate set with its residuals.
- **Diagram** — mermaid flowchart of the doubling method and its failure checks.
- **Lab** — given three unlabelled implementations, identify each one's complexity class from
  measurements alone; graded against the hidden truth.
- **Senior insight** — a doubling table settles arguments that a code review cannot, and it takes
  four minutes.

### 1.9 Benchmarking methodology
- **Covers** — warm-up and JIT tiering, dead-code elimination defeating a microbenchmark, GC
  pauses, timer resolution and clamping, run-to-run variance, median and MAD versus mean and
  standard deviation, statistical significance for A/B comparisons, and how to report a result so
  another person can refute it.
- **Demo** — a benchmark harness the learner can misuse deliberately: toggles for warm-up,
  result-consumption (sink), iteration count and outlier trimming, with a distribution plot showing
  how each mistake changes the reported number.
- **Diagram** — mermaid sequence of a correct measurement run: warm up, measure, sink, repeat,
  aggregate, report.
- **Lab** — fix a broken benchmark whose loop body is optimised away; the test passes when the
  measured cost scales with input size instead of staying flat.
- **Senior insight** — the most common benchmarking bug is measuring nothing at all, and it always
  produces impressively fast numbers.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/utils/ops-counter.js` | Instrumented comparator, swap and array proxy with read/write counts |
| `src/js/algorithms/curve-fit.js` | Least-squares fit over a candidate growth basis; residuals |
| `src/js/algorithms/recurrence.js` | Recursion-tree expansion, master-theorem classification |
| `src/js/algorithms/decision-tree-bound.js` | Permutation-consistency tracking for 1.5 |
| `src/js/machines/bench-harness.js` | Warm-up, repetition, sink, trimming, median and MAD |
| `src/js/viz/growth-plot.js` | Linear and log–log plots with crossover markers |
| `src/js/viz/recursion-tree-view.js` | Per-level work tree |
| `src/js/components/bench-panel.js` | Reusable measurement panel used by every later milestone |

---

## Acceptance criteria

- [ ] Every measured number on screen names its counter or states "median of N runs".
- [ ] The master-theorem classifier is unit tested against all three cases, the regularity failure
      and two gap cases where it must decline to answer.
- [ ] `curve-fit` recovers the exponent of synthetic n, n log n, n², 2ⁿ data within 5%.
- [ ] The amortised-analysis demo's credit balance never goes negative, asserted as a property
      over 10⁵ randomised operations.
- [ ] The adversary in 1.5 defeats every comparison-based max-finder the tests throw at it.
- [ ] Content coverage test passes for all nine sections.

---

## Sources

- Cormen, Leiserson, Rivest, Stein — *Introduction to Algorithms*, chapters 3, 4, 17
- Sedgewick, Wayne — *Algorithms*, the doubling-experiment method
- Akra, Bazzi — *On the solution of linear recurrence equations*
- Georges, Buytaert, Eeckhout — *Statistically rigorous Java performance evaluation*
- Gil, Lenz, Shimron — *A microbenchmark case study and lessons learned*
