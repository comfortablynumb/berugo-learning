/**
 * Concepts for the analysis sections (M01.1-M01.5): notation, recurrences,
 * amortised analysis, average case and lower bounds.
 *
 * The four measurement sections (M01.6-M01.9) live in
 * concepts-analysis-practice.js, because one file for the whole milestone runs
 * past the 1 000-line limit once every concept carries its explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'asymptotic-notation': [
      {
        term: 'Witness pair',
        diagram: {
          definition: [
            'flowchart LR',
            '    C["claim: f is O(g)"] --> N["name two numbers:<br/>a multiplier c<br/>a size n₀"]',
            '    N --> T{"is f(n) ≤ c·g(n)<br/>for every n from n₀ up?"}',
            '    T -->|"yes, and it never stops<br/>being true"| P["the claim is proved"]',
            '    T -->|"it fails at even one n"| F["this pair is not a witness<br/>(another pair still might be)"]'
          ].join('\n'),
          caption: 'A witness is the pair you name. The claim is the promise that some pair exists — which is why you refute it by ruling out every pair, not one.'
        },
        plain: 'The constant and threshold that make a big-O claim true. Without one, the claim is not yet a claim.',
        formal: 'f = O(g) ⟺ ∃c > 0, n₀ : ∀n ≥ n₀, f(n) ≤ c·g(n)',
        readAs: 'f is O(g) exactly when you can find one multiplier c and one starting size n₀. ' +
          'From n₀ upward, f(n) never rises above c times g(n). The whole definition is a promise ' +
          'that two such numbers exist.',
        detail: [
          'Big-O never claims your function is g. It claims that if you scale g by some fixed ' +
            'multiplier you get a ceiling your function stays under. And not everywhere: only from ' +
            'some input size onward.',
          'That is why proving a bound means naming the two numbers the definition promises exist ' +
            '— the multiplier c, and the size n₀ where the ceiling starts holding. Until you can ' +
            'name them you have an impression rather than a bound.',
          'Neither number is unique. If (c, n₀) works then so does (2c, n₀), and so does any ' +
            'larger threshold. That is why nobody quotes them, and why the smallest pair is not ' +
            'what you are asked for.',
          'What the pair buys you is a way to argue back. To refute a claimed bound, show that for ' +
            'every candidate c the inequality fails infinitely often.'
        ],
        example: 'n log n = O(n²) with c = 1, n₀ = 1.'
      },
      {
        term: 'Big-O, Ω and Θ',
        diagram: {
          definition: [
            'flowchart LR',
            '    O["O(g)<br/>a ceiling: never worse than g"] --> T["Θ(g)"]',
            '    W["Ω(g)<br/>a floor: never better than g"] --> T',
            '    T --> S["both claimed at once —<br/>the cost grows exactly like g"]'
          ].join('\n'),
          caption: 'Θ is not a third symbol to learn. It is the other two asserted together, which is why it needs two witness pairs rather than one.'
        },
        plain: 'Upper bound, lower bound, and both at once. O is an upper bound, not a tight one.',
        formal: 'Θ(g) = O(g) ∩ Ω(g)',
        readAs: 'Θ(g) is the overlap of two claims: the functions O(g) caps from above, and the ' +
          'functions Ω(g) floors from below. To be Θ(g) a function has to be in both groups.',
        detail: [
          'Three relations, and only one of them says what people usually mean. O(g) caps a ' +
            'function from above. Ω(g) floors it from below. Θ(g) asserts both at once, so the ' +
            'function grows exactly like g up to constants — you may multiply g by any fixed ' +
            'number, but not change its shape.',
          'Almost every sentence that reaches for O is trying to say Θ. "Merge sort is O(n log n)" ' +
            'is true, but so is "merge sort is O(n⁵)", and the reader cannot tell which you meant.',
          'Θ is a strictly stronger claim and needs two witness pairs rather than one. That is ' +
            'exactly why it is the one worth proving.'
        ],
        example: 'Every algorithm that is Θ(n) is also, truthfully, O(n²).'
      },
      {
        term: 'Abuse of notation',
        plain: 'O(g) is a set of functions, but everyone writes = instead of ∈. The equality does not run backwards.',
        formal: 'f = O(g) means f ∈ O(g)',
        readAs: 'Read "f = O(g)" as "f is one of the functions in the collection O(g)". The equals ' +
          'sign is doing the job of "is a member of", and it only works read left to right.',
        detail: [
          'O(g) denotes the set of all functions bounded above by a constant multiple of g, so the ' +
            'honest symbol is ∈.',
          'The convention of writing = is sixty years old and is not going to change. It misleads ' +
            'in one specific way: equality is symmetric and this is not. n = O(n²) is true, and ' +
            'O(n²) = n is meaningless.',
          'A chain like T(n) = O(n) + O(n²) reads as "there exist functions in those sets whose ' +
            'sum is T", left to right only. Treat the = as a one-way arrow and the notation stops ' +
            'generating false steps.'
        ],
        example: 'n = O(n²) and n² = O(n²), but n ≠ n².'
      },
      {
        term: 'Little-o',
        plain: 'Strictly smaller: f is negligible compared with g, for every constant, not just some constant.',
        formal: 'f = o(g) ⟺ lim f(n)/g(n) = 0',
        readAs: 'f is little-o of g exactly when the ratio f(n)/g(n) can be pushed below any number ' +
          'you care to name, just by taking n large enough. That is what "the limit is 0" says.',
        detail: [
          'Big-O allows f to keep pace with g — n² = O(n²). Little-o insists that f is eventually ' +
            'beaten by every constant multiple of g, however small.',
          'Swapping "some" for "every" is the whole difference. O asks for some multiplier c that ' +
            'works; o demands that all of them do. So o(g) is a strict subset of O(g), and the ' +
            'functions in the difference are exactly those that grow at the same rate as g.',
          'In practice little-o is how lower-order terms get dismissed cleanly. Writing ' +
            'T(n) = n² + o(n²) says the rest genuinely vanishes relative to the main term, rather ' +
            'than merely staying under it.'
        ],
        example: 'n log n = o(n²), and n² ≠ o(n²).'
      },
      {
        term: 'Tightness',
        plain: 'A bound can be true and useless. Saying an algorithm is O(2ⁿ) when it is Θ(n) is not a lie.',
        formal: 'O gives an upper bound only',
        detail: [
          'Because O is one-sided, inflating it never makes it false. Every linear algorithm is ' +
            'honestly O(n²), O(n³) and O(2ⁿ).',
          'That matters when reading someone else\'s claim. A documented O(n log n) may be a ' +
            'proven tight bound, or the first thing that occurred to the author.',
          'It matters more when writing one, because an untight bound cannot be used to compare ' +
            'two implementations. If both are O(n²) you have learned nothing about which is ' +
            'faster, or even whether either is quadratic. Ask what makes the bound tight, and if ' +
            'nothing does, say Θ or say the case.'
        ],
        example: '"This sort is O(n²)" is true of merge sort.'
      },
      {
        term: 'Asymptotic ≠ practical',
        plain: 'The definition only promises behaviour past n₀, and n₀ can be larger than any input you have.',
        formal: 'the guarantee begins at n₀',
        readAs: 'Everything the notation promises starts at some input size n₀, and it says nothing ' +
          'at all below that. Nothing in the definition stops n₀ from being astronomically large.',
        detail: [
          'Nothing in the definition constrains the constant or the threshold, so an algorithm can ' +
            'be asymptotically superior and useless. If the crossover sits at 10⁴⁰ items, the ' +
            'better complexity class is a statement about a machine nobody will build.',
          'Fast matrix multiplication is the standard case. The exponent keeps falling, and the ' +
            'practical implementations still use Strassen at best.',
          'The reverse trap is more common in ordinary code. At the sizes you actually run, a Θ(n²) ' +
            'routine with tiny constants and perfect locality routinely beats a Θ(n log n) one ' +
            'that allocates. Asymptotics rank algorithms; measurement ranks implementations.'
        ],
        example: 'Galactic algorithms beat everything, past inputs nobody will ever run.'
      },
      {
        term: 'A case, not an algorithm',
        plain: 'O, Ω and Θ bound a stated case. A sentence that names no case is not yet a claim.',
        formal: 'worst-case T(n) = Θ(n²), not "the algorithm is Θ(n²)"',
        readAs: 'T(n) is the running time on an input of size n. The growth symbol bounds it only ' +
          'for whichever case you named: worst, best or average. Name the case in the sentence.',
        detail: [
          'An algorithm does not have one running time. It has a different one for every input. ' +
            'So a bound has to say which of those it is talking about: the worst input of size n, ' +
            'the best, or the expectation over some distribution.',
          'The notation and the case are independent choices, and all nine combinations are ' +
            'meaningful. The worst case has a lower bound too.',
          'Dropping the case is what produces confident nonsense like "insertion sort is Ω(n²)". ' +
            'That is false: on already-sorted input insertion sort finishes in Θ(n). What is true ' +
            'is that its worst case is Θ(n²).'
        ],
        example: 'Insertion sort is Θ(n²) in the worst case and Θ(n) in the best; "insertion sort is Ω(n²)" is simply false.'
      },
      {
        term: 'More than one variable',
        plain: 'When the input has two sizes, both belong in the bound — collapsing them hides the case that hurts.',
        formal: 'O(V + E), not O(V) or O(E)',
        readAs: 'V is how many vertices the graph has and E how many edges. The cost is capped by ' +
          'their sum, and neither one on its own can stand in for it.',
        detail: [
          'Some inputs have two independent dimensions, and squeezing them into one loses the thing ' +
            'you needed to know.',
          'A graph traversal costs O(V + E), and neither term dominates in general. A sparse graph ' +
            'has E ≈ V, so the bound behaves linearly in V. A dense one has E ≈ V², so the same ' +
            'algorithm behaves quadratically.',
          'Substituting the worst case for E up front gives O(V²), which slanders the algorithm on ' +
            'every sparse input it will actually see. The same applies to string matching in ' +
            'O(n + m), to joins over two table sizes, and to anything parameterised by an alphabet ' +
            'or a key length.'
        ],
        example: 'A graph scan is O(V + E): dense graphs make E the term that matters, sparse ones make it V.'
      }
    ],

    recurrences: [
      {
        term: 'Recursion tree',
        diagram: {
          definition: [
            'flowchart TD',
            '    L0["level 0 — one call of size n<br/>work f(n)"] --> L1["level 1 — a calls of size n/b<br/>work a·f(n/b)"]',
            '    L1 --> L2["level 2 — a² calls of size n/b²<br/>work a²·f(n/b²)"]',
            '    L2 --> LK["…down to the base case"]',
            '    LK --> S["total = the sum of the rows"]'
          ].join('\n'),
          caption: 'Sum the rows, not the calls. Every recurrence question is really "which level holds the work" — the top, the bottom, or all of them equally.'
        },
        plain: 'Each level of recursion drawn out, with the work it costs. Summing the levels solves the recurrence.',
        formal: 'level i has a^i subproblems of size n/b^i',
        readAs: 'By depth i the problem has split a ways per level, so there are a^i calls. That is ' +
          'a multiplied by itself i times, read "a to the power of i". Each piece is n divided by ' +
          'b that many times over.',
        detail: [
          'The tree turns a recurrence into an arithmetic problem you can see. Level i holds a^i ' +
            'calls, each on an input of size n/b^i. So the work on that level is a^i · f(n/b^i), ' +
            'and the total is the sum down to the leaves.',
          'Drawing it answers the question the closed form hides: where the cost lives. Merge sort ' +
            'spends the same n at every level, so it pays for its depth. A recurrence with a ' +
            'growing top level pays for its root and stops caring about the depth entirely.',
          'Because the tree is a direct calculation rather than a lookup, it also works for the ' +
            'recurrences no theorem covers.'
        ],
        example: 'Merge sort: every level costs n, and there are log₂ n of them.'
      },
      {
        term: 'Critical exponent',
        plain: 'The exponent at which the leaves and the root cost the same. Comparing f(n) against it picks the case.',
        formal: 'log_b(a)',
        readAs: 'Read it "log base b of a": how many times you multiply b by itself to reach a. ' +
          'Splitting into a = 2 pieces that are each b = 2 times smaller gives 1.',
        detail: [
          'The recursion tree has a^(log_b n) leaves, which is the same number as n^(log_b a). The ' +
            'two are equal because raising to a power and taking a logarithm undo each other.',
          'Each leaf costs a constant, so the leaf row alone costs Θ(n^log_b a). That expression ' +
            'is the pivot the whole analysis turns on.',
          'If f(n) grows more slowly, the leaves dominate and the answer is the leaf count. If it ' +
            'grows faster, the root dominates and the answer is f(n). If they match, every level ' +
            'costs about the same, and the answer picks up a log n factor for the depth.',
          'Computing log_b a first and then comparing is the whole method. It is why halving into ' +
            'two subproblems, where log₂ 2 = 1, makes linear merge work the balanced case.'
        ],
        example: 'a = 2, b = 2 gives 1, so f(n) = n is the balanced case.'
      },
      {
        term: 'Master theorem',
        plain: 'A lookup table for T(n) = a·T(n/b) + f(n). Three cases: leaves win, tie, root wins.',
        formal: 'compare f(n) with n^log_b(a)',
        readAs: 'Work out what the leaf row costs: n raised to the power log-base-b-of-a. Then ask ' +
          'whether the work you do per call, f(n), is smaller than that, the same, or larger. That ' +
          'one comparison picks the case.',
        detail: [
          'The theorem packages the recursion-tree argument for the shape that covers most ' +
            'divide-and-conquer algorithms: a subproblems, each a factor b smaller, plus f(n) to ' +
            'split and combine.',
          'Case 1 has f polynomially smaller than n^log_b a, and answers Θ(n^log_b a). Case 2 has ' +
            'them equal, and answers Θ(n^log_b a · log n). Case 3 has f polynomially larger, ' +
            'passes the regularity check, and answers Θ(f(n)).',
          'The word polynomially is the catch. The comparison has to be by a whole factor of n ' +
            'raised to some positive power ε, however tiny — not merely by a logarithm. That is ' +
            'why perfectly ordinary recurrences fall into the gaps between the cases.'
        ],
        example: 'a=8, b=2, f=n² gives log₂8 = 3 > 2, so Θ(n³).'
      },
      {
        term: 'Regularity condition',
        plain: 'Case 3 needs f to shrink fast enough as the problem shrinks, or the theorem does not apply.',
        formal: 'a·f(n/b) ≤ c·f(n) for some c < 1',
        readAs: 'All the work one level down is a pieces, each costing f(n/b). That has to come to ' +
          'at most some fixed fraction c of the work at this level, with c strictly below 1. It is ' +
          'what makes the levels shrink fast enough for the total to collapse onto the top one.',
        detail: [
          'Case 3 concludes that the root dominates. That is only sound if the next level down ' +
            'really is cheaper by a constant factor. Otherwise the levels could stay comparable, ' +
            'and the sum would not collapse onto the root.',
          'The regularity condition states exactly that: the whole of level one costs at most ' +
            'c < 1 times level zero, so the total is a geometric series summing to Θ(f(n)).',
          'Every polynomial f satisfies it, which is why it is usually waved through. It fails for ' +
            'functions that oscillate, or that dip on the divided argument. When it fails the ' +
            'answer genuinely differs from Θ(f(n)), so the check is not a formality.'
        ],
        example: 'It fails for oscillating f, which is why the panel checks it.'
      },
      {
        term: 'Gap cases',
        plain: 'Recurrences that fall between the cases. The theorem stays silent; the tree still answers.',
        formal: 'f between n^log_b(a) and n^log_b(a)·log n',
        readAs: 'f sits above the leaf cost, but by less than a factor of log n. That is too ' +
          'little separation for case 1 or case 3, and it is not equality either, so case 2 is ' +
          'out. The theorem has no case that fits.',
        detail: [
          'Cases 1 and 3 require a polynomial separation, and that leaves room between them no ' +
            'case reaches. An f that beats n^log_b a by only a logarithmic factor is neither ' +
            'polynomially smaller, nor equal, nor polynomially larger.',
          'T(n) = 2T(n/2) + n/log n sits squarely in that gap. The theorem does not give a wrong ' +
            'answer here. It gives none, and the mistake is to round the recurrence to the nearest ' +
            'case and quote the result.',
          'Summing the recursion tree still works. The levels form a harmonic-style series, and ' +
            'the answer comes out Θ(n log log n) — a class the three cases cannot even express.'
        ],
        example: 'T(n)=2T(n/2)+n/log n needs a tree, not the theorem.'
      },
      {
        term: 'Akra–Bazzi',
        plain: 'The generalisation for uneven splits, where subproblems are different sizes.',
        formal: 'T(n) = Σ aᵢT(n/bᵢ) + f(n)',
        readAs: 'The cost at size n adds up every differently shaped recursive call: aᵢ of them, ' +
          'each on a piece n/bᵢ as big. On top of that comes f(n), the work outside the calls. The ' +
          'Σ just says "add all of these up", and the small i is the index counting through them.',
        detail: [
          'The master theorem assumes every subproblem is the same size, and plenty of real ' +
            'algorithms do not oblige.',
          'Akra–Bazzi handles a sum of differently shaped recursive calls. First solve ' +
            'Σ aᵢ·bᵢ^(−p) = 1 for the exponent p — one equation, whose only unknown is p. Then ' +
            'integrate f against it. The master theorem is the special case where all the bᵢ agree.',
          'It also tolerates the floors, ceilings and small perturbations that a careful ' +
            'implementation forces on you, and that the simpler theorem quietly ignores. The cost ' +
            'is that you solve an equation and evaluate an integral rather than reading a case off ' +
            'a table.'
        ],
        example: 'Median-of-medians splits into 1/5 and 7/10.'
      },
      {
        term: 'Substitution',
        plain: 'Guess the answer, then prove it by induction. The only method that works when nothing else applies.',
        formal: 'assume T(k) ≤ c·g(k) for k < n, prove it for n',
        readAs: 'Take the bound as already granted for every input smaller than n, feed that into ' +
          'the recurrence, and show the same bound falls out for n itself. That is induction: this ' +
          'step plus a base case covers every size there is.',
        detail: [
          'Substitution is the fallback with no preconditions. Assume the bound for all smaller ' +
            'inputs, substitute it into the recurrence, and show the same bound comes out for n.',
          'It is also the only method that verifies rather than derives. So the recursion tree ' +
            'usually supplies the guess, and substitution confirms it.',
          'The characteristic difficulty is that the induction fails by a lower-order term: you ' +
            'need to prove ≤ cn and end up with cn + 1. The fix is counter-intuitive. Strengthen ' +
            'the hypothesis to cn − d, which gives the induction more to work with and makes the ' +
            'extra term cancel.'
        ],
        example: 'The induction often fails until you strengthen the guess by subtracting a lower-order term.'
      },
      {
        term: 'What the base case changes',
        plain: 'The base case moves the constant, never the class — but the constant is what you pay.',
        formal: 'T(1) = 0 against T(1) = 1 shifts the total by the leaf count',
        detail: [
          'Changing what a leaf costs adds a fixed multiple of the leaf count to the total. The ' +
            'leaf count is n^log_b a, so it cannot change the asymptotic class when the class is ' +
            'already at least that large.',
          'What it does change is the number you measure. Merge sort at n = 1024 costs 10 240 ' +
            'counting only the merges, and 11 264 once each of the 1 024 leaves is charged one ' +
            'unit. That is a tenth of the total, from a decision the recurrence usually writes as ' +
            'T(1) = Θ(1) and forgets.',
          'This is also why cutting over to insertion sort at a small size is worth real time: it ' +
            'replaces the most numerous rows of the tree.'
        ],
        example: 'Merge sort at n = 1024 costs 10 240 with T(1) = 0 and 11 264 counting the leaf row.'
      }
    ],

    'amortised-analysis': [
      {
        term: 'Amortised cost',
        plain: 'The average cost per operation over a worst-case sequence. No probability is involved.',
        formal: 'total cost of the sequence ÷ operations',
        detail: [
          'An amortised bound is a statement about a whole sequence. Whatever operations you ' +
            'choose, in whatever order, the total divided by the count stays under the stated ' +
            'figure.',
          'That makes it a worst-case guarantee, not an expectation. There is no distribution and ' +
            'no coin anywhere in the argument, and an adversary who knows your implementation ' +
            'cannot break it.',
          'What it deliberately does not promise is anything about a single operation. The ' +
            'occasional push that copies a million elements is fully consistent with an O(1) ' +
            'amortised bound, because the cheap pushes before it have already paid for it.'
        ],
        example: 'Push into a dynamic array: O(1) amortised, O(n) occasionally.'
      },
      {
        term: 'Aggregate method',
        plain: 'Total the whole sequence, then divide. Simplest, and often enough.',
        formal: 'T(n)/n',
        readAs: 'Add up what all n operations cost, then divide by n. One figure for the whole run.',
        detail: [
          'The aggregate method skips the bookkeeping and bounds the sum directly. For a doubling ' +
            'array the copies form a geometric series: 1 + 2 + 4 + … + n < 2n. So n pushes cost ' +
            'under 3n in total, and under 3 each on average.',
          'It works whenever you can see the total. Its limitation is that it gives one bound for ' +
            'every operation in the sequence, so a structure whose operations differ in cost gets a ' +
            'single blunt figure. A stack supporting push, pop and a multi-pop is the usual example.',
          'When you need to charge different operations differently, move to accounting or ' +
            'potential.'
        ],
        example: 'n pushes cost under 3n, so under 3 per push.'
      },
      {
        term: 'Accounting method',
        diagram: {
          definition: [
            'flowchart LR',
            '    C["a cheap push<br/>charged 3, actually costs 1"] -->|"banks 2"| B[("credit")]',
            '    B -->|"pays for the copy"| E["the resize<br/>costs n, charged 0"]',
            '    E --> I{"was the bank ever negative?"}',
            '    I -->|"no"| V["the amortised bound holds"]',
            '    I -->|"yes"| X["the accounting is wrong,<br/>whatever the total says"]'
          ].join('\n'),
          caption: 'The whole proof is the last check: the bank must be non-negative after every prefix, not merely at the end.'
        },
        plain: 'Overcharge cheap operations and bank the credit to pay for expensive ones.',
        formal: 'banked credit must never go negative',
        detail: [
          'Assign each operation an invented price, spend the real cost from it, and save the ' +
            'difference on the data structure itself. If the bank never runs dry, the invented ' +
            'prices are a valid amortised bound, because the actual total can never exceed the ' +
            'charged total.',
          'For a doubling array, charging 3 per push works out as 1 to store the element and 2 ' +
            'saved against the eventual copy. The 2 covers one new element and one old element ' +
            'that has already spent its own credit.',
          'The art is in choosing where the credit is stored. The proof obligation is to show the ' +
            'invariant holds after every operation, not on average.'
        ],
        example: 'Charge 3 per push: 1 to insert, 2 saved towards the next copy.'
      },
      {
        term: 'Potential method',
        plain: 'Define Φ over the data structure so a drop in Φ pays for an expensive step. The one that generalises.',
        formal: 'â = actual + Φ(after) − Φ(before)',
        readAs: 'The amortised cost of an operation is written â and read "a-hat". It is what the ' +
          'operation really cost, plus however much the stored-up potential Φ rose, or minus ' +
          'however much it fell. An operation that banks potential is charged more than it spent; ' +
          'one that spends potential is charged less.',
        detail: [
          'The potential method replaces the scattered credits of the accounting method with a ' +
            'single function of the structure\'s state.',
          'Amortised cost is defined as the actual cost plus the change in Φ. So a cheap operation ' +
            'that builds up potential is charged extra, and an expensive one that discharges it is ' +
            'charged little.',
          'Add those up across the sequence and the middle terms cancel in pairs. That is what ' +
            '"telescoping" means, and it leaves the total amortised cost equal to the total actual ' +
            'cost plus Φ(end) − Φ(start). So as long as Φ starts at zero and never goes negative, ' +
            'the amortised total bounds the real one.',
          'It generalises the other two methods, and it is what scales to splay trees and ' +
            'Fibonacci heaps, where no per-operation credit story is available.'
        ],
        example: 'Φ = 2·size − capacity is zero after a grow and rises as the array fills.'
      },
      {
        term: 'Amortised ≠ average case',
        plain: 'Amortised is a worst-case guarantee over a sequence; average case is an expectation over inputs.',
        formal: 'no distribution appears in an amortised bound',
        detail: [
          'The two are often used interchangeably, and they are not the same kind of statement.',
          'An average-case bound assumes something about the inputs and reports an expectation, so ' +
            'an adversary who supplies bad inputs can defeat it. An amortised bound assumes nothing ' +
            'and holds for every sequence, so there is nothing to defeat. The guarantee is ' +
            'deterministic.',
          'A dynamic array demonstrates this cleanly. Its input is a fixed list of pushes with no ' +
            'randomness available anywhere, and it still has an O(1) amortised bound.',
          'Confusing the two leads to reasoning about probability where none exists, and to ' +
            'trusting an average-case bound against an adversarial workload.'
        ],
        example: 'A dynamic array has no random inputs, and still has an amortised bound.'
      },
      {
        term: 'When amortised is not enough',
        plain: 'A latency-sensitive path cares about the worst single operation, not the average.',
        formal: 'worst-case per-operation ≠ amortised',
        detail: [
          'Amortised analysis answers "what does this cost over time". That is the right question ' +
            'for throughput and the wrong one for a deadline.',
          'A control loop with a 1 ms budget is failed by the single push that copies a million ' +
            'elements, no matter how cheap the surrounding thousand pushes were. The same goes ' +
            'for a stop-the-world garbage collector, or a hash table that rehashes in one go. ' +
            'Excellent amortised numbers, and a tail that shows up directly as p99 latency.',
          'The fixes all trade total work for predictability — incremental resizing, ' +
            'preallocation, or a structure with a real worst-case per-operation bound.'
        ],
        example: 'A real-time system rejects the one push that copies a million elements.'
      },
      {
        term: 'Hysteresis band',
        diagram: {
          definition: [
            'flowchart LR',
            '    G["grow when the array is full"] --> A["array"]',
            '    A --> S["shrink only when it is a quarter full"]',
            '    S --> B["the gap between the two<br/>is the hysteresis band"]',
            '    B --> R["one push and one pop<br/>can no longer force a copy each"]'
          ].join('\n'),
          caption: 'Shrink at the same point you grow at and an alternating push/pop pair copies the whole array every time. The gap is what stops it.'
        },
        plain: 'The gap between the grow threshold and the shrink threshold. Without a gap, one alternation can resize on every operation.',
        formal: 'grow at size = capacity, shrink at size = capacity/4',
        detail: [
          'If a container grows when it is full and shrinks the moment it is half empty, the two ' +
            'thresholds meet. A workload that alternates push and pop across the boundary then ' +
            'triggers a full copy on every single operation. The amortised bound is destroyed by ' +
            'an input of length two, repeated.',
          'Leaving a band between the thresholds fixes it. Shrink only at a quarter full. After ' +
            'either resize the structure then sits at half capacity, and needs a linear number of ' +
            'operations before it can trigger the next one.',
          'That distance is what the potential function is measuring, and it is why the standard ' +
            'rule is grow at full, halve at a quarter.'
        ],
        example: 'Shrinking at half instead costs 512 copies per operation on a pop/push alternation.'
      },
      {
        term: 'Credit invariant',
        plain: 'The bank must be non-negative after every prefix of the sequence, not merely at the end.',
        formal: 'Σ(charged − actual) ≥ 0 for every prefix',
        readAs: 'Add up (what you charged minus what it really cost) over the first operation, then ' +
          'the first two, then the first three, and so on. Every one of those running totals has to ' +
          'be zero or more — not merely the last one.',
        detail: [
          'The whole force of an amortised argument is the claim that charged work covers real ' +
            'work at all times. So the obligation is a prefix property: after every operation, the ' +
            'credit banked so far is at least the real cost incurred so far.',
          'A scheme that dips negative in the middle and recovers by the end has proved nothing. ' +
            'It has assumed the sequence continues, which the adversary is free to refuse by ' +
            'stopping there.',
          'This is the step people skip, and it is the one that catches invalid schemes. An ' +
            'argument that pays for a copy out of pushes that have not happened yet is a hope, not ' +
            'a bound.'
        ],
        example: 'A scheme that borrows against a future copy is not an amortised bound, it is a hope.'
      }
    ],

    'average-case': [
      {
        term: 'Indicator variable',
        diagram: {
          definition: [
            'flowchart LR',
            '    E["did event i happen?"] --> X["Xᵢ = 1 if it did<br/>Xᵢ = 0 if it did not"]',
            '    X --> S["add them all up:<br/>X = X₁ + X₂ + … + Xₙ"]',
            '    S --> C["X is now the count<br/>of events that happened"]',
            '    C --> A["so counting has turned into<br/>adding up probabilities"]'
          ].join('\n'),
          caption: 'The trick is the substitution: a hard counting question becomes a sum of easy yes/no questions, one per event.'
        },
        plain: 'A 0/1 variable for "did this event happen". Summing them turns counting into probability.',
        formal: 'X = ΣXᵢⱼ, E[Xᵢⱼ] = P(event)',
        readAs: 'X is the total, built by adding up one 0-or-1 variable per possible occurrence. ' +
          'Each of those is only ever 0 or 1, so its long-run average is exactly the probability ' +
          'that its event happens. That is what P(event) denotes.',
        detail: [
          'An indicator is 1 when its event happens and 0 otherwise. That makes its expectation ' +
            'exactly the probability of the event — the bridge that turns a counting problem into ' +
            'a probability problem.',
          'The technique is to write the quantity you care about as a sum of indicators, one per ' +
            'possible occurrence, then take expectations term by term.',
          'For quicksort you define Xᵢⱼ = 1 when the i-th and j-th smallest elements are ever ' +
            'compared, and the total comparison count becomes a double sum. The hard part of the ' +
            'analysis then reduces to one local question: what is the probability of a single ' +
            'event?'
        ],
        example: 'Xᵢⱼ = 1 when quicksort ever compares the i-th and j-th smallest.'
      },
      {
        term: 'Linearity of expectation',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["E[X₁]"] --> S["E[X₁ + X₂ + X₃]"]',
            '    B["E[X₂]"] --> S',
            '    C["E[X₃]"] --> S',
            '    S --> N["equals E[X₁] + E[X₂] + E[X₃]<br/>whether or not the events<br/>depend on one another"]'
          ].join('\n'),
          caption: 'This is the step that does the work, and the one people distrust: independence is not required, so you never have to prove it.'
        },
        plain: 'Expectations add even when the events depend on each other. The most useful fact in the subject.',
        formal: 'E[X + Y] = E[X] + E[Y], always',
        readAs: 'The average of a sum is the sum of the averages, with no conditions attached. The ' +
          'two quantities may be as tangled up with one another as you like.',
        detail: [
          'E[X + Y] = E[X] + E[Y] holds with no independence assumption whatsoever. That is what ' +
            'makes the indicator technique work on problems that are hopelessly tangled.',
          'In quicksort, whether elements 3 and 7 get compared depends strongly on which pivots ' +
            'were chosen earlier, and therefore on nearly every other indicator. None of that ' +
            'matters, because the expectations still add exactly.',
          'Compare the situation for variance, or for E[XY]. Those need independence and fail ' +
            'loudly without it. When an analysis looks intractable because everything depends on ' +
            'everything, linearity is usually the way in.'
        ],
        example: 'Quicksort pairs are highly dependent; the sum is still exact.'
      },
      {
        term: 'Expected comparisons',
        plain: 'Randomised quicksort compares two elements only if one is chosen as pivot before everything between them.',
        formal: 'E[X] = Σ_{i<j} 2/(j−i+1) ≈ 2n ln n',
        readAs: 'Add up 2/(j − i + 1) over every pair of ranks i and j where i comes before j. That ' +
          'restriction is what the small print under the Σ says. The total works out at roughly ' +
          '2n ln n.',
        detail: [
          'Consider the j − i + 1 elements ranked between i and j inclusive. The first of them ' +
            'chosen as a pivot decides everything. If it is i or j the two are compared. If it is ' +
            'any of the ones between, they are split apart and never compared at all.',
          'Every one of those elements is equally likely to be picked first, so the probability is ' +
            'exactly 2/(j − i + 1). No conditioning on the rest of the run is required.',
          'Summing over all pairs gives a harmonic series — 1 + 1/2 + 1/3 + …, whose total grows ' +
            'like ln n. The classic result is ≈ 2n ln n ≈ 1.39 n log₂ n, which is about 39% more ' +
            'comparisons than the information-theoretic floor.'
        ],
        example: 'At n = 200 that is about 2 000 comparisons.'
      },
      {
        term: 'Average case versus randomised',
        plain: 'One assumes the input is random; the other makes its own randomness and works for every input.',
        formal: 'input distribution vs algorithmic coin',
        detail: [
          'An average-case bound is conditional on the inputs behaving, and real inputs are ' +
            'notoriously already sorted, reverse sorted or full of duplicates. So quicksort with a ' +
            'fixed pivot has a perfectly good average case, and degrades to Θ(n²) on the file you ' +
            'were handed.',
          'A randomised algorithm moves the randomness inside. The pivot is chosen by a coin the ' +
            'input cannot see, so the expectation holds for every input. The only way to get a bad ' +
            'run is to be unlucky, rather than to be attacked.',
          'The distinction is a security property as much as a performance one. It is the same ' +
            'argument that motivates universal hashing.'
        ],
        example: 'Sorted input is worst case for a fixed pivot and ordinary for a random one.'
      },
      {
        term: 'Concentration',
        plain: 'How rarely a run strays far from the expectation. Without it, an expectation says little about one run.',
        formal: 'Markov, Chebyshev, Chernoff',
        readAs: 'Three named inequalities, in rising order of strength and of what each demands. ' +
          'Markov needs only the average. Chebyshev also needs the spread. Chernoff needs the ' +
          'parts being added up to be independent of one another.',
        detail: [
          'An expectation is one number summarising a distribution, and on its own it does not ' +
            'promise that any particular run lands near it. A variable that is 0 almost always and ' +
            'enormous occasionally can have a comfortable mean.',
          'Concentration results supply the missing half, by bounding how much probability mass ' +
            'sits far from the mean.',
          'This is why randomised quicksort is trusted in practice, and not merely because its ' +
            'expected cost is 2n ln n. The probability of exceeding twice that falls off so ' +
            'sharply that the bad case never appears at realistic n. An expectation with no ' +
            'concentration behind it is a planning figure, not a guarantee.'
        ],
        example: 'Quicksort exceeds twice its expected cost vanishingly rarely.'
      },
      {
        term: 'Tail bound',
        plain: 'A ceiling on how often a run exceeds a threshold. What it costs is what you have to know about the variable.',
        formal: 'Markov needs the mean; Chebyshev needs the variance; Chernoff needs independence',
        detail: [
          'The three standard tail bounds are priced by how much you know. Markov needs only a ' +
            'non-negative mean and gives the weakest answer. Chebyshev needs the variance and ' +
            'squares the improvement. Chernoff needs independent summands and gives an exponential ' +
            'decay, which is what turns "unlikely" into "will not happen".',
          'Applying the strongest one you can justify is the whole skill. Applying one you cannot ' +
            '— Chernoff on dependent variables — produces confident, wrong numbers.',
          'On the coupon collector at n = 100 the same threshold is bounded at 68% by Markov, 28% ' +
            'by Chebyshev and 5% by a union bound.'
        ],
        example: 'On the coupon collector at n = 100, Markov gives 68%, Chebyshev 28% and a union bound 5% — for the same threshold.'
      },
      {
        term: 'Union bound',
        plain: 'The probability that any of several bad events happens is at most the sum of their probabilities. Crude, and usually enough.',
        formal: 'P(∪Aᵢ) ≤ ΣP(Aᵢ)',
        readAs: 'The chance that at least one of the bad events happens is at most the sum of their ' +
          'individual chances. The ∪ is "or" taken across the whole list, and P(…) is "the ' +
          'probability of".',
        detail: [
          'The union bound throws away all information about how the bad events overlap and simply ' +
            'adds their probabilities. That is why it needs no independence and never fails.',
          'It is loose exactly when the events overlap heavily, and tight when they are nearly ' +
            'disjoint. Most failure analyses are the second case, because each bad event is ' +
            'individually rare.',
          'The standard move is to make each of n bad events improbable enough that n times that ' +
            'probability is still small. For the coupon collector, running n·(ln n + c) draws ' +
            'leaves each coupon unseen with probability at most e^(−c)/n. Here e is the constant ' +
            '2.718…, so e^(−c) shrinks fast as c grows, and the chance that any coupon is missing ' +
            'is at most e^(−c).'
        ],
        example: 'n coupons each unseen with probability 1/(n·e^c) gives P(not done) ≤ e^(−c).'
      },
      {
        term: 'The mean is not the typical run',
        plain: 'For a skewed distribution the expectation can sit where almost no run lands.',
        formal: 'E[X] ≠ median(X) whenever the distribution is skewed',
        readAs: 'The average and the middle value are two different numbers whenever the outcomes ' +
          'are lopsided. A long tail on one side drags the average towards it, and leaves the ' +
          'middle roughly where it was.',
        detail: [
          'Reporting an expectation invites the reader to picture runs clustered around it. That ' +
            'is only true for a symmetric, tightly concentrated variable.',
          'Coupon collection at n = 100 has a mean of 518.7 draws and a standard deviation of ' +
            '128.3 — a quarter of the mean — with a long right tail. So "about 519" describes the ' +
            'centre of gravity rather than a typical outcome.',
          'The practical consequence is that capacity planned on a mean is planned to be wrong ' +
            'roughly half the time, and the more skewed the distribution the worse the error. ' +
            'Quote a percentile alongside the mean, or quote the spread, and the shape stops being ' +
            'invisible.'
        ],
        example: 'Coupon collection has mean 518.7 and a standard deviation of 128.3 — a quarter of the mean.'
      }
    ],

    'lower-bounds': [
      {
        term: 'Comparison model',
        plain: 'The algorithm learns only from yes/no comparisons. That restriction is what makes a bound provable.',
        formal: 'each comparison yields one bit',
        detail: [
          'You cannot prove that no algorithm does better without saying what an algorithm is ' +
            'allowed to do. Otherwise the claim quantifies over an unbounded space of tricks.',
          'The comparison model fixes that by allowing exactly one primitive: ask whether a ≤ b and ' +
            'receive one bit. Every ordering decision has to be justified by those bits, which is ' +
            'what makes the counting argument airtight.',
          'The restriction is also the escape hatch, and it is not a loophole. An algorithm that ' +
            'reads the digits of a key is doing something the model genuinely does not describe, ' +
            'so it is not a counterexample to the bound.'
        ],
        example: 'Radix sort escapes the bound by reading digits instead.'
      },
      {
        term: 'Decision tree',
        diagram: {
          definition: [
            'flowchart TD',
            '    Q1{"a &lt; b?"} -->|yes| Q2{"b &lt; c?"}',
            '    Q1 -->|no| Q3{"a &lt; c?"}',
            '    Q2 -->|yes| L1["a b c"]',
            '    Q2 -->|no| L2["a c b, or c a b"]',
            '    Q3 -->|yes| L3["b a c"]',
            '    Q3 -->|no| L4["b c a, or c b a"]'
          ].join('\n'),
          caption: 'Every run of the algorithm is one path from the root to a leaf, and every possible answer needs its own leaf. Counting leaves is what forces the bound.'
        },
        plain: 'Every execution is a root-to-leaf path; each leaf is one possible answer.',
        formal: 'height ≥ ⌈log₂(leaves)⌉',
        readAs: 'The longest root-to-leaf path is at least log base 2 of the number of leaves, ' +
          'rounded up. Every extra comparison can at best double how many leaves you are able to ' +
          'reach.',
        detail: [
          'Model the algorithm as a binary tree. Internal nodes are comparisons, the two edges are ' +
            'the two answers, and a leaf is the point at which the algorithm commits to an output. ' +
            'A run is a path, so the number of comparisons in the worst case is the height.',
          'The algorithm has to be able to produce every distinct answer, so the tree needs at ' +
            'least that many leaves. A binary tree of height h has at most 2^h leaves, so ' +
            'h ≥ log₂(leaves).',
          'Sorting has n! possible answers, and that single inequality gives the whole Ω(n log n) ' +
            'result without reference to any particular algorithm.'
        ],
        example: 'Sorting n items has n! leaves, so height ≥ ⌈log₂ n!⌉.'
      },
      {
        term: 'Information-theoretic bound',
        plain: 'k yes/no answers distinguish at most 2^k outcomes. Counting outcomes gives the floor.',
        formal: 'k ≥ log₂ n! ≈ n log₂ n − 1.44n',
        readAs: 'You need at least log base 2 of n! comparisons. n! — "n factorial" — is the number ' +
          'of different orders n items can be put in. A standard approximation turns that into ' +
          'roughly n log₂ n minus 1.44n.',
        detail: [
          'Each comparison returns one bit, so k of them can distinguish at most 2^k cases. If the ' +
            'answer has to select among N possibilities then 2^k ≥ N, and therefore k ≥ log₂ N.',
          'For sorting, N = n! — the number of orders n items can be in. Stirling\'s ' +
            'approximation, the standard closed form for a factorial, gives ' +
            'log₂ n! ≈ n log₂ n − n log₂ e = n log₂ n − 1.4427n. That is where the familiar ' +
            'n log n comes from, and also the −1.44n correction that people forget.',
          'The argument is entirely about counting outcomes, so it applies to any problem whose ' +
            'answers you can count. Searching among n items needs log₂ n, and finding a duplicate ' +
            'needs its own count.'
        ],
        example: 'n = 4: 24 orders, so at least 5 comparisons.'
      },
      {
        term: 'Adversary argument',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the algorithm asks<br/>one comparison"] --> D["the adversary answers"]',
            '    D --> K["it picks whichever answer<br/>keeps the most orderings alive"]',
            '    K --> C{"is more than one<br/>ordering still possible?"}',
            '    C -->|yes| A',
            '    C -->|no| S["only now may the algorithm stop —<br/>count the questions it needed"]'
          ].join('\n'),
          caption: 'The adversary never commits to an input. It only refuses to be pinned down, and the bound is how long it can keep refusing.'
        },
        plain: 'An opponent answers each query to keep as many answers alive as possible, without ever committing to an input.',
        formal: 'answers stay consistent with ≥ half the candidates',
        detail: [
          'Instead of fixing an input, imagine an adversary that decides each answer on the spot. ' +
            'It chooses whichever reply leaves the largest set of inputs still consistent with ' +
            'everything said so far.',
          'It never lies, because at the end at least one real input matches the entire ' +
            'transcript. The algorithm cannot stop until only one candidate remains, so the number ' +
            'of questions needed is however long the adversary can keep the set from collapsing.',
          'This gives bounds that pure counting misses, because it can encode structure. For ' +
            'finding a maximum, the adversary keeps alive every element that has never lost a ' +
            'comparison, which forces n − 1 comparisons.'
        ],
        example: 'Finding the maximum needs n − 1 comparisons.'
      },
      {
        term: 'Beating a lower bound',
        plain: 'You never beat it inside the model. You change the model.',
        formal: 'different model, different floor',
        detail: [
          'A proved lower bound is not a difficulty to be overcome by cleverness. Inside its model ' +
            'it is final.',
          'Every apparent counterexample is an algorithm operating outside the model. Counting ' +
            'sort and radix sort use keys as indices rather than comparing them, and run in ' +
            'Θ(n + k) with no contradiction whatsoever.',
          'So the productive reading of a lower bound is as a question about assumptions: which ' +
            'restriction is doing the work, and can my data pay to escape it? Bounded integer ' +
            'keys, a known distribution, precomputation, extra space and approximate answers are ' +
            'all model changes, and each has its own floor.'
        ],
        example: 'Counting sort is Θ(n + k) because it never compares.'
      },
      {
        term: 'Model of computation',
        plain: 'A lower bound is a statement about a model. Naming the model is half the theorem.',
        formal: 'comparison model, algebraic decision tree, cell-probe, …',
        detail: [
          'Different models measure different resources and produce different floors for the same ' +
            'problem, so a bound quoted without its model is unusable.',
          'The comparison model counts comparisons. The algebraic decision tree model counts ' +
            'arithmetic tests, and is what gives lower bounds for geometric problems. The ' +
            'cell-probe model counts memory accesses and charges nothing for computation, which is ' +
            'where data-structure lower bounds live.',
          'Ω(n log n) for sorting is a comparison-model result, full stop. Quoting it as "sorting ' +
            'requires n log n" is the error that makes radix sort look impossible.'
        ],
        example: 'Ω(n log n) is a comparison-model bound; radix sort is not a counterexample, it is a different model.'
      },
      {
        term: 'Adversary invariant',
        plain: 'The quantity the adversary keeps large. The bound is however many questions it takes to drive it to one.',
        formal: 'answer so as to maximise the surviving candidates',
        detail: [
          'Every adversary argument rests on a measure of remaining uncertainty, and on a bound on ' +
            'how fast one question can reduce it.',
          'Pick the measure — surviving permutations, elements that have never lost, connected ' +
            'components. Show it starts high. Show a single comparison can only shrink it by a ' +
            'fixed factor or amount. The number of questions then follows by division.',
          'For sorting, the adversary always answers so that at least half the live permutations ' +
            'survive. The count therefore falls from n! to 1 no faster than by halving, which ' +
            'gives ⌈log₂ n!⌉. Choosing the right invariant is the entire creative step.'
        ],
        example: 'Sorting: the live permutations halve at best per comparison, so ⌈log₂ n!⌉ questions are needed.'
      },
      {
        term: 'Facts, not comparisons',
        plain: 'Count what the answer requires the algorithm to know, then how much one operation can supply.',
        formal: '2n − 2 facts, ≤ 2 per comparison of two untouched elements',
        readAs: 'Certifying both a minimum and a maximum takes 2n − 2 separate pieces of knowledge. ' +
          'One comparison supplies two of them only when both elements are still fresh; any other ' +
          'comparison supplies just one.',
        detail: [
          'The sharpest bounds come from accounting for information rather than operations.',
          'Certify both a minimum and a maximum, and every one of the other n − 2 elements must ' +
            'be known to have lost once and won once. That is 2n − 2 facts.',
          'A comparison between two elements neither of which has been touched yields two new ' +
            'facts. Any other comparison yields at most one. So the algorithm has to open with ' +
            '⌊n/2⌋ pairings and then spend single-fact comparisons, giving ⌈3n/2⌉ − 2.',
          'At n = 100 that is 148 comparisons, against the 198 two independent scans would cost — ' +
            'and the bound proves no algorithm does better.'
        ],
        example: 'Min and max together need ⌈3n/2⌉ − 2 comparisons — 148 for 100 elements, against 198 for two scans.'
      }
    ],
  });
}(typeof window !== 'undefined' ? window : null));
