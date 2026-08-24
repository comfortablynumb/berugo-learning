/** Worked examples for grammars, transformations, PDAs and LL(1) (M25.1-M25.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'grammars-and-ambiguity': [
      {
        title: 'Counting the parse trees of `a + a + a`, and watching the count grow',
        goal: 'Turn "this grammar is ambiguous" into a number that changes with the input.',
        setup: 'The grammar `E → E + E | a`, parsed by Earley, with every distinct tree ' +
          'enumerated from the chart.',
        steps: [
          { do: 'Parse `a` and count the trees.',
            why: 'A single operand cannot be nested two ways.',
            work: '1 tree: E(a)' },
          { do: 'Parse `a + a`.',
            why: 'One operator has only one placement.',
            work: '1 tree: E(E(a) + E(a))' },
          { do: 'Parse `a + a + a`.',
            why: 'Two operators, and nothing in the grammar says which binds first.',
            work: '2 trees: E(E(E(a) + E(a)) + E(a)) and E(E(a) + E(E(a) + E(a)))' },
          { do: 'Parse `a + a + a + a`.',
            why: 'The count follows the Catalan numbers, not the token count.',
            work: '5 trees, from 7 tokens' },
          { do: 'Read the chart size for the three-operand case.',
            why: 'The work Earley did, against the answer it produced.',
            work: '21 chart items across 6 columns for 2 trees' }
        ],
        answer: 'Ambiguity is not a property of the grammar you can read off the rules — it is a ' +
          'count per input, and it is 1, 1, 2, 5 for one, two, three and four operands. The ' +
          'shortest input with a count above one is `a + a + a`, which is what the demo reports ' +
          'as the witness.'
      },
      {
        title: 'The rewrite that fixes it, and the dangling else that it cannot',
        goal: 'Show a grammar rewrite dropping the count to one, and a case where no rewrite does.',
        setup: 'The precedence grammar `E → E + T | T`, `T → T * F | F`, `F → ( E ) | a`, and ' +
          'the dangling-else grammar `S → i E t S | i E t S e S | x`.',
        steps: [
          { do: 'Parse `a + a * a` with the precedence grammar.',
            why: 'One nonterminal per level admits exactly one nesting.',
            work: '1 tree: E(E(T(F(a))) + T(T(F(a)) * F(a))) — the multiplication is nested' },
          { do: 'Parse `a + a + a` with the same grammar.',
            why: 'Left recursion forces left associativity.',
            work: '1 tree: E(E(E(T(F(a))) + T(F(a))) + T(F(a))) — a left spine' },
          { do: 'Parse `i b t x` with the dangling-else grammar.',
            why: 'One `if` and no `else` is unambiguous.',
            work: '1 tree: S(i E(b) t S(x))' },
          { do: 'Parse `i b t i b t x e x`.',
            why: 'Two `if`s and one `else`, and the grammar does not say which it belongs to.',
            work: '2 trees: the `else` attached to the inner `if`, or to the outer one' },
          { do: 'Compare which fixtures share a language.',
            why: 'A rewrite is only a fix if the language survived.',
            work: '3 of the 6 fixtures accept identical string sets; only 1 of the 3 is ambiguous' }
        ],
        answer: 'The precedence rewrite drops the count from 2 to 1 while accepting the same ' +
          'strings, which is what makes it a fix. The dangling else keeps its count of 2 under ' +
          'every rewrite in the next section, because the ambiguity is real: the deciding ' +
          'information is which `if` the author meant, and no amount of grammar surgery recovers ' +
          'it.'
      }
    ],

    'grammar-transformations': [
      {
        title: 'The whole pipeline on one expression grammar, with the language re-checked',
        goal: 'Measure what each transformation costs, and prove none of them changed the language.',
        setup: 'The precedence grammar — 6 productions over 3 nonterminals — through all six ' +
          'steps, each output compared against the ORIGINAL grammar over every string up to ' +
          'length 6.',
        steps: [
          { do: 'Remove useless symbols, then ε-productions.',
            why: 'Nothing here is useless and nothing is nullable.',
            work: '6 productions / 3 nonterminals, unchanged by both steps' },
          { do: 'Remove unit productions.',
            why: '`E → T` and `T → F` are unit chains, and each is replaced by what it reaches.',
            work: '6 → 9 productions, still 3 nonterminals' },
          { do: 'Eliminate left recursion.',
            why: 'Both E and T are directly left recursive.',
            work: '9 → 11 productions, 3 → 5 nonterminals (two fresh tails)' },
          { do: 'Left factor, then convert to Chomsky normal form.',
            why: 'No shared prefixes remain; CNF binarises everything.',
            work: '11 → 33 productions, 5 → 22 nonterminals' },
          { do: 'Check the language after every step.',
            why: 'A rewrite that changes the language is a silent disaster.',
            work: '30 strings compared in both directions per step, 0 differences across all 6' }
        ],
        answer: 'Six productions become thirty-three and three nonterminals become twenty-two, ' +
          'and the language is identical at every step. Almost the entire blow-up is the last ' +
          'step: CNF triples the rule count on its own, which is why nobody writes a grammar in ' +
          'it and every tool converts, parses, and maps the tree back.'
      },
      {
        title: 'The tree the language check cannot see',
        goal: 'Show a transformation preserving the language and destroying the structure.',
        setup: '`E → E + T | T`, `T → a` before and after left-recursion elimination, with the ' +
          'first tree printed for three inputs.',
        steps: [
          { do: 'Print both grammars.',
            why: 'The rewrite introduces one fresh nonterminal and the same language.',
            work: "3 productions become 4: E → E + T | T, T → a becomes " +
              "E → T E', E' → + T E' | ε, T → a" },
          { do: 'Parse `a` with each.',
            why: 'Even the shortest input changes shape.',
            work: "1 token: before E(T(a)) · after E(T(a) E'()) — an empty tail node " +
              "appeared" },
          { do: 'Parse `a + a`.',
            why: 'One operator is enough to move the recursion.',
            work: "3 tokens: before E(E(T(a)) + T(a)) · after E(T(a) E'(+ T(a) E'()))" },
          { do: 'Parse `a + a + a`.',
            why: 'This is where associativity visibly flips.',
            work: "5 tokens: before a LEFT spine E(E(E(T(a)) + T(a)) + T(a)) · after a " +
              "RIGHT one E(T(a) E'(+ T(a) E'(+ T(a) E'())))" },
          { do: 'Check the language.',
            why: 'Every acceptance test still passes.',
            work: '0 differences over every string up to length 6' }
        ],
        answer: 'The language survives and the spine flips from left to right. An evaluator that ' +
          'folded the old tree left-associatively now folds the new one right-associatively, so ' +
          '`1 - 2 - 3` changes value while every test that only checks acceptance stays green. ' +
          'That is why the habit is to assert tree shapes, not parses.'
      }
    ],

    'pushdown-automata': [
      {
        title: 'Running the bracket machine, and watching the stack be the memory',
        goal: 'Show the one unbounded resource actually being used.',
        setup: 'A one-state PDA with 4 transitions, accepting balanced brackets by empty stack, ' +
          'run breadth-first over configurations.',
        steps: [
          { do: 'Run `()`.',
            why: 'The shortest non-empty balanced string.',
            work: 'accepted, 5 configurations explored, deepest stack 2' },
          { do: 'Run `(())`.',
            why: 'One more nesting level costs one more stack symbol, not one more state.',
            work: 'accepted, 7 configurations, deepest stack 3' },
          { do: 'Run `()(`.',
            why: 'An unclosed bracket leaves something owed on the stack.',
            work: 'rejected, 6 configurations' },
          { do: 'Run `(())()`.',
            why: 'Nesting and sequencing together.',
            work: 'accepted, 10 configurations, deepest stack 3' },
          { do: 'Count the machine’s states.',
            why: 'A finite automaton would need one state per depth and cannot have unboundedly many.',
            work: '1 state, 4 transitions, unbounded depth' }
        ],
        answer: 'The depth grows with the nesting and the state count does not — that is the ' +
          'entire difference from the previous milestone. The machine has one state and matches ' +
          'any depth, because the counting lives in the stack.'
      },
      {
        title: 'Checking the CFG → PDA construction against a general parser',
        goal: 'Verify a construction by running it, not by arguing about it.',
        setup: 'The balanced-brackets grammar converted by the three-transition construction, ' +
          'then run against Earley over every string up to length 4.',
        steps: [
          { do: 'Build the machine and count its transitions.',
            why: 'One expand per production, one match per terminal.',
            work: '4 transitions: 2 expands for the 2 productions, 2 matches for `(` and `)`' },
          { do: 'Enumerate every input up to length 4 over the alphabet.',
            why: 'Exhaustive over short strings beats sampling long ones.',
            work: '31 inputs, from the empty string to 4 brackets' },
          { do: 'Run each through the PDA and through Earley.',
            why: 'Two mechanisms with nothing in common.',
            work: '31 verdict pairs collected' },
          { do: 'Compare.',
            why: 'A disagreement is a bug in the construction, named by input.',
            work: '0 mismatches out of 31' },
          { do: 'Spot-check `aⁿbⁿ` with the hand-built machine.',
            why: 'The language the whole hierarchy argument is about.',
            work: '`aabb` accepted with 2 pushes and 2 pops, `aab` rejected' }
        ],
        answer: 'Thirty-one exhaustive agreements is what "the construction is correct" means ' +
          'operationally. The equivalence proof is an induction on derivation length and catches ' +
          'reasoning errors; this catches implementation errors, which are the kind you actually ' +
          'make.'
      }
    ],

    'top-down-parsing-and-ll1': [
      {
        title: 'Three grammars, three conflict causes, three different remedies',
        goal: 'Show that "not LL(1)" is a verdict and the cause is the diagnosis.',
        setup: 'The left-recursive, dangling-else and precedence fixtures, each with its LL(1) ' +
          'table built, diagnosed, and then repaired by left-recursion elimination followed by ' +
          'left factoring.',
        steps: [
          { do: 'Build the table for `E → E + T | T`, `T → a`.',
            why: 'Both alternatives of E start with what T starts with.',
            work: '3 productions, 1 conflict: E on `a` wants both `E + T` and `T`; witness "a"' },
          { do: 'Apply the repairs.',
            why: 'Left recursion has a mechanical fix.',
            work: '4 productions, 0 conflicts — LL(1)' },
          { do: 'Build the table for the dangling-else grammar.',
            why: 'Two alternatives share the prefix `i E t S`.',
            work: '4 productions, 1 conflict: S on `i`; witness "ibtx"' },
          { do: 'Apply the same repairs.',
            why: 'Left factoring pulls out the shared prefix and the choice remains.',
            work: '5 productions, 1 conflict — still not LL(1)' },
          { do: 'Build and repair the precedence grammar.',
            why: 'Left recursion in two nonterminals at once.',
            work: '6 productions, 4 conflicts; after both repairs 8 productions, 0 conflicts' }
        ],
        answer: 'Two of the three grammars reach zero conflicts and one does not. The difference ' +
          'is the cause: left recursion and shared prefixes are shapes with mechanical fixes, ' +
          'and the dangling else is a genuine ambiguity that no transformation of this kind ' +
          'crosses.'
      },
      {
        title: 'One predictive parse, step by step, with no backtracking anywhere',
        goal: 'Watch the stack and the input consume each other, and read off the derivation.',
        setup: 'The LL(1) grammar `E → T R`, `R → + T R | ε`, `T → a` on the input `a + a + a`.',
        steps: [
          { do: 'Compute FIRST, FOLLOW and nullable.',
            why: 'The table is made of nothing else.',
            work: '3 nonterminals: FIRST(E)={a} FIRST(R)={+} FIRST(T)={a}; FOLLOW(E)={$} ' +
              'FOLLOW(R)={$} FOLLOW(T)={+,$}; 1 of the 3 is nullable' },
          { do: 'Note which cell FOLLOW filled.',
            why: 'FOLLOW is consulted in exactly one place in the construction.',
            work: '1 cell of the 4 filled: R on `$` holds `R → ε`, entered because the ' +
              'right-hand side is nullable' },
          { do: 'Run the parse and count the steps.',
            why: 'Every step is one expand or one match; none is ever undone.',
            work: '13 steps for a 5-token input' },
          { do: 'Read the expand steps in order.',
            why: 'They are the leftmost derivation.',
            work: '7 expansions: E→T R, T→a, R→+ T R, T→a, R→+ T R, ' +
              'T→a, R→ε' },
          { do: 'Count the backtracking steps.',
            why: 'This is the property one production per cell buys.',
            work: '0' }
        ],
        answer: 'Thirteen steps, seven of them expansions that spell out the leftmost derivation, ' +
          'and zero of them undone. That is why an LL(1) parser is linear in the input length ' +
          'regardless of the grammar — and why a single cell with two productions makes the ' +
          'parser impossible rather than slow.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
