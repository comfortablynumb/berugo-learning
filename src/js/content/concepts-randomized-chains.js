/** Concepts for MCMC, fingerprinting and approximation ratios (M19.4-M19.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'markov-chain-monte-carlo': [
      {
        term: 'The normalising constant cancels, which is why the method exists',
        plain: 'You can sample from a density you can only evaluate up to an unknown factor.',
        formal: 'the acceptance ratio π(y)/π(x) is unchanged by rescaling π',
        readAs: 'The ratio of the target density at the proposed point to its value at the ' +
          'current point does not change if the whole density is multiplied by a constant.',
        detail: 'A Bayesian posterior is a likelihood times a prior divided by an integral over ' +
          'the entire parameter space, and that integral is exactly the thing nobody can ' +
          'compute. Metropolis–Hastings never evaluates the density on its own — only ratios of ' +
          'it — so the unknown factor divides out and the chain converges to the right ' +
          'distribution without it ever being known. Every other property of the method is ' +
          'engineering; this one is why it is used at all.',
        example: 'The demo’s mixture density is written unnormalised in the module and the chain ' +
          'still reproduces its mean to 0.0663 at the best proposal width.'
      },
      {
        term: 'Detailed balance is what pins the stationary distribution',
        plain: 'If the flow from x to y equals the flow from y to x for every pair, the distribution stops changing.',
        formal: 'π(x)·P(x → y) = π(y)·P(y → x) for all x, y implies π is stationary',
        readAs: 'The target density at x times the chance of moving from x to y equals the ' +
          'density at y times the chance of moving back, for every pair of points.',
        detail: 'The Metropolis acceptance rule min(1, π(y)/π(x)) is reverse-engineered from ' +
          'this equation rather than guessed: substituting it in makes both sides equal by ' +
          'construction. Detailed balance is sufficient but not necessary — some samplers are ' +
          'stationary without it — and it says nothing about how long convergence takes, which ' +
          'is the entire practical difficulty. A chain can satisfy detailed balance perfectly ' +
          'and still need more steps than the age of the universe to mix.',
        example: 'A rejection re-records the current point rather than skipping the step; that ' +
          'is what makes P(x → x) large enough for the balance equation to hold.'
      },
      {
        term: 'A rejection is a repeated sample, not a wasted step',
        plain: 'When a proposal is rejected the chain records where it already is, again.',
        formal: 'the stationary distribution requires P(x → x) = 1 − Σ_{y ≠ x} P(x → y)',
        readAs: 'The chance of staying at x is one minus the total chance of moving anywhere ' +
          'else, and those repeated stays are part of the sample.',
        detail: 'Code that appends to the chain only when a move is accepted is sampling from a ' +
          'different distribution — one that under-weights the high-density regions where ' +
          'proposals are most often rejected. Nothing about the output looks wrong: the trace is ' +
          'smooth, the acceptance rate is reported correctly, and the posterior mean is quietly ' +
          'biased. This is one of the two or three most common MCMC implementation bugs and it ' +
          'has no symptom other than the wrong answer.',
        example: 'At a proposal width of 12 the demo accepts 1.2% of moves, so roughly 99 of ' +
          'every 100 recorded draws are repeats of the previous position.'
      },
      {
        term: 'Consecutive draws are correlated, so N draws are not N samples',
        plain: 'The chain remembers where it was, and the effective sample size is N divided by how long it takes to forget.',
        formal: 'ESS = N / τ where τ = 1 + 2Σₖ ρₖ, the integrated autocorrelation time',
        readAs: 'The effective sample size is the chain length divided by tau, where tau is one ' +
          'plus twice the sum of the autocorrelations at every lag.',
        detail: 'Every standard error computed as σ/√N on a correlated chain is too narrow by a ' +
          'factor of √τ, and τ can be in the hundreds. That is the mechanism behind MCMC’s ' +
          'characteristic failure: a small, confident interval around a wrong number. Reporting ' +
          'the effective sample size instead of the draw count makes the problem visible and ' +
          'also makes the run comparable — twenty thousand draws worth seventy-five independent ' +
          'ones is not a longer run than two thousand draws worth five hundred.',
        example: 'The demo measures a correlation time of 267.2 at width 0.1, giving 74.9 ' +
          'effective samples from 20 000 draws and an honest error bar 16.3 times the naive one.'
      },
      {
        term: 'Both failure modes are step-size problems, and they sit on opposite sides',
        plain: 'Too small a proposal is always accepted and moves nowhere; too large is always rejected and sits still.',
        formal: 'the optimal acceptance rate is about 0.234 in high dimensions and 0.4–0.5 in one or two',
        detail: 'The uncomfortable consequence is that a high acceptance rate is a symptom rather ' +
          'than a sign of health, and it is the number most dashboards show. At 93% acceptance ' +
          'the chain is taking steps so small that the target barely differs between them, so ' +
          'almost everything is accepted and almost nothing is explored. The optimum is a ' +
          'genuine interior maximum, which means tuning is a search rather than a direction, and ' +
          'adaptive samplers exist precisely to do that search automatically.',
        example: 'The demo’s width sweep goes 92.7% → 79.1% → 43.5% → 17.1% → 6.3% → 1.2% ' +
          'acceptance with effective sample sizes of 74.9 → 23.2 → 174.8 → 559.7 → 456.1 → ' +
          '151.4 — the best mixing is at 17.1% acceptance.'
      },
      {
        term: 'Burn-in and mixing are different problems and only one is fixed by waiting',
        plain: 'Forgetting the starting point takes a while; crossing between separated modes may never happen.',
        formal: 'burn-in is transient; mixing time is a property of the chain’s spectral gap',
        detail: 'Discarding a prefix handles burn-in and does nothing for mixing. A chain whose ' +
          'proposal cannot cross a low-density valley will not cross it in a hundred times the ' +
          'steps, because the barrier is exponential in the valley depth rather than linear in ' +
          'the run length. The fix is a better proposal — larger steps, a tempered chain, or a ' +
          'mixture proposal that occasionally jumps — not a longer run, and telling the two ' +
          'apart is what the diagnostics are for.',
        example: 'At width 0.1 the demo’s chain spends 1.3% of its time on the second mode ' +
          'against a true weight of 35.0%, and running it longer moves that number by ' +
          'essentially nothing.'
      },
      {
        term: 'Gelman–Rubin R̂ is the only diagnostic that can see a stuck chain',
        plain: 'Run several chains from far-apart starts and compare the variance between them against the variance within them.',
        formal: 'R̂ = √(V⁺/W), where V⁺ mixes the within-chain and between-chain variances; the threshold is 1.01',
        readAs: 'R-hat is the square root of the pooled variance estimate divided by the average ' +
          'within-chain variance, and values above about one point zero one mean the chains ' +
          'have not agreed yet.',
        detail: 'A single chain reports a mean and has nothing to disagree with, which is why ' +
          'every serious sampler runs four. If the chains started in different places and still ' +
          'reach different answers, at least one of them is wrong, and R̂ turns that into a ' +
          'number. Its limitation is the honest one: it cannot detect a mode that none of the ' +
          'chains ever found, so dispersed starting points matter more than chain length and ' +
          'both matter more than the acceptance rate.',
        example: 'The demo measures R̂ = 1.5081 at width 0.1, where the four chains report means ' +
          'of −2.27, −1.61, −1.48 and +1.24, and R̂ = 1.001 at the well-mixed width.'
      },
      {
        term: 'Gibbs sampling accepts everything and still may not mix',
        plain: 'Drawing each coordinate from its exact conditional means no proposal is ever rejected.',
        formal: 'sample xᵢ ~ π(xᵢ | x₋ᵢ); the acceptance probability is 1 by construction',
        readAs: 'Draw each coordinate from the target distribution conditioned on all the other ' +
          'coordinates, which is always accepted because the proposal already is the target.',
        detail: 'A 100% acceptance rate is the clearest possible demonstration that acceptance ' +
          'is not the quantity to watch. On a strongly correlated target the conditionals are ' +
          'nearly deterministic, so each coordinate move is tiny and the chain crawls along the ' +
          'ridge — high acceptance, terrible mixing, exactly the pathology of a too-small ' +
          'random-walk proposal arriving by a different route. Gibbs also needs the conditionals ' +
          'in closed form, which is why it is fast where it applies and unavailable where it ' +
          'does not.',
        example: 'On the correlated normal at ρ = 0.9 the Gibbs sampler accepts every move and ' +
          'still has a measurable correlation time, because each conditional draw has standard ' +
          'deviation √(1 − ρ²) = 0.436 rather than 1.'
      }
    ],

    'fingerprinting': [
      {
        term: 'Verifying an answer can be asymptotically cheaper than producing it',
        plain: 'Checking a claimed matrix product costs n², whatever algorithm produced it.',
        formal: 'Freivalds compares A(Bx) with Cx in 3n² operations, against n^2.807 to multiply',
        readAs: 'Compute B times the vector x, then A times that, and compare with C times x — ' +
          'three matrix-vector products, each costing n squared.',
        detail: 'The gap widens with n because one side is cubic and the other quadratic, so at ' +
          'any size large enough to care about, verification is free relative to computation. ' +
          'That asymmetry is the foundation of every protocol where one machine does work for ' +
          'another and the result cannot simply be trusted — outsourced computation, blockchain ' +
          'validation, and the checksum on a rebuilt index are all the same shape. It is also ' +
          'the reason a residual check belongs in numerical code: it costs one matrix-vector ' +
          'product against the whole solve.',
        example: 'At n = 60 the demo counts 432 000 operations to multiply and 43 200 to check ' +
          'the result eight times — a factor of ten, growing linearly in n.'
      },
      {
        term: 'The whole family is the Schwartz–Zippel lemma',
        plain: 'A non-zero polynomial has few roots, so a random point almost certainly is not one.',
        formal: 'for a non-zero polynomial of total degree d over a field F, Pr[p(r) = 0] ≤ d/|F| for r drawn uniformly',
        readAs: 'For a polynomial that is not identically zero and has total degree d, the chance ' +
          'that a uniformly random point makes it vanish is at most d divided by the size of ' +
          'the field.',
        detail: 'Every test in this section is that lemma with a different polynomial. Freivalds ' +
          'uses the bilinear form (AB − C)x; a string fingerprint reads the string as ' +
          'coefficients and evaluates at a random base; an expression-tree equality test ' +
          'evaluates both trees. Recognising the shape is what lets you invent the next one — ' +
          'given any two objects that can be written as polynomials in a shared variable, ' +
          'equality can be tested in the size of one evaluation rather than the size of the ' +
          'objects.',
        example: 'The demo tests (x + y)(x − y) = x² − y² + xy over ℤ mod 1009 and accepts it 3 ' +
          'times in 2 000 — a rate of 0.00150 against a bound of 2/1009 = 0.00198 — while the ' +
          'degree-3 false claim is accepted 4 times, 0.00200 against 0.00297.'
      },
      {
        term: 'One-sided error means repetition has no downside at all',
        plain: 'A true identity holds everywhere, so no random point can refute it.',
        formal: 'Pr[reject | the claim is true] = 0 exactly, not approximately',
        detail: 'This is stronger than a small false-positive rate and it changes how the ' +
          'algorithm is used. There is no threshold to tune, no trade between sensitivity and ' +
          'specificity, and no risk that adding rounds starts producing spurious rejections — ' +
          'so the round count is chosen purely from the failure probability you want. Any ' +
          'implementation that produces a false alarm has a bug rather than bad luck, which ' +
          'makes the false-alarm counter a genuine correctness test rather than a statistic.',
        example: 'Across every round count and every field size the demo measures exactly zero ' +
          'false alarms — 0 of 4 000 at each of eight round counts, and 8 000 of 8 000 true ' +
          'identities accepted.'
      },
      {
        term: 'The field must be larger than the degree or the test proves nothing',
        plain: 'The bound is d over the field size, so a small field gives a weak or worthless test.',
        formal: 'd/|F| ≥ 1 when |F| ≤ d, and the lemma then says nothing',
        readAs: 'When the field has no more elements than the polynomial has degree, d over the ' +
          'size of the field is at least one and the bound is vacuous.',
        detail: 'This is the formal version of "I tried a few values and it worked". A degree-3 ' +
          'identity tested over the integers modulo 5 can fail on three-fifths of the field and ' +
          'still pass every test you run; over a 32-bit prime the same identity is caught with ' +
          'probability 1 − 7e-10 per round. Choosing the field is therefore a real design ' +
          'decision, and the arithmetic cost of a bigger one is usually trivial next to the ' +
          'guarantee it buys.',
        example: 'The demo’s ∏(xᵢ − i) = 0 claim is accepted 2.9% of the time over ℤ mod 101 ' +
          'and 0.1% over ℤ mod 10007 — the same false claim, tested two ways.'
      },
      {
        term: 'A fingerprint needs the base drawn after the data is fixed',
        plain: 'With a fixed base an adversary constructs two inputs that collide and the bound describes nothing.',
        formal: 'the n/p bound is over the random choice of base, for fixed inputs',
        detail: 'Fixing the base moves the quantifier: instead of "for any two inputs, most bases ' +
          'distinguish them", you have "for this base, some inputs collide" — and finding those ' +
          'inputs is a small polynomial-factoring problem, not a search. This is the same ' +
          'argument as universal hashing in 3.2 arriving from the polynomial side, and the same ' +
          'failure appears in practice whenever a content-addressing scheme uses a hard-coded ' +
          'multiplier.',
        example: 'The demo builds a pair whose difference polynomial has 8 chosen roots and ' +
          'measures a collision rate of 0.0858 at p = 101 against the d/p bound of 0.0792 — ' +
          'attained, because the pair was constructed to attain it.'
      },
      {
        term: 'The ordinary case does not exercise the bound, and reporting it as agreement is a lie',
        plain: 'Two strings differing in one character never collide, at any field size.',
        formal: 'a one-position difference is a monomial c·bᵏ, whose only root is b = 0',
        readAs: 'The difference between the two fingerprints is a single term, c times the base ' +
          'raised to some power, and the only base making that zero is zero itself.',
        detail: 'Measuring a collision rate of zero beside a bound of n/p and calling them ' +
          'consistent is technically true and completely uninformative, and it is the exact ' +
          'shape of a demo that appears to validate a theory it never tested. The bound is a ' +
          'worst case, so the worst case has to be constructed: expand the polynomial with the ' +
          'roots you want and use its coefficients as the difference. Then the measurement lands ' +
          'on the bound and the agreement means something.',
        example: 'Across all four field sizes the demo measures 0 of 4 000 collisions for the ' +
          'one-character pair, and 343, 41, 5 and 0 of 4 000 for the constructed one.'
      },
      {
        term: 'A Merkle tree is the same trade in a different shape',
        plain: 'One root hash lets any single chunk be verified with a logarithmic number of siblings.',
        formal: 'a proof for one of n leaves is ⌈log₂ n⌉ hashes',
        readAs: 'Verifying one leaf takes the ceiling of log base two of the number of leaves ' +
          'many sibling hashes.',
        detail: 'The producer commits to the whole object with one value; a consumer who wants ' +
          'one piece re-hashes it and combines with the siblings up the path, and any change ' +
          'anywhere below the root produces a different root. The cost is logarithmic in the ' +
          'object rather than linear, which is what makes it usable across a network — and it is ' +
          'the same "expensive object, cheap certificate" structure as Freivalds, which is why ' +
          'this section previews M54 rather than deferring it.',
        example: 'The demo builds a tree over 79 chunks with proofs of 7 hashes, verifies one ' +
          'chunk against the root, and shows the same proof rejecting a chunk with one character ' +
          'added.'
      },
      {
        term: 'Look for an identity the answer must satisfy before writing a second implementation',
        plain: 'A cheap check on the result is usually available and always cheaper than computing it twice.',
        formal: 'residual ‖Ax − b‖ for a linear solve; a checksum for a rebuilt index; a spot-check for a migration',
        readAs: 'The norm of A times x minus b — how far the computed answer is from satisfying ' +
          'the equation it was supposed to solve.',
        detail: 'The habit generalises well past the three algorithms here. Any computation whose ' +
          'output satisfies a checkable relation admits a verifier that costs a fraction of the ' +
          'computation, and that verifier catches implementation bugs, hardware faults and ' +
          'malicious results alike. It is worth noting the limit, though, which 18.1 makes ' +
          'precise: a residual near machine precision proves the answer solves a nearby problem, ' +
          'not that it is near the right answer.',
        example: 'The Merkle row of the demo prices the alternative: verifying one chunk touches ' +
          '7 hashes against re-hashing all 5 000 characters.'
      }
    ],

    'approximation-ratios': [
      {
        term: 'A ratio is what separates an approximation algorithm from a heuristic',
        plain: 'A guarantee is a statement about every input, not about the ones you tried.',
        formal: 'ALG(x) ≤ ρ · OPT(x) for all x, minimising; ALG(x) ≥ OPT(x)/ρ maximising',
        readAs: 'For every input, the algorithm’s cost is at most rho times the optimal cost — ' +
          'or for a maximisation problem, at least the optimum divided by rho.',
        detail: 'Without the universal quantifier there is no statement at all, and a heuristic ' +
          'that is excellent on every instance anybody has run can still be arbitrarily bad on ' +
          'one nobody has. The ratio is also what lets the algorithm be reasoned about in ' +
          'composition: if a subroutine is a 2-approximation you can bound what the surrounding ' +
          'system does, and if it is merely "good in practice" you cannot. Every ratio in this ' +
          'section is measured against an exact optimum rather than assumed.',
        example: 'The demo computes exact vertex covers by subset enumeration on every one of ' +
          'its 200 instances, so the ratio column is a measurement and the bound column is a ' +
          'promise.'
      },
      {
        term: 'The matching-based vertex cover is a 2-approximation with a certificate',
        plain: 'Take a maximal matching and keep both endpoints of every matched edge.',
        formal: '|matching| ≤ OPT ≤ |cover| = 2|matching|',
        readAs: 'The matching size is at most the optimum, which is at most the cover size, which ' +
          'is exactly twice the matching size.',
        detail: 'Taking both endpoints looks wasteful and is what makes the proof work: every ' +
          'edge is covered because the matching was maximal, and any cover must take at least ' +
          'one endpoint of each matched edge, so the matching size lower-bounds the optimum. ' +
          'That lower bound is a certificate — it proves the ratio for the instance in front of ' +
          'you without knowing the optimum — which is worth more than the worst-case constant, ' +
          'because it lets the algorithm report how good this particular answer is.',
        example: 'Over 200 random graphs the demo measures a mean ratio of 1.5161 with a worst ' +
          'case of exactly 2.0000, against 1.4950 for LP rounding, and no bound violation and no ' +
          'infeasible answer anywhere.'
      },
      {
        term: 'The obvious improvement has no constant ratio',
        plain: 'Repeatedly taking the highest-degree vertex is Θ(log n) away from optimal on a constructible family.',
        formal: 'greedy-by-degree ≈ H(k) · OPT on the family with k left vertices and ⌊k/i⌋ right vertices of degree i',
        readAs: 'On that family greedy’s cover is about the k-th harmonic number times the ' +
          'optimum, where the harmonic number grows like the natural log of k.',
        detail: 'This is the most instructive result in the section because the measurements ' +
          'point in opposite directions. On random graphs greedy-by-degree is the best algorithm ' +
          'in the table by a wide margin; on the trap it is unboundedly worse than the algorithm ' +
          'that looks careless. Both are true, and shipping decisions need both — the guarantee ' +
          'for what you can defend, and the distribution for what you will experience.',
        example: 'The demo measures greedy-by-degree at a mean ratio of 1.0321 on random ' +
          'graphs, then 46 against an optimum of 20 on a 66-vertex trap (1.90 for the matching ' +
          'cover), 201 at k = 60 (3.35), and 382 at k = 100 (3.82) where the matching algorithm ' +
          'holds at 1.98.'
      },
      {
        term: 'Greedy set cover is ln n, and the bound is attained rather than approached',
        plain: 'Take the set with the best coverage per unit cost, repeatedly.',
        formal: 'greedy cost ≤ H(m) · OPT where m is the largest set size and H(m) ≈ ln m + 0.577',
        readAs: 'The greedy cost is at most the m-th harmonic number times the optimum, where m ' +
          'is the size of the biggest set and the harmonic number is about the natural log of m ' +
          'plus 0.577.',
        detail: 'Vazirani’s instance prices n singletons at 1/(n − i) each and the whole universe ' +
          'at 1 + ε, so at every step the cheapest remaining singleton beats the universal set on ' +
          'coverage-per-cost by a hair and greedy pays the full harmonic sum. Nothing about it ' +
          'is natural — somebody had to build it — which is precisely the lesson: the bound is ' +
          'a worst case over a family that has to be constructed, and greedy set cover on inputs ' +
          'that arise by accident is usually within a few percent of optimal.',
        example: 'The demo measures greedy paying exactly H(n) on the tight instance — 4.7439 ' +
          'at n = 64, for a ratio of 4.6969, and 5.4331 at n = 128 — and a mean ratio of 1.2330 ' +
          'on random instances.'
      },
      {
        term: 'Metric TSP’s bound comes from a lower bound rather than from the algorithm',
        plain: 'Deleting an edge from an optimal tour leaves a spanning tree, so the MST is below the optimum.',
        formal: 'MST ≤ OPT; doubling gives an Eulerian walk of 2·MST; shortcutting cannot lengthen it',
        detail: 'Almost all of the work is in establishing that the minimum spanning tree is a ' +
          'valid lower bound; once that holds, doubling and shortcutting are mechanical. Every ' +
          'step needs the triangle inequality, and without it no constant-factor approximation ' +
          'exists at all unless P = NP — so "metric" is a load-bearing word rather than a ' +
          'convenience. The general pattern is worth extracting: an approximation ratio is ' +
          'usually a lower bound plus a construction, and finding the lower bound is the hard ' +
          'part.',
        example: 'Over 60 instances the demo measures the MST at 73.3% of the optimal tour, ' +
          'tree-doubling at a mean of 1.1428 and a median of 1.1520, and Christofides at 1.0675 ' +
          'and 1.0635 — both far inside their bounds of 2 and 1.5.'
      },
      {
        term: 'Christofides replaces the doubling with a matching on the odd vertices',
        plain: 'Only the odd-degree vertices need extra edges, and the cheapest way to fix them costs at most half the optimum.',
        formal: 'the odd-degree set has even size; a minimum perfect matching on it costs ≤ OPT/2, giving 3/2',
        detail: 'The handshake lemma does real work here: the number of odd-degree vertices in ' +
          'any graph is even, so a perfect matching on them exists. The bound on its cost comes ' +
          'from taking the optimal tour restricted to those vertices, which splits into two ' +
          'alternating matchings whose total is at most the tour — so the cheaper one is at most ' +
          'half of it. That has been the best known ratio for metric TSP since 1976, which is ' +
          'itself worth knowing when someone proposes to improve on it in an afternoon.',
        example: 'The demo’s matching is computed exactly by a bitmask dynamic program over the ' +
          'odd set, because an approximate matching there would break the 3/2 bound rather than ' +
          'merely weaken it.'
      },
      {
        term: 'Farthest-first for k-centre is a 2-approximation and provably the end of the road',
        plain: 'Start anywhere, then repeatedly open the centre farthest from the ones already open.',
        formal: 'radius ≤ 2·OPT, and no polynomial (2 − δ)-approximation exists unless P = NP',
        readAs: 'The covering radius is at most twice the optimal one, and no polynomial ' +
          'algorithm can do better than that factor unless P equals NP.',
        detail: 'Most approximation ratios are the best currently known and invite improvement; ' +
          'this one is the best possible, so an afternoon spent looking for a 1.9-approximation ' +
          'is provably wasted. Knowing which category a bound is in changes what you do with it, ' +
          'and the two look identical when quoted without their hardness result. The algorithm ' +
          'is also three lines long, which is the usual pattern for problems whose optimal ' +
          'approximation is a simple greedy.',
        example: 'The demo scores greedy against exact optima found by enumerating 120, 560 ' +
          'and 1 820 choices of centres, measuring ratios of 1.0547, 1.4313 and 1.2297 at ' +
          'k = 2, 3 and 4.'
      },
      {
        term: 'List scheduling is 2 − 1/m, and a sort improves it to 4/3 − 1/(3m)',
        plain: 'Assign each job to the least-loaded machine; sorting longest-first first is strictly better.',
        formal: 'makespan ≤ (2 − 1/m)·OPT for any order, and (4/3 − 1/(3m))·OPT for longest-first',
        readAs: 'The finishing time is at most two minus one over m times the optimum in any ' +
          'order, and at most four thirds minus one over three m if the jobs are sorted longest ' +
          'first.',
        detail: 'The proof is one observation: the last job to finish started when every machine ' +
          'was busy, so the makespan is at most the average load plus the last job’s length, and ' +
          'both terms are below the optimum. Sorting improves the bound because the long jobs are ' +
          'placed while there is still room to balance them — the tight instance for the ' +
          'unsorted version is m(m−1) unit jobs followed by one job of length m, and sorting ' +
          'solves it exactly. It is the cheapest guarantee improvement in the milestone.',
        example: 'The demo measures list scheduling at a mean of 1.1465 and a worst of 1.4074 ' +
          'over 60 instances, against longest-first at 1.0294 and 1.0882, and on the tight ' +
          'instance list scheduling reaches exactly 1.75 = 2 − 1/4 while longest-first is ' +
          'optimal.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
