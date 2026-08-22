/** Reference entries for colouring, layout and spectral methods (M14.8-M14.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'graph-coloring': {
      summary: 'Greedy colouring as a family indexed by an ordering, the degeneracy bound, clique ' +
        'and independent set and vertex cover as one search, the pivot priced rather than asserted, ' +
        'and register allocation as the same problem with an escape hatch.',
      intuition: 'Nothing about the assignment step can be improved and everything about the answer ' +
        'depends on a sort you can change in one line.',
      formulation: {
        equations: [
          {
            label: 'Greedy, three orderings, one 18-vertex graph',
            expr: 'the ordering decides; the loop does not',
            terms: [
              { sym: 'natural', meaning: '5 colours — 2 above the optimum' },
              { sym: 'largest degree (Welsh-Powell)', meaning: '3 colours — optimal here' },
              { sym: 'degeneracy (smallest-last)', meaning: '4 colours, inside its bound of degeneracy + 1 = 4' },
              { sym: 'chromatic number', meaning: '3, by exhaustive search' },
              { sym: 'conflicts', meaning: '0 in every row — greedy cannot produce an improper colouring' }
            ]
          },
          {
            label: 'On a two-colourable graph the intuitive ordering is the worst',
            expr: 'bipartite, 18 vertices: natural 2, degree 4, degeneracy 2',
            terms: [
              { sym: 'chromatic number', meaning: '2' },
              { sym: 'why', meaning: 'largest-degree-first has no bound better than Δ + 1' },
              { sym: 'why no ordering is safe', meaning: 'some ordering always achieves the optimum, and finding it is NP-hard' }
            ]
          },
          {
            label: 'One search, three names',
            expr: 'omega(G) = alpha(complement of G), and alpha(G) + tau(G) = n',
            terms: [
              { sym: 'maximum clique', meaning: '3 — vertices 0, 4 and 15, every pair verified adjacent' },
              { sym: 'maximum independent set', meaning: '8, from the same search on the complement' },
              { sym: 'minimum vertex cover', meaning: '18 − 8 = 10' },
              { sym: 'what does NOT transfer', meaning: 'approximation ratios — vertex cover has a 2-approximation and independent set has none' }
            ]
          },
          {
            label: 'Bron-Kerbosch, with and without the pivot',
            expr: 'the pivot changes the work and never the answer',
            terms: [
              { sym: 'pivoted', meaning: '41 recursion nodes' },
              { sym: 'plain', meaning: '64 recursion nodes' },
              { sym: 'saving', meaning: '1.56x, on the same 24 maximal cliques' },
              { sym: 'when it pays', meaning: 'with density; on a sparse graph it is close to pure overhead' }
            ]
          },
          {
            label: 'Chaitin\'s allocator on the same graph',
            expr: 'simplify, spill, select',
            terms: [
              { sym: 'registers 2 / 3 / 4 / 5 / 6', meaning: 'spills 5 / 3 / 0 / 0 / 0 of 18 values' },
              { sym: 'conflicts', meaning: '0 at every setting — never an invalid allocation, only an expensive one' },
              { sym: 'why it ships', meaning: 'failure has a defined price rather than being failure' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No edge joins two vertices of the same colour',
          why: 'It is guaranteed by construction, so it tests the loop and never the ordering.',
          breaks: 'A conflict means the assignment step is broken, not that the ordering was poor.'
        },
        {
          name: 'Greedy in degeneracy order uses at most degeneracy + 1 colours',
          why: 'When a vertex is coloured, only its later-surviving neighbours are already coloured.',
          breaks: 'Exceeding it means the removal order or its reversal was computed wrongly.'
        },
        {
          name: 'The clique number is a lower bound on the chromatic number',
          why: 'Every vertex of a clique needs its own colour.',
          breaks: 'A colouring below the clique number is arithmetically impossible and indicates a broken checker.'
        },
        {
          name: 'A spilled vertex is excluded from the colouring check',
          why: 'It holds no register, so it is not part of the assignment.',
          breaks: 'Counting spills as one more colour makes every pair of spilled neighbours look like a conflict.'
        }
      ],
      complexity: [
        { operation: 'greedy colouring', average: 'Θ(V + E) after the ordering', worst: '72 colour checks at 18 vertices, identical in all three orders' },
        { operation: 'degeneracy ordering', average: 'Θ(V + E) with a bucket queue', worst: 'degeneracy 3 on the default graph' },
        { operation: 'chromatic number', average: 'NP-hard; exhaustive here', worst: '47 ms at 18 vertices and 754 ms at 22 — roughly 4x per two vertices' },
        { operation: 'Bron-Kerbosch with pivot', average: 'O(3^(n/3)) worst case', worst: '41 recursion nodes, 24 maximal cliques' },
        { operation: 'Bron-Kerbosch without pivot', average: 'the same bound, a worse constant', worst: '64 recursion nodes for the same 24 cliques' },
        { operation: 'Chaitin allocation', average: 'Θ(V·E) for the simplify/select passes', worst: '5 spills at 2 registers; 0 at 4' }
      ],
      failureModes: [
        {
          symptom: 'A colouring heuristic is chosen on intuition and uses twice the colours needed.',
          cause: 'Largest-degree-first has no better bound than Δ + 1 and loses on bipartite-like graphs.',
          fix: 'Use degeneracy ordering, which carries a bound, and measure against the optimum on small instances.'
        },
        {
          symptom: 'A test asserts a colouring is proper and never catches an ordering regression.',
          cause: 'Greedy cannot produce an improper colouring, so the assertion tests the wrong thing.',
          fix: 'Assert the colour count against the exhaustive chromatic number on a small fixture.'
        },
        {
          symptom: 'An approximation for vertex cover is reused for independent set and is terrible.',
          cause: 'Complementing a set does not complement its ratio.',
          fix: 'Treat the three problems as one for hardness and as three for approximation.'
        },
        {
          symptom: 'A register allocator reports a conflict rather than spilling.',
          cause: 'The spill path was not implemented, so an uncolourable graph is a failure instead of a cost.',
          fix: 'Spill the highest-degree survivor and re-run; that path is what makes the whole approach work.'
        }
      ],
      inTheWild: [
        { system: 'Compiler register allocation (GCC, LLVM)', how: 'graph colouring with spilling, or linear scan when compile time dominates' },
        { system: 'Frequency assignment in radio networks', how: 'colouring an interference graph, with the same ordering heuristics' },
        { system: 'Exam and room timetabling', how: 'interval-graph colouring where greedy in left-endpoint order is exact' },
        { system: 'Sparse Jacobian estimation', how: 'colouring the column-intersection graph to batch finite differences' }
      ],
      sources: [
        { title: 'Register allocation via coloring', where: 'Chaitin et al. — Computer Languages, 1981' },
        { title: 'Algorithm 457: finding all cliques of an undirected graph', where: 'Bron, Kerbosch — CACM, 1973' },
        { title: 'An upper bound for the chromatic number of a graph and its application to timetabling problems', where: 'Welsh, Powell — Computer Journal, 1967' },
        { title: 'Smallest-last ordering and clustering and graph coloring algorithms', where: 'Matula, Beck — JACM, 1983' }
      ]
    },

    'graph-layout': {
      summary: 'Euler\'s bound as a rejection filter rather than a test, force-directed layout ' +
        'whose energy is not monotone, Sugiyama layering and the dummy vertices that explain most ' +
        'bad generated diagrams, and the crossing count that turns taste into measurement.',
      intuition: 'The force model has no crossing term at all; it lands on planar drawings because ' +
        'crossings and high energy tend to coincide, and "tend to" is the whole caveat.',
      formulation: {
        equations: [
          {
            label: 'Euler, and its bipartite refinement',
            expr: 'E <= 3V − 6, and E <= 2V − 4 when the graph is bipartite',
            terms: [
              { sym: 'K5', meaning: 'V 5, E 10, bound 9 — exceeded, so certainly not planar' },
              { sym: 'K3,3', meaning: 'V 6, E 9, bound 12 — passes; the bipartite bound of 8 catches it' },
              { sym: 'the 5x5 grid', meaning: 'E 40 against bounds of 69 and 46 — not ruled out, which is all it ever says' },
              { sym: 'the real test', meaning: 'Kuratowski, and the linear-time algorithms built on it' }
            ]
          },
          {
            label: 'Three layouts, 5x5 grid, 25 vertices and 40 edges',
            expr: 'crossings over 780 candidate pairs',
            terms: [
              { sym: 'force-directed', meaning: '0 — a genuinely planar embedding, found without a crossing term' },
              { sym: 'circular', meaning: '70, or 8.97% of the candidate pairs' },
              { sym: 'layered', meaning: '0, over 9 layers with 0 dummy vertices' }
            ]
          },
          {
            label: 'The same three on a scale-free graph of 24 vertices',
            expr: '45 / 268 / 96 over 990 candidate pairs',
            terms: [
              { sym: 'dummy vertices', meaning: '48 — two per real vertex, and each one is a decision with no information' },
              { sym: 'why it matters', meaning: 'an edge skipping six layers contributes five dummies and five chances to cross' }
            ]
          },
          {
            label: 'Fruchterman-Reingold energy, 200 iterations',
            expr: 'the descent is NOT monotone',
            terms: [
              { sym: 'grid', meaning: '123.67 down to 4.70, rising on 68 of 200 steps — 34.0%' },
              { sym: 'scale-free', meaning: 'rising on 82 of 200' },
              { sym: 'why', meaning: 'a finite step capped by temperature can overshoot the minimum it aimed at' },
              { sym: 'what cooling does', meaning: 'shrinks the overshoots, so the run ENDS well rather than improving every step' }
            ]
          },
          {
            label: 'Sugiyama',
            expr: 'layer, insert dummies, reorder by barycentre, place',
            terms: [
              { sym: 'layering', meaning: 'longest path: one level below the deepest predecessor; needs a DAG' },
              { sym: 'sweeps', meaning: '4 by default, down and up' },
              { sym: 'hardness', meaning: 'crossing minimisation is NP-hard even between two adjacent layers' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A layout is deterministic for a given seed',
          why: 'Force-directed layout is chaotic in its initial conditions; a diagram that moves on every build is unusable.',
          breaks: 'An unseeded start makes two runs of the same pipeline produce different pictures.'
        },
        {
          name: 'The crossing count is computed only over pairs sharing no endpoint',
          why: 'Two edges meeting at a shared vertex are not a crossing.',
          breaks: 'Counting them inflates every layout by the same irrelevant amount and hides real differences.'
        },
        {
          name: 'Layered layout requires an acyclic orientation',
          why: 'Longest-path layering has no answer on a cycle.',
          breaks: 'The algorithm must refuse rather than emit a layering that quietly drops an edge.'
        },
        {
          name: 'Exceeding a counting bound proves non-planarity; passing one proves nothing',
          why: 'The bounds are necessary conditions, not sufficient ones.',
          breaks: 'Treating the check as a planarity test accepts K3,3 and every graph like it.'
        }
      ],
      complexity: [
        { operation: 'force-directed layout', average: 'Θ(steps · V²) for exact repulsion', worst: '200 iterations and 60 000 pair forces at 25 vertices' },
        { operation: 'crossing count', average: 'Θ(E²)', worst: '780 candidate pairs at 40 edges; 990 at 45' },
        { operation: 'circular layout', average: 'Θ(V) — arithmetic', worst: 'free, and usually the worst drawing' },
        { operation: 'layer assignment', average: 'Θ(V + E) by longest path', worst: '9 layers on both test graphs' },
        { operation: 'dummy insertion', average: 'Θ(sum of edge spans)', worst: '0 on the grid, 48 on the scale-free graph' },
        { operation: 'barycentre sweep', average: 'Θ(sweeps · (V + E))', worst: 'a heuristic — the exact problem is NP-hard per layer pair' }
      ],
      failureModes: [
        {
          symptom: 'A planarity check accepts a non-planar graph.',
          cause: 'It used E <= 3V − 6, which is necessary and not sufficient.',
          fix: 'Use it as a fast rejection filter in front of a real planarity test.'
        },
        {
          symptom: 'A test asserts the force model\'s energy falls every iteration and fails.',
          cause: 'It does not; a temperature-capped step can overshoot, on about a third of iterations.',
          fix: 'Assert that the final energy is below the initial, and that the run is deterministic for a seed.'
        },
        {
          symptom: 'A generated diagram gets dramatically worse after one edge is added.',
          cause: 'The edge spans several layers and contributed a dummy vertex to each of them.',
          fix: 'Add an explicit intermediate node to the source graph, which removes all of them at once.'
        },
        {
          symptom: 'A layered layout silently loses edges.',
          cause: 'The graph has a cycle and the layering had no answer.',
          fix: 'Remove or reverse cycle edges first — that is step zero of Sugiyama — and record which were reversed.'
        }
      ],
      inTheWild: [
        { system: 'mermaid and Graphviz dot', how: 'Sugiyama layering with a barycentre or median ordering pass' },
        { system: 'D3 force simulation', how: 'a velocity-Verlet variant of the same repulsion/attraction model' },
        { system: 'Circuit and VLSI placement', how: 'crossing and wirelength minimisation at a scale where exactness is hopeless' },
        { system: 'Network monitoring dashboards', how: 'force layouts, which is why the topology moves between page loads unless seeded' }
      ],
      sources: [
        { title: 'Graph Drawing by Force-directed Placement', where: 'Fruchterman, Reingold — Software: Practice and Experience, 1991' },
        { title: 'Methods for Visual Understanding of Hierarchical System Structures', where: 'Sugiyama, Tagawa, Toda — IEEE SMC, 1981' },
        { title: 'Sur le probleme des courbes gauches en topologie', where: 'Kazimierz Kuratowski — Fundamenta Mathematicae, 1930' },
        { title: 'Graph Drawing: Algorithms for the Visualization of Graphs', where: 'Di Battista, Eades, Tamassia, Tollis — Prentice Hall, 1998' }
      ]
    },

    'spectral-methods': {
      summary: 'The Laplacian and the Fiedler vector, PageRank as a random walk with a restart, ' +
        'three centrality measures that disagree, Louvain against a planted truth and against ' +
        'noise, and the dangling-node bug that leaves the ranking untouched.',
      intuition: 'A PageRank score that leaks 57% of its mass still sorts into exactly the right ' +
        'order, which is why nobody notices.',
      formulation: {
        equations: [
          {
            label: 'The Laplacian',
            expr: 'L = D − A; the multiplicity of eigenvalue 0 is the number of components',
            terms: [
              { sym: 'algebraic connectivity', meaning: 'the second-smallest eigenvalue — 0 exactly when disconnected' },
              { sym: 'four planted clusters', meaning: '0.06497, bisecting 12 and 12 across a cut of 1 edge' },
              { sym: 'a random graph', meaning: '0.64231, bisecting 7 and 17 across a cut of 10' }
            ]
          },
          {
            label: 'PageRank',
            expr: 'r = d·Mᵀr + (1 − d)/n · 1',
            terms: [
              { sym: 'why the teleport', meaning: 'it makes the chain irreducible and aperiodic, so a unique stationary distribution exists' },
              { sym: 'checked', meaning: 'power iteration against a direct linear solve: 3.46e-11 over 93 iterations' },
              { sym: 'mass', meaning: 'the vector sums to 1.000000' }
            ]
          },
          {
            label: 'Convergence against the d^k bound, 40 pages',
            expr: 'measured 20 / 27 / 36 / 39 / 44 / 48 iterations at damping 0.50 to 0.99',
            terms: [
              { sym: 'predicted', meaning: '34 / 65 / 142 / 219 / 449 / 2 292 — overstated by 1.7x to 47.8x' },
              { sym: 'why', meaning: 'the bound is worst-case over every starting vector, and uniform is already close' },
              { sym: 'damping changes the ANSWER', meaning: 'the top page is 6 at d <= 0.70 and 16 at d >= 0.85' }
            ]
          },
          {
            label: 'Dangling pages',
            expr: 'the leak destroys the values and leaves the order alone',
            terms: [
              { sym: 'correct', meaning: 'mass 1.000000, matching the linear solve to 2.67e-14' },
              { sym: 'mass dropped', meaning: 'mass 0.434437, differing by 3.18e-2, and moving 0 of 40 positions' },
              { sym: 'searched', meaning: '4 589 small link graphs: 0 strictly inverted pairs, worst leak 85.0%' }
            ]
          },
          {
            label: 'Centrality and communities, four planted clusters of six',
            expr: 'three measures, two different answers',
            terms: [
              { sym: 'betweenness', meaning: 'vertex 20 at 138.8333; Brandes agrees with path enumeration to 1.7e-13' },
              { sym: 'closeness', meaning: 'vertex 7 at 0.3651' },
              { sym: 'PageRank', meaning: 'vertex 7 at 0.0563' },
              { sym: 'Louvain', meaning: '4 communities at modularity 0.6773, matching the truth on all 276 pairs' },
              { sym: 'on a random graph', meaning: '9 communities at modularity 0.2476 — the floor to read every claim against' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The PageRank vector sums to one',
          why: 'It is a probability distribution, and the dangling-mass bug breaks exactly this and nothing else visible.',
          breaks: 'A leaked vector still sorts correctly, so every downstream numeric use is silently wrong.'
        },
        {
          name: 'Power iteration agrees with a direct linear solve',
          why: 'A run that stopped early returns a plausible vector rather than an error.',
          breaks: 'A residual threshold on the step size is not a bound on the distance to the answer.'
        },
        {
          name: 'Brandes agrees with path enumeration on small graphs',
          why: 'The dependency recurrence is easy to get subtly wrong and produces plausible numbers.',
          breaks: 'Nothing else catches a misplaced sigma ratio.'
        },
        {
          name: 'A modularity score is reported beside a null-model score',
          why: 'A structureless graph scores around 0.25, so 0.35 means nothing on its own.',
          breaks: 'Community detection on noise returns communities, confidently.'
        }
      ],
      complexity: [
        { operation: 'PageRank power iteration', average: 'Θ(iterations · E)', worst: '93 iterations at 24 vertices; 48 at damping 0.99 on 40 pages' },
        { operation: 'PageRank by linear solve', average: 'Θ(n³) Gaussian elimination', worst: 'useless at scale, and the only independent oracle' },
        { operation: 'Fiedler vector by power iteration with deflation', average: 'Θ(iterations · E)', worst: '400 iterations to an eigenvalue of 0.06497' },
        { operation: 'Brandes betweenness', average: 'Θ(VE) unweighted', worst: '24 single-source sweeps at 24 vertices' },
        { operation: 'betweenness by path enumeration', average: 'exponential in the path count', worst: 'the oracle, and only affordable below about 40 vertices' },
        { operation: 'Louvain', average: 'near-linear in practice', worst: '5 passes and 22 vertex moves at 24 vertices' }
      ],
      failureModes: [
        {
          symptom: 'PageRank scores are all too small and the ranking looks fine.',
          cause: 'Dangling pages leak their mass; the vector converges to a substochastic fixed point.',
          fix: 'Redistribute the dangling mass uniformly, and assert the vector sums to one.'
        },
        {
          symptom: 'A cost estimate for PageRank is an order of magnitude too high.',
          cause: 'The d^k bound was used as a prediction; it is worst-case over every starting vector.',
          fix: 'Measure on the real graph; the uniform start is already close to the answer.'
        },
        {
          symptom: 'Community detection finds structure in data known to have none.',
          cause: 'Modularity has fluctuations on random graphs, and Louvain always returns a partition.',
          fix: 'Report a degree-preserving null-model score beside every result.'
        },
        {
          symptom: 'Two teams disagree about which node is most important.',
          cause: 'They are using different centrality measures, which answer different questions.',
          fix: 'Name the question first — routes through, distance to all, or walk residence — then pick.'
        }
      ],
      inTheWild: [
        { system: 'Web search ranking', how: 'PageRank as one signal among hundreds, with dangling-mass handling as a documented detail' },
        { system: 'Graph partitioning for parallel solvers (METIS)', how: 'spectral bisection as one of several coarsening and refinement strategies' },
        { system: 'Social network analysis', how: 'betweenness for brokerage, closeness for reach, Louvain for grouping' },
        { system: 'Recommendation and fraud detection', how: 'personalised PageRank with a restart vector concentrated on a seed set' }
      ],
      sources: [
        { title: 'The PageRank Citation Ranking: Bringing Order to the Web', where: 'Page, Brin, Motwani, Winograd — Stanford, 1999' },
        { title: 'A faster algorithm for betweenness centrality', where: 'Ulrik Brandes — Journal of Mathematical Sociology, 2001' },
        { title: 'Fast unfolding of communities in large networks', where: 'Blondel, Guillaume, Lambiotte, Lefebvre — J. Stat. Mech., 2008' },
        { title: 'Algebraic connectivity of graphs', where: 'Miroslav Fiedler — Czechoslovak Mathematical Journal, 1973' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
