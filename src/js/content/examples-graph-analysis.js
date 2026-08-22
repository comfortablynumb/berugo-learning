/** Worked examples for colouring, layout and spectral methods (M14.8-M14.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'graph-coloring': [
      {
        title: 'One graph, three orderings, three answers, and the exact number beside them',
        goal: 'Show that greedy colouring is not a heuristic with a quality but a family indexed by ' +
          'an ordering, and price each member against the exhaustive optimum.',
        setup: 'A random graph of 18 vertices at seed 1, coloured greedily in natural, ' +
          'largest-degree and degeneracy order, with the chromatic number computed exhaustively.',
        steps: [
          {
            do: 'Colour in the order the vertices arrived.',
            why: 'The baseline: no ordering effort at all.',
            work: '5 colours, 72 colour checks, 0 conflicts',
            result: 'a proper colouring, two above the optimum'
          },
          {
            do: 'Colour largest-degree first — Welsh-Powell.',
            why: 'The intuition is that the constrained vertices should be placed while there is room.',
            work: '3 colours, 72 checks, 0 conflicts',
            result: 'optimal on this graph'
          },
          {
            do: 'Colour in degeneracy order — smallest-last.',
            why: 'It carries a bound: at most degeneracy + 1 colours.',
            work: '4 colours, against a degeneracy of 3 and therefore a bound of 4',
            result: 'inside its guarantee and above the optimum'
          },
          {
            do: 'Compute the chromatic number by exhaustive search.',
            why: '"Greedy did well" is a measurement or it is nothing.',
            work: '3 — so the three orderings are 2, 0 and 1 above it',
            result: 'the ordering, not the algorithm, decides'
          },
          {
            do: 'Now switch to the bipartite shape at the same size.',
            why: 'A graph with a known answer separates a good heuristic from a lucky one.',
            work: 'natural 2, degree 4, degeneracy 2, chromatic number 2',
            result: 'largest-degree-first uses twice the necessary colours'
          }
        ],
        answer: '5, 3 and 4 colours on one graph whose chromatic number is 3 — and on a ' +
          'two-colourable graph, 2, 4 and 2. The conflict column is 0 in every row of every run, ' +
          'always: greedy cannot produce an improper colouring whatever order it is given. So the ' +
          'only thing worth testing is the colour count, and the only way to know whether it is good ' +
          'is to compute the optimum on a graph small enough to afford it.'
      },
      {
        title: 'Three names for one search, and the escape hatch that makes it shippable',
        goal: 'Get maximum clique, maximum independent set and minimum vertex cover from one ' +
          'computation, price the pivot, then run the compiler\'s version of the same problem.',
        setup: 'The same 18-vertex graph. Bron-Kerbosch with and without pivoting, on the graph and ' +
          'on its complement; then Chaitin\'s allocator at register counts from 2 to 6.',
        steps: [
          {
            do: 'Run Bron-Kerbosch with pivoting and take the largest clique.',
            why: 'It is the direct question and the lower bound on the chromatic number.',
            work: 'a clique of 3 — vertices 0, 4 and 15 — from 24 maximal cliques in 41 recursion nodes',
            result: 'every pair verified adjacent'
          },
          {
            do: 'Run the same search on the complement of the graph.',
            why: 'A clique in the complement is an independent set in the original.',
            work: 'an independent set of 8, verified to contain no adjacent pair',
            result: 'a second answer from the same code'
          },
          {
            do: 'Subtract from n.',
            why: 'Everything outside a maximum independent set is a minimum vertex cover.',
            work: '18 − 8 = 10',
            result: 'a third answer, by arithmetic'
          },
          {
            do: 'Turn the pivot off and compare the recursion trees.',
            why: 'The pivot changes the work and never the answer.',
            work: '64 recursion nodes without against 41 with, finding the same 24 maximal cliques ' +
              '— a 1.56× saving',
            result: 'real and unspectacular, and it grows with density'
          },
          {
            do: 'Run Chaitin\'s allocator at 2, 3, 4, 5 and 6 registers.',
            why: 'Register allocation is this problem with spilling as the escape hatch.',
            work: 'spills of 5, 3, 0, 0 and 0 out of 18 values, with 0 conflicts at every setting',
            result: 'never an invalid allocation, only an expensive one'
          }
        ],
        answer: 'Clique 3, independent set 8, cover 10 — one search and two lines of arithmetic — ' +
          'with the pivot saving 1.56× on the same 24 cliques. Then 5, 3 and 0 spills at 2, 3 and 4 ' +
          'registers. The spill column is the whole reason an NP-hard problem sits in the middle of ' +
          'every optimising compiler: failure has a defined price rather than being failure, and the ' +
          'heuristic only decides how often that price is paid.'
      }
    ],

    'graph-layout': [
      {
        title: 'Three drawings of one graph, and a claim about descent that does not hold',
        goal: 'Turn "which layout is better" into a measurement, then check whether the force ' +
          'model\'s energy actually falls monotonically.',
        setup: 'A 5×5 grid — planar, bipartite and 2-colourable — with 25 vertices and 40 edges, ' +
          'laid out three ways; 200 Fruchterman-Reingold iterations from seed 1.',
        steps: [
          {
            do: 'Count the crossings in the force-directed drawing.',
            why: 'The crossing count is the only objective measure of a drawing anyone agrees on.',
            work: '0 crossings over 780 candidate pairs',
            result: 'a genuinely planar embedding, found by an algorithm with no notion of crossings'
          },
          {
            do: 'Count them in the circular layout.',
            why: 'It ignores the edges entirely, so it is the honest baseline.',
            work: '70 crossings — 8.97% of the candidate pairs',
            result: 'the same graph, 70 more places a reader has to work out which line is which'
          },
          {
            do: 'Count them in the layered layout.',
            why: 'It is what mermaid and every dependency-diagram tool runs.',
            work: '0 crossings, over 9 layers with 0 dummy vertices and 4 barycentre sweeps',
            result: 'every edge of a grid joins adjacent layers, so there is nothing to route'
          },
          {
            do: 'Plot the force model\'s energy per iteration.',
            why: '"Gradient descent converges" is a claim about the endpoint, not about every step.',
            work: 'energy falls from 123.67 to 4.70 and rises on 68 of the 200 iterations — 34.0%',
            result: 'not monotone, by a third'
          },
          {
            do: 'Switch to a scale-free graph of 24 vertices and repeat.',
            why: 'A planar graph is the easy case for all three.',
            work: 'crossings 45 force, 268 circular, 96 layered, with 48 dummy vertices inserted ' +
              'and 82 of 200 iterations rising',
            result: 'the ranking survives and the margins shrink'
          }
        ],
        answer: '0, 70 and 0 crossings on the grid; 45, 268 and 96 on a scale-free graph. And the ' +
          'energy rises on 34% of the iterations while falling from 123.67 to 4.70 overall. Each ' +
          'iteration moves every vertex by up to the current temperature, which can carry it past ' +
          'the minimum it was aiming at; the cooling schedule is what makes the overshoots shrink, ' +
          'not what stops them happening.'
      },
      {
        title: 'Two non-planar graphs, two different arguments, and neither one a test',
        goal: 'Show that a counting bound rejects and never accepts, and that the right bound ' +
          'depends on knowing something about the graph first.',
        setup: 'K5 — five vertices, all joined — and K3,3 — three houses and three utilities — ' +
          'against Euler\'s bound and its bipartite refinement.',
        steps: [
          {
            do: 'Apply E <= 3V − 6 to K5.',
            why: 'Every face of a simple planar graph has at least three edges.',
            work: '10 edges against a bound of 9',
            result: 'certainly not planar'
          },
          {
            do: 'Apply the same bound to K3,3.',
            why: 'The obvious next step, and it fails.',
            work: '9 edges against a bound of 12',
            result: 'not ruled out — and K3,3 is the second graph in Kuratowski\'s theorem'
          },
          {
            do: 'Use the bipartite refinement instead.',
            why: 'A bipartite planar graph has no triangular face, so every face has at least four edges.',
            work: '9 edges against 2V − 4 = 8',
            result: 'certainly not planar, by a bound the general argument cannot see'
          },
          {
            do: 'Apply both to the 5×5 grid.',
            why: 'The grid is planar, so a test would say so.',
            work: '40 edges against bounds of 69 and 46',
            result: 'not ruled out — which is all a counting argument ever says'
          }
        ],
        answer: 'K5 is caught at 10 against 9 and K3,3 is missed at 9 against 12, then caught at 9 ' +
          'against 8 by a bound that assumes bipartiteness. Two non-planar graphs and two different ' +
          'arguments, and neither ever proves a graph planar. Euler\'s bound is a fast rejection ' +
          'filter to put in front of a real planarity test, not a substitute for one.'
      }
    ],

    'spectral-methods': [
      {
        title: 'One graph analysed four ways, and how little the four agree',
        goal: 'Compute PageRank, betweenness, closeness, spectral bisection and Louvain ' +
          'communities on one graph, and check each against something independent.',
        setup: 'Four planted communities of six vertices each, densely wired internally and joined ' +
          'in a ring: 24 vertices at seed 1.',
        steps: [
          {
            do: 'Run PageRank by power iteration and check it against a direct linear solve.',
            why: 'A power iteration that stopped early returns a plausible vector rather than an error.',
            work: '93 iterations, largest difference 3.46e-11, and the vector sums to 1.000000',
            result: 'converged to the right answer, not merely to a stable one'
          },
          {
            do: 'Run Brandes for betweenness and check it against path enumeration.',
            why: 'The recurrence is easy to get subtly wrong and produces plausible numbers.',
            work: '24 single-source sweeps, agreeing with enumeration to 1.7e-13',
            result: 'the O(VE) algorithm confirmed against the exponential one'
          },
          {
            do: 'Compare the three centrality orderings.',
            why: '"Important" is a property of a question, not of a vertex.',
            work: 'betweenness names 20 at 138.8333; closeness names 7 at 0.3651; PageRank names 7 ' +
              'at 0.0563',
            result: 'two different answers to "which vertex matters most"'
          },
          {
            do: 'Compute the Fiedler vector and bisect at the median.',
            why: 'The algebraic connectivity is a continuous measure of how hard the graph is to cut.',
            work: 'eigenvalue 0.06497, splitting 12 and 12 across a cut of 1 edge',
            result: 'a partition from linear algebra rather than from a search'
          },
          {
            do: 'Run Louvain and compare against the planted truth.',
            why: 'The generator knows the answer, so the algorithm has something to be right about.',
            work: '4 communities at modularity 0.6773 after 5 passes and 22 vertex moves, agreeing ' +
              'with the planted grouping on all 276 vertex pairs',
            result: 'exact recovery, and the same modularity as the truth'
          }
        ],
        answer: 'PageRank verified to 3.46e-11, betweenness to 1.7e-13, a bisection of 12 and 12 ' +
          'across one edge, and a perfect community recovery at modularity 0.6773. The result worth ' +
          'carrying is the third step: betweenness says vertex 20 and the other two say vertex 7. ' +
          'Three measures of importance, one graph, and no agreement — because they answer three ' +
          'different questions.'
      },
      {
        title: 'The bound that overstates by 48×, and the bug the ranking never reveals',
        goal: 'Measure PageRank\'s convergence against the textbook bound, then measure what ' +
          'dropping the dangling mass actually does.',
        setup: 'A 40-page directed link graph with 8 pages that link to nothing, at six damping ' +
          'factors; then both versions of the iteration on the same graph, and a search over ' +
          'thousands of small link graphs.',
        steps: [
          {
            do: 'Count the iterations to a residual of 10⁻¹⁰ at each damping factor.',
            why: 'The theory says the error contracts by a factor of d per iteration.',
            work: '20, 27, 36, 39, 44 and 48 iterations at damping 0.50, 0.70, 0.85, 0.90, 0.95 and 0.99',
            result: 'nearly flat in the damping factor'
          },
          {
            do: 'Compare against log(10⁻¹⁰)/log(d).',
            why: 'That is the bound people quote when estimating the cost.',
            work: '34, 65, 142, 219, 449 and 2 292 predicted — an overstatement of 1.7×, 2.4×, ' +
              '3.9×, 5.6×, 10.2× and 47.8×',
            result: 'the bound is worst-case over every starting vector and every graph'
          },
          {
            do: 'Read the highest-ranked page at each damping.',
            why: 'Damping is usually quoted as a constant, which hides that it changes the answer.',
            work: 'page 6 at damping 0.50 and 0.70, page 16 at 0.85 and above',
            result: 'the parameter is not only a cost knob'
          },
          {
            do: 'Now run the iteration without redistributing the dangling mass.',
            why: 'It is the standard bug, and it is standardly described as making the ranking drift.',
            work: 'the vector holds 0.434437 of the probability instead of 1, and moves 0 of 40 ' +
              'positions in the ranking',
            result: 'the values are destroyed and the order is untouched'
          },
          {
            do: 'Search for a counter-example.',
            why: 'One graph is an anecdote.',
            work: '4 589 small link graphs with dangling pages: 0 strictly inverted pairs, and a ' +
              'worst leak of 85.0% of the mass',
            result: 'the order survives every time'
          }
        ],
        answer: '48 iterations against a predicted 2 292 at damping 0.99, and a broken vector ' +
          'holding 0.434437 of the probability while inverting nothing across 4 589 graphs. The ' +
          'usual description of the dangling-node bug — that the ranking drifts — is not what ' +
          'happens, and the truth is worse: the output everyone eyeballs is perfect, so anything ' +
          'that treats a PageRank score as a number rather than a position is silently wrong.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
