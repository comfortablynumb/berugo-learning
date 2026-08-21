/** Reference entries for the first four dynamic-programming sections (M12.1-M12.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'what-dp-is': {
      summary: 'The two preconditions dynamic programming actually needs, the subproblem DAG that makes ' +
        'both of them visible, and states × transitions as a complexity you can state before writing code.',
      intuition: 'A DP is a walk over a DAG of subproblems. Memoisation discovers the order at run time; ' +
        'tabulation requires you to have worked it out already, and getting it wrong returns a number.',
      formulation: {
        equations: [
          {
            label: 'The recurrence',
            expr: 'opt(s) = best over transitions t of combine(cost(t), opt(child(s, t)))',
            terms: [
              { sym: 'optimal substructure', meaning: 'an optimal whole contains optimal parts — makes the recurrence correct' },
              { sym: 'overlapping subproblems', meaning: 'some subproblem is needed twice — makes remembering worth it' }
            ]
          },
          {
            label: 'The complexity',
            expr: 'time = Θ(|S| · b), where |S| is the number of states and b the branching of the transition',
            terms: [
              { sym: 'Fibonacci', meaning: '26 states × 2 transitions = 52 predicted, 48 measured at n = 25' },
              { sym: '0/1 knapsack', meaning: 'n·C states × 2 transitions — available before any code' }
            ]
          },
          {
            label: 'The three evaluations',
            expr: 'naive recursion / memoised recursion / tabulation — one recurrence, one answer, three costs',
            terms: [
              { sym: 'naive at n = 25', meaning: '242 785 calls, because the DAG is walked as a tree' },
              { sym: 'memoised', meaning: '49 calls, 26 states, 23 hits' },
              { sym: 'tabulated', meaning: '26 states and 48 transitions — identical work, order supplied by hand' }
            ]
          },
          {
            label: 'Overlap, measured',
            expr: 'shared = |{s : indegree(s) > 1}| in the subproblem DAG',
            terms: [
              { sym: 'Fibonacci', meaning: '23 of 26 states are shared' },
              { sym: 'binomial C(20,10)', meaning: '81 of 120 shared — a lattice, not a path' },
              { sym: 'merge sort', meaning: '0 shared — divide and conquer, and memoising it buys nothing' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every finished run returns the same answer',
          why: 'Cost columns are only comparable between implementations that agree.',
          breaks: 'A memo bug makes the fast run both faster and wrong, and the cost table then flatters it.'
        },
        {
          name: 'A tabulation reads no cell before it is written',
          why: 'It is the only observable difference between a valid evaluation order and an invalid one.',
          breaks: 'The reversed Fibonacci order visits the same 26 states and returns 0, with nothing raised.'
        },
        {
          name: 'A capped run reports that it was capped',
          why: 'A truncated count presented as a measurement is the most persuasive kind of wrong.',
          breaks: 'Naive Fibonacci at n = 40 under a 100 000-call budget would otherwise read as a finished run.'
        }
      ],
      complexity: [
        { operation: 'naive recursion on Fibonacci', average: 'Θ(φⁿ) calls', worst: '242 785 at n = 25' },
        { operation: 'memoised recursion', average: 'Θ(states × transitions)', worst: '26 states, 48 transitions at n = 25' },
        { operation: 'tabulation', average: 'identical to the memo, smaller constant', worst: 'plus any states the recursion never reaches' },
        { operation: 'building the subproblem DAG', average: 'Θ(states + edges)', worst: 'edges are capped for drawing; the counters keep counting' }
      ],
      failureModes: [
        {
          symptom: 'The bottom-up version returns a different answer from the top-down one.',
          cause: 'The tabulation order is not a reverse topological order of the subproblem DAG.',
          fix: 'Count cells read before they were written; the number is the bug, and zero is the requirement.'
        },
        {
          symptom: 'Memoisation made no difference to the running time.',
          cause: 'The subproblems do not overlap — this is divide and conquer wearing a cache.',
          fix: 'Count states with in-degree above one. If it is zero, remove the memo rather than tuning it.'
        },
        {
          symptom: 'The DP is correct and far too slow.',
          cause: 'The state carries more than the future depends on, so the state space is larger than it needs to be.',
          fix: 'Write the state as an English sentence and delete any part that never appears on the right-hand side.'
        },
        {
          symptom: 'A benchmark reports an impossibly fast exponential run.',
          cause: 'A call budget fired and the truncated count was reported as a finished one.',
          fix: 'Return the budget-exhausted flag beside the count and render the answer as "stopped".'
        }
      ],
      inTheWild: [
        { system: 'Compilers', how: 'instruction selection and register allocation are DPs over expression trees and interference structure' },
        { system: 'Query planners', how: 'join-order search is a DP over subsets of relations, exactly the shape of M12.7' },
        { system: 'Diff and merge tools', how: 'edit-distance DP with a heuristic front end, revisited in M12.4 and M15' },
        { system: 'Speech and sequence models', how: 'Viterbi is a DP over (time, hidden state) with the same states × transitions accounting' }
      ],
      sources: [
        { title: 'Introduction to Algorithms, chapter 15', where: 'Cormen, Leiserson, Rivest and Stein — rod cutting, matrix chain, LCS' },
        { title: 'Dynamic Programming', where: 'Richard Bellman — Princeton University Press, 1957' },
        { title: 'Algorithm Design, chapter 6', where: 'Kleinberg and Tardos — the clearest treatment of choosing the state' },
        { title: 'The Algorithm Design Manual, section 10', where: 'Steven Skiena — on recognising when DP applies at all' }
      ]
    },

    'one-dimensional-dp': {
      summary: 'The family where the state is a single index: Kadane, coin change, house robber, jump games ' +
        'and longest increasing subsequence — and where the loop order decides which question is answered.',
      intuition: 'Write down exactly what dp[i] means and the transitions are forced. Every bug here is ' +
        'either a vague definition or a loop order that answers a different question.',
      formulation: {
        equations: [
          {
            label: 'Kadane',
            expr: 'dp[i] = max(a[i], dp[i−1] + a[i]); answer = max over i of dp[i]',
            terms: [
              { sym: 'dp[i]', meaning: 'the best sum of a subarray ENDING at i, which is why the answer is a maximum over i' },
              { sym: 'measured', meaning: '502 781 over [0, 1999] on the default sequence, matching the quadratic scan' }
            ]
          },
          {
            label: 'Coin change, two questions',
            expr: 'combinations: for coin, for amount. permutations: for amount, for coin',
            terms: [
              { sym: 'amount 5 from {1,2,5}', meaning: '4 combinations against 9 permutations' },
              { sym: 'amount 20', meaning: '29 against 26 547 — the gap grows with the number of parts' }
            ]
          },
          {
            label: 'LIS, two ways',
            expr: 'O(n²) table with predecessor links, or patience piles with a binary search',
            terms: [
              { sym: 'quadratic', meaning: '1 999 000 transitions at n = 2 000 — exactly n(n−1)/2' },
              { sym: 'patience', meaning: '11 411 transitions, same length of 85 — a factor of 175' },
              { sym: 'the piles', meaning: 'increasing, exactly the right length, and NOT a subsequence of the input' }
            ]
          },
          {
            label: 'Impossible is not a number',
            expr: 'the codomain of a min-DP is value ∪ {⊥}, and ⊥ must not be comparable with values',
            terms: [
              { sym: 'coin change', meaning: 'returns null and an empty list, not Infinity' },
              { sym: 'jump games', meaning: 'an unreachable end returns null, not a large jump count' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A returned subsequence is a subsequence of the input',
          why: 'It is the only check that separates a real answer from the pile-tops array.',
          breaks: 'Returning `tails` passes a length check, a sortedness check and every casual read.'
        },
        {
          name: 'The two LIS implementations return the same length',
          why: 'They compute it by entirely different means, so a shared bug is very unlikely.',
          breaks: 'Deleting the quadratic version as redundant removes the only cheap oracle.'
        },
        {
          name: 'The counted ways match an enumeration',
          why: 'Combinations and permutations are both correct answers to different questions.',
          breaks: 'Swapping the loops changes 4 into 9 with no error and no visible difference in the code.'
        }
      ],
      complexity: [
        { operation: 'Kadane', average: 'Θ(n) time, Θ(1) space', worst: 'identical — no input shape matters' },
        { operation: 'LIS, table', average: 'Θ(n²) comparisons', worst: '1 999 000 at n = 2 000' },
        { operation: 'LIS, patience', average: 'Θ(n log n)', worst: '11 411 binary-search steps at n = 2 000' },
        { operation: 'coin change', average: 'Θ(coins × amount)', worst: 'pseudo-polynomial in the amount, as in M12.3' },
        { operation: 'house robber', average: 'Θ(n) with Θ(1) live state', worst: 'Θ(n) if the decision array is kept for the traceback' }
      ],
      failureModes: [
        {
          symptom: 'The LIS length is right and the returned sequence is nonsense.',
          cause: 'The pile-tops array was returned instead of a reconstruction through the predecessor links.',
          fix: 'Assert the result is a subsequence of the input, not merely increasing and the right length.'
        },
        {
          symptom: 'The number of ways is far larger than expected.',
          cause: 'The amount loop is outside the coin loop, so orderings are being counted separately.',
          fix: 'Check the count against exhaustive enumeration of multisets on a small amount.'
        },
        {
          symptom: 'An unreachable target is reported as an enormous cost.',
          cause: 'Infinity leaked out of the recurrence into the return value.',
          fix: 'Map Infinity to null at the boundary and force the caller to handle it.'
        },
        {
          symptom: 'Kadane returns the right sum and the wrong range.',
          cause: 'The start index was not reset when the running sum restarted at a[i].',
          fix: 'Track the start alongside the running value and check the range re-sums to the answer.'
        }
      ],
      inTheWild: [
        { system: 'Financial analytics', how: 'maximum-drawdown and best-window queries are Kadane variants' },
        { system: 'Change-making and coin dispensers', how: 'minimum-coin DP where the greedy shortcut needs the canonicity check from M11.3' },
        { system: 'Version-control heuristics', how: 'patience diff is built directly on patience sorting' },
        { system: 'Scheduling and resource planning', how: 'house-robber-shaped recurrences whenever consecutive choices conflict' }
      ],
      sources: [
        { title: 'Programming Pearls, column 8', where: 'Jon Bentley — the derivation of Kadane from the quadratic scan' },
        { title: 'Longest increasing subsequences: from patience sorting to the Baik-Deift-Johansson theorem', where: 'Aldous and Diaconis — Bulletin of the AMS, 1999' },
        { title: 'Introduction to Algorithms, chapter 15', where: 'Cormen et al. — the one-dimensional family' },
        { title: 'Patience Diff', where: 'Bram Cohen — the Bazaar mailing list, 2010' }
      ]
    },

    'knapsack-family': {
      summary: 'One recurrence and four problems: 0/1, unbounded, bounded and subset sum — with the space ' +
        'reduction that deletes the reconstruction and the sense in which "polynomial" is a lie.',
      intuition: 'Two incoming edges per cell, items × capacity cells. The loop direction chooses the ' +
        'problem, and the capacity is measured in digits rather than in units.',
      formulation: {
        equations: [
          {
            label: 'The 0/1 recurrence',
            expr: 'best[i][c] = max(best[i−1][c], best[i−1][c − w_i] + v_i)',
            terms: [
              { sym: 'skip', meaning: 'the cell directly above' },
              { sym: 'take', meaning: 'one row up and w_i columns left, plus v_i' },
              { sym: 'measured', meaning: '12 items and capacity 60 gives 571 from 793 cells' }
            ]
          },
          {
            label: 'Loop direction',
            expr: 'descending c gives 0/1; ascending c gives unbounded',
            terms: [
              { sym: 'descending', meaning: 'best[c − w] still holds the previous row, so the item is used once' },
              { sym: 'ascending', meaning: 'best[c − w] has already been updated, so the item feeds itself' }
            ]
          },
          {
            label: 'Bounded, three ways',
            expr: 'expand every copy / bundle 1, 2, 4, … / a monotonic deque over each residue chain',
            terms: [
              { sym: 'expand', meaning: '240 items, 11 800 transitions at 40 copies each' },
              { sym: 'binary split', meaning: '36 bundles, 621 transitions' },
              { sym: 'deque', meaning: '6 item types, 366 transitions — no dependence on the copy count at all' }
            ]
          },
          {
            label: 'Pseudo-polynomial',
            expr: 'Θ(n·C) is Θ(n·2^(log C)) — exponential in the input length',
            terms: [
              { sym: 'capacity 10', meaning: '132 cells, 4 bits of input' },
              { sym: 'capacity 100 000', meaning: '1 200 012 cells, 17 bits of input' },
              { sym: 'per added digit', meaning: 'input +3.3 bits, work ×10' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The chosen set re-sums to the reported value and fits the capacity',
          why: 'It is the only check available against the problem statement rather than another implementation.',
          breaks: 'A traceback over a space-reduced table returns a set that does neither, and the value stays right.'
        },
        {
          name: 'A space-reduced solver returns no chosen set rather than a wrong one',
          why: 'The information the traceback needs no longer exists; returning something is worse than returning nothing.',
          breaks: 'Leaving the traceback in place after the reduction produces a plausible item list of nothing.'
        },
        {
          name: 'All three bounded expansions produce the same value',
          why: 'They differ only in how counts are represented, so any disagreement is a representation bug.',
          breaks: 'A binary split that omits the remainder bundle cannot express every count and quietly loses optima.'
        }
      ],
      complexity: [
        { operation: '0/1 knapsack, full table', average: 'Θ(n·C) time and space', worst: '793 cells at n = 12, C = 60' },
        { operation: '0/1 knapsack, one row', average: 'Θ(n·C) time, Θ(C) space', worst: '61 cells — and no traceback' },
        { operation: 'bounded, full expansion', average: 'Θ(Σkᵢ · C)', worst: '240 expanded items at 40 copies each' },
        { operation: 'bounded, binary splitting', average: 'Θ(Σ log kᵢ · C)', worst: '36 bundles for the same instance' },
        { operation: 'bounded, monotonic deque', average: 'Θ(n · C), independent of the counts', worst: '366 transitions for 6 item types' },
        { operation: 'subset sum', average: 'Θ(n · target)', worst: 'the same pseudo-polynomial caveat applies' }
      ],
      failureModes: [
        {
          symptom: 'The optimum is right and the item list does not add up to it.',
          cause: 'The traceback walks rows that a space reduction removed.',
          fix: 'Re-sum the chosen set on every call in tests; return null rather than a list when rows are gone.'
        },
        {
          symptom: 'Items are being taken more than once in a 0/1 knapsack.',
          cause: 'The rolling loop iterates the capacity upwards instead of downwards.',
          fix: 'Assert against exhaustive enumeration on small instances, where the difference shows immediately.'
        },
        {
          symptom: 'The solver is correct and hangs on a realistic capacity.',
          cause: 'Θ(n·C) with C in the millions — the table, not the code, is the problem.',
          fix: 'Compute n·C before writing the loop; past a few hundred million cells choose a different approach.'
        },
        {
          symptom: 'Bounded knapsack is far slower than expected on a few item types.',
          cause: 'Copies were expanded one by one instead of bundled or handled by the deque.',
          fix: 'Report the expanded item count as a field; a count equal to Σkᵢ is the tell.'
        }
      ],
      inTheWild: [
        { system: 'Cloud bin packing and VM placement', how: 'multi-dimensional knapsack with capacity as the constrained resource' },
        { system: 'Cutting-stock and yield optimisation', how: 'unbounded knapsack over standard stock lengths' },
        { system: 'Ad and slot auctions', how: 'value-per-weight ranking with the integral gap from M11.3 as the loss bound' },
        { system: 'Cryptographic knapsacks', how: 'Merkle-Hellman is broken precisely because superincreasing instances are easy' }
      ],
      sources: [
        { title: 'Knapsack Problems', where: 'Kellerer, Pferschy and Pisinger — Springer, 2004' },
        { title: 'Computers and Intractability', where: 'Garey and Johnson — the definition of weakly NP-hard' },
        { title: 'Introduction to Algorithms, chapter 15', where: 'Cormen et al. — 0/1 knapsack and the space reduction' },
        { title: 'Efficient algorithms for the bounded knapsack problem', where: 'Pisinger — on binary splitting and its alternatives' }
      ]
    },

    'sequence-alignment': {
      summary: 'Edit distance, LCS and scored alignment as one table with different costs — and ' +
        "Hirschberg's algorithm recovering the alignment in linear space.",
      intuition: 'Three predecessors per cell. Dropping to two rows keeps the distance and deletes the ' +
        'alignment, so the check that matters is whether the alignment is an alignment.',
      formulation: {
        equations: [
          {
            label: 'Edit distance',
            expr: 'd[i][j] = min(d[i−1][j−1] + sub, d[i−1][j] + del, d[i][j−1] + ins)',
            terms: [
              { sym: 'kitten → sitting', meaning: 'distance 3 from a 56-cell table, confirmed by exhaustive recursion' },
              { sym: 'Damerau', meaning: 'adding a transposition makes ab → ba cost 1 rather than 2 — a different distance' }
            ]
          },
          {
            label: 'Space',
            expr: 'full Θ(mn) with a traceback; two rows Θ(n) without one; Hirschberg Θ(n) with one',
            terms: [
              { sym: 'kitten / sitting', meaning: '56 cells against 16, distance 3 either way' },
              { sym: 'at 600 a side', meaning: '361 201 cells against 1 202 — 300.5×' },
              { sym: 'at 2 000 a side', meaning: '4 004 001 against 4 002 — 1 000.5×' }
            ]
          },
          {
            label: "Hirschberg's split",
            expr: 'the crossing column j minimises forward(j) + backward(n − j) at the middle row',
            terms: [
              { sym: 'cost', meaning: 'about 2× the time for Θ(min(m,n)) space' },
              { sym: 'measured', meaning: '5 recursive splits for kitten / sitting, identical alignment' }
            ]
          },
          {
            label: 'Global, local, affine',
            expr: 'Needleman-Wunsch / Smith-Waterman (clamp at 0) / three tables for gap state',
            terms: [
              { sym: 'ACACACTA vs AGCACACA', meaning: '12 global, 12 local, 6 affine' },
              { sym: 'affine', meaning: 'a run of k gaps costs open + k·extend, so indels stay contiguous' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Stripping the gaps from each row returns the two inputs',
          why: 'It is the assertion a distance can never make, and it catches every traceback bug.',
          breaks: 'A traceback over a space-reduced table produces rows that strip back to something else.'
        },
        {
          name: 'The two rows are the same length and no column is gap against gap',
          why: 'Both are cheap, and both are violated by off-by-one errors in the walk.',
          breaks: 'A gap-gap column is a step that consumed nothing, which is not an edit operation.'
        },
        {
          name: 'Hirschberg returns the same cost as the full table',
          why: 'It is a different algorithm for the same optimum, so agreement is real evidence.',
          breaks: 'A wrong midpoint column gives a valid-looking alignment of higher cost.'
        }
      ],
      complexity: [
        { operation: 'edit distance, full table', average: 'Θ(mn) time and space', worst: '56 cells for a 6/7 pair' },
        { operation: 'edit distance, two rows', average: 'Θ(mn) time, Θ(min(m,n)) space', worst: '16 cells — no alignment' },
        { operation: "Hirschberg's algorithm", average: 'Θ(mn) time (about 2×), Θ(min(m,n)) space', worst: '16 cells and 5 splits for the same pair' },
        { operation: 'LCS', average: 'Θ(mn)', worst: 'the same table with substitution forbidden' },
        { operation: 'affine gaps', average: 'Θ(mn) with three tables', worst: '3× the memory of the linear-gap version' }
      ],
      failureModes: [
        {
          symptom: 'The distance is right and the printed alignment is not an alignment of the inputs.',
          cause: 'The traceback runs over a table that a space reduction removed.',
          fix: 'Assert the gap-stripped rows equal the inputs, on every alignment the code returns.'
        },
        {
          symptom: 'The alignment is longer than it needs to be at the same cost.',
          cause: 'The traceback does not prefer the diagonal at ties, so gap pairs replace matches.',
          fix: 'Order the traceback tests diagonal first and check the column count as well as the cost.'
        },
        {
          symptom: 'Two distances computed by the same library disagree.',
          cause: 'One was Damerau and one was Levenshtein — different distances, not different implementations.',
          fix: 'Make the transposition cost explicit in the interface and refuse to default it silently.'
        },
        {
          symptom: 'Alignments are shredded into single-character gaps.',
          cause: 'A linear gap penalty gives the aligner no reason to keep indels contiguous.',
          fix: 'Use affine gaps — three tables, because "inside a gap" is state.'
        }
      ],
      inTheWild: [
        { system: 'git diff', how: 'an LCS problem with a heuristic front end; M15 builds Myers, which exploits diff sparseness' },
        { system: 'BLAST and bioinformatics pipelines', how: 'Smith-Waterman with affine gaps, seeded to avoid the full table' },
        { system: 'Spell checkers and fuzzy search', how: 'bounded edit distance, revisited with automata in M06' },
        { system: 'Speech and OCR post-processing', how: 'word error rate is edit distance over tokens' }
      ],
      sources: [
        { title: 'A linear space algorithm for computing maximal common subsequences', where: 'D. S. Hirschberg — CACM, 1975' },
        { title: 'A general method applicable to the search for similarities in the amino acid sequence of two proteins', where: 'Needleman and Wunsch — JMB, 1970' },
        { title: 'Identification of common molecular subsequences', where: 'Smith and Waterman — JMB, 1981' },
        { title: 'Algorithms on Strings, Trees and Sequences', where: 'Dan Gusfield — Cambridge University Press, 1997' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
