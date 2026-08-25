/** Worked examples for type classes, ADTs, Hoare logic and ownership (M27.8-M27.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'beyond-plain-generics': [
      {
        title: 'Elaborating a constraint into the dictionary the compiler inserts',
        goal: 'Make the runtime cost of a type class a structure you can count.',
        setup: 'Each goal is resolved against the instance set, and the dictionary expression ' +
          'the compiler would pass at the call site is printed, with the number of dictionaries ' +
          'and the depth of the chain.',
        steps: [
          { do: 'Resolve Eq Int.', why: 'A ground instance with no context.',
            work: 'dEqInt — 1 dictionary, depth 1' },
          { do: 'Resolve Eq (List Int).', why: 'One level of context.',
            work: 'dEqLista(dEqInt) — 2 dictionaries, depth 2' },
          { do: 'Resolve Eq (List (List Int)).', why: 'Two levels.',
            work: 'dEqLista(dEqLista(dEqInt)) — 3 dictionaries, depth 3' },
          { do: 'Resolve Eq (Pair Int (List Bool)).', why: 'Two constraints in one context.',
            work: 'dEqPairab(dEqInt, dEqLista(dEqBool)) — 4 dictionaries, depth 3' },
          { do: 'Resolve Ord (List Int) with superclasses on.',
            why: 'Ord carries an Eq dictionary in a field.',
            work: 'dOrdLista(dOrdInt(dEqInt), dEqLista(dEqInt)) — 5 dictionaries, depth 3' }
        ],
        answer: 'The whole structure is decided during type checking, so a type class costs one ' +
          'extra argument and one field lookup at run time — and can be specialised away ' +
          'entirely, which a vtable cannot. The dictionary count grows with the TYPE and not ' +
          'with the data, which is why equality on a deeply nested structure costs no more per ' +
          'element than on a flat one.'
      },
      {
        title: 'The same goal, three instance sets, three meanings',
        goal: 'Show why coherence is a rule rather than an optimisation.',
        setup: 'One goal, `Show (List Int)`, resolved against the base instances, then with an ' +
          'overlapping `Show (List Int)` instance in scope and coherence enforced, then with ' +
          'the same instance and most-specific-wins.',
        steps: [
          { do: 'Resolve against the base instances.', why: 'Only one instance matches.',
            work: 'dShowLista(dShowInt) — 2 dictionaries' },
          { do: 'Add the overlapping instance, coherence enforced.',
            why: 'Two instances now match.',
            work: 'refused: 2 instances match Show (List Int) — Show (List a) and Show (List Int)' },
          { do: 'Allow overlap, most specific wins.', why: 'The compiler picks.',
            work: 'dShowListInt — 1 dictionary, and a different one' },
          { do: 'Compare the first and third rows.',
            why: 'This is the whole danger.',
            work: 'the program still compiles and still runs, with 1 of its 2 possible ' +
              'behaviours chosen by the import list' },
          { do: 'Note where the extra instance lives.', why: 'The orphan problem.',
            work: '1 of the 2 risky instances lives in module "pretty", which is neither the ' +
              'class\'s home nor the type\'s' }
        ],
        answer: 'The third row is the one to fear: nothing fails, and lists now print ' +
          'differently depending on which modules happened to be imported. That is why ' +
          'overlapping instances are an extension you have to ask for, and why Rust makes the ' +
          'orphan rule a hard error rather than a warning.'
      },
      {
        title: 'Three ways a constraint fails to resolve',
        goal: 'Distinguish failures that need different fixes.',
        setup: 'Nine goals against the base instance set, six of which resolve.',
        steps: [
          { do: 'Resolve Eq (List Double).', why: 'The shape has an instance; the element does not.',
            work: 'no instance for Eq Double — the failure is 1 level down' },
          { do: 'Resolve Num (List Int).', why: 'No instance for the shape at all.',
            work: 'no instance for Num (List Int), at depth 1' },
          { do: 'Resolve Show a.', why: 'Nothing determines what a is.',
            work: 'refused at depth 1: Show a has a type variable no call site can fix' },
          { do: 'Compare the fixes.', why: 'They are different problems.',
            work: '3 different fixes: an instance for the element, one for the shape, an ' +
              'annotation' },
          { do: 'Count what resolved.', why: 'The rest of the sweep.',
            work: '6 of 9 goals resolve' }
        ],
        answer: 'The third is the one that surprises people, because the code looks complete. ' +
          'It is complete and underdetermined: the string is parsed to something and printed, ' +
          'and nothing says what. No instance search can help, because there is no type to ' +
          'search for.'
      }
    ],
    'algebraic-data-types-and-pattern-matching': [
      {
        title: 'A missing case, answered with a value',
        goal: 'Show that exhaustiveness checking produces a counterexample, not a category.',
        setup: 'Ten matches over five algebraic types, each checked for both faults by the same ' +
          'usefulness algorithm.',
        steps: [
          { do: 'Check nil | cons(_, _) over List.', why: 'Complete.',
            work: 'exhaustive over both of the 2 constructors — no witness exists' },
          { do: 'Check nil | cons(true, _).', why: 'The element pattern is too narrow.',
            work: 'incomplete: 1 witness, cons(false, nil)' },
          { do: 'Check red | green over Colour.', why: 'One constructor absent.',
            work: 'incomplete: 1 of the 3 constructors is missing, blue' },
          { do: 'Check true;true | false;_ over Bool × Bool.', why: 'A gap in the second column.',
            work: 'incomplete: 1 of the 4 value pairs is unmatched, true , false' },
          { do: 'Check red | _ | blue.', why: 'The other fault.',
            work: 'exhaustive, and clause 2 is unreachable — the wildcard already caught blue' }
        ],
        answer: '`cons(false, nil)` is a value you could paste into a test; "the cons case is ' +
          'incomplete" is not. The witness is built by the same recursion that proved the match ' +
          'incomplete, which is why it is always a real value and why it can be independently ' +
          'checked to match no clause.'
      },
      {
        title: 'What column order costs',
        goal: 'Measure a choice that has no effect on meaning.',
        setup: 'A four-clause, three-column matrix over booleans, compiled four times with ' +
          'different rules for choosing which column to switch on first.',
        steps: [
          { do: 'Compile testing the leftmost column first.', why: 'The naive rule.',
            work: '13 nodes, 6 tests, depth 4' },
          { do: 'Compile choosing the smallest default matrix.', why: 'An informed heuristic.',
            work: '9 nodes, 4 tests, depth 4' },
          { do: 'Compile choosing the column most rows test.', why: 'A different heuristic.',
            work: '9 nodes, 4 tests, depth 4' },
          { do: 'Compile choosing the fewest head constructors.', why: 'A third.',
            work: '13 nodes, 6 tests, depth 4' },
          { do: 'Check that all four decide the same thing.', why: 'The choice must be free.',
            work: 'all four reach all 4 clauses' }
        ],
        answer: 'Same behaviour, 13 nodes against 9 — a third of the tree removed by a choice ' +
          'no test can observe. On a large match statement that is the difference between an ' +
          'inlined jump table and a page of branches, which is why real compilers implement a ' +
          'heuristic rather than going left to right.'
      },
      {
        title: 'Why exhaustiveness cannot be checked by enumerating values',
        goal: 'Show the growth that forces the algorithm to work on patterns instead.',
        setup: 'The number of closed values of each type, counting only those built from at ' +
          'most a bounded number of nested constructors.',
        steps: [
          { do: 'Count Bool and Colour.', why: 'Finite types.',
            work: '2 and 3, at every depth' },
          { do: 'Count Option.', why: 'One recursive-looking constructor that is not.',
            work: '3 at depth 1 and above' },
          { do: 'Count List at depths 1, 2 and 3.', why: 'Genuinely recursive.',
            work: '3, 7, 15' },
          { do: 'Count Tree at depths 1, 2 and 3.', why: 'Three-way branching.',
            work: '3, 19, 723' },
          { do: 'Extrapolate.', why: 'There is no bound.',
            work: 'past depth 3 the counts keep growing, so no enumeration of the 2 recursive ' +
              'types terminates' }
        ],
        answer: 'A finite type saturates immediately and a recursive one never does, so ' +
          '"generate every value and check it matches something" is not an algorithm. ' +
          'Maranget\'s usefulness relation works on patterns instead, and patterns are finite ' +
          'even when the type is not — which is the whole reason the technique exists.'
      }
    ],
    'denotational-and-axiomatic-semantics': [
      {
        title: 'A wrong invariant, a failing condition, and a state that shows it',
        goal: 'Show that which verification condition fails tells you what is wrong.',
        setup: 'The same program — sum 0..n−1 — with three invariants, each checked by ' +
          'enumerating all states with every variable in [−2, 5].',
        steps: [
          { do: 'Use 2s = i(i−1) with 0 ≤ i ≤ n.', why: 'The full invariant.',
            work: 'all three conditions hold; 1 032 states examined' },
          { do: 'Drop the bounds on i.', why: 'Still true throughout the loop.',
            work: 'entry and preservation hold; EXIT fails, at i = 0, n = −2, s = 0' },
          { do: 'Read the falsified part of that exit condition.',
            why: 'The blame is more useful than the state.',
            work: '2 * s = n * (n − 1) is the conjunct that is false' },
          { do: 'Use "s ≥ 0 and i ≤ n" instead.', why: 'True, and says nothing about the answer.',
            work: '2 of the 3 conditions fail: preservation and exit' },
          { do: 'Run all three programs concretely.',
            why: 'The code was never changed.',
            work: '48 runs each, all correct, in every case' }
        ],
        answer: 'A failed preservation means the body breaks the invariant; a failed exit means ' +
          'the invariant is true and too weak to give you the postcondition. Neither means the ' +
          'program is wrong — all three run correctly on every start state in the domain. ' +
          'Confusing "my proof failed" with "my code is broken" is how an afternoon disappears.'
      },
      {
        title: 'Proof and execution as independent checks',
        goal: 'Run both and read the four possible combinations.',
        setup: 'Nine annotated programs, each proved by bounded checking of its verification ' +
          'conditions and separately executed from every start state satisfying its ' +
          'precondition.',
        steps: [
          { do: 'Check swap and max.', why: 'Correct programs with adequate specifications.',
            work: 'proved; 64 and 512 runs, all correct' },
          { do: 'Check swapNoTemp.', why: 'The classic two-assignment swap bug.',
            work: 'entry fails at a = −2, b = −1, x = −2, y = −1, blaming y = a; 4 runs end wrong' },
          { do: 'Check maxWrong.', why: 'The else branch assigns the wrong variable.',
            work: 'entry fails, blaming x ≥ y; 4 runs end wrong' },
          { do: 'Check sumNoBound, sumTooWeak and divisionNoBound.',
            why: 'Weak invariants over correct code.',
            work: '3 proofs fail — sumNoBound and sumTooWeak on 2 * s = n * (n - 1), ' +
              'divisionNoBound on r >= 0 — and all 48, 48 and 1 920 concrete runs are correct' },
          { do: 'Look for a proof that passed while execution failed.',
            why: 'That combination would mean the verifier is broken.',
            work: '0 rows' }
        ],
        answer: 'Two rows are genuine defects, failing in both columns. Three are correct ' +
          'programs whose invariants are too weak to show it. And none has a passing proof with ' +
          'a failing execution, which is the column that exists to catch a broken verifier ' +
          'rather than a broken program.'
      },
      {
        title: 'Why nobody builds the weakest precondition as text',
        goal: 'Measure the blow-up that forces real verifiers into a different representation.',
        setup: 'A program of nested conditionals with nothing else in them, with wp computed ' +
          'and the resulting formula\'s node count reported at each nesting depth.',
        steps: [
          { do: 'One conditional.', why: 'The base case.', work: '20 nodes' },
          { do: 'Two.', why: 'Both branches duplicate the postcondition.',
            work: '58 nodes, 2.90× the previous row' },
          { do: 'Three and four.', why: 'The ratio settles.',
            work: '142 nodes then 326 nodes, 2.45× and 2.30×' },
          { do: 'Five, six and seven.', why: 'Follow it out.',
            work: '726, 1 590 and 3 446 nodes' },
          { do: 'Take the limiting ratio.', why: 'Name the growth.',
            work: 'roughly 2.17× per level — doubling, plus the branch conditions themselves' }
        ],
        answer: 'Seven branches reach 3 446 nodes, and a real program has far more than seven. ' +
          'Production verifiers convert to single-static-assignment form first, so each branch ' +
          'is named once and shared rather than copied, and hand that to an SMT solver. The ' +
          'blow-up here is exactly what that engineering avoids.'
      }
    ],
    'substructural-types-and-ownership': [
      {
        title: 'Twelve programs, four disciplines, two structural rules',
        goal: 'Show that the disciplines separate on exactly the rules they remove.',
        setup: 'Each program is run through the borrow checker and then through the structural ' +
          'rules of each discipline. Borrow errors are counted separately from structural ones.',
        steps: [
          { do: 'Run the clean programs.',
            why: 'Establish that borrowing is orthogonal to the discipline.',
            work: '3 programs — moveOnce, sharedTwice and mutableThenRelease — are accepted ' +
              'by all 4 disciplines' },
          { do: 'Run leak — a resource created and never consumed.',
            why: 'This tests weakening.',
            work: 'accepted by 2 of the 4 — unrestricted and affine — and rejected by relevant ' +
              'and linear' },
          { do: 'Run useTwice — two reads of an owner and a drop.',
            why: 'This tests contraction.',
            work: 'accepted by 2 of the 4 — unrestricted and relevant — and rejected by affine ' +
              'and linear' },
          { do: 'Run the seven borrow-violating programs.',
            why: 'These should be orthogonal to the discipline.',
            work: 'rejected by all 4, in all 28 combinations' },
          { do: 'Count what separates the columns.', why: 'Nothing else should.',
            work: 'exactly 2 of the 12 rows differ across disciplines, one per structural rule' }
        ],
        answer: 'Two switches, four systems, and the table separates exactly where the theory ' +
          'says. Refusing "use twice" is what makes a double free impossible; refusing "never ' +
          'use" is what makes a leak impossible. Rust sits in the affine row and inserts the ' +
          'drop for you, which is why it prevents double frees and does not prevent leaks.'
      },
      {
        title: 'Every borrow error names the line responsible',
        goal: 'Show what turns a checker from annoying into usable.',
        setup: 'Each error carries the statement that caused it and the earlier statement that ' +
          'created the conflicting state.',
        steps: [
          { do: 'Run use after move.', why: 'The source is invalid afterwards.',
            work: 'line 2 "use x": x was already moved out of (see line 1)' },
          { do: 'Take a mutable borrow while a shared one is live.',
            why: 'Aliasing XOR mutation.',
            work: 'line 2: cannot borrow x mutably while 1 shared borrow is live (see line 1)' },
          { do: 'Take two mutable borrows.', why: 'The exclusive rule.',
            work: 'line 2: x is already mutably borrowed (see line 1)' },
          { do: 'Use a borrow after releasing it.', why: 'A lifetime error.',
            work: 'line 3 "use a": a outlived its borrow (see line 2)' },
          { do: 'Move out from under a live borrow.', why: 'The owner is pinned.',
            work: 'line 2: cannot move x while it is borrowed (see line 1)' }
        ],
        answer: '"Cannot borrow x mutably" tells you nothing; naming the line that took the ' +
          'shared borrow tells you what to move. The checker already has the line — it is part ' +
          'of the state being tracked — so printing it costs nothing, which is why real ' +
          'borrow-checker diagnostics are as good as they are.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
