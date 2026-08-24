/** Reference entries for randomised design, contraction and Monte Carlo (M19.1-M19.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'randomised-design': {
      summary: 'The two error models measured on one pair of algorithms: a Monte Carlo primality ' +
        'test whose failure rate is driven down by repetition, and a Las Vegas repeat-until-' +
        'success whose runtime distribution is the thing at risk.',
      intuition: 'Randomised is not flaky. Twenty rounds put the failure probability below the ' +
        'rate at which the machine silently corrupts memory, and that is a defensible position ' +
        'rather than a compromise.',
      formulation: {
        equations: [
          {
            label: 'Liar densities on 561, over all 558 candidate bases',
            expr: 'the fraction of bases that fail to expose a known composite',
            terms: [
              { sym: 'Fermat', meaning: '318 liars, 56.99% — and on a Carmichael number every coprime base is one' },
              { sym: 'Miller–Rabin', meaning: '8 liars, 1.43%, against Rabin’s proven ceiling of 25%' },
              { sym: 'the difference', meaning: 'one extra check: no non-trivial square root of 1 during the squaring chain' },
              { sym: 'consequence', meaning: '0.57ᵏ needs about forty rounds to reach 10⁻¹⁰; 0.0143ᵏ needs five' }
            ]
          },
          {
            label: 'Amplification measured over 20 000 seeds per round count',
            expr: 'failure rate against (liar density)ᵏ and against 4⁻ᵏ',
            terms: [
              { sym: 'k = 1', meaning: '277 of 20 000 = 1.385e-2, against a predicted 1.43e-2 and a bound of 0.25' },
              { sym: 'k = 2', meaning: '8 of 20 000 = 4.000e-4, against 2.06e-4 and 6.25e-2' },
              { sym: 'k = 3', meaning: '0 of 20 000, reported as < 5.0e-5 rather than as zero' },
              { sym: 'why not zero', meaning: 'a rate below one over the trial count is an upper bound, not an observation' }
            ]
          },
          {
            label: 'The Las Vegas runtime at p = 0.2, over 4 000 runs',
            expr: 'a geometric distribution, summarised by its quantiles rather than its mean',
            terms: [
              { sym: 'mean', meaning: '5.074 measured against 1/p = 5.000' },
              { sym: 'median', meaning: '4, against ln 2 / −ln(1 − p) = 3.11' },
              { sym: '99th percentile', meaning: '21, against ln 100 / −ln(1 − p) = 20.64 — four times the mean' },
              { sym: 'budget of twice the mean', meaning: '454 of 4 000 runs exceed 10, which is 11.3% against a predicted 10.7%' },
              { sym: 'worst run', meaning: '36 attempts; the distribution has no maximum' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A one-sided test never rejects a correct input',
          why: 'It is what makes repetition free: no vote, no threshold, and no false positives to accumulate.',
          breaks: 'A false rejection is a bug rather than bad luck, so the false-alarm counter is a correctness test.'
        },
        {
          name: 'Independent rounds multiply their failure probabilities',
          why: 'Turns a mediocre per-round guarantee into an arbitrarily strong one for linear cost.',
          breaks: 'Reusing a base, or drawing bases from a small set, destroys the independence and the product no longer applies.'
        },
        {
          name: 'The randomness belongs to the algorithm, not to the input',
          why: 'A claim about your own coins holds on every input, including one an adversary chose.',
          breaks: 'An average-case analysis over inputs is void the moment somebody picks the input on purpose.'
        }
      ],
      complexity: [
        { operation: 'one Miller–Rabin round', average: 'one modular exponentiation, O(log³ n) bit operations', worst: 'the same — the runtime is fixed, which is what makes it Monte Carlo' },
        { operation: 'k rounds to failure δ', average: 'k = log(1/δ)/log(1/p) rounds', worst: 'p is the per-instance liar density, which must be bounded above for the formula to mean anything' },
        { operation: 'Las Vegas repeat-until-success', average: '1/p attempts', worst: 'unbounded; the 99th percentile is ln 100 / −ln(1 − p) ≈ 4.6/p for small p' },
        { operation: 'stopping a Las Vegas run at a deadline', average: 'the deadline', worst: 'converts it to Monte Carlo with error equal to the overrun probability' }
      ],
      failureModes: [
        {
          symptom: 'A probabilistic test is rejected in review as "not deterministic".',
          cause: 'The failure probability was never computed, so it is being compared against certainty rather than against the rest of the system.',
          fix: 'Compute it. At 20 rounds it is below 10⁻¹², which is under the machine’s soft-error rate.'
        },
        {
          symptom: 'A composite passes every round of a Fermat test, forever.',
          cause: 'It is a Carmichael number, so amplification converges to certainty about the wrong answer.',
          fix: 'Use Miller–Rabin. The extra square-root check is what gives a per-round bound that holds for every composite.'
        },
        {
          symptom: 'A retry loop has a small, stubborn error rate that no amount of budget removes.',
          cause: 'The budget was set from the mean of a geometric distribution whose tail is heavy relative to it.',
          fix: 'Set the budget from the quantile: ln(1/δ)/−ln(1 − p). If that is unacceptable, raise p rather than the budget.'
        },
        {
          symptom: 'A randomised algorithm behaves well in testing and badly in production.',
          cause: 'The analysis assumed a random input rather than randomising the algorithm; production supplies structured input.',
          fix: 'Move the randomness inside — a random pivot, a seeded hash — so the guarantee holds for every input.'
        },
        {
          symptom: 'A measured failure rate sits above its stated bound.',
          cause: 'Usually sampling error at a small trial count; occasionally a genuinely broken bound.',
          fix: 'Report the standard error beside the rate. √(p(1−p)/N) at N = 400 is 2.5 points, which explains most apparent violations.'
        }
      ],
      inTheWild: [
        { system: 'OpenSSL and every TLS library', how: 'generates RSA primes with probabilistic Miller–Rabin, using round counts set by the key size — the deterministic alternatives are far slower and the error is below every other risk in the system.' },
        { system: 'Randomised quicksort in libstdc++ and Go’s pdqsort', how: 'chooses pivots without trusting the input order, which is randomising the algorithm rather than assuming a random input — and is why an adversarial input degrades gracefully rather than quadratically.' },
        { system: 'Exponential backoff with jitter', how: 'is a Las Vegas retry whose budget is set from a tail quantile; AWS’s published guidance is explicitly about the tail rather than the mean.' }
      ],
      sources: [
        { title: 'Randomized Algorithms', author: 'Motwani and Raghavan', note: 'Chapter 1 sets up the Monte Carlo / Las Vegas distinction and the amplification arguments used here.' },
        { title: 'Probability and Computing', author: 'Mitzenmacher and Upfal', note: 'The concentration inequalities, and the clearest treatment of why an expectation is not a guarantee.' },
        { title: 'Probabilistic algorithm for testing primality', author: 'Michael O. Rabin', note: 'The 1980 paper proving that at most a quarter of the bases below n can fool the test on a composite.' },
        { title: 'Prime Numbers: A Computational Perspective', author: 'Crandall and Pomerance', note: 'Carmichael numbers, witness sets, and how round counts are chosen in practice.' }
      ]
    },

    'random-contraction': {
      summary: 'Karger’s contraction measured against an enumeration oracle on two families: one ' +
        'with a unique minimum cut where the bound is loose by a factor of twenty-three, and the ' +
        'cycle where it is exact and the counting corollary is attained.',
      intuition: 'A success probability of 1/n² is fine when a run is quadratic. The cost model ' +
        'is expected total work, and the analysis also hands you a bound on how many minimum ' +
        'cuts a graph can have.',
      formulation: {
        equations: [
          {
            label: 'The success bound and where it comes from',
            expr: 'Pr[a nominated minimum cut survives] ≥ 2/(n(n−1))',
            terms: [
              { sym: 'the degree bound', meaning: 'a minimum cut of size k forces every degree ≥ k, so |E| ≥ nk/2' },
              { sym: 'per contraction', meaning: 'Pr[hit a cut edge] ≤ k/|E| ≤ 2/n' },
              { sym: 'the product', meaning: '∏ (1 − 2/(n − i)) telescopes to exactly 2/(n(n−1))' },
              { sym: 'at n = 12', meaning: '2/132 = 1.52%' }
            ]
          },
          {
            label: 'Two cliques joined by two edges: 12 vertices, 32 edges, minimum cut 2',
            expr: 'measured over 2 000 runs against the enumeration oracle',
            terms: [
              { sym: 'optimal partitions', meaning: '1, from 2 047 examined' },
              { sym: 'success rate', meaning: '691 of 2 000 = 34.55%, against a bound of 1.52% — the bound is loose here' },
              { sym: 'the uniform-supernode rule', meaning: '468 of 2 000 = 23.40%; picking a vertex first is a different distribution' },
              { sym: 'work for 99% confidence', meaning: '302 runs × 10 contractions = 3 020 at the bound; 11 runs = 110 at the measured rate' }
            ]
          },
          {
            label: 'The cycle C₁₂, where the bound is tight',
            expr: 'the same algorithm, two different events',
            terms: [
              { sym: 'minimum cuts', meaning: '66 = 12 · 11 / 2 exactly, confirmed by enumeration' },
              { sym: 'found SOME minimum cut', meaning: '100.00% of runs, and all 66 distinct cuts turned up' },
              { sym: 'found a NOMINATED cut', meaning: '1.65%, against the bound of 1.52%' },
              { sym: 'the corollary', meaning: 'disjoint events each ≥ 2/(n(n−1)) means at most n(n−1)/2 minimum cuts' }
            ]
          },
          {
            label: 'Karger–Stein on the same graph',
            expr: 'T(n) = 2T(n/√2) + O(n²) = O(n² log n) per call',
            terms: [
              { sym: 'one call', meaning: '64 contractions across 63 recursive calls, and it found the cut' },
              { sym: 'why n/√2', meaning: 'survival to t vertices is about t²/n², so stopping there keeps each stage near a half' },
              { sym: 'success probability', meaning: 'Ω(1/log n) per call, against Ω(1/n²) for plain contraction' },
              { sym: 'total for high probability', meaning: 'O(n² log³n) against O(n⁴ log n)' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Edges are drawn uniformly from the surviving edges',
          why: 'The analysis is a statement about |E| ≥ nk/2, so it only holds for a draw from E.',
          breaks: 'Choosing a supernode first over-samples the sparse side of the cut; the measured rate falls from 34.55% to 23.40% with no error raised.'
        },
        {
          name: 'Self-loops are discarded and parallel edges are kept',
          why: 'Multiplicity is what makes a dense region progressively harder to split.',
          breaks: 'Deduplicating edges "for tidiness" removes the effect the analysis relies on.'
        },
        {
          name: 'A run always returns a cut, never an error',
          why: 'It is a Monte Carlo algorithm: the answer may be too large and is always a valid cut.',
          breaks: 'That is exactly why the success count needs an oracle — a wrong answer is a plausible answer.'
        },
        {
          name: 'The bound is about one nominated cut',
          why: 'Matching the measured event to the analysed one is what makes the comparison meaningful.',
          breaks: 'On a graph with many minimum cuts, measuring "found any" reports 100% and makes the bound look absurd.'
        }
      ],
      complexity: [
        { operation: 'one contraction run', average: 'n − 2 merges; O(n²) with an adjacency matrix or O(m) per merge with a DSU', worst: 'the same — the runtime is deterministic' },
        { operation: 'plain repetition to failure δ', average: 'n(n−1)/2 · ln(1/δ) runs, so O(n⁴ log n) total', worst: 'the measured rate is often far better; at n = 12 the demo needs 11 runs rather than 302' },
        { operation: 'Karger–Stein, one call', average: 'O(n² log n)', worst: 'success probability Ω(1/log n), so O(n² log³n) for high probability' },
        { operation: 'the enumeration oracle', average: '2ⁿ⁻¹ − 1 partitions', worst: '2 047 at n = 12; unusable past about 22 vertices, which is why it is only a test fixture' }
      ],
      failureModes: [
        {
          symptom: 'The measured success rate is far below the bound.',
          cause: 'Almost always the contraction rule: a uniformly random supernode rather than a uniformly random edge.',
          fix: 'Draw from the surviving edge list. The demo ships both rules so the difference can be seen rather than argued about.'
        },
        {
          symptom: 'The bound looks absurdly pessimistic.',
          cause: 'The measurement is counting "found a minimum cut" while the bound is about one nominated cut.',
          fix: 'Decide which event the caller needs and measure that one; on the cycle they differ by a factor of sixty.'
        },
        {
          symptom: 'The algorithm returns cuts that are consistently one or two above the minimum.',
          cause: 'Too few repetitions — a single run succeeds with probability Θ(1/n²).',
          fix: 'Repeat, and report the number of runs beside the answer. A cut without a run count is a number without a confidence.'
        },
        {
          symptom: 'Karger–Stein is slower than plain repetition.',
          cause: 'On a small graph the recursion overhead dominates, and the constant in the recurrence is not small.',
          fix: 'Dispatch on size, as with every divide-and-conquer algorithm; the crossover is worth measuring rather than assuming.'
        }
      ],
      inTheWild: [
        { system: 'Network reliability analysis', how: 'uses minimum cuts to find the sets of links whose simultaneous failure disconnects a network, and Karger’s sampling theorem to do it on a sparsified graph.' },
        { system: 'Benczúr–Karger cut sparsifiers', how: 'keep each edge with a probability derived from its connectivity, preserving every cut to within (1 ± ε) — the basis of near-linear-time approximate max-flow.' },
        { system: 'Image segmentation and clustering', how: 'treats minimum cuts in a similarity graph as segment boundaries; contraction is the cheap way to explore many candidate cuts rather than one optimal one.' }
      ],
      sources: [
        { title: 'Global min-cuts in RNC, and other ramifications of a simple min-cut algorithm', author: 'David R. Karger', note: 'The 1993 paper with the contraction algorithm and the n(n−1)/2 counting corollary.' },
        { title: 'A new approach to the minimum cut problem', author: 'Karger and Stein', note: 'The recursive improvement and the O(n² log³n) analysis.' },
        { title: 'Randomized Algorithms', author: 'Motwani and Raghavan', note: 'Section 10.2 gives the telescoping product in full, including the degree bound most treatments skip.' },
        { title: 'Random sampling in cut, flow, and network design problems', author: 'David R. Karger', note: 'The sampling theorem that makes contraction a general technique rather than one algorithm.' }
      ]
    },

    'monte-carlo-estimation': {
      summary: 'Five estimators on the same budget with their variance reductions measured, the ' +
        '1/√N rate confirmed against a scaled prediction, the dimension crossover against a grid ' +
        'rule located at d = 5, and a tail probability where plain sampling returns exactly zero.',
      intuition: 'Monte Carlo error does not depend on the dimension, which is why it wins in ' +
        'thirty and loses by nine orders of magnitude in one.',
      formulation: {
        equations: [
          {
            label: 'Five estimators on ∫₀¹ eˣ dx = 1.718282, 4 000 evaluations, seed 21',
            expr: 'estimate, error, sample variance, and coverage of the 95% interval over 200 seeds',
            terms: [
              { sym: 'plain', meaning: 'error 3.748e-3, variance 0.233670, coverage 96.0%' },
              { sym: 'antithetic', meaning: 'variance 0.003777 — a 61.87× reduction — error 2.966e-3, coverage 96.0%' },
              { sym: 'control variate (x, mean ½)', meaning: 'variance 0.003884, 60.16×, error 2.142e-3, coverage 95.0%' },
              { sym: 'stratified', meaning: 'variance 0.242093 — no reduction — and error 1.088e-6, a factor of 3 445; coverage 100.0%' },
              { sym: 'van der Corput', meaning: 'error 5.214e-4, no interval at all because the points are deterministic' }
            ]
          },
          {
            label: 'The same five on ∫₀¹ sin²(10x) dx, where two of them fail',
            expr: 'the ranking rearranges when the integrand stops being monotone',
            terms: [
              { sym: 'antithetic', meaning: '1.41× variance reduction, and the measured error gets 2.5 times WORSE' },
              { sym: 'control variate', meaning: '1.01× — x is uncorrelated with sin²(10x), so the technique does nothing' },
              { sym: 'stratified', meaning: 'still 412× on the error' },
              { sym: 'quasi', meaning: '57.7× on the error' }
            ]
          },
          {
            label: 'The rate, measured over 40 seeds per sample count',
            expr: 'mean error against the first row scaled by √(N₀/N)',
            terms: [
              { sym: 'N = 16', meaning: '1.083e-1 (the anchor)' },
              { sym: 'N = 4 096', meaning: '7.898e-3 measured against 6.767e-3 predicted' },
              { sym: 'N = 65 536', meaning: '1.590e-3 against 1.692e-3' },
              { sym: 'van der Corput at the same sizes', meaning: '5.115e-2 down to 1.311e-5, tracking a star discrepancy of 6.250e-2 down to 1.526e-5' }
            ]
          },
          {
            label: 'Dimension, at a fixed budget of 4 096 points',
            expr: 'a midpoint product rule against sampling, on an integrand whose exact value is 1',
            terms: [
              { sym: 'd = 1', meaning: '4 096 nodes per axis, grid error 2.48e-9 against sampling’s 3.19e-3' },
              { sym: 'd = 5', meaning: '5 nodes per axis, 8.30e-3 against 9.34e-3 — the last row the grid wins' },
              { sym: 'd = 8', meaning: '2 nodes per axis, 7.98e-2 against 1.11e-2' },
              { sym: 'the sampling column', meaning: 'stays between 3.2e-3 and 1.2e-2 throughout, because 1/√N does not know about d' }
            ]
          },
          {
            label: 'P(Z > 4) = 3.167124e-5, 20 000 draws per estimator',
            expr: 'importance sampling, and the diagnostic that catches a bad proposal',
            terms: [
              { sym: 'plain sampling', meaning: '0 hits, estimate exactly 0, standard error exactly 0 — 31 574 draws are needed per expected hit' },
              { sym: 'shift 2', meaning: '3.907% relative error, 477 hits, weight ESS 387.3' },
              { sym: 'shift 4', meaning: '0.121% relative error, 10 059 hits, weight ESS 3 628.9' },
              { sym: 'shift 7', meaning: '15.709% relative error, 19 982 hits — the best hit count — and weight ESS 75.4' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The estimator is unbiased for any valid proposal',
          why: 'Importance sampling changes the variance, never the target, so a bad proposal is slow rather than wrong.',
          breaks: 'A proposal with lighter tails than the target has infinite variance, and the sample mean then converges to nothing at all.'
        },
        {
          name: 'The standard error is σ/√N only for independent, identically distributed draws',
          why: 'It is the formula every library applies by default.',
          breaks: 'Stratified points are not identically distributed and correlated chain draws are not independent; in both cases the reported interval is wrong, in opposite directions.'
        },
        {
          name: 'A deterministic point set has no standard error',
          why: 'Reporting zero would claim certainty; reporting nothing is honest.',
          breaks: 'The Koksma–Hlawka bound needs the integrand’s total variation, which is usually unknown — so quasi-Monte Carlo trades an error bar for a faster rate.'
        }
      ],
      complexity: [
        { operation: 'plain estimate to relative error ε', average: 'O(σ²/ε²) samples, independent of dimension', worst: 'the same; the constant is σ, which is what every technique here attacks' },
        { operation: 'antithetic sampling', average: 'the same evaluations, variance (1 + ρ)/2 times plain', worst: 'ρ > 0 makes it worse; on the oscillating integrand the measured error rose 2.5×' },
        { operation: 'control variate', average: '(1 − ρ²) times the variance, plus one extra evaluation per draw', worst: 'ρ near zero buys nothing and costs the evaluation' },
        { operation: 'product quadrature in d dimensions', average: 'mᵈ points for error O(m⁻²) per axis', worst: 'at a fixed budget m collapses as d grows; unusable past about six dimensions' },
        { operation: 'importance sampling', average: 'the same N, with variance depending entirely on the proposal', worst: 'unbounded, and the weight ESS is the only warning' }
      ],
      failureModes: [
        {
          symptom: 'An estimated probability comes back as exactly zero with a standard error of zero.',
          cause: 'The event is rarer than one over the sample count, so no draw hit it.',
          fix: 'Importance sampling, or at minimum report the sample count so a zero can be read as "below 1/N" rather than as zero.'
        },
        {
          symptom: 'An importance-sampled estimate looks converged and is badly wrong.',
          cause: 'The proposal is shifted too far, so a handful of draws carry all the weight.',
          fix: 'Report the effective sample size of the weights. At a shift of 7 the demo has 19 982 hits and an ESS of 75.'
        },
        {
          symptom: 'A variance-reduction technique makes the answer worse.',
          cause: 'Antithetic pairing on a non-monotone integrand, or a control variate with near-zero correlation.',
          fix: 'Measure the achieved reduction rather than assuming one, and report the correlation the control variate actually has.'
        },
        {
          symptom: 'A stratified estimator reports a huge confidence interval around a very accurate answer.',
          cause: 'The sample-variance formula assumes identically distributed draws, which stratified points are not.',
          fix: 'Derive the interval from the stratum width instead; the demo’s coverage measurement shows it is conservative at 100% against a nominal 95%.'
        },
        {
          symptom: 'A one-dimensional integral is being estimated by sampling.',
          cause: 'Reaching for Monte Carlo by habit.',
          fix: 'Use quadrature. At 4 096 points the demo measures the midpoint rule at 2.48e-9 against sampling’s 3.19e-3.'
        }
      ],
      inTheWild: [
        { system: 'Financial derivative pricing', how: 'values path-dependent options in tens of dimensions by sampling, with antithetic and control variates as standard practice — a closed-form Black–Scholes price is the usual control.' },
        { system: 'Physically based rendering (path tracing)', how: 'is importance sampling of the rendering equation; the noise in an under-sampled image is exactly the 1/√N error, and every "denoiser" is a variance-reduction technique.' },
        { system: 'Sobol and Halton sequences in quantitative finance', how: 'replace random draws with low-discrepancy ones for a near-1/N rate in moderate dimensions, at the cost of having no error bar to report.' }
      ],
      sources: [
        { title: 'Monte Carlo Statistical Methods', author: 'Robert and Casella', note: 'Variance reduction and importance sampling, including the effective-sample-size diagnostic.' },
        { title: 'Random Number Generation and Quasi-Monte Carlo Methods', author: 'Harald Niederreiter', note: 'The Koksma–Hlawka inequality and the discrepancy theory behind low-discrepancy sequences.' },
        { title: 'Probability and Computing', author: 'Mitzenmacher and Upfal', note: 'Chapter 10 on the Monte Carlo method, sample sizes and the relationship between counting and sampling.' },
        { title: 'Simulation and the Monte Carlo Method', author: 'Rubinstein and Kroese', note: 'The rare-event chapter, where the failure of naive estimation and the cross-entropy method for choosing proposals are set out.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
