/** Concepts for weak references, avoidance and diagnosis (M31.7-M31.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'weak-references': [
      {
        term: 'A reference strength is one instruction to the tracer',
        plain: 'Follow this edge, or do not.',
        formal: 'a weak reference is a reference the collector pretends is not there',
        detail: 'Everything about weak maps, caches, listeners and cleanup actions follows from ' +
          'that single bit. It is worth stating this baldly because the mechanisms are usually ' +
          'taught as four separate features with four separate use cases, when they are one ' +
          'feature — an edge the reachability walk skips — with a policy attached to when the ' +
          'slot is then cleared.',
        example: 'The same twelve-entry cache reclaims 0 objects with strong entries and 12 ' +
          'with weak ones; nothing else about it changes.'
      },
      {
        term: 'A map keyed on objects with strong entries keeps every key forever',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a long-lived cache keyed<br/>by object"] --> B["the map is reachable"]',
            '    B --> C["so the map reaches its keys"]',
            '    C --> D["so every key stays live,<br/>however dead the rest<br/>of the program thinks it is"]',
            '    D --> E["a leak that no reference-counting<br/>bug and no cycle explains"]'
          ].join('\n'),
          caption: 'This is the most common leak in a garbage-collected language, and it is not a collector failure: the objects genuinely are reachable, from the cache you forgot.'
        },
        plain: 'The map is reachable, and the map reaches the keys.',
        formal: 'the cache retains exactly the things it was built to be indexed by',
        detail: 'This is not a cache with a bug in it; it is a map working exactly as ' +
          'specified, and it is the commonest leak in managed languages. The fix is one word — ' +
          'the strength of one reference — and the reason it is missed so often is that the ' +
          'code reads correctly and the failure is a property of lifetimes rather than of ' +
          'logic. A bounded cache is the other fix and it is usually the better one, because ' +
          'weak keys give you no control over WHEN entries go.',
        example: 'Twelve entries, six keys dropped: strong holds 600 bytes and clears nothing, ' +
          'weak holds 312 and clears 6.'
      },
      {
        term: 'Soft is a policy, not an invariant',
        plain: 'Cleared when the runtime decides memory is tight, on a schedule you do not control.',
        formal: 'kept while there is room; the definition of "room" is the runtime\'s',
        detail: 'That makes soft references fine for "recompute this if it is gone" and wrong ' +
          'for anything whose absence changes behaviour, because the behaviour then depends on ' +
          'a decision the runtime makes and your tests do not reproduce. It also makes them ' +
          'nearly untestable: the code path that runs when the reference is cleared is the one ' +
          'that only executes under production memory pressure.',
        example: 'With no pressure the soft cache clears 0 entries and behaves like the strong ' +
          'one; under pressure it clears 6 and behaves like the weak one.'
      },
      {
        term: 'A finaliser runs at an unspecified time, in an unspecified order, on an unspecified thread',
        plain: 'None of those three is a detail.',
        formal: 'no timing guarantee, no ordering guarantee, no thread guarantee',
        detail: 'Unspecified time means the resource is held for an unbounded interval. ' +
          'Unspecified order means an object cannot rely on anything it references still being ' +
          'valid when its finaliser runs, so a finaliser that touches another finalisable ' +
          'object is already wrong. And an unspecified thread means the finaliser is ' +
          'concurrent code whether or not it was written as such, so every shared thing it ' +
          'touches needs the treatment concurrent code gets.',
        example: 'In the handle fixture the finaliser is correct, is never called, and the ' +
          'process dies at iteration 17.'
      },
      {
        term: 'Resurrection is why a finalisable object costs two collections',
        plain: 'A finaliser can store `this` somewhere reachable and bring the object back.',
        formal: 'find it in one cycle and run the finaliser; confirm it dead in a later one',
        detail: 'A runtime that freed the object in the same cycle it ran the finaliser would ' +
          'free an object that had just been made reachable again. So finalisation costs an ' +
          'extra cycle for every finalisable object, and everything the object references ' +
          'stays alive across both of them. The finaliser also runs at most once, which means ' +
          'a resurrected object is never cleaned up at all — its resource is held and the code ' +
          'that would release it has been permanently disqualified.',
        example: 'Cycle 1 queues the object and frees nothing; cycle 2 runs the finaliser and ' +
          'frees 2 objects. With resurrection, 3 objects remain alive after three cycles.'
      },
      {
        term: 'An object awaiting finalisation keeps everything it references alive',
        plain: 'One forgotten finaliser retains a subgraph, not an object.',
        formal: 'finaliser-reachable is a reachability class of its own',
        detail: 'It has to be that way: a finaliser running against objects the collector had ' +
          'already freed would be reading freed memory inside a managed runtime, which is the ' +
          'one thing the runtime exists to prevent. The consequence people meet is that adding ' +
          'a finaliser to a small object with a large field graph makes the whole graph outlive ' +
          'two collection cycles, and the heap dump shows a retained size nobody can explain ' +
          'from the class definition.',
        example: 'In the fixture the object referenced by the finalisable one survives both ' +
          'cycles and is freed only when its holder is.'
      },
      {
        term: 'The collector manages memory and nothing else',
        plain: 'It has no idea that file descriptors, locks or sockets are scarce.',
        formal: 'the only trigger is memory pressure, so nothing else can rescue you',
        detail: 'A program that exhausts a non-memory resource while the heap is comfortable ' +
          'will simply never be rescued, and this is the classic production failure of ' +
          'finalisation. The failure is realistic in every detail: the objects are small so ' +
          'memory pressure never arrives, the resource is scarce so it runs out first, and the ' +
          'release code exists and is correct and is never called.',
        example: 'The loop exhausts a 16-handle limit at iteration 17 with 0.27 KB of a 4 KB ' +
          'heap in use and 0 collections triggered.'
      },
      {
        term: 'Explicit release is the mechanism; finalisation is the fallback',
        plain: 'try-with-resources, RAII, defer and using all put the release at a point in the program.',
        formal: 'deterministic, ordered, and impossible to resurrect from',
        detail: 'The replacement for finalisers is always the same shape, in every language ' +
          'that has walked them back: make the release lexically scoped so it happens at a ' +
          'point in the program rather than at a point in the collector. When you genuinely ' +
          'need to know that an object has gone, use the mechanism that tells you without ' +
          'letting you bring it back — a phantom reference or a cleanup action registered on ' +
          'something that is not the object. The moment your cleanup can reach the thing it is ' +
          'cleaning up, you have written a resurrection bug.',
        example: 'The explicit-close loop runs all 64 iterations with a peak of 1 open handle ' +
          'and never approaches the limit.'
      }
    ],

    'avoiding-the-collector': [
      {
        term: 'The fastest collection is the one with nothing to collect',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["tune the collector"] --> B["moves the cost around"]',
            '    C["allocate less"] --> D["removes it"]',
            '    D --> E["fewer objects to trace"]',
            '    D --> F["fewer collections triggered"]',
            '    E --> G["so measure the allocation rate<br/>before touching a single flag"]',
            '    F --> G'
          ].join('\n'),
          caption: 'Collector tuning is where the attention goes and allocation rate is where the wins are. One of them changes when the work happens; the other stops it existing.'
        },
        plain: 'Allocation rate is the first thing to measure and the first thing to attack.',
        formal: 'GC cost is a function of what you allocate, which is a property of your code',
        detail: 'It is measurable long before any tuning flag is worth touching, and unlike ' +
          'every collector parameter it is something you can change. The demo makes the case ' +
          'in its bluntest form: three programs, one answer, and the collector work behind them ' +
          'going from a real number to zero without a flag, a collector choice or a heap size ' +
          'being touched.',
        example: '84 allocations against 1 for the same answer of 820, with GC work going from ' +
          '70 units to 0.'
      },
      {
        term: 'Escape analysis is already running and it does less than you hope',
        plain: 'An allocation whose value never leaves the frame can live on the stack.',
        formal: 'if no alias of the value is returned, captured or stored, it does not escape',
        detail: 'The reason per allocation is what makes the analysis actionable rather than a ' +
          'score. "Returned" is exact and there is nothing to be done about it. "Passed to a ' +
          'call, which this analysis cannot see into" is a conservative answer that an ' +
          'interprocedural summary would improve, and it is where restructuring can help. ' +
          'Collapsing the two into one number gives you a percentage nobody can act on, which ' +
          'is the same discipline M29 applied when it built this pass.',
        example: 'The allocation-heavy program has 5 allocations of which 3 never leave their ' +
          'frame; the two that escape are both returned.'
      },
      {
        term: 'Scalar replacement is the stronger version: do not allocate at all',
        plain: 'If an object is only read field by field, its fields can live in registers.',
        formal: 'the object never exists, so it has no header, no address and no collector cost',
        detail: 'This is why a small short-lived record in a hot loop often costs literally ' +
          'nothing, and why measuring an allocation in a microbenchmark can produce a figure ' +
          'that is impossible to reproduce in the real program — the benchmark kept the object ' +
          'alive by observing it. The requirement is strict: the object must never be passed ' +
          'anywhere as a whole, which a single call or a single store into another object ' +
          'defeats.',
        example: 'Both closures and the array literal in the heavy program are reported as ' +
          'never leaving their frame, which is the precondition for either treatment.'
      },
      {
        term: 'The fix is usually "stop building one per iteration", not "stop using objects"',
        plain: 'Look for a slope in the allocation curve rather than a constant.',
        formal: 'a constant allocation count is a fixed cost; a slope grows with traffic',
        detail: 'The middle programme in the demo keeps the record type and the loop and simply ' +
          'builds one record at the end instead of one per pass, and that is the shape of most ' +
          'real fixes. It also explains what to look for in a profile: the site with the ' +
          'largest count is often a fixed cost you can ignore, and the site whose count tracks ' +
          'your request rate is the one to change.',
        example: 'The heavy program allocates 84 objects at 40 iterations and 164 at 80; the ' +
          'other two allocate 3 and 1 at both.'
      },
      {
        term: 'Object pooling reintroduces manual memory management',
        plain: 'A pooled object handed back while somebody holds it is a use-after-free.',
        formal: 'the pool takes ownership decisions the collector was making for you',
        detail: 'All four failure modes from 31.1 come back with it: release-while-held is a ' +
          'use-after-free with exactly the symptoms of one, releasing twice corrupts the pool, ' +
          'and a pool that grows without bound is a leak the collector cannot help with. It ' +
          'also defeats the generational collector, because every pooled object is old and ' +
          'every value stored into one is an old-to-young pointer the write barrier has to ' +
          'record — a cost that does not appear in the microbenchmark where the pool was ' +
          'justified.',
        example: '31.4 measures that barrier at 262 to 786 units of store cost on a trace with ' +
          'only 262 pointer stores; a pooled workload has far more.'
      },
      {
        term: 'An arena is the honest version, for phase-structured work',
        plain: 'Allocate everything for one request from one region; release the region at the end.',
        formal: 'no per-object bookkeeping, no fragmentation, one lifetime for the whole phase',
        detail: 'The constraint — nothing may outlive the phase — is checkable at exactly the ' +
          'point where it matters, which is what makes an arena safer than a pool despite ' +
          'being the same idea. Request handling, compilation passes and frame-based rendering ' +
          'are all naturally phase-structured, and the arena is why those workloads can have ' +
          'almost no collector involvement without anybody managing individual lifetimes.',
        example: 'M02\'s arena section measured this directly; here it is the fourth lever, and ' +
          'it fails exactly when something outlives the phase.'
      },
      {
        term: 'Off-heap buffers and value types remove objects rather than allocations',
        plain: 'One object holding a million numbers is one thing to trace; a million boxed numbers is a million.',
        formal: 'the collector\'s cost is per object, so flattening attacks the right term',
        detail: 'A typed array here, a ByteBuffer elsewhere, a flattened struct array in a ' +
          'language with value types: all three replace N headers, N pointer chases and N ' +
          'things to mark with one. This is the only lever on the list that scales without a ' +
          'hazard attached, and it is why every major managed language is working on value ' +
          'types. The trade is that layout and lifetime for that buffer become your problem.',
        example: 'At 8 bytes of header per object, a million small objects is 8 MB of metadata ' +
          'before any data — the same arithmetic as 31.1\'s header table.'
      },
      {
        term: 'The answer must not move',
        plain: 'An allocation reduction that changes the result is not an optimisation.',
        formal: 'check the output, do not reason about it',
        detail: 'Every row of the comparison prints what the programme computed alongside what ' +
          'it allocated, and the answer column is the first one to read. This is the same ' +
          'discipline the differential testing in M29 and M30 applied to compiler passes, and ' +
          'it matters more here because allocation-reduction changes are usually made by hand ' +
          'under time pressure, on code that was working.',
        example: 'All three programmes compute 820, and the metric that says so is on the panel ' +
          'rather than in a comment.'
      }
    ],

    'diagnosing-gc': [
      {
        term: 'A managed leak is a reference you forgot you were holding',
        plain: 'Every object in the dump is genuinely reachable and the collector is right.',
        formal: 'the live set is growing, so no collector setting can change it',
        detail: 'This is why no flag, no heap size and no collector choice will fix it, and why ' +
          'the diagnosis is about your object graph rather than about the runtime. It is also ' +
          'why the first instinct — enlarge the heap — is exactly wrong: it moves every number ' +
          'in the log, delays the symptom, and diagnoses nothing.',
        example: 'The sizing sweep changes collections from 1 922 to 13 and throughput from ' +
          '0.008 to 0.699, and the retained-bytes line is unchanged at every setting.'
      },
      {
        term: 'Four shapes cover almost everything',
        plain: 'An unevicted cache, an undereigstered listener, a thread-local, a closure capturing too much.',
        formal: 'each is a long-lived holder acquiring references it never releases',
        detail: 'They are worth memorising because the diagnosis for each is different in the ' +
          'tool. A cache is one object with an enormous retained size and thousands of ' +
          'children. A listener list is many short paths through one collection. A ' +
          'thread-local is a path whose root is a thread rather than a static. And a closure ' +
          'is a small object with a surprising retained size, because a lambda that reads one ' +
          'integer field captures the whole enclosing object.',
        example: 'The demo\'s leak is the first shape, and it produces a retaining path 368 ' +
          'hops long from a single root.'
      },
      {
        term: 'Read the GC log for the trend, not for any single line',
        plain: 'Bytes after each full collection is the number that matters.',
        formal: 'rising bytes-after-collection is the live set growing; everything else is effort',
        detail: 'Pause lengths and collection counts rise for a busy program and for a leaking ' +
          'one alike, so neither distinguishes them. The bytes remaining after a FULL ' +
          'collection is the only line in a GC log that does, because a full collection has ' +
          'reclaimed everything reclaimable by definition. A log full of minor collections ' +
          'says nothing about the live set at all.',
        example: 'The log shows a major collection taking the heap from 16 416 bytes to 11 776 ' +
          'and 413 survivors of 579; that floor is the number to watch across majors.'
      },
      {
        term: 'Allocation rate and promotion rate are different diagnoses',
        plain: 'A busy nursery is fine; objects surviving it are not necessarily.',
        formal: 'promoted bytes over allocated bytes is the ratio to instrument',
        detail: 'A high allocation rate with a low promotion rate is a program the nursery is ' +
          'handling, and the fix, if any, is 31.8. A high promotion rate means objects are ' +
          'surviving the nursery, which is either a genuine working-set change or the ' +
          'beginning of a leak — and it is the number that moves first when somebody adds a ' +
          'cache or starts holding a reference the previous release did not hold.',
        example: 'This workload promotes 16 920 bytes of 67 872 allocated — 24.9 per cent — ' +
          'which is high, and the leak is why.'
      },
      {
        term: 'A heap dump shows what is retained, never what is garbage',
        plain: 'A collection runs before the snapshot, so everything in it is live.',
        formal: 'the only question a dump answers is which reference is doing the retaining',
        detail: 'People open a dump expecting to find the garbage and there is none, which is ' +
          'why the object list is the wrong view and the dominator tree is the right one. It ' +
          'also means a dump cannot tell you about allocation churn at all — a program ' +
          'allocating a million objects a second that all die immediately produces the same ' +
          'dump as one allocating none.',
        example: 'The snapshots here drop every unreachable object before analysis, which is ' +
          'what a real snapshot tool gives you.'
      },
      {
        term: 'Retained size is dominance over the object graph',
        plain: 'If I drop this one reference, how much memory comes back.',
        formal: 'A dominates B if every path from a root to B goes through A',
        detail: 'The retained size of an object is the total size of everything it dominates, ' +
          'which is exactly the memory that would be freed if it became unreachable. That is a ' +
          'prediction the tool can make and you cannot, because it requires the whole graph — ' +
          'and it is computed by the same dominator pass M13 built for control-flow graphs, ' +
          'unchanged. Sorting by shallow size instead always points at whatever class is ' +
          'physically largest, which is never the leak; it is what the leak is holding.',
        example: 'The root object here occupies 40 bytes itself and dominates 12 248, so ' +
          'dropping one reference returns 12 248 of a 12 432-byte heap.'
      },
      {
        term: 'Compare two snapshots rather than reading one',
        plain: 'A cache doing its job and a cache with no eviction look identical at one instant.',
        formal: 'difference the retained size by allocation site across two dumps',
        detail: 'A single dump tells you what is big, which is usually something legitimately ' +
          'big. Two dumps taken far apart tell you what is GROWING, and the site with the ' +
          'largest gain is the leak nine times out of ten. The output is also actionable in a ' +
          'way a size is not: a site names a construct in the source, which turns "the heap is ' +
          'growing" into a line of code to look at.',
        example: 'Between the two snapshots one site goes from 32 objects retaining 920 bytes ' +
          'to 61 retaining 1 880 — a gain of 960.'
      },
      {
        term: 'Measure stability over the second half of the run',
        plain: 'The first half is warm-up, and a slope measured across it says "growing" for a healthy start.',
        formal: 'sample retained bytes after the warm-up and take the slope against the mean',
        detail: 'Every leak-hunting tool has this problem and every one of them gets it wrong ' +
          'at least once: a program filling its caches for the first time looks exactly like a ' +
          'program leaking, because it is growing. The verdict has to be a measurement over a ' +
          'window where the program has reached steady state, and it has to be a slope rather ' +
          'than a comparison of two points, because two points on a sawtooth prove nothing.',
        example: 'With no leak the samples run 2 128 to 2 168 and back, for a slope of 0.0; ' +
          'with the leak the slope is 1 040 bytes per sample and the verdict flips.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
