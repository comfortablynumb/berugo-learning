/** Concepts for LP relaxation, approximation schemes and derandomisation (M19.7-M19.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'lp-relaxation': [
      {
        term: 'Relaxation turns a modelling problem into a solved one',
        plain: 'Write the integer program honestly, delete the sentence that says the variables are integers, and solve what is left.',
        formal: 'min c·x subject to Ax ≥ b, x ∈ {0,1}ⁿ becomes the same with 0 ≤ x ≤ 1',
        readAs: 'Minimise c dotted with x subject to A times x being at least b, with x ' +
          'restricted to zeros and ones — then allow x anywhere between zero and one instead.',
        detail: 'The appeal is that the hard part of the problem is confined to one line, and ' +
          'deleting that line leaves something with a polynomial-time algorithm and forty years ' +
          'of solver engineering behind it. The relaxation’s optimum is a lower bound on the ' +
          'integer optimum because every integer solution is still a fractional one, so you get ' +
          'a usable bound before doing any rounding at all — which is often the more valuable ' +
          'half in production, since it tells you how much room a heuristic has left.',
        example: 'On the demo’s 12-vertex instance the LP pays 6.00 with every vertex at exactly ' +
          '0.5, against an exact integer optimum of 7 found by examining subsets.'
      },
      {
        term: 'The vertex-cover relaxation is half-integral, which is why threshold rounding works',
        plain: 'Every basic solution has each coordinate at zero, one half or one.',
        formal: 'Nemhauser–Trotter: every basic feasible solution of the vertex-cover LP has x ∈ {0, ½, 1}ⁿ',
        readAs: 'Every corner solution of that linear program has each coordinate equal to zero, ' +
          'a half, or one — no other fractional values appear.',
        detail: 'Rounding at ½ is then feasible by inspection rather than by argument: every ' +
          'edge’s constraint says x_u + x_v ≥ 1, so at least one endpoint is at least ½ and gets ' +
          'taken. Each rounded coordinate at most doubles, so the cost is at most twice the LP ' +
          'value and therefore at most twice the optimum. The theorem does more than justify the ' +
          'rounding — the vertices at 1 and at 0 are provably in and out of some optimal cover, ' +
          'so the LP is also a preprocessing step that shrinks the instance.',
        example: 'The demo checks half-integrality on every instance and reports 150 of 150 — the ' +
          'theorem observed rather than quoted.'
      },
      {
        term: 'The integrality gap is a ceiling on the whole method, not on one algorithm',
        plain: 'If the two optima are a factor apart, no rounding of that relaxation can close it.',
        formal: 'gap = supₓ OPT_IP(x) / OPT_LP(x); for vertex cover on Kₙ it is 2 − 2/n',
        readAs: 'The gap is the largest ratio, over all instances, between the integer optimum ' +
          'and the linear-program optimum; on the complete graph it is two minus two over n.',
        detail: 'This is the diagnostic that tells you whether to work on the algorithm or on the ' +
          'model. A large gap means the relaxation has thrown away too much and no amount of ' +
          'rounding cleverness will help — you need a stronger formulation, more constraints, or ' +
          'a semidefinite relaxation. A small gap means the relaxation is nearly exact and the ' +
          'rounding is where the loss is. Measuring the gap on your own instances is cheap and ' +
          'is almost never done.',
        example: 'On the complete graphs the demo measures gaps of 1.3333, 1.6000, 1.7143, ' +
          '1.7778, 1.8182 and 1.8667 — matching 2 − 2/n at every size, and approaching but never ' +
          'reaching 2.'
      },
      {
        term: 'Randomised rounding is the version for problems that are not half-integral',
        plain: 'Take each element with probability equal to its fractional value.',
        formal: 'E[cost] = Σ c_S · x_S = the LP value exactly; Pr[element e uncovered] ≤ 1/e per round',
        readAs: 'The expected cost is the sum over sets of the cost times the fractional value, ' +
          'which is exactly the linear-program optimum, and each element escapes coverage in one ' +
          'round with probability at most one over the base of natural logarithms.',
        detail: 'The expected cost is exactly the LP value, which is remarkable on its own: the ' +
          'rounding is free in expectation and only feasibility has to be paid for. Because each ' +
          'element survives a round with probability at most 1/e, O(log n) independent rounds ' +
          'cover everything with high probability at O(log n) times the LP cost — which recovers ' +
          'the ln n bound for set cover from a completely different direction than greedy.',
        example: 'The demo runs the same idea on MAX-SAT: setting each variable true with ' +
          'probability y_i measures a mean of 97.62% of the optimum against a floor of ' +
          '1 − 1/e = 63.2%, where a plain coin flip measures 79.00% mean and 79.31% median.'
      },
      {
        term: 'The 3/4 MAX-SAT algorithm is two weak ones with opposite biases',
        plain: 'A coin flip is good on long clauses and bad on short ones; LP rounding is the reverse.',
        formal: 'coin: 1 − 2⁻ᵏ rises with k. LP rounding: ≥ 1 − (1 − 1/k)ᵏ falls to 1 − 1/e. Their average exceeds 3/4 per clause.',
        readAs: 'A coin flip satisfies a clause of length k with probability one minus two to ' +
          'the minus k, which rises with k; LP rounding gives at least one minus one minus one ' +
          'over k, all raised to the k, which falls towards one minus one over e.',
        detail: 'Neither algorithm alone reaches 3/4 — the coin bottoms out at 1/2 on unit ' +
          'clauses and the LP bottoms out at 1 − 1/e ≈ 0.632 on long ones — but the two bottoms ' +
          'are at opposite ends of the clause-length range, so their average is above 3/4 clause ' +
          'by clause. Taking the better of the two on each instance is therefore at least the ' +
          'average and inherits the bound. It is the clearest example of combining algorithms ' +
          'whose weaknesses do not overlap.',
        example: 'On formulas with clauses of width 1 to 4, the demo measures a coin flip at a ' +
          'worst case of 60.00% of the optimum and the better-of-two at 82.76% — inside its 75% ' +
          'guarantee — while the derandomised walk of 19.9 measures 98.66% mean and 93.10% worst.'
      },
      {
        term: 'The primal-dual method keeps the duality and throws away the LP',
        plain: 'Raise the dual variable of an unsatisfied constraint until something goes tight, take it, repeat.',
        formal: 'weak duality: any feasible dual value is a lower bound on the primal optimum',
        detail: 'No tableau, no solver, no floating point — and the same factor of 2, with the ' +
          'dual solution it constructs serving as the certificate. This is the shape most ' +
          'production approximation code actually takes, because a combinatorial algorithm is ' +
          'easier to deploy than a linear-programming dependency. Read the history backwards and ' +
          'it explains itself: the combinatorial algorithm was usually found first, and the LP ' +
          'is the explanation of why it works.',
        example: 'The demo runs the primal-dual cover next to LP rounding and the maximal ' +
          'matching, and all three measure a worst case of exactly 2.0000 with means within ' +
          'a hundredth of each other.'
      },
      {
        term: 'A stronger relaxation can beat the integrality gap, and semidefinite is the usual one',
        plain: 'Relax to unit vectors instead of numbers and you get constraints a linear program cannot express.',
        formal: 'Goemans–Williamson MAX-CUT: relax each ±1 variable to a unit vector, solve the SDP, cut by a random hyperplane, giving 0.878',
        readAs: 'Replace each plus-or-minus-one variable by a unit vector, solve the resulting ' +
          'semidefinite program, then split the vectors by a random plane through the origin — ' +
          'which cuts at least 0.878 of the optimum.',
        detail: 'The linear relaxation of MAX-CUT has an integrality gap of 2 and is useless; the ' +
          'vector relaxation has a gap of about 1.139 and gives the best ratio known. The extra ' +
          'strength comes from the constraint that the vectors are unit length, which forces ' +
          'consistency between triples that no linear constraint on numbers can express. The ' +
          'analysis is one integral — the chance a random hyperplane separates two vectors is ' +
          'their angle over π — and the 0.878 is that ratio’s minimum.',
        example: 'Under the unique games conjecture 0.878 is optimal for MAX-CUT, and 2 is ' +
          'optimal for vertex cover, so both of the milestone’s headline ratios are conjecturally ' +
          'the end of the road.'
      },
      {
        term: 'The same model gives you the exact solver and the approximation',
        plain: 'Branch and bound prunes with exactly this relaxation, so one modelling effort buys both.',
        formal: 'the LP bound at each node is the relaxation; a node whose bound exceeds the incumbent is pruned',
        detail: 'This is the practical reason to write the integer program first rather than ' +
          'reaching for a heuristic. The same formulation feeds a solver that will answer ' +
          'exactly on small instances, a rounding that gives a guarantee on large ones, and a ' +
          'lower bound that tells you how far from optimal a heuristic’s answer is. The three ' +
          'answers arrive from one artefact, and picking between them becomes a question of ' +
          'instance size rather than of engineering effort.',
        example: 'M11’s branch-and-bound section prunes on exactly this bound; the demo here ' +
          'reports the same LP value as a lower bound in the ratio table, where it averages ' +
          '0.875 of the integer optimum.'
      }
    ],

    'approximation-schemes': [
      {
        term: 'A scheme takes the accuracy as an input rather than fixing it',
        plain: 'You name the error you can tolerate and the algorithm charges you for exactly that much accuracy.',
        formal: 'PTAS: polynomial in n for each fixed ε. FPTAS: polynomial in n and in 1/ε.',
        readAs: 'A polynomial-time approximation scheme is polynomial in n once epsilon is ' +
          'fixed; a fully polynomial one is also polynomial in one over epsilon.',
        detail: 'The difference is the whole section. A PTAS may run in n^(1/ε), so halving the ' +
          'error squares the runtime and the dial is nearly unusable — going from ε = 0.1 to ' +
          'ε = 0.05 can take a tractable computation to an impossible one. An FPTAS costs ' +
          'linearly in 1/ε, so the dial behaves the way a dial should. When someone says a ' +
          'problem "has an approximation scheme", which of the two matters more than the ratio.',
        example: 'The demo’s PTAS enumerates 21 subsets at k = 1 for 99.25% of the optimum, ' +
          '1 351 at k = 3 and 6 196 at k = 4, growing as nᵏ, while the FPTAS at the matching ' +
          'accuracy uses 10 100 to 25 500 table cells and grows as n²/ε.'
      },
      {
        term: 'The knapsack FPTAS is one idea: scale the profits and round down',
        plain: 'Divide every profit by K, floor it, solve exactly on the smaller numbers.',
        formal: 'K = ε·P_max/n; each item loses < K, so the solution loses < nK = ε·P_max ≤ ε·OPT',
        readAs: 'Set K to epsilon times the largest profit divided by the item count; each item ' +
          'loses less than K in the rounding, so the whole solution loses less than n times K, ' +
          'which is epsilon times the largest profit and therefore at most epsilon times the ' +
          'optimum.',
        detail: 'The last inequality is the one worth pausing on: the optimum is at least the ' +
          'largest profit, because taking that single item is a feasible solution, so bounding ' +
          'the loss by ε·P_max bounds it by ε·OPT. The error and the saving are the same number ' +
          'read from opposite sides — the table shrinks by a factor of K and the answer degrades ' +
          'by n times K — which is what makes the trade exact rather than heuristic.',
        example: 'At ε = 0.5 on a 20-item instance the demo measures K = 25.15, a table of ' +
          '10 100 cells against the exact 258 640, and a solution at 99.6452% of the optimum ' +
          'where only 50% was promised.'
      },
      {
        term: 'The exact DP is pseudo-polynomial, which is not a contradiction of NP-hardness',
        plain: 'Its cost is polynomial in the numbers, and the numbers are exponential in their encoding length.',
        formal: 'O(n·P) with P the total profit; P is 2^(bits) in the input size',
        readAs: 'The cost is order n times P, where P is the total profit — and P can be as ' +
          'large as two raised to the number of bits used to write it.',
        detail: 'A knapsack instance with n items and 64-bit profits is written in about 64n ' +
          'bits, and the DP takes n·2⁶⁴ steps, which is exponential in the input length. That ' +
          'is why the DP exists alongside NP-hardness rather than in spite of it, and it is also ' +
          'why the scaling scheme works at all: the DP is only expensive because the numbers are ' +
          'big, and rounding makes them small. Problems that are NP-hard even with unary input — ' +
          '"strongly NP-hard" — have no FPTAS by this route.',
        example: 'The demo’s exact table has 258 640 cells for 20 items because the profits sum ' +
          'to about 13 000; doubling every profit would double the table without changing the ' +
          'problem.'
      },
      {
        term: 'Scale the profits, never the weights',
        plain: 'Rounding profits changes only the objective; rounding weights changes what is feasible.',
        formal: 'a floored weight admits a set whose true weight exceeds the capacity',
        detail: 'The two look symmetric and are not. A solution to the profit-scaled problem is ' +
          'still a valid solution to the original — the same items, the same weights, the same ' +
          'capacity — and only its value is understated. A solution to the weight-scaled problem ' +
          'may not fit at all, and the failure appears as a higher-than-optimal reported value ' +
          'rather than as an error. Which quantity a relaxation is allowed to perturb is the ' +
          'first question to ask about any scheme.',
        example: 'The demo runs the weight-scaled variant at ε = 0.5 and it returns 6 931 — ' +
          'higher than the true optimum of 6 764 — with a total weight of 5 631 against a ' +
          'capacity of 5 465.'
      },
      {
        term: 'The guarantee is a floor and the measured quality is far above it',
        plain: 'Asked for half the optimum, the scheme returns almost all of it.',
        formal: 'the bound is (1 − ε)·OPT; the measurement at ε = 0.5 is 0.996·OPT',
        readAs: 'The promise is one minus epsilon, multiplied by the optimum; at epsilon of a ' +
          'half the promise is half the optimum and the measured answer is 99.6% of it.',
        detail: 'Because the analysis bounds the worst case over every instance, and because the ' +
          'rounding loses less than K per item rather than exactly K, the realised loss is ' +
          'typically a small fraction of the permitted one. The engineering consequence is to ' +
          'ask for the loosest ε you can live with and measure what you get, rather than ' +
          'reflexively tightening the dial: the cost is linear in 1/ε and the quality saturates ' +
          'almost immediately.',
        example: 'The demo’s sweep reads 99.6452%, 99.8522% and then exactly 100% from ε = 0.5 ' +
          'down to ε = 0.2 — the guarantee moves from 50% to 80% while the achieved value stops ' +
          'moving at all.'
      },
      {
        term: 'The scaling stops saving before ε gets small, and nobody writes that down',
        plain: 'Once the divisor falls below one, dividing by it makes the table bigger.',
        formal: 'K = ε·P_max/n < 1 when ε < n/P_max, and the scaled table then exceeds the exact one',
        readAs: 'K is below one whenever epsilon is smaller than the item count divided by the ' +
          'largest profit, and at that point the scaled table is larger than the unscaled one.',
        detail: 'The scheme is a saving over a range rather than everywhere, and the range ' +
          'depends on the instance: many items with small profits pushes the crossing to looser ' +
          'ε, and few items with large profits pushes it tighter. Past the crossing you are ' +
          'paying approximation machinery to compute an exact answer, and the right response is ' +
          'to run the exact algorithm and say so. Every implementation discovers this and almost ' +
          'no write-up mentions it.',
        example: 'On the demo’s 20-item instance the crossing is at ε = 0.01, where K = 0.503 ' +
          'and the scheme uses 514 000 cells against the exact DP’s 258 640 — twice the cost for ' +
          'the identical answer.'
      },
      {
        term: 'Density greedy alone is unbounded; adding one line makes it a 1/2-approximation',
        plain: 'Take the best single item as well, and return whichever is larger.',
        formal: 'max(density-greedy, best single item) ≥ OPT/2',
        detail: 'Density greedy loses on an instance with one heavy, valuable item and one light ' +
          'item of slightly better ratio: it takes the light one, fills up, and misses almost ' +
          'everything. The best-single-item rule loses on many light items. Neither has a bound ' +
          'alone and their maximum has one, because the fractional optimum is at most the greedy ' +
          'value plus the value of the first rejected item. It is the cheapest guarantee in the ' +
          'milestone — one comparison.',
        example: 'On the demo’s trap instance density greedy returns 2 against an optimum of ' +
          '100 — 2.0% — and the combined rule returns 100 exactly, via the single-item branch.'
      },
      {
        term: 'Some problems admit no scheme at all, and the PCP theorem is why',
        plain: 'For certain problems, approximating better than a fixed constant is exactly as hard as solving them.',
        formal: 'Håstad: MAX-3SAT beyond 7/8 is NP-hard. Feige: set cover below (1 − o(1))·ln n is NP-hard.',
        readAs: 'Approximating MAX-3SAT better than seven eighths is NP-hard, and so is ' +
          'approximating set cover better than one minus a vanishing term, times the natural ' +
          'log of n.',
        detail: 'The PCP theorem recasts NP as the class of problems whose proofs can be verified ' +
          'by reading a constant number of random bits, which creates a gap: satisfiable ' +
          'instances stay satisfiable and unsatisfiable ones become badly unsatisfiable. An ' +
          'approximation algorithm crossing that gap would decide the original problem. The ' +
          'practical value is knowing when to stop: a problem that is APX-hard will not yield to ' +
          'a cleverer approximation, so the effort goes into the model, the instance sizes or an ' +
          'exact solver.',
        example: 'The demo’s class table lists knapsack (FPTAS), Euclidean TSP (PTAS but no ' +
          'FPTAS), metric TSP, vertex cover and MAX-3SAT (APX), and set cover and general TSP ' +
          '(no constant factor).'
      }
    ],

    'derandomisation': [
      {
        term: '"In expectation" means about half your runs are below it',
        plain: 'An average says nothing about how often a single run is near it.',
        formal: 'E[cut] = |E|/2 for a uniform random assignment, and Pr[cut < |E|/2] is around a half',
        readAs: 'The expected cut is half the edge count, and the chance that one particular ' +
          'random assignment falls below that is roughly one half.',
        detail: 'The probabilistic method uses the expectation to prove that a good assignment ' +
          'exists — if the average is |E|/2 then something is at least |E|/2 — and that is an ' +
          'existence proof with no algorithm attached. Running the random assignment once gives ' +
          'you a draw from a distribution centred on the bound rather than a solution meeting ' +
          'it, and the difference matters exactly when somebody depends on the guarantee.',
        example: 'The demo draws 500 random assignments on a 37-edge graph: the mean is 18.67 ' +
          'against a predicted 18.5, the worst is far below it, and 232 of the 500 miss the ' +
          'bound. On MAX-SAT the same experiment gives a mean of 35.10 against an expectation ' +
          'of 35.00, with a worst draw at 70.0% of the optimum.'
      },
      {
        term: 'Conditional expectations convert the proof into an algorithm',
        plain: 'Decide one variable at a time, always taking the branch whose conditional expectation is at least the current one.',
        formal: 'E[X | decided] = ½·E[X | decided, next = 0] + ½·E[X | decided, next = 1], so one branch is ≥ the average',
        readAs: 'The current conditional expectation is the average of the two branches, so at ' +
          'least one branch is at least as large as it is.',
        detail: 'The expectation therefore never falls, and when every variable is decided there ' +
          'is nothing left to average over — so the expectation IS the answer and the answer is ' +
          'at least where the walk started. The whole argument is one inequality applied n times, ' +
          'and it needs only that the conditional expectation is computable in polynomial time. ' +
          'That condition is the real requirement and it is often easy to check: for MAX-CUT it ' +
          'is edges-already-cut plus half the undecided ones.',
        example: 'The demo’s walk table shows the conditional expectation rising monotonically ' +
          'from 18.50 to the final cut of 25 — and vertex 0, where both branches are 0 and the ' +
          'expectation is unchanged, shows the argument only needs "at least as good".'
      },
      {
        term: 'The result is a greedy algorithm whose proof is the expectation argument',
        plain: 'For MAX-CUT the rule collapses to "go opposite the majority of your already-placed neighbours".',
        formal: 'choose side(v) to maximise the weight of edges to already-decided vertices on the other side',
        detail: 'Anyone would have guessed that rule; guessing it gives no bound and deriving it ' +
          'gives |E|/2 on every input. That is the general lesson about derandomisation — the ' +
          'code it produces is usually unremarkable and the guarantee it carries is not, and the ' +
          'guarantee comes entirely from where the code came from. It also means the technique ' +
          'is worth knowing even when you already have the algorithm, because it supplies the ' +
          'proof you were missing.',
        example: 'The demo’s conditional walk reaches 25 on a graph whose true maximum cut is 28 ' +
          'and whose |E|/2 bound is 18.5 — well above the bound and short of optimal, which is ' +
          'exactly what the guarantee promises.'
      },
      {
        term: 'Ask how much independence the analysis actually used',
        plain: 'The MAX-CUT expectation needs each edge’s two endpoints independent, never three vertices at once.',
        formal: 'E[cut] = Σ_edges Pr[endpoints differ], and each term involves exactly two coordinates',
        readAs: 'The expected cut is a sum over edges of the chance their two endpoints land on ' +
          'different sides, and each of those terms mentions only two of the variables.',
        detail: 'Because the expectation is a sum of terms each involving two coordinates, ' +
          'linearity means only pairwise independence is required for the whole calculation to ' +
          'go through. That observation is the general move: read the analysis, find the largest ' +
          'number of variables any single term touches, and you have the amount of independence ' +
          'the algorithm needs. Everything beyond that is randomness you are paying for and not ' +
          'using.',
        example: 'The same question in M07 gives a different answer — a Bloom filter needs no ' +
          'independence between probes, while count-min sketches need genuine pairwise ' +
          'independence per row, and getting that wrong put the measured error 2.5 times over ' +
          'its stated bound.'
      },
      {
        term: 'A pairwise-independent family has O(n) members instead of 2ⁿ',
        plain: 'The parities of every non-empty subset of ⌈log₂(n+1)⌉ random bits are pairwise independent.',
        formal: 'x_S = ⊕_{i ∈ S} s_i for each non-empty S ⊆ [k]; any two coordinates are uniform and independent',
        readAs: 'Each coordinate is the exclusive-or of the seed bits in its own index set; any ' +
          'two such coordinates are uniform and independent of each other.',
        detail: 'Two different index sets differ in at least one position, and the seed bit at ' +
          'that position appears in exactly one of the two parities — so conditioning on one ' +
          'coordinate leaves the other uniform. The family therefore has 2^⌈log₂(n+1)⌉ members, ' +
          'which is O(n), and enumerating all of them is a polynomial-time deterministic ' +
          'algorithm. This construction is also where k-wise independent hash families come from, ' +
          'so the payoff is not limited to this one problem.',
        example: 'For 16 vertices the demo builds a family of 32 assignments from 5 seed bits, ' +
          'against a full space of 65 536.'
      },
      {
        term: 'Enumerating the small space is deterministic and meets the same bound',
        plain: 'The family’s average is exactly |E|/2, so its best member is at least that.',
        formal: 'the average over the family equals E[cut] under full independence, because the expectation only used pairs',
        readAs: 'Average the cut size over every assignment in this small family and you get exactly ' +
          'the same number as E[cut] — the long-run average you would get by flipping a fair coin ' +
          'for every vertex, forever. The two agree because the calculation of that average never ' +
          'looked at more than two vertices at a time, and the family already gets every pair right.',
        detail: 'This is the payoff of the previous two concepts and it is a genuinely surprising ' +
          'result: exponentially many coin flips are replaced by a logarithmic seed, and then by ' +
          'none at all, with no loss in the guarantee. The average being exactly the bound rather ' +
          'than approximately it is the pairwise independence doing its work, and the demo ' +
          'reports it to four decimal places precisely so that it can be read rather than ' +
          'trusted.',
        example: 'The demo enumerates 32 assignments and measures their average cut at exactly ' +
          '18.5000 against a bound of 18.5, with the best at 24.'
      },
      {
        term: 'The family is provably not three-wise independent, and that is the price',
        plain: 'Three coordinates whose index sets exclusive-or to zero always have parities summing to zero.',
        formal: 'if S ⊕ T ⊕ U = ∅ then x_S ⊕ x_T ⊕ x_U = 0 always, so only 4 of the 8 patterns occur',
        readAs: 'When three index sets exclusive-or together to the empty set, the exclusive-or ' +
          'of their three parities is always zero, so half the eight possible patterns never ' +
          'appear.',
        detail: 'Knowing exactly which triples fail is the same as knowing which analyses the ' +
          'family may be substituted into — it is not a defect but the boundary of the ' +
          'construction, and the sample space is small precisely because it is only pairwise. ' +
          'Substituting a pairwise-independent family into an analysis that needs a triple ' +
          'produces a wrong bound with no error message, which is why the deviation is measured ' +
          'here rather than described.',
        example: 'The demo measures a worst pairwise deviation of exactly 0.0000 and a worst ' +
          'triple deviation of 0.1250, failing first at coordinates (0, 1, 2).'
      },
      {
        term: 'Derandomising also makes the algorithm reproducible, which is often worth more',
        plain: 'A deterministic algorithm gives the same answer on the same input, every time, forever.',
        formal: 'no seed, no seed management, no "it only fails sometimes"',
        detail: 'The guarantee is the reason derandomisation appears in the theory; ' +
          'reproducibility is usually the reason it is worth doing in production. An incident ' +
          'you cannot re-run is an incident you cannot debug, and a test that fails one time in ' +
          'twenty gets marked flaky and disabled. The best of many random draws is often better ' +
          'than the deterministic answer — the demo measures exactly that — and it is still the ' +
          'wrong thing to ship, because it has no floor and no repeatability.',
        example: 'The demo’s comparison table puts the best of 500 random draws at 26 against ' +
          'the conditional walk’s 25, and labels the first as having no guarantee at all: it is ' +
          'a maximum over an experiment rather than a bound. The MAX-SAT optimum beside it comes ' +
          'from enumerating 16 384 assignments, which is the price of certainty at 14 variables.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
