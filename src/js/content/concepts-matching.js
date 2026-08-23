/** Concepts for general matching and 2-SAT (M14.6-M14.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'general-matching': [
      {
        term: 'The bipartite argument depends on two-colourability, and nothing else',
        plain: 'Every alternating walk goes left, right, left, right — so a vertex reached once need never be reached again.',
        formal: 'in a bipartite graph, the parity of a walk\'s length determines which side it is on',
        detail: 'That is why Kuhn can mark each right vertex once per search and still be correct: ' +
          'any alternating continuation from a vertex is determined by which side it is on, and the ' +
          'side is determined by the parity of the distance from the root. Remove bipartiteness and ' +
          'the parity stops being well defined, because a vertex on an odd cycle is reachable at ' +
          'both parities. Every consequence in this section follows from that one sentence, and so ' +
          'does the fact that colouring, independent set and vertex cover are all easy on bipartite ' +
          'graphs and hard in general.',
        example: 'The six-vertex counter-example has two triangles; marking each vertex once returns ' +
          'a matching of 2 where the answer is 3.'
      },
      {
        term: 'A blossom is an odd cycle the search enters on one side and must leave on the other',
        plain: 'The search reaches the same vertex at both parities, and a marking search refuses to go back in.',
        formal: 'an edge joining two vertices at even distance from the root closes an odd cycle',
        readAs: 'In the alternating search tree, an edge between two even-depth vertices completes a cycle of ' +
          'odd length — a blossom. Bipartite graphs have no odd cycles, which is exactly why they never ' +
          'need this machinery.',
        detail: 'The even-even edge is the detection rule and it is exact: in a tree of alternating ' +
          'paths, an edge between two even-level vertices closes a cycle of odd length, because the ' +
          'two paths to the root have even lengths and the closing edge adds one. Everything inside ' +
          'that cycle can be reached at either parity depending on which way round you go, so the ' +
          'one-mark-per-vertex rule throws away exactly the alternative that the augmenting path ' +
          'needed.',
        example: 'The counter-example contracts 1 blossom over 3 augmenting paths, at 13 edge ' +
          'examinations.'
      },
      {
        term: 'Contraction makes the blossom a single vertex, and the path lifts back',
        plain: 'Shrink the odd cycle to one pseudo-vertex, search again, then expand and rearrange the matching inside it.',
        formal: 'G has an augmenting path iff G with a blossom contracted has one (Edmonds, 1965)',
        readAs: 'Squash the whole odd cycle into a single vertex and the question is unchanged: a path exists ' +
          'in one exactly when it exists in the other. That is what makes general matching tractable at ' +
          'all.',
        detail: 'The theorem is the licence to do something that looks like cheating: a whole cycle ' +
          'becomes one vertex, the search continues in a smaller graph, and the path found there ' +
          'corresponds to a real path in the original. The rearrangement inside the blossom is ' +
          'always possible because an odd cycle with one exposed vertex can be matched in either ' +
          'direction around the ring. This was the first algorithm ever argued to be polynomial in ' +
          'the modern sense — the paper is where "good algorithm" as a synonym for polynomial time ' +
          'comes from.',
        example: 'Edmonds returns 3 on the six-vertex graph after 1 contraction; brute force over ' +
          'every pairing agrees.'
      },
      {
        term: 'The shortcut is wrong on about one graph in thirty, which is why it survives',
        plain: 'Bipartite-style augmentation on a general graph returns a valid matching that is sometimes one edge short.',
        formal: 'no approximation ratio: the deficit is unbounded in principle and small in practice',
        detail: 'A bug that fires on 1.7% of inputs produces a service that is correct on every ' +
          'example anybody types by hand, passes every unit test written from those examples, and ' +
          'quietly under-allocates in production. It cannot be found by property testing unless the ' +
          'property is "equals an independent maximum" — and computing that independent maximum is ' +
          'the hard part, which is precisely why nobody writes the test. The only defence is an ' +
          'exhaustive oracle on small inputs, run deliberately.',
        example: 'Over 300 random graphs at five densities the naive search is short on 5 — 1.7%.'
      },
      {
        term: 'The failure depends on the neighbour order, on the very same graph',
        plain: 'Sort each adjacency list ascending and the wrong algorithm becomes right, with no edge changed.',
        formal: 'the reachability of the augmenting path depends on the order the depth-first search examines neighbours',
        detail: 'This is the most uncomfortable fact in the section and the most useful. The graph ' +
          'is fixed; the edges are fixed; only the order in which the adjacency lists happen to be ' +
          'built changes, and the answer changes with it. That means a test suite that builds its ' +
          'fixtures in a convenient order — sorted, or in insertion order from a tidy literal — will ' +
          'never see the failure, and a production system whose adjacency comes out of a hash map ' +
          'will see it intermittently.',
        example: 'The same eight edges: as found the naive search returns 2 examining 13 edges, ' +
          'sorted ascending it returns 3 examining 6.'
      },
      {
        term: 'Weighted matching is a different question with a different answer',
        plain: 'Not the largest set of pairs but the cheapest perfect one.',
        formal: 'the assignment problem: minimise sum of c(i, sigma(i)) over permutations sigma',
        detail: 'Maximum-cardinality and minimum-weight matching are so often conflated that it is ' +
          'worth stating the difference in one line: the first asks how many pairs, the second ' +
          'assumes everyone is paired and asks how much it costs. On a complete bipartite graph the ' +
          'first is trivial and only the second is interesting. The Hungarian algorithm solves the ' +
          'second in O(n³), and it is worth knowing that it is min-cost flow specialised rather ' +
          'than a separate invention.',
        example: 'Six workers and six tasks with costs from 1 to 20: the cheapest assignment costs ' +
          '28, against 720 permutations.'
      },
      {
        term: 'The potentials are a certificate, not bookkeeping',
        plain: 'One number per row and per column, such that no cell is below their sum and every chosen cell equals it.',
        formal: 'c(i,j) − u(i) − v(j) >= 0 for all i,j, with equality on the chosen cells',
        readAs: 'Every cell\'s cost, less the two potentials, must stay non-negative — and the cells you ' +
          'actually chose must sit exactly at zero. Those two conditions together are a certificate ' +
          'that the assignment is optimal.',
        detail: 'Those two conditions together prove optimality without mentioning the algorithm ' +
          'that produced them. Any permutation costs at least the sum of all the potentials, ' +
          'because each of its cells is at least its own two potentials; the chosen permutation ' +
          'costs exactly that; therefore it is minimum. That is a proof a reviewer can check in a ' +
          'minute against a table of numbers, and it is the reason this section checks the ' +
          'certificate rather than comparing against a second implementation.',
        example: 'On the default matrix every chosen cell has reduced cost exactly 0 and no cell ' +
          'anywhere is negative.'
      },
      {
        term: 'Greedy on a cost matrix is not an approximation, it is a different algorithm',
        plain: 'Taking the cheapest remaining cell each time is wrong by a margin that does not shrink.',
        formal: 'greedy assignment has no constant-factor guarantee for the minimisation problem',
        detail: 'The intuition that "greedy is roughly right" comes from problems where it has a ' +
          'proof — the minimum spanning tree, fractional knapsack — and the assignment problem is ' +
          'not one of them. Taking the cheapest cell in row 1 can force an expensive cell in row 6, ' +
          'and nothing bounds how expensive. Because the answer is still a valid permutation with a ' +
          'plausible total, it looks like a reasonable approximation right up until somebody ' +
          'computes the optimum.',
        example: 'At six workers greedy pays 34 against the optimal 28 — 21.4% more — and at eight ' +
          'it pays 51 against 30, which is 70% more.'
      }
    ],

    'two-sat': [
      {
        term: 'A two-literal clause is an implication in both directions',
        plain: '(a OR b) says that if a is false then b must hold, and if b is false then a must hold.',
        formal: '(a ∨ b) ≡ (¬a → b) ∧ (¬b → a)',
        readAs: '"a or b" is the same statement as "if not a then b, and if not b then a". The ∨ is or, ¬ is ' +
          'not, ∧ is and, and ≡ means the two sides say the identical thing. Rewriting every clause ' +
          'this way turns the formula into a graph.',
        detail: 'Both arcs go in, always. The contrapositive is not an optimisation or a symmetry to ' +
          'exploit later — it is half the clause, and a graph built with only the first arc has ' +
          'components that no longer correspond to the formula. The solver then reports satisfiable ' +
          'on formulas that are not, which is the worst possible direction for a satisfiability ' +
          'checker to be wrong in, because the caller acts on the answer.',
        example: 'The default scheduling instance turns 12 clauses into 24 implications, exactly two ' +
          'per clause.'
      },
      {
        term: 'One vertex per literal, so a variable is two vertices',
        plain: 'x and not-x are separate vertices, and the graph is skew-symmetric.',
        formal: 'reversing every arc and negating every literal maps the implication graph to itself',
        detail: 'The doubling is what makes the method work, and the skew symmetry is what makes it ' +
          'provable. Because the graph is its own mirror under negate-and-reverse, a path from x to ' +
          'not-x guarantees a path from x back again through the mirror image — which is exactly the ' +
          'statement that x and not-x are in the same strongly connected component. The whole ' +
          'algorithm is one structural observation about a graph you build in three lines.',
        example: '8 variables make 16 vertices; on the default instance they fall into 4 components.'
      },
      {
        term: 'Unsatisfiable is exactly "some variable shares a component with its own negation"',
        plain: 'If x implies not-x and not-x implies x, no assignment survives.',
        formal: 'the formula is satisfiable iff component(x) != component(¬x) for every variable x',
        readAs: 'The formula is solvable exactly when no variable and its own negation end up in the same ' +
          'strongly connected component — because being in one component means each implies the other, ' +
          'so the variable would have to be both true and false.',
        detail: 'The forward direction is easy: if the two are in one component then each implies ' +
          'the other, so both values lead to a contradiction. The converse — that separate ' +
          'components always admit an assignment — is where the condensation order comes in, and it ' +
          'is constructive rather than merely existential. What makes this valuable in practice is ' +
          'that the failing variables are *named*: a general SAT solver mostly returns "no", and ' +
          'this returns "no, because of these three".',
        example: 'Adding one more conflict to the default instance puts 7 variables in a component ' +
          'with their own negation, and the component count collapses from 4 to 3.'
      },
      {
        term: 'The assignment is read off the condensation order, with no search at all',
        plain: 'Set x true exactly when its component comes later in the reverse topological order.',
        formal: 'Tarjan numbers components in reverse topological order, so x is true iff component(x) < component(¬x)',
        readAs: 'The component numbering already encodes the answer: whichever of x and not-x sits later in ' +
          'the implication order is the one to make true. No extra pass is needed.',
        detail: 'This is the step people expect to be a search and is not. Choosing the later ' +
          'component means no implication ever points from a true literal to a false one, which is ' +
          'precisely the condition for satisfying every clause. There is no backtracking, no unit ' +
          'propagation and no restart — one linear pass produces the components and one more pass ' +
          'reads the answer. The index convention is the only trap: Tarjan\'s numbering runs ' +
          'backwards, so "later" means a smaller number.',
        example: 'The default instance assigns 5 variables true and 3 false, and the assignment ' +
          'breaks 0 of its 12 clauses.'
      },
      {
        term: 'The modelling idioms are what make it useful',
        plain: 'At-most-one is a clause per pair; forcing a literal is (l OR l); an implication is a clause already.',
        formal: 'at-most-one over k literals costs k(k−1)/2 clauses, which is why large groups need a different encoding',
        readAs: 'Saying "at most one of these k is true" pairwise needs a clause for every pair — about half ' +
          'of k squared. At k = 100 that is nearly five thousand clauses for one constraint.',
        detail: 'Most real uses of 2-SAT are recognition problems: noticing that a scheduling ' +
          'question with two slots, an interval-selection question with two placements each, or a ' +
          'two-colouring question is already this shape. The quadratic cost of at-most-one is the ' +
          'main practical limit, and it is why encodings with auxiliary variables exist — but a ' +
          'group of four costs six clauses and nobody needs to be clever about that.',
        example: 'Eight tasks with 6 pairwise conflicts become 12 clauses and 24 implications.'
      },
      {
        term: 'Random instances have a satisfiability threshold, and benchmarks live on it',
        plain: 'Below about one clause per variable almost everything is satisfiable; above it, almost nothing.',
        formal: 'for random 2-SAT the threshold is at m/n = 1, and the transition sharpens as n grows',
        detail: 'The practical consequence is about testing rather than about theory. "We evaluated ' +
          'the solver on random instances" is a statement about which side of the ratio the ' +
          'generator sat on: well below it, every instance is satisfiable for structural reasons and ' +
          'the solver barely works; well above, every instance contains an obvious contradiction. ' +
          'The instances that discriminate between implementations are the ones near the threshold, ' +
          'and a benchmark that does not say where it sampled has not said anything.',
        example: 'At 40 variables the satisfiable rate falls from 100% at 0.4 clauses per variable ' +
          'to 5% at 2.0, passing 95% at exactly 1.0.'
      },
      {
        term: 'A three-literal clause has no implication encoding',
        plain: 'Not-a implies b-or-c, and a disjunction is not a vertex.',
        formal: '2-SAT is in P; 3-SAT is NP-complete (Cook, 1971)',
        detail: 'This is the cleanest visible boundary between tractable and intractable in the ' +
          'whole curriculum, and it is one literal wide. The implication graph works because a ' +
          'two-literal clause has exactly one antecedent and one consequent, both single literals. ' +
          'Three literals leave a disjunction on the right-hand side, and there is no vertex to ' +
          'point the arc at. No encoding trick repairs this: if one existed, P would equal NP.',
        example: 'The nearest thing to an encoding is to drop a literal, which makes the constraint ' +
          'strictly stronger.'
      },
      {
        term: 'The relaxation is safe in one direction and useless in the other',
        plain: 'Dropping a literal can only make a formula harder to satisfy, so "satisfiable" is trustworthy and "unsatisfiable" is not.',
        formal: 'if the 2-SAT relaxation is satisfiable then so is the 3-SAT original; the converse fails constantly',
        readAs: 'Dropping a literal from every clause makes the problem easier, so a solution to the harder ' +
          'original still solves the relaxation. The reverse does not follow — which is why this is a ' +
          'filter and not a solver.',
        detail: 'Being wrong in only one direction is the useful property of a relaxation and the ' +
          'reason they are worth building at all: a positive answer is a genuine certificate. The ' +
          'measurement is what turns that from a formal remark into engineering advice — at twenty ' +
          'three-literal clauses over ten variables the relaxation reports "unsatisfiable" on 46 of ' +
          '100 satisfiable formulas. A filter that rejects nearly half of the valid inputs is not a ' +
          'filter, and only counting shows that.',
        example: 'Across clause counts 10 to 40 the relaxation is wrongly negative on 0, 11, 46, ' +
          '77, 93 and 85 of 100 — and wrongly positive on 0 in every row.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
