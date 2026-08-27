/** Worked examples for desugaring, diagnostics and testing (M28.7-M28.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'desugaring-to-a-core': [
      {
        title: 'Three lowerings that shipped wrong, and what each one did',
        goal: 'Show that a lowering cannot be checked by reading it.',
        setup: 'Each trap is a plausible rewrite with a comment in the source arguing it is ' +
          'correct. All three were found by running the surface program and its core and ' +
          'comparing every observable.',
        steps: [
          { do: 'Lower a + b to a call named add, inside fn add(a, b).',
            why: 'The operator name collides with the user\'s function.',
            work: 'the core recursed until the stack ran out — 4 635 steps and a RangeError' },
          { do: 'Advance a for loop\'s index at the top of the body behind a flag.',
            why: 'The guard is then tested against the index from before the advance.',
            work: 'a loop over 3 elements read index 3 of a 3-element array' },
          { do: 'Lower a && b to a call.',
            why: 'A call evaluates both arguments.',
            work: 'let d = 0; let ok = d != 0 && 10 / d > 1; divided by zero in the core and not ' +
              'on the surface' },
          { do: 'Count how many of the same family were found once the first one was.',
            why: 'A capture bug is never alone.',
            work: '4 captures in total — add, len, is_some and payload0 — plus unmatched' },
          { do: 'Re-run all three fixtures against the current lowering.',
            why: 'The traps must be runnable, not anecdotes.',
            work: '3 of 3 agree, over 5 observations; the shipped for-loop sample leaves ' +
              'total = 8 either way' }
        ],
        answer: 'Five defects, none found by review, all found by execution. The pattern is the ' +
          'same in each: a rewrite that is correct on every program without a particular side ' +
          'condition, and the side condition is something people write on purpose — a function ' +
          'called add, a loop with a continue, a division guarded by the test that makes it safe.'
      },
      {
        title: 'Why the differential test proved nothing until it compared bindings',
        goal: 'Show that choosing the observations is most of the design of a differential test.',
        setup: 'Every conformance program is a list of let declarations, so the value of each is ' +
          'unit. The comparison originally checked outcome, value and printed output.',
        steps: [
          { do: 'Compare on value alone across the suite.',
            why: 'The obvious first version.',
            work: '17 of 17 agree — every value is unit, so the comparison is vacuous' },
          { do: 'Add the bindings a program leaves behind.',
            why: 'This is what a program of declarations can be seen to do.',
            work: '31 observations across 17 programs, from 1 on arithmetic to 4 on modules' },
          { do: 'Re-run the three traps against the stronger comparison.',
            why: 'The test only has teeth if it fails on known-bad code.',
            work: 'all 3 failed, and 1 of them ONLY on the bindings row' },
          { do: 'Check the cost of the extra observation.',
            why: 'The reason to hesitate.',
            work: '1 scan of the global scope per run, excluding the names beginning with a dollar' },
          { do: 'Read the growth column beside it.',
            why: 'The honest price of lowering.',
            work: 'for grows 2.57 times and match 2.15, while folding shrinks arithmetic to 0.43' }
        ],
        answer: 'A suite that agrees on zero observations agrees about nothing, and seventeen ' +
          'green rows looked exactly like seventeen green rows either way. The generated names ' +
          'have to be excluded from the comparison — they have no surface counterpart — and ' +
          'the dollar prefix that makes them hygienic is what makes that exclusion exact rather ' +
          'than a heuristic.'
      }
    ],

    'diagnostics-as-a-product': [
      {
        title: 'Fifteen true messages for twelve mistakes',
        goal: 'Measure what cascade suppression is worth.',
        setup: 'Each of the twelve error-suite programs contains exactly one mistake and states ' +
          'the code it must produce. Every diagnostic every stage emits is collected first.',
        steps: [
          { do: 'Collect without suppression.',
            why: 'The raw output of four stages.',
            work: '15 diagnostics for 12 mistakes' },
          { do: 'Find where the extras are.',
            why: 'A cascade concentrates.',
            work: '2 programs account for all 3 — the unterminated string produces 3 and the ' +
              'malformed number 2' },
          { do: 'Check whether the extras are wrong.',
            why: 'This is what makes the problem hard.',
            work: '0 of the 3 — an unterminated string really does leave an unreadable ' +
              'expression and a statement with no semicolon' },
          { do: 'Apply stage gating, containment and deduplication.',
            why: 'The three rules, in order.',
            work: '12 reported, 3 suppressed, all 3 by stage gating' },
          { do: 'Check each program against its stated code.',
            why: 'Exactly one diagnostic, and the right one.',
            work: '12 of 12 correct' }
        ],
        answer: 'Three suppressions, all from one rule, and the other two rules earn nothing on ' +
          'this suite — which is worth reporting rather than hiding, because it says these ' +
          'stages already recover well. On a compiler that reports every consequence the same ' +
          'twelve programs would produce dozens, and the same three rules would remove most of ' +
          'them.'
      },
      {
        title: 'Three quick fixes, applied and rechecked',
        goal: 'Establish what "machine-applicable" has to mean.',
        setup: 'Each fix is derived from a table the compiler already has, applied to the source, ' +
          'and the result run through the whole pipeline again.',
        steps: [
          { do: 'Count how many of the twelve error programs get a fix.',
            why: 'Most mistakes have no determined repair.',
            work: '3 of 12' },
          { do: 'Apply the missing-semicolon fix.',
            why: 'The grammar names the token it wanted.',
            work: 'let a = 1 let b = 2; becomes let a = 1 ;let b = 2; and the file is clean' },
          { do: 'Apply the unclosed-parenthesis fix.',
            why: 'Same mechanism, different token.',
            work: 'let a = (1 + 2; becomes let a = (1 + 2); and the file is clean' },
          { do: 'Apply the unterminated-string fix.',
            why: 'The case where the two questions separate.',
            work: 'the E-LEX-STRING is gone and 1 diagnostic remains — the statement still has ' +
              'no semicolon' },
          { do: 'Report both columns.',
            why: 'Conflating them fails in both directions.',
            work: '3 of 3 removed their own diagnostic; 2 of 3 left the file clean' }
        ],
        answer: 'Requiring the file to be clean would mark a correct fix as a failure, because ' +
          'the source had two mistakes in it. Requiring only that the diagnostic disappeared ' +
          'would accept a fix that deleted the line. Both columns, one extra pipeline run per ' +
          'fix, and the nine programs with no fix at all are the right answer rather than a gap.'
      }
    ],

    'testing-a-front-end': [
      {
        title: 'Four properties, and what each one is blind to',
        goal: 'Show that a green suite is a statement about the oracles, not about the code.',
        setup: 'One grammar-driven generator feeds four properties with four different oracles, ' +
          'and every defect this milestone shipped is placed against the oracle that missed it.',
        steps: [
          { do: 'Run the round trip and the parser fuzzer.',
            why: 'The two properties about syntax.',
            work: '2 000 programs each: 0 round-trip failures, 0 crashes, 0 lost spans' },
          { do: 'Run the differential property.',
            why: 'The one that executes anything.',
            work: '1 000 programs, 0 disagreements, 0 excluded for hitting the step budget' },
          { do: 'Ask what the round trip could not have caught.',
            why: 'It never runs a program.',
            work: 'all 5 desugaring defects — it passed 10 000 programs while the core recursed ' +
              'forever on a function called add' },
          { do: 'Ask what the conformance suite could not have caught.',
            why: 'It only contains shapes somebody wrote down.',
            work: 'the type checker crashed on every function containing a let, and 15 programs ' +
              'were green because none had one' },
          { do: 'Ask what the differential property could not have caught.',
            why: 'A program that does not parse never reaches it.',
            work: 'the 10 nodes per run with no usable span — caught only by an explicit span ' +
              'assertion under mutation' }
        ],
        answer: 'Every defect sat in some oracle\'s blind spot, and each was caught by adding a ' +
          'property that could see it rather than by asserting harder with the ones already ' +
          'there. The useful question after a green suite is not "what else could I assert" but ' +
          '"what is every oracle I have blind to" — and the fix for the conformance gap was not ' +
          'a better assertion, it was a sixteenth program.'
      },
      {
        title: 'What 2 000 corrupted files do to a total parser',
        goal: 'Measure totality on the population an editor actually sees.',
        setup: 'Well-formed generated programs are corrupted one character at a time by four ' +
          'mutations, then parsed, and every node in every resulting tree is checked.',
        steps: [
          { do: 'Apply the four mutations uniformly.',
            why: 'Each models a different real typo.',
            work: '515 deletions, 482 insertions, 483 swaps, 520 truncations' },
          { do: 'Count the mutants that produced a diagnostic.',
            why: 'The rest are corruptions that leave a valid program.',
            work: '1 415 of 2 000 — about 71%' },
          { do: 'Count the crashes.',
            why: 'This is the property.',
            work: '0 — every one of the 2 000 returned a tree' },
          { do: 'Check every span in every mutant tree.',
            why: 'The quiet failure needs its own assertion.',
            work: '0 spans outside their own source, and 0 with no end' },
          { do: 'Scale to ten thousand mutants.',
            why: 'The acceptance criterion.',
            work: '0 crashes, 0 lost spans, about 180 milliseconds' }
        ],
        answer: 'The oracle here is the weakest of the four — a tree came back and no span left ' +
          'the file — and that weakness is exactly what lets it be pointed at inputs the other ' +
          'three exclude by construction. A file being typed spends most of its life in this ' +
          'population, so a parser that is not total here is a parser no editor can use, ' +
          'whatever it does on well-formed input.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
