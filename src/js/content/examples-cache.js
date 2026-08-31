/** Worked examples for the hierarchy, cache organisation and policies (M37.1-M37.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'memory-hierarchy-numbers': [
      {
        title: 'Recover three cache capacities from timing alone',
        goal: 'Find the size of every level in the simulated machine without reading any of '
          + 'its configuration, and check the three answers against it afterwards.',
        setup: 'A three-level hierarchy: 32 KiB L1 at 4 cycles, 512 KiB L2 at 14, 8 MiB L3 at '
          + '45, and DRAM at 250. The harness walks a shuffled pointer chase over a working '
          + 'set of each size, four passes, discarding the first.',
        steps: [
          { do: 'Walk 1 KiB to 16 MiB, doubling, and record the cycles per access.',
            why: 'The curve is flat while a level holds the whole working set.',
            work: '4.0 cycles up to 32 KiB, then 18.0 to 512 KiB, then 63.0 to 8 MiB, then 313.0' },
          { do: 'Mark every point where the cost rose by more than 1.35x.',
            why: 'A step means the working set stopped fitting somewhere.',
            work: 'three steps: 4.0 to 18.0 (4.50x), 18.0 to 63.0 (3.50x), 63.0 to 313.0 (4.97x)' },
          { do: 'Take the size BELOW each step, not above it.',
            why: 'The largest set that still fitted is the capacity.',
            work: '32 KiB, 512 KiB and 8 MiB' },
          { do: 'Compare against the configuration the harness was never given.',
            why: 'A discovery method is worth nothing until it is checked.',
            work: '32 KiB, 512 KiB, 8 MiB - all three exact' },
          { do: 'Read the flat values as latencies rather than hit times.',
            why: 'A flat stretch is the whole cost of an access served at that level.',
            work: '18.0 at L2 is 4 (L1 miss) + 14 (L2 hit); 63.0 is 4 + 14 + 45' }
        ],
        answer: 'Three capacities, exact, from a loop that allocates memory and times accesses '
          + 'and is told nothing else. The one subtle point is the off-by-one: the answer is '
          + 'the size below each step, because that is the largest working set that still fit. '
          + 'Reading the size above reports every cache as twice its real size, which is the '
          + 'single most common way this measurement goes wrong. The flat values are also '
          + 'worth reading carefully - 18.0 cycles at L2 is not the L2 hit time of 14, it is '
          + 'the L1 miss plus the L2 hit, which is what a program actually pays.'
        },
      {
        title: 'What the ratios say about where to spend an afternoon',
        goal: 'Turn the four latencies into a decision rule, rather than a table to remember.',
        setup: 'The same machine: L1 4 cycles, L2 18, L3 63, DRAM 313 as measured end to end. '
          + 'A loop of 1,000,000 accesses is the unit of comparison.',
        steps: [
          { do: 'Express each level as a multiple of an L1 hit.',
            why: 'The ratios survive a generation change; the absolute numbers do not.',
            work: '1.0x, 4.5x, 15.8x, 78.3x' },
          { do: 'Cost a million accesses that all hit L1.',
            why: 'The floor everything else is measured against.',
            work: '4,000,000 cycles' },
          { do: 'Cost the same million with a 5% miss rate to DRAM.',
            why: 'A small miss rate is not a small cost.',
            work: '0.95 x 4 + 0.05 x 313 = 19.5 cycles per access, 19,450,000 total' },
          { do: 'Ask what saving one instruction per access would be worth instead.',
            why: 'This is the comparison the ratio exists to make.',
            work: '1,000,000 cycles, against the 15,450,000 the misses cost' },
          { do: 'Divide.',
            why: 'To state the rule as a number rather than an opinion.',
            work: '15.45x: the layout change is worth fifteen instruction removals' }
        ],
        answer: 'A 5% miss rate makes the average access five times an L1 hit, and the misses '
          + 'account for 80% of the total cycles even though they are one access in twenty. '
          + 'That is the whole argument for looking at data layout before looking at '
          + 'instruction counts: removing an instruction from every access buys a million '
          + 'cycles and moving the working set into cache buys fifteen. The ratios are what '
          + 'carry - a DRAM access has been worth roughly eighty L1 hits for twenty years, '
          + 'while every absolute figure in this table has changed several times.'
      }
    ],

    'cache-organisation': [
      {
        title: 'Decompose an address, then break the cache with a stride',
        goal: 'Show that the index sits in the middle of the address, and that this single '
          + 'fact is what a conflict-heavy access pattern is exploiting.',
        setup: 'A 4 KiB cache: 16 sets, 4 ways, 64-byte lines. The workload touches 32 lines '
          + 'three times each, at a stride the demo controls.',
        steps: [
          { do: 'Split the address 0x1234 into offset, index and tag.',
            why: 'Every question about placement is answered by these three fields.',
            work: 'offset 52 of 64, index 8 of 16, tag 4' },
          { do: 'Work out which addresses share that index.',
            why: 'The index is the middle bits, so the tag can be anything.',
            work: 'every address 16 x 64 = 1024 bytes apart lands in set 8' },
          { do: 'Run the 32-line walk at a 64-byte stride and count hits.',
            why: 'A stride of one line spreads across every set.',
            work: '66.7% hit rate, 32 misses of 96 accesses' },
          { do: 'Raise the stride to 2048 bytes and count again.',
            why: '2048 is 32 sets x 64 bytes on the swept cache, so half the table is unreachable.',
            work: '0.0% hit rate, 96 misses - every access a miss' },
          { do: 'Look at the occupancy grid at a 4096-byte stride.',
            why: 'To see the capacity that is going unused.',
            work: '1 set of 16 occupied: a 4 KiB cache holding 256 bytes' }
        ],
        answer: 'The same 32 lines, the same three passes, and a hit rate that goes from 66.7% '
          + 'to zero when the stride crosses the set span. Nothing about the cache changed and '
          + 'nothing about the amount of data changed; only the middle bits of the addresses '
          + 'did. This is why a power-of-two array dimension is a performance hazard and an '
          + 'odd one is not, and why the fix is usually to change the stride rather than to '
          + 'buy a bigger cache - the grid shows fifteen empty sets while the sixteenth thrashes.'
        },
      {
        title: 'Associativity and line size, each swept with the capacity held fixed',
        goal: 'Separate the two shape decisions from the capacity decision, by changing each '
          + 'one while the total bytes stay the same.',
        setup: 'A fixed 32 KiB of capacity, re-shaped from 512 sets x 1 way to 16 sets x 32 '
          + 'ways, against a workload of 16 lines at a 4096-byte stride.',
        steps: [
          { do: 'Run direct-mapped: 512 sets, 1 way.',
            why: 'One line per set, so any two conflicting lines evict each other.',
            work: '0.0% hit rate, 8 of 512 sets in use' },
          { do: 'Raise to 8 ways: 64 sets.',
            why: 'Eight ways is not enough for sixteen conflicting lines.',
            work: 'still 0.0%, and now 1 of 64 sets in use' },
          { do: 'Raise to 16 ways: 32 sets.',
            why: 'The ways have reached the number of colliding lines.',
            work: '75.0% - everything, all at once' },
          { do: 'Now hold the shape and sweep the line size on a sparse walk.',
            why: 'Line size is a bet on spatial locality, and this walk loses the bet.',
            work: '16 B: 256 misses, 4096 B fetched; 256 B: 64 misses, 16384 B fetched' },
          { do: 'Compare bytes fetched against bytes used in each row.',
            why: 'The miss count improves and the waste does not.',
            work: '2048 B used throughout: waste rises from 2.0x to 8.0x' }
        ],
        answer: 'Associativity is a cliff, not a slope: nothing at all until the ways reach the '
          + 'number of conflicting lines, then everything. That is what "raise the '
          + 'associativity" buys, and it buys nothing against a working set that simply does '
          + 'not fit. Line size is the opposite shape - a smooth trade where bigger lines '
          + 'always mean fewer misses and always mean more wasted traffic, and on this sparse '
          + 'walk the waste reaches 8x while the miss count only falls fourfold. Both are '
          + 'measured with the capacity held constant, which is what makes them statements '
          + 'about shape rather than about size.'
      }
    ],

    'cache-policies': [
      {
        title: 'Two workloads where the write policy answer is opposite',
        goal: 'Measure the traffic each write policy generates, and show that no policy wins '
          + 'both workloads.',
        setup: 'A 16-set, 4-way cache. Workload one writes the same four lines 1000 times; '
          + 'workload two writes 1000 different lines once each. Traffic counts fills, '
          + 'write-outs and forwarded writes together.',
        steps: [
          { do: 'Run the hot loop under write-back with write-allocate.',
            why: 'The deferral is what write-back is for.',
            work: '4 transactions for 1000 writes' },
          { do: 'Run the same loop under write-through.',
            why: 'Every write reaches the next level.',
            work: '1000 transactions - a factor of 250' },
          { do: 'Run the streaming workload under write-back with write-allocate.',
            why: 'Each write miss fetches a line it is about to overwrite completely.',
            work: '1936 transactions for 1000 writes' },
          { do: 'Run it under write-back with no-write-allocate.',
            why: 'A write that will never be read back has no reason to fetch.',
            work: '1000 transactions - the fetch was pure waste' },
          { do: 'Look for a row that wins both columns.',
            why: 'That is the actual result.',
            work: 'there is none: 4/1936 against 1000/1000' }
        ],
        answer: 'Write-back beats write-through by 250x on a rewritten working set and loses '
          + 'to no-write-allocate by nearly 2x on a streaming one, where the allocate policy '
          + 'fetches 936 lines that are immediately overwritten in full. The two decisions are '
          + 'separable - what to do on a hit, and what to do on a miss - and real caches pick '
          + 'write-back with write-allocate because loops are more common than streams, then '
          + 'add non-temporal store instructions so a program that knows it is streaming can '
          + 'say so. The dirty bit is the whole cost of the winning policy: one bit per line '
          + 'is what makes a deferred write correct.'
        },
      {
        title: 'Scan resistance, measured until it runs out',
        goal: 'Show what RRIP protects against, and find the exact scan length at which the '
          + 'protection stops working.',
        setup: 'An eight-way set. Four lines are touched twice to establish a working set, '
          + 'then a scan of the given length passes through, then the working set is '
          + 'referenced again. The count is hits on that final reference, out of 160.',
        steps: [
          { do: 'Scan 4 lines and compare LRU with RRIP.',
            why: 'A scan smaller than the spare ways disturbs nothing.',
            work: 'both 156 of 160 - no policy is under pressure yet' },
          { do: 'Scan 8 lines.',
            why: 'Now the scan is as large as the set.',
            work: 'LRU 80, RRIP 156 - RRIP keeps the whole working set' },
          { do: 'Scan 12 lines.',
            why: 'To find where the protection starts to give.',
            work: 'LRU 80, RRIP 84 - most of the advantage is gone' },
          { do: 'Scan 16 lines.',
            why: 'Past twice the set size.',
            work: 'LRU 80, RRIP 80 - identical' },
          { do: 'Scan 48 lines and check nothing recovers.',
            why: 'To state the bound rather than imply an unlimited one.',
            work: 'LRU, pseudo-LRU, FIFO and RRIP all 80; random 63, which is worse' }
        ],
        answer: 'RRIP holds the entire working set through a scan of eight and has lost the '
          + 'advantage entirely by sixteen. That bound is not a flaw, it is arithmetic: the '
          + 're-reference counter has four values, so the insertion policy buys a bounded '
          + 'amount of protection rather than an unlimited one. The honest headline for the '
          + 'whole section is in the other direction - across five ordinary workloads the '
          + 'policies are within a few per cent of each other, and random is closer to LRU '
          + 'than anybody expects. Replacement matters on patterns with a period near the '
          + 'capacity, and on everything else the effort belongs in the layout.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
