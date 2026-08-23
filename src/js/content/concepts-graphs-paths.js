/** Concepts for connectivity and the two shortest-path sections (M13.4-M13.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bridges-and-cuts': [
      {
        term: 'A bridge is an edge whose loss disconnects something',
        plain: 'Remove it and the number of connected components goes up.',
        formal: 'e is a bridge iff components(G − e) > components(G); equivalently, e is on no cycle',
        readAs: 'An edge is a bridge exactly when removing it breaks the graph into more pieces — which is ' +
          'the same as saying it lies on no cycle, because a cycle would provide a way round.',
        detail: 'The cycle characterisation is the one to hold on to, because it says immediately what ' +
          'the fix is: an edge on no cycle has no alternative route, and adding any second route ' +
          'removes it from the list. That is what redundancy purchases, and it is why the answer to ' +
          '"this link is a single point of failure" is always another link rather than a bigger one. ' +
          'The definition by removal is also a perfectly good oracle at small sizes, and this section ' +
          'checks every claim against it.',
        example: 'A barbell of 40 nodes has exactly one bridge — the link joining the two halves — and ' +
          'a path of 40 has 39.'
      },
      {
        term: 'An articulation point is the same idea one dimension up',
        plain: 'A vertex whose removal disconnects the graph.',
        formal: 'v is a cut vertex iff components(G − v) > components(G); the root of the DFS tree iff it has >1 child',
        detail: 'Edge redundancy and vertex redundancy are different purchases and the demo shows the ' +
          'difference directly: adding a second link across the bridge in a barbell removes the bridge ' +
          'and leaves both articulation points exactly where they were, because the endpoints of that ' +
          'link are still the only way through. Surviving any one *cable* cut and surviving any one ' +
          '*router* failure are different requirements with different price tags, and conflating them ' +
          'is how a redundancy budget gets spent on the wrong thing.',
        example: 'One redundant link takes the barbell from 1 bridge to 0 and leaves its 2 articulation ' +
          'points untouched.'
      },
      {
        term: 'Lowlink: the earliest ancestor a subtree can still reach',
        plain: 'One number per vertex decides both questions.',
        formal: 'low[v] = min(disc[v], disc of ancestors reached by back edges, low of children)',
        readAs: 'The earliest-discovered vertex reachable from v\'s subtree without using the edge that ' +
          'entered it. Comparing that against the parent\'s discovery number is the whole bridge test.',
        detail: 'A depth-first walk numbers vertices as it discovers them, and `low[v]` records the ' +
          'smallest discovery number the subtree rooted at v can reach using tree edges and at most ' +
          'one back edge. The tree edge (u, v) is a bridge exactly when `low[v] > disc[u]` — the ' +
          'subtree below v has no other way out — and u is a cut vertex when some child satisfies ' +
          '`low[child] >= disc[u]`, the difference between the two comparisons being whether reaching ' +
          'u itself counts as escaping. Both fall out of one traversal, which is why this is a linear ' +
          'algorithm rather than an m-fold repetition of a connectivity check.',
        example: 'Both the bridge list and the cut-vertex list come from one walk of the 40-node ' +
          'network, and both match the removal oracle.'
      },
      {
        term: 'Tracking the parent vertex is the classic bug',
        plain: 'Skip the edge you came in on by its id, not by which vertex it led to.',
        formal: 'a second parallel edge to the parent is a genuine escape route; skipping by vertex hides it',
        detail: 'This is the reason the section exists. An undirected walk meets its own incoming edge ' +
          'again from the other end and has to ignore that sighting; the tempting test — "is this ' +
          'neighbour the vertex I came from?" — also ignores every *other* edge to that vertex, and ' +
          'another edge to that vertex is exactly what stops the first one being a bridge. The result ' +
          'is a bridge reported where none exists, on every multigraph, silently. Three lines of ' +
          'difference, and it only shows up on inputs with redundant links, which are precisely the ' +
          'inputs a network engineer cares about.',
        example: 'On three nodes with 0 and 1 doubled, the edge-id version reports only 1–2 and the ' +
          'vertex version reports 0–1 as well.'
      },
      {
        term: 'Biconnected components are the regions with no internal weak point',
        plain: 'Maximal chunks in which no single vertex removal disconnects anything.',
        formal: 'equivalence classes of edges under "lie on a common simple cycle"; blocks meet only at cut vertices',
        detail: 'Blocks are what makes the analysis actionable rather than merely alarming. A list of ' +
          'cut vertices says where the graph is fragile; the block decomposition says what each one ' +
          'costs, because it names the regions that fall apart when a given cut vertex goes. Note that ' +
          'the classes are of *edges*, not vertices — a cut vertex belongs to every block it joins, ' +
          'which is precisely what makes it a cut vertex.',
        example: 'The default barbell decomposes into 3 blocks: the two cliques and the bridge between ' +
          'them, which is a block of one edge.'
      },
      {
        term: 'A block of a single edge is a bridge',
        plain: 'The two ideas are the same thing seen from two directions.',
        formal: 'a biconnected component with exactly one edge has no cycle through it, which is the bridge condition',
        detail: 'Noticing this saves writing the second algorithm. Bridges are not a separate ' +
          'computation bolted onto biconnectivity; they are its degenerate case, and an implementation ' +
          'that produces the block decomposition already has them. It also gives a free consistency ' +
          'check that is worth keeping in tests: the number of single-edge blocks must equal the number ' +
          'of bridges, and if it does not, one of the two lowlink comparisons is wrong.',
        example: 'The barbell reports 1 bridge and 3 blocks, one of which is the single bridge edge.'
      },
      {
        term: 'The block-cut tree is a tree, and that is checkable',
        plain: 'Blocks and cut vertices as nodes, membership as edges — the result is always a forest.',
        formal: 'nodes = blocks + cut vertices; edges = memberships; nodes − components = edges',
        readAs: 'The block-cut tree has one node per biconnected block and one per cut vertex, joined by ' +
          'membership. The last equation is just the statement that it is a forest.',
        detail: 'The block-cut tree is the structure that answers "if this vertex fails, what is ' +
          'stranded and how much of it" — you delete the cut vertex from the tree and read off the ' +
          'pieces. It is always a forest, which is a theorem, and this milestone\'s habit is to verify ' +
          'such theorems by counting rather than to assume them: a broken decomposition produces a ' +
          'block-cut structure with a cycle in it, and no other check in the pipeline would notice.',
        example: '3 blocks plus 2 cut vertices give 5 nodes and 4 edges, and the forest identity is ' +
          'checked rather than quoted.'
      },
      {
        term: 'A grid has no single point of failure and a path is nothing else',
        plain: 'The generator you test on decides whether you ever see the interesting case.',
        formal: 'grid: 0 bridges, 0 cut vertices. Path: n − 1 bridges, n − 2 cut vertices',
        detail: 'Random graphs at any reasonable density have almost no bridges, so a bridge finder ' +
          'tested only on random inputs is tested on the case where the answer is empty. The shape ' +
          'selector exists for that reason: a path is 100% bridges and 95% cut vertices, a star is ' +
          'every edge a bridge, a grid is none of either, and a barbell is the one interesting bridge ' +
          'surrounded by dense noise. Choosing generators that make the answer non-trivial is as much ' +
          'a part of testing as choosing assertions.',
        example: 'A 40-node path reports 39 bridges and 38 cut vertices; a grid of the same size ' +
          'reports none of either.'
      }
    ],

    'shortest-paths-basics': [
      {
        term: 'Relaxation is the whole of shortest paths',
        plain: 'If going through u is cheaper than what I have, take it.',
        formal: 'if d[u] + w(u, v) < d[v] then d[v] = d[u] + w(u, v), parent[v] = u',
        readAs: 'Relaxation, the single operation behind every shortest-path algorithm here: if going via u ' +
          'is cheaper than the best route to v found so far, take it and remember where you came from.',
        detail: 'Every algorithm in this milestone is the same three lines wrapped in a different rule ' +
          'about *when* to apply them. Dijkstra relaxes out of the closest unsettled vertex, ' +
          'Bellman-Ford relaxes everything n − 1 times, DAG shortest paths relax in topological order, ' +
          'A* changes the queue key and nothing else. Seeing that clearly is what makes the family ' +
          'learnable: the differences are entirely in the ordering strategy, and each strategy comes ' +
          'with a precondition that licenses it.',
        example: 'Dijkstra performs 3 480 relaxations on the 900-cell grid — one per directed edge — ' +
          'and Bellman-Ford performs 20 880 doing the same job in 6 rounds.'
      },
      {
        term: 'Dijkstra’s invariant, and exactly what it needs',
        plain: 'The closest unsettled vertex is finished, because no cheaper route can exist.',
        formal: 'settling u is sound iff every edge weight is >= 0; a negative edge can lower a total after the fact',
        readAs: 'Dijkstra declares a vertex final the moment it pops. That is only safe if no edge can reduce ' +
          'a total later — which is exactly what a negative weight does.',
        detail: 'The greedy step is justified by an argument that mentions non-negativity exactly once ' +
          'and depends on it completely: any other route to the closest unsettled vertex has to pass ' +
          'through some vertex that is at least as far away, and with non-negative edges it cannot get ' +
          'cheaper from there. Introduce one negative edge and that sentence is false — and the ' +
          'algorithm does not notice, because nothing in the loop tests it. It simply settles a vertex ' +
          'too early and returns a plausible number.',
        example: 'The demo\'s four-vertex counter-example returns d[3] = 3 where the truth is 2, with ' +
          'no error raised.'
      },
      {
        term: 'The negative-edge counter-example has to propagate',
        plain: 'A tiny example gets the right answer by luck and demonstrates nothing.',
        formal: 'the vertex whose distance is later lowered must have an outgoing edge that was already relaxed',
        detail: 'A lazy implementation still writes the improved distance into the array when the ' +
          'negative edge is finally relaxed, so the vertex directly at the end of that edge often ends ' +
          'up correct. The error only becomes visible one hop further on, at a vertex whose distance ' +
          'was computed from the stale value and never revisited. Building a counter-example therefore ' +
          'takes care, and the section\'s is deliberately arranged so that d[1] comes out right and ' +
          'd[3] comes out wrong — which is exactly why this failure survives casual testing.',
        example: 'Four vertices: 0→1 costs 2, 0→2 costs 3, 2→1 costs −2, 1→3 costs 1. d[1] ends correct ' +
          'at 1 and d[3] ends wrong at 3.'
      },
      {
        term: 'A lazy heap trades duplicates for handles',
        plain: 'Push a new entry instead of decreasing a key, and skip stale entries on the way out.',
        formal: 'heap holds up to m entries rather than n; a pop whose key exceeds d[v] is discarded',
        detail: 'Decrease-key needs a handle per vertex and a heap that can find and sift an arbitrary ' +
          'element, which is real code and real memory. The lazy alternative pushes a fresh entry on ' +
          'every improvement and discards entries that are no longer current when they surface. It ' +
          'costs extra pops and a slightly larger heap, and on sparse graphs it is almost always the ' +
          'better trade — but the stale count should be *reported*, because it is the number that says ' +
          'when the trade has stopped paying.',
        example: 'On the 900-cell grid the heap holds 1 153 entries for 900 vertices and discards 253 ' +
          'stale pops — 21.9% of them.'
      },
      {
        term: '0-1 BFS: a deque replaces the heap entirely',
        plain: 'Zero-weight edges go to the front, one-weight edges to the back.',
        formal: 'with weights in {0, 1} the frontier holds at most two distinct distances; Θ(n + m), no comparisons',
        readAs: 'When every edge costs 0 or 1, the queue only ever holds two distance values at once, so a ' +
          'deque replaces the heap: push 0-edges on the front, 1-edges on the back. No priority queue ' +
          'and no log factor.',
        detail: 'When every edge costs 0 or 1 the queue only ever contains two distance values, so a ' +
          'deque keeps it sorted for free and no comparison is ever needed. This is worth recognising ' +
          'because the shape appears constantly in disguise: toggling a state, entering or leaving a ' +
          'region, a move that is free versus a move that is not. Recognising it turns an O(m log n) ' +
          'search into a linear one, and the same idea generalises to small integer weights as a dial ' +
          'queue.',
        example: 'On the same grid re-weighted to 0 and 1, the deque makes 0 comparisons where Dijkstra ' +
          'makes 1 142, for the identical 900 distances.'
      },
      {
        term: 'Path reconstruction is a parent array, and it must be checked',
        plain: 'Store who improved you, then walk backwards — and re-add the weights.',
        formal: 'cost of the reconstructed path must equal the reported distance, edge by edge',
        detail: 'A distance array with no path is half an answer, and a path that disagrees with the ' +
          'distance is worse than either. Keeping a parent pointer costs one array and one assignment ' +
          'inside the relaxation, and re-walking the returned path to confirm its cost is a two-line ' +
          'check that catches an entire class of bug — an off-by-one in the parent update, a parent ' +
          'left stale after a later improvement, a path that silently contains a cycle. This page runs ' +
          'that check on every query.',
        example: 'The re-walked path costs exactly 181, matching the distance the search reported.'
      },
      {
        term: 'Settling everything versus stopping at the target',
        plain: 'Dijkstra can stop when the target pops, and by then it has usually settled most of the graph.',
        formal: 'the settled set at the moment t pops is every vertex closer than t — a ball, not a corridor',
        readAs: 'Dijkstra explores outward in all directions equally, so by the time it reaches the target it ' +
          'has settled everything nearer than the target. For a long-distance query that is most of the ' +
          'map, and it is the cost the next section attacks.',
        detail: 'Early termination is correct and rarely dramatic, because the algorithm has no idea ' +
          'where the target is: it grows a ball of radius d(s, t) and everything inside that ball is ' +
          'settled first. On a corner-to-corner grid query that ball is the whole grid. That single ' +
          'observation is what motivates the next two sections — a heuristic deforms the ball into a ' +
          'corridor, and searching from both ends replaces one ball with two smaller ones.',
        example: 'A corner-to-corner query on the 900-cell grid settles all 900 vertices before the ' +
          'target pops.'
      },
      {
        term: 'A slower reference implementation is not waste',
        plain: 'Keep Bellman-Ford around; it is the only way to know Dijkstra is right.',
        formal: 'compare distance vectors vertex by vertex and report the disagreement count as data',
        detail: 'Shortest-path bugs do not throw. They return a well-formed array of plausible numbers, ' +
          'and there is no internal consistency check that catches a distance which is merely too ' +
          'large. The only real defence is a second implementation with a different derivation, ' +
          'compared on every vertex — and the disagreement count belongs in the output rather than in ' +
          'an assertion, because on a graph with negative edges the disagreement is the point of the ' +
          'demonstration rather than a failure.',
        example: 'Bellman-Ford, Dijkstra and SPFA all return 181 with 0 disagreements on the ' +
          'non-negative grid — and disagree loudly the moment a negative edge is added.'
      }
    ],

    'negative-weights': [
      {
        term: 'Bellman-Ford relaxes everything n − 1 times, and that is enough',
        plain: 'A shortest path has at most n − 1 edges, so n − 1 rounds settle every one of them.',
        formal: 'after round k, every vertex reachable by a shortest path of <= k edges has its final distance',
        readAs: 'Bellman-Ford makes progress by edge count rather than by distance: after k passes every ' +
          'route using at most k edges is correct. Since no shortest path uses more than n−1 edges, n−1 ' +
          'passes suffice.',
        detail: 'The proof is an induction on path length rather than on anything clever, which is why ' +
          'the algorithm needs no assumption about weights at all. Its practical form always carries ' +
          'an early exit: if a round changes nothing, no later round can either, and most graphs ' +
          'converge in far fewer than n − 1 rounds. That exit is not just an optimisation — it is what ' +
          'makes the n-th round meaningful, because a round that still improves something after ' +
          'n − 1 rounds is a proof that no shortest path exists.',
        example: 'The 900-cell grid converges in 6 rounds rather than 900, at 3 480 relaxations each.'
      },
      {
        term: 'An n-th improving round proves a negative cycle',
        plain: 'No simple path is that long, so something is going round in circles and getting cheaper.',
        formal: 'if round n still relaxes an edge, some vertex is reachable through a cycle of negative total weight',
        readAs: 'After n−1 passes everything should be settled. If a pass still improves something, the only ' +
          'explanation is a loop you can go round to keep getting cheaper — and then no shortest path ' +
          'exists at all.',
        detail: 'This is detection, and detection is the cheap half. What it gives the caller is a ' +
          'boolean they usually already suspected — the rate table is inconsistent, the cost model has ' +
          'a hole — with no indication of where. The vertex that improved on the last round is a ' +
          'starting point, not the answer, because it may be downstream of the cycle rather than in it.',
        example: 'The default rate table is proved inconsistent after 4 rounds on 4 currencies.'
      },
      {
        term: 'Extraction: walk the parents back n times before closing the loop',
        plain: 'Follow parent pointers n steps to land inside the cycle, then walk until you repeat.',
        formal: 'n parent steps from any vertex reachable through the cycle land on a cycle vertex; then close it',
        detail: 'Skipping the n-step walk is the classic error and produces a "cycle" with a tail ' +
          'hanging off it: a path into the cycle, followed by the cycle. Since the vertex that improved ' +
          'last may be several hops downstream, only after n parent steps are you guaranteed to be ' +
          'inside the loop, at which point walking until a vertex repeats closes it exactly. The extra ' +
          'cost is one linear walk, and the difference in usefulness is the difference between "your ' +
          'rates admit arbitrage" and the list of trades to make.',
        example: 'The extracted loop is JPY → GBP → JPY, verified edge by edge against the graph, ' +
          'total −0.0070.'
      },
      {
        term: 'A rate table becomes a shortest-path problem under −log',
        plain: 'Multiplying rates around a loop becomes adding their negative logarithms.',
        formal: 'prod(rates) > 1 iff sum(−log rate) < 0; a profitable loop is exactly a negative cycle',
        readAs: 'Taking logs turns multiplying exchange rates into adding them, and negating turns "gains ' +
          'more than 1" into "sums below 0". An arbitrage cycle becomes a negative cycle, and ' +
          'Bellman-Ford finds it.',
        detail: 'The transform is the entire trick and it is worth being able to derive rather than ' +
          'remember: logarithms turn products into sums, and the negation turns "greater than one" ' +
          'into "less than zero", which is what a negative cycle is. Everything after that is ' +
          'Bellman-Ford. The only care needed is on the way back — the answer must be priced in the ' +
          'original units, both because that is the number a human acts on and because a "profit" of ' +
          '1.0000 is floating-point noise rather than an opportunity.',
        example: 'The found loop prices at a multiplier of 1.007000 — 0.70% per round trip — computed ' +
          'from the original rates rather than from the logs.'
      },
      {
        term: 'Floyd-Warshall’s loop order is not a style choice',
        plain: 'k must be the outer loop. Swap it and the answer is quietly wrong.',
        formal: 'd_k[i][j] = min(d_{k−1}[i][j], d_{k−1}[i][k] + d_{k−1}[k][j]) — the recurrence is over k',
        readAs: 'Floyd-Warshall asks, for each intermediate vertex k in turn: is going through k better than ' +
          'what I had? The outer loop is over k, not over i or j — swapping them is the classic way to ' +
          'get a subtly wrong answer.',
        detail: 'The state being built is "shortest path using intermediates drawn from {0..k}", and it ' +
          'is defined in terms of the same quantity at k − 1. Making k the outer loop is what ensures ' +
          'every cell read at level k has already been finalised at level k − 1. Put i or j outermost ' +
          'and the algorithm reads cells that have moved on to a different k — it still terminates, ' +
          'still does exactly the same number of relaxations, still returns a full matrix, and the ' +
          'matrix is not the shortest-path matrix. No timing signal, no exception, nothing.',
        example: 'On a 40-vertex graph both orders perform 64 000 relaxations; the swapped one differs ' +
          'from the truth on 554 of 1 600 cells.'
      },
      {
        term: 'Johnson: one reweighting makes Dijkstra legal',
        plain: 'Add a super-source, compute a potential, and every edge becomes non-negative.',
        formal: 'w′(u, v) = w(u, v) + h(u) − h(v) >= 0 by the triangle inequality on h; path costs shift by h(s) − h(t)',
        readAs: 'Johnson\'s reweighting adds a potential to each vertex so every edge becomes non-negative — ' +
          'w′ is read "w prime", a second related weight. Every path between the same two endpoints ' +
          'shifts by the same amount, so the ordering of paths is untouched and Dijkstra becomes ' +
          'usable.',
        detail: 'The potential h comes from one Bellman-Ford run from a super-source joined to every ' +
          'vertex at cost zero, so h(v) is at most h(u) + w(u, v) for every edge — which rearranges ' +
          'exactly into the reweighted edge being non-negative. Because the shift telescopes along any ' +
          'path, every path from s to t changes by the same h(s) − h(t), so the *shortest* path is ' +
          'unchanged and can be recovered by subtracting the shift back off. One Bellman-Ford plus n ' +
          'Dijkstras replaces n Bellman-Fords.',
        example: 'On a 40-vertex graph with 7 negative edges, Johnson costs 5 124 relaxations against ' +
          '26 520 for Bellman-Ford from every vertex and 64 000 for Floyd-Warshall.'
      },
      {
        term: 'All pairs has a memory wall before it has a time wall',
        plain: 'n² cells is the binding constraint long before n³ operations are.',
        formal: 'n = 100 000 is 10¹⁰ cells — 80 GB at 8 bytes — whatever the running time is',
        readAs: 'All-pairs output is n² numbers, and at a hundred thousand vertices that is eighty gigabytes. ' +
          'The algorithm\'s speed is irrelevant; the answer does not fit.',
        detail: 'People reach for all-pairs shortest paths and then discover the answer does not fit ' +
          'anywhere. At a hundred thousand vertices the matrix alone is tens of gigabytes, so the ' +
          'question is never "how fast can we compute it" but "do we actually need every pair". Usually ' +
          'the answer is a handful of sources, in which case n Dijkstras beat the matrix on both axes; ' +
          'sometimes it is a reachability question, in which case a bitset transitive closure is orders ' +
          'of magnitude cheaper. Route planning at scale exists because this wall is real.',
        example: 'The demo\'s 40-vertex instance is 1 600 cells for 120 edges — already more cells than ' +
          'edges, and the ratio worsens quadratically.'
      },
      {
        term: 'SPFA is Bellman-Ford with a queue and no better bound',
        plain: 'Only re-relax vertices whose distance actually changed. Fast in practice, quadratic when attacked.',
        formal: 'worst case Θ(n·m), same as Bellman-Ford; typical case far below it, with no guarantee',
        detail: 'The optimisation is obvious and correct: a vertex whose distance did not change cannot ' +
          'improve its neighbours, so keep a queue of the ones that did. On ordinary graphs this is a ' +
          'large constant-factor win. The catch is that adversarial inputs exist and are easy to ' +
          'construct, so SPFA is a good default and a bad guarantee — the same shape as quicksort ' +
          'without a randomised pivot. Where the worst case matters, the honest answer is plain ' +
          'Bellman-Ford or a queue with the small-label-first discipline and a measured bound.',
        example: 'SPFA settles 1 700 vertices on the 900-cell grid against Dijkstra\'s 900 — more work ' +
          'here, and no worse an answer.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
