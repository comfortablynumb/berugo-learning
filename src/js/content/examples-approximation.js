/** Worked examples for LP relaxation, schemes and derandomisation (M19.7-M19.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'lp-relaxation': [
      {
        title: 'Relax, solve, round — and read the gap to find out whether it was worth it',
        goal: 'Take one instance from integer program to rounded answer, then measure the ' +
          'integrality gap over many instances to see what the method can and cannot reach.',
        setup: 'A 12-vertex random graph at density 0.35, and then 150 more like it, each solved ' +
          'exactly by subset enumeration.',
        steps: [
          {
            do: 'Write the program and delete the integrality constraint.',
            why: 'The hard part of the problem is confined to that one line.',
            work: 'min Σ x_v subject to x_u + x_v ≥ 1 per edge, with 0 ≤ x ≤ 1 instead of x ∈ {0,1}',
            result: 'a linear program, solvable in polynomial time'
          },
          {
            do: 'Solve it and look at the solution.',
            why: 'The shape of the fractional answer decides which rounding applies.',
            work: 'the LP pays 6.00, with all 12 coordinates at exactly 0.500',
            result: 'half-integral, so threshold rounding at ½ is feasible by inspection'
          },
          {
            do: 'Round at ½ and compare with the exact optimum.',
            why: 'The bound says at most twice the LP value; the optimum says what it really cost.',
            work: 'the rounded cover has 12 vertices against an exact optimum of 7',
            result: 'a ratio of 1.71 against a guarantee of 2, on this instance'
          },
          {
            do: 'Check half-integrality on all 150 instances.',
            why: 'The rounding depends on it, so it is worth observing rather than quoting.',
            work: '150 of 150 basic solutions had every coordinate in {0, ½, 1}',
            result: 'the Nemhauser–Trotter theorem, measured'
          },
          {
            do: 'Measure the integrality gap over the same 150 instances.',
            why: 'It bounds every possible rounding of this relaxation, not just this one.',
            work: 'mean 1.1456, worst 1.3333, against a supremum of 2',
            result: 'on typical instances the relaxation is nearly exact'
          }
        ],
        answer: 'The recipe is mechanical and produces three things at once: a lower bound you ' +
          'can report immediately, a rounding whose proof is two lines, and a gap that tells you ' +
          'where the loss is. On these instances the gap averages 1.1456 — the relaxation is ' +
          'close to the integer optimum and almost all of the ratio comes from the rounding, so ' +
          'a smarter rounding would help. That is the diagnostic the method is really for, and ' +
          'the second example shows what it looks like when the answer is the opposite.'
      },
      {
        title: 'The complete graph, where the gap says no rounding will ever help',
        goal: 'Find the family where the integrality gap approaches 2, and read off what that ' +
          'forbids.',
        setup: 'The complete graphs K₃ through K₁₅, where the LP is solved by simplex and the ' +
          'integer optimum is n − 1 by inspection.',
        steps: [
          {
            do: 'Solve the vertex-cover LP on Kₙ.',
            why: 'The symmetry forces every coordinate to the same value.',
            work: 'every vertex at ½, so the LP pays n/2 — measured 7.50 at K₁₅',
            result: 'a fractional solution that is feasible and cheap'
          },
          {
            do: 'Find the integer optimum.',
            why: 'Any two vertices left out leave an uncovered edge between them.',
            work: 'at most one vertex can be excluded, so the optimum is n − 1 = 14 at K₁₅',
            result: 'an integer answer nearly twice the fractional one'
          },
          {
            do: 'Compute the gap at each size.',
            why: 'It is the ratio the family exists to demonstrate.',
            work: '1.3333, 1.6000, 1.7143, 1.7778, 1.8182, 1.8667 at K₃ through K₁₅',
            result: 'matching 2 − 2/n exactly at every size'
          },
          {
            do: 'Read off what the gap forbids.',
            why: 'This is the practical content, and it is a statement about every algorithm.',
            work: 'any rounding produces a cover of cost ≥ OPT ≥ (2 − 2/n)·LP',
            result: 'no rounding of THIS relaxation can beat 2, however clever'
          },
          {
            do: 'Note what would be needed to do better.',
            why: 'The limit is the model, not the algorithm.',
            work: 'a stronger relaxation: the semidefinite lift that gives MAX-CUT its 0.878',
            result: 'and under the unique games conjecture, even that does not help for vertex cover'
          }
        ],
        answer: 'A gap approaching 2 is not a fact about a rounding scheme; it is a fact about ' +
          'the relaxation, and it says that any amount of cleverness applied after the LP is ' +
          'wasted. That is the most useful thing the method produces, because it redirects ' +
          'effort from the algorithm to the formulation. It is also why measuring the gap on ' +
          'your own instances is worth doing and is almost never done: on the random graphs the ' +
          'gap averaged 1.1456 and rounding was the bottleneck, and on the complete graphs it ' +
          'reaches 1.8667 and the model is.'
      }
    ],

    'approximation-schemes': [
      {
        title: 'Turning the ε dial, and the point where it stops being an approximation',
        goal: 'Trace accuracy and table size across the whole ε range on one instance, and find ' +
          'where the scheme costs more than the exact algorithm.',
        setup: '20 strongly correlated knapsack items (profit = weight + 100) with weights up to ' +
          '1 000 and a capacity of 5 465, solved exactly by the profit-indexed DP at 258 640 cells.',
        steps: [
          {
            do: 'Ask for half the optimum and see what arrives.',
            why: 'The loosest setting is the one that saves the most, and the guarantee is weakest there.',
            work: 'ε = 0.5: K = 25.150, value 6 740 against an optimum of 6 764 = 99.6452%',
            result: '50% promised, 99.6% delivered'
          },
          {
            do: 'Read the table size at that setting.',
            why: 'The saving is what the accuracy was traded for.',
            work: '10 100 cells against the exact 258 640 — a factor of 25.6',
            result: 'a 25× cheaper computation for a 0.35% loss'
          },
          {
            do: 'Tighten ε and watch the achieved quality.',
            why: 'The guarantee improves; the question is whether the answer does.',
            work: 'ε = 0.3 gives 99.8522%, and ε = 0.2 gives exactly 100.0000%',
            result: 'the answer stops improving long before the guarantee does'
          },
          {
            do: 'Keep tightening and watch the table size.',
            why: 'Cost is linear in 1/ε, so it should keep growing.',
            work: '25 500 → 51 240 → 102 680 → 256 900 → 514 000 cells at ε = 0.2 down to 0.01',
            result: 'at ε = 0.01 the table is twice the exact one'
          },
          {
            do: 'Explain the crossing rather than working around it.',
            why: 'It is a property of the construction and not of this instance.',
            work: 'K = ε·P_max/n = 0.01 · 1 100 / 20 = 0.503, and dividing by a number below 1 multiplies',
            result: 'the scheme saves only while K > 1, that is while ε > n/P_max'
          }
        ],
        answer: 'The scheme delivers 99.6% of the optimum when asked for 50%, from a table 25.6 ' +
          'times smaller — and at ε = 0.01 it uses 514 000 cells to produce exactly the answer ' +
          'the exact DP produces in 258 640. The guarantee is a floor and the realised quality ' +
          'saturates almost immediately, so the engineering move is to ask for the loosest ε you ' +
          'can live with and measure. Past the crossing at K = 1 you are paying approximation ' +
          'machinery for an exact answer, and the right response is to run the exact algorithm ' +
          'and say so.'
      },
      {
        title: 'Two ways to get it wrong: scaling the wrong axis, and greedy with no fallback',
        goal: 'Run the variants that do not work and see how each one fails, since neither ' +
          'failure raises an exception.',
        setup: 'The same 20-item instance for the weight-scaling variant, and a two-item ' +
          'instance for the greedy trap: one item of profit 2 and weight 1, one of profit 100 ' +
          'and weight 100, capacity 100.',
        steps: [
          {
            do: 'Apply the same ε = 0.5 scaling to the weights instead of the profits.',
            why: 'The two look symmetric, and the construction chose profits for a reason.',
            work: 'the scaled solve returns items of total weight 5 631 against a capacity of 5 465',
            result: 'infeasible by 166 — over capacity, not merely suboptimal'
          },
          {
            do: 'Look at the reported value.',
            why: 'The failure mode is the reason this matters.',
            work: '6 931, which is HIGHER than the true optimum of 6 764',
            result: 'a better-than-optimal answer, which is the signature of an infeasible one'
          },
          {
            do: 'State the asymmetry.',
            why: 'It generalises to every relaxation, not just this scheme.',
            work: 'the same 20 items: profit-scaled weight 5 465 or below, weight-scaled 5 631',
            result: 'a relaxation may only perturb quantities that do not decide feasibility'
          },
          {
            do: 'Run density greedy alone on the trap instance.',
            why: 'Density is the obvious criterion and it has no bound.',
            work: 'it takes the light item at density 2.0, leaving 99 capacity and no item to fill it: value 2',
            result: '2% of the optimum of 100, and the ratio is unbounded as the heavy item grows'
          },
          {
            do: 'Add "or the best single item, whichever is larger".',
            why: 'One comparison turns an unbounded heuristic into a 1/2-approximation.',
            work: 'best single item is the heavy one at 100; max(2, 100) = 100',
            result: 'exact here, and never below OPT/2 anywhere'
          }
        ],
        answer: 'Both failures are silent. The weight-scaled variant returns 6 931 against a true ' +
          'optimum of 6 764 — a value above the optimum, which is the only visible symptom of an ' +
          'infeasible answer — and density greedy returns 2% of the optimum with no complaint at ' +
          'all. The fixes are asymmetric in effort: the first requires understanding which ' +
          'quantity may be perturbed, and the second is one comparison. Both are worth ' +
          'remembering as questions to ask of any scheme: what does the relaxation perturb, and ' +
          'what is the instance on which the greedy criterion is worst?'
      }
    ],

    'derandomisation': [
      {
        title: 'A bound met in expectation and missed by half the runs, and two ways to fix it',
        goal: 'Measure how often a random assignment actually meets the |E|/2 bound, then get it ' +
          'deterministically two different ways.',
        setup: 'A 16-vertex random graph with 37 unit-weight edges, so |E|/2 = 18.5. 500 random ' +
          'assignments, and the exact maximum cut from 32 768 enumerated assignments.',
        steps: [
          {
            do: 'Draw 500 random assignments and check the mean.',
            why: 'The expectation argument says it should be |E|/2.',
            work: 'mean cut 18.67 against a predicted 18.5',
            result: 'the expectation is right'
          },
          {
            do: 'Count how many individual draws fall below the bound.',
            why: 'An average says nothing about a single run.',
            work: '232 of 500 — 46.4% — are below 18.5',
            result: '"at least half the edges in expectation" fails about half the time'
          },
          {
            do: 'Walk the conditional expectation instead, one vertex at a time.',
            why: 'One branch of every split is at least the current average, so take it.',
            work: 'the expectation rises 18.50 → 19.00 → 19.50 → … → 25, never falling',
            result: 'a cut of 25, deterministically, with no coins at all'
          },
          {
            do: 'Build the pairwise-independent family and enumerate it.',
            why: 'The expectation only ever used pairs of coordinates.',
            work: '5 seed bits give 32 assignments; their average cut is exactly 18.5000',
            result: 'best member 24, from 32 assignments instead of 65 536'
          },
          {
            do: 'Compare against the exact maximum and against the best random draw.',
            why: 'Both deterministic methods have a floor; the best-of-many does not.',
            work: 'exact 28; best of 500 random draws 26; conditional 25; small space 24',
            result: 'the best random draw wins on this instance and guarantees nothing'
          }
        ],
        answer: 'The random assignment’s mean is 18.67 against a predicted 18.5 and 232 of its ' +
          '500 draws miss the bound, which is what "in expectation" means when you have to ship ' +
          'one answer. The conditional-expectation walk reaches 25 deterministically and cannot ' +
          'fall below 18.5 on any input; enumerating 32 pairwise-independent assignments reaches ' +
          '24 with the same guarantee. The best of 500 random draws reaches 26 and beats both — ' +
          'and is still the wrong thing to ship, because it is a maximum over an experiment ' +
          'rather than a bound, and it is not reproducible.'
      },
      {
        title: 'How much independence the analysis really used, measured',
        goal: 'Establish that pairwise independence is enough for MAX-CUT, that the small family ' +
          'supplies exactly that and no more, and that the same argument transfers to MAX-SAT.',
        setup: 'The family {parity of the seed bits in S} for every non-empty S over 5 seed ' +
          'bits, giving 32 assignments over 16 coordinates.',
        steps: [
          {
            do: 'Write the expected cut as a sum and count the variables in each term.',
            why: 'That count is exactly the independence the analysis needs.',
            work: 'E[cut] = Σ over edges of Pr[endpoints differ]; each term mentions 2 coordinates',
            result: 'pairwise independence suffices, by linearity of expectation'
          },
          {
            do: 'Size the family.',
            why: 'It replaces 2ⁿ assignments with something polynomial.',
            work: '⌈log₂(16 + 1)⌉ = 5 seed bits, so 2⁵ = 32 members against 2¹⁶ = 65 536',
            result: 'a sample space 2 048 times smaller'
          },
          {
            do: 'Measure the worst deviation from uniform over every pair of coordinates.',
            why: 'The claim is exact independence, not approximate.',
            work: 'worst deviation 0.0000 across all pairs of the first 12 coordinates',
            result: 'every pair hits each of the four patterns exactly a quarter of the time'
          },
          {
            do: 'Measure the same over every triple.',
            why: 'The family is provably not three-wise independent, and the failure should be visible.',
            work: 'worst deviation 0.1250, first failing at coordinates (0, 1, 2)',
            result: 'those three parities always sum to zero, so 4 of the 8 patterns never occur'
          },
          {
            do: 'Confirm the family average equals the bound.',
            why: 'If pairwise is enough, the average must be exactly |E|/2.',
            work: 'the 32 members average a cut of exactly 18.5000 against |E|/2 = 18.5',
            result: 'so the best member is at least the bound, deterministically'
          },
          {
            do: 'Apply the conditional-expectation argument to MAX-SAT.',
            why: 'The technique is not specific to cuts.',
            work: 'expectation Σ(1 − 2⁻ᵏ) = 35.00; the walk reaches 39 against an exact optimum of 40',
            result: '178 of 500 random assignments fell below the expectation the walk guarantees'
          }
        ],
        answer: 'The measured pairwise deviation is exactly zero and the triple deviation is ' +
          'exactly 0.125, which is the construction’s boundary rather than a defect — the space ' +
          'is small precisely because it is only pairwise. Since the MAX-CUT expectation is a ' +
          'sum of two-coordinate terms, that is all it ever needed, and the family average lands ' +
          'on 18.5000 to four decimal places. The transferable move is the question: read the ' +
          'analysis, find the largest number of variables any single term touches, and that is ' +
          'the independence you have to supply. Everything beyond it is randomness you are ' +
          'paying for and not using.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
