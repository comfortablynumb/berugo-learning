/** Concepts for the landscape, counting and tracing (M31.1-M31.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'memory-management-landscape': [
      {
        term: 'The allocator and the collector are two questions',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the allocator:<br/>where does this object go?"] --> C["two independent decisions"]',
            '    B["the collector:<br/>when may that space be reused?"] --> C',
            '    C --> D["a bump allocator with a<br/>copying collector"]',
            '    C --> E["a free-list allocator with<br/>mark-and-sweep"]',
            '    D --> F["and the pairing is a design choice,<br/>not a package deal"]',
            '    E --> F'
          ].join('\n'),
          caption: 'Conflating them is why memory management looks like a small number of monolithic options. They are two axes, and most real systems mix and match along both.'
        },
        plain: 'Where does this object go, and when may that space be used again.',
        formal: 'placement is the allocator\'s problem; reclamation is the collector\'s',
        detail: 'Separating them is what lets a runtime change collector without changing how ' +
          'objects are laid out, and it is why a discussion about fragmentation and a ' +
          'discussion about pause times are about different components. Everything in this ' +
          'milestone is the second question. The first was M43\'s and M02\'s: size classes, ' +
          'alignment, and the arithmetic that turns a request into an address.',
        example: 'Allocation here is a pointer bump — 8 bytes of header plus one word per ' +
          'reference — and every collector in the milestone is handed the same heap.'
      },
      {
        term: 'Manual management admits exactly four failures',
        plain: 'Leak, double free, use after free, and the dangling pointer behind the last two.',
        formal: 'the program decides when memory is freed, and it can be wrong in four ways',
        detail: 'A block never freed is a leak and the heap grows until the process dies. A ' +
          'block freed twice corrupts the allocator\'s own bookkeeping long before anything ' +
          'the program can see. A block read after being freed returns whatever now lives ' +
          'there. And the dangling pointer — a reference outliving its object — is what makes ' +
          'the middle two possible, which is why it is listed separately rather than as a ' +
          'cause. The demo seeds all of them into one scripted run rather than describing them.',
        example: 'The fixture plants five faults and leaves one block unfreed; at the default ' +
          'quarantine the allocator names four and misses one.'
      },
      {
        term: 'Quarantine and poison are how a sanitiser catches three of them',
        plain: 'Do not reuse an address at once; overwrite the bytes with a value nobody computes.',
        formal: 'a freed block is held out of circulation, so a later access sees the pattern',
        detail: 'The technique is simple and its limit is exact: everything inside the ' +
          'quarantine window is a use-after-free the allocator can still name, and everything ' +
          'outside it is one that has become a plausible wrong answer with nothing reported. ' +
          'Deepening the queue moves rows from the silent column to the caught column and ' +
          'costs memory to do it. That trade is why address sanitisers are a debugging build ' +
          'rather than the default one, and the sweep in the demo prices it directly.',
        example: 'At depth 0 the detector catches 0 of 5 faults; at depth 4 it catches 4 and ' +
          'holds 32 bytes out of use; at depth 6 it catches all 5 and holds 36.'
      },
      {
        term: 'Counting and tracing are the only two strategies',
        plain: 'Ask each object who points at it, or ask the roots what they can reach.',
        formal: 'local information adjusted on every store, or global information computed in a burst',
        detail: 'Every collector ever built is one of these two with the cost moved around. ' +
          'Counting spreads the work evenly across every pointer write and reclaims the moment ' +
          'an object dies. Tracing does nothing at all until it does everything at once. The ' +
          'consequences follow mechanically: counting has no collection pause and the worst ' +
          'throughput, tracing has the best throughput and a pause proportional to the heap, ' +
          'and counting cannot see a cycle because reachability is not local information.',
        example: 'On one trace of 1 599 objects, counting posts a maximum pause of 0 and a ' +
          'throughput of 0.576; mark-sweep posts 381 and 0.666.'
      },
      {
        term: '"Safe" means one thing: no reachable object is ever freed',
        plain: 'It does not mean no leak, bounded memory, or bounded pauses.',
        formal: 'the guarantee is about reachability, and nothing else is promised',
        detail: 'This is worth stating precisely because the word carries a lot of unearned ' +
          'weight. A managed runtime guarantees that an object you can still reach will still ' +
          'be there. It does not guarantee that memory is bounded — a cache nobody empties ' +
          'grows in every language — and it does not guarantee anything about when the memory ' +
          'comes back. The one guarantee is the one the liveness oracle in this milestone ' +
          'checks at every single collection, and a collector that breaks it is broken however ' +
          'good its pause distribution looks.',
        example: 'Every collector here is checked against a breadth-first reachability walk ' +
          'that shares no code with any of them; the check found three real defects.'
      },
      {
        term: 'Every object pays a header',
        plain: 'A mark bit, an age, a forwarding address and a count all need somewhere to live.',
        formal: 'the metadata is a fixed cost per object, not per byte',
        detail: 'Eight bytes on a twenty-four-byte object is a quarter of it before a single ' +
          'field, and that ratio is why small objects are expensive in every managed runtime. ' +
          'It is also why so much engineering goes into making small objects not be objects at ' +
          'all: tagged integers, value types, scalar replacement and flattened arrays are all ' +
          'attacks on the same fixed cost. A real runtime packs these fields into one word ' +
          'rather than laying them out separately, but the direction of the cost is the same.',
        example: 'The 8-byte header is 12 792 of the 44 608 bytes this trace allocates — 28.7 ' +
          'per cent of the heap, before any field.'
      },
      {
        term: 'The triangle: throughput, latency, footprint',
        plain: 'Give a collector more memory and it pauses less often and for longer.',
        formal: 'no design improves all three, and every tuning flag is a position on it',
        detail: 'Throughput is the fraction of the work that is the program\'s own. Latency is ' +
          'the longest single pause. Footprint is the memory needed above the live set. Every ' +
          'collector in this milestone wins one of the three and loses another, which is why ' +
          'the comparison table has three columns rather than a ranking. The production ' +
          'question is never "is this collector good"; it is "which of the three is my budget ' +
          'tightest on", and a batch job, a request path and an embedded target answer it ' +
          'differently.',
        example: 'Best throughput, smallest pause and smallest peak are three different designs ' +
          'on the same trace, and they change again when the heap size does.'
      },
      {
        term: 'A pause is reported as a distribution, never as an average',
        plain: 'A bimodal pause set has a mean that describes no pause that ever happened.',
        formal: 'report p50, p99 and max; the mean of two modes is between them and is nothing',
        detail: 'A generational collector produces many tiny nursery collections and the ' +
          'occasional full one. Its mean sits in the gap between the two, describing neither, ' +
          'and it moves whenever the ratio of minor to major collections changes — which is to ' +
          'say, whenever the workload does. The p99 is the number a latency budget is written ' +
          'against and the maximum is the number that wakes somebody up, and both of them are ' +
          'invisible in an average.',
        example: 'The generational run on this trace has a p50 of 74 and a p99 of 90, and its ' +
          'p99 is the full collection it has not stopped needing.'
      }
    ],

    'reference-counting': [
      {
        term: 'One rule, and everything follows from it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a pointer store"] --> B["increment the new target"]',
            '    A --> C["decrement the old target"]',
            '    C --> D{"did it reach zero?"}',
            '    D -->|yes| E["free it now, and decrement<br/>everything it pointed at"]',
            '    E --> D',
            '    D -->|no| F["nothing else happens"]'
          ].join('\n'),
          caption: 'There is no collector and no pause: freeing is a consequence of an ordinary assignment. The cost is that every assignment now does bookkeeping.'
        },
        plain: 'A store increments the new target and decrements the old; zero frees at once.',
        formal: 'retain(new); release(old); a count reaching zero reclaims immediately',
        detail: 'That is the entire design. Its reputation, good and bad, is a consequence of ' +
          'those two clauses and nothing else: immediate reclamation because zero is detected ' +
          'at the store, no collection pause because there is no collection, the worst ' +
          'throughput in the milestone because the work is on every write, and the cycle it ' +
          'cannot see because a count is local and reachability is not.',
        example: 'On the demo trace, 1 354 objects are reclaimed with no collection at all, and ' +
          '3 757 count adjustments are performed to do it.'
      },
      {
        term: 'Immediate reclamation is the reason to want it',
        plain: 'The destructor runs at the instruction that made the object dead.',
        formal: 'reclamation is deterministic and lexically predictable, not scheduled',
        detail: 'A file handle closes when the object holding it goes out of scope, and it ' +
          'happens at a point in the program rather than at a point in the collector. That is ' +
          'why C++\'s shared_ptr, Swift and CPython all use counting: they are buying ' +
          'determinism, not speed, and they pay for it in throughput knowingly. 31.7 is what ' +
          'happens to a runtime that does not have this property and pretends a finaliser is ' +
          'an adequate substitute.',
        example: 'The counting run reclaims 1 354 objects across the trace and never once ' +
          'stops the program to do it.'
      },
      {
        term: 'The cost is a write barrier on every pointer store',
        plain: 'Two count adjustments per store, whether or not anything dies.',
        formal: 'the throughput cost is proportional to pointer traffic, not to garbage',
        detail: 'The demo charges those adjustments to the collector rather than to the ' +
          'program, because they exist only because of it — and done that way the collector ' +
          'with no pause has the worst throughput in the set. Both statements are true at ' +
          'once, and hearing only one of them is how reference counting acquires its ' +
          'reputation as free. Under threads it is much worse: a shared object needs an ATOMIC ' +
          'adjustment, and an atomic increment on a contended cache line costs orders of ' +
          'magnitude more than the arithmetic.',
        example: '3 757 adjustments over 5 101 program steps — 0.74 per step — for a throughput ' +
          'of 0.576 against mark-sweep\'s 0.666.'
      },
      {
        term: 'The cascade: "no pause" is false in one common case',
        plain: 'Dropping the head of a list frees the whole list at that one store.',
        formal: 'a decrement to zero recurses through the children, without bound',
        detail: 'The work is spread evenly over every write until it very much is not. Which ' +
          'store pays depends on the shape of your data rather than on the size of your heap, ' +
          'which is arguably worse than a collection pause: it is not on any dashboard and it ' +
          'does not correlate with anything a monitoring system watches. A deeply linked ' +
          'structure released at the end of a request is exactly this shape.',
        example: 'A chain of 200 nodes held by one reference frees all 200 objects and performs ' +
          '200 decrements at the single store that drops the head.'
      },
      {
        term: 'It cannot collect a cycle, and this is not an implementation gap',
        plain: 'Two objects holding each other keep each other above zero forever.',
        formal: 'a count is local information; reachability is a property of the whole graph',
        detail: 'The answer is genuinely not in the count, so no amount of care in the counting ' +
          'code recovers it. This matters practically because the shapes that produce cycles ' +
          'are ordinary: a parent pointer, an observer list, a doubly linked list, a node that ' +
          'knows its own tree. Reaching for a weak reference at those places is not a ' +
          'micro-optimisation; in a counted runtime it is the difference between the collector ' +
          'working and not working.',
        example: 'After the root is dropped, both objects in the fixture still hold a count of ' +
          '1 and the oracle reports both unreachable — 154 objects leak this way on the trace.'
      },
      {
        term: 'Trial deletion is a tracer wearing a hat',
        plain: 'Subtract the references coming from inside a candidate subgraph and see what is left.',
        formal: 'a remaining count means an external holder; none means the group is garbage',
        detail: 'Bacon and Rajan\'s synchronous cycle collection walks the subgraph a candidate ' +
          'reaches and subtracts the internal references from each member\'s count. If every ' +
          'member ends at zero, nothing outside points in and the whole group is unreachable. ' +
          'That walk is a trace over a subgraph, which is the honest way to describe every ' +
          'production reference-counting system: it contains a tracer, and the interesting ' +
          'question is only how much of the heap that tracer has to look at.',
        example: 'The two-object fixture forms one candidate group with 2 internal references ' +
          'and no external holder, and both members are reclaimed.'
      },
      {
        term: 'Only a decrement to a non-zero value can make a cycle garbage',
        plain: 'That single observation is what keeps the candidate set small.',
        formal: 'an increment cannot create garbage; a decrement to zero has already freed it',
        detail: 'Without it, cycle collection would have to examine the whole heap and would be ' +
          'a full trace with extra steps. With it, the candidate set is exactly the objects ' +
          'that lost a reference without dying, which on a real workload is a small fraction ' +
          'of the stores. It is also why the trigger is a candidate count rather than a heap ' +
          'size: a counting runtime never notices the memory is gone, so waiting for the heap ' +
          'to fill waits for a signal that may never arrive. CPython counts allocations for ' +
          'the same reason.',
        example: 'Collecting when 32 candidates have accumulated takes the leak from 154 ' +
          'objects to 8, at the cost of 11 pauses the plain counter did not have.'
      },
      {
        term: 'Deferred counting, elision and ownership transfer',
        plain: 'The optimisations all consist of not doing the count.',
        formal: 'root stores are the majority of counting traffic, and can be reconciled in batch',
        detail: 'Most counting traffic is references being copied into and out of local ' +
          'variables, which live and die within a frame. Deferred counting skips those and ' +
          'reconciles periodically with a scan of the stack, which buys throughput and ' +
          'introduces a pause. Elision removes a retain/release pair the compiler can prove ' +
          'cancels; ownership transfer moves a reference rather than copying it. Swift\'s ARC ' +
          'is these three plus the escape analysis of M29, and its performance is almost ' +
          'entirely a story about how many counts it managed not to perform.',
        example: 'Charging only the counting traffic the trace actually performs already costs ' +
          '0.09 of throughput against tracing on the same run.'
      }
    ],

    'mark-sweep-and-compact': [
      {
        term: 'Tracing asks one question: what is reachable from the roots',
        plain: 'Everything else is garbage, whatever the program intended.',
        formal: 'live = the transitive closure of the roots under the points-to relation',
        detail: 'The roots are the registers, stack slots and globals a running program holds, ' +
          'and M30 spent a whole section building the stack maps that say precisely which of ' +
          'them are references rather than integers. Reachability is a global property, which ' +
          'is exactly what a reference count is not, and that is why tracing can collect a ' +
          'cycle and counting cannot. It is also why tracing costs nothing until it costs ' +
          'everything.',
        example: 'The demo heap holds 922 objects of which 89 are reachable, and one collection ' +
          'reclaims exactly the other 833.'
      },
      {
        term: 'Tri-colour is three states because two are not enough',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["white — not reached yet"] --> B["grey — reached, but its own<br/>pointers not yet followed"]',
            '    B --> C["black — reached and fully scanned"]',
            '    C --> D["the collector is finished when<br/>no grey objects remain"]',
            '    D --> E["grey IS the work list —<br/>with two colours there is nowhere<br/>to record what is half-done"]'
          ].join('\n'),
          caption: 'The middle colour is what lets the collector stop and resume, which is the entire basis of incremental and concurrent collection.'
        },
        plain: 'White is unreached, black is reached and scanned, grey is the frontier.',
        formal: 'the mark ends when the grey set empties, which is a cheap termination test',
        detail: 'Grey is the useful colour: reached, but its own references have not been ' +
          'followed yet. Without it there is no way to distinguish "I have seen this object" ' +
          'from "I have finished with this object", and no cheap way to know when the mark is ' +
          'over. The abstraction also survives being interrupted, which is what makes 31.5 ' +
          'possible — the invariant "no black object points at a white one" is stated in these ' +
          'three colours and nothing else.',
        example: 'At the end of a mark over this heap: 89 black, 0 grey, 833 white, and the ' +
          'sweep frees exactly the white ones.'
      },
      {
        term: 'The mark stack is bounded, and overflow is a normal path',
        plain: 'A collector cannot allocate memory to collect memory.',
        formal: 'pushing onto a full stack drops the entry and sets a flag rather than failing',
        detail: 'That is the situation a collector is in by definition, so the grey set has a ' +
          'fixed size and the overflow path is part of the algorithm rather than an error ' +
          'case. Every real collector has this path and it is the one nobody tests, because ' +
          'reaching it requires a heap deeper than the stack and a test suite rarely builds ' +
          'one. Both defects found in this section\'s recovery code were invisible until a ' +
          'heap with a 32-deep spine was collected with a small stack.',
        example: 'At a stack limit of 1 the main pass reaches 9 objects of 89 and the recovery ' +
          'does the rest; at 64 it reaches all 89 and the recovery never runs.'
      },
      {
        term: 'Overflow recovery is a heap scan for one shape',
        plain: 'A black object with a white child can only exist because a push was dropped.',
        formal: 'find that shape, resume marking from it, repeat until a pass finds none',
        detail: 'The recovery is complete because the shape is the only evidence a drop leaves ' +
          'behind, and it terminates because each pass turns at least one white object black. ' +
          'It costs O(heap) per pass, which is what makes a small mark stack expensive rather ' +
          'than wrong. The subtlety that broke it twice here: the recovery must hand the ' +
          'marker WHITE objects (a marker that only accepts white ones silently ignores greys), ' +
          'and it cannot recover a dropped ROOT at all, because a root has no parent to be ' +
          'found under.',
        example: 'At a stack limit of 1 the collection costs 2 775 units against 1 011 at 64 — ' +
          '2.74 times as much — and reclaims exactly the same 833 objects.'
      },
      {
        term: 'Sweep produces a free list, not free memory',
        plain: 'What is left is the space between the survivors, in as many pieces as survivors.',
        formal: 'free space after a sweep is fragmented by construction',
        detail: 'This is why a heap that is ninety per cent free can fail a modest allocation: ' +
          'the number that matters is not how much is free but how large the largest single ' +
          'piece is, and a sweep has no way to influence that. The allocator afterwards has to ' +
          'search a free list rather than bump a pointer, which is a second, quieter cost paid ' +
          'on every allocation for the rest of the process.',
        example: 'After a sweep this heap holds 23 080 free bytes in 57 pieces, of which the ' +
          'largest is 5 160 — 22.4 per cent of the total.'
      },
      {
        term: 'Compaction is the answer and it costs a pass over every pointer',
        plain: 'Slide the survivors together, record where each went, then rewrite every reference.',
        formal: 'a forwarding address per object, and a fix-up pass over the whole heap',
        detail: 'Afterwards allocation is a pointer bump again and the free space is one run. ' +
          'The price is not the sliding, which is cheap; it is that every reference in the ' +
          'program has to be findable and rewritable, which is a demand on the compiler rather ' +
          'than on the collector. Lisp2 does it with two extra passes and a forwarding word; ' +
          'threaded compaction avoids the extra word by temporarily reversing the pointers ' +
          'into a chain through the object being moved.',
        example: 'The same collection with compaction on: 23 080 free bytes in 1 piece, so any ' +
          'allocation up to 23 080 succeeds where 5 160 was the ceiling before.'
      },
      {
        term: 'Precise scanning needs compiler cooperation; conservative scanning does not',
        plain: 'Treat any word that looks like a pointer as one, and it works without stack maps.',
        formal: 'conservatism over-approximates the root set, and the error is one-sided',
        detail: 'Over-approximating is safe in the sense that no live object is freed, which is ' +
          'why Boehm-style collectors can be linked into C and work. It costs two things. An ' +
          'integer that happens to look like an address keeps a dead object alive, and ' +
          'everything that object points at with it, indefinitely. And you can never move an ' +
          'object, because updating a word you are not certain is a pointer would corrupt an ' +
          'integer — which forecloses compaction and everything built on it.',
        example: 'Every moving design in this milestone — copying, generational, region ' +
          'evacuation — rests on the stack maps M30 built; none of them is available ' +
          'conservatively.'
      },
      {
        term: 'The oracle runs at every collection, not at the end',
        plain: 'A collector that frees a live object usually produces a completely plausible run.',
        formal: 'compare the reclaimed set against reachability computed independently, per collection',
        detail: 'The program carries on until it touches the freed object, which may be much ' +
          'later or never, and the eventual symptom names neither the collector nor the ' +
          'collection that caused it. So the check has to be made at the moment of collection ' +
          'and against a definition of liveness that shares no code with the collector — a ' +
          'plain breadth-first walk. Three separate defects in this milestone were found by ' +
          'that check and by nothing else, and two of them were reporting healthy statistics ' +
          'while they happened.',
        example: 'Every row of the stack-limit sweep reclaims 833 of 833 and frees no reachable ' +
          'object; the two defects the check caught were 26 objects and 6 objects lost.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
