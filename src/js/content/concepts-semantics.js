/** Concepts for type classes, ADTs, Hoare logic and ownership (M27.8-M27.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'beyond-plain-generics': [
      {
        term: 'A constraint is an argument',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a function with a constraint"] --> B["compiled to a function taking<br/>one extra parameter"]',
            '    B --> C["that parameter is a record<br/>of the method implementations"]',
            '    C --> D["the call site chooses which<br/>record to pass"]',
            '    D --> E["so a type-class constraint is<br/>an ordinary argument you<br/>did not have to write"]'
          ].join('\n'),
          caption: 'Once the dictionary is visible the magic goes away: constraint resolution is the compiler working out which record to pass, and an ambiguous constraint is it failing to.'
        },
        plain: 'Eq a => becomes a record of method implementations passed at every call site.',
        formal: 'equals :: Eq a => a → a → Bool elaborates to equals :: EqDict a → a → a → Bool',
        detail: 'Once you see that, "what does a type class cost at run time" has a concrete ' +
          'answer: one extra argument and one field lookup, unless the compiler specialises it ' +
          'away. It also explains why a constrained signature is a commitment — a library that ' +
          'exposes one has committed its callers to supplying that argument forever, and ' +
          'removing the constraint later is a breaking change in the other direction.',
        example: 'The demo prints the dictionary expression the compiler would insert.'
      },
      {
        term: 'An instance with a context is a function from dictionaries to dictionaries',
        plain: 'instance Eq a => Eq [a] is not a value.',
        formal: 'dEqList : EqDict a → EqDict [a]',
        detail: 'Resolving a nested type therefore builds a nested expression whose shape ' +
          'mirrors the type\'s shape, assembled entirely before the program runs. That is why ' +
          'the dictionary count grows with the type and not with the data, and why equality on ' +
          'a deeply nested structure costs no more per element than equality on a flat one.',
        example: '`Eq (List (List Int))` resolves to `dEqLista(dEqLista(dEqInt))`, three ' +
          'dictionaries and three levels.'
      },
      {
        term: 'Superclasses are dictionaries inside dictionaries',
        plain: 'An Ord dictionary carries an Eq dictionary in a field.',
        formal: 'class Eq a => Ord a means every Ord instance supplies an Eq one',
        detail: 'That is what lets a function constrained only by `Ord a` call `==` — the ' +
          'implementation is reachable through the dictionary it was already given. The count ' +
          'jumping when superclasses are switched on is that extra structure being built, and ' +
          'it is the reason a deep class hierarchy has a real, if small, compile-time cost.',
        example: '`Ord (List Int)` builds five dictionaries with superclasses on and three ' +
          'without.'
      },
      {
        term: 'Coherence',
        plain: 'A constraint must resolve the same way everywhere in a program.',
        formal: 'at most one instance may match any goal',
        detail: 'If two match, the meaning of an expression depends on which the compiler ' +
          'picked, so the same code in two modules could do two things. That is not a ' +
          'performance concern — it is a correctness one, and it is why overlapping instances ' +
          'are an opt-in extension rather than a default. The demo shows the dictionary ' +
          'changing when the extra instance comes into scope.',
        example: '`Show (List Int)` builds `dShowLista(dShowInt)` normally and `dShowListInt` ' +
          'once the overlapping instance is allowed.'
      },
      {
        term: 'Orphan instances are how coherence breaks in practice',
        plain: 'An instance defined where neither the class nor the type lives.',
        formal: 'importable by one module and not another, so two parts of a program disagree',
        detail: 'Two libraries can each define one for the same class and type, and a program ' +
          'depending on both then has two answers to the same question — with which one wins ' +
          'depending on imports. Rust makes this a hard error with the orphan rule; Haskell ' +
          'warns. Either way the fix is the same: define the instance where the class or the ' +
          'type lives, or wrap the type.',
        example: 'The instance table names the module each instance comes from, which is where ' +
          'the problem is visible.'
      },
      {
        term: 'Ambiguity is a different failure from a missing instance',
        plain: 'A type variable that no call site can determine.',
        formal: 'show (read s) names a type nothing constrains',
        detail: 'The string is parsed to something and immediately printed, and nothing in the ' +
          'program says what. No dictionary can be chosen because there is no type to choose ' +
          'one for. This is the failure that surprises people because the code looks complete — ' +
          'it is complete, and underdetermined, and the only fix is an annotation because the ' +
          'information genuinely is not there.',
        example: '`Show a` is refused with "a type variable no call site can fix", which is a ' +
          'different message from "no instance".'
      },
      {
        term: 'Traits, interfaces and type classes differ in who chooses and when',
        plain: 'The object, the call site, or the construction site.',
        formal: 'a vtable is chosen at construction; a dictionary is chosen at the call site, at compile time',
        detail: 'A Java interface and a Rust `dyn Trait` carry their method table with the ' +
          'value, so the call is indirect and cannot be inlined across. A type class is ' +
          'resolved statically, so the compiler knows the dictionary and can specialise it ' +
          'away. That is the whole difference, and it is why Rust makes you write `dyn` to opt ' +
          'into the dynamic form.',
        example: 'The dictionary expression is fully determined before the program runs, which ' +
          'is what makes specialisation possible.'
      },
      {
        term: 'Higher-kinded types abstract over constructors',
        plain: 'A parameter that is itself a type constructor, not a type.',
        formal: 'class Functor f where map :: (a → b) → f a → f b',
        detail: 'That is what makes `Functor`, `Monad` and every abstraction over "container-' +
          'ness" expressible at all. A language without it can write `map` for lists and for ' +
          'options and cannot write the interface both satisfy, which is precisely the gap Java ' +
          'and Go have. As always the cost is inference: kinds have to be inferred too, and ' +
          'ambiguity multiplies.',
        example: 'Nothing in the demo\'s resolver is higher-kinded, which is what keeps its ' +
          'matching one-way and total.'
      },
      {
        term: 'GADTs refine types by pattern matching',
        plain: 'Matching a constructor teaches the checker something about the type.',
        formal: 'matching Lit : Expr Int lets the branch treat the result as an Int',
        detail: 'An ordinary sum type has one result type for every constructor; a generalised ' +
          'one lets each constructor fix the parameter differently, so a match on it refines ' +
          'what is known. That is what makes a well-typed interpreter for a typed language ' +
          'expressible, and it is the step towards dependent types where a type may mention a ' +
          'value.',
        example: 'The pattern-matching section compiles matches over ordinary sums, which is ' +
          'the case where every branch has the same type.'
      }
    ],
    'algebraic-data-types-and-pattern-matching': [
      {
        term: 'Sums and products, and the arithmetic is real',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a product: BOTH an A and a B"] --> B["number of values:<br/>|A| × |B|"]',
            '    C["a sum: EITHER an A or a B"] --> D["number of values:<br/>|A| + |B|"]',
            '    B --> E["the names are not a metaphor —<br/>the counts really multiply and add"]',
            '    D --> E',
            '    E --> F["which is why exhaustive matching<br/>is a finite obligation"]'
          ].join('\n'),
          caption: 'Because the value counts are literally products and sums, the compiler can enumerate the cases — and that is what makes exhaustiveness checking decidable.'
        },
        plain: 'A product is "both"; a sum is "one of".',
        formal: '|Pair A B| = |A| × |B|;  |A + B| = |A| + |B|',
        detail: 'Counting values this way is the fastest check that a type models what you ' +
          'meant. A type with more values than the domain has states is a type that permits ' +
          'invalid ones; a type with fewer cannot represent something real. "Make illegal ' +
          'states unrepresentable" is exactly a statement about this count, and it is why a ' +
          'sum of three cases beats three booleans.',
        example: '`Option Bool` has 1 + 2 = 3 values; `Pair Bool Bool` has 2 × 2 = 4.'
      },
      {
        term: 'A recursive type is a fixed point',
        plain: 'A list is either empty or an element and another list.',
        formal: 'List a = μX. 1 + a × X',
        readAs: 'The list type is the fixed point of the map taking X to either nothing or a pair of an element and an X.',
        detail: 'Iso-recursive treatment makes the fold and unfold explicit constructors; ' +
          'equi-recursive treatment makes them silent and equates a type with its unrolling. ' +
          'Almost every language you use is iso-recursive, which is exactly why you write ' +
          '`Cons(head, tail)` rather than treating a list as literally the same thing as a ' +
          'pair — the constructor is the fold made visible.',
        example: 'The value count for List grows 1, 3, 7, 15 as the depth bound rises, and never ' +
          'saturates.'
      },
      {
        term: 'A match compiles to a decision tree',
        plain: 'Switch on one column, recurse into each branch with a smaller matrix.',
        formal: 'every constructor is examined at most once on any path',
        detail: 'That is what makes matching linear in the size of the value rather than ' +
          'quadratic in the number of clauses, and it is why pattern matching is not sugar for ' +
          'a chain of if-statements. Rows that do not test the chosen column go into a default ' +
          'branch, which is why a wildcard costs nothing and a clause testing every column ' +
          'costs the most.',
        example: 'The four-clause three-column matrix compiles to 13 nodes with 6 tests, or 9 ' +
          'nodes with 4, depending on the column order.'
      },
      {
        term: 'Column choice is free to make and expensive to make badly',
        plain: 'Which column to test first changes the tree size and nothing else.',
        formal: 'all four heuristics reach the same clauses; the node counts differ',
        detail: 'This is why real compilers implement a heuristic rather than going left to ' +
          'right: the choice is semantically free, so it is pure code size and pure branch ' +
          'count. On a large match statement it is the difference between an inlined jump ' +
          'table and a page of tests, and it costs nothing to get right because no test can ' +
          'tell the difference in behaviour.',
        example: 'Leftmost gives 13 nodes; smallest-default and necessity both give 9.'
      },
      {
        term: 'Usefulness answers both questions',
        plain: 'Is there a value matching this vector that no earlier row matches?',
        formal: 'U(P, q): exhaustiveness is "the wildcard vector is not useful"; redundancy is "row i is not useful against rows above"',
        detail: 'One algorithm, asked twice with different arguments. That is why a compiler ' +
          'that reports missing cases can always report unreachable clauses, and why a compiler ' +
          'that reports neither is missing the same piece of machinery for both. Maranget\'s ' +
          'formulation is short enough to implement in an afternoon and is what most ML-family ' +
          'compilers actually run.',
        example: 'The demo runs the same function for the clause table and the exhaustiveness ' +
          'metric.'
      },
      {
        term: 'The counterexample falls out of the algorithm',
        plain: 'The recursion that proved the match incomplete built the missing value as it went.',
        formal: 'each level contributes a constructor absent from the head constructors there',
        detail: 'That is the difference between a warning you act on and one you suppress. ' +
          '`cons(false, nil)` is a value you could paste into a test; "the cons case is ' +
          'incomplete" is not. It also makes the checker testable in a way a boolean is not — ' +
          'the witness can be independently verified to match no clause.',
        example: '`nil | cons(true, _)` is missing exactly `cons(false, nil)`.'
      },
      {
        term: 'Exhaustiveness needs a closed set of constructors',
        plain: 'A sum type declares all its cases in one place; a string does not.',
        formal: 'with no finite constructor list, every match is incomplete by construction',
        detail: 'That is the real argument for sealed types and the real cost of an open class ' +
          'hierarchy: anyone can add a case anywhere, so no checker can ever tell you that you ' +
          'have handled them all. It is also why matching on an integer or a string always ' +
          'needs a default, and why that default is not a stylistic choice.',
        example: 'Every type in the demo\'s signature table has a finite constructor list, which ' +
          'is what makes the question decidable.'
      },
      {
        term: 'Option versus null is a type-level argument',
        plain: 'Option T is a different type from T; a nullable T is the same type.',
        formal: 'Option T = 1 + T, so the empty case is a constructor the match must handle',
        detail: 'Because the empty case is a constructor, the exhaustiveness checker forces it ' +
          'to be handled before the value can be used. A nullable T carries no such ' +
          'constructor, so nothing forces anything and the check has to happen by convention. ' +
          'The distinction is entirely mechanical, and the exhaustiveness checker is what turns ' +
          'it into an error message.',
        example: 'The Option type in the demo has three values at depth one, and a match must ' +
          'cover both constructors.'
      },
      {
        term: 'A default branch turns the checker off',
        plain: 'It is not a neutral convenience.',
        formal: 'a wildcard row makes every later constructor matched, so nothing can be reported missing',
        detail: 'Add a variant to a sum type and a language with exhaustiveness checking hands ' +
          'you a work list of every place that must change; a `default:` arm silently absorbs ' +
          'the new case wherever someone wrote one. That is the whole practical value of the ' +
          'feature, and writing a default over a type you control gives it away for that match.',
        example: 'The `red | _ | blue` fixture shows a wildcard making a later clause ' +
          'unreachable, which is the same mechanism seen from the other side.'
      }
    ],
    'denotational-and-axiomatic-semantics': [
      {
        term: 'A Hoare triple claims partial correctness',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["start in a state satisfying P"] --> B["run the command"]',
            '    B --> C{"does it terminate?"}',
            '    C -->|yes| D["the result satisfies Q"]',
            '    C -->|no| E["the triple says NOTHING —<br/>and is still true"]',
            '    E --> F["termination is a separate<br/>obligation, proved separately"]'
          ].join('\n'),
          caption: 'A program that loops forever satisfies every partial-correctness specification there is. Total correctness is the triple plus a termination argument, and they are proved apart.'
        },
        plain: 'Start in P, run c, and IF it stops you land in Q.',
        formal: '{P} c {Q}',
        readAs: 'If the precondition holds before the command runs, and the command finishes ' +
          'at all, then the postcondition holds when it does.',
        detail: 'The word "partial" is load-bearing: a program that loops forever satisfies ' +
          'every triple, so a proof of correctness says nothing about termination. Total ' +
          'correctness needs a separate argument — a variant, a quantity that strictly ' +
          'decreases and cannot go below zero — and conflating the two is how a "proved" ' +
          'program still hangs.',
        example: 'The demo\'s division program is proved and its termination is a separate ' +
          'question the proof does not touch.'
      },
      {
        term: 'The weakest precondition turns proving into computing',
        plain: 'The weakest predicate that guarantees Q afterwards.',
        formal: '{P} c {Q} holds exactly when P ⇒ wp(c, Q)',
        readAs: 'The triple is true precisely when the stated precondition is at least as ' +
          'strong as the weakest condition that guarantees the postcondition afterwards.',
        detail: 'Dijkstra\'s move was to make the precondition computable from the ' +
          'postcondition, so most of a proof becomes a calculation. What survives as human work ' +
          'is exactly one thing — the loop invariant — and that concentration is the reason the ' +
          'technique is teachable at all.',
        example: 'The demo generates the entry condition by computing wp and then checking the ' +
          'implication.'
      },
      {
        term: 'The assignment rule runs backwards',
        plain: 'Substitute the expression for the variable in the postcondition.',
        formal: 'wp(x := e, Q) = Q[x := e]',
        detail: 'It looks upside down the first time because we are used to reasoning forwards. ' +
          'It is right precisely because we are reasoning from the end: for Q to hold after ' +
          'assigning e to x, whatever Q says about x must have been true of e beforehand. Every ' +
          'other rule in the system is composition or case analysis around this one.',
        example: '`wp(x := y, x = b)` is `y = b`, which is why the two-assignment swap fails at ' +
          'the second step.'
      },
      {
        term: 'Conditionals double the formula',
        plain: 'Both branches contribute an implication.',
        formal: 'wp(if B then c₁ else c₂, Q) = (B ⇒ wp(c₁, Q)) ∧ (¬B ⇒ wp(c₂, Q))',
        readAs: 'The precondition of a conditional says that if the test holds you must be ' +
          'ready for the then-branch, and if it does not you must be ready for the else-branch.',
        detail: 'The postcondition is duplicated into each branch, so nesting multiplies. That ' +
          'is why no production verifier builds this formula as text: they convert to ' +
          'single-static-assignment form first, so each branch is named once and shared rather ' +
          'than copied, and hand the result to an SMT solver. The blow-up here is exactly what ' +
          'that engineering avoids.',
        example: 'Seven levels of nesting reach 3 446 nodes from 20, roughly doubling per level.'
      },
      {
        term: 'The loop rule trades computation for an invariant',
        plain: 'wp of a loop is infinite, so you supply the invariant and check three things.',
        formal: 'P ⇒ I;  I ∧ B ⇒ wp(body, I);  I ∧ ¬B ⇒ Q',
        readAs: 'The precondition must establish the invariant; the invariant together with ' +
          'the loop test must survive the body; and the invariant together with a failed test must give the postcondition.',
        detail: 'That is the whole bargain of Floyd–Hoare verification. Everything else is ' +
          'mechanical; this one step needs a human, and it is the step that requires ' +
          'understanding the loop rather than merely reading it. The three obligations are ' +
          'finite, which is what makes the trade worth making.',
        example: 'The demo\'s sum program has three conditions: entry, preservation and exit.'
      },
      {
        term: 'Which condition fails tells you what is wrong',
        plain: 'Preservation means it is not invariant; exit means it is too weak.',
        formal: 'preservation: the body breaks it. exit: it holds throughout and does not imply Q',
        detail: 'Those are different bugs with different fixes. A failed preservation means the ' +
          'invariant is a false statement about the loop; a failed exit means it is a true ' +
          'statement that does not carry enough forward. The exit condition does not get to use ' +
          'the precondition either — the invariant must carry everything the postcondition ' +
          'needs — which is why most first attempts fail there.',
        example: '`sumTooWeak` fails preservation and exit; `sumNoBound` fails only exit.'
      },
      {
        term: 'A failed proof is not a failed program',
        plain: 'A correct program with an invariant too weak to show it.',
        formal: 'the proof and the execution are independent checks and can disagree in one direction safely',
        detail: 'Confusing the two wastes days: the fix for a failed exit condition is usually ' +
          'to strengthen the invariant, not to change the code. Running the program separately ' +
          'is what makes the distinction visible, and the combination "proof passed, execution ' +
          'failed" is the one that would mean the verifier itself is wrong.',
        example: 'Three of the nine programs have a broken proof and no failing execution ' +
          'anywhere in the domain.'
      },
      {
        term: 'A bounded check is decisive one way only',
        plain: 'A counterexample is a counterexample; a clean run is "no counterexample here".',
        formal: 'every condition is checked by enumerating a small integer range',
        detail: 'There is no decision procedure in this section, and saying so is the one thing ' +
          'it must not get wrong. `divisionNoBound` verifies over the non-negative range and ' +
          'fails as soon as the range can express a negative remainder — the same formula, the ' +
          'same checker, a different domain. Every figure printed carries the domain it came ' +
          'from for exactly that reason.',
        example: 'The states-examined metric is the size of the enumeration behind each verdict.'
      },
      {
        term: 'Denotational semantics: meaning as a mathematical object',
        plain: 'A program denotes a function from states to states.',
        formal: 'recursion is a least fixed point; ⊥ denotes non-termination',
        readAs: 'A recursive definition means the smallest solution to its own equation, and a ' +
          'program that never finishes is given the special element that sits below every real value.',
        detail: 'This is where "a loop is the limit of its finite unrollings" is made precise. ' +
          'Non-termination has to be an element of the domain rather than an absence, because a ' +
          'function has to have a value everywhere — and once ⊥ is an element, continuity and ' +
          'least fixed points do the rest. It is the same content as the operational rules, ' +
          'stated so that two programs can be compared rather than only executed.',
        example: 'The while rule in the demo is the operational face of the same fixed point.'
      }
    ],
    'substructural-types-and-ownership': [
      {
        term: 'Structural rules are permissions granted silently',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["weakening: a value may<br/>go unused"] --> C["ordinary type systems<br/>grant both, invisibly"]',
            '    B["contraction: a value may<br/>be used twice"] --> C',
            '    C --> D["drop contraction: affine —<br/>at most one use"]',
            '    C --> E["drop both: linear —<br/>exactly one use"]',
            '    D --> F["and a file handle can no longer<br/>be closed twice"]'
          ].join('\n'),
          caption: 'Ownership is not a new feature bolted on. It is the removal of a permission that every other type system hands out without ever mentioning it.'
        },
        plain: 'Weakening lets a value go unused; contraction lets it be used twice.',
        formal: 'a substructural system is defined by which structural rule it removes',
        detail: 'Every mainstream type system grants weakening, contraction and exchange ' +
          'without mentioning them, which is why they are invisible until a system takes one ' +
          'away. Naming them is what makes linear and affine types a small, principled change ' +
          'rather than an exotic feature — the rules being removed were always there.',
        example: 'The discipline table is two independent switches, and four systems.'
      },
      {
        term: 'Affine types: at most one use',
        plain: 'Drop contraction and a resource cannot be consumed twice.',
        formal: 'no rule permits duplicating an assumption',
        detail: 'That single restriction eliminates the double-free bug class statically, along ' +
          'with double-close, double-commit and double-send. It is the discipline Rust chose, ' +
          'and it is weak enough to live with because it still allows forgetting — which is ' +
          'why a leak is not a compile error there.',
        example: '`useTwice` is accepted by the unrestricted and relevant disciplines and ' +
          'rejected by affine and linear.'
      },
      {
        term: 'Linear types: exactly once',
        plain: 'Drop weakening as well and a resource cannot be forgotten either.',
        formal: 'every assumption must be used, and used once',
        detail: 'Now a leak is a type error too. That is stronger and considerably harder to ' +
          'live with, which is why it appears in session types (a protocol step must happen), ' +
          'in quantum languages (a qubit genuinely cannot be copied or discarded) and rarely in ' +
          'general-purpose languages. The demo shows the exact program that separates it from ' +
          'affine.',
        example: '`leak` — a resource created and never consumed — is accepted by affine and ' +
          'rejected by linear.'
      },
      {
        term: 'Rust is affine plus a drop obligation',
        plain: 'At most one use, with the drop inserted for you.',
        formal: 'mem::forget is safe, and an Rc cycle leaks',
        detail: 'The compiler enforces at-most-once and inserts the release at end of scope, so ' +
          'the ordinary case needs no ceremony. It does not enforce at-least-once, and that is ' +
          'a deliberate position on the table rather than a gap in it: a leak is not a ' +
          'memory-safety violation, and requiring every value to be explicitly consumed would ' +
          'make the language much harder to use for very little safety.',
        example: 'The affine row allows "never use" and refuses "use twice", which is exactly ' +
          'that position.'
      },
      {
        term: 'A move invalidates the source',
        plain: 'Ownership transfers, and the old name becomes unusable.',
        formal: 'after let y = move x, any use of x is an error',
        detail: 'This is what makes ownership a property rather than an annotation: at any ' +
          'moment exactly one name owns the resource. Use-after-move is the error that follows, ' +
          'and reporting it without the line that moved the value makes it unactionable — which ' +
          'is why every error in the demo names an earlier statement.',
        example: '`use x` after `let y = move x` reports "x was already moved out of (see line ' +
          '1)".'
      },
      {
        term: 'Borrowing is orthogonal, and it is what makes affinity liveable',
        plain: 'Reading through a borrow does not spend the owner\'s single use.',
        formal: 'a borrow is a temporary checked alias; the owner\'s use count is unchanged',
        detail: 'Take borrowing away and an affine language is unusable: every read would ' +
          'consume, and nothing could be examined before it was spent. That is why the ' +
          'two-shared-borrows program is accepted even under the strictest discipline, and it ' +
          'is the design that turns linearity from a curiosity into a language people ship.',
        example: '`sharedTwice` — two borrows, two reads and a drop — is accepted by all four ' +
          'disciplines.'
      },
      {
        term: 'Aliasing XOR mutation',
        plain: 'Any number of shared borrows, or exactly one mutable borrow, never both.',
        formal: 'a mutable borrow is refused while any shared borrow is live, and vice versa',
        detail: 'This is a data-race rule before it is a memory rule: it is the same invariant a ' +
          'read-write lock enforces at run time, checked instead at compile time. That is why ' +
          'the same discipline that prevents use-after-free also prevents data races, and why ' +
          'the concurrency milestone comes back to this exact rule.',
        example: '`sharedAndMutable` and `mutableTwice` are both refused, each naming the ' +
          'earlier borrow.'
      },
      {
        term: 'Lifetimes are regions',
        plain: 'The span during which a borrow is valid.',
        formal: 'a reference used after its region has ended is a dangling pointer',
        detail: 'The explicit `end r` in the demo is what a scope ending does implicitly in a ' +
          'real language. The analysis is the same whether the resource is memory, a lock ' +
          'guard, a file handle or a database transaction — which is why lifetime errors show ' +
          'up in all four places and are the same error each time.',
        example: '`useAfterRelease` reports "a outlived its borrow (see line 2)".'
      },
      {
        term: 'A borrow checker is a state automaton per binding',
        plain: 'Alive or moved, how many shared borrows, whether a mutable one is open.',
        formal: 'each statement is a transition, and each error is a transition from a state that forbids it',
        detail: 'That is the whole machine, and knowing it removes the mystique: a borrow ' +
          'checker is not an exotic analysis, it is a small per-name state machine plus the ' +
          'rule that the two kinds of borrow exclude each other. What is hard in a real ' +
          'implementation is not the rule but the control flow — merging states across branches ' +
          'and loops.',
        example: 'The line-by-line table in the demo is that automaton\'s trace.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
