/** Concepts for the heap sections (M05.1-M05.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'binary-heaps': [
      {
        term: 'The implicit representation',
        plain: 'The tree is an array. Children of i are at 2i + 1 and 2i + 2; the parent is at ⌊(i − 1)/2⌋.',
        formal: 'no pointers, no nodes, no allocation per element',
        detail: 'This is why a heap is the fastest priority queue for the common case. There is no ' +
          'node object, no per-element allocation and no pointer to chase — a sift walks a straight ' +
          'line through one contiguous array, which is the access pattern hardware is best at. The ' +
          'index arithmetic replaces the structure entirely: the shape property is not maintained by ' +
          'any code, it is a consequence of the array being dense. The cost of that packing is that ' +
          'nothing else can hold a reference to an element, because elements move — which is what ' +
          'makes decrease-key need a separate position map.',
        example: 'A million-element heap is one array of a million slots, with no headers and no pointers at all.'
      },
      {
        term: 'Heap order, not search order',
        plain: 'A parent outranks both children — and that is all. Siblings are unordered.',
        formal: 'key(parent) ≤ key(child), for every node',
        detail: 'The rule is much weaker than a search tree\'s, and the weakness is the point. It is ' +
          'strong enough to put the minimum at the root, and cheap enough to restore with a single ' +
          'root-to-leaf walk after any change. What it cannot do is find an arbitrary key: nothing ' +
          'about the invariant says which subtree a given key is in, so `has(key)` is a linear scan. ' +
          'A heap is not a set with a fast minimum; it is a structure that answers exactly one ' +
          'question and refuses the rest.',
        example: 'Finding whether a heap contains 42 costs a full scan; finding its minimum costs one array read.'
      },
      {
        term: 'Sift up and sift down',
        plain: 'The two repairs. A new element walks up until its parent outranks it; a displaced root walks down while a child outranks it.',
        formal: 'siftUp on insert, siftDown on extract',
        detail: 'Every heap operation is one of these two walks and nothing else. An insert appends ' +
          'to the end and sifts up, comparing against one parent per level. An extract moves the last ' +
          'element to the root and sifts down, comparing against both children per level to find the ' +
          'better one. That asymmetry — one comparison per level going up, d going down — is exactly ' +
          'what makes the arity of the next section a real trade rather than a detail.',
        example: 'A sift-up does one comparison per level; a sift-down in a binary heap does two.'
      },
      {
        term: 'Why the build is linear',
        plain: 'Heapifying an array is O(n), not O(n log n), because most nodes are leaves and sink nowhere.',
        formal: 'Σ h·⌈n/2^(h+1)⌉ < n',
        detail: 'The naive reading is that n elements each sift down log n levels, which would be ' +
          'O(n log n). The correction is that almost none of them sift that far: half the nodes are ' +
          'leaves with height 0 and do no work at all, a quarter are at height 1 and can sink one ' +
          'level, and so on. Summing h·n/2^(h+1) over all heights gives a series that converges to n. ' +
          'The measured swap count backs it: 74 217 swaps to heapify 100 000 random elements, against ' +
          'a tabulated bound of 100 058.',
        example: 'Building a 100 000-element heap moves 74 217 elements — under one swap per element.'
      },
      {
        term: 'Build against repeated insertion',
        plain: 'The famous gap is a worst-case statement. On random input it is 21%; on descending input it is 7×.',
        formal: 'build O(n) against insert O(n log n) worst case',
        detail: 'Both methods produce a valid heap and the textbook contrast suggests one is ' +
          'dramatically better. Measured at n = 100 000, the truth depends entirely on the input: ' +
          'ascending input costs both methods exactly one comparison per element (nothing sifts at ' +
          'all), random input costs 1.88 against 2.28 comparisons per element, and descending input — ' +
          'where every insertion walks the whole spine — costs 2.00 against 14.69. The gap is real ' +
          'and it is a property of the input, which is worth knowing before quoting the asymptotics ' +
          'at a code review.',
        example: 'At n = 100 000: descending input costs 14.69 comparisons per element to push and 2.00 to build.'
      },
      {
        term: 'peek, pop and the last element',
        plain: 'Extract moves the last element to the root and sifts it down. The last element is the only one that can be removed cheaply.',
        formal: 'pop = read root, move tail to root, siftDown(0)',
        detail: 'A heap can only shrink at the end without breaking the shape, so an extract cannot ' +
          'simply delete the root — the hole has to be filled by the one element whose removal is ' +
          'free. That element is almost certainly large, so it usually sinks all the way back down, ' +
          'which is why an extract costs a full log n while an insert usually stops early. The same ' +
          'reasoning explains why deleting an arbitrary element needs its position first, and why ' +
          'the standard trick is to decrease its key to −∞ and pop.',
        example: 'An insert sifts up 1.6 levels on average; an extract sifts down almost the full height.'
      },
      {
        term: '0-based against 1-based',
        plain: 'With the root at index 1 the arithmetic is 2i and 2i + 1, which is a shift rather than a shift and an add.',
        formal: '1-based: children 2i, 2i+1 · 0-based: 2i+1, 2i+2',
        detail: 'The 1-based layout wastes slot zero and buys simpler index arithmetic: the children ' +
          'of i are 2i and 2i + 1, and the parent is i >> 1. The 0-based layout uses every slot and ' +
          'pays an extra add per index. In a language with 0-based arrays the second is idiomatic and ' +
          'the difference is immaterial — but the textbooks use 1-based, so translating pseudocode ' +
          'is where off-by-one bugs come from. This platform uses 0-based, and the parent formula ' +
          '⌊(i − 1)/d⌋ is the one to check first when a heap misbehaves.',
        example: 'CLRS uses 1-based indexing, so its PARENT(i) = ⌊i/2⌋ is wrong in a 0-based array.'
      },
      {
        term: 'What a heap costs to hold',
        plain: 'One array slot per element, and nothing else — which is the real reason it wins.',
        formal: 'no node header, no pointers, no fragmentation',
        detail: 'Comparison counts systematically understate the implicit heap. A pointer-based ' +
          'priority queue does fewer comparisons on most mixes — a pairing heap push is one link — ' +
          'and still loses in practice, because every one of those links is an allocation and every ' +
          'traversal is a dependent load. The array heap has one allocation for the whole structure, ' +
          'perfect locality on the sift path, and nothing for the allocator to fragment. That is the ' +
          'gap between the operation count and the clock, and it is the theme M05.5 measures directly.',
        example: 'A 100 000-element pairing heap holds 100 000 objects; the equivalent binary heap holds one array.'
      }
    ],

    'd-ary-heaps': [
      {
        term: 'Arity as a parameter',
        plain: 'Nothing requires two children. With d of them the tree is log_d n deep instead of log₂ n.',
        formal: 'children of i are d·i + 1 … d·i + d',
        detail: 'The index arithmetic generalises without any change to the algorithm: the parent of ' +
          'i is ⌊(i − 1)/d⌋ and the children are contiguous. Raising d makes the tree shallower, ' +
          'which shortens every sift-up, and widens each node, which lengthens every sift-down. So d ' +
          'is a genuine dial rather than a detail, and the right setting depends on which of the two ' +
          'walks your workload does more of — which is exactly what the demo sweeps.',
        example: 'A million elements are 20 levels deep at d = 2 and 10 at d = 4.'
      },
      {
        term: 'The two curves',
        plain: 'Comparisons form a shallow U with its minimum near d = 3; swaps fall monotonically as d rises.',
        formal: 'sift-up: log_d n comparisons; sift-down: d·log_d n',
        detail: 'The sift-down cost is d·log_d n = d·ln n / ln d, which is minimised at d = 3 and ' +
          'rises slowly after — and the sift-up cost is log_d n, which falls monotonically. Since a ' +
          'mix contains both, the total comparison count is a shallow U: measured over 50 000 ' +
          'balanced operations it runs 366 125 at d = 2, 338 230 at d = 3, 355 873 at d = 4 and ' +
          '602 679 at d = 16. Data movement is a different story entirely — swaps fall from 225 089 ' +
          'to 60 050 over the same range, because a shallower tree means shorter sift paths.',
        example: 'Over 50 000 balanced operations: comparisons bottom out at d = 3, swaps keep falling to d = 16.'
      },
      {
        term: 'The cache-line argument',
        plain: 'The d children of a node are contiguous, so a 4-ary or 8-ary node fetches all of them in one line.',
        formal: '64-byte line ÷ 4-byte key = 16 children',
        detail: 'This is the argument the comparison count cannot see, and the one that decides real ' +
          'implementations. A binary heap fetches two children — eight bytes of a sixty-four-byte ' +
          'line — and throws the rest away, and does that at every level. A 4-ary heap uses sixteen ' +
          'bytes of the line and needs half as many levels, so it touches roughly a quarter as many ' +
          'lines per operation. Since a miss is worth about eighty comparisons, the extra ' +
          'comparisons d = 4 does are bought back many times over.',
        example: 'A 4-ary heap of a million elements walks 10 levels rather than 20, and uses four keys per line rather than two.'
      },
      {
        term: 'Alignment matters',
        plain: 'The children only share a line if the array is aligned so that they do not straddle one.',
        formal: 'pad the root so each child group starts on a line boundary',
        detail: 'The cache argument assumes the d children fall inside one line, and with the ' +
          'ordinary layout they usually straddle two — the group starting at d·i + 1 is not aligned ' +
          'to anything in particular. Real implementations waste a few slots at the front so that ' +
          'every child group begins on a line boundary, which turns "usually two lines" into "always ' +
          'one". It is a two-line change that recovers most of the benefit the arity was chosen for, ' +
          'and it is the sort of detail that never appears in the pseudocode.',
        example: 'Offsetting the array so child groups start at a multiple of d turns two line fetches per level into one.'
      },
      {
        term: 'Decrease-key is a sift-up',
        plain: 'Lowering a key only ever walks upward, so it gets strictly cheaper as d rises.',
        formal: 'decreaseKey = write the key, then siftUp',
        detail: 'This is why d-ary heaps are the standard answer for Dijkstra and its relatives. A ' +
          'decrease-key never sifts down, so it pays only the shallower tree and none of the wider ' +
          'node. Measured on a decrease-key-heavy mix, the comparison count falls from 385 548 at ' +
          'd = 2 to 366 740 at d = 4 — the U-curve minimum moves right when the workload leans on ' +
          'the upward walk. On a graph algorithm dominated by edge relaxations, d = 4 or d = 8 is ' +
          'the usual choice for exactly this reason.',
        example: 'On a decrease-key-heavy mix the comparison minimum moves from d = 3 to d = 4.'
      },
      {
        term: 'Choosing d from the workload',
        plain: 'Push-heavy and decrease-key-heavy favour larger d; pop-heavy favours smaller.',
        formal: 'the optimum shifts with the ratio of sift-ups to sift-downs',
        detail: 'The rule is mechanical once the two costs are separated. Count how many of your ' +
          'operations sift up (pushes and decrease-keys) against how many sift down (pops), and the ' +
          'optimum moves toward larger d as the first group grows. A Dijkstra run is almost all ' +
          'relaxations, so it wants a wide heap; a scheduler that pops far more than it pushes wants ' +
          'a narrow one. Since the curve is shallow near its minimum, getting within a factor of two ' +
          'of the right d is enough — which is why 4 is a defensible default for everything.',
        example: 'Dijkstra on a dense graph does one pop per node and one sift-up per improved edge, which is why d = 4 wins.'
      },
      {
        term: 'What stays the same',
        plain: 'The build is still linear, the height bound still holds, and the code is the binary code with one constant changed.',
        formal: 'Σ h·n/d^(h+1) still converges',
        detail: 'None of the analysis breaks. The sum-of-heights argument still converges — to ' +
          'n·d/(d − 1)² rather than n, which is smaller for larger d — so the build stays linear and ' +
          'gets cheaper. The height bound is log_d n, the invariant is unchanged, and an ' +
          'implementation that parameterises the arity is the binary one with `2` replaced by `d` in ' +
          'two places. That is unusually clean for a tuning knob, and it is why the arity is worth ' +
          'exposing rather than hard-coding.',
        example: 'Tabulated build work at n = 100 000: 100 058 units at d = 2 and 11 130 at d = 4.'
      },
      {
        term: 'Where the model runs out',
        plain: 'Counting comparisons and swaps cannot see prefetching, branch prediction or SIMD — and those decide the winner.',
        formal: 'measure time as well, and say which is which',
        detail: 'The demo reports comparisons and swaps because those are exact and portable, and ' +
          'they are not what makes a 4-ary heap faster than a binary one on real hardware. Finding ' +
          'the best of four contiguous children is a branchless minimum a compiler can vectorise; ' +
          'finding the best of two is a branch the predictor gets wrong half the time. Neither effect ' +
          'appears in a counter. The honest presentation is to give the counts, give a measured time, ' +
          'and say plainly which one the theory was about.',
        example: 'The comparison count says d = 3; every production implementation uses 4 or 8.'
      }
    ],

    heapsort: [
      {
        term: 'Selection sort with a heap',
        plain: 'Build a max-heap in place, then swap the root to the end and sift down over a shrinking heap.',
        formal: 'n − 1 rounds of swap-and-sift',
        detail: 'Heapsort is what selection sort becomes when the "find the largest" step stops being ' +
          'a scan. The array partitions itself as it goes: a heap on the left, a sorted suffix on the ' +
          'right, and the boundary moves one slot per round. Because the largest element goes to the ' +
          'end, a max-heap produces an ascending array with no reversal pass. The whole algorithm is ' +
          'the build plus n − 1 sift-downs, and both halves are already written once the heap exists.',
        example: 'After k rounds the last k slots hold the k largest elements in their final positions.'
      },
      {
        term: 'In place, and guaranteed',
        plain: 'O(n log n) worst case with O(1) extra space — the only common sort with both.',
        formal: 'no auxiliary array, no recursion',
        detail: 'Merge sort gives the guarantee and needs O(n) scratch. Quicksort needs no scratch ' +
          'and gives O(n²) in the worst case. Heapsort is the one that gives both, and it does it ' +
          'with no recursion at all, so there is no stack to overflow either. That combination is ' +
          'why it survives as the fallback branch of introsort: when quicksort\'s recursion goes ' +
          'deeper than 2 log n, the implementation switches to heapsort precisely because the switch ' +
          'converts a possible quadratic into a certainty.',
        example: 'std::sort is quicksort until the depth limit, then heapsort, then insertion sort at the bottom.'
      },
      {
        term: 'Why it is only the fallback',
        plain: 'Every sift-down jumps between positions that are powers of two apart, so it misses cache on nearly every step.',
        formal: 'access pattern is scattered by construction',
        detail: 'Quicksort scans linearly and the prefetcher sees it coming; merge sort streams two ' +
          'runs. Heapsort walks from index i to 2i + 1, which at any real size is a different cache ' +
          'line every time — and it does that log n times per extracted element. The comparison count ' +
          'does not show it: measured at n = 10 000 heapsort does 235 305 comparisons, about 1.77 × ' +
          'n log₂ n, which is competitive. The clock does show it, and the gap widens with n as the ' +
          'array leaves each cache level.',
        example: 'At n = 10 000 heapsort does 1.77 × n·log₂ n comparisons and still loses to quicksort on time.'
      },
      {
        term: 'Not stable',
        plain: 'The sift moves equal keys past each other, and there is no cheap way to stop it.',
        formal: 'equal keys can be reordered by a swap',
        detail: 'Stability means equal keys keep their input order, and heapsort breaks it in the ' +
          'most basic way: the extract step swaps the root with the last element, which can move an ' +
          'equal key across an arbitrary distance. Nothing local can repair that, and the standard ' +
          'workaround — extending each key with its original index — costs the memory that heapsort ' +
          'was chosen for. So if the sort has to be stable, this is not the algorithm, and merge ' +
          'sort or Timsort is where to look instead.',
        example: 'Sorting records by one field with heapsort silently reorders records that tie on it.'
      },
      {
        term: 'Bottom-up heapsort',
        plain: 'Sift the hole all the way down first, then walk back up to place the element. It halves the comparisons.',
        formal: '≈ n log n rather than 2n log n comparisons',
        detail: 'The classical sift-down does two comparisons per level: one to pick the better child ' +
          'and one to decide whether to stop. The bottom-up variant observes that the element being ' +
          'sifted is almost always going nearly all the way down — it came from the bottom of the ' +
          'heap — so it descends to a leaf picking the better child at each step, then walks back up ' +
          'to find where the element belongs. The second walk is short in expectation, and the total ' +
          'drops from about 2n log₂ n comparisons to about n log₂ n.',
        example: 'The saving comes from not asking "should I stop here?" at every level of a descent that rarely stops early.'
      },
      {
        term: 'Top-k with a bounded heap',
        plain: 'Keep a heap of the k best seen so far. Peak memory is k, whatever the stream length is.',
        formal: 'O(n log k) time, O(k) space',
        detail: 'This is the pattern that earns a heap its place in ordinary code, more often than ' +
          'heapsort does. Hold a max-heap of size k; for each new element, compare it against the ' +
          'root and discard it if it is worse. The comparison count is dominated by that single gate ' +
          '— one per element — and only the survivors pay for a pop and a push. Measured over a ' +
          'million-element stream with k = 20: 999 980 gate comparisons, 1 997 heap comparisons, and ' +
          'just 246 elements ever admitted, against about 19.9 million comparisons and a million ' +
          'slots to sort the stream.',
        example: 'Top-20 of a million elements: 1 001 977 comparisons and 20 slots, against 19.9 million and 1 000 000.'
      },
      {
        term: 'Streaming, not batching',
        plain: 'The bounded heap never needs the whole input in memory, so the stream can be longer than RAM.',
        formal: 'one pass, O(k) resident',
        detail: 'The memory bound is what makes this pattern structural rather than a micro-' +
          'optimisation: the input is consumed one element at a time and discarded, so a "top 100 ' +
          'slowest queries today" over a hundred gigabytes of logs runs in a hundred slots. It is the ' +
          'same streaming argument as M01.7, and it composes — several bounded heaps can run over one ' +
          'pass, and a distributed version merges the per-shard top-k into a global one, because ' +
          'the top k of the union is contained in the union of the top k.',
        example: 'Merging per-shard top-100 lists gives the true global top-100, which is why this parallelises.'
      },
      {
        term: 'Selection against sorting',
        plain: 'If you only need the k best, sorting is doing n log n work to answer a question worth n log k.',
        formal: 'quickselect gives O(n) expected for the unordered case',
        detail: 'Sorting to take a prefix is the most common accidental over-computation there is. ' +
          'The bounded heap does it in O(n log k), and if the k results do not need to be ordered ' +
          'among themselves, quickselect does it in O(n) expected time by partitioning around the ' +
          'k-th element and stopping. The heap keeps its advantage when the input is a stream rather ' +
          'than an array, when k is small and n is enormous, or when the answer has to be available ' +
          'at every moment rather than at the end.',
        example: 'ORDER BY x LIMIT 10 over a million rows is a top-10 heap in any competent query planner, not a sort.'
      }
    ],

    'mergeable-heaps': [
      {
        term: 'Meld as the primitive',
        plain: 'Make merging the one operation, and insert and pop fall out of it in a line each.',
        formal: 'insert = meld(h, singleton) · pop = meld(left, right)',
        detail: 'An array heap treats insert and extract as primitives and cannot merge at all. The ' +
          'mergeable families invert that: meld is the only structural operation, insert melds a ' +
          'one-node heap, and pop drops the root and melds its two children. There is no other ' +
          'structural code in a leftist heap — no sift, no rebalance, no consolidation — which is ' +
          'why it is the mergeable heap you can still write correctly from memory. Structures with ' +
          'one primitive are the ones that survive contact with a deadline.',
        example: 'A complete leftist heap is about forty lines, and thirty of them are meld.'
      },
      {
        term: 'Null-path length',
        plain: 'The distance to the nearest missing child. A leftist heap keeps the larger one on the left.',
        formal: 'npl(node) = 1 + min(npl(left), npl(right))',
        detail: 'The field measures how far you must walk to fall out of the tree, taking the shortest ' +
          'route. Insisting that npl(left) ≥ npl(right) forces the short paths to the right, which ' +
          'means the right spine is the shortest root-to-null path in the tree and therefore has ' +
          'length at most log₂(n + 1). Since meld only ever walks right spines, that bound is the ' +
          'operation cost. The tree itself is allowed to be wildly lopsided — a leftist heap of ' +
          '100 000 elements measured height 33 with a right spine of 13, and both numbers are fine.',
        example: 'At n = 100 000 the right spine measured 13 against a bound of 16, while the tree was 33 deep.'
      },
      {
        term: 'Skew heaps',
        plain: 'Drop the field and the rule; swap the children after every meld. The bound survives, amortised.',
        formal: 'no metadata, O(log n) amortised',
        detail: 'A skew heap is the self-adjusting version of a leftist heap, standing in the same ' +
          'relation to it as a splay tree does to an AVL tree: no stored field, no invariant to ' +
          'maintain, and a bound that holds on average over a sequence rather than on every ' +
          'operation. The unconditional swap is what keeps the right spine from growing, and it is ' +
          'not free — measured over 100 000 pushes a skew heap performed 1 044 536 child swaps ' +
          'against a leftist heap\'s 74 364, and ended with a longer spine. What it buys is a node ' +
          'with nothing on it but a key and two pointers.',
        example: 'Over 100 000 pushes: 74 364 child swaps for leftist, 1 044 536 for skew.'
      },
      {
        term: 'Binomial trees',
        plain: 'A tree of order k holds exactly 2^k nodes and is two order-(k − 1) trees, one hung under the other.',
        formal: 'B_k = two B_(k−1) linked · |B_k| = 2^k',
        detail: 'The definition is recursive and the consequences are all arithmetic. A binomial tree ' +
          'of order k has exactly 2^k nodes, height k, and a root with exactly k children whose ' +
          'orders are k − 1, k − 2, …, 0. The name comes from the level sizes, which are the binomial ' +
          'coefficients. Two trees of the same order link into one of the next order in constant time ' +
          'by comparing the roots — that single operation is everything the structure does.',
        example: 'A B₃ holds 8 nodes, is 3 deep, and its root has children of order 2, 1 and 0.'
      },
      {
        term: 'The forest is a binary number',
        plain: 'A heap of n elements holds one tree per set bit of n. Thirteen elements is 1101 — a B₃, a B₂ and a B₀.',
        formal: 'n = Σ 2^k over the tree orders present',
        detail: 'This is the reading that makes the whole family obvious rather than clever. Since ' +
          'each tree holds a power of two and no order repeats, the multiset of orders is the binary ' +
          'expansion of the size — and every operation is arithmetic on that number. Inserting is ' +
          'adding one; merging two heaps is adding two numbers; and a carry is literally two trees of ' +
          'the same order linking into one of the next. The demo prints the size in binary next to ' +
          'the forest for exactly this reason.',
        example: 'A heap of 100 000 elements is 11000011010100000 in binary, and holds 6 trees.'
      },
      {
        term: 'Merge is binary addition',
        plain: 'Walk the orders from the bottom, linking two trees of equal order into one of the next. The carry propagates.',
        formal: 'O(log n) orders, each carrying at most once',
        detail: 'Because there are only log n orders and each one produces at most one carry, the ' +
          'merge is O(log n) worst case — the same argument that makes adding two binary numbers ' +
          'linear in their length. Insertion is the special case of adding 1, and its amortised O(1) ' +
          'cost is the binary-counter argument from M01.3: a long carry chain is rare in exactly the ' +
          'proportion that makes the average constant. Extract-min is the interesting one: removing ' +
          'a root of order k releases k subtrees of every smaller order, which is one more heap to ' +
          'merge in.',
        example: 'Merging a heap of 3 (011) with a heap of 1 (001) carries twice and yields a single B₂.'
      },
      {
        term: 'What an array heap cannot do',
        plain: 'Melding two array heaps is O(n + m): concatenate and rebuild. There is no shortcut.',
        formal: 'no structure to reuse, so the build is the meld',
        detail: 'The implicit representation is what makes the array heap fast and it is exactly what ' +
          'makes merging impossible to do cheaply: two dense arrays cannot be joined without moving ' +
          'one of them, and once moved the heap property has to be re-established from scratch. That ' +
          'is a linear operation where the mergeable families are logarithmic, and it is the whole ' +
          'reason those families exist. If your program never merges, the array heap is the right ' +
          'answer and this section is background; if it merges in a loop, the asymptotics are on the ' +
          'other side.',
        example: 'Folding 16 heaps of 1 000 elements: the array heap did 513 212 comparisons against the leftist heap\'s 222 679.'
      },
      {
        term: 'Choosing between them',
        plain: 'Leftist for a worst-case bound and a field, skew for no field, binomial when the forest reading helps.',
        formal: 'all three are O(log n) per operation',
        detail: 'They are close enough that the decision is usually about code rather than cost. A ' +
          'leftist heap gives a worst-case bound for one integer per node and about forty lines. A ' +
          'skew heap gives the same bound amortised for nothing per node and about thirty lines, at ' +
          'the price of far more pointer writing. A binomial heap is more code than either and earns ' +
          'it when the binary-counter structure is doing something for you — as it does in a ' +
          'Fibonacci heap, which is a binomial heap with the consolidation deferred.',
        example: 'The Fibonacci heap of the next section is a binomial heap that puts off the carrying until it must.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
