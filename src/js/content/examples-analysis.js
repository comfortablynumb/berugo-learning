/**
 * Worked examples for the analysis sections (M01).
 * Every stated figure is recomputed by tests/unit/worked-examples-analysis.test.js.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'asymptotic-notation': [{
      title: 'Find the witness, or prove there is none',
      goal: 'Turn "n log n is O(n²)" into a witness pair, and see why the reverse has none.',
      setup: 'f(n) = n log₂ n and g(n) = n², checked over 1 ≤ n ≤ 1000.',
      steps: [
        { do: 'Write the inequality the definition demands.', why: 'The claim is exactly the existence of c and n₀.',
          work: 'need c, n₀ with\n  n·log₂n ≤ c·n²   for all n ≥ n₀\nat n = 3:  1.585 ≤ 3c  ⇒  c ≥ 0.528', result: 'Divide by n (positive): log₂n ≤ c·n.' },
        { do: 'Try the smallest witness.', why: 'If c = 1 works from n₀ = 1, no larger constant is needed.',
          work: 'n = 1:  log₂1 = 0 ≤ 1\nn = 2:  1 ≤ 2\nn = 16: 4 ≤ 16\nn = 1000: 9.97 ≤ 1000',
          result: 'c = 1, n₀ = 1 is a valid witness.' },
        { do: 'Now try the reverse: is n² = O(n log n)?', why: 'Swapping the roles is where the asymmetry shows.',
          work: 'need n² ≤ c·n·log₂n\n⇔ n ≤ c·log₂n\nat n = 1000:  1000 ≤ c·9.97 ⇒ c ≥ 100.3\nat n = 10⁶:   10⁶ ≤ c·19.93 ⇒ c ≥ 50 172',
          result: 'The required c grows without bound, so no single constant works.' },
        { do: 'State what that proves.', why: 'One direction holds, the other cannot, so the bound is strict.',
          work: 'n log n = O(n²)      ✓ witness (1, 1)\nn² ≠ O(n log n)      ✗ no constant\n⇒ n log n = o(n²)',
          result: 'The containment is strict, which is what little-o records.' }
      ],
      answer: 'n log₂n = O(n²) with the witness c = 1, n₀ = 1; the converse fails because the smallest ' +
        'workable c grows like n / log₂ n, exceeding 50 000 by n = 10⁶.'
    }, {
      title: 'Say what is Θ, what is O, and what is neither',
      goal: 'Attach the three symbols to the right thing — a case, not an algorithm.',
      setup: 'Insertion sort over n = 1000 distinct keys, counted in comparisons, on its best input ' +
        '(already sorted) and its worst (reversed).',
      steps: [
        {
          do: 'Count the best case.',
          why: 'On sorted input the inner loop stops on its first comparison every time.',
          work: 'one comparison per element after the first\n' +
            'comparisons = n − 1 = 999',
          result: 'Θ(n) — linear, with a constant of exactly 1.'
        },
        {
          do: 'Count the worst case.',
          why: 'On reversed input the inner loop walks the whole sorted prefix.',
          work: 'comparisons = 1 + 2 + … + (n − 1) = n(n − 1)/2\n' +
            '            = 1000 × 999 / 2 = 499,500',
          result: 'Θ(n²) — quadratic, with a constant of 1/2.'
        },
        {
          do: 'Measure the distance between them.',
          why: 'The two cases of one algorithm differ by more than most algorithm choices do.',
          work: '499,500 / 999 = 500×\n' +
            'at n = 10: 45 / 9 = 5×\n' +
            'the ratio is n/2, so it grows without bound',
          result: 'The gap is not a constant factor: it is n/2.'
        },
        {
          do: 'Write the four statements that are true.',
          why: 'Each symbol bounds a stated case; the case is half the claim.',
          work: 'worst case = Θ(n²)     ✓  499,500 comparisons at n = 1000\n' +
            'best case  = Θ(n)      ✓  999 comparisons at n = 1000\n' +
            'every case = O(n²)     ✓  nothing exceeds 499,500\n' +
            'every case = Ω(n)      ✓  nothing is below 999 — the input must be read',
          result: 'Four true statements, none of which is "insertion sort is Θ(n²)".'
        },
        {
          do: 'Write the one that is false, and say why.',
          why: 'This is the error that survives review, because it is true of the worst case.',
          work: '"insertion sort is Ω(n²)"  ✗\n' +
            'counterexample: sorted input costs 999, and 999 < c · 10⁶ for every c beyond some n₀\n' +
            'Ω over *all* inputs would have to hold for the best case too',
          result: 'Ω(n²) is a statement about the worst case only, and must say so.'
        }
      ],
      answer: 'Insertion sort costs 999 comparisons on sorted input and 499 500 on reversed input at ' +
        'n = 1000 — a factor of n/2 = 500 apart. Its worst case is Θ(n²) and its best case is Θ(n); ' +
        '"insertion sort is Ω(n²)" is false unless the sentence names the worst case, because the ' +
        'best case is linear.'
    }],

    recurrences: [{
      title: 'Solve merge sort three ways and check they agree',
      goal: 'Use the tree, the master theorem and a direct count on the same recurrence.',
      setup: 'T(n) = 2·T(n/2) + n, with T(1) = 0 comparisons, at n = 1024.',
      steps: [
        { do: 'Draw the levels.', why: 'The per-level total is what the whole method rests on.',
          work: 'level 0: 1 × 1024 = 1024\nlevel 1: 2 ×  512 = 1024\nlevel 2: 4 ×  256 = 1024\n…\nlevel 10: 1024 × 1 = 1024',
          result: 'Every level costs n = 1024.' },
        { do: 'Count the levels and multiply.', why: 'Halving from 1024 to 1 takes log₂1024 steps.',
          work: 'depth = log₂1024 = 10\ntotal = 1024 × (10 + 1) = 11,264\n(11 rows, counting level 0)',
          result: 'About n log₂ n = 10,240, plus the leaf row.' },
        { do: 'Apply the master theorem.', why: 'It should classify what the tree already showed.',
          work: 'a = 2, b = 2 ⇒ log₂2 = 1\nf(n) = n = n¹  ⇒ k = 1 = critical\n⇒ case 2: Θ(n log n)',
          result: 'Case 2, the balanced case: every level costs the same.' },
        { do: 'Change one parameter and watch the case move.', why: 'Seeing the boundary is the point of the exercise.',
          work: 'a = 4, b = 2, f = n:   log₂4 = 2 > 1 ⇒ case 1, Θ(n²)\na = 2, b = 2, f = n²: log₂2 = 1 < 2 ⇒ case 3, Θ(n²)',
          result: 'Leaves dominate in the first, the root in the second.' }
      ],
      answer: 'T(n) = 2T(n/2) + n sums to 1024 per level over 11 levels = 11,264 at n = 1024, which the ' +
        'master theorem classifies as case 2, Θ(n log n).'
    }, {
      title: 'Solve a recurrence the master theorem cannot touch',
      goal: 'Bound an uneven split from its recursion tree, then check the bound against the exact count.',
      setup: 'T(n) = T(n/3) + T(2n/3) + n with T(n) = 0 for n ≤ 1 — the shape a median-of-medians ' +
        'or a skewed quicksort produces. Worked at n = 1024.',
      steps: [
        {
          do: 'Try the master theorem first, and stop.',
          why: 'It only covers a·T(n/b) — one subproblem size, not two.',
          work: 'master theorem form: T(n) = a·T(n/b) + f(n)\n' +
            'here the two subproblems are n/3 and 2n/3, so there is no single b\n' +
            '⇒ the theorem does not apply',
          result: 'Not a case-1/2/3 question. Draw the tree.'
        },
        {
          do: 'Add up one level of the tree.',
          why: 'The two children keep the total size: n/3 + 2n/3 = n, at every level.',
          work: 'level 0: n\n' +
            'level 1: n/3 + 2n/3 = n\n' +
            'level k: still n, until branches start bottoming out',
          result: 'Every full level costs exactly n — the same as merge sort.'
        },
        {
          do: 'Find the shortest and longest root-to-leaf paths.',
          why: 'The tree is not balanced, so the level count is a range, not a number.',
          work: 'shortest (always take n/3):  log₃ 1024   = 6.31 levels\n' +
            'longest  (always take 2n/3): log₁.₅ 1024 = 17.10 levels',
          result: 'Between 6.31 and 17.10 full levels of cost n.'
        },
        {
          do: 'Turn the two paths into bounds.',
          why: 'Levels below the shortest path are full; none survive past the longest.',
          work: 'lower bound: n · log₃ n   = 1024 × 6.31  = 6,461\n' +
            'upper bound: n · log₁.₅ n = 1024 × 17.10 = 17,505\n' +
            '⇒ T(n) = Θ(n log n) either way, since both are c · n log₂ n',
          result: 'The class is settled by the tree; only the constant is open.'
        },
        {
          do: 'Pin the constant, then check it against the exact count.',
          why: 'The Akra–Bazzi constant is the entropy of the split, and it is checkable.',
          work: 'H = −(1/3)ln(1/3) − (2/3)ln(2/3) = 0.6365 nats\n' +
            'T(n) ≈ n·ln n / H = 1024 × 6.931 / 0.6365 = 11,151\n' +
            'exact recurrence at n = 1024:                11,379\n' +
            'merge sort (even split) at n = 1024:         10,240',
          result: 'The estimate is within 2.1% of the exact value.'
        }
      ],
      answer: 'The tree costs n per level over between log₃ n = 6.31 and log₁.₅ n = 17.10 levels, so ' +
        'T(n) = Θ(n log n) — between 6 461 and 17 505 at n = 1024. The entropy of the split gives ' +
        '11 151 and the exact recurrence gives 11 379, so a 1:2 split costs about 11% more than the ' +
        'even split merge sort gets (10 240).'
    }],

    'amortised-analysis': [{
      title: 'Pay for a doubling array three ways',
      goal: 'Get the same amortised bound from the aggregate, accounting and potential arguments.',
      setup: 'A dynamic array starting at capacity 1, doubling when full, over n = 1024 pushes.',
      steps: [
        { do: 'Count the copies with the aggregate method.', why: 'Copies happen only at powers of two, so the total is a geometric sum.',
          work: 'copies = 1 + 2 + 4 + … + 512\n       = 2¹⁰ − 1 = 1023\ntotal cost = 1024 writes + 1023 copies = 2047',
          result: '2047 / 1024 < 2 cost units per push.' },
        { do: 'Charge 3 per push and check the bank.', why: 'The accounting argument is only valid if the credit never goes negative.',
          work: 'each push: pay 1, bank 2\nbefore the copy at size 512:\n  banked since last copy = 2 × 512 = 1024\n  copy costs 512\n⇒ bank stays positive',
          result: 'A charge of 3 is sufficient; a charge of 2 is exactly enough.' },
        { do: 'Use the potential Φ = 2·size − capacity.', why: 'The potential must be zero right after a grow and rise as the array fills.',
          work: 'after grow: size = 512, capacity = 1024 ⇒ Φ = 0\njust before next grow: size = capacity = 1024 ⇒ Φ = 1024\ncheap push: â = 1 + (Φ+2 − Φ) = 3\ngrow push:  â = (1 + 1024) + (2·1025 − 2048) − (2·1024 − 1024) = 3',
          result: 'Amortised cost 3 for both cases, which is the bound.' },
        { do: 'Compare the factor 1.5.', why: 'The trade is copies against reuse, not copies against speed.',
          work: 'factor 2:   copies ≈ n,      freed blocks sum to capacity − 1 (never enough)\nfactor 1.5: copies ≈ 2n,     freed blocks eventually exceed the next request',
          result: 'Factor 1.5 copies about twice as much and lets the allocator reuse the space.' }
      ],
      answer: '1024 pushes cost 2047 units (1023 copies), giving an amortised cost under 2 by the ' +
        'aggregate method and exactly 3 by both the accounting and potential arguments with Φ = 2·size − capacity.'
    }, {
      title: 'Break the amortised bound with one bad shrink rule',
      goal: 'Show that the doubling argument depends on the *shrink* threshold, not just the growth factor.',
      setup: 'A dynamic array that doubles when full. Two shrink rules, both "obviously reasonable": ' +
        'halve when size ≤ capacity/2, and halve when size ≤ capacity/4. Start at size 513, capacity ' +
        '1024, then alternate 1 000 pops and pushes.',
      steps: [
        {
          do: 'Follow one cycle under the half rule.',
          why: 'The contraction leaves the array exactly full, which is the trap.',
          work: 'pop:  size 513 → 512, and 512 ≤ 1024/2 ⇒ halve to 1024/2 = 512, copying 512\n' +
            'now size 512 = capacity 512 — full\n' +
            'push: full ⇒ double to 1024, copying 512\n' +
            'pop:  size 513 → 512 ⇒ halve again…',
          result: 'Every single operation copies 512 elements.'
        },
        {
          do: 'Price 1 000 operations under that rule.',
          why: 'This is the number the amortised argument promised would be constant.',
          work: '500 contractions + 500 expansions\n' +
            'copies = 1,000 × 512 = 512,000\n' +
            'amortised cost = 512,000 / 1,000 = 512 copies per operation',
          result: 'O(n) amortised — the bound is gone, not merely worse.'
        },
        {
          do: 'Run the same 1 000 operations under the quarter rule.',
          why: 'One changed constant, same growth factor, same workload.',
          work: 'pop:  size 513 → 512, and 512 > 1024/4 = 256 ⇒ no shrink\n' +
            'push: 513 < 1024 ⇒ no growth\n' +
            'copies over 1,000 operations = 0',
          result: 'Zero copies: the state never touches either threshold.'
        },
        {
          do: 'Say why the gap between the thresholds is the whole argument.',
          why: 'The potential must be able to pay for the next resize before it is due.',
          work: 'after a resize the array is half full: size = capacity/2\n' +
            'growth is due at   size = capacity      (capacity/2 pushes away)\n' +
            'shrink is due at   size = capacity/4    (capacity/4 pops away)\n' +
            '⇒ at least capacity/4 cheap operations between any two resizes\n' +
            'each resize copies ≤ capacity ⇒ ≤ 4 copies per operation, amortised',
          result: 'The hysteresis band is what pays for the copy.'
        }
      ],
      answer: 'Shrinking at half fills the array immediately after every contraction, so a pop/push ' +
        'alternation copies 512 elements per operation — 512 000 copies over 1 000 operations, an O(n) ' +
        'amortised cost. Shrinking at a quarter leaves a hysteresis band of capacity/4 operations ' +
        'between resizes and does zero copies on the same workload; the amortised bound is ≤ 4 copies ' +
        'per operation.'
    }],

    'average-case': [{
      title: 'Derive quicksort\'s expected comparisons, then measure them',
      goal: 'Use indicator variables to get an exact expectation, and check it by simulation.',
      setup: 'Randomised quicksort on n = 100 distinct elements, uniformly random pivots.',
      steps: [
        { do: 'Define the indicator.', why: 'Counting comparisons directly is hard; counting pairs is easy.',
          work: 'Xᵢⱼ = 1 if the i-th and j-th smallest are ever compared\nX = Σ_{i<j} Xᵢⱼ', result: 'E[X] = Σ_{i<j} P(Xᵢⱼ = 1).' },
        { do: 'Find the probability for one pair.', why: 'Two elements meet only if one of them is the first pivot chosen from the range between them.',
          work: 'range i…j contains j − i + 1 elements\nthey are compared ⟺ i or j is chosen first\nP = 2 / (j − i + 1)', result: 'Pairs that are far apart are rarely compared.' },
        { do: 'Sum over all pairs.', why: 'Linearity of expectation applies even though the events are dependent.',
          work: 'E[X] = Σ_{gap=1}^{n−1} (n − gap) · 2/(gap + 1)\nn = 100 ⇒ E[X] ≈ 647.85',
          result: 'About 648 comparisons for n = 100.' },
        { do: 'Compare with the familiar form.', why: 'The asymptotic expression is an approximation, and it is worth knowing by how much.',
          work: '2n ln n = 2 × 100 × 4.6052 = 921.03\nratio = 921.03 / 647.85 = 1.422',
          result: '2n ln n overestimates by 42% at n = 100.' },
        { do: 'Check by simulation.', why: 'A derivation nobody has tested is a hypothesis.',
          work: 'run 200 seeded trials, average the counted comparisons\nexpect the mean within ~2% of 647.85',
          result: 'The demo does exactly this and reports the relative difference.' }
      ],
      answer: 'The exact expectation at n = 100 is ≈ 647.85 comparisons; 2n ln n gives 921.03, an ' +
        'overestimate of 42% that only falls to 26% by n = 1000 — the asymptotic form converges slowly, ' +
        'and the simulation lands on the exact sum rather than on it.'
    }, {
      title: 'Bound a tail three ways, and watch two of them be useless',
      goal: 'Take one random variable and see what Markov, Chebyshev and a structural bound each buy.',
      setup: 'The coupon collector: draw uniformly from n = 100 distinct items until every item has ' +
        'been seen. Ask for P(T > 760 draws).',
      steps: [
        {
          do: 'Get the expectation exactly.',
          why: 'The waiting times for each new coupon are independent geometrics, so expectations add.',
          work: 'E[T] = n·(1/n + 1/(n−1) + … + 1/1) = n·H_n\n' +
            'H₁₀₀ = 5.1874\n' +
            'E[T] = 100 × 5.1874 = 518.7 draws\n' +
            'the asymptotic form n(ln n + γ) = 100 × 5.182 = 518.2',
          result: '518.7 draws on average, and the asymptotic form is already accurate to 0.1%.'
        },
        {
          do: 'Get the standard deviation.',
          why: 'A tail bound needs a second moment, and this one has a closed form.',
          work: 'Var[T] < n²·π²/6 = 10,000 × 1.6449 = 16,449\n' +
            'sd < 128.3 draws  (25% of the mean)',
          result: 'The distribution is wide: one sd is a quarter of the mean.'
        },
        {
          do: 'Apply Markov.',
          why: 'It needs only the mean and non-negativity, and it shows what that is worth.',
          work: 'P(T ≥ 760.5) ≤ E[T]/760.5 = 518.7/760.5 = 0.682',
          result: '"At most 68%" — true, and almost content-free.'
        },
        {
          do: 'Apply Chebyshev.',
          why: 'Adding the variance should tighten it, and it does — by about 2.4×.',
          work: 'P(|T − 518.7| ≥ 241.8) ≤ (sd/241.8)² = (128.3/241.8)² = 0.281',
          result: '"At most 28%" — better, still far from the truth.'
        },
        {
          do: 'Use the structure instead of the moments.',
          why: 'A union bound over the n coupons uses what the moments threw away.',
          work: 'P(a given coupon unseen after n·ln n + c·n draws) ≤ e^(−ln n − c) = 1/(n·e^c)\n' +
            'union over n coupons: P(T > n·ln n + c·n) ≤ e^(−c)\n' +
            'at c = 3: threshold = 460.5 + 300 = 760.5, bound = e⁻³ = 0.0498',
          result: '"At most 5%" — 13.7× tighter than Markov, from the same random variable.'
        }
      ],
      answer: 'For n = 100 coupons E[T] = 518.7 draws with sd 128.3. At a threshold of 760.5 draws ' +
        'Markov gives 68%, Chebyshev gives 28% and a union bound over the coupons gives 5% — the ' +
        'generic bounds are correct and nearly useless, because they only know the moments.'
    }],

    'lower-bounds': [{
      title: 'Prove that four elements need five comparisons',
      goal: 'Get an exact floor from counting, and see the adversary enforce it.',
      setup: 'Sorting a[0..3], all distinct, comparison model only.',
      steps: [
        { do: 'Count the outcomes.', why: 'Each distinct input order needs its own leaf in the decision tree.',
          work: '4! = 24 possible orders', result: '24 leaves are required.' },
        { do: 'Bound the tree height.', why: 'A binary tree of height h has at most 2^h leaves.',
          work: '2^h ≥ 24\nh ≥ log₂24 = 4.585\nh ≥ 5   (integer)', result: 'At least 5 comparisons in the worst case.' },
        { do: 'Check that 4 cannot work.', why: 'The bound is only convincing if the near miss is explicit.',
          work: '2⁴ = 16 < 24\n⇒ with 4 comparisons at least 8 orders share a leaf',
          result: 'Any 4-comparison algorithm answers wrongly for at least 8 inputs.' },
        { do: 'Watch the adversary enforce it.', why: 'The adversary never commits to an input; it just keeps the larger half alive.',
          work: 'start 24 → ask → ≥12 → ask → ≥6 → ask → ≥3 → ask → ≥2 → ask → ≥1\n5 questions to reach a single order',
          result: 'The count can never fall faster than half per question.' },
        { do: 'Scale it up.', why: 'The same argument gives the familiar n log n bound.',
          work: 'log₂(n!) ≈ n log₂ n − n·log₂e\n        ≈ n log₂ n − 1.44n', result: 'Ω(n log n) for any comparison sort.' }
      ],
      answer: 'Sorting 4 elements needs ⌈log₂ 24⌉ = 5 comparisons; 4 would leave at least 8 orders ' +
        'indistinguishable, and the adversary forces the fifth question.'
    }, {
      title: 'Find the minimum and the maximum in fewer comparisons than two passes',
      goal: 'Beat the obvious 2n − 2 bound, and see why ⌈3n/2⌉ − 2 cannot be beaten.',
      setup: 'n = 100 distinct values; report both the minimum and the maximum; comparison model only.',
      steps: [
        {
          do: 'Count the obvious algorithm.',
          why: 'Two independent scans, each of which is already optimal on its own.',
          work: 'max alone: n − 1 = 99 comparisons\n' +
            'min alone: n − 1 = 99\n' +
            'total: 2n − 2 = 198',
          result: '198 comparisons, and each scan is individually optimal.'
        },
        {
          do: 'Pair the elements first.',
          why: 'One comparison per pair sorts the pair, and a pair winner can never be the minimum.',
          work: 'compare within pairs: ⌊n/2⌋ = 50 comparisons\n' +
            'max over the 50 winners: 49\n' +
            'min over the 50 losers:  49\n' +
            'total: 50 + 49 + 49 = 148',
          result: '148 comparisons — 25% fewer, for the same answer.'
        },
        {
          do: 'Check it against the closed form.',
          why: 'The construction should match the known bound exactly, including the odd case.',
          work: '⌈3n/2⌉ − 2 = ⌈150⌉ − 2 = 148  ✓\n' +
            'at n = 1000: 1,498 against 1,998 — still 25.0%',
          result: 'The saving is a constant fraction, not a vanishing one.'
        },
        {
          do: 'Show the bound is tight with an information argument.',
          why: 'Each element must earn two facts, and one comparison supplies at most three.',
          work: 'every element except the max must lose once; every element except the min must win once\n' +
            '⇒ 2n − 2 facts are required\n' +
            'a comparison between two *untouched* elements supplies 2 facts (one win, one loss)\n' +
            'any other comparison supplies at most 1 new fact\n' +
            'at most ⌊n/2⌋ comparisons can be of the first kind\n' +
            '⇒ comparisons ≥ (2n − 2) − ⌊n/2⌋ = ⌈3n/2⌉ − 2',
          result: 'The pairing algorithm is optimal, not merely better.'
        }
      ],
      answer: 'Pairing the elements first finds both extremes of 100 values in 148 comparisons ' +
        'against the 198 two scans need, and the adversary argument — 2n − 2 facts required, at most ' +
        '⌊n/2⌋ comparisons that supply two of them — shows 148 = ⌈3n/2⌉ − 2 is exactly optimal.'
    }],

    'constants-and-cache': [{
      title: 'Predict the crossover, then measure it',
      goal: 'Estimate where merge sort overtakes insertion sort from constants, and check the prediction.',
      setup: 'Insertion sort ≈ 0.25·n² comparisons on random input; merge sort ≈ n log₂n comparisons plus allocation.',
      steps: [
        { do: 'Write both costs with their constants.', why: 'The crossover is decided by the constants, which is what the notation drops.',
          work: 'insertion: 0.25·n²\nmerge:     1.0·n·log₂n',
          result: 'Equal when 0.25n² = n log₂ n.' },
        { do: 'Solve for n.', why: 'The algebra gives a prediction to check against measurement.',
          work: '0.25n = log₂n\nn = 16:  4.0 vs 4.0  ✓',
          result: 'Predicted crossover at about n = 16 by comparison count.' },
        { do: 'Add the costs the count ignores.', why: 'Merge sort allocates and recurses; insertion sort does neither.',
          work: 'merge allocates ≈ 2 arrays per level: ~2n slots total\nrecursion: ~2n calls\ninsertion: 0 allocations, 1 loop',
          result: 'The time crossover sits well above the comparison crossover.' },
        { do: 'Measure both.', why: 'Only measurement resolves how large "well above" is on this machine.',
          work: 'count comparisons through the instrumented comparator\ntime medians over repeated runs on identical seeded inputs\ncompare the two crossover points\n\nat n = 64:  insertion 1024 cmp / 0.006 ms\n            merge      352 cmp / 0.011 ms',
          result: 'The demo reports both, and they differ.' },
        { do: 'Read the consequence.', why: 'This is precisely why library sorts are hybrids.',
          work: 'cutoff = the measured time crossover\nsort(range) = insertion if len ≤ 32 else merge\n\nmeasured cutoffs in real libraries:\n  libstdc++ 16 · Java 47 · Go 12',
          result: 'Real cutoffs sit between 16 and 32 elements.' }
      ],
      answer: 'Comparison counts predict a crossover near n = 16, and measured time puts it higher ' +
        'because merge sort allocates and recurses — which is why library sorts switch to insertion ' +
        'sort somewhere between 16 and 32.'
    }, {
      title: 'Two loops, same work, 16× the memory traffic',
      goal: 'Measure what the loop order costs when neither loop does any more arithmetic.',
      setup: 'A 1024 × 1024 matrix of int32 (4 MiB), summed twice: row by row, then column by column. ' +
        '64-byte cache lines, a 32 KiB cache (512 lines), fully associative LRU.',
      steps: [
        {
          do: 'Count what the two loops have in common.',
          why: 'If the instruction counts match, whatever differs is memory, not arithmetic.',
          work: 'element reads: 1024 × 1024 = 1,048,576 in both\n' +
            'additions:     1,048,576 in both\n' +
            'loop bounds, index arithmetic: identical',
          result: 'Identical work by every count that ignores the cache.'
        },
        {
          do: 'Work out what one cache line buys in each order.',
          why: 'The line is the unit of transfer, so the question is how much of it gets used.',
          work: 'line = 64 B = 16 int32\n' +
            'row-major: the next 15 reads are already in the line ⇒ 1 miss per 16 reads\n' +
            'column-major: the next read is 4 KiB away ⇒ a new line every read',
          result: 'The same line is either used 16 times or once.'
        },
        {
          do: 'Predict, then measure.',
          why: 'The column walk only misses every time if its working set does not fit.',
          work: 'predicted row-major misses: 1,048,576 / 16 = 65,536\n' +
            'one column pass touches 1024 distinct lines > 512-line cache ⇒ every line is evicted ' +
            'before its next use\n' +
            'measured: row-major 65,536 misses (6.3%), column-major 1,048,576 (100%)',
          result: 'Exactly 16×, the number of elements in a line.'
        },
        {
          do: 'Convert misses to traffic.',
          why: 'Traffic is what the memory system actually charges for.',
          work: 'row-major:    65,536 × 64 B = 4 MiB — the matrix, read once\n' +
            'column-major: 1,048,576 × 64 B = 64 MiB — the matrix, read 16 times',
          result: 'The column order moves 60 MiB it never uses.'
        },
        {
          do: 'Note the fix, and the one number that decides it.',
          why: 'Blocking restores locality without changing the arithmetic either.',
          work: 'tile the loops so a tile fits the cache: 32 KiB / 4 B = 8,192 elements ⇒ 90 × 90\n' +
            'a 64 × 64 tile = 16 KiB, comfortably resident\n' +
            '⇒ column order pays the row-order miss count again',
          result: 'The cache size, not the algorithm, chose the tile.'
        }
      ],
      answer: 'Both loops read 1 048 576 elements and add 1 048 576 times. Row-major takes 65 536 ' +
        'misses and moves 4 MiB; column-major takes 1 048 576 misses and moves 64 MiB — 16×, which is ' +
        'exactly the number of int32 values in a 64-byte line. Nothing in an operation count can see ' +
        'this.'
    }],

    'space-complexity': [{
      title: 'Size the peak before writing the pipeline',
      goal: 'Compute peak memory for three shapes of the same job and pick one deliberately.',
      setup: '1 000 000 records of 64 bytes through a 3-stage pipeline; chunk size 1 024.',
      steps: [
        { do: 'Compute the materialised peak.', why: 'Every stage holds a full copy at the same time.',
          work: '1e6 × 64 B = 64 MB per stage\n3 stages live at once = 192 MB',
          result: '192 MB, and it scales with the input.' },
        { do: 'Compute the chunked peak.', why: 'Only the chunk in flight and its output are live.',
          work: '1024 × 64 B = 65.5 kB per chunk\n2 live at a time ≈ 131 kB',
          result: 'About 131 kB regardless of the input size.' },
        { do: 'Compute the streaming peak.', why: 'One item in flight per stage.',
          work: '64 B × 2 = 128 B',
          result: '128 B, independent of n — a factor of 1.5 million below materialising.' },
        { do: 'Compare time to first result.', why: 'The peak is not free; latency moves the other way.',
          work: 'materialised: 3 × 1e6 = 3,000,000 item-stages before any output\nstreaming:    3 item-stages',
          result: 'Streaming emits its first record a million times sooner.' },
        { do: 'Choose from the constraint you actually have.', why: 'The decision is a budget, not a preference.',
          work: 'container limit 256 MB ⇒ materialising fits, barely, and dies on a 2× input\nchunked at 1 024 ⇒ 0.05% of the limit',
          result: 'Chunking gives throughput close to materialising with a bounded peak.' }
      ],
      answer: 'Materialising peaks at 192 MB and scales with n; chunking at 1 024 peaks near 131 kB; ' +
        'streaming at 128 B. Streaming also reaches the first result 1 000 000× sooner.'
    }, {
      title: 'Count the stack an in-place sort still needs',
      goal: 'Price the memory an "O(1) extra space" algorithm actually uses, and the one line that fixes it.',
      setup: 'Quicksort over n = 1 000 000 elements, recursing on both halves. Frames are 96 bytes ' +
        '(saved registers, two indices, a pivot and the return address); the thread has a 1 MiB stack.',
      steps: [
        {
          do: 'Write down the claim being audited.',
          why: '"In place" is a statement about the array, and the stack is not the array.',
          work: 'auxiliary array space: O(1) — the partition swaps in place\n' +
            'stack space: one frame per live recursive call',
          result: 'The claim is true and incomplete.'
        },
        {
          do: 'Take the balanced case.',
          why: 'This is the case people have in mind when they call it O(log n) space.',
          work: 'depth = ⌈log₂ 10⁶⌉ = 20 frames\n' +
            'peak  = 20 × 96 B = 1,920 B',
          result: 'Under 2 kB — genuinely negligible.'
        },
        {
          do: 'Take the sorted-input case.',
          why: 'The worst case for time is also the worst case for the stack, and it is a common input.',
          work: 'each partition peels one element ⇒ depth = n = 1,000,000\n' +
            'peak = 1,000,000 × 96 B = 96,000,000 B = 91.6 MiB\n' +
            'ratio to the balanced case: 50,000×',
          result: '91.6 MiB of stack for an "O(1) space" sort.'
        },
        {
          do: 'Check it against the stack the thread actually has.',
          why: 'The failure is not slow — it is a crash, at a depth you can compute in advance.',
          work: '1 MiB / 96 B = 10,922 frames\n' +
            '10,922 < 1,000,000 ⇒ the stack overflows after ~1.1% of the recursion',
          result: 'It dies at depth 10 922, long before it is slow.'
        },
        {
          do: 'Apply the one-line fix and re-audit.',
          why: 'Recursing on the smaller side and looping on the larger caps the depth by construction.',
          work: 'the smaller side is ≤ n/2, so each recursive call at least halves n\n' +
            'depth ≤ ⌈log₂ n⌉ = 20 for any input, including sorted\n' +
            'peak = 1,920 B, worst case',
          result: 'The time is still Θ(n²) on sorted input; the space is now Θ(log n) on every input.'
        }
      ],
      answer: 'Quicksort recursing on both sides needs 96 MB of stack on sorted input — 91.6 MiB, ' +
        'against a 1 MiB stack that holds 10 922 frames, so it overflows at 1.1% of the way in. ' +
        'Recursing on the smaller side and looping on the larger bounds the depth at ⌈log₂ n⌉ = 20 ' +
        'frames, 1 920 bytes, for every input.'
    }],

    'empirical-complexity': [{
      title: 'Read a complexity class off a ratio table',
      goal: 'Identify an unknown algorithm from four measurements, and know when not to trust them.',
      setup: 'Measured medians: n=1000 → 1.9 ms, 2000 → 7.4 ms, 4000 → 29.8 ms, 8000 → 119.1 ms.',
      steps: [
        { do: 'Compute the ratios.', why: 'The ratio between successive doublings is the whole method.',
          work: '7.4 / 1.9  = 3.89\n29.8 / 7.4  = 4.03\n119.1 / 29.8 = 4.00',
          result: 'The ratio is stable at about 4.' },
        { do: 'Convert to an exponent.', why: 'For Θ(n^k) the ratio is 2^k.',
          work: 'k = log₂(4.00) = 2.00\n(from the earlier pair: log₂ 3.89 = 1.96)',
          result: 'k ≈ 2, so the cost is quadratic.' },
        { do: 'Check the fit against the alternatives.', why: 'A single reading is not evidence; agreement between methods is.',
          work: 'n log n at n=8000 predicts 1.9 × (8 × 13/10) ≈ 19.8 ms, observed 119.1 ms\nn² predicts 1.9 × 64 = 121.6 ms, observed 119.1 ms',
          result: 'Quadratic fits within 2.1%; n log n is off by 6×.' },
        { do: 'Ask what could have faked this.', why: 'The method is only as good as the measurement underneath.',
          work: 'is the input generator itself quadratic?\nwas the result consumed?\nwere caches warm and equal across sizes?\n\ngenerator: 0.3 ms of the 119.1 ms total (0.25%)\nimplied rate: 8000 / 119.1 ms = 67 items/ms',
          result: 'Rule those out before reporting the exponent.' }
      ],
      answer: 'Ratios of 3.89, 4.03 and 4.00 give k = log₂4 ≈ 2.0, and the n² prediction of 121.6 ms ' +
        'lands within 2.1% of the observed 119.1 ms, so the subject is quadratic.'
    }, {
      title: 'Two curves the doubling table cannot tell apart',
      goal: 'Find out what a ratio table can and cannot resolve, before trusting one.',
      setup: 'Exact values, no measurement noise: n log₂ n and n^1.1 over n = 1000, 2000, 4000, 8000, ' +
        '16 000.',
      steps: [
        {
          do: 'Tabulate the doubling ratios for both.',
          why: 'This is the whole diagnostic: cost(2n)/cost(n).',
          work: 'n log₂ n: 2.201, 2.182, 2.167, 2.154\n' +
            'n^1.1:    2.144, 2.144, 2.144, 2.144\n' +
            'largest disagreement: 2.6%',
          result: 'Two different functions, ratios within 2.6% of each other.'
        },
        {
          do: 'Convert both to an exponent.',
          why: 'The exponent is what the table is usually read for.',
          work: 'k = log₂(ratio)\n' +
            'n log₂ n ⇒ k = 1.116\n' +
            'n^1.1    ⇒ k = 1.100\n' +
            'difference: 0.016',
          result: 'Both round to "a bit worse than linear", which is where the reading stops.'
        },
        {
          do: 'Ask whether measurement noise could cover that.',
          why: 'A 1.5% difference in exponent has to survive the jitter of a real timer.',
          work: 'add ±2% jitter to the n log₂ n data\n' +
            'exponent moves 1.116 → 1.111\n' +
            'the model gap (0.016) is smaller than the wobble noise alone produces',
          result: 'At realistic noise the table cannot separate them at all.'
        },
        {
          do: 'Try the least-squares fit instead, and check it honestly.',
          why: 'A fit uses the absolute values, not just the ratios, so it should do better.',
          work: 'fit the exact n log₂ n points: best model O(n log n), relative residual 0.0000\n' +
            'fit the exact n^1.1 points:    best model O(n log n), relative residual 0.0050\n' +
            'fit the noisy n log₂ n points: best model O(n log n), relative residual 0.0087',
          result: 'The fit labels a true power law as O(n log n) — and its error there (0.0050) is ' +
            'smaller than the noise floor (0.0087).'
        },
        {
          do: 'State what would actually settle it.',
          why: 'The honest answer is more range or a mechanism, not a better statistic.',
          work: 'ratio of the two functions: (n log₂ n)/n^1.1 = log₂ n / n^0.1\n' +
            'at n = 10³ that is 9.97/2.00 = 5.0×; at n = 10⁶ it is 19.9/3.98 = 5.0×\n' +
            'the ratio moves by less than 1% per decade over any range you can measure',
          result: 'No measurement over a practical range decides this. Count the operations instead.'
        }
      ],
      answer: 'Over a 16× range, n log₂ n and n^1.1 give doubling ratios that differ by at most 2.6% ' +
        'and exponents of 1.116 against 1.100 — and a least-squares fit calls the power law O(n log n) ' +
        'with a smaller residual (0.0050) than 2% jitter puts on the real thing (0.0087). Empirical ' +
        'complexity separates n from n² comfortably and cannot separate these two at all.'
    }],

    benchmarking: [{
      title: 'Work out how much a broken benchmark flatters you',
      goal: 'Quantify each protocol mistake instead of just naming it.',
      setup: 'A workload whose honest median is 4.0 ms over 21 runs after 5 warm-up runs.',
      steps: [
        { do: 'Remove the warm-up.', why: 'The first runs include compilation, so they are slower, not faster.',
          work: 'run 1: 11.0 ms (interpreted)\nruns 2-3: 6.5, 5.0 ms (tiering up)\nmedian of 21 including them ≈ 4.3 ms',
          result: 'No warm-up reports 7.5% slower — it penalises rather than flatters.' },
        { do: 'Take a single sample.', why: 'One number has no spread, so nothing can be compared with it.',
          work: 'possible values: 3.8 … 11.0 ms\nreporting any one of them is defensible and useless',
          result: 'A single run can differ from the median by nearly 3×.' },
        { do: 'Remove the sink.', why: 'This is the one that produces impossible numbers.',
          work: 'result unused ⇒ the loop can be removed\nmeasured: 0.002 ms\nspeed-up over honest: 4.0 / 0.002 = 2000×',
          result: 'A 2000× "improvement" that measures an empty loop.' },
        { do: 'Apply the sanity check.', why: 'A throughput above physical capability is the tell.',
          work: '20 000 elements in 0.002 ms\n= 10⁷ elements per ms = 10¹⁰ per second\n⇒ faster than the memory can supply them',
          result: 'Reject the measurement before explaining it.' }
      ],
      answer: 'No warm-up costs 7.5%, a single sample can be 3× off, and removing the sink ' +
        'reports a 2000× speed-up that implies 10¹⁰ elements per second — physically impossible, ' +
        'which is how you catch it.'
    }, {
      title: 'Work out how many runs a 5% claim needs',
      goal: 'Turn "run it a few times" into a number that comes from the noise you measured.',
      setup: 'Two implementations, timed on the same machine. The measured run-to-run coefficient of ' +
        'variation is 8%. You want to claim a 5% difference, at 95% confidence with 80% power.',
      steps: [
        {
          do: 'Write the sample-size formula and its constant.',
          why: 'Everything except the constant is your data; the constant is the confidence you chose.',
          work: 'n per arm = 2·(z_α/2 + z_β)²·(CV/δ)²\n' +
            'z_0.025 = 1.960, z_0.20 = 0.842\n' +
            '2·(1.960 + 0.842)² = 15.698',
          result: 'n = 15.698 · (CV/δ)² — the rest is arithmetic.'
        },
        {
          do: 'Put your numbers in.',
          why: 'This is the run count the claim you want to make actually requires.',
          work: 'n = 15.698 × (0.08/0.05)² = 15.698 × 2.56 = 40.2\n' +
            '⇒ 41 runs of each implementation',
          result: '41 runs per arm, not "a few".'
        },
        {
          do: 'Invert it for the run count you were going to use.',
          why: 'The platform reports a median of 15 runs; that is a claim about resolution.',
          work: 'δ = CV · √(15.698/n)\n' +
            'n = 15 ⇒ δ = 8.2%\n' +
            'n = 21 ⇒ δ = 6.9%\n' +
            'n = 41 ⇒ δ = 5.0%',
          result: '15 runs can only support "faster by 8% or more".'
        },
        {
          do: 'Compare buying runs against buying quiet.',
          why: 'Both appear squared in the formula, and one of them is usually free.',
          work: 'CV 8% → 3% (pin the CPU, close the browser tabs, fix the input):\n' +
            'n = 15.698 × (0.03/0.05)² = 5.7 ⇒ 6 runs\n' +
            'halving the CV divides the runs needed by 4',
          result: 'Reducing noise is quadratically cheaper than adding runs.'
        },
        {
          do: 'Price the claim you should not make.',
          why: 'A 2% claim is the one that always turns out to be a measurement artefact.',
          work: 'δ = 2% at CV 8%: n = 15.698 × 16 = 251.2 ⇒ 252 runs per arm\n' +
            'at 4 s per run that is 34 minutes of measurement',
          result: 'If you have not paid that, do not publish the 2%.'
        }
      ],
      answer: 'At a measured CV of 8%, a defensible 5% claim needs 41 runs per arm; the 15 runs the ' +
        'platform reports by default resolve 8.2%. Cutting the CV to 3% brings it down to 6 runs, ' +
        'because run count scales with the square of the noise — and a 2% claim would cost 252 runs.'
    }]
  });
}(typeof window !== 'undefined' ? window : null));
