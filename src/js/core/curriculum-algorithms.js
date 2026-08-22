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
        }
      ],
      planned: [
        { id: 'M15', title: 'String algorithms and pattern matching', sections: 11 },
        { id: 'M16', title: 'Computational geometry', sections: 10 },
        { id: 'M17', title: 'Numbers, bits and floating point', sections: 10 },
        { id: 'M18', title: 'Numerical methods, transforms and optimisation', sections: 10 },
        { id: 'M19', title: 'Randomised and approximation algorithms', sections: 9 },
        { id: 'M20', title: 'NP-completeness, reductions and metaheuristics', sections: 9 },
        { id: 'M21', title: 'Online, external-memory and cache-oblivious algorithms', sections: 9 },
        { id: 'M22', title: 'Compression, information theory and error correction', sections: 11 },
        { id: 'M23', title: 'Applied cryptography and constant-time programming', sections: 11 }
      ]
    },
  ];
}));
