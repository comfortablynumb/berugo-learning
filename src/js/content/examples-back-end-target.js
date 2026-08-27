/** Worked examples for scheduling, WebAssembly and the JIT (M30.5-M30.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'machine-scheduling': [
      {
        title: 'Two cycles bought with one more live value',
        goal: 'Read a schedule as a trade rather than as an improvement.',
        setup: 'Three indexed loads feeding one sum, run through a pipeline that issues one ' +
          'instruction per cycle and makes a consumer wait for its producer\'s latency.',
        steps: [
          { do: 'Read the cycle counts for both orders.',
            why: 'The improvement, on its own.',
            work: '34 cycles in source order against 32 scheduled' },
          { do: 'Read the stall counts.',
            why: 'Cycles saved should be stalls removed, or something else is going on.',
            work: '16 stalls against 14 — the whole saving is waiting removed' },
          { do: 'Read the peak register pressure for both.',
            why: 'This is the cost side and it is easy to leave out.',
            work: '2 live values against 3' },
          { do: 'Check the schedule is legal.',
            why: 'A reordering that violates a dependence reads an undefined value.',
            work: '0 dependence violations across 28 edges' },
          { do: 'Count the instructions in each order.',
            why: 'Scheduling reorders; it does not add or remove.',
            work: '18 either way' }
        ],
        answer: 'Two cycles removed and one more value live at the peak. On this block that is ' +
          'obviously worth it, because three registers is nothing — but the same trade at a ' +
          'peak of nine on a machine with eight registers is a spill, and a spill is a store ' +
          'and a load. The scheduler cannot see that and the allocator cannot see the stalls, ' +
          'which is why real compilers schedule, allocate, and then schedule the spill code.'
      },
      {
        title: 'The ceiling a scheduler cannot break',
        goal: 'Find the point past which reordering has nothing left to do.',
        setup: 'The same block scheduled at load latencies from 1 to 16, with the cycle count, ' +
          'the stalls and the peak pressure reported at each.',
        steps: [
          { do: 'Read the cycles at latency 1 and at latency 16.',
            why: 'The whole range of the sweep.',
            work: '23 cycles against 68' },
          { do: 'Read how many cycles the schedule saved at each.',
            why: 'If reordering scaled with the latency, this would grow.',
            work: '2 at every single latency, from 1 to 16' },
          { do: 'Read the stalls at each end.',
            why: 'Where the extra cycles went.',
            work: '5 stalls at latency 1 and 50 at latency 16' },
          { do: 'Read the peak pressure across the sweep.',
            why: 'A different schedule would have a different peak.',
            work: '3 at every latency — it is the same order in every row' },
          { do: 'Say what that means about the pass.',
            why: 'The constant saving is the finding.',
            work: 'the block has 2 cycles of independent work and no more, at any latency' }
        ],
        answer: 'The saving is constant at 2 cycles across a sixteenfold change in memory ' +
          'latency, because the pass has already moved everything the dependence graph allows ' +
          'and there is no more independent work in the block to move. Past that point a ' +
          'slower memory is simply a slower program, and no amount of static reordering ' +
          'changes it. Breaking that ceiling needs hardware that finds work outside the block ' +
          'at run time, which is what out-of-order execution in M36 is for.'
      }
    ],

    'targeting-webassembly': [
      {
        title: 'A graph turned back into structure, and the two questions that do it',
        goal: 'Watch a control-flow graph become nested blocks and loops.',
        setup: 'wasm has no jumps, so the compiler asks two boolean questions of each block ' +
          'and reads the whole nesting off the answers, using the dominator tree M29.3 built.',
        steps: [
          { do: 'Count the blocks in the loop fixture.',
            why: 'The graph the front end and optimiser produced.',
            work: '4 blocks' },
          { do: 'Count how many are the target of a back edge.',
            why: 'Each of those becomes a wasm loop.',
            work: '1 — and it is also a merge point, reached from the entry and the latch' },
          { do: 'Count how many are emitted inline.',
            why: 'A block its source dominates needs no label at all.',
            work: '3 of the 4' },
          { do: 'Read the module size and the section breakdown.',
            why: 'These are real bytes a browser will accept.',
            work: '237 bytes over 5 sections, of which 168 are code' },
          { do: 'Validate and run it, then compare against the interpreter.',
            why: 'The host validates, not this compiler.',
            work: 'valid, and both bindings agree — i = 20 and t = 380' }
        ],
        answer: 'Two boolean questions per block produce the entire nesting: is it a back-edge ' +
          'target, and does it have more than one predecessor. Everything else is emitted ' +
          'where its dominator left off. That is why the dominator tree had to exist before ' +
          'this section could — and why an irreducible graph, which M29.2 could only build by ' +
          'hand, has no answer here at all rather than a worse one.'
      },
      {
        title: 'Eight of seventeen, and nine reasons',
        goal: 'State a subset instead of hiding one.',
        setup: 'Everything in a wasm module is a number, so this back end compiles the numeric ' +
          'part of the language. Every program outside it carries the reason it is outside.',
        steps: [
          { do: 'Count the conformance programs that compile.',
            why: 'The coverage of this back end.',
            work: '8 of 17, compiling to 1 177 bytes in total' },
          { do: 'Check how many of those agree with the interpreter.',
            why: 'Coverage without agreement is worthless.',
            work: '8 of 8, on outcome and every binding' },
          { do: 'Read the commonest reason for exclusion.',
            why: 'It names the piece of machinery that is missing.',
            work: '3 programs excluded for needing a heap — records and arrays' },
          { do: 'Read the reason the polymorphic program is excluded.',
            why: 'This one is not about a missing feature.',
            work: '1 binding with no single numeric type, so its value cannot be read back' },
          { do: 'Say what a back end that hid the excluded programs would report.',
            why: 'This is the number the reasons exist to prevent.',
            work: '8 of 8 agreeing, which is 100% of nothing in particular' }
        ],
        answer: 'Eight programs compile, validate and agree, and nine carry a reason. The ' +
          'reasons are the shape of the work a real wasm back end for a dynamic language has ' +
          'to do: linear memory and an allocator for the heap, a tagged value representation ' +
          'so a Bool is distinguishable from the number 1, and a monomorphic type at every ' +
          'observable — which is why such back ends either box every value or specialise per ' +
          'call site.'
      }
    ],

    'jit-compilation': [
      {
        title: 'A function crossing two thresholds without ever being re-entered',
        goal: 'Watch on-stack replacement do the thing a counter cannot.',
        setup: 'The hot fixture is one loop at the top level, so the function is entered ' +
          'exactly once and an entry counter would never cross anything.',
        steps: [
          { do: 'Count the tier transitions and where they happen.',
            why: 'The timeline is the policy, executed.',
            work: '4 transitions, at dispatch 964 and dispatch 3 204' },
          { do: 'Read how many of the compilations were entered through a back edge.',
            why: 'A function entered once cannot be promoted by an entry counter.',
            work: '2 of 2 — both are on-stack replacements' },
          { do: 'Read the profile the optimising tier speculated on.',
            why: 'A guard needs evidence.',
            work: '4 sites, all 4 monomorphic on numbers, with about 400 samples each' },
          { do: 'Count the guarded fast paths emitted.',
            why: 'One per site the profile justified.',
            work: '4, and 0 of them failed during the run' },
          { do: 'Compare against a run with every tier disabled.',
            why: 'Speculation is the one place the compiler assumes something unproven.',
            work: 'all 4 observables agree — value, output, outcome and every binding' }
        ],
        answer: 'Both compilations are entered at a loop back edge, because the top level runs ' +
          'once. Without on-stack replacement the hottest code in this program would be ' +
          'interpreted forever, which is the whole reason the mechanism exists. Here the ' +
          'transfer is nearly free because the compiled code runs on the same frame object; on ' +
          'a real machine it means rebuilding a compiled frame from an interpreter one, which ' +
          'needs the same metadata deoptimisation does.'
      },
      {
        title: 'Three hundred numbers, then two strings',
        goal: 'Make a guard fail and watch the program carry on.',
        setup: 'A polymorphic `plus` is called with numbers three hundred times, gets ' +
          'speculated on, and is then called with two strings.',
        steps: [
          { do: 'Read where the two functions reach the optimising tier.',
            why: 'Both get hot, for different reasons.',
            work: '`plus` at dispatch 4 595 by entry count, `main` at 4 606 by back edge' },
          { do: 'Count the fast paths emitted.',
            why: 'One per monomorphic site.',
            work: '3' },
          { do: 'Read what happens at the string call.',
            why: 'The guard was justified by a profile and the profile was evidence, not proof.',
            work: '1 deoptimisation at dispatch 6 922 — the guard on add failed' },
          { do: 'Read where control went.',
            why: 'This is the mechanism that makes speculation safe.',
            work: 'back to the interpreter at the same instruction, on the same frame, 0 values lost' },
          { do: 'Compare the final answer against a run that never compiled.',
            why: 'A deopt that loses state is a miscompilation that fires once in a thousand.',
            work: 'all 4 observables agree — value, output, outcome and every binding' }
        ],
        answer: 'The guard fires once, the function drops a tier, and the program computes ' +
          'exactly what it would have computed with no compiler at all. What makes that safe ' +
          'is one ordering rule: the guard runs before the instruction has consumed anything, ' +
          'so rewinding the program counter lands on an instruction that has not started. ' +
          'Check the guard after popping the operands instead and the deopt resumes something ' +
          'half-done — a wrong answer that only appears on the input the guard rejects, which ' +
          'is the hardest kind of compiler bug to find.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
