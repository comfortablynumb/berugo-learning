/** Concepts for LR tables, general parsing and PEGs (M25.5-M25.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'shift-reduce-and-lr0': [
      {
        term: 'Bottom-up parsing decides what a group WAS, after seeing all of it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["top-down: commit to a rule<br/>from the first token"] --> B["and be wrong when the rest<br/>says otherwise"]',
            '    C["bottom-up: shift tokens onto a stack<br/>until a complete right-hand side<br/>is sitting there"] --> D["then reduce it"]',
            '    D --> E["the decision is made with<br/>the whole group in view"]'
          ].join('\n'),
          caption: 'Deciding late is a strictly better bet, and it is why LR grammars are a strictly larger class than LL ones.'
        },
        plain: 'The opposite bet from top-down, and a better one.',
        formal: 'shift pushes a token; reduce pops a right-hand side and pushes its left-hand side',
        detail: 'The parser never has to guess which production it is in before the evidence ' +
          'arrives, which is why left recursion is not merely allowed but preferred: a ' +
          'left-recursive rule reduces as it goes and keeps the stack at constant depth. The ' +
          'sequence of reductions read backwards is a rightmost derivation, which is the formal ' +
          'statement of "bottom-up is top-down run in reverse".',
        example: 'The trace shows the parser shifting three tokens before its first reduce, ' +
          'postponing every decision until the evidence is complete.'
      },
      {
        term: 'The set of viable prefixes is REGULAR, and that is the whole theorem',
        plain: 'So a finite automaton can recognise them, and that automaton is the parse table.',
        formal: 'for any CFG, { α : α is a prefix of some right-sentential form } is a regular language',
        readAs: 'For any context-free grammar, the stack contents that could still lead to a successful parse form a regular language.',
        detail: 'This is the fact that makes LR parsing possible at all, and it is easy to state ' +
          'and easy to skip past. A handle is the right-hand side that should be reduced next; ' +
          'finding it looks like it needs unbounded memory and does not, because the states the ' +
          'parser can be in are finite. The stack holds those states, and the input tokens are ' +
          'walked over the automaton they define.',
        example: 'The demo draws the item-set automaton and the parse walks it while shifting.'
      },
      {
        term: 'An item is a production with a dot; a state is a set of them',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["E → E • + T"] --> B["we are parsing an E"]',
            '    A --> C["we have already seen an E"]',
            '    A --> D["and + T is still to come"]',
            '    B --> E["a state is every item<br/>that could be true at once"]',
            '    C --> E',
            '    D --> E'
          ].join('\n'),
          caption: 'The dot is a position in a rule, and a state is the set of positions consistent with everything read so far. That set is exactly what the table stores.'
        },
        plain: 'E -> E • + T means we are parsing an E, we have seen an E, and + T is to come.',
        formal: 'closure: a dot before a nonterminal adds that nonterminal’s rules with the dot at the start',
        detail: 'Closure and goto generate every state from the start item and nothing else is ' +
          'involved. The KERNEL is what the parser actually knows and the closure is what it ' +
          'might be starting; real generators store only the kernel and recompute the closure on ' +
          'demand, because the kernel is small and the closure can be most of the grammar.',
        example: 'The demo separates kernel from closure per state and reports how many items ' +
          'closure added.'
      },
      {
        term: 'ACTION is for terminals, GOTO is for after a reduce',
        plain: 'Two tables, one automaton.',
        formal: 'ACTION[state][terminal] in {shift s, reduce r, accept} · GOTO[state][nonterminal] = state',
        detail: 'GOTO is consulted only after a reduction exposes a nonterminal that has to be ' +
          'walked over. The table is mostly empty, and an empty cell is not a defect — it is a ' +
          'syntax error whose message can list exactly the tokens the row does have, which is ' +
          'the best error message any parser gets for free and which many implementations still ' +
          'discard.',
        example: 'The rendered table shows twelve states with the GOTO columns on the right, and ' +
          'most cells blank.'
      },
      {
        term: 'LR(0) reduces on everything, which conflicts constantly',
        plain: 'A completed item means reduce, regardless of what comes next.',
        formal: 'ACTION[state][a] = reduce r for every terminal a, whenever the state holds a completed item',
        detail: 'That is exactly as blunt as it sounds and it is why the expression grammar has ' +
          'two shift/reduce conflicts under LR(0): the state that has just finished a T also ' +
          'wants to shift a `*`, and with no lookahead there is no basis for choosing. LR(0) is ' +
          'not a technique anyone uses directly; it is the substrate SLR and LALR are built on.',
        example: 'What SLR removed = 2 → 0 on the precedence fixture, at no cost in states.'
      },
      {
        term: 'SLR adds one rule and it is enough for most real grammars',
        plain: 'Reduce by A -> α only when the lookahead is in FOLLOW(A).',
        formal: 'ACTION[state][a] = reduce (A -> α) only for a in FOLLOW(A)',
        readAs: 'Enter a reduction into a cell only for the terminals that can legitimately ' +
          'follow the rule’s left-hand side anywhere in the grammar.',
        detail: 'The same twelve states drop from two conflicts to zero, so the improvement is ' +
          'free in table size. FOLLOW is a coarse approximation, though: it pools what can ' +
          'follow A anywhere in the grammar rather than what can follow it in THIS state, which ' +
          'is why some grammars defeat SLR and need the per-item lookaheads of the next section.',
        example: 'Switching the lookahead control between LR(0) and SLR changes the conflict ' +
          'count and leaves the state count identical.'
      },
      {
        term: 'A conflict report names the state, the token, both actions and the items',
        plain: '"1 shift/reduce conflict" is not enough to act on.',
        formal: 'state 7 on e: shift to 8 · reduce by S -> i E t S · items S -> i E t S • and S -> i E t S • e S',
        detail: 'From that report you can see immediately that shifting attaches the `else` to ' +
          'the inner `if` and reducing attaches it to the outer one, and that shifting is what ' +
          'you want. From a count you can see nothing at all. The report is what turns a ' +
          'conflict from a warning you tolerate into a decision you make, which is the whole ' +
          'difference between a grammar that is maintained and one that rots.',
        example: 'The conflict table prints exactly those four fields for the dangling-else ' +
          'grammar.'
      },
      {
        term: 'The generator defaults to shift, and that default is usually right',
        plain: 'Which is precisely the problem.',
        formal: 'on a shift/reduce conflict, prefer shift; on reduce/reduce, prefer the earlier rule',
        detail: 'Because the default is usually right, nobody investigates, and the count creeps ' +
          'up: someone adds a rule, the number goes from three to five, and because three was ' +
          'already tolerated the two new ones are never examined. Years later a construct parses ' +
          'in a way nobody chose. The fix is procedural — pin the expected count in CI so a new ' +
          'conflict has to be fixed or accepted in writing.',
        example: 'The demo reports every conflict and applies the shift default, so both the ' +
          'behaviour and the decision it hid are visible.'
      }
    ],

    'lalr-and-canonical-lr1': [
      {
        term: 'An LR(1) item carries one lookahead terminal',
        plain: 'E -> e •, c means this reduction is valid only if the next token is c.',
        formal: 'closure attaches FIRST of what follows A, falling back to the item’s own lookahead when nullable',
        detail: 'That single rule is the entire difference from LR(0), and it is where the ' +
          'precision comes from: the same position in the grammar reached by two different ' +
          'routes gets two different lookahead sets, so a reduction valid on one route is not ' +
          'entered on the other. It is also where the state explosion comes from, for exactly ' +
          'the same reason.',
        example: 'The precedence grammar goes from twelve LR(0) states to twenty-two LR(1) ones ' +
          'with no change to the grammar.'
      },
      {
        term: 'LALR merges states whose CORES are equal and unions the lookaheads',
        plain: 'The cores are the LR(0) states, so LALR always has exactly as many.',
        formal: 'core(I) = I with lookaheads stripped; merge every group with equal cores',
        detail: 'That is the deal LALR offers: LR(1) precision at LR(0) size. In 1975 the ' +
          'difference was between a table that fitted in memory and one that did not, and the ' +
          'memory constraint is long gone while the tooling default is not — bison still builds ' +
          'LALR unless told otherwise, so the conflicts it reports are still the ones the merge ' +
          'causes.',
        example: 'Cores merged = 1 on the default grammar, taking fourteen canonical states to ' +
          'thirteen.'
      },
      {
        term: 'The merge can create reduce/reduce conflicts neither neighbour has',
        plain: 'Pooling lookaheads makes two reductions each valid on both tokens.',
        formal: 'state 6 reduces E -> e on c and F -> e on d before the merge, and both on both after',
        detail: 'Nothing about the grammar changed — the information that distinguished the two ' +
          'routes was thrown away. The demo computes this as a number rather than describing it: ' +
          'the induced-conflict metric is LALR\'s conflict count minus canonical LR(1)\'s, and on ' +
          'the standard witness grammar it is 2 while SLR, LR(0) after FOLLOW, and LR(1) all ' +
          'have different counts.',
        example: 'Conflicts the merge caused = 2, with the merged item set printed showing the ' +
          'pooled lookaheads.'
      },
      {
        term: 'A merge never creates a shift/reduce conflict, only reduce/reduce',
        plain: 'Shifts come from transitions, which depend on the core alone.',
        formal: 'goto is a function of the core, so merging equal cores preserves every shift action',
        detail: 'That asymmetry is why "LALR is almost LR(1)" is a fair summary in practice: the ' +
          'failure mode is narrow and identifiable rather than diffuse. If bison reports a ' +
          'reduce/reduce conflict on a grammar you believe is unambiguous, the merge is the ' +
          'first thing to suspect and switching to canonical LR or IELR is the first thing to ' +
          'try.',
        example: 'The comparison table shows the shift/reduce column identical across all four ' +
          'flavours on every fixture.'
      },
      {
        term: 'A conflict present in canonical LR(1) is a real grammar problem',
        plain: 'And one absent from LR(1) was manufactured by the merge.',
        formal: 'diagnose by rebuilding the canonical table and testing membership',
        detail: 'The two need different fixes and every generator reports them identically, ' +
          'which is why the second kind costs an afternoon. A real conflict needs the grammar ' +
          'changed or a precedence declaration; a merge-induced one needs a nonterminal renamed ' +
          'to break the shared core, or a generator flag. The demo\'s last column makes the ' +
          'distinction mechanical.',
        example: 'The conflict table marks each row "yes — a real ambiguity" or "NO — the merge ' +
          'caused it".'
      },
      {
        term: 'Precedence declarations resolve conflicts without fixing the grammar',
        plain: 'They work, and the grammar stops being a specification of the language.',
        formal: '%left \'+\' then %left \'*\' resolves by comparing the precedence of the rule and the lookahead',
        detail: 'After the declarations the grammar file admits two parses for `a + a + a` and a ' +
          'separate stanza picks one, so anyone reading the rules to learn the language reads ' +
          'something incomplete. That is a real cost wherever the grammar is the reference — a ' +
          'standards document, a second implementation, a highlighter written from the spec — ' +
          'and a small one for expression operators where the convention is universal.',
        example: 'The choice table separates the techniques by what they accept and who uses ' +
          'them, which is the practical form of the same decision.'
      },
      {
        term: 'IELR gets LR(1) power at LALR size, and almost nobody uses it',
        plain: 'One line in a bison grammar file, available since 2012.',
        formal: '%define lr.type ielr',
        detail: 'It accepts everything canonical LR(1) accepts while keeping the state count ' +
          'close to LALR, by splitting only the states where the merge would actually cause a ' +
          'conflict. If the demo says the merge caused your reduce/reduce conflict, that line is ' +
          'the fix, and it is cheaper than either restructuring the grammar or paying for the ' +
          'full canonical table.',
        example: 'The choice table lists it between canonical LR(1) and GLR, with its table size ' +
          'and what it accepts.'
      },
      {
        term: 'GLR changes the cost model rather than the table',
        plain: 'Take every action a conflicted cell offers and let the branches die or merge.',
        formal: 'a conflicted table plus a graph-structured stack parses every context-free grammar',
        detail: 'Instead of demanding a conflict-free table, GLR runs the conflicted one and ' +
          'forks. On the deterministic parts of a grammar there are no forks and it runs at LR ' +
          'speed, so the cost of generality is paid only where the ambiguity is — which is the ' +
          'right shape for a real language that is deterministic except in three constructs.',
        example: 'The general-parsing section runs GLR on the same tables this section builds ' +
          'and reports its forks and merges.'
      }
    ],

    'general-parsing-earley-cyk-glr': [
      {
        term: 'A general parser takes the grammar as data, with no build step',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["LR: grammar → table generator<br/>→ tables → parser"] --> B["a build step, and a conflict<br/>report to appease"]',
            '    C["Earley or GLR: hand it the<br/>grammar at runtime"] --> D["it parses, ambiguity and all"]',
            '    D --> E["slower, and it accepts<br/>grammars nothing else will"]'
          ].join('\n'),
          caption: 'When the grammar is user-supplied or changes at runtime, a table generator is not an option at all — which is the situation general parsers exist for.'
        },
        plain: 'You hand it a grammar at runtime and it parses.',
        formal: 'no normal form, no conflict report, no restriction on the grammar',
        detail: 'That is a different product from a parser generator, and it is why anything ' +
          'that must treat grammars as input ends up here: a linter covering many languages, a ' +
          'natural-language tool, a syntax-definition format, a teaching tool. The grammar in ' +
          'the file is the grammar that runs, so an error message can quote the rule the author ' +
          'wrote rather than a generated nonterminal.',
        example: 'Every fixture in the milestone runs through all three general parsers without ' +
          'any transformation being applied first.'
      },
      {
        term: 'CYK is dynamic programming over spans, cubic on everything',
        plain: 'Fill a triangular table of which nonterminals derive which substring.',
        formal: 'T[i][j] = { A : A -> B C, B in T[i][k], C in T[k][j] } over all splits k',
        readAs: 'A nonterminal covers a span if some rule splits it into two nonterminals that cover the two halves.',
        detail: 'It needs Chomsky normal form, so the grammar is converted first and the tree ' +
          'comes back binarised and full of generated names. The cost does not adapt: an ' +
          'unambiguous grammar a linear parser would handle still costs cubic time, which is why ' +
          'CYK — despite being the easiest of the three to implement — is almost never what ' +
          'ships.',
        example: '15 table cells over a CNF grammar of 4 rules on the default input, against 21 ' +
          'Earley chart items.'
      },
      {
        term: 'Earley is a chart of dotted items with an ORIGIN',
        plain: 'Three operations fill a column: predict, scan, complete.',
        formal: 'an item is (rule, dot, origin); complete returns to its origin column and advances what waited there',
        detail: 'The origin field is what makes the algorithm work — it is how a completion knows ' +
          'which column to return to. Acceptance is then a lookup rather than a separate check: ' +
          'a completed item for the start symbol with origin 0 in the last column IS acceptance. ' +
          'The cost adapts, being cubic in the worst case, quadratic on unambiguous grammars and ' +
          'linear on the grammars an LR parser handles.',
        example: 'The chart viewer shows each item with its origin and which of the three ' +
          'operations added it.'
      },
      {
        term: 'ε-rules are the part naive Earley implementations get wrong',
        plain: 'A nullable nonterminal can complete in the column it was predicted in.',
        formal: 'when predicting A and A is nullable, also advance the predicting item immediately',
        detail: 'Without that rule (Aycock and Horspool\'s fix) a prediction made after the ' +
          'completion never learns about it, and the parser rejects strings the grammar derives. ' +
          'The standard witness is `S → A A A A` with `A → a | ε`: a naive implementation ' +
          'rejects the empty string on it, and the demo carries that fixture precisely so the ' +
          'implementation has to pass it.',
        example: 'The nullable fixture is one of the demo\'s grammars, and CYK and GLR agree ' +
          'with Earley on it for every input.'
      },
      {
        term: 'GLR is an LR parser that forks instead of failing',
        plain: 'A conflicted cell offers two actions and GLR takes both.',
        formal: 'the stack becomes a graph whose branches share prefixes and merge on equal (state, position)',
        detail: 'Forking is cheap because the branches share their common prefix, and merging ' +
          'back is automatic when two branches reach the same state at the same input position. ' +
          'The reduction step has to walk BACK pointers to a fixed point, because adding an edge ' +
          'to a vertex already reduced from opens paths that were not there the first time — ' +
          'skipping that loses derivations silently.',
        example: '12 reductions and 3 forks on the ambiguous fixture, producing a forest rather ' +
          'than a tree.'
      },
      {
        term: 'A shared packed parse forest is one node per (symbol, span)',
        plain: 'Two derivations of the same span are packed into one node, not duplicated.',
        formal: 'node(A, i, j) holds a list of packings, each a rule plus its children',
        detail: 'That is what keeps an exponential number of trees in a polynomial amount of ' +
          'memory: the node count is bounded by the nonterminals times n²/2, while the tree ' +
          'count for an ambiguous grammar can be Catalan. The demo measures both curves side by ' +
          'side, and the gap is the entire argument for handing back a forest.',
        example: 'At 21 tokens the forest is 87 nodes and there are 16 796 distinct trees.'
      },
      {
        term: 'Unfolding the forest is where the exponential waits',
        plain: 'Asking for "the parse tree" of an ambiguous input is a category error.',
        formal: 'the number of trees is the product of the packing counts along every path',
        detail: 'The technique real GLR front ends use is to keep the forest and filter it — by ' +
          'a precedence rule, by a type check, by which reading names a declared symbol — rather ' +
          'than unfolding and choosing. Unfolding is available and the demo caps it, because a ' +
          'parser that returned a list of trees would exhaust memory on an expression a person ' +
          'could type.',
        example: 'The growth table shows the forest under a hundred nodes while the tree count ' +
          'passes sixteen thousand.'
      },
      {
        term: 'Three unrelated mechanisms agreeing is the test',
        plain: 'A disagreement means one of them is wrong, and the sweep says which input.',
        formal: 'for every w up to length k and every fixture: Earley(w) = CYK(w) = GLR(w)',
        detail: 'A chart of dotted items, a triangular table over a normalised grammar, and an ' +
          'LR automaton with a graph-structured stack share no code and almost no ideas, so ' +
          'agreement across thousands of inputs is real evidence rather than a tautology. The ' +
          'sweep reports a named failing input rather than a percentage, which is the only form ' +
          'of such a report that anyone can act on.',
        example: 'The parse lab sweeps every fixture and reports 13 124 checks with zero ' +
          'disagreements.'
      }
    ],

    'pegs-and-packrat-parsing': [
      {
        term: 'A PEG describes a parser, not a set of strings',
        plain: 'It looks like a CFG and its semantics are operational.',
        formal: 'a PEG denotes a recursive-descent parser with backtracking and ordered choice',
        detail: 'That is the source of every surprise here. A CFG asks whether ANY derivation ' +
          'produces the string; a PEG runs a specific procedure and reports what it did. Two ' +
          'rule sets that look identical on the page can therefore define different languages, ' +
          'which makes "a PEG is just a grammar" the most expensive misunderstanding in this ' +
          'section.',
        example: 'The CFG-against-PEG table shows `ab` accepted by the grammar and rejected by ' +
          'the PEG with the same two alternatives.'
      },
      {
        term: 'Ordered choice commits to the first alternative that succeeds AT ALL',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["rule: A / AB"] --> B["try A — it matches"]',
            '    B --> C["commit. never try AB"]',
            '    C --> D["even if committing makes<br/>the whole parse fail"]',
            '    D --> E["so the second alternative is<br/>unreachable, silently"]'
          ].join('\n'),
          caption: 'It looks like a CFG\'s alternation and is not: ordering the alternatives wrongly deletes a branch of the language, with no warning from the tool.'
        },
        plain: 'Not the first that lets the whole parse finish.',
        formal: 'A / B: try A; if A succeeds, commit, even if the caller then fails',
        detail: 'That distinction is the entire hazard. `("a" / "ab")` on the input `ab` commits ' +
          'to `a`, the caller finds a leftover character, and the second alternative is never ' +
          'reconsidered — there is no backtracking into a choice that already succeeded. A PEG ' +
          'therefore cannot be ambiguous, and what was ambiguity in the CFG becomes a silent ' +
          'preference instead of a reported conflict.',
        example: 'The order control flips the same two alternatives and the result on `ab` ' +
          'changes from a partial match to a complete one.'
      },
      {
        term: 'An unreachable alternative is dead code with nothing reporting it',
        plain: 'If an earlier alternative always matches a prefix, the later one never wins.',
        formal: 'if L(A) contains a prefix of every string in L(B), then A / B never reaches B',
        detail: 'Deciding this in general is undecidable — it reduces to grammar equivalence — ' +
          'but the case that actually occurs is exactly decidable: a shorter literal before a ' +
          'longer one. The failure it causes is specific: you add a keyword to a language whose ' +
          'identifier rule comes first, everything compiles, every test passes, and the keyword ' +
          'is silently an identifier forever.',
        example: 'The check reports alternative 2 shadowed by alternative 1, with the reason ' +
          '"the earlier alternative \'a\' is a prefix of \'ab\'".'
      },
      {
        term: 'Repetition is greedy and never gives anything back',
        plain: 'A* A matches nothing in a PEG and any non-empty run in a CFG.',
        formal: 'A* consumes maximally and does not reconsider when the rest of the rule fails',
        detail: 'This is the other place PEG and CFG semantics part company, and it bites in ' +
          'ordinary rules rather than in contrived ones — any rule of the form "some things, ' +
          'then one more thing of the same kind" is broken. The rewrite is to express the ' +
          'trailing element as part of the repetition and check the count afterwards, which is ' +
          'less readable and correct.',
        example: 'The semantics table contrasts the two readings of `A*` with the consequence for ' +
          '`A* A`.'
      },
      {
        term: 'Syntactic predicates make PEGs incomparable with CFGs',
        plain: '&e and !e are unbounded lookahead that consumes nothing.',
        formal: '&e succeeds where e matches; !e succeeds where e does not; neither consumes',
        detail: 'With them a PEG recognises `aⁿbⁿcⁿ`, which no context-free grammar can, so a ' +
          'PEG is not a weaker formalism trading power for determinism — it is a different ' +
          'formalism whose class is incomparable. That is why you cannot mechanically translate ' +
          'a CFG into an equivalent PEG, and why a tool offering both syntaxes is offering two ' +
          'languages rather than two notations.',
        example: 'The semantics table\'s predicate row names the language that separates the two ' +
          'classes.'
      },
      {
        term: 'Packrat caches (rule, position) and that is the algorithm, not an optimisation',
        plain: 'Each pair is computed once, so the work is rules times input length.',
        formal: 'memo[rule][position] = end position or FAIL, computed at most once',
        detail: 'Without the cache the designed fixture triples its work per level; with it the ' +
          'work grows by a constant. The measurement in the demo is a real step counter rather ' +
          'than an asymptotic claim: at depth 14 the plain parser takes 606 207 steps and the ' +
          'memoised one takes 124, a ratio of 4 888.8, while the table holds 28 entries.',
        example: 'Cost without the cache = 4 888.8× at depth 14, with the whole growth table ' +
          'printed.'
      },
      {
        term: 'The memory cost is why packrat is not always on',
        plain: 'One entry per rule per input position, which can exceed the file size.',
        formal: 'O(|rules| × n) entries in the worst case',
        detail: 'Production PEG tools memoise selectively — only the rules that actually get ' +
          're-entered at the same position — which recovers most of the speed for a fraction of ' +
          'the memory. That is worth knowing before adopting a PEG tool for large inputs, ' +
          'because "linear time" quietly means "linear time and linear memory in the grammar ' +
          'size as well".',
        example: 'Memo entries = 28 at depth 14, against 124 steps — the table is small here and ' +
          'scales with the input in a real grammar.'
      },
      {
        term: 'Left recursion in a PEG is a hang, and the workarounds are real',
        plain: 'A <- A x / y recurses forever with no input consumed.',
        formal: 'seed the memo entry with FAIL and re-run while the result keeps growing (Warth)',
        detail: 'Seeding with failure and stopping — which is what this implementation and most ' +
          'simpler tools do — turns the hang into a rejection, which is honest and still wrong ' +
          'about the language. Warth\'s seed-and-grow algorithm handles both direct and indirect ' +
          'cases properly, and CPython\'s PEG parser implements it, which is how Python\'s ' +
          'expression grammar stays left-recursive.',
        example: 'The semantics table names all three outcomes: a hang, a rejection, or ' +
          'seed-and-grow.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
