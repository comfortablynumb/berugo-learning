/** Worked examples for MCMC, fingerprinting and approximation ratios (M19.4-M19.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'markov-chain-monte-carlo': [
      {
        title: 'The chain that accepts 93% of its moves and is the worst one in the table',
        goal: 'Diagnose a badly mixed chain from its own output, and find out how far wrong its ' +
          'reported standard error is.',
        setup: 'A two-component Gaussian mixture in the plane with modes at ±2 and weights ' +
          '0.65/0.35, true mean −0.6. Metropolis with a symmetric normal proposal, 20 000 steps ' +
          'from (−2, 0), seed 42.',
        steps: [
          {
            do: 'Run with a proposal width of 0.1 and read the acceptance rate.',
            why: 'It is the first number on every sampler’s dashboard.',
            work: '92.7% of proposals accepted',
            result: 'by that measure the chain is in excellent health'
          },
          {
            do: 'Compare the estimated mean against the truth.',
            why: 'The chain has 20 000 draws; it should be close.',
            work: 'estimated −1.9849 against a true −0.6000, an error of 1.3849',
            result: 'the answer is wrong by more than twice the true value'
          },
          {
            do: 'Compute the standard error the usual way and compare.',
            why: 'This is the interval the chain would report.',
            work: 'σ/√N = 0.00557, so the error is 249 of its own standard errors',
            result: 'a very tight interval around a badly wrong number'
          },
          {
            do: 'Measure the integrated autocorrelation time and the effective sample size.',
            why: 'The draws are not independent, so N is not the sample size.',
            work: 'τ = 267.2, so ESS = 20 000 / 267.2 = 74.9; honest error bar 0.09099',
            result: 'the naive bar is 16.3× too narrow, and the answer is still 15 honest bars out'
          },
          {
            do: 'Check how much time the chain spent on the second mode.',
            why: 'The mean can only be wrong by that much if a whole mode was missed.',
            work: '1.3% of draws on the right-hand mode, against a true weight of 35.0%',
            result: 'the chain never crossed the valley, and no single-chain diagnostic says so'
          },
          {
            do: 'Run four chains from −3, −1, +1 and +3 and compute R̂.',
            why: 'A single chain has nothing to disagree with.',
            work: 'means −2.2719, −1.6051, −1.4836, +1.2352; R̂ = 1.5081 against a 1.01 threshold',
            result: 'the chains disagree, which is the only evidence available that any is wrong'
          }
        ],
        answer: 'Every symptom of this chain except one points the wrong way. The acceptance ' +
          'rate is 92.7% and the best-mixing width in the sweep accepts 17.1%; the trace looks ' +
          'like noise; the reported standard error is 0.006 on an answer that is 1.38 out. Only ' +
          'the effective sample size — 74.9 from 20 000 draws — and R̂ across dispersed chains ' +
          'catch it. The practical rule is three lines: run several chains from far-apart ' +
          'starts, report effective sample size rather than draw count, and do not quote a ' +
          'posterior mean whose R̂ exceeds 1.01.'
      },
      {
        title: 'Sweeping the proposal width, and finding the optimum in the middle',
        goal: 'Show that both failure modes are step-size problems sitting on opposite sides of ' +
          'an interior optimum, and that the acceptance rate at the optimum is low.',
        setup: 'The same mixture and the same 20 000 steps, with the proposal width swept across ' +
          '0.1, 0.3, 1, 2.4, 5 and 12.',
        steps: [
          {
            do: 'Read the acceptance rate down the sweep.',
            why: 'It falls monotonically, which makes it useless as a quality signal on its own.',
            work: '92.7%, 79.1%, 43.5%, 17.1%, 6.3%, 1.2%',
            result: 'monotone in the width, so it cannot have a maximum anywhere'
          },
          {
            do: 'Read the effective sample size down the same sweep.',
            why: 'This is the quantity that actually has an optimum.',
            work: '74.9, 23.2, 174.8, 559.7, 456.1, 151.4',
            result: 'a clear interior maximum at width 2.4, where acceptance is 17.1%'
          },
          {
            do: 'Read the error in the estimated mean.',
            why: 'It should track the effective sample size, and it does.',
            work: '1.3849, 0.3504, 0.1380, 0.0663, 0.0687, 0.3838',
            result: 'best at the same width, 21 times better than the highest-acceptance chain'
          },
          {
            do: 'Compare the two error columns across the sweep.',
            why: 'One of them is blind to the problem by construction.',
            work: 'naive: 0.00557 → 0.01430 → 0.01292, barely moving; honest: 0.09099 → 0.08546 → 0.14854',
            result: 'the naive bar only sees σ and N, so it cannot detect correlation at all'
          },
          {
            do: 'Notice the width-0.3 row, which is worse than both its neighbours.',
            why: 'The relationship is not smooth when a mode boundary is involved.',
            work: 'τ = 861.7 and ESS = 23.2 at width 0.3, against 267.2 and 74.9 at width 0.1',
            result: 'just enough step size to cross occasionally is worse than never crossing'
          }
        ],
        answer: 'The optimum is interior and the signal everyone watches is monotone, which is ' +
          'why proposal tuning is a search rather than a direction. The best chain in this sweep ' +
          'accepts 17.1% of its proposals — close to the 0.234 that is asymptotically optimal ' +
          'for a random walk — and is worth 559.7 independent draws against the ' +
          'highest-acceptance chain’s 74.9. The width-0.3 row is the one worth remembering: it ' +
          'has the worst effective sample size in the table because it crosses between modes ' +
          'just often enough to make the chain’s own history a poor predictor of itself, which ' +
          'is exactly what a long correlation time measures.'
      }
    ],

    'fingerprinting': [
      {
        title: 'Catching one wrong entry in a 3 600-entry product, and what the check costs',
        goal: 'Price verification against computation, and confirm that repetition drives the ' +
          'miss rate down exactly as 2⁻ᵏ while never producing a false alarm.',
        setup: 'Two 60 × 60 integer matrices, their true product, and a copy with one entry ' +
          'increased by 1. 4 000 independent seeds at each round count.',
        steps: [
          {
            do: 'Count the operations to compute the product.',
            why: 'It is the thing verification is being compared against.',
            work: '60³ multiply-adds = 432 000 operations',
            result: 'the baseline cost, cubic in n'
          },
          {
            do: 'Count the operations to check it eight times.',
            why: 'Each round is three matrix–vector products, not a matrix–matrix one.',
            work: '8 rounds × 3 × 60² × 2 = 43 200 operations',
            result: 'a factor of 10 cheaper at n = 60, and the gap grows linearly in n'
          },
          {
            do: 'Measure how often one round misses the corruption.',
            why: 'The bound says at most a half; a single wrong entry is the hardest case.',
            work: '2 034 of 4 000 seeds missed it: 0.50850, against a predicted 0.50000',
            result: 'the bound is attained, not merely respected'
          },
          {
            do: 'Read the miss rate down the round counts.',
            why: 'One-sided error multiplies, so it should halve each time.',
            work: '0.50850, 0.24550, 0.12300, 0.05650, 0.03275, 0.01575, 0.00925, 0.00500',
            result: 'each row is about half the one above, tracking 2⁻ᵏ'
          },
          {
            do: 'Run the same test against the CORRECT product at every round count.',
            why: 'This is the column that proves the error is one-sided.',
            work: '0 false alarms at every k, from 4 000 seeds each — 32 000 tests, none rejected',
            result: 'structurally zero, because a true identity has no counter-example'
          }
        ],
        answer: 'One wrong entry out of 3 600 — 0.028% of the matrix — is caught half the time ' +
          'per round, and eight rounds bring the miss rate to 0.005 at a tenth of the cost of ' +
          'the multiplication. The false-alarm column is what makes the round count a free ' +
          'parameter: there is no sensitivity-versus-specificity trade here, because a true ' +
          'identity holds at every point and no draw can refute it. That also makes the ' +
          'false-alarm counter a genuine correctness test rather than a statistic — any non-zero ' +
          'value is a bug.'
      },
      {
        title: 'A collision rate of zero that proves nothing, and the pair that fixes it',
        goal: 'Show that the ordinary case does not exercise the n/p bound at all, and construct ' +
          'the worst case the bound is actually about.',
        setup: 'Two sequences of 5 000 symbols compared by a random-base polynomial fingerprint ' +
          'over ℤ mod p, at p = 101, 1 009, 10 007 and 1 000 003, with 4 000 random bases each.',
        steps: [
          {
            do: 'Make the two sequences differ in exactly one position and measure collisions.',
            why: 'This is what a corrupted byte in a file looks like, and the obvious test.',
            work: '0 collisions of 4 000 at every field size, including p = 101',
            result: 'a measured rate of zero beside a bound of n/p = 1.0 at p = 101'
          },
          {
            do: 'Work out why, rather than declaring agreement.',
            why: 'Zero against a bound of 1.0 is consistent with anything.',
            work: 'the difference polynomial is a single term c·bᵏ, whose only root is b = 0',
            result: 'base zero is never drawn, so this pair can never collide'
          },
          {
            do: 'Construct a pair whose difference has many roots.',
            why: 'The bound is a worst case, and the worst case has to be built.',
            work: 'choose 8 bases, expand ∏(x − rᵢ) mod p, use its coefficients as the difference',
            result: 'a 9-symbol pair that collides on exactly those 8 bases'
          },
          {
            do: 'Measure the collision rate on the constructed pair.',
            why: 'Now the measurement has something to agree with.',
            work: '343 of 4 000 at p = 101 (0.08575) against a bound of 8/101 = 0.0792',
            result: 'the bound is attained to within sampling error'
          },
          {
            do: 'Check that the rate falls with the field size as d/p predicts.',
            why: 'The field size is the design dial and this is what it buys.',
            work: '0.08575, 0.01025, 0.00125 and 0.00000 at p = 101, 1 009, 10 007 and 1 000 003',
            result: 'roughly a factor of ten per decade of field size, as 8/p requires'
          }
        ],
        answer: 'The one-character pair collides zero times at every field size, and reporting ' +
          'that as agreement with the n/p bound would be a demo appearing to validate a theory ' +
          'it never tested. The constructed pair lands on the bound: 0.08575 measured against ' +
          '0.0792 at p = 101, falling to 0.00125 at p = 10 007. The construction is also the ' +
          'attack — anyone who knows the base can build a colliding pair in the time it takes to ' +
          'multiply out a polynomial — which is exactly why the base must be drawn after the ' +
          'data is fixed, and why a hard-coded multiplier turns the bound into decoration.'
      }
    ],

    'approximation-ratios': [
      {
        title: 'The algorithm with the proof loses to the one without it, on every instance measured',
        goal: 'Measure four vertex-cover algorithms against exact optima, then build the family ' +
          'where the ranking reverses.',
        setup: '200 random 12-vertex graphs at edge density 0.35, each solved exactly by subset ' +
          'enumeration, and then the degree-trap family at k = 20 through 100.',
        steps: [
          {
            do: 'Measure the maximal-matching cover against the exact optimum.',
            why: 'It is the algorithm with the proven factor of 2.',
            work: 'mean 1.5161, median 1.4286, worst exactly 2.0000, 0 bound violations',
            result: 'the bound is attained on real random instances, not just in theory'
          },
          {
            do: 'Measure highest-degree greedy on the same 200 instances.',
            why: 'It is the first improvement everybody proposes, and it has no bound.',
            work: 'mean 1.0321, median 1.0000, worst 1.2857',
            result: 'better than the provable algorithm on every summary statistic'
          },
          {
            do: 'Check feasibility separately from cost.',
            why: 'A cover that misses an edge is smaller and would flatter the ratio column.',
            work: '0 infeasible answers across all 200 instances for all four algorithms',
            result: 'the ratios are comparing valid covers'
          },
          {
            do: 'Build the family where greedy-by-degree loses.',
            why: 'The bound is a promise about inputs you have not seen.',
            work: 'at k = 20: 20 left vertices and 46 right ones, of degrees 20 down to 2; optimum 20 by König',
            result: 'at k = 20 greedy pays 46 against an optimum of 20 — a ratio of 2.30'
          },
          {
            do: 'Grow k and watch the two curves separate.',
            why: 'The greedy ratio grows like ln k and the matching one does not.',
            work: 'k = 60: 261 vertices, greedy 201 (3.35×); k = 100: 482, greedy 382 (3.82×), matching 198 (1.98×)',
            result: 'the crossover is around k = 20, and nothing about a random graph reveals it'
          }
        ],
        answer: 'On 200 random graphs the unprovable algorithm wins by a wide margin — 1.03 ' +
          'against 1.52 — and on the constructed family it loses without bound, reaching 3.82 ' +
          'at k = 100 while the matching algorithm holds at 1.98. Both facts are true and ' +
          'neither is the answer on its own. If you only know the bounds you will write an exact ' +
          'solver you did not need; if you only know the measurements you will ship something ' +
          'that fails on the one input that matters. The defensible position is to use the ' +
          'algorithm with the guarantee, know its measured distribution, and keep the exact ' +
          'solver for instances small enough to afford it.'
      },
      {
        title: 'A bound that is attained exactly, and one that is nowhere near',
        goal: 'Contrast a tight instance with a typical one on the same algorithm, and show ' +
          'where a bound comes from a lower bound rather than from the algorithm.',
        setup: 'Vazirani’s set-cover instance at n = 4 through 128, 120 random set-cover ' +
          'instances, and 60 ten-city metric TSP instances solved exactly by Held–Karp.',
        steps: [
          {
            do: 'Run greedy set cover on the tight instance and compare with H(n).',
            why: 'The claim is that the bound is attained, not approached.',
            work: 'n = 4: greedy 2.0833 = H(4). n = 128: greedy 5.4331 = H(128)',
            result: 'the greedy column and the harmonic column agree to every digit shown'
          },
          {
            do: 'Compare H(n) with ln n at the same sizes.',
            why: '"ln n" is the bound people quote and it is not the bound.',
            work: 'at n = 128, H(n) = 5.4331 against ln n = 4.8520 — 12% apart',
            result: 'the Euler–Mascheroni constant matters at real sizes'
          },
          {
            do: 'Run the same algorithm on 120 random instances.',
            why: 'This is what greedy set cover does when nobody is constructing the input.',
            work: 'mean ratio 1.2330, worst 2.0000',
            result: 'a few percent from optimal on average, against a bound above 5'
          },
          {
            do: 'Measure the MST as a fraction of the optimal tour on 60 TSP instances.',
            why: 'The 2-approximation bound comes entirely from this lower bound.',
            work: 'mean 0.7326, worst 0.8281, best 0.6328',
            result: 'MST ≤ OPT holds on every instance, which is what the doubling argument needs'
          },
          {
            do: 'Compare tree-doubling with Christofides on the same instances.',
            why: 'They differ only in how the odd-degree vertices are fixed.',
            work: 'doubling: mean 1.1428, worst 1.3275. Christofides: mean 1.0675, worst 1.2281',
            result: 'both far inside their bounds of 2 and 1.5, and Christofides wins on all three'
          }
        ],
        answer: 'Greedy set cover pays exactly H(n) on an instance somebody had to construct and ' +
          '1.23 on instances that arose by accident — the same algorithm, a factor of four ' +
          'apart. The TSP half shows where the other kind of bound comes from: almost all the ' +
          'work is in establishing that the minimum spanning tree lower-bounds the optimal tour, ' +
          'and once that holds, doubling and shortcutting are mechanical. Extract the general ' +
          'shape: an approximation ratio is usually a lower bound plus a construction, and ' +
          'finding a lower bound you can compute is the hard and reusable part.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
