/** Concepts for the structured-search paradigm sections (M11.4-M11.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    matroids: [
      {
        term: 'An independence system',
        plain: 'A ground set, and a family of subsets called independent that is closed downwards.',
        formal: '(E, I) with I ⊆ 2^E, ∅ ∈ I, and A ⊆ B ∈ I implying A ∈ I',
        readAs: 'A matroid is a ground set E plus a collection I of its subsets, called ' +
          'independent. 2^E means "all possible subsets of E", so I is some of them. Two rules: ' +
          'the empty set is always independent, and any subset of an independent set is ' +
          'independent too. You can always throw things away.',
        detail: [
          'This is the weakest structure worth naming, and almost every feasibility notion ' +
            'satisfies it: acyclic edge sets, matchings, subsets under a size cap, sets respecting ' +
            'a quota.',
          'Being hereditary is what makes "extend the current set" a sensible move at all. It ' +
            'guarantees that nothing you have already committed to becomes infeasible on its own.',
          'It is not enough to make greedy correct, which is exactly why the second property is ' +
            'the interesting one.'
        ],
        example: 'Matchings in a graph are hereditary: removing an edge from a matching leaves a matching.'
      },
      {
        term: 'The exchange property',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a larger independent set"] --> B["can always donate one element<br/>to a smaller one"]',
            '    B --> C["and the smaller one<br/>stays independent"]',
            '    C --> D["so a small set is never stuck"]',
            '    D --> E["which is exactly why greedy<br/>cannot paint itself into a corner"]'
          ].join('\n'),
          caption: 'This one property is what makes greedy provably optimal. Where it fails, greedy fails — and the failure is a valid answer that is simply not the best one.'
        },
        plain: 'A larger independent set can always donate an element to a smaller one.',
        formal: 'A, B ∈ I with |A| < |B| implies there is x ∈ B \\ A with A ∪ {x} ∈ I',
        readAs: 'The exchange property. Take one independent set smaller than another. You can ' +
          'always find something in the bigger one that is not in the smaller one — the backslash ' +
          'is "minus". Add it to the smaller one and that set is still independent. This is what ' +
          'stops greedy painting itself into a corner.',
        detail: [
          'This is the property that stops greedy from painting itself into a corner. It says a ' +
            'smaller independent set is never stuck: whatever it has committed to, something in a ' +
            'larger set can still be added.',
          'Two consequences follow immediately. Every maximal independent set has the same size, ' +
            'and the greedy prefix can always be extended to something at least as large as any ' +
            'rival.',
          'The failure of this one property is the whole difference between Kruskal being a ' +
            'theorem and being a heuristic.'
        ],
        example: 'For matchings on a three-edge path, the single middle edge cannot be extended from the two ' +
          'outer edges — the exchange property fails on four elements.'
      },
      {
        term: 'The Rado-Edmonds theorem',
        plain: 'Greedy is optimal for every weighting if and only if the independence system is a matroid.',
        formal: 'greedy finds a maximum-weight basis for all weight functions ⇔ (E, I) satisfies the exchange property',
        readAs: 'Greedy works for every possible set of weights exactly when the structure is a ' +
          'matroid, and the "exactly when" runs both ways. So if greedy fails on even one ' +
          'weighting the structure is not a matroid — and if it is a matroid, greedy can never ' +
          'fail.',
        detail: [
          'The theorem turns "does greedy work here?" from an argument into a check, and it is an ' +
            'if-and-only-if, which makes it useful in both directions.',
          'If the structure is a matroid, no weighting can defeat greedy and no proof needs ' +
            'writing.',
          'If it is not, some weighting does defeat greedy. A greedy implementation is then a bug ' +
            'waiting for the right data, rather than an approximation with a known ratio.',
          'The forward direction is the useful one in design; the contrapositive is the useful one ' +
            'in review.'
        ],
        example: 'Acyclic edge sets form a matroid, so Kruskal is optimal on every weighting; matchings do ' +
          'not, and weights 2, 3, 2 on a three-edge path defeat greedy.'
      },
      {
        term: 'The independence oracle',
        plain: 'The algorithm never inspects the structure — it only asks "is this set still independent?".',
        formal: 'greedy(E, oracle, w): sort E by w descending; keep x when oracle(kept ∪ {x}) holds',
        readAs: 'The entire algorithm: sort by weight, then take each element if adding it to what ' +
          'you have kept is still allowed. The ∪ is "together with". Everything difficult is ' +
          'inside the oracle.',
        detail: [
          'Writing greedy against an oracle rather than against a graph is what makes the ' +
            'abstraction pay.',
          'The same twelve lines become Kruskal, a scheduling algorithm with deadlines, or a ' +
            'quota-respecting selection, purely by changing the oracle.',
          'It also makes the cost model explicit. The algorithm makes exactly |E| oracle calls, ' +
            'and whether the whole thing is fast depends entirely on how fast one call is. Kruskal ' +
            'is fast because union-find answers it in near-constant time.'
        ],
        example: 'Greedy with an acyclicity oracle on eight edges makes eight calls and returns the ' +
          'maximum-weight forest, weight 46 — the same answer as enumerating all 62 independent sets.'
      },
      {
        term: 'Checking is exponential and worth it once',
        plain: 'Verifying a matroid by enumeration costs 2^n oracle calls, on a model, once.',
        formal: 'enumerate I over 2^E, then search all pairs (A, B) with |A| < |B| for a failure of exchange',
        detail: [
          'The checker is not a subroutine and does not need to be fast.',
          'It is a tool for settling an argument about a ten-element model of a structure, before ' +
            'that structure is built into a system. At that size 2^n is a thousand calls.',
          'What matters is that it returns the violating pair rather than a verdict. A boolean can ' +
            'be disputed; a concrete pair of sets where the exchange fails ends the discussion, ' +
            'and doubles as the first regression test.'
        ],
        example: 'A ground set of eight edges costs 256 oracle calls and reports 62 independent sets, which ' +
          'is a fraction of a second.'
      },
      {
        term: 'Uniform and partition matroids',
        plain: '"At most k of anything" and "at most k_i from each group" are both matroids.',
        formal: 'uniform: I = {A : |A| <= k}; partition: I = {A : |A ∩ E_i| <= k_i for each block E_i}',
        readAs: 'Two of the simplest matroids. Uniform: any set of at most k things is ' +
          'independent. Partition: at most k_i things from each block. The colon reads "such ' +
          'that", and the bars are "how many".',
        detail: [
          'These two cover a surprising amount of practical scheduling and selection.',
          'Any problem that reads "choose the highest-value items subject to a cap, or to a cap ' +
            'per category" is a matroid. So sorting by value and taking greedily is provably ' +
            'optimal, and needs no further argument.',
          'Recognising them is worth more than the theory. They are the cases where an engineer\'s ' +
            'instinct to sort and take is right, and knowing why means not reaching for a solver.'
        ],
        example: 'Selecting the most valuable articles for a front page with at most three per section is a ' +
          'partition matroid, so the obvious greedy selection is optimal.'
      },
      {
        term: 'Matroid intersection, and the cliff after it',
        plain: 'Two matroids at once is still polynomial; three is NP-hard.',
        formal: 'max |A| with A independent in both M₁ and M₂ is in P (Edmonds); for three matroids it is NP-hard',
        readAs: 'Finding the largest set independent in two matroids at once is solvable in ' +
          'polynomial time. Add a third and it becomes NP-hard — one of the sharpest easy-to-hard ' +
          'boundaries in the subject.',
        detail: [
          'The boundary is worth carrying because it is so close.',
          'Feasible sets that must satisfy two independent structural constraints remain ' +
            'tractable, though no longer by greedy. A bipartite matching is one partition matroid ' +
            'intersected with another, and the algorithm becomes an augmenting-path search.',
          'Add a third constraint and the problem becomes NP-hard, which includes ' +
            'three-dimensional matching. So "my constraints are all matroids" is good news exactly ' +
            'twice.'
        ],
        example: 'Bipartite matching is the intersection of two partition matroids, one per side, and is ' +
          'solved by augmenting paths rather than by greedy.'
      },
      {
        term: 'When the structure is not a matroid',
        plain: 'Greedy becomes a heuristic with, at best, a known approximation ratio.',
        formal: 'for a k-system, greedy is a 1/k-approximation; for submodular maximisation under a cardinality constraint, 1 − 1/e',
        readAs: 'When the structure is not quite a matroid you still get a guarantee, just a ' +
          'weaker one: at least 1/k of the best possible. For submodular objectives the guarantee ' +
          'is 1 − 1/e, about 63%, and that figure is provably the best any efficient algorithm can ' +
          'promise.',
        detail: [
          'A negative answer from the checker is not the end of greedy. It is the end of greedy as ' +
            'an exact algorithm.',
          'Weaker structures still support guarantees. Independence systems where every ' +
            'maximal set is within a factor k of every other give greedy a 1/k ratio. Monotone ' +
            'submodular objectives under a cardinality constraint give the famous 1 − 1/e.',
          'The point is that the guarantee changes from "optimal" to "within a factor". A system ' +
            'that reports an exact answer must not be built on the second kind.'
        ],
        example: 'Greedy on matchings weighted 2, 3, 2 returns 3 where the optimum is 4 — a ratio of 0.75, ' +
          'and the worst case for that structure is 0.5.'
      }
    ],

    backtracking: [
      {
        term: 'Choose, explore, unchoose',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["choose — make the assignment"] --> B["explore — recurse"]',
            '    B --> C["unchoose — undo the assignment"]',
            '    C --> D["try the next option"]',
            '    D --> A',
            '    C --> E["forget this line and every<br/>sibling branch sees corrupted state"]'
          ].join('\n'),
          caption: 'The third line is the one that gets left out, and its absence does not crash — it silently leaks one branch\'s decisions into the next.'
        },
        plain: 'The whole paradigm is three lines, and the third is where the bugs are.',
        formal: 'for each value v of variable x: assign(x, v); if consistent then recurse; unassign(x, v)',
        detail: [
          'Backtracking is exhaustive search that reuses one mutable state instead of building a ' +
            'new one per node. That is why it is fast, and why it is fragile.',
          'Everything mutated on the way down has to be restored exactly on the way up. A ' +
            'forgotten restore does not raise. The search continues with a state that no longer ' +
            'describes the path it is on, and returns a wrong set of solutions that looks entirely ' +
            'plausible.',
          'The discipline that survives refactoring is to make the undo consume a record produced ' +
            'by the do, rather than recompute what should have changed.'
        ],
        example: 'Propagation here returns the list of cells it filled, and the caller empties exactly those ' +
          '— no code anywhere recomputes which cells "ought" to be cleared.'
      },
      {
        term: 'Minimum remaining values',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["which variable should<br/>we branch on next?"] --> B["the one with the fewest<br/>legal values left"]',
            '    B --> C["fewest branches to try"]',
            '    B --> D["and the soonest to hit a<br/>contradiction if there is one"]',
            '    D --> E["fail early, fail small"]'
          ].join('\n'),
          caption: 'Branching on the most constrained variable finds the dead ends while the subtree beneath them is still tiny. It is the cheapest ordering heuristic there is.'
        },
        plain: 'Branch on the variable with the fewest legal values left.',
        formal: 'select argmin over unassigned x of |domain(x)|; ties broken by degree or by index',
        readAs: '"argmin" means "the variable that minimises this". Pick whichever unassigned ' +
          'variable has the fewest values left to try, so failures surface as early and as cheaply ' +
          'as possible.',
        detail: [
          'The argument is simple. A variable with two options doubles the tree, and one with nine ' +
            'multiplies it by nine. Taking the small one first keeps the tree narrow near the top ' +
            'and finds dead ends immediately.',
          'It is the single most valuable heuristic in constraint search, and it is not free.',
          'Computing it means asking every unassigned variable how many values it has left, at ' +
            'every node. That is why real solvers maintain domains incrementally rather than ' +
            'recomputing them.'
        ],
        example: 'On Inkala\'s puzzle MRV takes 49 559 nodes down to 10 102, while doing more work at each ' +
          'of them.'
      },
      {
        term: 'Forward checking',
        plain: 'After an assignment, check that nothing has been left with no options.',
        formal: 'after assigning x = v, fail immediately if any unassigned y has domain(y) = ∅',
        readAs: 'After each assignment, check whether any other variable has run out of options — ' +
          'the ∅ is the empty set. If one has, backtrack now, rather than discovering it several ' +
          'levels deeper.',
        detail: [
          'This is the cheapest form of lookahead: one scan of the remaining variables, rejecting ' +
            'the branch as soon as any of them is stuck.',
          'It catches failures one level earlier than plain consistency checking. That sounds ' +
            'small, and it is worth a constant factor rather than an order of magnitude on most ' +
            'instances.',
          'Its real value is as the floor under propagation. It is what makes the domains worth ' +
            'maintaining at all, and once they are maintained the stronger inference is nearly ' +
            'free.'
        ],
        example: 'Forward checking takes Inkala\'s puzzle from 10 102 nodes to 9 180 — real, and an order of ' +
          'magnitude less than propagation buys.'
      },
      {
        term: 'Constraint propagation to a fixed point',
        plain: 'Fill in everything the last assignment forces, repeatedly, before guessing again.',
        formal: 'iterate: any variable with a singleton domain is assigned, shrinking its neighbours, until nothing changes',
        detail: [
          'Propagation is qualitatively different from checking. It makes deductions rather than ' +
            'testing them, and a single assignment can cascade into dozens of forced ones.',
          'That is why it moves the node count by an order of magnitude, where forward checking ' +
            'moves it by a fraction.',
          'The cost is a full sweep per node and, in a real solver, careful bookkeeping so the ' +
            'undo is exact. Every cell it fills has to be recorded, because those cells were not ' +
            'chosen and nothing else knows they were filled.'
        ],
        example: 'Propagation takes Inkala from 9 180 nodes to 929, a factor of ten, with 39 059 forced ' +
          'assignments along the way on the harder instance.'
      },
      {
        term: 'A heuristic is a bet about the instance distribution',
        plain: 'MRV is an enormous help on four of these five puzzles and a disaster on the fifth.',
        formal: 'no variable-ordering heuristic dominates: for any ordering there are instances where another is exponentially better',
        detail: [
          'This is the reason the section shows a matrix rather than a row.',
          'Heuristics are chosen because they win on the instances people actually solve, not ' +
            'because they win always. The instances where they lose are constructible.',
          'Presenting a heuristic with a single benchmark number, or with a benchmark suite that ' +
            'shares a structure, hides exactly the case that will eventually arrive. The honest ' +
            'presentation is the distribution, including the row where the ranking inverts.'
        ],
        example: 'On "platinum blonde" the first-empty-cell order finishes in 419 195 nodes and MRV does not ' +
          'finish inside 500 000.'
      },
      {
        term: 'Iterative deepening',
        plain: 'Repeated depth-limited searches cost barely more than the deepest one and need no queue.',
        formal: 'sum over d of b^d = b^D · (1 + 1/b + 1/b² + …) ≈ b^D · b/(b−1)',
        readAs: 'Adding up the nodes at every level of a tree comes to only a constant factor more ' +
          'than the bottom level alone, because each level up is b times smaller. At b = 10 the ' +
          'whole tree is about 1.11 times its last level, which is why iterative deepening costs ' +
          'so little.',
        detail: [
          'Depth-first search uses memory proportional to the depth, and can fall down an infinite ' +
            'branch. Breadth-first finds the shallowest answer, and uses memory proportional to ' +
            'the frontier.',
          'Iterative deepening takes both properties by re-running the depth-first search with an ' +
            'increasing limit.',
          'The apparent waste is small, because the last level dominates the sum. At branching ' +
            'factor three the repetition costs fifty per cent, and the memory saving is ' +
            'exponential.'
        ],
        example: 'At branching factor 3 and depth 8 the repeated levels add about 50% to the node count and ' +
          'reduce the frontier from thousands of nodes to eight.'
      },
      {
        term: 'Symmetry inside a constraint problem',
        plain: 'Interchangeable variables or values multiply the search by a factorial for no new answers.',
        formal: 'break symmetry by imposing an arbitrary total order on interchangeable elements',
        detail: [
          'Graph colouring with k interchangeable colours is the standard case. Any solution has ' +
            'k! relabellings, all of which the search will find.',
          'Force the colours to be introduced in order: vertex i may only use a colour already ' +
            'used, or the next unused one. That removes the entire factorial, and it cannot ' +
            'remove a genuinely distinct solution.',
          'The same trick applies wherever two variables have identical constraints, and it is ' +
            'usually the largest single win available.'
        ],
        example: 'Colouring a 30-vertex graph with three colours: fixing the first vertex to colour 0 divides ' +
          'the search by three before any other pruning applies.'
      },
      {
        term: 'The node budget and the honest table',
        plain: 'A search that ran out of budget reports a bound, not a number.',
        formal: 'annotate exhausted runs and refuse to compute ratios against them',
        detail: [
          'Hard instances do not finish, and a table that prints the budget as though it were a ' +
            'measurement invites a comparison that is not valid.',
          'The true figure is larger and unknown, so a ratio against it is meaningless in a ' +
            'direction nobody can quantify.',
          'Marking those cells and leaving the ratio blank costs a little clarity, and buys the ' +
            'reader the ability to trust every other cell in the table.'
        ],
        example: 'The anti-brute-force puzzle shows "500 000+" for the naive order, and the row computes no ' +
          'improvement ratio.'
      }
    ],

    'branch-and-bound': [
      {
        term: 'The incumbent',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the best complete solution<br/>found so far"] --> B["every subtree\'s bound<br/>is compared against it"]',
            '    B --> C{"can this subtree beat it?"}',
            '    C -->|no| D["prune the whole subtree"]',
            '    C -->|yes| E["explore it"]',
            '    E --> A'
          ].join('\n'),
          caption: 'Finding a good solution early is not a nice side effect, it is the mechanism: a strong incumbent prunes more, which finds better solutions sooner.'
        },
        plain: 'The best complete solution found so far, and the thing every bound is compared against.',
        formal: 'a lower bound on the optimum for a maximisation, updated whenever a leaf improves on it',
        detail: [
          'Branch and bound needs a solution before it can prune anything. So the order in which ' +
            'the tree is explored matters for reasons that have nothing to do with the tree\'s ' +
            'shape.',
          'Descending the promising branch first produces a good incumbent immediately, and ' +
            'everything after that is pruned against a strong number.',
          'A search that finds its best solution last does the same work as exhaustive search, ' +
            'however good its bound is. That is why depth-first with a greedy child order is the ' +
            'usual arrangement.'
        ],
        example: 'Taking the highest-density item first gives an incumbent at the very first leaf, and the ' +
          '22-item knapsack then needs 70 nodes in total.'
      },
      {
        term: 'Admissibility is one-sided',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the bound is too optimistic"] --> B["you explore subtrees you<br/>did not have to — slow, still correct"]',
            '    C["the bound is too pessimistic"] --> D["you prune a subtree that held<br/>the optimum — fast, and wrong"]',
            '    D --> E["and nothing tells you"]'
          ].join('\n'),
          caption: 'The two errors are not symmetric. One costs time and the other costs the answer, which is why an admissible bound must never understate what a subtree can reach.'
        },
        plain: 'A bound may overestimate what a subtree can reach; it may never underestimate.',
        formal: 'for maximisation, bound(s) >= max{value(t) : t is a completion of s}',
        readAs: 'The bound must be optimistic: never lower than the best any completion could ' +
          'actually reach. An optimistic bound may waste time. A pessimistic one deletes the ' +
          'answer.',
        detail: [
          'The asymmetry is the entire correctness condition, and it is easy to get backwards.',
          'An over-estimate is safe. The search descends into a subtree that turns out not to ' +
            'contain anything better, which costs time.',
          'An under-estimate is fatal. The search skips a subtree that did contain the optimum, ' +
            'and returns a smaller answer with nothing to indicate it.',
          'Every relaxation-based bound is admissible by construction, which is the real reason ' +
            'relaxations are the standard source.'
        ],
        example: 'A bound set to 90% of the fractional relaxation explores the fewest nodes of the three here ' +
          '— 40 — and returns 640 where the optimum is 658.'
      },
      {
        term: 'Tightness decides how much is pruned',
        plain: 'Two admissible bounds can differ by an order of magnitude in explored nodes.',
        formal: 'the pruning condition bound(s) <= incumbent fires earlier the closer bound(s) is to the true optimum',
        detail: [
          'Admissibility makes a bound correct and tightness makes it useful. The two are ' +
            'independent.',
          '"Fill the remaining capacity at the best density seen" is admissible and weak. The ' +
            'fractional relaxation is admissible and strong, because it is the exact optimum of a ' +
            'problem that contains this one.',
          'The measured difference on the same instance is 282 nodes against 70. That gap is worth ' +
            'far more than any constant-factor tuning of the traversal, which is the practical ' +
            'lesson.'
        ],
        example: 'On the same knapsack: the density bound explores 282 nodes and the fractional relaxation ' +
          'explores 70, both returning 658.'
      },
      {
        term: 'The LP relaxation as a bound',
        plain: 'Drop the integrality constraint, solve the easier problem, and use its optimum as the ceiling.',
        formal: 'max c·x subject to Ax <= b, x ∈ {0,1}ⁿ is bounded above by the same program over 0 <= x <= 1',
        readAs: 'The integer problem forces each variable to be 0 or 1. Letting them slide ' +
          'anywhere between gives an easier problem whose answer is at least as good, and that ' +
          'relaxed answer is the bound.',
        detail: [
          'Relaxation is the general recipe for constructing an admissible bound, and it always ' +
            'works the same way. Remove a constraint, so the feasible set grows, so the optimum ' +
            'can only improve, so the relaxed optimum is a ceiling on the original.',
          'For 0/1 knapsack the relaxation is fractional knapsack, which greedy solves exactly in ' +
            'one pass.',
          'The same idea gives the assignment-problem bound for the TSP, and Lagrangian bounds ' +
            'throughout integer programming.'
        ],
        example: 'The fractional optimum at the root of this instance is the integrality gap the search then ' +
          'has to close, and it is what the first table row reports.'
      },
      {
        term: 'The gap is the progress measure',
        plain: 'The distance between the best bound and the incumbent is what tells you how far there is to go.',
        formal: 'gap = (bestBound − incumbent) / incumbent; zero means optimality is proved',
        readAs: 'The gap between the best answer found and the best that could still exist, as a ' +
          'fraction. When it reaches zero you have not just found a good answer. You have proved ' +
          'nothing better exists.',
        detail: [
          'Branch and bound does two things at once. It finds solutions, and it proves that none ' +
            'is better. The gap is the only number that reflects both.',
          'A solver stopped early reports its incumbent and its gap, and that pair is a genuine ' +
            'guarantee. "At most 3% below optimal" is usable in a way that "the best I found" is ' +
            'not.',
          'It is also the right progress bar, because a search can find the optimum in the first ' +
            'second and spend an hour proving it.'
        ],
        example: 'A knapsack whose capacity is nearly the total weight has a small integrality gap and the ' +
          'tree collapses; a half-full one has the largest gap and the biggest tree.'
      },
      {
        term: 'Best-first against depth-first',
        plain: 'Expanding the most promising node first explores fewest nodes and uses the most memory.',
        formal: 'best-first expands in order of bound and is node-optimal for a given bound; depth-first uses O(depth) memory',
        detail: [
          'Best-first search never expands a node whose bound is worse than the optimum, which ' +
            'makes it optimal in explored nodes for a given bounding function.',
          'It pays for that with a priority queue that can hold an exponential number of open ' +
            'nodes, which is what makes it unusable on the instances that matter.',
          'Depth-first explores more nodes and holds one path. Real solvers use hybrids for ' +
            'exactly this reason: best-first with a depth-first dive, or iterative broadening.'
        ],
        example: 'The depth-first search here holds at most 22 open decisions; the best-first version of the ' +
          'same search would hold thousands of partial solutions on the queue.'
      },
      {
        term: 'The travelling salesman as a bound exercise',
        plain: 'Even a crude bound removes most of the permutation tree.',
        formal: 'travelled + Σ over unvisited cities of the cheapest edge leaving that city',
        readAs: 'A bound for the travelling salesman: what you have spent already, plus the ' +
          'cheapest possible way out of every city you still have to visit. It is optimistic, ' +
          'which is what makes it valid.',
        detail: [
          'The TSP is where bounding gets interesting, because the obvious search is a factorial. ' +
            'The constant factor a bound buys is measured in cities rather than in percentages.',
          'The cheapest-edge bound is close to the weakest usable one, and it still removes most ' +
            'of the tree. A 1-tree or an assignment-relaxation bound removes far more, and costs ' +
            'far more per node.',
          'That trade — work per node against nodes removed — is the same one every heuristic in ' +
            'this milestone makes.'
        ],
        example: 'Nine cities: 109 601 nodes without the bound and 2 502 with it, both returning the same ' +
          '226.019-long tour.'
      },
      {
        term: 'Comparing against exhaustive search is the check',
        plain: 'On instances small enough to enumerate, the bounded search must agree exactly.',
        formal: 'assert bounded(I) = exhaustive(I) for all small I, and assert nodes(bounded) <= nodes(exhaustive)',
        detail: [
          'The bound is the part that can be wrong in a way nothing else notices, so the test has ' +
            'to target it directly.',
          'Enumerating all 2^n subsets is affordable up to about twenty items, which is plenty to ' +
            'catch an inadmissible bound. A bound that under-estimates by any amount will ' +
            'eventually discard an optimum on some instance, and a randomised sweep finds it ' +
            'quickly.',
          'Testing only that the answer is "reasonable" would pass the deliberately wrong bound in ' +
            'this section.'
        ],
        example: 'Exhaustive search over the 4 194 304 subsets of a 22-item instance gives 658, which is what ' +
          'both admissible bounds return and what the inadmissible one misses.'
      }
    ],
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
