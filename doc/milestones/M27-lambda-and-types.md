# M27 — Lambda calculus, type systems and semantics

> **Track** Automata, languages and compilers · **Depends on** M25 · **Sections** 11 · **Effort** L

**Outcome.** The theory behind every language feature a senior engineer argues about: closures,
generics, variance, inference, null safety, ownership, effects. Each section implements the rules
as an executable checker, so a typing judgement stops being notation and becomes a function.

**Shared machinery introduced.** `machines/lambda-engine.js` — parser, substitution with capture
avoidance, reduction strategies, step tracing and de Bruijn representation; `machines/type-engine.js`
— a rules engine where each type system is a set of inference rules the checker walks, producing a
derivation tree that the UI renders; `viz/derivation-view.js` for typing derivations and reduction
sequences.

---

## Sections

### 27.1 The untyped lambda calculus
- **Covers** — variables, abstraction and application as the whole syntax, free and bound variables,
  α-conversion, capture-avoiding substitution, β-reduction, η-conversion, currying, Church encodings
  (booleans, numerals, pairs, lists), recursion via the Y combinator, normal forms, the
  Church–Rosser theorem, and evaluation order (normal, applicative, call-by-name, call-by-value,
  call-by-need).
- **Demo** — reduction stepper: enter a term and reduce it under a chosen strategy with each redex
  highlighted and the substitution shown; a strategy comparison runs the same term under all
  strategies and shows one terminating where another diverges.
- **Diagram** — mermaid diagram of a β-reduction step with the substitution made explicit.
- **Lab** — implement capture-avoiding substitution and the Y combinator's fixed-point behaviour;
  tests assert α-equivalence handling on the classic capture fixture and that factorial via Y
  computes correctly under call-by-name.
- **Senior insight** — the capture case is where every naive substitution implementation is wrong,
  and the same bug appears in macro systems, template engines and code generators.

### 27.2 Combinatory logic and compilation
- **Covers** — SKI and BCKW combinators, the elimination of variables by bracket abstraction,
  point-free style, compiling lambda terms to combinators, graph reduction, and the historical role
  of combinator machines in lazy-language implementation.
- **Demo** — a lambda term compiled to SKI combinators step by step with the abstraction algorithm
  shown, then executed by graph reduction with sharing visible.
- **Diagram** — mermaid diagram of bracket abstraction eliminating one variable.
- **Lab** — implement bracket abstraction and verify combinator equivalence; tests assert the
  compiled combinator term reduces to the same normal form as the original lambda term for a fixture
  set.
- **Senior insight** — combinators are the proof that variables are syntactic sugar; the practical
  descendant is closure conversion in M28, which does the same job for a real compiler.

### 27.3 Operational semantics
- **Covers** — small-step and big-step semantics, evaluation contexts, inference-rule notation read
  as code, defining a language's meaning precisely, stuck terms as the definition of a runtime
  error, determinism of evaluation, and writing an interpreter directly from the rules.
- **Demo** — a rules-driven interpreter for a small language: each evaluation step names the rule
  applied, and the learner can edit the rule set and immediately see the language's behaviour change.
- **Diagram** — mermaid diagram of an evaluation context focusing the next redex.
- **Lab** — extend the provided rule set with a new construct (say, `let` or short-circuit `&&`) and
  keep evaluation deterministic; tests assert the expected results and that no term has two
  applicable rules.
- **Senior insight** — "what does this expression evaluate to" arguments end instantly when the
  semantics are written down as rules, which is why language specs are written this way and blog
  posts are not.

### 27.4 The simply typed lambda calculus
- **Covers** — types as a syntactic discipline, function types, the typing judgement Γ ⊢ e : τ,
  the rules for variables, abstraction and application, type checking versus type inference,
  progress and preservation as the statement of soundness, strong normalisation and what it costs
  (no general recursion), and the Curry–Howard correspondence.
- **Demo** — the derivation viewer: type an expression and see the full derivation tree built rule
  by rule; ill-typed terms show the exact rule that fails and the constraint that could not be met.
- **Diagram** — mermaid tree of a typing derivation for a small application.
- **Lab** — implement the type checker for STLC; tests assert acceptance of well-typed fixtures,
  rejection of ill-typed ones with the correct failing rule, and the progress property on a
  generated term set.
- **Senior insight** — "well-typed programs do not go wrong" is a theorem with a precise meaning
  (progress plus preservation), and every language that violates it (unsound variance, unchecked
  casts) does so knowingly for a stated reason.

### 27.5 Type inference and Hindley–Milner
- **Covers** — type variables, constraint generation, unification with the occurs check,
  substitution composition, generalisation at let-bindings and the value restriction,
  instantiation, algorithm W versus constraint-based formulations, principal types, and the error
  messages inference produces (and why they are bad).
- **Demo** — inference visualiser: constraints generated per subterm, unification steps applied in
  order, and the substitution built up; a failing program shows the two conflicting types and the
  positions that produced them.
- **Diagram** — mermaid flowchart of generate-constraints → unify → generalise.
- **Lab** — implement unification with the occurs check and let-generalisation; tests assert
  principal types for a fixture set, correct rejection of infinite types (`λx. x x`), and that
  generalisation happens only at let.
- **Senior insight** — the occurs check is what stops the checker from building an infinite type and
  looping; when a language's inference "hangs", that check is usually missing or deferred.

### 27.6 Polymorphism and System F
- **Covers** — parametric polymorphism, explicit type abstraction and application, System F and its
  undecidable inference, rank-1 versus higher-rank polymorphism, parametricity and free theorems,
  existential types as abstraction and their relationship to interfaces and modules, and ad-hoc
  polymorphism as the contrast.
- **Demo** — parametricity explorer: given a polymorphic type, the tool lists what a total function
  of that type *can possibly* do (there is exactly one inhabitant of `∀a. a → a`), and the learner
  can try to write a counter-example.
- **Diagram** — mermaid diagram of an existential type packing a representation with its operations.
- **Lab** — implement type checking for System F with explicit type application; tests assert
  well-typed and ill-typed fixtures and that a term's behaviour respects the free theorem for its
  type on generated inputs.
- **Senior insight** — parametricity is why a signature like `<T>(items: T[]) => T[]` tells you the
  function cannot inspect the elements — a genuinely useful reasoning tool in code review, and it is
  a theorem, not a convention.

### 27.7 Subtyping and variance
- **Covers** — the subsumption rule, nominal versus structural subtyping, width and depth
  subtyping for records, function subtyping and its contravariant argument position, covariance,
  contravariance and invariance for generics, declaration-site versus use-site variance, the Java
  array covariance hole, bounded quantification, and TypeScript's deliberate unsoundness.
- **Demo** — variance checker: define a generic container and a method signature, and the tool
  reports whether each position is sound, generating a counter-example program when it is not (the
  `Object[] a = new String[1]` classic, reproduced in TypeScript).
- **Diagram** — mermaid diagram of function subtyping showing the argument position flipping.
- **Lab** — implement a subtyping relation with correct function variance; tests assert the
  contravariant argument rule and reject the covariant-argument version by exhibiting the unsound
  program it admits.
- **Senior insight** — "arguments are contravariant" is the rule everyone can recite and few apply;
  it is exactly why a callback taking a narrower type cannot be substituted where a wider one is
  expected.

### 27.8 Beyond plain generics
- **Covers** — type classes and traits with dictionary-passing translation, higher-kinded types,
  associated types, GADTs and their refinement of types by pattern matching, dependent types with a
  minimal example, refinement types and liquid typing, effect systems and algebraic effects, and
  where each appears in mainstream languages.
- **Demo** — dictionary-passing translator: a type-class-using program is elaborated into explicit
  dictionary arguments, showing exactly what the compiler inserts and what it costs at runtime.
- **Diagram** — mermaid diagram of the elaboration from constrained polymorphism to explicit
  dictionaries.
- **Lab** — implement type-class resolution with instance lookup and coherence checking; tests
  assert resolution succeeds for valid programs, detects overlapping instances and produces the same
  runtime behaviour as the manually elaborated version.
- **Senior insight** — traits, interfaces and type classes differ mainly in *who* chooses the
  implementation and *when*; the dictionary translation makes the runtime cost of each choice
  concrete.

### 27.9 Algebraic data types and pattern matching
- **Covers** — sums, products and their algebra, recursive types and the μ operator, iso-recursive
  versus equi-recursive treatment, pattern-match compilation to decision trees, exhaustiveness and
  redundancy checking, the null-versus-option argument with the type-level reasoning behind it, and
  recursion schemes at a light touch.
- **Demo** — exhaustiveness checker: write a match over a sum type and see the checker report
  missing cases with concrete witnesses (a value that no branch handles), plus the compiled decision
  tree with test counts.
- **Diagram** — mermaid decision tree produced by compiling a nested pattern match.
- **Lab** — implement exhaustiveness checking for nested patterns using the usefulness algorithm;
  tests assert correct witnesses for missing cases and no false positives on complete matches.
- **Senior insight** — exhaustiveness checking is the feature that makes adding a variant safe;
  without it, every new case is a silent runtime hole spread across the codebase.

### 27.10 Denotational and axiomatic semantics
- **Covers** — meaning as a mathematical object, domains and continuity, least fixed points for
  recursion, the bottom element as non-termination, Hoare triples, weakest preconditions, loop
  invariants, partial versus total correctness, and how these become the verification conditions of
  M32.
- **Demo** — a Hoare-logic prover for a tiny imperative language: annotate a program with a
  precondition, postcondition and loop invariant, and watch the verification conditions be generated
  and discharged (or fail, with the failing VC shown).
- **Diagram** — mermaid diagram of the while-rule generating its verification conditions.
- **Lab** — supply the loop invariant for a provided program and have the checker discharge the
  triple; tests assert that a wrong invariant is rejected with the specific VC that fails.
- **Senior insight** — writing the loop invariant is the same act as understanding the loop; when
  reviewers cannot state one, that loop is where the bug is.

### 27.11 Substructural types and ownership
- **Covers** — structural rules (weakening, contraction, exchange) and what dropping each gives you,
  linear and affine types, ownership and borrowing as an affine discipline, lifetimes as region
  annotations, move semantics, the aliasing-XOR-mutation rule, session types for protocols, and how
  these eliminate whole bug classes without a garbage collector.
- **Demo** — a borrow checker for a toy language: write code that aliases and mutates, and watch the
  checker reject it with the conflicting borrow highlighted; a lifetime view shows each reference's
  valid region.
- **Diagram** — mermaid diagram of ownership transfer and borrow scopes over a program's timeline.
- **Lab** — implement the aliasing-XOR-mutation check over a simplified IR; tests assert rejection
  of use-after-move and simultaneous mutable borrows, and acceptance of valid sequential borrows.
- **Senior insight** — the ownership rules are not about memory specifically; the same discipline
  prevents data races (M47), double-close of file handles and use-after-free of any resource. Memory
  is just the case that got the attention.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/lambda-engine.js` | Parsing, substitution, reduction strategies, de Bruijn form |
| `src/js/machines/type-engine.js` | Rule-driven checker producing derivation trees |
| `src/js/algorithms/combinators.js` | SKI, bracket abstraction, graph reduction |
| `src/js/algorithms/small-step.js` | Rule-set interpreter with editable rules |
| `src/js/algorithms/hm-inference.js` | Constraint generation, unification, generalisation |
| `src/js/algorithms/system-f.js` | Explicit polymorphism checker, parametricity probes |
| `src/js/algorithms/subtyping.js` | Subtype relation, variance checking, counter-example generation |
| `src/js/algorithms/typeclasses.js` | Instance resolution, coherence, dictionary elaboration |
| `src/js/algorithms/pattern-compile.js` | Decision-tree compilation, usefulness/exhaustiveness |
| `src/js/algorithms/hoare.js` | Weakest preconditions, VC generation, invariant checking |
| `src/js/algorithms/ownership.js` | Borrow checking over a simplified IR |
| `src/js/viz/derivation-view.js` | Typing derivations and reduction traces |

---

## Acceptance criteria

- [ ] Substitution passes the capture fixtures, verified by α-equivalence comparison, not string
      equality.
- [ ] Every type system's checker produces a full derivation for accepted terms and names the
      failing rule for rejected ones; a bare boolean fails review.
- [ ] Inference returns principal types, verified by checking that every other valid typing is an
      instance of the returned one for the fixture set.
- [ ] The unsound-variance demos produce a real program that type-checks and misbehaves at runtime.
- [ ] Exhaustiveness checking returns a concrete witness value for every incomplete match, and the
      witness is verified to match no branch.
- [ ] The borrow checker's decisions are asserted against a hand-labelled fixture set covering
      move, borrow, reborrow and conflict cases.

---

## Sources

- Pierce — *Types and Programming Languages*
- Barendregt — *The Lambda Calculus: Its Syntax and Semantics*
- Milner — *A theory of type polymorphism in programming*
- Damas, Milner — *Principal type-schemes for functional programs*
- Reynolds — *Types, abstraction and parametric polymorphism*; Wadler — *Theorems for free!*
- Maranget — *Warnings for pattern matching* (usefulness algorithm)
- Hoare — *An axiomatic basis for computer programming*
- Wadler — *Linear types can change the world*; Girard — *Linear logic*
