# M25 — Context-free languages and parsing

> **Track** Automata, languages and compilers · **Depends on** M24 · **Sections** 12 · **Effort** XL

**Outcome.** Parsing, properly: not "use a parser generator" but knowing what each algorithm can
and cannot do, why a grammar conflicts, how to fix it, and how real languages get parsed despite
not being context-free. Ends with the error recovery and diagnostics work that separates a toy
parser from a usable one.

**Shared machinery introduced.** `machines/grammar.js` — grammar representation with FIRST/FOLLOW
computation, transformations, ambiguity probing and a common parse-tree format; `machines/parse-lab.js`
— runs any parser over any grammar with step traces, conflict reports and parse-tree/forest output;
`viz/parse-tree-view.js` and `viz/parse-table-view.js`.

---

## Sections

### 25.1 Grammars, derivations and ambiguity
- **Covers** — context-free grammars, derivations and parse trees, leftmost and rightmost
  derivations, ambiguity and its consequences, inherent ambiguity, the dangling-else problem,
  expression grammars with precedence and associativity, and the difference between a grammar and
  the language it defines.
- **Demo** — grammar workbench: enter a grammar and a string, see every distinct parse tree
  enumerated (ambiguity made visible), with the derivation sequence replayable step by step.
- **Diagram** — mermaid diagram of two parse trees for one ambiguous input.
- **Lab** — rewrite an ambiguous expression grammar into an unambiguous one encoding precedence and
  associativity; tests assert exactly one parse tree per input over a generated string set and that
  the tree shape matches the intended precedence.
- **Senior insight** — ambiguity is a property of the grammar, not the language; the fix is usually
  a rewrite, and "the parser generator picked one" is how precedence bugs ship.

### 25.2 Grammar transformations
- **Covers** — removing useless and unreachable symbols, ε-productions and unit productions,
  eliminating left recursion (direct and indirect), left factoring, Chomsky and Greibach normal
  forms, and the effect each transformation has on the shape of the resulting parse tree.
- **Demo** — transformation pipeline: apply each step to a grammar and see the productions change,
  with a checker confirming the language is preserved by differential testing against a general
  parser.
- **Diagram** — mermaid diagram of direct left-recursion elimination introducing a tail
  nonterminal.
- **Lab** — implement left-recursion elimination including the indirect case; tests assert language
  equivalence with the original grammar on generated strings and termination of a recursive-descent
  parser on the result.
- **Senior insight** — every transformation changes the parse tree, so anything that consumed the
  old shape (an AST builder, a pretty printer) breaks silently. Transform, then re-derive the AST
  mapping deliberately.

### 25.3 Pushdown automata
- **Covers** — the PDA model and the stack as unbounded memory, acceptance by final state versus
  empty stack, the equivalence of PDAs and CFGs in both directions, deterministic PDAs and the
  strictly smaller class of DCFLs, and closure properties (and non-closure under intersection and
  complement).
- **Demo** — PDA execution with the stack drawn beside the input tape, nondeterministic branches
  shown as parallel configurations; the CFG → PDA conversion is available for any grammar entered
  in 25.1.
- **Diagram** — mermaid diagram of a PDA transition with its stack push/pop effect.
- **Lab** — implement the CFG → PDA construction and run it; tests assert the PDA accepts exactly
  the strings the grammar derives, over exhaustive short strings.
- **Senior insight** — the stack is what a regular language lacks, and it is exactly one unbounded
  resource. Every "regex cannot match nested brackets" argument bottoms out here.

### 25.4 Top-down parsing and LL(1)
- **Covers** — recursive descent as hand-written top-down parsing, predictive parsing with one token
  of lookahead, FIRST and FOLLOW computation, LL(1) table construction and conflict interpretation,
  the left-recursion restriction, LL(k) and LL(*), and error detection points.
- **Demo** — LL(1) table builder with each cell traceable to the FIRST/FOLLOW computation that
  produced it; conflicts are highlighted with the two competing productions and a minimal
  conflicting input.
- **Diagram** — mermaid diagram of the predictive-parse loop consuming input against the stack.
- **Lab** — implement FIRST and FOLLOW and build the LL(1) table; tests assert table agreement with
  a reference for a set of grammars and correct conflict reporting for the ambiguous ones.
- **Senior insight** — hand-written recursive descent is what most production compilers use (Clang,
  Roslyn, Go, V8), because error messages and context-sensitive hacks matter more than grammar
  purity.

### 25.5 Bottom-up parsing: shift-reduce and LR(0)/SLR
- **Covers** — the shift-reduce model, handles and viable prefixes, LR(0) items and the canonical
  collection, the automaton of item sets, the ACTION and GOTO tables, SLR's use of FOLLOW, and
  reading a shift/reduce conflict correctly.
- **Demo** — the LR automaton drawn as a state graph over item sets, with the parse stack and input
  animated during a parse; each conflict is clickable and shows the item set responsible.
- **Diagram** — mermaid state diagram of an item-set automaton with a closure step highlighted.
- **Lab** — implement LR(0) item-set construction with closure and goto; tests assert the item-set
  collection matches a reference for fixture grammars.
- **Senior insight** — a shift/reduce conflict is a real ambiguity in the grammar at that state, and
  the generator's default (shift) is what makes dangling-else work by accident. Silencing conflicts
  by default is how grammars rot.

### 25.6 LALR and canonical LR(1)
- **Covers** — LR(1) items with lookahead, the state explosion, LALR(1) by merging states with the
  same core, the mysterious reduce/reduce conflicts LALR introduces, yacc/bison behaviour and
  precedence declarations, and choosing between LALR, canonical LR and GLR.
- **Demo** — the same grammar built as LR(1) and LALR(1) with state counts compared and merged
  states highlighted; a grammar that is LR(1) but not LALR(1) is included so the induced conflict is
  visible.
- **Diagram** — mermaid diagram of two LR(1) states with identical cores merging.
- **Lab** — implement LALR(1) table construction by core merging; tests assert the table parses the
  same language as the canonical LR(1) table on fixtures, and that the known non-LALR grammar
  produces the expected conflict.
- **Senior insight** — precedence declarations are a way of resolving conflicts without fixing the
  grammar; they work, and they also make the grammar no longer a specification of the language.

### 25.7 General parsing: Earley, CYK and GLR
- **Covers** — parsing any CFG, CYK's O(n³) with CNF, Earley's chart with predict/scan/complete and
  its linear behaviour on unambiguous grammars, GLR's graph-structured stack, shared packed parse
  forests for ambiguous results, and the practical cost of generality.
- **Demo** — Earley chart filled cell by cell with the three operation types colour-coded; an
  ambiguous grammar produces an SPPF that can be unfolded into individual trees on demand.
- **Diagram** — mermaid diagram of an Earley chart column with items and their origins.
- **Lab** — implement Earley recognition with the completed-item bookkeeping needed for parse-tree
  reconstruction; tests assert acceptance agreement with CYK on fixture grammars including ε-rules
  (the case that breaks naive Earley implementations).
- **Senior insight** — Earley handles left recursion, ambiguity and ε-rules with no grammar
  massaging, which is why it keeps reappearing in tools that must accept a grammar as data rather
  than as a build step.

### 25.8 PEGs and packrat parsing
- **Covers** — parsing expression grammars, ordered choice replacing ambiguity, syntactic predicates
  (and/not), packrat memoisation for linear time, the memory cost, left recursion in PEGs and the
  known workarounds, and the ways PEG semantics differ from CFG semantics for the same-looking
  rules.
- **Demo** — the same rule set interpreted as a CFG and as a PEG, with an input where ordered choice
  changes the result; a packrat memo-table view shows hits and misses and the memory used.
- **Diagram** — mermaid flowchart of ordered choice's first-match-wins evaluation.
- **Lab** — implement a packrat parser with memoisation; tests assert linear time (measured step
  counts) on the fixture that is exponential without memoisation, and identical results with and
  without the cache.
- **Senior insight** — PEGs cannot be ambiguous, which sounds like a feature until the ordered
  choice hides a rule that can never match. There is a static check for that, and most PEG tools do
  not run it.

### 25.9 Pratt parsing and expression precedence
- **Covers** — precedence climbing and Pratt's top-down operator precedence, null and left
  denotations, binding powers, right associativity and prefix/postfix/mixfix operators, extending an
  expression parser at runtime, and why this technique dominates real hand-written parsers.
- **Demo** — expression parser with an editable operator table: change a binding power or
  associativity and the parse tree for the same input changes live.
- **Diagram** — mermaid diagram of binding powers driving the parse of `a + b * c ^ d`.
- **Lab** — implement Pratt parsing with prefix, infix and postfix operators including right-
  associative exponentiation and a ternary conditional; tests assert tree shapes against expected
  parenthesisations.
- **Senior insight** — Pratt parsing gives you precedence as data rather than as grammar structure,
  which is why adding an operator to a real language parser is a one-line table change.

### 25.10 Lexing in context
- **Covers** — the lexer/parser split and when to break it, maximal munch and its failures, keyword
  versus identifier resolution, context-sensitive lexing (regex-versus-division in JavaScript,
  template literals, f-strings, heredocs), the offside rule and indentation tokens, and lexer modes
  or stacks.
- **Demo** — a mode-based lexer for a language with template literals and nested interpolation: the
  mode stack is displayed as tokens are produced, and removing the mode stack shows the exact input
  that breaks.
- **Diagram** — mermaid state diagram of lexer modes for string interpolation.
- **Lab** — implement indentation-based INDENT/DEDENT token generation with an indentation stack;
  tests assert correct token streams for tabs/spaces mixes, blank lines and comment-only lines.
- **Senior insight** — most "the parser is context-free" claims fail at the lexer, not the grammar;
  the lexer is where the language's genuinely context-sensitive parts get hidden.

### 25.11 Error recovery and diagnostics
- **Covers** — the difference between detecting and recovering, panic-mode recovery with
  synchronising tokens, phrase-level recovery, error productions, insertion/deletion repair with a
  cost model, cascading errors and how to suppress them, incremental reparsing for editors, and what
  makes an error message useful (location, expectation, suggestion).
- **Demo** — parse deliberately broken source and compare recovery strategies: number of reported
  errors, quality of the recovered tree and cascade suppression, side by side with the diagnostics
  each produces.
- **Diagram** — mermaid flowchart of the recovery decision at a syntax error.
- **Lab** — implement panic-mode recovery with a synchronising-token set; tests assert that a file
  with three independent errors reports exactly three diagnostics, not a cascade, and that the
  recovered AST still contains the valid declarations.
- **Senior insight** — a parser that stops at the first error is unusable in an editor; recovery
  quality is what turns a parser into a language server, and it is the part that never appears in a
  parsing course.

### 25.12 Parsing real languages
- **Covers** — where real grammars leave the context-free world: C's typedef ambiguity and the
  lexer hack, C++ template angle brackets and most-vexing-parse, Python's indentation and
  soft keywords, JavaScript's automatic semicolon insertion and regex/division ambiguity, YAML's
  complexity, and the engineering answers (scannerless parsing, GLR with semantic filters, parse
  then disambiguate).
- **Demo** — a case gallery: each hard case with a minimal input that breaks a naive parser, the
  failure shown, then the standard fix applied and re-run.
- **Diagram** — mermaid flowchart of the C lexer hack feeding symbol-table state back into the
  lexer.
- **Lab** — implement JavaScript-style automatic semicolon insertion for a small subset; tests
  assert the standard tricky cases (return on its own line, postfix `++` on a new line, no insertion
  before `(`) match the specified behaviour.
- **Senior insight** — every language with a "surprising parse" bug report has one of these
  ambiguities behind it; the fixes are all forms of feeding semantic information back into parsing,
  which is exactly what a clean architecture says you should not do.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/grammar.js` | Grammar model, FIRST/FOLLOW, transformations, ambiguity probes |
| `src/js/machines/parse-lab.js` | Parser runner, traces, conflict reports, tree/forest output |
| `src/js/algorithms/pda.js` | PDA execution and CFG conversions |
| `src/js/algorithms/ll-parser.js` | LL(1) tables, predictive parsing, recursive descent generator |
| `src/js/algorithms/lr-parser.js` | LR(0)/SLR/LALR/LR(1) item sets and tables |
| `src/js/algorithms/earley.js`, `cyk.js`, `glr.js` | General parsers with SPPF |
| `src/js/algorithms/peg.js` | PEG interpreter with packrat memoisation |
| `src/js/algorithms/pratt.js` | Operator-precedence expression parser with a data-driven table |
| `src/js/algorithms/lexer-modes.js` | Mode stack, indentation tokens, context-sensitive lexing |
| `src/js/algorithms/error-recovery.js` | Panic mode, repair with costs, cascade suppression |
| `src/js/viz/parse-tree-view.js`, `parse-table-view.js` | Tree/forest and table rendering |

---

## Acceptance criteria

- [ ] Every parser is differentially tested against Earley on the same grammar and inputs; any
      disagreement fails the build.
- [ ] Grammar transformations are verified language-preserving by differential testing over
      generated strings.
- [ ] Conflict reports name the item set, the competing productions and a minimal conflicting input
      — a bare "conflict detected" fails review.
- [ ] Packrat memoisation is shown to change measured step counts from exponential to linear on the
      designed fixture.
- [ ] Error-recovery tests assert diagnostic counts and the survival of valid declarations, not just
      "did not crash".
- [ ] The real-language gallery includes a runnable failing input and a runnable fixed parse for
      every case listed.

---

## Sources

- Aho, Lam, Sethi, Ullman — *Compilers: Principles, Techniques, and Tools*
- Grune, Jacobs — *Parsing Techniques: A Practical Guide*
- Earley — *An efficient context-free parsing algorithm*
- Tomita — *Efficient Parsing for Natural Language* (GLR)
- Ford — *Parsing expression grammars: a recognition-based syntactic foundation*
- Pratt — *Top down operator precedence*
- Scott, Johnstone — *GLL parsing* and SPPF construction
- Ekman, Hedin — practical approaches to context-sensitive parsing
