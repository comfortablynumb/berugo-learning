/**
 * The algorithms track: analysis, sorting, paradigms, dynamic programming, and everything the roadmap plans after them.
 *
 * Track data only - no API. `core/curriculum.js` assembles these into the one
 * ordered syllabus every view renders from, and it is still the single source
 * of truth; this file exists because the syllabus outgrew a thousand lines and
 * will keep growing as milestones land. Splitting per track rather than per
 * milestone keeps the seam in a place that does not move.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumAlgorithms = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'algorithms',
      title: 'Algorithms',
      summary: 'How to analyse an algorithm, then the algorithms themselves.',
      groups: [
        {
          id: 'M01',
          title: 'Complexity, analysis and benchmarking',
          summary: 'The vocabulary and the instruments the rest of the platform measures with.',
          sections: [
            {
              id: 'asymptotic-notation',
              title: 'Asymptotic notation, precisely',
              summary: 'O, Ω and Θ as sets of functions, checked against a witness pair (c, n₀).',
              tags: ['big-o', 'omega', 'theta', 'witness', 'growth']
            },
            {
              id: 'recurrences',
              title: 'Recurrences',
              summary: 'Recursion trees first, the master theorem second, and the gaps it cannot answer.',
              tags: ['recursion tree', 'master theorem', 'divide and conquer']
            },
            {
              id: 'amortised-analysis',
              title: 'Amortised analysis',
              summary: 'Aggregate, accounting and potential on one dynamic-array trace, with the credit visible.',
              tags: ['amortised', 'potential method', 'dynamic array', 'growth factor']
            },
            {
              id: 'average-case',
              title: 'Average-case and probabilistic analysis',
              summary: 'Indicator variables and the simulation that checks them, on randomised quicksort.',
              tags: ['expectation', 'indicator variables', 'quicksort', 'concentration']
            },
            {
              id: 'lower-bounds',
              title: 'Lower bounds and adversary arguments',
              summary: 'The decision tree for comparison sorting, and an adversary that plays your algorithm.',
              tags: ['lower bound', 'decision tree', 'adversary', 'information theory']
            },
            {
              id: 'constants-and-cache',
              title: 'Constants, cache and the failure of asymptotics',
              summary: 'Find the crossover where the asymptotically worse algorithm wins, and measure it.',
              tags: ['constants', 'crossover', 'cache', 'hybrid sort']
            },
            {
              id: 'space-complexity',
              title: 'Space complexity and working set',
              summary: 'Peak memory of the same computation materialised, chunked and streamed.',
              tags: ['space', 'peak memory', 'streaming', 'in-place']
            },
            {
              id: 'empirical-complexity',
              title: 'Empirical complexity',
              summary: 'The doubling experiment, log-log slopes and curve fitting - plus how they mislead.',
              tags: ['doubling', 'curve fitting', 'measurement', 'exponent']
            },
            {
              id: 'benchmarking',
              title: 'Benchmarking methodology',
              summary: 'Warm-up, sinks, repetition and the distribution - each mistake available on purpose.',
              tags: ['benchmark', 'warm-up', 'median', 'variance', 'jit']
            }
          ]
        },
        {
          id: 'M10',
          title: 'Sorting, selection and searching',
          summary: 'Sorting as an engineering subject: stability, adaptivity, pivots and the searches that follow.',
          sections: [
            {
              id: 'sorting-contract',
              title: 'The sorting contract',
              summary: 'Stability, adaptivity, in-place - and the comparator whose violation JavaScript will not report.',
              tags: ['stability', 'adaptive', 'in place', 'comparator', 'strict weak ordering', 'insertion sort']
            },
            {
              id: 'merge-sort',
              title: 'Merge sort and its variants',
              summary: 'One merge, four schedules, and the run detection that makes sorted input linear.',
              tags: ['merge sort', 'bottom-up', 'natural runs', 'in-place merge', 'k-way merge', 'stability']
            },
            {
              id: 'quicksort',
              title: 'Quicksort: partitions, pivots and the quiet quadratic',
              summary: 'Lomuto against Hoare against three-way, an adversarial input, and the depth limit that escapes it.',
              tags: ['quicksort', 'lomuto', 'hoare', 'dutch national flag', 'introsort', 'adversarial input']
            },
            {
              id: 'library-sorts',
              title: 'Library sorts: Timsort and pattern-defeating quicksort',
              summary: 'Run detection, the merge-stack invariants, the 2015 result, and pdqsort mechanisms.',
              tags: ['timsort', 'pdqsort', 'minrun', 'galloping', 'merge stack', 'formal verification']
            },
            {
              id: 'non-comparison-sorts',
              title: 'Non-comparison sorting: counting, radix and buckets',
              summary: 'Escaping the comparison bound by reading the key, and the stability every digit pass needs.',
              tags: ['counting sort', 'radix sort', 'lsd', 'msd', 'bucket sort', 'american flag', 'stability']
            },
            {
              id: 'selection-and-order',
              title: 'Selection and order statistics',
              summary: 'Quickselect, median of medians and top-k: three constants in front of n.',
              tags: ['quickselect', 'median of medians', 'introselect', 'top-k', 'partial sort', 'order statistic']
            },
            {
              id: 'binary-search',
              title: 'Binary search, correctly',
              summary: 'The half-open invariant, seven mutations, and how few inputs notice each one.',
              tags: ['binary search', 'lower bound', 'upper bound', 'invariant', 'off-by-one', 'interpolation search']
            },
            {
              id: 'searching-the-answer',
              title: 'Searching on the answer',
              summary: 'Binary search over a monotone predicate, and the monotonicity check that licenses it.',
              tags: ['predicate search', 'monotonicity', 'minimise the maximum', 'feasibility', 'ternary search']
            },
            {
              id: 'external-sorting',
              title: 'External, parallel and network sorting',
              summary: 'Merge passes as the unit of cost, replacement selection, and comparator networks verified exhaustively.',
              tags: ['external sort', 'replacement selection', 'k-way merge', 'bitonic', 'sorting network', 'zero-one principle']
            },
            {
              id: 'sorting-in-practice',
              title: 'Sorting in practice',
              summary: 'The chooser, the stability guarantee, and the default that sorts numbers as strings.',
              tags: ['array sort', 'schwartzian transform', 'collation', 'tie-breaking', 'es2019', 'chooser']
            }
          ]
        },
        {
          id: 'M11',
          title: 'Algorithm design paradigms',
          summary: 'Recognising which shape a problem has, and the proof technique that certifies each one.',
          sections: [
            {
              id: 'exhaustive-search',
              title: 'Exhaustive search and the art of pruning',
              summary: 'The state space as a tree, and the checks that refuse to build most of it.',
              tags: ['state space', 'pruning', 'symmetry breaking', 'n-queens', 'search tree', 'node count']
            },
            {
              id: 'divide-and-conquer',
              title: 'Divide and conquer',
              summary: 'Karatsuba, Strassen and closest pair: the combine step is the algorithm.',
              tags: ['karatsuba', 'strassen', 'closest pair', 'inversions', 'recurrence', 'crossover']
            },
            {
              id: 'greedy-algorithms',
              title: 'Greedy algorithms and exchange arguments',
              summary: 'Four criteria, one optimal, and the counter-examples found by search.',
              tags: ['greedy', 'interval scheduling', 'exchange argument', 'staying ahead', 'coin systems']
            },
            {
              id: 'matroids',
              title: 'Matroids: when greedy is provably right',
              summary: 'The exchange property, the Rado-Edmonds theorem, and a checker that returns a witness.',
              tags: ['matroid', 'independence oracle', 'exchange property', 'kruskal', 'rado-edmonds']
            },
            {
              id: 'backtracking',
              title: 'Backtracking',
              summary: 'Choose, explore, unchoose - and the heuristics that decide whether it finishes.',
              tags: ['backtracking', 'sudoku', 'mrv', 'forward checking', 'constraint propagation', 'undo']
            },
            {
              id: 'branch-and-bound',
              title: 'Branch and bound',
              summary: 'The bound is the algorithm, and an inadmissible one is a confident wrong answer.',
              tags: ['branch and bound', 'knapsack', 'relaxation', 'incumbent', 'admissible bound', 'tsp']
            },
            {
              id: 'two-pointers',
              title: 'Two pointers, sliding windows and monotonic structures',
              summary: 'One amortisation argument in four disguises, measured as a total rather than a rate.',
              tags: ['two pointers', 'sliding window', 'monotonic deque', 'monotonic stack', 'amortised']
            },
            {
              id: 'meet-in-the-middle',
              title: 'Meet in the middle and bidirectional search',
              summary: 'Halving the exponent, and the memory that pays for it.',
              tags: ['meet in the middle', 'subset sum', 'bidirectional search', 'horowitz-sahni', 'memory']
            },
            {
              id: 'offline-processing',
              title: 'Offline and batch processing',
              summary: 'Seeing every query first changes the achievable complexity class.',
              tags: ['offline', 'mo\'s algorithm', 'sqrt decomposition', 'batch', 'query reordering']
            }
          ]
        },
        {
          id: 'M12',
          title: 'Dynamic programming',
          summary: 'Choose the state, prove the recurrence, pick the order, then optimise.',
          sections: [
            {
              id: 'what-dp-is',
              title: 'What dynamic programming actually is',
              summary: 'Two preconditions, one DAG, and states x transitions as the complexity.',
              tags: ['optimal substructure', 'overlapping subproblems', 'memoisation', 'tabulation',
                'subproblem dag', 'evaluation order']
            },
            {
              id: 'one-dimensional-dp',
              title: 'One-dimensional DP',
              summary: 'Kadane, coin change and LIS - where the loop order is the question being asked.',
              tags: ['kadane', 'coin change', 'lis', 'patience sorting', 'reconstruction', 'loop order']
            },
            {
              id: 'knapsack-family',
              title: 'The knapsack family',
              summary: 'One table, four problems, and the space reduction that deletes the answer.',
              tags: ['knapsack', '0/1', 'unbounded', 'bounded', 'binary splitting', 'subset sum', 'pseudo-polynomial', 'space reduction']
            },
            {
              id: 'sequence-alignment',
              title: 'Sequence alignment DP',
              summary: 'Edit distance, the traceback, and Hirschberg getting the alignment in linear space.',
              tags: ['edit distance', 'levenshtein', 'lcs', 'hirschberg', 'needleman-wunsch', 'smith-waterman', 'affine gaps', 'diff']
            },
            {
              id: 'interval-dp',
              title: 'Interval DP',
              summary: 'Iterate by interval length, and check the precondition before narrowing the search.',
              tags: ['matrix chain', 'optimal bst', 'knuth optimisation', 'quadrangle inequality', 'palindrome partitioning', 'burst balloons']
            },
            {
              id: 'tree-dp',
              title: 'Tree DP and rerooting',
              summary: 'One pass down, one pass up, and every root answered.',
              tags: ['tree dp', 'rerooting', 'independent set', 'prefix suffix', 'sum of distances', 'diameter']
            },
            {
              id: 'bitmask-dp',
              title: 'Bitmask DP',
              summary: 'Subsets as integers, the 3^n identity, and the memory wall you can see.',
              tags: ['bitmask', 'submask', 'sum over subsets', 'held-karp', 'tsp', 'assignment', 'broken profile']
            },
            {
              id: 'digit-dp',
              title: 'DP on DAGs and digit DP',
              summary: 'The tight flag, and why the cost depends on the digits rather than the value.',
              tags: ['digit dp', 'tight', 'automaton dp', 'topological order', 'longest path', 'counting paths']
            },
            {
              id: 'dp-optimisations',
              title: 'DP optimisations',
              summary: 'Four narrowings of a quadratic transition, each with a precondition that is checked.',
              tags: ['convex hull trick', 'li chao', 'divide and conquer optimisation', 'monotonic queue', 'aliens trick', 'lagrangian']
            },
            {
              id: 'game-dp',
              title: 'Game DP and combinatorial games',
              summary: 'Alpha-beta at the mercy of move ordering, and Grundy refusing to build the product.',
              tags: ['minimax', 'alpha-beta', 'move ordering', 'nim', 'sprague-grundy', 'mex', 'retrograde analysis']
            },
            {
              id: 'expectation-dp',
              title: 'Probability and expectation DP',
              summary: 'A cyclic expectation is a linear system, not a recursion.',
              tags: ['expected value', 'absorbing markov chain', 'gaussian elimination', 'monte carlo', 'secretary problem', 'optimal stopping']
            },
            {
              id: 'graph-representations',
              title: 'Representations and traversal',
              summary: 'Adjacency list, matrix and CSR in bytes, and the two kinds of edge an undirected walk has.',
              tags: ['adjacency list', 'csr', 'adjacency matrix', 'bfs', 'dfs', 'edge classification', 'components', 'bipartite']
            },
            {
              id: 'topological-order',
              title: 'Topological order and DAGs',
              summary: 'Returning the cycle rather than null, and the critical path no worker count beats.',
              tags: ['topological order', 'kahn', 'cycle extraction', 'critical path', 'dag shortest paths', 'scheduling']
            },
            {
              id: 'strongly-connected',
              title: 'Strongly connected components',
              summary: 'Tarjan and Kosaraju checking each other, and the condensation that is always a DAG.',
              tags: ['scc', 'tarjan', 'kosaraju', 'lowlink', 'condensation', '2-sat', 'deadlock']
            },
            {
              id: 'bridges-and-cuts',
              title: 'Bridges, articulation points and biconnectivity',
              summary: 'The lowlink criterion, the block-cut tree, and the parallel edge that breaks the naive test.',
              tags: ['bridge', 'articulation point', 'lowlink', 'biconnected', 'block-cut tree', 'parallel edges', 'resilience']
            },
            {
              id: 'shortest-paths-basics',
              title: 'Shortest paths I: BFS, 0-1 BFS and Dijkstra',
              summary: 'The greedy invariant, and the negative edge that breaks it without raising anything.',
              tags: ['bfs', '0-1 bfs', 'dijkstra', 'relaxation', 'lazy heap', 'path reconstruction']
            },
            {
              id: 'negative-weights',
              title: 'Shortest paths II: negative weights and all pairs',
              summary: 'Extracting the negative cycle, and the Floyd-Warshall loop order that is not a style choice.',
              tags: ['bellman-ford', 'negative cycle', 'spfa', 'floyd-warshall', 'johnson', 'arbitrage']
            },
            {
              id: 'heuristic-search',
              title: 'Heuristic search: A* and friends',
              summary: 'Admissible is not the same as useful, and consistent is not the same as admissible.',
              tags: ['a-star', 'admissible', 'consistent', 'weighted a-star', 'ida-star', 'bidirectional', 'alt landmarks', 'heuristic']
            },
            {
              id: 'route-planning',
              title: 'Route planning at scale',
              summary: 'Contraction hierarchies, and the witness search that decides whether they are correct.',
              tags: ['contraction hierarchies', 'witness search', 'shortcut', 'bidirectional dijkstra', 'preprocessing', 'hub labelling', 'arc flags']
            },
            {
              id: 'minimum-spanning-trees',
              title: 'Minimum spanning trees',
              summary: 'Three algorithms that agree on weight and not on the tree, and the minimax path you get free.',
              tags: ['minimum spanning tree', 'kruskal', 'prim', 'boruvka', 'cut property', 'cycle property', 'minimax path', 'second best mst']
            },
            {
              id: 'tree-path-queries',
              title: 'Trees, LCA and path queries',
              summary: 'Binary lifting, sparse tables and heavy-light decomposition, ranked by tree shape rather than by theory.',
              tags: ['lowest common ancestor', 'binary lifting', 'euler tour', 'sparse table', 'heavy-light decomposition', 'path query', 'kth ancestor']
            }
          ]
        },
        {
          id: 'M14',
          title: 'Graph algorithms II — flow, matching, connectivity, spectral',
          summary: 'Scheduling, segmentation, assignment and satisfiability turn out to be four graph problems wearing different clothes.',
          sections: [

            {
              id: 'maximum-flow',
              title: 'Maximum flow',
              summary: 'The back edge is the algorithm, and path filling without one is wrong rather than slow.',
              tags: ['max flow', 'residual graph', 'ford-fulkerson', 'edmonds-karp', 'dinic', 'capacity scaling', 'augmenting path', 'blocking flow']
            },
            {
              id: 'minimum-cut',
              title: 'Minimum cut and its applications',
              summary: 'Segmentation and project selection are the same cut, and the modelling is the hard part.',
              tags: ['min cut', 'max-flow min-cut', 'image segmentation', 'maximum closure', 'project selection', 'konig', 'vertex cover']
            },
            {
              id: 'push-relabel',
              title: 'Push-relabel and modern flow',
              summary: 'The heuristics are not extras; without them the textbook version disappoints on purpose.',
              tags: ['push-relabel', 'preflow', 'height function', 'gap heuristic', 'global relabel', 'excess', 'goldberg-tarjan']
            },
            {
              id: 'min-cost-flow',
              title: 'Minimum-cost flow and assignment',
              summary: 'The potential is Johnson reweighting again, and after that it is Dijkstra in a loop.',
              tags: ['min-cost flow', 'successive shortest paths', 'potentials', 'cycle cancelling', 'assignment problem', 'hungarian algorithm', 'reduced cost']
            },
            {
              id: 'bipartite-matching',
              title: 'Bipartite matching',
              summary: 'Three derivations of one number, and stable matching solving a different problem entirely.',
              tags: ['bipartite matching', 'augmenting path', 'kuhn', 'hopcroft-karp', 'konig theorem', 'vertex cover', 'hall condition', 'gale-shapley', 'stable matching']
            },
            {
              id: 'general-matching',
              title: 'General and weighted matching',
              summary: 'An odd cycle turns the bipartite argument from slow into wrong, and the neighbour order decides.',
              tags: ['general matching', 'blossom', 'edmonds algorithm', 'odd cycle', 'hungarian algorithm', 'assignment problem', 'dual certificate', 'weighted matching']
            },
            {
              id: 'two-sat',
              title: '2-SAT and implication graphs',
              summary: 'Two literals make an implication and three do not, and that one literal is the whole boundary.',
              tags: ['2-sat', 'implication graph', 'strongly connected components', 'satisfiability', 'condensation order', 'at-most-one', '3-sat', 'np-complete']
            },
            {
              id: 'graph-coloring',
              title: 'Colouring, cliques and independent sets',
              summary: 'Greedy colouring is a family of heuristics indexed by an ordering, and spilling is what makes it work.',
              tags: ['graph colouring', 'chromatic number', 'degeneracy ordering', 'welsh-powell', 'bron-kerbosch', 'maximum clique', 'independent set', 'vertex cover', 'register allocation']
            },
            {
              id: 'graph-layout',
              title: 'Planarity, layout and drawing',
              summary: 'The crossing count turns an argument about taste into a measurement, and two textbook claims into false ones.',
              tags: ['planarity', 'euler formula', 'kuratowski', 'force-directed layout', 'fruchterman-reingold', 'sugiyama', 'layered layout', 'edge crossings', 'barycentre']
            },
            {
              id: 'spectral-methods',
              title: 'Spectral methods, centrality and communities',
              summary: 'Four measures of importance that disagree, and a PageRank bug the ranking never reveals.',
              tags: ['laplacian', 'fiedler vector', 'spectral bisection', 'pagerank', 'power iteration', 'damping', 'dangling nodes', 'brandes', 'betweenness', 'closeness', 'louvain', 'modularity']
            }
          ]
        },

        {
          id: 'M15',
          title: 'String algorithms and pattern matching',
          summary: 'Everything between indexOf and a text pipeline, ending in a regex that is a denial-of-service primitive.',
          sections: [
            {
              id: 'naive-matching',
              title: 'The matching problem and the naive algorithm',
              summary: 'Nearly linear on English, quadratic on one adversarial line, and the filter that saves no comparisons at all.',
              tags: ['exact matching', 'naive algorithm', 'character comparisons', 'first-character filter', 'memchr', 'indexOf', 'adversarial input', 'matcher families']
            },
            {
              id: 'kmp-prefix-function',
              title: 'KMP and the prefix function',
              summary: 'The array is worth more than the matcher: periods, powers and prefix counts all fall out of it.',
              tags: ['kmp', 'prefix function', 'border array', 'failure function', 'period detection', 'string powers', 'stream matching', 'kmp automaton']
            },
            {
              id: 'z-algorithm',
              title: 'The Z-algorithm and string periodicity',
              summary: 'Three cases, one window that never moves left, and the sentinel a hard-coded dollar sign gets wrong.',
              tags: ['z-algorithm', 'z-array', 'amortised window', 'sentinel', 'periodicity', 'fine and wilf', 'fibonacci words', 'linear string algorithms']
            },
            {
              id: 'boyer-moore',
              title: 'Boyer-Moore and skipping algorithms',
              summary: 'The only matcher that gets faster as the pattern grows, and the rule that does almost all the work.',
              tags: ['boyer-moore', 'bad character rule', 'good suffix rule', 'horspool', 'sunday', 'sublinear matching', 'skipping', 'strstr']
            },
            {
              id: 'rolling-hashes',
              title: 'Rabin-Karp and rolling hashes',
              summary: 'A fixed base is a published function, and a birthday search breaks it in a second.',
              tags: ['rabin-karp', 'rolling hash', 'polynomial hashing', 'birthday attack', 'randomised base', 'content-defined chunking', 'rsync', 'deduplication']
            },
            {
              id: 'aho-corasick',
              title: 'Aho-Corasick multi-pattern matching',
              summary: 'Failure links are KMP generalised; output links exist for one case, and dropping them under-reports in silence.',
              tags: ['aho-corasick', 'multi-pattern matching', 'failure links', 'output links', 'goto trie', 'nested patterns', 'intrusion detection', 'keyword sets']
            },
            {
              id: 'palindromes',
              title: 'Palindromes: Manacher and the palindromic tree',
              summary: 'The mirror is the Z-window again, and how many differs from how many different by a factor of n.',
              tags: ['manacher', 'palindrome', 'mirror argument', 'interleaving separator', 'eertree', 'palindromic tree', 'amortisation', 'distinct substrings']
            },
            {
              id: 'approximate-matching',
              title: 'Approximate matching',
              summary: 'A word-wide cliff, a band that refuses rather than answers, and a filter with a condition nobody checks.',
              tags: ['approximate matching', 'bitap', 'shift-or', 'wu-manber', 'banded edit distance', 'q-gram filter', 'prefilter selectivity', 'agrep']
            },
            {
              id: 'diff-and-merge',
              title: 'Diff and merge',
              summary: 'Myers costs the size of the answer, and the shortest edit script is routinely the least readable one.',
              tags: ['diff', 'myers algorithm', 'edit graph', 'furthest reaching path', 'patience diff', 'hunks', 'three-way merge', 'conflict detection']
            },
            {
              id: 'regex-engines',
              title: 'Regular expression engines',
              summary: 'One curve is exponential and one is linear, on the same pattern and the same input.',
              tags: ['regex', 'backtracking', 'thompson nfa', 'state set simulation', 'catastrophic backtracking', 'redos', 're2', 'capture groups']
            },
            {
              id: 'text-processing',
              title: 'Text processing in production',
              summary: 'The selectivity of the prefilter decides the throughput, and no similarity metric is right about every pair.',
              tags: ['tokenisation', 'byte-pair encoding', 'normalisation', 'jaro-winkler', 'jaccard', 'log template extraction', 'drain', 'prefilter selectivity', 'precision and recall']
            }]
        },

        {
          id: 'M16',
          title: 'Computational geometry',
          summary: 'The one area where floating point does not lose precision, it returns answers that contradict each other.',
          sections: [
            {
              id: 'geometry-primitives',
              title: 'Primitives and robustness',
              summary: 'The epsilon test never contradicts itself and is wrong on every input, which is the quieter of the two failures.',
              tags: ['orientation predicate', 'orient2d', 'robustness', 'exact arithmetic', 'adaptive predicates', 'shewchuk', 'floating point', 'collinear', 'epsilon comparison', 'in-circle']
            },
            {
              id: 'polygon-containment',
              title: 'Polygons, areas and containment',
              summary: 'Ray casting and the winding number disagree at the pentagram centre, and the polygon does not say which is meant.',
              tags: ['shoelace formula', 'signed area', 'point in polygon', 'ray casting', 'winding number', 'fill rule', 'even-odd', 'non-zero', 'self-intersection', 'douglas-peucker', 'visvalingam', 'simplification']
            },
            {
              id: 'convex-hulls',
              title: 'Convex hulls',
              summary: 'O(n log n) and O(nh) are different bounds rather than better and worse, and the point set decides which wins.',
              tags: ['convex hull', 'monotone chain', 'andrew', 'graham scan', 'gift wrapping', 'jarvis march', 'quickhull', 'collinear policy', 'orientation tests', 'output sensitive']
            },
            {
              id: 'sweep-line-algorithms',
              title: 'Sweep-line algorithms',
              summary: 'The paradigm is a paragraph and the implementation is the degeneracies, which never announce themselves.',
              tags: ['sweep line', 'bentley-ottmann', 'event queue', 'status structure', 'segment intersection', 'rectangle union', 'skyline', 'coordinate compression', 'degeneracy', 'vertical segments']
            },
            {
              id: 'polygon-triangulation',
              title: 'Triangulation',
              summary: 'Any valid triangulation joins the same points; the one that maximises the smallest angle is the one interpolation survives.',
              tags: ['triangulation', 'ear clipping', 'delaunay', 'empty circle property', 'in-circle predicate', 'bowyer-watson', 'edge flip', 'circumcircle', 'mesh quality', 'skinny triangles']
            },
            {
              id: 'voronoi-diagrams',
              title: 'Voronoi diagrams',
              summary: 'A wrong diagram still looks right, so the only check worth trusting is a brute-force nearest-site grid.',
              tags: ['voronoi', 'delaunay dual', 'circumcentre', 'half-plane intersection', 'unbounded cells', 'clipping', 'lloyd relaxation', 'centroidal', 'fortune sweep', 'nearest site']
            },
            {
              id: 'polygon-clipping',
              title: 'Boolean operations and clipping',
              summary: 'Against a concave clip the algorithm returns either nothing or a plausible polygon two-thirds too small.',
              tags: ['sutherland-hodgman', 'polygon clipping', 'boolean operations', 'concave clip', 'convex decomposition', 'greiner-hormann', 'minkowski sum', 'offsetting', 'buffering', 'rasterised oracle']
            },
            {
              id: 'rotating-calipers',
              title: 'Rotating calipers and optimisation on hulls',
              summary: 'One theorem turns a continuous optimisation into an O(h) scan, and on diagonal data it beats the bounding box thirtyfold.',
              tags: ['rotating calipers', 'antipodal pairs', 'diameter', 'width', 'minimum area rectangle', 'bounding box', 'welzl', 'smallest enclosing circle', 'convex optimisation']
            },
            {
              id: 'transforms-and-3d',
              title: 'Transforms and 3-D geometry',
              summary: 'Gimbal lock is a degree of freedom draining away for the whole approach, not a cliff at ninety degrees.',
              tags: ['homogeneous coordinates', 'affine transforms', 'composition order', 'row major', 'quaternions', 'slerp', 'gimbal lock', 'euler angles', 'moller-trumbore', 'barycentric coordinates', 'projection pipeline']
            },
            {
              id: 'applied-geometry',
              title: 'Applied geometry',
              summary: 'Where continuous geometry meets a pixel grid, and treating latitude and longitude as planar is the most common bug in application code.',
              tags: ['bresenham', 'scanline fill', 'anti-aliasing', 'coverage', 'curve flattening', 'bezier', 'separating axis theorem', 'minimum translation vector', 'collision response', 'geodesic distance', 'map projection']
            }]
        },

        {
          id: 'M17',
          title: 'Numbers, bits and floating point',
          summary: 'The representation layer every other track silently assumes, turned into measurements.',
          sections: [
            {
              id: 'integer-representation',
              title: 'Integer representation',
              summary: 'Carry and overflow are different flags, and which one was the bug is decided by the types in your source rather than by the hardware.',
              tags: ['twos complement', 'carry', 'overflow', 'sign extension', 'saturating', 'wrapping', 'trapping', 'endianness', 'int32 coercion', 'int min']
            },
            {
              id: 'bit-manipulation',
              title: 'The bit-manipulation toolkit',
              summary: 'The showpiece bit-scan trick does more work than the loop it replaces on random data, and nine times less in the worst case.',
              tags: ['popcount', 'swar', 'de bruijn', 'count trailing zeros', 'count leading zeros', 'gray code', 'bit reversal', 'branchless', 'bit fields', 'hackers delight']
            },
            {
              id: 'bitsets-and-swar',
              title: 'Bitsets and SWAR algorithms',
              summary: 'A bitset is not compact, it is compact above a density, and the crossing is far sparser than anybody guesses.',
              tags: ['bitset', 'bitboard', 'word parallelism', 'density', 'set operations', 'sieve', 'typed arrays', 'cache', 'iteration', 'chess']
            },
            {
              id: 'ieee-754',
              title: 'IEEE 754',
              summary: 'A double is not an approximation of a real number, it is a specific rational one, and the demo prints all fifty-five digits of it.',
              tags: ['ieee 754', 'binary64', 'mantissa', 'exponent bias', 'subnormal', 'nan', 'signed zero', 'ulp', 'machine epsilon', 'spacing', 'max safe integer']
            },
            {
              id: 'floating-point-hazards',
              title: 'Floating-point hazards',
              summary: 'Four orderings of one array give four different totals, and none of them is the bug.',
              tags: ['cancellation', 'absorption', 'non associativity', 'kahan', 'neumaier', 'pairwise summation', 'welford', 'variance', 'quadratic formula', 'error accumulation']
            },
            {
              id: 'fixed-and-decimal',
              title: 'Fixed point, decimal and rational arithmetic',
              summary: 'A million transactions summed as doubles are out by a ten-thousandth of a cent; applying a tax rate loses ten dollars.',
              tags: ['fixed point', 'decimal', 'integer cents', 'rational', 'bankers rounding', 'half even', 'rounding policy', 'money', 'scaled integer', 'gcd growth']
            },
            {
              id: 'arbitrary-precision',
              title: 'Arbitrary-precision arithmetic',
              summary: 'Karatsuba crosses over at three different sizes depending on which column you count, and wall clock is not one of them.',
              tags: ['bignum', 'limbs', 'karatsuba', 'schoolbook', 'knuth algorithm d', 'add back', 'montgomery', 'modpow', 'bigint', 'crossover']
            },
            {
              id: 'modular-arithmetic',
              title: 'Modular arithmetic and number theory',
              summary: 'On a Carmichael number the Fermat test is not probabilistic, it is wrong for every base, and Miller-Rabin below 2 to the 64 is not probabilistic either.',
              tags: ['modular arithmetic', 'extended euclid', 'modular inverse', 'chinese remainder', 'miller rabin', 'carmichael', 'fermat test', 'pollard rho', 'sieve', 'linear sieve']
            },
            {
              id: 'random-generation',
              title: 'Random number generation',
              summary: 'Every generator here passes a histogram, RANDU included, and one of them satisfies a linear identity exactly on every triple it emits.',
              tags: ['prng', 'lcg', 'randu', 'xorshift', 'pcg', 'splitmix', 'mersenne twister', 'modulo bias', 'rejection sampling', 'fisher yates', 'chi squared']
            },
            {
              id: 'integer-algorithms',
              title: 'Integer algorithms in practice',
              summary: 'The columns that make an identifier cheap to index are exactly the columns that make it informative to a stranger.',
              tags: ['uuid', 'ulid', 'snowflake', 'sequential ids', 'index locality', 'buffer pool', 'clock regression', 'monotonic', 'bit packing', 'information leakage']
            }]
        },

        {
          id: 'M18',
          title: 'Numerical methods, transforms and optimisation',
          summary: 'Error and conditioning tracked at every step, so "the algorithm is wrong" can be told apart from "the problem is ill-conditioned".',
          sections: [
            {
              id: 'conditioning-and-error',
              title: 'Conditioning, stability and error',
              summary: 'The residual sits at machine precision across nine orders of conditioning while the answer loses every correct digit, and nothing warns the caller.',
              tags: ['condition number', 'forward error', 'backward error', 'residual', 'stability', 'hilbert matrix', 'digits lost', 'machine epsilon', 'relative error', 'error bound']
            },
            {
              id: 'root-finding',
              title: 'Root finding',
              summary: 'Newton converges to a genuine root from nine starting points and it is the wrong one from three of them, with no error raised.',
              tags: ['bisection', 'newton', 'secant', 'brent', 'false position', 'fixed point', 'convergence order', 'basin of attraction', 'bracketing', 'contraction']
            },
            {
              id: 'linear-systems',
              title: 'Linear systems',
              summary: 'A pivot of 1e-18 is small and never zero, so no check fires and the answer comes back wrong in its first component by 100 percent.',
              tags: ['gaussian elimination', 'partial pivoting', 'growth factor', 'lu decomposition', 'cholesky', 'jacobi', 'gauss seidel', 'sor', 'conjugate gradient', 'preconditioning', 'never invert']
            },
            {
              id: 'least-squares',
              title: 'Least squares, QR and the SVD',
              summary: 'Forming A-transpose-A squares the condition number exactly, which is half your digits gone before any solving happens.',
              tags: ['normal equations', 'qr', 'gram schmidt', 'householder', 'svd', 'pseudo inverse', 'eckart young', 'low rank', 'numerical rank', 'ridge', 'vandermonde']
            },
            {
              id: 'eigenvalues',
              title: 'Eigenvalues and the QR algorithm',
              summary: 'The Wilkinson polynomial has roots at 1 through 20 and a fifteenth-digit nudge to one coefficient moves one of them by most of a whole unit.',
              tags: ['power iteration', 'spectral gap', 'shifted inverse', 'qr algorithm', 'hessenberg', 'characteristic polynomial', 'wilkinson polynomial', 'similarity transformation', 'eigenvector', 'krylov']
            },
            {
              id: 'interpolation',
              title: 'Interpolation and approximation',
              summary: 'Five times the data makes the polynomial fit six hundred times worse, and moving the same nodes to the Chebyshev positions fixes it.',
              tags: ['runge phenomenon', 'chebyshev nodes', 'lagrange', 'barycentric', 'cubic spline', 'monotone interpolation', 'overshoot', 'bezier', 'de casteljau', 'knots']
            },
            {
              id: 'differentiation-and-autodiff',
              title: 'Differentiation, integration and autodiff',
              summary: 'The best a forward difference can ever do is eight correct digits out of sixteen, and no step size gets under that floor.',
              tags: ['finite difference', 'step size', 'truncation error', 'richardson', 'complex step', 'trapezoid', 'simpson', 'gauss legendre', 'adaptive quadrature', 'forward mode', 'reverse mode', 'tape', 'adjoint']
            },
            {
              id: 'differential-equations',
              title: 'Differential equations and simulation',
              summary: 'Over 200 000 steps the fourth-order method loses energy monotonically and the second-order one does not, which is why games use the second-order one.',
              tags: ['euler', 'midpoint', 'rk4', 'verlet', 'symplectic', 'energy drift', 'convergence order', 'stiffness', 'stability limit', 'implicit euler', 'leapfrog']
            },
            {
              id: 'fourier-transforms',
              title: 'Fourier transforms and signal processing',
              summary: 'A pure tone smeared across the whole spectrum is not a resolution problem, and 1100 Hz sampled at 1 kHz is indistinguishable from 100 Hz forever after.',
              tags: ['dft', 'fft', 'butterfly', 'bit reversal', 'twiddle factor', 'windowing', 'spectral leakage', 'hann', 'blackman', 'aliasing', 'nyquist', 'convolution theorem', 'ntt']
            },
            {
              id: 'optimisation',
              title: 'Optimisation',
              summary: 'Gradient descent goes from two iterations to nine thousand as the conditioning worsens, and Newton takes two at every point on that range.',
              tags: ['convexity', 'gradient descent', 'step size', 'stability limit', 'momentum', 'line search', 'armijo', 'bfgs', 'newton method', 'coordinate descent', 'affine invariance', 'conditioning']
            }]
        }
      ],
      planned: [
        { id: 'M19', title: 'Randomised and approximation algorithms', sections: 9 },
        { id: 'M20', title: 'NP-completeness, reductions and metaheuristics', sections: 9 },
        { id: 'M21', title: 'Online, external-memory and cache-oblivious algorithms', sections: 9 },
        { id: 'M22', title: 'Compression, information theory and error correction', sections: 11 },
        { id: 'M23', title: 'Applied cryptography and constant-time programming', sections: 11 }
      ]
    },
  ];
}));
