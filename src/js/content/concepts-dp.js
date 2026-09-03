/** Concepts for the first four dynamic-programming sections (M12.1-M12.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'what-dp-is': [
      {
        term: 'Optimal substructure',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the best answer for n"] --> B["is built out of the best<br/>answers for smaller n"]',
            '    B --> C["so a smaller answer, once found,<br/>is never revised"]',
            '    C --> D["which is what licenses<br/>storing it and moving on"]',
            '    D --> E["without this property, a table<br/>would be caching wrong answers"]'
          ].join('\n'),
          caption: 'This is the precondition, not a description. If a better global answer could be built from a worse local one, the whole method quietly returns nonsense.'
        },
        plain: 'An optimal answer is built out of optimal answers to smaller versions of the same problem.',
        formal: 'opt(s) = best over transitions t of combine(cost(t), opt(child(s, t)))',
        readAs: 'The best answer at a state is the best you can do over every move available ' +
          'from it. Take the cost of the move, and combine it with the best answer at wherever ' +
          'the move leads. Every DP in this milestone is that one sentence with different words ' +
          'for state, move and combine.',
        detail: [
          'This is the property that makes the recurrence *correct*, and it is the one people ' +
            'assume rather than check.',
          'It fails more often than it looks. Burst balloons has no optimal substructure under ' +
            '"which balloon do I pop first", because popping changes who is adjacent to whom and ' +
            'the two sides stop being independent.',
          'The test is whether an optimal solution to the whole necessarily contains an optimal ' +
            'solution to the part. If you can improve the part without disturbing the rest, it ' +
            'holds. If improving the part changes what the rest even means, it does not.'
        ],
        example: 'The shortest path from A to C through B contains the shortest path from A to B, so shortest ' +
          'paths have it. The *longest simple* path does not: the longest A-to-B walk may use up vertices the ' +
          'B-to-C leg needed.'
      },
      {
        term: 'Overlapping subproblems',
        plain: 'The same subproblem is needed more than once, so remembering it is worth something.',
        formal: 'the subproblem graph is a DAG in which some node has in-degree greater than one',
        detail: [
          'This is the property that makes memoisation *worth it*, and it is entirely separate ' +
            'from optimal substructure.',
          'Merge sort has optimal substructure and no overlap. Every subproblem is a distinct ' +
            'slice, nothing recurs, and memoising it buys nothing but memory.',
          'Fibonacci has enormous overlap. At n = 25 the memo answers 23 of its 49 calls from the ' +
            'table, and 23 of the 26 states have more than one parent.',
          'The measurement that distinguishes the two is the count of states with in-degree above ' +
            'one, which is why this platform reports it as a number rather than a description.'
        ],
        example: 'At n = 25, Fibonacci has 26 distinct states of which 23 are reached from more than one ' +
          'parent. Merge sort at any size has zero.'
      },
      {
        term: 'The subproblem DAG',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["each subproblem is a node"] --> B["each dependency is an edge"]',
            '    B --> C["no cycles, or nothing<br/>could ever be computed first"]',
            '    C --> D["top-down = walk it lazily<br/>and memoise"]',
            '    C --> E["bottom-up = walk it in<br/>topological order"]'
          ].join('\n'),
          caption: 'Memoisation and tabulation are not two techniques. They are two traversal orders over the same graph, and which one is cheaper depends on how much of it you actually need.'
        },
        plain: 'A DP is a walk over a directed acyclic graph whose nodes are subproblems.',
        formal: 'nodes are states, edges are transitions, and the evaluation order is any reverse topological order',
        detail: [
          'Drawing the DAG turns three separate questions into one picture.',
          'Is there overlap? Count the nodes with several parents. What is the complexity? Count ' +
            'nodes and edges. What order must the table be filled in? Any reverse topological ' +
            'order, and no other.',
          'It also explains why a cyclic dependency is not a hard DP but a different kind of ' +
            'problem entirely. If a state can reach itself there is no topological order and no ' +
            'recursion, and the answer is a linear system.'
        ],
        example: 'The Fibonacci DAG is a ladder: F(n) points at F(n−1) and F(n−2), and F(n−1) points at ' +
          'F(n−2) as well — that shared edge is the whole reason the memo works.'
      },
      {
        term: 'States × transitions is the complexity',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["how many subproblems are there?"] --> C["multiply the two"]',
            '    B["how many predecessors<br/>does each one read?"] --> C',
            '    C --> D["that is the running time,<br/>before writing any code"]',
            '    D --> E["so a DP is designed by counting,<br/>not by measuring afterwards"]'
          ].join('\n'),
          caption: 'You can price a dynamic program from its state definition alone. If the number is too big, the fix is a different state — not a faster inner loop.'
        },
        plain: 'Multiply how many subproblems there are by how many predecessors each looks at.',
        formal: 'time = Θ(|S| · b) where b is the branching factor of the transition relation',
        readAs: 'The running time is the number of distinct states times the moves available from ' +
          'each. The bars mean "how many". That product is the whole cost model, which is why ' +
          'shrinking the state is the only optimisation that matters.',
        detail: [
          'This is the single most useful habit in the subject, and it costs ten seconds.',
          'Say the state out loud, count how many there are, count how many predecessors each one ' +
            'reads, and multiply.',
          'That product is the running time, the memory before any reduction, and a correctness ' +
            'argument, all at once. Having it *before* writing code is what stops you implementing ' +
            'an O(n³) solution to an O(n log n) problem and then tuning the constant.',
          'If you cannot say the sentence, you do not yet know what you are memoising.'
        ],
        example: '0/1 knapsack: the state is (items considered, capacity left), so n·C states, two ' +
          'transitions each — O(nC), which you can say before writing a line.'
      },
      {
        term: 'Memoisation and tabulation are one algorithm',
        plain: 'A memo works the evaluation order out at run time; a table requires you to know it in advance.',
        formal: 'top-down with a cache, versus bottom-up in a topological order chosen by hand',
        detail: [
          'The distinction is not about speed and barely about memory. It is about who is ' +
            'responsible for the order.',
          'A memo recurses until it hits a base case, so the order is discovered and is always ' +
            'correct.',
          'A tabulation demands that you have already worked out an order in which every cell\'s ' +
            'dependencies are written before it is read. Getting that wrong does not raise: the ' +
            'array was allocated full of zeros, so the run finishes and returns a number computed ' +
            'from cells that did not exist yet.',
          'Tabulation is usually faster by a constant, and it is where the order bugs live.'
        ],
        example: 'Filling the Fibonacci table from n down to 0 visits exactly the same 26 states and returns ' +
          '0, having read 48 cells before they were written.'
      },
      {
        term: 'The state is the design; the recurrence follows',
        plain: 'Almost all the difficulty is in choosing what to remember, not in writing the transition.',
        formal: 'a state must be a sufficient statistic: everything the future depends on and nothing else',
        readAs: 'A state has to carry every piece of the past that still affects what happens ' +
          'next, and nothing more. Too little and the recurrence is wrong. Too much and the table ' +
          'is larger than it needs to be.',
        detail: [
          'A state has to carry exactly the information the remaining decisions depend on.',
          'Too little and the recurrence is wrong: it will conflate positions that behave ' +
            'differently. Too much and the state space explodes for no benefit, which is the usual ' +
            'reason a correct DP is unusably slow.',
          'The discipline is to write the state as an English sentence first. "The cheapest way to ' +
            'have processed the first i items with j capacity left."',
          'If the sentence needs an "and also", that is another dimension and it belongs in the ' +
            'state. If a dimension never appears on the right-hand side of the recurrence, it does ' +
            'not belong there at all.'
        ],
        example: 'The assignment problem\'s state looks like (worker, set of jobs used) and ' +
          'is really just (set of jobs used). The worker index is `popcount(mask)`, which takes ' +
          'the state space from n·2ⁿ to 2ⁿ.'
      },
      {
        term: 'DP is not divide and conquer',
        plain: 'Both split a problem; only one of them has parts that recur.',
        formal: 'divide and conquer partitions into disjoint subproblems; DP revisits shared ones',
        detail: [
          'Merge sort, quicksort and Karatsuba split into pieces that are never seen again, so ' +
            'there is nothing to remember and no table.',
          'The confusion matters because it points at the wrong tool. Memoising a ' +
            'divide-and-conquer algorithm adds memory and a hash lookup and saves nothing, while ' +
            'failing to memoise a genuine DP is the difference between 26 states and 242 785 ' +
            'calls.',
          'The diagnostic is the DAG again. If every node has exactly one parent it is a tree, and ' +
            'a tree is divide and conquer.'
        ],
        example: 'Merge sort on 2 000 elements creates 3 999 subproblems and revisits none of them; ' +
          'Fibonacci at n = 25 creates 26 and revisits them 23 times.'
      },
      {
        term: 'A capped run must say it was capped',
        plain: 'An unfinished search reported as a number is worse than no number.',
        formal: 'report budgetExhausted alongside the count, and never treat a truncated count as a measurement',
        detail: [
          'The exponential runs on this platform are bounded, because an unmemoised Fibonacci at ' +
            'n = 45 is about a billion calls and a dead browser tab.',
          'The rule that makes the bound honest is that the row says so. The answer reads ' +
            '"stopped" rather than a smaller number, and the call count carries a plus sign.',
          'This is the same rule the sketches, the Sudoku matrix and the adversarial searches ' +
            'elsewhere on this platform follow. It exists because a truncated measurement ' +
            'presented as a complete one is the most persuasive kind of wrong.'
        ],
        example: 'The naive Fibonacci row at n = 40 with a 100 000-call budget reports "stopped" and ' +
          '100 029+ calls, not a plausible-looking value.'
      }
    ],

    'one-dimensional-dp': [
      {
        term: 'dp[i] needs a sentence before it needs code',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["write the sentence:<br/>dp[i] is the best answer for<br/>the prefix ending at i"] --> B["the transitions are now forced"]',
            '    B --> C["and so is the base case"]',
            '    B --> D["and so is what the answer is<br/>at the end"]',
            '    E["skip the sentence"] --> F["and every one of the three<br/>becomes a guess"]'
          ].join('\n'),
          caption: 'Almost every dynamic programming bug is a state definition that was never written down in words, so the transitions were fitted to the examples instead.'
        },
        plain: 'Write down exactly what dp[i] means, and the transitions become forced.',
        formal: 'define dp: index → value, then derive transitions from the definition rather than from intuition',
        detail: [
          'Every recurrence in this section is immediate once its state sentence is precise, and ' +
            'impossible to get right when it is vague.',
          '"The best answer using the first i elements" and "the best answer *ending at* i" are ' +
            'different definitions, with different recurrences and different answers. Confusing ' +
            'them is the most common one-dimensional DP bug.',
          'The sentence is also what tells you where the final answer is. The first definition ' +
            'puts it at dp[n]; the second requires a maximum over all i.'
        ],
        example: 'Kadane\'s dp[i] is "the best sum of a subarray ending at i". So the answer ' +
          'is the maximum over all i, not dp[n] — a different and usually wrong number.'
      },
      {
        term: 'Kadane is a recurrence, not a trick',
        plain: 'Maximum subarray is a one-line DP with the table thrown away.',
        formal: 'dp[i] = max(a[i], dp[i−1] + a[i]); answer = max over i of dp[i]',
        readAs: 'At each position, either start a fresh run here or extend the previous one — ' +
          'whichever is larger. The answer is the best value any position reached, not the last ' +
          'one.',
        detail: [
          'It is taught as a clever scan, and it is an ordinary DP whose table happens to be a ' +
            'single variable, because dp[i] depends only on dp[i−1].',
          'Seeing it that way is worth more than memorising it. The same collapse applies to any ' +
            'recurrence with bounded look-back, and recognising when a table can be dropped to ' +
            'O(1) is exactly the skill the knapsack section needs.',
          'It also makes the reconstruction obvious. Track where the current run started, because ' +
            'the value alone does not say which subarray achieved it.'
        ],
        example: 'On a 2 000-element sequence the answer is 502 781 over the range [0, 1999], and the ' +
          'quadratic scan over every (i, j) pair agrees exactly.'
      },
      {
        term: 'Coin change: the loop order is the question',
        plain: 'Coin outside counts combinations; amount outside counts permutations. One line apart.',
        formal: 'combinations: for each coin, for each amount. permutations: for each amount, for each coin',
        detail: [
          'This is the cleanest example in the milestone of a change that is invisible in the code ' +
            'and total in the semantics.',
          'With the coin loop outside, each coin is offered to every amount once, and the multiset ' +
            '{1, 2, 2} is counted a single time.',
          'With the amount loop outside, every amount considers every coin, so the orderings ' +
            '1+2+2, 2+1+2 and 2+2+1 are three different ways.',
          'Neither raises. Both are correct answers to different questions, and the only way to ' +
            'know which one you wrote is to check it against an enumeration.'
        ],
        example: 'Making 5 from {1, 2, 5}: 4 combinations, 9 permutations. At 20 it is 29 against 26 547.'
      },
      {
        term: 'The patience piles are not the answer',
        plain: 'The `tails` array is increasing and exactly the right length, and usually not a subsequence.',
        formal: 'tails[k] is the smallest value ending an increasing subsequence of length k+1, not a member of any one of them',
        detail: [
          'This is the trap the LIS exercise exists for.',
          'Patience sorting maintains an array that is increasing, whose length is the answer, and ' +
            'whose contents are individually all from the input. So it passes a length check, a ' +
            'sortedness check and a casual read.',
          'It is nevertheless a summary of what is achievable rather than a witness of it. The ' +
            'values may come from positions that cannot coexist in one subsequence.',
          'Reconstruction needs predecessor links recorded as the piles are updated, and the check ' +
            'that separates the two is whether the returned list is a genuine subsequence of the ' +
            'input.'
        ],
        example: 'On the default 2 000-element sequence, the piles start 0, 3, 6, 8 and the ' +
          'real answer starts 1, 5, 11, 18. Same length, and only one is a subsequence.'
      },
      {
        term: 'Reconstruction fails loudly; values fail silently',
        plain: 'Ask a DP for its answer, not only its score, because the answer can be checked.',
        formal: 'a witness admits an independent verification predicate; an optimum does not',
        detail: [
          'An optimal value is a single number with nothing to compare it against, short of ' +
            'another implementation.',
          'A reconstructed answer can be checked against the problem statement directly. Is this ' +
            'list increasing? Is it a subsequence of the input? Does this item set fit the ' +
            'capacity? Do these alignment rows strip back to the two strings?',
          'Every one of those checks is a few lines, and each catches a class of bug the value ' +
            'never will. That is why the exercises in this milestone grade the witness rather than ' +
            'the score.'
        ],
        example: 'A patience-sorting implementation returning `tails` has the right length on every input and ' +
          'fails "is this a subsequence" on most of them.'
      },
      {
        term: 'Rolling the table down to O(1)',
        plain: 'When dp[i] reads only a bounded window, keep the window instead of the table.',
        formal: 'a recurrence with look-back k needs Θ(k) live state, not Θ(n)',
        readAs: 'If each entry only reads the last k entries, only k of them need to still exist. ' +
          'The rest of the table is history you are paying to keep.',
        detail: [
          'Fibonacci needs two variables, house robber needs two, Kadane needs one.',
          'The saving is real, and it costs exactly one thing: the traceback, which walks ' +
            'backwards through cells that no longer exist.',
          'Deciding up front whether the caller wants the answer or only its value is what keeps ' +
            'that trade honest. A reduced table with the traceback code left in place returns a ' +
            'plausible reconstruction of nothing at all.'
        ],
        example: 'Fibonacci at n = 25 holds 21 cells as a table and 2 rolling, and returns 75 025 either way.'
      },
      {
        term: 'Impossible is not a large number',
        plain: 'Report unreachable as null rather than as Infinity or a sentinel.',
        formal: 'the codomain of a min-DP is value ∪ {⊥}, and ⊥ must not be comparable with values',
        readAs: 'A minimising table holds either a real value or "unreachable" — the ⊥ — and the ' +
          'two must never be compared. Using a large number for unreachable instead is what makes ' +
          'an impossible path win a minimum.',
        detail: [
          'Coin change with an amount no coin combination can make, and jump games where the end ' +
            'is unreachable, both need an answer that is not a number.',
          'Using Infinity works inside the recurrence and leaks the moment it is returned. A ' +
            'caller that formats it, sums it or compares it against a budget silently treats ' +
            '"impossible" as "very expensive".',
          'Returning null forces the caller to decide, which is the correct place for that ' +
            'decision.'
        ],
        example: 'Making 3 from {2, 5} returns null and an empty coin list, not Infinity and a list ' +
          'reconstructed from a sentinel.'
      },
      {
        term: 'The quadratic version is not obsolete',
        plain: 'Keep the O(n²) LIS: it is the oracle for the fast one.',
        formal: 'a reference implementation whose failure mode differs from the optimised one is a test, not dead code',
        detail: [
          'The O(n²) table and the O(n log n) piles compute the same answer by completely ' +
            'different means. A bug in one is extremely unlikely to be present in the other.',
          'That makes the slow version the cheapest correctness check available, and the ' +
            'transition counts alongside it are what justify the fast version being there at all.',
          'This is the same argument the brute-force oracles elsewhere on this platform make, and ' +
            'it is why "delete the slow one, it is redundant" is usually a mistake.'
        ],
        example: 'At n = 2 000 both report length 85, from 1 999 000 transitions and 11 411 respectively — a ' +
          'factor of 175.'
      }
    ],

    'knapsack-family': [
      {
        term: 'The state is (items considered, capacity left)',
        plain: 'Two axes, two incoming edges per cell, and the complexity falls out of that.',
        formal: 'best[i][c] = max(best[i−1][c], best[i−1][c − w_i] + v_i)',
        readAs: 'For each item and each capacity, take the better of skipping the item or taking it — and ' +
          'taking it means looking up the best answer with that much less capacity left.',
        detail: 'Every member of the family is this recurrence with one thing changed. The two edges are ' +
          '"skip item i", which is the cell directly above, and "take item i", which is one row up and ' +
          'w_i columns left. Because there are exactly two, the running time is the number of cells: items ' +
          'times capacity. Writing that down before coding is the habit 12.1 argues for, and here it also ' +
          'tells you immediately that a capacity of 10⁹ is not a slow program but an impossible table.',
        example: 'Twelve items and a capacity of 60 is 793 cells and an optimal value of 571, which ' +
          'exhaustive enumeration over all 4 096 subsets confirms.'
      },
      {
        term: 'The loop direction chooses the problem',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["iterate capacity downward"] --> B["each item is read from the<br/>row before it was updated"]',
            '    B --> C["so each item is used at most once —<br/>this is 0/1 knapsack"]',
            '    D["iterate capacity upward"] --> E["an item can be read from a cell<br/>it already updated this pass"]',
            '    E --> F["so items may repeat —<br/>this is unbounded knapsack"]'
          ].join('\n'),
          caption: 'One character of difference between two different problems, with no error either way. It is the clearest example on the platform of why the state definition has to be explicit.'
        },
        plain: 'Descending capacity is 0/1; ascending is unbounded. One character apart.',
        formal: 'descending reads best[c − w] from the previous row; ascending reads it from the row being written',
        detail: 'Once the table is collapsed to one row, the iteration direction decides whether an item can ' +
          'be used more than once, because it decides whether `best[c − w]` still holds the previous row\'s ' +
          'value or has already been updated with this item. Descending preserves the previous row and gives ' +
          '0/1; ascending lets an item feed itself and gives unbounded. Neither direction raises, both ' +
          'produce a sensible-looking optimum, and the difference is invisible in review unless you know to ' +
          'look for it.',
        example: 'The same twelve items and capacity 60 give 571 descending and a larger value ascending, ' +
          'because the ascending run may take one item repeatedly.'
      },
      {
        term: 'Space reduction deletes the reconstruction',
        plain: 'One row keeps the value exactly and destroys the information a traceback walks.',
        formal: 'a traceback requires every column of best[i−1] at every i; a rolling array holds only the current row',
        detail: 'This is the failure in the family that produces a plausible answer rather than an error. The ' +
          'one-row version is correct about the optimum and has no rows to walk backwards through, so ' +
          'traceback code left unchanged after the reduction returns an item list that does not sum to the ' +
          'reported value and may not even fit the sack. The honest interface returns no chosen set at all ' +
          'rather than a wrong one, and the check that catches it in either case is recomputing the weight ' +
          'and value of whatever was returned.',
        example: 'Twelve items at capacity 60: the full table holds 793 cells and reconstructs 8 items ' +
          'weighing 59; the one-row version holds 61 cells, reports the same 571, and returns no set.'
      },
      {
        term: 'Pseudo-polynomial: polynomial in the wrong input',
        plain: 'O(n·C) is linear in the capacity\'s value and exponential in its number of digits.',
        formal: 'input size is Θ(log C) bits, so Θ(nC) = Θ(n·2^(log C)) is exponential in the input length',
        readAs: 'The capacity C is written down in about log C digits, so a running time proportional to C is ' +
          'exponential in how long the input actually is. That is what "pseudo-polynomial" means, and ' +
          'it is why knapsack is still NP-hard.',
        detail: 'Complexity is measured against the length of the input, and a capacity is written down in ' +
          'about log₂C bits rather than in C of anything. So a table proportional to C grows by a factor of ' +
          'ten each time the capacity gains one decimal digit, while the input file grows by one character. ' +
          'That is what "weakly NP-hard" names, and stating it as the two columns - digits and cells - makes ' +
          'it a fact you can read rather than a phrase you have to trust.',
        example: 'Twelve items: capacity 10 is 132 cells and 4 bits; capacity 100 000 is 1 200 012 cells and ' +
          '17 bits. Four more characters of input, ten thousand times the work.'
      },
      {
        term: 'Binary splitting for bounded counts',
        plain: 'Bundle 1, 2, 4, … copies so any count is a subset of ⌊log₂k⌋+1 bundles.',
        formal: 'every integer in [0, k] is representable as a subset sum of {1, 2, 4, …, k − 2^m + 1}',
        readAs: 'Any count up to k can be built from powers of two plus one remainder, so an item available k ' +
          'times can be replaced by about log k items. That turns a bounded knapsack into a 0/1 one.',
        detail: 'Expanding forty copies of an item into forty 0/1 items is correct and pays forty times over. ' +
          'Binary splitting bundles them into powers of two plus a remainder, which is enough to represent ' +
          'every achievable count exactly - so the answer does not change and the item list shrinks ' +
          'logarithmically. It is the same idea as binary representation of integers, applied to "how many ' +
          'of this thing", and it is the standard first move whenever a multiplicity appears in a DP.',
        example: 'Six item types with forty copies each: 240 expanded items and 11 800 transitions, against ' +
          '36 bundles and 621 — the same optimal value of 910.'
      },
      {
        term: 'The monotonic queue removes the count entirely',
        plain: 'Cells sharing a residue modulo the weight form a chain, and the best predecessor is a sliding maximum.',
        formal: 'for fixed w, {c : c ≡ r mod w} is a chain in which the transition is a window maximum of width k',
        readAs: 'Capacities that leave the same remainder when divided by the item weight form an independent ' +
          'chain, and along each chain the recurrence is a sliding-window maximum. That is what removes ' +
          'a factor of k.',
        detail: 'This is the point at which bounded knapsack stops depending on the copy count at all. For ' +
          'one item, only cells whose capacities differ by multiples of its weight can reach each other, so ' +
          'the table decomposes into independent chains; within a chain, "the best of the previous k ' +
          'positions" is exactly the sliding-window maximum that M11.7 solves in amortised O(1). The result ' +
          'is O(capacity) per item whether it has three copies or three million, which neither expansion ' +
          'strategy can match.',
        example: 'The same six item types at forty copies: 366 transitions and no expansion at all, against ' +
          '621 for binary splitting and 11 800 for full expansion.'
      },
      {
        term: 'Subset sum is the same table without the values',
        plain: 'Reachability instead of optimisation, and the recurrence does not change.',
        formal: 'reachable[c] = reachable[c] ∨ reachable[c − w_i], over the same iteration order',
        readAs: 'Subset sum is knapsack with the values thrown away: a capacity is reachable if it already ' +
          'was, or if it is reachable after removing this item. The ∨ is "or", and it is a boolean ' +
          'table rather than a numeric one.',
        detail: 'Dropping the value column turns the knapsack into "which totals can be made", which is ' +
          'subset sum, equal partition and the coin-change feasibility question all at once. It is worth ' +
          'seeing as one recurrence rather than three problems, because everything learned about the ' +
          'knapsack - the loop direction, the space reduction, the traceback, the pseudo-polynomial ' +
          'caveat - transfers unchanged. Equal partition is then just subset sum aimed at half the total.',
        example: 'The twelve items\' weights total 109, so no equal split exists; the closest reachable half ' +
          'is 54, leaving a difference of 1.'
      },
      {
        term: 'Verify the set, not the number',
        plain: 'Recompute the weight and value of whatever was returned, every time.',
        formal: 'assert Σw(chosen) ≤ C and Σv(chosen) = reported value',
        readAs: 'Two checks on the reconstructed answer: the chosen items really do fit, and their values ' +
          'really do add up to the number reported. A traceback bug fails one or the other.',
        detail: 'A knapsack solver has two outputs and only one of them can be checked cheaply against the ' +
          'problem statement. The value is a bare number; the chosen set can be re-summed in three lines, ' +
          'and that check catches a traceback walked over a reduced table, an off-by-one in the decision ' +
          'array, and a tie broken towards the wrong item. It costs nothing and it is the difference ' +
          'between a test that would notice a space reduction going wrong and one that would not.',
        example: 'The default instance reports 571; re-summing the eight chosen items gives weight 59 against ' +
          'a capacity of 60 and value 571 exactly.'
      }
    ],

    'sequence-alignment': [
      {
        term: 'Three predecessors, three operations',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the cell above — a deletion"] --> D["take the cheapest of the three"]',
            '    B["the cell to the left — an insertion"] --> D',
            '    C["the diagonal — a match<br/>or a substitution"] --> D',
            '    D --> E["every cell in the table<br/>is that one decision"]'
          ].join('\n'),
          caption: 'The whole algorithm is one three-way minimum. The edit operations are not implemented anywhere — they are just the names of the three directions.'
        },
        plain: 'Each cell is the cheapest of substitute, insert and remove.',
        formal: 'd[i][j] = min(d[i−1][j−1] + sub, d[i−1][j] + del, d[i][j−1] + ins)',
        readAs: 'Each cell of the edit table is the cheapest of three moves: substitute (diagonal), delete ' +
          '(from above), or insert (from the left). The cost of substituting is 0 when the characters ' +
          'already match.',
        detail: 'Edit distance is the two-dimensional DP everything else in the family varies. The diagonal ' +
          'edge lines two characters up and costs nothing when they match; the two orthogonal edges each ' +
          'consume one character against a gap. Because there are three edges and (m+1)(n+1) cells, the ' +
          'cost is the product - which is fine at word lengths and is four million cells for two ' +
          'two-thousand-character strings, which is where the space section of this topic starts.',
        example: 'kitten → sitting is 3, from a 7 × 8 table of 56 cells, and exhaustive recursion over every ' +
          'edit sequence agrees.'
      },
      {
        term: 'The traceback prefers the diagonal',
        plain: 'At a tie, one diagonal step beats a pair of gaps - it is one column instead of two.',
        formal: 'tie-breaking towards the diagonal minimises the alignment length at equal cost',
        detail: 'Several tracebacks can achieve the same optimal cost, and they are not equally good ' +
          'alignments. A diagonal step consumes one character from each string and produces one column; a ' +
          'deletion followed by an insertion consumes the same characters and produces two. Preferring the ' +
          'diagonal on ties therefore gives the shortest alignment of minimum cost, which is what a reader ' +
          'expects and what a diff tool needs. It is a one-line ordering decision in the traceback and it is ' +
          'invisible in the distance.',
        example: 'kitten → sitting aligns as `kitten-` over `sitting` in seven columns; a traceback without ' +
          'the preference can produce a longer alignment of the same cost 3.'
      },
      {
        term: 'Two rows keep the distance and lose the alignment',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the recurrence only ever reads<br/>the previous row"] --> B["so two rows compute the<br/>distance exactly"]',
            '    B --> C["and the traceback needs<br/>the whole table"]',
            '    C --> D["which was thrown away<br/>one row at a time"]',
            '    D --> E["the number survives;<br/>the alignment does not"]'
          ].join('\n'),
          caption: 'Space reduction is not free even when the answer is unchanged: it deletes exactly the information a traceback walks, which is why Hirschberg exists.'
        },
        plain: 'The recurrence only reads the previous row, so one row is enough - for the number only.',
        formal: 'Θ(min(m, n)) space computes d, but the traceback needs the full Θ(mn) table',
        readAs: 'You can find the distance while holding only one row, but recovering the actual alignment ' +
          'needs the whole grid — unless you use the divide-and-conquer trick, which is what the next ' +
          'concept is for.',
        detail: 'This is the temptation the section is built around, because it is a three-line change that ' +
          'keeps every distance test passing. The traceback walks backwards through cells that have been ' +
          'overwritten, so code left in place after the reduction produces something shaped like an ' +
          'alignment and related to nothing. An interface that returns no alignment is the honest outcome; ' +
          'the check that catches the dishonest one is stripping the gaps from each row and demanding the ' +
          'inputs back.',
        example: 'For kitten and sitting the full table peaks at 56 cells and the two-row version at 16, both ' +
          'reporting distance 3 — and only one of them can print the alignment.'
      },
      {
        term: "Hirschberg's algorithm: both, for twice the time",
        plain: 'Find where the optimal alignment crosses the midpoint, then recurse on the two halves.',
        formal: 'split a at m/2; the crossing column j minimises forward(j) + backward(n − j); recurse',
        readAs: 'Hirschberg\'s method: compute one row forward from the top and one backward from the bottom, ' +
          'find where they meet most cheaply, and recurse on the two halves. Linear space, twice the ' +
          'time.',
        detail: 'The row-only computation gives the distance from every prefix of one string to all of the ' +
          'other. Run it forwards on the top half and backwards on the bottom half, and the column ' +
          'minimising the sum is where the optimal alignment passes through the middle row. That splits the ' +
          'problem into two independent alignments, and recursing gives the whole alignment in linear space ' +
          'for about twice the work. It is one of the cleanest space-time trades in the subject and the ' +
          'answer to "I need the alignment and cannot afford the table".',
        example: 'kitten against sitting: five recursive splits, a peak of 16 cells rather than 56, and the ' +
          'identical alignment — checked by stripping the gaps.'
      },
      {
        term: 'Check the alignment, not the distance',
        plain: 'Strip the gaps from each row; you must get the two inputs back.',
        formal: 'the rows are equal length, gap-free projections equal the inputs, and no column is gap-gap',
        detail: 'Three assertions, a few lines each, and between them they catch every traceback bug there ' +
          'is - including the one that matters most, a traceback over a table that was space-reduced after ' +
          'the traceback was written. A distance test cannot see any of them, because the distance is ' +
          'computed by code that is still correct. This is the same principle as verifying a knapsack\'s ' +
          'chosen set: the witness is checkable against the problem statement and the score is not.',
        example: 'Both the full table and Hirschberg return alignments whose gap-stripped rows are exactly ' +
          '"kitten" and "sitting", over seven columns with no gap-against-gap.'
      },
      {
        term: 'LCS is edit distance with substitution forbidden',
        plain: 'Take away the diagonal-on-mismatch edge and the same table computes a diff.',
        formal: 'lcs[i][j] = a_i = b_j ? lcs[i−1][j−1] + 1 : max(lcs[i−1][j], lcs[i][j−1])',
        readAs: 'If the two characters match, extend the diagonal answer by one; if they do not, take the ' +
          'better of dropping one character from either string.',
        detail: 'This is why `git diff` and spell-checking are the same algorithm with different costs. A ' +
          'diff cannot substitute a line - it can only add or remove - so the diagonal edge is available ' +
          'only on a match, and everything not in the longest common subsequence is either an addition or a ' +
          'removal. Seeing the two as one recurrence is worth more than knowing either separately, because ' +
          'it makes the cost model the thing you are choosing rather than the algorithm.',
        example: 'abcabba against cbabac has an LCS of 4 ("baba"), so the diff is 4 context lines, 2 ' +
          'additions and 3 removals — nine operations in total.'
      },
      {
        term: 'Global against local: one Math.max apart',
        plain: 'Allowing a cell to fall to zero turns "align these strings" into "find the best region".',
        formal: 'Needleman-Wunsch initialises with gap penalties; Smith-Waterman clamps at 0 and reads the maximum cell',
        detail: 'The two algorithms differ in the initial row and column and in one `Math.max(0, …)`, and ' +
          'they answer genuinely different questions. Global alignment insists on consuming both strings end ' +
          'to end, so a good match buried in poor surroundings is dragged down by the surroundings. Local ' +
          'alignment lets the score reset, so it finds the best-matching region and ignores the rest - and ' +
          'the answer is read from wherever the maximum cell is rather than from the corner.',
        example: 'ACACACTA against AGCACACA scores 12 globally and 12 locally, with the local maximum found ' +
          'at row 8, column 8.'
      },
      {
        term: 'Affine gaps need three tables',
        plain: '"Am I already inside a gap" is state, so it belongs in the state.',
        formal: 'M, X and Y for aligned, gap-in-b and gap-in-a; a run of k costs open + k·extend',
        readAs: 'Three tables instead of one, so the algorithm knows whether it is currently inside a gap. ' +
          'That is what lets a long gap cost an opening fee plus a small charge per position, rather ' +
          'than a full charge for each — which is what biology actually needs.',
        detail: 'With a linear penalty, k gaps cost k·g however they are arranged, so the aligner has no ' +
          'reason to keep them together and produces alignments shredded into single-character holes - which ' +
          'is biologically and textually wrong, because real indels are contiguous. Charging once to open a ' +
          'gap and less to extend it fixes that, and it requires knowing whether the previous column was ' +
          'already a gap. That is a third piece of state, so one table becomes three, and this is the ' +
          'clearest small example of a state having to grow to express a cost model.',
        example: 'The same ACACACTA / AGCACACA pair scores 12 with linear gaps and 6 with affine ones, ' +
          'because opening a gap now costs something it did not before.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
