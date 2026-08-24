/** Reference entries for grammars, transformations, PDAs and LL(1) (M25.1-M25.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'grammars-and-ambiguity': {
      summary: 'Every parse tree for an input enumerated from the Earley chart, so ambiguity is ' +
        'a count rather than an opinion, with the shortest ambiguous string found by enumerating ' +
        'the language in length order and the "same language" claim checked rather than asserted.',
      intuition: 'Ambiguity belongs to the grammar; the fix is a rewrite, and the rewrite is only ' +
        'a fix if the language survived it.',
      formulation: {
        equations: [
          {
            label: 'The language of a grammar',
            expr: 'L(G) = { w in T* : S =>* w }',
            readAs: 'The language is every string of terminals derivable from the start symbol.',
            terms: [
              { sym: 'nonterminal', meaning: 'a symbol with productions of its own — determined by the text, never declared' },
              { sym: 'context-free', meaning: 'the replacement never depends on what surrounds the nonterminal' },
              { sym: 'derivation', meaning: 'a sequence of rewrites; many give the same tree' },
              { sym: 'parse tree', meaning: 'what the sequence built, and where the meaning is' }
            ]
          },
          {
            label: 'Tree counts for E -> E + E | a',
            expr: 'operands · tokens · distinct trees',
            terms: [
              { sym: '1', meaning: '1 token · 1 tree' },
              { sym: '2', meaning: '3 tokens · 1 tree' },
              { sym: '3', meaning: '5 tokens · 2 trees — the shortest ambiguous input' },
              { sym: '4', meaning: '7 tokens · 5 trees, following the Catalan numbers' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Ambiguity is counted per input, not read off the rules',
          why: 'A grammar can look suspicious and be fine, or look innocent and be ambiguous three tokens in.',
          breaks: 'The demo enumerates every distinct tree from the chart and prints the shapes.'
        },
        {
          name: 'The witness is the shortest input with more than one tree',
          why: 'A grammar is ambiguous if ANY string has two, so the report has to name one.',
          breaks: 'Enumerating in length order returns `a + a + a` for the default grammar, from 21 chart items.'
        },
        {
          name: 'A rewrite is only a fix if the language survived',
          why: 'A grammar with different rules and a different language is a different specification.',
          breaks: 'The comparison table computes which fixtures share a language; three do, and the precedence grammar deliberately does not.'
        },
        {
          name: 'Derivation order changes the steps and never the tree',
          why: 'Ambiguity is defined on trees for exactly this reason.',
          breaks: 'Switching the leftmost/rightmost control alters every intermediate line and neither the tree nor the count.'
        }
      ],
      complexity: [
        { operation: 'Earley parse', average: 'O(n²) on unambiguous grammars', worst: 'O(n³)' },
        { operation: 'enumerating trees', average: 'linear in the trees returned', worst: 'exponential in the ambiguity — capped at 12 in the demo' },
        { operation: 'shortest-witness search', average: 'one parse per candidate string', worst: '|Σ|^k parses up to length k' },
        { operation: 'language comparison', average: 'both languages enumerated to a bound', worst: 'exponential in the bound, which is why the bound is 6' }
      ],
      failureModes: [
        {
          symptom: 'An expression evaluates differently in two implementations of the same language.',
          cause: 'The grammar is ambiguous and each generator resolved the conflict its own way.',
          fix: 'Rewrite so the precedence is in the grammar shape, or pin the conflict count in CI.'
        },
        {
          symptom: 'A parser generator reports conflicts and the build passes anyway.',
          cause: 'Conflicts are warnings by default in every mainstream generator.',
          fix: 'Fail the build on a change in the count, so each new conflict is examined once.'
        },
        {
          symptom: 'An `else` attaches to the wrong `if` in a generated parser.',
          cause: 'The dangling-else conflict resolved to reduce rather than shift.',
          fix: 'Prefer shift explicitly, or restructure with a matched/unmatched statement split.'
        },
        {
          symptom: 'A grammar rewrite passes every test and breaks the compiler.',
          cause: 'The language survived and the tree shape did not.',
          fix: 'Assert tree shapes for inputs with known associativity, not only acceptance.'
        }
      ],
      inTheWild: [
        'The ALGOL 60 report, which introduced BNF and shipped the dangling-else ambiguity with it.',
        'Every yacc and bison grammar with a "1 shift/reduce conflict, expected" comment.',
        'C++’s most vexing parse, which is a declaration-versus-expression ambiguity the standard resolves by fiat.',
        'SQL dialects that disagree about operator precedence, each one a grammar decision made twice.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques and Tools', note: 'grammars, derivations, ambiguity and the dangling else' },
        { title: 'Grune and Jacobs — Parsing Techniques: A Practical Guide', note: 'the taxonomy this whole milestone follows' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory, Languages and Computation', note: 'inherent ambiguity and the undecidability of the ambiguity question' },
        { title: 'Naur et al. — Report on the Algorithmic Language ALGOL 60 (1960)', note: 'BNF, and the first published dangling else' }
      ]
    },

    'grammar-transformations': {
      summary: 'Six transformations run in sequence with the language re-checked against the ' +
        'ORIGINAL grammar at every step, and the first input whose tree shape changed named — ' +
        'six productions become thirty-three with the language identical throughout.',
      intuition: 'Every transformation keeps the language and changes the tree, and only the ' +
        'first half is in the textbook.',
      formulation: {
        equations: [
          {
            label: 'The pipeline on the precedence grammar',
            expr: 'step · productions · nonterminals',
            terms: [
              { sym: 'start', meaning: '6 · 3' },
              { sym: 'useless, epsilon', meaning: '6 · 3 — nothing to remove' },
              { sym: 'unit', meaning: '9 · 3 — the E -> T and T -> F chains expand' },
              { sym: 'left-recursion', meaning: '11 · 5 — two fresh tail nonterminals' },
              { sym: 'left-factor', meaning: '11 · 5 — no shared prefixes remain' },
              { sym: 'cnf', meaning: '33 · 22 — the binarisation, and most of the blow-up' }
            ]
          },
          {
            label: 'The shape change left recursion elimination causes',
            expr: 'E -> E + T | T  becomes  E -> T E′, E′ -> + T E′ | ε',
            terms: [
              { sym: 'a', meaning: "E(T(a)) becomes E(T(a) E'()) — an empty tail node appears" },
              { sym: 'a + a + a', meaning: "a LEFT spine becomes a RIGHT one" },
              { sym: 'the language', meaning: '0 differences over every string up to length 6' },
              { sym: 'the consequence', meaning: 'a left fold becomes a right fold, so 1 - 2 - 3 changes value' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every step is checked against the original grammar, not the previous step',
          why: 'An error introduced early would otherwise be hidden by a later step that is internally consistent.',
          breaks: 'The pipeline compares each output against the grammar the learner selected, over 30 strings in both directions.'
        },
        {
          name: 'ε-removal keeps the start symbol nullable when the language contains ε',
          why: 'Dropping it is a language change that no rule count reveals.',
          breaks: 'The balanced-bracket fixture derives the empty string and still does after the step.'
        },
        {
          name: 'The tree change is reported as a named input',
          why: '"The structure may differ" is unactionable; "it differs at `a`" is a test case.',
          breaks: 'The shape metric searches for the first input whose first tree differs and prints both shapes.'
        },
        {
          name: 'Left-recursion elimination handles the indirect case, not only the direct one',
          why: 'A -> B x with B -> A y loops and no rule starts with its own left-hand side.',
          breaks: 'Paull’s ordering substitutes earlier nonterminals into later ones until every cycle is direct.'
        }
      ],
      complexity: [
        { operation: 'useless-symbol removal', average: 'two fixed points over the productions', worst: 'O(rules × symbols)' },
        { operation: 'ε-removal', average: 'small, because few right-hand sides have many nullable symbols', worst: '2^k copies of a rule with k nullable symbols' },
        { operation: 'unit-production removal', average: 'one pass per unit chain', worst: 'quadratic in the nonterminals' },
        { operation: 'left-recursion elimination', average: 'linear for direct recursion', worst: 'quadratic via Paull’s substitution for indirect' },
        { operation: 'Chomsky normal form', average: 'one fresh nonterminal per extra symbol', worst: '6 productions to 33 on the demo grammar' },
        { operation: 'the language check', average: 'both languages enumerated to the bound', worst: 'exponential in the bound' }
      ],
      failureModes: [
        {
          symptom: 'The parser accepts the same programs and the compiler produces wrong code.',
          cause: 'A transformation changed the tree shape and the AST builder was not updated.',
          fix: 'Re-derive the AST mapping deliberately after any grammar change, and assert shapes in tests.'
        },
        {
          symptom: 'A rewritten grammar rejects the empty input the original accepted.',
          cause: 'ε-removal dropped the start symbol’s own ε rule.',
          fix: 'Keep it when the original language contains ε; the differential test catches this immediately.'
        },
        {
          symptom: 'Left-recursion elimination terminates on the fixtures and hangs on the real grammar.',
          cause: 'Only the direct case was implemented; the real grammar has an indirect cycle.',
          fix: 'Implement Paull’s ordering, which turns every cycle into a direct one first.'
        },
        {
          symptom: 'Error messages quote nonterminals nobody wrote.',
          cause: 'A normal-form conversion generated them and no mapping back was kept.',
          fix: 'Record the source rule for every generated production and report the original.'
        }
      ],
      inTheWild: [
        'Every LL parser generator, which rejects a left-recursive grammar and expects you to have transformed it.',
        'CYK implementations, which convert to Chomsky normal form internally and map the tree back.',
        'ANTLR, which removes direct left recursion for you and rewrites the tree to restore associativity.',
        'The Dragon Book’s expression grammar, rewritten in almost every compiler course as an exercise.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques and Tools', note: 'all six transformations, with the standard algorithms' },
        { title: 'Paull — Algorithm design: a recursion transformation framework (1968)', note: 'the ordering that handles indirect left recursion' },
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory', note: 'Chomsky and Greibach normal forms, and why they exist' },
        { title: 'Parr — The Definitive ANTLR 4 Reference', note: 'automatic left-recursion removal and restoring the intended tree' }
      ]
    },

    'pushdown-automata': {
      summary: 'A stack drawn beside the tape with every nondeterministic branch alive at once, ' +
        'and the CFG-to-PDA construction checked against Earley on 31 exhaustive inputs with ' +
        'zero disagreements.',
      intuition: 'One unbounded stack is the entire difference between a tokeniser and a parser.',
      formulation: {
        equations: [
          {
            label: 'A pushdown automaton',
            expr: '(Q, Σ, Γ, δ, q0, Z0, F) with δ: Q × (Σ ∪ {ε}) × Γ → P(Q × Γ*)',
            readAs: 'States, an input alphabet, a stack alphabet, and a transition that reads a ' +
              'symbol or nothing, pops one stack symbol, and pushes a string.',
            terms: [
              { sym: 'the stack', meaning: 'the one unbounded resource — a finite automaton has none' },
              { sym: 'ε-move', meaning: 'consumes no input, which is where the nondeterminism lives' },
              { sym: 'acceptance', meaning: 'by final state or by empty stack; the two are interchangeable' },
              { sym: 'the bracket machine', meaning: '1 state, 4 transitions, unbounded depth' }
            ]
          },
          {
            label: 'The CFG → PDA construction',
            expr: 'expand: (q, ε, A) -> (q, α) for each A -> α · match: (q, a, a) -> (q, ε)',
            readAs: 'Reading nothing, pop a nonterminal and push one of its right-hand sides; ' +
              'reading a terminal, pop the matching terminal and push nothing.',
            terms: [
              { sym: 'the machine', meaning: 'a nondeterministic top-down parser, one state, acceptance by empty stack' },
              { sym: 'the stack', meaning: 'the sentential form still owed, in the order incurred' },
              { sym: 'checked', meaning: '31 exhaustive inputs against Earley, 0 mismatches' },
              { sym: 'left recursion', meaning: 'expands without consuming, so the search is capped and says so' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The stack depth grows with the nesting and the state count does not',
          why: 'That is the whole reason a PDA recognises what a finite automaton cannot.',
          breaks: 'The bracket machine has 1 state; `()` reaches depth 2 and `(())` depth 3.'
        },
        {
          name: 'Running a nondeterministic machine means tracking a SET of configurations',
          why: 'A single walk would commit to one guess and report a false rejection.',
          breaks: 'The trace shows several alternative guesses alive at once, dequeued breadth-first.'
        },
        {
          name: 'A capped search reports the cap rather than a rejection',
          why: 'A bound reported as "no" is a lie about the language.',
          breaks: 'Selecting a left-recursive grammar reports "search capped" and names the cause.'
        },
        {
          name: 'The construction is verified by running it, not by argument',
          why: 'The proof catches reasoning errors; the sweep catches implementation errors.',
          breaks: '31 verdict pairs, and a disagreement would be reported as a named input.'
        }
      ],
      complexity: [
        { operation: 'one transition', average: 'O(transitions) applicable moves', worst: 'every production of the nonterminal on top' },
        { operation: 'running the bracket machine', average: '5 configurations on `()`, 10 on `(())()`', worst: 'linear in the input for a deterministic machine' },
        { operation: 'running a constructed machine', average: 'grows much faster than the input length', worst: 'unbounded on a left-recursive grammar — hence the cap' },
        { operation: 'the agreement sweep', average: '31 inputs up to length 4', worst: '|Σ|^k inputs at length k' }
      ],
      failureModes: [
        {
          symptom: 'A regular expression over nested structure works on the examples and fails in production.',
          cause: 'Nesting needs unbounded memory and a regular expression has none.',
          fix: 'Use a parser. No amount of backreference cleverness changes the class of the problem.'
        },
        {
          symptom: 'A hand-written PDA simulator reports a rejection for a string in the language.',
          cause: 'It followed one nondeterministic branch instead of tracking the set.',
          fix: 'Search over configurations breadth-first, exactly as an NFA simulation does.'
        },
        {
          symptom: 'A PDA search never terminates.',
          cause: 'A left-recursive grammar expands the stack without consuming input.',
          fix: 'Cap the search and report the cap distinctly from a rejection.'
        },
        {
          symptom: 'A static check cannot be expressed as more grammar rules.',
          cause: 'Context-free languages are not closed under intersection.',
          fix: 'Make it a separate pass over the tree — which is what every real compiler does.'
        }
      ],
      inTheWild: [
        'Every recursive-descent parser, whose call stack is the pushdown store.',
        'Every LR parser, whose explicit stack of states is the same thing made visible.',
        'Bracket matching in editors, which is a PDA even when nobody calls it one.',
        'The "you cannot parse HTML with a regex" answer, which is this section’s argument.'
      ],
      sources: [
        { title: 'Hopcroft, Motwani and Ullman — Introduction to Automata Theory, Languages and Computation', note: 'the PDA model, both acceptance conditions and the CFG equivalence' },
        { title: 'Sipser — Introduction to the Theory of Computation', note: 'the equivalence proofs in both directions, and the pumping lemma for CFLs' },
        { title: 'Aho, Lam, Sethi and Ullman — Compilers', note: 'deterministic PDAs and the connection to LR parsing' },
        { title: 'Ginsburg and Greibach — Deterministic context-free languages (1966)', note: 'the DCFLs, and closure under complement' }
      ]
    },

    'top-down-parsing-and-ll1': {
      summary: 'Every LL(1) table cell traceable to the FIRST or FOLLOW computation that ' +
        'produced it, each conflict reported with the two competing productions and a minimal ' +
        'input that reaches the cell, and the repair applied live so the count drops in front ' +
        'of you — or, for the dangling else, does not.',
      intuition: '"Not LL(1)" is a verdict; the cause is the diagnosis, and there are exactly ' +
        'three causes with three different remedies.',
      formulation: {
        equations: [
          {
            label: 'FIRST and FOLLOW',
            expr: 'FIRST(α) = { a : α =>* a β } · FOLLOW(A) = { a : S =>* α A a β }',
            readAs: 'FIRST of a sequence is every terminal that can begin something it derives; ' +
              'FOLLOW of a nonterminal is every terminal that can appear immediately after it.',
            terms: [
              { sym: 'the table', meaning: 'A -> α goes in cell (A, a) for every a in FIRST(α)' },
              { sym: 'the nullable case', meaning: 'and for every a in FOLLOW(A) when α is nullable — the only use of FOLLOW' },
              { sym: 'both need a fixed point', meaning: 'a FIRST set depends on the FIRST sets of what it can begin with' },
              { sym: 'LL(1)', meaning: 'every cell holds at most one production' }
            ]
          },
          {
            label: 'Three causes, three remedies, measured',
            expr: 'grammar · productions · conflicts · after both repairs',
            terms: [
              { sym: 'E -> E + T | T', meaning: '3 · 1 (left recursion) · 4 rules, 0 conflicts — fixed' },
              { sym: 'the precedence grammar', meaning: '6 · 4 (left recursion twice) · 8 rules, 0 conflicts — fixed' },
              { sym: 'the dangling else', meaning: '4 · 1 (shared prefix over an ambiguity) · 5 rules, 1 conflict — NOT fixed' },
              { sym: 'witnesses', meaning: '"a" and "(a)" and "ibtx" — actual inputs reaching each cell' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every cell records which rule entered it',
          why: '"FIRST of the right-hand side" and "nullable, so FOLLOW" are different facts about the grammar.',
          breaks: 'Each filled cell in the demo carries its reason, and a conflicted one carries both.'
        },
        {
          name: 'A conflict report names a reachable input',
          why: 'A conflict nothing can reach is a cleanup task; one with a four-token witness is a bug users hit first.',
          breaks: 'The witness is found by enumerating the language in length order, up to length 5.'
        },
        {
          name: 'There is no backtracking anywhere in the parse loop',
          why: 'That is what one production per cell buys, and why a conflict is fatal rather than slow.',
          breaks: 'The 13-step trace for a 5-token input contains no step that undoes a previous one.'
        },
        {
          name: 'The remedy depends on the cause',
          why: 'Left recursion is eliminated, a shared prefix is factored, and ambiguity is neither.',
          breaks: 'The repair table shows two grammars reaching zero conflicts and the dangling else keeping its one.'
        }
      ],
      complexity: [
        { operation: 'FIRST and FOLLOW', average: 'a few fixed-point rounds', worst: 'O(rules × symbols) per round' },
        { operation: 'table construction', average: 'one pass per production', worst: 'O(rules × terminals)' },
        { operation: 'a predictive parse', average: 'linear in the input', worst: 'linear — 13 steps for 5 tokens on the demo grammar' },
        { operation: 'finding a conflict witness', average: 'one parse per candidate string', worst: '|Σ|^k parses up to length k' }
      ],
      failureModes: [
        {
          symptom: 'A recursive-descent parser overflows the stack on the first input.',
          cause: 'Left recursion: the function calls itself with the input unchanged.',
          fix: 'Eliminate it, or hand-write the loop the elimination would have produced.'
        },
        {
          symptom: 'An LL generator reports a conflict on a grammar that looks fine.',
          cause: 'Two alternatives share a prefix longer than one token.',
          fix: 'Left-factor, or parse the prefix once and decide afterwards, which is what hand-written parsers do.'
        },
        {
          symptom: 'Transformations do not remove a conflict no matter how many you apply.',
          cause: 'The grammar is ambiguous; no transformation of this kind crosses that.',
          fix: 'Rewrite the language construct, or accept the ambiguity and resolve it deliberately.'
        },
        {
          symptom: 'Error messages say "syntax error" and nothing more.',
          cause: 'The expected-token set was in hand at the failure point and thrown away.',
          fix: 'Report the terminals in the failing table row; it costs nothing.'
        }
      ],
      inTheWild: [
        'Clang, Roslyn, Go and V8, all of which parse by hand-written recursive descent.',
        'ANTLR, whose LL(*) runs a sub-parse to decide when one token is not enough.',
        'JSON parsers, which are LL(1) almost by construction and therefore all look alike.',
        'Every compiler course’s first assignment, and the left-recursion trap in it.'
      ],
      sources: [
        { title: 'Aho, Lam, Sethi and Ullman — Compilers: Principles, Techniques and Tools', note: 'FIRST, FOLLOW, the LL(1) table and its conflicts' },
        { title: 'Grune and Jacobs — Parsing Techniques: A Practical Guide', note: 'LL(k), LL(*) and where more lookahead stops helping' },
        { title: 'Parr and Fisher — LL(*): the foundation of the ANTLR parser generator (2011)', note: 'deciding by sub-parse instead of by fixed lookahead' },
        { title: 'Wirth — Compiler Construction', note: 'recursive descent as the primary technique, written by someone who shipped several' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
