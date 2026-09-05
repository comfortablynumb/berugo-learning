/**
 * Concepts for the linear-structures sections (M02.1-M02.5): memory layout,
 * dynamic arrays, linked lists, stacks and queues.
 *
 * The buffer-and-allocator half (M02.6-M02.9) lives in
 * concepts-linear-buffers.js, because one file for the whole milestone runs
 * past the 1 000-line limit once every concept carries its explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'memory-layout': [
      {
        term: 'Stride',
        plain: 'The distance in bytes between consecutive elements. Indexing is base + i × stride.',
        formal: 'address(i) = base + i · stride',
        readAs: 'The address of element i is where the array starts, plus i lots of the element size. One ' +
          'multiply and one add, whatever i is — which is why an array index costs the same at position ' +
          '0 and at position a million.',
        detail: [
          'Stride, not element size, is what indexing multiplies by, and the two differ whenever ' +
            'padding is involved. A record whose fields add up to 21 bytes but which must be ' +
            '8-byte aligned has a stride of 24.',
          'Every cost that scales with the array scales with the stride: bytes fetched, lines ' +
            'touched, prefetcher effectiveness. Shrinking it is usually the cheapest performance ' +
            'win available on a hot scan.',
          'It is also the number to reach for when a traversal is slower than the data volume ' +
            'suggests. Multiply the element count by the stride, and compare that against what ' +
            'you thought you were reading.'
        ],
        example: 'A 24-byte record gives a stride of 24, not the 21 bytes its fields use.'
      },
      {
        term: 'Alignment',
        plain: 'A value of width w must sit at an address divisible by w, or the hardware pays for it.',
        formal: 'address mod sizeof(T) = 0',
        readAs: 'An address is correctly aligned when dividing it by the size of the type leaves no remainder ' +
          '— that is what "mod … = 0" says. A 4-byte value belongs at an address divisible by 4.',
        detail: [
          'Memory is fetched in aligned blocks, so a value that straddles a boundary needs two ' +
            'accesses and a merge — on the architectures that allow it at all.',
          'Compilers therefore place each field at an offset divisible by its own width, ' +
            'inserting whatever padding that requires. The rule cascades: the record itself is ' +
            'aligned to its widest member, so that element 1 of an array lands correctly too.',
          'This is why field order changes a structure\'s size without changing its contents. It ' +
            'is also why a typed array in JavaScript refuses a byte offset that is not a multiple ' +
            'of its element size.'
        ],
        example: 'An f64 after a u8 starts at offset 8, not 1.'
      },
      {
        term: 'Padding',
        plain: 'The bytes the compiler inserts to satisfy alignment. Reordering fields removes most of it.',
        formal: 'stride − Σ field sizes',
        readAs: 'Padding is the gap: take the space one record actually occupies and subtract the total of ' +
          'the field sizes you asked for. The Σ just means "add all the field sizes up".',
        detail: [
          'Padding appears in two places: between fields, to align the next one, and at the end ' +
            'of the record, to keep the following element aligned.',
          'Declaration order decides how much you get, and the pathological order is ' +
            'small-large-small. A record of {u8, f64, u8} pays 7 bytes of internal padding and 7 ' +
            'more of tail padding, for 10 bytes of data and a 24-byte stride.',
          'Sorting the fields by descending alignment packs the small ones together and brings ' +
            'the same data down to 16 bytes.',
          'Nothing about the access pattern changes. The array is simply a third smaller, and so ' +
            'is the traffic to scan it.'
        ],
        example: '{u8, f64, u8} costs 24 bytes; {f64, u8, u8} costs 16.'
      },
      {
        term: 'Array of structs (AoS)',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["array of structs<br/>x y z · x y z · x y z"] --> B["one record is contiguous"]',
            '    B --> C["good when you use most fields<br/>of one record at a time"]',
            '    D["struct of arrays<br/>x x x · y y y · z z z"] --> E["one field is contiguous"]',
            '    E --> F["good when you scan one field<br/>across many records"]'
          ].join('\n'),
          caption: 'Same data, same total bytes. The layout decides which of the two access patterns gets full cache lines and which gets one useful value per line.'
        },
        plain: 'Records stored whole, one after another. Good when you use most fields of one record.',
        formal: 'record i occupies [i·stride, (i+1)·stride)',
        readAs: 'Record i runs from i times the stride up to, but not including, the next multiple. The ' +
          'square bracket includes its endpoint and the round bracket excludes it, so consecutive ' +
          'records touch without ever overlapping by a byte.',
        detail: [
          'AoS is the layout every language gives you by default, and it is the right one when ' +
            'the unit of work is a whole record. Everything about record i arrives in the same ' +
            'line or two, so a lookup that reads several fields pays for one fetch.',
          'It is the wrong one when the unit of work is a field, because the cache has no way to ' +
            'fetch only the part you want. Reading one 4-byte field of a 24-byte record drags the ' +
            'other 20 bytes along on every element.',
          'The cost is exactly the ratio of the record to the field you wanted, and it shows up ' +
            'as memory bandwidth, not as instructions.'
        ],
        example: 'Reading one field of every record drags all the others through cache.'
      },
      {
        term: 'Struct of arrays (SoA)',
        plain: 'Each field stored contiguously. Good when you scan one field across many records.',
        formal: 'field f of record i at base_f + i · sizeof(f)',
        readAs: 'In a struct-of-arrays layout each field has its own base address, and record i sits i ' +
          'field-widths along from it. So one field of every record is contiguous, rather than every ' +
          'field of one record.',
        detail: [
          'SoA transposes the layout: one array per field, indexed in parallel.',
          'A scan over a single field then reads a dense run of bytes. Every byte fetched is ' +
            'used, the prefetcher sees a unit stride, and the loop is trivially vectorisable.',
          'The price is paid by record-at-a-time access, which now touches one line per field and ' +
            'can be several times slower than AoS for the same work. It also loses the natural ' +
            'object to pass around.',
          'Neither layout is better in general. This is the clearest case in the track of a ' +
            'choice decided by the access pattern rather than by the data.'
        ],
        example: 'Summing scores reads only the scores column.'
      },
      {
        term: 'Cache line',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["you read 1 byte"] --> B["the hardware fetches<br/>the whole 64-byte line"]',
            '    B --> C{"is the next thing you need<br/>inside that same line?"}',
            '    C -->|yes| D["free — it is already there"]',
            '    C -->|no| E["another full line fetched<br/>from scratch"]'
          ].join('\n'),
          caption: 'Memory is not sold by the byte. Cost is lines touched, which is why the same number of operations can differ tenfold in time.'
        },
        plain: 'Memory moves in 64-byte lines, so touching one byte costs the whole line.',
        formal: 'line = ⌊address / 64⌋',
        readAs: 'Which cache line an address falls in is the address divided by 64, rounded down — the floor ' +
          'bars are that rounding. Every address in the same line shares one number, which is why ' +
          'touching either end of a line costs the same.',
        detail: [
          'The line is the unit of transfer between every level of the hierarchy. The cost of a ' +
            'read is decided by which line it falls in, rather than by how many bytes you asked ' +
            'for.',
          'Efficiency is therefore the fraction of each fetched line the program actually uses ' +
            'before it is evicted. A dense int32 scan uses 16 values out of 16.',
          'A strided access that takes one value per line uses 4 bytes out of 64, and wastes 94% ' +
            'of the bandwidth it consumed.',
          'Both loops execute the same number of instructions, which is why this cost is ' +
            'invisible in an operation count.'
        ],
        example: 'A 4-byte read with a 64-byte stride wastes 94% of each line.'
      },
      {
        term: 'Field reordering',
        plain: 'Declaring the widest fields first removes most padding without changing a single access.',
        formal: 'sort fields by descending alignment',
        detail: [
          'Sorting fields from widest to narrowest is close to optimal for padding. Each field ' +
            'then lands at an offset that is already a multiple of its own alignment, and the ' +
            'narrow ones fill the tail.',
          'It is the rare optimisation with no downside at all: no call site changes, no code ' +
            'changes, identical semantics, and a smaller structure. The M02 record drops from a ' +
            '24-byte stride to 16, a third less traffic for every scan.',
          'The reason it is not automatic is that C and C++ guarantee declaration order for ' +
            'layout compatibility. Languages without that constraint, like Rust, reorder for you.'
        ],
        example: 'The M02 record drops from a 24-byte stride to 16 — a third of the traffic, for free.'
      },
      {
        term: 'Hot and cold splitting',
        plain: 'Move the fields a hot loop never reads into a second structure, so the line carries only what the loop uses.',
        formal: 'struct Hot { … } and struct Cold { … } joined by index',
        detail: [
          'Reordering removes padding but not unused fields, and the fields a hot loop ignores ' +
            'cost exactly as much bandwidth as the ones it reads.',
          'Split the record in two: the fields the loop touches in one array, everything else in ' +
            'a parallel array joined by index. The hot part is then packed densely, so each line ' +
            'carries several times more useful elements.',
          'A scan reading one 8-byte field of a 24-byte record wastes two thirds of every line; ' +
            'splitting recovers that.',
          'The cost is a second lookup whenever cold data is needed, and an invariant to ' +
            'maintain: the two arrays must stay the same length and the same order.'
        ],
        example: 'A scan that reads one 8-byte field of a 24-byte record wastes two thirds of every line it fetches.'
      }
    ],

    'dynamic-arrays': [
      {
        term: 'Capacity versus length',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["capacity — what was allocated"] --> C["the gap between them<br/>is the growth headroom"]',
            '    B["length — what you actually stored"] --> C',
            '    C --> D["append is free while headroom lasts"]',
            '    D --> E["headroom runs out:<br/>allocate bigger, copy everything, free"]'
          ].join('\n'),
          caption: 'Every append is O(1) except the ones that are not. The gap is what buys the cheap appends, and the price is the memory it wastes.'
        },
        plain: 'Length is what you stored; capacity is what was allocated. The gap is the growth headroom.',
        formal: 'length ≤ capacity',
        detail: [
          'A dynamic array is a fixed allocation plus a count of how much of it is in use. Nearly ' +
            'everything interesting is in the gap between the two.',
          'The gap is what makes appends cheap, because there is somewhere to write without ' +
            'asking the allocator. It is also memory you are holding and not using, typically up ' +
            'to half the allocation with a doubling policy.',
          'Keeping the distinction sharp matters because the two numbers answer different ' +
            'questions. Length decides iteration and bounds checks; capacity decides how much ' +
            'memory the process is actually holding, and when the next copy happens.'
        ],
        example: 'A 1000-element array with factor 2 typically holds 1024 slots.'
      },
      {
        term: 'Growth factor',
        plain: 'How much bigger the new allocation is. It sets total copies and wasted space.',
        formal: 'capacity ← ⌈capacity · r⌉',
        readAs: 'On a grow, the new capacity is the old one multiplied by the growth factor r and rounded up ' +
          'to a whole number. The left arrow is assignment — plain `=` in JavaScript.',
        detail: [
          'The factor trades copying against waste, and both sides are geometric. A larger factor ' +
            'means fewer reallocations and more slack; a smaller one means the reverse.',
          'Total copying over n pushes is about n/(r − 1) elements, so doubling copies roughly n ' +
            'and 1.5× copies roughly 2n. That is a real difference, but a constant factor either ' +
            'way, which is why both are defensible.',
          'The subtler argument is about allocator reuse. With r = 2 the sum of every previously ' +
            'freed block is always one element short of the next request, so those blocks can ' +
            'never be recycled.',
          'Any factor below the golden ratio eventually lets the allocator reuse them.'
        ],
        example: 'r = 2 copies about n elements over n pushes; r = 1.5 copies about 2n.'
      },
      {
        term: 'Reallocation',
        plain: 'Allocate, copy everything, free. The one operation that is not O(1).',
        formal: 'cost = current length',
        detail: [
          'When the array fills, a new block is allocated, every existing element is copied and ' +
            'the old block is released. That is work proportional to the current length, in one ' +
            'operation.',
          'Amortised analysis is what makes this acceptable on average, but the individual event ' +
            'is real and it lands unpredictably. Growing at a million elements copies a million ' +
            'elements inside a single push, which is a latency spike rather than a slow average.',
          'It is also where the memory high-water mark lives, since old and new blocks are ' +
            'briefly alive together. A doubling array momentarily needs three times the payload ' +
            'it ends up holding.'
        ],
        example: 'Growing at 1M elements copies 1M elements in one push.'
      },
      {
        term: 'Shift cost',
        plain: 'Inserting at position p moves the n − p elements after it. Append moves none.',
        formal: 'moved = n − p',
        readAs: 'Inserting at position p in an array of n items shifts everything after p along by one, so ' +
          'the number of elements moved is n minus p. At the front that is all of them; at the end it ' +
          'is none.',
        detail: [
          'Contiguity is what makes indexing free, and the price is that inserting anywhere but ' +
            'the end has to make room by moving everything after it.',
          'Position decides the cost completely. Appending moves nothing, inserting in the middle ' +
            'moves n/2 elements and inserting at the front moves all n. The same holds for ' +
            'removal.',
          'This is the cost that hides behind a uniform API: insert and push look alike and ' +
            'differ by a factor of n.',
          'It is why front-insertion into a large array is one of the most common accidental ' +
            'quadratic loops in production code.'
        ],
        example: 'Front insertion into 100k elements moves 100k every time.'
      },
      {
        term: 'Small-buffer optimisation',
        plain: 'Keep a few elements inline in the object so short arrays never allocate.',
        formal: 'inline capacity k, heap beyond it',
        detail: [
          'Most collections in real programs are tiny, and for those the allocation dominates ' +
            'everything else the container does.',
          'A small-buffer optimisation reserves room for k elements inside the object itself. A ' +
            'short array then costs no allocation, no pointer indirection and no separate cache ' +
            'line, spilling to the heap only when it outgrows the inline capacity.',
          'The costs are that the object grows for everyone, and that moving it must branch on ' +
            'whether the data is inline or out.',
          'References into an inline buffer are also invalidated by the move, which is why ' +
            'languages that guarantee stable addresses cannot offer it.'
        ],
        example: 'Most strings in a compiler are under 16 characters.'
      },
      {
        term: 'Swap-remove',
        plain: 'Overwrite the hole with the last element instead of shifting. Θ(1), and it destroys the order.',
        formal: 'a[i] = a[n − 1]; n -= 1',
        readAs: 'To remove element i without shifting anything, copy the last element over it and shorten the ' +
          'array by one. It costs two operations instead of n — and it changes the order, which is the ' +
          'whole trade.',
        detail: [
          'If the order of the array does not carry meaning, removal does not need to shift ' +
            'anything. Move the last element into the hole and shorten the array.',
          'That converts a Θ(n) operation into two writes, and the difference is not academic. ' +
            'Removing 100 000 elements from a million-element array costs 100 000 moves instead ' +
            'of about 5 × 10¹⁰.',
          'The condition is the whole story, though. Any index held elsewhere into the moved ' +
            'element is now wrong, and any sorted or insertion-ordered invariant is gone.',
          'Structures that use it, like entity lists in game engines, generally pair it with an ' +
            'index that gets patched on the move.'
        ],
        example: '100 000 removals from a million-element array: 100 000 moves instead of 5 × 10¹⁰.'
      },
      {
        term: 'Reserve',
        plain: 'Ask for the capacity up front when the size is known. It removes every reallocation, not most of them.',
        formal: 'reserve(n) before the loop',
        detail: [
          'Growth exists because the final size is unknown. Sometimes you do know it: a query ' +
            'that reports its row count, a file whose length you can stat, a map over a ' +
            'collection of known length.',
          'Reserving then turns the whole geometric series of copies into a single allocation. ' +
            'Pushing a million known elements does about twenty reallocations without it and none ' +
            'with it.',
          'It also removes the transient double-allocation peak and any reference invalidation ' +
            'along the way.',
          'It is one of the highest-value single-line changes in hot code, and it is safe: ' +
            'reserving does not change length, only capacity.'
        ],
        example: 'Pushing a million known elements does 20 reallocations without it and none with it.'
      },
      {
        term: 'Reference invalidation',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["you hold a pointer into the array"] --> B["someone appends"]',
            '    B --> C["the array reallocates and<br/>moves to a new address"]',
            '    C --> D["your pointer now aims at freed memory"]',
            '    D --> E["an index survives the move;<br/>a pointer or an iterator does not"]'
          ].join('\n'),
          caption: 'This is the cost of contiguity, and it is why growable arrays hand out indices rather than addresses.'
        },
        plain: 'A reallocation moves the whole array, so every pointer, index-held reference and iterator into it is stale.',
        formal: 'growth invalidates references, not indices',
        detail: [
          'Growth allocates a new block and copies, which means every element has a new address. ' +
            'Anything remembering the old one is now pointing at freed memory.',
          'Indices survive, because they are relative to the base; pointers, iterators and slices ' +
            'do not.',
          'This is why languages with real references make it a type-system matter, and why in ' +
            'C++ it is a documented per-operation contract rather than an implementation detail.',
          'Sometimes addresses genuinely have to outlive the container — an LRU list whose hash ' +
            'map points at nodes, an object graph. The answer is then a structure that does not ' +
            'move its elements: an intrusive list, a stable arena, or a deque of fixed blocks.'
        ],
        example: 'This is why an intrusive list or a stable arena is used when addresses have to outlive the container.'
      }
    ],

    'linked-lists': [
      {
        term: 'Node overhead',
        plain: 'Every element carries at least one pointer, and usually an allocation header too.',
        formal: 'bytes per element = payload + pointer(s) + header',
        detail: 'A list element is never just its payload. A singly linked node adds one pointer, a ' +
          'doubly linked one adds two, and a separately allocated node also carries the allocator\'s ' +
          'header and is rounded up to a size class. For a 4-byte integer on a 64-bit machine that ' +
          'is easily 32 bytes per element against the 4 an array uses — eight times the memory, and ' +
          'therefore eight times the cache lines to walk the same data. Before any discussion of ' +
          'asymptotics, this factor alone decides most array-versus-list questions in favour of the ' +
          'array.',
        example: 'A list of 4-byte integers can cost 32 bytes per element.'
      },
      {
        term: 'Pointer chasing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["read node 1"] --> B["only now is the address<br/>of node 2 known"]',
            '    B --> C["read node 2"]',
            '    C --> D["only now is the address<br/>of node 3 known"]',
            '    D --> E["the machine cannot prefetch<br/>what it cannot predict"]'
          ].join('\n'),
          caption: 'An array lets the processor fetch ahead because it knows where the next element is. A list makes every step depend on the answer to the last one.'
        },
        plain: 'The address of the next element is only known after reading the current one, so nothing can be prefetched.',
        formal: 'load depends on the previous load',
        detail: 'Modern processors hide memory latency by having many loads in flight at once, which ' +
          'requires knowing the addresses in advance. A linked traversal defeats that completely: ' +
          'the address of node i + 1 is stored inside node i, so each load must complete before the ' +
          'next can even be issued. The misses serialise into a dependent chain, and the cost is the ' +
          'full latency of every one of them rather than their throughput. An array walk has the ' +
          'opposite property — every address is computable immediately, so the prefetcher runs ahead ' +
          'and the misses overlap.',
        example: 'A scattered list walk is a dependent-load chain, one cache miss deep each.'
      },
      {
        term: 'Misses, not lines',
        plain: 'A single traversal touches every line holding a node exactly once, whichever order the nodes sit in.',
        formal: 'distinct lines is layout-independent for one pass',
        detail: 'It is tempting to measure a layout by how many distinct cache lines it touches, and ' +
          'for one full pass that measure is blind: every node has to be visited once, so every line ' +
          'holding a node is fetched once whatever the arrangement. What separates a compact list ' +
          'from a scattered one is residency — whether the lines already fetched are still there ' +
          'when the walk returns to them, and how much of each line the walk uses. That is why the ' +
          'simulator in this section counts misses against a bounded LRU cache, and why the ' +
          'scattered walk costs about seven times more only once the list outgrows that cache.',
        example: 'The scattered walk costs 7× more only once the list outgrows the cache.'
      },
      {
        term: 'Intrusive list',
        plain: 'The link fields live inside the element, so linking costs no allocation.',
        formal: 'struct { data; next; } embedded in the object',
        detail: 'An intrusive list puts the next and prev fields inside the element rather than in a ' +
          'separate node that points at it. That removes the second allocation, the second ' +
          'indirection and the header, and it makes linking and unlinking infallible — there is no ' +
          'allocation to fail, which is exactly why kernels use them in paths that cannot return an ' +
          'error. It also lets one object belong to several lists at once by carrying several link ' +
          'fields. The trade is that the element type has to know it may be listed, so the container ' +
          'is no longer generic over types it did not anticipate.',
        example: 'Kernel lists work this way; it is why lists survive there.'
      },
      {
        term: 'Sentinel node',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["without a sentinel:<br/>is the list empty?<br/>is this the head?<br/>is this the tail?"] --> B["three special cases in every operation"]',
            '    C["with a dummy node at each end"] --> D["every real node has a<br/>previous and a next, always"]',
            '    D --> E["insert and remove become<br/>one branchless case"]'
          ].join('\n'),
          caption: 'The dummy node costs one allocation and removes the branches where linked-list bugs actually live.'
        },
        plain: 'A dummy head or tail that removes the empty-list and end-of-list special cases.',
        formal: 'always at least one node',
        detail: 'Most of the bugs in hand-written list code live in the boundary cases: inserting ' +
          'into an empty list, removing the only element, removing the head. A sentinel — a ' +
          'permanent node that holds no data — makes those cases disappear by guaranteeing every ' +
          'real node has both a predecessor and a successor, so insertion and removal are the same ' +
          'few pointer writes everywhere. With a circular sentinel there are no null checks at all. ' +
          'The cost is one node\'s worth of memory and remembering that the sentinel is not an ' +
          'element, which iteration and length must both respect.',
        example: 'Insertion needs no null check when a sentinel is present.'
      },
      {
        term: 'Cycle detection',
        plain: 'Brent\'s algorithm finds a loop with one pointer and a doubling step limit, and reports its length.',
        formal: 'power-of-two teleport plus a scan',
        detail: 'A corrupted list can contain a cycle, and a traversal that meets one simply never ' +
          'ends. Brent\'s algorithm detects it by keeping one saved node and walking forward, ' +
          'doubling the distance before saving again: if the walker meets the saved node within the ' +
          'current limit, that limit is the cycle length. It uses one moving pointer rather than ' +
          'the tortoise and hare\'s two, so it does fewer node visits, and it hands back the cycle ' +
          'length directly instead of needing a second phase. Either way the point is the same: a ' +
          'structure that can be corrupted needs a bounded traversal, not a hopeful one.',
        example: 'Used to detect a corrupted list before it hangs a traversal.'
      },
      {
        term: 'Splice',
        plain: 'Move a node, or a whole run of nodes, between lists by rewriting a fixed number of links.',
        formal: '6 pointer writes, independent of the list length',
        detail: 'Splicing is the operation lists are actually for. Moving a node — or an entire run ' +
          'of nodes — to another position costs six pointer writes regardless of how much data is ' +
          'involved, because nothing is copied and nothing after it shifts. An array doing the same ' +
          'thing moves elements. The canonical use is an LRU cache: a hit moves a node to the front ' +
          'for six writes, against roughly n/2 element moves in an array, and the node keeps its ' +
          'address so the hash map pointing at it stays valid. Splicing whole ranges in O(1) is also ' +
          'why lists back merge-based sorts that must not allocate.',
        example: 'LRU move-to-front: 6 writes per hit, against roughly n/2 element moves in an array.'
      },
      {
        term: 'Stable addresses',
        plain: 'A node stays where it was allocated, so anything else may hold a pointer to it. Arrays do not offer this.',
        formal: 'insertion and removal do not move other nodes',
        detail: 'Every node is allocated once and never moved, so a pointer to it stays valid for as ' +
          'long as the node lives, whatever happens to the rest of the list. That is a property an ' +
          'array cannot offer at any price, since growth relocates everything. It is what allows ' +
          'another structure to index into the list from outside — an LRU cache is exactly a hash ' +
          'map from key to list node, and the design only works because the node never moves. When ' +
          'you see a list in code that would otherwise obviously be an array, stable addresses are ' +
          'usually the reason.',
        example: 'An LRU cache keeps a hash map from key to node — only possible because the node never moves.'
      },
      {
        term: 'Unrolled list',
        plain: 'Store a small array in each node. It buys back most of the locality and keeps most of the splice.',
        formal: 'k elements per node ⇒ n/k pointer follows',
        readAs: 'Pack k items into each node and you follow n divided by k pointers instead of n. The ⇒ is ' +
          '"which means": the pointer chasing falls by exactly the factor you packed.',
        detail: 'An unrolled list keeps a small array of k elements in each node, which is the ' +
          'obvious middle point between the two structures and is closer to optimal than either for ' +
          'many workloads. Pointer follows drop by a factor of k, the per-element pointer overhead ' +
          'drops by the same factor, and the elements inside a node are contiguous so a scan gets ' +
          'array-like locality — with k = 16 a traversal touches a sixteenth of the lines. Splices ' +
          'still rewrite a constant number of links, though insertion inside a full node now has to ' +
          'split it, and nodes are only partly full, so some space is traded back.',
        example: 'With k = 16 the scan touches a sixteenth of the lines and a splice still rewrites a constant number of links.'
      }
    ],

    'stacks-and-frames': [
      {
        term: 'Stack frame',
        plain: 'The block a call pushes: return address, saved registers and locals.',
        formal: 'frame size fixed per function',
        detail: 'A call allocates a frame by subtracting from the stack pointer, and that frame holds ' +
          'the return address, whichever registers the callee must preserve, the local variables ' +
          'that could not stay in registers, and any padding the ABI requires. The size is fixed per ' +
          'function at compile time, so it can be reasoned about statically — about 96 bytes for a ' +
          'small function with a few locals is a reasonable working figure. Allocation and ' +
          'deallocation are a single arithmetic instruction each, which is why stack memory is ' +
          'effectively free and why the total is the only thing worth worrying about.',
        example: 'About 96 bytes for a small function with a few locals.'
      },
      {
        term: 'Recursion depth',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["each call pushes a frame:<br/>return address, saved registers, locals"] --> B["depth × frame size = memory used"]',
            '    B --> C["charged to the stack, which you<br/>never sized and cannot grow"]',
            '    C --> D["so this fails on inputs the heap<br/>would have held easily"]'
          ].join('\n'),
          caption: 'Recursion depth is memory spent on a region you did not choose the size of, and it is far smaller than the heap you were thinking about.'
        },
        plain: 'How many frames are live at once. It is memory, on a region you did not size.',
        formal: 'peak frames × frame size',
        detail: 'Depth is the number of frames simultaneously alive, and multiplying it by the frame ' +
          'size gives a real memory figure — depth 10 000 at 96 bytes is roughly 1 MB. The reason ' +
          'this deserves separate attention from heap use is that the stack was sized once, when the ' +
          'thread was created, and cannot grow. So the relevant question about a recursive algorithm ' +
          'is not whether it recurses but what bounds its depth: a balanced tree bounds it at ' +
          'log n, quicksort on the smaller side bounds it at log n, and recursion driven by input ' +
          'structure has no bound at all until you impose one.',
        example: 'Depth 10 000 at 96 bytes is roughly 1 MB of stack.'
      },
      {
        term: 'Stack overflow',
        plain: 'The stack hits its guard page and the process (or the engine) stops you.',
        formal: 'depth × frame size > stack limit',
        detail: 'The stack is backed by a fixed region with an unmapped guard page below it, so ' +
          'running past the end faults rather than corrupting whatever is next — in a native program ' +
          'that is a crash, and in JavaScript the engine raises a RangeError instead. Two things ' +
          'make this failure mode nasty: it depends on input shape rather than input size, so a ' +
          'degenerate tree overflows where a balanced one of the same node count recurses twenty ' +
          'deep, and the limit varies by engine, thread and platform, so it reproduces unreliably. ' +
          'It is a structural bug, and the fixes are structural: bound the depth, or stop recursing.',
        example: 'A degenerate tree overflows where a balanced one recurses 20 deep.'
      },
      {
        term: 'Explicit stack',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["recursive version:<br/>frames on the call stack"] --> B["depth limited by the engine"]',
            '    C["explicit version:<br/>the same frames in a heap array"] --> D["depth limited by memory you control"]',
            '    D --> E["identical traversal order —<br/>you moved where the frames live"]'
          ].join('\n'),
          caption: 'This is not a rewrite of the algorithm. It is the same algorithm with its stack moved somewhere you can size and inspect.'
        },
        plain: 'Moving the frames to a heap array: same order, and a bound you control.',
        formal: 'push/pop on an array instead of calling',
        detail: 'Any recursion can be rewritten as a loop over an explicit stack of pending work, and ' +
          'the rewrite changes where the memory comes from: the heap, which is large and growable, ' +
          'instead of the stack, which is neither. It also lets you store only what is genuinely ' +
          'needed — an iterative in-order traversal keeps node indices, not whole frames with saved ' +
          'registers — so the per-item cost drops by an order of magnitude. And because the stack is ' +
          'now an ordinary data structure, its depth is inspectable and its limit is yours to ' +
          'choose, which turns an engine-level crash into a condition you can handle.',
        example: 'An iterative in-order traversal holds only indices.'
      },
      {
        term: 'Tail call',
        plain: 'A call in return position can reuse the current frame, if the language guarantees it.',
        formal: 'return f(x) reuses the frame',
        detail: 'When a call is the last thing a function does, the caller\'s frame has no remaining ' +
          'use, so an implementation is free to reuse it and turn the call into a jump — recursion ' +
          'in constant stack space. The catch is entirely about guarantees: Scheme and Lua require ' +
          'it, so recursion is a legitimate looping construct there. ECMAScript specified it in ES6 ' +
          'and, apart from JavaScriptCore, engines have not shipped it, so in practice a tail call ' +
          'in JavaScript consumes a frame like any other. Writing code that depends on an ' +
          'optimisation the runtime does not promise is how a deep recursion works in testing and ' +
          'overflows in production.',
        example: 'Guaranteed in some languages; not in JavaScript engines in practice.'
      },
      {
        term: 'Frame budget',
        plain: 'The stack size divided by the frame size. It is fixed before your code runs, and it is small.',
        formal: '1 MiB / 96 B = 10 922 frames',
        readAs: 'A one-mebibyte stack divided by a 96-byte frame gives about eleven thousand nested calls ' +
          'before it overflows. A mebibyte is 1 048 576 bytes.',
        detail: 'Dividing the stack you were given by the size of one frame turns a vague worry into ' +
          'a number: 1 MiB at 96 bytes per frame is 10 922 frames, and that is the entire depth ' +
          'budget for the thread. It is small compared with the data sizes people happily recurse ' +
          'over, which is why a degenerate structure of 11 000 nodes overflows. The comparison that ' +
          'makes the point is what the same traversal costs on the heap: 11 000 node indices is ' +
          '88 kB, an eighth of the stack, on a region that can grow. Compute the budget before ' +
          'choosing recursion, not after the crash report.',
        example: 'A degenerate tree of 11 000 nodes overflows; the same 11 000 nodes cost 88 kB on an explicit stack.'
      },
      {
        term: 'Guard depth',
        plain: 'A depth limit only protects you if it is below the engine’s real limit — above it, the engine throws first.',
        formal: 'maxDepth < engine limit',
        detail: 'Adding a depth check is the standard defence against runaway recursion, and it is ' +
          'worthless if the number is chosen by intuition. A guard of 20 000 in an engine that dies ' +
          'at about 11 000 never fires: the engine throws first, which is precisely the outcome the ' +
          'guard existed to prevent. The limit has to be derived from the frame budget and set ' +
          'comfortably under it, and it has to be checked before the frame is consumed rather than ' +
          'after. It is also worth measuring rather than assuming, since the real limit varies with ' +
          'the engine, the platform and how much stack the current call chain has already used.',
        example: 'A guard of 20 000 never fires in an engine that dies at about 11 000.'
      },
      {
        term: 'State machine instead of frames',
        plain: 'An explicit stack of what is left to do turns unbounded recursion into bounded heap.',
        formal: 'push the continuation, loop until empty',
        detail: 'The general form of the explicit-stack rewrite is to store what remains to be done ' +
          'rather than where to return to: push the pending work, loop until the stack is empty, and ' +
          'the recursion becomes an ordinary data structure you can size, inspect, checkpoint or ' +
          'resume. The saving can be dramatic when the recursion is lopsided, because a frame is ' +
          'pushed per call while a work item is pushed only per genuinely pending branch — an ' +
          'in-order walk down a right spine of 4 095 nodes needs 4 095 frames recursively and one ' +
          'stack entry iteratively. This is the same transformation compilers apply to async ' +
          'functions and generators.',
        example: 'In-order traversal of a right spine needs 4 095 frames recursively and one stack entry iteratively.'
      }
    ],

    'queues-and-rings': [
      {
        term: 'Ring buffer',
        plain: 'A fixed array where indices wrap around, so a queue needs no allocation at all.',
        formal: 'index ← (index + 1) mod capacity',
        readAs: 'Step the index forward by one, then take the remainder after dividing by the capacity — so ' +
          'the position after the last one is 0 again. That wrap-around is the whole idea of a ring.',
        detail: 'A ring is one preallocated array with a head and a tail index that wrap when they ' +
          'reach the end. Nothing is allocated after construction, nothing is shifted, and both ' +
          'operations are a write plus an index update, so the cost per item is constant and, more ' +
          'importantly, predictable. That predictability is why rings dominate the places where a ' +
          'pause is unacceptable — audio callbacks, network receive paths, kernel logging — and the ' +
          'fixed capacity is a feature there rather than a limitation, because it makes the memory ' +
          'footprint known before the program starts.',
        example: 'Audio, networking and logging buffers are all rings.'
      },
      {
        term: 'Masking',
        plain: 'A power-of-two capacity turns the modulo into a bitwise AND.',
        formal: '(index + 1) & (capacity − 1)',
        readAs: 'When the capacity is a power of two, capacity − 1 is a run of 1 bits, and a bitwise AND ' +
          'against it keeps only the low bits — which is exactly the remainder, computed in one ' +
          'instruction instead of a division.',
        detail: 'Integer division and remainder are among the slowest arithmetic instructions, tens ' +
          'of cycles on many machines, and a naive ring performs one per operation. Choosing a ' +
          'power-of-two capacity replaces it with a bitwise AND against capacity − 1, which is a ' +
          'single-cycle instruction with no branch: capacity 16 becomes & 15. The rounding-up of ' +
          'capacity is almost always worth it, and the technique reappears throughout the ' +
          'curriculum — hash tables mask their slot index the same way, and for the same reason.',
        example: 'Capacity 16 means & 15, which is one instruction.'
      },
      {
        term: 'Full versus empty',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["head equals tail"] --> B["the ring is empty"]',
            '    A --> C["the ring is completely full"]',
            '    C --> D["the same indices mean<br/>two opposite things"]',
            '    D --> E["break the tie: keep a count,<br/>or leave one slot always unused"]'
          ].join('\n'),
          caption: 'A ring buffer\'s one genuine subtlety. Every correct implementation picks one of those two tie-breaks, and the bug is always in the one that picked neither.'
        },
        plain: 'Head equals tail in both states, so an implementation must break the tie.',
        formal: 'waste one slot, or keep a count',
        detail: 'With two indices there are capacity + 1 possible occupancies but only capacity ' +
          'distinct index differences, so full and empty collide: head == tail in both. There are ' +
          'three standard resolutions — waste one slot so full means head is one behind tail, keep ' +
          'an explicit count, or let the indices run unbounded and mask only when indexing. Which ' +
          'you choose matters most in concurrent code: a count is a third shared variable that both ' +
          'sides must update, whereas the wasted slot keeps producer and consumer each writing one ' +
          'index and reading the other, which is what makes a single-producer single-consumer ring ' +
          'lock-free.',
        example: 'Wasting a slot avoids a second shared variable, which matters for lock-free queues.'
      },
      {
        term: 'Bounded queue policy',
        plain: 'What a full queue does: block, reject, or drop the oldest. Each is a different promise.',
        formal: 'block | reject | overwrite',
        detail: 'A bounded queue must decide what happens when it fills, and the three answers are ' +
          'three different systems. Blocking propagates the slowdown to the producer, which is ' +
          'backpressure and is usually right inside a process. Rejecting fails fast and pushes the ' +
          'decision to the caller, which is what a server should do to shed load. Overwriting the ' +
          'oldest keeps the newest data and silently loses history, which is right for a telemetry ' +
          'or sensor stream and catastrophic for a transaction log. The one option that is never ' +
          'right is an unbounded queue, which converts a temporary slowdown into an out-of-memory ' +
          'kill.',
        example: 'Rejecting pushes backpressure upstream; overwriting loses data silently.'
      },
      {
        term: 'Deque',
        plain: 'A queue with both ends open. A ring buffer gives it for the same cost.',
        formal: 'push/pop at head and tail',
        detail: 'A ring already tracks two indices, so allowing pushes and pops at both ends costs ' +
          'nothing extra and yields a double-ended queue — a superset of both stack and queue with ' +
          'the same constant-time operations. That generality is what work-stealing schedulers are ' +
          'built on: the owning thread pushes and pops at one end for locality, while thieves steal ' +
          'from the other end, so the two sides contend only when the deque is nearly empty. A deque ' +
          'is also the natural structure for a sliding-window maximum and for any algorithm that ' +
          'needs to unread an item.',
        example: 'Work-stealing schedulers need exactly this (M47).'
      },
      {
        term: 'Utilisation',
        plain: 'Arrival rate over service rate. Everything about a queue’s behaviour is a function of this one number.',
        formal: 'ρ = λ/μ, stable only while ρ < 1',
        readAs: 'Utilisation (rho) is the arrival rate (lambda) divided by the service rate (mu) — work ' +
          'coming in, over work going out. Below 1 the queue stays finite; at or above 1 it grows ' +
          'without limit, because more arrives than can leave.',
        detail: 'Utilisation is arrival rate divided by service rate, and the queue is stable only ' +
          'while it stays below 1 — at ρ ≥ 1 the backlog grows without limit whatever the capacity. ' +
          'What surprises people is the shape of the approach: queue length goes as ρ/(1 − ρ), so ' +
          'it is not linear in load but hyperbolic. At ρ = 0.833 the queue holds about 5 items; at ' +
          'ρ = 0.99 it holds 99. That is why a system running at 70% capacity feels fine and the ' +
          'same system at 95% feels broken, and why capacity planning targets a utilisation rather ' +
          'than a throughput.',
        example: 'At ρ = 0.833 the queue holds 5 items; at ρ = 0.99 it holds 99.'
      },
      {
        term: 'Little’s law',
        plain: 'Items in the system equal arrival rate times time in the system. It holds for any arrival process at all.',
        formal: 'L = λ·W',
        readAs: 'The number of items in the system equals the arrival rate multiplied by the time each one ' +
          'spends there. It holds for any queue at all, whatever the arrival pattern or service order, ' +
          'which is what makes it so useful.',
        detail: 'Little\'s law says the average number of items in a system equals the arrival rate ' +
          'times the average time each spends there, and its power is how few assumptions it needs: ' +
          'no distribution, no independence, no service discipline — only that the system is stable ' +
          'over the interval measured. That makes it a measurement tool rather than a model. If you ' +
          'can observe two of the three quantities you get the third for free, which is how a queue ' +
          'depth of 19 items at 11 400 arrivals per second is known to mean 1.67 ms of waiting, ' +
          'without instrumenting a single request.',
        example: 'A queue of 19 items at 11 400 arrivals a second is 1.67 ms of waiting, whatever the distribution.'
      },
      {
        term: 'Head-of-line blocking',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one slow item reaches<br/>the front of the queue"] --> B["every item behind it waits"]',
            '    B --> C["however much spare capacity<br/>the ring still has"]',
            '    C --> D["the queue is not full,<br/>and nothing is moving"]'
          ].join('\n'),
          caption: 'Capacity does not help here, which is why adding buffer space to a stalled pipeline changes nothing except how much is waiting.'
        },
        plain: 'One slow item at the front stalls every item behind it, however much capacity the ring has.',
        formal: 'FIFO service, one server',
        detail: 'Strict FIFO order plus a single server means the item at the front owns the queue ' +
          'until it completes, so one slow item delays every item behind it by its full duration — a ' +
          'single 50 ms request in a queue of 2 048 adds 50 ms to all 2 047 others. Capacity does ' +
          'not help, because the problem is service order rather than space. The fixes all break one ' +
          'of the two premises: multiple servers so others can proceed, multiple queues so unrelated ' +
          'work is not serialised behind it, or an out-of-order protocol. HTTP/2 over one TCP ' +
          'connection is the famous case, and it is why HTTP/3 moved to QUIC.',
        example: 'A single 50 ms item in a queue of 2 048 delays all 2 047 behind it by 50 ms.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
