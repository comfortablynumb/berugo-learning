/** Reference blocks for the heap sections (M05.1-M05.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'binary-heaps': {
      summary: 'A complete tree stored implicitly in an array, keeping one rule — a parent outranks ' +
        'its children — which is exactly enough to answer "what is smallest" in constant time.',
      intuition: 'The array is the tree: index arithmetic replaces every pointer, so there is one ' +
        'allocation, perfect locality on a sift path, and nothing for an allocator to fragment.',
      formulation: {
        equations: [
          {
            label: 'The implicit layout',
            expr: 'children(i) = 2i + 1, 2i + 2 · parent(i) = ⌊(i − 1)/2⌋',
            terms: [
              { sym: '0-based', meaning: 'the form used here; textbooks use 1-based, where children are 2i and 2i + 1' }
            ]
          },
          {
            label: 'Heap order',
            expr: 'key(parent) ≤ key(child), for every node',
            terms: [
              { sym: 'weaker than search order', meaning: 'siblings are unordered, so has(key) is a linear scan' }
            ]
          },
          {
            label: 'Why the build is linear',
            expr: 'Σ_h h · ⌈n / 2^(h+1)⌉ < n',
            terms: [
              { sym: 'measured', meaning: '74 217 swaps to build 100 000 elements, against a tabulated 100 058' }
            ]
          }
        ],
        derivation: [
          'Half the nodes are leaves at height 0 and sink nowhere, a quarter are at height 1 and sink ' +
            'at most one level, and so on — so the total work is a geometric-weighted sum that ' +
            'converges to a constant times n.',
          'An insert sifts up and compares against one parent per level; an extract sifts down and ' +
            'compares against both children per level, which is why the two costs differ.',
          'Repeated insertion is O(n log n) only in the worst case: measured at n = 100 000 it costs ' +
            '14.69 comparisons per element on descending input and 2.28 on random input.'
        ]
      },
      invariants: [
        {
          name: 'The array is dense',
          why: 'The shape property is not maintained by code — it is a consequence of no holes.',
          breaks: 'Removing from the middle without moving the tail leaves a hole the index arithmetic cannot see.'
        },
        {
          name: 'Every parent outranks both children',
          why: 'It is what puts the minimum at index 0.',
          breaks: 'A sift that stops one level early leaves an element that will never be returned in the right order.'
        },
        {
          name: 'An extract fills the hole with the last element',
          why: 'Only the last element can be removed without breaking density.',
          breaks: 'Promoting a child instead leaves a gap and an invalid tree.'
        }
      ],
      complexity: [
        { operation: 'peek', average: 'Θ(1)', worst: 'Θ(1)', note: 'one array read' },
        { operation: 'push', average: 'Θ(1) amortised', worst: 'Θ(log n)', note: '1.6 levels of sift-up on average' },
        { operation: 'pop', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'the replacement almost always sinks fully' },
        { operation: 'build', average: 'Θ(n)', worst: 'Θ(n)', note: '1.88 comparisons per element measured' },
        { operation: 'has(key)', average: 'Θ(n)', worst: 'Θ(n)', note: 'a heap is not a set' },
        { operation: 'meld', average: 'Θ(n + m)', worst: 'Θ(n + m)', note: 'concatenate and rebuild — see M05.4' }
      ],
      failureModes: [
        {
          symptom: 'The heap returns elements out of order after a delete.',
          cause: 'An arbitrary element was removed by splicing the array rather than by sifting.',
          fix: 'Move the last element into the hole and sift it both ways — up if smaller, down if larger.'
        },
        {
          symptom: 'Pseudocode translated from a textbook is off by one everywhere.',
          cause: 'The source uses 1-based indexing, where the children of i are 2i and 2i + 1.',
          fix: 'Convert the parent and child formulas together, and assert the invariant in a test.'
        },
        {
          symptom: 'decrease-key is O(n) despite the documented bound.',
          cause: 'Finding the element is a linear scan without a position map — see M05.7.',
          fix: 'Use an indexed heap, or restructure to avoid decrease-key entirely.'
        },
        {
          symptom: 'A "priority queue" is used to test membership and the profile is flat.',
          cause: 'Heap order says nothing about where a given key is.',
          fix: 'Keep a separate set, or use an ordered structure from M04.'
        }
      ],
      inTheWild: [
        { system: 'std::priority_queue, Python heapq, Java PriorityQueue', how: 'all binary array heaps, all without decrease-key' },
        { system: 'Linux CFS bandwidth timers, epoll timeouts', how: 'array heaps where the timer count is small — see M05.8 for where they are not' },
        { system: 'Every scheduler with a run queue', how: 'the priority queue is the scheduler, and the array heap is the default' }
      ],
      sources: [
        { title: 'Williams — Algorithm 232: Heapsort (CACM 1964)', where: 'the original, with the implicit array layout' },
        { title: 'Floyd — Algorithm 245: Treesort 3 (CACM 1964)', where: 'the linear build' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 6', where: 'the standard treatment, with the sum-of-heights proof' },
        { title: 'Knuth — The Art of Computer Programming, vol. 3, §5.2.3', where: 'the analysis, including the sift-up distance distribution' }
      ]
    },

    'd-ary-heaps': {
      summary: 'The same implicit heap with d children per node: shallower, more comparisons per ' +
        'level going down, fewer going up — and d children in one cache line.',
      intuition: 'Widening the node trades comparisons for levels. Since a level is a cache line and ' +
        'a comparison is a cycle, the trade is almost always worth making up to d = 4 or 8.',
      formulation: {
        equations: [
          {
            label: 'The layout',
            expr: 'children(i) = d·i + 1 … d·i + d · parent(i) = ⌊(i − 1)/d⌋',
            terms: [
              { sym: 'contiguous children', meaning: 'which is what puts them in one cache line' }
            ]
          },
          {
            label: 'The two costs',
            expr: 'sift-up: log_d n · sift-down: d · log_d n',
            terms: [
              { sym: 'd · log_d n', meaning: 'minimised at d = 3, and shallow either side of it' },
              { sym: 'measured', meaning: 'comparisons 366 125 at d = 2, 338 230 at d = 3, 602 679 at d = 16' }
            ]
          },
          {
            label: 'The cache argument',
            expr: '64-byte line ÷ 4-byte key = 16 children per line',
            terms: [
              { sym: 'one miss', meaning: '≈ 80 comparisons, which is what buys the extra comparisons back' }
            ]
          }
        ],
        derivation: [
          'A sift-up compares against one parent per level, so its cost falls as log_d n; a sift-down ' +
            'must find the best of d children, so its cost is d·log_d n, which has a minimum at d = 3.',
          'Since a mix contains both walks, the total is a shallow U whose minimum moves right as the ' +
            'workload leans on decrease-key — measured at d = 4 for a decrease-key-heavy mix.',
          'Swaps fall monotonically with d, from 225 089 at d = 2 to 60 050 at d = 16 over the same ' +
            '50 000 operations, because the sift paths are shorter.'
        ]
      },
      invariants: [
        {
          name: 'Every node outranks all d of its children',
          why: 'The heap rule generalises unchanged; only the arity of the check changes.',
          breaks: 'A sift-down that compares against the first child rather than the best one.'
        },
        {
          name: 'The child range is clamped to the array end',
          why: 'The last node usually has fewer than d children.',
          breaks: 'Reading past the end returns undefined and silently wins every comparison.'
        }
      ],
      complexity: [
        { operation: 'push / decrease-key', average: 'Θ(log_d n)', worst: 'Θ(log_d n)', note: 'one comparison per level' },
        { operation: 'pop', average: 'Θ(d · log_d n)', worst: 'same', note: 'd comparisons per level' },
        { operation: 'build', average: 'Θ(n)', worst: 'Θ(n)', note: 'tabulated 11 130 units at d = 4, n = 100 000' },
        { operation: 'height', average: 'log_d n', worst: 'log_d n', note: '10 levels at d = 4 and a million elements' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'unchanged — still one slot per element' }
      ],
      failureModes: [
        {
          symptom: 'A 4-ary heap is no faster than the binary one.',
          cause: 'The child groups straddle cache lines, so the argument for the arity never applied.',
          fix: 'Pad the front of the array so each group of d children starts on a line boundary.'
        },
        {
          symptom: 'Raising d made a pop-heavy workload slower.',
          cause: 'Pops sift down, and that cost rises with d past 3.',
          fix: 'Count sift-ups against sift-downs in your mix before choosing.'
        },
        {
          symptom: 'The parent formula works for d = 2 and not for d = 4.',
          cause: '⌊i/2⌋ was generalised to ⌊i/d⌋ instead of ⌊(i − 1)/d⌋.',
          fix: 'Derive it from the child formula and assert it in a test at several arities.'
        },
        {
          symptom: 'The comparison count says d = 3, so d = 3 was shipped.',
          cause: 'Comparisons are not what the machine charges for.',
          fix: 'Measure time as well; 4 and 8 win despite doing more comparisons.'
        }
      ],
      inTheWild: [
        { system: 'Dijkstra implementations in competitive and production code', how: 'd = 4 is the common choice, because relaxations sift up' },
        { system: 'LEDA and boost::heap', how: 'both expose the arity as a template parameter' },
        { system: 'External-memory priority queues', how: 'the arity is set from the page size, exactly as B-tree order is in M04.7' }
      ],
      sources: [
        { title: 'Johnson — Priority queues with update and finding minimum spanning trees (1975)', where: 'the d-ary heap and its analysis' },
        { title: 'LaMarca, Ladner — The influence of caches on the performance of heaps (1996)', where: 'the cache argument, measured' },
        { title: 'Naor, Martel, Matloff — Performance of priority queue structures in a virtual memory environment (1991)', where: 'arity against paging' },
        { title: 'Cormen et al. — Introduction to Algorithms, problem 6-2', where: 'the d-ary generalisation as an exercise' }
      ]
    },

    heapsort: {
      summary: 'Selection sort with a heap doing the selecting: O(n log n) guaranteed, in place, ' +
        'iterative — and with an access pattern that misses cache on nearly every step.',
      intuition: 'Build a max-heap over the array, then swap the root to the end n − 1 times. The ' +
        'array partitions itself into a shrinking heap and a growing sorted suffix.',
      formulation: {
        equations: [
          {
            label: 'The loop',
            expr: 'build, then for i = n−1 … 1: swap(0, i), size−1, siftDown(0)',
            terms: [
              { sym: 'max-heap', meaning: 'so the largest lands at the end and the result is ascending' }
            ]
          },
          {
            label: 'The comparison count',
            expr: '≈ 2·n·log₂ n classically, ≈ n·log₂ n bottom-up',
            terms: [
              { sym: 'measured', meaning: '235 305 at n = 10 000, which is 1.77 × n·log₂ n' }
            ]
          },
          {
            label: 'Top-k',
            expr: 'O(n log k) time, O(k) space',
            terms: [
              { sym: 'measured', meaning: '1 001 977 comparisons and 20 slots for k = 20 over 10⁶ elements' }
            ]
          }
        ],
        derivation: [
          'The classical sift-down does two comparisons per level — one to pick the better child and ' +
            'one to decide whether to stop — which is where the factor of two comes from.',
          'Bottom-up heapsort descends to a leaf picking the better child, then walks back up to place ' +
            'the element, removing the second comparison and halving the total.',
          'Top-k costs one gate comparison per element plus a pop and push for each survivor: over a ' +
            'million elements with k = 20, only 246 elements were ever admitted.'
        ]
      },
      invariants: [
        {
          name: 'The prefix is a heap and the suffix is sorted',
          why: 'It is the loop invariant, and it is what makes the sort in place.',
          breaks: 'Sifting over the whole array rather than the shrinking prefix undoes the sorted suffix.'
        },
        {
          name: 'The suffix elements are in their final positions',
          why: 'Each extracted maximum is larger than everything left in the heap.',
          breaks: 'Using a min-heap and forgetting to reverse produces a descending array.'
        },
        {
          name: 'A bounded top-k heap never exceeds k elements',
          why: 'It is the entire memory guarantee.',
          breaks: 'Pushing before popping momentarily holds k + 1, which matters when k is the memory budget.'
        }
      ],
      complexity: [
        { operation: 'heapsort', average: 'Θ(n log n)', worst: 'Θ(n log n)', note: '1.77 × n·log₂ n comparisons measured' },
        { operation: 'extra memory', average: 'Θ(1)', worst: 'Θ(1)', note: 'no auxiliary array, no recursion' },
        { operation: 'stability', average: '—', worst: '—', note: 'not stable; the sift moves equal keys past each other' },
        { operation: 'top-k, streaming', average: 'Θ(n log k)', worst: 'Θ(n log k)', note: 'one gate comparison per element' },
        { operation: 'top-k memory', average: 'Θ(k)', worst: 'Θ(k)', note: 'independent of the stream length' }
      ],
      failureModes: [
        {
          symptom: 'Records that tie on the sort key come out in a different order each run.',
          cause: 'Heapsort is not stable, and nothing local can make it so.',
          fix: 'Extend the key with the original index, or use a stable sort.'
        },
        {
          symptom: 'Heapsort is slower than quicksort on every input tried.',
          cause: 'It is, on cache grounds; it is chosen for the guarantee, not the average.',
          fix: 'Use it as a fallback past a recursion-depth limit, which is what introsort does.'
        },
        {
          symptom: 'Top-k returns k elements that are not the k smallest.',
          cause: 'A min-heap was used where a max-heap is needed — the gate must compare against the worst kept element.',
          fix: 'Keep a max-heap of the k best and evict its root.'
        },
        {
          symptom: 'A "give me the top 10" query sorts a million rows.',
          cause: 'Sorting to take a prefix does n log n work for an n log k question.',
          fix: 'Bounded heap, or quickselect if the k results need no order among themselves.'
        }
      ],
      inTheWild: [
        { system: 'std::sort (introsort)', how: 'quicksort until the depth limit, then heapsort, then insertion sort' },
        { system: 'SQL ORDER BY … LIMIT k', how: 'a bounded top-k heap in any competent planner, not a sort' },
        { system: 'Log analysis and monitoring', how: 'top-k over a stream is the canonical bounded-memory query' }
      ],
      sources: [
        { title: 'Williams — Algorithm 232: Heapsort (CACM 1964)', where: 'the original algorithm' },
        { title: 'Wegener — Bottom-up heapsort (1993)', where: 'the variant that halves the comparisons' },
        { title: 'Musser — Introspective sorting and selection algorithms (1997)', where: 'introsort, and why heapsort is the fallback' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 6 and 9', where: 'heapsort, and selection without sorting' }
      ]
    },

    'mergeable-heaps': {
      summary: 'Three families built on one primitive — meld — which is the operation an array heap ' +
        'cannot perform in less than linear time.',
      intuition: 'Make merging the only structural operation and everything else follows: insert melds ' +
        'a singleton, pop melds the root\'s children. A binomial heap does the same thing arithmetically.',
      formulation: {
        equations: [
          {
            label: 'Everything from meld',
            expr: 'insert = meld(h, singleton) · pop = meld(root.left, root.right)',
            terms: [
              { sym: 'leftist', meaning: 'meld walks the two right spines, each ≤ log₂(n + 1) long' }
            ]
          },
          {
            label: 'Null-path length',
            expr: 'npl(node) = 1 + min(npl(left), npl(right)); npl(left) ≥ npl(right)',
            terms: [
              { sym: 'measured', meaning: 'a 100 000-element leftist heap had a right spine of 13, bound 16' }
            ]
          },
          {
            label: 'The binomial forest',
            expr: 'n = Σ 2^k over the tree orders present',
            terms: [
              { sym: '13 = 1101₂', meaning: 'a B₃, a B₂ and a B₀' },
              { sym: 'merge', meaning: 'binary addition; a carry is two equal-order trees linking' }
            ]
          }
        ],
        derivation: [
          'The leftist rule forces short paths to the right, so the right spine is the shortest ' +
            'root-to-null path and has length at most log₂(n + 1) — and meld only walks right spines.',
          'A skew heap drops the field and swaps children unconditionally, getting the same bound ' +
            'amortised at the cost of 14× the pointer writing (1 044 536 swaps against 74 364).',
          'A binomial tree of order k holds 2^k nodes, so the orders present are the set bits of n, ' +
            'and there are at most log₂ n of them — which bounds the merge.'
        ]
      },
      invariants: [
        {
          name: 'Heap order holds in every tree',
          why: 'It is what makes the root of each tree a candidate minimum.',
          breaks: 'A link that attaches the smaller root under the larger.'
        },
        {
          name: 'Leftist: npl(left) ≥ npl(right) at every node',
          why: 'It is what bounds the right spine, and therefore the meld.',
          breaks: 'Forgetting the swap after a meld lets the right spine grow to n.'
        },
        {
          name: 'Binomial: no two trees share an order, and order k holds 2^k nodes',
          why: 'It is the binary representation, and the merge depends on it.',
          breaks: 'A missed carry leaves two trees of the same order and the size no longer reads in binary.'
        }
      ],
      complexity: [
        { operation: 'meld (leftist)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'walks two right spines' },
        { operation: 'meld (skew)', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'no field, no worst-case bound' },
        { operation: 'meld (binomial)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'binary addition with carries' },
        { operation: 'meld (array heap)', average: 'Θ(n + m)', worst: 'Θ(n + m)', note: '513 212 comparisons against leftist\'s 222 679' },
        { operation: 'insert (binomial)', average: 'Θ(1) amortised', worst: 'Θ(log n)', note: 'the binary-counter argument from M01.3' },
        { operation: 'pop', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'meld the children, or merge the released subtrees' }
      ],
      failureModes: [
        {
          symptom: 'A meld leaves the source heap holding stale nodes.',
          cause: 'The size was read after the source was detached, so the merged count is short.',
          fix: 'Read the incoming size before detaching — this platform shipped that bug first.'
        },
        {
          symptom: 'A leftist heap degenerates into a list.',
          cause: 'The null-path lengths were computed but the children were never swapped.',
          fix: 'Swap when npl(left) < npl(right), and assert the right-spine bound in tests.'
        },
        {
          symptom: 'A binomial heap loses elements after a pop.',
          cause: 'The released subtrees were not merged back into the forest.',
          fix: 'Add each child as a tree of its own order; check that the orders still spell the size.'
        },
        {
          symptom: 'Meld produces a valid heap with duplicate keys missing.',
          cause: 'The two heaps shared node objects, so one splice detached the other.',
          fix: 'Meld consumes the source; clear it, and never reuse a melded heap.'
        }
      ],
      inTheWild: [
        { system: 'Kruskal and Borůvka MST variants', how: 'Borůvka melds per-component heaps in a loop, which is what the bound is for' },
        { system: 'Discrete-event simulators with sub-model merging', how: 'melding event queues when models compose' },
        { system: 'Functional priority queues (Okasaki)', how: 'leftist and binomial heaps are the standard persistent implementations' }
      ],
      sources: [
        { title: 'Crane — Linear lists and priority queues as balanced binary trees (1972)', where: 'leftist heaps' },
        { title: 'Sleator, Tarjan — Self-adjusting heaps (1986)', where: 'skew heaps and their amortised analysis' },
        { title: 'Vuillemin — A data structure for manipulating priority queues (CACM 1978)', where: 'binomial heaps, and the binary reading' },
        { title: 'Okasaki — Purely Functional Data Structures, ch. 3', where: 'both families, persistent' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
