/** Concepts for the first three paradigm sections (M11.1-M11.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'exhaustive-search': [
      {
        term: 'The state space is a tree, not a set',
        diagram: {
          definition: [
            'flowchart LR',
            '    R["no decisions made yet"] --> A["first choice = a"]',
            '    R --> B["first choice = b"]',
            '    A --> A1["then c"]',
            '    A --> A2["then d"]',
            '    B --> B1["then c"]',
            '    A1 --> L["a complete candidate<br/>sits at a leaf"]'
          ].join('\n'),
          caption: 'See the search as a tree of partial decisions rather than a bag of finished candidates, and pruning becomes possible. You can delete a branch. You cannot delete a bag.'
        },
        plain: 'Every partial decision is a node; every way of extending it is a child.',
        formal: 'a search space (S, root, successors, isGoal), explored depth-first with an explicit or implicit stack',
        detail: [
          'Writing a problem as a state space is usually a five-minute job, and it is the step ' +
            'that makes everything else possible.',
          'The value is not that it produces a correct program — a nested loop would too. It is ' +
            'that it produces a program with somewhere to put the prunings.',
          'A node is a partial assignment. Its children are the ways of extending it by one ' +
            'decision, and a subtree is every completion of that partial assignment. Once the ' +
            'problem is in that shape, "no solution lives under this node" becomes a sentence you ' +
            'can write code for.'
        ],
        example: 'For n-queens, a node is a list of column choices for the first k rows; the root is the empty ' +
          'list and a goal is a list of length n.'
      },
      {
        term: 'Pruning is an argument, not an optimisation',
        plain: 'A pruning claims no solution lies below a node, and a wrong claim removes answers silently.',
        formal: 'a predicate p on partial states is admissible when p(s) false implies no completion of s is a goal',
        readAs: 'A pruning test is safe only if a "no" guarantees that nothing built on top of ' +
          'this partial answer could ever work. A test that is merely usually right silently ' +
          'deletes real solutions.',
        detail: [
          'The difference between a pruning and a bug is a proof.',
          'Both make the search faster and only one of them keeps the answer. The failure is not ' +
            'an exception: the search returns a smaller set of solutions and looks like it worked.',
          'That is why every configuration in this section reports its solution count beside its ' +
            'node count. The count is the check, and a pruning that changes it is a defect however ' +
            'much faster it made things.'
        ],
        example: 'The n-queens diagonal check is admissible: two queens on a diagonal in the first k rows stay ' +
          'on that diagonal in every completion, so no goal lies below.'
      },
      {
        term: 'Where the check happens is the whole difference',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["test at the leaf"] --> B["rejects one finished candidate"]',
            '    C["the same test at the moment<br/>the choice is made"] --> D["rejects every candidate<br/>below that node at once"]',
            '    D --> E["identical logic, and the<br/>difference is a subtree"]'
          ].join('\n'),
          caption: 'The test is not stronger and the code is barely different. Moving it earlier is what turns an exponential enumeration into a search that finishes.'
        },
        plain: 'The same test at the placement instead of the leaf removes a subtree instead of a candidate.',
        formal: 'moving a feasibility test from depth n to depth k removes b^(n−k) descendants per rejection',
        readAs: 'Rejecting a bad partial answer early kills everything below it: b branches per ' +
          'level, for the levels you skipped. That is why testing at depth 3 instead of depth 8 is ' +
          'not a small improvement.',
        detail: [
          'This is the most reliable order-of-magnitude in the milestone, and it needs no new idea ' +
            'at all.',
          'The leaf-only configuration enumerates every permutation and rejects the illegal ones ' +
            'at the end. The pruned configuration performs the identical test the moment a queen ' +
            'is placed.',
          'Same test, same answer. At eight queens 109 601 nodes become 2 057; at ten queens ' +
            '9 864 101 become 35 539.',
          'The lesson generalises. When a predicate is monotone in the partial state, evaluate it ' +
            'as early as it becomes decidable.'
        ],
        example: 'At n = 8 the leaf-only control visits 109 601 nodes and the early check visits 2 057 — a ' +
          'factor of 53, with both finding all 92 solutions.'
      },
      {
        term: 'Prunings multiply',
        plain: 'Two independent prunings that leave a half and a fiftieth leave a hundredth, not a third.',
        formal: 'for independent prunings, the surviving fraction is the product of the individual fractions',
        readAs: 'Two prunings that each keep a tenth of the tree together keep a hundredth. The ' +
          'fractions multiply rather than add, and that compounding is why stacking cheap prunings ' +
          'beats one clever one.',
        detail: [
          'This is the argument for adding a weak second constraint.',
          'A pruning that removes only a third of the tree still removes a third of whatever the ' +
            'first one left, so its value is multiplicative rather than additive.',
          'Dependent prunings do worse than the product, because they cut some of the same ' +
            'branches. They are never worse than either alone, though, so the direction of the ' +
            'inequality is always in your favour.',
          'It also explains why removing a pruning to "simplify" a solver is so often ' +
            'catastrophic.'
        ],
        example: 'At n = 8: the early diagonal check leaves 1.88% of the control and symmetry ' +
          'breaking leaves 50.00%. Both together leave 0.9389%, against the 0.9384% their ' +
          'product predicts. Near enough to agree at two decimal places, and not equal, because ' +
          'the two prunings overlap slightly.'
      },
      {
        term: 'Symmetry breaking, and putting the solutions back',
        plain: 'Search one representative per symmetry class, then generate the rest by applying the symmetry.',
        formal: 'restrict the first choice to a fundamental domain; recover the full solution set by the group action',
        detail: [
          'A board and its mirror are the same board in every respect the problem cares about, so ' +
            'searching both is exactly twice the work for none of the answers.',
          'Restricting the first row to the left half halves the tree exactly.',
          'The recovery step is where the care is needed. Mirroring every solution found and ' +
            'de-duplicating keeps the count exact even for odd n, where a middle-column solution ' +
            'can be its own mirror and naive doubling would over-count.'
        ],
        example: 'At n = 8, symmetry breaking visits 1 029 nodes rather than 2 057 and still ' +
          'reports all 92 solutions. The boards it skipped are precisely the mirrors of the ones ' +
          'it visited.'
      },
      {
        term: 'Ordering is not pruning',
        plain: 'Choosing what to try first changes nothing when you want every solution.',
        formal: 'a permutation of the successor order preserves the explored set when the search is exhaustive',
        detail: [
          'Most-constrained-first, degree ordering and least-constraining-value are all ' +
            'reorderings of the same children.',
          'When the search enumerates every solution it walks the same tree in a different ' +
            'sequence, and the node count is identical.',
          'They pay only when the search can stop early — the first solution, or a bound that ' +
            'improves as soon as an incumbent exists. Then the order decides how much of the tree ' +
            'is left when the stopping condition fires.'
        ],
        example: 'Finding all 92 solutions at n = 8 costs 2 057 nodes with or without most-constrained-first; ' +
          'finding the first costs 114 without it and 9 with it.'
      },
      {
        term: 'Constraint propagation as a stronger feasibility test',
        plain: 'Deduce what the last decision forces before making the next one.',
        formal: 'arc consistency: remove from each domain every value with no support in a neighbouring domain',
        detail: [
          'A feasibility check asks whether the current state is still possible. Propagation asks ' +
            'what the current state implies, and repeats until nothing new follows.',
          'It is strictly stronger and strictly more expensive per node, which makes it a trade ' +
            'rather than an improvement.',
          'The right way to decide is to measure both counts on the instances that matter. ' +
            'Propagation that fires rarely is pure overhead; propagation that cascades is the ' +
            'difference between finishing and not.'
        ],
        example: 'On a hard Sudoku, propagation takes the search from 9 180 nodes to 929 while doing far more ' +
          'work at each of them.'
      },
      {
        term: 'A node budget is part of the report',
        plain: 'A search that ran out of budget must say so rather than return what it had.',
        formal: 'report (result, nodesVisited, budgetExhausted) rather than result alone',
        detail: [
          'Exhaustive search on a hard instance does not finish, and the honest response is a ' +
            'flag, not a smaller answer.',
          'A solver that returns its incumbent without saying the budget ran out turns an ' +
            '"unknown" into a confident wrong answer. A table that prints that number beside ' +
            'completed runs invites a comparison that is not valid.',
          'Every count in this section that hit its budget is marked, and no ratio is computed ' +
            'against a marked figure.'
        ],
        example: 'The leaf-only control at n = 12 exceeds twenty million nodes; the table shows "20 000 000+" ' +
          'and computes no ratio from it.'
      }
    ],

    'divide-and-conquer': [
      {
        term: 'The combine step is the algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["split in half"] --> B["trivial — an index calculation"]',
            '    C["solve each half"] --> D["the same problem, smaller"]',
            '    E["combine the answers"] --> F["this is the only part that<br/>carries an idea"]',
            '    F --> G["merge sort merges; Karatsuba subtracts;<br/>closest-pair scans a strip"]'
          ].join('\n'),
          caption: 'Every divide-and-conquer algorithm splits the same way. What distinguishes them, and what the recurrence is measuring, is what happens on the way back up.'
        },
        plain: 'Splitting is trivial; what happens when the halves come back is where the idea lives.',
        formal: 'T(n) = a·T(n/b) + f(n), where f is the combine cost and the master theorem reads off the answer',
        readAs: 'A problem of size n splits into a pieces of size n/b, plus f(n) to divide and recombine. ' +
          'Those three numbers are all the master theorem needs.',
        detail: 'Almost every divide-and-conquer algorithm splits its input in half by index or by coordinate, ' +
          'which is a line of code. The invention is always in the combine: merge sort\'s merge, closest ' +
          'pair\'s strip, Karatsuba\'s subtraction, Strassen\'s seven products. Reading a new algorithm in ' +
          'this family therefore means reading the combine step first - and designing one means asking what ' +
          'information from two solved halves is enough to answer the whole, which is usually the only hard ' +
          'question.',
        example: 'Counting inversions is merge sort with one extra line in the merge: when the right element ' +
          'wins, every remaining left element is an inversion.'
      },
      {
        term: 'Karatsuba: three products instead of four',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the schoolbook way:<br/>four half-size products"] --> B["ac, ad, bc, bd"]',
            '    C["compute ac, bd, and (a+b)(c+d)"] --> D["subtract ac and bd from the third"]',
            '    D --> E["what is left is ad + bc,<br/>the middle term"]',
            '    E --> F["three products, and one<br/>multiplication has disappeared"]'
          ].join('\n'),
          caption: 'The middle term was never needed separately — only its sum. Recovering a sum by subtraction rather than computing both halves is the entire trick.'
        },
        plain: 'The middle term of a product is recoverable by subtraction, so one multiplication disappears.',
        formal: '(aB + b)(cB + d) = acB² + ((a+b)(c+d) − ac − bd)B + bd, giving T(n) = 3T(n/2) + O(n)',
        readAs: 'Karatsuba\'s trick: the middle term of the product can be recovered from the other two plus ' +
          'one extra multiplication, instead of two. Three multiplications of half-size numbers rather ' +
          'than four, which is where the speedup comes from.',
        detail: 'The identity is the whole algorithm and it is one line of algebra. Four half-size products ' +
          'are the obvious split; the middle coefficient ad + bc is the difference between (a+b)(c+d) and the ' +
          'two products already computed, so three suffice and the extra additions are linear. The recurrence ' +
          'solves to n^log₂3 ≈ n^1.585. That exponent is small enough that the constants decide everything ' +
          'below a few dozen digits, which is why every real implementation has a threshold.',
        example: 'On 1 024-digit operands, schoolbook does 1 048 576 digit products and Karatsuba does ' +
          '100 273 — a factor of 10.46, with both answers equal to the BigInt product.'
      },
      {
        term: 'The crossover is measured, not derived',
        plain: 'Asymptotics choose the algorithm; a benchmark chooses where to switch to it.',
        formal: 'the threshold minimising c₁n² against c₂n^1.585 + additions depends on the machine, not the analysis',
        readAs: 'Where the clever algorithm overtakes the simple one is set by the two constant factors, and ' +
          'those come from the hardware. The exponents tell you a crossover exists; only measurement ' +
          'tells you where.',
        detail: 'Below the crossover the asymptotically better algorithm is worse, and the crossover is a ' +
          'property of the constants rather than of the exponents. Karatsuba at four digits does more work ' +
          'than schoolbook - measurably, 17 digit products against 16 - because the recursion pays for its ' +
          'own additions and its own call overhead. Real libraries switch somewhere in the tens of digits, ' +
          'tune the number per architecture, and re-tune it when the architecture changes.',
        example: 'At n = 4 the ratio is 0.94 (Karatsuba loses); at n = 16 it is 2.00; at n = 1 024 it is ' +
          '10.46.'
      },
      {
        term: 'Strassen, and why the exponent is not the whole story',
        plain: 'Seven block products instead of eight, at the cost of eighteen block additions and some accuracy.',
        formal: 'T(n) = 7T(n/2) + O(n²) = O(n^log₂7) ≈ O(n^2.807)',
        readAs: 'Strassen does seven half-size matrix multiplications instead of eight, so the exponent falls ' +
          'from 3 to log base 2 of 7, about 2.807. The caret is "to the power of".',
        detail: 'Strassen matters historically because it proved the cubic algorithm is not optimal, and ' +
          'practically because it is the standard example of an asymptotic win that arrives late. The ' +
          'measured product counts are exactly 7^k against 8^k, so the improvement is real and visible at ' +
          'every size; the additions, the memory traffic and the loss of componentwise backward stability are ' +
          'what push the practical crossover into the hundreds. The stability caveat is the one people skip: ' +
          'the block subtractions cancel, so the error bound involves the matrix norms rather than the ' +
          'entries that produced each result.',
        example: 'At side 128, cubic does 2 097 152 scalar products and Strassen does 823 543 — a factor of ' +
          '2.55 — with a relative entrywise disagreement of 3.4 × 10⁻¹⁴.'
      },
      {
        term: 'Closest pair: the strip and the constant',
        plain: 'Only points within the current best distance of the dividing line can beat it.',
        formal: 'in the strip, sorted by y, each point need be compared with at most seven successors',
        readAs: 'Once the candidate strip is sorted vertically, geometry guarantees no point can have more ' +
          'than seven others close enough to matter. That fixed number is what keeps the closest-pair ' +
          'scan linear.',
        detail: 'The combine step is a geometric argument rather than a bookkeeping one, which is what makes ' +
          'this the standard demonstration of the pattern. If the best distance found so far is delta, a ' +
          'crossing pair closer than delta must have both points within delta of the line, and within the ' +
          'strip a delta-by-2delta rectangle can hold at most eight points that are pairwise delta apart. ' +
          'That bounds the inner loop by a constant and makes the whole algorithm n log n. The bound is ' +
          'worst-case; the measured maximum is usually two or three.',
        example: 'On 2 000 uniform points the divide-and-conquer version performs 2 314 distance checks ' +
          'against brute force\'s 1 999 000, and the longest strip run is 2.'
      },
      {
        term: 'A brute-force oracle is not optional here',
        plain: 'A wrong closest pair is a plausible pair, and a wrong inversion count is a plausible number.',
        formal: 'validate against an O(n²) reference on randomised inputs, and report disagreements as a field',
        detail: 'Every algorithm in this family returns something well-formed when it is wrong. A closest-pair ' +
          'bug that mishandles the strip returns a real pair of points at a real distance; an inversion count ' +
          'that misses the cross-pairs returns a plausible integer. Neither raises. The quadratic reference ' +
          'costs nothing to write, runs on the sizes tests use, and turns "it looks right" into a count of ' +
          'disagreements - which is the only form of evidence that survives a refactor.',
        example: 'The inversion count over 2 000 values agrees exactly with the quadratic scan: 984 529, ' +
          'reached in 19 447 comparisons rather than 1 999 000.'
      },
      {
        term: 'Reading an exponent off a log-log chart',
        plain: 'An asymptotic difference is a difference of slope; a constant factor is a vertical shift.',
        formal: 'log(cn^k) = k·log n + log c, so k is the slope and c is the intercept',
        readAs: 'Take logs of a power law and it becomes a straight line — the exponent turns into the slope ' +
          'and the constant into the intercept. That is why these curves are read on log-log axes.',
        detail: 'This is the one reliable way to compare growth rates from measurements, and it is worth ' +
          'stating explicitly because linear axes make an asymptotic difference and a large constant look ' +
          'identical. On log axes the schoolbook line has slope 2, the Karatsuba line has slope 1.585, and ' +
          'the gap between the measured Karatsuba line and the idealised n^1.585 reference is a shift rather ' +
          'than a bend - which says the recursion\'s own additions cost a constant factor and not a worse ' +
          'exponent.',
        example: 'The measured Karatsuba counts sit about 1.7× above n^1.585 at every size, parallel to it ' +
          'rather than diverging from it.'
      },
      {
        term: 'Divide and conquer on trees: centroid decomposition',
        plain: 'Split at the vertex whose removal leaves no component larger than half the tree.',
        formal: 'a centroid exists in every tree, and the decomposition has depth O(log n)',
        detail: 'The same template applies to trees once "half" is defined properly. A centroid is a vertex ' +
          'whose removal leaves every component with at most n/2 vertices, and one always exists; recursing ' +
          'into each component gives a decomposition of depth log n in which every path in the original tree ' +
          'passes through the centroid of exactly one level. Path-counting problems that look quadratic ' +
          'become n log n by handling, at each centroid, only the paths that pass through it.',
        example: 'Counting the tree paths of length exactly k: at each centroid, combine the depth ' +
          'distributions of its components, then recurse — O(n log n) rather than O(n²).'
      }
    ],

    'greedy-algorithms': [
      {
        term: 'The greedy-choice property',
        plain: 'Some locally best choice is part of some optimal solution.',
        formal: 'there exists an optimal solution containing the greedy first choice',
        readAs: 'The property that makes greedy safe: whatever the best answer is, there is a best answer ' +
          'that agrees with your first move. Prove that and induction does the rest.',
        detail: 'This is the precondition, and it is a statement about the problem rather than about the ' +
          'algorithm. It is also weaker than it looks: it does not say every locally best choice is safe, or ' +
          'that the greedy solution is the only optimum. It says one optimum agrees with greedy at the first ' +
          'step - which, combined with optimal substructure, licenses the induction. Both halves are needed, ' +
          'and problems that satisfy one without the other are exactly where greedy quietly fails.',
        example: 'For interval scheduling, the interval finishing earliest is in some optimal schedule, ' +
          'because swapping it for that schedule\'s first interval cannot cause a conflict.'
      },
      {
        term: 'Exchange arguments',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["take any optimal solution"] --> B["find the first place it<br/>differs from the greedy one"]',
            '    B --> C["swap in the greedy choice there"]',
            '    C --> D{"is it still optimal?"}',
            '    D -->|yes| B',
            '    D -->|no| E["the greedy rule is wrong,<br/>and this is the counter-example"]'
          ].join('\n'),
          caption: 'You never prove greedy is optimal directly. You prove nothing is lost by moving any optimal solution toward it, one choice at a time.'
        },
        plain: 'Transform any optimal solution into the greedy one, one step at a time, without making it worse.',
        formal: 'given OPT differing from greedy at position k, construct OPT\' agreeing at k with value(OPT\') >= value(OPT)',
        detail: 'The exchange argument is the workhorse proof for greedy algorithms and it has a fixed shape ' +
          'worth memorising. Take any optimal solution; find the first place it disagrees with greedy; show ' +
          'that swapping greedy\'s choice in keeps it feasible and no worse. Induction then gives an optimal ' +
          'solution agreeing with greedy everywhere, so greedy is optimal. Writing it out forces you to say ' +
          'exactly why the swap is safe, and that sentence is usually where a wrong greedy rule falls apart.',
        example: 'Swapping the earliest-finishing interval into an optimal schedule works because it ends no ' +
          'later than the interval it replaces, so nothing later conflicts.'
      },
      {
        term: 'Staying ahead',
        plain: 'After k choices, greedy is at least as well placed as any competitor.',
        formal: 'for every k and every feasible solution S, greedy\'s k-th choice finishes no later than S\'s k-th',
        detail: 'The second standard proof, and often the easier one to write. Rather than transforming a ' +
          'rival solution, it shows greedy dominates every rival at every prefix by some measure, so it can ' +
          'never be the one that runs out first. The measure has to be chosen carefully - for interval ' +
          'scheduling it is the finishing time of the k-th chosen interval - and the induction is then ' +
          'mechanical. When both proofs are available, this one usually produces a table you can compute and ' +
          'check, which the exchange argument does not.',
        example: 'Greedy\'s third interval finishes at 9 where the optimal schedule\'s third finishes at 11, ' +
          'so greedy has strictly more of the timeline left.'
      },
      {
        term: 'The failure is silent',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a wrong greedy rule"] --> B["still returns a valid solution"]',
            '    B --> C["it satisfies every constraint"]',
            '    C --> D["it is simply not the best one"]',
            '    D --> E["nothing throws, no test fails,<br/>and the answer looks right"]'
          ].join('\n'),
          caption: 'This is why greedy needs a proof rather than a test suite. A bug here produces plausible output forever, and only a counter-example or an exchange argument finds it.'
        },
        plain: 'A wrong greedy rule returns a valid, sub-optimal answer, and nothing raises.',
        formal: 'the output is feasible but not optimal; detection requires computing the optimum independently',
        detail: 'This is the reason greedy is the most dangerous paradigm in the milestone. A wrong ' +
          'backtracking search hangs, a wrong bound makes a search return an answer that disagrees with the ' +
          'exhaustive one, and both are visible. A wrong greedy criterion produces a schedule that is a ' +
          'schedule, a change that is change, a route that is a route. The only detection is an oracle, and ' +
          'the only prevention is a proof - which is why "we benchmarked it and it was fine" is not evidence ' +
          'of correctness here.',
        example: 'Earliest-start scheduling loses to the optimum on an instance of four intervals, returning ' +
          'a perfectly valid schedule of one where two fit.'
      },
      {
        term: 'How hard a counter-example is to find is itself a measurement',
        plain: 'Some wrong criteria fail on the fifth random instance; others survive tens of thousands.',
        formal: 'report the number of random instances searched before the first disagreement with the oracle',
        detail: 'A criterion whose counter-example takes a hundred thousand random instances to find will ' +
          'pass every hand-written test, every property test with a small generator, and a year in ' +
          'production. That number is the honest measure of how much a test suite tells you, and it varies ' +
          'enormously between rules that all look equally plausible. It is also the argument for the ' +
          'structural check in the next section: a search that has not found a counter-example has not found ' +
          'a proof either.',
        example: 'Earliest-start fails after 5 random instances of four intervals; fewest-conflicts needs ' +
          'nine intervals and 94 996 instances.'
      },
      {
        term: 'Fractional against 0/1',
        plain: 'Greedy by value density is optimal when items can be cut and wrong when they cannot.',
        formal: 'the LP relaxation of 0/1 knapsack is fractional knapsack, and its optimum is an upper bound',
        readAs: 'Allow items to be taken in fractions and the problem becomes easy — and because you relaxed ' +
          'a constraint, its answer can only be better than the real one. That makes it a ceiling you ' +
          'can compute cheaply and prune against.',
        detail: 'These two problems differ by one word in the statement and by a complexity class in the ' +
          'answer. Sorting by value per unit weight and filling is provably optimal for the fractional ' +
          'version by an exchange argument, and it is not optimal for the integral one - the last item either ' +
          'fits or does not, and the greedy prefix can leave capacity that a different subset would use. The ' +
          'relationship is not wasted: the fractional optimum is a ceiling on the integral one, which is ' +
          'exactly the bound the branch-and-bound section uses.',
        example: 'Three items and a capacity of 50: fractional greedy achieves 240 and the best integral ' +
          'solution is 220.'
      },
      {
        term: 'Canonical coin systems',
        plain: 'Greedy change-making is optimal for some denomination sets and not others, and inspection does not tell you which.',
        formal: 'a system is canonical when greedy is optimal for every amount; non-canonicity has a witness below the sum of the two largest coins',
        detail: 'This is the cleanest small example of a greedy rule whose correctness depends on data rather ' +
          'than on structure. 1, 5, 10, 25 is canonical and 1, 3, 4 is not, and nothing about the two sets ' +
          'looks different. The saving grace is Pearson\'s result: if a counter-example exists, one exists ' +
          'below the sum of the two largest coins, so a finite sweep decides the question. That is the shape ' +
          'to look for whenever a greedy rule is proposed - not "does it work on my examples" but "is there a ' +
          'bounded region where a counter-example must live".',
        example: '1, 3, 4 fails at 6: greedy pays 4 + 1 + 1 and the answer is 3 + 3. 1, 15, 25 fails at 30: ' +
          'six coins against two.'
      },
      {
        term: 'Huffman coding as a greedy proof',
        plain: 'Repeatedly merging the two least frequent symbols is optimal, and the proof is an exchange argument.',
        formal: 'the two least frequent symbols are siblings at maximum depth in some optimal prefix code',
        readAs: 'The two rarest symbols can always be placed together at the very bottom of some optimal ' +
          'tree. That single fact is the whole proof of Huffman coding, and the whole algorithm.',
        detail: 'Huffman is worth carrying as the canonical non-trivial greedy proof because the exchange step ' +
          'is genuinely surprising: it is not obvious that the two rarest symbols can be assumed to be ' +
          'siblings, and the argument that swapping them down cannot increase the weighted path length is the ' +
          'whole result. Once that is established the induction is routine. It is also the example that shows ' +
          'greedy solving a problem whose brute-force version - all binary trees on n leaves - is enormous.',
        example: 'With frequencies 5, 9, 12, 13, 16, 45 the merges are (5, 9) then (12, 13) then (14, 16), ' +
          'producing the optimal code with expected length 2.24 bits per symbol.'
      }
    ]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
