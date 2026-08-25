/** Worked examples for the lambda calculus, combinators and semantics (M27.1-M27.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'the-untyped-lambda-calculus': [
      {
        title: 'Church arithmetic, reduced and read back to a number',
        goal: 'Show that a calculus with no numbers computes with numbers, without taking the ' +
          'term\'s word for it.',
        setup: 'Each expression is expanded from the encoding table, reduced under normal order ' +
          'to a normal form, and then READ BACK — a numeral by counting how many times it ' +
          'applies its first argument, a boolean by seeing which of two arguments it selects.',
        steps: [
          { do: 'Reduce plus two three.', why: 'Addition on iterators.',
            work: '6 β-steps to λf. λx. f (f (f (f (f x)))), which reads back as 5' },
          { do: 'Reduce mult two three.', why: 'Multiplication is composition.',
            work: '7 β-steps to a numeral that reads back as 6' },
          { do: 'Reduce succ (succ zero).', why: 'Two applications of successor.',
            work: '6 β-steps, reads back as 2' },
          { do: 'Reduce isZero zero and isZero one.',
            why: 'A predicate that has to answer with a Church boolean.',
            work: '3 steps to λt. λf. t (true) and 4 steps to λt. λf. f (false)' },
          { do: 'Notice what λt. λf. f also is.',
            why: 'The two encodings picked the same term.',
            work: 'it is Church FALSE and Church ZERO at once — 3 of the 9 rows are marked ' +
              '"also the numeral 0"' }
        ],
        answer: 'All nine encodings agree with what they claim, and the read-back is what makes ' +
          'that a check rather than a picture. The overloading in the last row is the honest ' +
          'finding: nothing in an untyped calculus distinguishes false from zero, so the reader ' +
          'supplies the intent — which is exactly the information a type would have recorded.'
      },
      {
        title: 'The strategy that finishes and the two that never do',
        goal: 'Make "evaluation order decides termination" a measurement rather than a warning.',
        setup: 'One term, `(λx. λy. y) Ω`, where Ω = (λx. x x) (λx. x x) reduces to itself ' +
          'forever and the function ignores its argument entirely. All five strategies are run ' +
          'on it at three different step budgets.',
        steps: [
          { do: 'Run normal order.', why: 'Leftmost outermost: the argument is discarded first.',
            work: '1 β-step, reaching the normal form λy. y' },
          { do: 'Run call by name and head reduction.', why: 'Also outermost-first.',
            work: '1 β-step each, same normal form' },
          { do: 'Run applicative order and call by value.',
            why: 'Both evaluate the argument before applying.',
            work: 'the budget is exhausted at 50, at 200 and at 2 000 steps, and the term is ' +
              'unchanged in every case' },
          { do: 'Raise the budget and look again.', why: 'Check that it is divergence and not slowness.',
            work: 'the step count equals the budget exactly at all 3 settings — 50, 200 and ' +
              '2 000 — so no progress is being made at all' }
        ],
        answer: 'Three strategies finish in one step; two never finish at any budget. The term ' +
          'has a normal form and reaching it depends entirely on the order — which is why `if` ' +
          'cannot be an ordinary function in a strict language, why `&&` short-circuits in the ' +
          'grammar rather than in a library, and why lazy defaults and eager assertion messages ' +
          'are recurring bug sources.'
      },
      {
        title: 'Recursion with no recursion primitive, and what it costs',
        goal: 'Run factorial through the Y combinator and report the price of the encoding.',
        setup: 'Factorial defined with Y, applied to Church numerals 0 through 5, reduced under ' +
          'normal order with a 60 000-step budget, and the result read back to a number.',
        steps: [
          { do: 'Compute 0! and 1!.', why: 'The base case and one unrolling.',
            work: 'both read back as 1, in 9 and 34 β-steps' },
          { do: 'Compute 2! and 3!.', why: 'Two and three unrollings.',
            work: '2 in 159 steps and 6 in 838 steps' },
          { do: 'Compute 4! and 5!.', why: 'Where the cost becomes visible.',
            work: '24 in 5 057 steps and 120 in 34 938 steps' },
          { do: 'Take the ratios.', why: 'The growth is not linear in n.',
            work: '3.8×, 4.7×, 5.3×, 6.0× and 6.9× per row' },
          { do: 'Look at the term size alongside.', why: 'The numerals themselves get large.',
            work: 'size 5, 5, 7, 15, 51, 243' }
        ],
        answer: 'Every answer is correct and the cost grows by roughly a factor of five to seven ' +
          'per row. Numerals encoded as iteration make multiplication quadratic in the values, ' +
          'so this is a proof of expressiveness — recursion needs no primitive — and never an ' +
          'implementation strategy.'
      }
    ],
    'combinatory-logic-and-compilation': [
      {
        title: 'What the two optimisations are worth',
        goal: 'Turn "combinator translation blows up" into two numbers per term.',
        setup: 'Eight lambda terms, each compiled twice: once by the plain four-case algorithm ' +
          'and once with Schönfinkel\'s two rewrite rules, with node counts for both.',
        steps: [
          { do: 'Compile λx. x.', why: 'The trivial case.',
            work: '2 nodes as a lambda term, 1 either way' },
          { do: 'Compile λx y. x.', why: 'One K and a discarded binder.',
            work: '3 → 7 plain, 1 optimised, a ratio of 7.0×' },
          { do: 'Compile λf x. f (f x).', why: 'A nested application.',
            work: '7 → 35 plain, 11 optimised, 3.2×' },
          { do: 'Compile λx y z. x z (y z).', why: 'This term IS S.',
            work: '10 → 61 plain, 1 optimised, 61.0×' },
          { do: 'Compile λa b c d. a b c d.', why: 'Four nested binders.',
            work: '11 → 107 plain, 1 optimised, 107.0×' }
        ],
        answer: 'The plain algorithm distributes an S over every application inside every ' +
          'abstraction, and nested abstractions multiply, so growth is exponential in nesting ' +
          'depth. Two rewrite rules take the worst case from 107 nodes to 1. The second of ' +
          'them, `S (K a) I → a`, is η-reduction arriving as an optimisation.'
      },
      {
        title: 'The compiled term computes the same function',
        goal: 'Check the compiler rather than trust the algorithm.',
        setup: 'Each fixture is applied to the same arguments twice — once as the original ' +
          'lambda term reduced under normal order, once as the compiled combinator term reduced ' +
          'by graph reduction — and the two normal forms are compared by α-equivalence.',
        steps: [
          { do: 'Check λx. x on p q r.', why: 'The identity.',
            work: 'compiles to I; both give p q r, in 1 step each' },
          { do: 'Check λx y. x on p q r.', why: 'K.',
            work: 'compiles to K; both give p r, in 2 β-steps and 1 combinator step' },
          { do: 'Check λf x. f (f x) on g z.', why: 'The one with real work in it.',
            work: 'compiles to S (S (K S) K) I; both give g (g z), in 2 β-steps and 6 ' +
              'combinator steps' },
          { do: 'Check λf g x. f (g x) on p q r.', why: 'Composition.',
            work: 'compiles to S (K S) K; both give p (q r), in 3 β-steps and 4 combinator steps' },
          { do: 'Compare by α-equivalence, not by string.',
            why: 'A string comparison would pass here and fail silently on a rename.',
            work: '7 of 7 fixtures agree' }
        ],
        answer: 'The compilation is meaning-preserving on every fixture, and the step counts ' +
          'show what it costs: the twice combinator takes 2 β-steps as a lambda term and 6 ' +
          'combinator steps once compiled. That is the same trade a real compiler makes when it ' +
          'converts closures — more, simpler operations in exchange for removing the names.'
      }
    ],
    'operational-semantics': [
      {
        title: 'Two evaluation orders, two traces, one answer',
        goal: 'Show confluence by measuring it instead of asserting it.',
        setup: 'The term `(1 + 2) * (3 + 4)` under two rule sets that differ only in the order ' +
          'of the congruence holes: left-to-right and right-to-left. The computation rules are ' +
          'identical in both.',
        steps: [
          { do: 'Run the standard rules.', why: 'The left operand reduces first.',
            work: '(1 + 2) * (3 + 4) → 3 * (3 + 4) → 3 * 7 → 21, in 3 steps' },
          { do: 'Run the right-to-left rules.', why: 'The right operand reduces first.',
            work: '(1 + 2) * (3 + 4) → (1 + 2) * 7 → 3 * 7 → 21, in 3 steps' },
          { do: 'Compare the middle terms.', why: 'This is where the orders differ.',
            work: '3 * (3 + 4) against (1 + 2) * 7 — different terms, same successor' },
          { do: 'Compare the answers over the whole fixture set.',
            why: 'One term proves nothing.',
            work: 'all 8 fixtures agree between the two orders, value and outcome' },
          { do: 'Count the rules applicable at each reachable term.',
            why: 'Determinism has to be checked, not assumed.',
            work: 'at most 1 under both rule sets, over every reachable term' }
        ],
        answer: 'The trace changes and the answer does not. That is confluence, and it holds ' +
          'because this language has no side effects — add one mutable cell and the two columns ' +
          'come apart immediately, which is exactly why evaluation order is specified in every ' +
          'modern language and left unspecified in a famous few.'
      },
      {
        title: 'A plausible rule change that breaks the language',
        goal: 'Show that changing where the hole may be changes what programs mean.',
        setup: 'The eager-if rule set adds two holes to the conditional so both branches may ' +
          'step, and requires both to be values before the if-rule fires. Nothing else changes.',
        steps: [
          { do: 'Run if iszero 0 then 1 + 1 else true + 1 under the standard rules.',
            why: 'The guard decides first and the dead branch is discarded.',
            work: '3 steps to the value 2' },
          { do: 'Run the same term under the eager rules.',
            why: 'Now the dead branch has to become a value first.',
            work: 'stuck after 2 steps at `if true then 2 else true + 1`' },
          { do: 'Count applicable rules at that term.',
            why: 'Two holes are open at once.',
            work: '2 rules apply — the rule set is non-deterministic, and the witness is named' },
          { do: 'Check the rest of the fixtures.', why: 'Most programs are unaffected.',
            work: '1 of the 8 fixture rows differs; the other 7 are unaffected' },
          { do: 'Confirm the computation rules were untouched.',
            why: 'The difference must be attributable.',
            work: 'all 8 computation rules are identical across the three rule sets' }
        ],
        answer: 'A change to the congruence half alone — where the hole may be — turned a ' +
          'terminating program into a stuck one and a deterministic language into a ' +
          'non-deterministic one. This is the mechanism behind every argument about ' +
          'short-circuit evaluation and lazy default arguments: the question is always whether ' +
          'a subterm is evaluated before it is known to be needed.'
      },
      {
        title: 'Small step and big step, checked against each other',
        goal: 'Verify that two definitions of the same language agree, including where they fail.',
        setup: 'Every fixture is evaluated twice: once as a sequence of small steps with the ' +
          'rule and evaluation context recorded, and once as a single big-step derivation.',
        steps: [
          { do: 'Evaluate 2 + 3 * 4.', why: 'A term that reaches a value.',
            work: 'small step: 2 steps to 14. big step: the same 14, in a derivation 3 deep ' +
              'with 5 nodes' },
          { do: 'Evaluate if 2 < 3 then 10 else 20.', why: 'A guard and a branch.',
            work: '2 small steps to 10; a 3-deep, 5-node derivation to the same value' },
          { do: 'Evaluate true + 1.', why: 'A stuck term.',
            work: 'small step: 0 steps, stuck. big step: no derivation exists' },
          { do: 'Evaluate if 1 then 2 else 3.', why: 'Stuck for a different reason.',
            work: 'stuck immediately; the big step reports "the guard evaluated to 1, not a ' +
              'boolean"' },
          { do: 'Check all eight fixtures.', why: 'The agreement is the property.',
            work: '8 of 8 agree, including all three stuck cases' }
        ],
        answer: 'Where the small step reaches a value the big step derives the same one, and ' +
          'where the small step gets stuck the big step has no derivation. That agreement is ' +
          'what most hand-written interpreters quietly violate at exactly these edges — by ' +
          'returning a default instead of failing, or by evaluating in an order the ' +
          'specification did not permit.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
