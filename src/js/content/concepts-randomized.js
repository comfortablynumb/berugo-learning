/** Concepts for randomised algorithm design, contraction and Monte Carlo (M19.1-M19.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'randomised-design': [
      {
        term: 'Monte Carlo and Las Vegas differ in which thing is random',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["Monte Carlo"] --> B["runtime is fixed"]',
            '    A --> C["the answer may be wrong"]',
            '    D["Las Vegas"] --> E["the answer is always right"]',
            '    D --> F["the runtime may be long"]',
            '    C --> G["pick by which one your caller<br/>can actually tolerate"]',
            '    F --> G'
          ].join('\n'),
          caption: 'Both are called randomised and they fail in opposite ways. One misses a deadline; the other returns a wrong answer on time.'
        },
        plain: 'One has a fixed runtime and may be wrong; the other is always right and may take a long time.',
        formal: 'Monte Carlo: fixed time, Pr[wrong] ≤ p. Las Vegas: always correct, E[time] finite.',
        readAs: 'For Monte Carlo the time is fixed and the probability of being wrong is at ' +
          'most p; for Las Vegas the answer is certain and the expected running time is finite.',
        detail: 'The distinction decides what you can put in a service-level objective. A Monte ' +
          'Carlo algorithm gives you a latency guarantee and an error budget; a Las Vegas one ' +
          'gives you a correctness guarantee and a latency distribution. Converting a Las Vegas ' +
          'algorithm into a Monte Carlo one is free — stop it at a deadline and return whatever ' +
          'you have — and the error probability of the result is exactly the chance of ' +
          'overrunning. Going the other way needs a way to check an answer, which is why 19.5 ' +
          'sits where it does in this milestone.',
        example: 'Randomised quicksort is Las Vegas: the output is sorted whatever the pivots ' +
          'were, and only the comparison count varies. A k-round Miller–Rabin test is Monte ' +
          'Carlo: it always finishes in k modular exponentiations and is occasionally wrong.'
      },
      {
        term: 'One-sided error amplifies by multiplication; two-sided error needs a vote',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one-sided: it can only err<br/>in one direction"] --> B["a single disagreeing round<br/>settles it outright"]',
            '    B --> C["k rounds: error falls<br/>like a product"]',
            '    D["two-sided: it can err either way"] --> E["no single round is decisive"]',
            '    E --> F["run many and take the majority"]'
          ].join('\n'),
          caption: 'Which kind of error the algorithm makes decides how you repeat it. Voting on a one-sided test wastes rounds; multiplying a two-sided one is simply wrong.'
        },
        plain: 'If the algorithm can only ever err in one direction, any round that disagrees settles the question.',
        formal: 'Pr[k rounds all fail] = pᵏ for one-sided error; two-sided error needs a majority over O(log(1/δ)/γ²) rounds',
        readAs: 'The chance that all k rounds fail is p multiplied by itself k times; a ' +
          'two-sided test instead needs a majority vote over about log of one-over-delta ' +
          'divided by the gap squared rounds.',
        detail: 'A composite that passes one Miller–Rabin round may pass another, but the two ' +
          'events are independent given the composite, so the failure probabilities multiply and ' +
          'nothing has to be counted or averaged. That is why repetition here has no tuning ' +
          'and no trade-off: another round costs another round and buys another factor. With ' +
          'two-sided error a single disagreeing round proves nothing, the answer is the majority ' +
          'of many rounds, and the required count grows as the inverse square of the advantage — ' +
          'which is the difference between five rounds and five hundred.',
        example: 'The demo measures the failure rate falling from 1.385e-2 at one round to ' +
          '4.000e-4 at two — a factor of 35, close to the 1.43% liar density — while no round ' +
          'ever wrongly rejects a prime.'
      },
      {
        term: 'The proven bound and the measured rate are different numbers',
        plain: 'A theorem promises a ceiling on the error; the instance in front of you is usually far below it.',
        formal: 'Rabin: at most 1/4 of bases are liars for any composite; measured on 561, 8 of 558 bases are',
        detail: 'Quoting the bound as though it described behaviour makes an algorithm look ' +
          'twenty times worse than it is, and quoting the measurement as though it were a ' +
          'guarantee makes it look safe on inputs nobody has tried. Both numbers belong in the ' +
          'design note: the bound is what you can defend in review, and the measurement is what ' +
          'sets the round count you actually ship. The gap also tells you something real — a ' +
          'measured rate close to the bound means you have found a worst case, and one far below ' +
          'it means the bound is worst-case over a family your inputs are not in.',
        example: 'On 561 the demo reports 1.43% measured against a 25% ceiling, so three rounds ' +
          'predict 2.95e-6 rather than the 1.56e-2 the universal bound allows — a factor of ' +
          'five thousand between the promise and the reality.'
      },
      {
        term: 'Randomising the algorithm is not assuming a random input',
        plain: 'One is a claim about your coins and holds on every input; the other is a claim about the world and an adversary can break it.',
        formal: 'E over the algorithm’s coins, for every input x, rather than E over inputs',
        readAs: 'The expectation is taken over the algorithm’s own random choices, holding for ' +
          'every input, rather than over a distribution of inputs.',
        detail: 'Quicksort with a first-element pivot is O(n log n) on average over random ' +
          'permutations and O(n²) on sorted input, which real data supplies constantly. ' +
          'Quicksort with a randomly chosen pivot is O(n log n) in expectation on every input ' +
          'including the sorted one, because the randomness is now yours rather than the ' +
          'caller’s. The code differs by one line and the guarantee differs completely, and the ' +
          'same distinction is what separates a hash table that can be flooded from one that ' +
          'cannot.',
        example: 'The universal hashing section (3.2) prices the same distinction from the ' +
          'attacker’s side: a fixed hash function admits a constructed flood, and a seed drawn ' +
          'at start-up does not.'
      },
      {
        term: 'A Las Vegas runtime is geometric, and the tail is what breaks you',
        plain: 'Repeating until success gives a mean of 1/p, and a small but real chance of taking many times that.',
        formal: 'Pr[more than t attempts] = (1 − p)ᵗ, so the 99th percentile is ln 100 / −ln(1 − p)',
        readAs: 'The chance of needing more than t attempts is one minus p, multiplied by itself ' +
          't times; the ninety-ninth percentile is the natural log of a hundred divided by ' +
          'minus the natural log of one minus p.',
        detail: 'The mean is the least useful number in the distribution because the geometric ' +
          'tail is heavy relative to it: at p = 0.2 the mean is 5 and the 99th percentile is 21, ' +
          'so a timeout at twice the mean kills more than one run in ten. Every retry budget, ' +
          'every "give up after N attempts" and every deadline on a randomised routine is a ' +
          'quantile question rather than a mean question, and treating it as a mean question is ' +
          'how an error rate settles at a small non-zero number that nobody can explain.',
        example: 'The demo measures a mean of 5.07 attempts against a predicted 5.00, a 99th ' +
          'percentile of 21 against 20.64, a worst run of 36, and 11.3% of runs over a budget ' +
          'of 10.'
      },
      {
        term: 'Amplification makes "it might be wrong" stop being an objection',
        plain: 'Twenty rounds put the failure probability below the rate at which hardware silently corrupts memory.',
        formal: '4⁻²⁰ ≈ 9.1e-13, against a measured DRAM soft-error rate of roughly 10⁻¹² per bit-hour',
        readAs: 'A quarter multiplied by itself twenty times is about nine times ten to the ' +
          'minus thirteen.',
        detail: 'The comparison is the point rather than the number: at some round count the ' +
          'probability that the randomised algorithm is wrong falls below the probability that ' +
          'the deterministic alternative was miscompiled, mistyped or corrupted in flight. Below ' +
          'that line the argument is over, and knowing where the line is turns an aesthetic ' +
          'objection into an engineering decision. It also tells you when to stop adding rounds, ' +
          'because rounds past that point buy nothing measurable and cost real time.',
        example: 'Every serious cryptographic library uses probabilistic primality testing for ' +
          'key generation — the deterministic alternatives are far slower, and 64 rounds put the ' +
          'error below anything else in the system.'
      },
      {
        term: 'Expectation is not concentration',
        plain: 'Knowing the average tells you nothing about how often a single run is near it.',
        formal: 'Markov: Pr[X ≥ aE[X]] ≤ 1/a; Chernoff needs independence and gives an exponential tail',
        readAs: 'Markov says the chance X is at least a times its expectation is at most one ' +
          'over a; Chernoff needs the terms to be independent and gives a bound that shrinks ' +
          'exponentially.',
        detail: 'A single expectation is compatible with almost any distribution, so an algorithm ' +
          'quoted only by its expected behaviour may be near it almost always or almost never. ' +
          'Getting from an expectation to a statement about individual runs requires a ' +
          'concentration inequality, and each has a price: Markov needs nothing and is very weak, ' +
          'Chebyshev needs a variance, and Chernoff needs independence and pays back an ' +
          'exponentially small tail. The 19.9 section shows what happens without one — a bound ' +
          'held in expectation and missed by half the individual runs.',
        example: 'M19.9 draws 500 random MAX-CUT assignments whose mean is 18.67 against a ' +
          'predicted 18.5, and 232 of them fall below that mean.'
      },
      {
        term: 'A Carmichael number is why the Fermat test was abandoned',
        plain: 'Some composites pass the Fermat test for every base that shares no factor with them.',
        formal: 'n is Carmichael if aⁿ⁻¹ ≡ 1 (mod n) for every a coprime to n',
        readAs: 'n is a Carmichael number if a raised to the n minus one is congruent to one ' +
          'modulo n, for every a that shares no factor with n.',
        detail: 'Amplification fails completely against a Carmichael number: the liar density is ' +
          'not merely high, it is everything except the bases that share a factor, so repeating ' +
          'the Fermat test converges to certainty about the wrong answer. Miller–Rabin adds one ' +
          'check — that no non-trivial square root of 1 appeared during the squaring chain — and ' +
          'that single extra condition takes the liar density from 57.0% to 1.43% on the same ' +
          'number. It is the clearest example in the milestone of a repetition bound being ' +
          'worthless without a per-round guarantee behind it.',
        example: '561 = 3 · 11 · 17 is the smallest; the demo counts 318 Fermat liars among its ' +
          '558 candidate bases and only 8 Miller–Rabin liars.'
      }
    ],

    'random-contraction': [
      {
        term: 'Contraction merges two vertices and keeps every other edge',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["pick a random edge"] --> B["fuse its two endpoints<br/>into one supernode"]',
            '    B --> C["discard the loops that creates"]',
            '    C --> D["keep every other edge,<br/>including parallel ones"]',
            '    D --> E["repeat until two vertices remain"]',
            '    E --> F["the edges between them<br/>are a cut"]'
          ].join('\n'),
          caption: 'Keeping parallel edges is the part people drop, and it is what makes the count at the end a real cut size rather than a number of distinct neighbours.'
        },
        plain: 'Pick an edge, fuse its endpoints into one supernode, throw away the loops that makes.',
        formal: 'edges between u and v become self-loops and are deleted; every other edge survives with its multiplicity',
        detail: 'The multiplicity is the part that does the work. When both endpoints were joined ' +
          'to the same outside vertex, the merge produces two parallel edges rather than one, so ' +
          'a densely connected region accumulates weight and becomes progressively less likely ' +
          'to be split by a later contraction. An implementation that deduplicates edges — which ' +
          'looks like a tidy-up — destroys exactly that effect and the success probability ' +
          'collapses to something no analysis covers.',
        example: 'The demo’s trace shows 32 edges falling to 2 over 10 contractions on a ' +
          '12-vertex graph, faster than the supernode count falls, because every merge also ' +
          'destroys the self-loops it creates.'
      },
      {
        term: 'The success probability is exactly 2/(n(n−1))',
        plain: 'Each contraction has at most a 2/n chance of destroying the cut, and the product telescopes.',
        formal: 'Pr[a specific min cut survives] ≥ ∏ᵢ (1 − 2/(n − i)) = 2/(n(n−1))',
        readAs: 'The probability that one particular minimum cut survives is at least the ' +
          'product over each step of one minus two over the remaining vertex count, which ' +
          'multiplies out to two over n times n minus one.',
        detail: 'The step everybody skips is why the per-contraction bound holds. If the minimum ' +
          'cut has size k then every vertex has degree at least k — a vertex of smaller degree ' +
          'would be a smaller cut on its own — so the graph has at least nk/2 edges and the ' +
          'chance of picking one of the k cut edges is at most 2/n. That is the entire argument, ' +
          'and it is why the edge must be drawn uniformly from the edges rather than from the ' +
          'vertices: the bound is a statement about the edge count.',
        example: 'At n = 12 the bound is 1.52%. On a cycle the demo measures 1.65% for a ' +
          'nominated cut, and on two cliques joined by two edges it measures 34.55%, because ' +
          'that graph is far from the worst case.'
      },
      {
        term: 'The bound is about ONE cut, not about finding any minimum cut',
        plain: 'A graph with many minimum cuts is easy to find one of, and still hard to find a particular one.',
        formal: 'Pr[returns cut C] ≥ 2/(n(n−1)) for each min cut C; the events are disjoint',
        detail: 'Reporting the wrong event is how the bound gets a reputation for pessimism. On ' +
          'a cycle every pair of edges is a minimum cut, so "found a minimum cut" happens on ' +
          'essentially every run while "found this one" sits within a percent of the bound. ' +
          'Which event you measure has to match which event you need — an algorithm that must ' +
          'enumerate all minimum cuts is doing the second, and one that only needs the minimum ' +
          'cut VALUE is doing the first.',
        example: 'On C₁₂ the demo measures 100.00% for "some minimum cut" and 1.65% for a ' +
          'nominated one, with all 66 distinct minimum cuts turning up across 2 000 runs.'
      },
      {
        term: 'The same argument counts the minimum cuts',
        plain: 'Because each minimum cut is returned with probability at least 2/(n(n−1)) and the events are disjoint, there cannot be many of them.',
        formal: 'a graph has at most n(n−1)/2 minimum cuts, attained exactly by the cycle',
        detail: 'This is a fact about graphs proved by running an algorithm on them, which is ' +
          'unusual enough to be worth remembering on its own. The probabilities of disjoint ' +
          'events sum to at most one, each minimum cut has probability at least 2/(n(n−1)), so ' +
          'there are at most n(n−1)/2 of them. It is also the more reusable half of the result: ' +
          'any algorithm that enumerates minimum cuts now has a bound on its own output size, ' +
          'and the cycle shows the bound cannot be improved.',
        example: 'C₁₂ has exactly 12 · 11 / 2 = 66 minimum cuts, and the demo’s enumeration ' +
          'oracle counts precisely 66 optimal partitions.'
      },
      {
        term: 'A cheap run with a small success probability beats an expensive certain one',
        plain: 'The cost model is expected total work, not the probability that one run is right.',
        formal: 'n(n−1)/2 · ln(1/δ) runs at O(n²) each gives failure below δ in O(n⁴ log n)',
        readAs: 'Take n times n minus one over two, multiplied by the natural log of one over ' +
          'delta, runs — each costing order n squared — for a total of order n to the fourth ' +
          'times log n.',
        detail: 'The instinct that 1/n² is "too small to be useful" compares the wrong two ' +
          'numbers. What matters is the failure probability multiplied by the cost of a run, and ' +
          'contraction runs are quadratic and allocation-free. The same reasoning appears ' +
          'wherever a cheap probabilistic filter fronts an expensive exact check, and getting it ' +
          'wrong in the other direction is how people end up running an exponential exact ' +
          'algorithm because the polynomial one "only" succeeds sometimes.',
        example: 'The demo puts the two multiplications side by side: 302 runs of 10 ' +
          'contractions at the proven bound, and 11 runs at the measured rate, for the same 99% ' +
          'confidence.'
      },
      {
        term: 'Karger–Stein spends the repetition where the cut actually dies',
        plain: 'The early contractions are almost always safe, so only the last few deserve to be repeated.',
        formal: 'contract to n/√2, recurse twice: T(n) = 2T(n/√2) + O(n²) = O(n² log n)',
        readAs: 'Contract down to n divided by the square root of two and recurse twice; the ' +
          'recurrence T of n equals two T of n over root two plus order n squared, which solves ' +
          'to order n squared log n.',
        detail: 'The survival probability of contracting from n down to t is roughly t²/n², so ' +
          'stopping at n/√2 leaves it at about a half — and two independent recursive calls at ' +
          'that size then cost the same as one full run while the failure probabilities ' +
          'multiply instead of compounding. The result is a success probability of Ω(1/log n) ' +
          'per call instead of Ω(1/n²), so the total work for high confidence drops from ' +
          'O(n⁴ log n) to O(n² log³n). The idea generalises: when a randomised process fails ' +
          'unevenly along its length, repeat the dangerous part rather than the whole.',
        example: 'The demo runs one Karger–Stein call at 64 contractions across 63 recursive ' +
          'calls and finds the minimum cut, against 3 020 contractions for plain repetition at ' +
          'the proven bound.'
      },
      {
        term: 'Uniform over edges is not uniform over vertices',
        plain: 'Choosing a supernode and then one of its edges over-samples the sparse side of the cut.',
        formal: 'the degree bound is a statement about |E| ≥ nk/2, so the draw must be from E',
        detail: 'Both rules can be described in one sentence as "contract a random edge", and ' +
          'they induce different distributions: picking a supernode first makes a degree-2 ' +
          'vertex as likely as a degree-20 one, so the thin end of a cut gets contracted far ' +
          'more often than the analysis permits. There is no error message and no invariant ' +
          'violation — the algorithm still returns a cut, just a worse one more often — which is ' +
          'why the demo ships both and measures them.',
        example: 'On the two-clique graph the demo measures 34.55% for the correct rule and ' +
          '23.40% for the plausible mistake, over the same 2 000 seeds.'
      },
      {
        term: 'Randomly sampling a graph is a general technique, not a min-cut trick',
        plain: 'Keeping each edge with probability p preserves cut values up to a factor, so you can work on a sparser graph.',
        formal: 'Karger’s sampling theorem: cuts in a p-sample are within (1 ± ε) of p times their true value for p = Ω(log n / (ε²k))',
        readAs: 'Every cut in a random sample that keeps each edge with probability p has size ' +
          'within one plus or minus epsilon of p times its true size, provided p is at least of ' +
          'order log n over epsilon squared times the minimum cut.',
        detail: 'This is the reason contraction matters beyond min cut. Once every cut in a ' +
          'sparse random sample is provably close to its true value, an expensive algorithm can ' +
          'be run on the sample and its answer corrected — which is how near-linear-time minimum ' +
          'cut and fast approximate max-flow algorithms are built. The pattern is the same one ' +
          'as sketching in M07: shrink the input in a way that provably preserves the quantity ' +
          'you care about, then pay full price on something small.',
        example: 'Karger’s near-linear-time minimum cut algorithm and the Benczúr–Karger cut ' +
          'sparsifier both rest on this theorem rather than on contraction directly.'
      }
    ],

    'monte-carlo-estimation': [
      {
        term: 'The error falls like 1/√N and nothing changes that',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["N samples"] --> B["error proportional to 1/√N"]',
            '    B --> C["4× the samples: half the error"]',
            '    B --> D["100× the samples:<br/>one more decimal digit"]',
            '    C --> E["no cleverness moves the exponent —<br/>only the constant in front"]',
            '    D --> E'
          ].join('\n'),
          caption: 'Variance reduction is worth real factors and cannot change the rate. Budgeting a Monte Carlo run means accepting that a digit costs a hundredfold.'
        },
        plain: 'Four times the samples halves the error; a hundred times the samples gives one more digit.',
        formal: 'the standard error of a sample mean is σ/√N, whatever the integrand',
        readAs: 'Sigma divided by the square root of N — the spread of one sample divided by the ' +
          'square root of how many you took.',
        detail: 'The rate is a property of averaging independent draws rather than of the ' +
          'problem, so it is identical for an integral, an area, a probability and a simulated ' +
          'queue. That makes the cost of accuracy predictable and brutal: three more digits ' +
          'costs a million times the work. Because the exponent is fixed, every technique worth ' +
          'knowing attacks σ instead — and the ones that appear to beat the rate, like ' +
          'stratification and quasi-Monte Carlo, do so by abandoning independence rather than by ' +
          'improving the average.',
        example: 'The demo measures a mean error of 1.083e-1 at 16 samples, 7.898e-3 at 4 096 ' +
          'against a predicted 6.767e-3, and 1.590e-3 at 65 536 against a predicted 1.692e-3 — ' +
          'a factor of 68 for 4 096 times the work, where the rate predicts 64.'
      },
      {
        term: 'The rate does not depend on the dimension, and that is the whole point',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a grid: m points per axis"] --> B["m^d points in d dimensions"]',
            '    B --> C["unusable past a handful<br/>of dimensions"]',
            '    D["sampling: N points, anywhere"] --> E["error 1/√N in ONE dimension"]',
            '    E --> F["and 1/√N in fifty"]',
            '    F --> G["so high dimension is where<br/>sampling stops being a<br/>compromise and starts being<br/>the only option"]'
          ].join('\n'),
          caption: 'In two dimensions a grid beats sampling easily. The crossover arrives fast, and past it the grid is not merely worse — it is impossible.'
        },
        plain: 'A grid needs m points per axis and therefore mᵈ in total; sampling needs the same N in every dimension.',
        formal: 'product quadrature error is O(m⁻²) per axis at mᵈ points; Monte Carlo is O(1/√N) at N points',
        readAs: 'The grid rule’s error falls like one over m squared per axis but needs m to the ' +
          'power d points, while Monte Carlo’s error falls like one over the square root of N ' +
          'whatever d is.',
        detail: 'At a fixed budget the nodes per axis collapse as d grows — 4 096 points is ' +
          '4 096 nodes in one dimension and 2 nodes in twelve — so the grid’s accuracy falls off ' +
          'a cliff while the sampled one does not move. This is the curse of dimensionality ' +
          'stated as a crossover rather than as a slogan, and it is why financial and physical ' +
          'simulations in tens of dimensions are sampled while a one-dimensional integral never ' +
          'should be.',
        example: 'At the same 4 096 points the demo measures a grid error of 2.48e-9 at d = 1 ' +
          'and 7.98e-2 at d = 8, while the sampled error goes only from 3.19e-3 to 1.11e-2 ' +
          'across that whole range. The crossover is at d = 5.'
      },
      {
        term: 'Antithetic variates work through negative correlation and fail without it',
        plain: 'Pair each draw u with 1 − u; if the function is monotone the pair’s errors cancel.',
        formal: 'Var[(f(u) + f(1 − u))/2] = (1 + ρ)/2 · Var[f(u)], where ρ is the correlation of the pair',
        readAs: 'The variance of the pair’s average is one plus rho, over two, times the ' +
          'variance of a single draw, where rho is the correlation between the two halves.',
        detail: 'The formula is the whole story: a monotone integrand makes ρ strongly negative ' +
          'and the variance collapses, and an integrand symmetric about the middle of the domain ' +
          'makes ρ positive and the pairing is worse than useless. There is no way to know which ' +
          'you have without either looking at the function or measuring, so a library that ' +
          'applies antithetic sampling unconditionally is making an unstated assumption about ' +
          'its caller’s integrand.',
        example: 'The demo measures a 61.87× variance reduction on ∫₀¹ eˣ dx and 1.41× on ' +
          '∫₀¹ sin²(10x) dx, where it makes the measured error 2.5 times worse.'
      },
      {
        term: 'A control variate is worth exactly its squared correlation',
        plain: 'Subtract a correlated quantity whose mean you already know, scaled by the best coefficient.',
        formal: 'f − c(g − E[g]) has variance (1 − ρ²)·Var[f] at c = ρ·σ_f/σ_g',
        readAs: 'Subtracting c times the control’s deviation from its known mean gives a ' +
          'variance of one minus rho squared, times the original, when c is rho times the ratio ' +
          'of the two standard deviations.',
        detail: 'Because the saving is 1 − ρ², a control correlated at 0.3 removes 9% of the ' +
          'variance and is not worth writing, while one at 0.99 removes 98%. The optimal ' +
          'coefficient is estimated from the same samples, which introduces a bias that vanishes ' +
          'as N grows and is negligible past a few hundred draws — but the correlation should be ' +
          'reported rather than assumed, because a control variate that turns out to be ' +
          'uncorrelated is silent code that does nothing.',
        example: 'With x as the control the demo measures a correlation near 0.99 and a 60.16× ' +
          'reduction on ∫₀¹ eˣ dx, and 1.01× on the oscillating integrand where the correlation ' +
          'is essentially zero.'
      },
      {
        term: 'Stratification changes the rate, and breaks the usual error bar',
        plain: 'One point per equal sub-interval removes the variation between strata exactly.',
        formal: 'total variance = within-strata + between-strata; stratification deletes the second term',
        detail: 'What remains shrinks with the stratum width, so for a smooth integrand the ' +
          'error falls faster than 1/√N. The catch is that the draws are no longer identically ' +
          'distributed, so the sample-variance formula no longer estimates the estimator’s ' +
          'variance — it reports roughly the unstratified value while the actual error is orders ' +
          'of magnitude smaller. Code that stratifies the sampling and keeps the standard error ' +
          'bar is quoting an interval that is far too wide, which is the rare case of a ' +
          'statistical mistake erring towards caution.',
        example: 'The demo measures a stratified sample variance of 0.242093 against plain ' +
          'sampling’s 0.233670 — no reduction at all — while the error falls from 3.748e-3 to ' +
          '1.088e-6, a factor of 3 445. Over 200 seeds its interval covers the answer 100.0% of ' +
          'the time against a nominal 95%, where plain sampling measures 96.0%, antithetic ' +
          '96.0% and the control variate 95.0%.'
      },
      {
        term: 'Quasi-Monte Carlo replaces randomness with even spread',
        plain: 'A deterministic low-discrepancy point set fills the interval more evenly than random points do.',
        formal: 'Koksma–Hlawka: |error| ≤ V(f) · D*(P), the integrand’s variation times the set’s star discrepancy',
        readAs: 'The absolute error is at most the total variation of f multiplied by the star ' +
          'discrepancy of the point set.',
        detail: 'Random points clump: over N draws the largest empty gap is much bigger than 1/N, ' +
          'and every clump is wasted work. The van der Corput sequence writes the index in base ' +
          'two and reflects the digits about the point, which produces a set whose discrepancy ' +
          'is O(log N / N) rather than O(1/√N). The inequality then bounds the integration ' +
          'error directly, and it has no probability in it at all — which is also its limitation, ' +
          'because there is no error bar to report and the bound needs the integrand’s variation, ' +
          'which is usually unknown.',
        example: 'The demo’s discrepancy column tracks its error column almost exactly: at 16 ' +
          'points they are 6.250e-2 and 5.115e-2, and at 65 536 they are 1.526e-5 and 1.311e-5, ' +
          'against a random-sampling error of 1.590e-3. On the exponential integrand at 4 000 ' +
          'samples the error is 5.214e-4, and on the oscillating one it is 57.7 times below ' +
          'plain sampling.'
      },
      {
        term: 'Importance sampling is the only one that makes an impossible estimate possible',
        plain: 'Sample where the interesting thing happens, then reweight by the ratio of the densities.',
        formal: 'E_p[f(X)] = E_q[f(X)·p(X)/q(X)] for any q whose support covers p’s',
        readAs: 'The expectation under p equals the expectation under q of f times the ratio of ' +
          'the two densities, for any q that is non-zero wherever p is.',
        detail: 'A tail probability of 3e-5 needs about 32 000 plain draws to see a single hit, ' +
          'so a budget of 20 000 typically returns exactly zero with a standard error of exactly ' +
          'zero — a confident wrong answer carrying no warning at all. Shifting the sampling ' +
          'distribution into the tail and reweighting removes that entirely and the estimator ' +
          'stays unbiased for any valid proposal. The variance, however, depends completely on ' +
          'the choice, and a proposal with a lighter tail than the target has infinite variance ' +
          'while still producing plausible numbers.',
        example: 'At P(Z > 4) the demo’s plain estimator returns 0 from 20 000 draws; a shift of ' +
          '2 gives 477 hits, a weight ESS of 387.3 and a relative error of 3.907%, and a shift ' +
          'of 4 brings it to 0.121%.'
      },
      {
        term: 'The effective sample size of the weights is the diagnostic that catches a bad proposal',
        plain: 'If a handful of draws carry all the weight, the estimate has not converged whatever the hit count says.',
        formal: 'ESS = (Σwᵢ)² / Σwᵢ², the number of equally weighted draws the set is worth',
        readAs: 'Take the sum of all the weights and square it, then divide by the sum of the ' +
          'squared weights — the answer is how many equally weighted draws this set is worth.',
        detail: 'The failure mode is counter-intuitive because the obvious health signal points ' +
          'the wrong way: an over-shifted proposal puts almost every draw past the threshold, ' +
          'which looks ideal, while concentrating the weight on a few of them. The weight ESS ' +
          'collapses and the estimate degrades, and no amount of staring at the hit count reveals ' +
          'it. The same statistic reappears in 19.4 for correlated chains, and in both places it ' +
          'is the number that turns "the sampler ran" into "the sampler produced information".',
        example: 'At a shift of 7 the demo puts 19 982 of 20 000 draws past the threshold — the ' +
          'best hit count in the table — with a weight ESS of 75.4 and a relative error of ' +
          '15.7%, against 0.121% at the correct shift.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
