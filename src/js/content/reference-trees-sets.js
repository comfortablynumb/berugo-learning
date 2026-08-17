/** Reference blocks for skip lists and disjoint set union (M04.9-M04.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'skip-lists': {
      summary: 'A sorted linked list with probabilistic express lanes: expected O(log n) with no ' +
        'balance rule, and an insertion that is a splice rather than a rotation.',
      intuition: 'Promote each node to the next lane with probability p. The top lanes cover the ' +
        'distance and the bottom lane finishes the job — and because nothing is ever restructured, an ' +
        'insertion is a few pointer writes that a compare-and-swap can make atomic.',
      formulation: {
        equations: [
          {
            label: 'Tower heights',
            expr: 'P(height = k) = p^(k−1)(1 − p),  E[height] = 1/(1 − p)',
            terms: [
              { sym: 'measured', meaning: '1.999 pointers per node at p = 0.5, 1.333 at p = 0.25' }
            ]
          },
          {
            label: 'Search cost',
            expr: 'L/p + 1/(1 − p), with L = log_{1/p}(n)',
            terms: [
              { sym: 'measured', meaning: '30.89 comparisons at p = 0.5, 32.13 at p = 0.25, over 100 000 keys' },
              { sym: 'optimum', meaning: 'p = 1/e = 0.368, and the curve around it is flat' }
            ]
          },
          {
            label: 'The comparison a tree makes',
            expr: 'AVL over the same keys: 15.68 comparisons per search',
            terms: [
              { sym: 'why', meaning: 'a tree comparison halves the range; a skip-list step advances by 1/p nodes' }
            ]
          }
        ],
        derivation: [
          'Fewer levels and more steps per level cancel, so the search cost is nearly flat in p while ' +
            'the memory term 1/(1 − p) is not — which is what makes p a memory dial.',
          'An insertion splices the node into the lanes it was promoted to and touches nothing else, ' +
            'so it is one pointer write per level.',
          'The deterministic 1-2-3 variant promotes on a fixed schedule and is exactly a 2-3 tree, ' +
            'trading the input-independence back for a worst-case bound.'
        ]
      },
      invariants: [
        {
          name: 'Level 0 holds every key, in order',
          why: 'It is the list; every other level is an index over it.',
          breaks: 'A splice that misses level 0 loses the key entirely while the express lanes still show it.'
        },
        {
          name: 'Each level is a subsequence of the level below it',
          why: 'A search drops from a lane into the one below and must land in the right place.',
          breaks: 'A key present on level 2 but not level 1 makes the descent skip past it.'
        },
        {
          name: 'The update vector is captured before any pointer is written',
          why: 'Insert and delete both need the last node before the target on every level.',
          breaks: 'Rewriting a pointer mid-descent corrupts the vector the rest of the operation uses.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'O(log n) expected', worst: 'Θ(n)', note: '30.89 comparisons at 100 000 keys, p = 0.5' },
        { operation: 'insert', average: 'O(log n) expected', worst: 'Θ(n)', note: 'one splice per promoted level' },
        { operation: 'delete', average: 'O(log n) expected', worst: 'Θ(n)', note: 'one unlink per level the node reached' },
        { operation: 'range scan', average: 'Θ(log n + k)', worst: 'Θ(n)', note: 'descend once, then walk level 0' },
        { operation: 'space', average: 'Θ(n/(1 − p))', worst: 'Θ(n·maxLevel)', note: '2.0 pointers per node at p = 0.5' }
      ],
      failureModes: [
        {
          symptom: 'A key can be found on one run and not the next.',
          cause: 'The tower was spliced into some levels and not others, so the descent misses it.',
          fix: 'Splice every level from 0 up to the drawn height, and check the subsequence invariant.'
        },
        {
          symptom: 'Search cost grows badly at large n.',
          cause: 'maxLevel was set too low, so the top lane covers the whole list.',
          fix: 'maxLevel must be at least log_{1/p}(n) for the largest n expected.'
        },
        {
          symptom: 'Switching p from 0.5 to 0.25 did not make searches faster.',
          cause: 'It was never going to: the search cost is nearly flat in p.',
          fix: 'Expect the gain in memory — a third fewer pointers — not in comparisons.'
        },
        {
          symptom: 'A concurrent skip list corrupts under load.',
          cause: 'Levels were spliced top-down, so a reader can see a node on a high lane before it exists on level 0.',
          fix: 'Splice bottom-up: a node must be reachable on level 0 before it appears on any lane above.'
        }
      ],
      inTheWild: [
        { system: 'Redis sorted sets (ZSET)', how: 'a skip list with p = 0.25 alongside a hash map, giving range queries by score' },
        { system: 'LevelDB and RocksDB memtables', how: 'a lock-free skip list — writers CAS one pointer per level, readers take no lock' },
        { system: 'java.util.concurrent.ConcurrentSkipListMap', how: 'the concurrent ordered map in the JDK, for the same reason' }
      ],
      sources: [
        { title: 'Pugh — Skip lists: a probabilistic alternative to balanced trees (CACM 1990)', where: 'the original paper, with the cost analysis' },
        { title: 'Munro, Papadakis, Sedgewick — Deterministic skip lists (SODA 1992)', where: 'the 1-2-3 variant and its equivalence to 2-3 trees' },
        { title: 'Herlihy, Shavit — The Art of Multiprocessor Programming, ch. 14', where: 'the lock-free construction' },
        { title: 'Redis t_zset.c and LevelDB skiplist.h', where: 'two production implementations worth reading end to end' }
      ]
    },

    'disjoint-sets': {
      summary: 'An array of parent pointers answering one question — same set or not — in effectively ' +
        'constant amortised time, from two independent optimisations.',
      intuition: 'Each set is a tree and the root names it. Never hang a taller tree under a shorter ' +
        'one, and flatten every path you walk; either alone gives O(log n), and together they give ' +
        'O(α(n)).',
      formulation: {
        equations: [
          {
            label: 'Union by rank',
            expr: 'rank increases only when two equal ranks merge; a rank-r tree holds ≥ 2^r elements',
            terms: [
              { sym: 'height', meaning: '≤ log₂ n with no compression at all — measured 8 at n = 100 000' }
            ]
          },
          {
            label: 'Path compression',
            expr: 'after find(x), every node on the path points directly at the root',
            terms: [
              { sym: 'measured', meaning: 'depth 3 and 1.017 hops per find, for 17 751 pointer writes' }
            ]
          },
          {
            label: 'The bound',
            expr: 'O(m · α(n)) for m operations, with a matching lower bound',
            terms: [
              { sym: 'α(n)', meaning: '4 for every n up to 2^65536 — effectively constant, not constant' }
            ]
          }
        ],
        derivation: [
          'Union by rank alone bounds the height at log₂ n because a tree of rank r contains at least ' +
            '2^r elements.',
          'Path compression alone gives O(log n) amortised, because each find pays a constant per node ' +
            'to make every future find on that path one hop.',
          'A union records one parent and one rank, so it can be undone exactly; a compressing find ' +
            'rewrites an unbounded number of parents that no union recorded, so it cannot.'
        ]
      },
      invariants: [
        {
          name: 'Following parents always terminates at a root',
          why: 'Every operation is a walk to a root; a cycle hangs the program.',
          breaks: 'Attaching a root to a node inside its own tree, which is what forgetting to find() first does.'
        },
        {
          name: 'The number of roots equals the component count',
          why: 'It is the cheapest full check that unions and the counter agree.',
          breaks: 'Decrementing the count on a union that merged nothing.'
        },
        {
          name: 'Rank never decreases, and bounds the height',
          why: 'It is what makes the union rule work without measuring anything.',
          breaks: 'Compression lowers real heights but must not lower ranks; ranks stay upper bounds.'
        }
      ],
      complexity: [
        { operation: 'find', average: 'O(α(n)) amortised', worst: 'O(log n)', note: '1.017 hops per find measured' },
        { operation: 'union', average: 'O(α(n)) amortised', worst: 'O(log n)', note: 'two finds plus one pointer write' },
        { operation: 'connected', average: 'O(α(n)) amortised', worst: 'O(log n)', note: 'two finds' },
        { operation: 'find, no compression', average: 'Θ(log n)', worst: 'Θ(log n)', note: '1.993 hops measured — the rollback variant' },
        { operation: 'undo', average: 'Θ(1)', worst: 'Θ(1)', note: 'only without compression' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'one parent and one rank per element' }
      ],
      failureModes: [
        {
          symptom: 'A rollback restores the wrong state, or the structure loops.',
          cause: 'Path compression was enabled alongside an undo journal.',
          fix: 'Use union by rank alone for rollback; this implementation refuses the combination outright.'
        },
        {
          symptom: 'Operations are logarithmic rather than near-constant.',
          cause: 'Only one of the two optimisations is in place.',
          fix: 'Both are needed for α(n); either alone gives O(log n).'
        },
        {
          symptom: 'union(a, b) creates a cycle and a later find never returns.',
          cause: 'The union attached the elements rather than their roots.',
          fix: 'Always find both roots first, and compare them before attaching.'
        },
        {
          symptom: 'Component sizes are wrong after a merge.',
          cause: 'The size was added to the wrong root, or to a non-root.',
          fix: 'Update the size on the surviving root only, and query it through find.'
        }
      ],
      inTheWild: [
        { system: 'Kruskal\'s minimum spanning tree', how: 'one find per endpoint decides whether an edge closes a cycle' },
        { system: 'Connected-component labelling in image processing', how: 'merging pixel runs in a single raster pass' },
        { system: 'Hindley-Milner type inference', how: 'unification of type variables is exactly union-find' }
      ],
      sources: [
        { title: 'Tarjan — Efficiency of a good but not linear set union algorithm (JACM 1975)', where: 'the α(n) bound' },
        { title: 'Tarjan, van Leeuwen — Worst-case analysis of set union algorithms (JACM 1984)', where: 'every combination of the union and compression rules, analysed' },
        { title: 'Fredman, Saks — The cell probe complexity of dynamic data structures (STOC 1989)', where: 'the matching lower bound' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 21', where: 'the standard treatment, with the rank argument' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
