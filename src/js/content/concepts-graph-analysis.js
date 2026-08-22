/** Concepts for colouring, layout and spectral methods (M14.8-M14.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'graph-coloring': [
      {
        term: 'Greedy colouring is a family indexed by an ordering',
        plain: 'Take the vertices in some order; give each the lowest colour none of its coloured neighbours holds.',
        formal: 'greedy uses at most Δ + 1 colours in any order, and the ordering decides where in that range it lands',
        detail: 'The named methods in the literature are named *orderings*, not named algorithms — ' +
          'Welsh-Powell is largest-degree-first and smallest-last is degeneracy order, and the ' +
          'colouring loop underneath them is identical. This matters because it tells you where to ' +
          'spend effort: nothing about the assignment step can be improved, and everything about ' +
          'the result depends on a sort you can change in one line.',
        example: 'On one 18-vertex graph the three orderings use 5, 3 and 4 colours, and all three ' +
          'are proper colourings.'
      },
      {
        term: 'Degeneracy bounds the colour count, and it can be far below the maximum degree',
        plain: 'Repeatedly remove a minimum-degree vertex; the largest degree seen on removal is the degeneracy.',
        formal: 'greedy in the reverse of the removal order uses at most degeneracy + 1 colours',
        detail: 'The bound holds because when a vertex is coloured, only the neighbours that ' +
          'survived longer than it are already coloured, and there are at most `degeneracy` of ' +
          'them. That is a much better guarantee than Δ + 1: a star has maximum degree n − 1 and ' +
          'degeneracy 1, so degeneracy ordering gives 2 colours where the naive bound allows n. The ' +
          'degeneracy is also computable in linear time, so the bound costs almost nothing to know.',
        example: 'The default graph has degeneracy 3, so smallest-last order never needs more than ' +
          '4 colours — and the exact chromatic number is 3.'
      },
      {
        term: 'A better-sounding ordering can be worse, measurably',
        plain: 'Largest-degree-first needs four colours on a graph that is provably two-colourable.',
        formal: 'no greedy ordering is optimal on every graph; there is always an ordering that achieves the chromatic number, and finding it is NP-hard',
        detail: 'It is easy to reason that colouring the busiest vertices first must help, because ' +
          'they are the constrained ones. On a bipartite graph that reasoning produces a colouring ' +
          'twice as large as necessary, while the natural order and the degeneracy order both find ' +
          'the optimum. Since some ordering always achieves the chromatic number — colour an optimal ' +
          'colouring class by class — "find the right ordering" is exactly as hard as the original ' +
          'problem, and every heuristic ordering is a guess.',
        example: 'On the bipartite shape at 18 vertices: natural 2, degree 4, degeneracy 2, and the ' +
          'chromatic number is 2.'
      },
      {
        term: 'The largest clique is a lower bound, and interval graphs make it tight',
        plain: 'Every vertex of a clique needs its own colour, so no colouring can beat the clique number.',
        formal: 'omega(G) <= chi(G); on a perfect graph they are equal, and interval graphs are perfect',
        detail: 'On an interval graph — vertices are bookings, edges are overlaps — greedy in ' +
          'left-endpoint order uses exactly the maximum number of intervals alive at once, which is ' +
          'the clique number, which is a lower bound on any colouring. So the answer is optimal and ' +
          'the algorithm is a sweep. That is why meeting-room assignment is easy and register ' +
          'allocation is not: a program\'s interference graph stops being an interval graph the ' +
          'moment control flow branches.',
        example: 'On the default graph the largest clique is 3 and the chromatic number is 3, so ' +
          'the bound happens to be tight; on the wheel it is 3 against 4.'
      },
      {
        term: 'Clique, independent set and vertex cover are one problem with three names',
        plain: 'Complement the graph and a clique becomes an independent set; the rest of the vertices are a cover.',
        formal: 'omega(G) = alpha(complement of G), and alpha(G) + tau(G) = n',
        detail: 'One search answers all three, and the three NP-hardness results are one result. ' +
          'What does *not* transfer is approximation: a factor-2 vertex cover is not a factor-2 ' +
          'independent set, because complementing a set does not complement its ratio — vertex ' +
          'cover has a trivial 2-approximation while independent set has no constant-factor ' +
          'approximation at all unless P = NP. Knowing which of the three names your problem wears ' +
          'therefore decides what you can promise.',
        example: 'On the default graph: clique 3, independent set 8, cover 18 − 8 = 10.'
      },
      {
        term: 'Bron-Kerbosch enumerates every maximal clique, and the pivot prunes duplicates',
        plain: 'Every maximal clique either contains the pivot or excludes one of its non-neighbours, so only the non-neighbours need branching.',
        formal: 'the pivot changes the recursion tree and never the set of cliques found',
        detail: 'The saving comes from density: a pivot with many neighbours among the candidates ' +
          'excludes many branches, and on a sparse graph there is almost nothing to prune, so the ' +
          'pivot is close to pure overhead. That is a useful shape to recognise — the optimisation ' +
          'is not free and its value is a function of the input, so the honest way to present it is ' +
          'a measured ratio on a stated graph rather than a claim.',
        example: '41 recursion nodes with the pivot against 64 without, finding the same 24 maximal ' +
          'cliques — a 1.56× saving.'
      },
      {
        term: 'Register allocation is colouring with an escape hatch',
        plain: 'Push any vertex with fewer than k neighbours onto a stack; when none is left, spill the busiest survivor.',
        formal: 'Chaitin: simplify, spill, select — the spill count is the price of k being too small',
        detail: 'The thing that makes an NP-hard problem work in a production compiler is not a ' +
          'better heuristic; it is that failure has a defined cost rather than being failure. When ' +
          'the interference graph needs more colours than the machine has registers, the allocator ' +
          'writes a value to memory and tries again on a smaller graph. Almost every practical use ' +
          'of an intractable problem has that shape, and the heuristic only decides how often the ' +
          'escape hatch is taken.',
        example: 'On the default graph at 2, 3 and 4 registers the allocator spills 5, 3 and 0 of ' +
          '18 values, and never produces an invalid allocation.'
      },
      {
        term: 'Greedy never produces an improper colouring, whatever order it is given',
        plain: 'An ordering can cost you colours; it cannot cost you correctness.',
        formal: 'the assignment rule guarantees no neighbour conflict by construction',
        detail: 'This is worth stating because it tells you what to test. The conflict count is zero ' +
          'in every row of every ordering, always, so a test that asserts "the colouring is proper" ' +
          'is testing the loop rather than the ordering and will never fail for an ordering bug. The ' +
          'quantity that actually varies is the colour count, and the only way to know whether it is ' +
          'good is to compute the chromatic number exhaustively on a graph small enough to afford ' +
          'it.',
        example: 'All three orderings do 72 colour checks and report 0 conflicts; only the colour ' +
          'count differs, at 5, 3 and 4.'
      }
    ],

    'graph-layout': [
      {
        term: 'Euler\'s formula rules out planarity and never rules it in',
        plain: 'A simple planar graph on three or more vertices has at most 3V − 6 edges.',
        formal: 'V − E + F = 2, and every face has at least three edges, so 2E >= 3F',
        detail: 'The bound is a genuinely useful rejection filter — it is two integers and a ' +
          'comparison — and it is one-directional. A graph that exceeds it is certainly not planar. ' +
          'A graph below it may or may not be, and treating the check as a test is a classic error ' +
          'because the check passes on almost every sparse graph. Kuratowski\'s theorem is the real ' +
          'characterisation, and the linear-time planarity tests built on it are what a library ' +
          'actually calls.',
        example: 'K5 has 10 edges against a bound of 9, so Euler settles it; K3,3 has 9 against a ' +
          'bound of 12 and sails through.'
      },
      {
        term: 'The tighter bipartite bound is what catches K3,3',
        plain: 'A bipartite planar graph has no triangular face, so every face has at least four edges.',
        formal: '2E >= 4F gives E <= 2V − 4 for a bipartite simple planar graph',
        detail: 'Two non-planar graphs and two different arguments is the whole lesson: a counting ' +
          'bound encodes an assumption about face size, and a different graph class supports a ' +
          'different assumption. Neither bound ever proves planarity, and picking the right one ' +
          'requires knowing something about the graph beforehand. That is exactly the position ' +
          'every heuristic filter puts you in, and the reason the real test is structural.',
        example: 'K3,3 at 9 edges against 2V − 4 = 8 — caught by the bipartite bound only.'
      },
      {
        term: 'Force-directed layout minimises energy and has no idea what a crossing is',
        plain: 'Vertices repel, edges pull, and the step size cools linearly.',
        formal: 'Fruchterman-Reingold: repulsion k²/d, attraction d²/k, displacement capped by a falling temperature',
        detail: 'It is worth being precise about what the algorithm is optimising, because it is ' +
          'not what you want. There is no crossing term anywhere in the energy; the model is purely ' +
          'geometric. It lands on planar drawings of planar graphs because crossings and high ' +
          'energy tend to coincide, and "tend to" is doing real work — on a graph with any density ' +
          'the correlation weakens and the crossing count stops falling.',
        example: 'On a 5×5 grid the force model finds a drawing with 0 crossings where the circular ' +
          'layout has 70.'
      },
      {
        term: 'The energy does not fall monotonically, and the cooling schedule is why',
        plain: 'Roughly a third of the iterations increase the energy.',
        formal: 'gradient descent is monotone in the limit of infinitesimal steps; a temperature-capped finite step can overshoot',
        detail: '"It converges" is a claim about the endpoint and is routinely mistaken for a claim ' +
          'about every step. Each iteration moves every vertex by up to the current temperature in ' +
          'the direction of its net force, which can carry it past the minimum it was aiming at, and ' +
          'the resulting energy is higher than before. The cooling schedule is what makes those ' +
          'overshoots shrink to nothing — it is the reason the run *ends* somewhere sensible, not ' +
          'the reason each step improves.',
        example: 'Over 200 iterations on the default grid the energy falls from 123.67 to 4.70 and ' +
          'rises on 68 of them — 34.0%.'
      },
      {
        term: 'Layered layout assigns levels, invents vertices, then reorders',
        plain: 'Each vertex sits one level below its deepest predecessor; long edges get dummy vertices; layers are reordered by neighbour barycentre.',
        formal: 'Sugiyama: cycle removal, layer assignment, crossing reduction, coordinate assignment',
        detail: 'The dummy vertices are the part people skip and the part that matters. Without ' +
          'them a long edge is drawn straight through whatever occupies the levels in between, and ' +
          'the ordering pass has nothing to place; with them the edge becomes a chain that the ' +
          'ordering pass can route. They are also the cost: an edge spanning six levels contributes ' +
          'five dummies and five more chances to cross something.',
        example: 'On a scale-free graph of 24 vertices the layered layout inserts 48 dummy ' +
          'vertices — two per real vertex — across 9 layers.'
      },
      {
        term: 'Crossing minimisation is NP-hard even between two adjacent layers',
        plain: 'The barycentre sweep is a heuristic, and every layered engine you have used runs one.',
        formal: 'two-layer crossing minimisation is NP-hard; barycentre and median heuristics are the standard responses',
        detail: 'Knowing that the reordering step is a heuristic changes how you read a bad ' +
          'diagram: the engine is not being obtuse, it is running a cheap approximation to an ' +
          'intractable subproblem, and it will do better on a graph that gives it less to decide. ' +
          'That is why adding an explicit intermediate node to a source graph often fixes a ' +
          'generated diagram — it removes dummies, and each dummy is a decision made with almost no ' +
          'information.',
        example: 'Four barycentre sweeps, down and up, are the default; the crossing count they ' +
          'reach on the scale-free graph is 96 against the force model\'s 45.'
      },
      {
        term: 'The crossing count is the only objective measure of a drawing anyone agrees on',
        plain: 'Count the pairs of edges that share no endpoint and intersect.',
        formal: 'the denominator is m(m−1)/2 minus the adjacent pairs, so the rate is comparable across graphs',
        detail: 'Edge-length uniformity, angular resolution and symmetry all matter to a reader and ' +
          'none of them has an agreed definition. The crossing count does, it is cheap to compute, ' +
          'and it turns "this diagram is unreadable" into a number that a different layout can be ' +
          'measured against. Reporting it as a rate over candidate pairs rather than as a raw count ' +
          'is what makes two graphs of different sizes comparable.',
        example: 'On the 5×5 grid: force 0, layered 0, circular 70 — over 780 candidate pairs, so ' +
          '8.97% for the ring.'
      },
      {
        term: 'A circular layout is worth keeping because it is usually the worst',
        plain: 'It costs nothing, it is perfectly deterministic, and it ignores the edges entirely.',
        formal: 'position v at angle 2πv/n; the crossing count is a property of the vertex numbering alone',
        detail: 'A baseline that ignores the data is the honest comparison for any layout claim, in ' +
          'the same way that a constant predictor is the honest baseline for a model. It also has ' +
          'genuine uses: it is stable under changes to the graph, which matters when a diagram is ' +
          'regenerated repeatedly, and on a graph with a natural cyclic structure it can beat both ' +
          'of the others.',
        example: 'On the scale-free graph the three cost 45, 268 and 96 crossings for force, ' +
          'circular and layered.'
      }
    ],

    'spectral-methods': [
      {
        term: 'The Laplacian turns connectivity into arithmetic',
        plain: 'L = D − A has smallest eigenvalue 0, and the second-smallest is 0 exactly when the graph is disconnected.',
        formal: 'the multiplicity of eigenvalue 0 equals the number of connected components',
        detail: 'The second-smallest eigenvalue — the algebraic connectivity, or Fiedler value — is ' +
          'a continuous measure of how hard the graph is to cut, and it degrades gracefully: a graph ' +
          'that is barely connected has a small positive value rather than jumping from 0 to ' +
          'something large. That continuity is what makes it usable as a diagnostic on a real ' +
          'network, where "connected" is a yes-or-no answer that hides everything interesting.',
        example: 'On four planted clusters joined in a ring the value is 0.06497 and the bisection ' +
          'cuts a single edge; on a random graph it is 0.64231 and the cut costs 10.'
      },
      {
        term: 'The Fiedler vector orders the vertices, and splitting it is a partition',
        plain: 'Each vertex gets a number; cut at the median and you have two halves.',
        formal: 'spectral bisection minimises a continuous relaxation of the balanced-cut objective',
        detail: 'The relaxation is the reason this works and the reason it is not exact: the ' +
          'discrete problem wants each vertex to be −1 or +1 and the eigenvector gives real numbers, ' +
          'so rounding at the median is a choice rather than a derivation. It is a very good choice ' +
          'in practice, it is one eigenvector computation rather than a search, and it comes with a ' +
          'measured cut size that can be compared against anything else.',
        example: 'Four planted clusters split 12 and 12 across a cut of 1 edge.'
      },
      {
        term: 'PageRank is a random walk with a restart, and the restart is what makes it exist',
        plain: 'Follow a link with probability d, jump anywhere with probability 1 − d.',
        formal: 'r = d·Mᵀr + (1 − d)/n · 1; the teleport makes the chain irreducible and aperiodic',
        detail: 'Without the teleport the chain need not have a unique stationary distribution at ' +
          'all — a graph with two disconnected halves has infinitely many, and a bipartite one ' +
          'oscillates instead of converging. The damping factor is therefore not a tuning knob bolted ' +
          'on for robustness; it is what makes the question well posed. It also changes the answer, ' +
          'which is easy to forget when it is quoted as a constant.',
        example: 'On a 40-page link graph the highest-ranked page is 6 at damping 0.50 and 0.70, ' +
          'and 16 at 0.85 and above.'
      },
      {
        term: 'The d^k convergence bound is worst-case and enormously pessimistic',
        plain: 'The theory says thousands of iterations at damping 0.99; it takes 48.',
        formal: 'the error contracts by a factor of d per iteration in the worst case over starting vectors and graphs',
        detail: 'Two things account for the gap. The bound is over every starting vector, and the ' +
          'uniform distribution the algorithm actually starts from is already close to the answer on ' +
          'most graphs. And the contraction factor d is attained only on a graph engineered to mix ' +
          'slowly; a real link graph mixes far faster. Quoting the bound as a cost estimate ' +
          'therefore overstates the work by more than an order of magnitude at high damping, which ' +
          'is exactly where people expect trouble.',
        example: 'At damping 0.99 the bound predicts 2 292 iterations and the measurement is 48 — ' +
          '47.8× fewer.'
      },
      {
        term: 'Dangling pages leak probability, and the leak is invisible in the ranking',
        plain: 'A page with no outbound links has nowhere to send its mass, and dropping it makes the vector stop summing to one.',
        formal: 'redistribute the dangling mass uniformly, or the iteration converges to a substochastic fixed point',
        detail: 'The usual description of this bug is that "the ranking drifts", and measurement ' +
          'says otherwise: over thousands of small link graphs, dropping the dangling mass never ' +
          'once inverts a pair in the ranking, while leaking up to 85% of the probability. That ' +
          'makes it far more dangerous than the usual description suggests. The output people ' +
          'eyeball — the order — is perfect, and everything that treats the score as a *number* is ' +
          'silently wrong.',
        example: 'On a 40-page graph the broken version holds 0.434437 of the probability instead ' +
          'of 1, and moves 0 of 40 positions.'
      },
      {
        term: 'Centrality is a question, and the three standard answers disagree',
        plain: 'Whose removal lengthens the most routes, who can reach everybody quickly, and where a random walk spends its time.',
        formal: 'betweenness sums over shortest-path pairs; closeness inverts mean distance; PageRank is a stationary distribution',
        detail: 'These three are routinely treated as interchangeable measures of "importance" and ' +
          'they answer different questions with different answers. A bridge between two clusters has ' +
          'enormous betweenness and unremarkable closeness. A vertex at the centre of one dense ' +
          'cluster has the reverse. Choosing by the question rather than by which library function ' +
          'came to hand is the entire practical content of centrality analysis.',
        example: 'On the four-cluster graph betweenness names vertex 20 and closeness and PageRank ' +
          'both name vertex 7.'
      },
      {
        term: 'Brandes computes all betweenness in O(VE) without enumerating paths',
        plain: 'One breadth-first sweep per source, accumulating dependencies backwards.',
        formal: 'delta(v) = sum over successors w of (sigma(v)/sigma(w))·(1 + delta(w))',
        detail: 'The naive method enumerates shortest paths, and there can be exponentially many of ' +
          'them, so the algorithm is not an optimisation but the difference between feasible and ' +
          'not. The recurrence works because the dependency of a source on a vertex decomposes over ' +
          'that vertex\'s successors in the shortest-path DAG, so a single backward pass over the ' +
          'BFS order accumulates everything. Checking it against the enumeration on small graphs is ' +
          'the only way to be sure the recurrence was implemented right.',
        example: '24 single-source sweeps agree with path enumeration to 1.7e-13.'
      },
      {
        term: 'Modularity finds communities in graphs that have none',
        plain: 'A structureless graph still scores around 0.25 and still gets partitioned.',
        formal: 'modularity compares internal edges to a degree-matched random graph, and a random graph has fluctuations',
        detail: 'This is the number to remember before believing a community-detection result. ' +
          'Louvain maximises modularity greedily and always returns a partition; on a graph built ' +
          'with four planted communities it recovers them exactly, and on a random graph of the same ' +
          'size it returns nine communities at a score of about 0.25. Without the second run the ' +
          'first is uninterpretable, because there is no scale on which 0.68 is obviously good until ' +
          'you know that 0.25 is what noise looks like.',
        example: 'Four planted clusters: 4 communities at modularity 0.6773, matching the truth on ' +
          '100% of vertex pairs. The same size at random: 9 communities at 0.2476.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
