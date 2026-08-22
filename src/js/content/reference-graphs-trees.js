/** Reference entries for spanning trees and tree path queries (M13.9-M13.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'minimum-spanning-trees': {
      summary: 'The cut and cycle properties as one correctness engine for Kruskal, Prim and Borůvka; ' +
        'uniqueness measured rather than assumed; the second-best tree as a one-edge swap; and the ' +
        'minimax path the spanning tree already answers.',
      intuition: 'All three algorithms apply one theorem to a different cut, so they must agree on ' +
        'weight — and with duplicate weights they routinely disagree on the tree.',
      formulation: {
        equations: [
          {
            label: 'The cut property',
            expr: 'for any cut (S, V∖S), a minimum-weight crossing edge is in some MST',
            terms: [
              { sym: 'Kruskal', meaning: 'the globally lightest edge joining two components' },
              { sym: 'Prim', meaning: 'the lightest edge leaving one growing tree' },
              { sym: 'Borůvka', meaning: 'every component picks its own cheapest outgoing edge at once' },
              { sym: 'shown', meaning: 'after 20 Prim edges the cut holds 21 nodes and the next edge, 4–24 at weight 5, is its lightest crossing' }
            ]
          },
          {
            label: 'Measured on 60 nodes and 180 edges, weights 1 to 20',
            expr: 'all three return 59 edges weighing 270',
            terms: [
              { sym: 'work', meaning: 'Kruskal 1 666 · Prim 2 280 · Borůvka 1 170, in 3 rounds' },
              { sym: 'edge sets', meaning: 'NOT identical — 160 edges share a weight with an earlier one' },
              { sym: 'second best', meaning: '270 — a tie, so the minimum spanning tree was never unique' }
            ]
          },
          {
            label: 'Uniqueness, twenty instances per row',
            expr: 'distinct weights are sufficient for a unique MST',
            terms: [
              { sym: 'weights 1 to 3', meaning: '20/20 agree on weight, 0/20 on the edge set, 177 duplicates on average' },
              { sym: 'weights 1 to 20', meaning: '20/20 on weight, 3/20 on the edge set' },
              { sym: 'weights 1 to 100 000', meaning: '20/20 on both, 0.2 duplicates' }
            ]
          },
          {
            label: 'The minimax path',
            expr: 'min over paths of max edge = max edge on the MST path',
            terms: [
              { sym: 'checked', meaning: '198 pairs against a binary search over weight thresholds, 0 disagreements' },
              { sym: 'not the same as shortest', meaning: '136 of 198 cheapest routes have a worse worst hop' },
              { sym: 'example', meaning: 'pair 8 → 45: minimax hop 5; the cheapest route costs 18 with a hop of 9' }
            ]
          },
          {
            label: 'Where the work goes',
            expr: 'sort cost against heap traffic against per-round scans',
            terms: [
              { sym: '60 edges', meaning: 'Kruskal 425 · Prim 426 · Borůvka 619' },
              { sym: '900 edges', meaning: 'Kruskal 10 576 · Prim 15 840 · Borůvka 8 428' },
              { sym: 'rounds', meaning: 'Borůvka stays between 3 and 4 across a 15× change in edge count' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'All implementations agree on total weight',
          why: 'That is the guarantee; the particular edge set is decided by unspecified tie-breaks.',
          breaks: 'A test asserting a specific tree fails whenever a comparator changes.'
        },
        {
          name: 'The result is acyclic and spans every component',
          why: 'A weight matching a reference is not proof — two implementations can share a mistake.',
          breaks: 'On a disconnected graph, returning n − 1 edges instead of a spanning forest.'
        },
        {
          name: 'The MST path maximum equals the minimax path value',
          why: 'It is the identity that makes the MST answer a second question for free.',
          breaks: 'A disagreement against the threshold oracle means the tree is not minimum.'
        },
        {
          name: 'The second-best tree differs by exactly one edge',
          why: 'A consequence of the cycle property, so the search is over tree edges only.',
          breaks: 'A difference of zero is not a bug — it means the MST was not unique.'
        }
      ],
      complexity: [
        { operation: 'Kruskal', average: 'Θ(m log m), dominated by the sort', worst: '1 666 units at 180 edges; 10 576 at 900' },
        { operation: 'Prim (lazy heap)', average: 'Θ(m log n)', worst: '2 280 at 180 edges; 15 840 at 900 — it degrades with density' },
        { operation: 'Borůvka', average: 'Θ(m log n) in at most log₂n rounds', worst: '1 170 at 180 edges; 3 to 4 rounds throughout' },
        { operation: 'minimax query via the MST', average: 'Θ(n) per query by walking the tree', worst: '0 disagreements over 198 pairs' },
        { operation: 'threshold oracle', average: 'Θ(m log m) per query', worst: 'a binary search over weights with a union-find inside' },
        { operation: 'second-best spanning tree', average: 'Θ(n·m) by the naive scan', worst: 'one edge different, by the cycle property' }
      ],
      failureModes: [
        {
          symptom: 'An MST test fails after an unrelated refactor.',
          cause: 'It asserted a particular edge set, and duplicate weights make several trees optimal.',
          fix: 'Assert the total weight and the spanning property; those are what the algorithms guarantee.'
        },
        {
          symptom: 'Borůvka produces a cycle.',
          cause: 'Two components each chose a different copy of the same-weight edge between them.',
          fix: 'Break ties consistently — by edge id here — so both components pick the same edge.'
        },
        {
          symptom: 'A "minimise the worst link" feature was built with a bespoke threshold search.',
          cause: 'Nobody connected the minimax path to the spanning tree already in the codebase.',
          fix: 'Walk the MST path and take the maximum edge; it is the same answer, in one pass.'
        },
        {
          symptom: 'Prim is far slower than expected on a dense graph.',
          cause: 'The lazy variant pushes a heap entry per edge examined rather than per vertex.',
          fix: 'Use an indexed heap with decrease-key, or Borůvka, which wins as density rises.'
        }
      ],
      inTheWild: [
        { system: 'Network design and telecom planning', how: 'least-cost connectivity, with minimax used for worst-link guarantees' },
        { system: 'Single-linkage clustering', how: 'the dendrogram is the MST with edges cut in decreasing weight order' },
        { system: 'Image segmentation (Felzenszwalb–Huttenlocher)', how: 'a Kruskal-style merge over a pixel graph' },
        { system: 'Distributed and GPU MST implementations', how: 'Borůvka, because each component decides independently' }
      ],
      sources: [
        { title: 'On the shortest spanning subtree of a graph', where: 'Joseph B. Kruskal — Proceedings of the AMS, 1956' },
        { title: 'Shortest connection networks and some generalizations', where: 'R. C. Prim — Bell System Technical Journal, 1957' },
        { title: 'O jistém problému minimálním', where: 'Otakar Borůvka, 1926 — the first MST algorithm published' },
        { title: 'An optimal minimum spanning tree algorithm', where: 'Pettie, Ramachandran — JACM, 2002' }
      ]
    },

    'tree-path-queries': {
      summary: 'Four ways to answer "what is above these two nodes" — the naive climb, binary lifting, ' +
        'an Euler tour with a sparse table, and heavy-light decomposition — priced against each other ' +
        'on trees whose shape makes every ranking invert.',
      intuition: 'The complexity table compares log n against depth and quietly assumes depth is n; on ' +
        'real hierarchies the depth is a dozen and the clever structure loses.',
      formulation: {
        equations: [
          {
            label: 'The primitives',
            expr: 'dist(a, b) = depth(a) + depth(b) − 2·depth(lca(a, b))',
            terms: [
              { sym: 'naive climb', meaning: 'Θ(depth) per query, no preprocessing, and the oracle for the rest' },
              { sym: 'binary lifting', meaning: 'up[k][v] = up[k−1][up[k−1][v]]; n log n cells; answers k-th ancestor too' },
              { sym: 'sparse table', meaning: 'range minimum over Euler tour depths; Θ(1) per query, LCA only' },
              { sym: 'heavy-light', meaning: 'path becomes O(log n) contiguous ranges; answers any range query on the path' }
            ]
          },
          {
            label: 'Measured on a 200-node random tree of depth 13, 200 queries',
            expr: 'preprocessing cells and query work, per structure',
            terms: [
              { sym: 'naive', meaning: '0 cells, 1 630 steps, 8.15 per query' },
              { sym: 'binary lifting', meaning: '1 800 cells over 9 levels, 1 916 jumps, 9.58 per query' },
              { sym: 'sparse table', meaning: '3 591 cells over a 399-entry tour, 200 lookups, 1.00 per query' },
              { sym: 'heavy-light', meaning: '200 cells, 770 segments, 3.85 per query, worst case 6' }
            ]
          },
          {
            label: 'The same 200 queries on a path of 200 (depth 199)',
            expr: 'nothing changed but the shape',
            terms: [
              { sym: 'naive', meaning: '11 783 steps — 58.91 per query, against 8.15' },
              { sym: 'binary lifting', meaning: '621 jumps — 3.10 per query, against 9.58' },
              { sym: 'sparse table', meaning: '200 lookups — 1.00, unchanged' },
              { sym: 'heavy-light', meaning: '1 chain, every query a single range' }
            ]
          },
          {
            label: 'Heavy-light across five shapes at n = 1 000, 400 queries each',
            expr: 'the bound is 2 log₂n ≈ 20',
            terms: [
              { sym: 'path', meaning: '1 chain, worst 1, mean 1.00 — no light edges to cross' },
              { sym: 'star', meaning: '999 chains, worst 3, mean 2.99' },
              { sym: 'random', meaning: '505 chains, worst 9, mean 5.26' },
              { sym: 'caterpillar', meaning: '500 chains, worst 14, mean 7.77' },
              { sym: 'complete binary', meaning: '512 chains, worst 15, mean 8.02 — the closest to the bound' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every structure agrees with the naive climb',
          why: 'The climb is slow, obvious and the only one that cannot be subtly wrong.',
          breaks: '2 400 queries across five shapes is what makes a shape-dependent bug visible.'
        },
        {
          name: 'The segments cover exactly the vertices on the path',
          why: 'A plausible number of ranges is not the same as the right ranges.',
          breaks: 'An off-by-one at a chain boundary gives the right count and the wrong aggregate.'
        },
        {
          name: 'The k-th ancestor from the lifting table matches a k-step climb',
          why: 'It is what binary lifting buys over the faster sparse table, so it must be exercised.',
          breaks: 'A bit-order error in the jump loop produces a plausible ancestor at the wrong depth.'
        },
        {
          name: 'The number of chain segments stays under 2 log₂n',
          why: 'It is the bound the whole decomposition exists to guarantee.',
          breaks: 'A heavy child chosen by degree instead of subtree size violates it immediately.'
        }
      ],
      complexity: [
        { operation: 'rooting the tree', average: 'Θ(n), iteratively', worst: 'a path of depth n overflows a recursive version' },
        { operation: 'naive LCA', average: 'Θ(depth)', worst: '58.91 steps per query on a path of 200' },
        { operation: 'binary lifting build', average: 'Θ(n log n) cells', worst: '1 800 cells for 200 nodes' },
        { operation: 'binary lifting query', average: 'Θ(log n)', worst: '9.58 jumps on a shallow tree — worse than the climb' },
        { operation: 'sparse table build', average: 'Θ(n log n) over a 2n-entry tour', worst: '3 591 cells for 200 nodes' },
        { operation: 'sparse table query', average: 'Θ(1)', worst: '1.00 lookup, on every shape' },
        { operation: 'heavy-light path query', average: 'Θ(log n) ranges, each a segment-tree query', worst: '15 of a possible 20 at n = 1 023' }
      ],
      failureModes: [
        {
          symptom: 'An LCA structure is slower than the code it replaced.',
          cause: 'The tree is shallow, so Θ(depth) was already small and the constant factors dominate.',
          fix: 'Measure the depth of the trees you actually have before paying n log n cells.'
        },
        {
          symptom: 'Path aggregates are subtly wrong near chain boundaries.',
          cause: 'A segment range is off by one where a chain meets its parent.',
          fix: 'Verify the union of the ranges against a naive walk, at test sizes.'
        },
        {
          symptom: 'A recursive rooting pass overflows the stack.',
          cause: 'A degenerate tree — a linked list, a deep nesting — has depth n.',
          fix: 'Root iteratively. Every traversal in this milestone is iterative for this reason.'
        },
        {
          symptom: 'The decomposition produces far more segments than the bound allows.',
          cause: 'The heavy child was chosen by degree or by weight instead of by subtree size.',
          fix: 'Subtree size is what makes the halving argument work; nothing else does.'
        }
      ],
      inTheWild: [
        { system: 'Git', how: 'merge-base is an LCA query over the commit DAG, with the same shape questions' },
        { system: 'Compilers and dominator trees', how: 'nearest common dominator queries during SSA construction' },
        { system: 'Competitive programming libraries', how: 'heavy-light plus a segment tree is the standard answer to path updates' },
        { system: 'Phylogenetics and taxonomy services', how: 'lowest common ancestor over species trees, on shallow real hierarchies' }
      ],
      sources: [
        { title: 'On finding lowest common ancestors in trees', where: 'Aho, Hopcroft, Ullman — STOC 1973' },
        { title: 'Fast algorithms for finding nearest common ancestors', where: 'Harel, Tarjan — SIAM Journal on Computing, 1984' },
        { title: 'A data structure for dynamic trees', where: 'Sleator, Tarjan — Journal of Computer and System Sciences, 1983' },
        { title: 'The LCA problem revisited', where: 'Bender, Farach-Colton — LATIN 2000' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
