/** Reference entries for the structured dynamic-programming sections (M12.5-M12.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'interval-dp': {
      summary: 'The family whose state is a contiguous range, the diagonal evaluation order it forces, and ' +
        "Knuth's optimisation with the precondition that decides whether it is a speed-up or a wrong answer.",
      intuition: 'Every interval DP asks where a range breaks. Both pieces are shorter, so the table fills ' +
        'by increasing length — and a narrowing of the split search has to be earned.',
      formulation: {
        equations: [
          {
            label: 'The recurrence',
            expr: 'best[i][j] = op over k in [i, j) of combine(best[i][k], best[k+1][j], join(i, k, j))',
            terms: [
              { sym: 'matrix chain', meaning: 'join is d[i]·d[k+1]·d[j+1]' },
              { sym: 'optimal BST', meaning: 'join is the total weight of the interval' },
              { sym: 'burst balloons', meaning: 'join is a[i]·a[k]·a[j], and the state is "k burst LAST"' }
            ]
          },
          {
            label: 'Evaluation order',
            expr: 'settle every interval of length 2, then 3, and so on — never i, j nested',
            terms: [
              { sym: 'n = 6', meaning: '15 intervals of length ≥ 2; 5 of length 2, then 4, 3, 2, 1' },
              { sym: 'the failure', meaning: 'a nested i, j loop reads cells still holding zero and returns a number' }
            ]
          },
          {
            label: "Knuth's optimisation",
            expr: 'opt[i][j−1] ≤ opt[i][j] ≤ opt[i+1][j], collapsing the split loop from O(n³) to O(n²)',
            terms: [
              { sym: '9 keys, unoptimised', meaning: '156 split tests, cost 2.590000' },
              { sym: '9 keys, narrowed', meaning: '72 split tests, cost 2.590000 — a 2.2× reduction' }
            ]
          },
          {
            label: 'The quadrangle inequality',
            expr: 'w(a,c) + w(b,d) ≤ w(a,d) + w(b,c) for a ≤ b ≤ c ≤ d, plus monotonicity on nested intervals',
            terms: [
              { sym: 'non-negative weights', meaning: 'always satisfy it, which is why the textbook case works' },
              { sym: 'tolerance', meaning: 'nine two-decimal probabilities violate it by 1.11 × 10⁻¹⁶ of pure floating-point error' },
              { sym: 'one negative weight', meaning: 'fails at (0, 0, 2, 4) and the solver refuses' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A cell is settled only after every shorter interval it reads',
          why: 'It is the definition of a valid evaluation order, and violating it returns a number rather than an error.',
          breaks: 'A nested i, j loop settles [0, n−1] before [1, 2] and reads two zeros.'
        },
        {
          name: 'The narrowed search returns the unnarrowed optimum',
          why: 'The optimisation is a claim about the cost function, not about the algorithm.',
          breaks: 'When the quadrangle inequality fails the band can exclude the optimum, faster and silently.'
        },
        {
          name: 'The precondition check tolerates floating-point error',
          why: 'Interval weights are differences of prefix sums, so exact comparison rejects valid instances.',
          breaks: 'An exact <= rejects the very instance Knuth wrote the optimisation for.'
        }
      ],
      complexity: [
        { operation: 'matrix chain', average: 'Θ(n³) split tests', worst: '35 tests over 15 intervals at n = 6' },
        { operation: 'optimal BST, unoptimised', average: 'Θ(n³)', worst: '156 split tests at 9 keys' },
        { operation: "optimal BST, Knuth's optimisation", average: 'Θ(n²) amortised over the diagonals', worst: '72 split tests at 9 keys' },
        { operation: 'palindrome partitioning', average: 'Θ(n²) for the palindrome table plus Θ(n²) for the cuts', worst: 'both quadratic; no split loop at all' },
        { operation: 'burst balloons', average: 'Θ(n³)', worst: 'the state must be "burst last", or there is no substructure to use' }
      ],
      failureModes: [
        {
          symptom: 'An interval DP returns a plausible number that is too small.',
          cause: 'The evaluation order reads cells before they are written, and they hold zero.',
          fix: 'Iterate by interval length, and mark the unused triangle rather than filling it with zeros.'
        },
        {
          symptom: 'The optimised version is faster and gives a slightly worse optimum.',
          cause: 'The quadrangle inequality does not hold for this cost function, so the narrowed band excluded the optimum.',
          fix: 'Test the inequality on the instance and refuse to run when it fails; return the witness indices.'
        },
        {
          symptom: 'The optimisation refuses on a textbook instance.',
          cause: 'The precondition check compares prefix-sum differences exactly.',
          fix: 'Scale a tolerance to the total weight — the violation is around 10⁻¹⁶, not a real one.'
        },
        {
          symptom: 'Burst balloons has no working recurrence.',
          cause: 'The state is "which do I burst first", under which the two sides are not independent.',
          fix: 'Change the state to "which do I burst last in this interval"; the neighbours are then the endpoints.'
        }
      ],
      inTheWild: [
        { system: 'BLAS and deep-learning graph compilers', how: 'matrix-chain ordering decides the multiplication schedule for a chain of tensors' },
        { system: 'Database query optimisers', how: 'join ordering over contiguous relation ranges when the plan space is restricted to left-deep chains' },
        { system: 'Text layout and line breaking', how: 'optimal paragraph breaking is an interval DP with a badness join cost' },
        { system: 'RNA secondary-structure prediction', how: 'Nussinov and Zuker folding are interval DPs over subsequences' }
      ],
      sources: [
        { title: 'Optimum binary search trees', where: 'Donald Knuth — Acta Informatica, 1971' },
        { title: 'Efficient dynamic programming using quadrangle inequalities', where: 'F. Frances Yao — STOC 1980' },
        { title: 'Introduction to Algorithms, section 15.2', where: 'Cormen et al. — matrix-chain multiplication' },
        { title: 'Breaking paragraphs into lines', where: 'Knuth and Plass — Software: Practice and Experience, 1981' }
      ]
    },

    'tree-dp': {
      summary: 'DP over rooted trees, and rerooting: one downward pass and one upward pass answering for ' +
        'every possible root, with the prefix/suffix trick that keeps it linear.',
      intuition: 'Children before parents settles the order. Rerooting is prefix sums on a tree, and the ' +
        '"all but one" step is where the quadratic hides.',
      formulation: {
        equations: [
          {
            label: 'Rooted tree DP',
            expr: 'value(v) = finish(combine over children c of lift(value(c)))',
            terms: [
              { sym: 'independent set', meaning: 'two values per node — taken and skipped' },
              { sym: 'evaluation order', meaning: 'reverse discovery order, computed iteratively' }
            ]
          },
          {
            label: 'Rerooting',
            expr: 'answer(v) = finish(combine(up(v), all children of v))',
            terms: [
              { sym: 'down', meaning: "v's own subtree, one post-order pass" },
              { sym: 'up', meaning: 'everything else, derived from the parent minus this child' }
            ]
          },
          {
            label: 'Sum of distances',
            expr: 'answer[child] = answer[parent] + n − 2·size(child)',
            terms: [
              { sym: 'why', meaning: 'size(child) nodes come one edge closer; n − size(child) go one further' },
              { sym: 'measured', meaning: '1 999 combines for all 2 000 roots — 1.00 per node' }
            ]
          },
          {
            label: 'Prefix and suffix',
            expr: 'without[k] = combine(prefix[k−1], suffix[k+1]) — Θ(deg) rather than Θ(deg²)',
            terms: [
              { sym: 'star, 2 000 nodes', meaning: '11 994 combines against 3 998 000 for the loop — 333.3×' },
              { sym: 'path, 2 000 nodes', meaning: '11 994 against 7 994 — the loop is CHEAPER here' },
              { sym: 'the trade', meaning: 'a constant premium on ordinary shapes, insurance against O(n²) on a star' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every rerooted answer matches an independent computation from that node',
          why: 'A rerooting bug is correct at the root it was computed from and wrong at the other n − 1.',
          breaks: 'Checking one node passes while the upward pass is completely wrong.'
        },
        {
          name: 'The combine count is linear in n on every tree shape',
          why: 'It is the claim the technique exists to make, and it is a measurement rather than an argument.',
          breaks: 'A per-child "all but one" loop is quadratic in the degree and invisible on random trees.'
        },
        {
          name: 'Traversals are iterative',
          why: 'A path of n nodes is a recursion n deep, and paths are legitimate inputs.',
          breaks: 'A recursive traversal overflows the stack at the sizes these demos replay.'
        }
      ],
      complexity: [
        { operation: 'rooted tree DP', average: 'Θ(n) over one pass', worst: 'Θ(n) — depth affects the stack, not the work' },
        { operation: 'rerooting, prefix/suffix', average: 'Θ(n) total for all roots', worst: '11 994 combines at n = 2 000 on every shape' },
        { operation: 'rerooting, naive "all but one"', average: 'Θ(Σ deg²)', worst: '3 998 000 on a 2 000-node star' },
        { operation: 'sum of distances', average: 'Θ(n) with two passes', worst: '1 999 combines at n = 2 000' },
        { operation: 'the n-BFS oracle', average: 'Θ(n²)', worst: 'exactly the cost rerooting exists to avoid — kept small on purpose' }
      ],
      failureModes: [
        {
          symptom: 'The answer is right at the root and wrong everywhere else.',
          cause: 'The upward pass is wrong; the downward pass is an ordinary tree DP and is usually correct.',
          fix: 'Compare against an independent computation at every node, not at one.'
        },
        {
          symptom: 'Rerooting is quadratic on some inputs and linear on others.',
          cause: '"Every child but this one" is being recomputed per child instead of by prefix and suffix arrays.',
          fix: 'Report the combine count and test on a star, where the difference is three orders of magnitude.'
        },
        {
          symptom: 'A stack overflow on a large input that looks fine at small sizes.',
          cause: 'A recursive traversal meeting a path-shaped tree.',
          fix: 'Compute a discovery order with an explicit stack and walk the array in both directions.'
        },
        {
          symptom: 'The tree DP is correct and the problem had a much simpler answer.',
          cause: 'Not every tree problem needs a table — the diameter is two traversals.',
          fix: 'Ask for a structural argument before reaching for a recurrence.'
        }
      ],
      inTheWild: [
        { system: 'Network and CDN placement', how: 'sum-of-distances rerooting picks the node minimising total latency' },
        { system: 'Phylogenetics', how: 'Felsenstein pruning is a tree DP, and rerooting answers for every candidate root' },
        { system: 'Compiler dominator and dataflow analyses', how: 'the same up/down pass structure over dominator trees' },
        { system: 'Probabilistic graphical models', how: 'belief propagation on a tree is rerooting with a different monoid' }
      ],
      sources: [
        { title: 'Competitive Programmer’s Handbook, chapter 14', where: 'Antti Laaksonen — tree DP and rerooting' },
        { title: 'Evolutionary trees from DNA sequences: a maximum likelihood approach', where: 'Joseph Felsenstein — Journal of Molecular Evolution, 1981' },
        { title: 'Introduction to Algorithms, chapter 22', where: 'Cormen et al. — traversal order and iterative depth-first search' },
        { title: 'Algorithms on Trees and Graphs', where: 'Gabriel Valiente — Springer, 2002' }
      ]
    },

    'bitmask-dp': {
      summary: 'Subsets as integers: Held-Karp, the assignment problem, submask enumeration, sum over ' +
        'subsets and broken-profile tilings — and the memory ceiling that ends the family.',
      intuition: 'A set becomes an array index, so the table is flat and the transitions are single ' +
        'instructions. The same fact fixes the wall at 2ⁿ.',
      formulation: {
        equations: [
          {
            label: 'Held-Karp',
            expr: 'best[mask][last] = min over prev in mask of best[mask ^ (1<<last)][prev] + d(prev, last)',
            terms: [
              { sym: 'states', meaning: '2ⁿ·n — 49 152 at n = 12' },
              { sym: 'against', meaning: '(n−1)! tours — 39 916 800 at n = 12' },
              { sym: 'checked', meaning: 'at n = 10 the table and every permutation both give 234.512447' }
            ]
          },
          {
            label: 'Submask enumeration',
            expr: 'for (sub = mask; sub; sub = (sub − 1) & mask) — total over all masks is 3ⁿ',
            terms: [
              { sym: 'why 3ⁿ', meaning: 'each bit is in neither, in the submask, or in the mask only' },
              { sym: 'measured', meaning: '81 at n = 4, 6 561 at n = 8, 531 441 at n = 12 — exactly 3ⁿ' },
              { sym: 'the assumed bound', meaning: '4ⁿ = 16 777 216 at n = 12 — a factor of 32 too large' }
            ]
          },
          {
            label: 'Sum over subsets',
            expr: 'for each bit b, for each mask with b set: f[mask] += f[mask ^ (1<<b)]',
            terms: [
              { sym: 'cost', meaning: 'n·2ⁿ — 5 120 transitions at 10 bits' },
              { sym: 'against the submask walk', meaning: '59 049 at the same size, for an identical table' },
              { sym: 'the loop order', meaning: 'the bit loop must be outside; swapping gives a partly relaxed table' }
            ]
          },
          {
            label: 'The memory wall',
            expr: 'bytes = 8 · n · 2ⁿ',
            terms: [
              { sym: 'n = 12', meaning: '49 152 cells, 393 KB' },
              { sym: 'n = 20', meaning: '20 971 520 cells, 168 MB' },
              { sym: 'n = 25', meaning: '838 860 800 cells, 6.7 GB' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The table agrees with exhaustive enumeration at sizes where both run',
          why: 'A Held-Karp bug returns a plausible tour length with no other symptom.',
          breaks: 'A wrong transition gives a shorter-looking tour that is not a tour.'
        },
        {
          name: 'The submask total is exactly 3ⁿ',
          why: 'It is an identity, not an asymptotic bound, so it is checkable at every size.',
          breaks: 'A loop that misses the empty submask or repeats one breaks the count immediately.'
        },
        {
          name: 'Sum over subsets and the submask walk produce identical tables',
          why: 'The fast version is only worth having if it is exact.',
          breaks: 'Swapping the loop order gives a table that is partly relaxed and entirely plausible.'
        }
      ],
      complexity: [
        { operation: 'Held-Karp', average: 'Θ(2ⁿ·n²) time, Θ(2ⁿ·n) space', worst: '49 152 cells and 56 342 transitions at n = 12' },
        { operation: 'assignment over subsets', average: 'Θ(2ⁿ·n) with the worker index derived', worst: '256 states at n = 8 rather than 2 048' },
        { operation: 'submask enumeration', average: 'Θ(3ⁿ) over all masks', worst: '531 441 at n = 12 — exact' },
        { operation: 'sum over subsets', average: 'Θ(n·2ⁿ)', worst: '5 120 transitions at 10 bits' },
        { operation: 'broken-profile tiling', average: 'Θ(cells · 2^narrow side)', worst: '2 × 12 is 4 profiles; 12 × 2 is 4 096' }
      ],
      failureModes: [
        {
          symptom: 'The DP is correct and the process is killed by the allocator.',
          cause: '2ⁿ·n cells at eight bytes each, past what the runtime will give you.',
          fix: 'Compute the bytes before writing code; past the ceiling change algorithm, not the inner loop.'
        },
        {
          symptom: 'A submask loop is far slower than the 3ⁿ estimate.',
          cause: 'The inner loop is over all masks rather than over submasks of the current one.',
          fix: 'Count the steps and compare against 3ⁿ, which is exact.'
        },
        {
          symptom: 'The sum-over-subsets table is subtly wrong.',
          cause: 'The bit loop is inside the mask loop, so entries are only partly relaxed.',
          fix: 'Assert against the submask walk on a small n; the tables must be identical.'
        },
        {
          symptom: 'A tiling DP has an unexpectedly enormous state space.',
          cause: 'The wide side of the board is in the profile instead of the narrow one.',
          fix: 'Transpose so the narrow dimension is the mask — 2^m against 2^n is the whole difference.'
        }
      ],
      inTheWild: [
        { system: 'Vehicle routing and last-mile delivery', how: 'Held-Karp on small clusters inside a larger heuristic' },
        { system: 'Database join ordering', how: 'the classic System R optimiser is a DP over subsets of relations' },
        { system: 'FPGA and chip placement', how: 'assignment DPs over small blocks, with the same popcount trick' },
        { system: 'Statistical physics and combinatorics', how: 'transfer-matrix and broken-profile methods count configurations of lattices' }
      ],
      sources: [
        { title: 'A dynamic programming approach to sequencing problems', where: 'Held and Karp — SIAM Journal, 1962' },
        { title: 'Dynamic programming treatment of the travelling salesman problem', where: 'Richard Bellman — JACM, 1962' },
        { title: 'Access path selection in a relational database management system', where: 'Selinger et al. — SIGMOD 1979' },
        { title: 'Hacker’s Delight, chapter 5', where: 'Henry Warren — population count and subset iteration' }
      ]
    },

    'digit-dp': {
      summary: 'Counting over a range too large to iterate by walking the bound’s digits instead, with ' +
        'the tight flag as the only subtle part — plus DP over an explicit DAG and automaton DP.',
      intuition: 'Walk the representation, not the values. The cost then depends on how many digits the ' +
        'bound has rather than on how large it is.',
      formulation: {
        equations: [
          {
            label: 'The state',
            expr: '(position, automaton state, tight, started)',
            terms: [
              { sym: 'tight', meaning: 'every digit so far equals the bound’s, so the next is capped' },
              { sym: 'memoisable', meaning: 'free states only — a tight state lies on exactly one path' },
              { sym: 'started', meaning: 'stops 007 and 7 being counted as different numbers' }
            ]
          },
          {
            label: 'Cost against value',
            expr: 'states = Θ(digits × |automaton| × 2), independent of the bound’s magnitude',
            terms: [
              { sym: 'up to 10³', meaning: '820 numbers, 25 states, 4 digits' },
              { sym: 'up to 10¹²', meaning: '317 733 228 541 numbers, 124 states, 13 digits' },
              { sym: 'up to 10¹⁸', meaning: '168 856 464 709 123 940 numbers, 190 states, 19 digits' }
            ]
          },
          {
            label: 'Inclusive ranges',
            expr: 'count(L, R) = count(0, R) − count(0, L − 1)',
            terms: [
              { sym: '137…4 321, no equal adjacent', meaning: '3 270 − 115 = 3 155, matching a one-by-one count' },
              { sym: 'the zero bug', meaning: 'a uniformly one-short prefix count still gives correct ranges' }
            ]
          },
          {
            label: 'DP over a DAG',
            expr: 'process nodes in topological order; each edge relaxes its target once',
            terms: [
              { sym: 'longest path', meaning: 'NP-hard on a general graph, Θ(V + E) on a DAG' },
              { sym: 'counting paths', meaning: 'the same sweep; report whether the counts stayed exact' },
              { sym: 'automaton DP', meaning: 'the same walk with the tight flag deleted — 7 290 four-digit strings' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The count matches a one-by-one enumeration on small ranges',
          why: 'The tight flag and the started flag both fail silently, and the enumeration is the only witness.',
          breaks: 'Dropping the number zero makes every prefix count one short while every range stays right.'
        },
        {
          name: 'Only free states are cached',
          why: 'A tight state is unique to the bound’s prefix; caching it across bounds would be wrong.',
          breaks: 'Memoising tight states makes a second call with a different bound return the first bound’s answer.'
        },
        {
          name: 'A path count reports whether it stayed exact',
          why: 'Past 2⁵³ the arithmetic rounds silently and the answer still looks reasonable.',
          breaks: 'A dense DAG returns approximately-right counts with no indication that they are approximate.'
        }
      ],
      complexity: [
        { operation: 'digit DP', average: 'Θ(digits × |automaton| × 10)', worst: '190 states for a bound of 10¹⁸' },
        { operation: 'brute-force counting', average: 'Θ(R − L)', worst: '4 185 values for a range digit DP answers in 45 states' },
        { operation: 'topological order', average: 'Θ(V + E)', worst: 'returns null on a cycle rather than a partial order' },
        { operation: 'longest path on a DAG', average: 'Θ(V + E)', worst: 'NP-hard the moment a cycle exists' },
        { operation: 'automaton DP over strings', average: 'Θ(length × |states| × |alphabet|)', worst: '7 290 four-digit strings from 4 rounds' }
      ],
      failureModes: [
        {
          symptom: 'The count is exactly one too small, and only for prefix queries.',
          cause: 'The number zero is dropped by a "started && accepting" termination.',
          fix: 'Ask the automaton about the single digit 0 on the all-zeros path; test prefixes, not only ranges.'
        },
        {
          symptom: 'The count includes numbers above the bound.',
          cause: 'The tight flag is not restricting the digit range.',
          fix: 'Cap the digit at bound[i] while tight, and release the cap only on a strictly smaller digit.'
        },
        {
          symptom: 'A second query with a different bound returns the first bound’s answer.',
          cause: 'Tight states were memoised, and they are specific to one bound.',
          fix: 'Cache only when not tight; there is at most one tight state per position anyway.'
        },
        {
          symptom: 'Path counts on a DAG are slightly wrong at large sizes.',
          cause: 'The counts exceeded 2⁵³ and the arithmetic rounded.',
          fix: 'Report an exactness flag, or count with BigInt when the graph is dense.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming and interview problems', how: 'the standard answer to "count the numbers in [L, R] with property P"' },
        { system: 'Compilers and static analysis', how: 'counting reachable values in a bounded integer range for range analysis' },
        { system: 'Build systems and schedulers', how: 'longest path over a DAG of tasks is the critical path' },
        { system: 'Regular-language tooling', how: 'counting accepted strings of a given length is a transfer-matrix power over a DFA' }
      ],
      sources: [
        { title: 'Concrete Mathematics, chapter 4', where: 'Graham, Knuth and Patashnik — digit-based counting arguments' },
        { title: 'Introduction to Automata Theory, Languages and Computation', where: 'Hopcroft, Motwani and Ullman — DFAs, revisited in M24' },
        { title: 'Introduction to Algorithms, section 24.2', where: 'Cormen et al. — shortest and longest paths in a DAG' },
        { title: 'Competitive Programmer’s Handbook, chapter 10', where: 'Antti Laaksonen — bit manipulation and digit counting' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
