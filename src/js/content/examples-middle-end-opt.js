/** Worked examples for loops, calls, aliasing and verification (M29.7-M29.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'loop-optimisations': [
      {
        title: 'One instruction between a working program and a crash',
        goal: 'Demonstrate the LICM safety condition by removing it.',
        setup: 'The same loop is optimised twice: once by a pass that checks whether a faulting ' +
          'instruction\'s block dominates every loop exit, and once by one that hoists anything ' +
          'invariant. Both results are verified and then run.',
        steps: [
          { do: 'Read what the safe version does.',
            why: 'The baseline, with the refusal made explicit.',
            work: '4 hoisted, 1 refused, ok before and ok after' },
          { do: 'Read the refusal.',
            why: 'A refusal names the register and the reason.',
            work: '%9 — may fault, and b2 does not dominate every loop exit' },
          { do: 'Read what the naive version does.',
            why: 'One more instruction moved.',
            work: '5 hoisted, 0 refused' },
          { do: 'Run the naive result.',
            why: 'This is the whole demonstration.',
            work: 'ok before, runtime after — 1 instruction of difference, and the ' +
              'answer is not the same' },
          { do: 'Ask both versions past the verifier.',
            why: 'The obvious check has nothing to say about this.',
            work: 'both produce IR the verifier accepts — 10 of 10 invariants, either way' }
        ],
        answer: 'The difference between the two passes is one instruction, and that instruction ' +
          'is a division whose guard is the loop condition. Hoisting it into the preheader ' +
          'makes it run when the loop runs zero times, which is exactly the case the guard ' +
          'existed to prevent. Both versions produce structurally valid IR, so nothing but ' +
          'running the program catches it — which is why the condition is worth stating as ' +
          'dominance over every exit rather than as "be careful with division".'
      },
      {
        title: 'What a loop costs, under an assumption that is named',
        goal: 'Read a cost model honestly, including the part that is made up.',
        setup: 'Each loop is reported with its depth, its body size, a weighted cost, its ' +
          'invariant values, its induction variables and its exits.',
        steps: [
          { do: 'Read the body size and the weighted cost of the outer loop.',
            why: 'The two numbers and the factor between them.',
            work: '15 instructions, weighted 150, at depth 0' },
          { do: 'State the factor and where it came from.',
            why: 'It is an assumption, and unlabelled assumptions become folklore.',
            work: '10 assumed iterations per nesting level' },
          { do: 'Say what the weighted column is good for.',
            why: 'The assumption cancels in one use and not the other.',
            work: 'comparing 2 loops in the same function — not as a figure in a report' },
          { do: 'Count the invariant values found.',
            why: 'Invariance is a fixpoint, so one pass would find fewer.',
            work: '5, of which 4 were hoisted and 1 refused' },
          { do: 'Read the two induction variables.',
            why: 'Each is a header phi stepping by an invariant amount.',
            work: '%15 starting at %2 stepping by %9, and %14 starting at %1 stepping by 1' }
        ],
        answer: 'A body of 15 charged at 150, and the factor of ten is the only interesting ' +
          'number in the row because it is the one nobody measured. Every compiler cost model ' +
          'contains something like it — a static trip count is unavailable for most loops — and ' +
          'the difference between a usable heuristic and folklore is whether the assumption is ' +
          'printed beside the result. The two induction variables are worth reading together: ' +
          'one the programmer wrote and one the `for` desugaring introduced.'
      }
    ],

    'interprocedural-optimisation': [
      {
        title: 'A call graph that reported zero edges and was not empty',
        goal: 'Show how SSA hides direct calls, and what it costs to miss it.',
        setup: 'After construction, every read of a local is a copy, so the register a call ' +
          'names is several moves away from the closure it refers to.',
        steps: [
          { do: 'Count the direct and indirect calls in the sample.',
            why: 'The finished answer.',
            work: '2 direct, 0 indirect' },
          { do: 'Say what the first version of the call graph reported.',
            why: 'This was a real bug in this module.',
            work: '0 direct — every call looked indirect' },
          { do: 'Ask what the symptom was.',
            why: 'It did not look like a bug.',
            work: '0 candidate sites — an inliner with nothing to do, no error, and a ' +
              'plausible zero in the report' },
          { do: 'Say what the fix was.',
            why: 'The size of the fix is part of the lesson.',
            work: 'follow the chain of moves from the callee register back to its ' +
              'allocation — 2 edges recovered' },
          { do: 'Read the two candidate sites the graph now finds.',
            why: 'Both are taken from the budget.',
            work: 'read at ratio 1.00 and wrap at 1.67, spending 6 of 40' }
        ],
        answer: 'Zero direct edges is a perfectly plausible number for a program with two ' +
          'calls, which is what made the bug invisible. The lesson generalises past call ' +
          'graphs: an analysis written against the surface IR and run after SSA construction is ' +
          'reading a different program, because renaming interposed copies everywhere a local ' +
          'was read. Anything that pattern-matches on operands has to follow them.'
      },
      {
        title: 'Five allocations, two escapes, and one of them for a poor reason',
        goal: 'Separate genuine escape from what the analysis cannot prove.',
        setup: 'Escape analysis walks each allocation\'s uses and asks whether any of them lets ' +
          'the value outlive the frame; the reason is reported per allocation.',
        steps: [
          { do: 'Count the allocations and how many can live on the stack.',
            why: 'The headline the pass exists to produce.',
            work: '3 of 5 stay on the frame; 2 escape' },
          { do: 'Read the first escape.',
            why: 'This one is exact.',
            work: '%2 in wrap — a makeRecord, returned' },
          { do: 'Read the second.',
            why: 'This one is the conservative rule firing.',
            work: '%5 in main, passed to a call, which this analysis cannot see into' },
          { do: 'Say what would be needed to recover it.',
            why: 'The imprecision has a specific cause and a specific cure.',
            work: 'a summary per function saying which of its parameters escape — 1 of ' +
              'the 2 escapes would go' },
          { do: 'Read the whole suite.',
            why: 'One program is an anecdote.',
            work: '9 of 11 allocations across the suite could live on the stack — 81.8%' }
        ],
        answer: 'Two escapes, and only one of them is real. Reporting a verdict alone would ' +
          'give a number nobody could act on; reporting the reason says which of the two could ' +
          'be recovered by more analysis and which could not. That distinction is the same one ' +
          'the alias section makes about soundness and precision, and it is the reason both ' +
          'analyses print their justification rather than their conclusion.'
      }
    ],

    'alias-analysis': [
      {
        title: 'Twenty-two against twenty-eight, on two allocations',
        goal: 'Show that unification is a different relation, not a rougher one.',
        setup: 'The merge fixture allocates two records and assigns one of them to a third ' +
          'pointer through a conditional. Both analyses run on it and both are checked against ' +
          'what actually happened.',
        steps: [
          { do: 'Count the allocation sites.',
            why: 'The finite set that makes the heap question tractable.',
            work: '2' },
          { do: 'Read Andersen\'s answer.',
            why: 'Inclusion adds a subset edge per assignment.',
            work: '22 may-alias pairs, reached in 2 rounds' },
          { do: 'Read Steensgaard\'s.',
            why: 'Unification merges the classes instead.',
            work: '28 pairs, from 7 merges' },
          { do: 'Read the points-to sets that differ.',
            why: 'The extra pairs come from specific registers.',
            work: 'Andersen keeps %1, %5 and %10 pointing at one site each; unification puts ' +
              'them in one class with everything else' },
          { do: 'Check both against the run.',
            why: 'Soundness is the property that has to hold.',
            work: '16 aliases actually happened; both report supersets and neither misses one' }
        ],
        answer: 'Six extra pairs on a two-site program, which is what "coarser" means when it ' +
          'is measured. The merge is symmetric and permanent, so one assignment between two ' +
          'unrelated pointers makes them alias forever along with everything already merged ' +
          'with either. Across the suite only 1 of 5 fixtures separates the two — on ' +
          'straight-line code that never mixes pointers, unification is exactly as good and far ' +
          'cheaper, which is why real compilers reach for it first.'
      },
      {
        title: 'An oracle that can prove an analysis wrong and never prove one right',
        goal: 'Get the direction of a soundness check the right way round.',
        setup: 'The dynamic oracle records which registers held the same object during a run, ' +
          'independently of either analysis.',
        steps: [
          { do: 'Read what the oracle observed.',
            why: 'A record of the run, not a prediction.',
            work: '16 pairs actually aliased' },
          { do: 'Compare with what each analysis reported.',
            why: 'The static answer must be a superset.',
            work: 'Andersen 22 and Steensgaard 28, missing 0' },
          { do: 'Say which direction of error is survivable.',
            why: 'Only one of them is.',
            work: '6 more is imprecision; 1 fewer is unsoundness' },
          { do: 'Say what a single run can and cannot establish.',
            why: 'The asymmetry is the point.',
            work: '1 input, 1 path — agreement is evidence, and a miss is a definite bug' },
          { do: 'Read what the imprecision costs downstream.',
            why: 'The consumer is load elimination.',
            work: '2 of 5 fixtures have an eliminable load at all, and the merge fixture — ' +
              'the one where the two analyses differ — is not one of them' }
        ],
        answer: 'Sixteen observed against twenty-two and twenty-eight reported, and both ' +
          'analyses are sound on this input. Knowing that a dynamic oracle under-approximates ' +
          'by construction is what makes the check meaningful rather than reassuring: it is the ' +
          'right tool for catching an unsound analysis and the wrong one for concluding that an ' +
          'analysis is correct. An analysis that is precise and unsound is worse than useless, ' +
          'because every pass downstream trusts it.'
      }
    ],

    'verifying-the-optimiser': [
      {
        title: 'Four hundred programs that found nothing, beside one that finds everything',
        goal: 'State what a fuzzing campaign does and does not establish.',
        setup: 'The generator emits programs from the grammar; each is compiled twice, once ' +
          'with the passes and once without, and the two runs are compared on value, output, ' +
          'outcome and bindings.',
        steps: [
          { do: 'Run the sweep under the full pipeline.',
            why: 'The expected result for a correct optimiser.',
            work: '400 programs, 0 failures' },
          { do: 'Run it under the pipeline with naive LICM.',
            why: 'A pass that is genuinely wrong should be found.',
            work: '400 programs, 0 failures' },
          { do: 'Ask why.',
            why: 'This is the honest limit of the technique.',
            work: '0 of the 400 have the shape — the generator cannot write a division ' +
              'guarded by its own loop condition, which is the only shape naive LICM ' +
              'breaks' },
          { do: 'Run the seeded program under the same broken pipeline.',
            why: 'The shape the sweep cannot reach, written by hand.',
            work: 'a failure, and 6 lines of minimal repro to go with it' },
          { do: 'Say what the sweep is worth despite that.',
            why: 'Zero failures is not a wasted run.',
            work: '400 inputs nobody chose, and it is the only evidence the passes hold ' +
              'on them' }
        ],
        answer: 'Four hundred programs find nothing under a pass that is definitely broken, ' +
          'because coverage is a property of the generator rather than of the number of ' +
          'programs. That is the same lesson as the blind-spot table one box up, stated about ' +
          'the fuzzer instead of about the gates. It is also why the seeded case exists: a ' +
          'campaign that only generates cannot test the shapes its grammar has no production ' +
          'for, and somebody has to notice which those are.'
      },
      {
        title: 'Fifteen lines to six, and three bugs the shrinker had first',
        goal: 'Show why the reduction step is where a fuzzing campaign becomes useful.',
        setup: 'The shrinker deletes statements, simplifies numbers towards zero and shortens ' +
          'arrays, keeping any candidate that still fails at the same pass in the same way.',
        steps: [
          { do: 'Read the reduction.',
            why: 'The size of a report somebody can act on.',
            work: '15 lines to 6, and 237 characters to 71' },
          { do: 'Read the effort.',
            why: 'Each candidate is compiled and run.',
            work: '51 candidates tried, 10 accepted, over 11 rounds' },
          { do: 'Say why the list is recomputed after every acceptance.',
            why: 'The first version of this shrinker did not.',
            work: '11 rounds, 1 recomputation each — a later candidate is the OLD program ' +
              'with one change, so accepting it undoes the acceptance before it' },
          { do: 'Say what that looked like.',
            why: 'It looked like the shrinker working.',
            work: 'hundreds of accepted candidates and 24 lines reduced to 24' },
          { do: 'Name the two gates every candidate must pass.',
            why: 'Both were added after the reducer produced a useless repro.',
            work: '2 gates — it must still parse and resolve, and it must fail at the ' +
              'same pass with the same kind of failure' }
        ],
        answer: 'Eleven rounds and fifty-one compiles turn a fifteen-line generated program ' +
          'into six lines, and every one of the three rules that make that trustworthy was ' +
          'added after the shrinker got it wrong. Without the validity gate it deleted a ' +
          'declaration the loop still used and produced a repro about an unbound name; without ' +
          'the same-failure gate it would have changed the subject; without recomputation it ' +
          'reverted its own progress while reporting success.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
