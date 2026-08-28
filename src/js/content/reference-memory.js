/** Reference entries for the landscape, counting and tracing (M31.1-M31.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'memory-management-landscape': {
      summary: 'Manual allocation with its four failures reproduced and a quarantine detector ' +
        'priced against the memory it holds, beside three collection strategies replayed over ' +
        'one trace with pause distribution, throughput and peak memory reported together and ' +
        'every collection checked against a liveness oracle.',
      intuition: 'There are three axes — throughput, latency and footprint — and no design ' +
        'wins all three, so "which garbage collector is best" is always "for which of the ' +
        'three do you have the tightest budget".',
      formulation: {
        equations: [
          {
            label: 'The quarantine sweep: five seeded faults, one unfreed block',
            expr: 'depth · caught · missed · bytes held',
            terms: [
              { sym: '0', meaning: '0 of 5 · 5 · 0' },
              { sym: '2', meaning: '2 of 5 · 3 · 16' },
              { sym: '4', meaning: '4 of 5 · 1 · 32' },
              { sym: '6', meaning: '5 of 5 · 0 · 36' }
            ]
          },
          {
            label: 'The triangle, on 1 599 objects in an 8 192-byte heap',
            expr: 'strategy · max pause · throughput · peak bytes',
            terms: [
              { sym: 'reference counting', meaning: '0 · 0.576 · 7 240' },
              { sym: 'stop-the-world mark-sweep', meaning: '381 · 0.666 · 8 192' },
              { sym: 'generational copying', meaning: '90 · 0.619 · 7 792' },
              { sym: 'header cost', meaning: '12 792 of 44 608 bytes — 28.7 per cent' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No reachable object is ever freed',
          why: 'It is the one guarantee a managed runtime makes, and everything else is a trade.',
          breaks: 'Checked at every collection against a breadth-first walk that shares no code with any collector.'
        },
        {
          name: 'A quarantined block is never handed out again while it is quarantined',
          why: 'Otherwise the detector reports a use-after-free against somebody else\'s block.',
          breaks: 'Blocks leave the queue oldest first and become reusable only then.'
        },
        {
          name: 'The three axes are reported together or not at all',
          why: 'Any one of them alone makes some design look best.',
          breaks: 'Every comparison table in the milestone carries pause, throughput and peak.'
        }
      ],
      complexity: [
        { operation: 'allocation', average: 'a pointer bump plus a header write', worst: 'the same, or a free-list search after a sweep' },
        { operation: 'manual free', average: 'constant, plus the quarantine queue', worst: 'constant; the cost is the memory held' },
        { operation: 'a counting store', average: 'two count adjustments', worst: 'the length of the chain it releases' },
        { operation: 'a tracing collection', average: 'proportional to the heap', worst: 'the same, and it is one pause' }
      ],
      failureModes: [
        {
          symptom: 'A sanitiser build finds no use-after-free and production still crashes.',
          cause: 'The quarantine is shallower than the gap between the free and the access.',
          fix: 'Deepen it and accept the memory cost; a detector that catches four of five faults is a different tool from one that catches five.'
        },
        {
          symptom: 'A collector benchmark shows a large improvement that nobody can reproduce.',
          cause: 'It reported an average pause over a bimodal distribution, or one axis of three.',
          fix: 'Report p50, p99 and max, with throughput and peak memory beside them.'
        },
        {
          symptom: 'Memory grows steadily in a language with a garbage collector.',
          cause: 'A reachable object nobody will use again — which the collector is right about.',
          fix: 'This is a leak in the ordinary sense and no collector setting addresses it; see 31.9.'
        },
        {
          symptom: 'A program with tiny objects uses far more memory than the data warrants.',
          cause: 'The per-object header, which is a fixed cost and is paid hardest by small objects.',
          fix: 'Flatten, box less, or use value types; 31.8 measures the alternatives.'
        }
      ],
      inTheWild: [
        'AddressSanitizer\'s quarantine and redzone poisoning, which is the detector this section models.',
        'CPython and Swift, which pay reference counting\'s throughput cost for predictable destruction.',
        'HotSpot\'s collector menu, where the choice is explicitly a position on the triangle.',
        'The object header in every JVM, where mark bits, age and hash share one or two words.'
      ],
      sources: [
        { title: 'Jones, Hosking, Moss — The Garbage Collection Handbook', note: 'the reference for the whole milestone' },
        { title: 'Wilson — Uniprocessor garbage collection techniques', note: 'the survey that organises the design space' },
        { title: 'Serebryany et al. — AddressSanitizer: a fast address sanity checker', note: 'quarantine, poison and the cost' },
        { title: 'Hertz and Berger — Quantifying the performance of garbage collection vs explicit memory management', note: 'the footprint axis, measured' }
      ]
    },

    'reference-counting': {
      summary: 'Retain and release on every pointer store with the counting traffic charged to ' +
        'the collector, the cascade that makes "no pause" false, the cycle a count cannot see, ' +
        'and Bacon-Rajan trial deletion run over a candidate set the decrement rule keeps small.',
      intuition: 'A count is local information and reachability is global, so a reference ' +
        'counter reclaims immediately, pays on every write, and cannot see a cycle — and every ' +
        'production counting runtime therefore contains a tracer.',
      formulation: {
        equations: [
          {
            label: 'One trace, 1 599 objects, six per cent cycles',
            expr: 'measure · value',
            terms: [
              { sym: 'count adjustments', meaning: '3 757 over 5 101 program steps' },
              { sym: 'reclaimed with no collection', meaning: '1 354 objects' },
              { sym: 'leaked cycles', meaning: '154 objects, 4 304 bytes' },
              { sym: 'throughput against mark-sweep', meaning: '0.576 against 0.666' }
            ]
          },
          {
            label: 'The cascade: one store, a chain of n',
            expr: 'chain length · objects freed · decrements',
            terms: [
              { sym: '1', meaning: '1 · 1' },
              { sym: '10', meaning: '10 · 10' },
              { sym: '100', meaning: '100 · 100' },
              { sym: '200', meaning: '200 · 200' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'An object\'s count equals the number of references to it',
          why: 'The whole design rests on it; a count that drifts frees a live object or leaks a dead one.',
          breaks: 'Every store retains the new target before releasing the old one, so a self-assignment cannot reach zero.'
        },
        {
          name: 'Only a decrement to a non-zero value creates a cycle candidate',
          why: 'An increment cannot make a cycle garbage, and a decrement to zero has already freed the object.',
          breaks: 'The candidate set is exactly those objects, which is what makes cycle collection affordable.'
        },
        {
          name: 'A trial-deletion group is reclaimed only if no member has an external holder',
          why: 'One reference from outside makes the whole subgraph live.',
          breaks: 'Internal references are subtracted from every member\'s count and the roots are consulted.'
        }
      ],
      complexity: [
        { operation: 'a pointer store', average: 'two count adjustments', worst: 'the size of the subgraph released' },
        { operation: 'reclamation', average: 'immediate, at the store', worst: 'a cascade the length of a chain' },
        { operation: 'cycle collection', average: 'the size of the candidate subgraphs', worst: 'the whole heap, when everything is a candidate' },
        { operation: 'an atomic count under threads', average: 'an atomic increment', worst: 'a contended cache line, orders of magnitude worse' }
      ],
      failureModes: [
        {
          symptom: 'Memory grows in a reference-counted program with no obvious retention.',
          cause: 'A cycle: a parent pointer, an observer list or a doubly linked list.',
          fix: 'Make the back-edge weak, or enable the cycle collector; these are the only two options.'
        },
        {
          symptom: 'A latency spike at a store rather than at a collection.',
          cause: 'A cascade — the last reference to a deep structure was dropped there.',
          fix: 'Expect it wherever your data is deep; it is not on any GC dashboard because it is not a collection.'
        },
        {
          symptom: 'Multithreaded throughput is far worse than the single-threaded profile predicted.',
          cause: 'Atomic count adjustments on shared objects, contending on a cache line.',
          fix: 'Reduce sharing, transfer ownership rather than copying references, or use a tracing collector.'
        },
        {
          symptom: 'The cycle collector never runs and memory grows anyway.',
          cause: 'It was triggered on heap size, and a counting runtime never notices the memory is gone.',
          fix: 'Trigger on the candidate count or on allocations, as CPython does.'
        }
      ],
      inTheWild: [
        'CPython, which counts and runs a generational cycle collector over its candidate lists.',
        'Swift\'s ARC, which is counting plus elision, ownership transfer and escape analysis.',
        'C++ shared_ptr and weak_ptr, where the cycle and its remedy are both explicit in the type.',
        'COM and Objective-C before ARC, where retain and release were written by hand.'
      ],
      sources: [
        { title: 'Collins — A method for overlapping and erasure of lists', note: 'reference counting, 1960' },
        { title: 'Bacon and Rajan — Concurrent cycle collection in reference counted systems', note: 'trial deletion, which this section implements' },
        { title: 'Deutsch and Bobrow — An efficient incremental automatic garbage collector', note: 'deferred reference counting' },
        { title: 'Shahriyar, Blackburn, Frampton — Down for the count? Getting reference counting back in the ring', note: 'the modern measurements' }
      ]
    },

    'mark-sweep-and-compact': {
      summary: 'Tri-colour marking stepped over a real heap map, a bounded mark stack driven ' +
        'to overflow with the recovery priced at 2.74 times the work, sweep and compaction ' +
        'compared on identical free bytes, and the precise-against-conservative trade stated as ' +
        'the ability to move an object.',
      intuition: 'Tracing computes reachability from the roots in one burst, which is why it ' +
        'collects cycles and why its pause is the size of the heap — and everything it can do ' +
        'about fragmentation depends on the compiler having said which words are references.',
      formulation: {
        equations: [
          {
            label: 'The stack-limit sweep over 922 objects, 89 of them reachable',
            expr: 'limit · reached in the main pass · rescans · work',
            terms: [
              { sym: '1', meaning: '9 · 2 · 2 775' },
              { sym: '8', meaning: '18 · 2 · 2 784' },
              { sym: '32', meaning: '50 · 1 · 1 894' },
              { sym: '64', meaning: '89 · 0 · 1 011' }
            ]
          },
          {
            label: 'The same collection, swept and compacted, over a 25 736-byte span',
            expr: 'after · live · free · holes · largest hole',
            terms: [
              { sym: 'a sweep', meaning: '2 656 · 23 080 · 57 · 5 160 (22.4 per cent)' },
              { sym: 'a compaction', meaning: '2 656 · 23 080 · 1 · 23 080 (100 per cent)' },
              { sym: 'reclaimed at every stack limit', meaning: '833 of 833, 0 live objects lost' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'White does not mean garbage until the grey set is empty',
          why: 'It means "not reached yet", and the two coincide only at the end of the mark.',
          breaks: 'Sweep runs after the mark, never during it — which stops holding the moment the program is allowed to run, and is 31.5.'
        },
        {
          name: 'Overflow recovery terminates and is complete',
          why: 'A black object with a white child is the only evidence a dropped push leaves.',
          breaks: 'Each pass turns at least one white object black, and a root is entered one at a time so it can never be dropped.'
        },
        {
          name: 'A moving collector needs every reference to be identifiable',
          why: 'Updating a word that is not a pointer corrupts an integer.',
          breaks: 'Compaction is available only with the precise stack maps M30 produces.'
        }
      ],
      complexity: [
        { operation: 'mark', average: 'proportional to the live set', worst: 'plus O(heap) per rescan pass after an overflow' },
        { operation: 'sweep', average: 'proportional to the heap', worst: 'the same; every object is visited' },
        { operation: 'compaction', average: 'proportional to the live set plus a pass over every pointer', worst: 'the same' },
        { operation: 'allocation after a sweep', average: 'a free-list search', worst: 'fails while the heap is mostly free, if no hole is large enough' }
      ],
      failureModes: [
        {
          symptom: 'An allocation fails in a heap that is mostly free.',
          cause: 'Fragmentation: the free space is in more pieces than the request can use.',
          fix: 'Compact, which requires a precise collector, or use size classes so requests match the holes.'
        },
        {
          symptom: 'A collection occasionally takes far longer than usual with no change in heap size.',
          cause: 'The mark stack overflowed and the recovery ran a heap scan per pass.',
          fix: 'Size the stack for the deepest structure, not the average one; the cost is 2.74 times here.'
        },
        {
          symptom: 'A Boehm-collected program\'s memory grows and never comes back.',
          cause: 'Conservative scanning retained a dead object because an integer looked like its address.',
          fix: 'Nothing reliable; this is the cost of collecting without compiler cooperation.'
        },
        {
          symptom: 'A collector loses live objects only on deep structures.',
          cause: 'The overflow recovery, which is the path no test exercises.',
          fix: 'Check the reclaimed set against an independent reachability walk at every collection, not at the end.'
        }
      ],
      inTheWild: [
        'The Boehm-Demers-Weiser collector, which is conservative and therefore cannot compact.',
        'Go\'s concurrent mark-sweep, which is precise and still does not move objects, by choice.',
        'HotSpot\'s serial and parallel old collectors, which are mark-compact.',
        'Every JVM heap dump, which is a picture of what one of these marks reached.'
      ],
      sources: [
        { title: 'McCarthy — Recursive functions of symbolic expressions', note: 'mark-sweep, 1960' },
        { title: 'Dijkstra, Lamport, Martin, Scholten, Steffens — On-the-fly garbage collection', note: 'the tri-colour abstraction' },
        { title: 'Boehm and Weiser — Garbage collection in an uncooperative environment', note: 'conservative scanning and its limits' },
        { title: 'Jones, Hosking, Moss — The Garbage Collection Handbook', note: 'mark stack overflow, Lisp2 and threaded compaction' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
