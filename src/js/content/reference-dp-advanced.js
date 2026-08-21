/** Reference entries for the advanced dynamic-programming sections (M12.9-M12.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'dp-optimisations': {
      summary: 'Four ways to stop a DP transition looking at every earlier state — the convex hull trick, ' +
        'Li Chao, divide and conquer optimisation and the monotonic queue — each with the precondition ' +
        'that decides whether it is a speed-up or a fast wrong answer.',
      intuition: 'None of these computes faster. Each looks at fewer candidates, so a false precondition ' +
        'excludes the optimum and returns a worse number, faster, with nothing raised.',
      formulation: {
        equations: [
          {
            label: 'The instance',
            expr: 'dp[j] = min over i of dp[i] + (P[j] − P[i])² + penalty',
            terms: [
              { sym: 'quadratic reference', meaning: '80 200 transitions, value 80 131 at n = 400' },
              { sym: 'the rewriting', meaning: 'dp[j] = P[j]² + c + min over i of ((−2P[i])·P[j] + dp[i] + P[i]²)' }
            ]
          },
          {
            label: 'Convex hull trick',
            expr: 'each earlier state is a line y = m·x + c with m = −2P[i]; the answer is the lower envelope at x = P[j]',
            terms: [
              { sym: 'preconditions', meaning: 'slopes must fall and queries must rise — both need non-decreasing prefix sums' },
              { sym: 'measured', meaning: '783 transitions and 385 lines held, value 80 131 — a factor of 102' },
              { sym: 'violated', meaning: 'one negative value makes the prefix sums fall at index 2, and the solver refuses' }
            ]
          },
          {
            label: 'Divide and conquer optimisation',
            expr: 'if opt(j) is non-decreasing, solving the middle j bounds the split range for both halves',
            terms: [
              { sym: 'cost', meaning: 'O(n log n) per layer instead of O(n²)' },
              { sym: 'measured', meaning: '3 262 transitions against 29 040 for four groups over 120 values' },
              { sym: 'the check', meaning: 'itself quadratic — it belongs in a test, not in the production path' }
            ]
          },
          {
            label: 'Monotonic queue and the aliens trick',
            expr: 'a sliding transition window is a deque; "exactly k" is a Lagrangian penalty search',
            terms: [
              { sym: 'deque', meaning: '400 transitions against 18 775 for a window of 50' },
              { sym: 'aliens', meaning: 'binary-search λ per group; landed at λ ≈ 90 646 for value 453 673' },
              { sym: 'honest failure', meaning: 'the group count can jump over k, and the run must say so' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The optimised value equals the unoptimised value',
          why: 'Every one of these is a narrowing, so the only thing that can go wrong is losing the optimum.',
          breaks: 'A precondition violation gives a larger minimum from fewer candidates, with no error.'
        },
        {
          name: 'A solver refuses rather than answering when its precondition fails',
          why: 'A returned number is indistinguishable from a correct one without a reference.',
          breaks: 'Forcing the guard off produces either an exception, by luck, or a plausible wrong answer.'
        },
        {
          name: '"Exactly k" means exactly k',
          why: 'An answer for k − 1 is a different question, not an approximation.',
          breaks: 'A Lagrangian search that lands beside the target and reports anyway is silently wrong.'
        }
      ],
      complexity: [
        { operation: 'quadratic reference', average: 'Θ(n²) transitions', worst: '80 200 at n = 400' },
        { operation: 'convex hull trick', average: 'amortised Θ(n)', worst: '783 transitions at n = 400 — 102× fewer' },
        { operation: 'Li Chao tree', average: 'Θ(n log range)', worst: 'no ordering preconditions at all' },
        { operation: 'divide and conquer optimisation', average: 'Θ(n log n) per layer', worst: '3 262 transitions against 29 040' },
        { operation: 'monotonic queue', average: 'amortised Θ(n), independent of the window', worst: '400 against 18 775 at width 50' },
        { operation: 'Lagrangian search', average: 'Θ(iterations × cost of one unconstrained solve)', worst: 'may never land on k if the cost is not convex' }
      ],
      failureModes: [
        {
          symptom: 'The optimised DP is faster and returns a slightly worse optimum.',
          cause: 'A precondition is false, so the narrowed candidate set excluded the true argmin.',
          fix: 'Property-test the optimised version against the reference on random instances, on values.'
        },
        {
          symptom: 'The convex hull query pointer walks off the end or returns nonsense.',
          cause: 'Queries arrived out of order, and the pointer is forward-only.',
          fix: 'Assert monotone queries, or use Li Chao, which has no ordering requirement.'
        },
        {
          symptom: 'The hull is enormous and the technique saves nothing.',
          cause: 'Slopes are arriving out of order, so nothing is ever popped as dominated.',
          fix: 'Check the slope order on the actual data; if it is not monotone the hull is the wrong structure.'
        },
        {
          symptom: 'The "exactly k" answer is subtly too good.',
          cause: 'The penalty search landed on k − 1 or k + 1 and reported it as the answer for k.',
          fix: 'Record which λ produced exactly k and return null with a reason when none does.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming libraries', how: 'CHT and Li Chao are standard components; the preconditions are the usual source of wrong answers' },
        { system: 'Time-series segmentation', how: 'optimal piecewise-constant fitting is exactly the squared-cost grouping DP here' },
        { system: 'Speech and handwriting recognition', how: 'monotone alignment costs make divide-and-conquer optimisation applicable' },
        { system: 'Operations research', how: 'Lagrangian relaxation is the same trick applied to constraints far beyond a group count' }
      ],
      sources: [
        { title: 'Efficient dynamic programming using quadrangle inequalities', where: 'F. Frances Yao — STOC 1980' },
        { title: 'Speed-up in dynamic programming', where: 'Aggarwal, Klawe, Moran, Shor and Wilber — SIAM Journal on Algebraic and Discrete Methods, 1987' },
        { title: 'The convex hull trick', where: 'Codeforces and USACO tutorials — the standard practical treatment' },
        { title: 'Integer Programming, chapter on Lagrangian relaxation', where: 'Wolsey — Wiley, 1998' }
      ]
    },

    'game-dp': {
      summary: 'Minimax as a DP over positions, alpha-beta and its total dependence on move ordering, and ' +
        'Sprague-Grundy replacing a product state space with a XOR.',
      intuition: 'Two ways of refusing to build the whole thing: prune what cannot change the answer, and ' +
        'notice that a position is several independent positions side by side.',
      formulation: {
        equations: [
          {
            label: 'Minimax',
            expr: 'v(s) = max over moves of v(s′) at a maximising node, min at a minimising node',
            terms: [
              { sym: 'tic-tac-toe', meaning: '549 946 nodes, 255 168 terminal positions, value 0 — a draw' },
              { sym: 'scoring', meaning: 'from one player’s point of view throughout, so the players are a sign apart' }
            ]
          },
          {
            label: 'Alpha-beta',
            expr: 'maintain [α, β]; when β ≤ α the parent will never choose this branch, so stop',
            terms: [
              { sym: 'no ordering', meaning: '18 297 nodes, 6 930 pruned — 30× against minimax' },
              { sym: 'centre first', meaning: '7 275 nodes, 3 668 pruned — 76×' },
              { sym: 'edges first', meaning: '42 094 nodes — a 5.8× spread within the same algorithm' },
              { sym: 'reversed list', meaning: '18 297 — identical to board order, because the board is symmetric' }
            ]
          },
          {
            label: 'Grundy numbers',
            expr: 'g(s) = mex{g(s′) : s → s′}; s is losing iff g(s) = 0',
            terms: [
              { sym: 'Nim', meaning: 'g(heap) = heap size, so only the empty heap loses' },
              { sym: 'subtraction {1,3,4}', meaning: '0, 1, 0, 1, 2, 3, 2 then period 7' },
              { sym: 'subtraction {1,2}', meaning: '0, 1, 2 repeating — period 3' }
            ]
          },
          {
            label: 'Sprague-Grundy',
            expr: 'g(G₁ + … + Gₙ) = g(G₁) ⊕ … ⊕ g(Gₙ) — exact, not approximate',
            terms: [
              { sym: 'three heaps of 7, Nim', meaning: 'XOR 7 → first player wins; joint search examines 65 states and agrees' },
              { sym: 'three heaps of 7, {1,3,4}', meaning: 'XOR 0 → first player loses; joint search examines 393 states and agrees' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Alpha-beta returns exactly minimax’s value',
          why: 'The pruning is about what is searched, never about what is computed.',
          breaks: 'A window bug prunes a branch it should have searched and returns a plausible value.'
        },
        {
          name: 'The XOR verdict matches the joint state space',
          why: 'Sprague-Grundy is a theorem, so agreement is required rather than expected.',
          breaks: 'A mex computed over the wrong successor set gives a confident and wrong verdict.'
        },
        {
          name: 'Retrograde labels agree with the Grundy zeros',
          why: 'Two different algorithms answering the same question is the cheapest available check.',
          breaks: 'An unresolved-successor counter that is decremented twice mislabels a won position as lost.'
        }
      ],
      complexity: [
        { operation: 'minimax', average: 'Θ(bᵈ)', worst: '549 946 nodes on an empty tic-tac-toe board' },
        { operation: 'alpha-beta, best ordering', average: 'Θ(b^(d/2))', worst: '7 275 nodes with centre-first' },
        { operation: 'alpha-beta, poor ordering', average: 'approaches Θ(bᵈ)', worst: '42 094 nodes with edges-first' },
        { operation: 'Grundy table for one heap', average: 'Θ(limit × moves)', worst: '41 states to heap 40' },
        { operation: 'joint state space of k heaps', average: 'Θ((limit + 1)^k)', worst: '393 states for three heaps of 7 under {1,3,4}' },
        { operation: 'retrograde analysis', average: 'Θ(states + edges)', worst: 'handles cycles, which a forward search cannot' }
      ],
      failureModes: [
        {
          symptom: 'Alpha-beta is fast and returns a different value from minimax.',
          cause: 'The window is being narrowed on the wrong side, or the cutoff test is inclusive where it should not be.',
          fix: 'Assert the value against plain minimax on every fixture; the node count is not the test.'
        },
        {
          symptom: 'A move-ordering heuristic appears to make no difference.',
          cause: 'It was tested by reversing the move list on a symmetric position, which prunes identically.',
          fix: 'Rank moves by quality and compare against the reverse ranking, not against the reversed array.'
        },
        {
          symptom: 'A game solver recurses forever.',
          cause: 'Positions can repeat, so the position graph has cycles and a forward memoised search has no base case.',
          fix: 'Use retrograde analysis, which propagates backwards and labels the unresolved states as draws.'
        },
        {
          symptom: 'The Grundy value of a sum disagrees with a direct search.',
          cause: 'The components are not actually independent, so the theorem does not apply.',
          fix: 'Check that a move in one component cannot change any other; that is the theorem’s precondition.'
        }
      ],
      inTheWild: [
        { system: 'Chess and Go engines', how: 'alpha-beta with killer moves, history heuristics and iterative deepening — all move ordering' },
        { system: 'Endgame tablebases', how: 'retrograde analysis from mate positions backwards, exactly as here' },
        { system: 'Auction and negotiation models', how: 'minimax over strategy trees with the same alternating recurrence' },
        { system: 'Puzzle solvers', how: 'Grundy decomposition wherever a position separates into independent regions' }
      ],
      sources: [
        { title: 'Winning Ways for Your Mathematical Plays', where: 'Berlekamp, Conway and Guy — the Grundy theory' },
        { title: 'An analysis of alpha-beta pruning', where: 'Donald Knuth and Ronald Moore — Artificial Intelligence, 1975' },
        { title: 'Nim, a game with a complete mathematical theory', where: 'C. L. Bouton — Annals of Mathematics, 1901' },
        { title: 'Artificial Intelligence: A Modern Approach, chapter 5', where: 'Russell and Norvig — adversarial search' }
      ]
    },

    'expectation-dp': {
      summary: 'Expected-value recurrences, the moment a cycle turns one into a linear system, and the ' +
        'three independent checks — a recursion, an elimination and a simulation — that each see something ' +
        'the others cannot.',
      intuition: 'Run a topological sort first. If it fails you do not have a DP, you have a system of ' +
        'equations that happens to be written recursively.',
      formulation: {
        equations: [
          {
            label: 'The recurrence',
            expr: 'E[s] = cost(s) + Σ p(s→t)·E[t], with E[absorbing] = 0',
            terms: [
              { sym: 'acyclic', meaning: 'evaluate in reverse topological order — an ordinary DP' },
              { sym: 'cyclic', meaning: 'no topological order exists, and the recursion has no base case in that direction' }
            ]
          },
          {
            label: 'As a linear system',
            expr: 'E[s] − Σ p(s→t)·E[t] = cost(s) — one row per transient state',
            terms: [
              { sym: '20-square board', meaning: '20 equations, 20 pivot operations, E[0] = 10.476469' },
              { sym: 'with two snakes', meaning: 'E[0] = 13.850548 by the same method' },
              { sym: 'pivoting', meaning: 'required — a state with no self-loop puts a zero on the diagonal' }
            ]
          },
          {
            label: 'The cycle is in the rules',
            expr: 'p(s→s) > 0 whenever a roll would overshoot the end',
            terms: [
              { sym: 'squares 15–19', meaning: 'each names itself, so a d6 board of 20 is cyclic before any snake' },
              { sym: 'detection', meaning: 'topologicalOrder returns null, and the solver picks elimination itself' }
            ]
          },
          {
            label: 'Monte Carlo',
            expr: 'half-width = 1.96·√(variance / trials) — the interval narrows as 1/√trials',
            terms: [
              { sym: '40 000 trials', meaning: '13.862425 ± 0.078203, an interval of width 0.156' },
              { sym: 'what it checks', meaning: 'the model, not the arithmetic — a wrong table gives an exact wrong answer' },
              { sym: 'the control', meaning: 'a forward chain where both methods run agrees to nine decimal places' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every transient row of probabilities sums to one',
          why: 'A chain whose rows do not sum to one is not a chain, and the solver will not notice.',
          breaks: 'A missing overshoot case leaves a row at 5/6 and still produces a plausible expectation.'
        },
        {
          name: 'The recursion and the elimination agree on acyclic chains',
          why: 'It is the only place the elimination can be checked against something exact.',
          breaks: 'Without the control, the linear solver is verified only by a simulation far too noisy to certify it.'
        },
        {
          name: 'The exact answer lies inside the simulation’s stated interval',
          why: 'Agreement between a number and a random variable has to be a claim with a confidence attached.',
          breaks: '"The two look similar" is not a check; the interval is 1.1% wide at 40 000 trials.'
        }
      ],
      complexity: [
        { operation: 'acyclic expectation', average: 'Θ(states + transitions)', worst: 'one reverse topological sweep' },
        { operation: 'Gaussian elimination', average: 'Θ(n³) in the transient states', worst: '20 pivots for a 20-square board' },
        { operation: 'cycle detection', average: 'Θ(states + transitions)', worst: 'one Kahn sweep, run before choosing a method' },
        { operation: 'Monte Carlo', average: 'Θ(trials × expected path length)', worst: 'interval width falls only as 1/√trials' },
        { operation: 'secretary sweep', average: 'Θ(n²) over all thresholds', worst: 'exact formula, so no simulation needed' }
      ],
      failureModes: [
        {
          symptom: 'The memoised expectation never returns, or returns different answers on different runs.',
          cause: 'The chain has a cycle, so the recursion has no base case and reads half-filled memo entries.',
          fix: 'Topologically sort first; on failure build the linear system instead.'
        },
        {
          symptom: 'The solution is a table of NaNs.',
          cause: 'Elimination without partial pivoting divided by a zero on the diagonal.',
          fix: 'Pivot on the largest absolute value in the column before eliminating.'
        },
        {
          symptom: 'The exact answer and the simulation disagree by a few percent.',
          cause: 'Either the interval is wider than it looks, or the transition table does not describe the game.',
          fix: 'Report the interval, raise the trial count, and re-read the transitions — the model is the usual culprit.'
        },
        {
          symptom: 'The expectation is confidently wrong and internally consistent.',
          cause: 'A transition row that does not sum to one, which the solver happily solves.',
          fix: 'Check the row sums as a reported field before solving anything.'
        }
      ],
      inTheWild: [
        { system: 'Reliability and retry modelling', how: 'expected attempts under retry-on-failure is a self-loop, so a linear system' },
        { system: 'Queueing and capacity planning', how: 'absorbing-chain hitting times underlie M/M/1 and its relatives, revisited in M58' },
        { system: 'Game balance', how: 'expected turn counts for board and card games, exactly the chain here' },
        { system: 'PageRank and random walks', how: 'the same linear-algebra reformulation, solved iteratively at web scale' }
      ],
      sources: [
        { title: 'Finite Markov Chains', where: 'Kemeny and Snell — absorbing chains and hitting times' },
        { title: 'Introduction to Probability Models', where: 'Sheldon Ross — expectation recurrences and optimal stopping' },
        { title: 'Who solved the secretary problem?', where: 'Thomas Ferguson — Statistical Science, 1989' },
        { title: 'Numerical Linear Algebra', where: 'Trefethen and Bau — why partial pivoting is not optional' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
