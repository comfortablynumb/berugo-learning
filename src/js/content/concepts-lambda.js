/** Concepts for the lambda calculus, combinators and operational semantics (M27.1-M27.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'the-untyped-lambda-calculus': [
      {
        term: 'Three productions are the entire grammar',
        plain: 'A variable, an abstraction and an application, and nothing else.',
        formal: 'e ::= x | λx. e | e e',
        readAs: 'A term is a variable, or a function of one parameter, or one term applied to another.',
        detail: 'There are no numbers, booleans, pairs, lists or recursion operators in the ' +
          'syntax, and every one of them is definable inside it. That is not a curiosity: it ' +
          'is the demonstration that the notion of "computable" does not depend on which ' +
          'primitives a language happens to provide, which is the same point the Turing ' +
          'machine makes from the opposite direction.',
        example: 'The demo reduces `plus two three` to the Church numeral five and reads it back ' +
          'as the number 5.'
      },
      {
        term: 'Free and bound occurrences',
        plain: 'A variable is free when no enclosing λ binds it.',
        formal: 'FV(x) = {x}; FV(λx. e) = FV(e) minus {x}; FV(e₁ e₂) = FV(e₁) union FV(e₂)',
        readAs: 'The free variables of a lambda are the free variables of its body with the parameter removed.',
        detail: 'Every interesting definition in the calculus is stated in terms of which ' +
          'occurrences are free — substitution, α-equivalence, closure conversion, and the ' +
          'scoping rules of your own language. Getting the definition slightly wrong is how ' +
          'scoping bugs are born, because the wrong answer is still a well-formed term that ' +
          'means something else.',
        example: 'In `λx. x y`, x is bound and y is free; substituting for y must therefore look ' +
          'inside the binder.'
      },
      {
        term: 'Capture-avoiding substitution',
        plain: 'Rename the binder before substituting a term that mentions its name.',
        formal: '(λy. e)[x := a] renames y to a fresh name when y is free in a',
        readAs: 'Substituting into a lambda whose parameter appears free in the replacement ' +
          'renames that parameter to a fresh one first.',
        detail: 'This is the one place implementations go wrong. Replacing `x` by a term ' +
          'mentioning `y` inside a `λy` binder would make that free `y` suddenly bound, and the ' +
          'result is a different function. The demo shows the rename happening and logs the ' +
          'reason for it, so the correction is visible rather than assumed.',
        example: '`(λx. λy. x) y` reduces to `λy\'. y`. The naive answer `λy. y` is the identity; ' +
          'the right answer is a constant function.'
      },
      {
        term: 'α-equivalence and de Bruijn indices',
        plain: 'Names do not matter, and replacing each with a number proves it.',
        formal: 'λx y. x y and λa b. a b both become λ λ (1 0)',
        readAs: 'Each variable becomes the count of binders between it and the one that binds it.',
        detail: 'Comparing terms by index rather than by name is how a compiler decides two ' +
          'functions are the same, and it removes the renaming problem entirely because there ' +
          'are no names left to collide. It is also why the tests in this section compare ' +
          'α-equivalence rather than strings — a string comparison would pass on every fixture ' +
          'here and fail silently the moment a binder needed renaming.',
        example: 'The demo prints the de Bruijn form of two differently-named terms and they ' +
          'are identical.'
      },
      {
        term: 'β-reduction and η-conversion',
        plain: 'β applies a function; η says a wrapper that only forwards is the thing it wraps.',
        formal: '(λx. e) a → e[x := a];  λx. f x = f when x is not free in f',
        readAs: 'Applying a function to an argument replaces the parameter throughout the ' +
          'body; and a function that does nothing but pass its argument along is the same as the function it passes it to.',
        detail: 'β is the only computation rule in the calculus, and everything the demo counts ' +
          'is a count of β-steps. η is about extensionality — two functions that agree on every ' +
          'argument are the same function — and it is what justifies point-free style. It also ' +
          'turns up as an optimisation in the next section, where `S (K a) I → a` is exactly η ' +
          'arriving in combinator form.',
        example: 'Bracket abstraction compiles `λx y. x y` to `I`, because the optimisation ' +
          'performs the η-step.'
      },
      {
        term: 'Church–Rosser: the normal form is unique if you reach one',
        plain: 'Reduction order changes the cost, never the answer.',
        formal: 'if e reduces to a and to b, then a and b both reduce to some common c',
        readAs: 'Any two ways of reducing the same term can always be brought back together at ' +
          'some later term, so the final answer cannot depend on the order.',
        detail: 'The consequence is that a term has at most one normal form up to renaming, so ' +
          '"what does this evaluate to" has a single answer. What the order decides is not the ' +
          'answer but whether you get one at all, which is why the strategy table reports an ' +
          '"ends" column beside the result and not instead of it.',
        example: 'Every strategy that terminates on `plus two three` produces the same numeral, ' +
          'in different step counts.'
      },
      {
        term: 'Normal order terminates where call-by-value does not',
        plain: 'Evaluating an argument the function ignores can take the whole program down.',
        formal: '(λx. λy. y) Ω reduces in one step outermost-first and never innermost-first',
        readAs: 'The function that ignores its argument finishes immediately when the ' +
          'outermost step is taken first, and never finishes when the argument is evaluated first.',
        detail: 'Normal order reduces the leftmost outermost redex, so it throws the unused ' +
          'argument away before looking at it; the standardisation theorem says it finds a ' +
          'normal form whenever one exists. Call-by-value evaluates the argument first, and ' +
          '`Ω` reduces to itself forever. Every strict language pays this and pays it back with ' +
          'short-circuit operators and `if` as a special form.',
        example: 'Three strategies finish in one step on that term; two spend the entire budget ' +
          'and end where they started.'
      },
      {
        term: 'Recursion needs no primitive: the Y combinator',
        plain: 'A term that hands a function a copy of itself.',
        formal: 'Y f reduces to f (Y f)',
        readAs: 'Applying the fixed-point combinator to a function gives back that function ' +
          'applied to the whole combination again, which is how a definition reaches itself.',
        detail: 'A definition can then refer to something that does not exist yet, which is all ' +
          'recursion ever needed. The cost is visible in the demo: factorial through Y under ' +
          'normal order takes tens of thousands of β-steps by 5!, because numerals encoded as ' +
          'iteration make multiplication quadratic in the values. It is a proof of ' +
          'expressiveness, never an implementation strategy.',
        example: 'Factorial 0 through 5 all compute correctly, with the step count growing by ' +
          'roughly a factor of five per row.'
      },
      {
        term: 'Weak head normal form is where real evaluators stop',
        plain: 'Reduce the outside until you know the shape, and no further.',
        formal: 'call-by-name and call-by-value never reduce under a λ',
        readAs: 'Neither of the two weak strategies looks inside the body of a function; they ' +
          'stop as soon as the term is a function, which is exactly what a value is in a real language.',
        detail: 'A function value in any mainstream language is opaque: nothing evaluates its ' +
          'body until it is called. That is exactly "do not reduce under a lambda", and it is ' +
          'why the two weak strategies in the demo report shorter results than the two strong ' +
          'ones on the same term. Laziness in Haskell is call-by-name plus sharing, and the ' +
          'sharing is what turns re-evaluation into a single thunk update.',
        example: 'Head reduction stops as soon as the head is a lambda, which is enough to show ' +
          'a term is solvable even when it has no normal form.'
      }
    ],
    'combinatory-logic-and-compilation': [
      {
        term: 'A combinator is a closed term',
        plain: 'No free variables, so nothing can be captured.',
        formal: 'S = λx y z. x z (y z);  K = λx y. x;  I = λx. x',
        readAs: 'S hands its third argument to both of the first two and applies the results; ' +
          'K throws its second argument away; I gives back what it was given.',
        detail: 'Because there is nothing free, combinator reduction needs no renaming and no ' +
          'free-variable computation — the entire capture problem from the previous section ' +
          'disappears. That is what made combinator machines attractive to build in hardware: ' +
          'the reduction rule is a pattern match on a spine, not a tree walk with a name ' +
          'analysis.',
        example: 'The graph-reduction trace in the demo never renames anything, because there ' +
          'is nothing to rename.'
      },
      {
        term: 'Bracket abstraction has four cases',
        plain: 'Eliminate one variable from a term, and the cases are forced.',
        formal: 'λx. x → I;  λx. e → K e when x is not free;  λx. (a b) → S (λx. a) (λx. b)',
        readAs: 'Abstracting a variable from itself gives the identity; from a term that never ' +
          'mentions it gives that term behind a discard; and from an application distributes over both halves.',
        detail: 'Each case is forced by what the result must do when it is finally applied. If ' +
          'the body is the variable, the answer is the identity. If the body never mentions it, ' +
          'the answer must ignore its argument. If the body is an application, both halves may ' +
          'need the argument, so S hands it to both. Nested lambdas are eliminated from the ' +
          'inside out, because the inner binder has to be gone before the outer one can be.',
        example: 'The demo prints one row per case applied, so the whole algorithm is visible on ' +
          'the term you chose.'
      },
      {
        term: 'S is the rule that duplicates, and that is the blow-up',
        plain: 'S x y z becomes x z (y z) — the argument appears twice.',
        formal: 'each abstraction distributes an S over every application in its body',
        detail: 'Nested abstractions multiply the effect, so the plain translation is ' +
          'exponential in nesting depth. That duplication is also why graph reduction shares a ' +
          'node between the two occurrences rather than copying the subterm: the engineering ' +
          'answer to a duplicating rewrite rule is always a shared representation, and the same ' +
          'idea is what makes a lazy runtime\'s thunk update correct.',
        example: '`λa b c d. a b c d` is 11 nodes as a lambda term and 107 after the plain ' +
          'algorithm.'
      },
      {
        term: 'Schönfinkel\'s two optimisations do almost all the work',
        plain: 'Two rewrite rules turn an absurd translation into a usable one.',
        formal: 'S (K a) (K b) → K (a b);  S (K a) I → a',
        detail: 'The first says: if neither half of an application needs the argument, do not ' +
          'thread it through either. The second says: if the left half ignores it and the right ' +
          'half IS it, the result is just the left half — which is η-reduction, arriving as an ' +
          'optimisation rather than as a philosophical point. Together they take the worst ' +
          'fixture from 107 nodes to one.',
        example: 'Turning the optimisations off in the demo makes the S rows in the step table ' +
          'multiply.'
      },
      {
        term: 'Graph reduction walks the spine',
        plain: 'Find the head, count the arguments, fire the rule if there are enough.',
        formal: 'a term a b c d has spine head a and arguments b, c, d',
        detail: 'That is the whole execution model, and it is mechanical in a way β-reduction is ' +
          'not: no substitution, no renaming, no scope analysis. Every combinator has a fixed ' +
          'arity, so the test is a count. Sharing the argument nodes between the copies a rule ' +
          'makes is what keeps the graph from growing the way the naive tree would.',
        example: 'The trace prints the term and its size at each step, so the growth from S is ' +
          'visible.'
      },
      {
        term: 'BCKW separates the four things S and K do at once',
        plain: 'Compose, swap, discard, duplicate.',
        formal: 'B x y z → x (y z);  C x y z → x z y;  K x y → x;  W x y → x y y',
        detail: 'Curry\'s point was that these correspond exactly to the structural rules of ' +
          'logic: K is weakening, W is contraction, C is exchange, and B is composition. Drop K ' +
          'and W and you have the linear calculus that the ownership section is built on. The ' +
          'same three ideas keep reappearing because they are the same three ideas.',
        example: 'The combinator table lists all six with their arities and rules.'
      },
      {
        term: 'Point-free style is bracket abstraction done by hand',
        plain: 'Removing the argument names, with the same cost.',
        formal: 'λf g x. f (g x) becomes S (K S) K, or simply B',
        readAs: 'The composition of two functions, written with its three parameters named, ' +
          'becomes a fixed combination of S and K with no names in it at all.',
        detail: 'It reads well when the composition is simple and badly when it is not, and the ' +
          'demo\'s size table is what "not simple" looks like. The choice is not between ' +
          'elegance and clumsiness; it is a real trade between naming things and threading them ' +
          'through combinators, and the numbers say where the crossover is.',
        example: 'Composition compiles to seven nodes; a four-parameter function compiles to one ' +
          'with the optimisations and 107 without.'
      },
      {
        term: 'Closure conversion is the practical descendant',
        plain: 'A compiler eliminating a captured variable by passing it explicitly.',
        formal: 'a nested function becomes a top-level function plus an environment record',
        detail: 'This is the same job: remove a variable that is not in scope at the definition ' +
          'site by threading it through. A real compiler pays for it with an environment record ' +
          'rather than duplicated S nodes, which is the better engineering answer — but the ' +
          'problem being solved is identical, and recognising that is what lets you read a ' +
          'closure-conversion pass and know what it is doing.',
        example: 'The size comparison in the demo is the same growth a compiler manages by ' +
          'sharing one environment instead of copying.'
      },
      {
        term: 'The compiled term computes the same function, and that is testable',
        plain: 'Apply both to the same arguments and compare normal forms.',
        formal: 'compile(e) applied to args reduces to the same normal form as e applied to args',
        detail: 'This is the property that makes bracket abstraction a compiler rather than a ' +
          'transformation that happens to look plausible. The check compares by α-equivalence, ' +
          'not by string: a string comparison passes on every fixture here and would fail ' +
          'silently on the first one that needed a rename, which is precisely the class of bug ' +
          'the check exists to catch.',
        example: 'Seven fixtures applied to three arguments each, and all seven agree.'
      }
    ],
    'operational-semantics': [
      {
        term: 'Small-step semantics is a relation on terms',
        plain: 'Every intermediate state is itself a program you could print.',
        formal: 'e → e′, and a term with no step is a value or is stuck',
        detail: 'That is what makes a trace readable and a debugger possible: at every point ' +
          'there is a term, not an opaque machine state. It is also what lets a specification ' +
          'say precisely where a program went wrong, because "where" is a position in a term ' +
          'rather than a line in an implementation.',
        example: '`2 + 3 * 4 → 2 + 12 → 14`, with the rule named at each arrow.'
      },
      {
        term: 'Stuck is the formal definition of a runtime error',
        plain: 'Not a value, and no rule applies.',
        formal: 'e is stuck when e is not a value and there is no e′ with e → e′',
        detail: 'That is the whole content of "this program went wrong", and it is the thing a ' +
          'type system is built to rule out — the soundness theorem in the next section says ' +
          'exactly that well-typed terms never reach a stuck state. Without this definition, ' +
          '"type safety" has no precise meaning to prove.',
        example: '`true + 1` and `if 1 then 2 else 3` are both stuck, and both are programs a ' +
          'dynamically typed language would crash on.'
      },
      {
        term: 'Computation rules and congruence rules do different jobs',
        plain: 'One does the work; the other says where the work happens.',
        formal: 'if true then a else b → a is computation; e → e′ implies e + f → e′ + f is congruence',
        detail: 'Most of the rules on a specification page are congruence rules saying nothing ' +
          'but "look inside", which is why inference-rule notation looks harder than it is. ' +
          'Separating the two is the first thing to do when reading a language specification, ' +
          'and the demo\'s rule table separates them into two labelled kinds for exactly that ' +
          'reason.',
        example: 'Eight computation rules and six congruence rules define this whole language.'
      },
      {
        term: 'An evaluation context is the congruence rules written once',
        plain: 'A term with a hole, and the hole is where the next step happens.',
        formal: 'E ::= · | E + e | v + E | if E then e else e',
        readAs: 'A context is a hole, or a context in the left of a sum, or one in the right of a sum whose left is already a value.',
        detail: 'The shape of E fixes the entire evaluation order, so changing the order means ' +
          'changing E and touching no computation rule at all. That is what the rule-set ' +
          'control in the demo does, and it is why a real language specification can define ' +
          'evaluation order in three lines rather than in a rule per operator.',
        example: 'The trace prints `2 + ·` beside a step, meaning it happened in the right ' +
          'operand of an addition whose left was already a value.'
      },
      {
        term: 'Determinism is a property you check',
        plain: 'At most one rule applies at every reachable term.',
        formal: 'if e → e₁ and e → e₂ then e₁ = e₂',
        readAs: 'If a term can step to two different terms then those two terms are the same ' +
          'one, which is what it means for the relation to be deterministic.',
        detail: 'An implementation that picks the first matching rule is deterministic by ' +
          'construction, which proves nothing about the RULES. Checking it means enumerating ' +
          'every step the rules permit at every reachable term, and reporting the maximum. Two ' +
          'is non-determinism, and the term where it happened is the witness.',
        example: 'The standard rules never exceed one; the eager-if variant reaches two, at ' +
          '`if iszero 0 then 1 + 1 else true + 1`.'
      },
      {
        term: 'Confluence means the order cannot change the answer',
        plain: 'Different traces, same value — as long as nothing has side effects.',
        formal: 'left-to-right and right-to-left agree on every fixture',
        detail: 'This is why evaluation order is a performance question in a pure language and a ' +
          'correctness question in an impure one. Add a single mutable cell and the two orders ' +
          'come apart immediately, which is precisely why C leaves argument evaluation order ' +
          'unspecified and why that has been a source of portability bugs for forty years.',
        example: '`(1 + 2) * (3 + 4)` produces two different traces and the same 21.'
      },
      {
        term: 'Big-step semantics cannot distinguish stuck from diverging',
        plain: 'Both show up as the absence of a derivation.',
        formal: 'e ⇓ v, with no intermediate terms anywhere in the judgement',
        readAs: 'The expression finishes and produces the value v, established in a single ' +
          'derivation with no intermediate terms recorded anywhere along the way.',
        detail: 'It is shorter to write and maps directly onto a recursive interpreter, which is ' +
          'why so many implementations are written that way. What it gives up is the ability to ' +
          'say anything about a program that does not finish — and since "does not finish" and ' +
          '"crashes" are different things a specification usually needs to distinguish, most ' +
          'real specifications carry both.',
        example: 'The derivation for a stuck term simply does not exist, which the demo reports ' +
          'as "no derivation" beside the small step getting stuck.'
      },
      {
        term: 'Changing the rules changes the language',
        plain: 'Letting if evaluate both branches makes dead code able to crash.',
        formal: 'requiring both branches to be values before E-IfTrue fires',
        detail: 'The change looks harmless and is not: `if iszero 0 then 1 + 1 else true + 1` ' +
          'now gets stuck on a branch that was never going to run. This is the mechanism behind ' +
          'every real argument about short-circuit evaluation, lazy default arguments and ' +
          'eager `assert` messages — the question is always whether a subterm is evaluated ' +
          'before it is known to be needed.',
        example: 'The sweep column for the eager variant differs from the standard one on ' +
          'exactly the rows with an unreachable ill-formed branch.'
      },
      {
        term: 'An interpreter written from the rules is correct by construction',
        plain: 'Each rule becomes a case, and the two definitions can be checked against each other.',
        formal: 'small-step reaching a value implies big-step derives it, and stuck implies no derivation',
        detail: 'That agreement is the property worth testing and the one hand-written ' +
          'interpreters quietly violate at the edges — a big-step evaluator that returns a ' +
          'default instead of failing, or a small-step one whose congruence order does not match ' +
          'the specification. The demo checks both directions on every fixture rather than ' +
          'assuming they line up.',
        example: 'All eight fixtures agree between the two semantics, including the three that ' +
          'get stuck.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
