/** Concepts for desugaring, diagnostics and testing the front end (M28.7-M28.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'desugaring-to-a-core': [
      {
        term: 'The core is what every later stage sees',
        plain: 'Remove constructs here so nothing downstream has to handle them.',
        formal: 'no for, no match, no operators, no interpolation',
        detail: 'Four constructs disappear and every pass in M29, M30 and M31 is written against ' +
          'a smaller grammar for the rest of the compiler\'s life. That is the whole economic ' +
          'argument for a core language, and it is why the boundary is placed at the end of the ' +
          'front end: the core is the last representation a human would still recognise as ' +
          'their program, so it is the last point at which a diagnostic can be traced back ' +
          'cheaply.',
        example: 'A for loop with a continue becomes a block of four statements, and M29 will ' +
          'never see a for node.'
      },
      {
        term: 'Every synthesised node carries the origin span',
        plain: 'A generated node points at the surface construct it stands for.',
        formal: '24 of 24 synthesised nodes name their origin in the default sample',
        detail: 'There is no source text for generated code to point at, so without this a ' +
          'diagnostic about a lowered loop underlines a generated index variable — code the ' +
          'developer never wrote — and the message is worse than no message. It is enforced by ' +
          'construction rather than by discipline: one function builds every lowered node and it ' +
          'takes the origin as an argument, so a lowering cannot forget.',
        example: 'The rewrite table shows the for loop\'s span as 15 to 96, the offsets of the ' +
          'surface loop, not of the block that replaced it.'
      },
      {
        term: 'Hygiene by construction, not by convention',
        plain: 'Generated names start with a character no source identifier can start with.',
        formal: 'every introduced name begins with a dollar sign, which the lexer rejects',
        detail: 'A lowering introduces names, and if those names can collide with the user\'s, ' +
          'some program somewhere collides. A convention like a long prefix makes collision ' +
          'unlikely; a character the scanner will not accept makes it impossible. The difference ' +
          'matters because the failure is silent: a user function called add, an operator ' +
          'lowered to a call to add, and the function calls itself until the stack runs out.',
        example: 'fn add(a, b) { return a + b; } is a conformance program, and with an unprefixed ' +
          'operator name it recursed forever.'
      },
      {
        term: 'Short-circuiting cannot survive a lowering to calls',
        plain: 'A call evaluates its arguments; and-or must not.',
        formal: 'a && b becomes if a { b } else { false }, not a call',
        detail: 'This is the subtlest trap in the whole subject, because the strict lowering is ' +
          'correct on every program without a side condition — and the guard idiom is written ' +
          'precisely because the right side is unsafe when the left is false. If a language has ' +
          'faults, exceptions or effects, the two lowerings are different programs, and the ' +
          'conditional form is the only core construct that does not evaluate one of its ' +
          'branches.',
        example: 'let d = 0; let ok = d != 0 && 10 / d > 1; runs fine on the surface and divides ' +
          'by zero under the strict lowering.'
      },
      {
        term: 'There is exactly one safe place for a loop\'s advance',
        plain: 'Bind the element, advance the index, then run the body.',
        formal: 'last is skipped by continue; first-behind-a-flag tests a stale index',
        detail: 'Putting the increment last is how the loop reads and lets continue jump over ' +
          'it, so the loop never terminates. Putting it at the top behind a first-iteration flag ' +
          'means the guard is tested against the index from before the advance, so the last pass ' +
          'reads one element past the end. Between the element binding and the body, nothing can ' +
          'be skipped by any control flow the language has — and no flag is needed, which is ' +
          'the usual sign that a placement is right.',
        example: 'A for loop over three elements indexed position 3 of a 3-element array until ' +
          'the advance was moved.'
      },
      {
        term: 'A lowering is checked by running both programs',
        plain: 'Compare the surface run and the core run on every observable.',
        formal: 'value, printed output, outcome, and every binding left behind',
        detail: 'Reading a rewrite establishes nothing. All five defects found in this file ' +
          'looked correct in the source and two had comments arguing they were right. The ' +
          'comparison must include what a program leaves BEHIND, not just what it returns: every ' +
          'conformance program is a list of let bindings, so its value is unit, and a comparison ' +
          'of values alone passes whatever the core computed.',
        example: 'Comparing bindings makes let s = add(1, 2) observable as s = 3, and the ' +
          'shipped for-loop sample observable as total = 8; seventeen programs give 31 ' +
          'observations in total.'
      },
      {
        term: 'Lowering usually grows the tree',
        plain: 'The core is simpler per node and larger in total.',
        formal: 'match grows 2.15 times, for grows 2.43 times, folding shrinks',
        detail: 'That growth is the honest price of the simplification, and reporting it stops ' +
          '"lower to a smaller core" from sounding like a free win. It also predicts where the ' +
          'work went: the two constructs that grow most are exactly the two the cost table in ' +
          '28.1 scored as expensive after the parser, which is a prediction made before any of ' +
          'this was written and confirmed by measurement.',
        example: 'Constant folding runs the other way — 2 * 3 + 4 shrinks a 7-node program to 3.'
      },
      {
        term: 'Constant folding is here because it changes the core',
        plain: 'Fold at the AST level so the core the learner reads is the core they would write.',
        formal: 'arithmetic on two literals is evaluated before the core is emitted',
        detail: 'Folding is cheap enough to do twice and M29 will do it again on the IR, so the ' +
          'question is not whether but where the boundary sits. Doing it here means the core ' +
          'contains no obviously dead arithmetic, which makes every later view of it readable. ' +
          'It also means the fold has to be careful about the cases that are not constants after ' +
          'all — division by zero folds to nothing rather than to an infinity.',
        example: 'The folder refuses to fold a division by zero and leaves the call in the core ' +
          'so the runtime reports it.'
      }
    ],

    'diagnostics-as-a-product': [
      {
        term: 'Reporting every consequence is worse than reporting nothing',
        plain: 'One mistake should produce one message.',
        formal: 'twelve error programs produced fifteen diagnostics before suppression',
        detail: 'The reader\'s job when a compiler reports eleven messages is to work out which ' +
          'one is the cause, and that is work the compiler was better placed to do. The error ' +
          'suite makes the standard testable rather than aspirational: every program in it ' +
          'contains exactly one mistake and must produce exactly one diagnostic with a stated ' +
          'code, so a cascade is a build failure.',
        example: 'The unterminated string produced three diagnostics — a lexical one and two ' +
          'parse ones — of which two are consequences.'
      },
      {
        term: 'Every suppressed message is true',
        plain: 'Suppression is not about hiding wrong answers.',
        formal: 'a string with no closing quote really does leave an unreadable expression',
        detail: 'This is what makes cascade suppression hard to get right and easy to get wrong ' +
          'in the direction of reporting too much: every rejected message defends itself. Truth ' +
          'is not the bar. The question is which true message the reader needs, and the answer ' +
          'is almost always the earliest one in the pipeline, because everything after it was ' +
          'reasoning about a program that was never read correctly.',
        example: 'The demo lists the dropped diagnostics with the rule that removed each, and ' +
          'every one of them is a correct observation.'
      },
      {
        term: 'Stage gating does most of the work',
        plain: 'Drop a later stage\'s diagnostics when an earlier stage reported anything.',
        formal: 'lex before parse before resolve before typecheck',
        detail: 'Names resolved against a tree containing an error node, and types inferred from ' +
          'those names, are guesses about a program nobody read correctly. Real compilers do ' +
          'exactly this — they do not type-check a file with parse errors — and the reason it is ' +
          'worth stating as a rule rather than leaving to the pipeline\'s structure is that a ' +
          'language server WANTS to run the later stages anyway, for hover and completion, and ' +
          'only their diagnostics should be withheld.',
        example: 'The cascade sample produces five diagnostics across four stages and reports ' +
          'one; all four suppressions are stage gating.'
      },
      {
        term: 'Every drop is counted and kept',
        plain: 'Record what was suppressed and which rule did it.',
        formal: 'three counters, and each rule can be switched off',
        detail: 'A suppression you cannot inspect is indistinguishable from a compiler that ' +
          'failed to notice, and the difference matters the first time a rule suppresses ' +
          'something it should not have. Keeping the dropped list costs one array and makes the ' +
          'rule auditable; making each rule switchable makes it possible to see what each is ' +
          'worth rather than taking the total on trust.',
        example: 'Turning stage gating off in the demo makes four extra squiggles appear, each ' +
          'of them true and each a consequence of the one already marked.'
      },
      {
        term: 'A machine-applicable fix comes from a table, not a guess',
        plain: 'Offer an edit only when something the compiler already knows determines it.',
        formal: 'three of twelve error programs get a fix; nine get none',
        detail: 'The bar for an edit the compiler will apply without asking is higher than "a ' +
          'plausible repair". Each fix here is derived from a table that already exists: the ' +
          'binding table for a misspelled name, the grammar for a missing token. Where no table ' +
          'answers, offering nothing is the correct behaviour — a quick fix that guesses is one ' +
          'people turn off, and then the good ones go with it.',
        example: 'A misspelled name gets a rename fix because the resolver already computed the ' +
          'nearest name in scope; a type mismatch gets none, because nothing determines which ' +
          'side to change.'
      },
      {
        term: 'A fix is verified by applying it',
        plain: 'Apply the edit, recheck, and report what happened.',
        formal: 'three fixes remove their own diagnostic; two leave the file clean',
        detail: 'The two questions are different and conflating them breaks in both directions. ' +
          'Requiring the file to be clean rejects a correct fix on a source with two mistakes; ' +
          'requiring only that the diagnostic is gone would accept a fix that deleted the line. ' +
          'Reporting both is cheap — it is one extra pipeline run per fix — and it is the only ' +
          'way to claim "machine-applicable" and mean it.',
        example: 'Closing an unterminated string removes E-LEX-STRING and leaves the statement ' +
          'still missing its semicolon, which is a correct fix on a file with two mistakes.'
      },
      {
        term: 'Editor features are lookups, not analyses',
        plain: 'Hover, definition, references and completion each read a table that exists.',
        formal: 'the type table, the binding table, the binding table, the scope tree',
        detail: 'None of them is a new pass. That is the return on producing tables in 28.5 and ' +
          '28.6 rather than verdicts, and it gives a one-minute test for any compiler: ask it ' +
          'for the definition of a name. If it cannot answer without running the type checker, ' +
          'name resolution is not a data structure, and rename, escape analysis and dead-code ' +
          'elimination will each arrive as a separate project.',
        example: 'All four editor requests in the demo answer on a file that does not compile, ' +
          'which is the normal state of a file being edited.'
      },
      {
        term: 'A diagnostic\'s note is about the rule, not the instance',
        plain: 'Explain what the compiler requires, not only what went wrong here.',
        formal: 'a catalogue entry per code, with a title and a rule',
        detail: 'A reader meeting a code for the first time needs to learn the rule, and the ' +
          'instance they are looking at is the worst possible place to learn it from because ' +
          'it is the case where it was broken. Keeping the explanation in a catalogue keyed by ' +
          'code also makes the set of codes enumerable, which is what lets a test assert that ' +
          'no stage emits a code nobody documented.',
        example: 'E-TYPE-CONDITION\'s note says "if and while test a Bool; there is no coercion ' +
          'from Number", which is the rule rather than the incident.'
      }
    ],

    'testing-a-front-end': [
      {
        term: 'The generator is the grammar read backwards',
        plain: 'Turn each production into a function that emits one.',
        formal: 'four statement forms and two expression families, driven by a seeded generator',
        detail: 'The grammar is already written down, so the generator is nearly free, and that ' +
          'makes it the cheapest fuzzer a language will ever get. What it buys is not ' +
          'interesting programs — most of them are dull — but the ability to point a property at ' +
          'ten thousand programs rather than the fifteen somebody thought of. Seeding it means a ' +
          'failure is reproducible, which is the difference between a bug report and an anecdote.',
        example: 'Changing the seed produces a different corpus and the same four properties run ' +
          'over it unchanged.'
      },
      {
        term: 'Generate well-typed programs on purpose',
        plain: 'Type the generation so the corpus reaches the later stages.',
        formal: 'one function that only produces Numbers, one that only produces Bools',
        detail: 'A generator that emits syntactically valid nonsense produces programs the ' +
          'checker rejects, and a corpus of rejected programs exercises the error path and ' +
          'nothing else — the lowering and execution properties would see nothing at all. ' +
          'Typing the generation is a restriction that buys coverage, which is the opposite of ' +
          'the usual intuition that a fuzzer should be as unconstrained as possible.',
        example: 'The generated loops all terminate because their counters are generated rather ' +
          'than chosen; letting the generator write the guard produces a suite whose failures ' +
          'are all step-budget exhaustion.'
      },
      {
        term: 'A property is worth what it catches when broken',
        plain: 'Measure the property against a deliberately wrong implementation.',
        formal: 'the round trip catches 106 of 2 000 with the right-operand power dropped',
        detail: 'Zero failures against correct code is equally consistent with a working property ' +
          'and with a generator that never produced anything hard, and there is no way to tell ' +
          'those apart from the passing run. Running the same corpus through a known-bad version ' +
          'gives a sensitivity number. It also calibrates the sabotage: a break that fails ' +
          'everything is too coarse to locate anything.',
        example: 'The demo runs both printers over the same corpus every time the controls change ' +
          'and reports both columns.'
      },
      {
        term: 'The weakest oracle reaches the widest population',
        plain: 'Mutation fuzzing asks only that a tree came back.',
        formal: '2 000 corrupted programs, 0 crashes, 0 spans outside their own source',
        detail: 'Because it demands so little, it can be pointed at inputs no other property can ' +
          'use: truncated files, unbalanced brackets, transposed characters. That population is ' +
          'exactly what an editor deals with all day, and it is the population every other ' +
          'property excludes by construction. Asking for less is what makes it applicable, ' +
          'which is a general lesson about oracles rather than a fact about parsers.',
        example: 'Measured over two thousand, about 71% of mutants produce a diagnostic; ' +
          'the rest are corruptions that happen ' +
          'to leave a valid program, and every single one produced a tree.'
      },
      {
        term: 'A lost span is the quiet failure',
        plain: 'A span outside the file underlines nothing and crashes nothing.',
        formal: 'this parser produced ten such nodes per conformance run before an audit',
        detail: 'A crash is obvious and gets fixed the day it appears. A span with no end, or one ' +
          'pointing past the file, produces a diagnostic that draws no squiggle — and nobody ' +
          'notices until an editor tries to use it, by which time the cause is a helper three ' +
          'stages away that read the wrong field. It needs its own assertion because no other ' +
          'property is looking.',
        example: 'The parser\'s span helper read end.end on a value that carried its end inside ' +
          'span, and ten of 242 nodes per run had no usable extent.'
      },
      {
        term: 'Differential testing is what makes a lowering checkable',
        plain: 'Run both programs and compare.',
        formal: 'the comparison must include the bindings a program leaves behind',
        detail: 'Comparing return values alone passes whatever the core computed, because every ' +
          'conformance program is a list of let bindings and returns unit. That is not a small ' +
          'oversight — it is a suite that reports seventeen green rows while proving nothing. ' +
          'Choosing what counts as an observation is most of the design of a differential test, ' +
          'and the right answer is everything the program can be seen to do.',
        example: 'Six real defects in this milestone were found by this property and none by ' +
          'any other.'
      },
      {
        term: 'Golden files pin what a property cannot express',
        plain: 'Record this exact input\'s exact output and compare next time.',
        formal: 'token count, node count, bindings, types, core size and diagnostics per program',
        detail: 'A property says something must always hold; a golden file says this was 14 last ' +
          'time. The second catches changes the first cannot express — a tree that gained a ' +
          'node, a token count that moved — at the cost of needing a human to approve every ' +
          'legitimate change. The two are complementary and a suite with only one of them has a ' +
          'predictable blind spot.',
        example: 'The diagnostics column is the exception: it must be zero on every conformance ' +
          'row, which makes it a property rather than a recorded value.'
      },
      {
        term: 'Every oracle has a blind spot, and that is where the bugs were',
        plain: 'Ask what your tests cannot see, not what else you could assert.',
        formal: 'six oracles, each with what it answers and what it cannot',
        detail: 'The round trip passed ten thousand programs while the desugarer lowered an ' +
          'operator into a call to the user\'s own function, because the round trip never runs ' +
          'anything. The conformance suite passed while the checker crashed on every function ' +
          'containing a let, because no program had one. Each defect sat in a blind spot, and ' +
          'each was caught by adding a property that could see it rather than by asserting ' +
          'harder with the ones already there.',
        example: 'The fix for the conformance blind spot was not a better assertion, it was a ' +
          'sixteenth program.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
