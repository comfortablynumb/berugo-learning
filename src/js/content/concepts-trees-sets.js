/** Concepts for skip lists and disjoint set union (M04.9-M04.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'skip-lists': [
      {
        term: 'Probabilistic levels',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["insert a node at level 1"] --> B{"flip a coin"}',
            '    B -->|heads| C["promote it one level<br/>and flip again"]',
            '    C --> B',
            '    B -->|tails| D["stop"]',
            '    D --> E["tall towers are rare,<br/>short ones are common —<br/>the shape of a balanced tree,<br/>with no balancing code"]'
          ].join('\n'),
          caption: 'Nothing here rebalances and nothing rotates. The distribution of tower heights does the work that an AVL tree does with rotations.'
        },
        plain: 'Each node is promoted to the next level with probability p, so tower heights are geometric.',
        formal: 'P(height = k) = p^(k−1)(1 − p)',
        readAs: 'The chance a node gets exactly k levels: it has to win the coin k−1 times running, at ' +
          'probability p each, and then lose once. That is the geometric distribution, and it is the ' +
          'whole of how a skip list decides its shape.',
        detail: 'There is no balance rule and no restructuring: when a node is inserted it flips a ' +
          'coin repeatedly, and the number of heads decides how many express lanes it joins. The ' +
          'resulting height distribution is geometric, which is what makes the analysis work — about ' +
          'half the nodes stop at level one when p = 0.5, half of the remainder reach level two, and ' +
          'the counts fall by a factor of p per level. Measured over 100 000 keys at p = 0.5, the ' +
          'levels hold 49 921, 25 176, 12 451 and 6 240 towers, which is that distribution to within ' +
          'a fraction of a percent.',
        example: 'At p = 0.5 over 100 000 keys the level counts are 49 921, 25 176, 12 451, 6 240 — halving each time.'
      },
      {
        term: 'The search',
        plain: 'Walk forward while the next key is smaller, drop a level when it is not, and finish on the bottom lane.',
        formal: 'expected O(log n)',
        detail: 'The search is a staircase. Start at the top-left, move right while the next node ' +
          'still undershoots the target, and drop when it would overshoot; repeat until the bottom ' +
          'lane, where the next node is either the target or proof that it is absent. The express ' +
          'lanes cover the distance and the bottom lane finishes the job. Nothing is rebalanced and ' +
          'nothing is rotated — the shape came from the coins at insertion time and never changes.',
        example: 'The last node before the target on each level is the update vector, and it is exactly what insert and delete need.'
      },
      {
        term: 'What p really trades',
        plain: 'Not speed — memory. Smaller p means fewer levels and more steps along each, so the search cost is nearly flat.',
        formal: 'cost ≈ L/p + 1/(1 − p), L = log_{1/p}(n)',
        readAs: 'A search costs about the number of levels divided by p, plus a term for the walking done ' +
          'within each level. The level count L is log of n taken to base 1/p.',
        detail: 'The intuitive reading of p is that a smaller value means fewer levels and therefore ' +
          'a faster search, and the intuition is wrong because it only looks at one of the two ' +
          'factors. Fewer levels means each level covers more ground, so more forward steps are ' +
          'taken on each. Multiply them out and the total barely moves: measured at 100 000 keys, ' +
          'p = 0.5 costs 30.9 comparisons per search and p = 0.25 costs 32.1. What does move is ' +
          'memory — the expected tower height is exactly 1/(1 − p), so p = 0.25 stores a third fewer ' +
          'pointers.',
        example: 'p = 0.5 costs 30.9 comparisons and 2.00 pointers per node; p = 0.25 costs 32.1 and 1.33.'
      },
      {
        term: 'Expected tower height',
        plain: '1/(1 − p) pointers per node — the memory the structure costs, exactly.',
        formal: 'E[height] = Σ k·p^(k−1)(1 − p) = 1/(1 − p)',
        readAs: 'Average the height over the coin flips — each possible height k, weighted by how likely it ' +
          'is — and the sum collapses to 1/(1 − p). At p = 0.5 that is 2 levels per node on average.',
        detail: 'The geometric distribution has a mean of 1/(1 − p), which is the number of forward ' +
          'pointers an average node carries and therefore the memory overhead per key. Measured over ' +
          '100 000 keys the figures land on the prediction to three decimals: 1.999 at p = 0.5 and ' +
          '1.333 at p = 0.25. That is the number to compare against a balanced tree, which stores ' +
          'two child pointers plus whatever balance metadata its family needs — so a skip list at ' +
          'p = 0.25 is genuinely cheaper per key than a red-black tree, and at p = 0.5 it is about ' +
          'the same.',
        example: 'Measured: 1.999 pointers per node at p = 0.5 and 1.333 at p = 0.25, against the predicted 2.000 and 1.333.'
      },
      {
        term: 'The optimum nobody uses',
        plain: 'The search cost is minimised at p = 1/e ≈ 0.368, and implementations use 0.25 anyway.',
        formal: 'argmin over p of L/p',
        readAs: '"argmin" means the value of p that makes this smallest, not the smallest value itself. ' +
          'Minimising search cost gives p around 1/e, about 0.37 — and everyone uses 0.5 anyway, ' +
          'because halving is one bit test.',
        detail: 'Differentiating the search cost gives an optimum at p = 1/e, and the curve around it ' +
          'is so flat that the difference from p = 0.25 or p = 0.5 is a couple of percent — well ' +
          'inside the noise of any real workload. Since the memory term is not flat at all, ' +
          'implementations optimise the thing that varies: Redis and LevelDB both use 0.25. It is a ' +
          'nice example of a theoretical optimum that is correct, uncontested and irrelevant to the ' +
          'engineering decision.',
        example: 'Redis and LevelDB use p = 0.25 rather than the search-optimal 1/e, because memory is what actually differs.'
      },
      {
        term: 'Deterministic skip lists',
        plain: 'Promote every 1/p-th insertion instead of flipping a coin. The variance disappears and so does the tall-tower risk.',
        formal: 'the 1-2-3 skip list, equivalent to a 2-3 tree',
        detail: 'The randomness buys independence from the input, and it costs variance: an unlucky ' +
          'run of coin flips can build a tower far taller than the level count needs, and the search ' +
          'cost has a tail. The deterministic variant promotes on a fixed schedule instead, which ' +
          'makes the structure exactly equivalent to a balanced 2-3 tree — worst-case O(log n) ' +
          'rather than expected, and no seed at all. What it gives up is the property that made skip ' +
          'lists attractive: with a fixed schedule the shape depends on insertion order again.',
        example: 'A 1-2-3 skip list is a 2-3 tree with the levels drawn horizontally instead of vertically.'
      },
      {
        term: 'Why concurrency, not speed',
        plain: 'An insert writes one pointer per level and restructures nothing, so it can be a compare-and-swap per level.',
        formal: 'lock-free insert = one CAS per level',
        detail: 'This is the reason LevelDB and Redis chose skip lists, and it is not a performance ' +
          'argument in the usual sense — a balanced tree is comparable or better single-threaded. It ' +
          'is that a skip-list insertion only ever splices a node into a few linked lists, and a ' +
          'splice is a single pointer write that a compare-and-swap can make atomic. A balanced tree ' +
          'has to rotate, which moves several nodes at once and cannot be made atomic without ' +
          'locking a subtree. Reads need no synchronisation at all.',
        example: 'A concurrent skip list needs no locks for readers and one CAS per level for a writer.'
      },
      {
        term: 'Against a balanced tree',
        plain: 'More comparisons, comparable memory, far simpler code, and no rebalancing to get wrong.',
        formal: 'expected O(log n) against worst-case O(log n)',
        detail: 'On raw comparison count a skip list loses: 30.9 comparisons per search against 15.7 ' +
          'for an AVL tree over the same 100 000 keys, because the express lanes are a coarser ' +
          'index than a tree\'s branching. Against that it is a fraction of the code, has no ' +
          'rotation cases to get wrong, gives range scans for free from the bottom lane, and ' +
          'parallelises. The bound is expected rather than worst-case, which for a probabilistic ' +
          'structure with independent coins is a distinction without a practical difference.',
        example: 'The same 100 000 keys: 30.9 comparisons per skip-list search against 15.7 in an AVL tree.'
      }
    ],

    'disjoint-sets': [
      {
        term: 'The structure',
        plain: 'One array of parent pointers. Each set is a tree; the root is the set\'s name.',
        formal: 'parent[i] = i means i is a root',
        detail: 'There is no ordering, no searching and no balance rule — the entire structure is an ' +
          'array where each element points at another element, and following the pointers reaches a ' +
          'root that names the set. Two elements are in the same set exactly when they reach the ' +
          'same root. That is why it is so fast: the operations are pointer walks over an array, ' +
          'with no allocation, no comparison of keys and no restructuring beyond changing one ' +
          'parent. It also means it answers only one question, and any richer query needs a ' +
          'different structure.',
        example: 'find(x) walks to the root; union(x, y) points one root at the other. That is the whole API.'
      },
      {
        term: 'Union by rank',
        diagram: {
          definition: [
            'flowchart LR',
            '    A{"which tree is taller?"} --> B["attach the shorter one<br/>under the taller one"]',
            '    B --> C["the height does not change"]',
            '    A -->|equal heights| D["attach either, and the<br/>height grows by exactly one"]',
            '    D --> E["so reaching height h needs<br/>at least 2^h elements"]'
          ].join('\n'),
          caption: 'Attaching the taller tree under the shorter one is the same union and grows the height every time. The rule costs one integer per root and bounds the height at log n on its own.'
        },
        plain: 'Attach the shorter tree under the taller one, so the height only grows when two equal trees meet.',
        formal: 'rank is an upper bound on height; it increments only on a tie',
        detail: 'Left alone, unions can build a chain: attach each new element under the last and the ' +
          'forest becomes a linked list. Union by rank prevents it by always hanging the shorter ' +
          'tree under the taller, which leaves the height unchanged unless the two are equal — and ' +
          'when they are, it increases by exactly one. A tree of rank r therefore contains at least ' +
          '2^r elements, so the height is at most log₂ n. That alone, with no compression at all, ' +
          'makes every operation O(log n).',
        example: 'Union by size is the same idea with the same bound, and is easier to combine with a size query.'
      },
      {
        term: 'Path compression',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["find walks a chain:<br/>a → b → c → root"] --> B["it now knows the root"]',
            '    B --> C["so point a, b and c<br/>straight at the root"]',
            '    C --> D["the next find on any of them<br/>is a single step"]',
            '    D --> E["the work of walking is reused<br/>rather than repeated"]'
          ].join('\n'),
          caption: 'The walk had to happen anyway. Rewriting the pointers on the way back costs nothing extra and means the same walk never happens twice.'
        },
        plain: 'A find rewrites every node on the path to point straight at the root.',
        formal: 'a second pass sets parent[node] = root',
        detail: 'The insight is that a find already walked the path, so it knows the root and can ' +
          'pay a constant per node to make every future find on that path a single hop. The forest ' +
          'flattens as it is used, and the flattening is where the amortised bound comes from — with ' +
          'compression alone and no union rule, operations are already O(log n) amortised. The ' +
          'visible effect in the demo is stark: run a find on every element with compression on and ' +
          'the deepest node drops to two or three hops; run it with compression off and nothing ' +
          'moves.',
        example: 'After a find on every element: deepest node 8 hops without compression, 3 with it.'
      },
      {
        term: 'Splitting and halving',
        plain: 'One-pass variants: point each node at its grandparent, or every other node.',
        formal: 'parent[node] = parent[parent[node]] as the walk goes',
        detail: 'Full compression needs two passes — one to find the root, one to rewrite. Path ' +
          'splitting and path halving do the job in a single pass by pointing each node at its ' +
          'grandparent as they go, which halves the path length per traversal rather than ' +
          'collapsing it entirely. Both achieve the same asymptotic bound as full compression, and ' +
          'the measured difference is small and goes both ways: halving does the fewest pointer ' +
          'hops per find and the most pointer writes. Any of the three is a fine choice; none is a ' +
          'mistake.',
        example: 'Measured over 100 000 elements: full compression 1.017 hops per find, splitting 1.042, halving 0.859.'
      },
      {
        term: 'The inverse Ackermann bound',
        plain: 'Both optimisations together give O(α(n)) amortised, and α(n) is below 5 for every n anyone will run.',
        formal: 'O(m · α(n)) for m operations',
        readAs: 'The total for m operations is m multiplied by α(n), the inverse Ackermann function — a value ' +
          'that stays below 5 for any n that could be stored on any machine. It is not constant in ' +
          'theory and it is indistinguishable from constant in practice.',
        detail: 'Tarjan proved that union by rank plus path compression gives an amortised bound of ' +
          'α(n) per operation, where α is the inverse of the Ackermann function — a function that ' +
          'grows so slowly it is 4 for every n up to 2^65536. That is why "effectively constant" is ' +
          'the honest phrase and "constant" is not: the bound genuinely is not constant, and the ' +
          'difference has never mattered to anyone. Tarjan also proved a matching lower bound, so no ' +
          'pointer-based structure does better.',
        example: 'α(n) = 4 for every n up to 2^65536, which is more atoms than the observable universe holds.'
      },
      {
        term: 'Rollback needs the union-only variant',
        plain: 'Path compression rewrites parents that no union recorded, so there is nothing bounded to undo.',
        formal: 'undo needs O(1) recorded changes per union',
        detail: 'A union changes exactly one parent and one rank, so it can be journalled in constant ' +
          'space and undone exactly. A compressing find changes an unbounded number of parents that ' +
          'no union ever touched, and journalling those would cost more than the compression saves. ' +
          'So a rollback-capable DSU must use union by rank alone, accepting O(log n) per operation ' +
          'in exchange for an exact undo. This is the trap the section exists for, and the ' +
          'implementation here refuses the combination rather than being quietly wrong.',
        example: 'A union journals one parent and one rank; a compressing find rewrote four more that nothing recorded.'
      },
      {
        term: 'Offline dynamic connectivity',
        plain: 'Divide and conquer over time, using rollback to unwind each branch — which is what forces the union-only variant.',
        formal: 'segment tree over the timeline, DSU with undo at each node',
        detail: 'The canonical use for a rollback DSU is answering connectivity queries over a graph ' +
          'whose edges appear and disappear over time. Each edge is alive for an interval, the ' +
          'intervals are hung on a segment tree over the timeline, and a depth-first walk of that ' +
          'tree unions the edges on the way down and undoes them on the way up. The recursion needs ' +
          'exact rollback at every level, which is precisely why the compression has to go — and why ' +
          'people discover the incompatibility here rather than in the textbook.',
        example: 'Each edge is unioned once per segment-tree node it covers, and undone as the recursion returns.'
      },
      {
        term: 'Where it shows up',
        plain: 'Kruskal, image segmentation, type unification, and any "are these the same thing yet" question.',
        formal: 'dynamic equivalence relations',
        detail: 'Anywhere a program maintains an equivalence relation that only ever coarsens, this ' +
          'is the structure. Kruskal\'s algorithm uses it to reject edges inside a component. ' +
          'Connected-component labelling in image processing merges pixel runs. Hindley-Milner type ' +
          'inference unifies type variables with it. Compilers use it for value numbering and for ' +
          'register coalescing. The common shape is that merges are permanent and the only question ' +
          'is membership — which is exactly the API, and why nothing richer is needed.',
        example: 'Kruskal sorts the edges and uses one find per endpoint to decide whether an edge closes a cycle.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
