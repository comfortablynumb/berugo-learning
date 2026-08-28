/** Worked examples for the landscape, counting and tracing (M31.1-M31.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'memory-management-landscape': [
      {
        title: 'Pricing a use-after-free detector',
        goal: 'Find what a quarantine catches, and what holding the memory costs.',
        setup: 'A scripted run of sixteen allocator operations with five seeded faults — four ' +
          'use-after-frees and a double free — plus one block that is never freed. The last ' +
          'read is deliberately far enough past its free that a shallow quarantine has already ' +
          'released the block.',
        steps: [
          { do: 'Run with the quarantine switched off.',
            why: 'The baseline: a freed address is handed straight back.',
            work: '0 of 5 caught, 5 silent, 0 bytes held, 1 address reused' },
          { do: 'Hold one block back before reusing an address.',
            why: 'The cheapest possible detector.',
            work: '2 of 5 caught, 3 silent, 8 bytes held' },
          { do: 'Hold four.',
            why: 'The default depth.',
            work: '4 of 5 caught, 1 silent, 32 bytes held' },
          { do: 'Hold six.',
            why: 'Deep enough that no block leaves quarantine during the run.',
            work: '5 of 5 caught, 0 silent, 36 bytes held' },
          { do: 'Read the leak separately.',
            why: 'A block never freed is not a fault the allocator can name at any depth.',
            work: '1 block, 4 bytes, still live at the end of the run' }
        ],
        answer: 'The curve is 0, 2, 2, 4, 5 caught at depths 0, 1, 2, 4 and 6, and the memory ' +
          'held out of circulation to achieve it is 0, 8, 16, 32 and 36 bytes. There is no free ' +
          'lunch anywhere on it: every additional fault caught is bought with memory that ' +
          'cannot be reused. That is precisely why a sanitiser is a debugging build rather ' +
          'than the default one, and why the honest number to quote for a detector is the pair ' +
          'rather than the catch rate alone.'
      },
      {
        title: 'The triangle, on one trace',
        goal: 'Show that the three axes have three different winners.',
        setup: 'One generated trace of 1 599 objects and 44 608 bytes, replayed against ' +
          'reference counting, stop-the-world mark-sweep and generational copying in an ' +
          '8 192-byte heap, with every collection checked against the liveness oracle.',
        steps: [
          { do: 'Read the maximum pause for each.',
            why: 'The latency axis.',
            work: 'counting 0, mark-sweep 381, generational 90' },
          { do: 'Read the throughput.',
            why: 'The throughput axis, with the barrier and counting traffic charged to the collector.',
            work: 'counting 0.576, mark-sweep 0.666, generational 0.619' },
          { do: 'Read the peak bytes held.',
            why: 'The footprint axis.',
            work: 'counting 7 240, mark-sweep 8 192, generational 7 792' },
          { do: 'Read what each left uncollected at the end.',
            why: 'Not an axis of the triangle, and the one that separates counting from the rest.',
            work: 'counting 154 objects, mark-sweep 67, generational 161' },
          { do: 'Check the column that is not a trade-off.',
            why: 'A collector that frees a live object has not bought anything.',
            work: '3 of 3 freed no reachable object' }
        ],
        answer: 'Counting wins latency at 0 and loses throughput at 0.576. Mark-sweep wins ' +
          'throughput at 0.666 and loses latency at 381. Generational takes the middle of both ' +
          'and is beaten on peak memory by the design with no collection at all. Three ' +
          'columns, three different winners, and the ordering changes again when the heap size ' +
          'does — which is why the answer to "which collector is best" is always another ' +
          'question.'
      }
    ],

    'reference-counting': [
      {
        title: 'What the counting costs, and what it does not catch',
        goal: 'Price the write barrier and the cycles in one run.',
        setup: 'The same 1 599-object trace, six per cent of whose allocations build a ' +
          'two-object cycle held from a rotating root slot, replayed under plain reference ' +
          'counting with the counting traffic charged to the collector.',
        steps: [
          { do: 'Count the adjustments the run performs.',
            why: 'This is the throughput cost, and it is paid whether or not anything dies.',
            work: '3 757 adjustments over 5 101 program steps — 0.74 per step' },
          { do: 'Count what was reclaimed without a collection.',
            why: 'The thing counting is for.',
            work: '1 354 objects, with 0 pauses' },
          { do: 'Count what it could not reach.',
            why: 'Every one of them is a cycle.',
            work: '154 objects, 4 304 bytes' },
          { do: 'Compare the throughput against tracing on the same trace.',
            why: 'The work did not disappear; it moved into the mutator.',
            work: '0.576 against mark-sweep\'s 0.666' },
          { do: 'Turn on cycle collection at a threshold of 32 candidates.',
            why: 'The leak is not optional if the workload has back-pointers.',
            work: 'the leak falls from 154 objects to 8, at the cost of 11 pauses and a worst ' +
              'pause of 304' }
        ],
        answer: 'Reference counting reclaims 1 354 objects with no pause at all and leaks 154, ' +
          'and it pays 3 757 count adjustments for the privilege — a throughput of 0.576 ' +
          'against tracing\'s 0.666 on the identical trace. Adding the tracer it needs to close ' +
          'the leak takes the residue to 8 objects and gives it back the pauses it was ' +
          'supposed not to have. Both halves of the folklore are true and neither is true alone.'
      },
      {
        title: 'The store that is not free',
        goal: 'Find the case where "reference counting has no pause" is false.',
        setup: 'A linked list of n nodes, held by exactly one reference. The head\'s count is ' +
          'dropped, which is one pointer store in the program.',
        steps: [
          { do: 'Drop the head of a one-node list.',
            why: 'The trivial case, and the intuition everybody has.',
            work: '1 object freed, 1 decrement' },
          { do: 'Drop the head of a ten-node list.',
            why: 'The cascade begins.',
            work: '10 objects freed, 10 decrements, 0 left in the heap' },
          { do: 'Drop the head of a hundred-node list.',
            why: 'Still one store in the program.',
            work: '100 objects freed, 100 decrements' },
          { do: 'Drop the head of a two-hundred-node list.',
            why: 'The relationship is linear and unbounded.',
            work: '200 objects freed, 200 decrements before the next instruction runs' },
          { do: 'Read the worst single store on the demo trace beside it.',
            why: 'A shallow graph never shows the effect at all.',
            work: '3 units, because the generated graph has depth 2' }
        ],
        answer: 'The number of objects freed at one store equals the chain length exactly, and ' +
          'the demo trace — whose object graph is shallow — reports a worst single store of 3, ' +
          'which is how the effect stays invisible until your data is deep. "Reference ' +
          'counting has no pause" means "it has no COLLECTION", which is a different claim. ' +
          'The pause is still there; it has moved into one specific store, and which store ' +
          'depends on the shape of your data rather than on the size of your heap. That is ' +
          'arguably worse, because it correlates with nothing a monitoring system watches.'
      }
    ],

    'mark-sweep-and-compact': [
      {
        title: 'What a bounded mark stack costs',
        goal: 'Price the overflow recovery, and check it is a cost rather than a bug.',
        setup: 'One heap of 922 objects, of which 89 are reachable through a 32-deep spine, ' +
          'collected once at each of several mark-stack limits over a fresh clone. Each run is ' +
          'checked against the unreachable set computed before the collection.',
        steps: [
          { do: 'Collect with a stack of 64 entries.',
            why: 'Large enough that the stack never fills.',
            work: '89 reached in the main pass, 0 rescans, 1 011 units of work' },
          { do: 'Halve it to 32.',
            why: 'The first overflow.',
            work: '50 reached, 1 rescan pass, 1 894 units' },
          { do: 'Take it to 8.',
            why: 'The recovery is now doing most of the marking.',
            work: '18 reached, 2 rescan passes, 2 784 units' },
          { do: 'Take it to 1.',
            why: 'The extreme, where every push beyond the root overflows.',
            work: '9 reached, 2 rescan passes, 2 775 units — 2.74 times the cost at 64' },
          { do: 'Check the reclaimed set at every limit.',
            why: 'A recovery that is cheaper because it is wrong is not a trade.',
            work: '833 of 833 reclaimed at every limit, and 0 reachable objects freed' }
        ],
        answer: 'The work rises from 1 011 units to 2 775 as the stack shrinks from 64 entries ' +
          'to 1 — 2.74 times as much — and the reclaimed set is identical at every limit. That ' +
          'is the shape of a correct recovery: it costs more and it computes the same answer. ' +
          'The oracle column found two defects in this code that both reported healthy ' +
          'statistics while losing live objects, and neither would have been visible in the ' +
          'work column alone.'
      },
      {
        title: 'The same free bytes, two shapes',
        goal: 'Show that fragmentation is about the shape of free space, not its size.',
        setup: 'The same heap, collected twice: once leaving the survivors where they are, and ' +
          'once sliding them together with the pointers fixed up. Both are measured over the ' +
          'same 25 736-byte span.',
        steps: [
          { do: 'Measure the live bytes after each.',
            why: 'They must be identical, or the two runs are not comparable.',
            work: '2 656 bytes in both' },
          { do: 'Measure the free bytes after each.',
            why: 'Also identical, which is the point.',
            work: '23 080 bytes in both' },
          { do: 'Count the pieces the free space is in.',
            why: 'This is where they differ.',
            work: '57 holes after a sweep, 1 after a compaction' },
          { do: 'Measure the largest single piece.',
            why: 'This is what an allocation request actually meets.',
            work: '5 160 bytes after a sweep, 23 080 after a compaction' },
          { do: 'Express the largest as a share of the free space.',
            why: 'The number a capacity plan would want and never has.',
            work: '22.4 per cent against 100 per cent' }
        ],
        answer: 'Identical live bytes, identical free bytes, and a heap that can satisfy a ' +
          '23 080-byte request in one case and fails at 5 161 in the other. The swept heap is ' +
          '90 per cent free and cannot allocate a block a quarter of that size. Compaction ' +
          'buys back the other 77.6 per cent, and it costs a pass over every pointer in the ' +
          'heap to do it — which is a demand on the compiler rather than on the collector, and ' +
          'is exactly what a conservative scanner cannot supply.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
