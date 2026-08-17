# M28 — Compiler front end: build a language

> **Track** Automata, languages and compilers · **Depends on** M25, M27 · **Sections** 9 · **Effort** L

**Outcome.** One real language, called **Berugo**, designed and implemented front to back across
M28–M31: source text in, checked AST out here; IR and optimisation in M29; bytecode, a VM and a JIT
in M30; a garbage collector in M31. Everything runs in the browser and every stage is inspectable.

**The language.** Small enough to build, large enough to be interesting: expressions with
precedence, `let` bindings, first-class functions and closures, records and arrays, sum types with
pattern matching, `if`/`while`/`for`, modules with imports, and Hindley–Milner inference with
annotations allowed. No exceptions in v1 (added in M30 to motivate stack unwinding); no mutation of
captured variables in v1 (added in M29 to motivate SSA and escape analysis).

**Shared machinery introduced.** `machines/berugo/` — the compiler package, structured so each stage
is a pure function over the previous stage's output, plus `machines/berugo/pipeline.js` that runs
any prefix of the pipeline and returns every intermediate representation for inspection.

---

## Sections

### 28.1 Designing the language
- **Covers** — the specification as a deliverable: concrete syntax, grammar, static semantics,
  dynamic semantics, and the deliberate non-goals; how each feature decision creates work in a later
  stage; the sample programs that serve as the conformance suite; and versioning the language across
  milestones.
- **Demo** — the spec browser: every language feature with its grammar production, typing rule,
  evaluation rule and a runnable example, cross-linked to the compiler stage that implements it.
- **Diagram** — mermaid diagram of the whole pipeline from source to execution across M28–M31, with
  this milestone's scope shaded.
- **Lab** — extend the spec with one new feature (a `match` guard) by writing its grammar rule,
  typing rule and evaluation rule; graded by whether the later labs' implementations of it pass the
  conformance tests derived from the spec.
- **Senior insight** — a feature is cheap in the parser and expensive in the optimiser; deciding
  where the cost lands is language design, and the pipeline diagram is where you can see it before
  committing.

### 28.2 The lexer
- **Covers** — hand-written scanner versus generated (using M24's generator), token design, source
  positions and spans, trivia (whitespace and comments) preserved for formatting tools, string
  escapes and interpolation, numeric literal forms, error tokens instead of exceptions, and
  incremental relexing for an editor.
- **Demo** — live token stream: type source and see tokens with kinds, spans and trivia; a
  malformed-input panel shows error tokens flowing through instead of aborting.
- **Diagram** — mermaid state diagram of the string/interpolation lexer modes.
- **Lab** — implement the numeric-literal scanner (integers, floats, exponents, separators) with
  error tokens for malformed forms; tests assert token streams against golden files including the
  malformed cases.
- **Senior insight** — preserving trivia and emitting error tokens is what makes one lexer serve the
  compiler, the formatter and the language server; retrofitting either later means rewriting.

### 28.3 The parser
- **Covers** — recursive descent for statements with Pratt parsing for expressions (both from M25),
  AST node design with spans on every node, parenthesisation and precedence recovery,
  parse-then-validate for constructs the grammar cannot express, and keeping the parser total (it
  always returns a tree, possibly containing error nodes).
- **Demo** — parse-tree explorer: the AST rendered as a tree with spans linked back to source
  ranges; clicking a node highlights the source and vice versa.
- **Diagram** — mermaid diagram of the AST node hierarchy for the expression and statement families.
- **Lab** — implement parsing for the `match` expression including nested patterns; tests assert
  tree shapes against golden files and that error nodes appear exactly where the input is malformed.
- **Senior insight** — spans on every node are not overhead, they are the entire basis of every
  diagnostic, refactoring and code action the language will ever support.

### 28.4 AST infrastructure
- **Covers** — visitors and traversal (pre/post-order, with early exit), immutable versus mutable
  rewriting, a pretty printer that round-trips, source maps, syntax queries for tooling, node
  identity and stable ids across edits, and the AST-versus-CST distinction.
- **Demo** — round-trip checker: parse, pretty print, reparse, and diff the trees; formatting
  options are adjustable and the invariant (tree equality modulo trivia) is asserted live.
- **Diagram** — mermaid flowchart of the parse → print → reparse round trip with the invariant
  stated.
- **Lab** — implement the pretty printer for expressions with minimal parentheses; tests assert the
  round-trip property over generated ASTs and that no unnecessary parentheses are emitted.
- **Senior insight** — the minimal-parentheses printer is a precedence-table consumer, so a bug here
  proves a disagreement between the parser and the printer about precedence — which is exactly the
  kind of inconsistency that ships.

### 28.5 Names, scopes and resolution
- **Covers** — lexical scoping, the scope tree, shadowing rules, forward references and hoisting,
  recursive and mutually recursive bindings, modules and import resolution, name resolution as a
  separate pass producing a binding table, unresolved-name diagnostics with suggestions, and
  capture analysis for closures.
- **Demo** — scope inspector: hover any identifier to see its binding site, its scope's extent and
  every other reference; captured variables are marked with the closure that captures them.
- **Diagram** — mermaid tree of nested scopes with bindings and capture arrows.
- **Lab** — implement resolution with shadowing and closure capture; tests assert each reference
  resolves to the correct binding on fixtures designed around shadowing, mutual recursion and
  imports.
- **Senior insight** — resolving names in a separate pass, into an explicit table, is what lets the
  type checker, the optimiser and the IDE all agree about what a name means. Resolving inline in the
  checker is the shortcut that eventually forces a rewrite.

### 28.6 Type checking and inference
- **Covers** — wiring M27's Hindley–Milner implementation into a real compiler, checking versus
  inferring per node, bidirectional type checking for annotations, unification error reporting with
  the two conflicting source spans, generalisation points, records and sum types, exhaustiveness
  from M27, and the type table as a compiler artefact consumed downstream.
- **Demo** — inference trace over a real program: constraints per node, the unification order, the
  final type of every expression displayed inline, and for a failing program the two spans that
  conflict shown together.
- **Diagram** — mermaid flowchart of bidirectional checking switching between check and infer modes.
- **Lab** — implement type checking for `match` with exhaustiveness; tests assert correct types for
  the conformance programs and precise diagnostics (right span, right message) for the error suite.
- **Senior insight** — the type error a user sees is a UX artefact, not a theorem: keeping both
  spans and the constraint that connected them is the difference between "cannot unify a with b" and
  a message someone can act on.

### 28.7 Semantic analysis and desugaring
- **Covers** — desugaring to a smaller core language (for-loops to while, `match` to nested tests,
  operators to calls, string interpolation to concatenation), constant folding at the AST level,
  definite-assignment analysis, unreachable-code detection, purity/effect annotations, and keeping
  desugared nodes traceable to original source for diagnostics.
- **Demo** — the desugaring viewer: source on the left, core language on the right, with every core
  node linked to the surface construct that produced it; toggles enable each desugaring
  individually.
- **Diagram** — mermaid diagram of one `for` loop desugaring into core constructs.
- **Lab** — implement `for`-loop desugaring preserving `break`/`continue` semantics and source
  spans; tests assert identical runtime behaviour to a reference interpreter and correct span
  attribution in diagnostics.
- **Senior insight** — every desugaring is a chance to lose the user's mental model; keeping the
  original span on the generated node is what stops error messages from pointing at code the
  developer never wrote.

### 28.8 Diagnostics as a product
- **Covers** — diagnostic structure (severity, code, primary and secondary spans, notes,
  suggestions), machine-applicable fixes, cascade suppression, sorting and deduplication, the
  language-server-shaped API (hover, go to definition, completion, rename) built on the resolution
  and type tables, and incremental recheck on edit.
- **Demo** — a mini editor over the compiler: type Berugo code and get live squiggles, hover types,
  go-to-definition, rename and quick fixes — all driven by the compiler's own tables, with the
  recheck time displayed per keystroke.
- **Diagram** — mermaid diagram of the editor request flow through the compiler's cached stages.
- **Lab** — implement `rename` using the binding table, handling shadowing correctly; tests assert
  every reference is renamed, no unrelated binding is touched, and shadowed occurrences are left
  alone.
- **Senior insight** — go-to-definition and rename fall out of the resolution table for free; if a
  compiler cannot answer them, its name resolution is not a data structure, and everything else will
  be harder too.

### 28.9 Testing the front end
- **Covers** — golden-file tests for tokens, trees and diagnostics; conformance programs with
  expected outputs; property tests (print/parse round-trip, resolution stability under
  reformatting); grammar-driven random program generation; fuzzing the parser for crashes and
  hangs; differential testing against a reference interpreter; and coverage of the error suite, not
  only the happy path.
- **Demo** — the test dashboard: conformance suite results, golden-file diffs rendered inline, a
  fuzzing panel that generates random programs and reports any crash, hang or lost diagnostic.
- **Diagram** — mermaid flowchart of the test pipeline from generator through the compiler stages to
  the oracles.
- **Lab** — write a grammar-driven random program generator and run the round-trip property; tests
  assert no failures over 10⁴ generated programs and that a deliberately broken printer is caught.
- **Senior insight** — the round-trip property finds more parser bugs than any hand-written test
  suite, and a random program generator built from the grammar is the cheapest fuzzer a language
  will ever get.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/berugo/spec.js` | Machine-readable language spec driving the spec browser and tests |
| `src/js/machines/berugo/lexer.js` | Scanner, modes, trivia, error tokens, incremental relex |
| `src/js/machines/berugo/parser.js` | Recursive descent + Pratt, AST with spans, error nodes |
| `src/js/machines/berugo/ast.js` | Node definitions, visitors, pretty printer, source maps |
| `src/js/machines/berugo/resolve.js` | Scope tree, binding table, capture analysis, modules |
| `src/js/machines/berugo/typecheck.js` | Bidirectional checking over the M27 inference engine |
| `src/js/machines/berugo/desugar.js` | Core-language lowering with span preservation |
| `src/js/machines/berugo/diagnostics.js` | Diagnostic model, fixes, suppression, sorting |
| `src/js/machines/berugo/ide.js` | Hover, definition, completion, rename over compiler tables |
| `src/js/machines/berugo/pipeline.js` | Stage runner returning every intermediate artefact |
| `src/js/viz/ast-view.js` | AST rendering with source linking |

---

## Acceptance criteria

- [ ] Every conformance program parses, resolves, type-checks and desugars, with golden files for
      each stage checked in.
- [ ] Every error-suite program produces exactly the expected diagnostics: right code, right primary
      span, no cascade.
- [ ] The print/parse round-trip property holds over 10⁴ generated programs.
- [ ] Parser fuzzing produces no crash, no hang (step budget enforced) and no lost span.
- [ ] Rename, go-to-definition and hover are correct on the shadowing fixture set.
- [ ] Every compiler stage is a pure function of its input, asserted by running the pipeline twice
      and deep-comparing all artefacts.
- [ ] No file in `machines/berugo/` exceeds the size limits; the pipeline stays modular.

---

## Sources

- Aho, Lam, Sethi, Ullman — *Compilers: Principles, Techniques, and Tools*
- Appel — *Modern Compiler Implementation in ML*
- Nystrom — *Crafting Interpreters*
- Pierce — *Types and Programming Languages* (checking and inference chapters)
- The Rust and Elm compiler teams' published notes on diagnostics design
- Microsoft — Language Server Protocol specification
