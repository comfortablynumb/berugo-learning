/** Worked examples for shapes, runtime metadata and measurement (M30.8-M30.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'inline-caches': [
      {
        title: 'The same fields, written the other way round',
        goal: 'Price the advice about constructor field order.',
        setup: 'One access site reads the same field from a thousand records. The records ' +
          'carry identical fields; the only thing that changes is the order they were written ' +
          'in.',
        steps: [
          { do: 'Build every record the same way and read the cost per access.',
            why: 'The monomorphic baseline.',
            work: '1.00 per access, with 999 hits and 1 miss' },
          { do: 'Write one of them in the other order and read it again.',
            why: 'Nothing else about the program changed.',
            work: '1.50 per access — the site is polymorphic now' },
          { do: 'Write them in every possible order.',
            why: 'The end of the curve.',
            work: '5.99 per access, with 0 hits and 1 000 misses' },
          { do: 'Count the shapes each construction produces.',
            why: 'The cost is a consequence of the shape count.',
            work: '4 shapes, then 7, then 16 — from 3 field names' },
          { do: 'Check the same effect in a real Berugo program.',
            why: 'The IR keeps the order the source wrote.',
            work: '3 records over 5 shapes, two of them carrying the same 2 fields' }
        ],
        answer: 'The same fields and the same reads cost 1.50× more when one record is written ' +
          'the other way round, and 5.99× when every order appears. Nothing about the program ' +
          'is different — both constructors are correct, both read identically, and the price ' +
          'is paid at some other site entirely, on every access, forever. That is why the ' +
          'advice sounds superstitious: the cost is never visible where the decision is made.'
      },
      {
        title: 'A cliff, not a gradient',
        goal: 'Find the discontinuity in the cost of polymorphism.',
        setup: 'One site is shown one, two, three, four, five and eight shapes over the same ' +
          'number of accesses, and the cost per access is measured at each.',
        steps: [
          { do: 'Read the cost from one shape to four.',
            why: 'The polymorphic cache checks its entries in turn.',
            work: '1.00, 1.50, 2.00, 2.50 — half a unit per extra shape' },
          { do: 'Read the cost at five shapes.',
            why: 'One more than four.',
            work: '7.98 — more than three times the cost of four' },
          { do: 'Read the hit counts either side of that step.',
            why: 'The mechanism, not just the number.',
            work: '996 hits at four shapes and 0 at five' },
          { do: 'Read the cost at eight shapes.',
            why: 'Past the cliff the slope is different again.',
            work: '10.98, growing with the field count rather than the shape count' },
          { do: 'Say what the cache did at the step.',
            why: 'Giving up is a decision rather than a failure.',
            work: 'the list of 5 entries costs more to walk than the lookup it replaced' }
        ],
        answer: 'Cost per access rises by half a unit for each of the first four shapes and ' +
          'then triples at the fifth, because the cache stops caching. That is what makes "one ' +
          'more implementation of this interface" a performance question rather than a design ' +
          'one: most of the time it costs a little, and once in a while it takes a site from ' +
          'monomorphic-plus-a-bit to the dictionary lookup the whole mechanism existed to ' +
          'avoid.'
      }
    ],

    'runtime-support': [
      {
        title: 'A stack map checked against what the program does next',
        goal: 'Get the direction of a precision check the right way round.',
        setup: 'A stack map lists the locations live across a safepoint. The check runs the ' +
          'program, opens an observation at each safepoint, and records what that frame reads ' +
          'before writing until it returns.',
        steps: [
          { do: 'Count the safepoints in the fault fixture.',
            why: 'Only calls and allocations need a map.',
            work: '5 of its 31 instructions' },
          { do: 'Read what the maps promise, summed.',
            why: 'The metadata a collector would consult.',
            work: '8 live registers across those 5 safepoints' },
          { do: 'Run the whole suite and count the reads observed after a safepoint.',
            why: 'This is the set the map has to cover.',
            work: '44 register reads across 26 safepoints' },
          { do: 'Count the ones the map missed.',
            why: 'A missed root is an object freed while something needs it.',
            work: '0' },
          { do: 'Count the locations mapped that the run never read.',
            why: 'The other direction, which is slack rather than a bug.',
            work: '0 here — the map is exactly the dynamic live set on this suite' }
        ],
        answer: 'Zero missed and zero slack across 26 safepoints. The first number has to be ' +
          'zero and the second does not, and confusing them is the commonest way to write this ' +
          'check backwards: a first version compared the map against what the FRAME held and ' +
          'reported 15 failures, every one of them a register still holding an object the ' +
          'program would never read again. That absence is precision, which is the entire ' +
          'point of a stack map — a collector that scanned those would keep dead objects alive.'
      },
      {
        title: 'One field, three consumers',
        goal: 'Show that a trace, a source map and a root set are the same metadata.',
        setup: 'Every bytecode instruction carries the span of the construct it came from, ' +
          'kept through M28\'s desugaring and every M29 pass. The fault fixture indexes past ' +
          'the end of an array, two calls deep.',
        steps: [
          { do: 'Count the instructions that carry a span.',
            why: 'Two fields per instruction is the whole cost.',
            work: '27 of 31, over 3 lines of source' },
          { do: 'Read the stack trace at the fault.',
            why: 'These frames exist for one instant.',
            work: '3 frames, each naming a construct and a line' },
          { do: 'Read the innermost frame.',
            why: 'The trace names the construct, not the offset.',
            work: 'pick, a returnStmt on line 1, holding xs and at' },
          { do: 'Read the source map for the same function.',
            why: 'It is the same field, tabulated instead of walked.',
            work: '16 instructions, each with its line and the source text at that span' },
          { do: 'Say what a third consumer of the same field is.',
            why: 'This is why the obligation falls on every pass.',
            work: 'the 5 stack maps, which are the same walk asked about liveness' }
        ],
        answer: 'One field per instruction, read three ways: forwards it is a source map, at a ' +
          'fault it is a stack trace, and combined with liveness it is a garbage collector\'s ' +
          'root set. That is why a back end that does not carry spans has not omitted a ' +
          'feature but foreclosed three — and why the obligation is on every pass rather than ' +
          'on the code generator, since a scheduler that moves an instruction has to move its ' +
          'span with it.'
      }
    ],

    'measuring-a-runtime': [
      {
        title: 'The same work, measured twice',
        goal: 'Show what the protocol is worth by breaking it.',
        setup: 'One benchmark, four execution modes, measured properly and then the way people ' +
          'actually measure: one run, warm-up counted, result discarded.',
        steps: [
          { do: 'Read the properly measured figure for the register VM.',
            why: 'Warm-up discarded, several runs, the median reported.',
            work: '0.249 ms, median of 7 runs after 3 discarded' },
          { do: 'Read the naive figure for the same mode.',
            why: 'One run, from cold.',
            work: '0.326 ms — 31% higher for identical work' },
          { do: 'Read the spread across the proper sample.',
            why: 'A number without its spread cannot be compared to anything.',
            work: '0.059 ms for the register VM and 0.416 ms for the JIT' },
          { do: 'Compare that spread against the differences between modes.',
            why: 'This is the check almost nobody performs.',
            work: '0.416 ms of spread against a 0.188 ms gap between the fastest and slowest median' },
          { do: 'Read the deterministic column instead.',
            why: 'A dispatch count is the same on every machine.',
            work: '4 810 dispatches for the register VM against 9 614 for the stack VM' }
        ],
        answer: 'The naive figure is 31% higher for the same work, and on the JIT the spread ' +
          'across seven runs is wider than the entire difference between the four modes — so ' +
          'any ranking taken from a single sample here would be noise. That is the argument ' +
          'for the protocol in one table: not that the proper figure is more flattering, but ' +
          'that without the spread beside it nobody can tell whether a difference is real.'
      },
      {
        title: 'Does the benchmark measure the loop or the harness',
        goal: 'Run the four-line check that catches the commonest microbenchmark lie.',
        setup: 'The same loop is run at five input sizes and the cost per iteration is ' +
          'reported. A flat column means the loop is doing the work.',
        steps: [
          { do: 'Read the dispatch count at 25 and at 400 iterations.',
            why: 'A sixteenfold change in input.',
            work: '410 dispatches against 6 410' },
          { do: 'Read the cost per iteration at each end.',
            why: 'This is the column that answers the question.',
            work: '16.40 against 16.02 — flat, so the loop really is the work' },
          { do: 'Say what a falling column would have meant.',
            why: 'The failure this check exists to catch.',
            work: 'a fixed cost dominating — 1 number, however large the input' },
          { do: 'Count the ways the demo lists that a benchmark can lie.',
            why: 'None of them makes it fail.',
            work: '6, every one of them silent' },
          { do: 'Check the correctness table before reading any timing.',
            why: 'A mode that computes something else is not faster.',
            work: '59 comparisons, 0 disagreements, 9 programs outside the wasm subset' }
        ],
        answer: 'Cost per iteration falls from 16.40 to 16.02 across a sixteenfold change in ' +
          'input, which is flat to within the small fixed cost of entering the program — so ' +
          'this benchmark is measuring the loop. The check is four lines and catches the ' +
          'commonest way a microbenchmark lies. And the correctness table comes first ' +
          'deliberately: the timings are only meaningful for modes already shown to compute ' +
          'the same thing, which is the same ordering M29 put on every optimisation pass.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
