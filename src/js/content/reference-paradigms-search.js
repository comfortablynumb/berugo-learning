/** Reference entries for the structured-search paradigm sections (M11.4-M11.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    matroids: {
      summary: 'The structure that decides in advance whether greedy is right, the checker that produces a ' +
        'witness when it is not, and the generic greedy algorithm that becomes Kruskal by changing an oracle.',
      intuition: 'If the feasible sets form a matroid, greedy is optimal for every weighting and needs no ' +
        'proof. If they do not, some weighting defeats it — so the question has a definite answer.',
      formulation: {
        equations: [
          {
            label: 'The definition',
            expr: '(E, I) with ∅ ∈ I; A ⊆ B ∈ I ⇒ A ∈ I; and |A| < |B| ⇒ ∃x ∈ B \\ A with A ∪ {x} ∈ I',
            terms: [
              { sym: 'hereditary', meaning: 'the first two conditions — almost every feasibility notion satisfies them' },
              { sym: 'exchange', meaning: 'the third — this is the one that fails, and the one that matters' }
            ]
          },
          {
            label: 'Rado-Edmonds',
            expr: 'greedy is optimal for every weight function ⇔ (E, I) is a matroid',
            terms: [
              { sym: 'forward', meaning: 'a matroid needs no algorithm-specific proof' },
              { sym: 'contrapositive', meaning: 'a non-matroid has a defeating weighting, so greedy is a bug rather than an approximation' }
            ]
          },
          {
            label: 'The checker\'s cost',
            expr: '2^|E| oracle calls to enumerate, then a pairwise search over the independent sets',
            terms: [
              { sym: '8 elements', meaning: '256 oracle calls, 62 independent sets on the graphic instance' },
              { sym: 'the point', meaning: 'a one-off check on a small model, not a subroutine' }
            ]
          },
          {
            label: 'Matchings are not a matroid',
            expr: 'on a path of three edges, {middle} cannot be extended from {first, last}',
            terms: [
              { sym: 'the weighting', meaning: '2, 3, 2 — greedy takes 3 and finishes at 3' },
              { sym: 'the optimum', meaning: '2 + 2 = 4, so greedy returns 75%' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every maximal independent set has the same size',
          why: 'It follows from the exchange property and is the cheapest way to spot a non-matroid by hand.',
          breaks: 'Greedy\'s answer depends on the order it happened to consider elements in.'
        },
        {
          name: 'The oracle is consistent: the same set always gets the same verdict',
          why: 'The enumeration and the greedy pass both call it, and a stateful oracle makes them disagree.',
          breaks: 'The checker reports a matroid and the algorithm behaves as though it is not.'
        },
        {
          name: 'The witness is a genuine pair of independent sets',
          why: 'A checker that reports "not a matroid" without exhibiting the failure cannot be acted on.',
          breaks: 'A design discussion that stalls on whether the tool is right.'
        }
      ],
      complexity: [
        { operation: 'generic greedy over an oracle', average: '|E| log |E| to sort plus |E| oracle calls', worst: 'identical; the oracle cost dominates' },
        { operation: 'Kruskal with union-find', average: 'O(E log E), the oracle answered in near-constant time', worst: 'O(E log E)' },
        { operation: 'matroid check by enumeration', average: 'Θ(2^n) oracle calls plus a pairwise scan', worst: '256 calls at n = 8, which is the intended scale' },
        { operation: 'matroid intersection (two matroids)', average: 'polynomial, by augmenting paths', worst: 'polynomial — but not by greedy' },
        { operation: 'three-matroid intersection', average: '—', worst: 'NP-hard' }
      ],
      failureModes: [
        {
          symptom: 'A greedy selection is optimal in testing and sub-optimal on one customer\'s data.',
          cause: 'The feasible sets are not a matroid and the test data never hit a defeating weighting.',
          fix: 'Model the structure on ten elements and run the exchange check; keep the witness as a test.'
        },
        {
          symptom: 'The greedy result depends on the order the input arrived in.',
          cause: 'Maximal independent sets of different sizes — the exchange property is failing.',
          fix: 'That is the check; the differing sizes are the witness.'
        },
        {
          symptom: 'Adding a second constraint broke a previously optimal greedy selection.',
          cause: 'The intersection of two matroids is not a matroid.',
          fix: 'Move to a matroid-intersection algorithm, or to flow; do not patch the greedy rule.'
        },
        {
          symptom: 'The checker is too slow to run.',
          cause: 'It is being applied to the real ground set rather than to a model of it.',
          fix: 'Shrink to eight or ten representative elements; the structural question does not need scale.'
        }
      ],
      inTheWild: [
        { system: 'Kruskal\'s algorithm', how: 'greedy over the graphic matroid — the canonical instance of the theorem' },
        { system: 'Scheduling unit jobs with deadlines and penalties', how: 'the feasible sets form a matroid, so greedy by penalty is optimal' },
        { system: 'Ad and content selection with per-category quotas', how: 'a partition matroid, which is why sort-and-take is provably right there' },
        { system: 'Bipartite matching', how: 'the intersection of two partition matroids — polynomial, and not by greedy' }
      ],
      sources: [
        { title: 'Matroids and the greedy algorithm', where: 'Jack Edmonds — Mathematical Programming, 1971' },
        { title: 'Note on independence functions', where: 'Richard Rado — Proceedings of the London Mathematical Society, 1957' },
        { title: 'Combinatorial Optimization: Polyhedra and Efficiency, part IV', where: 'Alexander Schrijver — matroids and submodularity' },
        { title: 'Introduction to Algorithms, chapter 16.4', where: 'Cormen, Leiserson, Rivest, Stein — matroids and greedy methods' }
      ]
    },

    backtracking: {
      summary: 'Choose, explore, unchoose — with the undo as the correctness risk, and the variable-ordering ' +
        'and propagation heuristics priced in nodes removed on the same instance.',
      intuition: 'Backtracking reuses one mutable state instead of building a new one per node. That is why ' +
        'it is fast, and why a forgotten restore is the characteristic bug.',
      formulation: {
        equations: [
          {
            label: 'The template',
            expr: 'for each value v of x: assign(x, v); if consistent then recurse; unassign(x, v)',
            terms: [
              { sym: 'the discipline', meaning: 'the undo consumes a record produced by the do, never a recomputation' },
              { sym: 'the failure', meaning: 'a missed restore removes or invents solutions with no diagnostic' }
            ]
          },
          {
            label: 'Heuristics priced on Inkala\'s puzzle',
            expr: 'nodes visited, same solver, 500 000-node budget',
            terms: [
              { sym: 'first empty cell', meaning: '49 559 nodes' },
              { sym: 'MRV', meaning: '10 102 — a factor of 4.9' },
              { sym: '+ forward checking', meaning: '9 180 — a further 1.10' },
              { sym: '+ propagation', meaning: '929, with 9 089 cells forced without a guess' }
            ]
          },
          {
            label: 'The instance where the heuristic loses',
            expr: '"platinum blonde", 17 clues, 500 000-node budget',
            terms: [
              { sym: 'first empty cell', meaning: '419 195 nodes — it finishes' },
              { sym: 'MRV and everything above it', meaning: 'budget exhausted' },
              { sym: 'anti-brute-force puzzle', meaning: 'exactly the reverse — naive exhausts, MRV needs 45 268' }
            ]
          },
          {
            label: 'Iterative deepening',
            expr: 'Σ b^d over d = 0..D ≈ b^D · b/(b−1)',
            terms: [
              { sym: 'b = 3', meaning: 'about 50% overhead, for a frontier of O(D) instead of O(b^D)' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The state after unchoose equals the state before choose',
          why: 'Every subsequent branch is explored against it, and nothing checks it.',
          breaks: 'Solutions disappear or duplicate depending on the path taken to reach them.'
        },
        {
          name: 'Every value in a domain is genuinely still possible',
          why: 'MRV and forward checking both read the domains and both trust them.',
          breaks: 'The search branches on a value that cannot work, or prunes one that can.'
        },
        {
          name: 'Propagation records everything it filled',
          why: 'Those assignments were not chosen, so nothing else knows to undo them.',
          breaks: 'The grid keeps deductions from a branch that was abandoned.'
        }
      ],
      complexity: [
        { operation: 'plain backtracking', average: 'exponential; instance-dependent by orders of magnitude', worst: 'O(d^n) for n variables of domain size d' },
        { operation: 'MRV variable ordering', average: 'large constant-factor reduction on most instances', worst: 'can be worse — "platinum blonde" is the example' },
        { operation: 'forward checking', average: 'one O(n) scan per node', worst: 'worth about 10% here; it is the floor under propagation' },
        { operation: 'constraint propagation', average: 'O(n) sweeps to a fixed point per node', worst: 'an order of magnitude fewer nodes at several times the work each' },
        { operation: 'iterative deepening', average: 'b/(b−1) times the deepest level', worst: 'O(depth) memory instead of O(b^depth)' }
      ],
      failureModes: [
        {
          symptom: 'The solver finds a different number of solutions depending on the order of the input.',
          cause: 'An incomplete undo — some state survives the backtrack.',
          fix: 'Make the undo replay a recorded list; assert the state hash matches before and after.'
        },
        {
          symptom: 'A heuristic that always helped makes one instance hang.',
          cause: 'The heuristic is a bet about the instance distribution, and this instance is the exception.',
          fix: 'Run a portfolio with a timeout and restart, rather than committing to one ordering.'
        },
        {
          symptom: 'Propagation made it slower.',
          cause: 'It fires rarely on these instances, so it is overhead at every node.',
          fix: 'Measure nodes and time separately; the node reduction has to pay for the per-node cost.'
        },
        {
          symptom: 'The search finds every solution k! times.',
          cause: 'Interchangeable values or variables, with no symmetry breaking.',
          fix: 'Impose an arbitrary order on the interchangeable elements — usually a factorial saving.'
        }
      ],
      inTheWild: [
        { system: 'MiniSat, Z3 and modern SAT solvers', how: 'backtracking with clause learning, restarts and activity-based variable ordering' },
        { system: 'Sudoku and puzzle solvers', how: 'MRV plus propagation, exactly as measured here' },
        { system: 'Register allocation and instruction scheduling', how: 'backtracking over colourings with spill costs as the ordering heuristic' },
        { system: 'Regex engines with backreferences', how: 'the same search, and the source of catastrophic-backtracking incidents' }
      ],
      sources: [
        { title: 'Artificial Intelligence: A Modern Approach, chapter 6', where: 'Russell and Norvig — constraint satisfaction, MRV, forward checking, AC-3' },
        { title: 'Solving Every Sudoku Puzzle', where: 'Peter Norvig — 2006' },
        { title: 'Networks of constraints: fundamental properties and applications', where: 'Ugo Montanari — Information Sciences, 1974' },
        { title: 'The Art of Computer Programming, Volume 4B, 7.2.2', where: 'Donald Knuth — backtrack programming and dancing links' }
      ]
    },

    'branch-and-bound': {
      summary: 'Backtracking for optimisation: an incumbent, a bound that may overestimate and never ' +
        'underestimate, and the measurement that a tighter bound is worth more than any traversal tuning.',
      intuition: 'The bound is the algorithm. Everything else — the traversal, the data structures, the ' +
        'micro-optimisations — moves the node count by a constant; the bound moves it by orders of magnitude.',
      formulation: {
        equations: [
          {
            label: 'The pruning rule',
            expr: 'skip the subtree at s when bound(s) <= incumbent (for maximisation)',
            terms: [
              { sym: 'admissible', meaning: 'bound(s) >= the best value of any completion of s' },
              { sym: 'the asymmetry', meaning: 'over-estimating costs time; under-estimating discards the optimum' }
            ]
          },
          {
            label: 'Two admissible bounds, one instance',
            expr: '22 items, capacity 164, optimum 658',
            terms: [
              { sym: 'best remaining density', meaning: '282 nodes, 129 subtrees pruned' },
              { sym: 'fractional relaxation', meaning: '70 nodes, 23 subtrees pruned — 4.0× tighter in nodes' },
              { sym: 'exhaustive search', meaning: '4 194 304 subsets, the oracle' }
            ]
          },
          {
            label: 'An inadmissible bound',
            expr: '0.9 × the fractional relaxation',
            terms: [
              { sym: 'nodes', meaning: '40 — fewer than either correct bound' },
              { sym: 'answer', meaning: '640 where the optimum is 658, with no signal of any kind' }
            ]
          },
          {
            label: 'The TSP bound',
            expr: 'travelled + Σ over unvisited cities of the cheapest edge leaving it',
            terms: [
              { sym: '9 cities', meaning: '2 502 nodes with the bound, 109 601 without' },
              { sym: 'both', meaning: 'the same 226.019-long tour' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The bound never underestimates a subtree\'s best completion',
          why: 'It is the only condition that makes pruning sound.',
          breaks: 'The optimum is discarded and a smaller value is returned as though it were optimal.'
        },
        {
          name: 'The incumbent only ever improves',
          why: 'It is a lower bound on the optimum and the pruning threshold.',
          breaks: 'Subtrees are pruned against a value that is not achievable, discarding real solutions.'
        },
        {
          name: 'A returned solution is feasible',
          why: 'The bound is computed on partial states, where feasibility is not yet decided.',
          breaks: 'A high-value answer that violates the capacity, which the value alone will not reveal.'
        }
      ],
      complexity: [
        { operation: '0/1 knapsack, exhaustive', average: 'Θ(2^n)', worst: '4 194 304 at n = 22' },
        { operation: '0/1 knapsack, fractional bound', average: 'instance-dependent; 70 nodes here', worst: 'Θ(2^n) — the bound removes a constant fraction of an exponential' },
        { operation: 'fractional bound evaluation', average: 'O(n) per node, or O(1) incrementally', worst: 'the dominant per-node cost, and worth it' },
        { operation: 'TSP with the cheapest-edge bound', average: '2 502 nodes at 9 cities', worst: 'Θ(n!) — the bound buys cities, not a class' },
        { operation: 'best-first search', average: 'node-optimal for a given bound', worst: 'exponential memory in the open list' }
      ],
      failureModes: [
        {
          symptom: 'The optimiser is fast and its answers are slightly worse than a competitor\'s.',
          cause: 'An inadmissible bound discarding subtrees that contained better solutions.',
          fix: 'Compare against exhaustive search on instances up to about twenty items; one disagreement is enough.'
        },
        {
          symptom: 'The search explores almost every node despite having a bound.',
          cause: 'The incumbent arrives late, so there is nothing to prune against for most of the run.',
          fix: 'Order the children greedily, or seed the incumbent with a heuristic solution first.'
        },
        {
          symptom: 'Best-first search runs out of memory.',
          cause: 'The open list holds an exponential number of partial solutions.',
          fix: 'Use depth-first with a bound, or a hybrid that dives depth-first from the best open node.'
        },
        {
          symptom: 'The solver reports optimality but the gap was never zero.',
          cause: 'Confusing "no better solution found" with "no better solution exists".',
          fix: 'Report the incumbent and the gap; optimality is the gap reaching zero, not the search ending.'
        }
      ],
      inTheWild: [
        { system: 'CPLEX, Gurobi, CBC', how: 'branch and bound over LP relaxations, with cuts — the industrial form of this section' },
        { system: 'Concorde TSP solver', how: 'branch and cut with held-Karp bounds; the bound is the whole research programme' },
        { system: 'Compiler and scheduler search', how: 'bounded search over instruction orderings with a cost-model bound' },
        { system: 'Game search (alpha-beta)', how: 'the same idea on a minimax tree, with the window as the bound' }
      ],
      sources: [
        { title: 'An automatic method of solving discrete programming problems', where: 'Land and Doig — Econometrica, 1960' },
        { title: 'Branch-and-bound methods: a survey', where: 'Lawler and Wood — Operations Research, 1966' },
        { title: 'Computing partitions with applications to the knapsack problem', where: 'Horowitz and Sahni — JACM, 1974' },
        { title: 'Integer Programming', where: 'Laurence Wolsey — Wiley, 2nd ed. 2020' }
      ]
    }
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
