/**
 * Concepts for the buffer-and-allocator half of the linear-structures
 * milestone (M02.6-M02.9): batching, pools and arenas, text buffers and
 * cache-conscious layouts.
 *
 * Split from concepts-linear.js only for size: one file for the whole
 * milestone runs past the 1 000-line limit once every concept carries its
 * explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'batching-pipelines': [
      {
        term: 'Batch size',
        plain: 'How many items are processed per unit of overhead. The one dial in this section.',
        formal: 'batches = ⌈n / size⌉',
        readAs: 'The number of batches is n divided by the batch size, rounded up — the ceiling bars — ' +
          'because a final partial batch still has to run.',
        detail: 'Batch size decides how many times a fixed cost is paid, and that is usually the ' +
          'dominant term: 10 000 rows sent one at a time is 10 000 round trips, and in batches of ' +
          '500 it is 20. Because the number of batches falls as n/size, the benefit is steep at ' +
          'first and then flattens — going from 1 to 100 removes 99% of the overhead, and going from ' +
          '100 to 10 000 removes most of what little remains. That shape is why the right batch size ' +
          'is rarely the largest one: past the knee you are buying almost no throughput and paying ' +
          'for it in latency and memory.',
        example: '10 000 rows in batches of 500 is 20 round trips instead of 10 000.'
      },
      {
        term: 'Per-batch overhead',
        plain: 'The fixed cost paid once per batch: a round trip, a commit, a flush.',
        formal: 'total = n·per-item + batches·overhead',
        readAs: 'Total cost is the per-item work done n times, plus the fixed per-batch cost paid once per ' +
          'batch. Bigger batches shrink the second term and leave the first alone.',
        detail: 'Cost splits into a part that scales with items and a part that is charged per batch, ' +
          'and knowing which is which tells you immediately whether batching will help at all. If ' +
          'the fixed cost is a 1 ms commit and per-row work is a microsecond, the fixed cost ' +
          'dominates until the batch reaches a few thousand rows — so batching is the entire ' +
          'optimisation. If the fixed cost is negligible, batching buys nothing and only adds ' +
          'latency. Measure the two terms separately before tuning: run one batch of 1 and one of ' +
          '1 000 and the difference gives you both numbers.',
        example: 'A 1 ms commit dominates until the batch reaches a few thousand rows.'
      },
      {
        term: 'Time to first result',
        plain: 'How long before anything comes out. It rises with batch size.',
        formal: 'first output after batch × stages items',
        detail: 'A batch produces nothing until it is full, so the first output waits for a whole ' +
          'batch to accumulate and then to traverse every stage of the pipeline. Increasing the ' +
          'batch improves throughput and delays that first result in direct proportion, which is the ' +
          'trade at the heart of this section. Which side matters is a property of the consumer, not ' +
          'of the pipeline: a user interface is judged on when the first row appears, while a ' +
          'nightly job is judged on when the last one does and should batch as large as memory ' +
          'allows.',
        example: 'A UI wants the first row; a nightly job does not care.'
      },
      {
        term: 'Backpressure',
        plain: 'A bounded buffer forces the producer to slow to the consumer\'s rate rather than accumulating.',
        formal: 'producer blocks when the buffer is full',
        detail: 'When a consumer is slower than its producer, the difference has to go somewhere. A ' +
          'bounded buffer puts it back on the producer: the buffer fills, the producer blocks, and ' +
          'the whole pipeline settles at the rate of its slowest stage. An unbounded queue instead ' +
          'accumulates the difference in memory, which looks like it is working right up to the ' +
          'out-of-memory kill, and degrades latency the whole way there because every item now waits ' +
          'behind a growing backlog. Bounding a queue is what converts an invisible memory leak into ' +
          'a visible, survivable slowdown.',
        example: 'An unbounded queue converts a slowdown into an out-of-memory kill.'
      },
      {
        term: 'Double buffering',
        plain: 'Fill one buffer while the other is processed, so neither side waits.',
        formal: 'two buffers, swapped per batch',
        detail: 'With a single buffer the producer and consumer take turns, so each is idle for ' +
          'exactly as long as the other is working and the total is the sum of the two times. Two ' +
          'buffers, swapped when both sides are done, let them overlap: the total becomes the ' +
          'maximum rather than the sum, which nearly doubles throughput when the stages are ' +
          'balanced. The cost is twice the buffer memory and a synchronisation point at each swap. ' +
          'It is the same idea as pipeline depth applied to storage, and it is why graphics and I/O ' +
          'subsystems have used it for decades.',
        example: 'Standard in graphics and in I/O pipelines.'
      },
      {
        term: 'Amortising a fixed cost',
        plain: 'A per-batch cost divided by the batch size. Doubling the batch halves it, and nothing else changes.',
        formal: 'per item = perItem + fixed/batch',
        readAs: 'Divide the whole cost by n and the fixed cost per batch is spread across the items in it, so ' +
          'the per-item figure falls as the batch grows — but only towards perItem, never below it.',
        detail: 'The per-item cost of a batched pipeline is the intrinsic per-item work plus the ' +
          'fixed cost divided by the batch size, and only the second term moves when you tune. A ' +
          '1 ms commit is 1 ms per row at batch 1, 1 µs per row at batch 1 000 and 0.1 µs per row at ' +
          'batch 10 000 — which also shows where tuning stops paying, because by then the fixed term ' +
          'has fallen below the intrinsic one and further increases change nothing measurable. ' +
          'Compute the two terms and you can predict the whole curve instead of searching it.',
        example: 'A 1 ms commit is 1 ms per row at batch 1 and 0.1 µs per row at batch 10 000.'
      },
      {
        term: 'Latency budget',
        plain: 'The largest batch a deadline allows. It is the requirement that picks the batch size, not throughput.',
        formal: 'batch ≤ budget / (perRow × stages)',
        readAs: 'The largest batch you can afford is your latency budget divided by the work one row costs ' +
          'across every stage. Anything larger overshoots the deadline.',
        detail: 'Throughput improves monotonically with batch size, so it cannot choose a batch size ' +
          'on its own — it always says "larger". The binding constraint is the deadline: a batch ' +
          'must be assembled and pushed through every stage within the latency budget, which caps ' +
          'the size at budget divided by the per-row cost times the number of stages. A 10 ms p99 ' +
          'budget at 0.4 µs per row per stage allows about 8 000 rows. Deriving the cap this way ' +
          'turns batch size from a tuning parameter into a consequence of a stated requirement, ' +
          'which is also what makes it defensible in review.',
        example: 'A 10 ms p99 budget at 0.4 µs per row per stage allows a batch of about 8 000.'
      },
      {
        term: 'Pipeline depth',
        plain: 'Stages let batches overlap, so throughput follows the slowest stage rather than the sum of them.',
        formal: 'throughput = 1 / max(stage time)',
        readAs: 'A pipeline emits one result per slowest-stage time, so its rate is one divided by that ' +
          'stage. Speeding up any other stage changes nothing at all.',
        detail: 'Once a pipeline is full, every stage is working on a different batch at the same ' +
          'time, so a new result emerges every max(stage time) rather than every sum of stage times: ' +
          'three stages of 0.4 µs deliver a row every 0.4 µs, not every 1.2 µs. Two consequences ' +
          'follow. Throughput is set entirely by the slowest stage, so optimising any other stage ' +
          'changes nothing at all — the only useful work is on the bottleneck. And latency is ' +
          'unchanged or slightly worse, since an individual row still traverses every stage; the ' +
          'pipeline buys rate, not response time.',
        example: 'Three stages of 0.4 µs run at 0.4 µs per row once the pipeline is full, not 1.2 µs.'
      }
    ],

    'pools-and-arenas': [
      {
        term: 'Bump allocation',
        plain: 'Allocation is one pointer addition; there is no individual free, only a reset.',
        formal: 'top ← align(top) + size',
        readAs: 'Allocating from a bump allocator is: round the current top up to the alignment the type ' +
          'needs, hand that address out, and move top past it. No search and no free list — which is ' +
          'why it is a handful of instructions.',
        detail: 'A bump allocator holds one pointer into a block and serves each request by aligning ' +
          'it and adding the size — a couple of instructions, no search, no free list, no metadata ' +
          'per object. Nothing this cheap can support individual freeing, because the allocator ' +
          'keeps no record of what it handed out, so the entire block is released at once instead. ' +
          'That fits any workload with a natural lifetime boundary: a per-request arena in a server, ' +
          'a per-frame arena in a game, a per-compilation-unit arena in a compiler. Within the ' +
          'lifetime you allocate freely and never think about ownership.',
        example: 'Per-request arenas in servers and per-frame arenas in games.'
      },
      {
        term: 'Free list',
        plain: 'A linked list of free slots, threaded through the free memory itself, so it costs nothing extra.',
        formal: 'head → next → next → −1',
        readAs: 'A free list is a chain: the head points at a free slot, that slot holds the index of the ' +
          'next free one, and −1 marks the end. The arrows are "points at".',
        detail: 'For fixed-size objects, the free slots can store the list that tracks them: each ' +
          'free slot holds the index of the next free slot, so the bookkeeping lives inside memory ' +
          'that is by definition not in use and costs zero extra bytes. Allocation pops the head and ' +
          'freeing pushes onto it, both O(1) with no search and no fragmentation, since every free ' +
          'slot is interchangeable. This is the core of a slab or object pool, and it is why pooling ' +
          'same-sized objects is dramatically simpler than general allocation — the hard part of ' +
          'malloc is variable sizes.',
        example: 'O(1) allocate and free for fixed-size objects.'
      },
      {
        term: 'External fragmentation',
        plain: 'Enough free bytes in total, none of them contiguous enough to serve the request.',
        formal: '1 − largest free run / total free',
        readAs: 'Fragmentation is what fraction of your free space you cannot use in one piece: take the ' +
          'biggest contiguous run, divide by the total free, and subtract from 1. Zero means it is all ' +
          'in one block.',
        detail: 'A general-purpose allocator hands back blocks of many sizes in an order it does not ' +
          'control, and over time the free space breaks into pieces separated by live ones. The ' +
          'total can be large and useless: a heap that is 40% free can fail a 1 KB request because ' +
          'no single run is that long. This is why an allocation failure is not the same as being ' +
          'out of memory, and why long-lived processes can degrade for reasons that never show up in ' +
          'a total-bytes metric. The measure that matters is the largest contiguous run relative to ' +
          'the free total.',
        example: 'A heap 40% free that cannot allocate 1 KB.'
      },
      {
        term: 'Coalescing',
        plain: 'Merging adjacent free blocks on free, which is what keeps fragmentation from growing.',
        formal: 'merge with neighbours if free',
        detail: 'Without merging, every free leaves a hole exactly the size of the object that was ' +
          'there, and a workload that frees two neighbours ends up with two small holes instead of ' +
          'one usable large one — repeat that for a few million operations and the heap is shredded. ' +
          'Coalescing checks whether the neighbouring blocks are free and merges them on the spot, ' +
          'which is what keeps the largest free run from collapsing. It needs a way to find the ' +
          'neighbours, which is what boundary tags are for, and it makes free slightly more ' +
          'expensive — an unusually clear case of paying a little on every operation to avoid an ' +
          'unbounded worst case.',
        example: 'Without it, a churn workload shreds the heap.'
      },
      {
        term: 'Arena reset',
        plain: 'Freeing everything at once by moving one pointer. The cheapest deallocation there is.',
        formal: 'top ← 0',
        detail: 'Resetting an arena sets the bump pointer back to the start, and that single ' +
          'assignment frees every object in it. There is no per-object work, no destructor walk, no ' +
          'free-list maintenance and no fragmentation, because the block returns to exactly the ' +
          'state it started in. The cost is that it is all or nothing, so the arena has to match a ' +
          'real lifetime boundary in the program — end of request, end of frame — and anything that ' +
          'must outlive it has to be copied out first. Where such a boundary exists, this is both ' +
          'the fastest deallocation available and the one with the fewest ways to get it wrong.',
        example: 'End of request: drop all of it, no per-object work.'
      },
      {
        term: 'Internal fragmentation',
        plain: 'The bytes wasted inside a block because the request was rounded up to a size class.',
        formal: 'waste = class size − request size',
        detail: 'Rounding each request up to the next size class wastes the difference inside the ' +
          'block, where nothing else can use it — an 88-byte object in a 96-byte class wastes 8 ' +
          'bytes, or 9%. That sounds like a pure loss and is in fact the good trade: internal waste ' +
          'is bounded, predictable and computable in advance from the class spacing, whereas ' +
          'external fragmentation is unbounded and depends on the order of a workload you do not ' +
          'control. Choosing the classes sets the bound: closer spacing wastes less and needs more ' +
          'free lists.',
        example: 'An 88-byte object in a 96-byte class wastes 8 bytes — 9%, bounded and known in advance.'
      },
      {
        term: 'Size class',
        plain: 'One free list per size. Every free block fits every request of its class, so external fragmentation cannot happen.',
        formal: 'classes at 16, 32, 48, 64, … bytes',
        detail: 'Segregating free blocks by size makes allocation a table index followed by a pop, ' +
          'with no search for a fit, and it eliminates external fragmentation by construction: ' +
          'within a class every block is the same size, so any free block satisfies any request. ' +
          'Deciding what to do when a class is empty — carve a fresh page for it, or split from a ' +
          'larger class — is the main design question left. This is the structure behind essentially ' +
          'every modern allocator, and the trade it makes is the one above: unbounded external waste ' +
          'exchanged for a bounded internal one.',
        example: 'It trades the unbounded external waste of first-fit for a bounded internal one.'
      },
      {
        term: 'Lifetime',
        plain: 'The fact a general-purpose allocator does not have and cannot infer. An arena works because you supply it.',
        formal: 'allocate freely, free everything at once',
        detail: 'malloc cannot know how long an object will live, so it must handle any interleaving ' +
          'of allocations and frees and pay the fragmentation that follows. An arena is not a ' +
          'cleverer algorithm; it is the same problem with one extra input, supplied by you: these ' +
          'objects all die together. With that fact, allocation becomes a pointer bump and ' +
          'deallocation becomes a single store, and fragmentation is impossible because nothing is ' +
          'ever freed individually. The measured version of this in the section is stark — a ' +
          'per-request arena serves 200 requests with a 1 280-byte peak, where a first-fit heap ' +
          'fragments and fails at request 122.',
        example: 'A per-request arena serves 200 requests with a 1 280-byte peak where first-fit fragments and fails at request 122.'
      }
    ],

    'text-buffers': [
      {
        term: 'Gap buffer',
        plain: 'Free space held at the cursor, so typing there costs nothing and moving the cursor costs the distance.',
        formal: 'text = prefix + gap + suffix',
        detail: 'A gap buffer is one contiguous array with a run of unused space parked at the ' +
          'cursor. Inserting is a write into the gap, deleting widens it, and both are constant ' +
          'time, so sustained typing in one place is as fast as anything can be. Moving the cursor ' +
          'is what costs: the gap must travel with it, which copies every character it passes. That ' +
          'makes the structure\'s cost proportional to cursor travel rather than to the number of ' +
          'edits, which is an excellent bet for a human typing and a poor one for a program applying ' +
          'scattered edits. The whole document stays contiguous, so search and rendering are ' +
          'straightforward.',
        example: 'Emacs; excellent for sequential typing.'
      },
      {
        term: 'Piece table',
        plain: 'An immutable original, an append-only added buffer and a list of pieces. Text is never moved.',
        formal: 'document = concat(pieces)',
        detail: 'A piece table never edits text at all. The loaded file is immutable, new text is ' +
          'appended to a second buffer that only ever grows, and the document is a list of pieces ' +
          'naming a buffer, an offset and a length. An edit splits a piece and inserts one — a few ' +
          'list operations regardless of document size or where the edit lands, so it has no bad ' +
          'position the way a gap buffer does. The costs are indirection on read, since the ' +
          'document is scattered across two buffers, and a piece list that grows with the number of ' +
          'edits and eventually wants compaction.',
        example: 'VS Code; excellent after a large paste.'
      },
      {
        term: 'Rope',
        plain: 'A balanced tree of string leaves, so split and concatenate are O(log n) and never copy the document.',
        formal: 'internal nodes carry subtree lengths',
        detail: 'A rope stores the text in the leaves of a balanced tree, with each internal node ' +
          'carrying the total length of its subtree. That single piece of bookkeeping turns position ' +
          'lookup into a descent, and makes split and concatenate O(log n) operations that rearrange ' +
          'pointers instead of moving characters. Ropes therefore scale to files where any ' +
          'contiguous representation would be hopeless, and they make structural operations — ' +
          'joining two documents, extracting a range — cheap rather than linear. The price is ' +
          'tree overhead per leaf, worse locality than a flat array, and the need to keep the tree ' +
          'balanced.',
        example: 'Xi and several editors for very large files.'
      },
      {
        term: 'Undo for free',
        plain: 'A structure that never overwrites can represent undo as an older version of the piece list.',
        formal: 'keep the previous piece list',
        detail: 'When no operation destroys data, previous states remain reachable, so undo stops ' +
          'being a separate mechanism. A piece table keeps every character ever typed in the add ' +
          'buffer, so an old version of the document is just an old piece list — retaining it costs ' +
          'the size of that list rather than a copy of the text, and redo is symmetric. Compare the ' +
          'usual approach of recording inverse operations, which has to get every inverse exactly ' +
          'right and stay consistent with the buffer. This is the same trade persistent data ' +
          'structures make everywhere: never overwrite, and history becomes free.',
        example: 'Piece tables get undo almost by construction.'
      },
      {
        term: 'Line index',
        plain: 'Editors need line numbers constantly, so the structure has to maintain them incrementally.',
        formal: 'line starts, updated per edit',
        detail: 'Rendering, cursor movement, diagnostics and go-to-line all ask "where does line k ' +
          'start", and no text representation answers that without an index. Building one is a scan ' +
          'of the whole document, which is fine once at load and disastrous per keystroke — this is ' +
          'the most common accidental O(n) in an editor, and it is invisible until the file gets ' +
          'large. The fix is to maintain it incrementally: an edit changes line starts only after ' +
          'its position, so the update is a shift of the tail plus any newlines added or removed, ' +
          'and a rope can hold the line count per subtree instead.',
        example: 'Rebuilding the index per keystroke is the usual accidental O(n).'
      },
      {
        term: 'Cursor locality',
        plain: 'A gap buffer is fast where the cursor is and pays to move it. Its cost is measured in cursor travel, not in edits.',
        formal: 'move cost = distance moved',
        detail: 'The right cost model for a gap buffer is total cursor travel, not the number of ' +
          'edits, and that single reframing explains all of its behaviour. Three hundred edits at ' +
          'one position move about 100 000 characters, while the same three hundred scattered around ' +
          'a document move 9 529 894 — a factor of 95 for identical edits, decided entirely by where ' +
          'they landed. So the structure is superb for a human typing a paragraph and unsuitable for ' +
          'multi-cursor editing, a find-and-replace pass or a language server applying edits across ' +
          'a file. Measure the workload\'s locality before choosing it.',
        example: '300 edits at one place move 100 000 characters; the same 300 scattered move 9 529 894.'
      },
      {
        term: 'Immutable original',
        plain: 'A piece table never modifies the loaded file: it holds a list of spans into it and into an append-only add buffer.',
        formal: 'piece = (buffer, start, length)',
        detail: 'Because the original buffer is never written, opening a document costs nothing ' +
          'beyond reading it: the initial state is a single piece covering the whole file, with zero ' +
          'characters copied even for a 100 000-character document. The original can then be shared, ' +
          'memory-mapped or left on disk, and it stays byte-identical for as long as the session ' +
          'lasts, which is what makes cheap undo and reliable diffing possible. Everything the user ' +
          'types goes to the append-only add buffer, so the only structure that changes during ' +
          'editing is the piece list itself.',
        example: 'Opening a 100 000-character file costs one piece and zero characters copied.'
      },
      {
        term: 'Rebalancing',
        plain: 'A rope that only ever appends grows a spine and degenerates into a list. Rebuilding restores the logarithmic depth.',
        formal: 'rebuild when height > c·log₂(leaves)',
        readAs: 'Rebuild the tree once its height exceeds some fixed multiple of log base 2 of its leaf count ' +
          '— that is, once it is more than a constant factor deeper than a perfectly balanced tree of ' +
          'the same size would be.',
        detail: 'A rope\'s guarantees are all statements about its height, and nothing in the ' +
          'insertion rule preserves height on its own: appending repeatedly hangs each new leaf off ' +
          'the right edge, and the tree becomes a linked list with O(n) descents. The structure has ' +
          'to notice and repair it — rebuild when the height exceeds a constant times log₂ of the ' +
          'leaf count. The repair is not free, and pretending otherwise hides real work: 300 ' +
          'insertions at one position triggered 10 rebuilds that copied 15.1 million characters, ' +
          'which is why a rope is the wrong structure for a small file edited in one place.',
        example: '300 insertions at one position triggered 10 rebuilds and copied 15.1 million characters.'
      }
    ],

    'cache-layouts': [
      {
        term: 'Eytzinger layout',
        plain: 'The search tree stored breadth-first, so the first levels share a cache line.',
        formal: 'children of i are 2i and 2i+1',
        readAs: 'In an array-backed binary tree, node i keeps its children at positions 2i and 2i+1, so no ' +
          'pointers are stored at all — the arithmetic is the structure.',
        detail: 'Eytzinger order writes the implicit binary search tree level by level, so the root ' +
          'and the first few levels are adjacent in memory and arrive together in one or two cache ' +
          'lines. Every search visits those nodes, so after the first query they are permanently ' +
          'resident and the top of the tree becomes free. Navigation is index arithmetic — children ' +
          'of i are 2i and 2i + 1 — with no stored pointers, and the root is placed at index 1 with ' +
          'index 0 unused so that the doubling stays branch-free. The cost is that the layout is ' +
          'built for one static array; inserting into it means rebuilding.',
        example: 'Root at index 1; index 0 is left unused to keep the arithmetic branch-free.'
      },
      {
        term: 'Blocking',
        plain: 'Packing B keys per node so one cache line answers B comparisons.',
        formal: 'B = line size / key size',
        readAs: 'The branching factor B is how many keys fit in one cache line: the line size divided by the ' +
          'size of a key. It is the number of comparisons you get for a single memory fetch.',
        detail: 'If a fetch delivers 64 bytes regardless, the layout should put 64 bytes of useful ' +
          'keys there: sixteen 4-byte keys fill a line exactly, so one fetch answers a sixteen-way ' +
          'decision instead of a two-way one. The tree\'s fan-out rises from 2 to B and its height ' +
          'falls from log₂ n to log_B n, which is the same argument that makes B-trees the right ' +
          'structure on disk, applied one level up the hierarchy. The comparisons inside a block are ' +
          'nearly free because the data is already in L1 — this is the trade of arithmetic for ' +
          'memory traffic, made deliberately.',
        example: '16 four-byte keys fill exactly one 64-byte line.'
      },
      {
        term: 'Locality of reference',
        plain: 'Recently and nearby accessed data is cheap; anything else costs a line fetch.',
        formal: 'temporal and spatial locality',
        detail: 'Caches make one bet: that a program will reuse what it just touched (temporal ' +
          'locality) and touch what is next to it (spatial locality). Code that honours the bet ' +
          'runs at cache speed and code that violates it runs at memory speed, an order of magnitude ' +
          'apart, for identical instruction counts. A binary search over a sorted array violates ' +
          'both at first: its early probes are half an array apart, so each lands on a fresh line ' +
          'and uses one key out of sixteen. That is the specific weakness the layouts in this ' +
          'section attack, and it is why they win without changing the algorithm.',
        example: 'Binary search has neither in its early probes.'
      },
      {
        term: 'False sharing',
        plain: 'Two threads writing different variables in the same line contend for it anyway.',
        formal: 'same line, different addresses',
        detail: 'Cache coherence is maintained per line, not per byte, so two threads writing ' +
          'distinct variables that happen to share a line invalidate each other\'s copy on every ' +
          'write. There is no logical sharing and no race, and the performance behaves as though ' +
          'there were a contended lock — the line ping-pongs between cores and throughput can drop ' +
          'by an order of magnitude. The classic instance is an array of per-thread counters, and ' +
          'the fix is to pad each to its own line so the hardware stops seeing a conflict that the ' +
          'program never had.',
        example: 'Padding counters to a line each fixes it (M38).'
      },
      {
        term: 'Layout beats algorithm',
        plain: 'The same comparisons with a better arrangement move far less memory.',
        formal: 'same Θ, different constant',
        readAs: 'Two layouts with the identical growth rate can still differ by a large fixed multiplier, and ' +
          'that multiplier is the memory system rather than the algorithm.',
        detail: 'All three layouts in this section run the same logarithmic search and differ only in ' +
          'where the keys sit, so asymptotics cannot tell them apart — and on 256 KB of keys the ' +
          'blocked layout takes 2.8 times fewer misses than the sorted array. That gap is entirely ' +
          'in the constant that Θ discards. The general lesson is that once an algorithm is in the ' +
          'right complexity class, the remaining wins usually come from data layout rather than ' +
          'from a cleverer algorithm, and they are invisible to any analysis that counts operations ' +
          'instead of memory traffic.',
        example: 'A blocked layout misses 2.8× less than a sorted array on 256 KB of keys.'
      },
      {
        term: 'Residency, not distinct lines',
        plain: 'One query touches about log n lines whatever the layout; what differs is how much survives between queries.',
        formal: 'misses = lines touched − lines still resident',
        detail: 'Counting the distinct lines a single query touches finds almost no difference ' +
          'between layouts, because every binary search visits about log n nodes and each is likely ' +
          'to be on its own line. The difference appears across queries: what matters is how many of ' +
          'those lines are still in cache when the next query arrives. Eytzinger wins by keeping ' +
          'the top of the tree — the part every query visits — packed into few lines, so 512 lines ' +
          'hold 13 levels of the tree against a sorted array\'s 9. Measure misses against a bounded ' +
          'cache over a query stream, not lines per query.',
        example: 'Eytzinger keeps 13 levels of the tree in 512 lines; a sorted array keeps 9.'
      },
      {
        term: 'The crossover is the cache size',
        plain: 'A cache-conscious layout is worth nothing while the structure fits in cache, and everything once it does not.',
        formal: 'advantage appears at structure bytes > cache bytes',
        detail: 'While the whole structure is resident, every layout hits in cache and they are ' +
          'indistinguishable: at 4 KiB all three measure 0.128 misses per query. Once the structure ' +
          'outgrows the cache, the layout decides what stays and the gap opens abruptly — at ' +
          '256 KiB the same three measure 4.472, 3.452 and 1.478. So the benefit is not a property ' +
          'of the layout alone but of the ratio between the structure and the cache, which means ' +
          'benchmarking one of these on a small input will correctly report that it changes nothing. ' +
          'Size the experiment past the cache, or do not run it.',
        example: 'At 4 KiB the three layouts tie at 0.128 misses per query; at 256 KiB they are 4.472, 3.452 and 1.478.'
      },
      {
        term: 'Trading comparisons for misses',
        plain: 'A layout that does more arithmetic to touch fewer lines is winning, because the two are not priced alike.',
        formal: 'one DRAM miss ≈ 80 arithmetic operations',
        detail: 'Operation counting implicitly assumes all operations cost the same, and they differ ' +
          'by roughly two orders of magnitude: a DRAM miss is worth about eighty arithmetic ' +
          'instructions. At that exchange rate, spending extra comparisons to avoid a single miss is ' +
          'obviously profitable — the blocked layout does 39% more comparisons and takes a third of ' +
          'the misses, so it wins comfortably despite doing more work by the traditional measure. ' +
          'This is the reason a raw operation count can rank two implementations in exactly the ' +
          'wrong order, and why misses are the metric this section reports.',
        example: 'The blocked layout does 39% more comparisons and takes a third of the misses.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
