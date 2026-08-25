/** Reference entries for language design, the lexer and the parser (M28.1-M28.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'designing-a-language': {
      summary: 'Eleven features scored twice, where the parser ranking and the after-the-parser ' +
        'ranking disagree at both ends, and a coverage column that found a feature implemented ' +
        'twice and run by nothing.',
      intuition: 'A specification is a data file the tests read; a feature costs once where you ' +
        'write it and again in every stage that has to keep it working, and only the second ' +
        'number predicts the next three milestones.',
      formulation: {
        equations: [
          {
            label: 'The cost table, sorted by work after the parser',
            expr: 'feature · parser · after · total · ratio',
            terms: [
              { sym: 'sum types and pattern matching', meaning: '4 · 5 · 9 · 1.25' },
              { sym: 'functions and closures', meaning: '2 · 4 · 6 · 2.00' },
              { sym: 'records', meaning: '2 · 3 · 5 · 1.50' },
              { sym: 'arrays and modules', meaning: '1 · 3 · 4 · 3.00 each — the worst ratios' },
              { sym: 'operators and literals', meaning: '3 · 1 · 4 · 0.33 each — the best' },
              { sym: 'all eleven', meaning: '21 units of parser work against 25 after it, a ratio of 1.19' }
            ]
          },
          {
            label: 'The pipeline, and who owns each stage',
            expr: 'stage · milestone · takes · gives',
            terms: [
              { sym: 'lex, parse, resolve, typecheck, desugar', meaning: 'M28 — text to a core-language tree' },
              { sym: 'lower to IR, optimise', meaning: 'M29 — core to SSA and back' },
              { sym: 'emit bytecode, run', meaning: 'M30 — SSA to a value' },
              { sym: 'collect garbage', meaning: 'M31 — a heap to a smaller heap' }
            ]
          },
          {
            label: 'Coverage, and the gap it found',
            expr: 'measure · value',
            terms: [
              { sym: 'conformance programs', meaning: '17, covering 11 of 11 features' },
              { sym: 'error-suite programs', meaning: '12, one mistake each' },
              { sym: 'stated non-goals', meaning: '5, each naming a milestone or saying not planned' },
              { sym: 'the gap on first load', meaning: 'modules: implemented in two stages, exercised by zero programs' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every feature the spec names is covered by a running program',
          why: 'A feature nothing runs half works, and no amount of reading the spec reveals which half.',
          breaks: 'The coverage column reports a verdict per feature and a NO is a build failure.'
        },
        {
          name: 'Every stage the spec names exists',
          why: 'A pipeline diagram that describes stages nobody wrote is a plan, not a specification.',
          breaks: 'A test walks STAGES and asserts each M28 entry has a section that renders.'
        },
        {
          name: 'Both cost columns are reported, never their total alone',
          why: 'The two rankings disagree, so a single number hides the decision the table exists to inform.',
          breaks: 'The demo sorts by either column and by the ratio, and the sorts give different orders.'
        }
      ],
      complexity: [
        { operation: 'rendering one feature', average: 'O(1) — four fields and a stage lookup', worst: 'O(1)' },
        { operation: 'the cost table', average: 'O(features log features) to sort', worst: '11 rows' },
        { operation: 'coverage', average: 'O(features × programs)', worst: '11 × 17 = 187 membership tests' },
        { operation: 'running the whole conformance suite', average: 'O(programs × source size)', worst: '17 programs through 5 stages each' }
      ],
      failureModes: [
        {
          symptom: 'A feature was "quick to add" and the back end is now unfinishable.',
          cause: 'It was scored on parser work only, which is the column with no predictive value.',
          fix: 'Score both columns before writing the production, and compare the ratio against the features you already have.'
        },
        {
          symptom: 'The documentation and the compiler disagree about what the language is.',
          cause: 'The specification is prose, so nothing checks it.',
          fix: 'Make the spec a data file the conformance suite reads, so drift is a build failure.'
        },
        {
          symptom: 'A feature works in the parser and produces wrong types.',
          cause: 'No conformance program exercised it, so nothing ran the later stages on it.',
          fix: 'Make coverage a reported column and treat an uncovered feature as a failure.'
        },
        {
          symptom: 'Nobody can say whether a feature is planned or rejected.',
          cause: 'Non-goals are not written down, so every omission looks like an oversight.',
          fix: 'List them with a reason and a destination, including the ones that are never coming.'
        }
      ],
      inTheWild: [
        'The Rust reference and its RFC process, where a feature must state its interaction with every existing one.',
        'Go\'s explicit list of things it does not have, which is why the language stayed small for a decade.',
        'The ECMAScript specification, which is executable enough that test262 is derived from it.',
        'WebAssembly, whose specification ships with a mechanised formalisation and a conformance suite.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques, and Tools', note: 'the pipeline this milestone follows, chapter by chapter' },
        { title: 'Nystrom — Crafting Interpreters', note: 'the same language built twice, with the design decisions made visible' },
        { title: 'Hoare — Hints on Programming Language Design (1973)', note: 'the case for a small language, and for saying what is not in it' },
        { title: 'Wirth — On the Design of Programming Languages (1974)', note: 'features as costs rather than as capabilities' }
      ]
    },

    'the-lexer': {
      summary: 'A scanner that keeps every character reachable from the token stream, turns ' +
        'three malformed literals into three error tokens without stopping, and reuses 24 of 27 ' +
        'tokens after an edit near the end of the file.',
      intuition: 'Spans, trivia and error tokens are the three decisions that decide whether one ' +
        'scanner serves the compiler, the formatter and the editor, or only the first.',
      formulation: {
        equations: [
          {
            label: 'The default sample, measured',
            expr: 'measure · value',
            terms: [
              { sym: 'characters', meaning: '123, every one reachable from the stream' },
              { sym: 'tokens', meaning: '26, including the end-of-file token' },
              { sym: 'trivia pieces', meaning: '23, attached to the token that follows each' },
              { sym: 'error tokens', meaning: '3, and every token after them is real' }
            ]
          },
          {
            label: 'Numeric forms, five accepted and four rejected',
            expr: 'written · outcome',
            terms: [
              { sym: '1_000.5e2', meaning: 'number 100050 — separators, a point and an exponent' },
              { sym: '2e-3', meaning: 'number 0.002 — a signed exponent' },
              { sym: '1.2.3', meaning: 'one error token, not 1.2 followed by .3' },
              { sym: '0x1 and 1abc', meaning: 'one error token each; without the check, two valid tokens each' },
              { sym: '1e', meaning: 'one error token — the exponent marker is not consumed, so it would be 1 then e' }
            ]
          },
          {
            label: 'One edit, and the tokens that survive it',
            expr: 'measure · value',
            terms: [
              { sym: 'safe boundary', meaning: 'offset 126 — the end of the last token finishing at or before the edit' },
              { sym: 'reused', meaning: '24 of 27 tokens, a rate of 88.9%' },
              { sym: 'rescanned', meaning: '3 of 27, including the token the edit landed in' },
              { sym: 'the correctness claim', meaning: 'the incremental result is asserted identical to a full rescan' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every character of the file is reachable from the token stream',
          why: 'It is the property a formatter needs, and the one a compiler-only lexer never notices it lacks.',
          breaks: 'Trivia is attached rather than discarded, and the character count is reported beside the token count.'
        },
        {
          name: 'Scanning never throws',
          why: 'A file being typed is malformed most of the time, and an editor needs a stream for it.',
          breaks: 'Every malformed construct produces an error token, and the demo shows the real token that follows each.'
        },
        {
          name: 'A numeral is one token or one error, never a valid split',
          why: 'A split produces a well-formed stream for a program nobody wrote, and the complaint arrives several tokens away.',
          breaks: 'A digit sequence running into an identifier consumes the tail into a single error token.'
        },
        {
          name: 'An incremental relex equals a full rescan',
          why: 'A drifting incremental lexer is worse than none, because the drift is silent.',
          breaks: 'The incremental path computes the full result and reports the reusable prefix rather than trusting it.'
        }
      ],
      complexity: [
        { operation: 'scanning a file', average: 'O(characters)', worst: 'O(characters) — one pass, no backtracking' },
        { operation: 'one token', average: 'O(token length)', worst: 'O(token length)' },
        { operation: 'finding the safe boundary', average: 'O(tokens)', worst: '27 tokens on the default sample' },
        { operation: 'an interpolation', average: 'O(nested length)', worst: 'brace counting, so a nested record costs its own length' },
        { operation: 'position from an offset', average: 'O(offset)', worst: 'a scan of the prefix, which is why it is called per diagnostic and not per token' }
      ],
      failureModes: [
        {
          symptom: 'The formatter has to be given its own lexer.',
          cause: 'The compiler\'s lexer discards whitespace and comments.',
          fix: 'Attach trivia to the following token from the start; retrofitting shifts every position every consumer computed.'
        },
        {
          symptom: 'An editor shows no colouring for a file with one bad string literal.',
          cause: 'The scanner throws instead of emitting an error token.',
          fix: 'Make errors tokens. The stream after the bad text is still correct and still useful.'
        },
        {
          symptom: 'A missing semicolon is reported several tokens after the real mistake.',
          cause: 'A malformed numeral split into two valid tokens and the parser noticed later.',
          fix: 'Consume the trailing identifier characters into one error token so the span covers the numeral.'
        },
        {
          symptom: 'An interpolated string containing a record literal ends in the wrong place.',
          cause: 'The scanner stopped at the first closing brace instead of counting.',
          fix: 'Count braces; inside an interpolation the language is the language again.'
        },
        {
          symptom: 'An arrow operator is scanned as a minus and a greater-than.',
          cause: 'The operator table is not sorted longest first, so maximal munch is not enforced.',
          fix: 'Sort the table by length and make the policy explicit in the source.'
        }
      ],
      inTheWild: [
        'roslyn, whose syntax trees carry trivia on every token and are the basis of every C# refactoring.',
        'rustc\'s lexer, which emits error tokens and recovers, and rustfmt, which reads the same tokens.',
        'The TypeScript compiler, whose scanner is re-entrant so the language service can relex a region.',
        'tree-sitter, built around incremental relexing and reparsing for editors specifically.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — chapter 3, Lexical Analysis', note: 'maximal munch, and the generated alternative' },
        { title: 'Nystrom — Crafting Interpreters, Scanning', note: 'a hand-written scanner with error recovery, at length' },
        { title: 'Microsoft — Language Server Protocol specification', note: 'what a scanner has to provide for an editor to be possible' },
        { title: 'Wagner and Graham — Efficient and Flexible Incremental Parsing (1998)', note: 'the boundary argument this relex uses' }
      ]
    },

    'the-parser': {
      summary: 'A parser that returns a tree for input it could not read — 13 nodes and 1 error ' +
        'node for a file with two broken statements — and a printer that removes brackets from ' +
        'two of eleven fixtures because it reads the parser\'s own precedence table.',
      intuition: 'Recursive descent for keyword-led statements, Pratt for precedence-led ' +
        'expressions, error nodes rather than exceptions, and one precedence table shared with ' +
        'the printer.',
      formulation: {
        equations: [
          {
            label: 'The malformed sample',
            expr: 'measure · value',
            terms: [
              { sym: 'nodes', meaning: '13, depth 4, nothing thrown' },
              { sym: 'error nodes against problems', meaning: '1 against 3 — not every problem needs a node' },
              { sym: 'recoveries', meaning: '1 error node, 2 required tokens treated as present' },
              { sym: 'the third statement', meaning: 'parses normally, with no error node in it' }
            ]
          },
          {
            label: 'Binding powers, and what the difference of one does',
            expr: 'operator · left · right',
            terms: [
              { sym: 'or', meaning: '1 · 2 — the loosest' },
              { sym: 'and', meaning: '3 · 4' },
              { sym: 'equality', meaning: '5 · 6, so a == b == c is (a == b) == c' },
              { sym: 'comparison', meaning: '7 · 8' },
              { sym: 'plus and minus', meaning: '9 · 10' },
              { sym: 'times, divide, remainder', meaning: '11 · 12' },
              { sym: 'unary and postfix', meaning: '13 and 15' }
            ]
          },
          {
            label: 'Grouping, checked by printing back',
            expr: 'written · printed',
            terms: [
              { sym: '1 + (2 * 3)', meaning: '1 + 2 * 3 — brackets removed, times already binds tighter' },
              { sym: '((1)) + 2', meaning: '1 + 2 — five nodes become three' },
              { sym: '1 - (2 - 3)', meaning: 'unchanged — removing them would regroup it' },
              { sym: 'the totals', meaning: '9 of 11 unchanged, 2 losing brackets the tree never needed' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The parser never throws',
          why: 'A file being typed is malformed most of the time and an editor needs a tree for it.',
          breaks: 'Every malformed position produces an error node or an inserted token, and 2 000 mutated files produce 2 000 trees.'
        },
        {
          name: 'Every node carries a span inside the source',
          why: 'A span with no end underlines nothing and crashes nothing, so nobody notices.',
          breaks: 'The span audit walks every node of every conformance and mutated program; it found ten broken spans per run before the parser\'s span helper was fixed.'
        },
        {
          name: 'The parser and the printer read one precedence table',
          why: 'Two implementations of precedence make the round-trip property a test of which one is wrong.',
          breaks: 'PRECEDENCE lives in ast.js and both consume it; the demo prints the table the parser used.'
        },
        {
          name: 'Recovery resynchronises at a statement boundary',
          why: 'Restarting inside a construct produces a cascade of surprises.',
          breaks: 'The malformed sample reports three problems across three statements and parses the third cleanly.'
        }
      ],
      complexity: [
        { operation: 'parsing a file', average: 'O(tokens)', worst: 'O(tokens) — one pass, no backtracking' },
        { operation: 'one expression', average: 'O(nodes)', worst: 'O(nodes), with recursion depth bounded by nesting' },
        { operation: 'printing a tree', average: 'O(nodes)', worst: 'O(nodes) plus one precedence lookup per binary node' },
        { operation: 'the round trip', average: 'O(source) three times', worst: 'two parses and one print' },
        { operation: 'nodeAt', average: 'O(depth)', worst: '9 of 18 nodes on the example function' }
      ],
      failureModes: [
        {
          symptom: 'One missing brace produces forty errors.',
          cause: 'Recovery resynchronises at a token inside the construct that failed.',
          fix: 'Resynchronise at a statement boundary, and report what was expected rather than what was found.'
        },
        {
          symptom: 'A diagnostic underlines nothing.',
          cause: 'A node carries a span with no end, usually from a helper that read the wrong field.',
          fix: 'Audit every node\'s span against the source length; the failure is invisible without an explicit check.'
        },
        {
          symptom: 'The printer emits brackets the parser does not need.',
          cause: 'The printer has its own idea of precedence.',
          fix: 'Share the table. The round trip then tests the parser rather than adjudicating between two implementations.'
        },
        {
          symptom: 'Adding an operator requires restructuring the parser.',
          cause: 'Precedence is encoded as a cascade of functions rather than as data.',
          fix: 'Use a Pratt loop over a table; adding an operator becomes one row.'
        },
        {
          symptom: 'A syntax error complains about an unexpected equals sign.',
          cause: 'The grammar tried to express which expressions are assignable.',
          fix: 'Parse any expression and validate the shape afterwards, so the message is about assignment.'
        }
      ],
      inTheWild: [
        'rustc and the TypeScript compiler, both hand-written recursive descent with error nodes and recovery.',
        'clang, whose diagnostics and fix-its depend on the parser producing a tree for broken input.',
        'Pratt parsing as used in Douglas Crockford\'s JavaScript parser and in most modern hand-written compilers.',
        'tree-sitter, which parses malformed input by construction because an editor is its only client.'
      ],
      sources: [
        { title: 'Pratt — Top Down Operator Precedence (1973)', note: 'the algorithm, and the argument for a table over a cascade' },
        { title: 'Aho, Lam, Sethi and Ullman — chapter 4, Syntax Analysis', note: 'recursive descent, and error recovery strategies' },
        { title: 'Nystrom — Crafting Interpreters, Parsing Expressions', note: 'the same split between statements and expressions, worked through' },
        { title: 'Appel — Modern Compiler Implementation in ML', note: 'AST design and the case for spans on every node' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
