/** Reference entries for the sweep and batch paradigm sections (M11.7-M11.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'two-pointers': {
      summary: 'One amortisation argument — each element enters once and leaves once — behind two pointers, ' +
        'sliding windows, monotonic deques and monotonic stacks, measured as totals rather than as rates.',
      intuition: 'The inner loop has no per-iteration bound and the whole sweep has a total. Count the total; ' +
        'a worst-case inner-loop length says nothing here.',
      formulation: {
        equations: [
          {
            label: 'The amortisation',
            expr: 'Σ pushes + Σ pops <= 2n, whatever the distribution of the inner loop',
            terms: [
              { sym: 'measured at n = 5 000, k = 50', meaning: 'random 9 994, ascending 9 999, descending 9 950, sawtooth 9 999' },
              { sym: 'per element', meaning: '1.99 to 2.00 across four deliberately different shapes' }
            ]
          },
          {
            label: 'The deque invariant',
            expr: 'indices i₁ < i₂ < … held with a[i₁] > a[i₂] > …; front expired, back dominated',
            terms: [
              { sym: 'the front', meaning: 'always the window maximum, so no scan is needed' },
              { sym: 'peak size', meaning: '1 on ascending input, 50 on descending — this is the memory, and it does move' }
            ]
          },
          {
            label: 'The monotonic stack',
            expr: 'non-decreasing heights; a smaller arrival settles every taller bar with its right boundary',
            terms: [
              { sym: '[2, 1, 5, 6, 2, 3]', meaning: 'largest rectangle 10, each bar popped exactly once' },
              { sym: '2 000 random bars', meaning: '4 000 stack operations against 2 001 000 for the quadratic scan' }
            ]
          },
          {
            label: 'The recognition test',
            expr: 'if the inner loop\'s start index is monotone in the outer index, it is a second cursor',
            terms: [
              { sym: 'passes', meaning: 'shortest subarray with sum >= k over non-negative values' },
              { sym: 'fails', meaning: 'the same question with negative values — the left pointer must go back' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Each index is pushed at most once',
          why: 'It is half of the 2n bound, and it fails silently if a branch pushes twice.',
          breaks: 'The sweep becomes quadratic on some shapes with no visible change in behaviour.'
        },
        {
          name: 'The deque is strictly monotone at all times',
          why: 'The front being the answer depends on it, and nothing checks the front.',
          breaks: 'A window maximum that is occasionally a non-maximum, on inputs with ties.'
        },
        {
          name: 'The pair search runs on sorted input',
          why: 'The inward-moving loop deduces the whole array\'s order from the two ends.',
          breaks: 'A confident "not found" for pairs that exist, at a rate that depends on the data.'
        }
      ],
      complexity: [
        { operation: 'window maximum by deque', average: 'Θ(n) — 1.99n operations measured', worst: '2n; peak memory Θ(k)' },
        { operation: 'window maximum by rescan', average: 'Θ(n·k) — 247 550 comparisons at n = 5 000, k = 50', worst: 'identical' },
        { operation: 'largest rectangle by monotonic stack', average: 'Θ(n) — 4 000 operations at n = 2 000', worst: '2n; peak stack Θ(n) on ascending input' },
        { operation: 'largest rectangle, quadratic', average: 'Θ(n²) — 2 001 000 at n = 2 000', worst: 'identical' },
        { operation: 'two-pointer pair search', average: 'Θ(n) after an Θ(n log n) sort', worst: 'Θ(n); silently wrong on unsorted input' }
      ],
      failureModes: [
        {
          symptom: 'A "linear" sweep is quadratic on one input shape.',
          cause: 'An index that can be pushed more than once, or a pointer that moves backwards.',
          fix: 'Count pushes and pops and assert the total against 2n in a test, on adversarial shapes.'
        },
        {
          symptom: 'The window maximum is wrong only when the data has ties.',
          cause: 'The domination test uses < where it needs <=, or the reverse.',
          fix: 'Check against a rescan on inputs with a small value range, where ties are frequent.'
        },
        {
          symptom: 'The largest-rectangle code has two nearly identical loops.',
          cause: 'The stack is drained after the main loop instead of by a sentinel.',
          fix: 'Append a value below every other and let the main loop finish the job.'
        },
        {
          symptom: 'A pair search returns "not found" for a pair that is present.',
          cause: 'The input is not sorted, and nothing in the algorithm checks.',
          fix: 'Assert sortedness in debug builds; the loop cannot detect it.'
        }
      ],
      inTheWild: [
        { system: 'Streaming aggregations with a fixed window', how: 'a monotonic deque per window is the standard maximum-over-window structure' },
        { system: 'Rate limiters and burst detectors', how: 'a sliding window with a shrink condition, in exactly this shape' },
        { system: 'Compiler and layout passes', how: 'monotonic stacks for nearest-smaller-element queries over sequences' },
        { system: 'Merge steps in database joins', how: 'two pointers over sorted runs, with the sortedness as the precondition' }
      ],
      sources: [
        { title: 'Competitive Programmer\'s Handbook, chapter 8', where: 'Antti Laaksonen — amortised analysis, two pointers and monotonic structures' },
        { title: 'Introduction to Algorithms, chapter 17', where: 'Cormen, Leiserson, Rivest, Stein — amortised analysis' },
        { title: 'Maintaining stream statistics over sliding windows', where: 'Datar, Gionis, Indyk and Motwani — SIAM Journal on Computing, 2002' },
        { title: 'Programming Pearls, column 8', where: 'Jon Bentley — the maximum-subarray sweep' }
      ]
    },

    'meet-in-the-middle': {
      summary: 'Halving an exponent by splitting the state and recombining with a search rather than a ' +
        'product, and the exponential memory that pays for it.',
      intuition: 'Nothing is learned about the problem and no branch is pruned. The saving is entirely in the ' +
        'shape: two exponentials of half the size, joined by a lookup.',
      formulation: {
        equations: [
          {
            label: 'The split',
            expr: '2^n becomes 2·2^(n/2) states plus 2^(n/2)·(n/2) to combine',
            terms: [
              { sym: 'n = 22', meaning: '4 096 states and 22 440 probes against 4 194 304 subsets' },
              { sym: 'n = 40', meaning: '2 097 152 states against 1.10 × 10¹²' },
              { sym: 'the ratio', meaning: 'doubles every two items — 32×, 128×, 512×, 1 024× at n = 12, 16, 20, 22' }
            ]
          },
          {
            label: 'The combine must be a search',
            expr: 'sort one half; for each element of the other, binary-search for the best partner',
            terms: [
              { sym: 'the trap', meaning: 'pairing all left with all right is 2^(n/2) × 2^(n/2) = 2^n again' },
              { sym: 'the precondition', meaning: 'the objective must decompose as f(left) ⊕ g(right) with ⊕ searchable' }
            ]
          },
          {
            label: 'The memory price',
            expr: 'peak Θ(2^(n/2)) entries; every two further items double it',
            terms: [
              { sym: 'n = 40', meaning: '2 097 152 partial sums resident' },
              { sym: 'n = 50', meaning: '67 108 864 — the practical ceiling, and it arrives as an allocation failure' }
            ]
          },
          {
            label: 'Bidirectional search',
            expr: 'b^d becomes b^(d/2) + b^(d/2)',
            terms: [
              { sym: 'b = 3, d = 8', meaning: '3 281 states forwards, 22 bidirectionally — 149×' },
              { sym: 'b = 4, d = 8', meaning: '21 846 against 32 — 683×' },
              { sym: 'both', meaning: 'return distance 8, which is the check on the meeting test' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every partial answer appears in exactly one half',
          why: 'The two enumerations must partition the items, or solutions are counted twice or missed.',
          breaks: 'A best sum that no subset actually achieves.'
        },
        {
          name: 'The searched half is sorted by the key the search uses',
          why: 'The lookup finds the best partner by monotonicity in the remaining room.',
          breaks: 'A partner that is feasible but not the best, so the answer is quietly sub-optimal.'
        },
        {
          name: 'The bidirectional meeting test runs as each node is generated',
          why: 'Testing between levels finds the intersection one level late.',
          breaks: 'A distance one too large on every odd-length shortest path.'
        }
      ],
      complexity: [
        { operation: 'subset sum, exhaustive', average: 'Θ(2^n) states', worst: '4 194 304 at n = 22; 1.10 × 10¹² at n = 40' },
        { operation: 'subset sum, meet in the middle', average: 'Θ(2^(n/2)·n) time, Θ(2^(n/2)) space', worst: 'identical — the split is data-independent' },
        { operation: 'breadth-first search', average: 'Θ(b^d) states, Θ(b^d) frontier', worst: '3 281 at b = 3, d = 8' },
        { operation: 'bidirectional search', average: 'Θ(b^(d/2)) states and frontier', worst: '22 at b = 3, d = 8; needs enumerable predecessors' }
      ],
      failureModes: [
        {
          symptom: 'The split made no difference to the running time.',
          cause: 'The halves are being recombined by pairing rather than by searching.',
          fix: 'Sort one side and binary-search it; if the objective does not allow that, the technique does not apply.'
        },
        {
          symptom: 'It works up to n = 44 and then dies with an allocation failure.',
          cause: 'The memory is Θ(2^(n/2)) and has reached the machine.',
          fix: 'This is the ceiling; report it as a supported range rather than discovering it in production.'
        },
        {
          symptom: 'Bidirectional search returns a path one edge longer than the shortest.',
          cause: 'The meeting test runs between levels rather than at generation time.',
          fix: 'Test each newly generated node against the other side\'s visited map immediately.'
        },
        {
          symptom: 'Bidirectional search is barely faster than forward search.',
          cause: 'Strict alternation on a graph with very different forward and backward branching.',
          fix: 'Expand whichever frontier is currently smaller.'
        }
      ],
      inTheWild: [
        { system: 'Cryptanalysis of double encryption', how: 'the meet-in-the-middle attack is why 2DES gives 57 bits rather than 112' },
        { system: 'Rubik\'s-cube and puzzle solvers', how: 'bidirectional search or pattern databases meeting in the middle' },
        { system: 'Route planning', how: 'bidirectional Dijkstra and contraction hierarchies, both built on this halving' },
        { system: 'Competitive programming', how: 'the standard answer to subset problems at n around 40' }
      ],
      sources: [
        { title: 'Computing partitions with applications to the knapsack problem', where: 'Horowitz and Sahni — JACM, 1974' },
        { title: 'Exhaustive cryptanalysis of the NBS Data Encryption Standard', where: 'Diffie and Hellman — Computer, 1977' },
        { title: 'Bi-directional search', where: 'Ira Pohl — Machine Intelligence 6, 1971' },
        { title: 'Artificial Intelligence: A Modern Approach, chapter 3', where: 'Russell and Norvig — bidirectional search and its preconditions' }
      ]
    },

    'offline-processing': {
      summary: 'Answering a batch of queries out of order: Mo\'s algorithm, the block size the ordering ' +
        'argument produces, and the question of whether an aggregate is decomposable at all.',
      intuition: 'An online structure must be ready for the worst order. Given the whole batch, the order is ' +
        'a free variable — and that freedom is sometimes worth a complexity class.',
      formulation: {
        equations: [
          {
            label: 'Mo\'s ordering',
            expr: 'sort queries by (⌊left / b⌋, right); two pointers walk to each in turn',
            terms: [
              { sym: 'left pointer', meaning: 'stays inside its block: at most b per query, so q·b' },
              { sym: 'right pointer', meaning: 'sweeps forward once per block: n per block, so n²/b' }
            ]
          },
          {
            label: 'The block size',
            expr: 'minimise q·b + n²/b at b = n/√q, giving 2n√q total',
            terms: [
              { sym: 'n = 4 000, q = 600', meaning: 'b = 163, measured 121 956 pointer moves' },
              { sym: 'the folklore √n', meaning: 'b = 63, measured 210 636 — 1.7× the minimum' },
              { sym: 'the shape', meaning: 'a broad minimum: b = 253 costs 109 260, within 12% either side' }
            ]
          },
          {
            label: 'Ordered against arrival order',
            expr: 'the same sweep, the same hooks, one sort in between',
            terms: [
              { sym: 'arrival order', meaning: '1 420 156 moves — 2 367 per query' },
              { sym: 'Mo\'s order', meaning: '121 956 — 203 per query, a factor of 11.6' },
              { sym: 'the bound', meaning: '(n + q)·√n = 290 930; the measurement is 42% of it' }
            ]
          },
          {
            label: 'Decomposability decides applicability',
            expr: 'f(A ∪ B) = f(A) ⊕ f(B) means a segment tree answers it online in log n',
            terms: [
              { sym: 'decomposable', meaning: 'sums, minima, gcds — reordering buys nothing' },
              { sym: 'not decomposable', meaning: 'distinct counts — no simple online structure, so the sweep is the answer' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The aggregate supports O(1) add and remove at either end',
          why: 'The sweep performs hundreds of thousands of them; anything slower dominates.',
          breaks: 'A "linear-ish" algorithm that is slower than the naive per-query scan.'
        },
        {
          name: 'Every answer is written back into its original slot',
          why: 'The sweep produces answers in block order, not query order.',
          breaks: 'Correct numbers attached to the wrong queries — plausible output, wrong everywhere.'
        },
        {
          name: 'The pointers move one element at a time',
          why: 'Each move corresponds to exactly one add or remove, which is what the counters measure.',
          breaks: 'A jump that skips elements leaves the aggregate describing a different range.'
        }
      ],
      complexity: [
        { operation: 'Mo\'s algorithm', average: 'O((n + q)·√n) pointer moves; 121 956 measured against a 290 930 bound', worst: 'the same, with the constant depending on the block size' },
        { operation: 'the same sweep in arrival order', average: 'O(n·q) — 1 420 156 moves here', worst: 'identical' },
        { operation: 'segment tree, online', average: 'O(log n) per query for a decomposable aggregate', worst: 'O(log n); not applicable to distinct counts' },
        { operation: 'prefix sums', average: 'O(n) build, O(1) per range sum', worst: 'identical — the right answer when it applies' },
        { operation: 'sqrt decomposition generally', average: 'O(√n) per operation', worst: 'the same balance, applied to updates rather than queries' }
      ],
      failureModes: [
        {
          symptom: 'The offline sweep is slower than answering each query directly.',
          cause: 'The add/remove hooks are not O(1) — usually a rebuild or a sort inside them.',
          fix: 'Check the incremental cost first; it is the real precondition, not offline-ness.'
        },
        {
          symptom: 'Answers are correct in aggregate and attached to the wrong queries.',
          cause: 'The original index was not carried through the sort.',
          fix: 'Sort a list of (index, left, right) triples and scatter the results at the end.'
        },
        {
          symptom: 'Mo\'s algorithm was implemented and a segment tree would have been ten lines.',
          cause: 'The aggregate was decomposable, so an online structure applied.',
          fix: 'Ask whether f(A ∪ B) follows from f(A) and f(B) before reaching for a sweep.'
        },
        {
          symptom: 'The block size was tuned repeatedly for small gains.',
          cause: 'The curve near the minimum is broad — being roughly right is worth nearly everything.',
          fix: 'Compute n/√q once and move on.'
        }
      ],
      inTheWild: [
        { system: 'Analytics batch jobs', how: 'reordering a day\'s queries to sweep the data once, rather than answering them as they arrived' },
        { system: 'Offline dynamic connectivity', how: 'the same idea over time blocks rather than over index blocks' },
        { system: 'Competitive programming', how: 'Mo\'s algorithm is the standard answer to non-decomposable range queries' },
        { system: 'Query planners with batched predicates', how: 'reordering scans so each partition is visited once' }
      ],
      sources: [
        { title: 'Competitive Programmer\'s Handbook, chapter 27', where: 'Antti Laaksonen — square-root algorithms and Mo\'s algorithm' },
        { title: 'An efficient algorithm for answering range queries offline', where: 'the technique is attributed to Mo Tao; see the Codeforces literature' },
        { title: 'Introduction to Algorithms, chapter 17', where: 'Cormen, Leiserson, Rivest, Stein — amortised analysis, which is the underlying argument' },
        { title: 'Algorithms on Strings, Trees and Sequences', where: 'Dan Gusfield — offline processing of batched queries, chapter 8' }
      ]
    }
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
