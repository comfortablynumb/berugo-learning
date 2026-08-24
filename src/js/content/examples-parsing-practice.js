/** Worked examples for Pratt parsing, lexing, recovery and real languages (M25.9-M25.12). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'pratt-parsing-and-precedence': [
      {
        title: 'One expression, four binding powers, one tree',
        goal: 'Trace how the limit passed down each recursion produces the parenthesisation.',
        setup: 'The C-like table — `+` at 50, `*` at 60, `^` at 80 and right-associative — on ' +
          'the input `a + b * c ^ d`.',
        steps: [
          { do: 'Parse an atom at limit 0, then test `+`.',
            why: 'The loop continues while the operator binds tighter than the limit.',
            work: '`+` has power 50, and 50 > 0, so it continues' },
          { do: 'Parse the right operand of `+` at limit 50.',
            why: 'A left-associative operator recurses with its own power.',
            work: '`*` has power 60, and 60 > 50, so it continues; a second `+` would not' },
          { do: 'Parse the right operand of `*` at limit 60.',
            why: 'Same rule, one level down.',
            work: '`^` has power 80, and 80 > 60, so it continues' },
          { do: 'Parse the right operand of `^` at limit 79.',
            why: 'A right-associative operator recurses with one LESS than its own power.',
            work: 'nothing is left after 4 tokens; the recursion unwinds' },
          { do: 'Read off the tree and its size.',
            why: 'The shape is a function of the four numbers alone.',
            work: '(a + (b * (c ^ d))) — depth 4, 4 recursive calls' }
        ],
        answer: 'Four comparisons produce a four-deep tree in four calls, with no backtracking ' +
          'and no grammar. Move `+` above `*` in the table and the same input becomes ' +
          '`((a + b) * c)`; flip `^` to left-associative and `a ^ b ^ c` becomes `((a ^ b) ^ c)`. ' +
          'Nothing but the numbers changed.'
      },
      {
        title: 'Ten parenthesisations asserted, including the ones that need a special case elsewhere',
        goal: 'Show prefix, postfix and ternary handled by the same two functions.',
        setup: 'The standard eighteen-row table, with each expression parsed and compared against ' +
          'a written expectation.',
        steps: [
          { do: 'Check the two precedence cases.',
            why: 'The baseline: the tighter operator nests.',
            work: '2 of 2 match: `a + b * c` → (a + (b * c)) · `a * b + c` → ((a * b) + c)' },
          { do: 'Check both associativities.',
            why: 'Left and right differ only in the limit passed down.',
            work: '2 of 2 match: `a + b + c` → ((a + b) + c) · `a ^ b ^ c` → (a ^ (b ^ c))' },
          { do: 'Check a prefix operator against an infix one.',
            why: 'Unary minus must not swallow the rest of the line.',
            work: '`- a + b` → ((- a) + b), depth 3, 3 calls — matches' },
          { do: 'Check a postfix operator.',
            why: 'A left denotation that consumes nothing to its right.',
            work: '`a ++ + b` → ((a ++) + b), 2 calls — matches' },
          { do: 'Check the ternary, nested.',
            why: 'A left denotation spanning two tokens, right-associative.',
            work: '`a ? b : c ? d : e` → (a ? b : (c ? d : e)), 5 calls — matches' }
        ],
        answer: 'Ten of ten expected parenthesisations match, across prefix, infix, postfix, ' +
          'ternary and grouping, from one table and two functions. Not one of them needed a case ' +
          'in the parser — the table row was the whole implementation, which is the claim of the ' +
          'technique made checkable.'
      }
    ],

    'lexing-in-context': [
      {
        title: 'The nested template that a stackless lexer gets silently wrong',
        goal: 'Measure a wrong token stream that reports no error.',
        setup: 'Three template literals of increasing nesting, each tokenised twice — once with ' +
          'a mode stack and once with a single toggling mode.',
        steps: [
          { do: 'Tokenise `` `hello ${name}` `` both ways.',
            why: 'A flat template is where the stackless lexer still works.',
            work: 'with the stack 6 tokens, depth 3, 1 interpolation. Without: 3 tokens, ' +
              'depth 1, 0 interpolations' },
          { do: 'Tokenise `` `a ${b + `c ${d} e`} f` `` both ways.',
            why: 'One nesting level is enough to break it.',
            work: 'with the stack 15 tokens, depth 5, 2 interpolations. Without: 12 tokens, ' +
              'depth 1, 0 interpolations' },
          { do: 'Tokenise the three-level version.',
            why: 'The depth is unbounded, so no fixed state count covers it.',
            work: 'with the stack 23 tokens, depth 7, 3 interpolations. Without: 16, 1, 0' },
          { do: 'Count the errors either lexer reported.',
            why: 'This is the whole point of the section.',
            work: '0 and 0, on every input' },
          { do: 'Read the stackless token stream for the nested case.',
            why: 'The tokens are well formed and describe a different program.',
            work: 'the inner opening backtick read as CLOSING the outer template, shifting ' +
              'everything after it by 1 level' }
        ],
        answer: 'The stackless lexer finds zero interpolations where there are two, and reports ' +
          'nothing wrong, because a lexer with no notion of nesting has nothing to be wrong ' +
          'about. That is the exact shape of this class of bug: not a crash, a token stream the ' +
          'parser happily accepts that means something else.'
      },
      {
        title: 'Indentation as tokens, including the rules implementations forget',
        goal: 'Show INDENT and DEDENT synthesised from a column stack, and the three edge cases.',
        setup: 'An eight-line Python-like source with a blank line, a comment-only line and two ' +
          'nesting levels, plus a tabs sample and a bad dedent.',
        steps: [
          { do: 'Lex the eight-line source.',
            why: 'Two blocks open and both close.',
            work: '2 INDENT, 2 DEDENT, 6 LINE tokens from 8 lines' },
          { do: 'Account for the two missing lines.',
            why: 'Blank and comment-only lines emit nothing at all, not even a NEWLINE.',
            work: '8 lines − 1 blank − 1 comment = 6 LINE tokens' },
          { do: 'Measure the columns in the tabs sample.',
            why: 'A tab advances to the next multiple of the tab width.',
            work: 'columns 0, 8, 8, 16 — the tab-indented line and the eight-space line agree' },
          { do: 'Lex a source that dedents to an unopened column.',
            why: 'Guessing the nearest block would silently reparent a statement.',
            work: '1 error: "dedent to column 4 matches no open block"' },
          { do: 'Note what the grammar downstream sees.',
            why: 'The whole point of synthesising tokens.',
            work: '2 INDENT and 2 DEDENT, which the grammar treats as ordinary brackets and ' +
              'never mentions whitespace' }
        ],
        answer: 'The blank-line rule is what lets you leave a gap inside a block and it is the ' +
          'first thing a reimplementation forgets; the tab rule is why two lines that look ' +
          'aligned in an editor are at different columns to the lexer. Both are in the ' +
          'specification and neither is in the grammar.'
      }
    ],

    'error-recovery-and-diagnostics': [
      {
        title: 'Three strategies on one file with three mistakes',
        goal: 'Measure recovery as diagnostics reported and declarations survived.',
        setup: 'Seven statements: `let b 2 ;` is missing its `=`, `let c = ;` is missing its ' +
          'value, `print + ;` starts an expression with an operator, and four are valid.',
        steps: [
          { do: 'Parse with the stop strategy.',
            why: 'Report the first error and give up — the textbook parser.',
            work: '1 diagnostic, 1 declaration kept (`let a`)' },
          { do: 'Parse with panic mode.',
            why: 'Skip to a synchronising token and resume.',
            work: '3 diagnostics, 4 declarations kept — the errors’ own statements are lost' },
          { do: 'Parse with repair.',
            why: 'Try one insertion or deletion, scored by cost.',
            work: '3 diagnostics, 5 declarations kept, 1 repair applied' },
          { do: 'Identify the extra survivor.',
            why: 'Inserting the missing token reconstructs the statement.',
            work: '1 extra survivor: `let b` survives under repair and not under panic mode' },
          { do: 'Read the three diagnostics.',
            why: 'Each names a token, an expectation and what was found.',
            work: 'at token 7 expected `=` found `2`; at 18 expected a name or a number found ' +
              '`;`; at 25 expected a name or a number found `+`' }
        ],
        answer: 'Three mistakes produce exactly three diagnostics under both recovering ' +
          'strategies — not one and not a cascade — and the survivor count goes 1, 4, 5. That ' +
          'last declaration is the difference between "there is an error here" and "there is an ' +
          'error here, and `b` is still a variable you can rename".'
      },
      {
        title: 'A missing semicolon, and a run of nonsense that would cascade',
        goal: 'Show repair recovering a whole statement, and suppression stopping an echo.',
        setup: '`let a = 1 let b = 2 ;` — one missing semicolon — and `let = = = ;`, which ' +
          'invites a cascade.',
        steps: [
          { do: 'Parse the missing-semicolon source with stop.',
            why: 'The error is between two perfectly good statements.',
            work: '1 diagnostic, 0 declarations survive' },
          { do: 'Parse it with panic mode.',
            why: 'Skipping to `let` resumes correctly and loses the first statement.',
            work: '1 diagnostic, 1 declaration survives' },
          { do: 'Parse it with repair.',
            why: 'Inserting `;` before `let` is plausible and cheap.',
            work: '1 diagnostic, 2 declarations survive, 1 repair' },
          { do: 'Parse `let = = = ;` with panic mode.',
            why: 'Skipping to the semicolon discards the whole mess in one go.',
            work: '1 diagnostic, 0 suppressed' },
          { do: 'Parse it with repair.',
            why: 'A repair keeps the parser inside the broken statement, where it can fail again.',
            work: '1 diagnostic reported, 1 suppressed as a cascade, 1 repair applied' }
        ],
        answer: 'Repair recovers both declarations from a single missing semicolon, which is the ' +
          'commonest real mistake there is. It also stays inside broken input longer than panic ' +
          'mode does, which is exactly when cascade suppression earns its place — the second ' +
          'failure two tokens later is the first one echoing, and it is counted rather than ' +
          'shown.'
      }
    ],

    'parsing-real-languages': [
      {
        title: 'Six automatic-semicolon-insertion cases against the specification',
        goal: 'Assert the rules rather than describing them, including the three that insert nothing.',
        setup: 'A tokeniser that records newline positions, and the ECMAScript rules: insert ' +
          'where the parse would fail at a newline, plus restricted productions.',
        steps: [
          { do: 'Check `return` followed by a newline and `1`.',
            why: 'A restricted production: no newline is allowed after `return`.',
            work: '`return ; 1 ;` — the value is unreachable and the function returns undefined' },
          { do: 'Check `a` then a newline then `++ b`.',
            why: 'A restricted production in the other direction: no newline before a postfix `++`.',
            work: '`a ; ++ b ;` — 1 insertion, and the `++` binds to `b` as a prefix' },
          { do: 'Check `a = b` then a newline then `( c )`.',
            why: 'The parse continues perfectly well, so nothing is inserted.',
            work: '`a = b ( c ) ;` — 0 insertions at the newline; read as a call' },
          { do: 'Check the same with `[ c ]`, and with a trailing `+`.',
            why: 'The other two continuation cases.',
            work: '0 insertions in both: `a = b [ c ] ;` read as an index, and `a = b + c ;` ' +
              'because `+` needs a right operand' },
          { do: 'Check the ordinary case, and count the matches.',
            why: 'The rule exists for this, and the assertions run in the test suite.',
            work: '`a = 1 ; b = 2 ;` — 6 of 6 cases match the specification' }
        ],
        answer: 'Two of the six insert because the specification says so regardless of the parse, ' +
          'three do not insert because the line genuinely continues, and one is the everyday ' +
          'case. Cases three and four are the reason for the defensive leading semicolon in some ' +
          'style guides, and case five is the reassurance that wrapping a long expression is ' +
          'safe.'
      },
      {
        title: 'Two ambiguities, two fixes, both feeding information backwards',
        goal: 'Run the C typedef case and the C++ angle-bracket case with the fix on and off.',
        setup: 'The input `x * y ;` with and without `x` in the typedef set, and ' +
          '`vector<vector<int>>` with and without the parser-side token split.',
        steps: [
          { do: 'Parse `x * y ;` with `x` a variable.',
            why: 'Nothing in the tokens distinguishes the two readings.',
            work: '0 typedef names in scope: a multiplication of x by y' },
          { do: 'Parse the same input with `x` a typedef name.',
            why: 'The symbol table is the only thing that changed.',
            work: '1 typedef name in scope: a declaration of y as a pointer to x' },
          { do: 'Lex `vector<vector<int>>` with `>>` in the operator set.',
            why: 'Maximal munch takes the longest match.',
            work: 'tokens vector < vector < int >> — 2 angle brackets never close' },
          { do: 'Lex it again with the parser splitting `>>`.',
            why: 'The C++11 fix, applied when the parser wants a closing bracket.',
            work: 'tokens vector < vector < int > > — balanced, depth 0' },
          { do: 'Name the direction of each dependency.',
            why: 'This is the theme of the whole section.',
            work: '2 backwards dependencies: the symbol table feeds the lexer, and the parser ' +
              'splits a token the lexer already emitted' }
        ],
        answer: 'Both fixes send information backwards through the pipeline — from the symbol ' +
          'table to the lexer, and from the parser into a token already produced. That is what a ' +
          'layered architecture forbids, and both languages do it because the alternative is ' +
          'being wrong. The gallery lists 8 such constructs across 5 languages.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
