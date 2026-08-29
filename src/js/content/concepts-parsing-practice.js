/** Concepts for Pratt parsing, lexing, recovery and real languages (M25.9-M25.12). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'pratt-parsing-and-precedence': [
      {
        term: 'Precedence as data rather than as grammar shape',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["grammar-shaped precedence"] --> B["one nonterminal per level:<br/>expr, term, factor, unary…"]',
            '    B --> C["a new operator means<br/>a new layer everywhere"]',
            '    D["Pratt: a binding power per token"] --> E["a new operator is one table row"]',
            '    E --> F["and the parser code<br/>does not change"]'
          ].join('\n'),
          caption: 'The precedence tower is the part of a hand-written parser that is tedious to extend. Turning it into a lookup makes adding an operator a data change.'
        },
        plain: 'Each token gets a binding power; adding an operator is one table row.',
        formal: 'table[token] = { power, right } for infix; { power } for prefix and postfix',
        detail: 'A classical expression grammar encodes each precedence level as a nonterminal, ' +
          'so adding an operator means adding a level and rewriting the rules around it — and a ' +
          'parse of a bare variable walks through every level to reach the literal, paying one ' +
          'call per level. A Pratt parser reads the ordering out of a table, so the six-level ' +
          'grammar becomes six rows.',
        example: 'The demo\'s table has eighteen rows covering prefix, infix, postfix and the ' +
          'ternary, and moving one number restructures the tree.'
      },
      {
        term: 'A token has up to two meanings, chosen by position',
        plain: 'What it means with nothing to its left, and what it means with an expression there.',
        formal: 'null denotation (nud) and left denotation (led)',
        detail: 'That split is why unary and binary minus need no special case: `-` simply has ' +
          'both entries. It is also why a function call is not a special form — `(` in the ' +
          'left-denotation position with a very high binding power is a call, and the same token ' +
          'in the null-denotation position is a grouping parenthesis, so `f(x) + 1` and ' +
          '`(x) + 1` both parse with no lookahead and no ambiguity.',
        example: 'The denotations table lists six positions and which of the two functions ' +
          'handles each.'
      },
      {
        term: 'The whole algorithm is one loop with one comparison',
        plain: 'Parse a prefix, then absorb operators while they bind tighter than your limit.',
        formal: 'while power(next) > limit: consume it and let it take what is on the left',
        detail: 'Recursion happens when an infix operator parses its right operand, and the ' +
          'limit it passes down is what encodes precedence. There is no backtracking anywhere, ' +
          'which is why the call count in the demo equals the number of sub-expressions rather ' +
          'than anything larger, and why the technique is fast enough that no production ' +
          'compiler has needed to replace it.',
        example: 'Recursive calls = 4 on `a + b * c ^ d`, one per sub-expression.'
      },
      {
        term: 'Associativity is the minus one, and nothing else',
        plain: 'Left-associative recurses with its own power; right-associative with one less.',
        formal: 'right operand = expression(power - 1) for right-associative, expression(power) for left',
        detail: 'With the limit equal to its own power, an equal operator to the right fails the ' +
          'strictly-greater test and the loop closes the node, giving `(a + b) + c`. With the ' +
          'limit one lower, the equal operator continues and nests, giving `a ^ (b ^ c)`. In a ' +
          'grammar the same distinction requires rewriting the rule so the recursion moves to ' +
          'the other side; here it is a boolean.',
        example: 'The associativity control on `^` flips `a ^ b ^ c` between the two ' +
          'parenthesisations and changes nothing else.'
      },
      {
        term: 'Prefix operators get a power too, and it has to be high',
        plain: '- a + b must be (- a) + b, not - (a + b).',
        formal: 'the prefix operator recurses with a limit high enough that + stops immediately',
        detail: 'This is the case that catches people writing a Pratt parser for the first time: ' +
          'the prefix handler looks like it should just parse an expression, and parsing an ' +
          'unrestricted expression makes unary minus swallow the entire rest of the line. The ' +
          'limit it passes down is the operator\'s own binding power, which is why prefix ' +
          'operators appear in the table at all.',
        example: '`- a + b` is one of the ten asserted cases, expected as `((- a) + b)`.'
      },
      {
        term: 'Postfix, ternary and mixfix fall out of the same machinery',
        plain: 'A postfix operator is a left denotation that consumes nothing to its right.',
        formal: 'ternary: a left denotation that parses an expression, expects a token, and parses another',
        detail: 'Nothing new is added to the loop for any of them. That generality is what makes ' +
          'the technique worth learning rather than copying: once the two denotations are in ' +
          'place, array indexing, calls, slices, casts and conditional expressions are all table ' +
          'rows, and each behaves correctly with respect to every other operator without ' +
          'anybody reasoning about the interaction.',
        example: '`a ++ + b` and `a ? b : c ? d : e` are both asserted cases, handled by the same ' +
          'two functions.'
      },
      {
        term: 'The table is a value, so the rest of the toolchain can read it',
        plain: 'A formatter, a linter and a macro system all need the same precedence facts.',
        formal: 'user-defined fixity declarations insert rows at parse time',
        detail: 'Languages with user-defined operators — Haskell, Swift, Scala — need exactly ' +
          'this, because a grammar-shaped encoding cannot change without regenerating the ' +
          'parser. Beyond that, a formatter deciding which parentheses are redundant and a ' +
          'linter warning about operators people confuse both need the ordering, and each one ' +
          'is a separate drift-prone copy when precedence lives in the grammar\'s shape.',
        example: 'The demo rebuilds the table from the controls on every change, because the ' +
          'table is data rather than generated code.'
      },
      {
        term: 'Assert the parenthesisation, do not eyeball it',
        plain: 'Precedence is exactly the kind of thing that is obvious until it is wrong.',
        formal: 'compare the fully parenthesised tree text against a written expectation',
        detail: 'The demo ships ten expressions with their expected parenthesisations and a ' +
          'match column, and the same comparison runs in the test suite. Moving a binding power ' +
          'breaks exactly the cases that depend on the ordering you changed, which is both the ' +
          'intended experiment and a demonstration of why the assertions belong in CI rather ' +
          'than in a reviewer\'s head.',
        example: '10 of 10 cases match on the default table, and the count drops when a power ' +
          'is moved.'
      }
    ],

    'lexing-in-context': [
      {
        term: 'The lexer/parser split is a convention, not a law',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the clean split: lexer makes tokens,<br/>parser makes trees"] --> B["works for most languages"]',
            '    B --> C["then: is / a divide<br/>or the start of a regex?"]',
            '    C --> D["only the parser knows"]',
            '    D --> E["so real lexers take feedback,<br/>or carry modes"]'
          ].join('\n'),
          caption: 'Every mature language has at least one of these. The split is a very good default and treating it as inviolable is what makes the workaround ugly.'
        },
        plain: 'It holds until the lexer needs information only the parser has.',
        formal: 'tokenise with a finite automaton, then parse tokens rather than characters',
        detail: 'The split is worth keeping: tokenising with a finite automaton is linear and ' +
          'simple, and it lets the grammar talk about IDENT rather than about letters. But in ' +
          'every widely used language there is somewhere the lexer cannot decide on its own, and ' +
          'the interesting engineering is in what each language did about it rather than in the ' +
          'split itself.',
        example: 'The case table lists seven constructs across five languages, and the third ' +
          'column is always information the lexer cannot compute.'
      },
      {
        term: 'Maximal munch is the tie-breaker and it is occasionally wrong',
        plain: 'The longest match wins, which is what makes >= one token.',
        formal: 'at each position choose the longest accepting prefix across all rules',
        detail: 'It is also what made `List<List<int>>` a syntax error in C++ for two decades: ' +
          '`>>` is longer than `>`, so it wins, and whether that is right depends on being ' +
          'inside a template argument list — a parser fact. The two rows in the demo show the ' +
          'same input under two operator sets, which makes the point that the rule is not the ' +
          'problem; the operator set is.',
        example: 'With `>>` in the set the brackets never close; without it they do, and shifts ' +
          'break instead.'
      },
      {
        term: 'Keywords are a table lookup, which is why adding one is breaking',
        plain: 'The lexer matches an identifier and then checks a reserved-word set.',
        formal: 'classify(word) = keyword if word in reserved, else identifier',
        detail: 'Every variable named after the new keyword stops compiling, which is why ' +
          'languages reach for SOFT keywords instead: words that are keywords only where the ' +
          'grammar expects one. The lexer cannot make that call, so the parser must, and Python ' +
          'replaced its LL(1) parser with a PEG one partly to get `match` without breaking every ' +
          'program that used it as a name.',
        example: 'The demo classifies `match` as a keyword in statement-start position and as an ' +
          'identifier elsewhere.'
      },
      {
        term: 'A mode stack makes the lexer a pushdown machine',
        plain: 'Each nesting construct pushes a mode and pops it on the way out.',
        formal: 'code -> template -> interpolation -> template, with unbounded depth',
        detail: 'A template literal containing an interpolation containing another template needs ' +
          'three levels, and the depth is unbounded, so no fixed number of lexer states covers ' +
          'it. That is the moment the tokeniser stops being a finite automaton, and it is the ' +
          'concrete reason the previous milestone\'s machinery is not enough for a real ' +
          'language\'s lexer.',
        example: 'Deepest mode stack = 5 on the nested fixture with the stack, and 1 without it.'
      },
      {
        term: 'Removing the stack produces a wrong token stream and no error',
        plain: 'A backtick that should open reads as closing, and everything shifts by one level.',
        formal: 'a single toggling mode is correct on a flat template and wrong on a nested one',
        detail: 'Nothing about the flat lexer\'s output is malformed — every token is well ' +
          'formed and the parser accepts them happily. Real code is lexed as template text and ' +
          'template text as code, and the interpolation markers inside the inner template are ' +
          'never recognised at all. This is why lexer bugs are found by users: the test corpus ' +
          'never contained a template inside an interpolation.',
        example: 'Interpolations found = 2 with the stack and 0 without, on the same source, with ' +
          'zero errors reported either way.'
      },
      {
        term: 'The offside rule turns columns into tokens',
        plain: 'INDENT and DEDENT are synthesised by the lexer from a stack of columns.',
        formal: 'deeper column: push and emit INDENT · shallower: pop and emit DEDENT until it matches',
        detail: 'Downstream, the grammar sees ordinary bracket-like tokens and never mentions ' +
          'whitespace, which is what makes an indentation-sensitive language parseable by ' +
          'entirely ordinary means. A dedent to a column that is on no open block is an error ' +
          'rather than a guess, because picking the nearest block would silently reparent a ' +
          'statement.',
        example: 'The blanks sample emits INDENT, DEDENT and DEDENT at the right lines, and the ' +
          'bad sample reports a dedent matching no open block.'
      },
      {
        term: 'The forgotten offside rules are the ones about blank lines and tabs',
        plain: 'Blank and comment-only lines emit nothing at all, not even a NEWLINE.',
        formal: 'a tab advances to the next multiple of the tab width, so tab ≠ four spaces',
        detail: 'The blank-line rule is what lets you leave a gap inside a block, and it is the ' +
          'first thing a reimplementation forgets. The tab rule is why two lines that look ' +
          'identically indented in an editor set to four-space tabs are at different columns to ' +
          'the lexer — a tab and eight spaces are the same column, a tab and four spaces are ' +
          'not, and the resulting error points at the wrong line.',
        example: 'The tabs sample puts a tab-indented line and an eight-space line at the same ' +
          'column and a double-tab line at 16.'
      },
      {
        term: 'Every failure here is silent misparsing, not a crash',
        plain: 'The parser accepts the tokens and they mean something else.',
        formal: 'a well-formed token stream describing a different program',
        detail: 'That is what makes this section\'s bugs expensive: there is no exception, no ' +
          'error message and no failing test, because the tests were written from the same ' +
          'mental model as the lexer. The practical defence is to test the lexer against the ' +
          'constructs in the language\'s lexical specification specifically, since those ' +
          'paragraphs are exactly the places the naive model breaks.',
        example: 'Both lexers report zero errors on the nested template, and only one of them ' +
          'produced the right tokens.'
      }
    ],

    'error-recovery-and-diagnostics': [
      {
        term: 'Detecting and recovering are different problems',
        plain: 'Detection falls out of the table; recovery is engineering.',
        formal: 'no table entry means the input is not in the language — and says nothing about what to do next',
        detail: 'Only the first is in the parsing literature, which is why a course can cover ' +
          'four parsing techniques and leave you unable to write a usable compiler. The parsing ' +
          'technique changes none of the numbers this section measures; the recovery strategy ' +
          'changes all of them, which is a fair summary of where the effort in a modern front ' +
          'end actually goes.',
        example: 'The comparison table varies only the strategy and the diagnostic and survivor ' +
          'counts change from 1/1 to 3/5.'
      },
      {
        term: 'A parser that stops at the first error is unusable in an editor',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["in a build: the file is finished"] --> B["one error, one message,<br/>fix it and rerun"]',
            '    C["in an editor: the file is mid-edit"] --> D["it is broken on almost<br/>every keystroke"]',
            '    D --> E["stopping at the first error means<br/>no highlighting, no completion,<br/>no types, below that point"]',
            '    E --> F["so recovery is not a nicety —<br/>it is the normal case"]'
          ].join('\n'),
          caption: 'An editor spends most of its life parsing invalid code. What a batch compiler treats as the exceptional path is the only path a language server ever sees.'
        },
        plain: 'Most parses in an editor are of a file that is mid-edit and therefore broken.',
        formal: 'stopping loses every declaration after the first error',
        detail: 'Completion, go-to-definition and type information all vanish for the rest of ' +
          'the file, which is exactly when you need them. The demo makes that concrete: on a ' +
          'file with three mistakes and four good statements, stopping reports one diagnostic ' +
          'and keeps one declaration, so everything below the cursor goes dark.',
        example: 'stop: 1 diagnostic, 1 declaration kept. panic: 3 and 4. repair: 3 and 5.'
      },
      {
        term: 'Panic mode discards tokens until a synchronising one',
        plain: 'Cheap, robust, and it loses whatever was between.',
        formal: 'skip to a token in SYNC = { ; , let , print , ... } and resume there',
        detail: 'The synchronising set is what makes it work: those are tokens where the parser ' +
          'knows where it is regardless of what came before, so resuming there cannot produce a ' +
          'second bogus error. Choosing the set is the whole design decision, and statement ' +
          'terminators plus statement-introducing keywords is the answer for almost every ' +
          'language.',
        example: 'Panic mode reports all three errors and keeps four declarations, losing only ' +
          'the statements the errors were in.'
      },
      {
        term: 'Repair tries single-token edits scored by a cost model',
        plain: 'Insertion is cheaper than deletion, because a missing token is the commoner typo.',
        formal: 'cost(insert) = 1, cost(delete) = 2; take the cheapest repair that lets the parser continue',
        detail: 'That ordering IS the cost model, which is the honest size of most real ones. ' +
          'The gain is concrete: inserting the missing `=` reconstructs the statement rather ' +
          'than discarding it, so the declaration survives into the tree and the editor can ' +
          'still rename that variable. An insertion is only attempted when the following token ' +
          'could legitimately follow it, or the repair papers over a structural error.',
        example: 'Repair applies 1 insertion, reports the same 3 diagnostics as panic mode, and ' +
          'keeps 5 declarations instead of 4.'
      },
      {
        term: 'Cascade suppression is half the perceived quality',
        plain: 'One missing brace makes every following construct look wrong.',
        formal: 'a second error within w tokens of a reported one is counted and not shown',
        detail: 'A parser that reports each consequence produces a wall of noise where only the ' +
          'first line is useful, which is the classic bad-compiler experience. The window rule ' +
          'is crude and works, because a second failure a couple of tokens after the first is ' +
          'almost always the first one echoing rather than an independent mistake — and the demo ' +
          'makes the window a control so its effect is visible.',
        example: 'On a run of nonsense, repair reports 1 diagnostic and suppresses 1 as a ' +
          'cascade.'
      },
      {
        term: 'Error productions put the recovery in the grammar',
        plain: 'statement -> error ";" tells the generator to resynchronise at the semicolon.',
        formal: 'a distinguished `error` token that matches any skipped input',
        detail: 'It is precise and it is maintained alongside the grammar, which is a real ' +
          'advantage over a recovery routine that drifts. The limitation is equally real: it ' +
          'covers exactly the mistakes you thought of, so a language with error productions ' +
          'still needs a general fallback for everything else. Most yacc grammars have between ' +
          'zero and three of them.',
        example: 'The synchronising set in the demo plays the same role without needing grammar ' +
          'changes.'
      },
      {
        term: 'Three of the six parts of a good diagnostic cost nothing',
        plain: 'Location, expectation and what was found are already in hand.',
        formal: 'position from the token, expectation from the table row or the call site, found from the lookahead',
        detail: 'Throwing them away takes active effort, and a surprising number of tools report ' +
          '"syntax error" while holding the exact list of tokens that would have worked. The ' +
          'other three are the work: a suggestion means reporting the repair you applied rather ' +
          'than silently applying it, suppression means tracking the last error position, and ' +
          'ordering means trusting the first diagnostic.',
        example: 'Every diagnostic in the demo carries the token, the expected set and the token ' +
          'found.'
      },
      {
        term: 'Test the surviving tree, not that the parser did not crash',
        plain: 'The property the editor depends on is which declarations remain.',
        formal: 'assert diagnostics == 3 and declarations == 4 on a file with three errors',
        detail: 'That assertion is the one usually missing, and its absence is why recovery ' +
          'quality regresses silently: someone changes a synchronising token, the parser still ' +
          'does not crash, and completion becomes flaky in a way nobody can reproduce. Writing ' +
          'it as an assertion on the tree turns the regression into a failing test rather than a ' +
          'bug report.',
        example: 'The survivors table lists each recovered declaration and what a language server ' +
          'could still do with it.'
      }
    ],

    'parsing-real-languages': [
      {
        term: 'No widely used language is context-free',
        plain: 'The grammar in the specification is not the whole story.',
        formal: 'each language has constructs whose parse depends on information the grammar cannot express',
        detail: 'Read a specification and the grammar looks clean, and then the lexical section ' +
          'has a paragraph about regex-versus-division, or a note that a tab counts as eight ' +
          'columns, or a state machine for template literals. Those paragraphs are where the ' +
          'context sensitivity went, and a tool built from the grammar alone will be correct on ' +
          'most files and subtly wrong on exactly those constructs.',
        example: 'The gallery lists eight constructs across five languages, each with a runnable ' +
          'input that breaks a naive parser.'
      },
      {
        term: 'The lexer hack feeds the symbol table backwards',
        plain: 'x * y; is a declaration if x is a typedef name and a multiplication otherwise.',
        formal: 'the parser marks typedef names and the lexer then emits TYPE_NAME rather than IDENTIFIER',
        detail: 'Nothing in the token stream distinguishes the two readings, and no context-free ' +
          'grammar can, because the answer depends on a declaration that may be in another file. ' +
          'Every C compiler solves it the same way, and the dependency points backwards through ' +
          'the pipeline — which also means the lexer cannot run ahead of the parser and that ' +
          'parsing C is order-dependent in a way that complicates every incremental tool.',
        example: 'The typedef control flips the same input between "a declaration of y as a ' +
          'pointer to x" and "a multiplication of x by y".'
      },
      {
        term: 'C++ angle brackets are fixed in the parser, not the lexer',
        plain: 'vector<vector<int>> lexes its closing brackets as a shift under maximal munch.',
        formal: 'when the parser wants a closing angle bracket, a >> token is split into two',
        detail: 'This is the lexer/parser split being broken deliberately and documented as ' +
          'such, and it is the right call — no purely lexical rule can tell a shift from two ' +
          'closing brackets, because whether you are inside a template argument list is a parser ' +
          'fact. The cost is that a token can be split after lexing, so anything tracking token ' +
          'positions has to cope with it.',
        example: 'With the fix off the brackets never close (depth 2); with it on the token ' +
          'stream is balanced.'
      },
      {
        term: 'Automatic semicolon insertion is a recovery rule promoted to a feature',
        plain: 'If the parse fails at a newline, insert a semicolon.',
        formal: 'plus RESTRICTED productions where a newline inserts whether or not the parse would fail',
        detail: 'The restricted set is `return`, `throw`, `break`, `continue`, and before a ' +
          'postfix `++` or `--`. That distinction is what makes `return` on its own line ' +
          'silently return undefined rather than being a syntax error: the parse would have ' +
          'succeeded and the specification overrode it. The general rule is benign; the ' +
          'restricted productions are the ones that surprise people.',
        example: 'All 6 asserted cases match the specification, including the restricted ' +
          'productions and the three that do NOT insert.'
      },
      {
        term: 'The famous ASI hazards are all "the line continued"',
        plain: 'A line starting with ( is a call; one starting with [ is an index.',
        formal: 'no semicolon is inserted before ( , [ , . , or a binary operator',
        detail: 'That is the entire reason for the defensive leading semicolon you see at the ' +
          'start of some files and in some style guides. The reassuring counterpart is that an ' +
          'operator at the END of a line means the expression continues, so wrapping a long ' +
          'expression is safe — the risk is one-sided and it is worth knowing which side.',
        example: 'Cases three and four in the demo are exactly these, and both correctly insert ' +
          'nothing.'
      },
      {
        term: 'Python moved its context sensitivity into the lexer and still needed a better parser',
        plain: 'INDENT and DEDENT handle the offside rule; soft keywords do not.',
        formal: 'a word that is a keyword only in one position cannot be classified lexically',
        detail: 'The indentation answer is clean and self-contained. `match` is not: it must be ' +
          'a keyword at the start of a statement and an ordinary name everywhere else, which the ' +
          'lexer cannot decide, and CPython replaced its LL(1) parser with a PEG one in 3.9 ' +
          'partly for this. Adding a keyword without breaking every program that used it as a ' +
          'name costs a parser rewrite.',
        example: 'The gallery names the input `match = 1`, which a naive parser rejects as a ' +
          'syntax error.'
      },
      {
        term: 'YAML is a lesson about specification complexity, not about parsing',
        plain: 'country: NO parses as the boolean false under YAML 1.1.',
        formal: 'implementations differ on real documents, and the cost falls on users',
        detail: 'The specification is long enough that two conforming implementations disagree ' +
          'on ordinary files, and the Norway problem is the famous instance rather than the only ' +
          'one. The generalisable point is that a format needing a hundred pages will be ' +
          'implemented inconsistently, and defensive quoting is the only reliable user-side ' +
          'answer.',
        example: 'The gallery row names the input and the version-dependent reading.'
      },
      {
        term: 'Changing the language is the only fix that removes the problem',
        plain: 'And it is available exactly once, while the language is young.',
        formal: 'Rust’s turbofish exists because a < b > (c) is ambiguous between comparison and a generic call',
        detail: 'Every other answer on the list — the lexer hack, scannerless parsing, GLR with ' +
          'semantic filters, parse-then-disambiguate, mode stacks — pays for the ambiguity ' +
          'forever, in every tool anyone will ever write for the language, including the ones ' +
          'that do not exist yet. Rust spent four characters of syntax and the ambiguity does ' +
          'not exist. People complain about how it looks; it is the cheapest fix on the table.',
        example: 'The answers table puts it last with its cost — a breaking change, or a second ' +
          'way to write the same thing.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
