/** Reference entries for the linear-structures sections (M02). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;
  const CLRS = { title: 'Introduction to Algorithms, chapter 10', where: 'Cormen, Leiserson, Rivest, Stein' };
  const DREPPER = { title: 'What every programmer should know about memory', where: 'Drepper, 2007' };

  registry.register({
    'memory-layout': {
      summary: 'An array is a base address and a stride; alignment decides the stride, and the layout ' +
        'decides how much memory a one-field scan has to move.',
      intuition: 'The hardware moves memory in 64-byte lines, so the question is never "how many bytes ' +
        'do I need" but "how many lines must arrive". Interleaving fields you do not read into the same ' +
        'line is how a scan ends up three times slower with no change in the algorithm.',
      formulation: {
        equations: [
          { label: 'Addressing', expr: 'address(i) = base + i · stride',
            terms: [{ sym: 'stride', meaning: 'record size after alignment padding' }] },
          { label: 'Field placement', expr: 'offset(f) = align(offset(f−1) + size(f−1), size(f))',
            terms: [{ sym: 'align(a, w)', meaning: '⌈a / w⌉ · w — round up to a multiple of the width' }] },
          { label: 'Lines touched', expr: 'lines ≈ ⌈n · stride / 64⌉ for AoS, ⌈n · size(f) / 64⌉ for SoA',
            terms: [{ sym: '64', meaning: 'cache line size on essentially every current CPU' }] }
        ],
        derivation: [
          'A struct is padded to a multiple of its widest member so that arrays of it stay aligned.',
          'Ordering fields by decreasing width leaves at most (widest − 1) bytes of padding in total.'
        ]
      },
      invariants: [
        { name: 'Elements are equally spaced', why: 'Random access is one multiply and an add.', breaks: 'For variable-length records, which need an index or a scan.' },
        { name: 'A field never straddles its alignment', why: 'Unaligned access is slower or illegal depending on the architecture.', breaks: 'In packed structs, which trade speed for size deliberately.' },
        { name: 'One byte read costs one line', why: 'The line is the unit of transfer.', breaks: 'Never — which is why stride matters more than element size.' }
      ],
      complexity: [
        { operation: 'Index', average: 'Θ(1)', worst: 'Θ(1)', note: 'One multiply, one add' },
        { operation: 'Scan one field, AoS', average: 'Θ(n) with stride/4 bytes per useful byte', worst: 'same', note: 'Bandwidth-bound' },
        { operation: 'Scan one field, SoA', average: 'Θ(n), fully used lines', worst: 'same', note: 'Prefetcher-friendly' },
        { operation: 'Read a whole record', average: 'Θ(1) line in AoS', worst: 'Θ(fields) lines in SoA', note: 'The trade runs the other way here' }
      ],
      failureModes: [
        { symptom: 'A scan is 3× slower than the arithmetic suggests', cause: 'AoS layout pulling unused fields through cache.', fix: 'Split the hot fields into their own arrays.' },
        { symptom: 'A struct is bigger than the sum of its fields', cause: 'Alignment padding in declaration order.', fix: 'Order fields widest-first.' },
        { symptom: 'Random-access code slows down after adding a field', cause: 'The stride crossed a cache-line boundary.', fix: 'Check the stride against 64; consider splitting hot and cold fields.' },
        { symptom: 'Switching to struct-of-arrays made the transactional path slower', cause: 'Reading a whole record from SoA touches one cache line per field instead of one per record.', fix: 'Pick the layout per access pattern: 5 000 random whole-record reads cost 1.21 misses each as AoS and 3.70 as SoA.' }
      ],
      inTheWild: [
        { system: 'Columnar databases (Parquet, ClickHouse)', how: 'SoA taken to its conclusion, per column and per block' },
        { system: 'Game engines (ECS)', how: 'Components stored per type, precisely to get SoA scans' },
        { system: 'NumPy structured arrays', how: 'Exposes both layouts and the stride explicitly' }
      ],
      sources: [DREPPER, { title: 'Data-oriented design', where: 'Acton, CppCon 2014' }, { title: 'Cache-conscious structure layout', where: 'Chilimbi, Hill, Larus, PLDI 1999' }]
    },

    'dynamic-arrays': {
      summary: 'A dynamic array is a fixed array plus a growth policy; the policy sets total copying, ' +
        'wasted capacity and whether the allocator can reuse the freed blocks.',
      intuition: 'Two numbers describe the whole structure: the growth factor and the position you ' +
        'insert at. The first is amortised over the life of the array and the second is paid every ' +
        'call. Appending is the only cheap insertion, and everything else moves memory.',
      formulation: {
        equations: [
          { label: 'Growth', expr: 'capacity ← ⌈capacity · r⌉ when length = capacity',
            terms: [{ sym: 'r', meaning: 'growth factor, typically 1.5 or 2' }] },
          { label: 'Total copies', expr: 'copies ≈ n / (r − 1)',
            terms: [{ sym: 'r = 2', meaning: 'about n copies' }, { sym: 'r = 1.5', meaning: 'about 2n copies' }] },
          { label: 'Shift cost', expr: 'insertAt(p) moves n − p elements',
            terms: [{ sym: 'p = n', meaning: 'append: no movement' }, { sym: 'p = 0', meaning: 'front insert: the whole array' }] }
        ],
        derivation: [
          'The copies form a geometric series with ratio 1/r, which sums to a constant multiple of n.',
          'With r = 2 the sum of all previously freed blocks is 2^k − 1, one short of the 2^k now needed, ' +
            'so the allocator can never reuse them; any r below the golden ratio eventually can.'
        ]
      },
      invariants: [
        { name: 'length ≤ capacity', why: 'Writing past capacity corrupts the heap.', breaks: 'Only through a bug in the growth check.' },
        { name: 'Element addresses change on growth', why: 'The array is reallocated and copied.', breaks: 'Any pointer or iterator held across a push is invalid.' },
        { name: 'Amortised O(1) append', why: 'The geometric series bounds total copying.', breaks: 'For a fixed-increment growth policy, which is Θ(n²) overall.' }
      ],
      complexity: [
        { operation: 'Append', average: 'Θ(1) amortised', worst: 'Θ(n)', note: 'The worst case is the reallocation' },
        { operation: 'Index', average: 'Θ(1)', worst: 'Θ(1)', note: '' },
        { operation: 'Insert or remove at p', average: 'Θ(n − p)', worst: 'Θ(n)', note: 'Front operations are the worst case' },
        { operation: 'Space', average: 'Θ(n)', worst: '(r − 1)·n wasted', note: 'Factor 2 can hold twice the data size' }
      ],
      failureModes: [
        { symptom: 'A latency spike every so often on insert', cause: 'The amortised bound hides an O(n) copy.', fix: 'Pre-size with reserve, or use a chunked structure.' },
        { symptom: 'Memory usage twice the data size', cause: 'Growth factor 2 with no shrink policy.', fix: 'Shrink to fit after bulk loading; consider a smaller factor.' },
        { symptom: 'A stale pointer after a push', cause: 'Growth reallocated the storage.', fix: 'Store indices rather than pointers.' },
        { symptom: 'Alternating push/pop is quadratic', cause: 'Grow at full, shrink at half — no hysteresis.', fix: 'Shrink at a quarter.' }
      ],
      inTheWild: [
        { system: 'C++ std::vector', how: 'libstdc++ grows by 2, MSVC by 1.5' },
        { system: 'Go slices', how: 'Doubles below 256 elements, then ~1.25' },
        { system: 'Java ArrayList', how: 'Grows by 1.5' }
      ],
      sources: [CLRS, { title: 'Amortized computational complexity', where: 'Tarjan, 1985' }, { title: 'Resizable arrays in optimal time and space', where: 'Brodnik, Carlsson, Demaine, Munro, Sedgewick, WADS 1999' }]
    },

    'linked-lists': {
      summary: 'Constant-time splicing at a known position, paid for with a pointer per element and no ' +
        'locality — which is why arrays win at almost every size.',
      intuition: 'The textbook comparison counts operations and concludes the list is competitive. The ' +
        'machine counts cache misses and concludes it is not: a scattered list turns a scan into a chain ' +
        'of dependent loads, none of which can be prefetched or overlapped.',
      formulation: {
        equations: [
          { label: 'Footprint', expr: 'bytes = n · (payload + pointers + allocator header)',
            terms: [{ sym: 'header', meaning: 'often 16 bytes in a general-purpose allocator' }] },
          { label: 'Traversal cost', expr: 'time ≈ n · miss_latency when nodes are scattered',
            terms: [{ sym: 'miss_latency', meaning: '~80 ns, and not overlappable in a dependent chain' }] },
          { label: 'Brent cycle detection', expr: 'teleport at powers of two; λ found in O(λ + μ) steps',
            terms: [{ sym: 'λ', meaning: 'cycle length' }, { sym: 'μ', meaning: 'index where the cycle starts' }] }
        ],
        derivation: [
          'Each node\'s address is only known after the previous node has been read, so memory-level ' +
            'parallelism is exactly one — the observation M36 formalises.',
          'An intrusive list removes the allocation and the header, which is most of the overhead.'
        ]
      },
      invariants: [
        { name: 'Splicing needs the node, not the index', why: 'O(1) applies once you already hold the position.', breaks: 'When you must search for it, which is O(n).' },
        { name: 'Node addresses are stable', why: 'Nothing is reallocated, so pointers stay valid.', breaks: 'This is the list\'s real advantage over an array.' },
        { name: 'Traversal order is the pointer order', why: 'Logical order is independent of physical placement.', breaks: 'That independence is precisely the performance problem.' }
      ],
      complexity: [
        { operation: 'Insert or delete at a held node', average: 'Θ(1)', worst: 'Θ(1)', note: 'The genuine advantage' },
        { operation: 'Find by index or value', average: 'Θ(n)', worst: 'Θ(n)', note: 'And with a cache miss per step' },
        { operation: 'Traverse', average: 'Θ(n)', worst: 'Θ(n)', note: 'Up to 16× more cache lines than an array' },
        { operation: 'Space', average: 'Θ(n) plus a pointer each', worst: 'same', note: '2-8× an array of the same data' }
      ],
      failureModes: [
        { symptom: 'A list is far slower than its complexity suggests', cause: 'Scattered nodes and dependent loads.', fix: 'Use an array, or allocate nodes from an arena so they stay adjacent.' },
        { symptom: 'A traversal hangs', cause: 'A cycle introduced by a bad splice.', fix: 'Brent or Floyd cycle detection in debug builds.' },
        { symptom: 'Memory dwarfs the data', cause: 'Allocation headers on tiny nodes.', fix: 'Intrusive links, or an unrolled list holding several elements per node.' },
        { symptom: 'The linked list is slower than the array at everything measured', cause: 'It was chosen for its insertion cost, and the workload is dominated by scans.', fix: 'Keep it only where an O(1) splice is on the hot path and a map holds the node: move-to-front is 6 pointer writes against about 500 000 element moves.' }
      ],
      inTheWild: [
        { system: 'Linux kernel list_head', how: 'Intrusive, so linking costs no allocation' },
        { system: 'LRU caches', how: 'List for order plus a hash map for lookup — the list is never searched' },
        { system: 'Free lists in allocators', how: 'The links live in the free memory itself' }
      ],
      sources: [CLRS, DREPPER, { title: 'An improved Monte Carlo factorization algorithm', where: 'Brent, 1980' }]
    },

    'stacks-and-frames': {
      summary: 'The call stack is a stack with a fixed size you did not choose; recursion depth is ' +
        'memory, and converting recursion to an explicit stack moves that memory somewhere you control.',
      intuition: 'Every call pushes a frame and every return pops one, which makes recursion depth a ' +
        'memory budget rather than a style preference. Balanced structures recurse logarithmically and ' +
        'are always safe; degenerate ones recurse linearly and are one sorted input away from a crash.',
      formulation: {
        equations: [
          { label: 'Stack usage', expr: 'bytes = peak depth × frame size',
            terms: [{ sym: 'frame size', meaning: 'return address, saved registers, locals, alignment' }] },
          { label: 'Safe depth', expr: 'max depth ≈ stack limit / frame size',
            terms: [{ sym: 'stack limit', meaning: '~1 MB per thread by default in many runtimes' }] },
          { label: 'Explicit stack', expr: 'heap bytes = peak depth × entry size',
            terms: [{ sym: 'entry size', meaning: 'an index or a pointer, not a whole frame' }] }
        ],
        derivation: [
          'A balanced binary tree of n nodes recurses to depth ⌈log₂(n+1)⌉, so a 10 000-frame budget ' +
            'covers any tree that fits in memory.',
          'A degenerate tree recurses to depth n, so the budget is the node count directly.'
        ]
      },
      invariants: [
        { name: 'Frames pop in reverse order of pushes', why: 'That is what makes a stack the right structure for calls.', breaks: 'Coroutines and generators, which suspend frames deliberately.' },
        { name: 'The converted traversal visits in the same order', why: 'Otherwise the conversion changed behaviour.', breaks: 'When the pushes are ordered wrongly — check with a comparison.' },
        { name: 'Stack memory is not returned to the heap', why: 'It is a reserved region per thread.', breaks: 'Which is why deep recursion cannot borrow spare heap.' }
      ],
      complexity: [
        { operation: 'Call and return', average: 'Θ(1)', worst: 'Θ(1)', note: 'A few instructions plus the frame' },
        { operation: 'Recursive traversal, balanced', average: 'Θ(log n) stack', worst: 'Θ(log n)', note: 'Safe at any realistic size' },
        { operation: 'Recursive traversal, degenerate', average: 'Θ(n) stack', worst: 'Θ(n)', note: 'Overflows around 10⁴ nodes' },
        { operation: 'Explicit-stack traversal', average: 'Θ(depth) heap', worst: 'Θ(n)', note: '8 bytes per level instead of ~96' }
      ],
      failureModes: [
        { symptom: 'RangeError: Maximum call stack size exceeded', cause: 'Recursion depth exceeded the engine limit.', fix: 'Convert to an explicit stack, or guarantee balance.' },
        { symptom: 'Crashes only on sorted input', cause: 'A BST built from sorted data is a linked list.', fix: 'Balance the tree, or randomise insertion order.' },
        { symptom: 'A deep recursion works in one runtime and not another', cause: 'Stack limits and frame sizes differ per engine.', fix: 'Do not rely on depth; measure it, as the demo does.' },
        { symptom: 'A recursion depth guard never fires and the engine throws instead', cause: 'The guard sits above the engine\'s real stack limit, which depends on the frame size and the thread.', fix: 'Measure the limit and set the guard below it, or convert to an explicit stack - 4 095 frames become one 8-byte entry on a right spine.' }
      ],
      inTheWild: [
        { system: 'JSON parsers', how: 'Depth limits exist precisely to stop nested input overflowing the stack' },
        { system: 'Compilers', how: 'Explicit worklists rather than recursion over deeply nested ASTs' },
        { system: 'Regex engines', how: 'Backtracking recursion is a stack-overflow and ReDoS surface (M15)' }
      ],
      sources: [CLRS, { title: 'Computer Systems: A Programmer\'s Perspective, chapter 3', where: 'Bryant, O\'Hallaron' }, { title: 'System V AMD64 ABI — stack frames, alignment and the red zone', where: 'psABI-x86_64' }]
    },

    'queues-and-rings': {
      summary: 'A ring buffer gives a fixed-capacity queue with no allocation, masked wrap-around, and ' +
        'an explicit policy for what happens when it is full.',
      intuition: 'The interesting part is not the wrap, it is the full-versus-empty ambiguity and the ' +
        'policy that follows. Sizing the buffer is a burst calculation; choosing the policy is a product ' +
        'decision about which failure the system prefers.',
      formulation: {
        equations: [
          { label: 'Wrap by mask', expr: 'next = (index + 1) & (capacity − 1), capacity a power of two',
            terms: [{ sym: '&', meaning: 'one instruction instead of an integer division' }] },
          { label: 'Occupancy', expr: 'size = (tail − head) & (capacity − 1)',
            terms: [{ sym: 'usable', meaning: 'capacity − 1, because one slot disambiguates full from empty' }] },
          { label: 'Burst sizing', expr: 'slots ≥ (peak rate − drain rate) × burst duration',
            terms: [{ sym: 'drain rate', meaning: 'the consumer\'s sustained rate' }] }
        ],
        derivation: [
          'If the producer\'s average rate exceeds the consumer\'s, no capacity is sufficient: the ' +
            'buffer only absorbs bursts.',
          'Keeping one slot free lets a single-producer/single-consumer ring work with two plain indices ' +
            'and no shared counter, which is what makes it lock-free (M47).'
        ]
      },
      invariants: [
        { name: 'size ≤ capacity − 1', why: 'One slot is reserved to distinguish full from empty.', breaks: 'In implementations that keep a count instead — at the cost of another shared variable.' },
        { name: 'Capacity is a power of two', why: 'Masking requires it.', breaks: 'Otherwise the wrap needs a modulo, which is far slower.' },
        { name: 'No allocation after construction', why: 'The array is fixed.', breaks: 'That is the point: a ring buffer is what you use when you cannot allocate.' }
      ],
      complexity: [
        { operation: 'Push and pop', average: 'Θ(1)', worst: 'Θ(1)', note: 'No allocation, no copying' },
        { operation: 'Space', average: 'Θ(capacity)', worst: 'Θ(capacity)', note: 'Fixed at construction' },
        { operation: 'Two-stack queue (alternative)', average: 'Θ(1) amortised', worst: 'Θ(n)', note: 'The transfer is the worst case' }
      ],
      failureModes: [
        { symptom: 'The queue is always empty or always full', cause: 'The full/empty test is wrong, or the mask does not match the capacity.', fix: 'Assert capacity is a power of two and test both boundary states.' },
        { symptom: 'Data disappears under load', cause: 'The full policy silently overwrites.', fix: 'Count drops and expose the counter; choose rejection if losses matter.' },
        { symptom: 'Memory grows without bound under load', cause: 'The queue is unbounded rather than a ring.', fix: 'Bound it, and decide the policy deliberately (M57).' },
        { symptom: 'Latency triples after a 14% traffic increase', cause: 'The queue was already near saturation, where waiting time scales as 1/(1 − ρ).', fix: 'Plan from ρ, not from throughput: ρ = 0.833 holds 5.00 items at 0.50 ms and ρ = 0.95 holds 19.00 at 1.67 ms.' }
      ],
      inTheWild: [
        { system: 'Audio and DSP buffers', how: 'Fixed-size rings with hard real-time constraints' },
        { system: 'NIC descriptor rings', how: 'The hardware/driver interface is a ring buffer' },
        { system: 'LMAX Disruptor', how: 'A ring buffer with sequence barriers instead of locks' }
      ],
      sources: [CLRS, { title: 'The LMAX architecture', where: 'Thompson et al.' }, { title: 'A proof for the queuing formula L = λW', where: 'Little, Operations Research 1961' }]
    },

    'batching-pipelines': {
      summary: 'Batch size is one dial that sets three quantities at once: total time falls with it, ' +
        'peak memory and time to first result rise with it.',
      intuition: 'Batching exists to amortise a fixed per-batch cost, and the returns diminish sharply: ' +
        'once the overhead is small next to the work, a larger batch buys nothing and costs memory and ' +
        'latency. The right size is usually far smaller than people guess.',
      formulation: {
        equations: [
          { label: 'Total time', expr: 'T(b) = n·c_item + ⌈n/b⌉·c_batch',
            terms: [{ sym: 'c_batch', meaning: 'the fixed cost per batch: round trip, commit, flush' }] },
          { label: 'Peak memory', expr: 'peak ≈ 2 · b · item size per stage',
            terms: [{ sym: '2', meaning: 'one batch being produced while one is consumed' }] },
          { label: 'First result', expr: 'after b · stages item-stages',
            terms: [{ sym: 'b = 1', meaning: 'streaming: first output almost immediately' }] }
        ],
        derivation: [
          'The overhead term is hyperbolic in b, so most of the benefit arrives by the time the batch ' +
            'overhead is comparable to the per-batch work.',
          'Setting dT/db = 0 has no interior minimum: T decreases monotonically, which is why the ' +
            'limit comes from memory and latency rather than from time.'
        ]
      },
      invariants: [
        { name: 'The buffer is bounded', why: 'An unbounded buffer converts a slowdown into an out-of-memory failure.', breaks: 'Whenever a queue between stages has no limit.' },
        { name: 'Peak memory is set by the batch, not by n', why: 'Only the in-flight batches are live.', breaks: 'If a stage accumulates — a sort or a group-by — the peak is Θ(n) again.' },
        { name: 'Larger batches never reduce latency', why: 'Output waits for the batch to fill.', breaks: 'Except when a timeout flushes partial batches, which is the standard fix.' }
      ],
      complexity: [
        { operation: 'Total time', average: 'Θ(n + n/b)', worst: 'Θ(n·c_batch) at b = 1', note: 'Overhead dominates for tiny batches' },
        { operation: 'Peak memory', average: 'Θ(b)', worst: 'Θ(n) if b = n', note: 'Materialising is the b = n case' },
        { operation: 'Time to first result', average: 'Θ(b)', worst: 'Θ(n)', note: 'Streaming is the b = 1 case' }
      ],
      failureModes: [
        { symptom: 'Throughput is fine and latency is terrible', cause: 'The batch is too large, or it only flushes when full.', fix: 'Add a flush timeout: flush at size OR after t milliseconds.' },
        { symptom: 'Out of memory under load', cause: 'An unbounded queue between stages.', fix: 'Bound the queue and apply backpressure (M57).' },
        { symptom: 'Tiny batches saturate the network', cause: 'Per-batch overhead paid per item.', fix: 'Batch to the point where overhead is a small fraction of the work.' },
        { symptom: 'p99 latency regressed after a throughput optimisation', cause: 'The batch grew, and every row waits for its whole batch to clear each stage.', fix: 'Derive the batch from the latency budget: batch ≤ budget / (perRow × stages). Batch 10 000 here is 2 200× the throughput of batch 1 and 5× the latency.' }
      ],
      inTheWild: [
        { system: 'Database bulk insert', how: 'One transaction per batch instead of per row' },
        { system: 'Kafka producers', how: 'batch.size plus linger.ms — exactly the size-or-timeout rule' },
        { system: 'Node.js streams', how: 'highWaterMark is the batch size, and it applies backpressure' }
      ],
      sources: [{ title: 'Designing Data-Intensive Applications, chapter 11', where: 'Kleppmann' },
        { title: 'Programming Pearls, the space column', where: 'Bentley' },
        { title: 'The tail at scale', where: 'Dean and Barroso, CACM 2013' }]
    },

    'pools-and-arenas': {
      summary: 'Allocation strategy is part of a data structure\'s cost: bump allocation is one addition ' +
        'with no free, free lists are O(1) for fixed sizes, and general-purpose allocation fragments.',
      intuition: 'Fragmentation is the failure worth internalising: a heap can be mostly free and unable ' +
        'to serve a modest request, because free space is only useful when it is contiguous. Arenas and ' +
        'pools avoid it by giving up generality — one lifetime, or one size.',
      formulation: {
        equations: [
          { label: 'Bump allocation', expr: 'top ← align(top, a) + size',
            terms: [{ sym: 'free', meaning: 'not supported individually; reset frees everything' }] },
          { label: 'Free list', expr: 'allocate: head ← next[head];  free: next[slot] ← head, head ← slot',
            terms: [{ sym: 'next', meaning: 'stored inside the free slots, so the list is free of charge' }] },
          { label: 'Fragmentation', expr: '1 − largest free run / total free',
            terms: [{ sym: '≈ 1', meaning: 'the heap is free but unusable' }] }
        ],
        derivation: [
          'Coalescing adjacent free blocks on free is what keeps first-fit from degenerating; without it ' +
            'a churn workload shreds the heap into unusable holes.',
          'Fixed-size pools cannot fragment externally, which converts an unpredictable failure into a ' +
            'capacity decision made in advance.'
        ]
      },
      invariants: [
        { name: 'Live allocations never overlap', why: 'The most basic allocator correctness property.', breaks: 'Through double-free followed by reuse.' },
        { name: 'Alignment is preserved', why: 'Callers assume the returned address suits their type.', breaks: 'When a bump allocator forgets to round up before allocating.' },
        { name: 'Freed memory is reusable', why: 'Otherwise the allocator leaks by construction.', breaks: 'Under fragmentation, where it is free but unusable.' }
      ],
      complexity: [
        { operation: 'Bump allocate', average: 'Θ(1)', worst: 'Θ(1)', note: 'One add; no individual free' },
        { operation: 'Free-list allocate/free', average: 'Θ(1)', worst: 'Θ(1)', note: 'Fixed size only' },
        { operation: 'First-fit allocate', average: 'Θ(blocks)', worst: 'Θ(blocks)', note: 'And fragments over time' },
        { operation: 'Arena reset', average: 'Θ(1)', worst: 'Θ(1)', note: 'Frees everything by moving one pointer' }
      ],
      failureModes: [
        { symptom: 'Allocation fails with plenty of free memory', cause: 'External fragmentation.', fix: 'Size classes, a pool, or compaction if pointers can move.' },
        { symptom: 'Use after free in a pooled object', cause: 'A handle outlived its return to the pool.', fix: 'Generation counters in the handle; poison on free.' },
        { symptom: 'Pooling made it slower', cause: 'The allocator was not the bottleneck, and the pool added bookkeeping.', fix: 'Measure allocation cost before pooling.' },
        { symptom: 'Memory grows in a long-running process', cause: 'Fragmentation, not a leak.', fix: 'Segregate by size or lifetime; consider an arena per phase.' }
      ],
      inTheWild: [
        { system: 'Rust bumpalo, Zig arenas', how: 'Per-phase arenas with a single reset' },
        { system: 'Kernel slab allocators', how: 'Per-type caches over a page allocator (M43)' },
        { system: 'Game engines', how: 'Frame arenas reset every frame' }
      ],
      sources: [{ title: 'Dynamic storage allocation: a survey and critical review', where: 'Wilson et al., 1995' }, DREPPER, { title: 'Region-based memory management', where: 'Tofte and Talpin, Information and Computation 1997' }]
    },

    'text-buffers': {
      summary: 'Editors store text in a structure shaped around the edits people make: a gap buffer for ' +
        'sequential typing, a piece table for scattered edits after a paste, a rope for very large files.',
      intuition: 'The naive single string makes every keystroke an O(n) copy, so every real editor picks ' +
        'a structure that makes its expected edit pattern cheap. None of the three wins outright, which ' +
        'is why all three are still in use.',
      formulation: {
        equations: [
          { label: 'Gap buffer', expr: 'text = prefix ++ gap ++ suffix; insert at gap is O(1), moving the gap is O(distance)',
            terms: [{ sym: 'gap', meaning: 'unused space held at the cursor' }] },
          { label: 'Piece table', expr: 'document = concat(pieces), piece = (buffer, start, length)',
            terms: [{ sym: 'buffers', meaning: 'immutable original plus append-only added text' }] },
          { label: 'Rope', expr: 'split and concat in O(log n) over a balanced tree of leaves',
            terms: [{ sym: 'leaf', meaning: 'a small string, typically 64-1024 bytes' }] }
        ],
        derivation: [
          'A gap buffer costs nothing for typing at the cursor and the full distance for a cursor jump, ' +
            'so its cost is the sum of cursor movements rather than the number of edits.',
          'A piece table never moves text, so its cost is the length of the piece list — which is why ' +
            'long sessions eventually need consolidation.'
        ]
      },
      invariants: [
        { name: 'The rendered text is the concatenation', why: 'Every structure must agree with the naive string.', breaks: 'Never, and the demo asserts it after every script.' },
        { name: 'A piece table\'s buffers are append-only', why: 'That is what makes undo and stable spans possible.', breaks: 'If a "small optimisation" edits the original buffer in place.' },
        { name: 'The rope stays balanced', why: 'Otherwise split and concat degrade to O(n).', breaks: 'Under many appends without rebalancing.' }
      ],
      complexity: [
        { operation: 'Gap buffer: insert at cursor', average: 'Θ(1)', worst: 'Θ(n) on grow', note: 'Amortised over growth' },
        { operation: 'Gap buffer: move cursor', average: 'Θ(distance)', worst: 'Θ(n)', note: 'The dominant cost for scattered edits' },
        { operation: 'Piece table: any edit', average: 'Θ(pieces) to locate', worst: 'Θ(pieces)', note: 'No text is moved; a tree index makes it Θ(log p)' },
        { operation: 'Rope: insert or delete', average: 'Θ(log n)', worst: 'Θ(n) if unbalanced', note: 'Copies only along one path' }
      ],
      failureModes: [
        { symptom: 'Typing lags in a large file', cause: 'A single-string buffer copying the document per keystroke.', fix: 'Any of these three structures.' },
        { symptom: 'A jump to another part of the file stutters', cause: 'Gap buffer moving the gap across the document.', fix: 'Piece table, or a rope.' },
        { symptom: 'The editor slows down over a long session', cause: 'Piece list growth after thousands of small edits.', fix: 'Consolidate pieces periodically.' },
        { symptom: 'Line numbers are recomputed on every keystroke', cause: 'The line index is rebuilt instead of maintained.', fix: 'Update the index incrementally with the edit.' }
      ],
      inTheWild: [
        { system: 'Emacs', how: 'Gap buffer' },
        { system: 'VS Code', how: 'Piece table with a balanced tree index over the pieces' },
        { system: 'Xi, and several modern editors', how: 'Ropes for very large files' }
      ],
      sources: [{ title: 'VS Code text buffer reimplementation', where: 'Microsoft engineering blog, 2018' },
        { title: 'Ropes: an alternative to strings', where: 'Boehm, Atkinson, Plass, 1995' },
        { title: 'The Craft of Text Editing, chapter 6 — buffer representations', where: 'Finseth, 1991' }]
    },

    'cache-layouts': {
      summary: 'The same search over the same keys costs very different amounts of memory traffic ' +
        'depending on how the keys are arranged.',
      intuition: 'Binary search over a sorted array is comparison-optimal and cache-hostile: its early ' +
        'probes are far apart and each pulls in a line it will not reuse. Rearranging the keys so that ' +
        'the probes cluster — breadth-first, or blocked — keeps the comparisons and removes the traffic.',
      formulation: {
        equations: [
          { label: 'Eytzinger indexing', expr: 'root = 1; children of i are 2i and 2i + 1',
            terms: [{ sym: 'index 0', meaning: 'left unused so the arithmetic stays branch-free' }] },
          { label: 'Block size', expr: 'B = line size / key size',
            terms: [{ sym: 'B = 16', meaning: '64-byte line, 4-byte keys' }] },
          { label: 'Lines touched', expr: 'about log₂n − log₂B per query, for every layout',
            terms: [{ sym: 'log₂B', meaning: 'the final probes that share one line' }] },
          { label: 'Misses (the measure that moves)', expr: 'misses = lines touched − levels held in cache',
            terms: [{ sym: 'sorted', meaning: 'level k costs 2^k lines, so ~9 levels fit in 32 KB' },
              { sym: 'eytzinger', meaning: 'level k costs 2^k/B lines, so ~13 levels fit' },
              { sym: 'blocked', meaning: 'the whole separator level fits, leaving one miss' }] }
        ],
        derivation: [
          'The last log₂B probes of a sorted binary search fall within one line, so distinct lines ' +
            'per query is log₂n − log₂B for every layout — which is why that number shows nothing.',
          'Across a stream of queries the top levels are reused, so the real question is how many ' +
            'levels fit in the cache. Contiguous levels hold B times more of the tree per line.',
          'A blocked layout answers B comparisons per line, turning the base of the logarithm from 2 ' +
            'into B — the same argument as a B-tree over pages (M51).'
        ]
      },
      invariants: [
        { name: 'The comparison count is essentially unchanged', why: 'All three layouts hold the same sorted keys.', breaks: 'Blocked layouts do a few more comparisons per line, and far fewer fetches.' },
        { name: 'Distinct lines per query is layout-independent', why: 'A search of log n probes touches log n lines however the keys are arranged.', breaks: 'Never — which is exactly why it is the wrong thing to measure.' },
        { name: 'Eytzinger requires a static array', why: 'Insertion would have to rebuild the layout.', breaks: 'For dynamic data, which is what B-trees handle.' },
        { name: 'Alignment to the line matters', why: 'A block straddling two lines costs two fetches.', breaks: 'When the array base is not line-aligned.' }
      ],
      complexity: [
        { operation: 'Sorted binary search', average: 'Θ(log n) comparisons, 4.33 misses at 256 KB', worst: 'same', note: 'Comparison-optimal, cache-hostile' },
        { operation: 'Eytzinger search', average: 'Θ(log n) comparisons, 3.46 misses', worst: 'same', note: 'More levels resident; prefetch-friendly' },
        { operation: 'Blocked search', average: 'Θ(log_B n) fetches, 1.57 misses', worst: 'same', note: 'The static B-tree' },
        { operation: 'Any layout, data fits in cache', average: '≈0 misses', worst: 'compulsory misses only', note: 'The effect exists only past the cache size' },
        { operation: 'Build cost', average: 'Θ(n)', worst: 'Θ(n)', note: 'One pass to permute' }
      ],
      failureModes: [
        { symptom: 'A search-heavy workload is memory-bound', cause: 'Sorted binary search over a large array.', fix: 'Eytzinger or a blocked layout; measure misses, not comparisons.' },
        { symptom: 'A benchmark shows no difference between layouts', cause: 'Distinct lines was measured instead of misses, or the array fits in cache.', fix: 'Measure misses across a warm query stream, on data larger than the cache.' },
        { symptom: 'The rearranged version is slower', cause: 'The array fits in cache, so there was no traffic to save.', fix: 'These layouts only pay off past the cache size.' },
        { symptom: 'Eytzinger returns wrong answers at the boundary', cause: 'The final candidate needs a check after the loop.', fix: 'Track the last candidate and verify it, as the implementation does.' }
      ],
      inTheWild: [
        { system: 'Database B+trees', how: 'Blocked layout with the block equal to the page size (M51)' },
        { system: 'Static search structures in search engines', how: 'Eytzinger with software prefetch, which is where its published ~2× comes from' },
        { system: 'std::lower_bound on small arrays', how: 'Linear scan wins below a cache line, for the same reason' }
      ],
      sources: [{ title: 'Array layouts for comparison-based searching', where: 'Khuong, Morin, 2017' }, DREPPER, { title: 'Cache-oblivious algorithms', where: 'Frigo, Leiserson, Prokop, Ramachandran, FOCS 1999' }]
    }
  });
}(typeof window !== 'undefined' ? window : null));
