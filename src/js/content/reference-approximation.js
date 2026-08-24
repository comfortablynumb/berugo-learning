/** Reference entries for LP relaxation, schemes and derandomisation (M19.7-M19.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'lp-relaxation': {
      summary: 'A vertex-cover relaxation solved by simplex on every instance, half-integrality ' +
        'observed rather than quoted, the integrality gap measured on random graphs and on the ' +
        'complete graphs where it approaches 2, and four MAX-SAT strategies scored against exact ' +
        'optima.',
      intuition: 'LP relaxation turns a modelling problem into a solved one: write the ' +
        'constraints honestly, relax, round, and you have a provable approximation without ' +
        'inventing an algorithm.',
      formulation: {
        equations: [
          {
            label: 'The relaxation and what it costs',
            expr: 'min Σ x_v subject to x_u + x_v ≥ 1 per edge, 0 ≤ x ≤ 1',
            terms: [
              { sym: 'the deleted line', meaning: 'x ∈ {0,1} becomes 0 ≤ x ≤ 1, and the problem becomes polynomial' },
              { sym: 'LP ≤ OPT', meaning: 'every integer solution is still a fractional one' },
              { sym: 'half-integrality', meaning: '150 of 150 basic solutions had every coordinate in {0, ½, 1}' },
              { sym: 'rounding at ½', meaning: 'feasible by inspection, and at most doubles the cost' }
            ]
          },
          {
            label: 'Four algorithms on 150 random 12-vertex graphs',
            expr: 'measured ratio against exact optima',
            terms: [
              { sym: 'LP relaxation (a lower bound)', meaning: 'mean 0.8752 of the integer optimum, worst 1.0000' },
              { sym: 'LP + threshold rounding', meaning: 'mean 1.5173, worst 2.0000' },
              { sym: 'primal–dual, no solver at all', meaning: 'mean 1.5057, worst 2.0000' },
              { sym: 'maximal matching', meaning: 'mean 1.5057, worst 2.0000 — the primal–dual method with the duality compiled away' }
            ]
          },
          {
            label: 'The integrality gap',
            expr: 'the ceiling on every rounding of this relaxation',
            terms: [
              { sym: 'random graphs', meaning: 'mean 1.1456, worst 1.3333 — the relaxation is nearly exact and rounding is the bottleneck' },
              { sym: 'K₃, K₅, K₇', meaning: '1.3333, 1.6000, 1.7143 — matching 2 − 2/n exactly' },
              { sym: 'K₁₁, K₁₅', meaning: '1.8182, 1.8667; the LP pays n/2 and the optimum is n − 1' },
              { sym: 'what it forbids', meaning: 'no rounding of THIS relaxation beats 2, however clever' }
            ]
          },
          {
            label: 'MAX-SAT on 60 formulas of mixed clause width, 14 variables',
            expr: 'mean, median and WORST (smallest) fraction of the optimum',
            terms: [
              { sym: 'a coin per variable', meaning: '79.00% mean, 79.31% median, 60.00% worst; bound 1 − 2⁻ᵏ per clause' },
              { sym: 'LP rounding', meaning: '97.62%, 100.00%, 82.76%; bound 1 − 1/e = 63.2%' },
              { sym: 'the better of the two', meaning: 'same mean here, worst 82.76%, inside its 3/4 bound' },
              { sym: 'conditional expectations (19.9)', meaning: '98.66%, 100.00%, 93.10% — and no randomness at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The LP optimum is a lower bound on the integer optimum',
          why: 'It is what makes the rounding factor an approximation ratio, and it is reportable on its own.',
          breaks: 'A relaxation that removes a constraint rather than only integrality is a different problem, and the bound no longer holds.'
        },
        {
          name: 'Every basic solution of the vertex-cover LP is half-integral',
          why: 'It is why threshold rounding at ½ is feasible by inspection rather than by argument.',
          breaks: 'An interior-point solver returns a non-basic optimum, which need not be half-integral; crossover to a vertex first.'
        },
        {
          name: 'The integrality gap bounds every rounding of the relaxation',
          why: 'It redirects effort from the algorithm to the model when it is large.',
          breaks: 'Chasing a better ratio against a relaxation whose gap already exceeds it is provably wasted work.'
        },
        {
          name: 'For a maximisation problem the worst case is the SMALLEST ratio',
          why: 'The direction flips relative to every minimisation table, and reading it the other way turns a guarantee into its opposite.',
          breaks: 'A MAX-SAT table quoting its largest ratio as "worst" is quoting its best case as its guarantee.'
        }
      ],
      complexity: [
        { operation: 'simplex on the vertex-cover LP', average: 'polynomial in practice; the demo solves the dual and reads the primal off the slack columns', worst: 'exponential in theory (Klee–Minty); ellipsoid and interior-point methods are polynomial' },
        { operation: 'threshold rounding', average: 'O(n) after the solve', worst: 'ratio 2, and the LP solve dominates the cost' },
        { operation: 'primal–dual vertex cover', average: 'O(m) — one pass over the edges, no solver', worst: 'ratio 2, with the dual value as a per-instance certificate' },
        { operation: 'randomised rounding for set cover', average: 'expected cost = the LP value per round; O(log n) rounds for high probability', worst: 'an element uncovered after t rounds with probability at most e⁻ᵗ' },
        { operation: 'the MAX-SAT LP', average: 'n + m variables and m + n + m constraints', worst: 'the demo caps instances at 14 variables and 45 clauses so the exact optimum stays enumerable' }
      ],
      failureModes: [
        {
          symptom: 'The rounded solution is infeasible.',
          cause: 'The rounding threshold does not match the constraint structure — rounding down where the constraint needs coverage.',
          fix: 'Check the constraint directly: for vertex cover, x_u + x_v ≥ 1 means at least one endpoint is ≥ ½.'
        },
        {
          symptom: 'The LP optimum is not half-integral.',
          cause: 'An interior-point solver returned a point in the middle of an optimal face rather than a vertex.',
          fix: 'Run the crossover step, or use a simplex method; the theorem is about basic solutions.'
        },
        {
          symptom: 'Rounding is being tuned and the ratio will not improve.',
          cause: 'The integrality gap is already at or above the target.',
          fix: 'Measure the gap. If it is near the ratio you want, strengthen the formulation instead — extra valid inequalities, or a semidefinite lift.'
        },
        {
          symptom: 'Randomised rounding sometimes leaves elements uncovered.',
          cause: 'One round covers each element with probability at least 1 − 1/e, which is not 1.',
          fix: 'Repeat for O(log n) rounds and report the residual failure probability, or add a deterministic repair pass and account for its cost.'
        },
        {
          symptom: 'A MAX-SAT algorithm that "always beats 3/4" turns out not to.',
          cause: 'Only the better of the coin flip and the LP rounding has that bound; either alone is weaker.',
          fix: 'Run both and take the maximum. The two are strong on opposite clause lengths, which is the whole construction.'
        }
      ],
      inTheWild: [
        { system: 'Gurobi, CPLEX and CBC', how: 'solve the relaxation at every branch-and-bound node; the bound that prunes the tree is exactly this relaxation, so one model gives both the exact solver and the approximation.' },
        { system: 'Google OR-Tools and Vehicle Routing', how: 'ships LP-based bounds beside heuristics so a route’s distance from optimal can be reported rather than guessed — the lower bound is often more useful than the ratio.' },
        { system: 'Ad allocation and ranking systems', how: 'formulate assignment as an LP, solve the relaxation at scale, and round — the fractional solution is also a useful answer on its own when traffic can be split.' }
      ],
      sources: [
        { title: 'The Design of Approximation Algorithms', author: 'Williamson and Shmoys', note: 'Chapters 1, 4 and 5: deterministic rounding, randomised rounding and the primal–dual method, with the MAX-SAT 3/4 argument in full.' },
        { title: 'Approximation Algorithms', author: 'Vijay V. Vazirani', note: 'Chapters 12 to 15 on LP duality and the primal–dual schema.' },
        { title: 'Vertex packings: structural properties and algorithms', author: 'Nemhauser and Trotter', note: 'The half-integrality theorem, which is also a preprocessing rule: the 0s and 1s are provably in some optimal cover.' },
        { title: 'Improved approximation algorithms for maximum cut and satisfiability problems using semidefinite programming', author: 'Goemans and Williamson', note: 'The 0.878 MAX-CUT algorithm, and the argument for why a stronger relaxation is the only way past an integrality gap.' },
        { title: 'Integer and Combinatorial Optimization', author: 'Nemhauser and Wolsey', note: 'The reference for formulation strength, valid inequalities and what makes one relaxation tighter than another.' }
      ]
    },

    'approximation-schemes': {
      summary: 'The knapsack FPTAS across the full ε range with achieved quality, table size and ' +
        'the scaling divisor in the same table, the crossing where the scheme costs more than ' +
        'the exact DP, the weight-scaling variant that produces infeasible answers, and the ' +
        'hardness results that say which problems admit a scheme at all.',
      intuition: 'An FPTAS is the best possible outcome for an NP-hard problem: you name the ' +
        'error you can tolerate and pay for exactly that much accuracy.',
      formulation: {
        equations: [
          {
            label: 'The construction',
            expr: 'K = ε·P_max/n, floor every profit, solve the profit-indexed DP exactly',
            terms: [
              { sym: 'the loss', meaning: 'each item loses less than K, so the solution loses less than nK = ε·P_max' },
              { sym: 'why that bounds the ratio', meaning: 'OPT ≥ P_max, because taking that single item is feasible' },
              { sym: 'the saving', meaning: 'the table shrinks from O(n·P) to O(n²/ε)' },
              { sym: 'the same number twice', meaning: 'the error and the saving are the scaling read from opposite sides' }
            ]
          },
          {
            label: 'The ε sweep on 20 strongly correlated items, exact optimum 6 764 at 258 640 cells',
            expr: 'divisor, achieved quality, promised quality and table size',
            terms: [
              { sym: 'ε = 0.5', meaning: 'K = 25.150, value 6 740 = 99.6452%, promised 50%, 10 100 cells — 25.6× smaller' },
              { sym: 'ε = 0.3', meaning: 'K = 15.090, 99.8522%, 16 940 cells' },
              { sym: 'ε = 0.2', meaning: 'K = 10.060, exactly 100.0000%, 25 500 cells' },
              { sym: 'ε = 0.02', meaning: 'K = 1.006, 100%, 256 900 cells — level with the exact DP' },
              { sym: 'ε = 0.01', meaning: 'K = 0.503, 514 000 cells — TWICE the exact DP, for the identical answer' }
            ]
          },
          {
            label: 'PTAS against FPTAS at the same guarantee',
            expr: 'enumerate every subset of size ≤ k, then fill greedily: ratio 1 − 1/(k+1) in O(n^(k+1))',
            terms: [
              { sym: 'k = 1', meaning: 'guarantee 50%, 21 subsets, achieved 99.25%' },
              { sym: 'k = 3', meaning: 'guarantee 75%, 1 351 subsets, achieved 100.00%' },
              { sym: 'k = 4', meaning: 'guarantee 80%, 6 196 subsets — growing as nᵏ' },
              { sym: 'the FPTAS at the matching ε', meaning: '10 100 to 25 500 cells, growing as n²/ε' }
            ]
          },
          {
            label: 'The two variants that do not work',
            expr: 'scaling the wrong axis, and greedy without its fallback',
            terms: [
              { sym: 'weight scaling at ε = 0.5', meaning: 'returns 6 931 — above the true optimum — with total weight 5 631 against a capacity of 5 465' },
              { sym: 'why', meaning: 'rounding weights changes feasibility; rounding profits changes only the objective' },
              { sym: 'density greedy on the trap', meaning: '2 against an optimum of 100 — 2.0%, and unbounded as the heavy item grows' },
              { sym: 'plus "or the best single item"', meaning: '100, exact here, and never below OPT/2 anywhere' }
            ]
          },
          {
            label: 'What each problem admits (quoted from the literature, not measured)',
            expr: 'the best known ratio and the barrier',
            terms: [
              { sym: 'knapsack', meaning: 'FPTAS; this is optimal, nothing better exists' },
              { sym: 'Euclidean TSP', meaning: 'PTAS (Arora, Mitchell), but no FPTAS unless P = NP' },
              { sym: 'metric TSP / vertex cover / MAX-3SAT', meaning: '3/2, 2 and 7/8 — all APX, all with matching hardness results' },
              { sym: 'set cover / general TSP', meaning: '(1 − o(1))·ln n and no constant factor at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The scaled solution is reported at its TRUE profit',
          why: 'The scaled value understates the answer and would make the guarantee look tighter than it is.',
          breaks: 'Reporting the scaled objective is a silent under-count that inflates the apparent accuracy of the scheme.'
        },
        {
          name: 'Only quantities that do not decide feasibility may be perturbed',
          why: 'It is the reason the construction scales profits rather than weights.',
          breaks: 'A weight-scaled answer exceeds the capacity and reports a value above the optimum — the only visible symptom.'
        },
        {
          name: 'A pseudo-polynomial DP is not a contradiction of NP-hardness',
          why: 'Its cost is polynomial in the numbers and the numbers are exponential in their encoding length.',
          breaks: 'Strongly NP-hard problems have no such DP, so this route to an FPTAS is closed for them.'
        },
        {
          name: 'The scheme only saves while K > 1',
          why: 'Dividing by a number below one multiplies the table rather than shrinking it.',
          breaks: 'Past ε = n/P_max you are paying approximation overhead for an exact answer.'
        }
      ],
      complexity: [
        { operation: 'exact profit-indexed DP', average: 'O(n·P) time and O(P) space', worst: 'pseudo-polynomial: P can be 2^(bits) in the input length' },
        { operation: 'knapsack FPTAS', average: 'O(n²/ε) time', worst: 'the constant is n/P_max; below that ε the table exceeds the exact one' },
        { operation: 'PTAS by k-subset enumeration', average: 'O(n^(k+1)) for ratio 1 − 1/(k+1)', worst: '6 196 subsets at k = 4 on 20 items, growing as nᵏ — unusable past k = 3 or 4' },
        { operation: 'density greedy plus best single item', average: 'O(n log n) for the sort', worst: 'ratio exactly 1/2, and either half alone is unbounded' }
      ],
      failureModes: [
        {
          symptom: 'The approximation is slower than the exact algorithm.',
          cause: 'ε is below n/P_max, so the scaling divisor is under 1 and the table has grown.',
          fix: 'Compute K and check it against 1. If K < 1, run the exact DP and say so.'
        },
        {
          symptom: 'The returned value exceeds the known optimum.',
          cause: 'The solution is infeasible — almost always weight scaling, or a capacity rounded the wrong way.',
          fix: 'Validate the chosen set against the ORIGINAL weights and capacity, never the scaled ones.'
        },
        {
          symptom: 'A greedy knapsack occasionally returns a tiny fraction of the optimum.',
          cause: 'Density greedy alone, on an instance with one heavy valuable item.',
          fix: 'Take the maximum of density greedy and the best single item — one comparison, and the ratio becomes 1/2.'
        },
        {
          symptom: 'A PTAS is unusable at the accuracy required.',
          cause: 'Its runtime is n^(1/ε), so tightening ε multiplies the exponent.',
          fix: 'Check whether an FPTAS exists for the problem; if not, the exponent is the honest cost and the accuracy has to be renegotiated.'
        },
        {
          symptom: 'Effort is going into beating a known approximation ratio and getting nowhere.',
          cause: 'The problem is APX-hard at that ratio, so beating it would prove P = NP.',
          fix: 'Look up the hardness result first. For MAX-3SAT the wall is at 7/8 and for set cover at ln n.'
        }
      ],
      inTheWild: [
        { system: 'Cargo and container loading systems', how: 'use knapsack FPTAS variants where an exact answer is unaffordable and a 1% shortfall is acceptable — the ε is set from the commercial tolerance rather than from the algorithm.' },
        { system: 'Ad auction and budget allocation systems', how: 'solve multiple-choice knapsack variants under a latency budget, where the accuracy dial is the only way to meet a deadline predictably.' },
        { system: 'Compiler instruction scheduling and register allocation', how: 'meet the same wall from the other side: the problems are APX-hard, so production compilers ship heuristics with no ratio and measure them on benchmark suites instead.' }
      ],
      sources: [
        { title: 'Approximation Algorithms', author: 'Vijay V. Vazirani', note: 'Chapter 8 on the knapsack FPTAS, with the profit-scaling argument in the form used here.' },
        { title: 'Fast approximation algorithms for the knapsack and sum of subset problems', author: 'Ibarra and Kim', note: 'The 1975 paper that introduced the scheme.' },
        { title: 'Some optimal inapproximability results', author: 'Johan Håstad', note: 'The 7/8 wall for MAX-3SAT, and the sharpest consequences of the PCP theorem.' },
        { title: 'A threshold of ln n for approximating set cover', author: 'Uriel Feige', note: 'Why greedy set cover is essentially optimal and no better ratio is coming.' },
        { title: 'Polynomial time approximation schemes for Euclidean TSP and other geometric problems', author: 'Sanjeev Arora', note: 'The PTAS whose existence, and whose runtime, is the clearest illustration of the PTAS/FPTAS distinction.' }
      ]
    },

    'derandomisation': {
      summary: 'A distribution of 500 random cuts with the deterministic answers marked on it, a ' +
        'conditional-expectation walk whose expectation is tabulated at every step, and a ' +
        'pairwise-independent sample space of 32 assignments whose average lands exactly on the ' +
        'bound.',
      intuition: '"In expectation" can be converted into "always" mechanically, and the ' +
        'conditional-expectation argument is a proof technique that turns directly into code.',
      formulation: {
        equations: [
          {
            label: 'A 16-vertex graph with 37 unit edges, so |E|/2 = 18.5',
            expr: 'four ways to get a cut, and what each one guarantees',
            terms: [
              { sym: 'one random assignment', meaning: 'mean 18.67 over 500 draws, and 232 of them below 18.5' },
              { sym: 'the best of 500 random draws', meaning: '26 — the largest in the table, with no guarantee at all' },
              { sym: 'conditional expectations', meaning: '25, deterministically, from 16 decisions and 0 random bits' },
              { sym: 'the pairwise-independent family', meaning: '24, from 32 assignments and 5 seed bits' },
              { sym: 'exact maximum cut', meaning: '28, from 32 768 enumerated assignments' }
            ]
          },
          {
            label: 'The conditional-expectation walk',
            expr: 'E[cut | decided] = edges already cut + half the edges with an undecided endpoint',
            terms: [
              { sym: 'the split', meaning: 'the current value is the average of the two branches, so one is at least it' },
              { sym: 'the trace', meaning: '18.50 → 18.50 → 19.00 → 19.50 → 20.00 → … → 25, never falling' },
              { sym: 'vertex 0', meaning: 'both branches are 0, the choice is arbitrary, and the expectation is unchanged' },
              { sym: 'the rule it collapses to', meaning: '"go opposite the majority of your already-placed neighbours"' }
            ]
          },
          {
            label: 'The pairwise-independent family',
            expr: 'x_S = ⊕ of the seed bits in S, for every non-empty S over ⌈log₂(n+1)⌉ bits',
            terms: [
              { sym: 'size', meaning: '5 seed bits give 32 members, against a full space of 65 536 — 2 048× smaller' },
              { sym: 'the average cut', meaning: 'exactly 18.5000, which is |E|/2 to four decimal places' },
              { sym: 'worst pairwise deviation', meaning: '0.0000 across all pairs of the first 12 coordinates' },
              { sym: 'worst triple deviation', meaning: '0.1250, failing first at (0, 1, 2) — their parities always sum to zero' }
            ]
          },
          {
            label: 'The same argument on MAX-SAT, 14 variables and 40 clauses of width 3',
            expr: 'E[satisfied] = Σ (1 − 2⁻ᵏ), which is 7/8 of the clauses at width 3',
            terms: [
              { sym: 'the expectation', meaning: '35.00 of 40 clauses' },
              { sym: 'random assignments', meaning: 'mean 35.10 over 500 draws, worst 28 (70.0% of the optimum), 178 below the expectation' },
              { sym: 'conditional expectations', meaning: '39, deterministically' },
              { sym: 'exact optimum', meaning: '40, from 16 384 enumerated assignments' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The conditional expectation never decreases along the walk',
          why: 'It is the entire proof: the final value is the answer, and it is at least the starting value.',
          breaks: 'Any step that takes the smaller branch loses the guarantee, and the result is then a heuristic with a familiar shape.'
        },
        {
          name: 'The family average equals the full-independence expectation',
          why: 'It is what makes enumerating the small space a deterministic algorithm with the same bound.',
          breaks: 'Only if the analysis used no more than pairwise independence; substituting the family into an analysis needing triples gives a wrong bound silently.'
        },
        {
          name: 'The family is exactly pairwise independent and not more',
          why: 'The measured triple deviation of 0.125 is the construction’s boundary, not a defect.',
          breaks: 'Triples whose index sets XOR to zero hit only four of eight patterns; those are the analyses it cannot be substituted into.'
        },
        {
          name: 'The best of many random draws is not a bound',
          why: 'It is a maximum over an experiment, and it changes when the seed changes.',
          breaks: 'It beats the deterministic answer here — 26 against 25 — and still cannot be promised to anyone.'
        }
      ],
      complexity: [
        { operation: 'one random assignment', average: 'n coin flips and one pass over the edges', worst: 'meets |E|/2 only in expectation; 46.4% of draws fell below it' },
        { operation: 'conditional-expectation walk', average: 'O(n + m) — one pass, computing two branch values per vertex', worst: 'the same; deterministic, and at least |E|/2 on every input' },
        { operation: 'enumerating the pairwise-independent family', average: 'O(n · 2^⌈log₂(n+1)⌉) = O(n²) cut evaluations', worst: '32 assignments at n = 16, against 65 536 for the full space' },
        { operation: 'exact maximum cut', average: 'O(2ⁿ⁻¹ · m)', worst: '32 768 assignments at n = 16; the oracle, not an algorithm' }
      ],
      failureModes: [
        {
          symptom: 'An algorithm "guaranteed to cut half the edges" produces less than half.',
          cause: 'The guarantee was in expectation, and a single run is a draw from a distribution centred on it.',
          fix: 'Derandomise, or run many times and take the best — but only the first gives a floor.'
        },
        {
          symptom: 'A derandomised algorithm gives a worse answer than the random one.',
          cause: 'It usually does on any individual instance; the deterministic version guarantees the mean rather than beating the maximum.',
          fix: 'Compare against the bound rather than against the best draw. The demo shows 25 against a best-of-500 of 26 and a bound of 18.5.'
        },
        {
          symptom: 'A k-wise independent family is substituted in and the bound stops holding.',
          cause: 'The analysis used more independence than the family supplies.',
          fix: 'Count the variables in the largest single term of the expectation. That count is the independence required.'
        },
        {
          symptom: 'A test using a randomised algorithm is flaky and gets disabled.',
          cause: 'The algorithm is unseeded, so the failure cannot be reproduced.',
          fix: 'Seed it, or derandomise it. Reproducibility is often worth more in production than the guarantee is.'
        }
      ],
      inTheWild: [
        { system: 'k-wise independent hash families', how: 'are the same construction generalised: they supply exactly the independence a sketch’s analysis uses, at logarithmic seed length — count-min and count-sketch in M07 depend on it.' },
        { system: 'Derandomised load balancing and scheduling', how: 'uses conditional expectations to convert "the random assignment balances in expectation" into a deterministic greedy with the same bound and no seed to manage.' },
        { system: 'Deterministic parallel algorithms', how: 'often derandomise by enumerating a small sample space in parallel — every processor takes one seed, which is exactly the construction here made concurrent.' }
      ],
      sources: [
        { title: 'The Probabilistic Method', author: 'Alon and Spencer', note: 'Chapter 16 on derandomisation, with the conditional-expectations argument in its general form.' },
        { title: 'Randomized Algorithms', author: 'Motwani and Raghavan', note: 'Chapter 5 covers small sample spaces, pairwise independence and the k-wise constructions.' },
        { title: 'Simple constructions of almost k-wise independent random variables', author: 'Naor and Naor', note: 'How to get almost-k-wise independence at a seed length that does not grow with k the obvious way.' },
        { title: 'Probability and Computing', author: 'Mitzenmacher and Upfal', note: 'The MAX-CUT and MAX-SAT derandomisations, and the limited-independence chapter that explains when the substitution is legal.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
