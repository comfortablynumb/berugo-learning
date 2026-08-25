/** Reference entries for STLC, inference, System F and subtyping (M27.4-M27.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'the-simply-typed-lambda-calculus': {
      summary: 'Soundness measured rather than quoted: every term of depth one typed and run, ' +
        'zero well-typed terms stuck, zero steps changing a type — and ninety-nine rejected ' +
        'terms that would have worked.',
      intuition: 'Progress says a well-typed term is never stuck; preservation says a step ' +
        'keeps the type. Together they say a well-typed program runs to a value of the type it ' +
        'claimed.',
      formulation: {
        equations: [
          {
            label: 'The soundness sweep: 215 exhaustive plus 2 000 sampled terms',
            expr: 'category · ran to a value · got stuck · total',
            terms: [
              { sym: 'well typed', meaning: '224 · 0 · 224' },
              { sym: 'rejected', meaning: '99 · 1 892 · 1 991' },
              { sym: 'preservation', meaning: '400 steps typed, 0 type changes' },
              { sym: 'conservatism', meaning: '99 of 1 991 rejections were unnecessary — 5.0%' }
            ]
          },
          {
            label: 'Rejections, and the rule that failed',
            expr: 'term · rule · reason',
            terms: [
              { sym: '(λx: Number. x) true', meaning: 'T-App · the function expects Number and the argument is Boolean' },
              { sym: 'if true then 1 else false', meaning: 'T-If · the branches have types Number and Boolean' },
              { sym: 'if 1 then 2 else 3', meaning: 'T-If · the condition has type Number and must be Boolean' },
              { sym: '3 4', meaning: 'T-App · the left side has type Number, which is not a function type' },
              { sym: 'λr: { a: Number }. r.b', meaning: 'T-Proj · no field named b — it has a' }
            ]
          },
          {
            label: 'A derivation, measured',
            expr: 'term · type · height · nodes',
            terms: [
              { sym: 'λf: Number → Number. λx: Number. f (f x)', meaning: '(Number → Number) → Number → Number · 5 · 7' },
              { sym: 'agreement', meaning: '13 of 13 fixtures match both the verdict and the expected rule' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A rejection names the rule that failed',
          why: 'A boolean is correct and useless; the rule name is what tells a human where to look.',
          breaks: 'The fixture table asserts the rule for each rejected term, so a checker rejecting everything fails.'
        },
        {
          name: 'Progress is checked by running, not by proof',
          why: 'The claim is about the implemented rules, and the implementation is what could be wrong.',
          breaks: 'Every well-typed term in the sweep is evaluated and the stuck count reported; it is zero.'
        },
        {
          name: 'Preservation types every intermediate term',
          why: 'Checking only the endpoints would miss a step that changed the type and changed it back.',
          breaks: '400 steps typed across the sweep, with the failure count reported alongside.'
        },
        {
          name: 'The conservatism is counted and reported',
          why: 'Every sound type system rejects safe programs, and a section that omits the number is selling something.',
          breaks: 'The bottom-left cell of the soundness table is the count, with a named example.'
        },
        {
          name: 'The exhaustive part is stated separately from the sampled part',
          why: '"All 215 terms of depth one" and "2 000 sampled deeper terms" are different kinds of evidence.',
          breaks: 'The caption gives both numbers and the sample size is a control.'
        }
      ],
      complexity: [
        { operation: 'type checking one term', average: 'O(size)', worst: 'O(size) — one bottom-up pass, no search' },
        { operation: 'the exhaustive term set at depth one', average: '215 terms over five atoms', worst: 'grows as the cube of the pool for the three-argument constructor' },
        { operation: 'the soundness sweep', average: 'O(terms × size)', worst: '2 215 terms typed and run at the default setting' },
        { operation: 'preservation on one term', average: 'O(steps × size)', worst: 'bounded by the 100-step budget' },
        { operation: 'building the derivation tree', average: 'O(size) nodes', worst: 'height 5, 7 nodes on the default fixture' }
      ],
      failureModes: [
        {
          symptom: 'A "type error" with no location and no rule.',
          cause: 'The checker returns a boolean rather than a derivation.',
          fix: 'Build the derivation and report the first node that failed. The information is already there.'
        },
        {
          symptom: 'A safe program is rejected and the team calls it a compiler bug.',
          cause: 'Conservatism, which is forced — deciding "does this go wrong" exactly is undecidable.',
          fix: 'Restructure so the checker can see what you know, or use the language’s escape hatch deliberately.'
        },
        {
          symptom: 'A type system is claimed sound with no statement of what that means.',
          cause: 'Soundness without progress and preservation is a slogan.',
          fix: 'Ask which theorem holds and where the language knowingly breaks it — arrays, casts, variance.'
        },
        {
          symptom: 'A test suite asserts only that ill-typed programs are rejected.',
          cause: 'The rule name is not part of the expectation.',
          fix: 'Assert the failing rule too, or a checker that rejects everything passes.'
        }
      ],
      inTheWild: [
        'Every ML, Haskell and Rust type checker, which is this rule set plus a great deal more.',
        'Coq, Agda and Lean, where Curry–Howard is the point and a term of a type IS a proof.',
        'Java’s and C#’s type systems, which are sound in the core and knowingly not for arrays and unchecked casts.',
        'TypeScript, which is deliberately unsound in documented places and says so in its own design goals.'
      ],
      sources: [
        { title: 'Church — A formulation of the simple theory of types (1940)', note: 'the calculus with types, and the origin of the arrow notation' },
        { title: 'Wright and Felleisen — A syntactic approach to type soundness (1994)', note: 'progress and preservation as the standard proof technique' },
        { title: 'Pierce — Types and Programming Languages, chapters 8–11', note: 'the rules used here, with the soundness proof and the extensions' },
        { title: 'Howard — The formulae-as-types notion of construction (1969)', note: 'the correspondence, written down' }
      ]
    },
    'type-inference-and-hindley-milner': {
      summary: 'The same body typed and rejected depending on one generalisation step, with ' +
        'every equation unification was asked to solve printed in the order the traversal ' +
        'produced it.',
      intuition: 'Generate constraints while walking the term, solve them by unification, and ' +
        'quantify at let over the variables the environment does not mention.',
      formulation: {
        equations: [
          {
            label: 'One generalisation step, two outcomes',
            expr: 'term · result',
            terms: [
              { sym: 'let id = λx. x in pair (id 3) (id true)', meaning: 'Pair Number Boolean' },
              { sym: 'λid. pair (id 3) (id true)', meaning: 'rejected: cannot match Number with Boolean' },
              { sym: 'the difference', meaning: 'the let generalises id to ∀α. α → α; a lambda binder does not' },
              { sym: 'the work', meaning: '9 fresh variables, 12 equations, 13 rule applications' }
            ]
          },
          {
            label: 'The two ways unification fails',
            expr: 'problem · outcome',
            terms: [
              { sym: 'a → b  ~  Number → Boolean', meaning: 'solved: a := Number, b := Boolean' },
              { sym: 'a → a  ~  Number → Boolean', meaning: 'clash: cannot match Number with Boolean' },
              { sym: 'a  ~  a → b', meaning: 'occurs check: a appears inside a → b' },
              { sym: 'List a  ~  Pair a b', meaning: 'clash: different constructors' },
              { sym: '(a → b) → a  ~  (Number → c) → d', meaning: 'solved: a := Number, b := c, d := Number' }
            ]
          },
          {
            label: 'Principal types, asserted exactly',
            expr: 'term · principal type',
            terms: [
              { sym: 'λx. x', meaning: '∀α. α → α' },
              { sym: 'λf. λx. f (f x)', meaning: '∀α. (α → α) → α → α' },
              { sym: 'λf. λg. λx. f (g x)', meaning: '∀α β γ. (α → β) → (γ → α) → γ → β' },
              { sym: 'λl. add (length l) 1', meaning: '∀α. List α → Number' },
              { sym: 'agreement', meaning: '12 of 12 fixtures' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The exact scheme is asserted, not merely "it typed"',
          why: 'A checker inferring Number → Number for the identity would pass the weaker test.',
          breaks: 'Each fixture carries its principal type, written down independently of the implementation.'
        },
        {
          name: 'The occurs check is present and reported by name',
          why: 'Without it the checker builds a cyclic type and hangs, which is a much worse failure than an error.',
          breaks: 'λx. x x is rejected with the variable and the type it would have to contain.'
        },
        {
          name: 'Substitutions are composed, and applied in one pass',
          why: 'Composition keeps them idempotent; chasing a binding recursively would loop the moment composition produced a cycle.',
          breaks: 'Applying a substitution to a variable is a single lookup, and every equation is composed into the result.'
        },
        {
          name: 'Generalisation happens only at let',
          why: 'It is the entire difference between the two fixtures in the contrast table, and the reason inference stays decidable.',
          breaks: 'The W-Let log line names the quantified variables, or says there were none.'
        },
        {
          name: 'The equations are shown in generation order',
          why: 'That order is why inference blames where it blames, and hiding it would make the error messages seem arbitrary.',
          breaks: 'The equation table is the traversal’s output, unsorted.'
        }
      ],
      complexity: [
        { operation: 'unifying two types', average: 'O(size) with the occurs check', worst: 'O(size²) — the occurs check scans' },
        { operation: 'algorithm W on a term', average: 'near-linear in practice', worst: 'DEXPTIME in principle; a nested let chain can double the type each level' },
        { operation: 'the let-polymorphism fixture', average: '12 equations, 9 fresh variables', worst: 'the same — inference is deterministic' },
        { operation: 'generalisation', average: 'O(free variables of the environment)', worst: 'O(environment size)' },
        { operation: 'instantiation', average: 'O(quantified variables)', worst: 'O(size of the scheme)' }
      ],
      failureModes: [
        {
          symptom: 'An error is reported far from the mistake.',
          cause: 'The checker blames the first unsolvable equation, and "first" follows the traversal.',
          fix: 'Annotate a boundary you believe in. That splits the equation set and moves the blame into the half with the bug.'
        },
        {
          symptom: 'The compiler appears to hang on one file.',
          cause: 'A missing or deferred occurs check building an infinite type.',
          fix: 'Look for self-application or an accidental recursive definition; the check exists precisely to stop this.'
        },
        {
          symptom: 'A polymorphic value stops being polymorphic after a refactor.',
          cause: 'It became lambda-bound rather than let-bound, or fell foul of the value restriction.',
          fix: 'Bind it with let, eta-expand it, or add the annotation the restriction needs.'
        },
        {
          symptom: 'An inferred type is more specific than expected and breaks a caller.',
          cause: 'A use site constrained a variable that should have stayed general.',
          fix: 'Add the intended signature. Inference gives you the principal type of what you wrote, not of what you meant.'
        }
      ],
      inTheWild: [
        'ML, OCaml, Haskell, Elm and F#, all of which run some descendant of algorithm W.',
        'TypeScript and Kotlin, which infer locally and require annotations at boundaries — a deliberate weaker point on the same trade.',
        'Rust’s local inference, which is HM-like inside a function and demands signatures at the edges.',
        'The value restriction, which appears in every ML descendant because generalising a ref cell is unsound.'
      ],
      sources: [
        { title: 'Hindley — The principal type-scheme of an object in combinatory logic (1969)', note: 'principal types' },
        { title: 'Milner — A theory of type polymorphism in programming (1978)', note: 'algorithm W, and let-polymorphism' },
        { title: 'Damas and Milner — Principal type-schemes for functional programs (1982)', note: 'the completeness proof' },
        { title: 'Wright — Simple imperative polymorphism (1995)', note: 'the value restriction, and why the earlier rules were unsound' },
        { title: 'Robinson — A machine-oriented logic based on the resolution principle (1965)', note: 'unification and the occurs check' }
      ]
    },
    'polymorphism-and-system-f': {
      summary: 'Parametricity established by counting: exactly one inhabitant of the identity ' +
        'type, exactly two of the next, none at all of two others — and the rank-2 term that ' +
        'Hindley–Milner cannot type at any cost.',
      intuition: 'Write the quantifier and the instantiation down, gain higher rank and free ' +
        'theorems, and lose decidable inference.',
      formulation: {
        equations: [
          {
            label: 'Inhabitants, enumerated',
            expr: 'type · count · what they are',
            terms: [
              { sym: '∀α. α → α', meaning: '1 · λx0. x0' },
              { sym: '∀α β. α → β → α', meaning: '1 · λx0. λx1. x0' },
              { sym: '∀α. α → α → α', meaning: '2 · λx0. λx1. x0 and λx0. λx1. x1' },
              { sym: '∀α. α', meaning: '0 · the empty type' },
              { sym: '∀α β. α → β', meaning: '0 · no way to make a β' }
            ]
          },
          {
            label: 'Rank 2 against rank 1',
            expr: 'system · term · result',
            terms: [
              { sym: 'System F', meaning: 'λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes) · (∀a. a → a) → Mixed' },
              { sym: 'Hindley–Milner', meaning: 'λid. pair (id 3) (id true) · rejected' },
              { sym: 'the reason', meaning: 'HM quantifies only at let, so a lambda-bound name has one type' },
              { sym: 'the cost of the fix', meaning: 'inference for System F is undecidable (Wells, 1994)' }
            ]
          },
          {
            label: 'Erasure',
            expr: 'typed · erased · characters',
            terms: [
              { sym: 'Λa. λx: a. x', meaning: 'λx. x · 12 → 5' },
              { sym: '(Λa. λx: a. x) [Nat]', meaning: 'λx. x · 20 → 5' },
              { sym: 'Λa. Λb. λx: a. λy: b. x', meaning: 'λx. λy. x · 23 → 9' },
              { sym: 'the rank-2 term', meaning: 'λid. mix (id zero) (id yes) · 51 → 27' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The inhabitant count is claimed complete only when it is',
          why: 'The enumerator builds abstractions and variables, never applications, so it is complete exactly when no assumption could be applied.',
          breaks: 'Each type is tested with a predicate: every argument position must be a bare type variable, and the metric says so.'
        },
        {
          name: 'A rejection carries the reason, not just the verdict',
          why: '"Not a ∀ type" and "expected Nat but the argument is Bool" are different problems.',
          breaks: 'Each rejected fixture asserts a substring of the expected message.'
        },
        {
          name: 'Erasure produces a re-parseable term',
          why: 'A printer that drops the parentheses around an erased lambda produces a string that means something else.',
          breaks: 'Parenthesisation is decided by the erased text, not by the typed term’s shape.'
        },
        {
          name: 'The parametricity fixture is included and rejected',
          why: 'Without it the section would teach that a type abstraction is free.',
          breaks: 'Λa. λx: a. succ x is refused because a is opaque inside the abstraction.'
        }
      ],
      complexity: [
        { operation: 'type checking a System F term', average: 'O(size × type size)', worst: 'type substitution can blow up the printed type' },
        { operation: 'type inference for System F', average: 'undecidable', worst: 'undecidable' },
        { operation: 'enumerating inhabitants to depth 4', average: 'O(branches^depth)', worst: 'capped at 12 results and depth 4' },
        { operation: 'erasure', average: 'O(size)', worst: 'O(size)' },
        { operation: 'β-reduction with two rules', average: 'O(size) per step', worst: 'the term-level rule is the same as the untyped one' }
      ],
      failureModes: [
        {
          symptom: 'A generic call needs an explicit type argument and it is not obvious why.',
          cause: 'Inference could not determine the type parameter from the arguments.',
          fix: 'Supply it. That is what the turbofish and Collections.<String>emptyList() exist for.'
        },
        {
          symptom: 'A function that should be polymorphic in an argument will not type-check.',
          cause: 'The language is rank 1 and the argument is used at two types.',
          fix: 'Enable higher-rank types and annotate, or pass a record of monomorphic functions instead.'
        },
        {
          symptom: 'Runtime reflection over a generic type parameter returns nothing useful.',
          cause: 'The type was erased.',
          fix: 'Pass a class token or a witness value. Erasure is not an implementation accident to work around.'
        },
        {
          symptom: 'A "generic" helper inspects its argument’s type at run time.',
          cause: 'It is ad-hoc polymorphism wearing a parametric signature.',
          fix: 'Say so in the type — a constraint or an interface — so callers and free theorems are not misled.'
        }
      ],
      inTheWild: [
        'Java and C# generics, which are rank 1 with explicit type arguments as the escape.',
        'Haskell’s RankNTypes, which admits higher rank and requires a signature at exactly the point inference gives out.',
        'Rust’s turbofish, which is a type application with syntax.',
        'GHC Core, which is System F with coercions and is what Haskell compiles to after type checking.'
      ],
      sources: [
        { title: 'Girard — Interprétation fonctionnelle et élimination des coupures (1972)', note: 'System F, discovered for proof theory' },
        { title: 'Reynolds — Towards a theory of type structure (1974)', note: 'the independent discovery, and parametricity' },
        { title: 'Wadler — Theorems for free! (1989)', note: 'free theorems, and how to derive one from a signature' },
        { title: 'Wells — Typability and type checking in the second-order lambda-calculus are equivalent and undecidable (1994)', note: 'the undecidability result' },
        { title: 'Mitchell and Plotkin — Abstract types have existential type (1988)', note: 'existentials as modules and interfaces' }
      ]
    },
    'subtyping-and-variance': {
      summary: 'The covariant-array hole found by search with the value that breaks each pair, ' +
        'and the invariant declaration checked to reject both — with the function rule derived ' +
        'in both directions.',
      intuition: 'Accept more, return less. Lift that to a type constructor and you get ' +
        'variance; a parameter you can both read and write is invariant and nothing changes it.',
      formulation: {
        equations: [
          {
            label: 'The unsoundness search',
            expr: 'admitted pair · store a · invariant rejects it',
            terms: [
              { sym: 'CovariantArray<Integer> ≤ CovariantArray<Number>', meaning: 'Double · yes' },
              { sym: 'CovariantArray<Double> ≤ CovariantArray<Number>', meaning: 'Integer · yes' },
              { sym: 'pairs found', meaning: '2, by search rather than by recall' },
              { sym: 'what it is', meaning: 'ArrayStoreException, derived' }
            ]
          },
          {
            label: 'Variance, over the same element types',
            expr: 'container · variance · widen · narrow',
            terms: [
              { sym: 'List', meaning: 'covariant · yes · no' },
              { sym: 'Sink', meaning: 'contravariant · no · yes' },
              { sym: 'Ref and Array', meaning: 'invariant · no · no' },
              { sym: 'Map', meaning: 'invariant in the key, covariant in the value' }
            ]
          },
          {
            label: 'The function rule, both directions',
            expr: 'question · answer · why',
            terms: [
              { sym: 'Number → Integer ≤ Integer → Number', meaning: 'yes · the argument premise is Integer ≤ Number' },
              { sym: 'Integer → Integer ≤ Number → Number', meaning: 'no · it needs Number ≤ Integer' },
              { sym: 'the rule', meaning: 'S₁ → S₂ ≤ T₁ → T₂ requires T₁ ≤ S₁ and S₂ ≤ T₂' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The unsound pairs are found, not listed',
          why: 'A hard-coded example teaches the example; a search teaches the property.',
          breaks: 'Every admitted pair is tested for a value the supertype accepts and the element type does not.'
        },
        {
          name: 'The fix is checked as well as the bug',
          why: 'A rule that only sounds stricter is not a fix.',
          breaks: 'Each witness reports whether the invariant declaration rejects the same pair; both do.'
        },
        {
          name: 'Variance is per parameter',
          why: 'Talking about "a covariant container" leads to the wrong substitutions on a two-parameter type.',
          breaks: 'Map is invariant in one parameter and covariant in the other, and both questions are asked.'
        },
        {
          name: 'The flipped premise is visible in the derivation',
          why: 'Contravariance is the rule everyone recites and few apply; showing the swap is the point.',
          breaks: 'The argument premise is labelled "argument (flipped)" and its two types have swapped sides.'
        }
      ],
      complexity: [
        { operation: 'deciding S ≤ T structurally', average: 'O(size of the types)', worst: 'O(size) for records; invariance doubles the work' },
        { operation: 'the primitive hierarchy walk', average: 'O(depth)', worst: 'O(nodes) — it is a small DAG' },
        { operation: 'the unsoundness search', average: 'O(types²)', worst: '16 pairs over four element types' },
        { operation: 'join of two records', average: 'O(fields)', worst: 'O(fields × field depth)' },
        { operation: 'meet of two records', average: 'O(fields)', worst: '⊥ as soon as one shared field has no common subtype' }
      ],
      failureModes: [
        {
          symptom: 'A callback with a narrower parameter type is accepted and then handed something it cannot handle.',
          cause: 'Bivariant or unchecked parameter variance.',
          fix: 'Ask who supplies the value. Caller-supplied means narrowing is unsafe.'
        },
        {
          symptom: 'ArrayStoreException at run time.',
          cause: 'Java’s covariant arrays admitted a store the element type forbids.',
          fix: 'Use a generic collection, which is invariant and rejects it at compile time.'
        },
        {
          symptom: 'A generic container will not accept a subtype where it obviously should.',
          cause: 'The parameter is invariant because it appears in both input and output positions.',
          fix: 'Split the interface into a read view and a write view, or use a use-site wildcard.'
        },
        {
          symptom: 'A conditional infers a surprisingly wide type.',
          cause: 'The join of the two branch types lost the fields they did not share.',
          fix: 'Annotate the intended type, or make the branches produce the same shape.'
        }
      ],
      inTheWild: [
        'Java arrays, covariant since 1995, with ArrayStoreException as the runtime check that makes it safe.',
        'Scala’s +A and -A and Kotlin’s out and in, which are declaration-site variance.',
        'Java’s ? extends and ? super, which are the same rules stated per use.',
        'TypeScript’s bivariant method parameters and strictFunctionTypes, a documented unsoundness with a documented reason.'
      ],
      sources: [
        { title: 'Cardelli — A semantics of multiple inheritance (1984)', note: 'record subtyping, and the function rule' },
        { title: 'Cardelli and Wegner — On understanding types, data abstraction, and polymorphism (1985)', note: 'bounded quantification, and the survey that named the field' },
        { title: 'Pierce — Types and Programming Languages, chapters 15–16 and 26', note: 'the subtyping rules used here, joins and meets, and bounded quantification' },
        { title: 'Bloch — Effective Java, item on arrays and generics', note: 'the practical consequences of covariant arrays' },
        { title: 'The TypeScript design goals and strictFunctionTypes documentation', note: 'a deliberate unsoundness, stated as such by its designers' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
