/** Worked examples for the heap sections (M05.1-M05.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'binary-heaps': [
      {
        title: 'Why the build is linear',
        goal: 'Do the sum-of-heights arithmetic that turns an apparent O(n log n) into O(n), and check it against a measured swap count.',
        setup: '100 000 elements, binary heap, Floyd build (sift down from the last parent to the root).',
        steps: [
          {
            do: 'Write down how many nodes sit at each height.',
            why: 'A complete tree is bottom-heavy, and that is the whole argument.',
            work: 'height 0 (leaves): ⌈n/2⌉ = 50 000\nheight 1: ⌈n/4⌉ = 25 000\n' +
              'height 2: 12 500 … height 15: 2, height 16: 1',
            result: 'half the nodes are leaves and can sink nowhere at all'
          },
          {
            do: 'Multiply each row by how far it can sink.',
            why: 'A node at height h sinks at most h levels, and the leaves contribute zero.',
            work: '0 × 50 000 = 0\n1 × 25 000 = 25 000\n2 × 12 500 = 25 000\n3 × 6 250 = 18 750 …',
            result: 'the rows peak early and then fall away'
          },
          {
            do: 'Sum the series.',
            why: 'Σ h·n/2^(h+1) is n·Σ h/2^(h+1), and that sum converges to 1.',
            work: 'tabulated total for n = 100 000: 100 058\nΣ h/2^(h+1) = 1, so the bound is n',
            result: 'the build is bounded by n swaps, not n log n'
          },
          {
            do: 'Measure the real thing against it.',
            why: 'The bound is an upper limit; the measurement says how close a real build gets.',
            work: 'Floyd build of 100 000 random elements: 74 217 swaps, 187 880 comparisons\n' +
              '0.74 swaps and 1.88 comparisons per element',
            result: 'comfortably inside the bound, and linear in n'
          },
          {
            do: 'Contrast with what the naive reading predicts.',
            why: 'To see how large the error would be.',
            work: 'n·log₂ n = 100 000 × 16.61 = 1 660 964\nmeasured: 187 880 comparisons',
            result: 'the naive figure is 8.8× the truth'
          }
        ],
        answer: 'The sum Σ h·⌈n/2^(h+1)⌉ tabulates to 100 058 for n = 100 000 — a constant times n — ' +
          'and a real build measures 74 217 swaps and 187 880 comparisons. The naive n log₂ n reading ' +
          'would predict 1 660 964, which is 8.8 times too high, because it charges every node for a ' +
          'descent that only the few nodes near the root can make.'
      },
      {
        title: 'When repeated insertion is just as good',
        goal: 'Find out how much the linear build actually buys, by measuring it against push-one-at-a-time on three input orders.',
        setup: 'The same 100 000 elements built both ways, on ascending, random and descending input.',
        steps: [
          {
            do: 'Try ascending input.',
            why: 'It is already heap-ordered for a min-heap, so nothing should sift.',
            work: 'build: 99 999 comparisons, 0 swaps\npush: 99 999 comparisons, 0 swaps',
            result: 'identical — 1.00 comparisons per element either way'
          },
          {
            do: 'Try random input.',
            why: 'The everyday case, and the one the textbook contrast is usually quoted about.',
            work: 'build: 187 880 comparisons (1.88 per element)\npush: 227 758 comparisons (2.28 per element)',
            result: 'the build wins by 21%, not by a factor'
          },
          {
            do: 'Try descending input.',
            why: 'Every inserted element is smaller than everything present, so every push sifts to the root.',
            work: 'build: 199 978 comparisons (2.00 per element)\npush: 1 468 787 comparisons (14.69 per element)',
            result: '7.3×, and this is the case the O(n log n) is about'
          },
          {
            do: 'Check the push figure against the height.',
            why: 'If every push really walks to the root, the per-element cost should be about log₂ n.',
            work: 'log₂ 100 000 = 16.61\nmeasured: 14.69 comparisons per element',
            result: 'close to the height, as a full sift-up should be'
          },
          {
            do: 'Draw the conclusion carefully.',
            why: 'The asymptotic claim is true and the everyday consequence is smaller than it sounds.',
            work: 'worst case: build O(n), push O(n log n) — a real factor\n' +
              'random input: 1.88 against 2.28 comparisons per element',
            result: 'use the build when you have the array; do not expect a factor unless the input is adversarial'
          }
        ],
        answer: 'The build beats repeated insertion by a factor of 7.3 on descending input, by 21% on ' +
          'random input, and not at all on ascending input. The asymptotic gap is real and it is a ' +
          'worst-case statement — which is worth knowing before quoting it as a reason to restructure ' +
          'code that builds heaps incrementally.'
      }
    ],

    'd-ary-heaps': [
      {
        title: 'Sweeping the arity',
        goal: 'Measure both costs across d and find where each one is minimised, rather than accepting d = 2.',
        setup: '50 000 balanced operations (half push, half pop), seed 6, replayed identically at each arity.',
        steps: [
          {
            do: 'Write down what each walk costs in terms of d.',
            why: 'The two directions scale differently, and that is the whole trade.',
            work: 'sift-up:   log_d n comparisons — falls as d rises\n' +
              'sift-down: d · log_d n — minimised at d = 3, rises after',
            result: 'one curve falls, the other has a minimum'
          },
          {
            do: 'Measure the comparisons.',
            why: 'To locate the minimum instead of deriving it.',
            work: 'd = 2: 366 125 · d = 3: 338 230 · d = 4: 355 873\nd = 8: 465 605 · d = 16: 602 679',
            result: 'a shallow U with its floor at d = 3'
          },
          {
            do: 'Measure the data movement.',
            why: 'Swaps are the other cost, and they do not have a minimum.',
            work: 'd = 2: 225 089 swaps · d = 4: 123 883 · d = 8: 87 789 · d = 16: 60 050',
            result: 'monotonically falling — a shallower tree means shorter sift paths'
          },
          {
            do: 'Add the workload that leans on sift-up.',
            why: 'Decrease-key never sifts down, so the minimum should move right.',
            work: 'decrease-key-heavy mix:\nd = 2: 385 548 · d = 4: 366 740 · d = 8: 453 924',
            result: 'the comparison minimum moves from d = 3 to d = 4'
          },
          {
            do: 'Bring in the argument the counters cannot see.',
            why: 'It is what decides the real choice.',
            work: 'a 64-byte line holds 16 four-byte keys\nd = 4 fetches all four children in one line\n' +
              'one miss ≈ 80 comparisons',
            result: 'd = 4 is the usual answer despite d = 3 winning on comparisons'
          }
        ],
        answer: 'Comparisons bottom out at d = 3 (338 230 against 366 125 at d = 2) and swaps fall ' +
          'monotonically to 60 050 at d = 16. On a decrease-key-heavy mix the comparison minimum ' +
          'moves to d = 4. Since a cache miss costs about eighty comparisons and four children fit in ' +
          'one line, d = 4 is the practical answer — chosen by the memory system rather than by the ' +
          'comparison count.'
      },
      {
        title: 'The arity that the workload picks',
        goal: 'Show that no single column chooses d, by finding a mix where the comparison-optimal arity is the wrong answer.',
        setup: 'The same replay harness at four mixes, comparing what each column would recommend.',
        steps: [
          {
            do: 'Ask what the comparison column recommends on a balanced mix.',
            why: 'It is the number people quote.',
            work: 'minimum at d = 3: 338 230 comparisons\nd = 2 costs 8% more, d = 8 costs 38% more',
            result: 'the curve is shallow between 2 and 4 and steep after 8'
          },
          {
            do: 'Ask what the swap column recommends.',
            why: 'It disagrees, and it never stops disagreeing.',
            work: 'swaps at d = 16: 60 050 against 225 089 at d = 2\nno minimum: more arity is always fewer swaps',
            result: 'the swap column recommends the largest d available'
          },
          {
            do: 'Note that both are counting the wrong thing.',
            why: 'Neither a comparison nor a swap is what a modern machine charges for.',
            work: 'a comparison of two integers: ~1 cycle\na cache miss: ~80 comparisons\n' +
              'levels touched: log_d n, and each level is a line',
            result: 'the cost that matters is levels, and it falls with d'
          },
          {
            do: 'Work out how many lines each arity touches.',
            why: 'This is the column neither counter has.',
            work: 'a million elements: d = 2 → 20 levels, d = 4 → 10, d = 16 → 5\n' +
              'children per line: d = 2 uses 2 of 16 slots, d = 16 uses all 16',
            result: 'd = 16 touches a quarter of the lines d = 2 does'
          },
          {
            do: 'Reconcile the three answers.',
            why: 'The practical setting has to satisfy all of them well enough.',
            work: 'comparisons say 3, swaps say 16, lines say 16\n' +
              'at d = 4 the comparison penalty is 5% and the line saving is half',
            result: 'd = 4 to 8, which is what production implementations use'
          }
        ],
        answer: 'The comparison column says d = 3, the swap column says d = 16, and the cache argument ' +
          'says as large as you can afford — so no single measurement picks the arity. At d = 4 the ' +
          'comparison penalty against the optimum is 5% and the tree is half as deep, which is why ' +
          'every production heap uses 4 or 8 and none of them uses 3.'
      }
    ],

    heapsort: [
      {
        title: 'What heapsort costs, and what it refuses to spend',
        goal: 'Put a number on heapsort\'s comparison constant, and on the two resources it does not use.',
        setup: '10 000 random elements, seed 8, sorted with a max-heap built in place.',
        steps: [
          {
            do: 'Count the comparisons.',
            why: 'The constant is what distinguishes heapsort from the other O(n log n) sorts.',
            work: 'measured: 235 305 comparisons\nn·log₂ n = 10 000 × 13.29 = 132 877',
            result: '1.77 × n·log₂ n'
          },
          {
            do: 'Account for the factor.',
            why: 'The classical sift-down asks two questions per level.',
            work: 'per level: one comparison to pick the better child, one to decide whether to stop\n' +
              'so about 2·n·log₂ n, less the levels that terminate early',
            result: '1.77 is exactly where the analysis puts it'
          },
          {
            do: 'Count the swaps.',
            why: 'Each one is a write, and each write is a jump.',
            work: 'measured: 114 155 swaps for 10 000 elements — 11.4 per element\n' +
              'each swap moves between indices i and 2i + 1',
            result: 'about log₂ n scattered writes per element'
          },
          {
            do: 'Note what is not spent.',
            why: 'This is the reason the algorithm survives.',
            work: 'auxiliary memory: 0 bytes\nrecursion depth: 0 frames\nworst case: Θ(n log n), always',
            result: 'in place, iterative and guaranteed — no other common sort is all three'
          },
          {
            do: 'Say where that combination is needed.',
            why: 'It is a fallback rather than a default, and the reason is precise.',
            work: 'introsort: quicksort until depth 2·log₂ n, then heapsort\n' +
              'the switch converts a possible Θ(n²) into a certain Θ(n log n)',
            result: 'the guarantee is the product, and the cache behaviour is the price'
          }
        ],
        answer: 'Heapsort does 235 305 comparisons on 10 000 elements — 1.77 × n·log₂ n — and 114 155 ' +
          'scattered swaps, using zero auxiliary memory and zero stack. That combination of guarantee ' +
          'and in-place operation is why introsort falls back to it, and the scattered writes are why ' +
          'it falls back rather than starts there.'
      },
      {
        title: 'Selection instead of sorting',
        goal: 'Price the top-k pattern against sorting the stream, and find where the saving actually is.',
        setup: 'A stream of 1 000 000 random values, k = 20, using a bounded max-heap of size k.',
        steps: [
          {
            do: 'Count what the gate costs.',
            why: 'Every element is compared once against the current k-th best, and most stop there.',
            work: 'gate comparisons: 999 980 — one per element after the heap fills',
            result: 'linear in the stream, and unavoidable'
          },
          {
            do: 'Count what got past it.',
            why: 'Only the survivors pay for a pop and a push.',
            work: 'elements admitted to the heap: 246 of 1 000 000\nheap comparisons: 1 997',
            result: '0.02% of the stream ever entered the structure'
          },
          {
            do: 'Total it and compare with sorting.',
            why: 'To see how much of the saving is in the comparisons.',
            work: 'top-k total: 1 001 977 comparisons\nsorting the stream: ≈ 19 931 569',
            result: '20× fewer comparisons'
          },
          {
            do: 'Compare the memory instead.',
            why: 'This is the figure that changes what is possible rather than what is fast.',
            work: 'top-k: 20 slots\nsorting: 1 000 000 slots',
            result: '50 000× less, and independent of the stream length'
          },
          {
            do: 'State why the memory figure is the important one.',
            why: 'A 20× speed-up is nice; a constant memory bound changes the shape of the program.',
            work: 'the stream is consumed one element at a time: 1 000 000 reads, 20 slots held\n' +
              'a 10⁹-element stream holds the same 20, and the answer is exact after every read',
            result: 'the same argument as the streaming section in M01.7'
          }
        ],
        answer: 'Top-20 of a million elements costs 1 001 977 comparisons and 20 slots, against about ' +
          '19.9 million comparisons and a million slots to sort — and only 246 elements ever entered ' +
          'the heap. The 20× on comparisons is worth having; the constant memory is what lets the ' +
          'stream be larger than RAM, which is the reason the pattern exists.'
      }
    ],

    'mergeable-heaps': [
      {
        title: 'The forest is a binary number',
        goal: 'Read a binomial heap as the binary representation of its size, and watch a merge carry.',
        setup: 'A binomial heap of 13 elements, and then a merge of a 3-element heap with a 1-element heap.',
        steps: [
          {
            do: 'Write the size in binary.',
            why: 'The forest holds one tree per set bit, and no order can repeat.',
            work: '13 = 1101₂\nso the forest is B₃ + B₂ + B₀',
            result: 'three trees holding 8 + 4 + 1 = 13 nodes'
          },
          {
            do: 'Check the tree sizes.',
            why: 'A binomial tree of order k holds exactly 2^k nodes — the structure is rigid.',
            work: 'B₃ = 8 nodes, height 3, root has children of order 2, 1, 0\n' +
              'B₂ = 4 nodes · B₀ = 1 node',
            result: 'the orders present are exactly the set bits'
          },
          {
            do: 'Merge a heap of 3 with a heap of 1.',
            why: 'This is binary addition, carries and all.',
            work: '011₂ + 001₂\nbit 0: B₀ + B₀ → carry a B₁\nbit 1: B₁ + B₁ + carry… → carry a B₂',
            result: '100₂ = 4, a single B₂'
          },
          {
            do: 'Bound the work.',
            why: 'The carry argument is the cost argument.',
            work: 'orders present: at most ⌊log₂ 100 000⌋ + 1 = 17\neach of the 17 orders carries at most once',
            result: 'O(log n) per merge, worst case'
          },
          {
            do: 'Check it at scale.',
            why: 'To confirm the reading holds for a real size.',
            work: '100 000 elements = 11000011010100000₂\nmeasured: 6 trees in the forest',
            result: 'six set bits, six trees'
          }
        ],
        answer: 'A binomial heap of 13 elements is 1101 in binary and holds a B₃, a B₂ and a B₀; a heap ' +
          'of 100 000 is 11000011010100000 and holds six trees. Merging is adding the two numbers, ' +
          'and a carry is two trees of the same order linking into one of the next — which is why ' +
          'the merge is O(log n) and why insertion is O(1) amortised.'
      },
      {
        title: 'What melding costs each family',
        goal: 'Fold sixteen heaps into one with every family, and find the one that cannot do it cheaply.',
        setup: '16 heaps of 1 000 elements each, melded pairwise into one and then drained, seed 3.',
        steps: [
          {
            do: 'Run the mergeable families.',
            why: 'All three have an O(log n) meld, so they should land close together.',
            work: 'leftist:  222 679 comparisons\nbinomial: 260 411\npairing:  256 286\nfibonacci: 268 497',
            result: 'a 21% spread across the four, as the shared bound suggests'
          },
          {
            do: 'Run the array heap on the same workload.',
            why: 'Its meld is a concatenate-and-rebuild, so it should be visibly worse.',
            work: 'binary heap: 513 212 comparisons',
            result: '2.3× the leftist heap, for the identical result'
          },
          {
            do: 'Explain the gap rather than quoting it.',
            why: 'The array heap is not slow; it is doing a different amount of work.',
            work: 'a mergeable meld walks two right spines: 11 nodes at 100 000 keys\n' +
              'an array meld concatenates and rebuilds: O(n + m), 15 times over a growing array',
            result: '15 melds of a growing array, each linear in what it holds'
          },
          {
            do: 'Compare the leftist and skew spines after 100 000 pushes.',
            why: 'The leftist field buys a worst-case bound; the question is what it costs.',
            work: 'leftist: right spine 11, bound 16, 74 344 child swaps\n' +
              'skew:    right spine 13, no bound at all, 1 071 593 child swaps',
            result: 'fourteen times the pointer writing, and a longer spine with nothing holding it'
          },
          {
            do: 'State when each is the right answer.',
            why: 'They are close enough that the decision is about code, not cost.',
            work: 'leftist: one integer per node, a worst-case bound, ~40 lines\n' +
              'skew: nothing per node, amortised, ~30 lines\n' +
              'binomial: more code, and the binary reading when you need it',
            result: 'and the array heap whenever you never meld at all'
          }
        ],
        answer: 'Folding 16 heaps of 1 000 elements costs the mergeable families 222 679 to 268 497 ' +
          'comparisons and the array heap 513 212 — because its meld is a rebuild rather than a walk. ' +
          'Between the mergeable families the difference is code rather than cost: the leftist field ' +
          'buys a worst-case bound for one integer per node, and the skew heap buys the same bound ' +
          'amortised for fourteen times the pointer writing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
