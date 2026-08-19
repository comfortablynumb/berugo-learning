/** Reference entries for the range-structure, vector and broad-phase sections (M08.7-M08.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'range-structures': {
      summary: 'Prefix sums, Fenwick trees, segment trees with and without lazy propagation, sparse tables, ' +
        'sqrt decomposition and merge-sort trees - six answers to "aggregate this interval", chosen by two ' +
        'questions.',
      intuition: 'Does the operation have an inverse, and does the array change? Those two answers pick the ' +
        'structure in about ten seconds; everything else is constants, and the constants are large enough to ' +
        'matter.',
      formulation: {
        equations: [
          {
            label: 'Fenwick',
            expr: 'update: i += i & −i;  prefix: i −= i & −i',
            terms: [
              { sym: 'coverage', meaning: 'slot i holds the (i & −i) values ending at i' },
              { sym: 'measured', meaning: 'n = 8 192: 7.49 slots per update, 13.01 per query, 8 bytes per element' }
            ]
          },
          {
            label: 'Segment tree',
            expr: 'node = combine(left, right); a query is ≤ 2⌈log₂ n⌉ stored nodes',
            terms: [
              { sym: 'measured', meaning: 'n = 8 192: 14.00 slots per update, 44.90 per query, 32 bytes per element' },
              { sym: 'ratio', meaning: '3.5× a Fenwick tree\'s query slots and 4× its memory, for any monoid' }
            ]
          },
          {
            label: 'Lazy propagation',
            expr: 'tree[node] is correct for its subtree; lazy[node] is owed to the children',
            terms: [
              { sym: 'measured', meaning: '100 000 range-add / range-min operations, 44.99 slots each, 0 mismatches' },
              { sym: 'the bug', meaning: 'the reverse convention is right whenever a range aligns with a node' }
            ]
          },
          {
            label: 'Sparse table',
            expr: 'query = combine(t[k][l], t[k][r − 2^k + 1]), k = ⌊log₂(r−l+1)⌋',
            terms: [
              { sym: 'requires', meaning: 'idempotence - the two blocks overlap in the middle' },
              { sym: 'measured', meaning: '2.00 slots per query against a segment tree\'s 44.94, at 3.00× the memory' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A Fenwick tree\'s values support an inverse',
          why: 'A range is one prefix minus another; there is no subtraction for min.',
          breaks: 'Not a wrong answer - the operation cannot be expressed at all.'
        },
        {
          name: 'A lazy node\'s stored value already includes its own pending update',
          why: 'A query that stops at the node must be able to read it without pushing.',
          breaks: 'Answers that are correct whenever the query range aligns with a node boundary, which is most hand-written tests.'
        },
        {
          name: 'A sparse table\'s operation is idempotent',
          why: 'The two covering blocks overlap, so the middle is combined twice.',
          breaks: 'Sums are double-counted; the constructor should refuse rather than answer.'
        }
      ],
      complexity: [
        { operation: 'prefix sums: query / update', average: 'O(1) / O(n)', worst: 'O(1) / O(n)' },
        { operation: 'Fenwick: query / update', average: 'O(log n) / O(log n)', worst: 'O(log n) / O(log n)' },
        { operation: 'segment tree: query / update', average: 'O(log n) / O(log n)', worst: 'O(log n), 3.5× the constant' },
        { operation: 'sparse table: build / query', average: 'O(n log n) / O(1)', worst: 'O(n log n) / O(1), no updates' },
        { operation: 'sqrt blocks: query / update', average: 'O(√n) / O(√n)', worst: 'O(√n) / O(√n)' },
        { operation: 'merge-sort tree: build / query', average: 'O(n log n) / O(log² n)', worst: 'O(n log n) memory' }
      ],
      failureModes: [
        {
          symptom: 'Range queries are right in the tests and wrong in production.',
          cause: 'Lazy propagation with the push convention reversed; aligned ranges hide it.',
          fix: 'Replay 10⁵ random mixed operations against a plain array. Nothing else finds it.'
        },
        {
          symptom: 'The structure is O(log n) and still too slow.',
          cause: 'A segment tree used for sums, where a Fenwick tree does the same job with a quarter of the memory and a third of the slot traffic.',
          fix: 'Ask whether the operation has an inverse before reaching for the general structure.'
        },
        {
          symptom: 'A sparse table returns sums that are too large.',
          cause: 'The two covering blocks overlap and the operation is not idempotent.',
          fix: 'Use a segment tree, or disjoint sparse tables if O(1) is genuinely required.'
        },
        {
          symptom: 'findKth returns nonsense.',
          cause: 'The Fenwick binary-lifting trick assumes non-negative values.',
          fix: 'Document the precondition and check it in the constructor; negative deltas break the descent.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming', how: 'Fenwick trees and segment trees are the two standard aggregates' },
        { system: 'Database histogram maintenance', how: 'a Fenwick tree over bucket counts, updated in place' },
        { system: 'Suffix-array LCP queries', how: 'a sparse table for constant-time range minima (M06)' },
        { system: 'Time-series rollups', how: 'prefix sums when the array is rebuilt nightly and read all day' }
      ],
      sources: [
        { title: 'A New Data Structure for Cumulative Frequency Tables', where: 'Peter Fenwick - Software: Practice and Experience, 1994' },
        { title: 'Efficient Implementation of a Dynamic Programming Algorithm', where: 'Boris Ryabko - 1989, the earlier independent discovery' },
        { title: 'On Finding Lowest Common Ancestors: Simplification and Parallelization', where: 'Schieber and Vishkin - SICOMP, 1988' },
        { title: 'Competitive Programmer\'s Handbook', where: 'Antti Laaksonen - chapters 9 and 28' }
      ]
    },

    'vector-search': {
      summary: 'Brute force, VP-trees, IVF, product quantisation and HNSW, all scored the same way: recall ' +
        'against an exact answer, plotted against the distance computations that bought it.',
      intuition: 'Past about ten dimensions no exact index prunes, so the question stops being "which tree" and ' +
        'becomes "what recall do I need, and what will it cost". Recall is the quantity, and it has to be ' +
        'measured on your own corpus.',
      formulation: {
        equations: [
          {
            label: 'Recall',
            expr: 'recall@k = |returned ∩ true| / k',
            terms: [
              { sym: 'measured', meaning: 'HNSW at M = 8: 58.8% at ef = 10, 83.0% at 32, 94.8% at 64, 100% at 256' },
              { sym: 'note', meaning: 'a top-1 hit rate is reported separately; missing the nearest is a different product from missing the tenth' }
            ]
          },
          {
            label: 'HNSW layers',
            expr: 'level ~ ⌊−ln(U) / ln M⌋',
            terms: [
              { sym: 'measured', meaning: '3 000 vectors at M = 8: 3 000 / 375 / 60 / 8 nodes across four layers' },
              { sym: 'split', meaning: 'M and efConstruction are baked in; ef is per request' }
            ]
          },
          {
            label: 'IVF',
            expr: 'cost ≈ lists + probe·(n/lists)',
            terms: [
              { sym: 'measured', meaning: '64 lists: 32.5% recall at probe 1, 79.7% at 4, 95.0% at 8, 100% at 32' }
            ]
          },
          {
            label: 'Product quantisation',
            expr: 'd floats → `parts` bytes; distance is one table lookup per part',
            terms: [
              { sym: 'measured', meaning: '48 dimensions → 8 bytes; recall 39.5% alone, 95.0% re-ranked 10×' },
              { sym: 'cost shape', meaning: '2 048 distance computations build the table and do not grow with n' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every node is reachable from the entry point at layer 0',
          why: 'An unreachable vector is in the index and can never be returned.',
          breaks: 'Recall has a floor below 100% that no ef can lift, and nothing reports why.'
        },
        {
          name: 'Recall is measured against brute force on the same corpus',
          why: 'An approximate index has no exact answer to be checked against.',
          breaks: '"The search got worse" arrives from users months later; the latency dashboard looked better.'
        },
        {
          name: 'A quantised index is re-ranked before its results are used',
          why: 'The codes are a shortlist; the exact vectors decide the order.',
          breaks: 'Top-1 accuracy of 10% while recall@10 reads a respectable-sounding 39.5%.'
        }
      ],
      complexity: [
        { operation: 'brute force', average: 'O(n·d)', worst: 'O(n·d)' },
        { operation: 'VP-tree, low d', average: 'O(log n)', worst: 'O(n) - and O(n) in practice above ~10 dimensions' },
        { operation: 'HNSW search', average: 'O(ef · M · log n)', worst: 'O(n) if the graph is disconnected' },
        { operation: 'HNSW build', average: 'O(n · efConstruction · M · log n)', worst: 'the dominant cost by far' },
        { operation: 'IVF search', average: 'O(lists + probe·n/lists)', worst: 'O(n) at probe = lists' },
        { operation: 'PQ search', average: 'O(parts·centroids + n·parts)', worst: 'the table dominates until n is large' }
      ],
      failureModes: [
        {
          symptom: 'An exact index is slower than a linear scan.',
          cause: 'Too many dimensions - a VP-tree computes 2 992.67 of 3 000 distances at d = 48.',
          fix: 'Stop asking for exactness; choose a recall target and measure against brute force.'
        },
        {
          symptom: 'Recall is capped and raising ef does not help.',
          cause: 'efConstruction was too low, so the graph has the wrong edges.',
          fix: 'Rebuild with a wider construction beam; 24 → 100 moved recall from 94.3% to 99.8% at the same query ef.'
        },
        {
          symptom: 'A quantised index returns confident nonsense.',
          cause: 'No re-ranking stage; the codes were treated as an answer rather than a shortlist.',
          fix: 'Fetch k·10 candidates and rescore them exactly - 100 extra distance computations took recall from 39.5% to 95.0%.'
        },
        {
          symptom: 'The memory saving does not appear in production.',
          cause: 'Re-ranking needs the exact vectors, so they are still resident.',
          fix: 'Keep codes in RAM and vectors on a colder tier; the saving is in fast memory, not in total bytes.'
        }
      ],
      inTheWild: [
        { system: 'FAISS', how: 'IVF, PQ, IVF-PQ and HNSW in one library; the reference for all four' },
        { system: 'hnswlib', how: 'the HNSW implementation behind Qdrant, Weaviate and pgvector' },
        { system: 'ScaNN and DiskANN', how: 'the current alternatives, tuned for anisotropic quantisation and for SSD respectively' },
        { system: 'ann-benchmarks', how: 'publishes exactly the recall-against-throughput curve this section builds' }
      ],
      sources: [
        { title: 'Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs', where: 'Malkov and Yashunin - TPAMI, 2018' },
        { title: 'Product Quantization for Nearest Neighbor Search', where: 'Jégou, Douze, Schmid - TPAMI, 2011' },
        { title: 'Satisfying General Proximity/Similarity Queries with Metric Trees', where: 'Jeffrey Uhlmann - Information Processing Letters, 1991' },
        { title: 'ann-benchmarks: A Benchmarking Tool for Approximate Nearest Neighbor Algorithms', where: 'Aumüller, Bernhardsson, Faithfull - Information Systems, 2020' }
      ]
    },

    'broad-phase': {
      summary: 'Sweep and prune, a rebuilt spatial hash and an all-pairs baseline, scored on pairs tested ' +
        'against pairs found - plus the tunnelling failure that none of them can fix.',
      intuition: 'The broad phase may propose pairs that do not touch and may never miss one that does. That ' +
        'asymmetry is what lets it use boxes and grids, and it fixes the two numbers worth reporting.',
      formulation: {
        equations: [
          {
            label: 'The contract',
            expr: 'proposed ⊇ actual',
            terms: [
              { sym: 'measured', meaning: '400 bodies: 79 800 / 2 370.47 / 109.97 tests per frame, all returning 70.78 pairs' }
            ]
          },
          {
            label: 'Sweep and prune',
            expr: 'sort by min-edge; scan forward while b.min ≤ a.max',
            terms: [
              { sym: 'coherence', meaning: 'frame 1 costs 41 177 swaps (n²/4 = 40 000); frames 2-120 average 164.15' },
              { sym: 'limit', meaning: 'it prunes one axis; a grid prunes two and wins by 21.6× on this scene' }
            ]
          },
          {
            label: 'The continuous test',
            expr: '|Δp + tΔv|² = (r₁ + r₂)², root in [0, dt]',
            terms: [
              { sym: 'cases', meaning: 'already overlapping at t = 0; zero relative velocity has no quadratic term' }
            ]
          },
          {
            label: 'Tunnelling against travel',
            expr: 'misses climb steeply past one diameter of travel per step',
            terms: [
              { sym: 'measured', meaning: '0 misses at 0.04 diameters/step, 61 at 0.42, 520 at 0.83, 4 510 at 1.67' },
              { sym: 'substepping', meaning: 'at 600 units/s: 32.96% missed at dt = 1/30, 0.66% at 1/120' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The proposed set is a superset of the true contact set',
          why: 'The narrow phase can reject a false positive; nothing can recover a false negative.',
          breaks: 'Objects pass through each other intermittently, and it is unreproducible.'
        },
        {
          name: 'A pair is proposed once, not once per shared cell',
          why: 'A grid stores a box in every cell it overlaps.',
          breaks: 'Duplicate narrow-phase work and, in a solver, duplicate impulses.'
        },
        {
          name: 'The sorted axis order is the previous frame\'s order',
          why: 'That is the entire justification for using an insertion sort.',
          breaks: 'Every frame costs a full O(n²) sort - 41 177 swaps rather than 165.'
        }
      ],
      complexity: [
        { operation: 'all pairs', average: 'O(n²)', worst: 'O(n²)' },
        { operation: 'sweep and prune, sort', average: 'O(n + swaps), swaps ≈ 0', worst: 'O(n²) on the first frame or after a teleport' },
        { operation: 'sweep and prune, sweep', average: 'O(n + overlapping intervals)', worst: 'O(n²) when all intervals overlap' },
        { operation: 'spatial hash', average: 'O(n) build + O(n) query', worst: 'O(n²) when everything shares a cell' },
        { operation: 'continuous test', average: 'O(1) per pair', worst: 'O(n²) if applied to every pair' }
      ],
      failureModes: [
        {
          symptom: 'Fast objects pass through walls.',
          cause: 'Tunnelling - the contact happens between two samples.',
          fix: 'Substep, or run a swept test for pairs whose combined travel exceeds their combined radius. No broad phase fixes it.'
        },
        {
          symptom: 'Sweep and prune is slower than all pairs.',
          cause: 'Objects are spread thinly on the sweep axis and thickly on the other, so the interval overlap prunes nothing.',
          fix: 'Choose the axis with the greatest variance, or use a grid, which prunes both axes.'
        },
        {
          symptom: 'A frame occasionally costs 100× the usual.',
          cause: 'A teleport or a large spawn destroyed the temporal coherence the insertion sort relies on.',
          fix: 'Expect it and measure the per-frame swap count; a grid has no such spike because it carries no state.'
        },
        {
          symptom: 'The "missed contacts" figure is alarming and constant.',
          cause: 'Counting contacts that begin mid-step and are still contacts at the next sample - one frame of latency, not tunnelling.',
          fix: 'Only count a contact as missed when neither endpoint\'s exact contact set contains it.'
        }
      ],
      inTheWild: [
        { system: 'Bullet (btAxisSweep3)', how: 'sweep and prune with incremental re-sorting' },
        { system: 'Box2D', how: 'a dynamic AABB tree - the BVH of 8.5, refitted per frame' },
        { system: 'PhysX', how: 'sweep and prune, with substepping for fast bodies' },
        { system: 'Particle and boid systems', how: 'a rebuilt grid, because every object is the same size' }
      ],
      sources: [
        { title: 'I-COLLIDE: An Interactive and Exact Collision Detection System', where: 'Cohen, Lin, Manocha, Ponamgi - Symposium on Interactive 3D Graphics, 1995' },
        { title: 'Real-Time Collision Detection', where: 'Christer Ericson - chapters 7 and 5.5' },
        { title: 'Game Physics Engine Development', where: 'Ian Millington - broad phase and continuous detection' },
        { title: 'Optimized Spatial Hashing for Collision Detection of Deformable Objects', where: 'Teschner et al. - VMV 2003' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
