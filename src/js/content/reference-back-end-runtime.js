/** Reference entries for shapes, runtime metadata and measurement (M30.8-M30.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'inline-caches': {
      summary: 'Hidden classes formed into a transition tree, inline caches with four states ' +
        'and a polymorphic limit, a cost model denominated in guards and scans, and the shapes ' +
        'a real Berugo program builds taken from its own record allocations.',
      intuition: 'A field read is a hash lookup unless the runtime notices that most objects at ' +
        'a site were built the same way — and "the same way" means the same fields in the same ' +
        'order, which is why construction order is a performance decision.',
      formulation: {
        equations: [
          {
            label: 'One site, a thousand accesses, three constructions',
            expr: 'construction · shapes · state · cost per access',
            terms: [
              { sym: 'one order', meaning: '4 · monomorphic · 1.00' },
              { sym: 'two orders', meaning: '7 · polymorphic · 1.50' },
              { sym: 'every order', meaning: '16 · megamorphic · 5.99' },
              { sym: 'field names involved', meaning: '3, identical in all three' }
            ]
          },
          {
            label: 'The cliff',
            expr: 'shapes seen · state · hits · cost per access',
            terms: [
              { sym: '1', meaning: 'monomorphic · 999 · 1.00' },
              { sym: '4', meaning: 'polymorphic · 996 · 2.50' },
              { sym: '5', meaning: 'megamorphic · 0 · 7.98' },
              { sym: '8', meaning: 'megamorphic · 0 · 10.98' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A shape is immutable and shared',
          why: 'The offset of a field has to be a property of the shape, or the cache has nothing to remember.',
          breaks: 'Adding a field transitions to a different shape rather than modifying this one.'
        },
        {
          name: 'The cache gives up past a fixed number of entries',
          why: 'A list long enough to check costs more than the lookup it replaced.',
          breaks: 'Past the limit the entries are discarded and every access takes the dictionary path.'
        },
        {
          name: 'The field order in the model is the order the source wrote',
          why: 'Otherwise the demonstration is about a hypothetical runtime rather than about this program.',
          breaks: 'Shapes are built from the field lists the IR\'s record instructions carry, which the front end preserved.'
        }
      ],
      complexity: [
        { operation: 'a monomorphic hit', average: 'one shape comparison and a load at a constant offset', worst: 'the same' },
        { operation: 'a polymorphic hit', average: 'up to four comparisons', worst: 'linear in the number of cached entries' },
        { operation: 'a megamorphic access', average: 'a dictionary lookup, linear in the field count', worst: 'every access, with nothing cached' },
        { operation: 'a transition', average: 'a map lookup if the edge exists, an allocation if it does not', worst: 'one shape per distinct construction path' }
      ],
      failureModes: [
        {
          symptom: 'A hot loop is slower than an identical loop elsewhere.',
          cause: 'Its access site sees objects built in two different orders, so it is polymorphic.',
          fix: 'Initialise every field in one place, in one order; the cost is never visible where the mistake is made.'
        },
        {
          symptom: 'Adding one more subclass makes an unrelated call site slow.',
          cause: 'It crossed the polymorphic limit and the cache stopped caching.',
          fix: 'Expect a cliff rather than a gradient, and measure the site rather than reasoning about the design.'
        },
        {
          symptom: 'Objects built by a factory are unexpectedly slow to read.',
          cause: 'The factory conditionally sets fields, so it produces several shapes.',
          fix: 'Set every field unconditionally, with a null or a default, so there is one shape.'
        },
        {
          symptom: 'A profiler shows time in a property read with no obvious cause.',
          cause: 'A dictionary-mode object, usually one mutated long after construction.',
          fix: 'Find where the object gains or loses a field after it is built; that is the transition that cost it.'
        }
      ],
      inTheWild: [
        'V8\'s hidden classes and transition trees, which are where most engineers first meet this.',
        'SpiderMonkey\'s shapes and JavaScriptCore\'s structures, which are the same idea under different names.',
        'The JVM\'s bimorphic inline caches at virtual call sites, and megamorphic dispatch through a vtable.',
        'CPython 3.11\'s specialising interpreter, which caches per bytecode instruction for exactly this reason.'
      ],
      sources: [
        { title: 'Hölzle, Chambers, Ungar — Optimizing dynamically-typed OO languages with polymorphic inline caches', note: 'the paper this section implements' },
        { title: 'Chambers, Ungar, Lee — An efficient implementation of SELF', note: 'maps, which became hidden classes' },
        { title: 'Deutsch and Schiffman — Efficient implementation of the Smalltalk-80 system', note: 'the monomorphic inline cache, first' },
        { title: 'V8 engineering blog — the shape of things', note: 'the production version, with the transition-tree diagrams' }
      ]
    },

    'runtime-support': {
      summary: 'A calling convention written down, stack maps computed from bytecode liveness ' +
        'and checked against a dynamic oracle, source maps and source-level stack traces from ' +
        'the spans every instruction carries, and safepoints restricted to calls and ' +
        'allocations.',
      intuition: 'Precise collection and a readable stack trace are the same question asked ' +
        'twice — at this instruction, in this frame, what is really live and where did it come ' +
        'from — and only the compiler can answer it.',
      formulation: {
        equations: [
          {
            label: 'The fault fixture',
            expr: 'measure · value',
            terms: [
              { sym: 'safepoints', meaning: '5 of 31 instructions' },
              { sym: 'live registers mapped', meaning: '8 across those safepoints' },
              { sym: 'instructions carrying a source span', meaning: '27 of 31' },
              { sym: 'frames in the trace at the fault', meaning: '3' }
            ]
          },
          {
            label: 'The suite, against a dynamic liveness oracle',
            expr: 'measure · value',
            terms: [
              { sym: 'safepoints', meaning: '26' },
              { sym: 'reads observed after them', meaning: '44' },
              { sym: 'missed by the map', meaning: '0 — the direction that is a bug' },
              { sym: 'mapped but never read', meaning: '0 — the direction that is slack' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every location the program reads after a safepoint is in that safepoint\'s map',
          why: 'A location the collector does not scan is an object it may free while something still needs it.',
          breaks: 'An observation is opened at each safepoint and every read on that frame is recorded until it returns.'
        },
        {
          name: 'A location the program will not read is deliberately absent',
          why: 'Scanning it would keep a dead object alive, and everything it points at with it.',
          breaks: 'Slack is reported separately from misses, because they are different kinds of wrong.'
        },
        {
          name: 'Every instruction carries the span of the construct it came from',
          why: 'The stack trace, the source map and the profiler all read the same field.',
          breaks: 'The bytecode carries origin and span through code generation, and the source-map table renders from them.'
        }
      ],
      complexity: [
        { operation: 'bytecode liveness', average: 'O(instructions × rounds) to a fixpoint', worst: 'bounded at 12 rounds here' },
        { operation: 'a stack map', average: 'O(live registers) per safepoint', worst: 'one row per call or allocation' },
        { operation: 'the dynamic check', average: 'O(safepoints × remaining instructions)', worst: 'one open observation per safepoint per frame' },
        { operation: 'a stack trace', average: 'O(frames)', worst: 'plus a line lookup per frame' }
      ],
      failureModes: [
        {
          symptom: 'The stack-map check reports failures on a correct compiler.',
          cause: 'It compared the map against what the frame HELD rather than against what the program reads next.',
          fix: 'Ask the question about the future, which means running the program and recording subsequent reads.'
        },
        {
          symptom: 'Objects are retained long after they are unreachable.',
          cause: 'Conservative scanning, or a map that lists dead locations.',
          fix: 'Make the map the live set; precision is what it is for.'
        },
        {
          symptom: 'A stack trace names bytecode offsets.',
          cause: 'The spans were dropped somewhere between the parser and the code generator.',
          fix: 'Carry origin and span on every instruction and make every pass preserve them.'
        },
        {
          symptom: 'Inlined frames are missing from the trace and the collector is imprecise.',
          cause: 'Both need metadata describing a frame the optimiser deleted, and it was never recorded.',
          fix: 'Record the deleted frame; one omission costs the trace, the root set and deoptimisation together.'
        }
      ],
      inTheWild: [
        'HotSpot\'s oop maps, which are stack maps by another name and are what makes its collectors moving ones.',
        'Go\'s stack maps and its precise, moving, growable stacks, which depend on them completely.',
        'The Boehm collector, which is the conservative alternative and cannot move an object.',
        'Source maps in every browser, which are the same pc-to-line idea shipped as a file.'
      ],
      sources: [
        { title: 'Jones, Hosking, Moss — The Garbage Collection Handbook', note: 'root sets, safepoints and what precision buys' },
        { title: 'Agesen — GC points in a threaded environment', note: 'where a safepoint may be and why the choice is restricted' },
        { title: 'Hölzle, Chambers, Ungar — Debugging optimized code with dynamic deoptimization', note: 'the metadata that serves traces and deopt alike' },
        { title: 'Boehm and Weiser — Garbage collection in an uncooperative environment', note: 'what you get without a compiler that cooperates' }
      ]
    },

    'measuring-a-runtime': {
      summary: 'A benchmark protocol with warm-up separated, several runs, a median with its ' +
        'spread and its run count, a deterministic dispatch column beside the clock, a scaling ' +
        'check, and the same work measured the way people usually measure it.',
      intuition: 'Almost every way a runtime benchmark lies is silent: it runs, prints a ' +
        'number, and the number is confidently about something else — so the protocol is a ' +
        'list of specific defences rather than a general instruction to be careful.',
      formulation: {
        equations: [
          {
            label: 'One benchmark, measured twice',
            expr: 'mode · median properly · median naively',
            terms: [
              { sym: 'IR interpreter', meaning: '0.288 ms · 0.434 ms' },
              { sym: 'stack VM', meaning: '0.363 ms · 0.404 ms' },
              { sym: 'register VM', meaning: '0.249 ms · 0.326 ms' },
              { sym: 'widest spread across a proper sample', meaning: '0.416 ms, on the JIT' }
            ]
          },
          {
            label: 'Dispatches, which are the same on any machine',
            expr: 'benchmark · stack · register · ratio',
            terms: [
              { sym: 'loop', meaning: '9 614 · 4 810 · 2.00' },
              { sym: 'calls', meaning: '9 416 · 5 012 · 1.88' },
              { sym: 'branchy', meaning: '11 864 · 6 760 · 1.76' },
              { sym: 'nested', meaning: '13 394 · 6 750 · 1.98' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every reported figure carries its run count and its warm-up',
          why: 'A number without them cannot be evaluated, compared or reproduced by anybody else.',
          breaks: 'The bench table has both as columns, and the naive rows show 1 run and 0 warm-up.'
        },
        {
          name: 'Correctness is established before any timing is reported',
          why: 'A mode that computes something else is not faster, and a table of milliseconds cannot tell.',
          breaks: 'The agreement table across every mode comes before the timings in the section.'
        },
        {
          name: 'The cost scales with the input',
          why: 'A benchmark whose cost is flat in its input is measuring its own harness.',
          breaks: 'The same loop is run at five sizes and the cost per iteration is a column.'
        },
        {
          name: 'The result is consumed',
          why: 'An optimiser may delete work nobody observes, and then the figure describes an empty loop.',
          breaks: 'Every run reports a value derived from its own output.'
        }
      ],
      complexity: [
        { operation: 'the protocol', average: 'warm-up plus sample runs of the workload', worst: 'linear in the run count, which is the point' },
        { operation: 'a dispatch count', average: 'O(1) per instruction, exact', worst: 'deterministic, so one run suffices' },
        { operation: 'the scaling check', average: 'one run per size', worst: 'four lines and it catches the commonest lie' },
        { operation: 'the cross-mode differential', average: '17 programs times four back ends', worst: '59 comparisons, since 9 are outside the wasm subset' }
      ],
      failureModes: [
        {
          symptom: 'A published benchmark cannot be reproduced.',
          cause: 'One run, no spread, no run count, and a machine nobody else has.',
          fix: 'Report the median, the spread, the count, and a deterministic unit beside the clock.'
        },
        {
          symptom: 'A microbenchmark of a loop is impossibly fast.',
          cause: 'Nothing observed the result, so the loop was deleted.',
          fix: 'Consume the value; report something derived from it.'
        },
        {
          symptom: 'A JIT-compiled language looks slower than an interpreter.',
          cause: 'The workload never reached steady state, so the figure is mostly compilation.',
          fix: 'Separate warm-up from steady state and report both as different numbers.'
        },
        {
          symptom: 'Two runtimes have identical throughput and one is unusable in production.',
          cause: 'Memory was not measured, and one of them allocates several times as much.',
          fix: 'Report peak memory beside the time; it is the most commonly omitted axis.'
        }
      ],
      inTheWild: [
        'JMH, whose entire design is defences against the mistakes in this section.',
        'The Computer Language Benchmarks Game, and the long history of arguments about what its numbers mean.',
        'Every "X is N times faster than Y" claim, which is usually missing warm-up handling and a spread.',
        'Criterion, Google Benchmark and their equivalents, which exist because the naive version is so easy to write.'
      ],
      sources: [
        { title: 'Georges, Buytaert, Eeckhout — Statistically rigorous Java performance evaluation', note: 'the paper that made warm-up and variance non-optional' },
        { title: 'Kalibera and Jones — Rigorous benchmarking in reasonable time', note: 'how many runs, and why' },
        { title: 'Mytkowicz et al. — Producing wrong data without doing anything obviously wrong', note: 'measurement bias, and how easy it is' },
        { title: 'Shipilev — JMH samples and the accompanying talks', note: 'the practical catalogue of ways a benchmark lies' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
