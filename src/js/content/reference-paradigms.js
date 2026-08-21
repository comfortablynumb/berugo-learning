/** Reference entries for the first three paradigm sections (M11.1-M11.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'exhaustive-search': {
      summary: 'The state space as a tree, the prunings that refuse to build most of it, and the discipline ' +
        'of measuring each pruning against a control rather than against the last version.',
      intuition: 'Writing the search is five minutes. Everything after that is arguing that particular ' +
        'subtrees contain no solution, and each argument has to be true rather than plausible.',
      formulation: {
        equations: [
          {
            label: 'The tree',
            expr: '(root, successors, isGoal, isFeasible); a node is a partial assignment and its subtree every completion',
            terms: [
              { sym: 'admissible pruning', meaning: 'isFeasible(s) false implies no completion of s is a goal' },
              { sym: 'the check', meaning: 'the solution count must not change when a pruning is added' }
            ]
          },
          {
            label: 'Moving a check earlier',
            expr: 'a test at depth k rather than depth n removes b^(n−k) descendants per rejection',
            terms: [
              { sym: 'n = 8 queens', meaning: '109 601 nodes at the leaf, 2 057 at the placement — 53.3×' },
              { sym: 'n = 10 queens', meaning: '9 864 101 against 35 539 — 277.6×, with 724 solutions from both' }
            ]
          },
          {
            label: 'Prunings multiply',
            expr: 'for independent prunings the surviving fraction is the product of the fractions',
            terms: [
              { sym: 'early diagonal', meaning: '1.88% of the control at n = 8' },
              { sym: 'symmetry breaking', meaning: '50.00%' },
              { sym: 'both', meaning: '0.9389% measured against a predicted 0.9384% — equal at two decimal places, not exactly' }
            ]
          },
          {
            label: 'Ordering is not pruning',
            expr: 'a permutation of the successors preserves the explored set of an exhaustive search',
            terms: [
              { sym: 'all solutions', meaning: '2 057 nodes with or without most-constrained-first' },
              { sym: 'first solution', meaning: '114 nodes without it, 9 with it' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The solution count is the same under every pruning',
          why: 'It is the only observable that distinguishes a pruning from a bug.',
          breaks: 'A count that drops from 92 to 88 looks exactly like a pruning that worked.'
        },
        {
          name: 'A pruning predicate is monotone in the partial state',
          why: 'What is infeasible now must stay infeasible in every extension, or the subtree is wrongly cut.',
          breaks: 'Solutions vanish on some inputs and not others, with no error anywhere.'
        },
        {
          name: 'An exhausted node budget is reported, not rounded off',
          why: 'The true count is larger and unknown, so a ratio against it is meaningless.',
          breaks: 'A comparison table silently mixes bounds with measurements.'
        }
      ],
      complexity: [
        { operation: 'n-queens, diagonal test at the leaf', average: 'Θ(n!) leaves, all tested', worst: '109 601 nodes at n = 8' },
        { operation: 'n-queens, test at placement', average: 'far below n! — 2 057 at n = 8', worst: 'still exponential; the constant is what moved' },
        { operation: 'symmetry breaking on the first row', average: 'exactly half the nodes', worst: 'half, and the solution count is recovered by mirroring' },
        { operation: 'most-constrained-first ordering', average: 'no change for an exhaustive search', worst: 'decisive when the search may stop early' }
      ],
      failureModes: [
        {
          symptom: 'The search got much faster and the answer changed slightly.',
          cause: 'A pruning that is not admissible — it cuts subtrees that do contain solutions.',
          fix: 'Assert the solution count against the unpruned run on small instances, every time.'
        },
        {
          symptom: 'An ordering heuristic was added and nothing improved.',
          cause: 'The search is exhaustive, so a permutation of the children changes nothing.',
          fix: 'Measure with the real stopping condition; orderings pay only when the search can stop.'
        },
        {
          symptom: 'The solver is fine on n = 8 and hopeless at n = 12.',
          cause: 'The prunings remove a constant fraction, and the tree still grows exponentially.',
          fix: 'Expect a change of constant, not of class; move to branch and bound or to a different formulation.'
        },
        {
          symptom: 'A comparison table shows a suspiciously round node count.',
          cause: 'That run hit its budget and the number is the budget.',
          fix: 'Mark exhausted runs and compute no ratios against them.'
        }
      ],
      inTheWild: [
        { system: 'SAT and CP solvers', how: 'the same shape with clause learning and restarts on top of the pruning' },
        { system: 'Regular-expression backtracking engines', how: 'exponential blow-up on nested quantifiers is this tree with no pruning' },
        { system: 'Puzzle and layout generators', how: 'symmetry breaking is what makes exhaustive generation feasible at all' },
        { system: 'Compiler instruction selection', how: 'exhaustive tiling of small trees with cost-based feasibility cuts' }
      ],
      sources: [
        { title: 'Artificial Intelligence: A Modern Approach, chapters 3 and 6', where: 'Russell and Norvig — search and constraint satisfaction' },
        { title: 'The Art of Computer Programming, Volume 4B, 7.2.2', where: 'Donald Knuth — backtrack programming' },
        { title: 'Dancing Links', where: 'Donald Knuth — Millennial Perspectives in Computer Science, 2000' },
        { title: 'Symmetry breaking in constraint programming', where: 'Gent and Smith — ECAI 2000' }
      ]
    },

    'divide-and-conquer': {
      summary: 'Split, solve, combine — with the combine step doing the work, and the crossover between the ' +
        'asymptotically better algorithm and the simpler one measured rather than remembered.',
      intuition: 'Every algorithm in this family splits its input trivially. Read the combine step first: ' +
        'that is the part that had to be invented, and the part that decides the recurrence.',
      formulation: {
        equations: [
          {
            label: 'The master theorem',
            expr: 'T(n) = a·T(n/b) + f(n); compare f(n) with n^log_b(a)',
            terms: [
              { sym: 'merge sort', meaning: 'a = 2, b = 2, f = n → n log n' },
              { sym: 'Karatsuba', meaning: 'a = 3, b = 2, f = n → n^log₂3 ≈ n^1.585' },
              { sym: 'Strassen', meaning: 'a = 7, b = 2, f = n² → n^log₂7 ≈ n^2.807' }
            ]
          },
          {
            label: 'Karatsuba\'s identity',
            expr: 'ad + bc = (a + b)(c + d) − ac − bd, so three products suffice',
            terms: [
              { sym: 'measured at 1 024 digits', meaning: '1 048 576 schoolbook against 100 273 — a factor of 10.46' },
              { sym: 'against the model', meaning: '1.70× the idealised n^1.585 at 128, 512 and 1 024 digits' },
              { sym: 'at 4 digits', meaning: '16 against 17 — the ratio is 0.94 and Karatsuba loses' }
            ]
          },
          {
            label: 'Closest pair',
            expr: 'T(n) = 2T(n/2) + O(n) with the strip merged rather than re-sorted',
            terms: [
              { sym: '2 000 points', meaning: '2 314 distance checks against a brute force of 1 999 000' },
              { sym: 'the strip bound', meaning: 'at most 7 successors per point; the measured maximum is 2' }
            ]
          },
          {
            label: 'Strassen\'s numerical price',
            expr: 'the block additions cancel, so the error bound involves the matrix norms, not the entries',
            terms: [
              { sym: 'side 64', meaning: 'relative entrywise disagreement 1.29 × 10⁻¹⁴' },
              { sym: 'side 128', meaning: '3.40 × 10⁻¹⁴ — small, non-zero, and growing with the depth' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The subproblems are disjoint and their union is the whole',
          why: 'Overlapping subproblems make this dynamic programming, with a different cost model.',
          breaks: 'Exponential recomputation that looks like a divide-and-conquer recursion.'
        },
        {
          name: 'The combine step sees everything a crossing solution needs',
          why: 'A pair, an inversion or a product term that spans the split must be visible at the join.',
          breaks: 'A plausible answer that is systematically too small — the crossing cases are simply missed.'
        },
        {
          name: 'The recursion has a base case reached by every path',
          why: 'Uneven splits and empty halves are where the infinite recursions live.',
          breaks: 'A stack overflow on inputs with a particular parity or a repeated element.'
        }
      ],
      complexity: [
        { operation: 'schoolbook multiplication', average: 'n² digit products', worst: 'identical — no input shape matters' },
        { operation: 'Karatsuba', average: 'Θ(n^1.585) products; measured 1.70× the model', worst: 'identical; worse than schoolbook below the threshold' },
        { operation: 'Strassen', average: 'Θ(n^2.807) scalar products', worst: 'identical; needs Θ(n²) extra memory and loses componentwise stability' },
        { operation: 'closest pair', average: 'O(n log n) with a merged strip', worst: 'O(n log² n) if the strip is re-sorted each level' },
        { operation: 'counting inversions', average: 'O(n log n) comparisons', worst: '19 447 for 2 000 values against 1 999 000' }
      ],
      failureModes: [
        {
          symptom: 'The asymptotically better algorithm is slower on real inputs.',
          cause: 'Every real input is below the crossover.',
          fix: 'Measure the crossover and add a threshold; that is what every bignum and BLAS library does.'
        },
        {
          symptom: 'Closest pair returns a pair that is not closest, occasionally.',
          cause: 'The strip is built or bounded wrongly, so a crossing pair is missed.',
          fix: 'Check against the quadratic scan on randomised inputs, including clustered and collinear ones.'
        },
        {
          symptom: 'A matrix product disagrees with the reference in the last digits.',
          cause: 'Strassen\'s cancellation — this is expected, not a bug.',
          fix: 'Decide whether the application can absorb it; measure the relative error rather than assuming.'
        },
        {
          symptom: 'The recursion is O(n log² n) where the paper says O(n log n).',
          cause: 'Re-sorting inside the recursion instead of merging what the children return.',
          fix: 'Return the sorted order from each subproblem and merge it at the join.'
        }
      ],
      inTheWild: [
        { system: 'GMP, Java BigInteger, Python int', how: 'schoolbook, then Karatsuba, then Toom-Cook, then FFT, each behind a measured threshold' },
        { system: 'BLAS and LAPACK implementations', how: 'Strassen appears in some libraries above a size threshold, with the stability caveat documented' },
        { system: 'git merge-base and diff', how: 'divide and conquer over the edit graph, with the combine step doing the work' },
        { system: 'Competitive geometry libraries', how: 'closest pair, and the same sweep shape for segment intersection' }
      ],
      sources: [
        { title: 'Multiplication of many-digital numbers by automatic computers', where: 'Karatsuba and Ofman — Doklady Akademii Nauk SSSR, 1962' },
        { title: 'Gaussian elimination is not optimal', where: 'Volker Strassen — Numerische Mathematik, 1969' },
        { title: 'Accuracy and Stability of Numerical Algorithms, chapter 23', where: 'Nicholas Higham — the Strassen error analysis' },
        { title: 'Introduction to Algorithms, chapters 4 and 33', where: 'Cormen, Leiserson, Rivest, Stein — recurrences and closest pair' }
      ]
    },

    'greedy-algorithms': {
      summary: 'The greedy-choice property, the two standard proofs that certify it, and the fact that a ' +
        'wrong greedy rule returns a valid answer with nothing to indicate it.',
      intuition: 'Greedy is short, fast and unverified by default. The question is never "does it work on my ' +
        'examples" but "what is the argument", and the absence of an argument is the finding.',
      formulation: {
        equations: [
          {
            label: 'The two preconditions',
            expr: 'greedy-choice property + optimal substructure',
            terms: [
              { sym: 'greedy choice', meaning: 'some optimal solution contains the first greedy choice' },
              { sym: 'substructure', meaning: 'the rest of that solution is optimal for the reduced problem' }
            ]
          },
          {
            label: 'Staying ahead, for interval scheduling',
            expr: 'for every k, greedy\'s k-th interval finishes no later than any rival\'s k-th',
            terms: [
              { sym: 'measured', meaning: 'k = 1..5 ends of 5, 10, 11, 15, 18 against a rival optimum\'s 5, 10, 11, 15, 20' },
              { sym: 'consequence', meaning: 'greedy never runs out of timeline first, so it is never smaller' }
            ]
          },
          {
            label: 'How hard the counter-example is to find',
            expr: 'the number of random instances searched before the first disagreement with the oracle',
            terms: [
              { sym: 'earliest start', meaning: '5 instances, 4 intervals — 1 against 2' },
              { sym: 'shortest duration', meaning: '554 instances, 4 intervals — 1 against 2' },
              { sym: 'fewest conflicts', meaning: '94 996 instances, 9 intervals — 3 against 4' },
              { sym: 'earliest finish', meaning: 'none in 200 000, and it has a proof' }
            ]
          },
          {
            label: 'Canonical coin systems',
            expr: 'a non-canonical system has a counter-example below the sum of the two largest coins',
            terms: [
              { sym: '1, 5, 10, 25', meaning: 'canonical — checked exhaustively to 35' },
              { sym: '1, 3, 4', meaning: 'fails at 6: greedy 3 coins, optimum 2' },
              { sym: '1, 15, 25', meaning: 'fails at 30: greedy 6 coins, optimum 2' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The greedy prefix extends to an optimal solution',
          why: 'It is the induction hypothesis of both standard proofs.',
          breaks: 'The algorithm returns a feasible, sub-optimal answer and nothing detects it.'
        },
        {
          name: 'The comparison used to rank candidates is a total preorder',
          why: 'Ties broken inconsistently make the result depend on input order rather than on the instance.',
          breaks: 'Two runs on the same multiset return different answers.'
        },
        {
          name: 'The oracle used in tests is exact, not another heuristic',
          why: 'Two heuristics agreeing is not evidence about either of them.',
          breaks: 'A test suite that certifies both a wrong criterion and its wrong reference.'
        }
      ],
      complexity: [
        { operation: 'interval scheduling, earliest finish', average: 'O(n log n) to sort, O(n) to select', worst: 'identical, and provably optimal' },
        { operation: 'fractional knapsack', average: 'O(n log n) by density', worst: 'identical, and optimal' },
        { operation: '0/1 knapsack by the same rule', average: 'O(n log n)', worst: 'not optimal — 240 against a true 220 on the reference instance' },
        { operation: 'greedy change-making', average: 'O(k) for k denominations', worst: 'not optimal for non-canonical systems' },
        { operation: 'canonicity check', average: 'O(limit · k) with limit = sum of the two largest coins', worst: 'exact and terminating' }
      ],
      failureModes: [
        {
          symptom: 'The results are slightly worse than a competitor\'s and nobody can say why.',
          cause: 'A greedy rule with no proof, losing a few per cent on the instances that arrive.',
          fix: 'Build the exact oracle for small instances and measure the gap distribution.'
        },
        {
          symptom: 'A greedy rule passed a thousand random tests and failed in production.',
          cause: 'Its counter-examples are rare under the test generator and common in the real workload.',
          fix: 'Search adversarially rather than randomly, and prefer a proof to either.'
        },
        {
          symptom: 'Change-making returns too many coins for one currency only.',
          cause: 'That denomination set is not canonical.',
          fix: 'Run the bounded canonicity check per currency; fall back to dynamic programming where it fails.'
        },
        {
          symptom: 'The greedy answer changes when the input is shuffled.',
          cause: 'An unstable tie-break in the ranking comparator.',
          fix: 'Make the comparator total by appending a unique key.'
        }
      ],
      inTheWild: [
        { system: 'Huffman coding in DEFLATE and JPEG', how: 'the greedy merge, proved by an exchange argument' },
        { system: 'Dijkstra and Prim', how: 'greedy over a cut, correct because of the structure rather than the rule' },
        { system: 'Cache eviction and scheduler policies', how: 'greedy heuristics with competitive ratios rather than optimality' },
        { system: 'Vending and point-of-sale change', how: 'the canonicity of the coin set decides whether the obvious loop is right' }
      ],
      sources: [
        { title: 'Algorithm Design, chapter 4', where: 'Kleinberg and Tardos — the greedy proof techniques' },
        { title: 'A method for the construction of minimum-redundancy codes', where: 'David Huffman — Proceedings of the IRE, 1952' },
        { title: 'A polynomial-time algorithm for the change-making problem', where: 'David Pearson — Operations Research Letters, 2005' },
        { title: 'Introduction to Algorithms, chapter 16', where: 'Cormen, Leiserson, Rivest, Stein — greedy algorithms' }
      ]
    }
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
