/** Worked examples for randomised design, contraction and Monte Carlo (M19.1-M19.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'randomised-design': [
      {
        title: 'How many rounds is enough, and why the honest answer needs two numbers',
        goal: 'Size a Miller–Rabin round count from a measured liar density rather than from ' +
          'the universal bound, and see how far apart the two answers are.',
        setup: '561 = 3 · 11 · 17, the smallest Carmichael number, with every base from 2 to ' +
          '559 tried exhaustively.',
        steps: [
          {
            do: 'Count the bases that fail to expose 561 under the Fermat test.',
            why: 'This is the test Miller–Rabin replaced, and the reason it was replaced.',
            work: '318 of 558 candidate bases return 1, so the liar density is 56.99%',
            result: 'amplification is useless here — 0.57ᵏ needs about forty rounds to reach 10⁻¹⁰'
          },
          {
            do: 'Count the same thing under Miller–Rabin.',
            why: 'The extra check is that no non-trivial square root of 1 appeared during the squaring chain.',
            work: '8 of the same 558 bases are liars, a density of 1.43%',
            result: 'one extra condition takes the density down by a factor of 40'
          },
          {
            do: 'Predict the k-round failure rate two ways.',
            why: 'The measured density and Rabin’s universal 1/4 give very different numbers.',
            work: 'at k = 3: 0.0143³ = 2.95e-6, against 0.25³ = 1.56e-2',
            result: 'a factor of five thousand between the description and the promise'
          },
          {
            do: 'Measure it over 20 000 independent runs at each round count.',
            why: 'A prediction that is not checked is an assumption.',
            work: 'k = 1: 277 fooled (1.385e-2); k = 2: 8 (4.000e-4); k = 3 and up: 0 of 20 000',
            result: 'the measurement tracks the per-instance prediction, not the universal bound'
          },
          {
            do: 'Choose a round count against something outside the algorithm.',
            why: 'The question is not "is it certain" but "is it more certain than everything else in the system".',
            work: '4⁻²⁰ ≈ 9.1e-13, below the rate at which DRAM silently flips a bit',
            result: '20 rounds, and the objection stops being an engineering objection'
          }
        ],
        answer: 'Two numbers describe the same event and they differ by a factor of five ' +
          'thousand per three rounds. The measured liar density of 1.43% is what this instance ' +
          'does; Rabin’s 25% is what any composite is guaranteed not to exceed. Ship the round ' +
          'count justified by the bound — because the input is not chosen by you — and use the ' +
          'measurement to know that you have enormous margin. The row that reads "0 of 20 000" ' +
          'at three rounds is reported as "< 5.0e-5" rather than as zero, because a rate below ' +
          'one over the trial count is an upper bound and not an observation.'
      },
      {
        title: 'The Las Vegas run that overruns, and why the mean does not warn you',
        goal: 'Size a retry budget for a repeat-until-success routine, and find out what a ' +
          'budget of "twice the average" actually costs.',
        setup: 'An attempt succeeds with probability 0.2, independently, and the routine repeats ' +
          'until one does. 4 000 runs, each from its own seed.',
        steps: [
          {
            do: 'Compute the expected number of attempts.',
            why: 'It is the number everybody quotes, and it is correct.',
            work: '1/p = 1/0.2 = 5.00; measured mean over 4 000 runs is 5.074',
            result: 'the mean is right and tells you almost nothing'
          },
          {
            do: 'Compute the 99th percentile from the geometric tail.',
            why: 'A budget is a quantile question, not a mean question.',
            work: 'ln 100 / −ln(1 − 0.2) = 4.6052 / 0.2231 = 20.64; measured 21',
            result: 'the 99th percentile is more than four times the mean'
          },
          {
            do: 'Set a budget at twice the mean and count the casualties.',
            why: 'This is the rule of thumb people actually use.',
            work: 'budget 10: (1 − 0.2)¹⁰ = 10.7% predicted, 454 of 4 000 measured = 11.3%',
            result: 'more than one run in nine exceeds it'
          },
          {
            do: 'Look at the worst run in the sample.',
            why: 'A geometric distribution has no maximum; the tail is unbounded.',
            work: 'the longest of 4 000 runs took 36 attempts, seven times the mean',
            result: 'any fixed budget has a failure rate, and it is your job to choose it'
          }
        ],
        answer: 'Every one of these 4 000 runs returned the correct answer — this is a Las Vegas ' +
          'algorithm and correctness was never in question. What varied was the time, and the ' +
          'mean of 5.07 is the least useful summary of it. A budget of twice the mean kills ' +
          '11.3% of runs, and the honest way to set one is to pick the failure rate you can ' +
          'tolerate and read the quantile: ln(1/δ)/−ln(1 − p) attempts for failure δ. If that ' +
          'error rate is unacceptable the answer is to raise p, not to raise the budget, because ' +
          'the tail decays slowly enough that doubling the budget only squares the survival ' +
          'probability.'
      }
    ],

    'random-contraction': [
      {
        title: 'What 1.5% actually costs, and why it is not the number that matters',
        goal: 'Turn a success probability into a total work figure, and compare plain repetition ' +
          'against Karger–Stein on the same graph.',
        setup: 'Two 6-vertex cliques joined by 2 edges: 12 vertices, 32 edges, and a minimum cut ' +
          'of 2 confirmed by enumerating all 2 047 partitions.',
        steps: [
          {
            do: 'Compute the guaranteed per-run success probability.',
            why: 'It is the number that makes the algorithm sound unusable.',
            work: '2/(n(n−1)) = 2/(12 · 11) = 2/132 = 1.52%',
            result: 'about one run in sixty-six, in the worst case'
          },
          {
            do: 'Compute the runs needed for 99% confidence at that rate.',
            why: 'Repetition is what converts a small probability into a guarantee.',
            work: 'ln(0.01)/ln(1 − 0.0152) = −4.605/−0.01527 = 302 runs',
            result: '302 runs of 10 contractions each = 3 020 contractions'
          },
          {
            do: 'Measure the actual success rate over 2 000 runs.',
            why: 'The bound is worst-case over all graphs, and this one is not the worst case.',
            work: '691 of 2 000 runs found the cut = 34.55%, against a bound of 1.52%',
            result: 'at the measured rate only 11 runs are needed — 110 contractions'
          },
          {
            do: 'Run Karger–Stein once on the same graph.',
            why: 'It repeats the dangerous part rather than the whole run.',
            work: '64 contractions across 63 recursive calls, and it found the cut',
            result: 'one call, 64 contractions, against 3 020 for the guaranteed plain approach'
          }
        ],
        answer: 'The instinct that 1.5% is too small to be useful compares the wrong two ' +
          'numbers. What matters is the failure probability multiplied by the cost of a run, and ' +
          'a contraction run here is 10 merges. At the proven bound that product is 3 020 ' +
          'contractions for 99% confidence; at the measured rate it is 110; and Karger–Stein ' +
          'gets there in 64 by contracting to n/√2 and recursing twice, which keeps each stage’s ' +
          'survival probability near a half instead of letting it decay all the way to 2/n. The ' +
          'general shape is worth keeping: when a randomised process fails unevenly along its ' +
          'length, repeat the dangerous part rather than the whole.'
      },
      {
        title: 'The cycle, where the bound is exact and the obvious measurement hides it',
        goal: 'Show that the same algorithm on the same size of graph reads as either wildly ' +
          'pessimistic or exactly right, depending on which event is counted.',
        setup: 'C₁₂, the 12-vertex cycle: 12 edges, minimum cut 2 — remove any two edges and the ' +
          'cycle falls apart.',
        steps: [
          {
            do: 'Count the minimum cuts by enumeration.',
            why: 'The number is the point, and it is the bound in disguise.',
            work: 'every pair of edges is a minimum cut: C(12, 2) = 66, and the oracle confirms 66',
            result: 'exactly n(n−1)/2 = 66, which is the maximum any graph can have'
          },
          {
            do: 'Measure how often 2 000 runs find *a* minimum cut.',
            why: 'This is the measurement people naturally take.',
            work: '2 000 of 2 000 = 100.00%, and all 66 distinct cuts turned up',
            result: 'the bound of 1.52% appears to be off by a factor of sixty-six'
          },
          {
            do: 'Measure how often the runs find one NOMINATED minimum cut.',
            why: 'This is the event the theorem is about.',
            work: '33 of 2 000 = 1.65%, against the bound of 1.52%',
            result: 'the bound is essentially exact — this is a tight instance'
          },
          {
            do: 'Read the counting corollary off the two measurements.',
            why: 'The events "returns cut C" are disjoint and each has probability ≥ 2/(n(n−1)).',
            work: '66 disjoint events each at ~1/66 sums to 1, and 66 = n(n−1)/2',
            result: 'a graph has at most n(n−1)/2 minimum cuts, proved by running an algorithm'
          }
        ],
        answer: 'The same 2 000 runs support "the bound is sixty-six times too pessimistic" and ' +
          '"the bound is exact to a tenth of a percent", and the difference is which event was ' +
          'counted. On the two-clique graph, which has a unique minimum cut, the two questions ' +
          'coincide and the measured 34.55% is genuine slack. On the cycle they separate ' +
          'completely. Match the event you measure to the event you need: an algorithm that ' +
          'needs the cut VALUE is asking the first question, and one that must enumerate all ' +
          'minimum cuts is asking the second — and it now has a bound of n(n−1)/2 on its own ' +
          'output size, which is the more reusable half of the whole analysis.'
      }
    ],

    'monte-carlo-estimation': [
      {
        title: 'Five estimators, one budget, and the ranking that rearranges',
        goal: 'Price each variance-reduction technique against plain sampling on the same ' +
          'integrand and the same 4 000 evaluations, then change the integrand and watch the ' +
          'order change.',
        setup: '∫₀¹ eˣ dx = e − 1 = 1.718282, estimated with 4 000 function evaluations from ' +
          'seed 21, then the same on ∫₀¹ sin²(10x) dx.',
        steps: [
          {
            do: 'Run the plain estimator and record its variance.',
            why: 'Everything else is measured as a ratio against it.',
            work: 'estimate 1.714534, error 3.748e-3, sample variance 0.233670',
            result: 'the baseline: σ/√N with nothing done to σ'
          },
          {
            do: 'Pair each u with 1 − u and measure the variance again.',
            why: 'eˣ is monotone, so the pairs should be negatively correlated.',
            work: 'variance 0.003777 — a reduction of 61.87× — and the error falls to 2.966e-3',
            result: 'a large variance reduction, and only a 1.3× error reduction on this draw'
          },
          {
            do: 'Add x as a control variate with its known mean of 1/2.',
            why: 'The saving is 1 − ρ², so the correlation is the whole story.',
            work: 'variance 0.003884, a 60.16× reduction, error 2.142e-3',
            result: 'about the same as antithetic, for a different reason'
          },
          {
            do: 'Take one point uniformly inside each of 4 000 equal strata.',
            why: 'This removes the between-strata variance exactly.',
            work: 'sample variance 0.242093 — a "reduction" of 0.97× — and error 1.088e-6',
            result: 'the variance column says nothing happened and the error fell 3 445×'
          },
          {
            do: 'Repeat all four on ∫₀¹ sin²(10x) dx.',
            why: 'An oscillating integrand breaks the assumptions the first two rely on.',
            work: 'antithetic 1.41× variance and 0.4× on the error; control variate 1.01×; stratified 412×',
            result: 'antithetic makes the error worse; the control variate does nothing at all'
          }
        ],
        answer: 'No technique here works everywhere and two of them fail on the second ' +
          'integrand. Antithetic sampling gives 61.87× on the monotone one and makes the ' +
          'measured error 2.5 times worse on the oscillating one, because the pairing that ' +
          'cancels errors on a monotone function reinforces them on a symmetric one. The ' +
          'stratified row needs reading twice: its sample variance is unchanged because the ' +
          'draws are no longer identically distributed, so that formula no longer estimates the ' +
          'estimator’s variance — the error bar has to come from the stratum width, and when it ' +
          'does, the interval covers the answer 100% of the time against a nominal 95%, which is ' +
          'the rare case of a statistical mistake erring towards caution.'
      },
      {
        title: 'A tail probability, an estimate of exactly zero, and the shift that looks best where it is worst',
        goal: 'Estimate P(Z > 4) by sampling, watch the plain estimator fail silently, and find ' +
          'the diagnostic that separates a good importance-sampling proposal from a bad one.',
        setup: 'Standard normal, threshold 4, exact answer 3.167124e-5 from the Mills-ratio ' +
          'continued fraction. 20 000 draws per estimator.',
        steps: [
          {
            do: 'Estimate the probability by plain sampling.',
            why: 'It is the obvious approach and the failure is instructive.',
            work: '0 draws of 20 000 exceeded 4, so the estimate is 0 and the sample variance is 0',
            result: 'an estimate of exactly zero with a standard error of exactly zero'
          },
          {
            do: 'Work out how many draws would be needed for one hit.',
            why: 'It explains the failure and sizes the alternative.',
            work: '1/3.167124e-5 = 31 574 draws per expected hit',
            result: 'a budget of 20 000 usually sees none, and reports certainty about it'
          },
          {
            do: 'Sample from N(4, 1) instead and reweight by the density ratio.',
            why: 'Put the draws where the event is, then correct the bias exactly.',
            work: 'weight = exp(−4x + 8) for x > 4; estimate 3.1633e-5, relative error 0.121%',
            result: '10 059 of 20 000 draws now land past the threshold'
          },
          {
            do: 'Over-shift the proposal to 7 and look at the hit count.',
            why: 'The obvious health signal points the wrong way here.',
            work: '19 982 of 20 000 draws exceed the threshold — the best hit count in the table',
            result: 'the estimate is 2.6696e-5, which is 15.709% low'
          },
          {
            do: 'Compute the effective sample size of the weights.',
            why: 'It is the statistic that separates the two cases.',
            work: '(Σw)²/Σw² = 3 628.9 at shift 4, and 75.4 at shift 7',
            result: 'at shift 7 the 20 000 draws are worth 75 — the estimate has not converged'
          }
        ],
        answer: 'The plain estimator returned zero with a standard error of zero, which is what ' +
          'a confident wrong answer looks like from the inside — no exception, no warning, and ' +
          'an interval of zero width around a value that is 100% low. Importance sampling fixes ' +
          'it and introduces a different failure: at a shift of 7 almost every draw is past the ' +
          'threshold, which reads as ideal, while the weights concentrate on a handful and the ' +
          'estimate is 15.7% out. The hit count and the weight ESS disagree, and the weight ESS ' +
          'is the one to believe. It is the same statistic that 19.4 uses on a correlated chain, ' +
          'and in both places it is what turns "the sampler ran" into "the sampler produced ' +
          'information".'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
