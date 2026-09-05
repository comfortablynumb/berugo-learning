/** Concepts for the balanced families: AVL and red-black (M04.2-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'avl-trees': [
      {
        term: 'The height-balance invariant',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["at every node: the two subtree<br/>heights differ by at most 1"] --> B["checked after every insert and delete"]',
            '    B --> C["violated: rotate to restore it"]',
            '    C --> D["the height stays within about<br/>1.44 · log₂ n, always"]',
            '    D --> E["the tightest bound here, and the<br/>most rebalancing work to keep it"]'
          ].join('\n'),
          caption: 'AVL buys the shortest tree of any scheme in this milestone, and pays for it on every write. Which side of that trade you want is the whole choice.'
        },
        plain: 'The two subtrees of every node differ in height by at most one.',
        formal: 'balance(node) = h(left) − h(right) ∈ {−1, 0, +1}',
        readAs: 'A node\'s balance is the height of its left subtree minus the height of its right, and AVL ' +
          'allows only three values: left-heavy by one, level, or right-heavy by one. Anything outside ' +
          'that set triggers a rotation.',
        detail: [
          'This is the strictest rule any practical family imposes, and everything else about AVL ' +
            'follows from it.',
          'Because it is a rule about heights rather than about sizes or colours, it can be ' +
            'checked in constant time from the two children. That is why each node stores its ' +
            'height.',
          'It is also the reason AVL gives the shallowest tree of the families here, and does the ' +
            'most rotation work to keep it.',
          'Any operation that pushes a balance factor to ±2 must be repaired immediately, before ' +
            'the next operation sees it.'
        ],
        example: 'A node whose left subtree is height 5 and right subtree height 3 has balance +2 and must be rebalanced.'
      },
      {
        term: 'Balance factor',
        plain: 'One small integer per node: left height minus right height. It is what the rebalance rule reads.',
        formal: 'stored as height, read as h(left) − h(right)',
        readAs: 'What is kept in the node is the subtree height; the balance is computed by subtracting the ' +
          'two children\'s heights when needed. Storing the difference directly saves a byte and costs ' +
          'you the ability to repair the tree after a bulk change.',
        detail: [
          'Implementations store either the height or the balance factor itself. Storing the ' +
            'height costs a few more bits and makes the update trivial, which is why this platform ' +
            'does it.',
          'Either way the field must be recomputed for every node whose children changed, and the ' +
            'order matters. After a rotation the lower node must be updated before the upper one, ' +
            'or the upper one reads a stale height.',
          'That single ordering mistake is the most common AVL bug, and it produces a tree that ' +
            'looks balanced and is not. It is exactly what the invariant checker in this section ' +
            'catches.'
        ],
        example: 'A stored height that disagrees with the children is an error even when the balance factor looks fine.'
      },
      {
        term: 'The four rebalance cases',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["which way does the<br/>heavy path bend?"] --> B["LL — straight left:<br/>one rotation"]',
            '    A --> C["RR — straight right:<br/>one rotation"]',
            '    A --> D["LR — left then right:<br/>rotate the child first, then two"]',
            '    A --> E["RL — right then left:<br/>same, mirrored"]'
          ].join('\n'),
          caption: 'A straight path straightens with one rotation. A kinked path has to be straightened first, which is the only reason there are four cases rather than two.'
        },
        plain: 'LL and RR need one rotation; LR and RL need an inner rotation first, so they cost two.',
        formal: 'LL; LR; RL; RR, keyed by the heavy side and its heavy side',
        detail: [
          'When a node goes to ±2 the fix depends on where the extra height came from.',
          'If the heavy subtree is heavy on the same side (LL or RR), a single rotation at the ' +
            'unbalanced node fixes it.',
          'If it is heavy on the inside (LR or RL), a single rotation just moves the problem ' +
            'across. The inner child is rotated first, to turn the case into the outer one.',
          'Counting them separately is worth doing because they are not the same amount of work. A ' +
            'double rotation is two rotations, six pointer writes rather than three.',
          'Sorted insertion produces only single rotations, and random insertion produces about ' +
            'half of each.'
        ],
        example: 'At n = 10 000, sorted insertion measures 9 986 single rotations and no double ones; a shuffled build measures 2 331 single and 2 320 double.'
      },
      {
        term: 'One rotation on insert',
        plain: 'An insertion never needs more than one rebalance, however tall the tree is.',
        formal: 'rebalancing after an insert restores the subtree height',
        detail: [
          'The reason is exact, not empirical.',
          'An insertion increases some subtree height by one, and rebalancing that subtree brings ' +
            'it back to the height it had before the insertion. So every ancestor sees the same ' +
            'height it saw before, and none of them can be out of balance.',
          'The walk back up still has to fix heights, but it can stop rotating after the first ' +
            'repair.',
          'Measured over 20 000 randomised insertions the worst single insertion rebalances ' +
            'exactly once, which is the theorem showing up in the counter.'
        ],
        example: 'Over 20 000 inserts, the largest number of rebalances in any single call is 1.'
      },
      {
        term: 'Deletion is the expensive one',
        plain: 'A deletion can rebalance at every level, because it shortens a subtree rather than restoring it.',
        formal: 'up to O(log n) rotations per removal',
        detail: [
          'Deletion breaks the argument above. Rebalancing a subtree after a removal can leave it ' +
            'one shorter than it was. That can unbalance its parent, which can unbalance its ' +
            'parent, all the way to the root.',
          'So the fixup loop cannot stop at the first rotation the way insertion can.',
          'In practice the average is well under one rotation per deletion — 0.384 measured over ' +
            '5 000 removals. But the worst single call in that same run rebalanced six times.',
          'This asymmetry is precisely why libraries that delete a lot prefer red-black.'
        ],
        example: 'Deleting 5 000 keys from a 10 000-key tree costs 1 919 rotations, and the worst single deletion costs 6.'
      },
      {
        term: 'The height bound',
        plain: 'h < 1.4404·log₂(n + 2) − 0.328, which is about 44% worse than a perfect tree.',
        formal: 'N(h) = N(h−1) + N(h−2) + 1, the Fibonacci recurrence',
        readAs: 'The fewest nodes an AVL tree of height h can hold is one root plus the smallest trees of ' +
          'height h−1 and h−2 hanging off it. That is the Fibonacci pattern, and it is what pins the ' +
          'height at about 1.44 log₂ n.',
        detail: [
          'The bound comes from asking the opposite question: what is the fewest nodes an AVL tree ' +
            'of height h can hold?',
          'The answer is a Fibonacci-shaped recurrence, because the sparsest legal tree has one ' +
            'subtree of height h−1 and the other of h−2.',
          'That gives 1, 2, 4, 7, 12, 20, 33, 54, 88, 143 nodes for heights 1 to 10, and inverting ' +
            'it gives the bound.',
          'At n = 10 000 the bound is 18.81 against a perfect tree at 14. A real tree measures 14 ' +
            'on sorted input and 16 on shuffled — comfortably inside.'
        ],
        example: 'The sparsest AVL tree of height 10 holds just 143 nodes; a perfect one holds 1 023.'
      },
      {
        term: 'Read-heavy is a measurement, not a slogan',
        plain: 'AVL buys a shallower tree with more rotations. Whether that is a win depends on the operation mix.',
        formal: 'compare comparisons saved against rotations spent',
        detail: [
          'The received wisdom is "AVL for reads, red-black for writes", and it is right in ' +
            'direction and vague in size.',
          'On an identical 20 000-operation stream the two families measure within a percent of ' +
            'each other on comparisons, while AVL does 20% more rotations.',
          'So the real question is what a rotation costs relative to a comparison in your setting. ' +
            'Pointer writes are cheap in memory and expensive under a lock or across a page ' +
            'boundary.',
          'Measure the mix; the difference is smaller than the folklore suggests.'
        ],
        example: 'At a 45/30/25 insert/delete/find mix: AVL 214 913 comparisons and 4 434 rotations, red-black 216 761 and 3 613.'
      },
      {
        term: 'Sorted input is the easy case here',
        plain: 'The order that destroys a plain BST is the cheapest one for AVL: every rebalance is a single rotation.',
        formal: 'monotone insertion ⇒ only RR (or only LL) cases',
        readAs: 'Insert keys in increasing order and every imbalance leans the same way, so only one of the ' +
          'four rotation cases ever fires. The ⇒ is "which means".',
        detail: [
          'A sorted stream always inserts on the right spine, so the only imbalance that ever ' +
            'appears is right-right, and the only fix ever needed is a single left rotation.',
          'That makes it both the most frequent rebalancing — almost one per insert, 0.999 ' +
            'measured — and the cheapest kind.',
          'Shuffled input produces fewer rebalances, 0.465 per insert, but half of them are ' +
            'doubles.',
          'The pleasing consequence is that the input which turns an unbalanced BST into a ' +
            '10 000-node linked list produces a height-14 AVL tree instead.'
        ],
        example: 'Sorted insertion of 10 000 keys: height 14, 9 986 rotations, every one of them single.'
      }
    ],

    'red-black-trees': [
      {
        term: 'The five rules',
        plain: 'Nodes are red or black; the root is black; null children count black; no red node has a red child; every root-to-leaf path has the same number of black nodes.',
        formal: 'colour; black root; black leaves; no red-red; equal black height',
        detail: [
          'Only the last two rules do any work.',
          '"No red node has a red child" caps how many red nodes a path can contain — at most ' +
            'every other one. "Every path has the same black count" pins the black nodes exactly.',
          'Together they say the longest path is at most twice the shortest, which is the height ' +
            'bound. The first three are bookkeeping that make the other two well defined.',
          'Checking them is the only way to be sure an implementation is right, and the ' +
            'black-height rule is the one that catches real bugs. It fails on paths a test suite ' +
            'would otherwise never compare.'
        ],
        example: 'A fixup that leaves one path with three black nodes and another with four is broken, however plausible the tree looks.'
      },
      {
        term: 'Black height',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["count the black nodes on any path<br/>from a node down to a leaf"] --> B["every path gives the same number"]',
            '    B --> C["and no red node has a red child"]',
            '    C --> D["so the longest path is at most<br/>twice the shortest"]',
            '    D --> E["which is the height bound,<br/>with no heights ever stored"]'
          ].join('\n'),
          caption: 'The balance is enforced by a colour rule rather than by measuring anything, which is why a red-black node carries one bit where an AVL node carries an integer.'
        },
        plain: 'The number of black nodes on any path from a node down to a leaf. Every path gives the same answer.',
        formal: 'bh(node), identical on every descending path',
        detail: [
          'Black height is the quantity the structure actually balances. The tree is exactly ' +
            'balanced in black nodes and only approximately balanced in total nodes.',
          'A subtree of black height b holds at least 2^b − 1 nodes, which is where the bound ' +
            'comes from.',
          'With n nodes, b is at least log₂(n + 1). And since at most half the nodes on a path are ' +
            'red, the height is at most 2b.',
          'It is also the height of the equivalent 2-3-4 tree, which is the cleanest way to see ' +
            'why the rules were chosen.'
        ],
        example: 'A 10 000-key tree measured black height 8 and height 16 — exactly the factor-of-two relationship.'
      },
      {
        term: 'The 2-3-4 isomorphism',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a black node with no red children"] --> B["a 2-node"]',
            '    C["a black node with one red child"] --> D["a 3-node"]',
            '    E["a black node with two red children"] --> F["a 4-node"]',
            '    F --> G["red is not a node —<br/>it is glue holding one 2-3-4 node together"]'
          ].join('\n'),
          caption: 'Once you see red as glue rather than as a node, every insert case stops being arbitrary: they are the 2-3-4 splits, written in a binary tree.'
        },
        plain: 'A black node with its red children is one node of a 2-3-4 tree. Red is not a node, it is a second key.',
        formal: 'black alone = 2-node; one red child = 3-node; two red children = 4-node',
        detail: [
          'This mapping is what makes the colour rules stop being arbitrary.',
          'A 2-3-4 tree keeps all its leaves at the same depth by storing one, two or three keys ' +
            'per node. A red-black tree stores the same thing in a binary tree, using red edges to ' +
            'glue the extra keys onto their black parent.',
          'Every rule then has a translation. No red-red is "a node holds at most three keys", ' +
            'equal black height is "all leaves are at the same depth", and the insert fixup cases ' +
            'are node splits.',
          'A measured 10 000-key tree formed 5 164 such nodes: 31.9% 2-nodes, 42.6% 3-nodes and ' +
            '25.5% 4-nodes.'
        ],
        example: 'The 2-3-4 tree that a red-black tree encodes has height equal to its black height.'
      },
      {
        term: 'Recolouring versus rotating',
        plain: 'Most of the insert fixup is recolouring, which touches no pointers at all.',
        formal: 'red uncle ⇒ recolour and move up two levels',
        readAs: 'When the new node\'s uncle is red, no rotation is needed: recolour the parent and uncle ' +
          'black, the grandparent red, and carry the problem up two levels to fix there.',
        detail: [
          'The insert fixup has two shapes.',
          'When the new node\'s uncle is red, the fix is three colour changes and the problem ' +
            'moves two levels up: no rotation, no pointer written.',
          'When the uncle is black, one or two rotations end the fixup for good.',
          'Since the recolour case is much more common, the bulk of the work is colour changes. A ' +
            '10 000-key build measured 33 239 recolourings against 5 763 rotations.',
          'That matters because a recolour is a byte in a node the code has already loaded, and a ' +
            'rotation is three pointer writes that invalidate other things.'
        ],
        example: 'Building a 10 000-key tree: 33 239 recolourings and 5 763 rotations, about six to one.'
      },
      {
        term: 'The insert fixup',
        plain: 'Insert red, then fix red-red violations upward: recolour when the uncle is red, rotate when it is black.',
        formal: 'at most 2 rotations per insertion',
        detail: [
          'A new node is coloured red because a black one would immediately break the black-height ' +
            'rule on its own path. A red one only risks the red-red rule, which is a local, ' +
            'repairable problem.',
          'The fixup walks up while the parent is red. The red-uncle case repaints and continues; ' +
            'the black-uncle case rotates once (outer) or twice (inner) and stops.',
          'So the loop can run O(log n) times but rotates at most twice in total, which is the ' +
            'bound that matters for a structure other code holds pointers into.'
        ],
        example: 'The loop may recolour its way to the root, and still perform no more than two rotations on the way.'
      },
      {
        term: 'Deletion and double black',
        plain: 'Removing a black node leaves a path one black short. The fixup pushes that deficit up or borrows from a sibling.',
        formal: 'at most 3 rotations per deletion',
        detail: [
          'Deleting a red node changes nothing: no path loses a black.',
          'Deleting a black one does, and the standard treatment gives the child an imaginary ' +
            'extra black ("double black") that has to be discharged.',
          'The sibling decides how. If it can spare a red child, the deficit is fixed with a ' +
            'rotation and recolouring. If it cannot, the sibling is painted red and the deficit ' +
            'moves up a level.',
          'Written without a sentinel, the fixup must carry the (node, parent) pair explicitly, ' +
            'because the node being fixed can be null and a null has no parent to ask.'
        ],
        example: 'The deficit can travel to the root, where it simply disappears — the root is allowed to lose a black.'
      },
      {
        term: 'Why libraries chose it',
        plain: 'Bounded rotations per update, on both insert and delete. AVL bounds only the insert.',
        formal: 'insert ≤ 2 rotations, delete ≤ 3',
        readAs: 'However large the tree, a single insert never needs more than two rotations and a delete ' +
          'never more than three. The recolouring may travel to the root; the structural work does not.',
        detail: [
          'std::map, java.util.TreeMap, the Linux kernel scheduler and most ordered maps are ' +
            'red-black, and the reason is the write path rather than the read path.',
          'Red-black bounds the structural change per update by a constant on both operations. AVL ' +
            'bounds only insertion, and can rebalance at every level on a delete.',
          'Libraries delete.',
          'The cost is a tree up to 44% taller than AVL in the worst case, which on measured ' +
            'workloads shows up as a percent or so of extra comparisons.'
        ],
        example: 'On the same 20 000-operation stream red-black did 3 613 rotations against AVL\'s 4 434, and 0.85% more comparisons.'
      },
      {
        term: 'Left-leaning as a simplification',
        plain: 'Force every red link to lean left and the number of cases collapses — at the cost of more rotations.',
        formal: 'LLRB: red links are left children only',
        detail: [
          'Sedgewick\'s left-leaning variant adds one rule: a red link may only be a left child. ' +
            'That removes the mirror-image half of every case, and makes the code short enough to ' +
            'fit on a slide.',
          'It encodes 2-3 trees rather than 2-3-4 trees, which is why the implementation is ' +
            'symmetric and small.',
          'The trade is real. The extra rule has to be maintained, so LLRB performs more rotations ' +
            'than the classical form, and the deletion code is famously harder to follow despite ' +
            'the simpler insertion.',
          'Standard libraries kept the classical version.'
        ],
        example: 'LLRB insertion is about twenty lines; its deletion is not, which is why the classical form survives in libraries.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
