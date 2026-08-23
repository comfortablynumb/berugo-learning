/** Concepts for the structured dynamic-programming sections (M12.5-M12.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'interval-dp': [
      {
        term: 'The state is a contiguous range',
        plain: 'best[i][j] is the answer for the sub-range from i to j, and it asks where that range breaks.',
        formal: 'best[i][j] = op over k in [i, j) of combine(best[i][k], best[k+1][j], join(i, k, j))',
        readAs: 'For an interval from i to j, try every place k to split it, and combine the answers for the ' +
          'two halves with whatever the join itself costs. The round bracket means k stops just short ' +
          'of j.',
        detail: 'Matrix-chain multiplication, optimal binary search trees, palindrome partitioning and burst ' +
          'balloons are one recurrence with four join costs. Because a range of length L is built from ' +
          'ranges of length strictly less than L, the family shares an evaluation order and a shape - the ' +
          'upper triangle of a square table, filled diagonal by diagonal. Recognising the shape is worth ' +
          'more than remembering any individual member, because the join cost is then the only thing left ' +
          'to design.',
        example: 'A six-matrix chain has 15 intervals of length 2 or more, and settling all of them tests 35 ' +
          'split points in total.'
      },
      {
        term: 'Iterate by length, not by index',
        plain: 'The natural nested loop over i and j reads cells that have not been written.',
        formal: 'any reverse topological order works; increasing interval length is the simplest one',
        detail: 'A cell depends on strictly shorter intervals, so a valid order settles all of length 2, then ' +
          'all of length 3, and so on. The obvious `for i, for j` loop visits [0, n−1] long before [1, 2], ' +
          'and reads two cells still holding their initial value. The failure is a number rather than an ' +
          'error, because the table was allocated full of zeros - which makes this the interval family\'s ' +
          'version of the evaluation-order bug 12.1 names, and the reason the order is stated as data on ' +
          'the page rather than described.',
        example: 'For n = 6 the sweep settles 5 intervals of length 2, then 4 of length 3, and so on to a ' +
          'single interval of length 6 — 15 cells in all.'
      },
      {
        term: 'The lower triangle is not empty, it is absent',
        plain: 'An interval [i, j] with j < i does not exist, so a zero there is a lie.',
        formal: 'the domain is {(i, j) : i ≤ j}; cells outside it have no value, not the value zero',
        readAs: 'Only cells where the start is at or before the end mean anything. Leaving the others as zero ' +
          'rather than as "no value" is how a nonsense interval sneaks into a minimum.',
        detail: 'Half the table is not part of the problem, and treating it as unfilled-but-legitimate is how ' +
          'a mis-ordered sweep gets away with returning a plausible number. Drawing it greyed out rather ' +
          'than as zeros is not decoration - it is the difference between a reader seeing "this cell has ' +
          'not been computed yet" and "this cell is zero", and those imply different bugs. The same applies ' +
          'to any DP whose state space is a strict subset of the array holding it.',
        example: 'A six-matrix chain uses 21 of the 36 cells in its 6 × 6 table; the other 15 are ranges that ' +
          'do not exist.'
      },
      {
        term: 'Choose the state so the sides stay independent',
        plain: 'Burst balloons has no substructure under "first", and has it under "last".',
        formal: 'the correct state is "k is burst last in [i, j]", at which point its neighbours are i and j',
        detail: 'This is the milestone\'s sharpest illustration that state design is the difficulty. Asking ' +
          'which balloon is popped first fails, because popping changes adjacency and the two remaining ' +
          'sides are no longer independent problems. Asking which is popped *last* works: at that moment ' +
          'everything else in the range is gone, so its neighbours are exactly the range endpoints, and the ' +
          'two sides never interact. Same problem, one word different, and only one of them is a DP at all.',
        example: 'Eight balloons yield 2 019 coins under the last-burst state, and every burst order ' +
          'enumerated exhaustively agrees.'
      },
      {
        term: "Knuth's optimisation narrows the split range",
        plain: 'The best split for [i, j] lies between the best splits for [i, j−1] and [i+1, j].',
        formal: 'opt[i][j−1] ≤ opt[i][j] ≤ opt[i+1][j], summing to O(n²) split tests instead of O(n³)',
        readAs: 'The best split point only ever moves right as the interval grows. So instead of trying every ' +
          'k for every cell, each cell searches between its two neighbours\' answers — and those ranges ' +
          'add up to n² rather than n³.',
        detail: 'The k loop is what makes an interval DP cubic, and monotonicity of the optimal split bounds ' +
          'it. Because the ranges telescope across each diagonal, the total number of split tests over the ' +
          'whole table collapses from cubic to quadratic - the same trick as divide-and-conquer ' +
          'optimisation, specialised to intervals. It is a genuine order-of-magnitude on a real instance, ' +
          'and it is conditional on a property of the cost function rather than of the algorithm.',
        example: 'Nine keys: 156 split tests unoptimised and 72 with the narrowing, for the identical cost ' +
          'of 2.590000.'
      },
      {
        term: 'The quadrangle inequality is the precondition',
        plain: 'Knuth\'s narrowing is valid only if the interval weight satisfies w(a,c) + w(b,d) ≤ w(a,d) + w(b,c).',
        formal: 'for a ≤ b ≤ c ≤ d, the QI plus monotonicity on nested intervals implies the argmin is monotone',
        readAs: 'Given four points in order, the quadrangle inequality says that widening an interval never ' +
          'costs less than widening a narrower one inside it. That is what forces the best split point ' +
          'to move only rightwards.',
        detail: 'When the inequality fails, the narrowed range can exclude the true optimum, so the run is ' +
          'faster *and wrong* - and nothing raises, because a smaller search producing a larger minimum is ' +
          'indistinguishable from a correct one without a reference. Non-negative weights always satisfy it, ' +
          'which is why the textbook instance works and why the failure is easy to never encounter until a ' +
          'cost function grows a negative term. Testing the precondition on the actual weights is a few ' +
          'lines and is the only thing standing between the optimisation and a silent defect.',
        example: 'Flipping one of nine probabilities negative makes the inequality fail at (a, b, c, d) = ' +
          '(0, 0, 2, 4), and the optimised solver refuses rather than answering.'
      },
      {
        term: 'The precondition check needs a tolerance',
        plain: 'Interval weights are differences of prefix sums, so exact comparison rejects valid instances.',
        formal: 'w(i, j) = P[j+1] − P[i]; floating-point error accumulates in P and must be tolerated in the test',
        readAs: 'Interval weights come from differences of prefix sums, and those differences drift by tiny ' +
          'amounts in floating point. A test that demands exact equality will fail on correct code.',
        detail: 'This is a real subtlety rather than a caveat. Nine two-decimal probabilities - the textbook ' +
          'optimal-BST instance - violate the quadrangle inequality by about 1.11 × 10⁻¹⁶ purely because ' +
          'the prefix sums are computed in binary floating point. An exact `<=` therefore rejects exactly ' +
          'the case Knuth\'s optimisation was written for, and a reviewer would conclude the optimisation ' +
          'does not apply. The tolerance is not a fudge to make a test pass; it is what makes the test ' +
          'measure the mathematical property rather than the arithmetic.',
        example: 'The default nine weights violate the inequality by 1.11 × 10⁻¹⁶ and pass with a tolerance ' +
          'of 1.02 × 10⁻⁹ scaled to the total weight.'
      },
      {
        term: 'Keep the split, or lose the answer',
        plain: 'The scalar count does not say which parenthesisation achieved it.',
        formal: 'store argmin k per cell; recomputing it from the values breaks on ties',
        readAs: 'Record which split won, rather than working it out again later from the stored costs. When ' +
          'two splits tie, recomputation can pick the other one and the reconstructed answer stops ' +
          'matching its own reported cost.',
        detail: 'A matrix-chain cost is a number and the thing a caller actually wants is the order to ' +
          'multiply in. Recording the argmin as the cell is settled costs one array and makes the ' +
          'reconstruction a walk; recomputing it afterwards from the value table is possible and breaks on ' +
          'ties, because two splits achieving the same cost are indistinguishable after the fact and the ' +
          'reconstruction may pick one whose sub-splits were never the ones that produced the total.',
        example: 'The default six-matrix chain costs 18 984 scalar multiplications under the ' +
          'parenthesisation (M0 ((((M1 M2) M3) M4) M5)).'
      }
    ],

    'tree-dp': [
      {
        term: 'Children before parents',
        plain: 'A rooted tree DP is a post-order traversal, and that settles the evaluation order.',
        formal: 'any reverse of a pre-order is a valid order; a node reads only its children',
        detail: 'The evaluation-order question that dominates interval DP is trivial on a tree: a node ' +
          'depends only on its subtrees, so settling nodes in reverse discovery order is always correct. ' +
          'That leaves the state design as the entire difficulty, which is why the interesting tree DPs are ' +
          'the ones where a node needs more than one number - "best with me taken" and "best with me ' +
          'skipped" is the smallest example and generalises to any constraint between a node and its ' +
          'children.',
        example: 'Maximum-weight independent set keeps two values per node and settles a 2 000-node tree in ' +
          'one pass.'
      },
      {
        term: 'Every traversal is iterative',
        plain: 'A path of 20 000 nodes is a recursion 20 000 deep.',
        formal: 'replace the call stack with an explicit stack; depth is Θ(n) in the worst case',
        readAs: 'A path-shaped tree is n deep, and n recursive calls will overflow the engine stack. Keeping ' +
          'your own stack in an array removes the limit entirely.',
        detail: 'A random tree has depth around log n and a path has depth n, and both are legitimate inputs. ' +
          'On the sizes these sections replay, a recursive traversal is a stack overflow rather than a slow ' +
          'answer - the same lesson the M04 search trees learned when a sorted build produced a spine. The ' +
          'fix is mechanical: compute a discovery order with an explicit stack once, then walk that array ' +
          'forwards for the downward pass and backwards for the upward one.',
        example: 'The path shape at 2 000 nodes has depth 1 999; the star has depth 1 and degree 1 999. Both ' +
          'are handled by the same iterative walk.'
      },
      {
        term: 'Rerooting is prefix sums on a tree',
        plain: 'One pass down and one pass up answers for every possible root.',
        formal: 'down[v] over v\'s subtree; up[v] over everything else; answer[v] = combine(down[v], up[v])',
        detail: 'Running a tree DP from each of n roots is O(n²). Rerooting observes that moving the root ' +
          'across a single edge changes the answer in a way that can be computed from the parent\'s answer ' +
          'and the child\'s subtree, so one extra downward pass produces every root. It is the same idea as ' +
          'a prefix-sum array - compute once in each direction and every query is answered - and it is one ' +
          'of the highest-leverage patterns in the subject because "run it from every node" is such a ' +
          'natural first implementation.',
        example: 'Sum of distances on 2 000 nodes: 1 999 combine operations and two passes, against 2 000 ' +
          'separate breadth-first searches.'
      },
      {
        term: 'The reroot step for sum of distances',
        plain: 'Moving the root to a child brings size(child) nodes closer and pushes the rest further.',
        formal: 'answer[child] = answer[parent] + n − 2·size(child)',
        readAs: 'Rerooting in one line: moving the root from a parent to a child brings every node in the ' +
          'child\'s subtree one step closer and every other node one step further. That is n minus ' +
          'twice the subtree size.',
        detail: 'This single line is the whole upward pass, and it is worth deriving rather than memorising ' +
          'because the derivation is the pattern. Every node inside the child\'s subtree is one edge nearer ' +
          'once the root moves across that edge, and every node outside it is one edge further; there are ' +
          'size(child) of the first and n − size(child) of the second, so the change is ' +
          '−size + (n − size). Any rerooting problem has an equivalent line, and finding it is the ' +
          'difference between an O(n) solution and an O(n²) one.',
        example: 'On a 400-node random tree the root\'s answer is 2 159, and every other node\'s follows from ' +
          'that one line — checked against a BFS from all 400.'
      },
      {
        term: 'Prefix and suffix, not "all but one"',
        plain: 'Each node must give every child the combination of its other children, in O(deg) not O(deg²).',
        formal: 'without[k] = combine(prefix[k−1], suffix[k+1]); both arrays are one pass each',
        readAs: 'To get the combination of everything except item k, combine what came before it with what ' +
          'comes after. Two sweeps rather than one recomputation per item.',
        detail: 'This is the part that makes rerooting linear, and skipping it reintroduces the quadratic ' +
          'cost the technique exists to remove. Recomputing "everything except this child" by looping over ' +
          'the siblings is O(deg²) at that node, which on a random tree is invisible and on a star is the ' +
          'entire O(n²). Prefix and suffix arrays give all of them in two passes. The pattern generalises ' +
          'well beyond trees - it is the same move for "the product of all elements except this one" and ' +
          'for leave-one-out aggregates over shards.',
        example: 'At 2 000 nodes the rerooting costs 11 994 combines on every shape; the loop version costs ' +
          '3 998 000 on the star and only 7 994 on the path.'
      },
      {
        term: 'Prefix/suffix is insurance, and it has a premium',
        plain: 'On low-degree trees the naive loop is actually cheaper.',
        formal: 'prefix/suffix is Θ(deg) with a larger constant; the loop is Θ(deg²) with a small one',
        readAs: 'Two ways to combine all children except one. Prefix/suffix arrays scale linearly in the ' +
          'number of children but allocate; the nested loop is quadratic with almost no overhead. For ' +
          'small degrees the quadratic one wins.',
        detail: 'The honest measurement is that on a path the loop costs 7 994 operations and the ' +
          'prefix/suffix machinery costs 11 994 - it loses. On a caterpillar it loses too. It wins by 333× ' +
          'on a star, and the star is the shape a random test-tree generator will never produce. That is ' +
          'the actual trade: a constant-factor premium on the common case in exchange for not being ' +
          'quadratic on the uncommon one, and stating it that way is more useful than claiming the ' +
          'technique is uniformly better.',
        example: 'At 2 000 nodes the ratio of naive to rerooting combines is 0.7 on a path, 0.8 on a ' +
          'caterpillar, 1.0 on a random tree and 333.3 on a star.'
      },
      {
        term: 'The oracle is a BFS from every node',
        plain: 'A rerooting bug is right at the root it was computed from and wrong everywhere else.',
        formal: 'compare answer[v] against an independent single-source computation for all v',
        detail: 'This failure mode is why checking one node proves nothing. The downward pass is usually ' +
          'correct - it is an ordinary tree DP - so the root\'s answer comes out right and gives every ' +
          'confidence, while the upward pass, which is the new and subtle part, is wrong for the other ' +
          'n − 1. The only check that sees it is running the problem independently from every node, which ' +
          'is exactly the O(n²) cost the technique avoids. So the oracle runs on a smaller tree, and the ' +
          'disagreement count is a reported field rather than an exception.',
        example: 'On a 400-node tree, all 400 rerooted answers are compared against 400 separate traversals ' +
          'and 0 disagree.'
      },
      {
        term: 'Not everything on a tree is a DP',
        plain: 'The diameter is two traversals and no table at all.',
        formal: 'the farthest node from any vertex is an endpoint of some diameter; BFS twice',
        detail: 'The diameter can be computed with a tree DP - keep the two deepest child depths at each ' +
          'node - and it is more simply computed by a graph-theory argument: pick any vertex, find the ' +
          'farthest node from it, and the farthest node from *that* is the other end. Recognising when a ' +
          'problem has a structural argument that beats the table is as valuable as writing the table, and ' +
          'it is worth asking before reaching for a recurrence.',
        example: 'The 2 000-node random tree has diameter 32, found by two traversals with no per-node state ' +
          'at all.'
      }
    ],

    'bitmask-dp': [
      {
        term: 'A set in the state, written as an integer',
        plain: 'Subsets of n things are the integers below 2ⁿ, and bit operations are the set operations.',
        formal: 'mask ∈ [0, 2ⁿ); union is |, intersection is &, membership is mask & (1 << i)',
        readAs: 'A subset is stored as a number whose bits say which elements are in it. Union is bitwise OR, ' +
          'intersection is AND, and testing membership is shifting a 1 into position and masking. Set ' +
          'operations become single instructions.',
        detail: 'The representation is what makes the family practical: a set becomes an array index, so a ' +
          'table over subsets is a flat array rather than a map, and the transitions are single ' +
          'instructions. It is also what fixes the ceiling, because the table is 2ⁿ entries whatever is in ' +
          'them. Everything in this section follows from those two facts - the technique is fast in a ' +
          'narrow band of n and does not exist outside it.',
        example: 'Twelve cities give 4 096 masks and, with the current city, 49 152 table cells.'
      },
      {
        term: 'Held-Karp: (visited set, current city)',
        plain: 'Two routes visiting the same cities and ending in the same place are interchangeable.',
        formal: 'best[mask][last] = min over prev in mask of best[mask ^ (1<<last)][prev] + d(prev, last)',
        readAs: 'To reach a set of visited cities ending at `last`, come from some earlier city, having ' +
          'visited everything except `last` — which is that set with the `last` bit XORed off.',
        detail: 'The saving comes from one observation about the *future*: everything that happens after a ' +
          'partial tour depends only on which cities remain and where you are standing, not on the order ' +
          'the visited ones were taken in. So all (k−1)! orderings that reach the same set and endpoint ' +
          'collapse into one state, and (n−1)! tours become 2ⁿ·n cells. That is the general move - find the ' +
          'sufficient statistic and the factorial becomes exponential, which is an enormous improvement and ' +
          'still exponential.',
        example: 'Twelve cities: 49 152 cells against 39 916 800 tours, and at ten cities the table\'s ' +
          'answer matches every permutation enumerated.'
      },
      {
        term: 'Submask enumeration totals 3ⁿ',
        plain: 'The idiom `sub = (sub - 1) & mask` walks every subset of a mask, and the total over all masks is 3ⁿ.',
        formal: 'Σ over masks of 2^popcount(mask) = 3ⁿ, since each bit is in neither, in the submask, or in the mask only',
        readAs: 'Enumerating every subset of every subset costs 3 to the power n, not 4 — because each ' +
          'element is in exactly one of three situations. That single observation is what makes submask ' +
          'enumeration affordable.',
        detail: 'The loop looks like it is 2ⁿ inside 2ⁿ, and the natural bound people reach for is 4ⁿ. The ' +
          'true count is 3ⁿ, by a one-line counting argument: summing over (submask, mask) pairs, each of ' +
          'the n bits independently has three states. At n = 12 that is 531 441 against 16 777 216 - a ' +
          'factor of 32 - and the identity is exactly why submask DP is feasible at all. It is also exact ' +
          'rather than asymptotic, which makes it checkable.',
        example: 'Measured: 81 steps at n = 4, 6 561 at n = 8, 531 441 at n = 12 — equal to 3ⁿ at every size.'
      },
      {
        term: 'Sum over subsets is n·2ⁿ, not 3ⁿ',
        plain: 'Relax one bit at a time instead of walking every submask.',
        formal: 'for each bit b, for each mask with b set: f[mask] += f[mask ^ (1<<b)]',
        readAs: 'The subset-sum transform: one pass per bit, each folding in the value of the mask with that ' +
          'bit removed. It computes every subset total in n·2ⁿ rather than 3ⁿ.',
        detail: 'The submask loop computes "the aggregate over all subsets of each mask" directly, in 3ⁿ. ' +
          'SOS computes the identical table by absorbing one bit at a time, so after round b every entry ' +
          'has taken in the submasks differing only in bits 0…b. That is n·2ⁿ, and at n = 10 the difference ' +
          'is 5 120 operations against 59 049. The loop order is the algorithm: the bit loop must be ' +
          'outside, and swapping the two gives a partly relaxed table that looks entirely ordinary.',
        example: 'At 10 bits, SOS does 5 120 transitions and the submask walk does 59 049, and the two ' +
          'tables agree on all 1 024 entries.'
      },
      {
        term: 'Drop the redundant dimension',
        plain: 'If part of the state is a function of the rest, it is not part of the state.',
        formal: 'in the assignment problem, the worker index equals popcount(mask)',
        detail: 'Workers are filled in order, so after k jobs have been assigned exactly k workers have been ' +
          'used, and the worker index carries no information the mask does not already have. Removing it ' +
          'takes the table from n·2ⁿ to 2ⁿ - a factor of n in both time and memory, from an observation ' +
          'that takes ten seconds. In a family with a hard memory ceiling that factor is often the ' +
          'difference between the approach existing and not, which is why the state deserves a second look ' +
          'before any code is written.',
        example: 'Eight workers and eight jobs: 256 states rather than 2 048, and the optimum of 36 matches ' +
          'exhaustive enumeration of all 40 320 assignments.'
      },
      {
        term: 'Broken profile: the frontier is the state',
        plain: 'Fill cell by cell and carry the boundary between filled and unfilled as a mask.',
        formal: 'the state is (cell index, profile of the m-cell frontier), so 2^m states per column',
        readAs: 'Broken-profile DP carries the boundary between the solved and unsolved parts as a bitmask. ' +
          'The cost is exponential in the width of that boundary and linear in the length, so you ' +
          'orient the grid to make the width the smaller dimension.',
        detail: 'Tiling problems look like they need the whole partial board in the state and need only the ' +
          'frontier - the cells whose fate is not yet settled. That is m bits for an m-wide board, and it ' +
          'is why the *narrow* side must be the one in the state: a 2 × 12 board has 4 profiles and a ' +
          '12 × 2 board has 4 096. Transposing the input is a one-line decision worth three orders of ' +
          'magnitude, and it is the kind of thing only noticed by writing down the state size first.',
        example: 'A 2 × 12 board has 233 tilings — Fibonacci(13) — and an 8 × 8 board has 12 988 816.'
      },
      {
        term: 'The wall is memory, and it is a number',
        plain: '2ⁿ·n cells at eight bytes is 6.7 GB by n = 25.',
        formal: 'bytes = 8 · n · 2ⁿ; the ceiling is set by allocation, not by time',
        readAs: 'The table is n times 2 to the n entries, eight bytes each. At n = 20 that is 168 MB — you ' +
          'run out of memory long before you run out of patience.',
        detail: '"It does not scale" is unfalsifiable and useless for deciding. The table is 393 KB at ' +
          'n = 12, 168 MB at n = 20, 738 MB at n = 22 and 6.7 GB at n = 25 - and no improvement to the ' +
          'inner loop moves any of those. Working the number out before writing code tells you whether the ' +
          'approach exists at all, and past the ceiling the answer is a different algorithm - branch and ' +
          'bound, or an approximation - rather than a faster bitmask DP.',
        example: 'n = 20 is 20 971 520 cells and 168 MB; n = 25 is 838 860 800 cells and 6.7 GB.'
      },
      {
        term: 'Popcount is not free, and often is not needed',
        plain: 'Counting bits inside the inner loop is a cost; deriving it from the loop index is not.',
        formal: 'iterate masks in increasing order and popcount is either precomputed or implied by the order',
        detail: 'The assignment DP needs popcount(mask) at every state, and calling a bit-counting loop there ' +
          'multiplies the transition cost by n. Precomputing the whole popcount array is 2ⁿ integers and ' +
          'one pass, or the value can be carried along the transition since adding one bit adds one to the ' +
          'count. This is the same class of decision as choosing the narrow side of a tiling board: small, ' +
          'mechanical, and decisive in a family where the state count is already at the limit.',
        example: 'Eight workers: the popcount is needed at every one of the 256 states, and computing it ' +
          'from the transition rather than by counting bits removes a factor of eight.'
      }
    ],

    'digit-dp': [
      {
        term: 'Walk the representation, not the values',
        plain: 'Counting numbers in a huge range means walking the bound\'s digits, not the range.',
        formal: 'state is (position, property state, tight), so the cost is Θ(digits · |property| · 2)',
        readAs: 'Digit DP walks the number one digit at a time, carrying whatever the property needs plus one ' +
          'bit for whether you are still hugging the upper bound. The cost is digits, not the value — ' +
          'which is the entire point.',
        detail: 'This is the general move and it goes far beyond numbers: when a range is too large to ' +
          'iterate, count over the structure that describes its members instead. For integers that ' +
          'structure is the decimal expansion, so the cost depends on how many digits the bound has rather ' +
          'than on how large it is. The recognition test is simple - if the bound appears in the size of ' +
          'your loop rather than in the number of digits of your loop, there is a representation walk ' +
          'hiding underneath.',
        example: 'Counting numbers with no two equal adjacent digits: 25 states up to 1 000 and 190 states ' +
          'up to 10¹⁸, for counts of 820 and 168 856 464 709 123 940.'
      },
      {
        term: 'The tight flag',
        plain: 'Tight means every digit so far equals the bound\'s, so the next one is capped.',
        formal: 'tight ∧ digit = bound[i] ⟹ still tight; digit < bound[i] ⟹ free for every later position',
        readAs: 'While you are matching the limit digit for digit you are constrained; the moment you pick ' +
          'anything smaller, every later digit is unconstrained. The ∧ is "and", the ⟹ is "which ' +
          'means".',
        detail: 'This is the only subtle part of the technique and the only part that goes wrong. Drop the ' +
          'flag and the count runs past the bound; freeze it on and the count stops at the bound\'s own ' +
          'prefix. It also explains the memoisation rule: a tight state lies on exactly one path - the ' +
          'bound\'s prefix - so there is nothing to reuse and at most one exists per position, while free ' +
          'states are shared across an enormous number of prefixes and are the only ones worth caching.',
        example: 'Counting to 4 321, the first digit ranges 0…4; choosing 3 releases the cap and the ' +
          'remaining three digits range 0…9 freely.'
      },
      {
        term: 'The property is a DFA',
        plain: 'Once the property is an automaton, one counting walk serves every property.',
        formal: '(start, step(state, symbol) → state | reject, accepting(state))',
        detail: 'Writing the property as a state machine separates what is being counted from how the ' +
          'counting works, and it collapses a family of ad-hoc solutions into one. "No two equal adjacent ' +
          'digits" remembers the previous digit; "digit sum divisible by 3" remembers a residue; "contains ' +
          '13" is a two-state matcher. It also matters that rejecting a transition and reaching a ' +
          'non-accepting state are different mechanisms: the first prunes, the second is decided at the ' +
          'end, and a property may need either or both.',
        example: 'Four properties over 137…4 321 give 3 155, 185, 1 395 and 184 — all from the same walk ' +
          'with a different automaton.'
      },
      {
        term: 'Leading zeros, and the number zero',
        plain: 'A `started` flag stops 007 counting twice, and it is where the off-by-one lives.',
        formal: 'the automaton is fed only once a non-zero digit appears; the all-zeros path IS the value zero',
        detail: 'Padding the bound to a fixed length means shorter numbers appear as prefixes of zeros, so ' +
          'the walk needs to know whether the number has begun. The natural termination - "count this if it ' +
          'started and the automaton accepts" - never counts zero itself, so every prefix count comes out ' +
          'one short on any property that accepts zero. Ranges still agree, because the error cancels in ' +
          'the subtraction, which is precisely why this bug survives testing. It is found only by counting ' +
          'one at a time.',
        example: 'Zero is accepted by "no equal adjacent digits" and by "strictly increasing", and rejected ' +
          'by "contains 13" — so the naive termination is one short on two of the four properties.'
      },
      {
        term: 'An inclusive range is two counts and a subtraction',
        plain: 'count(L, R) = count(0, R) − count(0, L−1), and L−1 is where the off-by-one lives.',
        formal: 'the prefix-count function is monotone, so the range count is a difference of prefixes',
        readAs: 'Count everything up to the high end, count everything below the low end, subtract. The same ' +
          'trick as a prefix sum, applied to a counting problem.',
        detail: 'Writing the subtraction once, in the module, rather than at every call site is a small ' +
          'discipline with a large payoff, because `low - 1` is exactly the kind of expression that gets ' +
          'typed as `low` in one place out of five. It also interacts with the zero bug above in a way ' +
          'worth understanding: a prefix count that is uniformly one short still gives correct ranges, so ' +
          'range tests cannot find the defect and only prefix tests can.',
        example: 'For 137…4 321 with no equal adjacent digits: 3 270 up to 4 321 minus 115 up to 136 gives ' +
          '3 155, matching a one-by-one count exactly.'
      },
      {
        term: 'DP over a DAG, where the DAG is the input',
        plain: 'A topological order turns longest path from NP-hard into linear.',
        formal: 'process nodes in topological order; each edge relaxes its target exactly once',
        detail: 'Longest path is NP-hard on a general graph and linear on a DAG, and the entire difference ' +
          'is that a DAG has a topological order. It is the clearest statement available of "a DP is a walk ' +
          'over a DAG of subproblems", because here the DAG is given rather than implied by a recursion - ' +
          'there is no recursion to look at, only an order and a relaxation. The same walk counts paths, ' +
          'finds shortest paths, and propagates any monoid.',
        example: 'A 14-node random DAG: longest path 14 over three nodes, and 11 distinct paths from node 0, ' +
          'both from a single topological sweep.'
      },
      {
        term: 'Counting can overflow, and should say so',
        plain: 'Path counts on a dense DAG exceed the safe integer range without any warning.',
        formal: 'report whether every count stayed ≤ 2^53 − 1 rather than returning a rounded double',
        readAs: 'Counting problems overflow the exactly-representable integer range quickly, and a rounded ' +
          'answer looks exactly like a right one. Report whether the bound held.',
        detail: 'JavaScript numbers are exact integers only up to 2^53 − 1, and a path count doubles with ' +
          'depth. Past that the arithmetic silently rounds, so the returned counts are approximately right ' +
          'and never flagged - which is the worst kind of numeric failure because it looks like a correct ' +
          'answer. Reporting an `exact` flag alongside the counts costs one comparison per entry and turns ' +
          'a silent corruption into a visible one.',
        example: 'The 14-node DAG totals 11 paths and reports exact; a denser or deeper graph would report ' +
          'the same shape of answer with the flag cleared.'
      },
      {
        term: 'Automaton DP is digit DP without the bound',
        plain: 'Counting the strings a DFA accepts is the same walk with the tight flag removed.',
        formal: 'push a distribution over automaton states forward one symbol at a time for L steps',
        detail: 'Remove the bound and the tight flag has nothing to do, leaving a walk that carries how many ' +
          'ways each automaton state can be reached at each position. That is the standard way to count ' +
          'strings with a property, it is a matrix power in disguise, and it is the bridge to M24 - the ' +
          'automata there are exactly the properties here. Seeing the two as one algorithm is what makes ' +
          'both feel routine rather than clever.',
        example: 'Four-digit strings with no two equal adjacent digits: 7 290, which is 10 × 9³ exactly.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
