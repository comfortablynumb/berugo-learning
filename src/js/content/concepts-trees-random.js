/** Concepts for treaps, splay trees and scapegoat trees (M04.4-M04.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    treaps: [
      {
        term: 'Two orders at once',
        plain: 'A search tree by key and a heap by a random priority, in the same nodes.',
        formal: 'key order left-to-right, priority order top-to-bottom',
        detail: 'Each node carries a key and a priority. The keys obey the search-tree invariant and ' +
          'the priorities obey the heap invariant, and the surprising part is that both can always ' +
          'be satisfied at once. Better than that, they can be satisfied in exactly one way: for a ' +
          'given set of (key, priority) pairs there is a unique treap. That uniqueness is the whole ' +
          'design, because it means the shape is a function of the data rather than of the history — ' +
          'and if the priorities are random, the shape is the shape a random insertion order would ' +
          'have produced.',
        example: 'Insert the same 1 000 keys sorted, shuffled and reversed with one seed: all three give height 23 with 623 at the root.'
      },
      {
        term: 'The priority must come from the key',
        plain: 'Draw priorities from a sequence and the shape depends on insertion order again — the one thing a treap is for.',
        formal: 'priority = h(key, seed), not rng.next() at insert time',
        detail: 'It is tempting to call the random generator when a node is created, and it quietly ' +
          'breaks the guarantee: the i-th node inserted gets the i-th draw, so the same key set ' +
          'inserted in a different order gets different priorities and a different tree. Deriving ' +
          'the priority by hashing the key with a per-structure seed fixes it — the priority is a ' +
          'property of the key, so the tree is a property of the key set. This platform made exactly ' +
          'that mistake first, and the demo that claims "three orders, one shape" is what caught it.',
        example: 'With sequence-drawn priorities, sorted and reverse insertion of the same keys produced roots 987 and 14; with key-derived priorities, both give 623.'
      },
      {
        term: 'Split',
        plain: 'Cut the treap into everything below a key and everything at or above it, in O(log n).',
        formal: 'split(t, k) → (L, R), both valid treaps',
        detail: 'Split walks one root-to-leaf path. At each node it decides which side the node ' +
          'belongs to, keeps that side, and recurses into the child that still straddles the cut. ' +
          'Both halves come out as valid treaps with no repair needed, because the heap order within ' +
          'each half was already there. The cost is the path length, so O(log n) expected, and it is ' +
          'the reason a treap gives you range operations that a plain balanced tree makes you build ' +
          'by hand.',
        example: 'Splitting a 1 000-key treap at 500 touched 13 nodes and wrote 24 pointers.'
      },
      {
        term: 'Merge',
        plain: 'Join two treaps when every key in one is below every key in the other. The higher priority wins each root.',
        formal: 'merge(L, R) with max(L) < min(R)',
        detail: 'Merge is the inverse of split and just as short: compare the two roots, take whichever ' +
          'has the higher priority as the new root, and recursively merge the remaining piece into ' +
          'the appropriate child. The precondition matters — every key on the left must be below ' +
          'every key on the right — and it is what makes merge cheap: no interleaving is needed, ' +
          'just a walk down the boundary between the two. Insert, delete and range extraction are ' +
          'all two or three lines once split and merge exist.',
        example: 'Deletion is one merge: remove the node and merge its two subtrees, which are already split around it.'
      },
      {
        term: 'Expected height',
        plain: 'About 3·log₂ n, with no balance bookkeeping of any kind.',
        formal: 'E[height] ≈ 4.311·ln n, the random-BST result',
        detail: 'The height of a treap is the height of a BST built by inserting the keys in a random ' +
          'order, because that is exactly what the random priorities encode. So the expected height ' +
          'is the classic 4.311·ln n ≈ 3·log₂ n, and the distribution is tight: measured over 40 ' +
          'seeds at n = 1 000 the mean height is 22.4 and no seed exceeded 26, against a perfectly ' +
          'balanced 10. That is worse than AVL and it costs nothing to maintain — no heights, no ' +
          'colours, no sizes, no rebalancing code at all.',
        example: 'Over 40 seeds at n = 1 000: mean height 22.4, worst 26, against 3·log₂ n = 29.9.'
      },
      {
        term: 'Randomised, not average-case',
        plain: 'The randomness is yours, not the input\'s, so the bound holds for every key set.',
        formal: 'expectation over the seed, for any fixed input',
        detail: 'This is the same distinction M01.4 draws between an average-case bound and a ' +
          'randomised algorithm. A plain BST has a good average case over random insertion orders, ' +
          'and an adversary who supplies sorted keys defeats it. A treap makes its own randomness, ' +
          'so there is no input that is bad for it — only an unlucky seed, and the seed is not ' +
          'something an attacker can see. The guarantee is in expectation rather than worst case, ' +
          'but it is an expectation nobody else gets to choose.',
        example: 'Sorted input, the case that turns a plain BST into a 1 000-node list, produces exactly the same treap as shuffled input.'
      },
      {
        term: 'Range extraction',
        plain: 'Two splits lift an arbitrary key range out as its own treap; one merge puts the rest back.',
        formal: 'split at lo, split the remainder at hi',
        detail: 'Because split and merge are cheap and total, whole ranges become first-class ' +
          'objects: extract [lo, hi] with two splits, do whatever you like to that treap, and merge ' +
          'it back — or somewhere else. That is the operation an ordered array cannot do without ' +
          'moving elements and a balanced tree cannot do without special-purpose code. It is also ' +
          'the basis of the implicit treap, where the "key" is a position rather than a value, which ' +
          'gives you a rope: split a document, insert text, merge it back, all in logarithmic time.',
        example: 'Extracting keys 100 through 199 from a 1 000-key treap leaves 900 behind and costs two path walks.'
      },
      {
        term: 'What you give up',
        plain: 'The bound is expected, not worst case, and every node carries a priority.',
        formal: 'O(log n) expected; O(n) possible but vanishingly unlikely',
        detail: 'A treap can in principle be a spine — it just requires the priorities to arrive in ' +
          'sorted order, which for n = 1 000 has probability 1/1000!. That is not a risk anyone needs ' +
          'to manage, but it does mean a treap cannot be used where a hard worst-case bound is ' +
          'required, such as a real-time system. The concrete costs are more mundane: a priority ' +
          'field per node, and a tree meaningfully deeper than AVL — 22 against 14 at a thousand ' +
          'keys — which is the price of writing eighty lines instead of three hundred.',
        example: 'Recursion in split and merge is bounded by the height, which is the O(log n) the structure exists to provide.'
      }
    ],

    'splay-trees': [
      {
        term: 'Splaying',
        plain: 'Every access rotates the touched node to the root, in pairs rather than one step at a time.',
        formal: 'zig · zig-zig · zig-zag',
        detail: 'The operation is not "rotate the node up until it is the root" — that version, ' +
          'move-to-root, also puts the node on top and has no amortised bound at all. Splaying looks ' +
          'at two levels: if the node and its parent lean the same way it rotates the *parent* first ' +
          'and then the node, and if they lean opposite ways it rotates the node twice. That ' +
          'difference halves the depth of every node on the access path instead of merely shifting ' +
          'them, which is what the potential argument needs.',
        example: 'A 2 000-key tree under a skewed workload does about 33 000 zig-zigs and 30 000 zig-zags per 20 000 accesses.'
      },
      {
        term: 'The three cases',
        plain: 'zig when the node is a child of the root; zig-zig on the same side; zig-zag on opposite sides.',
        formal: 'zig ends the splay; the other two repeat',
        detail: 'zig is the terminating case and happens at most once per splay, when only one level ' +
          'is left. zig-zig is the case that does the real work: rotating the grandparent-parent pair ' +
          'first pulls the whole path up rather than pivoting around the node. zig-zag is the ' +
          'symmetric case and behaves like a double rotation in AVL. Counting them separately is ' +
          'worth doing because their proportions tell you about the access pattern: a sequential ' +
          'scan produces mostly zig-zigs, and a scattered one produces a mix.',
        example: 'Higher skew means shorter paths, so both pair counts fall: at skew 2.0 the same run does 8 331 zig-zigs against 57 726 at skew 0.6.'
      },
      {
        term: 'The potential argument',
        plain: 'Φ = Σ log(subtree size). A splay that costs a lot must have discharged a lot of potential.',
        formal: 'amortised cost = actual + ΔΦ = O(log n)',
        detail: 'The analysis is the potential method from M01.3, with the potential defined as the ' +
          'sum over nodes of the log of the subtree size. A deep access is expensive in real work, ' +
          'but it also flattens the path it walked, which lowers Φ by roughly as much — so the ' +
          'amortised cost comes out O(log n) even though a single access can cost O(n). The choice ' +
          'of Φ is the whole proof, and it is why splay trees are the standard illustration of the ' +
          'potential method rather than of any particular data-structure idea.',
        example: 'One access can cost n comparisons; the next accesses on that path are correspondingly cheap.'
      },
      {
        term: 'The working-set property',
        plain: 'Accessing a key costs O(log of how many distinct keys were touched since it was last accessed).',
        formal: 'cost = O(log t(x)), t = distinct keys touched since',
        detail: 'This is the property no balanced tree has, and it is stronger than "hot keys are ' +
          'near the root". It says the cost depends on the recent access history rather than on the ' +
          'size of the tree: a working set of 50 keys inside a million-key tree is served at the ' +
          'cost of a 50-key tree, and it adapts as the working set moves. That is why splay trees ' +
          'behave like a cache with no cache-management code, and why the measured advantage grows ' +
          'so sharply with skew.',
        example: 'At Zipf skew 2.0 the tree answers in 2.77 comparisons per access, against a balanced tree at 11.60.'
      },
      {
        term: 'Static optimality',
        plain: 'On a fixed access distribution, splaying is within a constant factor of the best possible static tree.',
        formal: 'O(Σ pᵢ log(1/pᵢ)) — the entropy bound',
        detail: 'If you knew the access probabilities in advance you could build the optimal static ' +
          'search tree by dynamic programming, and its cost is the entropy of the distribution. A ' +
          'splay tree achieves that within a constant factor without being told the probabilities, ' +
          'and without storing any statistics. The dynamic-optimality conjecture asks the much harder ' +
          'question — whether splaying is within a constant factor of the best possible *dynamic* ' +
          'strategy for any sequence — and it has been open since 1985.',
        example: 'A uniform distribution has maximum entropy, which is exactly where splaying has nothing to gain.'
      },
      {
        term: 'The crossover',
        plain: 'On a flat access pattern splaying loses. The advantage only appears once the traffic concentrates.',
        formal: 'measured crossover between Zipf skew 0.8 and 1.0',
        detail: 'Splaying is not free: every access rotates, which is work a balanced tree does not ' +
          'do. On a uniform pattern that work buys nothing, and the measured cost is a quarter higher ' +
          'than AVL. As the distribution skews, the hot keys rise and the cost falls, crossing the ' +
          'balanced tree between skew 0.8 and 1.0 and reaching a quarter of it by skew 2.0. Quoting ' +
          'the win without stating the skew is the classic overclaim; the crossover is the honest ' +
          'summary.',
        example: 'skew 0.6: splay costs 1.26× AVL. skew 1.2: 0.71×. skew 2.0: 0.24×.'
      },
      {
        term: 'A read is a write',
        plain: 'Splaying restructures on lookup, which rules the tree out of anything shared or read-only.',
        formal: 'find() mutates the tree',
        detail: 'This is the property that decides most real adoption questions, and no amortised ' +
          'bound can compensate for it. Two threads reading the same splay tree both want to ' +
          'restructure it, so every read needs the write lock and the structure cannot be made ' +
          'lock-free. A memory-mapped or read-only page cannot be splayed at all. Even ' +
          'single-threaded it interacts badly with copy-on-write and with any cache that assumed ' +
          'reads were pure. It is also why measured throughput can disappoint despite excellent ' +
          'comparison counts.',
        example: 'The demo does about 6.8 rotations per read — every one a write to a tree another thread may be reading.'
      },
      {
        term: 'No metadata at all',
        plain: 'No heights, no colours, no sizes, no priorities. A node is a key, a value and two pointers.',
        formal: 'the smallest node of any family here',
        detail: 'Splay trees store nothing beyond the tree itself, which makes them the cheapest ' +
          'family per node and the shortest to implement correctly — the entire structure is one ' +
          'splay function and the operations built on it. Deletion, in particular, is unusually ' +
          'pleasant: splay the target to the root, drop it, splay the largest key of the left ' +
          'subtree to that subtree\'s root, and hang the right subtree off it, with no comparisons ' +
          'and no case analysis.',
        example: 'Deletion needs no case analysis: splay, drop, splay the predecessor, attach.'
      }
    ],

    'scapegoat-trees': [
      {
        term: 'Balance without metadata',
        plain: 'Nothing is stored on a node. Balance is two rules about the tree as a whole.',
        formal: 'node = { key, value, left, right }',
        detail: 'Every other family here pays for balance in per-node storage: a height, a colour ' +
          'bit, a priority, a subtree size. A scapegoat tree pays nothing. It keeps two counters for ' +
          'the entire structure — the live count and the high-water mark — and derives everything ' +
          'else by walking the tree when it needs to. That matters when a node is large, when it ' +
          'lives on disk and every header byte costs, or when the node layout is fixed by something ' +
          'else and there is nowhere to put a colour bit.',
        example: 'The same 10 000 keys need one height field per node in AVL and nothing at all here.'
      },
      {
        term: 'The α parameter',
        plain: 'A node is α-weight-balanced when neither child holds more than α of its subtree. α sets everything else.',
        formal: '½ < α < 1; depth limit = log_{1/α}(n)',
        detail: 'α is the single dial. It defines what counts as too lopsided, and through that it ' +
          'defines the depth limit an insertion is allowed to reach before triggering a repair — ' +
          'which is why a stricter α gives a shallower tree and more rebuilding. The relationship is ' +
          'not subtle: at n = 10 000, α = 0.55 caps the depth at 16 and rebuilds 40.3 nodes per ' +
          'insertion, while α = 0.9 caps it at 88 and rebuilds 7.5. Both are amortised O(log n); the ' +
          'constant is yours to choose.',
        example: 'α = 0.65 gives a depth limit of 22 at 10 000 keys and rebuilds 18.7 nodes per insertion.'
      },
      {
        term: 'The scapegoat',
        plain: 'The lowest ancestor of a too-deep insertion whose subtree is more than α-heavy on one side.',
        formal: 'size(child) > α · size(node)',
        detail: 'When an insertion lands deeper than the limit, the tree walks back up from the new ' +
          'node computing subtree sizes, and stops at the first node that fails the weight test. ' +
          'That node is the scapegoat, and its whole subtree is rebuilt perfectly balanced. The ' +
          'search is affordable for a specific reason: as it walks up it already knows the size of ' +
          'the side it came from, so it only has to measure the sibling — and the siblings near the ' +
          'bottom are the small ones. Choosing the *lowest* such node keeps the rebuild small.',
        example: 'A sorted insertion at α = 0.65 finds a scapegoat on 8 584 of 10 000 insertions, and still averages 18.7 nodes rebuilt.'
      },
      {
        term: 'The rebuild',
        plain: 'Flatten the subtree in order, then rebuild it perfectly balanced. One linear pass each way.',
        formal: 'in-order to array, then recursive midpoint',
        detail: 'A rebuild is two walks: flatten the subtree into a sorted array by in-order ' +
          'traversal, then rebuild by taking the midpoint as the root and recursing on the halves. ' +
          'Both are linear in the subtree size and neither allocates a node — the same nodes are ' +
          'relinked. This is where the structure earns its keep on disk: a rebuild writes one ' +
          'contiguous run of nodes, which is a sequential write, while rotations scatter small ' +
          'writes across the structure.',
        example: 'The rebuilt subtree comes out at exactly ⌈log₂(size + 1)⌉ deep, which buys the maximum headroom.'
      },
      {
        term: 'Deletion by decay',
        plain: 'Deletions never rebuild a subtree. The tree is allowed to thin out, then rebuilt whole.',
        formal: 'rebuild everything when live count < α · high-water mark',
        detail: 'Deletion is the plain BST algorithm with no repair at all. The tree is permitted to ' +
          'become sparse, and only when the live count drops below α times the largest it has ever ' +
          'been does the whole thing get rebuilt — once, in a single linear pass, resetting the ' +
          'high-water mark. Deleting half of a 10 000-key tree triggers exactly one such rebuild, of ' +
          '6 499 nodes, at the moment the count crosses 6 500. It is the crudest deletion strategy ' +
          'in this milestone and its amortised cost is still O(log n).',
        example: 'Deleting 5 000 of 10 000 keys at α = 0.65: exactly one whole-tree rebuild, of 6 499 nodes.'
      },
      {
        term: 'Amortised, and what that hides',
        plain: 'O(log n) per operation on average over a sequence; a single insertion can rebuild the entire tree.',
        formal: 'amortised O(log n), worst case O(n)',
        detail: 'The credit argument is the one from M01.3: each insertion below the limit banks ' +
          'enough credit that when a rebuild finally happens, the imbalance that triggered it has ' +
          'already been paid for. The measured amortised figure tracks log n closely — 18.7 nodes ' +
          'rebuilt per insertion against log₂ 10 000 = 13.3. What it hides is the tail: the ' +
          'insertion that rebuilds the root subtree touches everything, so a latency-sensitive path ' +
          'sees a spike that no average can describe. That is the same objection M01.3 raises ' +
          'against amortised bounds generally.',
        example: 'The amortised cost is 18.7 nodes per insert; the worst single insert rebuilds the whole tree.'
      },
      {
        term: 'The input still matters',
        plain: 'Sorted insertion triggers a rebuild almost every time; shuffled insertion almost never does.',
        formal: 'the depth limit is only reached when the tree is lopsided',
        detail: 'Unlike AVL or red-black, whose work is roughly input-independent, a scapegoat tree ' +
          'only does work when the input is making it lopsided. Sorted insertion at α = 0.65 finds a ' +
          'scapegoat 8 584 times and rebuilds 18.7 nodes per insertion; the same keys shuffled find ' +
          'one 439 times and rebuild 0.21 nodes per insertion — a factor of ninety. Both end at ' +
          'height 22. So the structure is nearly free on friendly input and pays only for the ' +
          'disorder it is actually handed.',
        example: 'Sorted: 8 584 rebuilds and 18.7 nodes per insert. Shuffled: 439 rebuilds and 0.21 nodes per insert.'
      },
      {
        term: 'Weight-balanced trees',
        plain: 'The same balance-by-size idea, maintained with rotations and a stored subtree size instead of rebuilds.',
        formal: 'BB[α] trees: rotate when the weight ratio is exceeded',
        detail: 'Weight-balanced trees use the same α-weight condition but store the subtree size on ' +
          'each node and repair with rotations, giving worst-case O(log n) per operation rather than ' +
          'amortised. The stored size is not wasted — it is the order-statistic augmentation from ' +
          'M04.8, so rank and select come free. The trade against scapegoat is exactly the usual ' +
          'one: pay a field per node and a little work on every operation, or pay nothing until a ' +
          'rebuild is unavoidable and then pay a lot at once.',
        example: 'Haskell\'s Data.Map and several functional libraries are weight-balanced, which is why they offer index lookup.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
