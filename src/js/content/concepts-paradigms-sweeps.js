/** Concepts for the sweep and batch paradigm sections (M11.7-M11.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'two-pointers': [
      {
        term: 'The amortisation argument',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the loops look nested,<br/>so it looks quadratic"] --> B["but the inner index<br/>never moves backwards"]',
            '    B --> C["each element enters once<br/>and leaves once"]',
            '    C --> D["so the total inner work is 2n<br/>across the whole outer loop"]'
          ].join('\n'),
          caption: 'Counting the work per outer step gives the wrong answer. Counting it per element gives the right one, and that shift is the whole proof.'
        },
        plain: 'Each element enters the structure once and leaves once, so the nested loop is linear.',
        formal: 'total work = Σ pushes + Σ pops <= 2n, however the inner loop is distributed',
        readAs: 'Every element enters the window once and leaves once, so the inner loop runs at ' +
          'most 2n times in total — no matter how uneven any single iteration looks. That is ' +
          'amortised counting, and it is why a nested loop here is still linear.',
        detail: [
          'This is the only idea in the section, and everything else is a disguise for it.',
          'The inner loop of a two-pointer sweep can run for a long time at one position and not ' +
            'at all at the next, so per-iteration reasoning gives no bound. The total does, ' +
            'because every element can only be removed as many times as it was added.',
          'That is why every figure here is a total rather than a rate. A maximum inner-loop ' +
            'length says nothing, and 2n says everything.'
        ],
        example: 'Five thousand elements through a window of 50: 5 000 pushes and 4 994 pops, whatever the ' +
          'data looks like.'
      },
      {
        term: 'The recognition test',
        plain: 'A quadratic loop whose inner index never moves backwards can become two pointers.',
        formal: 'if the inner loop\'s start index is monotone non-decreasing in the outer index, hoist it into a second cursor',
        detail: [
          'This is the mechanical part, and it is worth applying deliberately rather than by ' +
            'recognising remembered problems.',
          'Look at the inner loop and ask whether, when the outer index advances, the inner one ' +
            'ever needs to go back.',
          'If it does not, the inner loop is a cursor that has not been hoisted out yet, and the ' +
            'transformation is routine. If it does, no amount of cleverness makes the sweep ' +
            'linear, and a different technique is needed.'
        ],
        example: '"Shortest subarray summing to at least k" over non-negative values passes the test; over ' +
          'values that can be negative it fails, and needs a prefix-sum structure instead.'
      },
      {
        term: 'The monotonic deque',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a new element arrives"] --> B["pop everything at the back<br/>that it beats"]',
            '    B --> C["push it"]',
            '    C --> D["pop the front if it has<br/>fallen out of the window"]',
            '    D --> E["the front is now the answer,<br/>with no scan at all"]'
          ].join('\n'),
          caption: 'Anything the new element beats can never be the answer again while the new one is in the window, so discarding it costs nothing and it is never reconsidered.'
        },
        plain: 'Keep the window\'s candidates in decreasing order; the front is always the answer.',
        formal: 'maintain indices i₁ < i₂ < … with a[i₁] > a[i₂] > …, dropping expired fronts and dominated backs',
        readAs: 'Keep a deque of positions whose values decrease left to right. Drop from the ' +
          'front what has fallen out of the window, and from the back anything a newer larger ' +
          'value has made irrelevant. The front is then always the window maximum.',
        detail: [
          'The invariant does two jobs.',
          'Dropping the front when it leaves the window handles expiry. Dropping the back ' +
            'while it is no larger than the arriving element handles domination. An earlier ' +
            'smaller element can never be the maximum again once a larger one arrives.',
          'What remains is exactly the set of indices that could still become the maximum, in ' +
            'order. So the answer is the front, and no scan is needed.'
        ],
        example: 'On ascending input the deque never holds more than one index; on descending input it holds ' +
          'the whole window of 50.'
      },
      {
        term: 'Time and space are different claims',
        plain: 'The operation total does not move with the data; the largest deque does.',
        formal: 'work is Θ(n) for every input; peak size ranges over [1, k] depending on the input shape',
        readAs: 'The time is linear whatever the data. What the data changes is how large the ' +
          'deque grows — anywhere from one element to the full window. So the memory is ' +
          'input-dependent and the time is not.',
        detail: [
          'Reporting only the total hides the memory behaviour. Reporting only the peak suggests ' +
            'the work varies when it does not.',
          'Both belong in the table, because they answer different questions: how long will this ' +
            'take, and how much will it hold. They also respond to different properties of the ' +
            'input.',
          'This is the same discipline as reporting comparisons and moves separately for a sort. ' +
            'One number for two budgets is a number that hides one of them.'
        ],
        example: 'Four shapes at n = 5 000, k = 50: totals of 9 994 to 9 999, peak deque sizes of 1, 2, 11 ' +
          'and 50.'
      },
      {
        term: 'The monotonic stack',
        plain: 'Keep bars in increasing height; a shorter arrival settles everything taller.',
        formal: 'maintain a stack of indices with non-decreasing values; on a smaller value, pop and settle each',
        detail: [
          'The stack answers "for each element, where is the nearest smaller one on each side" in ' +
            'one pass.',
          'A surprising number of problems reduce to that: next greater element, largest rectangle ' +
            'in a histogram, maximal rectangles in a binary matrix, stock spans.',
          'The moment a shorter bar arrives, every taller bar on the stack has found its right ' +
            'boundary, and its left boundary is whatever sits below it. Each is settled exactly ' +
            'once, which is the same 2n as before.'
        ],
        example: 'The histogram [2, 1, 5, 6, 2, 3] has largest rectangle 10, found in 12 stack operations.'
      },
      {
        term: 'The sentinel',
        plain: 'A final impossible element makes the drain part of the main loop.',
        formal: 'append a value below every other so the loop settles the remaining stack without a second copy of the logic',
        detail: [
          'Without a sentinel the stack still holds elements when the input ends, and the code has ' +
            'to drain it with a second loop that duplicates the settling logic.',
          'Duplicated logic drifts. The two copies end up computing the boundary slightly ' +
            'differently, and the bug appears only on inputs whose tail is increasing.',
          'One extra iteration with a value smaller than everything removes the duplication ' +
            'entirely. That is a correctness argument rather than a tidiness one.'
        ],
        example: 'The trace runs to i = 6 on a six-element histogram; that last row is the sentinel settling ' +
          'the remaining stack.'
      },
      {
        term: 'The sortedness precondition',
        plain: 'The classic two-pointer pair search assumes a sorted array and is silently wrong without one.',
        formal: 'with a[lo] + a[hi] compared against the target, correctness depends on a being non-decreasing',
        readAs: 'Two pointers converging from the ends work only because the array is sorted. Too ' +
          'small means move the left pointer up; too large means move the right one down. On ' +
          'unsorted data the moves are meaningless.',
        detail: [
          'The inward-moving pair search is the first two-pointer algorithm anyone learns, and its ' +
            'precondition is invisible in the code.',
          'Nothing about the loop mentions order, and on unsorted input it terminates and returns ' +
            '"not found" for pairs that exist.',
          'This is the same class of failure as binary search on an unsorted array — a confident ' +
            'wrong answer with no diagnostic — and the same remedy applies. Assert the ' +
            'precondition in debug builds.'
        ],
        example: 'Two pointers on an unsorted array miss pairs at a rate that depends on the data, and never ' +
          'raise.'
      },
      {
        term: 'The window with a shrink condition',
        plain: 'Grow the window on the right, shrink from the left while the condition still holds.',
        formal: 'for each right: extend; while (window minus a[left]) still satisfies the constraint, advance left',
        detail: [
          'The shape generalises the fixed-width window to constraints like "sum at least k" or ' +
            '"at most two distinct values". Both pointers only advance, so the sweep is linear.',
          'The subtlety is in the shrink condition. It has to be tested against the window ' +
            '*without* the left element, rather than against the current window.',
          'Test it the other way and the loop shrinks one element too far, and reports a window ' +
            'that does not satisfy the constraint.'
        ],
        example: '"Shortest window summing to at least the target" advances left while the sum minus a[left] ' +
          'is still at least the target — not while the sum is.'
      }
    ],

    'meet-in-the-middle': [
      {
        term: 'Halving the exponent',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["search all 2ⁿ possibilities"] --> B["split the items into two halves"]',
            '    B --> C["enumerate each half:<br/>2^(n/2) each"]',
            '    C --> D["sort one half, then look up<br/>each item of the other"]',
            '    D --> E["2^(n/2) log — 40 items become<br/>a million, not a trillion"]'
          ].join('\n'),
          caption: 'The exponent halves and the base does not change, which is the difference between an intractable search and one that finishes over lunch.'
        },
        plain: 'Two searches of half the size, combined by a lookup, replace one search of the full size.',
        formal: '2^n becomes 2·2^(n/2) states plus 2^(n/2)·log(2^(n/2)) work to combine',
        readAs: 'Meet in the middle: split the input in half, enumerate each half separately, ' +
          'then match them up. Two square-roots of the original count instead of the count itself ' +
          '— at n = 50, about 34 million instead of 10^15.',
        detail: [
          'The improvement is entirely structural. Nothing is learned about the problem, and no ' +
            'branch is pruned.',
          'Enumerating each half separately is exponentially cheaper than enumerating the whole. ' +
            'And if the two halves can be recombined by searching one of them, rather than by ' +
            'pairing them all, the saving survives.',
          'That last clause is the condition. It needs a way to ask "what is the best partner for ' +
            'this partial answer" in logarithmic time, which usually means sorting one side.'
        ],
        example: 'At n = 40 the split generates 2 097 152 states where the full enumeration would generate ' +
          '1 099 511 627 776.'
      },
      {
        term: 'The combine step is a search, not a product',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["pair every left half<br/>with every right half"] --> B["that is 2^(n/2) × 2^(n/2)"]',
            '    B --> C["which is 2ⁿ again —<br/>nothing was gained"]',
            '    D["sort the right halves, then binary-search<br/>for what each left half needs"] --> E["the saving survives"]'
          ].join('\n'),
          caption: 'Splitting the problem is the easy half of the idea. If the two halves are recombined by enumeration, the exponent comes straight back.'
        },
        plain: 'Pairing every left half with every right half is 2^n again — the point is to look up instead.',
        formal: 'sort the right-half sums, then for each left sum binary-search for the largest partner that fits',
        detail: [
          'This is the part that is easy to get wrong in the design, and it is where the technique ' +
            'actually lives.',
          'Generating both halves is trivially cheaper. Recombining them naively costs the product ' +
            'of their sizes, which is exactly the original 2^n.',
          'Sorting one side and searching it makes the recombination 2^(n/2)·(n/2) instead. ' +
            'Whether that is possible depends on the objective: it works for sums, because the ' +
            'best partner is monotone in the remaining room.'
        ],
        example: 'Forty items: 20 969 549 binary-search probes over the sorted right half, rather than ' +
          '2^40 pairings.'
      },
      {
        term: 'Memory is the price and it is exponential',
        plain: 'Both halves must be resident, so the technique stops near n = 50 whatever the machine.',
        formal: 'peak memory is Θ(2^(n/2)) entries; at n = 50 that is 2^25 ≈ 3.4 × 10⁷ per side',
        readAs: 'The technique trades time for memory, and the memory is the binding constraint. ' +
          'At n = 50 that is 34 million entries per side, which is what actually stops you going ' +
          'further.',
        detail: [
          'A time improvement bought with an exponential space cost has a ceiling, and stating it ' +
            'is part of teaching the technique honestly.',
          'Each two items added multiply the memory by two, so the practical limit arrives ' +
            'quickly — and arrives as an allocation failure rather than as slowness.',
          'That also makes the trade explicit for the reader. This is not a free asymptotic win. ' +
            'It is time exchanged for space at a fixed rate.'
        ],
        example: 'At n = 40 the search holds 2 097 152 partial sums at once; at n = 50 it would hold ' +
          '67 108 864.'
      },
      {
        term: 'Extrapolate rather than saying "infeasible"',
        plain: 'Time the exhaustive search at a size that finishes and double from there.',
        formal: 'measure t(k) for a feasible k, then project t(n) = t(k)·2^(n−k)',
        readAs: 'Time a size you can actually run, then double the estimate for every extra ' +
          'element. It turns "this is exponential" into a number of hours.',
        detail: [
          'A comparison needs two numbers, and "infeasible" is not one.',
          'Measuring an eighteen-item exhaustive search takes milliseconds, and doubling from ' +
            'there gives a defensible projection for forty items on this machine.',
          'It also keeps the claim honest in the other direction. The projection shows exactly ' +
            'which sizes brute force would still handle, which is often larger than people ' +
            'assume. That is why the technique is worth exactly the sizes it is worth.'
        ],
        example: 'An 18-item enumeration measured in the page, doubled 22 times, is the projected cost of ' +
          'the 40-item search.'
      },
      {
        term: 'Bidirectional search',
        plain: 'Search forward from the start and backward from the goal; stop where they meet.',
        formal: 'b^d becomes b^(d/2) + b^(d/2), provided the graph can be traversed backwards',
        readAs: 'Searching from both ends means two half-depth searches instead of one full-depth ' +
          'one — a square root of the work. It needs the edges to be followable in reverse, which ' +
          'not every graph allows.',
        detail: [
          'The same halving, on a graph. It needs two things that are easy to overlook.',
          'Predecessors have to be enumerable, which rules out many implicit state spaces. And the ' +
            'goal has to be a single known state rather than a predicate, because the backward ' +
            'frontier has to start somewhere.',
          'When both hold, the improvement is dramatic and grows with the depth, since the ' +
            'exponent rather than the base is halved.'
        ],
        example: 'Branching factor 3 at depth 8: 3 281 states expanded forwards, 22 bidirectionally.'
      },
      {
        term: 'The meeting test must run at generation time',
        plain: 'Check each new node against the other side immediately, not after the level completes.',
        formal: 'on generating v from u, if v ∈ seen(other) then the answer is dist(u) + 1 + distOther(v)',
        readAs: 'The two searches meet when one generates a node the other has already seen. The ' +
          'total distance is what each side spent, plus the edge joining them.',
        detail: [
          'Testing for a meeting only between levels finds the intersection one level late. On an ' +
            'odd-length shortest path that returns a distance one too large.',
          'It is a bug that passes every test with an even-length answer, which is half of them, ' +
            'and it is the single most common defect in a hand-written bidirectional search.',
          'The correct version tests as each neighbour is produced, and can return immediately.'
        ],
        example: 'Both the forward and bidirectional searches return distance 8 here — a disagreement would ' +
          'be exactly this bug.'
      },
      {
        term: 'Expanding the smaller frontier',
        plain: 'Alternate sides by size, not by turn.',
        formal: 'at each step expand whichever frontier currently holds fewer nodes',
        detail: [
          'Strict alternation is fine on a regular graph and poor on a real one, where the two ' +
            'directions can have very different branching factors. A goal with one predecessor and ' +
            'a start with fifty successors, for instance.',
          'Choosing the smaller frontier each time keeps both sides balanced in work rather than ' +
            'in depth, which is what the b^(d/2) analysis actually assumes.',
          'It costs one comparison per step.'
        ],
        example: 'On a graph whose backward branching is 1 and forward branching is 10, alternating by turn ' +
          'gives away most of the saving.'
      },
      {
        term: 'When the split buys nothing',
        plain: 'If the halves constrain each other, there is nothing to sort and nothing to look up.',
        formal: 'the technique needs the objective to decompose as f(left) ⊕ g(right) with ⊕ searchable',
        readAs: 'Splitting only works if the thing you are optimising can be computed from the two ' +
          'halves separately and then combined. And combined by an operation you can search over, ' +
          'such as addition, rather than one you cannot.',
        detail: [
          'Subset sum splits because a total is a sum of the two halves\' totals, and the best ' +
            'partner for a given left sum is found by a single search.',
          'A problem where the halves interact has no such decomposition. Think of a graph ' +
            'colouring whose edges cross the cut, or a schedule where left-half choices change ' +
            'the right half\'s feasibility. Those leave two sets that can only be combined by ' +
            'trying all pairs.',
          'Recognising the difference is what makes the reflex useful rather than a habit.'
        ],
        example: 'Subset sum splits; graph colouring across the cut does not, because a left-half colouring ' +
          'changes which right-half colourings are legal.'
      }
    ],

    'offline-processing': [
      {
        term: 'Offline is a different problem from online',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["online: answer each query<br/>before seeing the next"] --> B["you must be ready<br/>for anything"]',
            '    C["offline: read every query first,<br/>then answer them all"] --> D["you may reorder them<br/>into a convenient sweep"]',
            '    D --> E["which is what makes<br/>Mo\'s algorithm possible at all"]'
          ].join('\n'),
          caption: 'Being allowed to see the questions before answering is a genuine change of problem, not a convenience. Almost every technique here is unavailable online.'
        },
        plain: 'Seeing every query before answering any of them changes what is achievable.',
        formal: 'an offline algorithm may permute the query sequence; an online one must answer each before seeing the next',
        detail: 'The distinction is worth making explicitly because it is usually left implicit in a system ' +
          'design and then discovered late. An online structure must be prepared for the worst order; an ' +
          'offline one chooses the order, and that freedom is sometimes worth a whole complexity class. In ' +
          'batch systems the answer to "can we see all the queries first" is usually yes, and nobody asked. ' +
          'M21 formalises the competitive-ratio side of this; here the point is just to ask the question.',
        example: 'Distinct-values-in-a-range has no simple online structure and a straightforward offline ' +
          'sweep.'
      },
      {
        term: 'Mo\'s ordering',
        plain: 'Sort queries by the block of the left endpoint, then by the right endpoint.',
        formal: 'key(q) = (⌊q.left / b⌋, q.right); two pointers then walk to each query in turn',
        readAs: 'Mo\'s algorithm sorts the queries by which block their left end falls in, then by their ' +
          'right end. Answering them in that order means the two window pointers travel a total ' +
          'distance that is far less than answering them as they came.',
        detail: 'The ordering is the entire algorithm - the sweep underneath is four while-loops that could ' +
          'be written by anyone. Inside a block the right pointer only advances, so it costs n per block ' +
          'across all queries in it; the left pointer stays within its block, so it costs at most b per ' +
          'query. Everything else follows from those two sentences, including the block size, which is just ' +
          'the minimiser of their sum.',
        example: 'Six hundred queries over 4 000 elements: 121 956 pointer moves in Mo\'s order against ' +
          '1 420 156 in arrival order.'
      },
      {
        term: 'The block size is n/√q, not √n',
        plain: 'Minimising q·b + n²/b gives n/√q, and the two coincide only when q = n.',
        formal: 'd/db (q·b + n²/b) = 0 at b = n/√q, giving total 2n√q',
        readAs: 'Differentiate the cost with respect to the block size and set it to zero — the standard way ' +
          'to find a minimum. The best block size is n over the square root of the query count, and the ' +
          'total movement is 2n√q.',
        detail: 'The folklore choice of √n is the minimiser for the case q = n and is measurably worse ' +
          'otherwise - with six hundred queries over four thousand elements it costs about 1.7× the ' +
          'minimum. The curve is broad, so being roughly right is enough and nobody should tune this ' +
          'parameter repeatedly; but computing it correctly once costs a line and the difference is real. ' +
          'The two terms are visible on either side of the minimum, which is what makes the sweep worth ' +
          'plotting.',
        example: 'n = 4 000, q = 600: the minimiser is 163 and costs 121 956 moves, while √n = 63 costs ' +
          '210 636.'
      },
      {
        term: 'The precondition is an O(1) incremental update',
        plain: 'Adding or removing one element at an end must be cheap, because it happens hundreds of thousands of times.',
        formal: 'the aggregate must support add(x), remove(x) and answer() in O(1) or near it',
        detail: '"Offline" is not the real requirement; cheap incremental maintenance is. Distinct counts ' +
          'qualify - a counter array and a running total - as do frequency modes with care and sums ' +
          'trivially. Anything needing a rebuild, a sort or a logarithmic structure per step multiplies the ' +
          'whole sweep by that factor and usually loses to a simpler approach. Checking this before reaching ' +
          'for the technique is the difference between a clever solution and a slow one.',
        example: 'The distinct-count hooks are a counts array and one integer, so each pointer move is two ' +
          'array operations.'
      },
      {
        term: 'Decomposable questions do not need this',
        plain: 'If the answer for a range follows from the answers for two halves, a segment tree wins online.',
        formal: 'decomposable: f(A ∪ B) = f(A) ⊕ f(B) for an associative ⊕',
        readAs: 'The aggregate must be computable from partial answers: work out each piece separately and ' +
          'combine. Sums and maxima qualify; a median does not, which is why these techniques do not ' +
          'apply to it.',
        detail: 'Sums, minima, maxima and gcds are decomposable, so a segment tree answers them online in ' +
          'log n and reordering buys nothing at all. Distinct counts are not: knowing the distinct counts of ' +
          'two halves says nothing about their union, because the overlap is unknown. That property, rather ' +
          'than difficulty or size, is what decides whether Mo\'s algorithm is the right tool - and asking it ' +
          'first saves implementing a sweep that a simpler structure beats.',
        example: 'The same sweep answers range sums at the same cost, and a prefix-sum array answers them in ' +
          'constant time per query.'
      },
      {
        term: 'Answers come out permuted',
        plain: 'The sweep produces answers in its own order and writes them back into the caller\'s slots.',
        formal: 'carry the original index through the sort and scatter the results at the end',
        detail: 'This is a small implementation detail with a large systems consequence: nothing downstream ' +
          'can consume an answer until the whole batch is done. That is fine in a batch job and fatal in an ' +
          'interactive path, and it is the concrete form of the online/offline distinction rather than a ' +
          'coding inconvenience. It also means the technique cannot be applied incrementally as queries ' +
          'arrive - the batch boundary is real.',
        example: 'The first twelve queries answered are numbers 3, 41, 17 and so on from the caller\'s list, ' +
          'in whatever order the blocks put them.'
      },
      {
        term: 'Sqrt decomposition as the parent idea',
        plain: 'Split into √n blocks so that per-block work and per-element work balance.',
        formal: 'block updates in O(1) and queries touching O(√n) blocks plus O(√n) elements',
        readAs: 'Square-root decomposition splits the array into about √n blocks of about √n elements. A ' +
          'query touches a handful of whole blocks and a handful of loose elements, so both halves come ' +
          'to √n — which is why that block size is the one chosen.',
        detail: 'Mo\'s algorithm is one member of a family whose organising principle is the same: choose a ' +
          'block size so that the two costs a design trades off become equal. Range updates with lazy block ' +
          'tags, offline dynamic connectivity over time blocks and small-to-large merging all follow it. The ' +
          'square root is not magic - it is what falls out of setting q·b equal to n²/b - and recognising the ' +
          'shape means being able to derive the right block size rather than remembering one.',
        example: 'The same balancing gives block size √n for range-update range-query, where the two costs ' +
          'are per-block and per-element rather than per-query and per-reset.'
      },
      {
        term: 'The bound is an over-estimate that does not diverge',
        plain: '(n + q)·√n bounds the sweep; the measurement sits comfortably below it and tracks it.',
        formal: 'measured moves <= (n + q)·√n, with the ratio roughly constant as n and q grow',
        readAs: 'The pointer movement stays under the predicted bound, and the ratio between measured and ' +
          'predicted holds steady as the problem grows — which is what makes the bound a usable ' +
          'estimate rather than just a true statement.',
        detail: 'A bound is useful when the measurement stays a stable fraction of it, and useless when the ' +
          'ratio drifts - the second case means the bound is describing a worst case the workload never ' +
          'reaches, and it will mislead any capacity plan built on it. Reporting both, and the ratio, is what ' +
          'turns a quoted complexity into a usable number. Here the sweep uses about 42% of the bound and ' +
          'stays there as the workload grows.',
        example: 'n = 4 000, q = 600: 121 956 measured against a bound of 290 930.'
      }
    ]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));
