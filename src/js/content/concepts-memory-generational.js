/** Concepts for copying, incremental and modern collectors (M31.4-M31.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'generational-collection': [
      {
        term: 'Cheney is three facts',
        plain: 'Allocation is a pointer bump, cost is the survivors, and to-space is the work list.',
        formal: 'copy the reachable objects to the other space, breadth-first, scan chasing allocate',
        detail: 'Free space in a semi-space collector is always one contiguous run, so ' +
          'allocation is an increment and a bounds check. Collection copies what is live, so ' +
          'its cost is proportional to survivors rather than to the heap. And the to-space is ' +
          'its own queue — the scan pointer chases the allocation pointer — so there is no ' +
          'auxiliary mark stack and therefore no overflow path to get wrong, which is a real ' +
          'simplification against 31.3.',
        example: 'A copying collection on this trace costs 162 to 178 units regardless of ' +
          'whether the heap is 4 KB or 32 KB.'
      },
      {
        term: 'The forwarding address is why a second visit is cheap',
        plain: '"Already copied" and "here is where it went" are one field.',
        formal: 'the vacated object is overwritten with a pointer to its new location',
        detail: 'A copying collector needs no mark bit at all: the old copy of the object holds ' +
          'the forwarding address, so a second reference reaching it finds both the answer to ' +
          '"have I seen this" and the answer to "where do I now point" in the same word. That ' +
          'is the trick that makes Cheney a dozen lines. It also means the from-space object ' +
          'has been destroyed, which is why a copying collector cannot be conservative — you ' +
          'must be certain a word is a reference before rewriting it.',
        example: 'The model here keeps object identity across a copy, so the fix-up is the ' +
          'identity, and the forwarding map still decides what is scanned.'
      },
      {
        term: 'The price of semi-space is half the memory',
        plain: 'A collector that copies needs somewhere to copy to.',
        formal: 'usable heap is half the reserved heap, at all times',
        detail: 'This is why the design is applied to a nursery rather than to everything: half ' +
          'of a small nursery is a small price and half of a large old generation is not. It ' +
          'is also the reason a copying collector and a mark-sweep collector are hard to ' +
          'compare on peak memory without saying which number you mean — reserved, usable, or ' +
          'live — and why the footprint column of a collector comparison deserves as much ' +
          'suspicion as the throughput one.',
        example: 'The peak column in the comparison table is bytes actually held, which is ' +
          'the number a copying collector looks best on and reserved memory is not.'
      },
      {
        term: 'Cost proportional to survivors, measured rather than asserted',
        plain: 'Fix the workload, grow the heap, and watch the two curves separate.',
        formal: 'sweeping is O(heap); copying is O(live)',
        detail: 'Mark-sweep has to walk the heap to sweep it, so its per-collection cost tracks ' +
          'the heap size. Copying touches only what it copies, so its cost tracks the live ' +
          'set, which the experiment holds fixed. This is the entire basis of the generational ' +
          'strategy and it is a measurement rather than an argument: if the copying column ' +
          'moved with the heap, there would be no reason to collect a nursery separately.',
        example: 'Across heaps of 4 096, 8 192, 16 384 and 32 768 bytes, mark-sweep costs 218, ' +
          '367, 669 and 1 270 units per collection; copying costs 162, 164, 165 and 178.'
      },
      {
        term: 'The weak generational hypothesis is a claim about your workload',
        plain: 'Most objects die young — usually, and not always.',
        formal: 'the survival rate of a nursery-sized window, measured on the trace at hand',
        detail: 'It is empirical, not a law, and a workload that breaks it turns the ' +
          'generational design from the best available into the worst: every minor collection ' +
          'copies most of what it touches and then does it again next time. The measurement ' +
          'also depends on a horizon nobody states — "still live at the end of the window" and ' +
          '"still live a window later" are different numbers, always in that order, and ' +
          'quoting one while meaning the other is how a survival rate ends up disagreeing with ' +
          'the collector measured beside it.',
        example: 'On this trace the mean survival is 17.2 per cent at the end of the window and ' +
          'lower a window later; the per-window figures run 23.0, 16.5, 18.1, 14.9, 15.4 and 18.6.'
      },
      {
        term: 'Promotion is what stops the copying repeating forever',
        plain: 'Survive a fixed number of nursery collections and you move to the old generation.',
        formal: 'age >= promoteAfter moves the object out of the collected set',
        detail: 'Promote too early and long-lived garbage accumulates in a space that is rarely ' +
          'collected, so the heap grows and the eventual full collection is enormous. Promote ' +
          'too late and the same surviving objects are copied over and over, which is pure ' +
          'waste proportional to how long they live. The nursery size and the promotion ' +
          'threshold interact, which is why the nursery sweep is not monotone in total work: ' +
          'changing the size changes the promotion rate as well as the collection frequency.',
        example: 'The nursery sweep runs 317, 141, 59, 37, 26 and 12 minor collections at sizes ' +
          'from 256 to 4 096 bytes, for total GC work of 8 392 down to 1 340.'
      },
      {
        term: 'A minor collection\'s roots include every old object pointing into the nursery',
        plain: 'And finding those without scanning the old generation is the whole problem.',
        formal: 'roots = the program\'s roots union the remembered set',
        detail: 'Scanning the old generation to find them would cost exactly what collecting ' +
          'generationally was supposed to avoid, so the mutator has to record them as they are ' +
          'created. Miss one and a live young object is freed — which is the classic ' +
          'generational bug, and turning the barrier off in the demo produces it on demand. ' +
          'The barrier-free run is faster on every other column, which is what a broken ' +
          'collector looks like from the outside: better numbers.',
        example: 'With no write barrier the nursery collection frees 208 reachable objects; ' +
          'with either working barrier it frees none.'
      },
      {
        term: 'A remembered set is exact, a card table is cheap, and the card size is a dial',
        plain: 'Record the object, or mark a fixed span of heap dirty with one byte.',
        formal: 'set insertion per store against a byte write plus a scan of the card',
        detail: 'There are three costs and no setting minimises all three: what the barrier ' +
          'charges at each store, how much the collector must scan to recover the roots, and ' +
          'how much memory the record itself occupies. Shrinking the cards takes the scan ' +
          'towards the exact set while growing the table; growing them does the reverse. The ' +
          'entry also cannot simply be cleared after a collection — an old object pointing at a ' +
          'young one that SURVIVED still points at a young one, and no further store will ' +
          're-record it.',
        example: 'On this trace the remembered set costs 786 units at the stores and hands over ' +
          '349 objects in a 1 880-byte table; the card table costs 262 and hands over 655 in 332.'
      }
    ],

    'incremental-collection': [
      {
        term: 'A stop-the-world pause grows with the heap',
        plain: 'Marking touches every reachable object, so ten times the heap is ten times the pause.',
        formal: 'there is no constant to tune; only less heap, or the heap in pieces',
        detail: 'This is the whole reason concurrent collection exists. The two escapes are to ' +
          'mark less of the heap, which is the generational answer in 31.4, or to mark it in ' +
          'slices the program runs between, which is this section. Both are real and most ' +
          'production collectors do both, which is why a modern collector\'s description ' +
          'contains generations AND concurrency rather than choosing.',
        example: 'A full mark on this heap costs 382 units; slicing it into pieces of 8 gives a ' +
          'median pause of 8.'
      },
      {
        term: 'The black-to-white pointer is the one bug',
        plain: 'A scanned object acquires a reference the marker will never follow.',
        formal: 'black -> white, with the last other path removed, loses a live object',
        detail: 'The collector will not revisit a black object, so a reference stored into one ' +
          'is a reference the marker never sees. If that was the last other path to the white ' +
          'object, it is freed while live. Every barrier in every concurrent collector ever ' +
          'built is a different way of preventing that one shape, which makes the subject much ' +
          'smaller than it looks: there is one bug and several remedies, not a family of ' +
          'hazards.',
        example: 'The hand-built fixture blackens the container first, stores the value into ' +
          'it, drops the holder, and the value is freed while live with no barrier.'
      },
      {
        term: 'Incremental update shades the new target',
        plain: 'When a black object is given a white child, colour the child grey.',
        formal: 'Dijkstra\'s barrier maintains "no black object points at a white one"',
        detail: 'This is the precise choice: what survives the cycle is exactly what was ' +
          'reachable when the cycle ended, so there is no extra retention. The cost is that ' +
          'the barrier has to look at the value being stored and at the colour of the object ' +
          'being stored into, on every pointer write while a mark is in progress. An object ' +
          'shaded this way may still die before the mark finishes, and the next cycle collects ' +
          'it.',
        example: 'Over 2 000 randomised interleavings it loses no live object and leaves 650 ' +
          'dead ones behind.'
      },
      {
        term: 'Snapshot at the beginning shades the old target',
        plain: 'When a reference is overwritten, colour whatever it used to point at.',
        formal: 'Yuasa\'s barrier preserves everything reachable when marking STARTED',
        detail: 'The cycle then marks the heap as it was at the start, so anything that dies ' +
          'during the cycle survives it. That is floating garbage, and it is the price of a ' +
          'barrier that never has to look at the new value — which matters, because reading ' +
          'the old value of a field you are about to overwrite is a cheaper and more ' +
          'predictable operation than inspecting the object graph around the store. The trade ' +
          'is memory for barrier simplicity, and it is measurable.',
        example: 'Over the same 2 000 interleavings SATB also loses nothing and leaves 1 521 ' +
          'dead objects — 2.34 times what incremental update leaves.'
      },
      {
        term: 'SATB is correct only because a program cannot publish a reference it does not hold',
        plain: 'Every reference the mutator has came from a root or from something it already read.',
        formal: 'nothing outside the snapshot can be stored into the snapshot',
        detail: 'This precondition is usually left implicit and it is the whole of the ' +
          'correctness argument. The stress harness here draws both ends of every random store ' +
          'from the currently reachable set for exactly that reason: an earlier version drew ' +
          'from the whole heap, let an unreachable object become reachable out of nowhere, and ' +
          'failed SATB on 329 of 2 000 runs with failures that were real given the stores and ' +
          'impossible in any program. The one case where a program genuinely produces a new ' +
          'reference is allocation, and that is why SATB collectors allocate black.',
        example: 'With stores restricted to what the program can reach, both barriers lose zero ' +
          'live objects across 10 000 interleavings, and the barrier-free variant fails 76 of ' +
          '10 000 runs — 0.76 per cent — for 98 objects.'
      },
      {
        term: 'Allocate-black is the third rule and it is usually omitted',
        plain: 'An object born during a cycle was never reachable when the roots were scanned.',
        formal: 'colour new objects black, so a finishing mark does not sweep them',
        detail: 'A marker that completes without having seen an object born mid-cycle would ' +
          'find it white and free it. Colouring it black at allocation costs nothing — the ' +
          'colour is set once, at a point that is already writing the header — and it is why ' +
          '"allocate-black" appears in every concurrent collector\'s description. The cost is ' +
          'a small amount of extra floating garbage: a newborn object that dies immediately ' +
          'survives the cycle it was born in.',
        example: 'The lab colours every object allocated during a mark black, which is a second ' +
          'source of the floating garbage the demo counts.'
      },
      {
        term: 'Floating garbage is bounded by one cycle',
        plain: 'Objects that die after the collector decided they were live go next time.',
        formal: 'a memory cost, not a correctness one, and it needs headroom',
        detail: 'This is the right trade, and it has a practical consequence people meet ' +
          'without recognising it: a concurrent collector needs a heap larger than the live ' +
          'set by more than a stop-the-world one does, and a heap sized exactly for the live ' +
          'set will thrash. When a team moves to a concurrent collector and the same heap ' +
          'setting starts misbehaving, this is usually why.',
        example: 'The worst single collection here leaves 232 dead objects behind, and the ' +
          'snapshot barrier roughly doubles that figure across the stress set.'
      },
      {
        term: 'Incremental marking does not make the sweep incremental',
        plain: 'The median pause becomes the slice; the tail stays the size of the heap.',
        formal: 'p50 tracks the slice; p99 tracks whatever is still stop-the-world',
        detail: 'This is the half-measure to watch for when reading a collector\'s claims. ' +
          'Slicing the mark bounds the typical pause by construction, and the demo shows the ' +
          'p50 following the slice exactly. The p99 does not follow it down, because the sweep ' +
          'at the end of a cycle is a single pass over the heap. A collector described as ' +
          '"concurrent marking" has told you precisely which half it fixed.',
        example: 'At slices of 1, 8 and 64 the p50 is 1, 8 and 64 exactly, while the p99 is 76, ' +
          '100 and 121.'
      }
    ],

    'modern-collectors': [
      {
        term: 'A region heap is the generational idea generalised',
        plain: 'Many independently collectable pieces instead of two ages.',
        formal: 'any subset of regions can be collected on its own',
        detail: 'The collector then chooses how much work to do rather than discovering it, ' +
          'which is the single change that turns a pause from a consequence of the heap size ' +
          'into a budget. Everything else about G1, Shenandoah and ZGC follows from having ' +
          'made the collection set a decision variable, and the tuning flags those runtimes ' +
          'expose are the parameters of that decision.',
        example: 'The demo heap partitions into 90 regions of 512 bytes, and the collection set ' +
          'is whatever fits the pause budget.'
      },
      {
        term: 'The price is a remembered set per region',
        plain: 'Evacuating a region means finding every pointer into it.',
        formal: 'per-region records replace the single old-to-young record of 31.4',
        detail: 'The alternative to a record is scanning the whole heap, which is exactly what ' +
          'collecting a subset was meant to avoid. Those records are real memory — several per ' +
          'cent of the heap in a production G1 — and they are the reason a region heap is not ' +
          'free. They also make the write barrier more expensive than a generational one, ' +
          'because the question is no longer "is this old to young" but "does this cross a ' +
          'region boundary", which is true far more often.',
        example: 'The card table for this heap costs 332 bytes at 128-byte cards; a per-region ' +
          'set is that cost multiplied by the region count.'
      },
      {
        term: '"Garbage first" is a scheduling heuristic',
        plain: 'Rank by garbage reclaimed per byte copied, take while the budget lasts.',
        formal: 'greedy by value density under a knapsack constraint',
        detail: 'Reading it this way makes the flags legible. A pause target is the budget the ' +
          'selection loop stops at, so raising it lets the collector take more regions per ' +
          'pause and fall behind less often. The region size changes the granularity of the ' +
          'choice, which matters most when objects are large relative to a region. And a ' +
          'wholly dead region costs nothing to evacuate and returns everything, so it always ' +
          'sorts first — which is why a region collector reclaims dead regions almost for free.',
        example: 'The best mixed regions on this heap return 31.0, 30.5, 30.0 and 29.5 bytes ' +
          'per byte copied, and every wholly dead region is taken before any of them.'
      },
      {
        term: 'Greedy is not optimal, and it is worth knowing where it loses',
        plain: 'One high-ratio region can block two that together return more.',
        formal: 'greedy by density is a 1/2-approximation to 0-1 knapsack in general',
        detail: 'On a real heap the greedy choice lands within a tenth of a per cent of the ' +
          'exact optimum, because most regions are wholly dead and taking them costs nothing — ' +
          'so a comparison against the optimum on real data says "the heuristic is fine" and ' +
          'demonstrates nothing about the heuristic. The shape where it loses has to be built: ' +
          'a region with the best ratio and a live set large enough that taking it excludes ' +
          'two better ones together. Both optima here are computed by dynamic programming ' +
          'rather than assumed.',
        example: 'On this heap garbage-first returns 100.0 per cent of the optimum; on the ' +
          'constructed set it returns 73 of an available 100 — 73.0 per cent.'
      },
      {
        term: 'Concurrent evacuation needs a read barrier',
        plain: 'If an object can move while the program runs, every read must discover that.',
        formal: 'a check on every reference load, not on every reference store',
        detail: 'Reads outnumber writes heavily in real programs, so this is a much larger ' +
          'throughput commitment than anything in 31.5, and it is why Shenandoah and ZGC are ' +
          'careful about their throughput numbers rather than boastful. The payoff is that the ' +
          'evacuation itself stops being a pause, which is the last large pause a region ' +
          'collector has, so the remaining stop-the-world work is roughly proportional to the ' +
          'root set rather than to the heap.',
        example: 'The comparison table\'s region row still shows a p99 of 239, and that pause ' +
          'is exactly the evacuation a read barrier would remove.'
      },
      {
        term: 'Coloured pointers put the metadata in the address',
        plain: 'A 64-bit machine does not use all 64 bits, so the collector uses the spare ones.',
        formal: 'mark and remap state live in unused address bits, read without touching the object',
        detail: 'ZGC can answer "has this object moved" from the pointer alone, which is what ' +
          'makes its load barrier affordable. It is a hardware-shaped trick: it depends on the ' +
          'address space being much larger than the memory, so it does not transfer to a ' +
          '32-bit target and it constrains the maximum heap. It is worth knowing as an example ' +
          'of a design decision that is invisible in the algorithm and decisive in the ' +
          'implementation.',
        example: 'Nothing in this milestone models coloured pointers; the header cost table in ' +
          '31.1 is the alternative, at one to four bytes per object.'
      },
      {
        term: 'Not moving objects is a coherent choice with consequences',
        plain: 'Go\'s collector is concurrent mark-sweep and deliberately does not compact.',
        formal: 'no compaction means no forwarding, no read barrier, and permanent fragmentation',
        detail: 'Each of Go\'s other decisions follows: a size-class allocator to keep ' +
          'fragmentation manageable without compaction, heavy escape analysis to keep the ' +
          'allocation rate down, and very short pauses because there is no evacuation to do. ' +
          'It is a package rather than a list of features, and reading it as a package is what ' +
          'lets you predict where it will struggle — large, long-lived, variably sized ' +
          'allocations.',
        example: 'The fragmentation strip in 31.3 is what a non-moving collector lives with ' +
          'permanently: 23 080 free bytes whose largest piece is 5 160.'
      },
      {
        term: 'Read a published design as four answers',
        plain: 'How is the heap partitioned, does it move, what is concurrent, what pause is left.',
        formal: 'the four questions predict behaviour better than the announcement\'s benchmark',
        detail: 'Every collector in this milestone answers those four differently and every ' +
          'production collector can be placed by them. The last question is the one to ask ' +
          'first: every design still has a pause, and the interesting difference is what the ' +
          'remaining pause is proportional to. G1\'s is proportional to the collection set, ' +
          'which is a choice it can get wrong under load. ZGC\'s is proportional to the root ' +
          'set. Go\'s is two short phases per cycle. "Pauseless" always means one of these.',
        example: 'Eight designs over one trace, and the best p99, best throughput and smallest ' +
          'peak are three different rows — which changes again when the heap size does.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
