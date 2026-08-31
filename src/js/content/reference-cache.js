/** Reference entries for the hierarchy, cache organisation and policies (M37.1-M37.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'memory-hierarchy-numbers': {
      summary: 'The latency ladder of a modern machine, recovered from timing rather than '
        + 'quoted: a three-level hierarchy whose capacities the demo discovers from the shape '
        + 'of a working-set sweep, with the ratios between the levels stated as the thing '
        + 'worth carrying. The section exists to make one comparison automatic - a DRAM access '
        + 'is worth about eighty L1 hits, so any change that moves a workload between levels '
        + 'dominates any change that removes instructions.',
      intuition: 'Every level is a bet that the next access is one the level above has seen, '
        + 'or sits beside something it has.',
      formulation: {
        equations: [
          {
            label: 'The ladder, measured end to end on the simulated machine',
            expr: 'cost of an access served at each level',
            terms: [
              { sym: 'L1 (32 KiB)', meaning: '4 cycles - the unit everything else is in' },
              { sym: 'L2 (512 KiB)', meaning: '18 cycles end to end: 4 to miss L1, 14 to hit L2' },
              { sym: 'L3 (8 MiB)', meaning: '63 cycles - 15.8 L1 hits' },
              { sym: 'DRAM', meaning: '313 cycles - 78 L1 hits' }
            ]
          },
          {
            label: 'Capacities recovered from the curve, against the configuration',
            expr: 'the size BELOW each step is the capacity',
            terms: [
              { sym: 'step at 32 KiB', meaning: '4.0 to 18.0 cycles, a 4.50x rise' },
              { sym: 'step at 512 KiB', meaning: '18.0 to 63.0, a 3.50x rise' },
              { sym: 'step at 8 MiB', meaning: '63.0 to 313.0, a 4.97x rise' },
              { sym: 'the check', meaning: 'all three exact, and the method was told none of them' }
            ]
          },
          {
            label: 'What a 5% miss rate to DRAM costs on a million accesses',
            expr: 'average = hit fraction x hit cost + miss fraction x miss cost',
            readAs: 'the average is the hit cost weighted by how often you hit, plus the miss '
              + 'cost weighted by how often you miss',
            terms: [
              { sym: 'all hits', meaning: '4,000,000 cycles' },
              { sym: '5% to DRAM', meaning: '0.95 x 4 + 0.05 x 313 = 19.45 cycles per access' },
              { sym: 'the excess', meaning: '15,450,000 cycles, 80% of the total' },
              { sym: 'against', meaning: 'removing one instruction per access buys 1,000,000' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Capacities rise faster than latencies',
          why: 'It is the trade that makes the arrangement pay at all.',
          breaks: 'About 16x per level in capacity against 3 to 4x in latency.'
        },
        {
          name: 'A flat stretch is an end-to-end cost, not a hit time',
          why: 'A program served by L2 has already paid the L1 miss.',
          breaks: '18.0 measured at L2 against a configured hit time of 14.'
        },
        {
          name: 'The capacity is the size below the step',
          why: 'That is the largest working set that still fitted.',
          breaks: 'Reading the size above reports every cache as twice its real size.'
        },
        {
          name: 'The ratios outlive the absolute figures',
          why: 'Every number here has changed several times; the ratios have not.',
          breaks: 'A DRAM access has been worth roughly eighty L1 hits for twenty years.'
        }
      ],
      complexity: [
        { operation: 'one access through the hierarchy', average: 'one probe per level until a hit', worst: 'every level probed, then DRAM' },
        { operation: 'the working-set sweep', average: 'passes x lines per size, over a geometric set of sizes', worst: 'dominated by the largest size' },
        { operation: 'step detection', average: 'one pass over the curve', worst: 'the same' },
        { operation: 'AMAT from the measured rates', average: 'one multiply and add per level', worst: 'the same' }
      ],
      failureModes: [
        {
          symptom: 'A discovery routine reports every cache as twice its real size.',
          cause: 'The size above each step was read instead of the size below it.',
          fix: 'The answer is the largest working set that still fitted, which is below the step.'
        },
        {
          symptom: 'The curve has no steps at all.',
          cause: 'A sequential walk, which measures bandwidth, or an ordered chase the prefetcher followed.',
          fix: 'Shuffle the chase so exactly one access is outstanding at a time.'
        },
        {
          symptom: 'Every point on the curve is too high and the steps are shallow.',
          cause: 'The first pass was included, and its misses are compulsory at every size.',
          fix: 'Discard the first pass and average the rest.'
        },
        {
          symptom: 'An optimisation that removed instructions changed nothing.',
          cause: 'The program was memory bound, so the instructions were free.',
          fix: 'Cost the misses first; at 5% to DRAM they are 80% of the cycles.'
        }
      ],
      inTheWild: [
        'Every published "latency numbers every programmer should know" table, which is this ladder.',
        'lmbench and the memory-mountain figures in Bryant and O\'Hallaron.',
        'Roofline analysis, which turns the same ratios into an operational-intensity threshold.',
        'The storage hierarchy below DRAM: SSD and network latencies continue the same geometry.'
      ],
      sources: [
        { title: 'Hennessy and Patterson - Computer Architecture, appendix B and chapter 2', note: 'the hierarchy and its arithmetic' },
        { title: 'Bryant and O\'Hallaron - Computer Systems: A Programmer\'s Perspective, chapter 6', note: 'the memory mountain, which is this sweep' },
        { title: 'Drepper - What Every Programmer Should Know About Memory (2007)', note: 'long, dated in its absolutes, and still right about the ratios' },
        { title: 'McCalpin - STREAM benchmark', note: 'the bandwidth measurement this section is careful not to make by accident' }
      ]
    },

    'cache-organisation': {
      summary: 'Where a line is allowed to live: the address split into offset, index and tag, '
        + 'the index taken from the middle of the address, and the consequences of that one '
        + 'decision. Associativity and line size are swept with the total capacity held fixed, '
        + 'so both are statements about shape rather than about size, and the occupancy grid '
        + 'shows a 4 KiB cache holding 256 bytes when the stride is wrong.',
      intuition: 'The index picks the row and the tag is compared across it. Everything else '
        + 'about cache organisation follows.',
      formulation: {
        equations: [
          {
            label: 'The three fields, on a 16-set 4-way cache with 64-byte lines',
            expr: 'address = tag : index : offset',
            readAs: 'the address splits into a tag, then an index, then an offset, from the '
              + 'high bits down to the low ones',
            terms: [
              { sym: 'offset', meaning: 'log2(64) = 6 low bits: which byte in the line' },
              { sym: 'index', meaning: 'log2(16) = 4 middle bits: which set the line must live in' },
              { sym: 'tag', meaning: 'everything above: what distinguishes it inside the set' },
              { sym: '0x1234', meaning: 'offset 52, index 8, tag 4' }
            ]
          },
          {
            label: 'The set span: which addresses collide',
            expr: 'set span = sets x line bytes',
            terms: [
              { sym: '16 sets, 64 B lines', meaning: 'addresses 1024 bytes apart share a set' },
              { sym: '64 sets, 64 B lines', meaning: 'a 2048-byte stride reaches only half the sets' },
              { sym: 'measured', meaning: 'hit rate 66.7% at a 64 B stride, 0.0% at 2048 B' },
              { sym: 'at a 4096 B stride', meaning: '1 set of 16 in use: 4 KiB of cache holding 256 B' }
            ]
          },
          {
            label: 'Associativity at a fixed 32 KiB, against 16 lines at a 4096-byte stride',
            expr: 'the ways have to reach the number of conflicting lines',
            terms: [
              { sym: '1 way (512 sets)', meaning: '0.0% hit rate' },
              { sym: '8 ways (64 sets)', meaning: 'still 0.0%' },
              { sym: '16 ways (32 sets)', meaning: '75.0% - everything at once' },
              { sym: 'the shape', meaning: 'a cliff, not a slope' }
            ]
          },
          {
            label: 'Line size at a fixed 32 KiB, one 8-byte element every 64 bytes',
            expr: 'bigger lines: fewer misses, identical waste',
            terms: [
              { sym: '16 B lines', meaning: '256 misses, 4,096 B fetched, 2.0x waste' },
              { sym: '64 B lines', meaning: '256 misses, 16,384 B fetched, 8.0x waste' },
              { sym: '256 B lines', meaning: '64 misses, 16,384 B fetched, 8.0x waste' },
              { sym: 'the trade', meaning: 'spatial locality is a bet; a sparse walk loses it' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The index comes from the middle of the address',
          why: 'It is why two addresses far apart in memory can share a set.',
          breaks: 'Above the offset and below the tag, in every real cache.'
        },
        {
          name: 'Capacity is sets x ways x line bytes',
          why: 'Every sweep here holds it constant so the result is about shape.',
          breaks: '512x1, 64x8 and 32x16 are all 32 KiB with 64-byte lines.'
        },
        {
          name: 'Associativity is a cliff',
          why: 'Nothing helps until the ways reach the number of colliding lines.',
          breaks: '0.0% at 8 ways and 75.0% at 16, on 16 conflicting lines.'
        },
        {
          name: 'A bigger line never reduces the bytes fetched',
          why: 'The bet is on the neighbours being used, and a sparse walk never uses them.',
          breaks: '2,048 bytes used at every line size; 4,096 to 16,384 fetched.'
        }
      ],
      complexity: [
        { operation: 'decode an address', average: 'two shifts and a mask', worst: 'the same' },
        { operation: 'look up a set', average: 'compare the tag against every way in parallel', worst: 'the ways decide the comparator count and the energy' },
        { operation: 'true LRU state', average: 'log2(ways factorial) bits per set', worst: 'why true LRU is rare above four ways' },
        { operation: 'tree pseudo-LRU state', average: 'ways - 1 bits per set', worst: 'the same, and it is why pLRU is what gets built' }
      ],
      failureModes: [
        {
          symptom: 'A power-of-two array dimension is far slower than an odd one.',
          cause: 'The row stride divides the set span, so every row starts in the same set.',
          fix: 'Pad the rows; one extra element changed the stride and removed every conflict.'
        },
        {
          symptom: 'A bigger cache does not help at all.',
          cause: 'The occupancy is one set of many; the problem is mapping, not size.',
          fix: 'Look at the occupancy before buying capacity - the grid says which it is.'
        },
        {
          symptom: 'Raising associativity is expected to fix a working set that does not fit.',
          cause: 'Associativity addresses conflicts and nothing else.',
          fix: 'Decompose the misses first (37.4); capacity misses need a smaller working set.'
        },
        {
          symptom: 'A structure with one hot field is fetching eight times the bytes it uses.',
          cause: 'The line is the unit of transfer, and the neighbours are never touched.',
          fix: 'Split the structure so the hot fields are contiguous - the same effect measured in M02.'
        }
      ],
      inTheWild: [
        'Cache-conscious array padding in numerical libraries, still the cheapest fix there is.',
        'The 4 KiB aliasing rules in Intel and AMD optimisation manuals.',
        'Page colouring in operating systems, which is this arithmetic applied to physical frames.',
        'Set-associative structures far from caches: TLBs, branch predictors, hash tables with buckets.'
      ],
      sources: [
        { title: 'Hennessy and Patterson - Computer Architecture, appendix B', note: 'the organisation and the four questions' },
        { title: 'Smith - Cache Memories (ACM Computing Surveys, 1982)', note: 'the survey that fixed the vocabulary' },
        { title: 'Bryant and O\'Hallaron - Computer Systems, chapter 6', note: 'the address split, worked through carefully' },
        { title: 'Intel 64 and IA-32 Optimization Reference Manual', note: 'the aliasing and alignment rules a real part imposes' }
      ]
    },

    'cache-policies': {
      summary: 'What happens on a write and what leaves when a line has to go. Write-back '
        + 'against write-through and write-allocate against no-write-allocate are measured on '
        + 'two workloads whose answers are opposite, and five replacement policies are swept '
        + 'against five access patterns - which produces the honest headline that on ordinary '
        + 'patterns the replacement policy barely matters at all.',
      intuition: 'One of the write transitions costs a memory transaction, and it happens '
        + 'later than the write that caused it.',
      formulation: {
        equations: [
          {
            label: 'Write policy: 1,000 writes to 4 lines, then to 1,000 lines',
            expr: 'traffic = fills + write-outs + forwarded writes',
            terms: [
              { sym: 'write-back, hot loop', meaning: '4 transactions' },
              { sym: 'write-through, hot loop', meaning: '1,000 - a factor of 250' },
              { sym: 'write-allocate, streaming', meaning: '1,936: each miss fetches a line it overwrites' },
              { sym: 'no-write-allocate, streaming', meaning: '1,000 - the fetch was pure waste' }
            ]
          },
          {
            label: 'The three line states, and which transition costs anything',
            expr: 'invalid to clean to dirty',
            terms: [
              { sym: 'invalid', meaning: 'nothing here; an eviction costs nothing' },
              { sym: 'clean', meaning: 'fetched and only read; the copy below is identical' },
              { sym: 'dirty', meaning: 'written under write-back; eviction pays a write' },
              { sym: 'the dirty bit', meaning: 'one bit per line, and the whole of what makes write-back correct' }
            ]
          },
          {
            label: 'Scan resistance: a 4-line working set behind a scan, hits out of 160',
            expr: 'RRIP inserts predicting a distant re-reference',
            terms: [
              { sym: 'scan of 4', meaning: 'LRU 156, RRIP 156 - nothing is under pressure' },
              { sym: 'scan of 8', meaning: 'LRU 80, RRIP 156 - the whole working set survives' },
              { sym: 'scan of 16', meaning: 'LRU 80, RRIP 80 - the protection has run out' },
              { sym: 'the bound', meaning: 'the counter has 4 values, so the protection is finite by construction' }
            ]
          },
          {
            label: 'The cyclic-loop fixture: 9 lines through an 8-way set, hits out of 180',
            expr: 'LRU evicts exactly the line about to be wanted',
            terms: [
              { sym: 'true LRU', meaning: '0 of 180' },
              { sym: 'FIFO', meaning: '0 of 180' },
              { sym: 'tree pseudo-LRU', meaning: '0 of 180 - the approximation inherits the pathology' },
              { sym: 'random', meaning: '132 of 180 - the only one with no rule to be aligned against' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The two write decisions are separable',
          why: 'What to do on a hit and what to do on a miss are different questions.',
          breaks: 'Write-back with no-write-allocate is a real and useful combination.'
        },
        {
          name: 'No write policy wins both workloads',
          why: 'The rewritten set and the streaming set want opposite things.',
          breaks: '4 against 1,936 in one column, 1,000 against 1,000 in the other.'
        },
        {
          name: 'A hit resets the RRIP counter and an install does not',
          why: 'Promoting on install makes every line look reused and RRIP degenerates to LRU.',
          breaks: 'That defect showed as RRIP scoring identically to LRU on the scan fixture.'
        },
        {
          name: 'On ordinary patterns the policies are within a few per cent',
          why: 'The differences need a period near the capacity to appear at all.',
          breaks: 'Five policies over five workloads: most groups flat.'
        }
      ],
      complexity: [
        { operation: 'true LRU', average: 'log2(ways factorial) bits per set and an order to maintain', worst: 'impractical above about four ways' },
        { operation: 'tree pseudo-LRU', average: 'ways - 1 bits per set, one bit flipped per level on a touch', worst: 'the same' },
        { operation: 'FIFO', average: 'log2(ways) bits per set', worst: 'the same, and it ignores everything since insertion' },
        { operation: 'RRIP', average: '2 bits per line, and a scan of the set to find a victim', worst: 'up to four sweeps of the set before one qualifies' },
        { operation: 'random', average: 'no state at all', worst: 'no state at all' }
      ],
      failureModes: [
        {
          symptom: 'A streaming write loop generates twice the memory traffic it should.',
          cause: 'Write-allocate fetches every line before overwriting it completely.',
          fix: 'Non-temporal stores, or no-write-allocate for that region.'
        },
        {
          symptom: 'RRIP performs exactly like LRU.',
          cause: 'The install path promoted the line, so the insertion prediction never applied.',
          fix: 'Reset the counter on a hit only; leave an installed line at its insertion value.'
        },
        {
          symptom: 'A loop one line larger than the associativity gets no hits at all.',
          cause: 'LRU evicts precisely the line about to be referenced.',
          fix: 'Nothing in the policy; shrink the loop\'s working set, or accept that random does better here.'
        },
        {
          symptom: 'A replacement change is expected to fix a slow program.',
          cause: 'The policy only matters on patterns with a period near the capacity.',
          fix: 'Measure first; on ordinary patterns the effort belongs in the data layout.'
        }
      ],
      inTheWild: [
        'Tree pseudo-LRU in the L1 and L2 caches of most shipping processors.',
        'RRIP and its descendants in last-level caches, where scans are common.',
        'Non-temporal store instructions, which are a program-level no-write-allocate.',
        'ARC and CLOCK-Pro in page caches and databases - the same problem one level up.'
      ],
      sources: [
        { title: 'Jaleel et al. - High Performance Cache Replacement Using Re-Reference Interval Prediction (ISCA 2010)', note: 'RRIP, including the insertion argument' },
        { title: 'Hennessy and Patterson - Computer Architecture, appendix B', note: 'the write policies and their traffic' },
        { title: 'Belady - A Study of Replacement Algorithms (1966)', note: 'the optimal policy every other one is measured against' },
        { title: 'Qureshi et al. - Adaptive Insertion Policies for High Performance Caching (ISCA 2007)', note: 'the insertion idea RRIP builds on' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
