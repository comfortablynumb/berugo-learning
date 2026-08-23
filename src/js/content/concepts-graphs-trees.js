/** Concepts for spanning trees and tree path queries (M13.9-M13.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'minimum-spanning-trees': [
      {
        term: 'The cut property is the correctness engine for all three algorithms',
        plain: 'Split the vertices any way you like; the lightest edge across the split is in some MST.',
        formal: 'for any cut (S, V∖S), a minimum-weight crossing edge belongs to some minimum spanning tree',
        readAs: 'Split the vertices into any two groups — V∖S is "everything not in S" — and the cheapest ' +
          'edge crossing between them is safe to take. Every MST algorithm in this section is that one ' +
          'fact applied differently.',
        detail: 'The proof is an exchange argument: take any MST, add the light crossing edge, and the ' +
          'cycle that forms must contain another crossing edge, which is no lighter — so swapping them ' +
          'gives a spanning tree of no greater weight. That single fact justifies Kruskal, Prim and ' +
          'Borůvka at once, and the only difference between them is which cut they exploit next. ' +
          'Learning it as one theorem with three applications is far less work than learning three ' +
          'algorithms, and it is what lets you invent the fourth.',
        example: 'Prim\'s tree after 20 edges is one side of a cut holding 21 nodes, and the edge it ' +
          'takes next weighs 5 — the lightest crossing it.'
      },
      {
        term: 'The cycle property is its mirror',
        plain: 'The heaviest edge on any cycle is in no minimum spanning tree.',
        formal: 'if e is the unique heaviest edge of some cycle, no MST contains e',
        readAs: 'Around any cycle, the single heaviest edge can always be dropped: the rest of the cycle ' +
          'already connects its ends more cheaply. "Unique" matters — with a tie, either edge may be in ' +
          'some optimal tree.',
        detail: 'Where the cut property says which edges to take, the cycle property says which to ' +
          'discard, and together they are why every faint edge on the demo\'s map is faint: each one is ' +
          'the heaviest edge of some cycle. The cycle property is also what makes the second-best ' +
          'spanning tree a one-edge change rather than a fresh search — remove any tree edge, and the ' +
          'best replacement is the lightest edge that reconnects the two halves.',
        example: 'The default 60-node graph keeps 59 of 180 links; the other 121 are each the heaviest ' +
          'edge on some cycle.'
      },
      {
        term: 'Kruskal sorts, Prim grows, Borůvka does everything at once',
        plain: 'Global lightest joining edge; lightest edge leaving one tree; every component picking simultaneously.',
        formal: 'Kruskal Θ(m log m) dominated by the sort; Prim Θ(m log n) with a heap; Borůvka Θ(m log n) in <= log₂n rounds',
        readAs: 'Three algorithms with effectively the same bound, arrived at differently: Kruskal pays for a ' +
          'sort, Prim for heap operations, and Borůvka halves the component count each round so it ' +
          'finishes in log₂ n of them.',
        detail: 'The three differ in which cut they apply the property to, and therefore in where their ' +
          'cost lives. Kruskal\'s is the sort, paid whether or not the edges get used. Prim\'s is the ' +
          'heap, and in the lazy form it pushes an entry per edge examined, so it degrades as the graph ' +
          'fills in. Borůvka scans every edge once per round and halves the component count each time, ' +
          'so its round count barely moves — and because each component decides independently, it is ' +
          'the one that parallelises, which is why it is the basis of the distributed and GPU ' +
          'implementations.',
        example: 'On the same 60-node graph the three cost 1 666, 2 280 and 1 170 units, and Borůvka ' +
          'finishes in 3 rounds.'
      },
      {
        term: 'They agree on weight, not on the tree',
        plain: 'With duplicate weights, the three return three different edge sets of identical cost.',
        formal: 'the MST is unique if all weights are distinct; equal weights admit several optimal trees',
        detail: 'This is the difference between a test that means something and a test that fails every ' +
          'time somebody touches a comparator. The invariant the algorithms actually guarantee is the ' +
          'total weight and the spanning property; the particular edge set is decided by tie-breaks ' +
          'nobody specified. Real network costs are round numbers — hop counts, tiers, latencies ' +
          'rounded to the millisecond — so duplicates are the normal case rather than a corner one, ' +
          'and asserting a particular tree is asserting the tie-break.',
        example: 'Weights from 1 to 3: all 20 instances agree on weight and 0 of 20 agree on the edge ' +
          'set. Effectively distinct weights: 20 of 20 agree on both.'
      },
      {
        term: 'The minimax path is the maximum edge on the MST path',
        plain: 'Minimising the worst hop is answered for free by a structure you built for something else.',
        formal: 'for all u, v: min over paths of max edge = max edge on the u–v path in any MST',
        readAs: 'The bottleneck between two vertices — the smallest possible worst edge on a route between ' +
          'them — is exactly the heaviest edge on the path joining them in the minimum spanning tree. ' +
          'One tree answers the question for every pair.',
        detail: 'The connection is the most useful thing in this section and almost nobody makes it. ' +
          '"Minimise the total cost" and "minimise the worst link on the route" are different ' +
          'questions with different answers, and the second one — which is what network design, ' +
          'maximum-capacity routing, widest-path and single-linkage clustering all ask — is answered by ' +
          'walking the MST. People routinely implement a bespoke binary search over weight thresholds ' +
          'to compute something their existing spanning tree already knows.',
        example: '198 random pairs, 0 disagreements against a threshold oracle — and on 136 of them the ' +
          'cheapest route has a worse worst hop than the minimax route does.'
      },
      {
        term: 'Shortest and minimax are genuinely different questions',
        plain: 'The cheapest route often contains a worse single link than the best-worst-link route.',
        formal: 'argmin over paths of sum(w) ≠ argmin over paths of max(w), in general',
        readAs: 'The path with the smallest total is usually not the path with the smallest worst edge. ' +
          '"argmin" is "the path that minimises this", and the two questions genuinely have different ' +
          'answers.',
        detail: 'It is easy to assume the two coincide, and on small examples they often do, which is ' +
          'exactly why the demo counts how often they do not. If the quantity you care about is the ' +
          'weakest link — a video call limited by its worst hop, a supply chain limited by its ' +
          'narrowest road, a cluster linkage limited by its largest gap — then summing weights answers ' +
          'a question you did not ask. The two computations differ by one line and the results differ ' +
          'on most pairs.',
        example: 'Pair 8 → 45: the minimax hop is 5, while the cheapest route costs 18 and contains a ' +
          'hop of 9.'
      },
      {
        term: 'The second-best spanning tree differs by exactly one edge',
        plain: 'Remove each tree edge, take the best replacement, keep the cheapest swap.',
        formal: 'a consequence of the cycle property; the search is over the n − 1 tree edges, not over all trees',
        detail: 'Knowing this turns "find the runner-up" from a search over exponentially many spanning ' +
          'trees into a scan over the tree you already have. It also gives a free uniqueness test: if ' +
          'the best swap costs nothing, then a second tree of equal weight exists and the MST was never ' +
          'unique — which is a more honest way of discovering that than reading the weights and ' +
          'guessing. The same one-edge-swap structure underlies sensitivity analysis: how much can this ' +
          'link\'s cost rise before the answer changes?',
        example: 'With duplicate-heavy weights the runner-up ties the winner at 270; with distinct ' +
          'weights it is strictly worse and one edge different.'
      },
      {
        term: 'The ranking changes with density, which is why all three survive',
        plain: 'Kruskal pays for the sort, lazy Prim pays per edge examined, Borůvka pays per round.',
        formal: 'sparse favours Kruskal and Prim; dense favours Borůvka, whose round count is nearly constant',
        detail: 'A single "which is fastest" answer would be a sign that two of these algorithms should ' +
          'have been deleted decades ago, and the reason all three are still taught is that their cost ' +
          'curves cross. Kruskal sorts every edge whether or not it is used, so it loses when the graph ' +
          'is dense and the tree is small. The lazy Prim here pushes a heap entry per edge examined, ' +
          'which is the same problem with a different constant. Borůvka does log₂n scans and each round ' +
          'at least halves the component count, so it wins as density grows.',
        example: 'At 60 edges the costs are 425 / 426 / 619 and at 900 they are 10 576 / 15 840 / 8 428 ' +
          '— the ranking inverts.'
      },
      {
        term: 'Verify the forest, not the weight alone',
        plain: 'Check that the result is acyclic and connects everything the graph connects.',
        formal: 'union-find over the chosen edges must never reject one, and must end with the graph’s own components',
        detail: 'A weight that matches a reference implementation is strong evidence and not a proof: ' +
          'two implementations sharing a mistake produce two matching wrong numbers. The structural ' +
          'check is cheap and independent — feed the chosen edges through a union-find and assert that ' +
          'no edge closes a cycle, then assert that the resulting components match the graph\'s. On a ' +
          'disconnected graph the answer is a spanning *forest*, and an implementation that reports ' +
          'n − 1 edges on such a graph is wrong regardless of its weight.',
        example: 'All three algorithms return 59 edges on a connected 60-node graph, and each result is ' +
          'checked acyclic and spanning rather than assumed.'
      }
    ],

    'tree-path-queries': [
      {
        term: 'Rooting a tree turns every path question into an ancestor question',
        plain: 'Pick a root; the path between two nodes is up to their lowest common ancestor and down again.',
        formal: 'dist(a, b) = depth(a) + depth(b) − 2·depth(lca(a, b))',
        readAs: 'The distance between two nodes is how far each is from the root, less twice the depth of ' +
          'their lowest common ancestor — because the shared stretch from the root down to that ' +
          'ancestor is counted in both and travelled in neither.',
        detail: 'A tree has no distinguished vertex until you choose one, and choosing one is what makes ' +
          'the rest of this section possible: parent, depth and subtree size all become well defined, ' +
          'and every path decomposes at a single vertex. The distance formula falls straight out, and ' +
          'so does path reconstruction, path aggregation and the observation that any query over a path ' +
          'is two queries over root-to-node chains. Root iteratively, not recursively — a tree of ' +
          'depth n is a stack overflow waiting to happen.',
        example: 'A 200-node random tree has depth 13, so every query is at most 26 pointer steps by ' +
          'the naive method.'
      },
      {
        term: 'The naive climb is the oracle, and often the right answer as well',
        plain: 'Lift the deeper node to the shallower one, then step both up together.',
        formal: 'Θ(depth) per query and Θ(1) preprocessing; correct by construction',
        readAs: 'Walking up from both nodes until they meet needs no preprocessing at all and costs the depth ' +
          'per query. On a shallow tree that beats every cleverer structure.',
        detail: 'Keep it for two reasons. It is the only implementation of the four that cannot be ' +
          'subtly wrong, so it is what everything else gets checked against — and a check against a ' +
          'slow obvious version is worth more than any number of self-consistency assertions. And on ' +
          'the shallow trees that most real hierarchies are, it is genuinely competitive: file systems, ' +
          'org charts, category trees and DOM subtrees have depths in the dozens, and dozens of pointer ' +
          'hops is not a bottleneck.',
        example: '2 400 queries across five tree shapes, with binary lifting, the sparse table, k-th ' +
          'ancestor and the chain decomposition all checked against it — 0 disagreements.'
      },
      {
        term: 'Binary lifting stores the 2^k-th ancestor',
        plain: 'Every ancestor distance is a sum of powers of two, so any jump is at most log n hops.',
        formal: 'up[k][v] = up[k−1][up[k−1][v]]; n log n cells, Θ(log n) per query',
        readAs: 'The ancestor 2^k levels above v is the ancestor 2^(k−1) levels above the ancestor 2^(k−1) ' +
          'levels above v. Doubling like that lets any jump be assembled from powers of two, in log n ' +
          'steps.',
        detail: 'The table is built by squaring: the 2^k-th ancestor is the 2^(k−1)-th ancestor of the ' +
          '2^(k−1)-th ancestor. Answering LCA then has two phases — level the two nodes using the ' +
          'binary representation of their depth difference, then jump both upward by the largest power ' +
          'that keeps them apart, which deliberately stops one step below the answer. The reason to ' +
          'choose it over the faster sparse table is generality: it answers *k-th ancestor*, and the ' +
          'sparse table answers nothing but LCA.',
        example: 'On a 200-node tree the table is 1 800 cells across 9 levels, and a typical query is ' +
          'four jumps.'
      },
      {
        term: 'The descent stops one step short on purpose',
        plain: 'Jump both nodes up only while they stay apart; the answer is then the parent.',
        formal: 'if up[k][x] ≠ up[k][y] the ancestor is still above, so jump; afterwards lca = up[0][x]',
        readAs: 'Jump both nodes upward by the largest power of two that still leaves them under different ' +
          'ancestors. When no such jump remains, their parents are the answer.',
        detail: 'Testing "have we reached the ancestor?" directly would require knowing the answer, so ' +
          'the algorithm tests the opposite: two nodes whose 2^k-th ancestors differ are certainly still ' +
          'below their common ancestor, so that jump is safe. Descending through the powers of two from ' +
          'large to small leaves both nodes exactly one step below the LCA, and one final parent step ' +
          'finishes it. That inversion — comparing rather than searching — is what makes the query ' +
          'logarithmic instead of a scan.',
        example: 'The traced query jumps 2 to level the depths, then 2 and 1 while the nodes stay ' +
          'apart, then takes one final parent step.'
      },
      {
        term: 'The Euler tour turns LCA into a range minimum',
        plain: 'Walk the tree recording every visit; the shallowest node between two appearances is their ancestor.',
        formal: 'lca(a, b) = the minimum-depth entry of the tour between first[a] and first[b]; a sparse table answers it in Θ(1)',
        readAs: 'Write down the tree as a walk that visits each node on the way in and on the way back. The ' +
          'shallowest node between the two first appearances is their common ancestor — so an ancestor ' +
          'question becomes a range-minimum question.',
        detail: 'The tour visits a node again every time the walk returns to it, so the segment between ' +
          'two nodes\' first appearances contains exactly the vertices on the path between them plus ' +
          'their subtrees — and the shallowest of those is the common ancestor. A sparse table over the ' +
          'tour depths answers any range minimum in constant time after Θ(n log n) preprocessing, which ' +
          'is the fastest of the four per query. It is also the least general: the table knows nothing ' +
          'except the minimum depth in a range.',
        example: 'A 200-node tree gives a 399-entry tour and a 3 591-cell table, and each query is one ' +
          'lookup.'
      },
      {
        term: 'Heavy-light: continue each chain through the largest child',
        plain: 'One heavy edge per node; every other child starts a new chain.',
        formal: 'heavy(v) = argmax over children of subtree size; the chains partition the vertices',
        readAs: 'From each node, follow the child with the biggest subtree. Those paths split the tree into ' +
          'chains with no vertex in two of them, which is what lets a path query become a handful of ' +
          'array ranges.',
        detail: 'The decomposition lays the tree out as a set of paths, each of which is a contiguous ' +
          'range in one array — so a segment tree, a Fenwick tree or any range structure applies ' +
          'directly. That is what makes it the general answer to "range query over a tree path": sum ' +
          'the weights on this route, find the maximum, add five to every edge between here and there. ' +
          'Nothing simpler does those, and the whole construction is one pass for subtree sizes and one ' +
          'pass to lay out the chains.',
        example: 'A 1 000-node random tree decomposes into 505 chains; a path decomposes into 1.'
      },
      {
        term: 'Every light edge halves the subtree, which is the whole bound',
        plain: 'A light child holds less than half its parent’s subtree, so you cross at most log n of them.',
        formal: 'a root-to-leaf path crosses <= log₂n light edges; a path between two nodes crosses <= 2 log₂n',
        readAs: 'Every time you step off a heavy chain the subtree at least halves, so you can only do it ' +
          'log₂ n times. That bound is why heavy-light decomposition is logarithmic rather than linear.',
        detail: 'The counting argument is worth being able to state, because it is the reason the ' +
          'technique works and it is one sentence: if a child were not the heaviest, its subtree is at ' +
          'most half its parent\'s, so crossing a light edge at least halves the region you are in and ' +
          'you can do that at most log₂n times. The factor of two in the path bound comes from the ' +
          'path climbing to the common ancestor and descending again, which is the part people ' +
          'misquote.',
        example: 'At n = 1 000 the bound is about 20, and the worst measured decomposition over 400 ' +
          'queries is 14 on a caterpillar and 15 on a complete binary tree.'
      },
      {
        term: 'Which structure is cheapest depends on the shape, not on the theory',
        plain: 'On a shallow tree binary lifting costs more than the naive climb it replaces.',
        formal: 'naive is Θ(depth); lifting is Θ(log n) with a large constant and n log n cells of preprocessing',
        readAs: 'Binary lifting has the better bound and a worse constant, plus a table to build. On a ' +
          'shallow tree the naive climb wins outright, which is why the choice is about shape rather ' +
          'than about the bounds.',
        detail: 'Complexity tables compare log n against depth and quietly assume depth is n, which is ' +
          'the worst case and almost never the case. On a random 200-node tree the depth is 13 and the ' +
          'naive climb averages eight steps, while binary lifting averages nine jumps and needs 1 800 ' +
          'cells to do it — the structure is slower *and* larger. On a path of the same size the same ' +
          'comparison inverts by a factor of nineteen. Shape is the variable that decides, and it is ' +
          'the one the asymptotics hide.',
        example: 'On a 200-node random tree, 200 queries cost 1 630 naive steps against 1 916 lifting ' +
          'jumps; on a path of 200 they cost 11 783 against 621.'
      },
      {
        term: 'Verify the segments cover the path, not merely that there are few of them',
        plain: 'Compare the union of the returned ranges against the actual vertices on the path.',
        formal: 'the set of positions covered by the segments must equal the set of positions of the path’s vertices',
        detail: 'A decomposition that returns a plausible number of ranges is not a decomposition that ' +
          'returns the right ranges, and an off-by-one at a chain boundary produces a segment list that ' +
          'is the correct length and covers the wrong vertices — after which every aggregate computed ' +
          'over it is wrong by an amount nobody can see. The check is to expand the ranges into a set ' +
          'of positions and compare it with the path walked naively. It is quadratic and belongs in a ' +
          'test, at test sizes, exactly like every other oracle in this milestone.',
        example: '2 400 queries over five shapes, each one\'s segment union compared against the naive ' +
          'walk — 0 mismatches.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
