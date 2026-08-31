/** Concepts for the hierarchy, organisation and policies (M37.1-M37.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'memory-hierarchy-numbers': [
      {
        term: 'The hierarchy is a bet on locality',
        diagram: {
          definition: [
            'flowchart LR',
            '    C["core"] --> L1["L1: small and fast"]',
            '    L1 --> L2["L2: larger and slower"]',
            '    L2 --> L3["L3: larger again"]',
            '    L3 --> D["DRAM: all of it, and eighty times an L1 hit"]'
          ].join('\n'),
          caption: 'Every level is a bet that the next access is one the level above has seen, '
            + 'or sits beside something it has.'
        },
        plain: 'Fast storage is expensive per bit, so the fast part is small and bets on reuse.',
        formal: 'temporal locality is reuse over time; spatial locality is reuse of neighbours',
        detail: 'Neither property is guaranteed by anything - a program that touched memory '
          + 'uniformly at random would get nothing at all from a cache of any size. What makes '
          + 'the arrangement pay is that real programs loop over the same data and walk '
          + 'contiguous structures, so a level that keeps the recently used lines and fetches '
          + 'their neighbours catches most of what the level above missed. Every optimisation '
          + 'in this milestone is an attempt to make one of those two properties more true.',
        example: 'The demo recovers 32 KiB, 512 KiB and 8 MiB from a timing curve alone, '
          + 'without being told any of them.'
      },
      {
        term: 'The ratios are what transfer, not the nanoseconds',
        plain: 'A few cycles, a few tens, a few hundreds, and then a hundred thousand.',
        formal: 'DRAM costs about eighty L1 hits, and has done for twenty years',
        detail: 'Every absolute figure in this subject has moved by orders of magnitude since '
          + 'the 1990s and the proportions have barely moved at all, because they follow from '
          + 'physics and economics rather than from any particular process. That makes the '
          + 'ratios worth memorising and the nanosecond tables worth looking up: a decision '
          + 'that changes which level a workload lands in is worth more than one that changes '
          + 'how many instructions it executes, and the ratio is what says so.',
        example: 'On this model an L1 hit is 4 cycles, L2 is 18, L3 is 63 and DRAM is 313.'
      },
      {
        term: 'A pointer chase measures latency; a sequential walk does not',
        plain: 'One access outstanding at a time is the only way to see a round trip.',
        formal: 'a chase has one access in flight; a stream has as many as the machine allows',
        detail: 'This is the single most common way a memory measurement is reported wrongly, '
          + 'and it is wrong by an order of magnitude rather than by a little. In a chase each '
          + 'address is the value the previous load returned, so nothing overlaps and the time '
          + 'per access is the full round trip. In a sequential walk the addresses are known in '
          + 'advance, several are in flight at once, and the average time per access is a '
          + 'bandwidth figure. Reporting one as the other is the error.',
        example: 'Switching the demo from a chase to a sequential walk flattens the curve to '
          + '1.0 cycles at every size - below the 4-cycle L1 hit, which no latency can be.'
      },
      {
        term: 'The shuffle is what defeats the prefetcher',
        plain: 'A chase laid out in address order is a sequential walk in disguise.',
        formal: 'the next address must be unpredictable from the previous ones',
        detail: 'A prefetcher watches the address stream and fetches ahead of any pattern it '
          + 'can see, so a chase whose nodes happen to be in ascending order is followed '
          + 'happily and the measurement becomes one of the prefetcher rather than of the '
          + 'hierarchy. Randomising the traversal order is the only thing that makes the next '
          + 'address genuinely unknowable, and leaving it out is a mistake that produces a '
          + 'plausible curve with no steps in it.',
        example: 'The demo offers an ordered chase as a control precisely so the wrong curve '
          + 'can be seen beside the right one.'
      },
      {
        term: 'Discard the first pass',
        plain: 'Its misses are compulsory at every size, so they lift the whole curve.',
        formal: 'the first reference to a line misses whatever the cache holds',
        detail: 'A working set of any size misses on every line the first time it is touched, '
          + 'so including that pass adds a constant to every point on the curve and flattens '
          + 'the very steps the method exists to find. It is one line of code and it is the '
          + 'difference between a discovery routine that recovers the capacities and one that '
          + 'reports every cache as larger than it is. The same warm-up discipline applies to '
          + 'any benchmark with a cold start, which is nearly all of them.',
        example: 'Turning the warm-up control off in the demo blurs the steps until the '
          + 'threshold can no longer see them.'
      },
      {
        term: 'The size below a step is the capacity',
        plain: 'The largest working set that still fitted, not the first that did not.',
        formal: 'the step is between the last size that fits and the first that does not',
        detail: 'Getting this off by one reports every level at twice its real size, and it is '
          + 'the only subtle part of an otherwise mechanical method. The reasoning is simply '
          + 'that the curve is flat while the set fits and rises once it does not, so the '
          + 'boundary lies between the two samples and the lower one is the one that was still '
          + 'inside. With a geometric sweep the two differ by a factor of two, which is exactly '
          + 'how large the error is.',
        example: 'The step from 32 KiB to 64 KiB reports a 32 KiB L1, which is what the '
          + 'simulator was configured with.'
      },
      {
        term: 'Which level a workload lands in dominates every other optimisation',
        plain: 'One avoided trip to memory is worth about eighty avoided instructions.',
        formal: 'the levels are separated by multiplicative factors rather than additive ones',
        detail: 'The instinct when optimising is to count operations, and that instinct is '
          + 'calibrated to the wrong quantity on any code that touches data. A change that '
          + 'removes eighty instructions and adds one DRAM access is a loss; a change that adds '
          + 'instructions and keeps the working set in a faster level is usually a win. This is '
          + 'why two implementations with identical operation counts routinely differ by a '
          + 'factor of five, and why nothing in the source code explains it.',
        example: 'The blocked matrix multiply in 37.5 does exactly the same arithmetic as the '
          + 'naive one and makes 13.7x fewer trips to memory.'
      },
      {
        term: 'What this model leaves out is said rather than hidden',
        plain: 'No prefetcher, no translation cost, and a DRAM that is one fixed latency.',
        formal: 'each omission makes the real curve messier in a specific, named way',
        detail: 'A prefetcher fills the flat parts of the curve and blurs the steps; '
          + 'translation adds a second cliff at the buffer\'s reach, which can be confused with '
          + 'a cache capacity; real DRAM latency depends on the row buffer and on queueing '
          + 'rather than being constant. Each of those gets its own section rather than a '
          + 'footnote, and knowing which effects have been left out is what makes a simple '
          + 'model usable rather than misleading.',
        example: '37.6 shows the translation cliff, 37.7 the prefetcher and 37.8 the DRAM '
          + 'timing that this page treats as a single number.'
      }
    ],

    'cache-organisation': [
      {
        term: 'An address is three numbers',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["address"] --> T["tag"]',
            '    A --> I["index: picks the set"]',
            '    A --> O["offset: picks the byte"]',
            '    I --> S["one row of the table"]',
            '    T --> C["compared against every way in that row"]'
          ].join('\n'),
          caption: 'The index picks the row and the tag is compared across it. Everything else '
            + 'about cache organisation follows.'
        },
        plain: 'Offset within the line, index of the set, and a tag for everything above.',
        formal: 'index = (address / lineBytes) mod sets; tag = address / lineBytes / sets',
        readAs: 'divide the address by the line size to get the line number; the remainder '
          + 'when that is divided by the set count is the index, and the quotient is the tag.',
        detail: 'A cache is a table with one row per set and one column per way, and a lookup '
          + 'is: use the index to pick the row, compare the tag against every entry in it, and '
          + 'either hit or choose a victim. The three fields are three divisions of one number '
          + 'and they are decided entirely by the shape of the cache, so the same address lands '
          + 'in different sets on differently shaped caches of the same capacity.',
        example: 'On a 16-set 64-byte-line cache, 0x1234 has offset 52, index 8 and tag 4.'
      },
      {
        term: 'The index comes from the middle, which is where the cliffs come from',
        plain: 'Addresses that differ only in their high bits share a set.',
        formal: 'a stride that is a multiple of sets x lineBytes reaches exactly one set',
        detail: 'Because the index bits sit above the offset and below the tag, two addresses '
          + 'that are far apart in memory can be forced into the same row. A stride of exactly '
          + 'the set span reaches one set; a stride of half of it reaches two. That single fact '
          + 'explains most mysterious performance cliffs, and it is why an array whose size is '
          + 'a power of two so often behaves worse than one a single element larger.',
        example: 'A 64-set cache walked at a 4096-byte stride uses one row and leaves '
          + 'sixty-three empty.'
      },
      {
        term: 'Associativity is how many places a line may live',
        plain: 'One way means one home; more ways means more tag comparisons.',
        formal: 'a set holds `ways` lines, and a set with more conflicting lines than ways thrashes',
        detail: 'Direct mapping is one comparison and therefore a short hit time, which is why '
          + 'it survives at the levels where latency matters most. Its failure mode is exactly '
          + 'the conflict above: two addresses that share an index cannot both be resident, '
          + 'however empty the rest of the cache is. Raising the ways is the direct fix and it '
          + 'buys nothing at all against a working set that genuinely does not fit, which is '
          + 'why 37.4 separates the two cases.',
        example: 'Sixteen lines at a 4 KiB stride get a 0% hit rate at four ways and 80% at '
          + 'sixteen, at the same total capacity.'
      },
      {
        term: 'Line size is a bet on spatial locality',
        plain: 'A bigger line means fewer misses and more bytes fetched that nobody wanted.',
        formal: 'a miss fetches lineBytes whether the program wanted one byte or all of them',
        detail: 'On a sequential walk a bigger line is close to free: one fetch serves several '
          + 'accesses and the total traffic is the same. On a sparse walk it is a straight '
          + 'loss, because the bytes beside each element are fetched and never read. Real '
          + 'designs settled at 64 bytes as a compromise, and the reason the number is fixed '
          + 'rather than tunable is that it also decides the width of the bus and the '
          + 'granularity of coherence.',
        example: 'One element every 64 bytes fetches 16 KiB to use 2 KiB, whatever the line '
          + 'size; only the miss count changes.'
      },
      {
        term: 'Capacity is the product and it is not the interesting number',
        plain: 'Two caches of the same size and different shapes behave completely differently.',
        formal: 'capacity = sets x ways x lineBytes, and the same product has many shapes',
        detail: 'Holding the capacity fixed and moving sets against ways changes nothing about '
          + 'how much fits and everything about which combinations of addresses can be resident '
          + 'at once. That is why a cache is specified by three numbers rather than one, and '
          + 'why a comparison of two designs by capacity alone tells you very little. The demo '
          + 'keeps the capacity constant across its associativity table precisely so the shape '
          + 'is the only variable.',
        example: 'A 32 KiB cache as 64 sets by 8 ways and as 32 sets by 16 ways give 0% and '
          + '80% on the same conflicting trace.'
      },
      {
        term: 'Virtual indexing constrains the size, which is why L1 stopped growing',
        plain: 'The index bits have to come from within the page offset.',
        formal: 'sets x lineBytes must not exceed the page size, or two virtual addresses for one line differ',
        detail: 'Indexing with the virtual address lets the set lookup start before translation '
          + 'finishes, which is most of why an L1 hit can be four cycles. The price is that the '
          + 'index bits must be ones translation does not change - that is, within the page '
          + 'offset - so the number of sets times the line size is capped by the page size. At '
          + '4 KiB pages and 64-byte lines that is 64 sets, and eight ways of that is exactly '
          + 'the 32 KiB that L1 data caches sat at for a decade.',
        example: 'Raising the associativity rather than the set count is how designs grew past '
          + 'that cap without giving up virtual indexing.'
      },
      {
        term: 'The set/way grid is the fastest diagnostic there is',
        plain: 'An even heat map is a spread workload; one hot row is a conflict.',
        formal: 'the number of sets in use divides the capacity a workload can actually reach',
        detail: 'A cache holding four lines out of two hundred and fifty-six is not a cache '
          + 'that is too small, and no amount of extra capacity changes it - the addresses all '
          + 'have the same middle bits and a larger table has the same problem in more rows. '
          + 'Seeing that as a picture rather than as a miss rate is what turns "the cache is '
          + 'not helping" into "the layout is wrong", which are two completely different '
          + 'engineering conversations.',
        example: 'The conflicting fixture leaves 63 of 64 sets empty, so a 32 KiB cache is '
          + 'holding 256 bytes.'
      },
      {
        term: 'The same shape appears wherever a slot is picked from part of a key',
        plain: 'Any structure that indexes with a slice of bits has this failure mode.',
        formal: 'regular keys plus a modular index means a non-uniform distribution',
        detail: 'A hash table indexed by the low bits of a pointer degenerates when every '
          + 'pointer is aligned; a disk that stripes by block number hot-spots when the access '
          + 'stride matches the stripe width; a sharded queue keyed by a rounded timestamp puts '
          + 'every message in one shard. In each case the structure is fine and the keys are '
          + 'regular, which is the situation nobody designs for because random keys are the '
          + 'easy case to reason about.',
        example: 'The fix is always the same shape too: mix the key, or change the stride so '
          + 'it shares no factor with the slot count.'
      }
    ],

    'cache-policies': [
      {
        term: 'Write-back defers the cost and write-through pays it every time',
        diagram: {
          definition: [
            'stateDiagram-v2',
            '    [*] --> clean',
            '    clean --> dirty: written',
            '    dirty --> dirty: written again, free',
            '    dirty --> [*]: evicted, and written out',
            '    clean --> [*]: evicted, nothing to do'
          ].join('\n'),
          caption: 'One of the transitions costs a memory transaction, and it happens later '
            + 'than the write that caused it.'
        },
        plain: 'A thousand writes to one line cost one transaction, or a thousand.',
        formal: 'write-back marks the line dirty; write-through forwards every write',
        detail: 'The saving is the whole reason write-back is nearly universal, and the price '
          + 'is a dirty bit per line plus a write-out that happens at a moment nobody chose. '
          + 'That deferral is also what makes coherence hard, because a dirty line is the only '
          + 'correct copy and every other cache has to be prevented from believing otherwise - '
          + 'which is where M38 begins.',
        example: 'A thousand writes to four lines cost 4 transactions under write-back and '
          + '1000 under write-through.'
      },
      {
        term: 'No-write-allocate is for writes that are never read back',
        plain: 'Fetching a line only to overwrite all of it is wasted traffic.',
        formal: 'a write miss under no-write-allocate forwards the write and installs nothing',
        detail: 'The default is to fetch on a write miss, because a written line is usually '
          + 'read or written again soon. Streaming writes break that assumption completely: '
          + 'every line is written once and never touched again, so the fetch is pure waste and '
          + 'the eviction is a second transaction on top. That case is common enough - '
          + 'initialising a buffer, writing an output array - that instruction sets have a '
          + 'non-temporal store for it.',
        example: 'A thousand writes to a thousand different lines cost 1936 transactions under '
          + 'write-allocate and 1000 without it.'
      },
      {
        term: 'True LRU has a pathology and it is a common one',
        plain: 'A loop one line larger than the set gets zero hits.',
        formal: 'LRU evicts the line about to be reused when the reference pattern is cyclic',
        detail: 'The least recently used line is the best guess when the future resembles the '
          + 'recent past, and it is exactly the wrong guess when the pattern is a cycle '
          + 'slightly larger than the capacity - because then the least recently used item is '
          + 'precisely the next one needed. Any loop over an array one element too large to fit '
          + 'has this shape, which makes it a pathology worth recognising rather than a corner '
          + 'case.',
        example: 'Nine lines cycled through an eight-way set: LRU, pseudo-LRU and FIFO all get '
          + '0 hits of 180, and random gets 132.'
      },
      {
        term: 'Having no state at all is what escapes the pathology',
        plain: 'Random beats true LRU on the cyclic pattern; pseudo-LRU does not.',
        formal: 'a policy with no exploitable pattern has no pathological input',
        detail: 'Random replacement keeps no ordering, so there is no rule an access pattern '
          + 'can be aligned against, and on the cyclic fixture it keeps most of the working set '
          + 'by accident. Pseudo-LRU is the instructive contrast: it is an approximation rather '
          + 'than a randomisation, it tracks the order closely enough to inherit the pathology '
          + 'exactly, and it scores zero alongside the policy it approximates. Being cheaper '
          + 'than LRU is not the same as being unlike it.',
        example: 'On the cyclic fixture random gets 132 of 180 and pseudo-LRU gets 0, the same '
          + 'as the true LRU it costs a fraction of.'
      },
      {
        term: 'RRIP is scan-resistant, which is not the same as thrash-resistant',
        plain: 'It protects a working set from a burst of never-reused lines.',
        formal: 'insert predicting a distant re-reference; promote to near on a hit',
        detail: 'A new line is assumed to be one that will not come back, so it becomes the '
          + 'first candidate for eviction; a line that is hit is promoted and survives. A scan '
          + 'passing through therefore leaves before the reused working set does. The counter '
          + 'has four values, so the protection is bounded: lengthen the scan far enough and '
          + 'RRIP falls back to behaving like LRU, which is a limit worth stating rather than '
          + 'glossing.',
        example: 'A four-line working set with a scan of eight: RRIP holds 156 of 160 hits '
          + 'where LRU holds 80, and at a scan of 24 both hold 80.'
      },
      {
        term: 'Inclusion is a hierarchy policy, not a level policy',
        plain: 'Whether a line in L1 must also be in L2 changes what an eviction below means.',
        formal: 'inclusive: an eviction at a level forces one at every level above it',
        detail: 'An inclusive hierarchy lets a coherence request check only the outermost level '
          + 'to know whether any inner one might have a copy, which is a large simplification '
          + 'and the reason many designs choose it. The cost is capacity - the inner levels are '
          + 'duplicated in the outer one - and the correctness requirement is that evictions '
          + 'propagate upwards, because a hierarchy that claims inclusion and does not enforce '
          + 'it has broken the invariant everything above depends on.',
        example: 'The model enforces it: an eviction from L2 invalidates the line in L1 and '
          + 'counts the forced eviction separately.'
      },
      {
        term: 'A victim cache is the cheap answer to conflicts',
        plain: 'A few fully associative entries holding the last evictions.',
        formal: 'a small buffer of recently evicted lines, checked on a miss before the next level',
        detail: 'A conflicting stride throws out exactly the lines it is about to ask for '
          + 'again, so a handful of entries catching the most recent evictions recovers most of '
          + 'what a doubling of associativity would - at a fraction of the area, because the '
          + 'buffer is small enough to be fully associative. It is a good example of a targeted '
          + 'structure beating a general one: it does nothing for capacity misses and it is '
          + 'not meant to.',
        example: 'Not modelled here; the associativity sweep in 37.2 shows the effect it '
          + 'approximates.'
      },
      {
        term: 'On ordinary patterns the replacement policy barely matters',
        plain: 'Most of the effort belongs in the layout instead.',
        formal: 'policies converge except where the reference pattern has a period near the capacity',
        detail: 'The chart across five workloads is mostly flat, and that is the honest '
          + 'headline: sequential, random and chase patterns give nearly the same hit rate '
          + 'under every policy, because none of them has the structure a policy could exploit '
          + 'or be defeated by. The differences appear exactly where the pattern has a period '
          + 'near the capacity, and that is also the case where a layout change would have '
          + 'helped more.',
        example: 'The policy comparison chart is flat on four of the five workloads and '
          + 'separates only on the cyclic one.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
