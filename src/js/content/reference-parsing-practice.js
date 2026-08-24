/** Reference entries for Pratt parsing, lexing, recovery and real languages (M25.9-M25.12). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'pratt-parsing-and-precedence': {
      summary: 'An editable eighteen-row binding-power table with ten expected parenthesisations ' +
        'asserted against it, so moving one number breaks exactly the cases that depend on the ' +
        'ordering it controls — and nothing else.',
      intuition: 'Precedence is a number in a table, and the tree is a function of that number.',
      formulation: {
        equations: [
          {
            label: 'The loop',
            expr: 'parse a prefix, then while power(next) > limit: consume it and let it take the left',
            terms: [
              { sym: 'null denotation', meaning: 'what a token means with nothing to its left — literals, prefix operators, "("' },
              { sym: 'left denotation', meaning: 'what it means with an expression to its left — infix, postfix, call, index, ternary' },
              { sym: 'left-associative', meaning: 'recurse with limit = own power, so an equal operator stops the loop' },
              { sym: 'right-associative', meaning: 'recurse with limit = power − 1, so an equal operator continues and nests' },
              { sym: 'a prefix operator', meaning: 'recurses with its OWN power, or unary minus swallows the line' }
            ]
          },
          {
            label: 'The C-like table, and what it produces',
            expr: 'token · power · the case it decides',
            terms: [
              { sym: '^ at 80, right', meaning: 'a ^ b ^ c → (a ^ (b ^ c)); flip to left and it becomes ((a ^ b) ^ c)' },
              { sym: '* at 60 above + at 50', meaning: 'a + b * c → (a + (b * c)); swap them and it becomes ((a + b) * c)' },
              { sym: 'prefix − at 90', meaning: '- a + b → ((- a) + b), depth 3, 3 calls' },
              { sym: 'postfix ++ at 95', meaning: 'a ++ + b → ((a ++) + b), 2 calls' },
              { sym: '? at 5, right', meaning: 'a ? b : c ? d : e → (a ? b : (c ? d : e)), 5 calls' },
              { sym: 'a + b * c ^ d', meaning: '(a + (b * (c ^ d))) — depth 4, 4 calls, 4 comparisons' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Associativity is the minus one, and nothing else',
          why: 'In a grammar the same distinction means rewriting the rule so the recursion changes side.',
          breaks: 'The associativity control flips `a ^ b ^ c` between the two parenthesisations and touches nothing else.'
        },
        {
          name: 'Every parenthesisation is asserted, not illustrated',
          why: 'Precedence is exactly the kind of claim that is obvious until it is wrong.',
          breaks: '10 expected strings are written down, compared, and the same comparison runs in the test suite.'
        },
        {
          name: 'There is no backtracking anywhere in the loop',
          why: 'The call count equals the number of sub-expressions, which is why the technique is fast enough for production.',
          breaks: '4 calls for a four-operand expression, 2 for a postfix one.'
        },
        {
          name: 'The table is a value, rebuilt from the controls on every change',
          why: 'If it were generated code, the demo could not edit it and neither could a fixity declaration.',
          breaks: 'Moving a slider changes the tree without regenerating anything.'
        }
      ],
      complexity: [
        { operation: 'parsing an expression', average: 'linear in the tokens', worst: 'linear — one call per sub-expression' },
        { operation: 'one operator decision', average: 'one table lookup and one comparison', worst: 'the same' },
        { operation: 'adding an operator', average: 'one table row', worst: 'one table row — against a nonterminal and two rule rewrites in a grammar' },
        { operation: 'the equivalent grammar', average: 'one function call per precedence level per atom', worst: '6 levels means 6 calls to reach a bare variable' }
      ],
      failureModes: [
        {
          symptom: 'Unary minus swallows the rest of the expression.',
          cause: 'The prefix handler parsed an unrestricted expression instead of recursing with its own power.',
          fix: 'Give prefix operators a binding power and pass it as the limit.'
        },
        {
          symptom: 'Exponentiation is left-associative and nobody notices until a test.',
          cause: 'The right-associative recursion used the operator’s own power rather than one less.',
          fix: 'Assert `a ^ b ^ c` parses as `(a ^ (b ^ c))`; it is a one-line test.'
        },
        {
          symptom: 'Two operators inserted at the same binding power behave unpredictably together.',
          cause: 'Equal powers make the relative order depend on associativity alone.',
          fix: 'Leave gaps of ten between levels so a new operator can be placed between two existing ones.'
        },
        {
          symptom: 'A formatter adds parentheses the parser does not need.',
          cause: 'It has its own copy of the precedence table and the two have drifted.',
          fix: 'Export the parser’s table and have the formatter read it — the point of precedence as data.'
        }
      ],
      inTheWild: [
        'Clang, Roslyn, Go, V8 and rustc, all of which parse expressions by precedence climbing or Pratt.',
        'Haskell, Swift and Scala, whose user-defined operator fixities are table rows inserted at parse time.',
        'Douglas Crockford’s JavaScript parser, which popularised Pratt outside compiler circles.',
        'Every calculator REPL that grew an operator without anyone touching the parser.'
      ],
      sources: [
        { title: 'Pratt — Top down operator precedence (1973)', note: 'the original paper, and the null/left denotation vocabulary' },
        { title: 'Crockford — Top Down Operator Precedence (2007)', note: 'the widely read modern reintroduction' },
        { title: 'Aho, Lam, Sethi and Ullman — Compilers', note: 'operator-precedence parsing and the grammar-shaped alternative' },
        { title: 'Norvell — Parsing Expressions by Recursive Descent', note: 'precedence climbing, and its equivalence to Pratt' }
      ]
    },

    'lexing-in-context': {
      summary: 'The same nested template through two lexers, where the one without a mode stack ' +
        'finds 0 interpolations instead of 2 and reports no error at all — plus INDENT and ' +
        'DEDENT synthesised from a column stack, with the blank-line and tab rules that ' +
        'reimplementations forget.',
      intuition: 'The lexer is where a language’s genuinely context-sensitive parts get hidden, ' +
        'and the failures there are silent misparses rather than crashes.',
      formulation: {
        equations: [
          {
            label: 'The mode stack, on nested template literals',
            expr: 'source · tokens with the stack · depth · interpolations · same without the stack',
            terms: [
              { sym: 'one interpolation', meaning: '6 tokens · depth 3 · 1 interpolation | 3 · 1 · 0' },
              { sym: 'one nested template', meaning: '15 · 5 · 2 | 12 · 1 · 0' },
              { sym: 'three levels', meaning: '23 · 7 · 3 | 16 · 1 · 0' },
              { sym: 'errors reported', meaning: '0 and 0, on every input — the tokens are well formed and wrong' }
            ]
          },
          {
            label: 'The offside rule',
            expr: 'deeper column: push and emit INDENT · shallower: pop and emit DEDENT until it matches',
            terms: [
              { sym: 'an 8-line sample', meaning: '2 INDENT, 2 DEDENT, 6 LINE tokens' },
              { sym: 'the two missing lines', meaning: 'a blank and a comment-only line emit nothing, not even a NEWLINE' },
              { sym: 'tabs', meaning: 'a tab advances to the next multiple of 8, so columns read 0, 8, 8, 16' },
              { sym: 'an unmatched dedent', meaning: 'an error, not a guess — reparenting a statement silently would be worse' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A lexer that can nest is a pushdown machine, not a finite one',
          why: 'The depth is unbounded, so no fixed number of states covers it.',
          breaks: 'The three-level fixture reaches stack depth 7, and the stackless lexer reports depth 1 on everything.'
        },
        {
          name: 'Both lexers report zero errors',
          why: 'A lexer with no notion of nesting has nothing to be wrong about.',
          breaks: 'The interpolation count is the only signal, and it is 2 against 0 on the same source.'
        },
        {
          name: 'Blank and comment-only lines emit nothing at all',
          why: 'This is what lets a blank line sit inside a block, and it is the first rule forgotten.',
          breaks: '8 source lines produce 6 LINE tokens.'
        },
        {
          name: 'A dedent matching no open block is an error',
          why: 'Choosing the nearest block would silently reparent a statement.',
          breaks: 'The bad sample reports "dedent to column 4 matches no open block".'
        }
      ],
      complexity: [
        { operation: 'tokenising with a mode stack', average: 'linear in the characters', worst: 'linear, with stack depth bounded by the nesting' },
        { operation: 'maximal munch', average: 'O(rules) per position with a rule list', worst: 'linear overall with a merged DFA' },
        { operation: 'indentation tokens', average: 'one column measurement per line', worst: 'O(lines + total dedent depth)' },
        { operation: 'the column measurement', average: 'one pass over the leading whitespace', worst: 'linear in the indentation width' }
      ],
      failureModes: [
        {
          symptom: 'A syntax highlighter goes wrong from the middle of a file onwards.',
          cause: 'A nested template or interpolation flipped its notion of which mode it is in.',
          fix: 'Give the lexer a mode stack; test with a template inside an interpolation.'
        },
        {
          symptom: '`List<List<int>>` fails to parse.',
          cause: 'Maximal munch took `>>` as a shift operator.',
          fix: 'Split the token in the parser when a closing angle bracket is expected — the C++11 rule.'
        },
        {
          symptom: 'Two lines that look identically indented are at different levels.',
          cause: 'One uses a tab and the other spaces, and a tab advances to the next multiple of the tab width.',
          fix: 'Reject mixed indentation, or report the computed column in the error message.'
        },
        {
          symptom: 'Adding a keyword breaks every program that used it as a variable name.',
          cause: 'Keywords are a reserved-word table the lexer consults unconditionally.',
          fix: 'Make it a soft keyword, which needs a parser that can decide by position.'
        }
      ],
      inTheWild: [
        'JavaScript template literals, whose nesting is why every JS lexer has a mode stack.',
        'Python’s tokenizer, which emits INDENT and DEDENT and, since 3.12, recurses into f-strings.',
        'Ruby and shell heredocs, which change how the FOLLOWING lines are read.',
        'Rust lifetimes against character literals, disambiguated by lexical lookahead for the closing quote.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers', note: 'maximal munch, priority and the lexer/parser split' },
        { title: 'The ECMAScript specification, lexical grammar section', note: 'template literals, and the goal symbols that make regex-versus-division decidable' },
        { title: 'The Python Language Reference, section 2.1.8', note: 'the indentation rules, including blank lines and the tab convention' },
        { title: 'Landin — The next 700 programming languages (1966)', note: 'the offside rule, named and specified' }
      ]
    },

    'error-recovery-and-diagnostics': {
      summary: 'Three strategies on one broken file: 1 diagnostic and 1 survivor, 3 and 4, 3 and ' +
        '5 — with cascade suppression as a control you can move, and the survivors listed so the ' +
        'test is about the recovered tree rather than about not crashing.',
      intuition: 'The parsing technique changes none of these numbers; the recovery strategy ' +
        'changes all of them.',
      formulation: {
        equations: [
          {
            label: 'Three strategies on a file with three independent errors',
            expr: 'strategy · diagnostics · suppressed · declarations kept · repairs',
            terms: [
              { sym: 'stop', meaning: '1 · 0 · 1 · 0 — everything after the first error is unexamined' },
              { sym: 'panic', meaning: '3 · 0 · 4 · 0 — only the errors’ own statements are lost' },
              { sym: 'repair', meaning: '3 · 0 · 5 · 1 — the inserted `=` reconstructs `let b`' },
              { sym: 'the right answer', meaning: '3 diagnostics, not 1 and not a cascade' }
            ]
          },
          {
            label: 'A missing semicolon, and a cascade',
            expr: 'source · stop · panic · repair, as diagnostics/survivors',
            terms: [
              { sym: 'let a = 1 let b = 2 ;', meaning: '1/0 · 1/1 · 1/2 with one insertion' },
              { sym: 'let = = = ;', meaning: '1/0 · 1/0 · 1 reported and 1 SUPPRESSED as a cascade' },
              { sym: 'the cost model', meaning: 'insert costs 1, delete costs 2 — a missing token is the commoner typo' },
              { sym: 'the window', meaning: 'a second error within 2 tokens of a reported one is counted, not shown' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Three independent errors produce exactly three diagnostics',
          why: 'One means the parser gave up; eleven means it cascaded.',
          breaks: 'Both recovering strategies report 3 on the three-error fixture.'
        },
        {
          name: 'The valid declarations survive into the tree',
          why: 'That is the property completion and go-to-definition depend on.',
          breaks: 'The survivors table lists each one; stop keeps 1, panic 4 and repair 5.'
        },
        {
          name: 'An insertion is only attempted when the following token could follow it',
          why: 'Otherwise the repair papers over a structural error and the cascade starts.',
          breaks: 'Inserting `;` is plausible only before `let` or `print`; inserting `=` only before a name or a number.'
        },
        {
          name: 'Cascade suppression counts what it hides',
          why: 'A suppressed error silently dropped is indistinguishable from one that never happened.',
          breaks: 'The suppressed metric is reported beside the diagnostic count.'
        }
      ],
      complexity: [
        { operation: 'the parse itself', average: 'linear in the tokens', worst: 'linear — recursive descent with no backtracking' },
        { operation: 'panic-mode recovery', average: 'skips to the next synchronising token', worst: 'the rest of the file, once' },
        { operation: 'one repair attempt', average: 'two candidate edits, each checked locally', worst: 'O(1) per error with a single-token model' },
        { operation: 'cascade suppression', average: 'one comparison per error', worst: 'O(1)' }
      ],
      failureModes: [
        {
          symptom: 'An editor loses completion below the first error.',
          cause: 'The parser stops at the first error, so nothing after it is in the tree.',
          fix: 'Add panic-mode recovery with a synchronising set; it is a day of work.'
        },
        {
          symptom: 'One missing brace produces forty-seven diagnostics.',
          cause: 'Every following construct looks wrong and each is reported.',
          fix: 'Suppress errors within a window of a reported one, and report the count suppressed.'
        },
        {
          symptom: 'Recovery quality regresses and nothing fails.',
          cause: 'The tests assert that the parser did not crash rather than what survived.',
          fix: 'Assert diagnostic counts and the surviving declarations on a known-broken fixture.'
        },
        {
          symptom: 'A repair makes the diagnostics worse.',
          cause: 'The cost model preferred an edit that kept the parser inside broken input.',
          fix: 'Gate insertions on whether the next token could legitimately follow the inserted one.'
        }
      ],
      inTheWild: [
        'Every language server, whose usefulness is almost entirely a recovery-quality question.',
        'tree-sitter, which produces a tree with ERROR nodes rather than failing, and reparses incrementally.',
        'Clang’s diagnostics, widely regarded as the standard, which are mostly recovery and suggestion work.',
        'yacc’s `error` token, the oldest production form of error productions.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers', note: 'panic mode, phrase-level recovery and error productions' },
        { title: 'Burke and Fisher — A practical method for LR and LL syntactic error diagnosis and recovery (1987)', note: 'the insertion/deletion repair model with costs' },
        { title: 'Diekmann and Tratt — Don’t panic! Better, fewer, syntax errors for LR parsers (2020)', note: 'a modern evaluation of recovery quality, with the metrics this section uses' },
        { title: 'Brunsfeld — tree-sitter documentation on error recovery', note: 'incremental reparsing and ERROR nodes in a production tool' }
      ]
    },

    'parsing-real-languages': {
      summary: 'Eight constructs across five languages where the published grammar is not the ' +
        'language, each with a runnable failing input and the fix that shipped — including six ' +
        'automatic-semicolon-insertion cases asserted against the ECMAScript rules, all six ' +
        'matching.',
      intuition: 'Every fix feeds information backwards through the pipeline, which is exactly ' +
        'what a clean architecture forbids.',
      formulation: {
        equations: [
          {
            label: 'Automatic semicolon insertion, six asserted cases',
            expr: 'source · result · rule',
            terms: [
              { sym: 'return ⏎ 1', meaning: 'return ; 1 ; — restricted production, so the function returns undefined' },
              { sym: 'a ⏎ ++ b', meaning: 'a ; ++ b ; — restricted before a postfix ++' },
              { sym: 'a = b ⏎ ( c )', meaning: 'a = b ( c ) ; — NO insertion; read as a call' },
              { sym: 'a = b ⏎ [ c ]', meaning: 'a = b [ c ] ; — NO insertion; read as an index' },
              { sym: 'a = b + ⏎ c', meaning: 'a = b + c ; — NO insertion; the operator needs a right operand' },
              { sym: 'a = 1 ⏎ b = 2', meaning: 'a = 1 ; b = 2 ; — the case the rule exists for' }
            ]
          },
          {
            label: 'Two ambiguities, run both ways',
            expr: 'input · without the fix · with it',
            terms: [
              { sym: 'x * y ; with x a variable', meaning: 'a multiplication of x by y — and the naive reading agrees' },
              { sym: 'x * y ; with x a typedef', meaning: 'a declaration of y as a pointer to x — needs the symbol table' },
              { sym: 'vector<vector<int>>', meaning: 'tokens ... int >> — 2 brackets never close' },
              { sym: 'the same, split by the parser', meaning: 'tokens ... int > > — balanced, depth 0' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every case has a runnable failing input and a runnable fixed parse',
          why: 'A gallery of descriptions teaches nothing you could not have read elsewhere.',
          breaks: 'The fix control re-runs the same input both ways and the verdict changes.'
        },
        {
          name: 'The ASI cases are asserted against the specification',
          why: '"JavaScript inserts semicolons sometimes" is right in outline and wrong in every particular.',
          breaks: '6 of 6 match, including the three that correctly insert NOTHING.'
        },
        {
          name: 'Restricted productions insert regardless of whether the parse would fail',
          why: 'That is why `return` on its own line is silently wrong rather than a syntax error.',
          breaks: 'The rule column distinguishes "the parse would fail" from "restricted production".'
        },
        {
          name: 'Each fix is labelled with the direction of its dependency',
          why: 'The theme of the section is that they all point backwards.',
          breaks: 'The feedback metric names what the parser needs and the grammar cannot carry.'
        }
      ],
      complexity: [
        { operation: 'semicolon insertion', average: 'one pass over the tokens with newline positions', worst: 'linear' },
        { operation: 'the lexer hack', average: 'one symbol-table lookup per identifier', worst: 'linear, and it serialises the lexer behind the parser' },
        { operation: 'angle-bracket splitting', average: 'one check per `>>` token', worst: 'linear' },
        { operation: 'GLR with semantic filters', average: 'linear where the grammar is deterministic', worst: 'polynomial, plus the filter pass over the forest' }
      ],
      failureModes: [
        {
          symptom: 'A function returns undefined and the value below the `return` is unreachable.',
          cause: 'A newline after `return` is a restricted production and a semicolon was inserted.',
          fix: 'Put the value on the same line; a linter rule catches the whole class.'
        },
        {
          symptom: 'A line beginning with `(` is read as a call on the previous line.',
          cause: 'The parse continues, so no semicolon is inserted.',
          fix: 'Terminate statements explicitly, or start such lines with a semicolon.'
        },
        {
          symptom: 'A C parser cannot tell a declaration from an expression.',
          cause: 'The reading depends on whether an identifier is a typedef name.',
          fix: 'Feed the symbol table back to the lexer, or parse permissively and disambiguate later.'
        },
        {
          symptom: 'A YAML file means something different in two tools.',
          cause: 'Implicit typing differs between YAML versions and implementations.',
          fix: 'Quote strings defensively; the specification is too large to be implemented twice identically.'
        }
      ],
      inTheWild: [
        'Every C and C++ compiler, all of which implement the lexer hack.',
        'The ECMAScript specification’s ASI section, which is short and universally misremembered.',
        'CPython 3.9’s move to a PEG parser, driven partly by soft keywords.',
        'The "Norway problem", where `country: NO` became `false` in production configuration.'
      ],
      sources: [
        { title: 'The ECMAScript Language Specification, Automatic Semicolon Insertion', note: 'the three rules and the restricted productions' },
        { title: 'ISO/IEC 9899 (C) and 14882 (C++)', note: 'the typedef ambiguity, the most vexing parse, and the C++11 angle-bracket rule' },
        { title: 'Ekman and Hedin — practical approaches to context-sensitive parsing', note: 'feeding semantic information back into the parse, systematically' },
        { title: 'McPeak and Necula — Elkhound: a fast, practical GLR parser generator (2004)', note: 'GLR with semantic filters, applied to C++' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
