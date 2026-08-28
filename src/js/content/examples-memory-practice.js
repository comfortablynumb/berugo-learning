/** Worked examples for weak references, avoidance and diagnosis (M31.7-M31.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'weak-references': [
      {
        title: 'Dying of file descriptors with an empty heap',
        goal: 'Run the production failure that finalisers are famous for.',
        setup: 'A loop that opens a handle per iteration and drops the object holding it. The ' +
          'handle is released by a finaliser; the finaliser runs when a collection happens; a ' +
          'collection happens when memory runs low. The objects are 16 bytes and the heap ' +
          'budget is 4 KB. The process may hold 16 handles.',
        steps: [
          { do: 'Run the loop with release left to the finaliser.',
            why: 'The version that reads correctly and is correct in isolation.',
            work: 'handles open climb one per iteration and reach the limit at iteration 17' },
          { do: 'Read the memory held at the moment it fails.',
            why: 'The reason nothing rescued it.',
            work: '0.27 KB of a 4 KB budget — 6.6 per cent' },
          { do: 'Count the collections triggered over the run.',
            why: 'Memory pressure is the only trigger, and there was none.',
            work: '0' },
          { do: 'Run the same loop with the handle closed at the end of the block.',
            why: 'The only change is where the release happens.',
            work: '64 iterations, 64 handles opened and released, peak open of 1, never fails' },
          { do: 'Compare the memory profile of the two runs.',
            why: 'To rule out the obvious alternative explanation.',
            work: 'identical — 64 allocations of 16 bytes each and 0 collections in both' }
        ],
        answer: 'Identical loops, identical allocations, identical memory, and one of them ' +
          'stops at iteration 17. The failure has nothing to do with the collector being slow ' +
          'or the heap being small: sixteen-byte objects never fill a four-kilobyte heap, so ' +
          'nothing ever asks the collector to run, so the correct release code is never ' +
          'called. That is the whole case for lexically scoped release over finalisation, and ' +
          'it is not an argument about performance.'
      },
      {
        title: 'One word between a cache and a leak',
        goal: 'Change the strength of one reference and nothing else.',
        setup: 'A map holding twelve entries keyed on objects, each key holding a value. Six ' +
          'of the twelve keys are dropped from the roots, which is what happens to a session ' +
          'object when its request finishes. The map itself stays reachable.',
        steps: [
          { do: 'Collect with strong entries.',
            why: 'The map is reachable and the map reaches the keys.',
            work: '0 entries cleared, 0 objects reclaimed, 600 bytes held' },
          { do: 'Collect with soft entries and no memory pressure.',
            why: 'Soft is a policy, and the policy has not fired.',
            work: '0 cleared, 0 reclaimed, 600 bytes — identical to strong' },
          { do: 'Collect with soft entries under pressure.',
            why: 'The same references, a different runtime decision.',
            work: '6 cleared, 12 reclaimed, 312 bytes' },
          { do: 'Collect with weak entries.',
            why: 'An edge the tracer does not follow, unconditionally.',
            work: '6 cleared, 12 reclaimed, 312 bytes' },
          { do: 'Count what the twelve reclaimed objects were.',
            why: 'Each dropped key takes its value with it.',
            work: '6 keys and 6 values, from 25 objects down to 13' }
        ],
        answer: 'The strong map is not a cache with a bug in it — it is a map working exactly ' +
          'as specified, retaining every key it has ever been given, holding 600 bytes where ' +
          'the weak version holds 312. The soft row is the one to be careful with: with no ' +
          'pressure it behaves identically to strong and with pressure identically to weak, so ' +
          'a test suite sees one behaviour and production sees the other. That is why soft ' +
          'references are fine for "recompute this if it is gone" and wrong for anything whose ' +
          'absence changes what the program does.'
      }
    ],

    'avoiding-the-collector': [
      {
        title: 'Three programs, one answer, eighty-four times the allocation',
        goal: 'Attack the allocation rate and check the result did not move.',
        setup: 'One loop over forty values, written three ways: a record built per iteration ' +
          'with a fresh accumulator each time, the same loop with one record built at the end, ' +
          'and the same computation with no records at all. Each is traced through the VM one ' +
          'instruction at a time.',
        steps: [
          { do: 'Run the allocation-heavy version.',
            why: 'The baseline, and the shape a lot of code has.',
            work: '84 objects, 2 288 bytes, 10 collections, 70 units of GC work' },
          { do: 'Build one record at the end instead of one per iteration.',
            why: 'The record type stays; only the frequency changes.',
            work: '3 objects, 360 bytes, 2 collections, 6 units of GC work' },
          { do: 'Remove the record type entirely.',
            why: 'The floor.',
            work: '1 object — the array literal — 328 bytes, 1 collection, 0 units' },
          { do: 'Check the answer each one computes.',
            why: 'An allocation reduction that changes the result is not an optimisation.',
            work: '820 in all three' },
          { do: 'Grow the loop to eighty iterations and look at the slope.',
            why: 'A constant is a fixed cost; a slope is a cost that grows with traffic.',
            work: '164 objects against 1, and the other two lines stay flat' }
        ],
        answer: '84 allocations become 1 and 70 units of collector work become 0, for the same ' +
          'answer of 820, with no flag touched and no collector changed. The middle row is the ' +
          'one worth studying: it keeps the record type and the loop and moves the ' +
          'construction outside, which is the shape most real fixes take — not "stop using ' +
          'objects" but "stop building one per iteration". Doubling the loop doubles only the ' +
          'heavy line, which is what a slope in an allocation profile means.'
      },
      {
        title: 'Reading the escape analysis rather than trusting it',
        goal: 'Find which allocations the compiler removes without being asked, and why not the rest.',
        setup: 'The allocation-heavy program lowered to IR and run through the escape analysis ' +
          'from M29, which reports a reason per allocation site rather than a percentage.',
        steps: [
          { do: 'Count the allocation sites the analysis can see.',
            why: 'It sees IR instructions, not the objects they produce at runtime.',
            work: '5 sites: two records, two closures and an array' },
          { do: 'Count the ones that never leave their frame.',
            why: 'These can go on the stack, or become registers.',
            work: '3 of 5 — both closures and the array literal' },
          { do: 'Read the reason for each one that escapes.',
            why: '"Returned" is exact; "passed to a call" is conservative.',
            work: '2 of 5, and both are returned' },
          { do: 'Reconcile the 5 sites with the 84 runtime allocations.',
            why: 'A site inside a loop allocates once per iteration.',
            work: 'the two returned records account for 81 of the 84 objects' },
          { do: 'Read the site table beside it.',
            why: 'The lever is a site, not a percentage.',
            work: 'pair:6 allocates 41 objects and 984 bytes — 43.0 per cent of the heap' }
        ],
        answer: 'Three of five sites never leave their frame and could be removed by the ' +
          'compiler without anybody asking; the two that escape are both returned, which is ' +
          'exact and leaves nothing to do. Those two account for 81 of the 84 runtime objects, ' +
          'which is why the analysis reporting "3 of 5 stack-allocatable" and the profiler ' +
          'reporting "84 allocations" are both true and describe different things. The reason ' +
          'column is what makes the table actionable: a conservative "passed to a call" is ' +
          'something restructuring can fix, and "returned" is not.'
      }
    ],

    'diagnosing-gc': [
      {
        title: 'Deciding whether a growing heap is a leak',
        goal: 'Turn "the heap looks big" into a measurement with a verdict.',
        setup: 'One workload sampled at six points over the second half of its run, with each ' +
          'sample being a heap dump — every unreachable object dropped first, as a real ' +
          'snapshot tool does. Run twice: once with fifteen per cent of allocations pushed ' +
          'onto a list nothing empties, and once with none.',
        steps: [
          { do: 'Take the six samples with no leak.',
            why: 'A healthy service still has a heap full of objects.',
            work: '2 128, 2 168, 2 168, 2 168, 2 168 and 2 128 bytes' },
          { do: 'Apply the stability test.',
            why: 'The verdict has to be a slope against the mean, not a comparison of two points.',
            work: 'stable — a slope of 0.0, with the first and last samples both 2 128' },
          { do: 'Take the same six samples with the leak on.',
            why: 'The same workload otherwise.',
            work: '7 120 bytes at the first sample and 12 432 at the last' },
          { do: 'Apply the test again.',
            why: 'This is the assertion the leak lab is graded on.',
            work: 'slope of 1 040.0 bytes per sample — not stable' },
          { do: 'Sample the first half instead and re-run the test.',
            why: 'To see the mistake every leak-hunting tool makes once.',
            work: 'the clean run also reads as growing — 1 272 bytes rising to 1 992, for a ' +
              'slope of 244.8, while its caches fill' }
        ],
        answer: 'Retained bytes are flat between 2 128 and 2 168 with a slope of 0.0 when there ' +
          'is no ' +
          'leak, and climb from 7 120 to 12 432 with a slope of 1 040.0 when there is. Both ' +
          'measurements are taken over the second half of the run, and that window is not a ' +
          'detail: a program filling its caches for the first time is growing, so a slope ' +
          'measured across the warm-up says "leak" for a perfectly healthy start.'
      },
      {
        title: 'Finding the reference to remove',
        goal: 'Use the dominator tree and a snapshot difference to name a line of code.',
        setup: 'The leaking run\'s final snapshot, with retained sizes computed by the same ' +
          'dominator pass M13 built for control-flow graphs, and the earliest snapshot for ' +
          'comparison.',
        steps: [
          { do: 'Sort the dump by retained size and read the top row.',
            why: 'Retained size predicts what comes back if one reference goes.',
            work: 'object #0: 40 bytes of its own, 12 248 retained' },
          { do: 'Compare that against the whole snapshot.',
            why: 'One edge holds almost everything.',
            work: '12 248 of 12 432 bytes — 98.5 per cent' },
          { do: 'Sort by own size instead and see what it points at.',
            why: 'The standard mistake.',
            work: 'the largest objects are 40 bytes each and there are dozens of them' },
          { do: 'Walk the retaining path from a GC root to the deepest object.',
            why: 'The shape of the leak is in the path length.',
            work: '368 hops, each object holding the previous one' },
          { do: 'Difference the two snapshots by allocation site.',
            why: 'This is the step that names a construct rather than an object.',
            work: 'the top site went from 32 objects retaining 920 bytes to 61 retaining ' +
              '1 880 — a gain of 960' }
        ],
        answer: 'One object holds 98.5 per cent of the heap through a chain 368 references ' +
          'long, and every edge on it is real — the collector is right about all of them, so ' +
          'no setting will free any of it. Sorting by own size finds nothing, because the ' +
          'largest objects are all 40 bytes. The snapshot difference is what turns this into ' +
          'work: a site that went from 920 retained bytes to 1 880 names a construct in the ' +
          'source, and removing one edge there returns 12 248 bytes.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
