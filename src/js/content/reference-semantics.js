/** Reference entries for type classes, ADTs, Hoare logic and ownership (M27.8-M27.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'beyond-plain-generics': {
      summary: 'A constraint elaborated into the dictionary expression a compiler inserts, with ' +
        'the count and depth for each goal — and the same goal resolving to a different ' +
        'dictionary once two instances overlap.',
      intuition: 'A type class is an extra argument. The compiler finds the record of methods ' +
        'for the type that turned up and passes it.',
      formulation: {
        equations: [
          {
            label: 'Constraints, elaborated',
            expr: 'goal · dictionary · count · depth',
            terms: [
              { sym: 'Eq Int', meaning: 'dEqInt · 1 · 1' },
              { sym: 'Eq (List Int)', meaning: 'dEqLista(dEqInt) · 2 · 2' },
              { sym: 'Eq (List (List Int))', meaning: 'dEqLista(dEqLista(dEqInt)) · 3 · 3' },
              { sym: 'Eq (Pair Int (List Bool))', meaning: 'dEqPairab(dEqInt, dEqLista(dEqBool)) · 4 · 3' },
              { sym: 'Ord (List Int), superclasses on', meaning: 'dOrdLista(dOrdInt(dEqInt), dEqLista(dEqInt)) · 5 · 3' }
            ]
          },
          {
            label: 'Coherence: one goal, three instance sets',
            expr: 'instances in scope · result',
            terms: [
              { sym: 'base only', meaning: 'dShowLista(dShowInt)' },
              { sym: 'plus the overlap, coherence enforced', meaning: 'refused — 2 instances match' },
              { sym: 'plus the overlap, most specific wins', meaning: 'dShowListInt — a DIFFERENT dictionary' },
              { sym: 'where the extra instance lives', meaning: 'module "pretty" — neither the class’s home nor the type’s' }
            ]
          },
          {
            label: 'Three ways to fail',
            expr: 'goal · failure · the fix',
            terms: [
              { sym: 'Eq (List Double)', meaning: 'no instance for Eq Double · define one for the element' },
              { sym: 'Num (List Int)', meaning: 'no instance for the shape · define one for the shape' },
              { sym: 'Show a', meaning: 'a type variable no call site can fix · add an annotation' },
              { sym: 'resolved', meaning: '6 of 9 goals' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The dictionary expression is printed, not described',
          why: '"There is a runtime cost" is not a number; dEqLista(dEqLista(dEqInt)) is.',
          breaks: 'Every resolved goal shows the expression and the count of dictionaries in it.'
        },
        {
          name: 'Instance matching is one-way',
          why: 'The instance head may have variables and the goal may not; unifying both ways would match instances that do not apply.',
          breaks: 'Matching binds only head variables, and a bound variable must match consistently.'
        },
        {
          name: 'Overlap is detected before an instance is chosen',
          why: 'Choosing silently is exactly the failure coherence exists to prevent.',
          breaks: 'Resolution counts the candidates and refuses when there is more than one, unless overlap is explicitly allowed.'
        },
        {
          name: 'Ambiguity is reported differently from a missing instance',
          why: 'They need different fixes: one needs an instance, the other needs an annotation.',
          breaks: 'A goal whose type is a bare variable is refused with its own message before any instance is consulted.'
        },
        {
          name: 'Resolution is depth-bounded',
          why: 'An instance whose context is no smaller than its head loops forever, and real compilers have this bug.',
          breaks: 'The solver stops at depth 12 and says the resolution did not terminate.'
        }
      ],
      complexity: [
        { operation: 'matching one instance head', average: 'O(size of the type)', worst: 'O(size)' },
        { operation: 'resolving one goal', average: 'O(instances × depth)', worst: 'bounded at depth 12' },
        { operation: 'the dictionary for a type of depth d', average: 'd dictionaries', worst: 'one per constructor node in the type' },
        { operation: 'a method call at run time', average: 'one field access', worst: 'one field access — or zero, if specialised' },
        { operation: 'superclass expansion', average: 'O(hierarchy depth)', worst: 'one extra dictionary per superclass edge' }
      ],
      failureModes: [
        {
          symptom: 'Two libraries disagree about how a type is compared or printed.',
          cause: 'An orphan instance imported in one place and not another.',
          fix: 'Define instances where the class or the type lives, or wrap the type in a newtype you own.'
        },
        {
          symptom: 'An error says a type variable is ambiguous and the code looks complete.',
          cause: 'The variable appears in the constraints and not in the type, so nothing determines it.',
          fix: 'Annotate. The information genuinely is not in the program.'
        },
        {
          symptom: 'A hot loop is slower than the monomorphic version.',
          cause: 'The dictionary was not specialised away, so every method call is indirect.',
          fix: 'Add a specialisation pragma or monomorphise the call site; check the generated code rather than guessing.'
        },
        {
          symptom: 'Instance resolution loops or exhausts the stack.',
          cause: 'A context no smaller than its head.',
          fix: 'Add the termination conditions the language provides, or restructure the instance.'
        }
      ],
      inTheWild: [
        'Haskell type classes, where the dictionary translation is literally what GHC emits.',
        'Rust traits, with the orphan rule as a hard error and monomorphisation instead of dictionary passing at static call sites.',
        'Swift protocols with associated types, which are the same idea with witness tables.',
        'C++20 concepts, which constrain templates without a dictionary because instantiation is per type.'
      ],
      sources: [
        { title: 'Wadler and Blott — How to make ad-hoc polymorphism less ad hoc (1989)', note: 'type classes and the dictionary translation, in one paper' },
        { title: 'Peyton Jones, Jones and Meijer — Type classes: an exploration of the design space (1997)', note: 'overlap, coherence and the trade-offs' },
        { title: 'The Rust Reference on coherence and the orphan rule', note: 'the same problem, decided differently' },
        { title: 'Hall, Hammond, Peyton Jones and Wadler — Type classes in Haskell (1996)', note: 'the implementation, including superclass dictionaries' }
      ]
    },
    'algebraic-data-types-and-pattern-matching': {
      summary: 'Incomplete matches answered with a value you could paste into a test, and four ' +
        'column heuristics compiling the same matrix to thirteen nodes or to nine.',
      intuition: 'One relation — is there a value matching this that nothing above matches — ' +
        'answers both "what is missing" and "what can never run".',
      formulation: {
        equations: [
          {
            label: 'Missing cases, with the witness',
            expr: 'match · exhaustive · missing',
            terms: [
              { sym: 'nil | cons(_, _)', meaning: 'yes · —' },
              { sym: 'nil | cons(true, _)', meaning: 'no · cons(false, nil)' },
              { sym: 'red | green', meaning: 'no · blue' },
              { sym: 'true;true | false;_', meaning: 'no · true , false' },
              { sym: 'red | _ | blue', meaning: 'yes · and clause 2 is unreachable' }
            ]
          },
          {
            label: 'Column order on a four-clause, three-column matrix',
            expr: 'heuristic · nodes · tests · depth',
            terms: [
              { sym: 'leftmost column', meaning: '13 · 6 · 4' },
              { sym: 'smallest default matrix', meaning: '9 · 4 · 4' },
              { sym: 'most rows testing the column', meaning: '9 · 4 · 4' },
              { sym: 'fewest head constructors', meaning: '13 · 6 · 4' },
              { sym: 'clauses reached', meaning: '4, by all of them — the choice is semantically free' }
            ]
          },
          {
            label: 'Values of each type, by depth bound',
            expr: 'type · depth 1 · depth 2 · depth 3',
            terms: [
              { sym: 'Bool', meaning: '2 · 2 · 2' },
              { sym: 'Colour', meaning: '3 · 3 · 3' },
              { sym: 'Option', meaning: '3 · 3 · 3' },
              { sym: 'List', meaning: '3 · 7 · 15' },
              { sym: 'Tree', meaning: '3 · 19 · 723' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'An incomplete match returns a value, not a category',
          why: '"The cons case is incomplete" cannot be pasted into a test; cons(false, nil) can.',
          breaks: 'The witness is built by the recursion that proved the match incomplete.'
        },
        {
          name: 'The witness is verified to match no clause',
          why: 'A plausible-looking witness that is actually matched would be worse than none.',
          breaks: 'The test suite checks each witness against every clause of its matrix.'
        },
        {
          name: 'Exhaustiveness and redundancy use the same function',
          why: 'They are one relation asked with different arguments, and implementing them separately invites disagreement.',
          breaks: 'Both call useful(), differing only in the matrix passed.'
        },
        {
          name: 'A variable pattern compiles to the same thing as a wildcard',
          why: 'Binding a name matches everything, so it costs nothing in the decision tree.',
          breaks: 'The parser treats any name not in the signature as a wildcard.'
        },
        {
          name: 'All heuristics are checked to reach the same clauses',
          why: 'A column choice that changed behaviour would be a bug, not an optimisation.',
          breaks: 'The heuristic table reports the reached-clause count per row, and it is constant.'
        }
      ],
      complexity: [
        { operation: 'the usefulness check', average: 'O(rows × columns) per level', worst: 'exponential in pathological matrices; fine on real ones' },
        { operation: 'compiling a match', average: 'O(rows × columns × constructors)', worst: 'the tree can be exponential in the number of columns' },
        { operation: 'matching one value at run time', average: 'O(depth of the value)', worst: 'one constructor test per column per level' },
        { operation: 'the four-clause example', average: '9 nodes with an informed heuristic', worst: '13 nodes leftmost-first' },
        { operation: 'enumerating values of a recursive type', average: 'unbounded', worst: 'unbounded — 723 for Tree at depth 3 and growing' }
      ],
      failureModes: [
        {
          symptom: 'Adding a variant to a sum type breaks something at run time.',
          cause: 'A default branch absorbed the new case silently.',
          fix: 'Remove the default where the type is closed. The compile errors are the work list.'
        },
        {
          symptom: 'A match warning is suppressed because the message is not actionable.',
          cause: 'The checker reports a category rather than a value.',
          fix: 'Use a checker that produces a witness, and turn the witness into a test.'
        },
        {
          symptom: 'A null check is forgotten and the code crashes.',
          cause: 'Nullable T is the same type as T, so nothing forced the check.',
          fix: 'Use an option type, where the empty case is a constructor the match must handle.'
        },
        {
          symptom: 'A large match compiles to a long chain of comparisons.',
          cause: 'The compiler tests columns left to right rather than choosing.',
          fix: 'Reorder the columns by hand if the language does not, or restructure into nested matches.'
        }
      ],
      inTheWild: [
        'OCaml, Haskell, Rust, Swift and Scala, all of which warn on inexhaustive matches with a witness.',
        'Rust’s non-exhaustive attribute, which deliberately turns the check off across a crate boundary.',
        'TypeScript’s exhaustiveness idiom with never, which recovers the check inside a language that lacks it.',
        'Maranget’s algorithm itself, which is what the OCaml compiler runs.'
      ],
      sources: [
        { title: 'Maranget — Warnings for pattern matching (2007)', note: 'the usefulness algorithm, and the witness construction' },
        { title: 'Maranget — Compiling pattern matching to good decision trees (2008)', note: 'the column heuristics measured here' },
        { title: 'Augustsson — Compiling pattern matching (1985)', note: 'the original compilation strategy' },
        { title: 'Pierce — Types and Programming Languages, chapters 11 and 20', note: 'sums, products and recursive types with the μ operator' }
      ]
    },
    'denotational-and-axiomatic-semantics': {
      summary: 'Nine annotated programs proved and separately executed, with three correct ' +
        'programs whose invariants are too weak, every counterexample carrying the conjunct ' +
        'that is false, and a formula that doubles per nested branch.',
      intuition: 'Compute the weakest precondition backwards; supply the loop invariant ' +
        'yourself; check three finite obligations instead of an infinite one.',
      formulation: {
        equations: [
          {
            label: 'Proof against execution, over [−2, 5]',
            expr: 'program · proof · failing condition · execution',
            terms: [
              { sym: 'swap, max, sum, division', meaning: 'proved · — · 64, 512, 48 and 1 920 runs, all correct' },
              { sym: 'swapNoTemp', meaning: 'failed · entry · 4 runs end wrong' },
              { sym: 'maxWrong', meaning: 'failed · entry · 4 runs end wrong' },
              { sym: 'sumNoBound and divisionNoBound', meaning: 'failed · exit · every run correct' },
              { sym: 'sumTooWeak', meaning: 'failed · preservation and exit · every run correct' }
            ]
          },
          {
            label: 'Counterexamples, with the part that is false',
            expr: 'condition · state · false conjunct',
            terms: [
              { sym: 'swapNoTemp, entry', meaning: 'a = −2, b = −1, x = −2, y = −1 · y = a' },
              { sym: 'maxWrong, entry', meaning: 'x = −2, y = −1 · x ≥ y' },
              { sym: 'sumNoBound, exit', meaning: 'i = 0, n = −2, s = 0 · 2 * s = n * (n − 1)' },
              { sym: 'divisionNoBound, exit', meaning: 'q = −2, r = −2, x = −2, y = 0 · r ≥ 0' }
            ]
          },
          {
            label: 'The weakest-precondition blow-up',
            expr: 'nested conditionals · formula size · growth',
            terms: [
              { sym: '1 and 2', meaning: '20 and 58 · 2.90×' },
              { sym: '3 and 4', meaning: '142 and 326 · 2.45× and 2.30×' },
              { sym: '5 and 6', meaning: '726 and 1 590 · 2.23× and 2.19×' },
              { sym: '7', meaning: '3 446 · 2.17×' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every verdict carries the domain it was checked over',
          why: 'There is no solver here; a clean run means "no counterexample in this many states" and nothing more.',
          breaks: 'The metric reports the state count and the domain is a control.'
        },
        {
          name: 'The domain includes negative values by default',
          why: 'Restricting to naturals silently proves invariants that hold only because nothing could go below zero.',
          breaks: 'divisionNoBound verifies over [0, 6] and fails over [−2, 5]; the default is the second.'
        },
        {
          name: 'A counterexample reports the smallest false sub-formula',
          why: 'A state alone leaves the reader to evaluate a wall of symbols by hand.',
          breaks: 'Each failed condition names the conjunct, such as "r ≥ 0".'
        },
        {
          name: 'The program is executed as well as proved',
          why: 'Proof and execution are independent, and where they disagree one of them is wrong.',
          breaks: 'Every start state satisfying the precondition is run and the final state checked.'
        },
        {
          name: 'The exit obligation does not get to use the precondition',
          why: 'The invariant must carry forward everything the postcondition needs — that is what makes it an invariant.',
          breaks: 'wp emits exactly I ∧ ¬B ⇒ Q, with no reference to P.'
        }
      ],
      complexity: [
        { operation: 'computing wp for straight-line code', average: 'O(size)', worst: 'O(size) — substitution' },
        { operation: 'computing wp through n nested conditionals', average: 'about 2.2ⁿ nodes', worst: '3 446 nodes at n = 7 from 20 at n = 1' },
        { operation: 'checking one obligation', average: 'O(range^variables)', worst: '8⁴ = 4 096 states for a four-variable formula' },
        { operation: 'running one program', average: 'bounded by the 4 000-step budget', worst: 'the budget, reported as non-termination' },
        { operation: 'the whole sweep', average: 'O(programs × states)', worst: '1 920 runs for the division program alone' }
      ],
      failureModes: [
        {
          symptom: 'A proof fails and the team starts changing the code.',
          cause: 'A failed obligation means the argument is broken, not necessarily the program.',
          fix: 'Run it too. Three of the nine programs here have a broken proof and no failing execution.'
        },
        {
          symptom: 'A verified program hangs.',
          cause: 'A triple is a partial-correctness claim; termination needs a separate variant argument.',
          fix: 'Prove a decreasing quantity bounded below, or accept that you proved something weaker than you meant.'
        },
        {
          symptom: 'A bounded check passes and the property is false.',
          cause: 'The domain could not express the counterexample.',
          fix: 'Widen the domain, or use a solver. Report the domain with every result so the limit is visible.'
        },
        {
          symptom: 'Nobody on the team can state what a loop maintains.',
          cause: 'The loop is not understood.',
          fix: 'That is where the bug is. Writing the invariant down as a comment costs a line and makes the next change safe.'
        }
      ],
      inTheWild: [
        'Dafny, Why3 and Frama-C, which generate verification conditions of exactly this shape and discharge them with an SMT solver.',
        'ESC/Java and its descendants, which showed that partial verification of real code is possible and noisy.',
        'SPARK Ada, used in avionics, where loop invariants are part of the source.',
        'Every assertion and every contract library, which are Hoare triples with the proof left out.'
      ],
      sources: [
        { title: 'Hoare — An axiomatic basis for computer programming (1969)', note: 'the triple, and the while rule' },
        { title: 'Dijkstra — A Discipline of Programming (1976)', note: 'weakest preconditions, and the calculational style' },
        { title: 'Floyd — Assigning meanings to programs (1967)', note: 'the flowchart formulation that came first' },
        { title: 'Scott and Strachey — Toward a mathematical semantics for computer languages (1971)', note: 'denotational semantics, domains and least fixed points' },
        { title: 'Winskel — The Formal Semantics of Programming Languages', note: 'operational, denotational and axiomatic in one book, with the equivalences' }
      ]
    },
    'substructural-types-and-ownership': {
      summary: 'Twelve programs against four disciplines where exactly two rows separate the ' +
        'columns — one per structural rule — and every borrow error names the earlier line ' +
        'responsible.',
      intuition: 'Take away "use it twice" and a double free is impossible. Take away "never ' +
        'use it" as well and a leak is impossible. Borrowing is what makes either liveable.',
      formulation: {
        equations: [
          {
            label: 'The two structural rules, and what each discipline allows',
            expr: 'discipline · use twice · never use',
            terms: [
              { sym: 'unrestricted', meaning: 'allowed · allowed' },
              { sym: 'affine', meaning: 'refused · allowed — this is Rust' },
              { sym: 'relevant', meaning: 'allowed · refused' },
              { sym: 'linear', meaning: 'refused · refused' }
            ]
          },
          {
            label: 'The rows that separate them',
            expr: 'program · unrestricted · affine · relevant · linear',
            terms: [
              { sym: 'leak — created, never consumed', meaning: 'yes · yes · no · no  (weakening)' },
              { sym: 'useTwice — two reads and a drop', meaning: 'yes · no · yes · no  (contraction)' },
              { sym: 'the seven borrow violations', meaning: 'no · no · no · no' },
              { sym: 'moveOnce, sharedTwice, mutableThenRelease', meaning: 'yes · yes · yes · yes' }
            ]
          },
          {
            label: 'Every borrow error names its cause',
            expr: 'program · error · blame',
            terms: [
              { sym: 'moveThenUse', meaning: 'x was already moved out of · line 1' },
              { sym: 'sharedAndMutable', meaning: 'cannot borrow x mutably while 1 shared borrow is live · line 1' },
              { sym: 'mutableTwice', meaning: 'x is already mutably borrowed · line 1' },
              { sym: 'useAfterRelease', meaning: 'a outlived its borrow · line 2' },
              { sym: 'moveWhileBorrowed', meaning: 'cannot move x while it is borrowed · line 1' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Reading through a borrow does not spend the owner’s use',
          why: 'It is the entire point of borrowing, and without it an affine language is unusable.',
          breaks: 'sharedTwice — two borrows, two reads and a drop — is accepted even under the linear discipline.'
        },
        {
          name: 'Borrow errors and structural errors are counted separately',
          why: 'They are orthogonal: the borrow rules run regardless of which structural rules are in force.',
          breaks: 'Two metrics, and the seven borrow-violating programs are rejected by all four disciplines.'
        },
        {
          name: 'Every error names the earlier statement responsible',
          why: '"Cannot borrow x mutably" is unactionable; naming the line that took the shared borrow tells you what to move.',
          breaks: 'Each error carries a blame line taken from the state the checker was already tracking.'
        },
        {
          name: 'A rejected borrow is still recorded',
          why: 'Deleting it produces a cascade of "not bound" errors that bury the real one.',
          breaks: 'The binding is poisoned rather than dropped, so later statements are checked against what was meant.'
        }
      ],
      complexity: [
        { operation: 'checking one statement', average: 'O(1) amortised', worst: 'O(open borrows) when a shared borrow is released' },
        { operation: 'checking a program', average: 'O(statements)', worst: 'O(statements × borrows)' },
        { operation: 'the structural check', average: 'O(names)', worst: 'O(names)' },
        { operation: 'the discipline matrix', average: 'O(programs × disciplines)', worst: '48 checks' },
        { operation: 'a real borrow checker', average: 'a dataflow analysis over the control-flow graph', worst: 'the rule is easy; merging states across branches and loops is the work' }
      ],
      failureModes: [
        {
          symptom: 'A file handle or database connection is closed twice on an error path.',
          cause: 'The language allows contraction, so nothing stops a second consumption.',
          fix: 'Name the owner explicitly and ask what happens on every error path. Affine types make this a compile error.'
        },
        {
          symptom: 'A data race that only appears under load.',
          cause: 'Aliasing and mutation at the same time.',
          fix: 'Enforce many-readers-or-one-writer. The compile-time rule and the runtime lock are the same invariant.'
        },
        {
          symptom: 'A resource leaks and the compiler never complains.',
          cause: 'The discipline is affine, so forgetting is allowed.',
          fix: 'Expect it. Affine catches double frees, not leaks, and that is a deliberate position.'
        },
        {
          symptom: 'A mutex guard is held across an await and everything deadlocks.',
          cause: 'A borrow that outlived the region it was meant for.',
          fix: 'The same lifetime analysis that catches a dangling pointer catches this; scope the guard.'
        }
      ],
      inTheWild: [
        'Rust’s borrow checker, which is this rule set plus non-lexical lifetimes and a control-flow analysis.',
        'Session types in Rust and in research languages, where a protocol step must happen exactly once.',
        'Linear types in Haskell (the LinearTypes extension) and in Clean’s uniqueness types.',
        'Quantum programming languages, where no-cloning makes linearity a physical requirement rather than a choice.'
      ],
      sources: [
        { title: 'Girard — Linear logic (1987)', note: 'dropping the structural rules, and what each removal means' },
        { title: 'Wadler — Linear types can change the world! (1990)', note: 'the programming-language reading' },
        { title: 'Walker — Substructural type systems, in Advanced Topics in Types and Programming Languages', note: 'affine, relevant and linear side by side' },
        { title: 'The Rust Reference and the Rustonomicon', note: 'ownership, borrowing and lifetimes as shipped' },
        { title: 'Jung et al. — RustBelt: securing the foundations of the Rust programming language (2018)', note: 'the soundness proof, including where unsafe fits' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
