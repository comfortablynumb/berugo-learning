/** Reference blocks for the search-tree sections (M04.1-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bst-rotations': {
      summary: 'An ordered dictionary whose every operation costs the height, and whose height is ' +
        'decided by the insertion order rather than by the keys.',
      intuition: 'One comparison at a node throws away a whole subtree, so a search is a single ' +
        'root-to-leaf walk. Nothing in the invariant constrains the shape, so the same keys can ' +
        'produce a tree of height log n or a linked list of height n.',
      formulation: {
        equations: [
          {
            label: 'The invariant',
            expr: 'max(keys in left subtree) < node.key < min(keys in right subtree)',
            terms: [
              { sym: 'subtree', meaning: 'the whole subtree, not the immediate child — the naive check accepts non-trees' }
            ]
          },
          {
            label: 'Cost of every operation',
            expr: 'comparisons ≤ h, where h is the height',
            terms: [
              { sym: 'h', meaning: 'nodes on the longest root-to-leaf path' },
              { sym: 'random order', meaning: 'E[h] → 4.311·ln n, E[depth] → 2·ln n' },
              { sym: 'sorted order', meaning: 'h = n exactly' }
            ]
          },
          {
            label: 'What a rotation is worth',
            expr: 'Δ(total depth) = |A| − |C| for rotateLeft(y), A = y.left, C = y.right.right',
            terms: [
              { sym: 'Δ = 0', meaning: 'the subtrees are the same size: a rotation on a balanced tree buys nothing' },
              { sym: 'Δ = −(n−1)', meaning: 'the best a single rotation can do, on a spine' }
            ]
          }
        ],
        derivation: [
          'Sorted insertion: the i-th key compares against every key already present, so the build ' +
            'costs Σ(i − 1) = n(n − 1)/2 and the tree is a spine of height n.',
          'A rotation moves y down one level along with y.left, and x up one level along with ' +
            'x.right, so the depth change is (1 + |A|) − (1 + |C|).',
          'In-order traversal of the rotated tree is A x B y C either way, which is the proof that ' +
            'a rotation preserves the invariant.'
        ]
      },
      invariants: [
        {
          name: 'The ordering holds over subtrees, not children',
          why: 'Search relies on being able to discard a whole subtree from one comparison.',
          breaks: 'A checker that compares only against the immediate children accepts trees that are not search trees.'
        },
        {
          name: 'In-order traversal is sorted',
          why: 'It is equivalent to the invariant, which makes it the test for every operation.',
          breaks: 'If a rotation or a delete changes the in-order sequence, the implementation is wrong.'
        },
        {
          name: 'Deletion of a two-child node uses the successor or the predecessor',
          why: 'Only those two keys can sit between the two subtrees.',
          breaks: 'Promoting any other node puts keys on the wrong side of it.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log n)', worst: 'Θ(n)', note: 'both are the height' },
        { operation: 'insert', average: 'Θ(log n)', worst: 'Θ(n)', note: 'one descent, then one link write' },
        { operation: 'delete', average: 'Θ(log n)', worst: 'Θ(n)', note: 'two-child case walks to the successor' },
        { operation: 'in-order iteration', average: 'Θ(n)', worst: 'Θ(n)', note: 'amortised O(1) per step' },
        { operation: 'rotation', average: 'Θ(1)', worst: 'Θ(1)', note: 'three pointer writes, no comparisons' },
        { operation: 'build from sorted input', average: 'Θ(n²)', worst: 'Θ(n²)', note: 'n(n − 1)/2 comparisons exactly' }
      ],
      failureModes: [
        {
          symptom: 'An index that was fast in testing is a scan in production.',
          cause: 'The production load was a bulk import of ordered rows, so every insert went right.',
          fix: 'Shuffle before a bulk load, insert recursively by median, or use a self-balancing family.'
        },
        {
          symptom: 'Deleting a node loses an unrelated subtree.',
          cause: 'The two-child case replaced the node with a child instead of with its successor.',
          fix: 'Copy the in-order successor into the node, then delete the successor, which has no left child.'
        },
        {
          symptom: 'A stack overflow while traversing a large tree.',
          cause: 'A recursive traversal on a degenerate tree needs one frame per node.',
          fix: 'Traverse iteratively with an explicit stack; the depth is data-controlled, so it must be bounded.'
        },
        {
          symptom: 'An invariant checker passes on a tree that returns wrong answers.',
          cause: 'The checker compared each node against its children rather than against the bounds it inherits.',
          fix: 'Carry (lo, hi) bounds down the walk, which is what the platform\'s checkOrder does.'
        }
      ],
      inTheWild: [
        { system: 'std::map, TreeMap', how: 'red-black rather than plain BSTs, precisely because the plain version has no height guarantee' },
        { system: 'Database B+ indexes', how: 'the same descent, with the node sized to a page and the balance maintained on every insert' },
        { system: 'Interview whiteboards', how: 'the plain BST is where the three delete cases and the rotation identity are learned' }
      ],
      sources: [
        { title: 'Cormen, Leiserson, Rivest, Stein — Introduction to Algorithms, ch. 12', where: 'binary search trees, including the delete cases' },
        { title: 'Knuth — The Art of Computer Programming, vol. 3, §6.2.2', where: 'the analysis of random insertion order' },
        { title: 'Sedgewick, Wayne — Algorithms, 4th ed., ch. 3.2', where: 'BSTs with the rotation primitive built up from scratch' },
        { title: 'Devroye — A note on the height of binary search trees (JACM 1986)', where: 'the 4.311·ln n height constant' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
