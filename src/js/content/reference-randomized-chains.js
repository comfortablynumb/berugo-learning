/** Reference entries for MCMC, fingerprinting and approximation ratios (M19.4-M19.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'markov-chain-monte-carlo': {
      summary: 'A proposal-width sweep with acceptance rate, correlation time and effective ' +
        'sample size side by side, so the chain that looks healthiest can be seen to be the ' +
        'worst; and four dispersed chains whose disagreement is the only evidence any of them ' +
        'is wrong.',
      intuition: 'A chain that has not mixed produces confident, wrong answers with a small ' +
        'standard error. The diagnostics are not optional and effective sample size is the ' +
        'number that matters, not the draw count.',
      formulation: {
        equations: [
          {
            label: 'The proposal-width sweep: a two-mode mixture, 20 000 steps, seed 42',
            expr: 'acceptance rate, correlation time and effective sample size',
            terms: [
              { sym: 'width 0.1', meaning: '92.7% accepted, τ = 267.2, ESS 74.9, mean error 1.3849' },
              { sym: 'width 0.3', meaning: '79.1%, τ = 861.7, ESS 23.2 — the worst in the table, because it crosses just often enough' },
              { sym: 'width 1', meaning: '43.5%, τ = 114.4, ESS 174.8, error 0.1380' },
              { sym: 'width 2.4', meaning: '17.1%, τ = 35.7, ESS 559.7, error 0.0663 — the best chain, and the second-lowest acceptance' },
              { sym: 'width 12', meaning: '1.2%, τ = 132.1, ESS 151.4, error 0.3838' }
            ]
          },
          {
            label: 'The two error bars at width 0.1',
            expr: 'the naive σ/√N against the honest σ/√ESS',
            terms: [
              { sym: 'naive', meaning: '0.00557, computed as if the draws were independent' },
              { sym: 'honest', meaning: '0.09099, using ESS = 74.9 instead of N = 20 000 — 16.3× wider' },
              { sym: 'the actual error', meaning: '1.3849, which is 249 naive bars and 15 honest ones' },
              { sym: 'why', meaning: 'the chain spent 1.3% of its time on the second mode against a true weight of 35.0%' }
            ]
          },
          {
            label: 'Four chains from −3, −1, +1 and +3 at width 0.1',
            expr: 'Gelman–Rubin R̂, comparing between-chain against within-chain variance',
            terms: [
              { sym: 'chain means', meaning: '−2.2719, −1.6051, −1.4836, +1.2352 for a true mean of −0.6' },
              { sym: 'second-mode shares', meaning: '0.0%, 9.3%, 15.0%, 80.3% — no two chains agree' },
              { sym: 'R̂', meaning: '1.5081, against a conventional threshold of 1.01' },
              { sym: 'its limit', meaning: 'it cannot detect a mode that none of the chains found' }
            ]
          },
          {
            label: 'Geyer’s initial-positive-sequence truncation',
            expr: 'τ = 1 + 2Σ ρₖ, summed in consecutive PAIRS until a pair is negative',
            terms: [
              { sym: 'why pairs', meaning: 'individual lags go negative by noise, so stopping at the first one underestimates τ' },
              { sym: 'the direction of the error', meaning: 'underestimating τ overestimates ESS, which flatters exactly the chains you are trying to catch' },
              { sym: 'ESS', meaning: 'N/τ, reported instead of N' },
              { sym: 'a curve still above zero at the window edge', meaning: 'means τ exceeds the window, so the reported ESS is an upper bound' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A rejection re-records the current position',
          why: 'The repeated draws are what give high-density regions their weight.',
          breaks: 'Appending only on acceptance samples a different distribution, and nothing about the output looks unusual.'
        },
        {
          name: 'Detailed balance makes π stationary; it says nothing about the time to reach it',
          why: 'It is what the acceptance rule is derived from, and what guarantees the chain is aimed at the right target.',
          breaks: 'A correct chain that has not mixed is still correct in the limit and useless in practice.'
        },
        {
          name: 'The effective sample size, not the draw count, sizes the interval',
          why: 'It is the only quantity that makes two runs of different lengths comparable.',
          breaks: 'Reporting σ/√N on a correlated chain understates the interval by √τ, which here is a factor of 16.'
        },
        {
          name: 'A single chain has nothing to disagree with',
          why: 'It is why every serious sampler runs several from dispersed starting points.',
          breaks: 'One chain reports a mean and no diagnostic on it can detect a mode it never visited.'
        }
      ],
      complexity: [
        { operation: 'one Metropolis step', average: 'one target evaluation and one uniform draw', worst: 'the same; the cost is in the number of steps, never the step' },
        { operation: 'steps for a given accuracy', average: 'τ/ε² effective samples, so τ times as many draws', worst: 'τ is a property of the chain and the target, and can be in the thousands' },
        { operation: 'autocorrelation to lag L', average: 'O(N·L) directly, or O(N log N) through an FFT', worst: 'the demo computes it directly over an 8 000-step window' },
        { operation: 'Gibbs sweep', average: 'one exact conditional draw per coordinate, always accepted', worst: 'needs the conditionals in closed form, and mixes badly on strongly correlated targets' }
      ],
      failureModes: [
        {
          symptom: 'The acceptance rate is above 90% and everything looks fine.',
          cause: 'The proposal is far too small: the target barely differs between consecutive points, so almost everything is accepted and almost nothing is explored.',
          fix: 'Widen the proposal until the acceptance rate falls to roughly 0.2–0.4, and confirm with effective sample size rather than with the rate.'
        },
        {
          symptom: 'The posterior mean has a tiny standard error and is obviously wrong.',
          cause: 'σ/√N was computed on correlated draws.',
          fix: 'Divide by the effective sample size instead. At τ = 267 the correct bar is 16 times wider.'
        },
        {
          symptom: 'Four chains report four different answers.',
          cause: 'The chain cannot cross between modes, so each is sampling a different part of the target.',
          fix: 'A better proposal — larger steps, tempering, or a mixture proposal that occasionally jumps. Running longer does not help.'
        },
        {
          symptom: 'Estimates change when the chain is thinned.',
          cause: 'Thinning discards information; it reduces storage and never improves an estimate.',
          fix: 'Keep every draw and report ESS. Thin only when memory forces it, and say so.'
        },
        {
          symptom: 'A Gibbs sampler accepts every move and still produces correlated draws.',
          cause: 'Strong correlation between coordinates makes each conditional nearly deterministic, so the chain crawls along a ridge.',
          fix: 'Reparameterise, or block-update the correlated coordinates together. Acceptance is not the diagnostic here or anywhere.'
        }
      ],
      inTheWild: [
        { system: 'Stan', how: 'reports R̂ and effective sample size for every parameter by default and warns when R̂ exceeds 1.01 — the diagnostics are in the output rather than in an optional package, precisely because they are not optional.' },
        { system: 'PyMC and emcee', how: 'ship adaptive proposals and ensemble samplers whose entire purpose is to find the proposal scale automatically, because the optimum is interior and instance-specific.' },
        { system: 'Statistical physics simulations', how: 'have used Metropolis since 1953 for exactly the same reason — the Boltzmann distribution is known only up to its partition function, which is the normalising constant nobody can compute.' }
      ],
      sources: [
        { title: 'Equation of state calculations by fast computing machines', author: 'Metropolis, Rosenbluth, Rosenbluth, Teller and Teller', note: 'The 1953 paper. The acceptance rule has not changed.' },
        { title: 'Monte Carlo sampling methods using Markov chains and their applications', author: 'W. K. Hastings', note: 'The 1970 generalisation to asymmetric proposals, and where the Hastings ratio comes from.' },
        { title: 'Inference from iterative simulation using multiple sequences', author: 'Gelman and Rubin', note: 'R̂, and the argument for dispersed starting points that this section’s four-chain table reproduces.' },
        { title: 'Practical Markov Chain Monte Carlo', author: 'Charles J. Geyer', note: 'The initial-positive-sequence estimator for the autocorrelation time, and why truncating at the first negative lag is wrong.' },
        { title: 'Handbook of Markov Chain Monte Carlo', author: 'Brooks, Gelman, Jones and Meng (editors)', note: 'The optimal-scaling results, including where the 0.234 acceptance rate comes from.' }
      ]
    },

    'fingerprinting': {
      summary: 'Freivalds measured over 4 000 seeds at each round count with a structurally zero ' +
        'false-alarm column, Schwartz–Zippel across four field sizes on true and false claims, ' +
        'and a fingerprint comparison where the ordinary case does not test the bound and a ' +
        'constructed pair does.',
      intuition: 'Verifying a result can be asymptotically cheaper than producing it, which is ' +
        'the foundation of every "trust but verify" protocol — and the practical version is to ' +
        'look for an identity the answer must satisfy before writing a second implementation.',
      formulation: {
        equations: [
          {
            label: 'Freivalds on a 60 × 60 product with one corrupted entry, 4 000 seeds per round',
            expr: 'measured miss rate against 2⁻ᵏ, and false alarms on the correct product',
            terms: [
              { sym: 'k = 1', meaning: '2 034 of 4 000 missed = 0.50850, against a predicted 0.50000' },
              { sym: 'k = 2, 3, 4', meaning: '0.24550, 0.12300, 0.05650' },
              { sym: 'k = 8', meaning: '0.00500, against a bound of 0.00391' },
              { sym: 'false alarms', meaning: '0 at every round count, from 32 000 tests in total' }
            ]
          },
          {
            label: 'The cost comparison at n = 60',
            expr: 'computing the product against checking it',
            terms: [
              { sym: 'schoolbook multiply', meaning: '432 000 multiply-adds' },
              { sym: 'eight verification rounds', meaning: '43 200 operations — a factor of 10' },
              { sym: 'why it grows', meaning: 'multiplication is cubic and verification is quadratic, so the ratio is Θ(n)' },
              { sym: 'and it does not care how C was produced', meaning: 'Strassen, a GPU, or an untrusted machine — the check is the same' }
            ]
          },
          {
            label: 'Schwartz–Zippel over ℤ mod 1009, 2 000 draws per claim',
            expr: 'measured accept rate against the d/|F| bound',
            terms: [
              { sym: '(x + y)(x − y) = x² − y²', meaning: 'true; accepted 2 000 of 2 000' },
              { sym: '(x + y)³ = x³ + 3x²y + 3xy² + y³', meaning: 'true; accepted 2 000 of 2 000' },
              { sym: '(x + y)(x − y) = x² − y² + xy', meaning: 'false; accepted 3 of 2 000 = 0.00150 against a bound of 0.00198' },
              { sym: '∏(xᵢ − i) = 0', meaning: 'false; accepted 4 of 2 000 = 0.00200 against a bound of 0.00297 — and 2.8% over ℤ mod 101' }
            ]
          },
          {
            label: 'Polynomial fingerprints, 4 000 random bases per field',
            expr: 'the ordinary case against a pair constructed to attain the bound',
            terms: [
              { sym: 'one position differs', meaning: '0 collisions of 4 000 at every field size — the difference is a monomial whose only root is 0' },
              { sym: 'built on 8 roots, p = 101', meaning: '343 of 4 000 = 0.08575 against a bound of 8/101 = 0.0792' },
              { sym: 'p = 1 009 and 10 007', meaning: '0.01025 and 0.00125, against 0.00793 and 0.000799' },
              { sym: 'the construction', meaning: 'choose the bases you want to defeat, expand ∏(x − rᵢ), use its coefficients as the difference' }
            ]
          },
          {
            label: 'A Merkle tree over 79 chunks',
            expr: 'what one chunk costs to verify against the alternative',
            terms: [
              { sym: 'proof length', meaning: '7 sibling hashes, which is ⌈log₂ 79⌉' },
              { sym: 'the alternative', meaning: 're-hashing all 5 000 characters' },
              { sym: 'a modified chunk', meaning: 'rejected by the same proof, because the recomputed root differs' },
              { sym: 'the caveat', meaning: 'the hash here is a mixing function, so this shows the structure and not the security' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A true identity is never rejected',
          why: 'It makes repetition free — no threshold, no vote, no accumulating false positives.',
          breaks: 'A false alarm is a bug, not bad luck, so the false-alarm counter is a correctness test rather than a statistic.'
        },
        {
          name: 'The random point is drawn after the inputs are fixed',
          why: 'The bound quantifies over the point for fixed inputs, which is the only order an adversary cannot exploit.',
          breaks: 'A fixed base or a fixed vector lets a collision be constructed offline, and the bound then describes nothing.'
        },
        {
          name: 'The field must be larger than the degree',
          why: 'The bound is d/|F|, so a small field makes the test weak or vacuous.',
          breaks: 'Testing a degree-3 identity over ℤ mod 5 is the formal version of "I tried a few values and it worked".'
        }
      ],
      complexity: [
        { operation: 'Freivalds, one round', average: '3n² operations — three matrix–vector products', worst: 'the same; k rounds cost 3kn² against n^2.807 or n³ to multiply' },
        { operation: 'Schwartz–Zippel, one round', average: 'one evaluation of each side at a random point', worst: 'catches a false identity with probability ≥ 1 − d/|F|; k rounds give (d/|F|)ᵏ' },
        { operation: 'polynomial fingerprint', average: 'O(n) field operations by Horner, producing log₂ p bits', worst: 'two unequal sequences of length n collide for at most n − 1 of the p bases' },
        { operation: 'Merkle proof', average: '⌈log₂ n⌉ hashes to generate and the same to verify', worst: 'the tree itself costs 2n − 1 hashes to build, paid once' }
      ],
      failureModes: [
        {
          symptom: 'A verification test raises a false alarm.',
          cause: 'The implementation is wrong — a true identity has no counter-example, so this cannot happen by chance.',
          fix: 'Treat any non-zero false-alarm count as a failing test rather than as a tolerance to widen.'
        },
        {
          symptom: 'A fingerprint comparison reports zero collisions and the bound is quoted as confirmed.',
          cause: 'The test pair differs in one position, so its difference polynomial is a monomial with no reachable root.',
          fix: 'Construct a pair with the roots you want to hit; only then does the measurement have anything to agree with.'
        },
        {
          symptom: 'Two expressions "verified equal" by testing turn out to differ.',
          cause: 'The field was smaller than the degree, or the same few points were reused.',
          fix: 'Pick a field far larger than the total degree, and draw fresh points every round.'
        },
        {
          symptom: 'A content-addressed store produces occasional collisions.',
          cause: 'A fixed multiplier or a short hash, which turns a probabilistic bound into a constructible attack.',
          fix: 'A seeded or cryptographic hash, sized against the number of objects rather than against intuition.'
        },
        {
          symptom: 'A residual check passes and the answer is still wrong.',
          cause: 'A small residual proves the answer solves a nearby problem, which on an ill-conditioned one is a long way from the right answer.',
          fix: 'See 18.1: report the condition number beside the residual, because backward stability is not forward accuracy.'
        }
      ],
      inTheWild: [
        { system: 'Git and every content-addressed store', how: 'names objects by their hash and compares trees by comparing one hash per subtree — the Merkle structure means an unchanged directory is verified in one comparison rather than by walking it.' },
        { system: 'Certificate Transparency logs', how: 'publish a Merkle root so any client can verify that a certificate is included, and that the log has not been rewritten, with a logarithmic proof.' },
        { system: 'Rabin–Karp substring search and rsync', how: 'compare blocks by rolling polynomial fingerprints; rsync transfers only the blocks whose fingerprints differ, which is this section applied to bandwidth.' }
      ],
      sources: [
        { title: 'Probabilistic machines can use less running time', author: 'Rūsiņš Freivalds', note: 'The 1979 paper introducing the matrix-product verification argument.' },
        { title: 'Fast probabilistic algorithms for verification of polynomial identities', author: 'Jacob T. Schwartz', note: 'One of the two independent 1979–80 papers giving the lemma this whole section rests on.' },
        { title: 'Probabilistic algorithms for sparse polynomials', author: 'Richard Zippel', note: 'The other, with the sparse-interpolation application.' },
        { title: 'Randomized Algorithms', author: 'Motwani and Raghavan', note: 'Chapter 7 collects fingerprinting, verification and pattern matching under one argument.' },
        { title: 'A digitalized signature and public-key functions as intractable as factorization', author: 'Michael O. Rabin', note: 'The origin of the fingerprinting idea that Rabin–Karp and rsync both use.' }
      ]
    },

    'approximation-ratios': {
      summary: 'Four vertex-cover algorithms, greedy set cover, two metric TSP approximations, ' +
        'k-centre and list scheduling, every one measured against an exact optimum, with the ' +
        'tight instance for each generated rather than described.',
      intuition: 'The ratio is worst case and the distribution is what you will see. Greedy set ' +
        'cover is usually within a few percent of optimal, and knowing both facts is what lets ' +
        'you ship it.',
      formulation: {
        equations: [
          {
            label: 'Vertex cover on 200 random 12-vertex graphs at density 0.35',
            expr: 'measured ratio against exact optima from subset enumeration',
            terms: [
              { sym: 'maximal matching (bound 2)', meaning: 'mean 1.5161, median 1.4286, worst exactly 2.0000' },
              { sym: 'highest degree (no bound)', meaning: 'mean 1.0321, median 1.0000, worst 1.2857 — the best in the table' },
              { sym: 'LP + rounding (bound 2)', meaning: 'mean 1.4950, worst 2.0000' },
              { sym: 'primal–dual (bound 2)', meaning: 'mean 1.5161, worst 2.0000' },
              { sym: 'bound violations and infeasible answers', meaning: '0 and 0, checked separately from the cost' }
            ]
          },
          {
            label: 'The family that defeats highest-degree greedy',
            expr: 'k left vertices; for each i, ⌊k/i⌋ right vertices of degree i. Optimum is k by König.',
            terms: [
              { sym: 'k = 20', meaning: '66 vertices; greedy 46 (2.30×), matching 38 (1.90×)' },
              { sym: 'k = 60', meaning: '261 vertices; greedy 201 (3.35×), matching 118 (1.97×)' },
              { sym: 'k = 100', meaning: '482 vertices; greedy 382 (3.82×), matching 198 (1.98×)' },
              { sym: 'the growth', meaning: 'greedy tracks H(k) − 1 while the matching bound holds at 2' }
            ]
          },
          {
            label: 'Greedy set cover on Vazirani’s tight instance',
            expr: 'singletons priced at 1/(n − i), the whole universe at 1 + ε',
            terms: [
              { sym: 'n = 4', meaning: 'greedy 2.0833 = H(4) exactly, optimum 1.01' },
              { sym: 'n = 64', meaning: '4.7439 = H(64), ratio 4.6969' },
              { sym: 'n = 128', meaning: '5.4331 = H(128), against ln 128 = 4.8520 — 12% apart' },
              { sym: 'random instances', meaning: 'mean ratio 1.2330, worst 2.0000 over 120 instances' }
            ]
          },
          {
            label: 'Metric TSP on 60 ten-city instances against Held–Karp',
            expr: 'the lower bound the whole argument rests on, then the two tours',
            terms: [
              { sym: 'MST / OPT', meaning: 'mean 0.7326, worst 0.8281, best 0.6328 — always below 1, which is what doubling needs' },
              { sym: 'double and shortcut (bound 2)', meaning: 'mean 1.1428, median 1.1520, worst 1.3275' },
              { sym: 'Christofides (bound 1.5)', meaning: 'mean 1.0675, median 1.0635, worst 1.2281' },
              { sym: 'the matching', meaning: 'computed exactly by bitmask DP on the odd set — an approximate one breaks the 3/2 bound' }
            ]
          },
          {
            label: 'k-centre and load balancing',
            expr: 'both against exact optima by enumeration',
            terms: [
              { sym: 'farthest-first, k = 2, 3, 4', meaning: 'ratios 1.0547, 1.4313, 1.2297 against a bound of 2, from 120, 560 and 1 820 choices of centres' },
              { sym: 'list scheduling, 4 machines', meaning: 'mean 1.1465, worst 1.4074, bound 2 − 1/4 = 1.75' },
              { sym: 'longest-first', meaning: 'mean 1.0294, worst 1.0882, bound 4/3 − 1/12 = 1.25' },
              { sym: 'the tight instance', meaning: '12 unit jobs then one of length 4: list scheduling reaches exactly 1.75, longest-first is optimal' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Feasibility is checked separately from cost',
          why: 'An infeasible answer is cheaper than a feasible one and would flatter the ratio column.',
          breaks: 'A vertex cover missing an edge, or a tour skipping a city, looks excellent on every cost metric.'
        },
        {
          name: 'Every ratio is measured against an exact optimum',
          why: 'A ratio against another approximation is not a ratio.',
          breaks: 'It caps the instance sizes at what enumeration or Held–Karp can reach, which is the honest constraint.'
        },
        {
          name: 'The matching size is a per-instance certificate',
          why: 'It proves the factor of 2 for the instance in hand without knowing the optimum.',
          breaks: 'Highest-degree greedy has no such certificate, which is exactly what "no bound" means operationally.'
        },
        {
          name: 'Metric TSP needs the triangle inequality at every step',
          why: 'Shortcutting a walk relies on it, and so does the matching bound.',
          breaks: 'Without it, no constant-factor approximation exists at all unless P = NP.'
        }
      ],
      complexity: [
        { operation: 'maximal-matching vertex cover', average: 'O(m) — one pass over the edges', worst: 'ratio exactly 2, attained on 200 random graphs as well as in theory' },
        { operation: 'greedy set cover', average: 'O(Σ|S|) per round, at most n rounds', worst: 'ratio H(m) ≈ ln m + 0.577, attained exactly by the tight instance' },
        { operation: 'MST doubling', average: 'O(n²) for Prim on a dense distance matrix', worst: 'ratio 2; measured mean 1.14 on random Euclidean instances' },
        { operation: 'Christofides', average: 'MST plus a minimum-weight perfect matching on the odd vertices', worst: 'ratio 1.5; the exact matching is O(2^k · k) by bitmask DP on the k odd vertices, or O(n³) by Blossom' },
        { operation: 'Held–Karp (the oracle)', average: 'O(2ⁿ n²) time and O(2ⁿ n) space', worst: 'unusable past about 15 cities, which is why the instances have 10' }
      ],
      failureModes: [
        {
          symptom: 'A heuristic beats the approximation algorithm on every instance tried.',
          cause: 'It usually does — the bound is worst case and the tight instance has to be constructed.',
          fix: 'Generate the tight instance before concluding. Highest-degree greedy wins on random graphs and loses by 3.82× at k = 100.'
        },
        {
          symptom: 'An approximation returns an answer better than the optimum.',
          cause: 'The answer is infeasible; the cost metric cannot detect that.',
          fix: 'Validate feasibility on every instance, as a separate column.'
        },
        {
          symptom: 'A TSP approximation performs terribly.',
          cause: 'The distances do not satisfy the triangle inequality — asymmetric costs, or a metric with shortcuts through third points.',
          fix: 'Take the metric closure first, or accept that no constant-factor guarantee applies.'
        },
        {
          symptom: 'Christofides is worse than tree doubling on some instance.',
          cause: 'The odd-vertex matching was computed approximately, which breaks the OPT/2 bound the 3/2 rests on.',
          fix: 'Compute it exactly — Blossom, or bitmask DP when the odd set is small.'
        },
        {
          symptom: 'A load-balancing heuristic misses its deadline on one batch in twenty.',
          cause: 'List scheduling in arrival order, whose bound is 2 − 1/m and is attained when the longest job arrives last.',
          fix: 'Sort longest-first. It is one line and improves the bound to 4/3 − 1/(3m) and the measured mean from 1.147 to 1.029.'
        }
      ],
      inTheWild: [
        { system: 'Kubernetes and Borg schedulers', how: 'are list scheduling with extra constraints; the longest-processing-time-first heuristic appears as "schedule the largest pods first", for exactly the reason the bound gives.' },
        { system: 'Facility location and CDN placement', how: 'is k-centre or k-median; farthest-first traversal is the standard initialisation for k-means (as k-means++) for the same 2-approximation reason.' },
        { system: 'Test-suite minimisation and feature selection', how: 'are set cover, and greedy is used because it is within a few percent in practice — the ln n bound is quoted in the paper and never seen in the results.' }
      ],
      sources: [
        { title: 'Approximation Algorithms', author: 'Vijay V. Vazirani', note: 'The tight set-cover instance used here is his; chapters 1 through 3 cover vertex cover, set cover and TSP.' },
        { title: 'The Design of Approximation Algorithms', author: 'Williamson and Shmoys', note: 'Freely available, and the modern reference for the primal–dual and LP-rounding methods.' },
        { title: 'Worst-case analysis of a new heuristic for the travelling salesman problem', author: 'Nicos Christofides', note: 'The 1976 report. Still the best known ratio for metric TSP.' },
        { title: 'Bounds for certain multiprocessing anomalies', author: 'R. L. Graham', note: 'The 1966 paper with the 2 − 1/m list-scheduling bound and the instance that attains it.' },
        { title: 'A greedy heuristic for the set-covering problem', author: 'V. Chvátal', note: 'The H(n) bound for weighted set cover, which the demo’s tight instance attains exactly.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
