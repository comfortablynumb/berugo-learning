/**
 * Worked examples for the linear-structures sections (M02).
 * Figures are recomputed by tests/unit/worked-examples-linear.test.js.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'memory-layout': [{
      title: 'Work out the stride, then the wasted bandwidth',
      goal: 'Predict what a one-field scan costs before running it.',
      setup: 'Record { id: i32, flag: u8, score: f64, rank: i16 }, 1 000 000 records, summing score.',
      steps: [
        { do: 'Place the fields under the alignment rules.', why: 'Each field starts at an address divisible by its own width.',
          work: 'id    i32 at 0..4\nflag  u8  at 4..5\npad         5..8   (3 bytes)\nscore f64 at 8..16\nrank  i16 at 16..18\npad         18..24  (6 bytes, to a multiple of 8)',
          result: 'Stride 24 bytes; 15 used, 9 padding.' },
        { do: 'Compute what the scan needs and what it touches.', why: 'The query wants one 8-byte field per record and gets a whole stride.',
          work: 'needed  = 1e6 × 8 B  = 8 MB\ntouched = 1e6 × 24 B = 24 MB\nwaste   = 16 MB (67%)',
          result: 'Three times the necessary bandwidth.' },
        { do: 'Count cache lines instead of bytes.', why: 'Memory moves in 64-byte lines, so lines are the real unit.',
          work: 'records per line = 64 / 24 = 2.67\nlines = 1e6 / 2.67 = 375,000\nSoA: 8 B per record ⇒ 8 records per line\nlines = 1e6 / 8 = 125,000',
          result: 'SoA touches 125k lines against 375k — three times fewer.' },
        { do: 'Reorder the fields widest-first.', why: 'The same fields in decreasing width need almost no padding.',
          work: 'score f64 at 0..8\nid    i32 at 8..12\nrank  i16 at 12..14\nflag  u8  at 14..15\npad         15..16  (1 byte)',
          result: 'Stride falls from 24 to 16 bytes: 33% less memory for free.' }
      ],
      answer: 'Declaration order gives a 24-byte stride with 9 bytes of padding, so the scan touches ' +
        '24 MB to read 8 MB. Widest-first ordering cuts the stride to 16, and SoA cuts the lines ' +
        'touched from 375 000 to 125 000.'
    }, {
      title: 'Pick the layout from the access pattern, not from taste',
      goal: 'Measure AoS against SoA on the two workloads that pull in opposite directions.',
      setup: 'The same record — { id: i32, flag: u8, score: f64, rank: i16 }, stride 24 with 9 bytes ' +
        'of padding — held as 50 000 records both ways, through a 32 KiB cache with 64-byte lines.',
      steps: [
        {
          do: 'Scan one field of every record.',
          why: 'This is the analytics shape: many rows, one column.',
          work: 'AoS: 18,750 misses, 1,200,000 bytes fetched\n' +
            'SoA:  6,251 misses,   400,064 bytes fetched\n' +
            'ratio: 3.0×',
          result: 'SoA moves exactly the bytes the sum needs; AoS moves the whole record.'
        },
        {
          do: 'Explain the 3.0 from the layout alone.',
          why: 'The factor should fall out of the stride, not out of the measurement.',
          work: 'AoS: one 8-byte score per 24-byte stride ⇒ 64/24 = 2.67 scores per line\n' +
            'SoA: eight 8-byte scores per 64-byte line\n' +
            '8 / 2.67 = 3.0',
          result: 'The ratio is the stride ratio; the cache only confirms it.'
        },
        {
          do: 'Now read whole records at random.',
          why: 'This is the transactional shape: one row, every column.',
          work: '5,000 random records, all four fields:\n' +
            'AoS:  6,034 misses = 1.21 per record,   386,176 bytes\n' +
            'SoA: 18,522 misses = 3.70 per record, 1,185,408 bytes\n' +
            'ratio: 3.1× — the other way',
          result: 'A record spans one AoS line and four SoA columns.'
        },
        {
          do: 'Say why SoA still wins the sequential whole-record scan.',
          why: 'The folklore says AoS wins whenever every field is read, and here it does not.',
          work: 'sequential, all four fields:\n' +
            'AoS: 18,750 misses, 1,200,000 bytes — 9 of every 24 bytes are padding\n' +
            'SoA: 11,721 misses,   750,144 bytes — the columns are dense\n' +
            'AoS carries 37.5% dead bytes on every line',
          result: 'Padding, not the access pattern, decides that one.'
        },
        {
          do: 'Write the rule the numbers actually support.',
          why: 'Two measurements, two opposite winners, one rule.',
          work: 'sequential + few fields  ⇒ SoA (3.0× fewer misses here)\n' +
            'random + whole record    ⇒ AoS (3.1× fewer misses here)\n' +
            'sequential + whole record ⇒ whichever has less padding',
          result: 'The access pattern picks the layout; the padding breaks the tie.'
        }
      ],
      answer: 'The same 50 000 records: scanning one field costs 18 750 misses as AoS and 6 251 as ' +
        'SoA (3.0×), while reading 5 000 whole records at random costs 6 034 as AoS and 18 522 as SoA ' +
        '(3.1× the other way). Neither layout is better — the access pattern is.'
    }],

    'dynamic-arrays': [{
      title: 'Total the copies for two growth factors',
      goal: 'Turn "factor 2 versus 1.5" into numbers rather than folklore.',
      setup: 'One million appends into an array that starts with capacity 1.',
      steps: [
        { do: 'Sum the copies for factor 2.', why: 'Copies happen at each power of two, so the total is a geometric series.',
          work: 'copies = 1 + 2 + 4 + … + 524288\n       = 2^20 − 1 = 1,048,575\nper push ≈ 1.05',
          result: 'About n elements copied in total.' },
        { do: 'Sum the copies for factor 1.5.', why: 'A smaller factor grows more often, so it copies more.',
          work: 'formula: copies ≈ n / (r − 1) = 1e6 / 0.5 = 2,000,000\nsimulated with ⌈capacity × 1.5⌉ from capacity 1: 2,099,719\nper push = 2.10',
          result: 'About 2n — twice the copying, and the closed form is 5% low.' },
        { do: 'Compare the wasted capacity.', why: 'The other half of the trade is memory sitting unused.',
          work: 'factor 2:   capacity 1,048,576 for 1,000,000 ⇒ 48,576 wasted (4.6%)\nfactor 1.5: capacity 1,049,868             ⇒ 49,868 wasted (4.8%)\nthese are lucky landings: the worst case is (r − 1)·n, so 100% and 50%',
          result: 'Worst-case waste is (r − 1)·n: 100% at r = 2, 50% at r = 1.5.' },
        { do: 'Check whether the freed blocks can be reused.', why: 'This is the real argument, and it is arithmetic.',
          work: 'factor 2: 1 + 2 + 4 + … + 2^(k−1) = 2^k − 1 < 2^k\n⇒ the sum of everything freed is always one short of the next request\nfactor 1.5: the sum eventually exceeds the next request',
          result: 'Factor 2 can never reuse its own freed space; 1.5 eventually can.' }
      ],
      answer: 'Factor 2 copies 1.05 elements per push and can never reuse freed blocks; factor ' +
        '1.5 copies 2.10 per push and eventually can. That is the whole trade, and it is why ' +
        'standard libraries disagree.'
    }, {
      title: 'Price the shift nobody puts in the complexity table',
      goal: 'Compare the three ways to remove and insert in an array, in element moves.',
      setup: 'An array of 1 000 000 four-byte integers, and 100 000 operations at positions chosen ' +
        'uniformly at random.',
      steps: [
        {
          do: 'Count the moves for an insert in the middle.',
          why: 'Everything after the insertion point shifts by one slot.',
          work: 'average moves per insert = n/2 = 500,000\n' +
            '100,000 inserts × 500,000 = 5.0 × 10¹⁰ element moves\n' +
            'at 4 bytes each: 200 GB of memory traffic',
          result: 'The O(1) amortised append and the O(n) middle insert are the same method.'
        },
        {
          do: 'Count the moves for an append.',
          why: 'This is the operation the amortised argument is about.',
          work: 'shifts per append: 0\n' +
            'copies from growth over 100,000 appends: < 100,000 (amortised < 1 each)\n' +
            'ratio to the middle insert: 5 × 10⁵',
          result: 'Half a million times less work, for the same asymptotic label.'
        },
        {
          do: 'Use swap-remove where order does not matter.',
          why: 'Most "remove from a list" code does not actually need the order preserved.',
          work: 'move the last element into the hole: 1 move\n' +
            '100,000 removals = 100,000 moves\n' +
            'against 5.0 × 10¹⁰ for order-preserving removal',
          result: 'Θ(1) instead of Θ(n), bought by giving up the order.'
        },
        {
          do: 'Batch the removals when order does matter.',
          why: 'One pass can delete k elements for the price of one shift.',
          work: 'mark then compact: one pass of n reads and ≤ n writes\n' +
            '1,000,000 moves for all 100,000 removals\n' +
            'against 5.0 × 10¹⁰ one at a time: 50,000× fewer',
          result: 'The shape of the loop, not the data structure, was the problem.'
        }
      ],
      answer: '100 000 random-position inserts into a million-element array move 5.0 × 10¹⁰ elements ' +
        '— 200 GB of traffic — while the same number of appends move none. Swap-remove does it in ' +
        '100 000 moves, and a mark-and-compact pass does all 100 000 order-preserving removals in ' +
        '1 000 000.'
    }],

    'linked-lists': [{
      title: 'Price a list against an array for the same scan',
      goal: 'Compare the two structures in bytes and cache lines, not in complexity classes.',
      setup: 'One million 4-byte integers, summed once. List nodes are 8 bytes (value + 4-byte index).',
      steps: [
        { do: 'Compute the memory each structure needs.', why: 'The pointer is per element, so it doubles the footprint here.',
          work: 'array: 1e6 × 4 B = 4 MB\nlist:  1e6 × 8 B = 8 MB (and 32 B per node with a real allocator header)',
          result: 'Twice the memory at best, eight times with allocation overhead.' },
        { do: 'Count cache lines for the array scan.', why: 'Sequential access uses every byte of every line it fetches.',
          work: '16 integers per 64-byte line\nlines = 1e6 / 16 = 62,500',
          result: '62 500 lines, all fully used.' },
        { do: 'Count them for a scattered list.', why: 'If nodes are spread out, each step lands on a fresh line.',
          work: 'worst case: one line per node\nlines = 1,000,000',
          result: '16× more lines than the array.' },
        { do: 'Add the dependency chain.', why: 'The next address is unknown until the current node arrives, so misses cannot overlap.',
          work: 'array:  many outstanding misses (prefetchable)\nlist:   1 outstanding miss at a time\nat ~80 ns per miss: 1e6 × 80 ns = 80 ms of pure latency',
          result: 'The list serialises what the array overlaps.' }
      ],
      answer: 'The same one million integers cost 4 MB and 62 500 cache lines as an array, and 8 MB ' +
        'and up to 1 000 000 lines as a scattered list — with the list\'s misses serialised because ' +
        'each address depends on the previous load.'
    }, {
      title: 'Find the workload where the list actually wins',
      goal: 'Stop comparing lists and arrays on scans, and compare them where the pointer earns its keep.',
      setup: 'An LRU cache of 1 000 000 entries: every hit moves one entry to the front, and the ' +
        'entry is found by key, not by position.',
      steps: [
        {
          do: 'Cost move-to-front in an array.',
          why: 'Moving element i to the front shifts everything before it.',
          work: 'average moves per hit = n/2 = 500,000\n' +
            '1,000,000 hits × 500,000 = 5.0 × 10¹¹ element moves',
          result: 'The array loses by five orders of magnitude, and it is not close.'
        },
        {
          do: 'Cost the same operation on a doubly linked list.',
          why: 'Unlinking and relinking touches a fixed number of pointers.',
          work: 'unlink: prev.next = next, next.prev = prev            (2 writes)\n' +
            'push to front: node.next, node.prev, head.prev, head    (4 writes)\n' +
            '1,000,000 hits × 6 = 6.0 × 10⁶ pointer writes',
          result: 'Θ(1) per hit, independent of the cache size.'
        },
        {
          do: 'Say what makes that possible.',
          why: 'The list is only O(1) if you already hold the node — finding it by scan would be O(n).',
          work: 'a hash map from key to node handle: O(1) lookup (M03)\n' +
            'the list stores order; the map stores location\n' +
            'neither structure alone is enough',
          result: 'The list wins because something else does the finding.'
        },
        {
          do: 'Charge the list for what it costs everywhere else.',
          why: 'The same pointers that make the splice cheap make every scan expensive.',
          work: 'node overhead: 8 bytes of links per 4-byte value = 3× the memory\n' +
            'a full scan: one dependent load per node, no prefetch\n' +
            'measured earlier: up to 1 000 000 misses for a scattered list, against 62 500 for the array',
          result: 'A structure chosen for one operation is paying for it in all the others.'
        }
      ],
      answer: 'Move-to-front costs 5.0 × 10¹¹ element moves in an array and 6.0 × 10⁶ pointer writes ' +
        'in a linked list — but only because a hash map finds the node first. The same links cost 3× ' +
        'the memory and turn every scan into a dependent-load chain.'
    }],

    'stacks-and-frames': [{
      title: 'Work out where recursion stops being safe',
      goal: 'Convert a stack limit into a maximum input size, per tree shape.',
      setup: 'A ~1 MB stack, frames of about 96 bytes, in-order traversal of a binary tree.',
      steps: [
        { do: 'Compute the frame budget.', why: 'The limit is bytes; recursion spends them in frame-sized units.',
          work: 'frames = 1,048,576 / 96 ≈ 10,922',
          result: 'Roughly 10 900 nested calls.' },
        { do: 'Apply it to a balanced tree.', why: 'Depth is log2(n), so the budget is enormous.',
          work: 'depth = log2(n) ≤ 10,922\nn ≤ 2^10,922',
          result: 'No balanced tree that fits in memory can overflow.' },
        { do: 'Apply it to a degenerate tree.', why: 'Depth equals n, so the budget is the node count.',
          work: 'depth = n ≤ 10,922',
          result: 'About 11 000 nodes, and a sorted-input BST hits that easily.' },
        { do: 'Price the explicit-stack version.', why: 'Moving to the heap changes the unit from a frame to an index.',
          work: 'heap entry = 8 B\n10,922 frames × 96 B = 1 MB\n1e6 entries × 8 B = 8 MB, on a heap that has it',
          result: 'The same traversal handles a million-deep tree in 8 MB of heap.' }
      ],
      answer: 'A 1 MB stack at 96 bytes per frame allows about 10 900 nested calls: unlimited for a ' +
        'balanced tree, and about 11 000 nodes for a degenerate one. The explicit-stack version needs ' +
        '8 bytes per level instead of 96.'
    }, {
      title: 'Traverse the same tree three ways and count what stays live',
      goal: 'Separate the memory a traversal needs from the memory the tree needs.',
      setup: 'A 4 095-node binary tree traversed in order, once balanced and once degenerate (a right ' +
        'spine). Frames are 96 bytes; an explicit-stack entry is an 8-byte index.',
      steps: [
        {
          do: 'Traverse the balanced tree both ways.',
          why: 'With a balanced tree the two methods agree on depth, so only the entry size differs.',
          work: 'recursive: depth 12, 12 × 96 B = 1,152 B\n' +
            'explicit:  depth 12, 12 ×  8 B =    96 B\n' +
            'ratio: 12×',
          result: 'Same shape, same order, one twelfth of the memory.'
        },
        {
          do: 'Traverse the degenerate tree recursively.',
          why: 'A right spine makes the recursion depth equal to the node count.',
          work: 'depth = 4,095 frames\n' +
            'peak  = 4,095 × 96 B = 393,120 B',
          result: '384 KiB of stack to walk 4 095 nodes.'
        },
        {
          do: 'Traverse the degenerate tree with an explicit stack.',
          why: 'This is the number that surprises people, and it is not a small saving.',
          work: 'in-order on a right spine: push, pop, then follow right — nothing accumulates\n' +
            'peak stack = 1 entry = 8 bytes\n' +
            'ratio to recursion: 49,140×',
          result: 'The recursion was storing return addresses it never needed.'
        },
        {
          do: 'Turn both into a maximum tree size.',
          why: 'The budget is the thread stack, and it is fixed before your code starts.',
          work: '1 MiB / 96 B    = 10,922 frames  ⇒ degenerate trees up to ~10 900 nodes\n' +
            '1 MiB / 8 B     = 131,072 entries ⇒ 12× more, on the heap where it can grow\n' +
            'balanced:       depth 12 at 4 095 nodes, depth 30 at 10⁹',
          result: 'Recursion is safe on balanced trees at any size you can hold in memory.'
        },
        {
          do: 'Check where the guard has to sit.',
          why: 'A depth limit above the engine\'s real limit protects nothing.',
          work: 'engine limit here: ~11 000 frames (measured, and it varies by engine and by frame size)\n' +
            'a maxDepth of 20 000 never fires — the engine throws first\n' +
            'a maxDepth of 1 000 stops cleanly after 1 000 nodes',
          result: 'The guard must be below the engine limit to be a guard at all.'
        }
      ],
      answer: 'On a balanced 4 095-node tree recursion needs 1 152 bytes and an explicit stack 96. On ' +
        'the degenerate one recursion needs 393 120 bytes and the explicit stack needs 8 — a 49 140× ' +
        'difference, because an in-order walk of a right spine never has to remember anything.'
    }],

    'queues-and-rings': [{
      title: 'Size a ring buffer and choose its policy',
      goal: 'Turn a producer/consumer rate mismatch into a capacity and a policy.',
      setup: 'A producer averaging 10 000 items/s with bursts to 25 000, a consumer steady at 12 000/s, bursts lasting up to 200 ms.',
      steps: [
        { do: 'Check the steady state first.', why: 'If the average producer rate exceeds the consumer, no buffer size saves you.',
          work: 'producer avg 10,000/s < consumer 12,000/s ⇒ stable\nheadroom = 2,000/s',
          result: 'The queue is a burst absorber, not a fix for an overloaded consumer.' },
        { do: 'Size the buffer from the burst.', why: 'The buffer must hold the excess the burst produces.',
          work: 'excess rate = 25,000 − 12,000 = 13,000/s\nburst 0.2 s ⇒ 2,600 items',
          result: 'At least 2 600 slots.' },
        { do: 'Round to a power of two and add the wasted slot.', why: 'Masking needs a power of two, and one slot distinguishes full from empty.',
          work: 'next power of two ≥ 2,601 = 4,096\nusable = 4,095',
          result: 'Capacity 4 096, usable 4 095, wrap by & 4095.' },
        { do: 'Choose the full policy.', why: 'The choice is a product decision about which failure is acceptable.',
          work: 'take a 5,000-item excess burst against 4,095 usable slots ⇒ 905 items over\nreject:    905 rejections the producer can see and back off from\noverwrite: the 905 oldest items vanish with no signal at all\nblock:     the producer stalls 905 / 2,000 per s = 0.45 s',
          result: 'Telemetry usually overwrites; orders always reject or block.' },
        { do: 'Compute the drain time.', why: 'A full buffer must clear before the next burst.',
          work: 'drain = 2,600 / 2,000 per s = 1.3 s',
          result: 'Bursts closer together than 1.3 s will overflow regardless of policy.' }
      ],
      answer: 'A 4 096-slot ring (4 095 usable, wrap by & 4095) absorbs the 2 600-item burst, and it ' +
        'takes 1.3 s to drain — so bursts arriving faster than that overflow whatever policy is chosen.'
    }, {
      title: 'Ask the queue how long it is, not how big it is',
      goal: 'Use Little\'s law to turn a queue length into a latency, and find where utilisation stops being free.',
      setup: 'One consumer serving 12 000 items/s, arrivals Poisson at rate λ, an unbounded queue. ' +
        'The ring buffer holds 2 048 slots.',
      steps: [
        {
          do: 'Write the two facts the queue obeys.',
          why: 'One is exact for any stable queue; the other needs the arrival model.',
          work: 'Little\'s law:   L = λ · W          (exact, any arrival process)\n' +
            'M/M/1 queue:    L = ρ/(1 − ρ),  ρ = λ/μ',
          result: 'Length and waiting time are the same statement twice.'
        },
        {
          do: 'Evaluate at the design load.',
          why: 'This is the number the capacity plan is built on.',
          work: 'λ = 10,000, μ = 12,000 ⇒ ρ = 0.833\n' +
            'L = 0.833/0.167 = 5.00 items\n' +
            'W = L/λ = 0.50 ms',
          result: 'Five items in flight, half a millisecond of queueing.'
        },
        {
          do: 'Add 14% more traffic.',
          why: 'Utilisation and latency are not proportional, and this is where that bites.',
          work: 'λ = 11,400 ⇒ ρ = 0.950\n' +
            'L = 19.00 items   (3.8× the length)\n' +
            'W = 1.67 ms       (3.3× the wait)',
          result: '14% more load, 3.3× the latency.'
        },
        {
          do: 'Push to 99%.',
          why: 'The 1/(1 − ρ) term is the whole story of capacity planning.',
          work: 'ρ = 0.99 ⇒ L = 99 items, W = 8.3 ms\n' +
            'from ρ = 0.833: 20× the queue, 17× the wait, for 19% more throughput',
          result: 'The last 19% of throughput costs 17× the latency.'
        },
        {
          do: 'Check the buffer against those lengths.',
          why: 'The ring only has to absorb the queue, not the load.',
          work: 'design load needs 5 slots; ρ = 0.99 needs 99\n' +
            '2,048 slots is 20× the ρ = 0.99 queue\n' +
            'so the buffer is sized for bursts, not for steady state',
          result: 'If the ring is ever full in steady state, the problem is ρ, not the size.'
        }
      ],
      answer: 'At ρ = 0.833 the queue holds 5.00 items and waits 0.50 ms; at ρ = 0.95 it is 19.00 ' +
        'items and 1.67 ms; at ρ = 0.99, 99 items and 8.3 ms. A 2 048-slot ring is 20× larger than ' +
        'the 99% queue, which is the point — it exists for bursts, and no size fixes ρ → 1.'
    }],

    'batching-pipelines': [{
      title: 'Choose a batch size from the overhead',
      goal: 'Balance per-batch overhead against memory and latency with arithmetic.',
      setup: '100 000 rows, 0.4 µs of work per row per stage, 3 stages, and a 1 ms commit per batch per stage.',
      steps: [
        { do: 'Compute the fixed work.', why: 'The per-item cost does not depend on the batch size at all.',
          work: 'work = 100,000 × 3 × 0.4 µs = 120,000 µs = 120 ms',
          result: '120 ms whatever the batch size.' },
        { do: 'Compute the overhead at three batch sizes.', why: 'Overhead is the only term the dial moves.',
          work: 'size 1:     100,000 batches × 3 × 1 ms = 300,000 ms\nsize 500:       200 batches × 3 × 1 ms =     600 ms\nsize 5,000:      20 batches × 3 × 1 ms =      60 ms',
          result: 'From 300 s to 0.6 s to 0.06 s.' },
        { do: 'Add them up and look at the returns.', why: 'Beyond a point the overhead is already amortised.',
          work: 'size 500:   120 + 600  = 720 ms\nsize 5,000: 120 + 60   = 180 ms\nsize 50,000:120 + 6    = 126 ms',
          result: 'Ten times the batch buys 4× from 500, then only 1.4×.' },
        { do: 'Price the memory and the latency.', why: 'Those are what the larger batch costs.',
          work: 'row = 200 B\nsize 5,000:  2 × 5,000 × 200 B = 2 MB peak\nfirst result after 5,000 × 3 = 15,000 row-stages\nsize 50,000: 20 MB peak, 150,000 row-stages',
          result: '5 000 gives most of the speed for a tenth of the memory.' }
      ],
      answer: 'At 1 ms overhead per batch per stage, batching 5 000 rows takes total time from 720 ms ' +
        '(at 500) to 180 ms for a 2 MB peak; going to 50 000 saves a further 54 ms and costs 20 MB.'
    }, {
      title: 'Watch batching buy throughput with latency',
      goal: 'Put the two curves on the same table so the trade is a choice rather than an accident.',
      setup: '100 000 rows, 0.4 µs of work per row per stage, 3 stages, and a 1 ms commit per batch ' +
        'per stage. Time to first result is one batch through all three stages.',
      steps: [
        {
          do: 'Write the two costs.',
          why: 'One shrinks with the batch size and the other grows with it.',
          work: 'total    = rows × perRow × stages + (rows/batch) × commit × stages\n' +
            '         = 100,000 × 0.4 µs × 3 + (100,000/batch) × 1 ms × 3\n' +
            'first out = batch × perRow × stages + commit × stages\n' +
            '         = batch × 1.2 µs + 3 ms',
          result: 'Throughput improves as 1/batch; latency degrades linearly in batch.'
        },
        {
          do: 'Tabulate four batch sizes.',
          why: 'The interesting part is where each curve stops moving.',
          work: 'batch      1: total 300.12 s, first result  3.00 ms,   0.3k rows/s\n' +
            'batch    100: total   3.12 s, first result  3.12 ms,  32.1k rows/s\n' +
            'batch  1,000: total   0.42 s, first result  4.20 ms, 238.1k rows/s\n' +
            'batch 10,000: total   0.15 s, first result 15.00 ms, 666.7k rows/s',
          result: 'Throughput rises 2 200×; latency rises 5×.'
        },
        {
          do: 'Find where the returns stop.',
          why: 'Once the commit is amortised below the real work, more batching buys almost nothing.',
          work: 'row work alone = 100,000 × 0.4 µs × 3 = 0.12 s — the floor\n' +
            'batch  1,000: 0.42 s = 3.5× the floor\n' +
            'batch 10,000: 0.15 s = 1.25× the floor\n' +
            'batch 100,000: 0.123 s = 1.03× the floor, at 120 ms to first result',
          result: 'Past 10 000 the throughput gain is 20%, and the latency cost is 8×.'
        },
        {
          do: 'Choose from the constraint you actually have.',
          why: 'Both columns are correct; only one of them is in your requirements.',
          work: 'interactive (p99 < 10 ms): batch ≤ 1,000\n' +
            'nightly batch job:         batch 10,000 or more\n' +
            'streaming with a deadline: batch = deadline / (perRow × stages)',
          result: 'The batch size is a latency budget divided by per-row cost.'
        }
      ],
      answer: 'Going from batch 1 to batch 10 000 takes the job from 300.12 s to 0.15 s — 2 200× the ' +
        'throughput — and takes time-to-first-result from 3.00 ms to 15.00 ms. The row work alone is ' +
        '0.12 s, so batch 10 000 is already within 25% of the floor and everything past it is bought ' +
        'with latency.'
    }],

    'pools-and-arenas': [{
      title: 'Predict fragmentation before it bites',
      goal: 'Show that free bytes and usable bytes are different quantities.',
      setup: 'A 64 KB heap, first-fit, alternating 64-byte and 256-byte allocations, then every 256-byte block freed.',
      steps: [
        { do: 'Fill the heap.', why: 'The interleaving is what creates the pattern.',
          work: 'pair = 64 + 256 = 320 B\npairs = ⌊65,536 / 320⌋ = 204\nallocated: 204 × 64 B + 204 × 256 B = 13,056 + 52,224 = 65,280 B\ntail left over: 65,536 − 65,280 = 256 B',
          result: '204 blocks of each size, 65 280 bytes used, a 256-byte tail spare.' },
        { do: 'Free every 256-byte block.', why: 'This is the realistic case: objects of one class die together.',
          work: 'freed = 204 × 256 B = 52,224 B\nplus the tail:  52,224 + 256 = 52,480 B (80% of the heap)\nthe last freed block coalesces with the tail ⇒ one 512 B run\nlargest contiguous free run = 512 B',
          result: '52.5 KB free: 203 holes of 256 B and one of 512 B.' },
        { do: 'Try a 1 KB allocation.', why: 'It obviously fits in the total and in no individual hole.',
          work: 'needed 1,024 B\nlargest run 512 B\n⇒ allocation fails with 80% of the heap free',
          result: 'Fragmentation ratio = 1 − 512/52,480 = 0.990.' },
        { do: 'Check what a pool would have done.', why: 'Fixed-size slots cannot fragment externally.',
          work: 'two pools: one of 64 B slots, one of 256 B slots\nfreeing all 256 B objects returns 204 reusable slots\nlargest usable request stays 256 B — by design, and known in advance',
          result: 'The failure becomes a capacity decision rather than a surprise.' }
      ],
      answer: 'After freeing every 256-byte block, 80% of the heap is free and the largest contiguous ' +
        'run is 512 bytes, so a 1 KB request fails — a fragmentation ratio of 0.990 that a size-class ' +
        'pool would have avoided entirely.'
    }, {
      title: 'Give the allocator a lifetime and watch fragmentation disappear',
      goal: 'Compare a general-purpose allocator with an arena on a request-shaped workload.',
      setup: 'A 64 KiB heap. Each request allocates 20 objects of 24, 40, 56 or 88 bytes; half of them ' +
        'are still live when the request ends, and the rest are freed.',
      steps: [
        {
          do: 'Run the workload against first-fit.',
          why: 'This is what a general-purpose allocator does with mixed sizes and mixed lifetimes.',
          work: 'request 122 fails to allocate\n' +
            '2,450 allocations, 1,220 frees before that\n' +
            'live at failure: 62,736 of 65,536 bytes',
          result: 'It ran out at request 122, with 96% of the heap genuinely in use.'
        },
        {
          do: 'Look at what the free space had become.',
          why: 'The failure is not that memory ran out — it is that it stopped being usable.',
          work: 'free bytes: 2,208\n' +
            'free blocks: 190\n' +
            'largest free block: 48 bytes\n' +
            '⇒ a 24-byte request still fits; an 88-byte one cannot',
          result: 'External fragmentation: enough bytes, no block.'
        },
        {
          do: 'Run the same workload against an arena that resets per request.',
          why: 'The lifetime is known — everything the request allocated dies with the request.',
          work: '200 requests × 20 objects = 4,000 allocations\n' +
            '200 resets, 0 failures\n' +
            'peak in use: 1,280 bytes',
          result: 'It never needed more than one request\'s worth of memory.'
        },
        {
          do: 'Say what the arena gave up.',
          why: 'Bump allocation is only cheap because it cannot do the general thing.',
          work: 'allocate: pointer += size          (no search, no header, no coalescing)\n' +
            'free:     nothing\n' +
            'reset:    pointer = 0                 (frees 20 objects at once)\n' +
            'cost:     an object that must outlive the request has to be copied out',
          result: 'It solves the whole problem by refusing to solve the general one.'
        },
        {
          do: 'Note the middle option.',
          why: 'A size-class pool keeps individual frees and still cannot fragment externally.',
          work: 'one free list per size class ⇒ every free block fits every request of that class\n' +
            'internal fragmentation instead: 88 bytes rounded to a 96-byte class wastes 8 bytes (9%)\n' +
            'bounded, and visible in advance',
          result: 'Choose which fragmentation you would rather have.'
        }
      ],
      answer: 'First-fit fails at request 122 with 2 208 bytes free — in 190 blocks whose largest is ' +
        '48 bytes — while an arena runs the same 200 requests with a peak of 1 280 bytes and no ' +
        'failures. The arena wins by knowing the lifetime, not by being cleverer.'
    }],

    'text-buffers': [{
      title: 'Cost one minute of typing in three structures',
      goal: 'Compare the structures on the workload an editor actually sees.',
      setup: 'A 1 MB file, 300 keystrokes at one position, then 50 edits scattered through the file.',
      steps: [
        { do: 'Cost the naive single string.', why: 'It is the baseline everyone starts with.',
          work: 'each insert copies the whole document\n350 × 1,048,576 B = 367 MB moved',
          result: '367 MB of copying for 350 keystrokes.' },
        { do: 'Cost the gap buffer.', why: 'Typing at the gap is free; moving the gap costs the distance.',
          work: 'sequential typing: 300 inserts × 0 moves = 0\nscattered: 50 cursor moves averaging ~340 KB\n50 × 349,525 B ≈ 17.5 MB',
          result: '17.5 MB, all of it from cursor movement.' },
        { do: 'Cost the piece table.', why: 'It never moves text; it appends and splits the piece list.',
          work: '350 edits ⇒ up to 2 new pieces each\npieces ≈ 700, bytes moved = 0\nlist surgery ≈ 700 small splices',
          result: 'Zero bytes moved, at the cost of a longer piece list.' },
        { do: 'Cost the rope.', why: 'Splits and joins touch a path, not the document.',
          work: 'leaf 64 B, depth ≈ log2(1e6 / 64) ≈ 14\n350 edits × ~14 nodes × 64 B ≈ 313 KB copied',
          result: 'About 313 KB — between the other two, and stable across patterns.' },
        { do: 'Read the ranking.', why: 'It changes with the pattern, which is the whole point.',
          work: 'sequential typing only: gap buffer 0 B, piece table 300 pieces\nscattered only:        gap buffer 17.5 MB, piece table 0 B',
          result: 'Neither wins outright; the workload decides.' }
      ],
      answer: 'For 300 sequential keystrokes plus 50 scattered edits on a 1 MB file: a single string ' +
        'moves 367 MB, a gap buffer 17.5 MB (all cursor movement), a rope about 313 KB, and a piece ' +
        'table nothing at all — at the cost of ~700 pieces to walk.'
    }, {
      title: 'Move the edits and watch the ranking invert',
      goal: 'Show that the best text structure depends on where the edits land, not on how many there are.',
      setup: 'A 100 000-character file and 300 single-character insertions — first all at one position, ' +
        'then scattered uniformly through the file. Characters moved or copied is the measure.',
      steps: [
        {
          do: 'Type 300 characters at one position.',
          why: 'This is what a person does: a cursor, and a burst of typing at it.',
          work: 'gap buffer:  100,000 characters moved (all of it opening the gap at load), 2 grows\n' +
            'piece table:       0 moved, 302 pieces\n' +
            'rope:      15,100,014 characters copied, 668 splits, 10 rebuilds',
          result: 'The rope does 151× the work of loading the file, for 300 keystrokes.'
        },
        {
          do: 'Explain the rope\'s number before excusing it.',
          why: 'A structure that loses this badly on the common case needs a reason.',
          work: 'each insert splits the same leaf and copies it\n' +
            '300 inserts into one leaf ⇒ repeated copying of the same neighbourhood\n' +
            'plus 10 rebalances of a spine that keeps growing on one side',
          result: 'Ropes are indexed by position, and 300 edits at one position is their worst case.'
        },
        {
          do: 'Scatter the same 300 insertions.',
          why: 'One parameter changes; nothing else about the workload does.',
          work: 'gap buffer:   9,529,894 characters moved   (95× worse than before)\n' +
            'piece table:          0 moved, 599 pieces\n' +
            'rope:         1,091,224 copied, 0 rebuilds     (14× better than before)',
          result: 'The two structures swapped places on the same edit count.'
        },
        {
          do: 'Say what each number is actually measuring.',
          why: 'The gap buffer is not slow at editing — it is slow at moving the cursor.',
          work: 'gap buffer:  cost ∝ cursor travel — 300 edits, 9,529,894 characters moved\n' +
            'rope:        cost ∝ edits × leaf size — 64-character leaves, split 668 times\n' +
            'piece table: cost ∝ pieces — 599 of them, walked on every read',
          result: 'Three structures, three different quantities on the bill.'
        },
        {
          do: 'Price the piece table\'s hidden cost.',
          why: 'It moved nothing in both runs, which should be suspicious.',
          work: '599 pieces after the scattered run\n' +
            'a full read walks all 599; a positional lookup is O(pieces) without an index\n' +
            'compaction is what keeps that bounded — the same rule as M03\'s ordered map',
          result: 'It moved no characters because it moved the cost to reads.'
        }
      ],
      answer: 'The same 300 insertions: at one position the gap buffer moves 100 000 characters and ' +
        'the rope copies 15 100 014; scattered, the gap buffer moves 9 529 894 and the rope copies ' +
        '1 091 224. The piece table moves nothing either way and pays instead with 599 pieces for ' +
        'every read to walk.'
    }],

    'cache-layouts': [{
      title: 'Predict the cache misses of three search layouts',
      goal: 'Show that the layout, not the comparison count, decides the memory traffic.',
      setup: '65,536 four-byte keys (256 KB), 64-byte lines, a 32 KB fully associative cache, and a ' +
        'stream of random lookups so the cache is warm.',
      steps: [
        { do: 'Count the comparisons.', why: 'This is the number the algorithm is usually judged on.',
          work: 'log2(65,536) = 16 comparisons for both binary searches',
          result: '16 comparisons, and the layout does not change it.' },
        { do: 'Count the distinct lines one query touches.', why: 'This is the number people reach for next - and it barely moves.',
          work: 'sorted:    16 probes, the last 4 land within one 64-byte line => 16 - 4 + 1 = 13\neytzinger: 16 probes, the top 4 levels share one line     => 16 - 4 + 1 = 13',
          result: 'Both about 13. Measured over 400 queries: 11.9 and 12.0 - identical for practical purposes.' },
        { do: 'Work out how much of the sorted array stays resident.', why: 'Level k of a binary search has 2^k distinct probe addresses, one per line.',
          work: 'lines held by levels 0..k = 2^(k+1) - 1\n2^(k+1) - 1 <= 512 lines  =>  k <= 8, so 9 levels are resident\nmisses = 13 - 9 = 4 per query',
          result: 'About 4 misses. Measured: 4.33.' },
        { do: 'Do the same for the Eytzinger layout.', why: 'Level k is 2^k contiguous keys, so it costs 2^k / 16 lines, not 2^k.',
          work: 'lines held by levels 0..k = 2^(k+1) / 16 = 2^(k-3)\n2^(k-3) <= 512  =>  k <= 12, so 13 levels are resident\nthose 13 levels are probed through 1 + 9 = 10 distinct lines\nmisses = 13 - 10 = 3 per query',
          result: 'About 3 misses. Measured: 3.46 - a 1.25x saving, not the 2x the folklore promises.' },
        { do: 'Do the same for the blocked layout.', why: 'Its separator array is a level of a B-tree, and it is small enough to live in cache outright.',
          work: 'blocks = 65,536 / 16 = 4,096, so the separators are 4,096 x 4 B = 16 KB\n16 KB < 32 KB, so the entire separator level stays resident\nmisses = 0 (separators) + 1 (the one block) = 1 per query',
          result: 'About 1 miss. Measured: 1.57, the excess being cold start.' },
        { do: 'State the conclusion in the right unit.', why: 'Two of the three numbers refused to move; only one of them is the cost.',
          work: 'comparisons:    15.0, 15.0, 20.8   (16 is the bound; hits stop early)\ndistinct lines: 11.9, 12.0,  9.0\nmisses:          4.33, 3.46, 1.57',
          result: 'A 2.8x reduction in memory traffic from rearranging the same keys.' }
      ],
      answer: 'Comparisons and distinct lines are nearly identical across the three layouts; misses ' +
        'against a 32 KB cache are 4.33, 3.46 and 1.57 per query, so the blocked layout moves 2.8x ' +
        'less memory for exactly the same answers. Below the cache size all three tie.'
    }, {
      title: 'Find the size where the clever layout starts paying',
      goal: 'Measure the crossover instead of assuming the better layout is always better.',
      setup: 'The same three layouts — sorted, Eytzinger and blocked — over a 32 KiB cache with ' +
        '64-byte lines, at four array sizes, 500 random queries each.',
      steps: [
        {
          do: 'Measure with the array inside the cache.',
          why: 'If the whole structure is resident, layout cannot matter — and should not.',
          work: 'n = 1,024 (4 KiB):  sorted 0.128 · eytzinger 0.128 · blocked 0.136 misses/query',
          result: 'All three tie, and the blocked layout is very slightly worse.'
        },
        {
          do: 'Grow to half the cache, then to twice it.',
          why: 'The advantage should appear exactly where the structure stops fitting.',
          work: 'n =  4,096 (16 KiB): 0.504 · 0.464 · 0.456\n' +
            'n = 16,384 (64 KiB): 1.926 · 1.370 · 0.924',
          result: 'At 2× the cache the blocked layout is already 2.1× better than sorted.'
        },
        {
          do: 'Go to eight times the cache.',
          why: 'This is where the section\'s headline number comes from.',
          work: 'n = 65,536 (256 KiB): sorted 4.472 · eytzinger 3.452 · blocked 1.478\n' +
            'blocked against sorted: 3.0×',
          result: 'The ranking is stable once the structure is comfortably larger than the cache.'
        },
        {
          do: 'Charge the blocked layout for what it costs.',
          why: 'It wins on misses by doing more work per query, and both are measured.',
          work: 'comparisons per query: sorted 15.03 · eytzinger 15.03 · blocked 20.86\n' +
            '39% more comparisons, 3.0× fewer misses\n' +
            'a miss is worth roughly 80 comparisons at DRAM latency',
          result: 'It trades a cheap operation for an expensive one, which is the whole idea.'
        },
        {
          do: 'State the rule the table supports.',
          why: 'Layout advice without a size is advice about somebody else\'s data.',
          work: 'structure ≤ cache          ⇒ any layout, pick the simplest\n' +
            'structure ≈ 2× cache      ⇒ blocked already 2.1× ahead\n' +
            'structure ≫ cache         ⇒ blocked 3.0× ahead and widening',
          result: 'Below the cache size, the simplest layout is the right one.'
        }
      ],
      answer: 'At n = 1 024 the three layouts cost 0.128, 0.128 and 0.136 misses per query — the ' +
        'blocked one is worse. At n = 65 536 they cost 4.472, 3.452 and 1.478, and the blocked layout ' +
        'is 3.0× better while doing 39% more comparisons. The crossover is the cache size, and it is ' +
        'the only number in the argument.'
    }]
  });
}(typeof window !== 'undefined' ? window : null));
