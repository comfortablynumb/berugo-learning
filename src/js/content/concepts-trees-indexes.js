/** Concepts for B-trees and augmented trees (M04.7-M04.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'b-trees': [
      {
        term: 'The node is a page',
        plain: 'A B-tree node is one unit of I/O, so the branching factor is decided by the storage rather than chosen.',
        formal: 'order = ⌊(page + key) / (key + pointer)⌋',
        detail: 'This is the sentence the whole family follows from. A read from disk or from a page ' +
          'cache costs the same whether you use one byte of the page or all of it, so the node is ' +
          'sized to the page and filled with as many children as fit. Each child costs a pointer and ' +
          'all but one costs a separator key, which gives the formula directly: a 4 KB page with ' +
          '8-byte keys and 8-byte pointers holds 256 children. Change the page size or the key size ' +
          'and the order changes with it — it was never a tuning knob.',
        example: 'A 4 KB page holds 256 children; a 512-byte sector holds 32; a 16 KB InnoDB page holds 1 024.'
      },
      {
        term: 'Height from the branching factor',
        plain: 'log_B(n) rather than log₂ n, which is why a million keys sit three levels deep.',
        formal: 'height = ⌈log_B(n)⌉',
        detail: 'Raising the branching factor from 2 to 256 divides the height by log₂ 256 = 8, and ' +
          'since every level is a separate I/O that is the entire performance argument. A million ' +
          'keys in a binary tree is 20 levels and 20 page reads; the same keys in a 256-way B+ tree ' +
          'is 3. Note how flat the return is beyond that: going from a 4 KB page to a 16 KB page ' +
          'quadruples the order and often does not remove a single level, because the height only ' +
          'falls with the log of the ratio.',
        example: 'A million keys: 3 page reads at a 4 KB page, 5 at a 512-byte page, 3 again at 16 KB.'
      },
      {
        term: 'B+ against B',
        plain: 'A B+ tree keeps every value in a leaf and only separators above, and chains the leaves.',
        formal: 'internal nodes hold keys, leaves hold key-value pairs and a next pointer',
        detail: 'A plain B-tree stores values alongside keys at every level, so an internal node ' +
          'holds fewer children for the same page — and a range scan has to walk back up and down ' +
          'the tree. The B+ variant moves every value to the leaves, which makes internal nodes pure ' +
          'index and therefore wider, and links the leaves into a list. Both changes serve the same ' +
          'workload: a database that answers "give me the rows between these two keys" reads one ' +
          'descent and then walks a linked list of pages.',
        example: 'Scanning 10 000 consecutive keys costs 81 page reads: 3 for the descent, 78 leaf pages, and nothing else.'
      },
      {
        term: 'Split and promote',
        plain: 'A full page splits in half; a leaf copies its separator up, an internal node moves it up.',
        formal: 'leaf: copy the first key of the right half · internal: promote the median',
        detail: 'When a page overflows it splits into two half-full pages and the parent gains a ' +
          'separator. The two cases differ in one detail that matters: a leaf split *copies* the ' +
          'first key of the right half upward, because that key is data and has to stay in a leaf, ' +
          'while an internal split *moves* its median up, because a separator is not data and does ' +
          'not need to exist twice. Getting that backwards produces a tree that answers correctly ' +
          'and slowly loses keys on deletion.',
        example: 'The root gains a level only when the split reaches it — which is the only way a B-tree grows.'
      },
      {
        term: 'Fill factor',
        plain: 'Pages are not full. Sequential insertion leaves them about half full; random insertion settles near ln 2.',
        formal: 'measured fill: 0.502 sequential, 0.686 random',
        detail: 'Every split leaves two half-full pages, and whether they fill up again depends ' +
          'entirely on the insertion order. A sequential load always inserts at the right edge, so ' +
          'the left half of every split is never touched again and the tree settles at about 50%. ' +
          'Random insertion refills the halves and converges on ln 2 ≈ 69.3% — the classic result, ' +
          'measured here at 68.6%. That difference is worth an entire level of the tree, which is ' +
          'why the honest read prediction uses order × fill rather than order.',
        example: 'A million keys loaded sequentially onto 512-byte pages costs 5 reads per lookup; log_B(n) predicts 4.'
      },
      {
        term: 'Bulk loading',
        plain: 'Build the leaves full from sorted input and construct the levels above them, instead of inserting one at a time.',
        formal: 'sort, fill leaves to capacity, build the index bottom-up',
        detail: 'Since a sequential insert load is exactly the case that leaves pages half full, a ' +
          'database that knows it is loading sorted data does not insert at all. It fills each leaf ' +
          'to whatever fill factor was asked for, links them, and builds the internal levels ' +
          'upwards — one pass, no splits, no rebalancing, and a tree that is as short and as dense as ' +
          'the fill factor allows. The fill factor is left below 100% deliberately, so later ' +
          'insertions have somewhere to go without splitting immediately.',
        example: 'This is what CREATE INDEX does, and why building an index is far faster than inserting the same rows.'
      },
      {
        term: 'The range scan',
        plain: 'One descent, then the leaf chain. No internal page is read twice, and the cost is per page rather than per row.',
        formal: 'reads = height + ⌈rows / rows-per-leaf⌉',
        detail: 'This is the operation B+ trees are shaped for and the reason they beat hash indexes ' +
          'for anything ordered. Descend once to the first key, then follow the leaf pointers: no ' +
          'internal page is touched again and each page read yields a whole leaf-full of rows. The ' +
          'measured shape is exactly the formula — 10 rows cost 3 reads, all descent; 10 000 rows ' +
          'cost 81, almost all leaf. The corollary matters more: fetching those same 10 000 rows by ' +
          'a separate index lookup each costs 30 000 reads.',
        example: 'Scanning 10 keys costs 3 reads, 1 000 costs 10 and 10 000 costs 81 — the descent is paid once.'
      },
      {
        term: 'Prefix compression and key size',
        plain: 'Keys occupy the page, so shrinking them raises the order and can remove a level.',
        formal: 'order = (page + key)/(key + pointer): the key is in both terms',
        detail: 'Because the key appears in both the numerator and the denominator of the order, key ' +
          'size has a direct and non-obvious effect on the height of the whole index. Going from ' +
          '8-byte to 64-byte keys on a 4 KB page drops the order from 256 to 57, which is a level at ' +
          'a million keys — an extra I/O on every lookup, from the choice of a wider key type. This ' +
          'is why real implementations compress: prefix compression stores each separator as its ' +
          'difference from the previous one, and suffix truncation keeps only enough of a separator ' +
          'to distinguish the two children.',
        example: 'Switching from an 8-byte integer key to a 64-byte string key adds a whole level of I/O per lookup.'
      }
    ],

    'augmented-trees': [
      {
        term: 'The augmentation rule',
        plain: 'A field can be maintained if and only if it is computable from the node and the same field on its two children.',
        formal: 'field(node) = f(node, field(left), field(right))',
        detail: 'This one sentence is the entire theory, and it is a decision procedure rather than a ' +
          'guideline. If the rule holds, a rotation can repair the field in constant time by ' +
          'recomputing the two nodes that moved, so every operation keeps its O(log n) cost. If it ' +
          'does not, repairing after a rotation means walking a subtree and the structure degrades ' +
          'to linear. Before designing an augmentation, ask the question in that exact form: "can I ' +
          'compute this from my own value and my two children\'s values?" Subtree size, sum, min, ' +
          'max and height all pass; median and distinct-count both fail.',
        example: 'Subtree size passes: 1 + size(left) + size(right). Subtree median fails: the median of a union is not a function of the two medians.'
      },
      {
        term: 'Maintaining it through a rotation',
        plain: 'Recompute the node that moved down first, then the node that moved up. The order is not optional.',
        formal: 'augment(lower) then augment(upper)',
        detail: 'A rotation changes the children of exactly two nodes, so exactly two fields need ' +
          'recomputing — but the node that ends up on top reads its children, one of which is the ' +
          'node that ended up below. Recompute the upper one first and it reads a stale value from ' +
          'the lower one, producing a field that is wrong in a way nothing else notices: queries ' +
          'return plausible answers that are quietly incorrect. This is the single most common bug ' +
          'in augmented trees, and the reason the platform\'s invariant checker recomputes every ' +
          'field from the children and compares.',
        example: 'A stale size makes select(k) return the wrong key while the tree remains a perfectly valid search tree.'
      },
      {
        term: 'Order-statistic trees',
        plain: 'Store the subtree size and the tree answers "the k-th smallest" and "how many are below this" in one descent.',
        formal: 'select(k) and rank(key), both O(log n)',
        detail: 'With sizes on hand, select descends by comparison rather than by counting: if the ' +
          'left subtree holds L keys then the k-th smallest is in the left subtree when k ≤ L, is ' +
          'this node when k = L + 1, and is the (k − L − 1)-th of the right subtree otherwise. Rank ' +
          'is the mirror image, accumulating left sizes as it goes. Both are a single root-to-leaf ' +
          'walk — 13 node visits at 100 000 keys — where a sorted array gives select for free and ' +
          'cannot support insertion, and a plain tree supports insertion and needs a full scan to ' +
          'count.',
        example: 'select(50 000) on a 100 000-key tree visits 13 nodes; a scan would visit 50 000.'
      },
      {
        term: 'Interval trees',
        plain: 'Store the maximum endpoint in each subtree and a stabbing query can skip whole subtrees.',
        formal: 'maxEnd(node) = max(node.end, maxEnd(left), maxEnd(right))',
        detail: 'Intervals are keyed by their start, which makes the tree ordered but not obviously ' +
          'useful — an interval containing a point can start anywhere below it. The maximum-endpoint ' +
          'field fixes that: if a subtree\'s maxEnd is below the query point, no interval in it can ' +
          'contain the point, and the whole subtree is skipped without being visited. That single ' +
          'test turns a scan into a search. The pruning is what the demo counts, and it is the ' +
          'difference between visiting 22 nodes and scanning 18 211.',
        example: 'Stabbing a point in 18 211 intervals visits 22 nodes and prunes 6 whole subtrees.'
      },
      {
        term: 'Range-sum trees',
        plain: 'Store the subtree sum and a range query adds whole subtrees instead of walking them.',
        formal: 'sum(node) = value + sum(left) + sum(right)',
        detail: 'The field alone is not enough — the query has to use it. A range sum that visits ' +
          'every node between the bounds is correct and pointless, costing O(range) and making the ' +
          'augmentation decorative. The version that pays off carries the bounds down the recursion: ' +
          'when a subtree lies entirely inside the range, its stored sum is added and the descent ' +
          'stops there; when it lies entirely outside, it is dropped. Only the two boundary paths ' +
          'are walked, which is O(log n) regardless of how many keys the range holds.',
        example: 'Summing 1 001 keys visits 51 nodes with pruning and 1 020 without — same answer, twenty times the work.'
      },
      {
        term: 'Composability',
        plain: 'Several fields can be maintained at once, because each one only depends on itself.',
        formal: 'augment(node) recomputes every configured field',
        detail: 'Because the rule is per-field, adding a second augmentation costs nothing but the ' +
          'storage and the recomputation: one tree can carry size, sum and max-endpoint together and ' +
          'answer all three families of query. That is why the demo can offer three structures on ' +
          'one tree rather than three trees. The practical limit is memory and cache: every extra ' +
          'field makes the node bigger, and a node that no longer fits in a cache line costs more on ' +
          'every traversal than the query saves.',
        example: 'One tree here carries all three fields, so rank, stabbing and range sums are answered from the same nodes.'
      },
      {
        term: 'The fields that cannot be augmented',
        plain: 'Anything needing more than the node and its two children — a median, a distinct count, a k-th value.',
        formal: 'the rule fails ⇒ repair after a rotation is not O(1)',
        detail: 'The instructive failures are the ones that look plausible. A subtree median cannot ' +
          'be computed from two child medians, because the answer depends on how the two ' +
          'distributions interleave. A distinct-value count cannot be computed from two child counts, ' +
          'because the children may share values and neither one knows. The useful move when a field ' +
          'fails the rule is to look for a different field that passes and answers the same question ' +
          'by descent: a median is not augmentable, and size is — and select(n/2) is the median.',
        example: 'The median fails the rule, so an order-statistic tree computes it as select(⌈n/2⌉) instead.'
      },
      {
        term: 'Where the balance comes from',
        plain: 'Augmentation is orthogonal to the balance rule: it works on AVL, red-black, treaps or weight-balanced trees alike.',
        formal: 'any family whose rotations are local',
        detail: 'Nothing in the augmentation depends on how the tree stays balanced — only on the ' +
          'fact that its structural changes are rotations touching two nodes. So the field can be ' +
          'bolted onto whichever family you already use, which is why std::map cannot do rank ' +
          'queries and Haskell\'s Data.Map can: the latter is weight-balanced and therefore already ' +
          'stores the subtree size the balance rule needs. The augmentation was free because the ' +
          'balance rule had already paid for it.',
        example: 'A weight-balanced tree stores subtree sizes for its balance rule, so it gets rank and select for nothing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
