/** Concepts for grammars, transformations, PDAs and LL(1) (M25.1-M25.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'grammars-and-ambiguity': [
      {
        term: 'A grammar is rewrite rules; the language is what they reach',
        plain: 'Start from the start symbol, replace nonterminals until only terminals remain.',
        formal: 'L(G) = { w in T* : S =>* w }',
        readAs: 'The language of a grammar is every string of terminals you can derive from the start symbol.',
        detail: 'Nothing else is in the definition. A symbol is a nonterminal exactly when it ' +
          'has productions of its own, which means the two sets are determined by the grammar ' +
          'text rather than declared — and a nonterminal name typed two ways silently creates a ' +
          'terminal nothing can ever match. "Context-free" is the restriction that a replacement ' +
          'never depends on what surrounds the nonterminal, and it is what buys an efficient ' +
          'parser.',
        example: 'The demo lists the productions and reports which symbols it derived as ' +
          'nonterminals and which as terminals.'
      },
      {
        term: 'A derivation is a sequence; a parse tree is a structure',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["leftmost derivation"] --> C["the same parse tree"]',
            '    B["rightmost derivation"] --> C',
            '    C --> D["the tree is the meaning"]',
            '    D --> E["two derivations, one tree:<br/>no problem at all"]',
            '    D --> F["two TREES: that is ambiguity,<br/>and that is a bug"]'
          ].join('\n'),
          caption: 'Counting derivations catches nothing, because order of expansion is arbitrary. Counting trees is the question, because the tree is what the compiler acts on.'
        },
        plain: 'Many derivations produce the same tree, and the tree is the meaning.',
        formal: 'leftmost and rightmost derivations of one tree differ only in expansion order',
        detail: 'This distinction carries the whole section. Expanding `E → E + E` left-first ' +
          'and right-first gives different step sequences and one structure, so the derivation ' +
          'order is bookkeeping. It matters practically because a top-down parser emits the ' +
          'leftmost derivation as it runs and a bottom-up parser emits the rightmost one ' +
          'backwards, which is why an LR trace reads as reductions in reverse.',
        example: 'The demo replays either order for the same tree; switching the control changes ' +
          'every intermediate line and neither the tree nor the count.'
      },
      {
        term: 'Ambiguity is two trees for one string',
        plain: 'Not two derivations — two structures, which is what makes it a bug.',
        formal: 'G is ambiguous if some w in L(G) has more than one parse tree',
        detail: 'The count is what makes this checkable rather than arguable: the demo ' +
          'enumerates every distinct tree from the Earley chart, so "ambiguous" is a number ' +
          'above one rather than an opinion about the rules. On `a + a + a` the ambiguous sum ' +
          'grammar gives exactly 2 trees, and if `+` were subtraction the two would evaluate to ' +
          'different values, which is how an ambiguous grammar becomes a wrong answer.',
        example: 'Distinct parse trees = 2 on the default input, with both shape lines printed.'
      },
      {
        term: 'A grammar is ambiguous if ANY string has two trees',
        plain: 'So the honest report is the shortest string that does, found by search.',
        formal: 'search inputs in length order for the first with count > 1',
        detail: 'Looking at the rules and having an opinion is how ambiguity gets missed. ' +
          'Enumerating in length order gives a witness you can paste into a test, and its ' +
          'absence up to a bound is evidence rather than proof — which is the honest framing, ' +
          'because deciding ambiguity in general is undecidable. For the default grammar the ' +
          'search returns `a + a + a`, the shortest input with more than one tree.',
        example: 'Shortest ambiguous input = a + a + a, found by enumerating every string up to ' +
          'length 7.'
      },
      {
        term: 'Ambiguity belongs to the grammar, not to the language',
        plain: 'Arithmetic has a settled meaning; the grammar failed to say which.',
        formal: 'two grammars can define the same language and only one be ambiguous',
        detail: 'That is why a rewrite is a legitimate fix rather than a workaround, and the ' +
          'demo checks it rather than asserting it: three of the fixtures accept exactly the ' +
          'same strings and only one of them is ambiguous. A few languages are INHERENTLY ' +
          'ambiguous — no unambiguous grammar exists for them at all — but those are ' +
          'constructed curiosities and a language you designed is almost certainly not one.',
        example: 'The comparison table computes which fixtures share a language rather than ' +
          'claiming it, and the precedence grammar is deliberately excluded because it has ' +
          'parentheses.'
      },
      {
        term: 'Precedence and associativity are grammar SHAPE',
        plain: 'One nonterminal per level, with the tighter level nested inside.',
        formal: 'E -> E + T | T ; T -> T * F | F ; F -> ( E ) | a',
        detail: 'Recursion on the left makes an operator left-associative because the left ' +
          'operand can grow and the right one cannot; flipping the recursion to the right flips ' +
          'the associativity. This encoding works and it is why adding an operator means adding ' +
          'a nonterminal and rewriting the rules around it — the cost that section 25.9 removes ' +
          'by putting precedence in a table instead.',
        example: 'The precedence fixture has one nonterminal per level, and the ambiguous one ' +
          'has a single E that admits both nestings.'
      },
      {
        term: 'The dangling else is the ambiguity every language has',
        plain: 'An else after two ifs can attach to either, and both parses are legal.',
        formal: 'S -> i E t S | i E t S e S | x',
        detail: 'Every real language resolves it identically — bind to the nearest `if` — and ' +
          'almost none of them do it in the grammar. They let the parser generator prefer shift, ' +
          'which produces the right answer by accident rather than by decision. The witness is ' +
          'the shortest program in which an `else` has two homes, and the LR sections show ' +
          'exactly which state and which token the conflict lives in.',
        example: 'The dangling-else fixture keeps its conflict under every LR flavour, because ' +
          'the ambiguity is in the grammar rather than in the table technique.'
      },
      {
        term: 'A generator handed an ambiguous grammar does not stop',
        plain: 'It reports a count, resolves each conflict by a default, and ships a parser.',
        formal: 'conflicts are resolved silently; the resulting parser is deterministic and arbitrary',
        detail: 'That parser is correct for every input where the two readings agree, which is ' +
          'most of them, so the bug surfaces much later as an expression that evaluates wrongly. ' +
          'The procedural fix is to treat a conflict count above zero as a build failure, or to ' +
          'pin the expected count so that a NEW conflict fails CI and has to be either fixed or ' +
          'accepted in writing.',
        example: 'The LR sections print each conflict with its state, its token, both actions ' +
          'and the items responsible — the report a generator replaces with a number.'
      }
    ],

    'grammar-transformations': [
      {
        term: 'A transformation keeps the language and changes the tree',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the original grammar"] --> B["left-factor it, remove<br/>left recursion, binarise it"]',
            '    B --> C["the same set of strings —<br/>the language is preserved"]',
            '    B --> D["a DIFFERENT parse tree"]',
            '    D --> E["so anything reading the tree —<br/>the evaluator, the formatter —<br/>has to be updated too"]'
          ].join('\n'),
          caption: 'Descriptions of these transformations always state the first half. The second half is where the work is, because the tree is what the rest of the compiler consumes.'
        },
        plain: 'That second half is the part descriptions leave out.',
        formal: 'L(G) = L(G′) and the parse trees differ',
        detail: 'Every step in this section alters the shape of the tree for at least some ' +
          'input, so anything downstream that read the old shape — an AST builder, a pretty ' +
          'printer, a source-to-source rewriter — is now reading a different one and will not ' +
          'crash while doing it. The demo finds and names the first input whose shape changed, ' +
          'because that is the fact the language check is designed not to see.',
        example: 'Tree shape changed = yes, at a — with both shapes printed side by side.'
      },
      {
        term: 'Language preservation is a differential test, not a claim',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["enumerate every string the original<br/>grammar derives, up to length k"] --> C["compare the two sets,<br/>in both directions"]',
            '    B["enumerate the same for<br/>the transformed grammar"] --> C',
            '    C --> D["anything in one and not the other<br/>is a concrete counter-example"]',
            '    D --> E["which beats reading the<br/>transformation and believing it"]'
          ].join('\n'),
          caption: 'Transformations are easy to get subtly wrong and the mistakes do not throw. Enumerating both languages is cheap up to a useful length and finds them immediately.'
        },
        plain: 'Enumerate both languages up to a length and compare in both directions.',
        formal: 'L(G) ∩ Σ^≤k = L(G′) ∩ Σ^≤k, checked exhaustively',
        readAs: 'The two grammars derive exactly the same strings, over every string up to a fixed length, checked exhaustively.',
        detail: 'Grammar equivalence is undecidable in general, so a proof for one ' +
          'transformation is a page of induction and a check for one instance is a loop. The ' +
          'pipeline re-checks every step against the ORIGINAL grammar rather than against the ' +
          'previous step, so an error introduced early cannot be hidden by a later step that is ' +
          'internally consistent — which is a real failure mode of chained rewrites.',
        example: 'Language preserved = yes, over 30 strings compared in both directions up to ' +
          'length 6.'
      },
      {
        term: 'Useless symbols come in two kinds and both mean a typo',
        plain: 'One derives no terminal string; the other is unreachable from the start.',
        formal: 'non-productive: no w with A =>* w · unreachable: no derivation S =>* αAβ',
        readAs: 'A symbol is non-productive when no string of terminals can be derived from it, and unreachable when no derivation from the start symbol ever mentions it.',
        detail: 'Removing either changes nothing about the language, which makes the step look ' +
          'pointless — until you notice why they appear. A nonterminal spelled two ways is ' +
          'unreachable under one spelling and non-productive under the other, so the check is ' +
          'really a spell-checker for grammar files, and it is the precondition every other ' +
          'transformation assumes.',
        example: 'The pipeline runs it first, because the later steps assume every symbol both ' +
          'derives something and is reachable.'
      },
      {
        term: 'ε-removal is exponential in the nullable symbols of one rule',
        plain: 'Each rule mentioning a nullable symbol splits into copies with and without it.',
        formal: 'for A -> X1...Xn with k nullable Xi, emit up to 2^k variants',
        detail: 'The blow-up is in the exponent of the nullable count within a SINGLE right-hand ' +
          'side, which is usually small and occasionally is not. The subtlety that changes the ' +
          'language rather than the size is the start symbol: if the original grammar derives ' +
          'the empty string, the new start symbol must keep an ε rule of its own, and dropping ' +
          'it is the classic off-by-one that the differential test catches immediately.',
        example: 'The nullable fixture takes 3 productions to 6, and the balanced-brackets ' +
          'fixture keeps its start rule nullable.'
      },
      {
        term: 'Unit productions cost you the chain, and the chain was the precedence',
        plain: 'A -> B adds a tree level and nothing to the language.',
        formal: 'replace each unit chain A =>* B by B’s non-unit rules directly under A',
        detail: 'Removing them multiplies the rule count and flattens the tree, and flattening ' +
          'the tree is exactly what destroys the precedence levels a well-built expression ' +
          'grammar encoded as unit chains. `E → T`, `T → F` exist to say that a T is a valid E; ' +
          'once removed, the levels are gone from the tree and any pass that read nesting to ' +
          'recover precedence is reading something else.',
        example: 'The precedence fixture goes from 6 productions to 9 at the unit step alone.'
      },
      {
        term: 'Left recursion is a bug in one parser family and best practice in the other',
        plain: 'Recursive descent loops on it; LR parsers prefer it.',
        formal: 'A =>+ A α is fatal top-down and keeps an LR stack shallow',
        readAs: 'A nonterminal that can derive itself followed by something, in one or more steps, is fatal to a top-down parser and keeps an LR stack shallow.',
        detail: 'The top-down failure is not subtle: the function for E calls the function for E ' +
          'first, with no input consumed between the calls, so the stack grows while the input ' +
          'does not. The LR preference is equally concrete: a left-recursive rule reduces as it ' +
          'goes and keeps the stack at constant depth, where a right-recursive one stacks the ' +
          'entire input before its first reduction. There is no neutral way to write it.',
        example: 'Left recursive = E, T → none, computed before and after the elimination step.'
      },
      {
        term: 'Indirect left recursion needs an ordering, not a special case',
        plain: 'A -> B x with B -> A y loops and no rule starts with its own left-hand side.',
        formal: 'Paull: substitute earlier nonterminals into later ones in a fixed order, then eliminate direct cases',
        detail: 'The ordering is part of the algorithm rather than an implementation detail: ' +
          'processing nonterminals in a fixed sequence and substituting every earlier one into ' +
          'the rules of the later ones turns every cycle into a direct one, which the simple ' +
          'rewrite then handles. Skipping this and handling only the direct case is the most ' +
          'common half-implementation, and it terminates on the fixtures and hangs on real ' +
          'grammars.',
        example: 'The elimination step is checked for language preservation on all four ' +
          'fixtures, direct and indirect cases alike.'
      },
      {
        term: 'Chomsky normal form is a means, and nobody writes in it',
        plain: 'Every rule becomes A -> B C or A -> a, which is what CYK needs.',
        formal: 'binarise long right-hand sides, then replace terminals in binary rules by fresh nonterminals',
        detail: 'The cost is readability and size: the demo takes a six-rule expression grammar ' +
          'to thirty-three rules over twenty-two nonterminals, all of them generated names with ' +
          'no counterpart in the source. That is why an error message quoting a generated ' +
          'nonterminal is unreadable and why real tools keep a mapping back to the rule the ' +
          'author wrote, converting, parsing, and mapping the tree back.',
        example: 'The pipeline row for cnf shows 33 productions across 22 nonterminals on the ' +
          'precedence fixture.'
      }
    ],

    'pushdown-automata': [
      {
        term: 'A PDA is a finite automaton plus one unbounded stack',
        plain: 'That single addition is the whole difference from the previous milestone.',
        formal: '(Q, Σ, Γ, δ, q0, Z0, F) with δ: Q × (Σ ∪ {ε}) × Γ → P(Q × Γ*)',
        readAs: 'A pushdown automaton has states, an input alphabet, a stack alphabet, and a transition that reads a symbol or nothing, pops one stack symbol, and pushes a string.',
        detail: 'A finite automaton can count modulo k and cannot count to n, because counting ' +
          'to n needs n states and the set is fixed in advance. A stack lifts exactly that ' +
          'restriction and nothing else — the demo machine for balanced brackets has one state ' +
          'and matches any depth, because the counting lives in the stack rather than in the ' +
          'state set.',
        example: 'The bracket machine has 1 state and 4 transitions, and its deepest stack grows ' +
          'with the nesting of the input.'
      },
      {
        term: 'Acceptance by final state and by empty stack are equivalent',
        plain: 'Either can simulate the other with a bottom marker and one extra state.',
        formal: 'L(M) by final state = L(M′) by empty stack, for a mechanically built M′',
        detail: 'The choice is therefore presentational, and this section uses empty stack ' +
          'because it makes the bracket machine one rule shorter and the CFG construction need ' +
          'no accepting states at all. Knowing the two are interchangeable matters when reading ' +
          'other treatments: a machine that looks different from the one you built may be the ' +
          'same machine under the other convention.',
        example: 'Both demo machines accept by empty stack; the metric note says which condition ' +
          'was used.'
      },
      {
        term: 'The CFG to PDA construction is three transition kinds',
        plain: 'Push the start symbol, expand a nonterminal on top, match a terminal on top.',
        formal: 'expand: (q, ε, A) -> (q, α) for each A -> α · match: (q, a, a) -> (q, ε)',
        readAs: 'Reading nothing, pop a nonterminal and push one of its right-hand sides; reading a terminal, pop the matching terminal and push nothing.',
        detail: 'The machine that comes out is a nondeterministic top-down parser, which is why ' +
          'it accepts exactly what the grammar derives. That is the shorter direction of the ' +
          'CFG–PDA equivalence and the one worth carrying: every nonterminal on the stack is a ' +
          'piece of the sentential form still owed, so the stack is a list of obligations in the ' +
          'order they were incurred.',
        example: 'The construction is run for any fixture grammar and its transition table is ' +
          'printed with a `why` column naming the production each row came from.'
      },
      {
        term: 'A construction is checked, not argued',
        plain: 'Run the machine and a general parser over every short string and compare.',
        formal: 'for all w with |w| <= k: M accepts w iff Earley accepts w',
        detail: 'The equivalence proof is an induction on derivation length and it catches ' +
          'reasoning errors; the exhaustive check catches implementation errors, which is the ' +
          'kind you actually make. The demo runs 31 inputs through both and prints each verdict ' +
          'pair, so a disagreement arrives as a named input rather than as a percentage — the ' +
          'only form of such a report that is actionable.',
        example: 'Agrees with Earley = yes, over 31 inputs, with the per-input table below it.'
      },
      {
        term: 'Nondeterminism means tracking a SET of configurations',
        plain: 'Same technique as running an NFA, with the stack as extra state.',
        formal: 'a configuration is (state, stack, position); the search explores all of them',
        detail: 'The constructed machine has to guess which production to expand, so "run it" ' +
          'means a breadth-first search over configurations rather than a single walk. That is ' +
          'why the configuration count grows so much faster than the input length, and it is ' +
          'the concrete motivation for Earley and GLR: both share work between branches instead ' +
          'of paying for each guess separately.',
        example: 'Configurations explored = 10 on a six-token bracket string, and the trace ' +
          'shows several alternative guesses alive at once.'
      },
      {
        term: 'Deterministic PDAs recognise strictly less',
        plain: 'The DCFLs are what LR parsers handle, and they are a proper subset.',
        formal: 'palindromes over {a, b} are context-free and not deterministic',
        detail: 'A DPDA has at most one move per (state, input symbol, stack top) and may not ' +
          'mix an ε-move with a reading move at the same configuration. The palindrome language ' +
          'defeats it for a concrete reason: nothing in the input tells the machine where the ' +
          'middle is, so it must guess, and a deterministic machine cannot. That boundary is ' +
          'exactly the boundary of LR parsing.',
        example: 'The closure table marks which operations the DCFLs are closed under, and ' +
          'complement is the only one determinism buys.'
      },
      {
        term: 'Context-free languages are not closed under intersection',
        plain: 'You cannot express "parses as this grammar and also as that one".',
        formal: 'aⁿbⁿcᵐ ∩ aᵐbⁿcⁿ = aⁿbⁿcⁿ, which is not context-free',
        readAs: 'The set of strings in both of two context-free languages need not itself be context-free.',
        detail: 'That non-closure is why every static check beyond syntax is a separate pass ' +
          'over the tree rather than more grammar rules — type rules, scope rules and arity ' +
          'checks cannot be folded into the grammar even in principle. The useful counterpart is ' +
          'that intersection WITH A REGULAR LANGUAGE stays context-free, which is the standard ' +
          'way to restrict a grammar by a token-level rule.',
        example: 'The closure table contrasts the two intersection rows, which is the pair worth ' +
          'remembering.'
      },
      {
        term: 'A capped search must report the cap, not a rejection',
        plain: 'Left recursion expands forever without consuming input.',
        formal: 'E -> E + E lets the machine grow the stack with no input read',
        detail: 'A breadth-first search over configurations does not terminate on a ' +
          'left-recursive grammar, so any implementation has a bound. Reporting that bound as ' +
          '"rejected" is a lie about the language and exactly the kind of quiet wrongness this ' +
          'course is against: the demo says "search capped" and explains why, which is both ' +
          'honest and more useful, since it names the grammar property responsible.',
        example: 'Selecting the left-recursive fixture reports a capped search rather than a ' +
          'rejection, and says that expansion consumes no input.'
      }
    ],

    'top-down-parsing-and-ll1': [
      {
        term: 'Recursive descent is one function per nonterminal',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["grammar rule for Expr"] --> B["function parseExpr"]',
            '    C["grammar rule for Term"] --> D["function parseTerm"]',
            '    B --> E["the body is the right-hand side,<br/>read left to right"]',
            '    D --> E',
            '    E --> F["so the parser reads as the grammar,<br/>and a grammar change is a code change<br/>in the obvious place"]'
          ].join('\n'),
          caption: 'The reason this style survives in production compilers is not speed. It is that the code and the specification stay legible as the same document.'
        },
        plain: 'The function body is the right-hand side, and the parser reads as the grammar.',
        formal: 'each production becomes a sequence of calls and token matches',
        detail: 'It is the most readable parser there is, and its structure is literally the ' +
          'grammar, which is why most production compilers use it despite offering no class ' +
          'guarantee whatsoever. A hand-written parser accepts exactly what the code accepts, so ' +
          'the grammar file that documents it drifts unless something checks the two against ' +
          'each other.',
        example: 'The LL(1) table in the demo is the generated counterpart of the same ' +
          'structure, with one row per nonterminal.'
      },
      {
        term: 'FIRST is what can start a string; FOLLOW is what can come after',
        plain: 'FIRST fills the table; FOLLOW is only consulted for nullable right-hand sides.',
        formal: 'FIRST(α) = { a : α =>* a β } · FOLLOW(A) = { a : S =>* α A a β }',
        readAs: 'FIRST of a sequence is every terminal that can begin something it derives; FOLLOW of a nonterminal is every terminal that can appear immediately after it.',
        detail: 'Both need a fixed point, because a nonterminal\'s FIRST set depends on the FIRST ' +
          'sets of the nonterminals it can begin with, which may include itself. FOLLOW appears ' +
          'in exactly one place in the whole construction: when a right-hand side is nullable, ' +
          'choosing it means the nonterminal contributes nothing, so the deciding token is ' +
          'whatever comes after it.',
        example: 'The demo prints nullable, FIRST and FOLLOW per nonterminal, and labels each ' +
          'table cell with which of the two rules put it there.'
      },
      {
        term: 'A cell with two productions kills the parser outright',
        plain: 'The loop has no mechanism for trying the other one.',
        formal: 'LL(1) iff every (A, a) cell holds at most one production',
        detail: 'There is no search and no backtracking anywhere in a predictive parse, which is ' +
          'what buys linear time and what makes a conflict fatal rather than slow. That is a ' +
          'genuinely different failure mode from an LR conflict, where the generator picks a ' +
          'default and ships something that works most of the time — an LL(1) generator simply ' +
          'cannot produce a parser.',
        example: 'Table conflicts = 1 on the left-recursive fixture, with the two competing ' +
          'productions printed.'
      },
      {
        term: 'There are exactly three causes, with three different remedies',
        plain: 'Left recursion, a shared prefix, or genuine ambiguity.',
        formal: 'diagnose by testing for A =>+ Aα, for common FIRST across alternatives, and otherwise',
        readAs: 'Test whether a nonterminal can derive itself as its own leftmost symbol, whether two alternatives can begin with the same terminal, and otherwise conclude ambiguity.',
        detail: 'The remedy differs for each, which is why "not LL(1)" as a verdict is useless. ' +
          'Left recursion is eliminated, a shared prefix is left-factored, and ambiguity is not ' +
          'fixable by any transformation of this kind — the demo\'s repair table shows the ' +
          'dangling-else grammar keeping its conflict through both repairs, because the deciding ' +
          'token is arbitrarily far away.',
        example: 'Why it conflicts = left recursion, with the remedy naming the nonterminal to ' +
          'fix.'
      },
      {
        term: 'A conflict report needs a reachable input',
        plain: 'A conflicted cell nothing can reach is different from one users hit immediately.',
        formal: 'enumerate the language in length order and report the first input reaching the cell',
        detail: 'Generators report neither, which is why triaging a list of conflicts is slow. A ' +
          'conflict in a part of the grammar nothing uses is a cleanup task; a conflict with a ' +
          'four-token witness is a bug the first user will hit. The distinction costs one ' +
          'enumeration to compute and it changes what you do next, which is the definition of a ' +
          'useful diagnostic.',
        example: 'The conflict table\'s last column holds an actual input, found by enumerating ' +
          'the language up to length 5.'
      },
      {
        term: 'Left recursion is an infinite loop, not a limitation',
        plain: 'The function for E calls E first with nothing consumed in between.',
        formal: 'A =>+ A α means recursive descent recurses with the input unchanged',
        readAs: 'A nonterminal that derives itself as its own leftmost symbol in one or more steps makes recursive descent recurse with the input unchanged.',
        detail: 'Saying "LL parsers cannot handle left recursion" makes it sound like a design ' +
          'restriction. It is a stack overflow: the parser makes no progress and the recursion ' +
          'has no base case that the input can reach. That is also why the fix — pull the ' +
          'non-recursive alternative to the front and put the repetition in a tail nonterminal ' +
          '— is about consuming a token before recursing, not about tidiness.',
        example: 'The repair control applies the elimination and the conflict count drops to ' +
          'zero on the same grammar.'
      },
      {
        term: 'More lookahead extends the class less than you expect',
        plain: 'LL(k) resolves bounded shared prefixes and nothing else.',
        formal: 'LL(k) for fixed k does not admit left recursion or ambiguity for any k',
        detail: 'Increasing k lets the parser see further past a common prefix and does nothing ' +
          'about the other two causes. ANTLR\'s LL(*) goes further by running a sub-parse to ' +
          'decide, which is genuinely more powerful and makes the cost of a single decision ' +
          'unbounded — a trade worth knowing about before a pathological grammar makes one ' +
          'decision quadratic.',
        example: 'The repair table shows both transformations leaving the ambiguous fixture ' +
          'conflicted, which no lookahead would change either.'
      },
      {
        term: 'The error detection point is the best feature of a predictive parser',
        plain: 'It fails at the exact token where no continuation exists, and knows what would work.',
        formal: 'an empty cell means no production of A begins with a; the row lists the ones that do',
        detail: 'Because there is no backtracking, a failure is definite at the moment it ' +
          'happens, and the table row already holds the set of terminals that would have ' +
          'continued. That is a usable error message for free, which most implementations throw ' +
          'away by reporting "syntax error" while holding the exact list — and it is what makes ' +
          'the error-recovery section able to do something intelligent.',
        example: 'The trace\'s last action names the token expected, and the error-recovery ' +
          'section turns the same information into diagnostics.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
