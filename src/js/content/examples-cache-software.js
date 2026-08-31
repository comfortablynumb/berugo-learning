/** Worked examples for miss analysis, cache-friendly code and the TLB (M37.4-M37.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'cache-performance-analysis': [
      {
        title: 'Diagnose 41,992 misses into three categories that sum exactly',
        goal: 'Turn one miss rate into three numbers that each imply a different fix, and '
          + 'check that they reconcile with the miss count rather than approximating it.',
        setup: 'The naive i, j, k matrix multiply at n = 64: 786,432 accesses against a 32 KiB '
          + 'cache built as 64 sets x 8 ways x 64 bytes. Two extra simulations run beside the '
          + 'real one - an infinite cache to answer "first reference?" and a fully associative '
          + 'cache of the same capacity to answer "would any placement have helped?".',
        steps: [
          { do: 'Run the trace and record the miss count.',
            why: 'The number to be decomposed.',
            work: '41,992 misses of 786,432 accesses - 5.34%' },
          { do: 'Count misses whose line had never been referenced before.',
            why: 'No cache of any design could have had them.',
            work: '1,536 compulsory - 3.7% of the misses' },
          { do: 'Of the rest, count those that also missed in the fully associative cache.',
            why: 'A perfect placement would not have saved them; the set is simply too small.',
            work: '8,064 capacity - 19.2%' },
          { do: 'Count those that missed here and hit in the fully associative cache.',
            why: 'The capacity was enough and the mapping was not.',
            work: '32,392 conflict - 77.1%' },
          { do: 'Add the three and compare with the miss count.',
            why: 'Categories that do not reconcile are estimates wearing a measurement\'s clothes.',
            work: '1,536 + 8,064 + 32,392 = 41,992, exactly' }
        ],
        answer: 'Three quarters of the misses are conflict misses, which says the working set '
          + 'was small enough and the addresses were laid out wrong - so the fix is padding, a '
          + 'stride change or a loop reorder, and buying a bigger cache would do nothing. A '
          + 'single 5.34% miss rate would have supported any of the three fixes equally, which '
          + 'is why it is not a diagnosis. The categories cost two extra simulations and they '
          + 'sum to the miss count exactly, which is the property that makes them a '
          + 'measurement: each miss travels down exactly one path, and the demo asserts the '
          + 'sum rather than assuming it.'
        },
      {
        title: 'AMAT computed by recursion, then checked against the run',
        goal: 'Compute the average memory access time from the level hit times and miss rates, '
          + 'and confirm the formula against what the simulated run actually accumulated.',
        setup: 'The same trace through the full hierarchy: L1 4 cycles, L2 14, L3 45, DRAM 250. '
          + 'Each level reports its own accesses and hits, so each miss rate is measured at '
          + 'that level rather than assumed.',
        steps: [
          { do: 'Start at the bottom: DRAM always answers.',
            why: 'The recursion needs a base case.',
            work: 'AMAT(DRAM) = 250 cycles' },
          { do: 'L3: hit time plus its miss rate times everything below.',
            why: 'A miss at a level pays that level AND everything under it.',
            work: '45 + 1.00 x 250 = 295.00 cycles' },
          { do: 'L2, whose measured miss rate is 3.61%.',
            why: 'The miss rate is local to the level, not global to the program.',
            work: '14 + 0.0361 x 295.00 = 24.66 cycles' },
          { do: 'L1, whose measured miss rate is 5.34%.',
            why: 'This is the number the program experiences.',
            work: '4 + 0.0534 x 24.66 = 5.32 cycles' },
          { do: 'Compare against the cycles the run accumulated per access.',
            why: 'A formula never checked against a run is not a model of anything.',
            work: '5.32 against 5.32 - they agree' }
        ],
        answer: 'The whole hierarchy is worth 5.32 cycles per access on this workload even '
          + 'though a DRAM trip costs 250, because 94.7% of accesses never leave L1. That is '
          + 'the arithmetic that makes the arrangement pay, and it is also the trap: the '
          + 'local miss rate at L2 is 3.61% and the global one is far smaller, so quoting the '
          + 'wrong one changes the answer by an order of magnitude. The check at the end is '
          + 'the part worth copying - the recursion and the run come from the same measured '
          + 'miss rates, and asserting that they agree is what stops the formula drifting away '
          + 'from the machine it claims to describe.'
      }
    ],

    'cache-friendly-software': [
      {
        title: 'One matrix multiply, three loop nests, 13.67x fewer trips to memory',
        goal: 'Take the naive nest through two transformations, using the three-Cs '
          + 'decomposition to pick each one, and confirm that each removed the category it '
          + 'was aimed at.',
        setup: 'Matrix multiply at n = 64, 8-byte elements, against a 32 KiB 8-way cache. '
          + 'Every version performs exactly 786,432 accesses - the same arithmetic in a '
          + 'different order.',
        steps: [
          { do: 'Measure the naive i, j, k nest and decompose its misses.',
            why: 'The decomposition picks the transformation.',
            work: '41,992 trips; 1,536 compulsory, 8,064 capacity, 32,392 conflict' },
          { do: 'Conflict dominates, so change the order the inner loop walks B.',
            why: 'The i, k, j nest walks a row of B instead of a column.',
            work: '9,551 trips - 4.40x fewer, and the conflict column is now 0' },
          { do: 'Decompose again: capacity now dominates at 8,015.',
            why: 'The next fix has to be aimed at the new dominant category.',
            work: '8,015 capacity against 1,536 compulsory: the working set does not fit' },
          { do: 'Size the tile: three t x t tiles of 8-byte elements in 32 KiB.',
            why: 'C, A and B tiles all have to be resident at once.',
            work: '3 x t x t x 8 <= 32768 gives t = 36' },
          { do: 'Block at tile 16 and decompose a third time.',
            why: 'To check the capacity misses went where they were supposed to.',
            work: '3,072 trips: 1,536 compulsory, 1,536 capacity, 0 conflict' },
          { do: 'Compare the first and last rows.',
            why: 'Identical arithmetic, different residency.',
            work: '41,992 to 3,072 - 13.67x, and 14.68 cycles per access to 4.78' }
        ],
        answer: 'Each transformation removed exactly the category it was aimed at, and that is '
          + 'how you know the diagnosis was right rather than the change merely helpful. The '
          + 'blocked version is down to almost nothing but compulsory misses, which is the '
          + 'floor: the only move left would be to touch less data. It is worth noticing what '
          + 'the sizing rule is worth - the arithmetic picks 36 and a sweep picks 40 at 2,998 '
          + 'trips against 3,292 at the calculated size, so the calculation gets you close '
          + 'enough to start and the sweep is still worth running.'
        },
      {
        title: 'Padding: 2.5x for eight bytes per row, and nothing at all on the blocked version',
        goal: 'Fix the same conflict misses a second way, by changing the allocation instead '
          + 'of the loop, and find where the technique stops applying.',
        setup: 'The naive nest at n = 64. The row stride is 64 x 8 = 512 bytes, which is a '
          + 'multiple of the 64-set x 64-byte set span, so every row of B starts in the same '
          + 'set. Padding adds elements to each row to break that alignment.',
        steps: [
          { do: 'Confirm the arithmetic of the collision.',
            why: 'The conflict has to be explained before it is fixed.',
            work: 'set span 64 x 64 = 4096 B; row stride 512 B divides it 8 times' },
          { do: 'Measure with no padding.',
            why: 'The baseline, and its conflict count.',
            work: '41,992 trips, 32,392 of them conflict' },
          { do: 'Add one element of padding per row.',
            why: 'The stride becomes 520 bytes, which shares no factor with the set span.',
            work: '16,792 trips - 2.50x fewer - and 0 conflict misses' },
          { do: 'Try 2, 4 and 8 elements.',
            why: 'To see whether more padding keeps helping.',
            work: '19,856, 23,982 and 9,151 - not monotone, and all with 0 conflicts' },
          { do: 'Apply padding to the blocked version.',
            why: 'The blocked version had no conflict misses left to remove.',
            work: '3,072 becomes 3,144 - slightly worse, because the padding is still data' }
        ],
        answer: 'One extra element per row - 512 bytes on a 32 KiB matrix - removes every one '
          + 'of the 32,392 conflict misses. That is the cheapest fix on the page and it does '
          + 'not touch the loop at all. Two things are worth taking from the rest of the '
          + 'table. More padding is not better: once the conflicts are gone the remaining '
          + 'variation is about how the padded stride interacts with the line size, and it '
          + 'moves in both directions. And on the blocked version the technique is not merely '
          + 'useless but faintly harmful - 3,072 trips become 3,144, because there were no '
          + 'conflicts left to remove and the padding is still 24 extra lines of data to '
          + 'touch. That is the general rule for every transformation in the catalogue, in its '
          + 'honest form: applying the wrong one leaves a more complicated program that is '
          + 'usually no faster and sometimes slightly slower.'
      }
    ],

    'virtual-memory-and-the-tlb': [
      {
        title: 'Find the translation reach without being told the entry count',
        goal: 'Locate the knee in the translation cost curve, and show it is exactly entries '
          + 'times page size rather than anything fitted.',
        setup: '64 translation entries over 4 KiB pages, a four-level page table at 30 cycles '
          + 'per level, and a shuffled walk over a working set the demo sweeps.',
        steps: [
          { do: 'Compute the reach from the configuration, to have an answer to check against.',
            why: 'Each entry describes exactly one page.',
            work: '64 x 4 KiB = 256 KiB' },
          { do: 'Sweep the working set and record the hit rate.',
            why: 'The curve is what the measurement actually sees.',
            work: '99.5% at 64, 128 and 256 KiB; 49.7% at 512 KiB; 24.6% at 1024 KiB' },
          { do: 'Find where it breaks.',
            why: 'The knee is the answer.',
            work: 'between 256 KiB and 512 KiB - the reach, exactly' },
          { do: 'Cost one miss: a walk is four dependent memory accesses.',
            why: 'Each level\'s address comes from the level above, so nothing overlaps.',
            work: '4 x 30 + 1 = 121 cycles' },
          { do: 'Cost an access at 4.00x the reach.',
            why: 'To put a number on what falling off the cliff is worth.',
            work: '0.246 x 1 + 0.754 x 121 = 91.5 cycles per access' },
          { do: 'Compare with the same working set below the reach.',
            why: 'Same machine, same code, sixty times the cost.',
            work: '1.6 against 91.5 - a factor of 57' }
        ],
        answer: 'The knee lands on 256 KiB and nobody told the measurement where to look: it '
          + 'is entries times page size and nothing else. What makes the cliff so steep is '
          + 'that a walk is a pointer chase - four memory accesses each of whose addresses '
          + 'comes from the one before, so none of them overlap, which is the worst pattern '
          + 'an out-of-order machine can be handed. The trap this creates for the microbench '
          + 'in 37.10 is worth noting now: 256 KiB sits between typical L1 and L2 capacities, '
          + 'so a step in a latency curve at that size could be either a cache or the '
          + 'translation reach.'
        },
      {
        title: 'Huge pages and address-space identifiers, each fixing a different thing',
        goal: 'Measure the two mechanisms separately: one raises the reach, the other survives '
          + 'a context switch, and neither substitutes for the other.',
        setup: 'The same 64-entry buffer and 1 MiB working set that costs 91.5 cycles per '
          + 'access. Then a second experiment: 16 pages touched, a switch to another address '
          + 'space, and a switch back.',
        steps: [
          { do: 'Switch the page size to 2 MiB and recompute the reach.',
            why: 'The buffer did not change; each entry now describes 512 times as much.',
            work: '64 x 2 MiB = 128 MiB, against 256 KiB' },
          { do: 'Re-run the 1 MiB working set.',
            why: 'It now fits inside a handful of entries.',
            work: '100.0% hit rate, 1.0 cycle per access, against 91.5' },
          { do: 'Note what it did not fix.',
            why: 'A huge page is not a cache fix.',
            work: 'the same 1 MiB still exceeds a 32 KiB L1 by 32x' },
          { do: 'Now touch 16 pages, switch address space, and switch back with identifiers on.',
            why: 'The identifier is part of the lookup key.',
            work: '16 entries survive, 0 walks after the switch' },
          { do: 'Repeat with a flush on every switch.',
            why: 'This is what a buffer without identifiers must do to stay correct.',
            work: '0 entries survive, 16 walks - 1,936 cycles of pure re-translation' }
        ],
        answer: 'Huge pages do not make translation faster; they make each entry describe more, '
          + 'which is a complete fix for a reach problem and no help at all with a cache miss. '
          + 'Their costs are real - internal fragmentation, a slower fault, and contiguous '
          + 'physical memory to find - so they are a decision rather than a default. Address '
          + 'identifiers solve something else entirely: without them every context switch '
          + 'empties the buffer, and the sixteen walks measured here are what a machine '
          + 'switching a thousand times a second pays over and over. The identifier is also a '
          + 'correctness mechanism first - a buffer that returned another space\'s frame would '
          + 'be a protection hole rather than a slow machine.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
