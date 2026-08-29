/** Concepts for shapes, runtime metadata and measurement (M30.8-M30.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'inline-caches': [
      {
        term: 'A property read is a hash lookup, and that is too slow',
        plain: 'The name has to be found in a map, on every access, in the hot path.',
        formal: 'reading a field of a dynamically-shaped object costs a probe rather than an offset',
        detail: 'In a language where an object is a map from names to values, every field read ' +
          'is a lookup, and property reads are among the commonest operations a program ' +
          'performs. Every fast dynamic-language runtime is built around avoiding that cost, ' +
          'and everything in this section — shapes, transition trees, inline caches — is the ' +
          'machinery of the avoidance. Nothing about it is visible in the language.',
        example: 'A megamorphic site here costs 7.98 units per access where a monomorphic one ' +
          'costs 1.00.'
      },
      {
        term: 'A shape is the set of fields, in the order they were added',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an empty object"] --> B["add x → shape {x}"]',
            '    B --> C["add y → shape {x, y}"]',
            '    D["another empty object"] --> E["add x → the SAME shape {x}"]',
            '    E --> F["add y → the same {x, y}"]',
            '    C --> G["same history, same shape,<br/>so the cache hits"]',
            '    F --> G'
          ].join('\n'),
          caption: 'Objects built by the same code path share a shape, which is why a constructor is fast and building the same object field-by-field in a different order is not.'
        },
        plain: 'Give that an identity and objects with the same history share it.',
        formal: 'the offset of a field is a property of the shape, not of the object',
        detail: 'Once the shape is shared, a field\'s position inside the object is fixed for ' +
          'every object of that shape, so reading it becomes a check on the shape followed by ' +
          'a load at a constant offset. That is the entire trick, and the reason it works is ' +
          'that real programs build enormous numbers of objects the same way — a constructor ' +
          'runs the same statements every time.',
        example: 'The two-order fixture builds 3 records over 5 shapes, two of them carrying ' +
          'the same two fields in different orders.'
      },
      {
        term: 'Shapes form a transition tree',
        plain: 'Adding a field follows an existing edge if there is one, and makes one if not.',
        formal: 'a thousand objects built the same way allocate one path and share every node',
        detail: 'The tree is why shapes are cheap to create: the common case allocates nothing ' +
          'at all, because the transition already exists. It is also why order matters. Adding ' +
          'x then y and adding y then x are two different paths from the root, so they end at ' +
          'two different nodes carrying identical fields — and no amount of later analysis can ' +
          'merge them, because their layouts genuinely differ.',
        example: 'The two-order fixture produces 5 shapes and 4 transitions from records with ' +
          'only 2 distinct field names.'
      },
      {
        term: 'An inline cache is the memo at the access site',
        plain: 'Remember the shape you saw and the offset you found, then check one word.',
        formal: 'if the shape matches, load at the remembered offset; otherwise look it up and remember',
        detail: 'The cache lives at the access site rather than on the object, which is what ' +
          'makes it inline: one site in the source has one cache, and a hot loop reading the ' +
          'same field of the same kind of object hits it every time. The check is a single ' +
          'comparison, which is the same shape of mechanism as the JIT\'s type guard in 30.7 ' +
          'and rests on the same reasoning.',
        example: 'A monomorphic site here spends 999 hits against 1 miss over 1000 accesses.'
      },
      {
        term: 'Monomorphic, polymorphic, megamorphic',
        plain: 'One shape, a few shapes, or too many to be worth remembering.',
        formal: 'past a small limit the cache stops caching and does the lookup every time',
        detail: 'The three states are not degrees of the same thing. Monomorphic is one ' +
          'comparison. Polymorphic is a short list walked in turn, so its cost grows with the ' +
          'number of entries. Megamorphic is the cache having decided that the list now costs ' +
          'more to walk than the lookup it was replacing, and giving up — which is a deliberate ' +
          'decision rather than a failure, and is why the cost curve has a step in it.',
        example: 'Cost per access goes 1.00, 1.50, 2.00, 2.50 for one to four shapes and then ' +
          'jumps to 7.98 at five.'
      },
      {
        term: 'Construction order is a performance decision',
        plain: 'The same fields written two ways make two shapes and cost every reader.',
        formal: 'a site reading from both shapes cannot be monomorphic',
        detail: 'This is why the familiar advice to initialise every field in the constructor ' +
          'in a fixed order is not style. The cost is invisible where the mistake is made: ' +
          'both constructors are correct, both read identically, and the price is paid at some ' +
          'other site that reads from both, on every access, forever. The same applies to ' +
          'adding a property later and to conditionally initialising one.',
        example: 'The same fields and the same reads cost 1.50x more when one record is written ' +
          'in the other order.'
      },
      {
        term: 'Adding a field later moves the object',
        plain: 'It does not modify the shape; it transitions to a different one.',
        formal: 'mutation after construction produces an object with a different shape from its siblings',
        detail: 'Because a shape is immutable and shared, giving an object a new field means ' +
          'giving it a new shape — so an object mutated after construction no longer matches ' +
          'the ones built beside it. A site that has seen both is polymorphic again. Runtimes ' +
          'that see enough of this give up on shapes for that object entirely and fall back to ' +
          'a per-object dictionary, which is the slow path for the rest of its life.',
        example: 'The growing fixture builds one field, then two, then three, and produces one ' +
          'shape per prefix rather than one shape reused.'
      },
      {
        term: 'Method dispatch is the same problem',
        plain: 'Which implementation is the same question as which offset.',
        formal: 'cache the receiver kind and the target, with the same three states',
        detail: 'A call through an interface has to find the implementation for this receiver, ' +
          'and that lookup is cached the same way, with the same monomorphic, polymorphic and ' +
          'megamorphic states and the same cliff. Hölzle, Chambers and Ungar introduced ' +
          'polymorphic inline caches for method dispatch first, and property access inherited ' +
          'the technique — which is why "one more implementation of this interface" is a ' +
          'performance question.',
        example: 'The state sweep applies unchanged to dispatch: the step from 4 shapes to 5 is ' +
          'the step from 4 implementations to 5.'
      }
    ],

    'runtime-support': [
      {
        term: 'The runtime boundary is an agreement, not a discovery',
        plain: 'Both sides have to honour rules neither can infer from the other.',
        formal: 'argument placement, frame allocation, result placement, and when a collection may run',
        detail: 'Compiled code and the runtime meet at an interface with no type checker across ' +
          'it, so every rule is a convention. The reason to write them down as a table is that ' +
          'each one is invisible in the code of either side and catastrophic when the two ' +
          'disagree — which is exactly the situation that calls for a specification rather ' +
          'than a shared memory of how it works.',
        example: 'The demo lists 5 rules, each with the specific failure that follows from ' +
          'breaking it.'
      },
      {
        term: 'A safepoint is where a collection may happen',
        plain: 'Calls and allocations, and nothing else needs a map.',
        formal: 'restrict the points that need metadata, or the metadata is larger than the code',
        detail: 'A garbage collector cannot run at an arbitrary instruction, because the ' +
          'compiler has to have described the frame at whatever point it does run. Restricting ' +
          'the possibilities to calls and allocations is what keeps the number of stack maps ' +
          'small, and it costs nothing: those are the only instructions that can trigger a ' +
          'collection in the first place.',
        example: 'The fault fixture has 5 safepoints among 31 instructions, and the other 26 ' +
          'need no metadata at all.'
      },
      {
        term: 'A stack map is what is live, not what is present',
        plain: 'The register still holding a dead object is deliberately left out.',
        formal: 'a location is in the map when the program reads it after this point',
        detail: 'This is the difference between precise and conservative collection and it is ' +
          'easy to get backwards. A value nothing will read again is not a root: scanning it ' +
          'would keep a dead object alive, and everything that object points at with it. So ' +
          'the map\'s omissions are the feature, and the compiler is the only thing that can ' +
          'produce them, because only it has seen what the program does next.',
        example: 'Across the suite the map omits every dead location and misses 0 of the 44 ' +
          'registers the runs actually read.'
      },
      {
        term: 'The bug direction needs the program run',
        plain: 'A location the program reads, missing from the map, frees a live object.',
        formal: 'check the map against what the run reads next, not against what the frame holds',
        detail: 'Whether a location should be in the map is a question about the future, so a ' +
          'check that inspects the frame at the safepoint answers the wrong question — it ' +
          'reports every dead-but-present value as a failure. The right check opens an ' +
          'observation at each safepoint and records what that frame goes on to read before ' +
          'writing, which is a dynamic liveness oracle in the same style M29 used everywhere.',
        example: 'The first version of this check reported 15 failures across the suite, all of ' +
          'them the collector being precise rather than wrong.'
      },
      {
        term: 'Conservative collection is the alternative',
        plain: 'Without maps, treat anything that looks like a pointer as one.',
        formal: 'scan every word; retain anything that could be a reference',
        detail: 'It works, it needs no compiler cooperation at all, and it is what a collector ' +
          'bolted onto an uncooperative language has to do. The costs are that dead objects ' +
          'are retained whenever an integer happens to look like an address, and that objects ' +
          'can never be moved — because moving means updating every reference, and a ' +
          'conservative collector does not know which words really are references.',
        example: 'Every one of the 5 safepoints here carries a precise map, which is what makes ' +
          'a moving collector possible in M31.'
      },
      {
        term: 'A stack trace is the same metadata read differently',
        plain: 'Each frame is at an instruction, and each instruction carries a source span.',
        formal: 'the span names a line; the frame list names the chain',
        detail: 'M28 spent a milestone making spans survive desugaring and M29 kept them ' +
          'through every optimisation pass, and this is the section where that pays. A trace ' +
          'that names bytecode offsets is a trace nobody can act on; a trace that names the ' +
          'construct and the line is the difference between a bug report and a puzzle. The ' +
          'cost is two fields per instruction.',
        example: 'The fault fixture traces 3 frames, each naming the construct and the source ' +
          'line it was executing.'
      },
      {
        term: 'A source map is pc to line, and it is the same field',
        plain: 'One table serves the debugger, the profiler and the trace.',
        formal: 'each instruction records the span of the construct it was lowered from',
        detail: 'Because the mapping is stored per instruction rather than per statement, it ' +
          'survives reordering: a scheduler that moves an instruction moves its span with it, ' +
          'and a pass that deletes one deletes both. That is what makes the mapping still ' +
          'correct after optimisation, and it is why the obligation falls on every pass rather ' +
          'than on the code generator alone.',
        example: 'The fault fixture keeps a span on 27 of its 31 instructions, over 3 lines of ' +
          'source.'
      },
      {
        term: 'Inlining is what makes both hard',
        plain: 'An inlined frame does not exist, so it has to be reconstructed.',
        formal: 'record the frame that was deleted, or the trace and the root set are both wrong',
        detail: 'When the optimiser inlines a call, the callee\'s frame is gone at runtime — but ' +
          'a stack trace has to show it and a deoptimisation has to recreate it. The metadata ' +
          'that solves both is the same, and it is the same metadata 30.7 needs to fall back ' +
          'to the interpreter. Three features, one obligation, which is why a runtime that ' +
          'skips it loses all three at once.',
        example: 'The demo\'s trace is a real frame chain because nothing is inlined here; the ' +
          'metadata is what would make it survive inlining.'
      }
    ],

    'measuring-a-runtime': [
      {
        term: 'A single timing is not a measurement',
        plain: 'One number from a distribution nobody looked at.',
        formal: 'report the median with the spread and the number of runs',
        detail: 'The figure has variance behind it — scheduler noise, cache state, which tier ' +
          'happened to be running — and a report that hides all of it cannot be evaluated by ' +
          'anybody else. Reporting the middle with the range and the count is the minimum, and ' +
          'it is also the cheapest possible defence against being fooled by a run that ' +
          'happened to be fast.',
        example: 'On this benchmark the widest spread across modes is 0.416 ms, which is larger ' +
          'than several of the differences between modes.'
      },
      {
        term: 'Warm-up is a phase, not noise',
        plain: 'On a tiered runtime the first runs are a different program.',
        formal: 'run the warm-up and discard it, then sample',
        detail: 'The first iterations run interpreted, the next in a baseline tier, and the ' +
          'rest in optimised code, and those are three different programs with three different ' +
          'costs. Averaging over all of them produces a figure that describes none. Discarding ' +
          'the warm-up measures steady state; measuring warm-up separately measures start-up; ' +
          'and both are real numbers somebody cares about.',
        example: 'The naive rows in the demo count warm-up in a single run and report a ' +
          'different number for the same work.'
      },
      {
        term: 'A discarded result may be deleted',
        plain: 'An optimiser is entitled to remove work nobody observes.',
        formal: 'consume the result and report something derived from it',
        detail: 'This is the classic microbenchmark pathology and it is not hypothetical: if ' +
          'nothing reads the value the loop computes, the whole loop is dead code and a ' +
          'sufficiently good compiler will say so. The benchmark then reports the cost of an ' +
          'empty loop, confidently, with no indication that anything went wrong. Consuming the ' +
          'result costs nothing and makes the work observable.',
        example: 'The harness here reports a checksum derived from every run so nothing in it ' +
          'is unobserved.'
      },
      {
        term: 'Constant inputs get folded',
        plain: 'If the compiler can see every input, it can compute the answer once.',
        formal: 'make the input opaque, or scale it and check the cost scales',
        detail: 'Constant folding is exactly the pass M29.6 built, and a benchmark with literal ' +
          'inputs is its ideal target: the whole computation is available at compile time. The ' +
          'cheap check is to run the same workload at several sizes and look at the cost per ' +
          'item — a flat column means the loop is doing the work, and a falling one means a ' +
          'fixed cost is dominating.',
        example: 'The scaling table runs the same loop at 25 to 400 iterations and reports ' +
          '16.40 down to 16.02 dispatches per iteration.'
      },
      {
        term: 'Compile time belongs in its own column',
        plain: 'A runtime that compiles aggressively wins long runs and loses short ones.',
        formal: 'time the compilation separately from the execution',
        detail: 'A single time-to-complete figure adds the compiler and the program together ' +
          'in a proportion the reader cannot recover, so two runtimes with very different ' +
          'strategies produce one number each and no way to tell what happened. This is the ' +
          'same latency-against-quality trade the register allocator made in 30.4, surfacing ' +
          'as a reporting problem.',
        example: 'The JIT here reports 2 compilations on the hot benchmark, and those are ' +
          'dispatches the interpreted run never paid.'
      },
      {
        term: 'A deterministic unit belongs beside the clock',
        plain: 'Milliseconds are what the user feels; dispatches are what anyone can reproduce.',
        formal: 'report a count of real work alongside the wall-clock figure',
        detail: 'A dispatch count is a genuine measure of interpreter work, is identical on ' +
          'every machine, and lets somebody else check the claim without owning the hardware. ' +
          'It is not a substitute for time — a dispatch in compiled code and one in the ' +
          'interpreter cost differently — but reporting both is what turns a benchmark into ' +
          'evidence rather than an anecdote.',
        example: 'The dispatch table reports the stack-against-register ratio at 1.76x to 2.00x ' +
          'across four benchmarks, identically on any machine.'
      },
      {
        term: 'Memory is a first-class metric',
        plain: 'Two runtimes with the same throughput are not comparable if one allocates four times as much.',
        formal: 'report peak resident memory beside the time',
        detail: 'A runtime that trades memory for speed wins a benchmark on an idle machine and ' +
          'loses on a busy one, which is every machine that matters. Leaving memory out of the ' +
          'comparison is how a result that is true in the harness becomes false in production, ' +
          'and it is the most commonly omitted axis in published language comparisons.',
        example: 'The bytecode sections of this milestone report encoded size for exactly this ' +
          'reason, at 204 bytes for one instruction set against 196 for the other.'
      },
      {
        term: 'Correctness comes before speed, in the report as well',
        plain: 'A mode that computes something else is not faster.',
        formal: 'check every mode against the reference before timing any of them',
        detail: 'It sounds obvious and it is routinely skipped, because a faster wrong answer ' +
          'looks exactly like a faster right one in a table of milliseconds. Putting the ' +
          'agreement table before the timing table in the section is a deliberate ordering: ' +
          'the timings are only meaningful for modes that have already been shown to compute ' +
          'the same thing.',
        example: '59 comparisons across 17 programs and four back ends, with 0 disagreements ' +
          'and 9 programs outside the WebAssembly subset.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
