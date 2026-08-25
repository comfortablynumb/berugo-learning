/** Worked examples for STLC, inference, System F and subtyping (M27.4-M27.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'the-simply-typed-lambda-calculus': [
      {
        title: 'Progress and preservation, checked by exhaustion',
        goal: 'Turn "well-typed programs do not go wrong" into four counts.',
        setup: 'Every term of depth one over five atoms — 215 of them — plus 2 000 sampled ' +
          'deeper terms, each typed by the nine rules and separately evaluated by the ' +
          'small-step semantics.',
        steps: [
          { do: 'Count the well-typed terms that ran to a value.', why: 'The expected case.',
            work: '224 of them' },
          { do: 'Count the well-typed terms that got stuck.',
            why: 'This is progress, and it must be zero.',
            work: '0 — no well-typed term in the sweep reached a state with no applicable rule' },
          { do: 'Type every intermediate term of every reduction.',
            why: 'This is preservation.',
            work: '400 steps checked, 0 type changes' },
          { do: 'Count the rejected terms that got stuck.',
            why: 'The checker was right about these.',
            work: '1 892 of them' },
          { do: 'Count the rejected terms that ran fine anyway.',
            why: 'The price of static checking.',
            work: '99 — five per cent of all rejections' }
        ],
        answer: 'Zero well-typed terms got stuck and zero steps changed a type, which is ' +
          'soundness measured rather than quoted. The bottom-left cell is the honest one: 99 ' +
          'safe programs are refused, `if true then 0 else true` among them, and no sound ' +
          'checker can accept it without deciding which branch runs.'
      },
      {
        title: 'A derivation, and the first bar that could not be drawn',
        goal: 'Show that a rejection has a location and a rule, not just a verdict.',
        setup: 'Thirteen fixtures, each with an expected verdict and — for the rejected ones — ' +
          'the rule that is expected to fail. The checker must name the same rule.',
        steps: [
          { do: 'Type λf: Number → Number. λx: Number. f (f x).', why: 'The accepted case.',
            work: '(Number → Number) → Number → Number, derivation height 5 with 7 nodes' },
          { do: 'Type (λx: Number. x) true.', why: 'An argument that does not match.',
            work: 'fixture 3 of 13 — T-App: the function expects Number and the argument is Boolean' },
          { do: 'Type if true then 1 else false.', why: 'Branches that disagree.',
            work: 'fixture 6 — T-If: the branches have types Number and Boolean, and both arms must agree' },
          { do: 'Type λx: Number. x x.', why: 'Self-application at a base type.',
            work: 'fixture 11 — T-App: the left side has type Number, which is not a function type' },
          { do: 'Type λr: { a: Number }. r.b.', why: 'A field that is not there.',
            work: 'fixture 13 — T-Proj: the record has no field named b, it has a' }
        ],
        answer: 'All thirteen agree with both the verdict and the expected rule. Asserting the ' +
          'rule name is what makes this a test: a checker that rejected everything for the ' +
          'wrong reason would pass a suite that only asked "was it rejected", and would be ' +
          'useless to a human reading its output.'
      }
    ],
    'type-inference-and-hindley-milner': [
      {
        title: 'One generalisation step decides whether the program exists',
        goal: 'Show what let-polymorphism buys, on the same body twice.',
        setup: 'Two terms with identical bodies. In one, the identity is let-bound; in the ' +
          'other it is a lambda parameter. Neither has any annotation.',
        steps: [
          { do: 'Infer let id = λx. x in pair (id 3) (id true).',
            why: 'The let generalises before the body is checked.',
            work: 'Pair Number Boolean, in 13 rule applications with 12 equations solved' },
          { do: 'Read the W-Let line in the log.', why: 'This is the step that matters.',
            work: 'line 4 of the 13-line log: generalise id : ∀α. α → α' },
          { do: 'Watch the two instantiations.', why: 'Each use gets fresh variables.',
            work: 'lines 6 and 10: id instantiated to δ → δ at one use and to η → η at the other' },
          { do: 'Infer λid. pair (id 3) (id true).',
            why: 'A lambda-bound name is monomorphic.',
            work: 'rejected after 8 of the 12 equations: cannot match Number with Boolean' },
          { do: 'Locate the difference.', why: 'Nothing else about the two terms differs.',
            work: 'both uses constrain 1 variable, which would have to be Number and Boolean ' +
              'at once' }
        ],
        answer: 'Generalising at let, and only at let, is what makes the first program typeable ' +
          'and the second not. That single restriction is also what keeps inference decidable ' +
          'and principal — System F accepts the second term, by making you write the quantifier ' +
          'down and giving up inference.'
      },
      {
        title: 'The two ways unification fails',
        goal: 'Recognise every inference error by which of two failures produced it.',
        setup: 'Six unification problems posed directly, with every recursive call recorded.',
        steps: [
          { do: 'Unify a → b with Number → Boolean.', why: 'Two independent variables.',
            work: '3 calls, 2 bindings: a := Number, b := Boolean' },
          { do: 'Unify a → a with Number → Boolean.', why: 'The same variable twice.',
            work: '4 calls, then a clash: cannot match Number with Boolean' },
          { do: 'Unify a with a → b.', why: 'The occurs check.',
            work: '1 call: a appears inside a → b, so the equation has no finite solution' },
          { do: 'Unify List a with Pair a b.', why: 'Different constructors.',
            work: '1 call, then a clash: cannot match List a with Pair a b' },
          { do: 'Unify (a → b) → a with (Number → c) → d.', why: 'Bindings that chain.',
            work: '3 bindings: a := Number, b := c, d := Number' }
        ],
        answer: 'Every failure is one of exactly two: a constructor clash, where two rigid ' +
          'constructors met, or the occurs check, where a variable would have to contain ' +
          'itself. Knowing which one you are looking at tells you whether the fix is a type ' +
          'mismatch to correct or a recursive structure the type language cannot express.'
      },
      {
        title: 'Reading the equation list to understand a bad error message',
        goal: 'See why inference blames the place it blames.',
        setup: 'The equation list for the let-polymorphism fixture, printed in the order the ' +
          'traversal produced it.',
        steps: [
          { do: 'Count the fresh variables.', why: 'One per binder and per application.',
            work: '9 invented for a term of size 12' },
          { do: 'Count the equations.', why: 'These are the constraints.',
            work: '12, solved in order' },
          { do: 'Look at equation 1.', why: 'The first application.',
            work: 'δ → δ against Number → ε, from applying id to 3' },
          { do: 'Look at equation 7.', why: 'The second use of id, with different variables.',
            work: 'equation 7 of 12: η → η against Boolean → θ' },
          { do: 'Ask what would happen without generalisation.',
            why: 'The two uses would share a variable.',
            work: 'equation 7 would be δ → δ against Boolean → θ, and δ is already Number' }
        ],
        answer: 'The checker reports the first equation it cannot solve, and "first" is decided ' +
          'by the traversal, not by which line you typed wrong. That is why a mistake in one ' +
          'function surfaces inside a caller three modules away — and why adding an annotation ' +
          'at a boundary you believe in splits the list and moves the blame into the half that ' +
          'contains the mistake.'
      }
    ],
    'polymorphism-and-system-f': [
      {
        title: 'Counting what a polymorphic type can contain',
        goal: 'Establish parametricity by enumeration rather than by argument.',
        setup: 'For each type, every closed normal form is built up to a depth bound and ' +
          'printed. The count is only claimed as complete when every argument position of the ' +
          'type is a bare type variable, so nothing in scope can be applied to anything.',
        steps: [
          { do: 'Enumerate ∀α. α → α.', why: 'The identity type.',
            work: '1 inhabitant: λx0. x0' },
          { do: 'Enumerate ∀α β. α → β → α.', why: 'Two arguments, one usable.',
            work: '1 inhabitant: λx0. λx1. x0' },
          { do: 'Enumerate ∀α. α → α → α.', why: 'Two arguments of the same type.',
            work: '2 inhabitants: λx0. λx1. x0 and λx0. λx1. x1' },
          { do: 'Enumerate ∀α. α.', why: 'Nothing to build one from.',
            work: '0 inhabitants — this is the empty type' },
          { do: 'Enumerate ∀α β. α → β.', why: 'An argument of the wrong type.',
            work: '0 inhabitants: there is no way to make a β' }
        ],
        answer: 'A closed term of `∀α. α → α` has no operation available on its argument, so it ' +
          'can only return it — and the count says one, not "essentially one". The two empty ' +
          'types are the same fact from the other side, and they are why `never` and `!` in ' +
          'real languages are machine-checked promises that a function does not return.'
      },
      {
        title: 'The term Hindley–Milner cannot type, and what it costs to accept it',
        goal: 'Locate the rank boundary precisely.',
        setup: 'The same program written twice: once with the quantifier written down and the ' +
          'instantiations explicit, once with nothing written at all.',
        steps: [
          { do: 'Type λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes) in System F.',
            why: 'The argument carries its own quantifier.',
            work: '(∀a. a → a) → Mixed, in 12 rule applications at height 6' },
          { do: 'Infer λid. pair (id 3) (id true) with algorithm W.',
            why: 'The same shape with nothing written.',
            work: 'rejected after 8 equations: cannot match Number with Boolean' },
          { do: 'Name the rank of each.', why: 'This is the whole difference.',
            work: 'rank 2 — a ∀ to the left of an arrow — against rank 1' },
          { do: 'Ask what recovering the annotation would take.',
            why: 'It is not an engineering gap.',
            work: 'inference for System F is undecidable (Wells, 1994)' },
          { do: 'Erase the System F term.', why: 'See what actually runs.',
            work: '51 characters become 27: λid. mix (id zero) (id yes)' }
        ],
        answer: 'The two rows are the same program, and the difference is entirely in what the ' +
          'type language can say. Every language with generics has made this trade: stay at ' +
          'rank 1 and keep inference, or admit higher rank and demand annotations exactly where ' +
          'inference gives out.'
      },
      {
        title: 'What erasure removes',
        goal: 'Measure the claim that types have no runtime cost.',
        setup: 'Seven well-typed System F terms, each erased to an untyped lambda term by ' +
          'deleting every annotation, every Λ and every type application.',
        steps: [
          { do: 'Erase Λa. λx: a. x.', why: 'The polymorphic identity.',
            work: '12 characters become 5: λx. x' },
          { do: 'Erase (Λa. λx: a. x) [Nat].', why: 'A specialisation.',
            work: '20 characters become the same 5: λx. x' },
          { do: 'Compare those two erasures.', why: 'They differ before erasure.',
            work: 'both erase to the same 5 characters, and their types were ∀a. a → a and ' +
              'Nat → Nat' },
          { do: 'Erase the rank-2 term.', why: 'The largest fixture.',
            work: '51 characters become 27' },
          { do: 'Erase Λa. Λb. λx: a. λy: b. x.', why: 'Two type abstractions.',
            work: '23 characters become 9: λx. λy. x' }
        ],
        answer: 'Every type application vanishes and the structure stays. That is exactly Java\'s ' +
          'generic erasure, and it is why `List<String>` and `List<Integer>` are the same class ' +
          'at run time — and why any reflection over a type parameter needs something added ' +
          'back, a class token or a witness value.'
      }
    ],
    'subtyping-and-variance': [
      {
        title: 'Finding the covariant-array hole rather than recalling it',
        goal: 'Produce a witness for an unsound rule by search.',
        setup: 'For every pair the covariant rule admits, ask whether some value the SUPERTYPE ' +
          'accepts is not accepted by the narrower element type. If one exists, storing it ' +
          'through the wider view is a write that must fail at run time.',
        steps: [
          { do: 'Check CovariantArray<Integer> ≤ CovariantArray<Number>.',
            why: 'The rule admits it.',
            work: 'accepted by S-Generic, covariant in parameter 1' },
          { do: 'Search for a value the Number view accepts and Integer does not.',
            why: 'This is the witness.',
            work: '1 witness: Double — writing one through the Number view puts it in an array ' +
              'of Integer' },
          { do: 'Check the other admitted pair.', why: 'One witness could be a fluke.',
            work: 'a 2nd pair: CovariantArray<Double> ≤ CovariantArray<Number>, breaking on ' +
              'Integer' },
          { do: 'Ask whether the invariant declaration rejects both.',
            why: 'A fix that only sounds stricter is not a fix.',
            work: 'yes for both of the 2 — Array<Integer> ≤ Array<Number> is refused' },
          { do: 'Count the unsound pairs.', why: 'The metric the section reports.',
            work: '2 found by search, each with the value that breaks it' }
        ],
        answer: 'This is `ArrayStoreException`, derived instead of remembered. It was a ' +
          'deliberate 1995 trade — polymorphic array methods before generics existed — and the ' +
          'runtime check is the interest payment. The last column is what makes it a proper ' +
          'experiment: the invariant version refuses both pairs.'
      },
      {
        title: 'The argument position genuinely flips',
        goal: 'Apply the function rule in both directions and watch one fail.',
        setup: 'Two subtyping questions over the same four types, with the derivation printed ' +
          'so the flipped premise is visible.',
        steps: [
          { do: 'Ask whether Number → Integer ≤ Integer → Number.',
            why: 'Accepts more, returns less.',
            work: 'yes, by S-Arrow, with 2 premises' },
          { do: 'Read the argument premise.', why: 'It points the other way.',
            work: 'premise 1 of 2 is Integer ≤ Number — the two types have swapped sides' },
          { do: 'Ask whether Integer → Integer ≤ Number → Number.',
            why: 'The direction people expect.',
            work: 'no, and 1 premise is why: it needs Number ≤ Integer, which the hierarchy ' +
              'does not give' },
          { do: 'Check the four container variances on the same element types.',
            why: 'The same rule, lifted.',
            work: 'all 4 differ: List widens and does not narrow; Sink narrows and does not ' +
              'widen; Ref and Array do neither' },
          { do: 'Check Map in both parameters.', why: 'Variance is per parameter.',
            work: '1 of the 2 holds: Map<String, Integer> ≤ Map<String, Number> does, and ' +
              'Map<Integer, Integer> ≤ Map<Number, Number> does not' }
        ],
        answer: 'A function that accepts a narrower type cannot stand in for one that accepts a ' +
          'wider one, because the caller may pass something it refuses. The test that settles ' +
          'it every time: ask who supplies the value. If the caller supplies it, narrowing is ' +
          'unsafe; if the function returns it, narrowing is fine.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
