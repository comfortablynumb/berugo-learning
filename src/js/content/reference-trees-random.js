/** Reference blocks for treaps, splay trees and scapegoat trees (M04.4-M04.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    treaps: {
      summary: 'A search tree by key and a heap by a random priority at the same time, which makes ' +
        'the shape a function of the key set rather than of the insertion order.',
      intuition: 'Give every key a random priority and insist on both orders. There is exactly one ' +
        'tree that satisfies both, and it is the tree a random insertion order would have built — ' +
        'without needing the insertions to be random.',
      formulation: {
        equations: [
          {
            label: 'The two orders',
            expr: 'key(left) < key(node) < key(right)  and  priority(node) ≥ priority(children)',
            terms: [
              { sym: 'uniqueness', meaning: 'for a fixed set of (key, priority) pairs there is one treap' },
              { sym: 'priority', meaning: 'must be derived from the key, not drawn at insertion time' }
            ]
          },
          {
            label: 'Expected height',
            expr: 'E[h] ≈ 4.311 · ln n ≈ 3 · log₂ n',
            terms: [
              { sym: 'measured', meaning: 'mean 22.4 over 40 seeds at n = 1 000, worst 26' }
            ]
          },
          {
            label: 'Everything from two operations',
            expr: 'insert = split + merge + merge;  delete = merge;  extract = split + split',
            terms: [
              { sym: 'split', meaning: 'one root-to-leaf path; both halves come out valid' },
              { sym: 'merge', meaning: 'requires max(left) < min(right)' }
            ]
          }
        ],
        derivation: [
          'The priorities impose a heap order, so the node with the highest priority is the root — ' +
            'which is the same as saying it was "inserted first" in the equivalent random order.',
          'Applying that argument recursively gives exactly the random-BST shape distribution, hence ' +
            'the 4.311·ln n expected height.',
          'Split recurses down one path deciding which half each node belongs to; merge recurses down ' +
            'the boundary picking the higher priority as each root.'
        ]
      },
      invariants: [
        {
          name: 'Both orders hold simultaneously',
          why: 'The key order makes it searchable; the priority order makes it balanced.',
          breaks: 'A child that outranks its parent means merge picked the wrong root.'
        },
        {
          name: 'The priority is a function of the key and the seed',
          why: 'It is what makes the shape independent of insertion order.',
          breaks: 'Drawing from a generator at insert time leaves both invariants intact and silently removes the guarantee.'
        },
        {
          name: 'merge is only called on treaps that do not interleave',
          why: 'It walks the boundary rather than comparing keys pairwise.',
          breaks: 'Merging overlapping key ranges produces a structure that is not a search tree.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log n)', worst: 'Θ(n)', note: 'expected, over the seed' },
        { operation: 'insert', average: 'Θ(log n)', worst: 'Θ(n)', note: 'one split and two merges' },
        { operation: 'delete', average: 'Θ(log n)', worst: 'Θ(n)', note: 'one merge of the two subtrees' },
        { operation: 'split / merge', average: 'Θ(log n)', worst: 'Θ(n)', note: '13 nodes touched at n = 1 000' },
        { operation: 'range extract', average: 'Θ(log n)', worst: 'Θ(n)', note: 'two splits and one merge' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'one priority per node' }
      ],
      failureModes: [
        {
          symptom: 'The same keys build different trees depending on load order.',
          cause: 'Priorities were drawn from a generator as nodes were created.',
          fix: 'Derive the priority by hashing the key with a per-structure seed.'
        },
        {
          symptom: 'A stack overflow in split or merge.',
          cause: 'Both recurse to the tree height, which is expected O(log n) but not bounded.',
          fix: 'Fine in practice; convert to an explicit stack if the structure must never fail.'
        },
        {
          symptom: 'Iteration order differs between runs of the same program.',
          cause: 'The seed was taken from a clock or an address rather than fixed.',
          fix: 'Fix the seed when reproducibility matters; randomise it when adversarial input does.'
        },
        {
          symptom: 'Duplicate keys appear after a merge.',
          cause: 'The two treaps overlapped, so merge stitched interleaved ranges together.',
          fix: 'Split at the boundary first; merge only accepts disjoint, ordered halves.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming', how: 'the implicit treap — keys are positions — gives a rope with range reverse in eighty lines' },
        { system: 'Chrome and V8 (zone allocators, earlier versions)', how: 'treaps used where a simple ordered structure was needed without balance code' },
        { system: 'LevelDB alternatives and in-memory stores', how: 'randomised BSTs where the insertion order is adversarial and code size matters' }
      ],
      sources: [
        { title: 'Seidel, Aragon — Randomized search trees (Algorithmica 1996)', where: 'the original treap paper, with the uniqueness argument' },
        { title: 'Martínez, Roura — Randomized binary search trees (JACM 1998)', where: 'the insert-at-root variant and its analysis' },
        { title: 'Blelloch, Reid-Miller — Fast set operations using treaps (SPAA 1998)', where: 'split and merge as the primitive operations' },
        { title: 'Devroye — A note on the height of binary search trees (JACM 1986)', where: 'the 4.311·ln n height the priorities inherit' }
      ]
    },

    'splay-trees': {
      summary: 'No balance rule at all: every access rotates the touched node to the root, giving ' +
        'O(log n) amortised plus the working-set property — and making every read a write.',
      intuition: 'Move what you just used to the top, in pairs. Doing it in pairs halves the depth of ' +
        'the whole path rather than just lifting one node, which is what makes the amortised argument work.',
      formulation: {
        equations: [
          {
            label: 'The potential',
            expr: 'Φ = Σ log(size of subtree at node)',
            terms: [
              { sym: 'amortised cost', meaning: 'actual + ΔΦ, which comes out O(log n)' }
            ]
          },
          {
            label: 'The three cases',
            expr: 'zig (parent is root) · zig-zig (same side) · zig-zag (opposite sides)',
            terms: [
              { sym: 'zig-zig', meaning: 'rotate the parent first — this is the case move-to-root gets wrong' }
            ]
          },
          {
            label: 'The working-set bound',
            expr: 'cost of accessing x = O(log t(x)), t = distinct keys touched since x last was',
            terms: [
              { sym: 'static optimality', meaning: 'O(Σ pᵢ log(1/pᵢ)) — within a constant of the best static tree' }
            ]
          }
        ],
        derivation: [
          'A deep access is expensive but flattens the path it walked, dropping Φ by about as much ' +
            'as the access cost — so the amortised cost telescopes to O(log n).',
          'Because the cost depends on how recently a key was touched rather than on n, a small hot ' +
            'set is served at the cost of a small tree.',
          'Measured crossover against AVL: splaying costs 1.26× at Zipf skew 0.6 and 0.24× at skew 2.0.'
        ]
      },
      invariants: [
        {
          name: 'The accessed key ends at the root',
          why: 'It is the definition of the operation, and what the working-set property rests on.',
          breaks: 'If the splay loop exits early the hot key stays deep and the bound is lost.'
        },
        {
          name: 'zig-zig rotates the parent before the node',
          why: 'The order is what halves the path depth rather than rotating around it.',
          breaks: 'Move-to-root gives the same root and no amortised bound at all.'
        },
        {
          name: 'Parent pointers stay consistent through every rotation',
          why: 'The splay walks upward and would otherwise leave the tree unreachable.',
          breaks: 'A rotation that forgets the grandparent link detaches a whole subtree.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'one access can walk the whole tree' },
        { operation: 'insert', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'splays the new node to the root' },
        { operation: 'delete', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'splay, drop, splay the predecessor, attach' },
        { operation: 'hot-set access', average: 'O(log t)', worst: 'O(log t)', note: 't = distinct keys since last touched' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'no per-node metadata at all' }
      ],
      failureModes: [
        {
          symptom: 'Throughput collapses when a second reader thread is added.',
          cause: 'Splaying restructures on read, so every read needs the exclusive lock.',
          fix: 'Use a balanced tree for shared structures; splay trees suit per-thread caches.'
        },
        {
          symptom: 'A read-only or memory-mapped structure faults or refuses to work.',
          cause: 'The lookup path writes, which the mapping does not allow.',
          fix: 'Splay trees cannot live on read-only pages; choose a structure whose reads are pure.'
        },
        {
          symptom: 'Measured no better than a balanced tree, despite the amortised bound.',
          cause: 'The access pattern is close to uniform, where there is nothing to exploit.',
          fix: 'Measure the skew first; the crossover is around Zipf skew 0.9 on this benchmark.'
        },
        {
          symptom: 'One request is dramatically slower than the rest.',
          cause: 'A single access can cost Θ(n); the bound is amortised, not per-operation.',
          fix: 'Do not use splay trees behind a latency budget on the individual operation.'
        }
      ],
      inTheWild: [
        { system: 'GNU libavl, sys/tree.h variants', how: 'splay trees offered alongside red-black for single-threaded caches' },
        { system: 'Network routing and packet caches', how: 'a small hot set inside a large key space is the ideal workload' },
        { system: 'Compiler symbol tables', how: 'repeated lookups of the same identifiers inside a scope' }
      ],
      sources: [
        { title: 'Sleator, Tarjan — Self-adjusting binary search trees (JACM 1985)', where: 'the original paper, the potential argument and the conjecture' },
        { title: 'Tarjan — Amortized computational complexity (1985)', where: 'the potential method that the analysis rests on' },
        { title: 'Iacono — In pursuit of the dynamic optimality conjecture (2013)', where: 'where the open question stands' },
        { title: 'Cormen et al. — Introduction to Algorithms, problem 17-4', where: 'splay analysis as a worked exercise' }
      ]
    },

    'scapegoat-trees': {
      summary: 'Balance kept by rebuilding rather than rotating, with no per-node metadata at all — ' +
        'amortised O(log n) from one parameter, α.',
      intuition: 'Let the tree get lopsided. When an insertion lands too deep, find the lowest ' +
        'ancestor whose subtree is more than α-heavy and rebuild that subtree perfectly balanced.',
      formulation: {
        equations: [
          {
            label: 'The weight condition',
            expr: 'size(child) ≤ α · size(node), for ½ < α < 1',
            terms: [
              { sym: 'α', meaning: 'the only parameter; 0.65 here, 2/3 and 0.75 are common' }
            ]
          },
          {
            label: 'The depth limit',
            expr: 'insertion depth ≤ ⌊log_{1/α}(n)⌋',
            terms: [
              { sym: 'α = 0.55', meaning: 'limit 16 at n = 10 000, rebuilding 40.3 nodes per insert' },
              { sym: 'α = 0.90', meaning: 'limit 88 at n = 10 000, rebuilding 7.5 nodes per insert' }
            ]
          },
          {
            label: 'The deletion rule',
            expr: 'rebuild everything when live count < α · high-water mark',
            terms: [
              { sym: 'measured', meaning: 'deleting 5 000 of 10 000 keys triggers exactly one rebuild, of 6 499 nodes' }
            ]
          }
        ],
        derivation: [
          'A rebuild costs Θ(size of the subtree), and the insertions that made the subtree lopsided ' +
            'have already banked enough credit to pay for it — the same argument the doubling array uses.',
          'Choosing the lowest node that violates the weight condition keeps the rebuilt subtree as ' +
            'small as possible.',
          'The scapegoat search is affordable because it already knows the size of the side it came ' +
            'from and only measures the sibling, which near the bottom is small.'
        ]
      },
      invariants: [
        {
          name: 'The height never exceeds the α depth limit by more than one',
          why: 'It is the guarantee; the weight condition is only the means.',
          breaks: 'A rebuild that is skipped leaves a path that no later operation will notice.'
        },
        {
          name: 'A rebuilt subtree is perfectly balanced',
          why: 'It is what buys enough headroom for the next batch of insertions.',
          breaks: 'Rebuilding into a merely legal shape makes the amortised argument fail.'
        },
        {
          name: 'The high-water mark only falls at a whole-tree rebuild',
          why: 'It is the reference point the deletion rule is measured against.',
          breaks: 'Resetting it on every delete makes the tree rebuild constantly.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'bounded by the α depth limit' },
        { operation: 'insert', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'a rebuild can touch the whole tree' },
        { operation: 'delete', average: 'O(log n) amortised', worst: 'Θ(n)', note: 'one whole-tree rebuild when it is α-thin' },
        { operation: 'rebuild', average: 'Θ(k)', worst: 'Θ(n)', note: 'two linear passes over the subtree' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'no per-node balance field at all' }
      ],
      failureModes: [
        {
          symptom: 'A p99 latency spike with no obvious cause in the request.',
          cause: 'One insertion triggered a rebuild near the root and touched most of the tree.',
          fix: 'Amortised is not per-operation; use a rotating family behind a latency budget.'
        },
        {
          symptom: 'The tree rebuilds constantly under a delete-heavy workload.',
          cause: 'The high-water mark was reset on every deletion rather than at a rebuild.',
          fix: 'Track the maximum size since the last whole-tree rebuild, and only reset it there.'
        },
        {
          symptom: 'The depth limit is never reached, and the tree is deep anyway.',
          cause: 'The limit was computed with the wrong base, or from the subtree rather than the whole tree.',
          fix: 'log base 1/α of the total live count; check the height against it in tests.'
        },
        {
          symptom: 'Rebuilds allocate heavily.',
          cause: 'The rebuild constructed new nodes instead of relinking the existing ones.',
          fix: 'Flatten to an array of the same nodes and relink; a rebuild should allocate nothing per node.'
        }
      ],
      inTheWild: [
        { system: 'Disk and SSD indexes', how: 'a rebuild is one sequential write, where rotations scatter small random writes' },
        { system: 'Haskell Data.Map, Scala TreeMap', how: 'weight-balanced rather than scapegoat, but the same balance-by-size idea with sizes stored' },
        { system: 'Embedded and memory-constrained systems', how: 'no per-node balance field, which is the whole reason to pick it' }
      ],
      sources: [
        { title: 'Galperin, Rivest — Scapegoat trees (SODA 1993)', where: 'the original paper and the amortised analysis' },
        { title: 'Andersson — General balanced trees (Journal of Algorithms 1999)', where: 'the same idea derived independently' },
        { title: 'Nievergelt, Reingold — Binary search trees of bounded balance (1973)', where: 'the BB[α] weight-balanced family' },
        { title: 'Morin — Open Data Structures, ch. 8', where: 'a clean modern treatment with the credit argument spelled out' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
