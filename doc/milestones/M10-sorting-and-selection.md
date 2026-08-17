# M10 — Sorting, selection and searching

> **Track** Algorithms · **Depends on** M01, M05 · **Sections** 10 · **Effort** L

**Outcome.** Sorting taught as an engineering subject rather than a list of algorithms: stability,
adaptivity, pivot pathologies, the hybrid designs real libraries ship, and the binary search that
almost everyone writes wrong at least once.

**Shared machinery introduced.** `machines/sort-lab.js` — one input generator set (random, sorted,
reversed, nearly sorted, few-unique, organ-pipe, adversarial-for-quicksort) driving every
implementation with comparison, swap, move and allocation counters; `viz/array-view.js` — the
animated bar/box array renderer used by every algorithm milestone that follows.

---

## Sections

### 10.1 The sorting contract
- **Covers** — stability and when it is load-bearing (multi-key sorts, UI tables), in-place versus
  out-of-place, adaptivity to existing order, the comparison model, comparator contracts
  (irreflexive, antisymmetric, transitive) and what breaks when one is violated, and insertion,
  selection and bubble sort as the small-n baselines.
- **Demo** — the elementary sorts animated side by side over the same input, with counters; a
  "broken comparator" toggle that shows a real library sort producing garbage or throwing.
- **Diagram** — mermaid decision tree for choosing a sort by input property.
- **Lab** — implement a stable insertion sort and a two-key sort built from it; tests assert
  stability explicitly by tagging equal keys with their original index.
- **Senior insight** — an inconsistent comparator is undefined behaviour in most standard libraries;
  in JavaScript it silently produces a wrong order, which is worse.

### 10.2 Merge sort and its variants
- **Covers** — top-down and bottom-up merge, the merge step and its buffer, stability by
  construction, natural merge sort exploiting existing runs, in-place merging (rotation-based) and
  its cost, and the k-way merge that external sorting needs.
- **Demo** — merge sort with the recursion tree drawn alongside the array; the run detector
  highlights natural runs on nearly-sorted input and the level count drops visibly.
- **Diagram** — mermaid tree of the divide phase with merge widths annotated.
- **Lab** — implement bottom-up merge sort with a single reusable buffer; tests assert stability,
  correctness and exactly one auxiliary allocation.
- **Senior insight** — merge sort's real advantage is not the guaranteed bound, it is that the merge
  step is sequential, which makes it the only viable choice once the data exceeds memory.

### 10.3 Quicksort
- **Covers** — Lomuto versus Hoare partitioning and the off-by-one traps in each, pivot selection
  (first, random, median-of-three, ninther), the all-equal-elements disaster and three-way
  partitioning, tail-recursion elimination, worst-case input construction, and introsort's depth
  limit.
- **Demo** — partition scheme picker with the pointer walk animated; an adversarial input generator
  that drives the chosen pivot rule into O(n²), with the recursion depth plotted.
- **Diagram** — mermaid flowchart of three-way (Dutch national flag) partitioning.
- **Lab** — implement Hoare partitioning correctly, then extend to three-way; tests assert
  correctness on all-equal input and a recursion depth below 2 log₂ n with random pivots.
- **Senior insight** — quicksort's failure mode is a *quiet* quadratic: the sort still returns the
  right answer, just slowly, so it shows up as a latency incident rather than a bug report.

### 10.4 Library sorts: Timsort and pattern-defeating quicksort
- **Covers** — Timsort's run detection, minrun, the merge-stack invariants, galloping mode, and the
  2015 formal-verification result that found the invariant bug; pdqsort's pattern detection,
  partial insertion sort and deterministic fallback; introsort's heapsort escape hatch.
- **Demo** — Timsort over structured input with the run stack drawn and each merge decision
  explained against the invariants; a toggle reproduces the buggy invariant check and shows the
  stack growing past the bound.
- **Diagram** — mermaid state diagram of the merge-stack collapse rules.
- **Lab** — implement run detection with minrun and the merge-stack invariant check; tests assert
  the invariants hold after every push for randomised inputs.
- **Senior insight** — the Timsort bug is the best available argument for verifying invariants
  rather than testing them: it survived years in three standard libraries.

### 10.5 Non-comparison sorting
- **Covers** — counting sort and its key-range constraint, LSD versus MSD radix sort, American flag
  sort, bucket sort and its distribution assumption, sorting strings and variable-length keys,
  the Ω(n log n) bound escaped by using key structure, and when radix actually loses.
- **Demo** — radix sort with the digit passes animated and the bucket histogram per pass; a
  key-range slider showing where counting sort's memory becomes untenable.
- **Diagram** — mermaid flowchart of an LSD radix pass.
- **Lab** — implement LSD radix sort for 32-bit unsigned integers with a configurable radix; tests
  assert stability (required for LSD to work) and correctness including negative-number handling
  via bias.
- **Senior insight** — radix sort is stable-or-broken: an unstable digit pass silently destroys the
  ordering from previous passes, and the output looks almost right.

### 10.6 Selection and order statistics
- **Covers** — quickselect and its expected linear time, median of medians and the guaranteed
  bound with a bad constant, introselect, partial sorting, top-k with a heap versus quickselect,
  and the streaming case (link to M07).
- **Demo** — quickselect animated with the discarded partition shaded; a comparison table of
  expected comparisons for quickselect, median-of-medians and sort-then-index across sizes.
- **Diagram** — mermaid diagram of median-of-medians' groups-of-five recursion.
- **Lab** — implement quickselect with three-way partitioning; tests assert the k-th element
  matches a sorted reference for all k on randomised and all-equal input.
- **Senior insight** — "sort then take k" is O(n log n) and usually fine; the moment it is not, the
  answer is quickselect, not a fancier sort.

### 10.7 Binary search, correctly
- **Covers** — the invariant formulation that makes off-by-ones impossible, lower and upper bound
  semantics, the overflow bug in `(lo + hi) / 2`, searching in rotated and unimodal arrays,
  branchless and Eytzinger-layout search (from M02), interpolation search and its assumption, and
  exponential search on unbounded input.
- **Demo** — invariant tracker: each iteration shows the maintained invariant and the shrinking
  interval; a mutation panel introduces classic off-by-one bugs and shows exactly which inputs
  they break.
- **Diagram** — mermaid diagram of the half-open interval invariant across iterations.
- **Lab** — implement `lowerBound` and `upperBound` on a half-open interval; tests assert correct
  behaviour on empty arrays, all-equal arrays, and boundaries — the cases that catch every variant
  bug.
- **Senior insight** — Bentley's observation that most published binary searches were wrong is still
  true of most hand-written ones; writing the invariant down first is the entire fix.

### 10.8 Searching on the answer
- **Covers** — binary search over a monotone predicate rather than an array, the "minimise the
  maximum" pattern, feasibility checks, ternary search on unimodal functions, parametric search,
  and floating-point termination criteria.
- **Demo** — predicate explorer: define a feasibility function, see the boolean array it induces
  and the search converge; classic examples (allocate books, minimum capacity, aggressive cows)
  selectable.
- **Diagram** — mermaid flowchart of the predicate-monotonicity check that legitimises the search.
- **Lab** — solve "minimum ship capacity to ship packages in D days" by writing only the feasibility
  predicate; tests assert optimality against a brute-force scan on small inputs.
- **Senior insight** — the reframe is the skill: most optimisation questions with a monotone
  feasibility test are binary searches wearing a costume.

### 10.9 External, parallel and network sorting
- **Covers** — external merge sort with run generation and k-way merge, replacement selection for
  longer runs, I/O complexity in the external-memory model, sample sort, parallel merge, bitonic
  and odd-even sorting networks, and GPU sorting patterns.
- **Demo** — external sort simulator with a memory-size slider: run count, merge passes and total
  I/O reported; a bitonic network drawn with the comparator lattice and its depth.
- **Diagram** — mermaid diagram of a bitonic merge network for 8 inputs.
- **Lab** — implement a k-way merge using an indexed heap over run cursors; tests assert a fully
  sorted output and exactly one pass over each run.
- **Senior insight** — external sorting is the ancestor of every shuffle stage in a data pipeline;
  the parameter that matters is not CPU, it is the number of merge passes.

### 10.10 Sorting in practice
- **Covers** — JavaScript's `Array.prototype.sort` (stability guarantee since ES2019, default
  string comparison, comparator cost), sorting objects by extracted keys (Schwartzian transform),
  locale-aware collation and its cost, sorting for pagination and stable tie-breaking, and choosing
  a sort for a measured workload.
- **Demo** — the chooser: pick size, key type, existing order, duplicate rate and stability
  requirement; every implementation from this milestone runs and is ranked on measured operations
  and time.
- **Diagram** — mermaid decision flowchart from workload properties to algorithm.
- **Lab** — sort a table by three keys with correct tie-breaking and locale-aware string ordering;
  tests assert the exact expected order including accented characters.
- **Senior insight** — the default `sort` comparing stringified numbers is still one of the most
  common bugs in JavaScript code, and it survives review because `[1, 2, 10]` looks sorted until it
  is `[1, 10, 2]`.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/sorts-elementary.js` | Insertion, selection, bubble, shell |
| `src/js/algorithms/merge-sort.js` | Top-down, bottom-up, natural, k-way merge |
| `src/js/algorithms/quick-sort.js` | Lomuto, Hoare, three-way, introsort |
| `src/js/algorithms/timsort.js` | Run detection, merge stack, galloping |
| `src/js/algorithms/pdqsort.js` | Pattern detection, partial insertion sort |
| `src/js/algorithms/radix-sort.js` | LSD, MSD, counting, bucket, American flag |
| `src/js/algorithms/selection.js` | Quickselect, median of medians, introselect |
| `src/js/algorithms/binary-search.js` | Bounds, rotated, interpolation, exponential, branchless |
| `src/js/algorithms/external-sort.js` | Run generation, replacement selection, merge passes |
| `src/js/algorithms/sorting-networks.js` | Bitonic, odd-even, network depth analysis |
| `src/js/machines/sort-lab.js` | Input generators, counters, adversarial construction |
| `src/js/viz/array-view.js` | Animated array renderer with pointer overlays |
| `src/js/viz/network-view.js` | Comparator-network diagram |

---

## Acceptance criteria

- [ ] Every sort is verified against a reference sort on all generator inputs, with stability
      asserted for those that claim it and denied for those that do not.
- [ ] The adversarial generator drives median-of-three quicksort into quadratic behaviour, proven
      by a comparison count above n²/4, and introsort on the same input does not.
- [ ] Timsort's merge-stack invariants are checked after every push; the deliberately buggy variant
      fails the test.
- [ ] Binary-search tests include empty, single, all-equal, and boundary targets; every mutation in
      the mutation panel is caught by at least one test.
- [ ] Radix sort handles negatives and 32-bit boundaries; the instability variant fails.
- [ ] `sort-lab` reports comparisons, swaps, moves and allocations for every run, and the section
      text never quotes a time without a run count.

---

## Sources

- Knuth — *The Art of Computer Programming*, volume 3
- Bentley, McIlroy — *Engineering a sort function*
- Peters — the Timsort listsort description; de Gouw et al. — *OpenJDK's java.utils.Collection.sort() is broken*
- Orson Peters — *pdqsort: pattern-defeating quicksort*
- Bentley — *Programming Pearls*, the binary-search column
- Aggarwal, Vitter — *The input/output complexity of sorting and related problems*
- Batcher — *Sorting networks and their applications*
