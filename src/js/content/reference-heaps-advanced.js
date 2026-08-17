/** Reference blocks for the amortised and systems heap sections (M05.5-M05.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'fibonacci-heaps': {
      summary: 'A lazy forest with O(1) insert, meld and decrease-key and O(log n) extract-min, all ' +
        'amortised — and constants large enough that it loses the races it was designed to win.',
      intuition: 'Defer everything. Insert drops a node in a root list; the mess is consolidated once, ' +
        'by the extract-min that finally has to find the minimum.',
      formulation: {
        equations: [
          {
            label: 'The potential',
            expr: 'Φ = (number of roots) + 2 · (number of marked nodes)',
            terms: [
              { sym: 'insert', meaning: 'adds one root, so it pays one unit and does constant work' },
              { sym: 'extract-min', meaning: 'discharges the accumulated potential by consolidating' }
            ]
          },
          {
            label: 'The degree bound',
            expr: 'a node of degree d has ≥ F(d + 2) descendants ⇒ max degree ≤ log_φ(n)',
            terms: [
              { sym: 'measured', meaning: 'max degree 15 in a 40 000-node heap, bound 22' },
              { sym: 'cascading cuts', meaning: 'are what make the descendant bound hold' }
            ]
          },
          {
            label: 'The measured contradiction',
            expr: 'fewest comparisons, slowest wall clock',
            terms: [
              { sym: 'Dijkstra, 22 500 nodes', meaning: '258 493 comparisons against a binary heap\'s 336 961, and slower' }
            ]
          }
        ],
        derivation: [
          'A node loses at most one child before being cut itself, so a degree-d node retains at least ' +
            'the Fibonacci number F(d + 2) descendants — which bounds the maximum degree at log_φ(n).',
          'The consolidation array is sized from that bound; getting it wrong overruns at a size ' +
            'nobody tested.',
          'The wall-clock loss comes from six pointer fields per node, a dependent load per ' +
            'traversal, and a degree-array walk per pop — none of which appears in a comparison count.'
        ]
      },
      invariants: [
        {
          name: 'Only children are marked',
          why: 'The mark records "has lost a child while being a child"; a root cannot have.',
          breaks: 'Promoting a marked child in extract-min without clearing the mark — this platform shipped that bug.'
        },
        {
          name: 'The min pointer points at the smallest root',
          why: 'Every operation that adds a root or lowers a key must consider it.',
          breaks: 'A decrease-key that forgets to update min makes peek return the wrong element.'
        },
        {
          name: 'Stored degree equals the child count',
          why: 'The consolidation indexes by degree, so a stale degree corrupts the whole collapse.',
          breaks: 'A cut that forgets to decrement the parent degree.'
        }
      ],
      complexity: [
        { operation: 'insert', average: 'Θ(1) amortised', worst: 'Θ(1)', note: 'splice into the root list' },
        { operation: 'meld', average: 'Θ(1)', worst: 'Θ(1)', note: 'the one bound nothing else matches' },
        { operation: 'decrease-key', average: 'Θ(1) amortised', worst: 'Θ(n)', note: 'a long cascade is possible' },
        { operation: 'extract-min', average: 'Θ(log n) amortised', worst: 'Θ(n)', note: 'consolidation pays the deferred cost' },
        { operation: 'space per node', average: '7 fields', worst: '7 fields', note: 'against one array slot for an implicit heap' }
      ],
      failureModes: [
        {
          symptom: 'The invariant check reports a marked root.',
          cause: 'extract-min promoted the minimum\'s children without clearing their marks.',
          fix: 'Clear the mark on promotion; a later cascade would otherwise fire against nothing.'
        },
        {
          symptom: 'An index-out-of-range inside consolidation at large n.',
          cause: 'The degree array was sized by a guess rather than by log_φ(n) + 2.',
          fix: 'Compute the bound from the current size, and test at a size that exercises it.'
        },
        {
          symptom: 'A Fibonacci heap was adopted for Dijkstra and nothing got faster.',
          cause: 'The comparison count improved and the wall clock did not.',
          fix: 'Measure time; a pairing heap or an indexed 4-ary heap is usually faster.'
        },
        {
          symptom: 'One request in a latency-sensitive path is dramatically slow.',
          cause: 'The bounds are amortised: a single extract-min can consolidate an enormous root list.',
          fix: 'Do not use deferred-work structures behind a per-operation deadline.'
        }
      ],
      inTheWild: [
        { system: 'Textbook Dijkstra and Prim analyses', how: 'the O(E + V log V) bound is stated with a Fibonacci heap' },
        { system: 'boost::heap', how: 'ships one, alongside the pairing heap it recommends' },
        { system: 'Almost no production code', how: 'which is the honest entry, and the section\'s point' }
      ],
      sources: [
        { title: 'Fredman, Tarjan — Fibonacci heaps and their uses (JACM 1987)', where: 'the structure and the bounds' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 19', where: 'the potential-function analysis in full' },
        { title: 'Larkin, Sen, Tarjan — A back-to-basics empirical study of priority queues (2014)', where: 'the measurements, by one of the authors' },
        { title: 'Fredman — On the efficiency of pairing heaps (1999)', where: 'the lower bound that shapes the comparison' }
      ]
    },

    'pairing-heaps': {
      summary: 'A self-adjusting multiway heap with one primitive and a two-pass merge — simpler than ' +
        'a Fibonacci heap, faster in measurement, and with bounds still open after forty years.',
      intuition: 'Link two roots; the loser becomes a child. Everything is that, except pop, which ' +
        'pairs the orphaned children left to right and then folds the pairs back from the right.',
      formulation: {
        equations: [
          {
            label: 'The primitive',
            expr: 'link(a, b): the larger root becomes the smaller root\'s newest child',
            terms: [
              { sym: 'insert / meld', meaning: 'one link' },
              { sym: 'decrease-key', meaning: 'cut the subtree out, then one link at the root' }
            ]
          },
          {
            label: 'The two-pass merge',
            expr: 'pass 1: pair adjacent siblings · pass 2: fold the pairs right to left',
            terms: [
              { sym: 'measured', meaning: '46 189 comparisons against the one-pass 55 856 over 30 000 operations' }
            ]
          },
          {
            label: 'The bounds',
            expr: 'O(log n) amortised for all operations; decrease-key ∈ [Ω(log log n), O(log n)]',
            terms: [
              { sym: 'open since 1986', meaning: 'and measurably indistinguishable from O(1)' }
            ]
          }
        ],
        derivation: [
          'A single left-to-right fold links each child under the accumulated result, producing a ' +
            'spine that the next pop must walk — which is why the pairing pass is required rather ' +
            'than an optimisation.',
          'Both merges do the same number of links; the difference is the shape they leave, and that ' +
            'shape is what the following operations pay for.',
          'Cutting is cheap because nothing is repaired: no mark to test, no cascade, no degree to ' +
            'maintain — measured 11 923 cuts with no cascades against a Fibonacci heap\'s 7 029 cuts ' +
            'plus 1 569 cascades.'
        ]
      },
      invariants: [
        {
          name: 'Heap order holds through the child list',
          why: 'Every child was the loser of a link against its parent.',
          breaks: 'A link that attaches the smaller root under the larger.'
        },
        {
          name: 'The sibling links are consistent in both directions',
          why: 'decrease-key splices a node out using its prev pointer.',
          breaks: 'A prev pointer left stale after a merge makes a later cut corrupt the list.'
        },
        {
          name: 'The root has no siblings',
          why: 'It is the whole heap; a sibling means a second tree that nothing will ever visit.',
          breaks: 'Forgetting to clear next/prev on the node returned by the fold.'
        }
      ],
      complexity: [
        { operation: 'insert / meld', average: 'Θ(1)', worst: 'Θ(1)', note: 'one link' },
        { operation: 'decrease-key', average: 'O(log n) amortised', worst: 'O(log n)', note: 'behaves as O(1); the true bound is open' },
        { operation: 'extract-min', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'the two-pass merge over the child list' },
        { operation: 'space per node', average: '4 fields', worst: '4 fields', note: 'against 7 for a Fibonacci heap' }
      ],
      failureModes: [
        {
          symptom: 'Performance collapses on a pop-heavy workload.',
          cause: 'The merge folds in one pass, so the tree is a spine.',
          fix: 'Pair adjacent siblings first; the two passes together are five lines longer.'
        },
        {
          symptom: 'A decrease-key corrupts the heap.',
          cause: 'The cut updated the parent\'s child pointer but not the sibling links, or vice versa.',
          fix: 'Splice with both directions, and assert the prev links in the invariant check.'
        },
        {
          symptom: 'Elements go missing after a meld.',
          cause: 'The handle map of the melded heap was not merged into the target.',
          fix: 'Move the handles with the nodes, and clear the source.'
        },
        {
          symptom: 'A recursive two-pass merge overflows the stack.',
          cause: 'The child list can be Θ(n) long after a lazy build.',
          fix: 'Do both passes iteratively — the list is a list, and neither pass needs recursion.'
        }
      ],
      inTheWild: [
        { system: 'boost::heap::pairing_heap', how: 'the recommended decrease-key structure in the library' },
        { system: 'LEDA', how: 'pairing heaps as the default priority queue with handles' },
        { system: 'GCC\'s own internals', how: 'pairing heaps where a mergeable queue with handles is needed' }
      ],
      sources: [
        { title: 'Fredman, Sedgewick, Sleator, Tarjan — The pairing heap (Algorithmica 1986)', where: 'the structure and the first analysis' },
        { title: 'Fredman — On the efficiency of pairing heaps (1999)', where: 'the Ω(log log n) lower bound for decrease-key' },
        { title: 'Haeupler, Sen, Tarjan — Rank-pairing heaps (2011)', where: 'the variant that recovers the Fibonacci bounds' },
        { title: 'Larkin, Sen, Tarjan — A back-to-basics empirical study of priority queues (2014)', where: 'the measurements that settled the practical question' }
      ]
    },

    'indexed-priority-queues': {
      summary: 'The position map that makes decrease-key possible, and the lazy alternative that ' +
        'skips it — faster and simpler, at the cost of a queue bounded by E rather than V.',
      intuition: 'A heap is an array in no useful order, so decrease-key first has to find the ' +
        'element. Either keep a handle map, or stop decreasing and push duplicates instead.',
      formulation: {
        equations: [
          {
            label: 'The invariant',
            expr: 'positions[ids[i]] === i, for every slot i',
            terms: [
              { sym: 'maintained by', meaning: 'every swap, which now writes three arrays rather than two' }
            ]
          },
          {
            label: 'The lazy alternative',
            expr: 'push on improvement; on pop, skip if settled or if key > distance[v]',
            terms: [
              { sym: 'both checks needed', meaning: 'the first catches settled nodes, the second catches superseded entries' }
            ]
          },
          {
            label: 'The measured trade',
            expr: 'indexed |V| entries · lazy |E| entries',
            terms: [
              { sym: '22 500-node grid', meaning: 'peak 291 against 398; pushes 22 500 against 29 573' }
            ]
          }
        ],
        derivation: [
          'Without a position map, locating the entry to decrease is a linear scan, so decrease-key ' +
            'costs Θ(n) and Dijkstra degrades to Θ(V²).',
          'The lazy version does more of everything counted — 32% more comparisons, 31% more pushes, ' +
            'a 37% larger queue — and still finishes first, because it never touches a hash map.',
          'The lazy queue is bounded by the number of improvements, which approaches |E| on a dense ' +
            'graph: four orders of magnitude more than |V| at the same node count.'
        ]
      },
      invariants: [
        {
          name: 'positions[ids[i]] === i after every operation',
          why: 'It is the only thing that makes a handle mean anything.',
          breaks: 'A stale entry decreases the wrong element and the algorithm returns a plausible wrong answer.'
        },
        {
          name: 'A handle appears at most once in the heap',
          why: 'Two entries for one node make the map ambiguous.',
          breaks: 'Pushing a duplicate into an indexed heap — which is why this implementation throws.'
        },
        {
          name: 'Lazy: a popped entry is checked before it is used',
          why: 'The queue holds superseded entries by design.',
          breaks: 'Relaxing edges from a stale distance does more work and can look correct.'
        }
      ],
      complexity: [
        { operation: 'decrease-key (indexed)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'map lookup plus a sift-up' },
        { operation: 'decrease-key (lazy)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'a push; the old entry is discarded later' },
        { operation: 'queue size (indexed)', average: 'Θ(V)', worst: 'Θ(V)', note: 'one entry per node, ever' },
        { operation: 'queue size (lazy)', average: 'Θ(E)', worst: 'Θ(E)', note: 'one per improvement — the thing to instrument' },
        { operation: 'extra memory', average: 'Θ(V) map', worst: 'Θ(V)', note: 'the price of the handle' }
      ],
      failureModes: [
        {
          symptom: 'Dijkstra returns distances that are too small.',
          cause: 'A stale position made decrease-key edit a different node\'s key.',
          fix: 'Assert positions[ids[i]] === i after every operation in tests.'
        },
        {
          symptom: 'Memory grows without bound on a dense graph.',
          cause: 'Lazy insertion, with a queue bounded by |E| rather than |V|.',
          fix: 'Instrument the peak queue size; switch to the indexed form above a threshold.'
        },
        {
          symptom: 'The algorithm is correct but does far more work than expected.',
          cause: 'The lazy version skips settled nodes but not superseded entries.',
          fix: 'Add the key check as well as the settled check.'
        },
        {
          symptom: 'decrease-key is O(n) despite the indexed heap.',
          cause: 'The map is rebuilt or scanned rather than updated on each swap.',
          fix: 'Update the map inside swap, not around the operation.'
        }
      ],
      inTheWild: [
        { system: 'Most shipped Dijkstra implementations', how: 'lazy insertion with a stale check, because it is shorter' },
        { system: 'Sedgewick\'s IndexMinPQ', how: 'the canonical teaching implementation of the indexed form' },
        { system: 'Schedulers reprioritising queued tasks', how: 'the same choice, with the same memory consequence' }
      ],
      sources: [
        { title: 'Sedgewick, Wayne — Algorithms, 4th ed., §2.4 and §4.4', where: 'IndexMinPQ and its use in Dijkstra' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 24', where: 'Dijkstra as stated, assuming a handle exists' },
        { title: 'Chen, Chowdhury, Ramachandran et al. — Priority queues and Dijkstra\'s algorithm (2007)', where: 'the empirical comparison of both strategies' },
        { title: 'Larkin, Sen, Tarjan — A back-to-basics empirical study of priority queues (2014)', where: 'why the simple option usually wins' }
      ]
    },

    'timers-and-events': {
      summary: 'Where a priority queue is load-bearing in a real system — and the two cases where it ' +
        'is the wrong structure, because quantised time turns a search into an array index.',
      intuition: 'A heap answers "what is smallest" exactly. A timeout only needs "what is due this ' +
        'tick", and that is a bucket index. A simulation needs the exact answer, so it keeps the heap.',
      formulation: {
        equations: [
          {
            label: 'The wheel',
            expr: 'slot = due mod slots · level L spans slots^(L+1) ticks',
            terms: [
              { sym: 'add / cancel', meaning: 'O(1): an index and a flag' },
              { sym: 'expiry', meaning: 'O(1) amortised: walk one bucket' }
            ]
          },
          {
            label: 'The measured cost',
            expr: '100 000 timers, 50% cancelled, 5 000 ticks',
            terms: [
              { sym: 'binary heap', meaning: '3 059 313 comparisons' },
              { sym: 'wheel', meaning: '0 comparisons; 12.23 entries per tick for 2 × 64 levels' }
            ]
          },
          {
            label: 'The simulation clock',
            expr: 'time jumps to the next event; cost is events, not duration',
            terms: [
              { sym: 'key', meaning: '(time, sequence) so ties are deterministic and replays are exact' },
              { sym: 'validated by', meaning: 'L = λ·W to four decimals, and the M/M/1 closed forms to 1.5%' }
            ]
          }
        ],
        derivation: [
          'Filing by due tick removes comparison from the timer path entirely: the bucket is computed ' +
            'arithmetically, so adds and cancels are constant and expiry walks one bucket.',
          'A hierarchy replaces "ride round again" with "cascade down a level", so a long-dated timer ' +
            'is touched O(levels) times rather than O(revolutions).',
          'A discrete-event simulation cannot quantise, so it keeps the heap — and the queue is the ' +
            'clock, which is why the structure choice is the simulator\'s main performance decision.'
        ]
      },
      invariants: [
        {
          name: 'Every timer fires in exactly its due tick',
          why: 'It is the entire contract; a wheel that fires early or late is not a timer.',
          breaks: 'A revolution counter that is off by one when the delay is a multiple of the wheel width.'
        },
        {
          name: 'A cancelled timer never fires',
          why: 'Cancellation is the common case, not an edge case.',
          breaks: 'Dropping the flag when an entry cascades to another level.'
        },
        {
          name: 'Simulated time never moves backwards',
          why: 'An event scheduled into the past invalidates everything already processed.',
          breaks: 'A handler computing a delay from the wrong clock — this kernel throws instead.'
        }
      ],
      complexity: [
        { operation: 'wheel add / cancel', average: 'Θ(1)', worst: 'Θ(1)', note: 'an index and a flag' },
        { operation: 'wheel tick', average: 'Θ(1) amortised', worst: 'Θ(bucket)', note: '12.23 entries per tick measured' },
        { operation: 'heap add / expire', average: 'Θ(log n)', worst: 'Θ(log n)', note: '3 059 313 comparisons over the same run' },
        { operation: 'simulation step', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'one pop, plus the events the handler schedules' },
        { operation: 'wheel memory', average: 'Θ(slots × levels + timers)', worst: 'same', note: 'the buckets are allocated up front' }
      ],
      failureModes: [
        {
          symptom: 'Timers fire one wheel-revolution late.',
          cause: 'The rounds counter is decremented before the due check, so a delay that is a multiple of the wheel width misses its own tick.',
          fix: 'Compare the due tick directly; keep the counter for reporting only.'
        },
        {
          symptom: 'A long-dated timer never fires.',
          cause: 'It was filed on a level that is never cascaded, or the cascade ran after the fire step.',
          fix: 'Cascade before firing, and assert that no live timer is overdue.'
        },
        {
          symptom: 'A simulation gives different results on the same seed.',
          cause: 'Two events at the same timestamp are ordered by heap internals.',
          fix: 'Extend the key with a sequence number so ties break by insertion order.'
        },
        {
          symptom: 'The event queue grows until the process dies.',
          cause: 'Handlers schedule more events than they consume — an unstable model, ρ ≥ 1.',
          fix: 'Check the utilisation; an M/M/1 queue is only stable while λ < μ.'
        }
      ],
      inTheWild: [
        { system: 'Linux kernel timers', how: 'hierarchical timing wheels with a 1 ms tick, plus hrtimers on a red-black tree for precision' },
        { system: 'Netty HashedWheelTimer, Kafka purgatory', how: 'hashed timing wheels for connection and request timeouts' },
        { system: 'ns-3, SimPy, OMNeT++', how: 'discrete-event kernels where the priority queue is the clock' }
      ],
      sources: [
        { title: 'Varghese, Lauck — Hashed and hierarchical timing wheels (SOSP 1987)', where: 'the original, with both variants' },
        { title: 'Linux kernel/time/timer.c', where: 'the shipped hierarchical wheel, with its cascade' },
        { title: 'Law, Kelton — Simulation Modeling and Analysis', where: 'discrete-event simulation and the M/M/1 validation' },
        { title: 'Little — A proof for the queuing formula L = λW (1961)', where: 'the law the simulator is checked against' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
