/** Concepts for miss analysis, software layout and translation (M37.4-M37.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'cache-performance-analysis': [
      {
        term: 'Each of the three Cs is defined by a different cache',
        diagram: {
          definition: [
            'flowchart TD',
            '    M["a miss"] --> Q1{"first reference to this line?"}',
            '    Q1 -->|"yes"| C["compulsory"]',
            '    Q1 -->|"no"| Q2{"would a fully associative cache of the same size have hit?"}',
            '    Q2 -->|"no"| K["capacity"]',
            '    Q2 -->|"yes"| F["conflict"]'
          ].join('\n'),
          caption: 'Two extra simulations answer the two questions, which is what makes the '
            + 'categories a measurement rather than a judgement.'
        },
        plain: 'Never seen before, would not have fitted, or fitted and the mapping lost it.',
        formal: 'compulsory: first reference; capacity: misses fully associative too; conflict: the rest',
        detail: 'The definitions are operational rather than descriptive: each one names a '
          + 'cache that would or would not have caught the access, and the classification is '
          + 'read off running those caches alongside the real one. That is why the categories '
          + 'are exhaustive and mutually exclusive, and therefore why they sum to the miss '
          + 'count exactly - a property the tests assert rather than assume.',
        example: 'Naive matrix multiply at n=64: 1536 compulsory, 8064 capacity and 32392 '
          + 'conflict, summing to 41992 misses.'
      },
      {
        term: 'The categories imply different fixes, which is the point',
        plain: 'Conflict wants a layout change; capacity wants a blocking change.',
        formal: 'a fix that does not move the category it targeted was the wrong fix',
        detail: 'Both categories look identical in a profile - the same counter, the same '
          + 'cache, the same line at the top - and they call for opposite work. Padding an '
          + 'array whose working set is ten times the cache changes nothing; blocking a loop '
          + 'whose problem was a power-of-two stride produces a more complicated program at the '
          + 'same speed. The decomposition costs one extra simulation and tells you which '
          + 'conversation to have.',
        example: 'Padding takes the naive version from 41992 misses to 16792 and does nothing '
          + 'at all to the blocked one.'
      },
      {
        term: 'Associativity separates the two categories under one control',
        plain: 'Conflict misses fall towards zero as the ways rise; capacity misses do not move.',
        formal: 'with capacity held constant, only the conflict count depends on the shape',
        detail: 'This is the cleanest demonstration that the two are genuinely different '
          + 'quantities rather than two words for the same thing. Holding sets times ways '
          + 'constant and sweeping the ways changes where lines may live and not how many fit, '
          + 'so one column of the decomposition collapses and the other is flat. It is also the '
          + 'practical substitute when you cannot run a classifier: compare the same workload '
          + 'at two associativities.',
        example: 'The conflicting trace: 32 conflict misses at one, two and four ways, and zero '
          + 'at eight.'
      },
      {
        term: 'Average memory access time is a recursion, and it should be checked',
        plain: 'A level costs its hit time plus, on the misses, everything below it.',
        formal: 'AMAT_i = hitTime_i + missRate_i x AMAT_(i+1)',
        detail: 'The recursion turns a set of miss rates into one number a program actually '
          + 'experiences, which is why it is the standard summary. What is usually missing is '
          + 'the check: the predicted average should be compared against the cycles a run '
          + 'actually accumulated, because a formula nobody validates is a formula rather than '
          + 'a model. Computing it from measured miss rates rather than assumed ones is what '
          + 'makes that comparison meaningful.',
        example: 'The naive matrix multiply: AMAT 5.32 cycles from the recursion, and 5.32 '
          + 'accumulated by the run.'
      },
      {
        term: 'Miss rate, misses per instruction and misses per second are three numbers',
        plain: 'They move in different directions under the same change.',
        formal: 'a miss rate has accesses as its denominator, the others have instructions or time',
        detail: 'A miss rate falls when you add hits, so a change that adds redundant accesses '
          + 'improves it while making the program slower. Misses per instruction is what a '
          + 'compiler change moves. Misses per second is what a faster machine moves. Quoting '
          + 'one while arguing about another is how two people agree on the data and disagree '
          + 'on the conclusion, and it is worth naming the denominator every time.',
        example: 'The demo reports the miss count and the access count separately for exactly '
          + 'this reason.'
      },
      {
        term: 'A miss rate is not a stall count',
        plain: 'An out-of-order machine overlaps misses, so twenty can cost the time of five.',
        formal: 'stall cycles depend on memory-level parallelism, not only on the miss count',
        detail: 'M36.6 measured it directly: two traversals with identical miss counts differed '
          + 'by 3.9x in cycles because one overlapped its misses and the other could not. So '
          + 'the miss rate says how often the memory system was asked and the stall cycles say '
          + 'how much of that the machine failed to hide, and only the second is what a user '
          + 'experiences. A cache analysis that stops at the miss rate has skipped the half '
          + 'that varies most.',
        example: 'stride and chase miss 32 times each and take 174 and 678 cycles.'
      },
      {
        term: 'Compulsory misses are the prefetcher\'s entire business',
        plain: 'They cannot be avoided, but they can happen earlier.',
        formal: 'a compulsory miss is unavoidable for a given working set, not for a given time',
        detail: 'No cache of any size or organisation can hold a line before it has ever been '
          + 'referenced, so the category is irreducible in the sense that matters for cache '
          + 'design. It is not irreducible in time: something that predicts the access can '
          + 'fetch the line before the program asks, which converts a stall into bandwidth. '
          + 'That is the whole subject of 37.7, and it is why the compulsory column is not the '
          + 'end of the analysis.',
        example: 'The blocked matrix multiply is almost entirely compulsory misses, which is '
          + 'the point at which layout work stops paying.'
      },
      {
        term: 'The decomposition is a simulation, and hardware counters cannot do it',
        plain: 'A counter can tell you a miss happened, not which category it was in.',
        formal: 'the classification needs a second cache running in parallel',
        detail: 'That is a real limitation on a physical machine and it is why this analysis '
          + 'lives in simulators and in tools like cachegrind rather than in a performance '
          + 'counter. The practical substitute is the associativity comparison: run the same '
          + 'workload at two associativities and attribute the difference to conflicts. It is '
          + 'coarser and it needs no simulator, which is usually the trade available.',
        example: 'The associativity table is exactly that substitute, computed here where the '
          + 'exact answer is also available to check it against.'
      }
    ],

    'cache-friendly-software': [
      {
        term: 'Loop interchange is free and it can be worth several times',
        diagram: {
          definition: [
            'flowchart LR',
            '    N["i, j, k: the inner loop walks a COLUMN of B"] --> A["every access a new line"]',
            '    I["i, k, j: the inner loop walks a ROW of B"] --> B["one line serves eight accesses"]'
          ].join('\n'),
          caption: 'The same arithmetic in a different order, and a different number of trips '
            + 'to memory.'
        },
        plain: 'Reorder the loops so the inner one walks along a line rather than across them.',
        formal: 'the innermost loop should vary the fastest-changing address dimension',
        detail: 'A row-major array walked down a column steps by a whole row per access, so '
          + 'every access is a different line and a 64-byte fetch serves one 8-byte element. '
          + 'Walked along a row, one fetch serves eight. Nothing about the algorithm changes - '
          + 'the same multiply-accumulates happen in a different order - which is what makes '
          + 'this the first transformation to try and the easiest to justify.',
        example: 'Naive to interchanged at n=64: 41992 trips to memory down to 9551, a factor '
          + 'of 4.4.'
      },
      {
        term: 'Blocking makes the working set fit, which is a different problem',
        plain: 'Cut the loop into tiles small enough that the data is reused before it is evicted.',
        formal: 'three tiles of t by t elements must be resident at once',
        detail: 'After interchange the remaining misses are capacity: the whole of B is re-read '
          + 'from memory on every pass because it does not fit. Tiling restructures the loop so '
          + 'that a tile of B is used many times while it is resident, which converts memory '
          + 'traffic into cache hits without changing the arithmetic. It is a larger change '
          + 'than interchange and it is the one that pays when the decomposition says capacity.',
        example: 'Interchanged to blocked with a tile of 16: 9551 trips down to 3072, and 13.7x '
          + 'better than naive overall.'
      },
      {
        term: 'The tile size can be calculated before it is measured',
        plain: 'Three tiles must fit, so t is the square root of a third of the capacity.',
        formal: '3 x t^2 x elementBytes <= capacity',
        detail: 'This is one of very few performance calculations that beats measurement on the '
          + 'first attempt, and the reason is that it depends on a capacity rather than on a '
          + 'mapping. Capacities are documented and mappings are emergent, so arithmetic '
          + 'answers "how many of these fit" and only measurement answers "which of these '
          + 'collide". Knowing which kind of question you have is worth more than either '
          + 'answer.',
        example: 'A 32 KiB cache and 8-byte elements gives 36; the measured optimum on the '
          + 'sweep is 40 at 2998 trips against 3292 for 36.'
      },
      {
        term: 'A tile that divides the matrix does better than one that does not',
        plain: 'An uneven final tile has a different shape and worse reuse.',
        formal: 'the ragged edge costs a tile-shaped amount of the reuse the calculation assumed',
        detail: 'This is the residual after the arithmetic, and it is why the sweep is still '
          + 'worth running. The calculated size assumes every tile is the same shape; when the '
          + 'matrix dimension is not a multiple of it, the last tile in each direction is '
          + 'narrower and the elements in it are reused fewer times. The effect is a few per '
          + 'cent, which is exactly the size of thing a calculation should not be expected to '
          + 'capture.',
        example: 'At n=64 the tile of 32 gives 3042 trips and the tile of 36 gives 3292, '
          + 'despite 36 being the calculated size.'
      },
      {
        term: 'Padding breaks a conflicting stride and does nothing else',
        plain: 'One extra element per row moves every row to a different set.',
        formal: 'changing the row stride changes the index bits every row lands on',
        detail: 'A power-of-two row stride means every row of a matrix maps to the same few '
          + 'sets, so a column walk exhausts the ways immediately. Adding a single element to '
          + 'the stride makes consecutive rows land in different sets and the conflict '
          + 'disappears. Applied where there were no conflicts it does nothing measurable, '
          + 'which is exactly what makes the three-Cs decomposition worth consulting first.',
        example: 'One element of padding takes the naive version from 41992 trips to 16792 and '
          + 'the conflict count from 32392 to a fraction of it.'
      },
      {
        term: 'A power-of-two dimension is the classic trap',
        plain: 'The nice number is the one that collides.',
        formal: 'a stride of 2^k lines shares every factor with a set count of 2^m',
        detail: 'Cache set counts are powers of two because the index is a slice of bits, so '
          + 'any stride that is also a power of two shares all its factors and reaches only a '
          + 'fraction of the sets. Array dimensions are chosen to be powers of two because they '
          + 'are convenient, and the two conventions collide. That is why "make the array one '
          + 'element bigger" is a real optimisation and why it sounds like superstition.',
        example: 'At n=48 the naive and interchanged versions perform identically; at n=64 they '
          + 'differ by 4.4x.'
      },
      {
        term: 'Structure of arrays is the same bet at field granularity',
        plain: 'Fetch the fields you read, not the whole record.',
        formal: 'separating fields makes a line hold more of the values a loop actually uses',
        detail: 'A loop that reads one field of every record fetches the whole record on each '
          + 'miss, so a 64-byte line serving an 8-byte field wastes seven eighths of the '
          + 'traffic. Splitting the structure into parallel arrays makes the line hold eight '
          + 'useful values. The cost is that code touching every field of one record now '
          + 'touches several arrays, which is worse - so it is a transformation with a '
          + 'direction, not an improvement.',
        example: 'M02 measured it; the sparse line-size table in 37.2 is the same effect '
          + 'measured differently.'
      },
      {
        term: 'None of this is worth doing before the decomposition says which applies',
        plain: 'The wrong transformation costs effort and buys nothing.',
        formal: 'match the transformation to the dominant miss category',
        detail: 'Blocking a program whose problem was conflicts leaves a more complicated '
          + 'program at the same speed. Padding a program whose working set is ten times the '
          + 'cache is a rounding error. Both mistakes are common, both look like "cache '
          + 'optimisation does not work", and both are avoided by one extra simulation. The '
          + 'sequence in this demo - decompose, transform, re-decompose - is the method rather '
          + 'than the result.',
        example: 'Padding the blocked version makes it very slightly worse, because there were '
          + 'no conflict misses left to remove.'
      }
    ],

    'virtual-memory-and-the-tlb': [
      {
        term: 'Every access is two accesses',
        diagram: {
          definition: [
            'flowchart LR',
            '    V["virtual address"] --> T{"TLB?"}',
            '    T -->|"hit"| P["physical address"]',
            '    T -->|"miss"| W["four dependent memory accesses"]',
            '    W --> P'
          ].join('\n'),
          caption: 'The walk is a pointer chase, which is the pattern with no overlap at all.'
        },
        plain: 'Where is it, then what is there.',
        formal: 'a four-level page table costs four dependent memory accesses per translation',
        detail: 'The page table is itself in memory and each level holds the address of the '
          + 'next, so a walk is four loads that cannot be overlapped - the exact pattern 36.6 '
          + 'showed is the worst possible one. Without a cache of the answers, every memory '
          + 'access on a machine with virtual memory would cost five, which is why the '
          + 'translation buffer is not an optimisation but a precondition.',
        example: 'On this model a walk costs 30 cycles per level, so 120 cycles before the data '
          + 'access even starts.'
      },
      {
        term: 'Reach is entries times page size, and it is usually small',
        plain: 'Sixty-four entries over 4 KiB pages describes 256 KiB.',
        formal: 'reach = entries x pageBytes, and it is often smaller than the L2 cache',
        detail: 'That comparison is the one worth carrying: a workload can fit entirely in a '
          + 'cache and still exceed what the translation buffer can describe, so it spends most '
          + 'of its time finding out where its data is while every cache-miss counter looks '
          + 'healthy. Large sparse in-memory structures - a hash table, a buffer pool, a heap - '
          + 'are exactly the shape that hits this.',
        example: 'The demo: 99.5% hit rate at a 256 KiB working set and 49.7% at 512 KiB, with '
          + 'the reach configured at 256 KiB.'
      },
      {
        term: 'Huge pages fix reach and nothing else',
        plain: 'The same entries describing five hundred times as much memory.',
        formal: 'a 2 MiB page makes each entry cover 512 times the addresses',
        detail: 'They do not make translation faster; they make each entry describe more, so '
          + 'the same buffer covers a working set that previously needed thousands of entries. '
          + 'That makes them a complete fix for a translation-bound workload and no help '
          + 'whatever for a cache-bound one, which is why "try huge pages" is a diagnostic '
          + 'rather than a tuning knob: if it helps a lot, the problem was translation.',
        example: 'A 2 MiB working set: 12.5% hit rate and 106 cycles per access on 4 KiB pages, '
          + '100% and 1.0 on huge pages.'
      },
      {
        term: 'Their cost is fragmentation and contiguity',
        plain: 'A 2 MiB page needs 2 MiB of contiguous physical memory and wastes what it does not use.',
        formal: 'internal fragmentation rises with the page size, as does the cost of one fault',
        detail: 'A mapping that needs one kilobyte occupies two megabytes; a page fault has to '
          + 'find and zero two megabytes of contiguous physical memory, which on a fragmented '
          + 'system may not exist. Transparent huge pages address that by promoting ranges in '
          + 'the background, at the cost of a compaction daemon whose pauses are their own '
          + 'well-known problem. Nothing here is free, which is why they are not simply the '
          + 'default.',
        example: 'The demo reports the reach gain and names the costs rather than modelling '
          + 'them, because modelling them badly would be worse than saying so.'
      },
      {
        term: 'The address-space identifier is a correctness property first',
        plain: 'One space must not be able to match another space\'s entry.',
        formal: 'the identifier is part of the lookup key, not an optimisation on top of it',
        detail: 'Without identifiers a context switch has to flush the buffer, so the cost of '
          + 'switching is paid in walks for thousands of accesses afterwards. With them, two '
          + 'address spaces coexist - and the property that matters more than the performance '
          + 'is that a lookup in one space cannot return the other\'s frame. A buffer that '
          + 'leaked one would be a memory-protection hole rather than a slow machine, which is '
          + 'why the test asserts it rather than measuring it.',
        example: 'The same virtual page in two spaces resolves to different frames with both '
          + 'entries resident, and neither space can see the other\'s.'
      },
      {
        term: 'Level count trades walk cost against table size',
        plain: 'Fewer levels means a cheaper miss and a larger table.',
        formal: 'a walk costs one dependent access per level',
        detail: 'A single-level table would be one access and would need an entry for every '
          + 'page in the address space whether mapped or not, which is impossible at 64 bits. '
          + 'Four levels make a sparse address space nearly free to describe and make every '
          + 'miss cost four dependent accesses. Five-level paging exists on machines that '
          + 'needed more address space, and it made the walk 25% more expensive for everyone '
          + 'running on them.',
        example: 'The level control moves the cost per access proportionally, which is what '
          + '"dependent" means: nothing overlaps.'
      },
      {
        term: 'A virtually indexed, physically tagged cache overlaps the two lookups',
        plain: 'Start the set lookup with bits translation does not change.',
        formal: 'the index must come from the page offset, so sets x lineBytes <= pageBytes',
        detail: 'The page offset is identical in the virtual and physical address, so a cache '
          + 'whose index bits come from within it can start looking up the set while the '
          + 'translation is still in flight - which is most of why an L1 hit can be four cycles. '
          + 'The constraint that follows caps the number of sets, and with 4 KiB pages and '
          + '64-byte lines that is 64 sets: eight ways of that is the 32 KiB L1 that a '
          + 'generation of processors shared.',
        example: 'Growing past the cap meant raising the associativity rather than the set '
          + 'count, which is why L1 caches got more ways and not more sets.'
      },
      {
        term: 'Shootdown makes unmapping far more expensive than mapping',
        plain: 'Changing a mapping means telling every other core that has a stale copy.',
        formal: 'an invalidation is an inter-processor interrupt and a synchronous wait',
        detail: 'Each core caches translations independently, so a mapping change has to be '
          + 'broadcast and acknowledged before the change is safe. That is an interrupt per '
          + 'core plus a wait, which makes freeing memory dramatically more expensive than '
          + 'allocating it and surprises people writing allocators - it is why many of them '
          + 'hold on to address space rather than returning it. The mechanism belongs to M43 '
          + 'and M47; the cost is worth knowing here.',
        example: 'Not modelled: a single-core buffer has nobody to tell, and pretending '
          + 'otherwise would teach the wrong shape.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
