/** Reference entries for bin packing, external memory and cache-obliviousness (M21.4-M21.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bin-packing': {
      summary: 'Five policies scored against an LP lower bound on a random workload and against ' +
        'exact optima on small instances, the sevenths-thirds-halves family holding first-fit at ' +
        '1.6667 while sorting is exactly optimal, and the same jobs packed on two axes where the ' +
        'offline advantage collapses.',
      intuition: 'The difficulty is fragmentation rather than capacity, and the second dimension ' +
        'is what makes it qualitatively harder rather than merely bigger.',
      formulation: {
        equations: [
          {
            label: 'The bounds, and the additive terms that make them survive measurement',
            expr: 'FFD ≤ (11/9)·OPT + 6/9 · FF ≤ 1.7·OPT + O(1) · NF ≤ 2·OPT',
            readAs: 'First-fit-decreasing uses at most eleven ninths of the optimum plus six ' +
              'ninths; first-fit at most one point seven times the optimum plus a constant; ' +
              'next-fit at most twice the optimum.',
            terms: [
              { sym: 'the additive term', meaning: 'why a small instance can pass the multiplicative part without breaking the theorem' },
              { sym: '1.5403', meaning: 'the lower bound on ANY online algorithm — no policy beats it' },
              { sym: 'why FFD is offline', meaning: 'the sort needs every item before the first is placed' },
              { sym: 'the LP bound', meaning: 'total size over capacity, unachievable, so a ratio against it flatters' }
            ]
          },
          {
            label: 'Five policies on 200 uniform items, lower bound 63',
            expr: 'bins · ratio · utilisation · stranded capacity',
            terms: [
              { sym: 'next-fit', meaning: '80 · 1.2698 · 78.4% · 0.22' },
              { sym: 'worst-fit', meaning: '72 · 1.1429 · 87.1% · 0.00' },
              { sym: 'first-fit and best-fit', meaning: '65 · 1.0317 · 96.5% · 1.02 and 0.51' },
              { sym: 'first-fit-decreasing', meaning: '64 · 1.0159 · 98.0% · 0.00' }
            ]
          },
          {
            label: 'One dimension against two, on 200 anti-correlated jobs',
            expr: 'the ratio flattened to one axis · the ratio on both axes',
            terms: [
              { sym: 'first-fit-decreasing', meaning: '1.1154 → 1.1964' },
              { sym: 'worst-fit', meaning: '1.1795 → 1.2143' },
              { sym: 'the collapsing gap', meaning: '6.4 points of advantage become 1.8 — sorting almost stops helping' },
              { sym: 'lopsided bins', meaning: '20 of 68 are full on one axis and empty on the other' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A ratio is quoted against a stated denominator',
          why: 'The LP bound is unreachable and an exact optimum is not; the same packing scores differently against each.',
          breaks: 'The demo’s first-fit is 1.0317 against the lower bound and 1.2500 against exact optima — one of those numbers checks the theory and one does not.'
        },
        {
          name: 'The additive constant travels with the multiplicative one',
          why: 'A small instance can exceed the multiplicative bound without violating anything.',
          breaks: 'A family whose epsilon goes the wrong way makes one of each sum past the capacity, so its stated optimum is unreachable and every ratio flatters.'
        },
        {
          name: 'Utilisation and bin count are reported separately',
          why: 'They are a ratio and a cost, and improving one need not improve the other.',
          breaks: 'Ten bins each 5% free and one bin 50% free are the same utilisation, and only one of them takes another item.'
        }
      ],
      complexity: [
        { operation: 'next-fit', average: 'O(1) per item, one open bin held', worst: '2·OPT; measured 80 bins against 64 for FFD' },
        { operation: 'first-fit', average: 'O(bins) per item, or O(log n) with a segment tree', worst: '1.7·OPT + O(1); measured 1.6667 on the tight family, at every size' },
        { operation: 'best-fit', average: 'O(bins) per item; ties first-fit at 65 bins here', worst: 'same 1.7 bound as first-fit' },
        { operation: 'worst-fit', average: 'O(bins) per item; leaves the largest gap open', worst: '2·OPT — it spreads rather than concentrating' },
        { operation: 'first-fit-decreasing', average: 'O(n log n) to sort, then first-fit', worst: '(11/9)·OPT + 6/9; measured worst 1.2000 against exact optima' },
        { operation: 'exact bin packing', average: 'branch and bound with the LP bound as a cut-off', worst: 'NP-hard; the demo solves twelve items exactly and no more' }
      ],
      failureModes: [
        {
          symptom: 'A cluster reports 60% utilisation and rejects jobs.',
          cause: 'Fragmentation: the free capacity is scattered in pieces smaller than anything queued.',
          fix: 'Report stranded capacity as a separate metric, and shape the input — bucket job sizes, or defragment by draining and repacking.'
        },
        {
          symptom: 'Adding machines does not increase the number of jobs that fit.',
          cause: 'The bottleneck is one axis; the new machines add capacity on the axis that was already free.',
          fix: 'Count lopsided bins. If a third of them are full on one axis, the answer is differently-shaped machines rather than more of them.'
        },
        {
          symptom: 'Sorting the jobs largest-first stopped helping after a resource was added.',
          cause: 'There is no total order on a multi-dimensional demand that plays the role size plays in one dimension.',
          fix: 'Use a scoring heuristic fitted to the workload, and accept that no proved bound comes with it.'
        },
        {
          symptom: 'A packing benchmark says the policy choice does not matter.',
          cause: 'The workload is random and every policy lands within 3% of the lower bound.',
          fix: 'Add an adversarial family. The demo’s sevenths-thirds-halves separates the same policies by 67%.'
        }
      ],
      inTheWild: [
        'Kubernetes scheduling and VM placement, which are two- or more-dimensional bin packing with affinity constraints on top.',
        'Memory allocators: first-fit, best-fit and next-fit are the classic free-list policies, with the same fragmentation behaviour.',
        'Cutting stock in manufacturing, which is bin packing with the roles of item and bin exchanged.',
        'CDN and object-store placement, where the bins are disks and the items are objects with a size and a heat.'
      ],
      sources: [
        { title: 'Johnson — Near-optimal bin packing algorithms (1973)', note: 'the original analysis of first-fit and first-fit-decreasing' },
        { title: 'Dósa — The tight bound of first fit decreasing (2007)', note: 'the exact 11/9·OPT + 6/9, additive constant included' },
        { title: 'Coffman, Garey and Johnson — Approximation algorithms for bin packing: a survey', note: 'the map of the whole family, online and offline' },
        { title: 'Verma et al. — Large-scale cluster management at Google with Borg (2015)', note: 'multi-dimensional packing as it is actually operated' }
      ]
    },

    'external-memory': {
      summary: 'The DAM model with an enforced memory budget: an external merge sort matching its ' +
        'closed form exactly at four settings, the scan/sort/search bounds tabulated over five ' +
        'data sizes, and a nested-loop join against a sort-merge over four table sizes.',
      intuition: 'Once the data exceeds memory the transfer count is the cost, and a model that ' +
        'charges the same for every access cannot see the difference between sequential and random.',
      formulation: {
        equations: [
          {
            label: 'The three bounds the model is for',
            expr: 'scan = N/B · sort = (N/B)·log_{M/B}(N/B) · search = log_B N',
            readAs: 'A scan costs N over B transfers; a sort costs that times the logarithm of N ' +
              'over B to the base M over B; a search costs the base-B logarithm of N.',
            terms: [
              { sym: 'N', meaning: 'the record count' },
              { sym: 'B', meaning: 'records per block — 512 or 4 096 in practice, not 8' },
              { sym: 'M', meaning: 'records that fit in memory; the demo enforces it by throwing' },
              { sym: 'the base M/B', meaning: 'the fan-out — why doubling memory changes the pass count in jumps' }
            ]
          },
          {
            label: 'External merge sort: measured against predicted, 8 192 records',
            expr: 'transfers = 2·(N/B)·(1 + ⌈log_{M/B−1}(N/M)⌉)',
            readAs: 'Two times N over B, times one plus the ceiling of the logarithm of N over M ' +
              'to the base M over B minus one.',
            terms: [
              { sym: 'M = 64, B = 16', meaning: '128 runs, fan-out 3, 5 passes — 6 144 measured, 6 144 predicted' },
              { sym: 'M = 128, B = 16', meaning: '64 runs, fan-out 7, 3 passes — 4 096 against 4 096' },
              { sym: 'M = 256, B = 32', meaning: '32 runs, fan-out 7, 2 passes — 1 536 against 1 536' },
              { sym: 'M = 1 024, B = 64', meaning: '8 runs, fan-out 15, 1 pass — 512 against 512' }
            ]
          },
          {
            label: 'Nested-loop join against sort-merge, M = 8 192 and B = 64',
            expr: 'rows per side · nested loop · sort-merge · ratio',
            terms: [
              { sym: '2 000', meaning: '2 000 · 192 · 10.42×' },
              { sym: '8 000', meaning: '8 000 · 750 · 10.67×' },
              { sym: '32 000 and 128 000', meaning: '32 000 · 5 000 and 128 000 · 20 000, both 6.40×' },
              { sym: 'where the cost is', meaning: 'at 128 000 rows, 16 000 transfers of sorting and 4 000 of walking' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The memory budget is enforced, not assumed',
          why: 'An implementation that quietly holds an index or the whole input reports an impossible transfer count.',
          breaks: 'The demo’s simulator throws when the live record count exceeds M, and reports peak-held equal to M in every row.'
        },
        {
          name: 'A transfer is charged per block, never per record',
          why: 'The entire model is the factor of B between those two charges.',
          breaks: 'Charging per record makes the nested-loop join and the sort-merge look identical, which is the RAM model’s answer and is wrong by 6 to 10×.'
        },
        {
          name: 'The fan-out is M/B − 1, and it is a physical count',
          why: 'One block per input run must be resident plus one for output.',
          breaks: 'Using M/B drops the output buffer, which is a real block and makes the prediction miss by a pass at small M.'
        }
      ],
      complexity: [
        { operation: 'scan', average: 'N/B transfers, the cheapest thing possible', worst: 'the same — a scan has no bad case' },
        { operation: 'external merge sort', average: '2·(N/B)·(1 + passes); measured 512 to 6 144 here', worst: 'the pass count grows as log base M/B, so slowly' },
        { operation: 'B-tree search', average: 'log_B N transfers; 2.21 at 10⁴ records and 4.43 at 10⁸', worst: 'the same, plus the root and internal nodes usually cached' },
        { operation: 'binary search over a sorted array', average: 'log₂ N − log₂ B transfers', worst: 'a factor of log₂ B worse than the tree — eight times at a fan-out of 256' },
        { operation: 'nested-loop join with an index', average: 'one transfer per outer row; 128 000 at 128 000 rows', worst: 'linear in ROWS, so it loses by a factor that grows with B' },
        { operation: 'sort-merge join', average: 'two sorts plus two scans; 20 000 at 128 000 rows', worst: 'linear in BLOCKS; sorting is 80% of it and disappears if a side is ordered' }
      ],
      failureModes: [
        {
          symptom: 'A query that was fast in testing collapses in production.',
          cause: 'The working set crossed memory, and a hash join whose table spills turns every probe into a random block.',
          fix: 'Test at production data size, or compute the DAM cost of the plan at that size — it predicts the collapse rather than discovering it.'
        },
        {
          symptom: 'Doubling work_mem barely changed the runtime.',
          cause: 'The pass count is a logarithm base M/B; doubling M often changes nothing, and then one more doubling removes a whole pass.',
          fix: 'Compute the pass count at the current and proposed settings. Tune to a threshold, not by a percentage.'
        },
        {
          symptom: 'An "external" algorithm measures far fewer I/Os than the formula predicts.',
          cause: 'It is holding more than M records — an index, a map, or the input itself.',
          fix: 'Enforce the budget in the harness. A study that returns at all has then stayed inside it.'
        },
        {
          symptom: 'An index makes a query slower.',
          cause: 'The index scan is one random block per row and the sequential scan is N/B; below a selectivity threshold the scan wins.',
          fix: 'This is exactly the comparison the planner makes; check its row estimate, since the decision is right and the input to it may not be.'
        }
      ],
      inTheWild: [
        'Every relational query planner: work_mem is M, the page size is B, and the cost model is this one with device constants.',
        'B-trees and LSM trees, both of which exist because of log_B N rather than log₂ N.',
        'MapReduce and Spark shuffles, which are external merge sorts with the passes spread across machines.',
        'Anything that reports "spilled to disk" — that is the moment the model starts predicting the runtime.'
      ],
      sources: [
        { title: 'Aggarwal and Vitter — The input/output complexity of sorting and related problems (1988)', note: 'the model, and the matching lower bound for sorting' },
        { title: 'Vitter — External memory algorithms and data structures (2001)', note: 'the survey; where to look for anything not covered here' },
        { title: 'Graefe — Query evaluation techniques for large databases (1993)', note: 'the join and sort algorithms as a planner actually costs them' },
        { title: 'Bayer and McCreight — Organization and maintenance of large ordered indices (1972)', note: 'the B-tree, and the fan-out argument' }
      ]
    },

    'cache-oblivious': {
      summary: 'Recursive transpose and multiply against tiled versions RETUNED at every cache ' +
        'size, and the van Emde Boas tree layout against level order and a sorted array on ' +
        'identical comparison counts.',
      intuition: 'A recursion produces subproblems at every scale at once, so whatever the cache ' +
        'size is, some level of it fits — and nothing in the code had to be told which.',
      formulation: {
        equations: [
          {
            label: 'The claim, and the assumption underneath it',
            expr: 'blocked multiply = O(n³/(B·√M)) · tall cache: M = Ω(B²)',
            readAs: 'The blocked miss count is n cubed over B times the square root of M, and the ' +
              'model assumes the cache holds at least of the order of B blocks.',
            terms: [
              { sym: 'why the recursion attains it', meaning: 'three submatrices of side s occupy 3s², so some level has s ≈ √(M/3)' },
              { sym: 'the tall-cache assumption', meaning: 'a 32KB L1 with 64-byte lines has M/B² ≈ 8, so it holds comfortably' },
              { sym: 'what is NOT claimed', meaning: 'the constant factor — measured at 1.18 to 1.33 against a retuned tile' },
              { sym: 'the base case', meaning: 'the one tuning parameter a cache-oblivious algorithm has' }
            ]
          },
          {
            label: 'A 64 × 64 multiply: best RETUNED tile against the parameterless recursion',
            expr: 'cache · best tile · its misses · recursive misses · penalty',
            terms: [
              { sym: '2 KB', meaning: 'tile 8 · 8 704 · 10 240 · 1.176×' },
              { sym: '4 KB', meaning: 'tile 16 · 6 144 · 8 192 · 1.333×' },
              { sym: '16 KB', meaning: 'tile 32 · 3 072 · 4 096 · 1.333×' },
              { sym: '64 KB', meaning: 'tile 4 · 1 536 · 2 048 · 1.333× — and the unblocked loop ties, because everything fits' }
            ]
          },
          {
            label: 'Three layouts of one tree, 2 000 searches against a 4 KB cache',
            expr: 'height · comparisons · level order · sorted array · van Emde Boas',
            terms: [
              { sym: 'height 10', meaning: '10.0 · 1.97 · 2.02 · 2.36 — vEB is WORSE when the tree fits' },
              { sym: 'height 14', meaning: '14.0 · 7.15 · 7.31 · 4.55' },
              { sym: 'height 18', meaning: '18.0 · 11.95 · 12.00 · 6.65 — a saving of 1.80×' },
              { sym: 'the comparison column', meaning: 'identical in every row, so everything in the miss column is layout' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The tuned reference is retuned at every measurement point',
          why: 'A tile chosen for one cache and run on four makes the parameterless version win trivially.',
          breaks: 'The demo’s best tile is 8, 16, 32 and 4 at the four cache sizes — a fixed tile would have been beaten by construction.'
        },
        {
          name: 'The comparison count is reported beside the miss count',
          why: 'It is the evidence that the algorithm did not change and only the layout did.',
          breaks: 'Without it a layout study cannot distinguish "fewer misses" from "less work", and a profiler counting instructions would call all three identical.'
        },
        {
          name: 'The vEB recursion walks heap indices, not offsets',
          why: 'A subtree of a complete binary tree does not occupy a contiguous index range.',
          breaks: 'Laying the bottom trees out by adding a base offset produces a permutation that measures identically to level order — a silent null result.'
        }
      ],
      complexity: [
        { operation: 'row-major transpose', average: 'one miss per element on the strided side', worst: '73 728 misses at 256 × 256 with a 16KB cache' },
        { operation: 'tiled transpose', average: 'N/B misses with the right tile', worst: '16 384 at the same setting — and much worse with the wrong tile' },
        { operation: 'recursive transpose', average: 'the same N/B with no parameter', worst: '16 384, matching the tuned version exactly here' },
        { operation: 'unblocked multiply', average: 'O(n³) misses once the matrices exceed the cache', worst: '295 424 at a 2KB cache against 8 704 for the best tile' },
        { operation: 'recursive multiply', average: 'O(n³/(B·√M)); measured 1.18 to 1.33× the retuned tile', worst: 'plus call overhead the miss counter does not show — hence a real base case' },
        { operation: 'van Emde Boas search', average: 'O(log_B n); 6.65 measured against log₈(262 143) = 6.00', worst: 'slightly worse than level order when the whole structure is resident' }
      ],
      failureModes: [
        {
          symptom: 'A tuned kernel is slow on a new machine.',
          cause: 'The tile size was fitted to the cache of the machine it was measured on.',
          fix: 'Either retune per target, or use the recursive version and pay the measured 1.18 to 1.33×.'
        },
        {
          symptom: 'The recursive version is slower than the loop despite fewer misses.',
          cause: 'It recurses to single elements and is dominated by call overhead.',
          fix: 'Size the base case to fit in registers with a straight loop inside it, and let the recursion handle everything above.'
        },
        {
          symptom: 'A layout change made no measurable difference.',
          cause: 'The structure fits in cache, so there were no misses to remove.',
          fix: 'Check the working-set size first. The demo’s height-10 tree is faster in level order than in vEB order.'
        },
        {
          symptom: 'A vEB implementation measures the same as level order.',
          cause: 'The recursion was written over array offsets rather than heap indices, so it produced a different permutation with the same locality.',
          fix: 'Test that the layout is not level order, and check the miss count against a sorted array — a null result here is nearly always this bug.'
        }
      ],
      inTheWild: [
        'FFTW and ATLAS-style kernels, which combine recursion with a tuned base case for exactly this reason.',
        'Recursive matrix libraries and Strassen implementations, whose locality comes free from the recursion.',
        'Cache-oblivious B-trees and the vEB layout in read-optimised index structures.',
        'Funnelsort and the cache-oblivious sorting bound, which is the DAM sorting bound without either parameter.'
      ],
      sources: [
        { title: 'Frigo, Leiserson, Prokop and Ramachandran — Cache-oblivious algorithms (1999)', note: 'the paper that named the idea, with transpose, multiply and funnelsort' },
        { title: 'Prokop — Cache-oblivious algorithms (MIT thesis, 1999)', note: 'the van Emde Boas layout and its analysis' },
        { title: 'Demaine — Cache-oblivious algorithms and data structures (2002)', note: 'the readable survey; start here' },
        { title: 'Brodal and Fagerberg — On the limits of cache-obliviousness (2003)', note: 'what the model cannot do, including where the tall-cache assumption bites' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
