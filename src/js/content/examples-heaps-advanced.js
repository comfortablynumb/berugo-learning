/** Worked examples for the amortised and systems heap sections (M05.5-M05.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'fibonacci-heaps': [
      {
        title: 'The two rankings, on one Dijkstra run',
        goal: 'Measure operation counts and wall clock for four priority queues on identical work, and see which theory each column supports.',
        setup: 'Dijkstra from one corner of a 150 × 150 weighted grid — 22 500 nodes, 89 400 directed ' +
          'edges, seed 5. Every queue computes identical distances.',
        steps: [
          {
            do: 'Count the comparisons.',
            why: 'This is the column the amortised bounds are about.',
            work: 'fibonacci: 258 493\npairing:   278 257\nbinary:    336 961\n4-ary:     363 106',
            result: 'the Fibonacci heap wins, exactly as the bounds predict'
          },
          {
            do: 'Check that the decrease-key traffic is what the theory assumes.',
            why: 'The Fibonacci advantage is supposed to come from decrease-key being free.',
            work: '7 065 decrease-key calls out of 22 500 settled nodes\n' +
              'fibonacci: 2 702 cuts, of which 31 cascaded',
            result: 'about a third of the relaxations improved an existing entry'
          },
          {
            do: 'Time the same runs.',
            why: 'Because the comparison count is not what the machine charges for.',
            work: 'median of 5 runs each\nthe Fibonacci heap is the slowest of the four\n' +
              'the binary and pairing heaps finish first',
            result: 'the ranking inverts'
          },
          {
            do: 'Account for the inversion.',
            why: 'A gap this large has a cause worth naming.',
            work: 'a Fibonacci node holds 6 fields — parent, child, left, right, degree, mark\n' +
              'every traversal is a dependent load into scattered memory\n' +
              'every pop walks a 20-slot degree array to consolidate 6 roots',
            result: 'the work per comparison is far higher than in an array heap'
          },
          {
            do: 'Confirm the structural bound anyway.',
            why: 'The theory is not wrong; it is answering a different question.',
            work: 'a 20 000-node heap after 4 000 pops: maximum degree 13\n' +
              'the log_φ bound at the surviving 16 000 nodes is 20',
            result: 'degree 13 against a bound of 20, as the cascade guarantees'
          }
        ],
        answer: 'On the same 22 500-node Dijkstra the Fibonacci heap does the fewest comparisons ' +
          '(258 493 against the binary heap\'s 336 961) and takes the longest. Both facts are real: ' +
          'the bounds are about comparisons and the machine charges for pointer chases, and showing ' +
          'the two columns together is more persuasive than either alone.'
      },
      {
        title: 'The bound that is not the point',
        goal: 'Separate the three Fibonacci bounds and find the one no competitor matches — which is not decrease-key.',
        setup: 'The same measurements, read against what each family offers for each operation.',
        steps: [
          {
            do: 'Take decrease-key first, since it is the famous one.',
            why: 'O(1) amortised against O(log n) sounds decisive.',
            work: 'fibonacci: 258 493 comparisons on the Dijkstra run\n' +
              'pairing:   278 257 — 8% more, with no bound at all on decrease-key\n' +
              'and the pairing heap finishes faster',
            result: 'the bound is real and the advantage is 8% of a column that does not decide the race'
          },
          {
            do: 'Take insert.',
            why: 'O(1) against O(log n) is the other headline.',
            work: 'an array-heap push appends and sifts up 1.6 levels on average\n' +
              'a Fibonacci insert allocates a node and splices a circular list',
            result: 'the O(log n) operation is cheaper than the O(1) one'
          },
          {
            do: 'Take meld.',
            why: 'This is the one nobody else can match.',
            work: 'fibonacci: splice two circular lists — 4 pointer writes, 1 comparison, any size\n' +
              'leftist / binomial: O(log n)\narray heap: O(n + m)',
            result: 'genuinely constant, and genuinely unmatched'
          },
          {
            do: 'Ask when that matters.',
            why: 'A bound is only worth its constants if the operation is on the hot path.',
            work: 'algorithms that meld in a loop: some MST variants, agglomerative clustering\n' +
              'Dijkstra on the 150×150 grid: 22 500 pushes, 7 029 decrease-keys, 0 melds',
            result: 'the demo workload never uses the one operation the structure is best at'
          },
          {
            do: 'State the reading that survives.',
            why: 'So the structure is judged on what it actually offers.',
            work: 'Fredman and Tarjan wanted O(E + V log V) for Dijkstra, and got it\n' +
              'here 89 400 + 22 500 × 14.46 ≈ 414 700, and its 258 493 comparisons are the lowest of the four',
            result: 'an existence result first, an implementation second'
          }
        ],
        answer: 'The Fibonacci heap\'s decrease-key advantage is 8% of a comparison count that does ' +
          'not decide the wall clock, and its O(1) insert is slower than an array heap\'s O(log n) ' +
          'one. The bound that no competitor matches is meld — four pointer writes at any size — and ' +
          'Dijkstra, the workload it is famous for, never melds at all.'
      }
    ],

    'pairing-heaps': [
      {
        title: 'What the pairing pass is worth',
        goal: 'Measure the two-pass merge against the same structure with the pairing pass removed — the only honest control.',
        setup: '30 000 balanced operations, seed 11, replayed against a two-pass pairing heap and a ' +
          'one-pass variant that folds the children left to right.',
        steps: [
          {
            do: 'Count the links each version does on a single pop.',
            why: 'If the counts differ, the comparison is about work rather than shape.',
            work: 'eight orphaned children:\ntwo-pass: 4 links pairing + 3 links folding = 7\n' +
              'one-pass: 7 links',
            result: 'identical — the difference is not in the count'
          },
          {
            do: 'Look at what each leaves behind.',
            why: 'The next pop has to walk it.',
            work: 'two-pass: a tree about 3 levels deep\n' +
              'one-pass: link(link(link(…))) — a spine 7 deep',
            result: 'the same links, arranged into a tree or into a path'
          },
          {
            do: 'Replay 30 000 operations through both.',
            why: 'To let the shape difference accumulate.',
            work: 'two-pass: 46 189 comparisons\none-pass: 55 856 comparisons',
            result: '9 667 comparisons more, which is 17.3% of the one-pass count'
          },
          {
            do: 'Note what the asymptotics say about it.',
            why: 'The measured 17% understates the difference the analysis predicts.',
            work: 'two-pass: O(log n) amortised, proved — 46 189 over 30 000 operations, 1.54 each\n' +
              'one-pass: no useful bound — adversarial sequences give Θ(n) per operation',
            result: 'a shallow measured gap and an unbounded worst case'
          },
          {
            do: 'Say why the demo keeps the broken version.',
            why: 'A control is the only way to attribute the difference to the pairing pass.',
            work: 'comparing against a Fibonacci heap confounds the pairing pass with 5 other differences\n' +
              'comparing against itself-minus-pairing isolates it: 55 856 − 46 189 = 9 667',
            result: 'the 17.3% is the pairing pass, and nothing else'
          }
        ],
        answer: 'Both merges do the same seven links on eight children; only the shape differs, and ' +
          'over 30 000 operations that shape saves 17.3% (46 189 comparisons against 55 856). The ' +
          'asymptotic difference is larger than the measurement: the two-pass version has a proved ' +
          'O(log n) amortised bound and the one-pass version has no useful bound at all.'
      },
      {
        title: 'Simpler, and faster, than the structure it imitates',
        goal: 'Compare the pairing heap against the Fibonacci heap on the workload the latter was designed for.',
        setup: 'A decrease-key-heavy mix of 20 000 operations, and the 22 500-node Dijkstra from M05.5.',
        steps: [
          {
            do: 'Compare what a node costs.',
            why: 'Memory per node is paid on every element, always.',
            work: 'pairing:   key, child, next, prev — 4 fields\n' +
              'fibonacci: key, parent, child, left, right, degree, mark — 7',
            result: 'nearly half the memory, and half the pointers to chase'
          },
          {
            do: 'Compare what decrease-key does.',
            why: 'This is the operation the Fibonacci heap has a better bound for.',
            work: 'pairing:   splice out, link at the root — 11 923 cuts, no cascades\n' +
              'fibonacci: cut, check the mark, maybe cascade — 7 029 cuts and 1 569 cascades',
            result: 'the pairing heap cuts more often and does less per cut'
          },
          {
            do: 'Measure the mix.',
            why: 'The bound says the Fibonacci heap should win.',
            work: 'pairing:   93 946 comparisons\nfibonacci: 106 945 comparisons',
            result: 'the pairing heap wins by 12%, against the bound'
          },
          {
            do: 'Measure the Dijkstra run.',
            why: 'A second workload, to check the first was not a fluke of the mix.',
            work: 'fibonacci: 258 493 comparisons, slowest of the four queues\n' +
              'pairing:   278 257 comparisons, and faster in wall clock',
            result: 'the Fibonacci heap wins the count and loses the clock'
          },
          {
            do: 'Read the empirical literature the same way.',
            why: 'This result is not new, and citing it is more useful than re-deriving it.',
            work: 'Larkin, Sen and Tarjan (2014) measured the whole family\n' +
              'boost::heap and LEDA both ship pairing heaps',
            result: 'the simple structures win on the workloads people run'
          }
        ],
        answer: 'A pairing-heap node carries four fields against the Fibonacci heap\'s seven, has no ' +
          'consolidation and no mark bit, and beat it by 12% on the decrease-key-heavy mix it was ' +
          'supposed to lose. That is why boost and LEDA ship pairing heaps, and why "we used a ' +
          'Fibonacci heap" is usually a decision worth revisiting.'
      }
    ],

    'indexed-priority-queues': [
      {
        title: 'decrease-key against duplicate insertion',
        goal: 'Run the same Dijkstra twice — once with a handle map and a real decrease-key, once with ' +
          'duplicates and a stale check — and price both.',
        setup: 'The 150 × 150 grid again: 22 500 nodes, 89 400 directed edges, seed 5, binary heap in both.',
        steps: [
          {
            do: 'Count the pushes.',
            why: 'This is the structural difference between the two strategies.',
            work: 'indexed: 22 500 — exactly one per node\n' +
              'lazy:    29 573 — one per improvement',
            result: '31% more entries, all of which have to be popped'
          },
          {
            do: 'Count what the lazy version throws away.',
            why: 'A stale pop is work the indexed version never does.',
            work: 'stale pops: 7 073 of 29 573 — 24% of the queue traffic',
            result: 'a quarter of the pops produce nothing'
          },
          {
            do: 'Compare the peak queue size.',
            why: 'This is the memory the choice actually costs.',
            work: 'indexed: 291 entries at peak\nlazy:    398 entries at peak',
            result: '37% larger, and bounded by E rather than by V'
          },
          {
            do: 'Compare the comparisons.',
            why: 'More entries mean deeper sifts.',
            work: 'indexed: 336 961 comparisons\nlazy:    444 333 comparisons',
            result: '32% more'
          },
          {
            do: 'Time them.',
            why: 'Every counter favours the indexed version, so the clock is the interesting column.',
            work: 'median of 5 runs each: the lazy version finishes first\n' +
              'it never touches a handle map, and its heap is a plain array',
            result: 'more of everything counted, and still faster'
          }
        ],
        answer: 'Lazy insertion does 31% more pushes, 32% more comparisons and holds a 37% larger ' +
          'queue — and finishes first, because it has no handle map to maintain. The counters and the ' +
          'clock disagree again, and the honest reason to prefer the indexed version is not speed but ' +
          'the queue bound: V entries instead of E.'
      },
      {
        title: 'The bound that lazy insertion gives up',
        goal: 'Find where the simpler strategy stops being the right one, by looking at what grows.',
        setup: 'The same two strategies, read against graph density rather than against the clock.',
        steps: [
          {
            do: 'Write down what bounds each queue.',
            why: 'The two bounds are different quantities, not different constants.',
            work: 'indexed: at most one entry per node — |V| = 22 500\n' +
              'lazy: one entry per improvement — up to |E| = 89 400',
            result: 'on a sparse graph these are close; on a dense one they are not'
          },
          {
            do: 'Put numbers on the demo graph.',
            why: 'A grid is sparse — about four edges per node.',
            work: 'V = 22 500, E = 89 400, E/V = 3.97\n' +
              'measured peak: 291 against 398',
            result: 'a 37% difference on a graph with four edges per node'
          },
          {
            do: 'Extrapolate to a dense graph.',
            why: 'This is where the difference stops being a percentage.',
            work: 'a complete graph on 22 500 nodes has E ≈ 2.5 × 10⁸\n' +
              'indexed peak stays ≤ 22 500; lazy peak is bounded only by E',
            result: 'four orders of magnitude, on the same algorithm'
          },
          {
            do: 'Note what fails, and how.',
            why: 'The failure is not slow — it is out of memory, in production, at a size nobody tested.',
            work: 'nothing in the algorithm inspects the queue size — the lazy run peaked at 398 unwatched\n' +
              'the stale check discards entries only after they are popped: 7 073 of 29 573',
            result: 'the growth is invisible until the allocator complains'
          },
          {
            do: 'State the rule that follows.',
            why: 'So the choice is made on the property that actually differs.',
            work: 'sparse grid, 3.97 edges per node: peaks of 398 against 291 — take the simpler code\n' +
              'dense or adversarial or memory-bounded: pay for the handle map\n' +
              'either way: instrument the peak queue size, the 1 number the choice turns on',
            result: 'the peak queue size is the number the decision turns on'
          }
        ],
        answer: 'On a sparse grid the lazy queue peaks 37% higher than the indexed one — a difference ' +
          'worth trading for simpler code. On a dense graph the same strategy is bounded by |E| ' +
          'rather than |V|, which is four orders of magnitude on the same node count, and nothing in ' +
          'the algorithm notices. Instrument the peak queue size; it is the number that decides.'
      }
    ],

    'timers-and-events': [
      {
        title: 'Why kernels do not use a heap for timers',
        goal: 'Price 100 000 timers with heavy cancellation against a heap and against two wheels.',
        setup: '100 000 timers with delays up to 5 000 ticks, half of them cancelled, run for 5 000 ' +
          'ticks, seed 3.',
        steps: [
          {
            do: 'Count what the heap spends.',
            why: 'Every insert and every expiry is a sift.',
            work: 'binary heap: 3 059 516 comparisons over the run\n' +
              'about 20 entries examined per tick',
            result: 'three million comparisons to fire 60 619 timers'
          },
          {
            do: 'Count what a flat wheel spends.',
            why: 'A bucket index is arithmetic, not a search.',
            work: 'wheel, 1 × 4 096 slots: 0 comparisons\n' +
              '22.19 entries examined per tick',
            result: 'a tenth more entry touches than the heap, and no comparisons at all'
          },
          {
            do: 'Add a level.',
            why: 'A hierarchy shortens the bucket walk at the cost of cascades.',
            work: 'wheel, 2 × 64 slots: 12.22 entries per tick\n' +
              '108 932 entries cascaded down a level over the run',
            result: '45% fewer touches per tick, paid for in cascades'
          },
          {
            do: 'Check they agree.',
            why: 'A cheaper structure that fires the wrong timers is not cheaper.',
            work: 'all three fired the same 60 619 timers, in the same ticks',
            result: 'identical behaviour, three costs'
          },
          {
            do: 'Name what was traded away.',
            why: 'The wheel is not free; it is paid for in precision.',
            work: 'the wheel cannot distinguish two timers due in the same tick\n' +
              'a 1 ms tick is far finer than any network timeout needs',
            result: 'bounded precision, which is exactly what a timeout can afford'
          }
        ],
        answer: 'Firing the same 60 619 timers costs a binary heap 3 059 516 comparisons and a timing ' +
          'wheel none at all, because filing by due tick turns a search into an array index. The ' +
          'hierarchical wheel cuts the per-tick walk by a further 45%. What the wheel gives up is ' +
          'precision below one tick — the one thing a timeout does not need.'
      },
      {
        title: 'A simulator that checks itself',
        goal: 'Run an M/M/1 queue through the event kernel and confirm it against the closed form and against Little\'s law.',
        setup: 'Exponential arrivals at rate λ, exponential service at rate μ = 1, one server, 200 000 ' +
          'time units, driven by a binary heap as the clock.',
        steps: [
          {
            do: 'Simulate at three utilisations and measure the queue length.',
            why: 'L = ρ/(1 − ρ) is the closed form, and it is a strong check.',
            work: 'ρ = 0.5: measured L = 1.002, predicted 1.000\n' +
              'ρ = 0.8: 3.968 against 4.000\nρ = 0.9: 9.025 against 9.000',
            result: 'within 1% at every utilisation'
          },
          {
            do: 'Measure the time in the system.',
            why: 'W = 1/(μ − λ) is the second closed form, measured independently.',
            work: 'ρ = 0.5: 2.008 against 2.000\nρ = 0.8: 4.958 against 5.000\n' +
              'ρ = 0.9: 10.028 against 10.000',
            result: 'the same agreement, from a different measurement'
          },
          {
            do: 'Check Little\'s law across the two.',
            why: 'L and W were measured separately, so L = λ·W is a real constraint.',
            work: 'L ÷ (λ · W) at ρ = 0.5, 0.8 and 0.9',
            result: '1.0000 at all three — the law needs no assumptions and gets none'
          },
          {
            do: 'Note the shape of the growth.',
            why: 'It is the same 1/(1 − ρ) wall M02.5 measured from the queueing side.',
            work: 'ρ = 0.5 → L ≈ 1\nρ = 0.8 → L ≈ 4\nρ = 0.9 → L ≈ 9',
            result: 'hyperbolic, not linear — 90% load is nine times 50% load'
          },
          {
            do: 'Say what the agreement buys.',
            why: 'A simulator is only useful on problems with no closed form.',
            work: 'the kernel reproduces a known result to 1% and a law exactly\n' +
              'so it can be pointed at a system that has neither',
            result: 'validation is the point of simulating something you already know'
          }
        ],
        answer: 'The event kernel reproduces the M/M/1 closed forms to within 1% at every ' +
          'utilisation — L = 9.025 against 9.000 at ρ = 0.9 — and satisfies Little\'s law to four ' +
          'decimal places. That agreement is what licenses using the same kernel on a system with no ' +
          'closed form, which is the only reason to build one.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
