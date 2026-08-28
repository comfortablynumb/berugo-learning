/** Worked examples for copying, incremental and modern collectors (M31.4-M31.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'generational-collection': [
      {
        title: 'Cost proportional to survivors, measured',
        goal: 'Separate the two cost models by growing the heap and holding the workload fixed.',
        setup: 'One 1 500-object trace with a bounded retained set, replayed under mark-sweep ' +
          'and under semi-space copying at four heap sizes. The live set does not change; only ' +
          'the memory the collector may fill does.',
        steps: [
          { do: 'Collect in a 4 096-byte heap.',
            why: 'The baseline, where both collect often.',
            work: '25 collections each; 218.0 units per collection sweeping, 162.2 copying' },
          { do: 'Double it to 8 192.',
            why: 'Half as many collections for both.',
            work: '7 collections each; 367.3 sweeping, 163.7 copying' },
          { do: 'Double it again to 16 384.',
            why: 'The curves are clearly separating.',
            work: '2 collections each; 669.0 sweeping, 165.0 copying' },
          { do: 'Double it once more to 32 768.',
            why: 'The extreme.',
            work: '1 collection each; 1 270.0 sweeping, 178.0 copying' },
          { do: 'Take the ratio across the eightfold heap change.',
            why: 'The two cost models, stated as numbers.',
            work: 'sweeping 5.83 times more expensive per collection, copying 1.10 times' }
        ],
        answer: 'Across an eightfold increase in heap size, a mark-sweep collection goes from ' +
          '218.0 to 1 270.0 units — 5.83 times — and a copying collection goes from 162.2 to ' +
          '178.0, which is 1.10 times and is noise from the live set drifting. Sweeping is ' +
          'O(heap) because it must walk the heap to sweep it; copying is O(live) because it ' +
          'touches only what it copies. That gap is the entire basis of the generational ' +
          'strategy, and if the copying column had moved with the heap there would be no ' +
          'reason to collect a nursery separately.'
      },
      {
        title: 'What the write barrier is for, priced three ways',
        goal: 'Turn the barrier off, watch the collector break, then price the two that work.',
        setup: 'The same trace under a generational collector with a 1 536-byte nursery, run ' +
          'once with no write barrier, once with an exact remembered set, and once with a ' +
          '128-byte card table. Every collection is checked against the liveness oracle.',
        steps: [
          { do: 'Run with no barrier at all.',
            why: 'The cheapest possible store, and the fastest column in every other respect.',
            work: '0 units of store cost, 0 objects scanned — and 208 reachable objects freed' },
          { do: 'Run with an exact remembered set.',
            why: 'Record the object itself, at three units per qualifying store.',
            work: '786 units of store cost, 349 objects scanned, 1 880 bytes of table, 0 lost' },
          { do: 'Run with a card table at 128-byte cards.',
            why: 'One byte per span, and rescan whatever is in a dirty card.',
            work: '262 units of store cost, 655 objects scanned, 332 bytes of table, 0 lost' },
          { do: 'Read the fast path.',
            why: 'Most stores need no record at all, and the filter is most of what makes a barrier affordable.',
            work: '235 recorded of 262 stores, 27 filtered as young-to-young or old-to-old' },
          { do: 'Compare the scan cost against the store cost.',
            why: 'The card table is a third of the store cost and 1.88 times the scan.',
            work: '262 against 786 at the stores; 655 against 349 at the collection' }
        ],
        answer: 'With no barrier the collector is faster on every column and frees 208 objects ' +
          'the program is still using, which is what a broken collector looks like from the ' +
          'outside: better numbers. Between the two that work, the exact set costs 786 units ' +
          'at the stores and hands the collector 349 objects; the card table costs 262 and ' +
          'hands over 655, in a table one sixth the size. There are three costs — the store, ' +
          'the scan and the table — and no card size minimises all three.'
      }
    ],

    'incremental-collection': [
      {
        title: 'Losing an object on purpose, then not losing it',
        goal: 'Build the black-to-white pointer, then search for it.',
        setup: 'A hand-built fixture forces the ordering: the container is scanned to ' +
          'completion so it is black, then the program stores the value into it and drops the ' +
          'only other path. Beside it, 2 000 randomised interleavings of pointer stores with ' +
          'marking slices over random graphs, checked against a liveness oracle.',
        steps: [
          { do: 'Run the fixture with no barrier.',
            why: 'The shape somebody thought of.',
            work: '1 object reclaimed, and it was the live one; 2 objects shaded' },
          { do: 'Run it with either barrier.',
            why: 'Both prevent this shape.',
            work: '0 reclaimed, 3 shaded, the value survives in both cases' },
          { do: 'Run 2 000 randomised interleavings with no barrier.',
            why: 'The shapes nobody thought of, which is the point of a search.',
            work: '15 of 2 000 runs lose a live object — 0.75 per cent — for 20 objects total' },
          { do: 'Run the same 2 000 with incremental update.',
            why: 'Correct means correct across the search, not across one example.',
            work: '0 runs lose anything, and 650 dead objects are left behind' },
          { do: 'Run them with snapshot at the beginning.',
            why: 'Also correct, and it retains more.',
            work: '0 lost, 1 521 dead objects left — 2.34 times as many' }
        ],
        answer: 'The hand-built fixture proves the barrier handles one shape; the search proves ' +
          'it handles the others, and it is the search that matters. Without a barrier the ' +
          'collector passes 99.25 per cent of two thousand randomised runs and loses an object ' +
          'in the rest — which is exactly the failure rate at which a bug reaches production ' +
          'rather than a test suite. Both barriers lose nothing, and the price of the ' +
          'snapshot barrier is 2.34 times the floating garbage.'
      },
      {
        title: 'The slice bounds the median, not the tail',
        goal: 'Find out which half of the pause distribution incremental marking actually fixes.',
        setup: 'The same trace under incremental marking with a 8 192-byte heap, swept across ' +
          'slice sizes from 1 to 64 objects, with the p50, p99 and total GC work recorded at ' +
          'each.',
        steps: [
          { do: 'Set the slice to 1 object.',
            why: 'The smallest possible increment.',
            work: '504 collections, p50 of 1, p99 of 76' },
          { do: 'Set it to 8.',
            why: 'The default.',
            work: '82 collections, p50 of 8, p99 of 100' },
          { do: 'Set it to 64.',
            why: 'Large enough that the slice is a real pause.',
            work: '20 collections, p50 of 64, p99 of 121' },
          { do: 'Compare the p50 against the slice at each setting.',
            why: 'This is the claim incremental marking actually makes.',
            work: 'p50 equals the slice exactly: 1, 8 and 64' },
          { do: 'Compare the total GC work across the sweep.',
            why: 'Slicing does not reduce the work; it redistributes it.',
            work: '1 188, 1 227 and 1 209 units — flat within 3 per cent' }
        ],
        answer: 'The p50 is the slice, exactly, at every setting — which is what a bounded ' +
          'pause means and why it is a design property rather than a tuning result. The p99 ' +
          'does not follow it down: 76 at a slice of 1 against 121 at 64, but never anywhere ' +
          'near 1. That tail is the SWEEP, which this design has not made incremental at all. ' +
          'Total work stays flat within three per cent across the whole sweep, because none of ' +
          'the work went away.'
      }
    ],

    'modern-collectors': [
      {
        title: 'Eight designs, ten columns, three winners',
        goal: 'Rank the designs and discover the ranking does not exist.',
        setup: 'One trace of 1 599 objects replayed against every collector in the milestone in ' +
          'an 8 192-byte heap with a 768-byte evacuation budget, with pause percentiles rather ' +
          'than averages and the oracle checked at every collection.',
        steps: [
          { do: 'Find the best p99 pause.',
            why: 'The latency column.',
            work: 'reference counting at 0, because it has no collection' },
          { do: 'Find the best throughput.',
            why: 'A different design.',
            work: 'semi-space copying at 0.816' },
          { do: 'Find the smallest peak memory.',
            why: 'A third one.',
            work: 'counting with cycle collection at 3 456 bytes' },
          { do: 'Read the two designs that share a mark and differ only in what follows it.',
            why: 'Compaction is not free.',
            work: 'mark-sweep 371 / 382 / 0.667; mark-compact 460 / 471 / 0.621' },
          { do: 'Read the copying and incremental rows.',
            why: 'The two that beat both of them on different columns.',
            work: 'copying 178 / 186 / 0.816; incremental marking 8 / 101' },
          { do: 'Read the column that is not a trade-off.',
            why: 'Everything above is meaningless without it.',
            work: '8 of 8 designs freed no reachable object' }
        ],
        answer: 'Three columns, three different winners, and none of them is the design most ' +
          'people would name. Mark-compact costs 24 per cent more per collection than ' +
          'mark-sweep for the fragmentation it removes, generational takes the middle of ' +
          'everything, and incremental marking has the lowest median pause of any tracing ' +
          'design at 8 with a p99 of 101. Change the heap size and the winners move again — ' +
          'which is the point of running eight over one trace rather than quoting eight papers.'
      },
      {
        title: 'Garbage-first against the optimum it approximates',
        goal: 'Measure a heuristic against an exact answer, on data where it wins and where it loses.',
        setup: 'The region census of the demo heap — 90 regions of 512 bytes — and a ' +
          'hand-built four-region set designed so the highest-ratio region blocks two better ' +
          'ones. Both are solved exactly by dynamic programming as well as greedily.',
        steps: [
          { do: 'Rank the real heap by garbage per byte copied and take within the budget.',
            why: 'The heuristic, on real data.',
            work: '77 regions chosen, 744 bytes copied, 37 760 bytes reclaimed' },
          { do: 'Solve the same selection exactly.',
            why: 'The denominator has to be computed, not assumed.',
            work: '37 776 bytes reclaimed for 752 copied — the greedy answer is 100.0 per cent of it' },
          { do: 'Count the regions that hold nothing live.',
            why: 'This is why the heuristic does so well.',
            work: 'a wholly dead region costs 0 bytes to evacuate and returns everything' },
          { do: 'Apply the same two policies to the constructed set at a budget of 100.',
            why: 'The shape where greedy loses: one region at ratio 61/60 blocking two at 1.0.',
            work: 'garbage-first reclaims 73 of an available 100 — 73.0 per cent' },
          { do: 'Apply the emptiest-first policy to both.',
            why: 'A second heuristic, to check the first is not accidentally good.',
            work: '98.8 per cent on the real heap and 62.0 per cent on the constructed set' }
        ],
        answer: 'On the real heap garbage-first returns 100.0 per cent of the exact optimum, ' +
          'which says the heuristic is fine and demonstrates nothing about the heuristic — ' +
          'most of its choices were free, because a wholly dead region costs nothing to take. ' +
          'On a set built to defeat it, the same policy returns 73.0 per cent and ' +
          'emptiest-first returns 62.0. Both optima are computed by dynamic programming rather ' +
          'than assumed, which is what makes the two ratios mean anything at all.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
