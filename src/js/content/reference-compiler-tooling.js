/** Reference entries for desugaring, diagnostics and testing (M28.7-M28.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'desugaring-to-a-core': {
      summary: 'Five lowering defects that shipped and were found by execution rather than ' +
        'review — four name captures, a loop that read one element past the end, and a guard ' +
        'idiom that divided by zero — with all three traps runnable in the demo.',
      intuition: 'Lower to a smaller core so every later stage sees fewer constructs, keep the ' +
        'origin span on every generated node, and prove the lowering by running both programs.',
      formulation: {
        equations: [
          {
            label: 'The three traps, and what each one did',
            expr: 'naive lowering · what went wrong',
            terms: [
              { sym: 'a + b becomes add(a, b)', meaning: 'inside fn add, the core recursed until the stack ran out' },
              { sym: 'advance at the top behind a flag', meaning: 'the guard tested a stale index, so a 3-element loop read index 3' },
              { sym: 'a && b becomes a call', meaning: 'both arguments evaluated, so d != 0 && 10 / d > 1 divided by zero' },
              { sym: 'the fix in each case', meaning: 'a dollar prefix the lexer rejects; advance between the binding and the body; lower to if' }
            ]
          },
          {
            label: 'Node growth through lowering',
            expr: 'program · surface · core · growth',
            terms: [
              { sym: 'for', meaning: '14 · 34 · 2.43' },
              { sym: 'match', meaning: '13 · 28 · 2.15' },
              { sym: 'arithmetic, folded', meaning: '7 · 3 · 0.43' },
              { sym: 'annotated, folded', meaning: '5 · 3 · 0.60' },
              { sym: 'the prediction', meaning: 'the two that grow most are the two 28.1 scored as expensive after the parser' }
            ]
          },
          {
            label: 'What the differential comparison observes',
            expr: 'measure · value',
            terms: [
              { sym: 'observations across the suite', meaning: '32 over 17 programs' },
              { sym: 'on values alone', meaning: '17 of 17 agree, and every value is unit' },
              { sym: 'the default sample', meaning: 'total = 8 either way, 53 surface steps against 125 core steps' },
              { sym: 'cost', meaning: 'not compared — a lowering may cost more steps and may not change the answer' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every synthesised node carries the span of a surface construct',
          why: 'There is no source text for generated code, so a message about it must point at what was written.',
          breaks: 'One constructor builds every lowered node and takes the origin as an argument; the audit reports any node without one.'
        },
        {
          name: 'Every introduced name begins with a character no identifier can begin with',
          why: 'A convention makes collision unlikely; a lexer rule makes it impossible.',
          breaks: 'Four separate captures were found once the first was; all four used names a user program could have bound.'
        },
        {
          name: 'The surface program and its core agree on every observable',
          why: 'A lowering that changes behaviour is a different program, and it will be found by a user.',
          breaks: 'Both are run and compared on value, printed output, outcome and every binding left behind.'
        },
        {
          name: 'The comparison includes what a program leaves behind',
          why: 'Every conformance program returns unit, so comparing values alone is vacuous.',
          breaks: 'The global bindings are compared, giving 32 observations where values alone gave none.'
        }
      ],
      complexity: [
        { operation: 'lowering a tree', average: 'O(nodes)', worst: 'O(nodes), with a constant per pass' },
        { operation: 'a for loop', average: '4 core statements per loop', worst: '2.43 times the node count' },
        { operation: 'a match', average: 'one test and one binding per arm', worst: '2.15 times the node count for two arms' },
        { operation: 'the span audit', average: 'O(core nodes)', worst: 'one visit' },
        { operation: 'the differential run', average: 'O(steps) twice', worst: 'bounded by the step budget, which is a reported outcome' }
      ],
      failureModes: [
        {
          symptom: 'A program using a common name recurses forever after lowering.',
          cause: 'The lowering introduced a name the user could also bind.',
          fix: 'Prefix every generated name with a character the lexer will not accept at the start of an identifier.'
        },
        {
          symptom: 'A loop with a continue never terminates, or reads past the end.',
          cause: 'The advance is after the body, where continue skips it, or before the guard, where the guard goes stale.',
          fix: 'Bind the element, advance, then run the body. Nothing between those points can be skipped.'
        },
        {
          symptom: 'A guarded division crashes after an optimisation pass.',
          cause: 'And-or was lowered to a strict call, so the right side is evaluated unconditionally.',
          fix: 'Lower them to a conditional, which is the only core form that skips a branch.'
        },
        {
          symptom: 'An error message points at a variable the developer never wrote.',
          cause: 'A synthesised node carries its own span instead of the origin\'s.',
          fix: 'Build every lowered node through one constructor that takes the origin.'
        },
        {
          symptom: 'A differential suite is green and the lowering is wrong.',
          cause: 'The comparison only looked at return values, and the programs return nothing.',
          fix: 'Compare every observable the language has, and report how many observations the suite made.'
        }
      ],
      inTheWild: [
        'Rust\'s HIR and MIR lowering, where for loops become loop plus a match on an iterator.',
        'Scheme\'s syntax-rules and syntax-case, whose entire subject is hygiene.',
        'The Haskell Core language, nine constructs that every GHC pass after desugaring works on.',
        'Kotlin and Swift, both of which lower a large surface syntax to a much smaller intermediate form before any analysis.'
      ],
      sources: [
        { title: 'Peyton Jones — The Implementation of Functional Programming Languages', note: 'the case for a tiny core and the desugarings that reach it' },
        { title: 'Kohlbecker, Friedman, Felleisen and Duba — Hygienic macro expansion (1986)', note: 'the capture problem, and why renaming is not optional' },
        { title: 'Appel — Modern Compiler Implementation in ML', note: 'lowering, and keeping source positions through it' },
        { title: 'McKeeman — Differential testing for software (1998)', note: 'the method this section\'s correctness argument rests on' }
      ]
    },

    'diagnostics-as-a-product': {
      summary: 'Twelve mistakes producing fifteen true diagnostics, cut to twelve by three ' +
        'switchable and separately counted rules, with three quick fixes verified by applying ' +
        'them and rechecking.',
      intuition: 'Collect from every stage, drop what is a consequence rather than a cause, keep ' +
        'what you dropped, and build the editor out of the tables the compiler already has.',
      formulation: {
        equations: [
          {
            label: 'The error suite, with and without suppression',
            expr: 'measure · value',
            terms: [
              { sym: 'programs', meaning: '12, one mistake each, each stating its code' },
              { sym: 'raw diagnostics', meaning: '15' },
              { sym: 'reported', meaning: '12 — exactly one per program, all with the stated code' },
              { sym: 'suppressed', meaning: '3, all by stage gating' },
              { sym: 'where the cascade was', meaning: '2 programs: the unterminated string gave 3 and the malformed number 2' }
            ]
          },
          {
            label: 'The three rules',
            expr: 'rule · what it drops',
            terms: [
              { sym: 'stage gating', meaning: 'a later stage\'s diagnostics when an earlier stage reported anything' },
              { sym: 'containment', meaning: 'a diagnostic whose span sits inside an earlier one from the same stage' },
              { sym: 'deduplication', meaning: 'the same code at the same span' },
              { sym: 'on this suite', meaning: 'gating earns all 3; the other two earn nothing, which says the stages recover well' }
            ]
          },
          {
            label: 'Quick fixes, applied and rechecked',
            expr: 'program · its diagnostic removed · file clean',
            terms: [
              { sym: 'let a = 1 let b = 2;', meaning: 'yes · yes' },
              { sym: 'let a = (1 + 2;', meaning: 'yes · yes' },
              { sym: 'let s = "oops;', meaning: 'yes · no — the statement still has no semicolon' },
              { sym: 'the other nine', meaning: 'no fix offered, because no table the compiler has determines one' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'One mistake produces one diagnostic',
          why: 'The reader should not have to work out which of eleven messages is the cause.',
          breaks: 'Every error-suite program contains exactly one mistake and states the code it must produce; twelve of twelve match.'
        },
        {
          name: 'Every suppressed diagnostic is kept, with the rule that removed it',
          why: 'Suppression you cannot inspect is indistinguishable from a compiler that failed to notice.',
          breaks: 'The demo lists them with a reason column and each rule can be switched off.'
        },
        {
          name: 'A fix is offered only when a table determines it',
          why: 'A quick fix that guesses is one people disable, and the good ones go with it.',
          breaks: 'Nine of twelve error programs get no fix, which is the correct answer rather than a gap.'
        },
        {
          name: 'A fix is verified by applying it and rechecking',
          why: 'Machine-applicable is a claim about what happens, not about plausibility.',
          breaks: 'Two columns are reported: the diagnostic removed, and the file clean, because a source can hold two mistakes.'
        }
      ],
      complexity: [
        { operation: 'collecting diagnostics', average: 'O(diagnostics)', worst: 'one normalisation per entry' },
        { operation: 'suppression', average: 'O(diagnostics squared) in the worst case', worst: '15 entries on the suite, so the quadratic is free' },
        { operation: 'formatting one diagnostic', average: 'O(offset) to find the line', worst: 'a prefix scan, done once per reported message' },
        { operation: 'applying and verifying a fix', average: 'one extra pipeline run', worst: 'five stages on the edited source' },
        { operation: 'an editor request', average: 'O(1) after the tables exist', worst: 'O(references) for find-all-references' }
      ],
      failureModes: [
        {
          symptom: 'One missing quote produces eleven errors.',
          cause: 'Every stage reports its consequences of the same mistake.',
          fix: 'Gate later stages behind earlier failures; the later ones were reasoning about a program nobody read correctly.'
        },
        {
          symptom: 'A suppression rule hides a real second mistake and nobody can tell.',
          cause: 'Dropped diagnostics are discarded rather than recorded.',
          fix: 'Keep them with the rule that removed each, and make each rule switchable.'
        },
        {
          symptom: 'Users turn quick fixes off.',
          cause: 'Fixes are offered for mistakes where nothing determines the repair.',
          fix: 'Derive every fix from a table the compiler already has, and offer none otherwise.'
        },
        {
          symptom: 'A diagnostic underlines nothing.',
          cause: 'A span with no end, usually from a helper reading the wrong field.',
          fix: 'Audit spans explicitly; the failure is invisible to every other test.'
        },
        {
          symptom: 'Go-to-definition does not work while the file has an error.',
          cause: 'The editor path runs only after a successful compile.',
          fix: 'Make the parser total and the tables available from a partial tree; a file being edited is broken most of the time.'
        }
      ],
      inTheWild: [
        'rustc, whose diagnostic model of primary and secondary spans, notes and machine-applicable suggestions is the reference design.',
        'clang\'s fix-its, which are applied by tooling without asking and therefore have a high bar.',
        'The Elm compiler, whose error messages are the project\'s stated principal goal.',
        'The Language Server Protocol, which standardises the diagnostic, hover, definition and rename shapes used here.'
      ],
      sources: [
        { title: 'Microsoft — Language Server Protocol specification', note: 'the request shapes, and why rename may refuse' },
        { title: 'The rustc dev guide, Errors and Lints', note: 'cascade suppression, applicability levels and the diagnostic struct' },
        { title: 'clang — Expressive Diagnostics documentation', note: 'ranges, fix-its and the argument for both' },
        { title: 'Aho, Lam, Sethi and Ullman — chapter 4.1, Error Recovery', note: 'the classical treatment of cascades' }
      ]
    },

    'testing-a-front-end': {
      summary: 'Four properties over ten thousand generated programs, each reported beside what ' +
        'a deliberately broken implementation makes it catch, and a table of what every oracle ' +
        'is blind to — which is where all six of this milestone\'s defects were.',
      intuition: 'A generator is the grammar read backwards; a property is only as good as its ' +
        'oracle; and the useful question after a green suite is what the oracles cannot see.',
      formulation: {
        equations: [
          {
            label: 'The four properties',
            expr: 'property · checked · failures · broken version catches',
            terms: [
              { sym: 'round trip', meaning: '2 000 · 0 · 106 with the right-operand power dropped' },
              { sym: 'parser totality', meaning: '2 000 · 0 · any throw at all' },
              { sym: 'span containment', meaning: '2 000 · 0 · the 10 nodes per run before the span helper was fixed' },
              { sym: 'surface against core', meaning: '1 000 · 0 · four captures, a loop off-by-one and a lost short circuit' }
            ]
          },
          {
            label: 'Mutation fuzzing, by corruption',
            expr: 'mutation · applied · what it models',
            terms: [
              { sym: 'delete', meaning: '515 · the commonest real typo' },
              { sym: 'insert', meaning: '482 · an unbalanced bracket, which tests recovery' },
              { sym: 'swap', meaning: '483 · two characters transposed, which often still lexes' },
              { sym: 'truncate', meaning: '520 · a file that stops mid-expression' },
              { sym: 'mutants producing a diagnostic', meaning: '1 415 of 2 000, about 71%; every one produced a tree' }
            ]
          },
          {
            label: 'What each oracle cannot see',
            expr: 'oracle · blind to',
            terms: [
              { sym: 'the round trip', meaning: 'anything after parsing — it never runs a program' },
              { sym: 'mutation fuzzing', meaning: 'whether the tree is right; it only asks that one exists' },
              { sym: 'the reference interpreter', meaning: 'programs that do not parse or do not terminate' },
              { sym: 'the conformance suite', meaning: 'any shape nobody wrote down — it missed a let inside a function' },
              { sym: 'the error suite', meaning: 'the quality of the message, which no assertion reaches' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every property is reported with its sensitivity',
          why: 'Zero failures is equally consistent with a working property and an unambitious generator.',
          breaks: 'The round trip runs both printers over the same corpus on every control change; the rest name what they caught historically.'
        },
        {
          name: 'The generator emits well-typed, terminating programs',
          why: 'A corpus the checker rejects exercises the error path and nothing else.',
          breaks: 'Expression generation is typed by construction and loop counters are generated rather than chosen.'
        },
        {
          name: 'Every stage is a pure function of its input',
          why: 'State carried between runs makes two compilations in one process disagree.',
          breaks: 'The whole pipeline runs twice per program and five artefact fingerprints are compared.'
        },
        {
          name: 'What each oracle is blind to is written down',
          why: 'It is the only form in which the question gets acted on.',
          breaks: 'The oracle table lists six of them, each with the defect that hid there.'
        }
      ],
      complexity: [
        { operation: 'generating one program', average: 'O(nodes)', worst: 'bounded by the depth control' },
        { operation: 'the round-trip sweep', average: 'O(programs × source)', worst: '10 000 programs in about 550 milliseconds' },
        { operation: 'mutation fuzzing', average: 'O(programs × source)', worst: '10 000 mutants in about 180 milliseconds' },
        { operation: 'the differential sweep', average: 'O(programs × steps)', worst: 'bounded by the step budget, which is a separate reported outcome' },
        { operation: 'a purity check', average: 'two full pipeline runs plus five fingerprints', worst: 'O(nodes) per fingerprint' }
      ],
      failureModes: [
        {
          symptom: 'A property suite has never failed and finds nothing.',
          cause: 'Nobody measured it against a known-bad implementation.',
          fix: 'Break the code on purpose and report the catch rate beside the pass rate.'
        },
        {
          symptom: 'A fuzzer\'s failures are all "did not finish".',
          cause: 'The generator emits programs that do not terminate.',
          fix: 'Generate the loop counters rather than letting the generator write the guard, and keep the budget outcome separate.'
        },
        {
          symptom: 'A differential suite is green and the lowering is wrong.',
          cause: 'The comparison observes something every program in the suite has in common.',
          fix: 'Report how many observations were made; a suite agreeing on zero observations agrees about nothing.'
        },
        {
          symptom: 'A whole construct is broken and every test passes.',
          cause: 'No program in the suite contains that construct.',
          fix: 'Treat a coverage gap as a failure and add the program; a better assertion cannot reach a shape that is absent.'
        },
        {
          symptom: 'Two compilations in one process give different results.',
          cause: 'A stage keeps state between runs, usually a counter at module scope.',
          fix: 'Run the pipeline twice on one input and compare every artefact; the check names the offending stage.'
        }
      ],
      inTheWild: [
        'Csmith and its successors, which found hundreds of bugs in production C compilers by generating well-defined programs.',
        'jsfunfuzz and the JavaScript engine fuzzers, whose oracle is differential execution against another engine.',
        'The Go standard library\'s go/printer tests, which round-trip the entire standard library on every change.',
        'Hypothesis and QuickCheck, and the shrinking step that turns a random failure into a minimal one.'
      ],
      sources: [
        { title: 'Yang, Chen, Eide and Regehr — Finding and Understanding Bugs in C Compilers (2011)', note: 'Csmith, and what a generator has to guarantee to be useful' },
        { title: 'Claessen and Hughes — QuickCheck (2000)', note: 'properties, generators and shrinking' },
        { title: 'McKeeman — Differential testing for software (1998)', note: 'the method, and the oracle problem it solves' },
        { title: 'Regehr — the compiler-testing series on Embedded in Academia', note: 'why the blind spots matter more than the assertions' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
