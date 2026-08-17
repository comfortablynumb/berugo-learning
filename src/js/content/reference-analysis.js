/** Reference entries for the analysis sections (M01). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  const SOURCES = {
    clrs: { title: 'Introduction to Algorithms, chapters 3, 4, 17', where: 'Cormen, Leiserson, Rivest, Stein' },
    sedgewick: { title: 'Algorithms — the doubling-experiment method', where: 'Sedgewick, Wayne' },
    knuth: { title: 'The Art of Computer Programming, volume 3', where: 'Knuth' }
  };

  registry.register({
    'asymptotic-notation': {
      summary: 'O, Ω and Θ are sets of functions defined by a witness pair (c, n₀); membership is a ' +
        'claim that can be refuted with a single counter-example.',
      intuition: 'The notation exists to compare growth while ignoring machines, compilers and ' +
        'constants. That is its power and its limit: it tells you which algorithm eventually wins, ' +
        'and says nothing about whether your inputs are anywhere near "eventually". Treat it as a ' +
        'filter for ruling options out, then measure the survivors.',
      formulation: {
        equations: [
          { label: 'Big-O', expr: 'f = O(g) ⟺ ∃c > 0, n₀ > 0 : ∀n ≥ n₀, f(n) ≤ c·g(n)',
            terms: [{ sym: 'c', meaning: 'the witness constant, fixed once and for all' },
              { sym: 'n₀', meaning: 'the threshold past which the bound must hold' }] },
          { label: 'Omega and Theta', expr: 'f = Ω(g) ⟺ g = O(f);   Θ(g) = O(g) ∩ Ω(g)',
            terms: [{ sym: 'Θ', meaning: 'a tight bound: same growth up to constants' }] },
          { label: 'Little-o', expr: 'f = o(g) ⟺ lim_{n→∞} f(n)/g(n) = 0',
            terms: [{ sym: 'o', meaning: 'strictly smaller, for every constant rather than some constant' }] }
        ],
        derivation: [
          'O is an upper bound and need not be tight: every Θ(n) algorithm is also O(n²), truthfully.',
          'The witness must be a single pair for all n ≥ n₀; a constant that grows with n is not a witness, ' +
            'which is exactly why n² is not O(n log n).'
        ]
      },
      invariants: [
        { name: 'The witness is a single fixed pair', why: 'A c that depends on n proves nothing.', breaks: 'Whenever the required c grows without bound.' },
        { name: 'Only the tail matters', why: 'The definition starts at n₀, so finitely many inputs cannot refute it.', breaks: 'When your real inputs all sit below n₀.' },
        { name: 'Bounds compose but do not subtract', why: 'O(f) + O(g) = O(max(f, g)) is valid; O(f) − O(g) is not.', breaks: 'Cancelling terms inside big-O is a standard error.' }
      ],
      complexity: [
        { operation: 'Check a witness over [n₀, N]', average: 'O(N)', worst: 'O(N)', note: 'What the demo does: empirical, not a proof' },
        { operation: 'Find the smallest workable c', average: 'O(N)', worst: 'O(N)', note: 'max of f(n)/g(n) over the range' },
        { operation: 'Prove a bound', average: '—', worst: '—', note: 'Not decidable by measurement; needs algebra' }
      ],
      failureModes: [
        { symptom: '"It is O(n log n), so it will be fast"', cause: 'Confusing an asymptotic class with a runtime.', fix: 'Measure at your input sizes; see the crossover section.' },
        { symptom: 'Quoting O when Θ was meant', cause: 'O is an upper bound, so it is trivially satisfiable.', fix: 'State Θ when you mean tight, and Ω when arguing a floor.' },
        { symptom: 'A "proof" that breaks at large n', cause: 'The constant used was really a function of n.', fix: 'Write the witness explicitly and check it grows with nothing.' },
        { symptom: 'A profile disagrees with the complexity everyone agreed on', cause: 'The bound described one case and the workload is a different one - the sentence never said which.', fix: 'Put the case in the claim: insertion sort is Θ(n²) in the worst case and Θ(n) on sorted input, 499 500 comparisons against 999.' }
      ],
      inTheWild: [
        { system: 'Complexity tables in library docs', how: 'Almost always amortised or average, rarely labelled as such' },
        { system: 'Interview whiteboards', how: 'Θ expected, O accepted, constants ignored by convention' }
      ],
      sources: [SOURCES.clrs, SOURCES.knuth, { title: 'Big Omicron and big Omega and big Theta', where: 'Knuth, SIGACT News 1976' }]
    },

    recurrences: {
      summary: 'A recursion tree turns a recurrence into a sum over levels; the master theorem ' +
        'classifies the common shape and declines the rest.',
      intuition: 'Everything reduces to one question: does the work grow, stay flat, or shrink as you ' +
        'go down the tree? Growing means the leaves dominate, flat means the depth multiplies a ' +
        'constant per level, shrinking means the root dominates. The three master cases are those ' +
        'three answers, and drawing two levels of the tree tells you which you are in.',
      formulation: {
        equations: [
          { label: 'The shape', expr: 'T(n) = a·T(n/b) + f(n)',
            terms: [{ sym: 'a', meaning: 'subproblems per level' }, { sym: 'b', meaning: 'size divisor' },
              { sym: 'f(n)', meaning: 'work done outside the recursive calls' }] },
          { label: 'Level totals', expr: 'level i costs a^i · f(n / b^i), depth = log_b n, leaves = n^(log_b a)',
            terms: [{ sym: 'n^(log_b a)', meaning: 'the leaf count, and the critical growth rate' }] },
          { label: 'Master cases', expr: 'f = O(n^(log_b a − ε)) ⇒ Θ(n^log_b a);  f = Θ(n^log_b a log^p n) ⇒ Θ(n^log_b a log^(p+1) n);  f = Ω(n^(log_b a + ε)) with regularity ⇒ Θ(f)',
            terms: [{ sym: 'ε', meaning: 'a strictly positive gap — the reason the boundary cases fall through' }] }
        ],
        derivation: [
          'Case 2 with p = 0 is the merge-sort case: every level costs the same, so the total is depth × level cost.',
          'Case 3 needs a·f(n/b) ≤ c·f(n) for some c < 1: without it the root can fail to dominate despite growing faster.'
        ]
      },
      invariants: [
        { name: 'Levels multiply, depths add', why: 'Subproblem count multiplies by a per level while size divides by b.', breaks: 'For uneven splits, where Akra–Bazzi is needed instead.' },
        { name: 'The theorem covers one shape only', why: 'It assumes equal-sized subproblems and a polynomial-ish f.', breaks: 'For f = n/log n, or subproblems of different sizes.' },
        { name: 'Case 3 requires regularity', why: 'Otherwise f may not dominate despite being larger asymptotically.', breaks: 'For oscillating or non-monotone f.' }
      ],
      complexity: [
        { operation: 'Expand a tree to depth d', average: 'O(d)', worst: 'O(log_b n)', note: 'Level totals only, not per-node' },
        { operation: 'Classify by master theorem', average: 'O(1)', worst: 'O(1)', note: 'Compare k with log_b a' },
        { operation: 'Check regularity numerically', average: 'O(log n)', worst: 'O(log n)', note: 'Sample the ratio a·f(n/b)/f(n)' }
      ],
      failureModes: [
        { symptom: 'A recurrence the theorem "solves" wrongly', cause: 'It fell in a gap and was forced into the nearest case.', fix: 'Draw the tree; the level sums are always valid.' },
        { symptom: 'Off-by-one in the depth', cause: 'Counting levels rather than edges, or forgetting the leaf row.', fix: 'Check the total against a small n computed directly.' },
        { symptom: 'Ignoring the base case cost', cause: 'T(1) assumed zero when leaves do real work.', fix: 'n^(log_b a) leaves × leaf cost is a separate term.' },
        { symptom: 'The master theorem gives no answer at all', cause: 'The subproblems are different sizes, or f(n) falls in a gap between two cases.', fix: 'Draw the tree and bound it by its shortest and longest paths: T(n) = T(n/3) + T(2n/3) + n costs n per level over 6.31 to 17.10 levels, so it is Θ(n log n).' }
      ],
      inTheWild: [
        { system: 'Merge sort, binary search, Karatsuba', how: 'Case 2, case 2 with a = 1, and case 1 respectively' },
        { system: 'Median-of-medians', how: 'Uneven split, so Akra–Bazzi rather than the master theorem' }
      ],
      sources: [SOURCES.clrs, { title: 'On the solution of linear recurrence equations', where: 'Akra, Bazzi, 1998' }, { title: 'Concrete Mathematics, chapter 2 — sums and recurrences', where: 'Graham, Knuth, Patashnik' }]
    },

    'amortised-analysis': {
      summary: 'Amortised analysis bounds the average cost per operation over a worst-case sequence, ' +
        'with no probability anywhere in the argument.',
      intuition: 'A dynamic array is cheap almost always and expensive occasionally, and the expensive ' +
        'step is always paid for by the cheap ones that preceded it. Making that payment explicit — as ' +
        'banked credit or as a potential function — turns an intuition into a bound that holds against ' +
        'an adversary choosing the sequence.',
      formulation: {
        equations: [
          { label: 'Aggregate', expr: 'amortised = T(n) / n',
            terms: [{ sym: 'T(n)', meaning: 'total cost of the worst-case sequence' }] },
          { label: 'Potential method', expr: 'â_i = c_i + Φ(D_i) − Φ(D_{i−1}),  Φ ≥ 0, Φ(D_0) = 0',
            terms: [{ sym: 'Φ', meaning: 'stored work; for a doubling array, 2·size − capacity' },
              { sym: 'â_i', meaning: 'amortised cost of operation i' }] },
          { label: 'Doubling array total', expr: 'copies for n pushes = 1 + 2 + 4 + … < 2n',
            terms: [{ sym: '2n', meaning: 'the geometric sum, which is why the amortised cost is constant' }] }
        ],
        derivation: [
          'Σâ_i = Σc_i + Φ(D_n) − Φ(D_0) ≥ Σc_i when Φ ≥ 0, so the amortised total upper-bounds the real total.',
          'Growth factor r gives copies ≈ n/(r−1): factor 2 copies about n, factor 1.5 about 2n, and 1.5 lets ' +
            'the allocator reuse previously freed blocks.'
        ]
      },
      invariants: [
        { name: 'Credit never goes negative', why: 'Negative credit means an operation was not paid for.', breaks: 'When the per-operation charge is set too low.' },
        { name: 'Φ starts at zero and stays non-negative', why: 'Otherwise the telescoping sum does not bound the real cost.', breaks: 'If Φ is defined without the post-grow state in mind.' },
        { name: 'The bound is per sequence, not per operation', why: 'One operation can still cost Θ(n).', breaks: 'For latency-critical paths, where the worst single operation matters.' }
      ],
      complexity: [
        { operation: 'Push (amortised)', average: 'Θ(1)', worst: 'Θ(n)', note: 'The worst case is the copy at a grow' },
        { operation: 'n pushes (total)', average: 'Θ(n)', worst: 'Θ(n)', note: 'Under 3n cost units with factor 2' },
        { operation: 'Pop with shrink at 1/2', average: 'Θ(1)', worst: 'Θ(n)', note: 'Thrashes; shrink at 1/4 to avoid it' },
        { operation: 'Space overhead', average: '≤ (r−1)·n', worst: '(r−1)·n', note: 'Factor 2 wastes up to n slots' }
      ],
      failureModes: [
        { symptom: 'Alternating push/pop is quadratic', cause: 'Grow at full and shrink at half, so every pair reallocates.', fix: 'Shrink at a quarter — hysteresis between the thresholds.' },
        { symptom: 'A p99 latency spike on insert', cause: 'The amortised bound hides an O(n) copy.', fix: 'Pre-size, or use a chunked structure with no single large copy.' },
        { symptom: 'Memory grows to twice the data', cause: 'Growth factor 2 with no shrink.', fix: 'Shrink policy, or a smaller factor.' },
        { symptom: 'An operation with a proven O(1) amortised bound costs Θ(n) every single time', cause: 'The grow and shrink thresholds meet, so every resize leaves the structure sitting on the other one.', fix: 'Leave a hysteresis band - grow at full, shrink at a quarter - so at least capacity/4 cheap operations separate two resizes.' }
      ],
      inTheWild: [
        { system: 'C++ std::vector, Rust Vec', how: 'Factor 2 typically; libstdc++ uses 2, MSVC 1.5' },
        { system: 'Go slices', how: 'Doubles below 256 elements, then grows by ~1.25' },
        { system: 'Java ArrayList', how: 'Grows by 1.5' }
      ],
      sources: [SOURCES.clrs, { title: 'Amortized computational complexity', where: 'Tarjan, SIAM 1985' }, { title: 'Purely Functional Data Structures, chapter 5 — amortisation and persistence', where: 'Okasaki, 1998' }]
    },

    'average-case': {
      summary: 'Indicator variables plus linearity of expectation give exact average-case bounds ' +
        'without solving a recurrence — and a simulation checks the derivation.',
      intuition: 'Instead of asking "how many comparisons", ask "for each pair, what is the chance they ' +
        'meet". Dependence between the events does not matter, because expectation is linear ' +
        'regardless. That single fact makes most average-case analysis a counting exercise.',
      formulation: {
        equations: [
          { label: 'Linearity', expr: 'E[ΣXᵢ] = ΣE[Xᵢ]  (no independence required)',
            terms: [{ sym: 'Xᵢ', meaning: 'an indicator: 1 if the event happens, 0 otherwise' }] },
          { label: 'Quicksort', expr: 'E[comparisons] = Σ_{i<j} 2/(j − i + 1) ≈ 2n ln n ≈ 1.39 n log₂ n',
            terms: [{ sym: '2/(j−i+1)', meaning: 'chance that i or j is the first pivot chosen in their range' }] },
          { label: 'Chebyshev', expr: 'P(|X − μ| ≥ t) ≤ σ²/t²',
            terms: [{ sym: 'σ', meaning: 'standard deviation; what turns an expectation into a guarantee' }] }
        ],
        derivation: [
          'Two elements are compared exactly once or never: only a pivot is compared with the rest of its range.',
          'The exact sum exceeds the 2n ln n approximation by about 8% at n = 100 and converges slowly.'
        ]
      },
      invariants: [
        { name: 'Linearity needs no independence', why: 'It follows from the definition of expectation.', breaks: 'Never for expectation; it does break for variance.' },
        { name: 'Randomisation moves the assumption', why: 'A random pivot makes the bound hold for every input.', breaks: 'If the "random" source is predictable to an adversary.' },
        { name: 'An expectation is not a guarantee', why: 'Half of runs are worse than the mean.', breaks: 'When a single slow run is user-visible.' }
      ],
      complexity: [
        { operation: 'Randomised quicksort', average: 'Θ(n log n)', worst: 'Θ(n²)', note: 'Expected over the algorithm\'s own coins' },
        { operation: 'Deterministic quicksort', average: 'Θ(n log n)', worst: 'Θ(n²)', note: 'Average over random inputs — a different claim' },
        { operation: 'Exact expectation sum', average: 'Θ(n)', worst: 'Θ(n)', note: 'One term per gap' }
      ],
      failureModes: [
        { symptom: 'Quadratic quicksort in production', cause: 'A fixed pivot rule met adversarial or sorted input.', fix: 'Random pivot, or median-of-three plus an introsort depth limit.' },
        { symptom: '"Average" bound that never materialises', cause: 'The assumed input distribution was wrong.', fix: 'Randomise the algorithm rather than assuming the world.' },
        { symptom: 'A tail that surprises', cause: 'Only the mean was computed.', fix: 'Report the spread and a tail bound.' },
        { symptom: 'The mean matches the analysis and the p99 is far worse than anyone predicted', cause: 'An expectation was reported for a distribution with a long tail, and nothing bounded the tail.', fix: 'Quote a tail bound or a percentile. Markov and Chebyshev are correct and usually far too loose: 68% and 28% where a union bound gives 5%.' }
      ],
      inTheWild: [
        { system: 'Hash tables', how: 'Expected chain length assumes a hash the adversary cannot predict' },
        { system: 'Skip lists, treaps', how: 'Expected O(log n) from the structure\'s own randomness' }
      ],
      sources: [SOURCES.clrs, { title: 'Probability and Computing', where: 'Mitzenmacher, Upfal' }, { title: 'Randomized Algorithms', where: 'Motwani and Raghavan, 1995' }]
    },

    'lower-bounds': {
      summary: 'Counting outcomes bounds any comparison-based algorithm from below; an adversary ' +
        'argument turns that count into a strategy that forces the bound.',
      intuition: 'Each comparison is one bit of information, and you cannot distinguish n! orders with ' +
        'fewer than log₂ n! bits. The adversary makes this concrete: it never commits to an input, it ' +
        'just answers so that the largest set of candidates survives, and any algorithm must keep ' +
        'asking until one candidate remains.',
      formulation: {
        equations: [
          { label: 'Decision-tree bound', expr: 'comparisons ≥ ⌈log₂(number of outcomes)⌉',
            terms: [{ sym: 'outcomes', meaning: 'n! for sorting, n for finding a maximum' }] },
          { label: 'Sorting', expr: 'log₂(n!) = n log₂ n − n log₂ e + O(log n) ≈ n log₂ n − 1.44n',
            terms: [{ sym: 'Stirling', meaning: 'the approximation that gives the familiar n log n' }] },
          { label: 'Max and min together', expr: '⌈3n/2⌉ − 2 comparisons, by pairing first',
            terms: [{ sym: 'pairing', meaning: 'compare in pairs, then only winners for max and losers for min' }] }
        ],
        derivation: [
          'A binary decision tree of height h has at most 2^h leaves; every outcome needs its own leaf.',
          'For the maximum, every element except the answer must lose at least one comparison, and each ' +
            'comparison creates at most one new loser, so n − 1 comparisons are necessary.'
        ]
      },
      invariants: [
        { name: 'The bound holds only inside the model', why: 'It counts comparisons, so it says nothing about algorithms that do not compare.', breaks: 'Radix and counting sort, which read digits.' },
        { name: 'The adversary never commits', why: 'It only needs its answers to stay consistent with some input.', breaks: 'If it answers inconsistently, the argument is void.' },
        { name: 'Halving is the best case per question', why: 'One bit cannot do more than split the candidates in two.', breaks: 'Nowhere: it is the counting argument itself.' }
      ],
      complexity: [
        { operation: 'Sorting (comparison model)', average: 'Ω(n log n)', worst: 'Ω(n log n)', note: 'Matched by merge sort and heapsort' },
        { operation: 'Finding the maximum', average: 'Ω(n − 1)', worst: 'Ω(n − 1)', note: 'Matched by a linear scan' },
        { operation: 'Max and min together', average: 'Ω(⌈3n/2⌉ − 2)', worst: 'Ω(⌈3n/2⌉ − 2)', note: 'Beats the naive 2n − 2' },
        { operation: 'Searching a sorted array', average: 'Ω(log n)', worst: 'Ω(log n)', note: 'Matched by binary search' }
      ],
      failureModes: [
        { symptom: 'Chasing a sub-n log n comparison sort', cause: 'Not knowing the bound exists.', fix: 'Change the model: exploit key structure with radix or counting sort.' },
        { symptom: '"My sort is O(n)" on a benchmark', cause: 'The input was nearly sorted, so the adaptive path ran.', fix: 'Report the input distribution with the result.' },
        { symptom: 'A bound quoted for the wrong model', cause: 'Applying a comparison bound to hashing or counting.', fix: 'State the model with the bound.' },
        { symptom: 'Someone beats a bound you proved', cause: 'The proof was about a model the new algorithm does not work in.', fix: 'Name the model in the statement: ⌈3n/2⌉ − 2 comparisons for min and max is a comparison-model bound and says nothing about a radix or SIMD method.' }
      ],
      inTheWild: [
        { system: 'Library sorts', how: 'Comparison sorts settle at n log n and compete on constants' },
        { system: 'Databases sorting integers', how: 'Radix sort where the key structure allows it' }
      ],
      sources: [SOURCES.clrs, SOURCES.knuth, { title: 'A sorting problem and its complexity — the ⌈3n/2⌉ − 2 bound', where: 'Pohl, CACM 1972' }]
    },

    'constants-and-cache': {
      summary: 'Asymptotics rank algorithms in the limit; below the crossover the "worse" algorithm ' +
        'wins, and the crossover is a measurement, not a theorem.',
      intuition: 'Everything the notation drops — instruction count per operation, allocation, ' +
        'recursion, cache misses, branch mispredictions — is a constant factor, and constant factors ' +
        'decide every real input below the crossover. That is why library sorts are hybrids and why ' +
        'the first question about a cost claim is "at what n".',
      formulation: {
        equations: [
          { label: 'Crossover', expr: 'smallest n with c₁·f₁(n) < c₂·f₂(n)',
            terms: [{ sym: 'c', meaning: 'the constants the notation discards' }] },
          { label: 'Sort constants', expr: 'insertion ≈ 0.25n² comparisons, merge ≈ n log₂ n plus ~2n allocations',
            terms: [{ sym: '0.25', meaning: 'average inversions in a random permutation: n(n−1)/4' }] },
          { label: 'Memory hierarchy', expr: 'effective cost = hits·t_hit + misses·t_miss',
            terms: [{ sym: 't_miss', meaning: 'two orders of magnitude above t_hit — see M37' }] }
        ],
        derivation: [
          'Insertion sort does about n²/4 comparisons on random input but only n − 1 on sorted input, which is ' +
            'why adaptivity matters as much as the exponent.',
          'The comparison crossover and the time crossover differ because allocation and recursion are not comparisons.'
        ]
      },
      invariants: [
        { name: 'The crossover is machine-specific', why: 'It depends on constants that vary by machine and compiler.', breaks: 'Whenever a measured cutoff is copied to different hardware.' },
        { name: 'Counted operations transfer, times do not', why: 'Counts are deterministic; times are not portable.', breaks: 'When only wall-clock is reported.' },
        { name: 'Adaptivity changes the picture', why: 'Nearly-sorted input moves insertion sort to Θ(n).', breaks: 'When benchmarks use only uniform random input.' }
      ],
      complexity: [
        { operation: 'Insertion sort (random)', average: 'Θ(n²)', worst: 'Θ(n²)', note: '≈ n²/4 comparisons; Θ(n) on sorted input' },
        { operation: 'Merge sort', average: 'Θ(n log n)', worst: 'Θ(n log n)', note: 'Plus Θ(n) auxiliary space and allocation' },
        { operation: 'Hybrid with cutoff k', average: 'Θ(n log(n/k))', worst: 'Θ(n log(n/k))', note: 'Real cutoffs are 16-32' }
      ],
      failureModes: [
        { symptom: 'A "faster" algorithm is slower in production', cause: 'Real inputs sit below the crossover.', fix: 'Measure at production sizes; consider a hybrid.' },
        { symptom: 'A microbenchmark disagrees with the service', cause: 'Cache state differs between the two.', fix: 'Benchmark with a realistic working set.' },
        { symptom: 'Linked list chosen for O(1) insert', cause: 'Ignoring the O(n) search and the cache miss per node.', fix: 'Prefer arrays unless the search is already answered.' },
        { symptom: 'Two loops with identical operation counts differ by an order of magnitude in time', cause: 'One of them strides through memory further than a cache line, so every access fetches 64 bytes to use 4.', fix: 'Count lines, not operations: a column-major sweep of a 1024² int32 matrix takes 1 048 576 misses against 65 536 and moves 64 MiB against 4.' }
      ],
      inTheWild: [
        { system: 'Timsort, introsort, pdqsort', how: 'All switch to insertion sort below a measured cutoff' },
        { system: 'BLAS libraries', how: 'Blocked kernels tuned per cache size rather than by asymptotics' }
      ],
      sources: [SOURCES.sedgewick, { title: 'What every programmer should know about memory', where: 'Drepper, 2007' },
        { title: 'Engineering a sort function', where: 'Bentley, McIlroy, 1993' }]
    },

    'space-complexity': {
      summary: 'Peak live memory, not total allocation, is what fails a machine — and the shape of the ' +
        'dataflow decides it.',
      intuition: 'Time complexity gets the attention because it is what interviews ask about, but the ' +
        'constraint that actually stops a job is memory. Materialising every stage costs Θ(n) per stage; ' +
        'chunking costs Θ(chunk); streaming costs Θ(1). The choice also sets your time to first result, ' +
        'in the opposite direction.',
      formulation: {
        equations: [
          { label: 'Peak', expr: 'peak = max over time of live bytes',
            terms: [{ sym: 'live', meaning: 'allocated and still reachable' }] },
          { label: 'Pipeline shapes', expr: 'materialised Θ(n·s),  chunked Θ(chunk),  streaming Θ(1)',
            terms: [{ sym: 's', meaning: 'number of stages held simultaneously' }] },
          { label: 'Stack', expr: 'stack peak = depth × frame size',
            terms: [{ sym: 'depth', meaning: 'recursion depth; log n if balanced, n if not' }] }
        ],
        derivation: [
          'Auxiliary space excludes the input, which is the only reason an in-place sort can claim O(1).',
          'Time to first result is Θ(n·s) for materialising and Θ(s) for streaming, which is the trade against peak.'
        ]
      },
      invariants: [
        { name: 'Peak is a maximum, not a sum', why: 'Freed memory is reusable, so total allocation overstates the requirement.', breaks: 'Under fragmentation, where freed memory is not reusable (M43).' },
        { name: 'Streaming peak is independent of n', why: 'Only a bounded number of items are live.', breaks: 'If any stage accumulates — a sort or a group-by in the middle.' },
        { name: 'Recursion depth is memory', why: 'Each frame is live until the call returns.', breaks: 'Deep recursion on unbalanced input overflows the stack.' }
      ],
      complexity: [
        { operation: 'Materialised pipeline', average: 'Θ(n·s) space', worst: 'Θ(n·s)', note: 'Best throughput, worst peak and latency' },
        { operation: 'Chunked pipeline', average: 'Θ(chunk)', worst: 'Θ(chunk)', note: 'Usually the right default' },
        { operation: 'Streaming pipeline', average: 'Θ(1)', worst: 'Θ(1)', note: 'Best peak and latency, most per-item overhead' },
        { operation: 'Recursive traversal', average: 'Θ(log n)', worst: 'Θ(n)', note: 'Θ(n) when the structure is degenerate' }
      ],
      failureModes: [
        { symptom: 'Works locally, OOMs in the container', cause: 'Peak scaled with input and the limit is lower in production.', fix: 'Bound the peak by chunking; test with a production-sized input.' },
        { symptom: 'Stack overflow on large input', cause: 'Recursion depth proportional to n.', fix: 'Convert to an explicit stack, or ensure balance.' },
        { symptom: 'Latency spike before any output', cause: 'A materialising stage in an otherwise streaming pipeline.', fix: 'Find the accumulating stage; it is the whole peak.' },
        { symptom: 'A stack overflow in an algorithm documented as in-place', cause: 'In-place bounds the auxiliary heap; the recursion depth was never counted.', fix: 'Recurse on the smaller side and loop on the larger: depth ⌈log₂ n⌉ = 20 frames at n = 10⁶ instead of 10⁶.' }
      ],
      inTheWild: [
        { system: 'Spark, Flink', how: 'Operators declare whether they are streaming or blocking, which sets the peak' },
        { system: 'Node.js streams', how: 'highWaterMark is exactly the chunk-size choice' }
      ],
      sources: [SOURCES.clrs, { title: 'Programming Pearls, the space column', where: 'Bentley' }, { title: 'Data Streams: Algorithms and Applications', where: 'Muthukrishnan, 2005' }]
    },

    'empirical-complexity': {
      summary: 'The doubling experiment reads an exponent off measurements; a curve fit checks it; and ' +
        'both are only as good as the measurement underneath.',
      intuition: 'You do not need the source to determine a complexity class. Double the input a few ' +
        'times and the ratio of costs converges to 2^k. Two independent readings that agree — the ratio ' +
        'table and a least-squares fit — are strong evidence; when they disagree, the measurement is the ' +
        'thing to fix first.',
      formulation: {
        equations: [
          { label: 'Doubling ratio', expr: 'T(2n)/T(n) → 2^k for T = Θ(n^k)',
            terms: [{ sym: 'k', meaning: 'the exponent, estimated as log₂ of the ratio' }] },
          { label: 'Log-log form', expr: 'log T = k·log n + log c',
            terms: [{ sym: 'slope', meaning: 'the exponent, read directly off the plot' }] },
          { label: 'Fit quality', expr: 'relative residual = ‖y − c·f(n)‖ / ‖y‖',
            terms: [{ sym: 'c', meaning: 'the least-squares coefficient for the candidate curve' }] }
        ],
        derivation: [
          'n log n gives a ratio of 2·(1 + 1/log₂n), which approaches 2 slowly — that is why it is hard to ' +
            'separate from linear over a single decade.',
          'The estimate uses the last few doublings because small n is dominated by constants.'
        ]
      },
      invariants: [
        { name: 'Ratios must be stable before you read them', why: 'A drifting ratio means you are not in the asymptotic regime.', breaks: 'At small n, or when a second term still matters.' },
        { name: 'The fit ranks candidates, it does not prove one', why: 'Adjacent classes have very similar residuals over a short range.', breaks: 'When the top two residuals are within a few percent.' },
        { name: 'The measurement must be valid first', why: 'Warm caches or eliminated code produce confident nonsense.', breaks: 'Whenever the benchmark protocol of 1.9 is skipped.' }
      ],
      complexity: [
        { operation: 'Doubling experiment', average: 'Θ(2·largest n)', worst: 'Θ(2·largest n)', note: 'The largest size dominates the total' },
        { operation: 'Fit over m candidates', average: 'Θ(m·points)', worst: 'Θ(m·points)', note: 'Trivial next to the measurements' },
        { operation: 'Distinguishing n from n log n', average: 'needs ~3 decades', worst: '—', note: 'The ratio differs by under 10% per doubling' }
      ],
      failureModes: [
        { symptom: 'Measured exponent below the true one', cause: 'Cache effects at small n, or the loop was optimised away.', fix: 'Use larger sizes and a sink; check the throughput is physically possible.' },
        { symptom: 'Ratios that keep rising', cause: 'A second term (allocation, GC) growing faster than the main one.', fix: 'Profile the run; measure allocations separately.' },
        { symptom: 'A quadratic result for a linear algorithm', cause: 'The input generator was itself quadratic.', fix: 'Time the generator separately, always.' },
        { symptom: 'The fitted exponent is confident, reproducible and wrong', cause: 'The candidate models differ by less than the measurement noise over the range tested.', fix: 'Widen the range by orders of magnitude, or count operations instead: n log n and n^1.1 differ by 2.6% in doubling ratio over a 16× range.' }
      ],
      inTheWild: [
        { system: 'Sedgewick\'s Algorithms course', how: 'The doubling method as the standard empirical tool' },
        { system: 'Performance regression suites', how: 'Ratio checks across sizes to catch accidental quadratics' }
      ],
      sources: [SOURCES.sedgewick, { title: 'Statistically rigorous Java performance evaluation', where: 'Georges, Buytaert, Eeckhout, OOPSLA 2007' }, { title: 'A Guide to Experimental Algorithmics', where: 'McGeoch, 2012' }]
    },

    benchmarking: {
      summary: 'A defensible timing needs warm-up, repetition, a sink, outlier handling and a reported ' +
        'distribution; skipping any of them changes the number.',
      intuition: 'Benchmarking is measurement, and measurement has a protocol. The failure mode that ' +
        'matters most is not noise but measuring nothing at all: if the result is unused, the engine may ' +
        'delete the work, and the benchmark reports the cost of an empty loop. Numbers that look too good ' +
        'usually are.',
      formulation: {
        equations: [
          { label: 'Robust centre and spread', expr: 'median, MAD = median(|xᵢ − median|)',
            terms: [{ sym: 'MAD', meaning: 'unmoved by a single outlier, unlike the standard deviation' }] },
          { label: 'Reporting form', expr: 'median ± MAD over n runs, conditions stated',
            terms: [{ sym: 'n', meaning: 'the run count, without which the number cannot be judged' }] },
          { label: 'Sanity check', expr: 'implied throughput = work / measured time',
            terms: [{ sym: 'implied', meaning: 'compare against physical limits before believing it' }] }
        ],
        derivation: [
          'A JIT-compiled loop can be an order of magnitude slower on the first run, so an unwarmed median ' +
            'is measuring compilation.',
          'performance.now() is deliberately coarse in browsers, so work below the resolution measures as ' +
            'zero — batch it.'
        ]
      },
      invariants: [
        { name: 'The result must be consumed', why: 'Otherwise the computation can be proven dead and removed.', breaks: 'Any benchmark whose result is discarded.' },
        { name: 'Steady state must be reached', why: 'Compilation and cache filling are not what you are measuring.', breaks: 'Short benchmarks with no warm-up.' },
        { name: 'A single sample is not a measurement', why: 'There is no spread, so nothing can be compared.', breaks: 'Almost every performance claim made in conversation.' }
      ],
      complexity: [
        { operation: 'Warm-up', average: 'k runs discarded', worst: '—', note: 'Enough for the engine to reach steady state' },
        { operation: 'Measured runs', average: '15-30', worst: '—', note: 'Enough for a median and a MAD' },
        { operation: 'Comparing two versions', average: 'repeat both, interleaved', worst: '—', note: 'Report the interval, not the point' }
      ],
      failureModes: [
        { symptom: 'Impossibly fast result', cause: 'The work was optimised away — no sink.', fix: 'Consume the result; check implied throughput against hardware limits.' },
        { symptom: 'Large run-to-run variance', cause: 'GC, other processes, thermal throttling.', fix: 'Report median and MAD; increase runs; pin the environment.' },
        { symptom: 'A change "improves" performance by 3%', cause: 'The difference is inside the noise.', fix: 'Compute a confidence interval; 3% is usually nothing.' },
        { symptom: 'p99 far better in the load test than in production', cause: 'Coordinated omission in the load generator.', fix: 'Measure against intended send time, not actual.' }
      ],
      inTheWild: [
        { system: 'JMH, Criterion, Benchmark.js', how: 'All enforce warm-up, repetition and a sink' },
        { system: 'Browser performance.now()', how: 'Clamped for security, so single operations cannot be timed directly' }
      ],
      sources: [
        { title: 'Statistically rigorous Java performance evaluation', where: 'Georges, Buytaert, Eeckhout, OOPSLA 2007' },
        { title: 'How NOT to measure latency', where: 'Gil Tene' },
        { title: 'A microbenchmark case study and lessons learned', where: 'Gil, Lenz, Shimron, 2011' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
