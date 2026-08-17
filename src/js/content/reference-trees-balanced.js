/** Reference blocks for AVL and red-black trees (M04.2-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'avl-trees': {
      summary: 'The strictest practical balance rule — subtree heights differ by at most one — giving ' +
        'the shallowest tree and the most rebalancing work.',
      intuition: 'Store one number per node and refuse to let it reach two. Because an insertion ' +
        'restores the height it disturbed, one rotation always suffices; because a deletion shortens ' +
        'a subtree instead, the repair can run all the way up.',
      formulation: {
        equations: [
          {
            label: 'The invariant',
            expr: 'balance(node) = h(left) − h(right) ∈ {−1, 0, +1}',
            terms: [
              { sym: 'h', meaning: 'stored per node and recomputed after every structural change' },
              { sym: '±2', meaning: 'the state that triggers a rebalance, never observable between operations' }
            ]
          },
          {
            label: 'The sparsest legal tree',
            expr: 'N(h) = N(h − 1) + N(h − 2) + 1, N(1) = 1, N(2) = 2',
            terms: [
              { sym: 'N(10)', meaning: '143 nodes, against 1 023 for a perfect tree of that height' }
            ]
          },
          {
            label: 'The height bound',
            expr: 'h < 1.4404 · log₂(n + 2) − 0.328',
            terms: [
              { sym: '1.4404', meaning: '1 / log₂ φ — the golden ratio, from the Fibonacci recurrence' },
              { sym: 'n = 10 000', meaning: 'bound 18.81; measured 14 on sorted input and 16 on shuffled' }
            ]
          }
        ],
        derivation: [
          'Insertion adds one to some subtree height; rebalancing that subtree restores its previous ' +
            'height, so no ancestor can be left unbalanced and one rotation suffices.',
          'Deletion can leave the rebalanced subtree one shorter than before, so the parent may now ' +
            'be unbalanced — the fixup has to continue upward.',
          'A double rotation is exactly two rotations: the inner child is rotated first to convert ' +
            'an LR case into an LL one.'
        ]
      },
      invariants: [
        {
          name: 'Every balance factor stays within ±1 between operations',
          why: 'It is the definition of the family and the source of the height bound.',
          breaks: 'A factor of ±2 that survives an operation means the fixup loop stopped too early.'
        },
        {
          name: 'Stored heights agree with the children',
          why: 'The rebalance rule reads them; a stale height silently produces a wrong decision.',
          breaks: 'Updating the upper node of a rotation before the lower one leaves the upper one stale.'
        },
        {
          name: 'An insertion performs at most one rebalance',
          why: 'Rebalancing restores the subtree to its pre-insertion height.',
          breaks: 'If a second rebalance is ever needed on an insert path, the height update is wrong.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'height under 1.44·log₂ n' },
        { operation: 'insert', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'at most 1 rotation' },
        { operation: 'delete', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'up to O(log n) rotations; 0.384 measured' },
        { operation: 'rebalance', average: 'Θ(1)', worst: 'Θ(1)', note: 'single or double, 3 or 6 pointer writes' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'one height field per node' }
      ],
      failureModes: [
        {
          symptom: 'The tree passes a balance check but returns wrong heights.',
          cause: 'Heights were updated in the wrong order after a rotation.',
          fix: 'Update the node that moved down first, then the node that moved up.'
        },
        {
          symptom: 'Deletion leaves a node with balance ±2.',
          cause: 'The fixup stopped at the first rotation, as insertion is allowed to.',
          fix: 'Continue rebalancing to the root on deletion; only insertion may stop early.'
        },
        {
          symptom: 'A stack overflow on a large tree.',
          cause: 'Recursive insert or delete on a structure whose depth is data-controlled.',
          fix: 'Record the path and unwind it iteratively, which is what this implementation does.'
        },
        {
          symptom: 'AVL chosen for a "read-heavy" workload and no improvement measured.',
          cause: 'The comparison saving against red-black is under 1% on typical mixes.',
          fix: 'Measure the mix; pick on what a pointer write costs, not on folklore.'
        }
      ],
      inTheWild: [
        { system: 'Windows NT kernel (VAD trees)', how: 'AVL for the virtual address descriptor lookup, which is read-dominated' },
        { system: 'C++ implementations of ordered containers', how: 'occasionally AVL, though most standard libraries chose red-black' },
        { system: 'Databases and in-memory indexes', how: 'AVL where the index is built once and read many times' }
      ],
      sources: [
        { title: 'Adelson-Velsky, Landis — An algorithm for the organization of information (1962)', where: 'the original paper' },
        { title: 'Knuth — The Art of Computer Programming, vol. 3, §6.2.3', where: 'the height analysis and the Fibonacci trees' },
        { title: 'Cormen et al. — Introduction to Algorithms, problem 13-3', where: 'AVL as an exercise on the balanced-tree chapter' },
        { title: 'Pfaff — Performance analysis of BSTs in system software (2004)', where: 'AVL against red-black on real kernel workloads' }
      ]
    },

    'red-black-trees': {
      summary: 'A 2-3-4 tree stored as a binary tree, with colours as the glue — the family standard ' +
        'libraries chose, because it bounds the rotations on both insert and delete.',
      intuition: 'Every path holds the same number of black nodes, and reds cannot be adjacent, so ' +
        'the longest path is at most twice the shortest. Most repairs are recolourings, which write ' +
        'no pointers at all.',
      formulation: {
        equations: [
          {
            label: 'The two load-bearing rules',
            expr: 'no red node has a red child; every root-to-leaf path has the same black count',
            terms: [
              { sym: 'black height b', meaning: 'black nodes per path — identical everywhere by rule five' }
            ]
          },
          {
            label: 'The height bound',
            expr: 'n ≥ 2^b − 1  ⇒  b ≤ log₂(n + 1)  ⇒  h ≤ 2·log₂(n + 1)',
            terms: [
              { sym: 'n = 10 000', meaning: 'bound 26.58; measured height 16 with black height 8' }
            ]
          },
          {
            label: 'The 2-3-4 mapping',
            expr: 'black + its red children = one 2-, 3- or 4-node',
            terms: [
              { sym: 'measured', meaning: '31.9% 2-nodes, 42.6% 3-nodes, 25.5% 4-nodes at n = 10 000' }
            ]
          }
        ],
        derivation: [
          'A new node is red because a black one would immediately break the equal-black-height rule ' +
            'on its own path, while a red one only risks the local red-red rule.',
          'The red-uncle case recolours and moves the violation two levels up; the black-uncle case ' +
            'rotates and terminates — so at most two rotations per insertion.',
          'Deleting a black node leaves a path one black short; the fixup either borrows from the ' +
            'sibling with a rotation or repaints the sibling red and moves the deficit up.'
        ]
      },
      invariants: [
        {
          name: 'The root is black and no red node has a red child',
          why: 'It caps the number of red nodes on a path at half of it.',
          breaks: 'A red-red pair means the insert fixup exited without repairing.'
        },
        {
          name: 'Every path from a node to a leaf has the same black count',
          why: 'It is what actually balances the tree; the height bound is a consequence.',
          breaks: 'A delete that forgets the double-black fixup breaks this and nothing else notices.'
        },
        {
          name: 'Parent pointers agree with child pointers',
          why: 'The fixups navigate upward and would otherwise walk into a stale subtree.',
          breaks: 'A rotation that repairs three links instead of four leaves an unreachable node.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'height under 2·log₂(n + 1)' },
        { operation: 'insert', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'at most 2 rotations' },
        { operation: 'delete', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'at most 3 rotations' },
        { operation: 'recolour', average: 'Θ(1)', worst: 'O(log n) per op', note: 'no pointer writes; ~6 per rotation measured' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'one colour bit, usually stolen from a pointer' }
      ],
      failureModes: [
        {
          symptom: 'Lookups miss keys that were definitely inserted.',
          cause: 'A rotation updated the child pointers but not a parent pointer.',
          fix: 'Repair all four links, and assert parent/child agreement in the invariant check.'
        },
        {
          symptom: 'The tree slowly becomes unbalanced over many deletions.',
          cause: 'The double-black fixup was skipped when the removed node was black.',
          fix: 'Run the fixup whenever the physically removed node was black, and check black height.'
        },
        {
          symptom: 'A null-pointer crash inside the delete fixup.',
          cause: 'The implementation was ported from a sentinel version, where the fixed node is never null.',
          fix: 'Carry the (node, parent) pair explicitly, as this implementation does.'
        },
        {
          symptom: 'Red-black chosen for the reads and measured no faster.',
          cause: 'Its advantage is on the write path; the height difference against AVL is one level.',
          fix: 'Choose on rotations and deletion cost, and measure both against your operation mix.'
        }
      ],
      inTheWild: [
        { system: 'std::map, std::set', how: 'the standard associative containers in every mainstream C++ library' },
        { system: 'java.util.TreeMap, and HashMap buckets past 8 entries', how: 'the same family, used as the flooding mitigation in M03.3' },
        { system: 'Linux CFS scheduler and the kernel rbtree', how: 'runnable tasks keyed by virtual runtime, with O(1) leftmost caching' }
      ],
      sources: [
        { title: 'Guibas, Sedgewick — A dichromatic framework for balanced trees (FOCS 1978)', where: 'the original formulation' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 13', where: 'the insert and delete fixups, with the sentinel' },
        { title: 'Sedgewick — Left-leaning red-black trees (2008)', where: 'the simplification, and what it costs' },
        { title: 'Linux kernel Documentation/core-api/rbtree.rst', where: 'the augmented and cached variants as shipped' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
