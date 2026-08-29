/** Concepts for language design, the lexer and the parser (M28.1-M28.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'designing-a-language': [
      {
        term: 'The specification is a deliverable',
        plain: 'Write the language down as data, and make the tests read it.',
        formal: 'every feature carries a grammar production, a typing rule, an evaluation rule and an example',
        detail: 'A specification that lives in prose drifts from the implementation within weeks, ' +
          'because nothing checks it. Berugo\'s spec is a data file: the browser renders it, the ' +
          'conformance suite runs its examples, and a test asserts that every stage it names ' +
          'exists. Drift is then a build failure rather than something a reader discovers. The ' +
          'four rules per feature are four different questions, and most language arguments are ' +
          'two people answering different ones of them.',
        example: 'The match feature carries its production, "every arm produces the same type and ' +
          'the arms must be exhaustive", "the first arm whose pattern matches", and a runnable ' +
          'program.'
      },
      {
        term: 'A feature costs twice, and the two costs are unrelated',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a new syntax form"] --> B["cost in the parser:<br/>maybe a few lines"]',
            '    A --> C["cost afterwards: name resolution,<br/>type checking, desugaring,<br/>diagnostics, tooling"]',
            '    B --> D["and the first number tells you<br/>nothing about the second"]',
            '    C --> D'
          ].join('\n'),
          caption: 'Syntax is the cheap half and the one everybody argues about. A form that parses in an afternoon can cost a year everywhere downstream of the parser.'
        },
        plain: 'What a feature costs in the parser says nothing about what it costs afterwards.',
        formal: 'match: 4 units of parser work, 5 units after it; operators: 3 and 1',
        detail: 'Scoring the two separately is the only way to compare features honestly, ' +
          'because ranking by either column alone gives a different order. Pattern matching and ' +
          'operators cost almost the same to parse and differ by five times afterwards: match ' +
          'buys exhaustiveness checking, decision-tree compilation and a constraint on every ' +
          'later pass, while operators buy a precedence table and a printer that agrees with ' +
          'it. A language designed from the parser outwards accumulates the first kind and ends ' +
          'up with a back end nobody can finish.',
        example: 'Arrays and modules both cost 1 unit to parse and 3 afterwards — a ratio of ' +
          '3.00, the worst in the table, and neither is visible while writing the grammar. ' +
          'Operators are joint second in the parser ranking at 3 and joint last after it at 1.'
      },
      {
        term: 'Non-goals belong in the spec',
        plain: 'Say what the language does not have, why, and where it will arrive.',
        formal: 'five non-goals, each naming a milestone or stating that it is not planned',
        detail: 'A language with no stated non-goals grows one feature at a time until nobody ' +
          'can say what it is. Writing them down turns each omission from an oversight into a ' +
          'decision, and naming the destination turns it into a plan: exceptions are deferred to ' +
          'M30 because unwinding needs a call stack, mutable capture to M29 because it forces ' +
          'boxing or escape analysis. The two that are not planned at all say so, which is a ' +
          'different and equally useful answer.',
        example: 'Type classes are a non-goal because dictionary passing is a whole elaboration ' +
          'pass; M27 shows the mechanism without Berugo having to carry it.'
      },
      {
        term: 'Coverage is a column, not an aspiration',
        plain: 'Every feature must be exercised by at least one program that runs.',
        formal: 'eleven features, seventeen conformance programs, zero uncovered',
        detail: 'A feature covered by nothing is a feature nobody has run, and the failure mode ' +
          'is not that it is missing but that it half works — parsing correctly and checking ' +
          'wrongly, which no amount of reading the spec reveals. The column is a build-breaking ' +
          'test. It found a real gap on the first page load: modules were implemented in the ' +
          'resolver and the checker and exercised by no program at all.',
        example: 'The coverage table showed "NO" against modules until a program importing math ' +
          'and text was added; the feature had been implemented twice and never run.'
      },
      {
        term: 'Every stage is a pure function of the one before it',
        plain: 'A stage reads its input and produces its output, and keeps nothing between runs.',
        formal: 'run the whole pipeline twice on one input and compare all five artefacts',
        detail: 'Purity is what makes a pipeline inspectable: any prefix can be run, every ' +
          'intermediate kept, and a stage tested without the ones after it. It is also easy to ' +
          'lose by accident — a module-level counter for fresh type variables is the classic — ' +
          'and the loss is invisible until two compilations in one process disagree. Running ' +
          'everything twice and comparing costs one extra pass and turns the property into a ' +
          'check that names the offending stage.',
        example: 'All seventeen conformance programs produce identical fingerprints for lexing, ' +
          'parsing, resolution, typing and lowering on a second run.'
      },
      {
        term: 'The pipeline diagram is a design tool',
        plain: 'Adding a feature means walking the diagram and asking what changes at each box.',
        formal: 'ten stages across four milestones, five of them built here',
        detail: 'The walk is what converts "it will need some work in the back end" into a ' +
          'number that can be compared against another feature\'s. String interpolation costs ' +
          'the lexer a mode, the parser nothing and the desugarer a rewrite. Sum types cost the ' +
          'parser a form and the checker an exhaustiveness algorithm and every later pass a ' +
          'constraint. Doing this before committing to a production is the difference between a ' +
          'language you can finish and one you cannot.',
        example: 'The stage table names, for each of the ten stages, what it takes, what it ' +
          'gives, and which features it first has to handle.'
      },
      {
        term: 'Versioning the language is a decision made now',
        plain: 'Name the version so a recorded expectation can say which language it describes.',
        formal: 'Berugo v1 (M28); M29 adds mutable capture and M30 adds exceptions',
        detail: 'Both deferred features change what the earlier stages must handle, so a golden ' +
          'file recorded against v1 is describing a language that will not exist in two ' +
          'milestones. Naming the version means that file can say so. Without a version, a ' +
          'stale expectation is indistinguishable from a regression, and the usual resolution ' +
          'is to update the expectation without working out which it was.',
        example: 'The spec exports VERSION as "Berugo v1 (M28)", and every golden figure in this ' +
          'milestone is a fact about that version.'
      },
      {
        term: 'Small enough to build, large enough to be interesting',
        plain: 'Pick the smallest feature set that forces every problem you want to meet.',
        formal: 'expressions with precedence, let, closures, records, arrays, sum types, three loop forms, modules, inference',
        detail: 'Each of those exists because it creates a specific problem later: closures force ' +
          'capture analysis and escape analysis, sum types force exhaustiveness and decision ' +
          'trees, records force structural unification and layout, loops force a lowering that ' +
          'has to survive break and continue. Cutting any one of them would remove a whole ' +
          'subject from the next three milestones, and adding more would not add a subject, only ' +
          'more of the same work.',
        example: 'Berugo has no exceptions in v1 precisely so that M30 meets stack unwinding as ' +
          'a subject rather than as a detail already half solved.'
      }
    ],

    'the-lexer': [
      {
        term: 'A span, not a line number',
        plain: 'Every token records where it starts and where it ends.',
        formal: 'a start offset and an end offset, carried forward by every later stage',
        detail: 'A line number can only ever underline a line. Offsets can underline exactly the ' +
          'characters at fault, turn a click into a node, and drive a rename that edits three ' +
          'occurrences and nothing else. Every later stage copies spans forward, and the stages ' +
          'that synthesise nodes copy the ORIGINAL span, which is what stops an error message ' +
          'pointing at code the developer never wrote. This is not overhead; it is the only ' +
          'channel through which a compiler can talk about a place.',
        example: 'The unterminated string in the default sample spans offsets 51 to 57, and the ' +
          'caret in the rendered diagnostic runs under exactly those six characters.'
      },
      {
        term: 'Trivia is attached, not discarded',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["whitespace and comments"] --> B{"throw them away?"}',
            '    B -->|yes| C["the compiler is fine"]',
            '    C --> D["and no formatter, no refactoring<br/>tool and no doc extractor<br/>can be built on it"]',
            '    B -->|no| E["attach them to the token<br/>that follows"]',
            '    E --> F["and the tree can be printed<br/>back exactly"]'
          ].join('\n'),
          caption: 'A compiler front end and a tooling front end differ mostly in this decision, and it is very hard to add afterwards.'
        },
        plain: 'Whitespace and comments become a list on the token that follows them.',
        formal: '26 real tokens carrying 23 pieces of trivia over 138 characters',
        detail: 'That one decision is what lets a single lexer serve the compiler, the formatter ' +
          'and the language server. Every character of the file is reachable from the token ' +
          'stream — a real token, or trivia on the next one — which is the property a formatter ' +
          'needs and a compiler-only lexer does not bother to keep. Retrofitting it means every ' +
          'consumer\'s positions are off by the trivia it was silently skipping, so in practice ' +
          'it means a rewrite.',
        example: 'Hiding the trivia chips leaves the token count unchanged and makes the file ' +
          'impossible to reconstruct, which is exactly what a compiler-only lexer hands you.'
      },
      {
        term: 'Errors are tokens, not exceptions',
        plain: 'A malformed literal becomes an error token and scanning continues.',
        formal: 'three bad literals, three error tokens, and every token after them is real',
        detail: 'This is the load-bearing choice. A file being typed is malformed most of the ' +
          'time, and a scanner that throws produces one message and no stream — so an editor ' +
          'showing a file with one typo has nothing to colour, fold or complete in. Emitting a ' +
          'token instead means the parser gets a usable stream, the resolver still runs, and the ' +
          'reader gets one diagnostic per mistake rather than nothing and a stack trace.',
        example: 'In the default sample the unterminated string is followed by the keyword ' +
          'let, and the two lines after the three bad literals scan perfectly — 26 tokens and ' +
          '23 pieces of trivia over 138 characters, with every character still reachable.'
      },
      {
        term: 'Maximal munch is policy and has to be written down',
        plain: 'Always take the longest token that matches.',
        formal: 'the operator table is sorted longest first, so == is never two =',
        detail: 'Leaving the rule implicit is the source of a great many one-character bugs, and ' +
          'all of them look like parser problems: an arrow scanned as a minus and a greater-than ' +
          'produces a syntax error two tokens later with no hint about the cause. Writing the ' +
          'table longest-first makes the policy visible in the source and makes adding a ' +
          'two-character operator a one-line change rather than a debugging session.',
        example: 'Berugo has ten multi-character operators including -> and =>, and none of them ' +
          'can be scanned as its prefix.'
      },
      {
        term: 'A malformed numeral is one mistake, not two tokens',
        plain: 'A number running into a letter is an error token, not a number and a name.',
        formal: '0x1 scans as one error token; without the check it is 0 followed by x1',
        detail: 'Maximal munch stops at the first character a number cannot use, so a scanner ' +
          'that does nothing more produces a perfectly well-formed stream for a program nobody ' +
          'wrote. The parser then complains about a missing semicolon several tokens to the ' +
          'right, which is the wrong place, and the reader looks at the wrong line. Consuming ' +
          'the trailing identifier into a single error token puts the squiggle on the numeral.',
        example: 'Of nine numeric forms, four are rejected: two decimal points, a hex prefix, a ' +
          'numeral running into an identifier, and an exponent marker with no digits.'
      },
      {
        term: 'Interpolation is why a scanner needs modes',
        plain: 'Inside a string interpolation, the language is the language again.',
        formal: 'brace counting, so a record literal inside an interpolation survives',
        detail: 'Stopping at the first closing brace cuts a nested record in half, producing a ' +
          'string that ends in the middle and an expression that starts nowhere — and the ' +
          'resulting diagnostics point at neither. Counting braces is a few lines and it is the ' +
          'difference between a feature that works and one that works on the examples in the ' +
          'documentation. It also means the scanner is a state machine rather than a loop, which ' +
          'is the honest way to describe it.',
        example: 'The interpolation sample includes a nested record literal inside the braces, ' +
          'and the string token still ends at the right quote.'
      },
      {
        term: 'Incremental relexing needs a safe boundary',
        plain: 'An edit cannot change any token that finished before the last boundary at or before it.',
        formal: '24 of 27 tokens reused when the edit is near the end of the file',
        detail: 'The boundary is the end of the last token that finished at or before the edit ' +
          'offset. Everything earlier is untouched by construction; everything later is ' +
          'rescanned. That asymmetry is why an editor feels fast when you are typing at the ' +
          'bottom of a file and slower at the top, and the correctness claim has to be separate ' +
          'and stronger: the incremental result is asserted to be identical to a full rescan, ' +
          'because an incremental lexer that drifts is worse than none.',
        example: 'The reported reuse rate of 88.9% is the prefix saving only; a production ' +
          'implementation also detects where the stream reconverges at the tail.'
      },
      {
        term: 'Hand-written beats generated here, for three specific reasons',
        plain: 'A generator would produce the token set and none of the things that matter.',
        formal: 'trivia attachment, error tokens with recovery, and interpolation modes',
        detail: 'M24 builds a lexer generator from regular expressions with maximal munch and ' +
          'rule priority, and it would produce exactly this token set. What it would not produce ' +
          'is any of the three features above, because none of them is expressible as a regular ' +
          'language plus a priority order. That is why production compilers generate parsers far ' +
          'more often than they generate scanners, and it is worth knowing which of the two you ' +
          'are actually choosing between.',
        example: 'The generated lexer in M24 reports every maximal-munch decision it passed over ' +
          'and has no concept of a comment belonging to the declaration after it.'
      }
    ],

    'the-parser': [
      {
        term: 'The parser is total',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["any input at all,<br/>however broken"] --> B["the parser returns a tree"]',
            '    B --> C["with error nodes where<br/>it could not make sense of things"]',
            '    C --> D["so every later pass has<br/>something to work on"]',
            '    D --> E["and an editor keeps highlighting,<br/>completing and type-checking<br/>the parts that are fine"]'
          ].join('\n'),
          caption: 'Returning nothing on a syntax error makes every downstream feature conditional on the file being valid — which, in an editor, it usually is not.'
        },
        plain: 'It always returns a tree, whatever the input.',
        formal: 'malformed input yields error nodes carrying the span of what could not be read',
        detail: 'Nothing throws. That single property is what makes an editor possible, because ' +
          'a file being typed is malformed most of the time and a parser that gives up at the ' +
          'first problem cannot colour it, fold it or complete inside it. It also means the ' +
          'resolver and the checker can run on a broken file, which is where hover and ' +
          'go-to-definition come from during editing rather than only after a successful build.',
        example: 'A sample with two malformed statements and one good one yields a 13-node tree ' +
          'containing 1 error node, with 3 problems reported and nothing thrown.'
      },
      {
        term: 'Recursive descent for statements, Pratt for expressions',
        plain: 'Keyword-led forms get a function each; precedence-led forms get a table.',
        formal: 'thirteen binary operators over six precedence levels, driven by data',
        detail: 'The split is not stylistic. Statements are keyword-led, so seeing "while" tells ' +
          'you which function to call and a function per form reads like the grammar. ' +
          'Expressions are precedence-led, and a precedence table is data — encoding it as a ' +
          'cascade of parseAdditive calling parseMultiplicative turns a table into control flow ' +
          'that has to be restructured to add an operator, and buries associativity in the ' +
          'shape of the recursion.',
        example: 'Adding a new binary operator to Berugo is one row in PRECEDENCE; adding a new ' +
          'statement form is one function.'
      },
      {
        term: 'Two binding powers encode associativity',
        plain: 'Each operator has a power on its left and a power on its right, differing by one.',
        formal: 'plus has left 9 and right 10, which makes 1 - 2 - 3 group as (1 - 2) - 3',
        detail: 'The Pratt loop asks whether it may take the next operator by comparing against ' +
          'a minimum power, so making the right power one higher stops the recursive call from ' +
          'taking an operator of the same level and forces left grouping. A right-associative ' +
          'operator sets the right power one LOWER, and that single change is the whole of ' +
          'associativity — no separate rule, no special case, one number.',
        example: 'Every one of the thirteen operators has right = left + 1, so all thirteen are ' +
          'left-associative and a == b == c parses as (a == b) == c.'
      },
      {
        term: 'Parse first, then validate what the grammar cannot say',
        plain: 'Read any expression, then check its shape.',
        formal: 'only a name, a field or an index may appear on the left of an assignment',
        detail: 'Expressing that restriction in the grammar means duplicating the whole ' +
          'expression grammar for the assignable subset, which doubles the parser and makes ' +
          'every future expression form need two productions. Parsing anything and then checking ' +
          'produces a message about assignment rather than a syntax error about an unexpected ' +
          'equals sign, which is both shorter to implement and better to read. Nearly every real ' +
          'grammar has three or four of these.',
        example: 'Writing 1 = 2 gives "cannot assign here" pointing at the 1, not a parse error ' +
          'pointing at the equals sign.'
      },
      {
        term: 'Recovery has a resynchronisation point, and choosing it is the design',
        plain: 'After an error, skip to a token you can restart from.',
        formal: 'Berugo resynchronises at the statement boundary — the semicolon',
        detail: 'That is why one broken statement costs one diagnostic and the statements after ' +
          'it still parse. Resynchronising at the wrong token is how a compiler produces forty ' +
          'errors for one missing brace: it restarts inside a construct it is no longer inside, ' +
          'and every subsequent token is a surprise. There are two recovery kinds here and the ' +
          'demo labels which happened — an error node in the tree, or a required token treated ' +
          'as present.',
        example: 'The broken sample reports three problems across three statements, and the third ' +
          'statement parses normally.'
      },
      {
        term: 'One precedence table, two consumers',
        plain: 'The parser and the printer read the same table.',
        formal: 'PRECEDENCE lives in ast.js, and both the Pratt loop and the printer index it',
        detail: 'A printer with its own idea of precedence emits brackets the parser does not ' +
          'need, or omits ones it does, and either way the round-trip property fails without ' +
          'telling you which of two implementations is wrong. Sharing the table makes that class ' +
          'of bug impossible rather than merely unlikely, which converts the round-trip property ' +
          'from a test of the printer into a test of the parser — where the interesting bugs ' +
          'are.',
        example: 'Of eleven grouping fixtures, nine print back exactly as written and two ' +
          'lose brackets the tree never needed: ((1)) + 2 prints as 1 + 2, and five nodes ' +
          'become three.'
      },
      {
        term: 'A block\'s last entry may be its value',
        plain: 'An expression without a trailing semicolon is what the block produces.',
        formal: 'this is what makes if an expression rather than a statement',
        detail: 'It is the one place where the statement and expression families meet, and it ' +
          'costs the parser one lookahead at the end of every block. Getting it wrong silently ' +
          'changes what a function returns: printing a tail with a semicolon turns a block ' +
          'producing a number into one producing unit, and the program still compiles. The ' +
          'printer has to know the rule too, which is why the round-trip property covers it.',
        example: 'The conditional conformance program is a let bound to an if, and both arms are ' +
          'blocks whose tails are numbers.'
      },
      {
        term: 'The error node belongs to the expression family',
        plain: 'Recovery produces a node of a kind everything downstream already handles.',
        formal: 'error appears wherever an expression was required and could not be read',
        detail: 'Putting recovery in the expression family means the resolver, the checker and ' +
          'the printer see a tree of the shape they expect and only have to handle one unusual ' +
          'kind, rather than a hole where a node should be. A hole is a null, and a null is ' +
          'checked at fifty call sites or at none. The node also carries the span of what could ' +
          'not be read, so the diagnostic and the tree agree about where the problem is.',
        example: 'let b = 3 * ; produces an error node spanning the semicolon, and the statement ' +
          'after it is unaffected.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
