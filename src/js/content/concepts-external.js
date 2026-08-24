/** Concepts for bin packing, external memory and cache-oblivious algorithms (M21.4-M21.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bin-packing': [
      {
        term: 'Bin packing is the shape of every placement problem',
        plain: 'Fixed-size machines, items of assorted sizes, and the question of how many machines.',
        formal: 'partition items into the fewest subsets whose sums are at most the capacity; NP-hard offline',
        detail: 'VM placement, container scheduling, memory allocation, disk layout and CDN cache ' +
          'filling are all this problem with different words. Recognising it is worth doing ' +
          'because the results transfer intact: the online bounds, the offline heuristic, the ' +
          'tight families and — most usefully — the fact that the difficulty is fragmentation ' +
          'rather than capacity.',
        example: 'The demo packs 200 items into unit bins with a lower bound of 63 and gets ' +
          'between 64 and 80 depending on the policy.'
      },
      {
        term: 'First-fit-decreasing is within 11/9 of optimal, and it is offline',
        plain: 'Sort the items largest first, then put each in the earliest bin that fits.',
        formal: 'FFD ≤ (11/9)·OPT + 6/9; the multiplicative constant is tight',
        readAs: 'First-fit-decreasing uses at most eleven ninths of the optimal bin count plus ' +
          'six ninths.',
        detail: 'Sorting is what makes it offline: every item has to be known before the first ' +
          'is placed. The additive term is not decoration — it is why a small instance can ' +
          'exceed 11/9 without violating anything, and why a bound quoted without it looks ' +
          'broken the first time somebody measures it on twelve items.',
        example: 'Against exact optima on 25 instances of twelve items the demo measures a worst ' +
          'ratio of 1.2000 against 11/9 = 1.2222.'
      },
      {
        term: 'Online, first-fit is 1.7-competitive and nothing beats about 1.54',
        plain: 'Place each item as it arrives, in the earliest bin that fits.',
        formal: 'FF ≤ 1.7·OPT + O(1), and no online algorithm is better than 1.5403-competitive',
        detail: 'The tight family is worth knowing: sevenths, thirds and halves in that order, ' +
          'where one of each fits in a bin — they sum to 0.977 — and every bin holds exactly one ' +
          'half, so the optimum is one bin per group and cannot be beaten. First-fit puts six ' +
          'sevenths together, then two thirds, and the halves have nowhere to go. Sorted ' +
          'decreasing, the identical items pack perfectly, which is the clearest statement of ' +
          'what the arrival order costs.',
        example: 'At 6, 12, 24 and 48 groups the demo measures 1.6667 for first-fit at every ' +
          'size and 1.0000 for the sorted version.'
      },
      {
        term: 'Utilisation and bin count are different numbers',
        plain: 'A packing can use 96% of what it opened and still be a bin above optimal.',
        formal: 'utilisation = total size / (bins × capacity); the bin count is what is paid for',
        detail: 'Utilisation is a ratio and the bin count is a cost, and improving one does not ' +
          'necessarily improve the other. Worse, utilisation hides the shape of what is left: ' +
          'ten bins each 5% free is the same utilisation as one bin 50% free, and only the ' +
          'second can take another item. That is why the demo reports STRANDED capacity — free ' +
          'space in bins too small for anything remaining — as a separate column.',
        example: 'The demo measures next-fit at 78.4% utilisation with 80 bins and ' +
          'first-fit-decreasing at 98.0% with 64.'
      },
      {
        term: 'Fragmentation is the phenomenon, and it is not the same as low utilisation',
        plain: 'Free capacity scattered in pieces smaller than anything waiting.',
        formal: 'stranded capacity = Σ over bins of the free space, where that space is below the smallest remaining item',
        readAs: 'Add up, across every open bin, the free space in the bins whose free space is ' +
          'too small for the smallest item still waiting to be placed.',
        detail: 'A cluster reporting sixty per cent utilisation while rejecting jobs is not short ' +
          'of capacity; it is short of CONTIGUOUS capacity, and those are different quantities ' +
          'that one number cannot distinguish. The practical consequence is that adding machines ' +
          'raises the utilisation figure and does not raise the number of jobs that fit — the ' +
          'fixes are all about shaping the input instead.',
        example: 'The demo reports stranded capacity per policy: 0.22 for next-fit against 1.02 ' +
          'for first-fit, which has the higher utilisation of the two.'
      },
      {
        term: 'Two dimensions are qualitatively harder, not merely bigger',
        plain: 'An item fits only when both axes fit, so a bin can be full of CPU and empty of memory.',
        formal: 'fits(bin, item) = bin.cpu + item.cpu ≤ C_cpu AND bin.mem + item.mem ≤ C_mem',
        detail: 'In one dimension a bin with 30% free takes anything below 30%. In two, a bin ' +
          'with 30% CPU free and 5% memory free takes only jobs small on both, and a job that is ' +
          '10% CPU and 20% memory does not fit despite being small. The demo counts the bins that ' +
          'are full on one axis only, and on anti-correlated jobs there are many — each of them ' +
          'capacity that will be reported as free and cannot be used.',
        example: 'On 200 anti-correlated jobs the demo counts 20 lopsided bins out of 68 under ' +
          'first-fit, at 76.7% CPU and 82.1% memory utilisation.'
      },
      {
        term: 'The offline advantage disappears with the second axis',
        plain: '"Decreasing" has no meaning for a two-dimensional item.',
        formal: 'no total order on (cpu, mem) plays the role that size does in one dimension',
        detail: 'Sort by CPU and the memory axis fragments; sort by the sum and both fragment a ' +
          'little; sort by the maximum and lopsided items are misjudged. There is no ordering ' +
          'that recovers the 11/9 guarantee, and the demo shows first-fit-decreasing losing its ' +
          'advantage — from clearly best in one dimension to tied with worst-fit in two. That is ' +
          'the measured reason real cluster schedulers use scoring heuristics with no proved ' +
          'bound at all.',
        example: 'The demo measures ratios of 1.1154 for FFD and 1.1795 for worst-fit in one ' +
          'dimension, and 1.1964 against 1.2143 in two.'
      },
      {
        term: 'Next-fit is O(1) per item and genuinely bad',
        plain: 'It looks only at the last opened bin.',
        formal: 'NF ≤ 2·OPT, and the bound is tight — alternating tiny and large items open a bin each',
        detail: 'The trade is real: one comparison per item rather than a scan of every open bin, ' +
          'and no bin list to hold. That is the right choice when the item stream is enormous and ' +
          'the bins are cheap — a streaming writer packing records into blocks, for instance — ' +
          'and the wrong one whenever the bins cost money. The demo measures the price at about ' +
          'a quarter more machines.',
        example: 'On the demo’s 200-item workload next-fit uses 80 bins where first-fit uses 65, ' +
          'at 78.4% utilisation against 96.5%.'
      }
    ],

    'external-memory': [
      {
        term: 'The DAM model keeps two parameters and throws the rest away',
        plain: 'M records fit in memory, B move per transfer, and cost is the transfer count.',
        formal: 'the cost of an algorithm is the number of block transfers between fast and slow memory; computation on resident data is free',
        detail: 'It is a crude model and it predicts extremely well, because once the data ' +
          'exceeds memory the transfer count dominates everything else by orders of magnitude. ' +
          'The same two parameters describe a cache line against L1, a page against RAM and a ' +
          'disk block against a buffer pool; only the numbers change, which is why one model ' +
          'covers all three levels of the hierarchy.',
        example: 'The demo runs at M = 64 to 4 096 records and B = 16 to 256, and the measured ' +
          'transfer count matches the formula exactly at every setting.'
      },
      {
        term: 'Three bounds carry almost everything',
        plain: 'A scan is N/B, a sort is that times the pass count, a search is log base B.',
        formal: 'scan = N/B · sort = (N/B)·log_{M/B}(N/B) · search = log_B N',
        readAs: 'A scan costs N over B transfers; a sort costs that times the logarithm of N over ' +
          'B to the base M over B; a search costs the logarithm of N to the base B.',
        detail: 'The base of the sorting logarithm is the FAN-OUT rather than two, which is why ' +
          'doubling memory does not halve the passes — it changes the base of a logarithm, and ' +
          'with a realistic M/B of a few hundred that means two passes for almost any data size. ' +
          'The search bound is why a database index has a fan-out of hundreds instead of two: it ' +
          'is the same tree with the branching factor chosen to match B.',
        example: 'At M = 4 096 and B = 64 the demo reports a scan of 1 562 500 and a sort of ' +
          '12 500 000 at a hundred million records, with a search of 4.43.'
      },
      {
        term: 'The gap between the models is a factor of B, not a constant',
        plain: 'One transfer per record against one per block is exactly the block size.',
        formal: 'an algorithm with random access costs N transfers; the same work blockwise costs N/B',
        detail: 'B is 512 or 4 096, not 8, so this is not a constant anybody can optimise away. ' +
          'It is also why a hash join — optimal in the RAM model — is terrible once its table ' +
          'spills: every probe becomes a random block, and the algorithm that was asymptotically ' +
          'best becomes asymptotically worst. "It is fast on my laptop" stops predicting anything ' +
          'at exactly the point the working set leaves memory.',
        example: 'The demo’s bounds table reports the naive-over-scan ratio as 64× in every row, ' +
          'which is B exactly.'
      },
      {
        term: 'External merge sort is a scan per pass, and the passes are the design',
        plain: 'Fill memory, sort, write a run; then merge M/B − 1 runs at a time.',
        formal: 'transfers = 2·(N/B)·(1 + ⌈log_{M/B−1}(N/M)⌉)',
        readAs: 'Two times N over B, times one plus the ceiling of the logarithm of N over M to ' +
          'the base M over B minus one.',
        detail: 'Each pass reads every block once and writes every block once, so a pass costs ' +
          'exactly 2N/B and the whole cost is that times the pass count. One block per run must ' +
          'be resident plus one for output, which is where the fan-out of M/B − 1 comes from. ' +
          'Every part of the formula is a physical thing rather than an asymptotic, which is why ' +
          'the measurement can match it exactly rather than approximately.',
        example: 'At M = 1 024 and B = 64 the demo builds 8 runs, merges them in 1 pass at a ' +
          'fan-out of 15, and measures 512 transfers against a prediction of 512.'
      },
      {
        term: 'A memory budget has to be enforced, not assumed',
        plain: 'An external algorithm that quietly buffers everything reports an impossible I/O count.',
        formal: 'the simulator throws when the live record count exceeds M',
        detail: 'This is the commonest way an external-memory measurement comes out too good: ' +
          'the implementation holds a map, or an index, or the whole input, and the transfer ' +
          'counter never notices. Refusing rather than warning means a study that returns at all ' +
          'has stayed inside its budget, and the peak-held column is that check reported rather ' +
          'than asserted.',
        example: 'The demo reports peak held equal to M exactly at every setting — 64 of 64, ' +
          '1 024 of 1 024.'
      },
      {
        term: 'A nested-loop join costs one transfer per row',
        plain: 'Every probe of the inner table is a random block.',
        formal: 'transfers = |outer| for an index probe per row, against 2·sort + 2·scan for a sort-merge',
        detail: 'The two costs grow differently: the nested loop is linear in rows with a ' +
          'constant of one, and the sort-merge is linear in BLOCKS with a constant of a few. So ' +
          'the crossover depends on B and on the fan-out, and with a realistic M/B the sort-merge ' +
          'wins by a factor that grows. That comparison is most of what a query planner does, and ' +
          'it is why anything that makes a side already sorted removes most of the cost rather ' +
          'than a constant factor of it.',
        example: 'At 128 000 rows a side the demo measures 128 000 transfers for the nested loop ' +
          'and 20 000 for the sort-merge — 16 000 of sorting and 4 000 of walking.'
      },
      {
        term: 'A B-tree exists because of log_B N',
        plain: 'A node holds a block, so the branching factor is the block size.',
        formal: 'a binary search over a sorted array costs log₂ N − log₂ B transfers; a B-tree costs log_B N',
        readAs: 'A binary search costs the base-two logarithm of N minus the base-two logarithm ' +
          'of B; a B-tree costs the base-B logarithm of N.',
        detail: 'The saving is a factor of log₂ B, which at a fan-out of 256 is eight — so a ' +
          'lookup that would cost 27 transfers costs 3 or 4. That is the whole reason index ' +
          'nodes are page-sized rather than cache-line-sized, and it is the same argument the ' +
          'cache-oblivious section reaches by a different route.',
        example: 'The demo’s bounds table shows the search cost going from 2.21 to 4.43 as the ' +
          'data goes from ten thousand records to a hundred million.'
      },
      {
        term: 'This is why a query planner counts pages rather than rows',
        plain: 'Every choice it makes is a comparison of transfer counts.',
        formal: 'work_mem is M, the page size is B, and the cost model is the DAM model with constants fitted per storage device',
        detail: 'Index scan against sequential scan, hash join against sort-merge, when to spill ' +
          'and when to keep a hash table resident — every one of those is this model with real ' +
          'numbers in it. Reading a plan that way makes its decisions predictable rather than ' +
          'mysterious, and it also explains why raising work_mem changes plans rather than ' +
          'merely making the chosen one faster: it changes M, which changes the fan-out, which ' +
          'changes the pass count.',
        example: 'The demo sweeps M and B directly and shows the pass count falling from 5 to 1 ' +
          'as the memory grows, which is exactly what a work_mem change does to a plan.'
      }
    ],

    'cache-oblivious': [
      {
        term: 'Cache-oblivious means optimal without knowing M or B',
        plain: 'Recurse until the subproblem is small, and some level of the recursion fits.',
        formal: 'an algorithm is cache-oblivious when it achieves the cache-aware bound without B or M as parameters',
        detail: 'The mechanism is that a recursion produces subproblems at every scale at once, ' +
          'so whatever the cache size is, some level has subproblems that just fit. Every level ' +
          'below that is entirely resident and free, and the levels above are amortised over the ' +
          'work beneath them. Nothing in the code mentions the cache; the blocking is a ' +
          'consequence of the recursion rather than a parameter of it.',
        example: 'The demo’s recursive multiply stays within 1.333× of the best tile at every ' +
          'cache size while the best tile itself changes four times.'
      },
      {
        term: 'A comparison is only honest if the tuned reference is retuned',
        plain: 'A tile chosen for one cache and used on four is a rigged comparison.',
        formal: 'the reference is min over tile sizes of the miss count, computed separately at each cache size',
        detail: 'This is the measurement decision that makes the section worth having. If the ' +
          'tuned version is tuned once and then run everywhere, the cache-oblivious version wins ' +
          'trivially and the result means nothing. Retuning at every point makes the reference ' +
          'the best a cache-aware implementation could possibly do given somebody measured that ' +
          'machine — which is the honest opponent.',
        example: 'The demo’s best tile is 8, 16, 32 and 4 at caches of 2, 4, 16 and 64 kilobytes.'
      },
      {
        term: 'The row-major transpose misses on every element of one side',
        plain: 'Reading along rows while writing along columns.',
        formal: 'the destination access stride is n·elementBytes, which exceeds a line for any n above B',
        detail: 'One side of the transpose walks contiguously and the other jumps a row per ' +
          'element, so every write is a new line and the cache never helps. Splitting the larger ' +
          'dimension and recursing makes both sides local, because a small enough submatrix has ' +
          'both its source and its destination resident at the same time.',
        example: 'At 256 × 256 with a 16-kilobyte cache the demo measures 73 728 misses for the ' +
          'row-major loop against 16 384 for both the tiled and the recursive versions.'
      },
      {
        term: 'Recursive matrix multiplication reaches the blocked bound with no parameter',
        plain: 'Halve every dimension and make eight recursive calls.',
        formal: 'the blocked bound is O(n³/(B·√M)); the recursion attains it because some level has submatrices of side √M',
        readAs: 'The blocked miss count is n cubed divided by B times the square root of M, and ' +
          'the recursion reaches it because one of its levels has submatrices whose side is the ' +
          'square root of M.',
        detail: 'The three matrices involved in a submatrix product of side s occupy 3s² ' +
          'elements, so they fit when s is about √(M/3) — and the recursion passes through that ' +
          'size on its way down whatever M is. Above that level the work is amortised; below it ' +
          'everything is resident. The demo measures the penalty against a retuned tile at ' +
          'between 1.18 and 1.33.',
        example: 'At a 4-kilobyte cache the demo measures 6 144 misses for the best tile, 8 192 ' +
          'for the recursion and 295 424 for the unblocked loop.'
      },
      {
        term: 'The van Emde Boas layout reaches the B-tree bound without knowing B',
        plain: 'Split the tree by HEIGHT and lay each half out contiguously, recursively.',
        formal: 'a search costs O(log_B n) transfers rather than O(log₂ n − log₂ B)',
        readAs: 'A search costs on the order of the base-B logarithm of n block transfers, ' +
          'rather than the base-two logarithm of n minus the base-two logarithm of B.',
        detail: 'The top subtree of height h/2 is contiguous, and so is each of its bottom ' +
          'subtrees, recursively — so a root-to-leaf path passes through a contiguous region of ' +
          'about √n nodes at each stage, and at some stage that region is a block. The recursion ' +
          'has to walk HEAP indices rather than offsets: a subtree of a complete binary tree does ' +
          'not occupy a contiguous index range, and laying the bottom trees out by adding a base ' +
          'offset produces a permutation that measures identically to level order.',
        example: 'At height 18 the demo measures 6.65 misses per search for the vEB layout ' +
          'against 12.00 for a sorted array, on identical comparison counts.'
      },
      {
        term: 'The comparison count does not change; only where the nodes sit does',
        plain: 'The same search, the same decisions, three different layouts.',
        formal: 'comparisons per search = the tree height, in every layout',
        detail: 'This is the cleanest available statement of what a cache can and cannot see. ' +
          'The algorithm is identical — descend from the root taking the same branches — and the ' +
          'miss count differs by a factor of two, so everything in that column is layout. A ' +
          'profiler counting instructions would report the three as identical, which is why a ' +
          'miss counter is a different instrument rather than a more precise one.',
        example: 'The demo reports 18.0 comparisons per search at height 18 for all three ' +
          'layouts, with misses of 11.95, 12.00 and 6.65.'
      },
      {
        term: 'The tall-cache assumption is load-bearing',
        plain: 'The bounds need the cache to hold at least B blocks.',
        formal: 'M = Ω(B²); a cache that is wide and shallow breaks the bounds rather than degrading them',
        readAs: 'The number of records that fit in memory must be at least of the order of the ' +
          'block size squared — so a cache has to hold at least as many blocks as there are ' +
          'records in one of them.',
        detail: 'Real caches satisfy it comfortably — a 32-kilobyte L1 with 64-byte lines has ' +
          'M/B² about 8 — so it is usually invisible. It is worth stating anyway, because it is ' +
          'the assumption under which "some level of the recursion fits" becomes "some level ' +
          'fits with room for the working set", and a machine that violated it would make the ' +
          'analysis wrong rather than pessimistic.',
        example: 'The demo runs at caches from 2 to 64 kilobytes with 64-byte lines, so M/B² ' +
          'ranges from 0.5 to 16 — and the smallest cache is where the oblivious penalty is ' +
          'lowest, at 1.176.'
      },
      {
        term: 'Cache-oblivious is not free, and the base case is where the cost lives',
        plain: 'Recursing to single elements pays call overhead no miss counter shows.',
        formal: 'the constant factor against a tuned tile is measured at 1.18 to 1.33 here, before any call overhead',
        detail: 'The measured penalty is only the miss count; a real implementation also pays for ' +
          'the recursion itself, and recursing down to one element is dominated by it. The ' +
          'engineering answer is a base case sized to fit in registers with a straight loop ' +
          'inside it, letting the recursion handle everything above. That one decision is the ' +
          'difference between the idea and a usable implementation, and it is the only tuning ' +
          'parameter a cache-oblivious algorithm has.',
        example: 'The demo exposes the base case as a control, from 2 × 2 up to 16 × 16, and the ' +
          'miss count changes with it.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
