/** Concepts for STLC, inference, System F and subtyping (M27.4-M27.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'the-simply-typed-lambda-calculus': [
      {
        term: 'The typing judgement',
        plain: 'In this context, this expression has this type.',
        formal: 'Γ ⊢ e : τ',
        readAs: 'Given the assumptions listed in gamma about the free variables, the ' +
          'expression e can be shown to have the type tau.',
        detail: 'Γ is the list of assumptions about free variables, and it is the part people ' +
          'skip when reading rules. It grows going under a binder — that is the entire content ' +
          'of T-Abs — and it is consumed by T-Var. Every rule in the system either extends it, ' +
          'consumes it, or passes it through unchanged, and noticing which is happening is how ' +
          'you read an unfamiliar rule set quickly.',
        example: 'The derivation for the twice combinator shows the context growing from ∅ to ' +
          '`f: Number → Number, x: Number` as it descends.'
      },
      {
        term: 'T-App demands equality, not compatibility',
        plain: 'Applying a σ → τ to a σ gives a τ, and the argument type must match exactly.',
        formal: 'Γ ⊢ f : σ → τ and Γ ⊢ a : σ imply Γ ⊢ f a : τ',
        readAs: 'If the left side is a function from sigma to tau and the right side is a ' +
          'sigma, then applying one to the other gives a tau.',
        detail: 'Simple types have no subtyping and no coercion, so "match" means the same type. ' +
          'That is why nearly every rejection in the fixture table is T-App or T-If failing an ' +
          'equality, and it is also the rule that a language relaxes when it adds subsumption — ' +
          'the next-but-one section is entirely about what changes when it does.',
        example: '`(λx: Number. x) true` is rejected by T-App: the function expects Number and ' +
          'the argument is Boolean.'
      },
      {
        term: 'Checking is easy, inference is a different problem',
        plain: 'With every binder annotated, the type is determined bottom-up in one pass.',
        formal: 'no search, no unification, no backtracking',
        detail: 'That is the trade every language makes when it decides how much annotation to ' +
          'require. Full annotation makes the checker a fold over the syntax tree; removing the ' +
          'annotations needs the machinery of the next section, and removing more than that ' +
          'makes the problem undecidable. Most real languages sit in the middle: annotate ' +
          'parameters, infer locals.',
        example: 'The demo derives a type for the twice combinator in seven rule applications ' +
          'with no search anywhere.'
      },
      {
        term: 'Progress',
        plain: 'A well-typed term is a value or can take a step. It is never stuck.',
        formal: 'if ⊢ e : τ then e is a value or there is some e′ with e → e′',
        readAs: 'Any well-typed term is either already a finished value, or there is some term ' +
          'it can step to; it is never left with no rule to apply.',
        detail: 'This is half of soundness, and it is the half that says a type error is not a ' +
          'runtime crash waiting to happen. Checking it means typing and running every term ' +
          'rather than trusting the proof, and the count that matters is the number of ' +
          'well-typed terms that got stuck — which must be zero, or the rules are wrong.',
        example: 'Two hundred and twenty-four well-typed terms were run and none got stuck.'
      },
      {
        term: 'Preservation',
        plain: 'Taking a step does not change the type.',
        formal: 'if ⊢ e : τ and e → e′ then ⊢ e′ : τ',
        readAs: 'If a well-typed term takes a step, whatever it steps to still has the same ' +
          'type it started with.',
        detail: 'Progress alone would only tell you the first step is safe. Preservation is what ' +
          'lets you apply progress again to the result, so induction carries the guarantee all ' +
          'the way to the end. The two together are what "well-typed programs do not go wrong" ' +
          'means, and neither is enough on its own.',
        example: 'Every intermediate term of every reduction in the sweep was typed: four ' +
          'hundred steps, zero type changes.'
      },
      {
        term: 'Every sound type system rejects programs that would have worked',
        plain: 'Conservatism is forced, not a design flaw.',
        formal: 'deciding "does this go wrong" exactly is undecidable, so a decidable checker must err',
        detail: 'The demo counts the false alarms rather than mentioning them: terms the checker ' +
          'refuses that ran to a value anyway. `if true then 0 else true` is one, and no sound ' +
          'checker can accept it without deciding which branch runs. What a language chooses is ' +
          'not whether to reject safe programs but WHICH ones, and every feature — union types, ' +
          'flow typing, refinement — is a bid to reject fewer.',
        example: 'Ninety-nine of one thousand nine hundred and ninety-one rejections in the ' +
          'default sweep would have run fine — five per cent.'
      },
      {
        term: 'Strong normalisation, and what it costs',
        plain: 'Every well-typed term terminates, so the language is not Turing-complete.',
        formal: 'λx. x x cannot be typed at any type, so the Y combinator is not expressible',
        readAs: 'Self-application would need one argument to be both a value and a function ' +
          'taking that value, which no simple type can say, so no fixed-point combinator can be written.',
        detail: 'Self-application would need the argument to be both `σ` and `σ → τ` at once, ' +
          'and simple types cannot say that. Losing it means losing general recursion, which is ' +
          'a wonderful property for a proof language and a fatal one for a programming ' +
          'language. Every practical descendant adds a fixed-point operator back and gives up ' +
          'the theorem deliberately.',
        example: '`λx: Number. x x` is rejected by T-App, because x is a Number and a Number is ' +
          'not a function.'
      },
      {
        term: 'Curry–Howard: these rules are already a logic',
        plain: 'Read → as implication and a type as a proposition.',
        formal: 'T-Abs is implication introduction; T-App is modus ponens',
        detail: 'A term of type τ is a proof of τ, and normalising the term is simplifying the ' +
          'proof. That is not an analogy that happens to work — it is the same set of rules ' +
          'read twice. It is why proof assistants are programming languages, why an ' +
          'uninhabited type corresponds to an unprovable proposition, and why "the type is the ' +
          'specification" is a technical claim rather than a slogan.',
        example: '`∀α. α` has no inhabitants, and read as a proposition it says "everything is ' +
          'true", which is exactly as unprovable.'
      },
      {
        term: 'A rejection needs a rule name and a location',
        plain: 'Naming the first rule that could not be applied is what makes an error usable.',
        formal: 'the derivation has exactly one first bar that could not be drawn',
        detail: 'A checker returning a boolean is correct and useless. The fixture table asserts ' +
          'the rule name for each rejected term precisely so that a checker rejecting ' +
          'everything for the wrong reason fails the test — testing only "was it rejected" ' +
          'would pass such a checker, which is the difference between a test and a formality.',
        example: 'All thirteen fixtures agree with both the verdict and the expected failing ' +
          'rule.'
      }
    ],
    'type-inference-and-hindley-milner': [
      {
        term: 'Unification solves equations between types',
        plain: 'Walk both trees in step; bind a variable when it meets something.',
        formal: 'unify(α, τ) binds α := τ; unify(C σ̄, C τ̄) unifies the arguments pairwise',
        readAs: 'A type variable meeting anything gets bound to it; two type constructors must ' +
          'have the same name and then their arguments are matched up one by one.',
        detail: 'There are exactly two ways to fail — a constructor clash and the occurs check — ' +
          'and knowing both is enough to read almost any inference error you will meet. ' +
          'Everything else in algorithm W is bookkeeping around this one procedure, which is ' +
          'why implementing unification correctly is most of implementing inference.',
        example: '`(a → b) → a` against `(Number → c) → d` yields three bindings: a := Number, ' +
          'b := c, d := Number.'
      },
      {
        term: 'The occurs check',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["unify a with (a → b)"] --> B{"does the variable appear<br/>inside the type?"}',
            '    B -->|yes| C["binding it would build<br/>an infinite type"]',
            '    C --> D["reject — this is the error"]',
            '    B -->|no| E["bind it and carry on"]',
            '    D --> F["skip the check and the inferencer<br/>loops or blows the stack"]'
          ].join('\n'),
          caption: 'It is three lines that almost never fire, and without them a self-application makes the compiler hang rather than report a type error.'
        },
        plain: 'A variable cannot be bound to a type that contains it.',
        formal: 'unify(α, α → β) fails, because no finite type satisfies it',
        readAs: 'Trying to make a variable equal to a type that already contains that variable ' +
          'has no solution, because any answer would have to contain itself forever.',
        detail: 'Without it the checker builds a cyclic structure and then hangs, or prints a ' +
          'type forever. `λx. x x` demands exactly this equation. When a compiler appears to be ' +
          '"stuck on one file", a missing or deferred occurs check is a common cause — and ' +
          'languages that permit equi-recursive types have to decide deliberately where to stop ' +
          'instead.',
        example: 'The demo reports "α appears inside α → β, so the equation has no finite ' +
          'solution" rather than looping.'
      },
      {
        term: 'Substitution composition',
        plain: 'Applying one substitution after another means updating the first one too.',
        formal: '(S₂ ∘ S₁)(α) = S₂(S₁(α)), and every value in S₁ is passed through S₂',
        readAs: 'Composing two substitutions means applying the first and then the second, and ' +
          'updating every answer the first one already gave so it reflects the second.',
        detail: 'Skip the update and a variable bound early stops receiving later information, ' +
          'so the final type is stale — the classic implementation bug, and one that produces ' +
          'plausible wrong types rather than errors. It is also why the substitution can be ' +
          'applied in a single pass afterwards: composition keeps it idempotent, so chasing a ' +
          'binding twice is unnecessary and would risk looping.',
        example: 'Twelve equations are solved for the let-polymorphism fixture, each composed ' +
          'into the result before the next is generated.'
      },
      {
        term: 'Generalisation happens at let, and only there',
        plain: 'Quantify the variables free in the type but not in the environment.',
        formal: 'gen(Γ, τ) = ∀ᾱ. τ where ᾱ = FV(τ) minus FV(Γ)',
        readAs: 'Quantify over the type variables free in tau that the environment does not mention.',
        detail: 'Those are exactly the variables the definition does not constrain, so a use ' +
          'site is free to pick. A lambda-bound name gets no such treatment because the ' +
          'argument has one type, chosen by the caller. This single restriction is what keeps ' +
          'inference decidable and principal, and it is the whole reason the two fixtures in ' +
          'the contrast table behave differently.',
        example: '`let id = λx. x in pair (id 3) (id true)` infers `Pair Number Boolean`; the ' +
          'lambda-bound version is rejected.'
      },
      {
        term: 'Instantiation gives every use its own variables',
        plain: 'Reopen a scheme fresh at each use site.',
        formal: 'inst(∀ᾱ. τ) replaces each α with a new variable',
        readAs: 'Every use of a generalised definition gets its own brand-new type variables, ' +
          'so two uses can never constrain each other by accident.',
        detail: 'This is what lets one definition serve two types: `id 3` and `id true` ' +
          'constrain different variables and never meet. Remove generalisation and both uses ' +
          'constrain the SAME variable, so it would have to be Number and Boolean at once. The ' +
          'log in the demo prints each instantiation, so the fresh variables are visible as ' +
          'they are created.',
        example: 'The log shows id instantiated to δ → δ at one use and to η → η at the other.'
      },
      {
        term: 'Principal types',
        plain: 'The inferred type is the most general one; every other valid typing is an instance.',
        formal: 'if Γ ⊢ e : τ then τ is an instance of the principal type W returns',
        readAs: 'Whatever type an expression could legitimately have, it is a specialisation ' +
          'of the single most general type the algorithm returns for it.',
        detail: 'This is a strong guarantee and it is why the demo can print one answer rather ' +
          'than a set. `Number → Number` is a specialisation of `∀α. α → α`, not a competitor. ' +
          'Principality is also what makes separate compilation possible: a library can be ' +
          'typed without seeing any of its callers, because the type it gets is the one that ' +
          'accommodates all of them.',
        example: 'Twelve fixtures each assert an exact scheme, not merely that inference ' +
          'succeeded.'
      },
      {
        term: 'The value restriction',
        plain: 'Do not generalise a binding that could allocate mutable state.',
        formal: 'ML generalises only when the right-hand side is a syntactic value',
        detail: 'Generalising `let r = ref [] in ...` would let one write happen at Int and one ' +
          'read at String through the same cell. The restriction is blunt — it rejects some ' +
          'safe programs — and it is the simplest rule anyone has found that is sound. Every ML ' +
          'descendant carries it, and it is the reason a polymorphic empty collection sometimes ' +
          'needs an annotation.',
        example: 'It does not appear in the demo\'s pure language, and it is the first thing a ' +
          'real implementation must add.'
      },
      {
        term: 'Inference errors are bad for a structural reason',
        plain: 'The checker reports the first equation it cannot solve, wherever the walk reached it.',
        formal: 'the blamed location is decided by the traversal order, not by where the mistake is',
        detail: 'A mistyped argument in one function surfaces as a clash inside a caller three ' +
          'modules away, because that is where the two constraints finally met. The technique ' +
          'that follows is to annotate a boundary you believe in: that splits the equation set ' +
          'in two, and the error moves into the half that actually contains the mistake.',
        example: 'The equations table prints them in generation order, which is the order the ' +
          'blame follows.'
      },
      {
        term: 'Rank-1 polymorphism is the boundary HM keeps',
        plain: 'The quantifier is always outermost, so an argument can never be polymorphic.',
        formal: '∀α. α → α is rank 1; (∀α. α → α) → Nat is rank 2',
        readAs: 'A quantifier at the very front is rank one; a quantifier sitting to the left ' +
          'of an arrow, so that an argument is itself polymorphic, is rank two.',
        detail: 'That restriction is exactly what makes the inference problem decidable, and it ' +
          'is exactly what rejects the lambda-bound identity used at two types. The next ' +
          'section takes the restriction away, writes the quantifier down, and pays with ' +
          'undecidable inference — which is a fair summary of the whole trade.',
        example: 'The same body is accepted with a written ∀ in System F and rejected by ' +
          'inference here.'
      }
    ],
    'polymorphism-and-system-f': [
      {
        term: 'Type abstraction and type application',
        plain: 'Λα. e abstracts over a type; e [T] supplies one.',
        formal: 'Γ, α ⊢ e : τ implies Γ ⊢ Λα. e : ∀α. τ',
        readAs: 'If the body has type tau with alpha in scope, the type abstraction has type for-all alpha tau.',
        detail: 'These are the two operations Hindley–Milner hides. Writing them down buys ' +
          'higher-rank types, Church encodings of every data type, and existentials; it costs ' +
          'the ability to recover them automatically. Every explicit type argument you have ' +
          'ever written — a turbofish, a diamond you had to fill in, a `<String>` before a ' +
          'method name — is this construct surfacing.',
        example: '`(Λa. λx: a. x) [Nat]` has type `Nat → Nat`, and the specialisation is ' +
          'recorded in the term.'
      },
      {
        term: 'Inference for System F is undecidable',
        plain: 'A theorem, not an engineering gap.',
        formal: 'Wells, 1994: typability in System F is undecidable',
        detail: 'That is why no language offers full System F with full inference, and why ' +
          'every language with higher-rank types requires an annotation exactly where inference ' +
          'gives out. Haskell gates rank-N types behind an extension and demands a signature; ' +
          'Java and C# stay at rank 1 and offer explicit type arguments as the escape hatch.',
        example: 'The rank table shows one term typed in System F and rejected by inference in ' +
          'the same page.'
      },
      {
        term: 'Rank is where the quantifier appears',
        plain: 'A ∀ to the left of an arrow makes the argument polymorphic.',
        formal: '(∀α. α → α) → Mixed is rank 2, because the argument carries its own quantifier',
        readAs: 'When the quantifier sits inside an argument type, it is the function rather ' +
          'than the caller that picks which types to use it at, and it may pick several.',
        detail: 'Rank 1 means the caller picks one type and the function uses it uniformly. ' +
          'Rank 2 means the FUNCTION picks, possibly several times, so a rank-2 argument can be ' +
          'used at Nat and at Bool in the same body. That is a genuinely different ' +
          'capability, and it is the one Hindley–Milner cannot express at any cost.',
        example: '`λid: ∀a. a → a. mix (id [Nat] zero) (id [Bool] yes)` uses its argument at two ' +
          'types.'
      },
      {
        term: 'Parametricity: a type restricts what a term can do',
        plain: 'A closed term of ∀α. α → α has no operation on its argument, so it can only return it.',
        formal: 'the type has exactly one closed normal form',
        detail: 'This is a theorem about the type, not a convention about the implementation, ' +
          'and it is checkable: enumerate the closed normal forms and count them. The demo does ' +
          'exactly that and states when the enumeration is complete — which is when every ' +
          'argument position is a bare type variable, since then nothing in scope can be ' +
          'applied to anything.',
        example: '`∀α. α → α` has one inhabitant, `∀α. α → α → α` has two, and `∀α. α` has none.'
      },
      {
        term: 'Free theorems',
        plain: 'What a signature guarantees before you read the body.',
        formal: '∀α. List α → List α can only permute, drop and duplicate — never inspect',
        readAs: 'A function polymorphic in the element type has no operation available on the ' +
          'elements, so it can only move them about, discard them or repeat them.',
        detail: 'The function cannot compare elements, print them or invent one, because α ' +
          'could be anything. That narrows a code review from "read every line" to "check the ' +
          'index arithmetic", and it is the practical reason to make a helper generic when it ' +
          'does not need to inspect its argument: genericity is a machine-checked statement ' +
          'that the helper does not care.',
        example: '`Λa. λx: a. succ x` is rejected precisely because it tries to inspect its type ' +
          'parameter.'
      },
      {
        term: 'Existential types are interfaces',
        plain: 'There exists some representation, together with these operations over it.',
        formal: '∃α. τ is definable as ∀β. (∀α. τ → β) → β',
        readAs: 'An existential is a function that hands a representation to a consumer that is polymorphic in it.',
        detail: 'The consumer is polymorphic in α, so it has no operation on the representation ' +
          'except those the package provided — which is where information hiding comes from. ' +
          'It is not enforced by a visibility keyword but by parametricity, and that is why ' +
          'casting past a module boundary is a hole in the type system rather than a feature of ' +
          'the language.',
        example: 'A module signature, a Java interface and a Rust `dyn Trait` are all this ' +
          'encoding with different syntax.'
      },
      {
        term: 'Types erase, and the erased term is what runs',
        plain: 'Λ and [T] vanish; the annotations vanish; the structure stays.',
        formal: 'erase(Λα. e) = erase(e);  erase(e [T]) = erase(e)',
        readAs: 'Erasing a type abstraction leaves just its body, and erasing a type ' +
          'application leaves just the term it was applied to; the types vanish and the structure stays.',
        detail: 'This is what "types have no runtime cost" means precisely, and it is exactly ' +
          'Java\'s generic erasure. It also explains the consequence people trip over: after ' +
          'erasure `List<String>` and `List<Integer>` are the same class, so any reflection ' +
          'over a type parameter needs something added back — a class token, a reified ' +
          'generic, a witness value.',
        example: 'Two of the demo\'s fixtures have different typed forms and identical erasures.'
      },
      {
        term: 'Ad-hoc polymorphism is a different mechanism',
        plain: 'Parametric works on every type because it cannot inspect them; ad-hoc must inspect.',
        formal: 'a type class picks an implementation per type; a ∀ picks none',
        readAs: 'Ad-hoc polymorphism chooses a different body depending on the type it meets, ' +
          'while parametric polymorphism uses one body that cannot look at the type at all.',
        detail: 'That is why the two have opposite properties. Parametric polymorphism gives ' +
          'free theorems and costs nothing at run time; ad-hoc polymorphism gives per-type ' +
          'behaviour and costs a dictionary. Neither is better — they answer different ' +
          'questions — and the next section makes the cost of the second one concrete.',
        example: '`∀α. α → String` has no inhabitants; `Show a => a → String` has one per ' +
          'instance.'
      },
      {
        term: 'The empty type is uninhabited, and that is useful',
        plain: 'A function that claims to return one can only diverge or throw.',
        formal: '∀α. α has zero closed normal forms',
        readAs: 'There is no closed term at all of the type that promises to produce a value ' +
          'of every type, which is why a function claiming to return one cannot return normally.',
        detail: 'That is a genuinely load-bearing fact in modern languages: Rust\'s `!` and ' +
          'TypeScript\'s `never` are this type, and a signature returning it is a machine-' +
          'checked promise that the function does not return normally. The enumeration in the ' +
          'demo is where the claim comes from rather than a definition asserting it.',
        example: 'Both `∀α. α` and `∀α β. α → β` come back with zero inhabitants.'
      }
    ],
    'subtyping-and-variance': [
      {
        term: 'Subsumption',
        plain: 'A value of a subtype may be used wherever the supertype is expected.',
        formal: 'if Γ ⊢ e : S and S ≤ T then Γ ⊢ e : T',
        detail: 'This one rule is what makes subtyping a feature rather than a relation nobody ' +
          'consults. Everything else in the section is about deciding `≤`, and every design ' +
          'decision about variance is really a decision about which uses subsumption should ' +
          'permit. Note that it makes typing non-syntax-directed, which is why a real checker ' +
          'inlines it into the other rules rather than applying it freely.',
        example: 'An `Integer` is usable as a `Number` anywhere in the demo\'s hierarchy.'
      },
      {
        term: 'Width, depth and permutation for records',
        plain: 'More fields is a subtype; each field may be a subtype; order does not matter.',
        formal: '{x: Integer, y: Integer, c: String} ≤ {x: Number, y: Number}',
        detail: 'All three fall out of one check: every field the supertype names must be ' +
          'present and a subtype. A record with extra fields satisfies every requirement and ' +
          'then some, which is why width subtyping is safe. Nominal systems refuse this — a ' +
          'class must declare its supertype — and structural systems accept it, which is the ' +
          'main difference between Java and TypeScript in practice.',
        example: 'The demo derives all three from S-RcdWidth and S-RcdDepth alone.'
      },
      {
        term: 'Function subtyping flips the argument',
        plain: 'Accept at least as much; return at most as much.',
        formal: 'S₁ → S₂ ≤ T₁ → T₂ requires T₁ ≤ S₁ and S₂ ≤ T₂',
        readAs: 'A function is a subtype of another when its argument type is a supertype and its result type is a subtype.',
        detail: 'It follows from substitutability. The caller was promised it could pass a T₁, ' +
          'so the replacement must accept T₁ — accepting more is fine. The caller was promised ' +
          'a T₂ back, so the replacement may return something more specific. Applying it ' +
          'backwards is the single most common variance mistake, and it is always in the same ' +
          'direction: narrowing a callback parameter because the narrower type looks "more ' +
          'precise".',
        example: '`Number → Integer ≤ Integer → Number` holds; `Integer → Integer ≤ Number → ' +
          'Number` does not.'
      },
      {
        term: 'Variance is the function rule lifted to a constructor',
        plain: 'Read-only positions are covariant, write-only contravariant, both invariant.',
        formal: 'List<Integer> ≤ List<Number>;  Sink<Number> ≤ Sink<Integer>;  Ref is neither',
        detail: 'Nothing about a container decides its variance except where its parameter ' +
          'appears. A parameter in an output position only can be widened; in an input position ' +
          'only it can be narrowed; in both it can be neither, because widening breaks the ' +
          'writes and narrowing breaks the reads. That is why a mutable cell is invariant and ' +
          'no amount of design cleverness changes it.',
        example: 'The variance table shows all four behaviours over the same element types.'
      },
      {
        term: 'Variance is per parameter, not per type',
        plain: 'A Map can be invariant in its key and covariant in its value.',
        formal: 'Map<String, Integer> ≤ Map<String, Number>, but Map<Integer, Integer> is not below Map<Number, Number>',
        detail: 'Talking about "a covariant container" is a category error that leads people to ' +
          'expect the wrong substitutions. Each parameter has its own variance, decided by ' +
          'where it appears in the container\'s operations, and a single type can carry all ' +
          'three. Reading a generic declaration means reading each parameter separately.',
        example: 'The demo shows both Map questions, one accepted and one rejected, for exactly ' +
          'that reason.'
      },
      {
        term: 'Declaration-site versus use-site variance',
        plain: 'Say it once on the container, or say it at every use.',
        formal: 'Scala List[+A] and Kotlin out A against Java List<? extends Number>',
        detail: 'Same rule, different place to write it. Declaration-site is stated once and ' +
          'every use follows; use-site is repeated at each use, which is noisier and lets a ' +
          'single container be used covariantly in one place and invariantly in another. Java ' +
          'has no declaration-site variance, which is why its generic signatures are full of ' +
          'wildcards.',
        example: 'The demo declares variance per container, which is the declaration-site form.'
      },
      {
        term: 'Java\'s covariant arrays are a hole plugged at run time',
        plain: 'Object[] a = new String[1] compiles, and storing into it can throw.',
        formal: 'CovariantArray<Integer> ≤ CovariantArray<Number> admits storing a Double',
        detail: 'It was a deliberate 1995 trade — polymorphic array methods before generics ' +
          'existed — and `ArrayStoreException` is the interest payment. The demo does not quote ' +
          'the bug: it searches every pair the covariant rule admits and asks whether some ' +
          'value the supertype accepts cannot go in the narrower container, which produces the ' +
          'witness rather than recalling it.',
        example: 'Two pairs come back with a witness, and the invariant declaration rejects both.'
      },
      {
        term: 'Joins and meets',
        plain: 'The least common supertype, and the greatest common subtype.',
        formal: 'Integer ⊔ Double = Number; two records join to the fields they share',
        detail: 'A join is what a language must infer for a conditional whose branches differ, ' +
          'and the record case shows what it costs: information is lost the moment two shapes ' +
          'diverge. A meet with a conflicting field is ⊥, because nothing can be both an ' +
          'Integer and a Double there — which is why an intersection type in a real language is ' +
          'either rejected or quietly uninhabited.',
        example: 'The demo computes both for four pairs, including the two record cases.'
      },
      {
        term: 'Bounded quantification joins subtyping to polymorphism',
        plain: 'Polymorphic over everything below a bound.',
        formal: '∀α ≤ Number. α → α',
        readAs: 'For every type alpha that is a subtype of Number, a function from alpha to alpha.',
        detail: 'The body may use Number operations because the bound guarantees them, and the ' +
          'result keeps the caller\'s exact type rather than widening to Number. That is ' +
          '`<T extends Number>`, and it is the reason generics and subtyping have to be ' +
          'designed together: adding either to a language that already has the other changes ' +
          'both.',
        example: 'The demo\'s primitive hierarchy is what a bound would range over.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
