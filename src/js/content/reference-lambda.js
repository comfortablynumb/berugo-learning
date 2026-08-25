/** Reference entries for the lambda calculus, combinators and semantics (M27.1-M27.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'the-untyped-lambda-calculus': {
      summary: 'Three productions and everything computable, with the substitution rule that ' +
        'every naive implementation gets wrong and five reduction strategies where the choice ' +
        'decides termination rather than cost.',
      intuition: 'A function, an argument, and one rule for putting them together — plus the ' +
        'rename that stops the argument being captured on the way in.',
      formulation: {
        equations: [
          {
            label: 'The same term under five strategies: (λx. λy. y) Ω',
            expr: 'strategy · outcome · steps',
            terms: [
              { sym: 'normal order', meaning: 'a normal form · 1' },
              { sym: 'call by name', meaning: 'a normal form · 1' },
              { sym: 'head reduction', meaning: 'a normal form · 1' },
              { sym: 'applicative order', meaning: 'the budget · 50, 200 and 2 000 — no progress at any' },
              { sym: 'call by value', meaning: 'the budget · 50, 200 and 2 000' }
            ]
          },
          {
            label: 'Factorial through Y, under normal order',
            expr: 'n · reads back as · β-steps · term size',
            terms: [
              { sym: '0 and 1', meaning: '1 and 1 · 9 and 34 · 5 and 5' },
              { sym: '2 and 3', meaning: '2 and 6 · 159 and 838 · 7 and 15' },
              { sym: '4', meaning: '24 · 5 057 · 51' },
              { sym: '5', meaning: '120 · 34 938 · 243' },
              { sym: 'growth per row', meaning: '3.8×, 4.7×, 5.3×, 6.0×, 6.9×' }
            ]
          },
          {
            label: 'The capture fixture',
            expr: 'term · naive · capture-avoiding',
            terms: [
              { sym: '(λx. λy. x) y', meaning: 'λy. y · λy′. y' },
              { sym: 'what each is', meaning: 'the identity · a constant function' },
              { sym: 'the reason', meaning: 'y is free in the argument, so the λy binder is renamed first' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Substitution renames a binder that would capture a free variable',
          why: 'Without it the result is a well-formed term with a different meaning, which no "did it produce a term" test can catch.',
          breaks: 'Every rename is logged with its reason and shown in the demo.'
        },
        {
          name: 'Terms are compared by α-equivalence, never by string',
          why: 'A string comparison passes on every fixture here and fails silently the first time a binder needs renaming.',
          breaks: 'Comparison goes through de Bruijn indices, so names cannot affect the answer.'
        },
        {
          name: 'Every reduction carries a step budget',
          why: 'Ω has no normal form under any strategy, so an unbounded reducer either hangs or lies.',
          breaks: 'The outcome is one of three — a normal form, the budget, or the size cap — and the demo reports which.'
        },
        {
          name: 'Church encodings are read back, not eyeballed',
          why: 'A term that computed four instead of five looks the same at a glance.',
          breaks: 'The numeral is converted by counting applications; the boolean by seeing which argument is selected.'
        },
        {
          name: 'A read-back reports the kind the encoding claims',
          why: 'λt. λf. f is Church false AND Church zero; reading numerals first would report three booleans as 0.',
          breaks: 'Each check names its kind, and the overloaded rows are marked rather than hidden.'
        }
      ],
      complexity: [
        { operation: 'one β-step', average: 'O(size of the body)', worst: 'O(size) — the argument is copied into every occurrence' },
        { operation: 'capture-avoiding substitution', average: 'O(size) plus a free-variable scan', worst: 'O(size²) when every binder needs renaming' },
        { operation: 'reducing plus two three', average: '6 β-steps', worst: 'the same — Church arithmetic is deterministic' },
        { operation: 'factorial n through Y', average: 'grows about 5–7× per increment of n', worst: '34 938 β-steps at n = 5' },
        { operation: 'reducing Ω', average: 'no normal form exists', worst: 'no normal form exists' }
      ],
      failureModes: [
        {
          symptom: 'A macro, template or code generator produces code that references the wrong variable.',
          cause: 'Substitution without a rename — the classic capture bug.',
          fix: 'Generate names that cannot collide, or rename what you are about to shadow. This is what gensym and hygienic macros are for.'
        },
        {
          symptom: 'A function argument that would have been discarded takes the program down.',
          cause: 'Call-by-value evaluates arguments before the function that ignores them.',
          fix: 'Pass a thunk, use a lazy construct, or make the operation a special form. This is why && short-circuits in the grammar.'
        },
        {
          symptom: 'Two functions that behave identically are reported as different.',
          cause: 'Comparison by name rather than by α-equivalence.',
          fix: 'Compare de Bruijn forms, or normalise binder names before comparing.'
        },
        {
          symptom: 'An evaluator hangs on a term that has a normal form.',
          cause: 'An innermost-first strategy on a term with a diverging but unused subterm.',
          fix: 'Reduce outermost-first, or add sharing so the unused subterm is never forced.'
        }
      ],
      inTheWild: [
        'Hygienic macros in Scheme and Rust, which automate exactly the rename in the capture fixture.',
        'Haskell’s call-by-need: call-by-name plus sharing, so an unused argument costs nothing and a used one is evaluated once.',
        'Closure conversion in every compiler, which is the free-variable analysis from this section made into a pass.',
        'De Bruijn indices in proof assistants and in most serious lambda-calculus implementations.'
      ],
      sources: [
        { title: 'Church — An unsolvable problem of elementary number theory (1936)', note: 'the calculus, and the first undecidability result stated in it' },
        { title: 'Barendregt — The Lambda Calculus: Its Syntax and Semantics', note: 'the standard reference, including Church–Rosser and standardisation' },
        { title: 'Pierce — Types and Programming Languages, chapter 5', note: 'the untyped calculus with an implementation, and the capture discussion' },
        { title: 'Wadsworth — Semantics and Pragmatics of the Lambda Calculus (1971)', note: 'graph reduction and the origin of call-by-need' }
      ]
    },
    'combinatory-logic-and-compilation': {
      summary: 'Bracket abstraction compiling variables away, with the exponential blow-up and ' +
        'the two rewrite rules that remove it measured on eight terms, and every compilation ' +
        'checked to compute the same function.',
      intuition: 'Variables are sugar: three closed operators can express every lambda term, ' +
        'and the price is printed in nodes.',
      formulation: {
        equations: [
          {
            label: 'Compiled size: plain against optimised',
            expr: 'term · λ-size · plain · optimised · ratio',
            terms: [
              { sym: 'λx. x', meaning: '2 · 1 · 1 · 1.0×' },
              { sym: 'λx y. x', meaning: '3 · 7 · 1 · 7.0×' },
              { sym: 'λf x. f (f x)', meaning: '7 · 35 · 11 · 3.2×' },
              { sym: 'λx y z. x z (y z)', meaning: '10 · 61 · 1 · 61.0×' },
              { sym: 'λa b c d. a b c d', meaning: '11 · 107 · 1 · 107.0×' }
            ]
          },
          {
            label: 'The four cases of bracket abstraction',
            expr: 'case · result',
            terms: [
              { sym: 'λx. x', meaning: 'I' },
              { sym: 'λx. e, x not free in e', meaning: 'K e' },
              { sym: 'λx. (a b)', meaning: 'S (λx. a) (λx. b)' },
              { sym: 'λx. λy. e', meaning: 'eliminate y first, then x' },
              { sym: 'the two optimisations', meaning: 'S (K a) (K b) → K (a b);  S (K a) I → a' }
            ]
          },
          {
            label: 'Agreement and cost on the same arguments',
            expr: 'term · compiled · β-steps · combinator steps',
            terms: [
              { sym: 'λx y. x', meaning: 'K · 2 · 1' },
              { sym: 'λf x. f (f x)', meaning: 'S (S (K S) K) I · 2 · 6' },
              { sym: 'λf g x. f (g x)', meaning: 'S (K S) K · 3 · 4' },
              { sym: 'λx y z. x z (y z)', meaning: 'S · 3 · 1' },
              { sym: 'agreement', meaning: '7 of 7 fixtures, compared by α-equivalence' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The compiled term is checked to compute the same function',
          why: 'A translation that looks plausible and changes meaning is the failure mode a compiler cannot afford.',
          breaks: 'Both forms are applied to the same arguments and their normal forms compared by α-equivalence.'
        },
        {
          name: 'Comparison is α-equivalence and not string equality',
          why: 'String comparison passes on every fixture here and would miss exactly the renaming bugs it should catch.',
          breaks: 'The check goes through de Bruijn form.'
        },
        {
          name: 'The plain and optimised algorithms are both available',
          why: 'The blow-up is the point, and hiding it behind the optimisation would make the section a claim rather than a measurement.',
          breaks: 'A control switches the two rewrite rules off and the size table reports both columns.'
        },
        {
          name: 'Graph reduction never renames anything',
          why: 'Combinators are closed, so there is nothing to capture — which is exactly what removing the variables bought.',
          breaks: 'The reduction trace has no rename column because no rename can occur.'
        }
      ],
      complexity: [
        { operation: 'bracket abstraction, one variable', average: 'O(size of the body)', worst: 'O(size) nodes emitted per application' },
        { operation: 'compiling n nested abstractions, plain', average: 'exponential in n', worst: '107 nodes from 11 at n = 4' },
        { operation: 'compiling n nested abstractions, optimised', average: 'usually linear', worst: 'still exponential in the worst case; the rules are a peephole' },
        { operation: 'one graph-reduction step', average: 'O(1) after finding the spine', worst: 'O(spine length)' },
        { operation: 'reducing the compiled twice combinator', average: '6 steps against 2 β-steps', worst: 'the same' }
      ],
      failureModes: [
        {
          symptom: 'Point-free code that nobody can read or modify.',
          cause: 'Bracket abstraction done by hand past the point where the composition is simple.',
          fix: 'Name the arguments. The size table is what "past the point" looks like numerically.'
        },
        {
          symptom: 'A combinator-compiled program is far larger than the source.',
          cause: 'S distributes into both halves of every application, and nesting multiplies.',
          fix: 'Apply the optimisations, or use a richer basis (B, C, W) so fewer S nodes are needed.'
        },
        {
          symptom: 'A naive graph reducer duplicates work.',
          cause: 'S x y z copies z, and a tree representation copies the subterm with it.',
          fix: 'Share the node rather than copying it. This is the same insight as thunk update in a lazy runtime.'
        },
        {
          symptom: 'A closure-conversion pass captures more than it needs.',
          cause: 'The free-variable analysis is over-approximating.',
          fix: 'Compute free variables precisely; the environment record is the K-case of bracket abstraction.'
        }
      ],
      inTheWild: [
        'The SKI reduction machines of the 1980s, and Turner’s SASL and Miranda implementations.',
        'Closure conversion in every compiler that supports nested functions.',
        'Point-free style in Haskell and in J and APL, which is bracket abstraction as a programming idiom.',
        'Unlambda and other combinator-only esoteric languages, which are this section taken literally.'
      ],
      sources: [
        { title: 'Schönfinkel — Über die Bausteine der mathematischen Logik (1924)', note: 'the original combinators and the two optimisations' },
        { title: 'Curry and Feys — Combinatory Logic', note: 'the standard treatment, including BCKW and the link to structural rules' },
        { title: 'Turner — A new implementation technique for applicative languages (1979)', note: 'bracket abstraction as a real compilation strategy, with the optimisations' },
        { title: 'Peyton Jones — The Implementation of Functional Programming Languages', note: 'graph reduction, sharing, and why combinator machines gave way to the STG machine' }
      ]
    },
    'operational-semantics': {
      summary: 'Three rule sets over one language: two agree on every answer and differ in ' +
        'every trace, and the third is non-deterministic and gets stuck on a branch that was ' +
        'never going to run.',
      intuition: 'Computation rules say what happens; the evaluation context says where. ' +
        'Changing only the second changes the trace; changing what the first requires changes ' +
        'the language.',
      formulation: {
        equations: [
          {
            label: 'The same term under two evaluation orders',
            expr: 'rule set · trace',
            terms: [
              { sym: 'standard', meaning: '(1 + 2) * (3 + 4) → 3 * (3 + 4) → 3 * 7 → 21' },
              { sym: 'right to left', meaning: '(1 + 2) * (3 + 4) → (1 + 2) * 7 → 3 * 7 → 21' },
              { sym: 'steps', meaning: '3 in both' },
              { sym: 'agreement', meaning: 'all 8 fixtures, value and outcome' }
            ]
          },
          {
            label: 'What the eager-if rule set changes',
            expr: 'term · standard · eager',
            terms: [
              { sym: 'if iszero 0 then 1 + 1 else true + 1', meaning: '2, in 3 steps · STUCK after 2' },
              { sym: 'rules applicable at once', meaning: '1 · 2 — the rule set is non-deterministic' },
              { sym: 'what changed', meaning: 'only the congruence half; all 8 computation rules are identical' }
            ]
          },
          {
            label: 'Small step against big step',
            expr: 'term · small step · big step',
            terms: [
              { sym: '2 + 3 * 4', meaning: '2 steps to 14 · 14, derivation depth 3, 5 nodes' },
              { sym: 'if 2 < 3 then 10 else 20', meaning: '2 steps to 10 · 10, depth 3, 5 nodes' },
              { sym: 'true + 1', meaning: 'stuck at 0 steps · no derivation exists' },
              { sym: 'if 1 then 2 else 3', meaning: 'stuck · the guard evaluated to 1, not a boolean' },
              { sym: 'agreement', meaning: '8 of 8, including all three stuck cases' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Determinism is checked by enumerating every permitted step',
          why: 'An implementation that tries the first matching rule is deterministic by construction and proves nothing about the rules.',
          breaks: 'Every reachable term is walked and the maximum number of applicable rules is reported, with the witness when it exceeds one.'
        },
        {
          name: 'The evaluation context is value-gated',
          why: 'E ::= E + e | v + E is the textbook definition; without the value condition the rules permit two steps at any term with two reducible operands.',
          breaks: 'Under the standard and right-to-left rule sets the maximum is 1 at every reachable term.'
        },
        {
          name: 'Only the congruence rules change between rule sets',
          why: 'A comparison is only attributable if one thing varied.',
          breaks: 'All eight computation rules are shared by all three variants.'
        },
        {
          name: 'Terms print with the parentheses precedence requires',
          why: '2 * (3 + 4) printed as 2 * 3 + 4 is a different term, and a reader comparing traces would be comparing the wrong things.',
          breaks: 'The printer carries a precedence level and parenthesises accordingly.'
        },
        {
          name: 'The two semantics are checked against each other on every fixture',
          why: 'Their agreement — including where both fail — is the property, and it is what hand-written interpreters violate at the edges.',
          breaks: 'Where the small step reaches a value the big step derives the same one; where it gets stuck, no derivation exists.'
        }
      ],
      complexity: [
        { operation: 'one small step', average: 'O(size of the term)', worst: 'O(size) — the rules are scanned, then the context is found' },
        { operation: 'evaluating a fixture', average: '2 to 3 steps', worst: 'the step budget, for a term with no normal form' },
        { operation: 'a big-step derivation', average: 'depth 3, 5 nodes on the fixtures', worst: 'O(size of the term) in depth' },
        { operation: 'the determinism check', average: 'O(reachable terms × rules)', worst: 'capped at 400 reachable terms per fixture' },
        { operation: 'building the evaluation context string', average: 'O(depth)', worst: 'O(size)' }
      ],
      failureModes: [
        {
          symptom: 'A team argues about what an expression evaluates to.',
          cause: 'The semantics were never written down, so both readings are defensible.',
          fix: 'Find the rules. A language specification settles it in four lines; a blog post never will.'
        },
        {
          symptom: 'Code in an unreachable branch crashes the program.',
          cause: 'A construct evaluates a subterm before it is known to be needed.',
          fix: 'Check whether the construct is a function or a special form. Eager assert messages and default arguments are the usual culprits.'
        },
        {
          symptom: 'The same program gives different answers on two compilers.',
          cause: 'The specification left evaluation order unspecified and the language has side effects.',
          fix: 'Do not rely on it. Confluence only protects you in the absence of effects.'
        },
        {
          symptom: 'An interpreter returns a default where the specification says the program is stuck.',
          cause: 'A big-step evaluator with a fallback case.',
          fix: 'Make failure explicit and check it against the small-step definition on every fixture.'
        }
      ],
      inTheWild: [
        'The ECMAScript, Java and WebAssembly specifications, all of which define evaluation by rules of this shape.',
        'K Framework and PLT Redex, which take a rule set as input and produce an interpreter and a model checker.',
        'Undefined behaviour in C, which is precisely "the rules say nothing here".',
        'Every language server that must evaluate a fragment of a program the same way the compiler will.'
      ],
      sources: [
        { title: 'Plotkin — A Structural Approach to Operational Semantics (1981)', note: 'the small-step formulation, and the reason it is called SOS' },
        { title: 'Felleisen and Hieb — The revised report on the syntactic theories of sequential control and state (1992)', note: 'evaluation contexts, and why they replace a page of congruence rules' },
        { title: 'Pierce — Types and Programming Languages, chapters 3 and 8', note: 'the arithmetic language used here, with progress and preservation' },
        { title: 'Kahn — Natural Semantics (1987)', note: 'the big-step formulation and what it can and cannot express' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
