/** Reference entries for miss analysis, cache-friendly code and the TLB (M37.4-M37.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'cache-performance-analysis': {
      summary: 'Turning one miss rate into a diagnosis. The three-Cs decomposition runs two '
        + 'extra simulations beside the real cache - an infinite one and a fully associative '
        + 'one of the same capacity - so every miss is attributed by measurement rather than '
        + 'by heuristic, and the three categories sum to the miss count exactly. AMAT is then '
        + 'computed by recursion from the measured per-level miss rates and checked against '
        + 'what the run accumulated.',
      intuition: 'Two extra simulations answer the two questions, which is what makes the '
        + 'categories a measurement rather than a judgement.',
      formulation: {
        equations: [
          {
            label: 'The decomposition of the naive matrix multiply at n = 64',
            expr: 'compulsory + capacity + conflict = misses',
            terms: [
              { sym: 'compulsory', meaning: '1,536 - first reference to the line, 3.7%' },
              { sym: 'capacity', meaning: '8,064 - missed in the fully associative cache too, 19.2%' },
              { sym: 'conflict', meaning: '32,392 - the fully associative cache hit, 77.1%' },
              { sym: 'the check', meaning: '1,536 + 8,064 + 32,392 = 41,992, exactly the miss count' }
            ]
          },
          {
            label: 'AMAT by recursion, from the measured per-level miss rates',
            expr: 'AMAT(level) = hit time + miss rate x AMAT(next level down)',
            readAs: 'the average access time at a level is its hit time plus, on the fraction '
              + 'that missed, the whole average cost of the level below',
            terms: [
              { sym: 'DRAM', meaning: '250 cycles - the base case' },
              { sym: 'L3', meaning: '45 + 1.00 x 250 = 295.00' },
              { sym: 'L2', meaning: '14 + 0.0361 x 295.00 = 24.66' },
              { sym: 'L1', meaning: '4 + 0.0534 x 24.66 = 5.32, and the run accumulated 5.32' }
            ]
          },
          {
            label: 'The category each fix removes',
            expr: 'the dominant category picks the transformation',
            terms: [
              { sym: 'compulsory', meaning: 'touch less data, or prefetch it earlier (37.7)' },
              { sym: 'capacity', meaning: 'block or tile so the working set fits (37.5)' },
              { sym: 'conflict', meaning: 'pad, change the stride, or raise the associativity' },
              { sym: 'the evidence', meaning: 'naive is conflict, interchanged is capacity, blocked is compulsory' }
            ]
          },
          {
            label: 'Local against global miss rate, which is the usual arithmetic error',
            expr: 'local = misses at this level / accesses to this level',
            terms: [
              { sym: 'L2 local', meaning: '3.61% - of the accesses that reached L2' },
              { sym: 'L2 global', meaning: 'far smaller: 5.34% x 3.61%' },
              { sym: 'which one AMAT wants', meaning: 'local, because the recursion has already conditioned on the miss' },
              { sym: 'the consequence', meaning: 'using the wrong one is an order-of-magnitude error' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The three categories sum to the miss count exactly',
          why: 'Every miss travels down exactly one path in the classifier.',
          breaks: 'Asserted on every workload in the demo, and shown as a column in the table.'
        },
        {
          name: 'Compulsory misses do not move with the cache shape',
          why: 'A first reference is a first reference whatever the cache looks like.',
          breaks: '1,536 across every row of the associativity sweep.'
        },
        {
          name: 'The fully associative reference has the same capacity and line size',
          why: 'Otherwise the comparison measures two cache sizes rather than two organisations.',
          breaks: 'sets = 1, ways = the real cache\'s sets x ways.'
        },
        {
          name: 'AMAT from the formula equals the cycles the run accumulated',
          why: 'A formula never checked against a run is not a model of anything.',
          breaks: '5.32 against 5.32 on the default workload.'
        }
      ],
      complexity: [
        { operation: 'classify a trace', average: 'three cache simulations in one pass', worst: 'the fully associative probe is linear in its line count' },
        { operation: 'the associativity sweep', average: 'one classification per shape', worst: 'five shapes, three simulations each' },
        { operation: 'AMAT', average: 'one multiply and add per level', worst: 'the same' },
        { operation: 'the workload table', average: 'one classification per workload', worst: 'dominated by the longest trace' }
      ],
      failureModes: [
        {
          symptom: 'A cache miss rate is reported and nobody knows what to do about it.',
          cause: 'One number supports three incompatible fixes equally well.',
          fix: 'Decompose it; the dominant category names the transformation.'
        },
        {
          symptom: 'Blocking a loop changes nothing.',
          cause: 'The misses were conflict misses, and blocking addresses capacity.',
          fix: 'Pad or reorder instead - and check the decomposition before the next attempt.'
        },
        {
          symptom: 'An AMAT calculation is an order of magnitude out.',
          cause: 'A global miss rate was used where the recursion wanted a local one.',
          fix: 'Each level\'s rate is over the accesses that reached that level.'
        },
        {
          symptom: 'More associativity makes the program slower.',
          cause: 'Capacity is fixed, so more ways means fewer sets, and this walk spread across the sets it lost.',
          fix: 'Sweep it rather than assuming; the demo measures the non-monotone case directly.'
        }
      ],
      inTheWild: [
        'cachegrind and callgrind, which report exactly this decomposition on real binaries.',
        'The three-Cs vocabulary in every architecture course and vendor optimisation guide.',
        'Roofline analysis, which is the same idea in bandwidth units.',
        'Database buffer-pool sizing, where capacity and conflict have exact analogues.'
      ],
      sources: [
        { title: 'Hill and Smith - Evaluating Associativity in CPU Caches (1989)', note: 'the paper the three Cs come from' },
        { title: 'Hennessy and Patterson - Computer Architecture, appendix B', note: 'AMAT and the categories together' },
        { title: 'Nethercote and Seward - Valgrind (PLDI 2007)', note: 'how cachegrind does this over a real execution' },
        { title: 'Bryant and O\'Hallaron - Computer Systems, chapter 6', note: 'the miss-rate arithmetic, carefully' }
      ]
    },

    'cache-friendly-software': {
      summary: 'The transformation catalogue, applied under the guidance of the '
        + 'decomposition rather than by habit. One matrix multiply goes from 41,992 trips to '
        + 'memory to 3,072 - 13.67x on identical arithmetic - in two steps, each aimed at the '
        + 'category that dominated at the time, and each verified to have removed that '
        + 'category. Padding is measured as a second, cheaper fix for the same conflicts, and '
        + 'shown to do nothing once they are gone.',
      intuition: 'The same arithmetic in a different order, and a different number of trips to '
        + 'memory.',
      formulation: {
        equations: [
          {
            label: 'Three loop nests, 786,432 accesses each',
            expr: 'trips to memory, and cycles per access',
            terms: [
              { sym: 'naive (i, j, k)', meaning: '41,992 trips, 14.68 cycles per access' },
              { sym: 'interchanged (i, k, j)', meaning: '9,551 trips, 6.43 - 4.40x fewer' },
              { sym: 'blocked, tile 16', meaning: '3,072 trips, 4.78 - 13.67x fewer' },
              { sym: 'the arithmetic', meaning: 'identical in all three' }
            ]
          },
          {
            label: 'Each fix removed the category it was aimed at',
            expr: 'compulsory / capacity / conflict, per version',
            terms: [
              { sym: 'naive', meaning: '1,536 / 8,064 / 32,392 - conflict dominates' },
              { sym: 'interchanged', meaning: '1,536 / 8,015 / 0 - conflicts gone, capacity untouched' },
              { sym: 'blocked', meaning: '1,536 / 1,536 / 0 - almost nothing but compulsory left' },
              { sym: 'the reading', meaning: 'this is how you know the diagnosis was right' }
            ]
          },
          {
            label: 'Sizing a tile: three tiles resident at once',
            expr: '3 x tile x tile x element bytes <= capacity',
            readAs: 'three square tiles of elements have to fit inside the cache at the same time',
            terms: [
              { sym: 'the rule', meaning: '3 x t x t x 8 <= 32768 gives t = 36' },
              { sym: 'the sweep', meaning: 'picks 40, at 2,998 trips against 3,292 at t = 36' },
              { sym: 'divisibility', meaning: 'a tile that divides the matrix has no ragged edge and does better' },
              { sym: 'the conclusion', meaning: 'calculate to get close, then sweep' }
            ]
          },
          {
            label: 'Padding the naive version: 512 bytes on a 32 KiB matrix',
            expr: 'change the row stride so rows stop sharing sets',
            terms: [
              { sym: 'set span', meaning: '64 sets x 64 B = 4,096 bytes' },
              { sym: 'row stride at n = 64', meaning: '512 bytes, which divides it 8 times' },
              { sym: '+1 element', meaning: '520-byte stride: 16,792 trips, 2.50x fewer, 0 conflicts' },
              { sym: 'on the blocked version', meaning: 'no change - there were no conflicts left' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every version performs the same 786,432 accesses',
          why: 'Otherwise the comparison is about work done, not about locality.',
          breaks: 'The access count is asserted equal across all three nests.'
        },
        {
          name: 'A transformation only helps against its own category',
          why: 'It is why the decomposition comes before the catalogue.',
          breaks: 'Padding the blocked version changes nothing at all.'
        },
        {
          name: 'The tile has to hold three tiles, not one',
          why: 'A tile of C is computed from a tile-row of A and a tile-column of B.',
          breaks: 'The factor of three is in the sizing rule and in the demo\'s table.'
        },
        {
          name: 'More padding is not monotonically better',
          why: 'Once the conflicts are gone the rest is line-size interaction.',
          breaks: '16,792 at +1, 19,856 at +2, 23,982 at +4, 9,151 at +8.'
        }
      ],
      complexity: [
        { operation: 'loop interchange', average: 'free: the same arithmetic in a different order', worst: 'only legal when the dependences allow it' },
        { operation: 'blocking', average: 'a more complicated nest and one parameter to choose', worst: 'a badly chosen tile is worse than none' },
        { operation: 'padding', average: 'a little memory and an unfriendly stride', worst: 'nothing gained if the misses were not conflicts' },
        { operation: 'structure of arrays', average: 'better locality per field', worst: 'worse locality if every field is used together' }
      ],
      failureModes: [
        {
          symptom: 'A blocked implementation is no faster than the plain one.',
          cause: 'The misses were conflict misses; blocking addresses capacity.',
          fix: 'Decompose first (37.4). The naive nest here needed a reorder before a block.'
        },
        {
          symptom: 'A tile size chosen from the cache size is disappointing.',
          cause: 'One tile was sized instead of three, or the tile does not divide the matrix.',
          fix: 'Use the three-tile rule to get close, then sweep a few sizes around it.'
        },
        {
          symptom: 'A matrix at a power-of-two dimension is far slower than at n plus one.',
          cause: 'The row stride divides the set span.',
          fix: 'Pad the rows: one element removed all 32,392 conflict misses here.'
        },
        {
          symptom: 'Structure-of-arrays makes a program slower.',
          cause: 'The code reads every field of each record, so splitting them multiplied the streams.',
          fix: 'Split by access pattern, not by habit; hot and cold fields are the useful cut.'
        }
      ],
      inTheWild: [
        'Every tuned BLAS: OpenBLAS, MKL and BLIS all block for several levels at once.',
        'Loop tiling in LLVM\'s polyhedral passes and in Halide\'s schedules.',
        'Entity-component systems in games, which are structure-of-arrays as an architecture.',
        'Column stores, where the same layout argument is the whole product.'
      ],
      sources: [
        { title: 'Goto and van de Geijn - Anatomy of High-Performance Matrix Multiplication (2008)', note: 'what blocking looks like taken seriously' },
        { title: 'Lam, Rothberg and Wolf - The Cache Performance and Optimizations of Blocked Algorithms (1991)', note: 'tile sizing, including the conflict interaction' },
        { title: 'Frigo et al. - Cache-Oblivious Algorithms (1999)', note: 'the alternative: recursion instead of a tile parameter' },
        { title: 'Drepper - What Every Programmer Should Know About Memory', note: 'the matrix multiply walkthrough, with real timings' }
      ]
    },

    'virtual-memory-and-the-tlb': {
      summary: 'Translation as a performance structure rather than a correctness one. The '
        + 'translation buffer has a reach - entries times page size - and the section '
        + 'discovers it from a working-set sweep, prices a miss as a four-deep dependent '
        + 'pointer chase, and measures the two mechanisms that address the two different '
        + 'problems: huge pages for reach, and address-space identifiers for context switches.',
      intuition: 'The walk is a pointer chase, which is the pattern with no overlap at all.',
      formulation: {
        equations: [
          {
            label: 'Reach, and the knee the sweep finds',
            expr: 'reach = entries x page size',
            terms: [
              { sym: '64 x 4 KiB', meaning: '256 KiB' },
              { sym: 'at or below reach', meaning: '99.5% hit rate, 1.6 cycles per access' },
              { sym: 'at 2.00x reach', meaning: '49.7%, 61.4 cycles' },
              { sym: 'at 16.00x reach', meaning: '6.1%, 113.7 cycles' }
            ]
          },
          {
            label: 'The cost of a miss: four dependent accesses',
            expr: 'walk = levels x access cost, and nothing overlaps',
            terms: [
              { sym: 'the dependence', meaning: 'each level\'s address comes from the level above' },
              { sym: '4 levels at 30 cycles', meaning: '120, plus the lookup: 121 cycles' },
              { sym: 'at 24.6% hit rate', meaning: '0.246 x 1 + 0.754 x 121 = 91.5 cycles per access' },
              { sym: 'against', meaning: '1.6 cycles for the same code below the reach' }
            ]
          },
          {
            label: 'Huge pages: the same buffer describing more',
            expr: 'raise the page size, raise the reach',
            terms: [
              { sym: '2 MiB pages', meaning: 'reach 128 MiB against 256 KiB' },
              { sym: 'the same 1 MiB working set', meaning: '100.0% hit rate, 1.0 cycle per access' },
              { sym: 'what it costs', meaning: 'internal fragmentation, a slower fault, contiguous memory to find' },
              { sym: 'what it does not fix', meaning: 'the same 1 MiB still exceeds a 32 KiB L1 by 32x' }
            ]
          },
          {
            label: 'Address-space identifiers across a context switch',
            expr: 'the identifier is part of the lookup key',
            terms: [
              { sym: 'with identifiers', meaning: '16 entries survive the switch, 0 walks after it' },
              { sym: 'flush on switch', meaning: '0 survive, 16 walks, 1,936 cycles of re-translation' },
              { sym: 'correctness first', meaning: 'two spaces map the same virtual page to different frames' },
              { sym: 'without the key', meaning: 'returning the other space\'s frame is a protection hole' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The reach is entries times page size and nothing else',
          why: 'It is calculated, not fitted, and the measured knee lands on it.',
          breaks: '64 x 4 KiB = 256 KiB, and the hit rate breaks between 256 and 512 KiB.'
        },
        {
          name: 'The levels of a walk are dependent',
          why: 'It is why a translation miss costs far more than "one extra access".',
          breaks: 'Each level\'s address is the value the previous level returned.'
        },
        {
          name: 'An identifier is part of the key, not an optimisation on top',
          why: 'The same virtual page in two spaces must not match.',
          breaks: 'The demo shows both entries resident with different frames.'
        },
        {
          name: 'Huge pages fix reach and nothing else',
          why: 'They do not change the cache capacity by a single byte.',
          breaks: 'The 1 MiB set is 100% translated and still 32x an L1.'
        }
      ],
      complexity: [
        { operation: 'translation hit', average: '1 cycle', worst: 'the same' },
        { operation: 'translation miss', average: 'levels x memory access, dependent', worst: '4 x 30 + 1 = 121 cycles here; worse if the table itself misses' },
        { operation: 'context switch with identifiers', average: 'write one register', worst: 'the same' },
        { operation: 'context switch with a flush', average: 'the whole working set re-walked', worst: 'entries x walk cost, paid again on the way back' }
      ],
      failureModes: [
        {
          symptom: 'A program slows down sharply at a working-set size with no cache boundary near it.',
          cause: 'The translation reach was exceeded, not a cache capacity.',
          fix: 'Compute entries x page size, and re-run with huge pages to confirm.'
        },
        {
          symptom: 'Huge pages are enabled and the program is no faster.',
          cause: 'The problem was cache capacity, which a page size does not touch.',
          fix: 'Decompose the misses; huge pages only address translation.'
        },
        {
          symptom: 'A latency curve\'s step is attributed to the wrong structure.',
          cause: '64 entries over 4 KiB pages reach 256 KiB, between typical L1 and L2 sizes.',
          fix: 'Repeat with huge pages: a step that moves was translation, one that stays was cache.'
        },
        {
          symptom: 'Context-switch cost is far above what the scheduler accounts for.',
          cause: 'Every switch empties the translation buffer, and the working set is re-walked.',
          fix: 'Address-space identifiers, and fewer switches - the walk is paid on both sides.'
        }
      ],
      inTheWild: [
        'Transparent huge pages in Linux, and the databases that turn them off for latency reasons.',
        'ASIDs on ARM and PCIDs on x86, both for exactly the switch cost measured here.',
        'Hugepage configuration in JVM, PostgreSQL and DPDK deployments.',
        'Nested paging in virtualisation, where a guest walk multiplies the levels.'
      ],
      sources: [
        { title: 'Bryant and O\'Hallaron - Computer Systems, chapter 9', note: 'address translation end to end' },
        { title: 'Hennessy and Patterson - Computer Architecture, appendix B', note: 'the TLB as a cache, with the same four questions' },
        { title: 'Basu et al. - Efficient Virtual Memory for Big Memory Servers (ISCA 2013)', note: 'what translation costs when the working set is enormous' },
        { title: 'Intel 64 and IA-32 Software Developer\'s Manual, volume 3', note: 'PCIDs, page sizes and the walk itself' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
