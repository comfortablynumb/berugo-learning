/** Concepts for beyond NP, parameterised algorithms and metaheuristics (M20.4-M20.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'beyond-np': [
      {
        term: 'A quantified Boolean formula is the same clauses with a prefix in front',
        plain: 'Put a quantifier on every variable and ask whether the sentence is true.',
        formal: '∃x₁ ∀x₂ ∃x₃ … φ(x₁, x₂, x₃, …), with φ in CNF',
        readAs: 'There exists x-one such that for all x-two there exists x-three, and so on, ' +
          'making the clause set true.',
        detail: 'With every quantifier existential the sentence is exactly SAT, so QBF contains ' +
          'SAT as a special case. Putting a single ∀ anywhere changes it into a different ' +
          'question, and the demo shows the answer flipping while the clauses stay byte for ' +
          'byte the same. That is the cleanest possible demonstration that PSPACE is a different ' +
          'question rather than a bigger one — nothing about the instance grew, and the problem ' +
          'became harder.',
        example: 'At 10 variables and 14 clauses the demo reports TRUE for the all-existential ' +
          'prefix and FALSE for three of the four prefixes containing a ∀.'
      },
      {
        term: 'QBF is a two-player game, which is why it is PSPACE-complete',
        plain: 'The existential player picks the ∃ variables, the universal player picks the ∀ ones, alternating.',
        formal: 'the sentence is true exactly when the existential player has a winning strategy in the move order the prefix names',
        detail: 'Deciding who wins a game is the canonical shape of a PSPACE-complete problem, ' +
          'and generalised chess, go and geography are all in this family for the same reason. ' +
          'The recursion that evaluates a QBF is exactly a minimax search: take the OR over an ' +
          '∃ level and the AND over a ∀ level. Space is what bounds it — the recursion is only ' +
          'as deep as the prefix — while time is exponential, which is the trade PSPACE names.',
        example: 'The demo evaluates ∀x ∃y matching games as trees of 6, 19, 51 and 127 nodes ' +
          'for one to four rounds.'
      },
      {
        term: 'The certificate is what changed, and it is now a strategy',
        plain: 'A true QBF sentence has no short witness; the witness is a function of the opponent’s moves.',
        formal: 'a strategy for k universal variables is a map from 2ᵏ opponent move sequences to your replies',
        readAs: 'A strategy for k universal variables is a table with two-to-the-k entries, one ' +
          'per sequence of opponent moves.',
        detail: 'This is the practical content of the class jump and it is easy to state: a ' +
          'satisfiable SAT instance hands you one line you can check in microseconds, and a true ' +
          'QBF sentence hands you a table exponential in the number of universal variables. ' +
          '"Easy to check" stops being available, so every design that depended on it — logging ' +
          'the certificate, auditing the answer, warm-starting from a previous one — has to be ' +
          'redesigned rather than scaled.',
        example: 'The demo’s four-round matching game is TRUE and its winning strategy has 16 ' +
          'entries; the same clauses with the prefix reversed are FALSE and have none.'
      },
      {
        term: 'Expanding the quantifiers is correct and does not help',
        plain: 'Conjoin one copy of the matrix per assignment of the universal variables.',
        formal: 'the expansion has 2ᵘ copies and 2ᵘ·m clauses for u universal variables and m clauses',
        readAs: 'The expansion has two-to-the-u copies of the matrix and that many times m ' +
          'clauses, for u universal variables and m clauses.',
        detail: 'The construction is straightforward and exactly right: fix the universal ' +
          'variables to each of their assignments in turn, give each copy its own fresh ' +
          'existential variables, and conjoin. The result is one ordinary CNF with the same ' +
          'answer, and it doubles in size for every ∀ added. Twenty universals is a million ' +
          'copies. That is the honest reason "just call a SAT solver" is not a strategy for QBF, ' +
          'and why QBF solvers are a separate field with their own techniques.',
        example: 'The demo’s five prefixes expand to 14, 152, 208, 78 and 264 clauses from the ' +
          'same 14-clause matrix.'
      },
      {
        term: 'One alternation is Σ₂, and it is the shape of a great many real problems',
        plain: '"Find a configuration no adversary can break" is exists-then-forall.',
        formal: 'Σ₂ᴾ = { L : x ∈ L ⟺ ∃y ∀z, V(x, y, z) accepts }, with V polynomial-time',
        readAs: 'The second existential level of the hierarchy holds the languages where x ' +
          'belongs exactly when there is a y such that for every z a polynomial verifier accepts.',
        detail: 'Robust optimisation, minimum equivalent circuit, and "the shortest program with ' +
          'this behaviour" are all this shape. The practical difference from plain optimisation ' +
          'is not the running time: it is that a candidate answer cannot be checked without ' +
          'solving a co-NP problem, so there is no cheap certificate and no incremental progress ' +
          'report. Recognising the ∀ in a requirement is what tells you which of the two you are ' +
          'in, and it is usually visible in the sentence people say out loud.',
        example: 'The demo’s Σ₂ row is the EA prefix: 5 universal variables, FALSE, and 223 ' +
          'evaluation nodes where the all-existential prefix took 37.'
      },
      {
        term: 'The polynomial hierarchy is that pattern repeated, and it probably does not collapse',
        plain: 'k alternating quantifier blocks give the k-th level, and equality of two adjacent levels collapses everything above.',
        formal: 'if Σₖ = Πₖ for any k then PH = Σₖ; P = NP collapses the hierarchy to P',
        readAs: 'If the k-th existential level equals the k-th universal level then the whole ' +
          'hierarchy collapses to that level, and P equalling NP would collapse it all the way ' +
          'down to P.',
        detail: 'The hierarchy is believed to be strict at every level, and the collapse property ' +
          'is what makes that belief load-bearing: a great many results are stated as "unless ' +
          'the polynomial hierarchy collapses", which is a stronger hypothesis than P ≠ NP and ' +
          'is therefore a stronger reason to stop looking for an algorithm. It is also why P = ' +
          'NP is regarded as so implausible — it would flatten an entire infinite tower, not ' +
          'just one containment.',
        example: 'The demo sweeps prefixes with 0, 1, 2 and 3 alternations, showing the answer ' +
          'and the evaluation cost changing with the alternation count rather than with size.'
      },
      {
        term: 'Counting is harder than deciding, and the gap can be enormous',
        plain: '#P asks how many certificates there are, and it is hard even for easy problems.',
        formal: 'counting perfect matchings in a bipartite graph is #P-complete, while finding one is polynomial',
        detail: 'That single example is the one to remember, because it separates the two ' +
          'questions in a case where the decision version is not merely easy but classical: ' +
          'Hopcroft–Karp finds a perfect matching in polynomial time and Valiant proved counting ' +
          'them is as hard as anything in #P. Toda’s theorem then places the entire polynomial ' +
          'hierarchy inside P with one call to a #P oracle. Any requirement that says "how many" ' +
          'rather than "is there" deserves a check that the class did not jump.',
        example: 'The demo’s class table lists #P with "none — the answer is a number, not a ' +
          'witness" in the certificate column, which is what makes it different in kind.'
      },
      {
        term: 'EXPTIME is the one place the tower is known to separate',
        plain: 'P is provably not EXPTIME, and that is the only settled separation in the picture.',
        formal: 'the time hierarchy theorem gives P ⊊ EXPTIME, so at least one containment between them is strict',
        readAs: 'The time hierarchy theorem gives P strictly inside EXPTIME, so at least one of ' +
          'the containments between them must be strict.',
        detail: 'Everything else in the containment diagram — P inside NP, NP inside PH, PH ' +
          'inside PSPACE, PSPACE inside EXPTIME — is known but not known to be strict. The time ' +
          'hierarchy theorem, which is a diagonalisation argument two pages long, is the whole of ' +
          'what is settled. That is worth remembering the next time a containment picture is ' +
          'presented as established fact: the picture is established, and almost none of its ' +
          'gaps are.',
        example: 'The demo’s class table marks EXPTIME as "provably not polynomial", and it is ' +
          'the only row that can say so.'
      }
    ],

    'parameterised-algorithms': [
      {
        term: 'Fixed-parameter tractable means exponential in the parameter, polynomial in the data',
        plain: 'Pick the number that is genuinely small and push all the cost into it.',
        formal: 'a problem is FPT in parameter k when it is solvable in f(k)·n^O(1) for some computable f',
        readAs: 'A problem is fixed-parameter tractable in k when it can be solved in time f of k ' +
          'times a polynomial in n, for some computable function f.',
        detail: 'The promise is about the SHAPE of the cost rather than about the instance, and ' +
          'that is what makes it usable: the algorithm scales with the data and not with the ' +
          'difficulty. In production the parameter is almost always something you control or ' +
          'measure — the number of machines, the number of exceptions to a rule, the size of the ' +
          'answer anybody would accept — so the question "what is the parameter here?" is ' +
          'usually more productive than "how hard is this problem?".',
        example: 'The demo solves vertex cover with a budget of 12 on 20 vertices in 13 search ' +
          'nodes, against 1 048 576 subsets for brute force.'
      },
      {
        term: 'Branching on an edge gives exactly 2ᵏ',
        plain: 'One endpoint of an uncovered edge is in the cover, so branch on both.',
        formal: 'the recursion T(k) = 2·T(k − 1) + O(m) has T(k) = 2^(k+1) − 1 nodes',
        readAs: 'The recursion where each node makes two calls with the budget reduced by one ' +
          'has two-to-the-k-plus-one minus one nodes.',
        detail: 'This is the baseline every other technique is measured against and it is worth ' +
          'implementing once, because it is three lines and it is already fixed-parameter ' +
          'tractable. The measured node count matches the closed form exactly with the reduction ' +
          'rules off, which is what makes it a useful control: any deviation from 2^(k+1) − 1 is ' +
          'something else in the implementation doing work, and knowing that lets the other ' +
          'effects be attributed.',
        example: 'The demo fits a base of 2.0030 over the NO runs and reports 4 095 nodes at the ' +
          'largest budget it can still refute — which is 2¹² − 1.'
      },
      {
        term: 'Branching on a high-degree vertex gives a base below two',
        plain: 'Either the vertex is in the cover, or all of its neighbours are.',
        formal: 'T(k) = T(k − 1) + T(k − d) for a vertex of degree d, giving 1.4656ᵏ under the standard analysis',
        readAs: 'The recursion where one branch drops the budget by one and the other drops it ' +
          'by the vertex degree gives about 1.4656 to the k.',
        detail: 'The second branch is the interesting one: if the vertex is not in the cover then ' +
          'every edge at it must be covered by the other endpoint, so all d neighbours go in at ' +
          'once and the budget drops by d rather than by one. The saving compounds, and the ' +
          'measured difference against edge branching is two orders of magnitude at moderate k. ' +
          'Same problem, same code path, one different choice of what to branch on.',
        example: 'The demo measures 1.4991 for degree branching against 2.0030 for edge ' +
          'branching, and 53 nodes against 4 095 at the same budget.'
      },
      {
        term: 'A reduction rule has to be safe, and safety is a proof',
        plain: '"Take the highest-degree vertex" is not safe; "take any vertex of degree above k" is.',
        formal: 'deg(v) > k ⟹ v is in every cover of size ≤ k, since covering its edges singly costs more than k',
        readAs: 'A vertex whose degree exceeds k must be in every cover of size at most k, ' +
          'because covering its edges one at a time would cost more than k vertices.',
        detail: 'The distinction matters because the unsafe rule sounds more plausible. Taking ' +
          'the highest-degree vertex is a heuristic and the optimum need not contain it; taking ' +
          'any vertex of degree above the remaining budget is forced, and the proof is one line. ' +
          'A rule that is nearly safe produces a smaller cover for an instance that has none, ' +
          'and nothing downstream notices — which is why every rule in this milestone is checked ' +
          'against brute force on every fixture.',
        example: 'The demo’s five methods all return a cover of exactly 12 on the default ' +
          'instance, and each returned cover is checked against the graph itself.'
      },
      {
        term: 'Kernelisation shrinks the instance in polynomial time to a size that depends only on k',
        plain: 'Apply the safe rules to a fixed point; what is left is bounded by k², whatever n was.',
        formal: 'Buss: after the rules, more than k² edges means NO; otherwise ≤ k² edges and ≤ k² + k vertices',
        readAs: 'After the reduction rules, an instance with more than k squared edges is a no; ' +
          'otherwise the kernel has at most k squared edges and k squared plus k vertices.',
        detail: 'The argument is short: every surviving vertex has degree at most k, so a cover ' +
          'of k vertices reaches at most k² edges. The striking part is that this is a ' +
          'polynomial preprocess whose OUTPUT SIZE has nothing to do with the input size, which ' +
          'is a stronger statement than any running-time bound and is what makes kernelisation ' +
          'worth running even when you do not intend to search afterwards.',
        example: 'The demo grows an instance from 46 vertices and 137 edges to 646 and 1 953, ' +
          'and the kernel goes from 13 edges to 14.'
      },
      {
        term: 'A fitted branching base is a property of the tail, not of a window',
        plain: 'The reduction rules cut every node count and make the measured base look worse.',
        formal: 'fitting nodes ≈ c·bᵏ over a window where the preprocessing is still firing inflates b',
        detail: 'The rules fire hardest at small k, because "degree above k" is a common ' +
          'condition when k is small and a rare one when it is large. That flattens the left end ' +
          'of the curve, so the ratio between consecutive points is larger across the measured ' +
          'window even though every point is lower. Reporting only the fitted base would say ' +
          'preprocessing made things worse; reporting only the node counts would hide why the ' +
          'base moved. The honest table has both columns.',
        example: 'The demo measures a base of 2.0030 with the rules off and 3.0163 with them on, ' +
          'while the node count at the smallest budget falls from 127 to 1.'
      },
      {
        term: 'Treewidth is a different parameter: the structure rather than the answer',
        plain: 'A graph that is nearly a tree admits a dynamic program costing 2^(w+1) per bag.',
        formal: 'a tree decomposition of width w gives vertex cover in O(2^w · w · n); computing treewidth exactly is NP-hard',
        readAs: 'A tree decomposition of width w solves vertex cover in time proportional to two ' +
          'to the w times w times n, and finding the smallest width is itself NP-hard.',
        detail: 'The decomposition here comes from a min-degree elimination ordering, which is a ' +
          'heuristic — so the width it reports is an UPPER BOUND and calling it "the treewidth" ' +
          'is the standard overclaim. Which parameter to use is a property of your instances ' +
          'rather than of the problem: road networks and program control-flow graphs have small ' +
          'treewidth and enormous covers, and the reverse is equally common.',
        example: 'The demo finds widths of 3, 4, 6, 7 and 10 on graphs of rising density, giving ' +
          '16 to 2 048 states per bag.'
      },
      {
        term: 'The W-hierarchy is why not every parameter works',
        plain: 'Vertex cover by answer size is tractable; clique by answer size is not believed to be.',
        formal: 'clique parameterised by k is W[1]-hard, so an f(k)·n^O(1) algorithm would collapse W[1] to FPT',
        readAs: 'Clique with the clique size as the parameter is W-one-hard, so an algorithm ' +
          'polynomial in n and arbitrary in k would put all of W-one into the tractable class.',
        detail: 'The parameter is not a free choice. Clique has a trivial n^k algorithm — try ' +
          'every k-subset — and the whole point of fixed-parameter tractability is to get the k ' +
          'out of the exponent on n, which for clique is believed impossible. The hierarchy is ' +
          'the map of which parameterisations are tractable, and consulting it before committing ' +
          'to a parameter saves the effort of looking for an algorithm nobody expects to exist.',
        example: 'Vertex cover and clique are complementary problems on complementary graphs, ' +
          'and one is FPT in the answer size while the other is W[1]-hard in it.'
      }
    ],

    metaheuristics: [
      {
        term: 'A heuristic has no guarantee, which is a precise statement rather than an apology',
        plain: 'An approximation algorithm comes with a proved ratio; a heuristic comes with measurements.',
        formal: 'no bound on cost(heuristic) / cost(optimum) holds for all inputs',
        readAs: 'There is no bound on the ratio between what the heuristic costs and what the ' +
          'optimum costs that holds on every input.',
        detail: 'The consequence is that a heuristic can only be evaluated empirically, which ' +
          'makes the experimental design the whole of its credibility. That is a much heavier ' +
          'obligation than it sounds: the instances, the budget, the seeds and the baseline all ' +
          'have to be stated, because any of them can be chosen to produce whatever ranking the ' +
          'author wanted. A heuristic reported without them is a claim about one experiment ' +
          'nobody can repeat.',
        example: 'The demo runs all eight methods on one instance from one seed under one budget, ' +
          'and reports the budget offered and the budget actually used in separate columns.'
      },
      {
        term: 'The evaluation budget is the comparison, and it must be enforced',
        plain: 'Fix the number of objective evaluations, or you are measuring patience.',
        formal: 'best-so-far as a function of evaluations spent is the comparison; a final value alone is not',
        detail: 'A method that runs longer will usually find something better, so a table of ' +
          'final values ranks the authors rather than the algorithms. Fixing the budget makes ' +
          'the comparison meaningful and plotting best-so-far against evaluations answers the ' +
          'question a production system actually asks — how good is the answer if I stop now. ' +
          'The harness here refuses a run whose methods were given different budgets rather than ' +
          'warning about it, because a warning in a log is not a defence.',
        example: 'The demo offers every method 40 000 evaluations and reports that 2-opt used ' +
          '2 430 of them, 6.1%, before converging.'
      },
      {
        term: 'A move evaluation is a delta, not a fresh costing',
        plain: 'A 2-opt candidate is four table lookups, so charging a full tour costing is wrong by a factor of n.',
        formal: 'Δ = d(a, c) + d(b, d) − d(a, b) − d(c, d) for reversing the segment between two edges',
        readAs: 'The change in tour length is the length of the two edges the move ' +
          'creates, minus the length of the two edges it removes — four table lookups ' +
          'rather than a walk over the whole tour.',
        detail: 'This is the commonest way a budgeted comparison is rigged without anybody ' +
          'intending it. If local search is charged a full O(n) costing per candidate and a ' +
          'population method is charged one per offspring, local search appears n times more ' +
          'expensive than it is and loses every comparison. The unit has to be the same thing ' +
          'for every method — one candidate solution evaluated — and the implementations have to ' +
          'be written to make that true.',
        example: 'The demo’s or-opt uses a six-term delta rather than a recosting for exactly ' +
          'this reason, and its move count is then comparable with 2-opt’s.'
      },
      {
        term: 'Every metaheuristic is one answer to "what do I do at a local optimum"',
        plain: 'That is the only axis on which they differ.',
        formal: 'annealing accepts Δ > 0 with probability e^(−Δ/T); tabu forbids reversing a recent move for t iterations',
        readAs: 'Annealing accepts a worsening move with probability e to the minus delta over ' +
          'temperature; tabu search forbids undoing a recent move for a fixed number of ' +
          'iterations.',
        detail: 'Reading the zoo that way turns forty named methods into four ideas: go uphill ' +
          'with decreasing probability, go uphill deliberately and forbid coming straight back, ' +
          'recombine two solutions in the hope of landing in a third basin, or start again ' +
          'somewhere else. Ant colony is the one genuine outlier, because its memory is in the ' +
          'edges rather than in any solution, so it rebuilds rather than edits.',
        example: 'The demo’s comparison table names the escape mechanism for each of the eight ' +
          'methods in its last column.'
      },
      {
        term: 'A cooling schedule must be derived from the budget',
        plain: 'A rate tuned for a million evaluations is a random walk when given a thousand.',
        formal: 'a geometric schedule with T_final = T₀·fall needs cooling = fall^(1/steps)',
        readAs: 'For the temperature to fall by a chosen factor over a given number of steps, ' +
          'the per-step rate is that factor raised to one over the step count.',
        detail: 'If the temperature never falls far enough the acceptance probability stays near ' +
          'one, every move is taken, and the search is a random walk that returns whatever it ' +
          'started from. That was measured here before the schedule was made budget-aware: ' +
          'annealing came back with exactly the nearest-neighbour tour it began with, at every ' +
          'budget under a few thousand. At the other end, temperature zero makes the acceptance ' +
          'test Δ < 0 and annealing IS hill climbing.',
        example: 'The demo’s cooling sweep runs 0.00, 2.61, 13.06 and 52.23 as starting ' +
          'temperatures, giving tours of 513.39, 486.03, 489.28 and 486.03.'
      },
      {
        term: 'Order crossover exists because the obvious crossover produces invalid tours',
        plain: 'Cut two permutations and swap halves, and the child visits some cities twice and others never.',
        formal: 'OX: copy a slice of parent A, fill the remaining positions in parent B’s order, skipping what is present',
        detail: 'Encoding and repair are where a genetic algorithm’s real cost lives, and they ' +
          'are the part the biological metaphor does not mention. Any representation with a ' +
          'constraint — a permutation, a tree, a schedule with precedence — needs an operator ' +
          'designed to preserve it, and designing one is most of the work of applying a GA to a ' +
          'new problem. A repair pass instead of an operator is legal and usually dominates the ' +
          'runtime.',
        example: 'The demo’s genetic algorithm reaches 552.96 against a best of 481.52 — the ' +
          'weakest method in the table on this instance.'
      },
      {
        term: 'GRASP is the control every comparison needs',
        plain: 'Restart a randomised greedy construction and run local search on each one.',
        formal: 'greedy with a random choice among the α best candidates, then local search, repeated until the budget is gone',
        readAs: 'A greedy construction that picks randomly among the alpha best candidates at ' +
          'each step, followed by local search, repeated until the budget runs out.',
        detail: 'It has no memory, no population and no parameters worth tuning beyond α, so any ' +
          'method that cannot beat it is not paying for its own sophistication. Including it is ' +
          'the single cheapest way to make a metaheuristic comparison honest, and on the demo’s ' +
          'instances it ties for first place — which is exactly the result a paper proposing a ' +
          'new method would have no reason to report.',
        example: 'The demo’s GRASP reaches 481.52, tying with 2-opt for the best tour under the ' +
          '40 000-evaluation budget.'
      },
      {
        term: 'The ranking changes with the budget, which is why a budget-free claim says nothing',
        plain: 'Local search wins early and stops; the sampling methods keep improving.',
        formal: 'a method that converges has a flat best-so-far curve after convergence; one that samples does not',
        detail: 'A converged local search cannot use the rest of the budget at all — there is no ' +
          'improving move to evaluate — so its curve is flat from the moment it stops. Annealing ' +
          'and tabu are still sampling at the end of every budget in the demo, and they overtake ' +
          'at the largest one. Any single row of that table is true and none of them is ' +
          'informative on its own, which is precisely why the budget belongs in the claim.',
        example: 'At 2 000 evaluations the demo’s winner is 2-opt at 489.02; at 160 000 the ' +
          'winner is simulated annealing, with four methods tied at 481.52.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
