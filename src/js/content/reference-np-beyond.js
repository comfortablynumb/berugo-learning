/** Reference entries for beyond NP, parameterised algorithms and metaheuristics (M20.4-M20.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'beyond-np': {
      summary: 'One clause set under five quantifier prefixes, each evaluated by recursive ' +
        'expansion and checked against a truth-table oracle, plus two games whose clauses are ' +
        'identical and whose answers are opposite, and the expansion cost of turning each ' +
        'prefix into ordinary CNF.',
      intuition: 'A quantifier prefix turns a search into a game, and a game has no short ' +
        'certificate — the witness is a strategy rather than an assignment.',
      formulation: {
        equations: [
          {
            label: 'The sentence, and what each part costs',
            expr: '∃x₁ ∀x₂ ∃x₃ … φ, evaluated by OR over ∃ levels and AND over ∀ levels',
            terms: [
              { sym: 'all ∃', meaning: 'exactly SAT; the demo reports TRUE and a SAT solver agrees' },
              { sym: 'any ∀', meaning: 'a different question; three of the demo’s five prefixes are FALSE on the same clauses' },
              { sym: 'the recursion depth', meaning: 'the prefix length, which is why the class is bounded by SPACE rather than time' },
              { sym: 'the certificate', meaning: 'a strategy of 2ᵘ entries for u universal variables — 64 in the demo’s deepest row' }
            ]
          },
          {
            label: 'Five prefixes on 10 variables and 14 clauses, seed 5',
            expr: 'alternations · ∀ variables · answer · evaluation nodes · expanded clauses',
            terms: [
              { sym: 'E', meaning: '0 · 0 · TRUE · 37 · 14' },
              { sym: 'EA and AE', meaning: '1 · 5 · FALSE · 223 and 546 · 152 and 208' },
              { sym: 'EAE', meaning: '2 · 3 · TRUE · 277 · 78' },
              { sym: 'AEAE', meaning: '3 · 6 · FALSE · 46 · 264 — the cheapest to evaluate and the most expensive to expand' }
            ]
          },
          {
            label: 'The two games, identical clauses',
            expr: '∀x ∃y (x agrees with y) against ∃y ∀x (x agrees with y)',
            terms: [
              { sym: '∀ then ∃', meaning: 'TRUE at every size — 6, 19, 51, 127 nodes for 1 to 4 rounds' },
              { sym: '∃ then ∀', meaning: 'FALSE at every size — 6, 14, 30, 62 nodes' },
              { sym: 'the winning strategy', meaning: '2, 4, 8, 16 entries — a function of the opponent’s moves' },
              { sym: 'what a SAT solver says', meaning: 'satisfiable for both, because a CNF carries no prefix' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The evaluator agrees with a truth-table oracle on every prefix',
          why: 'The two share no code — one recurses over the prefix, the other builds 2ⁿ entries and folds inward — so agreement is evidence rather than a second opinion.',
          breaks: 'Folding the prefix in the wrong order, or taking OR where AND belongs, produces a plausible answer on many instances and a wrong one on some.'
        },
        {
          name: 'Every variable is quantified',
          why: 'A formula with a free variable is not a sentence, and reading it as one silently answers a question nobody asked.',
          breaks: 'A prefix that omits a variable makes the "answer" depend on a default the caller never chose.'
        },
        {
          name: 'The expansion is equisatisfiable, with fresh existentials per copy',
          why: 'Sharing existential variables across copies would let one copy’s choice constrain another, which the sentence does not say.',
          breaks: 'Reusing the same existential variables makes the expansion strictly stronger than the sentence, turning true sentences false.'
        }
      ],
      complexity: [
        { operation: 'QBF by recursive expansion', average: '37 to 546 nodes on the demo’s prefixes', worst: '2ⁿ leaves; the pruning only helps when a clause is already falsified' },
        { operation: 'the truth-table oracle', average: '2ⁿ entries then n folds — 1 024 entries at 10 variables', worst: 'the same at every instance; it does no pruning at all' },
        { operation: 'expanding the universals into CNF', average: '2ᵘ copies of the matrix', worst: '264 clauses from 14 at 6 universal variables; a million copies at 20' },
        { operation: 'the same matrix as plain SAT', average: 'whatever DPLL costs on it', worst: 'answers a different question, so the cost is not comparable' },
        { operation: 'writing down a winning strategy', average: '2ᵘ entries', worst: 'this is the certificate size, and it is why QBF is not in NP' }
      ],
      failureModes: [
        {
          symptom: 'A robust-optimisation model is handed to a SAT or MIP solver and returns nonsense.',
          cause: 'The requirement had a ∀ in it — "for every failure scenario" — and the model dropped it.',
          fix: 'Enumerate the adversary set explicitly and conjoin one copy per scenario, or move to a solver that handles the alternation.'
        },
        {
          symptom: 'A QBF encoding is expanded to CNF and the file will not fit in memory.',
          cause: 'Expansion doubles per universal variable; twenty is a million copies.',
          fix: 'Use a QBF solver, or bound the adversary so the conjunction is small enough to write.'
        },
        {
          symptom: 'The optimiser has no progress to report and cannot be resumed.',
          cause: 'At this level there is no partial certificate — the witness is a strategy, so "how much is left" is not a number the solver holds.',
          fix: 'Restructure to a sequence of NP-level queries with explicit scenarios, which restores warm starts and progress.'
        },
        {
          symptom: 'A "how many" requirement is treated as a "is there" requirement.',
          cause: 'Counting is #P-complete even where deciding is polynomial — counting bipartite perfect matchings is the standard example.',
          fix: 'Check the counting version’s class separately, and consider approximate counting rather than exact.'
        }
      ],
      inTheWild: [
        'Two-player games: generalised chess and go are EXPTIME-complete, and geography is the textbook PSPACE-complete game.',
        'Robust optimisation and security hardening: "the smallest configuration no attack in this set breaks" is Σ₂ shaped.',
        'Bounded model checking with unbounded environments, where the environment is universally quantified.',
        'Circuit minimisation: "is there a smaller circuit equivalent to this one?" is a Σ₂ question, and it is why the problem resists.'
      ],
      sources: [
        { title: 'Arora and Barak — Computational Complexity, chapters 4 and 5', note: 'the hierarchy, PSPACE and the collapse property' },
        { title: 'Stockmeyer and Meyer — Word problems requiring exponential time', note: 'QBF as the canonical PSPACE-complete problem' },
        { title: 'Valiant — The complexity of computing the permanent (1979)', note: 'counting is harder than deciding, with the matching example' },
        { title: 'Toda — PP is as hard as the polynomial-time hierarchy (1991)', note: 'the whole hierarchy inside one #P oracle call' },
        { title: 'Papadimitriou — Computational Complexity', note: 'the clearest treatment of alternation as a machine model' }
      ]
    },

    'parameterised-algorithms': {
      summary: 'Vertex cover five ways on one instance with brute force as the oracle, two ' +
        'branching rules with and without preprocessing swept over the budget, a kernel measured ' +
        'as the instance grows fourteenfold, and a treewidth dynamic program on graphs of rising ' +
        'density.',
      intuition: 'Exponential in the parameter you control and polynomial in the data is a ' +
        'promise about the shape of the cost, and it is the only promise that survives contact ' +
        'with production data sizes.',
      formulation: {
        equations: [
          {
            label: 'The definition and the two branchings',
            expr: 'f(k)·n^O(1); T(k) = 2·T(k − 1) against T(k) = T(k − 1) + T(k − d)',
            terms: [
              { sym: 'edge branching', meaning: 'one endpoint or the other; 2^(k+1) − 1 nodes exactly' },
              { sym: 'degree branching', meaning: 'the vertex, or all d of its neighbours; base below 2' },
              { sym: 'measured, rules off', meaning: '2.0030 against 1.4991 over the demo’s NO runs' },
              { sym: 'measured, rules on', meaning: '3.0163 against 1.6712 — higher fits on lower counts' }
            ]
          },
          {
            label: 'The Buss kernel',
            expr: 'deg(v) > k ⟹ v is forced; deg(v) = 0 ⟹ v is dropped; > k² edges ⟹ NO',
            readAs: 'A vertex of degree above k is forced into the cover, an isolated vertex is ' +
              'dropped, and more than k squared edges after the rules means no.',
            terms: [
              { sym: 'why it is safe', meaning: 'covering the edges at v one at a time would cost more than k' },
              { sym: 'the bound', meaning: '≤ k² edges and ≤ k² + k vertices, independent of n' },
              { sym: 'measured at k = 12', meaning: '46 → 646 vertices and 137 → 1 953 edges give kernels of 13 → 14 edges' },
              { sym: 'the shrink factor', meaning: '10.5×, 18.6×, 37.3×, 70.7×, 139.5× as n grows' }
            ]
          },
          {
            label: 'Five methods on 20 vertices and 45 edges, budget 12',
            expr: 'search nodes, all returning a valid cover of 12',
            terms: [
              { sym: 'brute force', meaning: '1 048 576 subsets — exponential in n' },
              { sym: 'edge branching', meaning: '925 nodes without rules, 389 with' },
              { sym: 'degree branching', meaning: '13 nodes, with or without rules' },
              { sym: 'kernel then branch', meaning: '13 nodes, and the kernel is what bounds the input to the search' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every reduction rule preserves the exact optimum',
          why: 'A rule that is nearly safe returns a smaller cover for an instance that has none, and nothing downstream notices.',
          breaks: '"Take the highest-degree vertex" is the plausible unsafe version, and the optimum need not contain it.'
        },
        {
          name: 'Every returned cover is checked against the graph, not against the search',
          why: 'A cover missing an edge is smaller than a valid one and flatters every other column.',
          breaks: 'Trusting the search’s own accounting hides an off-by-one in the branch that removes a vertex.'
        },
        {
          name: 'The reported treewidth is an upper bound, not the treewidth',
          why: 'The decomposition comes from a min-degree heuristic; computing treewidth exactly is NP-hard.',
          breaks: 'Calling the heuristic’s width "the treewidth" makes a 2^w bound sound tighter than it is.'
        }
      ],
      complexity: [
        { operation: 'brute-force vertex cover', average: '2ⁿ subsets — 1 048 576 at n = 20', worst: 'the same; it does not depend on the answer' },
        { operation: 'edge branching', average: 'exactly 2^(k+1) − 1 nodes with the rules off', worst: '4 095 nodes at the largest refutable budget in the demo' },
        { operation: 'degree branching', average: 'fitted base 1.4991; 13 nodes at k = 12', worst: '53 nodes at the same budget where edge branching spends 4 095' },
        { operation: 'Buss kernelisation', average: 'polynomial — repeated degree scans to a fixed point', worst: 'output ≤ k² edges regardless of n; 14 edges at k = 12 on 1 953' },
        { operation: 'treewidth DP', average: '2^(w+1) states per bag, linear in the bag count', worst: '2 048 states per bag at width 10; 16 at width 3' },
        { operation: 'min-degree elimination ordering', average: 'O(n²) with a naive scan', worst: 'gives an upper bound on treewidth, never the exact value' }
      ],
      failureModes: [
        {
          symptom: 'A "1.47^k algorithm" measures like 2^k in practice.',
          cause: 'The branching rule is edge branching in disguise, or the high-degree branch is not taking all neighbours at once.',
          fix: 'Measure the base by fitting node counts over NO instances at several k, and compare against the control with the rules off.'
        },
        {
          symptom: 'Preprocessing appears to make the algorithm asymptotically worse.',
          cause: 'The fitted base was taken over a window where the rules were still firing hard, which flattens the left end.',
          fix: 'Report node counts and the fitted base together, and extend the window past the point where the rules stop engaging.'
        },
        {
          symptom: 'The kernel is no smaller than the input.',
          cause: 'No vertex has degree above k, so the high-degree rule never fires — the instance is uniform and k is large.',
          fix: 'That is the honest answer for that instance. Use a stronger kernel (crown decomposition, LP-based) or a different parameter.'
        },
        {
          symptom: 'The treewidth DP is slower than plain branching.',
          cause: 'The graph is dense, so the width is large and 2^(w+1) dominates.',
          fix: 'Pick the parameter from the instances: width for near-tree structures, answer size for sparse-answer ones.'
        }
      ],
      inTheWild: [
        'Conflict analysis in build systems: the number of conflicting constraints is the parameter, and it is small.',
        'Bioinformatics: phylogeny and haplotyping problems are routinely solved by FPT algorithms parameterised by the number of exceptions.',
        'Program analysis: control-flow graphs of structured programs have bounded treewidth, which is what makes several exact analyses feasible.',
        'Kernelisation as preprocessing in ILP and SAT pipelines, where a safe polynomial shrink is worth running before any solver call.'
      ],
      sources: [
        { title: 'Cygan et al. — Parameterized Algorithms', note: 'the standard modern reference, and free online' },
        { title: 'Downey and Fellows — Fundamentals of Parameterized Complexity', note: 'the W-hierarchy and what it rules out' },
        { title: 'Buss and Goldsmith — Nondeterminism within P', note: 'the kernel this section measures' },
        { title: 'Chen, Kanj and Xia — Improved upper bounds for vertex cover', note: 'the 1.2738^k line of results the 1.4656 bound sits below' },
        { title: 'Bodlaender — A linear-time algorithm for finding tree-decompositions of small treewidth', note: 'why exact treewidth is theoretically possible and practically not' }
      ]
    },

    metaheuristics: {
      summary: 'Eight methods on one TSP instance under one evaluation budget with best-so-far ' +
        'curves, the same tournament at four budgets to show the ranking changing, an annealing ' +
        'temperature sweep including zero, and a fifteen-city instance scored against an exact ' +
        'Held–Karp optimum.',
      intuition: 'Every metaheuristic is one answer to "what do I do at a local optimum", and ' +
        'the only honest way to compare the answers is a fixed evaluation budget with the ' +
        'trivial baseline included.',
      formulation: {
        equations: [
          {
            label: 'The 2-opt move and its cost',
            expr: 'Δ = d(a, c) + d(b, d) − d(a, b) − d(c, d)',
            readAs: 'The change in tour length is the two new edges minus the two old ones.',
            terms: [
              { sym: 'four lookups', meaning: 'one candidate move is O(1), not O(n) — charging a recosting rigs the budget' },
              { sym: 'the neighbourhood', meaning: 'about n²/2 candidate reversals per sweep' },
              { sym: 'or-opt', meaning: 'lift a run of 1 to 3 cities and reinsert; a six-term delta, also O(1)' },
              { sym: 'the unit', meaning: 'one candidate solution evaluated, identical for every method in the table' }
            ]
          },
          {
            label: 'Eight methods, 30 cities, 40 000 evaluations, seed 7',
            expr: 'tour length · evaluations used',
            terms: [
              { sym: 'nearest neighbour · 2-opt · or-opt', meaning: '588.75 / 30 · 481.52 / 2 430 · 521.42 / 9 282 — all converged' },
              { sym: 'annealing · tabu', meaning: '486.03 · 489.00, both spending the full budget' },
              { sym: 'genetic · ant colony · GRASP', meaning: '552.96 · 486.03 · 481.52' },
              { sym: 'the bounds', meaning: 'MST 403.41 below, Christofides 499.40 as a guaranteed-ratio reference' }
            ]
          },
          {
            label: 'The ranking against the budget',
            expr: 'winner and best tour at four budgets',
            terms: [
              { sym: '2 000', meaning: '2-opt, 489.02 — local search wins early' },
              { sym: '10 000 and 40 000', meaning: '2-opt, 481.52 — and it has stopped moving' },
              { sym: '160 000', meaning: 'annealing, 481.52 — four methods tied' },
              { sym: 'what this forbids', meaning: 'any claim of the form "method X beats method Y" without a stated budget' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every method is offered the same number of evaluations',
          why: 'An unequal budget is the one defect that makes the comparison meaningless, and it is invisible in the results table.',
          breaks: 'Letting a method finish the sweep it is on when the budget runs out is an overrun with a good excuse.'
        },
        {
          name: 'A candidate move costs one evaluation in every method',
          why: 'Otherwise the budget measures the implementations rather than the search strategies.',
          breaks: 'Charging local search a full tour costing per candidate makes it look n times more expensive than it is.'
        },
        {
          name: 'Every returned tour is a permutation of all the cities',
          why: 'A tour that skips a city is short, and the length column cannot detect it.',
          breaks: 'A crossover operator that produces duplicates, which is exactly what one-point crossover on a permutation does.'
        }
      ],
      complexity: [
        { operation: 'nearest neighbour', average: 'O(n²) distance lookups — 30 evaluations at n = 30', worst: 'typically 20-25% above the best tour found' },
        { operation: '2-opt to a local optimum', average: '2 430 evaluations at n = 30, then it stops', worst: 'no bound; it stops wherever it stops' },
        { operation: 'or-opt to a local optimum', average: '9 282 evaluations, reaching 521.42', worst: 'a different neighbourhood, the same absence of a guarantee' },
        { operation: 'simulated annealing', average: 'spends whatever budget it is given', worst: 'a random walk if the schedule is not derived from the budget' },
        { operation: 'genetic algorithm', average: 'one evaluation per offspring; 30 per generation here', worst: 'weakest in the table at 552.96, and the slowest per evaluation at 24 ms' },
        { operation: 'GRASP', average: 'construction plus local search per restart', worst: 'ties for best at 481.52 with no tuning at all' }
      ],
      failureModes: [
        {
          symptom: 'A published comparison shows the new method winning on every instance.',
          cause: 'The budget was not fixed, or the baseline was a constructive heuristic rather than construction plus local search.',
          fix: 'Fix the evaluation budget, include GRASP or 2-opt-from-greedy, and plot best-so-far rather than reporting a final value.'
        },
        {
          symptom: 'Simulated annealing returns exactly its starting tour.',
          cause: 'The cooling rate was tuned for a much larger budget, so the temperature never fell enough to settle.',
          fix: 'Derive the rate from the budget: cooling = fall^(1/steps) for a chosen final ratio.'
        },
        {
          symptom: 'A genetic algorithm produces invalid solutions and the repair pass dominates the runtime.',
          cause: 'The crossover operator does not respect the representation’s constraint.',
          fix: 'Use an operator designed for the encoding — order crossover for permutations — rather than repairing afterwards.'
        },
        {
          symptom: 'Equal evaluation budgets give wildly unequal wall-clock times.',
          cause: 'An evaluation means different work in different methods: a 2-opt delta is four lookups and an ant tour is O(n²).',
          fix: 'Report both columns. Neither budget is wrong; a comparison that fixes seconds measures the implementations instead.'
        }
      ],
      inTheWild: [
        'Vehicle routing and last-mile delivery, where 2-opt and or-opt inside a metaheuristic frame is the standard industrial approach.',
        'Chip placement and floorplanning, historically the flagship application of simulated annealing.',
        'Timetabling and rostering when the hard-constraint model is feasible but the preferences need an objective.',
        'Hyperparameter search, where the same budget discipline applies and is equally often ignored.'
      ],
      sources: [
        { title: 'Johnson and McGeoch — The traveling salesman problem: a case study in local optimization', note: 'the experimental methodology this section follows' },
        { title: 'Kirkpatrick, Gelatt and Vecchi — Optimization by simulated annealing (1983)', note: 'the original, including the schedule argument' },
        { title: 'Glover — Tabu search', note: 'memory, tenure and the aspiration criterion' },
        { title: 'Feo and Resende — Greedy randomized adaptive search procedures', note: 'GRASP, the control every comparison needs' },
        { title: 'Hooker — Testing heuristics: we have it all wrong (1995)', note: 'the standing indictment of budget-free comparisons' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
