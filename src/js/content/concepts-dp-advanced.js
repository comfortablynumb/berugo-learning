/** Concepts for the advanced dynamic-programming sections (M12.9-M12.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'dp-optimisations': [
      {
        term: 'Every optimisation is a narrowing, and every narrowing has a precondition',
        plain: 'These techniques do not compute faster; they look at fewer candidates.',
        formal: 'each replaces argmin over [0, j) with argmin over a subset S(j) ⊆ [0, j)',
        readAs: 'Every optimisation in this section does the same thing: instead of searching all previous ' +
          'positions for the best predecessor, prove that only a few of them can ever win, and search ' +
          'those. The ⊆ means that smaller set sits inside the full range.',
        detail: 'The convex hull trick, divide-and-conquer optimisation, the monotonic queue and Knuth\'s ' +
          'optimisation all restrict which earlier states a transition considers. That is why the failure ' +
          'mode is uniform across the family and uniformly nasty: when the precondition is false the ' +
          'restricted set can exclude the true optimum, so the answer is worse, the run is faster, and ' +
          'nothing raises. A fast wrong answer passes review and passes benchmarking, which makes it the ' +
          'most expensive kind of defect to ship.',
        example: 'The hull on 400 elements evaluates 783 transitions against the quadratic reference\'s ' +
          '80 200 — the same value of 80 131, and only because the preconditions hold.'
      },
      {
        term: 'The convex hull trick, derived',
        plain: 'Expand the square and the transition becomes the minimum of a set of lines.',
        formal: 'dp[j] = P[j]² + c + min over i of ((−2P[i])·P[j] + dp[i] + P[i]²)',
        readAs: 'Rewritten this way, each earlier position i contributes a straight line in P[j]: slope ' +
          '−2P[i], intercept dp[i] + P[i]². Minimising over i is then asking which of a set of lines is ' +
          'lowest at a given x — which is a geometry problem with a fast answer.',
        detail: 'The rewriting *is* the technique and everything else is bookkeeping. A cost of the form ' +
          '(P[j] − P[i])² expands into a term depending only on j, a term depending only on i, and a cross ' +
          'term linear in P[j] - so each earlier state contributes a line y = m·x + c with m = −2P[i], and ' +
          'the best transition at j is the lowest line at x = P[j]. Once the problem is a minimum over ' +
          'lines, only the lines on the lower envelope can ever win, and the rest can be discarded as soon ' +
          'as that is known.',
        example: 'On 400 elements the hull holds 385 lines at its largest, and the pointer walk over them ' +
          'costs 783 evaluations in total.'
      },
      {
        term: 'The hull needs monotone slopes and monotone queries',
        plain: 'Lines must arrive with falling slopes and queries must arrive with rising x.',
        formal: 'both hold iff the prefix sums are non-decreasing, which needs non-negative values',
        detail: 'The monotone hull is a stack plus a forward-only pointer, and both parts depend on order. ' +
          'Slopes arriving out of order break the stack\'s "is this line now useless" test; queries moving ' +
          'backwards break the pointer, which never returns. For the grouping cost the slopes are −2P[i] ' +
          'and the queries are P[j], so both are monotone exactly when the prefix sums rise - which is a ' +
          'statement about the data rather than about the algorithm, and is therefore worth testing on the ' +
          'actual instance.',
        example: 'One negative value in a 60-element sequence makes the prefix sums fall at index 2, and the ' +
          'guarded solver refuses rather than answering.'
      },
      {
        term: 'Li Chao trades a log factor for the preconditions',
        plain: 'The same minimum-of-lines query with lines and queries in any order.',
        formal: 'a segment tree over x, each node holding the line that wins at its midpoint; O(log range) per operation',
        detail: 'This is the honest alternative when the data does not cooperate, and in practice the data ' +
          'usually does not. Li Chao gives up the hull\'s amortised O(1) and gains complete independence ' +
          'from arrival order, which is a good trade whenever the input is not under your control. Knowing ' +
          'both, and knowing which precondition each one needs, is what turns "use the convex hull trick" ' +
          'from a memorised move into a decision.',
        example: 'Fifty lines inserted in random order and queried at arbitrary points: Li Chao agrees with ' +
          'a direct minimum over all fifty at every query.'
      },
      {
        term: 'Divide and conquer optimisation needs a monotone argmin',
        plain: 'If the best split point never moves backwards, solving the middle bounds both halves.',
        formal: 'opt(j) non-decreasing in j ⟹ solving the middle j gives ranges for the left and right recursions',
        readAs: 'If the best predecessor only ever moves rightwards, then solving the middle position pins ' +
          'down where the left and right halves must look. Recursing on that gives n log n instead of ' +
          'n².',
        detail: 'Settle the middle index of a layer first, and its optimum splits the candidate range for ' +
          'everything on either side. Recursing gives O(n log n) per layer instead of O(n²), and the ' +
          'precondition is that the argmin is monotone. Checking that precondition is itself quadratic - it ' +
          'requires computing every argmin the slow way - which is exactly right: the check belongs in a ' +
          'test, at test sizes, not in the production path.',
        example: 'Splitting 120 values into 4 groups: 29 040 transitions unoptimised and 3 262 with the ' +
          'divide-and-conquer bound, for the identical value of 453 673.'
      },
      {
        term: 'The monotonic queue, applied to a transition',
        plain: 'When the transition looks back over a sliding window, the deque from M11.7 applies unchanged.',
        formal: 'dp[j] = min over i in [j − w, j − 1] of dp[i] + cost(j); the front of the deque is that minimum',
        readAs: 'When only a fixed window of previous positions is eligible, a monotone deque keeps the ' +
          'minimum of that window available in constant time — the same sliding-window trick as in M11.',
        detail: 'This is the least glamorous of the four and the most reusable, because "the transition ' +
          'looks at the previous w states" is an extremely common shape. Each index enters the deque once ' +
          'and leaves once, so the whole sweep is linear regardless of the window width, while the rescan ' +
          'is proportional to it. It is the same amortisation argument as the sliding-window maximum, ' +
          'moved from an array query to a DP transition - and the bounded knapsack\'s deque variant is ' +
          'this technique in yet another disguise.',
        example: 'A window of 50 over 400 elements: 400 transitions with the deque against 18 775 with the ' +
          'rescan, and the same answer of 30.'
      },
      {
        term: 'The Lagrangian (aliens) trick',
        plain: 'Price a group, binary-search the price, and "exactly k" falls out of the unconstrained problem.',
        formal: 'solve with penalty λ per group; the optimal group count is monotone in λ; subtract k·λ at the end',
        readAs: 'The Lagrangian trick: instead of forcing exactly k groups, charge a fee λ per group and ' +
          'binary-search λ until the solver naturally chooses k. Then subtract the fees you charged.',
        detail: 'A constraint of the form "use exactly k of something" usually adds a dimension to the DP ' +
          'and multiplies the cost by k. The Lagrangian move removes the dimension by charging λ per use ' +
          'and searching for the λ at which the unconstrained optimum happens to use exactly k. It needs ' +
          'the cost to be convex in k, and its honest failure is that the group count can jump straight ' +
          'over the target - in which case reporting that is the only correct answer, because an answer ' +
          'for k − 1 is not an answer for k.',
        example: 'Splitting 120 values into exactly 4 groups: the penalty search lands at λ ≈ 90 646 and ' +
          'recovers 453 673, matching the two-dimensional DP.'
      },
      {
        term: 'Test the optimised against the unoptimised',
        plain: 'One property test over random instances catches every precondition violation there is.',
        formal: '∀ instances: optimised(instance) = reference(instance), asserted on values not on timings',
        readAs: 'For every instance — the ∀ is "for all" — the fast version and the plain one must agree on ' +
          'the answer. The test is on values, never on how long each took.',
        detail: 'Each of these techniques has a proof obligation, and discharging it in a test is far more ' +
          'reliable than discharging it in your head. Running both versions on a few hundred random ' +
          'instances and asserting the values are equal catches violations you knew about and violations ' +
          'you did not - and it keeps catching them later, when somebody changes the cost function and does ' +
          'not realise the optimisation depended on its shape. The reference implementation is not dead ' +
          'code; it is the test.',
        example: 'The quadratic reference and the hull agree at 80 131 on the default instance, and the ' +
          'reference is the only reason that number can be trusted.'
      }
    ],

    'game-dp': [
      {
        term: 'A game is a DP over positions',
        plain: 'The value of a position is the best value its moves lead to, with "best" alternating.',
        formal: 'v(s) = max over moves of v(s\') at a maximising node, min at a minimising node',
        detail: 'Minimax is that recurrence written out, and treating it as a DP rather than as a separate ' +
          'subject makes everything else follow: the state space is the positions, the transitions are the ' +
          'moves, memoising it is transposition tables, and the evaluation order question is whether the ' +
          'position graph has cycles. Scoring from one player\'s point of view at every depth keeps the two ' +
          'players one sign apart rather than two code paths, which removes an entire class of bug.',
        example: 'Tic-tac-toe from an empty board is 549 946 nodes and 255 168 terminal positions, and its ' +
          'value is 0 — a draw with correct play.'
      },
      {
        term: 'Alpha-beta prunes what cannot matter',
        plain: 'Once a node is provably no better than something already in hand, its remaining moves are irrelevant.',
        formal: 'maintain [α, β]; at a node where β ≤ α the parent will never choose this branch, so stop',
        readAs: 'Alpha-beta pruning: α is the best the maximising side is already assured of, β the best the ' +
          'minimising side is. Once they cross, whatever is below cannot change the answer, so it is ' +
          'never looked at.',
        detail: 'The window carries "the best the maximiser is already guaranteed" and "the best the ' +
          'minimiser is already guaranteed". When they cross, the current node\'s value cannot influence ' +
          'the answer whatever its unexamined moves contain, so they are never examined. The value returned ' +
          'is exactly minimax\'s - the pruning is about what is searched, never about what is computed - ' +
          'which is why the value is the check and the node count is the result.',
        example: 'Tic-tac-toe: 549 946 nodes with plain minimax and 7 275 with alpha-beta under a good ' +
          'ordering, both returning 0.'
      },
      {
        term: 'The saving belongs to the move ordering',
        plain: 'Alpha-beta with bad ordering approaches the full tree; with perfect ordering it approaches its square root.',
        formal: 'best case Θ(b^(d/2)), worst case Θ(b^d) — the same algorithm, different orders',
        readAs: 'With perfect move ordering, alpha-beta searches the square root of the tree — which is twice ' +
          'the depth for the same effort. With the worst ordering it searches all of it. Nothing else ' +
          'changes.',
        detail: 'This is the fact that matters in practice, and it reframes engineering effort: once ' +
          'alpha-beta is in place, the returns come from ordering heuristics rather than from the search. ' +
          'It also explains why real engines spend so much on move ordering - killer moves, history ' +
          'heuristics, iterative deepening feeding the previous depth\'s best move first. The measurement ' +
          'here is a 5.8× spread between two orderings of the same algorithm on the same position, both ' +
          'returning the same value.',
        example: 'Centre-first visits 7 275 nodes and edges-first 42 094 on the same empty board, both ' +
          'returning 0.'
      },
      {
        term: 'Reversing the move list is not a worse ordering',
        plain: 'On a symmetric board, board order and reversed board order prune identically.',
        formal: 'a symmetry of the position induces a bijection on the search tree that preserves cutoffs',
        detail: 'This is worth stating because "try it backwards and see" is how people usually test an ' +
          'ordering heuristic, and on a symmetric position it measures nothing. Both orders visit 18 297 ' +
          'nodes. A genuinely bad ordering has to be bad *about the game* - examining weak moves first so ' +
          'that no early cutoff is available - rather than bad about the array. Ranking squares by quality ' +
          'and reversing that ranking is a real perturbation; reversing the index list is not.',
        example: 'Board order and reversed board order both visit 18 297 nodes and prune 6 930 branches — ' +
          'identical to the last node.'
      },
      {
        term: 'Win, lose, and the Grundy number that generalises them',
        plain: 'A position is lost exactly when every move leads to a won one; Grundy 0 says the same thing.',
        formal: 'g(s) = mex{g(s\') : s → s\'}; s is losing iff g(s) = 0',
        detail: 'The minimum excludant - the smallest non-negative integer not among the children\'s values ' +
          '- turns the two-valued win/lose labelling into a number, and the number carries strictly more ' +
          'information. The labelling tells you who wins one game; the Grundy value tells you how that game ' +
          'combines with others. Everything in Sprague-Grundy theory rests on this one operation, and its ' +
          'zero case is exactly the classical labelling.',
        example: 'Nim\'s Grundy value is the heap size itself, so only the empty heap is losing; the ' +
          'subtraction game {1, 3, 4} gives 0, 1, 0, 1, 2, 3, 2 and then repeats with period 7.'
      },
      {
        term: 'Sprague-Grundy: the XOR is exact',
        plain: 'A sum of impartial games behaves exactly like one Nim heap of size equal to the XOR.',
        formal: 'g(G₁ + G₂ + … + Gₙ) = g(G₁) ⊕ g(G₂) ⊕ … ⊕ g(Gₙ)',
        readAs: 'The Sprague-Grundy theorem: the value of several games played side by side is the XOR of ' +
          'their individual values. Exact, not approximate — which is why a position with XOR zero is a ' +
          'loss and anything else is a win.',
        detail: 'This is a theorem rather than a heuristic, and it is the reason the family exists. A ' +
          'position made of independent components would otherwise need a state space that is the product ' +
          'of the components\', and the theorem replaces that product with a XOR of independently computed ' +
          'numbers. Recognising that a position *decomposes* is the whole trick - the theory is easy once ' +
          'the components are identified, and identifying them is the part that takes judgement.',
        example: 'Three heaps of seven under {1, 3, 4}: three tables of 41 states give a XOR of 0, and the ' +
          '393-state joint search agrees that the first player loses.'
      },
      {
        term: 'Grundy sequences are eventually periodic',
        plain: 'A finite subtraction set gives a repeating Grundy sequence, so a small table answers for any heap.',
        formal: 'for a finite move set the sequence is ultimately periodic; the period is found, not assumed',
        detail: 'Because each value depends on a bounded window of earlier values, the sequence of ' +
          '(window) states is finite and must eventually repeat - and once it repeats it repeats forever. ' +
          'That turns an unbounded game into a lookup: compute enough of the table to see the period, then ' +
          'answer any heap size by modular arithmetic. Detecting the period rather than assuming one is ' +
          'the honest version, because a periodic-looking prefix is not a proof.',
        example: '{1, 3, 4} has period 7 from the start; {1, 2} has period 3; Nim has no period at all, ' +
          'because its Grundy value is the heap size.'
      },
      {
        term: 'Retrograde analysis handles cycles',
        plain: 'Work backwards from the terminal positions, counting each state\'s unresolved successors.',
        formal: 'a state is won if any successor is lost; lost when all successors are won; anything unresolved is a draw',
        readAs: 'Work backwards from the end: you win if you can move to a position your opponent loses from, ' +
          'and lose if every move hands them a win. Positions that never resolve are draws.',
        detail: 'A forward memoised search cannot label a game whose positions can repeat - it recurses ' +
          'forever - and repetition is exactly what produces draws. Retrograde analysis starts at the ' +
          'terminals and propagates backwards with a counter of unresolved successors per state, so a state ' +
          'is settled as lost only when every one of its moves has been settled as won. Whatever is never ' +
          'settled is a draw, which is the correct answer rather than a failure. This is how endgame ' +
          'tablebases are built.',
        example: 'Nim to heap 40: 40 winning positions, 1 losing one, and no draws — matching the single ' +
          'zero in the Grundy table.'
      }
    ],

    'expectation-dp': [
      {
        term: 'An expectation over a DAG is an ordinary DP',
        plain: 'E[s] = cost(s) + Σ p(s→t)·E[t], evaluated in topological order.',
        formal: 'for an absorbing chain with no transient cycles, E is computed by one reverse topological sweep',
        detail: 'When every transition moves strictly forward, an expected-value recurrence is the same ' +
          'shape as every other DP in this milestone: states, transitions, an evaluation order, and a ' +
          'combine that happens to be a weighted sum. Board games, retry loops and queues all start out ' +
          'looking like this, and the obvious memoised recursion is correct. Everything interesting starts ' +
          'when the graph stops being acyclic.',
        example: 'A strictly forward chain over 21 states gives E[0] = 13.555555344 by recursion and the ' +
          'identical value by linear solve.'
      },
      {
        term: 'A cycle makes it a linear system, not a hard DP',
        plain: 'If a state can reach itself, there is no topological order and no recursion.',
        formal: 'E[s] − Σ p(s→t)·E[t] = cost(s) is one row of a linear system in the transient states',
        readAs: 'The expected cost from a state is its own cost plus the weighted average of the expected ' +
          'costs of where it can go. Written out for every state, that is a system of linear equations ' +
          '— which is why cyclic chains need elimination rather than a sweep.',
        detail: 'This is the section\'s whole point. A memoised recursion on a cyclic chain either recurses ' +
          'forever or returns whatever half-filled value was in the memo, which is worse. Rearranged, the ' +
          'same equation moves E[s] to the left and becomes one row of an n × n system - and n states give ' +
          'n equations, which Gaussian elimination solves in twenty lines. Recognising the shape early is ' +
          'the difference between twenty lines and an afternoon of debugging a memo that returns different ' +
          'answers on different runs.',
        example: 'A 20-square board with a six-sided die is already cyclic — the overshoot rule is a ' +
          'self-loop — and solves to 10.476469 expected rolls.'
      },
      {
        term: 'Detect the cycle; do not be told about it',
        plain: 'Run a topological sort first and let the result choose the method.',
        formal: 'topologicalOrder(chain) = null ⟺ a transient cycle exists ⟹ use elimination',
        readAs: 'Failing to find an ordering happens exactly when there is a cycle, and a cycle means the ' +
          'sweep cannot work so you must solve the equations instead. The double arrow is "exactly ' +
          'when"; the single one is "which means".',
        detail: 'Whether a chain is cyclic is a property of the rules, and rules change - a board gains a ' +
          '"miss a turn" square, a protocol gains a retry, a game gains a snake. Deciding the method by ' +
          'inspection means the decision goes stale silently. Deciding it by running a topological sort ' +
          'costs one linear pass and reports which route was taken, so the page and the tests can both see ' +
          'it. The two routes are then run side by side on acyclic inputs, which is what licenses trusting ' +
          'the harder one where no other check exists.',
        example: 'The same solver reports "recursion" on a strictly forward chain and "elimination" on ' +
          'every board with an overshoot rule, without being told which is which.'
      },
      {
        term: 'The overshoot rule is a self-loop',
        plain: 'A roll that would pass the end leaves you where you are, and that alone makes the chain cyclic.',
        formal: 'p(s→s) = |{r : s + r > n}| / faces > 0 for s > n − faces',
        readAs: 'Near the end of the board most rolls overshoot and leave you where you are, so the state has ' +
          'a genuine chance of transitioning to itself. That self-loop is what makes the chain cyclic ' +
          'and defeats a topological sweep.',
        detail: 'It is worth naming because it is so easy to miss: nobody thinks of "you must land exactly" ' +
          'as introducing a cycle, and it does. Every square within one die-roll of the end names itself on ' +
          'the right-hand side of its own equation, which is precisely the case a recursion cannot handle. ' +
          'Snakes and ladders add longer cycles on top, but the board is already cyclic before any of them ' +
          'are placed, which is the more surprising half of the fact.',
        example: 'On a 20-square board with a d6, squares 15 to 19 all have a self-loop, and the chain is ' +
          'cyclic with no snakes on it at all.'
      },
      {
        term: 'Partial pivoting is not optional',
        plain: 'A zero on the diagonal produces Infinity, then NaN, far from where it went wrong.',
        formal: 'swap in the row with the largest absolute value in the current column before eliminating',
        readAs: 'Partial pivoting. Dividing by a near-zero number amplifies floating-point error, so pick the ' +
          'largest available pivot first. It costs a swap and it is the difference between an answer ' +
          'and noise.',
        detail: 'A transient state with no self-loop puts a zero on its own diagonal, and an unpivoted ' +
          'elimination divides by it. The result is not an exception at the point of failure - it is an ' +
          'Infinity that becomes a NaN and propagates through the back-substitution into a table of them, ' +
          'so the symptom appears everywhere and the cause appears nowhere. Pivoting also improves ' +
          'numerical stability, but its first job here is turning a silent corruption into a correct answer.',
        example: 'A 20-square board yields 20 pivot operations over its transient states, and every one of ' +
          'them is a swap that could otherwise have been a division by zero.'
      },
      {
        term: 'Monte Carlo checks the model, not the arithmetic',
        plain: 'A simulation is far too noisy to verify algebra, and it is the only thing that verifies the rules.',
        formal: 'the standard error falls as 1/√trials, so four times the work halves the interval',
        readAs: 'Monte Carlo accuracy improves with the square root of the sample count. Halving the error ' +
          'costs four times the trials — which is why simulation is a way to get two digits, not six.',
        detail: 'A transition table that does not describe the game produces an exact answer to the wrong ' +
          'question, and no amount of checking the linear solver will notice. Simulating the rules as ' +
          'written is the independent implementation that does. What it cannot do is confirm a fourth ' +
          'decimal place: at forty thousand trials the interval is still several hundredths wide, so ' +
          '"agrees" has to mean "inside the interval" rather than "looks similar", and the interval has to ' +
          'be reported for that to mean anything.',
        example: 'The snakes board solves to 13.850548 exactly and simulates to 13.862425 ± 0.078203, so the ' +
          'exact value is inside the 95% interval.'
      },
      {
        term: 'Rows must sum to one',
        plain: 'A chain whose probabilities do not sum to one is not a chain, and its answer is meaningless.',
        formal: 'Σ_t p(s→t) = 1 for every transient s, within floating-point tolerance',
        readAs: 'Add up the probabilities of every move out of a state and they must come to exactly one — ' +
          'something has to happen. Checking it catches the transition bugs nothing else notices.',
        detail: 'This is the cheapest possible sanity check on a transition table and it catches the ' +
          'commonest modelling error - a case the generator forgot, or a branch that returns early. The ' +
          'linear solver will happily solve a system built from a defective table and return numbers that ' +
          'look entirely reasonable, because nothing about the elimination cares whether the rows are ' +
          'stochastic. One pass over the table, reported as a field rather than assumed.',
        example: 'Every board on this page reports its rows summing to one; a missing overshoot case would ' +
          'leave a row at 5/6 and still produce a plausible expectation.'
      },
      {
        term: 'Optimal stopping: the threshold is the state',
        plain: 'The secretary problem is an expectation over one parameter, and the sweep finds n/e.',
        formal: 'P(best | observe k) = (k/n)·Σ_{i=k+1..n} 1/(i−1), maximised near k = n/e',
        readAs: 'The secretary problem: watch the first k candidates without hiring, then take the next one ' +
          'better than all of them. The vertical bar is "given that". The best k is n divided by e ' +
          '(2.718…), about 37%, and it succeeds about 37% of the time.',
        detail: 'The classic result - observe about 37% of the candidates, then take the first one better ' +
          'than all of them, and you win about 37% of the time - is usually quoted and rarely computed. ' +
          'Computing it is a one-parameter sweep over an exact formula, and doing so turns a remembered ' +
          'constant into a checkable one. It also makes the shape visible: the curve is quite flat near the ' +
          'optimum, so the practical advice is robust to getting the threshold somewhat wrong.',
        example: 'At n = 100 the best threshold is k = 37 winning 0.371043 of the time, against n/e = 36.788 ' +
          'and 1/e = 0.367879.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
