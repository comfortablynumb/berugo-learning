/** Reference entries for general matching and 2-SAT (M14.6-M14.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'general-matching': {
      summary: 'Why the bipartite augmenting-path argument dies on an odd cycle, what contraction ' +
        'does about it, how rarely the shortcut is caught, and the Hungarian algorithm\'s dual ' +
        'certificate for the weighted problem.',
      intuition: 'The bipartite proof depends on parity, and a vertex on an odd cycle is reachable ' +
        'at both parities. Everything else follows.',
      formulation: {
        equations: [
          {
            label: 'The blossom',
            expr: 'an edge between two vertices at even distance from the root closes an odd cycle',
            terms: [
              { sym: 'why it breaks marking', meaning: 'the cycle is reachable at both parities, so one mark discards the alternative' },
              { sym: 'Edmonds', meaning: 'G has an augmenting path iff G with the blossom contracted has one' },
              { sym: 'measured', meaning: 'the six-vertex counter-example: 1 contraction, 3 augmenting paths, 13 edge examinations' }
            ]
          },
          {
            label: 'The counter-example, and the order that hides it',
            expr: 'the same eight edges give 2 or 3 depending on the adjacency order',
            terms: [
              { sym: 'as found', meaning: 'naive returns 2 in 13 edge examinations; brute force says 3' },
              { sym: 'sorted ascending', meaning: 'the same naive search returns 3 in 6 examinations' },
              { sym: 'the graph', meaning: 'two triangles sharing vertex 3, plus a pendant on vertex 4' }
            ]
          },
          {
            label: 'How often the shortcut is wrong',
            expr: '5 of 300 random graphs — 1.7%',
            terms: [
              { sym: 'by edge count', meaning: '60 trials each at 12 / 16 / 20 / 24 / 30 edges: short on 1 / 1 / 1 / 2 / 0' },
              { sym: 'why that matters', meaning: 'a bug at 1 in 60 passes every hand-written example' }
            ]
          },
          {
            label: 'The Hungarian dual certificate',
            expr: 'c(i,j) − u(i) − v(j) >= 0 everywhere, = 0 on the chosen cells',
            terms: [
              { sym: 'why it proves optimality', meaning: 'any permutation costs at least the dual total; the chosen one costs exactly it' },
              { sym: 'measured', meaning: '6 workers, costs 1-20: cost 28, 6 phases, 45 comparisons, 0 slack on every chosen cell' },
              { sym: 'against brute force', meaning: 'all 720 permutations agree' }
            ]
          },
          {
            label: 'Greedy on a cost matrix, sizes 3 to 8',
            expr: 'no constant-factor guarantee, and the gap grows',
            terms: [
              { sym: 'optimal', meaning: '20 / 27 / 20 / 28 / 33 / 30' },
              { sym: 'greedy', meaning: '20 / 27 / 30 / 34 / 42 / 51' },
              { sym: 'excess', meaning: '0 / 0 / 10 / 6 / 9 / 21 — up to 70%' },
              { sym: 'work', meaning: 'Hungarian 11 / 25 / 41 / 45 / 111 / 135 comparisons against 6 / 24 / 120 / 720 / 5 040 / 40 320 permutations' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The matching is consistent: match[match[v]] = v and every pair is a real edge',
          why: 'A contraction that is lifted back incorrectly produces exactly this kind of damage.',
          breaks: 'A size that matches a reference while the pairing is broken passes every value-only test.'
        },
        {
          name: 'The size equals an exhaustive search on small graphs',
          why: 'It is the only check that owes nothing to the augmenting-path idea.',
          breaks: 'Without it the 1.7% failure rate is undetectable by any test anyone writes.'
        },
        {
          name: 'Every reduced cost is non-negative and every chosen cell has reduced cost zero',
          why: 'Together they prove optimality without reference to the algorithm.',
          breaks: 'A wrong assignment is a valid permutation with a plausible total and no other tell.'
        },
        {
          name: 'The assignment is a permutation — every row and every column used once',
          why: 'A Hungarian implementation that loses an augmentation returns a partial assignment.',
          breaks: 'The cost then looks unusually good, because a missing row costs nothing.'
        }
      ],
      complexity: [
        { operation: 'Edmonds blossom matching', average: 'O(V³) in the simple form', worst: '1 contraction and 13 edge examinations on the six-vertex fixture' },
        { operation: 'bipartite-style augmentation on a general graph', average: 'O(VE), and WRONG', worst: 'short on 5 of 300 random graphs; the deficit is not bounded' },
        { operation: 'brute force over every pairing', average: 'exponential', worst: 'affordable to about 14 vertices' },
        { operation: 'Hungarian algorithm', average: 'Θ(n³)', worst: '135 comparisons at n = 8, against 40 320 permutations' },
        { operation: 'greedy assignment', average: 'Θ(n²)', worst: 'up to 70% above the optimum, with no bound' },
        { operation: 'dual certificate check', average: 'Θ(n²)', worst: 'cheaper than the algorithm it validates' }
      ],
      failureModes: [
        {
          symptom: 'A matching routine is one edge short, intermittently.',
          cause: 'It uses the bipartite marking rule on a graph containing odd cycles.',
          fix: 'Use a blossom implementation, or verify the graph is bipartite before trusting the answer.'
        },
        {
          symptom: 'A matching bug reproduces in production and not in tests.',
          cause: 'The failure depends on the adjacency order, and the tests build tidy fixtures.',
          fix: 'Shuffle the adjacency lists in the test, and compare against an exhaustive oracle on small inputs.'
        },
        {
          symptom: 'A cost-minimising assignment looks reasonable and is expensive.',
          cause: 'Greedy cell selection, which has no approximation guarantee here.',
          fix: 'Use the Hungarian algorithm; O(n³) is affordable far past the point where greedy stops being close.'
        },
        {
          symptom: 'The Hungarian result costs suspiciously little.',
          cause: 'A lost augmentation left a row unassigned, and an unassigned row costs nothing.',
          fix: 'Assert that the assignment is a permutation before reading its cost.'
        }
      ],
      inTheWild: [
        { system: 'Kidney exchange programmes', how: 'general (non-bipartite) matching, because donors and recipients are one pool' },
        { system: 'Christofides\' TSP approximation', how: 'a minimum-weight perfect matching on the odd-degree vertices' },
        { system: 'Ride and task dispatch', how: 'the assignment problem, usually solved as min-cost flow at scale' },
        { system: 'Tracking and data association', how: 'the Hungarian algorithm links detections to tracks frame by frame' }
      ],
      sources: [
        { title: 'Paths, Trees, and Flowers', where: 'Jack Edmonds — Canadian Journal of Mathematics, 1965' },
        { title: 'The Hungarian method for the assignment problem', where: 'Harold Kuhn — Naval Research Logistics, 1955' },
        { title: 'Algorithms for maximum matching and their complexity', where: 'Micali, Vazirani — FOCS, 1980 — the O(E·sqrt(V)) general algorithm' },
        { title: 'Combinatorial Optimization: Polyhedra and Efficiency', where: 'Alexander Schrijver — Springer, 2003' }
      ]
    },

    'two-sat': {
      summary: 'Clauses as implications, satisfiability as a strongly-connected-component question, ' +
        'the assignment read off the condensation order, and the measured cost of pointing the same ' +
        'machinery at a three-literal clause.',
      intuition: 'Two literals make an implication with a literal on each side. Three leave a ' +
        'disjunction where the arc\'s head should be, and there is no vertex to point at.',
      formulation: {
        equations: [
          {
            label: 'A clause is two arcs',
            expr: '(a ∨ b) ≡ (¬a → b) ∧ (¬b → a)',
            terms: [
              { sym: 'both, always', meaning: 'dropping the contrapositive makes the components meaningless' },
              { sym: 'vertices', meaning: 'one per literal, so n variables give 2n vertices' },
              { sym: 'skew symmetry', meaning: 'reverse every arc and negate every literal and the graph maps to itself' },
              { sym: 'measured', meaning: '8 tasks, 6 conflicts: 12 clauses, 24 implications, 16 vertices, 4 components' }
            ]
          },
          {
            label: 'Satisfiability',
            expr: 'satisfiable iff component(x) != component(¬x) for every variable',
            terms: [
              { sym: 'why', meaning: 'one component means x implies ¬x implies x' },
              { sym: 'the assignment', meaning: 'x is true iff its component comes LATER in reverse topological order' },
              { sym: 'measured', meaning: '5 true and 3 false, breaking 0 of 12 clauses, agreeing with all 256 assignments' },
              { sym: 'one more conflict', meaning: '14 clauses, 28 implications, 7 contradictory variables, 3 components' }
            ]
          },
          {
            label: 'The modelling idioms',
            expr: 'at-most-one is k(k−1)/2 clauses; force is (l ∨ l); implication is a clause already',
            terms: [
              { sym: 'why the quadratic matters', meaning: 'a group of 4 costs 6 clauses; a group of 100 costs 4 950' },
              { sym: 'what fits', meaning: 'two-slot scheduling, two-placement intervals, 2-colouring' }
            ]
          },
          {
            label: 'The satisfiability threshold, 40 variables, 60 instances per row',
            expr: 'the transition is at a ratio of 1 and sharpens with n',
            terms: [
              { sym: 'ratio 0.4 / 0.7 / 0.9 / 1.0', meaning: '100.0% / 98.3% / 98.3% / 95.0% satisfiable' },
              { sym: 'ratio 1.1 / 1.3 / 1.6 / 2.0', meaning: '93.3% / 80.0% / 43.3% / 5.0%' },
              { sym: 'why it matters', meaning: '"tested on random instances" is a statement about which side of 1 the generator sat on' }
            ]
          },
          {
            label: 'Three literals, 10 variables, 100 formulas per row',
            expr: 'the relaxation is sound in one direction and useless in the other',
            terms: [
              { sym: 'wrongly unsatisfiable', meaning: '0 / 11 / 46 / 77 / 93 / 85 at 10 / 15 / 20 / 25 / 30 / 40 clauses' },
              { sym: 'wrongly satisfiable', meaning: '0 in every row — dropping a literal only strengthens the constraint' },
              { sym: 'the boundary', meaning: '2-SAT is in P, 3-SAT is NP-complete, and no encoding closes the gap' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every clause contributes exactly two arcs',
          why: 'The contrapositive is half the clause, not a symmetry to exploit later.',
          breaks: 'The solver reports satisfiable on unsatisfiable formulas — the worst direction to be wrong in.'
        },
        {
          name: 'A satisfiable verdict comes with an assignment that breaks no clause',
          why: 'The graph can be right and the read-out wrong, and the verdict alone hides it.',
          breaks: 'A single unsatisfied clause is indistinguishable from a correct answer without the check.'
        },
        {
          name: 'x and ¬x are in different components for every variable',
          why: 'It is the satisfiability condition itself, and it names the failing variables.',
          breaks: 'A boolean "no" is useless to an operator; the named variables are what they can act on.'
        },
        {
          name: 'A relaxation of a three-literal clause may only be stronger, never weaker',
          why: 'It is what keeps a satisfiable verdict trustworthy.',
          breaks: 'A relaxation that could be weaker would produce a false certificate, which is worthless.'
        }
      ],
      complexity: [
        { operation: '2-SAT by strongly connected components', average: 'Θ(n + m) — one Tarjan pass', worst: '24 implications on 16 vertices for the default instance' },
        { operation: 'building the implication graph', average: 'Θ(m) — two arcs per clause', worst: '12 clauses become 24 arcs, always exactly' },
        { operation: 'reading the assignment', average: 'Θ(n) — one comparison per variable', worst: 'no search and no backtracking' },
        { operation: 'brute-force satisfiability oracle', average: 'Θ(2^n · m)', worst: '256 assignments at 8 variables; unusable past about 22' },
        { operation: 'at-most-one over k literals', average: 'Θ(k²) clauses', worst: '6 clauses for a group of 4; 4 950 for a group of 100' },
        { operation: '3-SAT', average: 'NP-complete', worst: 'no implication encoding exists, and the relaxation is wrong on up to 93% of instances' }
      ],
      failureModes: [
        {
          symptom: 'A 2-SAT solver reports satisfiable on a formula that is not.',
          cause: 'Only one arc per clause was added; the contrapositive was treated as redundant.',
          fix: 'Add both; the components mean nothing without the skew symmetry.'
        },
        {
          symptom: 'The verdict is right and the returned assignment breaks a clause.',
          cause: 'The condensation order was read the wrong way round — Tarjan numbers in reverse.',
          fix: 'Set x true when component(x) is BELOW component(¬x), and check the assignment against the clauses.'
        },
        {
          symptom: 'An encoding of "at most one of these fifty" is enormous.',
          cause: 'Pairwise at-most-one is quadratic in the group size.',
          fix: 'Use an auxiliary-variable encoding, or accept that the model is not 2-SAT shaped.'
        },
        {
          symptom: 'A solver benchmark shows no difference between implementations.',
          cause: 'The random instances were generated far from the satisfiability threshold.',
          fix: 'Sample near a clause-to-variable ratio of 1, and report where you sampled.'
        }
      ],
      inTheWild: [
        { system: 'Type inference and variance checking', how: 'binary constraints between type variables solved as implications' },
        { system: 'Map labelling and layout', how: 'each label has two candidate positions, and overlaps are conflicts' },
        { system: 'Scheduling with two shifts', how: 'the canonical 2-SAT model, and the moment a third shift appears it is gone' },
        { system: 'SAT solver preprocessing', how: 'binary clauses are extracted and closed transitively before the main search' }
      ],
      sources: [
        { title: 'A linear-time algorithm for testing the truth of certain quantified boolean formulas', where: 'Aspvall, Plass, Tarjan — Information Processing Letters, 1979' },
        { title: 'The complexity of theorem-proving procedures', where: 'Stephen Cook — STOC, 1971 — where 3-SAT becomes the boundary' },
        { title: 'Depth-first search and linear graph algorithms', where: 'Robert Tarjan — SIAM J. Computing, 1972' },
        { title: 'Handbook of Satisfiability', where: 'Biere, Heule, van Maaren, Walsh — IOS Press, 2009' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
