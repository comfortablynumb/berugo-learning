/** Worked examples for LR tables, general parsing and PEGs (M25.5-M25.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'shift-reduce-and-lr0': [
      {
        title: 'What one lookahead rule buys: LR(0) against SLR on the same twelve states',
        goal: 'Measure the value of restricting reduce to FOLLOW, in conflicts rather than in prose.',
        setup: 'The precedence grammar `E → E + T | T`, `T → T * F | F`, `F → ( E ) | a`, built ' +
          'both ways from the same item-set collection.',
        steps: [
          { do: 'Build the LR(0) collection and count states.',
            why: 'Closure and goto from the start item, and nothing else.',
            work: '12 item sets' },
          { do: 'Fill the LR(0) table, reducing on every terminal.',
            why: 'A completed item means reduce, with no basis for choosing.',
            work: '2 shift/reduce conflicts, 0 reduce/reduce' },
          { do: 'Fill it again, reducing only on FOLLOW of the left-hand side.',
            why: 'The one rule that separates SLR from LR(0).',
            work: '0 conflicts, still 12 states' },
          { do: 'Compare state counts across all four flavours.',
            why: 'LR(0), SLR and LALR all build on the same cores.',
            work: 'LR(0) 12, SLR 12, LALR 12, canonical LR(1) 22' },
          { do: 'Parse `a + a * a` with the SLR table.',
            why: 'A table with no conflicts runs deterministically.',
            work: '14 shift and reduce steps, accepted' }
        ],
        answer: 'Two conflicts become zero at no cost in states, which is why SLR is the first ' +
          'thing to try. Canonical LR(1) needs 22 states for the same grammar and buys nothing ' +
          'here — the extra precision is only worth paying for on grammars SLR actually fails.'
      },
      {
        title: 'Reading a shift/reduce conflict properly',
        goal: 'Turn "1 conflict" into a decision about what the language should mean.',
        setup: 'The dangling-else grammar `S → i E t S | i E t S e S | x`, `E → b`, built as SLR.',
        steps: [
          { do: 'Build the table and count.',
            why: 'This is all a generator would tell you.',
            work: '10 states, 1 shift/reduce conflict' },
          { do: 'Name the cell.',
            why: 'A conflict lives at one state and one token.',
            work: 'state 7, on the token `e`' },
          { do: 'Name both actions.',
            why: 'The competing behaviours are what you are choosing between.',
            work: 'shift to state 8, against reduce by `S → i E t S`' },
          { do: 'Name the items responsible.',
            why: 'The items say which reading each action produces.',
            work: '2 items in state 7: `S → i E t S •` (finished, wants to reduce) and ' +
              '`S → i E t S • e S` (unfinished, wants to shift)' },
          { do: 'Check whether canonical LR(1) removes it.',
            why: 'A conflict that survives every flavour is in the grammar, not the table.',
            work: 'LR(0) 1, SLR 1, LALR 1, LR(1) 1 — it survives all four' }
        ],
        answer: 'Shifting attaches the `else` to the inner `if` and reducing attaches it to the ' +
          'outer one. Every language wants the first, and the generator produces it by ' +
          'defaulting to shift — the right answer arrived at by accident. Knowing all five ' +
          'facts turns that accident into a decision you can write down.'
      }
    ],

    'lalr-and-canonical-lr1': [
      {
        title: 'The merge that costs two conflicts',
        goal: 'Watch LALR create a conflict that exists in no other flavour.',
        setup: 'The standard witness grammar `S → a E c | a F d | b F c | b E d`, `E → e`, ' +
          '`F → e`, built as all four flavours.',
        steps: [
          { do: 'Build canonical LR(1).',
            why: 'A lookahead per item keeps the two routes to `e` distinct.',
            work: '14 states, 0 conflicts' },
          { do: 'Build LALR by merging equal cores.',
            why: 'The cores are the LR(0) states, so the count drops to the LR(0) count.',
            work: '13 states, 1 core merged' },
          { do: 'Count the conflicts LALR now has.',
            why: 'This is what the merge cost.',
            work: '2 reduce/reduce conflicts, 0 shift/reduce' },
          { do: 'Look at the merged state.',
            why: 'The pooled lookaheads are the mechanism.',
            work: 'state 6, merged from LR(1) states 6 and 9: E → e •, c · F → e •, d · ' +
              'F → e •, c · E → e •, d' },
          { do: 'Check the other flavours for comparison.',
            why: 'A conflict absent from LR(1) and present in LALR was manufactured.',
            work: 'LR(0) 6 reduce/reduce, SLR 2, LALR 2, LR(1) 0' }
        ],
        answer: 'Before the merge one state reduced E on `c` and F on `d`, and the other did the ' +
          'reverse. Afterwards both reductions are valid on both tokens. Nothing about the ' +
          'grammar changed — the information that distinguished the two routes was pooled away, ' +
          'and canonical LR(1) or IELR gets it back.'
      },
      {
        title: 'Where the merge costs nothing, and what canonical LR(1) charges for it',
        goal: 'Show the same operation on three grammars, so the cost is seen as conditional.',
        setup: 'The precedence, balanced-bracket and ambiguous-sum fixtures, each built as all ' +
          'four flavours.',
        steps: [
          { do: 'Compare the precedence grammar.',
            why: 'Ten cores appear in more than one LR(1) state here.',
            work: 'LR(0) 12 states / 2 conflicts, SLR 12 / 0, LALR 12 / 0 with 10 merged, ' +
              'LR(1) 22 / 0' },
          { do: 'Compare the balanced-bracket grammar.',
            why: 'A small grammar with the same pattern.',
            work: 'LR(0) 6 / 3, SLR 6 / 0, LALR 6 / 0 with 4 merged, LR(1) 10 / 0' },
          { do: 'Compare the ambiguous-sum grammar.',
            why: 'An ambiguous grammar conflicts under every flavour.',
            work: 'all four: 5 states, 1 shift/reduce conflict, 0 merged' },
          { do: 'Read the shift/reduce column down every table.',
            why: 'Shifts depend on the core alone.',
            work: '0 shift/reduce for the first 2 grammars and 1 for the third, identical across ' +
              'all 4 flavours' },
          { do: 'Compute what canonical LR(1) charged.',
            why: 'The extra states are the price of the precision.',
            work: '10 extra states on the precedence grammar, 4 on the brackets, 0 on the ' +
              'ambiguous one' }
        ],
        answer: 'The merge is free on two of the three and the ambiguity is untouched by all of ' +
          'it. That is the practical summary: LALR gives you LR(1) behaviour for almost nothing ' +
          'almost always, the failure mode is narrow and always reduce/reduce, and a genuinely ' +
          'ambiguous grammar is a different problem no flavour solves.'
      }
    ],

    'general-parsing-earley-cyk-glr': [
      {
        title: 'The forest against the trees, as the input grows',
        goal: 'Measure why a general parser returns a forest rather than a list.',
        setup: 'The ambiguous grammar `E → E + E | a` on `a + a`, `a + a + a` and so on, with ' +
          'the GLR forest node count and the Earley tree count taken for each.',
        steps: [
          { do: 'Three operands, five tokens.',
            why: 'The smallest ambiguous case.',
            work: '11 forest nodes, 1 of them ambiguous, 2 distinct trees' },
          { do: 'Five operands, nine tokens.',
            why: 'The two curves start to separate.',
            work: '24 nodes, 6 ambiguous, 14 trees' },
          { do: 'Seven operands, thirteen tokens.',
            why: 'The tree count is the Catalan sequence.',
            work: '41 nodes, 15 ambiguous, 132 trees' },
          { do: 'Nine operands, seventeen tokens.',
            why: 'The forest is still growing quadratically.',
            work: '62 nodes, 28 ambiguous, 1 430 trees' },
          { do: 'Eleven operands, twenty-one tokens.',
            why: 'This is the number the section quotes.',
            work: '87 nodes, 45 ambiguous, 16 796 trees' }
        ],
        answer: 'Eighty-seven nodes hold sixteen thousand seven hundred and ninety-six distinct ' +
          'trees. A parser returning a list would exhaust memory on an expression a person could ' +
          'type; one returning the forest hands you all of them in a kilobyte, and you unfold ' +
          'only what you need.'
      },
      {
        title: 'Three mechanisms agreeing, including on the grammar that breaks naive Earley',
        goal: 'Establish agreement as a test rather than as a claim.',
        setup: 'Earley, CYK and GLR over every fixture and every input up to length 4, plus the ' +
          'nullable grammar `S → A A A A`, `A → a | ε` specifically.',
        steps: [
          { do: 'Sweep every fixture and count the checks.',
            why: 'Exhaustive over short strings beats sampling long ones.',
            work: '13 186 parser-input checks across 8 grammars' },
          { do: 'Count the disagreements.',
            why: 'A single one means a bug, and the sweep names the input.',
            work: '0' },
          { do: 'Parse the empty string with the nullable grammar.',
            why: 'This is exactly what a naive Earley implementation rejects.',
            work: 'all 3 accept — Earley, CYK and GLR' },
          { do: 'Count the trees for the empty string.',
            why: 'Four nullable symbols, one way to make them all empty.',
            work: '1 tree' },
          { do: 'Count the trees for `a a`.',
            why: 'Two of the four A’s are `a` and two are ε, and the choice of which is free.',
            work: '6 trees — the four-choose-two ways' }
        ],
        answer: 'Thirteen thousand one hundred and eighty-six checks with zero disagreements, ' +
          'from a chart of dotted items, a triangular table over a normalised grammar, and an LR ' +
          'automaton with a graph-structured stack. The nullable grammar is the one that matters: ' +
          'the six trees for `a a` are only found by an implementation that advances a predicting ' +
          'item when the predicted nonterminal is nullable.'
      }
    ],

    'pegs-and-packrat-parsing': [
      {
        title: 'Exponential to linear, measured with a step counter',
        goal: 'Show the packrat cache changing the cost and not the answer.',
        setup: 'The fixture `Aᵢ ← Aᵢ₊₁ Aᵢ₊₁ "z" / Aᵢ₊₁` with `Aₙ ← "a"`, on the single-character ' +
          'input `a`, parsed with and without memoisation.',
        steps: [
          { do: 'Run at depth 4.',
            why: 'Small enough that both numbers are readable.',
            work: 'memoised 34 steps / 8 entries, plain 191 steps — ratio 5.6×' },
          { do: 'Run at depth 8.',
            why: 'Each level parses the next one three times without the cache.',
            work: 'memoised 70 / 16, plain 5 631 — ratio 80.4×' },
          { do: 'Run at depth 12.',
            why: 'The plain count is now past a hundred thousand.',
            work: 'memoised 106 / 24, plain 131 071 — ratio 1 236.5×' },
          { do: 'Run at depth 14.',
            why: 'The figure the section quotes.',
            work: 'memoised 124 / 28, plain 606 207 — ratio 4 888.8×' },
          { do: 'Compare the results, not the costs.',
            why: 'A cache that changes the answer is a bug, not an optimisation.',
            work: 'identical matched and complete flags at all 7 depths' }
        ],
        answer: 'From depth 4 to depth 14 the memoised count goes 34 → 124, growing by nine per ' +
          'two levels, and the plain count goes 191 → 606 207. The cache holds 28 entries at the ' +
          'largest size, which is the memory it traded for the four-thousand-fold speedup.'
      },
      {
        title: 'Two alternatives, two orders, two languages',
        goal: 'Show ordered choice changing the result, and the static check that catches it.',
        setup: '`S ← "a" / "ab"` and `S ← "ab" / "a"` — the same alternatives, written in the two ' +
          'orders — over the inputs `a`, `ab`, `abc` and the empty string.',
        steps: [
          { do: 'Parse `a` with both.',
            why: 'The uncontroversial case.',
            work: 'both match completely, consuming 1 character' },
          { do: 'Parse `ab` with `"a" / "ab"`.',
            why: 'The choice commits to the first alternative that succeeds at all.',
            work: 'matched, consumed 1 of 2 — the parse is INCOMPLETE' },
          { do: 'Parse `ab` with `"ab" / "a"`.',
            why: 'Same alternatives, longest first.',
            work: 'matched, consumed 2 of 2 — complete' },
          { do: 'Ask what the same rules mean as a CFG.',
            why: 'A CFG asks whether any derivation works, not which is tried first.',
            work: 'both orders accept both of `a` and `ab` — 2 strings, 2 grammars, 4 accepts' },
          { do: 'Run the unreachable-alternative check on each.',
            why: 'An alternative that can never win is dead code.',
            work: 'short-first: 1 finding — alternative 2 shadowed by alternative 1, because ' +
              '"a" is a prefix of "ab". Long-first: 0 findings' }
        ],
        answer: 'The same two alternatives in two orders define different languages, and only ' +
          'one order has a reachable second alternative. The check reports which and why, in one ' +
          'sentence naming both literals — and it is the check most PEG tools do not run, which ' +
          'is why a keyword added after the identifier rule is silently an identifier forever.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
