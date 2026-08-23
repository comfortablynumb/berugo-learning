/** Concepts for the search-tree sections (M04.1-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bst-rotations': [
      {
        term: 'The search-tree invariant',
        plain: 'Every key in a node\'s left subtree is smaller than it, and every key in its right subtree is larger.',
        formal: 'max(left subtree) < key < min(right subtree)',
        detail: 'The invariant is about whole subtrees, not about the two immediate children, and ' +
          'that distinction is the most common bug in hand-written checkers: a tree where every ' +
          'node is individually greater than its left child and smaller than its right child can ' +
          'still be badly out of order. Checking it correctly means carrying a bound down the ' +
          'recursion — each step narrows the interval a subtree is allowed to occupy — which is ' +
          'exactly what makes search work at all. Everything the structure can do follows from it: ' +
          'a comparison at a node eliminates one whole subtree, so a search is a single root-to-leaf ' +
          'walk rather than a scan.',
        example: 'A node whose left child is smaller but whose left-child\'s right grandchild is larger passes the naive check and is not a search tree.'
      },
      {
        term: 'Height is the cost',
        plain: 'Search, insert and delete all follow one root-to-leaf path, so all three cost the height.',
        formal: 'comparisons ≤ height, for every operation',
        readAs: 'No operation ever does more comparisons than the tree is deep. That is why the whole subject ' +
          'is about keeping the height down, and nothing else.',
        detail: 'There is only one cost model in this section and it is the height. That is why the ' +
          'whole of M04 is about controlling the height and nothing else — the operations themselves ' +
          'are already as cheap as they can be. It also tells you what to measure: not the number of ' +
          'nodes, not the memory, but the length of the longest path and the average path, because ' +
          'the first is the tail latency and the second is the throughput. A tree with a good average ' +
          'depth and a terrible height has a small number of very slow lookups, which is precisely ' +
          'the shape of a p99 problem.',
        example: 'At 4 000 keys a balanced tree answers in 12 comparisons and a degenerate one takes up to 4 000.'
      },
      {
        term: 'The three delete cases',
        plain: 'A leaf is unlinked, a node with one child is replaced by it, and a node with two children is replaced by its successor.',
        formal: 'no child; one child; two children',
        detail: 'Deletion is the operation that separates a working tree from a demo, and it has ' +
          'exactly three shapes. A leaf is simply unlinked. A node with one child is replaced by ' +
          'that child, which cannot break the ordering because the child\'s whole subtree was ' +
          'already on the correct side. A node with two children cannot be unlinked at all — ' +
          'something has to take its place, and the only two candidates are its in-order successor ' +
          'and predecessor, because they are the only keys that can sit between the two subtrees. ' +
          'The standard implementation copies the successor into the node and then deletes the ' +
          'successor, which is guaranteed to be an easier case: it has no left child.',
        example: 'Deleting the root of a full tree copies the smallest key of the right subtree into it, then deletes that key one level down.'
      },
      {
        term: 'Successor and predecessor',
        plain: 'The next key in sorted order: the minimum of the right subtree, or the first ancestor you turned left from.',
        formal: 'succ(x) = min(x.right) or the lowest ancestor whose left subtree holds x',
        detail: 'The successor has two cases and both are one walk. If the node has a right subtree, ' +
          'the answer is that subtree\'s minimum — keep going left. If it does not, the answer is ' +
          'above: climb until you come up from a left child, and that parent is the successor; if ' +
          'you reach the root without ever coming up from the left, the node was the maximum. The ' +
          'second case is why iterators either need parent pointers or a stack. Successor is also ' +
          'what makes deletion work and what makes in-order iteration O(1) amortised per step.',
        example: 'In a tree of 1…9, the successor of 4 is 5; if 5 has no right subtree, it is found by climbing rather than descending.'
      },
      {
        term: 'In-order traversal is the sorted view',
        plain: 'Visit left, then the node, then right, and the keys come out in sorted order. It is the invariant, read aloud.',
        formal: 'inOrder(T) is sorted ⟺ T is a search tree',
        readAs: 'Walking the tree left-subtree, node, right-subtree gives a sorted list exactly when the tree ' +
          'obeys the search property — and the "exactly when" runs both ways, so a sorted walk is a ' +
          'complete test of the invariant.',
        detail: 'The in-order sequence is not a property the tree happens to have; it is equivalent ' +
          'to the invariant, which makes it the single best test in the whole subject. Any operation ' +
          'that claims to preserve the search-tree property can be checked by comparing the in-order ' +
          'sequence before and after — a rotation must leave it byte-identical, an insert must add ' +
          'exactly one key in the right position, a delete must remove exactly one. This is why every ' +
          'property test in M04 compares against a reference sorted array, and why a balanced tree ' +
          'gives you sorted iteration and a range scan for free.',
        example: 'A rotation reorders the tree and leaves the in-order sequence unchanged — which is why it is safe.'
      },
      {
        term: 'Rotation',
        plain: 'Swap a parent and one child, moving one subtree across. It changes the depths and preserves the order.',
        formal: 'rotateRight(y): x = y.left; y.left = x.right; x.right = y',
        detail: 'A rotation takes a parent and one of its children and swaps which is on top, ' +
          'reattaching the middle subtree to the node that lost it. Read the in-order sequence ' +
          'before and after — A x B y C both times — and it is identical, which is the proof that a ' +
          'rotation is always safe. What changes is depth: one subtree rises by a level and another ' +
          'falls by one, in constant time, with three pointer writes. Every balanced family in this ' +
          'milestone is a different rule for deciding when to do this, and nothing else.',
        example: 'Three pointer writes, no comparisons, and the subtree that was two deep is now one deep.'
      },
      {
        term: 'Degeneration on sorted input',
        plain: 'Insert keys in sorted order and every one goes right: the tree is a linked list of height n.',
        formal: 'sorted insertion ⇒ height = n, build cost = n(n−1)/2',
        readAs: 'Insert already-sorted keys and every one goes to the right of the last, so the tree is a ' +
          'linked list n deep. The total comparisons to build it are n(n−1)/2 — about half of n ' +
          'squared, which is the quadratic collapse the balanced trees exist to prevent.',
        detail: 'Each key in a sorted stream is larger than everything already inserted, so it walks ' +
          'the entire right spine and hangs off the end. The result is a linked list with a tree API: ' +
          'height n, mean lookup n/2, and a build that costs n(n−1)/2 comparisons — 499 500 for a ' +
          'thousand keys against about 11 500 for the same keys shuffled. This matters because ' +
          'sorted input is not exotic. A bulk load from an ordered export, a monotonic id, a ' +
          'timestamp column: all of them are sorted, and all of them turn an unbalanced index into ' +
          'a scan.',
        example: 'Inserting 1…1000 in order costs 499 500 comparisons; the same keys shuffled cost about 11 500.'
      },
      {
        term: 'Height versus node count',
        plain: 'A random insertion order gives a height near 2·log₂ n at practical sizes; the worst case is still n.',
        formal: 'E[height] → 4.311·ln n; E[depth] → 2·ln n',
        readAs: 'Over random insertion orders the average height settles at about 4.311 times the natural log ' +
          'of n, and the average node sits about 2 ln n deep. Both are a constant factor off the ideal ' +
          'log₂ n, which is why a random tree is good but a balanced one is better.',
        detail: 'Random insertion order is well behaved: the expected depth of a node approaches ' +
          '2·ln n and the expected height approaches 4.311·ln n, both logarithmic. The constants ' +
          'arrive slowly, though, and quoting the asymptotic figure at a practical size overstates ' +
          'it — measured over 50 seeds at n = 1 000 the mean height is 22.3 rather than the 29.8 the ' +
          'formula gives. Two things are worth taking from this. Randomness alone buys you a ' +
          'logarithmic tree without any balance machinery, which is what treaps exploit; and the ' +
          'worst case is untouched, which is why every other family in this milestone exists.',
        example: 'Measured at n = 1 000 over 50 seeds: mean height 22.3, mean depth 12.0, against an ideal height of 10.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
